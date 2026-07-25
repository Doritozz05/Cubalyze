/**
 * Environment detector — used by adapter factories to select the correct
 * implementation at runtime: Web Bluetooth API (browser) or Tauri native (desktop).
 *
 * Lives in apps/desktop/ — NOT in hardware-hal. The web app never touches this file.
 */

/** Returns true when running inside a Tauri desktop window. */
export const isTauri = (): boolean => {
  try {
    return typeof window !== 'undefined' && '__TAURI__' in window;
  } catch {
    return false;
  }
};

/** Returns true when running in a standard browser / PWA context. */
export const isWeb = (): boolean => {
  return !isTauri();
};
