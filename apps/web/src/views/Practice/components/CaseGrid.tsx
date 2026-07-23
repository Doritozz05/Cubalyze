"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
import { CaseDiagram } from "./CaseDiagram";
import type { AlgorithmCase, Algorithm, VisualizationStyle } from "@cubeforge/algorithm-db";

export interface CaseGridProps {
  cases: AlgorithmCase[];
  algorithms: Algorithm[];
  selectedCaseId: string | null;
  onSelectCase: (caseId: string) => void;
  /** Visualization style for dynamic diagram generation (default: 'full-color'). */
  visualizationStyle?: VisualizationStyle;
  className?: string;
}

export const CaseGrid = memo(function CaseGrid({
  cases,
  algorithms,
  selectedCaseId,
  onSelectCase,
  visualizationStyle,
  className,
}: CaseGridProps) {
  if (cases.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <span className="text-ink-3/40 text-[0.8rem]">No cases in this subset</span>
        <span className="text-ink-3/30 text-[0.65rem]">
          Select a subset from the left panel
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5",
        className,
      )}
    >
      {cases.map((c) => {
        const isSelected = c.id === selectedCaseId;
        const caseAlgs = algorithms.filter((a) => a.caseId === c.id);
        const defaultAlg = caseAlgs.find((a) => a.isDefault) ?? caseAlgs[0];

        return (
          <CaseCard
            key={c.id}
            caseData={c}
            algorithm={defaultAlg}
            isSelected={isSelected}
            onClick={() => onSelectCase(c.id)}
            visualizationStyle={visualizationStyle}
          />
        );
      })}
    </div>
  );
});

function CaseCard({
  caseData,
  algorithm,
  isSelected,
  onClick,
  visualizationStyle,
}: {
  caseData: AlgorithmCase;
  algorithm?: Algorithm;
  isSelected: boolean;
  onClick: () => void;
  visualizationStyle?: VisualizationStyle;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative flex flex-col items-center gap-1.5 rounded-lg border p-2.5 transition-all duration-150",
        isSelected
          ? "border-ink/30 bg-surface-2 ring-1 ring-ink/20"
          : "border-line bg-surface hover:border-ink/15 hover:bg-surface-2/60",
      )}
    >


      {/* Diagram */}
      <div className="flex items-center justify-center w-full pt-1">
        {caseData.diagramType === "2d-top" && caseData.diagram2D ? (
          <CaseDiagram
            arrows={caseData.diagram2D.arrows}
            moves={algorithm?.moves}
            style={visualizationStyle ?? "full-color"}
            className="w-24"
          />
        ) : (
          <div className="w-24 h-24 flex items-center justify-center rounded bg-surface-2">
            <span className="text-ink-3/40 text-[0.6rem]">No diagram</span>
          </div>
        )}
      </div>

      {/* Case info — algorithm is the main element */}
      <div className="flex flex-col items-center gap-0.5 w-full">
        {/* Algorithm moves — primary visual element, large & prominent */}
        {algorithm && (
          <span className="nums text-[0.68rem] font-semibold text-ink leading-tight text-center px-1">
            {algorithm.moves.join(" ")}
          </span>
        )}
        {/* Case identifier — secondary */}
        <span className="text-[0.62rem] font-medium text-ink-2 leading-tight">
          {caseData.caseNumber}
        </span>
        <span className="text-[0.55rem] text-ink-3 leading-tight text-center">
          {caseData.name}
        </span>
      </div>
    </button>
  );
}
