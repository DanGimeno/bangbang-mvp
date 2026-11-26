import { describe, expect, it, vi } from 'vitest';
import { RangeStats } from './combat/RangeStats';
import { pelletOffsets } from './combat/spread';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  sanitizeSettings,
  saveSettings,
  type KeyValueStorage,
} from './config/settings';
import { EventBus } from './core/EventBus';
import { GameStateMachine } from './core/GameStateMachine';
import { createRng, degToRad } from './core/math';
import { applyLook, clampToBounds, computeMoveDelta, MAX_PITCH } from './player/movement';
import { TargetLogic } from './targets/TargetLogic';

describe('movement', () => {
  it('moves forward along the view direction', () => {
    const d = computeMoveDelta({ forward: 1, right: 0 }, 0, 5, 1);
    expect(d.x).toBeCloseTo(0);
    expect(d.z).toBeCloseTo(5);
    const turned = computeMoveDelta({ forward: 1, right: 0 }, Math.PI / 2, 5, 1);
    expect(turned.x).toBeCloseTo(5);
    expect(turned.z).toBeCloseTo(0);
  });

  it('strafes right and normalizes diagonals', () => {
    const right = computeMoveDelta({ forward: 0, right: 1 }, 0, 2, 1);
    expect(right.x).toBeCloseTo(2);
    const diag = computeMoveDelta({ forward: 1, right: 1 }, 0, 1, 1);
    expect(Math.hypot(diag.x, diag.z)).toBeCloseTo(1);
    expect(computeMoveDelta({ forward: 0, right: 0 }, 1, 5, 1)).toEqual({ x: 0, z: 0 });
  });

  it('applies mouse look with clamped pitch and optional inversion', () => {
    const look = applyLook(0, 0, 100, 10000, 0.01, false);
    expect(look.yaw).toBeCloseTo(1);
    expect(look.pitch).toBe(MAX_PITCH);
    expect(applyLook(0, 0, 0, 10, 0.01, true).pitch).toBeCloseTo(-0.1);
  });

  it('clamps to bounds', () => {
    expect(clampToBounds(50, -50, { minX: -1, maxX: 1, minZ: -2, maxZ: 2 })).toEqual({
      x: 1,
      z: -2,
    });
  });
});

describe('pelletOffsets', () => {
  it('produces the requested count inside the cone', () => {
    const spread = degToRad(5);
    const offsets = pelletOffsets(500, spread, createRng(1));
    expect(offsets).toHaveLength(500);
    for (const o of offsets) expect(Math.hypot(o.x, o.y)).toBeLessThanOrEqual(spread + 1e-12);
  });

  it('is deterministic with a seeded rng and centred for zero spread', () => {
    expect(pelletOffsets(3, 0.1, createRng(7))).toEqual(pelletOffsets(3, 0.1, createRng(7)));
    for (const o of pelletOffsets(3, 0, createRng(7))) expect(Math.hypot(o.x, o.y)).toBe(0);
  });
});

describe('TargetLogic', () => {
  it('falls, stays down, rises and becomes hittable again', () => {
    const t = new TargetLogic({ fallMs: 100, downMs: 1000, riseMs: 200 });
    expect(t.hit()).toBe(true);
    expect(t.hit()).toBe(false);
    t.update(50);
    expect(t.angle).toBeCloseTo(0.5);
    t.update(60);
    expect(t.phase).toBe('down');
    expect(t.angle).toBe(1);
    t.update(1000);
    expect(t.phase).toBe('rising');
    t.update(200);
    expect(t.phase).toBe('standing');
    expect(t.isHittable).toBe(true);
  });
});

describe('RangeStats', () => {
  it('tracks hits and accuracy per trigger pull', () => {
    const s = new RangeStats();
    expect(s.accuracy).toBe(0);
    s.registerShot(0);
    s.registerShot(2, 1);
    expect(s.shotsFired).toBe(2);
    expect(s.targetsHit).toBe(2);
    expect(s.bullseyes).toBe(1);
    expect(s.accuracy).toBe(0.5);
    s.reset();
    expect(s.shotsFired).toBe(0);
  });
});

describe('GameStateMachine', () => {
  it('allows only valid transitions and notifies listeners', () => {
    const sm = new GameStateMachine();
    const listener = vi.fn();
    sm.onChange(listener);
    expect(sm.transition('paused')).toBe(false);
    expect(sm.transition('playing')).toBe(true);
    expect(sm.transition('paused')).toBe(true);
    expect(sm.transition('menu')).toBe(true);
    expect(listener).toHaveBeenCalledTimes(3);
    expect(listener).toHaveBeenLastCalledWith('menu', 'paused');
  });
});

describe('EventBus', () => {
  it('delivers typed events and supports unsubscribe', () => {
    const bus = new EventBus<{ ping: number }>();
    const listener = vi.fn();
    const off = bus.on('ping', listener);
    bus.emit('ping', 1);
    off();
    bus.emit('ping', 2);
    expect(listener).toHaveBeenCalledExactlyOnceWith(1);
  });
});

describe('settings', () => {
  it('sanitizes garbage back to defaults', () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings('nope')).toEqual(DEFAULT_SETTINGS);
    const s = sanitizeSettings({ audio: { sensitivity: 999, debounceMs: 'x', noiseFloorDb: -45 } });
    expect(s.audio.sensitivity).toBe(100);
    expect(s.audio.debounceMs).toBe(DEFAULT_SETTINGS.audio.debounceMs);
    expect(s.audio.noiseFloorDb).toBe(-45);
  });

  it('round-trips through storage and survives broken storage', () => {
    const data = new Map<string, string>();
    const storage: KeyValueStorage = {
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => void data.set(k, v),
    };
    const settings = sanitizeSettings({ audio: { sensitivity: 80 } });
    saveSettings(storage, settings);
    expect(loadSettings(storage).audio.sensitivity).toBe(80);

    const broken: KeyValueStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadSettings(broken)).toEqual(DEFAULT_SETTINGS);
    expect(() => saveSettings(broken, settings)).not.toThrow();
    data.set('bangbang.settings.v1', '{not json');
    expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS);
  });
});
