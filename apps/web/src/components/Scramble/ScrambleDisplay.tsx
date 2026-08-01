"use client";

import { useState } from "react";
import { Check, Copy, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface ScrambleDisplayProps {
  scramble: string;
  /** Orientation-adapted scramble for display (raw scramble used for validation). */
  displayScramble?: string;
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

  return (
    <div className="w-full">
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
              <Check className="size-3" /> Ready
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
            aria-label="Copy scramble"
          >
            {copied ? (
              <Check className="size-3.5 text-ready" />
            ) : (
              <Copy className="size-3.5" />
            )}
            {copied ? "Copied" : "Copy"}
          </Button>
          {onRegenerate ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRegenerate}
              className="h-7 gap-1.5 px-2 text-xs text-ink-2 hover:text-ink"
              aria-label="New scramble"
            >
              <RefreshCw className="size-3.5" />
              New
            </Button>
          ) : null}
        </div>
      </div>

      {awaitingSolve ? (
        <div className="flex flex-col items-center justify-center gap-2 py-4">
          <p className="text-sm text-caution">
            Solve the cube to apply this scramble
          </p>
        </div>
      ) : needsReset ? (
        <div className="flex flex-col items-center justify-center gap-2 py-4">
          <p className="text-sm text-caution">
            Too many mistakes — solve the cube to continue
          </p>
        </div>
      ) : errorMoves.length > 0 ? (
        <div
          // Touch (<1024px): larger tokens in a single horizontally-scrollable
          // row so long scrambles stay readable without pushing the timer down.
          // Desktop keeps the wrap layout untouched.
          className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 max-lg:flex-nowrap max-lg:justify-start max-lg:gap-x-3 max-lg:overflow-x-auto max-lg:py-1"
          translate="no"
        >
          {errorMoves.map((m, i) => (
            <span
              key={`err-${i}`}
              className="inline-block origin-center whitespace-nowrap transition-[color,transform] duration-300 text-dnf scale-100 max-lg:text-lg"
            >
              {m}
            </span>
          ))}
        </div>
      ) : (
        <div
          // Touch (<1024px): larger tokens in a single horizontally-scrollable
          // row so long scrambles stay readable without pushing the timer down.
          // Desktop keeps the wrap layout untouched.
          className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 max-lg:flex-nowrap max-lg:justify-start max-lg:gap-x-3 max-lg:overflow-x-auto max-lg:py-1"
          translate="no"
        >
          {tokens.map((tok, i) => {
            const state = states?.[i] || 'pending';
            const isCompleted = state === 'correct';
            const isActive = i === currentIndex;

            return (
              <span
                key={`${tok}-${i}`}
                className={cn(
                  "inline-block origin-center whitespace-nowrap transition-[color,transform] duration-300 max-lg:text-lg",
                  isCompleted && "text-ink-3 scale-110",
                  isActive && !isCompleted && pendingHalfDouble && "text-ink scale-100 animate-pulse",
                  isActive && !isCompleted && !pendingHalfDouble && "text-ink scale-100",
                  !isCompleted && !isActive && "text-ink/40 scale-95",
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
