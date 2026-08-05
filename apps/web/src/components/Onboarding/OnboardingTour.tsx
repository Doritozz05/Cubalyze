"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { ViewId } from "@/components/Layout/sidebar.constants";
import { useIsTouch } from "@/hooks/use-mobile";
import { TOUR_STEPS } from "./tourSteps";
import { OnboardingSpotlight, type SpotlightRect } from "./OnboardingSpotlight";
import { TourTooltip, type ArrowSide } from "./TourTooltip";

const TOOLTIP_WIDTH = 336; // w-[21rem]
const TOOLTIP_GAP = 20;
const TOOLTIP_EST_HEIGHT = 230;
const VIEWPORT_MARGIN = 16;

// Padding (px) added AROUND the measured target so the spotlight ring and its
// rounded corners never sit on top of content flush against the target's edges
// (e.g. the "S" of the "Scramble" label used to be clipped by the ring).
const SPOTLIGHT_PAD = 6;
// How many consecutive identical frames count as a "settled" layout.
const STABLE_FRAMES = 2;
// Upper bound on how long measurement may run before falling back to a
// centered tooltip. TIME-based (not frame-based) so a 120Hz display or a busy
// main thread can't silently shrink the window. 3s comfortably covers the
// lazy views' first chunk fetch (cold cache, dev transforms) plus any mount
// animation that runs before the target's rect settles.
const MEASURE_DEADLINE_MS = 3000;

/**
 * True while the target (or any of its ancestors) is mid-animation.
 *
 * A still-moving element must never be measured: the timer scramble's slide-in
 * (y: -100% → 0) starts translated up over the header widget dock, and a couple
 * of dropped frames there (busy main thread mid view-switch) can make two
 * consecutive samples look "stable" — locking the spotlight onto the dock.
 * CSS animations/transitions on ancestors are caught too, so this covers both
 * framer-motion tweens and pure-CSS motion.
 */
function inFlight(el: Element): boolean {
  let node: Element | null = el;
  for (let depth = 0; node && depth < 8; depth += 1, node = node.parentElement) {
    // "running" also covers animations whose start is still pending (the
    // spec reports them as running until they actually begin).
    if (node.getAnimations().some((a) => a.playState === "running")) {
      return true;
    }
  }
  return false;
}

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
  /** Arrow center, px from the tooltip's left edge (top/bottom arrows). */
  arrowOffset?: number;
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
        left: 16,
        right: 16,
        bottom: "calc(3.5rem + env(safe-area-inset-bottom) + 1rem)",
      },
      arrowSide: undefined,
    };
  }

  // Final step (no target): centered card, clamped to the viewport.
  if (!rect) {
    return {
      style: {
        top: Math.max(VIEWPORT_MARGIN, vh / 2 - TOOLTIP_EST_HEIGHT / 2),
        left: Math.max(VIEWPORT_MARGIN, vw / 2 - TOOLTIP_WIDTH / 2),
      },
    };
  }

  // Prefer below the target; flip above when it would overflow.
  let top: number;
  let arrowSide: ArrowSide;
  if (rect.y + rect.height + TOOLTIP_GAP + TOOLTIP_EST_HEIGHT < vh - VIEWPORT_MARGIN) {
    top = rect.y + rect.height + TOOLTIP_GAP;
    arrowSide = "top";
  } else {
    top = Math.max(VIEWPORT_MARGIN, rect.y - TOOLTIP_GAP - TOOLTIP_EST_HEIGHT);
    arrowSide = "bottom";
  }

  const left = Math.min(
    Math.max(rect.x + rect.width / 2 - TOOLTIP_WIDTH / 2, VIEWPORT_MARGIN),
    vw - TOOLTIP_WIDTH - VIEWPORT_MARGIN,
  );

  // The arrow must point at the target's horizontal center even when the card
  // is clamped to the viewport edge — the left-rail "Widgets" button sits at
  // x≈28 while its clamped card lands at x=16, so a dead-centered arrow used
  // to point at empty space instead of at the button. Clamped so the arrow
  // never pokes outside the card.
  const ARROW_EDGE_PAD = 12;
  const arrowOffset = Math.min(
    Math.max(rect.x + rect.width / 2 - left, ARROW_EDGE_PAD),
    TOOLTIP_WIDTH - ARROW_EDGE_PAD,
  );

  return { style: { top, left, width: TOOLTIP_WIDTH }, arrowSide, arrowOffset };
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

  // The toured views are code-split (see MainStage). Warm them as soon as the
  // tour mounts so the spotlight never waits on a chunk: a cold chunk can take
  // longer than the measurement window, which used to leave steps 2-4 without
  // any highlight (the loop fell back to a centered tooltip before the target
  // even existed). The tour starts on the timer, so this prefetch runs while
  // the user is still reading step 1.
  useEffect(() => {
    // Best-effort prefetch: a failed chunk download must never surface as an
    // unhandled rejection (the views would retry via lazy() on navigation).
    void import("@/components/Insights/InsightsDashboard").catch(() => {});
    void import("@/views/Algorithms/AlgorithmDashboard").catch(() => {});
    void import("@/views/Profile/ProfileView").catch(() => {});
  }, []);

  // Navigate to the step's view, then measure its target. Re-runs when
  // activeView lands (prop change) so the measurement happens after the target
  // actually mounted.
  //
  // Measurement is deliberately conservative: the target's rect is only
  // committed once it has been identical for STABLE_FRAMES consecutive frames
  // AND is not mid-animation AND sits inside the stage container, so a
  // slide-in animation, a view transition or a layout shift can never leave
  // the highlight stranded on stale coordinates (it used to sit over the
  // header when the scramble was still animating in, or off the widgets tab
  // while the sidebar was collapsing). Hidden/zero-size targets are skipped.
  //
  // The frame-stability window alone was NOT enough: the timer scramble's
  // slide-in (y: -100% → 0) starts translated up over the header dock, and a
  // couple of dropped frames while the main thread is busy (view switch,
  // settings dialog closing) can make two consecutive samples look stable
  // there — locking the spotlight onto the dock ~1 in 10 replays. The
  // animation + stage-bound checks below reject those in-transit rects
  // outright, so the spotlight can only ever commit at the final position.
  useEffect(() => {
    if (!step) return;
    if (activeView !== step.view) onNavigate(step.view);
    const target = step.target;

    // Final centered step has no target — nothing to measure (also avoids a
    // stale spotlight lingering on the previous step's rect).
    if (!target) {
      setRect(null);
      return;
    }

    let cancelled = false;
    let deadline = performance.now() + MEASURE_DEADLINE_MS;
    let stableFrames = 0;
    let lastRect: SpotlightRect | null = null;

    const measure = () => {
      if (cancelled) return;
      // Pick the first VISIBLE match: a hidden duplicate (e.g. the touch-only
      // header "Widgets" button next to the desktop sidebar item) must never
      // be measured, whatever its DOM order.
      let el: HTMLElement | null = null;
      for (const candidate of document.querySelectorAll<HTMLElement>(target)) {
        if (candidate.getClientRects().length > 0) {
          el = candidate;
          break;
        }
      }

      if (el) {
        const r = el.getBoundingClientRect();
        const next: SpotlightRect = {
          x: r.x,
          y: r.y,
          width: r.width,
          height: r.height,
        };

        // Reject "in transit" rects, which can never be trusted:
        //  1. the target or an ancestor is still animating (the scramble's
        //     slide-in starts translated up over the header dock), or
        //  2. the rect sits above the stage container — the slide-in's start
        //     position parks the element up there, so a rect above
        //     #timer-section is always a stale start position, even when it
        //     looks frame-stable. Header-anchored targets (widgets-entry)
        //     are outside the stage and skip this bound.
        const stageEl = document.getElementById("timer-section");
        const stageTop = stageEl?.contains(el)
          ? stageEl.getBoundingClientRect().top
          : undefined;
        const inTransit =
          inFlight(el) || (stageTop !== undefined && next.y < stageTop - 2);

        if (!inTransit) {
          // Target found in a usable spot: don't let the missing-element
          // budget eat settling time (a long slide-in should keep waiting,
          // not give up).
          deadline = performance.now() + MEASURE_DEADLINE_MS;
          const settled =
            lastRect !== null &&
            Math.abs(lastRect.x - next.x) < 0.5 &&
            Math.abs(lastRect.y - next.y) < 0.5 &&
            Math.abs(lastRect.width - next.width) < 0.5 &&
            Math.abs(lastRect.height - next.height) < 0.5;
          lastRect = next;

          if (settled) {
            if (++stableFrames >= STABLE_FRAMES) {
              // Expand the box slightly so the ring/rounded corners never clip
              // content that sits flush against the target's edges.
              setRect({
                x: next.x - SPOTLIGHT_PAD,
                y: next.y - SPOTLIGHT_PAD,
                width: next.width + SPOTLIGHT_PAD * 2,
                height: next.height + SPOTLIGHT_PAD * 2,
              });
              return;
            }
          } else {
            stableFrames = 0;
          }
        } else {
          // In transit: restart the stability window so a stale rect can
          // never count as "settled" when the target reaches its final spot.
          // In-transit frames keep eating the deadline, so a target stuck
          // mid-animation (e.g. a perpetual animation on an ancestor) can
          // never loop forever — after MEASURE_DEADLINE_MS the spotlight
          // falls back to a centered tooltip instead of hanging.
          stableFrames = 0;
          lastRect = null;
        }
      } else {
        // Target missing/hidden: restart the stability window so a stale
        // rect can never count as "settled" when the target reappears.
        stableFrames = 0;
        lastRect = null;
      }

      if (performance.now() < deadline) {
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

  const { style, arrowSide, arrowOffset } = computePlacement(rect, isTouch, vw, vh);
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
          arrowOffset={arrowOffset}
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
