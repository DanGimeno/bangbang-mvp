import { dbToMeter } from '../audio/analysis';
import type { RangeStats } from '../combat/RangeStats';
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
  private messageTimer: number | undefined;

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
  popCue(text: string, strength: number): void {
    const cue = document.createElement('div');
    cue.className = 'cue';
    cue.textContent = text;
    const angle = Math.random() * Math.PI * 2;
    const radius = 70 + Math.random() * 50;
    cue.style.left = `calc(50% + ${Math.cos(angle) * radius}px)`;
    cue.style.top = `calc(50% + ${Math.sin(angle) * radius * 0.6}px)`;
    cue.style.setProperty('--rot', `${(Math.random() - 0.5) * 30}deg`);
    cue.style.fontSize = `${44 + strength * 30}px`;
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
