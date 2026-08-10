"use client";

import { useCallback, useMemo, useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { Penalty } from "@/types";
import {
  formatManualPreview,
  parseTimeInput,
  type ParsedManualTime,
} from "@/utils/parseTimeInput";

export interface ManualTimeInputProps {
  /** Called once per parsed solve (time in ms, penalty). */
  onSubmit: (time: number, penalty: Penalty) => void;
  className?: string;
}

/**
 * Inline manual time entry that replaces the big timer number when
 * inputMode === 'manual'.
 *
 * Mirrors csTimer's manual entry (cs0x7f/cstimer, src/js/timer/input.js):
 * integers are read in 2-digit groups from the right, so "10" → 0.10s and
 * "1450" → 14.50s. Also accepts "14.50", "1:23.45", "1:23:45.67", "DNF",
 * "15.50+" (+2 penalty), unit suffixes ("90s", "2m30s") and several times
 * separated by commas or newlines. A live preview shows the parsed result
 * before pressing Enter.
 */
export function ManualTimeInput({
  onSubmit,
  className,
}: ManualTimeInputProps) {
  const { t } = useTranslation("timer");
  const [input, setInput] = useState("");
  const [penalty, setPenalty] = useState<Penalty>("none");
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const parsed = useMemo(() => parseTimeInput(input), [input]);
  const preview = useMemo(
    () => (parsed && parsed.length > 0 ? formatManualPreview(parsed) : null),
    [parsed],
  );

  const handleSubmit = useCallback(() => {
    if (!parsed || parsed.length === 0) return;
    for (const entry of parsed) {
      // Penalties written in the string ("DNF", "15.50+") win; otherwise
      // fall back to the toggle buttons.
      const merged: ParsedManualTime =
        entry.penalty !== "none" ? entry : { ...entry, penalty };
      onSubmit(merged.timeMs, merged.penalty);
    }
    setInput("");
    setPenalty("none");
    // Re-focus for next entry
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [parsed, penalty, onSubmit]);

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
          maxLength={80}
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
          <span
            className="absolute -bottom-6 left-1/2 max-w-[92%] -translate-x-1/2 truncate nums text-xs text-ink-3 whitespace-nowrap"
            title={preview}
          >
            {preview}
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
            {p === "none" ? t("penaltyNone") : p}
          </button>
        ))}
      </div>

    </div>
  );
}
