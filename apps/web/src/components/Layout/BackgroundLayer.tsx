"use client";

import { useEffect, useRef } from "react";
import { useStore } from "zustand";
import { preferencesStore } from "@cubeforge/state";
import { useBackgroundMediaStore } from "@/stores/backgroundMediaStore";
import type { ViewId } from "./sidebar.constants";

interface BackgroundLayerProps {
  /** Currently active view/tab id. */
  activeView?: ViewId;
}

export function BackgroundLayer({ activeView }: BackgroundLayerProps) {
  const timerBackgroundImage = useStore(preferencesStore, (s) => s.timerBackgroundImage);
  const timerBackgroundOpacity = useStore(preferencesStore, (s) => s.timerBackgroundOpacity);
  const timerBackgroundBlur = useStore(preferencesStore, (s) => s.timerBackgroundBlur);
  const timerBackgroundFit = useStore(preferencesStore, (s) => s.timerBackgroundFit);
  const timerBackgroundOverlay = useStore(preferencesStore, (s) => s.timerBackgroundOverlay);
  const timerBackgroundAllViews = useStore(preferencesStore, (s) => s.timerBackgroundAllViews);

  const mediaUrl = useBackgroundMediaStore((s) => s.mediaUrl);
  const posterUrl = useBackgroundMediaStore((s) => s.posterUrl);
  const mediaType = useBackgroundMediaStore((s) => s.mediaType);
  const isAnimating = useBackgroundMediaStore((s) => s.isAnimating);
  const animationKey = useBackgroundMediaStore((s) => s.animationKey);

  const videoRef = useRef<HTMLVideoElement>(null);

  // Synchronize HTML5 video element playback with the timer animation state
  useEffect(() => {
    const video = videoRef.current;
    if (!video || mediaType !== "video") return;

    if (isAnimating) {
      video.currentTime = 0;
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.debug("[BackgroundLayer] Video autoplay prevented:", err);
        });
      }
    } else {
      video.pause();
      video.currentTime = 0;
    }
  }, [isAnimating, mediaType, animationKey]);

  const effectiveMediaUrl = mediaUrl || (timerBackgroundImage?.startsWith("data:") ? timerBackgroundImage : null);
  const isVisible =
    !!effectiveMediaUrl &&
    (timerBackgroundAllViews || activeView === "timer" || activeView === "cube");

  if (!isVisible) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden transition-opacity duration-300 select-none"
      style={{ opacity: (timerBackgroundOpacity ?? 100) / 100 }}
    >
      {/* 1. Video background (<10s loop) */}
      {mediaType === "video" && (
        <video
          ref={videoRef}
          src={effectiveMediaUrl}
          poster={posterUrl || undefined}
          loop
          muted
          playsInline
          className="absolute inset-0 size-full pointer-events-none object-cover"
          style={{
            objectFit: timerBackgroundFit === "contain" ? "contain" : "cover",
            filter: timerBackgroundBlur ? `blur(${timerBackgroundBlur}px)` : undefined,
            transform: timerBackgroundBlur ? "scale(1.05)" : undefined,
          }}
        />
      )}

      {/* 2. Animated GIF (static poster when idle/stopped, animated when inspecting/solving) */}
      {mediaType === "gif" && (
        <>
          {isAnimating ? (
            <img
              key={`gif-${animationKey}`}
              src={effectiveMediaUrl}
              alt=""
              className="absolute inset-0 size-full pointer-events-none"
              style={{
                objectFit:
                  timerBackgroundFit === "contain"
                    ? "contain"
                    : timerBackgroundFit === "tile"
                      ? "none"
                      : "cover",
                filter: timerBackgroundBlur ? `blur(${timerBackgroundBlur}px)` : undefined,
                transform: timerBackgroundBlur ? "scale(1.05)" : undefined,
              }}
            />
          ) : (
            <div
              className="absolute inset-0 bg-center pointer-events-none"
              style={{
                backgroundImage: `url("${posterUrl || effectiveMediaUrl}")`,
                backgroundSize: timerBackgroundFit === "tile" ? "auto" : (timerBackgroundFit || "cover"),
                backgroundRepeat: timerBackgroundFit === "tile" ? "repeat" : "no-repeat",
                filter: timerBackgroundBlur ? `blur(${timerBackgroundBlur}px)` : undefined,
                transform: timerBackgroundBlur ? "scale(1.05)" : undefined,
              }}
            />
          )}
        </>
      )}

      {/* 3. Static Image (JPG, PNG, WebP, SVG, legacy data URLs) */}
      {(mediaType === "image" || (!mediaType && effectiveMediaUrl)) && (
        <div
          className="absolute inset-0 bg-center pointer-events-none"
          style={{
            backgroundImage: `url("${effectiveMediaUrl}")`,
            backgroundSize: timerBackgroundFit === "tile" ? "auto" : (timerBackgroundFit || "cover"),
            backgroundRepeat: timerBackgroundFit === "tile" ? "repeat" : "no-repeat",
            filter: timerBackgroundBlur ? `blur(${timerBackgroundBlur}px)` : undefined,
            transform: timerBackgroundBlur ? "scale(1.05)" : undefined,
          }}
        />
      )}

      {/* Dark overlay */}
      {timerBackgroundOverlay > 0 && (
        <div
          className="absolute inset-0 bg-black pointer-events-none"
          style={{ opacity: timerBackgroundOverlay / 100 }}
        />
      )}
    </div>
  );
}
