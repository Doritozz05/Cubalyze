import { describe, it, expect, afterEach } from "vitest";
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
