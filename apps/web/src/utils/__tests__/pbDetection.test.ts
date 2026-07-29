import { describe, it, expect } from "vitest";
import { detectPbMilestones } from "../pbDetection";
import type { MinimalSolve } from "../pbDetection";

describe("pbDetection", () => {
  it("should NOT detect single PB on first solve (sets baseline)", () => {
    const existing: MinimalSolve[] = [];
    const result = detectPbMilestones(existing, 10000, "none");
    expect(result.isSinglePB).toBe(false);
    expect(result.types).toEqual([]);
  });

  it("should detect single PB when new solve is faster than previous best", () => {
    const existing: MinimalSolve[] = [
      { time: 12000, penalty: "none" },
      { time: 15000, penalty: "none" },
    ];
    const result = detectPbMilestones(existing, 9500, "none");
    expect(result.isSinglePB).toBe(true);
    expect(result.singleTime).toBe(9500);
    expect(result.prevSingleTime).toBe(12000);
  });

  it("should NOT detect single PB when new solve is slower", () => {
    const existing: MinimalSolve[] = [{ time: 10000, penalty: "none" }];
    const result = detectPbMilestones(existing, 12000, "none");
    expect(result.isSinglePB).toBe(false);
  });

  it("should NOT detect PB on DNF solve", () => {
    const existing: MinimalSolve[] = [{ time: 10000, penalty: "none" }];
    const result = detectPbMilestones(existing, 8000, "DNF");
    expect(result.isSinglePB).toBe(false);
    expect(result.types).toEqual([]);
  });

  it("should detect Ao5 PB when 5th solve is completed and forms a valid average", () => {
    // 4 existing solves: newest first
    const existing: MinimalSolve[] = [
      { time: 10000, penalty: "none" },
      { time: 11000, penalty: "none" },
      { time: 10500, penalty: "none" },
      { time: 12000, penalty: "none" },
    ];
    // 5th solve completes the Ao5 window
    const result = detectPbMilestones(existing, 9000, "none");
    expect(result.isAo5PB).toBe(true);
    expect(result.ao5Time).toBeGreaterThan(0);
  });

  it("should detect Ao5 PB when rolling average beats prior best Ao5", () => {
    const fasterExisting: MinimalSolve[] = [
      { time: 7000, penalty: "none" },
      { time: 10000, penalty: "none" },
      { time: 10000, penalty: "none" },
      { time: 10000, penalty: "none" },
      { time: 10000, penalty: "none" },
    ];
    const res = detectPbMilestones(fasterExisting, 7000, "none");
    expect(res.isAo5PB).toBe(true);
  });

  it("should isolate PB detection by puzzleType when puzzleType is specified", () => {
    const existing: MinimalSolve[] = [
      { time: 1000, penalty: "none", puzzleType: "2x2x2" },
      { time: 10000, penalty: "none", puzzleType: "3x3x3" },
    ];
    // New 3x3 solve of 8000ms is faster than 10000ms (3x3), even though 1000ms (2x2) is in session
    const result = detectPbMilestones(existing, 8000, "none", "3x3x3");
    expect(result.isSinglePB).toBe(true);
    expect(result.prevSingleTime).toBe(10000);
  });
});
