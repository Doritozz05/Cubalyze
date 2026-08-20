"use client";

import { AudioLines, Mic, MicOff, Volume2 } from "lucide-react";
import { useStore } from "zustand";
import { useTranslation } from "react-i18next";
import { preferencesStore } from "@cubeforge/state";
import { SettingToggle } from "../components/SettingToggle";
import { SettingRow } from "../components/SettingRow";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * Audio settings section — the single home for every sound the app makes.
 *
 * Houses:
 *   - Audio master switch (silences everything below).
 *   - Master volume slider.
 *   - Inspection voice cues + voice type (male/female) — moved here from
 *     the Timer tab.
 *   - PB victory fanfare — moved here from Notifications.
 *   - Cube turn sounds (replay + virtual cube) — new.
 *
 * Notifications keeps only non-audio channels (banners, reminders, toasts).
 */
export function AudioSection() {
  const { t } = useTranslation("settings");

  const soundsEnabled = useStore(preferencesStore, (s) => s.soundsEnabled);
  const setSoundsEnabled = useStore(preferencesStore, (s) => s.setSoundsEnabled);
  const soundVolume = useStore(preferencesStore, (s) => s.soundVolume);
  const setSoundVolume = useStore(preferencesStore, (s) => s.setSoundVolume);
  const cubeTurnSoundsEnabled = useStore(preferencesStore, (s) => s.cubeTurnSoundsEnabled);
  const setCubeTurnSoundsEnabled = useStore(preferencesStore, (s) => s.setCubeTurnSoundsEnabled);

  const audioCues = useStore(preferencesStore, (s) => s.audioCues);
  const setAudioCues = useStore(preferencesStore, (s) => s.setAudioCues);
  const voiceType = useStore(preferencesStore, (s) => s.voiceType);
  const setVoiceType = useStore(preferencesStore, (s) => s.setVoiceType);

  const pbCelebrationAudio = useStore(preferencesStore, (s) => s.pbCelebrationAudio);
  const setPbCelebrationAudio = useStore(preferencesStore, (s) => s.setPbCelebrationAudio);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3 rounded-xl border border-line/40 bg-surface-2/50 p-4">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-surface">
          <AudioLines className="size-4 text-ink-2" />
        </div>
        <p className="text-[0.82rem] leading-5 text-ink-2">
          {t("audio.info")}
        </p>
      </div>

      {/* ── Audio master ──────────────────────────────────────────────── */}
      <SettingToggle
        title={t("audio.sounds")}
        description={t("audio.soundsHint")}
        checked={soundsEnabled}
        onCheckedChange={setSoundsEnabled}
      />

      <div className={cn("flex flex-col gap-5", !soundsEnabled && "pointer-events-none opacity-45")}>
        {/* ── Master volume ───────────────────────────────────────────── */}
        <SettingRow
          title={
            <>
              <Volume2 className="size-3.5 text-ink-2" />
              {t("audio.volume")}
            </>
          }
          description={t("audio.volumeHint")}
          control={
            <div className="flex w-48 shrink-0 items-center gap-3 max-lg:w-full">
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
          }
        />

        {/* ── Inspection voice cues ───────────────────────────────────── */}
        <SettingToggle
          title={t("audio.audioCues")}
          description={t("audio.audioCuesHint")}
          checked={audioCues}
          onCheckedChange={setAudioCues}
        />

        {/* Voice type selector — only visible when audio cues are enabled */}
        {audioCues && (
          <SettingRow
            title={
              <>
                {voiceType === "male" ? (
                  <Mic className="size-3.5 text-ink-2" />
                ) : (
                  <MicOff className="size-3.5 text-ink-2" />
                )}
                {t("audio.voice")}
              </>
            }
            description={t("audio.voiceHint")}
            control={
              <Select value={voiceType} onValueChange={setVoiceType}>
                <SelectTrigger className="w-40 max-lg:w-full">
                  <SelectValue placeholder={t("audio.selectVoice")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">
                    <span>{t("audio.male")}</span>
                  </SelectItem>
                  <SelectItem value="female">
                    <span>{t("audio.female")}</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            }
          />
        )}

        {/* ── Cube turn sounds (new) ──────────────────────────────────── */}
        <SettingToggle
          title={t("audio.turnSounds")}
          description={t("audio.turnSoundsHint")}
          checked={cubeTurnSoundsEnabled}
          onCheckedChange={setCubeTurnSoundsEnabled}
        />

        {/* ── PB victory fanfare ──────────────────────────────────────── */}
        <SettingToggle
          title={t("audio.pbVictorySound")}
          description={t("audio.pbVictorySoundHint")}
          checked={pbCelebrationAudio}
          onCheckedChange={setPbCelebrationAudio}
        />
      </div>
    </div>
  );
}
