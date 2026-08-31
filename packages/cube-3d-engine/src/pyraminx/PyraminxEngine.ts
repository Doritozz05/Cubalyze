import { Mesh, Object3D, Raycaster, Vector2, Vector3 } from 'three';
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
  PYRAMINX_EDGE_SLOTS,
  PYRAMINX_VERTICES_ORDER,
  isValidPyraminxMoveString,
  resolvePyraminxMoveToken,
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
 * Result of a sticker pick (raycast): the piece, its root-frame slot
 * position and the candidate turns a drag on it can resolve. A tip turns
 * only itself (`scope: 'tip'`); a corner only its layer; an edge piece can
 * turn around either of its slot's two vertices (the resolver picks the
 * one whose rotation tangent best matches the drag).
 */
export interface PyraminxPick {
  kind: 'edge' | 'corner' | 'tip';
  /** Piece slot position in the ROOT frame (the driver's turn frame). */
  position: Vector3;
  candidates: PyraminxPickCandidate[];
}

/**
 * Maps the CUBE skin's face colors onto the Pyraminx's 4 faces, preserving
 * the WCA pyraminx scheme: U=yellow, L=green, R=blue, B=red. The cube's D/F/B/R
 * faces carry exactly those colors in the default cube skin, so the panel's
 * skin updates (getSkinStyle) apply consistently to both puzzles.
 */
const CUBE_FACE_TO_PYRAMINX: Record<PyraminxVertex, keyof CubeStyleOptions['stickerColors']> = {
  U: 'D', // yellow
  L: 'F', // green
  R: 'B', // blue
  B: 'R', // red
};

/** Signed turn steps from a driver angle (±120° → 1 / 2 steps, 0 → no-op). */
function stepsFromAngle(angleInDegrees: number): number {
  return ((Math.round(angleInDegrees / 120) % 3) + 3) % 3;
}

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
 * Reuses the generic pieces of the engine package (SceneManager for the
 * camera/lights/renderer, RotationDriver3D for the pivot machinery) and adds
 * only what a vertex-turning tetrahedron needs:
 *
 *   • PyraminxMeshFactory — 14 pieces with triangular stickers
 *   • PyraminxModel       — per-slot logical mirror + packed PyraminxState
 *   • slice refs          — { vertex, scope } with the vertex's OUTWARD axis
 *                           (±120° turns, order 3)
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

  /** Camera drag inertia state machine (same semantics as Cube3DEngine). */
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
    if (this.sceneManager) this.sceneManager.dispose();
    if (this.factory) this.factory.dispose();
  }

  // ── Moves ────────────────────────────────────────────────────────────────

  /** Slice ref for a turn: the vertex axis + whether it is a full layer. */
  private sliceRef(vertex: PyraminxVertex, scope: 'layer' | 'tip'): PyraminxSliceRef {
    return { id: { vertex, scope }, axis: PYRAMINX_AXES[vertex] };
  }

  /**
   * Rotate a layer or tip at a vertex by a signed angle (±120° for a single
   * step; a prime move is −120°, which is the 2-step turn).
   */
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
   * an unknown token without touching the puzzle.
   */
  public applyMove(token: string, durationMs = 160): Promise<boolean> {
    const resolved = resolvePyraminxMoveToken(token);
    if (!resolved) return Promise.resolve(false);
    void this.rotateVertex(resolved.vertex, resolved.scope, resolved.angleInDegrees, durationMs, 'smooth');
    return Promise.resolve(true);
  }

  /**
   * Play a WCA Pyraminx scramble as animated turns (every move is 120°, so
   * each turn animates with the same base duration). The scramble always
   * plays from the solved state. Returns false (without touching the puzzle)
   * when the string is empty or contains an invalid token.
   */
  public async applyScrambleAnimated(scramble: string, baseDurationMs = 160): Promise<boolean> {
    if (!this.model || !this.driver) return false;
    if (!isValidPyraminxMoveString(scramble)) return false;
    const tokens = scramble.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return false;

    this.reset();
    this.requestRender();
    for (const token of tokens) {
      const resolved = resolvePyraminxMoveToken(token)!;
      await this.rotateVertex(resolved.vertex, resolved.scope, resolved.angleInDegrees, baseDurationMs, 'smooth');
    }
    this.requestRender();
    return true;
  }

  /** True when any pivot task is still animating (for the render loop). */
  public isAnimating(): boolean {
    return this.driver?.isAnimating() ?? false;
  }

  /** Force-complete every in-flight turn and restore the solved state. */
  public reset(): void {
    if (this.driver) this.driver.flushAll();
    if (this.model) this.model.reset();
    this.requestRender();
  }

  /** The model's packed state in the solver's encoding. */
  public getState(): PyraminxState {
    return this.model?.getState() ?? { edgePerm: 0, edgeOrient: 0, cornerOrient: 0, tips: 0 };
  }

  // ── Skin / style ────────────────────────────────────────────────────────

  /**
   * Apply a cube-skin style to the Pyraminx (the panel's shared appearance
   * settings). Only the fields with a pyraminx meaning are honored: sticker
   * colors (mapped cube face → pyraminx face) and skinType (stickered =
   * sticker panels visible; stickerless = colored plastic).
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
    if (style.coreColor) this.factory.updateStyle({ coreColor: style.coreColor });
    if (style.skinType) {
      const stickered = style.skinType === 'stickered';
      this.factory.updateStyle({ skinType: stickered ? 'stickered' : 'stickerless' });
      for (const piece of this.model.pieces) {
        for (const child of piece.mesh.children) {
          if ((child as { userData?: { pyraminxSticker?: boolean } }).userData?.pyraminxSticker === true) {
            child.visible = stickered;
          }
        }
      }
    }
    this.requestRender();
  }

  // ── Move events (for the UI moves strip) ───────────────────────────────

  private onMoveEventCb?: (notation: string) => void;

  /** Subscribe to committed turns. Fires once per completed move with the
   *  display token (e.g. "U'", "l") — the panel's recent-moves strip. */
  public onMoveEvent(cb: (notation: string) => void): void {
    this.onMoveEventCb = cb;
  }

  // ── Picking (virtual-cube drags) ─────────────────────────────────────────

  /**
   * Raycast the sticker under a normalized device coordinate (−1..1) and
   * return the piece + its turn candidates, or null when the pointer misses
   * the puzzle (background). Mirrors the cube's `pickLayer` for the
   * virtual-cube drag interaction.
   */
  public pickSticker(ndcX: number, ndcY: number): PyraminxPick | null {
    if (!this.sceneManager?.camera || !this.model) return null;
    if (!Number.isFinite(ndcX) || !Number.isFinite(ndcY)) return null;
    this.sceneManager.camera.updateMatrixWorld(true);
    const raycaster = new Raycaster();
    raycaster.setFromCamera(new Vector2(ndcX, ndcY), this.sceneManager.camera);
    const meshes: Object3D[] = [];
    this.model.root.traverse((obj) => {
      if ((obj as Mesh).isMesh) meshes.push(obj);
    });
    const hits = raycaster.intersectObjects(meshes, false);
    if (hits.length === 0) return null;
    // Walk up from the hit mesh to its piece Group (a direct child of root).
    let node: Object3D | null = hits[0].object;
    while (node && node.parent !== this.model.root) node = node.parent;
    if (!node) return null;
    const piece = this.model.pieces.find((p) => p.mesh === node);
    if (!piece) return null;
    if (piece.kind === 'edge') {
      const def = PYRAMINX_EDGE_SLOTS[piece.current];
      return {
        kind: 'edge',
        position: piece.mesh.position.clone(),
        candidates: [
          { vertex: def.vertices[0], scope: 'layer' },
          { vertex: def.vertices[1], scope: 'layer' },
        ],
      };
    }
    const vertex = PYRAMINX_VERTICES_ORDER[piece.current];
    return {
      kind: piece.kind,
      position: piece.mesh.position.clone(),
      candidates: [
        { vertex, scope: piece.kind === 'tip' ? 'tip' : 'layer' },
      ],
    };
  }

  // ── Camera ───────────────────────────────────────────────────────────────

  /**
   * ONE discrete camera step (virtual-cube background drag) — the camera
   * NEVER free-rotates in the virtual view. Yaw snaps to the 120° grid (the
   * tetrahedron's 3-fold symmetry), pitch to the 30° grid; the step lands
   * exactly on the grid so every view is a clean fixed angle.
   */
  public orbitStep(dx: number, dy: number): void {
    if (!this.sceneManager) return;
    const YAW_STEP = (Math.PI * 2) / 3;
    const PITCH_STEP = Math.PI / 6;
    const current = this.sceneManager.getOrbitAngles();
    const yaw =
      Math.round(current.theta / YAW_STEP) * YAW_STEP +
      (dx > 0 ? -YAW_STEP : dx < 0 ? YAW_STEP : 0);
    const pitchRaw =
      Math.round(current.phi / PITCH_STEP) * PITCH_STEP +
      (dy > 0 ? -PITCH_STEP : dy < 0 ? PITCH_STEP : 0);
    const pitch = Math.min(Math.max(pitchRaw, -Math.PI / 2 + 0.05), Math.PI / 2 - 0.05);
    this.cameraMomentum = null;
    this.cameraMomentumState = 'idle';
    this.finishCameraAnim();
    this.sceneManager.setOrbitAngles(yaw, pitch);
    this.requestRender();
  }

  public rotateCamera(dx: number, dy: number): void {
    this.finishCameraAnim();
    if (this.sceneManager) this.sceneManager.rotateCamera(dx, dy);
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
    if (smooth) return this.animateCameraTo(0, 0, 7);
    this.cameraMomentum = null;
    this.cameraMomentumState = 'idle';
    this.finishCameraAnim();
    this.sceneManager.resetCamera();
    this.requestRender();
  }

  public setIsometricView(smooth = false): Promise<void> | void {
    if (!this.sceneManager) return;
    if (smooth) return this.animateCameraTo(Math.PI / 6, Math.PI / 6, 7);
    this.cameraMomentum = null;
    this.cameraMomentumState = 'idle';
    this.finishCameraAnim();
    this.sceneManager.setOrbitAngles(Math.PI / 6, Math.PI / 6);
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

  // ── Render loop (dirty-flag, pauses when static — same as Cube3DEngine) ─

  private hasActiveAnimation(): boolean {
    if (this.cameraAnim) return true;
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
