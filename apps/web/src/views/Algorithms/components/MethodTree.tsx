"use client";

import { memo, useState, useEffect, useMemo, useCallback } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { METHODS, getSubsetsForMethod, getChildSubsets } from "@cubeforge/algorithm-db";
import type { AlgorithmMethod, AlgorithmSubset } from "@cubeforge/algorithm-db";

// ── Puzzle type grouping ──────────────────────────────────────────────────

type PuzzleTypeKey = '3x3x3' | '2x2x2';

const PUZZLE_LABELS: Record<PuzzleTypeKey, string> = {
  '3x3x3': '3×3',
  '2x2x2': '2×2',
};

const PUZZLE_ORDER: PuzzleTypeKey[] = ['3x3x3', '2x2x2'];

// ── Public API ─────────────────────────────────────────────────────────────

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

  // ── State: which puzzle sections are expanded ──────────────────────────
  const [expandedPuzzles, setExpandedPuzzles] = useState<Set<PuzzleTypeKey>>(
    () => new Set<PuzzleTypeKey>(['3x3x3']),
  );

  // ── State: which methods are expanded (collapsible) ────────────────────
  const [expandedMethods, setExpandedMethods] = useState<Set<string>>(() => new Set<string>());

  // Auto-expand the method that contains the selected subset
  const findMethodForSubset = useCallback(
    (subsetId: string): string | null => {
      for (const m of METHODS) {
        const subsets = getSubsetsForMethod(m.id);
        for (const s of subsets) {
          if (s.id === subsetId) return m.id;
          const children = getChildSubsets(s.id);
          if (children.some((c) => c.id === subsetId)) return m.id;
        }
      }
      return null;
    },
    [],
  );

  useEffect(() => {
    if (!selectedSubsetId) return;
    const methodId = findMethodForSubset(selectedSubsetId);
    if (methodId) {
      setExpandedMethods((prev) => {
        if (prev.has(methodId)) return prev;
        const next = new Set(prev);
        next.add(methodId);
        return next;
      });
      // Also expand the puzzle section
      for (const m of METHODS) {
        if (m.id === methodId) {
          const pt = (m.puzzleType as PuzzleTypeKey) ?? '3x3x3';
          setExpandedPuzzles((prev) => {
            if (prev.has(pt)) return prev;
            const next = new Set(prev);
            next.add(pt);
            return next;
          });
          break;
        }
      }
    }
  }, [selectedSubsetId, findMethodForSubset]);

  const togglePuzzle = (pt: PuzzleTypeKey) => {
    setExpandedPuzzles((prev) => {
      const next = new Set(prev);
      if (next.has(pt)) next.delete(pt);
      else next.add(pt);
      return next;
    });
  };

  const toggleMethod = (methodId: string) => {
    setExpandedMethods((prev) => {
      const next = new Set(prev);
      if (next.has(methodId)) next.delete(methodId);
      else next.add(methodId);
      return next;
    });
  };

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Section label */}
      <div className="px-3 pt-2.5 pb-1.5">
        <span className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-ink-3/50">
          Methods
        </span>
      </div>

      {puzzleGroups.map(({ puzzleType, methods }) => {
        const isExpanded = expandedPuzzles.has(puzzleType);
        const puzzleLabel = PUZZLE_LABELS[puzzleType] ?? puzzleType;

        return (
          <div key={puzzleType}>
            {/* Puzzle type header — collapsible */}
            <button
              type="button"
              onClick={() => togglePuzzle(puzzleType)}
              className={cn(
                "flex w-full items-center gap-1.5 px-3 py-1.5 text-[0.72rem] font-medium transition-colors",
                "hover:bg-surface-2/40 rounded-sm",
                "text-ink",
              )}
            >
              <ChevronRight
                className={cn(
                  "size-3.5 shrink-0 text-ink-3/60 transition-transform duration-150",
                  isExpanded && "rotate-90",
                )}
              />
              <span>{puzzleLabel}</span>
            </button>

            {/* Methods under this puzzle type */}
            {isExpanded && (
              <div className="ml-4">
                {methods.map((method) => (
                  <CollapsibleMethodNode
                    key={method.id}
                    method={method}
                    isExpanded={expandedMethods.has(method.id)}
                    onToggle={() => toggleMethod(method.id)}
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

// ── Collapsible method node ────────────────────────────────────────────────

function CollapsibleMethodNode({
  method,
  isExpanded,
  onToggle,
  selectedSubsetId,
  onSelectSubset,
}: {
  method: AlgorithmMethod;
  isExpanded: boolean;
  onToggle: () => void;
  selectedSubsetId: string | null;
  onSelectSubset: (subsetId: string) => void;
}) {
  const subsets = getSubsetsForMethod(method.id);
  const visibleSubsets = subsets.filter((s) => s.sortOrder > 0);

  // Check if any subset (or child of subset) under this method is selected
  const hasSelected = subsets.some((s) => {
    if (s.id === selectedSubsetId) return true;
    return getChildSubsets(s.id).some((c) => c.id === selectedSubsetId);
  });

  return (
    <div>
      {/* Method header — collapsible toggle */}
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex w-full items-center gap-1.5 px-2 py-1 text-[0.7rem] font-medium transition-colors",
          "hover:bg-surface-2/30 rounded-sm",
          hasSelected ? "text-ink" : "text-ink-2",
        )}
      >
        <ChevronRight
          className={cn(
            "size-3 shrink-0 text-ink-3/50 transition-transform duration-150",
            isExpanded && "rotate-90",
          )}
        />
        <span>{method.name}</span>
        {!isExpanded && hasSelected && (
          <span className="ml-auto text-[0.6rem] text-ink-3/40 truncate max-w-[40%]">
            {findSelectedSubsetName(method.id, selectedSubsetId)}
          </span>
        )}
      </button>

      {/* Subsets (only visible when expanded) */}
      {isExpanded && (
        <div className="ml-3.5">
          {visibleSubsets.map((subset) => (
            <SubsetItem
              key={subset.id}
              subset={subset}
              selectedSubsetId={selectedSubsetId}
              onSelectSubset={onSelectSubset}
              depth={1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Subset item (recursive for children) ────────────────────────────────────

function SubsetItem({
  subset,
  selectedSubsetId,
  onSelectSubset,
  depth,
}: {
  subset: AlgorithmSubset;
  selectedSubsetId: string | null;
  onSelectSubset: (subsetId: string) => void;
  depth: number;
}) {
  const children = getChildSubsets(subset.id);
  const isParent = children.length > 0;
  const hasSelectedChild = children.some((c) => c.id === selectedSubsetId);
  const [expanded, setExpanded] = useState(
    () => hasSelectedChild || (isParent && depth === 0),
  );

  // Sync: auto-expand when a child is selected externally (command palette, URL)
  useEffect(() => {
    if (hasSelectedChild) setExpanded(true);
  }, [hasSelectedChild]);

  if (isParent) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className={cn(
            "flex w-full items-center gap-1 px-2 py-1 text-[0.68rem] font-medium transition-colors rounded-sm",
            "hover:bg-surface-2/30",
            hasSelectedChild || subset.id === selectedSubsetId
              ? "text-ink"
              : "text-ink-2",
          )}
        >
          <ChevronRight
            className={cn(
              "size-3 shrink-0 text-ink-3/40 transition-transform duration-150",
              expanded && "rotate-90",
            )}
          />
          <span>{subset.name}</span>
        </button>

        {expanded && (
          <div className="ml-3">
            {children.map((child) => (
              <SubsetItem
                key={child.id}
                subset={child}
                selectedSubsetId={selectedSubsetId}
                onSelectSubset={onSelectSubset}
                depth={depth + 1}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Leaf subset — clickable to select
  const isSelected = subset.id === selectedSubsetId;
  return (
    <button
      type="button"
      onClick={() => onSelectSubset(subset.id)}
      className={cn(
        "block w-full text-left px-2 py-1 text-[0.68rem] rounded-sm transition-colors",
        isSelected
          ? "bg-ink text-surface font-semibold shadow-xs"
          : "text-ink-3 hover:text-ink hover:bg-surface-2/60",
      )}
    >
      {subset.name}
    </button>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Find the name of the selected subset under a given method. */
function findSelectedSubsetName(
  methodId: string,
  selectedSubsetId: string | null,
): string {
  if (!selectedSubsetId) return "";
  const subsets = getSubsetsForMethod(methodId);
  for (const s of subsets) {
    if (s.id === selectedSubsetId) return s.name;
    const children = getChildSubsets(s.id);
    const match = children.find((c) => c.id === selectedSubsetId);
    if (match) return `${s.name} · ${match.name}`;
  }
  return "";
}
