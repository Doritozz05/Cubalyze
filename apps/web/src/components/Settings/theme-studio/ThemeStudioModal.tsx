'use client';

import { useState, useRef } from 'react';
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
  Type,
  X,
  Check,
  Eye,
  Settings2,
  Plus,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { THEME_PRESETS, resolveThemeColors } from '@/theme/themePresets';
import { MONO_FONTS, SANS_FONTS, slashedZeroFeature } from '@/theme/fonts';
import { MAX_CUSTOM_FONTS } from '@cubeforge/state';
import {
  customFontFamily,
  deleteFontBlob,
  saveFontBlob,
  validateFontFile,
} from '@/theme/customFonts';
import { findPreset } from '@/theme/customThemes';
import { getPresetIcon } from '@/theme/themePresetIcons';
import { useBackgroundMediaStore } from '@/stores/backgroundMediaStore';
import { ScaledTimerPreview } from './ScaledTimerPreview';
import { ThemeColorSection } from './ThemeColorSection';
import { CustomThemesSection } from './CustomThemesSection';
import { ThemeShareSection } from './ThemeShareSection';
import { PresetDots } from './PresetDots';
import { isColorPickerOpen } from '@/components/Settings/components/ColorPicker';
import { CustomBackgroundSetting } from '@/components/Settings/components/CustomBackgroundSetting';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';

export interface ThemeStudioModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type StudioTab = 'presets' | 'colors' | 'typography' | 'liquid' | 'background' | 'reset';

export function ThemeStudioModal({ open, onOpenChange }: ThemeStudioModalProps) {
  const { t } = useTranslation('settings');
  const [activeTab, setActiveTab] = useState<StudioTab>('presets');
  // Mobile (<lg): preview and controls compete for 92dvh — show one at a
  // time instead of stacking both into an unreadable squeeze.
  const [mobileView, setMobileView] = useState<'preview' | 'customize'>('preview');
  const tabsRef = useRef<HTMLDivElement>(null);

  const handleTabKeyDown = (e: React.KeyboardEvent) => {
    const order: StudioTab[] = ['presets', 'colors', 'typography', 'liquid', 'background', 'reset'];
    const idx = order.indexOf(activeTab);
    let next: number | null = null;
    if (e.key === 'ArrowRight') next = (idx + 1) % order.length;
    else if (e.key === 'ArrowLeft') next = (idx - 1 + order.length) % order.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = order.length - 1;
    if (next !== null) {
      e.preventDefault();
      const id = order[next] as StudioTab;
      setActiveTab(id);
      tabsRef.current
        ?.querySelector<HTMLButtonElement>(`[data-tab-id="${id}"]`)
        ?.focus();
    }
  };

  // Preferences Store
  const storeTheme = useStore(preferencesStore, (s) => s.theme);
  const themePreset = useStore(preferencesStore, (s) => s.themePreset ?? 'default');
  const setThemePreset = useStore(preferencesStore, (s) => s.setThemePreset);
  const customThemeColors = useStore(preferencesStore, (s) => s.customThemeColors);
  const setCustomThemeColor = useStore(preferencesStore, (s) => s.setCustomThemeColor);
  const resetCustomThemeColors = useStore(preferencesStore, (s) => s.resetCustomThemeColors);
  const customThemes = useStore(preferencesStore, (s) => s.customThemes);

  const liquidGlass = useStore(preferencesStore, (s) => s.liquidGlass);
  const setLiquidGlass = useStore(preferencesStore, (s) => s.setLiquidGlass);
  const liquidGlassOpacity = useStore(preferencesStore, (s) => s.liquidGlassOpacity ?? 65);
  const setLiquidGlassOpacity = useStore(preferencesStore, (s) => s.setLiquidGlassOpacity);
  const liquidGlassBlur = useStore(preferencesStore, (s) => s.liquidGlassBlur ?? null);
  const setLiquidGlassBlur = useStore(preferencesStore, (s) => s.setLiquidGlassBlur);
  const fontSans = useStore(preferencesStore, (s) => s.fontSans ?? 'open-sans');
  const setFontSans = useStore(preferencesStore, (s) => s.setFontSans);
  const fontMono = useStore(preferencesStore, (s) => s.fontMono ?? 'cascadia-code');
  const setFontMono = useStore(preferencesStore, (s) => s.setFontMono);
  const zeroStyle = useStore(preferencesStore, (s) => s.zeroStyle ?? 'slashed');
  const setZeroStyle = useStore(preferencesStore, (s) => s.setZeroStyle);
  const customFonts = useStore(preferencesStore, (s) => s.customFonts);
  const [uploadingFont, setUploadingFont] = useState(false);
  const sansUploadRef = useRef<HTMLInputElement>(null);
  const monoUploadRef = useRef<HTMLInputElement>(null);

  const customSansFonts = customFonts.filter((f) => f.role === 'sans');
  const customMonoFonts = customFonts.filter((f) => f.role === 'mono');
  const canUploadMore = customFonts.length < MAX_CUSTOM_FONTS;

  const handleFontUpload = async (role: 'sans' | 'mono', file: File | undefined) => {
    if (!file || uploadingFont) return;
    if (!canUploadMore) {
      toast.error(t('appearance.fontUploadCap'));
      return;
    }
    setUploadingFont(true);
    try {
      const { mimeType } = await validateFontFile(file);
      const id = preferencesStore.getState().addCustomFont({
        name: file.name.replace(/\.[^.]+$/, ''),
        role,
      });
      if (!id) {
        toast.error(t('appearance.fontUploadCap'));
        return;
      }
      await saveFontBlob(id, file, mimeType);
      if (role === 'sans') setFontSans(id);
      else setFontMono(id);
    } catch {
      toast.error(t('appearance.fontUploadError'));
    } finally {
      setUploadingFont(false);
    }
  };

  const handleDeleteFont = (id: string) => {
    void deleteFontBlob(id);
    preferencesStore.getState().removeCustomFont(id);
    if (fontSans === id) setFontSans('open-sans');
    if (fontMono === id) setFontMono('cascadia-code');
  };

  // Computed active colors
  const resolvedColors = resolveThemeColors(themePreset, storeTheme, customThemeColors, customThemes);

  const tabs = [
    { id: 'presets' as const, label: t('appearance.tabs.presets'), icon: Palette },
    { id: 'colors' as const, label: t('appearance.tabs.colors'), icon: Sliders },
    { id: 'typography' as const, label: t('appearance.tabs.typography'), icon: Type },
    { id: 'liquid' as const, label: t('appearance.tabs.liquid'), icon: Droplets },
    { id: 'background' as const, label: t('appearance.tabs.background'), icon: ImageIcon },
    { id: 'reset' as const, label: t('appearance.tabs.reset'), icon: RotateCcw },
  ];

  const handleSelectPreset = (presetId: string) => {
    const preset = findPreset(presetId, customThemes);
    // Unknown ids (e.g. legacy 'default') follow the explicit light/dark mode.
    const isDark = preset ? preset.isDark : presetId !== 'light';
    setThemePreset(presetId);
    preferencesStore.getState().setTheme(isDark ? 'dark' : 'light');
    // Clearing custom overrides when choosing an explicit preset ensures clean preset application
    resetCustomThemeColors();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        // A color picker popover closes itself on Escape; keep the studio
        // open underneath it.
        onEscapeKeyDown={(e) => {
          if (isColorPickerOpen()) e.preventDefault();
        }}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 flex w-[96vw] sm:max-w-[96vw] lg:max-w-7xl h-[92dvh] max-h-[92dvh] flex-col gap-0 overflow-hidden rounded-2xl border border-line bg-surface p-0 shadow-2xl transition-all duration-200"
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

        {/* Mobile view switcher: preview OR controls, never both squeezed */}
        <div className="flex shrink-0 items-center gap-1 border-b border-line bg-surface-2/40 p-2 lg:hidden">
          {(
            [
              { id: 'preview', label: t('appearance.viewPreview'), icon: Eye },
              { id: 'customize', label: t('appearance.viewCustomize'), icon: Settings2 },
            ] as const
          ).map((v) => {
            const Icon = v.icon;
            const active = mobileView === v.id;
            return (
              <button
                key={v.id}
                type="button"
                aria-pressed={active}
                onClick={() => setMobileView(v.id)}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                  active
                    ? 'bg-surface text-ink shadow-xs font-semibold'
                    : 'text-ink-3 hover:text-ink hover:bg-surface-2'
                )}
              >
                <Icon className="size-3.5" />
                <span>{v.label}</span>
              </button>
            );
          })}
        </div>

        {/* Studio Workspace Layout */}
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row overflow-hidden">
          {/* Left Column: Live Scaled Timer Preview */}
          <div
            data-studio-device
            className={cn(
              'min-h-0 flex-1 flex-col border-b border-line p-3 lg:border-b-0 lg:border-r lg:p-5 overflow-hidden',
              mobileView === 'preview' ? 'flex' : 'hidden',
              'lg:flex'
            )}
          >
            <ScaledTimerPreview />
          </div>

          {/* Right Column: Settings Panel */}
          <div
            className={cn(
              'min-h-0 w-full flex-col lg:w-120 shrink-0 bg-surface lg:flex-none',
              mobileView === 'customize' ? 'flex flex-1' : 'hidden',
              'lg:flex lg:self-stretch'
            )}
          >
            {/* Tabs Navigation */}
            <div
              ref={tabsRef}
              role="tablist"
              aria-label={t('appearance.tabsLabel')}
              onKeyDown={handleTabKeyDown}
              className="flex shrink-0 gap-1 border-b border-line bg-surface-2/40 px-3 py-2 overflow-x-auto scrollbar-none touch-pan-x overscroll-x-contain mask-[linear-gradient(to_right,black_calc(100%-1.5rem),transparent)]"
            >
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    data-tab-id={tab.id}
                    aria-selected={active}
                    tabIndex={active ? 0 : -1}
                    onClick={(e) => {
                      setActiveTab(tab.id);
                      e.currentTarget.scrollIntoView({
                        inline: 'center',
                        block: 'nearest',
                        behavior: 'smooth',
                      });
                    }}
                    className={cn(
                      'flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink',
                      active
                        ? 'bg-surface text-ink shadow-xs font-semibold'
                        : 'text-ink-3 hover:text-ink hover:bg-surface-2'
                    )}
                  >
                    <Icon className="size-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Scrollable Tab Content */}
            <div
              role="tabpanel"
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain touch-pan-y p-4 sm:p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
            >
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
                      const PresetIcon = getPresetIcon(preset.id);
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
                            <span className="flex items-center gap-1.5 text-xs font-bold text-ink">
                              <PresetIcon className="size-3.5 text-ink-2" aria-hidden="true" />
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

                          <PresetDots preset={preset} />
                        </button>
                      );
                    })}
                  </div>

                  <CustomThemesSection />
                  <ThemeShareSection />
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

              {/* Tab 3: Typography */}
              {activeTab === 'typography' && (
                <div className="flex flex-col gap-4">
                  <div>
                    <h4 className="text-sm font-semibold text-ink">
                      {t('appearance.typographyTitle')}
                    </h4>
                    <p className="mt-0.5 text-xs text-ink-3">
                      {t('appearance.typographySubtitle')}
                    </p>
                  </div>

                  <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium text-ink">
                        {t('appearance.fontSans')}
                      </span>
                      <Select value={fontSans} onValueChange={setFontSans}>
                        <SelectTrigger className="w-full text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SANS_FONTS.map((f) => (
                            <SelectItem key={f.id} value={f.id}>
                              <span style={{ fontFamily: f.stack }}>{f.label}</span>
                            </SelectItem>
                          ))}
                          {customSansFonts.map((f) => (
                            <SelectItem key={f.id} value={f.id}>
                              <span style={{ fontFamily: `'${customFontFamily(f.id)}', sans-serif` }}>
                                {f.name}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <input
                        ref={sansUploadRef}
                        type="file"
                        accept=".woff2,.woff,.ttf,.otf"
                        className="hidden"
                        onChange={(e) => {
                          void handleFontUpload('sans', e.target.files?.[0]);
                          e.target.value = '';
                        }}
                      />
                      <div className="flex flex-wrap items-center gap-1.5">
                        {canUploadMore && (
                          <button
                            type="button"
                            disabled={uploadingFont}
                            onClick={() => sansUploadRef.current?.click()}
                            className="flex items-center gap-1 rounded-md border border-dashed border-line px-2 py-1 text-[0.68rem] font-medium text-ink-3 transition-colors hover:border-ink/30 hover:text-ink disabled:opacity-50"
                          >
                            {uploadingFont ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <Plus className="size-3" />
                            )}
                            {t('appearance.uploadFont')}
                          </button>
                        )}
                        {customSansFonts.map((f) => (
                          <span
                            key={f.id}
                            className="flex items-center gap-1 rounded-md border border-line bg-surface-2/60 py-1 pr-1 pl-2 text-[0.68rem] font-medium text-ink-2"
                          >
                            <span className="max-w-28 truncate">{f.name}</span>
                            <button
                              type="button"
                              onClick={() => handleDeleteFont(f.id)}
                              aria-label={t('appearance.deleteFont')}
                              className="flex size-4 items-center justify-center rounded text-ink-3 transition-colors hover:bg-surface hover:text-dnf"
                            >
                              <X className="size-2.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium text-ink">
                        {t('appearance.fontMono')}
                      </span>
                      <Select value={fontMono} onValueChange={setFontMono}>
                        <SelectTrigger className="w-full text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MONO_FONTS.map((f) => (
                            <SelectItem key={f.id} value={f.id}>
                              <span style={{ fontFamily: f.stack }}>{f.label}</span>
                            </SelectItem>
                          ))}
                          {customMonoFonts.map((f) => (
                            <SelectItem key={f.id} value={f.id}>
                              <span style={{ fontFamily: `'${customFontFamily(f.id)}', monospace` }}>
                                {f.name}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <input
                        ref={monoUploadRef}
                        type="file"
                        accept=".woff2,.woff,.ttf,.otf"
                        className="hidden"
                        onChange={(e) => {
                          void handleFontUpload('mono', e.target.files?.[0]);
                          e.target.value = '';
                        }}
                      />
                      <div className="flex flex-wrap items-center gap-1.5">
                        {canUploadMore && (
                          <button
                            type="button"
                            disabled={uploadingFont}
                            onClick={() => monoUploadRef.current?.click()}
                            className="flex items-center gap-1 rounded-md border border-dashed border-line px-2 py-1 text-[0.68rem] font-medium text-ink-3 transition-colors hover:border-ink/30 hover:text-ink disabled:opacity-50"
                          >
                            {uploadingFont ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <Plus className="size-3" />
                            )}
                            {t('appearance.uploadFont')}
                          </button>
                        )}
                        {customMonoFonts.map((f) => (
                          <span
                            key={f.id}
                            className="flex items-center gap-1 rounded-md border border-line bg-surface-2/60 py-1 pr-1 pl-2 text-[0.68rem] font-medium text-ink-2"
                          >
                            <span className="max-w-28 truncate">{f.name}</span>
                            <button
                              type="button"
                              onClick={() => handleDeleteFont(f.id)}
                              aria-label={t('appearance.deleteFont')}
                              className="flex size-4 items-center justify-center rounded text-ink-3 transition-colors hover:bg-surface hover:text-dnf"
                            >
                              <X className="size-2.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 border-t border-line pt-3">
                      <span className="text-xs font-medium text-ink">
                        {t('appearance.zeroStyle')}
                      </span>
                      <div className="flex items-center gap-1 self-start rounded-full border border-line bg-surface-2 p-0.5">
                        {(['dotted', 'slashed'] as const).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setZeroStyle(mode)}
                            aria-pressed={zeroStyle === mode}
                            className={cn(
                              'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                              zeroStyle === mode
                                ? 'bg-ink text-canvas shadow-sm'
                                : 'text-ink-2 hover:text-ink',
                            )}
                          >
                            {t(mode === 'dotted' ? 'appearance.zeroDotted' : 'appearance.zeroSlashed', mode)}
                            <span
                              aria-hidden="true"
                              className="ml-1 font-mono font-bold"
                              style={{
                                fontVariantNumeric: 'tabular-nums',
                                fontFeatureSettings:
                                  mode === 'slashed'
                                    ? `"tnum" 1, ${slashedZeroFeature(fontMono)}`
                                    : '"tnum" 1',
                              }}
                            >
                              0
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <p className="rounded-lg border border-line bg-surface-2/40 px-3 py-2.5 text-sm text-ink">
                      <span className="font-sans">AaBbCcDd 12:34.56 </span>
                      <span className="nums">12:34.56 R U R&apos; U&apos;</span>
                    </p>
                  </div>
                </div>
              )}

              {/* Tab 4: Liquid Glass */}
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

                    {liquidGlass && (
                      <div className="flex flex-col gap-3 border-t border-line pt-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-ink">
                            {t('appearance.liquidGlassCustomBlur')}
                          </span>
                          <Switch
                            checked={liquidGlassBlur != null}
                            onCheckedChange={(on) =>
                              setLiquidGlassBlur(on ? (liquidGlassBlur ?? 14) : null)
                            }
                          />
                        </div>
                        {liquidGlassBlur != null && (
                          <>
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-medium text-ink">
                                {t('appearance.liquidGlassBlur')}
                              </span>
                              <span className="font-mono font-semibold text-ink">
                                {liquidGlassBlur}px
                              </span>
                            </div>
                            <Slider
                              value={[liquidGlassBlur]}
                              onValueChange={([val]) => {
                                if (val !== undefined) setLiquidGlassBlur(val);
                              }}
                              min={0}
                              max={24}
                              step={1}
                              className="w-full"
                            />
                            <p className="text-[0.7rem] text-ink-3">
                              {t(
                                'appearance.liquidGlassCustomBlurHint',
                                'Desactivado usa la fórmula automática ligada a la opacidad.',
                              )}
                            </p>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 5: Background Media */}
              {activeTab === 'background' && (
                <div className="flex flex-col gap-4">
                  <CustomBackgroundSetting />
                </div>
              )}

              {/* Tab 6: Reset Options */}
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
                          // Factory defaults: classic light theme, no overrides,
                          // default fonts, glass off, no background media.
                          // The user's own library (uploaded fonts, saved
                          // custom themes) is preserved — only the active
                          // selection is reverted.
                          const prefs = preferencesStore.getState();
                          setThemePreset('default');
                          prefs.setTheme('light');
                          resetCustomThemeColors();
                          setLiquidGlass(false);
                          setLiquidGlassOpacity(65);
                          setLiquidGlassBlur(null);
                          setFontSans('open-sans');
                          setFontMono('cascadia-code');
                          setZeroStyle('slashed');
                          prefs.setTimerBackgroundImage(null);
                          prefs.setTimerBackgroundOpacity(100);
                          prefs.setTimerBackgroundBlur(0);
                          prefs.setTimerBackgroundFit('cover');
                          prefs.setTimerBackgroundOverlay(0);
                          prefs.setTimerBackgroundAllViews(true);
                          prefs.setTimerBackgroundAlwaysAnimate(true);
                          void useBackgroundMediaStore.getState().clearMedia();
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
