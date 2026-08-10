import { describe, it, expect, afterEach } from "vitest";
import i18n, {
  SUPPORTED_LANGUAGES,
  detectBrowserLanguage,
  resolveLanguage,
} from "./index";
import { preferencesStore } from "@cubeforge/state";

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

  it("switches the active language when the preference store changes", async () => {
    preferencesStore.getState().setLanguage("es");
    await Promise.resolve(); // changeLanguage is async even with bundled resources
    expect(i18n.language).toBe("es");

    preferencesStore.getState().setLanguage("en");
    await Promise.resolve();
    expect(i18n.language).toBe("en");
  });
});
