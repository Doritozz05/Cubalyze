'use client';

import { useState } from 'react';
import { useStore } from 'zustand';
import { useTranslation } from 'react-i18next';
import { preferencesStore } from '@cubeforge/state';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
  Palette,
  Sliders,
  Droplets,
  Image as ImageIcon,
  RotateCcw,
  X,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { THEME_PRESETS, resolveThemeColors } from '@/theme/themePresets';
import { ScaledTimerPreview } from './ScaledTimerPreview';
import { ThemeColorSection } from './ThemeColorSection';
import { CustomBackgroundSetting } from '@/components/Settings/components/CustomBackgroundSetting';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';

export interface ThemeStudioModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type StudioTab = 'presets' | 'colors' | 'liquid' | 'background' | 'reset';

export function ThemeStudioModal({ open, onOpenChange }: ThemeStudioModalProps) {
  const { t } = useTranslation('settings');
  const [activeTab, setActiveTab] = useState<StudioTab>('presets');

  // Preferences Store
  const storeTheme = useStore(preferencesStore, (s) => s.theme);
  const themePreset = useStore(preferencesStore, (s) => s.themePreset ?? 'default');
  const setThemePreset = useStore(preferencesStore, (s) => s.setThemePreset);
  const customThemeColors = useStore(preferencesStore, (s) => s.customThemeColors);
  const setCustomThemeColor = useStore(preferencesStore, (s) => s.setCustomThemeColor);
  const resetCustomThemeColors = useStore(preferencesStore, (s) => s.resetCustomThemeColors);

  const liquidGlass = useStore(preferencesStore, (s) => s.liquidGlass);
  const setLiquidGlass = useStore(preferencesStore, (s) => s.setLiquidGlass);
  const liquidGlassOpacity = useStore(preferencesStore, (s) => s.liquidGlassOpacity ?? 65);
  const setLiquidGlassOpacity = useStore(preferencesStore, (s) => s.setLiquidGlassOpacity);

  // Computed active colors
  const resolvedColors = resolveThemeColors(themePreset, storeTheme, customThemeColors);

  const tabs = [
    { id: 'presets' as const, label: t('appearance.tabs.presets'), icon: Palette },
    { id: 'colors' as const, label: t('appearance.tabs.colors'), icon: Sliders },
    { id: 'liquid' as const, label: t('appearance.tabs.liquid'), icon: Droplets },
    { id: 'background' as const, label: t('appearance.tabs.background'), icon: ImageIcon },
    { id: 'reset' as const, label: t('appearance.tabs.reset'), icon: RotateCcw },
  ];

  const handleSelectPreset = (presetId: string) => {
    setThemePreset(presetId);
    if (presetId === 'light') {
      preferencesStore.getState().setTheme('light');
    } else {
      preferencesStore.getState().setTheme('dark');
    }
    // Clearing custom overrides when choosing an explicit preset ensures clean preset application
    resetCustomThemeColors();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 flex w-[96vw] sm:max-w-[96vw] lg:max-w-7xl h-[92vh] max-h-[92vh] flex-col overflow-hidden rounded-2xl border border-line bg-surface p-0 shadow-2xl transition-all duration-200"
      >
        <DialogTitle className="sr-only">
          {t('appearance.themeStudioTitle')}
        </DialogTitle>

        {/* Modal Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-line bg-surface px-5 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg border border-line bg-surface-2 text-ink">
              <Palette className="size-4 text-ink" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-ink">
                {t('appearance.themeStudioTitle')}
              </h3>
              <p className="text-[0.72rem] text-ink-3">
                {t('appearance.themeStudioSubtitle')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex size-8 items-center justify-center rounded-lg border border-line bg-surface-2 text-ink-3 transition-colors hover:bg-surface hover:text-ink"
            aria-label={t('appearance.close')}
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Studio Workspace Layout */}
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row overflow-hidden">
          {/* Left Column: Live Scaled Timer Preview */}
          <div className="flex min-h-65 flex-1 flex-col border-b border-line p-3 lg:border-b-0 lg:border-r lg:p-5 overflow-hidden">
            <ScaledTimerPreview />
          </div>

          {/* Right Column: Settings Panel */}
          <div className="flex h-full min-h-0 w-full flex-col lg:w-120 shrink-0 bg-surface">
            {/* Tabs Navigation */}
            <div className="flex shrink-0 border-b border-line bg-surface-2/40 px-3 py-2 overflow-x-auto gap-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors',
                      active
                        ? 'bg-surface text-ink shadow-xs font-semibold'
                        : 'text-ink-3 hover:text-ink hover:bg-surface/50'
                    )}
                  >
                    <Icon className="size-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Scrollable Tab Content */}
            <div className="flex-1 overflow-y-auto p-5">
              {/* Tab 1: Presets */}
              {activeTab === 'presets' && (
                <div className="flex flex-col gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-ink">
                      {t('appearance.presetsTitle')}
                    </h4>
                    <p className="mt-0.5 text-xs text-ink-3">
                      {t('appearance.presetsSubtitle')}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 mt-2">
                    {THEME_PRESETS.map((preset) => {
                      const isSelected = themePreset === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => handleSelectPreset(preset.id)}
                          className={cn(
                            'group relative flex flex-col gap-2 rounded-xl border p-3.5 text-left transition-all duration-150',
                            isSelected
                              ? 'border-ink bg-surface-2 ring-2 ring-ink/20 shadow-sm'
                              : 'border-line bg-surface hover:border-ink/20 hover:bg-surface-2/50'
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-ink">
                              {t(preset.labelKey, preset.id)}
                            </span>
                            {isSelected && (
                              <span className="flex size-4 items-center justify-center rounded-full bg-ink text-surface">
                                <Check className="size-2.5 stroke-3" />
                              </span>
                            )}
                          </div>

                          <p className="text-[0.68rem] text-ink-3 leading-snug line-clamp-2">
                            {t(preset.descriptionKey, '')}
                          </p>

                          {/* Color Swatch Dots */}
                          <div className="mt-1 flex items-center gap-1.5 rounded-lg border border-line/60 bg-surface/60 p-1.5">
                            <div
                              className="size-4.5 rounded-full border border-black/10 shadow-xs"
                              style={{ backgroundColor: preset.previewColors.canvas }}
                              title={t('appearance.colors.canvas')}
                            />
                            <div
                              className="size-4.5 rounded-full border border-black/10 shadow-xs"
                              style={{ backgroundColor: preset.previewColors.surface }}
                              title={t('appearance.colors.surface')}
                            />
                            <div
                              className="size-4.5 rounded-full border border-black/10 shadow-xs"
                              style={{ backgroundColor: preset.previewColors.ink }}
                              title={t('appearance.colors.ink')}
                            />
                            <div
                              className="size-4.5 rounded-full border border-black/10 shadow-xs ml-auto"
                              style={{ backgroundColor: preset.previewColors.accent }}
                              title={t('appearance.colors.ready')}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tab 2: Custom Colors */}
              {activeTab === 'colors' && (
                <ThemeColorSection
                  currentColors={resolvedColors}
                  onColorChange={(token, color) => {
                    setCustomThemeColor(token, color);
                  }}
                  onResetColors={resetCustomThemeColors}
                  hasCustomOverrides={!!customThemeColors && Object.keys(customThemeColors).length > 0}
                />
              )}

              {/* Tab 3: Liquid Glass */}
              {activeTab === 'liquid' && (
                <div className="flex flex-col gap-4">
                  <div>
                    <h4 className="text-sm font-semibold text-ink">
                      {t('appearance.liquidGlass')}
                    </h4>
                    <p className="mt-0.5 text-xs text-ink-3">
                      {t('appearance.liquidGlassHint')}
                    </p>
                  </div>

                  <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-ink">
                        {t('appearance.liquidGlassEnabled')}
                      </span>
                      <Switch checked={liquidGlass} onCheckedChange={setLiquidGlass} />
                    </div>

                    {liquidGlass && (
                      <div className="flex flex-col gap-3 border-t border-line pt-4">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-ink">
                            {t('appearance.liquidGlassOpacity')}
                          </span>
                          <span className="font-mono font-semibold text-ink">
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
                </div>
              )}

              {/* Tab 4: Background Media */}
              {activeTab === 'background' && (
                <div className="flex flex-col gap-4">
                  <CustomBackgroundSetting />
                </div>
              )}

              {/* Tab 5: Reset Options */}
              {activeTab === 'reset' && (
                <div className="flex flex-col gap-4">
                  <div>
                    <h4 className="text-sm font-semibold text-ink">
                      {t('appearance.resetTitle')}
                    </h4>
                    <p className="mt-0.5 text-xs text-ink-3">
                      {t('appearance.resetSubtitle')}
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="text-xs font-semibold text-ink">
                          {t('appearance.resetColorsOnly')}
                        </h5>
                        <p className="text-[0.72rem] text-ink-3">
                          {t('appearance.resetColorsOnlyDesc')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={resetCustomThemeColors}
                        className="rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-surface hover:text-dnf"
                      >
                        {t('appearance.tabs.reset')}
                      </button>
                    </div>

                    <div className="border-t border-line pt-3 flex items-center justify-between">
                      <div>
                        <h5 className="text-xs font-semibold text-ink">
                          {t('appearance.resetAllVisual')}
                        </h5>
                        <p className="text-[0.72rem] text-ink-3">
                          {t('appearance.resetAllVisualDesc')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setThemePreset('dark');
                          preferencesStore.getState().setTheme('dark');
                          resetCustomThemeColors();
                          setLiquidGlass(false);
                          setLiquidGlassOpacity(65);
                        }}
                        className="rounded-lg bg-dnf px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-dnf/90"
                      >
                        {t('appearance.resetAll')}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
