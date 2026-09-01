import {
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Vector3,
  Float32BufferAttribute,
} from 'three';
import {
  DEFAULT_PYRAMINX_STICKER_COLORS,
  PYRAMINX_EDGE_SLOTS,
  PYRAMINX_VERTICES_ORDER,
  pyraminxCornerPieceVertices,
  pyraminxCornerSlotPosition,
  pyraminxEdgePieceVertices,
  pyraminxEdgeSlotPosition,
  pyraminxTipPieceVertices,
  pyraminxTipSlotPosition,
  type PyraminxVertex,
} from './PyraminxGeometry';

export interface PyraminxStyleOptions {
  /** stickered = dark plastic core + colored sticker panels; stickerless = colored plastic. */
  skinType?: 'stickered' | 'stickerless';
  /** Dark plastic color (stickered core + stickerless seams). */
  coreColor: string;
  /** Sticker/plastic color per face (WCA scheme by default). */
  stickerColors: Record<PyraminxVertex, string>;
  /** How much each sticker triangle is inset from its piece face (0..1). */
  stickerInset: number;
  /** Corner rounding fraction for sticker triangles (0..1). Default: 0.14. */
  stickerRadius?: number;
}

export const DEFAULT_PYRAMINX_STYLE: PyraminxStyleOptions = {
  skinType: 'stickered',
  coreColor: '#1a1a1a',
  stickerColors: { ...DEFAULT_PYRAMINX_STICKER_COLORS },
  stickerInset: 0.1,
  stickerRadius: 0.14,
};

/** Material slot indices inside the piece material array. */
const MATERIAL_FACE_INDEX: Record<PyraminxVertex, number> = {
  U: 0,
  L: 1,
  R: 2,
  B: 3,
};
const MATERIAL_SEAM_INDEX = 4;

interface PieceFace {
  /** Vertex indices into the piece's vertex list (local space). */
  readonly indices: readonly [number, number, number];
  /** Whether this triangle is an exposed (sticker) face; exposed faces carry
   *  the color of the big face they lie on. */
  readonly exposed: boolean;
  /** The big face this triangle lies on (exposed faces only). */
  readonly face?: PyraminxVertex;
}

/**
 * Builds the 14 Pyraminx pieces (4 tips + 4 corners + 6 edges) as Groups:
 *
 *   Group (position = slot centroid)
 *   ├── core mesh   — the piece's polyhedron (tetrahedron / octahedron) with
 *   │                 per-triangle material groups: exposed faces get the
 *   │                 face color (stickerless) or the dark core (stickered),
 *   │                 internal faces get the seam / core color
 *   └── stickers    — inset triangle panels on the exposed faces
 *                     (stickered skin only; hidden in stickerless)
 *
 * The piece geometry is built in LOCAL coordinates centered on the slot
 * centroid, so rotating the Group around the puzzle origin (the driver's
 * pivot machinery) moves the piece exactly like the real puzzle.
 */
export class PyraminxMeshFactory {
  private style: PyraminxStyleOptions;

  private coreMaterial: MeshStandardMaterial;
  private seamMaterial: MeshStandardMaterial;
  /** Stickered sticker panels (flat, unlit, polygonOffset against z-fighting). */
  private stickerMaterials: Record<PyraminxVertex, MeshBasicMaterial>;
  /** Stickerless exposed faces (flat colored plastic). */
  private stickerlessFaceMaterials: Record<PyraminxVertex, MeshBasicMaterial>;

  constructor(style: Partial<PyraminxStyleOptions> = {}) {
    this.style = { ...DEFAULT_PYRAMINX_STYLE, ...style };

    this.coreMaterial = new MeshStandardMaterial({
      color: new Color(this.style.coreColor),
      roughness: 1.0,
      metalness: 0.0,
    });
    this.seamMaterial = new MeshStandardMaterial({
      color: new Color(this.style.coreColor),
      roughness: 1.0,
      metalness: 0.0,
    });

    this.stickerMaterials = {} as Record<PyraminxVertex, MeshBasicMaterial>;
    this.stickerlessFaceMaterials = {} as Record<PyraminxVertex, MeshBasicMaterial>;
    for (const face of PYRAMINX_VERTICES_ORDER) {
      this.stickerMaterials[face] = new MeshBasicMaterial({
        color: new Color(this.style.stickerColors[face]),
        side: DoubleSide,
        // NEGATIVE polygonOffset resolves z-fighting with the core: the
        // stickers sit a hair above the core face and must always win the
        // depth test (same technique as CubeMeshFactory).
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      });
      this.stickerlessFaceMaterials[face] = new MeshBasicMaterial({
        color: new Color(this.style.stickerColors[face]),
        side: DoubleSide,
      });
    }
  }

  /** Material array for a piece core: [U, L, R, B, seam]. */
  private coreMaterials(): Material[] {
    const isStickerless = this.style.skinType === 'stickerless';
    if (isStickerless) {
      return [
        this.stickerlessFaceMaterials.U,
        this.stickerlessFaceMaterials.L,
        this.stickerlessFaceMaterials.R,
        this.stickerlessFaceMaterials.B,
        this.seamMaterial,
      ];
    }
    return [
      this.coreMaterial,
      this.coreMaterial,
      this.coreMaterial,
      this.coreMaterial,
      this.coreMaterial,
    ];
  }

  // ── Geometry construction ───────────────────────────────────────────────

  /**
   * Build a core mesh for a piece from its world-space vertices + face list.
   * Returns [mesh, localVertices, worldFaces] where worldFaces carries the
   * wound exposed triangles (for sticker placement).
   */
  private buildPiece(
    worldVertices: Vector3[],
    faces: PieceFace[],
    slotCentroid?: Vector3,
  ): { mesh: Mesh; localVertices: Vector3[]; exposed: { a: Vector3; b: Vector3; c: Vector3; face: PyraminxVertex }[] } {
    // Local space: center the geometry on the slot centroid, so the driver's
    // rotation around the origin works.
    const centroid = slotCentroid
      ? slotCentroid.clone()
      : worldVertices
          .reduce((acc, v) => acc.add(v), new Vector3())
          .multiplyScalar(1 / worldVertices.length);
    const local = worldVertices.map((v) => v.clone().sub(centroid));

    const positions: number[] = [];
    const groups: { start: number; count: number; materialIndex: number }[] = [];
    const exposed: { a: Vector3; b: Vector3; c: Vector3; face: PyraminxVertex }[] = [];

    let vertexOffset = 0;
    for (const face of faces) {
      const tri = face.indices.map((i) => local[i]) as [Vector3, Vector3, Vector3];
      const wound = this.windOutward(tri);
      positions.push(wound[0].x, wound[0].y, wound[0].z);
      positions.push(wound[1].x, wound[1].y, wound[1].z);
      positions.push(wound[2].x, wound[2].y, wound[2].z);
      groups.push({
        start: vertexOffset,
        count: 3,
        materialIndex: face.exposed
          ? MATERIAL_FACE_INDEX[face.face as PyraminxVertex]
          : MATERIAL_SEAM_INDEX,
      });
      vertexOffset += 3;
      if (face.exposed) {
        exposed.push({ a: wound[0], b: wound[1], c: wound[2], face: face.face as PyraminxVertex });
      }
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    for (const g of groups) geometry.addGroup(g.start, g.count, g.materialIndex);
    geometry.computeVertexNormals();

    const mesh = new Mesh(geometry, this.coreMaterials());
    mesh.userData = { pyraminxCore: true };
    return { mesh, localVertices: local, exposed };
  }

  /**
   * Reorder a triangle so its normal points OUTWARD (away from the piece
   * centroid, which is the local origin). All our pieces are convex and
   * contain their centroid, so `normal · triangleCentroid > 0` means outward.
   */
  private windOutward(tri: [Vector3, Vector3, Vector3]): [Vector3, Vector3, Vector3] {
    const [a, b, c] = tri;
    const normal = b.clone().sub(a).cross(c.clone().sub(a));
    const triCentroid = a.clone().add(b).add(c).multiplyScalar(1 / 3);
    if (normal.dot(triCentroid) < 0) return [a, c, b];
    return [a, b, c];
  }

  /** Create a sticker mesh with rounded corners for one exposed triangle (stickered skin). */
  private createSticker(
    tri: { a: Vector3; b: Vector3; c: Vector3; face: PyraminxVertex },
    material: MeshBasicMaterial,
  ): Mesh {
    const [rawA, rawB, rawC] = this.windOutward([tri.a, tri.b, tri.c]);
    const g = rawA.clone().add(rawB).add(rawC).multiplyScalar(1 / 3);
    let n = rawB.clone().sub(rawA).cross(rawC.clone().sub(rawA)).normalize();
    if (n.dot(g) < 0) {
      n.negate();
    }
    const inset = this.style.stickerInset;
    const insetPt = (p: Vector3) => g.clone().add(p.clone().sub(g).multiplyScalar(1 - inset));
    const a = insetPt(rawA).add(n.clone().multiplyScalar(0.003));
    const b = insetPt(rawB).add(n.clone().multiplyScalar(0.003));
    const c = insetPt(rawC).add(n.clone().multiplyScalar(0.003));

    const radiusFraction = this.style.stickerRadius ?? 0.14;
    const corners = [a.clone(), b.clone(), c.clone()];

    // Ensure corners wind CCW around normal n
    const edge1 = b.clone().sub(a);
    const edge2 = c.clone().sub(a);
    if (edge1.cross(edge2).dot(n) < 0) {
      corners.reverse();
    }

    const boundaryPts: Vector3[] = [];
    const segmentsPerCorner = 4;

    for (let i = 0; i < 3; i++) {
      const prev = corners[(i + 2) % 3];
      const curr = corners[i];
      const next = corners[(i + 1) % 3];

      const d1 = curr.clone().sub(prev);
      const l1 = d1.length();
      const u1 = d1.multiplyScalar(1 / l1);

      const d2 = next.clone().sub(curr);
      const l2 = d2.length();
      const u2 = d2.multiplyScalar(1 / l2);

      const r = Math.min(l1, l2) * radiusFraction;
      const pStart = curr.clone().sub(u1.clone().multiplyScalar(r));
      const pEnd = curr.clone().add(u2.clone().multiplyScalar(r));

      for (let s = 0; s <= segmentsPerCorner; s++) {
        const t = s / segmentsPerCorner;
        const b0 = (1 - t) * (1 - t);
        const b1 = 2 * (1 - t) * t;
        const b2 = t * t;
        boundaryPts.push(
          new Vector3(
            b0 * pStart.x + b1 * curr.x + b2 * pEnd.x,
            b0 * pStart.y + b1 * curr.y + b2 * pEnd.y,
            b0 * pStart.z + b1 * curr.z + b2 * pEnd.z,
          ),
        );
      }
    }

    // Build triangle fan from centroid g to boundary points
    const positions: number[] = [];
    const normals: number[] = [];
    const numPts = boundaryPts.length;

    for (let i = 0; i < numPts; i++) {
      const pCurrent = boundaryPts[i];
      const pNext = boundaryPts[(i + 1) % numPts];

      positions.push(g.x, g.y, g.z);
      positions.push(pCurrent.x, pCurrent.y, pCurrent.z);
      positions.push(pNext.x, pNext.y, pNext.z);

      normals.push(n.x, n.y, n.z);
      normals.push(n.x, n.y, n.z);
      normals.push(n.x, n.y, n.z);
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
    const sticker = new Mesh(geometry, material);
    sticker.userData = { pyraminxSticker: true, face: tri.face };
    return sticker;
  }

  // ── Piece construction ──────────────────────────────────────────────────

  /** Edge piece: tetrahedron {P, Q, cF1, cF2} — 2 exposed faces. */
  public createEdgePiece(slot: number): Group {
    const def = PYRAMINX_EDGE_SLOTS[slot];
    if (!def) throw new Error(`Unknown pyraminx edge slot ${slot}`);

    const faces: PieceFace[] = [
      { indices: [0, 1, 2], exposed: true, face: def.faces[0] },
      { indices: [0, 1, 3], exposed: true, face: def.faces[1] },
      { indices: [0, 2, 3], exposed: false },
      { indices: [1, 2, 3], exposed: false },
    ];
    return this.assemble(pyraminxEdgePieceVertices(slot), faces, pyraminxEdgeSlotPosition(slot));
  }

  /**
   * Corner piece: octahedron {P1, P2, P3, cFa, cFb, cFc} — 3 exposed faces
   * (one per face meeting at the vertex), the tip-base face, 3 faces shared
   * with the adjacent edge pieces and the center-facing face.
   */
  public createCornerPiece(vertex: PyraminxVertex): Group {
    const neighbors = PYRAMINX_VERTICES_ORDER.filter((v) => v !== vertex);
    const otherFaces = PYRAMINX_VERTICES_ORDER.filter((f) => f !== vertex);
    const pIndex = (x: PyraminxVertex) => neighbors.indexOf(x);
    const cIndex = (f: PyraminxVertex) => 3 + otherFaces.indexOf(f);

    const faces: PieceFace[] = [];
    // Exposed faces: for each face F meeting the vertex, the triangle
    // {P(v→A), P(v→B), cF} where A, B are the two other vertices of face F.
    for (const f of otherFaces) {
      const faceVertices = PYRAMINX_VERTICES_ORDER.filter((v) => v !== f);
      const a = faceVertices.find((v) => v !== vertex)!;
      const b = faceVertices.find((v) => v !== vertex && v !== a)!;
      faces.push({ indices: [pIndex(a), pIndex(b), cIndex(f)], exposed: true, face: f });
    }
    // Tip base (the corner meets the tip along {P1, P2, P3}).
    faces.push({ indices: [0, 1, 2], exposed: false });
    // Faces shared with the 3 adjacent edge pieces.
    for (const x of neighbors) {
      const edge = PYRAMINX_EDGE_SLOTS.find(
        (e) => e.vertices.includes(vertex) && e.vertices.includes(x),
      )!;
      faces.push({
        indices: [pIndex(x), cIndex(edge.faces[0]), cIndex(edge.faces[1])],
        exposed: false,
      });
    }
    // Center-facing face {cFa, cFb, cFc}.
    faces.push({ indices: [3, 4, 5], exposed: false });

    return this.assemble(pyraminxCornerPieceVertices(vertex), faces, pyraminxCornerSlotPosition(vertex));
  }

  /** Tip piece: tetrahedron {V, P1, P2, P3} with rounded apex cap like 2x2/3x3. */
  public createTipPiece(vertex: PyraminxVertex): Group {
    const neighbors = PYRAMINX_VERTICES_ORDER.filter((v) => v !== vertex);
    const fourthVertex = (exclude: readonly PyraminxVertex[]) =>
      PYRAMINX_VERTICES_ORDER.find((candidate) => !exclude.includes(candidate))!;

    const rawVerts = pyraminxTipPieceVertices(vertex);
    const [v0, p1, p2, p3] = rawVerts;

    // Bevel the outer apex (v0) to round the tip of the core like 2x2 and 3x3:
    const b = 0.12;
    const t1 = v0.clone().lerp(p1, b);
    const t2 = v0.clone().lerp(p2, b);
    const t3 = v0.clone().lerp(p3, b);
    const tCenter = t1.clone().add(t2).add(t3).multiplyScalar(1 / 3);
    const tApex = tCenter.clone().add(v0.clone().sub(tCenter).multiplyScalar(0.4));

    const worldVertices = [tApex, t1, t2, t3, p1, p2, p3];

    const f1 = fourthVertex([vertex, neighbors[0], neighbors[1]]);
    const f2 = fourthVertex([vertex, neighbors[0], neighbors[2]]);
    const f3 = fourthVertex([vertex, neighbors[1], neighbors[2]]);

    const faces: PieceFace[] = [
      // Side face 1 (was v0, p1, p2): quad (t1, t2, p2, p1)
      { indices: [1, 2, 5], exposed: true, face: f1 },
      { indices: [1, 5, 4], exposed: true, face: f1 },
      // Side face 2 (was v0, p1, p3): quad (t1, t3, p3, p1)
      { indices: [1, 3, 6], exposed: true, face: f2 },
      { indices: [1, 6, 4], exposed: true, face: f2 },
      // Side face 3 (was v0, p2, p3): quad (t2, t3, p3, p2)
      { indices: [2, 3, 6], exposed: true, face: f3 },
      { indices: [2, 6, 5], exposed: true, face: f3 },
      // Beveled apex dome cap (rounded tip of the core):
      { indices: [0, 1, 2], exposed: true, face: f1 },
      { indices: [0, 3, 1], exposed: true, face: f2 },
      { indices: [0, 2, 3], exposed: true, face: f3 },
      // Base (p1, p2, p3) resting on corner piece:
      { indices: [4, 5, 6], exposed: false },
    ];

    const slotPos = pyraminxTipSlotPosition(vertex);
    const toLocal = (v: Vector3) => v.clone().sub(slotPos);
    const customStickers = [
      { a: toLocal(v0), b: toLocal(p1), c: toLocal(p2), face: f1 },
      { a: toLocal(v0), b: toLocal(p1), c: toLocal(p3), face: f2 },
      { a: toLocal(v0), b: toLocal(p2), c: toLocal(p3), face: f3 },
    ];

    return this.assemble(worldVertices, faces, slotPos, customStickers);
  }

  private assemble(
    worldVertices: Vector3[],
    faces: PieceFace[],
    slotPosition: Vector3,
    customStickers?: { a: Vector3; b: Vector3; c: Vector3; face: PyraminxVertex }[],
  ): Group {
    const { mesh, exposed } = this.buildPiece(worldVertices, faces, slotPosition);

    const group = new Group();
    group.position.copy(slotPosition);
    group.add(mesh);

    // Sticker panels (stickered skin only; hidden in stickerless where the
    // core faces are already colored).
    const isStickerless = this.style.skinType === 'stickerless';
    const stickerList = customStickers ?? exposed;
    for (const tri of stickerList) {
      const sticker = this.createSticker(tri, this.stickerMaterials[tri.face]);
      sticker.visible = !isStickerless;
      group.add(sticker);
    }
    return group;
  }

  /**
   * Live-update the visual style WITHOUT rebuilding pieces: sticker/plastic
   * colors and the core color apply to the shared materials instantly
   * (every piece references them). `skinType` toggles sticker visibility
   * (stickered shows panels, stickerless shows colored plastic).
   *
   * `stickerInset` is a geometry property — changing it requires rebuilding
   * the pieces and is intentionally NOT handled here.
   */
  public updateStyle(newStyle: Partial<PyraminxStyleOptions>): void {
    if (newStyle.stickerColors !== undefined) {
      this.style.stickerColors = { ...this.style.stickerColors, ...newStyle.stickerColors };
      for (const face of PYRAMINX_VERTICES_ORDER) {
        this.stickerMaterials[face].color.set(this.style.stickerColors[face]);
        this.stickerlessFaceMaterials[face].color.set(this.style.stickerColors[face]);
      }
    }
    if (newStyle.coreColor !== undefined && newStyle.coreColor !== this.style.coreColor) {
      this.style.coreColor = newStyle.coreColor;
      this.coreMaterial.color.set(newStyle.coreColor);
      this.seamMaterial.color.set(newStyle.coreColor);
    }
    if (newStyle.skinType !== undefined && newStyle.skinType !== this.style.skinType) {
      this.style.skinType = newStyle.skinType;
    }
  }

  public getStyle(): Readonly<PyraminxStyleOptions> {
    return { ...this.style };
  }

  public dispose(): void {
    this.coreMaterial.dispose();
    this.seamMaterial.dispose();
    for (const face of PYRAMINX_VERTICES_ORDER) {
      this.stickerMaterials[face].dispose();
      this.stickerlessFaceMaterials[face].dispose();
    }
  }
}
