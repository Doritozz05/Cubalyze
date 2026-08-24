/**
 * diag-2518-compare.ts — find the discrepancy between the analyzer's model-B
 * replay and the manual replay of variant 4.
 */
import { CubeState } from '../../packages/math-core';
import { analyzeReconstruction } from '../../packages/algorithm-db/src/recognition/reconstructionAnalyzer';
import { tokenize } from '../../packages/algorithm-db/src/recognition/moveNotation';
import { findRotationOfSolved, stateSignature, isRotationOfReference } from '../../packages/algorithm-db/src/recognition/rotationGroup';

const SCRAMBLE = "R' D F L D R U D F2 R2 D R' B L' B U2 B' D'";
const PHASES = [
  { name: 'Cross (W)', moves: "R D F D2 F' D'" },
  { name: 'F2L 1 (BL · OB)', moves: "U F U' F'" },
  { name: 'F2L 2 (FL · RB)', moves: "U' R U' R' U' R U' R' U R U' R'" },
  { name: 'F2L 3 (BR · GO)', moves: "y U2 R U R' y U R U' R'" },
  { name: 'F2L 4 (FR · GR/OLL skip)', moves: "y' U' R U2 R'" },
  { name: 'PLL (AUF)', moves: 'U2' },
];

const initialState = new CubeState();
initialState.applySequence('x2');

const result = analyzeReconstruction({ scramble: SCRAMBLE, phases: PHASES, initialState });
console.log('analyzer: finalSolved=', result.finalSolved, 'finalRotation=', result.finalRotation ?? 'null', 'inspection=', JSON.stringify(result.inspection));
console.log('analyzer last state sig:', stateSignature(result.states[result.states.length - 1]));

// Manual replay: x2·solved → scramble → x2 (recovered) → phases
const s = initialState.clone();
for (const t of tokenize(SCRAMBLE)) s.applySequence(t);
console.log('after scramble  sig:', stateSignature(s));
for (const t of tokenize(result.inspection)) s.applySequence(t);
console.log('after inspection sig:', stateSignature(s));
for (const ph of PHASES) for (const t of tokenize(ph.moves)) s.applySequence(t);
console.log('manual final sig:    ', stateSignature(s));
console.log('manual final rotation-of-solved:', findRotationOfSolved(s));
console.log('manual isSolved:', s.isSolved());

// Check: does the analyzer's probe (no second x2) match?
const probe = initialState.clone();
for (const t of tokenize(SCRAMBLE)) probe.applySequence(t);
for (const ph of PHASES) for (const t of tokenize(ph.moves)) probe.applySequence(t);
console.log('probe (no x2) rotation-of-solved:', findRotationOfSolved(probe), 'isSolved:', probe.isSolved());
