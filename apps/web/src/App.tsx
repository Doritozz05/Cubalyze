import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useStore } from "zustand";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AppShell } from "@/components/Layout/AppShell";
import { NotFoundView } from "@/components/Stage/NotFoundView";
import { AuthView } from "@/views/Auth/AuthView";
import { useAccount } from "@/hooks/useAccount";
import { refreshProfile } from "@/hooks/useProfile";
import { startSyncService } from "@/services/sync";
import { markAppDataReady } from "@/boot/appReady";
import { usePersistentSession } from "@/hooks/usePersistentSession";
import { useCollectionStore } from "@/views/Collection/collectionStore";
import { activeCubeStore } from "@/stores/activeCubeStore";
import { hardwareLinkStore } from "@/stores/hardwareLinkStore";
import { shouldIgnoreSmartCubeForSession } from "@/views/Collection/activeCube";
import { useSolveSession, reanalyzeSolve } from "@/hooks/useSolveSession";
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
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { copyTextWithFallback } from "@/utils/clipboard";
import { preloadSolvers, getEventForCategory, methodForEvent, puzzleCategoryToType } from "@/utils/puzzleUtils";
import { resolveRetryScramble } from "@/utils/retryScramble";
// Side-effect: registers the 2×2/3×3 ScrambleProviders BEFORE the first
// render, so useScrambleState's initial scramble generation finds them.
import "@/utils/scrambleProviders";
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
import { soundManager } from "@/audio/soundManager";

// Module-level registration — must happen before first render so WidgetHost
// can resolve components from WidgetRegistry immediately.
registerAllWidgets();

// Warm the shared AudioContext at the EARLIEST possible moment so the user's
// first cube turn never pays the ~1 s audio cold start ("el primer move no
// es exacto"): Chromium's first AudioContext of a page blocks ~0.5 s at
// construction and can freeze its clock ~1 s while the output device opens.
//
//   1. warmOnLoad() — pre-creates the context (deferred past first paint) so
//      the device is already open when the first gesture arrives (creation
//      needs no gesture; only playback does — measured: first resume ~30 ms).
//   2. armForUserGesture() — whatever happens first, the FIRST trusted
//      gesture anywhere (navigation, timer, settings) resumes the context;
//      if a gesture beat the idle creation, it creates it right there.
//
// Fallback: if the browser refuses the early context, ensureContext() is
// idempotent and the first-gesture path + clock gate take over unchanged.
soundManager.warmOnLoad();
soundManager.armForUserGesture();

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
  friends: "/friends",
  reconstructions: "/reconstructions",
  collection: "/collection",
  cube: "/cube",
};

function pathForView(view: ViewId): string {
  return VIEW_PATH[view];
}

function viewFromPath(pathname: string): ViewId | null {
  const segment = pathname.split("/").filter(Boolean)[0] ?? "";
  // The bare root "/" is the default landing page (timer) — it must never
  // be treated as an unknown path.
  if (!segment) return "timer";
  const match = Object.entries(VIEW_PATH).find(
    ([, path]) => path === `/${segment}`,
  );
  return (match?.[0] as ViewId | undefined) ?? null;
}

export default function App() {
  // Anonymous local identity (docs/plan_profile F0): `userId` is the stable
  // seed for the CubeMark identicon shown in the header chip and Profile view.
  // After an account link the identicon seed is parked separately, so the
  // mark never changes (D2).
  const {
    userId: profileSeed,
    identiconSeed,
    profile,
    loading: profileLoading,
  } = useProfile();

  // Supabase auth + claim flow (module singleton). Safe to mount always:
  // with no env vars configured it resolves to "unconfigured" and stays inert.
  const account = useAccount();

  // Background sync: dirty-flag poller + online/visibility listeners.
  useEffect(() => {
    startSyncService();
  }, []);

  // The Locker is no longer a view-only concern: the dock's cube piece and the
  // per-solve attribution read it, whether or not the user ever opens the view.
  // Both reads are tiny (three SELECTs, one key/value scan) and idempotent —
  // the Locker's own `hydrate()` then finds them already done.
  useEffect(() => {
    void useCollectionStore.getState().hydrate();
    void activeCubeStore.getState().hydrate();
  }, []);

  // After the claim remaps the identity to the account, re-read the profile
  // row + seed so the UI follows the new identity immediately.
  useEffect(() => {
    if (account.linked) void refreshProfile();
  }, [account.linked]);

  const {
    session,
    sessions,
    solves,
    loading: sessionLoading,
    addSolve,
    updateSolve,
    deleteSolve,
    moveSolveToSession,
    assignCubeToSolves,
    clearSession,
    importSolves,
    newSession,
    switchSession,
    renameSession,
    deleteSession,
    fetchSessionSolves,
  } = usePersistentSession();

  // Keep the pre-React boot loader up until the DB/session data has hydrated
  // (idempotent): the session dock piece, solve counts and the times widget
  // all depend on sessions/solves, so fading early made them pop in a moment
  // after the loader disappeared. Fired from sessionLoading only — switchSession
  // re-toggles loading later, but the promise is already resolved by then.
  useEffect(() => {
    if (!sessionLoading) markAppDataReady();
  }, [sessionLoading]);

  const {
    puzzle,
    scrambleIndex,
    currentScramble,
    handlePuzzleChange,
    applyScramble,
    handleRegenerate,
    resetScramble,
  } = useScrambleState();

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

  // Disable the practice timer's global space handler on every view except
  // the timer itself. Using an allowlist ("only timer") instead of a denylist
  // makes this future-proof: any new view is automatically blocked.
  const keyboardDisabledRef = useRef(false);
  useEffect(() => {
    keyboardDisabledRef.current = activeView !== "timer" || notFound || tourActive;
  }, [notFound, activeView, tourActive]);

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
  // "3×3 as 2×2" mode: only when the 2×2 puzzle is active and the user opted
  // in via Settings → Smart Cube. The scramble is untouched (2×2 scrambles
  // already generate for puzzle 2×2); 3×3 behaves exactly as before.
  const use3x3As2x2 = useStore(preferencesStore, (s) => s.use3x3As2x2);
  // ── Session/hardware gate ───────────────────────────────────────────────
  // What the CONNECTED cube is, straight from the hardware link (the Locker
  // item the address resolves to) — never from vendor/model strings, which
  // cannot tell a linked 2×2 from a linked 3×3 reliably. `connected` comes from
  // the store's status (idle = nothing plugged in), so a cube the Locker could
  // NOT resolve (unlinked, no identity, conflict, sold) still counts as
  // connected — that was the hole that let an unlinked 3×3 drive a 2×2.
  const hardwareStatus = useStore(hardwareLinkStore, (s) => s.status);
  const hardwareEvent = useStore(hardwareLinkStore, (s) =>
    s.status === "linked" ? s.event : null,
  );
  const sessionEvent = puzzleCategoryToType(puzzle);
  // The single gate rule (also unit-tested): in a 2×2 session, a connected
  // smart cube that is NOT known to be this event's hardware is foreign — and
  // therefore ignored — unless the "3×3 as 2×2" opt-in is on. That covers the
  // linked 3×3, a 3×3 filed under another event, and a connection the Locker
  // could not resolve. A 2×2 the Locker knows as 222 is never gated, and
  // nothing connected never gates.
  const smartCubeAllowed = !shouldIgnoreSmartCubeForSession(
    sessionEvent,
    { connected: hardwareStatus !== "idle", event: hardwareEvent },
    use3x3As2x2,
  );
  const session$ = useSolveSession(currentScramble, {
    onSolve: handleComplete,
    keyboardDisabledRef,
    // Phase A5: the timer consumes the active event's WCA rules profile
    // (inspection window, penalties) — not a single global 3×3 set.
    rules: getEventForCategory(puzzle)?.rules,
    // "3×3 as 2×2" means solving a 2×2 with the CORNERS of a 3×3. A cube the
    // Locker knows is a 2×2 must never enter corners-only mode, whatever the
    // opt-in says — that is the "a real 2×2 is untouched" guarantee.
    cornersOnly: sessionEvent === "222" && use3x3As2x2 && hardwareEvent !== "222",
    // Gate the whole smart-cube surface (validator, auto-arm, move/facelet
    // intake, presence) when the connected hardware cannot serve this event.
    smartCubeAllowed,
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
    handleMoveSolves,
    handleAssignCube,
    handleClear,
    handleNewSession,
    handleSwitchSession,
    handleImportSolves,
    handleExportAllJSON,
  } = useSessionActions({
    updateSolve,
    deleteSolve,
    moveSolveToSession,
    assignCubeToSolves,
    clearSession,
    importSolves,
    newSession,
    switchSession,
    sessions,
    fetchSessionSolves,
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
    solves,
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
    // scramble shortcuts. The 404 page must never arm the timer either.
    enabled: !tourActive && activeView !== "cube" && !notFound,
  });

  // ── Localized, per-view document title (e.g. "Timer — 4 solves · CubeForge").
  // Reconstructions owns its own richer title (record id + solver).
  const { t } = useTranslation("meta");
  const docTitle = useMemo(() => {
    if (notFound) return null;
    switch (activeView) {
      case "timer":
        return t("timer", { count: solves.length });
      case "insights":
        return t("insights", { count: solves.length });
      case "algorithms":
        return t("algorithms");
      case "training":
        return t("training");
      case "skill-tree":
        return t("skillTree");
      case "profile":
        return t("profile");
      case "reconstructions":
        return null; // owned by ReconstructionsView (has the record data)
      case "collection":
        return t("collection");
      case "cube":
        return t("cube");
    }
  }, [activeView, solves.length, t, notFound]);
  useDocumentTitle(docTitle);

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

  // "Retry scramble" on a solve: put that exact scramble back on the stage and
  // return to the timer. Showing the scramble the solve was actually done with
  // (instead of a fresh one) is the whole point — otherwise the retry is not
  // comparable with the original attempt. The new attempt lands in whichever
  // session is active now, and the event is switched when the solve belongs to
  // another puzzle. Events with no scramble provider cannot be replayed: that
  // is stated, not faked with a random scramble. The same resolver the solve
  // panel uses to enable the action decides what happens here.
  const handleRetryScramble = useCallback(
    (solve: Solve) => {
      const target = resolveRetryScramble(solve);
      if (!target) {
        toast.error(i18n.t("insights:analysis.retryUnavailable"));
        return;
      }
      applyScramble(target.scramble, target.category);
      handleNavigate("timer");
      toast.success(i18n.t("insights:analysis.retryReady"));
    },
    [applyScramble, handleNavigate],
  );

  // The orientation-adapted display policy — including "a 2×2 never follows the
  // cube" — lives in useOrientation; the timer only supplies the active puzzle.
  const { remapScramble } = useOrientation();
  const displayScramble = remapScramble(currentScramble, puzzle);

  // Penalty update from the timer row: persist + reset the timer engine.
  const handleUpdatePenalty = useCallback(
    (id: string, penalty: Solve["penalty"]) => {
      updateSolve(id, { penalty }).catch(() => toast.error(i18n.t("timer:updateFailed")));
      resetTimer();
    },
    [updateSolve, resetTimer],
  );

  // Re-run the analysis pipeline on a stored solve. The solve already holds
  // every input the pipeline needs (compacted moves, scramble, method, time,
  // compact orientation timeline), so re-analysis is lossless — it recomputes
  // metrics from the same canonical moves and persists them back in place.
  const handleReanalyze = useCallback(
    async (solve: Solve) => {
      const moves = solve.moves ?? [];
      if (moves.length === 0) {
        toast.error(i18n.t("insights:analysis.reanalyzeNoMoves"));
        return;
      }
      const result = await reanalyzeSolve(
        moves,
        solve.scramble ?? "",
        solve.method ?? "CFOP",
        solve.orientationTimeline,
        solve.time,
      );
      if (!result) {
        toast.error(i18n.t("insights:analysis.reanalyzeFailed"));
        return;
      }
      await updateSolve(solve.id, {
        moves: result.compactedMoves,
        orientationTimeline: result.compactedOrientationTimeline,
        analysis: result.metrics,
      });
      toast.success(i18n.t("insights:analysis.reanalyzeDone"));
    },
    [updateSolve],
  );

  // /auth is the standalone sign-in page (Google OAuth redirect target) —
  // rendered OUTSIDE the shell like the 404.
  if (location.pathname === "/auth") {
    return <AuthView />;
  }

  // Unknown paths (e.g. /settings, /foo): full standalone page — no shell,
  // no widgets, nothing but the 404 and a way back home.
  if (notFound) {
    return <NotFoundView />;
  }

  return (
    <AppShell
      solves={solves}
      sessions={sessions}
      activeSessionId={session?.id ?? null}
      sessionName={session?.name}
      activeView={activeView}
      profileSeed={identiconSeed ?? profileSeed}
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
      onOpenLocker={() => handleNavigate("collection")}
      isFocused={isFocused}
      session$={session$}
      timerStateRef={timerStateRef}
      cancelRef={cancelRef}
      manualFocus={manualFocus}
      onManualFocusToggle={toggleManualFocus}
      activePbMilestone={activePbMilestone}
      onDismissPbBanner={handleDismissPbBanner}
      onVirtualSolveComplete={handleComplete}
      fetchSessionSolves={fetchSessionSolves}
      onUpdateSolve={handleUpdate}
      onReanalyze={handleReanalyze}
      onDeleteSolve={handleDelete}
      onMoveSolves={handleMoveSolves}
      onAssignCube={handleAssignCube}
      onRetryScramble={handleRetryScramble}
      onClear={handleClear}
      onAnalyze={handleAnalyzeSolve}
      onReplay={handleReplaySolve}
      onUpdatePenalty={handleUpdatePenalty}
      onManualSubmit={handleManualSubmit}
      // The manual sheet only shows a method picker for events that declare
      // methods (3×3, 3×3 OH); on a 2×2 it stays hidden and the solve is saved
      // without one.
      defaultMethod={methodForEvent(puzzleCategoryToType(puzzle), methodPref)}
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
