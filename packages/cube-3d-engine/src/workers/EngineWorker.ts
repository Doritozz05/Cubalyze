import * as Comlink from 'comlink';
import { SceneManager } from '../core/SceneManager';
import { CubeMeshFactory } from '../core/CubeMeshFactory';
import { CubeModel } from '../core/CubeModel';
import { RotationEngine, RotationAxis } from '../animation/RotationEngine';
import { GyroFusion } from '../hardware/GyroFusion';

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

  public async rotateLayer(axis: RotationAxis, layerValue: number, angle: number, durationMs: number) {
    await this.rotationEngine.rotateLayer(axis, layerValue, angle, durationMs);
  }

  public updateGyro(x: number, y: number, z: number, w: number) {
    this.gyroFusion.enable();
    this.gyroFusion.updateTargetQuaternion(x, y, z, w);
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
