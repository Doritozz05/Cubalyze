"use client";

import { useState } from "react";
import { Timer, Plus, History, Pencil, Trash2, Check, X, Menu } from "lucide-react";
// `Plus` is reused below for the manual-solve button.
import { useStore } from "zustand";
import { connectionStore } from "@cubeforge/state";
import { cn } from "@/lib/utils";
import { WidgetDock } from "@/widgets/dock";
import { useDockZoneActive } from "@/widgets/dock/dockZoneState";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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

/**
 * Sleek custom SVG Battery icon supporting multi-phase fill & color gradients.
 */
function BatteryIcon({ level }: { level: number | null }) {
  if (level === null) {
    return (
      <svg className="size-4 text-ink-3" viewBox="0 0 24 12" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="1" y="1" width="18" height="10" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M21 4.5V7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M7 6H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
      </svg>
    );
  }

  // Clamp level between 0 and 100
  const pct = Math.max(0, Math.min(100, level));

  // Determine fill color & status phase
  let colorClass = "text-emerald-500 fill-emerald-500";
  if (pct <= 15) {
    colorClass = "text-rose-500 fill-rose-500";
  } else if (pct <= 35) {
    colorClass = "text-amber-500 fill-amber-500";
  } else if (pct <= 65) {
    colorClass = "text-yellow-400 fill-yellow-400";
  } else if (pct <= 85) {
    colorClass = "text-emerald-400 fill-emerald-400";
  }

  // Inner fill width (max inner width is 14px, starting at x=3)
  const fillWidth = Math.max(1.5, (pct / 100) * 14);

  return (
    <svg className={cn("size-4 transition-colors duration-300", colorClass)} viewBox="0 0 24 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Outer shell */}
      <rect x="1" y="1" width="18" height="10" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
      {/* Battery terminal nub */}
      <path d="M21 4.5V7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      {/* Dynamic inner charge fill */}
      <rect x="3" y="3" width={fillWidth} height="6" rx="1.2" fill="currentColor" />
    </svg>
  );
}

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
  /** Rename a session. */
  onRenameSession?: (id: string, name: string) => void;
  /** Delete a session entirely. */
  onDeleteSession?: (id: string) => void;
  /** Toggle the mobile nav sheet. */
  onToggleMobileNav?: () => void;
  /** Open the manual solve entry sheet (the "+" button). */
  onAddManual?: () => void;
  className?: string;
}

/**
 * Slim, flat top bar. Mobile nav trigger left; PB + session switcher + puzzle
 * selector grouped on the right.
 *
 * The session switcher sits next to the puzzle selector so both "what am I
 * working on" context selectors are visually adjacent.
 */
export function Header({
  pb,
  sessionCount,
  sessions,
  activeSessionId,
  onSwitchSession,
  onNewSession,
  onRenameSession,
  onDeleteSession,
  onToggleMobileNav,
  onAddManual,
  className,
}: HeaderProps) {
  const [puzzle, setPuzzle] = useState<PuzzleCategory>("3x3");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<SessionMeta | null>(null);

  const connectionStatus = useStore(connectionStore, (s) => s.status);
  const batteryLevel = useStore(connectionStore, (s) => s.batteryLevel);
  const deviceName = useStore(connectionStore, (s) => s.deviceName);
  const isCubeConnected = connectionStatus === "connected";

  const active = sessions?.find((s) => s.id === activeSessionId) ?? null;
  const isDockZoneActive = useDockZoneActive();

  const startRename = (s: SessionMeta) => {
    setRenamingId(s.id);
    setRenameValue(s.name);
  };

  const commitRename = () => {
    if (renamingId && renameValue.trim()) {
      onRenameSession?.(renamingId, renameValue.trim());
    }
    setRenamingId(null);
  };

  return (
    <header
      className={cn(
        "fixed inset-x-0 md:left-14 top-0 z-20 h-14 border-b bg-surface transition-[border-color] duration-300",
        isDockZoneActive
          ? "border-ink/20"
          : "border-line",
        className,
      )}
    >
      <div className="mx-auto flex h-full w-full items-center justify-between px-4 sm:px-6">
        {/* Left: mobile nav trigger + Smart Cube battery indicator */}
        <div className="flex items-center gap-2.5">
          {onToggleMobileNav && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleMobileNav}
              className="size-8 rounded-md border border-line bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink md:hidden"
              aria-label="Open navigation"
            >
              <Menu className="size-4" />
            </Button>
          )}

          {/* Battery % chip — only shown when a Smart Cube is connected */}
          {isCubeConnected && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-1 text-xs text-ink cursor-default select-none"
                >
                  <BatteryIcon level={batteryLevel} />
                  <span className="nums font-medium text-ink">
                    {batteryLevel !== null ? `${batteryLevel}%` : "--%"}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {batteryLevel !== null
                  ? `Smart Cube (${deviceName ?? "Connected"}): ${batteryLevel}% battery`
                  : `Smart Cube (${deviceName ?? "Connected"})`}
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Center: Widget dock — dynamic flowing row like Apple menu bar */}
        <div className="flex flex-1 items-center min-w-0 px-4">
          <WidgetDock />
        </div>

        {/* Right: PB + session + manual + puzzle grouped together */}
        <div className="flex items-center gap-2">
          {onAddManual ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onAddManual}
                  className="size-8 rounded-md border border-line bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink"
                  aria-label="Add manual solve"
                >
                  <Plus className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Add manual solve</TooltipContent>
            </Tooltip>
          ) : null}
          {pb != null && Number.isFinite(pb) ? (
            <div className="hidden h-8 items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 sm:flex">
              <Timer className="size-3.5 text-ink-3" />
              <span className="text-[0.62rem] uppercase tracking-[0.16em] text-ink-3">
                PB
              </span>
              <span className="nums text-xs text-ink">
                {formatPb(pb)}
              </span>
            </div>
          ) : null}

          {/* Session switcher — next to the puzzle selector */}
          {sessions && sessions.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-8 gap-1.5 rounded-md border border-line bg-surface px-2.5 text-xs text-ink-2 hover:bg-surface-2 hover:text-ink"
                  aria-label="Switch session"
                >
                  <History className="size-3.5 text-ink-3" />
                  <span className="nums max-w-28 truncate">
                    {active?.name ?? "Session"}
                  </span>
                  <span className="text-ink-3">·</span>
                  <span className="nums text-ink-3">{sessionCount ?? 0}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="text-[0.62rem] uppercase tracking-[0.18em] text-ink-3">
                  Sessions
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    className="group/sess flex items-center"
                  >
                    {renamingId === s.id ? (
                      <div className="flex flex-1 items-center gap-1 px-2 py-1">
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitRename();
                            if (e.key === "Escape") setRenamingId(null);
                          }}
                          className="nums h-7 min-w-0 flex-1 rounded-sm border border-line bg-surface px-1.5 text-xs text-ink outline-none focus:border-ink-2"
                        />
                        <button
                          onClick={commitRename}
                          className="grid size-6 place-items-center rounded text-ink-2 hover:bg-surface-2 hover:text-ink transition-colors"
                          aria-label="Confirm rename"
                        >
                          <Check className="size-3.5" />
                        </button>
                        <button
                          onClick={() => setRenamingId(null)}
                          className="grid size-6 place-items-center rounded text-ink-3 hover:bg-surface-2 hover:text-ink transition-colors"
                          aria-label="Cancel rename"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => onSwitchSession?.(s.id)}
                          className={cn(
                            "flex flex-1 items-center gap-2 px-2 py-1.5 text-left text-xs transition-colors hover:bg-surface-2",
                            s.id === activeSessionId && "bg-surface-2",
                          )}
                        >
                          <span className="nums min-w-0 flex-1 truncate text-ink">
                            {s.name}
                          </span>
                          <span className="nums shrink-0 text-[0.65rem] text-ink-3">
                            {s.solveCount}
                          </span>
                        </button>
                        <div className="flex shrink-0 items-center gap-0.5 pr-1 text-ink-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startRename(s);
                            }}
                            className="grid size-6 place-items-center rounded hover:bg-surface-2 hover:text-ink transition-colors"
                            aria-label={`Rename ${s.name}`}
                          >
                            <Pencil className="size-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(s);
                            }}
                            className="grid size-6 place-items-center rounded hover:bg-surface-2 hover:text-dnf transition-colors"
                            aria-label={`Delete ${s.name}`}
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onNewSession?.()}>
                  <Plus className="size-3.5" />
                  New session
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}

          <Select value={puzzle} onValueChange={(v) => setPuzzle(v as PuzzleCategory)}>
            <SelectTrigger
              size="sm"
              // Explicit dark variants beat the Radix primitive's `dark:bg-input/30`
              // so the chip matches the sibling PB / session chips in dark mode.
              className="w-30 gap-2 rounded-md border border-line bg-surface text-xs text-ink-2 focus:ring-1 focus:ring-ink dark:bg-surface dark:hover:bg-surface-2"
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
        </div>
      </div>

      {/* Delete-session confirmation */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">
              Delete “{deleteTarget?.name}”?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              This permanently removes the session and all{" "}
              {deleteTarget?.solveCount ?? 0} of its solves. This can’t be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8 text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="h-8 bg-dnf text-xs text-white hover:bg-dnf/90"
              onClick={() => {
                if (deleteTarget) onDeleteSession?.(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
