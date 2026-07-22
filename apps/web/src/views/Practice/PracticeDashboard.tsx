"use client";

import { useState, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { getSeedData, SUBSETS } from "@cubeforge/algorithm-db";
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

  // ── Render ────────────────────────────────────────────────────────────
  // Algorithms browser (no tabs — trainer will be a separate sidebar item)
  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
      {/* ── Body: sidebar + content ───────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left sidebar: Method tree */}
        <aside className="w-44 shrink-0 border-r border-line overflow-y-auto py-2">
          <MethodTree
            selectedSubsetId={selectedSubsetId}
            onSelectSubset={handleSelectSubset}
          />
        </aside>

        {/* Main: Case grid + optional detail panel */}
        <div className="flex flex-1 min-h-0">
          {/* Case grid */}
          <div
            className={cn(
              "flex-1 min-w-0 overflow-y-auto p-4",
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
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
