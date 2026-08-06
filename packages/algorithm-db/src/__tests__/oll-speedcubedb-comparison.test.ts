/**
 * Test: Compare Cubeforge OLL facelet colors (yellow-gray style) with SpeedCubeDB's jcube data.
 *
 * OLL recognition focuses on yellow-vs-gray patterns:
 *   - The U face 3×3 grid shows where the yellow stickers are.
 *   - The U-layer side strips (top 3 of F/R/L/B) show yellows on side faces.
 *
 * Color scheme:
 *   - Cubeforge (Kociemba upper-case): 'U' → Y (yellow on U face), anything else → #.
 *   - SpeedCubeDB jcube (lower-case): 'y' → Y, anything else → # (gray/non-yellow).
 *
 * Both pipelines are compared:
 *   1. `setupScramble` (matches SpeedCubeDB's jcube visual reference).
 *   2. `generateFromCase` — the web UI pipeline (rawState, no cleanState).
 *
 * Run:
 *   npx vitest run packages/algorithm-db/src/__tests__/oll-speedcubedb-comparison.test.ts
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { CaseStateGenerator } from "../caseGenerator";
import { FaceletStringConverter } from "@cubeforge/math-core";
import { getSeedData } from "../seed/index";

// ─── Parse SpeedCubeDB jcube data from the HTML ────────────────────────────

const HTML_PATH = resolve(__dirname, "../../../../pruebas/raw/scdb/speedcubedboll.html");
const HAS_HTML = existsSync(HTML_PATH);

interface JcubeData {
  alg: string;
  subgroup: string;
  faces: Record<string, string>; // us/ub/uf/ul/ur — 9-char strings (lowercase)
}

function extractJcubeData(html: string): JcubeData[] {
  const results: JcubeData[] = [];
  // Capture each row's alg, subgroup, and jcube div HTML block.
  const blockRegex =
    /<div class="row singlealgorithm[^"]*"\s+data-subgroup="([^"]*)"\s+data-alg="([A-Za-z0-9 ]+)"[^>]*>([\s\S]*?)(?=<div class="row singlealgorithm|$)/g;
  let match;
  while ((match = blockRegex.exec(html)) !== null) {
    const subgroup = match[1];
    const algName = match[2].trim();
    const block = match[3];

    // Capture each data-* attribute independently so attribute ordering does not matter.
    const attrRegex = /data-([a-z]+)="([a-z]+)"/g;
    const attrs: Record<string, string> = {};
    let am: RegExpExecArray | null;
    while ((am = attrRegex.exec(block)) !== null) {
      attrs[am[1]] = am[2];
    }
    if (!attrs.us) continue; // skip rows without jcube data

    results.push({ alg: algName, subgroup, faces: attrs });
  }
  return results;
}

/** SpeedCubeDB jcube (lowercase): 'y' → Y, else → #. */
function toYGJcube(s: string): string {
  return s.split("").map((c) => (c === "y" ? "Y" : "#")).join("");
}

/** Cubeforge facelet (Kociemba uppercase): 'U' → Y, else → #. */
function toYGKociemba(s: string): string {
  return s.split("").map((c) => (c === "U" ? "Y" : "#")).join("");
}

/** Pretty-print a 9-char string as a 3×3 grid for debugging. */
function toGrid(s: string): string {
  return [s.slice(0, 3), s.slice(3, 6), s.slice(6, 9)]
    .map((row) => row.split("").join(" "))
    .join("\n      ");
}

// ─── Strip-based comparison ────────────────────────────────────────────────
//
// Kociemba facelet string layout (54 chars):
//   U: 0..8     R: 9..17    F: 18..26    D: 27..35    L: 36..44    B: 45..53
//
// Side face top row (U-layer strip) indices:
//   R: 9,10,11     F: 18,19,20    L: 36,37,38    B: 45,46,47
//
// SpeedCubeDB jcube.<face> stores 9 chars per face. The first 3 chars of each
// side face represent the top-row strip in OUTSIDE-FACE order (left→right when
// viewing the face from outside the cube):
//   jcube.us[i]  = cf[i]                (U face — same order)
//   jcube.uf[i]  = cf[18+i] for i<3      (F top strip)
//   jcube.ur[i]  = cf[9+i]  for i<3      (R top strip, outside-view)
//   jcube.ul[i]  = cf[36+i] for i<3      (L top strip)
//   jcube.ub[i]  = cf[45+i] for i<3      (B top strip)

interface StripComparison {
  caseName: string;
  uOk: boolean;
  fOk: boolean;
  rOk: boolean;
  lOk: boolean;
  bOk: boolean;
  allOk: boolean;
  /** Position-by-position diff: { position: [cfY, scdbY] } for each index where they differ. */
  uDiffs: Record<number, [string, string]>;
  fDiffs: Record<number, [string, string]>;
  rDiffs: Record<number, [string, string]>;
  lDiffs: Record<number, [string, string]>;
  bDiffs: Record<number, [string, string]>;
}

// Returns [equal, mismatches] where mismatches is empty when equal.
function diff(a: string, b: string): { equal: boolean; mismatches: Record<number, [string, string]> } {
  const mismatches: Record<number, [string, string]> = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) mismatches[i] = [a[i], b[i]];
  }
  return { equal: Object.keys(mismatches).length === 0, mismatches };
}

function compareStrips(caseName: string, jcube: JcubeData, cf: string): StripComparison {
  const cfU = toYGKociemba(cf.substring(0, 9));
  const scdbU = toYGJcube(jcube.faces.us);
  const uDiff = diff(cfU, scdbU);

  const cfF = toYGKociemba(cf.substring(18, 21));
  const scdbF = toYGJcube(jcube.faces.uf.substring(0, 3));
  const fDiff = diff(cfF, scdbF);

  const cfR = toYGKociemba(cf.substring(9, 12));
  const scdbR = toYGJcube(jcube.faces.ur.substring(0, 3));
  const rDiff = diff(cfR, scdbR);

  const cfL = toYGKociemba(cf.substring(36, 39));
  const scdbL = toYGJcube(jcube.faces.ul.substring(0, 3));
  const lDiff = diff(cfL, scdbL);

  const cfB = toYGKociemba(cf.substring(45, 48));
  const scdbB = toYGJcube(jcube.faces.ub.substring(0, 3));
  const bDiff = diff(cfB, scdbB);

  const uOk = uDiff.equal;
  const fOk = fDiff.equal;
  const rOk = rDiff.equal;
  const lOk = lDiff.equal;
  const bOk = bDiff.equal;

  return {
    caseName,
    uOk, fOk, rOk, lOk, bOk,
    allOk: uOk && fOk && rOk && lOk && bOk,
    uDiffs: uDiff.mismatches,
    fDiffs: fDiff.mismatches,
    rDiffs: rDiff.mismatches,
    lDiffs: lDiff.mismatches,
    bDiffs: bDiff.mismatches,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe.runIf(HAS_HTML)("OLL Facelet Comparison: Cubeforge vs SpeedCubeDB", () => {
  const html = HAS_HTML ? readFileSync(HTML_PATH, "utf-8") : "";
  const scdbData = HAS_HTML ? extractJcubeData(html) : [];
  const { cases, algorithms } = getSeedData();
  const OLL_SUBSET = "00000000-0000-4000-9000-000000000002";
  const ollCases = cases.filter((c) => c.subsetId === OLL_SUBSET);

  // Build the SCDB index — keys are case number; if duplicates exist, prefer
  // the entry whose subgroup matches Cubeforge's `category` field for that case.
  const warnedAlgs = new Set<string>();
  const scdbByAlg = new Map<string, JcubeData[]>();
  for (const d of scdbData) {
    const arr = scdbByAlg.get(d.alg) ?? [];
    arr.push(d);
    scdbByAlg.set(d.alg, arr);
  }
  function pickScdb(alg: string, category?: string): JcubeData | undefined {
    const arr = scdbByAlg.get(alg);
    if (!arr || arr.length === 0) return undefined;
    if (arr.length === 1) return arr[0];
    // Multiple entries with the same `data-alg` exist (e.g. OLL 5 appears in
    // multiple subgroups). Try to match by Cubeforge's `category` field first.
    if (category) {
      const match = arr.find((d) => d.subgroup === category);
      if (match) return match;
    }
    // Ambiguous: warn loudly (deduped across describe blocks) so the fallback
    // isn't silently wrong.
    if (!warnedAlgs.has(alg)) {
      warnedAlgs.add(alg);
      console.warn(
        `[oll-test] ${arr.length} SpeedCubeDB entries for "${alg}" — ` +
          `no subgroup match for category="${category ?? "<none>"}"; ` +
          `using the first (subgroup="${arr[0].subgroup}"). ` +
          `Consider adding a matching category to cfop-oll.ts.`,
      );
    }
    return arr[0];
  }

  it("SpeedCubeDB HTML should have 57 jcube entries with full OLL coverage", () => {
    expect(scdbData.length).toBe(57);
  });

  it("Cubeforge should have 57 OLL cases", () => {
    expect(ollCases.length).toBe(57);
  });

  function formatResult(r: StripComparison): string {
    const icon = (ok: boolean) => (ok ? "✓" : "✗");
    return [
      r.caseName.padEnd(7),
      icon(r.uOk),
      icon(r.fOk),
      icon(r.rOk),
      icon(r.lOk),
      icon(r.bOk),
      r.allOk ? "✅" : "❌",
    ].join(" | ");
  }

  describe("1-to-1 comparison (using setupScramble)", () => {
    it("compares all 57 cases via setupScramble", () => {
      console.log("\n=== OLL Facelet Comparison: Cubeforge vs SpeedCubeDB (setupScramble) ===\n");
      console.log("Case    | U  F  R  L  B  | Match?");
      console.log("--------|----------------|--------");

      const comparisons: StripComparison[] = [];
      const missing: string[] = [];

      for (const caseData of ollCases) {
        const caseName = caseData.caseNumber;
        const jcube = pickScdb(caseName, caseData.category);
        if (!jcube) {
          console.log(`${caseName.padEnd(7)} | NOT FOUND in SpeedCubeDB`);
          missing.push(caseName);
          continue;
        }

        const state = CaseStateGenerator.generateFromScramble(caseData.setupScramble);
        const cf = FaceletStringConverter.toFaceletString(state);
        const result = compareStrips(caseName, jcube, cf);
        comparisons.push(result);
        console.log(formatResult(result));
      }

      const passing = comparisons.filter((c) => c.allOk).length;

      // Print failure details.
      const failing = comparisons.filter((c) => !c.allOk);
      if (failing.length > 0) {
        console.log("\n=== Failure details (U face Cubeforge vs SpeedCubeDB) ===\n");
        for (const f of failing) {
          const jcube = pickScdb(f.caseName)!;
          const state = CaseStateGenerator.generateFromScramble(
            ollCases.find((c) => c.caseNumber === f.caseName)!.setupScramble,
          );
          const cf = FaceletStringConverter.toFaceletString(state);
          const cfU = toYGKociemba(cf.substring(0, 9));
          const scdbU = toYGJcube(jcube.faces.us);
          console.log(`${f.caseName}:`);
          console.log(`  Cubeforge U:    \n      ${toGrid(cfU)}`);
          console.log(`  SpeedCubeDB U:  \n      ${toGrid(scdbU)}`);
          if (!f.uOk) {
            const positions = Object.keys(f.uDiffs).map(Number).sort((a, b) => a - b);
            console.log(`  U diffs at positions: ${positions.join(", ")}`);
          }
        }
      }

      console.log(`\nMatches: ${passing}/${comparisons.length}${missing.length ? ` (missing: ${missing.length})` : ""}`);

      expect(missing.length).toBe(0);
      expect(passing).toBe(57);
    });
  });

  describe("Web pipeline (generateFromCase — what the UI renders)", () => {
    it("compares all 57 cases via the web pipeline", () => {
      console.log("\n=== OLL Web Pipeline Comparison: generateFromCase vs SpeedCubeDB ===\n");
      console.log("Case    | U  F  R  L  B  | Match?");
      console.log("--------|----------------|--------");

      const comparisons: StripComparison[] = [];

      for (const caseData of ollCases) {
        const caseName = caseData.caseNumber;
        const jcube = pickScdb(caseName, caseData.category);
        if (!jcube) continue;

        const { faceletString: cf } = CaseStateGenerator.generateFromCase(
          caseData,
          algorithms,
          "yellow-gray",
        );
        const result = compareStrips(caseName, jcube, cf);
        comparisons.push(result);
        console.log(formatResult(result));
      }

      const passing = comparisons.filter((c) => c.allOk).length;
      console.log(`\nMatches: ${passing}/${comparisons.length}`);
      expect(passing).toBe(57);
    });
  });
});
