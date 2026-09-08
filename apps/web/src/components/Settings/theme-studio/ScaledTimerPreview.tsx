'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useStore } from 'zustand';
import { useTranslation } from 'react-i18next';
import { preferencesStore } from '@cubeforge/state';
import { useBackgroundMediaStore } from '@/stores/backgroundMediaStore';
import { Smartphone, Tablet, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';
import { resolveThemeColors } from '@/theme/themePresets';

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
    return resolveThemeColors(effectivePreset, storeTheme, effectiveCustomColors);
  }, [effectivePreset, storeTheme, effectiveCustomColors]);

  // Scaled container calculations
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);

  const targetDim = DEVICE_CONFIG[deviceMode];

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const updateScale = () => {
      const availWidth = el.clientWidth - 16;
      const availHeight = el.clientHeight - 16;
      const scaleX = availWidth / targetDim.width;
      const scaleY = availHeight / targetDim.height;
      const calculated = Math.min(scaleX, scaleY, 0.95);
      setScale(Math.max(calculated, 0.28));
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(el);
    return () => observer.disconnect();
  }, [targetDim]);

  // Timer state visuals
  const getTimerDisplay = () => {
    switch (timerState) {
      case 'inspection':
        return { time: '12', color: 'text-caution', hint: t('appearance.hintInspection', 'Inspección (15 s)') };
      case 'holding':
        return { time: '0.00', color: 'text-hold', hint: t('appearance.hintHolding', 'Mantén pulsado...') };
      case 'ready':
        return { time: '0.00', color: 'text-ready', hint: t('appearance.hintReady', '¡Listo! Suelta para iniciar') };
      case 'running':
        return { time: '6.42', color: 'text-ink', hint: t('appearance.hintRunning', 'Resolviendo...') };
      case 'penalty':
        return { time: '11.85 +2', color: 'text-plus2', hint: t('appearance.hintPenalty', '+2 penalización') };
      case 'idle':
      default:
        return { time: '9.84', color: 'text-ink', hint: t('appearance.hintIdle', 'Presiona espacio para empezar') };
    }
  };

  const timerDisplay = getTimerDisplay();

  const timerStates = [
    { id: 'idle' as const, label: t('appearance.stateIdle', 'Reposo') },
    { id: 'inspection' as const, label: t('appearance.stateInspection', 'Inspección') },
    { id: 'holding' as const, label: t('appearance.stateHolding', 'Mantener') },
    { id: 'ready' as const, label: t('appearance.stateReady', 'Listo') },
    { id: 'running' as const, label: t('appearance.stateRunning', 'Corriendo') },
    { id: 'penalty' as const, label: t('appearance.statePenalty', '+2 / DNF') },
  ];

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-line bg-surface-2/40 shadow-inner">
      {/* Preview Header Toolbar */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-line bg-surface/80 px-3.5 py-2.5 backdrop-blur-md">
        {/* Device Switcher */}
        <div className="flex items-center gap-1 rounded-lg border border-line bg-surface-2 p-0.5">
          {(['mobile', 'tablet', 'desktop'] as DeviceMode[]).map((mode) => {
            const Icon = mode === 'mobile' ? Smartphone : mode === 'tablet' ? Tablet : Monitor;
            const active = deviceMode === mode;
            const deviceLabel = t(DEVICE_CONFIG[mode].nameKey, mode);
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setDeviceMode(mode)}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  active
                    ? 'bg-surface text-ink shadow-xs'
                    : 'text-ink-3 hover:text-ink hover:bg-surface/50'
                )}
                title={deviceLabel}
              >
                <Icon className="size-3.5" />
                <span className="max-sm:hidden">{deviceLabel}</span>
              </button>
            );
          })}
        </div>

        {/* Timer State Simulator */}
        <div className="flex items-center gap-1">
          <span className="mr-1 text-[0.7rem] font-medium text-ink-3 max-md:hidden">
            {t('appearance.timerStateLabel', 'Estado del temporizador:')}
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

      {/* Scaled Stage Area */}
      <div
        ref={wrapperRef}
        className="relative flex flex-1 items-center justify-center overflow-hidden p-2 select-none"
      >
        <div
          style={{
            width: targetDim.width * scale,
            height: targetDim.height * scale,
          }}
          className="relative shrink-0 rounded-2xl shadow-2xl transition-all duration-300 ring-1 ring-line/70 overflow-hidden"
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
              'absolute inset-0 flex flex-col bg-canvas text-ink overflow-hidden',
              effectiveLiquid && 'liquid-glass'
            )}
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
                    <span>{t('appearance.previewSession', 'Sesión 1')}</span>
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
                  <span className="text-[0.65rem] text-ink-3">{t('appearance.previewVsPb', 'vs PB')}</span>
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
                    {t('appearance.previewStats', 'Estadísticas')}
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
                    {t('appearance.previewTimes', 'Tiempos')}
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
                    {t('appearance.previewCube2d', 'Cubo 2D')}
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
  );
}
