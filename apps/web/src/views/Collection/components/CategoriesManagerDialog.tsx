"use client";

/**
 * CategoriesManagerDialog.tsx — the roomy home for the outer level.
 *
 * Editing and deleting a category used to hide behind a ⋯ crammed next to its
 * nav row. Here every category gets a full row: icon, name, kind, what it
 * holds, and its two actions. Creating one is a single prominent button.
 */

import { useTranslation } from "react-i18next";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import i18n from "@/i18n";
import { categoryIcon } from "../collectionIcons";
import { KIND_I18N_KEY, countItemsInCategory, type CollectionCategory, type CollectionState } from "../collectionModel";
import { FormDialog } from "./FormDialog";

export interface CategoriesManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: CollectionState;
  onAdd: () => void;
  onEdit: (category: CollectionCategory) => void;
  onDelete: (category: CollectionCategory) => void;
}

export function CategoriesManagerDialog({
  open,
  onOpenChange,
  state,
  onAdd,
  onEdit,
  onDelete,
}: CategoriesManagerDialogProps) {
  const { t } = useTranslation("collection");

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("manage.categoriesTitle")}
      description={t("manage.categoriesDescription")}
      className="sm:max-w-xl"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {i18n.t("common:close")}
          </Button>
          <Button className="gap-1.5" onClick={onAdd}>
            <Plus className="size-3.5" />
            {t("nav.newCategory")}
          </Button>
        </>
      }
    >
      {state.categories.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line-2 px-4 py-8 text-center text-[0.78rem] text-ink-3">
          {t("manage.noCategories")}
        </p>
      ) : (
        <ul className="space-y-2">
          {state.categories.map((category) => {
            const Icon = categoryIcon(category.icon);
            const typeCount = state.types.filter((type) => type.categoryId === category.id).length;
            return (
              <li
                key={category.id}
                className="flex items-center gap-3 rounded-lg border border-line px-3 py-2.5"
              >
                <span
                  className="flex size-8 shrink-0 items-center justify-center rounded-md border border-line bg-surface-2"
                  style={category.accent ? { color: category.accent } : undefined}
                >
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[0.82rem] font-medium text-ink">
                      {category.name}
                    </span>
                    <Badge variant="secondary" className="shrink-0 text-[0.6rem] uppercase tracking-wide">
                      {t(KIND_I18N_KEY[category.kind])}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-[0.68rem] text-ink-3">
                    {t("manage.holds", {
                      items: countItemsInCategory(state, category.id),
                      types: typeCount,
                    })}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("nav.editCategory")}
                  title={t("nav.editCategory")}
                  onClick={() => onEdit(category)}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("nav.deleteCategory")}
                  title={t("nav.deleteCategory")}
                  className="text-destructive hover:text-destructive"
                  onClick={() => onDelete(category)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </FormDialog>
  );
}
