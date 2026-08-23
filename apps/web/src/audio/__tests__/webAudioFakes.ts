/**
 * Shared Web Audio test doubles for the SoundManager suites.
 *
 * Node has no AudioContext / OfflineAudioContext / AudioBuffer, and the
 * manager only touches the Web Audio graph lazily, so these fakes are enough
 * to assert fetch → offline decode → gesture unlock → playback wiring without
 * a browser.
 *
 * Contracts the fakes model:
 *   • `OfflineAudioContext` decodes with NO user gesture (it is not an audio
 *     device — autoplay policy never applies). The manager decodes every
 *     sample there during `preload()`.
 *   • The live `AudioContext` is created ONLY on the first user gesture.
 *     Its clock advances on every `currentTime` read (warm device); tests
 *     can freeze it (`clockFrozen`) to model the frozen clock Chromium shows
 *     while the audio device reopens after a hidden tab (crbug.com/41302928).
 */
import { expect, vi } from "vitest";

export class FakeAudioParam {
  value = 1;
  setValueAtTime = vi.fn();
  linearRampToValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
  cancelScheduledValues = vi.fn();
  setTargetAtTime = vi.fn();
}

export class FakeAudioBuffer {
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

export class FakeGainNode {
  gain = new FakeAudioParam();
  connect = vi.fn();
  disconnect = vi.fn();
}

export class FakeBufferSource {
  buffer: FakeAudioBuffer | null = null;
  playbackRate = new FakeAudioParam();
  start = vi.fn();
  stop = vi.fn();
  connect = vi.fn();
  disconnect = vi.fn();
  onended: (() => void) | null = null;
}

export class FakeStereoPanner {
  pan = new FakeAudioParam();
  connect = vi.fn();
  disconnect = vi.fn();
}

export class FakeOscillator {
  type: OscillatorType = "sine";
  frequency = new FakeAudioParam();
  start = vi.fn();
  stop = vi.fn();
  connect = vi.fn();
  disconnect = vi.fn();
  onended: (() => void) | null = null;
}

export class FakeDynamicsCompressor {
  threshold = new FakeAudioParam();
  knee = new FakeAudioParam();
  ratio = new FakeAudioParam();
  attack = new FakeAudioParam();
  release = new FakeAudioParam();
  connect = vi.fn();
  disconnect = vi.fn();
}

/**
 * Live-context fake. Graph nodes are recorded in creation order on the static
 * arrays; `decodeAudioData` resolves only when the test flushes its
 * resolvers, mirroring the asynchronous real-world decode.
 */
export class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  static sources: FakeBufferSource[] = [];
  static gains: FakeGainNode[] = [];
  static compressors: FakeDynamicsCompressor[] = [];
  static panNodes: FakeStereoPanner[] = [];
  static oscillators: FakeOscillator[] = [];
  static decodedBuffers: FakeAudioBuffer[] = [];
  static decodeResolvers: (() => void)[] = [];

  state: AudioContextState = "suspended";
  /**
   * When false (default) the clock advances on every read, modelling a warm
   * device. When true the clock only moves when the test calls tick() —
   * modelling the frozen clock Chromium shows while the audio device is
   * still reopening after the tab was hidden.
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
    this.setState("running");
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
  createDynamicsCompressor = vi.fn(() => {
    const compressor = new FakeDynamicsCompressor();
    FakeAudioContext.compressors.push(compressor);
    return compressor;
  });
  createStereoPanner = vi.fn(() => {
    const panner = new FakeStereoPanner();
    FakeAudioContext.panNodes.push(panner);
    return panner;
  });
  createOscillator = vi.fn(() => {
    const osc = new FakeOscillator();
    FakeAudioContext.oscillators.push(osc);
    return osc;
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

/** Offline context: decodes with NO user gesture (autoplay-free). */
export class FakeOfflineAudioContext {
  static instances: FakeOfflineAudioContext[] = [];
  static decodedBuffers: FakeAudioBuffer[] = [];
  static decodeResolvers: (() => void)[] = [];

  decodeAudioData = vi.fn(() => {
    return new Promise<FakeAudioBuffer>((resolve) => {
      FakeOfflineAudioContext.decodeResolvers.push(() => {
        const buffer = new FakeAudioBuffer();
        FakeOfflineAudioContext.decodedBuffers.push(buffer);
        resolve(buffer);
      });
    });
  });

  constructor() {
    FakeOfflineAudioContext.instances.push(this);
  }
}

/** Minimal event target that records listeners and can dispatch them. */
export class FakeEventTarget {
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

export type AudioTestEnv = {
  windowTarget: FakeEventTarget & {
    AudioContext: typeof FakeAudioContext;
    OfflineAudioContext: typeof FakeOfflineAudioContext;
    document: FakeEventTarget & { hidden: boolean };
  };
  documentTarget: FakeEventTarget & { hidden: boolean };
  fetchMock: ReturnType<typeof vi.fn>;
};

/**
 * Stub the browser globals with the fakes. Returns the window/document
 * targets (which carry the gesture listeners + `hidden`) and the fetch mock.
 */
export const setupAudioTestEnv = (): AudioTestEnv => {
  vi.stubGlobal("AudioContext", FakeAudioContext);
  vi.stubGlobal("OfflineAudioContext", FakeOfflineAudioContext);

  const windowTarget = new FakeEventTarget() as AudioTestEnv["windowTarget"];
  windowTarget.AudioContext = FakeAudioContext;
  windowTarget.OfflineAudioContext = FakeOfflineAudioContext;
  const documentTarget = new FakeEventTarget() as AudioTestEnv["documentTarget"];
  documentTarget.hidden = false;
  // Mirrors the browser, where window.document === document.
  windowTarget.document = documentTarget;

  vi.stubGlobal("window", windowTarget);
  vi.stubGlobal("document", documentTarget);

  const fetchMock = vi.fn(async () => ({
    arrayBuffer: async () => new ArrayBuffer(8),
  }));
  vi.stubGlobal("fetch", fetchMock);

  return { windowTarget, documentTarget, fetchMock };
};

/** Reset every static registry so tests never leak nodes/decodes into each other. */
export const resetAudioFakes = (): void => {
  FakeAudioContext.instances = [];
  FakeAudioContext.sources = [];
  FakeAudioContext.gains = [];
  FakeAudioContext.compressors = [];
  FakeAudioContext.panNodes = [];
  FakeAudioContext.oscillators = [];
  FakeAudioContext.decodedBuffers = [];
  FakeAudioContext.decodeResolvers = [];
  FakeOfflineAudioContext.instances = [];
  FakeOfflineAudioContext.decodedBuffers = [];
  FakeOfflineAudioContext.decodeResolvers = [];
};

/** Resolve every queued offline decode (returns how many were flushed). */
export const flushOfflineDecodes = (): number => {
  const resolvers = FakeOfflineAudioContext.decodeResolvers.splice(0);
  for (const resolve of resolvers) resolve();
  return resolvers.length;
};

/** Resolve every queued live-context decode. */
export const flushLiveDecodes = (): void => {
  const resolvers = FakeAudioContext.decodeResolvers.splice(0);
  for (const resolve of resolvers) resolve();
};

/**
 * Wait until `count` offline decodes are in flight, flush them, and let the
 * preload chain settle. Mirrors "the asset bank is fully warm" in a browser.
 */
export const warmOfflineAssets = async (count: number): Promise<void> => {
  await vi.waitFor(() => {
    expect(FakeOfflineAudioContext.decodeResolvers.length).toBeGreaterThanOrEqual(count);
  });
  flushOfflineDecodes();
  // Let decodeAudioData's promise + the preload .then() settle.
  await new Promise((resolve) => setTimeout(resolve, 0));
};

/** Wait until `count` live-context decodes are in flight, then flush them. */
export const warmLiveAssets = async (count: number): Promise<void> => {
  await vi.waitFor(() => {
    expect(FakeAudioContext.decodeResolvers.length).toBeGreaterThanOrEqual(count);
  });
  flushLiveDecodes();
  await new Promise((resolve) => setTimeout(resolve, 0));
};

/** Flush the microtask queue so resume().then() / statechange drains settle. */
export const flushMicrotasks = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
