"use client";

import { useEffect } from "react";
import { useTranslation } from "react-i18next";

/**
 * Sets `document.title` for the currently visible view.
 *
 * The title is derived from i18n — it follows the active language (the
 * caller re-renders on language change because this hook subscribes via
 * useTranslation, and `i18n.language` is an effect dependency) — and gets
 * the " · Cubalyze" brand suffix appended.
 *
 * Only one stage view is mounted at a time, so mounting a new view simply
 * replaces the previous title; there are never conflicting writers.
 * Pass `null` when the view owns an even richer title through the same hook
 * (e.g. the reconstructions detail shows the record's id and solver).
 */
export function useDocumentTitle(title: string | null | undefined) {
  const { i18n } = useTranslation();

  useEffect(() => {
    if (title == null) return; // another view owns the title
    document.title = `${title} · ${i18n.t("meta:brand")}`;
  }, [title, i18n.language]); // eslint-disable-line react-hooks/exhaustive-deps
}
