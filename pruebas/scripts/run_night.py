"""Night-run orchestrator for Grupo B (pro-usage corpus).

Runs the full pipeline and logs progress + a summary:
    1. crawl_reconz.py   -> pruebas/raw/reconz/{id}.html   (reco.nz, no robots.txt)
    2. crawl_cuberoot.py -> pruebas/raw/cuberoot-recon/    (honors Crawl-delay: 5)
    -- both run CONCURRENTLY (different hosts -> interleaved requests) --
    3. parse_reconz.py   -> pruebas/generated/reconz-solves.json
    4. parse_cuberoot.py -> pruebas/generated/cuberoot-solves.json
    5. summary -> pruebas/generated/grupoB-summary.json + console table

All crawlers are resumable (skip existing files), polite (jittered delays,
UA rotation, backoff, periodic anti-pattern cooldowns).

Usage:
    python scripts/run_night.py                 # full night run (parallel)
    python scripts/run_night.py --demo          # tiny slice to validate pipeline
    python scripts/run_night.py --crawl-only    # skip parsing+summary
"""

import argparse
import json
import os
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)  # pruebas/
GEN = os.path.join(ROOT, "generated")
RAW_RECONZ = os.path.join(ROOT, "raw", "reconz")
RAW_CUBEROOT = os.path.join(ROOT, "raw", "cuberoot-recon")

# Night defaults: gentle pacing with modest parallelism.
# reco.nz has NO robots.txt -> 3 workers at ~1.3 req/s aggregate is safe.
# cuberoot.me Crawl-delay: 5 -> 1 worker strictly honors it.
RECONZ_DELAY = 1.0
RECONZ_JITTER = 0.6
RECONZ_WORKERS = 3
CUBEROOT_DELAY = 5.0
CUBEROOT_JITTER = 1.5
CUBEROOT_WORKERS = 1

# Demo defaults: tiny slice, fast, ignores min-delay floor.
DEMO_RECONZ = (3, 30)
DEMO_CUBEROOT_LIMIT = 5


def run(cmd: list[str]) -> int:
    print("\n=== %s ===" % " ".join(cmd), flush=True)
    t0 = time.time()
    r = subprocess.run([sys.executable] + cmd, cwd=ROOT)
    dt = time.time() - t0
    print("--- finished in %.1fs (exit %d) ---" % (dt, r.returncode), flush=True)
    return r.returncode


def summarize() -> None:
    print("\n=== SUMMARY ===", flush=True)
    summary: dict = {"generated_at": time.strftime("%Y-%m-%d %H:%M:%S")}
    for name, json_name, raw_dir in [
        ("reconz", "reconz-solves.json", RAW_RECONZ),
        ("cuberoot", "cuberoot-solves.json", RAW_CUBEROOT),
    ]:
        html_files = [f for f in os.listdir(raw_dir) if f.endswith(".html")] if os.path.isdir(raw_dir) else []
        summary[name] = {"html_files": len(html_files)}
        jp = os.path.join(GEN, json_name)
        if os.path.exists(jp):
            with open(jp, encoding="utf-8") as f:
                data = json.load(f)
            summary[name]["solves"] = len(data)
            summary[name]["with_solution"] = sum(1 for s in data if s.get("solution") or s.get("steps"))
            summary[name]["with_scramble"] = sum(1 for s in data if s.get("scramble"))
            if name == "cuberoot":
                summary[name]["tags"] = sum(1 for s in data if s.get("tags"))
            if name == "reconz":
                summary[name]["total_steps"] = sum(len(s.get("steps") or []) for s in data)
    os.makedirs(GEN, exist_ok=True)
    with open(os.path.join(GEN, "grupoB-summary.json"), "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=1)
    print(json.dumps(summary, ensure_ascii=False, indent=1), flush=True)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--demo", action="store_true", help="tiny slice to validate the whole pipeline")
    ap.add_argument("--crawl-only", action="store_true", help="skip parsing and summary")
    ap.add_argument("--start", type=int, default=3, help="reco.nz first id")
    ap.add_argument("--end", type=int, default=13450, help="reco.nz last id")
    ap.add_argument("--fast", action="store_true",
                    help="faster night: reco.nz 4 workers + cuberoot 2 workers (still polite; "
                         "each cuberoot worker honors Crawl-delay 5 between ITS requests)")
    args = ap.parse_args()

    if args.demo:
        reconz_args = ["scripts/crawl_reconz.py",
                       "--start", str(DEMO_RECONZ[0]), "--end", str(DEMO_RECONZ[1]),
                       "--delay", "0.2", "--jitter", "0.2", "--workers", "2"]
        cuberoot_args = ["scripts/crawl_cuberoot.py",
                         "--limit", str(DEMO_CUBEROOT_LIMIT),
                         "--delay", "0.2", "--jitter", "0.2", "--no-min", "--workers", "2"]
    else:
        rw = 4 if args.fast else RECONZ_WORKERS
        cw = 2 if args.fast else CUBEROOT_WORKERS
        reconz_args = ["scripts/crawl_reconz.py",
                       "--start", str(args.start), "--end", str(args.end),
                       "--delay", str(RECONZ_DELAY), "--jitter", str(RECONZ_JITTER),
                       "--workers", str(rw)]
        cuberoot_args = ["scripts/crawl_cuberoot.py",
                         "--delay", str(CUBEROOT_DELAY), "--jitter", str(CUBEROOT_JITTER),
                         "--workers", str(cw)]

    if args.fast and not args.demo:
        print("\n>> FAST MODE: reco.nz 4 workers + cuberoot 2 workers\n", flush=True)

    # Run BOTH crawls concurrently: they hit different hosts, so interleaving
    # their requests (while each keeps its own polite pacing + cooldowns) cuts
    # the night from SUM to MAX of the two (~6.2h -> ~3.1h) with the same
    # per-host load. Resumable, so a restarted run just skips what is done.
    print("\n>> Starting both crawls in PARALLEL (reco.nz + cuberoot)\n", flush=True)
    procs = {
        "reconz": subprocess.Popen([sys.executable] + reconz_args, cwd=ROOT),
        "cuberoot": subprocess.Popen([sys.executable] + cuberoot_args, cwd=ROOT),
    }
    rc = {}
    for name, p in procs.items():
        rc[name] = p.wait()
        print(f"--- {name} crawl finished (exit {rc[name]}) ---", flush=True)
    for name, code in rc.items():
        if code != 0:
            print(f"WARNING: {name} crawl had errors (exit {code}), continuing anyway", flush=True)

    if not args.crawl_only:
        run(["scripts/parse_reconz.py"])
        run(["scripts/parse_cuberoot.py"])
        summarize()
    return 0


if __name__ == "__main__":
    sys.exit(main())
