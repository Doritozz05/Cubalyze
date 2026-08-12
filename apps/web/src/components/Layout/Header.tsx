"use client";

import { useState, useEffect, useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Plus,
  History,
  Pencil,
  Trash2,
  Check,
  X,
  Puzzle,
  Battery,
  BatteryLow,
  BatteryMedium,
  BatteryFull,
  BatteryWarning,
} from "lucide-react";
// `Plus` is reused below for the manual-solve button.
import { useStore } from "zustand";
import { connectionStore } from "@cubeforge/state";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { TOUCH_FULL_BLEED } from "@/lib/touch";
import { SIDEBAR_MOTION } from "./sidebar.constants";
import { WidgetDock } from "@/widgets/dock";
import { WidgetExplorer } from "@/widgets/explorer";
import { useWidgetStore } from "@/widgets/widgetStore";
import { useIsTouch } from "@/hooks/use-mobile";
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
import { MobileSessionSheet } from "./MobileSessionSheet";
import type { PuzzleCategory } from "@/types";
import type { SessionMeta } from "@/hooks/usePersistentSession";
import { PUZZLE_CATEGORIES } from "@/utils/puzzleUtils";

/**
 * Sleek Lucide Battery icon component changing icon state & vibrant color based on charge percentage.
 */
function BatteryIcon({ level }: { level: number | null }) {
  if (level === null) {
    return <Battery className="size-4 text-ink-3 opacity-60" />;
  }

  const pct = Math.max(0, Math.min(100, level));

  // Critical low battery (<= 15%): red warning icon
  if (pct <= 15) {
    return <BatteryWarning className="size-4 text-rose-500" />;
  }

  // Low battery (16% - 35%): warm amber 1-bar icon
  if (pct <= 35) {
    return <BatteryLow className="size-4 text-amber-500" />;
  }

  // Medium battery (36% - 75%): vibrant emerald 2-bar icon (shows 1/2 / middle stage)
  if (pct <= 75) {
    return <BatteryMedium className="size-4 text-emerald-500" />;
  }

  // Full battery (> 75%): vibrant emerald full icon
  return <BatteryFull className="size-4 text-emerald-500" />;
}

// ── Glass-dock sub-components (desktop) ───────────────────────────────────

/** Smart Cube battery % chip — status-tray style, pinned to the header edge. */
function BatteryStatusChip() {
  const { t } = useTranslation("shell");
  const connectionStatus = useStore(connectionStore, (s) => s.status);
  const batteryLevel = useStore(connectionStore, (s) => s.batteryLevel);
  const deviceName = useStore(connectionStore, (s) => s.deviceName);
  const isCubeConnected = connectionStatus === "connected";

  if (!isCubeConnected) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex h-8 cursor-default items-center gap-1.5 rounded-full border border-line/70 bg-surface/80 px-2.5 text-xs text-ink select-none">
          <BatteryIcon level={batteryLevel} />
          <span className="nums font-medium text-ink">
            {batteryLevel !== null ? `${batteryLevel}%` : "--%"}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {batteryLevel !== null
          ? t("batteryLevel", { device: deviceName ?? t("connected"), level: batteryLevel })
          : t("smartCubeWithDevice", { device: deviceName ?? t("connected") })}
      </TooltipContent>
    </Tooltip>
  );
}

/** Flat "+" tray button inside the dock that opens the manual solve sheet. */
function ManualSolveIconButton({ onAddManual }: { onAddManual?: () => void }) {
  const { t } = useTranslation("shell");
  if (!onAddManual) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onAddManual}
          aria-label={t("addManualSolve")}
          className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <Plus className="size-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{t("addManualSolve")}</TooltipContent>
    </Tooltip>
  );
}

/** Desktop session switcher — a tray item that opens the flyout (rename/delete). */
function SessionMenu({
  sessions,
  activeSessionId,
  sessionCount,
  onSwitchSession,
  onNewSession,
  onRenameSession,
  onDeleteSession,
}: {
  sessions: SessionMeta[];
  activeSessionId?: string | null;
  sessionCount?: number;
  onSwitchSession?: (id: string) => void;
  onNewSession?: () => void;
  onRenameSession?: (id: string, name: string) => void;
  onDeleteSession?: (id: string) => void;
}) {
  const { t } = useTranslation("shell");
  const { t: tCommon } = useTranslation();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<SessionMeta | null>(null);
  const active = sessions.find((s) => s.id === activeSessionId) ?? null;

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
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-8 gap-1.5 rounded-full px-2.5 text-xs text-ink-2 hover:bg-surface-2 hover:text-ink"
            aria-label={t("switchSession")}
          >
            <History className="size-3.5 text-ink-3" />
            <span className="nums max-w-28 truncate">
              {active?.name ?? t("session")}
            </span>
            <span className="text-ink-3">·</span>
            <span className="nums text-ink-3">{sessionCount ?? 0}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="text-[0.62rem] uppercase tracking-[0.18em] text-ink-3">
            {t("sessions")}
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
                    aria-label={t("confirmRename")}
                  >
                    <Check className="size-3.5" />
                  </button>
                  <button
                    onClick={() => setRenamingId(null)}
                    className="grid size-6 place-items-center rounded text-ink-3 hover:bg-surface-2 hover:text-ink transition-colors"
                    aria-label={t("cancelRename")}
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
                      aria-label={t("renameSession", { name: s.name })}
                    >
                      <Pencil className="size-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(s);
                      }}
                      className="grid size-6 place-items-center rounded hover:bg-surface-2 hover:text-dnf transition-colors"
                      aria-label={t("deleteSession", { name: s.name })}
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
            {t("newSession")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete-session confirmation */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent className={`max-w-sm ${TOUCH_FULL_BLEED} max-lg:max-h-[85vh] max-lg:overflow-y-auto`}>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">
              {t("deleteSessionTitle", { name: deleteTarget?.name ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              {t("deleteSessionDescription", { count: deleteTarget?.solveCount ?? 0 })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="max-lg:h-11 h-8 text-xs">{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="max-lg:h-11 h-8 bg-dnf text-xs text-white hover:bg-dnf/90"
              onClick={() => {
                if (deleteTarget) onDeleteSession?.(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              {tCommon("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Puzzle category selector — flat "tray" item in the desktop dock, bordered chip on touch. */
function PuzzleSelect({
  puzzle,
  onPuzzleChange,
  puzzleLocked,
  variant,
}: {
  puzzle: PuzzleCategory;
  onPuzzleChange?: (puzzle: PuzzleCategory) => void;
  puzzleLocked?: boolean;
  variant: "tray" | "chip";
}) {
  const { t } = useTranslation("shell");
  return (
    <Select value={puzzle} onValueChange={(v) => onPuzzleChange?.(v as PuzzleCategory)}>
      <SelectTrigger
        size="sm"
        // Locked while the Cube tab is active (3×3-only simulator): the
        // value is forced to 3×3 and the dropdown is disabled.
        disabled={puzzleLocked}
        className={
          variant === "tray"
            ? "h-8 justify-center gap-1.5 rounded-full border-transparent bg-transparent px-2.5 py-0 text-xs font-medium text-ink-2 shadow-none focus:ring-1 focus:ring-ink hover:bg-surface-2 hover:text-ink dark:bg-transparent dark:hover:bg-surface-2"
            : "w-30 max-lg:w-24 max-lg:min-h-8! gap-2 rounded-md border border-line bg-surface text-xs text-ink-2 focus:ring-1 focus:ring-ink dark:bg-surface dark:hover:bg-surface-2"
        }
        aria-label={t("puzzleCategory")}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PUZZLE_CATEGORIES.map((c) => (
          <SelectItem key={c} value={c} className="text-xs">
            {c}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export interface HeaderProps {
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
  /** Open the manual solve entry sheet (the "+" button). */
  onAddManual?: () => void;
  /** Currently selected puzzle category. */
  puzzle?: PuzzleCategory;
  /** Callback when puzzle selection changes. */
  onPuzzleChange?: (puzzle: PuzzleCategory) => void;
  /** Lock the puzzle selector (Cube tab is 3×3-only today). */
  puzzleLocked?: boolean;
  className?: string;
}

/**
 * Top bar. On desktop (lg+) everything lives in ONE centered glass dock —
 * widget pills, quick actions, session and puzzle — Windows-taskbar style,
 * so the header reads as a single piece and nothing ever scrolls or clips.
 * On touch the dock collapses into a "Widgets" button and the compact
 * layout stays untouched.
 */
export function Header({
  sessionCount,
  sessions,
  activeSessionId,
  onSwitchSession,
  onNewSession,
  onRenameSession,
  onDeleteSession,
  onAddManual,
  puzzle: puzzleProp = "3x3",
  onPuzzleChange,
  puzzleLocked,
  className,
}: HeaderProps) {
  const [puzzle, setPuzzle] = useState<PuzzleCategory>(puzzleProp);

  useEffect(() => {
    setPuzzle(puzzleProp);
  }, [puzzleProp]);
  // Touch regime: the dock collapses into a single "Widgets" button that
  // opens the explorer (desktop uses the LeftSidebar-owned explorer).
  const isTouch = useIsTouch();
  const { t } = useTranslation("shell");
  const { t: tCommon } = useTranslation();
  const [widgetsOpen, setWidgetsOpen] = useState(false);
  const [sessionDrawerOpen, setSessionDrawerOpen] = useState(false);
  // Number of widgets currently active — shown as a badge on the touch
  // "Widgets" button so users can see how many are live (no dock on touch).
  const activeWidgetCount = useWidgetStore(
    (s) => Object.values(s.instances).filter((i) => i?.status !== "inactive").length,
  );
  const dockAreaOrder = useWidgetStore((s) => s.dockAreaOrder);

  // Build trailingAreas dynamically from the store's dockAreaOrder.
  // The order is the single source of truth — the dock renders areas in this
  // sequence, and edit mode can reorder/remove/add them.
  const trailingAreas = useMemo(() => {
    const all: Record<string, ReactNode> = {
      "manual-solve": <ManualSolveIconButton onAddManual={onAddManual} />,
    };
    if (sessions && sessions.length > 0) {
      all["session"] = (
        <SessionMenu
          sessions={sessions}
          activeSessionId={activeSessionId}
          sessionCount={sessionCount}
          onSwitchSession={onSwitchSession}
          onNewSession={onNewSession}
          onRenameSession={onRenameSession}
          onDeleteSession={onDeleteSession}
        />
      );
    }
    all["puzzle"] = (
      <PuzzleSelect
        puzzle={puzzle}
        onPuzzleChange={(p) => {
          setPuzzle(p);
          onPuzzleChange?.(p);
        }}
        puzzleLocked={puzzleLocked}
        variant="tray"
      />
    );
    return all;
  }, [sessions, activeSessionId, sessionCount, onSwitchSession, onNewSession, onRenameSession, onDeleteSession, onAddManual, puzzle, puzzleLocked, onPuzzleChange]);

  // Filter to only areas that exist in dockAreaOrder (so removed areas don't render)
  const orderedTrailingAreas = useMemo(() => {
    const result: Record<string, ReactNode> = {};
    for (const id of dockAreaOrder) {
      if (id === "widgets") continue; // widgets area is the left side, not trailing
      if (trailingAreas[id]) result[id] = trailingAreas[id];
    }
    return result;
  }, [dockAreaOrder, trailingAreas]);

  return (
    <motion.header
      initial={{ y: "-100%", opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: "-100%", opacity: 0 }}
      transition={SIDEBAR_MOTION.panel}
      className={cn(
        // `lg:left-14` keeps the desktop header aligned with the rail.
        // Below 1024px the header spans the full width (touch regime).
        // On iOS with viewport-fit=cover the header grows by the top safe-area
        // so its content never hides under the status bar (desktop: h-14).
        // Desktop (lg+) has NO background: the glass dock floats on its own;
        // touch keeps the solid bar so its controls never sit on bare content.
        "fixed inset-x-0 lg:left-14 top-0 z-20",
        "max-lg:border-b max-lg:bg-surface",
        "max-lg:h-[calc(3.5rem+env(safe-area-inset-top))] lg:h-14",
        className,
      )}
    >
      {/* Desktop (lg+): ONE centered glass dock — widgets, quick actions,
          session and puzzle all live in the same bar (Option B), so the
          header reads as a single macOS-dock / Windows-taskbar piece. The
          battery is a status-tray chip pinned to the header's left edge. */}
      <div className="hidden h-full w-full items-center lg:flex">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 sm:left-6">
          <BatteryStatusChip />
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-center">
          <WidgetDock trailingAreas={orderedTrailingAreas} />
        </div>
      </div>

      {/* Touch (<lg): compact layout — battery, widgets button, quick
          actions. No dock pills on touch. */}
      <div className="flex h-full w-full items-center justify-between px-4 pt-safe sm:px-6 lg:hidden">
        <div className="flex min-w-0 items-center gap-2.5">
          <BatteryStatusChip />
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-center">
          <button
            type="button"
            onClick={() => setWidgetsOpen(true)}
            aria-label={t("openWidgets")}
            data-onboarding-target="widgets-entry"
            className="flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 text-xs font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <Puzzle className="size-3.5" />
            <span className="nums">{tCommon("widgets")}</span>
            {activeWidgetCount > 0 && (
              <span className="nums grid h-4 min-w-4 place-items-center rounded-full bg-surface-2 px-1 text-[0.6rem] font-semibold text-ink-2">
                {activeWidgetCount}
              </span>
            )}
          </button>
        </div>

        <div className="flex min-w-0 items-center justify-end gap-2">
          <ManualSolveIconButton onAddManual={onAddManual} />

          {sessions && sessions.length > 0 ? (
            <>
              <Button
                variant="ghost"
                onClick={() => setSessionDrawerOpen(true)}
                className="h-8 gap-1.5 rounded-md border border-line bg-surface px-2.5 text-xs text-ink-2 hover:bg-surface-2 hover:text-ink cursor-pointer"
                aria-label={t("switchSession")}
              >
                <History className="size-3.5 text-ink-3" />
                <span className="nums font-medium text-ink-3">{sessionCount ?? 0}</span>
              </Button>

              <MobileSessionSheet
                open={sessionDrawerOpen}
                onOpenChange={setSessionDrawerOpen}
                sessions={sessions}
                activeSessionId={activeSessionId}
                onSwitchSession={onSwitchSession}
                onNewSession={onNewSession}
                onRenameSession={onRenameSession}
                onDeleteSession={onDeleteSession}
              />
            </>
          ) : null}

          <PuzzleSelect
            puzzle={puzzle}
            onPuzzleChange={(p) => {
              setPuzzle(p);
              onPuzzleChange?.(p);
            }}
            puzzleLocked={puzzleLocked}
            variant="chip"
          />
        </div>
      </div>

      {/* Touch-only widgets explorer — mounted only in the touch regime
          (desktop opens the LeftSidebar-owned explorer instead). */}
      {isTouch && (
        <WidgetExplorer
          open={widgetsOpen}
          onOpenChange={setWidgetsOpen}
        />
      )}
    </motion.header>
  );
}
