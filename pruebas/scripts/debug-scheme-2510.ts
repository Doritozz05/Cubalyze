/**
 * debug-scheme-2510.ts — settle the color-scheme question with data.
 *
 * Prints, for the USER version of recon #2510:
 *   - raw final state: isSolved / findRotationOfSolved
 *   - cross-end: detectCrossColor, the D-face edge stickers, pieces at 4-7
 *   - the remap result and the recolored final coherence
 */
import { CubeState, FaceletStringConverter } from '@cubeforge/math-core';
import {
  tokenize,
} from '../../packages/algorithm-db/src/recognition/moveNotation';
import {
  findRotationOfSolved,
  applyRotation,
} from '../../packages/algorithm-db/src/recognition/rotationGroup';
import {
  detectCrossColor,
  buildCatalogRemap,
  applyColorRemap,
  detectConventionFromColors,
} from '../../packages/algorithm-db/src/recognition/conventions';

const SCRAMBLE_A = "R2 F L' U B2 L2 D F' R' D' B2 D F L' D' F2 U2";
const SCRAMBLE_B = "U B U2 L U2 R2 F' U' R D2 F' D' B2 U D2 R2 B2 R2";

const USER_PHASES = [
  { name: 'Cross', moves: "D2 L U R' U'" },
  { name: 'F2L 1 (BL · Pj)', moves: "D' L' U L U' L' U L D" },
  { name: 'F2L 2 (FR · Jm)', moves: "U2 y' L' U L U' L' U L U2 L' U L" },
  { name: 'F2L 3 (FL · Jb)', moves: "U' L U' L'" },
  { name: 'F2L 4 (BR · Ci)', moves: "y' R' U2 R U R' U' R" },
  { name: 'OLL', moves: "R' U' R' F R F' U R" },
  { name: 'PLL', moves: "U' R U R' U' D R2 U' R U' R' U R' U R2 D'" },
];

const CUBEROOT_PHASES = [
  { name: 'Inspection', moves: 'z y' },
  { name: 'Cross (W)', moves: "D2 L U R' U'" },
  { name: 'F2L 1 (BL · Pj)', moves: "x' D' L' U L U' L' U L D" },
  { name: 'F2L 2 (FR · Jm)', moves: "U2 y' L' U L U' L' U L U2 L' U L" },
  { name: 'F2L 3 (BR · Jb)', moves: "U2 U L U' L'" },
  { name: 'F2L 4 (BR · Ci)', moves: "y' R' U2 R U R' U' R" },
  { name: 'OLL', moves: "R' U' R' F R F' U R" },
  { name: 'PLL', moves: "U' R U R' U' D R2 U' R U' R' U R' U R2 D'" },
];

function faceLetter(i: number): string {
  if (i < 9) return 'U';
  if (i < 18) return 'R';
  if (i < 27) return 'F';
  if (i < 36) return 'D';
  if (i < 45) return 'L';
  return 'B';
}

function main(): void {
  // Exhaustive: find the scramble application variant that makes the USER
  // stream coherent (final = solved or rotation of solved) AND the cross
  // complete after the Cross phase.
  const variants: { label: string; fn: (s: CubeState, sc: string) => void }[] = [
    { label: 'scramble as-is', fn: (s, sc) => s.applySequence(sc) },
    { label: 'scramble inverse', fn: (s, sc) => s.applySequence(INVERT(sc)) },
    { label: 'z y then scramble', fn: (s, sc) => { s.applySequence('z y'); s.applySequence(sc); } },
    { label: 'scramble then z y', fn: (s, sc) => { s.applySequence(sc); s.applySequence('z y'); } },
    { label: 'scramble then x y', fn: (s, sc) => { s.applySequence(sc); s.applySequence('x y'); } },
    { label: 'y x then scramble', fn: (s, sc) => { s.applySequence('y x'); s.applySequence(sc); } },
  ];
  for (const [sl, sc] of [['A (17h*)', SCRAMBLE_A], ['B (WCA)', SCRAMBLE_B]] as const) {
    console.log(`########## SCRAMBLE ${sl} ##########`);
    for (const v of variants) {
      analyzeVariant(`USER / ${v.label}`, USER_PHASES, sc, v.fn);
    }
    console.log('');
  }
}

function INVERT(seq: string): string {
  const tokens = seq.trim().split(/\s+/).filter(Boolean);
  return tokens.slice().reverse().map((t) =>
    t.endsWith("'") ? t.slice(0, -1) : t.endsWith('2') ? t : t + "'",
  ).join(' ');
}

function analyzeVariant(
  label: string,
  phasesIn: { name: string; moves: string }[],
  scramble: string,
  applyScramble: (s: CubeState, sc: string) => void,
): void {
  const state = new CubeState();
  applyScramble(state, scramble);
  const tokens: string[] = [];
  const phaseEnds: number[] = [];
  for (const phase of phasesIn) {
    const moves = tokenize(phase.moves);
    tokens.push(...moves);
    phaseEnds.push(tokens.length - 1);
  }
  const states: CubeState[] = [];
  for (const token of tokens) {
    state.applySequence(token);
    states.push(state.clone());
  }
  const final = states[states.length - 1];
  const rot = findRotationOfSolved(final);
  const crossEnd = states[phaseEnds[0]];
  const facelets = FaceletStringConverter.toFaceletString(crossEnd);
  let crossFace = 'none';
  for (const face of ['U', 'R', 'F', 'D', 'L', 'B']) {
    const stickers: number[] = [];
    for (let e = 0; e < 12; e++) {
      const [a, b] = [[5, 10], [7, 19], [3, 37], [1, 46], [32, 16], [28, 25], [30, 43], [34, 52], [23, 12], [21, 41], [50, 39], [48, 14]][e];
      if (faceLetter(a) === face) stickers.push(facelets[a]);
      else if (faceLetter(b) === face) stickers.push(facelets[b]);
    }
    if (stickers.length === 4 && new Set(stickers).size === 1) crossFace = face;
  }
  console.log(
    `${label}: coherent=${rot ? `YES (${rot})` : 'NO'} cross-after-phase=${crossFace} crossColor=${detectCrossColor(crossEnd) ?? '-'}`,
  );
}

function analyze(label: string, phasesIn: { name: string; moves: string }[], scramble: string): void {
  console.log(`=== ${label} ===`);
  const state = new CubeState();
  state.applySequence(scramble);
  const tokens: string[] = [];
  const phaseEnds: number[] = [];
  for (const phase of phasesIn) {
    const moves = tokenize(phase.moves);
    tokens.push(...moves);
    phaseEnds.push(tokens.length - 1);
  }
  const states: CubeState[] = [];
  for (const token of tokens) {
    state.applySequence(token);
    states.push(state.clone());
  }

  const final = states[states.length - 1];
  console.log('final isSolved:', final.isSolved());
  console.log('final rotation of solved:', findRotationOfSolved(final) ?? 'NO');

  const crossEnd = states[phaseEnds[0]];
  const crossColor = detectCrossColor(crossEnd);
  console.log('detectCrossColor:', crossColor);
  const facelets = FaceletStringConverter.toFaceletString(crossEnd);
  // which face (if any) has 4 identical edge stickers?
  for (const face of ['U', 'R', 'F', 'D', 'L', 'B']) {
    const stickers: number[] = [];
    for (let e = 0; e < 12; e++) {
      const [a, b] = [[5, 10], [7, 19], [3, 37], [1, 46], [32, 16], [28, 25], [30, 43], [34, 52], [23, 12], [21, 41], [50, 39], [48, 14]][e];
      if (faceLetter(a) === face) stickers.push(facelets[a]);
      else if (faceLetter(b) === face) stickers.push(facelets[b]);
    }
    console.log(`face ${face} edge stickers: ${stickers.join('')}${stickers.length === 4 && new Set(stickers).size === 1 ? '  ← CROSS' : ''}`);
  }
  console.log('pieces at D positions 4-7 (cp):', [4, 5, 6, 7].map((p) => crossEnd.cp[p]).join(','));
  console.log('pieces at D positions 4-7 (ep):', [4, 5, 6, 7].map((p) => crossEnd.ep[p]).join(','));

  const conv = detectConventionFromColors(crossEnd);
  console.log('detectConventionFromColors:', conv ? JSON.stringify(conv) : 'null');

  const remap = buildCatalogRemap(crossColor);
  console.log('remap:', JSON.stringify(remap));
  if (remap) {
    const recoloredFinal = applyColorRemap(final, remap);
    console.log('recolored final isSolved:', recoloredFinal.isSolved());
    console.log('recolored final rotation of solved:', findRotationOfSolved(recoloredFinal) ?? 'NO');
    const recoloredCrossEnd = applyColorRemap(crossEnd, remap);
    console.log('recolored cross-end pieces at 4-7 (cp):', [4, 5, 6, 7].map((p) => recoloredCrossEnd.cp[p]).join(','));
    console.log('recolored cross-end pieces at 4-7 (ep):', [4, 5, 6, 7].map((p) => recoloredCrossEnd.ep[p]).join(','));
    console.log('recolored cross-end detectCrossColor:', detectCrossColor(recoloredCrossEnd));
  }
}

function ROTATION_OF(state: CubeState, reference: CubeState): boolean {
  for (let a = 0; a < 4; a++) {
    for (let b = 0; b < 4; b++) {
      const r = applyRotation(reference, ['', 'y', 'y2', "y'"][a] + ' ' + ['', 'x', 'x2', "x'"][b]);
      if (r.cp.every((v, i) => v === state.cp[i]) && r.ep.every((v, i) => v === state.ep[i])) {
        return true;
      }
    }
  }
  return false;
}

main();
