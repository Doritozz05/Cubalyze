"use client";

/**
 * On-device console + crash capture.
 *
 * Intercepts every console.* call, `window.onerror` and unhandled promise
 * rejections and keeps a bounded ring buffer (in-memory, persisted to
 * localStorage so it survives reloads). The captured log is the trail that
 * makes a white screen debuggable on a phone: no USB cable, no devtools —
 * open the URL with `?debug=1` (or tap "Ver logs" in the crash screen) and
 * read/copy everything the app printed, including the database storage tier
 * line (`[Database] Storage: …`) that tells us which backend is active.
 *
 * Everything stays on the device. There is nothing here that uploads data.
 */

export interface LogEntry {
  ts: number;
  level: "debug" | "log" | "info" | "warn" | "error";
  text: string;
}

const MAX_ENTRIES = 500;
const MAX_ENTRY_LENGTH = 600;
const STORAGE_KEY = "cubeforge:log-buffer";

const logBuffer: LogEntry[] = [];
let installed = false;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

/** Rendered form of one console argument. Exported for tests. */
export function safeString(value: unknown): string {
  if (value instanceof Error) {
    return `${value.name}: ${value.message}${value.stack ? `\n${value.stack}` : ""}`;
  }
  // Cross-realm errors (worker/Comlink round-trips, deserialized rejections):
  // `instanceof Error` is false and `message` is non-enumerable, so plain
  // JSON.stringify renders them as `{}` and the evidence is lost — exactly
  // when it matters most. Read the fields explicitly.
  if (typeof value === "object" && value !== null) {
    const v = value as { name?: unknown; message?: unknown; stack?: unknown };
    if (typeof v.message === "string" || typeof v.stack === "string") {
      const name = typeof v.name === "string" && v.name ? v.name : "Error";
      const message = typeof v.message === "string" ? v.message : String(value);
      const stack = typeof v.stack === "string" ? `\n${v.stack}` : "";
      return `${name}: ${message}${stack}`;
    }
  }
  if (typeof value === "string") return value;
  try {
    const json = JSON.stringify(value);
    return json === undefined ? String(value) : json;
  } catch {
    return String(value);
  }
}

function persist(): void {
  if (persistTimer !== null) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    try {
      // Persist the tail only; long sessions shouldn't blow the 5 MB quota.
      const entries = logBuffer.slice(-400);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, entries }));
    } catch {
      // Storage may be full or unavailable (private mode) — retry once
      // with a much smaller slice, then give up and stay in-memory only.
      try {
        const entries = logBuffer.slice(-150);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, entries }));
      } catch {
        /* in-memory only */
      }
    }
  }, 600);
}

function addEntry(level: LogEntry["level"], args: unknown[]): void {
  const text = args
    .map(safeString)
    .join(" ")
    .slice(0, MAX_ENTRY_LENGTH);
  logBuffer.push({ ts: Date.now(), level, text });
  if (logBuffer.length > MAX_ENTRIES) {
    logBuffer.splice(0, logBuffer.length - MAX_ENTRIES);
  }
  // Errors are the most valuable: persist them immediately so a page
  // reload (e.g. after a crash) still has the evidence.
  if (level === "error") {
    if (persistTimer !== null) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    persist();
  }
}

function installConsoleCapture(): void {
  const methods: Array<{
    level: LogEntry["level"];
    original: (...args: unknown[]) => void;
  }> = [
    { level: "debug", original: console.debug.bind(console) },
    { level: "log", original: console.log.bind(console) },
    { level: "info", original: console.info.bind(console) },
    { level: "warn", original: console.warn.bind(console) },
    { level: "error", original: console.error.bind(console) },
  ];
  for (const { level, original } of methods) {
    const wrapped = (...args: unknown[]): void => {
      addEntry(level, args);
      try {
        original(...args);
      } catch {
        /* never let logging break the app */
      }
    };
    (console as unknown as Record<string, unknown>)[level] = wrapped;
  }
}

function installWindowErrorCapture(): void {
  window.addEventListener("error", (event) => {
    addEntry("error", [
      "[window.onerror]",
      event.error ?? event.message,
      event.filename ? `${event.filename}:${event.lineno ?? "?"}:${event.colno ?? "?"}` : "",
    ]);
  });
  window.addEventListener("unhandledrejection", (event) => {
    addEntry("error", ["[unhandledrejection]", safeString(event.reason)]);
  });
}

function restorePersisted(): void {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as { v?: number; entries?: LogEntry[] };
    if (parsed?.v !== 1 || !Array.isArray(parsed.entries)) return;
    for (const e of parsed.entries) {
      if (
        e &&
        typeof e.ts === "number" &&
        typeof e.text === "string" &&
        typeof e.level === "string"
      ) {
        logBuffer.push({
          ts: e.ts,
          level: e.level as LogEntry["level"],
          text: e.text.slice(0, MAX_ENTRY_LENGTH),
        });
      }
    }
    if (logBuffer.length > MAX_ENTRIES) {
      logBuffer.splice(0, logBuffer.length - MAX_ENTRIES);
    }
  } catch {
    /* corrupted buffer — start fresh */
  }
}

/** Latest snapshot of the captured logs (oldest first). */
export function getLogs(): LogEntry[] {
  return logBuffer.slice();
}

/** All logs flattened to a copy-paste-friendly block. */
export function logsToText(): string {
  return logBuffer
    .map((e) => {
      const d = new Date(e.ts);
      const p = (n: number): string => String(n).padStart(2, "0");
      return `[${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${String(
        d.getMilliseconds(),
      ).padStart(3, "0")}] ${e.level.toUpperCase()} ${e.text}`;
    })
    .join("\n");
}

export function clearLogBuffer(): void {
  logBuffer.length = 0;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export interface LogCaptureApi {
  /** Snapshot of the console buffer. */
  get: () => LogEntry[];
  /** Full plain-text log for pasting into a chat/issue. */
  text: () => string;
  clear: () => void;
}

declare global {
  interface Window {
    __cubalyzeLogs?: LogCaptureApi;
  }
}

/**
 * Installs console + global error capture. Call ONCE, at module scope, before
 * the app renders — so even a crash during boot leaves a readable trail.
 */
export function installLogCapture(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  restorePersisted();
  installConsoleCapture();
  installWindowErrorCapture();

  window.__cubalyzeLogs = {
    get: getLogs,
    text: logsToText,
    clear: clearLogBuffer,
  };

  console.log(
    "[Diagnostics] Log capture armed — open this URL with ?debug=1 to see a live log viewer on any device.",
  );
}