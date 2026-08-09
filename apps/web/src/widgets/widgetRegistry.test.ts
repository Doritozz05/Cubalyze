// Regression guard for the lazy widget registry.
//
// WHY: the widgets were converted from eager imports to registerLazy()
// dynamic imports. This test locks in the contract that every built-in
// widget resolves — via WidgetRegistry.ensure() — to a registration whose
// component/preview/mapProps are all real functions (a non-function preview
// used to crash the explorer with "Element type is invalid ... got: <div />").
import { describe, it, expect } from "vitest";
import { registerAllWidgets } from "@/widgets/registerAllWidgets";
import { WidgetRegistry } from "@/widgets/WidgetRegistry";
import { BUILT_IN_WIDGETS, getWidget } from "@/widgets/registry";

describe("lazy widget registry integrity", () => {
  it(
    "every built-in widget resolves component/preview/mapProps as functions",
    // Cold first-time module transforms under vitest/node are slow (~5s+);
    // bump the default 5s timeout.
    { timeout: 60_000 },
    async () => {
      registerAllWidgets();
      const registrations = await Promise.all(
        BUILT_IN_WIDGETS.map((def) => WidgetRegistry.ensure(def.id)),
      );
    for (const [i, def] of BUILT_IN_WIDGETS.entries()) {
      const reg = registrations[i];
      expect(reg, `"${def.id}" should resolve via ensure()`).toBeDefined();
      expect(typeof reg?.component, `"${def.id}".component`).toBe("function");
      expect(typeof reg?.preview, `"${def.id}".preview`).toBe("function");
      expect(typeof reg?.mapProps, `"${def.id}".mapProps`).toBe("function");
    }
  });

  it("WidgetRegistry.get() returns the resolved registration after ensure()", async () => {
    registerAllWidgets();
    // Before ensure: lazy widgets are NOT synchronously available.
    for (const def of BUILT_IN_WIDGETS) {
      expect(WidgetRegistry.get(def.id), `"${def.id}" pre-ensure`).toBeUndefined();
    }
    await Promise.all(BUILT_IN_WIDGETS.map((def) => WidgetRegistry.ensure(def.id)));
    for (const def of BUILT_IN_WIDGETS) {
      const reg = WidgetRegistry.get(def.id);
      expect(reg, `"${def.id}" post-ensure`).toBeDefined();
      expect(typeof reg?.preview).toBe("function");
    }
  });

  it("ensure() never rejects and resolves undefined for unknown ids", async () => {
    registerAllWidgets();
    await expect(WidgetRegistry.ensure("__unknown-widget__")).resolves.toBeUndefined();
  });

  it("every widget id in BUILT_IN_WIDGETS maps to a definition (id parity)", () => {
    for (const def of BUILT_IN_WIDGETS) {
      expect(getWidget(def.id), `getWidget("${def.id}")`).toBeDefined();
    }
  });

  it("cube-button is the ONLY default-active widget on first-ever load", () => {
    const defaultActive = BUILT_IN_WIDGETS.filter((w) => w.defaultActive);
    expect(defaultActive.map((w) => w.id)).toEqual(["cube-button"]);
  });
});

describe("lazy widget registry external-store mechanism", () => {
  it("subscribers are notified when a lazy registration resolves", async () => {
    registerAllWidgets();
    const id = BUILT_IN_WIDGETS[0].id;

    let calls = 0;
    const unsubscribe = WidgetRegistry.subscribe(() => {
      calls += 1;
    });

    await WidgetRegistry.ensure(id);

    expect(calls).toBeGreaterThanOrEqual(1);
    // Subscribers see the resolved registration via get() at notify time.
    expect(WidgetRegistry.get(id)).toBeDefined();
    unsubscribe();
  });

  it("unsubscribed listeners are not notified", async () => {
    registerAllWidgets();

    let calls = 0;
    const unsubscribe = WidgetRegistry.subscribe(() => {
      calls += 1;
    });
    unsubscribe();

    // Resolve a DIFFERENT widget so the notify must not reach the dead listener.
    await WidgetRegistry.ensure(BUILT_IN_WIDGETS[1].id);
    expect(calls).toBe(0);
  });

  it("ensure() retries after a transient loader failure (resolves undefined, then succeeds)", async () => {
    let attempts = 0;
    WidgetRegistry.registerLazy("__retry-test__", () => {
      attempts += 1;
      if (attempts === 1) return Promise.reject(new Error("transient boom"));
      return Promise.resolve({
        component: () => null,
        preview: () => null,
        mapProps: () => ({}),
      });
    });

    // First attempt fails: resolves undefined (never rejects) and keeps entry.
    await expect(WidgetRegistry.ensure("__retry-test__")).resolves.toBeUndefined();
    expect(WidgetRegistry.get("__retry-test__")).toBeUndefined();

    // Second attempt retries the loader and succeeds.
    const reg = await WidgetRegistry.ensure("__retry-test__");
    expect(reg).toBeDefined();
    expect(attempts).toBe(2);
    expect(typeof reg?.preview).toBe("function");
  });
});
