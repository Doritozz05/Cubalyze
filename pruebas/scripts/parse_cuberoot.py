"""Parse CubeRoot reconstruction HTML files into clean JSON.

Each page is a Next.js RSC payload where the solve data lives between the
markers `initialSolve` and `initialSameScramble` as a JSON-encoded string:
quotes are escaped as \\" and inner backslashes as \\\\. We recover the object
with two json.loads passes (string-body decode, then real JSON parse), which
handles ALL escape sequences correctly regardless of depth.
"""

import json
import sys
from pathlib import Path

RAW_DIR = Path(__file__).resolve().parent.parent / "raw" / "cuberoot-recon"
OUT_FILE = Path(__file__).resolve().parent.parent / "generated" / "cuberoot-solves.json"

FIELD_MAP = {
    "id": "id",
    "official": "official",
    "event": "event",
    "method": "method",
    "date": "date",
    "comp": "competition",
    "compWcaId": "compWcaId",
    "country": "country",
    "solveNum": "solveNum",
    "person": "solver",
    "personId": "solverId",
    "personCountry": "solverCountry",
    "rawTime": "rawTime",
    "average": "average",
    "regionalSingleRecord": "record",
    "regionalAverageRecord": "recordAverage",
    "solution": "solution",
    "wcaScramble": "scramble",
    "optimalScramble": "optimalScramble",  # fallback when wcaScramble is absent
    "note": "note",
    "stm": "stm",
    "tps": "tps",
    "oll": "oll",
    "pll": "pll",
    "ollShort": "ollShort",
    "pllShort": "pllShort",
    "freePair": "freePair",
    "yRot": "yRot",
    "regrip": "regrip",
    "lockup": "lockup",
    "crossType": "crossType",
    "crossStm": "crossStm",
    "f2l": "f2l",
    "ll": "ll",
    "sMove": "sMove",
    "crossColor": "crossColor",
    "createdAt": "createdAt",
    "addedBy": "addedBy",
    "addedById": "addedById",
    "cube": "cube",
    "reconer": "reconer",
    "reconerId": "reconerId",
    "groupId": "groupId",
    "reconDate": "reconDate",
    "videoUrl": "videoUrl",
    "visibility": "visibility",
}

# Tech tags (shown in quest and on the page): derived from oll/pll/cross fields.
def build_tags(d: dict) -> list[str]:
    tags = []
    if d.get("crossType") not in (None, 0):
        tags.append("xcross")
    if d.get("oll"):
        if "OLL" in str(d.get("ollShort", "")) and d.get("ollShort") != "OLL":
            pass  # keep below
    if d.get("oll") and str(d.get("oll")) not in ("OLL", ""):
        tags.append(str(d["oll"]))
    if d.get("pll") and str(d.get("pll")) not in ("PLL", ""):
        tags.append(str(d["pll"]))
    if d.get("freePair"):
        tags.append("freePair")
    if d.get("yRot"):
        tags.append("yRot")
    if d.get("sMove"):
        tags.append("sMove")
    return tags


def extract_solve(html: str) -> dict:
    i = html.find("initialSolve")
    j = html.find("initialSameScramble", i)
    if i == -1 or j == -1:
        raise ValueError("markers not found")
    seg = html[i : j]
    open_b = seg.find("{")
    if open_b == -1:
        raise ValueError("no opening brace")
    close_b = seg.rfind("}")
    if close_b == -1 or close_b <= open_b:
        raise ValueError("no closing brace")
    content = seg[open_b : close_b + 1]
    # First decode: treat as JSON string body -> unescaped JSON text
    inner = json.loads('"' + content + '"')
    obj = json.loads(inner)
    return obj


def to_clean(obj: dict) -> dict:
    out = {}
    for src_key, dst_key in FIELD_MAP.items():
        if src_key in obj:
            out[dst_key] = obj[src_key]
    out["source"] = "cuberoot"
    out["url"] = None  # filled later from sitemap slug if needed
    out["tags"] = build_tags(obj)
    return out


def main() -> int:
    files = sorted(RAW_DIR.glob("*.html"))
    if not files:
        print("no html files in", RAW_DIR)
        return 1
    solves = []
    errors = []
    for f in files:
        try:
            html = f.read_text(encoding="utf-8", errors="ignore")
            obj = extract_solve(html)
            clean = to_clean(obj)
            # Derive url from filename slug
            clean["url"] = "https://cuberoot.me/recon/" + f.stem
            solves.append(clean)
        except Exception as e:
            errors.append((f.name, str(e)[:120]))
    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(json.dumps(solves, ensure_ascii=False, indent=1), encoding="utf-8")
    print("parsed %d solves -> %s" % (len(solves), OUT_FILE))
    if errors:
        print("ERRORS (%d):" % len(errors))
        for name, msg in errors[:10]:
            print("  %s: %s" % (name, msg))
    return 0 if not errors else 2


if __name__ == "__main__":
    sys.exit(main())
