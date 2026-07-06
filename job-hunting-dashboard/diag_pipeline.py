#!/usr/bin/env python3
import json, sqlite3
from pathlib import Path

FORGE_HOME = Path("/home/mfrl/job-hunting/job-hunting-system")
HERMES_HOME = Path("/home/mfrl/.hermes")

# 1. Latest scan file
scout_files = sorted(
    (FORGE_HOME / "agents/scout/outputs").glob("listings_*.json"),
    key=lambda p: p.stat().st_mtime, reverse=True
)
if scout_files:
    d = json.loads(scout_files[0].read_text())
    print(f"Latest scout file: {scout_files[0].name}")
    print(f"  per_source: {d.get('per_source')}")
    print(f"  total: {d.get('total_listings')}")
    print(f"  notes: {d.get('notes')}")

# 2. Latest matcher
matcher_files = sorted(
    (FORGE_HOME / "agents/matcher/outputs").glob("matches_*.json"),
    key=lambda p: p.stat().st_mtime, reverse=True
)
if matcher_files:
    d2 = json.loads(matcher_files[0].read_text())
    matches = d2.get("matches", [])
    per_source = {}
    for m in matches:
        src = m.get("listing", {}).get("source", "?")
        per_source[src] = per_source.get(src, 0) + 1
    print(f"\nLatest matcher file: {matcher_files[0].name}")
    print(f"  matched per_source: {per_source}")
    print(f"  total matched: {len(matches)}")

# 3. Recent agent_logs entries
conn = sqlite3.connect(str(HERMES_HOME / "agent-logs.db"))
conn.row_factory = sqlite3.Row
rows = conn.execute(
    "SELECT agent_name, task_description, status, created_at FROM agent_logs ORDER BY created_at DESC LIMIT 20"
).fetchall()
print("\nLast 20 agent_logs entries:")
for r in rows:
    print(f"  [{r['agent_name']:12}] {r['status']:10} {r['created_at']} | {r['task_description'][:70]}")
conn.close()
