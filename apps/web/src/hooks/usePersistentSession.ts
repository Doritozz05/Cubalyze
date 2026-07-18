"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import type { Solve as UISolve, Penalty } from "@/types";
import { v4 as uuidv4 } from "uuid";
import { initDB, SessionsRepository, SolvesRepository, type Solve as DBSolve } from "@cubeforge/database";
import type { CubeMoveEvent, SolveMetrics } from "@cubeforge/types";

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
    time: number;
    penalty?: Penalty;
    scramble: string;
    method?: string;
    moves?: CubeMoveEvent[];
    analysis?: SolveMetrics;
  }) => Promise<string | null>;
  updateSolve: (
    id: string,
    updates: { penalty?: Penalty; note?: string | null; analysis?: SolveMetrics },
  ) => Promise<void>;
  deleteSolve: (id: string) => Promise<void>;
  clearSession: () => Promise<void>;
  newSession: (name?: string, puzzle?: string) => Promise<void>;
  switchSession: (id: string) => Promise<void>;
  renameSession: (id: string, name: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
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
    penalty: (dbSolve.penalty || "none") as Penalty,
    scramble: dbSolve.scramble,
    timestamp: new Date(dbSolve.date).getTime(),
    note: dbSolve.method,
    method: dbSolve.method as UISolve['method'],
    moves: dbSolve.moves as UISolve['moves'],
    analysis,
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
                name: "Main Session",
                puzzleType: "3x3",
                createdAt: new Date().toISOString(),
              };
              await sessionsRepo.insert(defaultSession);
            }
          })();
        }
        await seedPromise;

        const allSessions = await sessionsRepo.findAll();
        
        let lastActive = localStorage.getItem("cubeforge:activeSessionId");
        if (!lastActive || !allSessions.find(s => s.id === lastActive)) {
          lastActive = allSessions[0].id;
          localStorage.setItem("cubeforge:activeSessionId", lastActive);
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
    time: number;
    penalty?: Penalty;
    scramble: string;
    method?: string;
    moves?: CubeMoveEvent[];
    analysis?: SolveMetrics;
  }): Promise<string | null> => {
    if (!session || !reposRef.current) return null;
    const { solves: solvesRepo } = reposRef.current;
    
    const solveId = uuidv4();
    const dbSolve: DBSolve = {
      id: solveId,
      sessionId: session.id,
      timeMs: input.time,
      date: new Date().toISOString(),
      scramble: input.scramble,
      penalty: input.penalty || "none",
      method: input.method,
      moves: input.moves || [],
      analysisEngineVersion: '0.1.0',
      analysis: input.analysis ? JSON.stringify(input.analysis) : undefined,
    };
    
    await solvesRepo.insert(dbSolve);
    
    const uiSolve: UISolve = {
      ...toUISolve(dbSolve),
      method: (input.method as UISolve['method']) || undefined,
      moves: input.moves,
      analysis: input.analysis,
    };
    setSolves(prev => [uiSolve, ...prev]);
    setSessions(prev => prev.map(s => 
      s.id === session.id ? { ...s, solveCount: s.solveCount + 1, updatedAt: Date.now() } : s
    ));
    return solveId;
  }, [session]);

  const updateSolve = useCallback(async (id: string, updates: { penalty?: Penalty; note?: string | null; analysis?: SolveMetrics }) => {
    if (!session || !reposRef.current) return;
    const { solves: solvesRepo } = reposRef.current;
    
    const existing = await solvesRepo.findById(id);
    if (!existing) return;
    
    existing.penalty = updates.penalty ?? existing.penalty;
    if (updates.note !== undefined) {
       existing.method = updates.note === null ? undefined : updates.note;
    }
    if (updates.analysis !== undefined) {
       existing.analysis = JSON.stringify(updates.analysis);
    }
    
    await solvesRepo.update(existing);
    
    setSolves(prev => prev.map(s => {
      if (s.id === id) {
         return {
           ...s,
           penalty: updates.penalty ?? s.penalty,
           note: updates.note === null ? undefined : (updates.note ?? s.note),
           analysis: updates.analysis ?? s.analysis,
         };
      }
      return s;
    }));
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
    
    const allSolves = await solvesRepo.findAll(id);
    for (const s of allSolves) {
      await solvesRepo.delete(s.id);
    }
    
    await sessionsRepo.delete(id);
    
    setSessions(prev => prev.filter(s => s.id !== id));

    if (id === activeSessionId) {
      const remaining = sessions.filter(s => s.id !== id);
      if (remaining.length > 0) {
        await switchSession(remaining[0].id);
      } else {
        await newSession();
      }
    }
  }, [sessions, activeSessionId, switchSession, newSession]);

  return {
    session,
    sessions,
    solves,
    loading,
    addSolve,
    updateSolve,
    deleteSolve,
    clearSession,
    newSession,
    switchSession,
    renameSession,
    deleteSession,
  };
}
