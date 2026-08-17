import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { preferencesStore } from '@cubeforge/state';
import { CubeTurnSounds } from '../cubeTurnSounds';

/**
 * Minimal Web Audio stand-ins: node has no AudioContext / AudioBuffer, and the
 * module only touches the Web Audio graph lazily, so fakes are enough to
 * assert fetch/decode/playback wiring without a browser.
 *
 * Lazy-context contract: `preload()` only warms the fetch of the sample
 * bytes — the AudioContext is created on the FIRST user gesture (unlock),
 * never on mount, because creating one before any interaction leaves it
 * autoplay-blocked and Chrome logs "The AudioContext was not allowed to
 * start". Tests that need a decoded context therefore dispatch the first
 * gesture (`pointerdown`) as part of their setup.
 */
class FakeAudioBuffer {
  duration = 0.3;
  get length(): number {
    return Math.round(44100 * this.duration);
  }
  get sampleRate(): number {
    return 44100;
  }
  get numberOfChannels(): number {
    return 1;
  }
}

class FakeGainNode {
  gain = { value: 1 };
  connect = vi.fn();
  disconnect = vi.fn();
}

class FakeBufferSource {
  buffer: FakeAudioBuffer | null = null;
  start = vi.fn();
  stop = vi.fn();
  connect = vi.fn();
  disconnect = vi.fn();
  onended: (() => void) | null = null;
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  /** One-shot sources started, in order (each play = one node). */
  static sources: FakeBufferSource[] = [];
  /** Gain nodes created, in order (used to assert per-play volume). */
  static gains: FakeGainNode[] = [];
  /** Buffers produced by decodeAudioData, in creation order. */
  static decodedBuffers: FakeAudioBuffer[] = [];
  /** Resolvers for in-flight decodeAudioData calls, in call order. */
  static decodeResolvers: (() => void)[] = [];

  state: AudioContextState = 'suspended';
  /**
   * When false (default) the clock advances on every read, modelling a warm
   * device whose render thread is pulling the graph. When true the clock
   * only moves when the test calls tick() — modelling the frozen clock
   * Chromium shows while the audio device is still reopening after the tab
   * was hidden: state flips to 'running' but currentTime stays put for up to
   * ~1 s (crbug.com/41302928).
   */
  clockFrozen = false;
  private _currentTime = 0;
  get currentTime(): number {
    if (!this.clockFrozen) this._currentTime += 0.001;
    return this._currentTime;
  }
  set currentTime(value: number) {
    this._currentTime = value;
  }
  /** Advance the clock (only meaningful while `clockFrozen`). */
  tick(dt = 0.1): void {
    this._currentTime += dt;
  }
  destination = {};
  /** Browser statechange notification (fires on every state transition). */
  onstatechange: (() => void) | null = null;
  resume = vi.fn(() => {
    this.setState('running');
    return Promise.resolve();
  });
  close = vi.fn(() => Promise.resolve());
  decodeAudioData = vi.fn(() => {
    return new Promise<FakeAudioBuffer>((resolve) => {
      FakeAudioContext.decodeResolvers.push(() => {
        const buffer = new FakeAudioBuffer();
        FakeAudioContext.decodedBuffers.push(buffer);
        resolve(buffer);
      });
    });
  });
  createBufferSource = vi.fn(() => {
    const source = new FakeBufferSource();
    FakeAudioContext.sources.push(source);
    return source;
  });
  createGain = vi.fn(() => {
    const gain = new FakeGainNode();
    FakeAudioContext.gains.push(gain);
    return gain;
  });

  constructor() {
    FakeAudioContext.instances.push(this);
  }

  /** Transition the state and notify the context's statechange handler. */
  setState(next: AudioContextState): void {
    this.state = next;
    this.onstatechange?.();
  }
}

/** Minimal window/document stand-in that records listeners and can dispatch. */
class FakeEventTarget {
  private listeners = new Map<string, Set<() => void>>();

  addEventListener(type: string, listener: () => void): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: () => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type: string): void {
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener();
  }

  count(type: string): number {
    return this.listeners.get(type)?.size ?? 0;
  }
}

const random = (value: number) => () => value;

let fetchMock: ReturnType<typeof vi.fn>;
/** Stubbed `window` (carries AudioContext + gesture listeners + document). */
let windowTarget: FakeEventTarget & {
  AudioContext: typeof FakeAudioContext;
  document: FakeEventTarget & { hidden: boolean };
};
/** Stubbed `document` (carries `hidden` + the visibilitychange listener). */
let documentTarget: FakeEventTarget & { hidden: boolean };

/** Resolve every in-flight decodeAudioData call with a fresh buffer. */
const flushDecodes = () => {
  const resolvers = FakeAudioContext.decodeResolvers.splice(0);
  for (const resolve of resolvers) resolve();
};

/** Wait for all 4 samples to be decoding, resolve them, and await the buffers. */
const decodeAll = async () => {
  await vi.waitFor(() => {
    expect(FakeAudioContext.instances[0].decodeAudioData).toHaveBeenCalledTimes(4);
  });
  flushDecodes();
  await vi.waitFor(() => expect(FakeAudioContext.decodedBuffers).toHaveLength(4));
};

/**
 * Standard setup: warm the fetch, then fire the FIRST user gesture, which
 * creates the AudioContext (autoplay policy forbids creating it on mount)
 * and starts the decode of the pre-warmed bytes. Returns the player.
 */
const initWarmPlayer = async () => {
  const player = new CubeTurnSounds();
  player.preload();
  windowTarget.dispatch('pointerdown');
  await flushMicrotasks();
  await decodeAll();
  return player;
};

/** Flush the microtask queue so resume().then() / statechange drains settle. */
const flushMicrotasks = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('CubeTurnSounds', () => {
  beforeEach(() => {
    FakeAudioContext.instances = [];
    FakeAudioContext.sources = [];
    FakeAudioContext.gains = [];
    FakeAudioContext.decodedBuffers = [];
    FakeAudioContext.decodeResolvers = [];
    vi.stubGlobal('AudioContext', FakeAudioContext);
    windowTarget = new FakeEventTarget() as FakeEventTarget & {
      AudioContext: typeof FakeAudioContext;
      document: FakeEventTarget & { hidden: boolean };
    };
    windowTarget.AudioContext = FakeAudioContext;
    documentTarget = new FakeEventTarget() as FakeEventTarget & { hidden: boolean };
    documentTarget.hidden = false;
    // Mirrors the browser, where window.document === document.
    windowTarget.document = documentTarget;
    vi.stubGlobal('window', windowTarget);
    vi.stubGlobal('document', documentTarget);
    fetchMock = vi.fn(async () => ({
      arrayBuffer: async () => new ArrayBuffer(8),
    }));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    // Restore defaults so tests never leak prefs into each other.
    preferencesStore.getState().setNotificationsEnabled(true);
    preferencesStore.getState().setSoundsEnabled(true);
    preferencesStore.getState().setSoundVolume(80);
    preferencesStore.getState().setCubeTurnSoundsEnabled(true);
  });

  it('picks a valid source index within range', () => {
    const player = new CubeTurnSounds();
    for (const value of [0, 0.2499, 0.5, 0.9999]) {
      const idx = player.pickSourceIndex(random(value));
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(4);
    }
  });

  it('never repeats the same source back-to-back', () => {
    const player = new CubeTurnSounds();
    const first = player.pickSourceIndex(random(0)); // 0
    const second = player.pickSourceIndex(random(0)); // same roll → bumped
    const third = player.pickSourceIndex(random(0.3)); // 1 → bumped to 2
    expect(second).not.toBe(first);
    expect(third).not.toBe(second);
  });

  it('preload warms the fetch but does NOT create the AudioContext before a gesture', async () => {
    const player = new CubeTurnSounds();
    player.preload();
    // Autoplay policy: no context on mount (creating one would log "The
    // AudioContext was not allowed to start") — only the bytes are fetched.
    expect(FakeAudioContext.instances).toHaveLength(0);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    // First gesture creates the context and decodes the pre-warmed bytes.
    windowTarget.dispatch('pointerdown');
    await flushMicrotasks();
    await decodeAll();
    expect(FakeAudioContext.instances).toHaveLength(1);
    // The first turn after decode fires a one-shot source immediately.
    player.play();
    expect(FakeAudioContext.sources).toHaveLength(1);
    expect(FakeAudioContext.sources[0].buffer).toBeInstanceOf(FakeAudioBuffer);
    expect(FakeAudioContext.sources[0].start).toHaveBeenCalled();
  });

  it('never plays the same source twice in a row, even on rapid turns', async () => {
    const player = await initWarmPlayer();
    for (let i = 0; i < 30; i++) player.play();
    expect(FakeAudioContext.sources).toHaveLength(30);
    const bufferIndexOf = (b: FakeAudioBuffer | null) =>
      b === null ? -1 : FakeAudioContext.decodedBuffers.indexOf(b);
    for (let i = 1; i < FakeAudioContext.sources.length; i++) {
      expect(bufferIndexOf(FakeAudioContext.sources[i].buffer)).not.toBe(
        bufferIndexOf(FakeAudioContext.sources[i - 1].buffer),
      );
    }
  });

  it('does nothing when sounds are disabled', () => {
    preferencesStore.getState().setSoundsEnabled(false);
    const player = new CubeTurnSounds();
    player.play();
    expect(FakeAudioContext.instances).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does nothing when cube turn sounds are disabled', () => {
    preferencesStore.getState().setCubeTurnSoundsEnabled(false);
    const player = new CubeTurnSounds();
    player.play();
    expect(FakeAudioContext.instances).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('queues turns that land before the first decode and plays them once ready', async () => {
    const player = new CubeTurnSounds();
    player.play();
    player.play();
    // Decode still in flight → nothing audible yet, both cues queued.
    expect(FakeAudioContext.sources).toHaveLength(0);
    await decodeAll();
    await vi.waitFor(() => expect(FakeAudioContext.sources).toHaveLength(2));
    expect(FakeAudioContext.sources[0].buffer).toBeInstanceOf(FakeAudioBuffer);
    expect(FakeAudioContext.sources[1].buffer).toBeInstanceOf(FakeAudioBuffer);
  });

  it('scales playback volume from the soundVolume preference', async () => {
    preferencesStore.getState().setSoundVolume(35);
    const player = await initWarmPlayer();
    player.play();
    expect(FakeAudioContext.gains[0]?.gain.value).toBeCloseTo(0.35);
  });

  it('resumes a suspended AudioContext when returning to the tab', async () => {
    const player = await initWarmPlayer();
    const ctx = FakeAudioContext.instances[0];
    // Simulate the background-tab freeze Chrome applies while the tab is hidden.
    ctx.setState('suspended');
    player.play();
    expect(ctx.resume).toHaveBeenCalled();
    expect(ctx.state).toBe('running');
    await flushMicrotasks();
    expect(FakeAudioContext.sources).toHaveLength(1);
  });

  it('eagerly resumes the context when the tab becomes visible again, before the user acts', async () => {
    const player = await initWarmPlayer();
    const ctx = FakeAudioContext.instances[0];
    // The user has already used the app (the setup gesture unlocked it).
    expect(ctx.state).toBe('running');
    // Chrome suspended the context while the tab was hidden…
    ctx.setState('suspended');
    // …and the user returns to the tab: visibilitychange fires BEFORE any new
    // gesture, so the device reopen starts and the clock is already running
    // when they turn the cube.
    documentTarget.hidden = false;
    documentTarget.dispatch('visibilitychange');
    expect(ctx.resume).toHaveBeenCalledTimes(2);
    expect(ctx.state).toBe('running');
    // A turn now is deterministic: no resume round-trip, instant source.
    player.play();
    expect(FakeAudioContext.sources).toHaveLength(1);
  });

  it('does not resume while the tab is still hidden', async () => {
    await initWarmPlayer();
    const ctx = FakeAudioContext.instances[0];
    ctx.setState('suspended');
    documentTarget.hidden = true;
    documentTarget.dispatch('visibilitychange');
    // No NEW resume from the hidden-tab hook (the setup unlock is the only one).
    expect(ctx.resume).toHaveBeenCalledTimes(1);
    expect(ctx.state).toBe('suspended');
  });

  it('resumes the context when the window regains focus', async () => {
    await initWarmPlayer();
    const ctx = FakeAudioContext.instances[0];
    expect(ctx.resume).toHaveBeenCalledTimes(1);
    expect(ctx.state).toBe('running');
    // Leaves the tab → Chrome suspends the context.
    ctx.setState('suspended');
    // Window regains focus → eager resume (context already unlocked).
    windowTarget.dispatch('focus');
    expect(ctx.resume).toHaveBeenCalledTimes(2);
    expect(ctx.state).toBe('running');
    // A second focus while running is a cheap no-op — no extra resume.
    windowTarget.dispatch('focus');
    expect(ctx.resume).toHaveBeenCalledTimes(2);
  });

  it('starts the device reopen on the first pointermove after returning (before the turn)', async () => {
    await initWarmPlayer();
    const ctx = FakeAudioContext.instances[0];
    expect(ctx.resume).toHaveBeenCalledTimes(1);
    expect(ctx.state).toBe('running');
    // Leaves the tab → Chrome suspends the context.
    ctx.setState('suspended');
    // User returns and moves the mouse toward the cube — this fires hundreds
    // of ms before the actual layer drag, so the audio device reopen overlaps
    // with the approach instead of with the turn.
    windowTarget.dispatch('pointermove');
    expect(ctx.resume).toHaveBeenCalledTimes(2);
    expect(ctx.state).toBe('running');
    // While running, pointer moves must not hammer resume() — guarded no-op.
    windowTarget.dispatch('pointermove');
    windowTarget.dispatch('mousemove');
    expect(ctx.resume).toHaveBeenCalledTimes(2);
  });

  it('does not create a context or resume from non-gesture hooks before the first user gesture (autoplay)', async () => {
    const player = new CubeTurnSounds();
    player.preload();
    // Fresh load: preload only warms the fetch — there is NO context yet.
    expect(FakeAudioContext.instances).toHaveLength(0);
    // The non-gesture hooks fire (visibilitychange on load, window focus,
    // mouse movement) but have nothing to resume — and they never create the
    // context either, so Chrome cannot log "The AudioContext was not allowed
    // to start" before the user interacts.
    documentTarget.dispatch('visibilitychange');
    windowTarget.dispatch('focus');
    windowTarget.dispatch('pointermove');
    windowTarget.dispatch('mousemove');
    expect(FakeAudioContext.instances).toHaveLength(0);
  });

  it('does not stack redundant resume() calls while one is in flight', async () => {
    const player = await initWarmPlayer();
    const ctx = FakeAudioContext.instances[0];
    // The user left the tab (context suspended).
    ctx.setState('suspended');
    // The next device reopen is slow: the resume stays pending…
    let finishResume!: () => void;
    ctx.resume.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishResume = () => {
            ctx.setState('running');
            resolve();
          };
        }),
    );
    // …while several hooks and turns fire. Only ONE resume() may start.
    windowTarget.dispatch('visibilitychange');
    player.play();
    player.play();
    expect(ctx.resume).toHaveBeenCalledTimes(2); // unlock + the in-flight one
    expect(FakeAudioContext.sources).toHaveLength(0);
    // The reopen completes → the queued cues play.
    finishResume();
    await flushMicrotasks();
    expect(FakeAudioContext.sources).toHaveLength(2);
  });

  it('treats the interrupted state like suspended (iOS Safari backgrounding)', async () => {
    const player = await initWarmPlayer();
    const ctx = FakeAudioContext.instances[0];
    // iOS Safari moves the context to 'interrupted' when the user leaves the
    // page (tab switch / screen lock) — MDN documents resume() as the fix.
    ctx.setState('interrupted');
    player.play();
    expect(ctx.resume).toHaveBeenCalled();
    expect(ctx.state).toBe('running');
    await flushMicrotasks();
    expect(FakeAudioContext.sources).toHaveLength(1);
  });

  it('never starts a source on a frozen clock — the cue plays when the context runs', async () => {
    const player = await initWarmPlayer();
    const ctx = FakeAudioContext.instances[0];
    // A suspended context whose resume completes LATER (real browsers resolve
    // the promise asynchronously). The turn must not fire into silence.
    ctx.setState('suspended');
    let finishResume!: () => void;
    ctx.resume.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishResume = () => {
            ctx.setState('running');
            resolve();
          };
        }),
    );
    player.play();
    // Clock still frozen → the cue is queued, nothing audible yet.
    expect(FakeAudioContext.sources).toHaveLength(0);
    finishResume();
    await flushMicrotasks();
    expect(FakeAudioContext.sources).toHaveLength(1);
    expect(FakeAudioContext.sources[0].start).toHaveBeenCalled();
  });

  it('does not fire a source on a running context whose clock is still frozen (device reopening)', async () => {
    const player = await initWarmPlayer();
    const ctx = FakeAudioContext.instances[0];
    // Chromium flips the context back to 'running' while the audio device is
    // still reopening after the tab was hidden — currentTime stays frozen for
    // up to ~1 s (crbug.com/41302928). Firing into that frozen clock is the
    // "sound comes out a while later" bug, so nothing may play yet.
    ctx.clockFrozen = true;
    player.play();
    expect(FakeAudioContext.sources).toHaveLength(0);
    // Let resume() settle: the clock-gate is now polling the frozen clock.
    await flushMicrotasks();
    expect(FakeAudioContext.sources).toHaveLength(0);
    // The device finishes reopening → the clock ticks → the cue plays NOW.
    ctx.tick(0.1);
    await vi.waitFor(() => expect(FakeAudioContext.sources).toHaveLength(1));
    expect(FakeAudioContext.sources[0].start).toHaveBeenCalled();
  });

  it('plays immediately when the audio clock is warm (no added latency)', async () => {
    const player = await initWarmPlayer();
    // Warm device (default fake): currentTime advances on every read, so the
    // clock gate passes on the very first check — the turn is instant.
    expect(FakeAudioContext.instances[0].clockFrozen).toBe(false);
    player.play();
    expect(FakeAudioContext.sources).toHaveLength(1);
  });

  it('a stale clock-wait poll never double-plays a newer cue', async () => {
    const player = await initWarmPlayer();
    const ctx = FakeAudioContext.instances[0];
    ctx.clockFrozen = true;
    player.play(); // cue A queued; its clock-wait poll starts (baseline 0)
    await flushMicrotasks(); // resume settles → poll A is now waiting
    ctx.tick(0.1); // device reopens → currentTime 0.1
    player.play(); // cue B queued; a new drain supersedes poll A (baseline 0.1)
    await flushMicrotasks();
    ctx.tick(0.1); // currentTime 0.2 → past both baselines
    await vi.waitFor(() => expect(FakeAudioContext.sources).toHaveLength(2));
    // Exactly two — the stale poll A must not flush anything on its own.
    await flushMicrotasks();
    expect(FakeAudioContext.sources).toHaveLength(2);
  });

  it('keeps a cue queued when resume rejects (no user activation) and plays it on the next gesture', async () => {
    const player = new CubeTurnSounds();
    player.preload();
    // The first turn creates the context (in a real browser a turn IS a
    // gesture; the fake has no autoplay gate).
    player.play();
    const ctx = FakeAudioContext.instances[0];
    // Decode of the pre-warmed bytes completes and cue A plays (resume #1).
    await decodeAll();
    await flushMicrotasks();
    expect(FakeAudioContext.sources).toHaveLength(1);
    // The tab was hidden with no user activation → Chrome rejects the next
    // resume (NotAllowedError) — the old code dropped the click.
    ctx.setState('suspended');
    expect(ctx.resume).toHaveBeenCalledTimes(1);
    ctx.resume.mockRejectedValueOnce(new DOMException('', 'NotAllowedError'));
    player.play();
    await flushMicrotasks();
    // Cue B stays queued — only cue A has played, nothing was dropped.
    expect(FakeAudioContext.sources).toHaveLength(1);
    // The next real gesture unlocks the autoplay-suspended context…
    windowTarget.dispatch('pointerdown');
    expect(ctx.state).toBe('running');
    await flushMicrotasks();
    // …and the queued turn finally plays — nothing was lost.
    expect(FakeAudioContext.sources).toHaveLength(2);
  });

  it('drains queued cues when the browser itself brings the context back to running', async () => {
    const player = await initWarmPlayer();
    const ctx = FakeAudioContext.instances[0];
    ctx.setState('suspended');
    ctx.resume.mockRejectedValue(new DOMException('', 'NotAllowedError'));
    player.play();
    await flushMicrotasks();
    expect(FakeAudioContext.sources).toHaveLength(0);
    // Chrome auto-resumes the context when the tab becomes visible again —
    // the statechange handler drains the cue without any further play().
    ctx.setState('running');
    await flushMicrotasks();
    expect(FakeAudioContext.sources).toHaveLength(1);
  });

  it('creates the context on the first user gesture and self-removes the unlock hooks', async () => {
    const player = new CubeTurnSounds();
    player.preload();
    // Autoplay policy: NOTHING before the first gesture (not even a context).
    expect(FakeAudioContext.instances).toHaveLength(0);
    windowTarget.dispatch('pointerdown');
    expect(FakeAudioContext.instances).toHaveLength(1);
    const ctx = FakeAudioContext.instances[0];
    expect(ctx.resume).toHaveBeenCalled();
    expect(ctx.state).toBe('running');
    // The one-time unlock listeners are removed after the first gesture.
    for (const type of ['pointerdown', 'mousedown', 'touchstart', 'keydown', 'click']) {
      expect(windowTarget.count(type)).toBe(0);
    }
  });

  it('reuses the decoded buffers instead of refetching on every turn', async () => {
    const player = await initWarmPlayer();
    for (let i = 0; i < 25; i++) player.play();
    expect(fetchMock).toHaveBeenCalledTimes(4);
    // Every turn is a fresh one-shot node — fast turns overlap naturally.
    expect(FakeAudioContext.sources).toHaveLength(25);
  });

  it('plays turn sounds with no background audio loop', async () => {
    // Regression: the old warm-keep loop played a real (low-volume) sample
    // on repeat to keep the OS audio device open — users reported audible
    // background sound at all times. It must be gone: playback is purely
    // per-turn Web Audio, nothing loops between turns.
    const player = new CubeTurnSounds();
    player.preload();
    windowTarget.dispatch('pointerdown');
    await flushMicrotasks();
    await decodeAll();
    player.play();
    expect(FakeAudioContext.sources).toHaveLength(1);
  });
});
