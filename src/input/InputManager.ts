import type { MoveIntent } from '../player/movement';

/**
 * Keyboard, mouse and Pointer Lock handling. Converts browser events into simple
 * queries (`moveIntent`, `consumeMouseDelta`) and callbacks for discrete actions.
 */
export class InputManager {
  onKeyPress: ((code: string) => void) | null = null;
  onPointerLockChange: ((locked: boolean) => void) | null = null;
  onMouseButton: ((button: number, down: boolean) => void) | null = null;

  private readonly keys = new Set<string>();
  private dx = 0;
  private dy = 0;
  private readonly cleanup: (() => void)[] = [];

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.listen(window, 'keydown', (e) => {
      const event = e as KeyboardEvent;
      if (!this.isPointerLocked) return;
      this.keys.add(event.code);
      if (!event.repeat) this.onKeyPress?.(event.code);
      // Avoid browser shortcuts (e.g. Space scrolling) while playing.
      if (event.code !== 'Escape' && event.code !== 'F11' && event.code !== 'F12') {
        event.preventDefault();
      }
    });
    this.listen(window, 'keyup', (e) => this.keys.delete((e as KeyboardEvent).code));
    this.listen(window, 'blur', () => this.keys.clear());
    this.listen(document, 'mousemove', (e) => {
      if (!this.isPointerLocked) return;
      const event = e as MouseEvent;
      this.dx += event.movementX;
      this.dy += event.movementY;
    });
    this.listen(canvas, 'mousedown', (e) => {
      if (this.isPointerLocked) this.onMouseButton?.((e as MouseEvent).button, true);
    });
    this.listen(window, 'mouseup', (e) => {
      if (this.isPointerLocked) this.onMouseButton?.((e as MouseEvent).button, false);
    });
    this.listen(document, 'pointerlockchange', () => {
      if (!this.isPointerLocked) this.keys.clear();
      this.dx = 0;
      this.dy = 0;
      this.onPointerLockChange?.(this.isPointerLocked);
    });
  }

  get isPointerLocked(): boolean {
    return document.pointerLockElement === this.canvas;
  }

  /** Must be called from a user gesture. Resolves false if the browser refused. */
  async requestPointerLock(): Promise<boolean> {
    try {
      // Returns a promise in modern browsers, undefined in older ones.
      await (this.canvas.requestPointerLock() as unknown as Promise<void> | undefined);
      return true;
    } catch {
      // e.g. Chrome refuses re-locking within ~1s of the user pressing Escape.
      return false;
    }
  }

  exitPointerLock(): void {
    if (this.isPointerLocked) document.exitPointerLock();
  }

  isDown(code: string): boolean {
    return this.keys.has(code);
  }

  moveIntent(): MoveIntent {
    const axis = (pos: string[], neg: string[]) =>
      (pos.some((k) => this.keys.has(k)) ? 1 : 0) - (neg.some((k) => this.keys.has(k)) ? 1 : 0);
    return {
      forward: axis(['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown']),
      right: axis(['KeyD', 'ArrowRight'], ['KeyA', 'ArrowLeft']),
    };
  }

  consumeMouseDelta(): { dx: number; dy: number } {
    const delta = { dx: this.dx, dy: this.dy };
    this.dx = 0;
    this.dy = 0;
    return delta;
  }

  dispose(): void {
    for (const off of this.cleanup) off();
    this.cleanup.length = 0;
  }

  private listen(target: EventTarget, type: string, handler: (e: Event) => void): void {
    target.addEventListener(type, handler);
    this.cleanup.push(() => target.removeEventListener(type, handler));
  }
}
