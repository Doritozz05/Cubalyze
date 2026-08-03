/**
 * @cubeforge/database — Profiles Repository
 *
 * Persists the user's identity row (migration 019): display name, handle, bio,
 * avatar (identicon or photo), declared solving methods and main puzzle.
 *
 * Today the app is local-first with a single anonymous user; the `user_id`
 * primary key is deliberately the stable identity key so the schema is
 * forward-compatible with future accounts and multi-device sync (D1).
 */

import type { Profile } from '@cubeforge/models';

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
    mainPuzzle: '3x3x3',
    declaredMethods: [],
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
        (user_id, display_name, handle, bio, avatar_kind, avatar_data, main_puzzle, declared_methods, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, '', '', '', 'identicon', null, '3x3x3', '[]', now, now],
    );

    const created = await this.findById(userId);
    return created ?? defaultProfile(userId);
  }

  /** Full replace of the identity row (used when editing the profile). */
  async upsert(profile: Profile): Promise<void> {
    await this.db(
      `INSERT OR REPLACE INTO profiles
        (user_id, display_name, handle, bio, avatar_kind, avatar_data, main_puzzle, declared_methods, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        profile.userId,
        profile.displayName,
        profile.handle,
        profile.bio,
        profile.avatarKind,
        profile.avatarData ?? null,
        profile.mainPuzzle,
        JSON.stringify(profile.declaredMethods),
        profile.createdAt,
        profile.updatedAt,
      ],
    );
  }

  async delete(userId: string): Promise<void> {
    await this.db('DELETE FROM profiles WHERE user_id = ?', [userId]);
  }
}
