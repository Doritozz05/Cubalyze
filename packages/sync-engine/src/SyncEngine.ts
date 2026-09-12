/**
 * SyncEngine — the orchestrator tying auth, watermarks, push, pull,
 * tombstones and the aggregate rebuild together.
 *
 * Lifecycle:
 *  - `setUser(uid)`  — called by the auth layer whenever the signed-in user
 *    changes; schedules a background sync.
 *  - `claim(mode)`   — first-login link on a device: parks the anonymous
 *    CubeMark seed, remaps the profile row to the account, then either
 *    pushes all local data up (`merge`) or wipes local and starts from the
 *    cloud (`fresh`), finishing with a full pull + rebuild.
 *  - `syncNow()`     — one push + pull + rebuild cycle (debounced via
 *    `scheduleSync()`).
 *
 * The dirty loop guard: writes fire SQLite triggers that set `sync_dirty`
 * (migration 028). The flag is cleared at the START of a cycle; if a write
 * landed mid-cycle, the flag is re-set and another cycle is scheduled. This
 * catches every change, including pull-applied rows (one extra no-op cycle).
 */

import {
  AppMetaRepository,
  CalendarRepository,
  GearRepository,
  ProfilesRepository,
  SessionsRepository,
  SkillProgressRepository,
  SolvesRepository,
  TrainingRepository,
  USER_ID_KEY,
} from "@cubeforge/database";
import type { Profile } from "@cubeforge/models";
import type { SupabaseClient } from "@supabase/supabase-js";
import { claimHandle, type HandleClaimResult } from "./handle";
import { pullChanges } from "./pull";
import { pushChanges } from "./push";
import { rebuildAggregates } from "./rebuild";
import { purgeLocalTombstones } from "./tombstones";
import type {
  ClaimMode,
  DBExecutor,
  LocalDataCounts,
  SyncContext,
  SyncStatus,
  SyncTotals,
} from "./types";
import { SYNCABLE_TABLES } from "./types";

/**
 * App-injected callbacks the engine cannot implement itself (it lives in a
 * package with no DOM/IndexedDB access).
 */
export interface SyncEngineHooks {
  /**
   * Fase 6 — remove the Locker's photo BYTES on a "fresh" claim. They live in
   * IndexedDB, which this package does not touch; the web app wires this to
   * its blob store. A failure is logged and never blocks the row wipe.
   */
  clearLocalPhotos?: () => Promise<void>;
}

const EMPTY_TOTALS: SyncTotals = {
  pushed: {},
  pulled: {},
  pushedTombstones: 0,
  appliedTombstones: 0,
  rebuilt: false,
};

/** Safe JSON parse for the cloud profile's declared_methods (string column). */
function parseMethods(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as string[]).map(String) : [];
  } catch {
    return [];
  }
}

/**
 * M11 — true only when the profile carries real user content (as opposed to
 * the empty installation default). Used to decide whether a claim's local
 * profile may seed the cloud (first device) or must yield to an already
 * edited cloud profile.
 */
function profileHasContent(profile: Profile): boolean {
  return Boolean(
    (profile.displayName ?? "").trim() ||
      (profile.handle ?? "").trim() ||
      (profile.bio ?? "").trim() ||
      (profile.country ?? "").trim() ||
      (profile.avatarKind === "photo" && profile.avatarData) ||
      (profile.declaredMethods?.length ?? 0) > 0,
  );
}

export class SyncEngine {
  private ctx: SyncContext;
  private uid: string | null = null;
  private status: SyncStatus = "signed_out";
  private syncPromise: Promise<SyncTotals> | null = null;
  private claimPromise: Promise<void> | null = null;
  private scheduleTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly onStatus?: (status: SyncStatus) => void;
  /**
   * Called at the end of every completed sync cycle (and claim) with the
   * totals, so the UI layer can react to "rows actually moved" (e.g. bump a
   * data revision that other tabs pick up via BroadcastChannel).
   */
  private readonly onCycle?: (totals: SyncTotals) => void;
  /**
   * Claim gate: while the first-login dialog is pending, NO data leaves the
   * device (push, scheduled syncs and the poller all no-op). Without this,
   * setUser's background sync uploads everything before the user picks
   * "combine" vs "fresh" — silently defeating the choice (a fresh start
   * would already have pushed the local history it was meant to discard).
   */
  private claimPending = false;
  private readonly hooks?: SyncEngineHooks;

  constructor(
    db: DBExecutor,
    supabase: SupabaseClient,
    onStatus?: (status: SyncStatus) => void,
    onCycle?: (totals: SyncTotals) => void,
    hooks?: SyncEngineHooks,
  ) {
    this.ctx = {
      db,
      supabase,
      meta: new AppMetaRepository(db),
      profiles: new ProfilesRepository(db),
      solves: new SolvesRepository(db),
      sessions: new SessionsRepository(db),
      training: new TrainingRepository(db),
      calendar: new CalendarRepository(db),
      skills: new SkillProgressRepository(db),
      gear: new GearRepository(db),
    };
    this.onStatus = onStatus;
    this.onCycle = onCycle;
    this.hooks = hooks;
  }

  get userId(): string | null {
    return this.uid;
  }

  get currentStatus(): SyncStatus {
    return this.status;
  }

  private setStatus(status: SyncStatus): void {
    this.status = status;
    this.onStatus?.(status);
  }

  /**
   * The auth layer calls this on every session change. Pass
   * `{ schedule: false }` when the caller still has to decide whether the
   * claim dialog will show (the claim gate must win over the background
   * sync) — the caller re-schedules once it knows the claim resolved.
   */
  setUser(uid: string | null, opts?: { schedule?: boolean }): void {
    this.uid = uid;
    this.setStatus(uid ? "idle" : "signed_out");
    if (uid && opts?.schedule !== false) this.scheduleSync(1500);
  }

  /**
   * Lock sync until the user resolves the first-login claim dialog, and
   * surface it as `claim_pending` so the UI never shows "idle" (green)
   * while the device is silently paused. Opened inside claim()/unlink().
   */
  setClaimPending(): void {
    this.claimPending = true;
    this.setStatus("claim_pending");
  }

  /**
   * True when the linked account already holds real data in the cloud.
   *
   * Scaffolding tables are excluded because they can never signal "has
   * data": `profiles` (the signup trigger always creates one row), and
   * `sessions` / `training_sessions` — a session only has meaning through
   * its solves/attempts, and if the cloud has zero solves then every
   * session is empty.
   *
   * Counting empty sessions would make a brand-new account look occupied:
   * the claim dialog would appear, and "start fresh" could wipe real local
   * solves to keep nothing. Used to skip the dialog on a new account — with
   * an empty cloud the local history simply becomes the account's data
   * (auto-merge), and "start fresh" stays unreachable.
   */
  async hasCloudData(): Promise<boolean> {
    if (!this.uid) return false;
    for (const table of SYNCABLE_TABLES) {
      if (
        table === "profiles" ||
        table === "sessions" ||
        table === "training_sessions" ||
        // Fase 6 — a category or a type with no items is empty scaffolding:
        // counting it would show the claim dialog (and offer "start fresh",
        // which discards local data) on an account with nothing worth keeping.
        // Only gear_items signals "this account already has a Locker".
        table === "gear_categories" ||
        table === "gear_types"
      )
        continue;
      const { count, error } = await this.ctx.supabase
        .from(table)
        .select("*", { count: "exact", head: true })
        .eq("user_id", this.uid);
      if (error) throw error;
      if ((count ?? 0) > 0) return true;
    }
    return false;
  }

  /**
   * M11 — read the account's cloud profile row (if any). This is consulted
   * during a claim merge to decide whether the local profile may seed the
   * cloud or must yield to an already-edited cloud profile. Returns null
   * when the account has no profile row (should not happen after signup,
   * but defensively).
   */
  private async readCloudProfile(uid: string): Promise<Profile | null> {
    if (!this.uid) return null;
    const supabase = this.ctx.supabase;
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", uid);
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : null;
    if (!row) return null;
    return {
      userId: String(row.user_id ?? ""),
      displayName: String(row.display_name ?? ""),
      handle: String(row.handle ?? ""),
      bio: String(row.bio ?? ""),
      avatarKind: row.avatar_kind === "photo" ? "photo" : "identicon",
      avatarData:
        row.avatar_data == null ? undefined : String(row.avatar_data),
      mainPuzzle: String(row.main_puzzle ?? "333"),
      declaredMethods: Array.isArray(row.declared_methods)
        ? (row.declared_methods as string[])
        : typeof row.declared_methods === "string"
          ? parseMethods(row.declared_methods)
          : [],
      country: String(row.country ?? ""),
      createdAt: Number(row.created_at) || 0,
      updatedAt: Number(row.updated_at) || 0,
    };
  }

  /** What this device holds locally (shown in the claim dialog). */
  async getCounts(): Promise<LocalDataCounts> {
    return {
      solves: await this.ctx.solves.countNonDemo(),
      sessions: (await this.ctx.sessions.findAllNonDemo()).length,
      trainingAttempts: (await this.ctx.training.findAttemptsAll()).length,
      trainingTasks: await this.ctx.calendar.count(),
      skills: await this.ctx.skills.count(),
      gearItems: (await this.ctx.gear.count()).items,
    };
  }

  /**
   * First-login link: park the CubeMark seed, remap identity, then either
   * upload the local history (`merge`) or replace the device with the cloud
   * state (`fresh`). Ends with a full pull + aggregate rebuild.
   *
   * Serialized: concurrent callers share the in-flight promise.
   *
   * Watermarks are NOT stamped here: push/pull already advanced their own
   * cursors to the values actually exchanged, so a write landing while the
   * claim runs stays above the push watermark and is uploaded by the
   * rescheduled cycle (the dirty flag is preserved, never erased).
   */
  claim(mode: ClaimMode): Promise<void> {
    if (this.claimPromise) return this.claimPromise;
    this.claimPromise = this.doClaim(mode).finally(() => {
      this.claimPromise = null;
    });
    return this.claimPromise;
  }

  private async doClaim(mode: ClaimMode): Promise<void> {
    if (!this.uid) throw new Error("Not signed in");
    const uid = this.uid;
    // Keep the claim gate CLOSED for the whole claim: the poller and any
    // scheduled sync must no-op until the claim finished (a mid-claim sync
    // could push the local history before a "fresh" choice discards it, or
    // interleave with the wipe). The claim itself performs its own
    // push/pull, which is not subject to the gate.
    this.setClaimPending();
    this.setStatus("claim");
    try {
      // 1. Identity: park the CubeMark seed, then follow the account.
      //
      //    merge: the edited local profile (still keyed by the anonymous id
      //    — USER_ID_KEY has not been remapped yet) is read via that id and
      //    re-keyed to the account so an edited name/bio is uploaded.
      //
      //    fresh: the local profile is DISCARDED — the cloud replaces this
      //    device including identity, so nothing local may overwrite the
      //    account's cloud profile (the signup/default row that a fresh
      //    start is supposed to keep).
      const anonId = await this.ctx.meta.get(USER_ID_KEY);
      const anonProfile =
        anonId && anonId !== uid
          ? await this.ctx.profiles.findById(anonId)
          : null;

      if (mode === "fresh") {
        if (anonProfile) {
          // D2: the CubeMark seed stays stable even though the identity is
          // replaced by the account's.
          await this.ctx.meta.setIdenticonSeed(anonProfile.userId);
        }
        await this.wipeLocal();
        await this.ctx.profiles.delete(anonId ?? uid);
        await this.ctx.profiles.delete(uid);
      } else {
        const profile =
          anonProfile ?? (await this.ctx.profiles.findById(uid));
        if (profile && profile.userId !== uid) {
          // M11 — Cloud profile wins the merge. Before remapping and
          // uploading the local profile, check what the cloud already holds:
          // a brand-new account's signup trigger creates an EMPTY profile
          // row, and every device has a local profile (also empty unless the
          // user edited it). Uploading the local profile unconditionally —
          // with a fresh monotonic updated_at that LWW then honours — lets
          // the SECOND (empty) device silently clobber the profile the FIRST
          // device edited. We only upload the local profile when the cloud
          // row is still the empty default (first claim / identity seed); if
          // the cloud already holds an edited profile, we park the local
          // seed and let the claim's pull bring the cloud profile down.
          const cloudProfile = await this.readCloudProfile(uid);
          if (
            !cloudProfile ||
            !profileHasContent(profile)
          ) {
            // No edited cloud profile yet: the local identity seeds the
            // account (first device / first edit). Park the CubeMark seed
            // and remap the local profile to the account so it is pushed.
            await this.ctx.meta.setIdenticonSeed(profile.userId);
            if (profileHasContent(profile)) {
              // Local remap: { local: true } stamps updated_at with the
              // monotonic clock so the remapped profile is pushed (M9).
              await this.ctx.profiles.upsert(
                { ...profile, userId: uid },
                { local: true },
              );
            }
          } else {
            // Cloud already holds an edited profile: it must win. Drop the
            // local anonymous profile row (it would otherwise linger
            // orphaned) and let the claim's pull fetch the cloud profile.
            // The local CubeMark seed is still parked so THIS device keeps
            // its original mark.
            await this.ctx.meta.setIdenticonSeed(profile.userId);
            await this.ctx.profiles.delete(profile.userId);
          }
        } else if (!profile) {
          await this.ctx.profiles.getOrCreate(uid);
        }
      }
      // The local identity now follows the account: useProfile re-reads
      // USER_ID_KEY on refresh, so the UI keeps tracking the linked profile
      // instead of the parked anonymous id (which lives on as the CubeMark
      // seed under identicon_seed).
      await this.ctx.meta.set(USER_ID_KEY, uid);

      // 2. Full push + full pull + rebuild. Watermarks start at 0 for a new
      //    link, so merge pushes everything (in batches); fresh pushes
      //    nothing and pulls the cloud state (including the profile).
      const pushed = await pushChanges(this.ctx, uid);
      const pulled = await pullChanges(this.ctx, uid);
      await rebuildAggregates(this.ctx);
      this.onCycle?.({
        pushed: pushed.pushed,
        pulled: pulled.pulled,
        pushedTombstones: pushed.pushedTombstones,
        appliedTombstones: pulled.appliedTombstones,
        rebuilt: true,
      });

      await this.ctx.meta.set(`sync_linked_${uid}`, "1");

      // 3. Never erase a concurrent dirty flag: if a write landed during the
      //    claim it stays above the push watermark and must be uploaded by a
      //    follow-up cycle, not swallowed by a stamp.
      if ((await this.ctx.meta.get("sync_dirty")) === "1") {
        this.scheduleSync(250);
      }
      this.claimPending = false;
      this.setStatus("idle");
    } catch (err) {
      console.error("[sync-engine] claim failed:", err);
      // Reopen the gate so the UI can retry the claim.
      this.claimPending = false;
      this.setStatus("error");
      throw err;
    }
  }

  /**
   * Fase 8 — claim this account's public handle (`@name`).
   *
   * Thin wrapper on purpose: the identity work lives in `handle.ts` (one RPC
   * plus adopting the server's stamp locally) and the UI owns the copy. The
   * engine is only here because it already holds the context, so no view has
   * to reach into the database or build its own Supabase client.
   *
   * No sync is scheduled: `handle_claim` already wrote the cloud row, so the
   * other devices get it on their next pull; this device's local row is
   * written by the claim itself.
   */
  async claimHandle(raw: string): Promise<HandleClaimResult> {
    if (!this.uid) throw new Error("claimHandle requires a signed-in account");
    return claimHandle(this.ctx, this.uid, raw);
  }

  /** One full sync cycle. Serialized: concurrent callers share the promise. */
  syncNow(): Promise<SyncTotals> {
    if (!this.uid || this.claimPending) return Promise.resolve(EMPTY_TOTALS);
    if (this.syncPromise) return this.syncPromise;
    this.syncPromise = this.doSyncSerialized();
    return this.syncPromise.finally(() => {
      this.syncPromise = null;
    });
  }

  /**
   * Serialize the sync loop across TABS with the Web Locks API. Every tab
   * runs a poller against the shared SQLite worker, but only one tab may
   * push/pull at a time: the others skip (`ifAvailable`) and retry on their
   * next tick — the watermarks make a skipped cycle a harmless no-op.
   * Without this, two tabs would race the watermark cursors and fire
   * duplicate sync_apply RPCs every cycle.
   */
  private async doSyncSerialized(): Promise<SyncTotals> {
    const locks =
      typeof navigator !== "undefined" ? navigator.locks : undefined;
    if (!locks?.request) return this.doSync();
    const result = await locks.request(
      "cubeforge-sync",
      { ifAvailable: true },
      () => this.doSync(),
    );
    return result ?? EMPTY_TOTALS;
  }

  /** Debounced sync — the write hooks call this after every mutation. */
  scheduleSync(delayMs = 2000): void {
    if (!this.uid || this.claimPending) return;
    if (this.scheduleTimer !== null) clearTimeout(this.scheduleTimer);
    this.scheduleTimer = setTimeout(() => {
      this.scheduleTimer = null;
      void this.syncNow().catch(() => {
        /* status already surfaced via onStatus */
      });
    }, delayMs);
  }

  /** True when this account already claimed this device (link persisted). */
  async wasLinked(uid: string): Promise<boolean> {
    return (await this.ctx.meta.get(`sync_linked_${uid}`)) === "1";
  }

  /**
   * True when something is waiting to sync (dirty flag or pending tombstone).
   * Used by the UI poller to avoid empty network round-trips every tick.
   */
  async hasPendingChanges(): Promise<boolean> {
    if (!this.uid || this.claimPending) return false;
    if ((await this.ctx.meta.get("sync_dirty")) === "1") return true;
    const rows = await this.ctx.db(
      "SELECT COUNT(*) AS cnt FROM sync_tombstones",
    );
    return Number((rows[0] as { cnt?: unknown })?.cnt ?? 0) > 0;
  }

  /** Unlink without touching local data (logout keeps everything local). */
  unlink(): void {
    if (this.scheduleTimer !== null) {
      clearTimeout(this.scheduleTimer);
      this.scheduleTimer = null;
    }
    this.uid = null;
    this.claimPending = false;
    this.setStatus("signed_out");
  }

  private async doSync(): Promise<SyncTotals> {
    if (!this.uid) return EMPTY_TOTALS;
    const uid = this.uid;
    this.setStatus("syncing");
    try {
      // Clear the dirty flag FIRST; a write landing mid-cycle re-sets it and
      // the end-of-cycle check schedules another pass (loop guard).
      await this.ctx.meta.set("sync_dirty", "0");

      const pushed = await pushChanges(this.ctx, uid);
      const pulled = await pullChanges(this.ctx, uid);

      const changed =
        Object.keys(pushed.pushed).length > 0 ||
        Object.keys(pulled.pulled).length > 0 ||
        pushed.pushedTombstones > 0 ||
        pulled.appliedTombstones > 0;
      const totals: SyncTotals = {
        pushed: pushed.pushed,
        pulled: pulled.pulled,
        pushedTombstones: pushed.pushedTombstones,
        appliedTombstones: pulled.appliedTombstones,
        rebuilt: false,
      };
      if (changed) {
        await rebuildAggregates(this.ctx);
        totals.rebuilt = true;
      }
      this.onCycle?.(totals);

      this.setStatus("idle");
      if ((await this.ctx.meta.get("sync_dirty")) === "1") {
        this.scheduleSync(250);
      }
      return totals;
    } catch (err) {
      console.error("[sync-engine] sync failed:", err);
      this.setStatus("error");
      throw err;
    }
  }

  /** "Start fresh": the cloud replaces this device (claim mode `fresh`). */
  private async wipeLocal(): Promise<void> {
    await this.ctx.solves.deleteAll();
    await this.ctx.sessions.deleteAll();
    await this.ctx.training.clearAllData();
    await this.ctx.calendar.clear();
    await this.ctx.skills.replaceAll([]);
    // Fase 6 — the Locker is data too. Without this, "fresh" discarded the
    // solves but kept the collection and pushed it into the account the user
    // explicitly chose to start from the cloud.
    await this.ctx.gear.clear();
    // Photo BYTES live in IndexedDB, which this package does not reach. A
    // failure here must not block the wipe — the ledger is already gone, so
    // orphaned blobs are simply unreferenced, never resurrected.
    try {
      await this.hooks?.clearLocalPhotos?.();
    } catch (err) {
      console.warn("[sync-engine] fresh claim: could not clear local photos", err);
    }
    // The wipes fired the tombstone triggers — purge so a fresh start can
    // never delete the cloud rows the user explicitly chose to keep.
    await purgeLocalTombstones(this.ctx.db);
  }
}
