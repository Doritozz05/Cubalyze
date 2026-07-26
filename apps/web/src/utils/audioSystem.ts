/**
 * Sistema de audio para la inspección WCA.
 *
 * Utiliza la Web Speech API (nativa del navegador) para sintetizar
 * las alertas de voz durante la inspección. Esto es 100% legal
 * (no copia archivos de terceros) y proporciona acceso a las voces
 * instaladas en el sistema del usuario (masculinas, femeninas, etc.).
 *
 * Compatibilidad: >95% de los navegadores modernos (Chrome, Firefox,
 * Safari, Edge) — https://caniuse.com/speech-synthesis
 *
 * Las voces disponibles dependen del sistema operativo del usuario:
 *   - Windows 10/11 : Microsoft David (male), Microsoft Zira (female)
 *   - macOS         : Alex (male), Samantha (female), y muchas más
 *   - Android       : varía según el dispositivo y motor TTS instalado
 */

export type VoiceType = "male" | "female";

// Palabras clave para identificar voces masculinas y femeninas en
// diferentes sistemas operativos. El sistema busca coincidencias
// insensibles a mayúsculas/minúsculas.
const MALE_KEYWORDS = ["david", "mark", "alex", "male", "microsoft", "google uk english male", "daniel", "fred"];
const FEMALE_KEYWORDS = ["zira", "samantha", "susan", "female", "google us english", "karen", "moira", "tessa", "veena"];

// ── Clase AudioSystem (singleton) ─────────────────────────────────────

export class AudioSystem {
  private voice: VoiceType = "male";
  private voices: SpeechSynthesisVoice[] = [];
  private voicesLoaded = false;
  private loadingStarted = false;

  /**
   * Inicializa el motor de síntesis de voz. Comienza la carga de la lista
   * de voces disponibles (síncrona y asíncrona vía onvoiceschanged).
   *
   * Debe llamarse después de la primera interacción del usuario para
   * cumplir con las políticas de autoplay del navegador.
   */
  public init(): void {
    if (this.loadingStarted || typeof window === "undefined") return;
    this.loadingStarted = true;

    if (!window.speechSynthesis) {
      console.warn("[AudioSystem] Web Speech API no está disponible en este navegador.");
      return;
    }

    // Intento síncrono (funciona en la mayoría de navegadores)
    this.voices = window.speechSynthesis.getVoices();
    if (this.voices.length > 0) {
      this.voicesLoaded = true;
    }

    // Carga asíncrona (necesaria en Chrome, donde las voces llegan después)
    window.speechSynthesis.onvoiceschanged = () => {
      this.voices = window.speechSynthesis.getVoices();
      if (this.voices.length > 0) {
        this.voicesLoaded = true;
        window.speechSynthesis.onvoiceschanged = null; // Limpiar después de cargar
      }
    };

    // Timeout de seguridad: si después de 3 segundos no se cargaron voces,
    // marcamos como cargado para no bloquear (se usará la voz por defecto)
    setTimeout(() => {
      if (!this.voicesLoaded) {
        this.voices = window.speechSynthesis?.getVoices() ?? [];
        this.voicesLoaded = true;
      }
    }, 3000);
  }

  /**
   * Cambia entre voz masculina y femenina.
   * La próxima vez que se reproduzca un audio, se usará la voz
   * correspondiente según las voces disponibles en el sistema.
   */
  public setVoice(type: VoiceType): void {
    this.voice = type;
  }

  public getVoice(): VoiceType {
    return this.voice;
  }

  /**
   * Busca la mejor voz disponible para el tipo seleccionado (male/female).
   *
   * Estrategia de búsqueda:
   *   1. Coincidencia por palabra clave + idioma (en-US, en-GB, en)
   *   2. Cualquier voz en inglés
   *   3. Cualquier voz disponible
   */
  private getPreferredVoice(): SpeechSynthesisVoice | null {
    if (!this.voices.length) return null;

    const keywords = this.voice === "male" ? MALE_KEYWORDS : FEMALE_KEYWORDS;
    const langPrefs = ["en-US", "en-GB", "en"];

    // Prioridad 1: keyword + idioma preferido
    for (const lang of langPrefs) {
      for (const kw of keywords) {
        const found = this.voices.find(
          (v) => v.lang.startsWith(lang) && v.name.toLowerCase().includes(kw),
        );
        if (found) return found;
      }
    }

    // Prioridad 2: cualquier voz en inglés
    for (const lang of langPrefs) {
      const found = this.voices.find((v) => v.lang.startsWith(lang));
      if (found) return found;
    }

    // Prioridad 3: la primera voz disponible
    return this.voices[0] ?? null;
  }

  /**
   * Sintetiza y reproduce un texto usando la voz seleccionada.
   * Cancela cualquier síntesis previa para evitar superposición.
   */
  private speak(text: string): void {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    // Cancelar speech previo (evita solapamiento)
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.88; // Ligeramente más lento para claridad en competición
    utterance.volume = 1;

    const voice = this.getPreferredVoice();
    if (voice) {
      utterance.voice = voice;
    }

    window.speechSynthesis.speak(utterance);
  }

  /**
   * Reproduce la alerta de "8 seconds".
   */
  public play8s(): void {
    if (!this.loadingStarted) this.init();
    this.speak("8 seconds");
  }

  /**
   * Reproduce la alerta de "12 seconds".
   */
  public play12s(): void {
    if (!this.loadingStarted) this.init();
    this.speak("12 seconds");
  }

  /**
   * Reproduce un chime/fanfarria cristalina y minimalista de victoria al romper un PB.
   * Utiliza la Web Audio API nativa para síntesis en tiempo real sin latencia.
   */
  public playPbFanfare(types: ("Single" | "Ao5" | "Ao12")[] = ["Single"]): void {
    if (typeof window === "undefined") return;

    try {
      const AudioContextClass =
        window.AudioContext ||
        // @ts-ignore fallback for legacy webkit
        window.webkitAudioContext;

      if (!AudioContextClass) return;

      const ctx = new AudioContextClass();
      const now = ctx.currentTime;

      // Frecuencias base en Hz (Arpegio E Major 7th / Bright victory chime)
      // E5 = 659.25, G#5 = 830.61, B5 = 987.77, D#6 = 1244.51, E6 = 1318.51
      const isMultiple = types.length > 1;
      const isAo12 = types.includes("Ao12");

      let freqs = [659.25, 830.61, 987.77, 1318.51];
      if (isAo12 || isMultiple) {
        freqs = [523.25, 659.25, 783.99, 987.77, 1046.5]; // C major 7th / Sparkle
      }

      const noteDuration = 0.12;
      const stagger = 0.08;

      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = idx === freqs.length - 1 ? "sine" : "triangle";
        osc.frequency.setValueAtTime(freq, now + idx * stagger);

        // ADSR Envelope: Atacable, brillante, decaimiento suave
        const startTime = now + idx * stagger;
        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.exponentialRampToValueAtTime(0.22, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + noteDuration + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + noteDuration + 0.4);
      });

      // Limpieza automática del AudioContext
      setTimeout(() => {
        ctx.close().catch(() => {});
      }, 1500);
    } catch (e) {
      console.warn("[AudioSystem] Could not play PB fanfare:", e);
    }
  }
}

// Exportamos una instancia singleton para toda la app
export const globalAudioSystem = new AudioSystem();
