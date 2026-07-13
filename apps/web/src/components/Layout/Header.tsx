"use client";

import { useState } from "react";
import { Grid3x3, Timer, Plus, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { PuzzleCategory } from "@/types";
import type { SessionMeta } from "@/hooks/usePersistentSession";

const CATEGORIES: PuzzleCategory[] = [
  "2x2",
  "3x3",
  "4x4",
  "5x5",
  "6x6",
  "7x7",
  "3x3 OH",
  "Megaminx",
  "Pyraminx",
  "Skewb",
];

export interface HeaderProps {
  pb?: number | null;
  /** Current session solve count, shown as a small chip. */
  sessionCount?: number;
  /** All known sessions (for the session switcher). */
  sessions?: SessionMeta[];
  /** Active session id. */
  activeSessionId?: string | null;
  /** Switch to a session. */
  onSwitchSession?: (id: string) => void;
  /** Create + switch to a new session. */
  onNewSession?: () => void;
  className?: string;
}

/**
 * Slim, flat top bar. Wordmark left, puzzle selector + settings right.
 * Includes a session switcher dropdown + dark-mode toggle.
 */
export function Header({
  pb,
  sessionCount,
  sessions,
  activeSessionId,
  onSwitchSession,
  onNewSession,
  className,
}: HeaderProps) {
  const [puzzle, setPuzzle] = useState<PuzzleCategory>("3x3");
  const active = sessions?.find((s) => s.id === activeSessionId) ?? null;

  return (
    <header
      className={cn(
        "sticky top-0 z-20 border-b border-line bg-surface/85 backdrop-blur",
        className,
      )}
    >
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="grid size-7 place-items-center rounded-md bg-ink text-surface">
            <Grid3x3 className="size-4" />
          </div>
          <span className="nums text-base font-semibold tracking-tight text-ink">
            cubit
          </span>
          <span className="hidden h-3.5 w-px bg-line md:inline" aria-hidden />
          <span className="hidden text-[0.68rem] uppercase tracking-[0.2em] text-ink-3 md:inline">
            speedcubing timer
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Session switcher */}
          {sessions && sessions.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="hidden h-8 gap-1.5 rounded-md border border-line bg-surface px-2.5 text-xs text-ink-2 hover:bg-surface-2 hover:text-ink sm:flex"
                  aria-label="Switch session"
                >
                  <History className="size-3.5 text-ink-3" />
                  <span className="nums max-w-[7rem] truncate">
                    {active?.name ?? "Session"}
                  </span>
                  <span className="text-ink-3">·</span>
                  <span className="nums text-ink-3">{sessionCount ?? 0}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-[0.62rem] uppercase tracking-[0.18em] text-ink-3">
                  Sessions
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {sessions.map((s) => (
                  <DropdownMenuItem
                    key={s.id}
                    onClick={() => onSwitchSession?.(s.id)}
                    className={cn(
                      "gap-2",
                      s.id === activeSessionId && "bg-surface-2",
                    )}
                  >
                    <span className="nums flex-1 truncate text-xs">
                      {s.name}
                    </span>
                    <span className="nums text-[0.65rem] text-ink-3">
                      {s.solveCount}
                    </span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onNewSession?.()}>
                  <Plus className="size-3.5" />
                  New session
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}

          {pb != null && Number.isFinite(pb) ? (
            <div className="hidden items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-1 sm:flex">
              <Timer className="size-3.5 text-ink-3" />
              <span className="text-[0.62rem] uppercase tracking-[0.16em] text-ink-3">
                PB
              </span>
              <span className="nums text-xs text-ink">
                {formatPb(pb)}
              </span>
            </div>
          ) : null}

          <Select value={puzzle} onValueChange={(v) => setPuzzle(v as PuzzleCategory)}>
            <SelectTrigger
              className="h-8 w-[7.5rem] gap-2 rounded-md border-line bg-surface text-xs text-ink-2"
              aria-label="Puzzle category"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c} className="text-xs">
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

function formatPb(ms: number): string {
  const totalCs = Math.floor(ms / 10);
  const cs = totalCs % 100;
  const s = Math.floor(totalCs / 100);
  const m = Math.floor(s / 60);
  if (m > 0) return `${m}:${(s % 60).toString().padStart(2, "0")}.${cs.toString().padStart(2, "0")}`;
  return `${s}.${cs.toString().padStart(2, "0")}`;
}
