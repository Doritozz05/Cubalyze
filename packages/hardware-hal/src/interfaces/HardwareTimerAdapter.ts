import { Observable } from 'rxjs';

export type HardwareTimerEventType = 'hardwareDown' | 'hardwareUp' | 'hardwareReset';

export interface HardwareTimerEvent {
  type: HardwareTimerEventType;
  leftHand: boolean;
  rightHand: boolean;
  timestamp: number;
}

export interface HardwareTimerAdapter {
  readonly name: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  
  events$: Observable<HardwareTimerEvent>;
}
