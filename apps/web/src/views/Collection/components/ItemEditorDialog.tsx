"use client";

/**
 * ItemEditorDialog.tsx — create/edit one piece of gear.
 *
 * Every field the model carries is editable here: identity (name, brand, model,
 * finish, serial), taxonomy (category + type), sticker palette, purchase data
 * (acquired, price), organisation (status, favourite, rating, quantity,
 * condition, tags), media (photos) and references (links, notes).
 *
 * Photos are downscaled client-side (`compressImageFile`) before they become
 * data URLs — the collection lives in localStorage, so a raw phone photo would
 * blow the origin quota in one shot.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Heart, ImagePlus, Plus, Star, Trash2, X } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import i18n from "@/i18n";
import { FormDialog } from "./FormDialog";
import { compressImageFile } from "../imageUtils";
import {
  CONDITION_I18N_KEY,
  DEFAULT_PALETTE,
  PALETTE_PRESETS,
  STATUS_I18N_KEY,
  type CollectionCategory,
  type CollectionType,
  type GearItem,
  type GearLink,
  type GearPalette,
  type ItemCondition,
  type ItemInput,
  type ItemStatus,
} from "../collectionModel";

const STATUSES: readonly ItemStatus[] = ["owned", "wishlist", "sold", "lent"];
const CONDITIONS: readonly ItemCondition[] = ["mint", "good", "used", "broken"];

/** U D F B R L — the math-core face order. */
const PALETTE_FACES = ["U", "D", "F", "B", "R", "L"] as const;

interface FormState {
  name: string;
  categoryId: string;
  typeId: string;
  brand: string;
  model: string;
  finish: string;
  serial: string;
  palette: GearPalette;
  acquiredAt: string;
  priceAmount: string;
  priceCurrency: string;
  notes: string;
  links: GearLink[];
  photos: string[];
  tags: string[];
  status: ItemStatus;
  favorite: boolean;
  rating: number;
  quantity: string;
  condition: ItemCondition | "";
}

function emptyForm(categoryId: string, typeId: string): FormState {
  return {
    name: "",
    categoryId,
    typeId,
    brand: "",
    model: "",
    finish: "",
    serial: "",
    palette: DEFAULT_PALETTE,
    acquiredAt: "",
    priceAmount: "",
    priceCurrency: "EUR",
    notes: "",
    links: [],
    photos: [],
    tags: [],
    status: "owned",
    favorite: false,
    rating: 0,
    quantity: "1",
    condition: "",
  };
}

function formFromItem(item: GearItem): FormState {
  return {
    name: item.name,
    categoryId: item.categoryId,
    typeId: item.typeId ?? "",
    brand: item.brand ?? "",
    model: item.model ?? "",
    finish: item.finish ?? "",
    serial: item.serial ?? "",
    palette: item.palette,
    acquiredAt: item.acquiredAt ?? "",
    priceAmount: item.price ? String(item.price.amount) : "",
    priceCurrency: item.price?.currency ?? "EUR",
    notes: item.notes ?? "",
    links: [...item.links],
    photos: [...item.photos],
    tags: [...item.tags],
    status: item.status,
    favorite: item.favorite,
    rating: item.rating ?? 0,
    quantity: String(item.quantity),
    condition: item.condition ?? "",
  };
}

export interface ItemEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present ⇒ edit mode; omitted ⇒ create mode. */
  item?: GearItem | null;
  categories: readonly CollectionCategory[];
  types: readonly CollectionType[];
  defaultCategoryId?: string | null;
  defaultTypeId?: string | null;
  onSave: (input: ItemInput) => void;
}

export function ItemEditorDialog({
  open,
  onOpenChange,
  item,
  categories,
  types,
  defaultCategoryId,
  defaultTypeId,
  onSave,
}: ItemEditorDialogProps) {
  const { t } = useTranslation("collection");
  const initialCategory = defaultCategoryId ?? categories[0]?.id ?? "";
  const [form, setForm] = useState<FormState>(() =>
    emptyForm(initialCategory, defaultTypeId ?? ""),
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setForm(
      item
        ? formFromItem(item)
        : emptyForm(defaultCategoryId ?? categories[0]?.id ?? "", defaultTypeId ?? ""),
    );
  }, [open, item, defaultCategoryId, defaultTypeId, categories]);

  const availableTypes = useMemo(
    () => types.filter((type) => type.categoryId === form.categoryId),
    [types, form.categoryId],
  );

  const patch = (values: Partial<FormState>) => setForm((current) => ({ ...current, ...values }));

  const setCategory = (categoryId: string) => {
    const stillValid = types.some((type) => type.id === form.typeId && type.categoryId === categoryId);
    patch({ categoryId, typeId: stillValid ? form.typeId : "" });
  };

  const addTag = (raw: string) => {
    const tag = raw.trim().replace(/,+$/, "");
    if (!tag) return;
    if (form.tags.some((existing) => existing.toLowerCase() === tag.toLowerCase())) return;
    patch({ tags: [...form.tags, tag] });
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    try {
      const encoded = await Promise.all([...files].map((file) => compressImageFile(file)));
      patch({ photos: [...form.photos, ...encoded] });
    } catch {
      toast.error(t("editor.photoError"));
    }
  };

  const submit = () => {
    if (!form.name.trim() || !form.categoryId) return;
    const amount = Number.parseFloat(form.priceAmount);
    const input: ItemInput = {
      categoryId: form.categoryId,
      typeId: form.typeId || null,
      name: form.name,
      brand: form.brand,
      model: form.model,
      finish: form.finish,
      serial: form.serial,
      palette: form.palette,
      acquiredAt: form.acquiredAt,
      price: form.priceAmount && !Number.isNaN(amount)
        ? { amount, currency: form.priceCurrency || "EUR" }
        : undefined,
      notes: form.notes,
      links: form.links.filter((link) => link.url.trim()),
      photos: form.photos,
      tags: form.tags,
      status: form.status,
      favorite: form.favorite,
      rating: form.rating || undefined,
      quantity: Number.parseInt(form.quantity, 10) || 1,
      condition: form.condition || undefined,
    };
    onSave(input);
    onOpenChange(false);
  };

  const canSubmit = form.name.trim().length > 0 && !!form.categoryId;

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={item ? t("editor.editTitle") : t("editor.createTitle")}
      description={t("editor.description")}
      className="sm:max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {i18n.t("common:cancel")}
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            {item ? t("dialog.save") : t("editor.add")}
          </Button>
        </>
      }
    >
      {/* ── Identity ─────────────────────────────────────────────────── */}
      <Section title={t("editor.identity")}>
        <div className="space-y-2">
          <Label htmlFor="item-name">{t("editor.name")}</Label>
          <Input
            id="item-name"
            value={form.name}
            autoFocus
            placeholder={t("editor.namePlaceholder")}
            onChange={(event) => patch({ name: event.target.value })}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={t("editor.brand")}>
            <Input value={form.brand} onChange={(event) => patch({ brand: event.target.value })} />
          </Field>
          <Field label={t("editor.model")}>
            <Input value={form.model} onChange={(event) => patch({ model: event.target.value })} />
          </Field>
          <Field label={t("editor.finish")}>
            <Input value={form.finish} onChange={(event) => patch({ finish: event.target.value })} />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("editor.category")}>
            <Select value={form.categoryId} onValueChange={setCategory}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("editor.category")} />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("editor.type")}>
            <Select
              value={form.typeId || "__none"}
              onValueChange={(value) => patch({ typeId: value === "__none" ? "" : value })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">{t("editor.noType")}</SelectItem>
                {availableTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </Section>

      {/* ── Organisation ─────────────────────────────────────────────── */}
      <Section title={t("editor.organisation")}>
        <div className="flex flex-wrap gap-1.5">
          {STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              aria-pressed={form.status === status}
              onClick={() => patch({ status })}
              className={cn(
                "rounded-full border px-3 py-1 text-[0.72rem] transition-colors",
                form.status === status
                  ? "border-transparent bg-ink text-canvas"
                  : "border-line text-ink-3 hover:text-ink",
              )}
            >
              {t(STATUS_I18N_KEY[status])}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={t("editor.quantity")}>
            <Input
              type="number"
              min={1}
              value={form.quantity}
              onChange={(event) => patch({ quantity: event.target.value })}
            />
          </Field>
          <Field label={t("editor.condition")}>
            <Select
              value={form.condition || "__none"}
              onValueChange={(value) =>
                patch({ condition: value === "__none" ? "" : (value as ItemCondition) })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">{t("editor.noCondition")}</SelectItem>
                {CONDITIONS.map((condition) => (
                  <SelectItem key={condition} value={condition}>
                    {t(CONDITION_I18N_KEY[condition])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("editor.serial")}>
            <Input value={form.serial} onChange={(event) => patch({ serial: event.target.value })} />
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <StarRating value={form.rating} onChange={(rating) => patch({ rating })} />
          <label className="flex cursor-pointer items-center gap-2 text-[0.78rem] text-ink-2">
            <Switch
              checked={form.favorite}
              onCheckedChange={(checked) => patch({ favorite: checked })}
            />
            <Heart className={cn("size-3.5", form.favorite && "fill-current text-ink")} />
            {t("editor.favorite")}
          </label>
        </div>
      </Section>

      {/* ── Palette ──────────────────────────────────────────────────── */}
      <Section title={t("editor.palette")}>
        <div className="flex flex-wrap gap-1.5">
          {PALETTE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => patch({ palette: preset.palette })}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.7rem] transition-colors",
                "border-line text-ink-3 hover:text-ink",
              )}
            >
              <span className="flex gap-0.5">
                {preset.palette.slice(0, 3).map((colour, index) => (
                  <span
                    key={index}
                    className="size-2.5 rounded-full border border-black/10"
                    style={{ background: colour }}
                  />
                ))}
              </span>
              {t(preset.labelKey)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          {PALETTE_FACES.map((face, index) => (
            <label key={face} className="flex flex-col items-center gap-1 text-[0.62rem] text-ink-3">
              {face}
              <input
                type="color"
                value={form.palette[index]}
                onChange={(event) => {
                  const next = [...form.palette] as unknown as string[];
                  next[index] = event.target.value;
                  patch({ palette: next as unknown as GearPalette });
                }}
                className="size-7 cursor-pointer rounded-md border border-line bg-transparent"
              />
            </label>
          ))}
        </div>
      </Section>

      {/* ── Purchase ─────────────────────────────────────────────────── */}
      <Section title={t("editor.purchase")}>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={t("editor.acquired")}>
            <Input
              type="date"
              value={form.acquiredAt}
              onChange={(event) => patch({ acquiredAt: event.target.value })}
            />
          </Field>
          <Field label={t("editor.price")}>
            <Input
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              placeholder="0.00"
              value={form.priceAmount}
              onChange={(event) => patch({ priceAmount: event.target.value })}
            />
          </Field>
          <Field label={t("editor.currency")}>
            <Input
              value={form.priceCurrency}
              maxLength={3}
              onChange={(event) => patch({ priceCurrency: event.target.value.toUpperCase() })}
            />
          </Field>
        </div>
      </Section>

      {/* ── Tags ─────────────────────────────────────────────────────── */}
      <Section title={t("editor.tags")}>
        <TagInput
          tags={form.tags}
          placeholder={t("editor.tagsPlaceholder")}
          onAdd={addTag}
          onRemove={(tag) => patch({ tags: form.tags.filter((existing) => existing !== tag) })}
        />
      </Section>

      {/* ── Photos ───────────────────────────────────────────────────── */}
      <Section title={t("editor.photos")}>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {form.photos.map((photo, index) => (
            <div key={`${photo.slice(0, 24)}-${index}`} className="group relative">
              <img
                src={photo}
                alt=""
                className="aspect-square w-full rounded-lg border border-line object-cover"
              />
              <button
                type="button"
                aria-label={t("editor.removePhoto")}
                onClick={() => patch({ photos: form.photos.filter((_, i) => i !== index) })}
                className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line-2 text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <ImagePlus className="size-4" />
            <span className="text-[0.66rem]">{t("editor.addPhoto")}</span>
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(event) => {
            void handleFiles(event.target.files);
            event.target.value = "";
          }}
        />
        <p className="text-[0.68rem] text-ink-3">{t("editor.photoHint")}</p>
      </Section>

      {/* ── Links + notes ────────────────────────────────────────────── */}
      <Section title={t("editor.links")}>
        <LinksEditor
          links={form.links}
          labels={{ label: t("editor.linkLabel"), url: t("editor.linkUrl"), remove: t("editor.removeLink") }}
          onChange={(links) => patch({ links })}
          addLabel={t("editor.addLink")}
        />
      </Section>

      <Section title={t("editor.notes")}>
        <Textarea
          rows={3}
          value={form.notes}
          placeholder={t("editor.notesPlaceholder")}
          onChange={(event) => patch({ notes: event.target.value })}
        />
      </Section>
    </FormDialog>
  );
}

// ─── Field helpers ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-ink-3">{title}</h3>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[0.72rem] font-normal text-ink-3">{label}</Label>
      {children}
    </div>
  );
}

function StarRating({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          aria-label={`${star}`}
          onClick={() => onChange(value === star ? 0 : star)}
          className="text-ink-3 transition-colors hover:text-ink"
        >
          <Star className={cn("size-4", star <= value && "fill-current text-ink")} />
        </button>
      ))}
    </div>
  );
}

function TagInput({
  tags,
  placeholder,
  onAdd,
  onRemove,
}: {
  tags: readonly string[];
  placeholder: string;
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-line px-2 py-1.5">
      {tags.map((tag) => (
        <Badge key={tag} variant="secondary" className="gap-1 rounded-full text-[0.68rem] font-normal">
          {tag}
          <button type="button" aria-label={tag} onClick={() => onRemove(tag)}>
            <X className="size-3" />
          </button>
        </Badge>
      ))}
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            onAdd(value);
            setValue("");
          } else if (event.key === "Backspace" && !value && tags.length > 0) {
            onRemove(tags[tags.length - 1]);
          }
        }}
        onBlur={() => {
          if (value.trim()) {
            onAdd(value);
            setValue("");
          }
        }}
        className="min-w-[8rem] flex-1 bg-transparent text-[0.8rem] text-ink outline-none placeholder:text-ink-3"
      />
    </div>
  );
}

function LinksEditor({
  links,
  labels,
  addLabel,
  onChange,
}: {
  links: readonly GearLink[];
  labels: { label: string; url: string; remove: string };
  addLabel: string;
  onChange: (links: GearLink[]) => void;
}) {
  return (
    <div className="space-y-2">
      {links.map((link, index) => (
        <div key={index} className="flex items-center gap-2">
          <Input
            value={link.label}
            placeholder={labels.label}
            className="w-32 shrink-0"
            onChange={(event) =>
              onChange(links.map((item, i) => (i === index ? { ...item, label: event.target.value } : item)))
            }
          />
          <Input
            value={link.url}
            placeholder={labels.url}
            onChange={(event) =>
              onChange(links.map((item, i) => (i === index ? { ...item, url: event.target.value } : item)))
            }
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={labels.remove}
            onClick={() => onChange(links.filter((_, i) => i !== index))}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => onChange([...links, { label: "", url: "" }])}
      >
        <Plus className="size-3.5" />
        {addLabel}
      </Button>
    </div>
  );
}
