"use client";

/**
 * useCubeStats.ts — the Locker's read side over the solve history.
 *
 * Two hooks, one idea: the per-cube numbers are a QUERY, not a stored column.
 *
 *   • `useCubeStats(itemId)` — the item detail sheet. Full history for one
 *     cube, which is what best-o5/best-o12 need (a rolling average cannot be
 *     derived from a count).
 *   • `useCubeUsage()`      — the grid. One grouped query for every cube, so a
 *     wall of cards does not become N queries.
 *
 * Both cache their result **per data revision**: the revision bumps on any
 * local write and on every completed sync cycle (including another tab's, via
 * BroadcastChannel), so the numbers refresh exactly when the underlying rows
 * could have changed, and a re-render for an unrelated reason costs nothing.
 *
 * A failure is not an error state to shout about — the Locker is a catalogue
 * first — so both hooks degrade to "no stats" and keep the rest of the page
 * working. Nothing here writes.
 */

import { useEffect, useRef, useState } from "react";
import { initDB, SolvesRepository } from "@cubeforge/database";
import { useDataRevision } from "@/hooks/useDataRevision";
import { cubeStatsFor, type CubeSolveRow, type CubeStats } from "./cubeStats";

/** How many item→stats entries to keep before dropping the cache. */
const CACHE_LIMIT = 32;

interface CacheEntry {
  revision: number;
  stats: CubeStats;
}

const statsCache = new Map<string, CacheEntry>();
const usageCache = new Map<number, Map<string, { count: number; lastUsedAt: number }>>();

/** Drop every cached number. Used by tests; the revision does the real work. */
export function clearCubeStatsCache(): void {
  statsCache.clear();
  usageCache.clear();
}

export interface UseCubeStatsResult {
  stats: CubeStats | null;
  /** True while the first read for the current revision is in flight. */
  loading: boolean;
}

/** Per-cube statistics for one Locker item (null while unavailable). */
export function useCubeStats(itemId: string | null | undefined): UseCubeStatsResult {
  const revision = useDataRevision();
  const repoRef = useRef<SolvesRepository | null>(null);
  const [loaded, setLoaded] = useState<CacheEntry | null>(null);

  useEffect(() => {
    if (!itemId) {
      setLoaded(null);
      return;
    }
    const cached = statsCache.get(itemId);
    if (cached && cached.revision === revision) {
      setLoaded(cached);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        if (!repoRef.current) {
          const dbClient = await initDB();
          repoRef.current = new SolvesRepository(
            async (sql, bind) => await dbClient.execute(sql, bind),
          );
        }
        const solves = await repoRef.current.findByCube(itemId);
        const row: CubeSolveRow[] = solves.map((solve) => ({
          id: solve.id,
          timeMs: solve.timeMs,
          penalty: solve.penalty,
          timestamp: solve.timestamp,
        }));
        const entry: CacheEntry = { revision, stats: cubeStatsFor(row) };
        if (statsCache.size >= CACHE_LIMIT) statsCache.clear();
        statsCache.set(itemId, entry);
        if (!cancelled) setLoaded(entry);
      } catch {
        // No database (or a failed read): the sheet simply shows no numbers.
        if (!cancelled) setLoaded(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [itemId, revision]);

  return { stats: loaded?.stats ?? null, loading: !itemId ? false : loaded == null };
}

/**
 * How many solves each cube has, and when it was last picked up.
 *
 * One grouped query for the whole grid, refreshed with the data revision.
 */
export function useCubeUsage(): Map<string, { count: number; lastUsedAt: number }> {
  const revision = useDataRevision();
  const repoRef = useRef<SolvesRepository | null>(null);
  const [usage, setUsage] = useState<Map<string, { count: number; lastUsedAt: number }>>(
    () => usageCache.get(revision) ?? new Map(),
  );

  useEffect(() => {
    const cached = usageCache.get(revision);
    if (cached) {
      setUsage(cached);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        if (!repoRef.current) {
          const dbClient = await initDB();
          repoRef.current = new SolvesRepository(
            async (sql, bind) => await dbClient.execute(sql, bind),
          );
        }
        const summary = await repoRef.current.summarizeCubes();
        if (usageCache.size >= CACHE_LIMIT) usageCache.clear();
        usageCache.set(revision, summary);
        if (!cancelled) setUsage(summary);
      } catch {
        // Keep the empty map: the cards just show no counter.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [revision]);

  return usage;
}
