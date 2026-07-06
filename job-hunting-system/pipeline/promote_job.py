#!/usr/bin/env python3
"""
promote_job.py — Orchestrate read JD → re-score (final) → tailor CV → store.

Usage: promote_job.py <run_id> <url> [--description <stored_text>]

If the job already has cached jd_json/cv_path in jobs.db, REUSE them and spend nothing.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

FORGE_HOME = Path(os.environ.get("FORGE_SYSTEM_DIR") or os.path.expanduser("~/job-hunting/job-hunting-system"))
HERMES_HOME = Path(os.environ.get("HERMES_HOME") or os.path.expanduser("~/.hermes"))
VENV_PYTHON = HERMES_HOME / "hermes-agent" / "venv" / "bin" / "python3"
PIPELINE_DIR = FORGE_HOME / "pipeline"

sys.path.insert(0, str(PIPELINE_DIR))
from job_store import advance_status, make_key, upsert_seen


def run_cmd(cmd: list, label: str, timeout: int = 180) -> str:
    """Run a subprocess and return stdout. Raise on failure."""
    r = subprocess.run(
        cmd, capture_output=True, text=True, timeout=timeout,
        env={**os.environ, "FORGE_SYSTEM_DIR": str(FORGE_HOME),
             "HERMES_HOME": str(HERMES_HOME)},
    )
    if r.returncode != 0:
        raise RuntimeError(f"{label} failed: {r.stderr[:300]}")
    return r.stdout


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Promote a job: read → score → tailor → store")
    parser.add_argument("run_id", help="Pipeline run_id for context")
    parser.add_argument("url", help="Job listing URL")
    parser.add_argument("--description", help="Stored description (fallback)")
    parser.add_argument("--title", help="Job title (for job store lookup)")
    parser.add_argument("--company", help="Company name (for job store lookup)")
    parser.add_argument("--score", type=float, default=0, help="Original score")
    parser.add_argument("--job-key", dest="job_key", default="",
                        help="Pre-computed job store key from the dashboard (preferred over make_key)")
    args = parser.parse_args()

    # Derive the job store key.
    # Prefer the key passed by the dashboard (already in id:/j: format matching jobs.db).
    listing = {"id": "", "title": args.title or "", "company": args.company or "", "redirect_url": args.url}
    key = args.job_key if args.job_key else make_key(listing)

    # Fallback: if the derived key doesn't exist in jobs.db, search by URL
    # (handles old browser cache sending requests without --job-key)
    conn_path = FORGE_HOME / "jobs.db"
    import sqlite3 as _sqlite3
    _conn = _sqlite3.connect(str(conn_path))
    _conn.row_factory = _sqlite3.Row
    _exists = _conn.execute("SELECT key FROM jobs WHERE key=?", (key,)).fetchone()
    if not _exists:
        _url_row = _conn.execute(
            "SELECT key FROM jobs WHERE url=? LIMIT 1", (args.url,)
        ).fetchone()
        if _url_row:
            key = _url_row["key"]
            print(f"URL-based key lookup: using key={key!r}")
    _conn.close()

    # Check job store for cached data
    import sqlite3
    conn = sqlite3.connect(str(conn_path))
    conn.row_factory = sqlite3.Row
    cached = conn.execute("SELECT jd_json, cv_path, status FROM jobs WHERE key=?", (key,)).fetchone()
    conn.close()

    jd_json = None
    cv_path = None

    if cached and cached["jd_json"]:
        # REUSE cached JD — zero tokens spent
        print(f"Reusing cached JD for {key}")
        jd_json = cached["jd_json"]
        advance_status(key, "read", jd_json=jd_json)

        if cached["cv_path"]:
            print(f"Reusing cached CV: {cached['cv_path']}")
            cv_path = cached["cv_path"]
            advance_status(key, "tailored", cv_path=cv_path)
            print(json.dumps({"status": "reused", "key": key, "jd_cached": True, "cv_cached": True}))
            return
    else:
        # Step 1: Read JD (this is where tokens are spent)
        print("Step 1: Reading job description...")
        reader_cmd = [str(VENV_PYTHON), str(PIPELINE_DIR / "job_reader.py"), args.url]
        if args.description:
            reader_cmd += ["--description", args.description]
        reader_out = run_cmd(reader_cmd, "job_reader", timeout=150)
        reader_result = json.loads(reader_out)

        if "error" in reader_result:
            print(f"FAILED: {reader_result['error']}", file=sys.stderr)
            sys.exit(1)

        jd_json = json.dumps(reader_result)
        advance_status(key, "read", jd_json=jd_json)
        print(f"  → {reader_result.get('extracted', {}).get('full_job_title', '?')}")

    # Step 2: Re-score at final_threshold (mode=final)
    print("Step 2: Re-scoring (final mode)...")
    profile_path = FORGE_HOME / "profile" / "profile.json"
    profile = json.loads(open(profile_path).read())
    # Build a mini-listing for scoring
    mini_listing = {
        "title": args.title or "",
        "company": args.company or "",
        "description": jd_json or "",
        "location": {"display_name": ""},
        "redirect_url": args.url,
        "source": "promote",
    }
    # Score via matcher_score module
    sys.path.insert(0, str(PIPELINE_DIR))
    from matcher_score import score_listing
    final_result = score_listing(mini_listing, profile, "final")
    final_score = final_result["score"]
    print(f"  → final score: {final_score}")

    # Step 3: Tailor CV
    print("Step 3: Tailoring CV...")
    base_cv_path = FORGE_HOME / "cv" / "base_cv.json"
    cv_output_dir = FORGE_HOME / "agents" / "cv-adapter" / "outputs"
    cv_output_dir.mkdir(parents=True, exist_ok=True)

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_name = f"{args.company or 'company'}_{args.title or 'role'}".replace(" ", "_").replace("/", "_")[:60]
    cv_out = str(cv_output_dir / f"tailored_{safe_name}_{ts}.json")

    adapter_cmd = [
        str(VENV_PYTHON), str(PIPELINE_DIR / "cv_adapter.py"),
        jd_json, str(base_cv_path), cv_out,
    ]
    adapter_out = run_cmd(adapter_cmd, "cv_adapter", timeout=300)
    adapter_result = json.loads(adapter_out)
    cv_path = adapter_result.get("path", cv_out)
    print(f"  → saved: {cv_path}")

    # Step 4: Update job store
    advance_status(key, "tailored", cv_path=cv_path)

    print(json.dumps({
        "status": "promoted",
        "key": key,
        "final_score": final_score,
        "jd_path": "(cached in db)",
        "cv_path": cv_path,
    }))


if __name__ == "__main__":
    main()