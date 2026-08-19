"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { useIsTouch } from "@/hooks/use-mobile";
import type { SessionMeta } from "@/hooks/usePersistentSession";
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

export interface MoveToSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessions: SessionMeta[];
  /** Number of solves being moved (drives the title/description). */
  count: number;
  onConfirm: (targetSessionId: string) => void;
}

/**
 * Destination picker for "Move to another session". Renders as a Dialog on
 * desktop and a Drawer on touch, mirroring the shared ConfirmDialog. Defaults
 * to the first session; the user can switch to any session.
 */
export function MoveToSessionDialog({
  open,
  onOpenChange,
  sessions,
  count,
  onConfirm,
}: MoveToSessionDialogProps) {
  const { t } = useTranslation("insights");
  const isTouch = useIsTouch();

  const [target, setTarget] = useState<string>("");

  // Reset to the first session every time the dialog opens.
  useEffect(() => {
    if (open) setTarget(sessions[0]?.id ?? "");
  }, [open, sessions]);

  const handleConfirm = () => {
    if (!target) return;
    onConfirm(target);
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
        disabled={!target || sessions.length === 0}
        className="sm:order-2"
      >
        {t("list.move")}
      </Button>
    </div>
  );

  const body = (
    <div className="flex flex-col gap-1.5 py-3">
      <span className="text-[0.6rem] uppercase tracking-[0.16em] text-ink-3">
        {t("dashboard.session")}
      </span>
      <Select value={target} onValueChange={setTarget}>
        <SelectTrigger
          className="h-10 w-full gap-1.5 rounded-md border border-line bg-surface-2 px-3 text-sm text-ink-2"
          aria-label={t("list.sessionPlaceholder")}
        >
          <SelectValue placeholder={t("list.sessionPlaceholder")} />
        </SelectTrigger>
        <SelectContent>
          {sessions.map((s) => (
            <SelectItem key={s.id} value={s.id} className="text-sm">
              {s.name}
            </SelectItem>
          ))}
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
              {t("list.confirmMoveTitle", { count })}
            </DrawerTitle>
            <DrawerDescription className="text-xs text-ink-3 mt-1">
              {t("list.confirmMoveDescription")}
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
          <DialogTitle>{t("list.confirmMoveTitle", { count })}</DialogTitle>
          <DialogDescription>{t("list.confirmMoveDescription")}</DialogDescription>
        </DialogHeader>
        {body}
        <DialogFooter className="mt-2">{actions}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
