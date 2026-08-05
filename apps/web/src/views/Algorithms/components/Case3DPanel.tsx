"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { X, ChevronLeft, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Case3DDiagram } from "./Case3DDiagram";
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
import { isF2LCase } from "@cubeforge/algorithm-db";
import type { AlgorithmCase, Algorithm } from "@cubeforge/algorithm-db";

export interface Case3DPanelProps {
  caseData: AlgorithmCase;
  /** @deprecated — ahora se usa useCaseAlgorithms internamente */
  algorithms?: Algorithm[];
  onClose: () => void;
  onPracticeCase?: (subsetId: string, caseId: string) => void;
  className?: string;
  /**
   * 'panel' = desktop side panel (>=1024px). 'overlay' = touch full-screen
   * sheet (<1024px) with a back button + sticky bottom CTA.
   */
  variant?: "panel" | "overlay";
}

const SLOT_LABELS = [
  { id: 0, key: "FR", name: "Front Right" },
  { id: 1, key: "FL", name: "Front Left" },
  { id: 2, key: "BL", name: "Back Left" },
  { id: 3, key: "BR", name: "Back Right" },
];

export function Case3DPanel({
  caseData,
  algorithms: _algorithmsProp,
  onClose,
  onPracticeCase,
  className,
  variant = "panel",
}: Case3DPanelProps) {
  // ── Algorithms from hook (seed + custom, ordered) ──────────────────
  const { algorithms, primaryAlgorithm } = useCaseAlgorithms(caseData.id);

  // ── Editor state ────────────────────────────────────────────────────
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingAlgorithm, setEditingAlgorithm] = useState<Algorithm | null>(null);

  // ── Selection state ─────────────────────────────────────────────────
  const [selectedAlgId, setSelectedAlgId] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<number>(0);
  const [resetCameraTrigger, setResetCameraTrigger] = useState<number>(0);

  // Reset selection when case changes
  useEffect(() => {
    setSelectedAlgId(null);
    setSelectedSlot(0);
  }, [caseData.id]);

  // ── DnD sensors ─────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const sortedAlgIds = useMemo(() => algorithms.map((a) => a.id), [algorithms]);

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

  // ── Derived ─────────────────────────────────────────────────────────
  const activeAlg =
    algorithms.find((a) => a.id === selectedAlgId) ?? primaryAlgorithm;

  const isF2L = isF2LCase(caseData);

  useEffect(() => {
    const preferredSlot = activeAlg?.viewPreferences?.preferredF2LSlot;
    if (preferredSlot != null) setSelectedSlot(preferredSlot);
  }, [activeAlg?.id, activeAlg?.viewPreferences?.preferredF2LSlot]);

  const handleSlotSelect = useCallback((slotId: number) => {
    setSelectedSlot(slotId);
    setResetCameraTrigger((previous) => previous + 1);

    // Slot orientation is a view preference of a custom algorithm, not part
    // of the canonical case state. Seed algorithms remain immutable.
    if (activeAlg?.isCustom && (slotId === 0 || slotId === 1 || slotId === 2 || slotId === 3)) {
      algorithmStore.getState().updateCustomAlgorithm(activeAlg.id, {
        viewPreferences: {
          ...activeAlg.viewPreferences,
          preferredF2LSlot: slotId as 0 | 1 | 2 | 3,
        },
      });
    }
  }, [activeAlg]);

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
    toast.success("Algorithm removed", {
      description: `${alg.moves.slice(0, 4).join(" ")}${alg.moves.length > 4 ? " …" : ""}`,
    });
  }, []);

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <>
      <div className={cn("flex min-h-0 flex-1 flex-col bg-surface", className)}>
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

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Slot Orientation Tabs (only for F2L / Advanced F2L) */}
          {isF2L && (
            <div>
              <label className="text-[0.62rem] font-medium uppercase tracking-[0.12em] text-ink-3 block mb-1.5">
                Slot Orientation
              </label>
              <div className="grid grid-cols-4 gap-1 rounded-lg border border-line bg-surface-2/40 p-1">
                {SLOT_LABELS.map((slot) => (
                  <button
                    key={slot.id}
                    onClick={() => handleSlotSelect(slot.id)}
                    className={cn(
                      "py-1 text-[0.65rem] font-medium rounded transition-colors text-center",
                      selectedSlot === slot.id
                        ? "bg-surface text-ink font-semibold shadow-xs"
                        : "text-ink-3 hover:text-ink-2",
                    )}
                  >
                    {slot.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 3D Isometric Cube Component */}
          <Case3DDiagram
            caseData={caseData}
            algorithm={activeAlg}
            selectedSlot={selectedSlot}
            resetCameraTrigger={resetCameraTrigger}
            className="max-w-60"
            showSetup
            interactive
          />

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

          {/* Practice button — inline in panel variant only */}
          {onPracticeCase && variant !== "overlay" && (
            <button
              onClick={() =>
                onPracticeCase(caseData.subsetId, caseData.id)
              }
              className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-[0.72rem] font-semibold text-surface hover:bg-ink/90 transition-colors w-full justify-center"
            >
              Practice this case
            </button>
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
}
