"use client";

import type { ViewId } from "@/components/Layout/sidebar.constants";
import type { Penalty, PuzzleCategory, Solve, SolveMethod, SolveSource } from "@/types";
import type { TimerState } from "@/types";
import type { SolveMetrics } from "@cubeforge/types";
import type { CubeMoveEvent, CubeOrientation, OrientationTimeline } from "@cubeforge/types";
import type { PbMilestoneResult } from "@/utils/pbDetection";
import type { Profile } from "@cubeforge/database";
import type { SessionMeta } from "@/hooks/usePersistentSession";
import type { useSolveSession } from "@/hooks/useSolveSession";
import type { SolveCompletionOverrides } from "@/hooks/useSolveCompletion";

/**
 * End-of-solve pipeline entry for the virtual cube simulator — the SAME
 * useSolveCompletion.handleComplete used by the real timer, with per-call
 * overrides (source "virtual", the simulator's own scramble + next-scramble).
 */
export type VirtualSolveComplete = (
  time: number,
  penalty: Penalty,
  moves: CubeMoveEvent[],
  orientations: (CubeOrientation | undefined)[],
  orientationTimeline: OrientationTimeline | undefined,
  overrides?: SolveCompletionOverrides,
) => void;

export type ImportInputs = Array<{
  time: number;
  penalty: Penalty;
  scramble: string;
  method?: string;
  timestamp: number;
  note?: string;
  source?: SolveSource;
  puzzleType?: string;
}>;

export interface AppShellProps {
  solves: Solve[];
  sessions: SessionMeta[];
  activeSessionId: string | null;
  sessionName: string | undefined;
  activeView: ViewId;
  profileSeed: string | null;
  profile: Profile | null;
  puzzle: PuzzleCategory;
  currentScramble: string;
  displayScramble: string;
  scrambleIndex: number;
  onPuzzleChange: (puzzle: PuzzleCategory) => void;
  /** True while the Cube tab is active — the simulator is 3×3-only today,
   *  so the header puzzle selector is forced to 3×3 and disabled. */
  puzzleLocked?: boolean;
  /** End-of-solve pipeline for the virtual cube simulator (source "virtual"). */
  onVirtualSolveComplete?: VirtualSolveComplete;
  onRegenerate: () => void;
  onCopy: () => void;
  onSwitchSession: (id: string) => void;
  onNewSession: () => void;
  onRenameSession: (id: string, name: string) => void;
  onDeleteSession: (id: string) => void;
  onImportSolves: (inputs: ImportInputs) => Promise<void>;
  onExportAllJSON: () => Promise<void>;
  onNavigate: (view: ViewId) => void;
  onOpenProfile: () => void;
  isFocused: boolean;
  session$: ReturnType<typeof useSolveSession>;
  timerStateRef: React.MutableRefObject<TimerState>;
  cancelRef: React.MutableRefObject<(() => void) | null>;
  manualFocus: boolean;
  onManualFocusToggle: () => void;
  activePbMilestone: PbMilestoneResult | null;
  onDismissPbBanner: () => void;
  fetchSessionSolves: (sessionId: string) => Promise<Solve[]>;
  onUpdateSolve: (id: string, updates: { penalty?: Penalty; note?: string | null }) => void;
  onDeleteSolve: (id: string) => void;
  onClear: () => void;
  onAnalyze: (solve: Solve) => void;
  onReplay: (solve: Solve) => void;
  onUpdatePenalty: (id: string, penalty: Penalty) => void;
  /** Inline manual-mode submit (timer stage). */
  onManualSubmit: (time: number, penalty: Penalty, note?: string | null) => void;
  /** Manual solve sheet submit (header "+" button). */
  defaultMethod: SolveMethod;
  onManualSubmitSheet: (input: {
    time: number;
    scramble: string;
    method: SolveMethod;
    notes: string;
    penalty: Penalty;
  }) => Promise<void>;
  lastAnalysis: SolveMetrics | null;
  tourActive: boolean;
  tourStep: number;
  onTourNext: () => void;
  onTourBack: () => void;
  onTourSkip: () => void;
}
