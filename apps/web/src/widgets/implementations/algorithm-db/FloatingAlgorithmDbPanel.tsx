"use client";

import { useState, useMemo } from "react";
import { BookOpen, Layers, Filter, ChevronLeft, ChevronRight, Grid } from "lucide-react";
import { FloatingWidgetWrapper } from "@/widgets/components/FloatingWidgetWrapper";
import {
  getSeedData,
  METHODS,
  SUBSETS,
  getSubsetsForMethod,
  getChildSubsets,
} from "@cubeforge/algorithm-db";
import type { AlgorithmCase } from "@cubeforge/algorithm-db";
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
import { cn } from "@/lib/utils";

export interface FloatingAlgorithmDbPanelProps {
  solves?: unknown[];
}

export function FloatingAlgorithmDbPanel({ solves: _solves }: FloatingAlgorithmDbPanelProps) {
  const { cases: allCases, algorithms: allAlgorithms } = useMemo(
    () => getSeedData(),
    []
  );

  // Default to CFOP
  const [selectedMethodId, setSelectedMethodId] = useState<string>(
    METHODS[0]?.id ?? "00000000-0000-4000-8000-000000000001"
  );

  // Available subsets for selected method (including child subsets like Basic / Advanced F2L)
  const availableSubsets = useMemo(() => {
    const topSubsets = getSubsetsForMethod(selectedMethodId);
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
  }, [selectedMethodId]);

  // Default subset: OLL or first available subset
  const [selectedSubsetId, setSelectedSubsetId] = useState<string>(() => {
    const defaultSub = SUBSETS.find((s) => s.name === "OLL") ?? SUBSETS.find((s) => s.name === "PLL");
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

  // Algorithms for active case
  const activeAlgorithms = useMemo(() => {
    if (!activeCase) return [];
    return allAlgorithms.filter((a) => a.caseId === activeCase.id);
  }, [allAlgorithms, activeCase]);

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
  const currentMethod = METHODS.find((m) => m.id === selectedMethodId);
  const currentSubsetName =
    availableSubsets.find((s) => s.id === effectiveSubsetId)?.name ?? "subset";

  return (
    <FloatingWidgetWrapper
      widgetId="algorithm-db"
      label="Algorithms"
      icon={BookOpen}
      panelWidth={320}
      headerActions={
        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface-2 border border-line text-[10px] text-ink-3 font-mono">
          <span className="text-accent-cyan font-medium">
            {currentMethod?.name}
          </span>
          <span>/</span>
          <span>{currentSubsetName}</span>
        </div>
      }
    >
      <div className="flex flex-col gap-2 p-2.5 text-ink text-xs">
        {/* ── Method & Submethod Select Controls ── */}
        <div className="grid grid-cols-2 gap-2">
          {/* Method Select */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium text-ink-3 flex items-center gap-1">
              <Layers className="size-2.5" /> Method
            </label>
            <Select
              value={selectedMethodId}
              onValueChange={(val) => {
                setSelectedMethodId(val);
                setSelectedCaseId(null);
                setActiveViewMode("list");
              }}
            >
              <SelectTrigger size="sm" className="w-full h-7 text-xs bg-surface-2 border-line">
                <SelectValue placeholder="Method" />
              </SelectTrigger>
              <SelectContent>
                {METHODS.map((m) => (
                  <SelectItem key={m.id} value={m.id} className="text-xs">
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Submethod Select */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium text-ink-3 flex items-center gap-1">
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
                <SelectValue placeholder="Submethod" />
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
          <span className="text-[10px] font-medium text-ink-3">
            Cases ({subsetCases.length})
          </span>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant={activeViewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveViewMode("list")}
              className="h-5 px-1.5 text-[10px] gap-1"
            >
              <Grid className="size-2.5" />
              <span>List</span>
            </Button>
            {activeCase && (
              <Button
                type="button"
                variant={activeViewMode === "detail" ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveViewMode("detail")}
                className="h-5 px-1.5 text-[10px] gap-1"
              >
                <span>Algorithm</span>
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
                          "h-8 px-1 flex flex-col items-center justify-center font-mono text-[10px] transition-all",
                          isSelected
                            ? "bg-accent-cyan/20 text-accent-cyan border-accent-cyan/40 hover:bg-accent-cyan/30 font-bold"
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
                className="h-5 px-1.5 text-[10px] text-ink-3 hover:text-ink gap-1"
              >
                <ChevronLeft className="size-3" />
                <span>All cases</span>
              </Button>

              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handlePrevCase}
                  className="h-5 w-5 p-0 text-ink-3 hover:text-ink"
                  title="Previous case"
                >
                  <ChevronLeft className="size-3" />
                </Button>
                <span className="font-mono text-[10px] font-bold text-accent-cyan px-1">
                  {activeCaseIndex + 1}/{subsetCases.length}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleNextCase}
                  className="h-5 w-5 p-0 text-ink-3 hover:text-ink"
                  title="Next case"
                >
                  <ChevronRight className="size-3" />
                </Button>
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
                <span className="text-xs font-medium">No case selected</span>
              </div>
            )}
          </div>
        )}
      </div>
    </FloatingWidgetWrapper>
  );
}
