/**
 * @cubeforge/sync-engine
 *
 * Offline-first cloud sync for CubeForge (Supabase):
 *  - row-level LWW sync with per-table watermarks and tombstone deletes;
 *  - derived training aggregates are NEVER synced raw — they are rebuilt
 *    from the synced attempt log via @cubeforge/training's deterministic
 *    replay (see rebuild.ts);
 *  - anonymous local identity is preserved as the CubeMark seed when an
 *    account claims the device (see SyncEngine.claim).
 */

export { SyncEngine } from "./SyncEngine";
export type { SyncEngineHooks } from "./SyncEngine";
export {
  createSupabaseClient,
  isSupabaseConfigured,
  readSupabaseEnv,
} from "./client";
export type { SupabaseEnv } from "./client";
export { getWatermark, setWatermark, pullWatermarkKey, pushWatermarkKey } from "./watermarks";
export { replayProgress } from "@cubeforge/training";
export type {
  ClaimMode,
  DBExecutor,
  LocalDataCounts,
  SyncContext,
  SyncStatus,
  SyncTotals,
  SyncableEntity,
} from "./types";
export { SYNCABLE_TABLES } from "./types";
