/**
 * Independent sanity check of the 8 diverging algs (seed vs current verifier):
 *   - 4 AdvancedF2L algs currently flagged FAIL (in seed, shouldn't be)
 *   - 3 algs currently flagged VERIFIED (missing from seed: PLL T, ELL LR, AntiPLL E)
 * Uses only math-core CubeState + FaceletStringConverter (the same algebra the
 * verifier uses) with a minimal, hand-rolled oracle so the verdicts are auditable.
 */
import { CubeState, FaceletStringConverter } from '../../packages/math-core/src/index';
import { CaseStateGenerator } from '../../packages/algorithm-db/src/caseGenerator';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const cornerFacelet = [[8, 9, 20], [6, 18, 38], [0, 36, 47], [2, 45, 11], [29, 26, 15], [27, 44, 24], [33, 53, 42], [35, 17, 51]];
const edgeFacelet = [[5, 10], [7, 19], [3, 37], [1, 46], [32, 16], [28, 25], [30, 43], [34, 52], [23, 12], [21, 41], [50, 39], [48, 14]];
const CCOL = [["U", "R", "F"], ["U", "F", "L"], ["U", "L", "B"], ["U", "B", "R"], ["D", "F", "R"], ["D", "L", "F"], ["D", "B", "L"], ["D", "R", "B"]];
const ECOL = [["U", "R"], ["U", "F"], ["U", "L"], ["U", "B"], ["D", "R"], ["D", "F"], ["D", "L"], ["D", "B"], ["F", "R"], ["F", "L"], ["B", "L"], ["B", "R"]];
const flOf = (s: CubeState) => FaceletStringConverter.toFaceletString(s);
const SOLVED_FL = flOf(new CubeState());

function cubieHome(kind: 'c' | 'e', pos: number, fl: string): number {
  const idxs = kind === 'c' ? cornerFacelet[pos] : edgeFacelet[pos];
  const cols = idxs.map((i) => fl[i]).slice().sort().join('');
  const table = kind === 'c' ? CCOL : ECOL;
  return table.findIndex((c) => c.slice().sort().join('') === cols);
}
function identifyPair(fl: string): { homeC: number; homeE: number } {
  const c = cubieHome('c', 4, fl);
  const e = cubieHome('e', 8, fl);
  if (c >= 4 && c !== 4) return { homeC: c, homeE: [8, 9, 10, 11, 8, 9, 10, 11][c] };
  if (e >= 4 && e !== 8) return { homeC: [-1, -1, -1, -1, 7, 4, 5, 6, 4, 5, 6, 7][e], homeE: e };
  return { homeC: 4, homeE: 8 };
}
function pairHome(fl: string, homeC: number, homeE: number): boolean {
  return (
    cornerFacelet[homeC].every((i, k) => fl[i] === SOLVED_FL[cornerFacelet[homeC][k]]) &&
    edgeFacelet[homeE].every((i, k) => fl[i] === SOLVED_FL[edgeFacelet[homeE][k]])
  );
}
const apply = (s: CubeState, moves: string) => {
  for (const tok of moves.split(/\s+/).filter(Boolean)) s.applySequence(tok);
};

const SINGLE = ['', 'y', 'y2', "y'", 'x', 'x2', "x'", 'z', 'z2', "z'"];
const COMPOUND = ["y' x", "x y'", "y x'", "x' y", "z y", "y z", "x z", "z x", "y2 x", "x y2", "y2 z", "z y2"];
const ALL_POSTS = [...SINGLE, ...COMPOUND];

interface AlgRow { set: string; caseNumber: string; moves: string; setupScramble: string; expected: 'solve' | 'fail' }

// Load setups from the raw JSONs (source of truth for setups of these sets).
function loadSetups(file: string): Map<string, string> {
  const data = JSON.parse(readFileSync(resolve(__dirname, '../generated/' + file), 'utf-8'));
  const m = new Map<string, string>();
  for (const c of data.cases) {
    const jc = c.caseDef as { caseNumber: string; setupScramble?: string };
    if (!jc.setupScramble) continue;
    const s = m.get(jc.caseNumber) ?? '';
    m.set(jc.caseNumber, s || jc.setupScramble);
  }
  return m;
}
const pllSetups = loadSetups('scdb-pll.json');
const ellSetups = loadSetups('scdb-ell.json');
const antipllSetups = loadSetups('scdb-antipll.json');

// The 3 verified-but-missing algs (must SOLVE with current algebra) and the
// 4 failed-but-in-seed AdvancedF2L algs (must NOT solve their fused setups).
const ROWS: AlgRow[] = [
  { set: 'PLL', caseNumber: 'T', moves: "L M B S' D' E' L' U' F U2 L' U' L' U L U' F' S' S M R M' U E' E U' R'", setupScramble: pllSetups.get('T') ?? '?', expected: 'solve' },
  { set: 'ELL', caseNumber: 'LR Z', moves: "R' B' R' S R F R S' R' S D z'", setupScramble: ellSetups.get('LR Z') ?? '?', expected: 'solve' },
  { set: 'AntiPLL', caseNumber: 'E', moves: "R2 D R' U R D' R2 B' U' R' F U R U' F' U F S", setupScramble: antipllSetups.get('E') ?? '?', expected: 'solve' },
];

function verifyPllLike(setup: string, moves: string): boolean {
  const s = CaseStateGenerator.generateFromScramble(setup);
  for (const auf of ['', 'U', 'U2', "U'"]) {
    for (const post of ALL_POSTS) {
      const t = s.clone();
      t.applySequence(moves + (auf ? ' ' + auf : ''));
      apply(t, post);
      if (t.isSolved()) return true;
    }
  }
  return false;
}

function verifyF2lLike(setup: string, moves: string): boolean {
  const s = CaseStateGenerator.generateFromScramble(setup);
  const pair = identifyPair(flOf(s));
  for (const slotRot of ['', 'y', 'y2', "y'"]) {
    const s0 = s.clone();
    if (slotRot) s0.applySequence(slotRot);
    for (const post of ALL_POSTS) {
      const t = s0.clone();
      t.applySequence(moves);
      apply(t, post);
      if (pairHome(flOf(t), pair.homeC, pair.homeE)) return true;
    }
  }
  return false;
}

// Load the fused AdvancedF2L setups from the JSON (source of truth for setups).
const af2l = JSON.parse(readFileSync(resolve(__dirname, '../generated/scdb-af2l-fused.json'), 'utf-8'));
const setupOf = new Map<string, string>();
for (const c of af2l.cases) {
  const jc = c.caseDef as { caseNumber: string; setupScramble?: string };
  if (!jc.setupScramble) continue;
  const s = setupOf.get(jc.caseNumber) ?? '';
  setupOf.set(jc.caseNumber, s || jc.setupScramble);
}
const AF2L_ROWS: AlgRow[] = [
  { set: 'AdvancedF2L', caseNumber: 'Cr', moves: "L R B U2 L' B' L' R'", setupScramble: setupOf.get('Cr') ?? '?', expected: 'fail' },
  { set: 'AdvancedF2L', caseNumber: 'Ph', moves: "B' F R' F' R2 U R' B", setupScramble: setupOf.get('Ph') ?? '?', expected: 'fail' },
  { set: 'AdvancedF2L', caseNumber: 'Ph', moves: "F' U' L U2 L' B' U B F", setupScramble: setupOf.get('Ph') ?? '?', expected: 'fail' },
  { set: 'AdvancedF2L', caseNumber: 'Uj', moves: "L F L2 U L2 F' L'", setupScramble: setupOf.get('Uj') ?? '?', expected: 'fail' },
];

let ok = true;
for (const r of [...ROWS, ...AF2L_ROWS]) {
  console.log(`  setup: ${r.setupScramble.slice(0, 80)}`);
  const verifier = r.expected === 'solve' ? verifyPllLike : verifyF2lLike;
  const result = verifier(r.setupScramble, r.moves);
  const pass = result === (r.expected === 'solve');
  ok &&= pass;
  console.log(`${pass ? 'OK ' : 'BAD'} [${r.set} ${r.caseNumber}] ${r.expected === 'solve' ? 'solves' : 'fails'}: ${r.moves}  ->  ${result ? 'SOLVED' : 'NOT-SOLVED'}`);
}
console.log(ok ? '\nALL CONSISTENT with the current verifier report' : '\nMISMATCH — verifier verdict disputed');
