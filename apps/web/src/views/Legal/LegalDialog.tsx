"use client";

/**
 * LegalDialog — privacy / terms / storage in the app's own dialog language:
 * centered Dialog on desktop, bottom Drawer on touch (same split as
 * ConfirmDialog). Opened from Settings → Credits and the sign-in card so the
 * user never leaves their screen; the /privacy, /terms, /storage routes
 * (LegalView) remain for deep links and search engines.
 */

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useIsTouch } from "@/hooks/use-mobile";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { DOC_ORDER, LegalArticle, LegalBrandTile, LegalDocTabs } from "./LegalArticle";
import type { LegalDoc } from "./LegalView";

export function LegalDialog({
  doc: initialDoc,
  open,
  onOpenChange,
}: {
  doc: LegalDoc;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation("legal");
  const { t: tMeta } = useTranslation("meta");
  const isTouch = useIsTouch();
  const [doc, setDoc] = useState<LegalDoc>(initialDoc);

  // Reset to the requested document every time the dialog opens.
  useEffect(() => {
    if (open) setDoc(initialDoc);
  }, [open, initialDoc]);

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <LegalBrandTile compact />
      <LegalDocTabs active={doc} onSelect={setDoc} />
    </div>
  );

  if (isTouch) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[88vh] border-line bg-surface p-0 text-ink focus:outline-none">
          <DrawerHeader className="shrink-0 border-b border-line px-5 py-3.5 text-left">
            <DrawerTitle className="sr-only">{tMeta("brand")}</DrawerTitle>
            {header}
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 pb-safe">
            <LegalArticle doc={doc} />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[85vh] flex-col gap-0 overflow-hidden border-line bg-surface p-0 text-ink sm:max-w-2xl"
      >
        <DialogHeader className="shrink-0 border-b border-line px-6 py-4 text-left">
          <DialogTitle className="sr-only">{tMeta("brand")}</DialogTitle>
          {header}
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <LegalArticle doc={doc} />
        </div>
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-line px-6 py-3">
          <span className="text-[0.65rem] text-ink-3">
            {DOC_ORDER.indexOf(doc) + 1} / {DOC_ORDER.length}
          </span>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="cursor-pointer rounded-lg border border-line bg-surface-2/50 px-4 py-1.5 text-[0.72rem] font-medium text-ink transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40"
          >
            {t("backToApp")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
