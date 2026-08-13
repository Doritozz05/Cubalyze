"use client";

import { useState } from "react";
import { ListOrdered } from "lucide-react";
import { FloatingWidgetWrapper } from "@/widgets/components/FloatingWidgetWrapper";
import { useTranslation } from "react-i18next";
import { TimesList } from "@/components/Stats/TimesList";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import type { Solve } from "@/types";

const PANEL_WIDTH = 320;
const PANEL_HEIGHT = 380;

export interface FloatingTimesPanelProps {
  solves: Solve[];
  onUpdate: (id: string, updates: Partial<Solve>) => void;
  onDelete: (id: string) => void;
  onClear?: () => void;
  onAnalyze?: (solve: Solve) => void;
  onReplay?: (solve: Solve) => void;
  puzzle?: string;
}

/**
 * Floating solve-log panel — always open, draggable, minimizable.
 *
 * - **Desktop (>=1024px)**: FloatingWidgetWrapper for portal/drag/minimize.
 * - **Touch (<1024px)**: the same wrapper renders a bottom sheet anchored
 *   above the tab bar (drag handle, minimize, close) — desktop is untouched.
 */
export function FloatingTimesPanel({
  solves,
  onUpdate,
  onDelete,
  onClear,
  onAnalyze,
  onReplay,
}: FloatingTimesPanelProps) {
  const { t } = useTranslation("widgets");
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const headerActions =
    solves.length > 0 && onClear ? (
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          setConfirmClearOpen(true);
        }}
        className="rounded px-1.5 py-1 text-[0.65rem] text-ink-3 transition-colors hover:bg-surface-2 hover:text-dnf"
      >
        {t("panel.timesLog.clear")}
      </button>
    ) : null;

  return (
    <FloatingWidgetWrapper
      widgetId="times-log"
      icon={ListOrdered}
      label={t("def.timesLog")}
      pillBadge={`${solves.length}`}
      panelWidth={PANEL_WIDTH}
      defaultPosition={{ x: 24, y: 72 }}
      headerActions={headerActions}
    >
      <div style={{ height: PANEL_HEIGHT }} className="min-h-0">
        <TimesList
          solves={solves}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onAnalyze={onAnalyze}
          onReplay={onReplay}
          hideHeader
          className="h-full"
        />
      </div>

      {/* Clearing wipes the WHOLE session — always confirm first. */}
      <ConfirmDialog
        open={confirmClearOpen}
        onOpenChange={setConfirmClearOpen}
        title={t("panel.timesLog.clearAllTitle")}
        description={t("panel.timesLog.clearAllDescription", {
          count: solves.length,
        })}
        confirmLabel={t("panel.timesLog.clear")}
        onConfirm={() => onClear?.()}
      />
    </FloatingWidgetWrapper>
  );
}
