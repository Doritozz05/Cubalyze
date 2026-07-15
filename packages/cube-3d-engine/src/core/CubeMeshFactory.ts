import { BoxGeometry, MeshStandardMaterial, Color, Group, Mesh, Shape, ExtrudeGeometry } from 'three';
import { RoundedBoxGeometry } from 'three-stdlib';
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
  coreColor: '#1a1a1a',
  coreOpacity: 1.0,
  stickerColors: {
    U: '#ece8e2',
    D: '#ffe62a',
    F: '#1abe57',
    B: '#3d7ce0',
    R: '#eb4242',
    L: '#ff801f',
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
    
    // Core 1.0 = no gap between cubies (spacing is 1.0), subtle rounding
    this.coreGeometry = new RoundedBoxGeometry(1.0, 1.0, 1.0, 6, 0.05) as unknown as BoxGeometry;
    
    // Stickers: custom rounded-rect extrusion (RoundedBoxGeometry clamps radius to thickness/2)
    this.stickerGeometry = this.createRoundedStickerGeometry(0.84, 0.84, 0.002, 0.06);
    
    this.initMaterials();
  }

  private createRoundedStickerGeometry(w: number, h: number, depth: number, r: number): BoxGeometry {
    const shape = new Shape();
    const hw = w / 2;
    const hh = h / 2;
    const cr = Math.min(r, hw, hh);
    
    shape.moveTo(-hw + cr, -hh);
    shape.lineTo(hw - cr, -hh);
    shape.quadraticCurveTo(hw, -hh, hw, -hh + cr);
    shape.lineTo(hw, hh - cr);
    shape.quadraticCurveTo(hw, hh, hw - cr, hh);
    shape.lineTo(-hw + cr, hh);
    shape.quadraticCurveTo(-hw, hh, -hw, hh - cr);
    shape.lineTo(-hw, -hh + cr);
    shape.quadraticCurveTo(-hw, -hh, -hw + cr, -hh);
    
    const geo = new ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelThickness: 0.015,
      bevelSize: 0.008,
      bevelSegments: 6,
    });
    geo.translate(0, 0, -depth / 2);
    return geo as unknown as BoxGeometry;
  }

  private initMaterials(): void {
    const isTransparent = this.style.coreOpacity < 1.0;
    
    this.coreMaterial = new MeshStandardMaterial({ 
      color: new Color(this.style.coreColor), 
      roughness: 1.0,
      metalness: 0.0,
      transparent: isTransparent,
      opacity: this.style.coreOpacity
    });

    for (const face of ['U', 'D', 'F', 'B', 'R', 'L'] as const) {
      this.stickerMaterials[face] = new MeshStandardMaterial({ 
        color: new Color(this.style.stickerColors[face]), 
        roughness: 1.0,
        metalness: 0.0,
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

    // 2. Add stickers based on exposed faces
    // Core is 1.0 (radius 0.5). Sticker extends ±0.001 from center.
    // Offset 0.5015 puts sticker surface at 0.5025 = 0.0025 past core.
    const offset = 0.5015;

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

