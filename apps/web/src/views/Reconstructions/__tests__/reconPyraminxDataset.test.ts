/**
 * Real-dataset quality gate for the Pyraminx reconstruction replay.
 *
 * Reads the shipped recon chunks (public/recon-data) and pins the contract
 * the pyraminx replay depends on:
 *   • every pyraminx record's SCRAMBLE is valid WCA notation — the replay
 *     engine applies it via applyInitialScramble (a rejected scramble would
 *     silently start the replay from solved)
 *   • the replay converter keeps every clean single-step token and drops the
 *     messy reconstruction artifacts (rotations y/z, v-suffixes, parens,
 *     dots, doubles, compounds) — the same "garbage can't animate" rule the
 *     cube path uses, so the replay NEVER crashes on a record.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { isValidPyraminxScramble } from "@cubalyze/solver-engine/pyraminx";
import { pyraminxNotationToReplayMoves } from "../reconData";

// Tests run from the repo root; the data lives under apps/web/public.
const DATA_DIR = existsSync(join(process.cwd(), "apps", "web", "public", "recon-data"))
  ? join(process.cwd(), "apps", "web", "public", "recon-data")
  : join(process.cwd(), "public", "recon-data");

function loadPyraminxRecords(): Record<string, unknown>[] {
  if (!existsSync(join(DATA_DIR, "index.json"))) return [];
  const files = readdirSync(join(DATA_DIR, "data")).filter((f) =>
    f.startsWith("chunk-"),
  );
  const records: Record<string, unknown>[] = [];
  for (const file of files) {
    const chunk = JSON.parse(readFileSync(join(DATA_DIR, "data", file), "utf8"));
    const arr = Array.isArray(chunk) ? chunk : Object.values(chunk).flat();
    for (const r of arr) {
      if (r && (r as { puzzle?: string }).puzzle === "pyraminx") records.push(r);
    }
  }
  return records;
}

describe("Pyraminx reconstruction dataset (real records)", () => {
  const records = loadPyraminxRecords();

  it("the dataset ships pyraminx records", () => {
    expect(records.length).toBeGreaterThan(0);
  });

  it("every scramble is valid WCA notation (the replay applies it)", () => {
    for (const rec of records) {
      const scramble = (rec as { scramble?: string }).scramble ?? "";
      expect(
        isValidPyraminxScramble(scramble),
        `scramble of ${(rec as { key?: string }).key}: "${scramble}"`,
      ).toBe(true);
    }
  });

  it("every replay token is a clean single-step WCA move (garbage dropped)", () => {
    for (const rec of records) {
      const phases = (rec as { phases?: { moves?: string }[] }).phases ?? [];
      const allMoves = phases.map((p) => p.moves ?? "").join(" ");
      const events = pyraminxNotationToReplayMoves(allMoves);
      for (const e of events) {
        expect(
          /^[ULRBulrb]'?$/.test(e.displayNotation ?? ""),
          `token "${e.displayNotation}" of ${(rec as { key?: string }).key}`,
        ).toBe(true);
      }
    }
  });

  it("the combined moves replay without errors (converter never throws)", () => {
    for (const rec of records) {
      const phases = (rec as { phases?: { moves?: string }[] }).phases ?? [];
      const allMoves = phases.map((p) => p.moves ?? "").join(" ");
      expect(() => pyraminxNotationToReplayMoves(allMoves)).not.toThrow();
    }
  });
});
