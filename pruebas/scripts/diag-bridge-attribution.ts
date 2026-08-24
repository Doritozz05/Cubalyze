import { TimelineBuilder } from '../../packages/analysis-engine/src/timeline/TimelineBuilder';
import { PhaseSplitter } from '../../packages/analysis-engine/src/phases/PhaseSplitter';
import { CFOPDefinition } from '../../packages/math-core/src';
import { makeSolveFromScramble } from '../../packages/analysis-engine/src/__tests__/test-helpers';
import { recognizeSolve } from '../../packages/analysis-engine/src/recognition/solveRecognition';

const scrambles = [
  "R U R' U'",
  "R U R' U' R' F R F'",
  "R U R' U' R' F R2 U' R' U' R U R' F'", // T-perm
  "F R U R' U' F'", // OLL cross
  "R' U' F D2 L2 D' R2 U' B2 D' L2 B2 L' D B D2 B R' D L2 R' U' F",
];

for (const scramble of scrambles) {
  const { solveMoves } = makeSolveFromScramble(scramble);
  const timeline = TimelineBuilder.build(solveMoves, 'CFOP', undefined, scramble);
  PhaseSplitter.splitAndAnnotate(timeline, CFOPDefinition);

  const attributed = timeline.phases.reduce((n, p) => n + (p.endIndex - p.startIndex + 1), 0);
  const phaseNames = timeline.phases.map((p) => `${p.phaseName}[${p.startIndex}-${p.endIndex}]`).join(' ');
  const rec = recognizeSolve(timeline, scramble);

  console.log(`scramble=${JSON.stringify(scramble)}`);
  console.log(`  moves=${solveMoves.length} attributed=${attributed} phases: ${phaseNames}`);
  console.log(`  finalSolved=${rec?.finalSolved} finalRotation=${JSON.stringify(rec?.finalRotation)} inspection=${JSON.stringify(rec?.inspection)}`);
}
