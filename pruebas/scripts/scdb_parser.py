#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys
sys.stdout.reconfigure(encoding="utf-8")
"""
scdb_parser.py — Phase 1 of the data pipeline (SpeedCubeDB → JSON).

Converts the SpeedCubeDB HTML dumps (pruebas/raw/scdb/) into JSON using the
SAME structure the current web app uses in packages/algorithm-db
(schema.ts: AlgorithmCase + Algorithm[]), so the result can be imported into
the DB as-is (and, in a later phase, regenerate the seeds).

Supported sets and their "quirks" (format differences verified today):

  | Attribute      | PLL            | OLL            | Advanced F2L            |
  |----------------|----------------|----------------|-------------------------|
  | Cases          | 21             | 57             | 54                      |
  | Slots (data-ori)| 1 (only ori 0)| 1 (only ori 0) | 4 (FR/FL/BL/BR)         |
  | Renderer       | jcube          | jcube          | icube                   |
  | "Standard Alg" | yes            | yes            | no                      |
  | per-case setup | yes            | yes            | yes                     |
  | Votes per alg  | yes            | yes            | yes                     |

Editorial fields (probability, difficulty, tags) replicate what the current
seed already has so the generated JSON is a drop-in replacement.

Usage:
    python scdb_parser.py [--out generated]
"""
from __future__ import annotations

import html
import json
import re
import sys
import uuid
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]  # pruebas/
RAW = ROOT / "raw" / "scdb"

# ─── Deterministic IDs ────────────────────────────────────────────────────
# uuid5 (SHA-1) over a fixed namespace: stable across runs.
_NS = uuid.uuid5(uuid.NAMESPACE_DNS, "cubeforge.scdb.import")


def case_id(set_key: str, case_number: str) -> str:
    return str(uuid.uuid5(_NS, f"{set_key}:case:{case_number}"))


def alg_id(set_key: str, case_number: str, slot: str, moves: str) -> str:
    return str(uuid.uuid5(_NS, f"{set_key}:alg:{case_number}:{slot}:{moves}"))


# ─── Notation normalization ──────────────────────────────────────────────
# Same as in the seeds: strips parentheses and normalizes the odd SCDB
# notation "R2'" / "U2'" → "R2" / "U2" (a 180° turn is identical either way).


def normalize_token(t: str) -> str:
    t = t.replace("(", "").replace(")", "")
    t = re.sub(r"2['\u2032]", "2", t)  # R2' → R2
    t = re.sub(r"['\u2032]2", "2", t)  # R'2 → R2
    return t


def tokenize(alg_str: str) -> list[str]:
    """Tokenizes a sequence into normalized tokens (no parens, no 2')."""
    return [normalize_token(t) for t in html.unescape(alg_str).split() if t]


def expand_wide(tokens: list[str]) -> list[str]:
    """Exact replica of expandWideMoves() in packages/math-core/MoveExpander.ts."""
    out: list[str] = []
    for t in tokens:
        t = normalize_token(t)
        mapping = {
            "r": ["R", "M'"], "Rw": ["R", "M'"], "r'": ["R'", "M"], "Rw'": ["R'", "M"],
            "r2": ["R2", "M2"], "Rw2": ["R2", "M2"],
            "l": ["L", "M"], "Lw": ["L", "M"], "l'": ["L'", "M'"], "Lw'": ["L'", "M'"],
            "l2": ["L2", "M2"], "L2w": ["L2", "M2"], "Lw2": ["L2", "M2"],
            "f": ["F", "S"], "Fw": ["F", "S"], "f'": ["F'", "S'"], "Fw'": ["F'", "S'"],
            "f2": ["F2", "S2"], "Fw2": ["F2", "S2"],
            "u": ["U", "E'"], "Uw": ["U", "E'"], "u'": ["U'", "E"], "Uw'": ["U'", "E"],
            "u2": ["U2", "E2"], "Uw2": ["U2", "E2"],
            "d": ["D", "E"], "Dw": ["D", "E"], "d'": ["D'", "E'"], "Dw'": ["D'", "E'"],
            "d2": ["D2", "E2"], "Dw2": ["D2", "E2"],
            "b": ["B", "S'"], "Bw": ["B", "S'"], "b'": ["B'", "S"], "Bw'": ["B'", "S"],
            "b2": ["B2", "S2"], "Bw2": ["B2", "S2"],
        }
        out.extend(mapping.get(t, [t]))
    return out


def compute_metrics(tokens: list[str]) -> dict[str, int]:
    """Replica of computeMetricFromString in packages/algorithm-db/src/seed/cfop-f2l.ts.
    Rotations (x/y/z) do not count; slices (M/S/E) count in every metric;
    QTM counts double turns as 2."""
    htm = qtm = stm = 0
    for t in tokens:
        t = normalize_token(t)
        m = re.match(r"^([RLUDFB]w?|[rludfbMES])(2|'|\u2032)?$", t)
        if not m:
            continue  # odd tokens (e.g. "U3") add no metric
        base = m.group(1)
        if base in ("x", "y", "z"):
            continue
        stm += 1
        htm += 1
        qtm += 2 if m.group(2) == "2" else 1
    return {"htm": htm, "qtm": qtm, "stm": stm}


# ─── Editorial fields (replicate the current seed) ───────────────────────

PLL_PROBABILITY = {
    "Aa": "1/18", "Ab": "1/18", "E": "1/72", "F": "1/18",
    "Ga": "1/18", "Gb": "1/18", "Gc": "1/18", "Gd": "1/18",
    "H": "1/72", "Ja": "1/18", "Jb": "1/18",
    "Na": "1/18", "Nb": "1/18", "Ra": "1/18", "Rb": "1/18",
    "T": "1/18", "Ua": "1/36", "Ub": "1/36",
    "V": "1/18", "Y": "1/18", "Z": "1/36",
}
PLL_DIFFICULTY = {"H": "beginner", "Ga": "advanced", "Gb": "advanced",
                  "Gc": "advanced", "Gd": "advanced"}

OLL_BEGINNER = {21, 22, 23, 24, 25, 26, 27, 31, 32, 33, 43, 44, 45}
OLL_TAG_BY_CATEGORY = {
    "Dot Case": "dot", "Square Shapes": "square", "Lightning Shapes": "lightning",
    "Fish Shapes": "fish", "Knight Move Shapes": "knight", "OCLL": "ocll",
    "All Corners Oriented": "corners-oriented", "Awkward Shapes": "awkward",
    "P Shapes": "p", "T Shapes": "t", "C Shapes": "c", "W Shapes": "w",
    "L Shapes": "l", "Line Shapes": "line",
}
OLL_EXTRA_TAGS = {26: ["antisune"], 27: ["sune"]}


def oll_probability(n: int) -> str:
    if n == 20:
        return "1/216"
    if n in (1, 21, 55, 56, 57):
        return "1/108"
    return "1/54"


# ─── Per-set configuration ───────────────────────────────────────────────

SLOT_NAMES = {0: "FR", 1: "FL", 2: "BL", 3: "BR"}

SETS = [
    {
        "key": "pll",
        "set_name": "PLL",
        "file": RAW / "speedcubedbpll.html",
        "subset_id": "00000000-0000-4000-9000-000000000001",
        "has_slots": False,
        "diagram_type": "2d-top",
        "difficulty": "intermediate",
        "prob_fn": lambda name: PLL_PROBABILITY.get(name, "1/18"),
        "diff_fn": lambda name: PLL_DIFFICULTY.get(name, "intermediate"),
        "tags_fn": lambda name, cat: [],
    },
    {
        "key": "oll",
        "set_name": "OLL",
        "file": RAW / "speedcubedboll.html",
        "subset_id": "00000000-0000-4000-9000-000000000002",
        "has_slots": False,
        "diagram_type": "2d-top",
        "difficulty": "intermediate",
        "prob_fn": lambda name: oll_probability(int(name.split()[-1])),
        "diff_fn": lambda name: "beginner" if int(name.split()[-1]) in OLL_BEGINNER else "intermediate",
        "tags_fn": lambda name, cat: [OLL_TAG_BY_CATEGORY.get(cat, cat.lower().replace(" ", "-"))]
                                      + OLL_EXTRA_TAGS.get(int(name.split()[-1]), []),
    },
    {
        "key": "af2l",
        "set_name": "AdvancedF2L",
        "file": RAW / "speedcubedbadvancedf2l.html",
        "subset_id": "00000000-0000-4000-9000-000000000004",
        "has_slots": True,
        "diagram_type": "3d-isometric",
        "difficulty": "advanced",
        "prob_fn": lambda name: "1/54",
        "diff_fn": lambda name: "advanced",
        "tags_fn": lambda name, cat: ["af2l", "advanced"],
    },
    {
        "key": "f2l",
        "set_name": "F2L",
        "file": RAW / "speedcubedbF2L.html",
        "subset_id": "00000000-0000-4000-9000-000000000003",
        "has_slots": True,
        "diagram_type": "3d-isometric",
        "difficulty": "beginner",
        "prob_fn": lambda name: "1/41",
        "diff_fn": lambda name: "beginner",
        "tags_fn": lambda name, cat: ["f2l", "basic"],
    },
    {
        "key": "coll",
        "set_name": "COLL",
        "file": RAW / "speedcubedbCOLL.html",
        "subset_id": "00000000-0000-4000-9000-000000000014",
        "has_slots": False,
        "diagram_type": "2d-top",
        "difficulty": "advanced",
        "prob_fn": lambda name: "1/54",
        "diff_fn": lambda name: "advanced",
        "tags_fn": lambda name, cat: ["coll", "last-layer"],
    },
    {
        "key": "cmll",
        "set_name": "CMLL",
        "file": RAW / "speedcubedbCMLL.html",
        "subset_id": "00000000-0000-4000-9000-000000000020",
        "has_slots": False,
        "diagram_type": "2d-top",
        "difficulty": "advanced",
        "prob_fn": lambda name: "1/27",
        "diff_fn": lambda name: "advanced",
        "tags_fn": lambda name, cat: ["cmll", "roux"],
    },
    {
        "key": "wv",
        "set_name": "WV",
        "file": RAW / "speedcubedbWV.html",
        "subset_id": "00000000-0000-4000-9000-000000000005",
        "has_slots": False,
        "diagram_type": "2d-top",
        "difficulty": "intermediate",
        "prob_fn": lambda name: "1/27",
        "diff_fn": lambda name: "intermediate",
        "tags_fn": lambda name, cat: ["wv", "last-slot"],
    },
    # ── CFOP sets added 2026-08-06 (non-AJAX SCDB dumps, seeded as CFOP
    #    algorithm subsets — they are NOT training phases, which remain
    #    Cross/F2L/OLL/PLL).
    {
        "key": "cls",
        "set_name": "CLS",
        "file": RAW / "speedcubedbCLS.html",
        "subset_id": "00000000-0000-4000-9000-000000000008",
        "has_slots": False,
        "diagram_type": "2d-top",
        "difficulty": "advanced",
        "prob_fn": lambda name: "",
        "diff_fn": lambda name: "advanced",
        "tags_fn": lambda name, cat: ["cls", "last-slot"] + (["trapped-corner"] if cat == "Trapped Corner" else []),
    },
    {
        "key": "sv",
        "set_name": "SV",
        "file": RAW / "speedcubedbSV.html",
        "subset_id": "00000000-0000-4000-9000-000000000009",
        "has_slots": False,
        "diagram_type": "2d-top",
        "difficulty": "intermediate",
        "prob_fn": lambda name: "1/27",
        "diff_fn": lambda name: "intermediate",
        "tags_fn": lambda name, cat: ["sv", "summer-variation", "last-slot"],
    },
    {
        "key": "ell",
        "set_name": "ELL",
        "file": RAW / "speedcubedbELL.html",
        "subset_id": "00000000-0000-4000-9000-000000000010",
        "has_slots": False,
        "diagram_type": "2d-top",
        "difficulty": "intermediate",
        "prob_fn": lambda name: "",
        "diff_fn": lambda name: "intermediate",
        "tags_fn": lambda name, cat: ["ell", "last-layer", "edges"],
    },
    {
        "key": "fruf",
        "set_name": "FRUF",
        "file": RAW / "speedcubedbFRUF.html",
        "subset_id": "00000000-0000-4000-9000-000000000011",
        "has_slots": False,
        "diagram_type": "2d-top",
        "difficulty": "intermediate",
        "prob_fn": lambda name: "",
        "diff_fn": lambda name: "intermediate",
        "tags_fn": lambda name, cat: ["fruf", "f-ru-f", "last-layer", "edge-orientation"],
    },
    {
        "key": "antipll",
        "set_name": "AntiPLL",
        "file": RAW / "speedcubedbAntiPLL.html",
        "subset_id": "00000000-0000-4000-9000-000000000012",
        "has_slots": False,
        "diagram_type": "2d-top",
        "difficulty": "intermediate",
        "prob_fn": lambda name: PLL_PROBABILITY.get(name, "1/18"),
        "diff_fn": lambda name: "intermediate",
        "tags_fn": lambda name, cat: ["anti-pll", "pll", "recognition"],
    },
]

# ─── Regexes (with the PHP "?>" detail inside class="...") ────────────────

# The outer div (with data-subgroup and the canonical data-alg) is captured
# separately: in OLL/AF2L the first data-alg of the CONTENT is the link's
# underscore variant ("OLL_1") while the canonical one lives in the opening tag
# ("OLL 1").
RE_BLOCK = re.compile(r'(<div class="row singlealgorithm[^"]*"[^>]*>)', re.S)
RE_NAME = re.compile(r'data-alg="([^"]+)"')
RE_SUBGROUP = re.compile(r'data-subgroup="([^"]+)"')
RE_SETUP = re.compile(r"<div>setup:</div>\s*([^<]+)</div>")
RE_STDALG = re.compile(r"<div class=\"\">Standard Alg:</div>\s*([^<]+)")
RE_ORI_DIV = re.compile(r"<div\s+data-ori='([0-9])'[^>]*>")
RE_LI = re.compile(r"<li class='list-group-item'>(.*?)</li>", re.S)
RE_FORMATTED = re.compile(r'<div class="formatted-alg">([^<]*)</div>')
RE_VOTES = re.compile(r"Community Votes:</div><i.*?</i>\s*(\d+)\s*</i>", re.S)
RE_YOUTUBE = re.compile(r'href="(https://www\.youtube\.com/watch\?v=[^"]+)"')


def parse_case(opening: str, block: str, cfg: dict):
    """opening = the case div's opening tag (canonical name/subgroup),
    block = the case content."""
    name_m = RE_NAME.search(opening)
    if not name_m:
        return None
    name = name_m.group(1)
    subgroup_m = RE_SUBGROUP.search(opening)
    category = subgroup_m.group(1) if subgroup_m else ""
    setup_m = RE_SETUP.search(block)
    setup = " ".join(tokenize(setup_m.group(1))) if setup_m else ""

    # Orientation/slot groups: PLL/OLL → one data-ori='0' div; AF2L → 4 divs
    ori_markers = [(m.start(), m.group(1)) for m in RE_ORI_DIV.finditer(block)]
    if not ori_markers:
        print(f"  [WARN] {name}: no data-ori groups")
        return None

    case_number = name
    subset_id = cfg["subset_id"]
    cid = case_id(cfg["key"], case_number)
    case_def = {
        "id": cid,
        "subsetId": subset_id,
        "caseNumber": case_number,
        "name": case_number,
        "recognitionPatterns": [],
        "setupScramble": setup,
        "diagramType": cfg["diagram_type"],
        "probability": cfg["prob_fn"](case_number),
        "difficulty": cfg["diff_fn"](case_number),
        "category": category,
        "tags": cfg["tags_fn"](case_number, category),
        "puzzleType": "3x3x3",
    }

    # Standard Alg (SCDB's recommended panel, PLL/OLL only): the case's default
    # algorithm. The alternative list is ordered by votes.
    std_m = RE_STDALG.search(block)
    std_tokens = tokenize(std_m.group(1)) if std_m else None
    std_moves = expand_wide(std_tokens) if std_tokens else None

    algorithms = []
    default_assigned = False
    for i, (pos, ori) in enumerate(ori_markers):
        slot = SLOT_NAMES.get(int(ori), ori)
        end = ori_markers[i + 1][0] if i + 1 < len(ori_markers) else len(block)
        group = block[pos:end]
        lis = RE_LI.findall(group)
        for j, li in enumerate(lis):
            fmt_m = RE_FORMATTED.search(li)
            if not fmt_m:
                continue
            moves_str = fmt_m.group(1).strip()
            tokens = tokenize(moves_str)
            if not tokens:
                continue
            moves = expand_wide(tokens)
            votes_m = RE_VOTES.search(li)
            yt_m = RE_YOUTUBE.search(li)
            # Default: the alg matching the Standard Alg (PLL/OLL), or the
            # first solution of the first slot (AF2L, no Standard Alg).
            # `default_assigned` avoids marking two defaults if there are dupes.
            is_default = False
            if std_moves is not None:
                is_default = (moves == std_moves) and not default_assigned
            elif i == 0 and j == 0:
                is_default = True
            if is_default:
                default_assigned = True
            alg = {
                "id": alg_id(cfg["key"], case_number, slot, " ".join(tokens)),
                "caseId": cid,
                "moves": moves,
                "moveCount": compute_metrics(tokens),
                "isDefault": is_default,
                "source": "SpeedCubeDB",
                "difficulty": cfg["diff_fn"](case_number),
                "triggers": [],
                "isMirror": False,
                "isInverse": False,
                "isCustom": False,
                "sortOrder": len(algorithms),
            }
            if cfg["has_slots"]:
                alg["notes"] = f"Slot: {slot}"
            if votes_m:
                alg["votes"] = int(votes_m.group(1))
            if yt_m:
                alg["attributionUrl"] = yt_m.group(1)
            algorithms.append(alg)

    # The Standard Alg was not in the alternatives list: add it as its own
    # algorithm (it is the case's official recommendation).
    if std_moves is not None and not default_assigned:
        algorithms.insert(0, {
            "id": alg_id(cfg["key"], case_number, "STD", " ".join(std_tokens)),
            "caseId": cid,
            "moves": std_moves,
            "moveCount": compute_metrics(std_tokens),
            "isDefault": True,
            "source": "SpeedCubeDB",
            "difficulty": cfg["diff_fn"](case_number),
            "triggers": [],
            "isMirror": False,
            "isInverse": False,
            "isCustom": False,
            "sortOrder": 0,
        })

    # sortOrder is always sequential (the stdalg insert may have duplicated 0).
    for i, a in enumerate(algorithms):
        a["sortOrder"] = i

    if not algorithms:
        print(f"  [WARN] {name}: no algorithms")
        return None
    return {"caseDef": case_def, "algorithms": algorithms}


def main() -> int:
    out_dir = Path(sys.argv[sys.argv.index("--out") + 1] if "--out" in sys.argv else ROOT / "generated")
    out_dir.mkdir(parents=True, exist_ok=True)

    for cfg in SETS:
        if not cfg["file"].exists():
            print(f"✗ {cfg['set_name']}: missing {cfg['file']}")
            continue
        content = cfg["file"].read_text(encoding="utf-8", errors="ignore")
        parts = RE_BLOCK.split(content)
        cases = []
        for idx in range(1, len(parts), 2):
            opening, block = parts[idx], parts[idx + 1]
            parsed = parse_case(opening, block, cfg)
            if parsed:
                cases.append(parsed)

        n_algs = sum(len(c["algorithms"]) for c in cases)
        n_votes = sum(1 for c in cases for a in c["algorithms"] if "votes" in a)
        votes_sum = sum(a.get("votes", 0) for c in cases for a in c["algorithms"])
        slot_counter: Counter = Counter()
        for c in cases:
            for a in c["algorithms"]:
                note = a.get("notes") or "—"
                slot_counter[note] += 1
        defaults = sum(1 for c in cases if any(a["isDefault"] for a in c["algorithms"]))

        doc = {
            "source": "SpeedCubeDB",
            "set": cfg["set_name"],
            "subsetId": cfg["subset_id"],
            "generatedBy": "pruebas/scripts/scdb_parser.py",
            "cases": cases,
        }
        out_file = out_dir / f"scdb-{cfg['key']}.json"
        out_file.write_text(json.dumps(doc, indent=1, ensure_ascii=False), encoding="utf-8")

        print(f"✓ {cfg['set_name']}: {len(cases)} cases, {n_algs} algs, "
              f"{n_votes} with votes (sum {votes_sum}), {defaults} default")
        print(f"    slots: {dict(slot_counter)}")
        print(f"    → {out_file}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
