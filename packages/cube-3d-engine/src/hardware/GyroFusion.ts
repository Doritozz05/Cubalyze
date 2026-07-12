import { Object3D, Quaternion } from 'three';

export class GyroFusion {
  private target: Object3D;
  private targetQuat = new Quaternion();
  private enabled = false;

  constructor(targetObject: Object3D) {
    this.target = targetObject;
  }

  public enable(): void {
    this.enabled = true;
  }

  public disable(): void {
    this.enabled = false;
  }

  public updateTargetQuaternion(x: number, y: number, z: number, w: number): void {
    // We normalize the incoming quaternion just in case
    this.targetQuat.set(x, y, z, w).normalize();
  }

  /**
   * Called every frame in the render loop to smoothly interpolate (slerp)
   * the 3D object towards the latest hardware quaternion.
   */
  public update(deltaTimeMs: number): void {
    if (!this.enabled) return;

    // A factor of 0.1 per frame (at 60fps) provides smooth but responsive interpolation
    // For more precise time-based scaling, we could use deltaTimeMs.
    const SLERP_FACTOR = 0.15;
    
    this.target.quaternion.slerp(this.targetQuat, SLERP_FACTOR);
  }
}
