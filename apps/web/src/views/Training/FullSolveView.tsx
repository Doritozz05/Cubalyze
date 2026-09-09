"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { METHODS } from "@cubeforge/algorithm-db";
import { EXERCISE_IDS } from "@cubeforge/training";
import { RandomStateGenerator } from "@cubeforge/solver-engine";
import { getMin2PhaseSolver } from "@/utils/puzzleUtils";
import { useStore } from "zustand";
import { preferencesStore } from "@cubeforge/state";
import { ScrambleDisplay } from "@/components/Scramble/ScrambleDisplay";
import { TimerContainer } from "@/components/Timer/TimerContainer";
import { MiniCube3DPanel } from "@/components/Cube3D/MiniCube3DPanel";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { HintContext } from "@/components/Timer/hintFor";
import { useDrillTimer } from "@/hooks/useDrillTimer";
import { useDrillSmartCube } from "@/hooks/useDrillSmartCube";
import { useOrientation } from "@/hooks/useOrientation";
import { useTrainingProgress } from "@/hooks/useTrainingProgress";
import { useTrainingSession } from "@/hooks/useTrainingSession";
import {
  TrainingBreadcrumb,
  TouchAside,
} from "./components";
import {
  defaultPhaseTargets,
  PhaseTargetsPanel,
  MoveLimitInfo,
  TpsInfo,
  RotationlessInfo,
} from "./components/FullSolvePanels";
import type { PhaseSplit, PhaseSplitTarget } from "./components/fullSolveTypes";
import {
  Target,
  Flame,
  X,
  Check,
  Trophy,
  Eye,
  MoveHorizontal,
  Gauge,
  RotateCw,
  Lock,
} from "lucide-react";

/* ──────────────────────────────────────────────────────────────────────────
   Types
   ─────────────────────────────────────────────────────────────────────── */

type FullSolveMode = "targets" | "move-limit" | "tps-challenge" | "rotationless";



interface SolveResult {
  totalMs: number;
  splits: PhaseSplit[];
  solveMode: FullSolveMode;
  moveLimit: number;
  tpsThreshold: number;
  moveCount?: number;
  hadRotations?: boolean;
}

/* ──────────────────────────────────────────────────────────────────────────
   Phase target definitions
   ───────────────────────────────────────────────────────────────────────

   Phase identities come from the @cubeforge/training catalog
   (buildMethodPhases) so the splits always match the exercises the user
   actually trains. Target seconds below are per-phase DEFAULTS — they are
   replaced by the user's REAL per-phase average time (from
   training_attempts) as soon as they exist, so targets are honest data
   instead of fabricated numbers.
   ─────────────────────────────────────────────────────────────────────── */

/* ──────────────────────────────────────────────────────────────────────────
   Helpers
   ─────────────────────────────────────────────────────────────────────── */

function formatTime(ms: number): string {
  if (ms <= 0) return "0.00";
  const s = ms / 1000;
  return s < 10 ? s.toFixed(2) : s < 60 ? s.toFixed(2)
    : `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, "0")}`;
}

const SOLVE_MODE_IDS = ["targets", "move-limit", "tps-challenge", "rotationless"] as const;

/** Solve mode id → i18n keys (labels + tooltip descriptions). */
const SOLVE_MODE_KEYS = {
  targets: { label: "fullSolve.modes.targets.label", description: "fullSolve.modes.targets.description" },
  "move-limit": { label: "fullSolve.modes.move-limit.label", description: "fullSolve.modes.move-limit.description" },
  "tps-challenge": { label: "fullSolve.modes.tps-challenge.label", description: "fullSolve.modes.tps-challenge.description" },
  rotationless: { label: "fullSolve.modes.rotationless.label", description: "fullSolve.modes.rotationless.description" },
} as const;

/* ──────────────────────────────────────────────────────────────────────────
   Main Component
   ─────────────────────────────────────────────────────────────────────── */

export interface FullSolveViewProps {
  methodId: string;
  onBack: () => void;
}

export function FullSolveView({ methodId, onBack }: FullSolveViewProps) {
  const method = useMemo(() => METHODS.find((m) => m.id === methodId), [methodId]);
  // Phase targets start as per-phase defaults derived from the catalog; they
  // are upgraded to the user's REAL per-phase averages once loaded below.
  const [phaseTargets, setPhaseTargets] = useState<PhaseSplitTarget[]>(() =>
    defaultPhaseTargets(method?.name ?? ""),
  );

  const [solveMode, setSolveMode] = useState<FullSolveMode>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("cubeforge_full_solve_mode");
      // Validate against CURRENT mode ids — old saves used legacy names
      // ("moves"/"tps"/"rotations"/"free") which would corrupt the mode.
      if (saved === "targets" || saved === "move-limit" || saved === "tps-challenge" || saved === "rotationless") {
        return saved as FullSolveMode;
      }
    }
    return "targets";
  });

  const handleSolveModeChange = (mode: FullSolveMode) => {
    setSolveMode(mode);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("cubeforge_full_solve_mode", mode);
      } catch (e) {
        console.warn("[FullSolveView] Failed to save solve mode to localStorage", e);
      }
    }
  };

  const [useInspection, setUseInspection] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("cubeforge_full_solve_inspection");
      if (saved !== null) return saved === "true";
    }
    return false;
  });

  const handleToggleInspection = () => {
    setUseInspection((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("cubeforge_full_solve_inspection", String(next));
        } catch (e) {
          console.warn("[FullSolveView] Failed to save inspection to localStorage", e);
        }
      }
      return next;
    });
  };
  const [splits, setSplits] = useState<PhaseSplit[]>(() =>
    phaseTargets.map((pt) => ({ ...pt, actualMs: 0, status: "pending" as const })),
  );
  const [activeSplitIdx, setActiveSplitIdx] = useState(-1);
  const [lastSolve, setLastSolve] = useState<SolveResult | null>(null);
  const [currentScramble, setCurrentScramble] = useState(
    () => RandomStateGenerator.generateScramble(getMin2PhaseSolver()),
  );

  // ── Mode-specific state ───────────────────────────────────────────
  const [moveLimit, setMoveLimit] = useState(60);
  const [tpsThreshold, setTpsThreshold] = useState(4);
  const [userMoveCount, setUserMoveCount] = useState<number | null>(null);
  const [hadRotations, setHadRotations] = useState<boolean | null>(null);

  // ── Timer + Smart Cube ──────────────────────────────────────────────
  const { phase: timerPhase, time, stoppedTime, press, release, reset, engine } = useDrillTimer({ inspection: useInspection });
  const { remapScramble } = useOrientation();

  // ── Honest targets: replace defaults with the user's real per-phase
  //    averages (from training_attempts). Runs once per mount.
  const { ready: dbReady, getPhaseStats } = useTrainingProgress();
  useEffect(() => {
    if (!dbReady || phaseTargets.length === 0) return;
    let cancelled = false;
    void Promise.all(
      phaseTargets.map((pt) => getPhaseStats(methodId, pt.phaseId).catch(() => null)),
    ).then((stats) => {
      if (cancelled) return;
      setPhaseTargets((prev) =>
        prev.map((pt, i) => {
          const avgMs = stats[i]?.avgTimeMs ?? 0;
          if (avgMs <= 0) return pt;
          const personalS = Math.max(0.5, Math.round(avgMs) / 1000);
          return { ...pt, targetS: personalS };
        }),
      );
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbReady, methodId, getPhaseStats]);

  // When personal targets arrive (and no solve is in flight), refresh the
  // split progress bar / panel so the displayed targets are the real ones.
  useEffect(() => {
    if (activeSplitIdx !== -1 || timerPhase === "running") return;
    setSplits(phaseTargets.map((pt) => ({ ...pt, actualMs: 0, status: "pending" as const })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseTargets, timerPhase]);
  const displayScramble = remapScramble(currentScramble);

  const scrambleDisplay = useStore(
    preferencesStore,
    (s) => s.scrambleDisplay,
  );
  const scrambleVerificationRaw = useStore(
    preferencesStore,
    (s) => s.scrambleVerification,
  );
  const scrambleVerification = scrambleDisplay && scrambleVerificationRaw;

  const smartCube = useDrillSmartCube({ engine, setupScramble: currentScramble });
  const hasSmartCube = smartCube.smartCubeConnected;

  // ── Persistence: every completed solve feeds phase stats ──────────────
  // A single pass per solve (ref identity guards StrictMode double-invoke).
  // Per-phase splits feed phase weakness; the total row records the solve.
  const { recordAttempt: dbPersistAttempt } = useTrainingProgress();
  const { sessionId } = useTrainingSession({
    exerciseId: EXERCISE_IDS.fullSolve(methodId),
    methodId,
    phaseId: "full",
    smartCubeUsed: hasSmartCube,
  });
  const persistedSolveRef = useRef<SolveResult | null>(null);
  const persistedTotalRef = useRef<SolveResult | null>(null);
  const lastSolveRef = useRef<SolveResult | null>(null);
  lastSolveRef.current = lastSolve;

  // Persist the aggregate solve row. A solve is NEVER dropped: when the mode
  // requires metadata (move count / rotation flag) that the user never
  // provided, the attempt is still recorded with verdict "skipped" (completed
  // but unjudged) instead of vanishing from the stats.
  const persistTotal = useCallback((solve: SolveResult) => {
    if (persistedTotalRef.current === solve) return;
    persistedTotalRef.current = solve;

    const completedMode = solve.solveMode;
    const moveCountKnown = userMoveCount !== null;
    const rotationsKnown = hadRotations !== null;

    const verdict =
      completedMode === "targets"
        ? solve.splits.length > 0 && solve.splits.every((s) => s.actualMs > 0 && s.actualMs / 1000 <= s.targetS)
          ? "correct" : "incorrect"
        : completedMode === "move-limit"
          ? moveCountKnown ? (userMoveCount <= solve.moveLimit ? "correct" : "incorrect") : "skipped"
          : completedMode === "tps-challenge"
            ? moveCountKnown ? (userMoveCount / (solve.totalMs / 1000) >= solve.tpsThreshold ? "correct" : "incorrect") : "skipped"
            : rotationsKnown ? (hadRotations ? "incorrect" : "correct") : "skipped";

    dbPersistAttempt({
      exerciseId: EXERCISE_IDS.fullSolve(methodId),
      methodId,
      phaseId: "full",
      timeMs: solve.totalMs,
      verdict,
      playMode: hasSmartCube ? "smart-cube" : "manual",
      scramble: currentScramble,
      moveCount: userMoveCount ?? undefined,
      tps: userMoveCount !== null && solve.totalMs > 0 ? userMoveCount / (solve.totalMs / 1000) : undefined,
      rotationCount: completedMode === "rotationless" ? (hadRotations ? 1 : 0) : undefined,
      metricKind: "execution",
      sessionId: sessionId ?? undefined,
    }).catch((err) => console.error("[FullSolve] persist total failed:", err));
  }, [dbPersistAttempt, methodId, hasSmartCube, currentScramble, sessionId, userMoveCount, hadRotations]);

  useEffect(() => {
    if (!lastSolve) return;

    // Per-phase splits are ONLY real in targets mode — the only mode that
    // exposes a split-marking UI. In move-limit/TPS/rotationless the timer
    // would attribute the whole solve to phase 0, so persisting them there
    // would fabricate phase data. Persist once per solve.
    if (lastSolve.solveMode === "targets" && persistedSolveRef.current !== lastSolve) {
      persistedSolveRef.current = lastSolve;
      for (const split of lastSolve.splits) {
        if (split.actualMs <= 0) continue;
        // Honest split: it is REAL timing data but NOT a correctness verdict.
        // Persisted as 'skipped' so it feeds phase time aggregates without
        // fabricating an accuracy/failRate verdict from the (arbitrary) target.
        dbPersistAttempt({
          exerciseId: EXERCISE_IDS.fullSolve(methodId),
          methodId,
          phaseId: split.phaseId,
          timeMs: split.actualMs,
          verdict: "skipped",
          playMode: hasSmartCube ? "smart-cube" : "manual",
          scramble: currentScramble,
          metricKind: "execution",
          sessionId: sessionId ?? undefined,
        }).catch((err) => console.error("[FullSolve] persist split failed:", err));
      }
    }

    // Persist the total once the mode's metadata is known so the verdict is
    // accurate. If the metadata never arrives, handleNewSolve flushes the
    // pending solve as "skipped" instead of losing it.
    const completedMode = lastSolve.solveMode;
    const metadataReady = completedMode === "targets"
      || (completedMode === "move-limit" && userMoveCount !== null)
      || (completedMode === "tps-challenge" && userMoveCount !== null)
      || (completedMode === "rotationless" && hadRotations !== null);
    if (metadataReady) persistTotal(lastSolve);
  }, [lastSolve, userMoveCount, hadRotations, hasSmartCube, currentScramble, methodId, dbPersistAttempt, sessionId, persistTotal]);

  // Unmount safety net: a solve completed but never flushed (user navigates
  // back from the result overlay instead of clicking "New Solve") must still
  // be persisted — never drop a finished solve from the stats. The cleanup
  // must run ONLY on unmount, so it reads the latest persistTotal through a
  // ref instead of depending on its identity (which changes with metadata).
  const persistTotalRef = useRef(persistTotal);
  persistTotalRef.current = persistTotal;
  useEffect(() => {
    return () => {
      const pending = lastSolveRef.current;
      if (pending) persistTotalRef.current(pending);
    };
  }, []);

  const hintCtx = useMemo<HintContext>(() => ({
    smartCube: hasSmartCube,
    scrambleVerif: hasSmartCube && scrambleVerification,
    inspection: useInspection,
    isScrambled: smartCube.validation.isScrambled,
  }), [hasSmartCube, scrambleVerification, smartCube.validation.isScrambled, useInspection]);

  // Phase split timing
  const splitStartRef = useRef<number>(0);
  const solveStartRef = useRef<number>(0);

  const totalTarget = phaseTargets.reduce((s, pt) => s + pt.targetS, 0);
  const totalActual = splits.reduce((s, sp) => s + sp.actualMs / 1000, 0);
  const activeSplit = splits[activeSplitIdx];

  // ── Start solve ─────────────────────────────────────────────────────
  useEffect(() => {
    if (timerPhase === "running" && activeSplitIdx === -1) {
      // Timer just started — activate first phase
      const now = Date.now();
      solveStartRef.current = now;
      splitStartRef.current = now;
      setActiveSplitIdx(0);
      setSplits((prev) => prev.map((s, i) =>
        i === 0 ? { ...s, status: "active" as const } : { ...s, actualMs: 0, status: "pending" as const }
      ));
      setLastSolve(null);
    }
  }, [timerPhase, activeSplitIdx]);

  // ── Mark phase split ────────────────────────────────────────────────
  const markSplit = useCallback(() => {
    if (activeSplitIdx < 0) return;
    const now = Date.now();
    const splitDuration = now - splitStartRef.current;

    setSplits((prev) => {
      const next = [...prev];
      next[activeSplitIdx] = { ...next[activeSplitIdx], actualMs: splitDuration, status: "done" };
      const nextIdx = activeSplitIdx + 1;
      if (nextIdx < next.length) {
        next[nextIdx] = { ...next[nextIdx], status: "active" };
      }
      return next;
    });

    if (activeSplitIdx + 1 >= phaseTargets.length) {
      // All phases done — stop timer
      const totalMs = now - solveStartRef.current;
      const resultSplits: PhaseSplit[] = splits.map((s, i) =>
        i === activeSplitIdx ? { ...s, actualMs: splitDuration, status: "done" as const } : s
      );
      setLastSolve({ totalMs, splits: resultSplits, solveMode, moveLimit, tpsThreshold });
      setActiveSplitIdx(-1);
      engine.handleDown(); // stop timer via spacebar press simulation
    } else {
      setActiveSplitIdx((prev) => prev + 1);
      splitStartRef.current = now;
    }
  }, [activeSplitIdx, phaseTargets.length, splits, engine, solveMode, moveLimit, tpsThreshold]);

  // ── Handle solve complete (smart cube solved or manual stop) ──────
  useEffect(() => {
    if (timerPhase === "stopped" && stoppedTime > 0 && lastSolve === null) {
      // Use precise stoppedTime from timer hook, not Date.now()
      if (solveStartRef.current > 0) {
        const lastIdx = activeSplitIdx >= 0 ? activeSplitIdx : phaseTargets.length - 1;
        const resultSplits = splits.map((s, i) => {
          if (i === lastIdx && s.status === "active") {
            return { ...s, actualMs: stoppedTime - totalActual * 1000, status: "done" as const };
          }
          return s;
        });
        setLastSolve({ totalMs: stoppedTime, splits: resultSplits, solveMode, moveLimit, tpsThreshold });
      }
      setActiveSplitIdx(-1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerPhase, stoppedTime]);

  // ── Reset for new solve ─────────────────────────────────────────────
  const handleNewSolve = useCallback(() => {
    // Flush a completed solve that never received its mode metadata (e.g. the
    // user skipped the move-count input) so it is never dropped from stats.
    const pending = lastSolveRef.current;
    if (pending) persistTotal(pending);
    reset();
    setSplits(phaseTargets.map((pt) => ({ ...pt, actualMs: 0, status: "pending" })));
    setActiveSplitIdx(-1);
    setLastSolve(null);
    setUserMoveCount(null);
    setHadRotations(null);
    setCurrentScramble(RandomStateGenerator.generateScramble(getMin2PhaseSolver()));
  }, [reset, phaseTargets, persistTotal]);

  // ── Render ──────────────────────────────────────────────────────────
  const { t } = useTranslation("training");
  return (
    <div className="relative flex-1 min-h-0 w-full h-full">
      <div className="absolute inset-0 flex flex-col gap-4 overflow-hidden">
        {/* Header */}
        <header className="flex flex-col gap-2.5 shrink-0 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
          <div className="flex items-center gap-3">
            <TrainingBreadcrumb
              onBack={onBack}
              segments={[
                { label: method?.name ?? "?" },
                { label: t("fullSolve.title"), isCurrent: true },
              ]}
            />
            <span className="nums text-[0.62rem] text-ink-3 ml-auto">
              {lastSolve ? formatTime(lastSolve.totalMs) : ""}
            </span>
            {hasSmartCube && (
              <span className="shrink-0 rounded-full px-2.5 py-0.5 text-[0.6rem] font-semibold bg-phase-blue text-white">
                {t("practice.smartCube")}
              </span>
            )}
          </div>

          {/* Mode tabs */}
          <div className="flex gap-1 flex-wrap items-center max-lg:flex-nowrap max-lg:overflow-x-auto max-lg:snap-x max-lg:pb-1">
            {SOLVE_MODE_IDS.map((id) => {
              const keys = SOLVE_MODE_KEYS[id];
              return (
                <Tooltip key={id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleSolveModeChange(id)}
                      className={cn(
                        "relative rounded-md px-3 py-1.5 text-[0.68rem] font-medium transition-colors max-lg:h-10 max-lg:shrink-0 max-lg:px-3.5",
                        solveMode === id
                          ? "bg-ink text-surface"
                          : "text-ink-3 hover:text-ink hover:bg-surface-2",
                      )}
                    >
                      {t(keys.label)}
                      {solveMode === id && (
                        <motion.div
                          layoutId="fullsolve-mode-active"
                          className="absolute inset-0 rounded-md bg-ink -z-10"
                          transition={{ type: "spring", stiffness: 380, damping: 30 }}
                        />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">{t(keys.description)}</TooltipContent>
                </Tooltip>
              );
            })}
            <span className="w-px h-5 bg-line mx-1" />
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <button
                    onClick={handleToggleInspection}
                    disabled={timerPhase === "running" || timerPhase === "holding" || timerPhase === "ready"}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[0.68rem] font-medium transition-colors disabled:pointer-events-none",
                      timerPhase === "running" || timerPhase === "holding" || timerPhase === "ready"
                        ? "opacity-40 cursor-not-allowed"
                        : useInspection
                          ? "bg-caution/10 text-caution border border-caution/20"
                          : "text-ink-3 hover:text-ink hover:bg-surface-2",
                    )}
                  >
                    <Eye className="size-3" />
                    {t("fullSolve.inspection")}{useInspection ? " (15s)" : ""}
                  </button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {useInspection ? t("fullSolve.disableInspection") : t("fullSolve.enableInspection")}
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Mode-specific settings bar */}
          {solveMode === "move-limit" && (
            <div className="flex items-center gap-2 text-[0.62rem] text-ink-3">
              <MoveHorizontal className="size-3.5" />
              <span>{t("fullSolve.maxMovesLabel")}</span>
              <input
                type="number"
                min={20}
                max={100}
                value={moveLimit}
                onChange={(e) => setMoveLimit(parseInt(e.target.value, 10) || 60)}
                className="nums w-14 rounded-md border border-line bg-surface-2 px-2 py-0.5 text-[0.65rem] text-ink text-center"
              />
              <span className="text-ink-3/50">{t("fullSolve.standardMovesHint")}</span>
            </div>
          )}
          {solveMode === "tps-challenge" && (
            <div className="flex items-center gap-2 text-[0.62rem] text-ink-3">
              <Gauge className="size-3.5" />
              <span>{t("fullSolve.minTpsLabel")}</span>
              <input
                type="number"
                min={1}
                max={15}
                step={0.5}
                value={tpsThreshold}
                onChange={(e) => setTpsThreshold(parseFloat(e.target.value) || 4)}
                className="nums w-14 rounded-md border border-line bg-surface-2 px-2 py-0.5 text-[0.65rem] text-ink text-center"
              />
            </div>
          )}
          {solveMode === "rotationless" && (
            <div className="flex items-center gap-2 text-[0.62rem] text-ink-3">
              <Lock className="size-3.5" />
              <span>{t("fullSolve.rotationlessSettings")}</span>
            </div>
          )}
        </header>

        {/* Body */}
        <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-hidden px-4 sm:px-6 lg:px-8 pb-6 lg:pb-8">
          {/* Phase progress bar — only shown in targets mode */}
          {solveMode === "targets" && (
          <div className="shrink-0 flex items-center gap-1">
            {splits.map((split) => {
              const isDone = split.status === "done";
              const isActive = split.status === "active";
              const pct = split.targetS > 0
                ? Math.min(100, Math.round((split.actualMs / 1000 / split.targetS) * 100))
                : 0;
              return (
                <div key={split.phaseId} className="flex-1 flex flex-col gap-1.5 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className={cn(
                      "text-[0.6rem] font-medium truncate",
                      isDone ? "text-ready" : isActive ? "text-ink" : "text-ink-3/40",
                    )}>
                      {split.phaseName}
                    </span>
                    <span className={cn(
                      "nums text-[0.6rem] shrink-0 ml-1",
                      isDone ? "text-ready" : isActive ? "text-ink-2" : "text-ink-3/30",
                    )}>
                      {isDone
                        ? `${(split.actualMs / 1000).toFixed(1)}s`
                        : split.targetS.toFixed(1) + "s"}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                    {isDone && (
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                        className={cn("h-full rounded-full", pct <= 100 ? "bg-ready" : "bg-hold")}
                      />
                    )}
                    {isActive && (
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: "100%" }}
                        transition={{ duration: (split.targetS * 1000) / 1000, ease: "linear" }}
                        className="h-full rounded-full bg-ink/15"
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          )}

          {/* Main area */}
          <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-4">
            {/* Timer / Result area */}
            <div className="flex-1 min-h-70 flex flex-col items-center justify-center rounded-xl border border-line bg-surface relative overflow-hidden">
              {/* Result overlay */}
              <AnimatePresence>
                {timerPhase === "stopped" && lastSolve && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 flex flex-col gap-4 z-10 rounded-xl border border-line bg-surface/90 backdrop-blur-md p-6 overflow-y-auto"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Trophy className="size-10 text-caution" />
                      <span className="nums text-[2.5rem] font-bold text-ink">
                        {formatTime(lastSolve.totalMs)}
                      </span>
                      <span className="text-[0.65rem] text-ink-3">{t("fullSolve.totalSolveTime")}</span>
                    </div>

                    {/* Split breakdown — only shown in targets mode */}
                    {solveMode === "targets" && (
                      <div className="space-y-2 w-full max-w-sm mx-auto">
                        {lastSolve.splits.map((split) => {
                          const overTarget = split.actualMs / 1000 > split.targetS;
                          return (
                            <div
                              key={split.phaseId}
                              className="flex items-center gap-3 rounded-lg border border-line/40 bg-surface-2/60 px-3 py-2"
                            >
                              <span className="text-[0.62rem] font-medium text-ink-2 w-20 shrink-0">
                                {split.phaseName}
                              </span>
                              <span className={cn(
                                "nums text-[0.65rem] font-medium",
                                overTarget ? "text-hold" : "text-ready",
                              )}>
                                {(split.actualMs / 1000).toFixed(2)}s
                              </span>
                              <span className="nums text-[0.6rem] text-ink-3/60">
                                / {split.targetS.toFixed(1)}s
                              </span>
                              <div className="ml-auto flex items-center gap-1 shrink-0">
                                {overTarget ? (
                                  <X className="size-3.5 text-hold" />
                                ) : (
                                  <Check className="size-3.5 text-ready" />
                                )}
                                <span className={cn(
                                  "nums text-[0.6rem]",
                                  overTarget ? "text-hold" : "text-ready",
                                )}>
                                  {overTarget
                                    ? `+${((split.actualMs / 1000) - split.targetS).toFixed(1)}s`
                                    : "OK"}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Total target vs actual — only in targets mode */}
                    {solveMode === "targets" && (
                      <div className="flex items-center justify-center gap-3">
                        <div className="flex items-center gap-1.5 text-[0.6rem] text-ink-3">
                          <Target className="size-3" />
                          {t("fullSolve.totalTargetValue", { value: totalTarget.toFixed(1) })}
                        </div>
                        <div className={cn(
                          "flex items-center gap-1.5 text-[0.6rem] font-medium",
                          totalActual <= totalTarget ? "text-ready" : "text-hold",
                        )}>
                          {t("fullSolve.actualValue", { value: totalActual.toFixed(1) })}
                        </div>
                      </div>
                    )}

                    {/* Mode-specific result input */}
                    {solveMode === "move-limit" && (
                      <div className="flex flex-col items-center gap-2 pt-2 border-t border-line">
                        <span className="text-[0.6rem] text-ink-3">{t("fullSolve.howManyMoves")}</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            max={200}
                            value={userMoveCount ?? ""}
                            onChange={(e) => setUserMoveCount(parseInt(e.target.value, 10) || null)}
                            className="nums w-16 rounded-md border border-line bg-surface-2 px-2 py-1 text-[0.7rem] text-ink text-center"
                            placeholder="55"
                          />
                          {userMoveCount !== null && (
                            <span className={cn(
                              "text-[0.65rem] font-semibold",
                              userMoveCount <= moveLimit ? "text-ready" : "text-hold",
                            )}>
                              {userMoveCount <= moveLimit
                                ? t("fullSolve.underLimit", { count: moveLimit - userMoveCount })
                                : t("fullSolve.overLimit", { count: userMoveCount - moveLimit })}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {solveMode === "tps-challenge" && (
                      <div className="flex flex-col items-center gap-2 pt-2 border-t border-line">
                        <span className="text-[0.6rem] text-ink-3">{t("fullSolve.howManyMovesSolution")}</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            max={200}
                            value={userMoveCount ?? ""}
                            onChange={(e) => setUserMoveCount(parseInt(e.target.value, 10) || null)}
                            className="nums w-16 rounded-md border border-line bg-surface-2 px-2 py-1 text-[0.7rem] text-ink text-center"
                            placeholder="55"
                          />
                          {userMoveCount !== null && lastSolve && (
                            <span className={cn(
                              "text-[0.65rem] font-semibold",
                              (userMoveCount / (lastSolve.totalMs / 1000)) >= tpsThreshold ? "text-ready" : "text-hold",
                            )}>
                              {t("fullSolve.tpsValue", { tps: (userMoveCount / (lastSolve.totalMs / 1000)).toFixed(1) })}
                              {(userMoveCount / (lastSolve.totalMs / 1000)) >= tpsThreshold
                                ? t("fullSolve.passed") : t("fullSolve.belowTarget")}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {solveMode === "rotationless" && (
                      <div className="flex flex-col items-center gap-2 pt-2 border-t border-line">
                        <span className="text-[0.6rem] text-ink-3">{t("fullSolve.didRotate")}</span>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setHadRotations(false)}
                            className={cn(
                              "rounded-md px-3 py-1.5 text-[0.65rem] font-medium transition-colors",
                              !hadRotations ? "bg-ready/10 text-ready border border-ready/30" : "bg-surface-2 text-ink-3 hover:text-ink",
                            )}
                          >
                            <Check className="size-3 inline mr-1" />{t("fullSolve.noRotations")}
                          </button>
                          <button
                            onClick={() => setHadRotations(true)}
                            className={cn(
                              "rounded-md px-3 py-1.5 text-[0.65rem] font-medium transition-colors",
                              hadRotations ? "bg-hold/10 text-hold border border-hold/30" : "bg-surface-2 text-ink-3 hover:text-ink",
                            )}
                          >
                            <RotateCw className="size-3 inline mr-1" />{t("fullSolve.hadRotations")}
                          </button>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={handleNewSolve}
                      className="mx-auto inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-[0.7rem] font-semibold text-surface hover:bg-ink/90 transition-colors"
                    >
                      {t("fullSolve.newSolve")}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Scramble display above timer */}
              {currentScramble && timerPhase !== "running" && (
                <div className="w-full max-w-lg shrink-0 px-4 pt-4">
                  <ScrambleDisplay
                    scramble={currentScramble}
                    displayScramble={displayScramble}
                    smartCubeConnected={hasSmartCube}
                    states={hasSmartCube && scrambleVerification ? smartCube.validation.states : undefined}
                    currentIndex={hasSmartCube ? smartCube.validation.currentIndex : 0}
                    errorMoves={hasSmartCube ? smartCube.validation.displayErrorMoves : []}
                    pendingHalfDouble={hasSmartCube ? smartCube.validation.pendingHalfDouble : false}
                    isScrambled={hasSmartCube ? smartCube.validation.isScrambled : false}
                    needsReset={hasSmartCube ? smartCube.validation.needsReset : false}
                    awaitingSolve={hasSmartCube ? smartCube.validation.awaitingSolve : false}
                  />
                </div>
              )}

              {/* Timer */}
              <TimerContainer
                phase={timerPhase}
                time={time}
                lastTime={null}
                hintCtx={hintCtx}
                onPress={press}
                onRelease={release}
                className="flex-1"
              />

              {/* Phase split hint */}
              {timerPhase === "running" && activeSplit && (
                <p className="pb-4 text-[0.6rem] text-ink-3/60">
                  {t("fullSolve.currentSplit", { phase: activeSplit.phaseName })}
                </p>
              )}
            </div>

            {/* Right: phase detail panel */}
            <TouchAside title={t("fullSolve.targets")} className="min-h-0 lg:w-64 lg:shrink-0 flex flex-col gap-3">
              {/* Mini 3D Cube */}
              {hasSmartCube && (
                <MiniCube3DPanel className="shrink-0" />
              )}

              {/* Mode-specific sidebar */}
              {solveMode === "targets" && (
                <PhaseTargetsPanel
                  splits={splits}
                  totalTarget={totalTarget}
                  totalActual={totalActual}
                  onMarkSplit={markSplit}
                />
              )}

              {solveMode === "move-limit" && (
                <MoveLimitInfo moveLimit={moveLimit} />
              )}

              {solveMode === "tps-challenge" && (
                <TpsInfo tpsThreshold={tpsThreshold} />
              )}

              {solveMode === "rotationless" && (
                <RotationlessInfo hadRotations={hadRotations ?? false} />
              )}

              {/* Quick tips */}
              <div className="rounded-xl border border-line bg-surface p-3">
                <div className="flex gap-2">
                  <div className="grid size-7 shrink-0 place-items-center rounded-md bg-surface-2">
                    <Flame className="size-3.5 text-caution" />
                  </div>
                  <div>
                    <p className="text-[0.6rem] text-ink-2 leading-relaxed">
                      {solveMode === "targets" && t("fullSolve.tipTargets")}
                      {solveMode === "move-limit" && t("fullSolve.tipMoveLimit", { limit: moveLimit })}
                      {solveMode === "tps-challenge" && t("fullSolve.tipTps", { tps: tpsThreshold })}
                      {solveMode === "rotationless" && t("fullSolve.tipRotationless")}
                    </p>
                  </div>
                </div>
              </div>
            </TouchAside>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Sidebar Panels (mode-specific)
   ─────────────────────────────────────────────────────────────────────── */

