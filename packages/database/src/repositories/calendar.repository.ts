/**
 * @cubeforge/database — Calendar Repository
 *
 * Persists training calendar tasks (recurring schedule entries) to SQLite.
 * This is the single source of truth, replacing the legacy localStorage
 * key `cubeforge-training-calendar`.
 *
 * Follows the same pattern as TrainingRepository / SolvesRepository.
 */

import { nextLocalStamps } from './local-clock.js';
import { purgeTombstoneEchoes, rowIsDoomed } from './tombstone-echo.js';

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
  updated_at: number;
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
  /** Epoch ms of the last edit — the LWW/sync watermark (migration 028). */
  updatedAt?: number;
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
    updatedAt: row.updated_at > 0 ? row.updated_at : row.created_at,
  };
}

function taskToRow(task: TrainingTask): TrainingTaskRow {
  const now = Date.now();
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    start_date: task.startDate,
    repeat: task.repeat,
    days_of_week: JSON.stringify(task.daysOfWeek),
    color: task.color,
    created_at: task.createdAt ? new Date(task.createdAt).getTime() : now,
    updated_at: task.updatedAt ?? now,
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

  /**
   * All tasks edited strictly after `updatedAt` (epoch ms) — the sync push
   * cursor. A fresh link passes 0 so every task is pushed. Optional
   * (updated_at, id) keyset pagination (see SolvesRepository.findAllSince).
   */
  async findAllSince(
    updatedAt: number,
    opts?: { limit?: number; afterUpdatedAt?: number; afterId?: string },
  ): Promise<TrainingTask[]> {
    let sql = "SELECT * FROM training_tasks";
    const bind: unknown[] = [];
    if (opts?.afterUpdatedAt !== undefined && opts.afterId !== undefined) {
      sql += " AND (updated_at > ? OR (updated_at = ? AND id > ?))";
      bind.push(opts.afterUpdatedAt, opts.afterUpdatedAt, opts.afterId);
    } else {
      sql += " WHERE updated_at > ?";
      bind.push(updatedAt);
    }
    sql += " ORDER BY updated_at ASC, id ASC";
    if (opts?.limit !== undefined) {
      sql += " LIMIT ?";
      bind.push(opts.limit);
    }
    const rows = await this.db(sql, bind);
    return rows.map((r) => rowToTask(r as unknown as TrainingTaskRow));
  }

  async findById(id: string): Promise<TrainingTask | null> {
    const rows = await this.db("SELECT * FROM training_tasks WHERE id = ?", [id]);
    if (rows.length === 0) return null;
    return rowToTask(rows[0] as unknown as TrainingTaskRow);
  }

  /**
   * Upsert a training task. The sync pull passes the cloud timestamp (kept
   * as-is); pass `{ local: true }` from local edit paths so the repo takes a
   * monotonic clock stamp strictly newer than the task's previous stamp (M9)
   * — without it, an edit that keeps the task's old updated_at would never
   * be re-selected by the push cursor.
   */
  async upsert(task: TrainingTask, opts?: { local?: boolean }): Promise<void> {
    const stamped = opts?.local
      ? {
          ...task,
          updatedAt: await nextLocalStamps(this.db, 'training_tasks', 1, {
            floor: task.updatedAt ?? 0,
          }),
        }
      : task;
    const row = taskToRow(stamped);
    await this.db(
      `INSERT INTO training_tasks (id, title, description, start_date, repeat, days_of_week, color, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         description = excluded.description,
         start_date = excluded.start_date,
         repeat = excluded.repeat,
         days_of_week = excluded.days_of_week,
         color = excluded.color,
         updated_at = excluded.updated_at`,
      [row.id, row.title, row.description, row.start_date, row.repeat, row.days_of_week, row.color, row.created_at, row.updated_at],
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

  /**
   * Versioned delete for remote tombstones (LWW): only removes the task when
   * it was not edited after the tombstone.
   */
  async deleteIfNotNewer(id: string, deletedAt: number): Promise<void> {
    if (!(await rowIsDoomed(this.db, 'training_tasks', 'id', id, 'updated_at', deletedAt))) {
      return;
    }
    await this.db(
      "DELETE FROM training_tasks WHERE id = ? AND updated_at <= ?",
      [id, deletedAt],
    );
    await purgeTombstoneEchoes(this.db, 'training_tasks', [id]);
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
