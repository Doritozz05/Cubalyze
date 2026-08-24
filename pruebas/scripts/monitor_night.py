"""Live dashboard for the night crawl (Grupo B).

Reads pruebas/generated/night-progress.json (written by crawl_reconz.py and
crawl_cuberoot.py via night_state.report) and renders a progress dashboard
that refreshes every 2 s:

    NOCHE CUBEFORGE  elapsed 00:34:12  (22:01:05)
    [reco.nz  ]  ████████░░░░░░░░ 4.213/13.450  31%  1.21 req/s  ETA 2.1 h  RUNNING
    [cuberoot ]  ███░░░░░░░░░░░░░ 190/1.595    12%  0.18 req/s  ETA 2.2 h  RUNNING
    [TOTAL    ]  ██████░░░░░░░░░░ 4.403/15.045 29%                     ETA 2.1 h

The ETA is derived from the measured average request rate (req/s since the
source started), so it adapts automatically to cooldowns and speed.

Usage:
    python scripts/monitor_night.py          # watch the running night
    python scripts/monitor_night.py --simulate   # demo render without a crawl
"""
import argparse
import json
import os
import sys
import time

STATE_FILE = os.path.join(os.path.dirname(__file__), "..", "generated", "night-progress.json")

BAR_W = 18  # width of the progress bar in characters

SOURCES = [
    ("reconz", "reco.nz  "),
    ("cuberoot", "cuberoot"),
]


def bar(fraction: float, width: int = BAR_W) -> str:
    fraction = max(0.0, min(1.0, fraction))
    filled = int(round(fraction * width))
    return "█" * filled + "░" * (width - filled)


def fmt_count(n) -> str:
    return f"{int(n):,}".replace(",", ".")


def fmt_eta(eta_h) -> str:
    if eta_h is None or eta_h == 0:
        return "  --"
    if eta_h < 0.05:
        return " <1m"
    if eta_h < 1:
        return f" {int(eta_h * 60)}m "
    return f" {eta_h:.1f}h".rjust(4)


def fmt_dur(seconds) -> str:
    seconds = int(seconds)
    h, rem = divmod(seconds, 3600)
    m, s = divmod(rem, 60)
    return f"{h:02d}:{m:02d}:{s:02d}"


def clear() -> None:
    os.system("cls" if os.name == "nt" else "clear")


def render(state: dict, started: float) -> None:
    lines = []
    now = time.time()
    elapsed = now - started
    lines.append("")
    lines.append("  == NOCHE CUBEFORGE ==  elapsed %s  (%s)" % (
        fmt_dur(elapsed), time.strftime("%H:%M:%S")))
    lines.append("")

    total_done = total_all = 0
    etas = []
    for key, label in SOURCES:
        src = state.get("sources", {}).get(key)
        if not src:
            lines.append(f"  [{label}]  {'░' * BAR_W}  --/--  --%  esperando crawl...")
            continue
        done = src.get("done", 0)
        total = src.get("total", 1)
        rate = src.get("rate", 0) or 0
        eta = src.get("eta_h")
        status = src.get("status", "running")
        pct = done / total * 100 if total else 0
        total_done += done
        total_all += total
        if eta:
            etas.append(eta)
        tag = {"running": "RUNNING", "done": "DONE   ", "error": "ERROR  "}.get(status, status.upper())
        lines.append("  [%s]  %s %s/%s  %3d%%  %5.2f req/s  ETA%s  %s" % (
            label, bar(done / total), fmt_count(done), fmt_count(total),
            pct, rate, fmt_eta(eta), tag))

    lines.append("")
    if total_all:
        frac = total_done / total_all
        # Overall ETA: weighted by remaining work at average rate per source
        eta_total = None
        if etas:
            eta_total = max(etas)
        lines.append("  [TOTAL   ]  %s %s/%s  %3d%%                     ETA%s" % (
            bar(frac), fmt_count(total_done), fmt_count(total_all), frac * 100,
            fmt_eta(eta_total)))
    else:
        lines.append("  [TOTAL   ]  sin datos todavía")

    lines.append("")
    lines.append("  Progreso en vivo - ctrl+C para salir (el crawl sigue en su ventana)")
    print("\n".join(lines))


def simulate() -> None:
    """Render a fake slowly-advancing progress so the dashboard can be tested."""
    import random
    reconz = {"total": 13450, "done": 0, "ok": 0, "missing": 0, "errors": 0,
              "skipped": 0, "rate": 0.0, "eta_h": None, "status": "running"}
    cuberoot = {"total": 1595, "done": 0, "ok": 0, "errors": 0,
                "skipped": 0, "rate": 0.0, "eta_h": None, "status": "running"}
    started = time.time()
    t0 = started
    try:
        while True:
            t = time.time() - t0
            reconz["done"] = int(min(13450, 13450 * t / 200))  # ~200 s to finish
            reconz["ok"] = int(reconz["done"] * 0.92)
            reconz["missing"] = reconz["done"] - reconz["ok"]
            reconz["rate"] = reconz["done"] / max(t, 0.1)
            reconz["eta_h"] = (13450 - reconz["done"]) / reconz["rate"] / 3600 if reconz["rate"] else None
            cuberoot["done"] = int(min(1595, 1595 * t / 240))
            cuberoot["ok"] = cuberoot["done"]
            cuberoot["rate"] = cuberoot["done"] / max(t, 0.1)
            cuberoot["eta_h"] = (1595 - cuberoot["done"]) / cuberoot["rate"] / 3600 if cuberoot["rate"] else None
            if reconz["done"] >= 13450:
                reconz["status"] = "done"
            if cuberoot["done"] >= 1595:
                cuberoot["status"] = "done"
            state = {"sources": {"reconz": dict(reconz), "cuberoot": dict(cuberoot)}}
            clear()
            render(state, started)
            time.sleep(0.2)
    except KeyboardInterrupt:
        pass


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--simulate", action="store_true", help="demo render without a crawl")
    ap.add_argument("--interval", type=float, default=2.0, help="refresh seconds")
    args = ap.parse_args()

    # Best-effort UTF-8 output so block characters (█ ░) render on any console.
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass

    if args.simulate:
        simulate()
        return

    started = time.time()
    try:
        while True:
            state = {}
            if os.path.exists(STATE_FILE):
                try:
                    with open(STATE_FILE, encoding="utf-8") as f:
                        state = json.load(f)
                except (OSError, json.JSONDecodeError):
                    state = {}
            clear()
            render(state, started)
            time.sleep(args.interval)
    except KeyboardInterrupt:
        clear()
        print("Monitor detenido. El crawl sigue corriendo en su propia ventana.")


if __name__ == "__main__":
    sys.exit(main())
