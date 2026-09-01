"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { CubeState, StringToMove, FaceletStringConverter } from "@cubeforge/math-core";
import type { CubeMoveEvent } from "@cubeforge/types";
import { globalCubeAdapter } from "@/components/Hardware/CubeConnector";
import {
  type InfiniteF2LOptions,
  type ActivePairState,
  type F2LSlotId,
  type CrossColor,
  spawnInfiniteF2LState,
  checkSolvedPairs,
  respawnPair,
  buildInfiniteF2LMask,
  CROSS_COLOR_CONFIGS,
} from "./infiniteF2lEngine";
import type { Cube3DEngine } from "@cubeforge/cube-3d-engine";

export interface UseInfiniteF2LSessionProps {
  options: InfiniteF2LOptions;
  engineRef: React.RefObject<Cube3DEngine | null>;
  isStarted: boolean;
}

export interface FinalSessionStats {
  totalTimeMs: number;
  solvedCount: number;
  totalMoves: number;
  avgTps: number;
  peakTps: number;
  paceSecPerPair: number;
}

export function useInfiniteF2LSession({
  options: userOptions,
  engineRef,
  isStarted,
}: UseInfiniteF2LSessionProps) {
  const optionsRef = useRef<InfiniteF2LOptions>(userOptions);
  optionsRef.current = userOptions;

  const [solvedCount, setSolvedCount] = useState(0);
  const [activePairs, setActivePairs] = useState<ActivePairState[]>([]);
  const [recentSolved, setRecentSolved] = useState<F2LSlotId | null>(null);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [elapsedMs, setElapsedMs] = useState(0);
  const [totalMoves, setTotalMoves] = useState(0);
  const [liveTps, setLiveTps] = useState(0);
  const [peakTps, setPeakTps] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [finalStats, setFinalStats] = useState<FinalSessionStats | null>(null);

  // Internal logical cube state
  const logicalStateRef = useRef<CubeState>(new CubeState());
  const activePairsRef = useRef<ActivePairState[]>([]);
  const solvedCountRef = useRef(0);
  const totalMovesRef = useRef(0);
  const moveTimestampsRef = useRef<number[]>([]);
  const peakTpsRef = useRef(0);
  const isFinishedRef = useRef(false);
  const startTimeRef = useRef(Date.now());

  // Apply stickering mask helper
  const applyStickeringMask = useCallback((crossColor: CrossColor, pairs: ActivePairState[]) => {
    if (!engineRef.current) return;
    const mask = buildInfiniteF2LMask(crossColor, pairs);
    engineRef.current.clearLayerGray();
    engineRef.current.setPhaseStickering(mask, "#3a3a3a");
  }, [engineRef]);

  // Finish session calculation
  const finishSession = useCallback(() => {
    if (isFinishedRef.current) return;
    isFinishedRef.current = true;
    setIsFinished(true);

    const totalMs = Math.max(100, Date.now() - startTimeRef.current);
    const count = solvedCountRef.current;
    const moves = totalMovesRef.current;
    const totalSec = totalMs / 1000;
    const avgTps = totalSec > 0 ? Number((moves / totalSec).toFixed(2)) : 0;
    const paceSecPerPair = count > 0 ? Number((totalSec / count).toFixed(2)) : 0;

    setElapsedMs(totalMs);
    setLiveTps(0);
    setFinalStats({
      totalTimeMs: totalMs,
      solvedCount: count,
      totalMoves: moves,
      avgTps,
      peakTps: peakTpsRef.current,
      paceSecPerPair,
    });
  }, []);

  // Restart / Initialize session immediately
  const startSession = useCallback(
    (overrideOptions?: InfiniteF2LOptions) => {
      const opts = overrideOptions ?? optionsRef.current;
      const crossColor: CrossColor = opts.crossColor ?? "white";
      const concurrentPairs = Math.min(4, Math.max(1, opts.concurrentPairs ?? 2));
      const allowedSlots: F2LSlotId[] = opts.allowedSlots ?? ["FR", "FL", "BL", "BR"];
      const allowTrapped = opts.allowTrapped ?? true;

      const shuffled = [...allowedSlots].sort(() => Math.random() - 0.5);
      const initialSlots = shuffled.slice(0, concurrentPairs);

      const { state, activePairs: spawnedPairs } = spawnInfiniteF2LState(
        crossColor,
        initialSlots,
        allowTrapped,
      );

      logicalStateRef.current = state;
      activePairsRef.current = spawnedPairs;
      solvedCountRef.current = 0;
      totalMovesRef.current = 0;
      moveTimestampsRef.current = [];
      peakTpsRef.current = 0;
      isFinishedRef.current = false;
      const now = Date.now();
      startTimeRef.current = now;

      setActivePairs(spawnedPairs);
      setSolvedCount(0);
      setTotalMoves(0);
      setStartTime(now);
      setElapsedMs(0);
      setRecentSolved(null);
      setLiveTps(0);
      setPeakTps(0);
      setIsFinished(false);
      setFinalStats(null);

      // Apply initial generated facelets to 3D cube model
      if (engineRef.current) {
        const facelets = FaceletStringConverter.toFaceletString(state);
        engineRef.current.syncFacelets(facelets);
      }

      // Apply stickering mask to 3D cube
      applyStickeringMask(crossColor, spawnedPairs);
    },
    [applyStickeringMask, engineRef],
  );

  // Handle incoming move (from BLE physical smart cube)
  const processMove = useCallback(
    (moveNotation: string) => {
      if (!isStarted || isFinishedRef.current) return;
      const moveEnum = StringToMove[moveNotation.trim()];
      if (moveEnum === undefined) return;

      const now = performance.now();
      moveTimestampsRef.current.push(now);

      const opts = optionsRef.current;
      const crossColor: CrossColor = opts.crossColor ?? "white";
      const allowedSlots: F2LSlotId[] = opts.allowedSlots ?? ["FR", "FL", "BL", "BR"];
      const targetPairs = opts.targetPairs ?? 0;

      totalMovesRef.current += 1;
      setTotalMoves(totalMovesRef.current);

      // Apply to logical state
      logicalStateRef.current.applyMove(moveEnum);

      // Check if any active pairs are now solved
      const solvedSlots = checkSolvedPairs(
        logicalStateRef.current,
        activePairsRef.current,
      );

      if (solvedSlots.length > 0) {
        let currentActive = activePairsRef.current;

        for (const solvedSlotId of solvedSlots) {
          solvedCountRef.current += 1;
          setSolvedCount(solvedCountRef.current);
          setRecentSolved(solvedSlotId);

          // If target pairs reached, finish immediately!
          if (targetPairs > 0 && solvedCountRef.current >= targetPairs) {
            finishSession();
            return;
          }

          const { nextActivePairs } = respawnPair(
            logicalStateRef.current,
            crossColor,
            currentActive,
            solvedSlotId,
            allowedSlots,
          );

          currentActive = nextActivePairs;
        }

        activePairsRef.current = currentActive;
        setActivePairs([...currentActive]);

        // Sync new state to 3D cube model & stickering mask
        if (engineRef.current) {
          const facelets = FaceletStringConverter.toFaceletString(logicalStateRef.current);
          engineRef.current.syncFacelets(facelets);
        }
        applyStickeringMask(crossColor, currentActive);
      }
    },
    [isStarted, finishSession, applyStickeringMask, engineRef],
  );

  // High-precision Live TPS & Timer Loop (100ms interval = 10Hz)
  useEffect(() => {
    if (!isStarted || isFinished) return;

    const interval = setInterval(() => {
      if (isFinishedRef.current) return;
      const nowPerf = performance.now();
      setElapsedMs(Date.now() - startTime);

      // Prune timestamps older than 1500ms
      const windowMs = 1500;
      const cutoff = nowPerf - windowMs;
      const recent = moveTimestampsRef.current.filter((t) => t >= cutoff);
      moveTimestampsRef.current = recent;

      if (recent.length < 2) {
        // If no turns in the last 700ms, live TPS is 0
        const lastMove = recent[recent.length - 1];
        if (!lastMove || nowPerf - lastMove > 700) {
          setLiveTps(0);
        }
        return;
      }

      const lastMove = recent[recent.length - 1];
      const timeSinceLastMove = nowPerf - lastMove;

      // If user paused for > 700ms, live TPS immediately drops to 0
      if (timeSinceLastMove > 700) {
        setLiveTps(0);
        return;
      }

      // Time between first and last move in the rolling window
      const firstMove = recent[0];
      const dtSeconds = (lastMove - firstMove) / 1000;

      if (dtSeconds > 0.05) {
        const movesInSpan = recent.length - 1;
        const currentLive = Number((movesInSpan / dtSeconds).toFixed(1));
        setLiveTps(currentLive);

        if (currentLive > peakTpsRef.current) {
          peakTpsRef.current = currentLive;
          setPeakTps(currentLive);
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isStarted, isFinished, startTime]);

  // Subscribe to physical smart cube BLE moves
  useEffect(() => {
    const sub = globalCubeAdapter.moves$?.subscribe((event: CubeMoveEvent) => {
      if (event) {
        const notation = event.displayNotation ?? `${event.face}${event.direction === -1 ? "'" : event.direction === 2 ? "2" : ""}`;
        processMove(notation);
      }
    });

    return () => {
      sub?.unsubscribe();
    };
  }, [processMove]);

  // Initial setup when session starts
  useEffect(() => {
    if (isStarted) {
      startSession();
    }
  }, [isStarted, startSession]);

  const crossColor = userOptions.crossColor ?? "white";

  // Overall session average TPS
  const sessionSeconds = elapsedMs / 1000;
  const avgTps = sessionSeconds >= 1 ? Number((totalMoves / sessionSeconds).toFixed(1)) : 0;
  const paceSecPerPair = solvedCount > 0 ? Number((sessionSeconds / solvedCount).toFixed(2)) : 0;

  return {
    solvedCount,
    activePairs,
    recentSolved,
    elapsedMs,
    totalMoves,
    liveTps,
    avgTps,
    peakTps,
    paceSecPerPair,
    isFinished,
    finalStats,
    finishSession,
    processMove,
    restart: (overrideOpts?: InfiniteF2LOptions) => startSession(overrideOpts),
    crossColorConfig: CROSS_COLOR_CONFIGS[crossColor],
  };
}
