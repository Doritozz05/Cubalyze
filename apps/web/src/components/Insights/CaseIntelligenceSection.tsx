"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import {
  getSeedData,
  getSubset,
  resolveVisualizationStyleForSubset,
  type AlgorithmCase,
} from "@cubeforge/algorithm-db";
import { CaseDiagram } from "@/views/Algorithms/components/CaseDiagram";
import { CaseMiniCube } from "@/components/Cases";
import { deriveCaseIntelligence, type CaseIntelligence } from "@/utils/insights";
import { formatTime } from "@/utils/formatTime";
import { SectionHeader } from "./atoms";
import { PANEL_BASE } from "@/lib/panel";
import type { Solve } from "@/types";

const PHASE_ORDER = ["F2L", "OLL", "PLL"] as const;

/**
 * Minimal session case-intelligence: for each phase (F2L / OLL / PLL) it lists
 * only the SLOWEST and FASTEST recognized case, each with its own diagram.
 * Bounded (2 rows per phase) so it never grows into a wall of data, and it
 * surfaces the two things that matter: your time sink and your strongest case.
 */
export function CaseIntelligenceSection({ solves }: { solves: Solve[] }) {
  const { t } = useTranslation("insights");

  const { casesByNumber, groups } = useMemo(() => {
    const byNumber = new Map<string, AlgorithmCase>();
    for (const c of getSeedData().cases) {
      if (c.caseNumber && !byNumber.has(c.caseNumber)) byNumber.set(c.caseNumber, c);
      if (c.name && !byNumber.has(c.name)) byNumber.set(c.name, c);
    }
    const all = deriveCaseIntelligence(solves);
    const groups = PHASE_ORDER.map((phase) => {
      const items = all.filter((c) => c.phase === phase && c.avgTimeMs != null);
      if (items.length === 0) return { phase, slowest: null, fastest: null };
      const slowest = items.reduce((a, b) => (a.avgTimeMs! > b.avgTimeMs! ? a : b));
      const fastest = items.reduce((a, b) => (a.avgTimeMs! < b.avgTimeMs! ? a : b));
      return { phase, slowest, fastest };
    });
    return { casesByNumber: byNumber, groups };
  }, [solves]);

  const hasData = groups.some((g) => g.slowest != null);
  if (!hasData) {
    return (
    <div className={PANEL_BASE}>
        <SectionHeader title={t("caseIntelligence.title")} />
        <div className="mt-3 flex h-14 items-center justify-center text-center text-[0.7rem] text-ink-3">
          {t("caseIntelligence.empty")}
        </div>
      </div>
    );
  }

  return (
    <div className={PANEL_BASE}>
      <SectionHeader title={t("caseIntelligence.title")} eyebrow={t("caseIntelligence.bestOfEach")} />

      <div className="mt-2 divide-y divide-line/60">
        {groups.map(
          (g) =>
            g.slowest != null && (
              <div key={g.phase} className="py-2.5">
                {/* Phase label — quiet, no colour */}
                <div className="mb-1.5 px-0.5 text-[0.58rem] font-medium uppercase tracking-[0.16em] text-ink-3">
                  {g.phase}
                </div>

                <div className="divide-y divide-line/50">
                  <Row
                    label={t("caseIntelligence.slowest")}
                    c={g.slowest!}
                    muted={true}
                    casesByNumber={casesByNumber}
                  />
                  <Row
                    label={t("caseIntelligence.fastest")}
                    c={g.fastest!}
                    muted={false}
                    casesByNumber={casesByNumber}
                  />
                </div>
              </div>
            ),
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  c,
  muted,
  casesByNumber,
}: {
  label: string;
  c: CaseIntelligence;
  muted: boolean;
  casesByNumber: Map<string, AlgorithmCase>;
}) {
  const { t } = useTranslation("insights");
  const caseData =
    casesByNumber.get(c.caseNumber) ?? casesByNumber.get(c.caseName);

  return (
    <div className="flex items-center gap-3 px-0.5 py-2">
      <CaseThumb phase={c.phase} caseData={caseData} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span
            className={cn(
              "truncate text-[0.78rem] font-medium",
              muted ? "text-ink-2" : "text-ink",
            )}
          >
            {c.caseName}
          </span>
          <span className="shrink-0 font-mono text-[0.52rem] text-ink-3">
            {c.caseNumber}
          </span>
        </div>
        <div className="text-[0.56rem] text-ink-3">
          {label}
          <span className="mx-1 text-ink-3/40">·</span>
          {t("caseIntelligence.timesX", { count: c.count })}
        </div>
      </div>
      <span className="nums shrink-0 text-[0.8rem] font-medium tabular-nums text-ink">
        {formatTime(c.avgTimeMs ?? 0)}
      </span>
    </div>
  );
}

/** Small neutral thumbnail of the case (falls back to a placeholder).
 *  F2L uses the 3D mini-cube (same as the reconstruction table); last-layer
 *  (OLL/PLL) keeps the 2D rotated diagram. */
function CaseThumb({ phase, caseData }: { phase: string; caseData?: AlgorithmCase }) {
  if (phase === "F2L") {
    if (!caseData) {
      return <span className="size-9 shrink-0 rounded-md border border-line bg-surface-2/40" aria-hidden />;
    }
    return (
      <CaseMiniCube
        caseData={caseData}
        slotIndex={0}
        stickerColors={null}
        alt={caseData.name}
      />
    );
  }

  if (!caseData?.setupScramble) {
    return (
      <span className="size-9 shrink-0 rounded-md border border-line bg-surface-2/40" aria-hidden />
    );
  }
  const subset = getSubset(caseData.subsetId);
  const style = resolveVisualizationStyleForSubset(subset?.name);
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-line bg-surface-2/40">
      <CaseDiagram
        setupScramble={caseData.setupScramble}
        style={style}
        className="size-8"
      />
    </span>
  );
}