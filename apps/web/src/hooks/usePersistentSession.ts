"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import type { Solve as UISolve, Penalty, SolveSource } from "@/types";
import { normalizePenalty } from "@/types";
import { v4 as uuidv4 } from "uuid";
import { initDB, SessionsRepository, SolvesRepository, type Solve as DBSolve } from "@cubeforge/database";
import type { CubeMoveEvent, OrientationTimeline, SolveMetrics } from "@cubeforge/types";
import { seedDemoDataIfEmpty } from "@/utils/seedDemoData";

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
    /** Puzzle type for this solve (e.g. '3x3x3', '2x2x2'). */
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
    timestamp: new Date(dbSolve.date).getTime(),
    note: dbSolve.note ?? undefined,
    method: dbSolve.method as UISolve['method'],
    source: (dbSolve.source as SolveSource) ?? "manual",
    moves: dbSolve.moves as UISolve['moves'],
    analysis,
    orientationTimeline: dbSolve.orientationTimeline as UISolve['orientationTimeline'],
    puzzleType: (dbSolve as any).puzzleType ?? (dbSolve as any).puzzle_type ?? '3x3x3',
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

  // Initialize DB and load data
  useEffect(() => {
    let isMounted = true;
    
    async function load() {
      try {
        const dbClient = await initDB();
        const dbExecutor = async (sql: string, bind?: unknown[]) => {
          return await dbClient.execute(sql, bind);
        };
        const sessionsRepo = new SessionsRepository(dbExecutor);
        const solvesRepo = new SolvesRepository(dbExecutor);
        reposRef.current = { sessions: sessionsRepo, solves: solvesRepo };

        if (!seedPromise) {
          seedPromise = (async () => {
            const initialSessions = await sessionsRepo.findAll();
            if (initialSessions.length === 0) {
              const defaultSession = {
                id: uuidv4(),
                name: "Main session",
                puzzleType: "3x3",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
              await sessionsRepo.insert(defaultSession);
              console.log('[usePersistentSession] Created default session:', defaultSession.id);
            }
            // Seed demo data if DB is empty and flag is set
            await seedDemoDataIfEmpty(sessionsRepo, solvesRepo);
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

        let allSessions = await sessionsRepo.findAll();
        
        let lastActive = localStorage.getItem("cubeforge:activeSessionId");
        if (!lastActive || !allSessions.find(s => s.id === lastActive)) {
          lastActive = allSessions[0]?.id ?? null;
          if (lastActive) {
            localStorage.setItem("cubeforge:activeSessionId", lastActive);
          } else {
            console.warn('[usePersistentSession] No sessions found even after seeding! Creating emergency session.');
            const emergencyId = uuidv4();
            const now = new Date().toISOString();
            await sessionsRepo.insert({
              id: emergencyId,
              name: "Main session",
              puzzleType: "3x3",
              createdAt: now,
              updatedAt: now,
            });
            lastActive = emergencyId;
            localStorage.setItem("cubeforge:activeSessionId", lastActive);
            // Re-fetch allSessions so the rest of load() uses fresh data
            allSessions = await sessionsRepo.findAll();
          }
        }

        if (!isMounted) return;

        // Fetch counts and map to SessionMeta
        const metaSessions: SessionMeta[] = [];
        for (const s of allSessions) {
          const sessionSolves = await solvesRepo.findAll(s.id);
          metaSessions.push({
            id: s.id,
            name: s.name,
            puzzle: s.puzzleType,
            createdAt: new Date(s.createdAt).getTime(),
            updatedAt: s.updatedAt ? new Date(s.updatedAt).getTime() : new Date(s.createdAt).getTime(),
            solveCount: sessionSolves.length,
          });
        }
        
        setSessions(metaSessions);
        setActiveSessionId(lastActive);
        
        // Load solves for active
        const activeSolves = await solvesRepo.findAll(lastActive);
        setSolves(activeSolves.map(toUISolve).reverse());
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
    const date = input.timestamp ? new Date(input.timestamp).toISOString() : new Date().toISOString();
    const dbSolve: DBSolve = {
      id: solveId,
      sessionId: session.id,
      timeMs: input.time,
      date,
      scramble: input.scramble,
      penalty: normalizePenalty(input.penalty) as DBSolve['penalty'],
      method: input.method,
      source: input.source ?? "manual",
      moves: input.moves || [],
      note: input.note ?? undefined,
      orientationTimeline: input.orientationTimeline,
      analysisEngineVersion: '0.1.0',
      analysis: input.analysis ? JSON.stringify(input.analysis) : undefined,
      puzzleType: input.puzzleType ?? '3x3x3',
    } as DBSolve;
    
    try {
      await solvesRepo.insert(dbSolve);
      console.log(
        '%c[addSolve] ✓ Saved solve %s · %dms · session=%s',
        'color:#4ade80;font-weight:bold',
        solveId.slice(0, 8),
        input.time,
        session.id.slice(0, 8),
      );
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

      await solvesRepo.update(existing);
      console.log(
        '%c[updateSolve] ✓ Persisted solve %s · moves=%d · analysis=%s',
        'color:#4ade80;font-weight:bold',
        id.slice(0, 8),
        updates.moves?.length ?? -1,
        updates.analysis ? 'yes' : 'no',
      );
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

  const importSolves = useCallback(async (
    inputs: Array<{
      time: number;
      penalty: Penalty;
      scramble: string;
      method?: string;
      timestamp: number;
      note?: string;
      source?: SolveSource;
    }>,
  ): Promise<number> => {
    if (!session || !reposRef.current) return 0;

    let imported = 0;
    const solvesToAdd: UISolve[] = [];

    for (const input of inputs) {
      const solveId = uuidv4();
      const date = new Date(input.timestamp).toISOString();

      const dbSolve: DBSolve = {
        id: solveId,
        sessionId: session.id,
        timeMs: input.time,
        date,
        scramble: input.scramble,
        penalty: normalizePenalty(input.penalty) as DBSolve['penalty'],
        method: input.method,
        note: input.note,
        source: input.source ?? "manual",
        moves: [],
        orientationTimeline: undefined,
        analysisEngineVersion: '0.1.0',
        analysis: undefined,
        puzzleType: '3x3x3',
      } as DBSolve;

      try {
        await reposRef.current.solves.insert(dbSolve);
        imported++;

        solvesToAdd.push({
          ...toUISolve(dbSolve),
          method: input.method as UISolve['method'] || undefined,
          source: input.source ?? "manual",
        });
      } catch (err) {
        console.error('[importSolves] Failed to insert solve:', err);
      }
    }

    if (solvesToAdd.length > 0) {
      setSolves((prev) => [...solvesToAdd, ...prev]);
      setSessions((prev) =>
        prev.map((s) =>
          s.id === session.id
            ? { ...s, solveCount: s.solveCount + solvesToAdd.length, updatedAt: Date.now() }
            : s,
        ),
      );
    }

    return imported;
  }, [session]);

  const clearSession = useCallback(async () => {
    if (!session || !reposRef.current) return;
    const { solves: solvesRepo } = reposRef.current;
    
    const allSolves = await solvesRepo.findAll(session.id);
    for (const s of allSolves) {
      await solvesRepo.delete(s.id);
    }
    
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
      puzzleType: puzzle ?? "3x3",
      createdAt: new Date().toISOString(),
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
    await sessionsRepo.update(existing);
    
    setSessions(prev => prev.map(s => 
      s.id === id ? { ...s, name, updatedAt: Date.now() } : s
    ));
  }, []);

  const deleteSession = useCallback(async (id: string) => {
    if (!reposRef.current) return;
    const { sessions: sessionsRepo, solves: solvesRepo } = reposRef.current;
    
    // Delete all solves for this session
    const allSolves = await solvesRepo.findAll(id);
    for (const s of allSolves) {
      await solvesRepo.delete(s.id);
    }
    
    // Delete the session from DB
    await sessionsRepo.delete(id);
    
    // Optimistically remove from React state
    setSessions(prev => prev.filter(s => s.id !== id));

    // Query DB directly instead of relying on potentially stale closure state
    const wasActive = id === activeSessionIdRef.current;
    if (wasActive) {
      const remainingSessions = await sessionsRepo.findAll();
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
    addSolve,
    updateSolve,
    deleteSolve,
    clearSession,
    importSolves,
    newSession,
    switchSession,
    renameSession,
    deleteSession,
    fetchSessionSolves,
  };
}
