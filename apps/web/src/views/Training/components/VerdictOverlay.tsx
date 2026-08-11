"use client";

import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "framer-motion";
import { Check, X } from "lucide-react";
import { useAnnounce } from "@/lib/announce";

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
  const { t } = useTranslation("training");
  const reduceMotion = useReducedMotion();
  // The overlay is transient and positioned over the timer — announce the
  // attempt result so screen-reader users get the verdict, not just a pause.
  useAnnounce(t("verdict.announce", { time: timeDisplay, tps: tpsDisplay }));

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0 }}
      transition={reduceMotion ? { duration: 0 } : undefined}
      className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10 rounded-xl bg-surface/98"
    >
      {/* Touch: fluid clamp so the big numeral never overflows narrow screens. */}
      <span className="nums text-[2.5rem] sm:text-[3rem] max-lg:text-[clamp(2rem,12vw,3rem)] font-bold text-ink tracking-tight">
        {timeDisplay}
      </span>
      <span className="nums text-[0.75rem] text-ink-3">
        {t("verdict.tps", { tps: tpsDisplay })}
      </span>
      {/* Touch: full-width equal buttons; desktop keeps natural width. */}
      <div className="flex gap-3 mt-2 max-lg:w-full max-lg:max-w-xs">
        <button
          onClick={onIncorrect}
          className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-hold/30 bg-hold-soft/40 px-6 py-3 text-[0.85rem] font-semibold text-hold hover:bg-hold-soft/60 hover:border-hold/50 transition-all max-lg:flex-1 max-lg:px-4 max-lg:h-12 max-lg:text-[0.8rem]"
        >
          <X className="size-5" />
          {t("verdict.incorrect")}
        </button>
        <button
          onClick={onCorrect}
          className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-ready/30 bg-ready-soft/40 px-6 py-3 text-[0.85rem] font-semibold text-ready hover:bg-ready-soft/60 hover:border-ready/50 transition-all max-lg:flex-1 max-lg:px-4 max-lg:h-12 max-lg:text-[0.8rem]"
        >
          <Check className="size-5" />
          {t("verdict.correct")}
        </button>
      </div>
      <button
        onClick={onSkip}
        className="text-[0.62rem] text-ink-3 hover:text-ink mt-1 transition-colors"
      >
        {t("verdict.skip")}
      </button>
    </motion.div>
  );
}
