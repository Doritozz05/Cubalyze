import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useStore } from "zustand";
import { toast } from "sonner";
import { AppShell } from "@/components/Layout/AppShell";
import { usePersistentSession } from "@/hooks/usePersistentSession";
import { useSolveSession } from "@/hooks/useSolveSession";
import { useSolveCompletion } from "@/hooks/useSolveCompletion";
import { useOnboardingTour } from "@/hooks/useOnboardingTour";
import { useReminderScheduler } from "@/hooks/useReminderScheduler";
import { useProfile } from "@/hooks/useProfile";
import { preloadTrainingProgress } from "@/hooks/useTrainingProgress";
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
// Initialize i18n (react-i18next singleton). Imported here — not in the
// entry points — so both the PWA (apps/web/src/main.tsx) and the Tauri
// desktop app (apps/desktop/src/main.tsx, which reuses this App) initialize
// the same instance before the first render. The default import also
// powers the toast helpers (i18n.t).
import i18n from "@/i18n";

// Module-level registration — must happen before first render so WidgetHost
// can resolve components from WidgetRegistry immediately.
registerAllWidgets();

/**
 * ViewId ↔ URL path mapping (deep-linkable routes). The pathname's first
 * segment names the view; unknown paths fall back to the timer.
 */
const VIEW_PATH: Record<ViewId, string> = {
  timer: "/timer",
  insights: "/insights",
  algorithms: "/algorithms",
  training: "/training",
  "skill-tree": "/skill-tree",
  profile: "/profile",
  reconstructions: "/reconstructions",
  cube: "/cube",
};

function pathForView(view: ViewId): string {
  return VIEW_PATH[view];
}

function viewFromPath(pathname: string): ViewId | null {
  const segment = pathname.split("/").filter(Boolean)[0] ?? "";
  const match = Object.entries(VIEW_PATH).find(
    ([, path]) => path === `/${segment}`,
  );
  return (match?.[0] as ViewId | undefined) ?? null;
}

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

  const { puzzle, scrambleIndex, currentScramble, handlePuzzleChange, handleRegenerate, resetScramble, forcePuzzle } =
    useScrambleState();

  // Single source of truth for what the main stage shows. The URL is the
  // owner: activeView is derived from the pathname (/timer, /insights,
  // /reconstructions/2510, …) and setActiveView navigates — so every view is
  // deep-linkable and survives reloads.
  const location = useLocation();
  const navigate = useNavigate();
  // Unknown paths (e.g. /settings, /foo) keep the shell alive but render a
  // proper 404 stage instead of silently showing the timer.
  const routedView = viewFromPath(location.pathname);
  const activeView = routedView ?? "timer";
  const notFound = routedView === null;
  const setActiveView = useCallback(
    (view: ViewId) => navigate(pathForView(view)),
    [navigate],
  );

  // Refs to avoid stale closures in lifecycle callbacks.
  const solvesRef = useRef(solves);
  solvesRef.current = solves;

  // Deferred solver preload (WASM/table warmup) so first paint is never blocked.
  // Also warm the shared training tracker (DB worker + migrations + catalog
  // seed) so the Profile Training/Algorithms tabs and the Training view find
  // the SRS data ready on their very first visit instead of paying the whole
  // init cost on click (which previously left those tabs on a skeleton until
  // the main Training view had been opened once).
  useEffect(() => {
    preloadSolvers();
    preloadTrainingProgress();
  }, []);

  // ── Daily practice/review reminders (Settings → Notifications) ────────
  useReminderScheduler();

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
  }, [setActiveView]);

  // Tracks the live Smart Cube connection state so `handleComplete` (which
  // must be defined *before* `useSolveSession` provides the value) can read
  // it without a temporal-dead-zone dependency.
  const smartCubeConnectedRef = useRef(false);

  // Disable the practice timer's global space handler while a view owns the
  // keyboard (training views + onboarding tour must never arm the timer).
  const keyboardDisabledRef = useRef(false);
  useEffect(() => {
    // The cube simulator owns the keyboard while open (csTimer-layout moves);
    // training views and the tour must also never arm the practice timer.
    keyboardDisabledRef.current =
      notFound || activeView === "training" || activeView === "cube" || tourActive;
  }, [notFound, activeView, tourActive]);

  // ── Cube tab is 3×3-only today: entering it forces the puzzle selector to
  //    3×3 and locks it (Header disables the Select). TODO(virtual-puzzles):
  //    lift the lock once the simulator supports 2×2/4×4/… (see
  //    useVirtualCubeSession).
  const puzzleLocked = activeView === "cube";
  useEffect(() => {
    if (puzzleLocked && puzzle !== "3x3") forcePuzzle("3x3");
  }, [puzzleLocked, puzzle, forcePuzzle]);

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
    resetTimer,
    lastSolveId: solves[0]?.id,
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
    if (ok) toast.success(i18n.t("timer:scrambleCopied"));
    else toast.error(i18n.t("timer:couldNotCopyScramble"));
  }, [currentScramble]);

  useGlobalShortcuts({
    onNewScramble: handleRegenerate,
    onCopyScramble: handleCopy,
    onCancel: handleTimerCancel,
    timerStateRef,
    // The tour owns the keyboard while active (ESC skips, Space is swallowed).
    // The cube simulator also owns the keyboard — its csTimer layout uses N (x')
    // and C (u'), which would otherwise collide with the global New/Copy
    // scramble shortcuts.
    enabled: !tourActive && activeView !== "cube",
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
    [scrollToTimer, setActiveView],
  );

  // "Analysis" / "Replay" on a solve row: jump to Insights and select that
  // exact solve via the URL param (InsightsDashboard already reads
  // ?solve= from the URL). PUSHES a history entry so the browser Back button
  // returns to the timer (the previous implementation used replace, which
  // swallowed the timer entry).
  const handleAnalyzeSolve = useCallback(
    (solve: Solve) => {
      navigate(`/insights?solve=${encodeURIComponent(solve.id)}`);
    },
    [navigate],
  );

  const handleReplaySolve = useCallback((solve: Solve) => {
    handleAnalyzeSolve(solve);
  }, [handleAnalyzeSolve]);

  const { remapScramble } = useOrientation();
  const displayScramble = remapScramble(currentScramble);

  // Penalty update from the timer row: persist + reset the timer engine.
  const handleUpdatePenalty = useCallback(
    (id: string, penalty: Solve["penalty"]) => {
      updateSolve(id, { penalty }).catch(() => toast.error(i18n.t("timer:updateFailed")));
      resetTimer();
    },
    [updateSolve, resetTimer],
  );

  return (
    <AppShell
      notFound={notFound}
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
      puzzleLocked={puzzleLocked}
      onVirtualSolveComplete={handleComplete}
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
