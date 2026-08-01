import type { WebGLRenderer } from 'three';

/**
 * Global LRU registry of live WebGL contexts.
 *
 * Browsers (notably iOS Safari) allow only a small number of live WebGL
 * contexts. When the limit is hit, `canvas.getContext()` returns `null` and
 * every subsequent 3D view fails to initialize. `renderer.dispose()` frees
 * GPU resources but does NOT release the browser context slot until the
 * canvas is garbage-collected — so an app that mounts/unmounts many 3D
 * panels can silently exhaust the limit.
 *
 * This manager enforces a conservative global budget and, when a new context
 * is needed but the budget is full, actively destroys the least-recently-used
 * context (preferring disposable ones like offscreen snapshot engines).
 *
 * Eviction policy:
 *  - Evictable contexts (offscreen snapshot engines) are fully destroyed via
 *    `dispose()` + `forceContextLoss()` — the only deterministic way to
 *    release a browser context slot — and are recreated lazily on demand.
 *  - Non-evictable contexts (React-managed canvases) are disposed only.
 *    `forceContextLoss()` permanently kills a canvas node's context, and React
 *    reuses the same <canvas> element across mount cycles, so those contexts
 *    are never force-lost; their slot is reclaimed by the browser on GC.
 *
 * Engine integration:
 *  - `SceneManager` registers on construction, touches on every render, and
 *    unregisters on dispose.
 *  - When a context is evicted, its `onEvicted` callback fires so the owning
 *    engine can stop its render loop and surface a graceful fallback in the UI
 *    (instead of a frozen canvas or an infinite "Initializing 3D Cube...").
 */
export interface WebGLContextRegistrationOptions {
  /**
   * Mark this context as disposable. Eviction prefers evictable contexts
   * over user-visible ones, so offscreen/snapshot engines are sacrificed
   * first (they are recreated lazily on demand).
   */
  evictable?: boolean;
  /** Called when the manager force-evicts this context. */
  onEvicted?: () => void;
}

interface RegisteredContext {
  renderer: WebGLRenderer;
  evictable: boolean;
  lastTouchedAt: number;
  onEvicted?: () => void;
}

/**
 * Default global budget. Kept well below iOS Safari's limit (~16 contexts,
 * lower on older devices) while allowing every normal combination of panels:
 * main cube + mini cube + interactive case + replay worker + 2 snapshot
 * engines fits comfortably.
 */
const DEFAULT_MAX_CONTEXTS = 6;

class WebGLContextManagerImpl {
  private contexts = new Map<WebGLRenderer, RegisteredContext>();
  private maxContextsLimit = DEFAULT_MAX_CONTEXTS;

  /** Number of currently registered (live) contexts. */
  get size(): number {
    return this.contexts.size;
  }

  get maxContexts(): number {
    return this.maxContextsLimit;
  }

  /** Override the global budget (used by tests and future tuning). */
  setMaxContexts(n: number): void {
    this.maxContextsLimit = Math.max(1, n);
    this.enforceBudget();
  }

  /**
   * Register a newly created renderer. If the budget is already full, the
   * least-recently-used context is evicted to make room.
   *
   * @returns `false` when THIS renderer was evicted immediately (only
   *   possible when the budget is exhausted with no evictable victims and
   *   every other context is more recently used — treat as failed init).
   */
  register(
    renderer: WebGLRenderer,
    options: WebGLContextRegistrationOptions = {},
  ): boolean {
    this.contexts.set(renderer, {
      renderer,
      evictable: options.evictable ?? false,
      lastTouchedAt: performance.now(),
      onEvicted: options.onEvicted,
    });
    this.enforceBudget();
    return this.contexts.has(renderer);
  }

  /** Remove a renderer from the registry (called on dispose). */
  unregister(renderer: WebGLRenderer): void {
    this.contexts.delete(renderer);
  }

  /** Mark a renderer as recently used (called on every render). */
  touch(renderer: WebGLRenderer): void {
    const entry = this.contexts.get(renderer);
    if (entry) entry.lastTouchedAt = performance.now();
  }

  /** True when this renderer is no longer registered (evicted or disposed). */
  isEvicted(renderer: WebGLRenderer): boolean {
    return !this.contexts.has(renderer);
  }

  private enforceBudget(): void {
    while (this.contexts.size > this.maxContexts) {
      const victim = this.pickVictim();
      if (!victim) break;
      this.evict(victim);
    }
  }

  /**
   * Choose the least-recently-used context, preferring evictable
   * (disposable) contexts over user-visible ones.
   */
  private pickVictim(): RegisteredContext | null {
    let oldest: RegisteredContext | null = null;
    let oldestEvictable: RegisteredContext | null = null;
    for (const entry of this.contexts.values()) {
      if (!oldest || entry.lastTouchedAt < oldest.lastTouchedAt) {
        oldest = entry;
      }
      if (
        entry.evictable &&
        (!oldestEvictable || entry.lastTouchedAt < oldestEvictable.lastTouchedAt)
      ) {
        oldestEvictable = entry;
      }
    }
    return oldestEvictable ?? oldest;
  }

  /**
   * Actively destroy a context: notify the owner, dispose GPU resources and
   * force context loss so the browser deterministically releases the slot.
   */
  private evict(entry: RegisteredContext): void {
    this.contexts.delete(entry.renderer);
    try {
      entry.onEvicted?.();
    } catch {
      // eviction must never be blocked by a listener error
    }
    try {
      entry.renderer.dispose();
    } catch {
      // context may already be gone
    }
    // forceContextLoss() deterministically releases the browser slot, but it
    // PERMANENTLY kills that canvas DOM node's context. That is acceptable for
    // evictable (offscreen) engines — they are recreated with a fresh canvas —
    // but would permanently brick a React-managed canvas (React reuses the same
    // <canvas> node on remount). Non-evictable contexts are only disposed; their
    // slot is reclaimed by the browser when the canvas is garbage-collected,
    // which is fine for this rare last-resort path.
    if (entry.evictable) {
      try {
        entry.renderer.forceContextLoss();
      } catch {
        // some renderers / test mocks don't implement forceContextLoss
      }
    }
  }
}

/** App-wide singleton. */
export const webglContextManager = new WebGLContextManagerImpl();
