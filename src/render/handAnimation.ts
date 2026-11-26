import type { HandPose } from '../weapons/weaponDefs';

/**
 * Pure keyframe data and sampling for the hand view model.
 * Offsets are relative to the rig's rest pose: d = position (m), r = rotation (rad).
 */
export interface Keyframe {
  t: number;
  d: readonly [number, number, number];
  r: readonly [number, number, number];
}

export interface PoseOffset {
  d: [number, number, number];
  r: [number, number, number];
}

const TAU = Math.PI * 2;

/**
 * The reload gestures. They are unnecessarily elaborate on purpose, and must end on a
 * pose visually identical to the rest pose (multiples of 2π are fine).
 */
export const RELOAD_KEYFRAMES: Record<HandPose, readonly Keyframe[]> = {
  // Drop the "magazine", do a regulation twirl, blow the smoke off the fingertip.
  'finger-gun': [
    { t: 0, d: [0, 0, 0], r: [0, 0, 0] },
    { t: 0.15, d: [0, -0.1, 0], r: [0.7, 0, 0] },
    { t: 0.5, d: [0, -0.06, 0.02], r: [0.7 + TAU, 0, 0] },
    { t: 0.62, d: [-0.13, 0.05, -0.1], r: [TAU - 1.3, 0, 0] },
    { t: 0.85, d: [-0.13, 0.05, -0.1], r: [TAU - 1.3, 0, 0.15] },
    { t: 1, d: [0, 0, 0], r: [TAU, 0, 0] },
  ],
  // Break the action at the wrist, insert shells, snap it shut with authority.
  'double-barrel': [
    { t: 0, d: [0, 0, 0], r: [0, 0, 0] },
    { t: 0.2, d: [0, -0.05, 0], r: [1.0, 0, 0] },
    { t: 0.45, d: [0, -0.07, 0], r: [1.0, 0, 0.1] },
    { t: 0.7, d: [0, -0.05, 0], r: [1.0, 0, -0.1] },
    { t: 0.85, d: [0, 0.01, 0.02], r: [-0.3, 0, 0] },
    { t: 1, d: [0, 0, 0], r: [0, 0, 0] },
  ],
  // Remove the magazine (none), slap in a new one (also none), rack the void.
  'empty-hands': [
    { t: 0, d: [0, 0, 0], r: [0, 0, 0] },
    { t: 0.2, d: [0, -0.06, 0], r: [0, 0, 0.4] },
    { t: 0.45, d: [0, -0.07, 0], r: [0, 0, 0.4] },
    { t: 0.55, d: [0, -0.02, 0.02], r: [0, 0, 0.1] },
    { t: 0.75, d: [0.03, -0.03, -0.06], r: [0, 0, 0] },
    { t: 0.85, d: [0, 0, 0.02], r: [0, 0, 0] },
    { t: 1, d: [0, 0, 0], r: [0, 0, 0] },
  ],
};

const smoothstep = (x: number): number => x * x * (3 - 2 * x);

/** Samples a keyframe track at progress p (0..1) with smoothstep easing between keys. */
export function sampleKeyframes(keys: readonly Keyframe[], p: number): PoseOffset {
  const first = keys[0];
  if (!first) return { d: [0, 0, 0], r: [0, 0, 0] };
  if (p <= first.t) return { d: [...first.d], r: [...first.r] };
  for (let i = 1; i < keys.length; i++) {
    const b = keys[i] as Keyframe;
    if (p <= b.t) {
      const a = keys[i - 1] as Keyframe;
      const span = b.t - a.t;
      const x = smoothstep(span > 0 ? (p - a.t) / span : 1);
      const mix = (u: readonly number[], v: readonly number[]) =>
        [0, 1, 2].map((k) => (u[k] as number) + ((v[k] as number) - (u[k] as number)) * x) as [
          number,
          number,
          number,
        ];
      return { d: mix(a.d, b.d), r: mix(a.r, b.r) };
    }
  }
  const last = keys[keys.length - 1] as Keyframe;
  return { d: [...last.d], r: [...last.r] };
}

/** Index of the reload caption to show at progress p. */
export function reloadStepIndex(stepCount: number, p: number): number {
  if (stepCount <= 0) return -1;
  return Math.min(stepCount - 1, Math.floor(Math.max(0, p) * stepCount));
}
