import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  AmbientLight,
  DirectionalLight,
  Vector3,
  Group,
  Mesh,
  Spherical,
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
    this.camera.position.set(0, 0, this.orbitRadius);
    this.camera.lookAt(0, 0, 0);
    this.updateNearPlane();

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

  public rotateCamera(dx: number, dy: number): void {
    const SPEED = 0.005;
    const MIN_PHI = 0.1;
    const MAX_PHI = Math.PI - 0.1;

    const spherical = new Spherical().setFromVector3(this.camera.position);

    spherical.theta -= dx * SPEED;
    spherical.phi -= dy * SPEED;

    spherical.phi = Math.max(MIN_PHI, Math.min(MAX_PHI, spherical.phi));
    spherical.radius = Math.max(
      this.minOrbitRadius,
      Math.min(this.maxOrbitRadius, spherical.radius),
    );

    this.camera.position.setFromSpherical(spherical);
    this.camera.lookAt(0, 0, 0);
    this.updateNearPlane();
  }

  /**
   * Scale the orbit radius by `factor` (> 1 zooms in, < 1 zooms out),
   * clamped to [minOrbitRadius, maxOrbitRadius]. Preserves the current
   * viewing angles (theta/phi).
   */
  public zoomBy(factor: number): void {
    if (!Number.isFinite(factor) || factor <= 0) return;
    const spherical = new Spherical().setFromVector3(this.camera.position);
    spherical.radius = Math.max(
      this.minOrbitRadius,
      Math.min(this.maxOrbitRadius, spherical.radius * factor),
    );
    this.camera.position.setFromSpherical(spherical);
    this.camera.lookAt(0, 0, 0);
    this.updateNearPlane();
  }

  /** Resets the camera to the default front-facing position. */
  public resetCamera(): void {
    this.camera.position.set(0, 0, this.orbitRadius);
    this.camera.lookAt(0, 0, 0);
    this.updateNearPlane();
  }

  /**
   * Sets the camera to specific orbit angles (radians).
   * `theta` = azimuth around Y axis.  `phi` = elevation from horizontal plane.
   * Elevation is clamped to avoid flipping.
   */
  public setOrbitAngles(theta: number, phi: number, radius = this.orbitRadius): void {
    const MAX_ELEVATION = Math.PI / 2 - 0.1;
    const clampedPhi = Math.max(-MAX_ELEVATION, Math.min(MAX_ELEVATION, phi));
    const clampedRadius = Math.max(
      this.minOrbitRadius,
      Math.min(this.maxOrbitRadius, Number.isFinite(radius) ? radius : this.orbitRadius),
    );
    const cosPhi = Math.cos(clampedPhi);
    this.camera.position.set(
      clampedRadius * cosPhi * Math.sin(theta),
      clampedRadius * Math.sin(clampedPhi),
      clampedRadius * cosPhi * Math.cos(theta),
    );
    this.camera.lookAt(0, 0, 0);
    this.updateNearPlane();
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
