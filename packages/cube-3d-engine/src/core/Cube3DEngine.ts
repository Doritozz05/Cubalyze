import { Quaternion, Mesh, MeshBasicMaterial, Material, Vector3, Group, Object3D, Raycaster, Vector2 } from 'three';
import { SceneManager } from './SceneManager';
import { CubeMeshFactory, type CubeStyleOptions } from './CubeMeshFactory';
import { CubeModel } from './CubeModel';
import { RotationEngine, type RotationAxis } from '../animation/RotationEngine';
import { parseScrambleMoves, scrambleMoveDurationMs } from '../animation/ScrambleAnimator';
import { GyroFusion } from '../hardware/GyroFusion';
import { OrientationTracker } from '../hardware/OrientationTracker';
import { OrientationTable, type PhaseMask } from '@cubeforge/math-core';
import { resolveLayerHit, rotateVectorByQuaternion, type CubeLayerPick } from './layerPick';
import type { CubeOrientation, RotationEvent, CubeFace } from '@cubeforge/types';
import type { Subscription } from 'rxjs';

export interface Cube3DEngineOptions {
  canvas: HTMLCanvasElement | OffscreenCanvas;
  width: number;
  height: number;
  pixelRatio?: number;
  gyroSupported?: boolean;
  /** Cube order: 2 (2×2×2) or 3 (3×3×3). Default 3. */
  order?: number;
  /**
   * Mark this context as disposable. The global context manager evicts
   * disposable contexts first when the browser's WebGL context budget is
   * exceeded. Use for offscreen/snapshot engines that are recreated lazily
   * on demand (NOT for user-visible React canvases).
   */
  contextEvictable?: boolean;
  /**
   * Called when the global context manager force-evicts this engine's WebGL
   * context (browser hit the context limit). The engine stops its render
   * loop; the caller should surface a graceful fallback in the UI.
   */
  onContextEvicted?: () => void;
}

export type ActiveStickeringState =
  | { type: 'phase'; mask: PhaseMask; grayColor: string }
  | { type: 'f2l'; grayColor: string; pair?: { homeC: number; homeE: number } | null }
  | { type: 'layer'; axis: 'x' | 'y' | 'z'; layerValue: number; grayColor: string }
  | null;

export interface GrayedStickerRecord {
  mesh: Mesh;
  /** -1 for single-material mesh (stickers), or >= 0 for multi-material array index (stickerless faces) */
  materialIndex: number;
  originalMat: Material;
}

export class Cube3DEngine {
  /**
   * Canonical front-facing view with natural downward eye perspective.
   * - theta: 0 (directly facing front face, Left and Right edges symmetrical)
   * - phi: Math.PI / 4 rad (45°) elevation showing an equal 50% front face and 50% top face
   * - radius: 7 (standard viewing distance)
   */
  public static readonly CANONICAL_VIEW = {
    theta: 0,
    phi: Math.PI / 4,
    radius: 7,
  } as const;

  public sceneManager!: SceneManager;
  public factory!: CubeMeshFactory;
  public model!: CubeModel;
  public rotationEngine!: RotationEngine;
  public gyroFusion!: GyroFusion;
  public orientationTracker!: OrientationTracker;

  private onOrientationChangeCb?: (o: CubeOrientation) => void;
  private onRotationEventCb?: (e: RotationEvent) => void;
  private onContextEvictedCb?: () => void;
  private orientationSub?: Subscription;
  private rotationEventSub?: Subscription;

  private orientationAnim: {
    startQuat: Quaternion;
    targetQuat: Quaternion;
    startTime: number;
    durationMs: number;
    /** Resolves the Promise returned by {@link setCubeOrientation} when the
     *  SLERP completes (or immediately when replaced/snapped). */
    resolve?: () => void;
  } | null = null;

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

  private lastTime: number = 0;
  private isRunning: boolean = false;
  private animFrameId: number | null = null;

  /**
   * Dirty-flag rendering: the rAF loop only runs while there is active
   * animation (layer rotation, gyro smoothing, orientation transition) OR a
   * pending explicit render request. When the scene is static, the loop
   * stops entirely, saving CPU/GPU/battery on an idle but mounted cube.
   */
  private needsRender = false;

  /**
   * Camera drag inertia state machine:
   *   'idle'     — inertia not armed. `rotateCamera` only applies the direct
   *                rotation (legacy behavior) for flows that never call
   *                `setCameraDragActive` (Case3DCanvas, etc.).
   *   'dragging' — pointer down (armed by the UI). Velocity is recorded and
   *                aged each frame, but not applied (rotation is direct).
   *   'gliding'  — released. The stored velocity decays and rotates the
   *                camera until it drops below the threshold.
   */
  private cameraMomentumState: 'idle' | 'dragging' | 'gliding' = 'idle';
  private cameraMomentum: { x: number; y: number; lastApplyTime: number } | null = null;
  /** Momentum below this magnitude (px/frame) stops the inertia glide. */
  private readonly cameraMomentumThreshold = 0.01;
  /** Exponential decay per ~16.7ms frame — ~12% velocity loss per frame. */
  private readonly cameraMomentumDecay = 0.88;

  /** Track grayed-out sticker meshes & multi-material faces so we can restore + dispose them. */
  private grayedStickers: GrayedStickerRecord[] = [];
  /** Active stickering state to automatically preserve and re-apply upon skin/style updates. */
  private activeStickeringState: ActiveStickeringState = null;

  constructor(options: Cube3DEngineOptions) {
    const {
      canvas,
      width,
      height,
      pixelRatio = 1,
      gyroSupported = false,
      order = 3,
      contextEvictable = false,
      onContextEvicted,
    } = options;
    this.onContextEvictedCb = onContextEvicted;
    this.init(canvas, width, height, pixelRatio, gyroSupported, order, contextEvictable);
  }

  private init(
    canvas: HTMLCanvasElement | OffscreenCanvas,
    width: number,
    height: number,
    pixelRatio: number,
    gyroSupported: boolean,
    order: number,
    contextEvictable: boolean,
  ) {
    this.sceneManager = new SceneManager(canvas, width, height, pixelRatio, {
      evictable: contextEvictable,
      onContextEvicted: () => {
        // Stop the rAF loop immediately so an evicted engine doesn't keep
        // burning frames against a destroyed context.
        this.isRunning = false;
        if (this.animFrameId !== null) {
          cancelAnimationFrame(this.animFrameId);
          this.animFrameId = null;
        }
        this.needsRender = false;
        this.onContextEvictedCb?.();
      },
    });

    this.factory = new CubeMeshFactory();
    this.model = new CubeModel(this.factory, order);
    this.sceneManager.scene.add(this.model.root);
    this.sceneManager.setOrbitAngles(
      Cube3DEngine.CANONICAL_VIEW.theta,
      Cube3DEngine.CANONICAL_VIEW.phi,
      Cube3DEngine.CANONICAL_VIEW.radius,
    );

    this.rotationEngine = new RotationEngine(this.model);
    this.gyroFusion = new GyroFusion(this.model.root);

    this.orientationTracker = new OrientationTracker({ gyroSupported });
    this.gyroFusion.onCalibrate = (q) => this.orientationTracker.setCalibration(q);

    this.orientationSub = this.orientationTracker.orientation$.subscribe((o) => {
      this.onOrientationChangeCb?.(o);
    });

    this.rotationEventSub = this.orientationTracker.rotationEvents$.subscribe((e) => {
      this.onRotationEventCb?.(e);
    });

    this.isRunning = true;
    // Render the first frame immediately, then let the dirty-flag loop
    // pause when the scene becomes static.
    this.lastTime = performance.now();
    this.needsRender = true;
    this.animFrameId = requestAnimationFrame(this.loop);
  }

  /**
   * Schedule a single render on the next animation frame.
   *
   * Called by every public method that mutates the scene (camera moves,
   * facelet syncs, style changes, sticker graying, rotations, …). If the
   * render loop is paused, this restarts it for one frame.
   */
  /**
   * True when the global context manager force-evicted this engine's WebGL
   * context. Once evicted, the engine stops rendering and must be recreated
   * by the caller (e.g. via a remount) to render again.
   */
  public isContextEvicted(): boolean {
    return !this.isRunning || (this.sceneManager?.isContextEvicted() ?? false);
  }

  /** True when any layer rotation is in-flight (animated or live-twist). */
  public isAnimating(): boolean {
    return this.rotationEngine?.isAnimating() ?? false;
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

  public async rotateLayers(
    axis: RotationAxis,
    layerValues: number[],
    angle: number,
    durationMs: number,
    elapsedMs?: number,
    easingStrategy?: string,
  ): Promise<void> {
    if (!this.rotationEngine) return;
    this.requestRender();
    await this.rotationEngine.rotateLayers(
      axis,
      layerValues,
      angle,
      durationMs,
      elapsedMs,
      easingStrategy as 'bounce' | 'smooth' | 'fast' | 'linear' | undefined,
    );
  }

  /**
   * Start a free-form layer twist (drag-to-turn touch model).
   *
   * Detaches the layer onto a pivot and lets the caller drive its angle in
   * real time with {@link setLayerTwistAngle}, so the slice follows the
   * finger. Finish with {@link finishLayerTwist} (commit ±90°) or
   * {@link cancelLayerTwist} (spring back). No logical state changes while
   * twisting — the move only lands on commit.
   *
   * @returns `false` when a twist is already active or no pivot is free
   *   (callers should fall back to orbit mode).
   */
  public beginLayerTwist(axis: RotationAxis, layerValues: number[]): boolean {
    if (!this.rotationEngine) return false;
    const ok = this.rotationEngine.beginTwist(axis, layerValues);
    if (ok) this.requestRender();
    return ok;
  }

  /** Drive the active layer twist to an absolute angle (degrees). */
  public setLayerTwistAngle(angleDegrees: number): void {
    if (!this.rotationEngine) return;
    this.rotationEngine.setTwistAngle(angleDegrees);
    this.requestRender();
  }

  /**
   * Commit the active layer twist: animate from its current angle to
   * `targetAngleDegrees` (±90 = complete turn, 0 = spring back) and apply
   * the matching logical update. Resolves when the animation completes.
   */
  public finishLayerTwist(targetAngleDegrees: number, durationMs: number): Promise<void> {
    if (!this.rotationEngine) return Promise.resolve();
    this.requestRender();
    return this.rotationEngine.finishTwist(targetAngleDegrees, durationMs);
  }

  /** Spring the active layer twist back to 0° (cancel the drag). */
  public cancelLayerTwist(durationMs: number): Promise<void> {
    if (!this.rotationEngine) return Promise.resolve();
    this.requestRender();
    return this.rotationEngine.finishTwist(0, durationMs);
  }

  /**
   * True while a free-form drag twist is active (layer following the finger
   * but not yet committed/cancelled). Lets the caller skip a commit when a
   * keyboard collision already cancelled the twist mid-drag.
   */
  public isLayerTwistActive(): boolean {
    return this.rotationEngine?.isLiveTwistActive() ?? false;
  }

  public resetCube(): void {
    // Force-complete any in-flight layer rotations FIRST. A task that is
    // still turning when we reset would snap AFTER the reset and re-apply its
    // rotation — plus its logical-grid update — on top of the fresh state,
    // desyncing the model from the renderer ("cube colors lost/buggy" when
    // restarting a replay or seeking mid-animation).
    if (this.rotationEngine) this.rotationEngine.flushAll();
    if (this.model) {
      this.model.resetCube();
      // The whole-cube grip (solver's frame) lives on the root quaternion.
      // Resetting a replay/seek must also return the root to the base frame,
      // so a restart shows the original scrambled view and the next play's
      // inspection pre-roll replays cleanly from identity.
      this.model.root.quaternion.identity();
    }
    // Stop any root orientation SLERP from fighting the reset (it would keep
    // animating to its stale target grip over the freshly-identity root).
    // NOTE: this also RESOLVES the SLERP's promise — the replay transport
    // awaits its grip/chain BEFORE calling resetCube, so the pre-roll grip is
    // never dropped there. Direct engine resets outside the replay (e.g. the
    // trainer's init effect) simply abort any in-flight grip, which is the
    // desired "reset wins" semantics.
    this.finishOrientationAnim();
    this.requestRender();
  }

  /**
   * Force-complete every in-flight animation (layer rotations + root
   * orientation SLERP) without changing the resulting state. The replay
   * transport calls this before any absolute reset so a stale animation can
   * never be applied on top of the freshly reset cube.
   */
  public flushAnimations(): void {
    if (this.rotationEngine) this.rotationEngine.flushAll();
    this.finishOrientationAnim();
    this.finishCameraAnim();
    this.requestRender();
  }

  public syncFacelets(facelets: string): void {
    // Same invariant as resetCube: an in-flight layer rotation must not be
    // allowed to animate on top of the freshly synced absolute state (the
    // live smart-cube path syncs facelets while the previous move's animation
    // may still be turning → colors visibly desync).
    if (this.rotationEngine) this.rotationEngine.flushAll();
    if (this.model) {
      this.model.applyFacelets(facelets);
    }
    this.requestRender();
  }

  public rotateCamera(dx: number, dy: number): void {
    this.finishCameraAnim();
    if (this.sceneManager) {
      this.sceneManager.rotateCamera(dx, dy);
    }
    // Record the drag velocity for the inertia glide — only in flows that
    // armed the drag via setCameraDragActive (otherwise keep the legacy
    // direct-rotation-only behavior for Case3DCanvas and friends).
    if (this.cameraMomentumState !== 'idle') {
      this.cameraMomentum = { x: dx, y: dy, lastApplyTime: performance.now() };
    }
    this.requestRender();
  }

  /**
   * Mark whether the camera is being dragged. Call with `true` on pointer
   * down and `false` on pointer up. While `dragging` the momentum system
   * only ages the stored velocity (so direct rotateCamera calls aren't
   * doubled); on release it glides the camera with inertia.
   */
  public setCameraDragActive(active: boolean): void {
    if (active) {
      this.finishCameraAnim();
      this.cameraMomentumState = 'dragging';
      this.cameraMomentum = null; // drop any leftover glide
    } else if (this.cameraMomentumState === 'dragging') {
      if (this.cameraMomentum) {
        // Release with motion → glide with inertia. Reset the decay clock so
        // the first glide frame doesn't jump.
        this.cameraMomentumState = 'gliding';
        this.cameraMomentum = { ...this.cameraMomentum, lastApplyTime: performance.now() };
      } else {
        // Plain click without motion → back to idle, nothing to glide.
        this.cameraMomentumState = 'idle';
      }
    }
  }

  /**
   * Zoom the camera by a wheel-delta-like amount (positive = zoom out,
   * negative = zoom in). Converted to an exponential radius factor so the
   * zoom rate feels proportional at any distance.
   *
   * Wheel convention: scrolling up (deltaY < 0) zooms in, scrolling down
   * zooms out — matching standard map/3D-viewer behaviour.
   */
  public zoomCamera(deltaY: number): void {
    if (!this.sceneManager) return;
    if (!Number.isFinite(deltaY) || deltaY === 0) return;
    // factor > 1 → camera moves away (zoom out); factor < 1 → zoom in.
    const factor = Math.exp(deltaY / 1200);
    this.sceneManager.zoomBy(factor);
    this.requestRender();
  }

  public updateGyro(
    x: number,
    y: number,
    z: number,
    w: number,
    velocity?: { x: number; y: number; z: number },
  ): void {
    if (!this.gyroFusion) return;
    this.gyroFusion.enable();
    this.gyroFusion.updateTargetQuaternion(x, y, z, w, velocity);

    if (!this.orientationTracker.capabilitiesInfo.gyroSupported) {
      this.orientationTracker.enableGyroSupport();
    }

    this.orientationTracker.update({ x, y: z, z: -y, w });
    this.requestRender();
  }

  public disableGyro(): void {
    if (!this.gyroFusion) return;
    this.gyroFusion.disable();
  }

  public calibrateGyro(): void {
    if (!this.gyroFusion) return;
    if (this.sceneManager) {
      const view = Cube3DEngine.CANONICAL_VIEW;
      this.sceneManager.setOrbitAngles(view.theta, view.phi, view.radius);
    }
    this.cameraMomentum = null;
    this.cameraMomentumState = 'idle';
    this.gyroFusion.calibrate();
    this.requestRender();
  }

  /**
   * Adopt the headless tracker's calibration reference (Three.js convention).
   *
   * The headless orientation service owns calibration — it captures the
   * first at-rest sample after connect and publishes the reference to the
   * orientation store. Every mounted engine must use THAT reference instead
   * of capturing its own (which would diverge from the move-label display
   * and, if captured mid-motion, rotate the whole 3D frame).
   */
  public setGyroCalibration(q: { x: number; y: number; z: number; w: number }): void {
    if (!this.gyroFusion) return;
    this.gyroFusion.setCalibrationQuaternion(q);
    this.requestRender();
  }

  public setGyroSupported(supported: boolean): void {
    if (!this.orientationTracker) return;

    const currentlyEnabled = this.orientationTracker.capabilitiesInfo.gyroSupported;

    if (supported && !currentlyEnabled) {
      this.orientationTracker.enableGyroSupport();
      return;
    }

    if (!supported && currentlyEnabled) {
      this.orientationSub?.unsubscribe();
      this.rotationEventSub?.unsubscribe();
      this.orientationTracker.dispose();
      this.gyroFusion.resetCalibration();
      this.orientationTracker = new OrientationTracker({ gyroSupported: false });
      this.gyroFusion.onCalibrate = (q) => this.orientationTracker.setCalibration(q);
      this.orientationSub = this.orientationTracker.orientation$.subscribe((o) => {
        this.onOrientationChangeCb?.(o);
      });
      this.rotationEventSub = this.orientationTracker.rotationEvents$.subscribe((e) => {
        this.onRotationEventCb?.(e);
      });
      return;
    }
  }

  public onOrientationChange(cb: (o: CubeOrientation) => void): void {
    this.onOrientationChangeCb = cb;
  }

  public onRotationEvent(cb: (e: RotationEvent) => void): void {
    this.onRotationEventCb = cb;
  }

  public getOrientation(): CubeOrientation {
    if (!this.orientationTracker) {
      const id = OrientationTable.IDENTITY;
      return {
        quaternion: { x: 0, y: 0, z: 0, w: 1 },
        faceMap: id.faceMap,
        label: id.label,
      };
    }
    const c = this.orientationTracker.current;
    return {
      quaternion: { x: c.quaternion.x, y: c.quaternion.y, z: c.quaternion.z, w: c.quaternion.w },
      faceMap: c.faceMap,
      label: c.label,
    };
  }

  public resetGyroCalibration(): void {
    if (!this.gyroFusion) return;
    this.gyroFusion.resetCalibration();
  }

  /**
   * Raycast the cube surface and resolve which layer would be turned by a
   * pointer at the given NDC coordinates.
   *
   * Used by the virtual-cube touch controls (swipe a face to turn it). The
   * ray is fired from the orbit camera through the canvas pixel; the first
   * hit is walked up to its owning cubie, then {@link resolveLayerHit}
   * derives the layer (axis + layerValue + WCA face) in the cube frame.
   *
   * @param ndcX  Pointer X in normalized device coords [−1, 1] (left→right).
   * @param ndcY  Pointer Y in normalized device coords [−1, 1] (bottom→top).
   * @returns The resolved layer pick (with the world-space hit point) or
   *   `null` when the pointer misses the cube (e.g. background / evicted).
   */
  public pickLayer(ndcX: number, ndcY: number): CubeLayerPick | null {
    if (!this.model || !this.sceneManager) return null;
    if (!this.isRunning || this.sceneManager.isContextEvicted()) return null;
    if (!Number.isFinite(ndcX) || !Number.isFinite(ndcY)) return null;

    // Ensure world matrices are current before raycasting (the dirty-flag
    // loop may be paused while the scene is static).
    this.model.root.updateMatrixWorld(true);

    const raycaster = new Raycaster();
    raycaster.setFromCamera(new Vector2(ndcX, ndcY), this.sceneManager.camera);

    const cubieGroups = this.model.getAllCubies();
    const hits = raycaster.intersectObjects(cubieGroups, true);
    if (hits.length === 0) return null;

    // The raycaster intersects EVERY mesh the ray crosses, including stickers
    // on the FAR side of the cube that are visible through the transparent
    // core (translucent skin: DoubleSide stickers + opacity-0 core +
    // depthWrite:false). Without filtering, hits[0] can be a back-face
    // sticker the user never touched, producing the wrong move.
    //
    // Keep only hits whose world-space face normal points TOWARD the camera
    // (dot with the ray direction is negative — the face is front-facing).
    // This also filters back-face hits on DoubleSide sticker geometry.
    const rayDir = raycaster.ray.direction.clone().normalize();

    // Determine whether this skin has visible stickers (stickered /
    // translucent) or not (stickerless / coreless). When stickers exist,
    // they are the ONLY valid drag surface — the RoundedBoxGeometry core
    // has rounded edges that curve outward past the flat sticker panels,
    // and a ray that clips the core's top/side edge (just above a
    // sticker) resolves to the WRONG face (e.g. hitting the core's +X
    // face while aiming at the front sticker → resolveDragMove produces
    // an F move instead of the intended R/L). Ignoring core hits when
    // stickers are present eliminates that dead zone. Stickerless skins
    // have no stickers, so the core IS the interaction surface.
    const style = this.factory?.getStyle();
    const skinType = style?.skinType ?? 'stickered';
    const hasStickers = skinType !== 'stickerless' && skinType !== 'coreless';

    let hit: typeof hits[0] | null = null;
    let coreFallback: typeof hits[0] | null = null;
    for (const h of hits) {
      if (!h.face) continue;
      if (h.object.userData?.isFloatingSticker) continue;
      // World-space normal of the hit face. Three.js populates
      // h.face.normal in LOCAL space; transform it by the object's
      // world matrix (rotation part only — normalScale = 1 for uniform
      // scale, which is the case for cubie groups).
      const localNormal = new Vector3(h.face.normal.x, h.face.normal.y, h.face.normal.z);
      const worldNormal = localNormal.clone();
      h.object.updateWorldMatrix(true, false);
      worldNormal.transformDirection(h.object.matrixWorld);
      // Front-facing: the normal points AGAINST the ray (toward the camera).
      if (worldNormal.dot(rayDir) >= -0.01) continue;
      // Distinguish sticker meshes from core meshes. Sticker meshes use
      // MeshBasicMaterial (flat, unlit); core meshes use MeshStandardMaterial
      // (lit, with roughness/metalness). The stickerless skin's core uses
      // an array of MeshBasicMaterial, but hasStickers is false there so
      // the check below never runs for it.
      const mat = (h.object as Mesh).material;
      // Core meshes use MeshStandardMaterial (lit, with roughness/metalness);
      // sticker meshes use MeshBasicMaterial (flat, unlit). The type string
      // is always available and avoids the need for type narrowing.
      const matType = Array.isArray(mat) ? '' : (mat as Material).type;
      const isCoreMesh = matType === 'MeshStandardMaterial';
      if (hasStickers && isCoreMesh) {
        // Remember the first front-facing core hit as a FALLBACK — only
        // used if no sticker hit is found (e.g. a gap between stickers on
        // the coreless skin, or a grazing angle that misses every sticker).
        if (!coreFallback) coreFallback = h;
        continue;
      }
      hit = h;
      break;
    }
    // No sticker hit found — fall back to the core (or the first
    // front-facing hit for stickerless/coreless skins).
    if (!hit) hit = coreFallback;
    if (!hit || !hit.face) return null;

    // Walk up from the hit mesh (sticker / core) to its cubie Group.
    let obj: Object3D | null = hit.object;
    while (obj && !cubieGroups.includes(obj as Group)) {
      obj = obj.parent;
    }
    if (!obj) return null;
    const cubie = obj as Group;

    // Resolve the cubie's CURRENT grid position from the logical state (the
    // authoritative integer coordinates — immune to float drift). Used by the
    // drag-to-turn resolver to derive moves from sticker geometry.
    const cubieIndex = cubieGroups.indexOf(cubie);
    const logical = cubieIndex >= 0 ? this.model.getLogicalState()[cubieIndex] : undefined;
    const cubiePosition = logical
      ? { x: logical.gridX, y: logical.gridY, z: logical.gridZ }
      : {
          x: Math.round(cubie.position.x),
          y: Math.round(cubie.position.y),
          z: Math.round(cubie.position.z),
        };

    // The raycast's `hit.face.normal` is the STICKER's geometry normal (+Z
    // for every sticker panel — they all use the same flat ShapeGeometry).
    // Sticker meshes carry their own rotation (CubeMeshFactory orients each
    // face's panel: e.g. the U sticker is rotated -90° around X), so the
    // cubie-local face axis is `geometryNormal × stickerQuaternion`. Without
    // this step every sticker on the cube would resolve to the F face.
    const resolved = resolveLayerHit({
      meshLocalNormal: rotateVectorByQuaternion(
        {
          x: hit.face.normal.x,
          y: hit.face.normal.y,
          z: hit.face.normal.z,
        },
        {
          x: hit.object.quaternion.x,
          y: hit.object.quaternion.y,
          z: hit.object.quaternion.z,
          w: hit.object.quaternion.w,
        },
      ),
      cubieQuaternion: cubie.quaternion,
    });

    return {
      ...resolved,
      worldPoint: { x: hit.point.x, y: hit.point.y, z: hit.point.z },
      cubiePosition,
    };
  }

  public setIsometricView(smooth = false, radius = 7): Promise<void> | void {
    if (!this.sceneManager) return;
    if (smooth) {
      return this.animateCameraTo(Math.PI / 6, Math.PI / 6, radius);
    }
    this.cameraMomentum = null;
    this.cameraMomentumState = 'idle';
    this.finishCameraAnim();
    this.sceneManager.setOrbitAngles(Math.PI / 6, Math.PI / 6, radius);
    this.requestRender();
  }

  public resetCamera(smooth = false): Promise<void> | void {
    if (!this.sceneManager) return;
    const view = Cube3DEngine.CANONICAL_VIEW;
    if (smooth) {
      return this.animateCameraTo(view.theta, view.phi, view.radius);
    }
    this.cameraMomentum = null;
    this.cameraMomentumState = 'idle';
    this.finishCameraAnim();
    this.sceneManager.setOrbitAngles(view.theta, view.phi, view.radius);
    this.requestRender();
  }

  /**
   * Smoothly animates the camera to target orbit spherical angles.
   *
   * @param targetTheta  Azimuth around World Y (radians).
   * @param targetPhi    Elevation from horizontal plane (radians).
   * @param targetRadius Orbit distance. Defaults to 7.
   * @param durationMs   Animation duration in milliseconds. Defaults to 260ms.
   */
  public animateCameraTo(
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

      // Find shortest angular path for theta (wrap 2*PI)
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

  /** Resolve any in-flight camera animation awaiter and clear it. */
  private finishCameraAnim(): void {
    const anim = this.cameraAnim;
    this.cameraAnim = null;
    anim?.resolve?.();
  }

  /**
   * Rotate the whole cube root to a solver-frame orientation, optionally
   * animated.
   *
   * Returns a Promise that resolves when the SLERP animation completes
   * (immediately for duration 0 / snap / identical orientation). The replay
   * engine awaits this for the inspection pre-roll so the next move never
   * starts while the cube is still turning.
   */
  public setCubeOrientation(orientationIndex: number, animationDurationMs?: number): Promise<void> {
    return new Promise((resolve) => {
      if (!this.model) {
        resolve();
        return;
      }
      const entry = OrientationTable.ENTRIES[orientationIndex];
      if (!entry) {
        resolve();
        return;
      }

      const duration = animationDurationMs ?? 0;

      if (duration <= 0) {
        // Snap: replace any in-flight animation and resolve its awaiter now.
        this.finishOrientationAnim();
        // math-core ships its own dependency-free Quaternion (same convention
        // as three.js); three's copy() only reads x/y/z/w, so the cast is safe.
        this.model.root.quaternion.copy(entry.quaternion as unknown as Quaternion);
        this.requestRender();
        resolve();
        return;
      }

      // A running orientation animation is replaced — resolve its awaiter now.
      this.finishOrientationAnim();

      this.orientationAnim = {
        startQuat: this.model.root.quaternion.clone(),
        // entry.quaternion is math-core's own Quaternion (public x/y/z/w only).
        // three's Quaternion.copy() reads those public getters, so this builds a
        // genuine three.js Quaternion with its internal _x/_y/_z/_w populated —
        // REQUIRED because three's slerp()/slerpQuaternions() read the private
        // fields directly (a bare math3d Quaternion would yield NaN).
        targetQuat: new Quaternion().copy(entry.quaternion as unknown as Quaternion),
        startTime: performance.now(),
        durationMs: duration,
        resolve,
      };
      // Kick off the render loop — the orientation animation keeps it alive.
      this.requestRender();
    });
  }

  /** Resolve any in-flight orientation animation awaiter and clear it. */
  private finishOrientationAnim(): void {
    const anim = this.orientationAnim;
    this.orientationAnim = null;
    anim?.resolve?.();
  }

  public setFaceColor(face: string, color: string): void {
    if (this.factory) {
      this.factory.setFaceColor(face as CubeFace | 'Inner', color);
    }
    this.requestRender();
  }

  public setFaceEmissive(face: string, emissiveColor: string, intensity: number): void {
    if (this.factory) {
      this.factory.setFaceEmissive(face as CubeFace | 'Inner', emissiveColor, intensity);
    }
    this.requestRender();
  }

  /**
   * Rotate the entire cube model around the Y axis (world-up).
   * Used to align different F2L slots to the front-right viewing position
   * without corrupting the facelet state.
   *
   * @param radians  Rotation angle in radians around world Y axis.
   */
  public rotateModelY(radians: number): void {
    if (!this.model) return;
    const q = new Quaternion().setFromAxisAngle(
      new Vector3(0, 1, 0),
      radians,
    );
    this.model.root.quaternion.copy(q);
    this.requestRender();
  }

  public updateStyle(newStyle: Partial<CubeStyleOptions>): void {
    const hasActiveStickering = this.activeStickeringState !== null;
    if (hasActiveStickering) {
      this.clearLayerGray(true);
    }

    if (this.factory) {
      this.factory.updateStyle(newStyle);
    }
    if (newStyle.floatingStickers !== undefined && this.model) {
      // Scale down slightly when floating stickers are active to leave ample breathing room for projected tiles
      const scale = newStyle.floatingStickers ? 0.78 : 1.0;
      this.model.root.scale.setScalar(scale);
    }

    // Automatically re-apply the active stickering mask to the new skin/materials
    if (hasActiveStickering) {
      this.applyCurrentStickeringState();
    }

    this.requestRender();
  }

  // ── Stickering system ──────────────────────────────────────────────────
  //
  // Unified, reusable visualization masking for all skin types (stickered,
  // stickerless, coreless, translucent). Three public entry points share
  // ONE private helper (`grayCubieGroup`) and ONE restore path
  // (`clearLayerGray`), and automatically preserve active masks across
  // runtime skin / style updates:
  //
  //   setLayerStickerGray(axis, value)   — gray a whole face layer (U-layer)
  //   setF2LMaskGray(grayColor, pair)    — gray U-layer except the case pair
  //   setPhaseStickering(mask)           — gray every non-target piece (generic)
  //
  // All three push into `grayedStickers` and are restored by `clearLayerGray`.

  /**
   * Restore all previously-grayed sticker & face materials to their original
   * colors and dispose the cloned gray materials.
   *
   * @param keepActiveState When true, preserves the recorded activeStickeringState
   *   so it can be re-applied after a style/skin rebuild.
   */
  public clearLayerGray(keepActiveState = false): void {
    if (!keepActiveState) {
      this.activeStickeringState = null;
    }

    for (const { mesh, materialIndex, originalMat } of this.grayedStickers) {
      if (materialIndex === -1) {
        const current = mesh.material;
        mesh.material = originalMat;
        // Dispose the cloned gray material to avoid GPU memory leak
        if (current !== originalMat && !Array.isArray(current)) {
          current.dispose();
        }
      } else {
        // Multi-material array (stickerless core mesh: [R, L, U, D, F, B])
        const currentArray = mesh.material;
        if (Array.isArray(currentArray)) {
          const currentMat = currentArray[materialIndex];
          currentArray[materialIndex] = originalMat;
          mesh.material = [...currentArray];
          if (currentMat && currentMat !== originalMat) {
            currentMat.dispose();
          }
        }
      }
    }
    this.grayedStickers = [];
    this.requestRender();
  }

  /**
   * Gray out all sticker/exposed-face materials of a single cubie Group.
   *
   * Supports:
   * - Stickered / Coreless / Translucent: grays child sticker meshes (MeshBasicMaterial).
   * - Stickerless: grays exposed colored face materials in the core mesh's 6-material array
   *   while preserving dark internal seam materials.
   */
  private grayCubieGroup(cubieGroup: Group, grayColor: string): void {
    cubieGroup.children.forEach((child) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      const mat = mesh.material;

      // Multi-material array (e.g. stickerless core mesh with 6 face materials)
      if (Array.isArray(mat)) {
        const matArray = [...mat];
        let changed = false;

        matArray.forEach((subMat, index) => {
          if (!subMat) return;
          // In stickerless mode, exposed outer faces have MeshBasicMaterial (colored)
          // while interior faces have seamMaterial (MeshStandardMaterial).
          // We gray the exposed colored faces and leave dark seams intact.
          if ((subMat as MeshBasicMaterial).isMeshBasicMaterial) {
            this.grayedStickers.push({ mesh, materialIndex: index, originalMat: subMat });
            const cloned = (subMat as MeshBasicMaterial).clone();
            cloned.color.set(grayColor);
            matArray[index] = cloned;
            changed = true;
          }
        });

        if (changed) {
          mesh.material = matArray;
        }
        return;
      }

      // Single material (sticker panels in stickered/coreless/translucent skins)
      if ((mat as MeshBasicMaterial).isMeshBasicMaterial) {
        this.grayedStickers.push({ mesh, materialIndex: -1, originalMat: mat });
        const cloned = (mat as MeshBasicMaterial).clone();
        cloned.color.set(grayColor);
        mesh.material = cloned;
      }
    });
  }

  private applyCurrentStickeringState(): void {
    if (!this.activeStickeringState) return;
    if (this.activeStickeringState.type === 'phase') {
      this.applyPhaseStickeringDirect(this.activeStickeringState.mask, this.activeStickeringState.grayColor);
    } else if (this.activeStickeringState.type === 'f2l') {
      this.applyF2LMaskGrayDirect(this.activeStickeringState.grayColor, this.activeStickeringState.pair);
    } else if (this.activeStickeringState.type === 'layer') {
      this.applyLayerStickerGrayDirect(this.activeStickeringState.axis, this.activeStickeringState.layerValue, this.activeStickeringState.grayColor);
    }
  }

  /**
   * Gray out all sticker meshes on cubies belonging to a specific
   * layer (face + value). Used for F2L visualization where the
   * U (yellow) layer should appear gray to focus on the first two layers.
   *
   * Call `clearLayerGray()` before re-syncing facelets to restore
   * original colors.
   *
   * @param axis  'x', 'y', or 'z'
   * @param layerValue  -1, 0, or 1
   * @param grayColor  CSS color string (default '#505050')
   */
  public setLayerStickerGray(
    axis: 'x' | 'y' | 'z',
    layerValue: number,
    grayColor: string = '#505050',
  ): void {
    this.clearLayerGray(true);
    this.activeStickeringState = { type: 'layer', axis, layerValue, grayColor };
    this.applyLayerStickerGrayDirect(axis, layerValue, grayColor);
  }

  private applyLayerStickerGrayDirect(
    axis: 'x' | 'y' | 'z',
    layerValue: number,
    grayColor: string,
  ): void {
    if (!this.model || !this.factory) return;
    const cubies = this.model.getCubiesByFace(axis, layerValue);
    for (const cubieGroup of cubies) {
      this.grayCubieGroup(cubieGroup, grayColor);
    }
    this.requestRender();
  }

  /**
   * Applies F2L-specific masking to the 3D cube model.
   *
   * Mirrors the standard F2L stickering:
   *   - colored: the case pair (corner + edge) wherever it is (own slot, U
   *     layer, or trapped in another slot), and every piece of layers 1-2
   *     (F2L) that is currently in its solved home position;
   *   - grayed: the whole U layer except the pair, and any F2L piece that is
   *     out of place (e.g. the displaced corner of a trapped-slot case).
   *
   * @param grayColor CSS color string (default '#505050')
   * @param pair The case pair piece IDs ({@link CORNER_HOME_POSITION} / {@link EDGE_HOME_POSITION}
   *   indices) — the canonical F2L pair (see casePresentation.F2L_CASE_PAIR).
   */
  public setF2LMaskGray(
    grayColor: string = '#505050',
    pair?: { homeC: number; homeE: number } | null,
  ): void {
    this.clearLayerGray(true);
    this.activeStickeringState = { type: 'f2l', grayColor, pair };
    this.applyF2LMaskGrayDirect(grayColor, pair);
  }

  private applyF2LMaskGrayDirect(
    grayColor: string,
    pair?: { homeC: number; homeE: number } | null,
  ): void {
    if (!this.model || !this.factory) return;

    // Home grid positions of the pair pieces (which cubie permanently carries
    // each piece, even after scrambling).
    let pairKeys: Set<string> | null = null;
    if (pair) {
      const c = CORNER_HOME_POSITION[pair.homeC];
      const e = EDGE_HOME_POSITION[pair.homeE];
      if (c && e) {
        pairKeys = new Set([
          `${c.x},${c.y},${c.z}`,
          `${e.x},${e.y},${e.z}`,
        ]);
      }
    }

    const cubies = this.model.getLogicalState();
    for (const cubie of cubies) {
      const key = `${cubie.initialGridX},${cubie.initialGridY},${cubie.initialGridZ}`;
      // The pair is always kept colored (even when it sits in the U layer for
      // both-on-top cases, or trapped in a wrong slot for advanced cases).
      if (pairKeys?.has(key)) continue;

      const q = cubie.mesh.quaternion;
      const isOriented =
        Math.abs(q.w) > 0.999 &&
        Math.abs(q.x) < 0.01 &&
        Math.abs(q.y) < 0.01 &&
        Math.abs(q.z) < 0.01;

      const inHome =
        cubie.gridX === cubie.initialGridX &&
        cubie.gridY === cubie.initialGridY &&
        cubie.gridZ === cubie.initialGridZ &&
        isOriented;

      // U-layer pieces (Yellow facelets / OLL pieces) are grayed, plus any F2L
      // piece that is out of its solved place or misoriented/flipped.
      if (cubie.initialGridY === 1 || !inHome) {
        this.grayCubieGroup(cubie.mesh, grayColor);
      }
    }
    this.requestRender();
  }

  /**
   * Generic phase stickering — grays out every cubie that does NOT contain a
   * target piece listed in the {@link PhaseMask}. Reusable for cross, xcross,
   * xxcross, eocross, EOLine, and any other partial-goal visualization.
   *
   * The cubies that hold the mask's target edges/corners (identified by their
   * home grid position via {@link EDGE_HOME_POSITION} / {@link CORNER_HOME_POSITION})
   * keep their original colors; all other movable cubie stickers are grayed
   * out (centers + core stay visible as reference, matching the reference
   * web's stickering mask where centers stay "regular").
   * Call {@link clearLayerGray} before re-syncing facelets or changing the mask.
   *
   * @param mask      The PhaseMask whose target pieces should stay colored.
   * @param grayColor CSS color string (default '#505050').
   */
  public setPhaseStickering(mask: PhaseMask, grayColor: string = '#505050'): void {
    this.clearLayerGray(true);
    this.activeStickeringState = { type: 'phase', mask, grayColor };
    this.applyPhaseStickeringDirect(mask, grayColor);
  }

  private applyPhaseStickeringDirect(mask: PhaseMask, grayColor: string): void {
    if (!this.model || !this.factory) return;

    // Collect the home grid positions of every target piece in the mask.
    const targetKeys = new Set<string>();
    if (mask.edges) {
      for (const rule of mask.edges) {
        const home = EDGE_HOME_POSITION[rule.id];
        if (home) targetKeys.add(`${home.x},${home.y},${home.z}`);
      }
    }
    if (mask.corners) {
      for (const rule of mask.corners) {
        const home = CORNER_HOME_POSITION[rule.id];
        if (home) targetKeys.add(`${home.x},${home.y},${home.z}`);
      }
    }

    // Gray out every movable piece (edge / corner) whose home position is
    // NOT in the target set. A piece is movable when at least 2 of its 3
    // home coordinates are non-zero (edges: 2, corners: 3; centers: 1, core: 0).
    const cubies = this.model.getLogicalState();
    for (const cubie of cubies) {
      const movable =
        Math.abs(cubie.initialGridX) +
        Math.abs(cubie.initialGridY) +
        Math.abs(cubie.initialGridZ) >= 2;
      if (!movable) continue; // keep centers + core visible
      const key = `${cubie.initialGridX},${cubie.initialGridY},${cubie.initialGridZ}`;
      if (targetKeys.has(key)) continue; // keep this cubie colored
      this.grayCubieGroup(cubie.mesh, grayColor);
    }
    this.requestRender();
  }

  /**
   * Play a WCA scramble string as a sequence of animated layer rotations.
   *
   * Each move animates with the smooth easing and an adaptive duration
   * proportional to its angle (90° vs 180°). Returns `false` (without
   * touching the cube) when the scramble is empty or contains a move the
   * engine cannot animate — callers should fall back to instant facelet
   * sync in that case.
   */
  public async applyScrambleAnimated(
    scramble: string,
    baseDurationMs = 160,
  ): Promise<boolean> {
    if (!this.model || !this.rotationEngine) return false;
    const moves = parseScrambleMoves(scramble);
    if (!moves || moves.length === 0) return false;

    // Match the old instant-sync semantics: the scramble always plays from
    // the solved state, never compounding on whatever the cube currently is.
    this.resetCube();

    this.requestRender();
    for (const move of moves) {
      await this.rotateLayers(
        move.axis,
        [move.layerValue],
        move.angle,
        scrambleMoveDurationMs(move.angle, baseDurationMs),
        undefined,
        'smooth',
      );
    }
    this.requestRender();
    return true;
  }

  /**
   * True when any animation system still has work to do on the next frame.
   * Used by {@link loop} to decide whether to keep the rAF cycle alive.
   */
  private hasActiveAnimation(): boolean {
    if (this.orientationAnim) return true;
    if (this.cameraAnim) return true;
    if (this.rotationEngine?.isAnimating()) return true;
    if (this.gyroFusion?.isEnabled()) return true;
    if (this.cameraMomentum && this.cameraMomentumState !== 'idle') return true;
    return false;
  }

  private loop = (timeMs: number) => {
    if (!this.isRunning) return;

    const deltaMs = timeMs - this.lastTime;
    this.lastTime = timeMs;

    if (this.rotationEngine) this.rotationEngine.update(timeMs);
    if (this.gyroFusion) this.gyroFusion.update(deltaMs);

    // Camera inertia. While 'dragging', the rotation is applied directly by
    // rotateCamera() — here we only age the stored velocity so a long hold
    // can't leave a stale flick on release. Once released ('gliding'), we
    // decay the velocity and keep rotating until it falls below the
    // threshold. Keeps the loop alive via hasActiveAnimation.
    if (this.cameraMomentum && this.cameraMomentumState !== 'idle') {
      const dt = Math.min(Math.max((timeMs - this.cameraMomentum.lastApplyTime) / 16.667, 0), 3);
      const decay = Math.pow(this.cameraMomentumDecay, dt);

      if (this.cameraMomentumState === 'dragging') {
        // Pointer down: don't rotate here (would double the drag) — just age
        // the velocity so the release glide reflects recent motion only.
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

      const curTheta =
        this.cameraAnim.startTheta +
        (this.cameraAnim.targetTheta - this.cameraAnim.startTheta) * eased;
      const curPhi =
        this.cameraAnim.startPhi +
        (this.cameraAnim.targetPhi - this.cameraAnim.startPhi) * eased;
      const curRadius =
        this.cameraAnim.startRadius +
        (this.cameraAnim.targetRadius - this.cameraAnim.startRadius) * eased;

      this.sceneManager.setOrbitAngles(curTheta, curPhi, curRadius);

      if (t >= 1.0) {
        const resolve = this.cameraAnim.resolve;
        this.cameraAnim = null;
        resolve?.();
      }
    }

    if (this.orientationAnim && this.model) {
      const elapsed = timeMs - this.orientationAnim.startTime;
      let t = elapsed / this.orientationAnim.durationMs;

      if (t >= 1.0) {
        this.model.root.quaternion.copy(this.orientationAnim.targetQuat);
        const resolve = this.orientationAnim.resolve;
        this.orientationAnim = null;
        resolve?.();
      } else {
        const eased = 1 - Math.pow(1 - t, 3);
        this.model.root.quaternion.slerpQuaternions(
          this.orientationAnim.startQuat,
          this.orientationAnim.targetQuat,
          eased,
        );
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
      // Idle: pause the loop until the next requestRender() call.
      this.animFrameId = null;
    }
  };

  public dispose(): void {
    this.isRunning = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.finishOrientationAnim();
    this.finishCameraAnim();
    this.needsRender = false;
    this.cameraMomentum = null;
    this.cameraMomentumState = 'idle';
    this.orientationSub?.unsubscribe();
    this.rotationEventSub?.unsubscribe();
    if (this.orientationTracker) this.orientationTracker.dispose();
    if (this.sceneManager) this.sceneManager.dispose();
    if (this.factory) this.factory.dispose();
  }
}

// ── Edge / Corner ID → home grid position lookup tables ───────────────────
//
// Kociemba coordinate system used by CubeModel:
//   X = R(+1) / L(-1),  Y = U(+1) / D(-1),  Z = F(+1) / B(-1).
//
// The "home position" of a piece is the grid cell where that piece lives in
// a SOLVED cube. A cubie's `initialGridX/Y/Z` identifies which piece it
// permanently carries (even after scrambling), so we map the mask's target
// piece IDs to home positions and keep those cubies colored in
// {@link Cube3DEngine.setPhaseStickering}.

export interface GridPosition {
  x: number;
  y: number;
  z: number;
}

/** Edge ID → home grid position. Index aligns with the `Edge` enum. */
export const EDGE_HOME_POSITION: GridPosition[] = [
  { x: 1, y: 1, z: 0 },   // UR  (0)
  { x: 0, y: 1, z: 1 },   // UF  (1)
  { x: -1, y: 1, z: 0 },  // UL  (2)
  { x: 0, y: 1, z: -1 },  // UB  (3)
  { x: 1, y: -1, z: 0 },  // DR  (4)
  { x: 0, y: -1, z: 1 },  // DF  (5)
  { x: -1, y: -1, z: 0 }, // DL  (6)
  { x: 0, y: -1, z: -1 }, // DB  (7)
  { x: 1, y: 0, z: 1 },   // FR  (8)
  { x: -1, y: 0, z: 1 },  // FL  (9)
  { x: -1, y: 0, z: -1 }, // BL  (10)
  { x: 1, y: 0, z: -1 },  // BR  (11)
];

/** Corner ID → home grid position. Index aligns with the `Corner` enum. */
export const CORNER_HOME_POSITION: GridPosition[] = [
  { x: 1, y: 1, z: 1 },    // URF (0)
  { x: -1, y: 1, z: 1 },   // UFL (1)
  { x: -1, y: 1, z: -1 },  // ULB (2)
  { x: 1, y: 1, z: -1 },   // UBR (3)
  { x: 1, y: -1, z: 1 },   // DFR (4)
  { x: -1, y: -1, z: 1 },  // DLF (5)
  { x: -1, y: -1, z: -1 }, // DBL (6)
  { x: 1, y: -1, z: -1 },  // DRB (7)
];
