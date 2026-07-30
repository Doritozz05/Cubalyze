"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
import { CaseDiagram } from "./CaseDiagram";
import { Case3DDiagram } from "./Case3DDiagram";
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
        "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3.5",
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
        "group relative flex flex-col items-center gap-2 rounded-xl border p-3 transition-all duration-150 text-left w-full",
        isSelected
          ? "border-ink/30 bg-surface-2 ring-1 ring-ink/20 shadow-xs"
          : "border-line bg-surface hover:border-ink/15 hover:bg-surface-2/60",
      )}
    >
      {/* Diagram — supports 3D isometric & 2D top diagrams */}
      <div className="flex items-center justify-center w-full min-h-35 pt-1">
        {caseData.diagramType === "3d-isometric" || caseData.diagramType === "3d" ? (
          <Case3DDiagram caseData={caseData} className="w-full max-w-44" />
        ) : caseData.diagramType === "2d-top" && caseData.diagram2D ? (
          <CaseDiagram
            arrows={caseData.diagram2D.arrows}
            setupScramble={caseData.setupScramble}
            moves={algorithm?.moves}
            style={visualizationStyle ?? "full-color"}
            className="w-36"
          />
        ) : caseData.setupScramble ? (
          <Case3DDiagram caseData={caseData} className="w-full max-w-44" />
        ) : (
          <div className="w-36 h-36 flex items-center justify-center rounded-lg bg-surface-2">
            <span className="text-ink-3/40 text-[0.65rem]">No diagram</span>
          </div>
        )}
      </div>

      {/* Case info — algorithm moves primary, case number & name secondary */}
      <div className="flex flex-col items-center gap-0.5 w-full mt-1">
        {algorithm && (
          <span className="nums text-[0.75rem] font-semibold text-ink leading-tight text-center px-1">
            {algorithm.moves.join(" ")}
          </span>
        )}
        <span className="text-[0.65rem] font-medium text-ink-2 leading-tight">
          {caseData.caseNumber}
        </span>
        <span className="text-[0.58rem] text-ink-3 leading-tight text-center">
          {caseData.name}
        </span>
      </div>
    </button>
  );
}
