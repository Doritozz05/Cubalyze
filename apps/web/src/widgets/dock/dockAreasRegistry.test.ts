import { describe, expect, it } from "vitest";
import {
  DOCK_AREAS,
  DEFAULT_DOCK_AREA_ORDER,
  addAreasIntroducedAfter,
  areaBaseId,
  getDockArea,
} from "./dockAreasRegistry";
import {
  CURRENT_WIDGET_STORE_VERSION,
  migratePersistedWidgetState,
} from "../widgetStore";

describe("dock areas registry", () => {
  it("has a definition for every default area, with unique ids", () => {
    const ids = DOCK_AREAS.map((area) => area.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const areaId of DEFAULT_DOCK_AREA_ORDER) {
      expect(getDockArea(areaBaseId(areaId)), `missing ${areaId}`).toBeDefined();
    }
  });

  it("ships the cube piece in the default layout, right after the puzzle", () => {
    expect(DEFAULT_DOCK_AREA_ORDER).toContain("cube");
    expect(DEFAULT_DOCK_AREA_ORDER.indexOf("cube")).toBe(
      DEFAULT_DOCK_AREA_ORDER.indexOf("puzzle") + 1,
    );
  });
});

describe("addAreasIntroducedAfter — bringing late docks areas to old layouts", () => {
  const legacyV8 = ["widgets", "separator-0", "spacer-0", "session", "puzzle"];

  it("appends the cube piece for a layout that predates it, anchored after puzzle", () => {
    const next = addAreasIntroducedAfter(legacyV8, 8);
    expect(next).toEqual([...legacyV8, "cube"]);
  });

  it("is idempotent — a layout that already has the area is untouched", () => {
    const withCube = addAreasIntroducedAfter(legacyV8, 8);
    expect(addAreasIntroducedAfter(withCube, 8)).toEqual(withCube);
  });

  it("appends at the end when the anchor was removed", () => {
    const noPuzzle = ["widgets", "session"];
    expect(addAreasIntroducedAfter(noPuzzle, 0)).toEqual(["widgets", "session", "cube"]);
  });

  it("does nothing when the persisted layout is already current", () => {
    expect(addAreasIntroducedAfter(legacyV8, CURRENT_WIDGET_STORE_VERSION)).toEqual(legacyV8);
  });

  it("never mutates the input array", () => {
    const input = [...legacyV8];
    addAreasIntroducedAfter(input, 0);
    expect(input).toEqual(legacyV8);
  });
});

describe("migratePersistedWidgetState — the cube piece reaches existing users", () => {
  const persisted = {
    instances: {},
    dockOrder: [],
    dockAreaOrder: ["widgets", "session", "puzzle"],
    customLayouts: [],
  };

  it("adds the cube area exactly once, on the upgrade that introduced it", () => {
    const migrated = migratePersistedWidgetState(persisted, 8);
    expect(migrated.dockAreaOrder).toEqual(["widgets", "session", "puzzle", "cube"]);
  });

  it("respects a user who removed it afterwards (no resurrection on next load)", () => {
    // Once the store is current, the persisted order is taken as-is.
    const removed = { ...persisted, dockAreaOrder: ["widgets", "session", "puzzle"] };
    const migrated = migratePersistedWidgetState(removed, CURRENT_WIDGET_STORE_VERSION);
    expect(migrated.dockAreaOrder).toEqual(["widgets", "session", "puzzle"]);
  });

  it("still gives a brand-new layout the full default order", () => {
    const migrated = migratePersistedWidgetState({}, 8);
    expect(migrated.dockAreaOrder).toEqual(DEFAULT_DOCK_AREA_ORDER);
  });
});
