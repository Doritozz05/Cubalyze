import { describe, it, expect } from 'vitest';
import { resetPushWatermarkForMigrated } from '../migrated-upload.js';

/**
 * Tiny in-memory DB fake shaped like the worker's executor: it answers the
 * SELECT with `sync_linked_* = '1'` rows and applies DELETEs to its store.
 * Captures every call so tests can assert exactly which keys were touched.
 */
function makeExecutor(initial: Record<string, string>) {
  const state = new Map(Object.entries(initial));
  const calls: { sql: string; bind?: unknown[] }[] = [];

  const exec: (sql: string, bind?: unknown[]) => Promise<Record<string, unknown>[]> = async (
    sql,
    bind,
  ) => {
    calls.push({ sql, bind });
    if (sql.includes('FROM app_meta WHERE key LIKE')) {
      return [...state.entries()]
        .filter(([k, v]) => k.startsWith('sync_linked_') && v === '1')
        .map(([key]) => ({ key }));
    }
    if (sql.startsWith('DELETE')) {
      for (const key of bind ?? []) state.delete(String(key));
    }
    return [];
  };

  return { exec, state, calls };
}

describe('resetPushWatermarkForMigrated', () => {
  it('does nothing when no account is linked (returns false)', async () => {
    const { exec, calls } = makeExecutor({});
    const touched = await resetPushWatermarkForMigrated(exec);
    expect(touched).toBe(false);
    expect(calls.every((c) => !c.sql.startsWith('DELETE'))).toBe(true);
  });

  it('drops the solves+sessions push watermarks for one linked account', async () => {
    const { exec, state, calls } = makeExecutor({
      sync_linked_uid123: '1',
      sync_watermark_push_solves_uid123: '1700000000000',
      sync_watermark_push_sessions_uid123: '1699999999999',
      // Unrelated keys must NOT be touched.
      sync_watermark_push_profiles_uid123: '1700000000000',
      sync_watermark_pull_solves_uid123: '1700000000000',
      local_clock_solves: '1700000000001',
      // A previously-unlinked (0) account must not get its cursors reset.
      sync_linked_uid_never: '0',
    });

    const touched = await resetPushWatermarkForMigrated(exec);
    expect(touched).toBe(true);
    expect(state.has('sync_watermark_push_solves_uid123')).toBe(false);
    expect(state.has('sync_watermark_push_sessions_uid123')).toBe(false);
    // Only the two cursor keys (uid 'uid123') were deleted.
    const deletes = calls.filter((c) => c.sql.startsWith('DELETE'));
    expect(deletes).toHaveLength(1);
    expect(deletes[0]!.bind).toEqual([
      'sync_watermark_push_solves_uid123',
      'sync_watermark_push_sessions_uid123',
    ]);
    // Unrelated keys survived.
    expect(state.has('sync_watermark_push_profiles_uid123')).toBe(true);
    expect(state.has('sync_watermark_pull_solves_uid123')).toBe(true);
    expect(state.has('local_clock_solves')).toBe(true);
  });

  it('drops watermarks for every linked account at once', async () => {
    const { exec, state, calls } = makeExecutor({
      sync_linked_a: '1',
      sync_linked_b: '1',
      sync_watermark_push_solves_a: '1',
      sync_watermark_push_sessions_a: '1',
      sync_watermark_push_solves_b: '1',
      sync_watermark_push_sessions_b: '1',
    });

    await resetPushWatermarkForMigrated(exec);
    expect(state.size).toBe(2); // only the two sync_linked_* flags remain
    const deletes = calls.filter((c) => c.sql.startsWith('DELETE'));
    expect(deletes).toHaveLength(1);
    expect(deletes[0]!.bind).toEqual(
      expect.arrayContaining([
        'sync_watermark_push_solves_a',
        'sync_watermark_push_sessions_a',
        'sync_watermark_push_solves_b',
        'sync_watermark_push_sessions_b',
      ]),
    );
  });

  it('is best-effort: a failed SELECT does not throw', async () => {
    const exec = async () => {
      throw new Error('db closed');
    };
    await expect(resetPushWatermarkForMigrated(exec)).resolves.toBe(false);
  });
});