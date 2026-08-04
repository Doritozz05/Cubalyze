import { useEffect } from "react";

/**
 * Screen-reader announcement utility.
 *
 * Mounts a single polite live region (created lazily on first call and reused)
 * and pushes `message` into it so assistive tech announces the text without
 * taking visual space. Only renders textNodes — a fresh text node each call is
 * what reliably retriggers a polite announcement in most SRs.
 *
 * Companion hook `useAnnounce(message)` announces when `message` changes.
 */
export function announce(message: string) {
  if (typeof window === "undefined") return;
  let region = document.getElementById("cf-announce-live") as HTMLElement | null;
  if (!region) {
    region = document.createElement("div");
    region.id = "cf-announce-live";
    region.setAttribute("aria-live", "polite");
    region.setAttribute("aria-atomic", "true");
    region.className = "sr-only";
    document.body.appendChild(region);
  }
  region.textContent = "";
  // Let the empty node paint before injecting the message so a repeat of the
  // same string still fires the announcement.
  requestAnimationFrame(() => {
    region!.textContent = message;
  });
}

/** React hook: announce `message` whenever it changes (skip on first render). */
export function useAnnounce(message?: string | null) {
  useEffect(() => {
    if (!message) return;
    announce(message);
  }, [message]);
}