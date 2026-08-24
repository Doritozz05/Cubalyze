/**
 * CONSTRUCCIÓN FINAL de los 4 pendientes:
 *  - Hn: T_Hn = T_Ht + flip (arista en BR, pieza 8) → setup(Ht) + G[q]
 *  - Sf: T_Sf = T_Sl + flip (arista en FL, pieza 8) → setup(Sl) + G[q]
 *  - Uh: T_Uh = T_Ur + flip (verificado por scan) → setup(Ur) + G[q]
 *  - Wh: T_Wh = T_Wr + flip → setup(Wr) + G[q]
 * G[q] = secuencia que voltea la arista en posición q sin tocar el resto del F2L.
 */
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { CubeState } from "../../packages/math-core/src/index";

const QA = JSON.parse(readFileSync(resolve(__dirname, "../raw/quest/quest-all.json"), "utf-8"));
const DERIVED = JSON.parse(readFileSync(resolve(__dirname, "../generated/setups-independent.json"), "utf-8"));
const CONSTRUCTED = JSON.parse(readFileSync(resolve(__dirname, "../generated/setups-constructed.json"), "utf-8"));
const CONSTRUCTED2 = JSON.parse(readFileSync(resolve(__dirname, "../generated/setups-constructed2.json"), "utf-8"));

function normQuest(s: string): string {
  return s.replace(/([RLUDFBMES]w?|[rludbfxyz])2'/g, "$12").replace(/’/g, "'");
}
function stateOf(moves: string): CubeState {
  const s = new CubeState();
  s.applySequence(normQuest(moves));
  return s;
}
function f2lEq(a: CubeState, b: CubeState): boolean {
  for (let i = 4; i <= 7; i++) if (a.cp[i] !== b.cp[i] || a.co[i] !== b.co[i]) return false;
  for (let i = 8; i <= 11; i++) if (a.ep[i] !== b.ep[i] || a.eo[i] !== b.eo[i]) return false;
  return true;
}

// ── G_q: secuencias de volteo de arista (conjugadas de F8, verificadas) ──
const F8 = "R F U F R F R U' F' U2 R2";
function buildFlipSeq(q: number): string {
  const candidates: [string, string][] = [["", ""], ["y2", "y2"], ["z2", "z2"], ["y", "y'"], ["y'", "y"], ["z", "z'"], ["z'", "z"], ["x2", "x2"]];
  for (const [c, cinv] of candidates) {
    const seq = [c, F8, cinv].filter(Boolean).join(" ");
    const s = new CubeState();
    try { s.applySequence(seq); } catch { continue; }
    let ok = true;
    for (let i = 4; i <= 7; i++) if (s.cp[i] !== i || s.co[i] !== 0) ok = false;
    for (let i = 8; i <= 11; i++) if (s.ep[i] !== i || s.eo[i] !== (i === q ? 1 : 0)) ok = false;
    if (ok) return seq;
  }
  return "";
}
const G: Record<number, string> = {};
for (const q of [8, 9, 10, 11]) G[q] = buildFlipSeq(q);
console.log("G8:", G[8] || "??", "\nG9:", G[9] || "??", "\nG10:", G[10] || "??", "\nG11:", G[11] || "??");

const ROTS = ["", "x", "x'", "x2", "y", "y'", "y2", "z", "z'", "z2", "x y", "x y'", "x y2", "x' y", "x' y'", "x' y2", "x2 y", "x2 y'", "x2 y2", "y x", "y x'", "y x2", "y' x", "y' x'", "y' x2"];

/** ¿qué posición de arista difiere entre A y B (módulo que el resto del F2L sea igual)? */
function flipPosDiff(Tbase: CubeState, Ttarget: CubeState): number | null {
  for (let q = 8; q <= 11; q++) {
    const s = Tbase.clone();
    const g = G[q];
    if (!g) continue;
    s.applySequence(g);
    if (f2lEq(s, Ttarget)) return q;
  }
  return null;
}

// estado base por patid (derivados + construidos)
const base: Record<string, string> = {};
for (const r of DERIVED) if (r.setup) base[r.patid] = r.setup;
for (const r of CONSTRUCTED) if (r.setup) base[r.patid] = r.setup;
for (const r of CONSTRUCTED2) if (r.setup) base[r.patid] = r.setup;

const results: any[] = [];
const NEEDED = ["Hn", "Ht", "Sf", "Sl", "Gh", "Lh", "Oh", "Th", "Ut", "Wl", "Uh", "Wh"];
const pending = ["Hn", "Sf", "Uh", "Wh"];

// 1) Hn / Sf: edgeFlipped de un caso YA construido con frame quest
const pairs: [string, string][] = [["Ht", "Hn"], ["Sl", "Sf"]];
for (const [from, to] of pairs) {
  const T = stateOf(normQuest(QA[to.toLowerCase()].setup));
  const Tbase = stateOf(normQuest(QA[from.toLowerCase()].setup));
  const q = flipPosDiff(Tbase, T);
  console.log(`\n${to} = edgeFlipped(${from}): q=${q}`);
  if (q === null) { results.push({ patid: to, status: "no-flip" }); continue; }
  const setup = `${base[from]} ${G[q]}`;
  const ok = f2lEq(stateOf(setup), T);
  console.log(`  setup(${from}) + G${q} → verificado: ${ok}`);
  results.push({ patid: to, status: ok ? "constructed" : "FAIL", setup, via: `edgeFlipped(${from}) + G${q}`, nOut: undefined, verified: ok });
}

// 2) Uh / Wh: scan rotación + flip sobre todos los derivados/construidos
for (const to of ["Uh", "Wh"]) {
  const T = stateOf(normQuest(QA[to.toLowerCase()].setup));
  let built: { setup: string; via: string } | null = null;
  console.log(`\n${to}: scan rotación+flip...`);
  for (const [pid, setupStr] of Object.entries(base)) {
    const S = stateOf(setupStr);
    for (const r of ROTS) {
      const R = S.clone();
      if (r) R.applySequence(r);
      for (const q of [8, 9, 10, 11]) {
        if (!G[q]) continue;
        const cand = R.clone();
        cand.applySequence(G[q]);
        if (f2lEq(cand, T)) {
          const setup = [r, setupStr, G[q]].filter(Boolean).join(" ");
          if (f2lEq(stateOf(setup), T)) built = { setup, via: `${pid} + G${q} (rot ${r || "-"})` };
          break;
        }
      }
      if (built) break;
    }
    if (built) break;
  }
  if (!built) {
    console.log(`  ❌ no encontrado`);
    results.push({ patid: to, status: "no-relation" });
    continue;
  }
  const S2 = stateOf(built.setup);
  const nOut = (() => {
    let n = 0;
    for (let c = 4; c <= 7; c++) { let p = -1; for (let i = 0; i < 8; i++) if (S2.cp[i] === c) p = i; if (p !== c) n++; }
    for (let e = 8; e <= 11; e++) { let p = -1; for (let i = 0; i < 12; i++) if (S2.ep[i] === e) p = i; if (p !== e) n++; }
    return n;
  })();
  results.push({ patid: to, status: "constructed", setup: built.setup, via: built.via, nOut, verified: f2lEq(S2, T) });
  console.log(`  ✅ ${built.via} (${nOut} fuera)`);
}

// 3) verificación final de los 12 (con los setups ya existentes)
const finalAll: any[] = [];
const allSetups: Record<string, string> = { ...base };
for (const r of results) if (r.setup) allSetups[r.patid] = r.setup;
for (const patid of NEEDED) {
  const setup = allSetups[patid];
  if (!setup) { finalAll.push({ patid, status: "sin-setup" }); continue; }
  const T = stateOf(normQuest(QA[patid.toLowerCase()].setup));
  const S = stateOf(setup);
  let nOut = 0;
  for (let c = 4; c <= 7; c++) { let p = -1; for (let i = 0; i < 8; i++) if (S.cp[i] === c) p = i; if (p !== c) nOut++; }
  for (let e = 8; e <= 11; e++) { let p = -1; for (let i = 0; i < 12; i++) if (S.ep[i] === e) p = i; if (p !== e) nOut++; }
  finalAll.push({ patid, status: "constructed", setup, via: results.find((r) => r.patid === patid)?.via || "derived", nOut, verified: f2lEq(S, T) });
}

writeFileSync(resolve(__dirname, "../generated/setups-final12.json"), JSON.stringify(finalAll, null, 1));
const ok12 = finalAll.filter((r) => r.status === "constructed" && r.verified).length;
console.log(`\n=== RESULTADO 12 ===`);
for (const r of finalAll) console.log(`  ${r.patid}: ${r.status} ${r.verified ? "✅" : "❌"} (${r.nOut} fuera)`);
console.log(`\n${ok12}/12 verificados`);
