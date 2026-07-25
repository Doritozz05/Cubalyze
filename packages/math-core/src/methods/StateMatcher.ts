import { CubeState } from '../CubeState';
import { PhaseMask } from './IMethodDefinition';
import { CompiledMask, compilePhaseMask } from './CompiledMasks';

/**
 * PASO 4 — StateMatcher with O(1) fast path.
 *
 * matchesMask() first attempts to use a compiled (mask, value) bigint tuple for
 * the PhaseMask. If compilePhaseMask() succeeds (returns a non-null CompiledMask),
 * the match is reduced to two bigint ANDs and two bigint comparisons — O(1)
 * regardless of how many rules the mask has.
 *
 * If the mask contains "find this piece anywhere" rules (any EdgeRule /
 * CornerRule with requiredEp / requiredCp undefined), compilePhaseMask returns
 * null and we fall back to the original linear scanner (findById scan + per-
 * position check).
 *
 * The WeakMap caches the build outcome (compiled mask OR null) keyed by the
 * PhaseMask instance itself, so we only pay compilation cost once per mask
 * per process lifetime.
 */
export class StateMatcher {
  /**
   * Compile cache: maps a PhaseMask instance to its compiled form (or null if
   * the mask has find-anywhere rules and cannot be compiled).
   *
   * Using a WeakMap so that if a PhaseMask is garbage collected (e.g., a one-
   * off mask created during a session), its compile result is reclaimed too.
   */
  private static compileCache = new WeakMap<PhaseMask, CompiledMask | null>();

  /**
   * Statistics — incremented by matchesMask, used by tests to confirm the
   * fast path is taken in production. NOT a hot-path concern (single
   * counter increment under JIT).
   */
  public static compiledMatches = 0;
  public static linearMatches = 0;

  /**
   * Returns true if `state` satisfies all rules of `mask`.
   *
   * Order:
   *   1. Look up cached compiled form (WeakMap.get).
   *   2. If cache miss, compile and cache.
   *   3. If compiled form is non-null → fast path (4 ops, O(1)).
   *   4. If compiled form is null → linear fallback (per-rule scan).
   */
  public static matchesMask(state: CubeState, mask: PhaseMask): boolean {
    let compiled = StateMatcher.compileCache.get(mask);
    if (compiled === undefined) {
      compiled = compilePhaseMask(mask);
      StateMatcher.compileCache.set(mask, compiled);
    }
    if (compiled !== null) {
      StateMatcher.compiledMatches++;
      return (state._corners & compiled.maskCorners) === compiled.valueCorners
          && (state._edges  & compiled.maskEdges)  === compiled.valueEdges;
    }
    StateMatcher.linearMatches++;
    return StateMatcher.matchesMaskLinear(state, mask);
  }

  /**
   * Linear fallback for masks that include "find this piece anywhere" rules.
   * Equivalent to the pre-PASO-4 implementation; behavior is bit-identical.
   *
   * Note on CubeState architecture:
   *   state.ep[position] = piece_id
   *   state.eo[position] = orientation
   *   state.cp[position] = piece_id
   *   state.co[position] = orientation
   *
   * A rule with both id and requiredEp asserts: at position requiredEp,
   * the piece is `id`. With requiredEo also set, that piece's orientation
   * also equals requiredEo. With id set but requiredEp undefined, the piece
   * `id` may be anywhere; we scan all 12 (edge) / 8 (corner) positions.
   */
  public static matchesMaskLinear(state: CubeState, mask: PhaseMask): boolean {
    // ── Edges ─────────────────────────────────────────────────────────
    if (mask.edges) {
      for (const rule of mask.edges) {
        if (rule.requiredEp !== undefined) {
          if (state.ep[rule.requiredEp] !== rule.id) return false;
          if (rule.requiredEo !== undefined && state.eo[rule.requiredEp] !== rule.requiredEo) return false;
        } else {
          if (rule.requiredEo !== undefined) {
            let foundPos = -1;
            for (let i = 0; i < 12; i++) {
              if (state.ep[i] === rule.id) { foundPos = i; break; }
            }
            if (foundPos === -1 || state.eo[foundPos] !== rule.requiredEo) return false;
          }
        }
      }
    }

    // ── Corners ───────────────────────────────────────────────────────
    if (mask.corners) {
      for (const rule of mask.corners) {
        if (rule.requiredCp !== undefined) {
          if (state.cp[rule.requiredCp] !== rule.id) return false;
          if (rule.requiredCo !== undefined && state.co[rule.requiredCp] !== rule.requiredCo) return false;
        } else {
          if (rule.requiredCo !== undefined) {
            let foundPos = -1;
            for (let i = 0; i < 8; i++) {
              if (state.cp[i] === rule.id) { foundPos = i; break; }
            }
            if (foundPos === -1 || state.co[foundPos] !== rule.requiredCo) return false;
          }
        }
      }
    }

    // ── Edge positions (orientation only) ─────────────────────────────
    if (mask.edgePositions) {
      for (const rule of mask.edgePositions) {
        if (rule.requiredEo !== undefined && state.eo[rule.pos] !== rule.requiredEo) return false;
      }
    }

    // ── Corner positions (orientation only) ───────────────────────────
    if (mask.cornerPositions) {
      for (const rule of mask.cornerPositions) {
        if (rule.requiredCo !== undefined && state.co[rule.pos] !== rule.requiredCo) return false;
      }
    }

    return true;
  }

  /**
   * Test-only helper: clears the compile cache.
   *
   * `compiledMatches` and `linearMatches` are also reset. Useful for tests
   * that want to verify "did the matcher use the fast path?" between calls.
   */
  public static __resetCache(): void {
    StateMatcher.compileCache = new WeakMap();
    StateMatcher.compiledMatches = 0;
    StateMatcher.linearMatches = 0;
  }
}
