/**
 * Modelo de 4 slots (FR/FL/BL/BR) para los 168 casos: genera slots-model.json
 * con setup + top-alg por slot, verificado por conjugación de rotación.
 *
 * Lógica: el caso canónico C (pair en FR) rotado por r (FR->S) es el mismo caso
 * en el slot S. El alg se conjuga: alg_S = rInv A r. Si A resuelve C en FR
 * (condición cond), entonces alg_S resuelve el caso en S: aplicamos la secuencia
 * y des-rotamos con rInv para comparar la MISMA condición.
 *
 * Uso: pnpm dlx tsx pruebas/scripts/slots-model.ts
 */
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { CubeState } from "../../packages/math-core/src/index";

const RAW = resolve(__dirname, "../raw/birdf2l");
const PARSED = JSON.parse(readFileSync(resolve(RAW, "parsed.json"), "utf-8")) as Record<
  string,
  { algs: { moves: string; speed: number }[] }
>;
const TAX = (JSON.parse(readFileSync(resolve(RAW, "f2l-taxonomy.json"), "utf-8")) as any).cases as Record<
  string,
  { setup: string; f2lnum: string | null; aNum: string | null; position: string }
>;

function invertSequence(alg: string): string {
  const toks = alg.trim().split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (let i = toks.length - 1; i >= 0; i--) {
    const t = toks[i];
    if (t.endsWith("'")) out.push(t.slice(0, -1));
    else if (t.endsWith("2")) out.push(t);
    else out.push(t + "'");
  }
  return out.join(" ");
}
function f2lSolved(s: CubeState): boolean {
  for (let i = 4; i < 8; i++) if (s.cp[i] !== i || s.co[i] !== 0) return false;
  for (let i = 4; i < 12; i++) if (s.ep[i] !== i || s.eo[i] !== 0) return false;
  return true;
}
function frSolved(s: CubeState): boolean {
  return s.cp[4] === 4 && s.co[4] === 0 && s.ep[8] === 8 && s.eo[8] === 0;
}
function apply(s: CubeState, seq: string): boolean {
  try { s.applySequence(seq); return true; } catch { return false; }
}
function stateEq(a: CubeState, b: CubeState): boolean {
  for (let i = 0; i < 8; i++) if (a.cp[i] !== b.cp[i] || a.co[i] !== b.co[i]) return false;
  for (let i = 0; i < 12; i++) if (a.ep[i] !== b.ep[i] || a.eo[i] !== b.eo[i]) return false;
  return true;
}

// r: rotación que lleva el slot FR al slot S. rInv: la inversa.
const SLOTS = [
  { slot: "FR", r: "", rInv: "" },
  { slot: "FL", r: "y'", rInv: "y" },
  { slot: "BL", r: "y2", rInv: "y2" },
  { slot: "BR", r: "y", rInv: "y'" },
];

const SOLVED = new CubeState();
const out: any = { generated: new Date().toISOString(), slots: {} };
let checked = 0, fail = 0;
const fails: string[] = [];
for (const p of Object.keys(PARSED).sort()) {
  const top = [...PARSED[p].algs].sort((a, b) => a.speed - b.speed)[0];
  if (!top) continue;
  const A = top.moves;
  const setup = TAX[p]?.setup ?? "";
  const canon = new CubeState();
  if (!apply(canon, invertSequence(A))) continue;
  const effFR = canon.clone(); effFR.applySequence(A);
  const cond = f2lSolved(effFR) ? "pure" : frSolved(effFR) ? "fr" : "other";

  const slotsOut: any[] = [];
  for (const s of SLOTS) {
    checked++;
    const t = canon.clone();
    if (s.r && !apply(t, s.r)) { fail++; fails.push(`${p} ${s.slot}: rot`); continue; }
    const seq = s.rInv ? `${s.rInv} ${A} ${s.r}` : A;
    if (!apply(t, seq)) { fail++; fails.push(`${p} ${s.slot}: apply ${seq}`); continue; }
    if (s.rInv && !apply(t, s.rInv)) { fail++; fails.push(`${p} ${s.slot}: unrot`); continue; }
    const ok = cond === "pure" ? f2lSolved(t) : cond === "fr" ? frSolved(t) : true;
    if (!ok) { fail++; fails.push(`${p} ${s.slot}: ${A}`); }
    // cierre del bucle (2 pasos):
    //  1) setupS aplicado a resuelto debe crear el caso en ESE slot (== r·canon).
    //     Nota: una rotación de cubo NO es la identidad sobre el estado (permuta
    //     piezas), por eso el setup del slot es "S_p r" (setup canónico + rotación)
    //     y NO la forma conjugada (rInv S_p r da r·S_p·(rInv·solved) != caso).
    //  2) algS a continuación debe resolver el CUBO COMPLETO (tras des-rotar).
    const setupS = s.r ? `${setup} ${s.r}` : setup;
    const rotatedCase = canon.clone();
    if (s.r && !apply(rotatedCase, s.r)) { fail++; fails.push(`${p} ${s.slot}: rot canon`); continue; }
    const chk = new CubeState();
    if (apply(chk, setupS)) {
      if (!stateEq(chk, rotatedCase)) { fail++; fails.push(`${p} ${s.slot}: setup no crea el caso (${setupS})`); }
      if (apply(chk, seq)) {
        if (s.rInv) apply(chk, s.rInv);
        if (!stateEq(chk, SOLVED)) { fail++; fails.push(`${p} ${s.slot}: setup+alg no resuelven (${setupS} | ${seq})`); }
      } else {
        fail++; fails.push(`${p} ${s.slot}: alg no parseable`);
      }
    } else {
      fail++; fails.push(`${p} ${s.slot}: setup no parseable`);
    }
    slotsOut.push({
      slot: s.slot,
      setup: setupS,
      alg: seq,
      condition: cond,
    });
  }
  out.slots[p] = { topAlg: A, speed: top.speed, f2lnum: TAX[p]?.f2lnum ?? null, aNum: TAX[p]?.aNum ?? null, position: TAX[p]?.position ?? null, slots: slotsOut };
}
writeFileSync(resolve(RAW, "slots-model.json"), JSON.stringify(out, null, 1));
console.log(`slots verificados: ${checked} (168 casos × 4) | fallos: ${fail}`);
if (fails.length) console.log("fallos:", fails.slice(0, 12).join(" | "));

// tabla de los 41 básicos
console.log("\n=== TOP-ALG POR SLOT — 41 BÁSICOS ===");
for (let n = 1; n <= 41; n++) {
  const entry = Object.values(out.slots as Record<string, any>).find((e: any) => e.f2lnum === `F2L ${n}`);
  if (!entry) continue;
  const p = Object.keys(out.slots).find((k) => out.slots[k] === entry)!;
  const row = entry.slots.map((s: any) => `${s.slot}: ${s.alg}`).join("  |  ");
  console.log(`  F2L ${String(n).padStart(2)} (${p}): ${row}`);
}
console.log(`\n-> slots-model.json (${Object.keys(out.slots).length} casos)`);
