"use client";

import { useState } from "react";
import { X, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Case3DDiagram } from "./Case3DDiagram";
import type { AlgorithmCase, Algorithm } from "@cubeforge/algorithm-db";

export interface Case3DPanelProps {
  caseData: AlgorithmCase;
  algorithms: Algorithm[];
  onClose: () => void;
  onPracticeCase?: (subsetId: string, caseId: string) => void;
  className?: string;
}

const SLOT_LABELS = [
  { id: 0, key: "FR", name: "Front Right" },
  { id: 1, key: "FL", name: "Front Left" },
  { id: 2, key: "BL", name: "Back Left" },
  { id: 3, key: "BR", name: "Back Right" },
];

export function Case3DPanel({
  caseData,
  algorithms,
  onClose,
  onPracticeCase,
  className,
}: Case3DPanelProps) {
  const [selectedSlot, setSelectedSlot] = useState<number>(0);
  const isF2L =
    caseData.subsetId === "00000000-0000-4000-9000-000000000003" ||
    caseData.subsetId === "00000000-0000-4000-9000-000000000004" ||
    caseData.subsetId.toLowerCase().includes("f2l") ||
    Boolean(caseData.category?.toLowerCase().includes("f2l"));

  const slotKey = SLOT_LABELS[selectedSlot]?.key ?? "FR";

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col bg-surface", className)}>
      {/* Header */}
      <div className="flex items-center justify-between shrink-0 px-4 py-3 border-b border-line">
        <div className="flex items-center gap-2">
          <span className="nums text-[0.85rem] font-semibold text-ink">
            {caseData.caseNumber}
          </span>
          {caseData.name && caseData.name !== caseData.caseNumber && (
            <span className="text-[0.75rem] text-ink-2">{caseData.name}</span>
          )}
          {caseData.category && (
            <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[0.6rem] font-medium text-ink-3">
              {caseData.category}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-ink-3 hover:bg-surface-2 hover:text-ink transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Slot Orientation Tabs (only for F2L / Advanced F2L) */}
        {isF2L && (
          <div>
            <label className="text-[0.62rem] font-medium uppercase tracking-[0.12em] text-ink-3 block mb-1.5">
              Slot Orientation
            </label>
            <div className="grid grid-cols-4 gap-1 rounded-lg border border-line bg-surface-2/40 p-1">
              {SLOT_LABELS.map((slot) => (
                <button
                  key={slot.id}
                  onClick={() => setSelectedSlot(slot.id)}
                  className={cn(
                    "py-1 text-[0.65rem] font-medium rounded transition-colors text-center",
                    selectedSlot === slot.id
                      ? "bg-surface text-ink font-semibold shadow-xs"
                      : "text-ink-3 hover:text-ink-2",
                  )}
                >
                  {slot.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 3D Isometric Cube Component */}
        <Case3DDiagram
          caseData={caseData}
          selectedSlot={selectedSlot}
          className="max-w-60"
          showSetup
          interactive
        />

        {/* Algorithms */}
        <div>
          <h4 className="text-[0.65rem] font-medium uppercase tracking-[0.12em] text-ink-3 mb-2">
            Algorithms ({algorithms.length})
          </h4>
          <div className="space-y-2">
            {algorithms.map((alg) => {
              const matchesSlot = isF2L && alg.notes?.includes(`Slot: ${slotKey}`);
              return (
                <div
                  key={alg.id}
                  className={cn(
                    "flex flex-col gap-1 rounded-lg border p-2.5 transition-colors",
                    matchesSlot || (!isF2L && alg.isDefault)
                      ? "border-ink/20 bg-surface-2"
                      : "border-line bg-surface hover:border-ink/10",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="nums flex flex-wrap gap-x-1.5 gap-y-0.5 text-[0.75rem] font-medium text-ink">
                      {alg.moves.map((move, i) => (
                        <span key={i}>{move}</span>
                      ))}
                    </div>
                    {alg.notes && (
                      <span className="rounded bg-surface-3/60 px-1.5 py-0.5 text-[0.58rem] font-medium text-ink-2 shrink-0">
                        {alg.notes}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-[0.58rem] text-ink-3">
                    <span>HTM: {alg.moveCount.htm}</span>
                    <span>QTM: {alg.moveCount.qtm}</span>
                    {caseData.puzzleType !== "2x2x2" && alg.moveCount.stm > 0 && (
                      <span>STM: {alg.moveCount.stm}</span>
                    )}
                    {alg.source && (() => {
                      const sourceUrl = alg.attributionUrl || (
                        alg.source.startsWith("http")
                          ? alg.source
                          : alg.source.toLowerCase().includes("speedcubedb")
                          ? (caseData.subsetId.toLowerCase().includes("oll")
                              ? "https://speedcubedb.com/a/3x3/OLL"
                              : caseData.subsetId.toLowerCase().includes("pll")
                              ? "https://speedcubedb.com/a/3x3/PLL"
                              : caseData.subsetId.toLowerCase().includes("f2l")
                              ? "https://speedcubedb.com/a/3x3/F2L"
                              : "https://speedcubedb.com")
                          : undefined
                      );
                      return sourceUrl ? (
                        <a
                          href={sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 hover:underline hover:text-ink transition-colors"
                        >
                          <ExternalLink className="size-2.5" />
                          {alg.source}
                        </a>
                      ) : (
                        <span className="flex items-center gap-1">
                          <ExternalLink className="size-2.5" />
                          {alg.source}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Practice button */}
        {onPracticeCase && (
          <button
            onClick={() => onPracticeCase(caseData.subsetId, caseData.id)}
            className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-[0.72rem] font-semibold text-surface hover:bg-ink/90 transition-colors w-full justify-center"
          >
            Practice This Case
          </button>
        )}
      </div>
    </div>
  );
}
