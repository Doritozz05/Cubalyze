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

  private ambientLight: AmbientLight;
  private directionalLight: DirectionalLight;

  public onRender: OnRenderCallback | null = null;

  constructor(canvas: HTMLCanvasElement | OffscreenCanvas, width: number, height: number, pixelRatio: number) {
    this.width = width;
    this.height = height;

    this.scene = new Scene();

    this.camera = new PerspectiveCamera(45, this.width / this.height, 0.1, 100);
    this.camera.position.set(0, 0, 7);
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

  public rotateCamera(dx: number, dy: number): void {
    const ROTATION_SPEED = 0.005;
    this.cameraGroup.rotation.y -= dx * ROTATION_SPEED;
    this.cameraGroup.rotation.x -= dy * ROTATION_SPEED;

    // Clamp X rotation to avoid flipping upside down
    const maxPitch = Math.PI / 2 - 0.1;
    this.cameraGroup.rotation.x = Math.max(-maxPitch, Math.min(maxPitch, this.cameraGroup.rotation.x));
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
