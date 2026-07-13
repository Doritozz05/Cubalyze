import type { CubeFace, FaceRotationMapping } from '@cubeforge/types';

export const FACE_ROTATION_MAP: Record<CubeFace, FaceRotationMapping> = {
  U: { axis: 'y', layerValue:  1, angleSign: -1 },
  D: { axis: 'y', layerValue: -1, angleSign:  1 },
  R: { axis: 'x', layerValue:  1, angleSign: -1 },
  L: { axis: 'x', layerValue: -1, angleSign:  1 },
  F: { axis: 'z', layerValue:  1, angleSign: -1 },
  B: { axis: 'z', layerValue: -1, angleSign:  1 },
};
