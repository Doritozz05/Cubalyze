"use client";

import { Bell, BellOff, CalendarClock, Repeat } from "lucide-react";
import { useStore } from "zustand";
import { useTranslation } from "react-i18next";
import { preferencesStore } from "@cubalyze/state";
import { SettingToggle } from "../components/SettingToggle";
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
 * Notifications settings section — non-audio channels only (sound lives in
 * the Audio section):
 *   - Master switch (disables everything below).
 *   - PB celebration banner (the audio moved to Audio).
 *   - Daily practice reminder.
 *   - Daily SRS review-queue reminder.
 */
export function NotificationsSection() {
  const { t } = useTranslation("settings");

  const notificationsEnabled = useStore(preferencesStore, (s) => s.notificationsEnabled);
  const setNotificationsEnabled = useStore(preferencesStore, (s) => s.setNotificationsEnabled);
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
        <p className="text-[0.82rem] leading-5 text-ink-2">
          {t("notifications.info")}
        </p>
      </div>

      {/* ── Master switch ─────────────────────────────────────────────── */}
      <SettingToggle
        title={t("notifications.master")}
        description={t("notifications.masterHint")}
        checked={notificationsEnabled}
        onCheckedChange={setNotificationsEnabled}
      />

      <div className={cn("flex flex-col gap-5", !notificationsEnabled && "pointer-events-none opacity-45")}>
        {/* ── PB celebration banner (audio lives in the Audio section) ── */}
        <SettingToggle
          title={t("notifications.pbBanner")}
          description={t("notifications.pbBannerHint")}
          checked={pbCelebrationAnimation}
          onCheckedChange={setPbCelebrationAnimation}
        />

        {/* ── Practice reminder ──────────────────────────────────────── */}
        <div className="group flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 sm:gap-6 rounded-xl border border-line bg-surface p-5 transition-shadow duration-200 hover:shadow-sm">
          <div className="min-w-0 flex-1">
            <h4 className="flex items-center gap-2 text-[0.85rem] font-medium leading-5 text-ink">
              <CalendarClock className="size-3.5 text-ink-2" />
              {t("notifications.practiceReminder")}
            </h4>
            <p className="mt-1.5 text-[0.78rem] leading-5 text-ink-3">
              {t("notifications.practiceReminderHint")}
            </p>
          </div>
          <div className="flex h-5 shrink-0 items-center gap-3">
            {practiceReminders && (
              <TimeInput
                id="practice-reminder-time"
                label={t("notifications.practiceTime")}
                value={practiceReminderTime}
                onChange={setPracticeReminderTime}
              />
            )}
            <Switch
              checked={practiceReminders}
              onCheckedChange={setPracticeReminders}
              aria-label={t("notifications.practiceReminder")}
            />
          </div>
        </div>

        {/* ── Review reminder ────────────────────────────────────────── */}
        <div className="group flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 sm:gap-6 rounded-xl border border-line bg-surface p-5 transition-shadow duration-200 hover:shadow-sm">
          <div className="min-w-0 flex-1">
            <h4 className="flex items-center gap-2 text-[0.85rem] font-medium leading-5 text-ink">
              <Repeat className="size-3.5 text-ink-2" />
              {t("notifications.reviewReminder")}
            </h4>
            <p className="mt-1.5 text-[0.78rem] leading-5 text-ink-3">
              {t("notifications.reviewReminderHint")}
            </p>
          </div>
          <div className="flex h-5 shrink-0 items-center gap-3">
            {reviewReminders && (
              <TimeInput
                id="review-reminder-time"
                label={t("notifications.reviewTime")}
                value={reviewReminderTime}
                onChange={setReviewReminderTime}
              />
            )}
            <Switch
              checked={reviewReminders}
              onCheckedChange={setReviewReminders}
              aria-label={t("notifications.reviewReminder")}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
