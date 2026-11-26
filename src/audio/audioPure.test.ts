import { describe, expect, it } from 'vitest';
import { dbToMeter, fromDb, peak, percentile, rms, toDb } from './analysis';
import { classifyMicError, MicrophoneError } from './microphoneErrors';
import { NoiseCalibrator, summarizeCalibration } from './NoiseCalibrator';
import { framesFrom } from './testSignals';
import { detectorConfigFromSettings } from './VocalInput';
import { DEFAULT_SETTINGS } from '../config/settings';

describe('analysis', () => {
  it('converts between linear and dB', () => {
    expect(toDb(1)).toBe(0);
    expect(toDb(0.1)).toBeCloseTo(-20);
    expect(toDb(0)).toBe(-100);
    expect(toDb(Number.NaN)).toBe(-100);
    expect(fromDb(-20)).toBeCloseTo(0.1);
  });

  it('computes rms and peak', () => {
    expect(rms([1, -1, 1, -1])).toBe(1);
    expect(rms([])).toBe(0);
    expect(peak([0.1, -0.7, 0.3])).toBeCloseTo(0.7);
  });

  it('maps dB to a 0..1 meter', () => {
    expect(dbToMeter(-100)).toBe(0);
    expect(dbToMeter(-40)).toBe(0.5);
    expect(dbToMeter(5)).toBe(1);
  });

  it('computes percentiles', () => {
    expect(percentile([3, 1, 2], 0.5)).toBe(2);
    expect(percentile([0, 10], 0.9)).toBe(9);
    expect(percentile([], 0.5)).toBeNaN();
  });
});

describe('NoiseCalibrator', () => {
  it('reports the 90th percentile after the configured duration', () => {
    const calibrator = new NoiseCalibrator(1000);
    calibrator.start();
    let result = null;
    for (const frame of framesFrom([[1200, -62]])) {
      result = calibrator.add(frame) ?? result;
    }
    expect(result?.noiseFloorDb).toBeCloseTo(-62);
    expect(result?.quality).toBe('good');
    expect(calibrator.active).toBe(false);
  });

  it('ignores frames when not running', () => {
    const calibrator = new NoiseCalibrator(100);
    expect(calibrator.add({ time: 0, rms: 0.1, peak: 0.1 })).toBeNull();
  });

  it('flags noisy and silent rooms', () => {
    expect(summarizeCalibration([-20, -25, -30]).quality).toBe('noisy');
    expect(summarizeCalibration([-100, -100]).quality).toBe('silent');
  });
});

describe('microphone errors', () => {
  it('classifies DOMException names', () => {
    expect(classifyMicError({ name: 'NotAllowedError' })).toBe('permission-denied');
    expect(classifyMicError({ name: 'NotFoundError' })).toBe('not-found');
    expect(classifyMicError({ name: 'NotReadableError' })).toBe('in-use');
    expect(classifyMicError({ name: 'SecurityError' })).toBe('insecure-context');
    expect(classifyMicError(new Error('x'))).toBe('unknown');
    expect(classifyMicError(new MicrophoneError('unsupported'))).toBe('unsupported');
  });

  it('carries a human-readable message', () => {
    expect(new MicrophoneError('permission-denied').message).toMatch(/denied/i);
  });
});

describe('detectorConfigFromSettings', () => {
  it('omits the noise floor until calibrated', () => {
    const config = detectorConfigFromSettings(DEFAULT_SETTINGS.audio);
    expect(config.noiseFloorDb).toBeUndefined();
    expect(config.sensitivity).toBe(DEFAULT_SETTINGS.audio.sensitivity);
    expect(
      detectorConfigFromSettings({ ...DEFAULT_SETTINGS.audio, noiseFloorDb: -48 }).noiseFloorDb,
    ).toBe(-48);
  });
});
