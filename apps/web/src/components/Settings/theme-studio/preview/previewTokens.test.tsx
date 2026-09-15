/**
 * Custom themes must resolve exactly like built-in presets everywhere the
 * preview (and the app) looks colors up: adaptor shape, preset lookup and
 * full color resolution with overrides.
 */
import { describe, expect, it } from 'vitest';
import type { CustomTheme } from '@cubalyze/state';
import { DEFAULT_DARK_COLORS, resolveThemeColors } from '@/theme/themePresets';
import {
  customThemeToPreset,
  findPreset,
  getAllPresets,
} from '@/theme/customThemes';

const CUSTOM: CustomTheme = {
  id: 'custom-abc123',
  name: 'Mi tema',
  base: 'dark',
  colors: { ...DEFAULT_DARK_COLORS, '--canvas': '#123456' },
  createdAt: 1,
};

describe('customThemeToPreset', () => {
  it('exposes a first-class preset view of the custom theme', () => {
    const preset = customThemeToPreset(CUSTOM);
    expect(preset.id).toBe('custom-abc123');
    expect(preset.customName).toBe('Mi tema');
    expect(preset.isDark).toBe(true);
    expect(preset.colors['--canvas']).toBe('#123456');
    expect(preset.previewColors.canvas).toBe('#123456');
    expect(preset.previewColors.surface).toBe(DEFAULT_DARK_COLORS['--surface']);
  });

  it('derives lightness from the base', () => {
    const light = customThemeToPreset({ ...CUSTOM, base: 'light' });
    expect(light.isDark).toBe(false);
  });
});

describe('findPreset', () => {
  it('finds built-ins, customs, and nothing for default/unknown', () => {
    expect(findPreset('dark', [CUSTOM])?.id).toBe('dark');
    expect(findPreset('custom-abc123', [CUSTOM])?.customName).toBe('Mi tema');
    expect(findPreset('default', [CUSTOM])).toBeUndefined();
    expect(findPreset('nope', [CUSTOM])).toBeUndefined();
  });

  it('lists built-ins before customs', () => {
    const all = getAllPresets([CUSTOM]);
    expect(all[all.length - 1].id).toBe('custom-abc123');
  });
});

describe('resolveThemeColors with customs', () => {
  it('resolves a custom id to its snapshot', () => {
    const resolved = resolveThemeColors('custom-abc123', 'dark', null, [CUSTOM]);
    expect(resolved['--canvas']).toBe('#123456');
    expect(resolved['--surface']).toBe(DEFAULT_DARK_COLORS['--surface']);
  });

  it('applies live overrides on top of the custom snapshot', () => {
    const resolved = resolveThemeColors(
      'custom-abc123',
      'dark',
      { '--ink': '#ffffff' },
      [CUSTOM],
    );
    expect(resolved['--ink']).toBe('#ffffff');
    expect(resolved['--canvas']).toBe('#123456');
  });

  it('falls back to dark for unknown ids', () => {
    expect(resolveThemeColors('nope', 'light', null, [CUSTOM])['--canvas']).toBe(
      '#14171b',
    );
  });
});
