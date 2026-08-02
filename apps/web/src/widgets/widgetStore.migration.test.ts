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

  it("drops orphaned custom-widget instances and strips the stale customWidgets key (v6 cleanup)", () => {
    // Legacy persisted state from the removed URL-import feature: a custom
    // widget instance + its definition + its dock entry must all disappear.
    const persisted = {
      instances: {
        "times-log": {
          status: "docked",
          position: { x: 24, y: 48 },
        },
        "my-remote-widget": {
          status: "floating",
          position: { x: 5, y: 5 },
        },
      },
      customWidgets: [
        {
          id: "my-remote-widget",
          name: "Old Remote Widget",
          description: "",
          category: "visual",
          author: "",
          version: "1.0.0",
          source: "custom",
          defaultActive: false,
          defaultPosition: { x: 5, y: 5 },
          defaultMinimized: false,
          tags: [],
        },
      ],
      dockOrder: ["my-remote-widget", "times-log"],
      customLayouts: [],
    };

    const migrated = migratePersistedWidgetState(persisted, 5);
    const instances = migrated.instances as Record<string, unknown>;
    const dockOrder = migrated.dockOrder as string[];

    // Orphaned custom widget instance dropped from instances…
    expect(instances["my-remote-widget"]).toBeUndefined();
    // …and from the dock order…
    expect(dockOrder).not.toContain("my-remote-widget");
    expect(dockOrder).toContain("times-log");
    // …while the stale key never leaks into migrated state.
    expect(migrated.customWidgets).toBeUndefined();
  });
});
