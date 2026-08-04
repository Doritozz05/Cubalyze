"use client";

import { useEffect, useSyncExternalStore } from "react";
import { initDB, AppMetaRepository } from "@cubeforge/database";
import { isDev } from "@/utils/env";
import {
  ONBOARDING_TOTAL_STEPS,
  onboardingBack,
  onboardingInitialState,
  onboardingNext,
  onboardingReplay,
  onboardingStart,
  type OnboardingStatus,
} from "./onboardingCore";

export interface UseOnboardingResult {
  status: OnboardingStatus;
  currentStep: number;
  totalSteps: number;
  /** idle → active(0). Called by the auto-start effect or the replay button. */
  start: () => void;
  /** active: step+1, or → done (persists the one-shot flag on the last step). */
  next: () => void;
  /** active: step-1 (clamped at 0). */
  back: () => void;
  /** active → done + persist. Never re-shows again. */
  skip: () => Promise<void>;
  /** active|idle → done + persist. Used by skip AND the eligibility guard. */
  complete: () => Promise<void>;
  /** done → active(0). Does NOT persist (Settings replay). */
  replay: () => void;
}

interface OnboardingStore {
  status: OnboardingStatus;
  currentStep: number;
  loading: boolean;
}

/**
 * Identity-style module-level singleton (pattern: useProfile). Every consumer
 * (App auto-start, OnboardingTour, Settings replay) shares ONE state object, so
 * `replay()` from Settings immediately remounts the tour.
 */
let store: OnboardingStore = { status: "loading", currentStep: 0, loading: true };
const listeners = new Set<() => void>();

let metaRepo: AppMetaRepository | null = null;
let initPromise: Promise<void> | null = null;

// localStorage mirror of the one-shot flag. Keeps the tour one-shot even when
// the DB is unavailable (broken/opfs-less worker) — skip/complete always write
// both, and reads fall back to the mirror when the DB read fails.
const LOCAL_FLAG_KEY = "cubeforge_onboarding_completed";

function readLocalFlag(): boolean {
  try {
    return localStorage.getItem(LOCAL_FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

function writeLocalFlag(): void {
  try {
    localStorage.setItem(LOCAL_FLAG_KEY, "1");
  } catch {
    /* ignore */
  }
}

function setStore(partial: Partial<OnboardingStore>): void {
  store = { ...store, ...partial };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): OnboardingStore {
  return store;
}

/** Read the one-shot flag once (shared promise, StrictMode-safe). */
function ensureInitialized(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const dbClient = await initDB();
      const dbExecutor = async (sql: string, bind?: unknown[]) =>
        await dbClient.execute(sql, bind);
      metaRepo = new AppMetaRepository(dbExecutor);
      const completed =
        (await metaRepo.getOnboardingCompleted()) || readLocalFlag();
      const next = onboardingInitialState(completed);
      setStore({ ...next, loading: false });
      if (isDev()) {
        console.log(
          "%c[useOnboarding]%c status=%s",
          "color:#38bdf8;font-weight:bold",
          "color:inherit",
          next.status,
        );
      }
    } catch (err) {
      console.error("[useOnboarding] Failed to initialize:", err);
      initPromise = null;
      // Fail-open: a transient DB hiccup (worker cold start, OPFS lock) must
      // NOT permanently mark the tour as seen — otherwise first-run users get
      // no onboarding and no way to re-trigger it. Falling back to the mirror
      // flag (idle when absent) lets App's auto-start effect still run the
      // tour once profile/session finish loading.
      setStore({
        ...onboardingInitialState(readLocalFlag()),
        loading: false,
      });
    }
  })();

  return initPromise;
}

/** Best-effort flag persist — a write failure must never break the app. */
async function persistCompleted(): Promise<void> {
  // Mirror first: even if the DB write below fails, the tour stays one-shot.
  writeLocalFlag();
  try {
    if (!metaRepo) await ensureInitialized();
    await metaRepo?.setOnboardingCompleted();
  } catch (err) {
    console.error("[useOnboarding] Failed to persist onboarding flag:", err);
  }
}

function start(): void {
  setStore(onboardingStart(store));
}

function next(): void {
  const nextState = onboardingNext(store);
  setStore(nextState);
  if (nextState.status === "done") {
    void persistCompleted();
  }
}

function back(): void {
  setStore(onboardingBack(store));
}

async function skip(): Promise<void> {
  if (store.status === "active") {
    setStore({ status: "done", currentStep: 0 });
    await persistCompleted();
  }
}

async function complete(): Promise<void> {
  if (store.status === "active" || store.status === "idle") {
    setStore({ status: "done", currentStep: 0 });
    await persistCompleted();
  }
}

function replay(): void {
  setStore(onboardingReplay(store));
}

export function useOnboarding(): UseOnboardingResult {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    void ensureInitialized();
  }, []);

  return {
    status: snapshot.status,
    currentStep: snapshot.currentStep,
    totalSteps: ONBOARDING_TOTAL_STEPS,
    start,
    next,
    back,
    skip,
    complete,
    replay,
  };
}
