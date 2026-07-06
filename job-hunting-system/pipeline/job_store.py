#!/usr/bin/env python3
"""
job_store.py — SQLite-backed persistent job memory.

Table: jobs
  key         TEXT PRIMARY KEY   — Adzuna id, else normalized(title)+normalized(company)
  title       TEXT NOT NULL
  company     TEXT NOT NULL
  url         TEXT
  score       REAL
  status      TEXT NOT NULL DEFAULT 'seen'   — seen → matched → read → tailored (never downgrades)
  jd_json     TEXT                           — cached full JD from Job Reader (reuse = zero tokens)
  cv_path     TEXT                           — cached tailored CV path
  times_seen  INTEGER NOT NULL DEFAULT 1
  first_run   TEXT                           — run_id when first seen
  last_run    TEXT                           — run_id of most recent sighting
  user_status TEXT                           — user-set note: 'promoted', 'dismissed', etc.
"""

from __future__ import annotations

import os
import sqlite3
from pathlib import Path
from typing import Any, Optional

FORGE_HOME = Path(os.environ.get("FORGE_SYSTEM_DIR") or os.path.expanduser("~/job-hunting/job-hunting-system"))
DB_PATH = Path(os.environ.get("JOBS_DB") or FORGE_HOME / "jobs.db")

STATUS_ORDER = {"seen": 0, "matched": 1, "read": 2, "tailored": 3}


def _get_db() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    _ensure_schema(conn)
    return conn


def _ensure_schema(conn: sqlite3.Connection) -> None:
    conn.execute("""
        CREATE TABLE IF NOT EXISTS jobs (
            key         TEXT PRIMARY KEY,
            title       TEXT NOT NULL,
            company     TEXT NOT NULL,
            url         TEXT,
            score       REAL,
            status      TEXT NOT NULL DEFAULT 'seen',
            jd_json     TEXT,
            cv_path     TEXT,
            times_seen  INTEGER NOT NULL DEFAULT 1,
            first_run   TEXT,
            last_run    TEXT,
            user_status TEXT
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_jobs_last_run ON jobs(last_run)")


def _normalize(s: str) -> str:
    """Lowercase, strip punctuation, collapse whitespace."""
    import re
    s = s.lower().strip()
    s = re.sub(r"[^a-z0-9\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def make_key(listing: dict) -> str:
    """Generate a stable dedup key: Adzuna id if available, else normalized title|company."""
    listing_id = listing.get("id", "") or ""
    title = listing.get("title", "") or ""
    company = listing.get("company", "") or ""
    if listing_id and str(listing_id).isdigit():
        return f"id:{listing_id}"
    return f"j:{_normalize(title)}|{_normalize(company)}"


def _status_index(status: str) -> int:
    return STATUS_ORDER.get(status, -1)


def upsert_seen(listing: dict, run_id: str, score: float, status: str = "seen") -> bool:
    """
    Insert a job or bump times_seen / raise status.

    Returns True if this is a NEW job (first time seen), False if it was already known.
    """
    key = make_key(listing)
    title = (listing.get("title") or "")[:500]
    company = (listing.get("company") or "")[:300]
    url = (listing.get("redirect_url") or "")[:2000]

    conn = _get_db()
    try:
        existing = conn.execute("SELECT times_seen, status, first_run FROM jobs WHERE key=?", (key,)).fetchone()

        if existing:
            # Bump times_seen, update last_run, raise status only forward
            new_times = existing["times_seen"] + 1
            current_status = existing["status"]
            new_idx = _status_index(status)
            old_idx = _status_index(current_status)
            final_status = status if new_idx > old_idx else current_status

            conn.execute(
                """UPDATE jobs SET times_seen=?, last_run=?, status=?, score=?, url=?
                   WHERE key=?""",
                (new_times, run_id, final_status, score, url, key),
            )
            conn.commit()
            return False  # was already known
        else:
            conn.execute(
                """INSERT INTO jobs (key, title, company, url, score, status, times_seen, first_run, last_run)
                   VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)""",
                (key, title, company, url, score, status, run_id, run_id),
            )
            conn.commit()
            return True  # new job
    finally:
        conn.close()


def set_user_status(key: str, user_status: str) -> None:
    """Set a user-facing status note (promoted, dismissed, etc.)."""
    conn = _get_db()
    try:
        conn.execute("UPDATE jobs SET user_status=? WHERE key=?", (user_status, key))
        conn.commit()
    finally:
        conn.close()


def advance_status(key: str, new_status: str, jd_json: Optional[str] = None, cv_path: Optional[str] = None) -> None:
    """Advance job status (never downgrade). Optionally store JD JSON or CV path."""
    conn = _get_db()
    try:
        existing = conn.execute("SELECT status FROM jobs WHERE key=?", (key,)).fetchone()
        if not existing:
            return
        old_idx = _status_index(existing["status"])
        new_idx = _status_index(new_status)
        if new_idx <= old_idx:
            return  # never downgrade
        if jd_json is not None and cv_path is not None:
            conn.execute(
                "UPDATE jobs SET status=?, jd_json=?, cv_path=? WHERE key=?",
                (new_status, jd_json, cv_path, key),
            )
        elif jd_json is not None:
            conn.execute(
                "UPDATE jobs SET status=?, jd_json=? WHERE key=?",
                (new_status, jd_json, key),
            )
        elif cv_path is not None:
            conn.execute(
                "UPDATE jobs SET status=?, cv_path=? WHERE key=?",
                (new_status, cv_path, key),
            )
        else:
            conn.execute("UPDATE jobs SET status=? WHERE key=?", (new_status, key))
        conn.commit()
    finally:
        conn.close()


def tracking_map() -> dict[str, dict[str, Any]]:
    """Return all known jobs as {key: {title, company, status, url, score, ...}}."""
    conn = _get_db()
    try:
        rows = conn.execute(
            "SELECT key, title, company, url, score, status, times_seen, first_run, last_run, "
            "       COALESCE(jd_json, '') AS has_jd, COALESCE(cv_path, '') AS has_cv "
            "FROM jobs ORDER BY last_run DESC"
        ).fetchall()
        return {r["key"]: dict(r) for r in rows}
    finally:
        conn.close()


def summary() -> dict:
    """Return aggregate counts: total, new_this_run, seen, matched, read, tailored."""
    conn = _get_db()
    try:
        total = conn.execute("SELECT COUNT(*) FROM jobs").fetchone()[0]
        new_this_run = conn.execute(
            "SELECT COUNT(*) FROM jobs WHERE first_run = last_run"
        ).fetchone()[0]
        by_status = {}
        for r in conn.execute("SELECT status, COUNT(*) AS cnt FROM jobs GROUP BY status"):
            by_status[r["status"]] = r["cnt"]
        return {
            "total": total,
            "new_this_run": new_this_run,
            "by_status": by_status,
        }
    finally:
        conn.close()


# ── CLI ────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Job store operations")
    parser.add_argument("action", choices=["summary", "list", "stats"])
    parser.add_argument("--limit", type=int, default=20)
    args = parser.parse_args()

    if args.action == "summary":
        s = summary()
        print(f"Total: {s['total']}")
        print(f"New this run: {s['new_this_run']}")
        print(f"By status: {s['by_status']}")

    elif args.action == "list":
        conn = _get_db()
        rows = conn.execute(
            "SELECT key, title, company, score, status, times_seen, first_run, last_run "
            "FROM jobs ORDER BY last_run DESC LIMIT ?", (args.limit,)
        ).fetchall()
        for r in rows:
            print(f"  {r['score']:5.1f}  {r['status']:8s}  seen={r['times_seen']}  {r['title'][:50]} @ {r['company'][:30]}")
        conn.close()

    elif args.action == "stats":
        s = summary()
        import json
        print(json.dumps(s, indent=2))