"""Crawler for reco.nz solve pages (Grupo B, fuente B3).

Downloads https://reco.nz/solve/{id} for a range of sequential IDs into
pruebas/raw/reconz/{id}.html. Polite: each worker paces itself with jittered
delays + UA rotation + backoff (scrape_polite.py) and the pool pauses for
anti-pattern cooldowns every COOLDOWN_EVERY requests. Resumable: skips
existing files. A modest number of workers speeds up the night run without
hammering (reco.nz has NO robots.txt -> no declared rate limit; keep the
aggregate rate ~2-3 req/s with 3 workers).

Usage:
    python pruebas/scripts/crawl_reconz.py --start 3 --end 13450 --workers 3
    python pruebas/scripts/crawl_reconz.py --start 3 --end 30 --workers 1 --delay 0.2 --jitter 0.2

Notes:
    - reco.nz has NO robots.txt and no API; sequential IDs ~3..13450 exist.
    - Raw HTML is kept ONLY as an auditable source in pruebas/ (gitignored).
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

BASE = "https://reco.nz/solve/{}"
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "raw", "reconz")

COOLDOWN_EVERY = 200    # pause every N requests (anti-pattern)
COOLDOWN_S = (20, 45)   # random pause window in seconds


def make_worker(out_dir, delay, jitter, force, state, lock):
    def worker(i: int) -> str:
        out = os.path.join(out_dir, f"{i}.html")
        if os.path.exists(out) and not force:
            with lock:
                state["skipped"] += 1
            return "skip"  # already downloaded: resume is instant, no request
        polite_sleep(delay, jitter)  # pace BEFORE the request, per worker
        r = fetch(BASE.format(i))
        with lock:
            if r is None:
                state["errors"] += 1
                return "error"
            if r.status_code == 200:
                with open(out, "w", encoding="utf-8") as f:
                    f.write(r.text)
                state["ok"] += 1
                return "ok"
            if r.status_code == 404:
                state["missing"] += 1
                return "missing"
            state["errors"] += 1
            return f"http{r.status_code}"
    return worker


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--start", type=int, default=3)
    ap.add_argument("--end", type=int, default=13450)
    ap.add_argument("--workers", type=int, default=3,
                    help="parallel workers (1 = strictly sequential)")
    ap.add_argument("--delay", type=float, default=1.0)
    ap.add_argument("--jitter", type=float, default=0.6)
    ap.add_argument("--force", action="store_true", help="redownload existing files")
    args = ap.parse_args()

    os.makedirs(OUT_DIR, exist_ok=True)
    log = setup_logger("crawl_reconz")

    ids = list(range(args.start, args.end + 1))
    state = {"ok": 0, "missing": 0, "errors": 0, "skipped": 0}
    lock = threading.Lock()
    done = 0
    t0 = time.time()
    last_report = 0.0

    report("reconz", status="running", start=args.start, end=args.end,
           total=len(ids), done=0, ok=0, missing=0, errors=0, skipped=0,
           rate=0.0, eta_h=None)

    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
        worker = make_worker(OUT_DIR, args.delay, args.jitter, args.force, state, lock)
        futs = {pool.submit(worker, i): i for i in ids}
        for fut in as_completed(futs):
            fut.result()  # propagate exceptions
            done += 1
            now = time.time()
            if done % COOLDOWN_EVERY == 0:
                pause = random.uniform(*COOLDOWN_S)
                with lock:
                    log.info("id-range %d-%d: %d done (ok=%d missing=%d errors=%d skipped=%d) "
                             "cooldown %.0fs", args.start, args.end, done,
                             state["ok"], state["missing"], state["errors"], state["skipped"], pause)
                time.sleep(pause)
            elif done % 200 == 0 or now - last_report >= 10:
                rate = done / max(now - t0, 0.1)
                eta = (len(ids) - done) / rate / 3600 if rate > 0 else None
                last_report = now
                log.info("id-range %d-%d: %d/%d done (%.1f req/s, eta %.1fh)",
                         args.start, args.end, done, len(ids), rate, eta)
                with lock:
                    report("reconz", status="running", start=args.start, end=args.end,
                           total=len(ids), done=done, ok=state["ok"], missing=state["missing"],
                           errors=state["errors"], skipped=state["skipped"],
                           rate=rate, eta_h=eta)

    with lock:
        report("reconz", status="done", start=args.start, end=args.end,
               total=len(ids), done=len(ids), ok=state["ok"], missing=state["missing"],
               errors=state["errors"], skipped=state["skipped"], rate=0.0, eta_h=0.0)
        log.info("DONE ok=%d missing=%d errors=%d skipped=%d",
                 state["ok"], state["missing"], state["errors"], state["skipped"])


if __name__ == "__main__":
    sys.exit(main())
