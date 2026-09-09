"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Bug, Copy, Trash2, X } from "lucide-react";
import {
  clearLogBuffer,
  getLogs,
  logsToText,
  type LogEntry,
} from "@/boot/logCapture";

/**
 * On-device log viewer.
 *
 * - Lives OUTSIDE the AppErrorBoundary (mounted as a sibling in main.tsx),
 *   so it survives a render crash and can open from the crash screen via the
 *   `cubeforge:open-logs` window event.
 * - The floating button appears with `?debug=1` in the URL (or the
 *   `cubeforge:debug-ui=1` localStorage flag) — nothing new in the UI for
 *   normal users.
 * - Polls the in-memory ring buffer a few times per second; everything is
 *   local to the device, nothing is uploaded.
 */
export function LogViewer(): ReactNode | null {
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [copied, setCopied] = useState(false);

  // Open from the crash screen; show the floating button with ?debug=1.
  useEffect(() => {
    const onOpen = (): void => setOpen(true);
    window.addEventListener("cubeforge:open-logs", onOpen);
    return () => window.removeEventListener("cubeforge:open-logs", onOpen);
  }, []);

  const debugEnabled = useDebugUiEnabled(false);
  const showButton = debugEnabled && !open;

  // Live refresh of the buffer.
  useEffect(() => {
    const id = window.setInterval(() => setLogs(getLogs()), 500);
    return () => window.clearInterval(id);
  }, []);

  const handleCopy = useCallback(async () => {
    const text = logsToText();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard API unavailable (non-secure context) — fallback.
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }, []);

  const handleClear = useCallback(() => {
    clearLogBuffer();
    setLogs(getLogs());
  }, []);

  const visible = logs.filter((e) => !errorsOnly || e.level === "error" || e.level === "warn");

  if (!open) {
    if (!showButton) return null;
    return (
      <button
        data-glass-float
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ver logs de depuración"
        className="fixed bottom-20 right-3 z-[2147483000] flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-2 text-xs font-semibold text-ink-2 shadow-lg"
        style={{ zIndex: 2147483000 }}
      >
        <Bug className="size-3.5" />
        Logs
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[2147483000] flex items-end justify-center bg-black/40 sm:items-start sm:justify-end sm:p-4 sm:bg-transparent"
      style={{ zIndex: 2147483000 }}
      onClick={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-label="Visor de logs"
        className="flex h-[82vh] w-full flex-col overflow-hidden rounded-t-2xl border border-line bg-canvas text-ink shadow-2xl sm:h-auto sm:max-h-[75vh] sm:w-[460px] sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-2.5">
          <Bug className="size-4 text-ink-3" />
          <span className="text-sm font-semibold">Logs on-device</span>
          <span className="text-[0.6rem] text-ink-3">· nunca salen del dispositivo</span>
          <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-[0.65rem] text-ink-3 select-none">
            <input
              type="checkbox"
              checked={errorsOnly}
              onChange={(e) => setErrorsOnly(e.target.checked)}
              className="size-3 accent-primary"
            />
            Solo errores
          </label>
          <button
            type="button"
            onClick={handleCopy}
            aria-label="Copiar logs"
            title="Copiar todo"
            className="flex size-7 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
          >
            {copied ? <span className="text-[0.6rem] font-bold text-ready">✓</span> : <Copy className="size-3.5" />}
          </button>
          <button
            type="button"
            onClick={handleClear}
            aria-label="Limpiar logs"
            title="Limpiar logs"
            className="flex size-7 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <Trash2 className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Cerrar"
            className="flex size-7 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2">
          {logs.length === 0 ? (
            <p className="py-10 text-center text-xs text-ink-3">
              Sin logs todavía. Si acabas de abrir la app, la línea{" "}
              <code className="rounded bg-surface-2 px-1 py-0.5 text-[0.6rem]">[Database] Storage: …</code>{" "}
              aquí dice qué almacén está usando.
            </p>
          ) : visible.length === 0 ? (
            <p className="py-10 text-center text-xs text-ink-3">No hay errores capturados.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {visible.map((e, i) => (
                <li
                  key={`${e.ts}-${i}`}
                  className="flex items-start gap-2 rounded-md px-1.5 py-1 font-mono text-[0.65rem] leading-relaxed"
                  style={{ background: "transparent" }}
                >
                  <span className="shrink-0 text-ink-3/70">{formatTime(e.ts)}</span>
                  <span
                    className="shrink-0 rounded px-1 py-px text-[0.55rem] font-bold uppercase tracking-wide"
                    style={badgeStyle(e.level)}
                  >
                    {e.level}
                  </span>
                  <span
                    className="min-w-0 break-words whitespace-pre-wrap"
                    style={{ color: levelColor(e.level) }}
                  >
                    {e.text}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-line px-3 py-2 text-[0.62rem] text-ink-3">
          <span className="tabular-nums">
            {logs.length} eventos
            {errorsOnly ? ` · ${visible.length} errores` : ""}
          </span>
          <span className="text-right">
            Abre la app con <span className="font-mono">?debug=1</span> para que aparezca el botón
          </span>
        </div>
      </div>
    </div>
  );
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const p = (n: number): string => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${String(
    d.getMilliseconds(),
  ).padStart(3, "0")}`;
}

function levelColor(level: LogEntry["level"]): string {
  switch (level) {
    case "error":
      return "#f87171";
    case "warn":
      return "#fbbf24";
    case "info":
      return "#7db4f5";
    default:
      return "#b6bdc9";
  }
}

function badgeStyle(level: LogEntry["level"]): Record<string, string> {
  const map: Record<LogEntry["level"], string> = {
    error: "#f87171",
    warn: "#fbbf24",
    info: "#7db4f5",
    log: "#8b93a3",
    debug: "#8b93a3",
  };
  return { background: `${map[level]}22`, color: map[level] };
}

function useDebugUiEnabled(initial: boolean): boolean {
  const [enabled, setEnabled] = useState(initial);
  useEffect(() => {
    try {
      const hasParam = new URLSearchParams(window.location.search).has("debug");
      const hasFlag = window.localStorage.getItem("cubeforge:debug-ui") === "1";
      setEnabled(hasParam || hasFlag);
    } catch {
      /* ignore */
    }
  }, []);
  return enabled;
}