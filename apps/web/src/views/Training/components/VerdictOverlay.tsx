"use client";

import { motion } from "framer-motion";
import { Check, X } from "lucide-react";

/**
 * Overlay shown after a timed training attempt completes.
 * Displays time, TPS, and Correct / Incorrect / Skip buttons.
 *
 * The parent should wrap this in AnimatePresence and
 * conditionally render based on a "show" state.
 */

export interface VerdictOverlayProps {
  /** Formatted time string (e.g. "1.23") */
  timeDisplay: string;
  /** TPS string (e.g. "4.5") */
  tpsDisplay: string;
  onCorrect: () => void;
  onIncorrect: () => void;
  onSkip: () => void;
}

export function VerdictOverlay({
  timeDisplay,
  tpsDisplay,
  onCorrect,
  onIncorrect,
  onSkip,
}: VerdictOverlayProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10 rounded-xl bg-surface/98"
    >
      <span className="nums text-[2.5rem] sm:text-[3rem] font-bold text-ink tracking-tight">
        {timeDisplay}
      </span>
      <span className="nums text-[0.75rem] text-ink-3">
        TPS {tpsDisplay}
      </span>
      <div className="flex gap-3 mt-2">
        <button
          onClick={onIncorrect}
          className="inline-flex items-center gap-2 rounded-xl border-2 border-hold/30 bg-hold-soft/40 px-6 py-3 text-[0.85rem] font-semibold text-hold hover:bg-hold-soft/60 hover:border-hold/50 transition-all"
        >
          <X className="size-5" />
          Incorrect
        </button>
        <button
          onClick={onCorrect}
          className="inline-flex items-center gap-2 rounded-xl border-2 border-ready/30 bg-ready-soft/40 px-6 py-3 text-[0.85rem] font-semibold text-ready hover:bg-ready-soft/60 hover:border-ready/50 transition-all"
        >
          <Check className="size-5" />
          Correct
        </button>
      </div>
      <button
        onClick={onSkip}
        className="text-[0.62rem] text-ink-3 hover:text-ink mt-1 transition-colors"
      >
        Skip without recording
      </button>
    </motion.div>
  );
}
