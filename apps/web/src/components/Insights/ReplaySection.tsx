"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { formatTime } from "@/utils/formatTime";
import { SectionHeader } from "./atoms";
import type { Solve } from "@/types";
import { ReplayEngine, type ReplayState, getSkinStyle } from "@cubeforge/cube-3d-engine";
import { useStore } from "zustand";
import { preferencesStore } from "@cubeforge/state";
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

  // ── Reactive appearance (skin) — watch user preference ──────────────
  const appearance3d = useStore(preferencesStore, (s) => s.appearance3d);

  // Push skin changes to the replay worker whenever the user changes skin
  useEffect(() => {
    if (!workerProxyRef.current || !cubeReadyRef.current) return;
    const style = getSkinStyle(appearance3d);
    workerProxyRef.current
      .updateStyle(style)
      .catch((err: unknown) => console.warn("[Replay] updateStyle failed", err));
  }, [appearance3d]);

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
  const firstMoveTimestamp = moves[0]?.hostTimestamp;
  const lastMoveTimestamp = moves[moves.length - 1]?.hostTimestamp;

  const totalMs = useMemo(() => {
    if (solve.time > 0) return solve.time;
    if (moves.length < 2) return solve.time;
    return (lastMoveTimestamp ?? 0) - (firstMoveTimestamp ?? 0);
  }, [solve.time, moves.length, firstMoveTimestamp, lastMoveTimestamp]);

  const hasMoves = moves.length >= 2;
  const totalMoves = moves.length;

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
        await proxy.init(
          Comlink.transfer(offscreen, [offscreen]),
          canvas.clientWidth || 160,
          canvas.clientHeight || 160,
          window.devicePixelRatio,
        );

        cubeReadyRef.current = true;

        // Apply current skin style to the replay cube
        const currentSkin = getSkinStyle(preferencesStore.getState().appearance3d);
        proxy.updateStyle(currentSkin).catch((err: unknown) =>
          console.warn("[Replay] Initial skin update failed", err),
        );

        // Set isometric camera angle so 3 faces are visible
        await proxy.setIsometricView();

        // Set up the replay engine
        const latest = solveRef.current;
        const moves = latest.moves ?? [];
        if (moves.length >= 2) {
          const orientationTimeline = latest.orientationTimeline;
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
          }, latest.time, orientationTimeline);
          engine.moveAnimationDurationMs = 70;
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
  }, [expanded, canvasKey]);

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
            <div className="flex flex-col gap-3 items-center">
              {/* Mini cube 3D — centered, max-w-sm for compactness */}
              <div
                ref={containerRef}
                className="relative w-full max-w-xs aspect-square overflow-hidden rounded-lg bg-black/3"
              >
                <canvas
                  key={canvasKey}
                  ref={canvasRef}
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

                {/* Progress bar overlay at bottom of canvas */}
                {totalMs > 0 && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-line/40">
                    <div
                      className="h-full bg-blue-500/60 transition-[width] duration-75 linear"
                      style={{ width: `${Math.min(100, (positionMs / totalMs) * 100)}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Controls bar — centered, max-w-sm */}
              <div className="flex flex-col gap-2 w-full max-w-xs">
                {/* Top row: time + stats */}
                <div className="flex items-center justify-between">
                  <div className="flex items-baseline gap-1.5">
                    <span className="nums text-xl font-semibold text-ink tabular-nums">
                      {formatTime(positionMs)}
                    </span>
                    <span className="nums text-xs text-ink-3">
                      / {formatTime(totalMs)}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-[0.62rem] text-ink-3">
                    {/* Move counter */}
                    <span className="nums">
                      Move{" "}
                      <span className="font-medium text-ink">
                        {Math.max(0, currentMoveIdx + 1)}
                      </span>
                      /{totalMoves}
                    </span>

                    {/* Current move notation */}
                    {liveStats && (
                      <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono font-medium text-ink text-xs">
                        {liveStats.notation}
                      </span>
                    )}

                    {/* Phase info */}
                    {liveStats?.phaseName && (
                      <span className="flex items-center gap-1">
                        <span className="font-medium uppercase tracking-wide text-ink-2">
                          {liveStats.phaseName}
                        </span>
                        <span className="nums font-semibold text-ink">
                          {liveStats.phaseProgress}
                        </span>
                      </span>
                    )}

                  </div>
                </div>

                {/* Bottom row: transport controls */}
                <div className="flex items-center gap-1.5">
                  {/* Restart */}
                  <button
                    onClick={handleRestart}
                    disabled={!canPlay}
                    className="grid size-8 place-items-center rounded-md text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-30"
                    title="Restart"
                    aria-label="Restart replay"
                  >
                    <RotateCcw className="size-3.5" />
                  </button>

                  {/* Step backward */}
                  <button
                    onClick={handleSeekBackward}
                    disabled={!canPlay}
                    className="grid size-8 place-items-center rounded-md text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-30"
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
                      "grid size-9 place-items-center rounded-full transition-all duration-150 disabled:opacity-30",
                      replayState === "playing"
                        ? "bg-ink text-background hover:bg-ink/80 hover:scale-105"
                        : "bg-blue-500 text-white hover:bg-blue-600 hover:scale-105",
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
                    className="grid size-8 place-items-center rounded-md text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-30"
                    title="Step forward"
                    aria-label="Step forward one move"
                  >
                    <SkipForward className="size-3.5" />
                  </button>

                  {/* Spacer */}
                  <span className="flex-1" />

                  {/* Speed selector */}
                  <div className="flex items-center gap-0.5 rounded-md border border-line/60 p-0.5">
                    {SPEEDS.map((s) => (
                      <button
                        key={s}
                        onClick={() => handleSetSpeed(s)}
                        className={cn(
                          "rounded px-2 py-1 text-[0.62rem] font-medium uppercase tracking-wider transition-all duration-150",
                          speed === s
                            ? "bg-ink text-background"
                            : "text-ink-3 hover:text-ink hover:bg-surface-2",
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
          )}
        </div>
      )}
    </div>
  );
}
