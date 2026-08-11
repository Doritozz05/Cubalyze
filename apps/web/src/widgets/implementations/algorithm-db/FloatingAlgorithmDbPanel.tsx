"use client";

import { useState, useEffect, useMemo } from "react";
import { BookOpen, Layers, Filter, ChevronLeft, ChevronRight, Grid } from "lucide-react";
import { useTranslation } from "react-i18next";
import { FloatingWidgetWrapper } from "@/widgets/components/FloatingWidgetWrapper";
import {
  getSeedData,
  METHODS,
  SUBSETS,
  getSubsetsForMethod,
  getChildSubsets,
} from "@cubeforge/algorithm-db";
import type { AlgorithmCase } from "@cubeforge/algorithm-db";
import { useCaseAlgorithms } from "@/hooks/useCaseAlgorithms";
import { AlgorithmViewerCard } from "./components/AlgorithmViewerCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { puzzleCategoryToType } from "@/utils/puzzleUtils";
import type { PuzzleCategory } from "@/types";

// ── Puzzle type grouping ──────────────────────────────────────────────────

type PuzzleTypeKey = '3x3x3' | '2x2x2';

const PUZZLE_TYPES: { value: PuzzleTypeKey; label: string }[] = [
  { value: '3x3x3', label: '3x3' },
  { value: '2x2x2', label: '2x2' },
];

export interface FloatingAlgorithmDbPanelProps {
  solves?: unknown[];
  /** Global puzzle category from the app header (e.g. '2x2', '3x3'). Syncs the widget's puzzle selector. */
  puzzle?: string;
}

export function FloatingAlgorithmDbPanel({ solves: _solves, puzzle }: FloatingAlgorithmDbPanelProps) {
  const { cases: allCases } = useMemo(
    () => getSeedData(),
    []
  );

  // ── Puzzle type filter ────────────────────────────────────────────────
  const [puzzleType, setPuzzleType] = useState<PuzzleTypeKey>(() => {
    if (puzzle) {
      const mapped = puzzleCategoryToType(puzzle as PuzzleCategory) as PuzzleTypeKey;
      if (PUZZLE_TYPES.some((pt) => pt.value === mapped)) return mapped;
    }
    return '3x3x3';
  });

  // Sync internal puzzle type when the global app puzzle changes
  useEffect(() => {
    if (!puzzle) return;
    const mapped = puzzleCategoryToType(puzzle as never) as PuzzleTypeKey;
    if (PUZZLE_TYPES.some((pt) => pt.value === mapped)) {
      setPuzzleType(mapped);
      setSelectedCaseId(null);
      setActiveViewMode("list");
    }
  }, [puzzle]);

  // Filter methods by puzzle type
  const puzzleMethods = useMemo(
    () => METHODS.filter((m) => (m.puzzleType ?? '3x3x3') === puzzleType),
    [puzzleType],
  );

  // Default to first method for the selected puzzle type
  const [selectedMethodId, setSelectedMethodId] = useState<string>(
    puzzleMethods[0]?.id ?? METHODS[0]?.id ?? "00000000-0000-4000-8000-000000000001"
  );

  // Keep method valid when puzzle type changes
  const effectiveMethodId = useMemo(() => {
    if (puzzleMethods.some((m) => m.id === selectedMethodId)) {
      return selectedMethodId;
    }
    return puzzleMethods[0]?.id ?? "";
  }, [puzzleMethods, selectedMethodId]);

  // Available subsets for selected method (including child subsets like Basic / Advanced F2L)
  const availableSubsets = useMemo(() => {
    const topSubsets = getSubsetsForMethod(effectiveMethodId);
    const result: Array<{ id: string; name: string; isChild?: boolean }> = [];

    for (const sub of topSubsets) {
      const children = getChildSubsets(sub.id);
      if (children.length > 0) {
        for (const child of children) {
          result.push({
            id: child.id,
            name: `${sub.name} - ${child.name}`,
            isChild: true,
          });
        }
      } else {
        result.push({ id: sub.id, name: sub.name });
      }
    }
    return result;
  }, [effectiveMethodId]);

  // Default subset: OLL for 3x3, PBL for 2x2 Ortega, CLL for 2x2 CLL, or first available
  const [selectedSubsetId, setSelectedSubsetId] = useState<string>(() => {
    const defaultSub = SUBSETS.find((s) => s.name === "OLL" && s.puzzleType === puzzleType)
      ?? SUBSETS.find((s) => s.name === "PLL" && s.puzzleType === puzzleType)
      ?? availableSubsets[0];
    return defaultSub?.id ?? availableSubsets[0]?.id ?? "";
  });

  // Keep subset valid when method changes
  const effectiveSubsetId = useMemo(() => {
    if (availableSubsets.some((s) => s.id === selectedSubsetId)) {
      return selectedSubsetId;
    }
    return availableSubsets[0]?.id ?? "";
  }, [availableSubsets, selectedSubsetId]);

  // Filter cases by selected subset
  const subsetCases = useMemo(() => {
    return allCases.filter((c) => c.subsetId === effectiveSubsetId);
  }, [allCases, effectiveSubsetId]);

  // Active view: "list" (show open cases grid) or "detail" (show selected case setup & algorithm)
  const [activeViewMode, setActiveViewMode] = useState<"list" | "detail">("list");
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  const activeCaseIndex = useMemo(() => {
    if (!selectedCaseId) return 0;
    const idx = subsetCases.findIndex((c) => c.id === selectedCaseId);
    return idx >= 0 ? idx : 0;
  }, [subsetCases, selectedCaseId]);

  const activeCase: AlgorithmCase | undefined = subsetCases[activeCaseIndex] ?? subsetCases[0];

  // Algorithms for active case (seed + custom, ordered)
  const { algorithms: activeAlgorithms } = useCaseAlgorithms(activeCase?.id);

  const handleSelectCase = (caseId: string) => {
    setSelectedCaseId(caseId);
    setActiveViewMode("detail");
  };

  const handlePrevCase = () => {
    if (subsetCases.length === 0) return;
    const newIdx = (activeCaseIndex - 1 + subsetCases.length) % subsetCases.length;
    setSelectedCaseId(subsetCases[newIdx].id);
  };

  const handleNextCase = () => {
    if (subsetCases.length === 0) return;
    const newIdx = (activeCaseIndex + 1) % subsetCases.length;
    setSelectedCaseId(subsetCases[newIdx].id);
  };

  // Current method & subset info for headers
  const currentMethod = puzzleMethods.find((m) => m.id === effectiveMethodId);
  const currentSubsetName =
    availableSubsets.find((s) => s.id === effectiveSubsetId)?.name ?? "subset";

  const puzzleLabel = PUZZLE_TYPES.find((pt) => pt.value === puzzleType)?.label ?? '3x3';
  const { t } = useTranslation("widgets");

  return (
    <FloatingWidgetWrapper
      widgetId="algorithm-db"
      label={t("def.algorithmDb")}
      icon={BookOpen}
      panelWidth={320}
      defaultPosition={{ x: 380, y: 72 }}
      headerActions={
        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface-2 border border-line text-[0.62rem] text-ink-3 font-mono">
          <span className="text-ink font-semibold">
            {puzzleLabel}
          </span>
          <span>/</span>
          <span className="text-ink font-semibold">
            {currentMethod?.name}
          </span>
          <span>/</span>
          <span>{currentSubsetName}</span>
        </div>
      }
    >
      <div className="flex flex-col gap-2 p-2.5 text-ink text-xs">
        {/* ── Top Row: Puzzle Type + Empty state for no-method puzzles ── */}
        {puzzleMethods.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-4 bg-surface-2/30 border border-line border-dashed rounded-lg text-center text-ink-3">
            <BookOpen className="size-5 mb-1.5 opacity-50" />
            <span className="text-xs font-medium">
              No methods available for {puzzleLabel}
            </span>
            <span className="text-[0.62rem] mt-0.5">
              Methods will be added in a future update
            </span>
          </div>
        ) : (
          <>
            {/* ── Puzzle Type Select ── */}
            <div className="flex flex-col gap-1">
              <label className="text-[0.62rem] font-medium text-ink-3 flex items-center gap-1">
                <Grid className="size-2.5" /> Puzzle
              </label>
              <Select
                value={puzzleType}
                onValueChange={(val) => {
                  setPuzzleType(val as PuzzleTypeKey);
                  setSelectedCaseId(null);
                  setActiveViewMode("list");
                }}
              >
                <SelectTrigger size="sm" className="w-full h-7 text-xs bg-surface-2 border-line">
                  <SelectValue placeholder={t("panel.algorithmDb.puzzle")} />
                </SelectTrigger>
                <SelectContent>
                  {PUZZLE_TYPES.map((pt) => (
                    <SelectItem key={pt.value} value={pt.value} className="text-xs">
                      {pt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ── Method & Submethod Select Controls ── */}
            <div className="grid grid-cols-2 gap-2">
              {/* Method Select */}
              <div className="flex flex-col gap-1">
                <label className="text-[0.62rem] font-medium text-ink-3 flex items-center gap-1">
                  <Layers className="size-2.5" /> Method
                </label>
                <Select
                  value={effectiveMethodId}
                  onValueChange={(val) => {
                    setSelectedMethodId(val);
                    setSelectedCaseId(null);
                    setActiveViewMode("list");
                  }}
                >
                  <SelectTrigger size="sm" className="w-full h-7 text-xs bg-surface-2 border-line">
                    <SelectValue placeholder={t("panel.algorithmDb.method")} />
                  </SelectTrigger>
                  <SelectContent>
                    {puzzleMethods.map((m) => (
                      <SelectItem key={m.id} value={m.id} className="text-xs">
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Submethod Select */}
              <div className="flex flex-col gap-1">
                <label className="text-[0.62rem] font-medium text-ink-3 flex items-center gap-1">
                  <Filter className="size-2.5" /> Submethod
                </label>
                <Select
                  value={effectiveSubsetId}
                  onValueChange={(val) => {
                    setSelectedSubsetId(val);
                    setSelectedCaseId(null);
                    setActiveViewMode("list");
                  }}
                >
                  <SelectTrigger size="sm" className="w-full h-7 text-xs bg-surface-2 border-line">
                    <SelectValue placeholder={t("panel.algorithmDb.submethod")} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSubsets.map((s) => (
                      <SelectItem key={s.id} value={s.id} className="text-xs">
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* ── Mode Navigation Bar: List view vs Detail view ── */}
            <div className="flex items-center justify-between border-b border-line pb-1.5 pt-0.5">
              <span className="text-[0.62rem] font-medium text-ink-3">
                Cases ({subsetCases.length})
              </span>

              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant={activeViewMode === "list" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setActiveViewMode("list")}
                  className="h-5 px-1.5 text-[0.62rem] gap-1"
                >
                  <Grid className="size-2.5" />
                  <span>{t("panel.algorithmDb.viewList")}</span>
                </Button>
                {activeCase && (
                  <Button
                    type="button"
                    variant={activeViewMode === "detail" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setActiveViewMode("detail")}
                    className="h-5 px-1.5 text-[0.62rem] gap-1"
                  >
                    <span>{t("panel.algorithmDb.viewAlgorithm")}</span>
                  </Button>
                )}
              </div>
            </div>

            {/* ── View Mode A: Open Cases List ── */}
            {activeViewMode === "list" ? (
              <div className="flex flex-col gap-1.5">
                {subsetCases.length > 0 ? (
                  <ScrollArea className="max-h-72 w-full pr-1">
                    <div className="grid grid-cols-4 gap-1 p-0.5">
                      {subsetCases.map((c) => {
                        const isSelected = activeCase?.id === c.id;
                        return (
                          <Button
                            key={c.id}
                            type="button"
                            variant={isSelected ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleSelectCase(c.id)}
                            className={cn(
                              "h-8 px-1 flex flex-col items-center justify-center font-mono text-[0.62rem] transition-all",
                              isSelected
                                ? "bg-ink text-surface border-ink font-semibold shadow-xs"
                                : "bg-surface-1/80 text-ink-2 border-line/60 hover:text-ink hover:bg-surface-2"
                            )}
                          >
                            <span className="truncate w-full text-center">{c.caseNumber}</span>
                          </Button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="p-6 text-center text-xs text-ink-3">
                    No cases for this submethod
                  </div>
                )}
              </div>
            ) : (
              /* ── View Mode B: Selected Case Detail (shows setup & algorithm) ── */
              <div className="flex flex-col gap-2">
                {/* Quick Prev / Back / Next Bar */}
                <div className="flex items-center justify-between bg-surface-2/40 border border-line rounded-md px-2 py-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveViewMode("list")}
                    className="h-5 px-1.5 text-[0.62rem] text-ink-3 hover:text-ink gap-1"
                  >
                    <ChevronLeft className="size-3" />
                    <span>{t("panel.algorithmDb.allCases")}</span>
                  </Button>

                  <div className="flex items-center gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handlePrevCase}
                          className="h-5 w-5 p-0 text-ink-3 hover:text-ink"
                        >
                          <ChevronLeft className="size-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">{t("panel.algorithmDb.previousCase")}</TooltipContent>
                    </Tooltip>
                    <span className="font-mono text-[0.62rem] font-bold text-ink px-1">
                      {activeCaseIndex + 1}/{subsetCases.length}
                    </span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleNextCase}
                          className="h-5 w-5 p-0 text-ink-3 hover:text-ink"
                        >
                          <ChevronRight className="size-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">{t("panel.algorithmDb.nextCase")}</TooltipContent>
                    </Tooltip>
                  </div>
                </div>

                {activeCase ? (
                  <AlgorithmViewerCard
                    caseData={activeCase}
                    algorithms={activeAlgorithms}
                    subsetName={currentSubsetName}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-6 bg-surface-2/30 border border-line border-dashed rounded-lg text-center text-ink-3">
                    <BookOpen className="size-6 mb-1 opacity-50" />
                    <span className="text-xs font-medium">{t("panel.algorithmDb.noCaseSelected")}</span>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </FloatingWidgetWrapper>
  );
}
