declare abstract class AudioWorkletProcessor {
  readonly port: MessagePort;
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ): boolean;
}

declare function registerProcessor(
  name: string,
  processorCtor: new (options?: AudioWorkletNodeOptions) => AudioWorkletProcessor
): void;

export class StackmatProcessor extends AudioWorkletProcessor {
  private sampleRate: number;
  private samplesPerBit: number;
  private minStartSamples: number;

  private lastSample: number = 0;
  private isDecoding: boolean = false;
  private bitTimer: number = 0;
  private bitIndex: number = 0;
  private currentByte: number = 0;
  private byteBuffer: number[] = [];

  // Start bit validation counters
  private startEdgePositiveCount: number = 0;
  private isValidatingStart: boolean = false;

  constructor(options?: AudioWorkletNodeOptions) {
    super();
    this.sampleRate = options?.processorOptions?.sampleRate || 44100;
    const baudRate = options?.processorOptions?.baudRate || 1200;
    this.samplesPerBit = this.sampleRate / baudRate;

    // Require at least 75% of a bit period of sustained positive signal
    // to declare a valid start bit (~27 samples at 44100Hz/1200baud)
    this.minStartSamples = Math.round(this.samplesPerBit * 0.75);
  }

  process(
    inputs: Float32Array[][],
    _outputs: Float32Array[][],
    _parameters: Record<string, Float32Array>
  ): boolean {
    const input = inputs[0];
    if (input && input.length > 0) {
      const channelData = input[0];

      for (let i = 0; i < channelData.length; i++) {
        const sample = channelData[i];
        const isPositive = sample > 0;

        if (!this.isDecoding) {
          if (!this.isValidatingStart) {
            // Wait for zero-crossing positive edge
            if (this.lastSample <= 0 && isPositive) {
              this.isValidatingStart = true;
              this.startEdgePositiveCount = 1;
            }
          } else {
            // Validate sustained positive signal
            if (isPositive) {
              this.startEdgePositiveCount++;
              if (this.startEdgePositiveCount >= this.minStartSamples) {
                // Valid start bit confirmed — begin decoding
                this.isDecoding = true;
                this.isValidatingStart = false;
                this.bitTimer = 1.5 * this.samplesPerBit;
                this.bitIndex = 0;
                this.currentByte = 0;
              }
            } else {
              // Signal dropped before minimum duration — false positive
              this.isValidatingStart = false;
              this.startEdgePositiveCount = 0;
            }
          }
        }

        if (this.isDecoding) {
          this.bitTimer--;

          if (this.bitTimer <= 0) {
            const logicBit = isPositive ? 0 : 1;

            if (this.bitIndex < 8) {
              if (logicBit === 1) {
                this.currentByte |= (1 << this.bitIndex);
              }
              this.bitIndex++;
              this.bitTimer += this.samplesPerBit;
            } else {
              // Stop bit
              this.byteBuffer.push(this.currentByte);

              if (this.currentByte === 10 || this.currentByte === 13) {
                if (this.byteBuffer.length >= 9) {
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
    return true;
  }
}

registerProcessor('stackmat-processor', StackmatProcessor);
