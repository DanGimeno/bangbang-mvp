import type { VocalEvent } from '../audio/types';

/** The subset of WeaponManager that trigger sources need. */
export interface TriggerTarget {
  pullTrigger(now: number): boolean;
  setTriggerHeld(held: boolean): void;
}

/**
 * Maps gameplay-independent vocal events onto abstract trigger input.
 * This is the only place where "voice" meets "weapon".
 *
 * - impulse     → one trigger pull (semi weapons fire once, auto weapons fire immediately)
 * - voice-start → trigger held (automatic weapons keep firing)
 * - voice-end   → trigger released
 *
 * Returns true when an impulse caused a shot.
 */
export function applyVocalEvent(target: TriggerTarget, event: VocalEvent, now: number): boolean {
  switch (event.type) {
    case 'voice-start':
      target.setTriggerHeld(true);
      return false;
    case 'voice-end':
      target.setTriggerHeld(false);
      return false;
    case 'impulse':
      return target.pullTrigger(now);
  }
}
