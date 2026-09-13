import { describe, it, expect } from "vitest";
import { yearWhenNeeded } from "../formatTime";

/**
 * Solve dates are rendered without a year on purpose — but only inside the
 * current one. Imports (csTimer, Twisty Timer) carry solves from previous
 * years, and the app stores their real timestamp, so the year has to come back
 * as soon as the solve is not from this year: otherwise a January 2025 solve
 * renders exactly like today's.
 */
describe("yearWhenNeeded", () => {
  // Fixed "now" so the assertions do not depend on the day the suite runs.
  const now = new Date(2026, 8, 13, 12, 0, 0);

  it("hides the year for a solve from the current year", () => {
    expect(yearWhenNeeded(new Date(2026, 0, 5, 10, 0, 0).getTime(), now)).toEqual({});
  });

  it("shows the year for a solve from a previous year", () => {
    expect(yearWhenNeeded(new Date(2025, 0, 8, 19, 50, 6).getTime(), now)).toEqual({
      year: "numeric",
    });
  });

  it("shows the year in the formatted date, so an import cannot pass as today", () => {
    // The exact first row of pruebas/Solves_333_Normal_2026-07-31_14-49.txt.
    const ts = Date.parse("2025-01-08T19:50:06.520+01:00");
    const outside = new Date(ts).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      ...yearWhenNeeded(ts, now),
    });
    expect(outside).toContain("2025");

    const current = new Date(2026, 5, 3).getTime();
    const inside = new Date(current).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      ...yearWhenNeeded(current, now),
    });
    expect(inside).not.toContain("2026");
  });

  it("ignores an unparseable timestamp instead of throwing", () => {
    expect(yearWhenNeeded(Number.NaN, now)).toEqual({});
  });

  it("falls back to the real current year", () => {
    expect(yearWhenNeeded(Date.now())).toEqual({});
  });
});
