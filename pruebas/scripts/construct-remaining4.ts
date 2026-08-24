/**
 * Construcción de Hn, Ht, Sf, Sl (cluster sin partner derivado).
 * Para cada pendiente X: buscar un caso derivado M cuyo setup state tenga las
 * MISMAS piezas F2L fuera que T_X, y un commutador [A,B] que lleve S_M → T_X.
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
function outSet(s: CubeState): string {
  const findPos = (arr: readonly number[], p: number) => { for (let i = 0; i < arr.length; i++) if (arr[i] === p) return i; return -1; };
  const o: string[] = [];
  for (let c = 4; c <= 7; c++) if (findPos(s.cp, c) !== c) o.push(`C${c}`);
  for (let e = 8; e <= 11; e++) if (findPos(s.ep, e) !== e) o.push(`E${e}`);
  return o.sort().join("");
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
const AS3 = genSeqs(3);
const AS4 = genSeqs(4);
const BS = ["U", "U'", "U2", "R", "R'", "R2", "F", "F'", "F2"];

function findCleanup(S: CubeState, T: CubeState): string | null {
  for (const a of AS3) {
    for (const b of BS) {
      const seq = `${a} ${b} ${invertSeq(a)} ${invertSeq(b)}`;
      const s = S.clone();
      try { s.applySequence(seq); } catch { continue; }
      if (f2lEq(s, T)) return seq;
    }
  }
  for (const a of AS4) {
    for (const b of BS) {
      const seq = `${a} ${b} ${invertSeq(a)} ${invertSeq(b)}`;
      const s = S.clone();
      try { s.applySequence(seq); } catch { continue; }
      if (f2lEq(s, T)) return seq;
    }
  }
  return null;
}

const NEEDED = ["Hn", "Ht", "Sf", "Sl"];
const derived = DERIVED.filter((r: any) => r.status === "derived" && r.setup && !r.basic);
// precargar estados de derivados
const states = derived.map((m: any) => ({ patid: m.patid, setup: m.setup, state: stateOf(m.setup), out: outSet(stateOf(m.setup)) }));

const out: any[] = [];
for (const patid of NEEDED) {
  const T = stateOf(normQuest(QA[patid.toLowerCase()].setup));
  const tOut = outSet(T);
  // candidatos: mismos pieces fuera (o subconjunto)
  const cands = states.filter((s: any) => s.out === tOut);
  console.log(`${patid} (fuera: ${tOut}): ${cands.length} derivados con mismas piezas`);
  let built: { setup: string; via: string } | null = null;
  for (const c of cands) {
    const t0 = Date.now();
    const cleanup = findCleanup(c.state, T);
    if (cleanup) {
      const setup = `${c.setup} ${cleanup}`;
      if (f2lEq(stateOf(setup), T)) {
        built = { setup, via: `${c.patid} + [A,B]` };
        console.log(`  ✅ ${c.patid}: cleanup=${cleanup} (${Date.now() - t0}ms)`);
        break;
      }
    }
  }
  if (!built) {
    // fallback: probar TODOS los derivados (no solo mismos pieces)
    console.log(`  ⚠️ sin candidato directo — scan general...`);
    for (const c of states) {
      const cleanup = findCleanup(c.state, T);
      if (cleanup) {
        const setup = `${c.setup} ${cleanup}`;
        if (f2lEq(stateOf(setup), T)) {
          built = { setup, via: `${c.patid} + [A,B] (general)` };
          console.log(`  ✅ ${c.patid}: cleanup=${cleanup}`);
          break;
        }
      }
    }
  }
  if (!built) { console.log(`  ❌`); out.push({ patid, status: "no-cleanup" }); continue; }
  const Sf = stateOf(built.setup);
  out.push({ patid, status: "constructed", setup: built.setup, via: built.via, nOut: outCount(Sf), verified: f2lEq(Sf, T) });
  console.log(`  setup: ${built.setup}`);
}
writeFileSync(resolve(__dirname, "../generated/setups-constructed.json"), JSON.stringify(out, null, 1));
console.log(`\nconstruidos: ${out.filter((r) => r.status === "constructed").length}/${NEEDED.length}`);
