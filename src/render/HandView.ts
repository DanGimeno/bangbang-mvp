import {
  Color3,
  MeshBuilder,
  PointLight,
  StandardMaterial,
  TransformNode,
  Vector3,
  type Camera,
  type Mesh,
  type Scene,
} from '@babylonjs/core';
import type { HandPose, WeaponDef } from '../weapons/weaponDefs';

/** Draw the hands after the world, so they never clip into walls. */
const VIEW_RENDERING_GROUP = 1;
const FLASH_MS = 55;
const SWITCH_MS = 220;

type FingerShape = 'point' | 'double' | 'fist';

interface Hand {
  root: TransformNode;
  thumb: TransformNode;
  tip: TransformNode;
}

interface Rig {
  root: TransformNode;
  restPosition: Vector3;
  restRotation: Vector3;
  /** Thumbs that drop like a hammer when firing. */
  thumbs: TransformNode[];
  /** Where the muzzle flash appears. For the Automatic Nothing: thin air. */
  muzzle: TransformNode;
}

interface Materials {
  skin: StandardMaterial;
  sleeve: StandardMaterial;
  cuff: StandardMaterial;
  flash: StandardMaterial;
}

/**
 * First-person view model: low-poly hands posing as weapons.
 * There are no guns. The hands are taken extremely seriously.
 */
export class HandView {
  private readonly rigs = new Map<HandPose, Rig>();
  private readonly flash: Mesh;
  private readonly flashLight: PointLight;
  private current: Rig;
  private kick = 0;
  private thumbDrop = 0;
  private flashMs = 0;
  private switchMs = 0;
  private bobPhase = 0;

  constructor(
    private readonly scene: Scene,
    camera: Camera,
    initial: WeaponDef,
  ) {
    const mats = createMaterials(scene);
    const attach = new TransformNode('view-model', scene);
    attach.parent = camera;

    this.rigs.set('finger-gun', this.buildFingerGun(mats, attach));
    this.rigs.set('double-barrel', this.buildDoubleBarrel(mats, attach));
    this.rigs.set('empty-hands', this.buildEmptyHands(mats, attach));

    this.flash = MeshBuilder.CreateDisc('muzzle-flash', { radius: 0.05, tessellation: 7 }, scene);
    this.flash.material = mats.flash;
    this.flash.renderingGroupId = VIEW_RENDERING_GROUP;
    this.flash.isPickable = false;
    this.flash.setEnabled(false);
    this.flashLight = new PointLight('muzzle-light', Vector3.Zero(), scene);
    this.flashLight.diffuse = Color3.FromHexString('#ffd36b');
    this.flashLight.range = 8;
    this.flashLight.intensity = 0;

    this.current = this.rigFor(initial);
    for (const rig of this.rigs.values()) rig.root.setEnabled(rig === this.current);
  }

  equip(def: WeaponDef): void {
    this.current = this.rigFor(def);
    for (const rig of this.rigs.values()) rig.root.setEnabled(rig === this.current);
    this.switchMs = SWITCH_MS;
    this.kick = 0;
  }

  onFire(def: WeaponDef): void {
    this.kick = Math.min(1.5, this.kick + def.recoilKick);
    this.thumbDrop = 1;
    this.flashMs = FLASH_MS;
    this.flash.parent = this.current.muzzle;
    this.flash.position.setAll(0);
    this.flash.rotation.z = Math.random() * Math.PI;
    this.flash.scaling.setAll((0.8 + Math.random() * 0.5) * (def.pellets > 1 ? 1.8 : 1));
    this.flashLight.parent = this.current.muzzle;
    this.flashLight.position.set(0, 0, 0.05);
  }

  update(dtMs: number, moving: boolean): void {
    const dt = dtMs / 1000;
    const rig = this.current;
    this.kick *= Math.exp(-12 * dt);
    this.thumbDrop *= Math.exp(-14 * dt);
    this.flashMs = Math.max(0, this.flashMs - dtMs);
    this.switchMs = Math.max(0, this.switchMs - dtMs);
    if (moving) this.bobPhase += dt * 9;

    const lower = this.switchMs / SWITCH_MS;
    const bob = moving ? Math.sin(this.bobPhase) * 0.008 : 0;
    const sway = moving ? Math.cos(this.bobPhase * 0.5) * 0.006 : 0;

    rig.root.position.set(
      rig.restPosition.x + sway,
      rig.restPosition.y + bob - lower * 0.3,
      rig.restPosition.z - this.kick * 0.04,
    );
    rig.root.rotation.set(
      // The wrist flicks upwards on recoil, as tradition demands.
      rig.restRotation.x - this.kick * 0.4,
      rig.restRotation.y,
      rig.restRotation.z,
    );
    for (const thumb of rig.thumbs) thumb.rotation.x = this.thumbDrop * 1.1;

    const flashing = this.flashMs > 0;
    this.flash.setEnabled(flashing);
    this.flashLight.intensity = flashing ? 1.6 : 0;
  }

  private rigFor(def: WeaponDef): Rig {
    const rig = this.rigs.get(def.viewModel);
    if (!rig) throw new Error(`No view model for pose ${def.viewModel}`);
    return rig;
  }

  private buildFingerGun(mats: Materials, parent: TransformNode): Rig {
    const root = this.rigRoot('rig-finger-gun', parent, new Vector3(0.17, -0.17, 0.55), -0.04);
    const hand = buildHand(this.scene, mats, 'fg-right', 'point', 1);
    hand.root.parent = root;
    return this.finishRig(root, [hand.thumb], hand.tip);
  }

  private buildDoubleBarrel(mats: Materials, parent: TransformNode): Rig {
    const root = this.rigRoot('rig-double-barrel', parent, new Vector3(0.16, -0.17, 0.55), -0.035);
    const right = buildHand(this.scene, mats, 'db-right', 'double', 1);
    right.root.parent = root;
    // Two-handed stance: the left hand cups the right one, for stability.
    const left = buildHand(this.scene, mats, 'db-left', 'fist', -1);
    left.root.parent = root;
    left.root.position.set(-0.02, -0.06, -0.01);
    left.root.rotation.set(0, 0.2, -1.3);
    return this.finishRig(root, [right.thumb], right.tip);
  }

  private buildEmptyHands(mats: Materials, parent: TransformNode): Rig {
    const root = this.rigRoot('rig-empty-hands', parent, new Vector3(0, 0, 0), 0, 0);
    // Trigger hand, gripping an imaginary pistol grip.
    const right = buildHand(this.scene, mats, 'eh-right', 'fist', 1);
    right.root.parent = root;
    right.root.position.set(0.19, -0.22, 0.5);
    right.root.rotation.set(0.1, -0.08, 0);
    // Support hand under an imaginary handguard, palm up.
    const left = buildHand(this.scene, mats, 'eh-left', 'fist', -1);
    left.root.parent = root;
    left.root.position.set(0.07, -0.2, 0.82);
    left.root.rotation.set(0.05, 0.1, 1.2);
    // The muzzle is where the barrel would be, if there were a barrel.
    const muzzle = new TransformNode('eh-muzzle', this.scene);
    muzzle.parent = root;
    muzzle.position.set(0.1, -0.15, 1.15);
    return this.finishRig(root, [], muzzle);
  }

  private rigRoot(
    name: string,
    parent: TransformNode,
    rest: Vector3,
    yaw: number,
    roll = -0.2,
  ): TransformNode {
    const root = new TransformNode(name, this.scene);
    root.parent = parent;
    root.position.copyFrom(rest);
    root.rotation.set(-0.1, yaw, roll);
    return root;
  }

  private finishRig(root: TransformNode, thumbs: TransformNode[], muzzle: TransformNode): Rig {
    for (const mesh of root.getChildMeshes()) {
      mesh.renderingGroupId = VIEW_RENDERING_GROUP;
      mesh.isPickable = false;
    }
    return {
      root,
      restPosition: root.position.clone(),
      restRotation: root.rotation.clone(),
      thumbs,
      muzzle,
    };
  }
}

function createMaterials(scene: Scene): Materials {
  const make = (name: string, hex: string, emissive = 0.18) => {
    const mat = new StandardMaterial(name, scene);
    mat.diffuseColor = Color3.FromHexString(hex);
    mat.emissiveColor = Color3.FromHexString(hex).scale(emissive);
    mat.specularColor = Color3.Black();
    return mat;
  };
  const flash = make('flash', '#ffd36b', 1);
  flash.disableLighting = true;
  flash.emissiveColor = Color3.FromHexString('#ffe9a8');
  flash.backFaceCulling = false;
  return {
    skin: make('skin', '#f1b98c'),
    sleeve: make('sleeve', '#2f4f7a'),
    cuff: make('cuff', '#f4ede1'),
    flash,
  };
}

/**
 * A low-poly hand pointing along +Z with the palm vertical (thumb up).
 * `side` = 1 for a right hand, -1 for a left hand (mirrored on X).
 */
function buildHand(
  scene: Scene,
  mats: Materials,
  name: string,
  shape: FingerShape,
  side: 1 | -1,
): Hand {
  const root = new TransformNode(name, scene);
  const part = (mesh: Mesh, mat: StandardMaterial, x: number, y: number, z: number) => {
    mesh.parent = root;
    mesh.position.set(x * side, y, z);
    mesh.material = mat;
    return mesh;
  };
  const finger = (id: string, length: number) => {
    const mesh = MeshBuilder.CreateCylinder(
      `${name}-${id}`,
      { diameter: 0.022, height: length, tessellation: 6 },
      scene,
    );
    mesh.rotation.x = Math.PI / 2;
    return mesh;
  };

  part(
    MeshBuilder.CreateBox(`${name}-sleeve`, { width: 0.046, height: 0.05, depth: 0.08 }, scene),
    mats.sleeve,
    0,
    -0.014,
    -0.095,
  );
  part(
    MeshBuilder.CreateBox(`${name}-cuff`, { width: 0.052, height: 0.056, depth: 0.02 }, scene),
    mats.cuff,
    0,
    -0.008,
    -0.06,
  );
  part(
    MeshBuilder.CreateBox(`${name}-palm`, { width: 0.04, height: 0.085, depth: 0.09 }, scene),
    mats.skin,
    0,
    0,
    0,
  );

  // Fingers. Extended ones are hexagonal prisms; curled ones are one chunky block.
  if (shape === 'point' || shape === 'double') {
    part(finger('index', 0.09), mats.skin, 0, 0.029, 0.088);
  }
  if (shape === 'double') {
    part(finger('middle', 0.088), mats.skin, 0, 0.006, 0.087);
  }
  const curledTop = shape === 'point' ? 0.016 : shape === 'double' ? -0.006 : 0.04;
  const curledBottom = -0.042;
  const curledHeight = curledTop - curledBottom;
  part(
    MeshBuilder.CreateBox(
      `${name}-curled`,
      { width: 0.036, height: curledHeight, depth: 0.036 },
      scene,
    ),
    mats.skin,
    0.002,
    curledBottom + curledHeight / 2,
    0.06,
  );

  // Thumb: points up like a hammer; pivots at its base.
  const thumb = new TransformNode(`${name}-thumb-pivot`, scene);
  thumb.parent = root;
  thumb.position.set(-0.016 * side, 0.03, -0.012);
  const thumbMesh = MeshBuilder.CreateCylinder(
    `${name}-thumb`,
    { diameter: 0.022, height: 0.055, tessellation: 6 },
    scene,
  );
  thumbMesh.parent = thumb;
  thumbMesh.position.y = 0.026;
  thumbMesh.material = mats.skin;
  if (shape === 'fist') {
    // Wrapped around the imaginary grip.
    thumbMesh.rotation.x = 1.3;
    thumbMesh.position.set(0, 0.012, 0.03);
  }

  const tip = new TransformNode(`${name}-tip`, scene);
  tip.parent = root;
  tip.position.set(0, shape === 'double' ? 0.018 : 0.029, 0.14);

  return { root, thumb, tip };
}
