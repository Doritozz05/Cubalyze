"use client";

import { useState } from "react";
import { Grid3x3, Timer, Plus, History, Pencil, Trash2, Check, X, Box } from "lucide-react";
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
import { CubeConnector } from "@/components/Hardware/CubeConnector";
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
  /** Rename a session. */
  onRenameSession?: (id: string, name: string) => void;
  /** Delete a session entirely. */
  onDeleteSession?: (id: string) => void;
  /** Whether the 3D cube view is currently active. */
  cube3DActive?: boolean;
  /** Toggle the 3D cube view. */
  onToggleCube3D?: () => void;
  className?: string;
}

/**
 * Slim, flat top bar. Wordmark left, puzzle selector + settings right.
 * Includes a session switcher dropdown (with rename/delete) + dark-mode toggle.
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
  cube3DActive,
  onToggleCube3D,
  className,
}: HeaderProps) {
  const [puzzle, setPuzzle] = useState<PuzzleCategory>("3x3");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<SessionMeta | null>(null);

  const active = sessions?.find((s) => s.id === activeSessionId) ?? null;

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
        "sticky top-0 z-20 border-b border-line bg-surface/85 backdrop-blur",
        className,
      )}
    >
      <div className="mx-auto flex h-14 w-full items-center justify-between px-4 sm:px-6">
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
                          className="nums h-7 min-w-0 flex-1 rounded border border-line bg-surface px-1.5 text-xs text-ink outline-none focus:border-ink-3"
                        />
                        <button
                          onClick={commitRename}
                          className="grid size-6 place-items-center rounded text-ready hover:bg-ready-soft"
                          aria-label="Confirm rename"
                        >
                          <Check className="size-3.5" />
                        </button>
                        <button
                          onClick={() => setRenamingId(null)}
                          className="grid size-6 place-items-center rounded text-ink-3 hover:bg-surface-2"
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
                        <div className="flex shrink-0 items-center pr-1 opacity-0 transition-opacity group-hover/sess:opacity-100 data-open:opacity-100">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startRename(s);
                            }}
                            className="grid size-6 place-items-center rounded text-ink-3 hover:bg-surface-2 hover:text-ink"
                            aria-label={`Rename ${s.name}`}
                          >
                            <Pencil className="size-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(s);
                            }}
                            className="grid size-6 place-items-center rounded text-ink-3 hover:bg-dnf-soft hover:text-dnf"
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

          <CubeConnector />

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
              className="h-8 w-30 gap-2 rounded-md border-line bg-surface text-xs text-ink-2"
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

          <Button
            variant={cube3DActive ? "default" : "ghost"}
            size="icon"
            onClick={onToggleCube3D}
            className={cn(
              "size-8",
              cube3DActive
                ? "bg-ink text-surface hover:bg-ink/90"
                : "text-ink-2 hover:text-ink",
            )}
            aria-label={cube3DActive ? "Hide 3D cube" : "Show 3D cube"}
            aria-pressed={cube3DActive}
            title={cube3DActive ? "Hide 3D cube" : "Show 3D cube"}
          >
            <Box className="size-4" />
          </Button>

          <ThemeToggle />
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
