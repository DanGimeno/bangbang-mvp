/** Shooting-range score keeping. Pure. */
export class RangeStats {
  shotsFired = 0;
  /** Shots (trigger pulls) where at least one pellet hit a standing target. */
  shotsOnTarget = 0;
  targetsHit = 0;
  bullseyes = 0;

  registerShot(hitTargets: number, bullseyes = 0): void {
    this.shotsFired++;
    if (hitTargets > 0) this.shotsOnTarget++;
    this.targetsHit += hitTargets;
    this.bullseyes += bullseyes;
  }

  /** 0..1 */
  get accuracy(): number {
    return this.shotsFired === 0 ? 0 : this.shotsOnTarget / this.shotsFired;
  }

  reset(): void {
    this.shotsFired = 0;
    this.shotsOnTarget = 0;
    this.targetsHit = 0;
    this.bullseyes = 0;
  }
}
