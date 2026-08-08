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

  it('uses subset policy: OLL is yellow-gray, PLL is full-color, COLL is coll, and WV is wv', () => {
    expect(resolveVisualizationStyleForSubset('OLL')).toBe('yellow-gray');
    expect(resolveVisualizationStyleForSubset('PLL')).toBe('full-color');
    expect(resolveVisualizationStyleForSubset('COLL')).toBe('coll');
    expect(resolveVisualizationStyleForSubset('Winter Variation')).toBe('wv');

    const ollCase = cases.find((item) => item.subsetId === '00000000-0000-4000-9000-000000000002');
    const pllCase = cases.find((item) => item.subsetId === '00000000-0000-4000-9000-000000000001');
    const collCase = cases.find((item) => item.subsetId === '00000000-0000-4000-9000-000000000014');
    const wvCase = cases.find((item) => item.subsetId === '00000000-0000-4000-9000-000000000005');
    expect(ollCase).toBeDefined();
    expect(pllCase).toBeDefined();
    expect(collCase).toBeDefined();
    expect(wvCase).toBeDefined();

    const ollPlan = buildCaseRenderPlan(ollCase!);
    const pllPlan = buildCaseRenderPlan(pllCase!);
    const collPlan = buildCaseRenderPlan(collCase!);
    const wvPlan = buildCaseRenderPlan(wvCase!);

    expect(ollPlan.visualizationStyle).toBe('yellow-gray');
    expect(pllPlan.visualizationStyle).toBe('full-color');
    expect(collPlan.visualizationStyle).toBe('coll');
    expect(wvPlan.visualizationStyle).toBe('wv');

    // COLL: top edges are 'Y', side strip edges are '#'
    expect(collPlan.diagramColors[1]).toBe('Y'); // UB top edge
    expect(collPlan.diagramColors[46]).toBe('#'); // UB side edge
    expect(collPlan.diagramColors[47]).not.toBe('#'); // ULB corner side sticker is colored

    // WV: top layer uses yellow-gray, middle/bottom layers use full color
    expect(wvPlan.diagramColors[4]).toBe('Y'); // U center
    expect(wvPlan.diagramColors[22]).toBe('G'); // F center in middle layer
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

  it('identifies the case pair for F2L and Advanced F2L plans (F2L stickering)', () => {
    const f2lCase = cases.find((item) => item.subsetId === '00000000-0000-4000-9000-000000000003');
    expect(f2lCase).toBeDefined();

    const plan = buildCaseRenderPlan(f2lCase!);
    expect(plan.isF2L).toBe(true);
    // Basic F2L pair = FR slot pieces (DFR corner 4 + FR edge 8).
    expect(plan.pair).toEqual({ homeC: 4, homeE: 8 });

    const advCase = cases.find((item) => item.subsetId === '00000000-0000-4000-9000-000000000004');
    expect(advCase).toBeDefined();
    const advPlan = buildCaseRenderPlan(advCase!);
    expect(advPlan.isF2L).toBe(true);
    expect(advPlan.isAdvancedF2L).toBe(true);
    // F2L/Advanced F2L pair corresponds to the selected slot (default FR: corner 4 + edge 8).
    expect(advPlan.pair).toEqual({ homeC: 4, homeE: 8 });
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
