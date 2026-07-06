"""
Forge Dashboard — FastAPI backend
Bound to 127.0.0.1:51764 (never 0.0.0.0).
Serves real JSON from agent-logs.db, jobs.db, and pipeline.db.
"""

from __future__ import annotations

import json
import os
import sqlite3
import uuid
import hashlib
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from fastapi.responses import FileResponse

from fastapi import FastAPI, HTTPException, Query, Request, UploadFile, File
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="Forge Dashboard", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Paths ──────────────────────────────────────────────────────────────────

HERMES_HOME = Path(os.environ.get("HERMES_HOME") or os.path.expanduser("~/.hermes"))
FORGE_SYSTEM_DIR = Path(os.environ.get("FORGE_SYSTEM_DIR") or os.path.expanduser("~/job-hunting/job-hunting-system"))
DASHBOARD_DIR = Path(os.environ.get("FORGE_DASHBOARD_DIR") or os.path.expanduser("~/job-hunting/job-hunting-dashboard"))
AGENT_LOG_DB = Path(os.environ.get("AGENT_LOG_DB") or HERMES_HOME / "agent-logs.db")
JOBS_DB = Path(os.environ.get("JOBS_DB") or FORGE_SYSTEM_DIR / "jobs.db")
PIPELINE_DB = Path(os.environ.get("PIPELINE_DB") or FORGE_SYSTEM_DIR / "pipeline.db")


# ── DB helpers ──────────────────────────────────────────────────────────────

def _get_db(path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(str(path))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def _rows_to_list(cursor) -> list[dict]:
    return [dict(r) for r in cursor.fetchall()]


def _norm_key_field(s: str) -> str:
    """Mirror job_store._normalize: lowercase, strip punctuation, collapse whitespace."""
    import re as _re
    s = s.lower().strip()
    s = _re.sub(r"[^a-z0-9\s]", " ", s)
    s = _re.sub(r"\s+", " ", s).strip()
    return s


def _make_job_key(listing: dict) -> str:
    """Generate a job key identical to job_store.make_key."""
    lid = str(listing.get("id", "") or "")
    if lid.isdigit():
        return f"id:{lid}"
    title = listing.get("title", "") or ""
    company = listing.get("company", "") or ""
    return f"j:{_norm_key_field(title)}|{_norm_key_field(company)}"


def _load_hermes_env() -> dict:
    """Load KEY=VALUE pairs from ~/.hermes/.env (same logic as scout_search.py)."""
    env_path = HERMES_HOME / ".env"
    result: dict = {}
    if env_path.exists():
        try:
            for line in env_path.read_text().splitlines():
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    k, _, v = line.partition("=")
                    result[k.strip()] = v.strip()
        except Exception:
            pass
    return result


def _get_hermes_model() -> str:
    """Read the active model from ~/.hermes/config.yaml."""
    config_path = HERMES_HOME / "config.yaml"
    try:
        text = config_path.read_text()
        # Simple line scan — avoid pulling in PyYAML as a hard dependency
        in_model_block = False
        for line in text.splitlines():
            stripped = line.strip()
            if stripped == "model:":
                in_model_block = True
                continue
            if in_model_block:
                if stripped.startswith("default:"):
                    return stripped.split(":", 1)[1].strip()
                if stripped and not stripped.startswith("#") and ":" in stripped and not line.startswith(" "):
                    in_model_block = False  # left the model block
    except Exception:
        pass
    return "unknown"


# ── Middleware: Cache-Control headers ───────────────────────────────────────

@app.middleware("http")
async def add_no_cache_header(request: Request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    return response


# ── Health ──────────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "forge-dashboard", "version": "1.0.0"}


# ── Overview ────────────────────────────────────────────────────────────────

@app.get("/api/overview")
async def overview():
    """Aggregate counts from agent-logs, jobs, and pipeline."""
    result = {
        "total_agents": 4,
        "agent_names": ["forge", "scout", "job-reader", "cv-adapter"],
        "total_logged_actions": 0,
        "total_jobs_seen": 0,
        "total_pipeline_runs": 0,
        "last_activity": None,
        "last_scan": None,
        "active_model": _get_hermes_model(),
    }

    # agent-logs count
    try:
        db = _get_db(AGENT_LOG_DB)
        row = db.execute("SELECT COUNT(*) AS cnt, MAX(created_at) AS last FROM agent_logs").fetchone()
        result["total_logged_actions"] = row["cnt"]
        result["last_activity"] = row["last"]
        db.close()
    except Exception:
        pass

    # jobs count
    try:
        db = _get_db(JOBS_DB)
        row = db.execute("SELECT COUNT(*) AS cnt, MAX(created_at) AS last FROM jobs").fetchone()
        result["total_jobs_seen"] = row["cnt"]
        result["last_scan"] = row["last"]
        db.close()
    except Exception:
        pass

    # pipeline runs count + live/last run info
    result["live_run"] = None
    result["last_run"] = None
    try:
        db = _get_db(PIPELINE_DB)
        row = db.execute("SELECT COUNT(*) AS cnt, MAX(started_at) AS last FROM runs").fetchone()
        result["total_pipeline_runs"] = row["cnt"]
        if row["last"] and (result["last_activity"] is None or row["last"] > result["last_activity"]):
            result["last_activity"] = row["last"]

        # Check if a run is currently active
        live = db.execute("SELECT id, trigger FROM runs WHERE status='running' ORDER BY started_at DESC LIMIT 1").fetchone()
        if live:
            result["live_run"] = {"id": live["id"], "trigger": live["trigger"]}

        # Last completed run
        last = db.execute("SELECT id, trigger, summary FROM runs WHERE status='completed' ORDER BY ended_at DESC LIMIT 1").fetchone()
        if last:
            summary = None
            try:
                import json
                summary = json.loads(last["summary"]) if last["summary"] else None
            except Exception:
                pass
            result["last_run"] = {"id": last["id"], "trigger": last["trigger"], "summary": summary}

        db.close()
    except Exception:
        pass

    return result


# ── Agents ──────────────────────────────────────────────────────────────────

@app.get("/api/agents")
async def agents():
    """Return each agent's latest activity and total logged actions."""
    from collections import defaultdict

    agents_map = {
        "forge": {"name": "Forge", "role": "Coordinator", "last_active": None, "total_actions": 0, "last_status": None},
        "scout": {"name": "Scout", "role": "Job Search & Ranking", "last_active": None, "total_actions": 0, "last_status": None},
        "job-reader": {"name": "Job Reader", "role": "JD Extraction", "last_active": None, "total_actions": 0, "last_status": None},
        "cv-adapter": {"name": "CV Adapter", "role": "CV Tailoring", "last_active": None, "total_actions": 0, "last_status": None},
    }

    try:
        db = _get_db(AGENT_LOG_DB)
        rows = db.execute(
            "SELECT agent_name, COUNT(*) AS cnt, MAX(created_at) AS last "
            "FROM agent_logs GROUP BY agent_name"
        ).fetchall()
        for r in rows:
            key = r["agent_name"]
            if key in agents_map:
                agents_map[key]["total_actions"] = r["cnt"]
                agents_map[key]["last_active"] = r["last"]

        # Get latest status per agent
        for key in agents_map:
            row = db.execute(
                "SELECT status FROM agent_logs WHERE agent_name=? ORDER BY created_at DESC LIMIT 1",
                (key,),
            ).fetchone()
            if row:
                agents_map[key]["last_status"] = row["status"]
        db.close()
    except Exception:
        pass

    return {"agents": list(agents_map.values())}


# ── Activity ────────────────────────────────────────────────────────────────

@app.get("/api/activity")
async def activity(
    limit: int = Query(50, ge=1, le=500),
    agent: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
):
    """Recent activity log entries with optional filters."""
    try:
        db = _get_db(AGENT_LOG_DB)
        where = []
        params = []
        if agent:
            where.append("agent_name=?")
            params.append(agent)
        if status:
            where.append("status=?")
            params.append(status)
        where_clause = ("WHERE " + " AND ".join(where)) if where else ""
        cursor = db.execute(
            f"SELECT id, agent_name, task_description, status, model_used, created_at "
            f"FROM agent_logs {where_clause} ORDER BY created_at DESC LIMIT ?",
            params + [limit],
        )
        entries = _rows_to_list(cursor)
        db.close()
        return {"entries": entries, "count": len(entries)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Telemetry ───────────────────────────────────────────────────────────────

@app.get("/api/telemetry")
async def telemetry():
    """Aggregated stats: actions per agent, per day, status breakdown."""
    result = {
        "per_agent": {},
        "per_day": {},
        "status_breakdown": {"completed": 0, "failed": 0, "other": 0},
        "total_actions": 0,
        "date_range": {"earliest": None, "latest": None},
    }

    try:
        db = _get_db(AGENT_LOG_DB)

        # Per agent
        for r in db.execute("SELECT agent_name, COUNT(*) AS cnt FROM agent_logs GROUP BY agent_name"):
            result["per_agent"][r["agent_name"]] = r["cnt"]

        # Per day
        for r in db.execute(
            "SELECT DATE(created_at) AS day, COUNT(*) AS cnt FROM agent_logs GROUP BY day ORDER BY day"
        ):
            result["per_day"][r["day"]] = r["cnt"]

        # Status breakdown
        for r in db.execute("SELECT status, COUNT(*) AS cnt FROM agent_logs GROUP BY status"):
            key = r["status"] if r["status"] in ("completed", "failed") else "other"
            result["status_breakdown"][key] = r["cnt"]

        # Total
        row = db.execute("SELECT COUNT(*) AS cnt FROM agent_logs").fetchone()
        result["total_actions"] = row["cnt"]

        # Date range
        row = db.execute("SELECT MIN(created_at) AS ear, MAX(created_at) AS lat FROM agent_logs").fetchone()
        result["date_range"] = {"earliest": row["ear"], "latest": row["lat"]}

        db.close()
    except Exception:
        pass

    return result


# ── Pipeline ────────────────────────────────────────────────────────────────

@app.get("/api/pipeline")
async def pipeline():
    """Recent pipeline runs — reads from pipeline.db if it exists, else placeholder."""
    try:
        db = _get_db(PIPELINE_DB)
        rows = db.execute(
            "SELECT id, run_type, status, jobs_scanned, matches_found, "
            "promoted_job_id, started_at, completed_at, duration_seconds, error "
            "FROM pipeline_runs ORDER BY created_at DESC LIMIT 20"
        ).fetchall()
        db.close()
        return {"runs": _rows_to_list(rows), "count": len(rows)}
    except Exception:
        return {"runs": [], "count": 0, "note": "pipeline.db not yet created — no pipeline runs recorded."}


# ── Run Detail ──────────────────────────────────────────────────────────────

@app.get("/api/run-detail")
async def run_detail(run_id: Optional[str] = Query(None)):
    """Details for the most recent pipeline run with match rows and counts."""
    result = {
        "run_id": None,
        "status": None,
        "found": 0,
        "matched": 0,
        "read": 0,
        "cvs": 0,
        "matches": [],
        "memory": {"known": 0, "read": 0, "tailored": 0},
    }

    # Get the newest matches file by modification time
    matcher_dir = FORGE_SYSTEM_DIR / "agents" / "matcher" / "outputs"
    if matcher_dir.is_dir():
        match_files = sorted(matcher_dir.glob("matches_*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
        if match_files:
            try:
                data = json.loads(match_files[0].read_text())

                result["run_id"] = data.get("run_id")
                result["found"] = data.get("total_listings", 0)
                result["matched"] = data.get("passed_threshold", 0)

                # Build match rows with job store info
                rows = []
                for i, m in enumerate(data.get("matches", [])):
                    listing = m.get("listing", {})
                    score = m.get("score", 0)
                    breakdown = m.get("breakdown", {})
                    flags = m.get("flags", {})
                    key = _make_job_key(listing)

                    # Look up job store for this match (key now matches job_store format)
                    cv_path = None
                    try:
                        db_jobs = _get_db(JOBS_DB)
                        job_row = db_jobs.execute(
                            "SELECT cv_path FROM jobs WHERE key=?", (key,)
                        ).fetchone()
                        if job_row:
                            cv_path = job_row["cv_path"]
                        db_jobs.close()
                    except Exception:
                        pass

                    row_url   = listing.get("redirect_url", "")
                    row_title = listing.get("title", "")
                    row_co    = listing.get("company", "")

                    # Check whether this job is currently being promoted
                    # Use MD5 hash to avoid OS filename-too-long errors
                    _raw_flag_key = f"{row_url}|{row_title}|{row_co}"
                    _flag_key  = hashlib.md5(_raw_flag_key.encode()).hexdigest()
                    _flag_file = PROMOTE_FLAG_DIR / f"{_flag_key}.flag"
                    promoting = False
                    try:
                        if _flag_file.exists():
                            if cv_path:
                                # Tailoring done — clean up flag
                                try: _flag_file.unlink()
                                except Exception: pass
                            else:
                                import time as _time
                                age_min = (_time.time() - _flag_file.stat().st_mtime) / 60
                                if age_min > 10:
                                    # Stale: pipeline max ~6 min; process ended without saving
                                    try: _flag_file.unlink()
                                    except Exception: pass
                                else:
                                    promoting = True
                    except Exception:
                        pass  # filename edge-case: treat as not promoting

                    rows.append({
                        "rank": i + 1,
                        "score": score,
                        "title": row_title,
                        "company": row_co,
                        "location": listing.get("location", {}).get("display_name", ""),
                        "url": row_url,
                        "description": listing.get("description", ""),
                        "new": flags.get("new", True),
                        "times_seen": 1,
                        "key": key,
                        "cv_path": cv_path or "",
                        "promoting": promoting,
                        "tracking": {
                            "breakdown": breakdown,
                            "flags": flags,
                            "source": listing.get("source", ""),
                        },
                    })
                result["matches"] = rows  # no cap — pagination in the frontend handles display

                # Persist matches to jobs.db so JD button and status tracking work
                if rows:
                    try:
                        db_persist = _get_db(JOBS_DB)
                        for row_data in rows:
                            if not row_data.get("key"):
                                continue
                            jd_data = {
                                "full_job_title": row_data["title"],
                                "company_name": row_data["company"],
                                "location": row_data["location"],
                                "description": row_data["description"],
                            }
                            jd_json_str = json.dumps(jd_data)
                            existing = db_persist.execute(
                                "SELECT jd_json FROM jobs WHERE key=?", (row_data["key"],)
                            ).fetchone()
                            if existing is None:
                                # Insert using only columns that exist in the real jobs.db schema
                                db_persist.execute(
                                    "INSERT OR IGNORE INTO jobs "
                                    "(key, title, company, url, score, jd_json, status) "
                                    "VALUES (?, ?, ?, ?, ?, ?, 'new')",
                                    (
                                        row_data["key"], row_data["title"], row_data["company"],
                                        row_data["url"], row_data["score"], jd_json_str,
                                    ),
                                )
                            elif not existing["jd_json"]:
                                db_persist.execute(
                                    "UPDATE jobs SET jd_json=? WHERE key=?",
                                    (jd_json_str, row_data["key"]),
                                )
                        db_persist.commit()
                        db_persist.close()
                    except Exception:
                        pass

            except Exception:
                pass

    # Get memory summary from jobs.db
    try:
        db = _get_db(JOBS_DB)
        row = db.execute("SELECT COUNT(*) AS k FROM jobs").fetchone()
        result["memory"]["known"] = row["k"]
        row = db.execute("SELECT COUNT(*) AS r FROM jobs WHERE status='read' OR status='tailored'").fetchone()
        result["memory"]["read"] = row["r"]
        row = db.execute("SELECT COUNT(*) AS t FROM jobs WHERE status='tailored'").fetchone()
        result["memory"]["tailored"] = row["t"]
        db.close()
    except Exception:
        pass

    return result


# ── Results ─────────────────────────────────────────────────────────────────

@app.get("/api/results")
async def results():
    """All job results from jobs.db, if it exists."""
    try:
        db = _get_db(JOBS_DB)
        rows = db.execute(
            "SELECT id, title, company, source, url, score, status, "
            "created_at, promoted_at FROM jobs ORDER BY created_at DESC LIMIT 100"
        ).fetchall()
        db.close()
        return {"results": _rows_to_list(rows), "count": len(rows)}
    except Exception:
        return {"results": [], "count": 0, "note": "jobs.db not yet created — no jobs have been searched."}


# ── POST /api/run — trigger pipeline ──────────────────────────────────────

@app.post("/api/run")
async def trigger_run(trigger: str = "find"):
    """Trigger a pipeline run in the background."""
    if trigger != "find":
        raise HTTPException(status_code=400, detail=f"Unknown trigger: {trigger}")

    # Check if a run is already running
    if RUN_FLAG.exists():
        raise HTTPException(status_code=409, detail="A pipeline run is already in progress")

    RUN_FLAG.write_text("running")
    import subprocess, sys
    venv_python = Path(sys.executable)
    pipeline_script = FORGE_SYSTEM_DIR / "pipeline" / "run_pipeline.py"
    env = os.environ.copy()
    subprocess.Popen(
        [str(venv_python), str(pipeline_script), "--find-only"],
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    # Clean up the run flag after the process starts (the script manages its own status)
    # Actually keep the flag; the script removes it on completion

    return {"status": "accepted", "trigger": trigger, "note": "Pipeline run started"}


# ── POST /api/promote — promote one job (spends tokens) ──────────────────

PROMOTE_FLAG_DIR = FORGE_SYSTEM_DIR / "pipeline" / ".promoting"

@app.post("/api/promote")
async def promote_job(request: Request):
    """Promote a specific job: read JD → tailor CV → store."""
    body = await request.json()
    run_id = body.get("run_id", "")
    url = body.get("url", "")
    title = body.get("title", "")
    company = body.get("company", "")
    description = body.get("description", "")
    score = body.get("score", 0)

    if not url:
        raise HTTPException(status_code=400, detail="url is required")

    if not title or not company:
        raise HTTPException(status_code=400, detail="title and company are required")

    # Accept the pre-computed job-store key from the dashboard (avoids key-format mismatch)
    key_from_dash = body.get("key", "")

    # Flag file: use MD5 of url|title|company to avoid filename-too-long errors
    _raw_flag_key = f"{url}|{title}|{company}"
    key = hashlib.md5(_raw_flag_key.encode()).hexdigest()
    flag_file = PROMOTE_FLAG_DIR / f"{key}.flag"
    PROMOTE_FLAG_DIR.mkdir(parents=True, exist_ok=True)

    if flag_file.exists():
        raise HTTPException(status_code=409, detail="This job is already being promoted")

    flag_file.write_text("promoting")
    import subprocess, sys
    venv_python = Path(sys.executable)
    promote_script = FORGE_SYSTEM_DIR / "pipeline" / "promote_job.py"

    args = [str(venv_python), str(promote_script), run_id, url,
            "--title", title, "--company", company]
    if description:
        args += ["--description", description]
    if score:
        args += ["--score", str(score)]
    if key_from_dash:
        args += ["--job-key", key_from_dash]

    env = os.environ.copy()
    subprocess.Popen(args, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    return {"status": "accepted", "key": key, "note": "Promotion started"}


# ── Design Template Upload & Serve ─────────────────────────────────────────

DESIGN_DIR = DASHBOARD_DIR / "design"

@app.post("/api/design-template")
async def upload_design_template(file: UploadFile = File(...)):
    """Accept .html or image uploads; save the main template as forge-template.html."""
    DESIGN_DIR.mkdir(parents=True, exist_ok=True)
    filename = file.filename or "upload"
    ext = Path(filename).suffix.lower()

    if ext not in (".html", ".htm", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"):
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}. Accept .html and image files.")

    # If it's an HTML file, save as forge-template.html (the canonical template)
    if ext in (".html", ".htm"):
        save_path = DESIGN_DIR / "forge-template.html"
    else:
        save_path = DESIGN_DIR / filename

    content = await file.read()
    save_path.write_bytes(content)

    return {
        "status": "saved",
        "filename": filename,
        "saved_as": str(save_path.relative_to(DASHBOARD_DIR)),
        "absolute_path": str(save_path.resolve()),
        "size_bytes": len(content),
    }


@app.get("/template")
async def serve_template():
    """Serve the canonical design template (forge-template.html)."""
    template_path = DESIGN_DIR / "forge-template.html"
    if not template_path.exists():
        raise HTTPException(status_code=404, detail="No design template uploaded yet. POST to /api/design-template first.")
    from fastapi.responses import HTMLResponse
    return HTMLResponse(content=template_path.read_text(), status_code=200)


# ── CV Upload & Status ─────────────────────────────────────────────────────

CV_DIR = FORGE_SYSTEM_DIR / "cv"
PROFILE_DIR = FORGE_SYSTEM_DIR / "profile"
BUILD_FLAG = CV_DIR / ".cv-building"
PIPELINE_DB = Path(os.environ.get("PIPELINE_DB") or FORGE_SYSTEM_DIR / "pipeline.db")
RUN_FLAG = FORGE_SYSTEM_DIR / "pipeline" / ".run-running"
CV_ADAPTER_OUTPUTS = FORGE_SYSTEM_DIR / "agents" / "cv-adapter" / "outputs"


@app.get("/api/cv")
async def cv_status():
    """Return building status, existing base_cv.json, and profile.json."""
    building = BUILD_FLAG.exists()
    result = {"building": building}

    # Base CV
    cv_json = CV_DIR / "base_cv.json"
    if cv_json.exists():
        try:
            result["base_cv"] = json.loads(cv_json.read_text())
        except Exception:
            result["base_cv"] = None
    else:
        result["base_cv"] = None

    # Raw filename
    for f in CV_DIR.iterdir():
        if f.name.startswith("base_cv_raw.") and f.is_file():
            result["raw_filename"] = f.name
            break

    # Profile
    profile_json = PROFILE_DIR / "profile.json"
    if profile_json.exists():
        try:
            result["profile"] = json.loads(profile_json.read_text())
        except Exception:
            result["profile"] = None
    else:
        result["profile"] = None

    return result


@app.post("/api/cv")
async def upload_cv(file: UploadFile = File(...)):
    """Accept CV upload, save raw file, kick off build in background."""
    CV_DIR.mkdir(parents=True, exist_ok=True)
    (CV_DIR / "history").mkdir(parents=True, exist_ok=True)
    PROFILE_DIR.mkdir(parents=True, exist_ok=True)

    ext = Path(file.filename or "upload.pdf").suffix.lower()
    if ext not in (".pdf", ".docx", ".md", ".txt"):
        raise HTTPException(status_code=400, detail="Unsupported file type. Accepted: .pdf .docx .md .txt")

    raw_path = CV_DIR / f"base_cv_raw{ext}"

    # Archive any previous raw file
    if raw_path.exists():
        import shutil, datetime
        ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        archive_name = f"base_cv_raw_{ts}{ext}"
        shutil.copy2(str(raw_path), str(CV_DIR / "history" / archive_name))

    # Save new raw upload
    content = await file.read()
    raw_path.write_bytes(content)

    # Drop building flag
    BUILD_FLAG.write_text("building")

    # Launch build pipeline in background
    import subprocess, sys
    venv_python = Path(sys.executable)
    pipeline_script = FORGE_SYSTEM_DIR / "pipeline" / "build_base_cv.py"
    env = os.environ.copy()
    subprocess.Popen(
        [str(venv_python), str(pipeline_script)],
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    return {"status": "accepted", "building": True, "filename": file.filename, "size_bytes": len(content)}


# ── Job Status & JD endpoints ──────────────────────────────────────────────

@app.post("/api/job-status")
async def set_job_status(request: Request):
    """Persist a user-set status for a specific job key."""
    body = await request.json()
    key = body.get("key", "")
    status = body.get("status", "")
    if not key or not status:
        raise HTTPException(status_code=400, detail="key and status are required")
    from job_store import set_user_status
    sys.path.insert(0, str(FORGE_SYSTEM_DIR / "pipeline"))
    try:
        exec("from job_store import set_user_status")
        set_user_status(key, status)
    except Exception:
        # Fallback direct db update
        db = _get_db(JOBS_DB)
        db.execute("UPDATE jobs SET user_status=? WHERE key=?", (status, key))
        db.commit()
        db.close()
    return {"status": "ok", "key": key, "user_status": status}


@app.get("/api/jd")
async def get_jd(key: str = Query("")):
    """Return the stored JD JSON for a job key.

    Priority:
      1. jobs.db  jd_json column  (populated by job-reader or by run-detail persistence)
      2. Latest matches_*.json file  (always present after a --find-only scan)
    """
    if not key:
        raise HTTPException(status_code=400, detail="key is required")

    # ── 1. Try jobs.db ────────────────────────────────────────────────────
    try:
        db = _get_db(JOBS_DB)
        row = db.execute(
            "SELECT jd_json FROM jobs WHERE key=? OR key=?",
            (key, f"j:{key.lower().replace(' ','')}")
        ).fetchone()
        db.close()
        if row and row["jd_json"]:
            try:
                jd = json.loads(row["jd_json"])
                return {"key": key, "jd": jd}
            except Exception:
                return {"key": key, "jd_raw": row["jd_json"]}
    except Exception:
        pass

    # ── 2. Fall back to the latest matches file ───────────────────────────
    matcher_dir = FORGE_SYSTEM_DIR / "agents" / "matcher" / "outputs"
    if matcher_dir.is_dir():
        match_files = sorted(
            matcher_dir.glob("matches_*.json"),
            key=lambda p: p.stat().st_mtime,
            reverse=True,
        )
        for mf in match_files[:3]:  # check the 3 most-recent scans
            try:
                mf_data = json.loads(mf.read_text())
                for m in mf_data.get("matches", []):
                    listing = m.get("listing", {})
                    listing_key = listing.get("id", "") or \
                        f"{listing.get('title', '')}|{listing.get('company', '')}"
                    if listing_key == key:
                        desc = listing.get("description", "")
                        if desc:
                            return {
                                "key": key,
                                "jd": {
                                    "full_job_title": listing.get("title", ""),
                                    "company_name": listing.get("company", ""),
                                    "location": listing.get("location", {}).get("display_name", ""),
                                    "description": desc,
                                },
                            }
            except Exception:
                continue

    raise HTTPException(status_code=404, detail="No JD found for this job")


# ── Schedule API ───────────────────────────────────────────────────────────

SCHEDULE_FILE = FORGE_SYSTEM_DIR / "pipeline" / ".schedule"
CADENCES = {"2h": "*-*-* 00/2:00:00", "4h": "*-*-* 00/4:00:00",
            "6h": "*-*-* 00/6:00:00", "8h": "*-*-* 00/8:00:00",
            "12h": "*-*-* 00/12:00:00", "daily": "*-*-* 09:00:00"}


@app.get("/api/schedule")
async def get_schedule():
    """Return current auto-scan status and next scheduled run."""
    enabled = SCHEDULE_FILE.exists()
    cadence = "daily"
    next_run = None
    if enabled:
        try:
            data = json.loads(SCHEDULE_FILE.read_text())
            cadence = data.get("cadence", "daily")
            next_run = data.get("next_run")
        except Exception:
            pass
    return {"enabled": enabled, "cadence": cadence, "next_run": next_run}


@app.post("/api/schedule")
async def set_schedule(request: Request):
    """Enable/disable the auto-scan timer and set cadence."""
    body = await request.json()
    enabled = body.get("enabled", False)
    cadence = body.get("cadence", "daily")

    if cadence not in CADENCES:
        raise HTTPException(status_code=400, detail=f"Invalid cadence. Choose: {list(CADENCES.keys())}")

    if enabled:
        # Compute next run time (approximate)
        import datetime as dt
        now = dt.datetime.now()
        if cadence == "daily":
            next_dt = now.replace(hour=9, minute=0, second=0, microsecond=0)
            if next_dt <= now:
                next_dt += dt.timedelta(days=1)
        else:
            hours = {"2h": 2, "4h": 4, "6h": 6, "8h": 8, "12h": 12}.get(cadence, 24)
            # Anchor to midnight + cycle
            midnight = now.replace(hour=0, minute=0, second=0, microsecond=0)
            slots = (now - midnight).total_seconds() / 3600
            next_slot = ((int(slots) // hours) + 1) * hours
            next_dt = midnight + dt.timedelta(hours=next_slot)

        data = {"cadence": cadence, "next_run": next_dt.isoformat()}
        SCHEDULE_FILE.parent.mkdir(parents=True, exist_ok=True)
        SCHEDULE_FILE.write_text(json.dumps(data))
        return {"enabled": True, "cadence": cadence, "next_run": next_dt.isoformat()}
    else:
        if SCHEDULE_FILE.exists():
            SCHEDULE_FILE.unlink()
        return {"enabled": False, "cadence": cadence, "next_run": None}


# ── Settings API ────────────────────────────────────────────────────────────

VALID_SENIORITIES = {"junior", "mid", "senior", "lead", "principal", "manager", "any"}
ADZUNA_COUNTRIES = {
    "United States": "us", "Spain": "es", "United Kingdom": "gb", "Germany": "de",
    "France": "fr", "Canada": "ca", "Australia": "au", "Brazil": "br",
    "India": "in", "Netherlands": "nl", "Italy": "it", "Switzerland": "ch",
    "Austria": "at", "Belgium": "be", "Poland": "pl", "South Africa": "za",
    "Singapore": "sg", "Hong Kong": "hk", "Ireland": "ie", "New Zealand": "nz",
    "Sweden": "se", "United Arab Emirates": "ae", "Saudi Arabia": "sa",
    "Mexico": "mx", "Argentina": "ar", "Chile": "cl", "Colombia": "co",
}


def load_profile() -> dict:
    p = PROFILE_DIR / "profile.json"
    if p.exists():
        return json.loads(p.read_text())
    return {}


@app.get("/api/settings")
async def get_settings():
    """Return current settings from profile.json + system status."""
    profile = load_profile()
    # Convert country codes back to display names
    country_codes = [c.strip() for c in profile.get("country", "us").split(",") if c.strip()]
    country_names = []
    for code in country_codes:
        name = next((n for n, c in ADZUNA_COUNTRIES.items() if c == code), None)
        if name:
            country_names.append(name)

    hermes_env = _load_hermes_env()
    adzuna_has_key = bool(
        os.environ.get("ADZUNA_APP_ID") or hermes_env.get("ADZUNA_APP_ID")
    )
    return {
        "profile": profile,
        "country_display": country_names,
        "system": {
            "model": _get_hermes_model(),
            "gateway": "connected",
            "slack": "connected",
            "adzuna_has_key": adzuna_has_key,
            "remotive_available": True,
            "remoteok_available": True,
            "weworkremotely_available": True,
            "jobicy_available": True,
        }
    }


@app.post("/api/settings")
async def save_settings(request: Request):
    """Save settings with validation. Clamp numbers, reject invalid choices."""
    body = await request.json()
    profile = load_profile()
    errors = []

    # Seniority
    seniority = body.get("seniority", profile.get("seniority", "senior"))
    if seniority not in VALID_SENIORITIES:
        raise HTTPException(status_code=400, detail=f"Invalid seniority: {seniority}. Must be one of {sorted(VALID_SENIORITIES)}")
    profile["seniority"] = seniority

    # Target titles (chips)
    titles = body.get("target_titles")
    if titles is not None:
        if not isinstance(titles, list):
            raise HTTPException(status_code=400, detail="target_titles must be a list")
        profile["target_titles"] = [str(t).strip() for t in titles if str(t).strip()]

    # Scoring skills (chips)
    skills = body.get("scoring_skills")
    if skills is not None:
        if not isinstance(skills, list):
            raise HTTPException(status_code=400, detail="scoring_skills must be a list")
        profile["scoring_skills"] = [str(s).strip() for s in skills if str(s).strip()]

    # Search keywords (chips)
    queries = body.get("search_queries")
    if queries is not None:
        if not isinstance(queries, list):
            raise HTTPException(status_code=400, detail="search_queries must be a list")
        profile["search_queries"] = [str(q).strip() for q in queries if str(q).strip()]

    # Country (dropdown of full names → codes)
    country_names = body.get("country")
    if country_names is not None:
        if not isinstance(country_names, list) or not country_names:
            raise HTTPException(status_code=400, detail="At least one country must be selected")
        codes = []
        for name in country_names:
            code = ADZUNA_COUNTRIES.get(name)
            if not code:
                raise HTTPException(status_code=400, detail=f"Unknown country: {name}")
            codes.append(code)
        profile["country"] = ",".join(codes)

    # Numeric fields: clamp to limits
    clamps = {
        "first_cut_threshold": (0, 100, 50),
        "final_threshold": (0, 100, 65),
        "pages": (1, 5, 2),
        "max_days_old": (1, 365, 120),
        "results_per_run": (10, 300, 60),
    }
    for field, (lo, hi, default) in clamps.items():
        val = body.get(field)
        if val is not None:
            try:
                val = int(val)
                clamped = max(lo, min(hi, val))
                profile[field] = clamped
                if clamped != val:
                    errors.append(f"{field} clamped to {clamped} (was {val}, range {lo}-{hi})")
            except (TypeError, ValueError):
                profile[field] = default

    # Validate final ≥ first_cut
    fc = profile.get("first_cut_threshold", 50)
    fn = profile.get("final_threshold", 65)
    if fn < fc:
        raise HTTPException(status_code=400, detail=f"Final threshold ({fn}) must be ≥ first-cut ({fc})")

    # Job sources
    sources = body.get("sources")
    if sources is not None:
        if isinstance(sources, dict):
            if not any(sources.values()):
                raise HTTPException(status_code=400, detail="At least one job source must be enabled")
            profile["sources"] = sources

    # Atomic write: temp file → replace
    tmp = PROFILE_DIR / "profile.json.tmp"
    tmp.write_text(json.dumps(profile, indent=2))
    tmp.replace(PROFILE_DIR / "profile.json")

    return {"status": "ok", "errors": errors, "profile": profile}


# ── CV Download (docx / pdf) — with path traversal protection ──────────────

def _safe_resolve(path_str: str) -> Path | None:
    """Resolve a path relative to CV_ADAPTER_OUTPUTS, rejecting traversal."""
    if not path_str or ".." in path_str or path_str.startswith("/"):
        return None
    resolved = (CV_ADAPTER_OUTPUTS / path_str).resolve()
    # Must be inside CV_ADAPTER_OUTPUTS
    try:
        resolved.relative_to(CV_ADAPTER_OUTPUTS.resolve())
        if resolved.exists() and resolved.is_file():
            return resolved
    except ValueError:
        pass
    return None


@app.get("/api/cv-docx")
async def cv_docx(path: str = Query("")):
    """Download a tailored CV as .docx, validating path stays inside outputs dir."""
    safe = _safe_resolve(path)
    if not safe:
        raise HTTPException(status_code=400, detail="Invalid or non-existent path (traversal rejected)")

    # Generate .docx if the JSON exists but the .docx doesn't
    if safe.suffix == ".json":
        docx_path = safe.with_suffix(".docx")
    else:
        docx_path = safe

    if not docx_path.exists():
        # Run cv_docx.py to generate it
        import subprocess, sys
        venv_python = Path(sys.executable)
        cv_docx_script = FORGE_SYSTEM_DIR / "pipeline" / "cv_docx.py"
        subprocess.run(
            [str(venv_python), str(cv_docx_script), str(safe), "--output", str(docx_path)],
            capture_output=True, timeout=30,
        )

    if not docx_path.exists():
        raise HTTPException(status_code=500, detail="Could not generate .docx")

    return FileResponse(
        path=str(docx_path),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=docx_path.name,
    )


@app.get("/api/cv-pdf")
async def cv_pdf(path: str = Query("")):
    """Download a tailored CV as PDF, validating path stays inside outputs dir."""
    safe = _safe_resolve(path)
    if not safe:
        raise HTTPException(status_code=400, detail="Invalid or non-existent path (traversal rejected)")

    # Resolve the JSON source path and target PDF path
    json_path = safe if safe.suffix == ".json" else safe.with_suffix(".json")
    pdf_path  = safe.with_suffix(".pdf")

    if not pdf_path.exists():
        import subprocess, sys
        venv_python = Path(sys.executable)
        cv_pdf_script = FORGE_SYSTEM_DIR / "pipeline" / "cv_pdf.py"
        r = subprocess.run(
            [str(venv_python), str(cv_pdf_script), str(json_path), "--output", str(pdf_path)],
            capture_output=True, text=True, timeout=30,
        )
        if r.returncode != 0:
            raise HTTPException(status_code=500,
                                detail=f"PDF generation failed: {r.stderr[:300] or r.stdout[:300]}")

    if not pdf_path.exists():
        raise HTTPException(status_code=500, detail="Could not generate PDF")

    return FileResponse(
        path=str(pdf_path),
        media_type="application/pdf",
        filename=pdf_path.name,
    )


# ── Custom Jobs ──────────────────────────────────────────────────────────────

CUSTOM_JOBS_DB = Path(os.environ.get("CUSTOM_JOBS_DB") or FORGE_SYSTEM_DIR / "custom_jobs.db")
CUSTOM_PROMOTE_FLAG_DIR = FORGE_SYSTEM_DIR / "pipeline" / ".custom_promoting"


def _ensure_custom_jobs_schema(conn: sqlite3.Connection) -> None:
    conn.execute("""
        CREATE TABLE IF NOT EXISTS custom_jobs (
            key         TEXT PRIMARY KEY,
            title       TEXT NOT NULL,
            company     TEXT NOT NULL,
            url         TEXT,
            score       REAL DEFAULT 0,
            status      TEXT NOT NULL DEFAULT 'seen',
            jd_json     TEXT,
            cv_path     TEXT,
            location    TEXT,
            remote_mode TEXT,
            salary      TEXT,
            date_posted TEXT,
            created_at  TEXT DEFAULT (datetime('now')),
            user_status TEXT
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_cj_status ON custom_jobs(status)")
    conn.commit()


def _get_custom_db() -> sqlite3.Connection:
    CUSTOM_JOBS_DB.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(CUSTOM_JOBS_DB))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    _ensure_custom_jobs_schema(conn)
    return conn


@app.post("/api/custom/parse-url")
async def custom_parse_url(request: Request):
    """Fetch a job posting URL and extract structured details via job_reader."""
    body = await request.json()
    url = (body.get("url") or "").strip()
    if not url or not url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="A valid http(s) URL is required")

    import subprocess, sys as _sys
    venv_python = Path(_sys.executable)
    reader_script = FORGE_SYSTEM_DIR / "pipeline" / "job_reader.py"
    env = os.environ.copy()

    try:
        r = subprocess.run(
            [str(venv_python), str(reader_script), url],
            capture_output=True, text=True, timeout=180,
            env={**env, "FORGE_SYSTEM_DIR": str(FORGE_SYSTEM_DIR), "HERMES_HOME": str(HERMES_HOME)},
        )
        output = r.stdout.strip()
        if not output:
            # Surface the real error from stderr (LLM failure reason, rate limit, etc.)
            stderr_lines = [l for l in (r.stderr or "").splitlines()
                            if l.strip() and not l.startswith("Trying LinkedIn")]
            detail = "\n".join(stderr_lines).strip()[:400] or "No output from job_reader"
            raise HTTPException(status_code=422, detail=detail)

        data = json.loads(output)
        if "error" in data:
            raise HTTPException(status_code=422, detail=data["error"])

        extracted = data.get("extracted", {})
        return {
            "url": url,
            "title": extracted.get("full_job_title", ""),
            "company": extracted.get("company_name", ""),
            "location": extracted.get("location", ""),
            "remote_mode": extracted.get("work_mode", ""),
            "salary": extracted.get("salary", ""),
            "date_posted": extracted.get("date_posted", ""),
            "description": data.get("full_text_preview", ""),
            "extracted": extracted,
            "jd_json": json.dumps(data),
        }
    except HTTPException:
        raise
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=422, detail=f"Invalid JSON from job_reader: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/custom/promote")
async def custom_promote(request: Request):
    """Tailor CV for a custom job URL. Saves result to custom_jobs.db."""
    body = await request.json()
    url = body.get("url", "")
    title = body.get("title", "")
    company = body.get("company", "")
    jd_json_str = body.get("jd_json", "")
    location = body.get("location", "")
    remote_mode = body.get("remote_mode", "")
    salary = body.get("salary", "")
    date_posted = body.get("date_posted", "")

    if not url or not title or not company:
        raise HTTPException(status_code=400, detail="url, title and company are required")

    key = "custom:" + hashlib.md5(url.encode()).hexdigest()[:16]

    # Upsert into custom_jobs.db
    db = _get_custom_db()
    existing = db.execute("SELECT cv_path, status FROM custom_jobs WHERE key=?", (key,)).fetchone()
    if existing and existing["cv_path"]:
        db.close()
        raise HTTPException(status_code=409, detail="Already tailored — use the existing DOC/PDF buttons")
    if not existing:
        db.execute(
            "INSERT INTO custom_jobs "
            "(key, title, company, url, status, jd_json, location, remote_mode, salary, date_posted)"
            " VALUES (?,?,?,?,'seen',?,?,?,?,?)",
            (key, title, company, url, jd_json_str, location, remote_mode, salary, date_posted),
        )
        db.commit()
    db.close()

    # Prevent duplicate concurrent promotes
    flag_key = hashlib.md5(f"custom:{url}".encode()).hexdigest()
    flag_file = CUSTOM_PROMOTE_FLAG_DIR / f"{flag_key}.flag"
    CUSTOM_PROMOTE_FLAG_DIR.mkdir(parents=True, exist_ok=True)
    if flag_file.exists():
        raise HTTPException(status_code=409, detail="Already being promoted — please wait")
    flag_file.write_text("promoting")

    import subprocess, sys as _sys
    venv_python = Path(_sys.executable)
    promote_script = FORGE_SYSTEM_DIR / "pipeline" / "promote_custom_job.py"

    cmd = [
        str(venv_python), str(promote_script),
        url,
        "--title", title,
        "--company", company,
        "--key", key,
        "--db-path", str(CUSTOM_JOBS_DB),
    ]
    if jd_json_str:
        cmd += ["--jd-json", jd_json_str]

    env = os.environ.copy()
    subprocess.Popen(cmd, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return {"status": "accepted", "key": key}


@app.get("/api/custom/jobs")
async def custom_jobs_list():
    """List all custom-tailored jobs."""
    try:
        db = _get_custom_db()
        rows = db.execute(
            "SELECT key, title, company, url, status, cv_path, location, remote_mode, "
            "salary, date_posted, created_at FROM custom_jobs ORDER BY created_at DESC"
        ).fetchall()
        db.close()
        return {"jobs": _rows_to_list(rows)}
    except Exception as e:
        return {"jobs": [], "error": str(e)}


@app.get("/api/custom/status")
async def custom_job_status(key: str = Query("")):
    """Poll the tailoring status of a custom job."""
    if not key:
        raise HTTPException(status_code=400, detail="key is required")
    db = _get_custom_db()
    row = db.execute(
        "SELECT key, title, company, url, status, cv_path FROM custom_jobs WHERE key=?",
        (key,),
    ).fetchone()
    db.close()
    if not row:
        raise HTTPException(status_code=404, detail="Custom job not found")

    result = dict(row)

    # Check flag file for in-progress promote
    flag_key = hashlib.md5(f"custom:{row['url']}".encode()).hexdigest()
    flag_file = CUSTOM_PROMOTE_FLAG_DIR / f"{flag_key}.flag"
    promoting = False
    if flag_file.exists():
        if row["cv_path"]:
            try:
                flag_file.unlink()
            except Exception:
                pass
        else:
            import time as _time
            age_min = (_time.time() - flag_file.stat().st_mtime) / 60
            if age_min > 10:
                try:
                    flag_file.unlink()
                except Exception:
                    pass
            else:
                promoting = True

    result["promoting"] = promoting
    return result


# ── Serve index.html from templates ────────────────────────────────────────

@app.get("/")
async def index():
    return RedirectResponse(url="/index.html")


@app.get("/{path:path}")
async def serve_static_or_404(path: str):
    """Serve static files from the dashboard directory, else 404."""
    file_path = DASHBOARD_DIR / path
    if file_path.exists() and file_path.is_file():
        from fastapi.responses import FileResponse
        return FileResponse(str(file_path))
    if file_path.suffix == "":
        # Try with .html extension
        html_path = file_path.with_suffix(".html")
        if html_path.exists():
            from fastapi.responses import FileResponse
            return FileResponse(str(html_path))
    raise HTTPException(status_code=404, detail="Not found")


# ── Entry point ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=51764, log_level="info")