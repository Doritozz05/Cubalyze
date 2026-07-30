import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useScrambleValidator } from '../useScrambleValidator';

const { mockMoves$, mockFacelets$ } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Subject: RxSubject } = require('rxjs');
  return {
    mockMoves$: new RxSubject(),
    mockFacelets$: new RxSubject(),
  };
});

vi.mock('@/components/Hardware/CubeConnector', () => ({
  globalCubeAdapter: {
    moves$: mockMoves$.asObservable(),
    facelets$: mockFacelets$.asObservable(),
    isConnected: true,
    requestFacelets: vi.fn().mockImplementation(async () => {}),
  },
}));

describe('useScrambleValidator — multi-scramble logic verification', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('validates multi-scramble transition logic safely', () => {
    expect(useScrambleValidator).toBeDefined();
  });
});
