"use client";

import { cn } from "@/lib/utils";

export interface AlgorithmNotationProps {
  /** Space-separated notation string (e.g. "R U R' U'"). */
  notation: string;
  /** Indices of moves to highlight (0-based). */
  highlight?: number[];
  /** Mark all moves before the first highlighted index as "passed". */
  highlightCursor?: number;
  size?: "sm" | "md" | "lg";
  variant?: "chip" | "plain";
  className?: string;
  /** Called when a move chip is clicked (index + notation). */
  onMoveClick?: (index: number, move: string) => void;
}

const sizeMap: Record<NonNullable<AlgorithmNotationProps["size"]>, string> = {
  sm: "text-[0.62rem] px-1 py-0.5",
  md: "text-[0.72rem] px-1.5 py-0.5",
  lg: "text-[0.85rem] px-2 py-1",
};

const plainSizeMap: Record<NonNullable<AlgorithmNotationProps["size"]>, string> = {
  sm: "text-[0.78rem]",
  md: "text-[0.85rem]",
  lg: "text-[0.95rem]",
};

/**
 * Renders a sequence of moves as individual mono chips or plain notation text.
 */
export function AlgorithmNotation({
  notation,
  highlight = [],
  highlightCursor,
  size = "md",
  variant = "chip",
  className,
  onMoveClick,
}: AlgorithmNotationProps) {
  const moves = notation.trim().split(/\s+/).filter(Boolean);
  const highlightSet = new Set(highlight);

  if (variant === "plain") {
    return (
      <div className={cn("flex flex-wrap gap-x-1.5 gap-y-0.5 font-mono text-ink tracking-wide leading-relaxed select-text", plainSizeMap[size], className)}>
        {moves.map((move, i) => {
          const isHighlighted = highlightSet.has(i);
          const isPassed =
            highlightCursor != null && i < highlightCursor && !isHighlighted;
          return (
            <span
              key={`${move}-${i}`}
              onClick={onMoveClick ? () => onMoveClick(i, move) : undefined}
              className={cn(
                "font-mono transition-colors",
                onMoveClick && "cursor-pointer hover:underline",
                isHighlighted
                  ? "bg-ink text-surface rounded px-1"
                  : isPassed
                    ? "text-ink-3/40"
                    : "text-ink",
              )}
            >
              {move}
            </span>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-wrap gap-1 font-mono", className)}>
      {moves.map((move, i) => {
        const isHighlighted = highlightSet.has(i);
        const isPassed =
          highlightCursor != null && i < highlightCursor && !isHighlighted;
        return (
          <button
            key={`${move}-${i}`}
            type="button"
            disabled={!onMoveClick}
            onClick={onMoveClick ? () => onMoveClick(i, move) : undefined}
            className={cn(
              "rounded font-mono transition-colors",
              sizeMap[size],
              onMoveClick && "cursor-pointer hover:bg-surface-2",
              isHighlighted
                ? "bg-ink text-surface"
                : isPassed
                  ? "bg-transparent text-ink-3/40"
                  : "bg-surface text-ink-2 border border-line",
            )}
          >
            {move}
          </button>
        );
      })}
    </div>
  );
}
