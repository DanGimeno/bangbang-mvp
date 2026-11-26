import { EventBus } from '../core/EventBus';
import type { Settings } from '../config/settings';
import { MicrophoneCapture, type MicStatus } from './MicrophoneCapture';
import { NoiseCalibrator, type CalibrationResult } from './NoiseCalibrator';
import { toDb } from './analysis';
import { VocalDetector, type DetectorConfig } from './VocalDetector';
import type { AudioFrame, VocalEvent } from './types';

export interface VocalInputEvents {
  vocal: VocalEvent;
  calibrated: CalibrationResult;
  status: MicStatus;
}

/** Maps persisted player settings onto detector parameters. */
export function detectorConfigFromSettings(audio: Settings['audio']): Partial<DetectorConfig> {
  const config: Partial<DetectorConfig> = {
    sensitivity: audio.sensitivity,
    debounceMs: audio.debounceMs,
    releaseMs: audio.releaseMs,
    adaptiveNoiseFloor: audio.adaptiveNoiseFloor,
  };
  if (audio.noiseFloorDb !== null) config.noiseFloorDb = audio.noiseFloorDb;
  return config;
}

/**
 * Facade over the whole voice pipeline: capture → (calibration | detection) → events.
 * Gameplay code subscribes to `bus` and never touches microphone APIs.
 */
export class VocalInput {
  readonly bus = new EventBus<VocalInputEvents>();
  readonly detector: VocalDetector;
  private readonly capture = new MicrophoneCapture();
  private readonly calibrator = new NoiseCalibrator(2000);
  private lastLevelDb = -100;

  constructor(config: Partial<DetectorConfig>) {
    this.detector = new VocalDetector(config);
    this.capture.onFrame = (frame) => this.handleFrame(frame);
    this.capture.onStatusChange = (status) => this.bus.emit('status', status);
  }

  get status(): MicStatus {
    return this.capture.status;
  }

  get activeDeviceId(): string | null {
    return this.capture.activeDeviceId;
  }

  get levelDb(): number {
    return this.lastLevelDb;
  }

  get isCalibrating(): boolean {
    return this.calibrator.active;
  }

  get calibrationProgress(): number {
    return this.calibrator.progress;
  }

  /** Throws a MicrophoneError on failure. Call from a user gesture. */
  async enable(deviceId: string | null, noiseSuppression: boolean): Promise<void> {
    await this.capture.start({ deviceId, noiseSuppression });
    this.detector.reset();
  }

  disable(): void {
    this.calibrator.cancel();
    this.capture.stop();
    this.lastLevelDb = -100;
  }

  resume(): Promise<void> {
    return this.capture.resume();
  }

  listDevices(): Promise<MediaDeviceInfo[]> {
    return this.capture.listDevices();
  }

  configure(config: Partial<DetectorConfig>): void {
    this.detector.configure(config);
  }

  calibrate(): void {
    this.calibrator.start();
  }

  private handleFrame(frame: AudioFrame): void {
    this.lastLevelDb = toDb(frame.rms);
    if (this.calibrator.active) {
      const result = this.calibrator.add(frame);
      if (result) {
        this.detector.configure({ noiseFloorDb: result.noiseFloorDb });
        this.detector.reset();
        this.bus.emit('calibrated', result);
      }
      return;
    }
    for (const event of this.detector.process(frame)) this.bus.emit('vocal', event);
  }
}
