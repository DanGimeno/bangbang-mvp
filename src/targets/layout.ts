/** Target placement for the shooting range (metres; the firing line is at z ≈ -11). */
export interface TargetPlacement {
  x: number;
  z: number;
  /** Disc diameter in metres. */
  size: number;
  /** Height of the post. */
  height: number;
}

export const RANGE_TARGETS: readonly TargetPlacement[] = [
  { x: -8, z: -2, size: 1.0, height: 1.1 },
  { x: -3, z: 3, size: 1.0, height: 1.4 },
  { x: 2, z: -4, size: 0.9, height: 0.9 },
  { x: 7, z: 4, size: 1.0, height: 1.3 },
  { x: 11, z: -1, size: 1.0, height: 1.0 },
  { x: -10, z: 14, size: 1.2, height: 1.6 },
  { x: -1, z: 16, size: 1.2, height: 1.2 },
  { x: 8, z: 20, size: 1.3, height: 1.8 },
  { x: -5, z: 28, size: 1.5, height: 2.0 },
  { x: 4, z: 33, size: 1.6, height: 2.4 },
];
