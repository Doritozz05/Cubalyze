import { describe, expect, it } from "vitest";
import { StateMatcher } from "./StateMatcher";
import { CubeState } from "../CubeState";
import { CrossMask, F2LMask, OLLMask, PLLMask } from "./cfop/cfopMasks";
import { RouxFirstBlockMask } from "./roux/rouxMasks";

describe("StateMatcher (Method Detection)", () => {
  it("matches a solved cube for all CFOP masks", () => {
    // A solved cube naturally satisfies Cross, F2L, OLL, and PLL.
    const state = new CubeState(); // default is solved

    expect(StateMatcher.matchesMask(state, CrossMask)).toBe(true);
    expect(StateMatcher.matchesMask(state, F2LMask)).toBe(true);
    expect(StateMatcher.matchesMask(state, OLLMask)).toBe(true);
    expect(StateMatcher.matchesMask(state, PLLMask)).toBe(true);
    
    // It should also satisfy Roux's First Block since it's just the left block.
    expect(StateMatcher.matchesMask(state, RouxFirstBlockMask)).toBe(true);
  });

  it("fails Cross if one cross edge is flipped", () => {
    const state = new CubeState();
    // Flip the DF edge
    state.eo[5] = 1;
    
    expect(StateMatcher.matchesMask(state, CrossMask)).toBe(false);
  });

  it("fails Cross if it's relative but not absolute", () => {
    const state = new CubeState();
    // Do a D move
    state.applySequence("D");
    
    // The cross is preserved internally relative, but the absolute pieces 
    // are shifted (e.g. DF went to DR, etc.)
    expect(StateMatcher.matchesMask(state, CrossMask)).toBe(false);
  });

  it("detects Cross but fails F2L when only cross is done", () => {
    const state = new CubeState();
    // Mess up the U layer and some F2L pieces (e.g., U and R moves)
    // Actually let's just swap two corners in the U layer (UFL and URF)
    const tmpCp = state.cp[0];
    state.cp[0] = state.cp[1];
    state.cp[1] = tmpCp;

    // Cross should still be true because D edges are untouched.
    expect(StateMatcher.matchesMask(state, CrossMask)).toBe(true);

    // Swap an F2L corner (DFR) with a U layer corner
    const tmpCp2 = state.cp[4];
    state.cp[4] = state.cp[2];
    state.cp[2] = tmpCp2;

    expect(StateMatcher.matchesMask(state, F2LMask)).toBe(false);
  });

  it("detects OLL but fails PLL if U layer is oriented but not permuted", () => {
    const state = new CubeState();
    // Do a U move - all pieces in U are still oriented (0), but their positions are rotated.
    state.applySequence("U");
    
    expect(StateMatcher.matchesMask(state, OLLMask)).toBe(true);
    // Since we check specific pieces for PLL, it will fail
    expect(StateMatcher.matchesMask(state, PLLMask)).toBe(false);
  });
});
