import { describe, it, expect, vi } from 'vitest';
import { TimerEngine } from '@cubeforge/timer-engine';
import { HardwareTimerEvent } from '@cubeforge/hardware-hal';
import { Subject } from 'rxjs';

describe('Timer Integration', () => {
  it('should process events from a mocked hardware adapter', () => {
    const eventsSubject = new Subject<HardwareTimerEvent>();
    const mockAdapter = {
      name: 'Mock Adapter',
      events$: eventsSubject.asObservable(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    };

    const engine = new TimerEngine(mockAdapter);
    
    // Simulate hands on
    eventsSubject.next({ type: 'hardwareDown', leftHand: true, rightHand: true, timestamp: 100 });
    
    expect(engine.getState().mode).toBe('READY'); // or whatever the engine sets it to, this is a placeholder test
  });
});
