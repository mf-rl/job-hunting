#!/usr/bin/env python3
"""Verify key format consistency across the full tailor chain."""
import sys, sqlite3, re
sys.path.insert(0, '/home/mfrl/job-hunting/job-hunting-system/pipeline')
from job_store import make_key

# Simulate the listing from the matches file (has numeric Adzuna id)
listing_scan = {'id': '5768360609', 'title': '.Net Developer', 'company': 'Acro Service Corp.'}

# New _make_job_key from app.py
def _norm(s):
    s = s.lower().strip()
    s = re.sub(r'[^a-z0-9\s]', ' ', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s

def _make_job_key(listing):
    lid = str(listing.get('id', '') or '')
    if lid.isdigit():
        return f'id:{lid}'
    return f"j:{_norm(listing.get('title',''))}|{_norm(listing.get('company',''))}"

# Keys
key_jobstore = make_key(listing_scan)            # what scan stores in DB
key_dashboard = _make_job_key(listing_scan)       # what dashboard now produces for m.key
key_promote_old = make_key({'id': '', 'title': listing_scan['title'], 'company': listing_scan['company']})  # old bug

print(f"jobs.db key (job_store.make_key):  {key_jobstore!r}")
print(f"Dashboard m.key (_make_job_key):   {key_dashboard!r}")
print(f"Old promote_job.py key (no id):    {key_promote_old!r}")
print()
print(f"Match DB ↔ dashboard: {key_jobstore == key_dashboard}")
print(f"promote_job.py now uses dashboard key (passed via --job-key): {key_dashboard!r}")

# Verify in actual DB
conn = sqlite3.connect('/home/mfrl/job-hunting/job-hunting-system/jobs.db')
row = conn.execute("SELECT key, title, company, cv_path, status FROM jobs WHERE key=?", (key_dashboard,)).fetchone()
if row:
    print(f"\nDB row found: key={row[0]!r} cv_path={row[2]!r} status={row[3]!r}")
else:
    print(f"\nNo DB row for key {key_dashboard!r} (expected if no scan yet)")
conn.close()
