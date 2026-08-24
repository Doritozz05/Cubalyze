/**
 * Suplemento para el informe:
 * 1) ¿cuántos algs de quest resuelven el F2L completo (puros) por caso?
 * 2) mapear nuestros básicos (F2L 1..41) con slugs de quest por setup (mod rot)
 * 3) muestra de name/ourCode/patterns
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { CubeState } from "../../packages/math-core/src/index";

const QA = JSON.parse(readFileSync(resolve(__dirname, "../raw/quest/quest-all.json"), "utf-8"));
const FUSED_B = JSON.parse(readFileSync(resolve(__dirname, "../generated/scdb-f2l-fused.json"), "utf-8")).cases;

function normQuest(s: string): string {
  return s.replace(/([RLUDFBMES]w?|[rludbfxyz])2'/g, "$12").replace(/’/g, "'");
}
function f2lSolved(s: CubeState): boolean {
  for (let i = 4; i <= 7; i++) if (s.cp[i] !== i || s.co[i] !== 0) return false;
  for (let i = 8; i <= 11; i++) if (s.ep[i] !== i || s.eo[i] !== 0) return false;
  return true;
}
const ROTS = ["", "x", "x'", "x2", "y", "y'", "y2", "z", "z'", "z2", "x y", "x y'", "x y2", "x' y", "x' y'", "x' y2", "x2 y", "x2 y'", "x2 y2", "y x", "y x'", "y x2", "y' x", "y' x'", "y' x2"];
function rot(s: CubeState, r: string): CubeState {
  const t = s.clone();
  if (r) t.applySequence(r);
  return t;
}
function f2lSameUpToRot(a: CubeState, b: CubeState): string | null {
  for (const r of ROTS) {
    const t = rot(a, r);
    let same = true;
    for (let i = 4; i <= 7; i++) if (t.cp[i] !== b.cp[i] || t.co[i] !== b.co[i]) { same = false; break; }
    if (!same) continue;
    for (let i = 8; i <= 11; i++) if (t.ep[i] !== b.ep[i] || t.eo[i] !== b.eo[i]) { same = false; break; }
    if (same) return r || "(sin rot)";
  }
  return null;
}

// 1) algs puros por caso
console.log("═══ 1) ALGS PUROS DE QUEST (resuelven F2L completo) ═══");
const pureCounts: [string, number, number][] = [];
for (const [slug, q] of Object.entries(QA) as any) {
  if (q.basic) continue;
  const S = new CubeState();
  S.applySequence(normQuest(q.setup));
  let pure = 0;
  for (const r of q.rows as any[]) {
    const t = S.clone();
    try { t.applySequence(normQuest(`${r.alg} ${r.auf}`)); } catch { continue; }
    if (f2lSolved(t)) pure++;
  }
  pureCounts.push([slug, pure, q.rows.length]);
}
const withPure = pureCounts.filter(([, p]) => p > 0);
console.log(`advanced con ≥1 alg puro listado: ${withPure.length}/126`);
const totalPure = pureCounts.reduce((a, [, p]) => a + p, 0);
console.log(`total algs puros listados: ${totalPure}`);
const sorted = [...pureCounts].sort((a, b) => b[1] - a[1]);
console.log("casos con más puros:", sorted.slice(0, 8).map(([s, p, t]) => `${s}(${p}/${t})`).join(", "));

// 2) mapear basic F2L 1..41 con slugs
console.log("\n═══ 2) MAPEO BÁSICOS (nuestro setup ↔ quest) ═══");
const mapped: [string, string][] = [];
const unmapped: string[] = [];
for (const c of FUSED_B) {
  const O = new CubeState();
  O.applySequence(c.caseDef.setupScramble);
  let best: string | null = null;
  for (const [slug, q] of Object.entries(QA) as any) {
    if (!q.basic) continue;
    const Q = new CubeState();
    Q.applySequence(normQuest(q.setup));
    if (f2lSameUpToRot(O, Q)) { best = slug; break; }
  }
  if (best) mapped.push([c.caseDef.caseNumber, best]);
  else unmapped.push(c.caseDef.caseNumber);
}
console.log(`mapeados: ${mapped.length}/41 | sin mapear: ${unmapped.join(", ") || "ninguno"}`);
for (const [num, slug] of mapped.slice(0, 10)) console.log(`   ${num} ↔ ${slug}`);

// 3) muestra de name/ourCode
console.log("\n═══ 3) MUESTRA name/ourCode/patterns (advanced) ═══");
let n = 0;
for (const [slug, q] of Object.entries(QA) as any) {
  if (q.basic) continue;
  console.log(`   ${slug}: ${q.ourCode} | ${q.name} | ${q.count} algs`);
  if (++n >= 8) break;
}
