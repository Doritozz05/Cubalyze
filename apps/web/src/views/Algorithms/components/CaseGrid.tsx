"use client";

import { memo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { CaseDiagram } from "./CaseDiagram";
import { Case2x2Diagram } from "./Case2x2Diagram";
import { Case3DDiagram } from "./Case3DDiagram";
import { useCaseAlgorithms } from "@/hooks/useCaseAlgorithms";
import { resolveAlgorithmDiagramRotation } from "@cubalyze/algorithm-db";
import type { AlgorithmCase, VisualizationStyle } from "@cubalyze/algorithm-db";

export interface CaseGridProps {
  cases: AlgorithmCase[];
  selectedCaseId: string | null;
  onSelectCase: (caseId: string) => void;
  /** Visualization style for dynamic diagram generation (default: 'full-color'). */
  visualizationStyle?: VisualizationStyle;
  className?: string;
}

export const CaseGrid = memo(function CaseGrid({
  cases,
  selectedCaseId,
  onSelectCase,
  visualizationStyle,
  className,
}: CaseGridProps) {
  const { t } = useTranslation("algorithms");

  if (cases.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <span className="text-ink-3/40 text-[0.8rem]">{t("noCasesInSubset")}</span>
        <span className="text-ink-3/30 text-[0.65rem]">
          {t("selectSubsetFromLeft")}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        // Touch (<768px): always 2 compact columns; desktop keeps its
        // lg/xl column counts untouched.
        "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 max-lg:grid-cols-2 gap-3.5 max-lg:gap-3",
        className,
      )}
    >
      {cases.map((c) => {
        const isSelected = c.id === selectedCaseId;

        return (
          <CaseCard
            key={c.id}
            caseData={c}
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
  isSelected,
  onClick,
  visualizationStyle,
}: {
  caseData: AlgorithmCase;
  isSelected: boolean;
  onClick: () => void;
  visualizationStyle?: VisualizationStyle;
}) {
  // Reactive subscription: re-renders when custom algorithms or ordering
  // change, so the grid reflects saved orientations without a reload.
  const { t } = useTranslation("algorithms");
  const { algorithms } = useCaseAlgorithms(caseData.id);
  const algorithm = algorithms[0] ?? null;

  return (
    <button
      onClick={onClick}
      data-slot="card"
      data-glass-panel
      className={cn(
        "group relative flex flex-col items-center gap-2 rounded-xl border p-3 transition-all duration-150 text-left w-full",
        // Touch: compact cards so 2 columns fit on 360px screens.
        "max-lg:p-2.5 max-lg:gap-1.5",
        isSelected
          ? "border-ink/30 bg-surface-2 ring-1 ring-ink/20 shadow-xs"
          : "border-line bg-surface hover:border-ink/15 hover:bg-surface-2",
      )}
    >
      {/* Diagram — supports 3D isometric & 2D top diagrams */}
      <div className="flex items-center justify-center w-full min-h-35 max-lg:min-h-30 pt-1">
        {caseData.diagramType === "3d-isometric" || caseData.diagramType === "3d" ? (
          <Case3DDiagram caseData={caseData} algorithm={algorithm} className="w-full max-w-44 max-lg:max-w-36" />
        ) : caseData.diagramType === "2d-top" || caseData.diagram2D ? (
          caseData.puzzleType === '222' ? (
            <Case2x2Diagram
              faceletColors={caseData.diagram2D?.faceletColors}
              setupScramble={caseData.setupScramble}
              moves={undefined}
              style={visualizationStyle ?? "full-color"}
              rotation={resolveAlgorithmDiagramRotation(algorithm)}
              className="w-36"
            />
          ) : (
            <CaseDiagram
              arrows={caseData.diagram2D?.arrows}
              setupScramble={caseData.setupScramble}
              moves={undefined}
              style={visualizationStyle ?? "full-color"}
              rotation={resolveAlgorithmDiagramRotation(algorithm)}
              className="w-36"
            />
          )
        ) : caseData.setupScramble ? (
          <Case3DDiagram caseData={caseData} algorithm={algorithm} className="w-full max-w-44 max-lg:max-w-36" />
        ) : (
          <div className="w-36 h-36 flex items-center justify-center rounded-lg bg-surface-2">
            <span className="text-ink-3/40 text-[0.65rem]">{t("noDiagram")}</span>
          </div>
        )}
      </div>

      {/* Case info — algorithm moves primary, case number & name secondary */}
      <div className="flex flex-col items-center gap-0.5 w-full mt-1">
        {algorithm && (
          <span className="nums text-[0.75rem] font-semibold text-ink leading-tight text-center px-1 wrap-break-word max-w-full">
            {algorithm.moves.join(" ")}
          </span>
        )}
        <span className="text-[0.65rem] font-medium text-ink-2 leading-tight">
          {caseData.caseNumber}
        </span>
        {caseData.name && caseData.name !== caseData.caseNumber && (
          <span className="text-[0.58rem] text-ink-3 leading-tight text-center">
            {caseData.name}
          </span>
        )}
      </div>
    </button>
  );
}
