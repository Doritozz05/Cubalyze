"use client";

/**
 * Local cleanup after an account deletion.
 *
 * Deleting the account only removes the cloud copy; the local-first device
 * keeps everything. Without a wipe, the next account created on this device
 * would silently claim (auto-merge) the deleted account's solves, sessions,
 * training and profile — data the user explicitly chose to delete.
 *
 * This wipes every syncable row, every sync cursor/flag, the claimed
 * identity and the CubeMark seed, and regenerates a fresh anonymous id, so
 * the device returns to a pristine first-launch state.
 *
 * The Locker counts too: its rows, its photo blobs (IndexedDB) and the
 * pre-database localStorage blob — which still holds the deleted account's
 * photos as base64 — are all removed. The Locker's own `locker_*` bookkeeping
 * goes as well, so the next launch seeds a fresh taxonomy instead of adopting
 * the one that is being deleted.
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
  generateUuid,
  initDB,
  USER_ID_KEY,
} from "@cubalyze/database";
import { clearAllPhotos } from "@/views/Collection/collectionPhotos";
import { COLLECTION_STORAGE_KEY } from "@/views/Collection/collectionStore";

export async function wipeAccountLocalData(): Promise<void> {
  const dbClient = await initDB();
  const executor = async (sql: string, bind?: unknown[]) =>
    await dbClient.execute(sql, bind);
  const solves = new SolvesRepository(executor);
  const sessions = new SessionsRepository(executor);
  const training = new TrainingRepository(executor);
  const calendar = new CalendarRepository(executor);
  const skills = new SkillProgressRepository(executor);
  const profiles = new ProfilesRepository(executor);
  const meta = new AppMetaRepository(executor);

  // All syncable rows. The deletes fire the tombstone triggers — purged below.
  await solves.deleteAll();
  await sessions.deleteAll();
  await training.clearAllData();
  await calendar.clear();
  await skills.replaceAll([]);
  await profiles.deleteAll();

  // The Locker: rows, photo blobs, its own `locker_*` bookkeeping and the
  // pre-database blob (the only copy of some photos).
  await new GearRepository(executor).clear();
  await clearAllPhotos();
  await meta.deleteByPrefix("locker_");
  try {
    localStorage.removeItem(COLLECTION_STORAGE_KEY);
  } catch {
    // Private mode / no storage: nothing was ever written there.
  }

  // Every sync cursor, linked flag and dirty marker, plus the identity keys
  // (user_id, identicon_seed) of the deleted account.
  await meta.deleteByPrefix("sync_");
  await meta.deleteByPrefix("identicon_seed");
  await meta.deleteByPrefix("user_id");

  // Tombstones captured by the wipes must not survive: with no account they
  // would otherwise be pushed into whatever account claims the device next.
  await executor("DELETE FROM sync_tombstones");

  // Fresh anonymous identity for the next launch.
  await meta.set(USER_ID_KEY, generateUuid());
}
