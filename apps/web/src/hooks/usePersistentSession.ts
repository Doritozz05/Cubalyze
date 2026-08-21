"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import type { Solve as UISolve, Penalty, SolveSource } from "@/types";
import { normalizePenalty } from "@/types";
import { v4 as uuidv4 } from "uuid";
import { initDB, SessionsRepository, SolvesRepository, type Solve as DBSolve } from "@cubeforge/database";
import { isDev } from "@/utils/env";
import { useStorageStatusStore } from "@/stores/storageStatus";
import { requestPersistentStorage } from "@/boot/storagePersistence";
import type { CubeMoveEvent, OrientationTimeline, SolveMetrics } from "@cubeforge/types";
import { ANALYSIS_PIPELINE_VERSION } from "@cubeforge/analysis-engine";
import { attachDemoDataHelpers } from "@/utils/seedDemoData";
import { attachDataIntegrityHelpers } from "@/utils/dataIntegrity";
import { requestSync } from "@/services/sync";
import { useDataRevision } from "@/hooks/useDataRevision";

/**
 * Wrap a mutating hook function so every write nudges the sync engine
 * (debounced). The engine's dirty triggers (migration 028) are the safety
 * net — this just makes the common paths sync within seconds.
 */
function syncAfter<A extends unknown[], R>(
  fn: (...args: A) => R,
): (...args: A) => R {
  return (...args: A) => {
    const result = fn(...args);
    const maybePromise = result as Promise<unknown> | undefined;
    if (maybePromise && typeof maybePromise.then === "function") {
      void maybePromise.catch(() => undefined).then(() => void requestSync());
    } else {
      void requestSync();
    }
    return result;
  };
}

/** Session metadata returned by the API. */
export interface SessionMeta {
  id: string;
  name: string;
  puzzle: string;
  createdAt: number;
  updatedAt: number;
  solveCount: number;
}

export interface UsePersistentSessionResult {
  session: SessionMeta | null;
  sessions: SessionMeta[];
  solves: UISolve[];
  loading: boolean;
  addSolve: (input: {
    /** Pre-generated solve ID. If omitted, one is generated internally. */
    id?: string;
    time: number;
    penalty?: Penalty;
    scramble: string;
    method?: string;
    source?: SolveSource;
    moves?: CubeMoveEvent[];
    analysis?: SolveMetrics;
    orientationTimeline?: OrientationTimeline;
    /** Override timestamp for imported solves (epoch ms). */
    timestamp?: number;
    /** Optional note (used for imported solves). */
    note?: string;
    /** Puzzle type for this solve (e.g. '333', '222'). */
    puzzleType?: string;
  }) => Promise<string | null>;
  updateSolve: (
    id: string,
    updates: {
      penalty?: Penalty;
      note?: string | null;
    source?: SolveSource;
    moves?: CubeMoveEvent[];
    analysis?: SolveMetrics;
    orientationTimeline?: OrientationTimeline;
  },
  ) => Promise<void>;
  deleteSolve: (id: string) => Promise<void>;
  /** Move solves to another session. Returns the number actually moved. */
  moveSolveToSession: (ids: string[], targetSessionId: string) => Promise<number>;
  clearSession: () => Promise<void>;
  /** Batch import solves. Returns the number of solves actually inserted. */
  importSolves: (inputs: Array<{
    time: number;
    penalty: Penalty;
    scramble: string;
    method?: string;
    timestamp: number;
    note?: string;
    source?: SolveSource;
    puzzleType?: string;
    moves?: CubeMoveEvent[];
    analysis?: SolveMetrics;
    orientationTimeline?: OrientationTimeline;
  }>) => Promise<number>;
  newSession: (name?: string, puzzle?: string) => Promise<void>;
  switchSession: (id: string) => Promise<void>;
  renameSession: (id: string, name: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  /** Fetch solves for any session by ID (does not switch active session). */
  fetchSessionSolves: (sessionId: string) => Promise<UISolve[]>;
}

// Convert DB solve to UI solve
function toUISolve(dbSolve: DBSolve): UISolve {
  let analysis: SolveMetrics | undefined;
  if (dbSolve.analysis) {
    try {
      analysis = JSON.parse(dbSolve.analysis) as SolveMetrics;
    } catch {
      // corrupt analysis data, ignore
    }
  }
  return {
    id: dbSolve.id,
    time: dbSolve.timeMs,
    penalty: normalizePenalty(dbSolve.penalty),
    scramble: dbSolve.scramble,
    timestamp: dbSolve.timestamp,
    note: dbSolve.note ?? undefined,
    method: dbSolve.method as UISolve['method'],
    source: (dbSolve.source as SolveSource) ?? "manual",
    moves: dbSolve.moves as UISolve['moves'],
    analysis,
    orientationTimeline: dbSolve.orientationTimeline as UISolve['orientationTimeline'],
    puzzleType: (dbSolve as { puzzleType?: string; puzzle_type?: string }).puzzleType ?? (dbSolve as { puzzleType?: string; puzzle_type?: string }).puzzle_type ?? '333',
  };
}

let seedPromise: Promise<void> | null = null;

export function usePersistentSession(): UsePersistentSessionResult {
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [solves, setSolves] = useState<UISolve[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  const reposRef = useRef<{
    sessions: SessionsRepository;
    solves: SolvesRepository;
  } | null>(null);

  // Keep a ref to avoid stale closure issues in async callbacks
  const activeSessionIdRef = useRef(activeSessionId);
  activeSessionIdRef.current = activeSessionId;

  /**
   * Re-read sessions, per-session solve counts and the active session's
   * solves from the DB into React state (the shared SQLite worker means a
   * write in another tab is already visible at the DB level). Keeps the
   * current active session; never re-seeds or touches localStorage.
   */
  const reloadAll = useCallback(async (preferredSessionId?: string) => {
    const repos = reposRef.current;
    if (!repos) return;
    const activeId =
      preferredSessionId ?? activeSessionIdRef.current ?? null;
    // Fetch counts in one GROUP BY query instead of N findAll() calls
    // (startup cost no longer scales with the number of sessions).
    const allSessions = await repos.sessions.findAllNonDemo();
    const sessionCounts = await repos.solves.countBySession();
    const metaSessions: SessionMeta[] = allSessions.map((s) => ({
      id: s.id,
      name: s.name,
      puzzle: s.puzzleType,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt ?? s.createdAt,
      solveCount: sessionCounts.get(s.id) ?? 0,
    }));
    setSessions(metaSessions);
    if (activeId) {
      const activeSolves = await repos.solves.findAll(activeId);
      setSolves(activeSolves.map(toUISolve).reverse());
    }
  }, []);

  // Live cross-tab refresh: whenever the shared data revision bumps (a local
  // write, a completed sync cycle, or a BroadcastChannel message from another
  // tab), re-read the DB. Read-only — never writes, so it cannot re-trigger
  // the revision itself (no loop).
  const revision = useDataRevision();
  useEffect(() => {
    if (reposRef.current) void reloadAll();
  }, [revision, reloadAll]);

  // Initialize DB and load data
  useEffect(() => {
    let isMounted = true;
    
    async function load() {
      try {
        const dbClient = await initDB();
        const dbExecutor = async (sql: string, bind?: unknown[]) => {
          return await dbClient.execute(sql, bind);
        };
        // Surface the storage backend so the UI can warn about volatile
        // (memory) storage that loses data on reload.
        try {
          const storageType = await dbClient.getStorageType();
          useStorageStatusStore.getState().setStorageType(storageType);
          // Ask the browser to protect the OPFS DB from automatic eviction
          // (ADR-011). Only OPFS is eligible: desktop is already file-backed
          // and memory is volatile regardless of the browser's answer.
          if (storageType === "opfs") {
            void requestPersistentStorage();
          }
        } catch {
          // storage type check is best-effort
        }
        const sessionsRepo = new SessionsRepository(dbExecutor);
        const solvesRepo = new SolvesRepository(dbExecutor);
        reposRef.current = { sessions: sessionsRepo, solves: solvesRepo };

        // Data-integrity console helpers (auditSolves / dedupeSolves).
        // Uses the RAW executor so the audit can see every row (the repos'
        // findAll intentionally hides demo rows).
        attachDataIntegrityHelpers(dbExecutor, () => useStorageStatusStore.getState().storageType);

        if (!seedPromise) {
          seedPromise = (async () => {
            const initialSessions = await sessionsRepo.findAllNonDemo();
            if (initialSessions.length === 0) {
              const defaultSession = {
                id: uuidv4(),
                name: "Main session",
                // Canonical DB type (A2): the registry rejects short aliases
                // like '3x3' — sessions must persist '333'.
                puzzleType: "333",
                createdAt: Date.now(),
                updatedAt: Date.now(),
              };
              await sessionsRepo.insert(defaultSession);
              if (isDev()) console.log('[usePersistentSession] Created default session:', defaultSession.id);
            }
            // Manual demo helpers (window.seedDemoData / window.clearDemoData).
            // Seeding NEVER runs automatically — only via the console helper.
            attachDemoDataHelpers(sessionsRepo, solvesRepo);
          })().catch((err) => {
            // Clear poisoned cache so next mount can retry
            console.error('[usePersistentSession] seedPromise failed, clearing cache:', err);
            seedPromise = null;
            throw err;
          });
        }
        try {
          await seedPromise;
        } catch (err) {
          console.error('[usePersistentSession] Seed failed, continuing without seed:', err);
          // Don't rethrow — continue with empty DB
        }

        let allSessions = await sessionsRepo.findAllNonDemo();
        
        let lastActive = localStorage.getItem("cubeforge:activeSessionId");
        if (!lastActive || !allSessions.find(s => s.id === lastActive)) {
          lastActive = allSessions[0]?.id ?? null;
          if (lastActive) {
            localStorage.setItem("cubeforge:activeSessionId", lastActive);
          } else {
            console.warn('[usePersistentSession] No sessions found even after seeding! Creating emergency session.');
            const emergencyId = uuidv4();
            const now = Date.now();
            await sessionsRepo.insert({
              id: emergencyId,
              name: "Main session",
              puzzleType: "333", // canonical DB type (A2)
              createdAt: now,
              updatedAt: now,
            });
            lastActive = emergencyId;
            localStorage.setItem("cubeforge:activeSessionId", lastActive);
            // Re-fetch allSessions so the rest of load() uses fresh data
            allSessions = await sessionsRepo.findAllNonDemo();
          }
        }

        if (!isMounted) return;
        setActiveSessionId(lastActive);
        await reloadAll(lastActive);
      } catch (err) {
        console.error("Failed to init DB:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    
    load();
    return () => { isMounted = false; };
  }, []);

  const session = sessions.find(s => s.id === activeSessionId) || null;

  const addSolve = useCallback(async (input: {
    id?: string;
    time: number;
    penalty?: Penalty;
    scramble: string;
    method?: string;
    source?: SolveSource;
    moves?: CubeMoveEvent[];
    analysis?: SolveMetrics;
    orientationTimeline?: OrientationTimeline;
    timestamp?: number;
    note?: string;
    puzzleType?: string;
  }): Promise<string | null> => {
    if (!session || !reposRef.current) {
      console.error(
        '%c[addSolve] DROPPED — session=%o, reposRef=%o',
        'color:#f87171;font-weight:bold',
        session,
        reposRef.current ? 'set' : 'null',
      );
      return null;
    }
    const { solves: solvesRepo } = reposRef.current;
    
    const solveId = input.id ?? uuidv4();
    const timestamp = input.timestamp ?? Date.now();
    const dbSolve: DBSolve = {
      id: solveId,
      sessionId: session.id,
      timeMs: input.time,
      timestamp,
      scramble: input.scramble,
      penalty: normalizePenalty(input.penalty) as DBSolve['penalty'],
      method: input.method,
      source: input.source ?? "manual",
      moves: input.moves || [],
      note: input.note ?? undefined,
      orientationTimeline: input.orientationTimeline,
      analysisEngineVersion: ANALYSIS_PIPELINE_VERSION,
      analysis: input.analysis ? JSON.stringify(input.analysis) : undefined,
      puzzleType: input.puzzleType ?? '333',
    } as DBSolve;
    
    try {
      await solvesRepo.insert(dbSolve);
      if (isDev()) {
        console.log(
          '%c[addSolve] ✓ Saved solve %s · %dms · session=%s',
          'color:#4ade80;font-weight:bold',
          solveId.slice(0, 8),
          input.time,
          session.id.slice(0, 8),
        );
      }
    } catch (err) {
      console.error('%c[addSolve] DB write FAILED:', 'color:#f87171;font-weight:bold', err);
      return null;
    }
    
    const uiSolve: UISolve = {
      ...toUISolve(dbSolve),
      method: (input.method as UISolve['method']) || undefined,
      source: input.source ?? "manual",
      // Only override when explicitly provided — preserves defaults from toUISolve.
      // moves defaults to `[]` from the DB row; analysis stays undefined until
      // the async analysis pipeline completes and calls updateSolve.
      ...(input.moves !== undefined ? { moves: input.moves } : {}),
      ...(input.analysis !== undefined ? { analysis: input.analysis } : {}),
    };
    setSolves(prev => [uiSolve, ...prev]);
    setSessions(prev => prev.map(s => 
      s.id === session.id ? { ...s, solveCount: s.solveCount + 1, updatedAt: Date.now() } : s
    ));
    return solveId;
  }, [session]);

  const updateSolve = useCallback(async (id: string, updates: { penalty?: Penalty; note?: string | null; source?: SolveSource; moves?: CubeMoveEvent[]; analysis?: SolveMetrics; orientationTimeline?: OrientationTimeline }) => {
    // ── Always update React state first so the UI reflects changes ────────
    // even if the DB operation fails. This prevents the "Live" badge
    // sticking around forever when the solve already has analysis.
    setSolves(prev => prev.map(s => {
      if (s.id === id) {
         return {
           ...s,
           penalty: updates.penalty ? normalizePenalty(updates.penalty) : s.penalty,
           note: updates.note === null ? undefined : (updates.note ?? s.note),
           source: updates.source ?? s.source,
           moves: updates.moves ?? s.moves,
           analysis: updates.analysis ?? s.analysis,
           orientationTimeline: updates.orientationTimeline ?? s.orientationTimeline,
         };
      }
      return s;
    }));

    // ── Persist to DB ────────────────────────────────────────────────────
    if (!session || !reposRef.current) {
      console.warn(
        '%c[updateSolve] DB skipped (no session/repos) — state-only patch for solve=%s',
        'color:#facc15',
        id.slice(0, 8),
      );
      return;
    }
    const { solves: solvesRepo } = reposRef.current;

    try {
      const existing = await solvesRepo.findById(id);
      if (!existing) {
        console.warn(
          '%c[updateSolve] Solve %s not found in DB — state patch is live-only',
          'color:#facc15',
          id.slice(0, 8),
        );
        return;
      }

      existing.penalty = (updates.penalty ? normalizePenalty(updates.penalty) : normalizePenalty(existing.penalty)) as DBSolve['penalty'];
      if (updates.note !== undefined) {
         existing.note = updates.note === null ? undefined : updates.note;
      }
      if (updates.source !== undefined) {
         existing.source = updates.source;
      }
      if (updates.moves !== undefined) {
         existing.moves = updates.moves;
      }
      if (updates.analysis !== undefined) {
         existing.analysis = JSON.stringify(updates.analysis);
      }
      if (updates.orientationTimeline !== undefined) {
         existing.orientationTimeline = updates.orientationTimeline;
      }

      // Real user edit: { local: true } makes the repo take a monotonic
      // clock stamp strictly newer than the row's previous one (M9). The
      // sync pull passes the cloud's timestamp without the flag, so a pulled
      // row never gets re-selected by the push cursor.
      await solvesRepo.update(existing, { local: true });
      if (isDev()) {
        console.log(
          '%c[updateSolve] ✓ Persisted solve %s · moves=%d · analysis=%s',
          'color:#4ade80;font-weight:bold',
          id.slice(0, 8),
          updates.moves?.length ?? -1,
          updates.analysis ? 'yes' : 'no',
        );
      }
    } catch (err) {
      console.error(
        '%c[updateSolve] DB persist FAILED for solve %s (state already patched):',
        'color:#f87171;font-weight:bold',
        id.slice(0, 8),
        err,
      );
    }
  }, [session]);

  const deleteSolve = useCallback(async (id: string) => {
    if (!session || !reposRef.current) return;
    const { solves: solvesRepo } = reposRef.current;
    
    await solvesRepo.delete(id);
    
    setSolves(prev => prev.filter(s => s.id !== id));
    setSessions(prev => prev.map(s => 
      s.id === session.id ? { ...s, solveCount: Math.max(0, s.solveCount - 1), updatedAt: Date.now() } : s
    ));
  }, [session]);

  /**
   * Move solves to another session (updates `session_id` in the DB and the
   * session solve counts). Returns how many solves were actually moved —
   * solves already in the target session are skipped.
   */
  const moveSolveToSession = useCallback(async (ids: string[], targetSessionId: string): Promise<number> => {
    // IMPORTANT: read the CURRENT active session id through the ref, NOT the
    // render-time `session` closure. The loop awaits the DB worker per solve,
    // so the user can switch sessions mid-flight — comparing against the stale
    // closure would push moved solves into the wrong session's live list and
    // duplicate them (move + switch race).
    const activeId = activeSessionIdRef.current;
    if (!activeId || !reposRef.current || ids.length === 0) return 0;
    const { solves: solvesRepo } = reposRef.current;

    // Count deltas per source session + solves that enter/leave the ACTIVE
    // session's live `solves` state.
    const sourceDeltas = new Map<string, number>();
    const movedFromActive: string[] = [];
    const movedIntoActive: UISolve[] = [];
    let moved = 0;

    for (const id of ids) {
      const existing = await solvesRepo.findById(id);
      if (!existing || existing.sessionId === targetSessionId) continue;
      const sourceId = existing.sessionId;
      existing.sessionId = targetSessionId;
      // Moving a solve is an edit: { local: true } advances its updated_at
      // via the monotonic clock so the move syncs (M9).
      await solvesRepo.update(existing, { local: true });
      moved++;
      sourceDeltas.set(sourceId, (sourceDeltas.get(sourceId) ?? 0) - 1);
      // Re-read the active id each iteration: a session switch landing between
      // two awaited DB ops must not corrupt the live-list bookkeeping.
      const currentActiveId = activeSessionIdRef.current;
      if (sourceId === currentActiveId) movedFromActive.push(id);
      if (targetSessionId === currentActiveId) movedIntoActive.push(toUISolve(existing));
    }

    if (moved === 0) return 0;

    // Keep the active-session list in sync: drop solves that left it, add
    // solves that entered it (newest-first by timestamp, like the DB load).
    if (movedFromActive.length > 0 || movedIntoActive.length > 0) {
      const gone = new Set(movedFromActive);
      setSolves(prev =>
        [...movedIntoActive, ...prev.filter(s => !gone.has(s.id))].sort(
          (a, b) => b.timestamp - a.timestamp,
        ),
      );
    }

    setSessions(prev => prev.map(s => {
      const delta = sourceDeltas.get(s.id) ?? 0;
      const inc = s.id === targetSessionId ? moved : 0;
      if (delta === 0 && inc === 0) return s;
      return { ...s, solveCount: Math.max(0, s.solveCount + delta + inc), updatedAt: Date.now() };
    }));

    return moved;
  }, []);

  const importSolves = useCallback(async (
    inputs: Array<{
      time: number;
      penalty: Penalty;
      scramble: string;
      method?: string;
      timestamp: number;
      note?: string;
      source?: SolveSource;
      puzzleType?: string;
      moves?: CubeMoveEvent[];
      analysis?: SolveMetrics;
      orientationTimeline?: OrientationTimeline;
    }>,
  ): Promise<number> => {
    if (!session || !reposRef.current) return 0;
    if (inputs.length === 0) return 0;

    const dbSolves: DBSolve[] = inputs.map((input) => ({
      id: uuidv4(),
      sessionId: session.id,
      timeMs: input.time,
      timestamp: input.timestamp,
      scramble: input.scramble,
      penalty: normalizePenalty(input.penalty) as DBSolve['penalty'],
      method: input.method,
      note: input.note,
      source: input.source ?? "manual",
      moves: input.moves || [],
      orientationTimeline: input.orientationTimeline,
      analysisEngineVersion: ANALYSIS_PIPELINE_VERSION,
      analysis: input.analysis ? JSON.stringify(input.analysis) : undefined,
      puzzleType: input.puzzleType ?? '333',
    } as DBSolve));

    // All-or-nothing: the whole batch lands inside one SQLite transaction.
    // On failure nothing is imported (no partial file).
    let imported = 0;
    try {
      imported = await reposRef.current.solves.insertMany(dbSolves);
    } catch (err) {
      console.error('[importSolves] Batch insert failed — rolled back:', err);
    }

    if (imported > 0) {
      const solvesToAdd: UISolve[] = dbSolves.slice(0, imported).map((s) => ({
        ...toUISolve(s),
        method: s.method as UISolve['method'] || undefined,
        source: s.source ?? "manual",
      }));
      // IMPORTANT: keep the array sorted newest-first BY TIMESTAMP.
      // Imported files are usually oldest→newest, so prepending them as-is
      // would make the first (oldest) imported solve land at `solves[0]` —
      // and the UI treats `solves[0]` as the most recent solve (PB baseline,
      // "last solve" badge, etc.). Sorting here matches the DB order
      // (ORDER BY timestamp ASC, then reversed) for every load.
      setSolves((prev) =>
        [...solvesToAdd, ...prev].sort((a, b) => b.timestamp - a.timestamp),
      );
      setSessions((prev) =>
        prev.map((s) =>
          s.id === session.id
            ? { ...s, solveCount: s.solveCount + imported, updatedAt: Date.now() }
            : s,
        ),
      );
    }

    return imported;
  }, [session]);

  const clearSession = useCallback(async () => {
    if (!session || !reposRef.current) return;
    const { solves: solvesRepo } = reposRef.current;

    // Single statement instead of delete-one-by-one (fast on large sessions).
    await solvesRepo.deleteBySession(session.id);

    setSolves([]);
    setSessions(prev => prev.map(s => 
      s.id === session.id ? { ...s, solveCount: 0, updatedAt: Date.now() } : s
    ));
  }, [session]);

  const newSession = useCallback(async (name?: string, puzzle?: string) => {
    if (!reposRef.current) return;
    const { sessions: sessionsRepo } = reposRef.current;
    
    const newSess = {
      id: uuidv4(),
      name: name ?? "Session",
      puzzleType: puzzle ?? "333", // canonical DB type (A2)
      createdAt: Date.now(),
    };
    
    await sessionsRepo.insert(newSess);
    
    const meta: SessionMeta = {
      id: newSess.id,
      name: newSess.name,
      puzzle: newSess.puzzleType,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      solveCount: 0,
    };
    
    setSessions(prev => [meta, ...prev]);
    setActiveSessionId(newSess.id);
    localStorage.setItem("cubeforge:activeSessionId", newSess.id);
    setSolves([]);
  }, []);

  const switchSession = useCallback(async (id: string) => {
    if (!reposRef.current) return;
    const { solves: solvesRepo } = reposRef.current;
    
    setActiveSessionId(id);
    localStorage.setItem("cubeforge:activeSessionId", id);
    
    setLoading(true);
    const activeSolves = await solvesRepo.findAll(id);
    setSolves(activeSolves.map(toUISolve).reverse());
    setLoading(false);
  }, []);

  const renameSession = useCallback(async (id: string, name: string) => {
    if (!reposRef.current) return;
    const { sessions: sessionsRepo } = reposRef.current;
    
    const existing = await sessionsRepo.findById(id);
    if (!existing) return;
    
    existing.name = name;
    // Renaming is an edit: { local: true } advances updated_at via the
    // monotonic clock (M9); pulled rows keep the cloud timestamp as-is.
    await sessionsRepo.update(existing, { local: true });
    
    setSessions(prev => prev.map(s => 
      s.id === id ? { ...s, name, updatedAt: Date.now() } : s
    ));
  }, []);

  const deleteSession = useCallback(async (id: string) => {
    if (!reposRef.current) return;
    const { sessions: sessionsRepo, solves: solvesRepo } = reposRef.current;
    
    // Delete all solves for this session in one statement, then the session.
    // (The FK also cascades, but being explicit keeps it safe even if the
    // pragma is ever disabled.)
    await solvesRepo.deleteBySession(id);
    await sessionsRepo.delete(id);
    
    // Optimistically remove from React state
    setSessions(prev => prev.filter(s => s.id !== id));

    // Query DB directly instead of relying on potentially stale closure state
    const wasActive = id === activeSessionIdRef.current;
    if (wasActive) {
      const remainingSessions = await sessionsRepo.findAllNonDemo();
      if (remainingSessions.length > 0) {
        await switchSession(remainingSessions[0].id);
      } else {
        await newSession();
      }
    }
  }, [switchSession, newSession]);

  /** Fetch solves for any session without switching the active session. */
  const fetchSessionSolves = useCallback(async (sessionId: string): Promise<UISolve[]> => {
    if (!reposRef.current) return [];
    const { solves: solvesRepo } = reposRef.current;
    const rows = await solvesRepo.findAll(sessionId);
    return rows.map(toUISolve).reverse();
  }, []);

  return {
    session,
    sessions,
    solves,
    loading,
    addSolve: syncAfter(addSolve),
    updateSolve: syncAfter(updateSolve),
    deleteSolve: syncAfter(deleteSolve),
    moveSolveToSession: syncAfter(moveSolveToSession),
    clearSession: syncAfter(clearSession),
    importSolves: syncAfter(importSolves),
    newSession: syncAfter(newSession),
    switchSession,
    renameSession: syncAfter(renameSession),
    deleteSession: syncAfter(deleteSession),
    fetchSessionSolves,
  };
}
