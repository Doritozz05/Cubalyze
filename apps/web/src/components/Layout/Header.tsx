"use client";

import { useState, useEffect } from "react";
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
import { useDockZoneActive } from "@/widgets/dock/dockZoneState";
import { IdenticonAvatar } from "@/components/Identity/IdenticonAvatar";
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
import type { Profile } from "@cubeforge/database";
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

  // Medium battery (36% - 75%): vibrant emerald 2-bar medium icon (shows 1/2 / middle stage)
  if (pct <= 75) {
    return <BatteryMedium className="size-4 text-emerald-500" />;
  }

  // Full battery (> 75%): vibrant emerald full icon
  return <BatteryFull className="size-4 text-emerald-500" />;
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
  /** Navigate to the Profile view (avatar chip). */
  onOpenProfile?: () => void;
  /** Stable identity seed for the CubeMark avatar chip (user_id). */
  profileSeed?: string;
  /** The user's profile row — photo (if set) or display name. */
  profile?: Profile | null;
  /** Currently selected puzzle category. */
  puzzle?: PuzzleCategory;
  /** Callback when puzzle selection changes. */
  onPuzzleChange?: (puzzle: PuzzleCategory) => void;
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
  sessionCount,
  sessions,
  activeSessionId,
  onSwitchSession,
  onNewSession,
  onRenameSession,
  onDeleteSession,
  onAddManual,
  onOpenProfile,
  profileSeed,
  profile,
  puzzle: puzzleProp = "3x3",
  onPuzzleChange,
  className,
}: HeaderProps) {
  const [puzzle, setPuzzle] = useState<PuzzleCategory>(puzzleProp);

  useEffect(() => {
    setPuzzle(puzzleProp);
  }, [puzzleProp]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<SessionMeta | null>(null);
  // Touch regime: the dock collapses into a single "Widgets" button that
  // opens the explorer (desktop uses the LeftSidebar-owned explorer).
  const isTouch = useIsTouch();
  const [widgetsOpen, setWidgetsOpen] = useState(false);
  const [sessionDrawerOpen, setSessionDrawerOpen] = useState(false);
  // Number of widgets currently active — shown as a badge on the touch
  // "Widgets" button so users can see how many are live (no dock on touch).
  const activeWidgetCount = useWidgetStore(
    (s) => Object.values(s.instances).filter((i) => i?.status !== "inactive").length,
  );

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
        "fixed inset-x-0 lg:left-14 top-0 z-20 border-b bg-surface transition-[border-color,box-shadow] duration-200",
        "max-lg:h-[calc(3.5rem+env(safe-area-inset-top))] lg:h-14",
        isDockZoneActive
          ? "border-ink-2/40 shadow-xs"
          : "border-line",
        className,
      )}
    >
      {/* Desktop (lg+): symmetric 3-region grid — the left and right columns
          are equal-weight (1fr each) and the middle column can shrink
          (minmax(0,1fr)), so the widget dock is ALWAYS dead-centered on
          screen, no matter what the left (battery) or right (session/puzzle)
          regions contain. Previously the flex `justify-between` centered the
          dock BETWEEN the two side groups, which skewed it left whenever the
          right side was wider. min-w-0 on every column stops a wide side from
          inflating its track (which would re-skew the dock); a cramped right
          side simply overflows leftward into the dock's padding instead.
          Below lg we keep plain flex so the touch layout is unchanged.
          pt-safe pushes content below the notch/status bar on iOS; it is
          0 everywhere else, so desktop layout is identical. */}
      <div className="mx-auto flex h-full w-full items-center justify-between px-4 pt-safe sm:px-6 lg:grid lg:grid-cols-[1fr_minmax(0,1fr)_1fr]">
        {/* Left: Smart Cube battery indicator (the hamburger is replaced by
            the bottom tab bar's "More" button in the touch regime) */}
        <div className="flex min-w-0 items-center gap-2.5">
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

        {/* Center: Widget dock — desktop keeps the flowing pill row; the
            touch regime collapses it into a single "Widgets" button that
            opens the explorer (no drag/dock pills on touch). flex-1 matters
            below lg (flex layout); it's ignored inside the lg grid. */}
        <div className="flex min-w-0 flex-1 items-center justify-center px-4">
          <div className="hidden w-full lg:block">
            <WidgetDock />
          </div>
          <div className="lg:hidden">
            <button
              type="button"
              onClick={() => setWidgetsOpen(true)}
              aria-label="Open widgets"
              data-onboarding-target="widgets-entry"
              className="flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 text-xs font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <Puzzle className="size-3.5" />
              <span className="nums">Widgets</span>
              {activeWidgetCount > 0 && (
                <span className="nums grid h-4 min-w-4 place-items-center rounded-full bg-surface-2 px-1 text-[0.6rem] font-semibold text-ink-2">
                  {activeWidgetCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Right: PB + session + manual + puzzle grouped together. justify-end
            pins the controls to the header's right edge inside the lg grid
            track (harmless below lg). */}
        <div className="flex min-w-0 items-center justify-end gap-2">
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

          {/* Session switcher — next to the puzzle selector */}
          {sessions && sessions.length > 0 ? (
            isTouch ? (
              <>
                <Button
                  variant="ghost"
                  onClick={() => setSessionDrawerOpen(true)}
                  className="h-8 gap-1.5 rounded-md border border-line bg-surface px-2.5 text-xs text-ink-2 hover:bg-surface-2 hover:text-ink cursor-pointer"
                  aria-label="Switch session"
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
            ) : (
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
            )
          ) : null}

          <Select value={puzzle} onValueChange={(v) => {
            const newPuzzle = v as PuzzleCategory;
            setPuzzle(newPuzzle);
            onPuzzleChange?.(newPuzzle);
          }}>
            <SelectTrigger
              size="sm"
              // Explicit dark variants beat the Radix primitive's `dark:bg-input/30`
              // so the chip matches the sibling PB / session chips in dark mode.
              className="w-30 max-lg:w-24 max-lg:min-h-8! gap-2 rounded-md border border-line bg-surface text-xs text-ink-2 focus:ring-1 focus:ring-ink dark:bg-surface dark:hover:bg-surface-2"
              aria-label="Puzzle category"
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

          {/* Profile avatar chip — ubiquitous entry to the identity center. */}
          {(profileSeed || profile) && onOpenProfile ? (
            <div className="flex shrink-0 items-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onOpenProfile}
                    aria-label="Open profile"
                    className="grid size-8 shrink-0 place-items-center rounded-md border border-line bg-surface transition-colors hover:bg-surface-2 cursor-pointer"
                  >
                    {profile?.avatarKind === "photo" && profile.avatarData ? (
                      <img
                        src={profile.avatarData}
                        alt=""
                        className="size-5 rounded-[0.3rem] object-cover"
                      />
                    ) : profileSeed ? (
                      <IdenticonAvatar
                        seed={profileSeed}
                        size={20}
                        tile="transparent"
                        className="rounded-[0.3rem]"
                      />
                    ) : null}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Profile</TooltipContent>
              </Tooltip>
            </div>
          ) : null}
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
              Delete “{deleteTarget?.name}”?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              This permanently removes the session and all{" "}
              {deleteTarget?.solveCount ?? 0} of its solves. This can’t be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="max-lg:h-11 h-8 text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="max-lg:h-11 h-8 bg-dnf text-xs text-white hover:bg-dnf/90"
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
    </motion.header>
  );
}
