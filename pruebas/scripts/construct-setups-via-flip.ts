/**
 * CONSTRUCCIÓN v2 — scan exhaustivo de relaciones.
 *
 * Para cada caso pendiente X y cada caso derivado M (setup S_M):
 *   A) ¿∃ rotación r, arista q: rot(S_M·solved, r) con eo[q] volteado == T_X?
 *   B) ¿∃ r, {q1,q2}: dos aristas volteadas == T_X?
 *   C) mirror: mir(S_M) == T_X mod rotación?
 * setup(X) = r + S_M + G_q  (o combinación correspondiente).
 */
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { CubeState } from "../../packages/math-core/src/index";

const QA = JSON.parse(readFileSync(resolve(__dirname, "../raw/quest/quest-all.json"), "utf-8"));
const DERIVED = JSON.parse(readFileSync(resolve(__dirname, "../generated/setups-independent.json"), "utf-8"));

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
const ROTS = ["", "x", "x'", "x2", "y", "y'", "y2", "z", "z'", "z2", "x y", "x y'", "x y2", "x' y", "x' y'", "x' y2", "x2 y", "x2 y'", "x2 y2", "y x", "y x'", "y x2", "y' x", "y' x'", "y' x2"];

// ── G_q: secuencias de volteo (conjugadas de F8, verificadas) ─────────────
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

// ── mirror transform ───────────────────────────────────────────────────────
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

const NEEDED = ["Gh", "Hn", "Ht", "Lh", "Oh", "Sf", "Sl", "Th", "Uh", "Ut", "Wh", "Wl"];
const derived = DERIVED.filter((r: any) => r.status === "derived" && r.setup && !r.basic);

const out: any[] = [];
for (const patid of NEEDED) {
  const q = QA[patid.toLowerCase()];
  if (!q) { out.push({ patid, status: "sin-quest" }); continue; }
  const T = stateOf(normQuest(q.setup));
  let built: { setup: string; via: string } | null = null;

  for (const m of derived) {
    const S = stateOf(m.setup);
    // A) rotación + 1 volteo
    for (const r of ROTS) {
      const R = S.clone();
      if (r) R.applySequence(r);
      for (const qp of [8, 9, 10, 11]) {
        if (!G[qp]) continue;
        const cand = R.clone();
        cand.applySequence(G[qp]);
        if (f2lEq(cand, T)) {
          const setup = [r, m.setup, G[qp]].filter(Boolean).join(" ");
          if (f2lEq(stateOf(setup), T)) built = { setup, via: `${m.patid} + flip E${qp} (rot ${r || "-"})` };
          break;
        }
      }
      if (built) break;
    }
    if (built) break;
    // C) mirror
    const mir = mirrorSeq(m.setup);
    for (const r of ROTS) {
      const cand = stateOf([r, mir].filter(Boolean).join(" "));
      if (f2lEq(cand, T)) {
        const setup = [r, mir].filter(Boolean).join(" ");
        if (f2lEq(stateOf(setup), T)) built = { setup, via: `mirror(${m.patid}) (rot ${r || "-"})` };
        break;
      }
    }
    if (built) break;
  }

  if (!built) {
    console.log(`${patid}: ❌ sin relación con derivados`);
    out.push({ patid, status: "no-relation" });
    continue;
  }
  const S2 = stateOf(built.setup);
  const piecesOut: string[] = [];
  for (let c = 4; c <= 7; c++) { let p = -1; for (let i = 0; i < 8; i++) if (S2.cp[i] === c) p = i; if (p !== c) piecesOut.push(`C${c}`); }
  for (let e = 8; e <= 11; e++) { let p = -1; for (let i = 0; i < 12; i++) if (S2.ep[i] === e) p = i; if (p !== e) piecesOut.push(`E${e}`); }
  out.push({ patid, status: "constructed", setup: built.setup, via: built.via, nOut: piecesOut.length, verified: f2lEq(S2, T) });
  console.log(`${patid}: ✅ ${built.via} → ${built.setup} (${piecesOut.length} fuera)`);
}

writeFileSync(resolve(__dirname, "../generated/setups-constructed.json"), JSON.stringify(out, null, 1));
const ok = out.filter((r) => r.status === "constructed").length;
console.log(`\nconstruidos: ${ok}/${NEEDED.length}`);
