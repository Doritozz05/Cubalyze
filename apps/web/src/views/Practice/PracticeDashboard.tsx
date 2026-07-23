"use client";

import { useState, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { getSeedData, SUBSETS, SUBSET_VISUALIZATION } from "@cubeforge/algorithm-db";
import type { VisualizationStyle } from "@cubeforge/algorithm-db";
import { MethodTree } from "./components/MethodTree";
import { CaseGrid } from "./components/CaseGrid";
import { CaseDetailPanel } from "./components/CaseDetailPanel";

export function PracticeDashboard() {
  const [selectedSubsetId, setSelectedSubsetId] = useState<string | null>(
    () => SUBSETS.find((s) => s.name === "PLL")?.id ?? null,
  );
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  // ── Get seed data (in-memory for now; database integration later) ────
  const { cases: allCases, algorithms: allAlgorithms } = useMemo(
    () => getSeedData(),
    [],
  );

  // ── Filtered cases for selected subset ───────────────────────────────
  const filteredCases = useMemo(
    () =>
      selectedSubsetId
        ? allCases.filter((c) => c.subsetId === selectedSubsetId)
        : [],
    [allCases, selectedSubsetId],
  );

  // ── Algorithms for filtered cases ──────────────────────────────────────
  const filteredAlgorithms = useMemo(() => {
    const caseIds = new Set(filteredCases.map((c) => c.id));
    return allAlgorithms.filter((a) => caseIds.has(a.caseId));
  }, [allAlgorithms, filteredCases]);

  // ── Selected case data ────────────────────────────────────────────────
  const selectedCase = useMemo(
    () =>
      selectedCaseId
        ? allCases.find((c) => c.id === selectedCaseId) ?? null
        : null,
    [allCases, selectedCaseId],
  );

  const selectedAlgorithms = useMemo(
    () =>
      selectedCaseId
        ? allAlgorithms.filter((a) => a.caseId === selectedCaseId)
        : [],
    [allAlgorithms, selectedCaseId],
  );

  const handleSelectSubset = useCallback((subsetId: string) => {
    setSelectedSubsetId(subsetId);
    setSelectedCaseId(null);
  }, []);

  const handleSelectCase = useCallback((caseId: string) => {
    setSelectedCaseId((prev) => (prev === caseId ? null : caseId));
  }, []);

  // ── Visualization style based on selected subset ────────────────────
  const visualizationStyle: VisualizationStyle = useMemo(() => {
    if (!selectedSubsetId) return "full-color";
    const subset = SUBSETS.find((s) => s.id === selectedSubsetId);
    if (!subset) return "full-color";
    return SUBSET_VISUALIZATION[subset.name]?.style ?? "full-color";
  }, [selectedSubsetId]);

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="relative flex-1 min-h-0 w-full">
      <div className="absolute inset-0 flex flex-col gap-4 overflow-hidden lg:flex-row lg:gap-5">
        {/* Left panel: Method tree */}
        <aside className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-line bg-surface lg:w-64 lg:shrink-0">
          <div className="flex-1 overflow-y-auto py-2">
            <MethodTree
              selectedSubsetId={selectedSubsetId}
              onSelectSubset={handleSelectSubset}
            />
          </div>
        </aside>

        {/* Right panel: Case grid + optional detail panel */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg bg-canvas">
          <div className="flex flex-1 min-h-0">
            {/* Case grid */}
            <div
              className={cn(
                "flex-1 min-w-0 min-h-0 overflow-y-auto p-4",
                selectedCase && "hidden lg:block",
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-[0.78rem] font-semibold text-ink">
                    {selectedSubsetId
                      ? "PLL Cases"
                      : "Select a subset"}
                  </h3>
                  <p className="text-[0.62rem] text-ink-3 mt-0.5">
                    {filteredCases.length} case{filteredCases.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <CaseGrid
                cases={filteredCases}
                algorithms={filteredAlgorithms}
                selectedCaseId={selectedCaseId}
                onSelectCase={handleSelectCase}
                visualizationStyle={visualizationStyle}
              />
            </div>

            {/* Detail panel (desktop: side panel; mobile: overlaid) — scrolls independently */}
            {selectedCase && (
              <div
                className={cn(
                  "flex min-h-0 flex-col border-l border-line bg-surface",
                  "w-full lg:w-80",
                )}
              >
                <CaseDetailPanel
                  caseData={selectedCase}
                  algorithms={selectedAlgorithms}
                  onClose={() => setSelectedCaseId(null)}
                  visualizationStyle={visualizationStyle}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
