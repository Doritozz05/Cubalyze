'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Image as ImageIcon,
  Upload,
  Trash2,
  Loader2,
  Play,
  Pause,
  Film,
  Sparkles,
} from 'lucide-react';
import { useStore } from 'zustand';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { preferencesStore } from '@cubalyze/state';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  validateAndProcessBackgroundMedia,
  MediaValidationError,
} from '@/utils/mediaUtils';
import { useBackgroundMediaStore } from '@/stores/backgroundMediaStore';

export function CustomBackgroundSetting() {
  const { t } = useTranslation('settings');
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewPlaying, setPreviewPlaying] = useState(false);

  const timerBackgroundImage = useStore(preferencesStore, (s) => s.timerBackgroundImage);
  const timerBackgroundOpacity = useStore(preferencesStore, (s) => s.timerBackgroundOpacity);
  const setTimerBackgroundOpacity = useStore(preferencesStore, (s) => s.setTimerBackgroundOpacity);
  const timerBackgroundBlur = useStore(preferencesStore, (s) => s.timerBackgroundBlur);
  const setTimerBackgroundBlur = useStore(preferencesStore, (s) => s.setTimerBackgroundBlur);
  const timerBackgroundFit = useStore(preferencesStore, (s) => s.timerBackgroundFit);
  const setTimerBackgroundFit = useStore(preferencesStore, (s) => s.setTimerBackgroundFit);
  const timerBackgroundOverlay = useStore(preferencesStore, (s) => s.timerBackgroundOverlay);
  const setTimerBackgroundOverlay = useStore(preferencesStore, (s) => s.setTimerBackgroundOverlay);
  const timerBackgroundAllViews = useStore(preferencesStore, (s) => s.timerBackgroundAllViews);
  const setTimerBackgroundAllViews = useStore(preferencesStore, (s) => s.setTimerBackgroundAllViews);
  const timerBackgroundAlwaysAnimate = useStore(preferencesStore, (s) => s.timerBackgroundAlwaysAnimate);
  const setTimerBackgroundAlwaysAnimate = useStore(preferencesStore, (s) => s.setTimerBackgroundAlwaysAnimate);

  const mediaUrl = useBackgroundMediaStore((s) => s.mediaUrl);
  const posterUrl = useBackgroundMediaStore((s) => s.posterUrl);
  const mediaType = useBackgroundMediaStore((s) => s.mediaType);
  const duration = useBackgroundMediaStore((s) => s.duration);
  const setMedia = useBackgroundMediaStore((s) => s.setMedia);
  const clearMedia = useBackgroundMediaStore((s) => s.clearMedia);

  const previewVideoRef = useRef<HTMLVideoElement>(null);

  // Tiling only makes sense for static images — video frames and animated
  // GIFs always render cover/contain. Coerce a stale 'tile' back to cover
  // so the stored value never disagrees with what is rendered.
  const canTile = mediaType === 'image' || !mediaType;
  useEffect(() => {
    if (!canTile && timerBackgroundFit === 'tile') {
      setTimerBackgroundFit('cover');
    }
  }, [canTile, timerBackgroundFit, setTimerBackgroundFit]);

  // Synchronize preview video playback
  useEffect(() => {
    const video = previewVideoRef.current;
    if (!video || mediaType !== 'video') return;

    if (previewPlaying) {
      video.currentTime = 0;
      video.play().catch(() => {});
    } else {
      video.pause();
      video.currentTime = 0;
    }
  }, [previewPlaying, mediaType]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessing(true);
      const processed = await validateAndProcessBackgroundMedia(file);
      await setMedia({
        blob: processed.blob,
        mimeType: processed.mimeType,
        mediaType: processed.mediaType,
        name: processed.name,
        posterDataUrl: processed.posterDataUrl,
        duration: processed.duration,
        width: processed.width,
        height: processed.height,
      });
      setPreviewPlaying(false);
    } catch (err) {
      console.error('Failed to process custom background:', err);
      if (err instanceof MediaValidationError) {
        if (err.code === 'DURATION_EXCEEDED') {
          toast.error(
            t('appearance.videoDurationError', {
              duration: err.duration?.toFixed(1) ?? '10+',
            }),
          );
        } else if (err.code === 'SIZE_EXCEEDED') {
          toast.error(t('appearance.videoSizeError'));
        } else {
          toast.error(t('appearance.uploadError'));
        }
      } else {
        toast.error(t('appearance.uploadError'));
      }
    } finally {
      setIsProcessing(false);
      e.target.value = '';
    }
  };

  const handleRemove = async () => {
    try {
      setIsProcessing(true);
      setPreviewPlaying(false);
      await clearMedia();
    } catch (err) {
      console.error('Failed to remove custom background:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const hasBackground =
    !!timerBackgroundImage &&
    (!!mediaUrl || timerBackgroundImage.startsWith('data:'));

  const effectiveMediaUrl =
    mediaUrl ||
    (timerBackgroundImage?.startsWith('data:') ? timerBackgroundImage : null);

  return (
    <div className="group flex flex-col gap-4 rounded-xl border border-line bg-surface p-5 transition-shadow duration-200 hover:shadow-sm">
      <div className="flex flex-col gap-3">
        <div className="min-w-0">
          <h4 className="flex items-center gap-2 text-[0.85rem] font-medium leading-5 text-ink">
            <ImageIcon className="size-3.5 text-ink-2" />
            {t('appearance.backgroundImage')}
          </h4>
          <p className="mt-1.5 text-[0.78rem] leading-5 text-ink-3">
            {t('appearance.backgroundImageHint')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="file"
            id="bg-image-upload"
            accept="image/*,video/mp4,video/webm,video/quicktime,video/ogg"
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
            {hasBackground
              ? t('appearance.changeImage')
              : t('appearance.uploadImage')}
          </Button>
          {hasBackground && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isProcessing}
              className="h-8 text-xs text-caution hover:bg-caution/10 hover:text-caution"
              onClick={handleRemove}
            >
              <Trash2 className="size-3.5" />
              {t('appearance.removeImage')}
            </Button>
          )}
        </div>
      </div>

      {hasBackground && effectiveMediaUrl && (
        <div className="flex flex-col gap-4 border-t border-line/50 pt-4">
          {/* Thumbnail / Interactive Live Preview */}
          <div className="relative h-36 w-full overflow-hidden rounded-lg border border-line bg-canvas">
            {/* 1. Video preview */}
            {mediaType === 'video' && (
              <video
                ref={previewVideoRef}
                src={effectiveMediaUrl}
                poster={posterUrl || undefined}
                loop
                muted
                playsInline
                className="absolute inset-0 size-full object-cover"
                style={{
                  objectFit: timerBackgroundFit === 'contain' ? 'contain' : 'cover',
                  opacity: timerBackgroundOpacity / 100,
                  filter: timerBackgroundBlur ? `blur(${timerBackgroundBlur}px)` : undefined,
                  transform: timerBackgroundBlur ? 'scale(1.05)' : undefined,
                }}
              />
            )}

            {/* 2. Animated GIF preview */}
            {mediaType === 'gif' && (
              <>
                {previewPlaying ? (
                  <img
                    key={`preview-gif-${effectiveMediaUrl}`}
                    src={effectiveMediaUrl}
                    alt=""
                    className="absolute inset-0 size-full pointer-events-none"
                    style={{
                      objectFit:
                        timerBackgroundFit === 'contain'
                          ? 'contain'
                          : timerBackgroundFit === 'tile'
                            ? 'none'
                            : 'cover',
                      opacity: timerBackgroundOpacity / 100,
                      filter: timerBackgroundBlur ? `blur(${timerBackgroundBlur}px)` : undefined,
                      transform: timerBackgroundBlur ? 'scale(1.05)' : undefined,
                    }}
                  />
                ) : (
                  <div
                    className="absolute inset-0 bg-center"
                    style={{
                      backgroundImage: `url("${posterUrl || effectiveMediaUrl}")`,
                      backgroundSize: timerBackgroundFit === 'tile' ? 'auto' : timerBackgroundFit,
                      backgroundRepeat: timerBackgroundFit === 'tile' ? 'repeat' : 'no-repeat',
                      opacity: timerBackgroundOpacity / 100,
                      filter: timerBackgroundBlur ? `blur(${timerBackgroundBlur}px)` : undefined,
                      transform: timerBackgroundBlur ? 'scale(1.05)' : undefined,
                    }}
                  />
                )}
              </>
            )}

            {/* 3. Static image preview */}
            {(mediaType === 'image' || !mediaType) && (
              <div
                className="absolute inset-0 bg-center"
                style={{
                  backgroundImage: `url("${effectiveMediaUrl}")`,
                  backgroundSize: timerBackgroundFit === 'tile' ? 'auto' : timerBackgroundFit,
                  backgroundRepeat: timerBackgroundFit === 'tile' ? 'repeat' : 'no-repeat',
                  opacity: timerBackgroundOpacity / 100,
                  filter: timerBackgroundBlur ? `blur(${timerBackgroundBlur}px)` : undefined,
                  transform: timerBackgroundBlur ? 'scale(1.05)' : undefined,
                }}
              />
            )}

            {/* Dark overlay */}
            {timerBackgroundOverlay > 0 && (
              <div
                className="absolute inset-0 bg-black pointer-events-none"
                style={{ opacity: timerBackgroundOverlay / 100 }}
              />
            )}

            {/* Media Type Badge in corner */}
            <div data-glass-float className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-[0.7rem] font-medium text-ink shadow-sm border border-line">
              {mediaType === 'video' ? (
                <>
                  <Film className="size-3 text-primary" />
                  <span>
                    {t('appearance.typeVideo')}{' '}
                    {duration ? `(${duration.toFixed(1)}s)` : ''}
                  </span>
                </>
              ) : mediaType === 'gif' ? (
                <>
                  <Sparkles className="size-3 text-amber-500" />
                  <span>{t('appearance.typeGif')}</span>
                </>
              ) : (
                <>
                  <ImageIcon className="size-3 text-ink-2" />
                  <span>{t('appearance.typeImage')}</span>
                </>
              )}
            </div>

            {/* Test Animation (Play/Pause) Button for Videos and GIFs */}
            {(mediaType === 'video' || mediaType === 'gif') && (
              <button
                data-glass-float
                type="button"
                onClick={() => setPreviewPlaying((p) => !p)}
                className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1.5 rounded-full bg-surface hover:bg-surface-2 px-2.5 py-1 text-[0.7rem] font-medium text-ink shadow-sm border border-line transition-colors"
                title={previewPlaying ? t('appearance.previewPause') : t('appearance.previewPlay')}
              >
                {previewPlaying ? (
                  <>
                    <Pause className="size-3 text-primary fill-primary" />
                    <span>{t('appearance.previewPause')}</span>
                  </>
                ) : (
                  <>
                    <Play className="size-3 text-primary fill-primary" />
                    <span>{t('appearance.previewPlay')}</span>
                  </>
                )}
              </button>
            )}

            {/* Mock timer readout */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span data-glass-float className="rounded-md bg-surface px-3 py-1 font-mono text-xs font-semibold text-ink shadow-sm border border-line">
                00:00.00
              </span>
            </div>
          </div>

          {/* Controls grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                onValueChange={(val) =>
                  val[0] !== undefined && setTimerBackgroundOpacity(val[0])
                }
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
                onValueChange={(val) =>
                  val[0] !== undefined && setTimerBackgroundBlur(val[0])
                }
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
                onValueChange={(val) =>
                  val[0] !== undefined && setTimerBackgroundOverlay(val[0])
                }
              />
            </div>

            {/* Fit mode selector */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-ink-2 font-medium">{t('appearance.fit')}</span>
              <Select
                value={timerBackgroundFit}
                onValueChange={(val) =>
                  setTimerBackgroundFit(val as 'cover' | 'contain' | 'tile')
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cover">{t('appearance.fitCover')}</SelectItem>
                  <SelectItem value="contain">{t('appearance.fitContain')}</SelectItem>
                  {canTile && (
                    <SelectItem value="tile">{t('appearance.fitTile')}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Always animate (only visible for video or gif, above the experimental toggle) */}
            {(mediaType === 'video' || mediaType === 'gif') && (
              <div className="flex items-center justify-between gap-4 rounded-lg border border-line/60 bg-surface-2/40 p-3 mt-1 sm:col-span-2">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-xs font-medium text-ink">
                    {t('appearance.backgroundAlwaysAnimate')}
                  </span>
                  <span className="text-[0.72rem] text-ink-3 leading-4">
                    {t('appearance.backgroundAlwaysAnimateHint')}
                  </span>
                </div>
                <Switch
                  checked={timerBackgroundAlwaysAnimate}
                  onCheckedChange={setTimerBackgroundAlwaysAnimate}
                />
              </div>
            )}

            {/* Experimental: Background on all views */}
            <div className="flex items-center justify-between gap-4 rounded-lg border border-line/60 bg-surface-2/40 p-3 mt-1 sm:col-span-2">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-ink">
                    {t('appearance.backgroundAllViews')}
                  </span>
                  <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[0.65rem] font-semibold tracking-wide text-amber-500 uppercase border border-amber-500/20">
                    {t('appearance.experimentalBadge')}
                  </span>
                </div>
                <span className="text-[0.72rem] text-ink-3 leading-4">
                  {t('appearance.backgroundAllViewsHint')}
                </span>
              </div>
              <Switch
                checked={timerBackgroundAllViews}
                onCheckedChange={setTimerBackgroundAllViews}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
