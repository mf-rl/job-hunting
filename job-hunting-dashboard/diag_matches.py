#!/usr/bin/env python3
"""Diagnose why non-Adzuna jobs don't show in the dashboard table."""
import json
from pathlib import Path

FORGE_HOME = Path("/home/mfrl/job-hunting/job-hunting-system")

# 1. Latest matches file — score distribution by source
matcher_dir = FORGE_HOME / "agents/matcher/outputs"
files = sorted(matcher_dir.glob("matches_*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
if not files:
    print("No matcher file found"); exit(1)

data = json.loads(files[0].read_text())
matches = data.get("matches", [])
print(f"File: {files[0].name}  total={len(matches)}")

# Group by source + show score ranges
by_source = {}
for i, m in enumerate(matches):
    src = m.get("listing", {}).get("source", "unknown")
    score = m.get("score", 0)
    if src not in by_source:
        by_source[src] = []
    by_source[src].append((i + 1, score))  # rank + score

print("\n=== Match distribution by source (rank = position in file) ===")
for src, entries in sorted(by_source.items()):
    ranks = [e[0] for e in entries]
    scores = [e[1] for e in entries]
    print(f"  {src:25s}  count={len(entries):3d}  "
          f"ranks={min(ranks)}-{max(ranks)}  "
          f"score={min(scores):.1f}-{max(scores):.1f}  "
          f"in_top100={'YES' if min(ranks) <= 100 else 'NO'}")

# 2. Show what the top 100 matches look like (source breakdown)
top100_sources = {}
for m in matches[:100]:
    src = m.get("listing", {}).get("source", "unknown")
    top100_sources[src] = top100_sources.get(src, 0) + 1
print("\n=== Source breakdown of top 100 matches ===")
for src, cnt in sorted(top100_sources.items(), key=lambda x: -x[1]):
    print(f"  {src:25s}  {cnt}")

# 3. Activity stream — scout entries
print("\n=== Scout activity log entries (all time) ===")
import sqlite3
conn = sqlite3.connect(str(FORGE_HOME.parent / ".hermes/agent-logs.db"))
conn.row_factory = sqlite3.Row
rows = conn.execute(
    "SELECT agent_name, task_description, status, created_at FROM agent_logs "
    "WHERE agent_name='scout' ORDER BY created_at DESC LIMIT 10"
).fetchall()
for r in rows:
    print(f"  [{r['status']:10s}] {r['created_at']}  {r['task_description'][:80]}")
conn.close()
