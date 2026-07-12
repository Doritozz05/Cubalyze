import { StackmatProcessor } from '../src/audio/StackmatProcessor';

// Mock AudioWorkletProcessor and registerProcessor
(global as any).AudioWorkletProcessor = class AudioWorkletProcessor {
  port = {
    postMessage: (msg: any) => {
      console.log('Mensaje recibido en hilo principal:', msg);
      if (msg.type === 'stackmatData') {
        const chars = msg.data.map((b: number) => String.fromCharCode(b)).join('');
        console.log('>>> PAQUETE DECODIFICADO:', chars.trim());
      }
    }
  };
};

(global as any).registerProcessor = () => {};

// Load the processor class now that globals are mocked
const { StackmatProcessor: Processor } = require('../src/audio/StackmatProcessor');

const SAMPLE_RATE = 44100;
const BAUD_RATE = 1200;
const SAMPLES_PER_BIT = SAMPLE_RATE / BAUD_RATE;

// Sintetizar señal UART de Stackmat
// RS-232: Idle = Mark (Negativo), Start = Space (Positivo)
function generateUartSignal(text: string): Float32Array {
  const bytes = Array.from(text).map(c => c.charCodeAt(0));
  const buffer: number[] = [];
  
  // Idle
  for(let i=0; i<100; i++) buffer.push(-1.0);
  
  for (const byte of bytes) {
    // Start bit (Space = Positivo)
    for(let i=0; i<SAMPLES_PER_BIT; i++) buffer.push(1.0);
    
    // 8 Data bits (LSB first)
    for (let b = 0; b < 8; b++) {
      const bit = (byte >> b) & 1;
      const val = bit === 1 ? -1.0 : 1.0; // Mark (-1.0) = logic 1, Space (1.0) = logic 0
      for(let i=0; i<SAMPLES_PER_BIT; i++) buffer.push(val);
    }
    
    // Stop bit (Mark = Negativo)
    for(let i=0; i<SAMPLES_PER_BIT; i++) buffer.push(-1.0);
  }
  
  // Idle
  for(let i=0; i<100; i++) buffer.push(-1.0);
  
  return new Float32Array(buffer);
}

const processor = new Processor({ processorOptions: { sampleRate: SAMPLE_RATE } } as any);

// Estado normal de un timer (I = Idle, tiempo 0:12.345, seguido de un checksum falso y \r\n)
const packet = "I0123456\r\n";
console.log('Sintetizando paquete UART Stackmat:', JSON.stringify(packet));
const signal = generateUartSignal(packet);

console.log(`Generados ${signal.length} samples. Procesando a traves del StackmatProcessor...`);
processor.process([[signal]], [], {});
