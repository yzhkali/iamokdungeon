import fs from 'node:fs';
import path from 'node:path';
import { createSwordBeamController } from '../prototype/3d/src/combat/swordBeam.js';

const repoRoot = process.cwd();
const mainJs = fs.readFileSync(path.join(repoRoot, 'prototype/3d/src/main.js'), 'utf8');
const moveTriggersJs = fs.readFileSync(path.join(repoRoot, 'prototype/3d/src/player/moveTriggers.js'), 'utf8');

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
  quadraticCurveTo(...args) { this.ops.push(['quadraticCurveTo', ...args]); }
  closePath() { this.ops.push(['closePath']); }
}

class FakeExtrudeGeometry {
  constructor(shape, options) {
    this.shape = shape;
    this.options = options;
    this.translateCalls = [];
  }

  translate(...args) {
    this.translateCalls.push(args);
  }
}

class FakeBufferAttribute {
  constructor(array, itemSize) {
    this.array = array;
    this.itemSize = itemSize;
    this.needsUpdate = false;
  }
}

class FakeBufferGeometry {
  constructor() {
    this.attributes = {};
    this.index = null;
  }

  setAttribute(name, attribute) {
    this.attributes[name] = attribute;
  }

  setIndex(index) {
    this.index = { array: index };
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
    this.rotation = new FakeTransform();
  }

  add(child) {
    this.children.push(child);
  }
}

class FakeMesh {
  constructor(geometry, material) {
    this.geometry = geometry;
    this.material = material;
    this.rotation = new FakeTransform();
    this.position = new FakeTransform();
    this.scale = new FakeTransform();
    this.scale.y = 1;
    this.frustumCulled = true;
  }
}

const THREE = {
  AdditiveBlending: 'AdditiveBlending',
  DoubleSide: 'DoubleSide',
  Shape: FakeShape,
  ExtrudeGeometry: FakeExtrudeGeometry,
  MeshBasicMaterial: FakeMaterial,
  BufferGeometry: FakeBufferGeometry,
  BufferAttribute: FakeBufferAttribute,
  Group: FakeGroup,
  Mesh: FakeMesh,
};

function createRandom(values = []) {
  let index = 0;
  return () => values[index++] ?? 0.5;
}

function createFixture({ player = { x: 4, z: -3, facing: 0 }, randomValues = [], now = () => 0 } = {}) {
  const added = [];
  const removed = [];
  const scene = {
    add(object) { added.push(object); },
    remove(object) { removed.push(object); },
  };
  const controller = createSwordBeamController({
    THREE,
    scene,
    getPlayer: () => player,
    random: createRandom(randomValues),
    now,
  });
  return { controller, added, removed, player };
}

{
  const { controller, added, player } = createFixture({ player: { x: 4, z: -3, facing: Math.PI / 2 } });
  assert(controller.GRID === 2, 'sword beam grid size should stay 2');
  assert(controller.CRACK_SEGS === 22, 'sword beam crack segment count should stay 22');

  const beam = controller.spawnSwordBeam();
  assert(added.length === 2, 'spawning a sword beam should add beam group and crack mesh');
  assert(added[0] === beam.grp, 'beam group should be added first');
  assert(added[1] === beam.crack.mesh, 'crack mesh should be added with the beam');
  nearly(beam.grp.position.x, player.x + 2, 'beam start x should be one grid cell ahead');
  nearly(beam.grp.position.y, 0.06, 'beam should fly close to ground');
  nearly(beam.grp.position.z, player.z, 'beam start z should follow facing');
  nearly(beam.grp.rotation.y, player.facing, 'beam group should snapshot player facing');
  nearly(beam.fin.rotation.y, -Math.PI / 2, 'fin mesh should rotate shape into travel direction');
  assert(beam.vz === 26, 'beam speed should stay 26');
  assert(beam.life === 1.2, 'beam life should stay 1.2 seconds');
  assert(beam.hitSet instanceof Set, 'beam should keep per-beam hit set');

  const finGeometry = beam.fin.geometry;
  assert(finGeometry.options.depth === 0.1 && finGeometry.options.bevelEnabled === false, 'fin geometry should keep extrude settings');
  assert(JSON.stringify(finGeometry.translateCalls[0]) === JSON.stringify([0, 0, -0.05]), 'fin geometry should stay centered on z');
  assert(beam.fin.material.options.color === 0xaff0ff, 'beam material color should stay unchanged');
  assert(beam.fin.material.options.opacity === 0.92, 'beam material opacity should stay unchanged');
  assert(beam.fin.material.options.side === THREE.DoubleSide, 'beam material should be double-sided');
  assert(beam.fin.material.options.depthWrite === false, 'beam material should not write depth');
  assert(beam.fin.material.options.blending === THREE.AdditiveBlending, 'beam material should use additive blending');

  const crack = beam.crack;
  assert(crack.pos.length === (22 + 1) * 2 * 3, 'crack position buffer should keep 23 root/tip pairs');
  assert(crack.geo.attributes.position.itemSize === 3, 'crack position itemSize should be 3');
  assert(crack.geo.index.array.length === 0, 'new crack should start with empty index');
  assert(crack.mesh.frustumCulled === false, 'crack mesh should not be frustum culled');
  assert(crack.mesh.material.options.color === 0x140f0b, 'crack material color should stay unchanged');
  assert(crack.mesh.material.polygonOffset === true, 'crack material should use polygon offset');
  assert(crack.mesh.material.polygonOffsetFactor === -2, 'crack polygon offset factor should stay -2');
  assert(crack.mesh.material.polygonOffsetUnits === -2, 'crack polygon offset units should stay -2');
}

{
  const { controller, added } = createFixture({ player: { x: 0, z: 0, facing: 0 }, randomValues: Array(40).fill(0.5), now: () => 35 * Math.PI / 2 });
  const beam = controller.spawnSwordBeam();
  const hitCalls = [];
  controller.updateBeams(0.1, b => hitCalls.push({
    beam: b,
    x: b.grp.position.x,
    z: b.grp.position.z,
    hitSet: b.hitSet,
  }));

  assert(hitCalls.length === 1 && hitCalls[0].beam === beam, 'update should call hit callback once for active beam');
  nearly(hitCalls[0].x, 0, 'hit callback should see moved beam x');
  nearly(hitCalls[0].z, 4.6, 'hit callback should see moved beam z');
  assert(hitCalls[0].hitSet === beam.hitSet, 'hit callback should receive the original beam hitSet');
  nearly(beam.dist, 2.6, 'beam dist should advance by speed * dt');
  nearly(beam.life, 1.1, 'beam life should decrease by dt');
  nearly(beam.fin.scale.y, 1.06, 'fin scale should use injected time wobble');
  assert(beam.crack.filled === 9, 'crack should grow by distance / segment length');
  assert(beam.crack.geo.attributes.position.needsUpdate === true, 'crack growth should dirty positions');
  assert(beam.crack.geo.index.array.length === (beam.crack.filled - 1) * 6, 'crack index should stitch grown segments');
  assert(added.length === 2, 'active update should not add extra objects');
}

{
  const { controller, removed } = createFixture({ player: { x: 0, z: 0, facing: 0 } });
  const beam = controller.spawnSwordBeam();
  controller.updateBeams(0.31);
  assert(removed.length === 1 && removed[0] === beam.grp, 'beam should be removed after it reaches four grid cells');
  assert(beam.crack.growing === false, 'beam removal should stop crack growth');
  removed.length = 0;
  controller.updateBeams(9.69);
  nearly(beam.crack.mesh.material.opacity, 0.9, 'crack should hold opacity for 10 seconds');
  controller.updateBeams(2.5);
  nearly(beam.crack.mesh.material.opacity, 0.45, 'crack should fade between 10 and 15 seconds');
  controller.updateBeams(2.5);
  assert(removed.length === 1 && removed[0] === beam.crack.mesh, 'crack should be removed after fadeout');
}

assert(mainJs.includes('import { createSwordBeamController } from "./combat/swordBeam.js";'), 'main.js must import sword beam module');
assert(mainJs.includes('import { createHitResolution, SPIN_RADIUS } from "./combat/hitResolution.js";'), 'main.js must import hit resolution for beam hit behavior');
assert(/\bconst\s+swordBeam\s*=\s*createSwordBeamController\s*\(\s*\{\s*THREE\s*,\s*scene\s*,\s*getPlayer\s*:\s*\(\s*\)\s*=>\s*P\s*\}\s*\)/.test(mainJs), 'main.js must create swordBeam controller');
assert(/case\s+['"]chop['"]\s*:\s*setImpact\s*\(\s*0\.10\s*,\s*0\.22\s*\)\s*;\s*SFX\.chop\(\)\s*;\s*swordBeam\.spawnSwordBeam\(\)\s*;\s*break/.test(moveTriggersJs), 'chop effect must preserve hitstop, shake, SFX, and spawn order');
assert(/swordTrail\.updateTrail\s*\(\s*dt\s*\)\s*;\s*swordBeam\.updateBeams\s*\(\s*dt\s*,\s*hitResolution\.beamHitByBeam\s*\)\s*;\s*spinRings\.updateSpinRings\s*\(\s*dt\s*\)\s*;/.test(mainJs), 'main loop must update sword beams in the original effect slot');
assert(!mainJs.includes('function beamHitByBeam(b){'), 'main.js should not retain inline beam hit behavior after hit resolution extraction');
assert(!mainJs.includes('function beamHitDummies(bx,bz)'), 'legacy beamHitDummies should be removed instead of reintroduced');
assert(!mainJs.includes('function makeFinShape'), 'main.js should not retain inline beam shape builder');
assert(!mainJs.includes('function spawnSwordBeam'), 'main.js should not retain inline spawnSwordBeam');
assert(!mainJs.includes('function newCrack'), 'main.js should not retain inline newCrack');
assert(!mainJs.includes('function growCrack'), 'main.js should not retain inline growCrack');
assert(!mainJs.includes('function updateBeams(dt){'), 'main.js should not retain inline updateBeams');

console.log('Sword beam check passed.');
