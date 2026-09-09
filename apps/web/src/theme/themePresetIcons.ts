import {
  Cat,
  Coffee,
  Flower2,
  Moon,
  MoonStar,
  Snowflake,
  Sun,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

/** Professional per-preset icon (lucide-react, zero new deps). */
export const THEME_PRESET_ICONS: Record<string, LucideIcon> = {
  dark: Moon,
  light: Sun,
  midnight: MoonStar,
  "catppuccin-mocha": Cat,
  "rose-pine": Flower2,
  nord: Snowflake,
  "catppuccin-latte": Coffee,
};

export function getPresetIcon(id: string): LucideIcon {
  return THEME_PRESET_ICONS[id] ?? Sparkles;
}
