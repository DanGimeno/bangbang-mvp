# Roadmap

No dates. Milestones are done when their acceptance criteria are met.
Legend: `[x]` done · `[ ]` to do · `[~]` partially done / needs validation.

## M0: Project initialization ✅

**Acceptance:** a fresh clone installs, runs, tests and builds with one command each, and the
documentation describes the vision and architecture.

- [x] Vite + TypeScript (strict) + Babylon.js project
- [x] ESLint, Prettier, Vitest configured; `npm run check` runs everything
- [x] `.gitignore` replaced (Next.js template removed)
- [x] README, CLAUDE.md, GAME_DESIGN, ARCHITECTURE, AUDIO_SYSTEM, ROADMAP, DECISIONS
- [x] Creative direction updated: no guns, imaginary weapons, hand view models

## M1: Single-player shooting range (current)

**Acceptance:** a player can enable their microphone, calibrate, and knock down targets by
saying “Bang!”, with ammo, reloads and clear feedback, in desktop Chrome and Firefox. Real-voice
detection works well enough that firing feels intentional (target: ≥ 90% hit rate on
deliberate “Bang!”s, and few false shots in silence and typing).

- [x] Low-poly range: floor, walls, counter, lights, crates
- [x] Knock-down targets with flash, fall/reset, bullseye detection
- [x] WASD + Pointer Lock mouse look, Esc pauses, bounds clamping
- [x] Microphone permission, device selection, error handling
- [x] Level meter with noise-floor and threshold markers
- [x] Ambient noise calibration (auto on first enable, manual recalibration)
- [x] Sensitivity, debounce and release settings, persisted locally
- [x] Energy-onset vocal impulse detector with sustain / retrigger / stuck-trigger guard
- [x] Finger Pistol: hitscan, magazine, ammo counter, reload, cooldown, recoil, muzzle flash
- [x] Hit marker, “BANG!” onomatopoeia, hit / shot / accuracy / bullseye counters
- [x] Low-poly finger-gun hand view model, elaborate reload gesture + captions
- [x] Dev-only mouse trigger (off by default)
- [x] Unit tests for all pure logic; headless smoke test with a fake microphone
- [~] **Manual test plan with real voices** (AUDIO_SYSTEM §11) on ≥ 3 microphones
- [ ] Tune detector defaults from those results
- [ ] Test in Firefox and Edge
- [ ] Measure voice-to-shot latency

## M2: Vocal detection refinement and additional weapons

**Acceptance:** conversation produces far fewer false shots than in M1 (measured with the
same protocol); at least three imaginary weapons feel distinct; the voice-to-shot latency is
measured and acceptable (< ~80 ms perceived).

- [ ] Offline replay harness for recorded level envelopes (local, opt-in, never uploaded)
- [ ] Spectral features in the worklet (centroid, flatness, ZCR)
- [ ] Speech-likeness scoring / talking lockout
- [~] Two-Finger Shotgun (pellets): implemented, needs feel tuning
- [~] Automatic Nothing (held voice = auto fire): implemented, needs real-voice validation
- [ ] Dual finger pistols (two hands, alternate fire)
- [ ] Imaginary grenade (“fiuuu… BOOM”), throw gesture
- [ ] Evaluate per-weapon sound requirement (pew vs boom), see GAME_DESIGN open questions
- [ ] Optional vocal reload (“click-clack”) experiment
- [ ] Hand-art pass: better finger-gun silhouette, sleeve variety
- [ ] Simple non-gunshot SFX (target hit) that don't trigger the mic

## M3: Multiplayer technical prototype

**Acceptance:** 2–4 browser clients in one room see each other move and can hit each other
with vocal shots, via an authoritative server, on a LAN or a single cloud instance.

- [ ] Choose a server framework (candidate: Colyseus) and record the decision
- [ ] Network protocol: transforms + trigger commands (never audio)
- [ ] Server-side hit validation (collider approach decided, e.g. Rapier or simple shapes)
- [ ] Player avatars (low-poly, finger-gun poses visible in third person)
- [ ] Health, damage, respawn
- [ ] Basic lag compensation for hitscan

## M4: Playable multiplayer alpha

**Acceptance:** a group of friends can play repeated 3–5 minute matches without developer
help and want to keep playing.

- [ ] Rooms / invite links (no accounts)
- [ ] One or two small arena maps
- [ ] Round flow, scoreboard
- [ ] Evaluate proximity voice chat (WebRTC) and its interaction with detection
- [ ] Playtest sessions with recorded feedback

## M5: Public browser demo

**Acceptance:** anyone can open a URL, set up their mic in under a minute, and have fun;
the build loads fast enough on average connections.

- [ ] Bundle-size work (Babylon deep imports / code splitting)
- [ ] Onboarding / tutorial range with the briefing voice-over
- [ ] Settings polish, accessibility review
- [ ] Hosting, basic privacy-respecting analytics decision
- [ ] Streamer features (overlay, big-text mode)

## M6: Commercial desktop release evaluation

**Acceptance:** a go / no-go decision based on demo metrics, with a costed plan.

- [ ] Evaluate packaging (Electron, Tauri, others) and Steam integration needs
- [ ] Steam page, pricing (~€5.99), store assets
- [ ] Content plan (modes, maps, weapons) for launch
- [ ] Legal / privacy review (microphone use disclosure)
