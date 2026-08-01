import { describe, expect, it } from "vitest";
import { BUILT_IN_WIDGETS } from "./registry";
import { migratePersistedWidgetState } from "./widgetStore";

describe("widget persistence migration", () => {
  it("injects new built-ins without reordering an existing v4 dock", () => {
    const persisted = {
      instances: {
        "times-log": {
          status: "docked",
          position: { x: 24, y: 48 },
        },
        "solve-timeline": {
          status: "floating",
          position: { x: 180, y: 220 },
        },
      },
      customWidgets: [],
      dockOrder: ["solve-timeline", "times-log"],
      customLayouts: [],
    };

    const migrated = migratePersistedWidgetState(persisted, 4);
    const instances = migrated.instances as Record<string, { position: { x: number; y: number } }>;
    const dockOrder = migrated.dockOrder as string[];

    expect(instances["phase-balance"]).toEqual({
      status: "inactive",
      position: { x: 420, y: 300 },
    });
    expect(dockOrder.slice(0, 2)).toEqual(["solve-timeline", "times-log"]);
    expect(dockOrder).toContain("phase-balance");
    expect(dockOrder.indexOf("phase-balance")).toBeGreaterThan(1);
    expect(dockOrder).toHaveLength(BUILT_IN_WIDGETS.length);
  });
});
