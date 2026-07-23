"use client";

import { memo } from "react";
import { X, Check, ExternalLink, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { CaseDiagram } from "./CaseDiagram";
import type { AlgorithmCase, Algorithm, VisualizationStyle } from "@cubeforge/algorithm-db";

export interface CaseDetailPanelProps {
  caseData: AlgorithmCase;
  algorithms: Algorithm[];
  onClose: () => void;
  /** Visualisation style for dynamic diagram generation (default: 'full-color'). */
  visualizationStyle?: VisualizationStyle;
  /** Called when the user wants to practice this case in the Training tab. */
  onPracticeCase?: (subsetId: string, caseId: string) => void;
  className?: string;
}

export const CaseDetailPanel = memo(function CaseDetailPanel({
  caseData,
  algorithms,
  onClose,
  visualizationStyle,
  onPracticeCase,
  className,
}: CaseDetailPanelProps) {
  const defaultAlg = algorithms.find((a) => a.isDefault) ?? algorithms[0];

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      {/* Header */}
      <div className="flex items-center justify-between shrink-0 px-4 py-3 border-b border-line">
        <div className="flex items-center gap-2">
          <span className="nums text-[0.85rem] font-semibold text-ink">
            {caseData.caseNumber}
          </span>
          <span className="text-[0.75rem] text-ink-2">{caseData.name}</span>

        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-ink-3 hover:bg-surface-2 hover:text-ink transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {/* Diagram */}
        {caseData.diagramType === "2d-top" && caseData.diagram2D && (
          <div className="flex justify-center">
            <CaseDiagram
              arrows={caseData.diagram2D.arrows}
              setupScramble={caseData.setupScramble}
              moves={defaultAlg?.moves}
              style={visualizationStyle ?? "full-color"}
              className="w-48"
            />
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
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-ink-3/40" />
                  {pattern}
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
            <p className="text-[0.72rem] text-ink-2">{caseData.probability}</p>
          </div>
        )}

        {/* Algorithms */}
        <div>
          <h4 className="text-[0.65rem] font-medium uppercase tracking-[0.12em] text-ink-3 mb-2">
            Algorithms ({algorithms.length})
          </h4>
          <div className="space-y-2">
            {algorithms.map((alg) => (
              <div
                key={alg.id}
                className={cn(
                  "flex flex-col gap-1 rounded-lg border p-2.5 transition-colors",
                  alg.isDefault
                    ? "border-ink/15 bg-surface-2"
                    : "border-line bg-surface hover:border-ink/10",
                )}
              >
                {/* Move display */}
                <div className="flex items-center gap-2">
                  <div className="nums flex flex-wrap gap-x-1.5 gap-y-0.5 text-[0.75rem] font-medium text-ink">
                    {alg.moves.map((move, i) => (
                      <span key={i}>{move}</span>
                    ))}
                  </div>
                  {alg.isDefault && (
                    <Check className="size-3.5 text-ready shrink-0" />
                  )}
                </div>

                {/* Metadata row */}
                <div className="flex items-center gap-3 text-[0.58rem] text-ink-3">
                  <span>HTM: {alg.moveCount.htm}</span>
                  <span>QTM: {alg.moveCount.qtm}</span>
                  {alg.moveCount.stm > 0 && <span>STM: {alg.moveCount.stm}</span>}
                  {alg.source && (
                    <span className="flex items-center gap-1">
                      <ExternalLink className="size-2.5" />
                      {alg.source}
                    </span>
                  )}
                </div>

                {/* Notes */}
                {alg.notes && (
                  <p className="text-[0.65rem] text-ink-3/70 mt-0.5">
                    {alg.notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Practice this case button — navigates to Training */}
        {onPracticeCase && (
          <button
            onClick={() => onPracticeCase(caseData.subsetId, caseData.id)}
            className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-[0.72rem] font-semibold text-surface hover:bg-ink/90 transition-colors w-full justify-center"
          >
            <Play className="size-3.5" />
            Practice This Case
          </button>
        )}

        {/* Setup scramble */}
        {caseData.setupScramble && (
          <div>
            <h4 className="text-[0.65rem] font-medium uppercase tracking-[0.12em] text-ink-3 mb-1">
              Setup Scramble
            </h4>
            <p className="nums text-[0.68rem] text-ink-2/80 bg-surface-2 rounded px-2 py-1.5">
              {caseData.setupScramble}
            </p>
          </div>
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
    </div>
  );
});
