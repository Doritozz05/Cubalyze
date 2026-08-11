import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { preferencesStore, type AppLanguage } from "@cubeforge/state";
import en from "./locales/en.json";
import es from "./locales/es.json";

/**
 * Professional i18n bootstrap (react-i18next + i18next).
 *
 * - Locale JSONs are bundled (no backend), so init is synchronous and
 *   translations are available on the first render.
 * - The language preference lives in `preferencesStore` (persisted in
 *   localStorage under `cubeforge-prefs`), NOT in a detector cache — the
 *   store is the single source of truth. `'auto'` follows the browser.
 * - The Settings → General selector calls `preferencesStore.setLanguage(...)`
 *   and this module follows; the `languageChanged` event keeps `<html lang>`
 *   in sync for screen readers and translation tools.
 * - Keys are fully typed: `useTranslation()` (or `t()` in non-React code via
 *   `import i18n from "@/i18n"`) only accepts keys that exist in `en.json`.
 *
 * @see ./README.md for the migration playbook.
 */

export const resources = {
  en,
  es,
} as const;

/**
 * Selectable languages for the Settings → General selector. `flagCountry` is
 * the ISO 3166-1 alpha-2 code whose flag represents the language in the UI
 * (rendered via `CountryFlag`). Labels are shown in their own language.
 */
export const SUPPORTED_LANGUAGES: ReadonlyArray<{
  code: Exclude<AppLanguage, "auto">;
  label: string;
  flagCountry: string;
}> = [
  { code: "en", label: "English", flagCountry: "US" },
  { code: "es", label: "Español", flagCountry: "ES" },
];

const NAMESPACES = Object.keys(en) as Array<keyof typeof en>;
const DEFAULT_NS: keyof typeof en = "common";
const FALLBACK_LNG = "en";
const SUPPORTED_LNGS = ["en", "es"];

/** Browser-language detection used when the preference is 'auto'. */
export function detectBrowserLanguage(): "en" | "es" {
  if (typeof navigator === "undefined") return "en";
  const candidates =
    navigator.languages && navigator.languages.length > 0
      ? navigator.languages
      : [navigator.language];
  const prefersSpanish = candidates.some((l) => l?.toLowerCase().startsWith("es"));
  return prefersSpanish ? "es" : "en";
}

/** Resolve the effective concrete language from the stored preference. */
export function resolveLanguage(preference: AppLanguage): "en" | "es" {
  return preference === "auto" ? detectBrowserLanguage() : preference;
}

/** Keep `<html lang>` in sync for a11y + translation tools (guarded for non-DOM envs). */
function applyHtmlLang(lng: string) {
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("lang", lng);
  }
}

/** Keep the tab title localized (tanda 13; EN static `<title>` is the SEO base). */
function applyDocumentTitle() {
  if (typeof document !== "undefined") {
    document.title = i18n.t("common:appTitle");
  }
}

void i18n
  .use(initReactI18next)
  .init({
    resources,
    ns: NAMESPACES,
    defaultNS: DEFAULT_NS,
    lng: resolveLanguage(preferencesStore.getState().language),
    fallbackLng: FALLBACK_LNG,
    supportedLngs: SUPPORTED_LNGS,
    nonExplicitSupportedLngs: true,
    load: "languageOnly",
    interpolation: { escapeValue: false }, // React already escapes output
    react: { useSuspense: false }, // resources are bundled — no Suspense needed
  });

// Initial <html lang> + tab title (init does not fire `languageChanged` for the first lng).
applyHtmlLang(i18n.language);
applyDocumentTitle();

// Keep <html lang> + tab title in sync on any runtime language change.
i18n.on("languageChanged", (lng) => {
  applyHtmlLang(lng);
  applyDocumentTitle();
});

// The store drives i18n: the Settings → General selector calls
// `preferencesStore.setLanguage(...)` and i18n follows.
preferencesStore.subscribe((state, prev) => {
  if (state.language === prev.language) return;
  void i18n.changeLanguage(resolveLanguage(state.language));
});

export default i18n;
