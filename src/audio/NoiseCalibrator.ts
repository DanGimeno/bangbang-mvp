import { percentile, toDb } from './analysis';
import type { AudioFrame } from './types';

export type CalibrationQuality = 'good' | 'noisy' | 'silent';

export interface CalibrationResult {
  /** Estimated ambient noise floor (90th percentile of frame levels), in dBFS. */
  noiseFloorDb: number;
  quality: CalibrationQuality;
  frames: number;
}

/** Above this floor the room is loud enough that detection will suffer. */
export const NOISY_FLOOR_DB = -35;
/** Below this the input is suspiciously silent (muted mic, wrong device). */
export const SILENT_FLOOR_DB = -90;

/**
 * Measures ambient noise while the player stays quiet.
 * Uses a high percentile rather than the mean so that occasional background
 * bumps raise the floor (fewer false positives) without one spike dominating.
 */
export class NoiseCalibrator {
  private running = false;
  private startTime: number | null = null;
  private lastTime = 0;
  private readonly levels: number[] = [];

  constructor(private readonly durationMs = 2000) {}

  get active(): boolean {
    return this.running;
  }

  /** 0..1 progress of the current run. */
  get progress(): number {
    if (!this.running || this.startTime === null) return 0;
    return Math.min(1, (this.lastTime - this.startTime) / this.durationMs);
  }

  start(): void {
    this.running = true;
    this.startTime = null;
    this.levels.length = 0;
  }

  cancel(): void {
    this.running = false;
    this.startTime = null;
  }

  /** Feeds a frame. Returns the result once enough audio has been observed, otherwise null. */
  add(frame: AudioFrame): CalibrationResult | null {
    if (!this.running) return null;
    if (this.startTime === null) this.startTime = frame.time;
    this.lastTime = frame.time;
    this.levels.push(toDb(frame.rms));
    if (frame.time - this.startTime < this.durationMs) return null;
    this.cancel();
    return summarizeCalibration(this.levels);
  }
}

export function summarizeCalibration(levelsDb: readonly number[]): CalibrationResult {
  const floor = levelsDb.length > 0 ? percentile(levelsDb, 0.9) : -100;
  let quality: CalibrationQuality = 'good';
  if (floor > NOISY_FLOOR_DB) quality = 'noisy';
  else if (floor < SILENT_FLOOR_DB) quality = 'silent';
  return { noiseFloorDb: floor, quality, frames: levelsDb.length };
}
