import { Quaternion, Vector3, MathUtils } from 'three';
import type { RotationAxis, RotationEvent, CubeMoveDirection } from '@cubeforge/types';

const ANGLE_THRESHOLD_DEG = 25;
const DOMINANCE_RATIO = 0.6;
const COOLDOWN_MS = 400;
const MINANGLE_DEG = 30;

const VEC3 = {
  x: { x: 1, y: 0, z: 0 },
  y: { x: 0, y: 1, z: 0 },
  z: { x: 0, y: 0, z: 1 },
} as const;

function snapAngle90(angleDeg: number): { snapped: number; direction: CubeMoveDirection } | null {
  const candidates: [number, CubeMoveDirection][] = [
    [90, 1],
    [270, -1],
    [360, 2],
  ];

  let best: { snapped: number; direction: CubeMoveDirection } | null = null;
  let bestDist = Infinity;

  for (const [candidate, dir] of candidates) {
    const dist = Math.abs(angleDeg - candidate);
    if (dist < ANGLE_THRESHOLD_DEG && dist < bestDist) {
      bestDist = dist;
      best = { snapped: candidate, direction: dir };
    }
  }

  return best;
}

function dominantAxis(q: Quaternion): RotationAxis | null {
  const angle = 2 * Math.acos(Math.min(1, Math.abs(q.w)));
  if (angle < MathUtils.degToRad(MINANGLE_DEG)) return null;

  const s = Math.sqrt(1 - q.w * q.w);
  if (s < 0.001) return null;

  const ax = Math.abs(q.x / s);
  const ay = Math.abs(q.y / s);
  const az = Math.abs(q.z / s);
  const total = ax + ay + az;
  if (total < 0.001) return null;

  const ratios: [RotationAxis, number][] = [
    ['x', ax / total],
    ['y', ay / total],
    ['z', az / total],
  ];
  ratios.sort((a, b) => b[1] - a[1]);

  return ratios[0][1] >= DOMINANCE_RATIO ? ratios[0][0] : null;
}

export class RotationDetector {
  private referenceQuat = new Quaternion();
  private lastDetectionTime = 0;

  public setReference(quat: Quaternion): void {
    this.referenceQuat.copy(quat);
  }

  public reset(): void {
    this.referenceQuat.identity();
    this.lastDetectionTime = 0;
  }

  public detectRotation(currentRaw: Quaternion, nowMs: number): RotationEvent | null {
    if (nowMs - this.lastDetectionTime < COOLDOWN_MS) return null;

    const rel = new Quaternion()
      .copy(this.referenceQuat)
      .conjugate()
      .multiply(currentRaw);

    const angleRad = 2 * Math.acos(Math.min(1, Math.abs(rel.w)));
    const angleDeg = MathUtils.radToDeg(angleRad);

    if (angleDeg < MINANGLE_DEG) return null;

    const axis = dominantAxis(rel);
    if (!axis) return null;

    const snapped = snapAngle90(angleDeg);
    if (!snapped) return null;

    this.referenceQuat.copy(currentRaw);
    this.lastDetectionTime = nowMs;

    return {
      axis,
      direction: snapped.direction,
      timestamp: nowMs,
    };
  }
}
