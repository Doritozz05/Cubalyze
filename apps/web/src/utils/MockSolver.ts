import { ISolver, CubeState } from "@cubeforge/math-core";

const FACES = ["U", "D", "L", "R", "F", "B"];
const MODS = ["", "'", "2"];

/**
 * A temporary dummy solver that generates a sequence of 20 random moves
 * until the real min2phase solver (Fase 4.3) is integrated.
 * This is used to test the UI flow and scramble generation visually.
 */
export class MockSolver implements ISolver {
  solve(state: CubeState): string {
    const moves: string[] = [];
    let lastFace = -1;
    for (let i = 0; i < 20; i++) {
      let face;
      do {
        face = Math.floor(Math.random() * FACES.length);
      } while (face === lastFace);
      lastFace = face;
      const mod = MODS[Math.floor(Math.random() * MODS.length)];
      moves.push(`${FACES[face]}${mod}`);
    }
    return moves.join(" ");
  }
}
