import { describe, expect, it } from 'vitest';
import { DoubleSide, Mesh, MeshBasicMaterial } from 'three';
import {
  DEFAULT_PYRAMINX_STYLE,
  PyraminxMeshFactory,
} from '../PyraminxMeshFactory';
import {
  PYRAMINX_EDGE_SLOTS,
  PYRAMINX_VERTICES_ORDER,
  pyraminxEdgePieceVertices,
  pyraminxCornerPieceVertices,
  pyraminxTipPieceVertices,
} from '../PyraminxGeometry';

function stickerCount(group: { children: readonly { userData?: Record<string, unknown> }[] }): number {
  return group.children.filter((c) => c.userData?.pyraminxSticker === true).length;
}

describe('PyraminxMeshFactory', () => {
  it('builds 6 edge pieces with 2 exposed faces each (tetrahedra)', () => {
    const factory = new PyraminxMeshFactory();
    for (const def of PYRAMINX_EDGE_SLOTS) {
      const group = factory.createEdgePiece(def.index);
      const vertices = pyraminxEdgePieceVertices(def.index);
      expect(vertices).toHaveLength(4); // {P, Q, cF1, cF2}
      expect(stickerCount(group)).toBe(2);
      // Core mesh present and positioned at the slot centroid.
      expect(group.children.some((c) => (c as Mesh).userData?.pyraminxCore === true)).toBe(true);
    }
  });

  it('builds 4 corner pieces with 3 exposed faces each (octahedra)', () => {
    const factory = new PyraminxMeshFactory();
    for (const vertex of PYRAMINX_VERTICES_ORDER) {
      const group = factory.createCornerPiece(vertex);
      const vertices = pyraminxCornerPieceVertices(vertex);
      expect(vertices).toHaveLength(6); // {P1, P2, P3, cFa, cFb, cFc}
      expect(stickerCount(group)).toBe(3);
    }
  });

  it('builds 4 tip pieces with 3 exposed faces each (tetrahedra)', () => {
    const factory = new PyraminxMeshFactory();
    for (const vertex of PYRAMINX_VERTICES_ORDER) {
      const group = factory.createTipPiece(vertex);
      const vertices = pyraminxTipPieceVertices(vertex);
      expect(vertices).toHaveLength(4); // {V, P1, P2, P3}
      expect(stickerCount(group)).toBe(3);
    }
  });

  it('stickered skin: stickers are visible; stickerless: stickers hidden and core colored', () => {
    const stickered = new PyraminxMeshFactory({ skinType: 'stickered' });
    const stickerless = new PyraminxMeshFactory({ skinType: 'stickerless' });

    const edge = PYRAMINX_EDGE_SLOTS[0];
    const stickeredGroup = stickered.createEdgePiece(edge.index);
    const stickerlessGroup = stickerless.createEdgePiece(edge.index);

    const stickers = (g: ReturnType<typeof stickered.createEdgePiece>) =>
      g.children.filter((c) => (c as Mesh).userData?.pyraminxSticker === true) as Mesh[];

    for (const s of stickers(stickeredGroup)) expect(s.visible).toBe(true);
    for (const s of stickers(stickerlessGroup)) expect(s.visible).toBe(false);

    // Stickerless core carries per-face colored materials (exposed faces use
    // the face color index, internal faces the seam index).
    const core = stickerlessGroup.children.find(
      (c) => (c as Mesh).userData?.pyraminxCore === true,
    ) as Mesh;
    expect(Array.isArray(core.material)).toBe(true);
  });

  it('default style is stickered with the WCA color scheme', () => {
    const factory = new PyraminxMeshFactory();
    const style = factory.getStyle();
    expect(style.skinType).toBe('stickered');
    expect(style.stickerColors.U).toBe(DEFAULT_PYRAMINX_STYLE.stickerColors.U);
    expect(style.stickerColors.L).toBe(DEFAULT_PYRAMINX_STYLE.stickerColors.L);
    expect(style.stickerColors.R).toBe(DEFAULT_PYRAMINX_STYLE.stickerColors.R);
    expect(style.stickerColors.B).toBe(DEFAULT_PYRAMINX_STYLE.stickerColors.B);
  });

  it('all stickers across all pieces face strictly outward from piece center (never inverted/black)', () => {
    const factory = new PyraminxMeshFactory();
    const pieces = [
      ...PYRAMINX_VERTICES_ORDER.map((v) => factory.createTipPiece(v)),
      ...PYRAMINX_VERTICES_ORDER.map((v) => factory.createCornerPiece(v)),
      ...PYRAMINX_EDGE_SLOTS.map((e) => factory.createEdgePiece(e.index)),
    ];

    let totalStickers = 0;
    for (const piece of pieces) {
      const stickers = piece.children.filter((c) => (c as Mesh).userData?.pyraminxSticker === true) as Mesh[];
      for (const sticker of stickers) {
        totalStickers++;
        const pos = sticker.geometry.attributes.position.array;
        const norm = sticker.geometry.attributes.normal.array;
        // Compute sticker centroid in local piece coordinates:
        let cx = 0, cy = 0, cz = 0;
        const vertexCount = pos.length / 3;
        for (let i = 0; i < pos.length; i += 3) {
          cx += pos[i]; cy += pos[i + 1]; cz += pos[i + 2];
        }
        cx /= vertexCount; cy /= vertexCount; cz /= vertexCount;
        const dot = cx * norm[0] + cy * norm[1] + cz * norm[2];
        expect(dot).toBeGreaterThan(0);
      }
    }
    expect(totalStickers).toBe(36); // 12 tip + 12 corner + 12 edge = 36
  });

  /**
   * Live skin re-sync: pieces are built ONCE, so updateStyle({ skinType })
   * must swap the already-built core materials (stickered dark plastic ↔
   * stickerless colored faces) — not just toggle sticker visibility.
   * Without this, switching skins live leaves a black pyramid.
   */
  it('updateStyle({ skinType }) re-syncs built pieces: stickerless colors the cores live', () => {
    const factory = new PyraminxMeshFactory(); // starts stickered
    const groups = [...PYRAMINX_VERTICES_ORDER.map((v) => factory.createTipPiece(v))];
    const coreOf = (g: { children: readonly { userData?: Record<string, unknown> }[] }) =>
      g.children.find((c) => c.userData?.pyraminxCore === true) as Mesh;

    // Stickered at build time: every material slot is the dark core.
    const dark = (coreOf(groups[0]).material as unknown[])[0];
    expect(dark).toBeInstanceOf(Object);

    factory.updateStyle({ skinType: 'stickerless' });
    for (const g of groups) {
      const materials = coreOf(g).material as unknown[];
      for (let i = 0; i < 4; i++) expect(materials[i]).not.toBe(dark);
    }

    factory.updateStyle({ skinType: 'stickered' });
    for (const g of groups) {
      const materials = coreOf(g).material as unknown[];
      for (let i = 0; i < 5; i++) expect(materials[i]).toBe(dark);
    }
  });

  it('coreOpacity < 1 makes the body material transparent (translucent family)', () => {
    const factory = new PyraminxMeshFactory({ coreOpacity: 0.3 });
    const group = factory.createEdgePiece(0);
    const core = group.children.find((c) => (c as Mesh).userData?.pyraminxCore === true) as Mesh;
    const materials = core.material as unknown as { transparent: boolean; opacity: number }[];
    for (const mat of materials) {
      expect(mat.transparent).toBe(true);
      expect(mat.opacity).toBeCloseTo(0.3);
    }

    // Live update flips transparency back off at full opacity.
    factory.updateStyle({ coreOpacity: 1 });
    const materialsAfter = core.material as unknown as { transparent: boolean; opacity: number }[];
    for (const mat of materialsAfter) {
      expect(mat.transparent).toBe(false);
      expect(mat.opacity).toBe(1);
    }
  });

  /** The cube's coreless mechanism: body hidden, only colored panels remain. */
  it('coreless: core meshes hidden, sticker panels stay visible (cube parity)', () => {
    const factory = new PyraminxMeshFactory();
    const group = factory.createEdgePiece(0);
    factory.updateStyle({ skinType: 'coreless' });
    const core = group.children.find((c) => (c as Mesh).userData?.pyraminxCore === true) as Mesh;
    expect(core.visible).toBe(false);
    const stickers = group.children.filter(
      (c) => (c as Mesh).userData?.pyraminxSticker === true,
    ) as Mesh[];
    expect(stickers.length).toBeGreaterThan(0);
    for (const s of stickers) expect(s.visible).toBe(true);
  });

  /** The cube's translucent mechanism: DoubleSide depthWrite:false panels. */
  it('translucent: stickers swap to the depthWrite-false pool (cube parity)', () => {
    const factory = new PyraminxMeshFactory();
    const group = factory.createEdgePiece(0);
    factory.updateStyle({ skinType: 'translucent' });
    const stickers = group.children.filter(
      (c) => (c as Mesh).userData?.pyraminxSticker === true,
    ) as Mesh[];
    expect(stickers.length).toBeGreaterThan(0);
    for (const s of stickers) {
      const mat = s.material as MeshBasicMaterial;
      expect(mat.side).toBe(DoubleSide);
      expect(mat.depthWrite).toBe(false);
      expect(mat.transparent).toBe(true);
    }
  });

  /** The cube's floating-projection mechanism, adapted to triangular faces. */
  it('floatingStickers: projection twins beyond the face, hidden by default', () => {
    const factory = new PyraminxMeshFactory({ floatingStickers: true });
    const group = factory.createEdgePiece(0);
    const floating = group.children.filter(
      (c) => (c as Mesh).userData?.isFloatingSticker === true,
    ) as Mesh[];
    const surface = group.children.filter(
      (c) => (c as Mesh).userData?.pyraminxSticker === true,
    ) as Mesh[];
    expect(floating.length).toBe(surface.length);
    for (const f of floating) expect(f.visible).toBe(true);
  });

  /** The cube's stickerless mechanism: piece shrink opens the seams. */
  it('pieceSize: stickerless shrinks the core mesh; other skins stay at 1', () => {
    const factory = new PyraminxMeshFactory({ skinType: 'stickerless', pieceSize: 0.9 });
    const group = factory.createEdgePiece(0);
    const core = group.children.find((c) => (c as Mesh).userData?.pyraminxCore === true) as Mesh;
    expect(core.scale.x).toBeCloseTo(0.9); // built in stickerless

    factory.updateStyle({ skinType: 'stickered' });
    expect(core.scale.x).toBe(1);

    factory.updateStyle({ skinType: 'stickerless' });
    expect(core.scale.x).toBeCloseTo(0.9);
  });
});
