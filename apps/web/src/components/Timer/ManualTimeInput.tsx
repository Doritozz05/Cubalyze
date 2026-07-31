"use client";

import { useCallback, useMemo, useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { formatTime } from "@/utils/formatTime";
import type { Penalty } from "@/types";

/**
 * Parse a time string into milliseconds. Accepts:
 *  - "1450"      → 14.50s = 14500 ms (csTimer style: implicit decimal before last 2 digits)
 *  - "14.50"     → 14500 ms
 *  - "1:23.45"   → 83450 ms
 *  - "75"        → 75000 ms
 * Returns null if invalid.
 */
function parseManualTime(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.includes(":")) {
    const parts = trimmed.split(":");
    if (parts.length !== 2) return null;
    const m = Number(parts[0]);
    const s = Number(parts[1]);
    if (!Number.isFinite(m) || !Number.isFinite(s) || m < 0 || s < 0) return null;
    return Math.round(m * 60_000 + s * 1000);
  }
  if (trimmed.includes(".")) {
    const [secStr, csStr = ""] = trimmed.split(".");
    const sec = Number(secStr);
    const csExp = Math.pow(10, csStr.length || 0);
    const cs = Number(csStr);
    if (!Number.isFinite(sec) || !Number.isFinite(cs) || sec < 0 || cs < 0) return null;
    return Math.round(sec * 1000 + (cs / csExp) * 1000);
  }
  // csTimer style: "1450" → 14.50 seconds = 14500 ms
  // If 3+ digits, treat last 2 as centiseconds
  if (trimmed.length >= 3 && /^\d+$/.test(trimmed)) {
    const cs = parseInt(trimmed.slice(-2), 10);
    const sec = parseInt(trimmed.slice(0, -2), 10);
    return (sec * 1000) + (cs * 10);
  }
  // Short number: treat as seconds
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
 * press Enter to submit. The scramble and session stats stay in place via the parent.
 */
export function ManualTimeInput({
  onSubmit,
  className,
}: ManualTimeInputProps) {
  const [input, setInput] = useState("");
  const [submittedTime, setSubmittedTime] = useState<number | null>(null);
  const [penalty, setPenalty] = useState<Penalty>("none");
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the input on mount and after each submit
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const parsedMs = useMemo(() => parseManualTime(input), [input]);
  const preview = parsedMs != null && parsedMs > 0 ? formatTime(parsedMs) : null;

  const handleSubmit = useCallback(() => {
    if (parsedMs == null || parsedMs <= 0) return;
    onSubmit(parsedMs, penalty);
    setSubmittedTime(parsedMs);
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
    <div className={cn("flex flex-col items-center justify-center gap-7", className)}>
      {/* Submitted time flash */}
      <AnimatePresence>
        {submittedTime !== null && (
          <motion.div
            key={submittedTime}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-ink-3 text-sm nums"
          >
            Logged: {formatTime(submittedTime)}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Big time input — replaces the timer number */}
      <div className="flex items-center gap-3">
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setSubmittedTime(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder="0.00"
          className={cn(
            "nums w-[clamp(200px,35vw,380px)] rounded-xl border-2 bg-transparent py-3 text-center text-[clamp(3.75rem,15vw,9.5rem)] font-medium leading-none tracking-tight outline-none transition-all duration-200",
            "border-line text-ink placeholder:text-ink-3/20",
            "focus:border-ink-2 focus:bg-surface/50",
            parsedMs != null && parsedMs > 0 && "border-emerald-500/40",
          )}
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      {/* Preview of parsed time */}
      {preview && (
        <span className="nums text-xs text-ink-3">
          = {preview}
        </span>
      )}

      {/* Penalty toggles */}
      <div className="flex items-center gap-1.5">
        {(["none", "+2", "DNF"] as Penalty[]).map((p) => (
          <button
            key={p}
            onClick={() => setPenalty(p)}
            className={cn(
              "rounded-md px-3 py-1.5 text-[0.62rem] font-medium uppercase tracking-[0.08em] transition-all",
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

      {/* Hint */}
      <div className="flex items-center justify-center text-ink-3">
        <span className="nums text-[0.7rem] uppercase tracking-[0.18em]">
          Type time · Enter to log · Esc to clear
        </span>
      </div>
    </div>
  );
}
