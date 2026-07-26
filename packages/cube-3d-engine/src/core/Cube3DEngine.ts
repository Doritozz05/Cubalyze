import { Quaternion, Mesh, MeshBasicMaterial, Material, Vector3 } from 'three';
import { SceneManager } from './SceneManager';
import { CubeMeshFactory, type CubeStyleOptions } from './CubeMeshFactory';
import { CubeModel } from './CubeModel';
import { RotationEngine, type RotationAxis } from '../animation/RotationEngine';
import { GyroFusion } from '../hardware/GyroFusion';
import { OrientationTracker } from '../hardware/OrientationTracker';
import { OrientationTable } from '@cubeforge/math-core';
import type { CubeOrientation, RotationEvent, CubeFace } from '@cubeforge/types';
import type { Subscription } from 'rxjs';

export interface Cube3DEngineOptions {
  canvas: HTMLCanvasElement | OffscreenCanvas;
  width: number;
  height: number;
  pixelRatio?: number;
  gyroSupported?: boolean;
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

  /** Track grayed-out sticker meshes so we can restore + dispose them. */
  private grayedStickers: { mesh: Mesh; originalMat: Material }[] = [];

  constructor(options: Cube3DEngineOptions) {
    const { canvas, width, height, pixelRatio = 1, gyroSupported = false } = options;
    this.init(canvas, width, height, pixelRatio, gyroSupported);
  }

  private init(
    canvas: HTMLCanvasElement | OffscreenCanvas,
    width: number,
    height: number,
    pixelRatio: number,
    gyroSupported: boolean,
  ) {
    this.sceneManager = new SceneManager(canvas, width, height, pixelRatio);

    this.factory = new CubeMeshFactory();
    this.model = new CubeModel(this.factory);
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
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  public resize(width: number, height: number): void {
    if (this.sceneManager && width > 0 && height > 0) {
      this.sceneManager.resize(width, height);
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
  }

  public syncFacelets(facelets: string): void {
    if (this.model) {
      this.model.applyFacelets(facelets);
    }
  }

  public rotateCamera(dx: number, dy: number): void {
    if (this.sceneManager) {
      this.sceneManager.rotateCamera(dx, dy);
    }
  }

  public updateGyro(x: number, y: number, z: number, w: number): void {
    if (!this.gyroFusion) return;
    this.gyroFusion.enable();
    this.gyroFusion.updateTargetQuaternion(x, y, z, w);

    if (!this.orientationTracker.capabilitiesInfo.gyroSupported) {
      this.orientationTracker.enableGyroSupport();
    }

    this.orientationTracker.update({ x, y: z, z: -y, w });
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
  }

  public setCubeOrientation(orientationIndex: number, animationDurationMs?: number): void {
    if (!this.model) return;
    const entry = OrientationTable.ENTRIES[orientationIndex];
    if (!entry) return;

    const duration = animationDurationMs ?? 0;

    if (duration <= 0) {
      this.orientationAnim = null;
      this.model.root.quaternion.copy(entry.quaternion);
      return;
    }

    this.orientationAnim = {
      startQuat: this.model.root.quaternion.clone(),
      targetQuat: entry.quaternion.clone(),
      startTime: performance.now(),
      durationMs: duration,
    };
  }

  public setFaceColor(face: string, color: string): void {
    if (this.factory) {
      this.factory.setFaceColor(face as CubeFace | 'Inner', color);
    }
  }

  public setFaceEmissive(face: string, emissiveColor: string, intensity: number): void {
    if (this.factory) {
      this.factory.setFaceEmissive(face as CubeFace | 'Inner', emissiveColor, intensity);
    }
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
  }

  public updateStyle(newStyle: Partial<CubeStyleOptions>): void {
    if (this.factory) {
      this.factory.updateStyle(newStyle);
    }
  }

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
  }

  /**
   * Gray out all sticker meshes on cubies belonging to a specific
   * layer (face + value). Used for F2L visualization where the
   * U (yellow) layer should appear gray to focus on the first two layers.
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
      cubieGroup.children.forEach((child) => {
        const mesh = child as Mesh;
        if (!mesh.isMesh) return;
        const mat = mesh.material;
        if (Array.isArray(mat)) return; // skip multi-material cores
        if (!(mat as MeshBasicMaterial).isMeshBasicMaterial) return; // only stickers
        // Clone the sticker material and set gray
        this.grayedStickers.push({ mesh, originalMat: mat });
        mesh.material = (mat as MeshBasicMaterial).clone();
      });
    }
  }

  /**
   * Applies F2L-specific masking to the 3D cube model.
   *
   * Grays out:
   * 1. All non-target pieces in the U layer (gridY === 1).
   * 2. All non-target pieces currently inside the FR target slot position (gridX === 1, gridZ === 1, gridY <= 0).
   *
   * Keeps colored:
   * 1. The target F2L pair pieces (initial position FR slot: initialGridX === 1, initialGridZ === 1, initialGridY !== 1).
   * 2. All solved cross and slot pieces (FL, BL, BR slots and D-layer cross).
   *
   * @param grayColor CSS color string (default '#808080')
   */
  public setF2LMaskGray(grayColor: string = '#808080'): void {
    if (!this.model || !this.factory) return;

    const cubies = this.model.getLogicalState();
    for (const cubie of cubies) {
      const isTargetPair =
        cubie.initialGridX === 1 &&
        cubie.initialGridZ === 1 &&
        cubie.initialGridY !== 1;

      const isInULayer = cubie.gridY === 1;
      const isInFRSlot = cubie.gridX === 1 && cubie.gridZ === 1 && cubie.gridY <= 0;

      const shouldGray = !isTargetPair && (isInULayer || isInFRSlot);

      if (shouldGray) {
        cubie.mesh.children.forEach((child) => {
          const mesh = child as Mesh;
          if (!mesh.isMesh) return;
          const mat = mesh.material;
          if (Array.isArray(mat)) return;
          if (!(mat as MeshBasicMaterial).isMeshBasicMaterial) return;

          this.grayedStickers.push({ mesh, originalMat: mat });
          mesh.material = (mat as MeshBasicMaterial).clone();
          (mesh.material as MeshBasicMaterial).color.set(grayColor);
        });
      }
    }
  }

  private loop = (timeMs: number) => {
    if (!this.isRunning) return;
    this.animFrameId = requestAnimationFrame(this.loop);

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

    if (this.sceneManager) this.sceneManager.render();
  };

  public dispose(): void {
    this.isRunning = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.orientationSub?.unsubscribe();
    this.rotationEventSub?.unsubscribe();
    if (this.orientationTracker) this.orientationTracker.dispose();
    if (this.sceneManager) this.sceneManager.dispose();
    if (this.factory) this.factory.dispose();
  }
}
