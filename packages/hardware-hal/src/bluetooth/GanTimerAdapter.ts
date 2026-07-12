import { Observable, Subject } from 'rxjs';
import { HardwareTimerAdapter, HardwareTimerEvent } from '../interfaces/HardwareTimerAdapter';
import { connectGanTimer, GanTimerConnection } from '@cubeforge/gan-protocol';

export class GanTimerAdapter implements HardwareTimerAdapter {
  public readonly name = 'GAN Smart Timer';
  
  private connection: GanTimerConnection | null = null;
  private eventsSubject = new Subject<HardwareTimerEvent>();
  
  public events$ = this.eventsSubject.asObservable();

  constructor() {}

  async connect(): Promise<void> {
    this.connection = await connectGanTimer();
    
    this.connection.events$.subscribe((evt) => {
      switch (evt.state) {
        case 0:
        case 4:
        case 5:
          this.eventsSubject.next({
            type: 'hardwareUp',
            leftHand: false,
            rightHand: false,
            timestamp: performance.now()
          });
          break;
        case 1:
        case 6:
        case 7:
          this.eventsSubject.next({
            type: 'hardwareDown',
            leftHand: true,
            rightHand: false,
            timestamp: performance.now()
          });
          break;
        case 2:
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

