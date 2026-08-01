"use client";

import { useMemo, memo, useState, useRef, useEffect } from "react";
import { MoreHorizontal, Plus, XCircle, Eraser, Trash2, Activity, RotateCcw, Pencil, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { effectiveTime } from "@/types";
import { formatTime } from "@/utils/formatTime";
import type { Solve } from "@/types";
import { PenaltyBadge } from "@/components/Insights/atoms";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ScrollArea,
} from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export interface TimesListProps {
  solves: Solve[];
  onUpdate: (id: string, updates: Partial<Solve>) => void;
  onDelete: (id: string) => void;
  onClear?: () => void;
  onAnalyze?: (solve: Solve) => void;
  onReplay?: (solve: Solve) => void;
  hideHeader?: boolean;
  className?: string;
}

/**
 * Vertical solve log. Each row exposes a dropdown with +2 / DNF / clear /
 * delete. Newest first. Highlights the session best (PB) row with a green dot.
 *
 * Includes inline note editing — click the note area to type.
 *
 * Memoized so dragging a parent floating panel doesn't re-render the whole
 * list on every pointermove.
 */
function formatPuzzleBadge(puzzleType?: string): string {
  if (!puzzleType || puzzleType === "3x3x3" || puzzleType === "3x3") return "3x3";
  if (puzzleType === "2x2x2" || puzzleType === "2x2") return "2x2";
  if (puzzleType === "4x4x4" || puzzleType === "4x4") return "4x4";
  return puzzleType;
}

export const TimesList = memo(function TimesList({
  solves,
  onUpdate,
  onDelete,
  onClear,
  onAnalyze,
  onReplay,
  hideHeader,
  className,
}: TimesListProps) {
  const bestTimePerPuzzle = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of solves) {
      const pType = s.puzzleType ?? "3x3x3";
      const eff = effectiveTime(s);
      if (Number.isFinite(eff)) {
        const current = map.get(pType);
        if (current === undefined || eff < current) {
          map.set(pType, eff);
        }
      }
    }
    return map;
  }, [solves]);

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      {!hideHeader && (
        <div className="flex items-center justify-between border-b border-line px-1 pb-2.5">
          <div className="flex items-baseline gap-2">
            <h3 className="text-sm font-medium text-ink">Solves</h3>
            <span className="nums text-xs text-ink-3">{solves.length}</span>
          </div>
          {solves.length > 0 && onClear ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="h-7 px-2 text-xs text-ink-3 hover:text-dnf"
            >
              Clear
            </Button>
          ) : null}
        </div>
      )}

      {solves.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 py-16 text-center">
          <p className="text-sm text-ink-2">No solves yet</p>
          <p className="text-xs text-ink-3">
            Hold the timer (or press Space) to start.
          </p>
        </div>
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          <ul>
            {solves.map((solve, i) => {
              const eff = effectiveTime(solve);
              const isDnf = !Number.isFinite(eff);
              const pType = solve.puzzleType ?? "3x3x3";
              const bestForPuzzle = bestTimePerPuzzle.get(pType);
              const isBest =
                bestForPuzzle !== undefined && eff === bestForPuzzle && !isDnf;
              return (
                <SolveRow
                  key={solve.id}
                  solve={solve}
                  index={solves.length - i}
                  isDnf={isDnf}
                  isBest={isBest}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                  onAnalyze={onAnalyze}
                  onReplay={onReplay}
                />
              );
            })}
          </ul>
        </ScrollArea>
      )}
    </div>
  );
});

/** Individual solve row with inline note editing. */
const SolveRow = memo(function SolveRow({
  solve,
  index,
  isDnf,
  isBest,
  onUpdate,
  onDelete,
  onAnalyze,
  onReplay,
}: {
  solve: Solve;
  index: number;
  isDnf: boolean;
  isBest: boolean;
  onUpdate: (id: string, updates: Partial<Solve>) => void;
  onDelete: (id: string) => void;
  onAnalyze?: (solve: Solve) => void;
  onReplay?: (solve: Solve) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(solve.note ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  // Sync draft when solve.note changes externally
  useEffect(() => {
    setDraft(solve.note ?? '');
  }, [solve.note]);

  const saveNote = () => {
    const trimmed = draft.trim();
    onUpdate(solve.id, { note: trimmed || undefined });
    setEditing(false);
  };

  const cancelNote = () => {
    setDraft(solve.note ?? "");
    setEditing(false);
  };

  const handleNoteClick = () => {
    setDraft(solve.note ?? "");
    setEditing(true);
  };

  const eff = effectiveTime(solve);

  return (
    <li
      className="group flex items-center gap-2.5 border-b border-line/70 px-1 py-2.25 transition-colors hover:bg-surface-2 last:border-0"
    >
      {/* Index + best marker */}
      <span className="flex w-8 shrink-0 items-center justify-end gap-1">
        {isBest ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="size-1.5 shrink-0 rounded-full bg-ready" />
            </TooltipTrigger>
            <TooltipContent side="right">Session best</TooltipContent>
          </Tooltip>
        ) : (
          <span className="size-1.5 shrink-0" />
        )}
        <span className="nums text-right text-xs text-ink-3">
          {index}
        </span>
      </span>

      {/* Time + Puzzle Badge */}
      <div className="min-w-0 flex-1 flex items-center gap-1.5">
        <span
          className={cn(
            "nums text-[0.95rem] tabular-nums",
            isDnf ? "text-dnf" : isBest ? "text-ready" : "text-ink",
          )}
        >
          {isDnf
            ? solve.time > 0
              ? `DNF(${formatTime(solve.time)})`
              : "DNF"
            : `${formatTime(eff)}${solve.penalty === "+2" ? "+" : ""}`}
        </span>
        <span className="rounded bg-surface-2 border border-line/60 px-1 py-0.2 text-[0.55rem] font-semibold text-ink-3 tracking-wide uppercase shrink-0">
          {formatPuzzleBadge(solve.puzzleType)}
        </span>
      </div>

      <PenaltyBadge penalty={solve.penalty} />

      {/* Note area — click to edit */}
      {editing ? (
        <div className="flex items-center gap-1 shrink-0">
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveNote();
              if (e.key === "Escape") cancelNote();
              e.stopPropagation();
            }}
            className="h-6 w-24 rounded border border-line bg-surface-2/50 px-1.5 text-[0.68rem] text-ink placeholder:text-ink-3/40 focus:outline-none focus:border-ink/30"
            placeholder="Note..."
          />
          <button
            onClick={saveNote}
            className="grid size-5 place-items-center rounded text-ink-3 hover:text-ready"
          >
            <Check className="size-3" />
          </button>
          <button
            onClick={cancelNote}
            className="grid size-5 place-items-center rounded text-ink-3 hover:text-dnf"
          >
            <X className="size-3" />
          </button>
        </div>
      ) : solve.note ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleNoteClick}
              className="max-w-25 shrink-0 truncate rounded px-1.5 py-0.5 text-[0.62rem] text-ink-2 italic hover:bg-surface-2 hover:text-ink transition-colors"
              title={solve.note}
            >
              {solve.note}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">{solve.note}</TooltipContent>
        </Tooltip>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleNoteClick}
              className="shrink-0 grid size-7 place-items-center rounded text-ink-3 hover:text-ink transition-colors"
              aria-label="Add note"
            >
              <Pencil className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Add note</TooltipContent>
        </Tooltip>
      )}

      {onAnalyze && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onAnalyze(solve)}
              className="size-7 text-ink-3 hover:text-ink"
              aria-label="Analyze solve"
            >
              <Activity className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Analysis</TooltipContent>
        </Tooltip>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-ink-3 hover:text-ink data-[state=open]:text-ink"
            aria-label="Solve actions"
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem
            onClick={() =>
              onUpdate(solve.id, {
                penalty: solve.penalty === "+2" ? "none" : "+2",
              })
            }
          >
            <Plus className="size-3.5" />
            {solve.penalty === "+2" ? "Remove +2" : "Mark +2"}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              onUpdate(solve.id, {
                penalty:
                  solve.penalty === "DNF" ? "none" : "DNF",
              })
            }
          >
            <XCircle className="size-3.5" />
            {solve.penalty === "DNF" ? "Remove DNF" : "Mark DNF"}
          </DropdownMenuItem>
          {solve.penalty !== "none" ? (
            <DropdownMenuItem
              onClick={() =>
                onUpdate(solve.id, { penalty: "none" })
              }
            >
              <Eraser className="size-3.5" />
              Clear penalty
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          {onAnalyze && (
            <DropdownMenuItem onClick={() => onAnalyze(solve)}>
              <Activity className="size-3.5" />
              Analysis
            </DropdownMenuItem>
          )}
          {onReplay && (
            <DropdownMenuItem onClick={() => onReplay(solve)}>
              <RotateCcw className="size-3.5" />
              Replay
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => onDelete(solve.id)}
          >
            <Trash2 className="size-3.5" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
});
