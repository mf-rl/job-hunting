#!/usr/bin/env python3
"""
build_base_cv.py — Extract text from uploaded CV, structure via CV Adapter,
derive search profile, atomically write artifacts.

Run by POST /api/cv via subprocess.Popen (background).
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

# ── paths ──────────────────────────────────────────────────────────────────

FORGE_HOME = Path(os.environ.get("FORGE_SYSTEM_DIR") or os.path.expanduser("~/job-hunting/job-hunting-system"))
CV_DIR = FORGE_HOME / "cv"
PROFILE_DIR = FORGE_HOME / "profile"
BUILD_FLAG = CV_DIR / ".cv-building"
BUILD_LOG = FORGE_HOME / "pipeline" / "build.log"

def log(msg: str):
    """Append a timestamped line to the build log."""
    import datetime
    ts = datetime.datetime.now().isoformat()
    BUILD_LOG.parent.mkdir(parents=True, exist_ok=True)
    with open(str(BUILD_LOG), "a") as f:
        f.write(f"[{ts}] {msg}\n")

HERMES_HOME = Path(os.environ.get("HERMES_HOME") or os.path.expanduser("~/.hermes"))
VENV_PYTHON = HERMES_HOME / "hermes-agent" / "venv" / "bin" / "python3"

BASE_CV_JSON = CV_DIR / "base_cv.json"
BASE_CV_TXT = CV_DIR / "base_cv.txt"


# ── text extraction ────────────────────────────────────────────────────────

def _normalize_text(text: str) -> str:
    """Replace PDF/Unicode bullet characters with plain hyphens for cleaner LLM input."""
    import re as _re
    # Common PDF bullet glyphs → hyphen
    for char in ("\u25cf", "\u25cb", "\u25aa", "\u25ba", "\u27a4", "\u2022", "\u2023", "\u25e6"):
        text = text.replace(char, "-")
    # Collapse runs of spaces that pdftotext -layout adds between columns
    text = _re.sub(r" {4,}", "  ", text)
    return text


def extract_text(raw_path: Path) -> str:
    ext = raw_path.suffix.lower()
    if ext == ".pdf":
        return _extract_pdf(raw_path)
    elif ext == ".docx":
        return _extract_docx(raw_path)
    else:  # .txt / .md
        try:
            text = raw_path.read_text("utf-8")
        except UnicodeDecodeError:
            text = raw_path.read_text("latin-1")
        return _normalize_text(text)


def _extract_pdf(path: Path) -> str:
    # Try pdftotext first
    if shutil.which("pdftotext"):
        try:
            r = subprocess.run(["pdftotext", "-layout", str(path), "-"],
                               capture_output=True, text=True, timeout=30)
            if r.returncode == 0 and r.stdout.strip():
                return _normalize_text(r.stdout)
        except Exception:
            pass
    # Fallback: use PyMuPDF if available
    try:
        import fitz
        doc = fitz.open(str(path))
        text = "\n".join(page.get_text() for page in doc)
        doc.close()
        if text.strip():
            return _normalize_text(text)
    except ImportError:
        pass
    # Last resort: pdfminer
    try:
        from pdfminer.high_level import extract_text as pdf_extract
        return _normalize_text(pdf_extract(str(path)))
    except ImportError:
        return f"[PDF extraction failed — install pdftotext, PyMuPDF, or pdfminer]"


def _extract_docx(path: Path) -> str:
    try:
        from docx import Document
        doc = Document(str(path))
        paragraphs = [p.text for p in doc.paragraphs]
        return "\n".join(paragraphs)
    except Exception as e:
        return f"[DOCX extraction failed: {e}]"


# ── LLM call: structure CV ─────────────────────────────────────────────────

STRUCTURE_PROMPT = """You are CV Adapter, the CV specialist of Mauricio's job-hunting system.
Extract the following CV text into EXACTLY this JSON schema — strictly from what the text says, never inventing:

{
  "name": "Full Name",
  "headline": "Professional headline / title",
  "contact": { "email": "", "phone": "", "location": "", "linkedin": "" },
  "summary": "2-3 sentence professional summary from the CV",
  "competencies": ["skill1", "skill2"],
  "experience": [
    {
      "company": "Company Name",
      "location": "City, Country",
      "start": "YYYY-MM",
      "end": "YYYY-MM or Present",
      "role": "Job Title",
      "bullets": ["accomplishment 1", "accomplishment 2"]
    }
  ],
  "education": [
    {
      "institution": "University",
      "degree": "Degree Name",
      "field": "Field of Study",
      "year": "YYYY"
    }
  ],
  "skills": [
    { "category": "Exact category name from the CV", "items": ["skill1", "skill2"] }
  ],
  "languages": [
    { "lang": "Language", "level": "Native/Fluent/Intermediate/Basic" }
  ]
}

IMPORTANT for experience: include EVERY job listed in the CV — including entries in compact "Earlier Experience" / "Other Experience" sections where roles appear as one-liners (e.g. "Company — Role (YYYY – YYYY)"). For those, set bullets to [] and parse start/end year from the parenthesised date range (use YYYY-01 for start, YYYY-12 for end when only a year is given).

IMPORTANT for skills: preserve the EXACT category names and groupings as they appear in the CV document (e.g. "AI-Assisted Development", "Quality & Testing", "Infrastructure & DevOps"). Do NOT collapse everything into generic "Technical" / "Soft" buckets unless the CV itself uses those terms.

Return ONLY the JSON object, no other text.

CV TEXT:
"""


def _extract_json(text: str) -> dict | None:
    """Try multiple strategies to extract a JSON object from LLM output."""
    import re as _re

    # Strip markdown code fences: ```json ... ``` or ``` ... ```
    fenced = _re.search(r'```(?:json)?\s*(\{.*?\})\s*```', text, _re.DOTALL)
    candidates = []
    if fenced:
        candidates.append(fenced.group(1))
    # Also try the whole text as-is, and the first {...} block
    raw_match = _re.search(r'\{.*\}', text, _re.DOTALL)
    if raw_match:
        candidates.append(raw_match.group())
    candidates.append(text.strip())

    for candidate in candidates:
        # Fix common LLM JSON mistakes
        fixed = candidate
        # Remove trailing commas before } or ]
        fixed = _re.sub(r',\s*([}\]])', r'\1', fixed)
        # Remove JS-style // comments
        fixed = _re.sub(r'//[^\n]*', '', fixed)
        try:
            return json.loads(fixed)
        except Exception:
            pass
    return None


def _language_level(raw: str) -> str:
    value = raw.lower()
    if "native" in value or "nativo" in value:
        return "Native"
    if "fluent" in value or "fluido" in value or "advanced" in value or "avanzado" in value:
        return "Fluent"
    if "intermediate" in value or "intermedio" in value or "working" in value:
        return "Intermediate"
    if "basic" in value or "basico" in value or "básico" in value:
        return "Basic"
    return raw.strip() or ""


def merge_structured_cv_from_text(structured: dict, cv_text: str) -> dict:
    """Recover deterministic fields the LLM sometimes misses from the raw CV text."""
    if not isinstance(structured, dict):
        return structured

    if not structured.get("name"):
        first_line = next((line.strip() for line in cv_text.splitlines() if line.strip()), "")
        if first_line:
            structured["name"] = first_line

    match = re.search(r"(?im)^\s*Languages?\s*:\s*(.+)$", cv_text)
    if not match:
        return structured

    aliases = {
        "english": "English", "ingles": "English", "inglés": "English",
        "spanish": "Spanish", "espanol": "Spanish", "español": "Spanish",
    }
    languages = structured.get("languages") if isinstance(structured.get("languages"), list) else []
    seen = {str(item.get("lang", "")).strip().lower() for item in languages if isinstance(item, dict)}

    for part in match.group(1).split(","):
        parsed = re.match(r"([A-Za-zÁÉÍÓÚáéíóúÑñ]+)\s*(?:\(([^)]*)\))?", part.strip())
        if not parsed:
            continue
        lang = aliases.get(parsed.group(1).lower(), parsed.group(1).strip())
        if lang.lower() in seen:
            continue
        languages.append({"lang": lang, "level": _language_level(parsed.group(2) or "")})
        seen.add(lang.lower())

    structured["languages"] = languages
    return structured


def call_cv_adapter(cv_text: str) -> dict | None:
    """Call the CV Adapter Hermes profile to structure the CV."""
    prompt = STRUCTURE_PROMPT + cv_text
    try:
        r = subprocess.run(
            [str(VENV_PYTHON), "-m", "hermes_cli.main", "chat",
             "-p", "cv-adapter", "-q", prompt, "-Q"],
            capture_output=True, text=True, timeout=300,
            env={**os.environ, "HERMES_HOME": str(HERMES_HOME)},
        )
        # session_id now goes to stderr in newer hermes; stdout is pure response
        text = r.stdout.strip()
        result = _extract_json(text)
        if result is None:
            print(f"CV Adapter call failed: could not parse JSON from output (first 200 chars): {text[:200]}", file=sys.stderr)
        return result
    except Exception as e:
        print(f"CV Adapter call failed: {e}", file=sys.stderr)
        return None


# ── LLM call: derive search profile ────────────────────────────────────────

PROFILE_PROMPT = """You are a job-search profile analyst. From the CV text below, derive a concise search-targeting profile.

Return EXACTLY this JSON:
{
  "target_titles": ["Title1", "Title2", "Title3"],
  "search_queries": ["keyword1", "keyword2", "keyword3"],
  "skills": ["skill1", "skill2", "skill3"],
  "scoring_skills": ["critical_skill1", "critical_skill2"],
  "seniority": "Senior/Mid-level/Entry",
  "industry_hints": ["industry1"]
}

RULES:
- search_queries MUST be SHORT 1-2 word domain keywords (e.g. "DevOps", "SRE", "Python", "Backend") — NOT multi-word phrases — because job boards AND the words together and a long phrase matches nothing.
- target_titles are full job titles the person qualifies for.
- skills are ALL technical + domain skills from the CV.
- scoring_skills are the ~5 most critical MUST-HAVE skills for matching.
- seniority inferred from years of experience.

Return ONLY the JSON.

CV TEXT:
"""


def derive_profile(cv_text: str) -> dict | None:
    """Best-effort: derive search profile from CV text (never fail the build)."""
    try:
        prompt = PROFILE_PROMPT + cv_text
        r = subprocess.run(
            [str(VENV_PYTHON), "-m", "hermes_cli.main", "chat",
             "-p", "cv-adapter", "-q", prompt, "-Q"],
            capture_output=True, text=True, timeout=240,
            env={**os.environ, "HERMES_HOME": str(HERMES_HOME)},
        )
        return _extract_json(r.stdout.strip())
    except Exception:
        return None


def merge_profile(derived: dict, cv_skills: list | None = None) -> None:
    """Merge derived profile into profile.json, preserving existing knobs.

    cv_skills: flat list of skill strings extracted directly from the structured CV.
    These take priority over LLM-derived scoring_skills.
    """
    PROFILE_DIR.mkdir(parents=True, exist_ok=True)
    profile_path = PROFILE_DIR / "profile.json"

    existing = {}
    if profile_path.exists():
        try:
            existing = json.loads(profile_path.read_text())
        except Exception:
            pass

    # Preserve user-set search knobs
    preserved_keys = ["country", "threshold", "pages", "sources", "target_seniority"]
    merged = {k: v for k, v in existing.items() if k in preserved_keys}

    # Overlay LLM-derived values (target_titles, search_queries, seniority, industry_hints)
    if derived:
        for key in ("target_titles", "search_queries", "seniority", "industry_hints"):
            if key in derived:
                merged[key] = derived[key]

    # scoring_skills: prefer CV's own extracted skills over LLM-derived ones
    if cv_skills:
        merged["scoring_skills"] = cv_skills
    elif derived and "scoring_skills" in derived:
        merged["scoring_skills"] = derived["scoring_skills"]

    profile_path.write_text(json.dumps(merged, indent=2))


# ── main ───────────────────────────────────────────────────────────────────

def main():
    # Find raw CV file
    raw_path = None
    for f in CV_DIR.iterdir():
        if f.name.startswith("base_cv_raw.") and f.is_file():
            raw_path = f
            break

    if not raw_path:
        print("No raw CV file found", file=sys.stderr)
        BUILD_FLAG.unlink(missing_ok=True)
        sys.exit(1)

    # 1) Extract text
    cv_text = extract_text(raw_path)
    log(f"Extracted {len(cv_text)} chars from {raw_path.name}")
    if not cv_text.strip():
        log("FAIL: extracted text is empty")
        BUILD_FLAG.unlink(missing_ok=True)
        sys.exit(1)

    # 2) Write base_cv.txt
    BASE_CV_TXT.write_text(cv_text, "utf-8")
    log("base_cv.txt written")

    # 3) Call CV Adapter to structure
    structured = call_cv_adapter(cv_text)
    if structured:
        structured = merge_structured_cv_from_text(structured, cv_text)
        fd, tmp_path = tempfile.mkstemp(suffix=".json", dir=str(CV_DIR))
        try:
            with os.fdopen(fd, "w") as f:
                json.dump(structured, f, indent=2)
            has_name = bool(structured.get("name"))
            has_content = bool(structured.get("experience")) or bool(structured.get("skills"))
            if has_name and has_content:
                os.replace(tmp_path, str(BASE_CV_JSON))
                log(f"base_cv.json written: {structured.get('name')} ({len(structured.get('experience',[]))} jobs, {len(structured.get('skills',[]))} skill groups)")
            else:
                os.unlink(tmp_path)
                log(f"FAIL: structured CV failed validation — name={has_name} content={has_content}")
        except Exception as exc:
            log(f"FAIL: exception during structured write: {exc}")
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
    else:
        log("FAIL: CV Adapter returned no valid structured data")

    # 4) Derive profile and merge skills (best-effort, never fails the build)
    # Extract all skill items directly from the structured CV (reliable, no LLM needed)
    cv_skills: list[str] = [
        item
        for sg in (structured or {}).get("skills", [])
        for item in sg.get("items", [])
        if item
    ]
    try:
        derived = derive_profile(cv_text)
        merge_profile(derived or {}, cv_skills=cv_skills or None)
        if derived:
            log(f"Profile derived: {len(derived.get('target_titles',[]))} titles, {len(derived.get('search_queries',[]))} queries, {len(cv_skills)} scoring skills from CV")
        else:
            if cv_skills:
                log(f"Profile: LLM derivation returned no data — scoring_skills populated from CV ({len(cv_skills)} skills)")
            else:
                log("Profile derivation returned no data (best-effort — CV build unaffected)")
    except Exception as e:
        log(f"Profile derivation failed: {e} (best-effort — CV build unaffected)")
        if cv_skills:
            try:
                merge_profile({}, cv_skills=cv_skills)
                log(f"Profile: exception during derivation, scoring_skills populated from CV ({len(cv_skills)} skills)")
            except Exception:
                pass

    # 5) Remove building flag
    BUILD_FLAG.unlink(missing_ok=True)
    log("Build complete")



if __name__ == "__main__":
    main()