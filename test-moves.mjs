import { CubeState } from './packages/math-core/src/index.ts';
const tests = ['M2 U M2 U2 M2 U M2', "x R' U R' D2 R U' R' D2 R2 x'", "R U R' U' R' F R2 U' R' U' R U R' F'"];
for (const seq of tests) {
  try {
    const c = new CubeState();
    c.applySequence(seq);
    console.log('OK:', seq);
  } catch(e) {
    console.log('FAIL:', seq, '->', e.message);
  }
}
