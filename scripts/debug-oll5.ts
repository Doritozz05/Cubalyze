/**
 * OLL 5 deep analysis — uses rawState (no cleanState) to faithfully reproduce
 * what the web UI actually renders with the 'yellow-gray' style.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { CaseStateGenerator } from "../packages/algorithm-db/src/caseGenerator";
import {
  CubeState,
  FaceletStringConverter,
  expandWideMoves,
} from "../packages/math-core/src/index";

const HTML_PATH = resolve(__dirname, "../pruebas/speedcubedboll.html");
const html = readFileSync(HTML_PATH, "utf-8");

// Grab OLL 5 block from Square Shapes subgroup
const blockRegex =
  /<div class="row singlealgorithm[^"]*"\s+data-subgroup="([^"]*)"\s+data-alg="OLL 5"[^>]*>([\s\S]*?)(?=<div class="row singlealgorithm|$)/g;
let match: RegExpExecArray | null;
let oll5Block: string | null = null;
let oll5Subgroup: string | null = null;

while ((match = blockRegex.exec(html)) !== null) {
  if (match[1] === "Square Shapes") {
    oll5Subgroup = match[1];
    oll5Block = match[2];
    break;
  }
}
if (!oll5Block) {
  console.error("OLL 5 (Square Shapes) block not found");
  process.exit(1);
}

const jcubeMatch = oll5Block.match(/<div[^>]*class="jcube"[^>]*>/);
const jcubeAttrs: Record<string, string> = {};
if (jcubeMatch) {
  const attrRegex = /data-([a-z]+)="([a-z]+)"/g;
  let am: RegExpExecArray | null;
  while ((am = attrRegex.exec(jcubeMatch[0])) !== null) {
    jcubeAttrs[am[1]] = am[2];
  }
}

const SETUP = "r' U' R U' R' U2' r"; // straight from cfop-oll.ts seed
const ALG = "r' U2 R U R' U r";     // standard OLL 5 algorithm

const toYG = (s: string) => s.split("").map((c) => (c === "y" ? "Y" : "#")).join("");
const toGrid = (s: string) =>
  [s.slice(0, 3), s.slice(3, 6), s.slice(6, 9)]
    .map((r) => r.split("").join(" "))
    .join("\n             ");

// ── SpeedCubeDB reference ───────────────────────────────────────────────

console.log("=".repeat(72));
console.log("SPEEDCUBEDB REFERENCE for OLL 5 (Square Shapes)");
console.log("=".repeat(72));

console.log("\nRaw jcube data (SpeedCubeDB):");
console.log("  us:", jcubeAttrs.us);
console.log("  uf:", jcubeAttrs.uf);
console.log("  ur:", jcubeAttrs.ur);
console.log("  ul:", jcubeAttrs.ul);
console.log("  ub:", jcubeAttrs.ub);

console.log("\nExpected U face (yellow-gray):");
console.log("    " + toGrid(toYG(jcubeAttrs.us)));

console.log("\nExpected side strips (top 3 of each side, yellow-gray):");
console.log("  F:", toYG(jcubeAttrs.uf.substring(0, 3)));
console.log("  R:", toYG(jcubeAttrs.ur.substring(0, 3)));
console.log("  L:", toYG(jcubeAttrs.ul.substring(0, 3)));
console.log("  B:", toYG(jcubeAttrs.ub.substring(0, 3)));

// ── Cubeforge rawState ──────────────────────────────────────────────────

console.log("\n" + "=".repeat(72));
console.log("CUBEFORGE rawState (what the web UI actually shows with yellow-gray)");
console.log("=".repeat(72));

const expandedSetup = expandWideMoves(SETUP);
const expandedAlg = expandWideMoves(ALG);
console.log("\nSetup:    ", SETUP);
console.log("Expanded: ", expandedSetup.join(" "));
console.log("Alg:      ", ALG);
console.log("Expanded: ", expandedAlg.join(" "));

const rawState = CaseStateGenerator.generateFromScramble(SETUP);
const rawCf = FaceletStringConverter.toFaceletString(rawState);

console.log("\nFacelet string (54 chars, Kociemba):");
console.log("  " + rawCf);

console.log("\nU face (yellow-gray):");
console.log("    " + toGrid(toYG(rawCf.substring(0, 9))));

console.log("\nSide strips (yellow-gray):");
console.log("  F:", toYG(rawCf.substring(18, 21)));
console.log("  R:", toYG(rawCf.substring(9, 12)));
console.log("  L:", toYG(rawCf.substring(36, 39)));
console.log("  B:", toYG(rawCf.substring(45, 48)));

// ── Internal state inspection ────────────────────────────────────────────

console.log("\n" + "=".repeat(72));
console.log("CUBEFORGE CubeState internals (after setupScramble)");
console.log("=".repeat(72));

console.log("\ncp (corner permutation, [URF,UFL,ULB,UBR,...]):", Array.from(rawState.cp));
console.log("co (corner orientation, 0=oriented, 1/2=twisted):", Array.from(rawState.co));
console.log("ep (edge permutation):", Array.from(rawState.ep));
console.log("eo (edge orientation, 0=oriented, 1=flipped):", Array.from(rawState.eo));
console.log("\nis solved after setupScramble?", rawState.isSolved());

const afterAlg = rawState.clone();
afterAlg.applySequence(ALG);
console.log("is solved after setupScramble + algorithm?", afterAlg.isSolved());

// ── Compare against known patterns ──────────────────────────────────────

console.log("\n" + "=".repeat(72));
console.log("PATTERN COMPARISON");
console.log("=".repeat(72));

const cfYG_U = toYG(rawCf.substring(0, 9));
const scdbYG_U = toYG(jcubeAttrs.us);

// Yellow count on U face
const cfYellowCount = (cfYG_U.match(/Y/g) ?? []).length;
const scdbYellowCount = (scdbYG_U.match(/Y/g) ?? []).length;
console.log(`\nYellow count on U face:  Cubeforge=${cfYellowCount}, SpeedCubeDB=${scdbYellowCount}`);

const KNOWN_PATTERNS: Record<string, string> = {
  "YYY#YYYY#": "not standard",
  "####YYYY#YY": "OLL 5 (Square, correct)",
  "####YYYY##": "OLL 6 (Square, alt)",
  "##YYYYY###": "OLL 7 (Lightning bolt)",
  "YYYY####YY": "OLL 8 (Lightning bolt)",
  "#YY##YYYYY": "? unknown",
};

console.log("\nCubeforge U pattern:    " + cfYG_U);
console.log("SpeedCubeDB U pattern:  " + scdbYG_U);
console.log("Match?                  " + (cfYG_U === scdbYG_U ? "✓" : "✗"));

// ── Position-by-position diff ──────────────────────────────────────────

console.log("\nPosition-by-position differences on U face:");
for (let i = 0; i < 9; i++) {
  const cfC = cfYG_U[i];
  const scdbC = scdbYG_U[i];
  const marker = cfC === scdbC ? "✓" : "✗";
  if (cfC !== scdbC) {
    console.log(`  pos ${i} (${["ULB","UB","UBR","UL","U","UR","UFL","UF","URF"][i]}): CF="${cfC}" SCDB="${scdbC}" ${marker}`);
  }
}
