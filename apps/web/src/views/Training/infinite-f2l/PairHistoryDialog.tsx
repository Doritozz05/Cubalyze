"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Clock, Hash, ChevronRight } from "lucide-react";
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
import { useIsTouch } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import type { PairRecord } from "./useInfiniteF2LSession";

// ─── Mini 2D cube net (extracted from Scramble2DNet internals) ────────────────

const CSTIMER_COLOR_MAP: Record<string, string> = {
  U: "#ffffff",
  R: "#dc2626",
  F: "#16a34a",
  D: "#eab308",
  L: "#f97316",
  B: "#2563eb",
};

/** Parse a 54-char facelet string into per-face sticker arrays. */
function parseFacelets(str: string): Record<string, string[]> | null {
  if (!str || str.length !== 54) return null;
  const faceOrder = ["U", "R", "F", "D", "L", "B"] as const;
  const result: Record<string, string[]> = {};
  for (let i = 0; i < 6; i++) {
    result[faceOrder[i]] = str.slice(i * 9, (i + 1) * 9).split("");
  }
  return result;
}

/** Very compact 2D cube SVG — only the U+F+R faces for a tight F2L snapshot feel */
function MiniCubeNet({ facelets }: { facelets: string }) {
  const parsed = useMemo(() => parseFacelets(facelets), [facelets]);

  const S = 10; // sticker size
  const G = 1;  // gap
  const FG = 4; // face gap
  const BD = 1.2;
  const PAD = BD + 4;
  const FACE = 3 * S + 2 * G;

  // Layout: U on top-center, L left-middle, F center-middle, R right-middle, B far-right, D bottom-center
  const FACE_POS: Record<string, [number, number]> = {
    U: [PAD + FACE + FG, PAD],
    L: [PAD, PAD + FACE + FG],
    F: [PAD + FACE + FG, PAD + FACE + FG],
    R: [PAD + 2 * FACE + 2 * FG, PAD + FACE + FG],
    B: [PAD + 3 * FACE + 3 * FG, PAD + FACE + FG],
    D: [PAD + FACE + FG, PAD + 2 * FACE + 2 * FG],
  };

  const W = 4 * FACE + 3 * FG + PAD * 2;
  const H = 3 * FACE + 2 * FG + PAD * 2;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {Object.entries(FACE_POS).map(([face, [fx, fy]]) => {
        const stickers = parsed?.[face];
        const defaultColor = CSTIMER_COLOR_MAP[face] ?? "#888";
        return (
          <g key={face}>
            <rect
              x={fx - BD}
              y={fy - BD}
              width={FACE + BD * 2}
              height={FACE + BD * 2}
              fill="#111"
              rx={1.5}
            />
            {Array.from({ length: 9 }).map((_, i) => {
              const sr = Math.floor(i / 3);
              const sc = i % 3;
              const x = fx + sc * (S + G);
              const y = fy + sr * (S + G);
              const colorKey = stickers?.[i];
              const fill =
                colorKey && CSTIMER_COLOR_MAP[colorKey]
                  ? CSTIMER_COLOR_MAP[colorKey]
                  : defaultColor;
              return (
                <rect key={i} x={x} y={y} width={S} height={S} fill={fill} rx={1} />
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMs(ms: number): string {
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(2)}s`;
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(2).padStart(5, "0");
  return `${m}:${sec}`;
}

// ─── Single pair card ─────────────────────────────────────────────────────────

function PairCard({ record }: { record: PairRecord }) {
  return (
    <div className="flex gap-3 rounded-xl border border-line bg-surface p-3">
      {/* Mini cube net */}
      <div className="shrink-0 w-20 sm:w-24">
        <MiniCubeNet facelets={record.startFacelets} />
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col gap-1.5 min-w-0">
        {/* Header row: pair number + slot badge */}
        <div className="flex items-center gap-2">
          <span className="nums text-xs font-bold text-ink">#{record.index}</span>
          <span
            className="rounded-md px-1.5 py-0.5 text-[0.65rem] font-semibold text-surface"
            style={{ backgroundColor: record.colorDef.colorName }}
          >
            {record.slotId}
          </span>
          <ChevronRight className="size-3 text-ink-3 ml-auto" />
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
