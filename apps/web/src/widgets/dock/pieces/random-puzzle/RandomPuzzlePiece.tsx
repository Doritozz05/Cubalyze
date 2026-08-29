"use client";

import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion, useAnimationControls } from "framer-motion";
import { Dices, CheckCheck, XSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PuzzleCategory } from "@/types";
import { PUZZLE_SELECTOR } from "@/utils/puzzleUtils";
import { useRandomPuzzleStore } from "./randomPuzzleStore";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuCheckboxItem,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

export interface RandomPuzzlePieceProps {
  puzzle: PuzzleCategory;
  onPuzzleChange?: (puzzle: PuzzleCategory) => void;
  className?: string;
}

const ITEM_HEIGHT = 32; // height in px of each reel slot item

export function RandomPuzzlePiece({
  puzzle,
  onPuzzleChange,
  className,
}: RandomPuzzlePieceProps) {
  const { t } = useTranslation("dock");
  const { enabledPuzzles, togglePuzzle, selectAll, deselectAll, isPuzzleEnabled } =
    useRandomPuzzleStore();

  const [isSpinning, setIsSpinning] = useState(false);
  const [displayPuzzle, setDisplayPuzzle] = useState<PuzzleCategory>(puzzle);
  const [reelItems, setReelItems] = useState<PuzzleCategory[]>([puzzle]);
  const [isFlashing, setIsFlashing] = useState(false);

  const reelControls = useAnimationControls();
  const leverControls = useAnimationControls();

  // Sync display puzzle with incoming prop when idle
  useEffect(() => {
    if (!isSpinning) {
      setDisplayPuzzle(puzzle);
      setReelItems([puzzle]);
    }
  }, [puzzle, isSpinning]);

  const spin = useCallback(async () => {
    if (isSpinning) return;

    // Filter available pool
    const pool = enabledPuzzles.length > 0 ? enabledPuzzles : [puzzle];
    if (pool.length === 0) return;

    // Pick target: if multiple available, try picking one different from current if possible
    let target = pool[Math.floor(Math.random() * pool.length)];
    if (pool.length > 1 && target === displayPuzzle) {
      const remaining = pool.filter((p) => p !== displayPuzzle);
      if (remaining.length > 0) {
        target = remaining[Math.floor(Math.random() * remaining.length)];
      }
    }

    // Build the slot machine reel sequence (12-16 items rolling down)
    const sequenceLength = 14;
    const sequence: PuzzleCategory[] = [displayPuzzle];
    for (let i = 1; i < sequenceLength - 1; i++) {
      sequence.push(pool[Math.floor(Math.random() * pool.length)]);
    }
    sequence.push(target);

    setReelItems(sequence);
    setIsSpinning(true);

    // Animate the lever pull down and spring back up
    leverControls.start({
      rotate: [0, 52, 60, -8, 0],
      y: [0, 5, 6, -1, 0],
      transition: { duration: 0.45, ease: "easeInOut" },
    });

    // Reset reel position
    await reelControls.set({ y: 0 });

    // Calculate final scroll distance
    const totalDistance = -(sequenceLength - 1) * ITEM_HEIGHT;

    // Spin reel animation with deceleration physics
    await reelControls.start({
      y: [0, 8, totalDistance - 6, totalDistance],
      transition: {
        duration: 1.5,
        times: [0, 0.08, 0.88, 1],
        ease: [0.16, 0.84, 0.28, 1],
      },
    });

    // Landing victory flash & finalize state
    setDisplayPuzzle(target);
    setReelItems([target]);
    await reelControls.set({ y: 0 });
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 650);

    setIsSpinning(false);
    onPuzzleChange?.(target);
  }, [isSpinning, enabledPuzzles, puzzle, displayPuzzle, leverControls, reelControls, onPuzzleChange]);

  const playablePuzzles = PUZZLE_SELECTOR.filter((p) => p.playable);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          data-slot="context-menu-trigger"
          onContextMenu={(e) => e.stopPropagation()}
          className="relative inline-flex items-center"
        >
          <button
            type="button"
            onClick={spin}
            disabled={isSpinning}
            className={cn(
              "group relative flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface pl-2.5 pr-1.5 text-xs text-ink-2 shadow-xs transition-colors duration-200 select-none",
              "hover:bg-surface-2 hover:text-ink",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              isSpinning && "cursor-wait bg-surface-2 text-ink",
              className,
            )}
            aria-label={t("spinPuzzle")}
          >
            {/* Dice icon — consistently amber/yellow */}
            <div
              className={cn(
                "flex size-4.5 shrink-0 items-center justify-center rounded-full text-amber-500 dark:text-amber-400 transition-transform duration-300",
                isSpinning && "rotate-180",
              )}
            >
              <Dices className="size-3.5" />
            </div>

            {/* Slot machine reel viewport */}
            <div className="relative h-8 w-20 overflow-hidden rounded-md border border-line/40 bg-surface-2/40 px-1.5 shadow-inner">
              {/* Top/bottom cylinder 3D shadows */}
              <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-2 bg-linear-to-b from-surface/90 to-transparent" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-2 bg-linear-to-t from-surface/90 to-transparent" />

              {/* Reel items container */}
              <motion.div
                animate={reelControls}
                className={cn(
                  "flex flex-col items-center",
                  isSpinning && "filter blur-[0.3px]",
                )}
              >
                {reelItems.map((item, idx) => (
                  <div
                    key={`${item}-${idx}`}
                    className="flex h-8 w-full shrink-0 items-center justify-center text-center leading-none"
                  >
                    <span
                      className={cn(
                        "nums truncate text-[0.72rem] font-semibold tracking-tight transition-all",
                        isFlashing && idx === reelItems.length - 1
                          ? "font-bold scale-105 text-ink"
                          : "text-ink",
                      )}
                    >
                      {item}
                    </span>
                  </div>
                ))}
              </motion.div>
            </div>

            {/* Slot Machine Lever */}
            <div className="relative flex h-full items-center px-0.5">
              {/* Lever base fixture */}
              <div className="h-3.5 w-1 rounded-sm bg-line/80 dark:bg-line-2" />

              {/* Animated mechanical arm & knob */}
              <motion.div
                animate={leverControls}
                style={{ originX: "0px", originY: "12px" }}
                className="relative flex flex-col items-center -ml-0.5 cursor-pointer py-1"
              >
                {/* Metallic Knob */}
                <div className="size-2.5 rounded-full shadow-xs bg-linear-to-tr from-red-600 via-rose-500 to-rose-400 transition-transform group-hover:scale-110" />
                {/* Rod */}
                <div className="h-3 w-0.5 bg-linear-to-b from-line-2 to-line" />
              </motion.div>
            </div>
          </button>
        </div>
      </ContextMenuTrigger>

      {/* Right Click Context Menu */}
      <ContextMenuContent alignOffset={-5} className="w-56">
        <ContextMenuLabel className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-ink-3">
          {t("randomPuzzle")}
        </ContextMenuLabel>
        <ContextMenuSeparator />

        <ContextMenuItem
          disabled={isSpinning}
          onClick={spin}
          className="gap-2 text-xs font-medium cursor-pointer"
        >
          <Dices className="size-3.5 text-amber-500" />
          {t("spinPuzzle")}
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuLabel className="text-[0.6rem] uppercase tracking-[0.14em] text-ink-3">
          {t("puzzlePool", "Puzzles en ruleta")}
        </ContextMenuLabel>

        {playablePuzzles.map((item) => {
          const checked = isPuzzleEnabled(item.category);
          const isOnlyOne = checked && enabledPuzzles.length === 1;

          return (
            <ContextMenuCheckboxItem
              key={item.category}
              checked={checked}
              disabled={isOnlyOne}
              onCheckedChange={() => togglePuzzle(item.category)}
              className="text-xs capitalize cursor-pointer"
            >
              {item.category}
            </ContextMenuCheckboxItem>
          );
        })}

        <ContextMenuSeparator />

        <ContextMenuItem
          onClick={selectAll}
          className="gap-2 text-xs cursor-pointer text-ink-2 hover:text-ink"
        >
          <CheckCheck className="size-3.5 text-ink-3" />
          {t("selectAll", "Seleccionar todos")}
        </ContextMenuItem>

        <ContextMenuItem
          onClick={deselectAll}
          className="gap-2 text-xs cursor-pointer text-ink-2 hover:text-ink"
        >
          <XSquare className="size-3.5 text-ink-3" />
          {t("deselectAll", "Desmarcar todos")}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
