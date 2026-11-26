/**
 * Data-driven weapon definitions. Adding a weapon should only require a new entry here
 * (plus, if it needs a new hand pose, a pose in `render/HandView.ts`).
 *
 * Creative direction: there are no guns. Every weapon is imaginary — finger guns,
 * empty hands "holding" an automatic rifle — and the game treats them with complete
 * military seriousness. Recoil and fire rate still exist; there is no ammunition or reloading,
 * because the real limit is the player's own breath. See docs/GAME_DESIGN.md.
 */
export type FireMode =
  /** One shot per vocal impulse ("Bang!"). */
  | 'semi'
  /** Fires continuously while the voice is held ("Trrrrrr!"), and on each impulse. */
  | 'auto';

/** Which hand pose represents the (imaginary) weapon. */
export type HandPose =
  /** Classic finger gun: index extended, thumb up as the hammer. */
  | 'finger-gun'
  /** Index and middle finger extended together: the "heavy" finger gun. */
  | 'double-barrel'
  /** Two open hands carrying absolutely nothing, with great conviction. */
  | 'empty-hands';

export interface WeaponDef {
  id: string;
  name: string;
  /** Deadpan, overly serious description for the HUD. */
  tagline: string;
  /** Number key used to equip it (1-9). */
  slot: number;
  /** Comic word shown when a vocal shot is detected. */
  vocalCue: string;
  /** Suggestion shown to the player. */
  vocalHint: string;
  fireMode: FireMode;
  /** Minimum time between two shots. */
  cooldownMs: number;
  /** Rays per shot (shotgun > 1). */
  pellets: number;
  /** Cone half-angle in degrees. */
  spreadDeg: number;
  /** Hitscan range in metres. */
  range: number;
  /** View-model recoil kick (0..1, scales the wrist flick). */
  recoilKick: number;
  viewModel: HandPose;
}

export const FINGER_PISTOL: WeaponDef = {
  id: 'finger-pistol',
  name: 'Finger Pistol',
  tagline: 'Standard issue. Index finger, 1 each.',
  slot: 1,
  vocalCue: 'BANG!',
  vocalHint: '"Bang!" / "Pum!"',
  fireMode: 'semi',
  cooldownMs: 180,
  pellets: 1,
  spreadDeg: 0.3,
  range: 120,
  recoilKick: 0.6,
  viewModel: 'finger-gun',
};

export const FINGER_SHOTGUN: WeaponDef = {
  id: 'finger-shotgun',
  name: 'Two-Finger Shotgun',
  tagline: 'Twice the fingers. Twice the responsibility.',
  slot: 2,
  vocalCue: 'BOOM!',
  vocalHint: '"BOOM!"',
  fireMode: 'semi',
  cooldownMs: 650,
  pellets: 9,
  spreadDeg: 5,
  range: 45,
  recoilKick: 1,
  viewModel: 'double-barrel',
};

export const NOTHING_RIFLE: WeaponDef = {
  id: 'nothing-rifle',
  name: 'Automatic Nothing',
  tagline: 'Fully automatic. Fully imaginary. Handle with care.',
  slot: 3,
  vocalCue: 'RATATA!',
  vocalHint: '"Ratatatata!" / "Trrrrrr!"',
  fireMode: 'auto',
  cooldownMs: 95,
  pellets: 1,
  spreadDeg: 2,
  range: 90,
  recoilKick: 0.3,
  viewModel: 'empty-hands',
};

export const WEAPONS: readonly WeaponDef[] = [FINGER_PISTOL, FINGER_SHOTGUN, NOTHING_RIFLE];
