"use client";

/**
 * GearSpecSheet.tsx — the detail panel.
 *
 * EXPERIMENTAL (branch `exp/cube-collection`).
 *
 * The rail is the showroom; this is the product page. It follows the IKEA
 * grammar on purpose — name, then a plain spec table with right-aligned
 * values, then the notes, then the links — because that layout stays legible
 * with twelve items or twelve hundred, and it deliberately does not compete
 * with the glyph for attention.
 *
 * Assignment to a session is the one action this feature will grow into; it is
 * present but inert, so the layout is already proven.
 */

import { useTranslation } from "react-i18next";
import { Camera, ExternalLink, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  KIND_I18N_KEY,
  formatAcquired,
  formatPrice,
  type GearItem,
} from "../collectionModel";

interface SpecRow {
  key: string;
  label: string;
  value: string;
}

export function GearSpecSheet({ item }: { item: GearItem }) {
  const { t, i18n } = useTranslation("collection");

  // Built inline (rather than a helper taking `t`) so the translation function
  // keeps its inferred, namespace-typed signature.
  const rows: SpecRow[] = [
    { key: "kind", label: t("spec.kind"), value: t(KIND_I18N_KEY[item.kind]) },
  ];
  if (item.brand) rows.push({ key: "brand", label: t("spec.brand"), value: item.brand });
  if (item.model) rows.push({ key: "model", label: t("spec.model"), value: item.model });
  if (item.size) rows.push({ key: "size", label: t("spec.size"), value: item.size });

  const acquired = formatAcquired(item.acquiredAt, i18n.language);
  if (acquired) rows.push({ key: "acquired", label: t("spec.acquired"), value: acquired });

  const price = formatPrice(item.price, i18n.language);
  if (price) rows.push({ key: "price", label: t("spec.price"), value: price });
  const photos = item.photos ?? [];
  const links = item.links ?? [];

  return (
    <div className="grid gap-x-10 gap-y-8 px-1 lg:grid-cols-12">
      {/* ── Identity ─────────────────────────────────────────────────── */}
      <div className="lg:col-span-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="rounded-full text-[0.65rem] uppercase tracking-wider">
            {t(KIND_I18N_KEY[item.kind])}
          </Badge>
          {item.primary ? (
            <Badge className="gap-1 rounded-full text-[0.65rem] uppercase tracking-wider">
              <Star className="size-3" />
              {t("primary")}
            </Badge>
          ) : null}
          {(item.tags ?? []).map((tag) => (
            <Badge
              key={tag}
              variant="outline"
              className="rounded-full text-[0.65rem] font-normal text-ink-3"
            >
              {tag}
            </Badge>
          ))}
        </div>

        <h2 className="mt-4 text-xl font-semibold tracking-tight text-ink">{item.name}</h2>
        {item.brand || item.model ? (
          <p className="mt-1 text-sm text-ink-3">
            {[item.brand, item.model].filter(Boolean).join(" · ")}
          </p>
        ) : null}

        {item.notes ? (
          <p className="mt-5 max-w-prose text-[0.82rem] leading-relaxed text-ink-2">{item.notes}</p>
        ) : null}
      </div>

      {/* ── Spec table ───────────────────────────────────────────────── */}
      <div className="lg:col-span-4">
        <h3 className="text-[0.68rem] font-semibold uppercase tracking-wider text-ink-3">
          {t("spec.title")}
        </h3>
        <dl className="mt-3 divide-y divide-line border-y border-line">
          {rows.map((row) => (
            <div key={row.key} className="flex items-baseline justify-between gap-6 py-2.5">
              <dt className="text-[0.78rem] text-ink-3">{row.label}</dt>
              <dd className="text-right text-[0.82rem] font-medium text-ink">{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* ── Photos, links, action ────────────────────────────────────── */}
      <div className="flex flex-col gap-6 lg:col-span-3">
        <div>
          <h3 className="text-[0.68rem] font-semibold uppercase tracking-wider text-ink-3">
            {t("photos")}
          </h3>
          {photos.length > 0 ? (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {photos.map((photo) => (
                <img
                  key={photo}
                  src={photo}
                  alt=""
                  className="aspect-square w-full rounded-lg border border-line object-cover"
                />
              ))}
            </div>
          ) : (
            <div className="mt-3 flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line-2 bg-surface-2/40 text-center">
              <Camera className="size-4 text-ink-3" />
              <span className="text-[0.7rem] text-ink-3">{t("noPhotos")}</span>
            </div>
          )}
        </div>

        {links.length > 0 ? (
          <div>
            <h3 className="text-[0.68rem] font-semibold uppercase tracking-wider text-ink-3">
              {t("links")}
            </h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {links.map((link) => (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[0.75rem] text-ink-2 transition hover:bg-surface-2"
                >
                  {link.label}
                  <ExternalLink className="size-3" />
                </a>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-auto">
          <Button variant="outline" size="sm" disabled className="w-full justify-center gap-2">
            {t("assign")}
          </Button>
          <p className="mt-2 text-center text-[0.68rem] text-ink-3">{t("assignSoon")}</p>
        </div>
      </div>
    </div>
  );
}
