#!/usr/bin/env python3
"""
cv_adapter.py — Given a job description + base CV, rewrite headline, summary,
and experience bullets strictly from facts in the base CV. Save tailored JSON.

Usage: cv_adapter.py <jd_json> <base_cv_json> <output_path>
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

FORGE_HOME = Path(os.environ.get("FORGE_SYSTEM_DIR") or os.path.expanduser("~/job-hunting/job-hunting-system"))
HERMES_HOME = Path(os.environ.get("HERMES_HOME") or os.path.expanduser("~/.hermes"))
VENV_PYTHON = HERMES_HOME / "hermes-agent" / "venv" / "bin" / "python3"
OUTPUT_DIR = FORGE_HOME / "agents" / "cv-adapter" / "outputs"
LOG_SCRIPT = HERMES_HOME / "agents" / "_shared" / "log-task-local.sh"


def _read_active_model(profile: str = "") -> str:
    """Read the current model from hermes config, with profile taking priority over global."""
    paths = []
    if profile:
        paths.append(HERMES_HOME / "profiles" / profile / "config.yaml")
    paths.append(HERMES_HOME / "config.yaml")
    for p in paths:
        try:
            in_model = False
            for line in p.read_text().splitlines():
                s = line.strip()
                if s == "model:":
                    in_model = True
                elif in_model:
                    if s.startswith("default:"):
                        return s.split(":", 1)[1].strip()
                    if s and not s.startswith("#") and ":" in s and not line.startswith(" "):
                        in_model = False
        except Exception:
            pass
    return "unknown"


def log_activity(agent: str, task: str, status: str, model: str = ""):
    if not model:
        model = _read_active_model(profile=agent)
    import subprocess as sp
    sp.run(["bash", str(LOG_SCRIPT), agent, task, status, model], capture_output=True, timeout=10)


def _extract_json_from_llm(text: str) -> dict | None:
    """
    Extract the outermost JSON object from LLM output.

    Handles three output formats the Hermes agent may produce:
      1. Plain JSON (possibly with preamble/postamble text)
      2. Markdown-fenced JSON  (```json ... ```)
      3. Git-diff format  (@@ hunks where added lines are prefixed with '+')
    Uses brace-depth counting instead of a greedy regex so truncated or
    multi-object outputs don't silently corrupt the result.
    """
    if not text:
        return None

    # ── unwrap git-diff format ──────────────────────────────────────────
    if re.search(r'^@@', text, re.MULTILINE):
        added: list[str] = []
        in_hunk = False
        for line in text.splitlines():
            if re.match(r'^@@', line):
                in_hunk = True
                continue
            if not in_hunk:
                continue
            if line.startswith('+'):
                added.append(line[1:])
            elif line.startswith(' '):
                added.append(line[1:])
            # skip '-' (removed) lines
        text = '\n'.join(added)

    # ── strip markdown code fences ──────────────────────────────────────
    text = re.sub(r'^```[a-z]*\s*', '', text.strip())
    text = re.sub(r'\s*```\s*$', '', text.strip())
    text = text.strip()

    # ── find and parse the outermost { … } via brace-depth counting ─────
    start = text.find('{')
    if start == -1:
        return None
    depth = 0
    for i, ch in enumerate(text[start:], start=start):
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(text[start:i + 1])
                except json.JSONDecodeError as exc:
                    print(f"JSON decode error at pos {exc.pos}: {exc.msg}", file=sys.stderr)
                    return None
    return None


def tailor_cv(base_cv: dict, jd_extracted: dict) -> dict | None:
    """Call CV Adapter LLM to rewrite headline, summary, and experience bullets.
    Retries once on parse failure (the agent sometimes returns a git-diff on the
    first attempt but plain JSON on the second).
    """
    jd_title = jd_extracted.get("full_job_title", "the role")
    jd_company = jd_extracted.get("company_name", "the company")
    jd_reqs = jd_extracted.get("required_skills", [])
    jd_resp = jd_extracted.get("responsibilities", [])

    base_json_str = json.dumps(base_cv, indent=2)

    prompt = (
        "You are CV Adapter, the CV specialist. Your job is to produce a HEAVILY TAILORED CV "
        "that feels custom-written for the target role. The output MUST differ significantly from the base CV "
        "in wording, emphasis, and keyword coverage — while staying 100% truthful to the original facts.\n\n"
        "INSTRUCTIONS (follow every one):\n"
        "1. Headline — REWRITE completely. Lead with the target job's key domain, "
        "then list 4-6 technologies or skills from the base CV that match the job requirements. "
        "Use the target job's terminology. Example: if target is 'Senior .NET Developer', "
        "headline should lead with '.NET' and list matching tech.\n\n"
        "2. Summary — REWRITE completely (2-4 sentences). "
        "Lead with your years of experience and the target role. "
        "Highlight the MOST relevant experience from the base CV that matches the job requirements. "
        "Mention specific technologies and skills from the job description that you actually have. "
        "Reference industry domains mentioned in the job that match your background. "
        "This must read like a custom pitch, not a generic bio.\n\n"
        "3. Experience bullets — REWRITE EVERY bullet for EVERY position. "
        "For each position: keep the company, role, and dates EXACTLY as in the base CV. "
        "But rewrite every bullet to emphasize accomplishments most relevant to the target job. "
        "INTEGRATE keywords from the job's required skills and responsibilities into the bullets "
        "(only where the base CV supports them — NEVER fabricate). "
        "Reorder bullets so the most relevant ones come first. "
        "If a position has no relevant accomplishments, add truthful context about technologies used "
        "that match the job requirements (from the base CV).\n\n"
        "4. Skills section — If the job description lists specific technologies/skills that exist "
        "in your base skills, move them to the front of their respective groups. "
        "Do NOT add new skills not in the base CV.\n\n"
        "CRITICAL RULES:\n"
        "- NEVER invent experience, employers, dates, degrees, or skills not in the base CV\n"
        "- NEVER change company names, job titles, or employment dates\n"
        "- DO significantly reword, restructure, and re-prioritize to match the target role\n"
        "- The output should feel like a custom CV written FOR this specific job, not the original generic CV\n"
        "- Use the job's terminology and keywords wherever the base CV supports it\n\n"
        f"TARGET JOB: {jd_title} @ {jd_company}\n"
        f"Required Skills: {', '.join(jd_reqs[:10])}\n"
        f"Key Responsibilities: {'. '.join(jd_resp[:6])}\n\n"
        f"BASE CV JSON:\n{base_json_str}\n\n"
        "Return the COMPLETE CV JSON with headline, summary, and experience bullets rewritten. "
        "Keep all other fields (name, contact, education, skills, languages, competencies) EXACTLY as they are. "
        "Return ONLY the JSON object, no other text."
    )

    env = {**os.environ, "HERMES_HOME": str(HERMES_HOME)}
    cmd = [str(VENV_PYTHON), "-m", "hermes_cli.main", "chat",
           "-p", "cv-adapter", "-q", prompt, "--yolo", "-Q"]

    for attempt in range(1, 3):  # up to 2 attempts
        try:
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=240, env=env)
            if r.returncode != 0:
                print(f"CV Adapter attempt {attempt}: non-zero exit ({r.returncode}): {r.stderr[:300]}",
                      file=sys.stderr)
                continue

            raw = r.stdout.strip()
            lines = [l for l in raw.splitlines() if not l.startswith("session_id:")]
            text = "\n".join(lines).strip()

            tailored = _extract_json_from_llm(text)
            if tailored is None:
                print(f"CV Adapter attempt {attempt}: no valid JSON found. "
                      f"Output preview: {text[:200]!r}", file=sys.stderr)
                continue

            if not tailored.get("name") or not tailored.get("experience"):
                print(f"CV Adapter attempt {attempt}: JSON missing required fields "
                      f"(name={tailored.get('name')!r}, "
                      f"exp_count={len(tailored.get('experience', []))})", file=sys.stderr)
                continue

            # Restore any fields the LLM may have dropped
            for field in ("contact", "education", "skills", "languages", "competencies"):
                if not tailored.get(field):
                    tailored[field] = base_cv.get(
                        field,
                        [] if field in ("competencies", "education", "skills", "languages") else {},
                    )
            return tailored

        except Exception as e:
            print(f"CV Adapter attempt {attempt} exception: {e}", file=sys.stderr)

    return None


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Tailor CV for a specific job")
    parser.add_argument("jd_json", help="Job description JSON from job_reader")
    parser.add_argument("base_cv_json", help="Base CV JSON file path")
    parser.add_argument("output_path", nargs="?", help="Output path for tailored CV")
    args = parser.parse_args()

    # Load inputs
    jd = json.loads(args.jd_json) if isinstance(args.jd_json, str) and args.jd_json.startswith("{") else json.load(open(args.jd_json) if os.path.exists(args.jd_json) else __import__("io").StringIO(args.jd_json))
    base_cv = json.load(open(args.base_cv_json))

    jd_extracted = jd.get("extracted") if isinstance(jd, dict) and "extracted" in jd else jd
    if not isinstance(jd_extracted, dict):
        jd_extracted = jd

    log_activity("cv-adapter", f"tailoring CV for {jd_extracted.get('full_job_title','?')} @ {jd_extracted.get('company_name','?')}", "running")

    tailored = tailor_cv(base_cv, jd_extracted)

    if tailored:
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_name = re.sub(r"[^a-zA-Z0-9]+", "_", (jd_extracted.get("company_name", "company") + "_" + jd_extracted.get("full_job_title", "role")))[:60]
        output_path = args.output_path or str(OUTPUT_DIR / f"tailored_{safe_name}_{ts}.json")

        with open(output_path, "w") as f:
            json.dump(tailored, f, indent=2)

        print(json.dumps({"status": "saved", "path": output_path, "role": jd_extracted.get("full_job_title"), "company": jd_extracted.get("company_name")}))
        log_activity("cv-adapter", f"tailored CV: {jd_extracted.get('full_job_title','?')} @ {jd_extracted.get('company_name','?')}", "completed")
    else:
        # Fallback: use base CV as-is
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_path = args.output_path or str(OUTPUT_DIR / f"tailored_fallback_{ts}.json")
        with open(output_path, "w") as f:
            json.dump(base_cv, f, indent=2)
        print(json.dumps({"status": "fallback", "path": output_path, "note": "LLM tailoring failed, saved base CV as-is"}))
        log_activity("cv-adapter", f"tailor fallback (LLM failed): {jd_extracted.get('full_job_title','?')}", "completed")


if __name__ == "__main__":
    main()