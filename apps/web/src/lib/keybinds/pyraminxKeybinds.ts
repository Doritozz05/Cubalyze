/**
 * Virtual-Pyraminx keyboard layout — same ergonomic philosophy as the cube's
 * CUBE_KEYMAP (csTimer-style): index fingers rest on U, clockwise and
 * counterclockwise are SEPARATE keys (no Shift) so the mapping is pure
 * muscle memory.
 *
 * Moves are the 8 WCA Pyraminx turns: layer turns U/L/R/B and tip turns
 * u/l/r/b, each with its prime. Keys are `event.code` values (physical keys,
 * layout independent).
 */
export interface PyraminxKeyAction {
  /** The WCA token this key performs (e.g. "U", "L'", "u"). */
  token: string;
}

/** csTimer-inspired pyraminx keymap. */
export const PYRAMINX_KEYMAP: Readonly<Record<string, PyraminxKeyAction>> = {
  // ── Layer turns (the "holding the tetrahedron" home row) ──────────────
  KeyJ: { token: "U" }, // J = U
  KeyF: { token: "U'" }, // F = U'
  KeyI: { token: "R" }, // I = R
  KeyK: { token: "R'" }, // K = R'
  KeyD: { token: "L" }, // D = L
  KeyE: { token: "L'" }, // E = L'
  KeyW: { token: "B" }, // W = B
  KeyO: { token: "B'" }, // O = B'

  // ── Tip turns (lowercase — the tip at each vertex) ────────────────────
  KeyU: { token: "u" }, // U = u
  KeyM: { token: "u'" }, // M = u'
  KeyH: { token: "r" }, // H = r
  KeyG: { token: "r'" }, // G = r'
  KeyR: { token: "l" }, // R = l
  KeyV: { token: "l'" }, // V = l'
  KeyC: { token: "b" }, // C = b
  Comma: { token: "b'" }, // , = b'
};

/** Resolve a keyboard event code to a pyraminx move token, or null. */
export function pyraminxKeyToToken(code: string): string | null {
  return PYRAMINX_KEYMAP[code]?.token ?? null;
}

/** The distinct tokens the keymap covers (for the help overlay). */
export const PYRAMINX_KEYMAP_TOKENS: readonly string[] = Object.values(
  PYRAMINX_KEYMAP,
).map((a) => a.token);
