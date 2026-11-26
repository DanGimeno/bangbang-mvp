/** Pure signal helpers shared by the detector, calibrator and UI. */

export const DB_FLOOR = -100;

export function toDb(linear: number): number {
  if (!(linear > 0)) return DB_FLOOR;
  return Math.max(DB_FLOOR, 20 * Math.log10(linear));
}

export function fromDb(db: number): number {
  return 10 ** (db / 20);
}

export function rms(samples: ArrayLike<number>): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i] ?? 0;
    sum += s * s;
  }
  return Math.sqrt(sum / samples.length);
}

export function peak(samples: ArrayLike<number>): number {
  let max = 0;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.abs(samples[i] ?? 0);
    if (s > max) max = s;
  }
  return max;
}

/** Maps a dBFS value to 0..1 for level meters. */
export function dbToMeter(db: number, minDb = -80, maxDb = 0): number {
  if (db <= minDb) return 0;
  if (db >= maxDb) return 1;
  return (db - minDb) / (maxDb - minDb);
}

/** Linear-interpolated percentile, p in 0..1. Returns NaN for an empty list. */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(1, Math.max(0, p)) * (sorted.length - 1);
  const lo = Math.floor(index);
  const hi = Math.ceil(index);
  const a = sorted[lo] as number;
  const b = sorted[hi] as number;
  return a + (b - a) * (index - lo);
}
