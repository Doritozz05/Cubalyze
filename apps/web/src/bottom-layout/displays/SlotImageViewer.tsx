import { useTranslation } from "react-i18next";
import { Image as ImageIcon } from "lucide-react";
import type { SlotImageConfig } from "../types";

interface SlotImageViewerProps {
  config?: SlotImageConfig;
  className?: string;
}

export function SlotImageViewer({ config, className }: SlotImageViewerProps) {
  const { t } = useTranslation("timer");
  const url = config?.url;
  const fit = config?.fit ?? "cover";
  const opacity = config?.opacity ?? 1;

  if (!url) {
    return (
      <div className={`flex size-full min-h-22 flex-col items-center justify-center p-3 text-ink-3 gap-1.5 border border-dashed border-line ${className ?? ""}`}>
        <ImageIcon className="size-5 stroke-[1.5] text-ink-3/70" />
        <span className="text-[0.68rem]">{t("noImageConfigured", { defaultValue: "No image configured" })}</span>
      </div>
    );
  }

  return (
    <div className={`relative size-full min-h-22 min-w-0 overflow-hidden ${className ?? ""}`}>
      <img
        src={url}
        alt="Slot media"
        loading="lazy"
        decoding="async"
        className="absolute inset-0 size-full block transition-opacity"
        style={{
          objectFit: fit,
          opacity,
        }}
      />
    </div>
  );
}
