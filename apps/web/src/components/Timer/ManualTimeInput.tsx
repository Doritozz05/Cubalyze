"use client";

import { useCallback, useMemo, useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { MessageSquare, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { hapticTap } from "@/utils/haptics";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Penalty } from "@/types";
import {
  formatManualPreview,
  parseTimeInput,
  type ParsedManualTime,
} from "@/utils/parseTimeInput";

export interface ManualTimeInputProps {
  /** Called once per parsed solve (time in ms, penalty, note). */
  onSubmit: (time: number, penalty: Penalty, note?: string | null) => void;
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
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteInput, setNoteInput] = useState("");
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
    const finalNote = noteInput.trim() || null;
    for (const entry of parsed) {
      // Penalties written in the string ("DNF", "15.50+") win; otherwise
      // fall back to the toggle buttons.
      const merged: ParsedManualTime =
        entry.penalty !== "none" ? entry : { ...entry, penalty };
      onSubmit(merged.timeMs, merged.penalty, finalNote);
    }
    setInput("");
    setPenalty("none");
    setNoteInput("");
    setIsEditingNote(false);
    // Re-focus for next entry
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [parsed, penalty, noteInput, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !isEditingNote) {
        e.preventDefault();
        handleSubmit();
      }
      if (e.key === "Escape") {
        setInput("");
        setPenalty("none");
        setNoteInput("");
        setIsEditingNote(false);
      }
    },
    [handleSubmit, isEditingNote],
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
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                tabIndex={0}
                className="absolute -bottom-6 left-1/2 max-w-[92%] -translate-x-1/2 truncate nums text-xs text-ink-3 whitespace-nowrap outline-none focus-visible:ring-1 focus-visible:ring-ink-3/50 rounded-sm"
              >
                {preview}
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom">{preview}</TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Quick Penalty & Note Action Bar for Manual Entry (styled like TimerContainer's solve completion bar) */}
      <div className="flex items-center gap-1 rounded-full border border-line/30 bg-surface-2/60 px-1.5 py-1 backdrop-blur-md shadow-2xs transition-all duration-200 z-10 max-lg:px-2.5 max-lg:py-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => {
                hapticTap();
                setPenalty((prev) => (prev === "+2" ? "none" : "+2"));
              }}
              className={cn(
                "h-6 px-2.5 rounded-full text-[0.72rem] font-medium tracking-wide transition-all duration-150 cursor-pointer outline-none select-none max-lg:h-10 max-lg:px-4 max-lg:text-sm",
                penalty === "+2"
                  ? "bg-plus2-soft text-plus2 font-bold ring-1 ring-plus2/30"
                  : "text-ink-3 hover:bg-surface-3 hover:text-ink",
              )}
            >
              +2
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">{t("togglePlus2")}</TooltipContent>
        </Tooltip>

        <div className="h-3 w-px bg-line/40" />

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => {
                hapticTap();
                setPenalty((prev) => (prev === "DNF" ? "none" : "DNF"));
              }}
              className={cn(
                "h-6 px-2.5 rounded-full text-[0.72rem] font-medium tracking-wide transition-all duration-150 cursor-pointer outline-none select-none max-lg:h-10 max-lg:px-4 max-lg:text-sm",
                penalty === "DNF"
                  ? "bg-dnf-soft text-dnf font-bold ring-1 ring-dnf/30"
                  : "text-ink-3 hover:bg-surface-3 hover:text-ink",
              )}
            >
              DNF
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">{t("toggleDnf")}</TooltipContent>
        </Tooltip>

        <div className="h-3 w-px bg-line/40" />

        {isEditingNote ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setIsEditingNote(false);
              inputRef.current?.focus();
            }}
            className="flex items-center gap-1 pl-0.5"
          >
            <input
              type="text"
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setIsEditingNote(false);
                  inputRef.current?.focus();
                }
              }}
              placeholder={t("notePlaceholder")}
              autoFocus
              className="h-6 w-28 max-lg:w-36 max-lg:h-9 rounded-full bg-surface-2 border border-line px-2.5 text-xs text-ink placeholder:text-ink-3 outline-none focus:border-ink/40"
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="submit"
                  className="h-6 w-6 max-lg:h-9 max-lg:w-9 grid place-items-center rounded-full text-ready hover:bg-ready-soft transition-colors cursor-pointer"
                >
                  <Check className="size-3.5 max-lg:size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">{t("saveNote")}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingNote(false);
                    inputRef.current?.focus();
                  }}
                  className="h-6 w-6 max-lg:h-9 max-lg:w-9 grid place-items-center rounded-full text-ink-3 hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer"
                >
                  <X className="size-3.5 max-lg:size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">{t("cancel")}</TooltipContent>
            </Tooltip>
          </form>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => {
                  hapticTap();
                  setIsEditingNote(true);
                }}
                className={cn(
                  "h-6 px-2 rounded-full transition-all duration-150 cursor-pointer outline-none select-none flex items-center gap-1.5 max-lg:h-10 max-lg:px-3 text-[0.72rem] max-lg:text-sm font-medium",
                  noteInput
                    ? "text-phase-indigo bg-phase-indigo/10 hover:bg-phase-indigo/20 font-semibold ring-1 ring-phase-indigo/30"
                    : "text-ink-3 hover:bg-surface-2 hover:text-ink",
                )}
              >
                <MessageSquare className="size-3.5 max-lg:size-4" />
                {noteInput ? (
                  <span className="max-w-24 truncate text-[0.72rem] max-lg:text-xs">{noteInput}</span>
                ) : null}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {noteInput
                ? t("noteWithValue", { note: noteInput })
                : t("addNote")}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
