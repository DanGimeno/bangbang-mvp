import { describe, expect, it } from 'vitest';
import { framesFrom, type Segment } from './testSignals';
import type { VocalEvent } from './types';
import {
  computeThresholdDb,
  sensitivityToMarginDb,
  VocalDetector,
  type DetectorConfig,
} from './VocalDetector';

const QUIET = -70;
const LOUD = -20;

function run(segments: Segment[], config: Partial<DetectorConfig> = {}) {
  const detector = new VocalDetector({ noiseFloorDb: -60, adaptiveNoiseFloor: false, ...config });
  const events: VocalEvent[] = [];
  for (const frame of framesFrom(segments)) events.push(...detector.process(frame));
  return { detector, events, impulses: events.filter((e) => e.type === 'impulse') };
}

describe('threshold mapping', () => {
  it('maps sensitivity 0..100 to a 30..6 dB margin', () => {
    expect(sensitivityToMarginDb(0)).toBe(30);
    expect(sensitivityToMarginDb(100)).toBe(6);
    expect(sensitivityToMarginDb(50)).toBe(18);
    expect(sensitivityToMarginDb(500)).toBe(6);
  });

  it('never goes below the absolute minimum threshold', () => {
    expect(computeThresholdDb(-60, 50, -55)).toBe(-42);
    expect(computeThresholdDb(-100, 100, -55)).toBe(-55);
  });
});

describe('VocalDetector', () => {
  it('stays silent on silence and steady background noise', () => {
    expect(run([[1000, QUIET]]).events).toEqual([]);
    expect(run([[1000, -50]]).events).toEqual([]);
  });

  it('detects a single short burst ("Bang!") with start, impulse and end', () => {
    const { events } = run([
      [200, QUIET],
      [60, LOUD],
      [300, QUIET],
    ]);
    expect(events.map((e) => e.type)).toEqual(['voice-start', 'impulse', 'voice-end']);
    const impulse = events[1];
    expect(impulse?.type === 'impulse' && impulse.retrigger).toBe(false);
    const end = events[2];
    expect(end?.type === 'voice-end' && end.forced).toBe(false);
  });

  it('fires on the first loud frame (low latency)', () => {
    const { events } = run([
      [200, QUIET],
      [60, LOUD],
    ]);
    const impulse = events.find((e) => e.type === 'impulse');
    expect(impulse?.time).toBe(205);
  });

  it('detects two separate bursts ("Bang! Bang!")', () => {
    const { impulses } = run([
      [200, QUIET],
      [60, LOUD],
      [250, QUIET],
      [60, LOUD],
      [300, QUIET],
    ]);
    expect(impulses).toHaveLength(2);
  });

  it('merges attacks closer than the debounce time', () => {
    const segments: Segment[] = [
      [200, QUIET],
      [10, LOUD],
      [15, QUIET],
      [10, LOUD],
      [300, QUIET],
    ];
    expect(run(segments, { debounceMs: 70 }).impulses).toHaveLength(1);
    expect(run(segments, { debounceMs: 20 }).impulses).toHaveLength(2);
  });

  it('ignores a slow swell above the threshold (vowels, fans spinning up)', () => {
    const { impulses } = run([
      [200, QUIET],
      [600, QUIET, LOUD],
      [300, LOUD],
    ]);
    expect(impulses).toHaveLength(0);
  });

  it('retriggers on each syllable of a sustained "ra-ta-ta-ta"', () => {
    const syllables: Segment[] = [];
    for (let i = 0; i < 5; i++) syllables.push([40, -20], [40, -32]);
    const { events, impulses } = run([[200, QUIET], ...syllables, [300, QUIET]]);
    expect(events.filter((e) => e.type === 'voice-start')).toHaveLength(1);
    expect(events.filter((e) => e.type === 'voice-end')).toHaveLength(1);
    expect(impulses.length).toBeGreaterThanOrEqual(4);
    expect(impulses.slice(1).every((e) => e.type === 'impulse' && e.retrigger)).toBe(true);
  });

  it('keeps the voice active during a held "Trrrrr" and releases after silence', () => {
    const { events, detector } = run([
      [200, QUIET],
      [800, LOUD],
    ]);
    expect(detector.isActive).toBe(true);
    expect(events.filter((e) => e.type === 'impulse')).toHaveLength(1);
    const after = framesFrom([[200, QUIET]], 1000).flatMap((f) => detector.process(f));
    expect(after.map((e) => e.type)).toEqual(['voice-end']);
    expect(detector.isActive).toBe(false);
  });

  it('force-releases a stuck trigger and re-arms only after quiet', () => {
    const { events } = run(
      [
        [200, QUIET],
        [4000, LOUD], // e.g. a vacuum cleaner switching on
      ],
      { maxActiveMs: 3000 },
    );
    const ends = events.filter((e) => e.type === 'voice-end');
    expect(ends).toHaveLength(1);
    expect(ends[0]?.type === 'voice-end' && ends[0].forced).toBe(true);
    expect(events.filter((e) => e.type === 'impulse')).toHaveLength(1);
  });

  it('respects sensitivity', () => {
    const burst: Segment[] = [
      [200, QUIET],
      [60, -40],
      [300, QUIET],
    ];
    expect(run(burst, { sensitivity: 100 }).impulses).toHaveLength(1);
    expect(run(burst, { sensitivity: 0 }).impulses).toHaveLength(0);
  });

  it('does not trigger below the absolute minimum threshold', () => {
    const { impulses } = run(
      [
        [200, -100],
        [60, -60],
        [300, -100],
      ],
      { noiseFloorDb: -100, sensitivity: 100 },
    );
    expect(impulses).toHaveLength(0);
  });

  it('reports strength between 0 and 1, larger for louder shots', () => {
    const soft = run([
      [200, QUIET],
      [60, -38],
    ]).impulses[0];
    const loud = run([
      [200, QUIET],
      [60, -10],
    ]).impulses[0];
    expect(soft?.type === 'impulse' && loud?.type === 'impulse').toBe(true);
    if (soft?.type === 'impulse' && loud?.type === 'impulse') {
      expect(loud.strength).toBeGreaterThan(soft.strength);
      expect(loud.strength).toBeLessThanOrEqual(1);
      expect(soft.strength).toBeGreaterThanOrEqual(0);
    }
  });

  it('adapts the noise floor slowly, within bounds', () => {
    const detector = new VocalDetector({
      noiseFloorDb: -60,
      adaptiveNoiseFloor: true,
      maxAdaptDb: 10,
      adaptTimeConstantMs: 1000,
    });
    for (const frame of framesFrom([[200, -55]])) detector.process(frame);
    const early = detector.noiseFloorDb;
    expect(early).toBeGreaterThan(-60);
    expect(early).toBeLessThan(-55);
    for (const frame of framesFrom([[10000, -45]], 200)) detector.process(frame);
    expect(detector.noiseFloorDb).toBeCloseTo(-50, 5); // clamped at floor + maxAdaptDb
  });

  it('resets the adapted floor when recalibrated', () => {
    const detector = new VocalDetector({ noiseFloorDb: -60 });
    for (const frame of framesFrom([[3000, -52]])) detector.process(frame);
    detector.configure({ noiseFloorDb: -40 });
    expect(detector.noiseFloorDb).toBe(-40);
  });
});
