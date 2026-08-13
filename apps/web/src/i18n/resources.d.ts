import type en from "./locales/en.json";

/**
 * Typed translation keys.
 *
 * Augmenting i18next's `CustomTypeOptions` makes `useTranslation()` and the
 * global `i18n.t()` reject keys that do not exist in the English (source)
 * resource. The `resources` type is **namespace-keyed** (this is what i18next
 * v26 uses to derive the `Namespace`/`FlatNamespace` types for the `ns`
 * argument of `useTranslation(ns)`) — the runtime bundle keeps only the
 * English (source) locale in `i18n/index.ts`; other locales are loaded on
 * demand via `applyLanguage` so they stay out of the initial bundle.
 *
 * When a new key is added to `en.json`, translations for it must be added to
 * every other locale file — i18next falls back to English at runtime for any
 * missing key, so en/es parity is a review concern.
 */
declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "common";
    resources: typeof en;
  }
}
