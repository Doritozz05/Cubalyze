import { Observable, Subject } from 'rxjs';
import { HardwareTimerAdapter, HardwareTimerEvent } from '../interfaces/HardwareTimerAdapter';

export class StackmatAdapter implements HardwareTimerAdapter {
  public readonly name = 'Stackmat Timer';
  
  private eventsSubject = new Subject<HardwareTimerEvent>();
  public events$ = this.eventsSubject.asObservable();

  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private stream: MediaStream | null = null;

  async connect(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } 
      });
      
      this.audioContext = new AudioContext();
      
      // Register worklet
      // Note: In production, the URL must point to a built JS file of StackmatProcessor
      try {
        await this.audioContext.audioWorklet.addModule('/stackmat-processor.js');
      } catch (err) {
        throw new Error('StackmatProcessor no encontrado en el servidor (/stackmat-processor.js). Verifica el build.');
      }
      
      const source = this.audioContext.createMediaStreamSource(this.stream);
      this.workletNode = new AudioWorkletNode(this.audioContext, 'stackmat-processor', {
        processorOptions: { sampleRate: this.audioContext.sampleRate }
      });
      
      this.workletNode.port.onmessage = (event) => {
        if (event.data.type !== 'stackmatData') return;
        
        const bytes: number[] = event.data.data;
        // Gen3 sends 9 bytes, Gen4 sends 10 bytes. The first byte is the command.
        if (bytes.length < 9) return;

        const command = String.fromCharCode(bytes[0]); // 'I', 'A', 'S', 'L', 'R', 'C', ' '

        switch (command) {
          case 'C':
          case 'A':
            this.eventsSubject.next({
              type: 'hardwareDown',
              leftHand: true,
              rightHand: true,
              timestamp: performance.now()
            });
            break;
          case 'L':
            this.eventsSubject.next({
              type: 'hardwareDown',
              leftHand: true,
              rightHand: false,
              timestamp: performance.now()
            });
            break;
          case 'R':
            this.eventsSubject.next({
              type: 'hardwareDown',
              leftHand: false,
              rightHand: true,
              timestamp: performance.now()
            });
            break;
          case ' ':
          case 'S':
          case 'I':
            this.eventsSubject.next({
              type: 'hardwareUp',
              leftHand: false,
              rightHand: false,
              timestamp: performance.now()
            });
            break;
        }
      };
      
      source.connect(this.workletNode);
    } catch (e) {
      console.error('Failed to connect to microphone for Stackmat', e);
      throw e;
    }
  }

  async disconnect(): Promise<void> {
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
  }
}
