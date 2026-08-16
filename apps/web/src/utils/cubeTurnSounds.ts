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
 *   • `preload()` DECODE-WARMS the pool: it plays every copy muted, forcing
 *     the browser to decode each sample now rather than on the first turn
 *     (the reported first-move latency). Muted playback is exempt from
 *     autoplay policy, and a rejection just means the browser decodes lazily.
 *     Consumers call `preload()` on mount / engine init so the samples are
 *     ready before the cube becomes interactive.
 *   • Playback never repeats a sample: `play()` avoids the source that just
 *     played in EVERY path — idle copy, idle copy of another source, and the
 *     all-copies-busy restart fallback — so two consecutive turns are never
 *     the same click.
 *   • Playback is gated by the Audio preferences (Settings → Audio):
 *     `soundsEnabled` (audio master) + `cubeTurnSoundsEnabled` must be on,
 *     and the master `soundVolume` scales every sample — the same contract
 *     the inspection cues and PB fanfare use.
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
  /** Index of the last source actually played (or picked by the test helper). */
  private lastSourceIndex = -1;
  /** Whether the decode-warm pass has already run (keeps preload idempotent). */
  private warmedUp = false;

  /**
   * Create the audio pool, force each sample to start loading and run the
   * decode-warm pass. Safe to call repeatedly; a no-op after the first call
   * or when `Audio` is unavailable (SSR / tests without a DOM stub).
   */
  public preload(): void {
    this.ensurePool();
    if (!this.warmedUp) {
      this.warmedUp = true;
      this.warmup();
    }
  }

  /**
   * Play one random turn sound, honoring the user's sound preferences.
   * No-op when sounds are disabled or the browser cannot play audio.
   */
  public play(): void {
    const prefs = preferencesStore.getState();
    if (!prefs.soundsEnabled || !prefs.cubeTurnSoundsEnabled) return;

    this.ensurePool();
    if (this.pool.length === 0) return;

    const volume = prefs.soundVolume / 100;

    // Capture the just-played source BEFORE picking, so the fallback paths can
    // still honor the no-repeat rule even though pickSourceIndex() advances
    // the internal cursor.
    const previous = this.lastSourceIndex;
    const preferred = this.pickSourceIndex();

    // 1) An idle copy of the preferred source (always ≠ previous).
    // 2) Otherwise an idle copy of any source ≠ previous.
    // 3) Otherwise — every copy still playing (turns faster than the samples)
    //    — restart any copy of a source ≠ previous. With 2 copies × 4 sources
    //    there is always at least one such entry, so two consecutive turns
    //    never play the same sample.
    const chosen =
      this.scan((e) => e.sourceIndex === preferred && e.el.paused) ??
      this.scan((e) => e.sourceIndex !== previous && e.el.paused) ??
      this.scan((e) => e.sourceIndex !== previous) ??
      this.pool[this.cursor];

    this.lastSourceIndex = chosen.sourceIndex;

    const el = chosen.el;
    el.volume = volume;
    // A copy may still be muted from the decode-warm pass — make it audible.
    el.muted = false;
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

  /** Round-robin scan: the first pool entry matching the predicate, while
   *  advancing the cursor so restarts spread across copies. */
  private scan(predicate: (entry: PoolEntry) => boolean): PoolEntry | null {
    for (let i = 0; i < this.pool.length; i++) {
      const entry = this.pool[this.cursor];
      this.cursor = (this.cursor + 1) % this.pool.length;
      if (predicate(entry)) return entry;
    }
    return null;
  }

  /**
   * Decode-warm every pooled copy: playing muted forces the browser to decode
   * the sample NOW, so the first real turn does not pay the decode latency.
   * We never pause/seek from a promise — a real turn that lands mid-warmup
   * simply restarts the copy via play() (which resets `muted`), so there is
   * no race between the warm-up and a fast first turn.
   */
  private warmup(): void {
    for (const entry of this.pool) {
      const el = entry.el;
      el.muted = true;
      void el.play().catch(() => {});
    }
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
        // new Audio(src) may only schedule the fetch; load() makes it start
        // immediately, so the samples are ready before the first turn.
        el.load();
        return { el, sourceIndex };
      }),
    );
  }
}

/** App-wide singleton (the components import this, not the class). */
export const cubeTurnSounds = new CubeTurnSounds();
