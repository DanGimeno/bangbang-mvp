import {
  Color3,
  MeshBuilder,
  StandardMaterial,
  TransformNode,
  type AbstractMesh,
  type Mesh,
  type Scene,
} from '@babylonjs/core';
import { RANGE_TARGETS, type TargetPlacement } from './layout';
import { TargetLogic } from './TargetLogic';

export interface TargetMetadata {
  kind: 'target';
  targetIndex: number;
  /** 0 = bullseye, higher = outer rings. */
  ring: number;
}

export interface TargetHitResult {
  counted: boolean;
  bullseye: boolean;
}

interface TargetEntry {
  logic: TargetLogic;
  pivot: TransformNode;
  faces: Mesh[];
  flashMs: number;
}

const FLASH_MS = 120;
/** Diameter fractions of the rings, outermost first; the last one is the bullseye. */
const RINGS = [1, 0.72, 0.46, 0.2];

export function isTargetMetadata(value: unknown): value is TargetMetadata {
  return (
    typeof value === 'object' && value !== null && (value as { kind?: unknown }).kind === 'target'
  );
}

/** Builds knock-down targets and animates them from their pure TargetLogic state. */
export class TargetManager {
  private readonly targets: TargetEntry[] = [];

  constructor(scene: Scene, placements: readonly TargetPlacement[] = RANGE_TARGETS) {
    const ringMats = ['#f4ede1', '#d8342c', '#f4ede1', '#d8342c'].map((hex, i) => {
      const mat = new StandardMaterial(`ring-${i}`, scene);
      mat.diffuseColor = Color3.FromHexString(hex);
      mat.specularColor = Color3.Black();
      return mat;
    });
    const postMat = new StandardMaterial('post', scene);
    postMat.diffuseColor = Color3.FromHexString('#5b4630');
    postMat.specularColor = Color3.Black();

    placements.forEach((p, index) => {
      const pivot = new TransformNode(`target-${index}`, scene);
      pivot.position.set(p.x, 0, p.z);

      const post = MeshBuilder.CreateBox(
        `target-${index}-post`,
        { width: 0.1, height: p.height, depth: 0.1 },
        scene,
      );
      post.position.y = p.height / 2;
      post.parent = pivot;
      post.material = postMat;
      post.isPickable = false;

      const faces = RINGS.map((fraction, ringIdx) => {
        const ring = RINGS.length - 1 - ringIdx;
        const face = MeshBuilder.CreateCylinder(
          `target-${index}-ring-${ring}`,
          { diameter: p.size * fraction, height: 0.06, tessellation: 16 },
          scene,
        );
        face.rotation.x = Math.PI / 2;
        // Inner rings sit slightly closer to the shooter so they are picked first.
        face.position.set(0, p.height + p.size / 2, -0.01 * ringIdx);
        face.parent = pivot;
        face.material = ringMats[ringIdx] ?? null;
        face.overlayColor = Color3.White();
        face.overlayAlpha = 0.85;
        const metadata: TargetMetadata = { kind: 'target', targetIndex: index, ring };
        face.metadata = metadata;
        return face;
      });

      this.targets.push({ logic: new TargetLogic(), pivot, faces, flashMs: 0 });
    });
  }

  get count(): number {
    return this.targets.length;
  }

  get standingCount(): number {
    return this.targets.filter((t) => t.logic.isHittable).length;
  }

  /** Called by the shooting system with whatever mesh a ray picked. */
  tryHit(mesh: AbstractMesh): TargetHitResult {
    if (!isTargetMetadata(mesh.metadata)) return { counted: false, bullseye: false };
    const entry = this.targets[mesh.metadata.targetIndex];
    if (!entry || !entry.logic.hit()) return { counted: false, bullseye: false };
    entry.flashMs = FLASH_MS;
    return { counted: true, bullseye: mesh.metadata.ring === 0 };
  }

  update(dtMs: number): void {
    for (const entry of this.targets) {
      entry.logic.update(dtMs);
      // Hinged at the base, falls away from the shooter.
      entry.pivot.rotation.x = entry.logic.angle * (Math.PI / 2);
      const flashing = entry.flashMs > 0;
      entry.flashMs = Math.max(0, entry.flashMs - dtMs);
      for (const face of entry.faces) {
        face.renderOverlay = flashing;
        face.isPickable = entry.logic.isHittable;
      }
    }
  }
}
