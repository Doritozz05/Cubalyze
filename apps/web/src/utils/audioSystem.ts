/**
 * Audio system for WCA inspection.
 *
 * Uses the Web Speech API (native to the browser) to synthesize voice
 * alerts during inspection. This is 100% legal (does not copy third-party
 * assets) and provides access to voices installed on the user's system.
 *
 * Compatibility: >95% of modern browsers (Chrome, Firefox, Safari, Edge)
 * — https://caniuse.com/speech-synthesis
 *
 * Available voices depend on the user's operating system:
 *   - Windows 10/11 : Microsoft David (male), Microsoft Zira (female)
 *   - macOS         : Alex (male), Samantha (female), and many more
 *   - Android       : varies by device and installed TTS engine
 */

export type VoiceType = "male" | "female";

// Keywords to identify male and female voices across different operating systems.
// The system performs case-insensitive matching.
const MALE_KEYWORDS = ["david", "mark", "alex", "male", "microsoft", "google uk english male", "daniel", "fred"];
const FEMALE_KEYWORDS = ["zira", "samantha", "susan", "female", "google us english", "karen", "moira", "tessa", "veena"];

// ── AudioSystem Class (singleton) ─────────────────────────────────────

export class AudioSystem {
  private voice: VoiceType = "male";
  private voices: SpeechSynthesisVoice[] = [];
  private voicesLoaded = false;
  private loadingStarted = false;

  /**
   * Initializes the speech synthesis engine. Begins loading the available
   * voices list (synchronously and asynchronously via onvoiceschanged).
   *
   * Must be called after the user's first interaction to comply with
   * browser autoplay policies.
   */
  public init(): void {
    if (this.loadingStarted || typeof window === "undefined") return;
    this.loadingStarted = true;

    if (!window.speechSynthesis) {
      console.warn("[AudioSystem] Web Speech API is not available in this browser.");
      return;
    }

    // Synchronous attempt (works in most browsers)
    this.voices = window.speechSynthesis.getVoices();
    if (this.voices.length > 0) {
      this.voicesLoaded = true;
    }

    // Asynchronous load (necessary in Chrome, where voices arrive later)
    window.speechSynthesis.onvoiceschanged = () => {
      this.voices = window.speechSynthesis.getVoices();
      if (this.voices.length > 0) {
        this.voicesLoaded = true;
        window.speechSynthesis.onvoiceschanged = null; // Clean up after loading
      }
    };

    // Safety timeout: if voices are not loaded after 3 seconds,
    // mark as loaded to avoid blocking (default voice will be used)
    setTimeout(() => {
      if (!this.voicesLoaded) {
        this.voices = window.speechSynthesis?.getVoices() ?? [];
        this.voicesLoaded = true;
      }
    }, 3000);
  }

  /**
   * Switches between male and female voice.
   * The next time audio is played, the corresponding voice will be used
   * based on available system voices.
   */
  public setVoice(type: VoiceType): void {
    this.voice = type;
  }

  public getVoice(): VoiceType {
    return this.voice;
  }

  /**
   * Searches for the best available voice for the selected type (male/female).
   *
   * Search strategy:
   *   1. Keyword match + preferred language (en-US, en-GB, en)
   *   2. Any English voice
   *   3. Any available voice
   */
  private getPreferredVoice(): SpeechSynthesisVoice | null {
    if (!this.voices.length) return null;

    const keywords = this.voice === "male" ? MALE_KEYWORDS : FEMALE_KEYWORDS;
    const langPrefs = ["en-US", "en-GB", "en"];

    // Priority 1: keyword + preferred language
    for (const lang of langPrefs) {
      for (const kw of keywords) {
        const found = this.voices.find(
          (v) => v.lang.startsWith(lang) && v.name.toLowerCase().includes(kw),
        );
        if (found) return found;
      }
    }

    // Priority 2: any English voice
    for (const lang of langPrefs) {
      const found = this.voices.find((v) => v.lang.startsWith(lang));
      if (found) return found;
    }

    // Priority 3: first available voice
    return this.voices[0] ?? null;
  }

  /**
   * Synthesizes and speaks text using the selected voice.
   * Cancels any previous speech synthesis to avoid overlap.
   */
  private speak(text: string): void {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    // Cancel previous speech (prevents overlap)
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.88; // Slightly slower for clarity in competition
    utterance.volume = 1;

    const voice = this.getPreferredVoice();
    if (voice) {
      utterance.voice = voice;
    }

    window.speechSynthesis.speak(utterance);
  }

  /**
   * Plays the "8 seconds" alert.
   */
  public play8s(): void {
    if (!this.loadingStarted) this.init();
    this.speak("8 seconds");
  }

  /**
   * Plays the "12 seconds" alert.
   */
  public play12s(): void {
    if (!this.loadingStarted) this.init();
    this.speak("12 seconds");
  }

  /**
   * Plays a crisp, minimalist victory fanfare chime upon breaking a PB.
   * Uses native Web Audio API for real-time synthesis without latency.
   */
  public playPbFanfare(types: ("Single" | "Ao5" | "Ao12")[] = ["Single"]): void {
    if (typeof window === "undefined") return;

    try {
      const AudioContextClass =
        window.AudioContext ||
        // @ts-expect-error fallback for legacy webkit
        window.webkitAudioContext;

      if (!AudioContextClass) return;

      const ctx = new AudioContextClass();
      const now = ctx.currentTime;

      // Base frequencies in Hz (E Major 7th Arpeggio / Bright victory chime)
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

        // ADSR Envelope: Punchy, bright, smooth decay
        const startTime = now + idx * stagger;
        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.exponentialRampToValueAtTime(0.22, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + noteDuration + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + noteDuration + 0.4);
      });

      // Automatic AudioContext cleanup
      setTimeout(() => {
        ctx.close().catch(() => {});
      }, 1500);
    } catch (e) {
      console.warn("[AudioSystem] Could not play PB fanfare:", e);
    }
  }
}

// Export singleton instance for the entire application
export const globalAudioSystem = new AudioSystem();
