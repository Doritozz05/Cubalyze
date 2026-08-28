import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  AmbientLight,
  DirectionalLight,
  Vector3,
  Group,
  Mesh,
} from 'three';
import { webglContextManager } from './WebGLContextManager';

export type OnRenderCallback = () => void;

export interface SceneManagerOptions {
  /**
   * Mark this context as disposable. The global context manager evicts
   * disposable contexts first when the browser's WebGL context budget is
   * exceeded (e.g. offscreen snapshot engines — they are recreated on demand).
   */
  evictable?: boolean;
  /** Called when the global context manager force-evicts this context. */
  onContextEvicted?: () => void;
}

export class SceneManager {
  public scene: Scene;
  public camera: PerspectiveCamera;
  public renderer: WebGLRenderer;
  public cameraGroup: Group;

  private width: number;
  private height: number;

  private readonly orbitRadius: number = 7;
  private readonly minOrbitRadius: number = 2;
  private readonly maxOrbitRadius: number = 20;

  /**
   * Turntable Orbit camera state (0% Roll Drift).
   *
   * The camera orbits the cube target (0, 0, 0) using spherical coordinates:
   *   - orbitTheta: Azimuth angle around World Y (yaw).
   *   - orbitPhi:   Elevation angle from horizontal plane (pitch), clamped to avoid pole singularities.
   *   - currentOrbitRadius: Distance to target.
   *
   * The camera's up vector is permanently locked to World Up (0, 1, 0), which
   * mathematically guarantees 0 roll drift (the horizon is always perfectly level).
   */
  private orbitTheta = 0;
  private orbitPhi = 0;
  private currentOrbitRadius = 7;
  private readonly maxElevation = Math.PI / 2 - 0.01; // ~89.4 deg to avoid gimbal singularity
  /**
   * Near plane bounds for dynamic depth precision. A fixed near of 0.1 at
   * max zoom-out (radius 20) compresses the depth buffer so much that the
   * sticker panels (0.0001 in front of the cubie cores) z-fight and flicker.
   * Near scales with the orbit radius within these bounds.
   */
  private readonly minNearPlane = 0.1;
  private readonly maxNearPlane = 1.5;

  private ambientLight: AmbientLight;
  private directionalLight: DirectionalLight;

  public onRender: OnRenderCallback | null = null;

  private readonly baseFov: number = 45;

  /** True after the global context manager force-evicted this context. */
  private contextEvicted = false;

  /**
   * Called when the global context manager force-evicts this context.
   * Set from the constructor options; lets the owning engine stop its loop.
   */
  public onContextEvicted: (() => void) | null = null;

  constructor(
    canvas: HTMLCanvasElement | OffscreenCanvas,
    width: number,
    height: number,
    pixelRatio: number,
    options: SceneManagerOptions = {},
  ) {
    this.onContextEvicted = options.onContextEvicted ?? null;

    this.width = width;
    this.height = height;

    this.scene = new Scene();

    const safeAspect = width > 0 && height > 0 ? width / height : 1;
    this.camera = new PerspectiveCamera(this.baseFov, safeAspect, this.minNearPlane, 100);
    this.updateCameraAspectAndFov(width, height);
    this.updateCameraTransform();

    this.cameraGroup = new Group();
    this.scene.add(this.cameraGroup);
    this.cameraGroup.add(this.camera);

    // Three.js throws "Cannot read properties of null (reading 'precision')" when
    // canvas.getContext() returns null (browser WebGL context limit reached).
    // Wrap the constructor so callers get a meaningful error they can catch gracefully.
    try {
      this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch (err) {
      throw new Error(
        `[SceneManager] WebGL context creation failed — browser may have reached its context limit. ` +
        `Original error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    this.renderer.setPixelRatio(Math.min(pixelRatio, 2));
    this.renderer.setSize(width, height, false);

    // Prevent the browser from escalating a context-lost event into an uncaught error.
    // e.preventDefault() is required for Three.js's own context-restore path to work.
    if ('addEventListener' in canvas) {
      canvas.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
      }, false);
    }

    // Register with the global LRU context manager. If the browser context
    // budget is exhausted, an older (evictable-first) context is destroyed to
    // make room — preventing iOS Safari from returning null for getContext().
    const kept = webglContextManager.register(this.renderer, {
      evictable: options.evictable ?? false,
      onEvicted: () => {
        this.contextEvicted = true;
        this.onContextEvicted?.();
      },
    });
    if (!kept) {
      this.contextEvicted = true;
      this.onContextEvicted?.();
    }

    [this.ambientLight, this.directionalLight] = this.setupLighting();
  }

  /**
   * True when the global context manager force-evicted this context (its
   * slot was reclaimed because the browser hit the WebGL context limit).
   * Evicted contexts can no longer render — callers should stop their loop
   * and show a graceful fallback instead of a frozen canvas.
   */
  public isContextEvicted(): boolean {
    return this.contextEvicted || webglContextManager.isEvicted(this.renderer);
  }

  private setupLighting(): [AmbientLight, DirectionalLight] {
    const ambientLight = new AmbientLight(0xffffff, 0.8);
    this.scene.add(ambientLight);

    const keyLight = new DirectionalLight(0xffffff, 0.5);
    keyLight.position.set(5, 10, 7);
    this.scene.add(keyLight);

    return [ambientLight, keyLight];
  }

  public setLighting(ambientIntensity: number, directionalIntensity: number, dirPosition?: Vector3): void {
    this.ambientLight.intensity = ambientIntensity;
    this.directionalLight.intensity = directionalIntensity;
    if (dirPosition) {
      this.directionalLight.position.copy(dirPosition);
    }
  }

  private updateCameraAspectAndFov(width: number, height: number): void {
    if (width <= 0 || height <= 0) return;
    const aspect = width / height;
    if (!Number.isFinite(aspect) || aspect <= 0) return;

    this.camera.aspect = aspect;

    // On narrow viewports (aspect < 1.0), widen the vertical FOV proportionally
    // so the horizontal FOV remains constant and the 3D cube scales down to fit.
    if (aspect < 1.0) {
      const baseFovRad = (this.baseFov * Math.PI) / 180;
      const safeAspect = Math.max(0.05, aspect);
      const targetFovRad = 2 * Math.atan(Math.tan(baseFovRad / 2) / safeAspect);
      this.camera.fov = Math.min(140, (targetFovRad * 180) / Math.PI);
    } else {
      this.camera.fov = this.baseFov;
    }

    this.camera.updateProjectionMatrix();
  }

  public resize(width: number, height: number): void {
    // Guard against degenerate dimensions that produce NaN or Infinity aspect.
    if (width <= 0 || height <= 0) return;

    this.width = width;
    this.height = height;
    this.updateCameraAspectAndFov(width, height);
    this.renderer.setSize(width, height, false);
  }

  /**
   * Scales the near plane with the orbit distance so depth precision stays
   * consistent at any zoom level. At max zoom-out the cube is ~20 units away;
   * a near of ~0.6 (vs 0.1) gives ~6× more usable depth precision, which
   * eliminates the sticker/core z-fighting flicker far away. Clamped so it
   * never clips the nearest cubie surface when zoomed in close.
   */
  private updateNearPlane(): void {
    const dist = this.camera.position.length();
    this.camera.near = Math.min(
      this.maxNearPlane,
      Math.max(this.minNearPlane, dist * 0.03),
    );
    this.camera.updateProjectionMatrix();
  }

  /**
   * Applies the spherical orbit coordinates (theta, phi, radius) to the
   * camera's position and lookAt target.
   *
   * By fixing camera.up to (0, 1, 0) and evaluating spherical coordinates,
   * roll drift is mathematically eliminated (0% roll drift under any sequence
   * of drag gestures).
   */
  private updateCameraTransform(): void {
    this.orbitPhi = Math.max(-this.maxElevation, Math.min(this.maxElevation, this.orbitPhi));
    this.currentOrbitRadius = Math.max(
      this.minOrbitRadius,
      Math.min(this.maxOrbitRadius, this.currentOrbitRadius),
    );

    const cosPhi = Math.cos(this.orbitPhi);
    this.camera.position.set(
      this.currentOrbitRadius * cosPhi * Math.sin(this.orbitTheta),
      this.currentOrbitRadius * Math.sin(this.orbitPhi),
      this.currentOrbitRadius * cosPhi * Math.cos(this.orbitTheta),
    );
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(0, 0, 0);
    this.updateNearPlane();
  }

  /**
   * Rotate the orbit camera around the target (0, 0, 0) via pointer/touch drag.
   *
   * @param dx  Horizontal drag offset in pixels. Rotates azimuth around World Y.
   * @param dy  Vertical drag offset in pixels. Elevates / pitches viewing angle.
   */
  public rotateCamera(dx: number, dy: number): void {
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
    const SPEED = 0.005;
    this.orbitTheta -= dx * SPEED;
    this.orbitPhi += dy * SPEED;
    this.updateCameraTransform();
  }

  /**
   * Scale the orbit radius by `factor` (> 1 zooms in, < 1 zooms out),
   * clamped to [minOrbitRadius, maxOrbitRadius]. Preserves current viewing angles.
   */
  public zoomBy(factor: number): void {
    if (!Number.isFinite(factor) || factor <= 0) return;
    this.currentOrbitRadius = Math.max(
      this.minOrbitRadius,
      Math.min(this.maxOrbitRadius, this.currentOrbitRadius * factor),
    );
    this.updateCameraTransform();
  }

  /** Resets the camera to the default front-facing position (0, 0, orbitRadius). */
  public resetCamera(): void {
    this.orbitTheta = 0;
    this.orbitPhi = 0;
    this.currentOrbitRadius = this.orbitRadius;
    this.updateCameraTransform();
  }

  /**
   * Sets the camera to specific orbit angles (radians).
   * `theta` = azimuth around Y axis. `phi` = elevation from horizontal plane.
   */
  public setOrbitAngles(theta: number, phi: number, radius = this.orbitRadius): void {
    if (!Number.isFinite(theta) || !Number.isFinite(phi)) return;
    this.orbitTheta = theta;
    this.orbitPhi = phi;
    this.currentOrbitRadius = Number.isFinite(radius) ? radius : this.orbitRadius;
    this.updateCameraTransform();
  }

  /** Gets current spherical orbit angles (theta, phi, radius). */
  public getOrbitAngles(): { theta: number; phi: number; radius: number } {
    return {
      theta: this.orbitTheta,
      phi: this.orbitPhi,
      radius: this.currentOrbitRadius,
    };
  }

  public render(): void {
    // Skip render if the WebGL context has been lost (e.g. tab hidden, GPU reset).
    if (this.renderer.getContext?.()?.isContextLost?.()) return;
    webglContextManager.touch(this.renderer);
    this.renderer.render(this.scene, this.camera);
    this.onRender?.();
  }

  public dispose(): void {
    // Remove from the LRU registry so its slot is not counted while disposed.
    // (Map.delete never throws — kept outside the try.)
    webglContextManager.unregister(this.renderer);
    try {
      // renderer.dispose() frees GPU resources (textures, buffers, programs).
      // Do NOT call forceContextLoss() here: it permanently marks the canvas DOM
      // node's context as lost, which prevents re-creating an engine on the same
      // canvas element (React reuses the same <canvas> node across mount cycles).
      this.renderer.dispose();
    } catch {
      // Ignore if context was already lost or renderer was never initialised.
    }
  }
}
