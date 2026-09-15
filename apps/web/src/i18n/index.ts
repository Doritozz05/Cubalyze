import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { preferencesStore, type AppLanguage } from "@cubalyze/state";
import en from "./locales/en.json";
// NOTE: `es` is intentionally NOT imported statically — it is loaded on demand
// (see `ensureSpanish`) so the initial bundle only ships one language.

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

// English is the bundled fallback AND the source of the typed keys; every
// other locale is loaded on demand (see `applyLanguage` below) so the initial
// bundle only carries one language (~60 kB gzip saved).
export const resources = {
  en,
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

// ── Lazy locale loading ────────────────────────────────────────────────
// English ships with the bundle (it's the fallback + the typed-key source).
// Spanish loads on first use; the rest of the app never blocks on it.
let spanishBundle: Promise<void> | null = null;

function ensureSpanish(): Promise<void> {
  if (spanishBundle) return spanishBundle;
  spanishBundle = import("./locales/es.json").then((mod) => {
    const es = mod.default as typeof en;
    for (const ns of NAMESPACES) {
      i18n.addResourceBundle("es", ns, es[ns], true, true);
    }
  });
  return spanishBundle;
}

/**
 * Apply a concrete language, loading its bundle on demand first.
 * Awaitable so callers (and tests) can wait for the async `es` load.
 */
export async function applyLanguage(lng: "en" | "es"): Promise<void> {
  if (lng === "es") await ensureSpanish();
  await i18n.changeLanguage(lng);
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
    // Start on the bundled fallback; the real preference (which may be "es"
    // and therefore needs its lazy bundle) is applied right after init below.
    lng: FALLBACK_LNG,
    fallbackLng: FALLBACK_LNG,
    supportedLngs: SUPPORTED_LNGS,
    nonExplicitSupportedLngs: true,
    load: "languageOnly",
    interpolation: { escapeValue: false }, // React already escapes output
    react: { useSuspense: false }, // resources are bundled — no Suspense needed
  })
  .then(() => applyLanguage(resolveLanguage(preferencesStore.getState().language)))
  .catch((err) => console.error("[i18n] Failed to apply initial language:", err));

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
  void applyLanguage(resolveLanguage(state.language));
});

export default i18n;
