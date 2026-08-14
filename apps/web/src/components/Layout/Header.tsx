"use client";

import { useState, useEffect, useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Puzzle } from "lucide-react";
import { useStore } from "zustand";
import { connectionStore } from "@cubeforge/state";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { SIDEBAR_MOTION } from "./sidebar.constants";
import { WidgetDock } from "@/widgets/dock";
import { useIsDockEditing } from "@/widgets/dock/dockEditStore";
import { BatteryIcon } from "@/components/Hardware/BatteryIcon";
import {
  BatteryPiece,
  ClockPiece,
  ProfilePiece,
  SpacerPiece,
  SeparatorPiece,
  ManualSolvePiece,
  SessionPiece,
  PuzzlePiece,
} from "@/widgets/dock/pieces";
import { WidgetExplorer } from "@/widgets/explorer";
import { useWidgetStore } from "@/widgets/widgetStore";
import { areaBaseId } from "@/widgets/dock/dockAreasRegistry";
import { useIsTouch } from "@/hooks/use-mobile";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { MobileSessionSheet } from "./MobileSessionSheet";
import type { PuzzleCategory } from "@/types";
import type { SessionMeta } from "@/hooks/usePersistentSession";

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
        <div className="flex h-8 cursor-default items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 text-xs text-ink select-none">
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
  /** Open the user's profile view (dock profile pill). */
  onOpenProfile?: () => void;
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
  onOpenProfile,
  puzzle: puzzleProp = "3x3",
  onPuzzleChange,
  puzzleLocked,
  className,
}: HeaderProps) {
  const [puzzle, setPuzzle] = useState<PuzzleCategory>(puzzleProp);
  const isDockEditing = useIsDockEditing();

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
      "manual-solve": <ManualSolvePiece onAddManual={onAddManual} />,
    };
    if (sessions && sessions.length > 0) {
      all["session"] = (
        <SessionPiece
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
      <PuzzlePiece
        puzzle={puzzle}
        onPuzzleChange={(p) => {
          setPuzzle(p);
          onPuzzleChange?.(p);
        }}
        puzzleLocked={puzzleLocked}
        variant="tray"
      />
    );
    // Phase 4: system/layout pieces
    all["clock"] = <ClockPiece />;
    all["battery"] = <BatteryPiece />;
    all["profile"] = <ProfilePiece onOpenProfile={onOpenProfile} />;
    all["spacer"] = <SpacerPiece />;
    all["separator"] = <SeparatorPiece />;
    return all;
  }, [sessions, activeSessionId, sessionCount, onSwitchSession, onNewSession, onRenameSession, onDeleteSession, onAddManual, onOpenProfile, puzzle, puzzleLocked, onPuzzleChange]);

  // Filter to only areas that exist in dockAreaOrder (so removed areas don't
  // render). Repeatable instances are suffixed ("separator-0"), so look up
  // by base id; the dock renders one trailing piece per instance.
  const orderedTrailingAreas = useMemo(() => {
    const result: Record<string, ReactNode> = {};
    for (const id of dockAreaOrder) {
      if (id === "widgets") continue; // widgets area is the left side, not trailing
      const base = areaBaseId(id);
      if (trailingAreas[base]) result[base] = trailingAreas[base];
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
        // Below 768px the header spans the full width (touch regime).
        // On iOS with viewport-fit=cover the header grows by the top safe-area
        // so its content never hides under the status bar (desktop: h-14).
        // Desktop (lg+) has NO background: the glass dock floats on its own;
        // touch keeps the solid bar so its controls never sit on bare content.
        // While the dock is being edited the header is raised to z-60 so the
        // bar stays crisp above the body-portaled edit backdrop (z-50).
        "fixed inset-x-0 lg:left-14 top-0 z-20",
        isDockEditing && "z-60",
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
          <ManualSolvePiece onAddManual={onAddManual} />

          {sessions && sessions.length > 0 ? (
            <>
              <Button
                variant="ghost"
                onClick={() => setSessionDrawerOpen(true)}
                className="h-8 gap-1.5 rounded-md border border-line bg-surface px-2.5 text-xs text-ink-2 hover:bg-surface-2 hover:text-ink cursor-pointer"
                aria-label={t("switchSession")}
              >
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

          <PuzzlePiece
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
