/**
 * @cubalyze/database — Skill Progress Repository
 *
 * Persists skill-tree completion state (set of completed skill IDs) to
 * SQLite. This is the single source of truth, replacing the legacy
 * localStorage key `cubeforge_completed_skills_v2`.
 *
 * Follows the same pattern as TrainingRepository / SolvesRepository.
 */

import { nextLocalStamps } from './local-clock.js';
import { purgeTombstoneEchoes, rowIsDoomed } from './tombstone-echo.js';

type DBExecutor = (sql: string, bind?: unknown[]) => Promise<Record<string, unknown>[]>;

export interface SkillProgressRow {
  skill_id: string;
  completed_at: number;
}

/**
 * Re-completing a skill is an UPDATE, never a delete + insert.
 *
 * `INSERT OR REPLACE` looks equivalent and is not: REPLACE removes the
 * conflicting row first, and `skill_progress` has an AFTER DELETE trigger that
 * records a sync tombstone (migration 028). With `PRAGMA recursive_triggers`
 * enabled (the worker currently leaves it off, but nothing guarantees it stays
 * that way) every re-completion would mint a tombstone for a skill that is
 * still completed, get it pushed, and the cloud's conditional delete would
 * remove the very row the user just completed. The explicit upsert has no
 * delete, so it can never look like one.
 */
const UPSERT_COMPLETION =
  "INSERT INTO skill_progress (skill_id, completed_at) VALUES (?, ?)\n" +
  "  ON CONFLICT(skill_id) DO UPDATE SET completed_at = excluded.completed_at";

export class SkillProgressRepository {
  private db: DBExecutor;

  constructor(db: DBExecutor) {
    this.db = db;
  }

  /** All completed skill IDs, newest first. */
  async findAll(): Promise<string[]> {
    const rows = await this.db("SELECT skill_id FROM skill_progress ORDER BY completed_at DESC");
    return rows.map((r) => (r as unknown as SkillProgressRow).skill_id);
  }

  async isCompleted(skillId: string): Promise<boolean> {
    const rows = await this.db("SELECT skill_id FROM skill_progress WHERE skill_id = ?", [skillId]);
    return rows.length > 0;
  }

  /**
   * Every completed skill with its completion timestamp (oldest first) — the
   * sync push/pull shape. `completed_at` doubles as the LWW watermark: a
   * re-completion bumps it, an un-completion is captured by the DELETE
   * trigger tombstone (migration 028).
   */
  async findAllRows(): Promise<Array<{ skillId: string; completedAt: number }>> {
    const rows = await this.db(
      "SELECT skill_id, completed_at FROM skill_progress ORDER BY completed_at ASC",
    );
    return rows.map((r) => ({
      skillId: String((r as unknown as SkillProgressRow).skill_id),
      completedAt: Number((r as unknown as SkillProgressRow).completed_at) || 0,
    }));
  }

  async setCompleted(skillId: string): Promise<void> {
    // Monotonic clock stamp (M9): a toggle can never re-issue a completed_at
    // that collides with the push watermark, and two rapid toggles stay
    // strictly ordered.
    const completedAt = await nextLocalStamps(this.db, "skill_progress");
    await this.db(UPSERT_COMPLETION, [skillId, completedAt]);
  }

  /**
   * Upsert preserving the CLOUD completion timestamp (pull).
   * `??` (not `||`): a cloud row that legitimately carries completed_at = 0
   * must stay 0, never be re-sealed with a local Date.now() (M6) — the 0
   * value is what the next push compares against.
   */
  async setCompletedAt(skillId: string, completedAt: number): Promise<void> {
    await this.db(UPSERT_COMPLETION, [skillId, completedAt ?? Date.now()]);
  }

  async setIncomplete(skillId: string): Promise<void> {
    await this.db("DELETE FROM skill_progress WHERE skill_id = ?", [skillId]);
  }

  /**
   * Versioned un-completion for remote tombstones (LWW): only removes the
   * skill when it was not re-completed after the tombstone.
   */
  async setIncompleteIfNotNewer(skillId: string, deletedAt: number): Promise<void> {
    if (
      !(await rowIsDoomed(this.db, 'skill_progress', 'skill_id', skillId, 'completed_at', deletedAt))
    ) {
      return;
    }
    await this.db(
      "DELETE FROM skill_progress WHERE skill_id = ? AND completed_at <= ?",
      [skillId, deletedAt],
    );
    await purgeTombstoneEchoes(this.db, 'skill_progress', [skillId]);
  }

  /**
   * Replace the whole completion set atomically-ish (delete + insert).
   * Used to sync the full list from the UI or during localStorage migration.
   */
  async replaceAll(completedIds: string[]): Promise<void> {
    await this.db("DELETE FROM skill_progress");
    for (const id of completedIds) {
      await this.setCompleted(id);
    }
    // The DELETE above minted a tombstone for every row, including the ones
    // re-inserted a line later (this is a rewrite of the set, not a deletion).
    // Left behind, those tombstones would be pushed and the cloud's
    // conditional delete (`completed_at <= deleted_at`) could remove a skill
    // that is still completed — same-millisecond stamps make that a real
    // collision, not a theoretical one. Tombstones for ids that are NOT in the
    // new set stay: they are how the cloud learns about the un-completion.
    if (completedIds.length === 0) return;
    const placeholders = completedIds.map(() => "?").join(", ");
    await this.db(
      `DELETE FROM sync_tombstones WHERE entity = 'skill_progress' AND entity_id IN (${placeholders})`,
      completedIds,
    );
  }

  async count(): Promise<number> {
    const rows = await this.db("SELECT COUNT(*) as cnt FROM skill_progress");
    return (rows[0] as { cnt: number }).cnt;
  }
}
