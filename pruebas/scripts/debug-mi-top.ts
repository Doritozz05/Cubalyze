/** Investiga por qué el #1 de Mi en quest ("U' y' R' U R") no resuelve FR. */
import { readFileSync } from "fs";
import { resolve } from "path";
import { CubeState } from "../../packages/math-core/src/index";

const QUEST = resolve(__dirname, "../raw/quest");
const qd = JSON.parse(readFileSync(resolve(QUEST, "quest-mi-data.json"), "utf-8"));
const setup = qd.selectedSetup as string;

function dump(s: CubeState, label: string): void {
  const cp = Array.from(s.cp as any), co = Array.from(s.co as any), ep = Array.from(s.ep as any), eo = Array.from(s.eo as any);
  console.log(`${label}: cp=[${cp}] co=[${co}] ep=[${ep}] eo=[${eo}]`);
}
function f2lSolved(s: CubeState): boolean {
  for (let i = 4; i < 8; i++) if (s.cp[i] !== i || s.co[i] !== 0) return false;
  for (let i = 4; i < 12; i++) if (s.ep[i] !== i || s.eo[i] !== 0) return false;
  return true;
}
function frSolved(s: CubeState): boolean {
  return s.cp[4] === 4 && s.co[4] === 0 && s.ep[8] === 8 && s.eo[8] === 0;
}

console.log(`setup quest Mi = "${setup}"`);
const s0 = new CubeState(); s0.applySequence(setup);
dump(s0, "estado tras setup");

// variantes del alg #1
const variants: [string, string][] = [
  ["auf+alg", "U' y' R' U R"],
  ["algid full", "y' U' R' U R"],
  ["sin auf", "y' R' U R"],
  ["sin rotacion", "U' R' U R"],
];
for (const [name, alg] of variants) {
  const t = s0.clone();
  try { t.applySequence(alg); } catch (e) { console.log(`${name} "${alg}": ERR ${e}`); continue; }
  console.log(`\nsetup + "${alg}" (${name}) -> f2lSolved: ${f2lSolved(t)} | frSolved: ${frSolved(t)}`);
  dump(t, "  estado");
}

// y el #4 puro para comparar
for (const [name, alg] of [["#4", "U' F' U F"], ["#5", "F R' F' R"]] as [string, string][]) {
  const t = s0.clone();
  t.applySequence(alg);
  console.log(`\nsetup + "${alg}" (#${name}) -> f2lSolved: ${f2lSolved(t)}`);
}

// ¿resuelve el alg #1 en alguna alineación de slot (caso rotado por y/y2/y')?
console.log("\n=== alg #1 contra el caso rotado a cada slot ===");
for (const [rotName, r] of [["FR", ""], ["FL", "y'"], ["BL", "y2"], ["BR", "y"]] as [string, string][]) {
  for (const [vName, alg] of [["auf+alg", "U' y' R' U R"], ["sin auf", "y' R' U R"], ["sin rot", "U' R' U R"]] as [string, string][]) {
    const t = s0.clone();
    if (r) t.applySequence(r);
    try { t.applySequence(alg); } catch (e) { continue; }
    const ok = f2lSolved(t);
    if (ok || vName === "auf+alg") console.log(`  slot ${rotName} + "${alg}" (${vName}) -> ${ok ? "SOLVED ✓✓" : "no"}`);
  }
}
