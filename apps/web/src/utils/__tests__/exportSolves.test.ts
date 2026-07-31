import { describe, it, expect } from "vitest";
import { exportSolvesToCsTimer } from "../exportSolves";
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
        puzzleType: "3x3x3",
      },
      {
        id: "2",
        time: 44070,
        penalty: "+2",
        scramble: "D F2 L' D2 L B' L U R2 D2 F2 B2 R2 B2 R' F2 L' F2 L U",
        timestamp: new Date(2025, 0, 16, 11, 25, 54).getTime(),
        source: "manual",
        puzzleType: "3x3x3",
      },
      {
        id: "3",
        time: 44830,
        penalty: "DNF",
        scramble: "U2 F L2 B2 D' U2 B2 L2 U L2 R2 D R2 L' U F' L2 R U' L D'",
        note: "Hola",
        timestamp: new Date(2026, 6, 31, 13, 6, 30).getTime(),
        source: "manual",
        puzzleType: "3x3x3",
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
