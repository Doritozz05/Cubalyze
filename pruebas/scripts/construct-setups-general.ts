/**
 * CONSTRUCCIÓN v3 — scan general.
 *
 * Para cada caso pendiente X y cada alg puro A (de cualquier caso M):
 *   estado D = A⁻¹(solved)  (limpio, ≤4 fuera)
 *   ¿∃ rotación r, volteo(s) q: rot(D, r) con eo[q] volteado == T_X ?
 *   ¿∃ r: mirror(rot(D, r)) == T_X ?
 * setup(X) = invA + r + G_q   (o variantes)
 */
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { CubeState } from "../../packages/math-core/src/index";

const PARSED = JSON.parse(readFileSync(resolve(__dirname, "../raw/birdf2l/parsed.json"), "utf-8"));
const QA = JSON.parse(readFileSync(resolve(__dirname, "../raw/quest/quest-all.json"), "utf-8"));
const FUSED_A = JSON.parse(readFileSync(resolve(__dirname, "../generated/scdb-af2l-fused.json"), "utf-8")).cases;

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
function invertSeq(m: string): string {
  return m.split(" ").filter(Boolean).reverse().map((x) => INV[x] ?? x).join(" ");
}
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
function outCount(s: CubeState): number {
  const findPos = (arr: readonly number[], p: number) => { for (let i = 0; i < arr.length; i++) if (arr[i] === p) return i; return -1; };
  let n = 0;
  for (let c = 4; c <= 7; c++) if (findPos(s.cp, c) !== c) n++;
  for (let e = 8; e <= 11; e++) if (findPos(s.ep, e) !== e) n++;
  return n;
}
const ROTS = ["", "x", "x'", "x2", "y", "y'", "y2", "z", "z'", "z2", "x y", "x y'", "x y2", "x' y", "x' y'", "x' y2", "x2 y", "x2 y'", "x2 y2", "y x", "y x'", "y x2", "y' x", "y' x'", "y' x2"];

// ── G_q flip sequences ─────────────────────────────────────────────────────
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

const MIR: Record<string, string> = {
  R: "L'", "R'": "L", R2: "L2", L: "R'", "L'": "R", L2: "R2",
  F: "B'", "F'": "B", F2: "B2", B: "F'", "B'": "F", B2: "F2",
  U: "U'", "U'": "U", U2: "U2", D: "D'", "D'": "D", D2: "D2",
  x: "x'", "x'": "x", x2: "x2", y: "y'", "y'": "y", y2: "y2", z: "z'", "z'": "z", z2: "z2",
  M: "M'", "M'": "M", M2: "M2", E: "E", E2: "E2", "E'": "E'", S: "S'", "S'": "S", S2: "S2",
  r: "l'", "r'": "l", r2: "l2", l: "r'", "l'": "r", l2: "r2", f: "b'", "f'": "b", f2: "b2", b: "f'", "b'": "f", b2: "f2",
  d: "d'", "d'": "d", d2: "d2", u: "u'", "u'": "u", u2: "u2",
};
function mirrorSeq(m: string): string {
  return m.split(" ").filter(Boolean).map((x) => MIR[x] ?? x).join(" ");
}

// ── corpus de algs puros por caso (inverso ≤4 fuera, hasta 40 por caso) ───
const NEEDED = ["Gh", "Hn", "Ht", "Lh", "Oh", "Sf", "Sl", "Th", "Uh", "Ut", "Wh", "Wl"];
const pureByCase = new Map<string, { inv: string; len: number }[]>();
for (const [patid, entry] of Object.entries(PARSED) as any) {
  if (NEEDED.includes(patid)) continue;
  const fused = FUSED_A.find((c: any) => c.caseDef.caseNumber === patid);
  const algs: string[] = [];
  if (entry?.algs) algs.push(...entry.algs.map((a: any) => a.moves));
  if (fused?.algorithms) algs.push(...fused.algorithms.map((a: any) => (a.moves as string[]).join(" ")));
  const pures: { inv: string; len: number }[] = [];
  for (const a of algs) {
    let inv: string;
    try { inv = invertSeq(a); } catch { continue; }
    let s: CubeState;
    try { s = stateOf(inv); } catch { continue; }
    if (outCount(s) <= 4) pures.push({ inv, len: inv.split(" ").filter(Boolean).length });
  }
  pures.sort((a, b) => a.len - b.len);
  pureByCase.set(patid, pures.slice(0, 40));
}
console.log("casos con algs puros:", pureByCase.size);

// ── scan ───────────────────────────────────────────────────────────────────
const out: any[] = [];
for (const patid of NEEDED) {
  const q = QA[patid.toLowerCase()];
  const T = stateOf(normQuest(q.setup));
  let built: { setup: string; via: string } | null = null;
  let checked = 0;

  outer: for (const [mPatid, pures] of pureByCase) {
    for (const p of pures) {
      const D = stateOf(p.inv);
      for (const r of ROTS) {
        const R = D.clone();
        if (r) R.applySequence(r);
        // 1 volteo
        for (const qp of [8, 9, 10, 11]) {
          if (!G[qp]) continue;
          const cand = R.clone();
          cand.applySequence(G[qp]);
          checked++;
          if (f2lEq(cand, T)) {
            const setup = [p.inv, r, G[qp]].filter(Boolean).join(" ");
            if (f2lEq(stateOf(setup), T)) { built = { setup, via: `${mPatid} + flip E${qp} (rot ${r || "-"})` }; break outer; }
          }
        }
        // mirror
        const mr = mirrorSeq(p.inv);
        const candM = R.clone(); // rot(D) ya está... mirror del estado = aplicar mirrorSeq
        void candM;
        const sMir = stateOf([r, mr].filter(Boolean).join(" "));
        checked++;
        if (f2lEq(sMir, T)) {
          const setup = [r, mr].filter(Boolean).join(" ");
          if (f2lEq(stateOf(setup), T)) { built = { setup, via: `mirror(${mPatid}) (rot ${r || "-"})` }; break outer; }
        }
      }
    }
  }

  if (!built) { console.log(`${patid}: ❌ (${checked} checks)`); out.push({ patid, status: "no-relation", checks: checked }); continue; }
  const S = stateOf(built.setup);
  const nOut = outCount(S);
  out.push({ patid, status: "constructed", setup: built.setup, via: built.via, nOut, verified: f2lEq(S, T), checks: checked });
  console.log(`${patid}: ✅ ${built.via} (${nOut} fuera, ${checked} checks)`);
}

writeFileSync(resolve(__dirname, "../generated/setups-constructed.json"), JSON.stringify(out, null, 1));
const ok = out.filter((r) => r.status === "constructed").length;
console.log(`\nconstruidos: ${ok}/${NEEDED.length}`);
