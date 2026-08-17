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
 *   • DETERMINISTIC playback — a cue is never fired into a frozen audio
 *     clock. Browsers pause the context while the tab is hidden and by
 *     autoplay policy, and the pause can surface as EITHER paused state:
 *       • `suspended` — autoplay block / hidden-tab freeze (Chrome, Firefox),
 *       • `interrupted` — the UA paused the context itself (iOS Safari on
 *         tab switch / screen lock / phone call — see MDN
 *         `BaseAudioContext.state`, which documents resume() as the fix).
 *     The original code checked only `state === 'suspended'`, so on browsers
 *     that report `interrupted` the resume never ran. But the deeper issue is
 *     that `state === 'running'` is NOT proof the audio clock is moving:
 *     when the tab is hidden Chromium CLOSES the audio device (Chrome's own
 *     suspend/resume sample: "the audio device can be closed"), and on
 *     return it flips the context back to 'running' while the device is still
 *     reopening — currentTime stays frozen for up to ~1 s
 *     (crbug.com/41302928: "AudioContext resume() promise resolves before
 *     currentTime starts updating"). Firing a source on that frozen clock is
 *     exactly the "sound comes out a while later" bug. So:
 *       1. ANY non-running context is resumed eagerly, at the earliest
 *          possible signal after the user returns (visibilitychange, focus,
 *          first pointermove) plus the first user gesture anywhere in the
 *          app (pointer/key/touch — the official Chrome pattern: resume()
 *          after a gesture). This overlaps the device reopen with the user
 *          approaching the cube instead of with the turn.
 *       2. Playback is gated on the clock DEMONSTRABLY advancing: every cue
 *          is queued and drained only once `currentTime` ticks past a
 *          baseline captured at drain time. When the device is warm the very
 *          first check passes (zero added latency); when it is cold the cue
 *          plays the instant the clock ticks — the earliest possible moment,
 *          deterministic by construction. This replaces the old
 *          "drain when state === 'running'" logic, which fired into the
 *          frozen clock.
 *       3. A `resume()` that REJECTS or never settles (no user activation
 *          yet, or an ongoing interruption — both documented behaviors; a
 *          not-allowed-to-start resume may also hang: WebAudio spec #1759)
 *          leaves the cue queued instead of dropping it; the next
 *          gesture / visibilitychange / statechange retries, so the first
 *          audible turn is never lost.
 *   • Turns that land while the first fetch/decode is still in flight are
 *     queued and played the moment the buffers are ready, so the very first
 *     fast interaction never drops a click.
 *   • Playback never repeats a sample: `pickSourceIndex()` avoids the source
 *     that just played.
 *   • Playback is gated by the Audio preferences (Settings → Audio):
 *     `soundsEnabled` (audio master) + `cubeTurnSoundsEnabled` must be on,
 *     and the master `soundVolume` scales every sample — the same contract
 *     the inspection cues and PB fanfare use.   *   • Fully lazy: no fetch / AudioContext work happens until the first play
   *     or an explicit `preload()`, so SSR, tests and users who never open the
   *     replay/virtual cube pay zero cost.
   *   • The AudioContext itself is created lazily on the FIRST user gesture
   *     (never on mount): creating one before any interaction leaves it
   *     autoplay-blocked and Chrome logs "The AudioContext was not allowed to
   *     start". `preload()` only warms the fetch of the sample bytes; the
   *     context + decode happen the moment the user first interacts.
   *
   * Samples: "rubik cube turn" series by spacejoe on Freesound (see
 * `assets/sounds/README.md` for the attribution/rename table).
 */

import { preferencesStore } from '@cubeforge/state';
import turn1Url from '@/assets/sounds/turn-1.wav';
import turn2Url from '@/assets/sounds/turn-2.wav';
import turn3Url from '@/assets/sounds/turn-3.wav';
import turn4Url from '@/assets/sounds/turn-4.wav';

/**
 * Gestures that unlock autoplay-suspended AudioContexts. The pointerdown/
 * touchstart/keydown trio covers modern browsers; `mousedown`/`click` cover
 * browsers without Pointer Events (Safari < 13) and older assistive tech.
 * The listeners self-remove after the first gesture.
 */
const UNLOCK_GESTURES = ['pointerdown', 'mousedown', 'touchstart', 'keydown', 'click'] as const;

/** Window/document shape used by the resume hooks (browser + test stubs). */
type AudioRoot = {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
  document?: {
    hidden: boolean;
    addEventListener: (type: string, listener: () => void) => void;
  };
  addEventListener: (type: string, listener: () => void, options?: { passive?: boolean }) => void;
  removeEventListener: (type: string, listener: () => void) => void;
};

export class CubeTurnSounds {
  private readonly sources = [turn1Url, turn2Url, turn3Url, turn4Url];
  private ctx: AudioContext | null = null;
  /** Decoded samples in source order (null = not decoded yet / failed). */
  private buffers: (AudioBuffer | null)[] = [];
  /** Index of the last source actually played (or picked by the test helper). */
  private lastSourceIndex = -1;
  /** Whether the fetch pass has already been kicked off. */
  private loadingStarted = false;
  /** Fetched sample bytes, in source order (null = fetch failed). Decoded
   *  once the AudioContext exists (created on the first user gesture). */
  private rawBuffers: (ArrayBuffer | null)[] = [];
  /** Whether decode of every fetched sample has been started (idempotent). */
  private decodeStarted = false;
  /** Whether the fetch + decode pass has settled (failed samples = null). */
  private decodeDone = false;
  /**
   * Cues that cannot fire yet: the first decode is still in flight, the
   * context is paused (autoplay block / hidden-tab / interrupted), or the
   * audio clock is still frozen while the device reopens. Drained only once
   * the buffer is ready AND the clock demonstrably advances.
   */
  private pending: number[] = [];
  /**
   * Bumped on every drain attempt. A clock-wait poll started by an older
   * drain must never flush cues queued after it began (they belong to a newer
   * drain with a fresher baseline) — the token makes stale polls no-ops.
   */
  private drainToken = 0;
  /**
   * Whether the context has EVER reached 'running' (i.e. a user gesture
   * unlocked it). The non-gesture resume hooks (visibilitychange / focus /
   * pointermove) only resume when this is true: calling resume() before the
   * first user gesture is REJECTED by the autoplay policy and Chrome logs
   * "The AudioContext was not allowed to start" on every call — which is the
   * console flood seen on fresh load, where those hooks fired before any
   * gesture. Once a gesture has unlocked the context, resume() after a
   * hidden-tab pause works without a new gesture, so the hooks can keep
   * starting the device reopen early.
   */
  private everRan = false;
  /**
   * A resume() is already in flight (device reopening). Guards against the
   * hooks stacking redundant resume() calls — and against spamming Chrome's
   * autoplay error — while one is pending.
   */
  private resumeInFlight = false;
  /** Whether the one-time gesture listeners are already attached. */
  private resumeHooksArmed = false;

  /**
   * Warm the samples: fetch every sample's bytes so the first turn after
   * mounting never waits on the network. The AudioContext is deliberately
   * NOT created here — creating one before any user gesture leaves it
   * autoplay-blocked and Chrome logs "The AudioContext was not allowed to
   * start". The context (and with it the decode) is created lazily on the
   * first user gesture (see ensureContext / decodeBuffers). Safe to call
   * repeatedly; the fetch pass runs only once. No-op in SSR / tests.
   */
  public preload(): void {
    this.loadSamples();
    // Attach the gesture/resume hooks NOW (they do not touch audio): the
    // first user gesture must be able to create the context itself, so the
    // unlock listeners cannot wait for ensureContext().
    this.armResumeHooks();
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

    const index = this.pickSourceIndex();
    const buffer = this.buffers[index];
    if (!buffer) {
      // First decode still in flight (very first interaction) — queue the cue
      // and play it the moment the buffers are ready.
      this.pending.push(index);
      this.loadSamples();
      return;
    }

    // Every cue goes through the deterministic drain gate: it fires only when
    // the audio clock is provably advancing (see drainPending).
    this.pending.push(index);
    this.drainPending();
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

  /**
   * Bring a non-running context back to `running` and drain any queued cues
   * once it is. Handles BOTH paused states the Web Audio spec defines:
   *   • `suspended` — autoplay policy block / hidden-tab freeze, and
   *   • `interrupted` — the UA paused the context (iOS Safari backgrounding,
   *     screen lock, phone call), which the MDN `BaseAudioContext.state`
   *     docs say to lift with resume().
   * A resume() without user activation (autoplay still blocking) or while an
   * interruption is ongoing REJECTS (and a not-allowed-to-start resume may
   * HANG — WebAudio spec #1759): the cues stay queued and the next
   * gesture / visibilitychange retries, so a click is never lost to a
   * swallowed rejection.
   */
  private resumeAndDrain(): Promise<void> {
    const ctx = this.ctx;
    if (!ctx) return Promise.resolve();
    if (ctx.state === 'running') {
      this.drainPending();
      return Promise.resolve();
    }
    // One resume at a time: while the device is reopening, further hooks and
    // turns just queue cues and wait for this settle (drainPending runs when
    // it lands). Avoids stacking redundant resume() calls.
    if (this.resumeInFlight) return Promise.resolve();
    this.resumeInFlight = true;
    const finish = () => {
      this.resumeInFlight = false;
    };
    return ctx
      .resume()
      .then(() => {
        this.drainPending();
        finish();
      })
      .catch(() => {
        // Still blocked (no user activation) or still interrupted — the cue
        // stays queued; the next gesture / visibilitychange retries, so a
        // click is never lost to a swallowed rejection.
        finish();
      });
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
    } catch {
      // A sample that failed to decode or start stays silent; the rest play.
    }
  }

  /**
   * Play every cue that is ready — gated on the audio clock ACTUALLY
   * advancing, never on `state === 'running'` alone.
   *
   * Why the gate: Chromium resolves resume() and flips the context back to
   * 'running' while the audio device is still reopening after the tab was
   * hidden — currentTime stays frozen for up to ~1 s (crbug.com/41302928).
   * A source started on that frozen clock stays silent until the device is
   * ready, which is exactly the "sound comes out a while later" bug. When
   * the device is warm the very first check passes (no added latency); when
   * it is cold the cue plays the instant the clock ticks — the earliest
   * possible moment. Safe to call from any trigger (statechange → running,
   * resume() resolution, decode completion, play) — idempotent because
   * draining empties the queue and the drainToken supersedes stale polls.
   */
  private drainPending(): void {
    if (this.pending.length === 0 || !this.ctx) return;
    const ctx = this.ctx;

    if (ctx.state !== 'running') {
      // Context still paused (autoplay block / hidden tab / interrupted) —
      // keep the cues; the resume path re-drains them once it runs.
      void this.resumeAndDrain();
      return;
    }

    const token = ++this.drainToken;
    const baseline = ctx.currentTime;

    const poll = () => {
      // A newer drain attempt supersedes this one (it holds a fresher
      // baseline), and an empty queue means everything already fired.
      if (token !== this.drainToken || this.pending.length === 0) return;

      if (ctx.currentTime > baseline) {
        const volume = preferencesStore.getState().soundVolume / 100;
        const pending = this.pending;
        this.pending = [];
        for (const index of pending) {
          const buffer = this.buffers[index];
          if (buffer) this.startSource(index, volume);
          else if (!this.decodeDone) this.pending.push(index);
          // else: that sample failed to decode — drop the cue, stay silent.
        }
        // Cues re-queued because their sample is still decoding → re-drain.
        if (this.pending.length > 0) this.drainPending();
      } else if (ctx.state !== 'running') {
        // Context paused mid-wait (tab hidden again) — hand back to the
        // resume path, which re-drains when it runs.
        void this.resumeAndDrain();
      } else {
        // Clock still frozen (device reopening) — check again shortly.
        setTimeout(poll, 8);
      }
    };
    poll();
  }

  /** Fetch every sample's bytes (idempotent); decode once a context exists. */
  private loadSamples(): void {
    if (this.loadingStarted) return;
    this.loadingStarted = true;

    void Promise.all(
      this.sources.map(async (url, i) => {
        try {
          const response = await fetch(url);
          this.rawBuffers[i] = await response.arrayBuffer();
        } catch {
          this.buffers[i] = null; // a failed sample stays silent; the rest play
        }
      }),
    ).then(() => {
      this.decodeBuffers();
    });
  }

  /**
   * Decode every fetched sample into an AudioBuffer. No-op until the
   * AudioContext exists — which only happens on the first user gesture, so
   * the decode is never run before the browser allows audio. Idempotent.
   */
  private decodeBuffers(): void {
    if (this.decodeStarted) return;
    const ctx = this.ctx;
    if (!ctx) return;
    if (!this.rawBuffers.some((raw) => raw !== null && raw !== undefined)) return;
    this.decodeStarted = true;

    void Promise.all(
      this.rawBuffers.map(async (raw, i) => {
        if (!raw || this.buffers[i]) return;
        try {
          this.buffers[i] = await ctx.decodeAudioData(raw);
        } catch {
          this.buffers[i] = null; // a failed sample stays silent; the rest play
        }
      }),
    ).then(() => {
      this.decodeDone = true;
      this.drainPending();
    });
  }

  /**
   * Attach the deterministic resume hooks once, the first time the context is
   * created. The device-reopen work starts at the EARLIEST signal after the
   * user returns (visibilitychange → focus → first pointermove), so the
   * measured ~0.5-1 s reopen overlaps with the user approaching the cube
   * instead of with the turn itself:
   *   1. `visibilitychange` → resume as soon as the tab becomes visible again.
   *   2. `focus` → resume when the window regains focus (covers window
   *      switches that don't flip document visibility in some browsers).
   *   3. `pointermove` (permanent, guarded) → resume on the first mouse
   *      movement after returning, before the actual layer drag.
   *   4. First gesture (pointer/key/touch) anywhere in the app → unlocks the
   *      autoplay-suspended context created by `preload()` before any
   *      interaction, and self-removes afterwards.
   */
  private armResumeHooks(): void {
    if (this.resumeHooksArmed) return;
    this.resumeHooksArmed = true;

    const root = this.getRoot();
    const doc = root.document;
    if (doc && typeof doc.addEventListener === 'function') {
      doc.addEventListener('visibilitychange', () => {
        // Only resume a context the user has already unlocked. Before the
        // first gesture Chrome REJECTS resume() and logs "The AudioContext
        // was not allowed to start" for every call (autoplay policy) — that
        // was the console flood on fresh load, where these hooks fired before
        // any gesture. After a gesture the context stays unlocked, so the
        // eager resume here starts the device reopen the moment the user
        // returns to the tab.
        if (!doc.hidden && this.everRan) {
          void this.resumeAndDrain();
        }
      });
    }

    if (typeof root.addEventListener === 'function') {
      root.addEventListener('focus', () => {
        if (this.everRan) void this.resumeAndDrain();
      });

      const onMove = () => {
        if (this.ctx && this.ctx.state !== 'running' && this.everRan) void this.resumeAndDrain();
      };
      root.addEventListener('pointermove', onMove, { passive: true });
      // Fallback for browsers without Pointer Events (Safari < 13).
      root.addEventListener('mousemove', onMove, { passive: true });

      // The FIRST real gesture (pointer/key/touch/click) unlocks the
      // autoplay-suspended context and self-removes afterwards. (No
      // warm-keep media loop: the background audio it played to keep the OS
      // device open was audible and annoying — the turn sounds now simply
      // wait for the clock-gated resume on the first turn after a pause.)
      const unlock = () => {
        // Create the context inside the gesture itself (autoplay policy —
        // creating it on mount would leave it blocked and log a console
        // warning), then decode the pre-warmed bytes.
        this.ensureContext();
        void this.resumeAndDrain();
        for (const type of UNLOCK_GESTURES) {
          root.removeEventListener(type, unlock);
        }
      };
      for (const type of UNLOCK_GESTURES) {
        root.addEventListener(type, unlock, { passive: true });
      }
    }
  }

  private getRoot(): AudioRoot {
    return (typeof window !== 'undefined' ? window : globalThis) as AudioRoot;
  }

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;

    const root = this.getRoot();
    const Ctor = root.AudioContext ?? root.webkitAudioContext;
    if (!Ctor) return null;

    try {
      this.ctx = new Ctor();
    } catch {
      // Context creation can fail (browser limit / unavailable) — stay silent.
      return null;
    }
    // Drain any queued cues the moment the context comes back to `running` —
    // via our resume(), a user-gesture unlock, or the browser's own
    // auto-resume when the tab returns. drainPending itself is clock-gated,
    // so firing into a frozen clock never happens.
    this.ctx.onstatechange = () => {
      if (this.ctx?.state === 'running') {
        // Reaching 'running' means a user gesture unlocked the context — from
        // then on the non-gesture hooks may resume eagerly.
        this.everRan = true;
        this.drainPending();
      }
    };
    // The context exists only from the first user gesture, so the decode of
    // the pre-warmed bytes can (and should) start right away.
    this.decodeBuffers();
    this.armResumeHooks();
    return this.ctx;
  }
}

/** App-wide singleton (the components import this, not the class). */
export const cubeTurnSounds = new CubeTurnSounds();
