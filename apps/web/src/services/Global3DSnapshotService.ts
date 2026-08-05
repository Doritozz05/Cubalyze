import { Cube3DEngine } from "@cubeforge/cube-3d-engine";
import {
  buildCaseRenderPlan,
  type AlgorithmCase,
  type F2LSlotId,
} from "@cubeforge/algorithm-db";
import { applyCaseRenderPlan } from "@/services/Case3DRenderAdapter";
const STORAGE_PREFIX = "cubeforge_snap_3d_v8_";
const CANV_SIZE = 256;

/**
 * Bounded-cache guards: a 256×256 PNG data URL is ~5–20KB, so a large
 * algorithm library could otherwise exhaust the ~5MB sessionStorage quota
 * (snapshots then silently fail) or balloon the in-memory Map. These caps
 * keep the cache healthy: LRU eviction for memory, quota-safe batch eviction
 * for storage.
 */
const MAX_MEMORY_CACHE_ENTRIES = 200;
const MAX_STORAGE_CACHE_ENTRIES = 150;

/** Insert into a Map, evicting the oldest (insertion-order) entry past the cap. */
function boundedSet(map: Map<string, string>, key: string, value: string, max: number): void {
  map.set(key, value);
  if (map.size > max) {
    const oldest = map.keys().next();
    if (!oldest.done) map.delete(oldest.value);
  }
}


type RenderTask = {
  key: string;
  caseData: AlgorithmCase;
  selectedSlot: number;
  resolve: (url: string) => void;
  reject: (err: Error) => void;
};

export class Global3DSnapshotService {
  private static instance: Global3DSnapshotService | null = null;

  private memoryCache = new Map<string, string>();
  private pendingRequests = new Map<string, Array<(url: string) => void>>();
  private queue: RenderTask[] = [];
  private isProcessing = false;

  private canvas: HTMLCanvasElement | null = null;
  private engine: Cube3DEngine | null = null;
  private constructor() {
    this.initStorage();
  }

  public static getInstance(): Global3DSnapshotService {
    if (!Global3DSnapshotService.instance) {
      Global3DSnapshotService.instance = new Global3DSnapshotService();
    }
    return Global3DSnapshotService.instance;
  }

  private initStorage() {
    if (typeof window === "undefined") return;
    try {
      for (let i = 0; i < sessionStorage.length; i++) {
        if (this.memoryCache.size >= MAX_MEMORY_CACHE_ENTRIES) break;
        const key = sessionStorage.key(i);
        if (key && key.startsWith(STORAGE_PREFIX)) {
          const val = sessionStorage.getItem(key);
          if (val) {
            const rawKey = key.replace(STORAGE_PREFIX, "");
            this.memoryCache.set(rawKey, val);
          }
        }
      }
    } catch {
      // Storage unavailable or restricted
    }
  }

  /** Separate engine for 2×2 snapshots (order=2). */
  private engine2x2: Cube3DEngine | null = null;
  private canvas2x2: HTMLCanvasElement | null = null;

  private getOrCreateEngine(order: number): Cube3DEngine | null {
    const is2x2 = order === 2;
    let existing = is2x2 ? this.engine2x2 : this.engine;

    if (existing) {
      try {
        if (existing.sceneManager?.renderer?.getContext()?.isContextLost()) {
          existing.dispose();
          existing = null;
          if (is2x2) {
            this.engine2x2 = null;
            this.canvas2x2 = null;
          } else {
            this.engine = null;
            this.canvas = null;
          }
        } else {
          return existing;
        }
      } catch {
        existing = null;
      }
    }

    if (typeof window === "undefined" || typeof document === "undefined") return null;

    try {
      const canvas = document.createElement("canvas");
      canvas.width = CANV_SIZE;
      canvas.height = CANV_SIZE;

      const engine = new Cube3DEngine({
        canvas,
        width: CANV_SIZE,
        height: CANV_SIZE,
        pixelRatio: 1,
        order,
        // These engines are offscreen, lazily recreated and fully cached —
        // they are the FIRST victims when the global WebGL context budget
        // is exceeded (iOS Safari). The manager force-evicts them and the
        // existing isContextLost() guard below recreates them on demand.
        contextEvictable: true,
      });

      // The plan supplies the camera for each render; this is only a safe
      // initialization before the first task is applied.
      engine.sceneManager.setOrbitAngles(Math.PI / 4, Math.PI / 6, 7);

      if (is2x2) {
        this.canvas2x2 = canvas;
        this.engine2x2 = engine;
      } else {
        this.canvas = canvas;
        this.engine = engine;
      }

      return engine;
    } catch (e) {
      console.error(`[Global3DSnapshotService] Failed to initialize WebGL engine (order=${order}):`, e);
      return null;
    }
  }

  public getCachedSnapshot(cacheKey: string): string | null {
    return this.memoryCache.get(cacheKey) ?? null;
  }

  public requestSnapshot(
    caseData: AlgorithmCase,
    selectedSlot = 0,
  ): Promise<string> {
    const cacheKey = `${caseData.id}_${caseData.setupScramble}_${selectedSlot}`;
    const cached = this.getCachedSnapshot(cacheKey);
    if (cached) return Promise.resolve(cached);

    if (this.pendingRequests.has(cacheKey)) {
      return new Promise<string>((resolve) => {
        this.pendingRequests.get(cacheKey)!.push(resolve);
      });
    }

    this.pendingRequests.set(cacheKey, []);

    return new Promise<string>((resolve, reject) => {
      this.queue.push({
        key: cacheKey,
        caseData,
        selectedSlot,
        resolve: (url) => {
          const pendings = this.pendingRequests.get(cacheKey) || [];
          this.pendingRequests.delete(cacheKey);
          resolve(url);
          pendings.forEach((fn) => fn(url));
        },
        reject: (err) => {
          this.pendingRequests.delete(cacheKey);
          reject(err);
        },
      });

      this.processNext();
    });
  }

  /**
   * Free space in sessionStorage: remove entries down to the cap (or at least
   * one entry when the quota is hit for another reason) so a single retry can
   * succeed. sessionStorage exposes no reliable insertion order, so which
   * entries are dropped is best-effort — the memory cache keeps serving the
   * most recently rendered snapshots regardless.
   */
  private evictOldestStoredSnapshots(): void {
    try {
      const keys: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith(STORAGE_PREFIX)) keys.push(k);
      }
      // Remove the excess above the cap; when already under the cap (storage
      // full for another reason) still free at least one entry.
      const toRemove = Math.max(keys.length - MAX_STORAGE_CACHE_ENTRIES, 1);
      for (const k of keys.slice(0, toRemove)) {
        sessionStorage.removeItem(k);
      }
    } catch {
      // Storage unavailable — nothing to evict
    }
  }

  private processNext() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;

    // Use requestAnimationFrame / setTimeout to keep main thread responsive
    requestAnimationFrame(() => {
      const task = this.queue.shift();
      if (!task) {
        this.isProcessing = false;
        return;
      }

      try {
        const { key, caseData, selectedSlot } = task;
        const is2x2 = caseData.puzzleType === '2x2x2';
        const order = is2x2 ? 2 : 3;
        const engine = this.getOrCreateEngine(order);
        const canvas = is2x2 ? this.canvas2x2 : this.canvas;

        if (!engine || !canvas) {
          task.reject(new Error("WebGL engine not available"));
          this.isProcessing = false;
          return;
        }

        const plan = buildCaseRenderPlan(caseData, {
          selectedF2LSlot: selectedSlot as F2LSlotId,
        });

        // Snapshot and interactive canvas now execute the same render plan.
        applyCaseRenderPlan(engine, plan);

        const dataUrl = canvas.toDataURL("image/png");
        if (dataUrl && dataUrl.length > 100) {
          boundedSet(this.memoryCache, key, dataUrl, MAX_MEMORY_CACHE_ENTRIES);
          try {
            sessionStorage.setItem(STORAGE_PREFIX + key, dataUrl);
          } catch {
            // Quota exceeded or storage unavailable: drop the oldest stored
            // snapshots (oldest first) and retry once, so a large library
            // degrades gracefully instead of silently losing the new snapshot.
            this.evictOldestStoredSnapshots();
            try {
              sessionStorage.setItem(STORAGE_PREFIX + key, dataUrl);
            } catch {
              // Still failing — keep the in-memory copy and move on.
            }
          }
          task.resolve(dataUrl);
        } else {
          task.reject(new Error("Failed to capture snapshot data URL"));
        }
      } catch (e) {
        task.reject(e instanceof Error ? e : new Error(String(e)));
      } finally {
        this.isProcessing = false;
        if (this.queue.length > 0) {
          this.processNext();
        }
      }
    });
  }
}
