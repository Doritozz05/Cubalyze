'use client';

import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Download, Upload } from 'lucide-react';
import { MAX_CUSTOM_THEMES, preferencesStore } from '@cubalyze/state';
import { THEME_PRESETS, getSystemBaseTheme } from '@/theme/themePresets';
import { MONO_FONTS, SANS_FONTS } from '@/theme/fonts';
import { findPreset } from '@/theme/customThemes';
import { THEME_SHARE_APP, parseSharedTheme, themeFileSlug } from '@/theme/themeShare';

/**
 * Export / import of the current look, below the custom themes.
 *
 * Export snapshots preset (built-in by id, custom embedded) + live color
 * overrides + fonts + liquid options. Background media and uploaded font
 * files never travel. Import validates strictly, falls back unknown fonts
 * to defaults, and refuses when the custom library is full.
 */
export function ThemeShareSection() {
  const { t } = useTranslation('settings');
  const importRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const s = preferencesStore.getState();
    const preset = findPreset(s.themePreset, s.customThemes);
    const base =
      preset != null
        ? preset.isDark
          ? 'dark'
          : 'light'
        : s.theme === 'system'
          ? getSystemBaseTheme()
          : s.theme;
    const custom = s.customThemes.find((c) => c.id === s.themePreset);
    const label = custom?.name ?? preset?.id ?? base;
    const file = {
      version: 1 as const,
      app: THEME_SHARE_APP,
      exportedAt: Date.now(),
      preset:
        custom != null
          ? { kind: 'custom' as const, name: custom.name, base: custom.base, colors: custom.colors }
          : { kind: 'builtin' as const, id: preset?.id ?? base },
      overrides: s.customThemeColors,
      options: {
        fontSans: s.fontSans,
        fontMono: s.fontMono,
        zeroStyle: s.zeroStyle,
        liquidGlass: s.liquidGlass,
        liquidGlassOpacity: s.liquidGlassOpacity,
        liquidGlassBlur: s.liquidGlassBlur,
      },
    };
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cubalyze-theme-${themeFileSlug(label)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('appearance.themeExported'));
  };

  const handleImportFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const shared = parseSharedTheme(JSON.parse(await file.text()));
      if (!shared) {
        toast.error(t('appearance.themeImportError'));
        return;
      }
      const s = preferencesStore.getState();
      const ref = shared.preset;

      if (ref.kind === 'builtin') {
        const preset = findPreset(ref.id, s.customThemes);
        // Unknown ids (hand-edited or future presets) fail loudly instead
        // of silently landing on dark.
        const builtin = THEME_PRESETS.find((p) => p.id === ref.id);
        if (!preset || !builtin) {
          toast.error(t('appearance.themeImportUnknown'));
          return;
        }
        s.setThemePreset(preset.id);
        s.setTheme(preset.isDark ? 'dark' : 'light');
      } else {
        if (s.customThemes.length >= MAX_CUSTOM_THEMES) {
          toast.error(t('appearance.themeImportFull'));
          return;
        }
        const id = s.saveCustomTheme({
          name: ref.name,
          base: ref.base,
          colors: ref.colors,
        });
        if (!id) {
          toast.error(t('appearance.themeImportFull'));
          return;
        }
        s.setThemePreset(id);
        s.setTheme(ref.base);
      }

      if (shared.overrides && Object.keys(shared.overrides).length > 0) {
        s.setCustomThemeColors(shared.overrides);
      } else {
        s.resetCustomThemeColors();
      }

      // Fonts: unknown ids (uploaded on another device) fall back to defaults.
      const sansOk =
        SANS_FONTS.some((f) => f.id === shared.options.fontSans) ||
        s.customFonts.some((f) => f.id === shared.options.fontSans);
      const monoOk =
        MONO_FONTS.some((f) => f.id === shared.options.fontMono) ||
        s.customFonts.some((f) => f.id === shared.options.fontMono);
      s.setFontSans(sansOk ? shared.options.fontSans : 'open-sans');
      s.setFontMono(monoOk ? shared.options.fontMono : 'cascadia-code');
      s.setZeroStyle(shared.options.zeroStyle);
      s.setLiquidGlass(shared.options.liquidGlass);
      s.setLiquidGlassOpacity(Math.max(15, Math.min(95, Math.round(shared.options.liquidGlassOpacity))));
      s.setLiquidGlassBlur(
        shared.options.liquidGlassBlur == null
          ? null
          : Math.max(0, Math.min(64, Math.round(shared.options.liquidGlassBlur))),
      );
      toast.success(t('appearance.themeImported'));
    } catch {
      toast.error(t('appearance.themeImportError'));
    }
  };

  return (
    <div className="mt-5 flex flex-col gap-3">
      <div>
        <h4 className="text-sm font-semibold text-ink">{t('appearance.shareThemeTitle')}</h4>
        <p className="mt-0.5 text-xs text-ink-3">{t('appearance.shareThemeSubtitle')}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleExport}
          className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-xs font-medium text-ink transition-colors hover:bg-surface-2"
        >
          <Download className="size-3.5" />
          {t('appearance.exportTheme')}
        </button>
        <button
          type="button"
          onClick={() => importRef.current?.click()}
          className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-xs font-medium text-ink transition-colors hover:bg-surface-2"
        >
          <Upload className="size-3.5" />
          {t('appearance.importTheme')}
        </button>
        <input
          ref={importRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            void handleImportFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}
