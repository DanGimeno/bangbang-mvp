import { clamp } from '../core/math';

/**
 * Player-adjustable settings, persisted to localStorage.
 * Only settings are stored — never audio.
 */
export interface Settings {
  audio: {
    deviceId: string | null;
    /** 0..100 */
    sensitivity: number;
    /** Calibrated noise floor (dBFS), or null when never calibrated. */
    noiseFloorDb: number | null;
    /** Minimum time between two detected vocal impulses. */
    debounceMs: number;
    /** Silence needed before a held voice counts as released. */
    releaseMs: number;
    adaptiveNoiseFloor: boolean;
    browserNoiseSuppression: boolean;
  };
  controls: {
    /** Radians per pixel of mouse movement. */
    mouseSensitivity: number;
    invertY: boolean;
  };
  debug: {
    /** Development-only: fire with the left mouse button. */
    mouseFire: boolean;
  };
}

export const DEFAULT_SETTINGS: Readonly<Settings> = {
  audio: {
    deviceId: null,
    sensitivity: 50,
    noiseFloorDb: null,
    debounceMs: 70,
    releaseMs: 90,
    adaptiveNoiseFloor: true,
    browserNoiseSuppression: false,
  },
  controls: {
    mouseSensitivity: 0.0022,
    invertY: false,
  },
  debug: {
    mouseFire: false,
  },
};

export const SETTINGS_LIMITS = {
  sensitivity: [0, 100],
  noiseFloorDb: [-100, 0],
  debounceMs: [20, 400],
  releaseMs: [30, 400],
  mouseSensitivity: [0.0005, 0.01],
} as const;

const STORAGE_KEY = 'bangbang.settings.v1';

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

function num(value: unknown, fallback: number, [min, max]: readonly [number, number]): number {
  return typeof value === 'number' && Number.isFinite(value) ? clamp(value, min, max) : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/** Turns untrusted (e.g. stored) data into valid settings, falling back to defaults. */
export function sanitizeSettings(raw: unknown): Settings {
  const d = DEFAULT_SETTINGS;
  const root = isObject(raw) ? raw : {};
  const audio = isObject(root.audio) ? root.audio : {};
  const controls = isObject(root.controls) ? root.controls : {};
  const debug = isObject(root.debug) ? root.debug : {};
  return {
    audio: {
      deviceId: typeof audio.deviceId === 'string' && audio.deviceId ? audio.deviceId : null,
      sensitivity: num(audio.sensitivity, d.audio.sensitivity, SETTINGS_LIMITS.sensitivity),
      noiseFloorDb:
        typeof audio.noiseFloorDb === 'number' && Number.isFinite(audio.noiseFloorDb)
          ? clamp(audio.noiseFloorDb, ...SETTINGS_LIMITS.noiseFloorDb)
          : null,
      debounceMs: num(audio.debounceMs, d.audio.debounceMs, SETTINGS_LIMITS.debounceMs),
      releaseMs: num(audio.releaseMs, d.audio.releaseMs, SETTINGS_LIMITS.releaseMs),
      adaptiveNoiseFloor: bool(audio.adaptiveNoiseFloor, d.audio.adaptiveNoiseFloor),
      browserNoiseSuppression: bool(audio.browserNoiseSuppression, d.audio.browserNoiseSuppression),
    },
    controls: {
      mouseSensitivity: num(
        controls.mouseSensitivity,
        d.controls.mouseSensitivity,
        SETTINGS_LIMITS.mouseSensitivity,
      ),
      invertY: bool(controls.invertY, d.controls.invertY),
    },
    debug: {
      mouseFire: bool(debug.mouseFire, d.debug.mouseFire),
    },
  };
}

export function loadSettings(storage: KeyValueStorage | null): Settings {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    return sanitizeSettings(raw ? JSON.parse(raw) : null);
  } catch {
    return sanitizeSettings(null);
  }
}

export function saveSettings(storage: KeyValueStorage | null, settings: Settings): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage can be unavailable (private mode, blocked site data). Settings then last
    // for the session only, which is acceptable.
  }
}

/** Safe accessor: localStorage itself can throw when site data is blocked. */
export function browserStorage(): KeyValueStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
