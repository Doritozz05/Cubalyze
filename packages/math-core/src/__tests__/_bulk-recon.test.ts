import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CubeState } from '../CubeState';
import { conjugatePhaseStream, conjugateToBaseFrame } from '../notation/conjugateToBaseFrame';
import { tokenize } from '../notation/moveNotation';

const DATA_DIR = join(
  process.cwd(),
  '..',
  '..',
  'apps',
  'web',
  'public',
  'reconstructions',
  'data',
);

interface ReconRec {
  key: string;
  puzzle: string;
  methodGroup: string;
  scramble: string;
  phases: { moves: string }[];
}

describe('bulk reconstruction check (real baked data)', () => {
  it('reports solved ratio: naive split vs tokenize+conjugate', () => {
    const chunks = readdirSync(DATA_DIR)
      .filter((f) => f.startsWith('chunk-') && f.endsWith('.json'))
      .slice(0, 4); // first 4 chunks for speed
    let total = 0;
    let naiveSolved = 0;
    let newSolved = 0;
    const failures: string[] = [];

    for (const chunk of chunks) {
      const data = JSON.parse(readFileSync(join(DATA_DIR, chunk), 'utf8')) as {
        solves: ReconRec[];
      };
      for (const rec of data.solves) {
        if (rec.puzzle !== '3x3' || rec.methodGroup !== 'CFOP') continue;
        if (!rec.scramble || rec.phases.length === 0) continue;
        total++;
        const all = rec.phases.map((p) => p.moves).join(' ');

        const s1 = new CubeState();
        s1.applySequence(rec.scramble);
        s1.applySequence(
          conjugateToBaseFrame(all.trim().split(/\s+/).filter(Boolean)).join(' '),
        );
        if (s1.isSolved()) naiveSolved++;

        const s2 = new CubeState();
        s2.applySequence(rec.scramble);
        const { perPhase } = conjugatePhaseStream(rec.phases.map((p) => tokenize(p.moves)));
        s2.applySequence(perPhase.flat().join(' '));
        if (s2.isSolved()) {
          newSolved++;
        } else {
          failures.push(rec.key);
        }
      }
    }

    console.log(`TOTAL 3x3 CFOP: ${total}`);
    console.log(`NAIVE solved: ${naiveSolved} (${((naiveSolved / total) * 100).toFixed(1)}%)`);
    console.log(`NEW solved: ${newSolved} (${((newSolved / total) * 100).toFixed(1)}%)`);
    console.log(`STILL FAILING (${failures.length}):`, failures.slice(0, 10).join(', '));
    expect(true).toBe(true);
  });
});
