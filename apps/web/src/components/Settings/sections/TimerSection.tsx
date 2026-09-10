'use client';

import { useState } from 'react';
import { Clock, Cpu, Headphones, Bluetooth, Keyboard, LayoutTemplate, ArrowUpRight } from 'lucide-react';
import { useStore } from 'zustand';
import { useTranslation } from 'react-i18next';
import { preferencesStore } from '@cubeforge/state';
import { SettingToggle } from '../components/SettingToggle';
import { SettingRow } from '../components/SettingRow';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ThemeStudioModal } from '@/components/Settings/theme-studio/ThemeStudioModal';
import { getSlotTemplate } from '@/bottom-layout/slot-templates';

/**
 * Timer settings section.
 *
 * Houses the preferences that drive the start-of-solve flow:
 *   - Input Mode             : 'timer' (normal hold-to-start) or 'manual' (type times directly).
 *   - Click to start/stop    : allow clicking the timer area to start/stop like spacebar.
 *   - Inspection             : run the 15s WCA inspection countdown before
 *                              the solve.
 *   - Focus Mode             : hide UI elements during solve.
 *   - Hardware Timer         : Stackmat (audio jack) or GAN Timer (Bluetooth).
 */
export function TimerSection() {
  const { t } = useTranslation('settings');
  const inspection = useStore(preferencesStore, (s) => s.inspection);
  const setInspection = useStore(preferencesStore, (s) => s.setInspection);
  const focusMode = useStore(preferencesStore, (s) => s.focusMode);
  const setFocusMode = useStore(preferencesStore, (s) => s.setFocusMode);
  const showPbDelta = useStore(preferencesStore, (s) => s.showPbDelta);
  const setShowPbDelta = useStore(preferencesStore, (s) => s.setShowPbDelta);
  const hardwareTimer = useStore(preferencesStore, (s) => s.hardwareTimer);
  const setHardwareTimer = useStore(preferencesStore, (s) => s.setHardwareTimer);

  const timePrecision = useStore(preferencesStore, (s) => s.timePrecision);
  const setTimePrecision = useStore(preferencesStore, (s) => s.setTimePrecision);
  const spacebarHoldDelay = useStore(preferencesStore, (s) => s.spacebarHoldDelay);
  const setSpacebarHoldDelay = useStore(preferencesStore, (s) => s.setSpacebarHoldDelay);
  const inputMode = useStore(preferencesStore, (s) => s.inputMode);
  const setInputMode = useStore(preferencesStore, (s) => s.setInputMode);
  const clickToStart = useStore(preferencesStore, (s) => s.clickToStart);
  const setClickToStart = useStore(preferencesStore, (s) => s.setClickToStart);
  const bottomLayoutTemplate = useStore(preferencesStore, (s) => s.bottomLayoutTemplate);
  const showHints = useStore(preferencesStore, (s) => s.showHints);
  const setShowHints = useStore(preferencesStore, (s) => s.setShowHints);
  const [layoutStudioOpen, setLayoutStudioOpen] = useState(false);
  const { t: tTimer } = useTranslation('timer');

  const currentSlot = getSlotTemplate(bottomLayoutTemplate);
  const currentName = currentSlot
    ? tTimer(currentSlot.nameKey as never, { defaultValue: currentSlot.id })
    : bottomLayoutTemplate;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3 rounded-xl border border-line/40 bg-surface-2/50 p-4">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-surface">
          <Clock className="size-4 text-ink-2" />
        </div>
        <p className="text-[0.82rem] leading-5 text-ink-2">{t('timer.header')}</p>
      </div>

      {/* ── Input Mode: Timer vs Manual ──────────────────────────── */}
      <SettingRow
        title={
          <>
            <Keyboard className="size-3.5 text-ink-2" />
            {t('timer.manualEntry')}
          </>
        }
        description={t('timer.manualEntryHint')}
        control={
          <Select value={inputMode} onValueChange={(v) => setInputMode(v as 'timer' | 'manual')}>
            <SelectTrigger className="w-44 max-lg:w-full">
              <SelectValue placeholder={t('timer.inputModePlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="timer">
                <div className="flex items-center gap-2">
                  <Clock className="size-3.5" />
                  <span>{t('timer.timerDefault')}</span>
                </div>
              </SelectItem>
              <SelectItem value="manual">
                <div className="flex items-center gap-2">
                  <Keyboard className="size-3.5" />
                  <span>{t('timer.manualEntryOption')}</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        }
      />

      {/* ── Time Precision: Centiseconds vs Milliseconds ────────── */}
      <SettingRow
        title={
          <>
            <Clock className="size-3.5 text-ink-2" />
            {t('timer.timePrecision')}
          </>
        }
        description={t('timer.timePrecisionHint')}
        control={
          <Select
            value={timePrecision}
            onValueChange={(val) => setTimePrecision(val as 'centiseconds' | 'milliseconds')}
          >
            <SelectTrigger className="w-44 max-lg:w-full">
              <SelectValue placeholder={t('timer.selectPrecision')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="centiseconds">{t('timer.centiseconds')}</SelectItem>
              <SelectItem value="milliseconds">{t('timer.milliseconds')}</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      {/* ── Click to start/stop ───────────────────────────────────── */}
      <SettingToggle
        title={t('timer.clickToStart')}
        description={t('timer.clickToStartHint')}
        checked={clickToStart}
        onCheckedChange={setClickToStart}
      />

      {/* ── Spacebar Hold Delay ────────────────────────────────────── */}
      <SettingRow
        title={t('timer.holdDuration')}
        description={t('timer.holdDurationHint')}
        control={
          <Select
            value={String(spacebarHoldDelay)}
            onValueChange={(val) => setSpacebarHoldDelay(Number(val))}
          >
            <SelectTrigger className="w-44 max-lg:w-full">
              <SelectValue placeholder={t('timer.selectHoldTime')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">{t('timer.holdInstant')}</SelectItem>
              <SelectItem value="300">{t('timer.holdStandard')}</SelectItem>
              <SelectItem value="550">{t('timer.holdWca')}</SelectItem>
              <SelectItem value="1000">{t('timer.holdSecond')}</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      {/* ── Hardware Timer ─────────────────────────────────────────── */}
      <SettingRow
        title={
          <>
            <Cpu className="size-3.5 text-ink-2" />
            {t('timer.hardwareTimer')}
          </>
        }
        description={t('timer.hardwareTimerHint')}
        extraHint={
          <>
            {hardwareTimer === 'stackmat' && (
              <p className="mt-1.5 text-[0.62rem] text-caution/70">
                {t('timer.stackmatHint')}
              </p>
            )}
            {hardwareTimer === 'gan' && (
              <p className="mt-1.5 text-[0.62rem] text-caution/70">
                {t('timer.ganHint')}
              </p>
            )}
          </>
        }
        control={
          <Select value={hardwareTimer} onValueChange={(v) => setHardwareTimer(v as 'none' | 'stackmat' | 'gan')}>
            <SelectTrigger className="w-44 max-lg:w-full">
              <SelectValue placeholder={t('timer.selectTimer')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">
                <div className="flex items-center gap-2">
                  <span>{t('timer.noneKeyboard')}</span>
                </div>
              </SelectItem>
              <SelectItem value="stackmat">
                <div className="flex items-center gap-2">
                  <Headphones className="size-3.5" />
                  <span>{t('timer.stackmat')}</span>
                </div>
              </SelectItem>
              <SelectItem value="gan">
                <div className="flex items-center gap-2">
                  <Bluetooth className="size-3.5" />
                  <span>{t('timer.gan')}</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        }
      />

      <SettingToggle
        title={t('timer.inspection')}
        description={t('timer.inspectionHint')}
        checked={inspection}
        onCheckedChange={setInspection}
      />

      <SettingToggle
        title={t('timer.pbDelta')}
        description={t('timer.pbDeltaHint')}
        checked={showPbDelta}
        onCheckedChange={setShowPbDelta}
      />

      {/* Bottom layout lives in Theme Studio (live preview). This row is
          only a deep link — toggles moved to the studio Layout tab. */}
      <SettingRow
        title={
          <>
            <LayoutTemplate className="size-3.5 text-ink-2" />
            {t('timer.bottomLayoutTemplate')}
          </>
        }
        description={`${t('timer.bottomLayoutTemplateHint')} — ${currentName}`}
        control={
          <Button
            variant="outline"
            className="w-44 gap-1.5 max-lg:w-full"
            onClick={() => setLayoutStudioOpen(true)}
          >
            <span>{tTimer('slotCustomize', { defaultValue: 'Personalizar' })}</span>
            <ArrowUpRight className="size-3.5" />
          </Button>
        }
      />
      <ThemeStudioModal
        open={layoutStudioOpen}
        onOpenChange={setLayoutStudioOpen}
        initialTab="layout"
      />

      <SettingToggle
        title={t('timer.showHints')}
        description={t('timer.showHintsHint')}
        checked={showHints}
        onCheckedChange={setShowHints}
      />

      <SettingToggle
        title={t('timer.focusMode')}
        description={t('timer.focusModeHint')}
        checked={focusMode}
        onCheckedChange={setFocusMode}
      />
    </div>
  );
}
