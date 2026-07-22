import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import { MainLayout } from "@/components/Layout/MainLayout";
import { LeftSidebar } from "@/components/Layout/LeftSidebar";
import { ScrambleDisplay } from "@/components/Scramble/ScrambleDisplay";
import { TimerContainer } from "@/components/Timer/TimerContainer";
import { SessionStats } from "@/components/Stats/SessionStats";
import { InsightsDashboard } from "@/components/Insights/InsightsDashboard";
import { PracticeDashboard } from "@/views/Practice/PracticeDashboard";
import { ManualSolveSheet } from "@/components/Stats/ManualSolveSheet";
import { Cube3DPanel } from "@/components/Cube3D/Cube3DPanel";
import { WidgetHost } from "@/widgets/explorer";
import { toast, Toaster } from "sonner";
import { useShortcuts } from "@/hooks/useShortcuts";
import { usePersistentSession } from "@/hooks/usePersistentSession";
import { useSolveSession, runAnalysis } from "@/hooks/useSolveSession";
import { useOrientation } from "@/hooks/useOrientation";
import { preferencesStore } from "@cubeforge/state";
import { RandomStateGenerator, Min2PhaseSolver } from "@cubeforge/solver-engine";
import { ThemeProvider } from "@/components/theme-provider";
import { v4 as uuidv4 } from "uuid";
import type { Penalty, Solve, SolveMethod, SolveSource } from "@/types";
import { normalizePenalty, effectiveTime } from "@/types";
import type { CubeMoveEvent, CubeOrientation, OrientationTimeline, SolveMetrics } from "@cubeforge/types";
import type { ViewId } from "@/components/Layout/sidebar.constants";
import { migrateWidgetPositions } from "@/widgets/migration";
import { registerAllWidgets } from "@/widgets/registerAllWidgets";
import { connectWidgetLifecycle } from "@/widgets/sdk";

// Module-level registration — must happen before first render so WidgetHost
// can resolve components from WidgetRegistry immediately.
registerAllWidgets();
import "@/index.css";

export default function App() {
  const {
    session,
    sessions,
    solves,
    addSolve,
    updateSolve,
    deleteSolve,
    clearSession,
    newSession,
    switchSession,
    renameSession,
    deleteSession,
  } = usePersistentSession();

  const methodPref = useStore(preferencesStore, (s) => s.method);
  const focusMode = useStore(preferencesStore, (s) => s.focusMode);
  const showPbDelta = useStore(preferencesStore, (s) => s.showPbDelta);

  // ── Refs to avoid stale closures in the lifecycle callback ────────────
  const solvesRef = useRef(solves);
  solvesRef.current = solves;
  const methodRef = useRef(methodPref);
  methodRef.current = methodPref;

  const [scrambleIndex, setScrambleIndex] = useState(0);
  // Single source of truth for what the main stage shows. Replaces the old
  // cube3DActive + sidebarActive pair.
  const [activeView, setActiveView] = useState<ViewId>("timer");
  const [cubePanelOpen, setCubePanelOpen] = useState(false);
  const [cube3DReady, setCube3DReady] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [currentScramble, setCurrentScramble] = useState(() =>
    RandomStateGenerator.generateScramble(new Min2PhaseSolver()),
  );

  // ── Widget lifecycle connection (avoids stale closure via refs) ────────
  useEffect(() => {
    migrateWidgetPositions();
    const disconnect = connectWidgetLifecycle(() => ({
      solves: solvesRef.current,
      method: methodRef.current,
      theme: "system" as const,
      onNavigate: (view) => setActiveView(view),
    }));
    return disconnect;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Last solve analysis (displayed in the "Analysis" view) ─────────────
  const lastSolveRef = useRef<{
    solve: ReturnType<typeof usePersistentSession>['solves'][number] | null;
    analysis: SolveMetrics | null;
  }>({ solve: null, analysis: null });
  const [lastAnalysis, setLastAnalysis] = useState<SolveMetrics | null>(null);
  // Track the DB solve ID for the current solve so we can persist analysis later
  const pendingSolveIdRef = useRef<string | null>(null);

  // Tracks the live Smart Cube connection state so `handleComplete` (which
  // must be defined *before* `useSolveSession` provides `smartCubeConnected`)
  // can read the current connection status without a temporal-dead-zone
  // dependency. Synced via the effect below.
  const smartCubeConnectedRef = useRef(false);

  // Capture scramble & method at solve stop time to avoid stale closure race.
  // These refs are populated by handleComplete (synchronous callback from
  // engine.stop$) BEFORE setCurrentScramble regenerates. The analysis effect
  // reads these refs instead of the React state to guarantee it uses the
  // correct scramble — not the newly generated one.
  const scrambleAtSolveRef = useRef<string>("");
  const methodAtSolveRef = useRef<SolveMethod>("CFOP");

  const handleRegenerate = useCallback(() => {
    setCurrentScramble(RandomStateGenerator.generateScramble(new Min2PhaseSolver()));
    setScrambleIndex((i) => i + 1);
    toast.success("New scramble");
  }, []);

  const handleComplete = useCallback(
    (
      time: number,
      penalty: Penalty,
      rawMoves: CubeMoveEvent[],
      _rawOrientations: (CubeOrientation | undefined)[],
      rawOrientationTimeline: OrientationTimeline | undefined,
    ) => {
      // Capture scramble & method in refs BEFORE regenerating.
      // The analysis useEffect reads these refs (not the React state) to
      // avoid the race where setCurrentScramble(newScramble) has already
      // fired by the time the effect executes.
      scrambleAtSolveRef.current = currentScramble;
      methodAtSolveRef.current = methodPref;

      // `smartCubeConnectedRef.current` reflects the live connection state at
      // solve-stop time (synced by the effect below). We use a ref instead of
      // the `smartCubeConnected` variable directly because `handleComplete` is
      // declared before `useSolveSession` provides it (it's passed as `onSolve`).
      const capturedSource: SolveSource = smartCubeConnectedRef.current ? "smart" : "manual";

      // Generate the solve ID synchronously BEFORE calling addSolve so that
      // pendingSolveIdRef is already set when the analysis useEffect fires
      // (triggered by setLastTime in the stop$ subscription). Without this,
      // the effect reads null because addSolve's .then() hasn't resolved yet.
      const solveId = uuidv4();
      pendingSolveIdRef.current = solveId;

      // Save with raw moves immediately so replay/timeline have data
      // from the first render. The analysis effect will overwrite with
      // compacted moves + computed metrics.
      addSolve({
        id: solveId,
        time,
        scramble: currentScramble,
        penalty,
        method: methodPref,
        source: capturedSource,
        moves: rawMoves,
        orientationTimeline: rawOrientationTimeline,
      })
        .then((returnedId) => {
          if (!returnedId) {
            console.warn('[handleComplete] addSolve returned null — solve NOT saved to DB!');
            toast.error('Solve not saved — database not ready. Try again.');
            pendingSolveIdRef.current = null;
            return;
          }
          setCurrentScramble(RandomStateGenerator.generateScramble(new Min2PhaseSolver()));
          setScrambleIndex((i) => i + 1);
        })
        .catch((err) => {
          console.error('[handleComplete] addSolve threw:', err);
          toast.error("Couldn't save solve — check console for details");
        });
    },
    [addSolve, currentScramble, methodPref],
  );

  // ── Centralised orchestration ───────────────────────────────────────────
  const session$ = useSolveSession(currentScramble, { onSolve: handleComplete });
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
    lastSolveMoves,
    lastSolveOrientations,
    lastSolveOrientationTimeline,
  } = session$;

  // Sync the connection ref so handleComplete (declared above, before session$
  // was available) can read the current Smart Cube connection state.
  useEffect(() => {
    smartCubeConnectedRef.current = smartCubeConnected;
  }, [smartCubeConnected]);

  // ── Run analysis on solve complete ─────────────────────────────────────
  const prevLastTimeRef = useRef<number | null>(null);

  useEffect(() => {
    // Detect new solve completion (lastTime changed from something to a new value)
    if (timerLastTime !== null && timerLastTime !== prevLastTimeRef.current) {
      prevLastTimeRef.current = timerLastTime;

      // Use the stable snapshot captured at stop time (avoids race with IDLE clearing).
      // scrambleAtSolveRef / methodAtSolveRef were set by handleComplete which
      // runs synchronously from engine.stop$ BEFORE setCurrentScramble fires.
      const moves = lastSolveMoves;
      const scr = scrambleAtSolveRef.current;
      const m = methodAtSolveRef.current;

      if (moves.length > 0) {
        const pendingId = pendingSolveIdRef.current;
        console.log(
          '%c[App] Analysis queued · %d moves · solveId=%s',
          'color:#38bdf8',
          moves.length,
          pendingId ? pendingId.slice(0, 8) : 'null (waiting for addSolve)',
        );
        // Defer to next tick to avoid blocking the UI
        setTimeout(() => {
          runAnalysis(moves, scr, m, lastSolveOrientations).then((result) => {
            if (result) {
              const { metrics: analysis, compactedMoves, compactedOrientationTimeline } = result;
              lastSolveRef.current = { solve: null, analysis };
              setLastAnalysis(analysis);

              // Persist COMPACTED moves + analysis to DB.
              // This guarantees solve.moves.length === analysis.totalMoves
              // for all downstream consumers (replay, timeline, widgets).
              const solveId = pendingSolveIdRef.current;
              if (solveId) {
                console.log(
                  '%c[App] Persisting moves+analysis to solve %s · %d raw → %d compacted',
                  'color:#38bdf8',
                  solveId.slice(0, 8),
                  moves.length,
                  compactedMoves.length,
                );
                updateSolve(solveId, {
                  moves: compactedMoves,
                  orientationTimeline: compactedOrientationTimeline,
                  analysis,
                }).catch(() =>
                  console.warn("Failed to persist moves + analysis"),
                );
                pendingSolveIdRef.current = null;
              } else {
                console.warn(
                  '%c[App] solveId is null — moves+analysis NOT persisted. addSolve may have failed or not completed yet.',
                  'color:#facc15',
                );
              }
            }
          });
        }, 0);
      }
    }

    // Reset when going back to idle
    if (timerPhase === "idle") {
      prevLastTimeRef.current = null;
    }
  }, [timerLastTime, timerPhase, lastSolveMoves, lastSolveOrientations, lastSolveOrientationTimeline, updateSolve]);

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
    newSession()
      .then(() => {
        setCurrentScramble(RandomStateGenerator.generateScramble(new Min2PhaseSolver()));
        setScrambleIndex(0);
        toast.success("New session started");
      })
      .catch(() => toast.error("Couldn't create session"));
  }, [newSession]);

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

  const validSolves = solves.filter((s) => normalizePenalty(s.penalty) !== "DNF");
  const currentPB =
    validSolves.length > 0
      ? Math.min(
          ...validSolves.map((s) => effectiveTime(s)),
        )
      : null;

  // Previous PB (excluding the most recent solve) for accurate PB delta comparison
  const previousSolves = solves.slice(1).filter((s) => normalizePenalty(s.penalty) !== "DNF");
  const previousPB =
    previousSolves.length > 0
      ? Math.min(
          ...previousSolves.map((s) => effectiveTime(s)),
        )
      : null;

  const timerStateRefValue = timerStateRef.current;
  const timerRunning =
    timerStateRefValue === "running" || timerStateRefValue === "ready";

  const isFocused =
    focusMode &&
    (timerPhase === "running" ||
      timerPhase === "inspection" ||
      timerPhase === "holding" ||
      timerPhase === "ready_for_move" ||
      (timerPhase === "ready" && !smartCubeConnected));

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
      });
    },
    [addSolve],
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
          pb={currentPB ?? undefined}
          pendingAnalysis={lastAnalysis}
          sessionId={session?.id ?? null}
          onUpdateSolve={handleUpdate}
          onDeleteSolve={handleDelete}
        />
      );
    }

    if (activeView === "practice") {
      return <PracticeDashboard />;
    }

    // timer
    return (
      <>
        {scrambleVerification && !isFocused && (
          <ScrambleDisplay
            scramble={currentScramble}
            displayScramble={displayScramble}
            states={validation.states}
            currentIndex={validation.currentIndex}
            errorMoves={validation.displayErrorMoves}
            pendingHalfDouble={validation.pendingHalfDouble}
            isScrambled={validation.isScrambled}
            needsReset={validation.needsReset}
            awaitingSolve={validation.awaitingSolve}
            onRegenerate={handleRegenerate}
            onCopy={handleCopy}
            indexLabel={`#${scrambleIndex + 1}`}
          />
        )}

        <TimerContainer
          phase={timerPhase}
          time={timerTime}
          lastTime={timerLastTime}
          pb={previousPB}
          showPbDelta={showPbDelta}
          hintCtx={{
            smartCube: smartCubeConnected,
            scrambleVerif: scrambleVerification,
            inspection,
            isScrambled: validation.isScrambled,
          }}
          onPress={timerPress}
          onRelease={timerRelease}
          onCancel={handleTimerCancel}
          stateRef={timerStateRef}
          cancelRef={cancelRef}
          className="mt-1 flex-1"
        />

        {!isFocused && (
          <SessionStats
            solves={solves}
            onExpand={() => setActiveView("insights")}
          />
        )}
      </>
    );
  };

  return (
    <div className="antialiased bg-background text-foreground min-h-screen overflow-x-hidden">
      <ThemeProvider>
        <MainLayout
          pb={currentPB}
          sessionCount={solves.length}
          sessions={sessions}
          activeSessionId={session?.id ?? null}
          onSwitchSession={handleSwitchSession}
          onNewSession={handleNewSession}
          onRenameSession={renameSession}
          onDeleteSession={deleteSession}
          cube3DActive={cubePanelOpen}
          cube3DReady={cube3DReady}
          cube3D={<Cube3DPanel onClose={handleCloseCube} />}
          leftSidebar={
            <LeftSidebar
              activeView={activeView}
              onNavigate={handleNavigate}
              timerActive={timerRunning}
              mobileOpen={mobileNavOpen}
              onMobileOpenChange={setMobileNavOpen}
            />
          }
          isFocused={isFocused}
          onToggleMobileNav={() => setMobileNavOpen((a) => !a)}
          onAddManual={() => setManualOpen(true)}
          main={renderMain()}
        />

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
        {/* WidgetHost renders all active floating widgets (Solve Log, Scramble
            Visualizer, Time Distribution, PB Progression, Solve Timeline, 
            3D Cube button, etc.) driven by the Widget Store. Only
            rendered on the Timer stage; Stats/Analysis take over the stage. */}
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
          />
        )}

        <Toaster position="bottom-center" richColors={false} />
      </ThemeProvider>
    </div>
  );
}
