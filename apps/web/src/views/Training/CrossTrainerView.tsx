"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { METHODS } from "@cubeforge/algorithm-db";
import { EXERCISE_IDS } from "@cubeforge/training";
import type { PhaseStatsRecord } from "@cubeforge/training";
import { ScrambleDisplay } from "@/components/Scramble/ScrambleDisplay";
import { TimerContainer } from "@/components/Timer/TimerContainer";
import type { HintContext } from "@/components/Timer/hintFor";
import { useCube3D } from "@/hooks/useCube3D";
import { useCrossScramble } from "@/hooks/useCrossScramble";
import { useDrillTimer } from "@/hooks/useDrillTimer";
import { useTrainingProgress } from "@/hooks/useTrainingProgress";
import { useTrainingSession } from "@/hooks/useTrainingSession";
import { useOrientation } from "@/hooks/useOrientation";
import { formatTime } from "@/hooks/usePracticeSession";
import { TrainingBreadcrumb, TouchAside } from "./components";
import {
  RecentAttemptsList,
  CrossStatsPanel,
  CrossTipsPanel,
  CrossScrambleInfoPanel,
} from "./components/CrossTrainerPanels";
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
  Clock,
  Layers,
  Eye,
  EyeOff,
  Palette,
} from "lucide-react";

/* ──────────────────────────────────────────────────────────────────────────
   CrossTrainerView

   A timed cross trainer (real stopwatch via useDrillTimer, same primitive as
   Drill/Recognize) that adapts or18's RubiksSolverDemo cross_trainer to our
   systems. Reuses (NOT rebuilds):
     • useCrossScramble  — way-to-cross scramble + optimal solution + replay moves
     • useCube3D         — main-thread Cube3DEngine on the live canvas (engineRef)
     • ReplayEngine      — drives the optimal-solution 3D replay on the SAME canvas,
                           including applyInitialScramble() for the scramble state
     • setPhaseStickering — highlights the 4 cross edges on the 3D cube
     • ScrambleDisplay   — scramble token display
     • TrainingBreadcrumb / StatChip — shared training UI atoms
     • useTrainingProgress.recordAttempt — persists attempts (move count metadata)

   Layout: 3 columns — scramble + live/stickering cube | timer + optimal
   replay + move entry | stats. The user times their cross (spacebar), enters
   the move count they used, and the trainer grades efficiency against the
   optimal depth with a 2-move tolerance (efficient = moves ≤ optimal + 2).
   Stats come from the DB (getPhaseStats + getAttemptsByExercise) so they
   survive navigation, merged with the current session's optimistic attempts.
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

/** A user is "efficient" when within 2 moves of the optimal depth — being 1-2
    moves off is correct, not a failure (plan §2.7). */
const EFFICIENCY_TOLERANCE = 2;

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

  // ── Persist attempts to the DB + real timing (same primitive as Drill) ─
  const { recordAttempt: dbPersistAttempt, ready: dbReady, getPhaseStats, getAttemptsByExercise } = useTrainingProgress();
  const { phase: timerPhase, time, stoppedTime, press, release, reset: resetTimer } = useDrillTimer();
  const hintCtx = useMemo<HintContext>(() => ({
    smartCube: false,
    scrambleVerif: false,
    inspection: false,
    isScrambled: false,
  }), []);
  // Canonical exercise id: CN mode is a DISTINCT exercise (cn-<method>-<phase>)
  // from the ≤8 optimal trainer (cross-trainer-<method>-<phase>), so each
  // mode accumulates its own honest stats.
  const exerciseId = cnMode
    ? EXERCISE_IDS.crossTrainerCn(methodId, phaseId)
    : EXERCISE_IDS.crossTrainer(methodId, phaseId);
  const { sessionId } = useTrainingSession({
    exerciseId,
    methodId,
    phaseId,
  });

  // ── DB-backed stats (survive navigation — plan §2.7/M7) ───────────────
  const [dbAttempts, setDbAttempts] = useState<CrossAttempt[]>([]);
  const [dbPhaseStats, setDbPhaseStats] = useState<PhaseStatsRecord | null>(null);

  useEffect(() => {
    if (!dbReady) return;
    let cancelled = false;
    void getPhaseStats(methodId, phaseId).then((s) => {
      if (!cancelled) setDbPhaseStats(s);
    });
    void getAttemptsByExercise(exerciseId, 15).then((rows) => {
      if (cancelled) return;
      setDbAttempts(rows
        .filter((r) => r.moveCount != null)
        .map((r) => ({
          id: r.id,
          userMoves: r.moveCount ?? 0,
          optimalDepth: r.optimalMoves ?? 0,
          face: r.phaseId ?? "—",
          scramble: r.scramble,
          timestamp: r.timestamp,
          efficient: (r.moveCount ?? 0) <= (r.optimalMoves ?? 0) + EFFICIENCY_TOLERANCE,
        })));
    });
    return () => { cancelled = true; };
  }, [dbReady, methodId, phaseId, exerciseId, getPhaseStats, getAttemptsByExercise]);

  // Any scramble change (new / depth / face / CN) resets the timer so each
  // cross attempt is timed from the moment the new scramble appears.
  useEffect(() => {
    resetTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cross.scrambleIndex]);

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
      [],
      {
        resetCube: () => {
          engine.resetCube();
        },
        rotateLayers: (axis, layers, angle, dur, elapsed) =>
          engine.rotateLayers(axis, layers, angle, dur, elapsed ?? 0),
      },
    );
    // Move-driven playback at the same 600ms-per-move pace used to build
    // the moves and totalMs here, so the progress bar stays in sync.
    // NOTE: moveSpacingMs must be set BEFORE setMoves() builds the timeline.
    replay.moveSpacingMs = 600;
    replay.setMoves(cross.replayMoves, cross.replayMoves.length * 600);
    replay.moveAnimationDurationMs = 420;
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
    r.pause();
    await r.seek(0);
    // seek(0) resets the cube, so stickering must be re-applied AFTER it.
    if (stickeringOn) {
      engineRef.current?.clearLayerGray();
      engineRef.current?.setPhaseStickering(cross.stickeringMask, "#6b7280");
    }
  }, [stickeringOn, cross.stickeringMask, engineRef]);

  const handleSetSpeed = useCallback((s: number) => {
    replayRef.current?.setSpeed(s);
    setSpeed(s);
  }, []);

  // ── Submit timed move count ──────────────────────────────────────────
  const handleSubmitMoves = useCallback(() => {
    if (userMoves === null || userMoves < 0) return;
    // Efficiency with tolerance: ≤ optimal + 2 is correct, not a failure.
    const efficient = userMoves <= cross.optimalDepth + EFFICIENCY_TOLERANCE;
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
    resetTimer();

    // Persist with REAL timing + efficiency columns (optimal_moves vs
    // move_count) so phase stats compute time + efficiency = optimal / actual.
    dbPersistAttempt({
      exerciseId,
      methodId,
      phaseId,
      timeMs: stoppedTime,
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
    exerciseId,
    stoppedTime,
    resetTimer,
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

  // ── Derived stats (local optimistic attempts merged with DB history) ──
  const allAttempts = useMemo(() => {
    const map = new Map<string, CrossAttempt>();
    for (const a of [...dbAttempts, ...attempts]) map.set(a.id, a);
    return [...map.values()].sort((a, b) => b.timestamp - a.timestamp);
  }, [attempts, dbAttempts]);

  const stats = useMemo(() => {
    const valid = allAttempts;
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
    const effRows = valid.filter((a) => a.optimalDepth > 0 && a.userMoves > 0);
    const efficiency = effRows.length > 0
      ? Math.round(
          effRows.reduce((s, a) => s + (100 * a.optimalDepth) / a.userMoves, 0) /
            effRows.length,
        )
      : 0;
    return { accuracy, avgMoves, bestMoves, streak, total: valid.length, efficiency };
  }, [allAttempts]);

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
              "shrink-0 rounded-full px-2.5 py-0.5 text-[0.6rem] font-semibold text-white",
              cnMode ? "bg-phase-purple" : "bg-phase-blue",
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
                ? "bg-phase-purple text-white font-semibold"
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

          {/* Column 2: Timer + optimal solution replay + manual move entry */}
          <div className="flex min-h-0 flex-1 flex-col gap-4 min-w-0">
            {/* Real timer (same primitive as Drill/Recognize) */}
            <div className="shrink-0 rounded-xl border border-line bg-surface p-4">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="size-4 text-ink-2" />
                <span className="text-[0.7rem] font-semibold text-ink">Cross timer</span>
                <span className="flex-1" />
                <span className="text-[0.6rem] text-ink-3">
                  {timerPhase === "running" && "Solving… press space to stop"}
                  {timerPhase === "stopped" && stoppedTime > 0 ? `Stopped · ${formatTime(stoppedTime)}` : timerPhase === "stopped" ? "Stopped" : "Press & hold space, release to start"}
                </span>
              </div>
              <TimerContainer
                phase={timerPhase}
                time={time}
                lastTime={null}
                hintCtx={hintCtx}
                onPress={press}
                onRelease={release}
                className="py-2"
              />
            </div>

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
                Time your cross with the spacebar, then enter how many moves you
                used. The trainer compares against the optimal {cross.optimalDepth}
                (within {EFFICIENCY_TOLERANCE} moves counts as correct).
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
                {moveDiff !== null && (                  <span className={cn(
                      "nums text-[0.65rem] font-semibold",
                      moveDiff <= EFFICIENCY_TOLERANCE ? "text-ready" : "text-hold",
                    )}>
                    {moveDiff === 0
                      ? "Optimal! 🎯"
                      : moveDiff < 0
                        ? `${Math.abs(moveDiff)} under optimal 🎯`
                        : moveDiff <= EFFICIENCY_TOLERANCE
                          ? `${moveDiff} over optimal (ok)`
                          : `${moveDiff} over optimal`}
                  </span>
                )}
                <span className="flex-1" />
                <button
                  onClick={handleSubmitMoves}
                  disabled={userMoves === null || timerPhase !== "stopped"}
                  title={timerPhase !== "stopped" ? "Stop the timer first (press space to start, space to stop)" : undefined}
                  className="inline-flex items-center gap-1.5 rounded-md bg-ink px-3 py-1.5 text-[0.65rem] font-medium text-surface hover:bg-ink/90 transition-colors disabled:opacity-30"
                >
                  <Target className="size-3" />
                  Submit
                </button>
              </div>

              {/* Recent attempts list */}
              <div className="flex-1 min-h-0 overflow-y-auto mt-1">
                <RecentAttemptsList attempts={allAttempts} />
              </div>
            </div>
          </div>

          {/* Column 3: Stats + tips */}
          <TouchAside title="Stats">
            <CrossStatsPanel stats={stats} avgTimeMs={dbPhaseStats?.avgTimeMs ?? 0} />
            <CrossTipsPanel />
            <CrossScrambleInfoPanel
              cnMode={cnMode}
              face={cross.face}
              optimalDepth={cross.optimalDepth}
              lastUserMoves={allAttempts[0]?.userMoves}
              streak={stats.streak}
            />
          </TouchAside>
        </div>
      </div>
    </div>
  );
}
