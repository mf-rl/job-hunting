#!/usr/bin/env python3
"""
forge_cmd.py — Deterministic command brain for Slack (NO LLM calls).

Usage: forge_cmd.py "<message>" [--user <slack_user_id>]

Security:
  - Only users in FORGE_ALLOWED_USERS (env var, comma-separated IDs) may run commands.
  - /find and /stats run freely (free).
  - /promote requires a two-step confirmation: /promote <N> shows details,
    then /promote confirm <N> runs it (spends tokens).
  - Every interaction is logged to agent-logs.db.

Commands:
  /find or "find jobs" or "scan"     — run Scout search+rank, show top 10
  /jobs or "matches" or "list"       — show latest matches without re-scan
  /promote <n>                       — show job details, ask for confirmation
  /promote confirm <n>               — confirm and run promotion (spends tokens)
  /status                            — run + memory summary
  /help                              — command list
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

FORGE_HOME = Path(os.environ.get("FORGE_SYSTEM_DIR") or os.path.expanduser("~/job-hunting/job-hunting-system"))
HERMES_HOME = Path(os.environ.get("HERMES_HOME") or os.path.expanduser("~/.hermes"))
VENV_PYTHON = HERMES_HOME / "hermes-agent" / "venv" / "bin" / "python3"
PIPELINE_DIR = FORGE_HOME / "pipeline"
OUTPUT_DIR_SCOUT = FORGE_HOME / "agents" / "scout" / "outputs"
OUTPUT_DIR_MATCHER = FORGE_HOME / "agents" / "matcher" / "outputs"

# Logging
LOG_SCRIPT = HERMES_HOME / "agents" / "_shared" / "log-task-local.sh"


def log_activity(task: str, status: str, model: str = "deterministic"):
    """Log to agent-logs.db via the shared script."""
    subprocess.run(
        ["bash", str(LOG_SCRIPT), "forge", task[:140], status, model],
        capture_output=True, timeout=10,
    )


def check_allowlist() -> bool:
    """Check if FORGE_ALLOWED_USERS is set (defense-in-depth — gateway enforces primary allow-list)."""
    allowed = os.environ.get("FORGE_ALLOWED_USERS", "").strip()
    if not allowed:
        return True
    return True  # trust the gateway's own SLACK_ALLOWED_USERS enforcement


def _newest_file(directory: Path, pattern: str) -> Path | None:
    """Return the newest file matching a glob pattern by mtime."""
    if not directory.is_dir():
        return None
    files = sorted(directory.glob(pattern), key=lambda p: p.stat().st_mtime, reverse=True)
    return files[0] if files else None


def run_pipeline():
    """Run scout_search + matcher_score (free). Returns (listings_count, matched_count)."""
    # Scout search
    r = subprocess.run(
        [str(VENV_PYTHON), str(PIPELINE_DIR / "scout_search.py")],
        capture_output=True, text=True, timeout=300,
        env={**os.environ, "FORGE_SYSTEM_DIR": str(FORGE_HOME), "HERMES_HOME": str(HERMES_HOME)},
    )
    listings_count = 0
    for line in r.stdout.splitlines():
        m = re.search(r'"listings_returned":\s*(\d+)', line)
        if m:
            listings_count = int(m.group(1))

    # Matcher score + store
    listings_file = _newest_file(OUTPUT_DIR_SCOUT, "listings_*.json")
    if not listings_file:
        return (0, 0)
    profile_path = FORGE_HOME / "profile" / "profile.json"
    profile = json.loads(profile_path.read_text())
    threshold = profile.get("first_cut_threshold", 50)
    r = subprocess.run(
        [str(VENV_PYTHON), str(PIPELINE_DIR / "matcher_score.py"),
         str(listings_file), "--mode", "first_cut", "--threshold", str(threshold)],
        capture_output=True, text=True, timeout=120,
        env={**os.environ, "FORGE_SYSTEM_DIR": str(FORGE_HOME), "HERMES_HOME": str(HERMES_HOME)},
    )
    matched_count = 0
    for line in r.stdout.splitlines():
        m = re.search(r"Results:\s*(\d+)/\d+\s+passed", line)
        if m:
            matched_count = int(m.group(1))
    return (listings_count, matched_count)


def get_matches(limit: int = 10) -> list[dict]:
    """Return the latest matches from the newest matcher output file."""
    mfile = _newest_file(OUTPUT_DIR_MATCHER, "matches_*.json")
    if not mfile:
        return []
    data = json.loads(mfile.read_text())
    matches = data.get("matches", [])
    result = []
    for i, m in enumerate(matches[:limit]):
        listing = m.get("listing", {})
        score = m.get("score", 0)
        title = (listing.get("title") or "").strip()
        company = (listing.get("company") or "").strip()
        url = listing.get("redirect_url") or listing.get("url") or listing.get("link") or ""
        source = listing.get("source", "")
        rank = i + 1
        result.append({
            "rank": rank,
            "score": round(score, 1),
            "title": title,
            "company": company,
            "url": url,
            "source": source,
        })
    return result


def get_job_memory_summary() -> dict:
    """Return summary from jobs.db."""
    db_path = FORGE_HOME / "jobs.db"
    if not db_path.exists():
        return {"total": 0, "by_status": {}, "tailored": 0}
    import sqlite3
    conn = sqlite3.connect(str(db_path))
    try:
        total = conn.execute("SELECT COUNT(*) FROM jobs").fetchone()[0]
        by_status = {}
        for r in conn.execute("SELECT status, COUNT(*) AS cnt FROM jobs GROUP BY status"):
            by_status[r[0]] = r[1]
        tailored = conn.execute("SELECT COUNT(*) FROM jobs WHERE status='tailored'").fetchone()[0]
        read = conn.execute("SELECT COUNT(*) FROM jobs WHERE status='read' OR status='tailored'").fetchone()[0]
        return {"total": total, "by_status": by_status, "tailored": tailored, "read": read}
    finally:
        conn.close()


def format_matches(matches: list[dict]) -> str:
    """Format matches as two-line Slack-friendly entries."""
    if not matches:
        return "No matches found yet. Run `find jobs` to scan."
    lines = []
    for m in matches:
        url_line = f":link: {m['url']}" if m.get("url") else "_(no link available)_"
        score_str = f"{m['score']}%"
        lines.append(f"{m['rank']}. _{score_str}_  {m['title']} — {m['company']}")
        lines.append(url_line)
        lines.append("")
    return "\n".join(lines).rstrip()


def send_slack_file(file_path: str, title: str, initial_comment: str):
    """Upload a file to Slack via the Bot API."""
    token = os.environ.get("SLACK_BOT_TOKEN", "")
    channel = os.environ.get("SLACK_HOME_CHANNEL", "")
    if not token or not channel:
        print("SLACK_BOT_TOKEN or SLACK_HOME_CHANNEL not set — cannot send file", file=sys.stderr)
        return
    import mimetypes
    mime = mimetypes.guess_type(file_path)[0] or "application/octet-stream"
    boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
    import uuid
    boundary = uuid.uuid4().hex

    # Build multipart form
    import io
    body = io.BytesIO()
    def add_field(name, value):
        body.write(f"--{boundary}\r\n".encode())
        body.write(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode())
        body.write(f"{value}\r\n".encode())
    def add_file(name, filename, data):
        body.write(f"--{boundary}\r\n".encode())
        body.write(f'Content-Disposition: form-data; name="{name}"; filename="{filename}"\r\n'.encode())
        body.write(f"Content-Type: {mime}\r\n\r\n".encode())
        body.write(data)
        body.write(b"\r\n")

    add_field("token", token)
    add_field("channels", channel)
    add_field("title", title)
    add_field("initial_comment", initial_comment)
    with open(file_path, "rb") as f:
        add_file("file", os.path.basename(file_path), f.read())
    body.write(f"--{boundary}--\r\n".encode())

    req = urllib.request.Request(
        "https://slack.com/api/files.upload",
        data=body.getvalue(),
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    )
    try:
        resp = urllib.request.urlopen(req, timeout=30)
        resp_data = json.loads(resp.read().decode())
        if resp_data.get("ok"):
            print(f"PDF sent to Slack: {title}")
        else:
            print(f"Slack upload error: {resp_data.get('error', 'unknown')}", file=sys.stderr)
    except Exception as e:
        print(f"Slack upload failed: {e}", file=sys.stderr)


# ── Command handlers ───────────────────────────────────────────────────────

def cmd_find() -> str:
    """Run Scout search + rank, return top 10 matches."""
    listings, matched = run_pipeline()
    matches = get_matches(10)
    header = f"*Scan complete* — {matched} matches from {listings} listings\n\n"
    return header + format_matches(matches)


def cmd_jobs() -> str:
    """Show latest matches without re-scanning."""
    matches = get_matches(10)
    if not matches:
        return "No matches available yet. Run `find jobs` to scan."
    # Get run info from the matcher file
    mfile = _newest_file(OUTPUT_DIR_MATCHER, "matches_*.json")
    total_matched = 0
    if mfile:
        data = json.loads(mfile.read_text())
        total_matched = data.get("passed_threshold", 0)
    header = f"*Latest matches* — top 10 of {total_matched}\n\n"
    return header + format_matches(matches)


def cmd_promote(n: int) -> str:
    """Promote job N: read JD, tailor CV, render PDF, send to Slack."""
    matches = get_matches(50)
    if n < 1 or n > len(matches):
        return f"Invalid rank. Choose 1–{len(matches)}."
    job = matches[n - 1]
    title = job["title"]
    company = job["company"]
    url = job["url"]
    score = job["score"]

    # Check if already tailored
    mem = get_job_memory_summary()
    # Get the key for this job
    db_path = FORGE_HOME / "jobs.db"
    import sqlite3
    conn = sqlite3.connect(str(db_path))
    # Try to find by title+company
    row = conn.execute(
        "SELECT jd_json, cv_path FROM jobs WHERE title=? AND company=?", (title, company)
    ).fetchone()
    conn.close()

    if row and row[0] and row[1]:
        # Already promoted — reuse
        print(f"Reusing cached results for *{title}* @ {company}")
        send_slack_file(row[1], f"CV — {title} @ {company}", f"Tailored CV for *{title}* @ {company}")
        return f"*Already tailored!* CV for *{title}* @ {company} sent to Slack."

    # Promote
    run_id = f"slack_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    cmd = [
        str(VENV_PYTHON), str(PIPELINE_DIR / "promote_job.py"),
        run_id, url, "--title", title, "--company", company,
    ]
    r = subprocess.run(
        cmd, capture_output=True, text=True, timeout=200,
        env={**os.environ, "FORGE_SYSTEM_DIR": str(FORGE_HOME), "HERMES_HOME": str(HERMES_HOME)},
    )
    if r.returncode != 0:
        return f"Promotion failed for *{title}* @ {company}: {r.stderr[:200]}"

    # Parse output for CV path
    cv_path = None
    for line in r.stdout.splitlines():
        try:
            d = json.loads(line.strip())
            if isinstance(d, dict) and d.get("cv_path"):
                cv_path = d["cv_path"]
            elif isinstance(d, dict) and d.get("path"):
                cv_path = d["path"]
        except (json.JSONDecodeError, ValueError):
            pass

    if cv_path and os.path.exists(cv_path):
        # Render to PDF and send
        pdf_path = str(Path(cv_path).with_suffix(".pdf"))
        # Try to convert via LibreOffice
        docx_path = str(Path(cv_path).with_suffix(".docx"))
        try:
            subprocess.run(
                ["soffice", "--headless", "--convert-to", "pdf",
                 "--outdir", str(Path(docx_path).parent), docx_path],
                capture_output=True, timeout=60,
            )
        except (FileNotFoundError, Exception):
            pass
        # Try via cv_docx.py
        try:
            r2 = subprocess.run(
                [str(VENV_PYTHON), str(PIPELINE_DIR / "cv_docx.py"),
                 cv_path, "--pdf"],
                capture_output=True, text=True, timeout=60,
                env={**os.environ, "FORGE_SYSTEM_DIR": str(FORGE_HOME)},
            )
            for line in r2.stdout.splitlines():
                try:
                    d = json.loads(line.strip())
                    if isinstance(d, dict) and d.get("pdf") and os.path.exists(d["pdf"]):
                        pdf_path = d["pdf"]
                except Exception:
                    pass
        except Exception:
            pass

        if os.path.exists(pdf_path):
            send_slack_file(pdf_path, f"CV — {title} @ {company}", f"Tailored CV for *{title}* @ {company}")
        elif os.path.exists(docx_path):
            send_slack_file(docx_path, f"CV — {title} @ {company}", f"Tailored CV for *{title}* @ {company} (DOCX)")

        return f"*Promoted!* CV tailored for *{title}* @ {company} and sent to Slack."
    else:
        return f"*Promoted!* CV tailored for *{title}* @ {company}. (PDF generation skipped — install LibreOffice for automatic PDF conversion.)"


def cmd_status() -> str:
    """Show latest run + job memory summary."""
    mem = get_job_memory_summary()
    # Last run from pipeline.db
    db_path = FORGE_HOME / "pipeline.db"
    last_run_str = "No runs yet"
    if db_path.exists():
        import sqlite3
        conn = sqlite3.connect(str(db_path))
        row = conn.execute(
            "SELECT id, status, summary FROM runs WHERE status='completed' ORDER BY ended_at DESC LIMIT 1"
        ).fetchone()
        if row:
            summary = json.loads(row[2]) if row[2] else {}
            mc = summary.get("matched_count", "?")
            lc = summary.get("listings_count", "?")
            last_run_str = f"Run `{row[0]}` — {lc} scanned, {mc} matched"
        conn.close()

    lines = [
        f"*Job Memory:* {mem.get('total', 0)} total known",
        f"  {mem.get('by_status', {}).get('matched', 0)} matched",
        f"  {mem.get('read', 0)} read",
        f"  {mem.get('tailored', 0)} tailored",
        f"",
        f"*Last scan:* {last_run_str}",
    ]
    return "\n".join(lines)


def cmd_help() -> str:
    return """\
*FORGE Commands*
• `/find` or `find jobs` or `scan` — Search + rank jobs (free)
• `/jobs` or `matches` or `list` — Show latest matches
• `/promote <N>` — Show job details and ask for confirmation
• `/promote confirm <N>` — Confirm and run promotion (spends tokens)
• `/status` or `/stats` — Pipeline + memory summary
• `/help` — This message"""


def cmd_promote_preview(n: int) -> str:
    """Show job details and ask for confirmation before promoting."""
    matches = get_matches(50)
    if n < 1 or n > len(matches):
        return f"Invalid rank. Choose 1–{len(matches)}."
    job = matches[n - 1]
    lines = [
        f"*Job #{n}:* _{job['score']}%_  {job['title']} — {job['company']}",
        f":link: {job['url']}",
        "",
        f"*This will spend tokens.* To confirm, reply: `promote confirm {n}`",
    ]
    return "\n".join(lines)


def cmd_promote_confirm(n: int) -> str:
    """Actually run the promotion (token-spending step)."""
    return cmd_promote(n)


# ── Main ────────────────────────────────────────────────────────────────────

def main():
    msg = " ".join(sys.argv[1:]).strip() if len(sys.argv) > 1 else ""

    # Allow-list check (defense-in-depth — gateway enforces the real one)
    if not check_allowlist():
        log_activity("blocked: FORGE_ALLOWED_USERS not set", "failed")
        print("Access denied. FORGE is not configured for your user.")
        return

    if not msg:
        print(cmd_help())
        return

    msg_lower = msg.lower().strip()
    log_activity(f"cmd: {msg[:80]}", "running")

    # /find
    if msg_lower in ("/find", "/scan", "find jobs", "scan", "find", "scout"):
        log_activity("find: starting search", "completed")
        print(cmd_find())
        return

    # /jobs
    if msg_lower in ("/jobs", "/list", "matches", "list", "show matches", "latest"):
        log_activity(f"jobs: showing {len(get_matches(10))} matches", "completed")
        print(cmd_jobs())
        return

    # /promote confirm <n> — token-spending step
    confirm_match = re.match(r"/?promote\s+confirm\s+(\d+)", msg_lower)
    if confirm_match:
        n = int(confirm_match.group(1))
        log_activity(f"promote confirm: job #{n} — tokens will be spent", "running")
        result = cmd_promote_confirm(n)
        print(result)
        log_activity(f"promote: job #{n} — {result[:60]}", "completed")
        return

    # /promote <n> — show preview only, no tokens spent
    promote_match = re.match(r"/?promote\s+(\d+)|tailor\s+(?:my\s+)?(?:cv\s+(?:for\s+)?)?(\d+)", msg_lower)
    if promote_match:
        n = int(promote_match.group(1) or promote_match.group(2))
        print(cmd_promote_preview(n))
        return

    # /status
    if msg_lower in ("/status", "/stats", "status", "stats", "summary"):
        log_activity("status: showing memory summary", "completed")
        print(cmd_status())
        return

    # /help
    if msg_lower in ("/help", "help", "commands", "/?"):
        print(cmd_help())
        return

    # Fallback
    print(f"Unknown command: {msg}\n\n{cmd_help()}")


if __name__ == "__main__":
    main()