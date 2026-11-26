import {
  Color3,
  Color4,
  DirectionalLight,
  HemisphericLight,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
  type Mesh,
} from '@babylonjs/core';
import type { Bounds } from '../player/movement';

export interface RangeInfo {
  bounds: Bounds;
  spawn: { x: number; z: number };
}

/** Metadata tag for static geometry that shots can impact. */
export const SURFACE_METADATA = { kind: 'surface' } as const;

function material(scene: Scene, name: string, hex: string): StandardMaterial {
  const mat = new StandardMaterial(name, scene);
  mat.diffuseColor = Color3.FromHexString(hex);
  mat.specularColor = Color3.Black();
  return mat;
}

function box(
  scene: Scene,
  name: string,
  size: { w: number; h: number; d: number },
  pos: { x: number; y: number; z: number },
  mat: StandardMaterial,
): Mesh {
  const mesh = MeshBuilder.CreateBox(name, { width: size.w, height: size.h, depth: size.d }, scene);
  mesh.position.set(pos.x, pos.y, pos.z);
  mesh.material = mat;
  mesh.metadata = SURFACE_METADATA;
  mesh.freezeWorldMatrix();
  return mesh;
}

/**
 * Builds the low-poly shooting range from primitives. Deliberately crude:
 * the game must be fun with placeholder geometry.
 */
export function buildRange(scene: Scene): RangeInfo {
  scene.clearColor = Color4.FromHexString('#8fd3f4ff');
  scene.ambientColor = new Color3(0.3, 0.3, 0.3);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.008;
  scene.fogColor = Color3.FromHexString('#8fd3f4');

  const hemi = new HemisphericLight('sky', new Vector3(0.2, 1, -0.3), scene);
  hemi.intensity = 0.75;
  hemi.groundColor = Color3.FromHexString('#6b5a4a');
  const sun = new DirectionalLight('sun', new Vector3(-0.4, -1, 0.6), scene);
  sun.intensity = 0.55;

  const sand = material(scene, 'sand', '#e3c58f');
  const wall = material(scene, 'wall', '#3f7f8c');
  const wood = material(scene, 'wood', '#9c6b3f');
  const stripe = material(scene, 'stripe', '#f4ede1');
  const berm = material(scene, 'berm', '#7d6a4f');
  const crate = material(scene, 'crate', '#c98b47');

  const ground = MeshBuilder.CreateGround('ground', { width: 30, height: 72 }, scene);
  ground.position.z = 5;
  ground.material = sand;
  ground.metadata = SURFACE_METADATA;

  // Perimeter walls.
  box(scene, 'wall-left', { w: 0.6, h: 5, d: 72 }, { x: -15.3, y: 2.5, z: 5 }, wall);
  box(scene, 'wall-right', { w: 0.6, h: 5, d: 72 }, { x: 15.3, y: 2.5, z: 5 }, wall);
  box(scene, 'wall-back', { w: 31.2, h: 9, d: 0.6 }, { x: 0, y: 4.5, z: 41.3 }, wall);
  box(scene, 'wall-rear', { w: 31.2, h: 5, d: 0.6 }, { x: 0, y: 2.5, z: -31.3 }, wall);

  // Earth berm behind the targets.
  const bermMesh = MeshBuilder.CreateBox('berm', { width: 30, height: 4, depth: 4 }, scene);
  bermMesh.position.set(0, 1.2, 39);
  bermMesh.rotation.x = -0.5;
  bermMesh.material = berm;
  bermMesh.metadata = SURFACE_METADATA;

  // Firing-line counter and lane markers.
  box(scene, 'counter', { w: 29, h: 1.05, d: 0.7 }, { x: 0, y: 0.525, z: -11 }, wood);
  box(scene, 'counter-top', { w: 29.4, h: 0.08, d: 0.9 }, { x: 0, y: 1.09, z: -11 }, stripe);
  for (const x of [-9, -3, 3, 9]) {
    box(scene, `lane-${x}`, { w: 0.12, h: 0.02, d: 48 }, { x, y: 0.01, z: 14 }, stripe);
  }
  for (const z of [0, 10, 20, 30]) {
    box(scene, `dist-${z}`, { w: 29, h: 0.02, d: 0.15 }, { x: 0, y: 0.011, z }, stripe);
  }

  // A few crates for scale and cover.
  const crates: [number, number, number][] = [
    [-13, -20, 1.2],
    [-12.2, -21.4, 0.9],
    [13, -16, 1.1],
    [12.5, 8, 1.4],
    [-12.6, 22, 1.6],
  ];
  crates.forEach(([x, z, s], i) =>
    box(scene, `crate-${i}`, { w: s, h: s, d: s }, { x, y: s / 2, z }, crate),
  );

  return {
    bounds: { minX: -13.8, maxX: 13.8, minZ: -29.5, maxZ: -11.9 },
    spawn: { x: 0, z: -16 },
  };
}
