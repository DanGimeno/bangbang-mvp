/**
 * Minimal typed publish/subscribe bus.
 *
 * Systems communicate through events instead of holding references to each other,
 * which keeps them replaceable (e.g. swapping the vocal detector) and testable.
 */
export type Listener<T> = (payload: T) => void;

export class EventBus<Events extends object> {
  private readonly listeners = new Map<keyof Events, Set<Listener<never>>>();

  on<K extends keyof Events>(type: K, listener: Listener<Events[K]>): () => void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(listener);
    return () => this.off(type, listener);
  }

  off<K extends keyof Events>(type: K, listener: Listener<Events[K]>): void {
    this.listeners.get(type)?.delete(listener);
  }

  emit<K extends keyof Events>(type: K, payload: Events[K]): void {
    const set = this.listeners.get(type);
    if (!set) return;
    for (const listener of [...set]) (listener as Listener<Events[K]>)(payload);
  }

  clear(): void {
    this.listeners.clear();
  }
}
