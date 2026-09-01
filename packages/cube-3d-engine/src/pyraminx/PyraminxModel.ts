import { Group, Vector3 } from 'three';
import type { PyraminxState } from '@cubeforge/solver-engine/pyraminx';
import { PyraminxMeshFactory } from './PyraminxMeshFactory';
import {
  PYRAMINX_EDGE_SLOTS,
  PYRAMINX_TURNS,
  PYRAMINX_VERTEX_EDGES,
  PYRAMINX_VERTEX_INDEX,
  PYRAMINX_VERTICES_ORDER,
  pyraminxCornerSlotPosition,
  pyraminxEdgeSlotPosition,
  pyraminxTipSlotPosition,
  type PyraminxVertex,
} from './PyraminxGeometry';

export type PyraminxPieceKind = 'edge' | 'corner' | 'tip';

/**
 * Logical state of one Pyraminx piece — INDEPENDENT of the scene graph (same
 * philosophy as the cube's `CubieLogicalState`): the driver animates the
 * meshes, and this mirror records where each piece is and how it is oriented,
 * so positions can be snapped exactly and the packed state exported.
 *
 *   • edges   permute between the 6 edge slots and flip (2 orientations)
 *   • corners never move — fixed position, rotate in place (3 orientations)
 *   • tips    never move — fixed position, rotate in place (3 orientations)
 */
export interface PyraminxPiece {
  readonly kind: PyraminxPieceKind;
  /** Home slot index (edges 0..5, corners/tips 0..3 by vertex). */
  readonly home: number;
  /** Current slot index. */
  current: number;
  /** Edge flip (normal / flipped). Corners and tips keep this false. */
  flipped: boolean;
  /** Corner/tip twist orientation 0..2. Edges keep this 0. */
  orientation: number;
  /** The Three.js Group (core + stickers). */
  readonly mesh: Group;
}

// ── Packed-state codecs (mirror of PyraminxSolver's encodings) ──────────────

/** Factoradic rank of a permutation given as the piece at each position. */
function rankPermutation(piecesAtPositions: readonly number[]): number {
  const remaining = [0, 1, 2, 3, 4, 5];
  let rank = 0;
  for (let i = 0; i < 5; i++) {
    const offset = remaining.indexOf(piecesAtPositions[i]);
    rank = rank * (6 - i) + offset;
    remaining.splice(offset, 1);
  }
  return rank;
}

/** Pack the orientations of edges 0..4 into 5 bits (edge 5 is derived). */
function encodeEdgeOrientations(orientations: readonly number[]): number {
  let code = 0;
  for (let i = 0; i < 5; i++) code = (code << 1) | orientations[i];
  return code;
}

/** Pack 4 base-3 values (corners or tips) into [0, 81). */
function encodeBase3(values: readonly number[]): number {
  let code = 0;
  for (const value of values) code = code * 3 + value;
  return code;
}

/**
 * Pyraminx model — owns the 14 pieces, their logical mirror and the exact
 * slot positions used to snap mesh transforms after a turn.
 *
 * The move semantics (`applyLayerTurn` / `applyTipTurn`) are byte-for-byte
 * the scrambler's `applyTurn` semantics: the cross-validation tests prove
 * `getState()` equals `applyPyraminxMove` + `applyPyraminxTip` for every
 * move, so the 3D model and the WCA scrambler can never drift apart.
 */
export class PyraminxModel {
  public readonly root: Group;
  /** The 6 edge pieces, indexed by their HOME slot. */
  public readonly edges: PyraminxPiece[];
  /** The 4 corner pieces, indexed by vertex (U=0, L=1, R=2, B=3). */
  public readonly corners: PyraminxPiece[];
  /** The 4 tip pieces, indexed by vertex. */
  public readonly tips: PyraminxPiece[];
  /** The 14 pieces in one array. */
  public readonly pieces: PyraminxPiece[];

  /** Edge piece currently AT each slot (the permutation array). */
  private edgeAtSlot: PyraminxPiece[] = [];

  constructor(factory: PyraminxMeshFactory) {
    this.root = new Group();
    this.edges = [];
    this.corners = [];
    this.tips = [];

    for (let slot = 0; slot < PYRAMINX_EDGE_SLOTS.length; slot++) {
      const mesh = factory.createEdgePiece(slot);
      this.root.add(mesh);
      const piece: PyraminxPiece = {
        kind: 'edge',
        home: slot,
        current: slot,
        flipped: false,
        orientation: 0,
        mesh,
      };
      this.edges.push(piece);
      this.edgeAtSlot[slot] = piece;
    }

    for (const vertex of PYRAMINX_VERTICES_ORDER) {
      const index = PYRAMINX_VERTEX_INDEX[vertex];
      const cornerMesh = factory.createCornerPiece(vertex);
      this.root.add(cornerMesh);
      this.corners.push({
        kind: 'corner',
        home: index,
        current: index,
        flipped: false,
        orientation: 0,
        mesh: cornerMesh,
      });

      const tipMesh = factory.createTipPiece(vertex);
      this.root.add(tipMesh);
      this.tips.push({
        kind: 'tip',
        home: index,
        current: index,
        flipped: false,
        orientation: 0,
        mesh: tipMesh,
      });
    }

    this.pieces = [...this.edges, ...this.corners, ...this.tips];
  }

  // ── Slot lookups ─────────────────────────────────────────────────────────

  /** The edge piece currently occupying `slot`. */
  public edgePieceAtSlot(slot: number): PyraminxPiece {
    const piece = this.edgeAtSlot[slot];
    if (!piece) throw new Error(`No edge piece at slot ${slot}`);
    return piece;
  }

  /** The corner piece at vertex v (fixed position). */
  public cornerAt(vertex: PyraminxVertex): PyraminxPiece {
    return this.corners[PYRAMINX_VERTEX_INDEX[vertex]];
  }

  /** The tip piece at vertex v (fixed position). */
  public tipAt(vertex: PyraminxVertex): PyraminxPiece {
    return this.tips[PYRAMINX_VERTEX_INDEX[vertex]];
  }

  /** The 5 Groups of a full layer turn at a vertex: 3 edges + corner + tip. */
  public getLayerPieces(vertex: PyraminxVertex): Group[] {
    return [
      ...PYRAMINX_VERTEX_EDGES[vertex].map((slot) => this.edgeAtSlot[slot].mesh),
      this.cornerAt(vertex).mesh,
      this.tipAt(vertex).mesh,
    ];
  }

  /** The single Group of a tip-only turn at a vertex. */
  public getTipPieces(vertex: PyraminxVertex): Group[] {
    return [this.tipAt(vertex).mesh];
  }

  /** Exact world position of a piece's CURRENT slot (snap target). */
  public slotPositionOf(piece: PyraminxPiece): Vector3 {
    if (piece.kind === 'edge') return pyraminxEdgeSlotPosition(piece.current);
    const vertex = PYRAMINX_VERTICES_ORDER[piece.current];
    return piece.kind === 'corner'
      ? pyraminxCornerSlotPosition(vertex)
      : pyraminxTipSlotPosition(vertex);
  }

  /** All piece Groups (for raycasting / picking). */
  public getAllPieces(): Group[] {
    return this.pieces.map((p) => p.mesh);
  }

  // ── Moves (logical mirror of the scrambler's applyTurn) ─────────────────

  /**
   * Apply one full layer turn at a vertex (edges permute + flip, the vertex's
   * corner twists). Mirrors the scrambler's `applyTurn` exactly: the piece at
   * cycle[0] moves to cycle[1], etc., flipping when its DESTINATION is in the
   * turn's flips list. The single step is the WCA CLOCKWISE turn (viewed from
   * the vertex), so the vertex's own corner twists by +2 per step (the same
   * convention as the solver). Tips are NOT touched here — a physical layer
   * turn also rotates the tip, so callers compose `applyTipTurn` (same as the
   * WCA scramble, which appends tip turns separately).
   */
  public applyLayerTurn(vertex: PyraminxVertex, steps: 1 | 2): void {
    const turn = PYRAMINX_TURNS[PYRAMINX_VERTEX_INDEX[vertex]];
    const [a, b, c] = turn.cycle;
    for (let s = 0; s < steps; s++) {
      const pieceA = this.edgeAtSlot[a];
      const pieceB = this.edgeAtSlot[b];
      const pieceC = this.edgeAtSlot[c];

      this.edgeAtSlot[b] = pieceA;
      if (turn.flips.includes(b)) pieceA.flipped = !pieceA.flipped;
      this.edgeAtSlot[c] = pieceB;
      if (turn.flips.includes(c)) pieceB.flipped = !pieceB.flipped;
      this.edgeAtSlot[a] = pieceC;
      if (turn.flips.includes(a)) pieceC.flipped = !pieceC.flipped;

      const corner = this.corners[PYRAMINX_VERTEX_INDEX[vertex]];
      corner.orientation = (corner.orientation + 2) % 3;
    }
    // Sync every piece's current slot with the permutation array.
    for (let slot = 0; slot < this.edgeAtSlot.length; slot++) {
      this.edgeAtSlot[slot].current = slot;
    }
  }

  /** Apply a tip-only turn at a vertex (the tip twists in place, +2 per step). */
  public applyTipTurn(vertex: PyraminxVertex, steps: 1 | 2): void {
    const tip = this.tipAt(vertex);
    tip.orientation = (tip.orientation + 2 * steps) % 3;
  }

  // ── State export / reset ────────────────────────────────────────────────

  /**
   * Packed state in the solver's encoding (see {@link PyraminxState}).
   *
   * IMPORTANT — the solver encodes edge orientations BY SLOT, not by piece:
   * bit i is the orientation of the piece currently AT slot i (edge 5 is
   * derived by XOR). Mirroring this exactly is what makes `getState()` equal
   * `applyPyraminxMove` for arbitrary sequences.
   */
  public getState(): PyraminxState {
    const perm: number[] = [];
    const orientations = [0, 0, 0, 0, 0, 0];
    for (let slot = 0; slot < 6; slot++) {
      perm.push(this.edgeAtSlot[slot].home);
      orientations[slot] = this.edgeAtSlot[slot].flipped ? 1 : 0;
    }
    return {
      edgePerm: rankPermutation(perm),
      edgeOrient: encodeEdgeOrientations(orientations.slice(0, 5)),
      cornerOrient: encodeBase3(this.corners.map((c) => c.orientation)),
      tips: encodeBase3(this.tips.map((t) => t.orientation)),
    };
  }

  /** Whether every piece is home, unflipped and untwisted. */
  public isSolved(): boolean {
    return this.pieces.every(
      (p) => p.current === p.home && !p.flipped && p.orientation === 0,
    );
  }

  /** Restore the solved state (positions AND orientations). */
  public reset(): void {
    for (let slot = 0; slot < 6; slot++) this.edgeAtSlot[slot] = this.edges[slot];
    for (const piece of this.pieces) {
      piece.current = piece.home;
      piece.flipped = false;
      piece.orientation = 0;
      piece.mesh.position.copy(this.slotPositionOf(piece));
      piece.mesh.quaternion.identity();
    }
  }

  /**
   * Snap piece transforms onto the logical state: exact slot positions (zero
   * float drift after thousands of rotations) + quaternion normalization.
   * Only the given pieces are snapped (the driver's snap hook receives the
   * slice it just rotated).
   */
  public snapPieces(pieces: Group[]): void {
    for (const piece of this.pieces) {
      if (!pieces.includes(piece.mesh)) continue;
      piece.mesh.position.copy(this.slotPositionOf(piece));
      piece.mesh.quaternion.normalize();
    }
  }
}
