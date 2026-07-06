#!/usr/bin/env python3
"""
matcher_score.py — Deterministic job listing scorer.

CLI: matcher_score.py <listings.json> --mode first_cut|final --threshold <N>

Scoring: 4 components (title, skill, seniority, location) with two weightings.
Outputs matches_<run_id>.json with score + per-component breakdown + flags.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from collections import OrderedDict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# ── paths ──────────────────────────────────────────────────────────────────

FORGE_HOME = Path(os.environ.get("FORGE_SYSTEM_DIR") or os.path.expanduser("~/job-hunting/job-hunting-system"))
PROFILE_PATH = FORGE_HOME / "profile" / "profile.json"
OUTPUT_DIR = FORGE_HOME / "agents" / "matcher" / "outputs"

# ── weights ────────────────────────────────────────────────────────────────

WEIGHTS = {
    "first_cut": {"title": 50, "skill": 22, "seniority": 16, "location": 12},
    "final":     {"skill": 42, "title": 34, "seniority": 14, "location": 10},
}

# ── generic / stop-word lists ─────────────────────────────────────────────

SENIORITY_WORDS = {
    "senior", "sr", "jr", "junior", "lead", "principal", "staff", "associate",
    "intern", "internship", "working", "student", "mid", "mid-level", "entry",
    "entry-level", "head", "chief", "vp", "vice", "president", "director",
    "executive", "trainee", "apprentice", "graduate", "fellow", "postdoc",
}

ROLE_NOUNS = {
    "engineer", "developer", "manager", "analyst", "specialist", "supervisor",
    "technician", "scientist", "researcher", "architect", "designer", "consultant",
    "coordinator", "officer", "representative", "assistant", "accountant", "nurse",
    "practitioner", "therapist", "clinician", "auditor", "controller", "programmer",
    "advisor", "agent", "clerk", "secretary", "planner", "inspector", "operator",
    "technologist", "engineer-in-training", "internist", "surgeon", "physician",
    "lecturer", "professor", "teacher", "instructor", "trainer", "coach",
    "librarian", "curator", "broker", "underwriter", "actuary", "paralegal",
    "attorney", "lawyer", "counsel", "therapist", "hygienist", "pharmacist",
    "technographer", "specializer",
}

FORMAT_WORDS = {
    "m/f/d", "mfd", "m/f", "full-time", "part-time", "remote", "hybrid",
    "onsite", "on-site", "gmbh", "ag", "se", "inc", "ltd", "llc", "corp",
    "plc", "sa", "sac", "srl", "bv", "nv", "pty", "pte", "co", "company",
    "corporation", "limited", "global", "international", "group", "solutions",
    "services", "technologies", "systems", "software", "digital", "cloud",
    "data", "ai", "ml", "it", "tech", "sales", "marketing", "support",
    "operations", "finance", "hr", "legal", "medical", "healthcare",
}

ALL_GENERIC = SENIORITY_WORDS | ROLE_NOUNS | FORMAT_WORDS

# ── role families ──────────────────────────────────────────────────────────

ROLE_FAMILIES = [
    {"engineer", "developer", "architect", "programmer", "technician", "technologist"},
    {"scientist", "researcher"},
    {"manager", "supervisor", "lead", "head", "director"},
    {"analyst", "consultant", "coordinator", "planner"},
    {"nurse", "practitioner", "therapist", "clinician"},
    {"accountant", "auditor", "controller", "actuary"},
    {"designer", "artist", "creative", "writer", "editor"},
    {"sales", "representative", "broker", "agent", "account", "executive"},
    {"assistant", "clerk", "secretary", "administrator", "receptionist"},
    {"officer", "specialist", "advisor", "trainer", "instructor", "coach"},
    {"lecturer", "professor", "teacher", "educator"},
    {"attorney", "lawyer", "paralegal", "counsel"},
    {"pharmacist", "physician", "surgeon", "hygienist"},
]


def build_role_family_map() -> dict[str, set[str]]:
    """Map each role noun to its family set."""
    m = {}
    for family in ROLE_FAMILIES:
        for word in family:
            m[word] = family
    return m


ROLE_FAMILY_MAP = build_role_family_map()


# ── token helpers ──────────────────────────────────────────────────────────

def tokenize(text: str) -> list[str]:
    """Lowercase, split on non-alphanumeric, return non-empty tokens."""
    tokens = re.split(r"[^a-z0-9]+", text.lower().strip())
    return [t for t in tokens if t]


def distinctive_tokens(text: str) -> list[str]:
    """Return tokens that are NOT in the generic/stop list."""
    return [t for t in tokenize(text) if t not in ALL_GENERIC]


def role_noun_from_title(title: str) -> str | None:
    """Find the first role noun in a title."""
    tokens = tokenize(title)
    for t in tokens:
        if t in ROLE_NOUNS:
            return t
    return None


def role_family(role_noun: str) -> set[str] | None:
    return ROLE_FAMILY_MAP.get(role_noun)


# ── scoring components ─────────────────────────────────────────────────────

def score_title(job_title: str, profile_titles: list[str]) -> dict:
    """
    Score the title component.

    Returns: {score: 0..1, domain_anchor: bool, wrong_level: bool, 
              generic_tokens: list, distinctive_tokens: list}
    """
    job_tokens = tokenize(job_title)
    job_domain = distinctive_tokens(job_title)

    # Check for wrong-level (intern/working student/apprentice)
    wrong_level = any(t in SENIORITY_WORDS and t in (
        "intern", "internship", "working", "student", "apprentice", "trainee", "graduate", "fellow"
    ) for t in job_tokens)

    if not profile_titles or not job_domain:
        return {"score": 0.0, "domain_anchor": False, "wrong_level": wrong_level,
                "generic_tokens": [t for t in job_tokens if t in ALL_GENERIC],
                "distinctive_tokens": job_domain}

    # Best recall: fraction of any profile title's distinctive tokens found in job title
    best_recall = 0.0
    best_profile_tokens = []
    for pt in profile_titles:
        pt_domain = set(distinctive_tokens(pt))
        if not pt_domain:
            continue
        match_count = sum(1 for t in pt_domain if t in job_domain)
        recall = match_count / len(pt_domain)
        if recall > best_recall:
            best_recall = recall
            best_profile_tokens = list(pt_domain)

    # Precision: how on-domain is the job title itself?
    # fraction of job's distinctive tokens that are also in any profile title's distinctive tokens
    all_profile_domain = set()
    for pt in profile_titles:
        all_profile_domain.update(distinctive_tokens(pt))

    if job_domain:
        on_domain = sum(1 for t in job_domain if t in all_profile_domain)
        precision = 0.5 + 0.5 * (on_domain / len(job_domain))  # range 0.5..1.0
    else:
        precision = 0.5

    # Domain anchor: at least one distinctive token overlap AND recall > 0
    domain_anchor = best_recall > 0.0

    # Role-family conflict penalty
    job_role = role_noun_from_title(job_title)
    conflict_penalty = 1.0
    if job_role:
        job_family = role_family(job_role)
        if job_family is not None:
            # Check if any profile title has a role in the same family
            profile_has_same_family = False
            for pt in profile_titles:
                pt_role = role_noun_from_title(pt)
                if pt_role and pt_role in job_family:
                    profile_has_same_family = True
                    break
            if not profile_has_same_family:
                conflict_penalty = 0.35

    score = best_recall * precision * conflict_penalty
    return {
        "score": round(score, 4),
        "domain_anchor": domain_anchor,
        "wrong_level": wrong_level,
        "recall": round(best_recall, 4),
        "precision": round(precision, 4),
        "conflict_penalty": conflict_penalty,
        "generic_tokens": [t for t in job_tokens if t in ALL_GENERIC],
        "distinctive_tokens": job_domain,
    }


def score_skill(job_title: str, job_snippet: str, scoring_skills: list[str]) -> float:
    """Fraction of scoring_skills present in title + snippet."""
    if not scoring_skills:
        return 0.0

    combined = (job_title + " " + job_snippet).lower()
    hits = 0
    for skill in scoring_skills:
        skill_lower = skill.lower().strip()
        tokens = skill_lower.split()
        if len(tokens) == 1:
            # Single word: check exact word match
            if re.search(r"\b" + re.escape(tokens[0]) + r"\b", combined):
                hits += 1
        else:
            # Multi-word: exact phrase OR ≥60% of meaningful tokens
            if skill_lower in combined:
                hits += 1
            else:
                meaningful = [t for t in tokens if t not in ALL_GENERIC and len(t) > 2]
                if meaningful:
                    found = sum(1 for t in meaningful if re.search(r"\b" + re.escape(t) + r"\b", combined))
                    if found / len(meaningful) >= 0.6:
                        hits += 1

    return hits / len(scoring_skills) if scoring_skills else 0.0


def score_seniority(job_title: str, profile_seniority: str) -> float:
    """Closeness to profile seniority, or 1.0 if 'any'."""
    if profile_seniority == "any":
        return 1.0

    levels = ["junior", "mid", "senior", "lead", "principal", "manager"]
    if profile_seniority not in levels:
        return 0.5

    target_idx = levels.index(profile_seniority)
    job_tokens = tokenize(job_title)

    # Find the highest seniority level mentioned in the job title
    job_level_idx = -1
    for i, level in enumerate(levels):
        if level in job_tokens:
            job_level_idx = max(job_level_idx, i)

    if job_level_idx == -1:
        # No seniority mentioned → assume mid-level
        job_level_idx = 1

    # Distance penalty
    dist = abs(target_idx - job_level_idx)
    if dist == 0:
        return 1.0
    elif dist == 1:
        return 0.7
    elif dist == 2:
        return 0.4
    else:
        return 0.2


def score_location(job_location: str, profile_country: str) -> float:
    """Full credit when search is already scoped to profile.country."""
    # Always return 1.0 since the search is scoped to the country
    return 1.0


# ── main scoring function ─────────────────────────────────────────────────

def score_listing(listing: dict, profile: dict, mode: str) -> dict:
    """Score a single listing. Returns {score, breakdown, flags}."""
    weights = WEIGHTS[mode]
    title = listing.get("title", "")
    snippet = listing.get("description", "")[:300]  # truncated snippet
    profile_titles = profile.get("target_titles", [])
    scoring_skills = profile.get("scoring_skills", [])
    profile_seniority = profile.get("seniority", "senior")
    job_location = listing.get("location", {}).get("display_name", "")
    profile_country = profile.get("country", "us")

    # Title
    title_result = score_title(title, profile_titles)
    title_score = title_result["score"]

    # Skill
    skill_score = score_skill(title, snippet, scoring_skills)

    # Seniority
    seniority_score = score_seniority(title, profile_seniority)

    # Location
    location_score = score_location(job_location, profile_country)

    # Guards
    domain_anchor = title_result["domain_anchor"] or (skill_score > 0)
    wrong_level = title_result["wrong_level"]

    # Relevance gate
    if not domain_anchor:
        # Cap at ~38% of max possible (which is 100, but this is component scores)
        # After applying weight, max is 100. Cap at 38.
        max_possible = sum(weights.values())
        cap = 38
    else:
        cap = 100

    # Wrong-level filter
    level_multiplier = 1.0
    if wrong_level and profile_seniority in ("senior", "lead", "principal", "manager"):
        level_multiplier = 0.35

    # Compute final score
    raw = (
        title_score * weights["title"]
        + skill_score * weights["skill"]
        + seniority_score * weights["seniority"]
        + location_score * weights["location"]
    ) * level_multiplier

    total = min(raw, cap)

    return {
        "score": round(total, 1),
        "breakdown": {
            "title": round(title_score * weights["title"], 1),
            "skill": round(skill_score * weights["skill"], 1),
            "seniority": round(seniority_score * weights["seniority"], 1),
            "location": round(location_score * weights["location"], 1),
        },
        "flags": {
            "domain_anchor": domain_anchor,
            "wrong_level": wrong_level,
            "level_multiplier": level_multiplier,
            "capped": not domain_anchor,
        },
        "title_detail": {
            "recall": title_result.get("recall", 0),
            "precision": title_result.get("precision", 0),
            "conflict_penalty": title_result.get("conflict_penalty", 1),
            "distinctive_tokens": title_result.get("distinctive_tokens", []),
            "generic_tokens": title_result.get("generic_tokens", []),
        },
        "skill_matches": {
            "count": scoring_skills,
            "fraction": round(skill_score, 4),
        },
    }


# ── CLI ────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Deterministic job listing scorer")
    parser.add_argument("listings_file", help="Path to listings JSON file")
    parser.add_argument("--mode", choices=["first_cut", "final"], default="first_cut")
    parser.add_argument("--threshold", type=int, default=50, help="Minimum score to pass")
    args = parser.parse_args()

    # Load profile
    if not PROFILE_PATH.exists():
        print(f"Profile not found: {PROFILE_PATH}", file=sys.stderr)
        sys.exit(1)
    with open(PROFILE_PATH) as f:
        profile = json.load(f)

    # Load listings
    with open(args.listings_file) as f:
        data = json.load(f)

    listings = data.get("listings", [])
    run_id = data.get("run_id", f"run_{datetime.now().strftime('%Y%m%d_%H%M%S')}")

    print(f"Scoring {len(listings)} listings in {args.mode} mode, threshold={args.threshold}")
    print(f"  profile: {profile.get('target_titles', [])}")
    print(f"  scoring_skills: {profile.get('scoring_skills', [])}")
    print(f"  seniority: {profile.get('seniority', 'senior')}")
    print()

    # Score all listings
    scored = []
    for listing in listings:
        result = score_listing(listing, profile, args.mode)
        scored.append({
            "listing": listing,
            "score": result["score"],
            "breakdown": result["breakdown"],
            "flags": result["flags"],
            "title_detail": result["title_detail"],
            "skill_matches": result["skill_matches"],
        })

    # Sort high→low, filter by threshold
    scored.sort(key=lambda x: x["score"], reverse=True)
    passed = [s for s in scored if s["score"] >= args.threshold]

    # Write output
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUTPUT_DIR / f"matches_{run_id}.json"
    output = {
        "run_id": run_id,
        "mode": args.mode,
        "threshold": args.threshold,
        "total_listings": len(listings),
        "passed_threshold": len(passed),
        "matches": passed,
    }
    with open(out_path, "w") as f:
        json.dump(output, f, indent=2, default=str)

    print(f"Results: {len(passed)}/{len(listings)} passed threshold ({args.threshold})")
    print(f"  Top score: {passed[0]['score'] if passed else 'N/A'}")
    print(f"  Bottom score (passed): {passed[-1]['score'] if passed else 'N/A'}")
    print(f"Output: {out_path}")

    # Upsert passing listings into job store
    sys.path.insert(0, str(FORGE_HOME / "pipeline"))
    from job_store import upsert_seen, summary as store_summary
    new_count = 0
    seen_count = 0
    for m in passed:
        is_new = upsert_seen(m["listing"], run_id, m["score"], "matched")
        if is_new:
            new_count += 1
        else:
            seen_count += 1
    print(f"Job store: {new_count} new + {seen_count} previously seen = {len(passed)} upserted")
    s = store_summary()
    print(f"  Total known: {s['total']}  |  By status: {s['by_status']}")
    print()

    # Show top 10
    print("=" * 80)
    print("TOP 10 MATCHES")
    print("=" * 80)
    for i, m in enumerate(passed[:10]):
        l = m["listing"]
        flags = m["flags"]
        flag_str = []
        if flags.get("capped"): flag_str.append("CAPPED")
        if flags.get("wrong_level"): flag_str.append("WRONG-LEVEL")
        if flags.get("level_multiplier", 1) < 1: flag_str.append(f"x{flags['level_multiplier']}")
        fstr = f" [{' '.join(flag_str)}]" if flag_str else ""
        print(f"  {i+1:2d}. {m['score']:5.1f}{fstr}  {l['title']} @ {l['company']}")
        print(f"        title={m['breakdown']['title']:.1f} skill={m['breakdown']['skill']:.1f} "
              f"seniority={m['breakdown']['seniority']:.1f} loc={m['breakdown']['location']:.1f} "
              f"| tokens={m['title_detail']['distinctive_tokens']}")
        if i < 4:
            print()

    # Show bottom 5 of passed
    if len(passed) > 10:
        print("\n" + "=" * 80)
        print("BOTTOM 5 (PASSED)")
        print("=" * 80)
        for m in passed[-5:]:
            l = m["listing"]
            print(f"  {m['score']:5.1f}  {l['title']} @ {l['company']}")

    # Show first 5 that failed (just below threshold)
    failed = [s for s in scored if s["score"] < args.threshold]
    if failed:
        print("\n" + "=" * 80)
        print(f"FIRST 5 FAILED (just below {args.threshold})")
        print("=" * 80)
        for m in failed[:5]:
            l = m["listing"]
            print(f"  {m['score']:5.1f}  {l['title']} @ {l['company']}  "
                  f"anchor={m['flags']['domain_anchor']} "
                  f"tokens={m['title_detail']['distinctive_tokens']}")


if __name__ == "__main__":
    main()