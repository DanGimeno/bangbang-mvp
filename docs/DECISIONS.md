# Decision log

Lightweight ADRs. Append new entries; don't rewrite history. Supersede old entries
explicitly instead.

---

## D-001: Vite + TypeScript, not Next.js

**Context:** the repository started with a Next.js `.gitignore`.
**Decision:** use Vite with strict TypeScript. Replace the `.gitignore`.
**Alternatives:** Next.js (server rendering and routing are irrelevant to a canvas game);
plain esbuild (less dev ergonomics).
**Rationale:** fastest dev loop, first-class TS, simple static output that is easy to host
and later wrap in a desktop shell.

## D-002: TypeScript 6.0, not 7.0

**Context:** TypeScript 7.0 (native compiler) is the current stable release, but
typescript-eslint 8.x supports `typescript < 6.1`.
**Decision:** pin `typescript ~6.0.3`.
**Revisit when:** typescript-eslint supports TS 7.

## D-003: Babylon.js for rendering

**Decision:** Babylon.js 9 (`@babylonjs/core`).
**Alternatives:** Three.js (lighter, but more DIY for cameras, picking and scene management);
PlayCanvas (editor-centric).
**Rationale:** batteries included (ray picking, cameras, rendering groups), strong TS
types, a possible path to a native/headless server.

## D-004: No React; plain DOM UI

**Decision:** menus and HUD are static HTML in `index.html`, driven by small TS classes.
**Rationale:** a few panels and counters do not justify a framework. The render loop and
game state stay framework-free, as required. **Revisit** if menus grow (lobbies, server
browsers).

## D-005: Energy-onset detection instead of speech recognition

**Decision:** detect vocal _impulses_ from frame energy (rise above a calibrated floor),
locally, in an AudioWorklet + pure TS detector.
**Alternatives:** Web Speech API / cloud STT (latency of hundreds of ms, language-dependent,
privacy, poor on non-words); on-device ML classifier (more accurate, larger, needs data).
**Rationale:** lowest latency, language-independent, private, simple to reason about.
**Consequence:** cannot distinguish gunshot sounds from loud speech. Documented in
AUDIO_SYSTEM §7; improvement path in §10.

## D-006: Detection on the main thread, aggregation in the worklet

**Decision:** the worklet only reduces samples to `{time, rms, peak}` per ~5 ms; the detector
runs on the main thread.
**Rationale:** the detector stays a pure, unit-testable module with no worklet bundling
constraints. The extra message hop costs only milliseconds. Raw audio never leaves the
audio thread.

## D-007: Import Babylon from the barrel module

**Decision:** `import { … } from '@babylonjs/core'` for now.
**Trade-off:** ~7 MB bundle (~1.6 MB gzip). Deep imports could shrink this a lot but bring
side-effect-import pitfalls. Deferred to M5.

## D-008: Abstract trigger input (`pullTrigger` / `setTriggerHeld`)

**Decision:** weapons consume abstract trigger commands. `vocalTrigger.ts` maps
`VocalEvent`s onto them; the debug mouse uses the same API.
**Rationale:** detection is swappable without touching weapons, and the same commands can
later be sent over the network to an authoritative server.

## D-009: Data-driven weapons

**Decision:** weapons are plain `WeaponDef` objects (fire mode, cooldown, magazine, reload,
pellets, spread, range, recoil, hand pose, reload captions), consumed by generic
`WeaponState` / `WeaponManager` / `ShootingSystem` / `HandView`.
**Rationale:** adding a weapon is a data change.

## D-010: Disable AGC, echo cancellation and (by default) noise suppression

**Decision:** request raw-ish audio. Noise suppression is a user option.
**Rationale:** AGC breaks calibration; AEC and NS attenuate short loud onsets. The game
emits no gunshot audio, so echo is less of a concern. **Consequence:** speakers playing
teammates' voices can trigger shots; headphones are recommended.

## D-011: Creative pivot: there are no guns

**Context:** mid-M1, the team recalled the original concept: players shoot with finger
guns, like the April Fools' event that inspired the game. Weapons are imaginary but
mechanically real (ammo, recoil, reloads, damage), and the game takes them extremely
seriously.
**Decision:** weapons are represented by **low-poly hands** (`HandPose`: `finger-gun`,
`double-barrel`, `empty-hands`). Weapon names, taglines and reload captions are
deadpan-military. Muzzle flashes come from fingertips, or from thin air for the
Automatic Nothing.
**What did not change:** the weapon systems, data model, detection and architecture.
`WeaponDef` gained `viewModel`, `tagline` and `reloadSteps`; no gun model had been built
yet, so nothing had to be removed. (Our first deprecated feature was deprecated before it
existed.)

## D-012: Settings persisted in localStorage, defensively

**Decision:** store only settings (never audio) under `bangbang.settings.v1`, sanitize on
load, and tolerate unavailable storage.
**Rationale:** privacy, robustness in private windows, forward compatibility via a
versioned key.

## D-013: Debug mouse trigger gated to dev builds / `?debug`

**Decision:** the mouse trigger exists only when `import.meta.env.DEV` or `?debug` is
present, and is off by default even then.
**Rationale:** the requirement is that the microphone is the primary trigger. A visible
mouse option in production would undermine the core mechanic.

## D-014: No ammunition, no reloading: breath is the magazine

**Context:** after playing the first build, the team noted that the real limit on firing
is already the player's own breath. Shouting "Bang!" or holding "Trrrrr" for long is
tiring; catching your breath _is_ the reload.
**Decision:** remove magazines, the ammo counter, reloading (the `R` key, the reload
gestures and captions) and dry fire. Weapons keep their cooldown (fire rate), spread,
pellets, recoil and hand pose.
**Supersedes:** the magazine/reload fields listed in D-009 and the reload gestures and
captions in D-011. The removed code (`render/handAnimation.ts`) remains in git history.
**Revisit if:** playtests show long held bursts on automatic weapons dominate; an overheat
or similar cap is the first candidate (GAME_DESIGN open question 5).
