"use client";

import { AnimatePresence } from "framer-motion";
import { useStore } from "zustand";
import { preferencesStore } from "@cubeforge/state";
import { Toaster } from "@/components/ui/sonner";
import { MobileTabBar } from "@/components/Layout/MobileTabBar";
import { MobileMoreSheet } from "@/components/Layout/MobileMoreSheet";
import { ManualSolveSheet } from "@/components/Stats/ManualSolveSheet";
import { WidgetHost } from "@/widgets/explorer";
import { CubeButtonGate } from "@/widgets/implementations/cube-button/CubeButtonGate";
import { useVirtualScrambleStore } from "@/stores/virtualScrambleStore";
import { OnboardingTour } from "@/components/Onboarding/OnboardingTour";
import type { ViewId } from "@/components/Layout/sidebar.constants";
import type { Penalty, PuzzleCategory, Solve, SolveMethod } from "@/types";
import type { SolveMetrics } from "@cubeforge/types";

export interface StageOverlaysProps {
  isTouch: boolean;
  isFocused: boolean;
  activeView: ViewId;
  onNavigate: (view: ViewId) => void;
  // Mobile more sheet
  mobileMoreOpen: boolean;
  onMobileMoreOpenChange: (open: boolean) => void;
  onOpenSettings: () => void;
  onOpenCubeConnector: () => void;
  onOpenProfile: () => void;
  onOpenWidgets: () => void;
  // Manual solve sheet
  manualOpen: boolean;
  onManualClose: () => void;
  defaultMethod: SolveMethod;
  onManualSubmit: (input: {
    time: number;
    scramble: string;
    method: SolveMethod;
    notes: string;
    penalty: Penalty;
  }) => Promise<void>;
  // Floating widgets + cube launcher
  solves: Solve[];
  onUpdate: (id: string, updates: { penalty?: Penalty; note?: string | null }) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
  onAnalyze: (solve: Solve) => void;
  onReplay: (solve: Solve) => void;
  scramble: string;
  smartCubeConnected: boolean;
  cubePanelOpen: boolean;
  onOpenCube: () => void;
  lastAnalysis: SolveMetrics | null;
  puzzle: PuzzleCategory;
  // Onboarding tour
  tourActive: boolean;
  tourStep: number;
  onTourNext: () => void;
  onTourBack: () => void;
  onTourSkip: () => void;
}

/**
 * Everything that floats above the stage (extracted from AppShell): the
 * mobile tab bar and sheets, the manual solve sheet, the floating widget
 * host, the 3D cube launcher, the first-run tour overlay, and toasts.
 */
export function StageOverlays(props: StageOverlaysProps) {
  const {
    isTouch,
    isFocused,
    activeView,
    onNavigate,
    mobileMoreOpen,
    onMobileMoreOpenChange,
    onOpenSettings,
    onOpenCubeConnector,
    onOpenProfile,
    onOpenWidgets,
    manualOpen,
    onManualClose,
    defaultMethod,
    onManualSubmit,
    solves,
    onUpdate,
    onDelete,
    onClear,
    onAnalyze,
    onReplay,
    scramble,
    smartCubeConnected,
    cubePanelOpen,
    onOpenCube,
    lastAnalysis,
    puzzle,
    tourActive,
    tourStep,
    onTourNext,
    onTourBack,
    onTourSkip,
  } = props;

  // The Cube tab (virtual cube simulator) owns its own scramble lifecycle —
  // while it's active, the floating widgets (scramble-2d in particular) must
  // render ITS scramble, not the real timer's `currentScramble`.
  const notificationsEnabled = useStore(preferencesStore, (s) => s.notificationsEnabled);
  const cubeScramble = useVirtualScrambleStore((s) => s.scramble);
  const widgetScramble = activeView === "cube" ? cubeScramble : scramble;

  return (
    <>
      {/* Bottom tab bar — touch regime only (phones + small tablets <768px). */}
      {!isFocused && (
        <MobileTabBar activeView={activeView} onNavigate={onNavigate} />
      )}

      {/* Mobile grid options bottom sheet (Settings, Profile, Reconstructions, Smart Cube, Theme) */}
      <MobileMoreSheet
        open={mobileMoreOpen}
        onOpenChange={onMobileMoreOpenChange}
        onOpenSettings={onOpenSettings}
        onOpenCubeConnector={onOpenCubeConnector}
        onOpenProfile={onOpenProfile}
        onOpenWidgets={onOpenWidgets}
        onNavigate={onNavigate}
      />

      {/* Manual solve sheet — mounted at App level (opened from the Header
          "+" button). A manual entry is a session action, not an analysis
          action, so it lives here rather than inside the Insights dashboard. */}
      <ManualSolveSheet
        open={manualOpen}
        onClose={onManualClose}
        defaultMethod={defaultMethod}
        onSubmit={onManualSubmit}
      />

      {/* WidgetHost renders all active floating widgets (Solve Log, Scramble
          Visualizer, Time Distribution, PB Progression, Solve Timeline,
          Metronome, Notes, etc.) driven by the Widget Store. The 3D cube
          button is rendered separately below as a circular floating button
          (not through WidgetHost/dock system).

          Mounted on the timer AND the Cube (virtual) tab: the dock pills in
          the header launch the same widgets everywhere. While the Cube tab
          is active, `widgetScramble` is the simulator's own scramble (the
          virtual cube owns its scramble lifecycle; the real timer's is
          unrelated). */}
      {!isFocused && !tourActive && (activeView === "timer" || activeView === "cube") && (
        <WidgetHost
          solves={solves}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onClear={onClear}
          onAnalyze={onAnalyze}
          onReplay={onReplay}
          scramble={widgetScramble}
          smartCubeConnected={smartCubeConnected}
          cubePanelOpen={cubePanelOpen}
          onOpenCube={onOpenCube}
          lastAnalysis={lastAnalysis}
          puzzle={puzzle}
        />
      )}

      {/* 3D Cube launcher — circular floating button, always present when
          cube panel is closed and widget is toggled on. Independent from the
          dock system but toggleable in the Widget Explorer. */}
      {activeView === "timer" && !isFocused && !tourActive && (
        <CubeButtonGate
          cubePanelOpen={cubePanelOpen}
          smartCubeConnected={smartCubeConnected}
          onOpenCube={onOpenCube}
        />
      )}

      {/* First-load onboarding spotlight tour — one-shot (TDD-0020). */}
      <AnimatePresence>
        {tourActive && (
          <OnboardingTour
            activeView={activeView}
            currentStep={tourStep}
            onNavigate={onNavigate}
            onNext={onTourNext}
            onBack={onTourBack}
            onSkip={onTourSkip}
          />
        )}
      </AnimatePresence>

      <Toaster
        // On touch, toasts float at the top so they never collide with the
        // fixed bottom tab bar (or the mobile Times bottom sheet). Desktop
        // keeps the bottom-center position unchanged.
        position={isTouch ? "top-center" : "bottom-center"}
        richColors={false}
        // When the user has disabled notifications, suppress every toast.
        visibleToasts={notificationsEnabled ? 3 : 0}
        duration={notificationsEnabled ? 4000 : 0}
      />
    </>
  );
}
