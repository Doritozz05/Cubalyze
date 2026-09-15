"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Plus, RefreshCw, X, Clock, Shuffle, Tag, FileText, CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Penalty, SolveMethod, SolveMethod as _SM } from "@/types";
import { RandomStateGenerator } from "@cubalyze/solver-engine";
import { getMin2PhaseSolver } from "@/utils/puzzleUtils";
import {
  formatManualPreview,
  parseTimeInput,
} from "@/utils/parseTimeInput";
import { toast } from "sonner";
import i18n from "@/i18n";

export interface ManualSolveSheetProps {
  open: boolean;
  onClose: () => void;
  /** Pre-fill when adding a solve for a specific scramble (e.g. Review). */
  initialScramble?: string;
  /**
   * Method pre-selected for the active event, or `undefined` when the event has
   * no method concept at all (2×2, Pyraminx…). When it is `undefined` the
   * picker is not rendered: storing a method there would be a lie.
   */
  defaultMethod: SolveMethod | undefined;
  /** Submit handler called with the parsed fields. */
  onSubmit: (input: {
    time: number;
    scramble: string;
    /** Absent when the active event has no method. */
    method?: SolveMethod;
    notes: string;
    penalty: Penalty;
  }) => Promise<void> | void;
}

const METHODS: SolveMethod[] = ["CFOP", "Roux", "ZZ", "Petrus"];
const PENALTIES: Penalty[] = ["none", "+2", "DNF"];

/**
 * Right-side drawer Sheet for manual solve entry. Submitting calls the
 * supplied `onSubmit` (typically `addSolve`); on success the parent resets
 * the draft and closes the sheet.
 */
export function ManualSolveSheet({
  open,
  onClose,
  initialScramble,
  defaultMethod,
  onSubmit,
}: ManualSolveSheetProps) {
  const { t } = useTranslation("stats");
  const [time, setTime] = useState("");
  const [scramble, setScramble] = useState(initialScramble ?? "");
  const [method, setMethod] = useState<SolveMethod | undefined>(defaultMethod);
  const [notes, setNotes] = useState("");
  const [penalty, setPenalty] = useState<Penalty>("none");
  const [submitting, setSubmitting] = useState(false);

  // Re-seed scramble + method each time the sheet opens.
  useEffect(() => {
    if (open) {
      setScramble(
        initialScramble ??
          RandomStateGenerator.generateScramble(getMin2PhaseSolver()),
      );
      setMethod(defaultMethod);
      setTime("");
      setNotes("");
      setPenalty("none");
    }
  }, [open, initialScramble, defaultMethod]);

  const parsed = useMemo(() => parseTimeInput(time), [time]);
  const timeValid = parsed != null && parsed.length > 0;
  const scrambleValid = scramble.trim().length > 0;
  const canSubmit = timeValid && scrambleValid && !submitting;

  const regenScramble = () => {
    setScramble(RandomStateGenerator.generateScramble(getMin2PhaseSolver()));
  };

  const submit = async () => {
    if (!canSubmit || parsed == null || parsed.length === 0) return;
    setSubmitting(true);
    try {
      // Multi-solve support: every parsed entry is logged with the same
      // scramble / method / notes. Penalties written in the string
      // ("DNF", "15.50+") win; otherwise fall back to the toggle buttons.
      const scrambleValue = scramble.trim();
      const notesValue = notes.trim();
      for (const entry of parsed) {
        await onSubmit({
          time: entry.timeMs,
          scramble: scrambleValue,
          method,
          notes: notesValue,
          penalty: entry.penalty !== "none" ? entry.penalty : penalty,
        });
      }
      toast.success(
        i18n.t("toast:solveLoggedCount", { count: parsed.length }),
      );
      onClose();
    } catch (e) {
      toast.error(i18n.t("toast:solveAddFailed"));
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {open ? (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.15 }}
            className="fixed inset-0 z-50 bg-black/40"
            onClick={onClose}
          />
          {/* Sheet */}
          <motion.aside
            key="sheet"
            initial={reduceMotion ? false : { x: 360, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { x: 360, opacity: 0 }}
            transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 360, damping: 32 }}
            data-glass-panel="true"
            className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-95 flex-col border-l border-line bg-surface shadow-2xl"
            aria-label={t("manualSolveAria")}
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-line bg-canvas px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <div className="grid size-7 place-items-center rounded-md bg-ink text-surface">
                  <Plus className="size-3.5" />
                </div>
                <span className="text-sm font-medium text-ink">
                  {t("addManualSolve")}
                </span>
              </div>
              <button
                onClick={onClose}
                className="grid size-7 place-items-center rounded text-ink-3 hover:bg-surface-2 hover:text-ink transition-colors"
                aria-label={t("close")}
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-5">
              {/* Time */}
              <section className="rounded-lg border border-line bg-surface px-4 py-3.5">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="size-3.5 text-ink-3" />
                  <span className="text-[0.65rem] uppercase tracking-[0.16em] text-ink-3 font-medium">
                    {t("time")}
                  </span>
                  <span
                    className={cn(
                      "ml-auto nums text-[0.62rem]",
                      timeValid ? "text-ink-3" : "text-dnf",
                    )}
                  >
                    {parsed != null && parsed.length > 0
                      ? formatManualPreview(parsed)
                      : "—"}
                  </span>
                </div>
                <Input
                  placeholder={t("timePlaceholder")}
                  inputMode="decimal"
                  maxLength={80}
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="h-10 text-base"
                  autoFocus
                />
                <p className="mt-2 text-[0.6rem] text-ink-3">
                  {t("timeHint")}
                </p>
              </section>

              {/* Scramble */}
              <section className="rounded-lg border border-line bg-surface px-4 py-3.5">
                <div className="flex items-center gap-2 mb-3">
                  <Shuffle className="size-3.5 text-ink-3" />
                  <span className="text-[0.65rem] uppercase tracking-[0.16em] text-ink-3 font-medium">
                    Scramble
                  </span>
                  <button
                    onClick={regenScramble}
                    className="ml-auto flex items-center gap-1 rounded-md border border-line px-2 py-1 text-[0.62rem] text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
                  >
                    <RefreshCw className="size-3" />
                    {t("generate")}
                  </button>
                </div>
                <textarea
                  value={scramble}
                  onChange={(e) => setScramble(e.target.value)}
                  className="min-h-16 w-full resize-none rounded-md border border-line bg-canvas px-3 py-2 font-mono text-xs text-ink placeholder:text-ink-3/50 focus:outline-none focus:border-ink-2"
                  placeholder="R U R' U'..."
                />
              </section>

              {/* Method — only meaningful for events that declare methods
                  (3×3, 3×3 OH). A 2×2 has none, so the picker is hidden. */}
              {defaultMethod !== undefined && (
                <section className="rounded-lg border border-line bg-surface px-4 py-3.5">
                  <div className="flex items-center gap-2 mb-3">
                    <Tag className="size-3.5 text-ink-3" />
                    <span className="text-[0.65rem] uppercase tracking-[0.16em] text-ink-3 font-medium">
                      {t("method")}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {METHODS.map((m) => (
                      <button
                        key={m}
                        onClick={() => setMethod(m)}
                        className={cn(
                          "rounded-md px-2 py-2 text-xs font-medium transition-all",
                          method === m
                            ? "bg-ink text-surface shadow-sm"
                            : "bg-surface-2 text-ink-3 hover:text-ink hover:bg-line",
                        )}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* Penalty */}
              <section className="rounded-lg border border-line bg-surface px-4 py-3.5">
                <div className="flex items-center gap-2 mb-3">
                  <CircleAlert className="size-3.5 text-ink-3" />
                  <span className="text-[0.65rem] uppercase tracking-[0.16em] text-ink-3 font-medium">
                    {t("penalty")}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {PENALTIES.map((p) => {
                    const isDnf = p === "DNF";
                    const isPlus2 = p === "+2";
                    return (
                      <button
                        key={p}
                        onClick={() => setPenalty(p)}
                        className={cn(
                          "rounded-md px-2 py-2 text-xs font-medium transition-all",
                          penalty === p
                            ? isDnf
                              ? "bg-dnf-soft text-dnf ring-1 ring-dnf/30"
                              : isPlus2
                                ? "bg-plus2-soft text-plus2 ring-1 ring-plus2/30"
                                : "bg-ink text-surface shadow-sm"
                            : "bg-surface-2 text-ink-3 hover:text-ink hover:bg-line",
                        )}
                      >
                        {p === "none" ? t("clean") : p}
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Notes */}
              <section className="rounded-lg border border-line bg-surface px-4 py-3.5">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="size-3.5 text-ink-3" />
                  <span className="text-[0.65rem] uppercase tracking-[0.16em] text-ink-3 font-medium">
                    {t("notes")}
                  </span>
                  <span className="ml-auto text-[0.55rem] text-ink-3/50">{t("optional")}</span>
                </div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t("notesPlaceholder")}
                  className="min-h-15 w-full resize-none rounded-md border border-line bg-canvas px-3 py-2 text-xs text-ink placeholder:text-ink-3/50 focus:outline-none focus:border-ink-2"
                />
              </section>
            </div>

            {/* Footer */}
            <div className="flex shrink-0 items-center justify-between border-t border-line bg-canvas px-5 py-3.5">
              <p className="text-[0.6rem] text-ink-3">
                {timeValid && scrambleValid
                  ? t("readyToLog")
                  : t("fillInRequired")}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="h-8 text-xs"
                >
                  {t("cancel")}
                </Button>
                <Button
                  size="sm"
                  onClick={submit}
                  disabled={!canSubmit}
                  className="h-8 text-xs bg-ink text-surface hover:bg-ink/85"
                >
                  {submitting ? t("adding") : t("addSolve")}
                </Button>
              </div>
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
