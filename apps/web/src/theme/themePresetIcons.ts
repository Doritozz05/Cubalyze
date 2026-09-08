import {
  Moon,
  MoonStar,
  Sun,
  Snowflake,
  Zap,
  TreePine,
  Sunset,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

/** Professional per-preset icon (lucide-react, zero new deps). */
export const THEME_PRESET_ICONS: Record<string, LucideIcon> = {
  dark: Moon,
  light: Sun,
  midnight: MoonStar,
  nord: Snowflake,
  cyberpunk: Zap,
  forest: TreePine,
  sunset: Sunset,
  "tokyo-night": Sparkles,
};

export function getPresetIcon(id: string): LucideIcon {
  return THEME_PRESET_ICONS[id] ?? Sparkles;
}
