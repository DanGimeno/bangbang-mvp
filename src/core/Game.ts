import { Engine, FreeCamera, Scene, Vector3 } from '@babylonjs/core';
import { MicrophoneError } from '../audio/microphoneErrors';
import type { VocalEvent } from '../audio/types';
import { detectorConfigFromSettings, VocalInput } from '../audio/VocalInput';
import { ImpactEffects } from '../combat/ImpactEffects';
import { RangeStats } from '../combat/RangeStats';
import { ShootingSystem } from '../combat/ShootingSystem';
import {
  browserStorage,
  loadSettings,
  sanitizeSettings,
  saveSettings,
  type Settings,
} from '../config/settings';
import { InputManager } from '../input/InputManager';
import { PlayerController } from '../player/PlayerController';
import { HandView } from '../render/HandView';
import { buildRange } from '../render/RangeEnvironment';
import { TargetManager } from '../targets/TargetManager';
import { Hud } from '../ui/Hud';
import { Menu } from '../ui/Menu';
import { applyVocalEvent } from '../weapons/vocalTrigger';
import { WeaponManager, type WeaponEvent } from '../weapons/WeaponManager';
import { WEAPONS } from '../weapons/weaponDefs';
import { GameStateMachine } from './GameStateMachine';

const NO_MIC_MESSAGE = 'Microphone is off — press Esc to set it up. There is no trigger.';

/**
 * Composition root and lifecycle owner. Creates every system, wires their events
 * together and runs the render loop. Systems do not reference each other directly.
 */
export class Game {
  private readonly engine: Engine;
  private readonly scene: Scene;
  private readonly state = new GameStateMachine();
  private readonly input: InputManager;
  private readonly player: PlayerController;
  private readonly targets: TargetManager;
  private readonly impacts: ImpactEffects;
  private readonly shooting: ShootingSystem;
  private readonly stats = new RangeStats();
  private readonly weapons = new WeaponManager(WEAPONS);
  private readonly hands: HandView;
  private readonly vocal: VocalInput;
  private readonly hud = new Hud();
  private readonly menu: Menu;
  private settings: Settings;
  private lastImpulseStrength = 0.5;

  constructor(
    canvas: HTMLCanvasElement,
    private readonly debugAllowed: boolean,
  ) {
    this.settings = loadSettings(browserStorage());
    if (!debugAllowed) this.settings.debug.mouseFire = false;

    this.engine = new Engine(canvas, true, { stencil: false, preserveDrawingBuffer: false }, true);
    this.scene = new Scene(this.engine);
    this.scene.skipPointerMovePicking = true;

    const camera = new FreeCamera('player', new Vector3(0, 1.7, -16), this.scene);
    camera.inputs.clear(); // movement and look are driven by PlayerController
    camera.minZ = 0.01;
    camera.fov = 1.15;

    const range = buildRange(this.scene);
    this.player = new PlayerController(camera, range.bounds, range.spawn);
    this.targets = new TargetManager(this.scene);
    this.impacts = new ImpactEffects(this.scene);
    this.shooting = new ShootingSystem(this.scene, camera, this.targets, this.impacts);
    this.hands = new HandView(this.scene, camera, this.weapons.current.def);
    this.input = new InputManager(canvas);
    this.vocal = new VocalInput(detectorConfigFromSettings(this.settings.audio));
    this.menu = new Menu(
      {
        onStart: () => void this.start(),
        onQuit: () => this.quitToMenu(),
        onEnableMic: () => void this.enableMicrophone(),
        onDeviceChange: (id) => this.changeDevice(id),
        onCalibrate: () => this.vocal.calibrate(),
        onSettingsChange: (update) => this.updateSettings(update),
      },
      debugAllowed,
    );

    this.wireEvents();
    this.menu.showSettings(this.settings);
    this.menu.setMode('title');
    this.menu.setMicState('off', 'Microphone is off. You will need it: there is no trigger.');
    this.menu.showCalibration(null, false);
    this.hud.setWeapons(WEAPONS, this.weapons.current.def);
    this.hud.updateStats(this.stats);

    window.addEventListener('resize', () => this.engine.resize());
    this.engine.runRenderLoop(() => this.frame());
  }

  // ---------------------------------------------------------------- wiring

  private wireEvents(): void {
    this.vocal.bus.on('vocal', (event) => this.onVocalEvent(event));
    this.vocal.bus.on('calibrated', (result) => {
      this.updateSettings((s) => (s.audio.noiseFloorDb = result.noiseFloorDb));
      this.menu.showCalibration(result, true);
    });
    this.vocal.bus.on('status', (status) => {
      if (status === 'error' && this.vocal.status === 'error') {
        this.menu.setMicState('error', 'The microphone stopped (disconnected?). Enable it again.');
      }
    });

    this.weapons.onEvent((event) => this.onWeaponEvent(event));

    this.input.onPointerLockChange = (locked) => {
      if (locked) this.state.transition('playing');
      else if (this.state.state === 'playing') this.state.transition('paused');
    };
    this.input.onKeyPress = (code) => {
      if (this.state.state !== 'playing') return;
      const now = performance.now();
      if (code === 'KeyR') this.weapons.reload(now);
      const digit = /^Digit([1-9])$/.exec(code);
      if (digit) this.weapons.switchToSlot(Number(digit[1]), now);
    };
    this.input.onMouseButton = (button, down) => {
      // Development-only fallback trigger. Disabled by default.
      if (!this.debugAllowed || !this.settings.debug.mouseFire || button !== 0) return;
      if (down) this.weapons.pullTrigger(performance.now());
      this.weapons.setTriggerHeld(down);
    };

    this.state.onChange((to) => {
      const playing = to === 'playing';
      this.hud.visible = playing;
      this.menu.visible = !playing;
      this.menu.setMode(to === 'paused' ? 'paused' : 'title');
      if (!playing) this.weapons.setTriggerHeld(false);
      if (playing && this.vocal.status !== 'active') this.hud.setPersistentMessage(NO_MIC_MESSAGE);
    });

    navigator.mediaDevices?.addEventListener?.('devicechange', () => void this.refreshDevices());
  }

  private onVocalEvent(event: VocalEvent): void {
    if (event.type === 'impulse') {
      this.lastImpulseStrength = event.strength;
      if (this.state.state !== 'playing')
        this.menu.flashDetection(this.weapons.current.def.vocalCue);
    }
    if (this.state.state === 'playing') applyVocalEvent(this.weapons, event, performance.now());
  }

  private onWeaponEvent(event: WeaponEvent): void {
    switch (event.type) {
      case 'fired': {
        const result = this.shooting.fire(event.weapon);
        this.stats.registerShot(result.targetsHit, result.bullseyes);
        this.hud.updateStats(this.stats);
        this.hud.popCue(event.weapon.vocalCue, this.lastImpulseStrength);
        if (result.targetsHit > 0) this.hud.hitMarker(result.bullseyes > 0);
        this.hands.onFire(event.weapon);
        if (event.ammoLeft === 0) this.hud.flashMessage('Out of imaginary ammo! Press R');
        break;
      }
      case 'dry-fire':
        this.hud.popCue('*click*', 0, true);
        this.hud.flashMessage('Out of imaginary ammo! Press R');
        break;
      case 'switched':
        this.hands.equip(event.weapon);
        this.hud.setWeapons(WEAPONS, event.weapon);
        this.hud.flashMessage(event.weapon.tagline, 2000);
        break;
      case 'reload-start':
      case 'reload-complete':
        break;
    }
  }

  // ---------------------------------------------------------------- actions

  private async start(): Promise<void> {
    this.menu.showError(null);
    // Pointer lock must be requested synchronously inside the click handler.
    const lockRequest = this.input.requestPointerLock();
    void this.vocal.resume();
    if (this.vocal.status !== 'active') this.hud.setPersistentMessage(NO_MIC_MESSAGE);
    else this.hud.setPersistentMessage('');
    const locked = await lockRequest;
    if (!locked) {
      this.menu.showError(
        'The browser refused to capture the mouse. Wait a second and click again.',
      );
    }
  }

  private quitToMenu(): void {
    this.input.exitPointerLock();
    this.state.transition('menu');
    this.stats.reset();
    this.hud.updateStats(this.stats);
  }

  private async enableMicrophone(): Promise<void> {
    this.menu.setMicState('requesting', 'Requesting microphone access…');
    this.menu.showError(null);
    try {
      await this.vocal.enable(
        this.settings.audio.deviceId,
        this.settings.audio.browserNoiseSuppression,
      );
      this.menu.setMicState('on', 'Microphone on. Say “Bang!” and watch the meter.');
      this.hud.setPersistentMessage('');
      await this.refreshDevices();
      if (this.settings.audio.noiseFloorDb === null) this.vocal.calibrate();
      else
        this.menu.showCalibration(
          { noiseFloorDb: this.settings.audio.noiseFloorDb, quality: 'good', frames: 0 },
          true,
        );
    } catch (error) {
      const message =
        error instanceof MicrophoneError ? error.message : 'The microphone could not be started.';
      this.menu.setMicState('error', message);
    }
  }

  private changeDevice(deviceId: string | null): void {
    this.updateSettings((s) => (s.audio.deviceId = deviceId));
    if (this.vocal.status === 'active') void this.enableMicrophone();
  }

  private async refreshDevices(): Promise<void> {
    try {
      const devices = await this.vocal.listDevices();
      this.menu.setDevices(devices, this.vocal.activeDeviceId ?? this.settings.audio.deviceId);
    } catch {
      // Device enumeration is optional; the default device still works.
    }
  }

  private updateSettings(update: (settings: Settings) => void): void {
    const previous = this.settings;
    const draft = sanitizeSettings(JSON.parse(JSON.stringify(previous)));
    update(draft);
    this.settings = sanitizeSettings(draft);
    if (!this.debugAllowed) this.settings.debug.mouseFire = false;
    saveSettings(browserStorage(), this.settings);
    this.vocal.configure(detectorConfigFromSettings(this.settings.audio));
    this.menu.showSettings(this.settings);
    const suppressionChanged =
      previous.audio.browserNoiseSuppression !== this.settings.audio.browserNoiseSuppression;
    if (suppressionChanged && this.vocal.status === 'active') void this.enableMicrophone();
  }

  // ---------------------------------------------------------------- loop

  private frame(): void {
    const dtMs = Math.min(this.engine.getDeltaTime(), 100);
    const now = performance.now();
    const playing = this.state.state === 'playing';
    const micOn = this.vocal.status === 'active';
    const detector = this.vocal.detector;

    if (playing) {
      this.player.update(dtMs / 1000, this.input, this.settings.controls);
      this.weapons.update(now);
      this.hud.updateWeapon(this.weapons.current, now);
      this.hud.updateMic(micOn, this.vocal.levelDb, detector.thresholdDb, detector.isActive);
    } else {
      this.menu.renderLevels(
        micOn,
        this.vocal.levelDb,
        detector.noiseFloorDb,
        detector.thresholdDb,
      );
      if (this.vocal.isCalibrating) this.menu.setCalibrating(this.vocal.calibrationProgress);
    }
    this.targets.update(dtMs);
    this.impacts.update(dtMs);
    this.hands.update(dtMs, this.weapons.current, now, playing && this.player.isMoving);
    this.scene.render();
  }
}
