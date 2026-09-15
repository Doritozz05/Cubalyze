import { describe, it, expect } from "vitest";
import { parseSharedTheme, themeFileSlug } from "../themeShare";

const validBuiltin = {
  version: 1,
  app: "cubalyze",
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

  it("still accepts a share file written before the rename (app: 'cubeforge')", () => {
    // Dual read: a theme exported by an older build lives on someone's disk and
    // cannot be rewritten by us, so the legacy tag stays readable forever.
    const parsed = parseSharedTheme({ ...validBuiltin, app: "cubeforge" });
    expect(parsed).not.toBeNull();
    expect(parsed?.preset).toEqual({ kind: "builtin", id: "nord" });
    // The parser normalises to the tag we write today.
    expect(parsed?.app).toBe("cubalyze");
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
    // Exact comparison: a re-cased or padded tag is a different format, not ours.
    expect(parseSharedTheme({ ...validBuiltin, app: "Cubalyze" })).toBeNull();
    expect(parseSharedTheme({ ...validBuiltin, app: " cubalyze " })).toBeNull();
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
