"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useIsTouch } from "@/hooks/use-mobile";
import { getSeedData, SUBSETS, resolveVisualizationStyleForSubset } from "@cubalyze/algorithm-db";
import type { VisualizationStyle } from "@cubalyze/algorithm-db";
import { Skeleton } from "@/components/ui/skeleton";
import { MethodTree } from "./components/MethodTree";
import { MobileMethodNavigator } from "./components/MobileMethodNavigator";
import { CaseGrid } from "./components/CaseGrid";
import { CaseDetailPanel } from "./components/CaseDetailPanel";

export interface AlgorithmDashboardProps {
  onPracticeCase?: (subsetId: string, caseId: string) => void;
  initialSubsetId?: string | null;
  initialCaseId?: string | null;
}

export function AlgorithmDashboard({
  onPracticeCase,
  initialSubsetId,
  initialCaseId,
}: AlgorithmDashboardProps = {}) {
  const { t } = useTranslation("algorithms");
  const [selectedSubsetId, setSelectedSubsetId] = useState<string | null>(() => {
    if (initialSubsetId) return initialSubsetId;
    // On mobile / touch (<768px), start with nothing selected so the user is prompted to pick a puzzle and method first.
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      return null;
    }
    // On desktop (>=768px), default to 3×3 PLL.
    return SUBSETS.find((s) => s.name === "PLL")?.id ?? null;
  });
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(
    () => initialCaseId ?? null,
  );
  const [mobileNavOpen, setMobileNavOpen] = useState<boolean>(() => !selectedSubsetId);

  // Defer useIsTouch to post-mount to avoid SSR/hydration flash (same
  // pattern as MainLayout / TouchAside). Desktop (>=768px) always false.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const rawIsTouch = useIsTouch();
  const isTouch = mounted && rawIsTouch;

  useEffect(() => {
    if (initialSubsetId) {
      setSelectedSubsetId(initialSubsetId);
      setMobileNavOpen(false);
    }
    if (initialCaseId !== undefined) {
      setSelectedCaseId(initialCaseId);
    }
  }, [initialSubsetId, initialCaseId]);

  // ── Get seed data (in-memory for now; database integration later) ────
  const { cases: allCases } = useMemo(() => getSeedData(), []);

  // ── Filtered cases for selected subset ───────────────────────────────
  const filteredCases = useMemo(
    () =>
      selectedSubsetId
        ? allCases.filter((c) => c.subsetId === selectedSubsetId)
        : [],
    [allCases, selectedSubsetId],
  );

  // ── Selected case data ────────────────────────────────────────────────
  const selectedCase = useMemo(
    () =>
      selectedCaseId
        ? allCases.find((c) => c.id === selectedCaseId) ?? null
        : null,
    [allCases, selectedCaseId],
  );

  const handleSelectSubset = useCallback((subsetId: string) => {
    setSelectedSubsetId(subsetId);
    setSelectedCaseId(null);
    setMobileNavOpen(false);
  }, []);

  const handleSelectCase = useCallback((caseId: string) => {
    setSelectedCaseId((prev) => (prev === caseId ? null : caseId));
  }, []);

  // ── Visualization style based on selected subset ────────────────────
  const visualizationStyle: VisualizationStyle = useMemo(() => {
    if (!selectedSubsetId) return "full-color";
    const subset = SUBSETS.find((s) => s.id === selectedSubsetId);
    if (!subset) return "full-color";
    return resolveVisualizationStyleForSubset(subset.name);
  }, [selectedSubsetId]);

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="relative flex-1 min-h-0 w-full" data-onboarding-target="algorithms">
      {/* Same margins as the Insights dashboard: desktop breathing room
          (was flush against header/rail) + compact touch gutters. */}
      <div className="absolute inset-0 flex flex-col gap-4 overflow-hidden lg:flex-row lg:gap-5 max-lg:px-3 lg:px-6 lg:pt-3">
        {/* Left panel: Method tree — desktop only (>=768px) */}
        <aside
          data-context-zone="algorithms-nav"
          className="hidden h-full min-h-0 flex-col overflow-hidden rounded-lg border border-line bg-surface lg:flex lg:w-64 lg:shrink-0"
        >
          <div className="flex-1 overflow-y-auto py-2">
            <MethodTree
              selectedSubsetId={selectedSubsetId}
              onSelectSubset={handleSelectSubset}
            />
          </div>
        </aside>

        {/* Right panel: Case grid + optional detail panel */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg">
          {/* Touch (<768px): drill-down method navigator replaces the
              aside. CSS-gated (lg:hidden) — desktop never renders it. No
              surface strip behind it: the selector floats on the canvas
              like the Insights filters. px-4 keeps it aligned with the
              case grid's own p-4 padding. */}
          <div className="shrink-0 px-4 pt-3 lg:hidden">
            <MobileMethodNavigator
              selectedSubsetId={selectedSubsetId}
              onSelectSubset={handleSelectSubset}
              open={mobileNavOpen}
              onOpenChange={setMobileNavOpen}
            />
          </div>

          <div className="flex flex-1 min-h-0">
            {/* Case grid */}
            <div className="flex-1 min-w-0 min-h-0 overflow-y-auto p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-[0.78rem] font-semibold text-ink">
                    {selectedSubsetId
                      ? t("casesForSubset", {
                          subset:
                            SUBSETS.find((s) => s.id === selectedSubsetId)?.name ??
                            "?",
                        })
                      : t("selectSubset")}
                  </h3>
                  <p className="text-[0.62rem] text-ink-3 mt-0.5">
                    {t("caseCount", { count: filteredCases.length })}
                  </p>
                </div>
              </div>

              {selectedSubsetId ? (
                <CaseGrid
                  cases={filteredCases}
                  selectedCaseId={selectedCaseId}
                  onSelectCase={handleSelectCase}
                  visualizationStyle={visualizationStyle}
                />
              ) : (
                <>
                  {/* Touch/mobile: empty gray skeletons matching case card size & 2-col grid */}
                  <div className="grid grid-cols-2 gap-3 lg:hidden">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-44 w-full rounded-xl" />
                    ))}
                  </div>

                  {/* Desktop: hint to select from the left method tree */}
                  <div className="hidden lg:block">
                    <CaseGrid
                      cases={[]}
                      selectedCaseId={null}
                      onSelectCase={() => {}}
                      visualizationStyle={visualizationStyle}
                    />
                  </div>
                </>
              )}
            </div>

            {/* Detail panel — desktop side panel only (>=768px) */}
            {selectedCase && !isTouch && (
              <div
                data-glass-panel
                className={cn(
                  "flex min-h-0 flex-col overflow-hidden rounded-lg border border-line bg-surface",
                  "w-full lg:w-80",
                )}
              >
                <CaseDetailPanel
                  caseData={selectedCase}
                  onClose={() => setSelectedCaseId(null)}
                  visualizationStyle={visualizationStyle}
                  onPracticeCase={onPracticeCase}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Touch (<768px): full-screen case detail overlay with back button */}
      {isTouch && (
        <AnimatePresence>
          {selectedCase && (
            <motion.div
              key="case-detail-overlay"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              className="fixed inset-0 z-50 flex flex-col bg-surface lg:hidden"
            >
              <CaseDetailPanel
                variant="overlay"
                caseData={selectedCase}
                onClose={() => setSelectedCaseId(null)}
                visualizationStyle={visualizationStyle}
                onPracticeCase={onPracticeCase}
              />
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
