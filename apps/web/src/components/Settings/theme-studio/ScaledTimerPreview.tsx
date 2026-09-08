'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useStore } from 'zustand';
import { useTranslation } from 'react-i18next';
import { preferencesStore } from '@cubeforge/state';
import { useBackgroundMediaStore } from '@/stores/backgroundMediaStore';
import { Smartphone, Tablet, Monitor, Maximize2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  resolveThemeColors,
  getDerivedThemeTokens,
  getDerivedLiquidGlassTokens,
} from '@/theme/themePresets';

export type DeviceMode = 'mobile' | 'tablet' | 'desktop';
export type TimerPreviewState = 'idle' | 'inspection' | 'holding' | 'ready' | 'running' | 'penalty';

interface ScaledTimerPreviewProps {
  forcedThemePreset?: string;
  forcedCustomColors?: Record<string, string> | null;
  forcedLiquidGlass?: boolean;
  forcedLiquidGlassOpacity?: number;
}

const DEVICE_CONFIG: Record<DeviceMode, { width: number; height: number; nameKey: string }> = {
  mobile: { width: 390, height: 780, nameKey: 'appearance.deviceMobile' },
  tablet: { width: 768, height: 680, nameKey: 'appearance.deviceTablet' },
  desktop: { width: 1080, height: 680, nameKey: 'appearance.deviceDesktop' },
};

export function ScaledTimerPreview({
  forcedThemePreset,
  forcedCustomColors,
  forcedLiquidGlass,
  forcedLiquidGlassOpacity,
}: ScaledTimerPreviewProps) {
  const { t } = useTranslation('settings');

  // Detect default device based on viewport
  const [deviceMode, setDeviceMode] = useState<DeviceMode>(() => {
    if (typeof window === 'undefined') return 'desktop';
    if (window.innerWidth < 768) return 'mobile';
    if (window.innerWidth < 1024) return 'tablet';
    return 'desktop';
  });

  const [timerState, setTimerState] = useState<TimerPreviewState>('idle');
  // Expanded overlay (mobile "ver en grande"): the root becomes a fixed
  // overlay reusing the same DOM — ResizeObserver rescales automatically.
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);

  // Store subscriptions
  const storeTheme = useStore(preferencesStore, (s) => s.theme);
  const storePreset = useStore(preferencesStore, (s) => s.themePreset ?? 'default');
  const storeCustomColors = useStore(preferencesStore, (s) => s.customThemeColors);
  const storeLiquid = useStore(preferencesStore, (s) => s.liquidGlass);
  const storeLiquidOpacity = useStore(preferencesStore, (s) => s.liquidGlassOpacity ?? 65);

  const timerBackgroundImage = useStore(preferencesStore, (s) => s.timerBackgroundImage);
  const timerBackgroundOpacity = useStore(preferencesStore, (s) => s.timerBackgroundOpacity);
  const timerBackgroundBlur = useStore(preferencesStore, (s) => s.timerBackgroundBlur);
  const timerBackgroundFit = useStore(preferencesStore, (s) => s.timerBackgroundFit);
  const timerBackgroundOverlay = useStore(preferencesStore, (s) => s.timerBackgroundOverlay);

  const mediaUrl = useBackgroundMediaStore((s) => s.mediaUrl);
  const mediaType = useBackgroundMediaStore((s) => s.mediaType);
  const effectiveMediaUrl = mediaUrl || (timerBackgroundImage?.startsWith('data:') ? timerBackgroundImage : null);

  const effectivePreset = forcedThemePreset !== undefined ? forcedThemePreset : storePreset;
  const effectiveCustomColors = forcedCustomColors !== undefined ? forcedCustomColors : storeCustomColors;
  const effectiveLiquid = forcedLiquidGlass !== undefined ? forcedLiquidGlass : storeLiquid;
  const effectiveLiquidOpacity = forcedLiquidGlassOpacity !== undefined ? forcedLiquidGlassOpacity : storeLiquidOpacity;

  // Compute CSS variable styles for preview container
  const containerTokens = useMemo(() => {
    const resolved = resolveThemeColors(effectivePreset, storeTheme, effectiveCustomColors);
    const derived = getDerivedThemeTokens(resolved);
    const isClassicPreset =
      effectivePreset === 'default' || effectivePreset === 'light' || effectivePreset === 'dark';
    const glass = effectiveLiquid
      ? getDerivedLiquidGlassTokens(resolved, effectiveLiquidOpacity, undefined, isClassicPreset)
      : {};
    return {
      ...resolved,
      ...derived,
      ...glass,
    };
  }, [effectivePreset, storeTheme, effectiveCustomColors, effectiveLiquid, effectiveLiquidOpacity]);

  // Scaled container calculations
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);

  const targetDim = DEVICE_CONFIG[deviceMode];

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    let raf = 0;
    const updateScale = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const availWidth = el.clientWidth - 16;
        const availHeight = el.clientHeight - 16;
        if (availWidth <= 0 || availHeight <= 0) return;
        const scaleX = availWidth / targetDim.width;
        const scaleY = availHeight / targetDim.height;
        const calculated = Math.min(scaleX, scaleY, 0.95);
        setScale(Math.max(calculated, 0.3));
      });
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [targetDim, expanded]);

  // Timer state visuals
  const getTimerDisplay = () => {
    switch (timerState) {
      case 'inspection':
        return { time: '12', color: 'text-caution', hint: t('appearance.hintInspection') };
      case 'holding':
        return { time: '0.00', color: 'text-hold', hint: t('appearance.hintHolding') };
      case 'ready':
        return { time: '0.00', color: 'text-ready', hint: t('appearance.hintReady') };
      case 'running':
        return { time: '6.42', color: 'text-ink', hint: t('appearance.hintRunning') };
      case 'penalty':
        return { time: '11.85 +2', color: 'text-plus2', hint: t('appearance.hintPenalty') };
      case 'idle':
      default:
        return { time: '9.84', color: 'text-ink', hint: t('appearance.hintIdle') };
    }
  };

  const timerDisplay = getTimerDisplay();

  const timerStates = [
    { id: 'idle' as const, label: t('appearance.stateIdle') },
    { id: 'inspection' as const, label: t('appearance.stateInspection') },
    { id: 'holding' as const, label: t('appearance.stateHolding') },
    { id: 'ready' as const, label: t('appearance.stateReady') },
    { id: 'running' as const, label: t('appearance.stateRunning') },
    { id: 'penalty' as const, label: t('appearance.statePenalty') },
  ];

  return (
    <>
      {expanded && (
        <div
          className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
          onClick={() => setExpanded(false)}
          aria-hidden="true"
        />
      )}
    <div
      className={cn(
        'flex w-full flex-col overflow-hidden',
        expanded
          // Fullscreen: invisible chrome — no outer panel, only the device
          // frame + floating close are visible over the dimmed backdrop.
          ? 'fixed inset-0 z-[61] h-auto max-h-none rounded-none border-0 bg-transparent shadow-none'
          : 'h-full rounded-2xl border border-line bg-surface-2/40 shadow-inner'
      )}
    >
      {/* Fullscreen chrome: floating close only — no toolbar, no controls.
          No `title` here on purpose: native tooltips leak outside the
          fullscreen overlay on mousemove. aria-label only. */}
      {expanded && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          aria-label={t('appearance.previewCollapse', 'Cerrar vista previa')}
          className="absolute top-3 right-3 z-10 flex size-9 items-center justify-center rounded-full border border-line bg-surface/90 text-ink shadow-lg backdrop-blur-md transition-colors hover:bg-surface"
        >
          <X className="size-4" />
        </button>
      )}
      {/* Preview Header Toolbar — rounded-t inherits the frame radius:
          backdrop-filter breaks ancestor overflow+radius clipping in
          Chromium, so the bar must carry the corner radius itself or its
          square corners paint over the rounded frame. Hidden in fullscreen:
          only the live device preview is shown. */}
      {!expanded && (
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-t-[inherit] border-b border-line bg-surface/80 px-3.5 py-2.5 backdrop-blur-md">
        {/* Expand (mobile "ver en grande") — Radix tooltip, never `title` */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setExpanded(true)}
              aria-label={t('appearance.previewExpand', 'Ver en grande')}
              className="flex size-7 items-center justify-center rounded-md border border-line bg-surface-2 text-ink-3 transition-colors hover:text-ink hover:bg-surface"
            >
              <Maximize2 className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {t('appearance.previewExpand', 'Ver en grande')}
          </TooltipContent>
        </Tooltip>
        {/* Device Switcher */}
        <div className="flex items-center gap-1 rounded-lg border border-line bg-surface-2 p-0.5">
          {(['mobile', 'tablet', 'desktop'] as DeviceMode[]).map((mode) => {
            const Icon = mode === 'mobile' ? Smartphone : mode === 'tablet' ? Tablet : Monitor;
            const active = deviceMode === mode;
            const deviceLabel = t(DEVICE_CONFIG[mode].nameKey, mode);
            return (
              <Tooltip key={mode}>
                <TooltipTrigger asChild>
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setDeviceMode(mode)}
                    aria-label={deviceLabel}
                    aria-pressed={active}
                    className={cn(
                      'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                      active
                        ? 'bg-surface text-ink shadow-xs'
                        : 'text-ink-3 hover:text-ink hover:bg-surface/50'
                    )}
                  >
                    <Icon className="size-3.5" />
                    <span className="max-sm:hidden">{deviceLabel}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{deviceLabel}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* Timer State Simulator */}
        <div className="flex items-center gap-1">
          <span className="mr-1 text-[0.7rem] font-medium text-ink-3 max-md:hidden">
            {t('appearance.timerStateLabel')}
          </span>
          {timerStates.map((s) => {
            const active = timerState === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setTimerState(s.id)}
                className={cn(
                  'rounded-md px-2 py-1 text-[0.68rem] font-medium transition-colors',
                  active
                    ? 'bg-ink text-surface shadow-xs font-semibold'
                    : 'bg-surface border border-line text-ink-3 hover:text-ink hover:bg-surface-2'
                )}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>
      )}

      {/* Scaled Stage Area — double-click opens the fullscreen live preview.
          No `title`: it renders a native browser tooltip that leaks over the
          fullscreen overlay on mousemove. */}
      <div
        ref={wrapperRef}
        onDoubleClick={() => setExpanded(true)}
        className={cn(
          'relative flex flex-1 items-center justify-center overflow-hidden select-none',
          expanded ? 'min-h-0 p-4 sm:p-6' : 'p-2 cursor-zoom-in'
        )}
      >
        <div
          style={{
            width: targetDim.width * scale,
            height: targetDim.height * scale,
          }}
          // border (not ring) + bg-canvas base + isolate: the transformed
          // virtual screen inside can no longer paint square corners over
          // the rounded frame (Chromium overflow+transform clipping bug).
          className="relative isolate shrink-0 overflow-hidden rounded-2xl border border-line bg-canvas shadow-2xl transition-all duration-300"
        >
          {/* Scaled Virtual Screen */}
          <div
            style={{
              width: targetDim.width,
              height: targetDim.height,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              ...(containerTokens as unknown as React.CSSProperties),
              ...(effectiveLiquid
                ? {
                    '--glass-opacity': `${effectiveLiquidOpacity / 100}`,
                  }
                : {}),
            }}
            className={cn(
              'absolute inset-0 flex flex-col overflow-hidden rounded-[inherit] bg-canvas text-ink [backface-visibility:hidden]',
              effectiveLiquid && 'liquid-glass'
            )}
            data-glass-panel={effectiveLiquid || undefined}
          >
            {/* Background Media inside preview */}
            {effectiveMediaUrl && (
              <div
                className="pointer-events-none absolute inset-0 z-0 overflow-hidden select-none"
                style={{ opacity: (timerBackgroundOpacity ?? 100) / 100 }}
              >
                {mediaType === 'video' ? (
                  <video
                    src={effectiveMediaUrl}
                    loop
                    muted
                    autoPlay
                    playsInline
                    className="absolute inset-0 size-full object-cover"
                    style={{
                      objectFit: timerBackgroundFit === 'contain' ? 'contain' : 'cover',
                      filter: timerBackgroundBlur ? `blur(${timerBackgroundBlur}px)` : undefined,
                    }}
                  />
                ) : (
                  <div
                    className="absolute inset-0 bg-center"
                    style={{
                      backgroundImage: `url("${effectiveMediaUrl}")`,
                      backgroundSize: timerBackgroundFit === 'tile' ? 'auto' : (timerBackgroundFit || 'cover'),
                      backgroundRepeat: timerBackgroundFit === 'tile' ? 'repeat' : 'no-repeat',
                      filter: timerBackgroundBlur ? `blur(${timerBackgroundBlur}px)` : undefined,
                    }}
                  />
                )}
                {timerBackgroundOverlay > 0 && (
                  <div
                    className="absolute inset-0 bg-black"
                    style={{ opacity: timerBackgroundOverlay / 100 }}
                  />
                )}
              </div>
            )}

            {/* Simulated Timer Screen UI */}
            <div className="relative z-10 flex h-full flex-col justify-between p-4">
              {/* Top Bar / Scramble */}
              <div className="flex flex-col items-center gap-2">
                {/* Header chips */}
                <div className="flex w-full items-center justify-between">
                  <div className="flex items-center gap-2 rounded-lg border border-line bg-surface/90 px-2.5 py-1 text-xs font-semibold shadow-xs backdrop-blur-sm">
                    <span className="size-2 rounded-full bg-accent-emerald" />
                    <span>3×3×3</span>
                    <span className="text-[0.65rem] text-ink-3">#42</span>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-lg border border-line bg-surface/90 px-2.5 py-1 text-[0.7rem] font-mono text-ink-2 shadow-xs backdrop-blur-sm">
                    <span>{t('appearance.previewSession')}</span>
                  </div>
                </div>

                {/* Scramble display */}
                <div className="w-full rounded-xl border border-line bg-surface/90 p-3 text-center shadow-xs backdrop-blur-sm">
                  <p className="font-mono text-sm sm:text-base font-semibold tracking-wide text-ink">
                    R U R&apos; U&apos; R&apos; F R2 U&apos; R&apos; U&apos; R U R&apos; F&apos;
                  </p>
                </div>
              </div>

              {/* Central Timer Face */}
              <div className="my-auto flex flex-col items-center justify-center text-center">
                {/* PB Delta tag */}
                <div className="mb-2 inline-flex items-center gap-1 rounded-full border border-line bg-surface/80 px-2.5 py-0.5 text-xs font-mono font-medium text-ready shadow-xs backdrop-blur-sm">
                  <span>-0.42</span>
                  <span className="text-[0.65rem] text-ink-3">{t('appearance.previewVsPb')}</span>
                </div>

                {/* Main Digits */}
                <div
                  className={cn(
                    'font-mono text-6xl sm:text-7xl md:text-8xl font-black tracking-tight transition-colors duration-150',
                    timerDisplay.color
                  )}
                >
                  {timerDisplay.time}
                </div>

                {/* State / Hint caption */}
                <p className="mt-3 text-xs font-medium text-ink-3">
                  {timerDisplay.hint}
                </p>
              </div>

              {/* Bottom Layout Strip / Mini Widgets */}
              <div className="grid grid-cols-3 gap-2.5">
                {/* Stats Widget */}
                <div className="flex flex-col gap-1 rounded-xl border border-line bg-surface/90 p-2.5 shadow-xs backdrop-blur-sm">
                  <span className="text-[0.62rem] font-semibold uppercase tracking-wider text-ink-3">
                    {t('appearance.previewStats')}
                  </span>
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-ink-3">PB:</span>
                    <span className="font-bold text-ready">8.94</span>
                  </div>
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-ink-3">Ao5:</span>
                    <span className="font-medium text-ink">10.82</span>
                  </div>
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-ink-3">Ao12:</span>
                    <span className="font-medium text-ink">11.45</span>
                  </div>
                </div>

                {/* Times List Widget */}
                <div className="flex flex-col gap-1 rounded-xl border border-line bg-surface/90 p-2.5 shadow-xs backdrop-blur-sm">
                  <span className="text-[0.62rem] font-semibold uppercase tracking-wider text-ink-3">
                    {t('appearance.previewTimes')}
                  </span>
                  <div className="space-y-0.5 font-mono text-[0.7rem] text-ink-2">
                    <div className="flex justify-between">
                      <span className="text-ink-3">1.</span>
                      <span>9.84</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-3">2.</span>
                      <span>11.20</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-3">3.</span>
                      <span>10.55</span>
                    </div>
                  </div>
                </div>

                {/* Scramble 2D Net Widget */}
                <div className="flex flex-col items-center justify-center rounded-xl border border-line bg-surface/90 p-2 text-center shadow-xs backdrop-blur-sm">
                  <span className="text-[0.62rem] font-semibold uppercase tracking-wider text-ink-3 mb-1">
                    {t('appearance.previewCube2d')}
                  </span>
                  <div className="grid grid-cols-4 gap-0.5">
                    {['#facc15', '#ffffff', '#22c55e', '#3b82f6', '#ef4444', '#f97316'].map((col, idx) => (
                      <div
                        key={idx}
                        className="size-3 rounded-xs border border-black/20"
                        style={{ backgroundColor: col }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
