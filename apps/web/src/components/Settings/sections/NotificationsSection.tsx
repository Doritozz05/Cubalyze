"use client";

import { Bell, BellOff, Volume2, CalendarClock, Repeat } from "lucide-react";
import { useStore } from "zustand";
import { preferencesStore } from "@cubeforge/state";
import { SettingToggle } from "../components/SettingToggle";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

/** Time input styled to match the app's input components. */
function TimeInput({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      id={id}
      type="time"
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-lg border border-line bg-surface-2/50 px-2.5 text-[0.78rem] font-mono text-ink outline-none transition-colors focus:border-ink/30 focus:bg-surface-2"
    />
  );
}

/**
 * Notifications settings section.
 *
 * Houses every notification channel:
 *   - Master switch (disables everything below).
 *   - Sounds on/off + master volume (inspection voice cues & PB fanfare).
 *   - PB celebrations (audio + banner) — moved here from the Timer tab.
 *   - Daily practice reminder.
 *   - Daily SRS review-queue reminder.
 */
export function NotificationsSection() {
  const notificationsEnabled = useStore(preferencesStore, (s) => s.notificationsEnabled);
  const setNotificationsEnabled = useStore(preferencesStore, (s) => s.setNotificationsEnabled);
  const soundsEnabled = useStore(preferencesStore, (s) => s.soundsEnabled);
  const setSoundsEnabled = useStore(preferencesStore, (s) => s.setSoundsEnabled);
  const soundVolume = useStore(preferencesStore, (s) => s.soundVolume);
  const setSoundVolume = useStore(preferencesStore, (s) => s.setSoundVolume);

  const pbCelebrationAudio = useStore(preferencesStore, (s) => s.pbCelebrationAudio);
  const setPbCelebrationAudio = useStore(preferencesStore, (s) => s.setPbCelebrationAudio);
  const pbCelebrationAnimation = useStore(preferencesStore, (s) => s.pbCelebrationAnimation);
  const setPbCelebrationAnimation = useStore(preferencesStore, (s) => s.setPbCelebrationAnimation);

  const practiceReminders = useStore(preferencesStore, (s) => s.practiceReminders);
  const setPracticeReminders = useStore(preferencesStore, (s) => s.setPracticeReminders);
  const practiceReminderTime = useStore(preferencesStore, (s) => s.practiceReminderTime);
  const setPracticeReminderTime = useStore(preferencesStore, (s) => s.setPracticeReminderTime);

  const reviewReminders = useStore(preferencesStore, (s) => s.reviewReminders);
  const setReviewReminders = useStore(preferencesStore, (s) => s.setReviewReminders);
  const reviewReminderTime = useStore(preferencesStore, (s) => s.reviewReminderTime);
  const setReviewReminderTime = useStore(preferencesStore, (s) => s.setReviewReminderTime);

  const MasterIcon = notificationsEnabled ? Bell : BellOff;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3 rounded-xl border border-line/40 bg-surface-2/50 p-4">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-surface">
          <MasterIcon className="size-4 text-ink-2" />
        </div>
        <p className="text-[0.82rem] text-ink-2">
          Control every alert, sound and daily reminder the app can send.
        </p>
      </div>

      {/* ── Master switch ─────────────────────────────────────────────── */}
      <SettingToggle
        title="Notifications"
        description="Master switch. When off, every notification below is suppressed — no sounds, no banners, no daily reminders."
        checked={notificationsEnabled}
        onCheckedChange={setNotificationsEnabled}
      />

      <div className={cn("flex flex-col gap-5", !notificationsEnabled && "pointer-events-none opacity-45")}>
        {/* ── Sounds ─────────────────────────────────────────────────── */}
        <SettingToggle
          title="Sounds"
          description="Play sound effects — inspection voice cues ('8 seconds' / '12 seconds') and the PB victory fanfare."
          checked={soundsEnabled}
          onCheckedChange={setSoundsEnabled}
        />

        <div className="group flex items-start justify-between gap-6 rounded-xl border border-line bg-surface p-5 transition-shadow duration-200 hover:shadow-sm">
          <div className="min-w-0 flex-1">
            <h4 className="flex items-center gap-2 text-[0.85rem] font-medium text-ink">
              <Volume2 className="size-3.5 text-ink-2" />
              Volume
            </h4>
            <p className="mt-1.5 text-[0.78rem] leading-relaxed text-ink-3">
              Master volume for inspection voice cues and the PB fanfare (0–100%).
            </p>
          </div>
          <div className="mt-1 flex w-48 shrink-0 items-center gap-3">
            <Slider
              min={0}
              max={100}
              step={5}
              value={[soundVolume]}
              onValueChange={(val) => val[0] !== undefined && setSoundVolume(val[0])}
              className="flex-1"
            />
            <span className="nums w-9 text-right text-[0.72rem] text-ink-2">
              {soundVolume}%
            </span>
          </div>
        </div>

        <SettingToggle
          title="PB victory sound"
          description="Play a subtle victory fanfare when achieving a new Personal Best (Single, Ao5, Ao12)."
          checked={pbCelebrationAudio}
          onCheckedChange={setPbCelebrationAudio}
        />

        <SettingToggle
          title="PB celebration banner"
          description="Display a minimalist floating banner upon setting a new Personal Best."
          checked={pbCelebrationAnimation}
          onCheckedChange={setPbCelebrationAnimation}
        />

        {/* ── Practice reminder ──────────────────────────────────────── */}
        <div className="group flex items-start justify-between gap-6 rounded-xl border border-line bg-surface p-5 transition-shadow duration-200 hover:shadow-sm">
          <div className="min-w-0 flex-1">
            <h4 className="flex items-center gap-2 text-[0.85rem] font-medium text-ink">
              <CalendarClock className="size-3.5 text-ink-2" />
              Daily practice reminder
            </h4>
            <p className="mt-1.5 text-[0.78rem] leading-relaxed text-ink-3">
              Get a gentle nudge at a set time each day to practice. Shows a browser
              notification (if allowed) and an in-app toast.
            </p>
          </div>
          <div className="mt-0.5 flex shrink-0 items-center gap-3">
            {practiceReminders && (
              <TimeInput
                id="practice-reminder-time"
                label="Practice reminder time"
                value={practiceReminderTime}
                onChange={setPracticeReminderTime}
              />
            )}
            <Switch
              checked={practiceReminders}
              onCheckedChange={setPracticeReminders}
              aria-label="Daily practice reminder"
              className="mt-0.5 shrink-0"
            />
          </div>
        </div>

        {/* ── Review reminder ────────────────────────────────────────── */}
        <div className="group flex items-start justify-between gap-6 rounded-xl border border-line bg-surface p-5 transition-shadow duration-200 hover:shadow-sm">
          <div className="min-w-0 flex-1">
            <h4 className="flex items-center gap-2 text-[0.85rem] font-medium text-ink">
              <Repeat className="size-3.5 text-ink-2" />
              Daily review reminder
            </h4>
            <p className="mt-1.5 text-[0.78rem] leading-relaxed text-ink-3">
              Remind yourself to clear the SRS review queue (OLL/PLL/F2L flashcards)
              at a set time each day.
            </p>
          </div>
          <div className="mt-0.5 flex shrink-0 items-center gap-3">
            {reviewReminders && (
              <TimeInput
                id="review-reminder-time"
                label="Review reminder time"
                value={reviewReminderTime}
                onChange={setReviewReminderTime}
              />
            )}
            <Switch
              checked={reviewReminders}
              onCheckedChange={setReviewReminders}
              aria-label="Daily review reminder"
              className="mt-0.5 shrink-0"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
