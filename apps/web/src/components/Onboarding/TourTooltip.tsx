"use client";

import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type ArrowSide = "top" | "bottom" | "left" | "right";

// Horizontal centering of the top/bottom arrows is driven by an inline `left`
// (see arrowOffset below) so a viewport-clamped card still points at the
// target; only the vertical edge and border sides stay in the class.
const ARROW_STYLES: Record<ArrowSide, string> = {
  top: "-top-1 border-t border-l",
  bottom: "-bottom-1 border-b border-r",
  left: "-left-1 top-1/2 -translate-y-1/2 border-l border-b",
  right: "-right-1 top-1/2 -translate-y-1/2 border-r border-t",
};

// size-2.5 → 10px arrow; half of that centers the span on arrowOffset.
const ARROW_HALF = 5;
// Fallback arrow center: the card is w-[21rem] (336px).
const ARROW_CENTER_FALLBACK = 336 / 2;

interface TourTooltipProps {
  title: string;
  body: string;
  stepIndex: number;
  totalSteps: number;
  isFirst: boolean;
  isLast: boolean;
  isTouch: boolean;
  arrowSide?: ArrowSide;
  /** Arrow center, px from the tooltip's left edge (top/bottom arrows only). */
  arrowOffset?: number;
  titleId: string;
  bodyId: string;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

/**
 * Tour card: eyebrow + progress dots, title, one-line body and the action row.
 * The final step's primary button reads "Done" (onNext completes the tour).
 */
export function TourTooltip({
  title,
  body,
  stepIndex,
  totalSteps,
  isFirst,
  isLast,
  isTouch,
  arrowSide,
  arrowOffset,
  titleId,
  bodyId,
  onNext,
  onBack,
  onSkip,
}: TourTooltipProps) {
  const { t } = useTranslation("onboarding");
  const touchBtn = isTouch ? "h-11" : "";

  return (
    <div
      className={cn(
        "relative w-[21rem] max-w-[calc(100vw-2rem)] rounded-xl border border-line bg-surface p-5 shadow-sm",
        isTouch && "w-full",
      )}
    >
      {arrowSide ? (
        <span
          aria-hidden="true"
          className={cn(
            "absolute size-2.5 rotate-45 border-line bg-surface",
            ARROW_STYLES[arrowSide],
          )}
          style={
            arrowSide === "left" || arrowSide === "right"
              ? undefined
              : { left: (arrowOffset ?? ARROW_CENTER_FALLBACK) - ARROW_HALF }
          }
        />
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <span className="text-[0.62rem] uppercase tracking-[0.18em] text-ink-3">
          {t("stepOf", { current: stepIndex + 1, total: totalSteps })}
        </span>
        <div className="flex items-center gap-1" aria-hidden="true">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "size-1.5 rounded-full transition-colors duration-200",
                i === stepIndex ? "bg-ink" : "bg-line-2",
              )}
            />
          ))}
        </div>
      </div>

      <h3 id={titleId} className="mt-2.5 text-base font-semibold text-ink">
        {title}
      </h3>
      <p id={bodyId} className="mt-1.5 text-sm leading-relaxed text-ink-2">
        {body}
      </p>

      <div className="mt-5 flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={onSkip} className={cn(touchBtn)}>
          {t("skip")}
        </Button>
        <div className="flex items-center gap-2">
          {!isFirst ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onBack}
              className={cn(touchBtn)}
            >
              {t("back")}
            </Button>
          ) : null}
          <Button size="sm" onClick={onNext} className={cn(touchBtn)}>
            {isLast ? t("done") : t("next")}
          </Button>
        </div>
      </div>
    </div>
  );
}
