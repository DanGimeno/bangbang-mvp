import { fromDb } from './analysis';
import type { AudioFrame } from './types';

/** Test helper: builds ~5 ms frames from a piecewise level envelope. */
export const FRAME_MS = 5;

export type Segment =
  [durationMs: number, db: number] | [durationMs: number, fromDb: number, toDb: number];

export function framesFrom(segments: readonly Segment[], startTime = 0): AudioFrame[] {
  const frames: AudioFrame[] = [];
  let t = startTime;
  for (const segment of segments) {
    const [duration, from] = segment;
    const to = segment.length === 3 ? segment[2] : from;
    const count = Math.max(1, Math.round(duration / FRAME_MS));
    for (let i = 0; i < count; i++) {
      t += FRAME_MS;
      const db = from + ((to - from) * (i + 1)) / count;
      const rms = fromDb(db);
      frames.push({ time: t, rms, peak: Math.min(1, rms * 1.4) });
    }
  }
  return frames;
}
