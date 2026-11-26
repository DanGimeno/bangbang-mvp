/**
 * Top-level game lifecycle states.
 *
 * - `menu`: title screen / microphone setup. Nothing simulates.
 * - `playing`: pointer is locked, the player moves and shoots.
 * - `paused`: pointer lock was released (Escape). Settings are reachable.
 */
export type GameState = 'menu' | 'playing' | 'paused';

const TRANSITIONS: Record<GameState, readonly GameState[]> = {
  menu: ['playing'],
  playing: ['paused', 'menu'],
  paused: ['playing', 'menu'],
};

export class GameStateMachine {
  private current: GameState = 'menu';
  private readonly listeners = new Set<(to: GameState, from: GameState) => void>();

  get state(): GameState {
    return this.current;
  }

  canTransition(to: GameState): boolean {
    return TRANSITIONS[this.current].includes(to);
  }

  /** Returns true when the transition happened. Invalid transitions are ignored. */
  transition(to: GameState): boolean {
    if (!this.canTransition(to)) return false;
    const from = this.current;
    this.current = to;
    for (const listener of this.listeners) listener(to, from);
    return true;
  }

  onChange(listener: (to: GameState, from: GameState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
