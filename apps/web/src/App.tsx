import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "zustand";
import { MainLayout } from "@/components/Layout/MainLayout";
import { LeftSidebar } from "@/components/Layout/LeftSidebar";
import { MobileTabBar } from "@/components/Layout/MobileTabBar";
import { ScrambleDisplay } from "@/components/Scramble/ScrambleDisplay";
import { TimerContainer } from "@/components/Timer/TimerContainer";
import { ManualTimeInput } from "@/components/Timer/ManualTimeInput";
import { SessionStats } from "@/components/Stats/SessionStats";
import { InsightsDashboard } from "@/components/Insights/InsightsDashboard";
import { PracticeDashboard } from "@/views/Practice/PracticeDashboard";
import { TrainingDashboard } from "@/views/Training/TrainingDashboard";
import { UltraSkillTreeView } from "@/views/SkillTree/UltraSkillTreeView";
import { ManualSolveSheet } from "@/components/Stats/ManualSolveSheet";
import { Cube3DPanel } from "@/components/Cube3D/Cube3DPanel";
import { WidgetHost } from "@/widgets/explorer";
import { FloatingCubeButton } from "@/widgets/implementations/cube-button/FloatingCubeButton";
import { Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast, Toaster } from "sonner";
import { useShortcuts } from "@/hooks/useShortcuts";
import { usePersistentSession } from "@/hooks/usePersistentSession";
import { useSolveSession, runAnalysis } from "@/hooks/useSolveSession";
import { useOrientation } from "@/hooks/useOrientation";
import { useIsTouch } from "@/hooks/use-mobile";
import { preferencesStore } from "@cubeforge/state";
import { detectPbMilestones, type PbMilestoneResult } from "@/utils/pbDetection";
import { queueSolveAnalysis } from "@/utils/solveAnalysisCoordinator";
import { globalAudioSystem } from "@/utils/audioSystem";
import { hapticCelebrate } from "@/utils/haptics";
import {
  generateScrambleFor,
  puzzleCategoryToType,
  puzzleCategoryToOrder,
  preloadSolvers,
} from "@/utils/puzzleUtils";
import { ThemeProvider } from "@/components/theme-provider";
import { v4 as uuidv4 } from "uuid";
import type { Penalty, PuzzleCategory, Solve, SolveMethod, SolveSource } from "@/types";
import { normalizePenalty, effectiveTime } from "@/types";
import type { CubeMoveEvent, CubeOrientation, OrientationTimeline, SolveMetrics } from "@cubeforge/types";
import { SIDEBAR_MOTION, type ViewId } from "@/components/Layout/sidebar.constants";
import { migrateWidgetPositions } from "@/widgets/migration";
import { installWidgetDebug } from "@/widgets/debug";
import { registerAllWidgets } from "@/widgets/registerAllWidgets";
import { connectWidgetLifecycle } from "@/widgets/sdk";
import { widgetStore, useWidgetStore } from "@/widgets/widgetStore";

// Module-level registration — must happen before first render so WidgetHost
// can resolve components from WidgetRegistry immediately.
registerAllWidgets();
import "@/index.css";

export default function App() {
  // Touch regime (<1024px, mobile + tablet): bottom tab bar + top toasts.
  const isTouch = useIsTouch();

  const {
    session,
    sessions,
    solves,
    addSolve,
    updateSolve,
    deleteSolve,
    clearSession,
    importSolves,
    newSession,
    switchSession,
    renameSession,
    deleteSession,
    fetchSessionSolves,
  } = usePersistentSession();

  const methodPref = useStore(preferencesStore, (s) => s.method);
  const scrambleDisplay = useStore(preferencesStore, (s) => s.scrambleDisplay);
  const focusMode = useStore(preferencesStore, (s) => s.focusMode);
  const showPbDelta = useStore(preferencesStore, (s) => s.showPbDelta);
  const pbCelebrationAudio = useStore(preferencesStore, (s) => s.pbCelebrationAudio);
  const pbCelebrationAnimation = useStore(preferencesStore, (s) => s.pbCelebrationAnimation);
  const inputMode = useStore(preferencesStore, (s) => s.inputMode);
  const clickToStart = useStore(preferencesStore, (s) => s.clickToStart);
  const spacebarHoldDelay = useStore(preferencesStore, (s) => s.spacebarHoldDelay);

  // ── PB Celebration state ───────────────────────────────────────────────
  const [activePbMilestone, setActivePbMilestone] = useState<PbMilestoneResult | null>(null);

  const handleDismissPbBanner = useCallback(() => {
    setActivePbMilestone(null);
  }, []);

  // ── Refs to avoid stale closures in the lifecycle callback ────────────
  const solvesRef = useRef(solves);
  solvesRef.current = solves;
  const methodRef = useRef(methodPref);
  methodRef.current = methodPref;

  const [scrambleIndex, setScrambleIndex] = useState(0);
  // Single source of truth for what the main stage shows. Replaces the old
  // cube3DActive + sidebarActive pair.
  const [activeView, setActiveView] = useState<ViewId>("timer");
  // Training preset for Algorithms → Training bridge: when user clicks
  // "Practice This Case" from Algorithms view, we navigate to Training
  // with the case already loaded in AlgorithmDrillView.
  const [trainingPreset, setTrainingPreset] = useState<{
    subsetId: string;
    caseId: string;
  } | null>(null);
  const [cubePanelOpen, setCubePanelOpen] = useState(false);
  const [cube3DReady, setCube3DReady] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [puzzle, setPuzzle] = useState<PuzzleCategory>("3x3");
  const [currentScramble, setCurrentScramble] = useState(() =>
    generateScrambleFor("3x3"),
  );

  // ── Preload solvers at app startup ─────────────────────────────────────
  // Builds the 2×2 combined table (~800ms) and warms up Min2Phase WASM
  // (~150-350ms) so the first scramble of either type is instant.
  useEffect(() => {
    preloadSolvers();
  }, []);

  // ── Widget lifecycle connection (avoids stale closure via refs) ────────
  useEffect(() => {
    migrateWidgetPositions();
    installWidgetDebug();
    const disconnect = connectWidgetLifecycle(() => ({
      solves: solvesRef.current,
      method: methodRef.current,
      theme: "system" as const,
      onNavigate: (view) => setActiveView(view),
    }));
    return disconnect;
  }, []);

  // ── Last solve analysis (displayed in the "Analysis" view) ─────────────
  const [lastAnalysis, setLastAnalysis] = useState<SolveMetrics | null>(null);
  // Monotonic completion ordering prevents an out-of-order IndexedDB promise
  // from deciding which analysis is displayed. A token becomes "saved" only
  // after its own insert succeeds, so a failed later insert cannot hide an
  // earlier valid analysis.
  const completionTokenRef = useRef(0);
  const latestSavedTokenRef = useRef(0);

  // Tracks the live Smart Cube connection state so `handleComplete` (which
  // must be defined *before* `useSolveSession` provides `smartCubeConnected`)
  // can read the current connection status without a temporal-dead-zone
  // dependency. Synced via the effect below.
  const smartCubeConnectedRef = useRef(false);

  // Disable practice-timer keyboard shortcuts when training view is active
  // (the training drill has its own timer + space handler via useDrillTimer).
  const trainingActiveRef = useRef(false);
  useEffect(() => {
    trainingActiveRef.current = activeView === "training";
  }, [activeView]);


  const handlePuzzleChange = useCallback((newPuzzle: PuzzleCategory) => {
    setPuzzle(newPuzzle);
    setCurrentScramble(generateScrambleFor(newPuzzle));
    setScrambleIndex(0);
    toast.success(`Switched to ${newPuzzle}`);
  }, []);

  const handleRegenerate = useCallback(() => {
    setCurrentScramble(generateScrambleFor(puzzle));
    setScrambleIndex((i) => i + 1);
    toast.success("New scramble");
  }, [puzzle]);

  const handleComplete = useCallback(
    (
      time: number,
      penalty: Penalty,
      rawMoves: CubeMoveEvent[],
      _rawOrientations: (CubeOrientation | undefined)[],
      rawOrientationTimeline: OrientationTimeline | undefined,
    ) => {
      // These locals are captured by this solve's background job before the
      // next scramble is generated, so the analysis uses the correct input.
      const capturedScramble = currentScramble;
      const capturedMethod = methodPref;
      const solveId = uuidv4();
      const completionToken = ++completionTokenRef.current;

      // `smartCubeConnectedRef.current` reflects the live connection state at
      // solve-stop time (synced by the effect below). We use a ref instead of
      // the `smartCubeConnected` variable directly because `handleComplete` is
      // declared before `useSolveSession` provides it (it's passed as `onSolve`).
      const capturedSource: SolveSource = smartCubeConnectedRef.current ? "smart" : "manual";

      // Check for Personal Best milestones (Single, Ao5, Ao12) before adding

      const pbResult = detectPbMilestones(solvesRef.current, time, penalty, puzzleCategoryToType(puzzle));
      if (pbResult.types.length > 0) {
        hapticCelebrate();
        if (pbCelebrationAudio) {
          globalAudioSystem.playPbFanfare(pbResult.types);
        }
        if (pbCelebrationAnimation) {
          setActivePbMilestone(pbResult);
        }
      } else {
        setActivePbMilestone(null);
      }

      // Save with raw moves immediately so replay/timeline have data from the
      // first render. The background job later replaces them with compacted
      // moves and computed metrics.
      const savePromise = addSolve({
        id: solveId,
        time,
        scramble: scrambleDisplay ? capturedScramble : "",
        penalty,
        method: capturedMethod,
        source: capturedSource,
        moves: rawMoves,
        orientationTimeline: rawOrientationTimeline,
        puzzleType: puzzleCategoryToType(puzzle),
      });
      savePromise
        .then((returnedId) => {
          if (!returnedId) {
            console.warn('[handleComplete] addSolve returned null — solve NOT saved to DB!');
            toast.error('Solve not saved — database not ready. Try again.');
            return;
          }
          latestSavedTokenRef.current = Math.max(latestSavedTokenRef.current, completionToken);
          setCurrentScramble(generateScrambleFor(puzzle));
          setScrambleIndex((i) => i + 1);

          // Analysis is intentionally independent from the save continuation.
          // It waits for this exact insert, then patches this exact solve.
          // Nothing here depends on a global "pending solve" ref.
          if (rawMoves.length > 0) {
            queueSolveAnalysis(
              {
                solveId,
                save: savePromise,
                analyze: async () => runAnalysis(
                  rawMoves,
                  capturedScramble,
                  capturedMethod,
                  _rawOrientations,
                  time,
                ),
                onResult: async ({ metrics: analysis, compactedMoves, compactedOrientationTimeline }) => {
                  if (latestSavedTokenRef.current === completionToken) {
                    setLastAnalysis(analysis);
                  }
                  console.log(
                    '%c[App] Persisting moves+analysis to solve %s · %d raw → %d compacted',
                    'color:#38bdf8',
                    solveId.slice(0, 8),
                    rawMoves.length,
                    compactedMoves.length,
                  );
                  await updateSolve(solveId, {
                    moves: compactedMoves,
                    orientationTimeline: compactedOrientationTimeline,
                    analysis,
                  });
                },
              },
              (err) => {
                console.error(`[App] Background analysis failed for solve ${solveId}:`, err);
              },
            );
          }
        })
        .catch((err) => {
          console.error('[handleComplete] addSolve threw:', err);
          toast.error("Couldn't save solve — check console for details");
        });
    },
    [addSolve, currentScramble, methodPref, pbCelebrationAudio, pbCelebrationAnimation, puzzle, scrambleDisplay, updateSolve],
  );

  // ── Centralised orchestration ───────────────────────────────────────────
  const session$ = useSolveSession(currentScramble, { onSolve: handleComplete, keyboardDisabledRef: trainingActiveRef });
  const {
    phase: timerPhase,
    time: timerTime,
    lastTime: timerLastTime,
    press: timerPress,
    release: timerRelease,
    cancel: timerCancel,
    validation,
    smartCubeConnected,
    inspection,
    scrambleVerification,
  } = session$;

  // Sync the connection ref so handleComplete (declared above, before session$
  // was available) can read the current Smart Cube connection state.
  useEffect(() => {
    smartCubeConnectedRef.current = smartCubeConnected;
  }, [smartCubeConnected]);

  // Reset PB celebration banner when starting or preparing a new solve
  useEffect(() => {
    if (timerPhase !== "idle" && timerPhase !== "stopped") {
      setActivePbMilestone(null);
    }
  }, [timerPhase]);


  // ── Import solve wrapper (adapts importSolves to DataSection's expected shape) ──
  const handleImportSolves = useCallback(
    async (inputs: Array<{ time: number; penalty: Penalty; scramble: string; method?: string; timestamp: number; note?: string; source?: SolveSource; puzzleType?: string }>) => {
      await importSolves(inputs);
    },
    [importSolves],
  );

  const { remapScramble } = useOrientation();
  const displayScramble = remapScramble(currentScramble);

  // Refs so global shortcuts can read/act on the timer without re-rendering.
  const timerStateRef = useRef(timerPhase);
  timerStateRef.current = timerPhase;
  const cancelRef = useRef<(() => void) | null>(null);

  const handleTimerCancel = useCallback(() => {
    timerCancel();
  }, [timerCancel]);

  const handleCopy = useCallback(async () => {
    const fail = () => toast.error("Couldn't copy scramble");
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(currentScramble);
        toast.success("Scramble copied");
        return;
      }
    } catch {
      /* fall through */
    }
    try {
      const ta = document.createElement("textarea");
      ta.value = currentScramble;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      if (ok) toast.success("Scramble copied");
      else fail();
    } catch {
      fail();
    }
  }, [currentScramble]);

  const handleCancelShortcut = useCallback(() => {
    timerCancel();
  }, [timerCancel]);

  const handleUpdate = useCallback(
    (id: string, updates: { penalty?: Penalty; note?: string | null }) => {
      updateSolve(id, updates).catch(() => toast.error("Update failed"));
    },
    [updateSolve],
  );

  const handleDelete = useCallback(
    (id: string) => {
      deleteSolve(id).catch(() => toast.error("Delete failed"));
    },
    [deleteSolve],
  );

  const handleClear = useCallback(() => {
    clearSession().catch(() => toast.error("Couldn't clear session"));
  }, [clearSession]);

  const handleNewSession = useCallback(() => {
    newSession(undefined, puzzleCategoryToType(puzzle))
      .then(() => {
        setCurrentScramble(generateScrambleFor(puzzle));
        setScrambleIndex(0);
        toast.success("New session started");
      })
      .catch(() => toast.error("Couldn't create session"));
  }, [newSession, puzzle]);

  const handleSwitchSession = useCallback(
    (id: string) => {
      switchSession(id).catch(() => toast.error("Couldn't switch session"));
    },
    [switchSession],
  );

  useShortcuts({
    onNewScramble: handleRegenerate,
    onCopyScramble: handleCopy,
    onCancel: handleCancelShortcut,
    timerStateRef,
  });

  useEffect(() => {
    document.title = `cubeforge — ${solves.length} solves`;
  }, [solves.length]);

  const currentPuzzleType = puzzleCategoryToType(puzzle);
  const puzzleSolves = solves.filter((s) => (s.puzzleType ?? "3x3x3") === currentPuzzleType);
  const validSolves = puzzleSolves.filter((s) => normalizePenalty(s.penalty) !== "DNF");
  const currentPB =
    validSolves.length > 0
      ? Math.min(
          ...validSolves.map((s) => effectiveTime(s)),
        )
      : null;

  // Previous PB (excluding the most recent solve) for accurate PB delta comparison
  const previousSolves = puzzleSolves.slice(1).filter((s) => normalizePenalty(s.penalty) !== "DNF");
  const previousPB =
    previousSolves.length > 0
      ? Math.min(
          ...previousSolves.map((s) => effectiveTime(s)),
        )
      : null;

  const timerStateRefValue = timerStateRef.current;
  const timerRunning =
    timerStateRefValue === "running" || timerStateRefValue === "ready";
  const isManualMode = inputMode === "manual";

  const [manualFocus, setManualFocus] = useState(false);

  const isFocused =
    (isManualMode && manualFocus) ||
    (focusMode &&
      !isManualMode &&
      (timerPhase === "running" ||
        timerPhase === "inspection" ||
        timerPhase === "holding" ||
        timerPhase === "ready_for_move" ||
        (timerPhase === "ready" && !smartCubeConnected)));

  const scrollToTimer = useCallback(() => {
    document.getElementById("timer-section")?.scrollIntoView({
      behavior: "smooth",
    });
  }, []);

  // ── Stage navigation (driven by the LeftSidebar rail) ───────────────────
  const handleNavigate = useCallback(
    (view: ViewId) => {
      setActiveView(view);
      // Close the 3D cube panel when leaving the timer stage — the split
      // only makes sense alongside the timer, not Stats/Analysis/Practice.
      if (view !== "timer") setCubePanelOpen(false);
      if (view === "timer") scrollToTimer();
    },
    [scrollToTimer],
  );

  // Open the 3D cube panel from the floating button. Always returns to the
  // timer stage so the split is timer | cube.
  const handleOpenCube = useCallback(() => {
    setActiveView("timer");
    setCube3DReady(true);
    setCubePanelOpen(true);
  }, []);

  const handleCloseCube = useCallback(() => setCubePanelOpen(false), []);

  // State for the manual solve sheet (opened from the Header "+" button).
  const [manualOpen, setManualOpen] = useState(false);

  // Manual solve submit — delegates to addSolve (manual entry, no moves,
  // no analysis). The sheet handles its own scramble generation.
  // Manual time entry (inputMode === 'manual') — inline submit handler.
  // Bypasses the timer engine completely: saves directly with no moves/analysis.
  const handleManualSubmit = useCallback(
    async (time: number, penalty: Penalty) => {
      await addSolve({
        time,
        penalty,
        scramble: scrambleDisplay ? currentScramble : "",
        method: methodPref,
        source: "manual",
        puzzleType: puzzleCategoryToType(puzzle),
      });
      toast.success(`Logged: ${(time / 1000).toFixed(2)}s`);
      setCurrentScramble(generateScrambleFor(puzzle));
      setScrambleIndex((i) => i + 1);
    },
    [addSolve, currentScramble, methodPref, puzzle, scrambleDisplay],
  );

  const handleAddManual = useCallback(
    async (input: {
      time: number;
      scramble: string;
      method: SolveMethod;
      notes: string;
      penalty: Penalty;
    }) => {
      await addSolve({
        time: input.time,
        penalty: input.penalty,
        scramble: input.scramble,
        method: input.method,
        source: "manual",
        puzzleType: puzzleCategoryToType(puzzle),
      });
    },
    [addSolve, puzzle],
  );

  // Clicking "Analysis" on a solve row jumps to Insights AND selects that
  // specific solve via the URL param — fixing the old bug where the click
  // navigated to a *different* solve. The InsightsDashboard reads ?solve=
  // on mount and selects accordingly.
  const handleAnalyzeSolve = useCallback((solve: Solve) => {
    setActiveView("insights");
    setCubePanelOpen(false);
    // Push the selected solve to the URL so InsightsDashboard picks it up.
    const url = new URL(window.location.href);
    url.searchParams.set("solve", solve.id);
    window.history.replaceState(null, "", url.toString());
    // Force re-read of the URL by toggling a noop state (the dashboard's
    // mount effect reads ?solve=, so we only need to ensure we're on the
    // insights view — the URL is already set). A remount via key isn't
    // needed because the dashboard is conditionally rendered (mounts fresh
    // when switching from timer → insights).
  }, []);

  // "Replay" from TimesList dropdown: same as analyze — navigate to Insights
  // with the solve selected. ReplaySection is auto-expanded there.
  const handleReplaySolve = useCallback((solve: Solve) => {
    handleAnalyzeSolve(solve);
  }, [handleAnalyzeSolve]);

  // ── Main stage composition by active view ──────────────────────────────
  // Timer & Cube 3D share the live stage (scramble + timer + compact stats);
  // selecting Cube 3D additionally splits the stage with the 3D aside.
  // Insights takes over the stage fully (sidebar of solves + overview /
  // per-solve analysis) and owns its own scroll per panel.
  // Practice takes over the stage fully (method tree + algorithm grid +
  // detail panel).
  const renderMain = () => {
    if (activeView === "insights") {
      return (
        <InsightsDashboard
          key={session?.id ?? "none"}
          solves={solves}
          sessions={sessions}
          fetchSessionSolves={fetchSessionSolves}
          activeSessionId={session?.id ?? null}
          pb={currentPB ?? undefined}
          pendingAnalysis={lastAnalysis}
          sessionId={session?.id ?? null}
          onUpdateSolve={handleUpdate}
          onDeleteSolve={handleDelete}
        />
      );
    }

    if (activeView === "practice") {
      return (
        <PracticeDashboard
          onPracticeCase={(subsetId, caseId) => {
            setTrainingPreset({ subsetId, caseId });
            setActiveView("training");
          }}
        />
      );
    }

    if (activeView === "training") {
      return (
        <TrainingDashboard
          preset={trainingPreset}
          onPresetConsumed={() => setTrainingPreset(null)}
          puzzle={puzzle}
          onPuzzleChange={handlePuzzleChange}
        />
      );
    }

    if (activeView === "skill-tree") {
      return <UltraSkillTreeView onNavigate={(view) => setActiveView(view as ViewId)} />;
    }

    // timer
    return (
      <>
        <AnimatePresence mode="wait">
          {scrambleDisplay && (scrambleVerification || !isFocused) ? (
            <motion.div
              key="scramble-display-container"
              initial={{ y: "-100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "-100%", opacity: 0 }}
              transition={SIDEBAR_MOTION.panel}
              className="w-full"
            >
              <ScrambleDisplay
                scramble={currentScramble}
                displayScramble={displayScramble}
                states={isManualMode ? undefined : validation.states}
                currentIndex={isManualMode ? 0 : validation.currentIndex}
                errorMoves={isManualMode ? [] : validation.displayErrorMoves}
                pendingHalfDouble={isManualMode ? false : validation.pendingHalfDouble}
                isScrambled={isManualMode ? false : validation.isScrambled}
                needsReset={isManualMode ? false : validation.needsReset}
                awaitingSolve={isManualMode ? false : validation.awaitingSolve}
                onRegenerate={handleRegenerate}
                onCopy={handleCopy}
                indexLabel={`#${scrambleIndex + 1}`}
                focusModeAction={
                  isManualMode && focusMode ? (
                    <button
                      type="button"
                      onClick={() => setManualFocus(!manualFocus)}
                      className={cn(
                        "inline-flex h-7 items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-all duration-200 outline-none cursor-pointer",
                        manualFocus
                          ? "border border-ink/20 bg-surface-2 text-ink font-semibold shadow-xs"
                          : "border border-line/40 bg-surface/50 text-ink-2 hover:border-line hover:bg-surface-2 hover:text-ink",
                      )}
                      title={manualFocus ? "Disable Focus Mode" : "Enable Focus Mode"}
                    >
                      <Eye className="size-3.5" />
                      Focus
                    </button>
                  ) : undefined
                }
              />
            </motion.div>
          ) : isManualMode && focusMode ? (
            <motion.div
              key="manual-focus-button"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={SIDEBAR_MOTION.panel}
              className="flex w-full justify-end mb-2"
            >
              <button
                type="button"
                onClick={() => setManualFocus(!manualFocus)}
                className={cn(
                  "inline-flex h-7 items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-all duration-200 outline-none cursor-pointer",
                  manualFocus
                    ? "border border-ink/20 bg-surface-2 text-ink font-semibold shadow-xs"
                    : "border border-line/40 bg-surface/50 text-ink-2 hover:border-line hover:bg-surface-2 hover:text-ink",
                )}
                title={manualFocus ? "Disable Focus Mode" : "Enable Focus Mode"}
              >
                <Eye className="size-3.5" />
                Focus
              </button>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {isManualMode ? (
          <ManualTimeInput
            onSubmit={handleManualSubmit}
            className="mt-1 flex-1"
          />
        ) : (
          <TimerContainer
            phase={timerPhase}
            time={timerTime}
            lastTime={timerLastTime}
            pb={previousPB}
            showPbDelta={showPbDelta}
            pbMilestone={activePbMilestone}
            onDismissPbBanner={handleDismissPbBanner}
            hintCtx={{
              smartCube: smartCubeConnected,
              scrambleVerif: scrambleDisplay && scrambleVerification,
              inspection,
              isScrambled: validation.isScrambled,
              isLastSolveDnf: timerLastTime !== null && solves[0]?.penalty === "DNF",
              lastSolvePenalty: timerLastTime !== null ? solves[0]?.penalty : "none",
            }}
            onPress={timerPress}
            onRelease={timerRelease}
            onCancel={handleTimerCancel}
            stateRef={timerStateRef}
            cancelRef={cancelRef}
            clickToStart={clickToStart}
            holdDelay={spacebarHoldDelay}
            lastSolve={solves[0] ?? null}
            onUpdatePenalty={(id, pen) => updateSolve(id, { penalty: pen })}
            className="mt-1 flex-1"
          />
        )}

        {!isFocused && (
          <SessionStats
            solves={solves}
            onExpand={() => setActiveView("insights")}
            puzzleFilter={puzzleCategoryToType(puzzle)}
          />
        )}
      </>
    );
  };

  return (
    <div className="antialiased bg-background text-foreground h-dvh w-full overflow-hidden">
      <ThemeProvider>
        <MainLayout
          sessionCount={solves.length}
          sessions={sessions}
          activeSessionId={session?.id ?? null}
          hideHeader={activeView === "skill-tree"}
          onSwitchSession={handleSwitchSession}
          onNewSession={handleNewSession}
          onRenameSession={renameSession}
          onDeleteSession={deleteSession}
          puzzle={puzzle}
          onPuzzleChange={handlePuzzleChange}
          cube3DActive={cubePanelOpen}
          cube3DReady={cube3DReady}
          cube3D={<Cube3DPanel onClose={handleCloseCube} order={puzzleCategoryToOrder(puzzle)} scramble={currentScramble} />}
          leftSidebar={
            <LeftSidebar
              activeView={activeView}
              onNavigate={handleNavigate}
              timerActive={timerRunning}
              mobileOpen={mobileNavOpen}
              onMobileOpenChange={setMobileNavOpen}
              solves={solves}
              sessionName={session?.name}
              onImportSolves={handleImportSolves}
            />
          }
          isFocused={isFocused}
          onAddManual={() => setManualOpen(true)}
          main={renderMain()}
        />

        {/* Bottom tab bar — touch regime only (mobile + tablet <1024px).
            `lg:hidden` keeps the desktop rail layout pixel-identical. The
            "More" button opens the same navigation sheet that the old
            hamburger used to (LeftSidebar renders its Sheet variant on
            touch). Hidden in focus mode, like the rest of the chrome. */}
        {!isFocused && (
          <MobileTabBar
            activeView={activeView}
            onNavigate={handleNavigate}
            onOpenMore={() => setMobileNavOpen(true)}
          />
        )}

        {/* Manual solve sheet — mounted at App level (opened from the
            Header "+" button). A manual entry is a session action, not an
            analysis action, so it lives here rather than inside the
            Insights dashboard. */}
        <ManualSolveSheet
          open={manualOpen}
          onClose={() => setManualOpen(false)}
          defaultMethod={methodPref}
          onSubmit={handleAddManual}
        />
        {/* WidgetHost renders all active floating widgets (Solve Log,
            Scramble Visualizer, Time Distribution, PB Progression, Solve
            Timeline, Metronome, Notes, etc.) driven by the Widget Store.
            The 3D cube button is rendered separately below as a circular
            floating button (not through WidgetHost/dock system). */}
        {activeView === "timer" && !isFocused && (
          <WidgetHost
            solves={solves}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onClear={handleClear}
            onAnalyze={handleAnalyzeSolve}
            onReplay={handleReplaySolve}
            scramble={currentScramble}
            smartCubeConnected={smartCubeConnected}
            cubePanelOpen={cubePanelOpen}
            onOpenCube={handleOpenCube}
            lastAnalysis={lastAnalysis}
            puzzle={puzzle}
          />
        )}

        {/* 3D Cube launcher — circular floating button, always present when
            cube panel is closed and widget is toggled on. Independent from
            the dock system but toggleable in the Widget Explorer. */}
        {activeView === "timer" && !isFocused && (
          <CubeButtonGate
            cubePanelOpen={cubePanelOpen}
            smartCubeConnected={smartCubeConnected}
            onOpenCube={handleOpenCube}
          />
        )}

        <Toaster
          // On touch, toasts float at the top so they never collide with the
          // fixed bottom tab bar (or the mobile Times bottom sheet). Desktop
          // keeps the bottom-center position unchanged.
          position={isTouch ? "top-center" : "bottom-center"}
          richColors={false}
        />
      </ThemeProvider>
    </div>
  );
}

// ── Cube button gate ────────────────────────────────────────────────────

/**
 * Reads the cube-button's status from the widget store.
 * Only renders the FloatingCubeButton if the user has it toggled ON
 * in the Widget Explorer (status !== "inactive").
 */
function CubeButtonGate({
  cubePanelOpen,
  smartCubeConnected,
  onOpenCube,
}: {
  cubePanelOpen: boolean;
  smartCubeConnected: boolean;
  onOpenCube: () => void;
}) {
  const status = useWidgetStore((s) => s.instances["cube-button"]?.status);

  // Self-healing: force status back to safe values if corrupted (e.g.
  // old localStorage migration set it to "floating").
  useEffect(() => {
    if (status === "floating" || status === "minimized") {
      widgetStore.getState().setStatus("cube-button", "docked");
    }
  }, [status]);

  if (status === "inactive") return null;

  return (
    <FloatingCubeButton
      onClick={onOpenCube}
      cubePanelOpen={cubePanelOpen}
      smartCubeConnected={smartCubeConnected}
    />
  );
}
