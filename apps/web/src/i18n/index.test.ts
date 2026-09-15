import { describe, it, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import i18n, {
  SUPPORTED_LANGUAGES,
  detectBrowserLanguage,
  resolveLanguage,
} from "./index";
import { preferencesStore } from "@cubalyze/state";
import en from "./locales/en.json";
import es from "./locales/es.json";

/** Deep key paths of a locale object, e.g. `sections.profile.label`. */
function deepKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return deepKeys(v as Record<string, unknown>, path);
    }
    return [path];
  });
}

describe("i18n infrastructure", () => {
  afterEach(() => {
    // Leave the store in its default state so other suites are unaffected.
    preferencesStore.getState().setLanguage("auto");
  });

  it("exposes the two initial languages", () => {
    expect(SUPPORTED_LANGUAGES.map((l) => l.code)).toEqual(["en", "es"]);
  });

  it("initializes with a concrete supported language without throwing", () => {
    // Runs in a headless vitest env (Node ≥21 exposes `navigator` reflecting
    // the OS locale — which is itself the correct auto-detection source).
    expect(["en", "es"]).toContain(i18n.language);
  });

  it("resolveLanguage follows the stored preference", () => {
    expect(resolveLanguage("en")).toBe("en");
    expect(resolveLanguage("es")).toBe("es");
    // 'auto' delegates to browser detection.
    expect(resolveLanguage("auto")).toBe(detectBrowserLanguage());
  });

  it("detectBrowserLanguage always returns a supported language", () => {
    expect(["en", "es"]).toContain(detectBrowserLanguage());
  });

  it("es.json mirrors the en.json key structure (no silent English fallback)", () => {
    expect(deepKeys(es as Record<string, unknown>).sort()).toEqual(
      deepKeys(en as Record<string, unknown>).sort(),
    );
  });

  it("toda clave que el código busca de forma dinámica existe en ambos idiomas", () => {
    // `DataSection.tsx` maps a detected format to a translation KEY, so nowhere in
    // the codebase does a literal `t('data.formatName…')` exist: a typo in that map
    // renders the raw key in the import preview, and neither `tsc` nor the key-set
    // comparison above would notice. Renaming those keys (PR-5) is only safe because
    // of this test, so it reads the map from the source instead of repeating it.
    const source = readFileSync(
      fileURLToPath(new URL("../components/Settings/sections/DataSection.tsx", import.meta.url)),
      "utf8",
    );
    const keys = [...source.matchAll(/'(data\.[A-Za-z0-9_]+)'/g)].map((m) => m[1]!);
    expect(keys.length, "no se extrajo ninguna clave: el test estaría pasando en falso").toBeGreaterThan(
      0,
    );

    // The component resolves its keys inside a namespace (`useTranslation('settings')`),
    // so the locale path is `<namespace>.<key>`. Read it from the source rather than
    // hardcoding it, so moving the component to another namespace cannot make this
    // test lie in either direction.
    const namespace = /useTranslation\(['"]([a-z0-9-]+)['"]\)/.exec(source)?.[1];
    expect(namespace, "no se pudo deducir el namespace de traducción").toBeTruthy();

    for (const [name, locale] of [
      ["en", en],
      ["es", es],
    ] as const) {
      const available = new Set(deepKeys(locale as Record<string, unknown>));
      for (const key of keys) {
        // A `t('x.y', { count })` call resolves to the plural family
        // `x.y_one` / `x.y_other`, which i18next expands internally — so the
        // literal name never exists as a key on its own. Accept either shape,
        // but only those two: a bare prefix match would let `x.yZzz` pass.
        const found =
          available.has(`${namespace}.${key}`) ||
          (available.has(`${namespace}.${key}_one`) && available.has(`${namespace}.${key}_other`));
        expect(found, `falta la clave ${namespace}.${key} en ${name}.json`).toBe(true);
      }
    }
  });

  it("switches the active language when the preference store changes", async () => {
    // The `es` bundle is now loaded on demand, so the store subscription fires
    // an async import + changeLanguage; yield a few ticks to let it settle.
    preferencesStore.getState().setLanguage("es");
    await new Promise((r) => setTimeout(r, 30));
    expect(i18n.language).toBe("es");

    preferencesStore.getState().setLanguage("en");
    await new Promise((r) => setTimeout(r, 30));
    expect(i18n.language).toBe("en");
  });
});
