import { Cube2x2FaceletConverter, Cube2x2State, CubeState } from '@cubeforge/math-core';
import type {
  Algorithm,
  AlgorithmCase,
  AlgorithmSubset,
  AlgorithmViewPreferences,
  OrbitCamera,
} from '../schema';
import { getSubset } from '../methodRegistry';
import {
  CaseStateGenerator,
  SUBSET_VISUALIZATION,
  type VisualizationStyle,
} from '../caseGenerator';

export type F2LSlotId = 0 | 1 | 2 | 3;

export interface CasePresentationOptions {
  algorithm?: Pick<Algorithm, 'moves' | 'viewPreferences' | 'customViewAngle' | 'customDiagramRotation'> | null;
  selectedF2LSlot?: F2LSlotId;
  camera?: OrbitCamera;
}

/**
 * Renderer-neutral description of a case.
 *
 * The case state is always generated from AlgorithmCase.setupScramble. The
 * selected algorithm only contributes view preferences; its moves never
 * redefine the recognition state.
 */
export interface CaseRenderPlan {
  caseId: string;
  puzzleType: string;
  order: 2 | 3;
  source: 'setupScramble' | 'algorithm-fallback' | 'solved';
  engineFacelets: string;
  diagramColors: string[];
  visualizationStyle: VisualizationStyle;
  isF2L: boolean;
  isAdvancedF2L: boolean;
  selectedF2LSlot: F2LSlotId;
  modelRotationY: number;
  camera: OrbitCamera;
  diagramRotation?: number;
  /**
   * The case pair (corner + edge piece IDs) identified from the setup, for
   * F2L/Advanced F2L. The 3D mask keeps these two pieces colored wherever
   * they are (own slot, U layer, or trapped in another slot) and grays the
   * rest — matching SpeedcubeQuest's stickering.
   */
  pair?: { homeC: number; homeE: number } | null;
}

export const DEFAULT_CASE_CAMERA: OrbitCamera = {
  theta: Math.PI / 6,
  phi: Math.PI / 6,
  radius: 7,
};

export const F2L_SLOT_MODEL_ROTATIONS: Record<F2LSlotId, number> = {
  0: 0,
  1: -Math.PI / 2,
  2: Math.PI,
  3: Math.PI / 2,
};

const DEFAULT_GRAY = '#505050';

function normalizeCamera(camera?: OrbitCamera): OrbitCamera {
  const source = camera ?? DEFAULT_CASE_CAMERA;
  return {
    theta: Number.isFinite(source.theta) ? source.theta : DEFAULT_CASE_CAMERA.theta,
    phi: Number.isFinite(source.phi) ? source.phi : DEFAULT_CASE_CAMERA.phi,
    radius: Number.isFinite(source.radius) && source.radius > 0 ? source.radius : DEFAULT_CASE_CAMERA.radius,
  };
}

function normalizeSlot(slot: number | undefined): F2LSlotId {
  return slot === 1 || slot === 2 || slot === 3 ? slot : 0;
}

function resolveSubsetName(caseData: AlgorithmCase): string {
  return getSubset(caseData.subsetId)?.name ?? '';
}

/** Resolve the visual policy from a subset name, never from case names/categories. */
export function resolveVisualizationStyleForSubset(
  subsetName: string | undefined,
): VisualizationStyle {
  if (!subsetName) return 'full-color';
  if (SUBSET_VISUALIZATION[subsetName]?.style) {
    return SUBSET_VISUALIZATION[subsetName].style;
  }
  const lower = subsetName.toLowerCase();
  if (lower === 'coll') return 'coll';
  if (lower.includes('winter') || lower.includes('wv') || lower.includes('vls')) return 'wv';
  if (lower.includes('oll')) return 'yellow-gray';
  return 'full-color';
}

/** Resolve the visual policy from the case's canonical subset. */
export function resolveCaseVisualizationStyle(
  caseData: AlgorithmCase,
  subset?: AlgorithmSubset,
): VisualizationStyle {
  return resolveVisualizationStyleForSubset(subset?.name ?? resolveSubsetName(caseData));
}

export function isF2LCase(caseData: AlgorithmCase, subset?: AlgorithmSubset): boolean {
  const name = (subset?.name ?? resolveSubsetName(caseData)).toLowerCase();
  return name.includes('f2l') || caseData.tags.some((tag) => tag.toLowerCase() === 'f2l' || tag.toLowerCase() === 'af2l');
}

export function isAdvancedF2LCase(caseData: AlgorithmCase, subset?: AlgorithmSubset): boolean {
  const name = (subset?.name ?? resolveSubsetName(caseData)).toLowerCase();
  return name.includes('advanced') || name.includes('af2l') || caseData.tags.some((tag) => tag.toLowerCase() === 'af2l' || tag.toLowerCase() === 'advanced');
}

/**
 * Resolve persisted view preferences with a one-way compatibility fallback.
 * New data wins; legacy fields are only consulted when the new field is absent.
 */
export function resolveAlgorithmViewPreferences(
  algorithm: CasePresentationOptions['algorithm'],
): AlgorithmViewPreferences {
  if (!algorithm) return {};

  const legacyCamera = algorithm.customViewAngle
    ? {
        theta: algorithm.customViewAngle[0],
        phi: algorithm.customViewAngle[1],
        radius: algorithm.customViewAngle[2],
      }
    : undefined;

  return {
    camera: algorithm.viewPreferences?.camera ?? legacyCamera,
    diagramRotation:
      algorithm.viewPreferences?.diagramRotation ?? algorithm.customDiagramRotation,
    preferredF2LSlot: algorithm.viewPreferences?.preferredF2LSlot,
  };
}

/** Read the canonical 2D rotation while supporting historical records. */
export function resolveAlgorithmDiagramRotation(
  algorithm: CasePresentationOptions['algorithm'],
): number | undefined {
  return resolveAlgorithmViewPreferences(algorithm).diagramRotation;
}

// ─── Case pair identification (F2L) ────────────────────────────────────────
//
// Same rule as the seed verifier (scdb-alg-verification.test.ts), validated on
// a real cube: a trapped corner/edge in the FR slot means the pair belongs to
// ANOTHER slot; otherwise the pair is the FR slot pieces. Piece IDs follow the
// math-core Corner/Edge enums (corners 4-7 = D layer, edges 4-11 = D/E layer).
const MATE_EDGE_OF_CORNER = [8, 9, 10, 11, 8, 9, 10, 11];
const MATE_CORNER_OF_EDGE = [-1, -1, -1, -1, 7, 4, 5, 6, 4, 5, 6, 7];

function identifyPairFromState(s: CubeState): { homeC: number; homeE: number } {
  const c = s.cp[4];
  const e = s.ep[8];
  if (c >= 4 && c !== 4) return { homeC: c, homeE: MATE_EDGE_OF_CORNER[c] };
  if (e >= 4 && e !== 8) return { homeC: MATE_CORNER_OF_EDGE[e], homeE: e };
  return { homeC: 4, homeE: 8 };
}

function generateCanonical3x3(caseData: AlgorithmCase, algorithm?: CasePresentationOptions['algorithm'] | null) {
  if (caseData.setupScramble) {
    return {
      ...CaseStateGenerator.generateFromScrambleVisualization(caseData.setupScramble, 'full-color'),
      source: 'setupScramble' as const,
    };
  }

  if (algorithm?.moves?.length) {
    return {
      ...CaseStateGenerator.generateCaseVisualization(algorithm.moves, 'full-color'),
      source: 'algorithm-fallback' as const,
    };
  }

  const solved = new CubeState();
  const faceletString = CaseStateGenerator.toFaceletString(solved);
  return {
    state: solved,
    faceletString,
    diagramColors: CaseStateGenerator.faceletStringToDiagramColors(faceletString, 'full-color'),
    source: 'solved' as const,
  };
}

/**
 * Build the one canonical render plan consumed by every 2D/3D renderer.
 */
export function buildCaseRenderPlan(
  caseData: AlgorithmCase,
  options: CasePresentationOptions = {},
): CaseRenderPlan {
  const subset = getSubset(caseData.subsetId);
  const style = resolveCaseVisualizationStyle(caseData, subset);
  const is2x2 = caseData.puzzleType === '2x2x2';
  const f2l = isF2LCase(caseData, subset);
  const advancedF2L = f2l && isAdvancedF2LCase(caseData, subset);
  const prefs = resolveAlgorithmViewPreferences(options.algorithm);
  const selectedSlot = normalizeSlot(options.selectedF2LSlot ?? prefs.preferredF2LSlot);
  const camera = normalizeCamera(options.camera ?? prefs.camera);

  const canonical3x3 = generateCanonical3x3(caseData, options.algorithm);
  const diagramColors = CaseStateGenerator.faceletStringToDiagramColors(
    canonical3x3.faceletString,
    style,
  );

  // 3D must render the physical state produced by the canonical setup. The
  // clean facelets above are intentionally only for 2D recognition diagrams.
  let engineFacelets = canonical3x3.faceletString;
  let pair: CaseRenderPlan['pair'] = null;
  if (caseData.setupScramble) {
    const rawState = CaseStateGenerator.generateFromScramble(caseData.setupScramble);
    engineFacelets = CaseStateGenerator.toFaceletString(rawState);
    if (f2l && !is2x2) {
      pair = identifyPairFromState(rawState);
    }
  }
  if (is2x2) {
    const state = new Cube2x2State();
    if (caseData.setupScramble) {
      state.applySequence(caseData.setupScramble);
    } else if (options.algorithm?.moves?.length) {
      state.applySequence(options.algorithm.moves.map((move) => {
        if (move.endsWith("'")) return move.slice(0, -1);
        if (move.endsWith("2")) return move;
        return `${move}'`;
      }).reverse().join(' '));
    }
    engineFacelets = Cube2x2FaceletConverter.toFaceletString(state);
  }

  return {
    caseId: caseData.id,
    puzzleType: caseData.puzzleType,
    order: is2x2 ? 2 : 3,
    source: canonical3x3.source,
    engineFacelets,
    diagramColors,
    visualizationStyle: style,
    isF2L: f2l,
    isAdvancedF2L: advancedF2L,
    selectedF2LSlot: selectedSlot,
    modelRotationY: is2x2 ? 0 : F2L_SLOT_MODEL_ROTATIONS[selectedSlot],
    camera,
    diagramRotation: prefs.diagramRotation,
    pair,
  };
}

export const CASE_RENDER_GRAY = DEFAULT_GRAY;
