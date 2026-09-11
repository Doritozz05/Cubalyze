import { Mesh, Object3D, Quaternion, Raycaster, Vector2, Vector3 } from 'three';
import type { PyraminxState } from '@cubeforge/solver-engine/pyraminx';
import type { CubeStyleOptions } from '../core/CubeMeshFactory';
import { SceneManager } from '../core/SceneManager';
import {
  RotationDriver3D,
  type RotationHooks3D,
  type SliceRef3D,
} from '../animation/RotationDriver3D';
import type { EasingStrategy } from '../animation/Easing';
import {
  PYRAMINX_AXES,
  PYRAMINX_CANONICAL_QUAT,
  PYRAMINX_EDGE_SLOTS,
  PYRAMINX_ISOMETRIC_PHI_RAD,
  PYRAMINX_ISOMETRIC_THETA_RAD,
  PYRAMINX_TILT_AXIS,
  PYRAMINX_VERTICES_ORDER,
  TETRAHEDRAL_TILT_ANGLE,
  isValidPyraminxMoveString,
  resolvePyraminxMoveToken,
  snapPyraminxGrip,
  conjugatePyraminxToken,
  type PyraminxVertex,
} from './PyraminxGeometry';
import { PyraminxMeshFactory, type PyraminxStyleOptions } from './PyraminxMeshFactory';
import { PyraminxModel } from './PyraminxModel';

export interface PyraminxEngineOptions {
  canvas: HTMLCanvasElement | OffscreenCanvas;
  width: number;
  height: number;
  pixelRatio?: number;
  /** Mark this context as disposable for the global WebGL context manager. */
  contextEvictable?: boolean;
  /** Called when the global context manager force-evicts this context. */
  onContextEvicted?: () => void;
  /** Visual appearance. */
  style?: Partial<PyraminxStyleOptions>;
  /** Visual scale of the puzzle in the scene (default 1.8). */
  scale?: number;
}

/** A Pyraminx slice: a full layer or a tip at one vertex, around its axis. */
export interface PyraminxSliceRef extends SliceRef3D {
  id: { vertex: PyraminxVertex; scope: 'layer' | 'tip' };
}

/** One possible turn for a picked piece (edges offer their two endpoints). */
export interface PyraminxPickCandidate {
  vertex: PyraminxVertex;
  scope: 'layer' | 'tip';
}

/**
 * Result of a sticker pick (raycast): the piece, its world-frame slot
 * position and the candidate turns a drag on it can resolve. A tip turns
 * only itself (`scope: 'tip'`); a corner only its layer; an edge piece can
 * turn around either of its slot's two vertices.
 */
export interface PyraminxPick {
  kind: 'edge' | 'corner' | 'tip';
  /** Piece slot position in the WORLD frame. */
  position: Vector3;
  candidates: PyraminxPickCandidate[];
  /** The face of the pyraminx hit (if known). */
  face?: PyraminxVertex;
  /** World-space outward normal of the hit face. */
  normal?: Vector3;
}

/**
 * Maps the CUBE skin's face colors onto the Pyraminx's 4 faces, preserving
 * the WCA 4d2 pyraminx scheme: yellow on the BOTTOM, GREEN on the FRONT, red
 * on the left and blue on the right (U=yellow, B=green, L=red, R=blue). The
 * cube's D/F/R/B faces carry exactly those colors in the default cube skin
 * (D=yellow, F=green, R=red, B=blue), so the panel's skin updates
 * (getSkinStyle) apply consistently to both puzzles.
 *
 * The FRONT face is the key constraint: a face is named after the OPPOSITE
 * vertex, and in the canonical pose the B vertex sits at the BACK, so face B
 * faces the camera. Assigning face B the cube's F (green) makes the canonical
 * pose the WCA 4d2 scramble hold — which is what the virtual view and the
 * reconstruction replay both seed from.
 */
const CUBE_FACE_TO_PYRAMINX: Record<PyraminxVertex, keyof CubeStyleOptions['stickerColors']> = {
  U: 'D', // yellow — bottom
  B: 'F', // green  — front
  L: 'R', // red    — left
  R: 'B', // blue   — right
};

/**
 * Signed turn steps from a driver angle. The plain WCA token is the CLOCKWISE
 * turn (WCA 12e2 — −120° right-hand around the outward axis), which is ONE
 * logical step; the prime (+120°) is the counter-clockwise turn = two steps.
 * (0 → no-op.)
 */
function stepsFromAngle(angleInDegrees: number): number {
  return ((Math.round(-angleInDegrees / 120) % 3) + 3) % 3;
}

export {
  PYRAMINX_CANONICAL_QUAT,
  TETRAHEDRAL_TILT_ANGLE,
  PYRAMINX_TILT_AXIS,
};

/**
 * The family-specific hooks that wire the generic {@link RotationDriver3D}
 * to the Pyraminx model. Exported so tests can drive the REAL hooks without
 * constructing a WebGL engine.
 */
export function createPyraminxRotationHooks(
  model: PyraminxModel,
): RotationHooks3D<PyraminxSliceRef> {
  return {
    getSlicePieces: (slice) =>
      slice.id.scope === 'layer'
        ? model.getLayerPieces(slice.id.vertex)
        : model.getTipPieces(slice.id.vertex),
    commitSlice: (slice, angleInDegrees) => {
      const steps = stepsFromAngle(angleInDegrees);
      if (steps === 0) return;
      if (slice.id.scope === 'layer') model.applyLayerTurn(slice.id.vertex, steps as 1 | 2);
      model.applyTipTurn(slice.id.vertex, steps as 1 | 2);
    },
    snapPieces: (pieces) => model.snapPieces(pieces),
  };
}

/**
 * Pyraminx 3D engine — the first non-cube puzzle family.
 *
 * Architecture mirrors {@link Cube3DEngine}:
 *   • {@link SceneManager} owns the Three.js scene, camera, lights, resize
 *     and render loop.
 *   • {@link PyraminxMeshFactory} builds the piece meshes.
 *   • {@link PyraminxModel} owns the 14 piece Groups, their logical state,
 *     and the exact slot positions used to snap transforms after turns.
 *   • {@link RotationDriver3D} animates the turns using pooled pivot groups
 *     and quaternions, with collision detection against in-flight moves.
 *
 * The move semantics match the WCA scrambler (`@cubeforge/solver-engine`)
 * byte for byte — the tests cross-validate `getState()` against
 * `applyPyraminxMove` / `applyPyraminxTip`.
 */
export class PyraminxEngine {
  public sceneManager!: SceneManager;
  public factory!: PyraminxMeshFactory;
  public model!: PyraminxModel;
  public driver!: RotationDriver3D<PyraminxSliceRef>;

  private onContextEvictedCb?: () => void;
  private readonly scale: number;

  private lastTime = 0;
  private isRunning = false;
  private animFrameId: number | null = null;
  private needsRender = false;

  private cameraMomentumState: 'idle' | 'dragging' | 'gliding' = 'idle';
  private cameraMomentum: { x: number; y: number; lastApplyTime: number } | null = null;
  private readonly cameraMomentumThreshold = 0.01;
  private readonly cameraMomentumDecay = 0.88;

  private cameraAnim: {
    startTheta: number;
    startPhi: number;
    startRadius: number;
    targetTheta: number;
    targetPhi: number;
    targetRadius: number;
    startTime: number;
    durationMs: number;
    resolve?: () => void;
  } | null = null;

  /** Whole-puzzle orientation state. */
  private puzzleQuat = PYRAMINX_CANONICAL_QUAT.clone();

  private puzzleAnim: {
    startQuat: Quaternion;
    targetQuat: Quaternion;
    startTime: number;
    durationMs: number;
    resolve?: () => void;
  } | null = null;

  constructor(options: PyraminxEngineOptions) {
    const {
      canvas,
      width,
      height,
      pixelRatio = 1,
      contextEvictable = false,
      onContextEvicted,
      style,
      scale = 1.8,
    } = options;
    this.onContextEvictedCb = onContextEvicted;
    this.scale = scale;

    this.sceneManager = new SceneManager(canvas, width, height, pixelRatio, {
      evictable: contextEvictable,
      onContextEvicted: () => {
        this.isRunning = false;
        if (this.animFrameId !== null) {
          cancelAnimationFrame(this.animFrameId);
          this.animFrameId = null;
        }
        this.needsRender = false;
        this.onContextEvictedCb?.();
      },
    });

    this.factory = new PyraminxMeshFactory(style);
    this.model = new PyraminxModel(this.factory);
    this.model.root.scale.setScalar(this.scale);
    this.model.root.quaternion.copy(this.puzzleQuat);
    this.sceneManager.scene.add(this.model.root);

    this.driver = new RotationDriver3D<PyraminxSliceRef>(
      this.model.root,
      createPyraminxRotationHooks(this.model),
    );

    this.isRunning = true;
    this.lastTime = performance.now();
    this.needsRender = true;
    this.animFrameId = requestAnimationFrame(this.loop);
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  public isContextEvicted(): boolean {
    return !this.isRunning || (this.sceneManager?.isContextEvicted() ?? false);
  }

  public requestRender(): void {
    if (!this.isRunning) return;
    if (this.sceneManager?.isContextEvicted()) return;
    this.needsRender = true;
    if (this.animFrameId === null) {
      this.lastTime = performance.now();
      this.animFrameId = requestAnimationFrame(this.loop);
    }
  }

  public resize(width: number, height: number): void {
    if (this.sceneManager && width > 0 && height > 0) {
      this.sceneManager.resize(width, height);
      this.requestRender();
    }
  }

  public dispose(): void {
    this.isRunning = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.needsRender = false;
    this.cameraMomentum = null;
    this.cameraMomentumState = 'idle';
    this.finishCameraAnim();
    this.finishPuzzleAnim();
    if (this.sceneManager) this.sceneManager.dispose();
    if (this.factory) this.factory.dispose();
  }

  // ── Moves ────────────────────────────────────────────────────────────────

  private sliceRef(vertex: PyraminxVertex, scope: 'layer' | 'tip'): PyraminxSliceRef {
    return { id: { vertex, scope }, axis: PYRAMINX_AXES[vertex] };
  }

  public rotateVertex(
    vertex: PyraminxVertex,
    scope: 'layer' | 'tip',
    angleInDegrees: number,
    durationMs = 160,
    easingStrategy?: EasingStrategy,
  ): Promise<void> {
    if (!this.driver) return Promise.resolve();
    this.requestRender();
    return this.driver
      .rotate(this.sliceRef(vertex, scope), angleInDegrees, durationMs, undefined, easingStrategy)
      .then(() => {
        if (this.onMoveEventCb) {
          const base = scope === 'tip' ? vertex.toLowerCase() : vertex;
          const steps = stepsFromAngle(angleInDegrees);
          this.onMoveEventCb(base + (steps === 2 ? "'" : ''));
        }
      });
  }

  /**
   * Apply a single WCA move token (U, U', L, …, u, u', …). Returns false for
   * unparseable tokens without turning anything.
   */
  public applyMove(token: string, durationMs = 160): Promise<boolean> {
    const resolved = resolvePyraminxMoveToken(token);
    if (!resolved) return Promise.resolve(false);
    return this.rotateVertex(
      resolved.vertex,
      resolved.scope,
      resolved.angleInDegrees,
      durationMs,
    ).then(() => true);
  }

  /**
   * Animate a full scramble sequence (space-delimited WCA tokens). Tokens
   * run in series; invalid tokens are skipped.
   */
  public async applyScrambleAnimated(scramble: string, durationMs = 120): Promise<boolean> {
    const trimmed = (scramble ?? '').trim();
    if (!isValidPyraminxMoveString(trimmed)) return false;
    const tokens = trimmed.split(/\s+/).filter(Boolean);
    for (const token of tokens) {
      await this.applyMove(token, durationMs);
    }
    this.requestRender();
    return true;
  }

  /** True when any pivot task is still animating (for the render loop). */
  public isAnimating(): boolean {
    return (this.driver?.isAnimating() ?? false) || this.puzzleAnim !== null;
  }

  /** Force-complete every in-flight turn and restore the solved state. */
  public reset(): void {
    if (this.driver) this.driver.flushAll();
    if (this.model) this.model.reset();
    this.finishPuzzleAnim();
    this.puzzleQuat.copy(PYRAMINX_CANONICAL_QUAT);
    if (this.model?.root) this.model.root.quaternion.copy(this.puzzleQuat);
    this.requestRender();
  }

  public getState(): PyraminxState {
    return this.model?.getState() ?? { edgePerm: 0, edgeOrient: 0, cornerOrient: 0, tips: 0 };
  }

  // ── Skin / style ────────────────────────────────────────────────────

  /**
   * Apply a CUBE skin (the shared `getSkinStyle` output) to the Pyraminx.
   *
   * The pyraminx factory speaks the EXACT same skin vocabulary as the cube's
   * CubeMeshFactory (stickered / stickerless / coreless / translucent, plus
   * coreColor, coreOpacity, seamColor, pieceSize and floatingStickers), so
   * every field passes through 1:1 — only the sticker COLORS are remapped
   * face-by-face through {@link CUBE_FACE_TO_PYRAMINX} to preserve the WCA
   * 4d2 pyraminx scheme (U=yellow bottom, B=green front, L=red left,
   * R=blue right). Same skins, same mechanisms, same look — adapted to the
   * tetrahedral geometry.
   */
  public updateStyle(style: Partial<CubeStyleOptions>): void {
    if (!this.factory || !this.model) return;
    if (style.stickerColors) {
      const mapped: Partial<Record<PyraminxVertex, string>> = {};
      for (const face of ['U', 'L', 'R', 'B'] as const) {
        const cubeFace = CUBE_FACE_TO_PYRAMINX[face];
        if (style.stickerColors[cubeFace]) mapped[face] = style.stickerColors[cubeFace];
      }
      if (Object.keys(mapped).length > 0) {
        this.factory.updateStyle({ stickerColors: mapped as Record<PyraminxVertex, string> });
      }
    }
    const passthrough: Partial<PyraminxStyleOptions> = {};
    if (style.skinType !== undefined) passthrough.skinType = style.skinType;
    if (style.coreColor !== undefined) passthrough.coreColor = style.coreColor;
    if (style.coreOpacity !== undefined) passthrough.coreOpacity = style.coreOpacity;
    if (style.seamColor !== undefined) passthrough.seamColor = style.seamColor;
    if (style.cubieSize !== undefined) passthrough.pieceSize = style.cubieSize;
    if (style.floatingStickers !== undefined) passthrough.floatingStickers = style.floatingStickers;
    this.factory.updateStyle(passthrough);
    this.requestRender();
  }

  // ── Move events (for the UI moves strip) ───────────────────────────────

  private onMoveEventCb?: (notation: string) => void;

  public onMoveEvent(cb: (notation: string) => void): void {
    this.onMoveEventCb = cb;
  }

  // ── Picking (virtual-cube drags) ─────────────────────────────────────────

  /**
   * Raycast the sticker under a normalized device coordinate (−1..1) and
   * return the piece + its turn candidates, or null when the pointer misses
   * the puzzle (background).
   */
  public pickSticker(ndcX: number, ndcY: number): PyraminxPick | null {
    if (!this.sceneManager?.camera || !this.model) return null;
    if (!Number.isFinite(ndcX) || !Number.isFinite(ndcY)) return null;
    this.sceneManager.camera.updateMatrixWorld(true);
    this.model.root.updateMatrixWorld(true);
    const raycaster = new Raycaster();
    raycaster.setFromCamera(new Vector2(ndcX, ndcY), this.sceneManager.camera);
    const meshes: Object3D[] = [];
    this.model.root.traverse((obj) => {
      if ((obj as Mesh).isMesh) meshes.push(obj);
    });
    const hits = raycaster.intersectObjects(meshes, false);
    if (hits.length === 0) return null;

    const rayDir = raycaster.ray.direction.clone().normalize();
    let hit: (typeof hits)[0] | null = null;
    let fallbackHit: (typeof hits)[0] | null = null;

    for (const h of hits) {
      if (!h.face) continue;
      const worldNormal = new Vector3(h.face.normal.x, h.face.normal.y, h.face.normal.z);
      h.object.updateWorldMatrix(true, false);
      worldNormal.transformDirection(h.object.matrixWorld);
      // Front-facing: normal points toward the camera (against the ray direction)
      if (worldNormal.dot(rayDir) >= -0.01) continue;

      // Floating projection twins face INWARD and float above the surface —
      // never a valid drag target (same rule as Cube3DEngine picking).
      if (h.object.userData?.isFloatingSticker === true) continue;

      const isSticker = Boolean(h.object.userData?.pyraminxSticker);
      if (isSticker) {
        hit = h;
        break;
      }
      if (!fallbackHit) fallbackHit = h;
    }
    if (!hit) hit = fallbackHit;
    if (!hit) return null;

    // Walk up from the hit mesh to its piece Group (a direct child of root).
    let node: Object3D | null = hit.object;
    while (node && node.parent !== this.model.root) node = node.parent;
    if (!node) return null;
    const piece = this.model.pieces.find((p) => p.mesh === node);
    if (!piece) return null;

    // Use the exact 3D surface point clicked on the piece
    const hitPoint = hit.point.clone();
    const hitFace = hit.object.userData?.face as PyraminxVertex | undefined;
    let hitNormal: Vector3 | undefined;
    if (hit.face) {
      hitNormal = new Vector3(hit.face.normal.x, hit.face.normal.y, hit.face.normal.z);
      hitNormal.transformDirection(hit.object.matrixWorld).normalize();
    }

    if (piece.kind === 'edge') {
      const def = PYRAMINX_EDGE_SLOTS[piece.current];
      return {
        kind: 'edge',
        position: hitPoint,
        candidates: [
          { vertex: def.vertices[0], scope: 'layer' },
          { vertex: def.vertices[1], scope: 'layer' },
        ],
        face: hitFace,
        normal: hitNormal,
      };
    }
    const vertex = PYRAMINX_VERTICES_ORDER[piece.current];
    return {
      kind: piece.kind,
      position: hitPoint,
      candidates: [
        { vertex, scope: piece.kind === 'tip' ? 'tip' : 'layer' },
      ],
      face: hitFace,
      normal: hitNormal,
    };
  }

  // ── Camera & Views ────────────────────────────────────────────────────────

  /**
   * Canonical isometric framing:
   * The pyramid stands upright with its base flat and level ("base recta").
   * Viewed from an angle (theta ≈ 30°, phi ≈ 22°) so the right tip is down-right
   * and both the front face and the right face are visible, while the bottom and
   * back faces remain hidden.
   */
  public static readonly CANONICAL_ISOMETRIC_VIEW = {
    theta: PYRAMINX_ISOMETRIC_THETA_RAD,
    phi: PYRAMINX_ISOMETRIC_PHI_RAD,
    radius: 7,
  };

  /**
   * Continuous turntable orbit camera (identical to Cube3DEngine).
   * Used in 3D panels/widgets and replays/reconstructions.
   */
  public rotateCamera(dx: number, dy: number): void {
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
    this.finishCameraAnim();
    if (this.sceneManager) {
      this.sceneManager.rotateCamera(dx, dy);
    }
    if (this.cameraMomentumState !== 'idle') {
      this.cameraMomentum = { x: dx, y: dy, lastApplyTime: performance.now() };
    }
    this.requestRender();
  }

  public setCameraDragActive(active: boolean): void {
    if (active) {
      this.finishCameraAnim();
      this.cameraMomentumState = 'dragging';
      this.cameraMomentum = null;
    } else if (this.cameraMomentumState === 'dragging') {
      if (this.cameraMomentum) {
        this.cameraMomentumState = 'gliding';
        this.cameraMomentum = { ...this.cameraMomentum, lastApplyTime: performance.now() };
      } else {
        this.cameraMomentumState = 'idle';
      }
    }
  }

  public zoomCamera(deltaY: number): void {
    if (!this.sceneManager) return;
    if (!Number.isFinite(deltaY) || deltaY === 0) return;
    const factor = Math.exp(deltaY / 1200);
    this.sceneManager.zoomBy(factor);
    this.requestRender();
  }

  public resetCamera(smooth = false): Promise<void> | void {
    if (!this.sceneManager) return;
    const view = PyraminxEngine.CANONICAL_ISOMETRIC_VIEW;
    if (smooth) {
      return this.animateCameraTo(view.theta, view.phi, view.radius);
    }
    this.cameraMomentum = null;
    this.cameraMomentumState = 'idle';
    this.finishCameraAnim();
    this.sceneManager.setOrbitAngles(view.theta, view.phi, view.radius);
    this.requestRender();
  }

  public setIsometricView(smooth = false, radius?: number): Promise<void> | void {
    if (!this.sceneManager) return;
    const view = PyraminxEngine.CANONICAL_ISOMETRIC_VIEW;
    const r = radius ?? view.radius;
    if (smooth) {
      return this.animateCameraTo(view.theta, view.phi, r);
    }
    this.cameraMomentum = null;
    this.cameraMomentumState = 'idle';
    this.finishCameraAnim();
    this.sceneManager.setOrbitAngles(view.theta, view.phi, r);
    this.requestRender();
  }

  private animateCameraTo(
    targetTheta: number,
    targetPhi: number,
    targetRadius = 7,
    durationMs = 260,
  ): Promise<void> {
    return new Promise((resolve) => {
      if (!this.sceneManager) {
        resolve();
        return;
      }
      this.cameraMomentum = null;
      this.cameraMomentumState = 'idle';
      const current = this.sceneManager.getOrbitAngles();
      if (durationMs <= 0) {
        this.finishCameraAnim();
        this.sceneManager.setOrbitAngles(targetTheta, targetPhi, targetRadius);
        this.requestRender();
        resolve();
        return;
      }
      this.finishCameraAnim();
      let dTheta = (targetTheta - current.theta) % (Math.PI * 2);
      if (dTheta > Math.PI) dTheta -= Math.PI * 2;
      if (dTheta < -Math.PI) dTheta += Math.PI * 2;
      this.cameraAnim = {
        startTheta: current.theta,
        startPhi: current.phi,
        startRadius: current.radius,
        targetTheta: current.theta + dTheta,
        targetPhi,
        targetRadius,
        startTime: performance.now(),
        durationMs,
        resolve,
      };
      this.requestRender();
    });
  }

  private finishCameraAnim(): void {
    const anim = this.cameraAnim;
    this.cameraAnim = null;
    anim?.resolve?.();
  }

  // ── Whole-Puzzle Rotations (Virtual Pyraminx) ───────────────────────────

  /**
   * Lateral drone rotation around the vertical Y axis:
   * direction: -1 = turn right (clockwise from above), 1 = turn left.
   * Steps by 120° (3-fold symmetry), showing the 3 lateral faces.
   */
  public rotatePuzzleY(direction: 1 | -1, durationMs = 180): Promise<void> {
    const angle = direction * ((120 * Math.PI) / 180);
    const rot = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), angle);
    const target = rot.multiply(this.puzzleQuat).normalize();
    return this.animatePuzzleTo(target, durationMs);
  }

  /**
   * Smooth tilt rotation downward/upward:
   * Rotates 180° around the horizontal X axis (PYRAMINX_TILT_AXIS = (1, 0, 0)),
   * cleanly inverting the Pyraminx so the base is on top (y = +1/3) and the apex
   * points down (y = -1), giving a direct, canonical view of the bottom face.
   */
  public rotatePuzzleX(direction: 1 | -1, durationMs = 220): Promise<void> {
    const rot = new Quaternion().setFromAxisAngle(PYRAMINX_TILT_AXIS, direction * Math.PI);
    const target = rot.multiply(this.puzzleQuat).normalize();
    return this.animatePuzzleTo(target, durationMs);
  }

  /** Reset whole-puzzle orientation back to canonical upright. */
  public resetPuzzleOrientation(smooth = false): Promise<void> {
    if (smooth) {
      return this.animatePuzzleTo(PYRAMINX_CANONICAL_QUAT.clone(), 200);
    }
    this.finishPuzzleAnim();
    this.puzzleQuat.copy(PYRAMINX_CANONICAL_QUAT);
    this.model?.root.quaternion.copy(this.puzzleQuat);
    this.requestRender();
    return Promise.resolve();
  }

  /**
   * Backward-compatibility helper for discrete steps. Returns the rotation
   * promise so callers can await the step settling (e.g. to re-read the
   * A₄ grip for a view-adapted scramble display). Ignoring the return
   * keeps the legacy fire-and-forget behavior.
   */
  public orbitStep(dx: number, dy: number, durationMs = 180): Promise<void> {
    if (Math.abs(dx) >= Math.abs(dy)) {
      return this.rotatePuzzleY(dx > 0 ? 1 : -1, durationMs);
    }
    return this.rotatePuzzleX(dy > 0 ? 1 : -1, durationMs);
  }

  /** The world-space rotation axis for a vertex given the current puzzle orientation. */
  public getWorldAxis(vertex: PyraminxVertex): Vector3 {
    const v = PYRAMINX_AXES[vertex].clone();
    if (this.model?.root) {
      v.applyQuaternion(this.model.root.quaternion);
    }
    return v;
  }

  /** Current whole-puzzle quaternion. */
  public getPuzzleQuaternion(): Quaternion {
    return this.puzzleQuat.clone();
  }

  /**
   * Snap current puzzle quaternion to the closest A₄ grip index (0..11)
   * using max-|dot| inner product.
   */
  public getGripIndex(): number {
    return snapPyraminxGrip(this.puzzleQuat).grip;
  }

  /**
   * Conjugate a view-relative keyboard token by the current grip orientation
   * into a canonical physical move token.
   */
  public conjugateKeyToken(token: string): string {
    return conjugatePyraminxToken(token, this.getGripIndex());
  }

  private animatePuzzleTo(targetQuat: Quaternion, durationMs: number): Promise<void> {
    return new Promise((resolve) => {
      if (!this.model?.root) {
        resolve();
        return;
      }
      this.finishPuzzleAnim();
      if (durationMs <= 0) {
        this.puzzleQuat.copy(targetQuat);
        this.model.root.quaternion.copy(targetQuat);
        this.requestRender();
        resolve();
        return;
      }
      this.puzzleAnim = {
        startQuat: this.model.root.quaternion.clone(),
        targetQuat: targetQuat.clone(),
        startTime: performance.now(),
        durationMs,
        resolve,
      };
      this.requestRender();
    });
  }

  private finishPuzzleAnim(): void {
    const anim = this.puzzleAnim;
    if (anim) {
      this.puzzleAnim = null;
      this.puzzleQuat.copy(anim.targetQuat);
      this.model?.root.quaternion.copy(anim.targetQuat);
      anim.resolve?.();
    }
  }

  // ── Render loop (dirty-flag, pauses when static — same as Cube3DEngine) ─

  private hasActiveAnimation(): boolean {
    if (this.cameraAnim) return true;
    if (this.puzzleAnim) return true;
    if (this.driver?.isAnimating()) return true;
    if (this.cameraMomentum && this.cameraMomentumState !== 'idle') return true;
    return false;
  }

  private loop = (timeMs: number) => {
    if (!this.isRunning) return;

    const deltaMs = timeMs - this.lastTime;
    this.lastTime = timeMs;

    if (this.driver) this.driver.update(timeMs);

    if (this.cameraMomentum && this.cameraMomentumState !== 'idle') {
      const dt = Math.min(Math.max((timeMs - this.cameraMomentum.lastApplyTime) / 16.667, 0), 3);
      const decay = Math.pow(this.cameraMomentumDecay, dt);
      if (this.cameraMomentumState === 'dragging') {
        this.cameraMomentum = {
          x: this.cameraMomentum.x * decay,
          y: this.cameraMomentum.y * decay,
          lastApplyTime: timeMs,
        };
      } else {
        const mx = this.cameraMomentum.x * decay;
        const my = this.cameraMomentum.y * decay;
        if (
          Math.abs(mx) < this.cameraMomentumThreshold &&
          Math.abs(my) < this.cameraMomentumThreshold
        ) {
          this.cameraMomentum = null;
          this.cameraMomentumState = 'idle';
        } else {
          this.sceneManager?.rotateCamera(mx, my);
          this.cameraMomentum = { x: mx, y: my, lastApplyTime: timeMs };
        }
      }
    }

    if (this.cameraAnim && this.sceneManager) {
      const elapsed = timeMs - this.cameraAnim.startTime;
      const t = Math.min(1.0, elapsed / this.cameraAnim.durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      this.sceneManager.setOrbitAngles(
        this.cameraAnim.startTheta +
          (this.cameraAnim.targetTheta - this.cameraAnim.startTheta) * eased,
        this.cameraAnim.startPhi + (this.cameraAnim.targetPhi - this.cameraAnim.startPhi) * eased,
        this.cameraAnim.startRadius +
          (this.cameraAnim.targetRadius - this.cameraAnim.startRadius) * eased,
      );
      if (t >= 1.0) {
        const resolve = this.cameraAnim.resolve;
        this.cameraAnim = null;
        resolve?.();
      }
    }

    if (this.puzzleAnim && this.model?.root) {
      const elapsed = timeMs - this.puzzleAnim.startTime;
      const t = Math.min(1.0, elapsed / this.puzzleAnim.durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      this.model.root.quaternion
        .copy(this.puzzleAnim.startQuat)
        .slerp(this.puzzleAnim.targetQuat, eased);
      if (t >= 1.0) {
        this.puzzleQuat.copy(this.puzzleAnim.targetQuat);
        this.model.root.quaternion.copy(this.puzzleAnim.targetQuat);
        const resolve = this.puzzleAnim.resolve;
        this.puzzleAnim = null;
        resolve?.();
      }
    }

    const animating = this.hasActiveAnimation();
    if (this.needsRender || animating) {
      if (this.sceneManager) this.sceneManager.render();
      this.needsRender = false;
    }
    if (this.needsRender || animating) {
      this.animFrameId = requestAnimationFrame(this.loop);
    } else {
      this.animFrameId = null;
    }
  };
}
