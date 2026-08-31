/**
 * Pyraminx virtual keymap tests.
 *
 * The 8 WCA pyraminx turns (layers U/L/R/B + tips u/l/r/b, each with its
 * prime) must all be reachable — the user must never be stuck without a key
 * for a move.
 */
import { describe, expect, it } from "vitest";
import { PYRAMINX_KEYMAP, pyraminxKeyToToken } from "./pyraminxKeybinds";

const ALL_TOKENS = [
  "U", "U'", "L", "L'", "R", "R'", "B", "B'",
  "u", "u'", "l", "l'", "r", "r'", "b", "b'",
];

describe("PYRAMINX_KEYMAP", () => {
  it("covers every one of the 8 moves in both directions (16 tokens)", () => {
    const tokens = Object.values(PYRAMINX_KEYMAP).map((a) => a.token);
    expect(tokens).toHaveLength(16);
    for (const token of ALL_TOKENS) {
      expect(tokens).toContain(token);
    }
    // No duplicates — each token has exactly one key.
    expect(new Set(tokens).size).toBe(16);
  });

  it("resolves event codes to tokens", () => {
    expect(pyraminxKeyToToken("KeyJ")).toBe("U");
    expect(pyraminxKeyToToken("KeyF")).toBe("U'");
    expect(pyraminxKeyToToken("KeyU")).toBe("u");
    expect(pyraminxKeyToToken("Comma")).toBe("b'");
    expect(pyraminxKeyToToken("KeyX")).toBeNull(); // not mapped
    expect(pyraminxKeyToToken("")).toBeNull();
  });

  it("layer turns are uppercase and tip turns lowercase", () => {
    for (const [code, action] of Object.entries(PYRAMINX_KEYMAP)) {
      const first = action.token[0];
      const isLayer = /[ULRB]/.test(first);
      const isTip = /[ulrb]/.test(first);
      expect(isLayer || isTip, `${code} → ${action.token}`).toBe(true);
    }
  });
});
