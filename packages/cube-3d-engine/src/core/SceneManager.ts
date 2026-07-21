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

export type OnRenderCallback = () => void;

export class SceneManager {
  public scene: Scene;
  public camera: PerspectiveCamera;
  public renderer: WebGLRenderer;
  public cameraGroup: Group;

  private width: number;
  private height: number;

  private readonly orbitRadius: number = 7;

  private ambientLight: AmbientLight;
  private directionalLight: DirectionalLight;

  public onRender: OnRenderCallback | null = null;

  constructor(canvas: HTMLCanvasElement | OffscreenCanvas, width: number, height: number, pixelRatio: number) {
    this.width = width;
    this.height = height;

    this.scene = new Scene();

    this.camera = new PerspectiveCamera(45, this.width / this.height, 0.1, 100);
    this.camera.position.set(0, 0, this.orbitRadius);
    this.camera.lookAt(0, 0, 0);

    this.cameraGroup = new Group();
    this.scene.add(this.cameraGroup);
    this.cameraGroup.add(this.camera);

    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(pixelRatio, 2));
    this.renderer.setSize(width, height, false);

    [this.ambientLight, this.directionalLight] = this.setupLighting();
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

  public resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  /**
   * Rotates the camera orbit using screen-space-aligned quaternion rotations.
   *
   * - `dx` (horizontal drag) rotates around world Y — the cube orbits
   *   horizontally regardless of current tilt.
   * - `dy` (vertical drag) rotates around the camera's local RIGHT axis
   *   (= screen horizontal in world space), tilting the view up/down.
   *
   * Vertical tilt is clamped BEFORE applying to avoid distorting azimuth.
   */
  public rotateCamera(dx: number, dy: number): void {
    const SPEED = 0.005;
    const MAX_ELEVATION = Math.PI / 2 - 0.1;

    // ── 1. Horizontal orbit around world Y ────────────────────────────
    this.camera.position.applyAxisAngle(new Vector3(0, 1, 0), -dx * SPEED);

    // ── 2. Compute camera's right axis in world space ─────────────────
    const toOrigin = new Vector3()
      .copy(this.camera.position)
      .multiplyScalar(-1)
      .normalize();
    const right = new Vector3()
      .crossVectors(toOrigin, new Vector3(0, 1, 0))
      .normalize();

    if (right.lengthSq() > 0.001) {
      // ── 3. Clamp vertical rotation before applying ──────────────────
      const currentElevation = Math.asin(
        Math.max(-1, Math.min(1, this.camera.position.y / this.orbitRadius)),
      );
      let vertAngle = -dy * SPEED;
      const desired = currentElevation + vertAngle;
      if (desired > MAX_ELEVATION) {
        vertAngle = MAX_ELEVATION - currentElevation;
      } else if (desired < -MAX_ELEVATION) {
        vertAngle = -MAX_ELEVATION - currentElevation;
      }
      this.camera.position.applyAxisAngle(right, vertAngle);
    }

    // ── 4. Maintain orbit radius ─────────────────────────────────────
    this.camera.position.normalize().multiplyScalar(this.orbitRadius);

    // ── 5. Re-aim at origin ──────────────────────────────────────────
    this.camera.lookAt(0, 0, 0);
  }

  /** Resets the camera to the default front-facing position. */
  public resetCamera(): void {
    this.camera.position.set(0, 0, this.orbitRadius);
    this.camera.lookAt(0, 0, 0);
  }

  /**
   * Sets the camera to specific orbit angles (radians).
   * `theta` = azimuth around Y axis.  `phi` = elevation from horizontal plane.
   * Elevation is clamped to avoid flipping.
   */
  public setOrbitAngles(theta: number, phi: number): void {
    const MAX_ELEVATION = Math.PI / 2 - 0.1;
    const clamped = Math.max(-MAX_ELEVATION, Math.min(MAX_ELEVATION, phi));
    const cosPhi = Math.cos(clamped);
    this.camera.position.set(
      this.orbitRadius * cosPhi * Math.sin(theta),
      this.orbitRadius * Math.sin(clamped),
      this.orbitRadius * cosPhi * Math.cos(theta),
    );
    this.camera.lookAt(0, 0, 0);
  }

  public render(): void {
    this.renderer.render(this.scene, this.camera);
    this.onRender?.();
  }

  public dispose(): void {

    this.scene.traverse((obj) => {
      if (obj instanceof Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });

    this.renderer.dispose();
  }
}
