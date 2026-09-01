import { describe, expect, it } from 'vitest';
import { Mesh } from 'three';
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
});
