"use client";

import { memo, useState, useCallback, useEffect, useMemo } from "react";
import { toast } from "sonner";
import i18n from "@/i18n";
import {
  X,
  ChevronLeft,
  Play,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CaseDiagram } from "./CaseDiagram";
import { Case2x2Diagram } from "./Case2x2Diagram";
import { Case3DPanel } from "./Case3DPanel";
import { AlgorithmEditorDialog } from "./AlgorithmEditorDialog";
import { SortableAlgorithmItem } from "./SortableAlgorithmItem";
import { useCaseAlgorithms } from "@/hooks/useCaseAlgorithms";
import { algorithmStore } from "@cubeforge/state";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { resolveAlgorithmDiagramRotation } from "@cubeforge/algorithm-db";
import type {
  AlgorithmCase,
  Algorithm,
  VisualizationStyle,
} from "@cubeforge/algorithm-db";

export interface CaseDetailPanelProps {
  caseData: AlgorithmCase;
  /** @deprecated No longer needed — algorithms are now fetched via useCaseAlgorithms hook. */
  algorithms?: Algorithm[];
  onClose: () => void;
  /** Visualisation style for dynamic diagram generation (default: 'full-color'). */
  visualizationStyle?: VisualizationStyle;
  /** Called when the user wants to practice this case in the Training tab. */
  onPracticeCase?: (subsetId: string, caseId: string) => void;
  className?: string;
  /**
   * 'panel' renders the desktop side panel (>=1024px, default).
   * 'overlay' renders the touch full-screen sheet (<1024px): back button in
   * the header and a sticky bottom "Practice this case" CTA.
   */
  variant?: "panel" | "overlay";
}

export const CaseDetailPanel = memo(function CaseDetailPanel({
  caseData,
  algorithms: _algorithmsProp,
  onClose,
  visualizationStyle,
  onPracticeCase,
  className,
  variant = "panel",
}: CaseDetailPanelProps) {
  // ── Algorithms from hook (seed + custom, ordered) ──────────────────
  const { algorithms, primaryAlgorithm } = useCaseAlgorithms(caseData.id);

  // ── Algorithm editor state ──────────────────────────────────────────
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingAlgorithm, setEditingAlgorithm] = useState<Algorithm | null>(
    null,
  );

  // ── Selected algorithm state ────────────────────────────────────────
  const [selectedAlgId, setSelectedAlgId] = useState<string | null>(null);

  // Reset selection when case changes
  useEffect(() => {
    setSelectedAlgId(null);
  }, [caseData.id]);

  // ── DnD sensors ─────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  // ── Sorted algorithm IDs for SortableContext ────────────────────────
  const sortedAlgIds = useMemo(
    () => algorithms.map((a) => a.id),
    [algorithms],
  );

  // ── Drag end handler ────────────────────────────────────────────────
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = sortedAlgIds.indexOf(String(active.id));
      const newIndex = sortedAlgIds.indexOf(String(over.id));

      if (oldIndex === -1 || newIndex === -1) return;

      const newOrder = [...sortedAlgIds];
      newOrder.splice(oldIndex, 1);
      newOrder.splice(newIndex, 0, String(active.id));

      algorithmStore.getState().setCaseOrder(caseData.id, newOrder);
    },
    [sortedAlgIds, caseData.id],
  );

  const activeAlg =
    algorithms.find((a) => a.id === selectedAlgId) ?? primaryAlgorithm;

  // ── Handlers ────────────────────────────────────────────────────────

  const handleOpenAddDialog = useCallback(() => {
    setEditingAlgorithm(null);
    setEditorOpen(true);
  }, []);

  const handleOpenEditDialog = useCallback((alg: Algorithm) => {
    setEditingAlgorithm(alg);
    setEditorOpen(true);
  }, []);

  const handleCloseEditor = useCallback(() => {
    setEditorOpen(false);
    setEditingAlgorithm(null);
  }, []);

  const handleDeleteAlgorithm = useCallback((alg: Algorithm) => {
    algorithmStore.getState().removeCustomAlgorithm(alg.id);
    setSelectedAlgId((prev) => (prev === alg.id ? null : prev));
    toast.success(i18n.t("toast:algorithmRemoved"), {
      description: `${alg.moves.slice(0, 4).join(" ")}${alg.moves.length > 4 ? " …" : ""}`,
    });
  }, []);

  // ── 3D isometric cases delegate to Case3DPanel ─────────────────────
  if (caseData.diagramType === "3d-isometric") {
    return (
      <Case3DPanel
        caseData={caseData}
        algorithms={algorithms}
        onClose={onClose}
        onPracticeCase={onPracticeCase}
        className={className}
        variant={variant}
      />
    );
  }

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <>
      <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
        {/* Header — overlay variant swaps X for a back button (touch) */}
        <div className="flex items-center justify-between shrink-0 px-4 py-3 border-b border-line">
          <div className="flex items-center gap-2 min-w-0">
            {variant === "overlay" && (
              <button
                onClick={onClose}
                className="flex h-10 shrink-0 items-center gap-1 rounded-lg px-2 -ml-2 text-[0.72rem] font-medium text-ink-2 hover:text-ink hover:bg-surface-2 transition-colors touch-manipulation"
                aria-label="Back to cases"
              >
                <ChevronLeft className="size-4" />
                Back
              </button>
            )}
            <span className="nums text-[0.85rem] font-semibold text-ink">
              {caseData.caseNumber}
            </span>
            {caseData.name && caseData.name !== caseData.caseNumber && (
              <span className="text-[0.75rem] text-ink-2 truncate">
                {caseData.name}
              </span>
            )}
            {caseData.category &&
              caseData.category !== caseData.name &&
              caseData.category !== caseData.caseNumber && (
                <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[0.6rem] font-medium text-ink-3">
                  {caseData.category}
                </span>
              )}
          </div>
          {variant !== "overlay" && (
            <button
              onClick={onClose}
              className="rounded p-1 text-ink-3 hover:bg-surface-2 hover:text-ink transition-colors"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {/* Diagram — uses primaryAlgorithm (first in order) */}
          {(caseData.diagramType === "2d-top" || caseData.diagram2D) && (
            <div className="flex flex-col items-center justify-center">
              {caseData.puzzleType === "2x2x2" ? (
                <Case2x2Diagram
                  faceletColors={caseData.diagram2D?.faceletColors}
                  setupScramble={caseData.setupScramble}
                  moves={undefined}
                  style={visualizationStyle ?? "full-color"}
                  rotation={resolveAlgorithmDiagramRotation(activeAlg)}
                  className="w-48"
                />
              ) : (
                <CaseDiagram
                  arrows={caseData.diagram2D?.arrows}
                  setupScramble={caseData.setupScramble}
                  moves={undefined}
                  style={visualizationStyle ?? "full-color"}
                  rotation={resolveAlgorithmDiagramRotation(activeAlg)}
                  className="w-48"
                />
              )}
              {caseData.setupScramble && (
                <div className="mt-2 text-center text-[0.65rem] text-ink-3">
                  <span className="font-semibold text-ink-2">Setup:</span>{" "}
                  <span className="font-mono text-ink-2">{caseData.setupScramble}</span>
                </div>
              )}
            </div>
          )}

          {/* Recognition patterns */}
          {caseData.recognitionPatterns.length > 0 && (
            <div>
              <h4 className="text-[0.65rem] font-medium uppercase tracking-[0.12em] text-ink-3 mb-2">
                Recognition
              </h4>
              <ul className="space-y-1.5">
                {caseData.recognitionPatterns.map((pattern, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-[0.72rem] text-ink-2"
                  >
                    <span className="select-none text-ink-3">•</span>
                    <span>{pattern}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Probability */}
          {caseData.probability && (
            <div>
              <h4 className="text-[0.65rem] font-medium uppercase tracking-[0.12em] text-ink-3 mb-1">
                Probability
              </h4>
              <p className="text-[0.72rem] text-ink-2">
                {caseData.probability}
              </p>
            </div>
          )}

          {/* ── Algorithms (drag-and-drop reorderable) ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[0.65rem] font-medium uppercase tracking-[0.12em] text-ink-3">
                Algorithms ({algorithms.length})
              </h4>
              <button
                onClick={handleOpenAddDialog}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[0.6rem] font-medium text-ink-2 hover:text-ink hover:bg-surface-2 transition-colors"
                title="Add custom algorithm"
              >
                <Plus className="size-3" />
                Add custom
              </button>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={sortedAlgIds}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {algorithms.map((alg) => (
                    <SortableAlgorithmItem
                      key={alg.id}
                      alg={alg}
                      isSelected={alg.id === activeAlg?.id}
                      isPrimary={alg.id === primaryAlgorithm?.id}
                      is2x2={caseData.puzzleType === "2x2x2"}
                      subsetId={caseData.subsetId}
                      onSelect={() => setSelectedAlgId(alg.id)}
                      onEdit={() => handleOpenEditDialog(alg)}
                      onDelete={() => handleDeleteAlgorithm(alg)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          {/* Practice this case button — inline in panel variant only */}
          {onPracticeCase && variant !== "overlay" && (
            <button
              onClick={() =>
                onPracticeCase(caseData.subsetId, caseData.id)
              }
              className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-[0.72rem] font-semibold text-surface hover:bg-ink/90 transition-colors w-full justify-center"
            >
              <Play className="size-3.5" />
              Practice this case
            </button>
          )}


          {/* Tags */}
          {caseData.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {caseData.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[0.58rem] text-ink-3"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Overlay footer: sticky practice CTA (touch only) */}
        {variant === "overlay" && onPracticeCase && (
          <div className="shrink-0 border-t border-line bg-surface px-4 py-3 pb-safe">
            <button
              onClick={() =>
                onPracticeCase(caseData.subsetId, caseData.id)
              }
              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-ink text-[0.8rem] font-semibold text-surface hover:bg-ink/90 transition-colors touch-manipulation"
            >
              <Play className="size-4" />
              Practice this case
            </button>
          </div>
        )}
      </div>

      {/* Algorithm Editor Dialog */}
      <AlgorithmEditorDialog
        open={editorOpen}
        onClose={handleCloseEditor}
        caseData={caseData}
        existingAlgorithm={editingAlgorithm}
      />
    </>
  );
});
