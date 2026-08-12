/**
 * Cube turn sound effects — randomized layer-turn clicks.
 *
 * Plays one of several short "rubik cube turn" samples at random on every
 * layer turn of the replay and virtual-cube views. Consumed by
 * `ReplaySection` (replay moves) and `CubeSimulatorView` (virtual cube) —
 * NOT by the timer / smart-cube / 3D-panel paths.
 *
 * ── Design ─────────────────────────────────────────────────────────────────
 *
 *   • Sources are imported as Vite asset URLs, so they are hashed and bundled
 *     with the app and resolve correctly in both the PWA and the Tauri
 *     desktop build (no hard-coded /public paths).
 *   • A small element POOL (2 copies per source) allows real overlap when
 *     turns are faster than the samples (fast solves), while reusing nodes
 *     instead of allocating a fresh `Audio` per turn.
 *   • Playback is gated by the existing preferences (Settings → Notifications):
 *     `notificationsEnabled` + `soundsEnabled` must be on, and the master
 *     `soundVolume` scales every sample — the same contract the inspection
 *     cues and PB fanfare use.
 *   • Fully lazy: no DOM/Audio work happens until the first play or an
 *     explicit `preload()`, so SSR, tests and users who never open the
 *     replay/virtual cube pay zero cost.
 *
 * Samples: "rubik cube turn" series by spacejoe on Freesound (see
 * `assets/sounds/README.md` for the attribution/rename table).
 */

import { preferencesStore } from "@cubeforge/state";
import turn1Url from "@/assets/sounds/turn-1.wav";
import turn2Url from "@/assets/sounds/turn-2.wav";
import turn3Url from "@/assets/sounds/turn-3.wav";
import turn4Url from "@/assets/sounds/turn-4.wav";

/** Number of pooled <audio> elements. 2 copies per source → fast turns can
 *  overlap without restarting the same node mid-play. */
const POOL_SIZE = 8;

interface PoolEntry {
  el: HTMLAudioElement;
  sourceIndex: number;
}

export class CubeTurnSounds {
  private readonly sources = [turn1Url, turn2Url, turn3Url, turn4Url];
  private pool: PoolEntry[] = [];
  /** Round-robin cursor over the pool (spreads restarts across copies). */
  private cursor = 0;
  /** Index of the last played source, so consecutive turns rarely repeat. */
  private lastSourceIndex = -1;

  /**
   * Create the audio pool and start preloading the samples. Safe to call
   * repeatedly; a no-op when the pool already exists or `Audio` is
   * unavailable (SSR / tests without a DOM stub).
   */
  public preload(): void {
    this.ensurePool();
  }

  /**
   * Play one random turn sound, honoring the user's sound preferences.
   * No-op when sounds are disabled or the browser cannot play audio.
   */
  public play(): void {
    const prefs = preferencesStore.getState();
    if (!prefs.notificationsEnabled || !prefs.soundsEnabled) return;

    this.ensurePool();
    if (this.pool.length === 0) return;

    const sourceIdx = this.pickSourceIndex();
    const volume = prefs.soundVolume / 100;

    // Prefer an idle copy of the chosen source; when every copy is still
    // playing (turns faster than the samples), reuse the next pool slot so
    // the sound naturally overlaps instead of dropping.
    const start = this.cursor;
    let chosen: PoolEntry | null = null;
    for (let i = 0; i < this.pool.length; i++) {
      const entry = this.pool[this.cursor];
      this.cursor = (this.cursor + 1) % this.pool.length;
      if (entry.sourceIndex === sourceIdx && entry.el.paused) {
        chosen = entry;
        break;
      }
    }
    if (!chosen) {
      chosen = this.pool[start];
      this.cursor = (start + 1) % this.pool.length;
    }

    const el = chosen.el;
    el.volume = volume;
    try {
      el.currentTime = 0; // restart a still-playing copy from the top
    } catch {
      // Not seekable yet (preload still in flight) — play from wherever it is.
    }
    // Best effort: autoplay policy / unmounted media must never throw or
    // leak an unhandled rejection from a fire-and-forget cue.
    void el.play().catch(() => {});
  }

  /**
   * Pick a random source index, avoiding an immediate repeat of the previous
   * one when there is more than one sample. `random` is injectable for tests.
   */
  public pickSourceIndex(random: () => number = Math.random): number {
    const n = this.sources.length;
    if (n <= 1) return 0;
    let idx = Math.floor(random() * n);
    if (idx === this.lastSourceIndex) idx = (idx + 1) % n;
    this.lastSourceIndex = idx;
    return idx;
  }

  private ensurePool(): void {
    if (this.pool.length > 0 || typeof Audio === "undefined") return;
    const volume = preferencesStore.getState().soundVolume / 100;
    const copiesPerSource = Math.max(1, Math.floor(POOL_SIZE / this.sources.length));
    this.pool = this.sources.flatMap((src, sourceIndex) =>
      Array.from({ length: copiesPerSource }, () => {
        const el = new Audio(src);
        el.preload = "auto";
        el.volume = volume;
        return { el, sourceIndex };
      }),
    );
  }
}

/** App-wide singleton (the components import this, not the class). */
export const cubeTurnSounds = new CubeTurnSounds();
