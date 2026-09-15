"use client";

/**
 * activeCubeStore.ts — which cube each event is being solved with, on THIS
 * device.
 *
 * It lives in `app_meta` (one key per event, `active_cube_<event>`), not in the
 * synced preferences: a phone and a desktop can be sitting in front of different
 * cubes, and a solve is attributed at the moment it happens. Nothing here talks
 * to the cloud.
 *
 * The store caches the whole map in memory because the solve pipeline has to
 * answer synchronously at solve-stop time. Writes are fire-and-forget: if the
 * database is unavailable the choice still works for this session, which is the
 * same degradation the Locker itself uses.
 *
 * `createActiveCubeStore` takes its connection as a parameter so the plumbing is
 * testable without a Worker.
 */

import { create } from "zustand";
import { AppMetaRepository, initDB } from "@cubalyze/database";

/** `app_meta` prefix; the suffix is the event code. */
export const ACTIVE_CUBE_KEY_PREFIX = "active_cube_";

export interface ActiveCubeMeta {
  getByPrefix(prefix: string): Promise<Record<string, string>>;
  set(key: string, value: string): Promise<void>;
}

export type ActiveCubeConnector = () => Promise<ActiveCubeMeta>;

export const connectActiveCubeMeta: ActiveCubeConnector = async () => {
  const dbClient = await initDB();
  return new AppMetaRepository(async (sql, bind) => await dbClient.execute(sql, bind));
};

export interface ActiveCubeStore {
  /** Event code → Locker item id. */
  byEvent: Record<string, string>;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  /** Choose a cube for an event (null clears the choice). */
  setActive: (eventCode: string, itemId: string | null) => void;
}

export function createActiveCubeStore(connect: ActiveCubeConnector) {
  let meta: ActiveCubeMeta | null = null;
  let hydrating: Promise<void> | null = null;

  return create<ActiveCubeStore>()((set, get) => ({
    byEvent: {},
    hydrated: false,

    hydrate: async () => {
      if (get().hydrated) return;
      if (hydrating) return hydrating;
      hydrating = (async () => {
        try {
          meta = await connect();
          const values = await meta.getByPrefix(ACTIVE_CUBE_KEY_PREFIX);
          const byEvent: Record<string, string> = {};
          for (const [event, itemId] of Object.entries(values)) {
            if (itemId) byEvent[event] = itemId;
          }
          set({ byEvent, hydrated: true });
        } catch (error) {
          // No database: the choice still lives in memory for this session.
          console.warn("[active-cube] could not read the stored choices", error);
          set({ hydrated: true });
        }
      })();
      return hydrating;
    },

    setActive: (eventCode, itemId) => {
      set((state) => {
        const byEvent = { ...state.byEvent };
        if (itemId) byEvent[eventCode] = itemId;
        else delete byEvent[eventCode];
        return { byEvent };
      });
      void meta
        ?.set(`${ACTIVE_CUBE_KEY_PREFIX}${eventCode}`, itemId ?? "")
        .catch((error: unknown) => console.warn("[active-cube] could not store the choice", error));
    },
  }));
}

/** The app-wide singleton. */
export const activeCubeStore = createActiveCubeStore(connectActiveCubeMeta);
