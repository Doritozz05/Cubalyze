import { describe, expect, it } from 'vitest';
import {
  buildCaseRenderPlan,
  DEFAULT_CASE_CAMERA,
  F2L_SLOT_MODEL_ROTATIONS,
  resolveAlgorithmDiagramRotation,
  resolveAlgorithmViewPreferences,
  resolveVisualizationStyleForSubset,
} from '../index';
import { CaseStateGenerator } from '../caseGenerator';
import { getSeedData } from '../seed/index';

describe('canonical case presentation', () => {
  const { cases, algorithms } = getSeedData();

  it('uses subset policy: OLL is yellow-gray and PLL is full-color', () => {
    expect(resolveVisualizationStyleForSubset('OLL')).toBe('yellow-gray');
    expect(resolveVisualizationStyleForSubset('PLL')).toBe('full-color');

    const ollCase = cases.find((item) => item.subsetId === '00000000-0000-4000-9000-000000000002');
    const pllCase = cases.find((item) => item.subsetId === '00000000-0000-4000-9000-000000000001');
    expect(ollCase).toBeDefined();
    expect(pllCase).toBeDefined();

    const ollPlan = buildCaseRenderPlan(ollCase!);
    const pllPlan = buildCaseRenderPlan(pllCase!);
    expect(ollPlan.visualizationStyle).toBe('yellow-gray');
    expect(pllPlan.visualizationStyle).toBe('full-color');
    expect(ollPlan.diagramColors.every((color) => color === 'Y' || color === '#')).toBe(true);
    expect(pllPlan.diagramColors.some((color) => color !== '#' && color !== 'Y')).toBe(true);
  });

  it('always derives the case state from setupScramble when algorithm moves disagree', () => {
    const caseData = cases.find((item) => item.subsetId === '00000000-0000-4000-9000-000000000001');
    expect(caseData).toBeDefined();

    const algorithm = algorithms.find((item) => item.caseId === caseData!.id);
    expect(algorithm).toBeDefined();

    const plan = buildCaseRenderPlan(caseData!, {
      algorithm: { moves: ['R', 'U', "R'", "U'"] },
    });
    const expectedFacelets = CaseStateGenerator.toFaceletString(
      CaseStateGenerator.generateFromScramble(caseData!.setupScramble),
    );

    expect(plan.source).toBe('setupScramble');
    expect(plan.engineFacelets).toBe(expectedFacelets);
    expect(plan.engineFacelets).not.toBe(
      CaseStateGenerator.toFaceletString(
        CaseStateGenerator.generateCaseState(['R', 'U', "R'", "U'"]),
      ),
    );
  });

  it('resolves new preferences first and legacy fields as field-level fallbacks', () => {
    const legacy = {
      moves: [],
      customViewAngle: [1, 2, 9] as [number, number, number],
      customDiagramRotation: 135,
    };
    expect(resolveAlgorithmViewPreferences(legacy)).toEqual({
      camera: { theta: 1, phi: 2, radius: 9 },
      diagramRotation: 135,
      preferredF2LSlot: undefined,
    });

    const current = {
      ...legacy,
      viewPreferences: {
        camera: { theta: 3, phi: 4, radius: 11 },
      },
    };
    expect(resolveAlgorithmViewPreferences(current)).toEqual({
      camera: { theta: 3, phi: 4, radius: 11 },
      diagramRotation: 135,
      preferredF2LSlot: undefined,
    });
    expect(resolveAlgorithmDiagramRotation(current)).toBe(135);
  });

  it('keeps the preferred F2L slot and camera radius in the render plan', () => {
    const f2lCase = cases.find((item) => item.subsetId === '00000000-0000-4000-9000-000000000003');
    expect(f2lCase).toBeDefined();

    const plan = buildCaseRenderPlan(f2lCase!, {
      algorithm: {
        moves: [],
        viewPreferences: {
          preferredF2LSlot: 2,
          camera: { theta: 0.25, phi: 0.5, radius: 12 },
        },
      },
    });

    expect(plan.isF2L).toBe(true);
    expect(plan.selectedF2LSlot).toBe(2);
    expect(plan.modelRotationY).toBe(F2L_SLOT_MODEL_ROTATIONS[2]);
    expect(plan.camera).toEqual({ theta: 0.25, phi: 0.5, radius: 12 });
  });

  it('uses the stable default camera when no preference exists', () => {
    const caseData = cases[0];
    expect(buildCaseRenderPlan(caseData).camera).toEqual(DEFAULT_CASE_CAMERA);
  });
});
