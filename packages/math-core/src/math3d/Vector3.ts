import type { Quaternion } from './Quaternion';

/**
 * Minimal 3D vector math (mirrors the three.js `Vector3` API surface used by
 * math-core). Kept dependency-free so `@cubalyze/math-core` — which is on the
 * critical path of the web app (solver preload, orientation remapping) — does
 * not drag the ~550 kB three.js bundle into the initial page load.
 *
 * Semantics (operator order, handedness) are identical to three.js, so the
 * quaternions produced by `FaceletParser` / `OrientationTable` remain
 * compatible with the 3D engine.
 */
export class Vector3 {
  public x: number;
  public y: number;
  public z: number;

  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  set(x: number, y: number, z: number): this {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  clone(): Vector3 {
    return new Vector3(this.x, this.y, this.z);
  }

  copy(v: Vector3): this {
    this.x = v.x;
    this.y = v.y;
    this.z = v.z;
    return this;
  }

  add(v: Vector3): this {
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
    return this;
  }

  sub(v: Vector3): this {
    this.x -= v.x;
    this.y -= v.y;
    this.z -= v.z;
    return this;
  }

  dot(v: Vector3): number {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }

  /**
   * Cross product, returning a NEW vector (this is not mutated).
   *
   * NOTE: deliberately diverges from three.js, whose `Vector3.cross` mutates
   * in place and returns `this`. Every in-repo call site clones before
   * crossing (`a.clone().cross(b)`), so this non-mutating form is safe and
   * avoids surprise aliasing. See math3d.parity.test.ts.
   */
  cross(v: Vector3): Vector3 {
    return new Vector3(
      this.y * v.z - this.z * v.y,
      this.z * v.x - this.x * v.z,
      this.x * v.y - this.y * v.x,
    );
  }

  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }

  normalize(): this {
    const len = this.length();
    if (len > 0) {
      this.x /= len;
      this.y /= len;
      this.z /= len;
    }
    return this;
  }

  /**
   * Rotate this vector by a quaternion: v' = q · v · q⁻¹.
   * Same algorithm as three.js `Vector3.applyQuaternion`.
   */
  applyQuaternion(q: Quaternion): this {
    const x = this.x;
    const y = this.y;
    const z = this.z;
    const qx = q.x;
    const qy = q.y;
    const qz = q.z;
    const qw = q.w;

    // t = 2 * cross(q.xyz, v)
    const tx = 2 * (qy * z - qz * y);
    const ty = 2 * (qz * x - qx * z);
    const tz = 2 * (qx * y - qy * x);

    // v' = v + q.w * t + cross(q.xyz, t)
    this.x = x + qw * tx + (qy * tz - qz * ty);
    this.y = y + qw * ty + (qz * tx - qx * tz);
    this.z = z + qw * tz + (qx * ty - qy * tx);
    return this;
  }
}
