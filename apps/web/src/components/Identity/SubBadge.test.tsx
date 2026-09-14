import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  SubBadge,
  SubBadgeOverflow,
  rollSubBadgeStyle,
  SUB_BADGE_PALETTE,
  SUB_BADGE_VARIANTS,
} from "./SubBadge";
import type { SubBadge as SubBadgeData } from "@/utils/subBadges";

const badge: SubBadgeData = {
  puzzle: "333",
  puzzleLabel: "3×3",
  seconds: 20,
  thresholdLabel: "20",
  mainPuzzle: true,
  averageMs: 19_500,
  windowSize: 100,
  solveCount: 120,
  currentMs: 20_400,
  nextSeconds: 17,
  nextThresholdLabel: "17",
};

describe("SubBadge — professional badge system", () => {
  it("ships 10 hardcoded solid colors", () => {
    expect(SUB_BADGE_PALETTE).toHaveLength(10);
    for (const c of SUB_BADGE_PALETTE) {
      expect(c.base).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(c.dark).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("ships 3 variants: solid, gradient, outline", () => {
    expect([...SUB_BADGE_VARIANTS].sort()).toEqual(
      ["gradient", "outline", "solid"].sort(),
    );
  });

  it("rolls a valid color + variant", () => {
    for (let i = 0; i < 50; i++) {
      const s = rollSubBadgeStyle();
      expect(s.colorIndex).toBeGreaterThanOrEqual(0);
      expect(s.colorIndex).toBeLessThan(10);
      expect(SUB_BADGE_VARIANTS).toContain(s.variant);
      expect(s.base).toBe(SUB_BADGE_PALETTE[s.colorIndex].base);
    }
  });

  it("is deterministic given a fixed random source", () => {
    const a = rollSubBadgeStyle(() => 0);
    const b = rollSubBadgeStyle(() => 0);
    expect(a).toEqual(b);
    expect(a.variant).toBe("solid");
    expect(a.colorIndex).toBe(0);
  });

  it("renders milestone + puzzle in every variant", () => {
    for (const variant of SUB_BADGE_VARIANTS) {
      const style = {
        colorIndex: 0,
        variant,
        base: SUB_BADGE_PALETTE[0].base,
        dark: SUB_BADGE_PALETTE[0].dark,
      };
      const html = renderToStaticMarkup(
        <SubBadge badge={badge} style={style} />,
      );
      expect(html).toContain("Sub 20");
      expect(html).toContain("3×3");
    }
  });

  it("solid uses flat background, gradient uses linear-gradient, outline is transparent", () => {
    const solid = renderToStaticMarkup(
      <SubBadge
        badge={badge}
        style={{ colorIndex: 0, variant: "solid", base: "#2563EB", dark: "#1E40AF" }}
      />,
    );
    expect(solid).toContain("background-color:#2563EB");

    const gradient = renderToStaticMarkup(
      <SubBadge
        badge={badge}
        style={{ colorIndex: 0, variant: "gradient", base: "#2563EB", dark: "#1E40AF" }}
      />,
    );
    expect(gradient).toContain("linear-gradient");

    const outline = renderToStaticMarkup(
      <SubBadge
        badge={badge}
        style={{ colorIndex: 0, variant: "outline", base: "#2563EB", dark: "#1E40AF" }}
      />,
    );
    expect(outline).toContain("transparent");
  });

  it("overflow chip shows +N with neutral style", () => {
    const html = renderToStaticMarkup(<SubBadgeOverflow count={3} />);
    expect(html).toContain("+3");
  });
});
