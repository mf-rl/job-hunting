#!/usr/bin/env python3
"""
scheduled_find.py — Run a daily find scan and send a morning digest.

Digest sent via:
  1. Hermes Slack send (hermes send --to slack) — top ~8 new matches with links
  2. Email (SMTP + STARTTLS) — if DIGEST_EMAIL + EMAIL_* vars are set in .env

Keeps the last 12 output files in agents/scout/outputs/.
"""

from __future__ import annotations

import glob
import json
import os
import re
import smtplib
import subprocess
import sys
import time
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

FORGE_HOME = Path(os.environ.get("FORGE_SYSTEM_DIR") or os.path.expanduser("~/job-hunting/job-hunting-system"))
HERMES_HOME = Path(os.environ.get("HERMES_HOME") or os.path.expanduser("~/.hermes"))
VENV_PYTHON = HERMES_HOME / "hermes-agent" / "venv" / "bin" / "python3"
PIPELINE_DIR = FORGE_HOME / "pipeline"
OUTPUT_DIR_SCOUT = FORGE_HOME / "agents" / "scout" / "outputs"
OUTPUT_DIR_MATCHER = FORGE_HOME / "agents" / "matcher" / "outputs"

SCHEDULED_OUTPUT_DIR = FORGE_HOME / "agents" / "scheduled" / "outputs"
MAX_SCHEDULED_FILES = 12

# .env paths
MAIN_ENV = HERMES_HOME / ".env"
FORGE_ENV = FORGE_HOME / ".env"


def _load_env() -> dict:
    """Load key=value from .env files, later files override earlier ones."""
    env = {}
    for p in [MAIN_ENV, FORGE_ENV]:
        if p.exists():
            with open(p) as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    if "=" in line:
                        k, _, v = line.partition("=")
                        env[k.strip()] = v.strip()
    return env


def _newest_file(directory: Path, pattern: str) -> Path | None:
    if not directory.is_dir():
        return None
    files = sorted(directory.glob(pattern), key=lambda p: p.stat().st_mtime, reverse=True)
    return files[0] if files else None


def _count_before(run_id: str) -> int:
    """Count how many matched jobs existed in job store before this run."""
    db_path = FORGE_HOME / "jobs.db"
    if not db_path.exists():
        return 0
    import sqlite3
    conn = sqlite3.connect(str(db_path))
    try:
        return conn.execute("SELECT COUNT(*) FROM jobs").fetchone()[0]
    finally:
        conn.close()


def run_find_scan() -> tuple[str, int, int, int]:
    """Run scout_search + matcher_score. Returns (run_id, listings, matched, new_count)."""
    before = _count_before("")
    run_id = f"run_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

    # Scout search
    r = subprocess.run(
        [str(VENV_PYTHON), str(PIPELINE_DIR / "scout_search.py")],
        capture_output=True, text=True, timeout=600,
        env={**os.environ, "FORGE_SYSTEM_DIR": str(FORGE_HOME), "HERMES_HOME": str(HERMES_HOME)},
    )
    listings_count = 0
    for line in r.stdout.splitlines():
        m = re.search(r'"listings_returned":\s*(\d+)', line)
        if m:
            listings_count = int(m.group(1))

    # Matcher score + store
    listings_file = _newest_file(OUTPUT_DIR_SCOUT, "listings_*.json")
    if listings_file:
        profile_path = FORGE_HOME / "profile" / "profile.json"
        profile = json.loads(profile_path.read_text())
        threshold = profile.get("first_cut_threshold", 50)
        r2 = subprocess.run(
            [str(VENV_PYTHON), str(PIPELINE_DIR / "matcher_score.py"),
             str(listings_file), "--mode", "first_cut", "--threshold", str(threshold)],
            capture_output=True, text=True, timeout=120,
            env={**os.environ, "FORGE_SYSTEM_DIR": str(FORGE_HOME), "HERMES_HOME": str(HERMES_HOME)},
        )
        matched_count = 0
        for line in r2.stdout.splitlines():
            m = re.search(r"Results:\s*(\d+)/\d+\s+passed", line)
            if m:
                matched_count = int(m.group(1))

    after = _count_before("")
    new_count = after - before if after > before else 0
    return (run_id, listings_count, matched_count, new_count)


def get_new_matches(run_id: str, before_count: int) -> list[dict]:
    """Get the latest matches from the newest matcher output, marking which are new."""
    mfile = _newest_file(OUTPUT_DIR_MATCHER, "matches_*.json")
    if not mfile:
        return []
    data = json.loads(mfile.read_text())
    matches = data.get("matches", [])
    # The ones after before_count are new
    result = []
    for i, m in enumerate(matches):
        rank = i + 1
        listing = m.get("listing", {})
        result.append({
            "rank": rank,
            "score": round(m.get("score", 0), 1),
            "title": (listing.get("title") or "").strip(),
            "company": (listing.get("company") or "").strip(),
            "location": (listing.get("location") or {}).get("display_name", ""),
            "url": listing.get("redirect_url") or listing.get("url") or listing.get("link") or "",
            "source": listing.get("source", ""),
            "is_new": rank <= before_count,
        })
    return result


def send_slack_digest(new_jobs: list[dict], total_new: int, profile_name: str, env: dict):
    """Send a Slack digest via hermes send --to slack."""
    token = env.get("SLACK_BOT_TOKEN", "")
    channel = env.get("SLACK_HOME_CHANNEL", "")
    if not token or not channel:
        print("  [slack] SKIP: SLACK_BOT_TOKEN or SLACK_HOME_CHANNEL not set")
        return

    lines = [f"☀ *Good morning, {profile_name}!*"]
    if not new_jobs:
        lines.append("\nNo new jobs since your last scan.")
    else:
        n = min(len(new_jobs), 8)
        lines.append(f"\n*{total_new} new {'match' if total_new == 1 else 'matches'} found*")
        for job in new_jobs[:8]:
            score = f"({job['score']}%)"
            lines.append(f"\n{job['rank']}. *{job['title']}* — {job['company']} {score}")
            if job.get("url"):
                lines.append(f"   <{job['url']}|Open listing>")
        if len(new_jobs) > 8:
            remaining = len(new_jobs) - 8
            lines.append(f"\n…and {remaining} more")
    lines.append(f"\n<http://localhost:51764|Open FORGE Dashboard>")

    text = "\n".join(lines)

    # Use hermes send
    r = subprocess.run(
        [str(VENV_PYTHON), "-m", "hermes_cli.main", "send", "--to", "slack", "-m", text],
        capture_output=True, text=True, timeout=30,
        env={**os.environ, "HERMES_HOME": str(HERMES_HOME),
             "SLACK_BOT_TOKEN": token, "SLACK_HOME_CHANNEL": channel},
    )
    if r.returncode == 0:
        print(f"  [slack] digest sent ({len(new_jobs)} jobs)")
    else:
        print(f"  [slack] send failed: {r.stderr[:200]}")


def send_email_digest(new_jobs: list[dict], total_new: int, profile_name: str, env: dict):
    """Send an HTML email digest if DIGEST_EMAIL is configured."""
    to_email = env.get("DIGEST_EMAIL", "").strip()
    from_email = env.get("EMAIL_ADDRESS", "").strip()
    password = env.get("EMAIL_PASSWORD", "").strip()
    smtp_host = env.get("EMAIL_SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(env.get("EMAIL_SMTP_PORT", "587"))

    if not to_email or not from_email or not password:
        print("  [email] SKIP: DIGEST_EMAIL, EMAIL_ADDRESS, or EMAIL_PASSWORD not set")
        return

    subject = f"Forge — {total_new} new {'job' if total_new == 1 else 'jobs'} today"

    # Build HTML table
    rows_html = ""
    for job in new_jobs:
        status = "NEW" if job["is_new"] else "seen"
        link = f'<a href="{job["url"]}" style="color:#B8860B;text-decoration:none;">{job["title"]}</a>' if job.get("url") else job["title"]
        score_color = "#00C89C" if job["score"] >= 65 else "#EAC266"
        rows_html += f"""<tr>
          <td style="padding:8px 6px;border-bottom:1px solid #D0D5DD;font-size:13px;">{job['rank']}</td>
          <td style="padding:8px 6px;border-bottom:1px solid #D0D5DD;font-size:13px;">{link}</td>
          <td style="padding:8px 6px;border-bottom:1px solid #D0D5DD;font-size:13px;color:#5A5E6B;">{job['company']}</td>
          <td style="padding:8px 6px;border-bottom:1px solid #D0D5DD;font-size:13px;color:#5A5E6B;">{job['location']}</td>
          <td style="padding:8px 6px;border-bottom:1px solid #D0D5DD;font-size:13px;font-weight:700;color:{score_color};">{job['score']}%</td>
          <td style="padding:8px 6px;border-bottom:1px solid #D0D5DD;font-size:13px;">{'<span style="background:#00C89C;color:#fff;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:600;">NEW</span>' if job['is_new'] else 'seen'}</td>
          <td style="padding:8px 6px;border-bottom:1px solid #D0D5DD;font-size:13px;color:#5A5E6B;">{job['source']}</td>
        </tr>"""

    html = f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
  body {{ font-family: system-ui, sans-serif; background:#F0F2F5; padding:24px; }}
  .card {{ background:#fff; border-radius:16px; padding:24px; max-width:800px; margin:0 auto; }}
  h1 {{ font-size:22px; font-weight:800; color:#1A1D23; margin-bottom:4px; }}
  .sub {{ font-size:13px; color:#5A5E6B; margin-bottom:20px; }}
  table {{ width:100%; border-collapse:collapse; }}
  th {{ text-align:left; padding:8px 6px; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:1px; color:#8B8F9C; border-bottom:2px solid #D0D5DD; }}
  td {{ padding:8px 6px; border-bottom:1px solid #D0D5DD; font-size:13px; }}
  .footer {{ margin-top:20px; font-size:12px; color:#8B8F9C; text-align:center; }}
</style></head><body>
<div class="card">
  <h1>☀ Good morning, {profile_name}!</h1>
  <div class="sub">{total_new} new {'match' if total_new == 1 else 'matches'} found</div>
  <table><thead><tr><th>#</th><th>Job Title</th><th>Company</th><th>Location</th><th>Score</th><th>Status</th><th>Source</th></tr></thead>
  <tbody>{rows_html}</tbody></table>
  <div class="footer"><a href="http://localhost:51764" style="color:#B8860B;">Open FORGE Dashboard</a></div>
</div></body></html>"""

    plain = f"Forge — {total_new} new jobs today\n\n"
    for job in new_jobs[:10]:
        plain += f"{job['rank']}. {job['title']} @ {job['company']} ({job['score']}%) - {'NEW' if job['is_new'] else 'seen'}\n"
    plain += f"\nhttp://localhost:51764"

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = from_email
    msg["To"] = to_email
    msg.attach(MIMEText(plain, "plain"))
    msg.attach(MIMEText(html, "html"))

    try:
        server = smtplib.SMTP(smtp_host, smtp_port)
        server.starttls()
        server.login(from_email, password)
        server.sendmail(from_email, [to_email], msg.as_string())
        server.quit()
        print(f"  [email] digest sent to {to_email}")
    except Exception as e:
        print(f"  [email] send failed: {e}")


def rotate_outputs():
    """Keep only the last MAX_SCHEDULED_FILES scheduled output files."""
    SCHEDULED_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    files = sorted(glob.glob(str(SCHEDULED_OUTPUT_DIR / "digest_*.json")))
    while len(files) > MAX_SCHEDULED_FILES:
        os.remove(files[0])
        files = files[1:]


def main():
    env = _load_env()

    # Profile name
    profile_path = FORGE_HOME / "cv" / "base_cv.json"
    profile_name = "Mauricio"
    if profile_path.exists():
        try:
            data = json.loads(profile_path.read_text())
            profile_name = data.get("name", profile_name)
        except Exception:
            pass

    print(f"scheduled_find starting at {datetime.now().isoformat()}")
    print(f"  profile: {profile_name}")

    # Run scan
    print("  [scan] starting find...")
    run_id, listings_count, matched_count, new_count = run_find_scan()
    print(f"  [scan] {run_id}: {listings_count} listings, {matched_count} matched, ~{new_count} new")

    if new_count == 0:
        print("  [digest] no new jobs — skipping notification")
        # Still write a stub to keep the rotation
        SCHEDULED_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        stub = {"run_id": run_id, "new_jobs": 0, "sent_slack": False, "sent_email": False, "note": "no new jobs"}
        (SCHEDULED_OUTPUT_DIR / f"digest_{run_id}.json").write_text(json.dumps(stub, indent=2))
        rotate_outputs()
        return

    # Get matches
    all_matches = get_new_matches(run_id, 0)
    new_jobs = [m for m in all_matches if m["is_new"]]
    if not new_jobs:
        new_jobs = all_matches[:8]

    # Slack
    slack_sent = False
    try:
        send_slack_digest(new_jobs, len(new_jobs), profile_name, env)
        slack_sent = True
    except Exception as e:
        print(f"  [slack] error: {e}")

    # Email
    email_sent = False
    try:
        send_email_digest(new_jobs, len(new_jobs), profile_name, env)
        email_sent = True
    except Exception as e:
        print(f"  [email] error: {e}")

    # Write digest output
    SCHEDULED_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    digest = {
        "run_id": run_id,
        "new_jobs": len(new_jobs),
        "total_new": len(new_jobs),
        "listings_count": listings_count,
        "matched_count": matched_count,
        "sent_slack": slack_sent,
        "sent_email": email_sent,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    (SCHEDULED_OUTPUT_DIR / f"digest_{run_id}.json").write_text(json.dumps(digest, indent=2))

    rotate_outputs()
    print("  [done] digest complete")

    # Also update pipeline.db
    import sqlite3
    db_path = FORGE_HOME / "pipeline.db"
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path))
    conn.execute("""
        CREATE TABLE IF NOT EXISTS runs (
            id TEXT PRIMARY KEY, trigger TEXT, status TEXT,
            started_at TEXT, ended_at TEXT, summary TEXT
        )
    """)
    summary = json.dumps({"run_id": run_id, "listings_count": listings_count, "matched_count": matched_count})
    ts = datetime.now(timezone.utc).isoformat()
    conn.execute(
        "INSERT INTO runs (id, trigger, status, started_at, ended_at, summary) VALUES (?, ?, 'completed', ?, ?, ?)",
        (run_id, "scheduled", ts, ts, summary),
    )
    conn.commit()
    conn.close()


if __name__ == "__main__":
    main()