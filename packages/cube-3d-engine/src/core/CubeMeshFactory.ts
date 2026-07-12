import { BoxGeometry, MeshStandardMaterial, Color } from 'three';
import type { CubeFace } from '@cubeforge/types';

export interface CubeStyleOptions {
  borderless: boolean;
  colors: {
    U: string;
    D: string;
    F: string;
    B: string;
    R: string;
    L: string;
    Inner: string;
  };
}

export const DEFAULT_STYLE: CubeStyleOptions = {
  borderless: false,
  colors: {
    U: '#ffffff', // White
    D: '#ffd500', // Yellow
    F: '#009e60', // Green
    B: '#0051ba', // Blue
    R: '#c41e3a', // Red
    L: '#ff5800', // Orange
    Inner: '#111111', // Black plastic
  },
};

/**
 * Manages geometry and material pooling for the 27 cubies.
 *
 * PRD Part 6.2 requires dynamic visual customization:
 * - Change face colors at runtime (themes, color-blind mode)
 * - Highlight specific cubies or edges (analysis overlays)
 * - Update global style without recreating the scene graph
 */
export class CubeMeshFactory {
  private geometry: BoxGeometry;
  private materials: Record<string, MeshStandardMaterial> = {};
  private style: CubeStyleOptions;

  constructor(style: CubeStyleOptions = DEFAULT_STYLE) {
    this.style = { ...style };
    // Single shared geometry for all 27 cubies to pool memory
    const size = this.style.borderless ? 1.0 : 0.95;
    this.geometry = new BoxGeometry(size, size, size);
    this.initMaterials();
  }

  private initMaterials(): void {
    // We create materials for the 6 faces and the inner plastic
    this.materials['U'] = new MeshStandardMaterial({ color: new Color(this.style.colors.U), roughness: 0.2 });
    this.materials['D'] = new MeshStandardMaterial({ color: new Color(this.style.colors.D), roughness: 0.2 });
    this.materials['F'] = new MeshStandardMaterial({ color: new Color(this.style.colors.F), roughness: 0.2 });
    this.materials['B'] = new MeshStandardMaterial({ color: new Color(this.style.colors.B), roughness: 0.2 });
    this.materials['R'] = new MeshStandardMaterial({ color: new Color(this.style.colors.R), roughness: 0.2 });
    this.materials['L'] = new MeshStandardMaterial({ color: new Color(this.style.colors.L), roughness: 0.2 });
    this.materials['Inner'] = new MeshStandardMaterial({ color: new Color(this.style.colors.Inner), roughness: 0.6 });
  }

  public getGeometry(): BoxGeometry {
    return this.geometry;
  }

  /**
   * Returns an array of 6 materials for a Box mesh [right, left, top, bottom, front, back]
   * depending on its physical position in the 3x3x3 grid.
   */
  public getMaterialsForCubie(x: number, y: number, z: number): MeshStandardMaterial[] {
    // Array order for BoxGeometry:
    // 0: Right (x=1)
    // 1: Left (x=-1)
    // 2: Top (y=1)
    // 3: Bottom (y=-1)
    // 4: Front (z=1)
    // 5: Back (z=-1)
    
    return [
      x === 1 ? this.materials['R'] : this.materials['Inner'],
      x === -1 ? this.materials['L'] : this.materials['Inner'],
      y === 1 ? this.materials['U'] : this.materials['Inner'],
      y === -1 ? this.materials['D'] : this.materials['Inner'],
      z === 1 ? this.materials['F'] : this.materials['Inner'],
      z === -1 ? this.materials['B'] : this.materials['Inner'],
    ];
  }

  // ─── Dynamic Visual API (PRD Part 6.2 Compliance) ───────────────────────

  /**
   * Changes the color of a specific face at runtime.
   * Since materials are shared (pooled), this instantly affects all cubies
   * that have this face exposed — no scene graph traversal needed.
   *
   * @example factory.setFaceColor('U', '#ff0000') // Turn the top face red
   */
  public setFaceColor(face: CubeFace | 'Inner', color: string): void {
    const material = this.materials[face];
    if (material) {
      material.color.set(color);
      material.needsUpdate = true;
    }
  }

  /**
   * Applies a complete new style (all face colors and border mode).
   * Does NOT recreate geometry — only updates material colors.
   *
   * @example factory.updateStyle({ ...DEFAULT_STYLE, colors: { ...DEFAULT_STYLE.colors, U: '#ff69b4' } })
   */
  public updateStyle(newStyle: Partial<CubeStyleOptions>): void {
    if (newStyle.colors) {
      for (const [face, color] of Object.entries(newStyle.colors)) {
        this.setFaceColor(face as CubeFace | 'Inner', color);
      }
      this.style.colors = { ...this.style.colors, ...newStyle.colors };
    }
  }

  /**
   * Sets the emissive (glow) color and intensity on a specific face's material.
   * Useful for highlighting specific edges or layers during analysis overlays.
   *
   * @example factory.setFaceEmissive('R', '#ff0000', 0.3) // Subtle red glow on right face
   * @example factory.setFaceEmissive('R', '#000000', 0)   // Remove highlight
   */
  public setFaceEmissive(face: CubeFace | 'Inner', emissiveColor: string, intensity: number): void {
    const material = this.materials[face];
    if (material) {
      material.emissive.set(emissiveColor);
      material.emissiveIntensity = intensity;
      material.needsUpdate = true;
    }
  }

  /**
   * Returns the current style configuration (read-only snapshot).
   */
  public getStyle(): Readonly<CubeStyleOptions> {
    return { ...this.style };
  }

  public dispose(): void {
    this.geometry.dispose();
    Object.values(this.materials).forEach(mat => mat.dispose());
  }
}
