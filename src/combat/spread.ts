/** Angular offset of a pellet from the aim direction, in radians (x = yaw, y = pitch). */
export interface AngularOffset {
  x: number;
  y: number;
}

/**
 * Pellet directions uniformly distributed inside a cone of half-angle `spreadRad`.
 * Engine-agnostic so it can be unit-tested and reused by a future server.
 */
export function pelletOffsets(
  count: number,
  spreadRad: number,
  rng: () => number = Math.random,
): AngularOffset[] {
  const offsets: AngularOffset[] = [];
  for (let i = 0; i < count; i++) {
    const r = spreadRad * Math.sqrt(rng());
    const theta = 2 * Math.PI * rng();
    offsets.push({ x: r * Math.cos(theta), y: r * Math.sin(theta) });
  }
  return offsets;
}
