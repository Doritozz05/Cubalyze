"use client";

import { useState } from "react";
import { Copy, Check, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { CaseDiagram } from "@/views/Practice/components/CaseDiagram";
import { Case2x2Diagram } from "@/views/Practice/components/Case2x2Diagram";
import { Case3DDiagram } from "@/views/Practice/components/Case3DDiagram";
import { SUBSET_VISUALIZATION, getSubset } from "@cubeforge/algorithm-db";
import type { AlgorithmCase, Algorithm, VisualizationStyle } from "@cubeforge/algorithm-db";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface AlgorithmViewerCardProps {
  caseData: AlgorithmCase;
  algorithms: Algorithm[];
  subsetName?: string;
  className?: string;
}

export function AlgorithmViewerCard({
  caseData,
  algorithms,
  subsetName = "",
  className,
}: AlgorithmViewerCardProps) {
  const [copiedSetup, setCopiedSetup] = useState(false);
  const [copiedAlg, setCopiedAlg] = useState(false);
  const [selectedAlgId, setSelectedAlgId] = useState<string | null>(null);

  // Resolve canonical subset name from prop or from subset ID lookup
  const targetSubsetName =
    subsetName || getSubset(caseData.subsetId)?.name || "";

  // Determine forced visualization mode based on diagram type and subset name:
  // - OLL and PLL: 2D view
  // - F2L, PBL, and 3D isometric cases: 3D view
  const lowerSubsetName = targetSubsetName.toLowerCase();
  const is3DMode =
    caseData.diagramType === "3d-isometric" ||
    caseData.diagramType === "3d" ||
    lowerSubsetName.includes("f2l") ||
    lowerSubsetName.includes("pbl");

  const activeViewMode: "2d" | "3d" = is3DMode ? "3d" : "2d";

  const defaultAlg = algorithms.find((a) => a.isDefault) ?? algorithms[0];
  const activeAlg =
    algorithms.find((a) => a.id === selectedAlgId) ?? defaultAlg;

  // Fix: Use targetSubsetName to index SUBSET_VISUALIZATION (OLL -> yellow-gray, PLL -> full-color)
  const visStyle: VisualizationStyle =
    SUBSET_VISUALIZATION[targetSubsetName]?.style ??
    (lowerSubsetName.includes("oll") ? "yellow-gray" : "full-color");

  const handleCopySetup = () => {
    if (!caseData.setupScramble) return;
    navigator.clipboard.writeText(caseData.setupScramble);
    setCopiedSetup(true);
    setTimeout(() => setCopiedSetup(false), 2000);
  };

  const handleCopyAlg = () => {
    if (!activeAlg) return;
    const movesStr = activeAlg.moves.join(" ");
    navigator.clipboard.writeText(movesStr);
    setCopiedAlg(true);
    setTimeout(() => setCopiedAlg(false), 2000);
  };

  const movesText = activeAlg ? activeAlg.moves.join(" ") : "";

  return (
    <div className={cn("flex flex-col gap-2 text-ink", className)}>
      {/* ── Case Header Banner ── */}
      <div className="flex items-center justify-between gap-2 bg-surface-2/60 border border-line rounded-md px-2.5 py-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <Badge variant="outline" className="font-mono text-[11px] font-bold text-accent-cyan border-accent-cyan/40 bg-accent-cyan/10">
            {caseData.caseNumber}
          </Badge>
          {caseData.name && caseData.name !== caseData.caseNumber && (
            <span className="text-xs font-medium text-ink truncate">
              {caseData.name}
            </span>
          )}
        </div>
      </div>

      {/* ── Diagram Rendering Area ── */}
      <div className="relative flex justify-center items-center h-32 bg-surface-2/30 border border-line rounded-lg p-2 overflow-hidden">
        {activeViewMode === "2d" ? (
          caseData.puzzleType === '2x2x2' ? (
            <Case2x2Diagram
              faceletColors={caseData.diagram2D?.faceletColors}
              setupScramble={caseData.setupScramble}
              moves={activeAlg?.moves}
              style={visStyle}
              className="w-32 max-h-30"
            />
          ) : (
            <CaseDiagram
              setupScramble={caseData.setupScramble}
              moves={activeAlg?.moves}
              style={visStyle}
              arrows={caseData.diagram2D?.arrows}
              className="w-32 max-h-30"
            />
          )
        ) : (
          <Case3DDiagram
            caseData={caseData}
            interactive={true}
            className="w-full h-28"
          />
        )}
      </div>

      {/* ── Setup Scramble Section ── */}
      {caseData.setupScramble && (
        <div className="flex flex-col gap-1 bg-surface-2/40 border border-line rounded-md p-2">
          <div className="flex items-center justify-between text-[10px] font-medium text-ink-3">
            <span>Setup scramble</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCopySetup}
              className="h-5 px-1.5 text-[10px] text-ink-3 hover:text-accent-cyan gap-1"
            >
              {copiedSetup ? (
                <>
                  <Check className="size-3 text-accent-emerald" />
                  <span className="text-accent-emerald">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="size-3" />
                  <span>Copy</span>
                </>
              )}
            </Button>
          </div>
          <div className="font-mono text-[11px] text-ink-2 bg-surface-1 border border-line/60 rounded px-2 py-1 break-all select-all">
            {caseData.setupScramble}
          </div>
        </div>
      )}

      {/* ── Solution Algorithm Section ── */}
      <div className="flex flex-col gap-1.5 bg-surface-2/40 border border-line rounded-md p-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-medium text-ink-3">
            Algorithm
          </span>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCopyAlg}
            className="h-5 px-1.5 text-[10px] text-ink-3 hover:text-accent-cyan gap-1"
          >
            {copiedAlg ? (
              <>
                <Check className="size-3 text-accent-emerald" />
                <span className="text-accent-emerald">Copied</span>
              </>
            ) : (
              <>
                <Copy className="size-3" />
                <span>Copy</span>
              </>
            )}
          </Button>
        </div>

        {/* Algorithm moves container */}
        <div className="font-mono text-xs font-semibold text-accent-cyan bg-surface-1 border border-line rounded p-2 leading-relaxed wrap-break-word shadow-inner">
          {movesText || "No algorithm available"}
        </div>

        {/* Triggers */}
        {activeAlg?.triggers && activeAlg.triggers.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-[10px] text-ink-3 flex items-center gap-1">
              <Tag className="size-2.5" /> Triggers:
            </span>
            {activeAlg.triggers.map((trigger, idx) => (
              <Badge
                key={idx}
                variant="secondary"
                className="text-[9px] font-mono text-ink-2 px-1 py-0"
              >
                {trigger}
              </Badge>
            ))}
          </div>
        )}

        {/* Alternative Algorithms Tabs (if more than 1) */}
        {algorithms.length > 1 && (
          <div className="mt-1 pt-1.5 border-t border-line/60">
            <span className="text-[10px] text-ink-3 block mb-1 font-medium">
              Alternative algorithms ({algorithms.length}):
            </span>
            <div className="flex flex-wrap gap-1">
              {algorithms.map((alg, index) => {
                const isActive = activeAlg?.id === alg.id;
                return (
                  <Button
                    key={alg.id}
                    type="button"
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedAlgId(alg.id)}
                    className={cn(
                      "h-6 px-2 text-[10px] font-mono transition-all",
                      isActive
                        ? "bg-accent-cyan/20 text-accent-cyan border-accent-cyan/40 hover:bg-accent-cyan/30"
                        : "text-ink-3 hover:text-ink"
                    )}
                  >
                    Alg {index + 1}
                  </Button>
                );
              })}
            </div>
          </div>
        )}

        {/* Additional Case Info Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-line/40 text-[10px] text-ink-3">
          {caseData.probability && (
            <span>Probability: <strong className="text-ink-2 font-mono">{caseData.probability}</strong></span>
          )}
          {caseData.difficulty && (
            <span>Difficulty: <strong className="text-ink-2">{caseData.difficulty}</strong></span>
          )}
        </div>
      </div>
    </div>
  );
}

