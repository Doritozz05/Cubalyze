import { describe, it, expect } from "vitest";
import { parseSharedTheme, themeFileSlug } from "../themeShare";

const validBuiltin = {
  version: 1,
  app: "cubeforge",
  exportedAt: 123,
  preset: { kind: "builtin", id: "nord" },
  overrides: { "--ready": "#ff0000" },
  options: {
    fontSans: "open-sans",
    fontMono: "cascadia-code",
    zeroStyle: "slashed",
    liquidGlass: true,
    liquidGlassOpacity: 65,
    liquidGlassBlur: null,
  },
};

describe("parseSharedTheme", () => {
  it("accepts a valid built-in share file", () => {
    const parsed = parseSharedTheme(validBuiltin);
    expect(parsed?.preset).toEqual({ kind: "builtin", id: "nord" });
    expect(parsed?.overrides).toEqual({ "--ready": "#ff0000" });
  });

  it("accepts a valid custom share file and trims the name", () => {
    const parsed = parseSharedTheme({
      ...validBuiltin,
      preset: {
        kind: "custom",
        name: "  Mi Nord  ",
        base: "dark",
        colors: { "--canvas": "#111111" },
      },
      overrides: null,
    });
    expect(parsed?.preset).toEqual({
      kind: "custom",
      name: "Mi Nord",
      base: "dark",
      colors: { "--canvas": "#111111" },
    });
  });

  it("rejects wrong version, app, or malformed preset", () => {
    expect(parseSharedTheme({ ...validBuiltin, version: 2 })).toBeNull();
    expect(parseSharedTheme({ ...validBuiltin, app: "other" })).toBeNull();
    expect(parseSharedTheme({ ...validBuiltin, preset: { kind: "builtin", id: "" } })).toBeNull();
    expect(parseSharedTheme({ ...validBuiltin, preset: { kind: "custom" } })).toBeNull();
    expect(parseSharedTheme(null)).toBeNull();
    expect(parseSharedTheme("nope")).toBeNull();
  });

  it("rejects non-token color maps and bad options", () => {
    expect(
      parseSharedTheme({ ...validBuiltin, overrides: { ready: "#ff0000" } }),
    ).toBeNull();
    expect(
      parseSharedTheme({
        ...validBuiltin,
        options: { ...validBuiltin.options, zeroStyle: "weird" },
      }),
    ).toBeNull();
    expect(
      parseSharedTheme({
        ...validBuiltin,
        options: { ...validBuiltin.options, liquidGlassOpacity: NaN },
      }),
    ).toBeNull();
  });
});

describe("themeFileSlug", () => {
  it("slugifies labels and falls back", () => {
    expect(themeFileSlug("Rosé Pine")).toBe("rose-pine");
    expect(themeFileSlug("  Mi Tema 1 ")).toBe("mi-tema-1");
    expect(themeFileSlug("!!!")).toBe("theme");
  });
});
