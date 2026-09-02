"use client";

import { useTranslation } from "react-i18next";
import { Clock, Hash } from "lucide-react";
import {
  getSeedData,
  type AlgorithmCase,
} from "@cubeforge/algorithm-db";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { CaseMiniCube } from "@/components/Cases/CaseMiniCube";
import { pairStickerColors } from "@/components/Cases/caseHelpers";
import { useIsTouch } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { CROSS_COLOR_CONFIGS } from "./infiniteF2lEngine";
import type { PairRecord } from "./useInfiniteF2LSession";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMs(ms: number): string {
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(2)}s`;
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(2).padStart(5, "0");
  return `${m}:${sec}`;
}

// Seed lookup shared with the analysis/recognition panels: caseNumber or caseName → AlgorithmCase.
const CASES_BY_NUMBER: Map<string, AlgorithmCase> = (() => {
  const m = new Map<string, AlgorithmCase>();
  for (const c of getSeedData().cases) {
    if (!m.has(c.caseNumber)) m.set(c.caseNumber, c);
    if (c.name && !m.has(c.name)) m.set(c.name, c);
  }
  return m;
})();

// ─── Single pair card ─────────────────────────────────────────────────────────

function PairCard({ record }: { record: PairRecord }) {
  const caseData = record.detectedCase
    ? CASES_BY_NUMBER.get(record.detectedCase.caseNumber) ??
      CASES_BY_NUMBER.get(record.detectedCase.caseName)
    : undefined;
  const stickerColors =
    caseData && record.detectedCase
      ? pairStickerColors(
          CROSS_COLOR_CONFIGS[record.crossColor]?.face ?? "U",
          record.leftColor,
          record.rightColor,
        )
      : null;

  return (
    <div className="flex gap-3 rounded-xl border border-line bg-surface p-3">
      {/* 3D mini case cube — the combined Basic + Advanced catalog covers
          every pair configuration, so every recorded pair resolves to a
          case and renders its diagram. The placeholder only guards legacy
          records persisted before detection existed. */}
      {caseData && record.detectedCase ? (
        <div className="flex items-center justify-center shrink-0 w-16 sm:w-20">
          <CaseMiniCube
            caseData={caseData}
            slotIndex={0}
            stickerColors={stickerColors}
            alt={record.detectedCase.caseName}
          />
        </div>
      ) : (
        <div className="shrink-0 w-16 sm:w-20" aria-hidden />
      )}

      {/* Info */}
      <div className="flex flex-1 flex-col gap-1.5 min-w-0">
        {/* Header row: pair number + slot badge + recognized case */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="nums text-xs font-bold text-ink">#{record.index}</span>
          <span
            className="rounded-md px-1.5 py-0.5 text-[0.65rem] font-semibold text-surface"
            style={{ backgroundColor: record.colorDef.colorName }}
          >
            {record.slotId}
          </span>
          {record.detectedCase && caseData && (
            <span className="ml-auto flex flex-col items-end min-w-0 text-right">
              <span className="text-[0.66rem] font-semibold text-ink truncate">
                {record.detectedCase.caseName}
              </span>
              <span className="nums text-[0.58rem] text-ink-3">
                {record.detectedCase.caseNumber}
              </span>
            </span>
          )}
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 text-[0.68rem] text-ink-3 font-medium">
          <span className="flex items-center gap-1">
            <Clock className="size-3" />
            <span className="nums">{formatMs(record.timeMs)}</span>
          </span>
          <span className="flex items-center gap-1">
            <Hash className="size-3" />
            <span className="nums">{record.moves.length} moves</span>
          </span>
        </div>

        {/* Moves sequence */}
        {record.moves.length > 0 && (
          <p className="nums text-[0.65rem] text-ink-3 leading-relaxed break-all line-clamp-2">
            {record.moves.join(" ")}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface PairHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  records: PairRecord[];
}

export function PairHistoryDialog({
  open,
  onOpenChange,
  records,
}: PairHistoryDialogProps) {
  const { t } = useTranslation("training");
  const isTouch = useIsTouch();

  const content = (
    <div className="flex flex-col gap-2.5 p-4">
      {records.length === 0 ? (
        <p className="text-center text-xs text-ink-3 py-8">
          {t("infiniteF2l.pairHistory.empty")}
        </p>
      ) : (
        records.map((r) => <PairCard key={r.index} record={r} />)
      )}
    </div>
  );

  const titleEl = (
    <span className="flex items-center gap-2">
      <span className="nums">{records.length}</span>
      <span>{t("infiniteF2l.pairHistory.title")}</span>
    </span>
  );

  const descEl = (
    <span className="text-xs text-ink-3">
      {t("infiniteF2l.pairHistory.subtitle")}
    </span>
  );

  if (isTouch) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh] bg-surface">
          <DrawerHeader className="border-b border-line px-6 py-4">
            <DrawerTitle
              className={cn(
                "flex items-center gap-2 text-base font-semibold text-ink",
              )}
            >
              {titleEl}
            </DrawerTitle>
            <DrawerDescription>{descEl}</DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto">{content}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-line bg-surface/95 backdrop-blur-md p-0 overflow-hidden shadow-2xl">
        <DialogHeader className="border-b border-line px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold text-ink">
            {titleEl}
          </DialogTitle>
          <DialogDescription>{descEl}</DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto max-h-[75vh]">{content}</div>
      </DialogContent>
    </Dialog>
  );
}
