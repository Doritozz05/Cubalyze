"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Plus, RefreshCw, X, Clock, Shuffle, Tag, FileText, CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Penalty, SolveMethod, SolveMethod as _SM } from "@/types";
import { RandomStateGenerator } from "@cubeforge/solver-engine";
import { getMin2PhaseSolver } from "@/utils/puzzleUtils";
import {
  formatManualPreview,
  parseTimeInput,
} from "@/utils/parseTimeInput";
import { toast } from "sonner";

export interface ManualSolveSheetProps {
  open: boolean;
  onClose: () => void;
  /** Pre-fill when adding a solve for a specific scramble (e.g. Review). */
  initialScramble?: string;
  defaultMethod: SolveMethod;
  /** Submit handler called with the parsed fields. */
  onSubmit: (input: {
    time: number;
    scramble: string;
    method: SolveMethod;
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
  const [time, setTime] = useState("");
  const [scramble, setScramble] = useState(initialScramble ?? "");
  const [method, setMethod] = useState<SolveMethod>(defaultMethod);
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
        parsed.length > 1 ? `${parsed.length} solves logged` : "Solve logged",
      );
      onClose();
    } catch (e) {
      toast.error("Couldn't add solve");
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
            className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-95 flex-col border-l border-line bg-canvas shadow-2xl"
            aria-label="Manual solve"
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <div className="grid size-7 place-items-center rounded-md bg-ink text-surface">
                  <Plus className="size-3.5" />
                </div>
                <span className="text-sm font-medium text-ink">
                  Add manual solve
                </span>
              </div>
              <button
                onClick={onClose}
                className="grid size-7 place-items-center rounded text-ink-3 hover:bg-surface-2 hover:text-ink transition-colors"
                aria-label="Close"
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
                    Time
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
                  placeholder="e.g. 12.34, 1450, 1:23.45"
                  inputMode="decimal"
                  maxLength={80}
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="h-10 text-base"
                  autoFocus
                />
                <p className="mt-2 text-[0.6rem] text-ink-3">
                  Integers are centiseconds ({" "}
                  <code className="rounded bg-surface-2 px-1 py-0.5 text-[0.58rem]">10</code> → 0.10s,{" "}
                  <code className="rounded bg-surface-2 px-1 py-0.5 text-[0.58rem]">1450</code> → 14.50s). Add{" "}
                  <code className="rounded bg-surface-2 px-1 py-0.5 text-[0.58rem]">DNF</code> or{" "}
                  <code className="rounded bg-surface-2 px-1 py-0.5 text-[0.58rem]">15.50+</code>; separate several with commas.
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
                    Generate
                  </button>
                </div>
                <textarea
                  value={scramble}
                  onChange={(e) => setScramble(e.target.value)}
                  className="min-h-16 w-full resize-none rounded-md border border-line bg-canvas px-3 py-2 font-mono text-xs text-ink placeholder:text-ink-3/50 focus:outline-none focus:border-ink-2"
                  placeholder="R U R' U'..."
                />
              </section>

              {/* Method */}
              <section className="rounded-lg border border-line bg-surface px-4 py-3.5">
                <div className="flex items-center gap-2 mb-3">
                  <Tag className="size-3.5 text-ink-3" />
                  <span className="text-[0.65rem] uppercase tracking-[0.16em] text-ink-3 font-medium">
                    Method
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
                          : "bg-surface-2 text-ink-3 hover:text-ink hover:bg-surface-2/80",
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </section>

              {/* Penalty */}
              <section className="rounded-lg border border-line bg-surface px-4 py-3.5">
                <div className="flex items-center gap-2 mb-3">
                  <CircleAlert className="size-3.5 text-ink-3" />
                  <span className="text-[0.65rem] uppercase tracking-[0.16em] text-ink-3 font-medium">
                    Penalty
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
                            : "bg-surface-2 text-ink-3 hover:text-ink hover:bg-surface-2/80",
                        )}
                      >
                        {p === "none" ? "Clean" : p}
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
                    Notes
                  </span>
                  <span className="ml-auto text-[0.55rem] text-ink-3/50">optional</span>
                </div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. focus on lookahead"
                  className="min-h-15 w-full resize-none rounded-md border border-line bg-canvas px-3 py-2 text-xs text-ink placeholder:text-ink-3/50 focus:outline-none focus:border-ink-2"
                />
              </section>
            </div>

            {/* Footer */}
            <div className="flex shrink-0 items-center justify-between border-t border-line bg-canvas px-5 py-3.5">
              <p className="text-[0.6rem] text-ink-3">
                {timeValid && scrambleValid
                  ? "Ready to log"
                  : "Fill in time and scramble"}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="h-8 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={submit}
                  disabled={!canSubmit}
                  className="h-8 text-xs bg-ink text-surface hover:bg-ink/85"
                >
                  {submitting ? "Adding…" : "Add solve"}
                </Button>
              </div>
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
