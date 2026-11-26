# BANG! BANG! — Game Design Document

_Living document._ Status labels: **[Implemented]** works in the current build ·
**[Planned]** agreed, not built · **[Experimental]** idea to prototype and evaluate.

## 1. Product vision

**BANG! BANG! — The Vocal Shooter.** _Your mouth is the trigger._

A first-person shooter where you aim and move like any FPS, but you **fire by making the
gunshot sound yourself**. The voice is not an extra control. It is the core mechanic and
the reason the game exists. Every firefight becomes a room full of people yelling “PEW PEW”,
and that is the product.

### Creative direction: there are no guns

The concept comes from an April Fools' event where a hero shot with his finger. We take it
to its logical, utterly ridiculous conclusion:

- **Players make finger guns** and imitate gunshots with their mouths. They are grown adults
  playing imaginary gun battles, except the imaginary weapons actually deal damage.
- **The game takes its imaginary weapons extremely seriously.** Ammo counters, recoil,
  reload procedures, weapon taglines and military briefings are all delivered deadpan. The
  contrast between the solemn presentation and the absurd reality is the core joke.
- Comedy comes from **player interaction** (the noises people make, the panic of a dry fire,
  a reload twirl at the worst moment), not from scripted gags.

| Imaginary weapon                         | Representation                                          | Status                                          |
| ---------------------------------------- | ------------------------------------------------------- | ----------------------------------------------- |
| Pistol                                   | A finger gun (index out, thumb up as the hammer)        | **[Implemented]** Finger Pistol                 |
| Shotgun                                  | Two fingers extended, second hand cupping for stability | **[Implemented]** Two-Finger Shotgun            |
| Automatic weapon                         | Two hands carrying absolutely nothing                   | **[Implemented]** Automatic Nothing             |
| Dual pistols                             | Two finger guns                                         | [Planned]                                       |
| Grenades                                 | Imaginary. Throw gesture, “fiuuu… BOOM”                 | [Planned]                                       |
| Sniper rifle, laser gun, rocket launcher | Hand poses TBD                                          | [Experimental]                                  |
| Reloading                                | An unnecessarily elaborate hand gesture                 | **[Implemented]** keyframed gestures + captions |

## 2. Target audience

- Friend groups looking for a cheap, silly party game (couch or Discord).
- Streamers and YouTubers. The mechanic is inherently performative and the audience can hear
  every shot.
- Casual FPS players. Standard WASD + mouse, no complex loadouts.
- Secondary: people who enjoy voice-controlled novelty games.

## 3. Core gameplay loop

1. Look for a target → aim with the mouse.
2. **Say the shot** (“Bang!”), and the imaginary weapon fires instantly.
3. See the result: the target falls, a comic “BANG!” pops on screen, the hit counter ticks.
4. Run dry → “_click_” → **R**, and watch your character perform the reload ritual.
5. Repeat until hoarse.

Session length target: 2–5 minute rounds, highly replayable.

## 4. Vocal shooting mechanics

| Mechanic                                                              | Status                                                        |
| --------------------------------------------------------------------- | ------------------------------------------------------------- |
| Short vocal burst (impulse) = one trigger pull                        | **[Implemented]**                                             |
| Held/continuous voice = trigger held (automatic weapons)              | **[Implemented]**                                             |
| Syllable re-attacks (“ra-ta-ta”) count as extra trigger pulls         | **[Implemented]**                                             |
| Calibration of ambient noise, adjustable sensitivity, debounce        | **[Implemented]**                                             |
| Louder shot = bigger on-screen onomatopoeia                           | **[Implemented]** (cosmetic only)                             |
| Weapon-specific sounds required (“pew” for laser, “boom” for shotgun) | [Experimental]: needs sound classification, see AUDIO_SYSTEM  |
| Fire rate driven by how fast you say it                               | [Experimental]                                                |
| Vocal reload (“click-clack”)                                          | [Experimental]                                                |
| Suppressed weapons requiring whispering                               | [Experimental]                                                |
| Accidental firing (laughing, talking) as comedy                       | [Experimental]: currently a side effect, may become a feature |
| Enemies reacting to player noise                                      | [Experimental]                                                |
| Voice-driven special abilities                                        | [Experimental]                                                |

Design rule: mechanics must stay **language-independent**. We detect _sound shapes_
(bursts, sustains, rhythm), not words.

## 5. Weapons (current data, `src/weapons/weaponDefs.ts`)

| Weapon             | Say                     | Mode | Mag | Cooldown | Pellets | Tagline                                             |
| ------------------ | ----------------------- | ---- | --- | -------- | ------- | --------------------------------------------------- |
| Finger Pistol      | “Bang!” / “Pum!”        | semi | 8   | 180 ms   | 1       | Standard issue. Index finger, 1 each.               |
| Two-Finger Shotgun | “BOOM!”                 | semi | 4   | 650 ms   | 9       | Twice the fingers. Twice the responsibility.        |
| Automatic Nothing  | “Ratatatata!” / “Trrrr” | auto | 30  | 95 ms    | 1       | Fully automatic. Fully imaginary. Handle with care. |

All weapons are hitscan. Today any vocal burst fires any weapon; the "Say" column is a
suggestion, not a requirement. Each weapon has three reload captions (e.g. _“Removing
magazine (none)” → “Slapping in new magazine (also none)” → “Racking the void”_).

## 6. Potential game modes

- **Shooting range** [Implemented]: knock-down targets, hits/accuracy/bullseyes.
- **Time attack / score attack** [Planned]: clear all targets as fast as possible.
- **Free-for-all deathmatch** [Planned, M3–M4]: short rounds, small maps.
- **Team modes** [Experimental]
- **Quiet Mode** [Experimental]: a stealth round where only whispered shots count.
- **Streamer vs Chat** [Experimental]

## 7. Art direction

- Stylised low-poly, flat-shaded primitives, bright saturated palette (sky blue, sand,
  teal, tomato red, mustard yellow). **[Implemented, placeholder]**
- First-person view: **low-poly hands with blue sleeves and white cuffs** posing as weapons.
  The hands animate with full seriousness: a wrist flick on recoil, the thumb dropping like
  a hammer, the reload rituals. **[Implemented, placeholder]**
- Muzzle flashes appear at the fingertip. For the Automatic Nothing they appear in thin air,
  where the barrel would be. **[Implemented]**
- Comic-book onomatopoeia (“BANG!”, “BOOM!”, “_click_”) as the main feedback layer.
  **[Implemented]**
- Military-briefing UI copy, delivered deadpan.
- The game must be fun with primitive graphics. Art polish comes after M4.

## 8. Audio direction

- **The player's voice is the gunshot.** The game never plays gunshot sound effects.
- Possible future sounds: target hits, UI clicks, dry-fire “click”, ambient range sounds,
  an announcer reading weapon taglines with total sincerity. All of these must avoid
  feedback into open microphones (keep them short, mid/high frequency, and optional).
- Proximity voice chat would make every player's gunshots audible to nearby enemies
  [Experimental, M3+].

## 9. Multiplayer vision

- Short online matches for 2–8 players, browser first. [Planned, M3–M4]
- Authoritative server (candidate: Colyseus). Clients send _trigger commands_ (pull /
  hold), never audio, so detection stays local and private.
- Proximity voice chat (WebRTC) is a natural fit but adds bandwidth, moderation and
  privacy concerns. Evaluate separately.
- Anti-cheat consideration: voice can't be verified server-side, so a "keyboard trigger"
  cheat is trivial. Acceptable for a party game among friends; revisit for public play.

## 10. Streamer-friendly features

- Big, readable onomatopoeia that matches what viewers hear. [Implemented]
- Streamer overlay / “shot meter” scene source. [Experimental]
- Spectator mode centred on player audio. [Experimental]
- Clip-worthy moments: dry fires, reload rituals at the worst moment, accidental shots.

## 11. Commercial positioning

- Premium, small price (~€5.99) on Steam after a free browser demo validates interest.
- No pay-to-win, no loot boxes. Cosmetics are out of scope for now.
- Hook: a 5-second clip explains the game. Marketing is the players' own voices.
- Risks: novelty may wear off (needs good modes); microphone friction (setup must be
  painless); detection reliability (see AUDIO_SYSTEM).

## 12. Open design questions

1. Should each weapon **require** its own sound (“pew” vs “boom”), or is any burst fine?
   Requiring it is funnier, but needs a classifier and adds failure modes.
2. How do we stop ordinary talking from firing? (Detection improvement or a design answer:
   push-to-talk team chat, “safety on” key, or embracing accidental fire.)
3. Should louder shots do more damage? Risks shouting contests and hurts accessibility.
4. Accessibility: players who cannot or prefer not to use their voice. A non-voice trigger
   mode conflicts with the core identity. Decide how to offer it respectfully.
5. Does the reload need a vocal component (“click-clack”), or is the gesture enough?
6. How should finger-gun hand poses communicate dual pistols and grenades clearly in
   first person?
7. Multiplayer: does hearing opponents' “bang” through voice chat help or hurt?
