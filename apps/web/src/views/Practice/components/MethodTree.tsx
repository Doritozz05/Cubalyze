"use client";

import { memo, useState, useMemo } from "react";
import { ChevronRight, ChevronDown, Box } from "lucide-react";
import { cn } from "@/lib/utils";
import { METHODS, getSubsetsForMethod, getChildSubsets } from "@cubeforge/algorithm-db";
import type { AlgorithmMethod, AlgorithmSubset } from "@cubeforge/algorithm-db";

// ── Puzzle type grouping ──────────────────────────────────────────────────

type PuzzleTypeKey = '3x3x3' | '2x2x2';

const PUZZLE_LABELS: Record<PuzzleTypeKey, { label: string; icon: React.ElementType }> = {
  '3x3x3': { label: '3×3', icon: Box },
  '2x2x2': { label: '2×2', icon: Box },
};

const PUZZLE_ORDER: PuzzleTypeKey[] = ['3x3x3', '2x2x2'];

export interface MethodTreeProps {
  selectedSubsetId: string | null;
  onSelectSubset: (subsetId: string) => void;
  className?: string;
}

export const MethodTree = memo(function MethodTree({
  selectedSubsetId,
  onSelectSubset,
  className,
}: MethodTreeProps) {
  // Group methods by puzzle type
  const puzzleGroups = useMemo(() => {
    const groups = new Map<PuzzleTypeKey, AlgorithmMethod[]>();
    for (const m of METHODS) {
      const pt = (m.puzzleType as PuzzleTypeKey) ?? '3x3x3';
      if (!groups.has(pt)) groups.set(pt, []);
      groups.get(pt)!.push(m);
    }
    return PUZZLE_ORDER
      .filter((pt) => groups.has(pt))
      .map((pt) => ({ puzzleType: pt, methods: groups.get(pt)! }));
  }, []);

  // Track which puzzle sections are expanded
  const [expandedPuzzles, setExpandedPuzzles] = useState<Set<PuzzleTypeKey>>(
    () => new Set<PuzzleTypeKey>(['3x3x3'])
  );

  const togglePuzzle = (pt: PuzzleTypeKey) => {
    setExpandedPuzzles((prev) => {
      const next = new Set(prev);
      if (next.has(pt)) next.delete(pt);
      else next.add(pt);
      return next;
    });
  };

  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <div className="px-3 py-2">
        <span className="text-[0.62rem] font-medium uppercase tracking-[0.15em] text-ink-3/60">
          Methods
        </span>
      </div>

      {puzzleGroups.map(({ puzzleType, methods }) => {
        const PuzzleIcon = PUZZLE_LABELS[puzzleType]?.icon ?? Box;
        const isExpanded = expandedPuzzles.has(puzzleType);
        const hasSelected = methods.some((m) => {
          const subsets = getSubsetsForMethod(m.id);
          return subsets.some((s) => {
            if (s.id === selectedSubsetId) return true;
            return getChildSubsets(s.id).some((c) => c.id === selectedSubsetId);
          });
        });

        return (
          <div key={puzzleType}>
            {/* Puzzle type header — collapsible */}
            <button
              type="button"
              onClick={() => togglePuzzle(puzzleType)}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-1.5 text-[0.72rem] font-semibold transition-colors hover:bg-surface-2/50 rounded",
                hasSelected ? "text-accent-cyan" : "text-ink",
              )}
            >
              {isExpanded ? (
                <ChevronDown className="size-3.5 shrink-0 text-ink-3" />
              ) : (
                <ChevronRight className="size-3.5 shrink-0 text-ink-3" />
              )}
              <PuzzleIcon className="size-3.5 shrink-0 text-ink-3" />
              <span>{PUZZLE_LABELS[puzzleType]?.label ?? puzzleType}</span>
              <span className="text-[0.6rem] text-ink-4 ml-auto tabular-nums">
                {methods.length}
              </span>
            </button>

            {/* Methods under this puzzle type */}
            {isExpanded && (
              <div className="ml-2 border-l border-line/40 pl-2">
                {methods.map((method) => (
                  <MethodNode
                    key={method.id}
                    method={method}
                    selectedSubsetId={selectedSubsetId}
                    onSelectSubset={onSelectSubset}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});

// ── Method node (unchanged logic, just wrapped) ────────────────────────────

function MethodNode({
  method,
  selectedSubsetId,
  onSelectSubset,
}: {
  method: AlgorithmMethod;
  selectedSubsetId: string | null;
  onSelectSubset: (subsetId: string) => void;
}) {
  const subsets = getSubsetsForMethod(method.id);
  const hasSelected = subsets.some((s) => {
    if (s.id === selectedSubsetId) return true;
    const children = getChildSubsets(s.id);
    return children.some((c) => c.id === selectedSubsetId);
  });

  return (
    <div>
      {/* Method header */}
      <div
        className={cn(
          "flex items-center gap-2 px-2 py-1 text-[0.7rem] font-medium transition-colors",
          hasSelected ? "text-ink" : "text-ink-2",
        )}
      >
        <ChevronRight
          className={cn(
            "size-3 shrink-0 transition-transform",
            hasSelected && "rotate-90",
          )}
        />
        {method.name}
      </div>

      {/* Subsets */}
      <div className="ml-2 border-l border-line/40 pl-2.5">
        {subsets
          .filter((s) => s.sortOrder > 0) // Only show subsets with content
          .map((subset) => (
            <SubsetItem
              key={subset.id}
              subset={subset}
              selectedSubsetId={selectedSubsetId}
              onSelectSubset={onSelectSubset}
            />
          ))}
      </div>
    </div>
  );
}

function SubsetItem({
  subset,
  selectedSubsetId,
  onSelectSubset,
}: {
  subset: AlgorithmSubset;
  selectedSubsetId: string | null;
  onSelectSubset: (subsetId: string) => void;
}) {
  const children = getChildSubsets(subset.id);
  const isParent = children.length > 0;
  const hasSelectedChild = children.some((c) => c.id === selectedSubsetId);
  const [expanded, setExpanded] = useState(hasSelectedChild);

  if (isParent) {
    return (
      <div className="my-0.5">
        <div
          onClick={() => setExpanded(!expanded)}
          className={cn(
            "flex items-center gap-1 px-2 py-1 text-[0.68rem] rounded cursor-pointer transition-colors font-medium",
            hasSelectedChild || subset.id === selectedSubsetId
              ? "text-ink"
              : "text-ink-2 hover:text-ink hover:bg-surface-2/50",
          )}
        >
          <ChevronRight
            className={cn(
              "size-3 shrink-0 transition-transform text-ink-3",
              expanded && "rotate-90",
            )}
          />
          <span>{subset.name}</span>
        </div>

        {expanded && (
          <div className="ml-2.5 border-l border-line/30 pl-2 space-y-0.5 mt-0.5">
            {children.map((child) => (
              <button
                key={child.id}
                onClick={() => onSelectSubset(child.id)}
                className={cn(
                  "block w-full text-left px-2 py-1 text-[0.65rem] rounded transition-colors",
                  child.id === selectedSubsetId
                    ? "bg-surface-2 text-ink font-semibold"
                    : "text-ink-3 hover:text-ink-2 hover:bg-surface-2/50",
                )}
              >
                {child.name}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  const isSelected = subset.id === selectedSubsetId;
  return (
    <button
      onClick={() => onSelectSubset(subset.id)}
      className={cn(
        "block w-full text-left px-2 py-1 text-[0.68rem] rounded transition-colors",
        isSelected
          ? "bg-surface-2 text-ink font-medium"
          : "text-ink-3 hover:text-ink-2 hover:bg-surface-2/50",
      )}
    >
      {subset.name}
    </button>
  );
}
