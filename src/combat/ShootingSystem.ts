import { Ray, Vector3, type Camera, type Scene } from '@babylonjs/core';
import { degToRad } from '../core/math';
import { isTargetMetadata, type TargetManager } from '../targets/TargetManager';
import type { WeaponDef } from '../weapons/weaponDefs';
import type { ImpactEffects } from './ImpactEffects';
import { pelletOffsets } from './spread';

export interface ShotResult {
  targetsHit: number;
  bullseyes: number;
}

/**
 * Hitscan resolution. Receives "a shot was fired with weapon X" and casts rays from the
 * camera; knows nothing about microphones or how the trigger was pulled.
 */
export class ShootingSystem {
  private readonly forward = new Vector3();
  private readonly right = new Vector3();
  private readonly up = new Vector3();

  constructor(
    private readonly scene: Scene,
    private readonly camera: Camera,
    private readonly targets: TargetManager,
    private readonly impacts: ImpactEffects,
    private readonly rng: () => number = Math.random,
  ) {}

  fire(weapon: WeaponDef): ShotResult {
    this.camera.getDirectionToRef(Vector3.Forward(), this.forward);
    this.camera.getDirectionToRef(Vector3.Right(), this.right);
    this.camera.getDirectionToRef(Vector3.Up(), this.up);
    const origin = this.camera.globalPosition;

    let targetsHit = 0;
    let bullseyes = 0;
    for (const offset of pelletOffsets(weapon.pellets, degToRad(weapon.spreadDeg), this.rng)) {
      const direction = this.forward
        .add(this.right.scale(Math.tan(offset.x)))
        .addInPlace(this.up.scale(Math.tan(offset.y)))
        .normalize();
      const ray = new Ray(origin, direction, weapon.range);
      const pick = this.scene.pickWithRay(
        ray,
        (mesh) => mesh.isPickable && mesh.isEnabled() && mesh.metadata != null,
      );
      if (!pick?.hit || !pick.pickedMesh || !pick.pickedPoint) continue;
      this.impacts.spawn(pick.pickedPoint);
      if (isTargetMetadata(pick.pickedMesh.metadata)) {
        const result = this.targets.tryHit(pick.pickedMesh);
        if (result.counted) {
          targetsHit++;
          if (result.bullseye) bullseyes++;
        }
      }
    }
    return { targetsHit, bullseyes };
  }
}
