'use client';

import { useStore } from 'zustand';
import { preferencesStore, type HeaderMode } from '@cubeforge/state';
// Import from the side-effect-free "/skins" subpath: the engine's main entry
// pulls in three.js (~545 kB), which would otherwise land in the initial
// bundle just for this settings list.
import { CUBE_SKINS } from '@cubeforge/cube-3d-engine/skins';
import { ColorPicker } from '@/components/Settings/components/ColorPicker';
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

/**
 * Appearance settings section.
 *
 * Contains visual preferences like the interface theme, the 3D cube appearance, and
 * custom sticker colors. When the 'custom' skin is selected, per-face color pickers appear below.
 */
type FaceLetter = 'U' | 'D' | 'F' | 'B' | 'R' | 'L';

const FACE_LABEL_KEY: Record<FaceLetter, ParseKeys<'settings'>> = {
  U: 'appearance.faceU',
  D: 'appearance.faceD',
  F: 'appearance.faceF',
  B: 'appearance.faceB',
  R: 'appearance.faceR',
  L: 'appearance.faceL',
};

const SKIN_LABEL_KEY: Record<string, ParseKeys<'settings'>> = {
  default: 'appearance.skinDefault',
  stickerless: 'appearance.skinStickerless',
  coreless: 'appearance.skinCoreless',
  translucent: 'appearance.skinTranslucent',
  custom: 'appearance.skinCustom',
};

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
  const appearance3d = useStore(preferencesStore, (s) => s.appearance3d);
  const setAppearance3d = useStore(preferencesStore, (s) => s.setAppearance3d);
  const customStickerColors = useStore(preferencesStore, (s) => s.customStickerColors);
  const setCustomStickerColors = useStore(preferencesStore, (s) => s.setCustomStickerColors);
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

      {/* Skin selector */}
      <SettingRow
        title={t('appearance.appearance3d')}
        description={t('appearance.appearance3dHint')}
        control={
          <Select value={appearance3d} onValueChange={setAppearance3d}>
            <SelectTrigger className="w-40 max-lg:w-full">
              <SelectValue placeholder={t('appearance.selectAppearance')} />
            </SelectTrigger>
            <SelectContent>
              {CUBE_SKINS.map((skin) => (
                <SelectItem key={skin.id} value={skin.id}>
                  {t(SKIN_LABEL_KEY[skin.id])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {/* Custom sticker colors — only visible when 'custom' skin is selected */}
      {appearance3d === 'custom' && (
        <div className="rounded-xl border border-line bg-surface p-5 transition-shadow duration-200 hover:shadow-sm">
          <div className="mb-4">
            <h4 className="text-[0.85rem] font-medium text-ink">{t('appearance.customStickers')}</h4>
            <p className="mt-1 text-[0.72rem] text-ink-3">
              {t('appearance.customStickersHint')}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {(Object.keys(FACE_LABEL_KEY) as FaceLetter[]).map((face) => (
              <ColorPicker
                key={face}
                label={t(FACE_LABEL_KEY[face])}
                value={customStickerColors[face]}
                onChange={(color) => setCustomStickerColors({ [face]: color })}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
