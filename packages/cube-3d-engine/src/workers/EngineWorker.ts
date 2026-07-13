import * as Comlink from 'comlink';
import { SceneManager } from '../core/SceneManager';
import { CubeMeshFactory, type CubeStyleOptions } from '../core/CubeMeshFactory';
import { CubeModel } from '../core/CubeModel';
import { RotationEngine, type RotationAxis } from '../animation/RotationEngine';
import { GyroFusion } from '../hardware/GyroFusion';
import type { CubeFace } from '@cubeforge/types';

export class EngineWorkerAPI {
  private sceneManager!: SceneManager;
  private factory!: CubeMeshFactory;
  private model!: CubeModel;
  private rotationEngine!: RotationEngine;
  private gyroFusion!: GyroFusion;

  private lastTime: number = 0;
  private isRunning: boolean = false;

  public init(canvas: OffscreenCanvas, width: number, height: number, pixelRatio: number) {
    this.sceneManager = new SceneManager(canvas, width, height, pixelRatio);

    this.factory = new CubeMeshFactory();
    this.model = new CubeModel(this.factory);
    this.sceneManager.scene.add(this.model.root);

    this.rotationEngine = new RotationEngine(this.model);
    this.gyroFusion = new GyroFusion(this.model.root);

    this.isRunning = true;
    this.loop(performance.now());
  }

  public resize(width: number, height: number) {
    if (this.sceneManager) {
      this.sceneManager.resize(width, height);
    }
  }

  public async rotateLayers(axis: RotationAxis, layerValues: number[], angle: number, durationMs: number, elapsedMs?: number) {
    await this.rotationEngine.rotateLayers(axis, layerValues, angle, durationMs, elapsedMs);
  }

  public resetCube() {
    if (this.model) {
      this.model.resetCube();
    }
  }

  public syncFacelets(facelets: string) {
    if (this.model) {
      this.model.applyFacelets(facelets);
    }
  }

  public rotateCamera(dx: number, dy: number) {
    if (this.sceneManager) {
      this.sceneManager.rotateCamera(dx, dy);
    }
  }

  public updateGyro(x: number, y: number, z: number, w: number) {
    this.gyroFusion.enable();
    this.gyroFusion.updateTargetQuaternion(x, y, z, w);
  }

  public disableGyro() {
    this.gyroFusion.disable();
  }

  /** Calibrates the gyroscope — sets the current orientation as the "zero" reference */
  public calibrateGyro() {
    this.gyroFusion.calibrate();
  }

  /** Resets gyroscope calibration to raw input */
  public resetGyroCalibration() {
    this.gyroFusion.resetCalibration();
  }

  // ─── Visual API pass-through ────────────────────────────────────────────

  /** Changes a single face color at runtime */
  public setFaceColor(face: string, color: string) {
    if (this.factory) {
      this.factory.setFaceColor(face as CubeFace | 'Inner', color);
    }
  }

  /** Sets emissive highlight on a face (for analysis overlays) */
  public setFaceEmissive(face: string, emissiveColor: string, intensity: number) {
    if (this.factory) {
      this.factory.setFaceEmissive(face as CubeFace | 'Inner', emissiveColor, intensity);
    }
  }

  /** Updates the entire color scheme */
  public updateStyle(newStyle: Partial<CubeStyleOptions>) {
    if (this.factory) {
      this.factory.updateStyle(newStyle);
    }
  }

  private loop = (timeMs: number) => {
    if (!this.isRunning) return;
    requestAnimationFrame(this.loop);

    const deltaMs = timeMs - this.lastTime;
    this.lastTime = timeMs;

    if (this.rotationEngine) this.rotationEngine.update(timeMs);
    if (this.gyroFusion) this.gyroFusion.update(deltaMs);

    if (this.sceneManager) this.sceneManager.render();
  }

  public dispose() {
    this.isRunning = false;
    if (this.sceneManager) this.sceneManager.dispose();
    if (this.factory) this.factory.dispose();
  }
}

Comlink.expose(new EngineWorkerAPI());
