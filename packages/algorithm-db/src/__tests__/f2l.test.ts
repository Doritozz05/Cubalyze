import { describe, it, expect } from 'vitest';
import { BASIC_F2L_CASES, ADVANCED_F2L_CASES, ALL_F2L_CASES, getSeedData } from '../seed/index';

describe('F2L Seed Database', () => {
  it('should contain 41 Basic F2L cases', () => {
    expect(BASIC_F2L_CASES).toHaveLength(41);
    for (const c of BASIC_F2L_CASES) {
      expect(c.caseDef.id).toBeDefined();
      expect(c.caseDef.caseNumber).toMatch(/^F2L \d+$/);
      expect(c.algorithms.length).toBeGreaterThan(0);
      expect(c.caseDef.setupScramble).toBeTruthy();
    }
  });

  it('should contain 54 Advanced F2L (AF2L) cases from SpeedCubeDB', () => {
    expect(ADVANCED_F2L_CASES).toHaveLength(54);
    for (const c of ADVANCED_F2L_CASES) {
      expect(c.caseDef.id).toBeDefined();
      expect(c.caseDef.caseNumber).toMatch(/^AF2L /);
      expect(c.algorithms.length).toBeGreaterThan(0);
      expect(c.caseDef.setupScramble).toBeTruthy();
    }
  });

  it('should include all F2L cases in getSeedData()', () => {
    const seedData = getSeedData();
    const f2lCasesInSeed = seedData.cases.filter((c) => c.tags.includes('f2l') || c.tags.includes('af2l'));
    expect(f2lCasesInSeed).toHaveLength(ALL_F2L_CASES.length);
  });
});
