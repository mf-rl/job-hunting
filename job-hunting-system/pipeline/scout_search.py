#!/usr/bin/env python3
"""
scout_search.py — Fetch jobs from Adzuna + Remotive, merge + dedup, write output.

Run with the Hermes venv python:
  /home/mfrl/.hermes/hermes-agent/venv/bin/python3 scout_search.py
"""

from __future__ import annotations

import base64
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import OrderedDict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# ── paths ──────────────────────────────────────────────────────────────────

FORGE_HOME = Path(os.environ.get("FORGE_SYSTEM_DIR") or os.path.expanduser("~/job-hunting/job-hunting-system"))
HERMES_HOME = Path(os.environ.get("HERMES_HOME") or os.path.expanduser("~/.hermes"))
PROFILE_PATH = FORGE_HOME / "profile" / "profile.json"
OUTPUT_DIR = FORGE_HOME / "agents" / "scout" / "outputs"

# ── load profile ───────────────────────────────────────────────────────────

def load_profile() -> dict:
    if not PROFILE_PATH.exists():
        raise FileNotFoundError(f"Profile not found: {PROFILE_PATH}")
    with open(PROFILE_PATH) as f:
        return json.load(f)


# ── helpers ────────────────────────────────────────────────────────────────

def load_env() -> dict:
    """Load KEY=VALUE lines from ~/.hermes/.env (skip comments/blanks)."""
    env_path = HERMES_HOME / ".env"
    env = {}
    if env_path.exists():
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    k, _, v = line.partition("=")
                    env[k.strip()] = v.strip()
    return env


def fetch_json(url: str, timeout: int = 15) -> dict | list | None:
    """GET a URL with a browser-like User-Agent, return parsed JSON or None."""
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "ForgeScout/1.0",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            return json.loads(body)
    except Exception as e:
        print(f"  [warn] fetch failed for {url[:80]}: {e}")
        return None


def normalize_company(name: str) -> str:
    """Strip legal/filler suffixes from company names for dedup."""
    if not name:
        return ""
    name = name.strip()
    # Remove common suffixes (case-insensitive)
    suffixes = [
        r"\s+(Group|GmbH|AG|SE|Inc|Ltd|Limited|LLC|Corp|Corporation|Co|Company|S\.A\.|S\.A\.C\.|SAC|SRL|BV|NV|PLC|Pty|Pte|GmbH & Co\. KG)",
        r"\s+[,.]?\s*(Group|GmbH|AG|SE|Inc|Ltd|Limited|LLC|Corp|Corporation|Co|Company|S\.A\.|SAC|SRL|BV|NV|PLC)",
    ]
    for pat in suffixes:
        name = re.sub(pat, "", name, flags=re.IGNORECASE)
    return name.strip()


def normalize_title(title: str) -> str:
    """Lowercase, strip punctuation, collapse whitespace for dedup."""
    if not title:
        return ""
    t = title.lower().strip()
    t = re.sub(r"[^a-z0-9\s]", "", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def dedup_key(title: str, company: str) -> str:
    """Create a normalized dedup key from title + company."""
    return f"{normalize_title(title)}|{normalize_company(company).lower()}"


def make_run_id() -> str:
    return datetime.now().strftime("run_%Y%m%d_%H%M%S")


_COUNTRY_ALIASES = {
    "us": ("united states", "usa", "us"), "es": ("spain", "espana", "españa"),
    "gb": ("united kingdom", "uk", "england", "scotland", "wales", "northern ireland"),
    "de": ("germany", "deutschland"), "fr": ("france",), "ca": ("canada",),
    "au": ("australia",), "br": ("brazil", "brasil"), "in": ("india",),
    "nl": ("netherlands", "holland"), "it": ("italy", "italia"),
    "ch": ("switzerland", "schweiz", "suisse"), "at": ("austria",),
    "be": ("belgium",), "pl": ("poland", "polska"), "za": ("south africa",),
    "sg": ("singapore",), "hk": ("hong kong",), "ie": ("ireland",),
    "nz": ("new zealand",), "se": ("sweden", "sverige"),
    "ae": ("united arab emirates", "uae"), "sa": ("saudi arabia",),
    "mx": ("mexico", "méxico"), "ar": ("argentina",), "cl": ("chile",), "co": ("colombia",),
}


def selected_country_codes(profile: dict) -> set[str]:
    return {c.strip().lower() for c in str(profile.get("country", "us")).split(",") if c.strip()}


def _normalized_location_text(value: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9áéíóúñ]+", " ", value.lower())).strip()


def _codes_in_location(text: str) -> set[str]:
    normalized = f" {_normalized_location_text(text)} "
    found: set[str] = set()
    for code, aliases in _COUNTRY_ALIASES.items():
        for alias in aliases:
            alias_norm = _normalized_location_text(alias)
            if alias_norm and f" {alias_norm} " in normalized:
                found.add(code)
                break
    return found


def listing_country_codes(listing: dict) -> set[str]:
    source = str(listing.get("source", "")).lower()
    if source.startswith("adzuna_"):
        return {source.split("_", 1)[1]}
    if source == "reed":
        return {"gb"}
    location = listing.get("location") or {}
    location_text = location.get("display_name", "") if isinstance(location, dict) else str(location)
    return _codes_in_location(location_text)


def filter_by_selected_countries(listings: list[dict], selected: set[str], notes: list[str]) -> list[dict]:
    if not selected:
        return listings
    kept = []
    dropped = 0
    for listing in listings:
        codes = listing_country_codes(listing)
        if not codes or codes & selected:
            kept.append(listing)
        else:
            dropped += 1
    if dropped:
        notes.append(f"Country filter: dropped {dropped} listings outside selected countries ({', '.join(sorted(selected))})")
    return kept


# ── Adzuna ──────────────────────────────────────────────────────────────────

ADZUNA_BASE = "https://api.adzuna.com/v1/api/jobs"


def fetch_adzuna(profile: dict, notes: list) -> list[dict]:
    """Fetch from Adzuna for each query in each country. Returns normalized listings."""
    env = load_env()
    app_id = env.get("ADZUNA_APP_ID", "")
    app_key = env.get("ADZUNA_APP_KEY", "")
    if not app_id or not app_key:
        notes.append("Adzuna: no credentials (ADZUNA_APP_ID / ADZUNA_APP_KEY)")
        return []

    countries = [c.strip() for c in profile.get("country", "us").split(",") if c.strip()]
    queries = profile.get("search_queries", [])
    if len(queries) > 6:
        notes.append(f"Adzuna: capped queries from {len(queries)} to 6 to keep search under timeout")
        queries = queries[:6]
    pages = profile.get("pages", 2)
    rpp = profile.get("results_per_page", 60)
    max_days = profile.get("max_days_old", 120)
    all_listings: list[dict] = []
    seen_keys: set = set()
    total_calls = 0

    for country in countries:
        for query in queries:
            # Probe and shorten: Adzuna ANDs all words
            shortened = shorten_adzuna_query(app_id, app_key, country, query)
            if not shortened:
                notes.append(f"Adzuna {country}/{query}: zero hits even after shortening — skipped")
                continue

            if shortened != query:
                notes.append(f"Adzuna {country}: shortened '{query}' → '{shortened}' (zero hits at full length)")

            # sweep pages: sort_by=date (newest first)
            for page in range(1, pages + 1):
                url = (
                    f"{ADZUNA_BASE}/{country}/search/{page}"
                    f"?app_id={app_id}&app_key={app_key}"
                    f"&what={urllib.parse.quote(shortened)}"
                    f"&results_per_page={rpp}"
                    f"&max_days_old={max_days}"
                    f"&sort_by=date"
                    f"&content-type=application/json"
                )
                data = fetch_json(url)
                total_calls += 1
                if data and isinstance(data, dict) and "results" in data:
                    all_listings, seen_keys = normalize_adzuna_results(
                        data["results"], country, query, all_listings, seen_keys
                    )
                # Polite delay
                time.sleep(0.3)

            # relevance sort page 1
            url = (
                f"{ADZUNA_BASE}/{country}/search/1"
                f"?app_id={app_id}&app_key={app_key}"
                f"&what={urllib.parse.quote(shortened)}"
                f"&results_per_page={rpp}"
                f"&max_days_old={max_days}"
                f"&sort_by=relevance"
                f"&content-type=application/json"
            )
            data = fetch_json(url)
            total_calls += 1
            if data and isinstance(data, dict) and "results" in data:
                all_listings, seen_keys = normalize_adzuna_results(
                    data["results"], country, query, all_listings, seen_keys
                )
            time.sleep(0.3)

    notes.append(f"Adzuna: {len(all_listings)} unique listings from {total_calls} API calls across {len(countries)} countries")
    return all_listings


def shorten_adzuna_query(app_id: str, app_key: str, country: str, query: str) -> str | None:
    """Probe the query; if zero hits, drop trailing words until results appear."""
    words = query.split()
    if not words:
        return None
    for i in range(len(words), 0, -1):
        shortened = " ".join(words[:i])
        url = (
            f"{ADZUNA_BASE}/{country}/search/1"
            f"?app_id={app_id}&app_key={app_key}"
            f"&what={urllib.parse.quote(shortened)}"
            f"&results_per_page=1"
            f"&content-type=application/json"
        )
        data = fetch_json(url)
        if data and isinstance(data, dict) and data.get("count", 0) > 0:
            return shortened
        time.sleep(0.2)
    return None


def normalize_adzuna_results(
    results: list, country: str, query: str, existing: list[dict], seen_keys: set
) -> tuple[list[dict], set]:
    """Normalize Adzuna results to common schema, dedup."""
    for r in results:
        title = r.get("title", "").strip()
        company = r.get("company", {})
        if isinstance(company, dict):
            company_name = (company.get("display_name") or "").strip()
        else:
            company_name = str(company).strip()

        key = dedup_key(title, company_name)
        if key in seen_keys:
            continue
        seen_keys.add(key)

        location = r.get("location", {}) or {}
        if isinstance(location, dict):
            loc_display = location.get("display_name", "")
        else:
            loc_display = str(location)

        salary_min = r.get("salary_min")
        salary_max = r.get("salary_max")
        contract = r.get("contract_type") or r.get("contract_time", "")

        listing = {
            "id": r.get("id", ""),
            "title": title,
            "company": company_name,
            "location": {"display_name": loc_display},
            "description": (r.get("description") or "").strip(),
            "redirect_url": r.get("redirect_url", ""),
            "created": r.get("created", ""),
            "salary_min": salary_min,
            "salary_max": salary_max,
            "contract_type": contract,
            "source": f"adzuna_{country}",
            "_query": query,
        }
        existing.append(listing)
    return existing, seen_keys


# ── Remotive ────────────────────────────────────────────────────────────────

REMOTIVE_BASE = "https://remotive.com/api/remote-jobs"
# Fetch only software-dev and devops categories to avoid irrelevant results
REMOTIVE_CATEGORIES = ["software-dev", "devops"]


def fetch_remotive(profile: dict, notes: list) -> list[dict]:
    """Fetch from Remotive (software-dev + devops categories) for each query."""
    queries = profile.get("search_queries", [])
    all_listings: list[dict] = []
    seen_keys: set = set()
    total_calls = 0

    for category in REMOTIVE_CATEGORIES:
        for query in queries:
            url = f"{REMOTIVE_BASE}?category={category}&search={urllib.parse.quote(query)}"
            data = fetch_json(url)
            total_calls += 1
            if data and isinstance(data, dict) and "jobs" in data:
                for r in data["jobs"]:
                    title = (r.get("title") or "").strip()
                    company_name = (r.get("company_name") or "").strip()

                    key = dedup_key(title, company_name)
                    if key in seen_keys:
                        continue
                    seen_keys.add(key)

                    # Strip HTML from description
                    desc = (r.get("description") or "").strip()
                    desc = re.sub(r"<[^>]+>", " ", desc)
                    desc = re.sub(r"\s+", " ", desc).strip()

                    listing = {
                        "id": str(r.get("id", "")),
                        "title": title,
                        "company": company_name,
                        "location": {"display_name": (r.get("candidate_required_location") or "Remote").strip()},
                        "description": desc,
                        "redirect_url": r.get("url", ""),
                        "created": r.get("publication_date", ""),
                        "salary_min": r.get("salary_min"),
                        "salary_max": r.get("salary_max"),
                        "contract_type": r.get("type", ""),
                        "source": "remotive",
                        "_query": query,
                    }
                    all_listings.append(listing)
            time.sleep(0.3)

    notes.append(f"Remotive: {len(all_listings)} unique listings from {total_calls} API calls (software-dev + devops categories)")
    return all_listings


# ── Remote OK ───────────────────────────────────────────────────────────────

REMOTEOK_BASE = "https://remoteok.io/api"

# Map from normalized query keywords → Remote OK tag names
_REMOTEOK_TAG_MAP = {
    ".net": "dotnet", "dotnet": "dotnet", "net": "dotnet",
    "c#": "csharp",  "csharp": "csharp",
    "c++": "c++",    "cpp": "c++",
    "backend": "backend", "devops": "devops",
    "azure": "azure", "aws": "aws", "gcp": "gcp",
    "docker": "docker", "kubernetes": "kubernetes", "k8s": "kubernetes",
    "microservices": "microservices",
    "sql": "sql", "postgresql": "postgresql", "mysql": "mysql",
    "python": "python", "java": "java", "golang": "golang", "rust": "rust",
    "typescript": "typescript", "javascript": "javascript", "node": "node",
    "api": "api", "rest": "api",
    "react": "react", "angular": "angular", "vue": "vue",
}


def fetch_remoteok(profile: dict, notes: list) -> list[dict]:
    """Fetch from Remote OK using tag-based API calls for precision."""
    queries = profile.get("search_queries", [])
    all_listings: list[dict] = []
    seen_keys: set = set()
    total_calls = 0

    # Build the set of Remote OK tags from profile queries
    tags_to_fetch: list[str] = []
    seen_tags: set[str] = set()
    for q in queries:
        for word in q.lower().split():
            clean = word.strip(".#-/")
            for src, dst in _REMOTEOK_TAG_MAP.items():
                if src in word.lower() and dst not in seen_tags:
                    seen_tags.add(dst)
                    tags_to_fetch.append(dst)

    if not tags_to_fetch:
        notes.append("Remote OK: no matching tags for current queries")
        return []

    for tag in tags_to_fetch[:6]:  # cap at 6 calls to be polite
        url = f"{REMOTEOK_BASE}?tags={urllib.parse.quote(tag)}"
        data = fetch_json(url)
        total_calls += 1
        if not data or not isinstance(data, list):
            time.sleep(0.5)
            continue
        jobs = [j for j in data if isinstance(j, dict) and j.get("position")]
        for r in jobs:
            title = (r.get("position") or "").strip()
            company_name = (r.get("company") or "").strip()
            key = dedup_key(title, company_name)
            if key in seen_keys:
                continue
            seen_keys.add(key)
            desc = re.sub(r"<[^>]+>", " ", (r.get("description") or ""))
            desc = re.sub(r"\s+", " ", desc).strip()
            listing = {
                "id": str(r.get("id", "")),
                "title": title,
                "company": company_name,
                "location": {"display_name": (r.get("location") or "Remote").strip()},
                "description": desc,
                "redirect_url": r.get("url", ""),
                "created": r.get("date", ""),
                "salary_min": None, "salary_max": None,
                "contract_type": "",
                "source": "remoteok",
                "_query": tag,
            }
            all_listings.append(listing)
        time.sleep(0.5)  # Remote OK rate-limit

    notes.append(f"Remote OK: {len(all_listings)} listings from {total_calls} tag queries ({', '.join(tags_to_fetch[:6])})")
    return all_listings


# ── We Work Remotely ─────────────────────────────────────────────────────────

WWR_RSS = "https://weworkremotely.com/remote-jobs.rss"


def fetch_weworkremotely(profile: dict, notes: list) -> list[dict]:
    """Fetch from We Work Remotely RSS feed. Returns normalized listings."""
    import xml.etree.ElementTree as ET
    queries = profile.get("search_queries", [])
    query_words = [q.lower() for q in queries]
    all_listings: list[dict] = []
    seen_keys: set = set()

    req = urllib.request.Request(WWR_RSS, headers={"User-Agent": "ForgeScout/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = resp.read().decode("utf-8", errors="replace")
    except Exception as e:
        notes.append(f"We Work Remotely: fetch failed — {e}")
        return []

    try:
        root = ET.fromstring(body)
    except ET.ParseError as e:
        notes.append(f"We Work Remotely: RSS parse error — {e}")
        return []

    ns = {"content": "http://purl.org/rss/1.0/modules/content/"}
    for item in root.iter("item"):
        title_el = item.find("title")
        title = (title_el.text or "").strip() if title_el is not None else ""
        # WWR titles often are "Company: Role"
        if ":" in title:
            company_name, _, role = title.partition(":")
            company_name = company_name.strip()
            title = role.strip()
        else:
            company_name = ""

        title_lower = title.lower()
        if query_words and not any(
            any(w in title_lower for w in q.split())
            for q in query_words
        ):
            continue

        key = dedup_key(title, company_name)
        if key in seen_keys:
            continue
        seen_keys.add(key)

        link_el = item.find("link")
        url = (link_el.text or "").strip() if link_el is not None else ""
        date_el = item.find("pubDate")
        pub_date = (date_el.text or "").strip() if date_el is not None else ""
        desc_el = item.find("description")
        desc = (desc_el.text or "").strip() if desc_el is not None else ""
        desc = re.sub(r"<[^>]+>", " ", desc)
        desc = re.sub(r"\s+", " ", desc).strip()

        listing = {
            "id": "",
            "title": title,
            "company": company_name,
            "location": {"display_name": "Remote"},
            "description": desc,
            "redirect_url": url,
            "created": pub_date,
            "salary_min": None,
            "salary_max": None,
            "contract_type": "",
            "source": "weworkremotely",
            "_query": ", ".join(queries),
        }
        all_listings.append(listing)

    notes.append(f"We Work Remotely: {len(all_listings)} matching listings")
    return all_listings


# ── Jobicy ────────────────────────────────────────────────────────────────────

JOBICY_BASE = "https://jobicy.com/api/v2/remote-jobs"


def fetch_jobicy(profile: dict, notes: list) -> list[dict]:
    """Fetch from Jobicy for each query. Returns normalized listings."""
    # Same tag map as Remote OK — reuse for consistent normalization
    queries = profile.get("search_queries", [])
    all_listings: list[dict] = []
    seen_keys: set = set()
    total_calls = 0

    for query in queries:
        # Normalize query to a Jobicy-safe tag using the shared tag map
        raw = query.lower().strip()
        # Look for a direct mapping first
        tag = None
        for src, dst in _REMOTEOK_TAG_MAP.items():
            if src in raw:
                tag = dst
                break
        if not tag:
            # Fallback: strip special chars from first word
            raw_tag = query.split()[0] if query.split() else ""
            tag = re.sub(r"[^a-zA-Z0-9\-]", "", raw_tag)
        # Skip tags that are too short (e.g. "C" from "C#")
        if not tag or len(tag) < 2:
            continue
        url = f"{JOBICY_BASE}?count=50&tag={urllib.parse.quote(tag)}"
        data = fetch_json(url)
        total_calls += 1
        if data and isinstance(data, dict) and "jobs" in data:
            for r in data["jobs"]:
                title = (r.get("jobTitle") or r.get("title") or "").strip()
                company_name = (r.get("companyName") or r.get("company") or "").strip()

                key = dedup_key(title, company_name)
                if key in seen_keys:
                    continue
                seen_keys.add(key)

                geo = r.get("jobGeo") or r.get("jobRegion") or "Remote"
                desc = (r.get("jobExcerpt") or r.get("description") or "").strip()
                desc = re.sub(r"<[^>]+>", " ", desc)
                desc = re.sub(r"\s+", " ", desc).strip()

                listing = {
                    "id": str(r.get("id", "")),
                    "title": title,
                    "company": company_name,
                    "location": {"display_name": geo},
                    "description": desc,
                    "redirect_url": r.get("url") or r.get("jobUri", ""),
                    "created": r.get("pubDate", ""),
                    "salary_min": None,
                    "salary_max": None,
                    "contract_type": r.get("jobType", ""),
                    "source": "jobicy",
                    "_query": query,
                }
                all_listings.append(listing)
        time.sleep(0.3)

    notes.append(f"Jobicy: {len(all_listings)} listings from {total_calls} queries")
    return all_listings


# ── Arbeitnow ───────────────────────────────────────────────────────────────
# Free JSON API, no key. ~7 000 jobs (Europe + Remote). Includes Freelance/Contract
# job_types. Endpoint: GET https://www.arbeitnow.com/api/job-board-api?page=N

ARBEITNOW_BASE = "https://www.arbeitnow.com/api/job-board-api"


def fetch_arbeitnow(profile: dict, notes: list) -> list[dict]:
    """Fetch from Arbeitnow (free, no key). Filters by profile queries and job type."""
    queries   = profile.get("search_queries", [])
    max_pages = max(1, min(profile.get("pages", 2), 5))  # cap at 5 pages
    query_lc  = [q.lower() for q in queries]
    all_listings: list[dict] = []
    seen_keys: set = set()
    total_calls = 0

    for page in range(1, max_pages + 1):
        data = fetch_json(f"{ARBEITNOW_BASE}?page={page}")
        total_calls += 1
        if not data or not isinstance(data, dict):
            break
        jobs = data.get("data", [])
        if not jobs:
            break

        for r in jobs:
            title = (r.get("title") or "").strip()
            company_name = (r.get("company_name") or "").strip()

            # Filter by query relevance (title or tags)
            title_lc = title.lower()
            tags_lc  = " ".join(r.get("tags") or []).lower()
            combined = title_lc + " " + tags_lc
            if query_lc and not any(
                any(w in combined for w in q.split())
                for q in query_lc
            ):
                continue

            key = dedup_key(title, company_name)
            if key in seen_keys:
                continue
            seen_keys.add(key)

            desc = re.sub(r"<[^>]+>", " ", (r.get("description") or ""))
            desc = re.sub(r"\s+", " ", desc).strip()

            # Determine contract type from job_types list
            job_types = r.get("job_types") or []
            contract  = ", ".join(job_types) if job_types else ""

            listing = {
                "id": str(r.get("slug", "")),
                "title": title,
                "company": company_name,
                "location": {"display_name": ("Remote" if r.get("remote") else (r.get("location") or ""))},
                "description": desc,
                "redirect_url": r.get("url", ""),
                "created": r.get("created_at", ""),
                "salary_min": None,
                "salary_max": None,
                "contract_type": contract,
                "source": "arbeitnow",
                "_query": ", ".join(queries),
            }
            all_listings.append(listing)
        time.sleep(0.5)

    notes.append(f"Arbeitnow: {len(all_listings)} matching listings from {total_calls} pages")
    return all_listings


# ── GetOnBoard ────────────────────────────────────────────────────────────────
# Chilean tech job board, LATAM-focused. Free JSON API, no key needed.
# Specialises in remote-friendly positions from Latin American companies.
# Apply free at the employer's page — no subscription required.

GETONBOARD_BASE = "https://www.getonbrd.com/api/v0/jobs"


def fetch_getonboard(profile: dict, notes: list) -> list[dict]:
    """Fetch from GetOnBoard (LATAM tech job board, free, no key)."""
    queries  = profile.get("search_queries", [])
    all_listings: list[dict] = []
    seen_keys: set = set()
    total_calls = 0

    for query in queries:
        url = f"{GETONBOARD_BASE}?search={urllib.parse.quote(query)}&per_page=50&expand[]=company"
        req = urllib.request.Request(
            url, headers={"User-Agent": "ForgeScout/1.0", "Accept": "application/json"}
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode("utf-8", errors="replace"))
        except Exception as e:
            notes.append(f"GetOnBoard {query}: {e}")
            continue
        total_calls += 1

        for r in data.get("data", []):
            attrs = r.get("attributes", {})
            title = (attrs.get("title") or "").strip()
            company_info = attrs.get("company") or {}
            company_name = (company_info.get("name") or "").strip()

            key = dedup_key(title, company_name)
            if key in seen_keys:
                continue
            seen_keys.add(key)

            desc = re.sub(r"<[^>]+>", " ", (attrs.get("description") or ""))
            desc = re.sub(r"\s+", " ", desc).strip()
            country = (attrs.get("country") or attrs.get("city") or "LATAM").strip()
            modality = attrs.get("remote_modality") or attrs.get("modality") or ""

            listing = {
                "id": str(r.get("id", "")),
                "title": title,
                "company": company_name,
                "location": {"display_name": country},
                "description": desc,
                "redirect_url": attrs.get("applications_url", ""),
                "created": str(attrs.get("published_at", "")),
                "salary_min": None,
                "salary_max": None,
                "contract_type": modality,
                "source": "getonboard",
                "_query": query,
            }
            all_listings.append(listing)
        time.sleep(0.4)

    notes.append(f"GetOnBoard: {len(all_listings)} LATAM tech listings from {total_calls} queries")
    return all_listings


# ── Himalayas ─────────────────────────────────────────────────────────────────
# Global remote job board with Contractor employment type filter.
# Free JSON API, no key needed. Jobs link directly to company pages (no subscription).

HIMALAYAS_BASE = "https://himalayas.app/jobs/api/search"


def fetch_himalayas(profile: dict, notes: list) -> list[dict]:
    """Fetch from Himalayas (free, no key, contractor-filtered remote jobs)."""
    queries  = profile.get("search_queries", [])
    all_listings: list[dict] = []
    seen_keys: set = set()
    total_calls = 0

    for query in queries[:6]:  # cap to avoid rate-limit
        url = (
            f"{HIMALAYAS_BASE}"
            f"?q={urllib.parse.quote(query)}"
            f"&employment_type=Contractor"
            f"&sort=recent"
        )
        req = urllib.request.Request(
            url, headers={"User-Agent": "ForgeScout/1.0", "Accept": "application/json"}
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode("utf-8", errors="replace"))
        except Exception as e:
            notes.append(f"Himalayas {query}: {e}")
            continue
        total_calls += 1

        for r in (data.get("jobs") or []):
            title = (r.get("title") or "").strip()
            company_name = (r.get("companyName") or "").strip()

            key = dedup_key(title, company_name)
            if key in seen_keys:
                continue
            seen_keys.add(key)

            desc = re.sub(r"<[^>]+>", " ", (r.get("description") or r.get("excerpt") or ""))
            desc = re.sub(r"\s+", " ", desc).strip()
            loc_parts = r.get("locationRestrictions") or []
            loc = ", ".join(loc_parts) if loc_parts else "Remote"

            listing = {
                "id": str(r.get("guid", "")),
                "title": title,
                "company": company_name,
                "location": {"display_name": loc},
                "description": desc,
                "redirect_url": r.get("applicationLink", ""),
                "created": str(r.get("pubDate", "")),
                "salary_min": r.get("minSalary"),
                "salary_max": r.get("maxSalary"),
                "contract_type": r.get("employmentType", "Contractor"),
                "source": "himalayas",
                "_query": query,
            }
            all_listings.append(listing)
        time.sleep(0.4)

    notes.append(f"Himalayas: {len(all_listings)} contractor listings from {total_calls} queries")
    return all_listings


# ── GraphQL Jobs ─────────────────────────────────────────────────────────────
# Free, no key. Tech jobs aggregator. Uses GraphQL but we call it via POST.

GRAPHQLJOBS_URL = "https://api.graphql.jobs/"


def fetch_graphqljobs(profile: dict, notes: list) -> list[dict]:
    """Fetch tech jobs from graphql.jobs (free, no key, GraphQL API)."""
    queries   = profile.get("search_queries", [])
    query_lc  = [q.lower() for q in queries]
    all_listings: list[dict] = []
    seen_keys: set = set()

    gql_query = """
    {
      jobs(input: { first: 200 }) {
        nodes {
          id title slug description
          commitment { title }
          cities { name }
          countries { name isoCode }
          company { name websiteUrl }
          applyUrl
          publishedAt
          isPublished
        }
      }
    }
    """

    payload = json.dumps({"query": gql_query}).encode("utf-8")
    req = urllib.request.Request(
        GRAPHQLJOBS_URL,
        data=payload,
        headers={
            "User-Agent": "ForgeScout/1.0",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            body = resp.read().decode("utf-8", errors="replace")
        data = json.loads(body)
    except Exception as e:
        notes.append(f"GraphQL Jobs: fetch failed — {e}")
        return []

    jobs = (data.get("data") or {}).get("jobs", {}).get("nodes") or []

    for r in jobs:
        if not r.get("isPublished"):
            continue
        title        = (r.get("title") or "").strip()
        company_name = (r.get("company") or {}).get("name", "").strip()

        title_lc = title.lower()
        desc_raw = (r.get("description") or "").strip()
        desc_lc  = re.sub(r"<[^>]+>", " ", desc_raw).lower()
        combined = title_lc + " " + desc_lc

        if query_lc and not any(
            any(w in combined for w in q.split())
            for q in query_lc
        ):
            continue

        key = dedup_key(title, company_name)
        if key in seen_keys:
            continue
        seen_keys.add(key)

        cities    = r.get("cities") or []
        countries = r.get("countries") or []
        loc_parts = [c["name"] for c in cities if c.get("name")] + \
                    [c["name"] for c in countries if c.get("name")]
        location  = ", ".join(loc_parts) if loc_parts else "Remote"

        commitment = (r.get("commitment") or {}).get("title", "")
        desc_clean = re.sub(r"<[^>]+>", " ", desc_raw)
        desc_clean = re.sub(r"\s+", " ", desc_clean).strip()

        listing = {
            "id": str(r.get("id", "")),
            "title": title,
            "company": company_name,
            "location": {"display_name": location},
            "description": desc_clean,
            "redirect_url": r.get("applyUrl") or
                            (r.get("company") or {}).get("websiteUrl", ""),
            "created": str(r.get("publishedAt", "")),
            "salary_min": None,
            "salary_max": None,
            "contract_type": commitment,
            "source": "graphqljobs",
            "_query": ", ".join(queries),
        }
        all_listings.append(listing)

    notes.append(f"GraphQL Jobs: {len(all_listings)} matching tech listings")
    return all_listings


# ── Reed.co.uk ───────────────────────────────────────────────────────────────
# UK job board with explicit contract / temp filter. Free API key required.
# Sign-up: https://www.reed.co.uk/developers/jobseeker
# Auth: HTTP Basic — api_key as username, empty password.

REED_BASE = "https://www.reed.co.uk/api/1.0"


def fetch_reed(profile: dict, notes: list) -> list[dict]:
    """Fetch from Reed.co.uk with contract=true and temp=true filters."""
    env    = load_env()
    api_key = env.get("REED_API_KEY", "")
    if not api_key:
        notes.append("Reed.co.uk: no key (REED_API_KEY) — skipped")
        return []

    queries  = profile.get("search_queries", [])
    max_take = 100  # Reed caps at 100 per call
    # Basic-auth header
    creds    = base64.b64encode(f"{api_key}:".encode()).decode()
    headers  = {"Authorization": f"Basic {creds}", "Accept": "application/json"}

    all_listings: list[dict] = []
    seen_keys: set = set()
    total_calls = 0

    for query in queries:
        for job_type_flag in [("contract", "true"), ("temp", "true")]:
            param_name, param_val = job_type_flag
            url = (
                f"{REED_BASE}/search"
                f"?keywords={urllib.parse.quote(query)}"
                f"&{param_name}={param_val}"
                f"&resultsToTake={max_take}"
            )
            req  = urllib.request.Request(url, headers=headers)
            try:
                with urllib.request.urlopen(req, timeout=15) as resp:
                    data = json.loads(resp.read().decode("utf-8", errors="replace"))
            except Exception as e:
                notes.append(f"Reed {query}/{param_name}: {e}")
                continue
            total_calls += 1

            for r in data.get("results", []):
                title        = (r.get("jobTitle") or "").strip()
                company_name = (r.get("employerName") or "").strip()
                key = dedup_key(title, company_name)
                if key in seen_keys:
                    continue
                seen_keys.add(key)

                contract = "Contract" if param_name == "contract" else "Temporary"
                listing = {
                    "id": str(r.get("jobId", "")),
                    "title": title,
                    "company": company_name,
                    "location": {"display_name": (r.get("locationName") or "").strip()},
                    "description": (r.get("jobDescription") or "").strip(),
                    "redirect_url": r.get("jobUrl") or r.get("externalUrl", ""),
                    "created": str(r.get("date", "")),
                    "salary_min": r.get("minimumSalary"),
                    "salary_max": r.get("maximumSalary"),
                    "contract_type": contract,
                    "source": "reed",
                    "_query": query,
                }
                all_listings.append(listing)
            time.sleep(0.4)

    notes.append(f"Reed.co.uk: {len(all_listings)} contract/temp listings from {total_calls} calls")
    return all_listings


# ── JSearch (RapidAPI) ────────────────────────────────────────────────────────
# Real-time scraper of LinkedIn, Indeed, Glassdoor, ZipRecruiter via RapidAPI.
# Free tier: 200 requests/month. Sign-up: https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch

JSEARCH_URL  = "https://jsearch.p.rapidapi.com/search"
JSEARCH_HOST = "jsearch.p.rapidapi.com"


def fetch_jsearch(profile: dict, notes: list) -> list[dict]:
    """Fetch from JSearch (LinkedIn + Indeed + Glassdoor etc.) via RapidAPI."""
    env     = load_env()
    api_key = env.get("RAPIDAPI_KEY", "")
    if not api_key:
        notes.append("JSearch/RapidAPI: no key (RAPIDAPI_KEY) — skipped")
        return []

    queries  = profile.get("search_queries", [])
    # Build tech queries; add 'remote' to widen reach
    all_listings: list[dict] = []
    seen_keys: set = set()
    total_calls = 0
    headers = {
        "X-RapidAPI-Key":  api_key,
        "X-RapidAPI-Host": JSEARCH_HOST,
        "Accept": "application/json",
    }

    for query in queries[:6]:  # cap at 6 queries to preserve free-tier quota
        url = (
            f"{JSEARCH_URL}"
            f"?query={urllib.parse.quote(query + ' remote')}"
            f"&num_pages=1&page=1"
        )
        req = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                data = json.loads(resp.read().decode("utf-8", errors="replace"))
        except Exception as e:
            notes.append(f"JSearch {query}: {e}")
            continue
        total_calls += 1

        for r in (data.get("data") or []):
            title        = (r.get("job_title") or "").strip()
            company_name = (r.get("employer_name") or "").strip()
            key = dedup_key(title, company_name)
            if key in seen_keys:
                continue
            seen_keys.add(key)

            city    = r.get("job_city") or ""
            country = r.get("job_country") or ""
            loc     = ", ".join(p for p in [city, country] if p) or "Remote"

            desc = (r.get("job_description") or "").strip()
            desc = re.sub(r"\s+", " ", desc)[:2000]  # truncate for storage

            listing = {
                "id": str(r.get("job_id", "")),
                "title": title,
                "company": company_name,
                "location": {"display_name": loc},
                "description": desc,
                "redirect_url": r.get("job_apply_link") or r.get("job_url", ""),
                "created": str(r.get("job_posted_at_datetime_utc", "")),
                "salary_min": r.get("job_min_salary"),
                "salary_max": r.get("job_max_salary"),
                "contract_type": r.get("job_employment_type", ""),
                "source": "jsearch",
                "_query": query,
            }
            all_listings.append(listing)
        time.sleep(0.5)

    notes.append(f"JSearch: {len(all_listings)} listings from {total_calls} queries")
    return all_listings


# ── main ────────────────────────────────────────────────────────────────────

def main():
    profile = load_profile()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    run_id = make_run_id()
    notes: list[str] = []

    print(f"Scout search starting — run_id={run_id}")
    print(f"  queries: {profile.get('search_queries', [])}")
    print(f"  country: {profile.get('country', 'us')}")
    print(f"  pages: {profile.get('pages', 2)}")
    print()

    # Fetch from enabled sources (defaults: adzuna + remotive on, others opt-in)
    sources = profile.get("sources", {})
    use_adzuna         = sources.get("adzuna", True)
    use_remotive       = sources.get("remotive", True)
    use_remoteok       = sources.get("remoteok", False)
    use_weworkremotely = sources.get("weworkremotely", False)
    use_jobicy         = sources.get("jobicy", False)
    use_arbeitnow      = sources.get("arbeitnow", False)
    use_getonboard     = sources.get("getonboard", False)
    use_himalayas      = sources.get("himalayas", False)
    use_graphqljobs    = sources.get("graphqljobs", False)
    use_reed           = sources.get("reed", False)
    use_jsearch        = sources.get("jsearch", False)

    all_fetched: list[dict] = []
    if use_adzuna:
        all_fetched += fetch_adzuna(profile, notes)
    if use_remotive:
        all_fetched += fetch_remotive(profile, notes)
    if use_remoteok:
        all_fetched += fetch_remoteok(profile, notes)
    if use_weworkremotely:
        all_fetched += fetch_weworkremotely(profile, notes)
    if use_jobicy:
        all_fetched += fetch_jobicy(profile, notes)
    if use_arbeitnow:
        all_fetched += fetch_arbeitnow(profile, notes)
    if use_getonboard:
        all_fetched += fetch_getonboard(profile, notes)
    if use_himalayas:
        all_fetched += fetch_himalayas(profile, notes)
    if use_graphqljobs:
        all_fetched += fetch_graphqljobs(profile, notes)
    if use_reed:
        all_fetched += fetch_reed(profile, notes)
    if use_jsearch:
        all_fetched += fetch_jsearch(profile, notes)

    # Merge + dedup across all sources
    all_seen: set = set()
    merged: list[dict] = []
    for listing in all_fetched:
        key = dedup_key(listing.get("title", ""), listing.get("company", ""))
        if key not in all_seen:
            all_seen.add(key)
            merged.append(listing)

    merged = filter_by_selected_countries(merged, selected_country_codes(profile), notes)

    per_source: dict[str, int] = {}
    for l in merged:
        src = l.get("source", "unknown")
        per_source[src] = per_source.get(src, 0) + 1

    # Write output
    output = {
        "run_id": run_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "profile": {
            "country": profile.get("country"),
            "pages": profile.get("pages"),
            "results_per_run": profile.get("results_per_run"),
            "max_days_old": profile.get("max_days_old"),
            "queries": profile.get("search_queries"),
        },
        "listings": merged,
        "per_source": per_source,
        "total_listings": len(merged),
        "notes": notes,
    }

    out_path = OUTPUT_DIR / f"listings_{run_id}.json"
    with open(out_path, "w") as f:
        json.dump(output, f, indent=2, default=str)

    # Summary line
    summary = {
        "run_id": run_id,
        "listings_returned": len(merged),
        "per_source": per_source,
    }
    print("=" * 60)
    print(json.dumps(summary))
    print("=" * 60)
    print(f"Output: {out_path}")
    if notes:
        print("\nNotes:")
        for n in notes:
            print(f"  • {n}")


if __name__ == "__main__":
    main()