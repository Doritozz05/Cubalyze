"use client";

import { Pencil, Trash2, Sparkles, GripVertical, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Algorithm } from "@cubeforge/algorithm-db";

// ──────────────────────────────────────────────────────────────────────────────
// SortableAlgorithmItem — reusable drag-and-drop algorithm card
// ──────────────────────────────────────────────────────────────────────────────

export interface SortableAlgorithmItemProps {
  alg: Algorithm;
  isSelected: boolean;
  isPrimary: boolean;
  is2x2: boolean;
  subsetId: string;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function SortableAlgorithmItem({
  alg,
  isSelected,
  isPrimary,
  is2x2,
  subsetId,
  onSelect,
  onEdit,
  onDelete,
}: SortableAlgorithmItemProps) {
  const isCustom = alg.isCustom === true;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: alg.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={cn(
        "group flex gap-2 rounded-lg border p-2.5 cursor-pointer transition-colors relative",
        isSelected
          ? "border-ink bg-surface-2 ring-1 ring-ink/20 shadow-xs"
          : "border-line bg-surface hover:border-ink/15 hover:bg-surface-2/60",
        isDragging && "shadow-lg z-10",
      )}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="shrink-0 grid place-items-center self-start mt-0.5 text-ink-3/30 hover:text-ink-2 transition-colors cursor-grab active:cursor-grabbing touch-none"
        aria-label="Drag to reorder"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="size-3.5" />
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className={cn("flex items-center gap-2", isPrimary && "pr-14")}>
          <div className="nums flex flex-wrap gap-x-1.5 gap-y-0.5 text-[0.75rem] font-medium text-ink">
            {alg.moves.map((move, i) => (
              <span key={i}>{move}</span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 text-[0.58rem] text-ink-3 flex-wrap">
          <span>HTM: {alg.moveCount.htm}</span>
          <span>QTM: {alg.moveCount.qtm}</span>
          {!is2x2 && alg.moveCount.stm > 0 && (
            <span>STM: {alg.moveCount.stm}</span>
          )}

          {isCustom && (
            <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 px-1.5 py-0.5 text-[0.6rem] font-medium text-ink-2">
              <Sparkles className="size-2" />
              custom
            </span>
          )}

          {alg.source && !isCustom && (
            <AlgorithmSourceLink alg={alg} subsetId={subsetId} />
          )}

          {isCustom && (
            <span className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                className="grid size-4 place-items-center rounded text-ink-3 hover:text-ink hover:bg-surface-2 transition-colors"
                title="Edit algorithm"
              >
                <Pencil className="size-2.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="grid size-4 place-items-center rounded text-ink-3 hover:text-dnf hover:bg-dnf/5 transition-colors"
                title="Delete algorithm"
              >
                <Trash2 className="size-2.5" />
              </button>
            </span>
          )}
        </div>

        {alg.notes && (
          <p className="text-[0.65rem] text-ink-3/70 mt-0.5">{alg.notes}</p>
        )}
      </div>

      {isPrimary && (
        <div className="absolute top-2 right-2">
          <span className="inline-flex items-center gap-0.5 rounded-full bg-ink px-1.5 py-0.5 text-[0.6rem] font-semibold text-surface leading-none">
            primary
          </span>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// AlgorithmSourceLink — external link to SpeedCubeDB or source URL
// ──────────────────────────────────────────────────────────────────────────────

export function AlgorithmSourceLink({
  alg,
  subsetId,
}: {
  alg: Algorithm;
  subsetId: string;
}) {
  const sourceUrl =
    alg.attributionUrl ||
    (alg.source?.startsWith("http")
      ? alg.source
      : alg.source?.toLowerCase().includes("speedcubedb")
        ? subsetId.toLowerCase().includes("oll")
          ? "https://speedcubedb.com/a/3x3/OLL"
          : subsetId.toLowerCase().includes("pll")
            ? "https://speedcubedb.com/a/3x3/PLL"
            : subsetId.toLowerCase().includes("f2l")
              ? "https://speedcubedb.com/a/3x3/F2L"
              : "https://speedcubedb.com"
        : undefined);

  if (!sourceUrl) {
    return (
      <span className="flex items-center gap-1">
        <ExternalLink className="size-2.5" />
        {alg.source ?? "Unknown source"}
      </span>
    );
  }

  return (
    <a
      href={sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1 hover:underline hover:text-ink transition-colors"
      onClick={(e) => e.stopPropagation()}
    >
      <ExternalLink className="size-2.5" />
      {alg.source ?? "Source"}
    </a>
  );
}
