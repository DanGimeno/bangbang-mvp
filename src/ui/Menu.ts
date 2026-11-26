import { dbToMeter } from '../audio/analysis';
import type { CalibrationResult } from '../audio/NoiseCalibrator';
import type { Settings } from '../config/settings';
import { byId, formatDb, restartAnimation } from './dom';

export type MenuMode = 'title' | 'paused';

export interface MenuCallbacks {
  onStart(): void;
  onQuit(): void;
  onEnableMic(): void;
  onDeviceChange(deviceId: string | null): void;
  onCalibrate(): void;
  onSettingsChange(update: (settings: Settings) => void): void;
}

/** Title / pause overlay: microphone setup, calibration and settings. */
export class Menu {
  private readonly root = byId('overlay');
  private readonly stateLabel = byId('overlay-state');
  private readonly micStatus = byId('mic-status');
  private readonly micEnable = byId<HTMLButtonElement>('mic-enable');
  private readonly micDevice = byId<HTMLSelectElement>('mic-device');
  private readonly meterFill = byId('setup-meter-fill');
  private readonly meterFloor = byId('setup-meter-floor');
  private readonly meterThreshold = byId('setup-meter-threshold');
  private readonly levels = byId('setup-levels');
  private readonly detect = byId('setup-detect');
  private readonly calibrate = byId<HTMLButtonElement>('mic-calibrate');
  private readonly calibrationStatus = byId('calibration-status');
  private readonly start = byId<HTMLButtonElement>('btn-start');
  private readonly quit = byId<HTMLButtonElement>('btn-quit');
  private readonly error = byId('overlay-error');

  private readonly sensitivity = byId<HTMLInputElement>('set-sensitivity');
  private readonly debounce = byId<HTMLInputElement>('set-debounce');
  private readonly release = byId<HTMLInputElement>('set-release');
  private readonly adaptive = byId<HTMLInputElement>('set-adaptive');
  private readonly suppression = byId<HTMLInputElement>('set-suppression');
  private readonly mouse = byId<HTMLInputElement>('set-mouse');
  private readonly invert = byId<HTMLInputElement>('set-invert');
  private readonly mouseFire = byId<HTMLInputElement>('set-mousefire');

  constructor(callbacks: MenuCallbacks, debugAllowed: boolean) {
    byId('debug-card').hidden = !debugAllowed;
    this.start.addEventListener('click', () => callbacks.onStart());
    this.quit.addEventListener('click', () => callbacks.onQuit());
    this.micEnable.addEventListener('click', () => callbacks.onEnableMic());
    this.calibrate.addEventListener('click', () => callbacks.onCalibrate());
    this.micDevice.addEventListener('change', () =>
      callbacks.onDeviceChange(this.micDevice.value || null),
    );

    const bindRange = (input: HTMLInputElement, apply: (s: Settings, v: number) => void) =>
      input.addEventListener('input', () =>
        callbacks.onSettingsChange((s) => apply(s, Number(input.value))),
      );
    const bindCheck = (input: HTMLInputElement, apply: (s: Settings, v: boolean) => void) =>
      input.addEventListener('change', () =>
        callbacks.onSettingsChange((s) => apply(s, input.checked)),
      );
    bindRange(this.sensitivity, (s, v) => (s.audio.sensitivity = v));
    bindRange(this.debounce, (s, v) => (s.audio.debounceMs = v));
    bindRange(this.release, (s, v) => (s.audio.releaseMs = v));
    bindRange(this.mouse, (s, v) => (s.controls.mouseSensitivity = v));
    bindCheck(this.adaptive, (s, v) => (s.audio.adaptiveNoiseFloor = v));
    bindCheck(this.suppression, (s, v) => (s.audio.browserNoiseSuppression = v));
    bindCheck(this.invert, (s, v) => (s.controls.invertY = v));
    bindCheck(this.mouseFire, (s, v) => (s.debug.mouseFire = v));
  }

  set visible(value: boolean) {
    this.root.hidden = !value;
  }

  setMode(mode: MenuMode): void {
    this.stateLabel.hidden = mode !== 'paused';
    this.start.textContent = mode === 'paused' ? 'RESUME' : 'START';
    this.quit.hidden = mode !== 'paused';
  }

  showSettings(settings: Settings): void {
    this.sensitivity.value = String(settings.audio.sensitivity);
    this.debounce.value = String(settings.audio.debounceMs);
    this.release.value = String(settings.audio.releaseMs);
    this.adaptive.checked = settings.audio.adaptiveNoiseFloor;
    this.suppression.checked = settings.audio.browserNoiseSuppression;
    this.mouse.value = String(settings.controls.mouseSensitivity);
    this.invert.checked = settings.controls.invertY;
    this.mouseFire.checked = settings.debug.mouseFire;
    byId('out-sensitivity').textContent = `${settings.audio.sensitivity}`;
    byId('out-debounce').textContent = `${settings.audio.debounceMs} ms`;
    byId('out-release').textContent = `${settings.audio.releaseMs} ms`;
    byId('out-mouse').textContent = (settings.controls.mouseSensitivity * 1000).toFixed(1);
  }

  setMicState(state: 'off' | 'requesting' | 'on' | 'error', text: string): void {
    this.micStatus.textContent = text;
    this.micStatus.className = `mic-status${state === 'on' ? ' ok' : state === 'error' ? ' error' : ''}`;
    this.micEnable.disabled = state === 'requesting';
    this.micEnable.textContent = state === 'on' ? 'Restart microphone' : 'Enable microphone';
    this.calibrate.disabled = state !== 'on';
    this.micDevice.disabled = state !== 'on';
  }

  setDevices(devices: readonly MediaDeviceInfo[], selected: string | null): void {
    const options = devices.map((d, i) => {
      const option = document.createElement('option');
      option.value = d.deviceId;
      option.textContent = d.label || `Microphone ${i + 1}`;
      return option;
    });
    if (options.length === 0) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'Default microphone';
      options.push(option);
    }
    this.micDevice.replaceChildren(...options);
    if (selected && devices.some((d) => d.deviceId === selected)) this.micDevice.value = selected;
  }

  renderLevels(on: boolean, levelDb: number, floorDb: number, thresholdDb: number): void {
    this.meterFill.style.width = `${(on ? dbToMeter(levelDb) : 0) * 100}%`;
    this.meterFloor.style.left = `${dbToMeter(floorDb) * 100}%`;
    this.meterThreshold.style.left = `${dbToMeter(thresholdDb) * 100}%`;
    this.levels.textContent = on
      ? `level ${formatDb(levelDb)} · floor ${formatDb(floorDb)} · threshold ${formatDb(thresholdDb)}`
      : '';
  }

  flashDetection(text: string): void {
    this.detect.textContent = text;
    restartAnimation(this.detect, 'hit');
    window.setTimeout(() => {
      this.detect.classList.remove('hit');
      this.detect.textContent = 'SAY “BANG!”';
    }, 260);
  }

  setCalibrating(progress: number): void {
    this.calibrate.disabled = true;
    this.calibrationStatus.textContent = `Listening to the room… stay quiet (${Math.round(progress * 100)}%)`;
  }

  showCalibration(result: CalibrationResult | null, micOn: boolean): void {
    this.calibrate.disabled = !micOn;
    if (!result) {
      this.calibrationStatus.textContent = 'Not calibrated yet — using a default noise floor.';
      return;
    }
    const floor = formatDb(result.noiseFloorDb);
    const messages = {
      good: `Calibrated. Noise floor ${floor}. Now say “Bang!”`,
      noisy: `Noise floor ${floor}: that is a loud room. Expect misfires; try a headset mic or lower sensitivity.`,
      silent: `Noise floor ${floor}: suspiciously silent. Is the right microphone selected and unmuted?`,
    } as const;
    this.calibrationStatus.textContent = messages[result.quality];
  }

  showError(text: string | null): void {
    this.error.hidden = !text;
    this.error.textContent = text ?? '';
  }
}
