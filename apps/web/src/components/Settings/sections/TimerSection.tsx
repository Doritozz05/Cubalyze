'use client';

import { Clock, Cpu, Headphones, Bluetooth, Keyboard, LayoutTemplate } from 'lucide-react';
import { useStore } from 'zustand';
import { useTranslation } from 'react-i18next';
import { preferencesStore } from '@cubeforge/state';
import { SettingToggle } from '../components/SettingToggle';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BOTTOM_LAYOUT_TEMPLATES } from '@/bottom-layout/registry';

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
  const showBottomLayout = useStore(preferencesStore, (s) => s.showBottomLayout);
  const setShowBottomLayout = useStore(preferencesStore, (s) => s.setShowBottomLayout);
  const bottomLayoutTemplate = useStore(preferencesStore, (s) => s.bottomLayoutTemplate);
  const setBottomLayoutTemplate = useStore(preferencesStore, (s) => s.setBottomLayoutTemplate);
  const showBpaWpa = useStore(preferencesStore, (s) => s.showBpaWpa);
  const setShowBpaWpa = useStore(preferencesStore, (s) => s.setShowBpaWpa);
  const showHints = useStore(preferencesStore, (s) => s.showHints);
  const setShowHints = useStore(preferencesStore, (s) => s.setShowHints);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3 rounded-xl border border-line/40 bg-surface-2/50 p-4">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-surface">
          <Clock className="size-4 text-ink-2" />
        </div>
        <p className="text-[0.82rem] leading-5 text-ink-2">{t('timer.header')}</p>
      </div>

      {/* ── Input Mode: Timer vs Manual ──────────────────────────── */}
      <div className="group flex items-start justify-between gap-6 rounded-xl border border-line bg-surface p-5 transition-shadow duration-200 hover:shadow-sm">
        <div className="min-w-0 flex-1">
          <h4 className="flex items-center gap-2 text-[0.85rem] font-medium leading-5 text-ink">
            <Keyboard className="size-3.5 text-ink-2" />
            {t('timer.manualEntry')}
          </h4>
          <p className="mt-1.5 text-[0.78rem] leading-5 text-ink-3">
            {t('timer.manualEntryHint')}
          </p>
        </div>
        <div className="mt-0.5 shrink-0">
          <Select value={inputMode} onValueChange={(v) => setInputMode(v as 'timer' | 'manual')}>
            <SelectTrigger className="w-44">
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
        </div>
      </div>

      {/* ── Time Precision: Centiseconds vs Milliseconds ────────── */}
      <div className="group flex items-start justify-between gap-6 rounded-xl border border-line bg-surface p-5 transition-shadow duration-200 hover:shadow-sm">
        <div className="min-w-0 flex-1">
          <h4 className="flex items-center gap-2 text-[0.85rem] font-medium leading-5 text-ink">
            <Clock className="size-3.5 text-ink-2" />
            {t('timer.timePrecision')}
          </h4>
          <p className="mt-1.5 text-[0.78rem] leading-5 text-ink-3">
            {t('timer.timePrecisionHint')}
          </p>
        </div>
        <div className="mt-0.5 shrink-0">
          <Select
            value={timePrecision}
            onValueChange={(val) => setTimePrecision(val as 'centiseconds' | 'milliseconds')}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder={t('timer.selectPrecision')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="centiseconds">{t('timer.centiseconds')}</SelectItem>
              <SelectItem value="milliseconds">{t('timer.milliseconds')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Click to start/stop ───────────────────────────────────── */}
      <SettingToggle
        title={t('timer.clickToStart')}
        description={t('timer.clickToStartHint')}
        checked={clickToStart}
        onCheckedChange={setClickToStart}
      />

      {/* ── Spacebar Hold Delay ────────────────────────────────────── */}
      <div className="group flex items-start justify-between gap-6 rounded-xl border border-line bg-surface p-5 transition-shadow duration-200 hover:shadow-sm">
        <div className="min-w-0 flex-1">
          <h4 className="flex items-center gap-2 text-[0.85rem] font-medium leading-5 text-ink">
            {t('timer.holdDuration')}
          </h4>
          <p className="mt-1.5 text-[0.78rem] leading-5 text-ink-3">
            {t('timer.holdDurationHint')}
          </p>
        </div>
        <div className="mt-0.5 shrink-0">
          <Select
            value={String(spacebarHoldDelay)}
            onValueChange={(val) => setSpacebarHoldDelay(Number(val))}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder={t('timer.selectHoldTime')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">{t('timer.holdInstant')}</SelectItem>
              <SelectItem value="300">{t('timer.holdStandard')}</SelectItem>
              <SelectItem value="550">{t('timer.holdWca')}</SelectItem>
              <SelectItem value="1000">{t('timer.holdSecond')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Hardware Timer ─────────────────────────────────────────── */}
      <div className="group flex items-start justify-between gap-6 rounded-xl border border-line bg-surface p-5 transition-shadow duration-200 hover:shadow-sm">
        <div className="min-w-0 flex-1">
          <h4 className="flex items-center gap-2 text-[0.85rem] font-medium leading-5 text-ink">
            <Cpu className="size-3.5 text-ink-2" />
            {t('timer.hardwareTimer')}
          </h4>
          <p className="mt-1.5 text-[0.78rem] leading-5 text-ink-3">
            {t('timer.hardwareTimerHint')}
          </p>
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
        </div>
        <div className="mt-0.5 shrink-0">
          <Select value={hardwareTimer} onValueChange={(v) => setHardwareTimer(v as 'none' | 'stackmat' | 'gan')}>
            <SelectTrigger className="w-44">
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
        </div>
      </div>

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

      <SettingToggle
        title={t('timer.showBottomLayout')}
        description={t('timer.showBottomLayoutHint')}
        checked={showBottomLayout}
        onCheckedChange={setShowBottomLayout}
      />

      {showBottomLayout && (
        <div className="group flex items-start justify-between gap-6 rounded-xl border border-line bg-surface p-5 transition-shadow duration-200 hover:shadow-sm">
          <div className="min-w-0 flex-1">
            <h4 className="flex items-center gap-2 text-[0.85rem] font-medium leading-5 text-ink">
              <LayoutTemplate className="size-3.5 text-ink-2" />
              {t('timer.bottomLayoutTemplate')}
            </h4>
            <p className="mt-1.5 text-[0.78rem] leading-5 text-ink-3">
              {t('timer.bottomLayoutTemplateHint')}
            </p>
          </div>
          <div className="mt-0.5 shrink-0">
            <Select value={bottomLayoutTemplate} onValueChange={setBottomLayoutTemplate}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder={t('timer.selectBottomLayoutTemplate')} />
              </SelectTrigger>
              <SelectContent>
                {BOTTOM_LAYOUT_TEMPLATES.map((tpl) => (
                  <SelectItem key={tpl.id} value={tpl.id}>
                    {t(tpl.nameKey as never)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <SettingToggle
        title={t('timer.bpaWpa')}
        description={t('timer.bpaWpaHint')}
        checked={showBpaWpa}
        onCheckedChange={setShowBpaWpa}
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
