/**
 * Boot-time readiness signal for the pre-React root loader (index.html).
 *
 * main.tsx keeps the loader overlay visible until this promise resolves, so
 * the overlay covers BOTH the bundle download AND the initial view's lazy
 * chunk — the user never sees a second loading state or a white flash after
 * the loader fades.
 *
 * Who signals:
 *  - MainStage marks it ready when the initial view's chunk finishes loading
 *    (each lazy() import resolves) or, for the eager timer view, on mount.
 *  - A safety timeout in main.tsx resolves it as a last resort so the overlay
 *    can never block the UI forever (e.g. a chunk fails to load).
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
