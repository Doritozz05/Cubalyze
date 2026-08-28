import { describe, it, expect } from 'vitest';
import { CubeState } from '@cubeforge/math-core';
import { recolorState } from '../crossFaceAdapter';
import { createCFOPDetector } from '../loaders/lastLayer';
import { PLL_CASES } from '../../seed/cfop-pll';

const keyOf = (c: CubeState) =>
  `${Array.from(c.cp as any).join(',')}|${Array.from(c.co as any).join(',')}|${Array.from(c.ep as any).join(',')}|${Array.from(c.eo as any).join(',')}`;

describe('recolorState round-trip', () => {
  it('recolor(scheme) then recolor(inverse scheme) is identity', () => {
    // B-cross solver scheme: physical B = cross color D, physical F = U, etc.
    const scheme: Record<string, string> = {
      B: 'D', U: 'B', D: 'F', R: 'R', L: 'L', F: 'U',
    };
    // inverse: canonical color letter -> physical face
    const invScheme: Record<string, string> = {};
    for (const f of 'URFDLB'.split('')) invScheme[scheme[f]] = f;

    const ja = PLL_CASES.find((c) => c.caseDef.caseNumber === 'Ja')!;
    const setup = (ja.algorithms.find((a) => a.isDefault) ?? ja.algorithms[0]).moves.join(' ');
    const s = new CubeState();
    s.applySequence(setup);
    // Put the cross on B physically: CROSS_TO_D[B] = x maps B->D, so x' maps D->B.
    s.applySequence("x'");
    const before = keyOf(s);
    console.log('before :', before);

    const recolored = recolorState(s, scheme);
    console.log('recolor:', keyOf(recolored));

    const back = recolorState(recolored, invScheme);
    console.log('back   :', keyOf(back));
    console.log('round-trip identity:', keyOf(back) === before);

    // Sanity: does the recolored state look like a canonical Ja (cross on D,
    // LL on U)? Check the cross pieces 4-7 occupy some layer.
    const cp = Array.from(recolored.cp as any) as number[];
    const crossPos = cp.map((p, i) => (p >= 4 && p <= 7 ? i : -1)).filter((i) => i >= 0);
    console.log('recolored cross-piece positions:', crossPos.join(','));
    const llPos = cp.map((p, i) => (p <= 3 ? i : -1)).filter((i) => i >= 0);
    console.log('recolored LL-piece positions :', llPos.join(','));

    expect(keyOf(back)).toBe(before);
  });

  it('brute-force: can recolor + ANY crossFace detect Ja for the B-cross scheme?', () => {
    const scheme: Record<string, string> = {
      B: 'D', U: 'B', D: 'F', R: 'R', L: 'L', F: 'U',
    };
    const ja = PLL_CASES.find((c) => c.caseDef.caseNumber === 'Ja')!;
    const setup = (ja.algorithms.find((a) => a.isDefault) ?? ja.algorithms[0]).moves.join(' ');
    const seed = new CubeState();
    seed.applySequence(setup);

    const bases = ['x', "x'", 'x2', 'y', "y'", 'y2', 'z', "z'", 'z2'];
    const seen = new Set<string>(['']);
    const rots: string[] = [''];
    const queue = [''];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const b of bases) {
        const next = `${cur} ${b}`.trim();
        const c = new CubeState();
        c.applySequence(next);
        const k = `${Array.from(c.cp as any).join(',')}|${Array.from(c.ep as any).join(',')}`;
        if (seen.has(k)) continue;
        seen.add(k);
        rots.push(next);
        queue.push(next);
      }
    }

    const det = createCFOPDetector();
    const faceOf = (s: CubeState): string => {
      const faces: [string, number[]][] = [
        ['U', [0, 1, 2, 3]], ['D', [4, 5, 6, 7]], ['F', [0, 1, 4, 5]],
        ['B', [2, 3, 6, 7]], ['R', [0, 3, 4, 7]], ['L', [1, 2, 5, 6]],
      ];
      for (const [n, pos] of faces) {
        if (pos.every((p) => (s.cp as any)[p] >= 4 && (s.cp as any)[p] <= 7)) return n;
      }
      return '?';
    };

    let any = false;
    for (const rot of rots) {
      const s = seed.clone();
      s.applySequence(rot);
      const rc = recolorState(s, scheme);
      const cf = faceOf(rc);
      if (cf === '?') continue;
      const r = det.detectWith(rc, { probe: 'last-layer-permutation', crossFace: cf });
      if (r.entry?.caseNumber === 'Ja') {
        any = true;
        console.log('HIT rot=' + rot, 'crossFace=' + cf, 'sig=' + r.queriedSignature);
      }
    }
    console.log('any recolor+crossFace combo detects Ja:', any);
    // FINDING: recolorState CANNOT express a B-cross state canonically — no
    // rotation × crossFace combination detects Ja. The facelet→piece rebuild
    // misassigns positions for rotation-type schemes (the recolored state's
    // cross pieces land on no single face), which is why the production
    // detectLL path must NOT recolor (analyzeSolveText now probes the raw
    // entries state, where crossFace is measured).
    expect(any).toBe(false);
  });
});
