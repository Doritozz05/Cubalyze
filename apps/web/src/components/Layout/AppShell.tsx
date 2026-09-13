"use client";

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import { useTranslation } from "react-i18next";
import { MainLayout } from "@/components/Layout/MainLayout";
import type { ViewId } from "@/components/Layout/sidebar.constants";
import { LeftSidebar } from "@/components/Layout/LeftSidebar";
import { StageOverlays } from "@/components/Layout/StageOverlays";
import { MainStage } from "@/components/Stage/MainStage";
import { TimerStage } from "@/components/Stage/TimerStage";
// Lazy: the 3D engine (three.js, ~600 kB) only downloads the first time the
// user opens the cube view — never on initial page load.
const Cube3DPanel = lazy(() =>
  import("@/components/Cube3D/Cube3DPanel").then((m) => ({ default: m.Cube3DPanel }))
);

/** Minimal placeholder shown while the 3D chunk downloads on first open. */
function CubePanelFallback() {
  const { t } = useTranslation("shell");
  return (
    <div className="flex h-full min-h-0 w-full items-center justify-center">
      <span className="animate-pulse text-xs text-ink-3">{t("loading3dCube")}</span>
    </div>
  );
}
import { ThemeProvider } from "@/components/theme-provider";
import { ContextMenu } from "@/components/ContextMenu/ContextMenu";
import { contextMenuStore } from "@/components/ContextMenu/contextMenuStore";
import { resolveContextMenuItems } from "@/components/ContextMenu/contextMenuResolver";
import { TriangleAlert } from "lucide-react";
import { useStorageStatusStore } from "@/stores/storageStatus";
import { preferencesStore } from "@cubeforge/state";
import { useIsTouch } from "@/hooks/use-mobile";
import { WidgetExplorer } from "@/widgets/explorer";
import { puzzleCategoryToOrder, puzzleCategoryToType } from "@/utils/puzzleUtils";
import { useBackgroundMediaStore } from "@/stores/backgroundMediaStore";
import type { AppShellProps } from "@/components/Layout/appShell.types";
/**
 * The application shell (extracted from App.tsx): the fixed layout (header,
 * sidebar rail, stage) and the composition of the stage switcher with the
 * live timer stage. Owns the shell-level UI state (settings, mobile sheets,
 * widget explorer, cube connector, manual solve sheet, 3D cube panel) so
 * App stays a thin orchestrator.
 */
export function AppShell(props: AppShellProps) {
  const {
    solves,
    sessions,
    activeSessionId,
    sessionName,
    activeView,
    profileSeed,
    profile,
    puzzle,
    currentScramble,
    displayScramble,
    scrambleIndex,
    onPuzzleChange,
    onVirtualSolveComplete,
    onRegenerate,
    onCopy,
    onSwitchSession,
    onNewSession,
    onRenameSession,
    onDeleteSession,
    onImportSolves,
    onExportAllJSON,
    onNavigate,
    onOpenProfile,
    onOpenLocker,
    isFocused,
    session$,
    timerStateRef,
    cancelRef,
    manualFocus,
    onManualFocusToggle,
    activePbMilestone,
    onDismissPbBanner,
    onUpdateSolve,
    onReanalyze,
    onDeleteSolve,
    onMoveSolves,
    onAssignCube,
    onClear,
    onAnalyze,
    onReplay,
    fetchSessionSolves,
    onUpdatePenalty,
    onManualSubmit,
    defaultMethod,
    onManualSubmitSheet,
    lastAnalysis,
    tourActive,
    tourStep,
    onTourNext,
    onTourBack,
    onTourSkip,
  } = props;

  const isTouch = useIsTouch();
  const { t } = useTranslation("shell");

  // Top-bar visibility mode (Settings → Appearance): always / hidden / autohide.
  const headerMode = useStore(preferencesStore, (s) => s.headerMode);

  // ── Shell-level UI state (owned here, not in App) ──────────────────────
  const [cubePanelOpen, setCubePanelOpen] = useState(false);
  const [cube3DReady, setCube3DReady] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsInitialSection, setSettingsInitialSection] = useState<string | undefined>(undefined);
  const [widgetExplorerOpen, setWidgetExplorerOpen] = useState(false);
  const [cubeConnectorOpen, setCubeConnectorOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [themeStudioOpen, setThemeStudioOpen] = useState(false);
  const [themeStudioInitialTab, setThemeStudioInitialTab] = useState<"presets" | "colors" | "typography" | "general" | "background" | "layout" | "reset">("presets");

  const handleOpenThemeStudio = useCallback((tab: "presets" | "colors" | "typography" | "general" | "background" | "layout" | "reset" = "presets") => {
    setThemeStudioInitialTab(tab);
    setThemeStudioOpen(true);
  }, []);

  // Close the 3D cube panel when leaving the timer stage — the split only
  // makes sense alongside the timer.
  useEffect(() => {
    if (activeView !== "timer") setCubePanelOpen(false);
  }, [activeView]);

  // Replay from Settings → General re-opens the tour: close overlays so the
  // spotlight never sits on top of a dialog or sheet.
  useEffect(() => {
    if (tourActive) {
      setSettingsOpen(false);
      setMobileNavOpen(false);
      setMobileMoreOpen(false);
    }
  }, [tourActive]);

  // Synchronize timer solve/inspection phase with background media animation (GIFs / videos)
  useEffect(() => {
    const phase = session$?.phase;
    const isAnimating =
      phase === "inspection" ||
      phase === "holding" ||
      phase === "ready" ||
      phase === "ready_for_move" ||
      phase === "running";
    useBackgroundMediaStore.getState().setIsAnimating(isAnimating);
  }, [session$?.phase]);

  // Volatile-storage warning: when the DB falls back to in-memory storage
  // (OPFS unavailable or locked), all data is lost on reload. Rendered as a
  // persistent banner (below) instead of a one-shot toast so a solve is never
  // silently written into a volatile DB.
  const storageType = useStore(useStorageStatusStore, (s) => s.storageType);

  // ── Context menu items handler refs (keep them fresh) ──
  const onRegenerateRef = useRef(onRegenerate);
  onRegenerateRef.current = onRegenerate;
  const onCopyRef = useRef(onCopy);
  onCopyRef.current = onCopy;
  const manualOpenRef = useRef(setManualOpen);
  manualOpenRef.current = setManualOpen;
  const widgetExplorerRef = useRef(setWidgetExplorerOpen);
  widgetExplorerRef.current = setWidgetExplorerOpen;
  const settingsRef = useRef(setSettingsOpen);
  settingsRef.current = setSettingsOpen;
  const openThemeStudioRef = useRef(handleOpenThemeStudio);
  openThemeStudioRef.current = handleOpenThemeStudio;
  const onNavigateRef = useRef(onNavigate);
  onNavigateRef.current = onNavigate;
  const activeViewRef = useRef(activeView);
  activeViewRef.current = activeView;

  // ── Global context menu: right-click anywhere opens the menu ────────
  // Contextual items are resolved dynamically based on activeView and zone.
  //
  // Touch long-press also fires `contextmenu` (while the finger is still
  // down), so track active touch pointers to tell it apart from a real
  // mouse right-click — long-press must NOT open the app menu on tablets.
  //
  // The pointer listeners run in the CAPTURE phase: capture listeners on
  // `document` fire before any element handler, so inner onPointerDown
  // stopPropagation (dock pieces, widget drag handles, timer buttons…) can't
  // hide a touch press from us.
  useEffect(() => {
    let touchPressed = false;
    const CAPTURE = true;
    const markTouch = (active: boolean) => (e: PointerEvent) => {
      if (e.pointerType === "touch") touchPressed = active;
    };
    const onPointerDown = markTouch(true);
    const onPointerUp = markTouch(false);
    const onPointerCancel = markTouch(false);
    document.addEventListener("pointerdown", onPointerDown, CAPTURE);
    document.addEventListener("pointerup", onPointerUp, CAPTURE);
    document.addEventListener("pointercancel", onPointerCancel, CAPTURE);

    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        e.defaultPrevented ||
        !target ||
        target.closest("[data-slot='context-menu-trigger']") ||
        target.closest("[data-radix-context-menu-trigger]") ||
        target.closest("[data-no-global-context-menu]")
      ) {
        return;
      }

      // Fallback: some engines fire `contextmenu` for a long-press without a
      // reliable pointerdown (e.g. long-pressing selectable text). The event's
      // own source capabilities flag a touch origin when supported.
      const fromTouch =
        touchPressed ||
        (e as MouseEvent & { sourceCapabilities?: { firesTouchEvents?: boolean } })
          .sourceCapabilities?.firesTouchEvents === true;
      if (fromTouch) {
        // Long-press on touch: never open the app menu. Editable fields
        // keep their native menu (selection / paste); everywhere else the
        // browser menu is suppressed too — long-press just does nothing.
        const editable =
          target.isContentEditable ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT";
        if (!editable) e.preventDefault();
        return;
      }

      const editable =
        target.isContentEditable ||
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT";
      if (editable) return;

      e.preventDefault();
      // Walk up from target to find a data-context-zone (up to document)
      let zone: string | null = null;
      let el = e.target as HTMLElement | null;
      while (el && el !== document.documentElement) {
        const z = el.getAttribute("data-context-zone");
        if (z) { zone = z; break; }
        el = el.parentElement;
      }

      const items = resolveContextMenuItems({
        activeView: activeViewRef.current,
        zone,
        target,
        handlers: {
          onRegenerate: () => onRegenerateRef.current(),
          onCopyScramble: () => onCopyRef.current(),
          onOpenManual: () => manualOpenRef.current(true),
          onOpenSettings: (section) => {
            if (section) setSettingsInitialSection(section);
            settingsRef.current(true);
          },
          onOpenThemeStudio: (tab) => openThemeStudioRef.current(tab),
          onOpenWidgets: () => widgetExplorerRef.current(true),
          // The context-menu resolver deliberately stays decoupled from the
          // view union (it takes a plain string); the items it can produce
          // only ever carry a real ViewId, so the narrowing happens here.
          onNavigate: (view) => onNavigateRef.current(view as ViewId),
        },
      });

      if (items.length > 0) {
        contextMenuStore.open(e.clientX, e.clientY, items);
      }
    };
    document.addEventListener("contextmenu", handler);
    return () => {
      document.removeEventListener("contextmenu", handler);
      document.removeEventListener("pointerdown", onPointerDown, CAPTURE);
      document.removeEventListener("pointerup", onPointerUp, CAPTURE);
      document.removeEventListener("pointercancel", onPointerCancel, CAPTURE);
    };
  }, []);

  const handleOpenCube = useCallback(() => {
    onNavigate("timer");
    setCube3DReady(true);
    setCubePanelOpen(true);
  }, [onNavigate]);

  const handleCloseCube = useCallback(() => setCubePanelOpen(false), []);

  const handleOpenSettingsProfile = useCallback(() => {
    setSettingsInitialSection("profile");
    setSettingsOpen(true);
  }, []);

  /**
   * The Friends screen's "¿qué comparto?" shortcut. It is a SEPARATE entry
   * point from `handleOpenSettingsProfile`: the profile editor and the consent
   * switches are different sections, and pointing both at "profile" sent the
   * shortcut to a screen that does not answer the question it asks.
   */
  const handleOpenSettingsPrivacy = useCallback(() => {
    setSettingsInitialSection("privacy");
    setSettingsOpen(true);
  }, []);

  const handleSettingsOpenChange = useCallback((open: boolean) => {
    setSettingsOpen(open);
    if (!open) setSettingsInitialSection(undefined);
  }, []);

  const timerStage = (
    <TimerStage
      session$={session$}
      currentScramble={currentScramble}
      displayScramble={displayScramble}
      scrambleIndex={scrambleIndex}
      onRegenerate={onRegenerate}
      onCopy={onCopy}
      manualFocus={manualFocus}
      onManualFocusToggle={onManualFocusToggle}
      activePbMilestone={activePbMilestone}
      onDismissPbBanner={onDismissPbBanner}
      timerStateRef={timerStateRef}
      cancelRef={cancelRef}
      solves={solves}
      onUpdatePenalty={onUpdatePenalty}
      onUpdateSolve={onUpdateSolve}
      onDeleteSolve={onDeleteSolve}
      onManualSubmit={onManualSubmit}
      puzzleFilter={puzzleCategoryToType(puzzle)}
      puzzle={puzzle}
      isFocused={isFocused}
    />
  );

  return (
    <div className="antialiased bg-background text-foreground h-dvh w-full overflow-hidden">
      <ThemeProvider>
        <div className="flex h-full flex-col">
          {storageType === "memory" && (
            <div
              role="alert"
              className="flex shrink-0 items-center justify-center gap-2 border-b border-white/20 bg-dnf px-4 py-2 text-center text-xs font-medium text-white"
            >
              <TriangleAlert className="size-3.5 shrink-0" />
              <span>{t("storageVolatile")}</span>
            </div>
          )}
          <div className="min-h-0 flex-1">
            <MainLayout
              className="h-full"
              activeView={activeView}
          sessionCount={solves.length}
          sessions={sessions}
          solves={solves}
          activeSessionId={activeSessionId}
          hideHeader={
            (!isTouch && (
              activeView === "skill-tree" ||
              activeView === "algorithms" ||
              activeView === "reconstructions" ||
              activeView === "insights" ||
              activeView === "training" ||
              activeView === "profile" ||
              activeView === "collection"
            )) ||
            headerMode === "hidden"
          }
          onSwitchSession={onSwitchSession}
          onNewSession={onNewSession}
          onRenameSession={onRenameSession}
          onDeleteSession={onDeleteSession}
          puzzle={puzzle}
          onPuzzleChange={onPuzzleChange}
          cube3DActive={cubePanelOpen}
          cube3DReady={cube3DReady}
          onCloseCube={handleCloseCube}
          cube3D={
            <Suspense fallback={<CubePanelFallback />}>
              <Cube3DPanel
                onClose={handleCloseCube}
                order={puzzleCategoryToOrder(puzzle)}
                puzzle={
                  puzzle === "Pyraminx"
                    ? { kind: "pyraminx" }
                    : undefined
                }
                scramble={currentScramble}
                connectSmartCube={session$.smartCubeConnected}
              />
            </Suspense>
          }
          leftSidebar={
            <LeftSidebar
              activeView={activeView}
              onNavigate={onNavigate}
              timerActive={
                timerStateRef.current === "running" || timerStateRef.current === "ready"
              }
              mobileOpen={mobileNavOpen}
              onMobileOpenChange={setMobileNavOpen}
              solves={solves}
              sessionName={sessionName}
              onImportSolves={onImportSolves}
              settingsOpen={settingsOpen}
              onSettingsOpenChange={handleSettingsOpenChange}
              settingsInitialSection={settingsInitialSection}
              widgetExplorerOpen={widgetExplorerOpen}
              onWidgetExplorerOpenChange={setWidgetExplorerOpen}
              cubeConnectorOpen={cubeConnectorOpen}
              onCubeConnectorOpenChange={setCubeConnectorOpen}
              themeStudioOpen={themeStudioOpen}
              onThemeStudioOpenChange={setThemeStudioOpen}
              themeStudioInitialTab={themeStudioInitialTab}
              profileSeed={profileSeed}
              profile={profile}
              onExportAllJSON={onExportAllJSON}
            />
          }
          isFocused={isFocused}
          onAddManual={() => setManualOpen(true)}
          onOpenProfile={onOpenProfile}
          onOpenLocker={onOpenLocker}
          onOpenMore={() => setMobileMoreOpen(true)}
          main={
            <MainStage
              activeView={activeView}
              sessionId={activeSessionId}
              sessions={sessions}
              solves={solves}
              lastAnalysis={lastAnalysis}
              onUpdateSolve={onUpdateSolve}
              onReanalyze={onReanalyze}
              onDeleteSolve={onDeleteSolve}
              onMoveSolves={onMoveSolves}
              onAssignCube={onAssignCube}
              puzzle={puzzle}
              onPuzzleChange={onPuzzleChange}
              onVirtualSolveComplete={onVirtualSolveComplete}
              onNavigate={onNavigate}
              onOpenSettings={handleOpenSettingsProfile}
              onOpenPrivacySettings={handleOpenSettingsPrivacy}
              fetchSessionSolves={fetchSessionSolves}
              timerStage={timerStage}
            />
          }
        />
          </div>
        </div>

        <StageOverlays
          isTouch={isTouch}
          isFocused={isFocused}
          activeView={activeView}
          onNavigate={onNavigate}
          mobileMoreOpen={mobileMoreOpen}
          onMobileMoreOpenChange={setMobileMoreOpen}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenCubeConnector={() => setCubeConnectorOpen(true)}
          onOpenProfile={onOpenProfile}
          onOpenWidgets={() => setWidgetExplorerOpen(true)}
          manualOpen={manualOpen}
          onManualClose={() => setManualOpen(false)}
          defaultMethod={defaultMethod}
          onManualSubmit={onManualSubmitSheet}
          solves={solves}
          onUpdate={onUpdateSolve}
          onDelete={onDeleteSolve}
          onClear={onClear}
          onAnalyze={onAnalyze}
          onReplay={onReplay}
          scramble={currentScramble}
          smartCubeConnected={session$.smartCubeConnected}
          cubePanelOpen={cubePanelOpen}
          onOpenCube={handleOpenCube}
          lastAnalysis={lastAnalysis}
          puzzle={puzzle}
          tourActive={tourActive}
          tourStep={tourStep}
          onTourNext={onTourNext}
          onTourBack={onTourBack}
          onTourSkip={onTourSkip}
        />

        {/* Touch widgets explorer — mounted here for the touch regime (the
            mobile header's More sheet opens it); desktop uses the
            LeftSidebar-owned explorer instead. */}
        {isTouch && (
          <WidgetExplorer
            open={widgetExplorerOpen}
            onOpenChange={setWidgetExplorerOpen}
          />
        )}
      </ThemeProvider>

      {/* Global context menu — resolves i18n keys internally */}
      <ContextMenu />
    </div>
  );
}
