/**
 * Pyraminx recon pipeline regression — the FULL normalized path
 * (fetchReconRecord → normalizeReconMoves → reconToSolve) over the real
 * dataset.
 *
 * Pins the fix for the "starts solved" replay bug: the cube tokenizer used
 * to expand lowercase tips as cube wides (l → "L M", r' → "R' M") and the
 * cube conjugator re-cased them, so a valid scramble "… R l r" reached the
 * replay as "… R L M R M'" — which the Pyraminx engine rejects (M is not a
 * pyraminx move) → applyInitialScramble silently no-oped → the replay
 * started from SOLVED and got scrambled by the solve moves. This suite
 * proves the normalized output keeps every scramble and move token a clean
 * single-step WCA pyraminx token, verbatim.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fetchReconRecord, reconToSolve } from "../reconData";

const DATA_DIR = existsSync(join(process.cwd(), "apps", "web", "public", "recon-data"))
  ? join(process.cwd(), "apps", "web", "public", "recon-data")
  : join(process.cwd(), "public", "recon-data");

const TOKEN_RE = /^[ULRBulrb]'?$/;
// The corruption signature: M/E/S are CUBE slice tokens that never appear in
// pyraminx notation (the cube tokenizer emitted them from expanded tips).
const CORRUPTION_RE = /[MESmes]/;

beforeAll(() => {
  vi.stubGlobal("fetch", (url: string | URL) => {
    const path = String(url);
    const file = path.includes("index.json")
      ? "index.json"
      : /chunk-\d+\.json$/.exec(path)?.[0];
    if (!file) return Promise.reject(new Error(`unexpected fetch: ${path}`));
    const filePath = file === "index.json" ? join(DATA_DIR, file) : join(DATA_DIR, "data", file);
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(JSON.parse(readFileSync(filePath, "utf8"))),
    } as Response);
  });
});

function pyraminxKeys(): string[] {
  const index = JSON.parse(
    readFileSync(join(DATA_DIR, "index.json"), "utf8"),
  ) as { solves: { key: string; puzzle?: string }[] };
  return index.solves.filter((s) => s.puzzle === "pyraminx").map((s) => s.key);
}

describe("Pyraminx recon pipeline (normalized, real records)", () => {
  const keys = pyraminxKeys();

  it("the dataset ships pyraminx records", () => {
    expect(keys.length).toBeGreaterThan(0);
  });

  it("every normalized scramble is a clean WCA pyraminx scramble (no M/E/S corruption)", async () => {
    for (const key of keys) {
      const record = await fetchReconRecord(key);
      expect(record, key).not.toBeNull();
      const solve = reconToSolve(record!);
      const tokens = (solve.scramble ?? "").trim().split(/\s+/).filter(Boolean);
      expect(tokens.length, `scramble of ${key}`).toBeGreaterThan(0);
      for (const t of tokens) {
        expect(t, `scramble token "${t}" of ${key}`).toMatch(TOKEN_RE);
        expect(t, `scramble token "${t}" of ${key}`).not.toMatch(CORRUPTION_RE);
      }
    }
  });

  it("every normalized move is a verbatim WCA pyraminx token (tips stay lowercase, no M/E/S)", async () => {
    let sawTip = false;
    for (const key of keys) {
      const record = await fetchReconRecord(key);
      const solve = reconToSolve(record!);
      const tokens = (solve.moves ?? [])
        .map((m) => m.displayNotation)
        .filter((t): t is string => Boolean(t));
      for (const t of tokens) {
        expect(t, `move "${t}" of ${key}`).toMatch(TOKEN_RE);
        expect(t, `move "${t}" of ${key}`).not.toMatch(CORRUPTION_RE);
        if (/[ulrb]/.test(t)) sawTip = true;
      }
    }
    // The dataset really contains tip turns — the test would be vacuous if
    // every record were layer-only.
    expect(sawTip).toBe(true);
  });

  it("the cuberoot-2110 scramble is preserved VERBATIM (tips l r intact)", async () => {
    const record = await fetchReconRecord("cuberoot-2110");
    expect(record).not.toBeNull();
    const solve = reconToSolve(record!);
    expect(solve.scramble).toBe("R U B U' L' R L U R B' R l r");
    // The solve's written tokens replay VERBATIM: "Bv" (junk) dropped, the
    // written tips r' u' stay lowercase tip turns, the layer turns keep
    // their primes — exactly the reconstructor's notation, in order.
    const tokens = (solve.moves ?? [])
      .map((m) => m.displayNotation)
      .filter((t): t is string => Boolean(t));
    expect(tokens).toEqual([
      "r'",
      "u'",
      "U",
      "R",
      "L'",
      "R'",
      "U",
      "L",
      "U'",
      "L'",
      "U",
    ]);
    // No slice tokens (the old cube conjugation emitted them).
    expect(tokens.some((t) => CORRUPTION_RE.test(t))).toBe(false);
  });
});
