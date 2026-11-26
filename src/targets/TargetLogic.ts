/**
 * Pure state of a knock-down target: standing → falling → down → rising → standing.
 * Rendering reads `angle` (0 = upright, 1 = flat) every frame.
 */
export type TargetPhase = 'standing' | 'falling' | 'down' | 'rising';

export interface TargetTiming {
  fallMs: number;
  downMs: number;
  riseMs: number;
}

export const DEFAULT_TARGET_TIMING: TargetTiming = { fallMs: 160, downMs: 2500, riseMs: 400 };

export class TargetLogic {
  phase: TargetPhase = 'standing';
  private elapsed = 0;

  constructor(private readonly timing: TargetTiming = DEFAULT_TARGET_TIMING) {}

  get isHittable(): boolean {
    return this.phase === 'standing';
  }

  /** 0 = upright, 1 = knocked flat. */
  get angle(): number {
    switch (this.phase) {
      case 'standing':
        return 0;
      case 'falling':
        return Math.min(1, this.elapsed / this.timing.fallMs);
      case 'down':
        return 1;
      case 'rising':
        return 1 - Math.min(1, this.elapsed / this.timing.riseMs);
    }
  }

  /** Returns true if the hit counted (target was standing). */
  hit(): boolean {
    if (!this.isHittable) return false;
    this.phase = 'falling';
    this.elapsed = 0;
    return true;
  }

  update(dtMs: number): void {
    if (this.phase === 'standing') return;
    this.elapsed += dtMs;
    if (this.phase === 'falling' && this.elapsed >= this.timing.fallMs) {
      this.advance('down');
    } else if (this.phase === 'down' && this.elapsed >= this.timing.downMs) {
      this.advance('rising');
    } else if (this.phase === 'rising' && this.elapsed >= this.timing.riseMs) {
      this.advance('standing');
    }
  }

  private advance(phase: TargetPhase): void {
    this.phase = phase;
    this.elapsed = 0;
  }
}
