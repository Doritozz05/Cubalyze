"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { formatTime } from "@/utils/formatTime";
import { phaseColorHex } from "@/utils/phaseColors";
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
/** Blue used for replay accents (matches the Cross phase color in phaseColors). */
const REPLAY_BLUE = "#4F8CF7";

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

/** Get the phase color for a given position in the solve timeline. */
function getPhaseAtPosition(solve: Solve, positionMs: number): string {
  if (!solve.analysis?.phases || solve.analysis.phases.length === 0)
    return "#6B7280";
  let cumulativeMs = 0;
  for (let i = 0; i < solve.analysis.phases.length; i++) {
    const p = solve.analysis.phases[i];
    cumulativeMs += p.durationMs;
    if (positionMs <= cumulativeMs) return phaseColorHex(p.phaseName, i);
  }
  return phaseColorHex(
    solve.analysis.phases[solve.analysis.phases.length - 1].phaseName,
    solve.analysis.phases.length - 1,
  );
}

/** Build progress bar segments from analysis phases. */
function buildProgressSegments(solve: Solve, totalMs: number) {
  if (!solve.analysis?.phases || totalMs <= 0) return [];

  const segments: {
    name: string;
    color: string;
    startPct: number;
    endPct: number;
  }[] = [];
  let cumulativeMs = 0;

  for (let i = 0; i < solve.analysis.phases.length; i++) {
    const p = solve.analysis.phases[i];
    const startPct = (cumulativeMs / totalMs) * 100;
    cumulativeMs += p.durationMs;
    const endPct = (cumulativeMs / totalMs) * 100;
    segments.push({
      name: p.phaseName,
      color: phaseColorHex(p.phaseName, i),
      startPct,
      endPct,
    });
  }
  return segments;
}

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

  const engineRef = useRef<ReplayEngine | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Refs for the mini-cube worker
  const workerRef = useRef<Worker | null>(null);
  /** Comlink.Remote<EngineWorkerAPI> but typed loosely due to dynamic import. */
  const workerProxyRef = useRef<any>(null);
  const cubeReadyRef = useRef(false);

  const totalMs = useMemo(() => {
    const moves = solve.moves ?? [];
    if (moves.length < 2) return solve.time;
    return moves[moves.length - 1].hostTimestamp - moves[0].hostTimestamp;
  }, [solve]);

  const hasMoves = (solve.moves?.length ?? 0) >= 2;

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
    if (!expanded) {
      teardownWorker();
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
          const engine = new ReplayEngine(moves, {
            resetCube: () => proxy.resetCube(),
            rotateLayers: (
              axis: string,
              layers: number[],
              angle: number,
              dur: number,
              elapsed?: number,
            ) => proxy.rotateLayers(axis, layers, angle, dur, elapsed ?? 0),
          });
          engine.moveAnimationDurationMs = 70;
          engineRef.current = engine;

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

  const handlePlayPause = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;

    if (replayState === "playing") {
      engine.pause();
    } else {
      engine.play();
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

  const handleRestart = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.seek(0);
    setPositionMs(0);
    setCurrentMoveIdx(-1);
    setTimeout(() => engine.play(), 50);
  }, []);

  // ── Compute phase position for the progress bar ────────────────────────
  const phaseColor = getPhaseAtPosition(solve, positionMs);
  const progressPct = totalMs > 0 ? (positionMs / totalMs) * 100 : 0;
  const progressSegments = buildProgressSegments(solve, totalMs);
  const totalMoves = solve.moves?.length ?? 0;

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
              <div className="flex items-start gap-4">
                {/* Mini cube 3D */}
                <div
                  ref={containerRef}
                  className="relative size-28 shrink-0 overflow-hidden rounded-lg border border-line bg-black/5"
                >
                  <canvas
                    ref={canvasRef}
                    width={160}
                    height={160}
                    className="h-full w-full"
                  />
                  {/* Play-overlay when stopped/idle */}
                  {replayState === "idle" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-[1px] transition-opacity">
                      <Play className="size-8 text-white/70 drop-shadow-sm" />
                    </div>
                  )}
                </div>

                {/* Controls column */}
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  {/* Time display */}
                  <div className="flex items-baseline gap-1.5">
                    <span className="nums text-lg font-semibold text-ink tabular-nums">
                      {formatTime(positionMs)}
                    </span>
                    <span className="nums text-xs text-ink-3">
                      / {formatTime(totalMs)}
                    </span>
                  </div>

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

                  {/* Move counter */}
                  <div className="text-[0.6rem] text-ink-3">
                    Move{" "}
                    <span className="nums font-medium text-ink-2">
                      {Math.max(0, currentMoveIdx + 1)}
                    </span>{" "}
                    / <span className="nums text-ink-2">{totalMoves}</span>
                  </div>
                </div>
              </div>

              {/* Phase-colored progress bar */}
              <div className="relative h-3">
                {/* Background segments */}
                <div className="absolute inset-0 flex overflow-hidden rounded-full bg-line/30">
                  {progressSegments.map((seg, i) => (
                    <div
                      key={seg.name}
                      className="h-full transition-opacity"
                      style={{
                        width: `${seg.endPct - seg.startPct}%`,
                        backgroundColor: seg.color,
                        opacity: 0.25,
                      }}
                      title={seg.name}
                    />
                  ))}
                </div>

                {/* Playhead dot */}
                <div
                  className="absolute top-1/2 z-10 -translate-y-1/2 transition-[left] duration-75"
                  style={{ left: `${Math.min(progressPct, 100)}%` }}
                >
                  <div
                    className="size-2.5 rounded-full border-2 border-white shadow-md"
                    style={{ backgroundColor: phaseColor }}
                  />
                </div>
              </div>

              {/* Phase labels under the bar */}
              <div className="flex justify-between text-[0.5rem] uppercase tracking-wider text-ink-3">
                {progressSegments.map((seg, i) => (
                  <span key={seg.name}>{seg.name}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
