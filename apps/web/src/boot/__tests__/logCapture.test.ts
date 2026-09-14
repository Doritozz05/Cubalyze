import { describe, it, expect } from "vitest";
import { safeString } from "../logCapture";

describe("safeString", () => {
  it("renders plain Errors with name, message and stack", () => {
    const err = new Error("boom");
    const text = safeString(err);
    expect(text).toContain("Error: boom");
  });

  it("renders cross-realm Error-likes (message non-enumerable, instanceof fails)", () => {
    // What a worker/Comlink error round-trip looks like on the main thread:
    // same fields, wrong prototype, non-enumerable — JSON.stringify gives "{}".
    const crossRealm = Object.create(null);
    Object.defineProperties(crossRealm, {
      name: { value: "SQLite3Error", enumerable: false },
      message: {
        value:
          "SQLITE_CONSTRAINT_PRIMARYKEY: UNIQUE constraint failed: app_meta.key",
        enumerable: false,
      },
    });
    expect(JSON.stringify(crossRealm)).toBe("{}");
    const text = safeString(crossRealm);
    expect(text).toContain("SQLite3Error");
    expect(text).toContain("app_meta.key");
  });

  it("still renders strings and plain objects", () => {
    expect(safeString("hello")).toBe("hello");
    expect(safeString({ a: 1 })).toBe('{"a":1}');
  });
});
