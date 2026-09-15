"use client";

import { useTranslation } from "react-i18next";
import { Clock, Hash } from "lucide-react";
import {
  getSeedData,
  type AlgorithmCase,
} from "@cubalyze/algorithm-db";
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
    <div className="flex flex-col items-center gap-1.5 rounded-xl border border-line bg-surface p-2.5 text-center">
      {/* 3D mini case cube — the combined Basic + Advanced catalog covers
          every pair configuration, so every recorded pair resolves to a
          case and renders its diagram. The placeholder only guards legacy
          records persisted before detection existed. */}
      {caseData && record.detectedCase ? (
        <div className="flex h-11 items-center justify-center">
          <CaseMiniCube
            caseData={caseData}
            slotIndex={0}
            stickerColors={stickerColors}
            alt={record.detectedCase.caseName}
          />
        </div>
      ) : (
        <div className="h-11" aria-hidden />
      )}

      {/* Pair number + slot badge */}
      <div className="flex items-center gap-1.5">
        <span className="nums text-[0.68rem] font-bold text-ink">#{record.index}</span>
        <span
          className="rounded-md px-1.5 py-0.5 text-[0.58rem] font-semibold text-surface"
          style={{ backgroundColor: record.colorDef.colorName }}
        >
          {record.slotId}
        </span>
      </div>

      {/* Recognized case — fixed-height slot keeps cards aligned */}
      <div className="flex h-6 w-full min-w-0 flex-col items-center justify-start">
        {record.detectedCase && caseData && (
          <>
            <span className="w-full truncate text-[0.62rem] font-semibold text-ink">
              {record.detectedCase.caseName}
            </span>
            <span className="nums text-[0.55rem] text-ink-3">
              {record.detectedCase.caseNumber}
            </span>
          </>
        )}
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-2.5 text-[0.6rem] text-ink-3 font-medium">
        <span className="flex items-center gap-1">
          <Clock className="size-3" />
          <span className="nums">{formatMs(record.timeMs)}</span>
        </span>
        <span className="flex items-center gap-1">
          <Hash className="size-3" />
          <span className="nums">{record.moves.length}</span>
        </span>
      </div>

      {/* Moves sequence */}
      {record.moves.length > 0 && (
        <p className="nums w-full text-[0.6rem] text-ink-3 leading-snug break-all line-clamp-2">
          {record.moves.join(" ")}
        </p>
      )}
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
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {records.map((r) => (
            <PairCard key={r.index} record={r} />
          ))}
        </div>
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
          <DrawerHeader className="border-b border-line px-6 py-4" data-modal-header>
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
      <DialogContent className="max-w-lg border-line bg-surface p-0 overflow-hidden shadow-2xl">
        <DialogHeader className="border-b border-line px-6 py-4" data-modal-header>
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
