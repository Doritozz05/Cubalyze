"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { CubeState, StringToMove } from "@cubeforge/math-core";
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

  // Internal logical cube state
  const logicalStateRef = useRef<CubeState>(new CubeState());
  const activePairsRef = useRef<ActivePairState[]>([]);
  const solvedCountRef = useRef(0);
  const totalMovesRef = useRef(0);

  // Apply stickering mask helper
  const applyStickeringMask = useCallback((crossColor: CrossColor, pairs: ActivePairState[]) => {
    if (!engineRef.current) return;
    const mask = buildInfiniteF2LMask(crossColor, pairs);
    engineRef.current.clearLayerGray();
    engineRef.current.setPhaseStickering(mask, "#3a3a3a");
  }, [engineRef]);

  // Restart / Initialize session immediately (supports explicit options override)
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

      setActivePairs(spawnedPairs);
      setSolvedCount(0);
      setTotalMoves(0);
      setStartTime(Date.now());
      setElapsedMs(0);
      setRecentSolved(null);

      // Apply stickering mask to 3D cube
      applyStickeringMask(crossColor, spawnedPairs);
    },
    [applyStickeringMask],
  );

  // Handle incoming move (from BLE physical smart cube)
  const processMove = useCallback(
    (moveNotation: string) => {
      if (!isStarted) return;
      const moveEnum = StringToMove[moveNotation.trim()];
      if (moveEnum === undefined) return;

      const opts = optionsRef.current;
      const crossColor: CrossColor = opts.crossColor ?? "white";
      const allowedSlots: F2LSlotId[] = opts.allowedSlots ?? ["FR", "FL", "BL", "BR"];

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
        applyStickeringMask(crossColor, currentActive);
      }
    },
    [isStarted, applyStickeringMask],
  );

  // Timer tick effect
  useEffect(() => {
    if (!isStarted) return;
    const interval = setInterval(() => {
      setElapsedMs(Date.now() - startTime);
    }, 250);
    return () => clearInterval(interval);
  }, [isStarted, startTime]);

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

  // TPS computation
  const tps = useMemo(() => {
    const seconds = elapsedMs / 1000;
    if (seconds < 1) return 0;
    return Number((totalMoves / seconds).toFixed(1));
  }, [totalMoves, elapsedMs]);

  const crossColor = userOptions.crossColor ?? "white";

  return {
    solvedCount,
    activePairs,
    recentSolved,
    elapsedMs,
    totalMoves,
    tps,
    processMove,
    restart: (overrideOpts?: InfiniteF2LOptions) => startSession(overrideOpts),
    crossColorConfig: CROSS_COLOR_CONFIGS[crossColor],
  };
}
