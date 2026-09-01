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
 * vertices). The screen drag is projected to world space and compared
 * against each candidate's rotation TANGENT t = axis × piecePosition —
 * the direction the piece moves under the +120° right-hand rotation (the
 * engine's positive angle = the COUNTER-CLOCKWISE turn = the PRIME, exactly
 * like the cube where dragging along the +90° tangent resolves R'). The
 * candidate whose tangent best matches the drag wins, and a drag along +t
 * resolves to the PRIME (U', L', …) while a drag against it resolves to the
 * plain token — the grabbed stickers follow the finger (the plain WCA turn
 * is the CLOCKWISE turn, WCA 12e2, i.e. motion along −t), exactly like the
 * cube.
 *
 * IMPORTANT sign detail (same as the cube): screen Y grows DOWNWARD while
 * `cameraUp` is the world direction of screen-TOP, so the world drag is
 * `dx·cameraRight − dy·cameraUp`.
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
}

/** A resolved fixed-angle turn: the token is vertex (+ "'" for the prime). */
export interface PyraminxDragMove {
  vertex: "U" | "L" | "R" | "B";
  scope: "layer" | "tip";
  direction: 1 | -1;
}

/** Minimum |cos| between the drag and a tangent before a move resolves —
 *  below this the swipe is ambiguous (sliding along an axis / diagonal) and
 *  the resolver refuses until the drag commits. */
const MIN_TANGENT_COS = 0.3;

/**
 * Resolve WHICH fixed ±120° turn a piece drag fires, or null while the drag
 * is still ambiguous (below the tangent alignment threshold). Pure — unit
 * tested without any engine.
 */
export function resolvePyraminxDragMove(input: PyraminxDragInput): PyraminxDragMove | null {
  const { dx, dy, worldPoint: p, candidates, axes, cameraRight, cameraUp } = input;
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null;
  if (Math.hypot(dx, dy) < 1e-3) return null;

  // Screen drag → world drag (see the sign note above).
  const worldDrag: Vec3 = {
    x: dx * cameraRight.x - dy * cameraUp.x,
    y: dx * cameraRight.y - dy * cameraUp.y,
    z: dx * cameraRight.z - dy * cameraUp.z,
  };
  const dragLen = Math.hypot(worldDrag.x, worldDrag.y, worldDrag.z);
  if (dragLen < 1e-6) return null;

  let best: PyraminxDragMove | null = null;
  let bestScore = 0;
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
    const cos =
      (tx * worldDrag.x + ty * worldDrag.y + tz * worldDrag.z) / (tLen * dragLen);
    const abs = Math.abs(cos);
    if (abs > bestScore) {
      bestScore = abs;
      // Along +t = the +120° counter-clockwise turn = the PRIME; against it
      // (−t) = the plain CLOCKWISE turn. The stickers follow the finger in
      // both cases (same composition as the cube's `sign / angleSign`).
      best = { vertex: c.vertex, scope: c.scope, direction: cos < 0 ? 1 : -1 };
    }
  }
  if (!best || bestScore < MIN_TANGENT_COS) return null;
  return best;
}

/** The WCA token a resolved drag performs ("U", "L'", "u", …). */
export function pyraminxDragToken(move: PyraminxDragMove): string {
  const base = move.scope === "tip" ? move.vertex.toLowerCase() : move.vertex;
  return move.direction < 0 ? `${base}'` : base;
}
