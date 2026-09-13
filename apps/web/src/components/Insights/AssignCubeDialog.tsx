"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { useIsTouch } from "@/hooks/use-mobile";
import { useStore } from "zustand";
import { preferencesStore } from "@cubeforge/state";
import { useCollectionStore } from "@/views/Collection/collectionStore";
import { cubesForEventWithSmartFallback, cubeShortLabel } from "@/views/Collection/activeCube";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface AssignedCube {
  id: string;
  label: string;
}

export interface AssignCubeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Number of solves being (re-)attributed (drives the title). */
  count: number;
  /** Event code of the solves (e.g. "333", "222") — filters the candidates. */
  eventCode: string;
  /** Shared cubeId when every targeted solve already has the same one. */
  currentCubeId?: string | null;
  onConfirm: (cube: AssignedCube | null) => void;
}

const NONE_VALUE = "__none__";

/**
 * Cube picker for "(re-)attribute solves to a Locker cube". Mirrors
 * MoveToSessionDialog (Dialog on desktop, Drawer on touch). Candidates come
 * from `cubesForEventWithSmartFallback` — the same SSoT the dock and timer
 * use — so a 2×2 solve can never be attributed to a 3×3, except linked smart
 * 3×3 cubes when "3×3 as 2×2" is on. `None` clears the attribution.
 */
export function AssignCubeDialog({
  open,
  onOpenChange,
  count,
  eventCode,
  currentCubeId,
  onConfirm,
}: AssignCubeDialogProps) {
  const { t } = useTranslation("insights");
  const isTouch = useIsTouch();
  const collection = useCollectionStore((s) => s.data);
  const use3x3As2x2 = useStore(preferencesStore, (s) => s.use3x3As2x2);

  const candidates = useMemo(
    () => cubesForEventWithSmartFallback(collection, eventCode, eventCode === "222" && use3x3As2x2),
    [collection, eventCode, use3x3As2x2],
  );

  const [selected, setSelected] = useState<string>("");

  // Reset every time the dialog opens: shared cube, else first candidate.
  useEffect(() => {
    if (!open) return;
    if (currentCubeId && candidates.some((c) => c.id === currentCubeId)) {
      setSelected(currentCubeId);
    } else {
      setSelected(candidates[0]?.id ?? NONE_VALUE);
    }
  }, [open, candidates, currentCubeId]);

  const handleConfirm = () => {
    if (!selected) return;
    if (selected === NONE_VALUE) {
      onConfirm(null);
    } else {
      const item = candidates.find((c) => c.id === selected);
      if (!item) return;
      onConfirm({ id: item.id, label: cubeShortLabel(item) });
    }
    onOpenChange(false);
  };

  const actions = (
    <div className="flex gap-2 flex-col sm:flex-row sm:justify-end">
      <Button
        variant="outline"
        onClick={() => onOpenChange(false)}
        className="sm:order-1 border-line bg-surface text-ink hover:bg-surface-2"
      >
        {i18n.t("common:cancel")}
      </Button>
      <Button
        variant="default"
        onClick={handleConfirm}
        disabled={!selected || (candidates.length === 0 && selected !== NONE_VALUE)}
        className="sm:order-2"
      >
        {t("list.assign")}
      </Button>
    </div>
  );

  const body = (
    <div className="flex flex-col gap-1.5 py-3">
      <span className="text-[0.6rem] uppercase tracking-[0.16em] text-ink-3">
        {t("dashboard.cube")}
      </span>
      {candidates.length === 0 && (
        <p className="text-xs text-ink-3">{t("list.noCubesForEvent")}</p>
      )}
      <Select value={selected} onValueChange={setSelected}>
        <SelectTrigger
          className="h-10 w-full gap-1.5 rounded-md border border-line bg-surface-2 px-3 text-sm text-ink-2"
          aria-label={t("list.cubePlaceholder")}
        >
          <SelectValue placeholder={t("list.cubePlaceholder")} />
        </SelectTrigger>
        <SelectContent>
          {candidates.map((c) => (
            <SelectItem key={c.id} value={c.id} className="text-sm">
              {cubeShortLabel(c)}
            </SelectItem>
          ))}
          <SelectItem value={NONE_VALUE} className="text-sm">
            {t("list.assignCubeNone")}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  if (isTouch) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="bg-surface text-ink border-line rounded-t-2xl max-h-[85vh] p-0 pb-safe focus:outline-none">
          <DrawerHeader className="border-b border-line px-5 py-3.5 text-left">
            <DrawerTitle className="text-sm font-semibold text-ink">
              {t("list.confirmAssignTitle", { count })}
            </DrawerTitle>
            <DrawerDescription className="text-xs text-ink-3 mt-1">
              {t("list.confirmAssignDescription")}
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-5">{body}</div>
          <DrawerFooter className="px-5 pt-2 pb-6">{actions}</DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm bg-surface text-ink border-line backdrop:backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle>{t("list.confirmAssignTitle", { count })}</DialogTitle>
          <DialogDescription>{t("list.confirmAssignDescription")}</DialogDescription>
        </DialogHeader>
        {body}
        <DialogFooter className="mt-2">{actions}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
