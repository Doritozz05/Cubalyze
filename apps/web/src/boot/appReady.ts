/**
 * Boot-time readiness signal for the pre-React root loader (index.html).
 *
 * main.tsx keeps the loader overlay visible until BOTH promises resolve, so
 * the overlay covers the bundle download, the initial view's lazy chunk AND
 * the database/session hydration — the user never sees a second loading
 * state, a white flash, or UI pieces (session dock, solve counts) popping in
 * after the loader fades.
 *
 * Who signals:
 *  - appReady: MainStage marks it ready when the initial view's chunk
 *    finishes loading (each lazy() import resolves) or, for the eager timer
 *    view, on mount.
 *  - appDataReady: App.tsx marks it ready once the persistent-session hook
 *    finishes loading the DB and hydrating sessions/solves.
 *  - A safety timeout in main.tsx resolves both as a last resort so the
 *    overlay can never block the UI forever (e.g. a chunk fails to load).
 *
 * Idempotent: extra calls after the first resolution are no-ops.
 */
let markReady = (): void => {};

export const appReady: Promise<void> = new Promise((resolve) => {
  markReady = resolve;
});

export function markAppReady(): void {
  markReady();
}

let markDataReady = (): void => {};

export const appDataReady: Promise<void> = new Promise((resolve) => {
  markDataReady = resolve;
});

export function markAppDataReady(): void {
  markDataReady();
}
