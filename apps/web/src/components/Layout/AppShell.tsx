"use client";

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { MainLayout } from "@/components/Layout/MainLayout";
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
import { contextMenuStore, type ContextMenuItem } from "@/components/ContextMenu/contextMenuStore";
import { RefreshCw, Copy, Plus, Puzzle, Settings, LayoutGrid } from "lucide-react";
import { useStorageStatusStore } from "@/stores/storageStatus";
import { preferencesStore } from "@cubeforge/state";
import { useIsTouch } from "@/hooks/use-mobile";
import { puzzleCategoryToOrder, puzzleCategoryToType } from "@/utils/puzzleUtils";
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
    puzzleLocked,
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
    isFocused,
    session$,
    timerStateRef,
    cancelRef,
    manualFocus,
    onManualFocusToggle,
    activePbMilestone,
    onDismissPbBanner,
    onUpdateSolve,
    onDeleteSolve,
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

  // User preference: hide the top header entirely (Settings → Appearance).
  const showHeader = useStore(preferencesStore, (s) => s.showHeader);

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

  // Volatile-storage warning: when the DB falls back to in-memory storage
  // (OPFS unavailable), all data is lost on reload. Warn the user once per
  // session so they can export.
  const storageWarnedRef = useRef(false);
  const storageType = useStore(useStorageStatusStore, (s) => s.storageType);
  useEffect(() => {
    if (storageType === "memory" && !storageWarnedRef.current) {
      storageWarnedRef.current = true;
      toast.warning(
        t("storageVolatile"),
        { duration: 8000 },
      );
    }
    // `t` from react-i18next is referentially stable, so this effect still
    // only fires on storage-type changes.
  }, [storageType, t]);

  // ── Generic context menu items (set once, refs keep them current) ──
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

  // ── Global context menu: right-click anywhere opens the menu ────────
  // Generic items are always shown. Zone-specific items (e.g. "Editar dock"
  // when right-clicking on the dock) are merged based on data-context-zone.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      e.preventDefault();
      // Walk up from target to find a data-context-zone (up to document)
      let zone: string | null = null;
      let el = e.target as HTMLElement | null;
      while (el && el !== document.documentElement) {
        const z = el.getAttribute("data-context-zone");
        if (z) { zone = z; break; }
        el = el.parentElement;
      }
      const items: ContextMenuItem[] = [
        { id: "new-scramble", label: "newScramble", icon: RefreshCw, onClick: () => onRegenerateRef.current() },
        { id: "copy-scramble", label: "copyScramble", icon: Copy, onClick: () => onCopyRef.current() },
        { id: "add-manual", label: "addManualSolve", icon: Plus, onClick: () => manualOpenRef.current(true) },
        { id: "open-widgets", label: "openWidgets", icon: Puzzle, onClick: () => widgetExplorerRef.current(true), separatorBefore: true },
        { id: "settings", label: "settings", icon: Settings, onClick: () => settingsRef.current(true) },
      ];
      // Zone-specific items
      if (zone === "dock") {
        items.splice(0, 0, {
          id: "edit-dock",
          label: "editDock",
          icon: LayoutGrid,
          onClick: () => {
            import("@/widgets/dock/dockEditStore").then((m) => m.dockEditStore.startEditing());
          },
          separatorBefore: false,
        });
      }
      contextMenuStore.open(e.clientX, e.clientY, items);
    };
    document.addEventListener("contextmenu", handler);
    return () => document.removeEventListener("contextmenu", handler);
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
      onExpand={() => onNavigate("insights")}
      puzzleFilter={puzzleCategoryToType(puzzle)}
      isFocused={isFocused}
    />
  );

  return (
    <div className="antialiased bg-background text-foreground h-dvh w-full overflow-hidden">
      <ThemeProvider>
        <MainLayout
          sessionCount={solves.length}
          sessions={sessions}
          activeSessionId={activeSessionId}
          hideHeader={activeView === "skill-tree" || !showHeader}
          onSwitchSession={onSwitchSession}
          onNewSession={onNewSession}
          onRenameSession={onRenameSession}
          onDeleteSession={onDeleteSession}
          puzzle={puzzle}
          onPuzzleChange={onPuzzleChange}
          puzzleLocked={puzzleLocked}
          cube3DActive={cubePanelOpen}
          cube3DReady={cube3DReady}
          onCloseCube={handleCloseCube}
          cube3D={
            <Suspense fallback={<CubePanelFallback />}>
              <Cube3DPanel
                onClose={handleCloseCube}
                order={puzzleCategoryToOrder(puzzle)}
                scramble={currentScramble}
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
              profileSeed={profileSeed}
              profile={profile}
              onExportAllJSON={onExportAllJSON}
            />
          }
          isFocused={isFocused}
          onAddManual={() => setManualOpen(true)}
          main={
            <MainStage
              activeView={activeView}
              sessionId={activeSessionId}
              sessions={sessions}
              solves={solves}
              lastAnalysis={lastAnalysis}
              onUpdateSolve={onUpdateSolve}
              onDeleteSolve={onDeleteSolve}
              puzzle={puzzle}
              onPuzzleChange={onPuzzleChange}
              onVirtualSolveComplete={onVirtualSolveComplete}
              onNavigate={onNavigate}
              onOpenSettings={handleOpenSettingsProfile}
              onSwitchSession={onSwitchSession}
              fetchSessionSolves={fetchSessionSolves}
              timerStage={timerStage}
            />
          }
        />

        <StageOverlays
          isTouch={isTouch}
          isFocused={isFocused}
          activeView={activeView}
          onNavigate={onNavigate}
          onOpenMore={() => setMobileMoreOpen(true)}
          mobileMoreOpen={mobileMoreOpen}
          onMobileMoreOpenChange={setMobileMoreOpen}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenCubeConnector={() => setCubeConnectorOpen(true)}
          onOpenProfile={onOpenProfile}
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
      </ThemeProvider>

      {/* Global context menu — resolves i18n keys internally */}
      <ContextMenu />
    </div>
  );
}
