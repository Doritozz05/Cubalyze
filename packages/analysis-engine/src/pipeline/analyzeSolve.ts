import type {
  CubeMoveEvent,
  CubeOrientation,
  SolveMetrics,
  SolveTimeline,
} from '@cubeforge/types';
import {
  CFOPDefinition,
  PetrusDefinition,
  RouxFullDefinition,
  ZZDefinition,
  type MethodDefinition,
} from '@cubeforge/math-core';
import { MetricsAggregator } from '../metrics/MetricsAggregator';
import { PhaseSplitter } from '../phases/PhaseSplitter';
import { TimelineBuilder } from '../timeline/TimelineBuilder';
import { recoverRotatedFrame, type FrameRecoveryOptions } from './frameRecovery';

/**
 * Unified analysis core — the ONLY place phase detection runs.
 *
 * Both routes feed the exact same detection code:
 *   - smart cube (useSolveSession): analyzeSolve (async, adds metrics)
 *   - reconstruction text (analyzeSolveText): buildAnnotatedTimeline directly
 *     (it consumes the timeline/report, not the metrics)
 *
 * The detection order is identical for every input:
 *   1. TimelineBuilder.build (initialFacelets > scramble > solved)
 *   2. solveTimeMs override (timer-authoritative duration — smart route)
 *   3. PhaseSplitter.splitAndAnnotate (colorNeutral + optional cross tiebreak)
 *   4. P2 frame recovery (no-op when the final state is canonically solved)
 *
 * Consumers must NEVER re-detect phases or re-derive pairs on their own —
 * that is how divergence creeps in.
 */
export interface AnalyzeSolveInput {
  moves: CubeMoveEvent[];
  method: string;
  scramble?: string;
  orientations?: (CubeOrientation | undefined)[];
  /** 54-char facelet string from the real Smart Cube at solve start. */
  initialFacelets?: string;
  /** Full face+slice token stream for exact state (text path only). */
  stateTokens?: readonly string[];
  /** Tiebreak-only hint: timeline index where the written cross ends. */
  preferredCrossIdx?: number;
  solveTimeMs?: number;
}

export interface AnalyzeSolveResult {
  timeline: SolveTimeline;
  metrics: SolveMetrics;
}

const METHOD_DEFS: Record<string, MethodDefinition> = {
  CFOP: CFOPDefinition,
  Roux: RouxFullDefinition,
  ZZ: ZZDefinition,
  Petrus: PetrusDefinition,
};

/**
 * Build + annotate the timeline for ANY analysis route (synchronous core).
 *
 * Shared by:
 *   - `analyzeSolve` (smart route) — passes `solveTimeMs` so the report is
 *     built with the authoritative duration (real timestamps);
 *   - `analyzeSolveText` (text route) — omits `solveTimeMs` and applies the
 *     record's total time AFTER detection, so the report keeps the synthetic
 *     timestamp duration and never fabricates an 'unattributed-time' warning.
 *
 * splitAndAnnotate ALWAYS attaches `timeline.detectionReport`, so callers
 * can read it directly.
 */
export function buildAnnotatedTimeline(input: AnalyzeSolveInput): SolveTimeline {
  const methodDef = METHOD_DEFS[input.method] ?? CFOPDefinition;

  const timeline = TimelineBuilder.build(
    input.moves,
    input.method,
    input.orientations,
    input.scramble,
    input.initialFacelets,
    input.stateTokens,
  );

  if (input.solveTimeMs !== undefined && Number.isFinite(input.solveTimeMs)) {
    timeline.solveTimeMs = Math.max(0, input.solveTimeMs);
  }

  const splitOptions: FrameRecoveryOptions = {
    colorNeutral: true,
    preferredCrossIdx: input.preferredCrossIdx,
  };

  PhaseSplitter.splitAndAnnotate(timeline, methodDef, splitOptions);
  recoverRotatedFrame(timeline, methodDef, splitOptions);
  return timeline;
}

export async function analyzeSolve(
  input: AnalyzeSolveInput,
): Promise<AnalyzeSolveResult> {
  const timeline = buildAnnotatedTimeline(input);
  const metrics = await MetricsAggregator.computeAll(timeline, input.scramble ?? '');
  return { timeline, metrics };
}
