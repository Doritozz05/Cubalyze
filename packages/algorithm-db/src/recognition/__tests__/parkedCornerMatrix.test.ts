import { describe, it, expect } from 'vitest';
import { CaseDetector } from '../caseDetector';
import {
  BASIC_F2L_SUBSET_MANIFEST,
  loadBasicF2LCases,
} from '../loaders/basicF2L';
import { solverStateForCase } from './helpers';

function makeDetector(): CaseDetector {
  return CaseDetector.create([BASIC_F2L_SUBSET_MANIFEST], loadBasicF2LCases);
}

/**
 * The 26 Basic F2L cases exercised here (name + setup).
 */
const ALL_CASES: [string, string][] = [
  ['Jb', "F R' F' R"],
  ['Mi', "R' F R F'"],
  ['Je', "F' U F"],
  ['Ma', "R U' R'"],
  ['Kb', "R U R' U' R U R'"],
  ['Pi', "R' F R F' U R U' R'"],
  ['Ki', "F R' F' R F R' F' R"],
  ['Pb', "R U' R' U R U' R'"],
  ['Ja', "R U R' U2' R U' R' U"],
  ['Me', "F' U' F U2' F' U F U'"],
  ['Jd', "R U R' U2' R U2' R' U"],
  ['Jq', "F' U F U' R U R' U"],
  ['Md', "R U' R' U' R U' R' U"],
  ['Jm', "F' U F U' R U2' R' U"],
  ['Cb', "R U' R' U R U2' R'"],
  ['Cd', "R U' R' U2' R U R'"],
  ['Vb', "F' R U R' U' R' F R"],
  ['Vi', "F' U' F U R U R' U'"],
  ['Cp', "R U R' F R' F' R U"],
  ['Cj', "R U' R' U R U' R' U R U' R'"],
  ['Jj', "R U R' U2' R U R' U"],
  ['Mj', "R U' R' U2' R U' R' U'"],
  ['Jp', "F' U F U' R U' R' U"],
  ['Kj', "R U' R' U R U2' R' U R U' R'"],
  ['Pj', "R U' R' U' R U R' U2' R U' R'"],
  ['Pp', "R F U R U' R' F' U' R'"],
];

describe('D-rotation matrix: same case with pair in other slots + AUF', () => {
  it('every case × slot × D-rotation × AUF detects the same case', () => {
    const detector = makeDetector();
    let total = 0;
    const failures: string[] = [];

    for (const [caseName, setup] of ALL_CASES) {
      for (const slot of ['FR', 'BR', 'BL', 'FL']) {
        // Faithful fixture: the case at `slot` with the slot's own pieces
        // in the pair config (conjugated setup — a real solver state).
        const base = solverStateForCase(setup, 'D', slot);
        // Rotating the whole cube by y/y2/y' moves the pair to another
        // slot — the "pieces in a slot that doesn't touch" scenario the
        // detector must be agnostic to. The slot NAME stays the original.
        const rots = ['', 'y', 'y2', "y'"];
        for (const rot of rots) {
          let s = base;
          if (rot) {
            const t = s.clone();
            t.applySequence(rot);
            s = t;
          }
          for (const auf of ['', 'U', 'U2', "U'"]) {
            total++;
            let st = s;
            if (auf) {
              const t = st.clone();
              t.applySequence(auf);
              st = t;
            }
            const r = detector.detect(st, 'D', slot);
            if (r.entry?.caseName !== caseName) {
              failures.push(
                `${slot} ${caseName} (rot=${rot || 'id'}, auf=${auf || 'id'}) -> ${r.entry?.caseName ?? 'NULL'} sig=${r.queriedSignature}`,
              );
            }
          }
        }
      }
    }

    console.log(`matrix: ${total} states checked, ${failures.length} failures`);
    for (const f of failures.slice(0, 60)) console.log('  FAIL:', f);
    expect(failures.length).toBe(0);
  });
});
