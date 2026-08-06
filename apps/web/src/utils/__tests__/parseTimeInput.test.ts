import { describe, it, expect } from "vitest";
import {
  formatManualEntry,
  formatManualPreview,
  parseTimeInput,
} from "../parseTimeInput";

describe("parseTimeInput — bare integers (csTimer intUN=20100, h:mm:ss.cs)", () => {
  it("treats '10' as 0.10s (centiseconds), like csTimer", () => {
    expect(parseTimeInput("10")).toEqual([{ timeMs: 100, penalty: "none" }]);
  });

  it("treats single digits as centiseconds too ('5' → 0.05s)", () => {
    expect(parseTimeInput("5")).toEqual([{ timeMs: 50, penalty: "none" }]);
  });

  it("reads 2-digit groups from the right (cs|ss|mm|hh)", () => {
    expect(parseTimeInput("100")).toEqual([{ timeMs: 1000, penalty: "none" }]); // 1.00
    expect(parseTimeInput("999")).toEqual([{ timeMs: 9990, penalty: "none" }]); // 9.99
    expect(parseTimeInput("1450")).toEqual([{ timeMs: 14500, penalty: "none" }]); // 14.50
    expect(parseTimeInput("10000")).toEqual([{ timeMs: 60000, penalty: "none" }]); // 1:00.00
    expect(parseTimeInput("14500")).toEqual([{ timeMs: 105000, penalty: "none" }]); // 1:45.00
    expect(parseTimeInput("23100")).toEqual([{ timeMs: 151000, penalty: "none" }]); // 2:31.00
    expect(parseTimeInput("1231000")).toEqual([{ timeMs: 4990000, penalty: "none" }]); // 1:23:10.00
  });

  it("rejects zero", () => {
    expect(parseTimeInput("0")).toBeNull();
  });
});

describe("parseTimeInput — decimal seconds, colons and number prefix", () => {
  it("parses decimal seconds", () => {
    expect(parseTimeInput("14.50")).toEqual([{ timeMs: 14500, penalty: "none" }]);
    expect(parseTimeInput("10.5")).toEqual([{ timeMs: 10500, penalty: "none" }]);
    expect(parseTimeInput("0.5")).toEqual([{ timeMs: 500, penalty: "none" }]);
  });

  it("parses m:ss.cs (and does not misread '1.23' as a number prefix)", () => {
    expect(parseTimeInput("1:23.45")).toEqual([{ timeMs: 83450, penalty: "none" }]);
    expect(parseTimeInput("1:02.03")).toEqual([{ timeMs: 62030, penalty: "none" }]);
    expect(parseTimeInput("1.23")).toEqual([{ timeMs: 1230, penalty: "none" }]);
  });

  it("parses h:mm:ss and h:mm:ss.cs", () => {
    expect(parseTimeInput("1:23:45.67")).toEqual([{ timeMs: 5025670, penalty: "none" }]);
    expect(parseTimeInput("1:02:03")).toEqual([{ timeMs: 3723000, penalty: "none" }]);
  });

  it("reads '12:34' as 12m34s (lazy groups, like csTimer)", () => {
    expect(parseTimeInput("12:34")).toEqual([{ timeMs: 754000, penalty: "none" }]);
  });

  it("accepts an optional solve-number prefix ('1. 12.34')", () => {
    expect(parseTimeInput("1. 12.34")).toEqual([{ timeMs: 12340, penalty: "none" }]);
  });
});

describe("parseTimeInput — penalties (DNF, +2)", () => {
  it("parses a bare DNF", () => {
    expect(parseTimeInput("DNF")).toEqual([{ timeMs: 0, penalty: "DNF" }]);
    expect(parseTimeInput("(DNF)")).toEqual([{ timeMs: 0, penalty: "DNF" }]);
    expect(parseTimeInput("dnf")).toEqual([{ timeMs: 0, penalty: "DNF" }]);
  });

  it("keeps the raw time inside DNF(...)", () => {
    expect(parseTimeInput("DNF(12.34)")).toEqual([{ timeMs: 12340, penalty: "DNF" }]);
    expect(parseTimeInput("DNF(1450)")).toEqual([{ timeMs: 14500, penalty: "DNF" }]);
  });

  it("applies +2 to the typed (effective) time and stores raw − 2000ms", () => {
    expect(parseTimeInput("15.50+")).toEqual([{ timeMs: 13500, penalty: "+2" }]);
    expect(parseTimeInput("15.50+2")).toEqual([{ timeMs: 13500, penalty: "+2" }]);
    expect(parseTimeInput("1450+")).toEqual([{ timeMs: 12500, penalty: "+2" }]);
  });

  it("does not apply +2 below 2000ms (csTimer guard)", () => {
    expect(parseTimeInput("1.5+")).toEqual([{ timeMs: 1500, penalty: "none" }]);
  });
});

describe("parseTimeInput — unit suffixes (CubeForge extension)", () => {
  it("parses single units", () => {
    expect(parseTimeInput("90s")).toEqual([{ timeMs: 90000, penalty: "none" }]);
    expect(parseTimeInput("1.5h")).toEqual([{ timeMs: 5400000, penalty: "none" }]);
    expect(parseTimeInput("10ms")).toEqual([{ timeMs: 10, penalty: "none" }]);
  });

  it("parses combined units", () => {
    expect(parseTimeInput("2m30s")).toEqual([{ timeMs: 150000, penalty: "none" }]);
    expect(parseTimeInput("1h30m")).toEqual([{ timeMs: 5400000, penalty: "none" }]);
  });
});

describe("parseTimeInput — multiple solves", () => {
  it("splits on commas and newlines", () => {
    expect(parseTimeInput("12.34, 11.05")).toEqual([
      { timeMs: 12340, penalty: "none" },
      { timeMs: 11050, penalty: "none" },
    ]);
    expect(parseTimeInput("12.34\n11.05")).toEqual([
      { timeMs: 12340, penalty: "none" },
      { timeMs: 11050, penalty: "none" },
    ]);
  });

  it("keeps per-entry penalties", () => {
    expect(parseTimeInput("12.34, DNF(20.00), 15.50+")).toEqual([
      { timeMs: 12340, penalty: "none" },
      { timeMs: 20000, penalty: "DNF" },
      { timeMs: 13500, penalty: "+2" },
    ]);
  });

  it("tolerates trailing separators", () => {
    expect(parseTimeInput("12.34,")).toEqual([{ timeMs: 12340, penalty: "none" }]);
  });

  it("is all-or-nothing: one bad entry invalidates the whole input", () => {
    expect(parseTimeInput("12.34, xyz")).toBeNull();
  });
});

describe("parseTimeInput — invalid input", () => {
  it("rejects empty/whitespace input", () => {
    expect(parseTimeInput("")).toBeNull();
    expect(parseTimeInput("   ")).toBeNull();
  });

  it("rejects garbage", () => {
    expect(parseTimeInput("abc")).toBeNull();
    expect(parseTimeInput("12.34abc")).toBeNull();
    expect(parseTimeInput("1:2:3:4")).toBeNull();
  });
});

describe("formatManualEntry / formatManualPreview", () => {
  it("formats plain, +2 and DNF entries", () => {
    expect(formatManualEntry({ timeMs: 14500, penalty: "none" })).toBe("14.50");
    expect(formatManualEntry({ timeMs: 13500, penalty: "+2" })).toBe("15.50+");
    expect(formatManualEntry({ timeMs: 0, penalty: "DNF" })).toBe("DNF");
    expect(formatManualEntry({ timeMs: 12340, penalty: "DNF" })).toBe("DNF(12.34)");
  });

  it("previews a single solve with '='", () => {
    expect(formatManualPreview([{ timeMs: 14500, penalty: "none" }])).toBe("= 14.50");
  });

  it("previews multiple solves with a count prefix", () => {
    expect(
      formatManualPreview([
        { timeMs: 12340, penalty: "none" },
        { timeMs: 11050, penalty: "none" },
      ]),
    ).toBe("×2 12.34 · 11.05");
  });

  it("returns null for empty input", () => {
    expect(formatManualPreview([])).toBeNull();
  });
});
