import { describe, it, expect, beforeEach } from "vitest";
import {
  isPerfDebugEnabled,
  __setPerfDebugForTests,
  perfTick,
  perfRender,
  perfMove,
  perfGyro,
  perfOrientationWrite,
  resetPerfDiag,
  dumpPerfDiag,
} from "@/utils/perfDiag";

describe("perfDiag", () => {
  beforeEach(() => {
    __setPerfDebugForTests(null);
    resetPerfDiag();
  });

  it("stays disabled without the flag and all calls are safe no-ops", () => {
    expect(isPerfDebugEnabled()).toBe(false);
    expect(() => {
      perfTick();
      perfRender("App");
      perfMove();
      perfGyro();
      perfOrientationWrite();
      dumpPerfDiag("test");
      resetPerfDiag();
    }).not.toThrow();
  });

  it("records and dumps without throwing when enabled", () => {
    __setPerfDebugForTests(true);
    expect(isPerfDebugEnabled()).toBe(true);
    expect(() => {
      perfTick();
      perfTick();
      perfRender("App");
      perfMove();
      perfGyro();
      perfOrientationWrite();
      dumpPerfDiag("test");
      resetPerfDiag();
      dumpPerfDiag("empty-after-reset");
    }).not.toThrow();
  });
});
