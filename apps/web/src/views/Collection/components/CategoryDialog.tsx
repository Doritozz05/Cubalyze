"use client";

/**
 * CategoryDialog.tsx — create/edit a category (the outer level).
 *
 * The accent colour reuses the app's own `ColorPicker` (the one from Theme
 * Studio and the cube sticker editor) instead of a bespoke swatch row, so the
 * Locker inherits its favourites, presets, hex field and native picker for
 * free — and the two surfaces stay consistent.
 */

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ParseKeys } from "i18next";
import { Box, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ColorPicker } from "@/components/Settings/components/ColorPicker";
import { cn } from "@/lib/utils";
import i18n from "@/i18n";
import { CATEGORY_ICON_IDS, categoryIcon } from "../collectionIcons";
import type { CategoryKind, CollectionCategory } from "../collectionModel";
import { FormDialog } from "./FormDialog";

/** Neutral fallback shown when a category has no accent yet. */
const ACCENT_FALLBACK = "#6b7280";

export interface CategoryDraft {
  name: string;
  kind: CategoryKind;
  icon: string;
  accent?: string;
}

const KIND_HINT_KEY: Record<CategoryKind, ParseKeys<"collection">> = {
  cube: "dialog.category.kindCubeHint",
  gear: "dialog.category.kindGearHint",
};

export function CategoryDialog({
  open,
  onOpenChange,
  category,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present ⇒ edit mode; omitted ⇒ create mode. */
  category?: CollectionCategory | null;
  onSave: (draft: CategoryDraft) => void;
}) {
  const { t } = useTranslation("collection");
  const [draft, setDraft] = useState<CategoryDraft>({
    name: "",
    kind: "gear",
    icon: "Package",
    accent: undefined,
  });

  useEffect(() => {
    if (!open) return;
    setDraft(
      category
        ? { name: category.name, kind: category.kind, icon: category.icon, accent: category.accent }
        : { name: "", kind: "gear", icon: "Package", accent: undefined },
    );
  }, [open, category]);

  const submit = () => {
    if (!draft.name.trim()) return;
    onSave({ ...draft, name: draft.name.trim() });
    onOpenChange(false);
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={category ? t("dialog.category.editTitle") : t("dialog.category.createTitle")}
      description={t("dialog.category.description")}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {i18n.t("common:cancel")}
          </Button>
          <Button onClick={submit} disabled={!draft.name.trim()}>
            {category ? t("dialog.save") : t("dialog.create")}
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        <Label htmlFor="category-name">{t("dialog.category.name")}</Label>
        <Input
          id="category-name"
          value={draft.name}
          autoFocus
          placeholder={t("dialog.category.namePlaceholder")}
          onChange={(event) => setDraft((d) => ({ ...d, name: event.target.value }))}
          onKeyDown={(event) => {
            if (event.key === "Enter") submit();
          }}
        />
      </div>

      <div className="space-y-2">
        <Label>{t("dialog.category.kind")}</Label>
        <div className="grid grid-cols-2 gap-2">
          <KindOption
            active={draft.kind === "cube"}
            icon={<Box className="size-4" />}
            title={t("kinds.cube")}
            hint={t(KIND_HINT_KEY.cube)}
            onClick={() => setDraft((d) => ({ ...d, kind: "cube" }))}
          />
          <KindOption
            active={draft.kind === "gear"}
            icon={<Package className="size-4" />}
            title={t("kinds.gear")}
            hint={t(KIND_HINT_KEY.gear)}
            onClick={() => setDraft((d) => ({ ...d, kind: "gear" }))}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t("dialog.category.icon")}</Label>
        <div className="grid grid-cols-10 gap-1.5">
          {CATEGORY_ICON_IDS.map((id) => {
            const Icon = categoryIcon(id);
            const active = draft.icon === id;
            return (
              <button
                key={id}
                type="button"
                aria-label={id}
                aria-pressed={active}
                onClick={() => setDraft((d) => ({ ...d, icon: id }))}
                className={cn(
                  "flex aspect-square items-center justify-center rounded-md border transition-colors",
                  active
                    ? "border-ink/30 bg-surface-2 text-ink"
                    : "border-line text-ink-3 hover:bg-surface-2 hover:text-ink",
                )}
              >
                <Icon className="size-3.5" />
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t("dialog.category.accent")}</Label>
        <ColorPicker
          label={t("dialog.category.accent")}
          value={draft.accent ?? ACCENT_FALLBACK}
          defaultColor={ACCENT_FALLBACK}
          onChange={(color) => setDraft((d) => ({ ...d, accent: color }))}
          onResetToDefault={() => setDraft((d) => ({ ...d, accent: undefined }))}
        />
        <p className="text-[0.68rem] text-ink-3">{t("dialog.category.accentHint")}</p>
      </div>
    </FormDialog>
  );
}

function KindOption({
  active,
  icon,
  title,
  hint,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors",
        active ? "border-ink/30 bg-surface-2" : "border-line hover:bg-surface-2/60",
      )}
    >
      <span className="flex items-center gap-2 text-[0.82rem] font-medium text-ink">
        {icon}
        {title}
      </span>
      <span className="text-[0.68rem] leading-snug text-ink-3">{hint}</span>
    </button>
  );
}
