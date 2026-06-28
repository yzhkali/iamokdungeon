import fs from 'node:fs';
import path from 'node:path';
import { createStompEffects, STOMP_RADIUS } from '../prototype/3d/src/combat/stompEffects.js';

const repoRoot = process.cwd();
const mainJs = fs.readFileSync(path.join(repoRoot, 'prototype/3d/src/main.js'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function nearly(actual, expected, message, epsilon = 1e-6) {
  if (Math.abs(actual - expected) > epsilon) {
    throw new Error(`${message}: got ${actual}, expected ${expected}`);
  }
}

class FakeShape {
  constructor() {
    this.ops = [];
  }

  moveTo(...args) { this.ops.push(['moveTo', ...args]); }
  lineTo(...args) { this.ops.push(['lineTo', ...args]); }
  closePath() { this.ops.push(['closePath']); }
}

class FakeGeometry {
  constructor(...args) {
    this.args = args;
  }
}

class FakeMaterial {
  constructor(options) {
    this.options = options;
    this.opacity = options.opacity;
    this.polygonOffset = false;
    this.polygonOffsetFactor = 0;
    this.polygonOffsetUnits = 0;
  }
}

class FakeTransform {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.z = 0;
  }

  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
}

class FakeGroup {
  constructor() {
    this.children = [];
    this.position = new FakeTransform();
  }

  add(child) {
    this.children.push(child);
  }
}

class FakeMesh {
  constructor(geometry, material) {
    this.geometry = geometry;
    this.material = material;
    this.position = new FakeTransform();
    this.rotation = new FakeTransform();
    this.castShadow = false;
  }
}

const THREE = {
  DoubleSide: 'DoubleSide',
  Shape: FakeShape,
  ShapeGeometry: FakeGeometry,
  TetrahedronGeometry: FakeGeometry,
  BoxGeometry: FakeGeometry,
  MeshBasicMaterial: FakeMaterial,
  MeshStandardMaterial: FakeMaterial,
  Group: FakeGroup,
  Mesh: FakeMesh,
};

function createRandom(values = []) {
  let index = 0;
  return () => values[index++] ?? 0.5;
}

function createFixture({
  randomValues = [],
  player = { x: 4, z: -2 },
  hittables = [
    { x: 5, z: -2, r: 0.5 },
    { x: 20, z: -2, r: 0.5 },
  ],
  dummies = [
    { x: 4, z: 0, r: 0.5, tiltVel: 1 },
    { x: -20, z: 0, r: 0.5, tiltVel: 1 },
  ],
} = {}) {
  const added = [];
  const removed = [];
  const trace = [];
  const scene = {
    add(object) { added.push(object); },
    remove(object) { removed.push(object); },
  };
  const stompEffects = createStompEffects({
    THREE,
    scene,
    getPlayer: () => player,
    getHittables: () => hittables,
    getDummies: () => dummies,
    playStomp: () => trace.push('sfx'),
    boostImpact: () => trace.push('impact'),
    random: createRandom(randomValues),
  });
  return { added, removed, trace, stompEffects, player, hittables, dummies };
}

{
  const { added, stompEffects } = createFixture();
  assert(STOMP_RADIUS === 3.2, 'stomp radius export should stay 3.2');
  assert(stompEffects.STOMP_R === 3.2, 'controller stomp radius alias should stay 3.2');

  const crater = stompEffects.spawnCrater(10, -4);
  assert(added.length === 1 && added[0] === crater.grp, 'spawnCrater should add one group to the scene');
  nearly(crater.grp.position.x, 10, 'crater x');
  nearly(crater.grp.position.y, 0, 'crater y');
  nearly(crater.grp.position.z, -4, 'crater z');
  assert(crater.grp.children.length === 2, 'crater should keep rim and inner disc meshes only');
  assert(crater.mats.length === 2, 'crater should register two fading materials');

  const [rim, disc] = crater.grp.children;
  assert(rim.material.options.color === 0x3a2a1c, 'rim color should stay unchanged');
  assert(rim.material.options.transparent === true, 'rim should be transparent');
  assert(rim.material.options.opacity === 0.5, 'rim opacity should stay unchanged');
  assert(rim.material.options.side === THREE.DoubleSide, 'rim should be double-sided');
  assert(rim.material.options.depthWrite === false, 'rim should not write depth');
  assert(rim.material.polygonOffset === true, 'rim should use polygon offset');
  assert(rim.material.polygonOffsetFactor === -1, 'rim polygon offset factor should stay -1');
  assert(rim.material.polygonOffsetUnits === -1, 'rim polygon offset units should stay -1');
  nearly(rim.rotation.x, -Math.PI / 2, 'rim should lie flat');
  nearly(rim.position.y, 0.03, 'rim y offset');

  assert(disc.material.options.color === 0x120d0a, 'disc color should stay unchanged');
  assert(disc.material.options.opacity === 0.62, 'disc opacity should stay unchanged');
  assert(disc.material.options.transparent === true, 'disc should be transparent');
  assert(disc.material.options.side === THREE.DoubleSide, 'disc should be double-sided');
  assert(disc.material.options.depthWrite === false, 'disc should not write depth');
  assert(disc.material.polygonOffset === true, 'disc should use polygon offset');
  assert(disc.material.polygonOffsetFactor === -2, 'disc polygon offset factor should stay -2');
  assert(disc.material.polygonOffsetUnits === -2, 'disc polygon offset units should stay -2');
  nearly(disc.rotation.x, -Math.PI / 2, 'disc should lie flat');
  nearly(disc.position.y, 0.032, 'disc y offset');
}

{
  const { added, stompEffects } = createFixture({ randomValues: Array(200).fill(0.5) });
  const bits = stompEffects.spawnDebris(10, -4);
  assert(bits.length === 11, 'spawnDebris should create exactly 11 debris bits');
  assert(added.length === 11, 'spawnDebris should add every debris mesh to the scene');
  for (const bit of bits) {
    assert(bit.mesh.castShadow === true, 'debris should cast shadows');
    assert(bit.mat.options.color === 0x6b5a44, 'debris color should stay unchanged');
    assert(bit.mat.options.roughness === 0.95, 'debris roughness should stay unchanged');
    assert(bit.mat.options.transparent === true, 'debris should be transparent');
    assert(bit.mat.options.opacity === 1, 'debris should start fully opaque');
    assert(Number.isFinite(bit.vx) && Number.isFinite(bit.vy) && Number.isFinite(bit.vz), 'debris velocity should be finite');
    assert(Number.isFinite(bit.sx) && Number.isFinite(bit.sy) && Number.isFinite(bit.sz), 'debris spin should be finite');
    assert(Number.isFinite(bit.rest), 'debris rest height should be finite');
    assert(bit.settled === false, 'debris should start unsettled');
  }
}

{
  const { added, trace, stompEffects, hittables, dummies } = createFixture({ randomValues: Array(300).fill(0.5) });
  stompEffects.doStomp();
  assert(JSON.stringify(trace) === JSON.stringify(['sfx', 'impact']), 'doStomp should play SFX before impact boost');
  assert(added.length === 12, 'doStomp should spawn one crater group plus 11 debris meshes');
  assert(hittables[0].flashT === 0.2 && hittables[0].shakeT === 0.28, 'in-range hittable should get stomp feedback');
  assert(hittables[1].flashT === undefined && hittables[1].shakeT === undefined, 'out-of-range hittable should be unchanged');
  assert(dummies[0].flashT === 0.3 && dummies[0].tiltVel === 13, 'in-range dummy should flash and receive tilt impulse');
  assert(dummies[1].flashT === undefined && dummies[1].tiltVel === 1, 'out-of-range dummy should be unchanged');
}

{
  const { added, removed, stompEffects } = createFixture({ randomValues: Array(300).fill(0.5) });
  const mark = stompEffects.spawnStompMark(0, 0);
  assert(added.length === 12, 'spawnStompMark should add crater and debris');

  const bit = mark.bits[0];
  nearly(bit.vy, 6.75, 'deterministic debris vertical velocity');
  stompEffects.update(0.5);
  nearly(bit.mesh.position.y, bit.rest, 'first ground hit should clamp debris to rest height');
  nearly(bit.vy, 1.7, 'first bounce should apply vertical damping');
  nearly(bit.vz, -4.45 * 0.55, 'first bounce should apply horizontal damping');
  assert(bit.settled === false, 'first hard bounce should not settle debris');

  stompEffects.update(0.149);
  assert(bit.settled === true, 'low-energy contact should settle debris');
  nearly(bit.vx, 0, 'settled debris should stop x movement');
  nearly(bit.vz, 0, 'settled debris should stop z movement');

  stompEffects.update(9.351);
  nearly(mark.mats[0].m.opacity, 0.5, 'rim should keep base opacity through 10 seconds');
  nearly(mark.bits[0].mat.opacity, 1, 'debris should keep full opacity through 10 seconds');
  stompEffects.update(2.5);
  nearly(mark.mats[0].m.opacity, 0.25, 'rim should fade to half base opacity at 12.5 seconds');
  nearly(mark.bits[0].mat.opacity, 0.5, 'debris should fade to half opacity at 12.5 seconds');
  stompEffects.update(2.5);
  assert(removed.length === 12, 'stomp mark should remove crater group and every debris mesh at 15 seconds');
  assert(removed[0] === mark.grp, 'crater group should be removed before debris meshes');
}

assert(mainJs.includes('import { createStompEffects, STOMP_RADIUS } from "./combat/stompEffects.js";'), 'main.js must import stomp effects module');
assert(/\bconst\s+STOMP_R\s*=\s*STOMP_RADIUS\s*;/.test(mainJs), 'main.js must keep named stomp radius alias for AoE comments and checks');
assert(/\bconst\s+stompEffects\s*=\s*createStompEffects\s*\(\s*\{[\s\S]*\bTHREE\b[\s\S]*\bscene\b[\s\S]*getPlayer\s*:\s*\(\s*\)\s*=>\s*P[\s\S]*getHittables\s*:\s*\(\s*\)\s*=>\s*hittables[\s\S]*getDummies\s*:\s*\(\s*\)\s*=>\s*dummies[\s\S]*playStomp\s*:\s*\(\s*\)\s*=>\s*SFX\.stomp\(\)[\s\S]*boostImpact\s*:\s*\(\s*\)\s*=>\s*\{\s*hitstop\s*=\s*Math\.max\s*\(\s*hitstop\s*,\s*0\.12\s*\)\s*;\s*shake\s*=\s*Math\.max\s*\(\s*shake\s*,\s*0\.45\s*\)\s*;?\s*\}[\s\S]*\}\s*\)/.test(mainJs), 'main.js must create stompEffects with live scene/player/target/SFX dependencies');
assert(/case\s+['"]stomp['"]\s*:\s*stompEffects\.doStomp\s*\(\s*\)\s*;\s*break/.test(mainJs), 'stomp fireFx must delegate to stomp effects');
assert(/case\s+['"]drill['"]\s*:\s*hitstop\s*=\s*0\.14\s*;\s*shake\s*=\s*0\.6\s*;\s*stompEffects\.doStomp\s*\(\s*\)\s*;\s*P\._drillBounce\s*=\s*4\.5\s*;\s*break/.test(mainJs), 'drill fireFx must preserve impact, stomp, bounce order');
assert(/spaceSlash\.update\s*\(\s*dt\s*\)\s*;\s*stompEffects\.updateStomps\s*\(\s*dt\s*\)\s*;/.test(mainJs), 'effect update order must keep stomp effects after space slash');
assert(!mainJs.includes('const stompMarks=[]'), 'main.js should not retain inline stomp mark state');
assert(!mainJs.includes('function irregularShape'), 'main.js should not retain inline crater shape helper');
assert(!mainJs.includes('function addCrack'), 'main.js should not retain inline unused crater crack helper');
assert(!mainJs.includes('function spawnCrater'), 'main.js should not retain inline spawnCrater');
assert(!mainJs.includes('function spawnDebris'), 'main.js should not retain inline spawnDebris');
assert(!mainJs.includes('function doStomp'), 'main.js should not retain inline doStomp');
assert(!mainJs.includes('function updateStomps'), 'main.js should not retain inline updateStomps');

console.log('Stomp effects check passed.');
