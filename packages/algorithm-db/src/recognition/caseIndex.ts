/**
 * caseIndex.ts — Signature → case lookup tables built from the seed.
 *
 * For every case in the catalog we generate its canonical state (from the
 * setup scramble), compute its signature under the CATALOG convention, and
 * index it. Signatures are structural, so the same signature function can be
 * applied to solver-frame reconstruction states.
 *
 * Collisions: two cases with the same F2L signature differ only in the last
 * layer (their F2L arrangement is identical) — from a recognition standpoint
 * they ARE the same case. We keep every candidate and prefer the basic
 * numbering; the analyzer surfaces ambiguity instead of guessing.
 */
import { CubeState } from '@cubeforge/math-core';
import { CaseStateGenerator } from '../caseGenerator';
import { ALL_F2L_CASES } from '../seed/cfop-f2l';
import { OLL_CASES } from '../seed/cfop-oll';
import { PLL_CASES } from '../seed/cfop-pll';
import { CATALOG_CONVENTION } from './conventions';
import {
  F2L_SLOTS,
  f2lPairSignature,
  ollSignature,
  pairSolved,
  pllSignature,
} from './signatures';

export interface RecognitionIndex {
  /** Signature → case numbers (multiple when the F2L arrangement is shared). */
  f2l: Map<string, string[]>;
  oll: Map<string, string[]>;
  pll: Map<string, string[]>;
  f2lUnindexed: string[];
  ollUnindexed: string[];
  pllUnindexed: string[];
  f2lCollisions: number;
  ollCollisions: number;
  pllCollisions: number;
  /** Number of cases indexed per family. */
  f2lCases: number;
  ollCases: number;
  pllCases: number;
}

function pushOrMerge(map: Map<string, string[]>, sig: string, caseNumber: string): void {
  const existing = map.get(sig);
  if (existing === undefined) {
    map.set(sig, [caseNumber]);
  } else if (!existing.includes(caseNumber)) {
    existing.push(caseNumber);
  }
}

function buildF2LIndex(): { f2l: Map<string, string[]>; unindexed: string[]; collisions: number } {
  const map = new Map<string, string[]>();
  const unindexed: string[] = [];
  let collisions = 0;
  for (const caseData of ALL_F2L_CASES) {
    let state: CubeState;
    try {
      state = CaseStateGenerator.generateFromScramble(caseData.caseDef.setupScramble);
    } catch {
      unindexed.push(caseData.caseDef.caseNumber);
      continue;
    }
    // A case is the arrangement of ONE pair. Index every pair that the setup
    // leaves unsolved (the universal "solved pair" signature must never enter
    // the index — it is shared by every case).
    let indexed = 0;
    for (const slot of F2L_SLOTS) {
      if (pairSolved(state, CATALOG_CONVENTION.crossEdges, slot.cornerHome, slot.edgeHome)) {
        continue;
      }
      const sig = f2lPairSignature(
        state,
        CATALOG_CONVENTION.crossEdges,
        slot.cornerHome,
        slot.edgeHome,
      );
      if (sig === null) continue;
      const before = map.get(sig);
      pushOrMerge(map, sig, caseData.caseDef.caseNumber);
      if (before !== undefined) collisions++;
      indexed++;
    }
    if (indexed === 0) {
      unindexed.push(caseData.caseDef.caseNumber);
    }
  }
  return { f2l: map, unindexed, collisions };
}

function buildOLLIndex(): { oll: Map<string, string[]>; unindexed: string[]; collisions: number } {
  const map = new Map<string, string[]>();
  const unindexed: string[] = [];
  let collisions = 0;
  for (const caseData of OLL_CASES) {
    let state: CubeState;
    try {
      state = CaseStateGenerator.generateFromScramble(caseData.caseDef.setupScramble);
    } catch {
      unindexed.push(caseData.caseDef.caseNumber);
      continue;
    }
    const sig = ollSignature(state, CATALOG_CONVENTION.crossEdges);
    if (sig === null) {
      unindexed.push(caseData.caseDef.caseNumber);
      continue;
    }
    const before = map.get(sig);
    pushOrMerge(map, sig, caseData.caseDef.caseNumber);
    if (before !== undefined) collisions++;
  }
  return { oll: map, unindexed, collisions };
}

function buildPLLIndex(): { pll: Map<string, string[]>; unindexed: string[]; collisions: number } {
  const map = new Map<string, string[]>();
  const unindexed: string[] = [];
  let collisions = 0;
  for (const caseData of PLL_CASES) {
    let state: CubeState;
    try {
      state = CaseStateGenerator.generateFromScramble(caseData.caseDef.setupScramble);
    } catch {
      unindexed.push(caseData.caseDef.caseNumber);
      continue;
    }
    const sig = pllSignature(state, CATALOG_CONVENTION.crossEdges);
    if (sig === null) {
      unindexed.push(caseData.caseDef.caseNumber);
      continue;
    }
    const before = map.get(sig);
    pushOrMerge(map, sig, caseData.caseDef.caseNumber);
    if (before !== undefined) collisions++;
  }
  return { pll: map, unindexed, collisions };
}

function build(): RecognitionIndex {
  const f2l = buildF2LIndex();
  const oll = buildOLLIndex();
  const pll = buildPLLIndex();
  return {
    f2l: f2l.f2l,
    oll: oll.oll,
    pll: pll.pll,
    f2lUnindexed: f2l.unindexed,
    ollUnindexed: oll.unindexed,
    pllUnindexed: pll.unindexed,
    f2lCollisions: f2l.collisions,
    ollCollisions: oll.collisions,
    pllCollisions: pll.collisions,
    f2lCases: ALL_F2L_CASES.length,
    ollCases: OLL_CASES.length,
    pllCases: PLL_CASES.length,
  };
}

let cached: RecognitionIndex | null = null;

/** Build (once) and return the recognition index. */
export function getRecognitionIndex(): RecognitionIndex {
  if (cached === null) cached = build();
  return cached;
}

/** Reset the cache (test helper). */
export function __resetRecognitionIndex(): void {
  cached = null;
}

export interface CaseMatch {
  caseNumber: string | null;
  candidates: string[];
  ambiguous: boolean;
}

/** Resolve a signature against an index map. */
export function resolveMatch(map: Map<string, string[]>, sig: string | null): CaseMatch {
  if (sig === null) return { caseNumber: null, candidates: [], ambiguous: false };
  const candidates = map.get(sig);
  if (candidates === undefined) return { caseNumber: null, candidates: [], ambiguous: false };
  if (candidates.length === 1) {
    return { caseNumber: candidates[0], candidates, ambiguous: false };
  }
  return { caseNumber: candidates[0], candidates, ambiguous: true };
}
