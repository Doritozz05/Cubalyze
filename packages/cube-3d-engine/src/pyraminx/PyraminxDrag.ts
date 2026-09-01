/**
 * Pyraminx virtual-drag resolver — the vertex-turning counterpart of the
 * cube's {@link resolveDragMove}.
 *
 * Gesture model (same as the cube simulator): a drag on a PIECE does not
 * track the mouse live. Once the swipe passes the dead zone it resolves a
 * definite move — the layer or tip under the finger — and fires it through
 * the same pipeline as the keyboard, so the turn lands at exactly ±120°,
 * ignoring the mouse from then on (virtual-puzzle style, no free rotation).
 *
 * Resolution: the piece offers its candidate turn axes (a corner/tip turns
 * around ITS vertex; an edge can turn around either of its slot's two
 * vertices). For each candidate the piece's motion under a +120° turn is the
 * tangent t = a × p (right-hand rule, the engine's positive angle = the
 * COUNTER-CLOCKWISE turn = the PRIME, exactly like the cube where dragging
 * along the +90° tangent resolves R'). The drag lives in the VIEW PLANE, so
 * the alignment is measured against the tangent's SCREEN projection (t·right,
 * t·up) — NOT the full 3D tangent: a sticker whose arc points toward/away
 * from the camera has a short projection, and against the full tangent even
 * a perfect arc-following drag caps at |t_par|/|t| < 0.3 and is rejected
 * ("100% correct drags that do nothing"). Screen-space scoring is
 * camera-robust: a drag that follows the sticker's visible arc scores ~1 on
 * every sticker, in every view.
 *
 * The candidate with the HIGHEST SIGNED alignment wins (not |cos|): for an
 * edge, the two endpoint tangents are anti-parallel, so |cos| ties and the
 * drag direction would be ignored — the edge could only ever turn around its
 * first vertex. With signed scoring, swiping the sticker one way turns it
 * around one endpoint and swiping the other way around the other, and the
 * grabbed stickers ALWAYS follow the finger: a drag along the projected
 * tangent (+t) resolves the PRIME (U', …) and a drag against it the plain
 * token (U, … — the plain WCA turn is the CLOCKWISE turn, WCA 12e2, i.e.
 * motion along −t), exactly like the cube's `sign / angleSign`.
 *
 * IMPORTANT sign detail (same as the cube): screen Y grows DOWNWARD while
 * `cameraUp` is the world direction of screen-TOP, so the screen-up
 * component of the drag is −dy.
 */

/** A 3D vector (structural — accepts three.js Vector3). */
interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface PyraminxDragCandidate {
  /** The vertex whose axis this candidate turns around. */
  vertex: "U" | "L" | "R" | "B";
  /** Whether the turn is a full layer or a tip-only turn. */
  scope: "layer" | "tip";
}

export interface PyraminxDragInput {
  /** Pointer travel in screen px since the drag started (+x = right, +y = down). */
  dx: number;
  dy: number;
  /** The picked piece's slot position in the ROOT frame (puzzle frame). */
  worldPoint: Vec3;
  /** Candidate turns for the picked piece (1 for corners/tips, 2 for edges). */
  candidates: PyraminxDragCandidate[];
  /** Unit vertex axes (engine's PYRAMINX_AXES, same frame as worldPoint). */
  axes: Record<"U" | "L" | "R" | "B", Vec3>;
  /** Camera world basis: screen-right and screen-up (unit-ish vectors). */
  cameraRight: Vec3;
  cameraUp: Vec3;
  /**
   * World positions of the 4 vertices (scaled, current orientation). Used
   * ONLY by the spatial fallback: when a swipe is tangent-ambiguous (a
   * diagonal drag the perspective makes unintuitive — e.g. the RB edge
   * swiped right-and-up scores < 0.3 against BOTH its arcs), the resolver
   * turns toward the candidate vertex the drag heads at, instead of firing
   * nothing. Optional — callers that omit it keep the pure tangent rule.
   */
  vertices?: Record<"U" | "L" | "R" | "B", Vec3>;
}

/** A resolved fixed-angle turn: the token is vertex (+ "'" for the prime). */
export interface PyraminxDragMove {
  vertex: "U" | "L" | "R" | "B";
  scope: "layer" | "tip";
  direction: 1 | -1;
}

/** Minimum |alignment| between the drag and a projected tangent before a
 *  move resolves — below this the swipe is ambiguous (sliding along an axis /
 *  diagonal) and the resolver refuses until the drag commits. Measured in
 *  SCREEN space, so it is a pure angle question — identical for every
 *  sticker regardless of the camera. */
const MIN_TANGENT_COS = 0.3;

/**
 * Resolve WHICH fixed ±120° turn a piece drag fires, or null while the drag
 * is still ambiguous (below the tangent alignment threshold). Pure — unit
 * tested without any engine.
 */
export function resolvePyraminxDragMove(input: PyraminxDragInput): PyraminxDragMove | null {
  const { dx, dy, worldPoint: p, candidates, axes, cameraRight, cameraUp } = input;
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null;
  const dragLen = Math.hypot(dx, dy);
  if (dragLen < 1e-3) return null;

  let best: PyraminxDragMove | null = null;
  // |cos| best: the winner is the candidate whose visible arc the drag most
  // closely FOLLOWS, measured as |cos| against that candidate's own projected
  // tangent. A pure signed maximum would make only ONE candidate reachable
  // per swipe direction when an edge's two candidate arcs project to
  // different (non-anti-parallel) screen directions: the other candidate is
  // then unreachable from that swipe, and drags perpendicular to the winner's
  // arc fall below the threshold for BOTH candidates and resolve to null
  // ("base edge: right/up-right does nothing, only left works, only L'").
  // Scoring by |cos| makes every swipe direction that follows ANY candidate's
  // arc resolve. For genuinely anti-parallel edge tangents the |cos| values
  // tie; the tie is broken by the signed cos, which preserves the designed
  // edge behavior (swipe direction selects the endpoint whose arc is
  // followed) while making distinct-arc edges fully reachable.
  let bestAbs = -Infinity;
  let bestSigned = -Infinity;
  for (const c of candidates) {
    const a = axes[c.vertex];
    // Tangent of the piece under a +120° turn around the candidate axis:
    // t = a × p (right-hand rule — the engine's positive angle).
    let tx = a.y * p.z - a.z * p.y;
    let ty = a.z * p.x - a.x * p.z;
    let tz = a.x * p.y - a.y * p.x;
    let tLen = Math.hypot(tx, ty, tz);
    if (tLen < 1e-3) {
      // Fallback when grabbed on the axis itself (e.g. at the exact apex of a tip):
      // A turn around axis `a` moves perpendicular to `a` in the view plane.
      // cf = cameraRight × cameraUp (vector pointing out of screen towards viewer)
      const cfx = cameraRight.y * cameraUp.z - cameraRight.z * cameraUp.y;
      const cfy = cameraRight.z * cameraUp.x - cameraRight.x * cameraUp.z;
      const cfz = cameraRight.x * cameraUp.y - cameraRight.y * cameraUp.x;
      // t = a × cf (tangent on the front viewer-facing side)
      tx = a.y * cfz - a.z * cfy;
      ty = a.z * cfx - a.x * cfz;
      tz = a.x * cfy - a.y * cfx;
      tLen = Math.hypot(tx, ty, tz);
      if (tLen < 1e-4) {
        // Degenerate case: axis points directly along the camera view direction.
        const dot = a.x * cfx + a.y * cfy + a.z * cfz;
        const sign = dot >= 0 ? 1 : -1;
        tx = sign * cameraRight.x;
        ty = sign * cameraRight.y;
        tz = sign * cameraRight.z;
        tLen = Math.hypot(tx, ty, tz);
      }
      if (tLen < 1e-4) continue;
    }
    // Project the (unit) tangent onto the SCREEN basis. The drag is a
    // screen-space vector, so its alignment with the tangent is exactly the
    // alignment with this projection — foreshortening (the tangent's
    // view-normal component) cancels out and can never reject a drag.
    const sx = (tx * cameraRight.x + ty * cameraRight.y + tz * cameraRight.z) / tLen;
    const sy = (tx * cameraUp.x + ty * cameraUp.y + tz * cameraUp.z) / tLen;
    const sLen = Math.hypot(sx, sy);
    if (sLen < 1e-4) continue; // arc edge-on to the camera — no visible motion
    // Screen-up component of the drag is −dy (screen Y grows DOWNWARD).
    const cos = (sx * dx - sy * dy) / (sLen * dragLen);
    const abs = cos < 0 ? -cos : cos;
    if (abs > bestAbs + 1e-9 || (abs > bestAbs - 1e-9 && cos > bestSigned)) {
      bestAbs = abs;
      bestSigned = cos;
      // Along the projected arc (+t on screen) = the +120° counter-clockwise
      // turn = the PRIME; against it (−t) = the plain CLOCKWISE turn. The
      // stickers follow the finger in both cases (same composition as the
      // cube's `sign / angleSign`).
      best = { vertex: c.vertex, scope: c.scope, direction: cos < 0 ? 1 : -1 };
    }
  }
  if (!best || bestAbs < MIN_TANGENT_COS) {
    return resolveSpatialFallback({
      worldPoint: p,
      candidates,
      axes,
      vertices: input.vertices,
      cameraRight,
      cameraUp,
      dx,
      dy,
      dragLen,
    });
  }
  return best;
}

/**
 * Spatial fallback for tangent-ambiguous swipes (see
 * {@link PyraminxDragInput.vertices}): pick the candidate whose vertex the
 * drag heads toward on screen. The grabbed sticker can never "follow the
 * finger" around a radial swipe (the turn motion is tangential), so the
 * direction is read from the swipe's residual alignment with the winner's
 * tangent — a purely radial swipe defaults to the plain turn.
 */
function resolveSpatialFallback(input: {
  worldPoint: Vec3;
  candidates: PyraminxDragCandidate[];
  axes: Record<"U" | "L" | "R" | "B", Vec3>;
  vertices?: Record<"U" | "L" | "R" | "B", Vec3>;
  cameraRight: Vec3;
  cameraUp: Vec3;
  dx: number;
  dy: number;
  dragLen: number;
}): PyraminxDragMove | null {
  const { worldPoint: p, candidates, axes, vertices, cameraRight, cameraUp, dx, dy, dragLen } = input;
  if (!vertices) return null;

  // World-space drag (right/up are orthonormal, so |worldDrag| === dragLen).
  const wx = dx * cameraRight.x - dy * cameraUp.x;
  const wy = dx * cameraRight.y - dy * cameraUp.y;
  const wz = dx * cameraRight.z - dy * cameraUp.z;

  let best: PyraminxDragMove | null = null;
  let bestCos = -Infinity;
  for (const c of candidates) {
    const v = vertices[c.vertex];
    if (!v) continue;
    // Screen direction from the grabbed point toward the vertex. Perspective
    // depth is ignored (same convention as the tangent projection — the
    // puzzle is small relative to the camera distance).
    const ddx = v.x - p.x;
    const ddy = v.y - p.y;
    const ddz = v.z - p.z;
    const rx = ddx * cameraRight.x + ddy * cameraRight.y + ddz * cameraRight.z;
    const ry = ddx * cameraUp.x + ddy * cameraUp.y + ddz * cameraUp.z;
    const rLen = Math.hypot(rx, ry);
    if (rLen < 1e-4) continue; // vertex coincides with the grab point on screen
    // Screen-up component of the drag is −dy (same sign note as above).
    const cos = (rx * dx - ry * dy) / (rLen * dragLen);
    if (cos <= bestCos) continue;
    bestCos = cos;
    // Direction: the swipe's alignment with the winner's tangent. Along +t →
    // the prime; against it → the plain turn (stickers follow the finger).
    const a = axes[c.vertex];
    const tx = a.y * p.z - a.z * p.y;
    const ty = a.z * p.x - a.x * p.z;
    const tz = a.x * p.y - a.y * p.x;
    const tLen = Math.hypot(tx, ty, tz);
    let tCos = 0;
    if (tLen >= 1e-4) {
      tCos = (tx * wx + ty * wy + tz * wz) / (tLen * dragLen);
    }
    const direction = Math.abs(tCos) < 0.05 ? 1 : tCos < 0 ? 1 : -1;
    best = { vertex: c.vertex, scope: c.scope, direction };
  }
  if (!best || bestCos < MIN_TANGENT_COS) return null;
  return best;
}

/** The WCA token a resolved drag performs ("U", "L'", "u", …). */
export function pyraminxDragToken(move: PyraminxDragMove): string {
  const base = move.scope === "tip" ? move.vertex.toLowerCase() : move.vertex;
  return move.direction < 0 ? `${base}'` : base;
}
