/**
 * @cubeforge/training — Exercise Catalog (single source of truth)
 *
 * The REAL exercise identity catalog. Replaces the hardcoded phase/subset
 * catalogs and exercise_id strings that used to live inside the views.
 *
 * Canonical exercise IDs are stable strings persisted in `training_attempts`
 * and `training_exercises`:
 *   drill-<subsetId>            (execution drill on an algorithm subset)
 *   recognize-<subsetId>        (recognition quiz on an algorithm subset)
 *   plain-<phaseId>             (plain practice: cross/block/lse/eo)
 *   blind-<phaseId>             (blind practice: cross/block)
 *   cross-trainer-<phaseId>     (cross ≤8 / CN modes)
 *   eo-eff-<phaseId>            (EO efficiency challenge)
 *   eo-detect-<phaseId>         (EO detection quiz)
 *   lse-<subPhase>-<phaseId>    (LSE sub-phase: eo / ulur / mslice)
 *   srs-review-<methodId|all>   (SRS daily review queue)
 *   full-solve-<methodId>       (full solve with phase targets)
 */

import { METHODS, SUBSETS, getSubsetsForMethod, getChildSubsets, type AlgorithmMethod } from '@cubeforge/algorithm-db';

// ─── Canonical exercise ID builders ───────────────────────────────────────
//
// Phase-based ids are METHOD-QUALIFIED because phase ids repeat across
// methods (e.g. `oll` in CFOP and Ortega) — an unqualified `plain-oll` would
// be ambiguous. Subset-based ids (drill/recognize) are already globally
// unique because algorithm-db subset ids are method-scoped.

export const EXERCISE_IDS = {
  drill: (subsetId: string) => `drill-${subsetId}`,
  recognize: (subsetId: string) => `recognize-${subsetId}`,
  plain: (methodId: string, phaseId: string) => `plain-${methodId}-${phaseId}`,
  blind: (methodId: string, phaseId: string) => `blind-${methodId}-${phaseId}`,
  crossTrainer: (methodId: string, phaseId: string) => `cross-trainer-${methodId}-${phaseId}`,
  crossTrainerCn: (methodId: string, phaseId: string) => `cn-${methodId}-${phaseId}`,
  speedEfficiency: (methodId: string, phaseId: string) => `se-${methodId}-${phaseId}`,
  eoEfficiency: (methodId: string, phaseId: string) => `eo-eff-${methodId}-${phaseId}`,
  eoDetect: (methodId: string, phaseId: string) => `eo-detect-${methodId}-${phaseId}`,
  lse: (subPhase: string, methodId: string, phaseId: string) => `lse-${subPhase}-${methodId}-${phaseId}`,
  srsReview: (methodId?: string) => `srs-review-${methodId ?? 'all'}`,
  fullSolve: (methodId: string) => `full-solve-${methodId}`,
} as const;

// ─── Method phases (pure data — ported out of the Dashboard) ──────────────

export interface PhaseDefinition {
  id: string;
  name: string;
  description: string;
  sortOrder: number;
  /** Algorithmic phases get Drill + Recognize; intuitive ones get practice modes. */
  hasAlgorithms: boolean;
}

/** Phases per method NAME (methods are keyed by name in the UI). */
export const METHOD_PHASES: Record<string, PhaseDefinition[]> = {
  CFOP: [
    { id: 'cross', name: 'Cross', description: 'Solve the cross efficiently. Fewer moves, faster solutions.', sortOrder: 1, hasAlgorithms: false },
    { id: 'f2l', name: 'F2L', description: 'Basic first two layers — 41 algorithmic pairs.', sortOrder: 2, hasAlgorithms: true },
    { id: 'af2l', name: 'Advanced F2L', description: 'Advanced first two layers — 54 trapped & keyhole cases.', sortOrder: 3, hasAlgorithms: true },
    { id: 'oll', name: 'OLL', description: 'Orient last layer — 57 cases to master.', sortOrder: 4, hasAlgorithms: true },
    { id: 'pll', name: 'PLL', description: 'Permute last layer — 21 cases for the final step.', sortOrder: 5, hasAlgorithms: true },
  ],
  Roux: [
    { id: 'first-block', name: 'First block', description: 'Build a 1×2×3 block on the left.', sortOrder: 1, hasAlgorithms: false },
    { id: 'second-block', name: 'Second block', description: 'Build the right 1×2×3 block efficiently.', sortOrder: 2, hasAlgorithms: false },
    { id: 'cmll', name: 'CMLL', description: 'Corners of last layer — 42 cases.', sortOrder: 3, hasAlgorithms: true },
    { id: 'lse', name: 'LSE', description: 'Last six edges — EO, UL/UR, M-slice.', sortOrder: 4, hasAlgorithms: false },
  ],
  ZZ: [
    { id: 'eoline', name: 'EOLine', description: 'Edge Orientation + Line. No rotations needed.', sortOrder: 1, hasAlgorithms: false },
    { id: 'f2l-zz', name: 'F2L (ZZ)', description: 'First two layers using only R, U, L moves.', sortOrder: 2, hasAlgorithms: true },
    { id: 'll-zz', name: 'Last layer', description: 'OCLL, COLL, ZZLL — last layer for ZZ.', sortOrder: 3, hasAlgorithms: true },
  ],
  Petrus: [
    { id: 'block-222', name: '2×2×2 block', description: 'Build the first 2×2×2 block.', sortOrder: 1, hasAlgorithms: false },
    { id: 'block-223', name: '2×2×3 block', description: 'Extend to a 2×2×3 block.', sortOrder: 2, hasAlgorithms: false },
    { id: 'eo-petrus', name: 'EO', description: 'Edge Orientation after blocks.', sortOrder: 3, hasAlgorithms: false },
    { id: 'f2l-petrus', name: 'F2L (Petrus)', description: 'Finish F2L after EO.', sortOrder: 4, hasAlgorithms: true },
    { id: 'll-petrus', name: 'Last layer', description: 'COLL + EPLL for Petrus last layer.', sortOrder: 5, hasAlgorithms: true },
  ],
  Ortega: [
    { id: 'oll', name: 'OLL (2×2)', description: 'Orient top face — 7 cases to master.', sortOrder: 1, hasAlgorithms: true },
    { id: 'pbl', name: 'PBL', description: 'Permute Both Layers — 6 cases for 2×2.', sortOrder: 2, hasAlgorithms: true },
  ],
  CLL: [
    { id: 'cll', name: 'CLL', description: 'Corners of Last Layer — 42 cases for 2×2.', sortOrder: 1, hasAlgorithms: true },
  ],
  EG: [
    { id: 'eg1', name: 'EG-1', description: 'Bottom layer adjacent swap — 42 cases.', sortOrder: 1, hasAlgorithms: true },
    { id: 'eg2', name: 'EG-2', description: 'Bottom layer diagonal swap — 42 cases.', sortOrder: 2, hasAlgorithms: true },
  ],
};

export function buildMethodPhases(methodName: string): PhaseDefinition[] {
  return METHOD_PHASES[methodName] ?? [];
}

export function getMethodPhases(methodId: string): PhaseDefinition[] {
  const method = METHODS.find((m) => m.id === methodId);
  return method ? buildMethodPhases(method.name) : [];
}

// ─── Phase → subset mapping (algorithm-db subsets by NAME) ────────────────

/** phaseId → algorithm-db subset NAME (stable across method variants). */
const PHASE_TO_SUBSET_NAME: Record<string, string> = {
  oll: 'OLL', pll: 'PLL', f2l: 'Basic F2L', af2l: 'Advanced F2L', cmll: 'CMLL',
  'f2l-zz': 'Basic F2L', 'll-zz': 'OCLL', 'f2l-petrus': 'Basic F2L', 'll-petrus': 'COLL',
  pbl: 'PBL', cll: 'CLL', eg1: 'EG-1', eg2: 'EG-2',
};

/** Resolve the algorithm-db subset id for a (method, phase) pair, if any. */
export function findSubsetId(methodId: string, phaseId: string): string | null {
  const subsetName = PHASE_TO_SUBSET_NAME[phaseId];
  if (!subsetName) return null;
  const subset =
    SUBSETS.find((s) => s.methodId === methodId && s.name === subsetName) ??
    SUBSETS.find((s) => s.name === subsetName);
  return subset?.id ?? null;
}

// ─── Practice modes for intuitive phases ──────────────────────────────────

export type PhasePracticeType = 'cross' | 'block' | 'lse' | 'eo';

const PHASE_PRACTICE_TYPES: Record<string, PhasePracticeType> = {
  cross: 'cross',
  eoline: 'cross',
  'first-block': 'block',
  'second-block': 'block',
  'block-222': 'block',
  'block-223': 'block',
  lse: 'lse',
  'eo-petrus': 'eo',
};

export function getPhasePracticeType(phaseId: string): PhasePracticeType | null {
  return PHASE_PRACTICE_TYPES[phaseId] ?? null;
}

export interface PhaseModeDefinition {
  id: string;
  label: string;
}

export const PHASE_MODES: Record<PhasePracticeType, PhaseModeDefinition[]> = {
  cross: [
    { id: 'plain', label: 'Plain' },
    { id: 'blind', label: 'Blind' },
    { id: 'optimal', label: '≤8' },
    { id: 'cn', label: 'CN' },
  ],
  block: [
    { id: 'plain', label: 'Plain' },
    { id: 'blind', label: 'Blind' },
    { id: 'speed-vs-eff', label: 'S/E' },
  ],
  lse: [
    { id: 'plain', label: 'Full' },
    { id: 'eo', label: 'EO' },
    { id: 'ulur', label: 'UL/UR' },
    { id: 'mslice', label: 'M' },
  ],
  eo: [
    { id: 'plain', label: 'Plain' },
    { id: 'detect', label: 'Detect' },
    { id: 'efficiency', label: '≤mvs' },
  ],
};

export function getPhaseModes(phaseType: PhasePracticeType): PhaseModeDefinition[] {
  return PHASE_MODES[phaseType] ?? [];
}

// ─── Mastery label (single source of truth, shared with the Dashboard) ───

export type MasteryLabel = 'new' | 'beginner' | 'learning' | 'mastered';

/** 0-100 mastery → human label. Exported so every view labels identically. */
export function masteryLevel(mastery: number): MasteryLabel {
  if (mastery >= 90) return 'mastered';
  if (mastery >= 60) return 'learning';
  if (mastery > 0) return 'beginner';
  return 'new';
}

export const MASTERY_LABEL_TEXT: Record<MasteryLabel, string> = {
  new: 'New',
  beginner: 'Beginner',
  learning: 'Learning',
  mastered: 'Mastered',
};

// ─── DB-seedable exercise definitions ─────────────────────────────────────

export interface ExerciseDefinition {
  id: string;
  name: string;
  description: string;
  kind: 'drill' | 'recognize' | 'solve' | 'srs' | 'efficiency' | 'detect';
  methodId?: string;
  phaseId?: string;
  subsetId?: string;
}

function phaseDescription(method: AlgorithmMethod, phase: PhaseDefinition): string {
  return `${phase.name} — ${phase.description}`;
}

/**
 * Enumerate every exercise the app can persist, derived from the real
 * algorithm-db catalog (methods + subsets) and the phase model above.
 * Used to seed `training_exercises` so the FK on exercise_id holds for
 * every id the views write.
 */
/** Every algorithm-db subset for a method, including children. */
function allSubsetsForMethod(methodId: string): { id: string; name: string }[] {
  const out: { id: string; name: string }[] = [];
  const visit = (subsetId: string) => {
    const children = getChildSubsets(subsetId);
    for (const c of children) {
      out.push({ id: c.id, name: c.name });
      visit(c.id);
    }
  };
  for (const top of getSubsetsForMethod(methodId)) {
    out.push({ id: top.id, name: top.name });
    visit(top.id);
  }
  return out;
}

export function buildExerciseCatalog(): ExerciseDefinition[] {
  const defs: ExerciseDefinition[] = [];

  for (const method of METHODS) {
    // Full solve + per-method SRS review.
    defs.push({
      id: EXERCISE_IDS.fullSolve(method.id),
      name: 'Full Solve',
      description: 'Complete solve with phase tracking and target splits.',
      kind: 'solve',
      methodId: method.id,
    });
    defs.push({
      id: EXERCISE_IDS.srsReview(method.id),
      name: 'SRS Review',
      description: 'Spaced-repetition daily review queue for this method.',
      kind: 'srs',
      methodId: method.id,
    });

    // Drill + Recognize for EVERY algorithm subset (top-level and children) so
    // the FK on training_attempts.exercise_id holds for any subset a view or
    // the Algorithms→Training bridge can target.
    for (const subset of allSubsetsForMethod(method.id)) {
      defs.push({
        id: EXERCISE_IDS.drill(subset.id),
        name: `Drill — ${subset.name}`,
        description: `Execution drill on ${subset.name}.`,
        kind: 'drill',
        methodId: method.id,
        subsetId: subset.id,
      });
      defs.push({
        id: EXERCISE_IDS.recognize(subset.id),
        name: `Recognize — ${subset.name}`,
        description: `Recognition quiz — ${subset.name}.`,
        kind: 'recognize',
        methodId: method.id,
        subsetId: subset.id,
      });
    }

    for (const phase of buildMethodPhases(method.name)) {
      const subsetId = findSubsetId(method.id, phase.id);

      const practiceType = getPhasePracticeType(phase.id);
      if (!practiceType) continue;
      const modes = getPhaseModes(practiceType);
      if (modes.length === 0) continue;

      for (const mode of modes) {
        const base = { methodId: method.id, phaseId: phase.id };
        switch (practiceType) {
          case 'cross':
            if (mode.id === 'plain') {
              defs.push({ id: EXERCISE_IDS.plain(method.id, phase.id), name: `Plain — ${phase.name}`, description: phaseDescription(method, phase), kind: 'solve', ...base });
            } else if (mode.id === 'blind') {
              defs.push({ id: EXERCISE_IDS.blind(method.id, phase.id), name: `Blind — ${phase.name}`, description: 'Plan during inspection, execute with the cube hidden.', kind: 'solve', ...base });
            } else if (mode.id === 'optimal') {
              defs.push({ id: EXERCISE_IDS.crossTrainer(method.id, phase.id), name: 'Cross Trainer', description: 'Cross efficiency: solve within an optimal move budget.', kind: 'efficiency', ...base });
            } else if (mode.id === 'cn') {
              defs.push({ id: EXERCISE_IDS.crossTrainerCn(method.id, phase.id), name: 'Color Neutral Cross', description: 'Cross from any color-neutral orientation.', kind: 'efficiency', ...base });
            }
            break;
          case 'block':
            if (mode.id === 'plain') {
              defs.push({ id: EXERCISE_IDS.plain(method.id, phase.id), name: `Plain — ${phase.name}`, description: phaseDescription(method, phase), kind: 'solve', ...base });
            } else if (mode.id === 'blind') {
              defs.push({ id: EXERCISE_IDS.blind(method.id, phase.id), name: `Blind — ${phase.name}`, description: 'Plan during inspection, execute with the cube hidden.', kind: 'solve', ...base });
            } else if (mode.id === 'speed-vs-eff') {
              defs.push({ id: EXERCISE_IDS.speedEfficiency(method.id, phase.id), name: `Speed vs Efficiency — ${phase.name}`, description: 'Balance speed and move efficiency.', kind: 'efficiency', ...base });
            }
            break;
          case 'lse':
            if (mode.id === 'plain') {
              defs.push({ id: EXERCISE_IDS.plain(method.id, phase.id), name: 'LSE — Full', description: phaseDescription(method, phase), kind: 'solve', ...base });
            } else if (mode.id === 'eo' || mode.id === 'ulur' || mode.id === 'mslice') {
              defs.push({ id: EXERCISE_IDS.lse(mode.id, method.id, phase.id), name: `LSE — ${mode.label}`, description: `Last Six Edges — ${mode.label}.`, kind: 'solve', ...base });
            }
            break;
          case 'eo':
            if (mode.id === 'plain') {
              defs.push({ id: EXERCISE_IDS.plain(method.id, phase.id), name: `Plain — ${phase.name}`, description: phaseDescription(method, phase), kind: 'solve', ...base });
            } else if (mode.id === 'detect') {
              defs.push({ id: EXERCISE_IDS.eoDetect(method.id, phase.id), name: 'EO Detect', description: 'Detect and orient edges — EO recognition.', kind: 'detect', ...base });
            } else if (mode.id === 'efficiency') {
              defs.push({ id: EXERCISE_IDS.eoEfficiency(method.id, phase.id), name: 'EO Efficiency', description: 'Orient edges in as few moves as possible.', kind: 'efficiency', ...base });
            }
            break;
        }
      }
    }
  }

  // Global SRS queue (method-agnostic — attempts still carry their real method).
  defs.push({
    id: EXERCISE_IDS.srsReview(),
    name: 'SRS Review (all methods)',
    description: 'Spaced-repetition daily review queue across all methods.',
    kind: 'srs',
  });

  return defs;
}
