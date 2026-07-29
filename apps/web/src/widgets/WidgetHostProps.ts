import type { Solve } from "@/types";
import type { SolveMetrics } from "@cubeforge/types";

/**
 * Props passed from App.tsx through WidgetHost to each widget.
 * Extracted to its own file to avoid circular dependency between
 * WidgetHost and WidgetRegistry.
 */
export interface WidgetHostProps {
  solves: Solve[];
  onUpdate: (id: string, updates: Partial<Solve>) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
  onAnalyze: (solve: Solve) => void;
  onReplay: (solve: Solve) => void;
  scramble: string;
  smartCubeConnected: boolean;
  cubePanelOpen: boolean;
  onOpenCube: () => void;
  /** Pending analysis from the just-completed live solve (not yet persisted). */
  lastAnalysis?: SolveMetrics | null;
  /** Active puzzle category (e.g. '2x2', '3x3', '4x4'). */
  puzzle?: string;
}
