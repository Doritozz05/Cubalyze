import * as Comlink from 'comlink';
import { SceneManager } from '../core/SceneManager';
import { CubeMeshFactory, type CubeStyleOptions } from '../core/CubeMeshFactory';
import { CubeModel } from '../core/CubeModel';
import { RotationEngine, type RotationAxis } from '../animation/RotationEngine';
import { GyroFusion } from '../hardware/GyroFusion';
import { OrientationTracker } from '../hardware/OrientationTracker';
import { OrientationTable } from '@cubeforge/math-core';
import type { CubeOrientation, RotationEvent } from '@cubeforge/types';
import type { CubeFace } from '@cubeforge/types';
import type { Subscription } from 'rxjs';

export class EngineWorkerAPI {
  private sceneManager!: SceneManager;
  private factory!: CubeMeshFactory;
  private model!: CubeModel;
  private rotationEngine!: RotationEngine;
  private gyroFusion!: GyroFusion;
  private orientationTracker!: OrientationTracker;

  // Callback registered by the main thread to receive orientation updates
  private onOrientationChangeCb?: (o: CubeOrientation) => void;
  // Callback registered by the main thread to receive rotation events (x/y/z)
  private onRotationEventCb?: (e: RotationEvent) => void;
  private orientationSub?: Subscription;
  private rotationEventSub?: Subscription;

  private lastTime: number = 0;
  private isRunning: boolean = false;

  public init(canvas: OffscreenCanvas, width: number, height: number, pixelRatio: number) {
    this.sceneManager = new SceneManager(canvas, width, height, pixelRatio);

    this.factory = new CubeMeshFactory();
    this.model = new CubeModel(this.factory);
    this.sceneManager.scene.add(this.model.root);

    this.rotationEngine = new RotationEngine(this.model);
    this.gyroFusion = new GyroFusion(this.model.root);

    // OrientationTracker starts without gyro support; updated when hardware info arrives
    this.orientationTracker = new OrientationTracker({ gyroSupported: false });
    // Wire GyroFusion calibration → OrientationTracker calibration
    this.gyroFusion.onCalibrate = (q) => this.orientationTracker.setCalibration(q);
    // Forward orientation changes to the main thread callback
    this.orientationSub = this.orientationTracker.orientation$.subscribe((o) => {
      this.onOrientationChangeCb?.(o);
    });
    // Forward rotation events (x/y/z) to the main thread callback
    this.rotationEventSub = this.orientationTracker.rotationEvents$.subscribe((e) => {
      this.onRotationEventCb?.(e);
    });

    this.isRunning = true;
    this.loop(performance.now());
  }

  /** Re-attach rendering to a new OffscreenCanvas (e.g. after component remount) */
  public reconnect(canvas: OffscreenCanvas, width: number, height: number, pixelRatio: number) {
    if (this.sceneManager) {
      this.sceneManager.dispose();
    }

    this.sceneManager = new SceneManager(canvas, width, height, pixelRatio);
    this.sceneManager.scene.add(this.model.root);
  }

  public resize(width: number, height: number) {
    if (this.sceneManager) {
      this.sceneManager.resize(width, height);
    }
  }

  public async rotateLayers(
    axis: RotationAxis,
    layerValues: number[],
    angle: number,
    durationMs: number,
    elapsedMs?: number,
    easingStrategy?: string
  ) {
    if (!this.rotationEngine) return;
    await this.rotationEngine.rotateLayers(
      axis,
      layerValues,
      angle,
      durationMs,
      elapsedMs,
      easingStrategy as 'bounce' | 'smooth' | 'fast' | 'linear' | undefined
    );
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
    if (!this.gyroFusion) return;
    this.gyroFusion.enable();
    this.gyroFusion.updateTargetQuaternion(x, y, z, w);

    // Auto-enable gyro tracking on first gyro data arrival.
    // This handles the race condition where the HARDWARE event arrives
    // AFTER the Cube3DPanel mount — the tracker starts with gyroSupported=false
    // but self-enables as soon as real gyro data flows.
    if (!this.orientationTracker.capabilitiesInfo.gyroSupported) {
      this.orientationTracker.enableGyroSupport();
    }

    // Feed the OrientationTracker with the SAME remapped quaternion that
    // GyroFusion uses internally (x, z, -y, w) — this ensures the tracker's
    // calibration reference and update data are in the same coordinate system
    // (Three.js right-handed, Y-up), matching the OrientationTable entries.
    this.orientationTracker.update({ x, y: z, z: -y, w });
  }

  public disableGyro() {
    if (!this.gyroFusion) return;
    this.gyroFusion.disable();
  }

  /** Calibrates the gyroscope — sets the current orientation as the "zero" reference */
  public calibrateGyro() {
    if (!this.gyroFusion) return;
    if (this.sceneManager) {
      this.sceneManager.resetCamera();
    }
    this.gyroFusion.calibrate();
  }

  /** Sets whether the connected cube has gyro/IMU support */
  public setGyroSupported(supported: boolean) {
    if (!this.orientationTracker) return;

    const currentlyEnabled = this.orientationTracker.capabilitiesInfo.gyroSupported;

    if (supported && !currentlyEnabled) {
      // Enabling: lightweight — just flip the capability flag.
      // Preserves calibration and existing subscriptions.
      this.orientationTracker.enableGyroSupport();
      return;
    }

    if (!supported && currentlyEnabled) {
      // Disabling: full reset to stop processing gyro events.
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

    // Already in the desired state — no-op.
  }

  /** Registers a callback (via Comlink.proxy) to receive orientation updates */
  public onOrientationChange(cb: (o: CubeOrientation) => void) {
    this.onOrientationChangeCb = cb;
  }

  /** Registers a callback (via Comlink.proxy) to receive rotation events (x/y/z) */
  public onRotationEvent(cb: (e: RotationEvent) => void) {
    this.onRotationEventCb = cb;
  }

  /** Returns the current orientation */
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

  /** Resets gyroscope calibration to raw input */
  public resetGyroCalibration() {
    if (!this.gyroFusion) return;
    this.gyroFusion.resetCalibration();
  }

  /**
   * Sets the cube root group orientation from an OrientationTable index (0-23).
   * Used during replays to accurately show the cube's physical orientation
   * at each move based on stored gyro data.
   */
  public setCubeOrientation(orientationIndex: number) {
    if (!this.model) return;
    const entry = OrientationTable.ENTRIES[orientationIndex];
    if (!entry) return;
    this.model.root.quaternion.copy(entry.quaternion);
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
    this.orientationSub?.unsubscribe();
    this.rotationEventSub?.unsubscribe();
    if (this.orientationTracker) this.orientationTracker.dispose();
    if (this.sceneManager) this.sceneManager.dispose();
    if (this.factory) this.factory.dispose();
  }
}

Comlink.expose(new EngineWorkerAPI());
