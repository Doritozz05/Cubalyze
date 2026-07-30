/**
 * Detects if the current window context is running inside the Tauri desktop app.
 */
export function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  return "__TAURI_INTERNALS__" in window || "__TAURI__" in window;
}

/**
 * Returns true ONLY when running on local Vite dev server in the web browser (localhost/127.0.0.1).
 * Returns false when running in Tauri desktop app or on external production hosts (Vercel, custom domains).
 */
export function isLocalhost(): boolean {
  if (typeof window === "undefined") return false;
  if (isTauri()) return false;

  const hostname = window.location.hostname;
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname.endsWith(".local")
  );
}
