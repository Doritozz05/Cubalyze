import { Group, Mesh } from 'three';
import { CubeMeshFactory } from './CubeMeshFactory';
import { parseFaceletsToCubies } from '@cubeforge/math-core';

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
  initialGridX: number;
  initialGridY: number;
  initialGridZ: number;
  /** Reference to the Three.js Group for rendering */
  mesh: Group;
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
    const spacing = 1.0; // Distance between cubie centers

    // Iterate x, y, z from -1 to 1 to build a 3x3x3 grid
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          const cubie = this.factory.createCubieGroup(x, y, z);
          cubie.position.set(x * spacing, y * spacing, z * spacing);

          this.cubies.push({
            gridX: x,
            gridY: y,
            gridZ: z,
            initialGridX: x,
            initialGridY: y,
            initialGridZ: z,
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
  public getCubiesByFace(axis: 'x' | 'y' | 'z', targetValue: number): Group[] {
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

    for (const cubie of this.cubies) {
      // Use Right-Handed cyclic logic to match the visual quaternion
      if (axis === 'x' && cubie.gridX !== layerValue) continue;
      if (axis === 'y' && cubie.gridY !== layerValue) continue;
      if (axis === 'z' && cubie.gridZ !== layerValue) continue;

      let a: number, b: number;
      // Standard cyclic permutation for Right-Handed (X: Y->Z, Y: Z->X, Z: X->Y)
      if (axis === 'x') { a = cubie.gridY; b = cubie.gridZ; }
      else if (axis === 'y') { a = cubie.gridZ; b = cubie.gridX; }
      else { a = cubie.gridX; b = cubie.gridY; }

      let newA: number, newB: number;
      if (turns === 1) {
        // +90°: (a, b) → (-b, a)
        newA = -b; newB = a;
      } else if (turns === 3) {
        // -90° (270°): (a, b) → (b, -a)
        newA = b; newB = -a;
      } else {
        // 180°: (a, b) → (-a, -b)
        newA = -a; newB = -b;
      }

      // Write results
      if (axis === 'x') { cubie.gridY = newA; cubie.gridZ = newB; }
      else if (axis === 'y') { cubie.gridZ = newA; cubie.gridX = newB; }
      else { cubie.gridX = newA; cubie.gridY = newB; }
    }
  }

  /**
   * Snaps all cubie mesh positions to the exact integer grid coordinates.
   *
   * CRITICAL FIX: Instead of rounding the floating-point position (which can drift),
   * we FORCE the position to match the logical grid state. This guarantees zero drift.
   */
  public snapCubiePositions(specificMeshes?: Group[]): void {
    const spacing = 1.0;
    const targets = specificMeshes 
      ? this.cubies.filter(c => specificMeshes.includes(c.mesh)) 
      : this.cubies;
      
    for (const cubie of targets) {
      cubie.mesh.position.set(
        cubie.gridX * spacing,
        cubie.gridY * spacing,
        cubie.gridZ * spacing
      );
      // Normalize local quaternion to prevent scale degradation
      cubie.mesh.quaternion.normalize();
    }
  }

  public getAllCubies(): Group[] {
    return this.cubies.map((c) => c.mesh);
  }

  /**
   * Resets the logical state and visual orientation of all cubies to the solved state.
   */
  public resetCube(): void {
    for (const cubie of this.cubies) {
      cubie.gridX = cubie.initialGridX;
      cubie.gridY = cubie.initialGridY;
      cubie.gridZ = cubie.initialGridZ;
      cubie.mesh.quaternion.identity();
    }
    this.snapCubiePositions();
  }

  /**
   * Snaps the 3D cube to a specific physical state using a 54-char facelet string.
   */
  public applyFacelets(facelets: string): void {
    try {
      const parsed = parseFaceletsToCubies(facelets);
      for (const p of parsed) {
        const cubie = this.cubies.find(c => 
          c.initialGridX === p.initialX && 
          c.initialGridY === p.initialY && 
          c.initialGridZ === p.initialZ
        );
        if (cubie) {
          cubie.gridX = p.currX;
          cubie.gridY = p.currY;
          cubie.gridZ = p.currZ;
          cubie.mesh.quaternion.copy(p.quaternion as any);
        }
      }
      this.snapCubiePositions();
    } catch (e) {
      console.error('Failed to apply facelets:', e);
    }
  }

  public getLogicalState(): ReadonlyArray<Readonly<CubieLogicalState>> {
    return this.cubies;
  }
}

