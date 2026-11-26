/**
 * AudioWorklet processor: turns raw microphone samples into small level frames.
 *
 * Runs on the audio rendering thread. It is intentionally self-contained (no imports)
 * so it bundles into a single file. Raw samples never leave this processor; only
 * `{ time, rms, peak }` summaries are posted to the main thread, roughly every 5 ms.
 */

// Globals of AudioWorkletGlobalScope (not part of TypeScript's DOM lib).
declare const currentTime: number;
declare const sampleRate: number;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  constructor(options?: unknown);
}
declare function registerProcessor(
  name: string,
  ctor: new (options: { processorOptions?: { frameSize?: number } }) => AudioWorkletProcessor,
): void;

export const LEVEL_PROCESSOR_NAME = 'bangbang-level';

class LevelProcessor extends AudioWorkletProcessor {
  private readonly frameSize: number;
  private sumSquares = 0;
  private count = 0;
  private maxAbs = 0;

  constructor(options: { processorOptions?: { frameSize?: number } }) {
    super(options);
    this.frameSize = options.processorOptions?.frameSize ?? 256;
  }

  process(inputs: Float32Array[][]): boolean {
    const channel = inputs[0]?.[0];
    if (!channel) return true;
    for (let i = 0; i < channel.length; i++) {
      const s = channel[i] as number;
      this.sumSquares += s * s;
      const a = s < 0 ? -s : s;
      if (a > this.maxAbs) this.maxAbs = a;
      this.count++;
      if (this.count >= this.frameSize) {
        this.port.postMessage({
          time: (currentTime + (i + 1) / sampleRate) * 1000,
          rms: Math.sqrt(this.sumSquares / this.count),
          peak: this.maxAbs,
        });
        this.sumSquares = 0;
        this.count = 0;
        this.maxAbs = 0;
      }
    }
    return true;
  }
}

registerProcessor(LEVEL_PROCESSOR_NAME, LevelProcessor);
