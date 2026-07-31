import { describe, it, expect } from "vitest";
import { detectFormat, parseImport, previewImport, toSolveInput } from "../importSolves";

// Real csTimer export (newer versions): unquoted semicolon CSV with a header row,
// WCA-format times and human-readable dates.
const CSTIMER_HEADER_CSV = [
  "No.;Time;Comment;Scramble;Date;P.1",
  "1;1:13.52;;F U2 R2 F2 D2 L2 B2 L' F2 L' U2 R D2 B' U' R D L' B U';2025-01-16 08:49:47;1:13.52",
  "2;47.41;;D' B2 D2 U' F2 R2 U2 B2 L F R2 F' D R' U B2 U2 F;2025-01-16 08:55:52;47.41",
  "3;43.03;;L2 R2 D2 L2 B' L2 F' U2 F D2 B2 R2 L U' B2 L2 U' R2 F2 L;2025-01-16 11:23:34;43.03",
  "4;44.07;;D F2 L' D2 L B' L U R2 D2 F2 B2 R2 B2 R' F2 L' F2 L U;2025-01-16 11:25:54;44.07",
  "5;57.03;;D' R2 U' L2 U F2 R2 U' B2 L2 D2 F L F' U' R B F2 R' F R2;2025-01-16 11:48:38;57.03",
  "6;0.61;;R L U B R2 D' B' U2 R2 L2 U L2 D2 B2 R2 B2 U L2 D2 R D';2026-07-21 19:47:49;0.61",
  "7;44.83;;U2 F L2 B2 D' U2 B2 L2 U L2 R2 D R2 L' U F' L2 R U' L D';2026-07-31 13:06:30;44.83",
].join("\n");

describe("detectFormat — csTimer header CSV", () => {
  it("detects the unquoted header-based csTimer export", () => {
    expect(detectFormat(CSTIMER_HEADER_CSV)).toBe("cstimer");
  });

  it("still detects the classic quoted csTimer CSV", () => {
    expect(detectFormat('"333";"Normal";"122170";"1620000000000";"R U R\' U\'";"0";""')).toBe("cstimer");
  });

  it("still detects CubeForge CSV", () => {
    expect(detectFormat("No.,Time,Penalty,Scramble,Date,Method,Note\n1,12.34,,R U R',2025-01-01,,,")).toBe("cubeforge-csv");
  });
});

describe("parseImport — csTimer header CSV", () => {
  it("parses WCA-format times into milliseconds", () => {
    const result = parseImport(CSTIMER_HEADER_CSV);
    expect(result.format).toBe("cstimer");
    expect(result.errors).toHaveLength(0);
    expect(result.solves).toHaveLength(7);
    expect(result.solves.map((s) => s.time)).toEqual([
      73520, 47410, 43030, 44070, 57030, 610, 44830,
    ]);
  });

  it("parses human-readable dates", () => {
    const result = parseImport(CSTIMER_HEADER_CSV);
    expect(result.solves[0]!.timestamp).toBe(new Date(2025, 0, 16, 8, 49, 47).getTime());
    expect(result.solves[5]!.timestamp).toBe(new Date(2026, 6, 21, 19, 47, 49).getTime());
  });

  it("keeps scrambles and empty notes", () => {
    const result = parseImport(CSTIMER_HEADER_CSV);
    expect(result.solves[0]!.scramble).toBe("F U2 R2 F2 D2 L2 B2 L' F2 L' U2 R D2 B' U' R D L' B U'");
    expect(result.solves[0]!.note).toBeUndefined();
  });

  it("skips the header row", () => {
    const result = parseImport(CSTIMER_HEADER_CSV);
    expect(result.solves).toHaveLength(7);
    expect(result.solves[0]!.scramble).not.toContain("Time;");
  });

  it("previews without error", () => {
    const preview = previewImport(CSTIMER_HEADER_CSV);
    expect(preview.format).toBe("cstimer");
    expect(preview.rowCount).toBe(7);
    expect(preview.samples.length).toBeGreaterThan(0);
  });
});

describe("2x2 vs 3x3 detection", () => {
  it("infers 3x3x3 from scrambles using L/D/B faces", () => {
    const result = parseImport(CSTIMER_HEADER_CSV);
    expect(result.solves.every((s) => s.puzzleType === "3x3x3")).toBe(true);
  });

  it("infers 2x2x2 from scrambles using only R/U/F faces (WCA 2x2 style)", () => {
    const csv = [
      "No.;Time;Comment;Scramble;Date;P.1",
      "1;3.21;;R U' R' U' F2 R U' R2 F';2025-01-16 08:49:47;3.21",
    ].join("\n");
    const result = parseImport(csv);
    expect(result.solves[0]!.puzzleType).toBe("2x2x2");
  });

  it("maps explicit puzzle codes from classic quoted csTimer CSV", () => {
    const csv = [
      '"222";"Normal";"3210";"1737013787000";"R U\' R\' U\' F2 R U\' R2 F\'";"0";""',
      '"333";"Normal";"73521";"1737013787000";"R U R\' U\'";"0";""',
    ].join("\n");
    const result = parseImport(csv);
    expect(result.solves[0]!.puzzleType).toBe("2x2x2");
    expect(result.solves[1]!.puzzleType).toBe("3x3x3");
  });

  it("propagates puzzleType through toSolveInput", () => {
    const result = parseImport(CSTIMER_HEADER_CSV);
    const input = toSolveInput(result.solves[0]!);
    expect(input.puzzleType).toBe("3x3x3");
  });
});
