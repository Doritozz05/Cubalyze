"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Penalty, SolveMethod, SolveMethod as _SM } from "@/types";
import { RandomStateGenerator, Min2PhaseSolver } from "@cubeforge/solver-engine";
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
          RandomStateGenerator.generateScramble(new Min2PhaseSolver()),
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
    setScramble(RandomStateGenerator.generateScramble(new Min2PhaseSolver()));
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
            className="fixed inset-0 z-40 bg-ink/40"
            onClick={onClose}
          />
          {/* Sheet */}
          <motion.aside
            key="sheet"
            initial={{ x: 360, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 360, opacity: 0 }}
            transition={{ type: "spring", stiffness: 360, damping: 32 }}
            className="fixed right-0 top-0 z-50 flex h-screen w-[360px] flex-col overflow-hidden border-l border-line bg-surface shadow-2xl"
            aria-label="Manual solve"
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-3">
              <div className="flex items-center gap-2">
                <Plus className="size-4 text-ink-2" />
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
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
              {/* Time */}
              <div className="flex flex-col gap-1.5">
                <label className="flex items-center justify-between">
                  <span className="text-[0.65rem] uppercase tracking-[0.16em] text-ink-3 font-medium">
                    Time
                  </span>
                  <span
                    className={cn(
                      "nums text-[0.62rem]",
                      timeValid ? "text-ink-3" : "text-dnf",
                    )}
                  >
                    {parsedMs != null && timeValid
                      ? `${(parsedMs / 1000).toFixed(2)} s`
                      : "—"}
                  </span>
                </label>
                <Input
                  placeholder="e.g. 12.34"
                  inputMode="decimal"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="h-10 text-base"
                  autoFocus
                />
                <p className="text-[0.62rem] text-ink-3">
                  Accepts <code>ss.cs</code> or <code>m:ss.cs</code>.
                </p>
              </div>

              {/* Scramble */}
              <div className="flex flex-col gap-1.5">
                <label className="flex items-center justify-between">
                  <span className="text-[0.65rem] uppercase tracking-[0.16em] text-ink-3 font-medium">
                    Scramble
                  </span>
                  <button
                    onClick={regenScramble}
                    className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.62rem] text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
                  >
                    <RefreshCw className="size-3" />
                    Generate
                  </button>
                </label>
                <textarea
                  value={scramble}
                  onChange={(e) => setScramble(e.target.value)}
                  className="min-h-[64px] resize-none rounded-md border border-line bg-surface px-3 py-2 text-xs text-ink focus:outline-none focus:border-ink-2"
                />
              </div>

              {/* Method */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[0.65rem] uppercase tracking-[0.16em] text-ink-3 font-medium">
                  Method
                </span>
                <div className="flex overflow-hidden rounded-md border border-line text-xs">
                  {METHODS.map((m, i) => (
                    <button
                      key={m}
                      onClick={() => setMethod(m)}
                      className={cn(
                        "flex-1 px-2 py-1.5 transition-colors",
                        i !== 0 && "border-l border-line",
                        method === m
                          ? "bg-ink text-surface"
                          : "bg-surface text-ink-3 hover:text-ink-2",
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Penalty */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[0.65rem] uppercase tracking-[0.16em] text-ink-3 font-medium">
                  Penalty
                </span>
                <div className="flex overflow-hidden rounded-md border border-line text-xs">
                  {PENALTIES.map((p, i) => (
                    <button
                      key={p}
                      onClick={() => setPenalty(p)}
                      className={cn(
                        "flex-1 px-2 py-1.5 transition-colors",
                        i !== 0 && "border-l border-line",
                        penalty === p
                          ? "bg-ink text-surface"
                          : "bg-surface text-ink-3 hover:text-ink-2",
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[0.65rem] uppercase tracking-[0.16em] text-ink-3 font-medium">
                  Notes (optional)
                </span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. focus on lookahead"
                  className="min-h-[60px] resize-none rounded-md border border-line bg-surface px-3 py-2 text-xs text-ink focus:outline-none focus:border-ink-2"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-line bg-surface-2 px-4 py-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={submit}
                disabled={!canSubmit}
                className="h-8"
              >
                {submitting ? "Adding…" : "Add solve"}
              </Button>
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
