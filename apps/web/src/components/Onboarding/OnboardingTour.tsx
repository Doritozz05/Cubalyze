"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { ViewId } from "@/components/Layout/sidebar.constants";
import { useIsTouch } from "@/hooks/use-mobile";
import { TOUR_STEPS } from "./tourSteps";
import { OnboardingSpotlight, type SpotlightRect } from "./OnboardingSpotlight";
import { TourTooltip, type ArrowSide } from "./TourTooltip";

const TOOLTIP_WIDTH = 288; // w-72
const TOOLTIP_GAP = 14;
const TOOLTIP_EST_HEIGHT = 190;

export interface OnboardingTourProps {
  /** Currently active stage view (drives re-measure after navigation). */
  activeView: ViewId;
  /** 0-based step index. */
  currentStep: number;
  /** Switch the main stage (reuses App's handleNavigate). */
  onNavigate: (view: ViewId) => void;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

interface Placement {
  style: React.CSSProperties;
  arrowSide?: ArrowSide;
}

function computePlacement(
  rect: SpotlightRect | null,
  isTouch: boolean,
  vw: number,
  vh: number,
): Placement {
  // Touch: always anchored above the bottom tab bar (thumb zone).
  if (isTouch) {
    return {
      style: {
        left: 12,
        right: 12,
        bottom: "calc(3.5rem + env(safe-area-inset-bottom) + 0.75rem)",
      },
      arrowSide: undefined,
    };
  }

  // Final step (no target): centered card.
  if (!rect) {
    return { style: { top: vh / 2 - TOOLTIP_EST_HEIGHT / 2, left: vw / 2 - TOOLTIP_WIDTH / 2 } };
  }

  // Prefer below the target; flip above when it would overflow.
  let top: number;
  let arrowSide: ArrowSide;
  if (rect.y + rect.height + TOOLTIP_GAP + TOOLTIP_EST_HEIGHT < vh) {
    top = rect.y + rect.height + TOOLTIP_GAP;
    arrowSide = "top";
  } else {
    top = Math.max(8, rect.y - TOOLTIP_GAP - TOOLTIP_EST_HEIGHT);
    arrowSide = "bottom";
  }

  const left = Math.min(
    Math.max(rect.x + rect.width / 2 - TOOLTIP_WIDTH / 2, 8),
    vw - TOOLTIP_WIDTH - 8,
  );

  return { style: { top, left, width: TOOLTIP_WIDTH }, arrowSide };
}

/**
 * Full-screen tour overlay (TDD-0020): dims everything except the step target,
 * shows the anchored tooltip and drives view navigation. ESC = skip; Space and
 * arrows are swallowed so the timer can never arm under the tour.
 */
export function OnboardingTour({
  activeView,
  currentStep,
  onNavigate,
  onNext,
  onBack,
  onSkip,
}: OnboardingTourProps) {
  const isTouch = useIsTouch();
  const step = TOUR_STEPS[currentStep];
  const [rect, setRect] = useState<SpotlightRect | null>(null);
  const [vw, setVw] = useState(() =>
    typeof window === "undefined" ? 0 : window.innerWidth,
  );
  const [vh, setVh] = useState(() =>
    typeof window === "undefined" ? 0 : window.innerHeight,
  );
  const dialogRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Re-measure the viewport (rare mid-tour resizes).
  useEffect(() => {
    const update = () => {
      setVw(window.innerWidth);
      setVh(window.innerHeight);
    };
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Navigate to the step's view, then measure its target on the next frame.
  // Re-runs when activeView lands (prop change) so the measurement happens
  // after the target actually mounted.
  useEffect(() => {
    if (!step) return;
    if (activeView !== step.view) onNavigate(step.view);

    let cancelled = false;
    let attempts = 0;
    const measure = () => {
      if (cancelled) return;
      const el = step.target
        ? document.querySelector<HTMLElement>(step.target)
        : null;
      if (el) {
        const r = el.getBoundingClientRect();
        setRect({ x: r.x, y: r.y, width: r.width, height: r.height });
        return;
      }
      if (attempts++ < 2) {
        requestAnimationFrame(measure);
      } else {
        setRect(null); // fallback: centered tooltip, never block
      }
    };
    const raf = requestAnimationFrame(measure);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [step, activeView, onNavigate]);

  // Keep focus inside the dialog: move it to the tooltip whenever the step
  // changes or Tab tries to escape into the underlying app.
  useEffect(() => {
    tooltipRef.current?.focus();
  }, [currentStep]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onSkip();
        return;
      }
      // Only guard keys that would reach the app UNDERNEATH the tour. Inside
      // the dialog (tooltip buttons), Space/arrows must keep their native
      // behavior — preventDefault here would block activating the buttons.
      const insideDialog =
        (dialogRef.current?.contains(e.target as Node) ?? false) ||
        (e.target === window || e.target === document.body || e.target === document);
      if (e.code === "Space") {
        if (!insideDialog) e.preventDefault();
        return;
      }
      if (e.key.startsWith("Arrow")) {
        if (!insideDialog) e.preventDefault();
        return;
      }
      if (e.key === "Tab") {
        const dialog = dialogRef.current;
        if (dialog && !dialog.contains(document.activeElement)) {
          e.preventDefault();
          tooltipRef.current?.focus();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onSkip]);

  if (!step) return null;

  const { style, arrowSide } = computePlacement(rect, isTouch, vw, vh);
  const titleId = `onboarding-title-${step.id}`;
  const bodyId = `onboarding-body-${step.id}`;

  return (
    <motion.div
      ref={dialogRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-[70]"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={step.target ? bodyId : undefined}
      onClick={onSkip}
    >
      <OnboardingSpotlight rect={rect} />

      <div
        ref={tooltipRef}
        tabIndex={-1}
        className="absolute outline-none cursor-default"
        style={style}
        onClick={(e) => e.stopPropagation()}
      >
        <TourTooltip
          title={step.title}
          body={step.body}
          stepIndex={currentStep}
          totalSteps={TOUR_STEPS.length}
          isFirst={currentStep === 0}
          isLast={currentStep === TOUR_STEPS.length - 1}
          isTouch={isTouch}
          arrowSide={arrowSide}
          titleId={titleId}
          bodyId={bodyId}
          onNext={onNext}
          onBack={onBack}
          onSkip={onSkip}
        />
      </div>

      <span aria-live="polite" className="sr-only">
        Step {currentStep + 1} of {TOUR_STEPS.length}: {step.title}
      </span>
    </motion.div>
  );
}
