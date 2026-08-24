"""Generates complete TS seed files for packages/algorithm-db from the verified SpeedCubeDB JSON.

The pipeline was redesigned to make the seed files the single source of truth:
no runtime merge, no hand-curated algorithm lists with mislabeled F2L slots.

Outputs (all fully regenerated, comments in English):
  packages/algorithm-db/src/seed/cfop-pll.ts   → PLL_CASES        (21 cases)
  packages/algorithm-db/src/seed/cfop-oll.ts   → OLL_CASES        (57 cases)
  packages/algorithm-db/src/seed/cfop-f2l.ts   → BASIC_F2L_CASES (41 cases)
                                                  ADVANCED_F2L_CASES (126 cases, BirdF2L)
  packages/algorithm-db/src/seed/coll.ts       → COLL_CASES      (new set)
  packages/algorithm-db/src/seed/wv.ts         → WV_CASES        (new set)

The old `scdb-extras.ts` and the runtime merge in seed/index.ts are removed.

How caseDefs are chosen:
  - PLL/OLL/Basic F2L/Advanced F2L: the caseDef comes from the CURRENT seed
    (pruebas/generated/seed-casedefs.json, dumped by
    src/__tests__/scdb-dump-seed-catalog.test.ts). This preserves the stable
    IDs user progress is keyed by, plus diagram2D / recognition / rich names.
  - COLL/WV: no seed caseDef exists, so the JSON caseDef is used as-is.

How algorithms are chosen (for every set):
  - Only algorithms that PASS verification (verification-report.json, status != 'fail').
  - Only valid moves (standard notation regex).
  - Deduplicated per case by `slot|collapsedMoves` (F2L slots come from the
    SCDB `data-ori`, which is the CORRECT slot source).
  - `caseId` is rewritten to the real seed caseDef id (JSON ids differ).
  - `isDefault`: kept from JSON; if filtering leaves a case with no default,
    the first algorithm is promoted so every case keeps exactly 1 default.

Usage:
  1. npx vitest run src/__tests__/scdb-dump-seed-catalog.test.ts  (in algorithm-db)
  2. python scripts/generate_seed_catalog.py
"""
import json
import os
import re
import sys

sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # pruebas/
SEED_DIR = os.path.join(ROOT, "..", "packages", "algorithm-db", "src", "seed")
G = os.path.join(ROOT, "generated")

# set key → (json file, ts file, exported const, subsetId, has_slots)
# `has_slots` marks F2L sets whose algorithms carry "Slot: X" in notes.
# FRUF is intentionally absent: its algs do not pass verification (the plan's
# "every alg solves its case" rule), so the dump/JSON stays as audit trail only.
CATALOG = [
    ("pll", "scdb-pll.json", "cfop-pll.ts", "PLL_CASES", "00000000-0000-4000-9000-000000000001", False),
    ("oll", "scdb-oll.json", "cfop-oll.ts", "OLL_CASES", "00000000-0000-4000-9000-000000000002", False),
    ("f2l", "scdb-f2l-fused.json", "cfop-f2l.ts", None, "00000000-0000-4000-9000-000000000003", True),
    ("af2l", "scdb-af2l-fused.json", "cfop-f2l.ts", None, "00000000-0000-4000-9000-000000000004", True),
    ("coll", "scdb-coll.json", "coll.ts", "COLL_CASES", "00000000-0000-4000-9000-000000000014", False),
    ("wv", "scdb-wv.json", "wv.ts", "WV_CASES", "00000000-0000-4000-9000-000000000005", False),
    # CFOP sets added 2026-08-06 (non-AJAX SCDB dumps, verified):
    ("cls", "scdb-cls.json", "cfop-cls.ts", "CLS_CASES", "00000000-0000-4000-9000-000000000008", False),
    ("sv", "scdb-sv.json", "cfop-sv.ts", "SV_CASES", "00000000-0000-4000-9000-000000000009", False),
    ("ell", "scdb-ell.json", "cfop-ell.ts", "ELL_CASES", "00000000-0000-4000-9000-000000000010", False),
    ("antipll", "scdb-antipll.json", "cfop-antipll.ts", "ANTIPLL_CASES", "00000000-0000-4000-9000-000000000012", False),
]

MOVE_RE = re.compile(r"^([RLUDFB]w?|[rludfbMES]|[xyz])(2|'|\u2032)?$")


def collapse_consecutive(moves):
    """R' R' -> R2 ; R R -> R2 — mirrors collapseConsecutive() in the TS tests."""
    out = []
    for m in moves:
        prev = out[-1] if out else None
        if prev is not None:
            b1 = re.sub(r"2[']", "", prev)
            b2 = re.sub(r"2[']", "", m)
            d1 = "2" in prev
            d2 = "2" in m
            if b1 == b2 and not d1 and not d2 and prev.endswith("'") == m.endswith("'"):
                out.pop()
                out.append(f"{b1}2")
                continue
        out.append(m)
    return out


def moves_key(moves):
    # TS JSON.stringify uses compact separators; Python json.dumps adds spaces.
    return json.dumps(collapse_consecutive(moves), ensure_ascii=False, separators=(",", ":"))


def load_json(rel):
    p = os.path.join(G, rel)
    if not os.path.exists(p):
        print(f"WARN: missing {rel}")
        return None
    return json.load(open(p, encoding="utf-8"))


def load_report():
    """{(set, caseNumber, moves): status}"""
    r = load_json("verification-report.json")
    if not r:
        print("WARN: no verification-report.json — no verification filter")
        return {}
    out = {}
    for x in r.get("results", []):
        out[(x["set"], x["caseNumber"], x["moves"])] = x["status"]
    return out


def load_seed_casedefs():
    """{subsetId|caseNumber: full caseDef} from the current seed."""
    d = load_json("seed-casedefs.json")
    return d or {}


def load_f2l_birdf2l_map():
    """{caseNumber (e.g. 'F2L 1'): BirdF2L code (e.g. 'Jb')} for the 41 basic F2L cases."""
    d = load_json("f2l-pattern-map.json")
    return d or {}


def ts_str(s):
    return json.dumps(s, ensure_ascii=False)


def normalize_puzzle_type(v):
    """ADR-002: puzzle_type is a WCA event code ('333', '222'). The fused JSON
    still carries legacy spellings for JSON-sourced sets, so normalize them."""
    return {"3x3x3": "333", "2x2x2": "222"}.get(v, v)


def slot_of_alg(a):
    m = re.search(r"Slot:\s*(FR|FL|BL|BR)", a.get("notes") or "")
    return m.group(1) if m else ""


def emit_algorithm(a, indent="      "):
    lines = []
    for k in ["id", "caseId", "moves", "moveCount", "isDefault", "source",
              "difficulty", "triggers", "notes", "isMirror", "isInverse",
              "isCustom", "sortOrder", "votes", "attributionUrl"]:
        if k not in a or a[k] is None:
            continue
        lines.append(f"{indent}{k}: {json.dumps(a[k], ensure_ascii=False)},")
    pad = indent[:-2]
    return "{\n" + "\n".join(lines) + f"\n{pad}}}"


def emit_case(case_def, algs, indent="    "):
    fields = []
    for k in ["id", "subsetId", "caseNumber", "name", "recognitionPatterns",
              "setupScramble", "diagramType", "diagram2D", "diagram3D",
              "probability", "difficulty", "category", "tags", "puzzleType"]:
        if k not in case_def or case_def[k] is None:
            continue
        fields.append(f"{indent}  {k}: {json.dumps(case_def[k], ensure_ascii=False)},")
    body = "{\n" + "\n".join(fields) + f"\n{indent}}}"
    alg_lines = [emit_algorithm(a, indent + "  ") for a in algs]
    return (
        f"  {{\n    caseDef: {body},\n    algorithms: [\n"
        + ",\n".join(alg_lines)
        + f"\n    ],\n  }}"
    )


def build_case(set_key, set_name, c, seed_casedefs, report, f2l_birdf2l_map):
    """Return (caseDef, [algs]) with verification + slot-dedup + real caseId."""
    jcase = c["caseDef"]
    cn = jcase["caseNumber"]
    key = f"{jcase['subsetId']}|{cn}"
    case_def = seed_casedefs.get(key, jcase)
    # Fase 6: SOLO AdvancedF2L recibe el setupScramble final independiente del
    # JSON fused (los 41 básicos conservan sus canónicos del seed). Los advanced
    # del seed aún tienen los setups sucios de la Fase 4; el fused ya los tiene
    # limpios. IDs/diagramas del seed se preservan.
    if set_key == "af2l" and jcase.get("setupScramble"):
        case_def = {**case_def, "setupScramble": jcase["setupScramble"]}
    # Basic F2L: expose the BirdF2L case code as the case name (F2L 1 -> Jb),
    # matching how the Advanced F2L cases display their BirdF2L codes.
    if set_key == "f2l" and cn in f2l_birdf2l_map:
        case_def = {**case_def, "name": f2l_birdf2l_map[cn]}
    # ADR-002: puzzle_type uses WCA event codes ("333", "222"); the fused JSON
    # still carries legacy spellings ("3x3x3", "2x2x2") for JSON-sourced sets.
    case_def = {**case_def, "puzzleType": normalize_puzzle_type(case_def.get("puzzleType") or "333")}

    algs = []
    seen = set()
    n_in = n_fail = n_bad = n_dup = 0
    for a in c["algorithms"]:
        n_in += 1
        moves = a["moves"]
        # Advanced F2L is curated BirdF2L-only: the SpeedCubeDB algs fused into
        # these cases were misattributed (e.g. Hb A5's SCDB alg U R' F R F' R'
        # U' R does not solve that case at all), so only BirdF2L ships.
        if set_key == "af2l" and a.get("source") != "BirdF2L":
            n_bad += 1
            continue
        if not all(MOVE_RE.match(m) for m in moves):
            n_bad += 1
            continue
        rk = (set_name, cn, " ".join(moves))
        if report.get(rk) == "fail":
            n_fail += 1
            continue
        dk = f"{slot_of_alg(a)}|{moves_key(moves)}"
        if dk in seen:
            n_dup += 1
            continue
        seen.add(dk)
        alg = dict(a)
        alg["caseId"] = case_def["id"]
        algs.append(alg)

    # Guarantee exactly 1 default per case (the web sorts by isDefault first).
    if algs and not any(x.get("isDefault") for x in algs):
        algs[0]["isDefault"] = True
    return case_def, algs, n_in, n_fail, n_bad, n_dup


def main():
    os.makedirs(SEED_DIR, exist_ok=True)
    report = load_report()
    seed_casedefs = load_seed_casedefs()
    f2l_birdf2l_map = load_f2l_birdf2l_map()

    by_file = {}  # ts file → {set_key: {...}}, preserving emit order

    for set_key, fname, ts_file, const, subset_id, has_slots in CATALOG:
        d = load_json(fname)
        if not d:
            continue
        set_name = d["set"]
        cases_out = []
        n_in = n_fail = n_bad = n_dup = n_out = n_skipped = 0
        for c in d["cases"]:
            case_def, algs, ni, nf, nb, nd = build_case(set_key, set_name, c, seed_casedefs, report, f2l_birdf2l_map)
            n_in += ni
            n_fail += nf
            n_bad += nb
            n_dup += nd
            if not algs:
                n_skipped += 1
                continue
            n_out += len(algs)
            cases_out.append(emit_case(case_def, algs))
        by_file.setdefault(ts_file, {})[set_key] = {
            "const": const,
            "subset_id": subset_id,
            "cases": cases_out,
            "set_name": set_name,
            "slots": has_slots,
        }
        print(f"[{set_name}] {len(d['cases'])} cases, {n_in} algs -> {n_out} "
              f"(excluded: {n_fail} unverified, {n_bad} invalid, {n_dup} dupes, {n_skipped} cases w/o algs)")

    # ── Write cfop-f2l.ts (two consts in one file) ────────────────────────
    f2l = by_file["cfop-f2l.ts"]
    basic = f2l["f2l"]
    adv = f2l["af2l"]
    ts = (
        "// @generated by pruebas/scripts/generate_seed_catalog.py - DO NOT edit by hand.\n"
        "// Basic F2L (41 cases) + Advanced F2L (126 BirdF2L patterns) fused from\n"
        "// SpeedCubeDB + BirdF2L (see pruebas/scripts/fase5-fuse.ts).\n"
        "// caseDefs keep the stable IDs/diagrams from the previous hand-curated seed\n"
        "// (user progress is keyed by case id); algorithms are the verified SCDB set\n"
        "// with their real slots from the SCDB data-ori tabs (FR/FL/BL/BR).\n"
        "import type { AlgorithmCase, Algorithm } from '../schema';\n\n"
        f"export const F2L_BASIC_SUBSET_ID = {ts_str(basic['subset_id'])};\n"
        f"export const F2L_ADVANCED_SUBSET_ID = {ts_str(adv['subset_id'])};\n\n"
        "export interface F2LCaseData { caseDef: AlgorithmCase; algorithms: Algorithm[] }\n\n"
        f"export const BASIC_F2L_CASES: F2LCaseData[] = [\n"
        + ",\n".join(basic["cases"])
        + "\n];\n\n"
        f"export const ADVANCED_F2L_CASES: F2LCaseData[] = [\n"
        + ",\n".join(adv["cases"])
        + "\n];\n\n"
        "export const ALL_F2L_CASES: F2LCaseData[] = [...BASIC_F2L_CASES, ...ADVANCED_F2L_CASES];\n"
    )
    path = os.path.join(SEED_DIR, "cfop-f2l.ts")
    open(path, "w", encoding="utf-8").write(ts)
    print(f"OK {os.path.relpath(path, ROOT)} ({os.path.getsize(path)//1024} KB)")

    # ── Write the other files (one const per file) ────────────────────────
    for ts_file, sets in by_file.items():
        if ts_file == "cfop-f2l.ts":
            continue
        for set_key, s in sets.items():
            const_upper = {"pll": "PLL", "oll": "OLL", "coll": "COLL", "wv": "WV"}.get(set_key, set_key.upper())
            ts = (
                "// @generated by pruebas/scripts/generate_seed_catalog.py - DO NOT edit by hand.\n"
                f"// {s['set_name']} cases from verified SpeedCubeDB data.\n"
                "// caseDefs keep the stable IDs/diagrams/recognition from the previous\n"
                "// hand-curated seed (user progress is keyed by case id); algorithms are\n"
                "// the complete verified SCDB set (each case keeps exactly 1 default,\n"
                "// the SCDB Standard Alg). F2L algs carry their real slot in notes.\n"
                "import type { AlgorithmCase, Algorithm } from '../schema';\n\n"
                "export interface CaseData { caseDef: AlgorithmCase; algorithms: Algorithm[] }\n\n"
                f"export const {const_upper}_SUBSET_ID = {ts_str(s['subset_id'])};\n\n"
                f"export const {s['const']}: CaseData[] = [\n"
                + ",\n".join(s["cases"])
                + "\n];\n"
            )
            path = os.path.join(SEED_DIR, ts_file)
            open(path, "w", encoding="utf-8").write(ts)
            print(f"OK {os.path.relpath(path, ROOT)} ({os.path.getsize(path)//1024} KB)")

    # ── Remove the old extras file (superseded by full regeneration) ──────
    old = os.path.join(SEED_DIR, "scdb-extras.ts")
    if os.path.exists(old):
        os.remove(old)
        print("removed scdb-extras.ts (superseded by full seed regeneration)")


if __name__ == "__main__":
    main()
