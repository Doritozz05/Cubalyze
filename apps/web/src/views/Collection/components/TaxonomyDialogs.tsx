"use client";

/**
 * TaxonomyDialogs.tsx — create/edit surfaces for the two taxonomy levels.
 *
 *   • CategoryDialog   — the outer level (Cubos, Lubes, Gear, …)
 *   • TypeDialog       — the inner level (3×3, 2×2, Pyraminx, …)
 *   • ExclusionsDialog — which global puzzle categories a cube category mirrors
 *
 * Accent colours are offered as **theme tokens** (`var(--ready)`, `var(--ink-3)`
 * …) rather than raw hex, so a category chip always belongs to the active
 * theme — including custom themes and liquid glass.
 */

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ParseKeys } from "i18next";
import { Box, Check, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import i18n from "@/i18n";
import { FormDialog } from "./FormDialog";
import { CATEGORY_ICON_IDS, categoryIcon } from "../collectionIcons";
import type { CategoryKind, CollectionCategory, CollectionType } from "../collectionModel";
import { GLOBAL_CATEGORY_OPTIONS } from "../collectionStore";
import type { PuzzleCategory } from "@/types";

/** Theme-token accents — never raw hex, so they follow the active theme. */
const ACCENT_OPTIONS: readonly {
  id: string;
  value?: string;
  labelKey: ParseKeys<"collection">;
}[] = [
  { id: "none", value: undefined, labelKey: "accents.none" },
  { id: "ink", value: "var(--ink-3)", labelKey: "accents.neutral" },
  { id: "ready", value: "var(--ready)", labelKey: "accents.green" },
  { id: "caution", value: "var(--caution)", labelKey: "accents.amber" },
  { id: "plus2", value: "var(--plus2)", labelKey: "accents.orange" },
  { id: "hold", value: "var(--hold)", labelKey: "accents.red" },
  { id: "dnf", value: "var(--dnf)", labelKey: "accents.crimson" },
];

// ─── Category ────────────────────────────────────────────────────────────────

export interface CategoryDraft {
  name: string;
  kind: CategoryKind;
  icon: string;
  accent?: string;
}

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
            hint={t("dialog.category.kindCubeHint")}
            onClick={() => setDraft((d) => ({ ...d, kind: "cube" }))}
          />
          <KindOption
            active={draft.kind === "gear"}
            icon={<Package className="size-4" />}
            title={t("kinds.gear")}
            hint={t("dialog.category.kindGearHint")}
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
        <div className="flex flex-wrap gap-2">
          {ACCENT_OPTIONS.map((option) => {
            const active = (draft.accent ?? undefined) === option.value;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={active}
                onClick={() => setDraft((d) => ({ ...d, accent: option.value }))}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.7rem] transition-colors",
                  active ? "border-ink/30 bg-surface-2 text-ink" : "border-line text-ink-3 hover:text-ink",
                )}
              >
                <span
                  className="size-2.5 rounded-full border border-line"
                  style={{ background: option.value ?? "transparent" }}
                />
                {t(option.labelKey)}
              </button>
            );
          })}
        </div>
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

// ─── Type ────────────────────────────────────────────────────────────────────

export interface TypeDraft {
  name: string;
  puzzleCategory: PuzzleCategory | null;
}

export function TypeDialog({
  open,
  onOpenChange,
  categoryKind,
  defaultCategoryId,
  type,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryKind: CategoryKind;
  /** Only used for the description; the caller owns the categoryId. */
  defaultCategoryId?: string;
  type?: CollectionType | null;
  onSave: (draft: TypeDraft) => void;
}) {
  const { t } = useTranslation("collection");
  const [draft, setDraft] = useState<TypeDraft>({ name: "", puzzleCategory: null });

  useEffect(() => {
    if (!open) return;
    setDraft(
      type
        ? { name: type.name, puzzleCategory: type.puzzleCategory }
        : { name: "", puzzleCategory: null },
    );
  }, [open, type, defaultCategoryId]);

  const submit = () => {
    if (!draft.name.trim()) return;
    onSave({ ...draft, name: draft.name.trim() });
    onOpenChange(false);
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={type ? t("dialog.type.editTitle") : t("dialog.type.createTitle")}
      description={t("dialog.type.description")}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {i18n.t("common:cancel")}
          </Button>
          <Button onClick={submit} disabled={!draft.name.trim()}>
            {type ? t("dialog.save") : t("dialog.create")}
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        <Label htmlFor="type-name">{t("dialog.type.name")}</Label>
        <Input
          id="type-name"
          value={draft.name}
          autoFocus
          placeholder={t("dialog.type.namePlaceholder")}
          onChange={(event) => setDraft((d) => ({ ...d, name: event.target.value }))}
          onKeyDown={(event) => {
            if (event.key === "Enter") submit();
          }}
        />
      </div>

      {categoryKind === "cube" ? (
        <div className="space-y-2">
          <Label>{t("dialog.type.link")}</Label>
          <p className="text-[0.72rem] leading-relaxed text-ink-3">{t("dialog.type.linkHint")}</p>
          <Select
            value={draft.puzzleCategory ?? "__none"}
            onValueChange={(value) =>
              setDraft((d) => ({
                ...d,
                puzzleCategory: value === "__none" ? null : (value as PuzzleCategory),
              }))
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">{t("dialog.type.linkNone")}</SelectItem>
              {GLOBAL_CATEGORY_OPTIONS.map((option) => (
                <SelectItem key={option.category} value={option.category}>
                  {option.name}
                  {option.planned ? ` · ${t("planned")}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <p className="rounded-lg border border-line bg-surface-2/50 px-3 py-2.5 text-[0.72rem] leading-relaxed text-ink-3">
          {t("dialog.type.noDefaults")}
        </p>
      )}
    </FormDialog>
  );
}

// ─── Exclusions ──────────────────────────────────────────────────────────────

export function ExclusionsDialog({
  open,
  onOpenChange,
  excluded,
  onToggle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  excluded: readonly PuzzleCategory[];
  onToggle: (category: PuzzleCategory, include: boolean) => void;
}) {
  const { t } = useTranslation("collection");
  const excludedSet = new Set(excluded);

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("dialog.exclusions.title")}
      description={t("dialog.exclusions.description")}
      footer={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {i18n.t("common:done")}
        </Button>
      }
    >
      <div className="space-y-1.5">
        {GLOBAL_CATEGORY_OPTIONS.map((option) => {
          const included = !excludedSet.has(option.category);
          return (
            <div
              key={option.category}
              className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2.5"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[0.82rem] font-medium text-ink">
                  {option.name}
                  {option.planned ? (
                    <Badge variant="outline" className="text-[0.6rem] uppercase tracking-wide">
                      {t("planned")}
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-0.5 text-[0.68rem] text-ink-3">
                  {included ? t("dialog.exclusions.included") : t("dialog.exclusions.excluded")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {included ? <Check className="size-3.5 text-ink-3" /> : null}
                <Switch
                  checked={included}
                  onCheckedChange={(checked) => onToggle(option.category, checked)}
                  aria-label={option.name}
                />
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[0.7rem] leading-relaxed text-ink-3">{t("dialog.exclusions.footnote")}</p>
    </FormDialog>
  );
}
