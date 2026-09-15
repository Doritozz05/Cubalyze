"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Copy, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

import type { ScrambleLayoutMode } from "@cubalyze/state";

export interface ScrambleDisplayProps {
  scramble: string;
  /** Orientation-adapted scramble for display (raw scramble used for validation). */
  displayScramble?: string;
  smartCubeConnected?: boolean;
  /**
   * Force verification visuals (per-move gray/black progress + animation)
   * even without a physical smart cube — the virtual cube runs the same
   * scramble validator. Defaults to smartCubeConnected.
   */
  verificationActive?: boolean;
  onRegenerate?: () => void;
  onCopy?: () => void;
  indexLabel?: string;
  /**
   * Extra action rendered first in the actions row (e.g. manual-mode focus
   * toggle). Accepts a function receiving `showLabels` so it can go
   * icon-only in compact-right / compact-down / mobile exactly like
   * Copy/New. Plain ReactNode still supported.
   */
  focusModeAction?: React.ReactNode | ((showLabels: boolean) => React.ReactNode);
  states?: ('pending' | 'correct' | 'incorrect')[];
  currentIndex?: number;
  errorMoves?: string[];
  pendingHalfDouble?: boolean;
  isScrambled?: boolean;
  needsReset?: boolean;
  awaitingSolve?: boolean;
  /**
   * Force the phone (<768px) presentation regardless of the real viewport:
   * no header label/counter/actions row, small wrapping tokens, icon-only
   * Copy/New below. Used by the theme-studio preview's mobile frame.
   */
  compact?: boolean;
  /**
   * Mutually-exclusive layout mode for Timer and Virtual Cube:
   * - 'default': standard responsive layout
   * - 'compact-right': compact scramble tokens with icon-only buttons aligned to the right
   * - 'compact-down': compact scramble tokens with icon-only buttons centered below
   */
  layoutMode?: ScrambleLayoutMode;
  /** Override for the token text-size class (viewport-evaluated px in previews). */
  tokenSizeClass?: string;
  /**
   * Exact token size in px. Inline style, deliberate: Tailwind cannot
   * generate dynamically-interpolated class names.
   */
  tokenSizePx?: number;
}

export function ScrambleDisplay({
  scramble,
  displayScramble,
  smartCubeConnected,
  verificationActive,
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
  compact = false,
  layoutMode = "default",
  tokenSizeClass = "text-[clamp(0.75rem,min(1.6vw,1.9vh),1rem)]",
  tokenSizePx,
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

  // Move verification states (3 sizes: resolved small + muted, active
  // large, remaining normal) trigger when a smart cube is connected OR
  // verification is explicitly active (the virtual cube runs the same
  // scramble validator) AND non-empty verification states are present.
  // Otherwise, scramble tokens display cleanly in solid text (text-ink).
  // Active and remaining share the same color — only size differs.
  // Resolved moves shrink to small muted gray; a just-resolved move
  // flashes ready-green while shrinking, then settles to muted.
  const isVerificationActive =
    (verificationActive ?? Boolean(smartCubeConnected)) &&
    Array.isArray(states) &&
    states.length > 0;

  // Flash index: the move that just transitioned active -> resolved.
  // Shows ready-green briefly while shrinking elegantly, then settles
  // to the muted resolved style. `flashGen` bumps per completion so the
  // flash animation replays via remount on flash START, while the key
  // stays stable when the flash ENDS — no remount, no flicker: the
  // keyframe end state mirrors the steady resolved class exactly.
  const [flashIndex, setFlashIndex] = useState<number | null>(null);
  const [flashGen, setFlashGen] = useState<Record<number, number>>({});
  const prevIndexRef = useRef(currentIndex);
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const prev = prevIndexRef.current;
    if (currentIndex > prev && isVerificationActive) {
      const done = currentIndex - 1;
      setFlashGen((g) => ({ ...g, [done]: (g[done] ?? 0) + 1 }));
      setFlashIndex(done);
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      flashTimeoutRef.current = setTimeout(() => setFlashIndex(null), 700);
    } else if (currentIndex < prev || !isVerificationActive) {
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      setFlashIndex(null);
    }
    prevIndexRef.current = currentIndex;
    return () => {
      if (currentIndex < prev && flashTimeoutRef.current) {
        clearTimeout(flashTimeoutRef.current);
      }
    };
  }, [currentIndex, isVerificationActive]);

  // New scramble: clear any lingering flash.
  useEffect(() => {
    setFlashIndex(null);
    setFlashGen({});
    prevIndexRef.current = 0;
  }, [displayScramble ?? scramble]);

  useEffect(
    () => () => {
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    },
    [],
  );

  const isCompactRight = layoutMode === "compact-right";
  const isCompactDown = layoutMode === "compact-down";
  const isCustomCompact = isCompactRight || isCompactDown;

  // Render actions. When showLabels is false, text labels are hidden everywhere (icon-only).
  const renderActions = (showLabels: boolean) => (
    <>
      {typeof focusModeAction === "function" ? focusModeAction(showLabels) : focusModeAction}
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
        {showLabels && <span className="max-lg:hidden">{copied ? t("copied") : t("copy")}</span>}
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
          {showLabels && <span className="max-lg:hidden">{t("new")}</span>}
        </Button>
      ) : null}
    </>
  );

  const isCompactLayout = compact || isCustomCompact;
  const headerMetaHidden = isCompactLayout ? "hidden" : "max-lg:hidden";
  const tokensClass = isCompactLayout
    ? "flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1.5"
    : "flex flex-wrap items-center justify-center gap-x-4 gap-y-2 max-lg:gap-x-2.5 max-lg:gap-y-1.5";
  const tokenText = isCompactLayout ? "text-sm" : tokenSizeClass;

  const renderTokens = () => {
    if (awaitingSolve) {
      return (
        <div className="flex flex-col items-center justify-center gap-2 py-2">
          <p className="text-sm text-caution">{t("solveToApply")}</p>
        </div>
      );
    }
    if (needsReset) {
      return (
        <div className="flex flex-col items-center justify-center gap-2 py-2">
          <p className="text-sm text-caution">{t("tooManyMistakes")}</p>
        </div>
      );
    }
    if (errorMoves.length > 0) {
      return (
        <div
          className={cn(tokensClass, tokenText)}
          style={tokenSizePx != null ? { fontSize: tokenSizePx } : undefined}
          translate="no"
        >
          {errorMoves.map((m, i) => (
            <span
              key={`err-${i}`}
              className="whitespace-nowrap text-dnf"
            >
              {m}
            </span>
          ))}
        </div>
      );
    }
    return (
      <div
        className={cn(tokensClass, tokenText)}
        style={tokenSizePx != null ? { fontSize: tokenSizePx } : undefined}
        translate="no"
      >
        {tokens.map((tok, i) => {
          const state = isVerificationActive ? states?.[i] || "pending" : "normal";
          const isCompleted = isVerificationActive && state === "correct";
          const isActive = isVerificationActive && i === currentIndex;
          const isFlashing = isVerificationActive && flashIndex === i && isCompleted;

          return (
            <span
              // Remount when active toggles or a new flash starts on this
              // index so the pop / flash keyframes replay. Flash end keeps
              // the same key (flashGen stable) for a seamless handoff.
              // NOTE: sizes via font-size on the floating visual copy, never
              // scale — scale raster-blurs glyphs. The hidden placeholder
              // owns the layout at constant base size, so siblings and rows
              // never shift during animations. Base size lives on the
              // container (tokenText / tokenSizePx); copies size in em.
              key={`${tok}-${i}-${isActive ? "active" : "idle"}-f${flashGen[i] ?? 0}`}
              className="scr-token"
            >
              <span aria-hidden="true" className="scr-token-ph">
                {tok}
              </span>
              <span
                className={cn(
                  "scr-token-vis",
                  !isVerificationActive && "text-ink scramble-size-pending",
                  isVerificationActive &&
                    isFlashing &&
                    "text-ready scr-token-vis-top scramble-done-anim",
                  isVerificationActive &&
                    isCompleted &&
                    !isFlashing &&
                    "text-ink-3 opacity-70 scramble-size-done",
                  isVerificationActive &&
                    isActive &&
                    !isCompleted &&
                    pendingHalfDouble &&
                    "text-ink scr-token-vis-top scramble-size-active scramble-active-anim animate-pulse",
                  isVerificationActive &&
                    isActive &&
                    !isCompleted &&
                    !pendingHalfDouble &&
                    "text-ink scr-token-vis-top scramble-size-active scramble-active-anim",
                  isVerificationActive &&
                    !isCompleted &&
                    !isActive &&
                    "text-ink scramble-size-pending",
                )}
              >
                {tok}
              </span>
            </span>
          );
        })}
      </div>
    );
  };

  if (isCompactRight) {
    return (
      <div className="relative w-full" data-onboarding-target="timer">
        {/* Scramble tokens remain perfectly centered; actions and ready indicator live on the right without shifting the scramble */}
        <div className="w-full">
          {renderTokens()}
        </div>
        <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {isScrambled && (
            <span
              className="flex shrink-0 items-center text-ready"
              title={t("ready")}
              aria-label={t("ready")}
            >
              <Check className="size-4" />
            </span>
          )}
          {renderActions(false)}
        </div>
      </div>
    );
  }

  if (isCompactDown) {
    return (
      <div className="w-full" data-onboarding-target="timer">
        {/* Scramble tokens remain perfectly centered; green check icon sits right next to the scramble with padding, without pushing it */}
        <div className="flex items-center justify-center">
          <div className="relative inline-block max-w-full">
            {renderTokens()}
            {isScrambled && (
              <div className="pointer-events-none absolute left-[calc(100%+0.5rem)] top-1/2 -translate-y-1/2 flex items-center">
                <span
                  className="flex shrink-0 items-center text-ready"
                  title={t("ready")}
                  aria-label={t("ready")}
                >
                  <Check className="size-4" />
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="mt-2 flex items-center justify-center gap-1">
          {renderActions(false)}
        </div>
      </div>
    );
  }

  // Default layout
  return (
    <div className="w-full" data-onboarding-target="timer">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* The "Scramble" label and #N counter are desktop/tablet-only — on
              phones (<768px) the tokens stand alone above the timer, so the
              whole top line is dropped to keep the stage clean. */}
          <span className={cn(headerMetaHidden, "text-[0.7rem] uppercase tracking-[0.2em] text-ink-3")}>
            Scramble
          </span>
          {indexLabel ? (
            <span className={cn(headerMetaHidden, "nums text-[0.7rem] text-ink-3")}>
              {indexLabel}
            </span>
          ) : null}
          {isScrambled ? (
            <span className="text-[0.7rem] uppercase tracking-[0.2em] text-ready flex items-center gap-1">
              <Check className="size-3" /> {t("ready")}
            </span>
          ) : null}
        </div>
        <div className={cn("flex items-center gap-1", headerMetaHidden)}>
          {renderActions(true)}
        </div>
      </div>

      {renderTokens()}

      {/* Mobile-only (<768px): Copy/New sit BELOW the scramble instead of
          above it (the header row hides them at max-lg). Centered, icon-only. */}
      <div className={cn("mt-2.5 flex items-center justify-center gap-1", compact ? undefined : "lg:hidden")}>
        {renderActions(false)}
      </div>
    </div>
  );
}
