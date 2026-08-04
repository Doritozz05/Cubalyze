import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import { toast } from "sonner";
import { AppShell } from "@/components/Layout/AppShell";
import { usePersistentSession } from "@/hooks/usePersistentSession";
import { useSolveSession } from "@/hooks/useSolveSession";
import { useSolveCompletion } from "@/hooks/useSolveCompletion";
import { useOnboardingTour } from "@/hooks/useOnboardingTour";
import { useProfile } from "@/hooks/useProfile";
import { useOrientation } from "@/hooks/useOrientation";
import { useScrambleState } from "@/hooks/useScrambleState";
import { useSessionActions } from "@/hooks/useSessionActions";
import { useManualSolves } from "@/hooks/useManualSolves";
import { useTimerFocus } from "@/hooks/useTimerFocus";
import { useGlobalShortcuts } from "@/hooks/useGlobalShortcuts";
import { copyTextWithFallback } from "@/utils/clipboard";
import { preloadSolvers } from "@/utils/puzzleUtils";
import { preferencesStore } from "@cubeforge/state";
import { registerAllWidgets } from "@/widgets/registerAllWidgets";
import { migrateWidgetPositions } from "@/widgets/migration";
import { installWidgetDebug } from "@/widgets/debug";
import { connectWidgetLifecycle } from "@/widgets/sdk";
import type { ViewId } from "@/components/Layout/sidebar.constants";
import type { Solve } from "@/types";
import type { PbMilestoneResult } from "@/utils/pbDetection";
import "@/index.css";

// Module-level registration — must happen before first render so WidgetHost
// can resolve components from WidgetRegistry immediately.
registerAllWidgets();

export default function App() {
  // Anonymous local identity (docs/plan_profile F0): `userId` is the stable
  // seed for the CubeMark identicon shown in the header chip and Profile view.
  const { userId: profileSeed, profile, loading: profileLoading } = useProfile();

  const {
    session,
    sessions,
    solves,
    loading: sessionLoading,
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

  const { puzzle, scrambleIndex, currentScramble, handlePuzzleChange, handleRegenerate, resetScramble } =
    useScrambleState();

  // Single source of truth for what the main stage shows.
  const [activeView, setActiveView] = useState<ViewId>("timer");

  // Refs to avoid stale closures in lifecycle callbacks.
  const solvesRef = useRef(solves);
  solvesRef.current = solves;

  // Deferred solver preload (WASM/table warmup) so first paint is never blocked.
  useEffect(() => {
    preloadSolvers();
  }, []);

  // ── First-load onboarding tour (TDD-0020) ─────────────────────────────
  // (AppShell closes its own overlays when the tour activates.)
  const tour = useOnboardingTour({
    profileLoading,
    sessionLoading,
    sessions,
    profile,
  });
  const tourActive = tour.tourActive;

  const methodPref = useStore(preferencesStore, (s) => s.method);

  // ── Widget lifecycle connection ────────────────────────────────────────
  useEffect(() => {
    migrateWidgetPositions();
    installWidgetDebug();
    const disconnect = connectWidgetLifecycle(() => ({
      solves: solvesRef.current,
      method: preferencesStore.getState().method,
      theme: "system" as const,
      onNavigate: (view) => setActiveView(view),
    }));
    return disconnect;
  }, []);

  // Tracks the live Smart Cube connection state so `handleComplete` (which
  // must be defined *before* `useSolveSession` provides the value) can read
  // it without a temporal-dead-zone dependency.
  const smartCubeConnectedRef = useRef(false);

  // Disable the practice timer's global space handler while a view owns the
  // keyboard (training views + onboarding tour must never arm the timer).
  const keyboardDisabledRef = useRef(false);
  useEffect(() => {
    keyboardDisabledRef.current = activeView === "training" || tourActive;
  }, [activeView, tourActive]);

  // ── PB Celebration banner state ────────────────────────────────────────
  const [activePbMilestone, setActivePbMilestone] = useState<PbMilestoneResult | null>(null);
  const handleDismissPbBanner = useCallback(() => setActivePbMilestone(null), []);

  // Stable callback so handleComplete's identity does not change on every
  // render (avoids re-binding the solve-session listeners constantly).
  const handleNextScramble = useCallback(() => resetScramble(), [resetScramble]);

  // ── End-of-solve pipeline (PB milestones + save + analysis) ────────────
  const { handleComplete, lastAnalysis } = useSolveCompletion({
    addSolve,
    updateSolve,
    currentScramble,
    puzzle,
    solvesRef,
    smartCubeConnectedRef,
    onPbMilestone: setActivePbMilestone,
    onNextScramble: handleNextScramble,
  });

  // ── Centralised solve-session orchestration ────────────────────────────
  const session$ = useSolveSession(currentScramble, {
    onSolve: handleComplete,
    keyboardDisabledRef,
  });

  // Stable member functions (memoized inside useSolveSession) — destructured
  // so downstream callbacks keep exhaustive-deps happy without rebinding.
  const { cancel: cancelTimer, reset: resetTimer } = session$;

  // Sync the connection ref so handleComplete can read it at solve-stop time.
  useEffect(() => {
    smartCubeConnectedRef.current = session$.smartCubeConnected;
  }, [session$.smartCubeConnected]);

  // Reset PB celebration banner when starting a new solve / leaving the timer.
  useEffect(() => {
    if (session$.phase !== "idle" && session$.phase !== "stopped") {
      setActivePbMilestone(null);
    }
  }, [session$.phase]);
  useEffect(() => {
    if (activeView !== "timer") setActivePbMilestone(null);
  }, [activeView]);

  // ── Session-level actions (update/delete/clear/new/switch/import/export) ─
  const {
    handleUpdate,
    handleDelete,
    handleClear,
    handleNewSession,
    handleSwitchSession,
    handleImportSolves,
    handleExportAllJSON,
  } = useSessionActions({
    updateSolve,
    deleteSolve,
    clearSession,
    importSolves,
    newSession,
    switchSession,
    sessions,
    fetchSessionSolves,
    puzzle,
    resetScramble,
  });

  // ── Manual solve entry (inline manual mode + header "+" sheet) ─────────
  const { handleManualSubmit, handleAddManual } = useManualSolves({
    addSolve,
    currentScramble,
    puzzle,
    resetScramble,
  });

  // ── Focus mode (chrome collapses while solving) ────────────────────────
  const { isFocused, manualFocus, toggleManualFocus } = useTimerFocus({
    timerPhase: session$.phase,
    smartCubeConnected: session$.smartCubeConnected,
  });

  // Refs so global shortcuts can read/act on the timer without re-rendering.
  const timerStateRef = useRef(session$.phase);
  timerStateRef.current = session$.phase;
  const cancelRef = useRef<(() => void) | null>(null);

  const handleTimerCancel = useCallback(() => cancelTimer(), [cancelTimer]);

  const handleCopy = useCallback(async () => {
    const ok = await copyTextWithFallback(currentScramble);
    if (ok) toast.success("Scramble copied");
    else toast.error("Couldn't copy scramble");
  }, [currentScramble]);

  useGlobalShortcuts({
    onNewScramble: handleRegenerate,
    onCopyScramble: handleCopy,
    onCancel: handleTimerCancel,
    timerStateRef,
    // The tour owns the keyboard while active (ESC skips, Space is swallowed).
    enabled: !tourActive,
    solveCount: solves.length,
  });

  // ── Stage navigation (driven by the LeftSidebar rail) ──────────────────
  const scrollToTimer = useCallback(() => {
    document.getElementById("timer-section")?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const handleNavigate = useCallback(
    (view: ViewId) => {
      setActiveView(view);
      if (view === "timer") scrollToTimer();
    },
    [scrollToTimer],
  );

  // "Analysis" / "Replay" on a solve row: jump to Insights and select that
  // exact solve via the URL param.
  const handleAnalyzeSolve = useCallback((solve: Solve) => {
    setActiveView("insights");
    const url = new URL(window.location.href);
    url.searchParams.set("solve", solve.id);
    window.history.replaceState(null, "", url.toString());
  }, []);

  const handleReplaySolve = useCallback((solve: Solve) => {
    handleAnalyzeSolve(solve);
  }, [handleAnalyzeSolve]);

  const { remapScramble } = useOrientation();
  const displayScramble = remapScramble(currentScramble);

  // Penalty update from the timer row: persist + reset the timer engine.
  const handleUpdatePenalty = useCallback(
    (id: string, penalty: Solve["penalty"]) => {
      updateSolve(id, { penalty }).catch(() => toast.error("Update failed"));
      resetTimer();
    },
    [updateSolve, resetTimer],
  );

  return (
    <AppShell
      solves={solves}
      sessions={sessions}
      activeSessionId={session?.id ?? null}
      sessionName={session?.name}
      activeView={activeView}
      profileSeed={profileSeed}
      profile={profile}
      puzzle={puzzle}
      currentScramble={currentScramble}
      displayScramble={displayScramble}
      scrambleIndex={scrambleIndex}
      onPuzzleChange={handlePuzzleChange}
      onRegenerate={handleRegenerate}
      onCopy={handleCopy}
      onSwitchSession={handleSwitchSession}
      onNewSession={handleNewSession}
      onRenameSession={renameSession}
      onDeleteSession={deleteSession}
      onImportSolves={handleImportSolves}
      onExportAllJSON={handleExportAllJSON}
      onNavigate={handleNavigate}
      onOpenProfile={() => handleNavigate("profile")}
      isFocused={isFocused}
      session$={session$}
      timerStateRef={timerStateRef}
      cancelRef={cancelRef}
      manualFocus={manualFocus}
      onManualFocusToggle={toggleManualFocus}
      activePbMilestone={activePbMilestone}
      onDismissPbBanner={handleDismissPbBanner}
      fetchSessionSolves={fetchSessionSolves}
      onUpdateSolve={handleUpdate}
      onDeleteSolve={handleDelete}
      onClear={handleClear}
      onAnalyze={handleAnalyzeSolve}
      onReplay={handleReplaySolve}
      onUpdatePenalty={handleUpdatePenalty}
      onManualSubmit={handleManualSubmit}
      defaultMethod={methodPref}
      onManualSubmitSheet={handleAddManual}
      lastAnalysis={lastAnalysis}
      tourActive={tourActive}
      tourStep={tour.tourStep}
      onTourNext={tour.tourNext}
      onTourBack={tour.tourBack}
      onTourSkip={tour.tourSkip}
    />
  );
}
