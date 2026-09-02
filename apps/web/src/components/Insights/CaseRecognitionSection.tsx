"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { getSeedData, type AlgorithmCase } from "@cubeforge/algorithm-db";
import { CaseMiniCube } from "@/components/Cases";
import { CaseDiagram } from "@/views/Algorithms/components/CaseDiagram";
import { getSubset, resolveVisualizationStyleForSubset } from "@cubeforge/algorithm-db";
import { deriveCaseIntelligence, type CaseIntelligence } from "@/utils/insights";
import { formatTime } from "@/utils/formatTime";
import { SectionHeader } from "./atoms";
import { PANEL_BASE } from "@/lib/panel";
import type { Solve } from "@/types";

/**
 * Session ranking of your slowest-to-RECOGNIZE vs slowest-to-EXECUTE cases.
 *
 * The analysis pipeline already splits recognition from execution per case
 * (F2L pair gap vs pair turning; oll/pll recognition vs execution). This
 * surfaces the two axes separately so you can tell "I execute T-perm fine but
 * I'm slow to recognize it" from "my OLL is just slow to turn".
 */
export function CaseRecognitionSection({ solves }: { solves: Solve[] }) {
  const { t } = useTranslation("insights");

  const casesByNumber = useMemo(() => {
    const byNumber = new Map<string, AlgorithmCase>();
    for (const c of getSeedData().cases) {
      if (c.caseNumber && !byNumber.has(c.caseNumber)) byNumber.set(c.caseNumber, c);
      if (c.name && !byNumber.has(c.name)) byNumber.set(c.name, c);
    }
    return byNumber;
  }, []);

  const { recognitionRank, executionRank } = useMemo(() => {
    const all = deriveCaseIntelligence(solves);
    const rankedByRec = all
      .filter((c) => c.avgRecognitionMs != null && c.avgRecognitionMs > 40)
      .sort((a, b) => b.avgRecognitionMs! - a.avgRecognitionMs!);
    const rankedByExec = all
      .filter((c) => c.avgExecutionMs != null)
      .sort((a, b) => b.avgExecutionMs! - a.avgExecutionMs!);
    return {
      recognitionRank: rankedByRec.slice(0, 5),
      executionRank: rankedByExec.slice(0, 5),
    };
  }, [solves]);

  const hasData = recognitionRank.length > 0 || executionRank.length > 0;
  if (!hasData) {
    return (
      <div className={PANEL_BASE}>
        <SectionHeader title={t("caseRecognition.title")} />
        <div className="mt-3 flex h-14 items-center justify-center text-center text-[0.7rem] text-ink-3">
          {t("caseRecognition.empty")}
        </div>
      </div>
    );
  }

  return (
    <div className={PANEL_BASE}>
      <SectionHeader
        title={t("caseRecognition.title")}
        eyebrow={t("caseRecognition.eyebrow")}
      />
      <div className="mt-2 grid gap-5 md:grid-cols-2 max-md:gap-4">
        <RankColumn
          title={t("caseRecognition.slowestRecognize")}
          hint={t("caseRecognition.recognizeHint")}
          rows={recognitionRank}
          casesByNumber={casesByNumber}
          valueOf={(c) => c.avgRecognitionMs ?? 0}
        />
        <RankColumn
          title={t("caseRecognition.slowestExecute")}
          hint={t("caseRecognition.executeHint")}
          rows={executionRank}
          casesByNumber={casesByNumber}
          valueOf={(c) => c.avgExecutionMs ?? 0}
        />
      </div>
    </div>
  );
}

function RankColumn({
  title,
  hint,
  rows,
  casesByNumber,
  valueOf,
}: {
  title: string;
  hint: string;
  rows: CaseIntelligence[];
  casesByNumber: Map<string, AlgorithmCase>;
  valueOf: (c: CaseIntelligence) => number;
}) {
  const { t } = useTranslation("insights");
  return (
    <div>
      <div className="mb-0.5 px-0.5 text-[0.58rem] font-medium uppercase tracking-[0.16em] text-ink-3">
        {title}
      </div>
      <div className="mb-1 px-0.5 text-[0.58rem] text-ink-3">{hint}</div>
      {rows.length === 0 ? (
        <div className="px-0.5 py-2 text-[0.62rem] text-ink-3/70">
          {t("caseRecognition.noCases")}
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-line/50">
          {rows.map((c, i) => (
            <Row
              key={`${c.phase}-${c.caseNumber}-${i}`}
              rank={i + 1}
              c={c}
              casesByNumber={casesByNumber}
              value={valueOf(c)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Row({
  rank,
  c,
  casesByNumber,
  value,
}: {
  rank: number;
  c: CaseIntelligence;
  casesByNumber: Map<string, AlgorithmCase>;
  value: number;
}) {
  const { t } = useTranslation("insights");
  const caseData = casesByNumber.get(c.caseNumber) ?? casesByNumber.get(c.caseName);
  return (
    <div className="flex items-center gap-3 px-0.5 py-2">
      <span className="nums w-3 shrink-0 text-[0.6rem] font-medium tabular-nums text-ink-3">
        {rank}
      </span>
      <Thumb phase={c.phase} caseData={caseData} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="truncate text-[0.78rem] font-medium text-ink">{c.caseName}</span>
          <span className="shrink-0 font-mono text-[0.52rem] text-ink-3">{c.caseNumber}</span>
        </div>
        <div className="text-[0.56rem] text-ink-3">
          {c.phase} · {t("caseRecognition.timesX", { count: c.count })}
        </div>
      </div>
      <span className="nums shrink-0 text-[0.8rem] font-medium tabular-nums text-ink">
        {formatTime(value)}
      </span>
    </div>
  );
}

/** Small neutral thumbnail of the case (F2L → 3D mini-cube, LL → 2D diagram). */
function Thumb({ phase, caseData }: { phase: string; caseData?: AlgorithmCase }) {
  if (phase === "F2L") {
    if (!caseData) return <span className="size-9 shrink-0 rounded-md border border-line bg-surface-2/40" aria-hidden />;
    return <CaseMiniCube caseData={caseData} slotIndex={0} stickerColors={null} alt={caseData.name} />;
  }
  if (!caseData?.setupScramble) {
    return <span className="size-9 shrink-0 rounded-md border border-line bg-surface-2/40" aria-hidden />;
  }
  const subset = getSubset(caseData.subsetId);
  const style = resolveVisualizationStyleForSubset(subset?.name);
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-line bg-surface-2/40">
      <CaseDiagram setupScramble={caseData.setupScramble} style={style} className="size-8" />
    </span>
  );
}