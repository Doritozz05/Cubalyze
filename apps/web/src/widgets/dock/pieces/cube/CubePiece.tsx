"use client";

/**
 * CubePiece.tsx — which of YOUR cubes the current event is using.
 *
 * The puzzle piece answers "what am I solving?"; this one answers "with what?".
 * Both are the same kind of control in the dock (a tray select on pointer
 * devices) and the same sheet on a phone, and both are backed by the Locker:
 * the list is the cubes of the ACTIVE EVENT that you still own, so a 2×2 solve
 * can never be attributed to a 3×3 and a sold cube never appears.
 *
 * The rules of what counts as a candidate (and what the fallback is when the
 * chosen cube is gone) live in `views/Collection/activeCube.ts` as pure
 * functions; this file is only the control that reads and sets the choice.
 *
 * States it is honest about:
 *
 *   • **No cubes for this event** → a single control that opens the Locker,
 *     instead of an empty dropdown.
 *   • **The chosen cube is no longer available** (sold, deleted, moved to
 *     another event) → the piece shows the fallback and the sheet says so.
 *   • **"No cube"** → a real choice, distinct from "never chosen": it means
 *     solves of this event are recorded without attribution.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, Check, Plus } from "lucide-react";
import { BiCube } from "react-icons/bi";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TouchPanel } from "@/components/TouchPanel";
import { cn } from "@/lib/utils";
import { useStore } from "zustand";
import { useCollectionStore } from "@/views/Collection/collectionStore";
import { activeCubeStore } from "@/stores/activeCubeStore";
import { cubeShortLabel, cubesForEvent, NO_CUBE, resolveActiveCube } from "@/views/Collection/activeCube";

export interface CubePieceProps {
  /** App event code of the event being solved (`puzzleCategoryToType(...)`). */
  event: string;
  /** Human name of the event, for labels and the sheet title. */
  eventLabel: string;
  variant?: "tray" | "icon";
  /** Open the Locker (the empty state's only useful action). */
  onOpenLocker?: () => void;
}

export function CubePiece({ event, eventLabel, variant = "tray", onOpenLocker }: CubePieceProps) {
  const { t } = useTranslation("dock");
  const collection = useCollectionStore((state) => state.data);
  const chosen = useStore(activeCubeStore, (state) => state.byEvent[event]);
  const [sheetOpen, setSheetOpen] = useState(false);

  const candidates = cubesForEvent(collection, event);
  const resolved = resolveActiveCube(collection, event, chosen);
  const storedIsGone =
    !!chosen && chosen !== NO_CUBE && !candidates.some((cube) => cube.id === chosen);

  /** The value the control displays: an explicit "none" stays "none". */
  const value = chosen === NO_CUBE ? NO_CUBE : (resolved?.id ?? NO_CUBE);

  /**
   * Only ever called with a candidate's id or `NO_CUBE`. Passing `null` would
   * CLEAR the choice instead of storing "no cube", which would silently let the
   * Main fallback take over while the sheet still showed "No cube" selected.
   */
  const setActive = (value: string) => {
    activeCubeStore.getState().setActive(event, value);
  };

  // Nothing registered for this event: there is no list to choose from, so the
  // control is a door to the Locker instead of a dropdown with no options.
  if (candidates.length === 0) {
    return variant === "icon" ? (
      <IconButton
        label={t("cube.empty", { event: eventLabel })}
        onClick={() => onOpenLocker?.()}
        dim
      >
        <Plus className="size-5" />
      </IconButton>
    ) : (
      <button
        type="button"
        onClick={() => onOpenLocker?.()}
        data-piece="cube"
        title={t("cube.empty", { event: eventLabel })}
        className="flex h-8 items-center gap-2 rounded-full border-transparent bg-transparent px-2.5 text-xs font-medium text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
      >
        <Plus className="size-3.5" />
        {t("cube.add")}
      </button>
    );
  }

  if (variant === "icon") {
    return (
      <>
        <IconButton label={t("cube.title", { event: eventLabel })} onClick={() => setSheetOpen(true)}>
          <BiCube className="size-5" />
        </IconButton>
        <CubeSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          title={t("cube.title", { event: eventLabel })}
          candidates={candidates}
          chosen={chosen}
          resolvedId={resolved?.id ?? null}
          storedIsGone={storedIsGone}
          onChoose={(id) => {
            setActive(id);
            setSheetOpen(false);
          }}
          onOpenLocker={() => {
            setSheetOpen(false);
            onOpenLocker?.();
          }}
        />
      </>
    );
  }

  return (
    <Select
      value={value}
      onValueChange={setActive}
    >
      <SelectTrigger
        data-piece="cube"
        data-no-glass
        size="sm"
        aria-label={t("cube.title", { event: eventLabel })}
        className="h-8 max-w-[11rem] gap-2 rounded-full border-transparent bg-transparent px-2.5 py-0 text-xs font-medium leading-normal text-ink-2 shadow-none hover:bg-surface-2 hover:text-ink dark:bg-transparent dark:hover:bg-surface-2"
      >
        <BiCube className="size-3.5 shrink-0" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="center">
        {candidates.map((cube) => (
          <SelectItem key={cube.id} value={cube.id} className="text-xs">
            {cubeShortLabel(cube)}
            {cube.primary ? ` · ${t("cube.main")}` : ""}
          </SelectItem>
        ))}
        <SelectItem value={NO_CUBE} className="text-xs">
          {t("cube.none")}
        </SelectItem>
      </SelectContent>
    </Select>
  );
}

function IconButton({
  children,
  label,
  onClick,
  dim,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  dim?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "grid size-9 shrink-0 cursor-pointer place-items-center rounded-full transition-colors hover:bg-surface-2 hover:text-ink active:scale-95",
        dim ? "text-ink-3" : "text-ink-2",
      )}
    >
      {children}
    </button>
  );
}

function CubeSheet({
  open,
  onOpenChange,
  title,
  candidates,
  chosen,
  resolvedId,
  storedIsGone,
  onChoose,
  onOpenLocker,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  candidates: ReturnType<typeof cubesForEvent>;
  chosen: string | undefined;
  resolvedId: string | null;
  storedIsGone: boolean;
  /** A candidate's item id, or `NO_CUBE` for the explicit "no cube" choice. */
  onChoose: (value: string) => void;
  onOpenLocker: () => void;
}) {
  const { t } = useTranslation("dock");
  return (
    <TouchPanel open={open} onOpenChange={onOpenChange} title={title}>
      <div className="flex flex-col gap-1.5">
        {storedIsGone ? (
          <p className="mb-1 text-[0.7rem] text-ink-3">{t("cube.unavailable")}</p>
        ) : null}

        {candidates.map((cube) => {
          const active = cube.id === resolvedId || cube.id === chosen;
          return (
            <button
              key={cube.id}
              type="button"
              onClick={() => onChoose(cube.id)}
              aria-current={active}
              className={cn(
                "flex min-h-12 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors touch-manipulation active:bg-surface-2",
                active ? "bg-surface-2" : "hover:bg-surface-2",
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.8rem] font-medium text-ink">
                  {cubeShortLabel(cube)}
                </span>
                <span className="block truncate text-[0.66rem] text-ink-3">
                  {[cube.brand, cube.primary ? t("cube.main") : null].filter(Boolean).join(" · ")}
                </span>
              </span>
              {active ? <Check className="size-4 shrink-0 text-ink" /> : null}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => onChoose(NO_CUBE)}
          aria-current={chosen === NO_CUBE}
          className={cn(
            "flex min-h-12 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors touch-manipulation active:bg-surface-2",
            chosen === NO_CUBE ? "bg-surface-2" : "hover:bg-surface-2",
          )}
        >
          <span className="min-w-0 flex-1 text-[0.8rem] font-medium text-ink">{t("cube.none")}</span>
          {chosen === NO_CUBE ? <Check className="size-4 shrink-0 text-ink" /> : null}
        </button>

        <button
          type="button"
          onClick={onOpenLocker}
          className="mt-1 flex min-h-11 w-full items-center gap-2.5 rounded-xl border border-line bg-surface-2/60 px-3 text-left text-[0.78rem] font-medium text-ink transition-colors touch-manipulation active:bg-surface-2"
        >
          <span className="grid size-7 shrink-0 place-items-center rounded-lg border border-line bg-surface text-ink-3">
            <ArrowUpRight className="size-4" />
          </span>
          {t("cube.openLocker")}
        </button>
      </div>
    </TouchPanel>
  );
}
