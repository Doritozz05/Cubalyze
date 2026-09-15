import type { CubeFace, FaceRotationMapping } from '@cubalyze/types';

export const FACE_ROTATION_MAP: Record<CubeFace, FaceRotationMapping> = {
  U: { axis: 'y', layerValue:  1, angleSign: -1 },
  D: { axis: 'y', layerValue: -1, angleSign:  1 },
  R: { axis: 'x', layerValue:  1, angleSign: -1 },
  L: { axis: 'x', layerValue: -1, angleSign:  1 },
  F: { axis: 'z', layerValue:  1, angleSign: -1 },
  B: { axis: 'z', layerValue: -1, angleSign:  1 },
  // Slice turns animate the MIDDLE layer (layerValue 0). The sign follows
  // the adjacent-face convention from MoveExpander (r = R M', u = U E',
  // f = F S): M turns like L, E like D, S like F.
  M: { axis: 'x', layerValue:  0, angleSign:  1 },
  E: { axis: 'y', layerValue:  0, angleSign:  1 },
  S: { axis: 'z', layerValue:  0, angleSign: -1 },
};
