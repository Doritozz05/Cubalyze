/**
 * @cubalyze/database — Profiles Repository
 *
 * Persists the user's identity row (migration 019): display name, handle, bio,
 * avatar (identicon or photo), declared solving methods and main puzzle.
 *
 * Today the app is local-first with a single anonymous user; the `user_id`
 * primary key is deliberately the stable identity key so the schema is
 * forward-compatible with future accounts and multi-device sync (D1).
 */

import type { Profile } from '@cubalyze/models';
import { nextLocalStamps } from './local-clock.js';

type DBExecutor = (sql: string, bind?: unknown[]) => Promise<Record<string, unknown>[]>;

export interface ProfileRow {
  user_id: string;
  display_name: string;
  handle: string;
  bio: string;
  avatar_kind: string;
  avatar_data: string | null;
  main_puzzle: string;
  declared_methods: string;
  country: string;
  created_at: number;
  updated_at: number;
}

/** Safe JSON parse for `declared_methods` — corrupt rows degrade to []. */
function parseDeclaredMethods(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

function rowToProfile(row: ProfileRow): Profile {
  return {
    userId: row.user_id,
    displayName: row.display_name,
    handle: row.handle,
    bio: row.bio,
    avatarKind: row.avatar_kind === 'photo' ? 'photo' : 'identicon',
    avatarData: row.avatar_data ?? undefined,
    mainPuzzle: row.main_puzzle,
    declaredMethods: parseDeclaredMethods(row.declared_methods),
    country: row.country ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Default identity row used on first launch (before the user edits anything). */
function defaultProfile(userId: string): Profile {
  return {
    userId,
    displayName: '',
    handle: '',
    bio: '',
    avatarKind: 'identicon',
    mainPuzzle: '333',
    declaredMethods: [],
    country: '',
    createdAt: 0,
    updatedAt: 0,
  };
}

export class ProfilesRepository {
  private db: DBExecutor;

  constructor(db: DBExecutor) {
    this.db = db;
  }

  async findById(userId: string): Promise<Profile | null> {
    const rows = await this.db('SELECT * FROM profiles WHERE user_id = ?', [userId]);
    return rows.length > 0 ? rowToProfile(rows[0] as unknown as ProfileRow) : null;
  }

  /**
   * Insert the default identity row only if it does not exist yet, recording
   * `created_at`/`updated_at` at insert time so "member since" works from day
   * one. Race-safe via INSERT OR IGNORE + re-read.
   */
  async getOrCreate(userId: string): Promise<Profile> {
    const existing = await this.findById(userId);
    if (existing) return existing;

    const now = Date.now();
    await this.db(
      `INSERT OR IGNORE INTO profiles
        (user_id, display_name, handle, bio, avatar_kind, avatar_data, main_puzzle, declared_methods, country, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, '', '', '', 'identicon', null, '333', '[]', '', now, now],
    );

    const created = await this.findById(userId);
    return created ?? defaultProfile(userId);
  }

  /**
   * Full replace of the identity row (used when editing the profile). The
   * sync pull passes the cloud timestamp (kept as-is); pass `{ local: true }`
   * from local edit paths so the repo takes a monotonic clock stamp strictly
   * newer than the row's previous stamp (M9) — a local edit must always
   * advance the profile's updated_at or it never leaves the device.
   */
  async upsert(profile: Profile, opts?: { local?: boolean }): Promise<void> {
    const stamped = opts?.local
      ? {
          ...profile,
          updatedAt: await nextLocalStamps(this.db, "profiles", 1, {
            floor: profile.updatedAt ?? 0,
          }),
        }
      : profile;
    await this.db(
      `INSERT OR REPLACE INTO profiles
        (user_id, display_name, handle, bio, avatar_kind, avatar_data, main_puzzle, declared_methods, country, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        stamped.userId,
        stamped.displayName,
        stamped.handle,
        stamped.bio,
        stamped.avatarKind,
        stamped.avatarData ?? null,
        stamped.mainPuzzle,
        JSON.stringify(stamped.declaredMethods),
        stamped.country ?? '',
        stamped.createdAt,
        stamped.updatedAt,
      ],
    );
  }

  async delete(userId: string): Promise<void> {
    await this.db('DELETE FROM profiles WHERE user_id = ?', [userId]);
  }

  /** Delete every profile row (account-deletion wipe). */
  async deleteAll(): Promise<void> {
    await this.db('DELETE FROM profiles');
  }
}
