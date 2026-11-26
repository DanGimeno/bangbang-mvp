/**
 * One analysis frame produced by the capture pipeline (~5 ms of audio).
 * Only these aggregate numbers ever leave the audio thread: raw samples are discarded.
 */
export interface AudioFrame {
  /** Audio-clock timestamp of the end of the frame, in milliseconds. */
  time: number;
  /** Root-mean-square amplitude of the (high-passed) signal, linear 0..1. */
  rms: number;
  /** Absolute peak amplitude, linear 0..1. */
  peak: number;
}

/**
 * Gameplay-independent vocal events. The detector knows nothing about weapons;
 * consumers (see `weapons/vocalTrigger.ts`) decide what an event means.
 */
export type VocalEvent =
  | {
      type: 'impulse';
      time: number;
      levelDb: number;
      /** 0..1, how far above the threshold the attack was. */
      strength: number;
      /** True when the attack happened while the voice was already active ("ra-ta-ta"). */
      retrigger: boolean;
    }
  | { type: 'voice-start'; time: number }
  | {
      type: 'voice-end';
      time: number;
      durationMs: number;
      peakDb: number;
      /** True when ended by the `maxActiveMs` safety limit rather than by silence. */
      forced: boolean;
    };
