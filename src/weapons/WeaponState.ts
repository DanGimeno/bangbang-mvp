import type { WeaponDef } from './weaponDefs';

export type FireResult =
  { fired: true; ammoLeft: number } | { fired: false; reason: 'cooldown' | 'empty' | 'reloading' };

/**
 * Pure per-weapon state: ammunition, cooldown and reloading.
 * Time is always injected (`now`, in ms) so the logic is deterministic and testable,
 * and could run on a server later.
 */
export class WeaponState {
  ammo: number;
  private lastShotAt = -Infinity;
  private reloadStartedAt: number | null = null;

  constructor(readonly def: WeaponDef) {
    this.ammo = def.magazineSize;
  }

  get isReloading(): boolean {
    return this.reloadStartedAt !== null;
  }

  reloadProgress(now: number): number {
    if (this.reloadStartedAt === null) return 0;
    return Math.min(1, (now - this.reloadStartedAt) / this.def.reloadMs);
  }

  canFire(now: number): boolean {
    return !this.isReloading && this.ammo > 0 && now - this.lastShotAt >= this.def.cooldownMs;
  }

  tryFire(now: number): FireResult {
    if (this.isReloading) return { fired: false, reason: 'reloading' };
    if (now - this.lastShotAt < this.def.cooldownMs) return { fired: false, reason: 'cooldown' };
    if (this.ammo <= 0) return { fired: false, reason: 'empty' };
    this.ammo--;
    this.lastShotAt = now;
    return { fired: true, ammoLeft: this.ammo };
  }

  /** Returns false when already full or already reloading. */
  startReload(now: number): boolean {
    if (this.isReloading || this.ammo >= this.def.magazineSize) return false;
    this.reloadStartedAt = now;
    return true;
  }

  cancelReload(): void {
    this.reloadStartedAt = null;
  }

  /** Advances timers. Returns true on the tick the reload completes. */
  update(now: number): boolean {
    if (this.reloadStartedAt !== null && now - this.reloadStartedAt >= this.def.reloadMs) {
      this.reloadStartedAt = null;
      this.ammo = this.def.magazineSize;
      return true;
    }
    return false;
  }
}
