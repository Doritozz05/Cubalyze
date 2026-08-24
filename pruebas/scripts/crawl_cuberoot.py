"""Crawler for cuberoot.me /recon pages (Grupo B, fuente B4).

Downloads every URL in pruebas/generated/cuberoot-recon-urls.txt (extracted
from the official recon-sitemap.xml) into
pruebas/raw/cuberoot-recon/{slug}.html.

Politeness: robots.txt of cuberoot.me allows /recon* for regular bots and sets
`Crawl-delay: 5`. The default is 1 worker pacing 5s+jitter, which honors that
strictly (each worker waits >=5s between its own requests; with --workers > 1
the aggregate rate rises but every single worker still obeys the delay).

Usage:
    python pruebas/scripts/crawl_cuberoot.py
    python pruebas/scripts/crawl_cuberoot.py --workers 2 --delay 5.0 --jitter 1.5
    python pruebas/scripts/crawl_cuberoot.py --limit 5 --delay 0.2 --jitter 0.2 --no-min
"""
import argparse
import os
import random
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

from night_state import report
from scrape_polite import fetch, polite_sleep, setup_logger

URLS_FILE = os.path.join(os.path.dirname(__file__), "..", "generated", "cuberoot-recon-urls.txt")
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "raw", "cuberoot-recon")

COOLDOWN_EVERY = 200    # pause every N requests (anti-pattern)
COOLDOWN_S = (20, 45)   # random pause window in seconds


def make_worker(out_dir, delay, jitter, force, state, lock):
    def worker(url: str) -> str:
        slug = url.split("/recon/")[-1].rstrip("/")
        out = os.path.join(out_dir, f"{slug}.html")
        if os.path.exists(out) and not force:
            with lock:
                state["skipped"] += 1
            return "skip"  # already downloaded: resume is instant, no request
        polite_sleep(delay, jitter)  # pace BEFORE the request, per worker
        r = fetch(url)
        with lock:
            if r is None or r.status_code != 200:
                state["errors"] += 1
                return "error"
            with open(out, "w", encoding="utf-8") as f:
                f.write(r.text)
            state["ok"] += 1
            return "ok"
    return worker


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--workers", type=int, default=1,
                    help="parallel workers (default 1: strictly honors Crawl-delay 5)")
    ap.add_argument("--delay", type=float, default=5.0,
                    help="base delay in seconds (robots crawl-delay is 5)")
    ap.add_argument("--jitter", type=float, default=1.5)
    ap.add_argument("--min-delay", type=float, default=3.0,
                    help="floor for the effective delay (never faster than this)")
    ap.add_argument("--no-min", action="store_true", help="ignore the min-delay floor")
    ap.add_argument("--force", action="store_true", help="redownload existing files")
    ap.add_argument("--limit", type=int, default=0, help="only crawl the first N URLs (testing)")
    args = ap.parse_args()

    if not os.path.exists(URLS_FILE):
        print(f"URL list not found: {URLS_FILE}\nRun: curl -s 'https://cuberoot.me/recon-sitemap.xml' ... first")
        return 1
    with open(URLS_FILE, encoding="utf-8") as f:
        urls = [l.strip() for l in f if l.strip()]
    if args.limit > 0:
        urls = urls[: args.limit]

    os.makedirs(OUT_DIR, exist_ok=True)
    log = setup_logger("crawl_cuberoot")
    delay = max(args.delay, args.min_delay) if not args.no_min else args.delay

    state = {"ok": 0, "errors": 0, "skipped": 0}
    lock = threading.Lock()
    done = 0
    t0 = time.time()
    total = len(urls)
    last_report = 0.0

    report("cuberoot", status="running", total=total, done=0, ok=0, errors=0,
           skipped=0, rate=0.0, eta_h=None)

    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
        worker = make_worker(OUT_DIR, delay, args.jitter, args.force, state, lock)
        futs = {pool.submit(worker, u): u for u in urls}
        for fut in as_completed(futs):
            fut.result()  # propagate exceptions
            done += 1
            now = time.time()
            if done % COOLDOWN_EVERY == 0:
                pause = random.uniform(*COOLDOWN_S)
                with lock:
                    log.info("urls %d/%d done (ok=%d errors=%d skipped=%d) cooldown %.0fs",
                             done, total, state["ok"], state["errors"], state["skipped"], pause)
                time.sleep(pause)
            elif done % 100 == 0 or now - last_report >= 10:
                rate = done / max(now - t0, 0.1)
                eta = (total - done) / rate / 3600 if rate > 0 else None
                last_report = now
                log.info("urls %d/%d done (%.1f req/s, eta %.1fh)", done, total, rate, eta)
                with lock:
                    report("cuberoot", status="running", total=total, done=done,
                           ok=state["ok"], errors=state["errors"], skipped=state["skipped"],
                           rate=rate, eta_h=eta)

    with lock:
        report("cuberoot", status="done", total=total, done=total,
               ok=state["ok"], errors=state["errors"], skipped=state["skipped"],
               rate=0.0, eta_h=0.0)
        log.info("DONE ok=%d errors=%d skipped=%d", state["ok"], state["errors"], state["skipped"])


if __name__ == "__main__":
    sys.exit(main())
