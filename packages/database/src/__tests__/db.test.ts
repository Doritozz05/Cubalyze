/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';

// We mock the worker and comlink because OPFS and Web Workers aren't available in standard Node.js
vi.mock('comlink', () => ({
  wrap: vi.fn(() => ({
    init: vi.fn().mockResolvedValue(true),
    execute: vi.fn().mockResolvedValue([{ key: 'theme', value: 'dark' }]),
    close: vi.fn().mockResolvedValue(undefined),
    [Symbol.for('comlink.releaseProxy')]: vi.fn(),
  })),
  releaseProxy: Symbol.for('comlink.releaseProxy'),
}));

vi.mock('../worker.js', () => ({
  DBWorker: {},
}));

describe('Database Client', () => {
  it('initializes db correctly', async () => {
    // In a real environment, initDB creates the worker
    // Here we just verify the structure is exportable and mockable
    const { initDB, getDB, closeDB } = await import('../client.js');
    
    // Polyfill window for the test to pass the environment check
    global.window = {} as any;
    global.Worker = vi.fn(() => ({
      terminate: vi.fn(),
    })) as any;
    
    const db = await initDB();
    expect(db).toBeDefined();
    expect(getDB()).toBe(db);
    
    const results = await db.execute('SELECT * FROM kv_store;');
    expect(results).toEqual([{ key: 'theme', value: 'dark' }]);
    
    await closeDB();
  });
});
