/** Fetches a required element by id, failing loudly if the HTML and code drift apart. */
export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id} in index.html`);
  return el as T;
}

/** Restarts a CSS animation class on an element. */
export function restartAnimation(el: HTMLElement, className: string): void {
  el.classList.remove(className);
  void el.offsetWidth; // force reflow
  el.classList.add(className);
}

export function formatDb(db: number): string {
  return `${db <= -99 ? '−∞' : Math.round(db)} dB`;
}
