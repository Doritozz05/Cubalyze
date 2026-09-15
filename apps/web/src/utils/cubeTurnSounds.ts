/**
 * Cube turn sound effects — randomized layer-turn clicks.
 *
 * Plays one of several short "rubik cube turn" samples at random on every
 * layer turn of the replay and virtual-cube views. Consumed by
 * `ReplaySection` (replay moves) and `CubeSimulatorView` (virtual cube) —
 * NOT by the timer / smart-cube / 3D-panel paths.
 *
 * ── Architecture ─────────────────────────────────────────────────────────
 *
 *   This module is a thin FACADE over the app-wide `SoundManager`
 *   (`@/audio/soundManager`), which owns the shared AudioContext, the mixer
 *   buses (sfx/ui → master → compressor → destination), the click-free
 *   envelopes, the pitch/volume jitter and the deterministic clock gate.
 *   The facade keeps the exact public API it always had (`preload()`,
 *   `play()`, `pickSourceIndex()`), so `ReplaySection` and
 *   `CubeSimulatorView` are untouched.
 *
 * ── Why the first turn is now exact ───────────────────────────────────────
 *
 *   The old implementation decoded the samples only on the FIRST user
 *   gesture (autoplay policy), so the first move of the session queued its
 *   click behind a 20-80 ms decode — the reported "primer move no es
 *   exacto". The manager fixes this at the root:
 *
 *   • `preload()` fetches the bytes AND decodes them through an
 *     `OfflineAudioContext`, which works with NO user gesture (offline
 *     contexts are not audio devices — autoplay never applies). The
 *     buffers are ready before the user ever touches the cube, so the
 *     first turn fires a decoded one-shot instantly.
 *   • Once the audio clock has provably advanced (`clockSettled`), the
 *     manager's warm path fires voices directly — zero added latency. The
 *     clock gate (queued cues drain at the first tick) only ever runs
 *     right after a gesture or a hidden-tab device reopen, where it is
 *     invisible because the eager resume hooks started the reopen before
 *     the user reached the cube.
 *   • DETERMINISTIC playback is preserved: a cue is never fired into a
 *     frozen audio clock (crbug.com/41302928 — Chromium resolves resume()
 *     and reports 'running' while the device is still reopening).
 *
 * ── Other properties ──────────────────────────────────────────────────────
 *
 *   • Sources are imported as Vite asset URLs, so they are hashed and
 *     bundled with the app and resolve in both the PWA and the Tauri
 *     desktop build.
 *   • Playback never repeats a sample: `pickSourceIndex()` avoids the
 *     source that just played.
 *   • Anti-fatigue jitter: ±4% pitch and ±5% volume per play (AAA
 *     technique against "machine-gun" repetition), applied by the manager.
 *   • Playback is gated by the Audio preferences (Settings → Audio):
 *     `soundsEnabled` (audio master) + `cubeTurnSoundsEnabled` must be on,
 *     and the master `soundVolume` scales every sample through the
 *     manager's master bus — the same contract the PB fanfare uses.
 *   • Fully lazy: no fetch / AudioContext work happens until the first
 *     play or an explicit `preload()`, so SSR, tests and users who never
 *     open the replay/virtual cube pay zero cost.
 *
 * Samples: "rubik cube turn" series by spacejoe on Freesound (see
 * `assets/sounds/README.md` for the attribution/rename table).
 */

import { preferencesStore } from "@cubalyze/state";
import { SoundManager, soundManager, type AssetDescriptor } from "@/audio/soundManager";
import turn1Url from "@/assets/sounds/turn-1.wav";
import turn2Url from "@/assets/sounds/turn-2.wav";
import turn3Url from "@/assets/sounds/turn-3.wav";
import turn4Url from "@/assets/sounds/turn-4.wav";

/** The sample bank this facade registers on the shared manager. */
const TURN_ASSETS: AssetDescriptor[] = [
  { id: "turn-1", url: turn1Url },
  { id: "turn-2", url: turn2Url },
  { id: "turn-3", url: turn3Url },
  { id: "turn-4", url: turn4Url },
];

export class CubeTurnSounds {
  private readonly sound: SoundManager;
  /** Index of the last source actually played (or picked by the test helper). */
  private lastSourceIndex = -1;
  /** Whether preload() has been requested (idempotent). */
  private preloadStarted = false;

  /** `sound` is injectable so tests use a fresh manager per case; the app
   *  singleton shares one manager with the rest of the audio. */
  constructor(sound: SoundManager = soundManager) {
    this.sound = sound;
  }

  /**
   * Warm the turn-sound bank: fetch + DECODE every sample with no user
   * gesture (offline context), so the first turn after mounting clicks
   * instantly and never lags. Also arms the manager's gesture/resume hooks.
   * Safe to call repeatedly.
   */
  public preload(): void {
    if (this.preloadStarted) return;
    this.preloadStarted = true;
    void this.sound.preload(TURN_ASSETS);
  }

  /**
   * Play one random turn sound, honoring the user's sound preferences.
   * No-op when sounds are disabled or the browser cannot play audio.
   */
  public play(): void {
    const prefs = preferencesStore.getState();
    if (!prefs.soundsEnabled || !prefs.cubeTurnSoundsEnabled) return;

    this.preload();
    // The manager's master bus follows the Settings → Audio volume; assert
    // it on every play so external volume changes apply immediately.
    this.sound.setMasterVolume(prefs.soundVolume);

    const index = this.pickSourceIndex();
    this.sound.play(TURN_ASSETS[index].id, {
      bus: "sfx",
      volume: 1,
      // AAA anti-repetition-fatigue: a little pitch + volume life per turn.
      jitter: { pitch: 0.04, volume: 0.05 },
      priority: 1,
    });
  }

  /**
   * Pick a random source index, avoiding an immediate repeat of the previous
   * one when there is more than one sample. `random` is injectable for tests.
   */
  public pickSourceIndex(random: () => number = Math.random): number {
    const n = TURN_ASSETS.length;
    if (n <= 1) return 0;
    let idx = Math.floor(random() * n);
    if (idx === this.lastSourceIndex) idx = (idx + 1) % n;
    this.lastSourceIndex = idx;
    return idx;
  }
}

/** App-wide singleton (the components import this, not the class). */
export const cubeTurnSounds = new CubeTurnSounds();
