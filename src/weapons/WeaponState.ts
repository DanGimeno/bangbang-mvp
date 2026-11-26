import type { WeaponDef } from './weaponDefs';

export type FireResult = { fired: true } | { fired: false; reason: 'cooldown' };

/**
 * Pure per-weapon state: the fire-rate cooldown. There is no ammunition; the player's
 * breath is the only magazine.
 * Time is always injected (`now`, in ms) so the logic is deterministic and testable,
 * and could run on a server later.
 */
export class WeaponState {
  private lastShotAt = -Infinity;

  constructor(readonly def: WeaponDef) {}

  canFire(now: number): boolean {
    return now - this.lastShotAt >= this.def.cooldownMs;
  }

  tryFire(now: number): FireResult {
    if (!this.canFire(now)) return { fired: false, reason: 'cooldown' };
    this.lastShotAt = now;
    return { fired: true };
  }
}
