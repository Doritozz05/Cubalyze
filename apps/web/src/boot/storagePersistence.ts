import { useStorageStatusStore } from "@/stores/storageStatus";

/**
 * Ask the browser to mark this origin's storage as persistent so the OPFS
 * SQLite backend is protected from automatic eviction under storage pressure
 * (ADR-011). Without this, the browser treats OPFS as "best-effort" and may
 * silently delete it when disk space runs low.
 *
 * Best-effort and non-blocking:
 *  - Chromium resolves with `true`/`false` (may require a user gesture).
 *  - Safari/WebKit grants silently based on heuristics (installed PWA, etc.).
 *  - Some embedded contexts throw — we leave the status "unknown" there.
 *
 * Call once after `initDB()` so the database file actually exists before
 * asking; only the OPFS backend is eligible (desktop is already file-backed
 * and memory is volatile regardless of the browser's answer).
 */
export async function requestPersistentStorage(): Promise<void> {
  const setPersistence = useStorageStatusStore.getState().setPersistence;
  const storage = typeof navigator !== "undefined" ? navigator.storage : undefined;

  if (!storage?.persist || !storage?.persisted) {
    setPersistence("unsupported");
    return;
  }

  try {
    // Short-circuit when already granted — avoids re-requesting every load.
    const already = await storage.persisted();
    if (already) {
      setPersistence("granted");
      return;
    }
    const granted = await storage.persist();
    setPersistence(granted ? "granted" : "denied");
  } catch {
    setPersistence("unknown");
  }
}
