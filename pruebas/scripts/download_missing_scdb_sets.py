"""Download the missing SCDB 3x3 set pages (one-time, low volume, rate-limited).

These are the set index pages (same as the 11 dumps already in raw/scdb).
Missing sets discovered from the 3x3 index: AntiPLL, CLS, ELL, EO4A, FRUF,
SBLS, SV, 1LLL. (VLS/ZBLL/OLLCP/ZBLS dumps already exist but are landing
pages with no cases — the real cases load via per-case pages/AJAX, which the
plan decided NOT to mass-fetch.)
"""
import time

import requests

BASE = "https://speedcubedb.com"
SETS = ["AntiPLL", "CLS", "ELL", "EO4A", "FRUF", "SBLS", "SV", "1LLL"]
HEADERS = {"User-Agent": "Mozilla/5.0 (Cubeforge research; data pipeline; one-time fetch)"}

for s in SETS:
    url = f"{BASE}/a/3x3/{s}"
    out = f"speedcubedb{s}.html"
    try:
        r = requests.get(url, headers=HEADERS, timeout=30)
        r.raise_for_status()
        with open(out, "w", encoding="utf-8") as f:
            f.write(r.text)
        print(f"OK  {s:12s} -> {out} ({len(r.text):,} bytes)")
    except Exception as e:  # noqa: BLE001
        print(f"ERR {s:12s} -> {e}")
    time.sleep(2.5)  # rate limit: be polite, single batch
