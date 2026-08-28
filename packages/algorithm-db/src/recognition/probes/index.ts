/**
 * probes/index.ts — Probe registry.
 *
 * The catalog builder and the detector both resolve a probe by kind, so a
 * new signature family is registered here once and is immediately usable
 * from both sides.
 */
import { f2lSlotProbe } from './f2lSlotProbe';
import {
  lastLayerOrientationProbe,
  lastLayerPermutationProbe,
} from './lastLayerProbes';
import type { DetectionProbe, ProbeKind } from './types';

export type { DetectionProbe, ProbeKind, ProbeContext } from './types';

/** All registered probes, keyed by kind. */
export const PROBES: Record<ProbeKind, DetectionProbe> = {
  'f2l-slot': f2lSlotProbe,
  'last-layer-orientation': lastLayerOrientationProbe,
  'last-layer-permutation': lastLayerPermutationProbe,
};

/** Resolve a probe by kind. */
export function getProbe(kind: ProbeKind): DetectionProbe {
  return PROBES[kind];
}