/**
 * Debug v2: con el inverso corregido.
 * 1) setup + inverso(setup) = identidad (¿el motor va bien?)
 * 2) ¿dónde quedan las piezas C4/E8 (pareja) tras el setup de quest?
 * 3) ¿el primer solve DIRECTO de quest (no reducción) resuelve el setup?
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { CubeState } from "../../packages/math-core/src/index";

const QUEST_DIR = resolve(__dirname, "../raw/quest/study");

const INV: Record<string, string> = {
  U: "U'", "U'": "U", U2: "U2", R: "R'", "R'": "R", R2: "R2",
  F: "F'", "F'": "F", F2: "F2", D: "D'", "D'": "D", D2: "D2",
  L: "L'", "L'": "L", L2: "L2", B: "B'", "B'": "B", B2: "B2",
  M: "M'", "M'": "M", M2: "M2", E: "E'", "E'": "E", E2: "E2",
  S: "S'", "S'": "S", S2: "S2", x: "x'", "x'": "x", x2: "x2",
  y: "y'", "y'": "y", y2: "y2", z: "z'", "z'": "z", z2: "z2",
  r: "r'", "r'": "r", r2: "r2", l: "l'", "l'": "l", l2: "l2",
  f: "f'", "f'": "f", f2: "f2", b: "b'", "b'": "b", b2: "b2",
  d: "d'", "d'": "d", d2: "d2", u: "u'", "u'": "u", u2: "u2",
};
function invertSeq(moves: string): string {
  return moves.split(" ").filter(Boolean).reverse().map((m) => INV[m] ?? m).join(" ");
}
function normQuest(s: string): string {
  return s.replace(/([RLUDFBMES]w?|[rludbfxyz])2'/g, "$12").replace(/’/g, "'");
}
function f2lSolved(s: CubeState): boolean {
  for (let i = 4; i <= 7; i++) if (s.cp[i] !== i || s.co[i] !== 0) return false;
  for (let i = 8; i <= 11; i++) if (s.ep[i] !== i || s.eo[i] !== 0) return false;
  return true;
}
function findPos(arr: readonly number[], piece: number): number {
  for (let i = 0; i < arr.length; i++) if (arr[i] === piece) return i;
  return -1;
}
const CORNER_NAMES = ["URF", "UFL", "ULB", "UBR", "DFR", "DLF", "DBL", "DBR"];
const EDGE_NAMES = ["UR", "UF", "UL", "UB", "DR", "DF", "DL", "DB", "FR", "FL", "BL", "BR"];

function testCase(slug: string) {
  const src = readFileSync(resolve(QUEST_DIR, slug + ".html"), "utf-8");
  const m = src.match(/selectedSetup:\s*"([^"]+)"/);
  const codeM = src.match(/code:"([^"]+)"/);
  if (!m) { console.log(`${slug}: sin setup`); return; }
  const setup = m[1];
  const s = new CubeState();
  s.applySequence(normQuest(setup));

  // donde estan C4 y E8
  const p4 = findPos(s.cp, 4), p8 = findPos(s.ep, 8);
  console.log(`\n=== ${slug} (quest code ${codeM?.[1] ?? "?"}) | setup: ${normQuest(setup)}`);
  console.log(`  C4 está en ${CORNER_NAMES[p4]} (co=${s.co[p4]}) | E8 está en ${EDGE_NAMES[p8]} (eo=${s.eo[p8]})`);

  // setup + inverso = identidad?
  const t = s.clone();
  t.applySequence(invertSeq(normQuest(setup)));
  console.log(`  setup + inverso(setup) → F2L resuelto: ${f2lSolved(t) ? "✅ (motor OK)" : "❌ (BUG EN MOTOR O INVERSO)"}`);

  // filas de quest: primero la que NO tenga reduces (solve directo)
  const rows = [...src.matchAll(/\{alg:"([^"]+)",algid:"([^"]*)",auf:"([^"]*)",disturbs:"[^"]*",reduces:(\[[^\]]*\])/g)];
  const direct = rows.filter((r) => r[4] === "[]" || r[4] === "[");
  console.log(`  filas: ${rows.length} total, ${direct.length} directas (sin reduces)`);
  for (const r of direct.slice(0, 3)) {
    const alg = normQuest(r[1]);
    const auf = normQuest(r[3]);
    for (const combo of [`${alg} ${auf}`.trim(), `${auf} ${alg}`.trim(), alg]) {
      const tt = s.clone();
      tt.applySequence(combo);
      if (f2lSolved(tt)) { console.log(`  ✅ solve directo: ${r[1]} + auf "${r[3]}" (combo: ${combo})`); break; }
    }
  }
  // primer solve de cualquier tipo que funcione
  for (const r of rows.slice(0, 12)) {
    const alg = normQuest(r[1]);
    const auf = normQuest(r[3]);
    for (const combo of [`${alg} ${auf}`.trim(), `${auf} ${alg}`.trim(), alg]) {
      const tt = s.clone();
      tt.applySequence(combo);
      if (f2lSolved(tt)) { console.log(`  ✅ ${r[2] || r[1]} → F2L resuelto (combo: ${combo})`); break; }
    }
  }
}

for (const slug of ["vj", "je", "cf", "ub", "ui"]) testCase(slug);
