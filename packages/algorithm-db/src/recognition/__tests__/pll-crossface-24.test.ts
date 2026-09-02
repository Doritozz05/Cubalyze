import { describe, it, expect } from 'vitest';
import { CubeState } from '@cubeforge/math-core';
import { PLL_CASES } from '../../seed/cfop-pll';
import { createCFOPDetector } from '../loaders/lastLayer';

// The 24-rotation group, closed under the 9 base rotations.
function rotationGroup(): string[] {
  const bases = ['x', "x'", 'x2', 'y', "y'", 'y2', 'z', "z'", 'z2'];
  const seen = new Set<string>(['']);
  const group: string[] = [''];
  const queue: string[] = [''];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const b of bases) {
      const next = `${cur} ${b}`.trim();
      const c = new CubeState();
      c.applySequence(next);
      const k = `${Array.from(c.cp).join(',')}|${Array.from(c.ep).join(',')}`;
      if (!seen.has(k)) {
        seen.add(k);
        group.push(next);
        queue.push(next);
      }
    }
  }
  return group;
}

/** The face holding the cross pieces (IDs 4-7 = D-family) after a rotation. */
function crossFaceOf(state: CubeState): string {
  // U positions 0-3, D 4-7, F {0,1,4,5}, B {2,3,6,7}, R {0,3,4,7}, L {1,2,5,6}
  const faces: [string, number[]][] = [
    ['U', [0, 1, 2, 3]],
    ['D', [4, 5, 6, 7]],
    ['F', [0, 1, 4, 5]],
    ['B', [2, 3, 6, 7]],
    ['R', [0, 3, 4, 7]],
    ['L', [1, 2, 5, 6]],
  ];
  for (const [name, pos] of faces) {
    const pieces = pos.map((p) => state.cp[p]);
    if (pieces.every((p) => p >= 4 && p <= 7)) return name;
  }
  return '?';
}

describe('crossFace probe invariance over the 24 rotations', () => {
  it('detects Ja under EVERY cross face / rotation', () => {
    const ja = PLL_CASES.find((c) => c.caseDef.caseNumber === 'Ja')!;
    const setup = (ja.algorithms.find((a) => a.isDefault) ?? ja.algorithms[0]).moves.join(' ');
    const seed = new CubeState();
    seed.applySequence(setup);

    const det = createCFOPDetector();
    let failures = 0;
    const seenFaces = new Set<string>();
    for (const rot of rotationGroup()) {
      const s = seed.clone();
      s.applySequence(rot);
      const cf = crossFaceOf(s);
      seenFaces.add(cf);
      const r = det.detectWith(s, { probe: 'last-layer-permutation', crossFace: cf });
      const ok = r.entry?.caseNumber === 'Ja';
      if (!ok) {
        failures++;
        if (failures <= 12) {
          console.log('MISS rot=' + rot, 'crossFace=' + cf, '->', r.queriedSignature, r.entry?.caseNumber ?? 'NULL');
        }
      }
    }
    console.log('cross faces seen:', [...seenFaces].join(','));
    console.log('failures:', failures, '/', rotationGroup().length);
    expect(failures).toBe(0);
  });
});
