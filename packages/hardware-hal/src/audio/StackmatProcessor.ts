export class StackmatProcessor extends AudioWorkletProcessor {
  // RS-232 1200 baud bit-banging decoder
  private sampleRate: number;
  private samplesPerBit: number;
  
  private lastSample: number = 0;
  private isDecoding: boolean = false;
  private bitTimer: number = 0;
  private bitIndex: number = 0;
  private currentByte: number = 0;
  private byteBuffer: number[] = [];

  constructor(options: AudioWorkletNodeOptions) {
    super();
    this.sampleRate = options.processorOptions?.sampleRate || 44100;
    this.samplesPerBit = this.sampleRate / 1200; // ~36.75 samples per bit
  }

  process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>): boolean {
    const input = inputs[0];
    if (input && input.length > 0) {
      const channelData = input[0];
      
      for (let i = 0; i < channelData.length; i++) {
        const sample = channelData[i];
        
        // Zero-crossing edge detection
        // Idle state in RS-232 audio is typically negative (mark). 
        // Start bit is positive (space).
        const isStartEdge = this.lastSample <= 0 && sample > 0;
        
        if (!this.isDecoding && isStartEdge) {
          this.isDecoding = true;
          // Set timer to sample in the middle of the first data bit (1.5 bit periods from the start edge)
          this.bitTimer = 1.5 * this.samplesPerBit;
          this.bitIndex = 0;
          this.currentByte = 0;
        }
        
        if (this.isDecoding) {
          this.bitTimer--;
          
          if (this.bitTimer <= 0) {
            // Time to sample a bit. RS-232: Space (+V) = logic 0, Mark (-V) = logic 1
            const logicBit = sample > 0 ? 0 : 1;
            
            if (this.bitIndex < 8) {
              // Data bits 0-7 (LSB first)
              if (logicBit === 1) {
                this.currentByte |= (1 << this.bitIndex);
              }
              this.bitIndex++;
              this.bitTimer += this.samplesPerBit;
            } else {
              // Stop bit
              this.byteBuffer.push(this.currentByte);
              
              // Stackmat messages usually end with CR (13) and LF (10)
              if (this.currentByte === 10 || this.currentByte === 13) {
                if (this.byteBuffer.length >= 9) { // At least 9 bytes for a valid Gen3/Gen4 packet
                  this.port.postMessage({ type: 'stackmatData', data: [...this.byteBuffer] });
                }
                if (this.currentByte === 10) {
                  this.byteBuffer = [];
                }
              }
              
              this.isDecoding = false;
            }
          }
        }
        
        this.lastSample = sample;
      }
    }
    return true; // Keep processor alive
  }
}

registerProcessor('stackmat-processor', StackmatProcessor);
