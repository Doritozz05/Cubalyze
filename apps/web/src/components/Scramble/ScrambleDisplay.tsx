"use client";

import { useState } from "react";
import { Check, Copy, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface ScrambleDisplayProps {
  scramble: string;
  onRegenerate?: () => void;
  onCopy?: () => void;
  indexLabel?: string;
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
  onRegenerate,
  onCopy,
  indexLabel,
  states,
  currentIndex = 0,
  errorMoves = [],
  pendingHalfDouble = false,
  isScrambled = false,
  needsReset = false,
  awaitingSolve = false,
}: ScrambleDisplayProps) {
  const [copied, setCopied] = useState(false);

  const tokens = scramble.trim().split(/\s+/).filter(Boolean);

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
          <p className="text-sm text-amber-400">
            Solve the cube to apply this scramble
          </p>
        </div>
      ) : needsReset ? (
        <div className="flex flex-col items-center justify-center gap-2 py-4">
          <p className="text-sm text-amber-400">
            Too many mistakes — solve the cube to continue
          </p>
        </div>
      ) : errorMoves.length > 0 ? (
        <div
          className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2"
          translate="no"
        >
          {errorMoves.map((m, i) => (
            <span
              key={`err-${i}`}
              className="inline-block origin-center whitespace-nowrap transition-[color,transform] duration-300 text-red-400 scale-100"
            >
              {m}
            </span>
          ))}
        </div>
      ) : (
        <div
          className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2"
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
                  "inline-block origin-center whitespace-nowrap transition-[color,transform] duration-300",
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
