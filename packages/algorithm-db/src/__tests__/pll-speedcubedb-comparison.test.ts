/**
 * Test: Compare Cubeforge PLL facelet colors with SpeedCubeDB's jcube data.
 *
 * Uses setupScramble to generate the case state (matching SpeedCubeDB's visual),
 * then compares the U-layer side-strip colors for all 21 PLL cases.
 *
 * Color scheme (both Cubeforge and SpeedCubeDB):
 *   y→U (yellow), r→L (red=left), o→R (orange=right), g→F (green=front),
 *   b→B (blue=back), w→D (white=bottom)
 *
 * Run: npx vitest run packages/algorithm-db/src/__tests__/pll-speedcubedb-comparison.test.ts
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { CaseStateGenerator } from "../caseGenerator";
import { FaceletStringConverter } from "@cubalyze/math-core";
import { getSeedData } from "../seed/index";

// ─── Parse SpeedCubeDB jcube data from the HTML ────────────────────────────

const HTML_PATH = resolve(__dirname, "../../../../pruebas/raw/scdb/speedcubedbpll.html");
const HAS_HTML = existsSync(HTML_PATH);

/** Color mapping: SpeedCubeDB jcube lowercase → Kociemba face labels.
 *  Both Cubeforge and SpeedCubeDB use R=orange, L=red. */
const JCUBE_TO_KOCIEMBA: Record<string, string> = {
  y: "U", r: "L", o: "R", g: "F", b: "B", w: "D",
};

interface JcubeData {
  alg: string;
  faces: Record<string, string>;
}

function extractJcubeData(html: string): JcubeData[] {
  const results: JcubeData[] = [];
  const blockRegex =
    /<div class="row singlealgorithm[^"]*"\s+data-subgroup="[^"]*"\s+data-alg="([A-Za-z]+)"[^>]*>([\s\S]*?)(?=<div class="row singlealgorithm|$)/g;
  let match;
  while ((match = blockRegex.exec(html)) !== null) {
    const algName = match[1];
    const block = match[2];
    const jcubeMatch = block.match(
      /<div\s+class="jcube"[^>]*data-us="([a-z]+)"\s+data-ub="([a-z]+)"\s+data-uf="([a-z]+)"\s+data-ul="([a-z]+)"\s+data-ur="([a-z]+)"[^>]*>/,
    );
    if (jcubeMatch) {
      results.push({
        alg: algName,
        faces: {
          us: jcubeMatch[1], ub: jcubeMatch[2], uf: jcubeMatch[3],
          ul: jcubeMatch[4], ur: jcubeMatch[5],
        },
      });
    }
  }
  return results;
}

/**
 * Convert jcube facelet colors to Kociemba labels for a side face U-layer strip.
 * Returns a 3-char string of Kociemba face labels (e.g., "FLR").
 */
function getScdbStrip(
  jcube: JcubeData,
  face: "F" | "R" | "L" | "B",
  orientation: "direct" | "reversed",
): string {
  const key = { F: "uf", R: "ur", L: "ul", B: "ub" }[face];
  const mapped = jcube.faces[key].split("").map((c) => JCUBE_TO_KOCIEMBA[c] ?? "?");
  const strip = [mapped[0], mapped[1], mapped[2]];
  return orientation === "reversed" ? strip.reverse().join("") : strip.join("");
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe.runIf(HAS_HTML)("PLL Facelet Comparison: Cubeforge vs SpeedCubeDB", () => {
  const html = HAS_HTML ? readFileSync(HTML_PATH, "utf-8") : "";
  const scdbData = HAS_HTML ? extractJcubeData(html) : [];
  const { cases, algorithms } = getSeedData();
  const PLL_SUBSET = "00000000-0000-4000-9000-000000000001";
  const pllCases = cases.filter((c) => c.subsetId === PLL_SUBSET);
  const scdbMap = new Map(scdbData.map((d) => [d.alg, d]));

  it("SpeedCubeDB HTML should have 21 jcube entries", () => {
    expect(scdbData.length).toBe(21);
  });

  it("Cubeforge should have 21 PLL cases", () => {
    expect(pllCases.length).toBe(21);
  });

  /** Compare a 54-char facelet string against SpeedCubeDB jcube data. */
  function compareFacelets(
    caseName: string,
    jcube: JcubeData,
    cf: string,
  ): { allOk: boolean; details: string } {
    // Cubeforge strips
    const cfF = [18, 19, 20].map((i) => cf[i]).join("");
    const cfR = [11, 10, 9].map((i) => cf[i]).join("");
    const cfL = [38, 37, 36].map((i) => cf[i]).join("");
    const cfB = [47, 46, 45].map((i) => cf[i]).join("");

    // SpeedCubeDB strips — try both orientations, pick best
    const scdbFd = getScdbStrip(jcube, "F", "direct");
    const scdbFr = getScdbStrip(jcube, "F", "reversed");
    const scdbRd = getScdbStrip(jcube, "R", "direct");
    const scdbRr = getScdbStrip(jcube, "R", "reversed");
    const scdbLd = getScdbStrip(jcube, "L", "direct");
    const scdbLr = getScdbStrip(jcube, "L", "reversed");
    const scdbBd = getScdbStrip(jcube, "B", "direct");
    const scdbBr = getScdbStrip(jcube, "B", "reversed");

    const scdbF = cfF === scdbFd ? scdbFd : cfF === scdbFr ? scdbFr : "?";
    const scdbR = cfR === scdbRd ? scdbRd : cfR === scdbRr ? scdbRr : "?";
    const scdbL = cfL === scdbLd ? scdbLd : cfL === scdbLr ? scdbLr : "?";
    const scdbB = cfB === scdbBd ? scdbBd : cfB === scdbBr ? scdbBr : "?";

    const fOk = cfF === scdbF;
    const rOk = cfR === scdbR;
    const lOk = cfL === scdbL;
    const bOk = cfB === scdbB;
    const allOk = fOk && rOk && lOk && bOk;

    const icon = (ok: boolean) => (ok ? "✓" : "✗");
    const details = `✓ | ${icon(fOk)}  | ${icon(rOk)}  | ${icon(lOk)}  | ${icon(bOk)}  | ${allOk ? "✅" : "❌"}`;
    return { allOk, details };
  }

  describe("1-to-1 comparison (using setupScramble)", () => {
    it("compares all 21 cases", () => {
      console.log("\n=== PLL Facelet Comparison: Cubeforge vs SpeedCubeDB ===\n");
      console.log("Case | U | F  | R  | L  | B  | Match?");
      console.log("-----|---|----|----|----|----|--------");

      let matchCount = 0;

      for (const caseData of pllCases) {
        const caseName = caseData.caseNumber;
        const jcube = scdbMap.get(caseName);
        if (!jcube) {
          console.log(`${caseName.padEnd(4)} | NOT FOUND in SpeedCubeDB`);
          continue;
        }

        // Generate facelet from setupScramble (matching SpeedCubeDB's visual)
        const state = CaseStateGenerator.generateFromScramble(caseData.setupScramble);
        const cleanState = CaseStateGenerator.createCleanState(state);
        const cf = FaceletStringConverter.toFaceletString(cleanState);

        const { allOk, details } = compareFacelets(caseName, jcube, cf);
        if (allOk) matchCount++;

        console.log(`${caseName.padEnd(4)} | ${details}`);
      }

      console.log(`\nMatches: ${matchCount}/21`);
      expect(matchCount).toBe(21);
    });
  });

  describe("Web pipeline comparison (generateFromCase — what the UI actually renders)", () => {
    it("compares all 21 cases via generateFromCase", () => {
      console.log("\n=== PLL Web Pipeline: generateFromCase vs SpeedCubeDB ===\n");
      console.log("Case | U | F  | R  | L  | B  | Match?");
      console.log("-----|---|----|----|----|----|--------");

      let matchCount = 0;

      for (const caseData of pllCases) {
        const caseName = caseData.caseNumber;
        const jcube = scdbMap.get(caseName);
        if (!jcube) continue;

        // Generate facelet via the same pipeline the web uses
        const { faceletString: cf } = CaseStateGenerator.generateFromCase(
          caseData,
          algorithms,
          "full-color",
        );

        const { allOk, details } = compareFacelets(caseName, jcube, cf);
        if (allOk) matchCount++;

        console.log(`${caseName.padEnd(4)} | ${details}`);
      }

      console.log(`\nMatches: ${matchCount}/21`);
      expect(matchCount).toBe(21);
    });
  });
});
