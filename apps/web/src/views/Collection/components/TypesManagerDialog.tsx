"use client";

/**
 * TypesManagerDialog.tsx — the roomy home for the inner level.
 *
 * The old tree put "add type" one 6px dashed row inside every category node,
 * which is exactly what made it feel cramped. Here the selected category owns a
 * full dialog: a clear add row, one row per type with inline rename and an
 * optional link to the app's puzzle list, and — for cube categories — the
 * exclusions that decide which app categories are mirrored.
 */

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import i18n from "@/i18n";
import type { PuzzleCategory } from "@/types";
import {
  countItemsInType,
  type CollectionCategory,
  type CollectionState,
  type CollectionType,
} from "../collectionModel";
import { GLOBAL_CATEGORY_OPTIONS } from "../collectionStore";
import { FormDialog } from "./FormDialog";

const NONE = "__none";

export interface TypesManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: CollectionState;
  category: CollectionCategory | null;
  onAdd: (name: string, puzzleCategory: PuzzleCategory | null) => void;
  onUpdate: (type: CollectionType, patch: { name?: string; puzzleCategory?: PuzzleCategory | null }) => void;
  onDelete: (type: CollectionType) => void;
  onToggleExclusion: (category: PuzzleCategory, include: boolean) => void;
  onSync: () => void;
}

export function TypesManagerDialog({
  open,
  onOpenChange,
  state,
  category,
  onAdd,
  onUpdate,
  onDelete,
  onToggleExclusion,
  onSync,
}: TypesManagerDialogProps) {
  const { t } = useTranslation("collection");
  const [draftName, setDraftName] = useState("");
  const [draftLink, setDraftLink] = useState<string>(NONE);

  useEffect(() => {
    if (!open) {
      setDraftName("");
      setDraftLink(NONE);
    }
  }, [open, category?.id]);

  if (!category) return null;
  const isCube = category.kind === "cube";
  const types = state.types.filter((type) => type.categoryId === category.id);
  const excludedSet = new Set(state.excludedCategories);

  const submit = () => {
    const name = draftName.trim();
    if (!name) return;
    onAdd(name, draftLink === NONE ? null : (draftLink as PuzzleCategory));
    setDraftName("");
    setDraftLink(NONE);
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("manage.typesTitle", { category: category.name })}
      description={t("manage.typesDescription")}
      className="sm:max-w-xl"
      footer={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {i18n.t("common:close")}
        </Button>
      }
    >
      {/* ── Add a type ─────────────────────────────────────────────────── */}
      <section className="space-y-2">
        <h3 className="text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-ink-3">
          {t("manage.addType")}
        </h3>
        <div className="flex items-end gap-2">
          <Input
            value={draftName}
            autoFocus
            placeholder={t("manage.typeNamePlaceholder")}
            onChange={(event) => setDraftName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submit();
            }}
          />
          {isCube ? (
            <Select value={draftLink} onValueChange={setDraftLink}>
              <SelectTrigger className="w-[12rem] shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t("manage.linkNone")}</SelectItem>
                {GLOBAL_CATEGORY_OPTIONS.map((option) => (
                  <SelectItem key={option.category} value={option.category}>
                    {option.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <Button className="shrink-0 gap-1.5" onClick={submit} disabled={!draftName.trim()}>
            <Plus className="size-3.5" />
            {t("manage.add")}
          </Button>
        </div>
        {isCube ? <p className="text-[0.68rem] text-ink-3">{t("manage.linkHint")}</p> : null}
      </section>

      {/* ── Existing types ─────────────────────────────────────────────── */}
      <section className="space-y-2">
        <h3 className="text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-ink-3">
          {t("manage.existingTypes")}
        </h3>
        {types.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line-2 px-4 py-6 text-center text-[0.74rem] text-ink-3">
            {t("manage.noTypes")}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {types.map((type) => (
              <TypeRow
                key={type.id}
                type={type}
                isCube={isCube}
                count={countItemsInType(state, type.id)}
                onUpdate={onUpdate}
                onDelete={onDelete}
              />
            ))}
          </ul>
        )}
      </section>

      {/* ── App-category mirror (cube categories only) ─────────────────── */}
      {isCube ? (
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-ink-3">
              {t("manage.appCategories")}
            </h3>
            <button
              type="button"
              onClick={onSync}
              className="flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[0.68rem] text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <RefreshCw className="size-3" />
              {t("manage.sync")}
            </button>
          </div>
          <p className="text-[0.7rem] leading-relaxed text-ink-3">{t("manage.appCategoriesHint")}</p>
          <ul className="space-y-1.5">
            {GLOBAL_CATEGORY_OPTIONS.map((option) => {
              const included = !excludedSet.has(option.category);
              return (
                <li
                  key={option.category}
                  className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="text-[0.78rem] text-ink">{option.name}</span>
                    {option.planned ? (
                      <Badge variant="outline" className="text-[0.58rem] uppercase tracking-wide">
                        {t("planned")}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    {included ? <Check className="size-3.5 text-ink-3" /> : null}
                    <Switch
                      checked={included}
                      aria-label={option.name}
                      onCheckedChange={(checked) => onToggleExclusion(option.category, checked)}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </FormDialog>
  );
}

function TypeRow({
  type,
  isCube,
  count,
  onUpdate,
  onDelete,
}: {
  type: CollectionType;
  isCube: boolean;
  count: number;
  onUpdate: TypesManagerDialogProps["onUpdate"];
  onDelete: TypesManagerDialogProps["onDelete"];
}) {
  const { t } = useTranslation("collection");
  const [name, setName] = useState(type.name);

  // Follow external renames (e.g. a sync) while the row is not being edited.
  useEffect(() => {
    setName(type.name);
  }, [type.name]);

  const commit = () => {
    const next = name.trim();
    if (!next || next === type.name) {
      setName(type.name);
      return;
    }
    onUpdate(type, { name: next });
  };

  return (
    <li className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-2">
      <Input
        value={name}
        onChange={(event) => setName(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          } else if (event.key === "Escape") {
            setName(type.name);
            event.currentTarget.blur();
          }
        }}
        className="h-8 flex-1 border-transparent bg-transparent px-2 text-[0.8rem] shadow-none focus-visible:border-line"
      />
      {isCube ? (
        <Select
          value={type.puzzleCategory ?? NONE}
          onValueChange={(value) =>
            onUpdate(type, { puzzleCategory: value === NONE ? null : (value as PuzzleCategory) })
          }
        >
          <SelectTrigger size="sm" className="w-[10.5rem] shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>{t("manage.linkNone")}</SelectItem>
            {GLOBAL_CATEGORY_OPTIONS.map((option) => (
              <SelectItem key={option.category} value={option.category}>
                {option.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      <span className="w-10 shrink-0 text-right tabular-nums text-[0.7rem] text-ink-3">{count}</span>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t("manage.deleteType")}
        title={t("manage.deleteType")}
        className="text-destructive hover:text-destructive"
        onClick={() => onDelete(type)}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </li>
  );
}
