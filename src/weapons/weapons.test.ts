import { describe, expect, it, vi } from 'vitest';
import type { VocalEvent } from '../audio/types';
import { applyVocalEvent } from './vocalTrigger';
import { WeaponManager, type WeaponEvent } from './WeaponManager';
import { WeaponState } from './WeaponState';
import {
  FINGER_PISTOL,
  FINGER_SHOTGUN,
  NOTHING_RIFLE,
  WEAPONS,
  type WeaponDef,
} from './weaponDefs';

describe('weapon definitions', () => {
  it('have unique ids and slots, and a hand pose', () => {
    expect(new Set(WEAPONS.map((w) => w.id)).size).toBe(WEAPONS.length);
    expect(new Set(WEAPONS.map((w) => w.slot)).size).toBe(WEAPONS.length);
    for (const w of WEAPONS) {
      expect(w.magazineSize).toBeGreaterThan(0);
      expect(w.pellets).toBeGreaterThan(0);
      expect(w.reloadSteps.length).toBeGreaterThan(0);
      expect(['finger-gun', 'double-barrel', 'empty-hands']).toContain(w.viewModel);
    }
  });
});

describe('WeaponState', () => {
  it('fires, consumes ammo and respects the cooldown', () => {
    const w = new WeaponState(FINGER_PISTOL);
    expect(w.tryFire(0)).toEqual({ fired: true, ammoLeft: FINGER_PISTOL.magazineSize - 1 });
    expect(w.tryFire(FINGER_PISTOL.cooldownMs - 1)).toEqual({ fired: false, reason: 'cooldown' });
    expect(w.tryFire(FINGER_PISTOL.cooldownMs).fired).toBe(true);
  });

  it('runs dry and reloads over time', () => {
    const def: WeaponDef = { ...FINGER_PISTOL, magazineSize: 2, cooldownMs: 0, reloadMs: 1000 };
    const w = new WeaponState(def);
    w.tryFire(0);
    w.tryFire(1);
    expect(w.tryFire(2)).toEqual({ fired: false, reason: 'empty' });
    expect(w.startReload(10)).toBe(true);
    expect(w.startReload(20)).toBe(false);
    expect(w.tryFire(30)).toEqual({ fired: false, reason: 'reloading' });
    expect(w.reloadProgress(510)).toBeCloseTo(0.5);
    expect(w.update(500)).toBe(false);
    expect(w.update(1010)).toBe(true);
    expect(w.ammo).toBe(2);
    expect(w.isReloading).toBe(false);
  });

  it('does not reload a full magazine', () => {
    expect(new WeaponState(FINGER_PISTOL).startReload(0)).toBe(false);
  });
});

describe('WeaponManager', () => {
  const collect = (manager: WeaponManager) => {
    const events: WeaponEvent[] = [];
    manager.onEvent((e) => events.push(e));
    return events;
  };

  it('fires semi-automatic weapons once per trigger pull, ignoring hold', () => {
    const manager = new WeaponManager([FINGER_PISTOL]);
    const events = collect(manager);
    manager.setTriggerHeld(true);
    manager.pullTrigger(0);
    for (let t = 0; t < 2000; t += 16) manager.update(t);
    expect(events.filter((e) => e.type === 'fired')).toHaveLength(1);
  });

  it('keeps firing automatic weapons while the trigger is held', () => {
    const manager = new WeaponManager([NOTHING_RIFLE]);
    const events = collect(manager);
    manager.setTriggerHeld(true);
    for (let t = 0; t <= 1000; t += 5) manager.update(t);
    manager.setTriggerHeld(false);
    for (let t = 1005; t <= 2000; t += 5) manager.update(t);
    const shots = events.filter((e) => e.type === 'fired').length;
    expect(shots).toBe(Math.floor(1000 / NOTHING_RIFLE.cooldownMs) + 1);
  });

  it('emits dry-fire when empty', () => {
    const manager = new WeaponManager([{ ...FINGER_PISTOL, magazineSize: 1 }]);
    const events = collect(manager);
    manager.pullTrigger(0);
    manager.pullTrigger(1000);
    expect(events.map((e) => e.type)).toEqual(['fired', 'dry-fire']);
  });

  it('switches weapons by slot and cancels reloads', () => {
    const manager = new WeaponManager(WEAPONS);
    const events = collect(manager);
    manager.pullTrigger(0);
    manager.reload(10);
    expect(manager.current.isReloading).toBe(true);
    expect(manager.switchToSlot(FINGER_SHOTGUN.slot, 20)).toBe(true);
    expect(manager.current.def).toBe(FINGER_SHOTGUN);
    expect(manager.switchToSlot(FINGER_SHOTGUN.slot, 30)).toBe(false);
    expect(manager.switchToSlot(9, 30)).toBe(false);
    manager.switchToSlot(FINGER_PISTOL.slot, 40);
    expect(manager.current.isReloading).toBe(false);
    expect(events.map((e) => e.type)).toEqual(['fired', 'reload-start', 'switched', 'switched']);
  });

  it('completes reloads through update', () => {
    const manager = new WeaponManager([FINGER_PISTOL]);
    const events = collect(manager);
    manager.pullTrigger(0);
    manager.reload(0);
    manager.update(FINGER_PISTOL.reloadMs);
    expect(events.at(-1)?.type).toBe('reload-complete');
    expect(manager.current.ammo).toBe(FINGER_PISTOL.magazineSize);
  });

  it('rejects an empty arsenal', () => {
    expect(() => new WeaponManager([])).toThrow();
  });
});

describe('applyVocalEvent', () => {
  it('maps vocal events to trigger input', () => {
    const target = { pullTrigger: vi.fn(() => true), setTriggerHeld: vi.fn() };
    const events: VocalEvent[] = [
      { type: 'voice-start', time: 0 },
      { type: 'impulse', time: 0, levelDb: -20, strength: 0.5, retrigger: false },
      { type: 'voice-end', time: 100, durationMs: 100, peakDb: -20, forced: false },
    ];
    const results = events.map((e) => applyVocalEvent(target, e, 42));
    expect(results).toEqual([false, true, false]);
    expect(target.pullTrigger).toHaveBeenCalledWith(42);
    expect(target.setTriggerHeld.mock.calls).toEqual([[true], [false]]);
  });

  it('drives a real WeaponManager end to end', () => {
    const manager = new WeaponManager([FINGER_PISTOL]);
    const fired: WeaponEvent[] = [];
    manager.onEvent((e) => e.type === 'fired' && fired.push(e));
    applyVocalEvent(manager, { type: 'voice-start', time: 0 }, 0);
    applyVocalEvent(
      manager,
      { type: 'impulse', time: 0, levelDb: -20, strength: 1, retrigger: false },
      0,
    );
    expect(fired).toHaveLength(1);
  });
});
