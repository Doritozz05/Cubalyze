'use client';

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquare, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TimerDisplay } from '@/components/Timer/TimerDisplay';
import type { HintContext } from '@/components/Timer/hintFor';
import type { TimerState } from '@/types';
import type { DeviceMode, TimerPreviewState } from '../ScaledTimerPreview';
import { evalDelta, evalTimerDigits, evalTimerMinH, px } from './evalViewport';
import {
  DEMO_INSPECTION_REMAINING_MS,
  DEMO_LAST_TIME_MS,
  DEMO_PB_MS,
  DEMO_PENALTY_LAST_MS,
  DEMO_RUNNING_MS,
} from './demoData';

const VIRTUAL_SIZE: Record<DeviceMode, { w: number; h: number }> = {
  mobile: { w: 390, h: 780 },
  tablet: { w: 768, h: 680 },
  desktop: { w: 1080, h: 680 },
};

const HALO: Partial<Record<TimerState, string>> = {
  ready: 'bg-ready-soft/60',
  holding: 'bg-hold-soft/40',
  ready_for_move: 'bg-ready-soft/40',
  inspection: 'bg-caution-soft/30',
};

interface PreviewTimerProps {
  deviceMode: DeviceMode;
  timerState: TimerPreviewState;
}

function resolveFace(timerState: TimerPreviewState): {
  state: TimerState;
  displayTime: number;
  hasLast: boolean;
  lastSolvePenalty?: string;
} {
  switch (timerState) {
    case 'inspection':
      return { state: 'inspection', displayTime: DEMO_INSPECTION_REMAINING_MS, hasLast: true };
    case 'holding':
      return { state: 'holding', displayTime: 0, hasLast: true };
    case 'ready':
      return { state: 'ready', displayTime: 0, hasLast: true };
    case 'running':
      return { state: 'running', displayTime: DEMO_RUNNING_MS, hasLast: true };
    case 'penalty':
      return {
        state: 'stopped',
        displayTime: DEMO_PENALTY_LAST_MS,
        hasLast: true,
        lastSolvePenalty: '+2',
      };
    case 'idle':
    default:
      return { state: 'idle', displayTime: DEMO_LAST_TIME_MS, hasLast: true };
  }
}

/**
 * Live timer face for the preview: the REAL `TimerDisplay` (colors, scales,
 * PB delta, real `hintFor` copy) inside the REAL `TimerContainer` surface
 * geometry, with viewport units evaluated against the virtual device.
 */
export function PreviewTimer({ deviceMode, timerState }: PreviewTimerProps) {
  const { t } = useTranslation('timer');
  const isMobile = deviceMode === 'mobile';
  const { w, h } = VIRTUAL_SIZE[deviceMode];
  const face = resolveFace(timerState);

  const hintCtx: HintContext = useMemo(
    () => ({
      smartCube: false,
      scrambleVerif: false,
      inspection: true,
      isScrambled: true,
      coarsePointer: isMobile,
      startKeyLabel: t('key.space'),
    }),
    [isMobile, t],
  );

  const digitsPx = px(evalTimerDigits(w, h));
  const deltaPx = px(evalDelta(w));
  const minH = px(
    evalTimerMinH(h, isMobile ? 'phone' : deviceMode === 'tablet' ? 'coarse-tablet' : 'desktop'),
  );
  const halo = HALO[face.state];

  return (
    <div
      className="group relative flex w-full flex-1 touch-manipulation select-none flex-col items-center justify-center rounded-lg transition-all duration-300"
      style={{ minHeight: minH }}
      role="button"
      aria-label={t('timerAriaSpace')}
    >
      {halo && <div aria-hidden="true" className={cn('absolute inset-0 rounded-lg', halo)} />}
      <TimerDisplay
        state={face.state}
        displayTime={face.displayTime}
        hasLast={face.hasLast}
        pb={DEMO_PB_MS}
        showPbDelta
        hintCtx={
          face.lastSolvePenalty
            ? { ...hintCtx, lastSolvePenalty: face.lastSolvePenalty }
            : hintCtx
        }
        fontSizePx={digitsPx}
        deltaFontSizePx={deltaPx}
      />

      {timerState === 'penalty' && (
        <div
          aria-hidden="true"
          className={cn(
            'z-10 mt-3 flex gap-1 rounded-full border border-line bg-surface px-1.5 py-1 shadow-2xs',
            isMobile ? 'px-2.5 py-1.5' : 'max-lg:px-2.5 max-lg:py-1.5',
          )}
        >
          {['+2', 'DNF'].map((label) => {
            const active = label === '+2';
            return (
              <div
                key={label}
                tabIndex={-1}
                className={cn(
                  'flex items-center justify-center rounded-full font-medium',
                  isMobile ? 'h-10 px-4 text-sm' : 'h-6 px-2.5 text-[0.72rem] max-lg:h-10 max-lg:px-4 max-lg:text-sm',
                  active
                    ? 'bg-plus2-soft text-plus2 ring-1 ring-plus2/30'
                    : 'text-ink-3',
                )}
              >
                {label}
              </div>
            );
          })}
          <div
            tabIndex={-1}
            className={cn(
              'flex items-center justify-center rounded-full text-ink-3',
              isMobile ? 'h-10 px-4' : 'h-6 px-2.5 max-lg:h-10 max-lg:px-4',
            )}
          >
            <MessageSquare className={isMobile ? 'size-4' : 'size-3.5 max-lg:size-4'} />
          </div>
          <div
            tabIndex={-1}
            className={cn(
              'flex items-center justify-center rounded-full text-ink-3',
              isMobile ? 'h-10 px-4' : 'h-6 px-2.5 max-lg:h-10 max-lg:px-4',
            )}
          >
            <Trash2 className={isMobile ? 'size-4' : 'size-3.5 max-lg:size-4'} />
          </div>
        </div>
      )}
    </div>
  );
}
