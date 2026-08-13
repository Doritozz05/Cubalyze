'use client';

import { useState } from 'react';
import { Image as ImageIcon, Upload, Trash2, Loader2 } from 'lucide-react';
import { useStore } from 'zustand';
import { useTranslation } from 'react-i18next';
import { preferencesStore } from '@cubeforge/state';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { processBackgroundImage } from '@/utils/imageUtils';

export function CustomBackgroundSetting() {
  const { t } = useTranslation('settings');
  const [isProcessing, setIsProcessing] = useState(false);

  const timerBackgroundImage = useStore(preferencesStore, (s) => s.timerBackgroundImage);
  const setTimerBackgroundImage = useStore(preferencesStore, (s) => s.setTimerBackgroundImage);
  const timerBackgroundOpacity = useStore(preferencesStore, (s) => s.timerBackgroundOpacity);
  const setTimerBackgroundOpacity = useStore(preferencesStore, (s) => s.setTimerBackgroundOpacity);
  const timerBackgroundBlur = useStore(preferencesStore, (s) => s.timerBackgroundBlur);
  const setTimerBackgroundBlur = useStore(preferencesStore, (s) => s.setTimerBackgroundBlur);
  const timerBackgroundFit = useStore(preferencesStore, (s) => s.timerBackgroundFit);
  const setTimerBackgroundFit = useStore(preferencesStore, (s) => s.setTimerBackgroundFit);
  const timerBackgroundOverlay = useStore(preferencesStore, (s) => s.timerBackgroundOverlay);
  const setTimerBackgroundOverlay = useStore(preferencesStore, (s) => s.setTimerBackgroundOverlay);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessing(true);
      const dataUrl = await processBackgroundImage(file);
      setTimerBackgroundImage(dataUrl);
    } catch (err) {
      console.error('Failed to process custom background image:', err);
    } finally {
      setIsProcessing(false);
      // Reset input value so same file re-upload works
      e.target.value = '';
    }
  };

  return (
    <div className="group flex flex-col gap-4 rounded-xl border border-line bg-surface p-5 transition-shadow duration-200 hover:shadow-sm">
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          <h4 className="flex items-center gap-2 text-[0.85rem] font-medium leading-5 text-ink">
            <ImageIcon className="size-3.5 text-ink-2" />
            {t('appearance.backgroundImage')}
          </h4>
          <p className="mt-1.5 text-[0.78rem] leading-5 text-ink-3">
            {t('appearance.backgroundImageHint')}
          </p>
        </div>
        <div className="mt-0.5 flex shrink-0 items-center gap-2">
          <input
            type="file"
            id="bg-image-upload"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isProcessing}
            className="h-8 gap-1.5 text-xs"
            onClick={() => document.getElementById('bg-image-upload')?.click()}
          >
            {isProcessing ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Upload className="size-3.5" />
            )}
            {timerBackgroundImage ? t('appearance.changeImage') : t('appearance.uploadImage')}
          </Button>
          {timerBackgroundImage && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isProcessing}
              className="h-8 text-xs text-caution hover:bg-caution/10 hover:text-caution"
              onClick={() => setTimerBackgroundImage(null)}
            >
              <Trash2 className="size-3.5" />
              {t('appearance.removeImage')}
            </Button>
          )}
        </div>
      </div>

      {timerBackgroundImage && (
        <div className="flex flex-col gap-4 border-t border-line/50 pt-4">
          {/* Image Thumbnail Preview */}
          <div className="relative h-32 w-full overflow-hidden rounded-lg border border-line bg-canvas">
            <div
              className="absolute inset-0 bg-center"
              style={{
                backgroundImage: `url("${timerBackgroundImage}")`,
                backgroundSize: timerBackgroundFit === 'tile' ? 'auto' : timerBackgroundFit,
                backgroundRepeat: timerBackgroundFit === 'tile' ? 'repeat' : 'no-repeat',
                opacity: timerBackgroundOpacity / 100,
                filter: timerBackgroundBlur ? `blur(${timerBackgroundBlur}px)` : undefined,
                transform: timerBackgroundBlur ? 'scale(1.05)' : undefined,
              }}
            />
            {timerBackgroundOverlay > 0 && (
              <div
                className="absolute inset-0 bg-black pointer-events-none"
                style={{ opacity: timerBackgroundOverlay / 100 }}
              />
            )}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="rounded-md bg-surface/90 backdrop-blur-xs px-3 py-1 font-mono text-xs font-semibold text-ink shadow-sm border border-line/50">
                00:00.00
              </span>
            </div>
          </div>

          {/* Controls grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Opacity slider */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs text-ink-2 font-medium">
                <span>{t('appearance.opacity')}</span>
                <span className="nums font-mono">{timerBackgroundOpacity}%</span>
              </div>
              <Slider
                min={10}
                max={100}
                step={5}
                value={[timerBackgroundOpacity]}
                onValueChange={(val) => val[0] !== undefined && setTimerBackgroundOpacity(val[0])}
              />
            </div>

            {/* Blur slider */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs text-ink-2 font-medium">
                <span>{t('appearance.blur')}</span>
                <span className="nums font-mono">{timerBackgroundBlur}px</span>
              </div>
              <Slider
                min={0}
                max={20}
                step={1}
                value={[timerBackgroundBlur]}
                onValueChange={(val) => val[0] !== undefined && setTimerBackgroundBlur(val[0])}
              />
            </div>

            {/* Overlay Darkness slider */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs text-ink-2 font-medium">
                <span>{t('appearance.overlay')}</span>
                <span className="nums font-mono">{timerBackgroundOverlay}%</span>
              </div>
              <Slider
                min={0}
                max={80}
                step={5}
                value={[timerBackgroundOverlay]}
                onValueChange={(val) => val[0] !== undefined && setTimerBackgroundOverlay(val[0])}
              />
            </div>

            {/* Fit mode selector */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-ink-2 font-medium">{t('appearance.fit')}</span>
              <Select
                value={timerBackgroundFit}
                onValueChange={(val) => setTimerBackgroundFit(val as 'cover' | 'contain' | 'tile')}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cover">{t('appearance.fitCover')}</SelectItem>
                  <SelectItem value="contain">{t('appearance.fitContain')}</SelectItem>
                  <SelectItem value="tile">{t('appearance.fitTile')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
