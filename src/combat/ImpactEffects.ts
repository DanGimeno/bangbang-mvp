import {
  Color3,
  MeshBuilder,
  StandardMaterial,
  type Mesh,
  type Scene,
  type Vector3,
} from '@babylonjs/core';

const POOL_SIZE = 40;
const LIFETIME_MS = 1800;

interface Impact {
  mesh: Mesh;
  ageMs: number;
}

/**
 * Small puffs where imaginary bullets land. The bullets are imaginary;
 * the holes they leave are, regrettably, very real.
 */
export class ImpactEffects {
  private readonly pool: Impact[] = [];
  private next = 0;

  constructor(scene: Scene) {
    const mat = new StandardMaterial('impact', scene);
    mat.diffuseColor = Color3.FromHexString('#2b2118');
    mat.emissiveColor = Color3.FromHexString('#1a120c');
    mat.specularColor = Color3.Black();
    for (let i = 0; i < POOL_SIZE; i++) {
      const mesh = MeshBuilder.CreateIcoSphere(
        `impact-${i}`,
        { radius: 0.06, subdivisions: 1 },
        scene,
      );
      mesh.material = mat;
      mesh.isPickable = false;
      mesh.setEnabled(false);
      this.pool.push({ mesh, ageMs: LIFETIME_MS });
    }
  }

  spawn(point: Vector3): void {
    const impact = this.pool[this.next] as Impact;
    this.next = (this.next + 1) % this.pool.length;
    impact.mesh.position.copyFrom(point);
    impact.mesh.scaling.setAll(1);
    impact.mesh.setEnabled(true);
    impact.ageMs = 0;
  }

  update(dtMs: number): void {
    for (const impact of this.pool) {
      if (impact.ageMs >= LIFETIME_MS) continue;
      impact.ageMs += dtMs;
      const remaining = 1 - impact.ageMs / LIFETIME_MS;
      if (remaining <= 0) {
        impact.mesh.setEnabled(false);
      } else {
        impact.mesh.scaling.setAll(0.4 + 0.6 * remaining);
      }
    }
  }
}
