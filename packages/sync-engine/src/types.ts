import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AppMetaRepository,
  CalendarRepository,
  GearRepository,
  ProfilesRepository,
  SessionsRepository,
  SkillProgressRepository,
  SolvesRepository,
  TrainingRepository,
} from "@cubeforge/database";

/** Minimal DB executor signature — matches every repository's constructor. */
export type DBExecutor = (
  sql: string,
  bind?: unknown[],
) => Promise<Record<string, unknown>[]>;

/** Every local table that mirrors into the cloud (rows, not derived data). */
export type SyncableEntity =
  | "solves"
  | "sessions"
  | "profiles"
  | "training_attempts"
  | "training_sessions"
  | "training_tasks"
  | "skill_progress"
  // Fase 6 — the Locker. Order matters on pull (a type needs its category, an
  // item needs its category), never on push (the cloud has no FKs).
  | "gear_categories"
  | "gear_types"
  | "gear_items";

export const SYNCABLE_TABLES: readonly SyncableEntity[] = [
  "solves",
  "sessions",
  "profiles",
  "training_attempts",
  "training_sessions",
  "training_tasks",
  "skill_progress",
  "gear_categories",
  "gear_types",
  "gear_items",
];

export type SyncStatus =
  | "signed_out"
  | "unconfigured"
  | "idle"
  | "syncing"
  | "claim"
  | "claim_pending"
  | "error";

/** What a first-login device holds, shown in the claim dialog. */
export interface LocalDataCounts {
  solves: number;
  sessions: number;
  trainingAttempts: number;
  trainingTasks: number;
  skills: number;
  /** Locker items (Fase 6) — the part of the collection that would be merged. */
  gearItems: number;
}

export interface SyncTotals {
  pushed: Partial<Record<SyncableEntity, number>>;
  pulled: Partial<Record<SyncableEntity, number>>;
  pushedTombstones: number;
  appliedTombstones: number;
  rebuilt: boolean;
}

export type ClaimMode = "merge" | "fresh";

/** Everything the push/pull/rebuild steps need, wired once in the engine. */
export interface SyncContext {
  db: DBExecutor;
  supabase: SupabaseClient;
  meta: AppMetaRepository;
  profiles: ProfilesRepository;
  solves: SolvesRepository;
  sessions: SessionsRepository;
  training: TrainingRepository;
  calendar: CalendarRepository;
  skills: SkillProgressRepository;
  gear: GearRepository;
}
