import { clamp, degToRad } from '../core/math';

/** Pure first-person movement math (Babylon's left-handed, Y-up convention). */

export interface MoveIntent {
  /** -1 (back) .. 1 (forward) */
  forward: number;
  /** -1 (left) .. 1 (right) */
  right: number;
}

export interface Bounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export const MAX_PITCH = degToRad(85);

/** Horizontal displacement for this frame. Diagonals are not faster than straight lines. */
export function computeMoveDelta(
  intent: MoveIntent,
  yaw: number,
  speed: number,
  dt: number,
): { x: number; z: number } {
  let { forward, right } = intent;
  const length = Math.hypot(forward, right);
  if (length === 0) return { x: 0, z: 0 };
  if (length > 1) {
    forward /= length;
    right /= length;
  }
  const sin = Math.sin(yaw);
  const cos = Math.cos(yaw);
  // forward = (sin, cos), right = (cos, -sin)
  const x = (forward * sin + right * cos) * speed * dt;
  const z = (forward * cos - right * sin) * speed * dt;
  return { x, z };
}

/** Applies a mouse delta (pixels) to yaw/pitch. Pitch is clamped to avoid flipping. */
export function applyLook(
  yaw: number,
  pitch: number,
  dx: number,
  dy: number,
  sensitivity: number,
  invertY: boolean,
): { yaw: number; pitch: number } {
  const nextYaw = yaw + dx * sensitivity;
  const nextPitch = clamp(pitch + (invertY ? -dy : dy) * sensitivity, -MAX_PITCH, MAX_PITCH);
  return { yaw: nextYaw, pitch: nextPitch };
}

export function clampToBounds(x: number, z: number, bounds: Bounds): { x: number; z: number } {
  return {
    x: clamp(x, bounds.minX, bounds.maxX),
    z: clamp(z, bounds.minZ, bounds.maxZ),
  };
}
