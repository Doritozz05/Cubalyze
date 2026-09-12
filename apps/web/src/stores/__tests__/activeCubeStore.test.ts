import { describe, expect, it, vi } from "vitest";
import {
  ACTIVE_CUBE_KEY_PREFIX,
  createActiveCubeStore,
  type ActiveCubeConnector,
  type ActiveCubeMeta,
} from "../activeCubeStore";

/** An in-memory `app_meta` stand-in — the connector is the seam under test. */
function memoryConnector(seed: Record<string, string> = {}) {
  const rows: Record<string, string> = { ...seed };
  const set = vi.fn(async (key: string, value: string) => {
    rows[key] = value;
  });
  const meta: ActiveCubeMeta = {
    getByPrefix: async (prefix) =>
      Object.fromEntries(
        Object.entries(rows)
          .filter(([key]) => key.startsWith(prefix))
          .map(([key, value]) => [key.slice(prefix.length), value]),
      ),
    set,
  };
  const connect: ActiveCubeConnector = async () => meta;
  return { connect, rows, set };
}

describe("activeCubeStore", () => {
  it("hydrates the choices stored for this device", async () => {
    const { connect } = memoryConnector({
      [`${ACTIVE_CUBE_KEY_PREFIX}333`]: "item_gan12",
      [`${ACTIVE_CUBE_KEY_PREFIX}222`]: "item_valk2",
      // Unrelated keys in app_meta must not leak into the map.
      active_session: "ses_1",
    });

    const store = createActiveCubeStore(connect);
    expect(store.getState().hydrated).toBe(false);
    await store.getState().hydrate();

    expect(store.getState().hydrated).toBe(true);
    expect(store.getState().byEvent).toEqual({ "333": "item_gan12", "222": "item_valk2" });
  });

  it("drops empty values instead of keeping a blank choice", async () => {
    const { connect } = memoryConnector({ [`${ACTIVE_CUBE_KEY_PREFIX}333`]: "" });
    const store = createActiveCubeStore(connect);
    await store.getState().hydrate();
    expect(store.getState().byEvent).toEqual({});
  });

  it("setActive stores the choice and clears it with null", async () => {
    const { connect, rows, set } = memoryConnector();
    const store = createActiveCubeStore(connect);
    await store.getState().hydrate();

    store.getState().setActive("333", "item_gan12");
    expect(store.getState().byEvent["333"]).toBe("item_gan12");
    await vi.waitFor(() =>
      expect(rows[`${ACTIVE_CUBE_KEY_PREFIX}333`]).toBe("item_gan12"),
    );

    store.getState().setActive("333", null);
    expect(store.getState().byEvent["333"]).toBeUndefined();
    // The row is blanked (not deleted) so a stale value can never come back.
    await vi.waitFor(() => expect(rows[`${ACTIVE_CUBE_KEY_PREFIX}333`]).toBe(""));
    expect(set).toHaveBeenCalledTimes(2);
  });

  it("keeps the choice in memory when the database cannot be reached", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const connect: ActiveCubeConnector = async () => {
      throw new Error("no OPFS");
    };

    const store = createActiveCubeStore(connect);
    await store.getState().hydrate();

    // Degraded but usable: the session still remembers the choice.
    expect(store.getState().hydrated).toBe(true);
    store.getState().setActive("333", "item_gan12");
    expect(store.getState().byEvent["333"]).toBe("item_gan12");
    warn.mockRestore();
  });

  it("hydrate is idempotent and shares the in-flight promise", async () => {
    const { connect } = memoryConnector({ [`${ACTIVE_CUBE_KEY_PREFIX}333`]: "a" });
    const store = createActiveCubeStore(connect);

    await Promise.all([
      store.getState().hydrate(),
      store.getState().hydrate(),
      store.getState().hydrate(),
    ]);
    expect(store.getState().byEvent).toEqual({ "333": "a" });
    // Second call after a successful hydrate is a no-op (no re-read).
    await store.getState().hydrate();
    expect(store.getState().byEvent).toEqual({ "333": "a" });
  });
});
