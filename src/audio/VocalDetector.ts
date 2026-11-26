import { clamp, lerp } from '../core/math';
import { toDb } from './analysis';
import type { AudioFrame, VocalEvent } from './types';

/**
 * Energy-onset detector for short vocal bursts ("Bang!", "Pew!", "Ra-ta-ta").
 *
 * Pure and frame-driven: it receives aggregate level frames (no raw audio, no browser
 * APIs) and returns gameplay-independent events. See docs/AUDIO_SYSTEM.md for the
 * rationale and known limitations.
 *
 * Algorithm summary:
 * 1. threshold = max(minThresholdDb, noiseFloorDb + margin(sensitivity))
 * 2. An *attack* is a frame above the threshold whose level rose by at least
 *    `attackRiseDb` relative to the quietest frame in the preceding `riseWindowMs`.
 *    Slowly swelling sounds (vowels, music fades, fans spinning up) do not qualify.
 * 3. Attacks closer than `debounceMs` are merged.
 * 4. While the voice is active, a smaller rise (`retriggerRiseDb`) is enough, which
 *    lets each syllable of "ra-ta-ta-ta" fire.
 * 5. The voice ends after `releaseMs` below (threshold - hysteresisDb), or is forced to
 *    end after `maxActiveMs` (stuck-trigger protection) and must go quiet to re-arm.
 * 6. Optionally the noise floor slowly adapts while idle.
 */
export interface DetectorConfig {
  /** Calibrated ambient noise floor in dBFS. */
  noiseFloorDb: number;
  /** 0 (needs a shout) .. 100 (very sensitive). */
  sensitivity: number;
  /** The threshold never goes below this, whatever the calibration says. */
  minThresholdDb: number;
  attackRiseDb: number;
  retriggerRiseDb: number;
  riseWindowMs: number;
  debounceMs: number;
  releaseMs: number;
  hysteresisDb: number;
  maxActiveMs: number;
  adaptiveNoiseFloor: boolean;
  adaptTimeConstantMs: number;
  /** Maximum drift of the adaptive floor away from the calibrated value. */
  maxAdaptDb: number;
}

export const DEFAULT_DETECTOR_CONFIG: Readonly<DetectorConfig> = {
  noiseFloorDb: -60,
  sensitivity: 50,
  minThresholdDb: -55,
  attackRiseDb: 10,
  retriggerRiseDb: 6,
  riseWindowMs: 40,
  debounceMs: 70,
  releaseMs: 90,
  hysteresisDb: 4,
  maxActiveMs: 3000,
  adaptiveNoiseFloor: true,
  adaptTimeConstantMs: 4000,
  maxAdaptDb: 15,
};

/** Margin above the noise floor: sensitivity 0 → 30 dB, 100 → 6 dB. */
export function sensitivityToMarginDb(sensitivity: number): number {
  return lerp(30, 6, clamp(sensitivity, 0, 100) / 100);
}

export function computeThresholdDb(
  noiseFloorDb: number,
  sensitivity: number,
  minThresholdDb: number,
): number {
  return Math.max(minThresholdDb, noiseFloorDb + sensitivityToMarginDb(sensitivity));
}

interface HistoryEntry {
  time: number;
  db: number;
}

export class VocalDetector {
  private config: DetectorConfig;
  private adaptedFloorDb: number;
  private history: HistoryEntry[] = [];
  private active = false;
  private lockedOut = false;
  private activeStart = 0;
  private lastAboveTime = 0;
  private peakDb = -Infinity;
  private lastImpulseTime = -Infinity;
  private lastFrameTime: number | null = null;
  private lastLevelDb = -100;

  constructor(config: Partial<DetectorConfig> = {}) {
    this.config = { ...DEFAULT_DETECTOR_CONFIG, ...config };
    this.adaptedFloorDb = this.config.noiseFloorDb;
  }

  configure(partial: Partial<DetectorConfig>): void {
    const floorChanged =
      partial.noiseFloorDb !== undefined && partial.noiseFloorDb !== this.config.noiseFloorDb;
    this.config = { ...this.config, ...partial };
    if (floorChanged) this.adaptedFloorDb = this.config.noiseFloorDb;
  }

  get settings(): Readonly<DetectorConfig> {
    return this.config;
  }

  /** Current (possibly adapted) noise floor. */
  get noiseFloorDb(): number {
    return this.adaptedFloorDb;
  }

  get thresholdDb(): number {
    return computeThresholdDb(
      this.adaptedFloorDb,
      this.config.sensitivity,
      this.config.minThresholdDb,
    );
  }

  get isActive(): boolean {
    return this.active;
  }

  /** Level of the most recent frame, in dBFS. */
  get levelDb(): number {
    return this.lastLevelDb;
  }

  reset(): void {
    this.history = [];
    this.active = false;
    this.lockedOut = false;
    this.peakDb = -Infinity;
    this.lastImpulseTime = -Infinity;
    this.lastFrameTime = null;
    this.adaptedFloorDb = this.config.noiseFloorDb;
  }

  process(frame: AudioFrame): VocalEvent[] {
    const cfg = this.config;
    const t = frame.time;
    const db = toDb(frame.rms);
    const dt = this.lastFrameTime === null ? 0 : Math.max(0, t - this.lastFrameTime);
    this.lastFrameTime = t;
    this.lastLevelDb = db;

    const threshold = this.thresholdDb;
    const releaseLevel = threshold - cfg.hysteresisDb;
    const events: VocalEvent[] = [];

    // Quietest level in the recent window, excluding the current frame.
    while (
      this.history.length > 0 &&
      (this.history[0] as HistoryEntry).time < t - cfg.riseWindowMs
    ) {
      this.history.shift();
    }
    let recentMin = this.history.length > 0 ? Infinity : this.adaptedFloorDb;
    for (const entry of this.history) recentMin = Math.min(recentMin, entry.db);
    this.history.push({ time: t, db });

    // Sustain / release bookkeeping.
    if (this.active) {
      if (db >= releaseLevel) {
        this.lastAboveTime = t;
        this.peakDb = Math.max(this.peakDb, db);
      } else if (t - this.lastAboveTime >= cfg.releaseMs) {
        events.push(this.endVoice(t, false));
      }
      if (this.active && t - this.activeStart >= cfg.maxActiveMs) {
        events.push(this.endVoice(t, true));
        this.lockedOut = true;
      }
    }
    if (this.lockedOut && db < releaseLevel) this.lockedOut = false;

    // Attack detection.
    const rise = db - recentMin;
    const requiredRise = this.active ? cfg.retriggerRiseDb : cfg.attackRiseDb;
    const debounced = t - this.lastImpulseTime < cfg.debounceMs;
    if (!this.lockedOut && !debounced && db >= threshold && rise >= requiredRise) {
      const retrigger = this.active;
      if (!this.active) {
        this.active = true;
        this.activeStart = t;
        this.peakDb = db;
        events.push({ type: 'voice-start', time: t });
      }
      this.lastAboveTime = t;
      this.lastImpulseTime = t;
      events.push({
        type: 'impulse',
        time: t,
        levelDb: db,
        strength: clamp((db - threshold) / 30, 0, 1),
        retrigger,
      });
    }

    // Slow noise-floor adaptation while idle and below threshold.
    if (cfg.adaptiveNoiseFloor && !this.active && db < threshold && dt > 0) {
      const alpha = 1 - Math.exp(-dt / cfg.adaptTimeConstantMs);
      const next = this.adaptedFloorDb + (db - this.adaptedFloorDb) * alpha;
      this.adaptedFloorDb = clamp(
        next,
        cfg.noiseFloorDb - cfg.maxAdaptDb,
        cfg.noiseFloorDb + cfg.maxAdaptDb,
      );
    }

    return events;
  }

  private endVoice(t: number, forced: boolean): VocalEvent {
    this.active = false;
    return {
      type: 'voice-end',
      time: t,
      durationMs: t - this.activeStart,
      peakDb: this.peakDb,
      forced,
    };
  }
}
