/**
 * Settings sections are addressed by ID, not by index: `AppShell` opens the
 * dialog pre-selected to a section (the Profile editor asks for `profile`, the
 * Friends screen's "¿qué comparto?" shortcut asks for `privacy`). When such an
 * id stops existing, `SettingsDialog` silently falls back to `general`, so the
 * user lands on a screen that does not answer the question they clicked. This
 * pins the contract those two call sites depend on.
 */
import { describe, expect, it } from "vitest";
import { SETTINGS_SECTIONS, visibleSettingsSections } from "./settings.constants";

const ids = (hasAccount: boolean) => visibleSettingsSections(hasAccount).map((s) => s.id);

describe("settings sections", () => {
  it("exposes the ids the app opens by name", () => {
    expect(ids(true)).toContain("profile");
    expect(ids(true)).toContain("privacy");
  });

  it("never repeats an id (the sidebar, the index math and the content share this list)", () => {
    const all = SETTINGS_SECTIONS.map((s) => s.id);
    expect(new Set(all).size).toBe(all.length);
  });

  it("withholds exactly `privacy` without an account", () => {
    expect(ids(false)).not.toContain("privacy");
    expect(ids(false).length).toBe(SETTINGS_SECTIONS.length - 1);
    expect(ids(true).length).toBe(SETTINGS_SECTIONS.length);
  });
});
