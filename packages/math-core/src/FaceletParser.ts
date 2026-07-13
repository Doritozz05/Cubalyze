import { Vector3, Quaternion } from 'three';

// Standard Kociemba facelet layout
// U1..9 (0-8), R1..9 (9-17), F1..9 (18-26), D1..9 (27-35), L1..9 (36-44), B1..9 (45-53)
const FACELET_OFFSETS = {
  U: 0, R: 9, F: 18, D: 27, L: 36, B: 45
};

// Maps (x, y, z) on a specific face to a 0-8 index.
function getFaceletIndex(face: string, x: number, y: number, z: number): number {
  let row = 0;
  let col = 0;
  switch (face) {
    case 'U': // Top face. viewed from above, top is B (z=-1), left is L (x=-1)
      row = z === -1 ? 0 : z === 0 ? 1 : 2;
      col = x === -1 ? 0 : x === 0 ? 1 : 2;
      break;
    case 'D': // Bottom face. viewed from below, top is F (z=1), left is L (x=-1)
      row = z === 1 ? 0 : z === 0 ? 1 : 2;
      col = x === -1 ? 0 : x === 0 ? 1 : 2;
      break;
    case 'F': // Front face. top is U (y=1), left is L (x=-1)
      row = y === 1 ? 0 : y === 0 ? 1 : 2;
      col = x === -1 ? 0 : x === 0 ? 1 : 2;
      break;
    case 'B': // Back face. top is U (y=1), left is R (x=1)
      row = y === 1 ? 0 : y === 0 ? 1 : 2;
      col = x === 1 ? 0 : x === 0 ? 1 : 2;
      break;
    case 'L': // Left face. top is U (y=1), left is B (z=-1)
      row = y === 1 ? 0 : y === 0 ? 1 : 2;
      col = z === -1 ? 0 : z === 0 ? 1 : 2;
      break;
    case 'R': // Right face. top is U (y=1), left is F (z=1)
      row = y === 1 ? 0 : y === 0 ? 1 : 2;
      col = z === 1 ? 0 : z === 0 ? 1 : 2;
      break;
  }
  return FACELET_OFFSETS[face as keyof typeof FACELET_OFFSETS] + (row * 3 + col);
}

export interface ParsedCubie {
  currX: number;
  currY: number;
  currZ: number;
  initialX: number;
  initialY: number;
  initialZ: number;
  quaternion: Quaternion;
}

export function parseFaceletsToCubies(facelets: string): ParsedCubie[] {
  if (facelets.length !== 54) {
    throw new Error('Invalid facelets string length');
  }

  // 1. Identify center colors to map colors to faces
  const colorToFace: Record<string, string> = {
    [facelets[getFaceletIndex('U', 0, 0, 0)]]: 'U',
    [facelets[getFaceletIndex('D', 0, 0, 0)]]: 'D',
    [facelets[getFaceletIndex('F', 0, 0, 0)]]: 'F',
    [facelets[getFaceletIndex('B', 0, 0, 0)]]: 'B',
    [facelets[getFaceletIndex('L', 0, 0, 0)]]: 'L',
    [facelets[getFaceletIndex('R', 0, 0, 0)]]: 'R',
  };

  const faceToAxis: Record<string, Vector3> = {
    'U': new Vector3(0, 1, 0),
    'D': new Vector3(0, -1, 0),
    'F': new Vector3(0, 0, 1),
    'B': new Vector3(0, 0, -1),
    'L': new Vector3(-1, 0, 0),
    'R': new Vector3(1, 0, 0),
  };

  const parsedCubies: ParsedCubie[] = [];

  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        if (x === 0 && y === 0 && z === 0) continue;

        const currentFaces: string[] = [];
        const currentAxes: Vector3[] = [];
        const originalAxes: Vector3[] = [];

        if (y === 1) currentFaces.push('U');
        if (y === -1) currentFaces.push('D');
        if (x === 1) currentFaces.push('R');
        if (x === -1) currentFaces.push('L');
        if (z === 1) currentFaces.push('F');
        if (z === -1) currentFaces.push('B');

        let initialX = 0, initialY = 0, initialZ = 0;
        
        for (const face of currentFaces) {
          const idx = getFaceletIndex(face, x, y, z);
          const color = facelets[idx];
          const originalFace = colorToFace[color];
          
          if (!originalFace) {
            console.warn(`Unmapped color ${color} at index ${idx}`);
            continue;
          }
          
          currentAxes.push(faceToAxis[face].clone());
          originalAxes.push(faceToAxis[originalFace].clone());

          if (originalFace === 'R') initialX = 1;
          if (originalFace === 'L') initialX = -1;
          if (originalFace === 'U') initialY = 1;
          if (originalFace === 'D') initialY = -1;
          if (originalFace === 'F') initialZ = 1;
          if (originalFace === 'B') initialZ = -1;
        }

        const q = new Quaternion();
        
        if (originalAxes.length === 1) {
          q.setFromUnitVectors(originalAxes[0], currentAxes[0]);
        } else if (originalAxes.length >= 2) {
          const q1 = new Quaternion().setFromUnitVectors(originalAxes[0], currentAxes[0]);
          const alignedSecondOrig = originalAxes[1].clone().applyQuaternion(q1);
          const q2 = new Quaternion().setFromUnitVectors(alignedSecondOrig, currentAxes[1]);
          q.multiplyQuaternions(q2, q1);
        }

        parsedCubies.push({
          currX: x,
          currY: y,
          currZ: z,
          initialX,
          initialY,
          initialZ,
          quaternion: q
        });
      }
    }
  }

  return parsedCubies;
}
