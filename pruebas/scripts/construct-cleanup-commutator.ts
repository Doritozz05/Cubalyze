/**
 * CLEANUP como UN commutador [A,B]: [A,B](S) == T (F2L).
 * A ≤ 4 movimientos, B ∈ {U, U', U2, R, R', R2, F, F', F2}.
 */
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { CubeState } from "../../packages/math-core/src/index";

const QA = JSON.parse(readFileSync(resolve(__dirname, "../raw/quest/quest-all.json"), "utf-8"));
const DERIVED = JSON.parse(readFileSync(resolve(__dirname, "../generated/setups-independent.json"), "utf-8"));

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
const FACES = ["U", "R", "F", "D", "L", "B"];
const MOVES: string[] = [];
for (const f of FACES) for (const t of ["", "'", "2"]) MOVES.push(f + t);

function genSeqs(maxLen: number): string[] {
  const out: string[] = [];
  const build = (prefix: string[], lastFace: string) => {
    if (prefix.length > 0) out.push(prefix.join(" "));
    if (prefix.length >= maxLen) return;
    for (const mv of MOVES) {
      const f = mv[0];
      if (f === lastFace) continue;
      build([...prefix, mv], f);
    }
  };
  build([], "");
  return out;
}
const AS = genSeqs(4);
console.log("secuencias A:", AS.length);

function findFullCommutator(S: CubeState, T: CubeState): string | null {
  const BS = ["U", "U'", "U2", "R", "R'", "R2", "F", "F'", "F2"];
  for (const a of AS) {
    for (const b of BS) {
      const seq = `${a} ${b} ${invertSeq(a)} ${invertSeq(b)}`;
      const s = S.clone();
      try { s.applySequence(seq); } catch { continue; }
      if (f2lEq(s, T)) return seq;
    }
  }
  return null;
}
/** también probar [A,B] con A hasta 4 + fallback: A·B·A' (3-cycle puro) */
function find3Cycle(S: CubeState, T: CubeState): string | null {
  for (const a of AS) {
    for (const b of ["U", "U'", "U2"]) {
      const seq = `${a} ${b} ${invertSeq(a)}`;
      const s = S.clone();
      try { s.applySequence(seq); } catch { continue; }
      if (f2lEq(s, T)) return seq;
    }
  }
  return null;
}

const NEEDED = ["Gh", "Lh", "Oh", "Th", "Ut", "Wl"];
const PARTNER: Record<string, string> = { Gh: "Gr", Lh: "Lr", Oh: "Or", Th: "Tr", Ut: "Un", Wl: "Wf" };

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

const out: any[] = [];
for (const patid of NEEDED) {
  const partner = PARTNER[patid];
  const dPartner = DERIVED.find((r: any) => r.patid === partner);
  if (!dPartner?.setup) { console.log(`${patid}: sin setup de ${partner}`); out.push({ patid, status: "sin-partner" }); continue; }
  const S = stateOf(dPartner.setup);
  const TP = stateOf(normQuest(QA[partner.toLowerCase()].setup));
  const T = stateOf(normQuest(QA[patid.toLowerCase()].setup));

  const t0 = Date.now();
  let cleanup = findFullCommutator(S, TP) ?? find3Cycle(S, TP);
  let flipEdge: number | null = null;
  for (let i = 8; i <= 11; i++) if (TP.eo[i] !== T.eo[i]) { flipEdge = flipEdge === null ? i : -1; }

  if (!cleanup) {
    console.log(`${patid}: ❌ sin cleanup commutador (${Date.now() - t0}ms)`);
    out.push({ patid, status: "no-cleanup" });
    continue;
  }
  if (flipEdge === null || flipEdge < 0 || !G[flipEdge]) {
    console.log(`${patid}: ❌ volteo raro ${flipEdge}`);
    out.push({ patid, status: "flip-weird" });
    continue;
  }
  const setup = `${dPartner.setup} ${cleanup} ${G[flipEdge]}`;
  const Sf = stateOf(setup);
  const ok = f2lEq(Sf, T);
  console.log(`${patid}: cleanup=${cleanup} flip=E${flipEdge} → ${ok ? "✅" : "❌"} (${Date.now() - t0}ms) | setup: ${setup}`);
  out.push({ patid, status: ok ? "constructed" : "verify-fail", setup, via: `${partner} + [A,B] + flip E${flipEdge}`, nOut: outCount(Sf), verified: ok });
}
writeFileSync(resolve(__dirname, "../generated/setups-constructed.json"), JSON.stringify(out, null, 1));
console.log(`\nconstruidos: ${out.filter((r) => r.status === "constructed").length}/${NEEDED.length}`);
