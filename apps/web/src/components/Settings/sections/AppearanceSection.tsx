'use client';

import { useStore } from 'zustand';
import { preferencesStore, type HeaderMode } from '@cubeforge/state';
import { SettingToggle } from '@/components/Settings/components/SettingToggle';
import { SettingRow } from '@/components/Settings/components/SettingRow';
import { useState } from 'react';
import { Palette, Monitor, LayoutGrid, Sliders } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { dockEditStore } from '@/widgets/dock/dockEditStore';
import { useIsTouch } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import type { ParseKeys } from 'i18next';
import { ThemeStudioModal } from '@/components/Settings/theme-studio/ThemeStudioModal';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { THEME_PRESETS } from '@/theme/themePresets';

/**
 * Appearance settings section.
 *
 * Contains visual preferences for the interface: theme, header
 * visibility and dock editing. Themes, colors, liquid glass and custom
 * background now live in the Theme Studio with a live scaled timer preview.
 */
const HEADER_MODES: HeaderMode[] = ['always', 'hidden', 'autohide'];

const HEADER_MODE_LABEL_KEY: Record<HeaderMode, ParseKeys<'settings'>> = {
  always: 'appearance.headerModeAlways',
  hidden: 'appearance.headerModeHidden',
  autohide: 'appearance.headerModeAutohide',
};

export function AppearanceSection() {
  const { t } = useTranslation('settings');
  const theme = useStore(preferencesStore, (s) => s.theme);
  const setTheme = useStore(preferencesStore, (s) => s.setTheme);
  const themePreset = useStore(preferencesStore, (s) => s.themePreset ?? 'default');
  const setThemePreset = useStore(preferencesStore, (s) => s.setThemePreset);
  // Selector mirrors the full Theme Studio catalog: system follows the OS
  // (classic light/dark), any other value is the active preset id.
  const selectorValue =
    theme === 'system' ? 'system' : themePreset === 'default' ? theme : themePreset;

  const handleSelectThemeValue = (value: string) => {
    if (value === 'system') {
      setThemePreset('default');
      setTheme('system');
      return;
    }
    const preset = THEME_PRESETS.find((p) => p.id === value);
    if (!preset) return;
    setThemePreset(preset.id);
    setTheme(preset.isDark ? 'dark' : 'light');
  };
  const headerMode = useStore(preferencesStore, (s) => s.headerMode);
  const setHeaderMode = useStore(preferencesStore, (s) => s.setHeaderMode);
  const isTouch = useIsTouch();
  const [themeStudioOpen, setThemeStudioOpen] = useState(false);

  return (
    <div className="flex flex-col gap-5">
      {/* Theme Studio Banner Card */}
      <div className="relative overflow-hidden rounded-xl border border-line bg-surface p-5 transition-all hover:border-ink/20 hover:shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-line bg-surface-2 text-ink shadow-xs">
              <Sliders className="size-5 text-ink" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-ink">
                  {t('appearance.themeStudioBannerTitle')}
                </h4>
                <span className="rounded-md border border-line bg-surface-2 px-2 py-0.5 text-[0.65rem] font-medium text-ink-2">
                  {t('appearance.themeStudioBadge')}
                </span>
              </div>
              <p className="mt-1 text-xs text-ink-3 leading-relaxed">
                {t('appearance.themeStudioBannerDesc')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setThemeStudioOpen(true)}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-xs font-semibold text-surface transition-all hover:bg-ink/90 active:scale-95 shadow-xs"
          >
            <Palette className="size-3.5" />
            <span>{t('appearance.openThemeStudio')}</span>
          </button>
        </div>
      </div>

      <ThemeStudioModal open={themeStudioOpen} onOpenChange={setThemeStudioOpen} />

      <div className="flex items-center gap-3 rounded-xl border border-line/40 bg-surface-2/50 p-4">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-surface">
          <Palette className="size-4 text-ink-2" />
        </div>
        <p className="text-[0.82rem] text-ink-2">{t('appearance.header')}</p>
      </div>

      {/* Theme selector */}
      <SettingRow
        title={t('appearance.theme')}
        description={t('appearance.themeHint')}
        control={
          <Select value={selectorValue} onValueChange={handleSelectThemeValue}>
            <SelectTrigger className="w-44 max-lg:w-full">
              <SelectValue placeholder={t('appearance.selectTheme')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system">
                <div className="flex items-center gap-2">
                  <Monitor className="size-3.5" />
                  <span>{t('appearance.system')}</span>
                </div>
              </SelectItem>
              {THEME_PRESETS.map((preset) => (
                <SelectItem key={preset.id} value={preset.id}>
                  <div className="flex items-center gap-2">
                    <span
                      className="size-3.5 shrink-0 rounded-full border border-black/15"
                      style={{ backgroundColor: preset.previewColors.accent }}
                      aria-hidden="true"
                    />
                    <span>{t(preset.labelKey, preset.id)}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {/* Header visibility — mobile keeps the simple on/off toggle; desktop
          gets the tri-state selector (always visible / hidden / auto-hide). */}
      {isTouch ? (
        <SettingToggle
          title={t('appearance.showHeader')}
          description={t('appearance.showHeaderHint')}
          checked={headerMode !== 'hidden'}
          onCheckedChange={(show) => setHeaderMode(show ? 'always' : 'hidden')}
        />
      ) : (
        <div className="group flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 sm:gap-6 rounded-xl border border-line bg-surface p-5 transition-shadow duration-200 hover:shadow-sm">
          <div className="min-w-0 flex-1">
            <h4 className="text-[0.85rem] font-medium text-ink">{t('appearance.headerMode')}</h4>
            <p className="mt-1.5 text-[0.78rem] leading-relaxed text-ink-3">
              {t('appearance.headerModeHint')}
            </p>
          </div>
          <div className="mt-0.5 flex shrink-0 rounded-full border border-line bg-surface-2 p-0.5">
            {HEADER_MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setHeaderMode(mode)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                  headerMode === mode
                    ? 'bg-ink text-canvas shadow-sm'
                    : 'text-ink-2 hover:text-ink',
                )}
              >
                {t(HEADER_MODE_LABEL_KEY[mode])}
              </button>
            ))}
          </div>
        </div>
      )}


      {/* Edit dock */}
      <button
        onClick={() => {
          dockEditStore.startEditing();
        }}
        className="group flex items-center gap-4 rounded-xl border border-line bg-surface p-5 text-left transition-shadow duration-200 hover:shadow-sm"
      >
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-2">
          <LayoutGrid className="size-4 text-ink-2" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-[0.85rem] font-medium text-ink">{t('appearance.editDock')}</h4>
          <p className="mt-1.5 text-[0.78rem] leading-relaxed text-ink-3">
            {t('appearance.editDockHint')}
          </p>
        </div>
      </button>

    </div>
  );
}
