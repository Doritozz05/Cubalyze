"use client";

/**
 * cubeSnapshotService.ts — one shared, offscreen 3D renderer for Locker cubes.
 *
 * The Locker shows a real 3D cube per item, using the **same** engine, skins
 * and canonical isometric camera the rest of the app already renders cubes with
 * (`Cube3DPanel`, the algorithm case diagrams, the replay views). The only
 * difference is where the pixels come from: instead of one live canvas per
 * card, a single offscreen engine renders each distinct cube once and hands
 * back a PNG data URL.
 *
 * That trade is deliberate. A shipping grid can hold dozens of cubes, and a
 * WebGL context per card would blow the browser's context budget (the very
 * reason `WebGLContextManager` exists). One evictable offscreen engine per
 * order — recreated lazily if the manager reclaims it — keeps the wall cheap.
 *
 * Renders are **serialised**: a burst of mounts queues up and each request is
 * drawn on its own animation frame, so a fifty-cube wall fades in instead of
 * freezing the main thread for a few hundred milliseconds. Cards show their
 * skeleton until their turn comes.
 *
 * The rendered cube is the item's own colour scheme: the sticker palette is
 * data the model already carries, so the picture is *this* cube, in *its*
 * colours, seen from the standard 3/4 isometric angle.
 */

import { Cube3DEngine, getSkinStyle } from "@cubalyze/cube-3d-engine";
import { preferencesStore } from "@cubalyze/state";
import { PALETTE_FACES, type GearPalette } from "./collectionModel";

/** Square render size; the cards scale it down, the editor shows it larger. */
const SIZE = 320;

/**
 * Canonical 3/4 isometric view — the same angles the algorithm case diagrams
 * use (`DEFAULT_CASE_CAMERA`), pulled in slightly so the cube fills the frame.
 */
export const LOCKER_CUBE_CAMERA = {
  theta: Math.PI / 6,
  phi: Math.PI / 6,
  radius: 6.4,
} as const;

/** LRU cap for rendered cubes; a 320² PNG is a few KB, so this stays small. */
const MAX_CACHE_ENTRIES = 160;

export interface LockerCubeRequest {
  /** 2×2 renders 2×2×2; anything else falls back to the standard 3×3×3. */
  order?: number;
  /** Sticker colours in U D F B R L order; extras are ignored by the render. */
  palette: GearPalette;
}

interface EngineSlot {
  canvas: HTMLCanvasElement;
  engine: Cube3DEngine;
}

interface RenderTask {
  key: string;
  request: LockerCubeRequest;
  resolve: (url: string) => void;
}

/** Insert into a Map, evicting the oldest entry past the cap. */
function boundedSet(map: Map<string, string>, key: string, value: string): void {
  map.set(key, value);
  if (map.size > MAX_CACHE_ENTRIES) {
    const oldest = map.keys().next();
    if (!oldest.done) map.delete(oldest.value);
  }
}

/** The app's active 3D skin, with the item's palette laid over its stickers. */
function styleFor(palette: GearPalette) {
  const style = getSkinStyle(preferencesStore.getState().appearance3d);
  const stickerColors = { ...style.stickerColors };
  PALETTE_FACES.forEach((face, index) => {
    const colour = palette[index];
    if (colour) stickerColors[face] = colour;
  });
  return { ...style, stickerColors };
}

function normalizeOrder(order: number | undefined): number {
  return order === 2 ? 2 : 3;
}

function cacheKey(request: LockerCubeRequest): string {
  const colours = PALETTE_FACES.map((_, index) => request.palette[index] ?? "").join(",");
  return `${normalizeOrder(request.order)}|${colours}`;
}

class LockerCubeSnapshotService {
  private cache = new Map<string, string>();
  private pending = new Map<string, Promise<string>>();
  private slots = new Map<number, EngineSlot>();
  private queue: RenderTask[] = [];
  private draining = false;

  /** A previously rendered cube, if this exact colour scheme was drawn. */
  peek(request: LockerCubeRequest): string | null {
    return this.cache.get(cacheKey(request)) ?? null;
  }

  /** Render (or reuse) the cube. Never rejects — resolves "" when WebGL is out. */
  request(request: LockerCubeRequest): Promise<string> {
    const key = cacheKey(request);
    const cached = this.cache.get(key);
    if (cached) return Promise.resolve(cached);

    const inFlight = this.pending.get(key);
    if (inFlight) return inFlight;

    const task = new Promise<string>((resolve) => {
      this.queue.push({ key, request, resolve });
      this.drain();
    });
    this.pending.set(key, task);
    task.then(() => this.pending.delete(key));
    return task;
  }

  /** Drop every cached render (the user changed the 3D skin, or reset). */
  clear(): void {
    this.cache.clear();
  }

  /** Release the offscreen engines — used when nothing is on screen any more. */
  dispose(): void {
    for (const slot of this.slots.values()) {
      try {
        slot.engine.dispose();
      } catch {
        // A context that is already gone needs no cleanup.
      }
    }
    this.slots.clear();
    this.cache.clear();
    this.pending.clear();
    this.queue = [];
  }

  /** One task per animation frame: a burst of mounts degrades into a fade-in. */
  private drain(): void {
    if (this.draining) return;
    const schedule =
      typeof requestAnimationFrame === "function"
        ? requestAnimationFrame
        : (callback: () => void) => setTimeout(callback, 0);

    const step = () => {
      const task = this.queue.shift();
      if (!task) {
        this.draining = false;
        return;
      }
      task.resolve(this.renderOnce(task));
      schedule(step);
    };

    this.draining = true;
    schedule(step);
  }

  private renderOnce(task: RenderTask): string {
    const cacheKeyValue = task.key;
    const slot = this.getOrCreateSlot(normalizeOrder(task.request.order));
    if (!slot) return "";

    try {
      slot.engine.updateStyle(styleFor(task.request.palette));
      slot.engine.resetCube();
      slot.engine.sceneManager.setOrbitAngles(
        LOCKER_CUBE_CAMERA.theta,
        LOCKER_CUBE_CAMERA.phi,
        LOCKER_CUBE_CAMERA.radius,
      );
      slot.engine.sceneManager.render();

      const dataUrl = slot.canvas.toDataURL("image/png");
      if (!dataUrl || dataUrl.length < 128) return "";
      boundedSet(this.cache, cacheKeyValue, dataUrl);
      return dataUrl;
    } catch {
      // WebGL unavailable / context lost: the caller shows its skeleton.
      return "";
    }
  }

  /**
   * One offscreen engine per order, created on demand. The engines are marked
   * evictable, so the global context manager reclaims them before any visible
   * canvas when the browser runs out of contexts — the next request simply
   * builds a new one.
   */
  private getOrCreateSlot(order: number): EngineSlot | null {
    if (typeof document === "undefined") return null;

    const existing = this.slots.get(order);
    if (existing) {
      try {
        if (!existing.engine.sceneManager.renderer.getContext()?.isContextLost()) {
          return existing;
        }
      } catch {
        // Fall through and rebuild.
      }
      try {
        existing.engine.dispose();
      } catch {
        // Already disposed.
      }
      this.slots.delete(order);
    }

    try {
      const canvas = document.createElement("canvas");
      canvas.width = SIZE;
      canvas.height = SIZE;
      const engine = new Cube3DEngine({
        canvas,
        width: SIZE,
        height: SIZE,
        pixelRatio: 1,
        order,
        contextEvictable: true,
      });
      const slot: EngineSlot = { canvas, engine };
      this.slots.set(order, slot);
      return slot;
    } catch {
      return null;
    }
  }
}

export const lockerCubeSnapshotService = new LockerCubeSnapshotService();
