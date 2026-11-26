import { dbToMeter } from '../audio/analysis';
import type { RangeStats } from '../combat/RangeStats';
import { reloadStepIndex } from '../render/handAnimation';
import type { WeaponState } from '../weapons/WeaponState';
import type { WeaponDef } from '../weapons/weaponDefs';
import { byId, restartAnimation } from './dom';

const MAX_CUES = 6;

/** In-game heads-up display. Plain DOM, updated from the render loop and from events. */
export class Hud {
  private readonly root = byId('hud');
  private readonly hits = byId('hud-hits');
  private readonly shots = byId('hud-shots');
  private readonly accuracy = byId('hud-accuracy');
  private readonly bullseyes = byId('hud-bullseyes');
  private readonly hitmarker = byId('hud-hitmarker');
  private readonly cues = byId('hud-cues');
  private readonly message = byId('hud-message');
  private readonly micDot = byId('hud-mic-dot');
  private readonly micText = byId('hud-mic-text');
  private readonly meterFill = byId('hud-meter-fill');
  private readonly meterThreshold = byId('hud-meter-threshold');
  private readonly slots = byId('hud-weapon-slots');
  private readonly weaponName = byId('hud-weapon-name');
  private readonly weaponTagline = byId('hud-weapon-tagline');
  private readonly weaponHint = byId('hud-weapon-hint');
  private readonly ammo = byId('hud-ammo');
  private readonly mag = byId('hud-mag');
  private readonly reload = byId('hud-reload');
  private readonly reloadStep = byId('hud-reload-step');
  private readonly reloadFill = byId('hud-reload-fill');
  private messageTimer: number | undefined;
  private lastAmmoKey = '';

  set visible(value: boolean) {
    this.root.hidden = !value;
  }

  setWeapons(all: readonly WeaponDef[], current: WeaponDef): void {
    this.slots.replaceChildren(
      ...all.map((def) => {
        const slot = document.createElement('span');
        slot.className = def === current ? 'slot active' : 'slot';
        slot.textContent = `${def.slot} ${def.name}`;
        return slot;
      }),
    );
    this.weaponName.textContent = current.name;
    this.weaponTagline.textContent = current.tagline;
    this.weaponHint.textContent = `Say ${current.vocalHint}`;
    this.lastAmmoKey = '';
  }

  /** Called every frame; only touches the DOM when something changed. */
  updateWeapon(weapon: WeaponState, now: number): void {
    const progress = weapon.reloadProgress(now);
    const step = weapon.isReloading ? reloadStepIndex(weapon.def.reloadSteps.length, progress) : -1;
    const key = `${weapon.ammo}|${weapon.def.magazineSize}|${step}`;
    if (key !== this.lastAmmoKey) {
      this.lastAmmoKey = key;
      this.ammo.textContent = String(weapon.ammo);
      this.ammo.parentElement?.classList.toggle('empty', weapon.ammo === 0);
      this.mag.textContent = `/ ${weapon.def.magazineSize}`;
      this.reload.hidden = !weapon.isReloading;
      if (step >= 0) this.reloadStep.textContent = `${weapon.def.reloadSteps[step] ?? ''}…`;
    }
    if (weapon.isReloading) this.reloadFill.style.width = `${progress * 100}%`;
  }

  updateStats(stats: RangeStats): void {
    this.hits.textContent = String(stats.targetsHit);
    this.shots.textContent = String(stats.shotsFired);
    this.bullseyes.textContent = String(stats.bullseyes);
    this.accuracy.textContent =
      stats.shotsFired === 0 ? '–' : `${Math.round(stats.accuracy * 100)}%`;
  }

  updateMic(on: boolean, levelDb: number, thresholdDb: number, voiceActive: boolean): void {
    this.micDot.className = `mic-dot${on ? (voiceActive ? ' hot' : ' on') : ''}`;
    this.micText.textContent = on ? (voiceActive ? 'FIRING' : 'MIC ON') : 'MIC OFF';
    this.meterFill.style.width = `${(on ? dbToMeter(levelDb) : 0) * 100}%`;
    this.meterThreshold.style.left = `${dbToMeter(thresholdDb) * 100}%`;
  }

  /** Comic onomatopoeia near the crosshair: the visual proof that your voice was heard. */
  popCue(text: string, strength: number, dry = false): void {
    const cue = document.createElement('div');
    cue.className = dry ? 'cue dry' : 'cue';
    cue.textContent = text;
    const angle = Math.random() * Math.PI * 2;
    const radius = 70 + Math.random() * 50;
    cue.style.left = `calc(50% + ${Math.cos(angle) * radius}px)`;
    cue.style.top = `calc(50% + ${Math.sin(angle) * radius * 0.6}px)`;
    cue.style.setProperty('--rot', `${(Math.random() - 0.5) * 30}deg`);
    cue.style.fontSize = dry ? '' : `${44 + strength * 30}px`;
    cue.addEventListener('animationend', () => cue.remove());
    this.cues.append(cue);
    while (this.cues.childElementCount > MAX_CUES) this.cues.firstElementChild?.remove();
  }

  hitMarker(bullseye: boolean): void {
    this.hitmarker.classList.toggle('bullseye', bullseye);
    restartAnimation(this.hitmarker, 'show');
  }

  flashMessage(text: string, ms = 1600): void {
    this.message.textContent = text;
    window.clearTimeout(this.messageTimer);
    this.messageTimer = window.setTimeout(() => (this.message.textContent = ''), ms);
  }

  setPersistentMessage(text: string): void {
    window.clearTimeout(this.messageTimer);
    this.message.textContent = text;
  }
}
