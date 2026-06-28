import fs from 'node:fs';
import path from 'node:path';
import { createPlayerRig } from '../prototype/3d/src/player/rig.js';

const repoRoot = process.cwd();
const mainJs = fs.readFileSync(path.join(repoRoot, 'prototype/3d/src/main.js'), 'utf8');
const characterPoseJs = fs.readFileSync(path.join(repoRoot, 'prototype/3d/src/player/characterPose.js'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function nearly(actual, expected, message, epsilon = 1e-9) {
  if (Math.abs(actual - expected) > epsilon) {
    throw new Error(`${message}: got ${actual}, expected ${expected}`);
  }
}

class FakeVector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }
}

class FakeEuler extends FakeVector3 {}

class FakeObject3D {
  constructor() {
    this.children = [];
    this.parent = null;
    this.position = new FakeVector3();
    this.rotation = new FakeEuler();
    this.visible = true;
    this.userData = {};
  }

  add(child) {
    child.parent = this;
    this.children.push(child);
    return this;
  }
}

class FakeGroup extends FakeObject3D {}

class FakeMesh extends FakeObject3D {
  constructor(geometry, material) {
    super();
    this.geometry = geometry;
    this.material = material;
    this.castShadow = false;
    this.receiveShadow = false;
    this.isMesh = true;
  }
}

class FakeGeometry {
  constructor(type, args) {
    this.type = type;
    this.args = args;
  }
}

class FakeMaterial {
  constructor(options) {
    this.options = options;
    Object.assign(this, options);
  }
}

const THREE = {
  AdditiveBlending: 'AdditiveBlending',
  Object3D: FakeObject3D,
  Group: FakeGroup,
  Mesh: FakeMesh,
  BoxGeometry: class extends FakeGeometry {
    constructor(width, height, depth) {
      super('BoxGeometry', [width, height, depth]);
    }
  },
  SphereGeometry: class extends FakeGeometry {
    constructor(radius, widthSegments, heightSegments) {
      super('SphereGeometry', [radius, widthSegments, heightSegments]);
    }
  },
  TorusGeometry: class extends FakeGeometry {
    constructor(radius, tube, radialSegments, tubularSegments) {
      super('TorusGeometry', [radius, tube, radialSegments, tubularSegments]);
    }
  },
  MeshStandardMaterial: class extends FakeMaterial {},
  MeshBasicMaterial: class extends FakeMaterial {},
};

function assertVector(vector, expected, label) {
  nearly(vector.x, expected[0], `${label}.x`);
  nearly(vector.y, expected[1], `${label}.y`);
  nearly(vector.z, expected[2], `${label}.z`);
}

function assertBox(mesh, expected, label) {
  assert(mesh.geometry.type === 'BoxGeometry', `${label} should use BoxGeometry`);
  for (let i = 0; i < expected.length; i += 1) {
    nearly(mesh.geometry.args[i], expected[i], `${label}.geometry.args[${i}]`);
  }
}

const rig = createPlayerRig({ THREE });

const expectedFields = [
  'char',
  'yaw',
  'body',
  'chest',
  'headGrp',
  'RArm',
  'LArm',
  'RLeg',
  'LLeg',
  'rWrist',
  'weaponSocket',
  'weapon',
  'weaponTip',
  'jupiterBall',
  'chargeAura',
  'chargeAuraMat',
  'gripDefault',
  'gripSpear',
  'dimensions',
];
for (const field of expectedFields) {
  assert(rig[field] !== undefined, `createPlayerRig should return ${field}`);
}

assert(rig.char.children[0] === rig.yaw, 'char should parent yaw');
assert(rig.yaw.children[0] === rig.body, 'yaw should parent body');
assert(rig.chest.parent === rig.body, 'body should parent chest');
assert(rig.headGrp.parent === rig.chest, 'chest should parent headGrp');

assertVector(rig.RArm.root.position, [-0.725, 0.95, 0], 'RArm.root.position');
assertVector(rig.LArm.root.position, [0.725, 0.95, 0], 'LArm.root.position');
assertVector(rig.RLeg.root.position, [-0.3, 1.5, 0], 'RLeg.root.position');
assertVector(rig.LLeg.root.position, [0.3, 1.5, 0], 'LLeg.root.position');
assertVector(rig.RArm.j2.position, [0, -0.6, 0], 'RArm.j2.position');
assertVector(rig.RLeg.j2.position, [0, -0.78, 0], 'RLeg.j2.position');

assertBox(rig.RArm.root.children[0], [0.26, 0.6, 0.26], 'RArm upper');
assertBox(rig.RArm.j2.children[0], [0.234, 0.56, 0.234], 'RArm lower');
assertBox(rig.RLeg.root.children[0], [0.3, 0.78, 0.3], 'RLeg upper');
assertBox(rig.RLeg.j2.children[0], [0.27, 0.58, 0.27], 'RLeg lower');
assertBox(rig.RLeg.j2.children[1], [0.44, 0.12, 0.64], 'RLeg foot');

assertVector(rig.rWrist.position, [0, -0.56, 0], 'rWrist.position');
assert(rig.rWrist.parent === rig.RArm.j2, 'right wrist should hang from physical right arm lower joint');
assertVector(rig.weaponSocket.position, [0, 0, 0.06], 'weaponSocket.position');
nearly(rig.weaponSocket.rotation.x, Math.PI * 0.5 - 0.35, 'weaponSocket.rotation.x');
nearly(rig.gripDefault, Math.PI * 0.5 - 0.35, 'gripDefault');
nearly(rig.gripSpear, Math.PI, 'gripSpear');

assert(rig.weaponSocket.children.includes(rig.weapon), 'weaponSocket should hold the initial sword');
assert(rig.weapon.userData.tipRef === rig.weaponTip, 'weapon tipRef should be returned as weaponTip');
nearly(rig.weapon.userData.bladeLen, 1.86, 'weapon blade length');
assertVector(rig.weaponTip.position, [0, 1.86, 0], 'weaponTip.position');
assertBox(rig.weapon.children[0], [0.1, 0.34, 0.1], 'sword grip');
assertBox(rig.weapon.children[1], [0.42, 0.08, 0.14], 'sword guard');
assertBox(rig.weapon.children[2], [0.12, 1.5, 0.05], 'sword blade');
assertBox(rig.weapon.children[3], [0.12, 0.16, 0.05], 'sword tip');
nearly(rig.weapon.children[0].position.y, 0.02, 'sword grip position.y');
nearly(rig.weapon.children[1].position.y, 0.2, 'sword guard position.y');
nearly(rig.weapon.children[2].position.y, 0.98, 'sword blade position.y');
nearly(rig.weapon.children[3].position.y, 1.78, 'sword tip position.y');

assert(rig.jupiterBall.visible === false, 'jupiterBall should start hidden');
assert(rig.jupiterBall.children.length === 2, 'jupiterBall should keep two orbit groups');
assertBox(rig.jupiterBall.children[0].children[0], [0.12, 2.1, 0.07], 'jupiter sword 1');
assertBox(rig.jupiterBall.children[1].children[0], [0.12, 2.1, 0.07], 'jupiter sword 2');
assert(rig.jupiterBall.children[0].children[0].material.color === 0xeaeaea, 'jupiter sword 1 color');
assert(rig.jupiterBall.children[0].children[0].material.emissive === 0x8888aa, 'jupiter sword 1 emissive');
assert(rig.jupiterBall.children[1].children[0].material.color === 0x3f6fb0, 'jupiter sword 2 color');
assert(rig.jupiterBall.children[1].children[0].material.emissive === 0x2244aa, 'jupiter sword 2 emissive');

assert(rig.chargeAura.parent === rig.body, 'chargeAura should hang from body');
assert(rig.chargeAura.visible === false, 'chargeAura should start hidden');
assert(rig.chargeAura.geometry.type === 'SphereGeometry', 'chargeAura should use SphereGeometry');
assertVector(rig.chargeAura.position, [0, 1.6, 0], 'chargeAura.position');
for (const [index, value] of [1.3, 16, 12].entries()) {
  nearly(rig.chargeAura.geometry.args[index], value, `chargeAura geometry arg ${index}`);
}
assert(rig.chargeAuraMat.color === 0xffe85a, 'chargeAura material color');
assert(rig.chargeAuraMat.transparent === true, 'chargeAura material transparent');
assert(rig.chargeAuraMat.opacity === 0, 'chargeAura material opacity');
assert(rig.chargeAuraMat.depthWrite === false, 'chargeAura material depthWrite');
assert(rig.chargeAuraMat.blending === THREE.AdditiveBlending, 'chargeAura material blending');

const expectedDimensions = {
  THIGH: 0.78,
  SHIN: 0.72,
  UPARM: 0.6,
  FOREARM: 0.56,
  ARM_W: 0.26,
  LEG_W: 0.3,
  CHEST_H: 1.0,
  HIP_Y: 1.5,
  SHO_LOCAL: 0.95,
  SHO_X: 0.725,
  TOTAL_H: 3.3,
};
for (const [key, value] of Object.entries(expectedDimensions)) {
  nearly(rig.dimensions[key], value, `dimensions.${key}`);
}

assert(mainJs.includes('import { createPlayerRig } from "./player/rig.js";'), 'main.js must import createPlayerRig');
assert(mainJs.includes('} = createPlayerRig({ THREE });'), 'main.js must construct player rig through createPlayerRig');
assert(/scene\.add\s*\(\s*char\s*\)\s*;\s*scene\.add\s*\(\s*jupiterBall\s*\)/.test(mainJs), 'main.js must add char and jupiterBall to the scene');
assert(/const\s+\{[\s\S]*char[\s\S]*yaw[\s\S]*body[\s\S]*chest[\s\S]*headGrp[\s\S]*RArm[\s\S]*LArm[\s\S]*RLeg[\s\S]*LLeg[\s\S]*rWrist[\s\S]*weaponSocket[\s\S]*weapon[\s\S]*weaponTip[\s\S]*jupiterBall[\s\S]*chargeAura[\s\S]*chargeAuraMat[\s\S]*gripDefault\s*:\s*GRIP_DEFAULT[\s\S]*gripSpear\s*:\s*GRIP_SPEAR[\s\S]*\}\s*=\s*createPlayerRig/.test(mainJs), 'main.js must destructure the stable rig surface');
assert(/\bconst\s+attackBursts\s*=\s*createAttackBursts\s*\(\s*\{\s*THREE\s*,\s*yaw\s*,/.test(mainJs), 'attack bursts should keep using rig yaw');
assert(/getYawRotationY\s*:\s*\(\s*\)\s*=>\s*yaw\.rotation\.y/.test(mainJs), 'ghost afterimages should keep using rig yaw');
assert(/\bconst\s+swordTrail\s*=\s*createSwordTrail\s*\(\s*\{\s*THREE\s*,\s*scene\s*,\s*weapon\s*,\s*weaponTip\s*\}\s*\)/.test(mainJs), 'sword trail should use rig weapon and weaponTip');
assert(/rig\s*:\s*\{\s*RArm\s*,\s*LArm\s*,\s*RLeg\s*,\s*LLeg\s*,\s*chest\s*,\s*headGrp\s*,\s*rWrist\s*,\s*body\s*\}/.test(mainJs), 'pose clip controller should receive the rig joints');
assert(/createCharacterPoseController\s*\(\s*\{[\s\S]*gripDefault\s*:\s*GRIP_DEFAULT[\s\S]*gripSpear\s*:\s*GRIP_SPEAR/.test(mainJs), 'main.js should pass rig grip constants to character pose');
assert(/weaponSocket\.rotation\.x\s*=\s*gripDefault\s*\+\s*\(gripSpear\s*-\s*gripDefault\)\s*\*\s*gm/.test(characterPoseJs), 'character pose should use rig grip constants');

assert(!mainJs.includes('const SKIN='), 'main.js should not retain inline player color constants');
assert(!mainJs.includes('function jointedLimb'), 'main.js should not retain inline limb builder');
assert(!mainJs.includes('function makeSword'), 'main.js should not retain inline sword builder');
assert(!mainJs.includes('const char=new THREE.Group'), 'main.js should not retain inline char root');
assert(!mainJs.includes('const weaponSocket=new THREE.Group'), 'main.js should not retain inline weapon socket');
assert(!mainJs.includes('const chargeAuraMat='), 'main.js should not retain inline charge aura material');

console.log('Player rig check passed.');
