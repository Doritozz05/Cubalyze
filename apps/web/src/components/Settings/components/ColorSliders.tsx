"use client";

import { memo, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import type { RGB } from "./colorUtils";

const HUE_TRACK =
  "linear-gradient(to right,#f00 0%,#ff0 17%,#0f0 33%,#0ff 50%,#00f 67%,#f0f 83%,#f00 100%)";

interface HueSliderProps {
  hue: number;
  onPreview: (hue: number) => void;
  onCommit: () => void;
}

/** Hue slider: local preview while sliding, single commit on release. */
export const HueSlider = memo(function HueSlider({ hue, onPreview, onCommit }: HueSliderProps) {
  const { t } = useTranslation("settings");
  return (
    <input
      type="range"
      min={0}
      max={360}
      step={1}
      value={Math.round(hue)}
      aria-label={t("appearance.colorPicker.hue", "Tono")}
      onChange={(e) => onPreview(Number(e.target.value))}
      onPointerUp={onCommit}
      onKeyUp={onCommit}
      onBlur={onCommit}
      className="cp-range cp-range-tall h-4 w-full flex-1 text-ink"
      style={{ "--cp-track": HUE_TRACK } as CSSProperties}
    />
  );
});

type Channel = "r" | "g" | "b";

interface RgbSlidersProps {
  rgb: RGB;
  onPreviewChannel: (channel: Channel, value: number) => void;
  onCommit: () => void;
}

const CHANNELS: Channel[] = ["r", "g", "b"];

/** RGB sliders with per-channel gradient tracks. Same preview/commit split. */
export const RgbSliders = memo(function RgbSliders({ rgb, onPreviewChannel, onCommit }: RgbSlidersProps) {
  return (
    <div className="flex flex-col gap-1">
      {CHANNELS.map((key) => {
        const track =
          key === "r"
            ? `linear-gradient(to right,rgb(0,${rgb.g},${rgb.b}),rgb(255,${rgb.g},${rgb.b}))`
            : key === "g"
              ? `linear-gradient(to right,rgb(${rgb.r},0,${rgb.b}),rgb(${rgb.r},255,${rgb.b}))`
              : `linear-gradient(to right,rgb(${rgb.r},${rgb.g},0),rgb(${rgb.r},${rgb.g},255))`;
        return (
          <div key={key} className="flex items-center gap-2">
            <span aria-hidden="true" className="w-3 text-[0.65rem] font-bold uppercase text-ink-3">
              {key}
            </span>
            <input
              type="range"
              min={0}
              max={255}
              step={1}
              value={rgb[key]}
              aria-label={key.toUpperCase()}
              onChange={(e) => onPreviewChannel(key, Number(e.target.value))}
              onPointerUp={onCommit}
              onKeyUp={onCommit}
              onBlur={onCommit}
              className="cp-range cp-range-tall h-4 min-w-0 flex-1 text-ink"
              style={{ "--cp-track": track } as CSSProperties}
            />
            <span className="w-7 shrink-0 text-right font-mono text-[0.65rem] text-ink-2">
              {rgb[key]}
            </span>
          </div>
        );
      })}
    </div>
  );
});
