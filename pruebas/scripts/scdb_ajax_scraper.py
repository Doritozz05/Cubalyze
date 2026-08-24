#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scdb_ajax_scraper.py — Downloads the SpeedCubeDB algorithm long-tail.

The static HTML only contains the Standard Alg + the most-voted alternatives
(4-5 per case). The rest is loaded via AJAX when pressing "More Algorithms":

    GET https://speedcubedb.com/category.algs.php?algname=<case>&d=<slot>&cat=<cat>

SCDB's JS (category.js) calls this endpoint with the data-algname / data-d /
data-category of each .more-algs button. This script:

  1. Scans the already-downloaded static HTML (pruebas/raw/scdb/) extracting
     the .more-algs buttons → (cat, algname, d).
  2. Downloads each endpoint politely (User-Agent, delay, retry).
  3. Saves the responses in pruebas/raw/scdb/ajax/<cat>/<algname>__d<d>.html

Usage:
    python scdb_ajax_scraper.py [--limit N] [--out raw/scdb/ajax] [--delay 0.6]
"""
from __future__ import annotations

import argparse
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]  # pruebas/
RAW = ROOT / "raw" / "scdb"

BASE_URL = "https://speedcubedb.com/category.algs.php"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")

STATIC_FILES = {
    "PLL": "speedcubedbpll.html",
    "OLL": "speedcubedboll.html",
    "AdvancedF2L": "speedcubedbadvancedf2l.html",
}


def extract_endpoints() -> list[tuple[str, str, str]]:
    """Returns [(cat, algname, d)] from the static HTML files."""
    endpoints: list[tuple[str, str, str]] = []
    for cat, fname in STATIC_FILES.items():
        path = RAW / fname
        if not path.exists():
            print(f"  [SKIP] missing {path}")
            continue
        content = path.read_text(encoding="utf-8", errors="ignore")
        # The more-algs buttons carry data-category / data-d / data-algname
        found = re.findall(
            r"data-category='([^']*)' data-d='([^']*)' data-algname='([^']*)'",
            content,
        )
        if not found:
            found = re.findall(
                r"data-algname='([^']*)'[^>]*data-d='([^']*)'[^>]*data-category='([^']*)'",
                content,
            )
            found = [(c, d, a) for a, d, c in found]
        # Deduplicate (AF2L has 4 buttons per case, one per d)
        seen = set()
        for c, d, a in found:
            key = (c, a, d)
            if key not in seen:
                seen.add(key)
                endpoints.append(key)
        print(f"  {cat}: {len(found)} buttons → {len(seen)} unique endpoints")
    return endpoints


def fetch(url: str, retries: int = 3) -> bytes | None:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for attempt in range(1, retries + 1):
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return resp.read()
        except Exception as exc:  # noqa: BLE001
            print(f"    [retry {attempt}/{retries}] {exc}")
            time.sleep(1.5 * attempt)
    return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0, help="max endpoints to download (0 = all)")
    ap.add_argument("--out", default=str(RAW / "ajax"))
    ap.add_argument("--delay", type=float, default=0.6, help="seconds between requests")
    args = ap.parse_args()

    endpoints = extract_endpoints()
    print(f"Total endpoints: {len(endpoints)}")
    if args.limit:
        endpoints = endpoints[: args.limit]

    out_root = Path(args.out)
    out_root.mkdir(parents=True, exist_ok=True)

    ok = fail = 0
    for i, (cat, algname, d) in enumerate(endpoints, 1):
        cat_dir = out_root / cat
        cat_dir.mkdir(parents=True, exist_ok=True)
        fname = f"{algname}__d{d}.html"
        out_path = cat_dir / fname
        if out_path.exists() and out_path.stat().st_size > 500:
            continue  # already downloaded

        qs = urllib.parse.urlencode({"algname": algname, "d": d, "cat": cat})
        url = f"{BASE_URL}?{qs}"
        data = fetch(url)
        if data is None:
            fail += 1
            print(f"  [{i}/{len(endpoints)}] ✗ {cat}/{fname}")
            continue
        out_path.write_bytes(data)
        ok += 1
        print(f"  [{i}/{len(endpoints)}] ✓ {cat}/{fname} ({len(data)} bytes)")
        time.sleep(args.delay)

    print(f"\nDone: {ok} downloaded, {fail} failed (of {len(endpoints)})")
    return 0 if fail == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
