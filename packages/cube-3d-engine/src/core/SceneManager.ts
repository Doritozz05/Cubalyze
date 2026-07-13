import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  AmbientLight,
  DirectionalLight,
  Mesh,
  Color,
  Vector3,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type OnRenderCallback = () => void;

export class SceneManager {
  public scene: Scene;
  public camera: PerspectiveCamera;
  public renderer: WebGLRenderer;
  public controls: OrbitControls | null = null;

  private width: number;
  private height: number;

  private ambientLight: AmbientLight;
  private directionalLight: DirectionalLight;

  public onRender: OnRenderCallback | null = null;

  constructor(canvas: HTMLCanvasElement | OffscreenCanvas, width: number, height: number, pixelRatio: number) {
    this.width = width;
    this.height = height;

    this.scene = new Scene();
    this.scene.background = new Color('#1e1e1e');

    this.camera = new PerspectiveCamera(45, this.width / this.height, 0.1, 100);
    this.camera.position.set(0, 0, 7);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(pixelRatio, 2));
    this.renderer.setSize(width, height, false);

    [this.ambientLight, this.directionalLight] = this.setupLighting();

    if (typeof HTMLCanvasElement !== 'undefined' && canvas instanceof HTMLCanvasElement) {
      this.controls = new OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.1;
      this.controls.minDistance = 3;
      this.controls.maxDistance = 15;
    }
  }

  private setupLighting(): [AmbientLight, DirectionalLight] {
    const ambientLight = new AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const dirLight = new DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 20, 10);
    this.scene.add(dirLight);

    return [ambientLight, dirLight];
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

  public render(): void {
    if (this.controls) {
      this.controls.update();
    }
    this.renderer.render(this.scene, this.camera);
    this.onRender?.();
  }

  public dispose(): void {
    this.controls?.dispose();

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
