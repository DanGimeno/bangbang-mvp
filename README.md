# BANG! BANG! — The Vocal Shooter

> **Your mouth is the trigger.**

BANG! BANG! is a first-person shooter with no guns. You aim with the mouse, move with WASD,
make a finger gun and **fire by saying the shot out loud**: “Bang!”, “Pew!”, “BOOM!”,
“Ratatatata!”. Your imaginary weapons deal very real damage, and the game treats them with
complete military seriousness.

The idea started with an April Fools' event where a hero fired with his finger. We are taking
it to its logical, utterly ridiculous conclusion: grown adults playing imaginary gun battles
where the imaginary guns actually work. It's built to be chaotic, easy to pick up, and fun to
play with friends or watch on stream.

## Project status

**Milestone M1: single-player shooting range. Playable technical prototype.**

| Area                                                                        | Status                                                                                  |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Low-poly shooting range, knock-down targets, hit feedback                   | ✅ Implemented                                                                          |
| First-person controls (WASD, Pointer Lock mouse look)                       | ✅ Implemented                                                                          |
| Microphone capture, device selection, level meter, calibration              | ✅ Implemented                                                                          |
| Vocal impulse detection (local, energy-onset based)                         | ✅ Implemented. Needs tuning with real voices, see [Audio System](docs/AUDIO_SYSTEM.md) |
| Finger Pistol (hitscan, magazine, reload, cooldown, recoil, muzzle flash)   | ✅ Implemented                                                                          |
| Two-Finger Shotgun (pellets) and Automatic Nothing (held voice = auto fire) | ✅ Implemented (experimental)                                                           |
| Low-poly hand view models with elaborate reload gestures                    | ✅ Implemented (placeholder art)                                                        |
| Multiplayer, voice chat, Steam                                              | ❌ Not started (see [Roadmap](docs/ROADMAP.md))                                         |

The audio detection has been verified with automated tests (synthetic signals) and with
Chrome's synthetic fake microphone. **It has not yet been validated with real human voices
across real microphones.** That is the next priority.

## Technology

- [Vite](https://vite.dev/) 8 + TypeScript 6 (strict)
- [Babylon.js](https://www.babylonjs.com/) 9 for rendering
- Web Audio API + AudioWorklet for local, low-latency microphone analysis
- Vitest, ESLint (typescript-eslint), Prettier
- No React and no backend. The UI is plain DOM.

## Getting started

Requirements: Node.js ≥ 20.19 (developed on Node 24), a desktop browser, a microphone.

```bash
npm install
npm run dev          # http://localhost:5173
```

Open the page, click **Enable microphone**, stay quiet for the 2-second calibration, say
“Bang!” and watch the detection lamp, then click **START**.

### Commands

| Command             | What it does                                                    |
| ------------------- | --------------------------------------------------------------- |
| `npm run dev`       | Dev server with hot reload                                      |
| `npm run build`     | Type-check and build to `dist/`                                 |
| `npm run preview`   | Serve the production build (http://localhost:4173)              |
| `npm test`          | Run unit tests once (`npm run test:watch` for watch mode)       |
| `npm run typecheck` | TypeScript only                                                 |
| `npm run lint`      | ESLint                                                          |
| `npm run format`    | Prettier (write); `format:check` to verify                      |
| `npm run check`     | Everything CI should run: typecheck, lint, format, tests, build |

## Controls

| Input            | Action                                                       |
| ---------------- | ------------------------------------------------------------ |
| Voice: “Bang!”   | Fire. Hold “Trrrrr” on the Automatic Nothing for auto fire   |
| Mouse            | Aim (pointer is captured after START)                        |
| W A S D / arrows | Move                                                         |
| R                | Reload (an unnecessarily elaborate hand gesture)             |
| 1 / 2 / 3        | Finger Pistol / Two-Finger Shotgun / Automatic Nothing       |
| Esc              | Release the mouse and pause; settings live in the pause menu |

**Developer fallback trigger:** in `npm run dev`, or with `?debug` in the URL, the
menu shows a _Developer_ box with “fire with left mouse button”. It is off by default and is
for debugging only. The voice is the trigger.

## Browser & microphone requirements

- Desktop Chrome, Edge or Firefox (recent versions). Safari is untested. Mobile is out of scope.
- WebGL, `getUserMedia` and `AudioWorklet` support.
- A **secure context**: `https://` or `http://localhost`. Microphone access is blocked on plain
  `http://` LAN addresses.
- A headset or desk microphone works best. Laptop microphones work, but they pick up keyboard
  noise.

**Privacy:** audio is analysed locally, ~5 ms at a time, and immediately discarded. Nothing is
recorded, stored or transmitted. Only your settings (sensitivity, calibrated noise level,
selected device id) are saved, in `localStorage`.

## Documentation

- [CLAUDE.md](CLAUDE.md): working instructions for AI-assisted development sessions
- [Game Design](docs/GAME_DESIGN.md): vision, creative direction, mechanics, open questions
- [Architecture](docs/ARCHITECTURE.md): systems, data flow, directory layout
- [Audio System](docs/AUDIO_SYSTEM.md): the vocal detection pipeline, its limits, how to test it
- [Roadmap](docs/ROADMAP.md): milestones M0–M6 with acceptance criteria
- [Decisions](docs/DECISIONS.md): architectural decision log
