import type { WeaponDef } from './weaponDefs';
import { WeaponState } from './WeaponState';

export type WeaponEvent =
  | { type: 'fired'; weapon: WeaponDef; time: number; ammoLeft: number }
  | { type: 'dry-fire'; weapon: WeaponDef; time: number }
  | { type: 'reload-start'; weapon: WeaponDef; time: number }
  | { type: 'reload-complete'; weapon: WeaponDef; time: number }
  | { type: 'switched'; weapon: WeaponDef; time: number };

/**
 * Owns the player's weapons and translates abstract trigger input
 * (`pullTrigger`, `setTriggerHeld`) into shots. It does not know where the trigger
 * input comes from (voice, debug mouse, or — later — the network).
 */
export class WeaponManager {
  private readonly states: WeaponState[];
  private currentIndex = 0;
  private triggerHeld = false;
  private readonly listeners = new Set<(event: WeaponEvent) => void>();

  constructor(defs: readonly WeaponDef[]) {
    if (defs.length === 0) throw new Error('WeaponManager needs at least one weapon');
    this.states = defs.map((def) => new WeaponState(def));
  }

  get current(): WeaponState {
    return this.states[this.currentIndex] as WeaponState;
  }

  get weapons(): readonly WeaponState[] {
    return this.states;
  }

  get isTriggerHeld(): boolean {
    return this.triggerHeld;
  }

  onEvent(listener: (event: WeaponEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Equips the weapon bound to a number key. Returns false if none/already equipped. */
  switchToSlot(slot: number, now: number): boolean {
    const index = this.states.findIndex((s) => s.def.slot === slot);
    if (index < 0 || index === this.currentIndex) return false;
    this.current.cancelReload();
    this.currentIndex = index;
    this.triggerHeld = false;
    this.emit({ type: 'switched', weapon: this.current.def, time: now });
    return true;
  }

  /** One discrete trigger pull (a vocal impulse or a debug click). */
  pullTrigger(now: number): boolean {
    const weapon = this.current;
    const result = weapon.tryFire(now);
    if (result.fired) {
      this.emit({ type: 'fired', weapon: weapon.def, time: now, ammoLeft: result.ammoLeft });
      return true;
    }
    if (result.reason === 'empty') this.emit({ type: 'dry-fire', weapon: weapon.def, time: now });
    return false;
  }

  /** Sustained trigger (held voice). Only affects automatic weapons. */
  setTriggerHeld(held: boolean): void {
    this.triggerHeld = held;
  }

  reload(now: number): boolean {
    const started = this.current.startReload(now);
    if (started) this.emit({ type: 'reload-start', weapon: this.current.def, time: now });
    return started;
  }

  update(now: number): void {
    const weapon = this.current;
    if (weapon.update(now)) {
      this.emit({ type: 'reload-complete', weapon: weapon.def, time: now });
    }
    if (this.triggerHeld && weapon.def.fireMode === 'auto' && weapon.canFire(now)) {
      const result = weapon.tryFire(now);
      if (result.fired) {
        this.emit({ type: 'fired', weapon: weapon.def, time: now, ammoLeft: result.ammoLeft });
      }
    }
  }

  private emit(event: WeaponEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}
