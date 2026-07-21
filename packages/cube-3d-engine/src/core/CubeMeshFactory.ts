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
  DoubleSide,
  CanvasTexture,
} from 'three';
import { RoundedBoxGeometry } from 'three-stdlib';
import type { CubeFace } from '@cubeforge/types';

export interface CubeStyleOptions {
  /** Visual strategy: classic, solid plastic, floating panels, or see-through */
  skinType?: 'stickered' | 'stickerless' | 'coreless' | 'translucent';
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
   * Ignored in stickered, coreless, and translucent modes (always 1.0).
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
 *   - `stickered`:    single black/dark `MeshStandardMaterial`
 *   - `stickerless`:  array of 6 `MeshBasicMaterial` — exposed faces get
 *                     the colored material, internal faces get `seamColor`
 *   - `coreless`:     single material, mesh hidden
 *   - `translucent`:  single material, transparent, depthWrite:false
 *
 * - **Sticker meshes** (0–3 per cubie): flat rounded-rect `ShapeGeometry` panels
 *   on exposed faces.
 *   - `stickered` / `coreless`: normal `MeshBasicMaterial` (FrontSide, depthWrite)
 *   - `stickerless`:           hidden
 *   - `translucent`:           `MeshBasicMaterial` with `DoubleSide` +
 *                              `depthWrite:false` → back stickers visible
 *                              through the transparent core
 *
 * ### Stickerless visual gaps
 *
 * For `stickerless`, the core mesh is **scaled down** (default 0.97) so adjacent
 * cubies no longer touch — the round edges combine with the `seamColor` internal
 * faces to create natural-looking seams, exactly like a premium speedcube.
 *
 * ### Translucent
 *
 * Core visible but transparent (opacity 0.0). Stickers use DoubleSide +
 * depthWrite:false so stickers on the far side of the cube are visible through
 * the front. Three.js automatically sorts transparent objects back-to-front.
 */
export class CubeMeshFactory {
  private coreGeometry: BoxGeometry;
  private stickerGeometry: ShapeGeometry;
  private coreMaterial!: MeshStandardMaterial;
  private seamMaterial!: MeshStandardMaterial;
  /** Normal sticker panels — stickered + coreless (FrontSide, opaque) */
  private stickerMaterials: Record<string, MeshBasicMaterial> = {};
  /** Stickerless exposed faces — unlit flat color, same as default stickers */
  private stickerlessFaceMaterials: Record<string, MeshBasicMaterial> = {};
  /** Translucent sticker panels — DoubleSide, depthWrite:false for see-through */
  private translucentStickerMaterials: Record<string, MeshBasicMaterial> = {};
  /**
   * Cache of diagonal-split materials for stickerless internal faces.
   * Key: "hex1_hex2" — maps a pair of colors to a textured material
   * whose canvas texture shows a diagonal split between the two.
   */
  private splitMaterials = new Map<string, MeshBasicMaterial>();
  /** Track all sticker meshes with their face for runtime material swaps */
  private stickerMeshes: { mesh: Mesh; face: string }[] = [];
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
      depthWrite: !isTransparent,
    });

    // Seam material: dark internal faces for stickerless gaps
    this.seamMaterial = new MeshStandardMaterial({
      color: new Color(this.style.seamColor ?? '#2a2a2a'),
      roughness: 1.0,
      metalness: 0.0,
    });

    for (const face of ['U', 'D', 'F', 'B', 'R', 'L'] as const) {
      // Normal sticker panels (stickered + coreless) — unlit, opaque
      this.stickerMaterials[face] = new MeshBasicMaterial({
        color: new Color(this.style.stickerColors[face]),
      });

      // Stickerless exposed faces — unlit flat color (matches default look)
      this.stickerlessFaceMaterials[face] = new MeshBasicMaterial({
        color: new Color(this.style.stickerColors[face]),
      });

      // Translucent sticker panels — DoubleSide + no depth write
      // so back-face stickers are visible through the transparent core
      this.translucentStickerMaterials[face] = new MeshBasicMaterial({
        color: new Color(this.style.stickerColors[face]),
        side: DoubleSide,
        depthWrite: false,
        transparent: true,
      });
    }
  }

  /**
   * Returns the material(s) for a cubie core at position (x, y, z).
   *
   * - `stickered` / `coreless` / `translucent` → single `coreMaterial`
   * - `stickerless` → 6-material array of `MeshBasicMaterial`:
   *   Exposed faces get the colored `stickerlessFaceMaterials`.
   *   Internal faces show the **piece's own colored plastic**:
   *   - Centers: solid color on all 5 internal faces.
   *   - Edges: solid color on faces opposite an exposed face;
   *            diagonal split (2 colors) on the axis with no exposed face.
   *   - Corners: diagonal split (2 colors) on all 3 internal faces —
   *              the two colors from the orthogonal axes.
   *   - Core (0,0,0): falls back to `seamMaterial` (not normally visible).
   *
   * Material group order follows Three.js BoxGeometry convention:
   *   [ +x(R), -x(L), +y(U), -y(D), +z(F), -z(B) ]
   */
  private getCoreMaterialArray(x: number, y: number, z: number): Material | Material[] {
    const skinType = this.style.skinType ?? 'stickered';

    // stickered / coreless / translucent all use the single core material
    if (skinType !== 'stickerless') {
      return this.coreMaterial;
    }

    // Colors exposed on each axis (null = no exposed face on that axis)
    const axisColor: Record<string, string | null> = {
      X: x === 1 ? 'R' : x === -1 ? 'L' : null,
      Y: y === 1 ? 'U' : y === -1 ? 'D' : null,
      Z: z === 1 ? 'F' : z === -1 ? 'B' : null,
    };

    // All exposed colors for this cubie (1 for center, 2 for edge, 3 for corner, 0 for core)
    const pieceColors = Object.values(axisColor).filter((c): c is string => c !== null);

    // Face definitions: [faceName, axis, isExposed]
    const faces: [string, string, boolean][] = [
      ['R', 'X', x === 1],    // 0: +x
      ['L', 'X', x === -1],   // 1: -x
      ['U', 'Y', y === 1],    // 2: +y
      ['D', 'Y', y === -1],   // 3: -y
      ['F', 'Z', z === 1],    // 4: +z
      ['B', 'Z', z === -1],   // 5: -z
    ];

    return faces.map(([faceName, axis, isExposed]) => {
      // Exposed face → solid stickerless color
      if (isExposed) {
        return this.stickerlessFaceMaterials[faceName];
      }

      // Internal face: collect colors from the two ORTHOGONAL axes
      const orthogonalAxes = (['X', 'Y', 'Z'] as const).filter(a => a !== axis);
      const orthogonalColors = orthogonalAxes
        .map(a => axisColor[a])
        .filter((c): c is string => c !== null);

      // 0 orthogonal colors → core piece or center opposite face
      // Use the piece's first color, or fall back to seam
      if (orthogonalColors.length === 0) {
        if (pieceColors.length > 0) {
          return this.stickerlessFaceMaterials[pieceColors[0]];
        }
        return this.seamMaterial;
      }

      // 1 orthogonal color → solid (edge: face opposite to exposed face)
      if (orthogonalColors.length === 1) {
        return this.stickerlessFaceMaterials[orthogonalColors[0]];
      }

      // 2 orthogonal colors → diagonal split texture (corner internal faces,
      // or edge faces on the axis with no exposed face)
      return this.getSplitMaterial(
        (this.style.stickerColors as Record<string, string>)[orthogonalColors[0]],
        (this.style.stickerColors as Record<string, string>)[orthogonalColors[1]],
      );
    });
  }

  /**
   * Creates (or returns a cached) MeshBasicMaterial with a diagonal-split
   * canvas texture between two hex colors.
   *
   * The texture is a 128×128 canvas split top-left→bottom-right:
   *   - Top-left triangle: colorA
   *   - Bottom-right triangle: colorB
   *
   * Used for internal faces of corner/edge pieces in stickerless mode
   * to simulate two-colored fused plastic.
   */
  private getSplitMaterial(hexA: string, hexB: string): MeshBasicMaterial {
    // Normalize key so "#ff0000_#00ff00" === "#00ff00_#ff0000"
    const key = [hexA, hexB].sort().join('_');

    const cached = this.splitMaterials.get(key);
    if (cached) return cached;

    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Top-left triangle: colorA
    ctx.fillStyle = hexA;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(size, 0);
    ctx.lineTo(0, size);
    ctx.closePath();
    ctx.fill();

    // Bottom-right triangle: colorB
    ctx.fillStyle = hexB;
    ctx.beginPath();
    ctx.moveTo(size, size);
    ctx.lineTo(size, 0);
    ctx.lineTo(0, size);
    ctx.closePath();
    ctx.fill();

    const texture = new CanvasTexture(canvas);
    texture.minFilter = 1006; // LinearFilter
    texture.magFilter = 1006;
    texture.generateMipmaps = false;

    const mat = new MeshBasicMaterial({ map: texture });
    this.splitMaterials.set(key, mat);
    return mat;
  }

  /**
   * Clear and dispose all cached diagonal-split materials.
   * Called when sticker colors change (textures become stale) or on full disposal.
   */
  private clearSplitMaterials(): void {
    for (const mat of this.splitMaterials.values()) {
      if (mat.map) {
        mat.map.dispose();
      }
      mat.dispose();
    }
    this.splitMaterials.clear();
  }

  /**
   * Returns the sticker material pool to use for the current skin type.
   * - `translucent` → DoubleSide + depthWrite:false materials
   * - everything else → normal opaque materials
   */
  private getActiveStickerMaterials(): Record<string, MeshBasicMaterial> {
    return this.style.skinType === 'translucent'
      ? this.translucentStickerMaterials
      : this.stickerMaterials;
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

    // Coreless: hide the body entirely. Translucent + stickered: visible.
    coreMesh.visible = skinType !== 'coreless';

    group.add(coreMesh);
    this.coreMeshes.push({ mesh: coreMesh, x, y, z });

    // ── 2. Sticker meshes on exposed faces ────────────────────────────
    // Offset = half unit + epsilon to sit flush on the core surface.
    const offset = 0.5001;
    const stickerVisible = skinType !== 'stickerless';
    const activeMaterials = this.getActiveStickerMaterials();

    // Helper to create a sticker and track it
    const addSticker = (face: string, px: number, py: number, pz: number, rx?: number, ry?: number) => {
      const sticker = new Mesh(this.stickerGeometry, activeMaterials[face]);
      sticker.position.set(px, py, pz);
      if (rx !== undefined) sticker.rotation.x = rx;
      if (ry !== undefined) sticker.rotation.y = ry;
      sticker.visible = stickerVisible;
      group.add(sticker);
      this.stickerMeshes.push({ mesh: sticker, face });
    };

    if (x === 1) addSticker('R', offset, 0, 0, undefined, Math.PI / 2);
    if (x === -1) addSticker('L', -offset, 0, 0, undefined, -Math.PI / 2);
    if (y === 1) addSticker('U', 0, offset, 0, -Math.PI / 2);
    if (y === -1) addSticker('D', 0, -offset, 0, Math.PI / 2);
    if (z === 1) addSticker('F', 0, 0, offset);
    if (z === -1) addSticker('B', 0, 0, -offset, undefined, Math.PI);

    return group;
  }

  // ───────────────────────────────────────────────────────────────────────
  //  Runtime style updates
  // ───────────────────────────────────────────────────────────────────────

  /**
   * Update a single face color at runtime.
   * Propagates to all three sticker material pools.
   */
  public setFaceColor(face: CubeFace | 'Inner', color: string): void {
    if (face === 'Inner') {
      this.coreMaterial.color.set(color);
      this.coreMaterial.needsUpdate = true;
    } else {
      // Update all three material pools so color stays consistent
      // regardless of which skin type is currently active
      const mat1 = this.stickerMaterials[face];
      if (mat1) { mat1.color.set(color); mat1.needsUpdate = true; }

      const mat2 = this.stickerlessFaceMaterials[face];
      if (mat2) { mat2.color.set(color); mat2.needsUpdate = true; }

      const mat3 = this.translucentStickerMaterials[face];
      if (mat3) { mat3.color.set(color); mat3.needsUpdate = true; }
    }
  }

  /**
   * Apply partial style updates at runtime.
   *
   * Handles:
   * - `skinType` changes → visibility + core material + sticker material pool + core scale
   * - `coreColor` / `coreOpacity` → core material updates
   * - `seamColor` → seam material color
   * - `stickerColors` → updates all sticker material pools
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
      this.coreMaterial.depthWrite = !(newStyle.coreOpacity < 1.0);
      this.coreMaterial.needsUpdate = true;
    }

    // ── Seam color (stickerless internal faces) ───────────────────────
    if (newStyle.seamColor !== undefined) {
      this.style.seamColor = newStyle.seamColor;
      this.seamMaterial.color.set(newStyle.seamColor);
      this.seamMaterial.needsUpdate = true;
    }

    // ── Sticker colors (propagate to all three material pools) ────────
    if (newStyle.stickerColors) {
      for (const [face, color] of Object.entries(newStyle.stickerColors)) {
        this.setFaceColor(face as CubeFace, color);
      }
      this.style.stickerColors = { ...this.style.stickerColors, ...newStyle.stickerColors };
    }

    // ── Skin type / cubie size change → rebuild core + sticker appearance ──
    if (skinTypeChanged || cubieSizeChanged) {
      const newSkinType = this.style.skinType ?? 'stickered';
      const stickerVisible = newSkinType !== 'stickerless';
      const coreVisible = newSkinType !== 'coreless';
      const cubieScale = newSkinType === 'stickerless'
        ? (this.style.cubieSize ?? 0.97)
        : 1.0;

      // Determine which sticker material pool to use
      const activePool = this.getActiveStickerMaterials();

      // When switching away from stickerless, dispose split-material cache
      if (newSkinType !== 'stickerless') {
        this.clearSplitMaterials();
      }

      // Update all sticker meshes: visibility + material pool
      for (const { mesh, face } of this.stickerMeshes) {
        mesh.visible = stickerVisible;
        mesh.material = activePool[face];
      }

      // Update all core meshes: material array, visibility, scale
      for (const cm of this.coreMeshes) {
        cm.mesh.material = this.getCoreMaterialArray(cm.x, cm.y, cm.z);
        cm.mesh.visible = coreVisible;
        cm.mesh.scale.setScalar(cubieScale);
      }
    }

    // ── Sticker color changes → invalidate diagonal-split texture cache ──
    if (newStyle.stickerColors && this.style.skinType === 'stickerless') {
      this.clearSplitMaterials();
      // Rebuild core mesh material arrays so split faces pick up fresh
      // textures with the new colors (solid faces auto-update via shared refs).
      for (const cm of this.coreMeshes) {
        cm.mesh.material = this.getCoreMaterialArray(cm.x, cm.y, cm.z);
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

      for (const { mesh } of this.stickerMeshes) {
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
    Object.values(this.translucentStickerMaterials).forEach((mat) => mat.dispose());
    this.clearSplitMaterials();
    this.stickerMeshes = [];
    this.coreMeshes = [];
  }
}
