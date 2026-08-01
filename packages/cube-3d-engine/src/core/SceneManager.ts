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

export type OnRenderCallback = () => void;

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
    // Guard against degenerate dimensions that produce NaN or Infinity aspect.
    if (width <= 0 || height <= 0) return;

    this.width = width;
    this.height = height;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
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
  }

  public render(): void {
    this.renderer.render(this.scene, this.camera);
    this.onRender?.();
  }

  public dispose(): void {
    // Only dispose the WebGL renderer.
    // Do NOT traverse this.scene and dispose geometries/materials of external
    // meshes (like CubeModel.root), as they are owned by CubeMeshFactory and
    // must survive canvas reconnects when reopening 3D panels.
    this.renderer.dispose();
  }
}
