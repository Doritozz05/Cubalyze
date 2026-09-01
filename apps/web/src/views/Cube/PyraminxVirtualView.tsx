"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { HelpCircle, RotateCcw, Shuffle } from "lucide-react";
import { useStore } from "zustand";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrambleDisplay } from "@/components/Scramble/ScrambleDisplay";
import { useCube3D } from "@/hooks/useCube3D";
import { usePyraminxTurnControls } from "@/hooks/usePyraminxTurnControls";
import { pyraminxKeyToToken, PYRAMINX_KEYMAP } from "@/lib/keybinds/pyraminxKeybinds";
import type { PuzzleCategory } from "@/types";
import { generateScrambleFor } from "@/utils/puzzleUtils";
import { formatTime } from "@/utils/formatTime";
import { preferencesStore } from "@cubeforge/state";
import { cubeTurnSounds } from "@/utils/cubeTurnSounds";
import { usePyraminxVirtualSession } from "@/hooks/usePyraminxVirtualSession";
import type { SolveCompletionOverrides } from "@/hooks/useSolveCompletion";
import type { CubeMoveEvent, CubeOrientation, OrientationTimeline } from "@cubeforge/types";
import type { Penalty } from "@/types";
import {
  conjugatePyraminxToken,
  displayPyraminxTokenThroughGrip,
  remapPyraminxScrambleString,
  transitionPyraminxGrip,
  type PyraminxEngine as PyraminxEngineT,
} from "@cubeforge/cube-3d-engine";
import { isPyraminxSolvedAnyOrientation } from "@cubeforge/solver-engine/pyraminx";

/** Base animation duration (ms) per turn speed. `instant` disables animation. */
const TURN_SPEED_BASE_MS: Record<"slow" | "normal" | "fast" | "instant", number> = {
  slow: 260,
  normal: 140,
  fast: 70,
  instant: 0,
};

export interface PyraminxVirtualViewProps {
  puzzle: Extract<PuzzleCategory, "Pyraminx">;
  onVirtualSolveComplete?: (
    time: number,
    penalty: Penalty,
    moves: CubeMoveEvent[],
    orientations: (CubeOrientation | undefined)[],
    orientationTimeline: OrientationTimeline | undefined,
    overrides?: SolveCompletionOverrides,
  ) => void;
}

/**
 * Pyraminx virtual cube (Cube tab) — the vertex-turning counterpart of the
 * cube simulator:
 *
 *   • PyraminxEngine on the canvas (visual), a PyraminxState mirror in the
 *     session (logic) — the same single-source-of-truth split as the cube.
 *   • csTimer-style keyboard (see pyraminxKeybinds) + camera drag.
 *   • The SAME TimerEngine state machine: the user performs the WCA scramble
 *     (or presses Scramble), the timer arms, the first turn starts it, and it
 *     stops the moment the state is solved.
 *   • Solve moves are saved as CubeMoveEvents carrying the WCA token in
 *     displayNotation — the save pipeline tags them `puzzleType: "pyram"`
 *     (analysis correctly skipped) and the 3D replay renders them on the
 *     Pyraminx engine.
 */
export const PyraminxVirtualView = memo(function PyraminxVirtualView({
  puzzle,
  onVirtualSolveComplete,
}: PyraminxVirtualViewProps) {
  const { t } = useTranslation("cube");

  const [scramble, setScramble] = useState(() => generateScrambleFor(puzzle));
  const puzzleType = "pyram";

  // Regenerate is referenced by the onSolve callback (fired async after a
  // solve completes) — hold it in a ref so its declaration order is free and
  // the latest closure is always used.
  const regenerateRef = useRef<() => void>(() => {});
  useEffect(() => {
    regenerateRef.current = () => {
      reset();
      const engine = engineRef.current as unknown as PyraminxEngineT | null;
      engine?.reset();
      engine?.resetPuzzleOrientation();
      engine?.setIsometricView();
      setGrip(0); // canonical view → grip 0
      setScramble(generateScrambleFor(puzzle));
    };
  });

  const session = usePyraminxVirtualSession(scramble, (time, penalty, moves) => {
    onVirtualSolveComplete?.(
      time,
      penalty,
      moves,
      [],
      undefined,
      {
        source: "virtual",
        scramble,
        puzzleType,
        onNextScramble: () => setTimeout(() => regenerateRef.current(), 1200),
      },
    );
  });
  const {
    phase,
    time,
    lastTime,
    validation,
    performMove,
    applyScrambleNow,
    reset,
    notifySolved,
  } = session;

  // Fallback regeneration when standalone (without outer completion handler):
  const lastTimeRef = useRef<number | null>(null);
  useEffect(() => {
    if (onVirtualSolveComplete) return;
    const prev = lastTimeRef.current;
    lastTimeRef.current = lastTime;
    if (lastTime !== null && prev === null) {
      const t = setTimeout(() => regenerateRef.current(), 1200);
      return () => clearTimeout(t);
    }
  }, [lastTime, onVirtualSolveComplete]);

  const {
    canvasRef,
    containerRef,
    isReady,
    initFailed,
    contextEvicted,
    zoomCamera,
    engineRef,
  } = useCube3D({ puzzle: { kind: "pyraminx" }, connectSmartCube: false });

  const timePrecision = useStore(preferencesStore, (s) => s.timePrecision);
  const cubeTurnSpeed = useStore(preferencesStore, (s) => s.cubeTurnSpeed);
  // "Rotate scramble with cube" (Settings → Scramble): remap the scramble
  // notation to the puzzle's current orientation — same preference and
  // behavior as the cube simulator (keyboard conjugation always follows the
  // grip; only the DISPLAYED scramble is gated).
  const scrambleFollowsCube = useStore(preferencesStore, (s) => s.scrambleFollowsCube);

  const [showHelp, setShowHelp] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [hintVisible, setHintVisible] = useState(true);

  // ── Whole-puzzle A₄ grip (view frame) ────────────────────────────────
  // Mirrors the cube simulator's grip state: the scramble display and the
  // keyboard conjugation read the SAME grip, so they can never disagree
  // (the "I did L but the system says R'" class of bugs). The grip is
  // updated DETERMINISTICALLY at rotation START via the A₄ grip transition
  // table — never by reading the engine's quaternion mid-animation, which
  // is mid-SLERP between poses and would snap to the wrong frame.
  const [grip, setGrip] = useState(0);

  /** Rotate the puzzle one discrete step; the grip updates immediately. */
  const rotatePuzzleY = useCallback(
    (direction: 1 | -1) => {
      setGrip((g) => transitionPyraminxGrip(g, direction === 1 ? "y1" : "y-1"));
      void (engineRef.current as unknown as PyraminxEngineT | null)?.rotatePuzzleY(direction);
    },
    [engineRef],
  );
  const rotatePuzzleX = useCallback(
    (direction: 1 | -1) => {
      // The 180° C2 tilt is its own inverse: both directions land on the
      // same pose, so the transition op is x1 either way.
      setGrip((g) => transitionPyraminxGrip(g, "x1"));
      void (engineRef.current as unknown as PyraminxEngineT | null)?.rotatePuzzleX(direction);
    },
    [engineRef],
  );

  // ── Turn handling: logical session first, then the animated visual ────
  const handleTurn = useCallback(
    (token: string) => {
      cubeTurnSounds.play();
      performMove(token);
      const eng = engineRef.current as unknown as PyraminxEngineT | null;
      const duration = TURN_SPEED_BASE_MS[cubeTurnSpeed];
      void eng?.applyMove(token, duration).then(() => {
        if (eng && isPyraminxSolvedAnyOrientation(eng.getState())) {
          notifySolved();
        }
      });
    },
    [performMove, cubeTurnSpeed, engineRef, notifySolved],
  );

  // ── Piece drags → FIXED ±120° turns; background drags → discrete
  //    drone lateral (120°) or tilt (180° C2) puzzle rotation. The camera
  //    remains locked in canonical isometric view. ────────────────────────
  const { pointerHandlers } = usePyraminxTurnControls({
    engineRef: engineRef as unknown as React.RefObject<PyraminxEngineT | null>,
    onTurn: handleTurn,
    onRotateLateral: rotatePuzzleY,
    onRotateTilt: rotatePuzzleX,
    onOrbitStep: (dx, dy) => {
      if (Math.abs(dx) >= Math.abs(dy)) {
        rotatePuzzleY(dx > 0 ? 1 : -1);
      } else {
        rotatePuzzleX(dy > 0 ? 1 : -1);
      }
    },
  });

  // ── Keyboard (csTimer-style, see pyraminxKeybinds) ─────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Never intercept when an input/editable owns the keyboard, or when a
      // modifier is held (csTimer reserves Alt/Ctrl for global shortcuts).
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.repeat) return;
      if (e.code === "Escape") {
        setShowHelp(false);
        return;
      }
      // Arrow keys mirror the background drag:
      // Left / Right: 120° drone lateral rotation
      // Down / Up: smooth tilt rotation
      if (e.code === "ArrowRight") {
        e.preventDefault();
        return void rotatePuzzleY(1);
      }
      if (e.code === "ArrowLeft") {
        e.preventDefault();
        return void rotatePuzzleY(-1);
      }
      if (e.code === "ArrowDown") {
        e.preventDefault();
        return void rotatePuzzleX(1);
      }
      if (e.code === "ArrowUp") {
        e.preventDefault();
        return void rotatePuzzleX(-1);
      }
      const rawToken = pyraminxKeyToToken(e.code);
      if (!rawToken) return;
      e.preventDefault();
      // Conjugate with the VIEW's grip (the same source the scramble display
      // uses) — never the engine's live quaternion, which is mid-SLERP while
      // a rotation animates and would conjugate in the wrong frame.
      const token = conjugatePyraminxToken(rawToken, grip);
      handleTurn(token);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleTurn, grip, rotatePuzzleX, rotatePuzzleY]);

  // The one-time gesture hint disappears by itself a few seconds after the
  // puzzle is ready (and immediately on the first drag) — same as the cube.
  useEffect(() => {
    if (!isReady || !hintVisible) return;
    const timer = setTimeout(() => setHintVisible(false), 4500);
    return () => clearTimeout(timer);
  }, [isReady, hintVisible]);

  // ── Scramble / reset ───────────────────────────────────────────────────
  // Parity with 2x2/3x3: clean reset to solved first, then apply the scramble
  // INSTANTLY to the engine (duration 0) and seed the session tracker.
  const handleScrambleNow = useCallback(() => {
    const engine = engineRef.current as unknown as PyraminxEngineT | null;
    engine?.reset();
    engine?.resetPuzzleOrientation();
    engine?.setIsometricView();
    setGrip(0); // resetPuzzleOrientation always lands on canonical (grip 0)
    void engine?.applyScrambleAnimated(scramble, 0);
    applyScrambleNow();
  }, [applyScrambleNow, scramble, engineRef]);

  const handleReset = useCallback(() => {
    reset();
    const engine = engineRef.current as unknown as PyraminxEngineT | null;
    engine?.reset();
    engine?.resetPuzzleOrientation();
    engine?.setIsometricView();
    setGrip(0);
  }, [reset, engineRef]);

  // Lock the initial camera to the isometric view once the engine is ready
  // (same as the cube simulator — the camera never starts free).
  // Lock the initial camera to the hero isometric view once the engine is
  // ready (exactly the reconstruction's main shot — the camera never starts
  // free, and R/L/U/D or a background drag only snaps between the 4 views).
  useEffect(() => {
    if (!isReady) return;
    const eng = engineRef.current as unknown as PyraminxEngineT | null;
    eng?.setIsometricView();
    (window as unknown as Record<string, unknown>).__pyraminxEngine = eng;
  }, [isReady, engineRef]);

  const handleRegenerate = useCallback(() => {
    regenerateRef.current();
  }, []);

  // Wheel zoom must attach natively with { passive: false } (same as the
  // cube simulator): React registers onWheel as a passive root listener, so
  // preventDefault() would be ignored and the page would scroll while the
  // puzzle zooms.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomCamera(e.deltaY);
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [canvasRef, zoomCamera]);

  const formattedTime = useMemo(
    () => formatTime(time, timePrecision),
    [time, timePrecision],
  );

  // Per-token verification states for the scramble display (mirror the
  // cube validator's surface: correct = performed, pending = not yet).
  const scrambleStates = useMemo(
    () =>
      validation.totalTokens === 0
        ? []
        : Array.from({ length: validation.totalTokens }, (_, i) =>
            i < validation.progress ? ("correct" as const) : ("pending" as const),
          ),
    [validation.progress, validation.totalTokens],
  );

  // Orientation-adapted scramble ("the scramble rotates with the puzzle",
  // gated by the same Settings → Scramble preference as the cube): each
  // canonical WCA token is remapped to the VIEW position where its vertex
  // now sits, using the A₄ grip tables — the pyraminx analog of the cube's
  // displayScramble. Identity grip (canonical view) is a no-op.
  const displayScramble = useMemo(
    () =>
      scrambleFollowsCube ? remapPyraminxScrambleString(scramble, grip) : scramble,
    [scramble, grip, scrambleFollowsCube],
  );
  // Error moves are stored in the CANONICAL frame (that's what the tracker
  // consumed); remap them to the current view frame for display, exactly
  // like the cube's displayErrorMoves.
  const displayErrorMoves = useMemo(
    () => validation.errorMoves.map((m) => displayPyraminxTokenThroughGrip(m, grip)),
    [validation.errorMoves, grip],
  );

  const unavailable = initFailed || contextEvicted;

  return (
    <div className="relative flex h-full w-full min-h-0 flex-col">
      {/* Top bar: scramble display with per-move verification.

          FIXED HEIGHT (same as the cube simulator) — the canvas below is
          flex-1, so any change in the scramble's wrapped row count (different
          scramble lengths, error moves, "too many mistakes") used to resize
          the canvas, and the 3D engine's FOV-fit then rescales the puzzle —
          the whole panel jumped. Reserving 3 rows on touch / 2 on desktop
          keeps the canvas (and the puzzle) pixel-stable; the content is
          top-aligned, so short scrambles leave clean space below. */}
      <div className="flex h-32 shrink-0 items-start overflow-hidden border-b border-line/60 px-4 pt-3 sm:px-6 lg:h-24">
        <div className="min-w-0 flex-1">
          <ScrambleDisplay
            scramble={scramble}
            displayScramble={displayScramble}
            verificationActive
            states={scrambleStates}
            currentIndex={validation.progress}
            errorMoves={displayErrorMoves}
            isScrambled={validation.isScrambled}
            needsReset={validation.needsReset}
            awaitingSolve={false}
            onRegenerate={handleRegenerate}
          />
        </div>
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
        />

        {/* One-time gesture hint (same copy + timing as the cube simulator) */}
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

        {unavailable ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-surface/80 px-4">
            <span className="text-xs text-ink-3/70 text-center select-none">
              {t("unavailable")}
            </span>
          </div>
        ) : !isReady ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-surface/80">
            <span className="text-xs text-ink-3/50 animate-pulse select-none">
              {t("initializing")}
            </span>
          </div>
        ) : null}

        {/* Timer overlay — right-center (csTimer-style) */}
        <div className="pointer-events-none absolute right-3 top-1/2 z-10 -translate-y-1/2 sm:right-5">
          <div className="flex flex-col items-end rounded-xl border border-line/60 bg-background/70 px-3.5 py-2.5 shadow-lg backdrop-blur-md">
            <span
              role="timer"
              aria-label={t("timerAria")}
              className={cn(
                "nums font-mono text-2xl leading-none font-semibold tracking-tight tabular-nums transition-colors sm:text-3xl",
                phase === "running" || phase === "stopped"
                  ? "text-ink"
                  : phase === "ready_for_move"
                    ? "text-ready"
                    : "text-ink-3",
              )}
            >
              {formattedTime}
            </span>
            {lastTime !== null && phase !== "stopped" && phase !== "running" && (
              <span className="mt-0.5 text-[0.65rem] text-ink-3 tabular-nums">
                {formatTime(lastTime, timePrecision)}
              </span>
            )}
          </div>
        </div>

        {/* Controls — bottom-right floating cluster */}
        <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 sm:bottom-5 sm:right-5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleScrambleNow}
                disabled={!isReady}
                className="h-8 gap-1 px-2 text-ink-3 hover:text-ink"
                aria-label={t("scramble")}
              >
                <Shuffle className="size-4" />
                <span className="hidden text-xs sm:inline">{t("scramble")}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">{t("scrambleTooltip")}</TooltipContent>
          </Tooltip>

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
                <span className="hidden text-xs sm:inline">{t("reset")}</span>
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
      </div>

      {/* Keymap hint — thin footer */}
      <div className="border-t border-line/60 px-3 py-1.5 text-center">
        <span className="text-[0.65rem] text-ink-3 select-none">{t("pyraminxKeysHint")}</span>
      </div>

      {/* Help dialog */}
      {showHelp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowHelp(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-line bg-surface p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-1 text-sm font-semibold text-ink">{t("help")}</h3>
            <p className="mb-3 text-xs text-ink-3">{t("pyraminxKeysSubtitle")}</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-xs text-ink-2">
              {Object.entries(PYRAMINX_KEYMAP).map(([code, action]) => (
                <div key={code} className="flex items-center justify-between gap-2">
                  <span className="rounded bg-line/60 px-1.5 py-0.5 text-[0.65rem] text-ink-3">
                    {code.replace("Key", "").replace("Comma", ",")}
                  </span>
                  <span>{action.token}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => setShowHelp(false)}>
                {t("keys.close")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
