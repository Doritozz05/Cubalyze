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
  ProfilesRepository,
  SessionsRepository,
  SkillProgressRepository,
  SolvesRepository,
  TrainingRepository,
  USER_ID_KEY,
} from "@cubeforge/database";
import type { SupabaseClient } from "@supabase/supabase-js";
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
import { pullWatermarkKey, pushWatermarkKey, setWatermark } from "./watermarks";

const EMPTY_TOTALS: SyncTotals = {
  pushed: {},
  pulled: {},
  pushedTombstones: 0,
  appliedTombstones: 0,
  rebuilt: false,
};

export class SyncEngine {
  private ctx: SyncContext;
  private uid: string | null = null;
  private status: SyncStatus = "signed_out";
  private syncPromise: Promise<SyncTotals> | null = null;
  private scheduleTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly onStatus?: (status: SyncStatus) => void;
  /**
   * Claim gate: while the first-login dialog is pending, NO data leaves the
   * device (push, scheduled syncs and the poller all no-op). Without this,
   * setUser's background sync uploads everything before the user picks
   * "combine" vs "fresh" — silently defeating the choice (a fresh start
   * would already have pushed the local history it was meant to discard).
   */
  private claimPending = false;

  constructor(
    db: DBExecutor,
    supabase: SupabaseClient,
    onStatus?: (status: SyncStatus) => void,
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
    };
    this.onStatus = onStatus;
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
        table === "training_sessions"
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

  /** What this device holds locally (shown in the claim dialog). */
  async getCounts(): Promise<LocalDataCounts> {
    return {
      solves: await this.ctx.solves.countNonDemo(),
      sessions: (await this.ctx.sessions.findAllNonDemo()).length,
      trainingAttempts: (await this.ctx.training.findAttemptsAll()).length,
      trainingTasks: await this.ctx.calendar.count(),
      skills: await this.ctx.skills.count(),
    };
  }

  /**
   * First-login link: park the CubeMark seed, remap identity, then either
   * upload the local history (`merge`) or replace the device with the cloud
   * state (`fresh`). Ends with a full pull + aggregate rebuild.
   */
  async claim(mode: ClaimMode): Promise<void> {
    if (!this.uid) throw new Error("Not signed in");
    const uid = this.uid;
    // Open the gate: the claim itself performs the full push/pull, and any
    // sync scheduled afterwards is safe to run.
    this.claimPending = false;
    this.setStatus("claim");
    try {
      // 1. Identity remap: profiles.user_id becomes the account uid. The old
      //    anonymous id is parked as the identicon seed so the CubeMark never
      //    changes (D2 — the mark is generated from a stable seed).
      //
      //    On the FIRST claim the edited local profile is still keyed by the
      //    anonymous id (USER_ID_KEY has not been remapped yet), so it is
      //    read via that id and re-keyed to the account — otherwise an edited
      //    name/bio would be orphaned and never uploaded.
      const anonId = await this.ctx.meta.get(USER_ID_KEY);
      const anonProfile =
        anonId && anonId !== uid
          ? await this.ctx.profiles.findById(anonId)
          : null;
      const profile =
        anonProfile ?? (await this.ctx.profiles.findById(uid));
      if (profile && profile.userId !== uid) {
        await this.ctx.meta.setIdenticonSeed(profile.userId);
        await this.ctx.profiles.upsert({
          ...profile,
          userId: uid,
          updatedAt: Date.now(),
        });
      } else if (!profile) {
        await this.ctx.profiles.getOrCreate(uid);
      }
      // The local identity now follows the account: useProfile re-reads
      // USER_ID_KEY on refresh, so the UI keeps tracking the linked profile
      // instead of the parked anonymous id (which lives on as the CubeMark
      // seed under identicon_seed).
      await this.ctx.meta.set(USER_ID_KEY, uid);

      // 2. "Start fresh": the cloud replaces this device.
      if (mode === "fresh") {
        await this.wipeLocal();
      }

      // 3. Full push (merge) + full pull + rebuild. Watermarks start at 0 for
      //    a new link, so merge pushes everything; fresh pushes nothing.
      await pushChanges(this.ctx, uid);
      await pullChanges(this.ctx, uid);
      await rebuildAggregates(this.ctx);

      // 4. Ceiling: never re-push or re-pull what we just exchanged.
      const ceiling = Date.now();
      for (const table of SYNCABLE_TABLES) {
        await setWatermark(this.ctx.meta, pushWatermarkKey(table, uid), ceiling);
        await setWatermark(this.ctx.meta, pullWatermarkKey(table, uid), ceiling);
      }
      await this.ctx.meta.set("sync_dirty", "0");
      await this.ctx.meta.set(`sync_linked_${uid}`, "1");
      this.setStatus("idle");
    } catch (err) {
      console.error("[sync-engine] claim failed:", err);
      this.setStatus("error");
      throw err;
    }
  }

  /** One full sync cycle. Serialized: concurrent callers share the promise. */
  syncNow(): Promise<SyncTotals> {
    if (!this.uid || this.claimPending) return Promise.resolve(EMPTY_TOTALS);
    if (this.syncPromise) return this.syncPromise;
    this.syncPromise = this.doSync();
    return this.syncPromise.finally(() => {
      this.syncPromise = null;
    });
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
    // The wipes fired the tombstone triggers — purge so a fresh start can
    // never delete the cloud rows the user explicitly chose to keep.
    await purgeLocalTombstones(this.ctx.db);
  }
}
