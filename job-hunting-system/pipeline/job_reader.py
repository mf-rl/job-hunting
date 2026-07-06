#!/usr/bin/env python3
"""
job_reader.py — Fetch a job URL's full page text deterministically, then extract
structured fields via the job-reader LLM profile.

Usage: job_reader.py <url> [--description <stored_description>]
Output: JSON with extracted fields + full_text (attached in Python)
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

FORGE_HOME = Path(os.environ.get("FORGE_SYSTEM_DIR") or os.path.expanduser("~/job-hunting/job-hunting-system"))
HERMES_HOME = Path(os.environ.get("HERMES_HOME") or os.path.expanduser("~/.hermes"))
VENV_PYTHON = HERMES_HOME / "hermes-agent" / "venv" / "bin" / "python3"
LOG_SCRIPT = HERMES_HOME / "agents" / "_shared" / "log-task-local.sh"
NO_MODEL_REQUIRED = "none - not required"


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
                        in_model = False  # left the model block
        except Exception:
            pass
    return "unknown"


def log_activity(agent: str, task: str, status: str, model: str = ""):
    if not model:
        model = _read_active_model(profile=agent)
    subprocess.run(["bash", str(LOG_SCRIPT), agent, task, status, model], capture_output=True, timeout=10)


_BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}


def _html_to_text(html: str) -> str:
    """Strip HTML tags and collapse whitespace."""
    text = re.sub(r"<[^>]+>", " ", html)
    return re.sub(r"\s+", " ", text).strip()


def _http_get(url: str, extra_headers: dict | None = None, timeout: int = 20) -> str | None:
    """Perform a GET request and return stripped plain text, or None on failure."""
    headers = {**_BROWSER_HEADERS, **(extra_headers or {})}
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read()
            try:
                raw = body.decode("utf-8", errors="replace")
            except Exception:
                raw = body.decode("latin-1", errors="replace")
            text = _html_to_text(raw)
            return text if len(text) > 200 else None
    except Exception:
        return None


def fetch_url_text(url: str) -> str | None:
    """Fetch URL text with browser-like User-Agent. Returns None on failure."""
    return _http_get(url)


def _linkedin_job_id(url: str) -> str | None:
    """Extract numeric job ID from a LinkedIn jobs URL."""
    m = re.search(r"/jobs/view/(\d+)", url)
    return m.group(1) if m else None


def fetch_linkedin_guest(job_id: str) -> str | None:
    """
    Fetch job content from LinkedIn's public guest-API endpoint.
    This avoids the login-wall that blocks the regular /jobs/view/ page.
    """
    guest_url = f"https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/{job_id}"
    print(f"Trying LinkedIn guest API: {guest_url}", file=sys.stderr)
    raw = _http_get_raw(guest_url, extra_headers={"Referer": "https://www.linkedin.com/"})
    if raw:
        _LI_RAW_HTML[0] = raw  # store for regex fallback
        text = _html_to_text(raw)
        return text if len(text) > 200 else None
    return None


# Module-level slot to pass raw HTML from fetch to extraction fallback
_LI_RAW_HTML: list[str] = [""]


def _http_get_raw(url: str, extra_headers: dict | None = None, timeout: int = 20) -> str | None:
    """Like _http_get but returns raw HTML (before stripping tags)."""
    headers = {**_BROWSER_HEADERS, **(extra_headers or {})}
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read()
            try:
                return body.decode("utf-8", errors="replace")
            except Exception:
                return body.decode("latin-1", errors="replace")
    except Exception:
        return None


def _extract_linkedin_fields(raw_html: str) -> dict | None:
    """
    Regex-based extraction of key fields from LinkedIn guest-API HTML.
    Used as a fallback when the LLM is unavailable or rate-limited.
    """
    def _strip(s: str) -> str:
        return re.sub(r"<[^>]+>", "", s).strip()

    fields: dict = {
        "full_job_title": "", "company_name": "", "location": "",
        "work_mode": "", "salary": "", "date_posted": "",
        "remote_mentioned": False, "language": "",
        "responsibilities": [], "required_skills": [],
        "preferred_skills": [], "seniority_signals": [],
    }

    # Title
    m = re.search(r'class="[^"]*topcard__title[^"]*"[^>]*>(.*?)</h2>', raw_html, re.DOTALL | re.I)
    if m:
        fields["full_job_title"] = _strip(m.group(1))

    # Company
    m = re.search(r'class="[^"]*topcard__org-name-link[^"]*"[^>]*>(.*?)</a>', raw_html, re.DOTALL | re.I)
    if m:
        fields["company_name"] = _strip(m.group(1))

    # Location (first bullet after company)
    m = re.search(r'class="[^"]*topcard__flavor--bullet[^"]*"[^>]*>(.*?)</span>', raw_html, re.DOTALL | re.I)
    if m:
        fields["location"] = _strip(m.group(1))

    # Date posted
    m = re.search(r'class="[^"]*posted-time-ago__text[^"]*"[^>]*>(.*?)</span>', raw_html, re.DOTALL | re.I)
    if m:
        fields["date_posted"] = _strip(m.group(1))

    # Work mode — scan visible text and title for keywords (EN + ES + PT)
    visible = _html_to_text(raw_html).lower()
    title_lower = fields["full_job_title"].lower()
    combined = visible + " " + title_lower
    if any(k in combined for k in ("remote", "remoto", "remota", "télétravail", "homeoffice", "home office", "fully remote")):
        fields["work_mode"] = "remote"
        fields["remote_mentioned"] = True
    elif any(k in combined for k in ("hybrid", "híbrido", "hibrido", "hybride")):
        fields["work_mode"] = "hybrid"
    elif any(k in combined for k in ("on-site", "onsite", "presential", "presencial", "in-office", "in office")):
        fields["work_mode"] = "on-site"

    # Description text for responsibilities / skills
    desc_match = re.search(
        r'class="[^"]*description__text[^"]*"[^>]*>(.*?)</div>',
        raw_html, re.DOTALL | re.I,
    )
    if desc_match:
        desc_html = desc_match.group(1)
        # Extract list items as responsibilities
        items = re.findall(r"<li[^>]*>(.*?)</li>", desc_html, re.DOTALL | re.I)
        bullets = [_strip(i) for i in items if len(_strip(i)) > 5]
        fields["responsibilities"] = bullets[:20]

    return fields if fields["full_job_title"] or fields["company_name"] else None


def extract_with_llm(page_text: str, url: str) -> dict | None:
    """Call job-reader profile to extract structured fields from page text."""
    truncated = page_text[:15000]

    prompt = (
        "You are Job Reader, the job-description analyst. From the job posting text below, "
        "extract ONLY these short structured fields. Return ONLY valid JSON, no other text:\n\n"
        "{\n"
        '  "full_job_title": "",\n'
        '  "company_name": "",\n'
        '  "location": "",\n'
        '  "work_mode": "",\n'
        '  "salary": "",\n'
        '  "date_posted": "",\n'
        '  "remote_mentioned": false,\n'
        '  "language": "",\n'
        '  "responsibilities": [],\n'
        '  "required_skills": [],\n'
        '  "preferred_skills": [],\n'
        '  "seniority_signals": []\n'
        "}\n\n"
        'For "work_mode" use one of: "remote", "hybrid", "on-site", or "" if not specified.\n'
        'For "salary" include the full range/currency string if mentioned, else "".\n'
        'For "date_posted" use ISO date (YYYY-MM-DD) if mentioned, else "".\n'
        "Do NOT repeat the description in your output. Extract from this text:\n\n"
        f"{truncated}"
    )

    try:
        r = subprocess.run(
            [str(VENV_PYTHON), "-m", "hermes_cli.main", "chat",
             "-p", "job-reader", "-q", prompt, "--yolo", "-Q"],
            capture_output=True, text=True, timeout=90,
            env={**os.environ, "HERMES_HOME": str(HERMES_HOME)},
        )
        if r.returncode != 0:
            err = (r.stderr or r.stdout or "unknown")[:300].strip()
            print(f"LLM extraction failed (exit {r.returncode}): {err}", file=sys.stderr)
            return None

        output = r.stdout.strip()
        if not output:
            print(f"LLM extraction failed: empty response (stderr: {r.stderr[:200]})", file=sys.stderr)
            return None

        lines = [l for l in output.splitlines() if not l.startswith("session_id:")]
        text = "\n".join(lines).strip()

        parsed = _parse_llm_json(text)
        if parsed is None:
            print(f"LLM extraction failed: no valid JSON in response: {text[:200]}", file=sys.stderr)
            return None

        parsed.setdefault("full_job_title", "")
        parsed.setdefault("company_name", "")
        parsed.setdefault("location", "")
        parsed.setdefault("work_mode", "")
        parsed.setdefault("salary", "")
        parsed.setdefault("date_posted", "")
        parsed.setdefault("remote_mentioned", False)
        parsed.setdefault("language", "")
        parsed.setdefault("responsibilities", [])
        parsed.setdefault("required_skills", [])
        parsed.setdefault("preferred_skills", [])
        parsed.setdefault("seniority_signals", [])
        return parsed
    except subprocess.TimeoutExpired:
        print("LLM extraction failed: hermes CLI timed out after 90s", file=sys.stderr)
    except Exception as e:
        print(f"LLM extraction failed: {e}", file=sys.stderr)
    return None


def _parse_llm_json(text: str) -> dict | None:
    """
    Try multiple strategies to extract a JSON object from LLM output.
    Handles markdown code fences, trailing commas, and leading/trailing prose.
    """
    # Strategy 1: the whole output is already valid JSON
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Strategy 2: strip markdown code fences ```json ... ```
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
    if fence:
        try:
            return json.loads(fence.group(1))
        except json.JSONDecodeError:
            pass

    # Strategy 3: extract the outermost { ... } block
    brace = re.search(r"\{[\s\S]*\}", text)
    if brace:
        candidate = brace.group()
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            # Strategy 4: remove trailing commas before } or ]
            fixed = re.sub(r",\s*([}\]])", r"\1", candidate)
            try:
                return json.loads(fixed)
            except json.JSONDecodeError as e:
                print(f"LLM extraction failed: {e}", file=sys.stderr)

    return None


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Fetch and extract job description")
    parser.add_argument("url", help="Job listing URL")
    parser.add_argument("--description", help="Stored description from search step (fallback)")
    args = parser.parse_args()

    url = args.url
    log_activity("job-reader", f"reading job: {url[:80]}", "running", NO_MODEL_REQUIRED)

    # Step 1: LinkedIn-specific: try guest API first (avoids login-wall)
    page_text = None
    source = "http_fetch"
    li_id = _linkedin_job_id(url)
    if li_id:
        page_text = fetch_linkedin_guest(li_id)
        if page_text:
            source = "linkedin_guest"
            print(f"LinkedIn guest API returned {len(page_text)} chars", file=sys.stderr)

    # Step 2: Generic HTTP fetch (fallback for LinkedIn and default for other sites)
    if not page_text or len(page_text) < 200:
        print(f"Fetching: {url[:100]}...", file=sys.stderr)
        page_text = fetch_url_text(url)
        source = "http_fetch"

    # Step 3: Fallback to stored description
    if not page_text or len(page_text) < 200:
        if args.description:
            print("HTTP fetch returned thin content, using stored description", file=sys.stderr)
            page_text = args.description
            source = "stored_description"
        else:
            print("WARNING: No usable page text and no stored description", file=sys.stderr)
            page_text = ""

    # Step 4: Extract with LLM
    if page_text:
        extracted = extract_with_llm(page_text, url)
        if extracted:
            result = {
                "url": url,
                "source": source,
                "extracted": extracted,
                "full_text_length": len(page_text),
                "full_text_preview": page_text[:5000],
            }
            print(json.dumps(result, indent=2))
            log_activity("job-reader", f"extracted JD: {extracted.get('full_job_title', '?')} @ {extracted.get('company_name', '?')}", "completed")
            return

        # Step 5: LLM failed — try regex fallback (LinkedIn guest API HTML only)
        print("LLM failed; trying regex fallback on raw HTML...", file=sys.stderr)
        raw_html = _LI_RAW_HTML[0]
        if raw_html:
            extracted = _extract_linkedin_fields(raw_html)
            if extracted:
                result = {
                    "url": url,
                    "source": "linkedin_regex_fallback",
                    "extracted": extracted,
                    "full_text_length": len(page_text),
                    "full_text_preview": page_text[:5000],
                }
                print(json.dumps(result, indent=2))
                log_activity("job-reader", f"extracted JD (regex): {extracted.get('full_job_title', '?')} @ {extracted.get('company_name', '?')}", "completed", NO_MODEL_REQUIRED)
                return

    log_activity(
        "job-reader",
        f"failed to extract JD from: {url[:80]}",
        "failed",
        "" if page_text else NO_MODEL_REQUIRED,
    )
    print(json.dumps({"error": "Could not extract job description", "url": url}), file=sys.stderr)
    sys.exit(1)


if __name__ == "__main__":
    main()