"""Parser for reco.nz solve pages (Grupo B, fuente B3).

Reads pruebas/raw/reconz/{id}.html and writes
pruebas/generated/reconz-solves.json with the normalized structure:

    {
      "id": 12033,
      "solver": "Yiheng Wang",
      "time": 3.83,
      "puzzle": "3x3",                 // from the title ("3x3", "5x5", "OH", ...)
      "record": "WR",                  // [WR]/[NR]/[CR]/[PR] tag, if any
      "date": "2025-07-26",
      "competition": "Taizhou Open 2025",
      "reconstructor": "Stewy",
      "scramble": "L2 B2 U ...",
      "steps": [ {"moves": "R D2 U' l U' l' U D", "comment": "xcross"}, ... ],
      "stats": { "Time":  {"Total": 3.83, ...}, "STM": {...}, ... }
    }

Usage:
    python pruebas/scripts/parse_reconz.py [--out pruebas/generated/reconz-solves.json]
"""
import argparse
import glob
import json
import os
import re

RAW_DIR = os.path.join(os.path.dirname(__file__), "..", "raw", "reconz")

TITLE_RE = re.compile(r"<title>([^<]+)</title>")
SOLVER_RE = re.compile(r'id="solver-link">([^<]+)</a>')
HEADER_RE = re.compile(r"<h3>(.*?)</h3>", re.S)
RECONSTRUCTOR_RE = re.compile(r'reconstruction by <a href="[^"]*" id="reconstructor-link">([^<]+)</a>')
# The #reconstruction div: scramble on its own line first, then step lines
# "MOVES // comment". Everything is one line in the raw HTML.
RECON_RE = re.compile(
    r'<div id="reconstruction">\s*(.*?)\s*</div>', re.S
)
STEP_LINE_RE = re.compile(r"^\s*(.+?)(?://\s*(.*?))?<br\s*/?>\s*$")

STATS_LABELS = {"Time", "Split", "STM", "STPS", "ETM", "ETPS"}
STATS_COLS = ["Total", "F2L", "LL", "Cross+1", "OLS", "PLL"]


def parse_page(path: str) -> dict | None:
    src = open(path, encoding="utf-8", errors="ignore").read()

    m = TITLE_RE.search(src)
    if not m:
        return None
    title = m.group(1).strip().removesuffix(" - reco.nz")
    # "Yiheng Wang - 3.83 3x3 solve"
    parts = title.split(" - ")
    if len(parts) < 2:
        return None
    solver = parts[0].strip()
    rest = " - ".join(parts[1:])
    time_m = re.match(r"([\d.]+)\s+([\w+×]+)\s+solve", rest)
    if not time_m:
        return None
    time = float(time_m.group(1))
    puzzle = time_m.group(2)

    m = SOLVER_RE.search(src)
    if m:
        solver = m.group(1).strip()

    record = None
    date = None
    competition = None
    reconstructor = None
    h3 = HEADER_RE.search(src)
    if h3:
        htxt = re.sub(r"<[^>]+>", " ", h3.group(1)).strip()
        rm = re.search(r"\[(WR|NR|CR|PR|NAR|SAR|EAR|AFR|OAR|AsR|ER|WRs)\s*\]", htxt)
        if rm:
            record = rm.group(1)
        dm = re.search(r"\b(\d{4}-\d{2}-\d{2})\b", htxt)
        if dm:
            date = dm.group(1)
        # competition = text between date and " - reconstruction by ..."
        cm = re.search(r"\d{4}-\d{2}-\d{2}\s*-\s*(.*?)(?:\s*-\s*reconstruction by|$)", htxt)
        if cm:
            competition = cm.group(1).strip() or None
    rrm = RECONSTRUCTOR_RE.search(src)
    if rrm:
        reconstructor = rrm.group(1).strip()

    scramble = None
    steps: list[dict] = []
    rdiv = RECON_RE.search(src)
    if rdiv:
        lines = [l for l in rdiv.group(1).split("\n") if l.strip()]
        if lines:
            # First line is the scramble; strip any leftover <br> markers.
            scramble = re.sub(r"<br\s*/?>", "", lines[0]).strip()
        for l in lines[1:]:
            sm = STEP_LINE_RE.match(l)
            if not sm:
                continue
            moves = sm.group(1).strip()
            comment = (sm.group(2) or "").strip()
            if moves:
                steps.append({"moves": moves, "comment": comment})

    # Stats table: rows are <tr><th>Label</th><td>...</td>...</tr>
    stats: dict = {}
    for row in re.finditer(r"<tr>\s*<th>([^<]+)</th>(.*?)</tr>", src, re.S):
        label = row.group(1).strip()
        if label not in STATS_LABELS:
            continue
        cells = [c.strip() for c in re.findall(r"<td>([^<]*)</td>", row.group(2))]
        stats[label] = dict(zip(STATS_COLS, cells))

    return {
        "id": int(os.path.basename(path).split(".")[0]),
        "solver": solver,
        "time": time,
        "puzzle": puzzle,
        "record": record,
        "date": date,
        "competition": competition,
        "reconstructor": reconstructor,
        "scramble": scramble,
        "steps": steps,
        "stats": stats,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(
        os.path.dirname(__file__), "..", "generated", "reconz-solves.json"))
    args = ap.parse_args()

    solves = []
    for path in sorted(glob.glob(os.path.join(RAW_DIR, "*.html"))):
        s = parse_page(path)
        if s:
            solves.append(s)

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(solves, f, ensure_ascii=False, indent=1)

    puzzles: dict[str, int] = {}
    with_steps = 0
    for s in solves:
        puzzles[s["puzzle"]] = puzzles.get(s["puzzle"], 0) + 1
        if s["steps"]:
            with_steps += 1
    print(f"Parsed {len(solves)} solves ({with_steps} with steps)")
    print("By puzzle:", json.dumps(puzzles))
    if solves:
        first, last = solves[0], solves[-1]
        print("Earliest:", first["date"], first["solver"], first["puzzle"])
        print("Latest:  ", last["date"], last["solver"], last["puzzle"])


if __name__ == "__main__":
    main()
