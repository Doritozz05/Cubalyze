import { describe, it, expect } from "vitest";
import { exportSolvesToCSV, exportSolvesToCsTimer, exportSolvesToJSON, exportAllSolvesToJSON } from "../exportSolves";
import { parseImport, toSolveInput } from "../importSolves";
import type { Solve } from "@/types";

const REAL_CSTIMER_CSV = [
  "No.;Time;Comment;Scramble;Date;P.1",
  "1;1:13.52;;F U2 R2 F2 D2 L2 B2 L' F2 L' U2 R D2 B' U' R D L' B U';2025-01-16 08:49:47;1:13.52",
  "2;47.41;;D' B2 D2 U' F2 R2 U2 B2 L F R2 F' D R' U B2 U2 F;2025-01-16 08:55:52;47.41",
  "3;43.03;;L2 R2 D2 L2 B' L2 F' U2 F D2 B2 R2 L U' B2 L2 U' R2 F2 L;2025-01-16 11:23:34;43.03",
  "4;46.07+;;D F2 L' D2 L B' L U R2 D2 F2 B2 R2 B2 R' F2 L' F2 L U;2025-01-16 11:25:54;44.07",
  "5;57.03;;D' R2 U' L2 U F2 R2 U' B2 L2 D2 F L F' U' R B F2 R' F R2;2025-01-16 11:48:38;57.03",
  "6;0.61;;R L U B R2 D' B' U2 R2 L2 U L2 D2 B2 R2 B2 U L2 D2 R D';2026-07-21 19:47:49;0.61",
  "7;DNF(44.83);Hola;U2 F L2 B2 D' U2 B2 L2 U L2 R2 D R2 L' U F' L2 R U' L D';2026-07-31 13:06:30;44.83",
].join("\n");

describe("exportSolvesToCsTimer", () => {
  it("exports in csTimer official CSV format with No.;Time;Comment;Scramble;Date;P.1", () => {
    const mockSolves: Solve[] = [
      {
        id: "1",
        time: 73520,
        penalty: "none",
        scramble: "F U2 R2 F2 D2 L2 B2 L' F2 L' U2 R D2 B' U' R D L' B U'",
        timestamp: new Date(2025, 0, 16, 8, 49, 47).getTime(),
        source: "manual",
        puzzleType: "333",
      },
      {
        id: "2",
        time: 44070,
        penalty: "+2",
        scramble: "D F2 L' D2 L B' L U R2 D2 F2 B2 R2 B2 R' F2 L' F2 L U",
        timestamp: new Date(2025, 0, 16, 11, 25, 54).getTime(),
        source: "manual",
        puzzleType: "333",
      },
      {
        id: "3",
        time: 44830,
        penalty: "DNF",
        scramble: "U2 F L2 B2 D' U2 B2 L2 U L2 R2 D R2 L' U F' L2 R U' L D'",
        note: "Hola",
        timestamp: new Date(2026, 6, 31, 13, 6, 30).getTime(),
        source: "manual",
        puzzleType: "333",
      },
    ];

    const csv = exportSolvesToCsTimer(mockSolves);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("No.;Time;Comment;Scramble;Date;P.1");

    // Line 1: normal solve
    expect(lines[1]).toContain("1;1:13.52;;F U2 R2");
    expect(lines[1]).toContain(";1:13.52");

    // Line 2: +2 solve (44.07s + 2s = 46.07s+)
    expect(lines[2]).toContain("2;46.07+;;D F2 L'");
    expect(lines[2]).toContain(";44.07");

    // Line 3: DNF solve with note
    expect(lines[3]).toContain("3;DNF(44.83);Hola;U2 F L2");
    expect(lines[3]).toContain(";44.83");
  });

  it("produces a 100% exact round-trip match for real csTimer CSV export", () => {
    const importResult = parseImport(REAL_CSTIMER_CSV);
    expect(importResult.errors).toHaveLength(0);

    const solves: Solve[] = importResult.solves.map((s, idx) => ({
      id: String(idx + 1),
      ...toSolveInput(s),
    }));

    const exportedCsv = exportSolvesToCsTimer(solves);
    expect(exportedCsv).toBe(REAL_CSTIMER_CSV);
  });
});

describe("formula injection guard (OWASP CSV/XLSX)", () => {
  const dangerous: Solve[] = [
    {
      id: "inj1",
      time: 12345,
      penalty: "none",
      scramble: "=HYPERLINK(\"http://evil.example\",\"click\")",
      timestamp: 1737013787000,
      method: "+SUM(A1:A9)" as Solve["method"],
      note: "=cmd|'/C calc'!A0",
      source: "manual",
      puzzleType: "333",
    },
    {
      id: "inj2",
      time: 1000,
      penalty: "none",
      scramble: "@SUM(1+1)",
      timestamp: 1737013787000,
      method: "-2+3" as Solve["method"],
      note: "\t1+1",
      source: "manual",
      puzzleType: "333",
    },
  ];

  it("Cubalyze CSV neutralizes cells starting with = + - @ or tab", () => {
    const csv = exportSolvesToCSV(dangerous);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("'=cmd|");
    expect(csv).toContain("'+SUM");
    expect(csv).toContain("'@SUM");
    expect(csv).toContain("'-2+3");
    // Safe values are left untouched.
    expect(csv).not.toMatch(/"'[A-Za-z0-9 ]/);
  });

  it("csTimer CSV neutralizes comment and scramble cells", () => {
    const csv = exportSolvesToCsTimer(dangerous);
    expect(csv).toContain("'=cmd|'/C calc'!A0");
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("'@SUM");
  });

  it("JSON export keeps raw values untouched (machine-readable format)", () => {
    const json = exportSolvesToJSON(dangerous);
    expect(json).toContain("=cmd|'/C calc'!A0");
    expect(json).not.toContain("'=cmd|");
  });
});

describe("Cubalyze JSON full-fidelity round trip", () => {
  const sample: Solve[] = [
    {
      id: "a",
      time: 73520,
      penalty: "none",
      scramble: "F U2 R2 F2 D2 L2 B2 L' F2 L' U2 R D2 B' U' R D L' B U'",
      timestamp: 1737013787000,
      method: "CFOP",
      note: "nice",
      source: "manual",
      puzzleType: "333",
    },
    {
      id: "b",
      time: 44070,
      penalty: "+2",
      scramble: "R U R' U'",
      timestamp: 1737020000000,
      method: "Roux",
      source: "smart",
      puzzleType: "222",
    },
  ];

  it("single-session JSON export → import preserves per-solve puzzleType and all metadata", () => {
    const json = exportSolvesToJSON(sample, "Test session");
    // The WRITER stamps the current tag; the READER accepts older ones too.
    expect(JSON.parse(json).app).toBe("Cubalyze");

    const result = parseImport(json);
    expect(result.format).toBe("cubalyze-json");
    expect(result.errors).toHaveLength(0);
    expect(result.solves).toHaveLength(2);

    const s0 = result.solves[0]!;
    expect(s0.time).toBe(73520);
    expect(s0.penalty).toBe("none");
    expect(s0.scramble).toBe(sample[0]!.scramble);
    expect(s0.timestamp).toBe(1737013787000);
    expect(s0.method).toBe("CFOP");
    expect(s0.note).toBe("nice");
    expect(s0.puzzleType).toBe("333");

    // The 2x2 solve keeps 2x2x2 — NOT forced to a single category.
    expect(result.solves[1]!.puzzleType).toBe("222");
    expect(result.solves[1]!.note).toBeUndefined();
  });

  it("export-all JSON → import flattens sessions but preserves every solve's puzzleType", () => {
    const json = exportAllSolvesToJSON([
      { sessionName: "Session A", solves: sample },
      { sessionName: "Session B", solves: [sample[1]!] },
    ]);

    const data = JSON.parse(json);
    expect(data.app).toBe("Cubalyze");
    expect(data.sessionCount).toBe(2);
    expect(data.sessions[0].solveCount).toBe(2);
    expect(data.sessions[1].solveCount).toBe(1);

    const result = parseImport(json);
    expect(result.format).toBe("cubalyze-json");
    expect(result.errors).toHaveLength(0);
    expect(result.solves).toHaveLength(3);
    // Puzzle types survive the round trip per solve.
    const types = result.solves.map((s) => s.puzzleType);
    expect(types).toEqual(["333", "222", "222"]);
  });

  it("imports a JSON exported before the rename (app: 'CubeForge')", () => {
    // The exact file an older build wrote: same shape, old discriminator. It must
    // keep importing, because we cannot rewrite what is already on user disks.
    const legacy = JSON.stringify({
      app: "CubeForge",
      exportedAt: "2026-01-01T00:00:00.000Z",
      sessionName: "Old session",
      solveCount: 1,
      solves: [
        { timeMs: 10000, penalty: "none", scramble: "R U R' U'", timestamp: 1, puzzleType: "333" },
      ],
    });

    const result = parseImport(legacy);
    expect(result.format).toBe("cubalyze-json");
    expect(result.errors).toHaveLength(0);
    expect(result.solves).toHaveLength(1);
    expect(result.solves[0]!.time).toBe(10000);
  });

  it("toSolveInput keeps the exported puzzleType", () => {
    const result = parseImport(exportSolvesToJSON(sample));
    const input = result.solves.map((s) => toSolveInput(s));
    expect(input[0]!.puzzleType).toBe("333");
    expect(input[1]!.puzzleType).toBe("222");
  });

  it("JSON export/import round-trips moves, analysis and orientationTimeline", () => {
    const rich: Solve[] = [
      {
        id: "rich",
        time: 5123,
        penalty: "none",
        scramble: "R U R' U'",
        timestamp: 1737013787000,
        source: "smart",
        puzzleType: "333",
        moves: [{ face: "R", direction: 1, cubeTimestamp: 0, hostTimestamp: 0 }],
        analysis: { totalTimeMs: 5123 } as Solve["analysis"],
        orientationTimeline: [[0, 0]] as Solve["orientationTimeline"],
      },
    ];

    const result = parseImport(exportSolvesToJSON(rich, "Rich"));
    expect(result.errors).toHaveLength(0);
    const input = toSolveInput(result.solves[0]!);
    expect(input.moves).toEqual([{ face: "R", direction: 1, cubeTimestamp: 0, hostTimestamp: 0 }]);
    expect(input.analysis).toEqual({ totalTimeMs: 5123 });
    expect(input.orientationTimeline).toEqual([[0, 0]]);
  });

  it("imports pre-migration JSON exports by normalizing legacy puzzleTypes to WCA codes", () => {
    // A CubeForge JSON exported on an older build carried the pre-ADR-002
    // spellings. After migration 027 the DB only accepts WCA codes, so the
    // import path must normalize these instead of failing the write.
    const legacyJson = JSON.stringify({
      app: "CubeForge",
      exportedAt: "2026-01-01T00:00:00.000Z",
      sessionName: "Legacy",
      solveCount: 4,
      solves: [
        { timeMs: 10000, penalty: "none", scramble: "R U R' U'", timestamp: 1, puzzleType: "3x3x3" },
        { timeMs: 11000, penalty: "none", scramble: "R U F'", timestamp: 2, puzzleType: "2x2x2" },
        { timeMs: 12000, penalty: "none", scramble: "R U R' U'", timestamp: 3, puzzleType: "3x3" },
        { timeMs: 13000, penalty: "none", scramble: "R U F'", timestamp: 4, puzzleType: "2x2" },
      ],
    });

    const result = parseImport(legacyJson);
    expect(result.format).toBe("cubalyze-json");
    expect(result.errors).toHaveLength(0);

    const inputs = result.solves.map((s) => toSolveInput(s));
    expect(inputs.map((i) => i.puzzleType)).toEqual(["333", "222", "333", "222"]);
  });

  it("imports an export-all JSON with mixed legacy and WCA puzzleTypes", () => {
    const legacyJson = JSON.stringify({
      app: "CubeForge",
      exportedAt: "2026-01-01T00:00:00.000Z",
      sessionCount: 2,
      sessions: [
        {
          sessionName: "A",
          solveCount: 2,
          solves: [
            { timeMs: 10000, penalty: "none", scramble: "R U R' U'", timestamp: 1, puzzleType: "3x3x3" },
            { timeMs: 11000, penalty: "none", scramble: "R U F'", timestamp: 2, puzzleType: "222" },
          ],
        },
        {
          sessionName: "B",
          solveCount: 1,
          solves: [
            { timeMs: 12000, penalty: "none", scramble: "R U F'", timestamp: 3, puzzleType: "2x2x2" },
          ],
        },
      ],
    });

    const result = parseImport(legacyJson);
    expect(result.errors).toHaveLength(0);
    const inputs = result.solves.map((s) => toSolveInput(s));
    expect(inputs.map((i) => i.puzzleType)).toEqual(["333", "222", "222"]);
  });
});
