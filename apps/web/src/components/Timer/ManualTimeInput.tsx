"use client";

import { useCallback, useMemo, useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { formatTime } from "@/utils/formatTime";
import type { Penalty } from "@/types";

/**
 * Parse the seconds portion of a time string ("ss.cs" or "ss") into milliseconds.
 * Returns null if invalid.
 */
function parseSecondsMs(sRaw: string): number | null {
  if (sRaw.includes(".")) {
    const [secStr, csStr = ""] = sRaw.split(".");
    const s = Number(secStr);
    const csExp = Math.pow(10, csStr.length || 0);
    const cs = Number(csStr);
    if (!Number.isFinite(s) || !Number.isFinite(cs) || s < 0 || cs < 0) return null;
    return Math.round(s * 1000 + (cs / csExp) * 1000);
  }
  const s = Number(sRaw);
  if (!Number.isFinite(s) || s < 0) return null;
  return Math.round(s * 1000);
}

/**
 * Parse a value with optional unit suffix ("h", "m", "s", "ms") into milliseconds.
 * Examples: "1.5h" → 5400000, "90s" → 90000, "2m30s" (handled by caller concatenation).
 * Returns null if invalid.
 */
function parseWithUnit(raw: string): number | null {
  const match = raw.match(/^([\d.]+)\s*(h|ms|m|s)$/i);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value < 0) return null;
  switch (match[2].toLowerCase()) {
    case "h":  return Math.round(value * 3_600_000);
    case "m":  return Math.round(value * 60_000);
    case "s":  return Math.round(value * 1000);
    case "ms": return Math.round(value);
  }
  return null;
}

/**
 * Parse a time string into milliseconds. Accepts:
 *  - "1450"        → 14.50s (csTimer numeric: last 2 digits = centiseconds)
 *  - "14.50"       → 14500 ms (decimal seconds)
 *  - "1:23.45"     → 1m 23.45s = 83450 ms
 *  - "1:23:45.67"  → 1h 23m 45.67s = 5025670 ms
 *  - "99h"         → 99 hours
 *  - "1h30m"       → 1 hour 30 minutes
 *  - "2m30s"       → 2 minutes 30 seconds
 *  - "90s"         → 90 seconds
 *  - "75"          → 75000 ms (plain seconds)
 * Returns null if invalid.
 */
function parseManualTime(input: string): number | null {
  const trimmed = input.trim().toLowerCase();
  if (trimmed.length === 0) return null;

  // ── Unit suffix formats: "99h", "1h30m", "2m30s", "1h30m45s", "90s" ──
  if (/[hms]$/i.test(trimmed) && !trimmed.includes(":")) {
    let totalMs = 0;
    // Match sequences like "1h30m45.5s" by extracting each number+unit pair
    const regex = /([\d.]+)\s*(h|m|s|ms)\s*/gi;
    let match: RegExpExecArray | null;
    let lastIndex = 0;
    while ((match = regex.exec(trimmed)) !== null) {
      const ms = parseWithUnit(match[0].trim());
      if (ms === null) return null;
      totalMs += ms;
      lastIndex = regex.lastIndex;
    }
    // If we consumed the whole input, return the total
    if (lastIndex >= trimmed.length && totalMs > 0) return totalMs;
    // If nothing matched, fall through to other formats
  }

  // ── Colon-based formats: "h:mm:ss.cs", "h:mm:ss", "m:ss.cs", "m:ss" ──
  if (trimmed.includes(":")) {
    const parts = trimmed.split(":");
    if (parts.length === 3) {
      const h = Number(parts[0]);
      const m = Number(parts[1]);
      if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || m < 0) return null;
      const sMs = parseSecondsMs(parts[2]);
      if (sMs === null) return null;
      return Math.round(h * 3_600_000 + m * 60_000 + sMs);
    }
    if (parts.length === 2) {
      const m = Number(parts[0]);
      if (!Number.isFinite(m) || m < 0) return null;
      const sMs = parseSecondsMs(parts[1]);
      if (sMs === null) return null;
      return Math.round(m * 60_000 + sMs);
    }
    return null;
  }

  // ── Decimal seconds: "14.50", "1.5" ──
  if (trimmed.includes(".")) {
    return parseSecondsMs(trimmed);
  }

  // ── csTimer style numeric input: last 2 digits = centiseconds ──
  //   3-4 digits: SScc   → "1450" = 14.50s
  //   5-6 digits: MMSScc → "23100" = 2:31.00
  //   7+ digits:  HMMSScc → "1231000" = 1:23:10.00
  if (/^\d+$/.test(trimmed) && trimmed.length >= 3) {
    const cs = parseInt(trimmed.slice(-2), 10);
    const sec = parseInt(trimmed.slice(-4, -2) || "0", 10);
    const rest = trimmed.slice(0, -4);
    if (rest.length === 0) {
      return (sec * 1000) + (cs * 10);
    }
    if (rest.length <= 2) {
      const min = parseInt(rest, 10);
      return (min * 60_000) + (sec * 1000) + (cs * 10);
    }
    const hours = parseInt(rest.slice(0, -2) || "0", 10);
    const mins = parseInt(rest.slice(-2), 10);
    return (hours * 3_600_000) + (mins * 60_000) + (sec * 1000) + (cs * 10);
  }

  // ── Short number: treat as seconds ──
  const sec = Number(trimmed);
  if (!Number.isFinite(sec) || sec < 0) return null;
  return Math.round(sec * 1000);
}

export interface ManualTimeInputProps {
  /** Called when a time is submitted (time in ms, penalty). */
  onSubmit: (time: number, penalty: Penalty) => void;
  className?: string;
}

/**
 * Inline manual time entry that replaces the big timer number when inputMode === 'manual'.
 *
 * Mirrors csTimer's manual entry: type "1450" → 14.50s, or "14.50",
 * press Enter to submit. Supports hours: "1:23:45.67". The scramble and
 * session stats stay in place via the parent.
 */
export function ManualTimeInput({
  onSubmit,
  className,
}: ManualTimeInputProps) {
  const [input, setInput] = useState("");
  const [penalty, setPenalty] = useState<Penalty>("none");
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const parsedMs = useMemo(() => parseManualTime(input), [input]);
  const preview = parsedMs != null && parsedMs > 0 ? formatTime(parsedMs) : null;

  const handleSubmit = useCallback(() => {
    if (parsedMs == null || parsedMs <= 0) return;
    onSubmit(parsedMs, penalty);
    setInput("");
    setPenalty("none");
    // Re-focus for next entry
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [parsedMs, penalty, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
      if (e.key === "Escape") {
        setInput("");
        setPenalty("none");
      }
    },
    [handleSubmit],
  );

  return (
    <div className={cn("relative flex flex-col items-center justify-center gap-7 overflow-visible", className)}>
      {/* Big time input — replaces the timer number */}
      <div className="relative flex items-center max-lg:w-full max-lg:max-w-2xl">
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          maxLength={14}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          placeholder="0.00"
          className={cn(
            // Desktop: fluid clamp. Touch (<1024px): fill the stage width so the
            // input + on-screen keyboard stay comfortable on phones/tablets.
            "nums w-[clamp(320px,70vw,900px)] max-lg:w-full rounded-xl border-2 bg-transparent py-3 text-center text-[clamp(3.75rem,15vw,9.5rem)] font-medium leading-none tracking-tight outline-none transition-all duration-200",
            "border-line text-ink placeholder:text-ink-3/20",
            "focus:border-ink-2 focus:bg-surface/50",
          )}
          autoComplete="off"
          spellCheck={false}
        />

        {/* Preview of parsed time — absolutely positioned below the input, no layout shift */}
        {preview && (
          <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 nums text-xs text-ink-3 whitespace-nowrap">
            = {preview}
          </span>
        )}
      </div>

      {/* Penalty toggles */}
      <div className="flex items-center gap-1.5">
        {(["none", "+2", "DNF"] as Penalty[]).map((p) => (
          <button
            key={p}
            onClick={() => setPenalty(p)}
            className={cn(
              "rounded-md px-3 py-1.5 text-[0.62rem] font-medium uppercase tracking-[0.08em] transition-all",
              // Touch: larger thumb targets.
              "max-lg:px-5 max-lg:py-2.5 max-lg:text-[0.7rem]",
              penalty === p
                ? p === "DNF"
                  ? "bg-dnf-soft text-dnf ring-1 ring-dnf/30"
                  : p === "+2"
                    ? "bg-plus2-soft text-plus2 ring-1 ring-plus2/30"
                    : "bg-ink text-surface"
                : "bg-surface-2 text-ink-3 hover:text-ink",
            )}
          >
            {p === "none" ? "OK" : p}
          </button>
        ))}
      </div>


    </div>
  );
}
