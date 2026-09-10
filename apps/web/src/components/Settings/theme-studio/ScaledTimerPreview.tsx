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
import { ScrambleDisplay } from '@/components/Scramble/ScrambleDisplay';
import { getSlotTemplate } from '@/bottom-layout/slot-templates';
import { PreviewRail } from './preview/PreviewRail';
import { PreviewDock } from './preview/PreviewDock';
import { PreviewMobileHeader, PreviewMobileTabBar } from './preview/PreviewMobileChrome';
import { PreviewTimer } from './preview/PreviewTimer';
import { PreviewBottom, type PreviewPuzzle } from './preview/PreviewBottom';
import { evalScrambleToken, px } from './preview/evalViewport';
import {
  DEMO_SCRAMBLE_222,
  DEMO_SCRAMBLE_333,
  DEMO_SCRAMBLE_INDEX,
  DEMO_SOLVES_222,
  DEMO_SOLVES_333,
} from './preview/demoData';

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
  // Mocked preview puzzle (like the rest of the demo data): drives the demo
  // scramble, the 2D net and the demo solves behind the bottom layout.
  const [previewPuzzle, setPreviewPuzzle] = useState<PreviewPuzzle>('333');
  const demoScramble = previewPuzzle === '222' ? DEMO_SCRAMBLE_222 : DEMO_SCRAMBLE_333;
  const demoSolves = previewPuzzle === '222' ? DEMO_SOLVES_222 : DEMO_SOLVES_333;
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
  const storeCustomThemes = useStore(preferencesStore, (s) => s.customThemes);
  const storeLiquid = useStore(preferencesStore, (s) => s.liquidGlass);
  const storeLiquidOpacity = useStore(preferencesStore, (s) => s.liquidGlassOpacity ?? 65);
  const storeLiquidBlur = useStore(preferencesStore, (s) => s.liquidGlassBlur ?? null);
  const storeScramblePanel = useStore(preferencesStore, (s) => s.scramblePanel ?? false);
  const storeScrambleLayoutMode = useStore(preferencesStore, (s) => s.scrambleLayoutMode ?? 'default');
  const storeTimerPanel = useStore(preferencesStore, (s) => s.timerPanel ?? false);
  const storeBottomLayoutTemplate = useStore(preferencesStore, (s) => s.bottomLayoutTemplate);

  const timerBackgroundImage = useStore(preferencesStore, (s) => s.timerBackgroundImage);
  const timerBackgroundOpacity = useStore(preferencesStore, (s) => s.timerBackgroundOpacity);
  const timerBackgroundBlur = useStore(preferencesStore, (s) => s.timerBackgroundBlur);
  const timerBackgroundFit = useStore(preferencesStore, (s) => s.timerBackgroundFit);
  const timerBackgroundOverlay = useStore(preferencesStore, (s) => s.timerBackgroundOverlay);
  const timerBackgroundAlwaysAnimate = useStore(preferencesStore, (s) => s.timerBackgroundAlwaysAnimate ?? true);

  const mediaUrl = useBackgroundMediaStore((s) => s.mediaUrl);
  const mediaType = useBackgroundMediaStore((s) => s.mediaType);
  const effectiveMediaUrl = mediaUrl || (timerBackgroundImage?.startsWith('data:') ? timerBackgroundImage : null);

  const effectivePreset = forcedThemePreset !== undefined ? forcedThemePreset : storePreset;
  const effectiveCustomColors = forcedCustomColors !== undefined ? forcedCustomColors : storeCustomColors;
  const effectiveLiquid = forcedLiquidGlass !== undefined ? forcedLiquidGlass : storeLiquid;
  const effectiveLiquidOpacity = forcedLiquidGlassOpacity !== undefined ? forcedLiquidGlassOpacity : storeLiquidOpacity;

  // Compute CSS variable styles for preview container
  const containerTokens = useMemo(() => {
    const resolved = resolveThemeColors(effectivePreset, storeTheme, effectiveCustomColors, storeCustomThemes);
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
  }, [effectivePreset, storeTheme, effectiveCustomColors, storeCustomThemes, effectiveLiquid, effectiveLiquidOpacity]);

  // Scaled container calculations
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);

  const targetDim = DEVICE_CONFIG[deviceMode];
  const isMobileFrame = deviceMode === 'mobile';
  // Faithful rail clone: right-placement templates render as a side rail
  // (like TimerStage) on tablet/desktop; mobile falls back to the bottom row.
  const isRailPreview =
    !isMobileFrame && getSlotTemplate(storeBottomLayoutTemplate)?.placement === 'right';

  const scaledWidth = Math.round(targetDim.width * scale);
  const scaledHeight = Math.round(targetDim.height * scale);
  const exactScaleX = targetDim.width > 0 ? scaledWidth / targetDim.width : scale;
  const exactScaleY = targetDim.height > 0 ? scaledHeight / targetDim.height : scale;

  // Viewport-evaluated scramble token size (desktop/tablet frames only;
  // the mobile frame uses the real component's compact phone density).
  const scrambleTokenPx = useMemo(() => {
    if (isMobileFrame) return undefined;
    return px(evalScrambleToken(targetDim.width, targetDim.height));
  }, [isMobileFrame, targetDim]);

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

  // Chrome fills, threaded explicitly (not via utilities) so the simulated
  // rail/dock/header/tabbar can never lose their fill to a global override.
  // Under liquid glass the !important glass rules still win, like the app.
  const tokenRecord = containerTokens as unknown as Record<string, string>;
  const chromeSurface = tokenRecord['--surface'];
  const chromeSidebar = tokenRecord['--sidebar'] ?? chromeSurface;
  const chromeTabbar = `color-mix(in oklab, ${chromeSurface} 95%, transparent)`;

  const timerStates = [
    { id: 'idle' as const, label: t('appearance.stateIdle') },
    { id: 'inspection' as const, label: t('appearance.stateInspection') },
    { id: 'holding' as const, label: t('appearance.stateHolding') },
    { id: 'ready' as const, label: t('appearance.stateReady') },
    { id: 'running' as const, label: t('appearance.stateRunning') },
    { id: 'penalty' as const, label: t('appearance.statePenalty') },
  ];

  const scrambleElement = (
    <div
      data-glass-panel={storeScramblePanel ? 'true' : undefined}
      className={cn(
        'w-full transition-all duration-200',
        storeScramblePanel && 'rounded-xl border border-line bg-surface p-3 sm:p-3.5 shadow-2xs',
      )}
    >
      <ScrambleDisplay
        scramble={demoScramble}
        indexLabel={DEMO_SCRAMBLE_INDEX}
        isScrambled
        onRegenerate={() => {}}
        compact={isMobileFrame}
        layoutMode={storeScrambleLayoutMode}
        tokenSizePx={scrambleTokenPx}
      />
    </div>
  );

  return (
    <>
      {expanded && (
        <div
          className="fixed inset-0 z-60 bg-black/60 backdrop-blur-sm"
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
          ? 'fixed inset-0 z-61 h-auto max-h-none rounded-none border-0 bg-transparent shadow-none'
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
          aria-label={t('appearance.previewCollapse')}
          data-glass-float
          className="absolute top-3 right-3 z-10 flex size-9 items-center justify-center rounded-full border border-line bg-surface text-ink shadow-lg transition-colors hover:bg-surface-2"
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
      <div
        data-context-zone="preview-toolbar"
        className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-t-[inherit] border-b border-line bg-surface px-3.5 py-2.5"
      >
        {/* Expand (mobile "ver en grande") — Radix tooltip, never `title` */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setExpanded(true)}
              aria-label={t('appearance.previewExpand')}
              className="flex size-7 items-center justify-center rounded-md border border-line/60 bg-surface text-ink-2 transition-colors hover:text-ink hover:bg-surface-2 cursor-pointer"
            >
              <Maximize2 className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {t('appearance.previewExpand')}
          </TooltipContent>
        </Tooltip>
        {/* Device Switcher */}
        <div className="flex items-center gap-1 rounded-lg border border-line/50 bg-surface-2/60 p-0.5">
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
                      'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all cursor-pointer',
                      active
                        ? 'border border-line/60 bg-surface text-ink font-semibold shadow-xs'
                        : 'border border-transparent bg-transparent text-ink-3 hover:text-ink hover:bg-surface-2'
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

        {/* Puzzle Switcher (mocked demo data: 3×3 / 2×2) */}
        <div className="flex items-center gap-1 rounded-lg border border-line/50 bg-surface-2/60 p-0.5">
          {(['333', '222'] as PreviewPuzzle[]).map((p) => {
            const active = previewPuzzle === p;
            const label = p === '333' ? '3×3' : '2×2';
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPreviewPuzzle(p)}
                aria-label={label}
                aria-pressed={active}
                className={cn(
                  'rounded-md px-2.5 py-1 font-mono text-xs font-medium transition-all cursor-pointer',
                  active
                    ? 'border border-line/60 bg-surface text-ink font-semibold shadow-xs'
                    : 'border border-transparent bg-transparent text-ink-3 hover:text-ink hover:bg-surface-2'
                )}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Timer State Simulator */}
        <div className="flex items-center gap-1">
          <span className="mr-1 text-[0.7rem] font-medium text-ink-2 max-md:hidden">
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
                  'rounded-md px-2 py-1 text-[0.68rem] font-medium transition-all cursor-pointer',
                  active
                    ? 'border border-ink/40 bg-surface-2 text-ink font-semibold shadow-xs ring-1 ring-ink/20'
                    : 'border border-line/60 bg-surface-2/40 text-ink-3 hover:text-ink hover:bg-surface-2'
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
            width: scaledWidth,
            height: scaledHeight,
            boxSizing: 'content-box',
          }}
          className="relative isolate shrink-0 rounded-2xl shadow-2xl transition-all duration-300"
        >
          {/* Hardware-clipped inner screen container: clips all scaled GPU layers strictly to the frame radius */}
          <div
            style={{
              clipPath: 'inset(0 round 1rem)',
            }}
            className="absolute inset-0 overflow-hidden rounded-2xl bg-canvas"
          >
            {/* Scaled Virtual Screen */}
            <div
              data-testid="theme-preview-virtual"
              style={{
                width: targetDim.width,
                height: targetDim.height,
                transform: `scale(${exactScaleX}, ${exactScaleY})`,
                transformOrigin: 'top left',
                ...(containerTokens as unknown as React.CSSProperties),
                ...(effectiveLiquid
                  ? {
                      '--glass-opacity': `${effectiveLiquidOpacity / 100}`,
                      ...(storeLiquidBlur != null
                        ? { '--glass-blur': `${storeLiquidBlur}px` }
                        : {}),
                    }
                  : {}),
              }}
              className={cn(
                'absolute inset-0 flex flex-col overflow-visible bg-canvas text-ink backface-hidden',
                effectiveLiquid && 'liquid-glass'
              )}
              data-glass-panel={effectiveLiquid || undefined}
            >
              {/* Background Media inside preview */}
              {effectiveMediaUrl && (
                <div
                  className="pointer-events-none absolute -inset-6 z-0 overflow-hidden select-none"
                  style={{ opacity: (timerBackgroundOpacity ?? 100) / 100 }}
                >
                  {mediaType === 'video' ? (
                    <video
                      src={effectiveMediaUrl}
                      loop
                      muted
                      autoPlay={timerBackgroundAlwaysAnimate}
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

              {/* Content sits above the background media (absolute z-0). */}
              <div className="relative z-10 flex min-h-0 flex-1 flex-col">
              {isMobileFrame ? (
                <>
                  <PreviewMobileHeader
                    background={chromeSurface}
                    puzzleLabel={previewPuzzle === '222' ? '2×2' : '3×3'}
                  />
                  <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pt-4 pb-2">
                    {scrambleElement}
                    <div className="mt-1 flex min-h-0 flex-1 flex-col">
                      <PreviewTimer deviceMode={deviceMode} timerState={timerState} panel={storeTimerPanel} />
                    </div>
                    <PreviewBottom deviceMode={deviceMode} puzzle={previewPuzzle} />
                  </div>
                  <PreviewMobileTabBar background={chromeTabbar} />
                </>
              ) : (
                <div className="flex min-h-0 flex-1">
                  {/* 1. Left sidebar flush against left, top and bottom */}
                  <PreviewRail background={chromeSidebar} />
                  <div className="flex min-w-0 flex-1 flex-col">
                    {/* 2. Header strip spanning all the way from sidebar to right edge with bleed */}
                    <div className="relative -mt-6 -mr-6 flex h-22 w-[calc(100%+24px)] shrink-0 items-center justify-center pt-6 pr-6">
                      <PreviewDock
                        background={chromeSurface}
                        puzzleLabel={previewPuzzle === '222' ? '2×2' : '3×3'}
                        solveCount={demoSolves.length}
                      />
                    </div>
                    {/* 3. Stage content area */}
                    <div className="flex min-h-0 flex-1 flex-col gap-6 px-8 py-6">
                      {isRailPreview ? (
                        <div className="flex min-h-0 flex-1 gap-6">
                          <div className="flex min-w-0 min-h-0 flex-1 flex-col gap-4">
                            {scrambleElement}
                            <div className="mt-1 flex min-h-0 flex-1 flex-col">
                              <PreviewTimer deviceMode={deviceMode} timerState={timerState} panel={storeTimerPanel} />
                            </div>
                          </div>
                          <div className="flex w-64 shrink-0 flex-col overflow-y-auto">
                            <PreviewBottom deviceMode={deviceMode} vertical puzzle={previewPuzzle} className="h-full" />
                          </div>
                        </div>
                      ) : (
                        <>
                          {scrambleElement}
                          <div className="mt-1 flex min-h-0 flex-1 flex-col">
                            <PreviewTimer deviceMode={deviceMode} timerState={timerState} panel={storeTimerPanel} />
                          </div>
                          <PreviewBottom deviceMode={deviceMode} puzzle={previewPuzzle} />
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
              </div>
            </div>
          </div>

          {/* Physical Frame Border Overlay: sits at z-30 ABOVE the clipped virtual screen */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-30 rounded-2xl border border-line ring-1 ring-white/5"
          />
        </div>
      </div>
    </div>
    </>
  );
}
