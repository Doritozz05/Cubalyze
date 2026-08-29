"use client";

import type { DetectedCase } from "@cubeforge/types";
import {
  getSubset,
  resolveVisualizationStyleForSubset,
  type AlgorithmCase,
} from "@cubeforge/algorithm-db";
import { CaseDiagram } from "@/views/Algorithms/components/CaseDiagram";
import { aufRotationDeg } from "./caseHelpers";

/** Last layer 2D rotated case diagram */
export function LastLayerCaseCell({
  detectedCase,
  casesByNumber,
}: {
  detectedCase: DetectedCase;
  casesByNumber: Map<string, AlgorithmCase>;
}) {
  const caseData =
    casesByNumber.get(detectedCase.caseNumber) ??
    casesByNumber.get(detectedCase.caseName);
  if (!caseData) return null;
  const subset = getSubset(caseData.subsetId);
  const style = resolveVisualizationStyleForSubset(subset?.name);
  const rotation = aufRotationDeg(detectedCase.aufFace);

  return (
    <span className="flex min-w-0 items-center gap-2">
      <CaseDiagram
        setupScramble={caseData.setupScramble}
        style={style}
        rotation={rotation}
        className="size-8 sm:size-10 shrink-0 rounded-md border border-line bg-surface-2/40"
      />
      <span className="flex min-w-0 flex-col">
        <span className="text-[0.74rem] font-medium text-ink truncate">
          {detectedCase.caseName}
        </span>
        <span className="mt-0.5 text-[0.56rem] text-ink-3 font-mono">
          {detectedCase.caseNumber}
        </span>
      </span>
    </span>
  );
}
