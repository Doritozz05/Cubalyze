/**
 * @cubeforge/training — Exercise catalog invariance tests.
 *
 * The catalog is the single source of truth for exercise ids that get
 * persisted in training_attempts. These tests guard the invariants the
 * rest of the app relies on:
 *   - every id is unique (FK-safe, no silent collisions)
 *   - drill/recognize exist for EVERY algorithm-db subset (incl. children)
 *   - algorithmic phases resolve to a real subset id
 *   - full-solve / srs-review exist per method + global
 */
import { describe, expect, it } from 'vitest';
import {
  buildExerciseCatalog,
  buildMethodPhases,
  EXERCISE_IDS,
  findSubsetId,
  masteryLevel,
} from '../catalog';
import { METHODS, SUBSETS, getChildSubsets, getSubsetsForMethod } from '@cubeforge/algorithm-db';

function allSubsetIds(methodId: string): string[] {
  const out: string[] = [];
  const visit = (id: string) => {
    for (const c of getChildSubsets(id)) {
      out.push(c.id);
      visit(c.id);
    }
  };
  for (const s of getSubsetsForMethod(methodId)) {
    out.push(s.id);
    visit(s.id);
  }
  return out;
}

describe('buildExerciseCatalog', () => {
  const catalog = buildExerciseCatalog();

  it('produces unique ids', () => {
    const ids = catalog.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('covers drill+recognize for every subset of every method (incl. children)', () => {
    for (const method of METHODS) {
      for (const subsetId of allSubsetIds(method.id)) {
        const ids = catalog.map((d) => d.id);
        expect(ids).toContain(EXERCISE_IDS.drill(subsetId));
        expect(ids).toContain(EXERCISE_IDS.recognize(subsetId));
      }
    }
  });

  it('emits full-solve + per-method srs-review for every method', () => {
    for (const method of METHODS) {
      const ids = catalog.map((d) => d.id);
      expect(ids).toContain(EXERCISE_IDS.fullSolve(method.id));
      expect(ids).toContain(EXERCISE_IDS.srsReview(method.id));
    }
    expect(catalog.map((d) => d.id)).toContain(EXERCISE_IDS.srsReview());
  });

  it('every definition carries a non-empty name and a valid kind', () => {
    const kinds = new Set(['drill', 'recognize', 'solve', 'srs', 'efficiency', 'detect']);
    for (const d of catalog) {
      expect(d.name.length).toBeGreaterThan(0);
      expect(kinds).toContain(d.kind);
    }
  });
});

describe('findSubsetId', () => {
  it('resolves every algorithmic phase to a real subset id', () => {
    for (const method of METHODS) {
      for (const phase of buildMethodPhases(method.name)) {
        if (!phase.hasAlgorithms) continue;
        const subsetId = findSubsetId(method.id, phase.id);
        expect(subsetId, `${method.id}/${phase.id} should resolve`).not.toBeNull();
        if (subsetId) {
          expect(SUBSETS.some((s) => s.id === subsetId), `${subsetId} must exist`).toBe(true);
        }
      }
    }
  });

  it('returns null for non-algorithmic phases', () => {
    expect(findSubsetId('cfop', 'cross')).toBeNull();
    expect(findSubsetId('roux', 'lse')).toBeNull();
  });
});

describe('masteryLevel', () => {
  it('labels mastery consistently', () => {
    expect(masteryLevel(0)).toBe('new');
    expect(masteryLevel(50)).toBe('beginner');
    expect(masteryLevel(70)).toBe('learning');
    expect(masteryLevel(95)).toBe('mastered');
  });
});
