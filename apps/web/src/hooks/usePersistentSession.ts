"use client";

import { useCallback, useEffect, useState } from "react";
import type { Solve, Penalty } from "@/types";
import { v4 as uuidv4 } from "uuid";

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
  solves: Solve[];
  loading: boolean;
  /** Add a solve; optimistically updates the list + persists. */
  addSolve: (input: {
    time: number;
    penalty?: Penalty;
    scramble: string;
  }) => Promise<void>;
  /** Update a solve's penalty/note. */
  updateSolve: (
    id: string,
    updates: { penalty?: Penalty; note?: string | null },
  ) => Promise<void>;
  /** Delete a single solve. */
  deleteSolve: (id: string) => Promise<void>;
  /** Clear all solves in the current session. */
  clearSession: () => Promise<void>;
  /** Create a new session and switch to it. */
  newSession: (name?: string, puzzle?: string) => Promise<void>;
  /** Switch to an existing session by id. */
  switchSession: (id: string) => Promise<void>;
}

const STORAGE_KEY = "cubit:data";

interface StorageData {
  sessions: SessionMeta[];
  solves: Record<string, Solve[]>; // sessionId -> solves
  activeSessionId: string | null;
}

function loadData(): StorageData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    //
  }
  return { sessions: [], solves: {}, activeSessionId: null };
}

function saveData(data: StorageData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    //
  }
}

/**
 * Persistence layer: hydrates solves + sessions from localStorage and keeps them
 * in sync. 
 */
export function usePersistentSession(): UsePersistentSessionResult {
  const [data, setData] = useState<StorageData>({ sessions: [], solves: {}, activeSessionId: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loaded = loadData();
    if (loaded.sessions.length === 0) {
      const defaultSession = {
        id: uuidv4(),
        name: "Main Session",
        puzzle: "3x3",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        solveCount: 0,
      };
      loaded.sessions.push(defaultSession);
      loaded.solves[defaultSession.id] = [];
      loaded.activeSessionId = defaultSession.id;
      saveData(loaded);
    } else if (!loaded.activeSessionId || !loaded.sessions.find(s => s.id === loaded.activeSessionId)) {
        loaded.activeSessionId = loaded.sessions[0].id;
    }
    setData(loaded);
    setLoading(false);
  }, []);

  const session = data.sessions.find(s => s.id === data.activeSessionId) || null;
  const sessions = data.sessions;
  const solves = session ? (data.solves[session.id] || []) : [];

  const updateData = useCallback((updater: (prev: StorageData) => StorageData) => {
    setData((prev) => {
      const next = updater(prev);
      saveData(next);
      return next;
    });
  }, []);

  const addSolve = useCallback(async (input: { time: number; penalty?: Penalty; scramble: string }) => {
    if (!session) return;
    const newSolve: Solve = {
      id: uuidv4(),
      time: input.time,
      penalty: input.penalty ?? "none",
      scramble: input.scramble,
      timestamp: Date.now(),
    };
    updateData((prev) => {
      const activeId = prev.activeSessionId;
      if (!activeId) return prev;
      const s = [...(prev.solves[activeId] || [])];
      s.unshift(newSolve);
      
      const sess = prev.sessions.map(x => x.id === activeId ? { ...x, solveCount: s.length, updatedAt: Date.now() } : x);
      return { ...prev, sessions: sess, solves: { ...prev.solves, [activeId]: s } };
    });
  }, [session, updateData]);

  const updateSolve = useCallback(async (id: string, updates: { penalty?: Penalty; note?: string | null }) => {
    if (!session) return;
    updateData((prev) => {
      const activeId = prev.activeSessionId;
      if (!activeId) return prev;
      const s = (prev.solves[activeId] || []).map(solve => {
        if (solve.id === id) {
           return { ...solve, ...updates, note: updates.note === null ? undefined : (updates.note ?? solve.note) };
        }
        return solve;
      });
      return { ...prev, solves: { ...prev.solves, [activeId]: s } };
    });
  }, [session, updateData]);

  const deleteSolve = useCallback(async (id: string) => {
    if (!session) return;
    updateData((prev) => {
      const activeId = prev.activeSessionId;
      if (!activeId) return prev;
      const s = (prev.solves[activeId] || []).filter(solve => solve.id !== id);
      const sess = prev.sessions.map(x => x.id === activeId ? { ...x, solveCount: s.length, updatedAt: Date.now() } : x);
      return { ...prev, sessions: sess, solves: { ...prev.solves, [activeId]: s } };
    });
  }, [session, updateData]);

  const clearSession = useCallback(async () => {
    if (!session) return;
    updateData((prev) => {
      const activeId = prev.activeSessionId;
      if (!activeId) return prev;
      const sess = prev.sessions.map(x => x.id === activeId ? { ...x, solveCount: 0, updatedAt: Date.now() } : x);
      return { ...prev, sessions: sess, solves: { ...prev.solves, [activeId]: [] } };
    });
  }, [session, updateData]);

  const newSession = useCallback(async (name?: string, puzzle?: string) => {
    updateData((prev) => {
      const newSess = {
        id: uuidv4(),
        name: name ?? "Session",
        puzzle: puzzle ?? "3x3",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        solveCount: 0,
      };
      return {
        ...prev,
        activeSessionId: newSess.id,
        sessions: [newSess, ...prev.sessions],
        solves: { ...prev.solves, [newSess.id]: [] }
      };
    });
  }, [updateData]);

  const switchSession = useCallback(async (id: string) => {
    updateData((prev) => ({ ...prev, activeSessionId: id }));
  }, [updateData]);

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
  };
}
