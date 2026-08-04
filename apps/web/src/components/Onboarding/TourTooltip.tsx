"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type ArrowSide = "top" | "bottom" | "left" | "right";

const ARROW_STYLES: Record<ArrowSide, string> = {
  top: "-top-1 left-1/2 -translate-x-1/2 border-t border-l",
  bottom: "-bottom-1 left-1/2 -translate-x-1/2 border-b border-r",
  left: "-left-1 top-1/2 -translate-y-1/2 border-l border-b",
  right: "-right-1 top-1/2 -translate-y-1/2 border-r border-t",
};

interface TourTooltipProps {
  title: string;
  body: string;
  stepIndex: number;
  totalSteps: number;
  isFirst: boolean;
  isLast: boolean;
  isTouch: boolean;
  arrowSide?: ArrowSide;
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
  titleId,
  bodyId,
  onNext,
  onBack,
  onSkip,
}: TourTooltipProps) {
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
        />
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <span className="text-[0.62rem] uppercase tracking-[0.18em] text-ink-3">
          Step {stepIndex + 1} of {totalSteps}
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
          Skip
        </Button>
        <div className="flex items-center gap-2">
          {!isFirst ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onBack}
              className={cn(touchBtn)}
            >
              Back
            </Button>
          ) : null}
          <Button size="sm" onClick={onNext} className={cn(touchBtn)}>
            {isLast ? "Done" : "Next"}
          </Button>
        </div>
      </div>
    </div>
  );
}
