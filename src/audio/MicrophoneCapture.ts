import workletUrl from './worklet/level-processor.ts?worker&url';
import { classifyMicError, MicrophoneError } from './microphoneErrors';
import type { AudioFrame } from './types';

const PROCESSOR_NAME = 'bangbang-level';
/** Samples per analysis frame (~5.3 ms at 48 kHz). */
const FRAME_SIZE = 256;
/** Removes rumble, handling noise and mains hum before level analysis. */
const HIGH_PASS_HZ = 150;

export interface CaptureOptions {
  deviceId: string | null;
  /** Browser noise suppression. Off by default: it tends to swallow short plosives. */
  noiseSuppression: boolean;
}

export type MicStatus = 'idle' | 'requesting' | 'active' | 'error';

/**
 * Owns getUserMedia, the AudioContext and the analysis graph:
 *
 *   MediaStreamSource → high-pass Biquad → AudioWorklet (level frames) → muted gain → destination
 *
 * Audio is analysed in memory only. Nothing is recorded, stored or transmitted.
 */
export class MicrophoneCapture {
  onFrame: ((frame: AudioFrame) => void) | null = null;
  onStatusChange: ((status: MicStatus) => void) | null = null;

  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private nodes: AudioNode[] = [];
  private statusValue: MicStatus = 'idle';
  private deviceIdValue: string | null = null;
  private workletLoaded = false;

  get status(): MicStatus {
    return this.statusValue;
  }

  /** Device id actually in use (may differ from the requested one). */
  get activeDeviceId(): string | null {
    return this.deviceIdValue;
  }

  get sampleRate(): number | null {
    return this.context?.sampleRate ?? null;
  }

  static checkSupport(): void {
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      throw new MicrophoneError('insecure-context');
    }
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof AudioWorkletNode === 'undefined'
    ) {
      throw new MicrophoneError('unsupported');
    }
  }

  /** Must be called from a user gesture (click) so the AudioContext may start. */
  async start(options: CaptureOptions): Promise<void> {
    this.setStatus('requesting');
    try {
      MicrophoneCapture.checkSupport();
      this.stopStream();
      const stream = await this.openStream(options);
      this.stream = stream;
      this.deviceIdValue = stream.getAudioTracks()[0]?.getSettings().deviceId ?? null;
      stream.getAudioTracks()[0]?.addEventListener('ended', () => {
        this.stopStream();
        this.setStatus('error');
      });

      const context = await this.ensureContext();
      const source = context.createMediaStreamSource(stream);
      const highPass = context.createBiquadFilter();
      highPass.type = 'highpass';
      highPass.frequency.value = HIGH_PASS_HZ;
      highPass.Q.value = Math.SQRT1_2;
      const worklet = new AudioWorkletNode(context, PROCESSOR_NAME, {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        channelCount: 1,
        channelCountMode: 'explicit',
        processorOptions: { frameSize: FRAME_SIZE },
      });
      worklet.port.onmessage = (event: MessageEvent<AudioFrame>) => this.onFrame?.(event.data);
      // Keep the worklet pulled by the graph without making any sound.
      const mute = context.createGain();
      mute.gain.value = 0;
      source.connect(highPass).connect(worklet).connect(mute).connect(context.destination);
      this.nodes = [source, highPass, worklet, mute];
      this.setStatus('active');
    } catch (error) {
      this.stopStream();
      this.setStatus('error');
      throw error instanceof MicrophoneError
        ? error
        : new MicrophoneError(classifyMicError(error), String(error));
    }
  }

  /** Resumes a suspended AudioContext (call from a user gesture). */
  async resume(): Promise<void> {
    if (this.context?.state === 'suspended') await this.context.resume();
  }

  stop(): void {
    this.stopStream();
    this.setStatus('idle');
  }

  /** Lists audio inputs. Labels are only available after permission was granted. */
  async listDevices(): Promise<MediaDeviceInfo[]> {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === 'audioinput');
  }

  private async openStream(options: CaptureOptions): Promise<MediaStream> {
    const audio: MediaTrackConstraints = {
      // Automatic gain control would move the noise floor under our feet.
      autoGainControl: false,
      // No game audio plays gunshots, so echo is not a concern for detection.
      echoCancellation: false,
      noiseSuppression: options.noiseSuppression,
      channelCount: 1,
    };
    if (options.deviceId) audio.deviceId = { exact: options.deviceId };
    try {
      return await navigator.mediaDevices.getUserMedia({ audio, video: false });
    } catch (error) {
      // The saved device may have been unplugged: fall back to the default one.
      if (options.deviceId && classifyMicError(error) === 'not-found') {
        return this.openStream({ ...options, deviceId: null });
      }
      throw error;
    }
  }

  private async ensureContext(): Promise<AudioContext> {
    if (!this.context) {
      this.context = new AudioContext({ latencyHint: 'interactive' });
    }
    if (this.context.state === 'suspended') await this.context.resume();
    if (!this.workletLoaded) {
      try {
        await this.context.audioWorklet.addModule(workletUrl);
        this.workletLoaded = true;
      } catch (error) {
        throw new MicrophoneError('worklet-failed', String(error));
      }
    }
    return this.context;
  }

  private stopStream(): void {
    for (const node of this.nodes) node.disconnect();
    this.nodes = [];
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }

  private setStatus(status: MicStatus): void {
    if (status === this.statusValue) return;
    this.statusValue = status;
    this.onStatusChange?.(status);
  }
}
