"use client";

import { memo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { METHODS, getSubsetsForMethod, getChildSubsets } from "@cubeforge/algorithm-db";
import type { AlgorithmMethod, AlgorithmSubset } from "@cubeforge/algorithm-db";

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
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <div className="px-3 py-2">
        <span className="text-[0.62rem] font-medium uppercase tracking-[0.15em] text-ink-3/60">
          Methods
        </span>
      </div>

      {METHODS.map((method) => (
        <MethodNode
          key={method.id}
          method={method}
          selectedSubsetId={selectedSubsetId}
          onSelectSubset={onSelectSubset}
        />
      ))}
    </div>
  );
});

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
          "flex items-center gap-2 px-3 py-1.5 text-[0.72rem] font-medium transition-colors",
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
      <div className="ml-3 border-l border-line/50 pl-3">
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
            "flex items-center gap-1 px-2 py-1 text-[0.7rem] rounded cursor-pointer transition-colors font-medium",
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
          <div className="ml-3 border-l border-line/40 pl-2.5 space-y-0.5 mt-0.5">
            {children.map((child) => (
              <button
                key={child.id}
                onClick={() => onSelectSubset(child.id)}
                className={cn(
                  "block w-full text-left px-2 py-1 text-[0.68rem] rounded transition-colors",
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
        "block w-full text-left px-2 py-1 text-[0.7rem] rounded transition-colors",
        isSelected
          ? "bg-surface-2 text-ink font-medium"
          : "text-ink-3 hover:text-ink-2 hover:bg-surface-2/50",
      )}
    >
      {subset.name}
    </button>
  );
}
