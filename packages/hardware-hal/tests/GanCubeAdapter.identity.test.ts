/**
 * The adapter's hardware identity, and the automatic reconnection.
 *
 * Two things are pinned here that the app now depends on:
 *
 *   • `identity$` must tell the truth in the two beats of the handshake (address
 *     first, model/firmware when the cube answers) and must never present the
 *     previous cube's name as the new cube's.
 *   • A link that drops must actually retry. It did not: `handleDisconnect` kept
 *     the dead connection object, and `attemptReconnect` bails out when one is
 *     present, so the retry never started and the UI kept claiming a connection.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Subject } from 'rxjs';

vi.mock('@cubalyze/gan-protocol', () => ({
  connectGanCube: vi.fn(),
  reconnectGanCube: vi.fn(),
}));

import { connectGanCube, reconnectGanCube } from '@cubalyze/gan-protocol';
import { GanCubeAdapter } from '../src/bluetooth/GanCubeAdapter';

interface FakeDevice {
  name?: string;
  mac?: string;
}

/**
 * Stand-in for `connectGanCube`: calls the adapter's MAC provider (so the
 * adapter stores the device), then stamps the address the protocol would have
 * resolved and hands back a controllable event stream.
 */
function mockConnect(options: { readMac?: string | null } = {}) {
  const events$ = new Subject<{ type: string; [key: string]: unknown }>();
  const device: FakeDevice = { name: 'GAN12ui' };

  vi.mocked(connectGanCube).mockImplementation((async (provider?: unknown) => {
    const requested =
      (await (provider as ((d: FakeDevice, fallback?: boolean) => Promise<string | null>) | undefined)?.(
        device,
        false,
      )) ?? null;
    device.mac = requested ?? options.readMac ?? undefined;
    return {
      sendCubeCommand: vi.fn().mockResolvedValue(undefined),
      events$: events$.asObservable(),
      disconnect: vi.fn().mockResolvedValue(undefined),
    };
  }) as never);

  vi.mocked(reconnectGanCube).mockImplementation((async () => ({
    sendCubeCommand: vi.fn().mockResolvedValue(undefined),
    events$: new Subject().asObservable(),
    disconnect: vi.fn().mockResolvedValue(undefined),
  })) as never);

  return { events$, device };
}

function hardwareEvent(overrides: Record<string, unknown> = {}) {
  return {
    type: 'HARDWARE',
    hardwareName: 'GAN12uiM',
    hardwareVersion: '2.1',
    softwareVersion: '1.3',
    productDate: '2024-05',
    gyroSupported: true,
    ...overrides,
  };
}

describe('GanCubeAdapter identity', () => {
  beforeEach(() => {
    vi.mocked(connectGanCube).mockReset();
    vi.mocked(reconnectGanCube).mockReset();
  });

  it('starts with no identity at all', () => {
    const adapter = new GanCubeAdapter();
    expect(adapter.identity).toBeNull();
  });

  it('publishes the address as soon as the link is up, with the model still unknown', async () => {
    mockConnect({ readMac: 'FFEEDDCCBBAA' });
    const adapter = new GanCubeAdapter();

    await adapter.connect();

    expect(adapter.identity).toEqual({
      vendor: 'GAN',
      model: null,
      mac: 'FFEEDDCCBBAA',
      hardwareVersion: null,
      softwareVersion: null,
      productDate: null,
      // Not `false`: the cube has not answered yet, and claiming "no gyro" would
      // be a fact we do not have.
      gyroSupported: null,
    });
  });

  it('uses the address the user typed when there is one', async () => {
    mockConnect();
    const adapter = new GanCubeAdapter();

    await adapter.connect('AA:BB:CC:DD:EE:FF');

    expect(adapter.identity?.mac).toBe('AA:BB:CC:DD:EE:FF');
  });

  it('fills in model, firmware and production date when the cube answers', async () => {
    const { events$ } = mockConnect({ readMac: 'FFEEDDCCBBAA' });
    const adapter = new GanCubeAdapter();
    await adapter.connect();

    const seen: unknown[] = [];
    adapter.identity$.subscribe((identity) => seen.push(identity));
    events$.next(hardwareEvent());

    expect(adapter.identity).toEqual({
      vendor: 'GAN',
      model: 'GAN12uiM',
      mac: 'FFEEDDCCBBAA',
      hardwareVersion: '2.1',
      softwareVersion: '1.3',
      productDate: '2024-05',
      gyroSupported: true,
    });
    // The legacy field the settings panel reads is still updated.
    expect(adapter.model).toBe('GAN12uiM');
    expect(adapter.gyroSupported).toBe(true);
    // null (connecting) → null (address only) → the full answer.
    expect(seen).toHaveLength(2);
  });

  it('reports a cube without a gyro as false once it has answered', async () => {
    const { events$ } = mockConnect({ readMac: 'FFEEDDCCBBAA' });
    const adapter = new GanCubeAdapter();
    await adapter.connect();

    events$.next(hardwareEvent({ gyroSupported: false }));

    expect(adapter.identity?.gyroSupported).toBe(false);
  });

  it('keeps what the cube has already answered if a later answer is partial', async () => {
    const { events$ } = mockConnect({ readMac: 'FFEEDDCCBBAA' });
    const adapter = new GanCubeAdapter();
    await adapter.connect();

    events$.next(hardwareEvent());
    events$.next({ type: 'HARDWARE', gyroSupported: true });

    expect(adapter.identity?.model).toBe('GAN12uiM');
    expect(adapter.identity?.softwareVersion).toBe('1.3');
  });

  it('forgets the previous cube when connecting again', async () => {
    const first = mockConnect({ readMac: 'FFEEDDCCBBAA' });
    const adapter = new GanCubeAdapter();
    await adapter.connect();
    first.events$.next(hardwareEvent());
    expect(adapter.identity?.model).toBe('GAN12uiM');

    await adapter.disconnect();
    expect(adapter.identity).toBeNull();

    // A different cube that never answers the hardware request must not inherit
    // the previous one's name.
    mockConnect({ readMac: '112233445566' });
    await adapter.connect();
    expect(adapter.identity?.model).toBeNull();
    expect(adapter.model).toBe('SmartCube');
  });

  it('emits null on a user disconnect', async () => {
    mockConnect({ readMac: 'FFEEDDCCBBAA' });
    const adapter = new GanCubeAdapter();
    await adapter.connect();

    const beforeDisconnect = adapter.identity;
    expect(beforeDisconnect?.mac).toBe('FFEEDDCCBBAA');

    const seen: unknown[] = [];
    adapter.identity$.subscribe((identity) => seen.push(identity));
    await adapter.disconnect();

    expect(adapter.identity).toBeNull();
    // A late subscriber is replayed the CURRENT identity — that is what makes
    // this a state and not just an event feed — and then the disconnect.
    expect(seen).toEqual([beforeDisconnect, null]);
  });
});

describe('GanCubeAdapter automatic reconnection', () => {
  beforeEach(() => {
    vi.mocked(connectGanCube).mockReset();
    vi.mocked(reconnectGanCube).mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('retries when the link drops without the user asking', async () => {
    const { events$ } = mockConnect({ readMac: 'FFEEDDCCBBAA' });
    const adapter = new GanCubeAdapter();
    const statuses: string[] = [];
    adapter.connectionStatus$?.subscribe((status) => statuses.push(status));

    await adapter.connect();
    events$.next({ type: 'DISCONNECT' });

    // The dead connection must not block the retry: the status has to move to
    // "reconnecting" on the spot, not stay "connected" forever.
    expect(statuses).toContain('reconnecting');
    expect(adapter.identity).toBeNull();

    await vi.advanceTimersByTimeAsync(1000);

    expect(reconnectGanCube).toHaveBeenCalledTimes(1);
    expect(adapter.isConnected).toBe(true);
    expect(statuses[statuses.length - 1]).toBe('connected');
    // The address is still known, so the identity comes back without a picker.
    expect(adapter.identity?.mac).toBe('FFEEDDCCBBAA');
  });

  it('gives up after the attempts are exhausted and says it is disconnected', async () => {
    const { events$ } = mockConnect({ readMac: 'FFEEDDCCBBAA' });
    const adapter = new GanCubeAdapter();
    const statuses: string[] = [];
    adapter.connectionStatus$?.subscribe((status) => statuses.push(status));

    await adapter.connect();
    vi.mocked(reconnectGanCube).mockRejectedValue(new Error('cube is gone'));
    events$.next({ type: 'DISCONNECT' });

    await vi.advanceTimersByTimeAsync(1000 + 2000 + 4000);

    expect(reconnectGanCube).toHaveBeenCalledTimes(3);
    expect(statuses[statuses.length - 1]).toBe('disconnected');
    expect(adapter.identity).toBeNull();
  });

  it('does not reconnect when the user disconnected on purpose', async () => {
    const { events$ } = mockConnect({ readMac: 'FFEEDDCCBBAA' });
    const adapter = new GanCubeAdapter();
    await adapter.connect();

    await adapter.disconnect();
    events$.next({ type: 'DISCONNECT' });
    await vi.advanceTimersByTimeAsync(5000);

    expect(reconnectGanCube).not.toHaveBeenCalled();
  });
});
