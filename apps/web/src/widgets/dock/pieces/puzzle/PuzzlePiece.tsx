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
  variant?: "tray" | "chip";
}

/** Puzzle category selector — flat "tray" item in the desktop dock, bordered chip on touch. */
export function PuzzlePiece({
  puzzle,
  onPuzzleChange,
  variant = "tray",
}: PuzzlePieceProps) {
  const { t } = useTranslation("shell");

  return (
    <Select value={puzzle} onValueChange={(v) => onPuzzleChange?.(v as PuzzleCategory)}>
      <SelectTrigger
        size="sm"
        className={
          variant === "tray"
            ? "h-8 justify-center gap-1.5 rounded-full border-transparent bg-transparent px-2.5 py-0 text-xs font-medium leading-none text-ink-2 shadow-none focus:ring-1 focus:ring-ink hover:bg-surface-2 hover:text-ink dark:bg-transparent dark:hover:bg-surface-2"
            : "w-30 max-lg:w-24 max-lg:min-h-8! gap-2 rounded-md border border-line bg-surface text-xs text-ink-2 focus:ring-1 focus:ring-ink dark:bg-surface dark:hover:bg-surface-2"
        }
        aria-label={t("puzzleCategory")}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
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
