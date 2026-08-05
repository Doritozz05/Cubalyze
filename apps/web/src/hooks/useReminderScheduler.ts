"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { preferencesStore } from "@cubeforge/state";

/**
 * Daily reminder scheduler.
 *
 * Reads the notification preferences (Settings → Notifications) and fires the
 * practice / review reminders once per day at their configured HH:MM times.
 * Delivery is a browser Notification when permission is granted, otherwise an
 * in-app sonner toast (which always works). The whole feature is gated by the
 * master `notificationsEnabled` switch and the per-reminder toggles.
 *
 * Fired-day tracking lives in a module-level Set keyed by `YYYY-MM-DD:type`
 * so reminders only fire once per day per type per page session — combined
 * with the minute-level check this is good enough for a local-first app.
 */

type ReminderType = "practice" | "review";

const FIRED_KEY = "cubeforge:reminders-fired";

function readFired(): Set<string> {
  try {
    const raw = window.localStorage.getItem(FIRED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeFired(fired: Set<string>): void {
  try {
    window.localStorage.setItem(FIRED_KEY, JSON.stringify([...fired]));
  } catch {
    // Ignore storage failures (private mode etc.) — reminders still toast.
  }
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Compare the current clock time (HH:MM) against the preference. */
function isAtTime(hhmm: string, now: Date): boolean {
  if (!/^\d{2}:\d{2}$/.test(hhmm)) return false;
  const [h, m] = hhmm.split(":").map(Number);
  return now.getHours() === h && now.getMinutes() === m;
}

function notify(title: string, body: string, silent: boolean): void {
  // In-app toast always shows (the reliable channel).
  toast(title, { description: body });

  if (
    typeof window !== "undefined" &&
    "Notification" in window &&
    window.Notification.permission === "granted"
  ) {
    try {
      new window.Notification(title, { body, silent });
    } catch {
      // Some environments (older Safari) throw on `new Notification` — ignore.
    }
  }
}

export function useReminderScheduler(): void {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Ask for notification permission once, only when reminders are possible.
    const prefs = preferencesStore.getState();
    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      prefs.notificationsEnabled &&
      (prefs.practiceReminders || prefs.reviewReminders) &&
      window.Notification.permission === "default"
    ) {
      void window.Notification.requestPermission();
    }

    const tick = () => {
      const p = preferencesStore.getState();
      if (!p.notificationsEnabled) return;

      const now = new Date();
      const day = todayKey();
      const fired = readFired();

      const maybeFire = (type: ReminderType, enabled: boolean, time: string) => {
        if (!enabled) return;
        if (!isAtTime(time, now)) return;
        const key = `${day}:${type}`;
        if (fired.has(key)) return;
        fired.add(key);
        writeFired(fired);

        if (type === "practice") {
          notify(
            "Time to practice!",
            "Your daily practice session reminder. A few solves keep the flow alive.",
            false,
          );
        } else {
          notify(
            "Review queue waiting",
            "Your SRS flashcards are ready — knock out today's algorithm review.",
            false,
          );
        }
      };

      maybeFire("practice", p.practiceReminders, p.practiceReminderTime);
      maybeFire("review", p.reviewReminders, p.reviewReminderTime);
    };

    tick();
    intervalRef.current = setInterval(tick, 30_000); // every 30s, cheap check
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);
}
