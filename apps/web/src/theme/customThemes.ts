import type { CustomTheme } from '@cubeforge/state';
import {
  THEME_PRESETS,
  type ThemeColors,
  type ThemePreset,
} from './themePresets';

/**
 * Converts a user-created theme into a first-class preset so every consumer
 * (resolution, dropdown, studio grid, preview) treats customs and built-ins
 * identically. `customName` wins over the i18n label at render time.
 */
export function customThemeToPreset(custom: CustomTheme): ThemePreset {
  const colors = { ...(custom.colors as Partial<ThemeColors>) } as ThemeColors;
  return {
    id: custom.id,
    labelKey: 'appearance.customTheme',
    descriptionKey: 'appearance.customThemeDesc',
    isDark: custom.base === 'dark',
    colors,
    previewColors: {
      canvas: colors['--canvas'] ?? '#000000',
      surface: colors['--surface'] ?? '#000000',
      ink: colors['--ink'] ?? '#ffffff',
      accent: colors['--ready'] ?? colors['--ink'] ?? '#ffffff',
    },
    customName: custom.name,
  };
}

/** Built-ins followed by user customs (stable order: creation order). */
export function getAllPresets(customThemes: CustomTheme[]): ThemePreset[] {
  return [...THEME_PRESETS, ...customThemes.map(customThemeToPreset)];
}

export function findPreset(
  id: string,
  customThemes: CustomTheme[] = [],
): ThemePreset | undefined {
  if (!id || id === 'default') return undefined;
  return getAllPresets(customThemes).find((p) => p.id === id);
}
