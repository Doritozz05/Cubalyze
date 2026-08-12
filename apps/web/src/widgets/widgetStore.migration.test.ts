import { describe, expect, it } from "vitest";
import { BUILT_IN_WIDGETS } from "./registry";
import {
  migratePersistedWidgetState,
  nextFreeDockAreaInstanceId,
} from "./widgetStore";

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
          // Historical persisted shape: `defaultMinimized` was removed from
          // WidgetDefinition — kept here only to simulate legacy data.
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

describe("nextFreeDockAreaInstanceId — repeatable area instance ids", () => {
  it("never reuses an id after a middle instance is removed", () => {
    // 3 spacers; remove the middle one, then add again.
    const order = ["widgets", "spacer-0", "spacer-1", "spacer-2", "clock"];
    order.splice(order.indexOf("spacer-1"), 1);
    const next = nextFreeDockAreaInstanceId(order, "spacer");
    expect(next).toBe("spacer-1");
    expect(order.includes(next)).toBe(false);
  });

  it("fills the lowest free index deterministically", () => {
    expect(nextFreeDockAreaInstanceId(["widgets"], "spacer")).toBe("spacer-0");
    expect(
      nextFreeDockAreaInstanceId(["widgets", "spacer-0", "spacer-2"], "spacer"),
    ).toBe("spacer-1");
    expect(
      nextFreeDockAreaInstanceId(
        ["widgets", "spacer-0", "spacer-1"],
        "spacer",
      ),
    ).toBe("spacer-2");
  });
});
