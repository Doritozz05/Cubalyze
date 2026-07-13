"use client";

import { useMemo } from "react";
import { MoreHorizontal, Plus, Skull, Eraser, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { effectiveTime } from "@/types";
import { formatTime, computeStats } from "@/utils/formatTime";
import type { Solve, Penalty } from "@/types";
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

export interface TimesListProps {
  solves: Solve[];
  onUpdate: (id: string, updates: Partial<Solve>) => void;
  onDelete: (id: string) => void;
  onClear?: () => void;
  className?: string;
}

function PenaltyBadge({ penalty }: { penalty: Penalty }) {
  if (penalty === "none") return null;
  const cls =
    penalty === "DNF"
      ? "bg-dnf-soft text-dnf"
      : "bg-plus2-soft text-plus2";
  return (
    <span
      className={cn(
        "nums rounded px-1.5 py-0.5 text-[0.58rem] font-medium uppercase tracking-wide",
        cls,
      )}
    >
      {penalty}
    </span>
  );
}

/**
 * Vertical solve log. Each row exposes a dropdown with +2 / DNF / clear /
 * delete. Newest first. Highlights the session best (PB) row with a green dot.
 */
export function TimesList({
  solves,
  onUpdate,
  onDelete,
  onClear,
  className,
}: TimesListProps) {
  const stats = useMemo(() => computeStats(solves), [solves]);
  const bestTime = Number.isFinite(stats.best) ? stats.best : null;

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
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
              const isBest =
                bestTime !== null && eff === bestTime && !isDnf;
              return (
                <li
                  key={solve.id}
                  className="group flex items-center gap-2.5 border-b border-line/70 px-1 py-[9px] transition-colors hover:bg-surface-2 last:border-0"
                >
                  {/* Index + best marker */}
                  <span className="flex w-8 shrink-0 items-center justify-end gap-1">
                    {isBest ? (
                      <span
                        className="size-1.5 shrink-0 rounded-full bg-ready"
                        title="Session best"
                      />
                    ) : (
                      <span className="size-1.5 shrink-0" />
                    )}
                    <span className="nums text-right text-xs text-ink-3">
                      {solves.length - i}
                    </span>
                  </span>

                  {/* Time */}
                  <span
                    className={cn(
                      "nums min-w-0 flex-1 text-[0.95rem] tabular-nums",
                      isDnf ? "text-dnf" : isBest ? "text-ready" : "text-ink",
                    )}
                  >
                    {isDnf ? "DNF" : formatTime(eff)}
                  </span>

                  <PenaltyBadge penalty={solve.penalty} />

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-ink-3 opacity-0 transition-opacity hover:text-ink focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
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
                        <Skull className="size-3.5" />
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
            })}
          </ul>
        </ScrollArea>
      )}
    </div>
  );
}
