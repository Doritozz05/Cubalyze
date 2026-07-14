import { BoxGeometry, MeshStandardMaterial, Color, Group, Mesh } from 'three';
import type { CubeFace } from '@cubeforge/types';

export interface CubeStyleOptions {
  coreColor: string;
  coreOpacity: number;
  stickerColors: {
    U: string;
    D: string;
    F: string;
    B: string;
    R: string;
    L: string;
  };
}

export const DEFAULT_STYLE: CubeStyleOptions = {
  coreColor: '#000000', // Pure black core for better contrast
  coreOpacity: 1.0,
  stickerColors: {
    U: '#ffffff', // White
    D: '#fff607', // Yellow
    F: '#08bc05', // Green
    B: '#0469ff', // Blue
    R: '#f80a0a', // Red
    L: '#ff7802', // Orange
  },
};

/**
 * Manages geometry and material pooling for the 27 cubies.
 * Uses a modular Group approach (Core + Stickers) for visual fidelity.
 */
export class CubeMeshFactory {
  private coreGeometry: BoxGeometry;
  private stickerGeometry: BoxGeometry;
  private coreMaterial!: MeshStandardMaterial;
  private stickerMaterials: Record<string, MeshStandardMaterial> = {};
  private style: CubeStyleOptions;

  constructor(style: CubeStyleOptions = DEFAULT_STYLE) {
    this.style = { ...style };
    
    // Core size 1.0 creates a completely flush cube with zero gaps
    this.coreGeometry = new BoxGeometry(1.0, 1.0, 1.0);
    
    // Stickers are thinner (0.02) and wider (0.88) for a thinner border
    this.stickerGeometry = new BoxGeometry(0.88, 0.88, 0.02);
    
    this.initMaterials();
  }

  private initMaterials(): void {
    const isTransparent = this.style.coreOpacity < 1.0;
    
    this.coreMaterial = new MeshStandardMaterial({ 
      color: new Color(this.style.coreColor), 
      roughness: 1.0,
      transparent: isTransparent,
      opacity: this.style.coreOpacity
    });

    for (const face of ['U', 'D', 'F', 'B', 'R', 'L'] as const) {
      this.stickerMaterials[face] = new MeshStandardMaterial({ 
        color: new Color(this.style.stickerColors[face]), 
        roughness: 1.0, // Fully matte (no shiny reflections)
        metalness: 0.0
      });
    }
  }

  /**
   * Creates a Group representing a single cubie with its core and applicable stickers.
   */
  public createCubieGroup(x: number, y: number, z: number): Group {
    const group = new Group();

    // 1. Add core
    const coreMesh = new Mesh(this.coreGeometry, this.coreMaterial);
    group.add(coreMesh);

    // 2. Add stickers based on exposed faces (with slight relief)
    // Core is 1.0 (radius 0.5). Sticker thickness is 0.02.
    // Placing sticker at 0.51 caused Z-fighting because 0.51 - (0.02/2) = 0.50 exactly.
    // Changing offset to 0.511 gives a 0.001 mathematical clearance, preventing Z-fighting completely.
    const offset = 0.511;

    if (x === 1) {
      const sticker = new Mesh(this.stickerGeometry, this.stickerMaterials['R']);
      sticker.position.set(offset, 0, 0);
      sticker.rotation.y = Math.PI / 2;
      group.add(sticker);
    }
    if (x === -1) {
      const sticker = new Mesh(this.stickerGeometry, this.stickerMaterials['L']);
      sticker.position.set(-offset, 0, 0);
      sticker.rotation.y = -Math.PI / 2;
      group.add(sticker);
    }
    if (y === 1) {
      const sticker = new Mesh(this.stickerGeometry, this.stickerMaterials['U']);
      sticker.position.set(0, offset, 0);
      sticker.rotation.x = -Math.PI / 2;
      group.add(sticker);
    }
    if (y === -1) {
      const sticker = new Mesh(this.stickerGeometry, this.stickerMaterials['D']);
      sticker.position.set(0, -offset, 0);
      sticker.rotation.x = Math.PI / 2;
      group.add(sticker);
    }
    if (z === 1) {
      const sticker = new Mesh(this.stickerGeometry, this.stickerMaterials['F']);
      sticker.position.set(0, 0, offset);
      group.add(sticker);
    }
    if (z === -1) {
      const sticker = new Mesh(this.stickerGeometry, this.stickerMaterials['B']);
      sticker.position.set(0, 0, -offset);
      sticker.rotation.y = Math.PI;
      group.add(sticker);
    }

    return group;
  }

  public setFaceColor(face: CubeFace | 'Inner', color: string): void {
    if (face === 'Inner') {
      this.coreMaterial.color.set(color);
      this.coreMaterial.needsUpdate = true;
    } else {
      const material = this.stickerMaterials[face];
      if (material) {
        material.color.set(color);
        material.needsUpdate = true;
      }
    }
  }

  public updateStyle(newStyle: Partial<CubeStyleOptions>): void {
    if (newStyle.coreColor !== undefined) {
      this.style.coreColor = newStyle.coreColor;
      this.setFaceColor('Inner', newStyle.coreColor);
    }
    
    if (newStyle.coreOpacity !== undefined) {
      this.style.coreOpacity = newStyle.coreOpacity;
      this.coreMaterial.opacity = newStyle.coreOpacity;
      this.coreMaterial.transparent = newStyle.coreOpacity < 1.0;
      this.coreMaterial.needsUpdate = true;
    }

    if (newStyle.stickerColors) {
      for (const [face, color] of Object.entries(newStyle.stickerColors)) {
        this.setFaceColor(face as CubeFace, color);
      }
      this.style.stickerColors = { ...this.style.stickerColors, ...newStyle.stickerColors };
    }
  }

  public setFaceEmissive(face: CubeFace | 'Inner', emissiveColor: string, intensity: number): void {
    const material = face === 'Inner' ? this.coreMaterial : this.stickerMaterials[face];
    if (material) {
      material.emissive.set(emissiveColor);
      material.emissiveIntensity = intensity;
      material.needsUpdate = true;
    }
  }

  public getStyle(): Readonly<CubeStyleOptions> {
    return { ...this.style };
  }

  public dispose(): void {
    this.coreGeometry.dispose();
    this.stickerGeometry.dispose();
    this.coreMaterial.dispose();
    Object.values(this.stickerMaterials).forEach(mat => mat.dispose());
  }
}

