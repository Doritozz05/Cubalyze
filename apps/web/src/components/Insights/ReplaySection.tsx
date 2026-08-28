"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SectionHeader } from "./atoms";
import type { Solve } from "@/types";
import { ReplayEngine, type ReplayState, getSkinStyle } from "@cubeforge/cube-3d-engine";
import {
  MoveTransformer,
  OrientationTable,
  getOrientationAtIndex,
} from "@cubeforge/math-core";
import { useStore } from "zustand";
import { preferencesStore } from "@cubeforge/state";
import { cubeTurnSounds } from "@/utils/cubeTurnSounds";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Check,
  Maximize2,
  Minimize2,
} from "lucide-react";

// ─── Constants ─────────────────────────────────────────────────────────────

const SPEEDS = [0.25, 0.5, 1, 2] as const;

/**
 * Playback pace: each move gets a fixed slot on the replay timeline, so the
 * replay is MOVE-DRIVEN — it always plays EVERY move regardless of the
 * solve's real time. A 3s / 50-move record replays all 50 moves instead of
 * cutting off after a few. Must match ReplayEngine.moveSpacingMs.
 */
const REPLAY_MOVE_SPACING_MS = 500;

// ─── Props ─────────────────────────────────────────────────────────────────

export interface ReplaySectionProps {
  solve: Solve;
  /**
   * Called with the current replay position in ms so the parent
   * (SolveAnalysisPanel) can drive the timeline SVG playhead.
   */
  onReplayPosition?: (positionMs: number, moveIndex: number) => void;
  /** Called when replay completes. */
  onReplayComplete?: () => void;
  /**
   * "normal" keeps the compact cube used inside Insights. "large" widens
   * the cube + controls so the replay can anchor a dedicated column (the
   * reconstruction detail view).
   */
  size?: "normal" | "large";
  /**
   * Whether the replay section can be collapsed with a chevron toggle.
   * Defaults to true. When false, the section is permanently expanded and
   * shows a static header without collapse button.
   */
  collapsible?: boolean;
  /**
   * Whether to render the section header. Defaults to true.
   */
  showHeader?: boolean;
  className?: string;
}

/**
 * Imperative control surface for the replay (e.g. phase rows in the
 * detection table seeking the cube to the state before a phase).
 */
export interface ReplaySectionHandle {
  /**
   * Pause the replay with exactly `moveIndex` moves applied (clamped to
   * [0, moves.length - 1]; negative → the start). Move `n` applied means
   * the cube shows the state AFTER move n — i.e. the position right before
   * move n+1, which is what "the move before a phase" means.
   */
  seekToMove(moveIndex: number): Promise<void>;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

// ─── ReplaySection ─────────────────────────────────────────────────────────

export const ReplaySection = forwardRef<ReplaySectionHandle, ReplaySectionProps>(
function ReplaySection({
  solve,
  onReplayPosition,
  onReplayComplete,
  size = "normal",
  collapsible = true,
  showHeader = true,
  className,
}: ReplaySectionProps, ref) {
  const { t } = useTranslation("insights");
  const [expanded, setExpanded] = useState(true);
  const isExpanded = collapsible ? expanded : true;
  const [replayState, setReplayState] = useState<ReplayState>("idle");
  const [positionMs, setPositionMs] = useState(0);
  const [speed, setSpeed] = useState<number>(1);
  const [currentMoveIdx, setCurrentMoveIdx] = useState(-1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Keyboard shortcut (Escape) to exit in-app fullscreen and body overflow/sidebar lock
  useEffect(() => {
    if (!isFullscreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsFullscreen(false);
      }
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.classList.add("replay-fullscreen-active");
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.classList.remove("replay-fullscreen-active");
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFullscreen]);

  // Incremented on each re-init to force a fresh <canvas> DOM element.
  // transferControlToOffscreen() can only be called once per canvas element,
  // so we must recreate the element when the worker is torn down and recreated
  // (e.g., when switching solves or toggling the section).
  const [canvasKey, setCanvasKey] = useState(0);

  const engineRef = useRef<ReplayEngine | null>(null);
  /**
   * A phase-row seek requested while the engine was not ready (section
   * collapsed / worker still initializing) — applied once the engine exists.
   */
  const pendingSeekRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Refs for the mini-cube worker
  const workerRef = useRef<Worker | null>(null);
  /** Comlink.Remote<EngineWorkerAPI> but typed loosely due to dynamic import. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workerProxyRef = useRef<any>(null);
  const cubeReadyRef = useRef(false);

  // Camera drag state for the mini cube
  const isDraggingRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });

  // Track which solve the worker is currently initialized for — when solve
  // changes, we must tear down and re-init with fresh state.
  const lastSolveIdRef = useRef<string | null>(null);
  /** Tracks the canvasKey generation that the current worker was created for.
   *  Prevents init with a stale canvas that already had transferControlToOffscreen
   *  called on it (a one-way operation). */
  const canvasGenRef = useRef(-1);

  /**
   * Always-current solve ref — used inside effects that must NOT depend on
   * the `solve` object reference to avoid infinite re-init loops.
   * The identity effect `[solve.id]` handles teardown when a different solve
   * is selected, and increments canvasKey so the init effect re-runs fresh.
   */
  const solveRef = useRef(solve);
  solveRef.current = solve;

  // ── Reactive appearance (skin & floating stickers) — watch user preference ──
  const appearance3d = useStore(preferencesStore, (s) => s.appearance3d);
  const replayFloatingStickers = useStore(preferencesStore, (s) => s.replayFloatingStickers);

  // Push skin and floating sticker changes to the replay worker
  useEffect(() => {
    if (!workerProxyRef.current || !cubeReadyRef.current) return;
    const style = getSkinStyle(appearance3d);
    workerProxyRef.current
      .updateStyle({
        ...style,
        floatingStickers: replayFloatingStickers,
      })
      .catch((err: unknown) => console.warn("[Replay] updateStyle failed", err));
  }, [appearance3d, replayFloatingStickers]);

  // ── Reset state when solve changes ────────────────────────────────────────
  // This runs BEFORE the init effect, resetting display state so the user
  // never sees stale move count / time from the previous solve.
  // Increments canvasKey to force a fresh <canvas> DOM element (since
  // transferControlToOffscreen() is a one-way operation).
  // On FIRST mount, `lastSolveIdRef` is null — we skip state/canvas reset
  // because initial state is already correct and the canvas hasn't been
  // transferred yet (avoids a needless canvas re-mount + double init).
  useEffect(() => {
    if (lastSolveIdRef.current !== solve.id) {
      if (lastSolveIdRef.current !== null) {
        setPositionMs(0);
        setCurrentMoveIdx(-1);
        setReplayState("idle");
        setSpeed(1);
        setCanvasKey((k) => k + 1);
      }
      lastSolveIdRef.current = solve.id;
    }
  }, [solve.id]);

  // Use solve.time as the authoritative total (matches the timeline).
  // Falls back to move span only when solve.time is unavailable.
  // Depend on primitive/value properties only (not the whole `solve` object)
  // to avoid recomputing on every prop-reference change.
  const moves = useMemo(() => solve.moves ?? [], [solve.moves]);

  // MOVE-DRIVEN timeline: duration comes from the move count (each move
  // gets a fixed slot), NOT from solve.time. This guarantees every move
  // plays back no matter how fast the solve was.
  const totalMs = useMemo(
    () => Math.max(1, moves.length) * REPLAY_MOVE_SPACING_MS,
    [moves.length],
  );

  const hasMoves = moves.length >= 2;
  const totalMoves = moves.length;

  // ── Live stats (derived from current move index) ────────────────────────
  const liveStats = useMemo(() => {
    if (currentMoveIdx < 0 || currentMoveIdx >= moves.length) return null;
    const move = moves[currentMoveIdx];
    // The written token for this event (wides carry it via displayNotation).
    const rawNotation =
      move.displayNotation ??
      move.face + (move.direction === 2 ? "2" : move.direction === -1 ? "'" : "");
    // Reconstruction records replay RAW solver-frame letters — the notation
    // IS already the solver's own (no remapping). Smart-cube solves store
    // PHYSICAL (cube-frame) moves and need the dynamic remap to the solver's
    // perspective via the orientation active at this move (right is always
    // right).
    let notation: string;
    if (solve.replayMovesConjugated === false) {
      notation = rawNotation;
    } else if (move.displayNotation) {
      notation = move.displayNotation;
    } else {
      const orientationIndex = getOrientationAtIndex(
        solve.orientationTimeline,
        currentMoveIdx,
      );
      const orientationEntry =
        OrientationTable.ENTRIES[orientationIndex] ?? OrientationTable.IDENTITY;
      notation = MoveTransformer.toDisplayNotation(move, orientationEntry);
    }

    // Find current phase from analysis phases (cumulative move counts)
    const phases = solve.analysis?.phases ?? [];
    let phaseName: string | null = null;
    let phaseProgress = "";
    let cumulative = 0;
    for (const p of phases) {
      const start = cumulative;
      cumulative += p.moveCount;
      if (currentMoveIdx < cumulative) {
        phaseName = p.phaseName;
        const done = currentMoveIdx - start + 1;
        phaseProgress = `${done}/${p.moveCount}`;
        break;
      }
    }

    return { notation, phaseName, phaseProgress };
  }, [
    currentMoveIdx,
    moves,
    solve.analysis?.phases,
    solve.orientationTimeline,
    solve.replayMovesConjugated,
  ]);

  /**
   * Clean up worker + engine resources.
   * Called both on collapse and on unmount.
   */
  const teardownWorker = useCallback(() => {
    engineRef.current?.dispose();
    engineRef.current = null;
    workerProxyRef.current = null;
    cubeReadyRef.current = false;
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
  }, []);

  // ── Responsive resize via ResizeObserver ──────────────────────────────────
  const resizeRef = useRef<{ w: number; h: number } | null>(null);
  const resizeRafRef = useRef<number | null>(null);

  const scheduleResize = useCallback((width: number, height: number) => {
    resizeRef.current = { w: width, h: height };
    if (resizeRafRef.current == null) {
      resizeRafRef.current = requestAnimationFrame(() => {
        resizeRafRef.current = null;
        if (!resizeRef.current || !workerProxyRef.current || !cubeReadyRef.current) return;
        const { w, h } = resizeRef.current;
        workerProxyRef.current.resize(w, h).catch((err: unknown) => {
          console.warn("[Replay] resize failed", err);
        });
      });
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current || !isExpanded) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width >= 20 && height >= 20) {
          scheduleResize(Math.round(width), Math.round(height));
        }
      }
    });
    observer.observe(containerRef.current);
    return () => {
      observer.disconnect();
      if (resizeRafRef.current != null) {
        cancelAnimationFrame(resizeRafRef.current);
        resizeRafRef.current = null;
      }
    };
  }, [scheduleResize, canvasKey, isExpanded]);

  // ── Initialize mini cube worker ─────────────────────────────────────────
  // Lazily init the cube worker only when expanded.
  // On collapse, fully tear down everything so re-expand starts fresh.
  //
  // NOTE: `onReplayPosition` and `onReplayComplete` are deliberately EXCLUDED
  // from the deps array. They are inline arrow functions in the parent
  // (SolveAnalysisPanel) and recreating them every render would cause the
  // effect to teardown and recreate the Web Worker on every animation frame
  // during playback, making replay impossible. Since these callbacks only
  // call stable React state setters (which are identity-stable), using the
  // closure-captured values is safe.
  useEffect(() => {
    if (!isExpanded) {
      teardownWorker();
      // Force fresh canvas on re-expand — transferControlToOffscreen() is
      // a one-way operation that can only be called once per element.
      setCanvasKey((k) => k + 1);
      // Reset playback state when collapsing so re-opening shows the correct
      // UI (idle button, not a stale "playing" from before collapse).
      setReplayState("idle");
      setPositionMs(0);
      setCurrentMoveIdx(-1);
      return;
    }

    // Guard: don't re-init if worker already exists (prevents thrash on
    // parent re-renders during playback).
    if (!canvasRef.current || workerRef.current) return;

    // Guard: skip if this canvas is stale from a previous solve-change
    // render — the canvasKey has been incremented but the DOM hasn't
    // re-rendered yet. Wait for the next commit with a fresh canvas.
    if (canvasGenRef.current >= canvasKey) return;
    canvasGenRef.current = canvasKey;

    let cancelled = false;

    (async () => {
      try {
        // Dynamic import — Vite treats ?worker suffix as a Web Worker entry
        const mod = await import(
          "@cubeforge/cube-3d-engine/worker?worker"
        );
        if (cancelled) return;

        // Comlink namespace — import returns the full module object
        const Comlink = await import("comlink");
        if (cancelled) return;

        const EngineWorker = mod.default;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const worker = new (EngineWorker as any)();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const proxy = Comlink.wrap<any>(worker);

        workerRef.current = worker;
        workerProxyRef.current = proxy;

        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;

        const offscreen = canvas.transferControlToOffscreen();
        // 2×2 solves render a 2×2 mini cube (order=2); everything else is 3×3.
        // Cube3DEngine/CubeModel already support order 2 — same FACE_ROTATION_MAP
        // layerValues (±1) apply unchanged, so the replay moves work as-is.
        const puzzleOrder =
          solveRef.current.puzzleType === "222" ||
          solveRef.current.puzzleType === "2x2"
            ? 2
            : 3;

        const container = containerRef.current;
        const rect = container?.getBoundingClientRect();
        const initW = rect && rect.width > 0 ? Math.round(rect.width) : (canvas.clientWidth || 300);
        const initH = rect && rect.height > 0 ? Math.round(rect.height) : (canvas.clientHeight || 300);

        await proxy.init(
          Comlink.transfer(offscreen, [offscreen]),
          initW,
          initH,
          window.devicePixelRatio,
          puzzleOrder,
        );

        cubeReadyRef.current = true;

        // Apply current skin style & floating stickers to the replay cube
        const currentSkin = getSkinStyle(preferencesStore.getState().appearance3d);
        const floatingStickers = preferencesStore.getState().replayFloatingStickers;
        proxy.updateStyle({
          ...currentSkin,
          floatingStickers,
        }).catch((err: unknown) =>
          console.warn("[Replay] Initial skin update failed", err),
        );

        // Set isometric camera angle so 3 faces are visible
        await proxy.setIsometricView();

        // Set up the replay engine
        const latest = solveRef.current;
        const moves = latest.moves ?? [];
        if (moves.length >= 2) {
          const orientationTimeline = latest.orientationTimeline;
          // The orientation timeline rotates the cube ROOT to the solver's
          // grip (inspection pre-roll before move 1 + mid-solve keyframes)
          // while the CONJUGATED moves play in the cube's own frame — the
          // cube both SOLVES (conjugated = base-frame) and follows the
          // solver's perspective (root grip), ending solved in the solver's
          // frame. Slices/wides/smartcube all share this path.
          const engine = new ReplayEngine(moves, {
            resetCube: () => proxy.resetCube(),
            rotateLayers: (
              axis: string,
              layers: number[],
              angle: number,
              dur: number,
              elapsed?: number,
            ) => proxy.rotateLayers(axis, layers, angle, dur, elapsed ?? 0),
            setOrientation: orientationTimeline
              ? (orientationIndex: number, animationDurationMs?: number) => proxy.setCubeOrientation(orientationIndex, animationDurationMs ?? 0)
              : undefined,
            // Force-complete any move still turning in the replay worker BEFORE
            // a reset/seek — otherwise the stale animation snaps after the
            // reset and re-applies its rotation on top of the fresh state
            // ("cube colors lost/buggy" after Restart / step / fast seeks).
            flushAnimations: () => proxy.flushAnimations(),
            // Move-driven timeline: length = moves × spacing (not solve.time),
            // so all moves always play back.
          }, moves.length * REPLAY_MOVE_SPACING_MS, orientationTimeline);
          engine.moveAnimationDurationMs = 350;
          engine.moveSpacingMs = REPLAY_MOVE_SPACING_MS;
          // Whole-cube grips (inspection pre-roll + mid-solve rotations) turn
          // slowly — they are the solver turning the cube in hand, not moves.
          // The pre-roll re-enacts the solver's inspection grip; only
          // reconstruction solves (conjugated moves) get it — smart-cube IMU
          // timelines can carry a merely-held first orientation that never
          // rotated during the solve window.
          engine.preRollDurationMs = 600;
          engine.orientationAnimationDurationMs = 280;
          engine.preRollEnabled = latest.replayMovesConjugated === true;
          engineRef.current = engine;

          // Apply the scramble so the cube starts in the scrambled
          // state at position 0, then solve moves take it to solved.
          if (latest.scramble) {
            try {
              await engine.applyInitialScramble(latest.scramble);
            } catch (e) {
              console.warn("[Replay] Scramble apply failed:", e);
            }
          }

          engine.onPosition = (pos, idx) => {
            if (!cancelled) {
              setPositionMs(pos);
              setCurrentMoveIdx(idx);
              onReplayPosition?.(pos, idx);
            }
          };
          // Randomized turn click on every applied replay move (fired by the
          // tick loop and step-forward; seeks never fire onMove, so fast-
          // forwarding stays silent).
          engine.onMove = () => cubeTurnSounds.play();
          // Warm up the sample pool so the first move clicks immediately.
          cubeTurnSounds.preload();
          engine.onComplete = () => {
            if (!cancelled) {
              setReplayState("complete");
              onReplayComplete?.();
            }
          };
          engine.onStateChange = (state) => {
            if (!cancelled) setReplayState(state);
          };

          // Sync React state with engine state — the constructor already
          // fired setState('idle') via setMoves(), but onStateChange was
          // still null at that point, so the React state never got updated.
          // Without this, a stale "playing" from before collapse persists.
          setReplayState("idle");

          // A phase-row seek requested before the engine finished
          // initializing (collapsed section or worker still warming up)
          // applies now that the engine is ready.
          if (pendingSeekRef.current != null) {
            const target = pendingSeekRef.current;
            pendingSeekRef.current = null;
            if (target < 0) {
              void engine.seek(0);
            } else {
              const clamped = Math.min(target, moves.length - 1);
              const targetMs = (clamped + 1) * REPLAY_MOVE_SPACING_MS - 1;
              void engine.seek(targetMs);
            }
          }
        }
      } catch (err) {
        console.warn("[Replay] Mini cube init failed:", err);
      }
    })();

    return () => {
      cancelled = true;
      teardownWorker();
      canvasGenRef.current = -1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpanded, canvasKey]);

  // ── Cleanup on unmount — also reset playback state ─────────────────────
  useEffect(() => {
    return () => {
      teardownWorker();
    };
  }, [teardownWorker]);

  // ── Controls ────────────────────────────────────────────────────────────

  const handlePlayPause = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) return;

    if (replayState === "playing") {
      engine.pause();
    } else {
      await engine.play();
    }
  }, [replayState]);

  const handleSeekForward = useCallback(() => {
    engineRef.current?.stepForward();
  }, []);

  const handleSeekBackward = useCallback(() => {
    engineRef.current?.stepBackward();
  }, []);

  const handleSetSpeed = useCallback((newSpeed: number) => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setSpeed(newSpeed);
    setSpeed(newSpeed);
  }, []);

  const handleRestart = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.pause();
    await engine.seek(0);
  }, []);

  const canPlay = hasMoves && replayState !== "seeking";

  // ── Imperative seek (driven by phase rows in the detection panel) ───────

  const seekToMove = useCallback(
    async (moveIndex: number): Promise<void> => {
      pendingSeekRef.current = moveIndex;
      // Clicking a phase row while the section is collapsed must still work:
      // expand (re-inits the engine) and apply the seek once it's ready.
      if (collapsible) {
        setExpanded(true);
      }
      const engine = engineRef.current;
      if (!engine) return; // the init effect applies the pending seek
      engine.pause();
      if (moveIndex < 0) {
        await engine.seek(0);
      } else {
        const clampedMove = Math.min(moveIndex, moves.length - 1);
        const targetMs = (clampedMove + 1) * REPLAY_MOVE_SPACING_MS - 1;
        await engine.seek(targetMs);
      }
      if (pendingSeekRef.current === moveIndex) pendingSeekRef.current = null;
    },
    [collapsible, moves.length],
  );

  useImperativeHandle(ref, () => ({ seekToMove }), [seekToMove]);

  return (
    <div
      className={cn(
        "rounded-lg border border-line bg-surface px-5 py-4",
        size === "large" ? "flex flex-col h-full w-full min-h-0" : "",
        isFullscreen
          ? "fixed inset-0 z-50 flex flex-col h-screen w-screen m-0 rounded-none border-0 bg-background/98 backdrop-blur-xl p-4 sm:p-6 shadow-2xl"
          : "",
        className,
      )}
    >
      {/* Fullscreen top navigation bar */}
      {isFullscreen && (
        <div className="flex items-center justify-between w-full shrink-0 mb-3 px-1">
          <SectionHeader
            title={t("replay.title")}
            eyebrow={hasMoves ? t("replay.movesCount", { count: totalMoves }) : undefined}
          />
          <button
            onClick={() => setIsFullscreen(false)}
            className="flex items-center gap-1.5 rounded-lg border border-line/60 bg-surface px-3 py-1.5 text-xs text-ink-2 hover:bg-surface-2 hover:text-ink transition-colors cursor-pointer shadow-xs"
            title={t("replay.exitFullscreen")}
          >
            <Minimize2 className="size-3.5" />
            <span className="text-[0.72rem] font-medium hidden sm:inline">{t("replay.exitFullscreen")}</span>
            <kbd className="text-[0.6rem] bg-line/80 px-1 py-0.5 rounded text-ink-3">ESC</kbd>
          </button>
        </div>
      )}

      {/* Normal Header */}
      {!isFullscreen && showHeader && (
        collapsible ? (
          <button
            onClick={() => setExpanded((prev) => !prev)}
            className="flex w-full items-center justify-between text-left shrink-0 cursor-pointer"
          >
            <SectionHeader
              title={t("replay.title")}
              eyebrow={isExpanded && hasMoves ? t("replay.movesCount", { count: totalMoves }) : undefined}
            />
            <span className="text-ink-3 transition-transform duration-200">
              {expanded ? (
                <ChevronDown className="size-4" />
              ) : (
                <ChevronRight className="size-4" />
              )}
            </span>
          </button>
        ) : (
          <div className="flex w-full items-center justify-between shrink-0 mb-3">
            <SectionHeader
              title={t("replay.title")}
              eyebrow={hasMoves ? t("replay.movesCount", { count: totalMoves }) : undefined}
            />
          </div>
        )
      )}

      {/* Content */}
      {isExpanded && (
        <div className={cn(size === "large" || isFullscreen ? "flex-1 min-h-0 flex flex-col w-full" : "mt-3")}>
          {!hasMoves ? (
            <div className="flex flex-1 items-center justify-center py-6 text-center text-[0.72rem] text-ink-3">
              {t("replay.noMoveData")}{" "}
              {solve.source === "manual"
                ? t("replay.noMoveDataManual")
                : t("replay.noMoveDataSmartCube")}
            </div>
          ) : (
            <div
              className={cn(
                "flex flex-col items-center gap-3",
                size === "large" || isFullscreen ? "flex-1 min-h-0 w-full justify-between" : "",
              )}
            >
              {/* Mini cube 3D — "large" or fullscreen fills the viewport dynamically */}
              <div
                ref={containerRef}
                className={cn(
                  "relative overflow-hidden flex items-center justify-center",
                  size === "large" || isFullscreen
                    ? "flex-1 w-full min-h-0 bg-transparent border-0 rounded-lg"
                    : "w-full aspect-square max-w-xs rounded-xl bg-surface-2/30 border border-line/40",
                )}
              >
                <canvas
                  key={canvasKey}
                  ref={canvasRef}
                  className="h-full w-full block cursor-grab active:cursor-grabbing"
                  onPointerDown={(e) => {
                    isDraggingRef.current = true;
                    lastPointerRef.current = { x: e.clientX, y: e.clientY };
                    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
                  }}
                  onPointerMove={(e) => {
                    if (!isDraggingRef.current || !workerProxyRef.current) return;
                    const dx = e.clientX - lastPointerRef.current.x;
                    const dy = e.clientY - lastPointerRef.current.y;
                    lastPointerRef.current = { x: e.clientX, y: e.clientY };
                    workerProxyRef.current.rotateCamera(dx, dy).catch(console.error);
                  }}
                  onPointerUp={(e) => {
                    isDraggingRef.current = false;
                    (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId);
                  }}
                  onPointerCancel={(e) => {
                    isDraggingRef.current = false;
                    (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId);
                  }}
                />

                {/* Progress bar overlay at bottom of canvas */}
                {totalMs > 0 && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-line/40">
                    <div
                      className="h-full bg-phase-blue-500/80 transition-[width] duration-75 ease-out"
                      style={{ width: `${Math.min(100, Math.max(0, (positionMs / totalMs) * 100))}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Controls bar */}
              <div
                className={cn(
                  "flex flex-col gap-2 w-full shrink-0",
                  size === "large" || isFullscreen ? "max-w-2xl mx-auto px-1 pb-1" : "max-w-xs",
                )}
              >
                {/* Top row: live move stats */}
                <div className="flex items-center justify-between gap-2 px-1 text-xs">
                  {/* Left: Phase badge and move notation */}
                  <div className="flex items-center gap-2 min-w-0">
                    {replayState === "complete" ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-ready/15 px-2.5 py-0.5 text-[0.7rem] font-semibold text-ready">
                        <Check className="size-3" />
                        {t("replay.solved")}
                      </span>
                    ) : liveStats ? (
                      <div className="flex items-center gap-1.5 min-w-0">
                        {liveStats.phaseName && (
                          <span className="inline-flex items-center gap-1 rounded bg-surface-2 px-2 py-0.5 text-[0.68rem] font-medium tracking-wide uppercase text-ink-2">
                            <span>{liveStats.phaseName}</span>
                            <span className="nums opacity-75 text-[0.64rem] font-semibold text-ink">
                              ({liveStats.phaseProgress})
                            </span>
                          </span>
                        )}
                        {liveStats.notation && (
                          <span className="rounded-md bg-ink px-2 py-0.5 font-mono text-[0.75rem] font-bold text-background shadow-xs">
                            {liveStats.notation}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[0.68rem] font-medium text-ink-3">
                        {currentMoveIdx < 0 ? t("replay.startState") : "—"}
                      </span>
                    )}
                  </div>

                  {/* Right: move counter */}
                  <div className="flex items-center gap-1 shrink-0 nums text-[0.72rem] text-ink-3">
                    <span className="font-semibold text-ink">
                      {Math.max(0, currentMoveIdx + 1)}
                    </span>
                    <span className="opacity-60"> / {totalMoves}</span>
                  </div>
                </div>

                {/* Bottom row: transport buttons */}
                <div className="flex items-center gap-1.5 sm:gap-2 rounded-xl bg-surface-2/50 border border-line/60 p-1.5 sm:px-2.5">
                  {/* Restart */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={handleRestart}
                        disabled={!canPlay}
                        className="grid size-8 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink active:scale-95 disabled:opacity-30 cursor-pointer"
                        aria-label={t("replay.restartAria")}
                      >
                        <RotateCcw className="size-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">{t("replay.restart")}</TooltipContent>
                  </Tooltip>

                  {/* Step backward */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={handleSeekBackward}
                        disabled={!canPlay || currentMoveIdx < 0}
                        className="grid size-8 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink active:scale-95 disabled:opacity-30 cursor-pointer"
                        aria-label={t("replay.stepBackwardAria")}
                      >
                        <SkipBack className="size-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">{t("replay.stepBackward")}</TooltipContent>
                  </Tooltip>

                  {/* Play / Pause */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={handlePlayPause}
                        disabled={!canPlay}
                        className={cn(
                          "grid size-9 place-items-center rounded-full transition-all duration-150 active:scale-95 disabled:opacity-30 cursor-pointer shadow-xs",
                          replayState === "playing"
                            ? "bg-ink text-background hover:bg-ink/90 hover:scale-105"
                            : "bg-phase-blue-500 text-white hover:bg-phase-blue-600 hover:scale-105",
                        )}
                        aria-label={
                          replayState === "playing" ? t("replay.pause") : t("replay.play")
                        }
                      >
                        {replayState === "playing" ? (
                          <Pause className="size-4" />
                        ) : (
                          <Play className="size-4 pl-0.5" />
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      {replayState === "playing" ? t("replay.pause") : t("replay.play")}
                    </TooltipContent>
                  </Tooltip>

                  {/* Step forward */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={handleSeekForward}
                        disabled={!canPlay || currentMoveIdx >= totalMoves - 1}
                        className="grid size-8 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink active:scale-95 disabled:opacity-30 cursor-pointer"
                        aria-label={t("replay.stepForwardAria")}
                      >
                        <SkipForward className="size-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">{t("replay.stepForward")}</TooltipContent>
                  </Tooltip>

                  {/* Spacer */}
                  <span className="flex-1" />

                  {/* Speed selector */}
                  <div className="flex items-center gap-0.5 rounded-lg border border-line/70 bg-surface/80 p-0.5">
                    {SPEEDS.map((s) => (
                      <Tooltip key={s}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => handleSetSpeed(s)}
                            className={cn(
                              "rounded px-2 py-1 text-[0.66rem] font-semibold tracking-wider transition-all duration-150 cursor-pointer",
                              speed === s
                                ? "bg-ink text-background shadow-xs"
                                : "text-ink-3 hover:text-ink hover:bg-surface-2",
                            )}
                          >
                            {s}x
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">{t("replay.speed", { speed: s })}</TooltipContent>
                      </Tooltip>
                    ))}
                  </div>

                  {/* Fullscreen toggle */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setIsFullscreen((prev) => !prev)}
                        className="grid size-8 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink active:scale-95 cursor-pointer"
                        aria-label={isFullscreen ? t("replay.exitFullscreen") : t("replay.fullscreen")}
                      >
                        {isFullscreen ? (
                          <Minimize2 className="size-3.5" />
                        ) : (
                          <Maximize2 className="size-3.5" />
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      {isFullscreen ? t("replay.exitFullscreen") : t("replay.fullscreen")}
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
