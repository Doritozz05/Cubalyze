"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { Check, HelpCircle, RefreshCcw, RotateCcw, X } from "lucide-react";
import { useStore } from "zustand";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrambleDisplay } from "@/components/Scramble/ScrambleDisplay";
import { useCube3D } from "@/hooks/useCube3D";
import { useCubeTurnControls } from "@/hooks/useCubeTurnControls";
import {
  CUBE_KEYMAP,
  actionToMoves,
  actionToNotation,
  type CubeKeyAction,
} from "@/lib/keybinds/cubeKeybinds";
import { scrambleMoveDurationMs } from "@cubeforge/cube-3d-engine";
import { generateScrambleFor } from "@/utils/puzzleUtils";
import { formatTime } from "@/utils/formatTime";
import { hapticStart, hapticStop } from "@/utils/haptics";
import { CubeState, FaceletStringConverter } from "@cubeforge/math-core";
import { preferencesStore } from "@cubeforge/state";

/** The simulator currently supports 3×3 (architecture ready for more puzzles). */
const CUBE_ORDER = 3;

/** Solve phases of the simulator timer. */
type SimPhase = "idle" | "running" | "solved";

type CubeTurnSpeed = "slow" | "normal" | "fast" | "instant";

/** Base animation duration (ms) per turn speed. `instant` disables animation. */
const TURN_SPEED_BASE_MS: Record<CubeTurnSpeed, number> = {
  slow: 260,
  normal: 140,
  fast: 70,
  instant: 0,
};

const TURN_SPEED_OPTIONS: CubeTurnSpeed[] = ["slow", "normal", "fast", "instant"];

/** i18n key for each turn-speed label (typed literals — no dynamic keys). */
const TURN_SPEED_LABEL_KEY: Record<
  CubeTurnSpeed,
  "keys.speedSlow" | "keys.speedNormal" | "keys.speedFast" | "keys.speedInstant"
> = {
  slow: "keys.speedSlow",
  normal: "keys.speedNormal",
  fast: "keys.speedFast",
  instant: "keys.speedInstant",
};

/**
 * QWERTY layout of the physical keyboard, in order, for the on-screen key
 * map (mirrors virtual-cube.net's "Show Keyboard Map").
 */
const KEYBOARD_ROWS: string[][] = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l", ";"],
  ["z", "x", "c", "v", "b", "n", "m", ",", ".", "/"],
];

const PUNCT_CODES: Record<string, string> = {
  ";": "Semicolon",
  ",": "Comma",
  ".": "Period",
  "/": "Slash",
};

const labelToCode = (label: string): string =>
  /^[a-z]$/.test(label)
    ? `Key${label.toUpperCase()}`
    : /^\d$/.test(label)
      ? `Digit${label}`
      : (PUNCT_CODES[label] ?? "");

/** Arrow cluster (whole-cube rotations, like virtual-cube's bottom row). */
const ARROW_KEYS: { code: string; label: string }[] = [
  { code: "ArrowLeft", label: "←" },
  { code: "ArrowUp", label: "↑" },
  { code: "ArrowRight", label: "→" },
  { code: "ArrowDown", label: "↓" },
];

/** A single keycap in the on-screen keyboard: key label on top, move below. */
function KeyCap({ label, notation, dim }: { label: string; notation?: string; dim?: boolean }) {
  return (
    <div
      className={cn(
        "flex w-8 shrink-0 select-none flex-col items-center rounded-md border border-line bg-surface px-0.5 py-1 shadow-xs",
        dim && "opacity-25",
      )}
    >
      <span className="text-[0.55rem] leading-none font-medium text-ink-3">{label}</span>
      <span className="mt-1 font-mono text-[0.62rem] leading-none font-semibold text-ink">
        {notation ?? "·"}
      </span>
    </div>
  );
}

/**
 * Virtual cube simulator — a csTimer-style keyboard/touch cube.
 *
 * Architecture (single source of truth, but the RENDERER is the visual state):
 *
 *   • The 3D engine (CubeModel + RotationEngine) is the VISUAL layer: every
 *     move — face, slice, wide or whole-cube rotation — plays as an animated
 *     layer rotation, exactly like csTimer's virtual cube. Whole-cube
 *     rotations (x/y/z) rotate ALL three layers of an axis at once, so the
 *     centers turn with the cube (a physical rotation moves every sticker).
 *   • A math-core {@link CubeState} mirrors every move for LOGIC (solved
 *     detection, timer). It is never serialized to facelets in the hot path,
 *     so rotated frames never desync the centers.
 *   • Drag (csTimer live-twist model): the LAYER under the finger follows it
 *     live and snaps 90° on release (past the halfway point). Vertical drags
 *     turn the column at the sticker (R/M/L), horizontal drags the row
 *     (U/E/D) — grabbing the right column up turns R, the middle column M,
 *     a right-swipe on U turns U, on D turns D. Dragging the background
 *     rotates the whole cube in discrete 90° steps while the camera stays
 *     locked on the isometric view.
 *   • The scramble is applied INSTANTLY (no animation); the per-move turn
 *     speed is user-configurable, and 'instant' disables move animations too.
 *
 * Timer: starts on the first real move (rotations never start/stop it),
 * stops when the cube is solved up to a whole-cube rotation, and Enter on a
 * solved cube starts the next solve with a fresh scramble.
 */
export const CubeSimulatorView = memo(function CubeSimulatorView() {
  const { t } = useTranslation("cube");

  const {
    canvasRef,
    containerRef,
    isReady,
    initFailed,
    contextEvicted,
    zoomCamera,
    engineRef,
  } = useCube3D({ order: CUBE_ORDER, connectSmartCube: false });

  const timePrecision = useStore(preferencesStore, (s) => s.timePrecision);
  const cubeTurnSpeed = useStore(preferencesStore, (s) => s.cubeTurnSpeed);
  const setCubeTurnSpeed = useStore(preferencesStore, (s) => s.setCubeTurnSpeed);

  const [scramble, setScramble] = useState(() => generateScrambleFor("3x3"));
  const [phase, setPhase] = useState<SimPhase>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [finalMs, setFinalMs] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [hintVisible, setHintVisible] = useState(true);

  const stateRef = useRef<CubeState | null>(null);
  if (stateRef.current === null) stateRef.current = new CubeState();
  const phaseRef = useRef<SimPhase>("idle");
  phaseRef.current = phase;
  const startRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const didApplyRef = useRef(false);

  // ── Timer ticker (rAF while running) ────────────────────────────────────
  useEffect(() => {
    if (phase !== "running") return;
    const tick = () => {
      setElapsedMs(performance.now() - startRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [phase]);

  // Safety: never leave a pending rAF after unmount.
  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  /** Push the CubeState to the 3D engine (instant facelet sync — used for
   *  scramble apply and reset, whose frames are always canonical). */
  const syncState = useCallback(() => {
    const engine = engineRef.current;
    if (!engine || !stateRef.current) return;
    engine.syncFacelets(FaceletStringConverter.toFaceletString(stateRef.current));
  }, [engineRef]);

  /** Return the camera to the locked isometric view (same as the algorithms
   *  3D: theta/phi = 30°, tilted right for the best perspective). */
  const resetCamera = useCallback(() => {
    engineRef.current?.setIsometricView();
  }, [engineRef]);

  // Lock the initial camera to the isometric view once the engine is ready.
  useEffect(() => {
    if (!isReady) return;
    engineRef.current?.setIsometricView();
  }, [isReady, engineRef]);

  /**
   * Start a new solve: reset the cube to solved, apply the scramble
   * INSTANTLY (no animation — like virtual-cube.net), and put the timer back
   * to idle at 0.00.
   */
  const startSolve = useCallback(
    (scrambleStr: string) => {
      setScramble(scrambleStr);
      const state = new CubeState();
      try {
        state.applySequence(scrambleStr);
      } catch {
        // Unsupported token — leave the fresh cube solved rather than crash.
      }
      stateRef.current = state;

      const engine = engineRef.current;
      if (engine) {
        engine.resetCube();
        resetCamera();
        syncState();
      }
      setPhase("idle");
      setElapsedMs(0);
      setFinalMs(0);
    },
    [engineRef, resetCamera, syncState],
  );

  // ── Auto-scramble: generate on mount, apply instantly once ready ────────
  useEffect(() => {
    if (!isReady || didApplyRef.current) return;
    didApplyRef.current = true;
    startSolve(scramble);
  }, [isReady, scramble, startSolve]);

  /**
   * Mirror a move into the CubeState and drive the timer. The visual was
   * ALREADY animated by the caller (keyboard → rotateLayers, drag → the
   * resolved action through the same pipeline), so this never touches the
   * renderer — state and visuals stay in lockstep by construction.
   */
  const commitMove = useCallback((action: CubeKeyAction) => {
    const state = stateRef.current;
    if (!state) return;

    const notation = actionToNotation(action);
    try {
      state.applySequence(notation);
    } catch {
      return; // unknown token — ignore
    }

    // Whole-cube rotations never start or stop the clock (csTimer behaviour).
    if (action.kind === "rotate") return;

    const solved = state.isSolvedUpToRotation();
    if (solved) {
      // Freeze the exact final time (not the last rAF tick).
      if (phaseRef.current === "running") {
        setFinalMs(performance.now() - startRef.current);
        hapticStop();
      }
      setPhase("solved");
    } else if (phaseRef.current !== "running") {
      // First move — or a move after a finished solve — starts the clock.
      startRef.current = performance.now();
      setElapsedMs(0);
      setPhase("running");
      hapticStart();
    }
  }, []);

  /**
   * Single move pipeline (keyboard, drag and background rotations): animate
   * the move on the engine with the configured turn speed (0ms = instant),
   * then mirror it into the CubeState.
   */
  const applyAction = useCallback(
    (action: CubeKeyAction) => {
      const engine = engineRef.current;
      if (!engine) return;
      const baseMs = TURN_SPEED_BASE_MS[cubeTurnSpeed];
      const moves = actionToMoves(action, CUBE_ORDER);
      for (const mv of moves) {
        // Fire-and-forget: the RotationEngine serializes overlapping layers
        // via its collision detector, so rapid input stays consistent.
        void engine.rotateLayers(
          mv.axis,
          mv.layerValues,
          mv.angle,
          scrambleMoveDurationMs(mv.angle, baseMs),
          undefined,
          "smooth",
        );
      }
      commitMove(action);
    },
    [commitMove, cubeTurnSpeed, engineRef],
  );

  const { performAction, pointerHandlers } = useCubeTurnControls({
    engineRef,
    // Drag snap duration follows the same turn-speed preference as the
    // keyboard path (0 = instant, so the live twist lands without a snap).
    snapDurationMs: TURN_SPEED_BASE_MS[cubeTurnSpeed],
    onAction: applyAction, // keyboard path: animate the move, then commit
    onTurnCommitted: commitMove, // touch path: the snap already animated
  });

  // ── csTimer-layout keyboard binding (only while this view is mounted) ───
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Never intercept when an input/editable owns the keyboard, or when a
      // modifier is held (csTimer reserves Alt/Ctrl for global shortcuts).
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;

      if (e.code === "Escape") {
        setShowHelp(false);
        return;
      }
      // Solved cube → Enter starts the next solve (new scramble, instant).
      if (e.code === "Enter") {
        if (phaseRef.current === "solved") {
          e.preventDefault();
          startSolve(generateScrambleFor("3x3"));
        }
        return;
      }
      // Holding a key past the solving move fires repeated keydowns — those
      // would un-solve the finished cube and restart the timer from zero.
      // Block repeats once solved; deliberate single moves still work.
      if (phaseRef.current === "solved" && e.repeat) return;

      const action: CubeKeyAction | undefined = CUBE_KEYMAP[e.code];
      if (!action) return;
      e.preventDefault();
      performAction(action);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [performAction, startSolve]);

  const handleRegenerate = useCallback(() => {
    startSolve(generateScrambleFor("3x3"));
  }, [startSolve]);

  /**
   * Replay: re-apply the CURRENT scramble (cube → solved → scrambled again,
   * instant) and reset the timer to idle, keeping the same sequence on
   * screen so the solve can be redone.
   */
  const handleReplayScramble = useCallback(() => {
    startSolve(scramble);
  }, [scramble, startSolve]);

  /**
   * Reset: cube back to SOLVED (undoes every move including whole-cube
   * rotations x/y/z) + camera back to isometric + timer back to idle. The
   * scramble stays on screen so the solve can be redone.
   */
  const handleReset = useCallback(() => {
    const engine = engineRef.current;
    stateRef.current = new CubeState();
    engine?.resetCube();
    resetCamera();
    setPhase("idle");
    setElapsedMs(0);
    setFinalMs(0);
  }, [engineRef, resetCamera]);

  // ── Timer display ───────────────────────────────────────────────────────
  const displayMs = phase === "running" ? elapsedMs : phase === "solved" ? finalMs : 0;
  const formattedTime = useMemo(
    () => formatTime(displayMs, timePrecision),
    [displayMs, timePrecision],
  );

  const unavailable = initFailed || contextEvicted;

  return (
    <div className="relative flex h-full w-full min-h-0 flex-col">
      {/* Top bar: scramble display + replay button (timer + canvas controls overlay) */}
      <div className="flex shrink-0 items-start gap-4 px-4 pt-3 sm:px-6">
        <div className="min-w-0 flex-1">
          <ScrambleDisplay scramble={scramble} onRegenerate={handleRegenerate} />
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReplayScramble}
              disabled={!isReady}
              className="h-7 px-2 text-ink-2 hover:text-ink"
              aria-label={t("replayScramble")}
            >
              <RefreshCcw className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t("replayScramble")}</TooltipContent>
        </Tooltip>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef as React.RefObject<HTMLDivElement>}
        className="relative min-h-0 flex-1 overflow-hidden"
      >
        <canvas
          ref={canvasRef as React.RefObject<HTMLCanvasElement>}
          className={cn(
            "absolute inset-0 h-full w-full touch-none outline-none",
            isDragging ? "cursor-grabbing" : "cursor-grab",
          )}
          onPointerDown={(e) => {
            setIsDragging(true);
            if (hintVisible) setHintVisible(false);
            pointerHandlers.onPointerDown(e);
          }}
          onPointerMove={pointerHandlers.onPointerMove}
          onPointerUp={(e) => {
            setIsDragging(false);
            pointerHandlers.onPointerUp(e);
          }}
          onPointerCancel={(e) => {
            setIsDragging(false);
            pointerHandlers.onPointerCancel(e);
          }}
          onWheel={(e) => {
            e.preventDefault();
            zoomCamera(e.deltaY);
          }}
        />

        {/* Timer overlay — right-center of the canvas (csTimer-style position) */}
        <div className="pointer-events-none absolute right-3 top-1/2 z-10 -translate-y-1/2 sm:right-5">
          <div className="flex flex-col items-end rounded-xl border border-line/60 bg-background/70 px-3.5 py-2.5 shadow-lg backdrop-blur-md">
            <span
              role="timer"
              aria-label={t("timerAria")}
              className={cn(
                "nums font-mono text-2xl leading-none font-semibold tracking-tight tabular-nums transition-colors sm:text-3xl",
                phase === "solved"
                  ? "text-ready"
                  : phase === "running"
                    ? "text-ink"
                    : "text-ink-3",
              )}
            >
              {formattedTime}
            </span>
            {phase === "solved" ? (
              <motion.span
                initial={{ opacity: 0, y: 2 }}
                animate={{ opacity: 1, y: 0 }}
                role="status"
                aria-live="polite"
                className="mt-1.5 flex items-center gap-1 text-[0.62rem] font-medium text-ink-3"
              >
                <Check className="size-3 text-ready" />
                {t("nextSolveHint")}
              </motion.span>
            ) : null}
          </div>
        </div>

        {/* Controls — bottom-right floating cluster */}
        <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 sm:bottom-5 sm:right-5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                disabled={!isReady}
                className="h-8 px-2 text-ink-3 hover:text-ink"
                aria-label={t("reset")}
              >
                <RotateCcw className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">{t("reset")}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHelp(true)}
                disabled={!isReady}
                className="h-8 px-2 text-ink-3 hover:text-ink"
                aria-label={t("help")}
                aria-haspopup="dialog"
                aria-expanded={showHelp}
              >
                <HelpCircle className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">{t("helpShort")}</TooltipContent>
          </Tooltip>
        </div>

        {/* One-time gesture hint */}
        {hintVisible && isReady && !unavailable ? (
          <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2">
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.3 }}
              className="select-none rounded-full border border-line/60 bg-background/70 px-3.5 py-1.5 text-center text-[0.65rem] text-ink-3 shadow-md backdrop-blur-md"
            >
              {t("gestureHint")}
            </motion.p>
          </div>
        ) : null}

        {/* Loading / fallback states */}
        {unavailable ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-surface/80 px-4">
            <p className="select-none text-center text-xs text-ink-3/70">{t("unavailable")}</p>
          </div>
        ) : !isReady ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-surface/80">
            <p className="animate-pulse select-none text-xs text-ink-3/50">{t("initializing")}</p>
          </div>
        ) : null}
      </div>

      {/* Controls overlay (help) — on-screen keyboard map, like virtual-cube.net */}
      <AnimatePresence>
        {showHelp && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 z-40 flex items-center justify-center bg-background/60 p-4 backdrop-blur-sm"
            onPointerDown={(e) => {
              if (e.target === e.currentTarget) setShowHelp(false);
            }}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="cube-help-title"
              initial={{ scale: 0.96, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 8 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              className="relative max-h-full w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-surface p-5 shadow-xl"
            >
              <div className="mb-1 flex items-start justify-between gap-4">
                <div>
                  <h3 id="cube-help-title" className="text-sm font-semibold text-ink">
                    {t("keys.title")}
                  </h3>
                  <p className="mt-1 text-[0.68rem] leading-relaxed text-ink-3">{t("keys.subtitle")}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowHelp(false)} className="h-7 px-1.5" aria-label={t("keys.close")}>
                  <X className="size-3.5" />
                </Button>
              </div>

              {/* On-screen keyboard — each keycap shows its move */}
              <div className="mt-4 flex flex-col items-center gap-1.5">
                {KEYBOARD_ROWS.map((row) => (
                  <div key={row[0]} className="flex gap-1">
                    {row.map((label) => {
                      const code = labelToCode(label);
                      const action = CUBE_KEYMAP[code];
                      return (
                        <KeyCap
                          key={label}
                          label={label}
                          notation={action ? actionToNotation(action) : undefined}
                          dim={!action}
                        />
                      );
                    })}
                  </div>
                ))}
                {/* Arrow cluster — whole-cube rotations (camera stays locked) */}
                <div className="mt-1 flex gap-1">
                  {ARROW_KEYS.map((k) => {
                    const action = CUBE_KEYMAP[k.code];
                    return (
                      <KeyCap
                        key={k.code}
                        label={k.label}
                        notation={action ? actionToNotation(action) : undefined}
                      />
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 space-y-4">
                {/* Turn speed */}
                <div>
                  <h4 className="mb-1.5 text-[0.62rem] font-medium uppercase tracking-[0.14em] text-ink-3">
                    {t("keys.speed")}
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {TURN_SPEED_OPTIONS.map((speed) => (
                      <button
                        key={speed}
                        type="button"
                        onClick={() => setCubeTurnSpeed(speed)}
                        className={cn(
                          "rounded-lg border px-2.5 py-1 text-[0.68rem] font-medium transition-colors",
                          cubeTurnSpeed === speed
                            ? "border-primary bg-primary/10 text-ink"
                            : "border-line bg-background/40 text-ink-3 hover:border-ink-2/50 hover:text-ink",
                        )}
                        aria-pressed={cubeTurnSpeed === speed}
                      >
                        {t(TURN_SPEED_LABEL_KEY[speed])}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Gestures */}
                <div className="rounded-xl border border-line/60 bg-background/40 p-3">
                  <h4 className="mb-1.5 text-[0.62rem] font-medium uppercase tracking-[0.14em] text-ink-3">
                    {t("keys.gestures")}
                  </h4>
                  <ul className="space-y-1 text-[0.7rem] leading-relaxed text-ink-2">
                    <li>• {t("keys.gestureSwipe")}</li>
                    <li>• {t("keys.gestureOrbit")}</li>
                    <li>• {t("keys.gestureTap")}</li>
                    <li>• {t("keys.gesturePinch")}</li>
                  </ul>
                </div>
              </div>

              <p className="mt-4 border-t border-line pt-3 text-[0.65rem] text-ink-3/80">{t("keys.footer")}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
