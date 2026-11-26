import type { FreeCamera } from '@babylonjs/core';
import type { InputManager } from '../input/InputManager';
import { applyLook, clampToBounds, computeMoveDelta, type Bounds } from './movement';

export const EYE_HEIGHT = 1.7;
export const WALK_SPEED = 5;

export interface LookSettings {
  mouseSensitivity: number;
  invertY: boolean;
}

/** Binds pure movement math to the Babylon camera. No physics: just bounds clamping. */
export class PlayerController {
  yaw = 0;
  pitch = 0;
  private movingValue = false;

  constructor(
    private readonly camera: FreeCamera,
    private readonly bounds: Bounds,
    spawn: { x: number; z: number },
  ) {
    camera.position.set(spawn.x, EYE_HEIGHT, spawn.z);
    this.applyToCamera();
  }

  get isMoving(): boolean {
    return this.movingValue;
  }

  update(dt: number, input: InputManager, look: LookSettings): void {
    const { dx, dy } = input.consumeMouseDelta();
    const next = applyLook(this.yaw, this.pitch, dx, dy, look.mouseSensitivity, look.invertY);
    this.yaw = next.yaw;
    this.pitch = next.pitch;

    const delta = computeMoveDelta(input.moveIntent(), this.yaw, WALK_SPEED, dt);
    this.movingValue = delta.x !== 0 || delta.z !== 0;
    const pos = this.camera.position;
    const clamped = clampToBounds(pos.x + delta.x, pos.z + delta.z, this.bounds);
    pos.set(clamped.x, EYE_HEIGHT, clamped.z);
    this.applyToCamera();
  }

  private applyToCamera(): void {
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }
}
