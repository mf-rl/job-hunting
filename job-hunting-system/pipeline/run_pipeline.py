#!/usr/bin/env python3
"""
run_pipeline.py — Orchestrate scout_search.py → matcher_score.py → job_store.

Modes:
  --find-only   Full search + score + store (free, no tokens)
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

FORGE_HOME = Path(os.environ.get("FORGE_SYSTEM_DIR") or os.path.expanduser("~/job-hunting/job-hunting-system"))
HERMES_HOME = Path(os.environ.get("HERMES_HOME") or os.path.expanduser("~/.hermes"))
VENV_PYTHON = HERMES_HOME / "hermes-agent" / "venv" / "bin" / "python3"
PIPELINE_DIR = FORGE_HOME / "pipeline"
PIPELINE_DB = FORGE_HOME / "pipeline.db"
RUN_FLAG = FORGE_HOME / "pipeline" / ".run-running"
LOG_SCRIPT = HERMES_HOME / "agents" / "_shared" / "log-task-local.sh"
NO_MODEL_REQUIRED = "none - not required"


def _get_db():
    import sqlite3
    PIPELINE_DB.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(PIPELINE_DB))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS runs (
            id          TEXT PRIMARY KEY,
            trigger     TEXT NOT NULL,
            status      TEXT NOT NULL DEFAULT 'running',
            started_at  TEXT NOT NULL,
            ended_at    TEXT,
            summary     TEXT
        )
    """)
    return conn


def run_cmd(cmd: list, label: str, timeout: int = 300) -> str:
    """Run a subprocess and return stdout. Raise on failure."""
    print(f"[{label}] Starting...")
    r = subprocess.run(
        cmd,
        capture_output=True, text=True, timeout=timeout,
        env={**os.environ, "FORGE_SYSTEM_DIR": str(FORGE_HOME),
             "HERMES_HOME": str(HERMES_HOME)},
    )
    if r.returncode != 0:
        print(f"[{label}] FAILED (exit={r.returncode})")
        print(r.stderr[:500])
        raise RuntimeError(f"{label} failed: {r.stderr[:200]}")
    print(f"[{label}] Done")
    return r.stdout


def log_activity(agent: str, task: str, status: str, model: str = NO_MODEL_REQUIRED):
    """Log to agent-logs.db via the shell script."""
    subprocess.run(
        ["bash", str(LOG_SCRIPT), agent, task, status, model],
        capture_output=True, timeout=10,
    )


def find_only() -> dict:
    """Full search + score + store. Returns summary dict."""
    run_id = f"run_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

    # Step 1: Scout search
    log_activity("scout", f"search started: {run_id}", "running")
    scout_out = run_cmd(
        [str(VENV_PYTHON), str(PIPELINE_DIR / "scout_search.py")],
        "Scout search", timeout=600,
    )

    # Parse listings count from scout output
    listings_count = 0
    for line in scout_out.splitlines():
        if '"listings_returned"' in line:
            try:
                import re
                m = re.search(r'"listings_returned":\s*(\d+)', line)
                if m:
                    listings_count = int(m.group(1))
            except Exception:
                pass

    # Find the newest listings file
    scout_dir = FORGE_HOME / "agents" / "scout" / "outputs"
    listings_files = sorted(scout_dir.glob("listings_*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
    if not listings_files:
        raise RuntimeError("No listings file produced by scout_search")
    latest_listings = listings_files[0]
    print(f"[Scout] Output: {latest_listings.name} ({listings_count} listings)")

    # Step 2: Matcher score + store
    profile_path = FORGE_HOME / "profile" / "profile.json"
    profile = json.loads(profile_path.read_text())
    threshold = profile.get("first_cut_threshold", 50)

    log_activity("scout", f"scoring started: {run_id}", "running")
    score_out = run_cmd(
        [str(VENV_PYTHON), str(PIPELINE_DIR / "matcher_score.py"),
         str(latest_listings), "--mode", "first_cut", "--threshold", str(threshold)],
        "Matcher score", timeout=120,
    )

    # Parse matched count from score output
    matched_count = 0
    for line in score_out.splitlines():
        m = re.search(r'Results:\s*(\d+)/\d+\s+passed', line)
        if m:
            matched_count = int(m.group(1))
            break

    print(f"[Matcher] {matched_count}/{listings_count} passed threshold ({threshold})")

    # Step 3: Log completed
    log_activity("scout", f"find completed: {matched_count} matches from {listings_count} listings", "completed")

    return {
        "run_id": run_id,
        "listings_count": listings_count,
        "matched_count": matched_count,
    }


def main():
    parser = argparse.ArgumentParser(description="Run the full pipeline")
    parser.add_argument("--find-only", action="store_true", help="Search + score + store (free)")
    args = parser.parse_args()

    if not args.find_only:
        parser.print_help()
        sys.exit(1)

    # Create run record
    run_id = f"run_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    conn = _get_db()
    conn.execute(
        "INSERT INTO runs (id, trigger, status, started_at) VALUES (?, ?, 'running', ?)",
        (run_id, "find", datetime.now(timezone.utc).isoformat()),
    )
    conn.commit()

    try:
        print(f"Pipeline run {run_id} starting...")
        summary = find_only()
        summary_str = json.dumps(summary)

        conn.execute(
            "UPDATE runs SET status='completed', ended_at=?, summary=? WHERE id=?",
            (datetime.now(timezone.utc).isoformat(), summary_str, run_id),
        )
        conn.commit()

        print(f"\n{'='*60}")
        print(f"Run {run_id} complete:")
        print(f"  listings: {summary['listings_count']}")
        print(f"  matched:  {summary['matched_count']}")
        print(f"{'='*60}")

    except Exception as e:
        error_summary = json.dumps({"error": str(e)})
        conn.execute(
            "UPDATE runs SET status='failed', ended_at=?, summary=? WHERE id=?",
            (datetime.now(timezone.utc).isoformat(), error_summary, run_id),
        )
        conn.commit()
        # Strip single-quotes from error — log script interpolates into a Python string literal
        safe_err = str(e).replace("'", "").replace('"', '')[:120]
        log_activity("scout", f"find failed: {run_id} - {safe_err}", "failed")
        print(f"FAILED: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        conn.close()
        RUN_FLAG.unlink(missing_ok=True)


if __name__ == "__main__":
    main()