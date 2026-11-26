# Audio System: vocal shot detection

Audio detection is **the primary technical uncertainty** of BANG! BANG!. This document
describes what is implemented, why, what it cannot do, and how to test it.

> **Verification status:** the detector is covered by automated tests built from synthetic
> level envelopes. The full browser pipeline (permission → AudioWorklet → detector → weapon
> firing) has been exercised in headless Chrome using its fake microphone, which emits
> periodic beeps. **It has not yet been tested with real human voices and real
> microphones.** The default parameters are educated guesses until the manual test plan
> below has been run.

## 1. Capture pipeline

```
getUserMedia (mono, AGC off, echo-cancel off, noise suppression off by default)
  → MediaStreamAudioSourceNode
  → BiquadFilter high-pass 150 Hz (Q 0.707)    removes rumble, desk bumps, mains hum
  → AudioWorkletNode "bangbang-level"           audio thread
        accumulates 256 samples (~5.3 ms @ 48 kHz)
        posts { time (ms, audio clock), rms, peak } and DISCARDS the samples
  → GainNode (gain 0) → destination              keeps the node pulled, produces no sound
```

Code: `src/audio/MicrophoneCapture.ts`, `src/audio/worklet/level-processor.ts`.

Why these constraints:

- **autoGainControl: false**: AGC constantly rescales the signal, which would make the
  calibrated noise floor meaningless and squash the attack of a shout.
- **echoCancellation: false**: the game plays no gunshot sounds, and AEC can attenuate
  sudden loud onsets.
- **noiseSuppression: false (default)**: browser suppressors are tuned for speech and often
  smear or remove short plosive bursts. Players in noisy rooms can turn it on in settings.
- Mono, channel 0 only.

The AudioContext is created and resumed from a user click (autoplay policy).

## 2. Processing strategy

The main thread receives ~190 frames per second and feeds them to `VocalDetector`, a pure
state machine with no browser dependencies. Keeping detection off the audio thread makes it
easy to test and to replace. The cost is one `postMessage` hop (sub-millisecond to a few ms).

### Why not speech recognition?

Speech-to-text is slow (hundreds of ms), language-dependent, often cloud-based, and bad at
non-words like “pew”. Gunshot imitations are **acoustic events**, not words. Energy-onset
detection is fast, local, private and language-independent.

## 3. Calibration

`NoiseCalibrator` records ~2 s of frames while the player stays quiet and takes the
**90th percentile** of frame levels (dBFS) as the noise floor. The percentile, rather than
the mean, means occasional background bumps push the floor _up_ (fewer false positives)
without one spike dominating.

Quality flags:

| Floor      | Flag     | Message to player                          |
| ---------- | -------- | ------------------------------------------ |
| > −35 dBFS | `noisy`  | Loud room; expect misfires; use headset    |
| < −90 dBFS | `silent` | Muted / wrong device? (or digital silence) |
| otherwise  | `good`   |                                            |

Calibration runs automatically the first time the mic is enabled. The result is persisted
in settings, and the player can recalibrate at any time. Until calibrated, the detector
assumes a −60 dBFS floor.

## 4. Noise filtering

1. **High-pass at 150 Hz** before analysis (rumble, handling noise, hum, fans).
2. **Threshold relative to the calibrated floor:**
   `threshold = max(−55 dBFS, floor + margin)`, with `margin` from 30 dB (sensitivity 0) to
   6 dB (sensitivity 100). Default sensitivity 50 gives 18 dB.
3. **Attack-shape requirement** (see below): steady or slowly rising noise never fires.
4. **Adaptive floor** (optional, default on): while idle and below threshold, the floor
   drifts towards the current level with a 4 s time constant, limited to ±15 dB around the
   calibrated value.
5. **Stuck-trigger protection:** a sound held for more than 3 s is force-released and must
   go quiet before it can fire again (vacuum cleaners, music).

## 5. Vocal impulse detection

Per frame (level `L` in dBFS, `min40` = quietest level in the previous 40 ms):

| Condition                                                    | Result                    |
| ------------------------------------------------------------ | ------------------------- |
| idle, `L ≥ threshold`, `L − min40 ≥ 10 dB`, debounce passed  | `voice-start` + `impulse` |
| active, `L ≥ threshold`, `L − min40 ≥ 6 dB`, debounce passed | `impulse` (`retrigger`)   |
| active, `L < threshold − 4 dB` for ≥ 90 ms                   | `voice-end`               |
| active for ≥ 3000 ms                                         | `voice-end` (`forced`)    |

Events (`src/audio/types.ts`) are gameplay-independent:

- `impulse { levelDb, strength 0..1, retrigger }`: an attack. Becomes a trigger pull.
- `voice-start` / `voice-end`: becomes trigger held / released (automatic weapons).

Mapping to weapons lives only in `src/weapons/vocalTrigger.ts`.

Tunable parameters (`DEFAULT_DETECTOR_CONFIG` in `VocalDetector.ts`; the ones marked ⚙
are exposed in the settings UI):

| Parameter            | Default | Notes                                     |
| -------------------- | ------- | ----------------------------------------- |
| sensitivity ⚙        | 50      | 0..100 → margin 30..6 dB                  |
| minThresholdDb       | −55     | absolute floor for the threshold          |
| attackRiseDb         | 10      | rise needed from quiet                    |
| retriggerRiseDb      | 6       | rise needed for “ra-ta-ta” syllables      |
| riseWindowMs         | 40      | look-back for the rise                    |
| debounceMs ⚙         | 70      | min time between impulses                 |
| releaseMs ⚙          | 90      | silence before voice-end                  |
| hysteresisDb         | 4       | release threshold below trigger threshold |
| maxActiveMs          | 3000    | stuck-trigger guard                       |
| adaptiveNoiseFloor ⚙ | on      | 4 s time constant, ±15 dB                 |

## 6. Latency considerations

| Stage                                   | Typical                                     |
| --------------------------------------- | ------------------------------------------- |
| Microphone + OS + browser input buffer  | 10–40 ms (hardware/OS dependent)            |
| Frame accumulation (256 samples)        | ≤ 5.3 ms                                    |
| Worklet → main thread message           | < 1–3 ms                                    |
| Detection                               | fires on the **first** frame over threshold |
| Until the shot is visible (next render) | ≤ 16.7 ms at 60 fps                         |

Estimated voice-to-visible-shot time: roughly **30–65 ms**. This has **not been measured**
yet. Measuring it is on the M2 checklist (film the screen + mic with a high-fps phone
camera).

`latencyHint: 'interactive'` is requested on the AudioContext.

## 7. False positives and false negatives

### Known limitations of the current algorithm (important)

The detector reacts to **loud, sharp onsets**. It does **not** know what was said.
Consequently:

- **It cannot reliably tell gunshot imitations from ordinary speech.** Speech is full of
  plosives (/b/, /p/, /t/, /k/) that look exactly like “Bang!”. A loud “But…”, a laugh or
  a cough will fire. Quiet conversation mostly stays below the threshold, but loud talking
  will not.
- Any weapon accepts any sound. “Pew” fires the shotgun; “BOOM” fires the pistol.
- **Non-vocal transients fire too:** desk slaps, keyboard clacks (on laptop mics), door
  slams, a dog barking, other people in the room.
- **Teammates' voices through speakers** can fire your weapon (no echo cancellation).
  Headphones are strongly recommended.
- Soft or breathy imitations (“pff”, whispered “pew”) may fall under the threshold. Turn
  sensitivity up.
- Slowly swelling sounds (“aaaaaah”) are intentionally ignored even when loud.
- Very fast “ratatata” syllables closer than the debounce (70 ms) merge.
- With browser noise suppression enabled, short bursts may be attenuated or missed.
- Digital-silence inputs (some virtual devices) calibrate to −∞ and are flagged `silent`.

### Mitigation levers available today

Calibrate in the actual environment, lower sensitivity, raise the debounce, use a headset,
disable the adaptive floor in rooms where noise comes in bursts.

## 8. Browser compatibility

| Browser          | Expected                                                | Verified                                   |
| ---------------- | ------------------------------------------------------- | ------------------------------------------ |
| Chrome (desktop) | ✅ Full support                                         | Headless, fake mic: pipeline and firing OK |
| Edge (desktop)   | ✅ Same engine as Chrome                                | Not tested                                 |
| Firefox          | ✅ AudioWorklet supported                               | Not tested                                 |
| Safari (macOS)   | ⚠️ Likely works; quirks with constraints / AudioContext | Not tested                                 |
| Mobile           | Out of scope                                            |                                            |

Requirements: secure context (`https` or `localhost`), `getUserMedia`, `AudioWorklet`,
WebGL. Device labels are only available after permission is granted. If a saved device is
missing, capture falls back to the default device.

Errors are classified (`microphoneErrors.ts`) into: `unsupported`, `insecure-context`,
`permission-denied`, `not-found`, `in-use`, `worklet-failed`, `unknown`, each with a
player-facing explanation. An unplugged mic (track `ended`) is reported in the menu.

## 9. Privacy

- Audio is processed **in memory, in the browser**. The worklet reduces each ~5 ms of audio
  to three numbers and discards the samples.
- **Nothing is recorded, stored, or transmitted.** No cloud, AI or third-party audio
  services.
- Persisted data (localStorage): sensitivity, debounce, release, the calibrated noise
  floor (a single number), the chosen device id, mouse settings.
- The UI states this next to the microphone controls.
- Future multiplayer must keep this property: send trigger commands, never audio, for
  gameplay. Voice chat, if added, is a separate and clearly disclosed feature.

## 10. Future detection improvements (ranked by expected value)

1. **Tune defaults from real recordings.** Gather a small local, opt-in dataset (never
   uploaded) of shots versus speech from several people and microphones. Build an offline
   harness that replays level envelopes through `VocalDetector`.
2. **Spectral features in the worklet:** spectral centroid / flatness and zero-crossing
   rate. Gunshot imitations are broadband, noisy bursts. Many speech segments are voiced
   and harmonic. This could cut speech false positives considerably.
3. **Burst-shape scoring:** short attack + fast decay + total duration < ~300 ms. Fire on
   onset (latency) but tag “speech-like” events so the game can ignore streams of
   syllables, e.g. a “talking” lockout after N impulses within a short window.
4. **Per-weapon sound classes** (pew vs boom vs ratatata) using a tiny on-device classifier
   (MFCC + k-NN, or a small model in WebAssembly). Optional per-player training: “say your
   pistol sound 5 times”.
5. **Echo/speaker rejection** for players without headphones.
6. A **“safety” key** (hold to talk without firing) as a design-level fallback.

## 11. Manual testing procedures

Run with `npm run dev`, Chrome or Firefox, ideally twice: once with a headset mic and once
with a laptop's built-in mic. Note the noise floor shown after calibration.

**Setup checks**

1. First load → _Enable microphone_ → browser asks for permission → status turns green,
   calibration runs automatically (“stay quiet”), then reports the noise floor.
2. Deny permission (reset it in site settings first) → red, actionable error message.
3. Unplug / switch devices → device list updates; choosing another device restarts capture.
4. The level meter moves with your voice. The red threshold marker sits about 18 dB right
   of the teal floor marker at sensitivity 50.

**Detection checks (menu test lamp, then in game)**: record hits and misses out of 20 attempts each:

| #   | Action                                         | Expected                                            |
| --- | ---------------------------------------------- | --------------------------------------------------- |
| 1   | “Bang!” at normal volume, 1/second             | 20/20 fire, 1 shot each                             |
| 2   | “Pum!”, “Pew!”, “Boom!”                        | Fire                                                |
| 3   | Fast “bang-bang-bang” (≈4/s)                   | One shot per word                                   |
| 4   | “Ratatatata” on the Automatic Nothing          | Continuous fire while you go                        |
| 5   | Held “Trrrrrr” on the Automatic Nothing        | Fires for the duration, stops on silence            |
| 6   | Silence for 30 s                               | 0 shots                                             |
| 7   | Typing on the keyboard for 30 s                | Ideally 0 (laptop mic: expect some)                 |
| 8   | Normal conversation for 30 s                   | **Count the false shots** (known weakness)          |
| 9   | Laugh / cough                                  | Probably fires (known)                              |
| 10  | Steady background noise (fan, music) turned on | No sustained fire. Forced release after 3 s at most |
| 11  | Whispered “pew” at sensitivity 50 / 90         | Likely miss / fire                                  |

**Latency feel:** shoot at the targets. Does the shot feel simultaneous with your voice?
Note any perceived delay.

Record results (browser, OS, microphone, floor, sensitivity, scores) in an issue or append
them to this section. That data drives the M2 tuning work.

### Automated / headless checks

- `npm test`: detector behaviour on synthetic envelopes (bursts, swells, trills, stuck
  noise, sensitivity, debounce, adaptive floor) plus calibration and error mapping.
- Headless Chrome with `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream`:
  the fake device's periodic beeps are detected and fire the weapons. This verifies the
  plumbing (permission, worklet loading, events, HUD) but says nothing about real voices.
