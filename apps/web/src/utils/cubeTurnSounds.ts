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
 *   • Playback goes through the Web Audio API: `preload()` fetches and
 *     DECODES every sample once into an in-memory `AudioBuffer`
 *     (`decodeAudioData`), and each turn fires a one-shot
 *     `AudioBufferSourceNode`. This replaces the old `HTMLAudioElement` pool,
 *     whose media-pipeline state Chrome evicts while the tab is hidden —
 *     coming back to the app and turning the cube re-fetched/re-decoded the
 *     sample through the element pipeline, which showed up as the reported
 *     ~2 s first-click delay. A decoded buffer survives backgrounding, so a
 *     turn after returning plays instantly on the audio clock.
 *   • Autoplay policy: the AudioContext is created lazily (by `preload()` or
 *     the first `play()`). Chrome keeps it `suspended` until a user gesture —
 *     and also suspends it while the tab is hidden — so `play()` (always
 *     reached from a user interaction: cube turn / replay play) resumes it.
 *     The samples are already decoded in memory, so the first click after
 *     coming back fires as soon as the context re-arms: no delay.
 *   • Turns that land while the first fetch/decode is still in flight are
 *     queued and played the moment the buffers are ready, so the very first
 *     fast interaction never drops a click.
 *   • Playback never repeats a sample: `pickSourceIndex()` avoids the source
 *     that just played.
 *   • Playback is gated by the Audio preferences (Settings → Audio):
 *     `soundsEnabled` (audio master) + `cubeTurnSoundsEnabled` must be on,
 *     and the master `soundVolume` scales every sample — the same contract
 *     the inspection cues and PB fanfare use.
 *   • Fully lazy: no fetch / AudioContext work happens until the first play
 *     or an explicit `preload()`, so SSR, tests and users who never open the
 *     replay/virtual cube pay zero cost.
 *
 * Samples: "rubik cube turn" series by spacejoe on Freesound (see
 * `assets/sounds/README.md` for the attribution/rename table).
 */

import { preferencesStore } from '@cubeforge/state';
import turn1Url from '@/assets/sounds/turn-1.wav';
import turn2Url from '@/assets/sounds/turn-2.wav';
import turn3Url from '@/assets/sounds/turn-3.wav';
import turn4Url from '@/assets/sounds/turn-4.wav';

export class CubeTurnSounds {
  private readonly sources = [turn1Url, turn2Url, turn3Url, turn4Url];
  private ctx: AudioContext | null = null;
  /** Decoded samples in source order (null = not decoded yet / failed). */
  private buffers: (AudioBuffer | null)[] = [];
  /** Index of the last source actually played (or picked by the test helper). */
  private lastSourceIndex = -1;
  /** Whether the fetch + decode pass has already been kicked off. */
  private loadingStarted = false;
  /** Turns that arrived before the first decode finished (drained on ready). */
  private pending: number[] = [];

  /**
   * Create the AudioContext and start fetching + decoding every sample into
   * an AudioBuffer. Safe to call repeatedly; the decode pass runs only once.
   * No-op when the Web Audio API is unavailable (SSR / tests without a stub).
   */
  public preload(): void {
    this.ensureContext();
    this.loadSamples();
  }

  /**
   * Play one random turn sound, honoring the user's sound preferences.
   * No-op when sounds are disabled or the browser cannot play audio.
   */
  public play(): void {
    const prefs = preferencesStore.getState();
    if (!prefs.soundsEnabled || !prefs.cubeTurnSoundsEnabled) return;

    const ctx = this.ensureContext();
    if (!ctx) return;

    // Autoplay policy AND background-tab suspend: browsers freeze the context
    // clock while the tab is hidden, so this user gesture (cube turn) must
    // re-arm it. The samples are already decoded in memory, so the click fires
    // as soon as resume completes — no media-pipeline re-fetch / re-decode.
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }

    const index = this.pickSourceIndex();
    const buffer = this.buffers[index];
    if (!buffer) {
      // First decode still in flight (very first interaction) — queue the cue
      // and play it the moment the buffers are ready.
      this.pending.push(index);
      this.loadSamples();
      return;
    }

    this.startSource(index, prefs.soundVolume / 100);
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

  /** Fire one decoded sample through the Web Audio graph as a one-shot node. */
  private startSource(index: number, volume: number): void {
    const ctx = this.ctx;
    const buffer = this.buffers[index];
    if (!ctx || !buffer) return;

    try {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = volume;
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start();
      // One-shot nodes must be disconnected after playback or they leak.
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
      };
    } catch (e) {
      console.warn('[CubeTurnSounds] Could not play turn sound:', e);
    }
  }

  /** Play every cue that arrived while the first decode was still running. */
  private drainPending(): void {
    if (this.pending.length === 0 || !this.ctx) return;
    const volume = preferencesStore.getState().soundVolume / 100;
    const pending = this.pending;
    this.pending = [];
    for (const index of pending) {
      if (this.buffers[index]) this.startSource(index, volume);
    }
  }

  /** Fetch + decode every sample into an AudioBuffer (idempotent). */
  private loadSamples(): void {
    if (this.loadingStarted) return;
    this.loadingStarted = true;
    const ctx = this.ctx;
    if (!ctx) return;

    void Promise.all(
      this.sources.map(async (url, i) => {
        try {
          const response = await fetch(url);
          const arrayBuffer = await response.arrayBuffer();
          this.buffers[i] = await ctx.decodeAudioData(arrayBuffer);
        } catch {
          this.buffers[i] = null; // a failed sample stays silent; the rest play
        }
      }),
    ).then(() => {
      this.drainPending();
    });
  }

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;

    // `globalThis` fallback lets tests stub AudioContext in a Node environment;
    // browsers always expose it on `window`.
    const root: {
      AudioContext?: typeof AudioContext;
      webkitAudioContext?: typeof AudioContext;
    } = typeof window !== 'undefined' ? window : globalThis;
    const Ctor = root.AudioContext ?? root.webkitAudioContext;
    if (!Ctor) return null;

    try {
      this.ctx = new Ctor();
    } catch {
      // Context creation can fail (browser limit / unavailable) — stay silent.
      return null;
    }
    return this.ctx;
  }
}

/** App-wide singleton (the components import this, not the class). */
export const cubeTurnSounds = new CubeTurnSounds();
