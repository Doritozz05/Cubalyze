import { describe, it, expect } from "vitest";
import { detectFormat, parseImport, previewImport, toSolveInput, type ImportedSolve } from "../importSolves";

// Real Twisty Timer export: 3 quoted semicolon-delimited fields per row,
// "time";"scramble";"date" with WCA-format times and ISO dates with timezone.
// No header row, no puzzle column.
const TWISTY_TIMER_CSV = [
  '"54.03";"R\' D2 R B2 F2 R\' B2 F2 R\' U2 R2 B R2 D\' F D\' U\' L2 B2 U";"2025-01-08T19:50:06.520+01:00"',
  '"1:06.74";"F L2 F U L B\' U L F L\' U2 L2 F2 R2 D\' R2 U\' D2 L2 U\' R2";"2025-01-16T18:37:48.266+01:00"',
  '"53.89";"F2 L2 F2 U B R2 U2 F\' D F U\' L D2 R\' B2 L D2 F2 R2";"2025-01-16T18:41:02.045+01:00"',
  '"52.15";"U2 L2 B D2 U2 B\' U2 R2 F2 L\' U2 B\' F2 R\' F2 L\' B\' U\' F\'";"2025-01-16T18:55:46.275+01:00"',
  '"50.86";"L2 B2 D\' L2 U2 L2 B2 D2 F2 U\' B U2 F\' U\' L2 D2 R U\' B\'";"2025-01-16T19:03:40.897+01:00"',
  '"1:12.56";"F2 L U2 R F2 L\' D2 F2 L2 R\' F R2 U2 B2 L\' F2 D B2 R\'";"2025-01-16T19:14:47.905+01:00"',
].join("\n");

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

// Classic quoted csTimer rows — the 7-field format with the puzzle code in
// the first field. Used to pin the phase-D1 fix: csTimer's "333oh" must stay
// "333oh" (identity, ADR-002), never collapse into "333".
const CSTIMER_QUOTED_OH_CSV = [
  '"333oh";"Normal";"122170";"1620000000000";"R U R\' U\'";"0";""',
  '"333";"Normal";"123456";"1620000001000";"R U R\' U\' R\' F R F\'";"0";""',
  '"222";"Normal";"4567";"1620000002000";"R U R\' F";"0";""',
].join("\n");

describe("csTimer quoted CSV — puzzle type identity (D1)", () => {
  it("keeps 333oh distinct from 333 (never mixed)", () => {
    const result = parseImport(CSTIMER_QUOTED_OH_CSV);
    expect(result.format).toBe("cstimer");
    const types = result.solves.map((s) => s.puzzleType);
    expect(types).toContain("333oh");
    expect(types).toContain("333");
    expect(types).toContain("222");
    // The OH row must not be stamped as 333.
    const oh = result.solves.find((s) => s.puzzleType === "333oh");
    expect(oh).toBeDefined();
  });
});

describe("detectFormat — csTimer header CSV", () => {
  it("detects the unquoted header-based csTimer export", () => {
    expect(detectFormat(CSTIMER_HEADER_CSV)).toBe("cstimer");
  });

  it("still detects the classic quoted csTimer CSV", () => {
    expect(detectFormat('"333";"Normal";"122170";"1620000000000";"R U R\' U\'";"0";""')).toBe("cstimer");
  });

  it("still detects the Cubalyze CSV header", () => {
    expect(detectFormat("No.,Time,Penalty,Scramble,Date,Method,Note\n1,12.34,,R U R',2025-01-01,,,")).toBe("cubalyze-csv");
  });

  it("detects our JSON by its app tag, old spelling included", () => {
    // Dual read: the tag written today is `Cubalyze`, but a file exported before
    // the rename carries `CubeForge` and must still be recognised.
    expect(detectFormat(JSON.stringify({ app: "Cubalyze", solves: [] }))).toBe("cubalyze-json");
    expect(detectFormat(JSON.stringify({ app: "CubeForge", solves: [] }))).toBe("cubalyze-json");
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

describe("detectFormat — Twisty Timer", () => {
  it("detects the quoted 3-field Twisty Timer export", () => {
    expect(detectFormat(TWISTY_TIMER_CSV)).toBe("twistytimer");
  });

  it("detects a single Twisty Timer row", () => {
    expect(detectFormat(TWISTY_TIMER_CSV.split("\n")[0]!)).toBe("twistytimer");
  });

  it("still detects classic csTimer (7 fields) not as twistytimer", () => {
    expect(detectFormat('"333";"Normal";"122170";"1620000000000";"R U R\' U\'";"0";""')).toBe("cstimer");
  });
});

describe("parseImport — Twisty Timer", () => {
  it("parses WCA-format times into milliseconds", () => {
    const result = parseImport(TWISTY_TIMER_CSV);
    expect(result.format).toBe("twistytimer");
    expect(result.errors).toHaveLength(0);
    expect(result.solves).toHaveLength(6);
    expect(result.solves.map((s) => s.time)).toEqual([
      54030, 66740, 53890, 52150, 50860, 72560,
    ]);
  });

  it("parses ISO dates with timezone offsets", () => {
    const result = parseImport(TWISTY_TIMER_CSV);
    expect(result.solves[0]!.timestamp).toBe(Date.parse("2025-01-08T19:50:06.520+01:00"));
    expect(result.solves[1]!.timestamp).toBe(Date.parse("2025-01-16T18:37:48.266+01:00"));
  });

  it("keeps scrambles intact", () => {
    const result = parseImport(TWISTY_TIMER_CSV);
    expect(result.solves[0]!.scramble).toBe("R' D2 R B2 F2 R' B2 F2 R' U2 R2 B R2 D' F D' U' L2 B2 U");
  });

  it("handles DNF and +2 penalties inside the time field or as 4th field", () => {
    const csv = [
      '"DNF";"R U R\' U\'";"2025-01-08T19:50:06.520+01:00"',
      '"12.34+2";"F R U R\' U\' F\'";"2025-01-09T10:00:00.000+01:00"',
      '"1:05.00+2";"R U R\' U\'";"2025-01-10T10:00:00.000+01:00"',
      '"0.87";"B U2 L D2 B\' R2 L2 F2 D F L D2 R2 U2 L B2 R U2 L\'";"2026-07-31T14:48:38.212+02:00";"DNF"',
      '"1.04";"D2 R2 D B2 D\' B2 L2 B2 U\' B\' L U2 B\' R2 D L2 U B\' D";"2026-07-31T14:48:43.841+02:00";"Hola note"',
    ].join("\n");
    const result = parseImport(csv);
    expect(result.solves[0]!.penalty).toBe("DNF");
    expect(result.solves[1]!.penalty).toBe("+2");
    expect(result.solves[1]!.time).toBe(12340);
    expect(result.solves[2]!.penalty).toBe("+2");
    expect(result.solves[2]!.time).toBe(65000);
    expect(result.solves[3]!.penalty).toBe("DNF");
    expect(result.solves[3]!.time).toBe(870);
    expect(result.solves[4]!.penalty).toBe("none");
    expect(result.solves[4]!.time).toBe(1040);
    expect(result.solves[4]!.note).toBe("Hola note");
  });

  it("detects format when the first line is a 4-field DNF line", () => {
    const line = '"0.87";"B U2 L D2 B\' R2 L2 F2 D F L D2 R2 U2 L B2 R U2 L\'";"2026-07-31T14:48:38.212+02:00";"DNF"';
    expect(detectFormat(line)).toBe("twistytimer");
  });

  it("infers 3x3x3 for these 18-20 move all-face scrambles", () => {
    const result = parseImport(TWISTY_TIMER_CSV);
    expect(result.solves.every((s) => s.puzzleType === "333")).toBe(true);
  });

  it("previews with Twisty Timer headers", () => {
    const preview = previewImport(TWISTY_TIMER_CSV);
    expect(preview.format).toBe("twistytimer");
    expect(preview.rowCount).toBe(6);
    expect(preview.headers).toEqual(["Time", "Scramble", "Date"]);
  });

  it("propagates puzzleType through toSolveInput", () => {
    const result = parseImport(TWISTY_TIMER_CSV);
    const input = toSolveInput(result.solves[0]!);
    expect(input.puzzleType).toBe("333");
  });
});

// Real csTimer export with penalties: `DNF(44.83)` (DNF with raw time in parens),
// `+`/`+2` suffixes for +2 penalties, and non-empty Comment column.
const CSTIMER_PENALTY_CSV = [
  "No.;Time;Comment;Scramble;Date;P.1",
  "1;1:13.52;;F U2 R2 F2 D2 L2 B2 L' F2 L' U2 R D2 B' U' R D L' B U';2025-01-16 08:49:47;1:13.52",
  "2;46.07+;;D F2 L' D2 L B' L U R2 D2 F2 B2 R2 B2 R' F2 L' F2 L U;2025-01-16 11:25:54;46.07",
  "3;DNF(44.83);Hola;U2 F L2 B2 D' U2 B2 L2 U L2 R2 D R2 L' U F' L2 R U' L D';2026-07-31 13:06:30;44.83",
].join("\n");

describe("csTimer header CSV — penalties & comments", () => {
  it("detects the format", () => {
    expect(detectFormat(CSTIMER_PENALTY_CSV)).toBe("cstimer");
  });

  it("parses DNF(44.83) as DNF with the raw time preserved", () => {
    const result = parseImport(CSTIMER_PENALTY_CSV);
    expect(result.errors).toHaveLength(0);
    expect(result.solves[2]!.penalty).toBe("DNF");
    expect(result.solves[2]!.time).toBe(44830);
  });

  it("parses the + suffix as a +2 penalty and extracts raw time from P.1 column", () => {
    const result = parseImport(CSTIMER_PENALTY_CSV);
    expect(result.solves[1]!.penalty).toBe("+2");
    expect(result.solves[1]!.time).toBe(44070);
  });

  it("parses the +2 suffix as a +2 penalty", () => {
    const csv = [
      "No.;Time;Comment;Scramble;Date;P.1",
      "1;12.34+2;;R U R' U';2025-01-16 08:49:47;12.34",
    ].join("\n");
    const result = parseImport(csv);
    expect(result.solves[0]!.penalty).toBe("+2");
    expect(result.solves[0]!.time).toBe(12340);
  });

  it("keeps the Comment column as the solve note", () => {
    const result = parseImport(CSTIMER_PENALTY_CSV);
    expect(result.solves[2]!.note).toBe("Hola");
    expect(result.solves[0]!.note).toBeUndefined();
  });

  it("parses the full 7-row sample end-to-end", () => {
    const csv = [
      "No.;Time;Comment;Scramble;Date;P.1",
      "1;1:13.52;;F U2 R2 F2 D2 L2 B2 L' F2 L' U2 R D2 B' U' R D L' B U';2025-01-16 08:49:47;1:13.52",
      "2;47.41;;D' B2 D2 U' F2 R2 U2 B2 L F R2 F' D R' U B2 U2 F;2025-01-16 08:55:52;47.41",
      "3;43.03;;L2 R2 D2 L2 B' L2 F' U2 F D2 B2 R2 L U' B2 L2 U' R2 F2 L;2025-01-16 11:23:34;43.03",
      "4;44.07;;D F2 L' D2 L B' L U R2 D2 F2 B2 R2 B2 R' F2 L' F2 L U;2025-01-16 11:25:54;44.07",
      "5;57.03;;D' R2 U' L2 U F2 R2 U' B2 L2 D2 F L F' U' R B F2 R' F R2;2025-01-16 11:48:38;57.03",
      "6;0.61;;R L U B R2 D' B' U2 R2 L2 U L2 D2 B2 R2 B2 U L2 D2 R D';2026-07-21 19:47:49;0.61",
      "7;DNF(44.83);Hola;U2 F L2 B2 D' U2 B2 L2 U L2 R2 D R2 L' U F' L2 R U' L D';2026-07-31 13:06:30;44.83",
    ].join("\n");
    const result = parseImport(csv);
    expect(result.format).toBe("cstimer");
    expect(result.errors).toHaveLength(0);
    expect(result.solves).toHaveLength(7);
    expect(result.solves.map((s) => s.penalty)).toEqual([
      "none", "none", "none", "none", "none", "none", "DNF",
    ]);
    expect(result.solves[6]!.note).toBe("Hola");
    expect(result.solves[6]!.time).toBe(44830);
  });
});

describe("2x2 vs 3x3 detection", () => {
  it("infers 3x3x3 from scrambles using L/D/B faces", () => {
    const result = parseImport(CSTIMER_HEADER_CSV);
    expect(result.solves.every((s) => s.puzzleType === "333")).toBe(true);
  });

  it("infers 2x2x2 from scrambles using only R/U/F faces (WCA 2x2 style)", () => {
    const csv = [
      "No.;Time;Comment;Scramble;Date;P.1",
      "1;3.21;;R U' R' U' F2 R U' R2 F';2025-01-16 08:49:47;3.21",
    ].join("\n");
    const result = parseImport(csv);
    expect(result.solves[0]!.puzzleType).toBe("222");
  });

  it("maps explicit puzzle codes from classic quoted csTimer CSV", () => {
    const csv = [
      '"222";"Normal";"3210";"1737013787000";"R U\' R\' U\' F2 R U\' R2 F\'";"0";""',
      '"333";"Normal";"73521";"1737013787000";"R U R\' U\'";"0";""',
    ].join("\n");
    const result = parseImport(csv);
    expect(result.solves[0]!.puzzleType).toBe("222");
    expect(result.solves[1]!.puzzleType).toBe("333");
  });

  it("propagates puzzleType through toSolveInput", () => {
    const result = parseImport(CSTIMER_HEADER_CSV);
    const input = toSolveInput(result.solves[0]!);
    expect(input.puzzleType).toBe("333");
  });
});

describe("csTimer JSON format", () => {
  it("parses native csTimer JSON export with +2, DNF and comments", () => {
    const json = JSON.stringify({
      session1: [
        [[0, 73521], "F U2 R2 F2", "", 1737013787],
        [[2000, 44070], "D F2 L'", "", 1737023154],
        [[-1, 44830], "U2 F L2", "Hola", 1785495990],
      ],
      properties: {
        sessionData: JSON.stringify({
          "1": { name: 1, opt: { scrType: "333" } },
        }),
      },
    });

    expect(detectFormat(json)).toBe("cstimer-json");
    const result = parseImport(json);
    expect(result.format).toBe("cstimer-json");
    expect(result.solves).toHaveLength(3);
    expect(result.solves[0]!.time).toBe(73521);
    expect(result.solves[0]!.penalty).toBe("none");

    // +2 solve: raw time is preserved as 44070ms, penalty is "+2"
    expect(result.solves[1]!.time).toBe(44070);
    expect(result.solves[1]!.penalty).toBe("+2");

    // DNF solve: raw time is preserved as 44830ms, penalty is "DNF", comment is "Hola"
    expect(result.solves[2]!.time).toBe(44830);
    expect(result.solves[2]!.penalty).toBe("DNF");
    expect(result.solves[2]!.note).toBe("Hola");
    expect(result.solves[2]!.timestamp).toBe(1785495990000);
  });
});

describe("formula-marker round-trip (unescapeFormulaMarker)", () => {
  it("strips the export apostrophe marker from notes starting with formula chars", () => {
    const imported: ImportedSolve = {
      time: 12340,
      penalty: "none",
      scramble: "R U R' U'",
      timestamp: 1737013787000,
      note: "'=SUM(A1:A2)",
    };
    expect(toSolveInput(imported).note).toBe("=SUM(A1:A2)");
  });

  it("strips the marker for +, -, @, tab and CR as well", () => {
    for (const [raw, expected] of [
      ["'+2s", "+2s"],
      ["'-minus", "-minus"],
      ["'@evil", "@evil"],
      ["'\tTAB", "\tTAB"],
      ["'\rCR", "\rCR"],
    ] as const) {
      expect(toSolveInput({ time: 1, penalty: "none", scramble: "R", timestamp: 1, note: raw }).note).toBe(expected);
    }
  });

  it("leaves legitimate apostrophe-first notes untouched", () => {
    const imported: ImportedSolve = {
      time: 12340,
      penalty: "none",
      scramble: "R U R' U'",
      timestamp: 1737013787000,
      note: "'til later",
    };
    expect(toSolveInput(imported).note).toBe("'til later");
  });

  it("leaves plain notes and undefined notes untouched", () => {
    const plain: ImportedSolve = { time: 1, penalty: "none", scramble: "R", timestamp: 1, note: "Hola note" };
    expect(toSolveInput(plain).note).toBe("Hola note");
    expect(toSolveInput({ ...plain, note: undefined }).note).toBeUndefined();
  });
});

/**
 * Foreign exports (csTimer, Twisty Timer, older CubeForge backups) happily
 * carry a method on every row, including 2×2 and Pyraminx ones. The import
 * applies the same scope rule as the live writers, or the bug the app just
 * repaired would come back through the import door.
 */
describe("toSolveInput — method scope", () => {
  const base: ImportedSolve = {
    time: 12340,
    penalty: "none",
    scramble: "R U R' U'",
    timestamp: 1737013787000,
  };

  it("keeps the method on a 3×3 solve", () => {
    const input = toSolveInput({ ...base, puzzleType: "333", method: "Roux" });
    expect(input.method).toBe("Roux");
  });

  it("keeps the method on a 3×3 OH solve", () => {
    const input = toSolveInput({ ...base, puzzleType: "333oh", method: "CFOP" });
    expect(input.method).toBe("CFOP");
  });

  it("drops the method on an event that has none", () => {
    expect(toSolveInput({ ...base, puzzleType: "222", method: "CFOP" }).method).toBeUndefined();
    expect(toSolveInput({ ...base, puzzleType: "pyram", method: "CFOP" }).method).toBeUndefined();
  });

  it("leaves rows without a method alone", () => {
    const input = toSolveInput({ ...base, puzzleType: "333" });
    expect(input.method).toBeUndefined();
  });
});
