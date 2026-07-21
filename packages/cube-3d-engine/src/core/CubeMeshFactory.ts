import {
  BoxGeometry,
  MeshStandardMaterial,
  MeshBasicMaterial,
  Color,
  Group,
  Mesh,
  Material,
  Shape,
  ShapeGeometry,
} from 'three';
import { RoundedBoxGeometry } from 'three-stdlib';
import type { CubeFace } from '@cubeforge/types';

export interface CubeStyleOptions {
  /** Visual strategy: classic stickers, solid colored plastic, or floating panels */
  skinType?: 'stickered' | 'stickerless' | 'coreless';
  /** Core body color (used in stickered mode and as fallback) */
  coreColor: string;
  /** Core opacity — < 1 enables transparency */
  coreOpacity: number;
  /**
   * Color of internal / non-exposed faces in stickerless mode.
   * Simulates the dark ABS plastic seam between colored pieces.
   * Default: #2a2a2a
   */
  seamColor?: string;
  /**
   * Scale factor for cubie core in stickerless mode (default 0.97).
   * A value < 1 creates subtle physical gaps between pieces,
   * mimicking the tactile separation of real speedcube pieces.
   * Ignored in stickered and coreless modes (always 1.0).
   */
  cubieSize?: number;
  /** Width/height of sticker panels (default 0.84) */
  stickerSize?: number;
  /** Corner radius of sticker panels (default 0.06) */
  stickerRadius?: number;
  /** Color hex strings for each face (WCA convention) */
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
 *
 * ## Architecture
 *
 * Each cubie is a `Group` containing:
 * - **Core mesh**: a `RoundedBoxGeometry` that represents the physical body.
 *   Its material strategy depends on `skinType`:
 *   - `stickered`:   single black/dark `MeshStandardMaterial`
 *   - `stickerless`: array of 6 `MeshStandardMaterial` — exposed faces get
 *                    the colored plastic material, internal faces get `seamColor`
 *   - `coreless`:    single material, but the mesh is hidden
 *
 * - **Sticker meshes** (0–3 per cubie): flat rounded-rect `ShapeGeometry` panels
 *   on exposed faces. Visible in `stickered` and `coreless`, hidden in `stickerless`.
 *
 * ### Stickerless visual gaps
 *
 * For `stickerless`, the core mesh is **scaled down** (default 0.97) so adjacent
 * cubies no longer touch — the round edges combine with the `seamColor` internal
 * faces to create natural-looking seams, exactly like a premium speedcube.
 *
 * ### Coreless
 *
 * Core mesh hidden, stickers visible → floating colored panels (digital cube aesthetic).
 */
export class CubeMeshFactory {
  private coreGeometry: BoxGeometry;
  private stickerGeometry: ShapeGeometry;
  private coreMaterial!: MeshStandardMaterial;
  private seamMaterial!: MeshStandardMaterial;
  private stickerMaterials: Record<string, MeshBasicMaterial> = {};
  private stickerlessFaceMaterials: Record<string, MeshStandardMaterial> = {};
  private stickerMeshes: Mesh[] = [];
  /** Track all core meshes so we can update material/scale/visibility at runtime */
  private coreMeshes: { mesh: Mesh; x: number; y: number; z: number }[] = [];
  private style: CubeStyleOptions;

  constructor(style: CubeStyleOptions = DEFAULT_STYLE) {
    this.style = { ...style };

    // Core 1.0 = unit size. Gaps are created via mesh.scale for stickerless.
    this.coreGeometry = new RoundedBoxGeometry(
      1.0,
      1.0,
      1.0,
      6,
      0.05,
    ) as unknown as BoxGeometry;

    // Stickers: flat rounded-rect panels
    const size = this.style.stickerSize ?? 0.84;
    const radius = this.style.stickerRadius ?? 0.06;
    this.stickerGeometry = this.createRoundedStickerGeometry(size, size, radius);

    this.initMaterials();
  }

  // ───────────────────────────────────────────────────────────────────────
  //  Geometry helpers
  // ───────────────────────────────────────────────────────────────────────

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

  // ───────────────────────────────────────────────────────────────────────
  //  Material pool
  // ───────────────────────────────────────────────────────────────────────

  private initMaterials(): void {
    const isTransparent = this.style.coreOpacity < 1.0;

    // Core material: used for stickered (solid black) and coreless (hidden)
    this.coreMaterial = new MeshStandardMaterial({
      color: new Color(this.style.coreColor),
      roughness: 1.0,
      metalness: 0.0,
      transparent: isTransparent,
      opacity: this.style.coreOpacity,
    });

    // Seam material: dark internal faces for stickerless gaps
    this.seamMaterial = new MeshStandardMaterial({
      color: new Color(this.style.seamColor ?? '#2a2a2a'),
      roughness: 1.0,
      metalness: 0.0,
    });

    for (const face of ['U', 'D', 'F', 'B', 'R', 'L'] as const) {
      // Sticker panels (stickered + coreless) — unlit for pure color
      this.stickerMaterials[face] = new MeshBasicMaterial({
        color: new Color(this.style.stickerColors[face]),
      });

      // Colored plastic faces (stickerless exposed faces) — lit for depth
      this.stickerlessFaceMaterials[face] = new MeshStandardMaterial({
        color: new Color(this.style.stickerColors[face]),
        roughness: 0.55,
        metalness: 0.08,
      });
    }
  }

  /**
   * Returns the material(s) for a cubie core at position (x, y, z).
   *
   * - `stickered` / `coreless` → single `coreMaterial` (black / hidden)
   * - `stickerless` → 6-material array:
   *   Exposed faces get the colored `stickerlessFaceMaterials`,
   *   internal faces get `seamMaterial` for natural gaps.
   *
   * Material group order follows Three.js BoxGeometry convention:
   *   [ +x(R), -x(L), +y(U), -y(D), +z(F), -z(B) ]
   */
  private getCoreMaterialArray(x: number, y: number, z: number): Material | Material[] {
    const skinType = this.style.skinType ?? 'stickered';

    if (skinType === 'stickered' || skinType === 'coreless') {
      return this.coreMaterial;
    }

    // stickerless: per-face colored plastic
    return [
      x === 1 ? this.stickerlessFaceMaterials['R'] : this.seamMaterial, //  0: +x (Right)
      x === -1 ? this.stickerlessFaceMaterials['L'] : this.seamMaterial, // 1: -x (Left)
      y === 1 ? this.stickerlessFaceMaterials['U'] : this.seamMaterial, //  2: +y (Up)
      y === -1 ? this.stickerlessFaceMaterials['D'] : this.seamMaterial, // 3: -y (Down)
      z === 1 ? this.stickerlessFaceMaterials['F'] : this.seamMaterial, //  4: +z (Front)
      z === -1 ? this.stickerlessFaceMaterials['B'] : this.seamMaterial, // 5: -z (Back)
    ];
  }

  // ───────────────────────────────────────────────────────────────────────
  //  Cubie construction
  // ───────────────────────────────────────────────────────────────────────

  /**
   * Creates a Group representing a single cubie (core + exposed-face stickers).
   *
   * @param x grid coordinate (-1, 0, or 1)
   * @param y grid coordinate (-1, 0, or 1)
   * @param z grid coordinate (-1, 0, or 1)
   */
  public createCubieGroup(x: number, y: number, z: number): Group {
    const group = new Group();
    const skinType = this.style.skinType ?? 'stickered';
    const cubieSize = this.style.cubieSize ?? 0.97;

    // ── 1. Core mesh ──────────────────────────────────────────────────
    const coreMaterials = this.getCoreMaterialArray(x, y, z);
    const coreMesh = new Mesh(this.coreGeometry, coreMaterials);

    // Stickerless: scale down to create physical gaps between pieces
    if (skinType === 'stickerless') {
      coreMesh.scale.setScalar(cubieSize);
    }

    // Coreless: hide the body entirely
    coreMesh.visible = skinType !== 'coreless';

    group.add(coreMesh);
    this.coreMeshes.push({ mesh: coreMesh, x, y, z });

    // ── 2. Sticker meshes on exposed faces ────────────────────────────
    // Offset = half unit + epsilon to sit flush on the core surface.
    // This is correct because core mesh center is at (0,0,0) within the group
    // and core mesh scale does not affect sticker world position.
    const offset = 0.5001;
    const stickerVisible = skinType !== 'stickerless';

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

  // ───────────────────────────────────────────────────────────────────────
  //  Runtime style updates
  // ───────────────────────────────────────────────────────────────────────

  /**
   * Update a single face color at runtime.
   * Propagates to both sticker materials AND stickerless plastic materials.
   */
  public setFaceColor(face: CubeFace | 'Inner', color: string): void {
    if (face === 'Inner') {
      this.coreMaterial.color.set(color);
      this.coreMaterial.needsUpdate = true;
    } else {
      const stickerMat = this.stickerMaterials[face];
      if (stickerMat) {
        stickerMat.color.set(color);
        stickerMat.needsUpdate = true;
      }
      const plasticMat = this.stickerlessFaceMaterials[face];
      if (plasticMat) {
        plasticMat.color.set(color);
        plasticMat.needsUpdate = true;
      }
    }
  }

  /**
   * Apply partial style updates at runtime.
   *
   * Handles:
   * - `skinType` changes → visibility + core material array + core scale
   * - `coreColor` / `coreOpacity` → core material updates
   * - `seamColor` → seam material color
   * - `stickerColors` → updates both sticker and stickerless materials
   * - `stickerSize` / `stickerRadius` → rebuild sticker geometry
   * - `cubieSize` → rescale core meshes (stickerless only)
   */
  public updateStyle(newStyle: Partial<CubeStyleOptions>): void {
    // ── Structural flags ──────────────────────────────────────────────
    let skinTypeChanged = false;
    if (newStyle.skinType !== undefined && newStyle.skinType !== this.style.skinType) {
      this.style.skinType = newStyle.skinType;
      skinTypeChanged = true;
    }

    let cubieSizeChanged = false;
    if (newStyle.cubieSize !== undefined && newStyle.cubieSize !== this.style.cubieSize) {
      this.style.cubieSize = newStyle.cubieSize;
      cubieSizeChanged = true;
    }

    // ── Core color ────────────────────────────────────────────────────
    if (newStyle.coreColor !== undefined) {
      this.style.coreColor = newStyle.coreColor;
      this.setFaceColor('Inner', newStyle.coreColor);
    }

    // ── Core opacity ──────────────────────────────────────────────────
    if (newStyle.coreOpacity !== undefined) {
      this.style.coreOpacity = newStyle.coreOpacity;
      this.coreMaterial.opacity = newStyle.coreOpacity;
      this.coreMaterial.transparent = newStyle.coreOpacity < 1.0;
      this.coreMaterial.needsUpdate = true;
    }

    // ── Seam color (stickerless internal faces) ───────────────────────
    if (newStyle.seamColor !== undefined) {
      this.style.seamColor = newStyle.seamColor;
      this.seamMaterial.color.set(newStyle.seamColor);
      this.seamMaterial.needsUpdate = true;
    }

    // ── Sticker colors (propagate to both material pools) ─────────────
    if (newStyle.stickerColors) {
      for (const [face, color] of Object.entries(newStyle.stickerColors)) {
        this.setFaceColor(face as CubeFace, color);
      }
      this.style.stickerColors = { ...this.style.stickerColors, ...newStyle.stickerColors };
    }

    // ── Skin type / cubie size change → rebuild core appearance ───────
    if (skinTypeChanged || cubieSizeChanged) {
      const newSkinType = this.style.skinType ?? 'stickered';
      const stickerVisible = newSkinType !== 'stickerless';
      const coreVisible = newSkinType !== 'coreless';
      const cubieScale = newSkinType === 'stickerless'
        ? (this.style.cubieSize ?? 0.97)
        : 1.0;

      // Update all sticker meshes
      for (const sm of this.stickerMeshes) {
        sm.visible = stickerVisible;
      }

      // Update all core meshes: material array, visibility, scale
      for (const cm of this.coreMeshes) {
        cm.mesh.material = this.getCoreMaterialArray(cm.x, cm.y, cm.z);
        cm.mesh.visible = coreVisible;
        cm.mesh.scale.setScalar(cubieScale);
      }
    }

    // ── Sticker geometry rebuild (size / radius change) ───────────────
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

      for (const mesh of this.stickerMeshes) {
        mesh.geometry = this.stickerGeometry;
      }
    }
  }

  /**
   * Set emissive highlight on a face (for analysis overlays, solving hints, etc.)
   */
  public setFaceEmissive(
    face: CubeFace | 'Inner',
    emissiveColor: string,
    intensity: number,
  ): void {
    if (face === 'Inner') {
      this.coreMaterial.emissive.set(emissiveColor);
      this.coreMaterial.emissiveIntensity = intensity;
      this.coreMaterial.needsUpdate = true;
    }
  }

  /** Read-only snapshot of the current style. */
  public getStyle(): Readonly<CubeStyleOptions> {
    return { ...this.style };
  }

  // ───────────────────────────────────────────────────────────────────────
  //  Cleanup
  // ───────────────────────────────────────────────────────────────────────

  public dispose(): void {
    this.coreGeometry.dispose();
    this.stickerGeometry.dispose();
    this.coreMaterial.dispose();
    this.seamMaterial.dispose();
    Object.values(this.stickerMaterials).forEach((mat) => mat.dispose());
    Object.values(this.stickerlessFaceMaterials).forEach((mat) => mat.dispose());
    this.stickerMeshes = [];
    this.coreMeshes = [];
  }
}
