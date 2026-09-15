import { describe, it, expect, vi, beforeEach } from 'vitest';
import { of } from 'rxjs';

// Mock the BLE transport so connect() runs without opening the browser
// picker. Only the runtime values the adapter imports are needed; the
// GanCubeConnection/GanCubeEvent types are erased at compile time.
vi.mock('@cubalyze/gan-protocol', () => ({
  connectGanCube: vi.fn(),
  reconnectGanCube: vi.fn(),
}));

import { connectGanCube } from '@cubalyze/gan-protocol';
import { GanCubeAdapter } from '../src/bluetooth/GanCubeAdapter';

describe('GanCubeAdapter connect flow', () => {
  beforeEach(() => {
    vi.mocked(connectGanCube).mockReset();
  });

  it('requests facelets on connect so the first moves are not discarded', async () => {
    // The GAN protocol driver drops every MOVE until the first FACELETS
    // event (its serial tracker starts at -1). The connect flow must
    // therefore seed it with a REQUEST_FACELETS command.
    vi.mocked(connectGanCube).mockResolvedValue({
      sendCubeCommand: vi.fn().mockResolvedValue(undefined),
      events$: of(),
      disconnect: vi.fn().mockResolvedValue(undefined),
    } as never);

    const adapter = new GanCubeAdapter();
    const faceletsSpy = vi.spyOn(adapter, 'requestFacelets').mockResolvedValue(undefined);

    await adapter.connect();

    expect(faceletsSpy).toHaveBeenCalledTimes(1);
  });
});
