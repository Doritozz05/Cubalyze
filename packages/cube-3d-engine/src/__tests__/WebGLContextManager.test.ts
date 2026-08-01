import { describe, it, expect, vi } from 'vitest';
import type { WebGLRenderer } from 'three';
import { webglContextManager } from '../core/WebGLContextManager';

// ────────────────────────────────────────────────────────────────────────
//  WebGLContextManager — global LRU context budget
//
//  Guards against iOS Safari's low live-WebGL-context limit: when a new
//  renderer registers and the budget is full, the least-recently-used
//  (evictable-first) context is force-destroyed (dispose + forceContextLoss)
//  so the browser releases the slot instead of returning null for
//  getContext() on every subsequent 3D view.
// ────────────────────────────────────────────────────────────────────────

function makeRenderer(): WebGLRenderer {
  return {
    dispose: vi.fn(),
    forceContextLoss: vi.fn(),
    domElement: {},
  } as unknown as WebGLRenderer;
}

describe('WebGLContextManager', () => {
  it('registers a renderer and reports it as live', () => {
    const r = makeRenderer();
    expect(webglContextManager.isEvicted(r)).toBe(true); // not registered yet
    const kept = webglContextManager.register(r);
    expect(kept).toBe(true);
    expect(webglContextManager.isEvicted(r)).toBe(false);
    webglContextManager.unregister(r);
  });

  it('unregister marks the renderer as no longer live', () => {
    const r = makeRenderer();
    webglContextManager.register(r);
    webglContextManager.unregister(r);
    expect(webglContextManager.isEvicted(r)).toBe(true);
  });

  it('evicts the least-recently-used context when the budget is exceeded', () => {
    webglContextManager.setMaxContexts(2);

    const oldest = makeRenderer();
    const middle = makeRenderer();
    const newest = makeRenderer();

    webglContextManager.register(oldest);
    webglContextManager.register(middle);

    // Simulate usage ordering: touch middle, so oldest is LRU.
    webglContextManager.touch(middle);

    const kept = webglContextManager.register(newest);
    expect(kept).toBe(true);

    // Budget is 2; registering the 3rd evicts the LRU (oldest).
    expect(webglContextManager.isEvicted(oldest)).toBe(true);
    expect(webglContextManager.isEvicted(middle)).toBe(false);
    expect(webglContextManager.isEvicted(newest)).toBe(false);
    expect(oldest.dispose).toHaveBeenCalled();
    // Non-evictable (React-managed) contexts are disposed only — the slot is
    // released by the browser on GC. forceContextLoss would permanently kill
    // the reused <canvas> node, so it is reserved for evictable engines.
    expect(oldest.forceContextLoss).not.toHaveBeenCalled();

    webglContextManager.unregister(middle);
    webglContextManager.unregister(newest);
    webglContextManager.setMaxContexts(6);
  });

  it('prefers evictable (disposable) contexts over user-visible ones', () => {
    webglContextManager.setMaxContexts(2);

    const visible = makeRenderer();   // React-managed canvas — last resort
    const snapshot = makeRenderer();  // offscreen engine — first victim

    webglContextManager.register(visible);
    webglContextManager.register(snapshot, { evictable: true });

    const third = makeRenderer();
    webglContextManager.register(third);

    // Even though `visible` is older, the manager evicts the evictable
    // snapshot first to protect the user-visible panel. Evictable contexts
    // ARE force-lost so the browser deterministically releases the slot.
    expect(webglContextManager.isEvicted(snapshot)).toBe(true);
    expect(webglContextManager.isEvicted(visible)).toBe(false);
    expect(webglContextManager.isEvicted(third)).toBe(false);
    expect(snapshot.forceContextLoss).toHaveBeenCalled();
    expect(visible.forceContextLoss).not.toHaveBeenCalled();

    webglContextManager.unregister(visible);
    webglContextManager.unregister(third);
    webglContextManager.setMaxContexts(6);
  });

  it('calls onEvicted when a context is force-evicted', () => {
    webglContextManager.setMaxContexts(1);

    const first = makeRenderer();
    const onEvictedFirst = vi.fn();
    webglContextManager.register(first, { onEvicted: onEvictedFirst });

    const second = makeRenderer();
    const onEvictedSecond = vi.fn();
    webglContextManager.register(second, { onEvicted: onEvictedSecond });

    // Registering the 2nd evicts the 1st (only context over budget).
    expect(onEvictedFirst).toHaveBeenCalledTimes(1);
    expect(onEvictedSecond).not.toHaveBeenCalled();

    webglContextManager.unregister(second);
    webglContextManager.setMaxContexts(6);
  });

  it('touch updates recency so the touched context is not evicted first', () => {
    webglContextManager.setMaxContexts(2);

    const a = makeRenderer();
    const b = makeRenderer();
    webglContextManager.register(a);
    webglContextManager.register(b);
    // Touch a → b becomes LRU.
    webglContextManager.touch(a);

    const c = makeRenderer();
    webglContextManager.register(c);

    expect(webglContextManager.isEvicted(b)).toBe(true);
    expect(webglContextManager.isEvicted(a)).toBe(false);

    webglContextManager.unregister(a);
    webglContextManager.unregister(c);
    webglContextManager.setMaxContexts(6);
  });

  it('force-loses ONLY evictable contexts; non-evictable eviction failures are tolerated', () => {
    webglContextManager.setMaxContexts(1);

    // Non-evictable (React-managed) broken renderer — dispose throws.
    const broken = {
      dispose: vi.fn(() => {
        throw new Error('context already gone');
      }),
      forceContextLoss: vi.fn(() => {
        throw new Error('lost');
      }),
      domElement: {},
    } as unknown as WebGLRenderer;

    const next = makeRenderer();
    webglContextManager.register(broken);
    expect(() => webglContextManager.register(next)).not.toThrow();

    expect(webglContextManager.isEvicted(broken)).toBe(true);
    expect(webglContextManager.isEvicted(next)).toBe(false);
    expect(broken.forceContextLoss).not.toHaveBeenCalled();

    webglContextManager.unregister(next);
    webglContextManager.setMaxContexts(6);
  });

  it('tolerates forceContextLoss failures on evictable contexts', () => {
    webglContextManager.setMaxContexts(1);

    const brokenEvictable = {
      dispose: vi.fn(),
      forceContextLoss: vi.fn(() => {
        throw new Error('lost');
      }),
      domElement: {},
    } as unknown as WebGLRenderer;

    const next = makeRenderer();
    webglContextManager.register(brokenEvictable, { evictable: true });
    expect(() => webglContextManager.register(next)).not.toThrow();

    expect(webglContextManager.isEvicted(brokenEvictable)).toBe(true);
    expect(brokenEvictable.forceContextLoss).toHaveBeenCalled();
    expect(webglContextManager.isEvicted(next)).toBe(false);

    webglContextManager.unregister(next);
    webglContextManager.setMaxContexts(6);
  });
});
