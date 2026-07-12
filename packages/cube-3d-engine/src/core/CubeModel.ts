import { Group, Mesh } from 'three';
import { CubeMeshFactory } from './CubeMeshFactory';

/**
 * Logical state of one cubie in the 3x3x3 grid.
 * This is INDEPENDENT of the scene graph and cannot be corrupted by
 * floating-point errors in rendering — exactly like SebLague's CubeState.
 */
export interface CubieLogicalState {
  /** Current grid position (always integers: -1, 0, or 1) */
  gridX: number;
  gridY: number;
  gridZ: number;
  /** Reference to the Three.js Mesh for rendering */
  mesh: Mesh;
}

export class CubeModel {
  public root: Group;
  private cubies: CubieLogicalState[] = [];
  private factory: CubeMeshFactory;

  constructor(factory: CubeMeshFactory) {
    this.root = new Group();
    this.factory = factory;
    this.buildCubies();
  }

  private buildCubies(): void {
    const geometry = this.factory.getGeometry();
    const spacing = 1.0; // Distance between cubie centers

    // Iterate x, y, z from -1 to 1 to build a 3x3x3 grid
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          const materials = this.factory.getMaterialsForCubie(x, y, z);
          const cubie = new Mesh(geometry, materials);
          cubie.position.set(x * spacing, y * spacing, z * spacing);
          
          this.cubies.push({
            gridX: x,
            gridY: y,
            gridZ: z,
            mesh: cubie,
          });

          this.root.add(cubie);
        }
      }
    }
  }

  /**
   * Selects all cubies belonging to a specific face layer.
   *
   * CRITICAL FIX: Uses the logical grid state (integer coordinates) instead
   * of floating-point mesh positions. This is immune to floating-point drift
   * caused by repeated attach/detach reparenting during rotations.
   */
  public getCubiesByFace(axis: 'x' | 'y' | 'z', targetValue: number): Mesh[] {
    const gridKey = axis === 'x' ? 'gridX' : axis === 'y' ? 'gridY' : 'gridZ';
    return this.cubies
      .filter((c) => c[gridKey] === targetValue)
      .map((c) => c.mesh);
  }

  /**
   * Updates the logical grid positions after a 90° or 180° layer rotation.
   *
   * When a layer on axis A with value V rotates by `quarterTurns` (1, -1, or 2),
   * the two non-A coordinates of each cubie in that layer are permuted.
   *
   * For a +90° rotation around +Y: (x, z) → (-z, x)
   * For a -90° rotation around +Y: (x, z) → (z, -x)
   * For 180°: (x, z) → (-x, -z)
   *
   * This is pure integer arithmetic — zero floating-point risk.
   */
  public updateLogicalState(axis: 'x' | 'y' | 'z', layerValue: number, quarterTurns: number): void {
    // Normalize to 1, -1, or 2 quarter turns
    const turns = ((quarterTurns % 4) + 4) % 4; // Normalize to 0-3
    if (turns === 0) return;

    const gridKey = axis === 'x' ? 'gridX' : axis === 'y' ? 'gridY' : 'gridZ';

    for (const cubie of this.cubies) {
      if (cubie[gridKey] !== layerValue) continue;

      // Get the two axes perpendicular to the rotation axis
      let a: number, b: number;
      if (axis === 'x') { a = cubie.gridY; b = cubie.gridZ; }
      else if (axis === 'y') { a = cubie.gridX; b = cubie.gridZ; }
      else { a = cubie.gridX; b = cubie.gridY; }

      // Apply rotation permutation (right-hand rule around positive axis)
      let newA: number, newB: number;
      if (turns === 1) {
        // +90° (CW looking from +axis): (a, b) → (-b, a)
        newA = -b; newB = a;
      } else if (turns === 3) {
        // -90° (CCW / 270°): (a, b) → (b, -a)
        newA = b; newB = -a;
      } else {
        // 180°: (a, b) → (-a, -b)
        newA = -a; newB = -b;
      }

      // Write back to the correct axes
      if (axis === 'x') { cubie.gridY = newA; cubie.gridZ = newB; }
      else if (axis === 'y') { cubie.gridX = newA; cubie.gridZ = newB; }
      else { cubie.gridX = newA; cubie.gridY = newB; }
    }
  }

  /**
   * Snaps all cubie mesh positions to the nearest integer grid coordinates.
   *
   * CRITICAL FIX: After Three.js's Object3D.attach() preserves world transforms,
   * positions accumulate floating-point error (e.g. 0.99998 instead of 1.0).
   * This method rounds them back to clean integers, preventing the drift that
   * causes getCubiesByFace() to "lose" cubies after multiple rotations.
   *
   * This is the same technique used by Sebastian Lague in his Unity implementation.
   */
  public snapCubiePositions(): void {
    for (const cubie of this.cubies) {
      cubie.mesh.position.x = Math.round(cubie.mesh.position.x);
      cubie.mesh.position.y = Math.round(cubie.mesh.position.y);
      cubie.mesh.position.z = Math.round(cubie.mesh.position.z);
    }
  }

  public getAllCubies(): Mesh[] {
    return this.cubies.map((c) => c.mesh);
  }

  public getLogicalState(): ReadonlyArray<Readonly<CubieLogicalState>> {
    return this.cubies;
  }
}
