/**
 * Sistema de audio para la inspección WCA.
 * Para utilizarlo, debes colocar los siguientes archivos mp3 en la carpeta `apps/web/public/audio/`:
 * - `8s.mp3` : Aviso de "8 segundos".
 * - `12s.mp3` : Aviso de "12 segundos".
 */

export class AudioSystem {
  private audio8s: HTMLAudioElement | null = null;
  private audio12s: HTMLAudioElement | null = null;
  
  constructor() {
    if (typeof window !== 'undefined') {
      this.audio8s = new Audio('/audio/8s.mp3');
      this.audio12s = new Audio('/audio/12s.mp3');
      
      // Preload the audio files
      this.audio8s.preload = 'auto';
      this.audio12s.preload = 'auto';
    }
  }

  public play8s() {
    if (this.audio8s) {
      this.audio8s.currentTime = 0;
      this.audio8s.play().catch(e => console.warn("Audio play blocked by browser:", e));
    }
  }

  public play12s() {
    if (this.audio12s) {
      this.audio12s.currentTime = 0;
      this.audio12s.play().catch(e => console.warn("Audio play blocked by browser:", e));
    }
  }
}

export const globalAudioSystem = new AudioSystem();
