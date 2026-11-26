export type MicErrorKind =
  | 'unsupported'
  | 'insecure-context'
  | 'permission-denied'
  | 'not-found'
  | 'in-use'
  | 'worklet-failed'
  | 'unknown';

export class MicrophoneError extends Error {
  constructor(
    readonly kind: MicErrorKind,
    readonly detail?: string,
  ) {
    super(describeMicError(kind));
    this.name = 'MicrophoneError';
  }
}

/** Maps a getUserMedia / Web Audio failure to a stable error kind. */
export function classifyMicError(error: unknown): MicErrorKind {
  if (error instanceof MicrophoneError) return error.kind;
  const name = typeof error === 'object' && error !== null ? (error as { name?: string }).name : '';
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return 'permission-denied';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return 'not-found';
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return 'in-use';
    case 'SecurityError':
      return 'insecure-context';
    default:
      return 'unknown';
  }
}

export function describeMicError(kind: MicErrorKind): string {
  switch (kind) {
    case 'unsupported':
      return 'This browser does not support microphone capture (getUserMedia / AudioWorklet). Try a recent Chrome, Edge or Firefox.';
    case 'insecure-context':
      return 'Microphone access requires a secure page. Open the game via https:// or http://localhost.';
    case 'permission-denied':
      return 'Microphone permission was denied. Allow it from the address-bar permission icon, then try again.';
    case 'not-found':
      return 'No microphone was found (or the selected one was unplugged). Connect one and try again.';
    case 'in-use':
      return 'The microphone could not be started. It may be in use by another application.';
    case 'worklet-failed':
      return 'The audio processor failed to load. Reload the page and try again.';
    case 'unknown':
      return 'The microphone could not be started for an unknown reason.';
  }
}
