import { Quaternion, Mesh, MeshBasicMaterial, Material, Vector3, Group } from 'three';
import { SceneManager } from './SceneManager';
import { CubeMeshFactory, type CubeStyleOptions } from './CubeMeshFactory';
import { CubeModel } from './CubeModel';
import { RotationEngine, type RotationAxis } from '../animation/RotationEngine';
import { GyroFusion } from '../hardware/GyroFusion';
import { OrientationTracker } from '../hardware/OrientationTracker';
import { OrientationTable, type PhaseMask } from '@cubeforge/math-core';
import type { CubeOrientation, RotationEvent, CubeFace } from '@cubeforge/types';
import type { Subscription } from 'rxjs';

export interface Cube3DEngineOptions {
  canvas: HTMLCanvasElement | OffscreenCanvas;
  width: number;
  height: number;
  pixelRatio?: number;
  gyroSupported?: boolean;
  /** Cube order: 2 (2×2×2) or 3 (3×3×3). Default 3. */
  order?: number;
}

export class Cube3DEngine {
  public sceneManager!: SceneManager;
  public factory!: CubeMeshFactory;
  public model!: CubeModel;
  public rotationEngine!: RotationEngine;
  public gyroFusion!: GyroFusion;
  public orientationTracker!: OrientationTracker;

  private onOrientationChangeCb?: (o: CubeOrientation) => void;
  private onRotationEventCb?: (e: RotationEvent) => void;
  private orientationSub?: Subscription;
  private rotationEventSub?: Subscription;

  private orientationAnim: {
    startQuat: Quaternion;
    targetQuat: Quaternion;
    startTime: number;
    durationMs: number;
  } | null = null;

  private lastTime: number = 0;
  private isRunning: boolean = false;
  private animFrameId: number | null = null;

  /**
   * Dirty-flag rendering: the rAF loop only runs while there is active
   * animation (layer rotation, gyro smoothing, orientation transition) OR a
   * pending explicit render request. When the scene is static, the loop
   * stops entirely, saving CPU/GPU/battery on an idle but mounted cube.
   */
  private needsRender = false;

  /** Track grayed-out sticker meshes so we can restore + dispose them. */
  private grayedStickers: { mesh: Mesh; originalMat: Material }[] = [];

  constructor(options: Cube3DEngineOptions) {
    const { canvas, width, height, pixelRatio = 1, gyroSupported = false, order = 3 } = options;
    this.init(canvas, width, height, pixelRatio, gyroSupported, order);
  }

  private init(
    canvas: HTMLCanvasElement | OffscreenCanvas,
    width: number,
    height: number,
    pixelRatio: number,
    gyroSupported: boolean,
    order: number,
  ) {
    this.sceneManager = new SceneManager(canvas, width, height, pixelRatio);

    this.factory = new CubeMeshFactory();
    this.model = new CubeModel(this.factory, order);
    this.sceneManager.scene.add(this.model.root);

    this.rotationEngine = new RotationEngine(this.model);
    this.gyroFusion = new GyroFusion(this.model.root);

    this.orientationTracker = new OrientationTracker({ gyroSupported });
    this.gyroFusion.onCalibrate = (q) => this.orientationTracker.setCalibration(q);

    this.orientationSub = this.orientationTracker.orientation$.subscribe((o) => {
      this.onOrientationChangeCb?.(o);
    });

    this.rotationEventSub = this.orientationTracker.rotationEvents$.subscribe((e) => {
      this.onRotationEventCb?.(e);
    });

    this.isRunning = true;
    // Render the first frame immediately, then let the dirty-flag loop
    // pause when the scene becomes static.
    this.lastTime = performance.now();
    this.needsRender = true;
    this.animFrameId = requestAnimationFrame(this.loop);
  }

  /**
   * Schedule a single render on the next animation frame.
   *
   * Called by every public method that mutates the scene (camera moves,
   * facelet syncs, style changes, sticker graying, rotations, …). If the
   * render loop is paused, this restarts it for one frame.
   */
  public requestRender(): void {
    if (!this.isRunning) return;
    this.needsRender = true;
    if (this.animFrameId === null) {
      this.lastTime = performance.now();
      this.animFrameId = requestAnimationFrame(this.loop);
    }
  }

  public resize(width: number, height: number): void {
    if (this.sceneManager && width > 0 && height > 0) {
      this.sceneManager.resize(width, height);
      this.requestRender();
    }
  }

  public async rotateLayers(
    axis: RotationAxis,
    layerValues: number[],
    angle: number,
    durationMs: number,
    elapsedMs?: number,
    easingStrategy?: string,
  ): Promise<void> {
    if (!this.rotationEngine) return;
    this.requestRender();
    await this.rotationEngine.rotateLayers(
      axis,
      layerValues,
      angle,
      durationMs,
      elapsedMs,
      easingStrategy as 'bounce' | 'smooth' | 'fast' | 'linear' | undefined,
    );
  }

  public resetCube(): void {
    if (this.model) {
      this.model.resetCube();
    }
    this.requestRender();
  }

  public syncFacelets(facelets: string): void {
    if (this.model) {
      this.model.applyFacelets(facelets);
    }
    this.requestRender();
  }

  public rotateCamera(dx: number, dy: number): void {
    if (this.sceneManager) {
      this.sceneManager.rotateCamera(dx, dy);
    }
    this.requestRender();
  }

  public updateGyro(x: number, y: number, z: number, w: number): void {
    if (!this.gyroFusion) return;
    this.gyroFusion.enable();
    this.gyroFusion.updateTargetQuaternion(x, y, z, w);

    if (!this.orientationTracker.capabilitiesInfo.gyroSupported) {
      this.orientationTracker.enableGyroSupport();
    }

    this.orientationTracker.update({ x, y: z, z: -y, w });
    this.requestRender();
  }

  public disableGyro(): void {
    if (!this.gyroFusion) return;
    this.gyroFusion.disable();
  }

  public calibrateGyro(): void {
    if (!this.gyroFusion) return;
    if (this.sceneManager) {
      this.sceneManager.resetCamera();
    }
    this.gyroFusion.calibrate();
    this.requestRender();
  }

  public setGyroSupported(supported: boolean): void {
    if (!this.orientationTracker) return;

    const currentlyEnabled = this.orientationTracker.capabilitiesInfo.gyroSupported;

    if (supported && !currentlyEnabled) {
      this.orientationTracker.enableGyroSupport();
      return;
    }

    if (!supported && currentlyEnabled) {
      this.orientationSub?.unsubscribe();
      this.rotationEventSub?.unsubscribe();
      this.orientationTracker.dispose();
      this.gyroFusion.resetCalibration();
      this.orientationTracker = new OrientationTracker({ gyroSupported: false });
      this.gyroFusion.onCalibrate = (q) => this.orientationTracker.setCalibration(q);
      this.orientationSub = this.orientationTracker.orientation$.subscribe((o) => {
        this.onOrientationChangeCb?.(o);
      });
      this.rotationEventSub = this.orientationTracker.rotationEvents$.subscribe((e) => {
        this.onRotationEventCb?.(e);
      });
      return;
    }
  }

  public onOrientationChange(cb: (o: CubeOrientation) => void): void {
    this.onOrientationChangeCb = cb;
  }

  public onRotationEvent(cb: (e: RotationEvent) => void): void {
    this.onRotationEventCb = cb;
  }

  public getOrientation(): CubeOrientation {
    if (!this.orientationTracker) {
      const id = OrientationTable.IDENTITY;
      return {
        quaternion: { x: 0, y: 0, z: 0, w: 1 },
        faceMap: id.faceMap,
        label: id.label,
      };
    }
    const c = this.orientationTracker.current;
    return {
      quaternion: { x: c.quaternion.x, y: c.quaternion.y, z: c.quaternion.z, w: c.quaternion.w },
      faceMap: c.faceMap,
      label: c.label,
    };
  }

  public resetGyroCalibration(): void {
    if (!this.gyroFusion) return;
    this.gyroFusion.resetCalibration();
  }

  public setIsometricView(): void {
    if (!this.sceneManager) return;
    this.sceneManager.setOrbitAngles(Math.PI / 4, Math.PI / 6);
    this.requestRender();
  }

  public setCubeOrientation(orientationIndex: number, animationDurationMs?: number): void {
    if (!this.model) return;
    const entry = OrientationTable.ENTRIES[orientationIndex];
    if (!entry) return;

    const duration = animationDurationMs ?? 0;

    if (duration <= 0) {
      this.orientationAnim = null;
      this.model.root.quaternion.copy(entry.quaternion);
      this.requestRender();
      return;
    }

    this.orientationAnim = {
      startQuat: this.model.root.quaternion.clone(),
      targetQuat: entry.quaternion.clone(),
      startTime: performance.now(),
      durationMs: duration,
    };
    // Kick off the render loop — the orientation animation keeps it alive.
    this.requestRender();
  }

  public setFaceColor(face: string, color: string): void {
    if (this.factory) {
      this.factory.setFaceColor(face as CubeFace | 'Inner', color);
    }
    this.requestRender();
  }

  public setFaceEmissive(face: string, emissiveColor: string, intensity: number): void {
    if (this.factory) {
      this.factory.setFaceEmissive(face as CubeFace | 'Inner', emissiveColor, intensity);
    }
    this.requestRender();
  }

  /**
   * Rotate the entire cube model around the Y axis (world-up).
   * Used to align different F2L slots to the front-right viewing position
   * without corrupting the facelet state.
   *
   * @param radians  Rotation angle in radians around world Y axis.
   */
  public rotateModelY(radians: number): void {
    if (!this.model) return;
    const q = new Quaternion().setFromAxisAngle(
      new Vector3(0, 1, 0),
      radians,
    );
    this.model.root.quaternion.copy(q);
    this.requestRender();
  }

  public updateStyle(newStyle: Partial<CubeStyleOptions>): void {
    if (this.factory) {
      this.factory.updateStyle(newStyle);
    }
    this.requestRender();
  }

  // ── Stickering system ──────────────────────────────────────────────────
  //
  // Unified, reusable visualization masking. Three public entry points share
  // ONE private helper (`grayCubieGroup`) and ONE restore path
  // (`clearLayerGray`), so there is a single source of truth for sticker
  // graying across OLL / PLL / F2L / Cross / XCross / EOCross visualizations:
  //
  //   setLayerStickerGray(axis, value)   — gray a whole face layer (U-layer)
  //   setF2LMaskGray(grayColor, adv)     — gray U-layer + AF2L slot pieces
  //   setPhaseStickering(mask)           — gray every non-target piece (generic)
  //
  // All three push into `grayedStickers` and are restored by `clearLayerGray`.

  /**
   * Restore all previously-grayed sticker materials to their original
   * colors and dispose the cloned gray materials.
   */
  public clearLayerGray(): void {
    for (const { mesh, originalMat } of this.grayedStickers) {
      const current = mesh.material;
      mesh.material = originalMat;
      // Dispose the cloned gray material to avoid GPU memory leak
      if (current !== originalMat && !Array.isArray(current)) {
        current.dispose();
      }
    }
    this.grayedStickers = [];
    this.requestRender();
  }

  /**
   * Gray out all sticker meshes of a single cubie Group.
   *
   * This is the shared primitive for the stickering system: it clones each
   * sticker material, sets it to `grayColor`, records the original for later
   * restoration via {@link clearLayerGray}, and skips non-sticker meshes
   * (cores use multi-material / non-MeshBasicMaterial). Kept private so the
   * three public entry points remain the single, documented API.
   */
  private grayCubieGroup(cubieGroup: Group, grayColor: string): void {
    cubieGroup.children.forEach((child) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      const mat = mesh.material;
      if (Array.isArray(mat)) return; // skip multi-material cores
      if (!(mat as MeshBasicMaterial).isMeshBasicMaterial) return; // only stickers
      this.grayedStickers.push({ mesh, originalMat: mat });
      mesh.material = (mat as MeshBasicMaterial).clone();
      (mesh.material as MeshBasicMaterial).color.set(grayColor);
    });
  }

  /**
   * Gray out all sticker meshes on cubies belonging to a specific
   * layer (face + value). Used for F2L visualization where the
   * U (yellow) layer should appear gray to focus on the first two layers.
   *
   * NOTE: Prior to the stickering-system unification, this method cloned the
   * sticker material but never applied `grayColor` (a no-op bug). It now grays
   * correctly via the shared {@link grayCubieGroup} helper. No callers relied
   * on the old no-op behavior.
   *
   * Call `clearLayerGray()` before re-syncing facelets to restore
   * original colors.
   *
   * @param axis  'x', 'y', or 'z'
   * @param layerValue  -1, 0, or 1
   * @param grayColor  CSS color string (default '#808080')
   */
  public setLayerStickerGray(
    axis: 'x' | 'y' | 'z',
    layerValue: number,
    grayColor: string = '#808080',
  ): void {
    if (!this.model || !this.factory) return;
    const cubies = this.model.getCubiesByFace(axis, layerValue);
    for (const cubieGroup of cubies) {
      this.grayCubieGroup(cubieGroup, grayColor);
    }
    this.requestRender();
  }

  /**
   * Applies F2L-specific masking to the 3D cube model.
   *
   * Grays out:
   * 1. All Last-Layer / OLL pieces containing Yellow (initialGridY === 1).
   * 2. In Advanced F2L (isAdvanced === true): White-Orange-Green corner & Orange-Green edge.
   *
   * Keeps colored:
   * 1. All F2L pair pieces (in Basic F2L) or active AF2L pieces.
   * 2. All solved cross and slot pieces.
   *
   * @param grayColor CSS color string (default '#808080')
   * @param isAdvanced If true (AF2L), also grays out White-Orange-Green corner & Orange-Green edge
   */
  public setF2LMaskGray(grayColor: string = '#808080', isAdvanced: boolean = false): void {
    if (!this.model || !this.factory) return;

    const cubies = this.model.getLogicalState();
    for (const cubie of cubies) {
      // In F2L, pieces with initialGridY === 1 belong to the U-layer (Yellow facelets / OLL pieces).
      const isYellowPiece = cubie.initialGridY === 1;

      // In Advanced F2L (AF2L), the White-Orange-Green corner (1, -1, 1) and
      // Orange-Green edge (1, 0, 1) should also be grayed out.
      const isAdvancedF2LSlotPiece =
        isAdvanced &&
        ((cubie.initialGridX === 1 && cubie.initialGridY === -1 && cubie.initialGridZ === 1) ||
         (cubie.initialGridX === 1 && cubie.initialGridY === 0 && cubie.initialGridZ === 1));

      if (isYellowPiece || isAdvancedF2LSlotPiece) {
        this.grayCubieGroup(cubie.mesh, grayColor);
      }
    }
    this.requestRender();
  }

  /**
   * Generic phase stickering — grays out every cubie that does NOT contain a
   * target piece listed in the {@link PhaseMask}. Reusable for cross, xcross,
   * xxcross, eocross, EOLine, and any other partial-goal visualization.
   *
   * The cubies that hold the mask's target edges/corners (identified by their
   * home grid position via {@link EDGE_HOME_POSITION} / {@link CORNER_HOME_POSITION})
   * keep their original colors; all other movable cubie stickers are grayed
   * out (centers + core stay visible as reference, matching the reference
   * web's stickering mask where centers stay "regular").
   * Call {@link clearLayerGray} before re-syncing facelets or changing the mask.
   *
   * @param mask      The PhaseMask whose target pieces should stay colored.
   * @param grayColor CSS color string (default '#808080').
   */
  public setPhaseStickering(mask: PhaseMask, grayColor: string = '#808080'): void {
    if (!this.model || !this.factory) return;

    // Collect the home grid positions of every target piece in the mask.
    // A cubie's initialGridX/Y/Z identifies which piece it permanently holds;
    // even after scrambling the cubie still carries that piece.
    const targetKeys = new Set<string>();
    if (mask.edges) {
      for (const rule of mask.edges) {
        const home = EDGE_HOME_POSITION[rule.id];
        if (home) targetKeys.add(`${home.x},${home.y},${home.z}`);
      }
    }
    if (mask.corners) {
      for (const rule of mask.corners) {
        const home = CORNER_HOME_POSITION[rule.id];
        if (home) targetKeys.add(`${home.x},${home.y},${home.z}`);
      }
    }

    // Gray out every movable piece (edge / corner) whose home position is
    // NOT in the target set. A piece is movable when at least 2 of its 3
    // home coordinates are non-zero (edges: 2, corners: 3; centers: 1, core: 0).
    const cubies = this.model.getLogicalState();
    for (const cubie of cubies) {
      const movable =
        Math.abs(cubie.initialGridX) +
        Math.abs(cubie.initialGridY) +
        Math.abs(cubie.initialGridZ) >= 2;
      if (!movable) continue; // keep centers + core visible
      const key = `${cubie.initialGridX},${cubie.initialGridY},${cubie.initialGridZ}`;
      if (targetKeys.has(key)) continue; // keep this cubie colored
      this.grayCubieGroup(cubie.mesh, grayColor);
    }
    this.requestRender();
  }

  /**
   * True when any animation system still has work to do on the next frame.
   * Used by {@link loop} to decide whether to keep the rAF cycle alive.
   */
  private hasActiveAnimation(): boolean {
    if (this.orientationAnim) return true;
    if (this.rotationEngine?.isAnimating()) return true;
    if (this.gyroFusion?.isEnabled()) return true;
    return false;
  }

  private loop = (timeMs: number) => {
    if (!this.isRunning) return;

    const deltaMs = timeMs - this.lastTime;
    this.lastTime = timeMs;

    if (this.rotationEngine) this.rotationEngine.update(timeMs);
    if (this.gyroFusion) this.gyroFusion.update(deltaMs);

    if (this.orientationAnim && this.model) {
      const elapsed = timeMs - this.orientationAnim.startTime;
      let t = elapsed / this.orientationAnim.durationMs;

      if (t >= 1.0) {
        this.model.root.quaternion.copy(this.orientationAnim.targetQuat);
        this.orientationAnim = null;
      } else {
        const eased = 1 - Math.pow(1 - t, 3);
        this.model.root.quaternion.slerpQuaternions(
          this.orientationAnim.startQuat,
          this.orientationAnim.targetQuat,
          eased,
        );
      }
    }

    const animating = this.hasActiveAnimation();
    if (this.needsRender || animating) {
      if (this.sceneManager) this.sceneManager.render();
      this.needsRender = false;
    }

    if (this.needsRender || animating) {
      this.animFrameId = requestAnimationFrame(this.loop);
    } else {
      // Idle: pause the loop until the next requestRender() call.
      this.animFrameId = null;
    }
  };

  public dispose(): void {
    this.isRunning = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.needsRender = false;
    this.orientationSub?.unsubscribe();
    this.rotationEventSub?.unsubscribe();
    if (this.orientationTracker) this.orientationTracker.dispose();
    if (this.sceneManager) this.sceneManager.dispose();
    if (this.factory) this.factory.dispose();
  }
}

// ── Edge / Corner ID → home grid position lookup tables ───────────────────
//
// Kociemba coordinate system used by CubeModel:
//   X = R(+1) / L(-1),  Y = U(+1) / D(-1),  Z = F(+1) / B(-1).
//
// The "home position" of a piece is the grid cell where that piece lives in
// a SOLVED cube. A cubie's `initialGridX/Y/Z` identifies which piece it
// permanently carries (even after scrambling), so we map the mask's target
// piece IDs to home positions and keep those cubies colored in
// {@link Cube3DEngine.setPhaseStickering}.

export interface GridPosition {
  x: number;
  y: number;
  z: number;
}

/** Edge ID → home grid position. Index aligns with the `Edge` enum. */
export const EDGE_HOME_POSITION: GridPosition[] = [
  { x: 1, y: 1, z: 0 },   // UR  (0)
  { x: 0, y: 1, z: 1 },   // UF  (1)
  { x: -1, y: 1, z: 0 },  // UL  (2)
  { x: 0, y: 1, z: -1 },  // UB  (3)
  { x: 1, y: -1, z: 0 },  // DR  (4)
  { x: 0, y: -1, z: 1 },  // DF  (5)
  { x: -1, y: -1, z: 0 }, // DL  (6)
  { x: 0, y: -1, z: -1 }, // DB  (7)
  { x: 1, y: 0, z: 1 },   // FR  (8)
  { x: -1, y: 0, z: 1 },  // FL  (9)
  { x: -1, y: 0, z: -1 }, // BL  (10)
  { x: 1, y: 0, z: -1 },  // BR  (11)
];

/** Corner ID → home grid position. Index aligns with the `Corner` enum. */
export const CORNER_HOME_POSITION: GridPosition[] = [
  { x: 1, y: 1, z: 1 },    // URF (0)
  { x: -1, y: 1, z: 1 },   // UFL (1)
  { x: -1, y: 1, z: -1 },  // ULB (2)
  { x: 1, y: 1, z: -1 },   // UBR (3)
  { x: 1, y: -1, z: 1 },   // DFR (4)
  { x: -1, y: -1, z: 1 },  // DLF (5)
  { x: -1, y: -1, z: -1 }, // DBL (6)
  { x: 1, y: -1, z: -1 },  // DRB (7)
];
