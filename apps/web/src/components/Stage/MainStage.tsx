"use client";

import { lazy, Suspense, useEffect, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { markAppReady } from "@/boot/appReady";
import type { ViewId } from "@/components/Layout/sidebar.constants";
import type { Penalty, PuzzleCategory, Solve } from "@/types";
import { effectiveTime, normalizePenalty } from "@/types";
import { puzzleCategoryToType } from "@/utils/puzzleUtils";
import type { SolveMetrics } from "@cubeforge/types";
import type { SessionMeta } from "@/hooks/usePersistentSession";
import type { VirtualSolveComplete } from "@/components/Layout/appShell.types";

// Heavy views are code-split: each loads its own chunk only when the user
// visits it, keeping the initial bundle (timer + shell) small. The timer
// stage stays eager — it is the landing screen users see first.

/**
 * Signals the pre-React boot loader (see @/boot/appReady) when a view's chunk
 * finishes loading and hands back the component. The overlay stays up until
 * the initial view is ready — covering the Suspense fallback — so a reload
 * never shows a second loading state; the loader fades straight into the view.
 */
function withReady<T>(component: T): T {
  markAppReady();
  return component;
}

const InsightsDashboard = lazy(() =>
  import("@/components/Insights/InsightsDashboard").then((m) => ({ default: withReady(m.InsightsDashboard) })),
);
const AlgorithmDashboard = lazy(() =>
  import("@/views/Algorithms/AlgorithmDashboard").then((m) => ({ default: withReady(m.AlgorithmDashboard) })),
);
const TrainingDashboard = lazy(() =>
  import("@/views/Training/TrainingDashboard").then((m) => ({ default: withReady(m.TrainingDashboard) })),
);
const UltraSkillTreeView = lazy(() =>
  import("@/views/SkillTree/UltraSkillTreeView").then((m) => ({ default: withReady(m.UltraSkillTreeView) })),
);
const ProfileView = lazy(() =>
  import("@/views/Profile/ProfileView").then((m) => ({ default: withReady(m.ProfileView) })),
);
const FriendsView = lazy(() =>
  import("@/views/Friends/FriendsView").then((m) => ({ default: withReady(m.FriendsView) })),
);
const ReconstructionsView = lazy(() =>
  import("@/views/Reconstructions/ReconstructionsView").then((m) => ({ default: withReady(m.ReconstructionsView) })),
);
const CubeSimulatorView = lazy(() =>
  import("@/views/Cube/CubeSimulatorView").then((m) => ({ default: withReady(m.CubeSimulatorView) })),
);
const CollectionView = lazy(() =>
  import("@/views/Collection/CollectionView").then((m) => ({ default: withReady(m.CollectionView) })),
);

/**
 * Tiny fallback shown while a lazy view chunk downloads (in-app navigation).
 * Matches the pre-React boot loader exactly (same squares, no text); on the
 * initial load it stays hidden behind that overlay, so only ONE loading
 * state is ever visible to the user.
 */
function ViewFallback() {
  return <Spinner size="md" variant="centered" />;
}

export interface MainStageProps {
  activeView: ViewId;
  sessionId: string | null;
  sessions: SessionMeta[];
  solves: Solve[];
  fetchSessionSolves: (sessionId: string) => Promise<Solve[]>;
  lastAnalysis: SolveMetrics | null;
  onUpdateSolve: (id: string, updates: { penalty?: Penalty; note?: string | null }) => void;
  /** Re-run the analysis pipeline on a stored solve. */
  onReanalyze: (solve: Solve) => Promise<void>;
  onDeleteSolve: (id: string) => void;
  /** Move solves to another session (batch). */
  onMoveSolves: (ids: string[], targetSessionId: string) => void;
  puzzle: PuzzleCategory;
  onPuzzleChange: (puzzle: PuzzleCategory) => void;
  /** End-of-solve pipeline for the virtual cube simulator (source "virtual"). */
  onVirtualSolveComplete?: VirtualSolveComplete;
  onNavigate: (view: ViewId) => void;
  /** Opens Settings pre-selected to the profile section. */
  onOpenSettings: () => void;
  /** Rendered when `activeView === "timer"`. */
  timerStage: React.ReactNode;
}

/**
 * The stage switcher (extracted from App.tsx): renders the view that matches
 * the active nav item — Insights, Practice, Training, Skill Tree, Profile, or
 * the live timer stage. Owns the Algorithms → Training "Practice This Case"
 * bridge preset and the current-PB baseline used by the Insights dashboard.
 */
export function MainStage(props: MainStageProps) {
  const {
    activeView,
    sessionId,
    sessions,
    solves,
    fetchSessionSolves,
    lastAnalysis,
    onUpdateSolve,
    onReanalyze,
    onDeleteSolve,
    onMoveSolves,
    puzzle,
    onPuzzleChange,
    onVirtualSolveComplete,
    onNavigate,
    onOpenSettings,
    timerStage,
  } = props;

  // Training preset for Algorithms → Training bridge: when the user clicks
  // "Practice This Case" from the Algorithms view, navigate to Training with
  // the case already loaded in AlgorithmDrillView.
  const [trainingPreset, setTrainingPreset] = useState<{
    subsetId: string;
    caseId: string;
  } | null>(null);

  // Current session PB for the active puzzle (used by the Insights dashboard).
  const currentPuzzleType = puzzleCategoryToType(puzzle);
  const puzzleSolves = solves.filter((s) => (s.puzzleType ?? "333") === currentPuzzleType);
  const validSolves = puzzleSolves.filter((s) => normalizePenalty(s.penalty) !== "DNF");
  const currentPB =
    validSolves.length > 0 ? Math.min(...validSolves.map((s) => effectiveTime(s))) : null;

  // The eager timer stage is ready the moment it mounts — signal the boot
  // loader to fade out. (Lazy views signal from their chunk's `.then` instead.)
  useEffect(() => {
    if (activeView === "timer") markAppReady();
  }, [activeView]);

  if (activeView === "insights") {
    return (
      <Suspense fallback={<ViewFallback />}>
        <InsightsDashboard
          key={sessionId ?? "none"}
          solves={solves}
          sessions={sessions}
          fetchSessionSolves={fetchSessionSolves}
          activeSessionId={sessionId}
          pb={currentPB ?? undefined}
          pendingAnalysis={lastAnalysis}
          sessionId={sessionId}
          onUpdateSolve={onUpdateSolve}
          onReanalyze={onReanalyze}
          onDeleteSolve={onDeleteSolve}
          onMoveSolves={onMoveSolves}
        />
      </Suspense>
    );
  }

  if (activeView === "algorithms") {
    return (
      <Suspense fallback={<ViewFallback />}>
        <AlgorithmDashboard
          onPracticeCase={(subsetId, caseId) => {
            setTrainingPreset({ subsetId, caseId });
            onNavigate("training");
          }}
        />
      </Suspense>
    );
  }

  if (activeView === "training") {
    return (
      <Suspense fallback={<ViewFallback />}>
        <TrainingDashboard
          preset={trainingPreset}
          onPresetConsumed={() => setTrainingPreset(null)}
          puzzle={puzzle}
          onPuzzleChange={onPuzzleChange}
        />
      </Suspense>
    );
  }

  if (activeView === "skill-tree") {
    return (
      <Suspense fallback={<ViewFallback />}>
        <UltraSkillTreeView onNavigate={(view) => onNavigate(view as ViewId)} />
      </Suspense>
    );
  }

  if (activeView === "profile") {
    return (
      <Suspense fallback={<ViewFallback />}>
        <ProfileView onNavigate={onNavigate} onOpenSettings={onOpenSettings} />
      </Suspense>
    );
  }

  if (activeView === "friends") {
    return (
      <Suspense fallback={<ViewFallback />}>
        <FriendsView onOpenSettings={onOpenSettings} />
      </Suspense>
    );
  }

  if (activeView === "reconstructions") {
    return (
      <Suspense fallback={<ViewFallback />}>
        <ReconstructionsView />
      </Suspense>
    );
  }

  if (activeView === "collection") {
    return (
      <Suspense fallback={<ViewFallback />}>
        <CollectionView />
      </Suspense>
    );
  }

  if (activeView === "cube") {
    return (
      <Suspense fallback={<ViewFallback />}>
        <CubeSimulatorView puzzle={puzzle} onVirtualSolveComplete={onVirtualSolveComplete} />
      </Suspense>
    );
  }

  // timer
  return <>{timerStage}</>;
}
