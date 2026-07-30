import { Cube3DEngine, getSkinStyle } from "@cubeforge/cube-3d-engine";
import { CaseStateGenerator } from "@cubeforge/algorithm-db";
import { Cube2x2State, Cube2x2FaceletConverter } from "@cubeforge/math-core";
import type { AlgorithmCase } from "@cubeforge/algorithm-db";

const F2L_ADVANCED_SUBSET_ID = "00000000-0000-4000-9000-000000000004";
const F2L_SUBSET_IDS = new Set([
  "00000000-0000-4000-9000-000000000003", // Basic F2L
  F2L_ADVANCED_SUBSET_ID, // Advanced F2L
]);

const SLOT_LABELS = [
  { id: 0, key: "FR", name: "Front Right", modelYRot: 0 },
  { id: 1, key: "FL", name: "Front Left", modelYRot: Math.PI / 2 },
  { id: 2, key: "BL", name: "Back Left", modelYRot: Math.PI },
  { id: 3, key: "BR", name: "Back Right", modelYRot: -Math.PI / 2 },
];

const F2L_GRAY = "#808080";
const STORAGE_PREFIX = "cubeforge_snap_3d_v7_";
const CANV_SIZE = 256;

function buildF2LSkinStyle() {
  const base = getSkinStyle("default");
  return {
    ...base,
    stickerColors: {
      ...base.stickerColors,
      U: base.stickerColors.D, // yellow on top
      D: base.stickerColors.U, // white on bottom
      R: base.stickerColors.L, // orange on right (FR slot: Green/Orange)
      L: base.stickerColors.R, // red on left
    },
  };
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
    const existing = is2x2 ? this.engine2x2 : this.engine;

    if (existing) return existing;
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
      });

      engine.sceneManager.setOrbitAngles(Math.PI / 4, Math.PI / 6);

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

        const isF2L = !is2x2 && F2L_SUBSET_IDS.has(caseData.subsetId);
        const modelYRot = SLOT_LABELS[selectedSlot]?.modelYRot ?? 0;

        if (isF2L) {
          engine.updateStyle(buildF2LSkinStyle());
        } else {
          engine.updateStyle(getSkinStyle("default"));
        }

        engine.clearLayerGray();

        if (caseData.setupScramble) {
          if (is2x2) {
            const state = new Cube2x2State();
            state.applySequence(caseData.setupScramble);
            const facelets = Cube2x2FaceletConverter.toFaceletString(state);
            engine.syncFacelets(facelets);
          } else {
            const rawState = CaseStateGenerator.generateFromScramble(
              caseData.setupScramble,
            );
            const faceletString = CaseStateGenerator.toFaceletString(rawState);
            engine.syncFacelets(faceletString);
          }
        } else {
          engine.resetCube();
        }

        if (!is2x2) {
          engine.rotateModelY(modelYRot);
        }

        // Rotate 2×2 view by 45° around Y for a nicer 3/4 angle
        if (is2x2) {
          engine.rotateModelY(Math.PI / 4);
        }

        const isAdvancedF2L =
          caseData.subsetId === F2L_ADVANCED_SUBSET_ID ||
          Boolean(caseData.tags?.includes("af2l"));

        if (isF2L) {
          engine.setF2LMaskGray(F2L_GRAY, isAdvancedF2L);
        }

        // Synchronous single-frame render
        engine.sceneManager.render();

        const dataUrl = canvas.toDataURL("image/png");
        if (dataUrl && dataUrl.length > 100) {
          this.memoryCache.set(key, dataUrl);
          try {
            sessionStorage.setItem(STORAGE_PREFIX + key, dataUrl);
          } catch {
            // Storage full or unavailable
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
