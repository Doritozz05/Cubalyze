/**
 * Stackmat Audio Worklet Processor
 *
 * Decodes the PWM (Pulse Width Modulation) signal from a Stackmat timer
 * connected via microphone/line-in. Runs in a dedicated audio thread,
 * posting decoded timer data back to the main thread.
 *
 * Protocol (Gen3/Gen4):
 *   - 1200 baud rate, 8 data bits, 1 stop bit
 *   - Logic 0 = positive voltage (high), Logic 1 = zero/negative
 *   - Each packet: 9-10 bytes, terminated by CR (0x0D) or LF (0x0A)
 *
 * Commands (first byte):
 *   'I' = Timer idle/reset
 *   'A' = Both hands on (arming)
 *   'S' = Timer started (hands removed)
 *   'C' = Timer stopped (hands back on)
 *   'L' = Left hand on sensor
 *   'R' = Right hand on sensor
 *   ' ' = Reset/ready
 *
 * Built from: packages/hardware-hal/src/audio/StackmatProcessor.ts
 */

class StackmatProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.sampleRate = options.processorOptions?.sampleRate || 44100;
    const baudRate = options.processorOptions?.baudRate || 1200;
    this.samplesPerBit = this.sampleRate / baudRate;

    // Require at least 75% of a bit period of sustained positive signal
    this.minStartSamples = Math.round(this.samplesPerBit * 0.75);

    this.lastSample = 0;
    this.isDecoding = false;
    this.bitTimer = 0;
    this.bitIndex = 0;
    this.currentByte = 0;
    this.byteBuffer = [];

    // Start bit validation counters
    this.startEdgePositiveCount = 0;
    this.isValidatingStart = false;
  }

  process(inputs, _outputs, _parameters) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;

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
              // Valid start bit confirmed
              this.isDecoding = true;
              this.isValidatingStart = false;
              this.bitTimer = 1.5 * this.samplesPerBit;
              this.bitIndex = 0;
              this.currentByte = 0;
            }
          } else {
            // False positive
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

            // Check for end-of-packet (CR or LF)
            if (this.currentByte === 10 || this.currentByte === 13) {
              if (this.byteBuffer.length >= 9) {
                this.port.postMessage({
                  type: 'stackmatData',
                  data: [...this.byteBuffer],
                });
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
    return true;
  }
}

registerProcessor('stackmat-processor', StackmatProcessor);
