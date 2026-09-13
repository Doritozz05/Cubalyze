import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TFunction } from "i18next";
import type { Solve } from "@/types";
import {
  actionsForSurface,
  buildSolveActionGroups,
  canReanalyzeSolve,
  type SolveActionItem,
  type SolveActionInput,
} from "../solveActions";

/**
 * The point of `solveActions` is equivalence: the detail panel's overflow menu,
 * its touch sheet and a solve row's right-click menu are three renderings of ONE
 * declaration. These tests hold that line — a surface that quietly stops
 * offering re-analyze (which is exactly what the row menu used to do) fails
 * here instead of in someone's hand.
 *
 * The translator returns the key, so the assertions read as the keys the UI
 * resolves, with no locale fixtures to keep in sync.
 */
const t = ((key: string) => key) as unknown as TFunction<"insights">;

function makeSolve(overrides: Partial<Solve> = {}): Solve {
  return {
    id: "s1",
    timestamp: 1_700_000_000_000,
    time: 12_345,
    penalty: "none",
    scramble: "R U R' U'",
    method: "CFOP",
    source: "smart",
    puzzleType: "333",
    moves: ["R", "U", "R'", "U'"],
    ...overrides,
  } as Solve;
}

// One shared set of spies: cleared before every test, so a call made by an
// earlier case can never make a later one pass (or fail) by accident.
const fullHandlers = {
  onRetryScramble: vi.fn(),
  onReanalyze: vi.fn(),
  onMoveSolve: vi.fn(),
  onAssignSolve: vi.fn(),
  onDeleteSolve: vi.fn(),
  onMoveSelected: vi.fn(),
  onAssignSelected: vi.fn(),
  onDeleteSelected: vi.fn(),
  onToggleDetailMode: vi.fn(),
};

function build(overrides: Partial<SolveActionInput> = {}) {
  return buildSolveActionGroups({
    t,
    solve: makeSolve(),
    handlers: fullHandlers,
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

const ids = (groups: SolveActionItem[][]) => groups.flat().map((item) => item.id);
const labels = (groups: SolveActionItem[][]) =>
  Object.fromEntries(groups.flat().map((item) => [item.id, item.label]));

describe("buildSolveActionGroups", () => {
  it("offers the row menu the same actions as the touch sheet", () => {
    const groups = build();
    const sheet = actionsForSurface(groups, "sheet");
    const context = actionsForSurface(groups, "context");
    expect(ids(context)).toEqual(ids(sheet));
    expect(ids(context)).toEqual([
      "retry-scramble",
      "reanalyze",
      "move",
      "assign",
      "delete",
    ]);
  });

  it("labels an action the same way wherever it is shown", () => {
    const groups = build();
    const sheet = labels(actionsForSurface(groups, "sheet"));
    const context = labels(actionsForSurface(groups, "context"));
    const menu = labels(actionsForSurface(groups, "menu"));
    // Everything but the two surface-specific entries is shared verbatim.
    for (const id of ["reanalyze", "move", "assign", "delete"] as const) {
      expect(sheet[id]).toBeDefined();
      expect(context[id]).toBe(sheet[id]);
      expect(menu[id]).toBe(sheet[id]);
    }
  });

  it("keeps the layout toggle out of the action surfaces", () => {
    // Reconstruction view is a preference of the detail panel, not something
    // you do to a solve — it stays in the desktop overflow only.
    const groups = build();
    expect(ids(actionsForSurface(groups, "menu"))).toEqual([
      "detail-mode",
      "reanalyze",
      "move",
      "assign",
      "delete",
    ]);
    expect(ids(actionsForSurface(groups, "context"))).not.toContain("detail-mode");
    expect(ids(actionsForSurface(groups, "sheet"))).not.toContain("detail-mode");
  });

  it("never leaves a group empty, so no divider separates nothing", () => {
    const groups = build();
    for (const surface of ["menu", "sheet", "context"] as const) {
      const filtered = actionsForSurface(groups, surface);
      expect(filtered.every((group) => group.length > 0)).toBe(true);
    }
    // The retry leads the sheet (there is nothing above it to divide from).
    expect(actionsForSurface(groups, "sheet")[0][0].id).toBe("retry-scramble");
  });

  it("marks a retry it cannot perform, and says why", () => {
    const groups = build({
      solve: makeSolve({ puzzleType: "444", scramble: "U U'" }),
    });
    const retry = actionsForSurface(groups, "context")[0][0];
    expect(retry.disabled).toBe(true);
    expect(retry.hint).toBe("analysis.retryUnavailable");

    const ok = actionsForSurface(build(), "context")[0][0];
    expect(ok.disabled).toBe(false);
    expect(ok.hint).toBeUndefined();
  });

  it("hides re-analyze where it would produce nothing", () => {
    expect(ids(build({ solve: makeSolve({ moves: [] }) }))).not.toContain("reanalyze");
    expect(ids(build({ solve: makeSolve({ puzzleType: "222" }) }))).not.toContain("reanalyze");
    // A live job must not be re-run over either.
    expect(ids(build({ liveSolveId: "s1" }))).not.toContain("reanalyze");
    expect(ids(build({ liveSolveId: "other" }))).toContain("reanalyze");
  });

  it("drops the per-solve actions on a multi-selection", () => {
    const groups = build({ multi: true });
    expect(ids(groups)).not.toContain("retry-scramble");
    expect(ids(groups)).not.toContain("reanalyze");
    // Which is exactly the row menu's set: the selection-wide management three.
    expect(ids(actionsForSurface(groups, "context"))).toEqual([
      "move",
      "assign",
      "delete",
    ]);
  });

  it("aims move / assign / delete at the selection when multi", () => {
    const groups = build({ multi: true });
    const byId = new Map(groups.flat().map((item) => [item.id, item]));
    byId.get("move")!.onSelect();
    byId.get("delete")!.onSelect();
    expect(fullHandlers.onMoveSelected).toHaveBeenCalledTimes(1);
    expect(fullHandlers.onDeleteSelected).toHaveBeenCalledTimes(1);
    expect(fullHandlers.onMoveSolve).not.toHaveBeenCalled();
    expect(fullHandlers.onDeleteSolve).not.toHaveBeenCalled();
  });

  it("aims them at the row's solve when single, with the batch wording off", () => {
    const groups = build({
      labelOverrides: undefined,
      handlers: { ...fullHandlers, onMoveSelected: vi.fn() },
    });
    const move = groups.flat().find((item) => item.id === "move")!;
    move.onSelect();
    expect(fullHandlers.onMoveSolve).toHaveBeenCalledWith("s1");
    expect(fullHandlers.onMoveSelected).not.toHaveBeenCalled();
  });

  it("lets the selection wording replace the single-solve one", () => {
    const groups = build({
      multi: true,
      labelOverrides: { delete: "contextMenu:deleteSolves" },
    });
    const del = groups.flat().find((item) => item.id === "delete")!;
    expect(del.label).toBe("contextMenu:deleteSolves");
    expect(del.destructive).toBe(true);
  });

  it("only offers what the caller can actually do", () => {
    // A surface that cannot move, assign or delete simply does not get those
    // rows — no dead items that close the menu and do nothing.
    const groups = build({
      handlers: { onRetryScramble: fullHandlers.onRetryScramble },
    });
    expect(ids(groups)).toEqual(["retry-scramble"]);
  });
});

describe("canReanalyzeSolve", () => {
  it("requires stored moves and the 3×3 pipeline", () => {
    expect(canReanalyzeSolve(makeSolve())).toBe(true);
    expect(canReanalyzeSolve(makeSolve({ moves: [] }))).toBe(false);
    expect(canReanalyzeSolve(makeSolve({ puzzleType: "222" }))).toBe(false);
    // No puzzleType means 3×3, the app's default.
    expect(canReanalyzeSolve(makeSolve({ puzzleType: undefined }))).toBe(true);
  });
});
