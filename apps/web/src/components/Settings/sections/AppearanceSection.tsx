'use client';

import { useStore } from 'zustand';
import { preferencesStore, type HeaderMode } from '@cubeforge/state';
import { SettingToggle } from '@/components/Settings/components/SettingToggle';
import { SettingRow } from '@/components/Settings/components/SettingRow';
import { CustomBackgroundSetting } from '@/components/Settings/components/CustomBackgroundSetting';
import { Palette, Sun, Moon, Monitor, LayoutGrid } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { dockEditStore } from '@/widgets/dock/dockEditStore';
import { useIsTouch } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import type { ParseKeys } from 'i18next';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';

/**
 * Appearance settings section.
 *
 * Contains visual preferences for the interface: theme, liquid glass, header
 * visibility, custom background and dock editing. The 3D cube skin selector
 * lives in the Smart Cube section.
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
  const liquidGlass = useStore(preferencesStore, (s) => s.liquidGlass);
  const setLiquidGlass = useStore(preferencesStore, (s) => s.setLiquidGlass);
  const liquidGlassOpacity = useStore(preferencesStore, (s) => s.liquidGlassOpacity ?? 90);
  const setLiquidGlassOpacity = useStore(preferencesStore, (s) => s.setLiquidGlassOpacity);
  const headerMode = useStore(preferencesStore, (s) => s.headerMode);
  const setHeaderMode = useStore(preferencesStore, (s) => s.setHeaderMode);
  const isTouch = useIsTouch();

  return (
    <div className="flex flex-col gap-5">
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
          <Select value={theme} onValueChange={setTheme}>
            <SelectTrigger className="w-40 max-lg:w-full">
              <SelectValue placeholder={t('appearance.selectTheme')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system">
                <div className="flex items-center gap-2">
                  <Monitor className="size-3.5" />
                  <span>{t('appearance.system')}</span>
                </div>
              </SelectItem>
              <SelectItem value="dark">
                <div className="flex items-center gap-2">
                  <Moon className="size-3.5" />
                  <span>{t('appearance.dark')}</span>
                </div>
              </SelectItem>
              <SelectItem value="light">
                <div className="flex items-center gap-2">
                  <Sun className="size-3.5" />
                  <span>{t('appearance.light')}</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        }
      />

      {/* Liquid Glass UI Panels (Theme visual effect) */}
      <div className="flex flex-col gap-3.5 rounded-xl border border-line bg-surface p-5 transition-shadow duration-200 hover:shadow-sm">
        <div className="flex items-center justify-between gap-6">
          <div className="min-w-0 flex-1">
            <h4 className="text-[0.85rem] font-medium leading-5 text-ink">
              {t('appearance.liquidGlass')}
            </h4>
            <p className="mt-1.5 text-[0.78rem] leading-5 text-ink-3">
              {t('appearance.liquidGlassHint')}
            </p>
          </div>
          <div className="flex shrink-0 items-center">
            <Switch
              checked={liquidGlass}
              onCheckedChange={setLiquidGlass}
              aria-label={t('appearance.liquidGlass')}
            />
          </div>
        </div>

        {liquidGlass && (
          <div className="mt-1 flex flex-col gap-2.5 rounded-lg border border-line/60 bg-surface-2/40 p-3.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-ink">
                {t('appearance.liquidGlassOpacity')}
              </span>
              <span className="font-mono text-xs font-semibold text-ink">
                {liquidGlassOpacity}%
              </span>
            </div>
            <Slider
              value={[liquidGlassOpacity]}
              onValueChange={([val]) => setLiquidGlassOpacity(val)}
              min={15}
              max={95}
              step={5}
              className="w-full"
            />
            <p className="text-[0.7rem] text-ink-3">
              {t('appearance.liquidGlassOpacityHint')}
            </p>
          </div>
        )}
      </div>

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
        <div className="group flex items-start justify-between gap-6 rounded-xl border border-line bg-surface p-5 transition-shadow duration-200 hover:shadow-sm">
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

      {/* Custom Background Image */}
      <CustomBackgroundSetting />

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
