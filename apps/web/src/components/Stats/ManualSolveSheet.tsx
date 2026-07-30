"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, RefreshCw, X, Clock, Shuffle, Tag, FileText, CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Penalty, SolveMethod, SolveMethod as _SM } from "@/types";
import { RandomStateGenerator } from "@cubeforge/solver-engine";
import { getMin2PhaseSolver } from "@/utils/puzzleUtils";
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
 * Parse a time string into milliseconds. Accepts:
 *  - "12.34"     → 12340 ms
 *  - "1:23.45"   → 83450 ms
 *  - "1:02.03"   → 62030 ms
 *  - "75"        → 75000 ms
 * Returns null if invalid.
 */
function parseTime(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.includes(":")) {
    const parts = trimmed.split(":");
    if (parts.length !== 2) return null;
    const m = Number(parts[0]);
    const s = Number(parts[1]);
    if (!Number.isFinite(m) || !Number.isFinite(s) || m < 0 || s < 0)
      return null;
    return Math.round(m * 60_000 + s * 1000);
  }
  if (trimmed.includes(".")) {
    const [secStr, csStr = ""] = trimmed.split(".");
    const sec = Number(secStr);
    const csExp = Math.pow(10, csStr.length || 0);
    const cs = Number(csStr);
    if (!Number.isFinite(sec) || !Number.isFinite(cs) || sec < 0 || cs < 0)
      return null;
    return Math.round(sec * 1000 + (cs / csExp) * 1000);
  }
  const sec = Number(trimmed);
  if (!Number.isFinite(sec) || sec < 0) return null;
  return Math.round(sec * 1000);
}

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

  const parsedMs = useMemo(() => parseTime(time), [time]);
  const timeValid =
    parsedMs != null && parsedMs > 0 && parsedMs <= 600_000; // cap at 10 min
  const scrambleValid = scramble.trim().length > 0;
  const canSubmit = timeValid && scrambleValid && !submitting;

  const regenScramble = () => {
    setScramble(RandomStateGenerator.generateScramble(getMin2PhaseSolver()));
  };

  const submit = async () => {
    if (!canSubmit || parsedMs == null) return;
    setSubmitting(true);
    try {
      await onSubmit({
        time: parsedMs,
        scramble: scramble.trim(),
        method,
        notes: notes.trim(),
        penalty,
      });
      toast.success("Solve logged");
      onClose();
    } catch (e) {
      toast.error("Couldn't add solve");
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

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
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-black/40"
            onClick={onClose}
          />
          {/* Sheet */}
          <motion.aside
            key="sheet"
            initial={{ x: 360, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 360, opacity: 0 }}
            transition={{ type: "spring", stiffness: 360, damping: 32 }}
            className="fixed right-0 top-0 z-50 flex h-screen w-[380px] flex-col border-l border-line bg-canvas shadow-2xl"
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
                    {parsedMs != null && timeValid
                      ? `${(parsedMs / 1000).toFixed(2)} s`
                      : "—"}
                  </span>
                </div>
                <Input
                  placeholder="e.g. 12.34"
                  inputMode="decimal"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="h-10 text-base"
                  autoFocus
                />
                <p className="mt-2 text-[0.6rem] text-ink-3">
                  Accepts <code className="rounded bg-surface-2 px-1 py-0.5 text-[0.58rem]">ss.cs</code> or{" "}
                  <code className="rounded bg-surface-2 px-1 py-0.5 text-[0.58rem]">m:ss.cs</code>.
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
                  className="min-h-[64px] w-full resize-none rounded-md border border-line bg-canvas px-3 py-2 font-mono text-xs text-ink placeholder:text-ink-3/50 focus:outline-none focus:border-ink-2"
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
                  className="min-h-[60px] w-full resize-none rounded-md border border-line bg-canvas px-3 py-2 text-xs text-ink placeholder:text-ink-3/50 focus:outline-none focus:border-ink-2"
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
