/**
 * @cubeforge/database — Skill Progress Repository
 *
 * Persists skill-tree completion state (set of completed skill IDs) to
 * SQLite. This is the single source of truth, replacing the legacy
 * localStorage key `cubeforge_completed_skills_v2`.
 *
 * Follows the same pattern as TrainingRepository / SolvesRepository.
 */

type DBExecutor = (sql: string, bind?: unknown[]) => Promise<Record<string, unknown>[]>;

export interface SkillProgressRow {
  skill_id: string;
  completed_at: number;
}

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
    await this.db(
      "INSERT OR REPLACE INTO skill_progress (skill_id, completed_at) VALUES (?, ?)",
      [skillId, Date.now()],
    );
  }

  /** Insert-or-replace preserving the CLOUD completion timestamp (pull). */
  async setCompletedAt(skillId: string, completedAt: number): Promise<void> {
    await this.db(
      "INSERT OR REPLACE INTO skill_progress (skill_id, completed_at) VALUES (?, ?)",
      [skillId, completedAt || Date.now()],
    );
  }

  async setIncomplete(skillId: string): Promise<void> {
    await this.db("DELETE FROM skill_progress WHERE skill_id = ?", [skillId]);
  }

  /**
   * Versioned un-completion for remote tombstones (LWW): only removes the
   * skill when it was not re-completed after the tombstone.
   */
  async setIncompleteIfNotNewer(skillId: string, deletedAt: number): Promise<void> {
    await this.db(
      "DELETE FROM skill_progress WHERE skill_id = ? AND completed_at <= ?",
      [skillId, deletedAt],
    );
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
  }

  async count(): Promise<number> {
    const rows = await this.db("SELECT COUNT(*) as cnt FROM skill_progress");
    return (rows[0] as { cnt: number }).cnt;
  }
}
