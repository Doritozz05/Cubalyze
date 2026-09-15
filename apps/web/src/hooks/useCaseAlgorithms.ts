"use client";

import { useMemo } from "react";
import { getSeedData } from "@cubalyze/algorithm-db";
import type { Algorithm } from "@cubalyze/algorithm-db";
import { algorithmStore } from "@cubalyze/state";
import { useStore } from "zustand";

// ─── Lazy seed cache (shared across hook + utility) ─────────────────────

let _seedCache: { algorithms: Algorithm[] } | null = null;
function getCachedSeedAlgorithms(): Algorithm[] {
  if (!_seedCache) {
    _seedCache = getSeedData();
  }
  return _seedCache.algorithms;
}

// ─── Synchronous utility (non-reactive, for sidebar panels / grids) ─────

/**
 * Synchronously get ordered algorithms for a case by reading the store snapshot.
 * Does NOT subscribe to store changes — use this in non-reactive contexts
 * like sidebar listings, grid cards, or anywhere you can't call hooks per-case.
 *
 * For reactive components (active drill, detail panel), use {@link useCaseAlgorithms} instead.
 */
export function getAlgorithmsForCase(caseId: string | null | undefined): Algorithm[] {
  if (!caseId) return [];

  const seedAlgs = getCachedSeedAlgorithms();
  const seedForCase = seedAlgs.filter((a) => a.caseId === caseId);

  const state = algorithmStore.getState();
  const customForCase = Object.values(state.customAlgorithms).filter(
    (a) => a.caseId === caseId,
  );

  const algMap = new Map<string, Algorithm>();
  for (const a of seedForCase) algMap.set(a.id, a);
  for (const a of customForCase) algMap.set(a.id, a);

  const order = state.caseOrder[caseId] ?? [];
  const seen = new Set<string>();
  const result: Algorithm[] = [];

  for (const id of order) {
    const alg = algMap.get(id);
    if (alg && !seen.has(id)) { seen.add(id); result.push(alg); }
  }

  const remainingSeed = seedForCase
    .filter((a) => !seen.has(a.id))
    .sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      return a.moveCount.htm - b.moveCount.htm;
    });
  for (const a of remainingSeed) { seen.add(a.id); result.push(a); }

  const remainingCustom = customForCase
    .filter((a) => !seen.has(a.id))
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  for (const a of remainingCustom) { seen.add(a.id); result.push(a); }

  return result;
}

// ─── Hook ────────────────────────────────────────────────────────────────

export interface UseCaseAlgorithmsResult {
  /** All algorithms for the case, ordered by user preference (custom order + seed fallback). */
  algorithms: Algorithm[];

  /** The primary (first/top) algorithm for drills, widgets, previews. */
  primaryAlgorithm: Algorithm | null;

  /** Whether this case has any custom algorithms. */
  hasCustomAlgorithms: boolean;

  /** Total count (seed + custom). */
  totalCount: number;
}

/**
 * Merges seed algorithms with user-created custom algorithms for a specific case,
 * respecting the user's preferred ordering from algorithmStore.
 *
 * This hook is the single source of truth for algorithm ordering across the app.
 * All consumers (drills, widgets, grids, case details) should use this hook
 * to ensure consistent algorithm priority everywhere.
 *
 * @param caseId - The UUID of the algorithm case.
 */
export function useCaseAlgorithms(
  caseId: string | null | undefined,
): UseCaseAlgorithmsResult {
  // ── Seed data (stable across renders) ────────────────────────────────
  const seedData = useMemo(() => getSeedData(), []);

  // ── Custom store state (reactive) ────────────────────────────────────
  const customAlgorithms = useStore(
    algorithmStore,
    (s) => s.customAlgorithms,
  );
  const caseOrder = useStore(algorithmStore, (s) => s.caseOrder);

  // ── Merge + sort ─────────────────────────────────────────────────────
  return useMemo(() => {
    if (!caseId) {
      return {
        algorithms: [],
        primaryAlgorithm: null,
        hasCustomAlgorithms: false,
        totalCount: 0,
      };
    }

    // Collect seed algorithms for this case
    const seedAlgs = seedData.algorithms.filter((a) => a.caseId === caseId);

    // Collect custom algorithms for this case
    const customAlgs = Object.values(customAlgorithms).filter(
      (a) => a.caseId === caseId,
    );

    // Build a lookup map: algorithmId → Algorithm
    const algMap = new Map<string, Algorithm>();
    for (const a of seedAlgs) algMap.set(a.id, a);
    for (const a of customAlgs) algMap.set(a.id, a);

    // Determine the effective order
    const order = caseOrder[caseId] ?? [];

    const seen = new Set<string>();
    const orderedAlgs: Algorithm[] = [];

    // 1. Add explicitly ordered algorithms first
    for (const id of order) {
      const alg = algMap.get(id);
      if (alg && !seen.has(id)) {
        seen.add(id);
        orderedAlgs.push(alg);
      }
    }

    // 2. Append remaining seed algorithms (sorted by seed default + move count)
    const remainingSeed = seedAlgs
      .filter((a) => !seen.has(a.id))
      .sort((a, b) => {
        // isDefault first, then by HTM (shorter = preferred)
        if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
        return a.moveCount.htm - b.moveCount.htm;
      });
    for (const a of remainingSeed) {
      seen.add(a.id);
      orderedAlgs.push(a);
    }

    // 3. Append remaining custom algorithms (sorted by creation order / sortOrder)
    const remainingCustom = customAlgs
      .filter((a) => !seen.has(a.id))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    for (const a of remainingCustom) {
      seen.add(a.id);
      orderedAlgs.push(a);
    }

    return {
      algorithms: orderedAlgs,
      primaryAlgorithm: orderedAlgs[0] ?? null,
      hasCustomAlgorithms: customAlgs.length > 0,
      totalCount: orderedAlgs.length,
    };
  }, [caseId, seedData.algorithms, customAlgorithms, caseOrder]);
}
