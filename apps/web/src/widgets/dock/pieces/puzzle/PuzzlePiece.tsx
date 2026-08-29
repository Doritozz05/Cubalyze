"use client";

import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PUZZLE_SELECTOR } from "@/utils/puzzleUtils";
import type { PuzzleCategory } from "@/types";

export interface PuzzlePieceProps {
  puzzle: PuzzleCategory;
  onPuzzleChange?: (puzzle: PuzzleCategory) => void;
  variant?: "tray" | "chip" | "center";
  /** Small caption shown under the puzzle (mobile "center" variant) — e.g. the session name. */
  caption?: string;
}

/**
 * Puzzle category selector — flat "tray" item in the desktop dock, bordered
 * chip on touch, or a centered two-line label (puzzle + session caption)
 * for the minimal mobile header. The select sheet still opens on tap.
 */
export function PuzzlePiece({
  puzzle,
  onPuzzleChange,
  variant = "tray",
  caption,
}: PuzzlePieceProps) {
  const { t } = useTranslation("shell");

  return (
    <Select value={puzzle} onValueChange={(v) => onPuzzleChange?.(v as PuzzleCategory)}>
      <SelectTrigger
        size="sm"
        className={
          variant === "tray"
            ? "h-8 gap-2 rounded-full border-transparent bg-transparent pl-2.5 pr-2 py-0 text-xs font-medium leading-normal text-ink-2 shadow-none focus:ring-1 focus:ring-ink hover:bg-surface-2 hover:text-ink dark:bg-transparent dark:hover:bg-surface-2"
            : variant === "center"
              ? "relative h-11 justify-center rounded-xl border-transparent bg-transparent px-5 py-0 text-sm font-semibold leading-normal text-ink shadow-none focus:ring-1 focus:ring-ink hover:bg-surface-2 dark:bg-transparent dark:hover:bg-surface-2 [&>svg]:absolute [&>svg]:right-1 [&>svg]:top-1/2 [&>svg]:-translate-y-1/2"
              : "w-30 max-lg:w-24 max-lg:min-h-8! gap-2 rounded-md border border-line bg-surface text-xs text-ink-2 focus:ring-1 focus:ring-ink dark:bg-surface dark:hover:bg-surface-2"
        }
        aria-label={t("puzzleCategory")}
      >
        {variant === "center" ? (
          <span className="flex flex-col items-center gap-1 leading-normal">
            <SelectValue />
            {caption ? (
              <span className="max-w-36 truncate text-[0.62rem] font-medium text-ink-3">
                {caption}
              </span>
            ) : null}
          </span>
        ) : (
          <SelectValue />
        )}
      </SelectTrigger>
      {/* align="center" keeps the list centered under the button — with the
          default "start" the wider list extends to the right of the label. */}
      <SelectContent align="center">
        {PUZZLE_SELECTOR.map((item) => (
          <SelectItem
            key={item.category}
            value={item.category}
            disabled={!item.playable}
            className="text-xs"
          >
            {item.planned ? `${item.category} — ${t("upcoming")}` : item.category}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
