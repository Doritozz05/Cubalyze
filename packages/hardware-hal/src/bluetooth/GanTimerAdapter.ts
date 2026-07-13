import { Observable, Subject } from 'rxjs';
import { HardwareTimerAdapter, HardwareTimerEvent } from '../interfaces/HardwareTimerAdapter';
import { connectGanTimer, GanTimerConnection, GanTimerState } from '@cubeforge/gan-protocol';
export class GanTimerAdapter implements HardwareTimerAdapter {
  public readonly name = 'GAN Smart Timer';
  
  private connection: GanTimerConnection | null = null;
  private eventsSubject = new Subject<HardwareTimerEvent>();
  
  public events$ = this.eventsSubject.asObservable();

  constructor() {}

  async connect(): Promise<void> {
    try {
      this.connection = await connectGanTimer();
    } catch (error) {
      console.error('Failed to connect GAN Timer:', error);
      throw error;
    }
    
    this.connection.events$.subscribe((evt) => {
      switch (evt.state) {
        case GanTimerState.DISCONNECT:
          this.disconnect();
          return;
        case GanTimerState.GET_SET:
        case GanTimerState.STOPPED:
        case GanTimerState.FINISHED:
          this.eventsSubject.next({
            type: 'hardwareUp',
            leftHand: false,
            rightHand: false,
            timestamp: performance.now()
          });
          break;
        case GanTimerState.IDLE:
          this.eventsSubject.next({
            type: 'hardwareReset',
            leftHand: false,
            rightHand: false,
            timestamp: performance.now()
          });
          break;
        case GanTimerState.HANDS_ON:
          this.eventsSubject.next({
            type: 'hardwareDown',
            leftHand: true,
            rightHand: false,
            timestamp: performance.now()
          });
          break;
        case GanTimerState.HANDS_OFF:
          this.eventsSubject.next({
            type: 'hardwareDown',
            leftHand: true,
            rightHand: true,
            timestamp: performance.now()
          });
          break;
      }
    });
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.disconnect();
      this.connection = null;
    }
  }
}

