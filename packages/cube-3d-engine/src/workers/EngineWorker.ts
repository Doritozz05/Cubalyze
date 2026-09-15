import * as Comlink from 'comlink';
import { Cube3DEngine } from '../core/Cube3DEngine';
import type { CubeStyleOptions } from '../core/CubeMeshFactory';
import type { RotationAxis } from '../animation/RotationEngine';
import type { CubeOrientation, RotationEvent } from '@cubalyze/types';

export class EngineWorkerAPI {
  private engine: Cube3DEngine | null = null;
  private savedOnOrientationChangeCb?: (o: CubeOrientation) => void;
  private savedOnRotationEventCb?: (e: RotationEvent) => void;

  /**
   * Initialize the renderer. `order` selects the puzzle: 2 (2×2×2) or
   * 3 (3×3×3, default).
   */
  public init(
    canvas: OffscreenCanvas,
    width: number,
    height: number,
    pixelRatio: number,
    order = 3,
  ) {
    if (this.engine) {
      this.engine.dispose();
    }
    this.engine = new Cube3DEngine({ canvas, width, height, pixelRatio, order });
    if (this.savedOnOrientationChangeCb) {
      this.engine.onOrientationChange(this.savedOnOrientationChangeCb);
    }
    if (this.savedOnRotationEventCb) {
      this.engine.onRotationEvent(this.savedOnRotationEventCb);
    }
  }

  public reconnect(
    canvas: OffscreenCanvas,
    width: number,
    height: number,
    pixelRatio: number,
    order = 3,
  ) {
    this.init(canvas, width, height, pixelRatio, order);
  }

  public resize(width: number, height: number) {
    this.engine?.resize(width, height);
  }

  public async rotateLayers(
    axis: RotationAxis,
    layerValues: number[],
    angle: number,
    durationMs: number,
    elapsedMs?: number,
    easingStrategy?: string,
  ) {
    if (this.engine) {
      await this.engine.rotateLayers(axis, layerValues, angle, durationMs, elapsedMs, easingStrategy);
    }
  }

  public resetCube() {
    this.engine?.resetCube();
  }

  /**
   * Force-complete every in-flight animation (layer rotations + root SLERP).
   * The ReplayEngine calls this before every reset/seek so a stale animation
   * can never be applied on top of the freshly reset cube.
   */
  public flushAnimations() {
    this.engine?.flushAnimations();
  }

  public syncFacelets(facelets: string) {
    this.engine?.syncFacelets(facelets);
  }

  public rotateCamera(dx: number, dy: number) {
    this.engine?.rotateCamera(dx, dy);
  }

  /**
   * Mark the camera as being dragged (pointer down/up). ReplaySection calls
   * this on every drag gesture on the replay cube; without it the worker
   * side throws the comlink "undefined.apply" error on every drag (the
   * method was only forwarded on the main-thread engine, never exposed on
   * the worker API).
   */
  public setCameraDragActive(active: boolean): void {
    this.engine?.setCameraDragActive(active);
  }

  public zoomCamera(deltaY: number) {
    this.engine?.zoomCamera(deltaY);
  }

  public resetCamera(smooth = false) {
    return this.engine?.resetCamera(smooth);
  }

  public setIsometricView(smooth = false, radius?: number) {
    return this.engine?.setIsometricView(smooth, radius);
  }

  public animateCameraTo(theta: number, phi: number, radius?: number, durationMs?: number) {
    return this.engine?.animateCameraTo(theta, phi, radius, durationMs);
  }

  public updateGyro(
    x: number,
    y: number,
    z: number,
    w: number,
    velocity?: { x: number; y: number; z: number },
  ) {
    this.engine?.updateGyro(x, y, z, w, velocity);
  }

  public disableGyro() {
    this.engine?.disableGyro();
  }

  public calibrateGyro() {
    this.engine?.calibrateGyro();
  }

  public setGyroSupported(supported: boolean) {
    this.engine?.setGyroSupported(supported);
  }

  public onOrientationChange(cb: (o: CubeOrientation) => void) {
    this.savedOnOrientationChangeCb = cb;
    this.engine?.onOrientationChange(cb);
  }

  public onRotationEvent(cb: (e: RotationEvent) => void) {
    this.savedOnRotationEventCb = cb;
    this.engine?.onRotationEvent(cb);
  }

  public getOrientation(): CubeOrientation {
    return this.engine ? this.engine.getOrientation() : {
      quaternion: { x: 0, y: 0, z: 0, w: 1 },
      faceMap: { U: 'U', D: 'D', F: 'F', B: 'B', L: 'L', R: 'R' },
      label: 'UF',
    };
  }

  public resetGyroCalibration() {
    this.engine?.resetGyroCalibration();
  }

  public setCubeOrientation(orientationIndex: number, animationDurationMs?: number): Promise<void> | undefined {
    // Return the engine's promise so Comlink proxies it — the replay engine
    // awaits the orientation animation (inspection pre-roll) before the next
    // move is applied.
    return this.engine?.setCubeOrientation(orientationIndex, animationDurationMs);
  }

  public setFaceColor(face: string, color: string) {
    this.engine?.setFaceColor(face, color);
  }

  public setFaceEmissive(face: string, emissiveColor: string, intensity: number) {
    this.engine?.setFaceEmissive(face, emissiveColor, intensity);
  }

  public updateStyle(newStyle: Partial<CubeStyleOptions>) {
    this.engine?.updateStyle(newStyle);
  }

  public dispose() {
    this.engine?.dispose();
    this.engine = null;
  }
}

Comlink.expose(new EngineWorkerAPI());
