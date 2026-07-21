import { BoxGeometry, MeshStandardMaterial, MeshBasicMaterial, Color, Group, Mesh, Shape, ShapeGeometry } from 'three';
import { RoundedBoxGeometry } from 'three-stdlib';
import type { CubeFace } from '@cubeforge/types';

export interface CubeStyleOptions {
  skinType?: 'stickered' | 'stickerless';
  coreColor: string;
  coreOpacity: number;
  stickerSize?: number;
  stickerRadius?: number;
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
  skinType: 'stickered',
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
  private stickerGeometry: ShapeGeometry;
  private coreMaterial!: MeshStandardMaterial;
  private stickerMaterials: Record<string, MeshBasicMaterial> = {};
  private stickerlessMaterials: Record<string, MeshStandardMaterial> = {};
  private stickerMeshes: Mesh[] = [];
  private coreMeshes: { mesh: Mesh; x: number; y: number; z: number }[] = [];
  private style: CubeStyleOptions;

  constructor(style: CubeStyleOptions = DEFAULT_STYLE) {
    this.style = { ...style };
    
    // Core 1.0 = no gap between cubies (spacing is 1.0), subtle rounding
    this.coreGeometry = new RoundedBoxGeometry(1.0, 1.0, 1.0, 6, 0.05) as unknown as BoxGeometry;
    
    // Stickers: flat rounded-rect ShapeGeometry — completely flush with the cube surface
    const size = this.style.stickerSize ?? 0.84;
    const radius = this.style.stickerRadius ?? 0.06;
    this.stickerGeometry = this.createRoundedStickerGeometry(size, size, radius);
    
    this.initMaterials();
  }

  private createRoundedStickerGeometry(w: number, h: number, r: number): ShapeGeometry {
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
    
    return new ShapeGeometry(shape);
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
      this.stickerMaterials[face] = new MeshBasicMaterial({ 
        color: new Color(this.style.stickerColors[face]), 
      });
      this.stickerlessMaterials[face] = new MeshStandardMaterial({ 
        color: new Color(this.style.stickerColors[face]), 
        roughness: 1.0,
        metalness: 0.0,
      });
    }
  }

  private getCoreMaterials(x: number, y: number, z: number) {
    if (this.style.skinType !== 'stickerless') {
      return this.coreMaterial;
    }
    return [
      x === 1 ? this.stickerlessMaterials['R'] : this.coreMaterial,  // 0: +x
      x === -1 ? this.stickerlessMaterials['L'] : this.coreMaterial, // 1: -x
      y === 1 ? this.stickerlessMaterials['U'] : this.coreMaterial,  // 2: +y
      y === -1 ? this.stickerlessMaterials['D'] : this.coreMaterial, // 3: -y
      z === 1 ? this.stickerlessMaterials['F'] : this.coreMaterial,  // 4: +z
      z === -1 ? this.stickerlessMaterials['B'] : this.coreMaterial, // 5: -z
    ];
  }

  /**
   * Creates a Group representing a single cubie with its core and applicable stickers.
   */
  public createCubieGroup(x: number, y: number, z: number): Group {
    const group = new Group();

    // 1. Add core
    const coreMesh = new Mesh(this.coreGeometry, this.getCoreMaterials(x, y, z));
    group.add(coreMesh);
    this.coreMeshes.push({ mesh: coreMesh, x, y, z });

    // 2. Add stickers based on exposed faces
    // Core is 1.0 (radius 0.5). Stickers are flat ShapeGeometry, positioned
    // at 0.5001 — a 0.0001 epsilon above the core surface to avoid z-fighting
    // while appearing completely flush.
    const offset = 0.5001;
    const stickerVisible = this.style.skinType !== 'stickerless';

    if (x === 1) {
      const sticker = new Mesh(this.stickerGeometry, this.stickerMaterials['R']);
      sticker.position.set(offset, 0, 0);
      sticker.rotation.y = Math.PI / 2;
      sticker.visible = stickerVisible;
      group.add(sticker);
      this.stickerMeshes.push(sticker);
    }
    if (x === -1) {
      const sticker = new Mesh(this.stickerGeometry, this.stickerMaterials['L']);
      sticker.position.set(-offset, 0, 0);
      sticker.rotation.y = -Math.PI / 2;
      sticker.visible = stickerVisible;
      group.add(sticker);
      this.stickerMeshes.push(sticker);
    }
    if (y === 1) {
      const sticker = new Mesh(this.stickerGeometry, this.stickerMaterials['U']);
      sticker.position.set(0, offset, 0);
      sticker.rotation.x = -Math.PI / 2;
      sticker.visible = stickerVisible;
      group.add(sticker);
      this.stickerMeshes.push(sticker);
    }
    if (y === -1) {
      const sticker = new Mesh(this.stickerGeometry, this.stickerMaterials['D']);
      sticker.position.set(0, -offset, 0);
      sticker.rotation.x = Math.PI / 2;
      sticker.visible = stickerVisible;
      group.add(sticker);
      this.stickerMeshes.push(sticker);
    }
    if (z === 1) {
      const sticker = new Mesh(this.stickerGeometry, this.stickerMaterials['F']);
      sticker.position.set(0, 0, offset);
      sticker.visible = stickerVisible;
      group.add(sticker);
      this.stickerMeshes.push(sticker);
    }
    if (z === -1) {
      const sticker = new Mesh(this.stickerGeometry, this.stickerMaterials['B']);
      sticker.position.set(0, 0, -offset);
      sticker.rotation.y = Math.PI;
      sticker.visible = stickerVisible;
      group.add(sticker);
      this.stickerMeshes.push(sticker);
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
      const stickerlessMat = this.stickerlessMaterials[face];
      if (stickerlessMat) {
        stickerlessMat.color.set(color);
        stickerlessMat.needsUpdate = true;
      }
    }
  }

  public updateStyle(newStyle: Partial<CubeStyleOptions>): void {
    let skinTypeChanged = false;
    if (newStyle.skinType !== undefined && newStyle.skinType !== this.style.skinType) {
      this.style.skinType = newStyle.skinType;
      skinTypeChanged = true;
    }

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

    if (skinTypeChanged) {
      const stickerVisible = this.style.skinType !== 'stickerless';
      for (const sm of this.stickerMeshes) {
        sm.visible = stickerVisible;
      }
      for (const cm of this.coreMeshes) {
        cm.mesh.material = this.getCoreMaterials(cm.x, cm.y, cm.z);
      }
    }

    let geometryNeedsUpdate = false;
    if (newStyle.stickerSize !== undefined && newStyle.stickerSize !== this.style.stickerSize) {
      this.style.stickerSize = newStyle.stickerSize;
      geometryNeedsUpdate = true;
    }
    if (newStyle.stickerRadius !== undefined && newStyle.stickerRadius !== this.style.stickerRadius) {
      this.style.stickerRadius = newStyle.stickerRadius;
      geometryNeedsUpdate = true;
    }

    if (geometryNeedsUpdate) {
      this.stickerGeometry.dispose();
      const size = this.style.stickerSize ?? 0.84;
      const radius = this.style.stickerRadius ?? 0.06;
      this.stickerGeometry = this.createRoundedStickerGeometry(size, size, radius);
      
      // Update geometry of all existing sticker meshes
      for (const mesh of this.stickerMeshes) {
        mesh.geometry = this.stickerGeometry;
      }
    }
  }

  public setFaceEmissive(face: CubeFace | 'Inner', emissiveColor: string, intensity: number): void {
    if (face === 'Inner') {
      this.coreMaterial.emissive.set(emissiveColor);
      this.coreMaterial.emissiveIntensity = intensity;
      this.coreMaterial.needsUpdate = true;
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
    Object.values(this.stickerlessMaterials).forEach(mat => mat.dispose());
    this.stickerMeshes = [];
    this.coreMeshes = [];
  }
}

