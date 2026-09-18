import { describe, expect, it } from "vitest";
import { buildReportMailto } from "./reportContent";

describe("buildReportMailto", () => {
  it("assembles a mailto URL with encoded subject and body", () => {
    const url = buildReportMailto({
      to: "cubalyze@gmail.com",
      subject: "Content report: @someone",
      body: "Reported user: @someone (id abc)\nDate: 2026-09-18",
    });
    expect(url).toBe(
      "mailto:cubalyze@gmail.com?subject=Content%20report%3A%20%40someone&body=Reported%20user%3A%20%40someone%20(id%20abc)%0ADate%3A%202026-09-18",
    );
  });

  it("encodes accents and special characters", () => {
    const url = buildReportMailto({
      to: "cubalyze@gmail.com",
      subject: "Denuncia de contenido: @alguien",
      body: "Descripción: foto con símbolos raros & < >",
    });
    expect(url.startsWith("mailto:cubalyze@gmail.com?subject=")).toBe(true);
    expect(url).toContain(encodeURIComponent("Denuncia de contenido: @alguien"));
    expect(url).toContain(encodeURIComponent("Descripción: foto con símbolos raros & < >"));
    // Raw newlines/quotes must never leak into the URL.
    expect(url).not.toMatch(/\n|\r/);
  });
});
