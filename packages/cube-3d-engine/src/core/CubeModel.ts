import { Group, Mesh } from 'three';
import { CubeMeshFactory } from './CubeMeshFactory';

export class CubeModel {
  public root: Group;
  private cubies: Mesh[] = [];
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
          
          // Store physical grid coordinates as userData so we can find them later
          cubie.userData = { originalPos: { x, y, z } };
          
          this.cubies.push(cubie);
          this.root.add(cubie);
        }
      }
    }
  }

  /**
   * Selects all cubies belonging to a specific face layer.
   * Tolerates floating point inaccuracies.
   */
  public getCubiesByFace(axis: 'x' | 'y' | 'z', targetValue: number): Mesh[] {
    const EPSILON = 0.1;
    return this.cubies.filter((cubie) => {
      // We must check global position relative to the root group,
      // but since cubies are attached directly to the root, cubie.position works
      // UNLESS they are mid-rotation, which RotationEngine handles.
      return Math.abs(cubie.position[axis] - targetValue) < EPSILON;
    });
  }

  public getAllCubies(): Mesh[] {
    return this.cubies;
  }
}
