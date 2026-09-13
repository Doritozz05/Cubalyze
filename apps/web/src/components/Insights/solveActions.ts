import {
  Box,
  Columns2,
  FolderInput,
  RefreshCw,
  RotateCcw,
  Rows2,
  Trash2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { TFunction } from "i18next";
import type { Solve } from "@/types";
import { resolveRetryScramble } from "@/utils/retryScramble";

/**
 * solveActions.ts — the actions a stored solve offers, declared ONCE.
 *
 * The same solve can be acted on from three places:
 *
 *   • `menu`    — the detail panel's ⋯ overflow (desktop, an icon-anchored popup)
 *   • `sheet`   — the detail panel's ⋯ bottom sheet (touch, <768px)
 *   • `context` — a solve row's right-click menu
 *
 * Before this module each surface built its own list, so the row menu quietly
 * offered less than the panel (no re-analyze, no retry). Now every surface
 * renders the SAME declaration filtered by `surfaces`: adding an action here
 * adds it everywhere its surface list says, and there is no second place to
 * forget. Pure (no React, no hooks) so the equivalence itself is testable.
 */

export type SolveActionId =
  | "retry-scramble"
  | "detail-mode"
  | "reanalyze"
  | "move"
  | "assign"
  | "delete";

export type SolveActionSurface = "menu" | "sheet" | "context";

/** This action belongs on every surface that acts on a solve. */
const EVERYWHERE: readonly SolveActionSurface[] = ["menu", "sheet", "context"];

export interface SolveActionItem {
  id: SolveActionId;
  icon: LucideIcon;
  /** Already localized — the caller owns the `insights` namespace. */
  label: string;
  onSelect: () => void;
  surfaces: readonly SolveActionSurface[];
  /** View toggles render a trailing check. */
  checked?: boolean;
  /** The reason the action is off, rendered under the label. */
  hint?: string;
  disabled?: boolean;
  /** Spins the icon (re-analysis in flight). */
  busy?: boolean;
  destructive?: boolean;
}

export interface SolveActionHandlers {
  /** Put this solve's exact scramble back on the timer. */
  onRetryScramble?: (solve: Solve) => void;
  /** Re-run the analysis pipeline on this solve. */
  onReanalyze?: (solve: Solve) => void | Promise<void>;
  onMoveSolve?: (id: string) => void;
  onAssignSolve?: (id: string) => void;
  onDeleteSolve?: (id: string) => void;
  /** Batch variants: take over when `multi` (the row menu's selection). */
  onMoveSelected?: () => void;
  onAssignSelected?: () => void;
  onDeleteSelected?: () => void;
  /** The detail panel's view preference — desktop menu only. */
  onToggleDetailMode?: () => void;
}

export interface SolveActionInput {
  t: TFunction<"insights">;
  solve: Solve;
  handlers: SolveActionHandlers;
  /** Current state of the detail-mode toggle. */
  detailMode?: boolean;
  /** A re-analysis started from this surface is in flight. */
  isReanalyzing?: boolean;
  /**
   * The action targets the whole selection, not one solve: per-solve actions
   * (retry, re-analyze) drop out and the batch handlers take over.
   */
  multi?: boolean;
  /** Solve whose live analysis is still pending — re-running it would race. */
  liveSolveId?: string | null;
  /**
   * Wording for an action whose TARGET differs. Only the row menu uses it: with
   * several rows ticked, "Move to another session…" / "Delete solves…" say
   * something the single-solve labels cannot.
   */
  labelOverrides?: Partial<Record<SolveActionId, string>>;
}

/**
 * Re-solving the scramble needs the same thing the timer needs: a puzzle whose
 * event has a registered provider, plus the scramble text itself.
 */
export function canRetryScramble(solve: Solve): boolean {
  return resolveRetryScramble(solve) !== null;
}

/**
 * Deep analysis is 3×3-only: 2×2 solves keep moves for the replay but have no
 * analysis pipeline, so re-running would feed 3×3 detection on a 2×2 and
 * persist meaningless metrics. A live job must not be re-run over either.
 */
export function canReanalyzeSolve(solve: Solve, liveSolveId?: string | null): boolean {
  return (
    (solve.moves?.length ?? 0) > 0 &&
    (solve.puzzleType ?? "333") === "333" &&
    solve.id !== liveSolveId
  );
}

/**
 * Keep only what a surface shows, and drop the groups that end up empty — a
 * separator must never separate nothing (the touch sheet used to leave one
 * behind for the desktop-only view toggle).
 */
export function actionsForSurface(
  groups: SolveActionItem[][],
  surface: SolveActionSurface,
): SolveActionItem[][] {
  return groups
    .map((group) => group.filter((item) => item.surfaces.includes(surface)))
    .filter((group) => group.length > 0);
}

/**
 * Build the action groups: view · retry+analysis · management · destructive.
 * Each group becomes a separator on the menu/context surfaces and a divider on
 * the sheet.
 */
export function buildSolveActionGroups(input: SolveActionInput): SolveActionItem[][] {
  const { t, solve, handlers, detailMode, isReanalyzing, multi, liveSolveId, labelOverrides } =
    input;

  const retryAvailable = canRetryScramble(solve);
  const labelFor = (id: SolveActionId, fallback: string) => labelOverrides?.[id] ?? fallback;

  // 1. Re-solve this scramble. Not on the desktop menu: there it IS the panel's
  //    visible primary button, and the menu must not repeat it.
  const retry: SolveActionItem[] =
    handlers.onRetryScramble && !multi
      ? [
          {
            id: "retry-scramble",
            icon: RefreshCw,
            label: t("analysis.retryScramble"),
            onSelect: () => handlers.onRetryScramble?.(solve),
            surfaces: ["sheet", "context"],
            disabled: !retryAvailable,
            // A sheet and a context menu have no hover, so the reason has to be
            // written down instead of hidden behind a tooltip.
            hint: retryAvailable ? undefined : t("analysis.retryUnavailable"),
          },
        ]
      : [];

  // 2. The detail panel's own view toggle. Pure layout, so it stays where the
  //    layout lives (the desktop overflow) — it is not an action on a solve.
  const view: SolveActionItem[] = handlers.onToggleDetailMode
    ? [
        {
          id: "detail-mode",
          icon: detailMode ? Rows2 : Columns2,
          label: detailMode ? t("analysis.detailModeExit") : t("analysis.detailMode"),
          onSelect: handlers.onToggleDetailMode,
          surfaces: ["menu"],
          checked: detailMode,
        },
      ]
    : [];

  const analysis: SolveActionItem[] =
    handlers.onReanalyze && !multi && canReanalyzeSolve(solve, liveSolveId)
      ? [
          {
            id: "reanalyze",
            icon: RotateCcw,
            label: isReanalyzing ? t("analysis.reanalyzing") : t("analysis.reanalyze"),
            onSelect: () => handlers.onReanalyze?.(solve),
            surfaces: EVERYWHERE,
            disabled: isReanalyzing,
            busy: isReanalyzing,
          },
        ]
      : [];

  /**
   * Move / assign / delete. With a multi-selection the batch handler takes
   * over — the action is the same one, aimed at the whole selection, so only
   * the label and the callback change.
   */
  const managementItem = (
    id: "move" | "assign" | "delete",
    icon: LucideIcon,
    fallbackLabel: string,
    single: ((id: string) => void) | undefined,
    batch: (() => void) | undefined,
  ): SolveActionItem[] => {
    const useBatch = Boolean(multi && batch);
    if (!useBatch && !single) return [];
    return [
      {
        id,
        icon,
        label: labelFor(id, fallbackLabel),
        onSelect: () => (useBatch ? batch?.() : single?.(solve.id)),
        surfaces: EVERYWHERE,
        destructive: id === "delete",
      },
    ];
  };

  const management: SolveActionItem[] = [
    ...managementItem("move", FolderInput, t("analysis.moveToSession"), handlers.onMoveSolve, handlers.onMoveSelected),
    ...managementItem("assign", Box, t("analysis.assignCube"), handlers.onAssignSolve, handlers.onAssignSelected),
  ];
  const destructive: SolveActionItem[] = managementItem(
    "delete",
    Trash2,
    t("analysis.delete"),
    handlers.onDeleteSolve,
    handlers.onDeleteSelected,
  );

  return [retry, view, analysis, management, destructive].filter((group) => group.length > 0);
}
