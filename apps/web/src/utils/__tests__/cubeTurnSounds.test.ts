import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { preferencesStore } from '@cubeforge/state';
import { CubeTurnSounds } from '../cubeTurnSounds';

/**
 * Minimal Web Audio stand-ins: node has no AudioContext / AudioBuffer, and the
 * module only touches the Web Audio graph lazily, so fakes are enough to
 * assert fetch/decode/playback wiring without a browser.
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
  currentTime = 0;
  destination = {};
  resume = vi.fn(() => {
    this.state = 'running';
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
}

const random = (value: number) => () => value;

let fetchMock: ReturnType<typeof vi.fn>;

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

describe('CubeTurnSounds', () => {
  beforeEach(() => {
    FakeAudioContext.instances = [];
    FakeAudioContext.sources = [];
    FakeAudioContext.gains = [];
    FakeAudioContext.decodedBuffers = [];
    FakeAudioContext.decodeResolvers = [];
    vi.stubGlobal('AudioContext', FakeAudioContext);
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

  it('preload fetches and decodes every sample so the first turn is instant', async () => {
    const player = new CubeTurnSounds();
    player.preload();
    expect(FakeAudioContext.instances).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    await decodeAll();
    // The first turn after decode fires a one-shot source immediately.
    player.play();
    expect(FakeAudioContext.sources).toHaveLength(1);
    expect(FakeAudioContext.sources[0].buffer).toBeInstanceOf(FakeAudioBuffer);
    expect(FakeAudioContext.sources[0].start).toHaveBeenCalled();
  });

  it('never plays the same source twice in a row, even on rapid turns', async () => {
    const player = new CubeTurnSounds();
    player.preload();
    await decodeAll();
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
    const player = new CubeTurnSounds();
    player.preload();
    await decodeAll();
    player.play();
    expect(FakeAudioContext.gains[0]?.gain.value).toBeCloseTo(0.35);
  });

  it('resumes a suspended AudioContext when returning to the tab', async () => {
    const player = new CubeTurnSounds();
    player.preload();
    await decodeAll();
    const ctx = FakeAudioContext.instances[0];
    // Simulate the background-tab freeze Chrome applies while the tab is hidden.
    ctx.state = 'suspended';
    player.play();
    expect(ctx.resume).toHaveBeenCalled();
    expect(ctx.state).toBe('running');
    expect(FakeAudioContext.sources).toHaveLength(1);
  });

  it('reuses the decoded buffers instead of refetching on every turn', async () => {
    const player = new CubeTurnSounds();
    player.preload();
    await decodeAll();
    for (let i = 0; i < 25; i++) player.play();
    expect(fetchMock).toHaveBeenCalledTimes(4);
    // Every turn is a fresh one-shot node — fast turns overlap naturally.
    expect(FakeAudioContext.sources).toHaveLength(25);
  });
});
