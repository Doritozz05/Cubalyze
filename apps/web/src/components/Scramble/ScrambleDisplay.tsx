"use client";

import { useState } from "react";
import { Check, Copy, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface ScrambleDisplayProps {
  scramble: string;
  /** Called when the user requests a new scramble. */
  onRegenerate?: () => void;
  /** Called when the user copies the scramble (lifted, for the C shortcut). */
  onCopy?: () => void;
  /** Optional index label, e.g. "#7". */
  indexLabel?: string;
  /** Validation states for each move */
  states?: ('pending' | 'correct' | 'incorrect')[];
}

/**
 * Renders WCA scramble notation in a readable, monospaced, wrapping block.
 * Tokens are split so future coloring by move family is trivial.
 */
export function ScrambleDisplay({
  scramble,
  onRegenerate,
  onCopy,
  indexLabel,
  states,
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

      <p
        className={cn(
          "nums flex flex-wrap gap-x-2.5 gap-y-1 text-lg leading-relaxed text-ink sm:text-xl",
        )}
      >
        {tokens.map((tok, i) => {
          const state = states?.[i] || 'pending';
          return (
            <span 
              key={`${tok}-${i}`} 
              className={cn(
                "whitespace-nowrap transition-colors duration-200",
                state === 'correct' && "text-ready",
                state === 'incorrect' && "text-destructive",
                state === 'pending' && "text-ink"
              )}
            >
              {tok}
            </span>
          );
        })}
      </p>
    </div>
  );
}
