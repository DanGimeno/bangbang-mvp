# CLAUDE.md: BANG! BANG! project instructions

Persistent guidance for Claude Code sessions in this repository. Read this first.

## What we are building

**BANG! BANG! — The Vocal Shooter.** A comedic first-person shooter where the player fires by
**imitating gunshot sounds into the microphone**. _Your mouth is the trigger._

**Creative direction: there are no guns.** Weapons are imaginary: finger guns, two-finger
shotguns, empty hands carrying an "Automatic Nothing". Recoil, fire rate and damage all
still exist, and the game takes them completely seriously. That deadpan seriousness is the
joke. Never add physical gun models. See `docs/GAME_DESIGN.md`.

- Long-term: affordable Steam release (~€5.99). Short-term: validate the concept with a
  browser prototype.
- Product principles: gameplay first; comedy from player interaction, not scripted jokes;
  low barrier to entry; streamer-friendly; language-independent vocal mechanics; no
  pay-to-win; no premature infrastructure.

## Current priorities (milestone M1 → M2)

1. **Validate vocal detection with real voices and microphones** (the main technical risk).
   Tune `DEFAULT_DETECTOR_CONFIG` in `src/audio/VocalDetector.ts` using the manual test plan
   in `docs/AUDIO_SYSTEM.md`.
2. Make the Finger Pistol feel great: latency, feedback, hit readability.
3. Only then: refine the Two-Finger Shotgun / Automatic Nothing, add more weapons (M2).

Check `docs/ROADMAP.md` before starting work and tick off items you complete.

## Scope rules: read before adding anything

- **Do not expand scope.** Do not add networking, accounts, databases, payments,
  matchmaking, servers, Steam integration, inventories, cosmetics, progression, complex AI,
  mobile controls or cloud speech recognition unless the roadmap milestone being worked on
  explicitly calls for it **and** the user asked for it.
- Do not add dependencies casually. Every new dependency needs a reason in `docs/DECISIONS.md`.
- No cloud/AI audio services. Audio stays in the browser. Never record, store or transmit
  microphone audio.
- Do not play gunshot sound effects. The player's voice is the gunshot.
- Keep placeholder art primitive. Do not spend effort on detailed assets.
- If a non-critical decision is needed, choose sensibly and log it in `docs/DECISIONS.md`.
  Ask the user only for decisions that change project direction.

## Architecture principles

See `docs/ARCHITECTURE.md` for diagrams. In short:

- **Pure core, thin browser shell.** Gameplay and detection logic (`VocalDetector`,
  `NoiseCalibrator`, `WeaponState`, `WeaponManager`, `TargetLogic`, `movement`, `spread`,
  `RangeStats`, `settings`) take time and inputs as arguments and have no DOM/Babylon/Web
  Audio dependencies. Keep it that way; it is what makes them testable and server-portable.
- **Voice never touches weapons directly.** `audio/` emits gameplay-independent
  `VocalEvent`s; `weapons/vocalTrigger.ts` is the _only_ mapping from voice to
  trigger input (`pullTrigger` / `setTriggerHeld`). Replacing the detector must not
  require touching weapons.
- **Weapons are data.** New weapons are entries in `src/weapons/weaponDefs.ts` (plus a hand
  pose in `render/HandView.ts` if new). Do not subclass per weapon.
- `core/Game.ts` is the composition root: it wires systems through callbacks/events.
  Systems do not import each other's concrete classes beyond what they consume.
- The render loop and game state are independent of any UI framework. The UI is plain DOM
  (`src/ui/`). Do not introduce React unless the decision log is updated with a reason.
- Design for future multiplayer (deterministic, time-injected logic; trigger input as
  abstract commands) but **do not implement networking** yet.

## Coding conventions

- TypeScript strict (+ `noUncheckedIndexedAccess`). No `any`. Prefer `type` imports.
- Small modules, one responsibility each. Named exports. Classes for stateful systems,
  functions for pure transforms.
- Time in **milliseconds** for gameplay/audio logic, **seconds** only at the Babylon
  boundary. Angles in radians internally, degrees only in data definitions (`spreadDeg`).
- Units: metres. Babylon is left-handed, Y-up; the range runs along +Z.
- Comments explain _why_, not _what_. Keep the deadpan tone in player-facing text.
- Formatting by Prettier (single quotes, width 100). Lint must pass with zero warnings.

## Development workflow

```bash
npm run dev      # develop at http://localhost:5173 (debug mouse-fire available)
npm run check    # typecheck + lint + format check + tests + build. Run before finishing
```

- Work incrementally; keep the app runnable after every step.
- Commit only when the user asks. Never push without explicit authorization.
- Microphone features **cannot be fully verified automatically**. When you change audio
  code, say clearly what was verified by tests and what needs manual testing in a browser
  with a real microphone. Never claim detection "works reliably" without real-mic testing.
- Headless smoke testing is possible with Chrome flags `--use-fake-ui-for-media-stream
--use-fake-device-for-media-stream` (the fake device emits periodic beeps that the
  detector picks up as shots). This proves the pipeline runs; it does not prove it
  works for real voices.

## Testing expectations

- Every pure module has Vitest tests next to it (`*.test.ts`) or in `src/gameplay.test.ts`.
- Detector changes need tests built from synthetic envelopes (`src/audio/testSignals.ts`):
  add a case for each new behaviour _and_ each false-positive scenario you fix.
- Babylon/DOM glue is not unit-tested; keep it thin so that is acceptable.

## Documentation maintenance

Docs are a deliverable. When behaviour changes, update in the same session:

- `README.md`: status table, controls, commands.
- `docs/GAME_DESIGN.md`: mark features **Implemented / Planned / Experimental** accurately.
- `docs/ARCHITECTURE.md`: directory layout and flows if structure changed.
- `docs/AUDIO_SYSTEM.md`: any detector parameter or pipeline change, and new findings
  from manual testing.
- `docs/ROADMAP.md`: tick completed items; do not add dates.
- `docs/DECISIONS.md`: append a numbered entry for significant decisions.
