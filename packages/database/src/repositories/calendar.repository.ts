/**
 * @cubeforge/database — Calendar Repository
 *
 * Persists training calendar tasks (recurring schedule entries) to SQLite.
 * This is the single source of truth, replacing the legacy localStorage
 * key `cubeforge-training-calendar`.
 *
 * Follows the same pattern as TrainingRepository / SolvesRepository.
 */

type DBExecutor = (sql: string, bind?: unknown[]) => Promise<Record<string, unknown>[]>;

// ─── Row Types (snake_case, matching SQL schema) ──────────────────────────

export interface TrainingTaskRow {
  id: string;
  title: string;
  description: string;
  start_date: string;
  repeat: string;
  days_of_week: string; // JSON array of weekday indices
  color: string;
  created_at: number;
}

// ─── Domain Types (camelCase, for consumers) ──────────────────────────────

export type TaskRepeat = "none" | "daily" | "weekdays" | "weekly" | "monthly" | "custom";
export type TaskColor = "blue" | "emerald" | "amber" | "violet" | "rose" | "cyan" | "orange" | "pink";

export interface TrainingTask {
  id: string;
  title: string;
  description: string;
  startDate: string; // yyyy-MM-dd
  repeat: TaskRepeat;
  daysOfWeek: number[];
  color: TaskColor;
  createdAt: string; // ISO timestamp
}

// ─── Row ↔ Domain converters ──────────────────────────────────────────────

function safeParseDaysOfWeek(raw: string): number[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((n) => typeof n === "number") : [];
  } catch {
    return [];
  }
}

function rowToTask(row: TrainingTaskRow): TrainingTask {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    startDate: row.start_date,
    repeat: row.repeat as TaskRepeat,
    daysOfWeek: safeParseDaysOfWeek(row.days_of_week),
    color: row.color as TaskColor,
    createdAt: row.created_at > 0 ? new Date(row.created_at).toISOString() : "",
  };
}

function taskToRow(task: TrainingTask): TrainingTaskRow {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    start_date: task.startDate,
    repeat: task.repeat,
    days_of_week: JSON.stringify(task.daysOfWeek),
    color: task.color,
    created_at: task.createdAt ? new Date(task.createdAt).getTime() : Date.now(),
  };
}

// ─── Repository ───────────────────────────────────────────────────────────

export class CalendarRepository {
  private db: DBExecutor;

  constructor(db: DBExecutor) {
    this.db = db;
  }

  async findAll(): Promise<TrainingTask[]> {
    const rows = await this.db("SELECT * FROM training_tasks ORDER BY start_date ASC, created_at ASC");
    return rows.map((r) => rowToTask(r as unknown as TrainingTaskRow));
  }

  async findById(id: string): Promise<TrainingTask | null> {
    const rows = await this.db("SELECT * FROM training_tasks WHERE id = ?", [id]);
    if (rows.length === 0) return null;
    return rowToTask(rows[0] as unknown as TrainingTaskRow);
  }

  async upsert(task: TrainingTask): Promise<void> {
    const row = taskToRow(task);
    await this.db(
      `INSERT INTO training_tasks (id, title, description, start_date, repeat, days_of_week, color, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         description = excluded.description,
         start_date = excluded.start_date,
         repeat = excluded.repeat,
         days_of_week = excluded.days_of_week,
         color = excluded.color`,
      [row.id, row.title, row.description, row.start_date, row.repeat, row.days_of_week, row.color, row.created_at],
    );
  }

  async bulkUpsert(tasks: TrainingTask[]): Promise<void> {
    for (const task of tasks) {
      await this.upsert(task);
    }
  }

  async delete(id: string): Promise<void> {
    await this.db("DELETE FROM training_tasks WHERE id = ?", [id]);
  }

  async clear(): Promise<void> {
    await this.db("DELETE FROM training_tasks");
  }

  /**
   * Replace the whole task list atomically-ish (clear + insert).
   * Ensures deletions in the UI are reflected in the DB.
   */
  async replaceAll(tasks: TrainingTask[]): Promise<void> {
    await this.clear();
    for (const task of tasks) {
      await this.upsert(task);
    }
  }

  async count(): Promise<number> {
    const rows = await this.db("SELECT COUNT(*) as cnt FROM training_tasks");
    return (rows[0] as { cnt: number }).cnt;
  }
}
