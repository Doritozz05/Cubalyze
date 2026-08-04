/**
 * @cubeforge/database — App Meta Repository
 *
 * Key/value metadata table (`app_meta`, migration 020). The single source of
 * truth for the anonymous local identity: on first launch the app generates a
 * stable `user_id` (UUID) and persists it here. The id never changes when the
 * user renames their profile — the identicon seed must stay stable (D2).
 *
 * Replaces the legacy ad-hoc `kv_store` table that used to be created directly
 * in the worker outside the migrations system.
 */

type DBExecutor = (sql: string, bind?: unknown[]) => Promise<Record<string, unknown>[]>;

/** Key under which the anonymous local user id is stored. */
export const USER_ID_KEY = 'user_id';

/**
 * Key marking the first-load onboarding tour as seen/skipped (TDD-0020).
 * Absent = first launch (tour eligible); '1' = never auto-show again.
 */
export const ONBOARDING_KEY = 'onboarding_completed';

export interface AppMetaRow {
  key: string;
  value: string;
}

/**
 * UUID v4 without dependencies. Uses the standard Web Crypto API where
 * available and falls back to a Math.random-based implementation for older
 * runtimes (e.g. Node < 19 without the global `crypto` object).
 */
export function generateUuid(): string {
  const c = globalThis.crypto;
  if (typeof c !== 'undefined' && typeof c.randomUUID === 'function') {
    return c.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class AppMetaRepository {
  private db: DBExecutor;

  constructor(db: DBExecutor) {
    this.db = db;
  }

  async get(key: string): Promise<string | null> {
    const rows = await this.db('SELECT value FROM app_meta WHERE key = ?', [key]);
    return rows.length > 0 ? (rows[0] as unknown as AppMetaRow).value : null;
  }

  /** Insert or overwrite a value. */
  async set(key: string, value: string): Promise<void> {
    await this.db('INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)', [key, value]);
  }

  /** Insert only when the key is absent (race-safe for parallel first-run calls). */
  async insertIfAbsent(key: string, value: string): Promise<void> {
    await this.db('INSERT OR IGNORE INTO app_meta (key, value) VALUES (?, ?)', [key, value]);
  }

  /**
   * Returns the stable anonymous local user id, generating and persisting one
   * on first launch. Idempotent and race-safe: concurrent calls converge on a
   * single stored id thanks to INSERT OR IGNORE + re-read.
   */
  async getOrCreateUserId(): Promise<string> {
    const existing = await this.get(USER_ID_KEY);
    if (existing) return existing;

    const generated = generateUuid();
    await this.insertIfAbsent(USER_ID_KEY, generated);

    const stored = await this.get(USER_ID_KEY);
    return stored ?? generated;
  }

  /** True once the first-load onboarding tour has been seen or skipped. */
  async getOnboardingCompleted(): Promise<boolean> {
    return (await this.get(ONBOARDING_KEY)) === '1';
  }

  /** Persist the one-shot flag so the tour never auto-shows again. */
  async setOnboardingCompleted(): Promise<void> {
    await this.set(ONBOARDING_KEY, '1');
  }
}
