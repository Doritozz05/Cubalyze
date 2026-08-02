"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { METHODS } from "@cubeforge/algorithm-db";
import { ScrambleDisplay } from "@/components/Scramble/ScrambleDisplay";
import { useCube3D } from "@/hooks/useCube3D";
import { useCrossScramble } from "@/hooks/useCrossScramble";
import { useTrainingProgress } from "@/hooks/useTrainingProgress";
import { useTrainingSession } from "@/hooks/useTrainingSession";
import { useOrientation } from "@/hooks/useOrientation";
import { TrainingBreadcrumb, StatChip, TouchAside } from "./components";
import {
  ReplayEngine,
  type ReplayState,
} from "@cubeforge/cube-3d-engine";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  Shuffle,
  Crosshair,
  Target,
  Flame,
  Clock,
  Lightbulb,
  Layers,
  Eye,
  EyeOff,
  Palette,
} from "lucide-react";

/* ──────────────────────────────────────────────────────────────────────────
   CrossTrainerView

   A no-timer cross trainer that adapts or18's RubiksSolverDemo cross_trainer
   to our systems. Reuses (NOT rebuilds):
     • useCrossScramble  — way-to-cross scramble + optimal solution + replay moves
     • useCube3D         — main-thread Cube3DEngine on the live canvas (engineRef)
     • ReplayEngine      — drives the optimal-solution 3D replay on the SAME canvas,
                           including applyInitialScramble() for the scramble state
     • setPhaseStickering — highlights the 4 cross edges on the 3D cube
     • ScrambleDisplay   — scramble token display
     • TrainingBreadcrumb / StatChip — shared training UI atoms
     • useTrainingProgress.recordAttempt — persists attempts (move count metadata)

   Layout: 3 columns — scramble + live/stickering cube | optimal replay + move
   entry | stats. No TimerContainer: the user enters their planned move count
   manually and the trainer grades efficiency against the optimal depth.
   ─────────────────────────────────────────────────────────────────────── */

export interface CrossTrainerViewProps {
  methodId: string;
  phaseId: string;
  phaseName: string;
  onBack: () => void;
}

const DEPTHS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
const SPEEDS = [0.25, 0.5, 1, 2] as const;
const FACES = ["D", "U", "F", "B", "R", "L"] as const;

interface CrossAttempt {
  id: string;
  userMoves: number;
  optimalDepth: number;
  face: string;
  scramble: string;
  timestamp: number;
  efficient: boolean;
}

let _attemptId = 0;
function nextAttemptId(): string {
  return `cross-${++_attemptId}-${Date.now()}`;
}

export function CrossTrainerView({
  methodId,
  phaseId,
  phaseName,
  onBack,
}: CrossTrainerViewProps) {
  const method = useMemo(() => METHODS.find((m) => m.id === methodId), [methodId]);

  // ── Scramble + optimal solution data ─────────────────────────────────
  // face=undefined → color-neutral (CN). Initial face is "D" (white cross).
  const [cnMode, setCnMode] = useState(false);
  const [activeFace, setActiveFace] = useState<string | undefined>("D");
  const cross = useCrossScramble({
    depth: 5,
    face: cnMode ? undefined : activeFace,
    maxRetries: 300,
  });

  // ── 3D cube (main-thread engine on this canvas) ──────────────────────
  const {
    canvasRef,
    containerRef,
    isReady,
    initFailed,
    contextEvicted,
    calibrate,
    reset,
    engineRef,
  } = useCube3D({ maxRecentMoves: 0 });

  // ── Orientation (remap scramble display to user's cube orientation) ──
  const { remapScramble } = useOrientation();
  const displayScramble = remapScramble(cross.scramble);

  // ── Replay engine (drives the SAME main-thread Cube3DEngine) ─────────
  const replayRef = useRef<ReplayEngine | null>(null);
  const [replayState, setReplayState] = useState<ReplayState>("idle");
  const [positionMs, setPositionMs] = useState(0);
  const [currentMoveIdx, setCurrentMoveIdx] = useState(-1);
  const [speed, setSpeed] = useState<number>(1);

  // ── Stickering state: show cross highlight when not replaying ────────
  const [stickeringOn, setStickeringOn] = useState(true);
  const [showOptimal, setShowOptimal] = useState(false);

  // ── Manual move-count entry ──────────────────────────────────────────
  const [userMoves, setUserMoves] = useState<number | null>(null);
  const [attempts, setAttempts] = useState<CrossAttempt[]>([]);

  // ── Persist attempts to the DB ───────────────────────────────────────
  const { recordAttempt: dbPersistAttempt } = useTrainingProgress();
  const { sessionId } = useTrainingSession({
    exerciseId: `cross-trainer-${phaseId}`,
    methodId,
    phaseId,
  });

  // ── Build the ReplayEngine + apply scramble via applyInitialScramble
  //    (reuses ReplayEngine's own scramble parsing — no duplicated
  //    FACE_ROTATION_MAP logic, no dynamic import).
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !isReady || cross.replayMoves.length === 0) return;

    let cancelled = false;

    // Dispose any previous replay engine.
    replayRef.current?.dispose();
    replayRef.current = null;

    const replay = new ReplayEngine(
      cross.replayMoves,
      {
        resetCube: () => {
          engine.resetCube();
        },
        rotateLayers: (axis, layers, angle, dur, elapsed) =>
          engine.rotateLayers(axis, layers, angle, dur, elapsed ?? 0),
      },
      cross.replayMoves.length * 600,
    );
    replay.moveAnimationDurationMs = 120;
    replay.onPosition = (pos, idx) => {
      if (!cancelled) {
        setPositionMs(pos);
        setCurrentMoveIdx(idx);
      }
    };
    replay.onStateChange = (s) => {
      if (!cancelled) setReplayState(s);
    };
    replayRef.current = replay;

    // Reset display state for the new scramble.
    setPositionMs(0);
    setCurrentMoveIdx(-1);
    setReplayState("idle");

    // Reset the visual cube to solved, then apply the scramble via the
    // ReplayEngine (which parses tokens + stores scrambleRotations for
    // later seek/reset). This puts the cube in the scrambled state at
    // position 0, ready for optimal-solution replay.
    (async () => {
      engine.resetCube();
      if (cancelled) return;
      if (cross.scramble) {
        try {
          await replay.applyInitialScramble(cross.scramble);
        } catch (e) {
          console.warn("[CrossTrainer] scramble apply failed:", e);
        }
      }
      if (cancelled) return;
      // Apply stickering AFTER the scramble is on the cube so the cross
      // edges are highlighted in their scrambled positions.
      if (stickeringOn) {
        engine.clearLayerGray();
        engine.setPhaseStickering(cross.stickeringMask, "#6b7280");
      }
    })();

    return () => {
      cancelled = true;
      replay.dispose();
      replayRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, cross.scrambleIndex]);

  // ── Re-apply stickering when toggled (without changing scramble) ─────
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !isReady) return;
    // Only manage stickering when the replay is idle (not playing/seeking).
    if (replayState !== "idle") return;
    if (stickeringOn) {
      engine.clearLayerGray();
      engine.setPhaseStickering(cross.stickeringMask, "#6b7280");
    } else {
      engine.clearLayerGray();
    }
  }, [
    engineRef,
    isReady,
    stickeringOn,
    cross.stickeringMask,
    replayState,
  ]);

  // ── When replay ends, restore stickering (if toggled on) ─────────────
  useEffect(() => {
    if (replayState === "complete" && stickeringOn) {
      const engine = engineRef.current;
      if (!engine) return;
      engine.clearLayerGray();
      engine.setPhaseStickering(cross.stickeringMask, "#6b7280");
    }
  }, [replayState, stickeringOn, cross.stickeringMask, engineRef]);

  // ── Replay controls ──────────────────────────────────────────────────
  const handlePlayPause = useCallback(async () => {
    const r = replayRef.current;
    if (!r) return;
    // Clear stickering before replay so the user sees full-color moves.
    if (stickeringOn) {
      engineRef.current?.clearLayerGray();
    }
    if (replayState === "playing") {
      r.pause();
    } else {
      await r.play();
    }
  }, [replayState, stickeringOn, engineRef]);

  const handleStepForward = useCallback(() => {
    if (stickeringOn) engineRef.current?.clearLayerGray();
    replayRef.current?.stepForward();
  }, [stickeringOn, engineRef]);

  const handleStepBackward = useCallback(() => {
    if (stickeringOn) engineRef.current?.clearLayerGray();
    replayRef.current?.stepBackward();
  }, [stickeringOn, engineRef]);

  const handleRestart = useCallback(async () => {
    const r = replayRef.current;
    if (!r) return;
    if (stickeringOn) engineRef.current?.clearLayerGray();
    await r.seek(0);
    await r.play();
  }, [stickeringOn, engineRef]);

  const handleSetSpeed = useCallback((s: number) => {
    replayRef.current?.setSpeed(s);
    setSpeed(s);
  }, []);

  // ── Submit manual move count ─────────────────────────────────────────
  const handleSubmitMoves = useCallback(() => {
    if (userMoves === null || userMoves < 0) return;
    const efficient = userMoves <= cross.optimalDepth;
    const attempt: CrossAttempt = {
      id: nextAttemptId(),
      userMoves,
      optimalDepth: cross.optimalDepth,
      face: cross.face,
      scramble: cross.scramble,
      timestamp: Date.now(),
      efficient,
    };
    setAttempts((prev) => [attempt, ...prev]);
    setUserMoves(null);

    // Persist to DB using REAL efficiency columns (optimal_moves vs move_count)
    // so phase stats can compute efficiency = optimal / actual.
    dbPersistAttempt({
      exerciseId: `cross-trainer-${phaseId}`,
      methodId,
      phaseId,
      timeMs: 0,
      verdict: efficient ? "correct" : "incorrect",
      playMode: "manual",
      scramble: cross.scramble,
      moveCount: userMoves,
      optimalMoves: cross.optimalDepth,
      metricKind: "execution",
      sessionId: sessionId ?? undefined,
    }).catch((err) => console.error("[CrossTrainer] persist failed:", err));
  }, [
    userMoves,
    cross.optimalDepth,
    cross.face,
    cross.scramble,
    dbPersistAttempt,
    methodId,
    phaseId,
    sessionId,
  ]);

  const handleNewScramble = useCallback(() => {
    setUserMoves(null);
    cross.regenerate();
  }, [cross]);

  const handleCnToggle = useCallback(() => {
    // Compute the next value OUTSIDE the state updater so regenerate
    // (a side effect) is not invoked during render. In StrictMode the
    // updater is double-invoked, which would double-generate scrambles.
    const next = !cnMode;
    setCnMode(next);
    // Drive the hook's internal face state explicitly so CN mode
    // actually takes effect (face=undefined → color-neutral search).
    cross.regenerate({ face: next ? undefined : activeFace });
  }, [cross, activeFace, cnMode]);

  const handleFaceSelect = useCallback(
    (f: string) => {
      setCnMode(false);
      setActiveFace(f);
      cross.regenerate({ face: f });
    },
    [cross],
  );

  // ── Derived stats ────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const valid = attempts;
    const efficientCount = valid.filter((a) => a.efficient).length;
    const accuracy =
      valid.length > 0 ? Math.round((efficientCount / valid.length) * 100) : 0;
    const avgMoves =
      valid.length > 0
        ? Math.round(
            (valid.reduce((s, a) => s + a.userMoves, 0) / valid.length) * 10,
          ) / 10
        : 0;
    const bestMoves =
      valid.length > 0 ? Math.min(...valid.map((a) => a.userMoves)) : 0;
    const streak = (() => {
      let s = 0;
      for (let i = valid.length - 1; i >= 0; i--) {
        if (valid[i].efficient) s++;
        else break;
      }
      return s;
    })();
    return { accuracy, avgMoves, bestMoves, streak, total: valid.length };
  }, [attempts]);

  const totalMs = cross.replayMoves.length * 600;
  const hasReplay = cross.replayMoves.length > 0;
  const moveDiff =
    userMoves !== null ? userMoves - cross.optimalDepth : null;

  return (
    <div className="relative flex-1 min-h-0 w-full h-full">
      <div className="absolute inset-0 flex flex-col gap-4 overflow-hidden">
        {/* Header */}
        <header className="flex items-center gap-3 shrink-0 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
          <TrainingBreadcrumb
            onBack={onBack}
            segments={[
              { label: method?.name ?? "?" },
              { label: `${phaseName} · Trainer`, isCurrent: true },
            ]}
          />
          <span
            className={cn(
              "shrink-0 rounded-md px-2 py-1 text-[0.6rem] font-medium border",
              cnMode
                ? "border-phase-purple-500/20 bg-phase-purple-500/5 text-phase-purple"
                : "border-phase-blue-500/20 bg-phase-blue-500/5 text-phase-blue",
            )}
          >
            {cnMode ? "CN" : `${cross.face}-cross`} · {cross.optimalDepth} opt
          </span>
          <span className="nums text-[0.62rem] text-ink-3 ml-auto">
            {stats.total} attempts
          </span>
        </header>

        {/* Depth + face + CN selector */}
        <div className="shrink-0 flex flex-wrap items-center gap-2 px-4 sm:px-6 lg:px-8">
          <span className="text-[0.62rem] text-ink-3 mr-1">Depth:</span>
          {DEPTHS.map((d) => (
            <button
              key={d}
              onClick={() => {
                setUserMoves(null);
                cross.regenerate({ depth: d });
              }}
              className={cn(
                "nums rounded-md px-2.5 py-1 text-[0.65rem] font-medium transition-colors",
                // Touch: bigger tap targets.
                "max-lg:h-10 max-lg:min-w-11 max-lg:text-[0.7rem]",
                cross.depth === d
                  ? "bg-ink text-surface"
                  : "text-ink-3 hover:text-ink hover:bg-surface-2",
              )}
            >
              {d}
            </button>
          ))}
          <span className="mx-1 h-4 w-px bg-line" />
          <span className="text-[0.62rem] text-ink-3 mr-1">Face:</span>
          {FACES.map((f) => (
            <button
              key={f}
              onClick={() => handleFaceSelect(f)}
              disabled={cnMode}
              className={cn(
                "nums rounded-md px-2 py-1 text-[0.62rem] font-medium transition-colors disabled:opacity-30",
                // Touch: bigger tap targets.
                "max-lg:h-10 max-lg:min-w-10 max-lg:text-[0.68rem]",
                !cnMode && activeFace === f
                  ? "bg-ink text-surface"
                  : "text-ink-3 hover:text-ink hover:bg-surface-2",
              )}
            >
              {f}
            </button>
          ))}
          <button
            onClick={handleCnToggle}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[0.62rem] font-medium transition-colors",
              cnMode
                ? "bg-phase-purple-500/15 text-phase-purple"
                : "text-ink-3 hover:text-ink hover:bg-surface-2",
            )}
            title="Color-neutral: picks the best cross face automatically"
          >
            <Palette className="size-3" />
            CN
          </button>
          <span className="flex-1" />
          <button
            onClick={handleNewScramble}
            disabled={cross.isGenerating}
            className="inline-flex items-center gap-1.5 rounded-md bg-surface-2 px-3 py-1.5 text-[0.62rem] font-medium text-ink-2 hover:bg-line hover:text-ink transition-colors disabled:opacity-50"
          >
            <Shuffle className="size-3" />
            New scramble
          </button>
        </div>

        {/* Body — 3 columns */}
        <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-hidden lg:flex-row px-4 sm:px-6 lg:px-8 pb-4">
          {/* Column 1: Scramble + live/stickering cube */}
          <div className="flex min-h-0 flex-1 flex-col gap-4 min-w-0">
            <div className="shrink-0 rounded-xl border border-line bg-surface p-4">
              <span className="text-[0.58rem] font-medium uppercase tracking-[0.12em] text-ink-3/60 block mb-1">
                Scramble · {cnMode ? "CN" : `${cross.face}-cross`} depth {cross.optimalDepth}
              </span>
              <ScrambleDisplay
                scramble={cross.scramble}
                displayScramble={displayScramble}
                onRegenerate={handleNewScramble}
              />
            </div>

            {/* Live/stickering 3D cube */}
            <div className="flex-1 min-h-0 rounded-xl border border-line bg-surface relative overflow-hidden flex flex-col">
              <div className="flex items-center justify-between border-b border-line px-3 py-2 shrink-0">
                <h4 className="text-[0.65rem] font-medium uppercase tracking-[0.12em] text-ink-3">
                  Cube
                </h4>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setStickeringOn((v) => !v)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[0.6rem] font-medium transition-colors",
                      stickeringOn
                        ? "bg-phase-blue-500/10 text-phase-blue"
                        : "text-ink-3 hover:text-ink hover:bg-surface-2",
                    )}
                    title="Toggle cross-piece highlight"
                  >
                    {stickeringOn ? (
                      <Eye className="size-3" />
                    ) : (
                      <EyeOff className="size-3" />
                    )}
                    Cross
                  </button>
                  <button
                    onClick={calibrate}
                    disabled={!isReady}
                    className="rounded-md px-2 py-1 text-[0.6rem] text-ink-3 hover:text-ink hover:bg-surface-2 transition-colors disabled:opacity-30"
                  >
                    Calibrate
                  </button>
                  <button
                    onClick={reset}
                    disabled={!isReady}
                    className="rounded-md px-2 py-1 text-[0.6rem] text-ink-3 hover:text-ink hover:bg-surface-2 transition-colors disabled:opacity-30"
                  >
                    Reset
                  </button>
                </div>
              </div>
              <div
                ref={containerRef as React.RefObject<HTMLDivElement>}
                className="relative flex-1 min-h-0 w-full"
              >
                <canvas
                  ref={canvasRef as React.RefObject<HTMLCanvasElement>}
                  className="absolute inset-0 h-full w-full outline-none"
                />
                {initFailed || contextEvicted ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-surface/80 px-2">
                    <span className="text-[0.58rem] text-ink-3/70 text-center">
                      3D unavailable — too many 3D views open
                    </span>
                  </div>
                ) : !isReady ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-surface/80">
                    <span className="text-[0.6rem] text-ink-3/50 animate-pulse">
                      Initializing 3D...
                    </span>
                  </div>
                ) : null}
                {stickeringOn && isReady && replayState === "idle" && (
                  <div className="absolute bottom-2 left-2 rounded bg-background/85 px-2 py-1 text-[0.55rem] text-ink-3">
                    Cross edges highlighted
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Column 2: Optimal solution replay + manual move entry */}
          <div className="flex min-h-0 flex-1 flex-col gap-4 min-w-0">
            {/* Optimal solution reveal + replay */}
            <div className="shrink-0 rounded-xl border border-line bg-surface p-4">
              <div className="flex items-center gap-2 mb-2">
                <Layers className="size-4 text-ink-2" />
                <span className="text-[0.7rem] font-semibold text-ink">
                  Optimal solution · {cross.optimalDepth} moves
                </span>
                <span className="flex-1" />
                <button
                  onClick={() => setShowOptimal((v) => !v)}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[0.6rem] font-medium text-ink-3 hover:text-ink hover:bg-surface-2 transition-colors"
                >
                  {showOptimal ? (
                    <EyeOff className="size-3" />
                  ) : (
                    <Eye className="size-3" />
                  )}
                  {showOptimal ? "Hide" : "Reveal"}
                </button>
              </div>
              {showOptimal ? (
                <p className="font-mono text-[0.72rem] text-ink leading-relaxed wrap-break-word">
                  {cross.optimalSolution || "—"}
                </p>
              ) : (
                <p className="text-[0.6rem] text-ink-3/50 italic">
                  Solve first, then reveal to compare. Use replay to see it in 3D.
                </p>
              )}
            </div>

            {/* Replay controls (reuse ReplayEngine on the same canvas) */}
            <div className="shrink-0 rounded-xl border border-line bg-surface p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[0.62rem] font-medium text-ink-2">
                  Optimal replay
                </span>
                <span className="nums text-[0.6rem] text-ink-3">
                  Move {Math.max(0, currentMoveIdx + 1)}/{cross.replayMoves.length}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleRestart}
                  disabled={!hasReplay}
                  className="grid size-8 place-items-center rounded-md text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-30"
                  aria-label="Restart replay"
                >
                  <RotateCcw className="size-3.5" />
                </button>
                <button
                  onClick={handleStepBackward}
                  disabled={!hasReplay}
                  className="grid size-8 place-items-center rounded-md text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-30"
                  aria-label="Step backward"
                >
                  <SkipBack className="size-3.5" />
                </button>
                <button
                  onClick={handlePlayPause}
                  disabled={!hasReplay}
                  className={cn(
                    "grid size-9 place-items-center rounded-full transition-all duration-150 disabled:opacity-30",
                    replayState === "playing"
                      ? "bg-ink text-background hover:bg-ink/80"
                      : "bg-phase-blue-500 text-white hover:bg-phase-blue-600",
                  )}
                  aria-label={replayState === "playing" ? "Pause" : "Play"}
                >
                  {replayState === "playing" ? (
                    <Pause className="size-4" />
                  ) : (
                    <Play className="size-4 pl-0.5" />
                  )}
                </button>
                <button
                  onClick={handleStepForward}
                  disabled={!hasReplay || currentMoveIdx >= cross.replayMoves.length - 1}
                  className="grid size-8 place-items-center rounded-md text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-30"
                  aria-label="Step forward"
                >
                  <SkipForward className="size-3.5" />
                </button>
                <span className="flex-1" />
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
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              </div>
              {totalMs > 0 && (
                <div className="mt-2 h-0.5 rounded bg-line/40 overflow-hidden">
                  <div
                    className="h-full bg-phase-blue-500/60 transition-[width] duration-75 linear"
                    style={{
                      width: `${Math.min(100, (positionMs / totalMs) * 100)}%`,
                    }}
                  />
                </div>
              )}
            </div>

            {/* Manual move-count entry */}
            <div className="flex-1 min-h-0 rounded-xl border border-line bg-surface p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Crosshair className="size-4 text-ink-2" />
                <span className="text-[0.7rem] font-semibold text-ink">
                  Your move count
                </span>
              </div>
              <p className="text-[0.6rem] text-ink-3">
                Plan your cross during inspection, then enter how many moves you
                used. The trainer compares against the optimal {cross.optimalDepth}.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={30}
                  value={userMoves ?? ""}
                  onChange={(e) =>
                    setUserMoves(parseInt(e.target.value, 10) || null)
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSubmitMoves();
                  }}
                  className="nums w-20 rounded-md border border-line bg-surface-2 px-3 py-1.5 text-[0.75rem] text-ink text-center focus:outline-none focus:ring-1 focus:ring-ink/30"
                  placeholder="?"
                />
                {moveDiff !== null && (
                  <span
                    className={cn(
                      "nums text-[0.65rem] font-semibold",
                      moveDiff <= 0 ? "text-ready" : "text-hold",
                    )}
                  >
                    {moveDiff <= 0
                      ? `${Math.abs(moveDiff)} under optimal 🎯`
                      : `${moveDiff} over optimal`}
                  </span>
                )}
                <span className="flex-1" />
                <button
                  onClick={handleSubmitMoves}
                  disabled={userMoves === null}
                  className="inline-flex items-center gap-1.5 rounded-md bg-ink px-3 py-1.5 text-[0.65rem] font-medium text-surface hover:bg-ink/90 transition-colors disabled:opacity-30"
                >
                  <Target className="size-3" />
                  Submit
                </button>
              </div>

              {/* Recent attempts list */}
              <div className="flex-1 min-h-0 overflow-y-auto mt-1">
                {attempts.length === 0 ? (
                  <p className="text-[0.58rem] text-ink-3/40 italic text-center py-4">
                    No attempts yet. Enter your move count above.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {attempts.slice(0, 12).map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center gap-2 rounded-md px-2 py-1 text-[0.6rem] hover:bg-surface-2/50"
                      >
                        <span
                          className={cn(
                            "nums font-semibold",
                            a.efficient ? "text-ready" : "text-hold",
                          )}
                        >
                          {a.userMoves}
                        </span>
                        <span className="text-ink-3/50">/ {a.optimalDepth}</span>
                        <span className="text-ink-3/40 ml-auto">
                          {a.face}
                        </span>
                        <span
                          className={cn(
                            "size-1.5 rounded-full",
                            a.efficient ? "bg-ready" : "bg-hold",
                          )}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Column 3: Stats + tips */}
          <TouchAside title="Stats">
            <div className="shrink-0 rounded-xl border border-line bg-surface p-3">
              <div className="grid grid-cols-2 gap-2">
                <StatChip
                  icon={Flame}
                  label="Attempts"
                  value={`${stats.total}`}
                />
                <StatChip
                  icon={Target}
                  label="Accuracy"
                  value={`${stats.accuracy}%`}
                />
                <StatChip
                  icon={Crosshair}
                  label="Best"
                  value={stats.bestMoves > 0 ? `${stats.bestMoves}` : "--"}
                />
                <StatChip
                  icon={Clock}
                  label="Avg moves"
                  value={stats.avgMoves > 0 ? `${stats.avgMoves}` : "--"}
                />
              </div>
            </div>

            <div className="shrink-0 rounded-xl border border-line bg-surface p-3">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="size-3.5 text-caution" />
                <h4 className="text-[0.62rem] font-medium text-ink-2">Tips</h4>
              </div>
              <ul className="space-y-2 text-[0.58rem] text-ink-3/80">
                <li className="flex gap-2">
                  <span className="text-caution/60 shrink-0 mt-0.5">•</span>
                  Plan your entire cross during inspection — no move counting
                  during execution.
                </li>
                <li className="flex gap-2">
                  <span className="text-caution/60 shrink-0 mt-0.5">•</span>
                  World-class crosses are ≤ 6 moves. The theoretical max is 8.
                </li>
                <li className="flex gap-2">
                  <span className="text-caution/60 shrink-0 mt-0.5">•</span>
                  Use the replay to study the optimal path and spot missed
                  efficiencies.
                </li>
                <li className="flex gap-2">
                  <span className="text-caution/60 shrink-0 mt-0.5">•</span>
                  Toggle the cross highlight to track the 4 target edges
                  visually.
                </li>
                <li className="flex gap-2">
                  <span className="text-caution/60 shrink-0 mt-0.5">•</span>
                  Color-neutral (CN) mode finds the best face for each scramble
                  — saves ~0.5s per solve.
                </li>
              </ul>
            </div>

            <div className="shrink-0 rounded-xl border border-line bg-surface p-3">
              <div className="flex items-center gap-2 mb-2">
                <Crosshair className="size-3.5 text-phase-blue" />
                <h4 className="text-[0.62rem] font-medium text-ink-2">
                  Current scramble
                </h4>
              </div>
              <div className="space-y-1 text-[0.6rem]">
                <div className="flex justify-between">
                  <span className="text-ink-3">Mode</span>
                  <span className="nums font-medium text-ink">
                    {cnMode ? "Color-neutral" : `${cross.face} fixed`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-3">Solved face</span>
                  <span className="nums font-medium text-ink">{cross.face}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-3">Optimal depth</span>
                  <span className="nums font-medium text-ink">
                    {cross.optimalDepth}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-3">Your last</span>
                  <span className="nums font-medium text-ink">
                    {attempts[0]?.userMoves ?? "--"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-3">Streak</span>
                  <span className="nums font-medium text-ink">
                    {stats.streak}
                  </span>
                </div>
              </div>
            </div>
          </TouchAside>
        </div>
      </div>
    </div>
  );
}
