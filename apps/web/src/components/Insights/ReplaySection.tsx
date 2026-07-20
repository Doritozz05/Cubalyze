"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { formatTime } from "@/utils/formatTime";
import { SectionHeader } from "./atoms";
import type { Solve } from "@/types";
import { ReplayEngine, type ReplayState } from "@cubeforge/cube-3d-engine";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

// ─── Constants ─────────────────────────────────────────────────────────────

const SPEEDS = [0.25, 0.5, 1, 2] as const;

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
  className?: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

// ─── ReplaySection ─────────────────────────────────────────────────────────

export function ReplaySection({
  solve,
  onReplayPosition,
  onReplayComplete,
  className,
}: ReplaySectionProps) {
  const [expanded, setExpanded] = useState(true);
  const [replayState, setReplayState] = useState<ReplayState>("idle");
  const [positionMs, setPositionMs] = useState(0);
  const [speed, setSpeed] = useState<number>(1);
  const [currentMoveIdx, setCurrentMoveIdx] = useState(-1);

  // Incremented on each re-init to force a fresh <canvas> DOM element.
  // transferControlToOffscreen() can only be called once per canvas element,
  // so we must recreate the element when the worker is torn down and recreated
  // (e.g., when switching solves or toggling the section).
  const [canvasKey, setCanvasKey] = useState(0);

  const engineRef = useRef<ReplayEngine | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Refs for the mini-cube worker
  const workerRef = useRef<Worker | null>(null);
  /** Comlink.Remote<EngineWorkerAPI> but typed loosely due to dynamic import. */
  const workerProxyRef = useRef<any>(null);
  const cubeReadyRef = useRef(false);

  // Camera drag state for the mini cube
  const isDraggingRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });

  // Use solve.time as the authoritative total (matches the timeline).
  // Falls back to move span only when solve.time is unavailable.
  const totalMs = useMemo(() => {
    if (solve.time > 0) return solve.time;
    const moves = solve.moves ?? [];
    if (moves.length < 2) return solve.time;
    return moves[moves.length - 1].hostTimestamp - moves[0].hostTimestamp;
  }, [solve]);

  const hasMoves = (solve.moves?.length ?? 0) >= 2;
  const totalMoves = solve.moves?.length ?? 0;
  const moves = solve.moves ?? [];

  // ── Live stats (derived from current move index) ────────────────────────
  const liveStats = useMemo(() => {
    if (currentMoveIdx < 0 || currentMoveIdx >= moves.length) return null;
    const move = moves[currentMoveIdx];
    const suffix = move.direction === 2 ? "2" : move.direction === -1 ? "'" : "";
    const notation = `${move.face}${suffix}`;

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
  }, [currentMoveIdx, moves, solve.analysis?.phases]);

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
  }, []);    // ── Initialize mini cube worker ─────────────────────────────────────────
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
    if (!expanded) {
      teardownWorker();
      // Force fresh canvas on re-expand — transferControlToOffscreen() is
      // a one-way operation that can only be called once per element.
      setCanvasKey((k) => k + 1);
      return;
    }

    // Guard: don't re-init if worker already exists (prevents thrash on
    // parent re-renders during playback).
    if (!canvasRef.current || workerRef.current) return;

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
        const worker = new (EngineWorker as any)();
        const proxy = Comlink.wrap<any>(worker);

        workerRef.current = worker;
        workerProxyRef.current = proxy;

        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;

        const offscreen = canvas.transferControlToOffscreen();
        await proxy.init(
          Comlink.transfer(offscreen, [offscreen]),
          canvas.clientWidth || 160,
          canvas.clientHeight || 160,
          window.devicePixelRatio,
        );

        cubeReadyRef.current = true;

        // Set up the replay engine
        const moves = solve.moves ?? [];
        if (moves.length >= 2) {
          const orientationTimeline = solve.orientationTimeline;
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
              ? (orientationIndex: number) => proxy.setCubeOrientation(orientationIndex)
              : undefined,
          }, solve.time, orientationTimeline);
          engine.moveAnimationDurationMs = 70;
          engineRef.current = engine;

          // Apply the scramble so the cube starts in the scrambled
          // state at position 0, then solve moves take it to solved.
          if (solve.scramble) {
            try {
              await engine.applyInitialScramble(solve.scramble);
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
          engine.onComplete = () => {
            if (!cancelled) {
              setReplayState("complete");
              onReplayComplete?.();
            }
          };
          engine.onStateChange = (state) => {
            if (!cancelled) setReplayState(state);
          };
        }
      } catch (err) {
        console.warn("[Replay] Mini cube init failed:", err);
      }
    })();

    return () => {
      cancelled = true;
      teardownWorker();
      // Force fresh canvas on next init (solve change or re-expand).
      // transferControlToOffscreen() is one-way — a new DOM element is needed.
      setCanvasKey((k) => k + 1);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, solve]);

  // ── Cleanup on unmount ──────────────────────────────────────────────────
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
    await engine.seek(0);
    // seek(0) already fires onPosition(0,-1) which sets positionMs/idx —
    // no need to set them again here. Just start playback.
    await engine.play();
  }, []);

  const canPlay = hasMoves && replayState !== "seeking";

  return (
    <div
      className={cn(
        "rounded-lg border border-line bg-surface px-5 py-4",
        className,
      )}
    >
      {/* Header (clickable toggle) */}
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between text-left"
      >
        <SectionHeader
          title="Replay"
          eyebrow={expanded && hasMoves ? `${totalMoves} moves` : undefined}
        />
        <span className="text-ink-3 transition-transform duration-200">
          {expanded ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
        </span>
      </button>

      {/* Collapsible content */}
      {expanded && (
        <div className="mt-3">
          {!hasMoves ? (
            <p className="py-6 text-center text-[0.72rem] text-ink-3">
              No move data available for this solve.{" "}
              {solve.source === "manual"
                ? "Manual entries don't include per-move data."
                : "Connect a Smart Cube to capture moves."}
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {/* Top row: mini cube + controls */}
              <div className="flex items-center gap-4">
                {/* Mini cube 3D — solo el cubo, sin overlay */}
                <div
                  ref={containerRef}
                  className="relative size-56 shrink-0 overflow-hidden rounded-lg border border-line bg-black/5"
                >
                  <canvas
                    key={canvasKey}
                    ref={canvasRef}
                    width={280}
                    height={280}
                    className={cn(
                      "h-full w-full",
                      "cursor-grab active:cursor-grabbing",
                    )}
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
                </div>

                {/* Controls column */}
                <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
                  {/* Time display */}
                  <div className="flex items-baseline gap-1.5">
                    <span className="nums text-lg font-semibold text-ink tabular-nums">
                      {formatTime(positionMs)}
                    </span>
                    <span className="nums text-xs text-ink-3">
                      / {formatTime(totalMs)}
                    </span>
                  </div>

                  {/* Move counter */}
                  {hasMoves && (
                    <p className="text-[0.65rem] text-ink-3">
                      Move{" "}
                      <span className="nums font-medium text-ink">
                        {Math.max(0, currentMoveIdx + 1)}
                      </span>
                      {" / "}
                      <span className="nums text-ink-2">{totalMoves}</span>
                      {liveStats && (
                        <>
                          {" — "}
                          <span className="font-mono font-medium text-ink">
                            {liveStats.notation}
                          </span>
                        </>
                      )}
                    </p>
                  )}

                  {/* Live stats */}
                  {liveStats?.phaseName && (
                    <div className="flex items-center gap-2 border-t border-line/30 pt-1.5">
                      <span className="text-[0.55rem] font-medium uppercase tracking-wider text-ink-3">
                        {liveStats.phaseName}
                      </span>
                      <span className="nums text-[0.65rem] font-semibold text-ink tabular-nums">
                        {liveStats.phaseProgress}
                      </span>
                    </div>
                  )}

                  {/* Orientation count indicator */}
                  {solve.orientationTimeline && solve.orientationTimeline.length > 0 && (
                    <div className="flex items-center gap-1.5 border-t border-line/30 pt-1.5">
                      <span
                        className="inline-block size-2 rounded-full"
                        style={{ backgroundColor: "#a78bfa" }}
                        title="Orientation data available"
                      />
                      <span className="text-[0.55rem] font-medium uppercase tracking-wider text-ink-3">
                        Orientation
                      </span>
                      <span className="nums text-[0.65rem] font-semibold text-ink tabular-nums">
                        {solve.orientationTimeline.length}{" "}
                        <span className="text-[0.5rem] font-normal text-ink-2">
                          keyframe{solve.orientationTimeline.length !== 1 ? "s" : ""}
                        </span>
                      </span>
                    </div>
                  )}

                  {/* Transport controls */}
                  <div className="flex items-center gap-1">
                    {/* Restart */}
                    <button
                      onClick={handleRestart}
                      disabled={!canPlay}
                      className="grid size-7 place-items-center rounded text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-30"
                      title="Restart"
                      aria-label="Restart replay"
                    >
                      <RotateCcw className="size-3.5" />
                    </button>

                    {/* Step backward */}
                    <button
                      onClick={handleSeekBackward}
                      disabled={!canPlay}
                      className="grid size-7 place-items-center rounded text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-30"
                      title="Step backward"
                      aria-label="Step backward one move"
                    >
                      <SkipBack className="size-3.5" />
                    </button>

                    {/* Play / Pause */}
                    <button
                      onClick={handlePlayPause}
                      disabled={!canPlay}
                      className={cn(
                        "grid size-8 place-items-center rounded-full transition-colors disabled:opacity-30",
                        replayState === "playing"
                          ? "bg-ink text-background hover:bg-ink/80"
                          : "bg-blue-500 text-white hover:bg-blue-600",
                      )}
                      title={
                        replayState === "playing" ? "Pause" : "Play"
                      }
                      aria-label={
                        replayState === "playing" ? "Pause" : "Play"
                      }
                    >
                      {replayState === "playing" ? (
                        <Pause className="size-4" />
                      ) : (
                        <Play className="size-4 pl-0.5" />
                      )}
                    </button>

                    {/* Step forward */}
                    <button
                      onClick={handleSeekForward}
                      disabled={!canPlay || currentMoveIdx >= totalMoves - 1}
                      className="grid size-7 place-items-center rounded text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-30"
                      title="Step forward"
                      aria-label="Step forward one move"
                    >
                      <SkipForward className="size-3.5" />
                    </button>

                    {/* Speed selector */}
                    <div className="ml-2 flex items-center gap-0.5 rounded-md border border-line/60 p-0.5">
                      {SPEEDS.map((s) => (
                        <button
                          key={s}
                          onClick={() => handleSetSpeed(s)}
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[0.6rem] font-medium uppercase tracking-wider transition-colors",
                            speed === s
                              ? "bg-ink text-background"
                              : "text-ink-3 hover:text-ink",
                          )}
                          title={`${s}x speed`}
                        >
                          {s}x
                        </button>
                      ))}
                    </div>
                  </div>


                </div>
              </div>


            </div>
          )}
        </div>
      )}
    </div>
  );
}
