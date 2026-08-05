'use client';

import { Clock, Mic, MicOff, Cpu, Headphones, Bluetooth, Keyboard } from 'lucide-react';
import { useStore } from 'zustand';
import { preferencesStore } from '@cubeforge/state';
import { SettingToggle } from '../components/SettingToggle';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * Timer settings section.
 *
 * Houses the preferences that drive the start-of-solve flow:
 *   - Input Mode             : 'timer' (normal hold-to-start) or 'manual' (type times directly).
 *   - Click to start/stop    : allow clicking the timer area to start/stop like spacebar.
 *   - Inspection             : run the 15s WCA inspection countdown before
 *                              the solve.
 *   - Inspection Audio Cues  : play voice alerts during inspection.
 *   - Voice Type             : male or female voice for the alerts.
 *   - Focus Mode             : hide UI elements during solve.
 *   - Hardware Timer         : Stackmat (audio jack) or GAN Timer (Bluetooth).
 */
export function TimerSection() {
  const inspection = useStore(preferencesStore, (s) => s.inspection);
  const setInspection = useStore(preferencesStore, (s) => s.setInspection);
  const focusMode = useStore(preferencesStore, (s) => s.focusMode);
  const setFocusMode = useStore(preferencesStore, (s) => s.setFocusMode);
  const audioCues = useStore(preferencesStore, (s) => s.audioCues);
  const setAudioCues = useStore(preferencesStore, (s) => s.setAudioCues);
  const voiceType = useStore(preferencesStore, (s) => s.voiceType);
  const setVoiceType = useStore(preferencesStore, (s) => s.setVoiceType);
  const showPbDelta = useStore(preferencesStore, (s) => s.showPbDelta);
  const setShowPbDelta = useStore(preferencesStore, (s) => s.setShowPbDelta);
  const hardwareTimer = useStore(preferencesStore, (s) => s.hardwareTimer);
  const setHardwareTimer = useStore(preferencesStore, (s) => s.setHardwareTimer);

  const spacebarHoldDelay = useStore(preferencesStore, (s) => s.spacebarHoldDelay);
  const setSpacebarHoldDelay = useStore(preferencesStore, (s) => s.setSpacebarHoldDelay);
  const inputMode = useStore(preferencesStore, (s) => s.inputMode);
  const setInputMode = useStore(preferencesStore, (s) => s.setInputMode);
  const clickToStart = useStore(preferencesStore, (s) => s.clickToStart);
  const setClickToStart = useStore(preferencesStore, (s) => s.setClickToStart);
  const showSessionStats = useStore(preferencesStore, (s) => s.showSessionStats);
  const setShowSessionStats = useStore(preferencesStore, (s) => s.setShowSessionStats);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3 rounded-xl border border-line/40 bg-surface-2/50 p-4">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-surface">
          <Clock className="size-4 text-ink-2" />
        </div>
        <p className="text-[0.82rem] text-ink-2">
          Configure how a solve should begin. These settings also apply
          when no Smart Cube is connected.
        </p>
      </div>

      {/* ── Input Mode: Timer vs Manual ──────────────────────────── */}
      <div className="group flex items-start justify-between gap-6 rounded-xl border border-line bg-surface p-5 transition-shadow duration-200 hover:shadow-sm">
        <div className="min-w-0 flex-1">
          <h4 className="flex items-center gap-2 text-[0.85rem] font-medium text-ink">
            <Keyboard className="size-3.5 text-ink-2" />
            Manual time entry
          </h4>
          <p className="mt-1.5 text-[0.78rem] leading-relaxed text-ink-3">
            Replace the timer with a text input to type times directly (like csTimer). Type "1450" or "14.50" to log a solve. Inspection and hold-to-start are bypassed.
          </p>
        </div>
        <div className="mt-0.5 shrink-0">
          <Select value={inputMode} onValueChange={(v) => setInputMode(v as 'timer' | 'manual')}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Input mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="timer">
                <div className="flex items-center gap-2">
                  <Clock className="size-3.5" />
                  <span>Timer (default)</span>
                </div>
              </SelectItem>
              <SelectItem value="manual">
                <div className="flex items-center gap-2">
                  <Keyboard className="size-3.5" />
                  <span>Manual entry</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Click to start/stop ───────────────────────────────────── */}
      <SettingToggle
        title="Click to start/stop"
        description="Allow clicking the timer area to start and stop the timer with the mouse, just like the spacebar. When off, only the spacebar controls the timer."
        checked={clickToStart}
        onCheckedChange={setClickToStart}
      />

      {/* ── Spacebar Hold Delay ────────────────────────────────────── */}
      <div className="group flex items-start justify-between gap-6 rounded-xl border border-line bg-surface p-5 transition-shadow duration-200 hover:shadow-sm">
        <div className="min-w-0 flex-1">
          <h4 className="flex items-center gap-2 text-[0.85rem] font-medium text-ink">
            Spacebar hold duration
          </h4>
          <p className="mt-1.5 text-[0.78rem] leading-relaxed text-ink-3">
            Amount of time required holding the spacebar down before the timer turns green and is ready to start.
          </p>
        </div>
        <div className="mt-0.5 shrink-0">
          <Select
            value={String(spacebarHoldDelay)}
            onValueChange={(val) => setSpacebarHoldDelay(Number(val))}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Select hold time" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">0 ms (Instant)</SelectItem>
              <SelectItem value="300">300 ms (Standard)</SelectItem>
              <SelectItem value="550">550 ms (WCA style)</SelectItem>
              <SelectItem value="1000">1000 ms (1 second)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Hardware Timer ─────────────────────────────────────────── */}
      <div className="group flex items-start justify-between gap-6 rounded-xl border border-line bg-surface p-5 transition-shadow duration-200 hover:shadow-sm">
        <div className="min-w-0 flex-1">
          <h4 className="flex items-center gap-2 text-[0.85rem] font-medium text-ink">
            <Cpu className="size-3.5 text-ink-2" />
            Hardware timer
          </h4>
          <p className="mt-1.5 text-[0.78rem] leading-relaxed text-ink-3">
            Use an external physical timer (Stackmat via audio jack or GAN Smart Timer via Bluetooth) instead of the space bar.
          </p>
          {hardwareTimer === 'stackmat' && (
            <p className="mt-1.5 text-[0.62rem] text-caution/70">
              Connect Stackmat via audio cable. Requires a USB sound card for best results. Enable microphone access when prompted.
            </p>
          )}
          {hardwareTimer === 'gan' && (
            <p className="mt-1.5 text-[0.62rem] text-caution/70">
              Connect GAN Smart Timer via Bluetooth. Make sure the timer is powered on and in pairing mode.
            </p>
          )}
        </div>
        <div className="mt-0.5 shrink-0">
          <Select value={hardwareTimer} onValueChange={(v) => setHardwareTimer(v as 'none' | 'stackmat' | 'gan')}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Select timer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">
                <div className="flex items-center gap-2">
                  <span>None (keyboard)</span>
                </div>
              </SelectItem>
              <SelectItem value="stackmat">
                <div className="flex items-center gap-2">
                  <Headphones className="size-3.5" />
                  <span>Stackmat</span>
                </div>
              </SelectItem>
              <SelectItem value="gan">
                <div className="flex items-center gap-2">
                  <Bluetooth className="size-3.5" />
                  <span>GAN Timer</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <SettingToggle
        title="Inspection"
        description="Show the 15-second WCA inspection countdown before the timer starts. Recommended for competition-style practice."
        checked={inspection}
        onCheckedChange={setInspection}
      />

      <SettingToggle
        title="Inspection audio cues"
        description="Play official voice alerts ('8 seconds' and '12 seconds') during the WCA inspection countdown."
        checked={audioCues}
        onCheckedChange={setAudioCues}
      />

      {/* Voice type selector — only visible when audio cues are enabled */}
      {audioCues && (
        <div className="group flex items-start justify-between gap-6 rounded-xl border border-line bg-surface p-5 transition-shadow duration-200 hover:shadow-sm">
          <div className="min-w-0 flex-1">
            <h4 className="flex items-center gap-2 text-[0.85rem] font-medium text-ink">
              {voiceType === 'male' ? (
                <Mic className="size-3.5 text-ink-2" />
              ) : (
                <MicOff className="size-3.5 text-ink-2" />
              )}
              Voice
            </h4>
            <p className="mt-1.5 text-[0.78rem] leading-relaxed text-ink-3">
              Choose between male and female voice for the inspection alerts.
              Uses the official WCA audio clips.
            </p>
          </div>
          <div className="mt-0.5 shrink-0">
            <Select value={voiceType} onValueChange={setVoiceType}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Select voice" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">
                  <div className="flex items-center gap-2">
                    <span>Male</span>
                  </div>
                </SelectItem>
                <SelectItem value="female">
                  <div className="flex items-center gap-2">
                    <span>Female</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <SettingToggle
        title="PB delta"
        description="Show a red or green offset next to the timer after each solve, indicating how far (+/-) the time is from your personal best."
        checked={showPbDelta}
        onCheckedChange={setShowPbDelta}
      />

      <SettingToggle
        title="Session stats"
        description="Show the compact session stats strip (Ao5, Ao12, Best, Mean) below the timer. Turn it off for a cleaner timer screen."
        checked={showSessionStats}
        onCheckedChange={setShowSessionStats}
      />

      <SettingToggle
        title="Focus mode"
        description="Hide all UI elements (scramble, stats, sidebar) when the timer is ready and running to eliminate distractions."
        checked={focusMode}
        onCheckedChange={setFocusMode}
      />
    </div>
  );
}
