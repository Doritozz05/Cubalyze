import { CubeState, FaceletStringConverter } from './packages/math-core/src/index';
import { Min2PhaseSolver } from './packages/solver-engine/src/Min2PhaseSolver';
import { invertMoveArray } from './packages/algorithm-db/src/caseGenerator';

const vPermMoves = ["R'",'U',"R'","U'",'y',"R'","F'",'R2',"U'","R'",'U',"R'",'F','R','F'];

// Generate raw case state
const rawState = new CubeState();
const invMoves = invertMoveArray(vPermMoves);
console.log('Inverse moves:', invMoves.join(' '));
rawState.applySequence(invMoves.join(' '));

const faceletStr = FaceletStringConverter.toFaceletString(rawState);
console.log('Facelet string:', faceletStr);
console.log('U-face:', faceletStr.substring(0, 9));
console.log('Is solved?', rawState.isSolved());
console.log('co:', Array.from(rawState.co));
console.log('eo:', Array.from(rawState.eo));
console.log('cp:', Array.from(rawState.cp));
console.log('ep:', Array.from(rawState.ep));

// Solve with Min2Phase
const solver = new Min2PhaseSolver();
const solution = solver.solve(rawState);
console.log('Min2Phase solution:', solution);

// Apply solution
if (solution) {
  const test = rawState.clone();
  try {
    test.applySequence(solution);
    console.log('After solution - is solved?', test.isSolved());
    console.log('After solution - co:', Array.from(test.co));
    console.log('After solution - eo:', Array.from(test.eo));
    console.log('After solution - cp:', Array.from(test.cp));
    console.log('After solution - ep:', Array.from(test.ep));
  } catch (e: any) {
    console.log('Error applying solution:', e.message);
  }
} else {
  console.log('No solution found!');
}
