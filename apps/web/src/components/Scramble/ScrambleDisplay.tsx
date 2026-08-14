"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Copy, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface ScrambleDisplayProps {
  scramble: string;
  /** Orientation-adapted scramble for display (raw scramble used for validation). */
  displayScramble?: string;
  smartCubeConnected?: boolean;
  onRegenerate?: () => void;
  onCopy?: () => void;
  indexLabel?: string;
  focusModeAction?: React.ReactNode;
  states?: ('pending' | 'correct' | 'incorrect')[];
  currentIndex?: number;
  errorMoves?: string[];
  pendingHalfDouble?: boolean;
  isScrambled?: boolean;
  needsReset?: boolean;
  awaitingSolve?: boolean;
}

export function ScrambleDisplay({
  scramble,
  displayScramble,
  smartCubeConnected,
  onRegenerate,
  onCopy,
  indexLabel,
  focusModeAction,
  states,
  currentIndex = 0,
  errorMoves = [],
  pendingHalfDouble = false,
  isScrambled = false,
  needsReset = false,
  awaitingSolve = false,
}: ScrambleDisplayProps) {
  const { t } = useTranslation("timer");
  const [copied, setCopied] = useState(false);

  // Use displayScramble for rendering tokens when available (orientation-adapted),
  // fall back to raw scramble. Validation states still index into raw scramble.
  const displayText = displayScramble ?? scramble;
  const tokens = displayText.trim().split(/\s+/).filter(Boolean);

  const copy = () => {
    onCopy?.();
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  // Move verification states (black & gray progress) trigger strictly when a
  // SmartCube is connected AND non-empty verification states are active.
  // Otherwise, scramble tokens display cleanly in solid black text (text-ink)
  // without opacity reduction.
  const isVerificationActive =
    Boolean(smartCubeConnected) && Array.isArray(states) && states.length > 0;

  return (
    <div className="w-full" data-onboarding-target="timer">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[0.7rem] uppercase tracking-[0.2em] text-ink-3">
            Scramble
          </span>
          {indexLabel ? (
            <span className="nums text-[0.7rem] text-ink-3">{indexLabel}</span>
          ) : null}
          {isScrambled ? (
            <span className="text-[0.7rem] uppercase tracking-[0.2em] text-ready flex items-center gap-1">
              <Check className="size-3" /> {t("ready")}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          {focusModeAction}
          <Button
            variant="ghost"
            size="sm"
            onClick={copy}
            className="h-7 gap-1.5 px-2 text-xs text-ink-2 hover:text-ink"
            aria-label={t("copyScramble")}
          >
            {copied ? (
              <Check className="size-3.5 text-ready" />
            ) : (
              <Copy className="size-3.5" />
            )}
            <span className="max-lg:hidden">{copied ? t("copied") : t("copy")}</span>
          </Button>
          {onRegenerate ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRegenerate}
              className="h-7 gap-1.5 px-2 text-xs text-ink-2 hover:text-ink"
              aria-label={t("newScramble")}
            >
              <RefreshCw className="size-3.5" />
              <span className="max-lg:hidden">{t("new")}</span>
            </Button>
          ) : null}
        </div>
      </div>

      {awaitingSolve ? (
        <div className="flex flex-col items-center justify-center gap-2 py-4">
          <p className="text-sm text-caution">
            {t("solveToApply")}
          </p>
        </div>
      ) : needsReset ? (
        <div className="flex flex-col items-center justify-center gap-2 py-4">
          <p className="text-sm text-caution">
            {t("tooManyMistakes")}
          </p>
        </div>
      ) : errorMoves.length > 0 ? (
        <div
          // Touch (<1024px): smaller tokens that wrap so the full scramble
          // fits on screen with zero horizontal scroll. Desktop unchanged.
          className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 max-lg:gap-x-2.5 max-lg:gap-y-1.5"
          translate="no"
        >
          {errorMoves.map((m, i) => (
            <span
              key={`err-${i}`}
              className="inline-block origin-center whitespace-nowrap transition-[color,transform] duration-300 text-dnf scale-100 max-lg:text-sm"
            >
              {m}
            </span>
          ))}
        </div>
      ) : (
        <div
          // Touch (<1024px): smaller tokens that wrap so the full scramble
          // fits on screen with zero horizontal scroll. Desktop unchanged.
          className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 max-lg:gap-x-2.5 max-lg:gap-y-1.5"
          translate="no"
        >
          {tokens.map((tok, i) => {
            const state = isVerificationActive ? (states?.[i] || 'pending') : 'normal';
            const isCompleted = isVerificationActive && state === 'correct';
            const isActive = isVerificationActive && i === currentIndex;

            return (
              <span
                key={`${tok}-${i}`}
                className={cn(
                  "inline-block origin-center whitespace-nowrap transition-[color,transform] duration-300 max-lg:text-sm",
                  !isVerificationActive && "text-ink scale-100",
                  isVerificationActive && isCompleted && "text-ink-3 scale-110",
                  isVerificationActive && isActive && !isCompleted && pendingHalfDouble && "text-ink scale-100 animate-pulse",
                  isVerificationActive && isActive && !isCompleted && !pendingHalfDouble && "text-ink scale-100",
                  isVerificationActive && !isCompleted && !isActive && "text-ink/40 scale-95",
                )}
              >
                {tok}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
