import fs from 'node:fs';
import path from 'node:path';
import { createSpinRings, SPIN_RING_Y } from '../prototype/3d/src/combat/spinRings.js';

const repoRoot = process.cwd();
const mainJs = fs.readFileSync(path.join(repoRoot, 'prototype/3d/src/main.js'), 'utf8');
const moveTriggersJs = fs.readFileSync(path.join(repoRoot, 'prototype/3d/src/player/moveTriggers.js'), 'utf8');
const updateControllerJs = fs.readFileSync(path.join(repoRoot, 'prototype/3d/src/player/updateController.js'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function nearly(actual, expected, message, epsilon = 1e-6) {
  if (Math.abs(actual - expected) > epsilon) {
    throw new Error(`${message}: got ${actual}, expected ${expected}`);
  }
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

class FakeMesh {
  constructor(geometry, material) {
    this.geometry = geometry;
    this.material = material;
    this.rotation = new FakeTransform();
    this.position = new FakeTransform();
    this.scale = new FakeTransform();
    this.visible = true;
  }
}

const THREE = {
  AdditiveBlending: 'AdditiveBlending',
  DoubleSide: 'DoubleSide',
  RingGeometry: FakeGeometry,
  MeshBasicMaterial: FakeMaterial,
  Mesh: FakeMesh,
};

function createFixture({ player = { x: 4, z: -2 }, spinRadius = 2.8 } = {}) {
  const added = [];
  const removed = [];
  const scene = {
    add(object) { added.push(object); },
    remove(object) { removed.push(object); },
  };
  const spinRings = createSpinRings({
    THREE,
    scene,
    getPlayer: () => player,
    getSpinRadius: () => spinRadius,
  });
  return { added, removed, player, spinRings };
}

{
  const { added, spinRings } = createFixture();
  assert(SPIN_RING_Y === 2.0, 'spin ring height should stay 2.0');
  assert(spinRings.SPIN_RING_Y === 2.0, 'controller height alias should stay 2.0');

  const ring = spinRings.spawnSpinRing(10, -4, 1.25, 3.5, 0.1);
  assert(added.length === 1 && added[0] === ring.mesh, 'spawnSpinRing should add one mesh to the scene');
  assert(JSON.stringify(ring.mesh.geometry.args) === JSON.stringify([0.92, 1.0, 40]), 'ring geometry should keep inner/outer/segment arguments');
  assert(ring.mesh.material.options.color === 0xbfeaff, 'ring material color should stay unchanged');
  assert(ring.mesh.material.options.transparent === true, 'ring material should be transparent');
  assert(ring.mesh.material.options.opacity === 0, 'ring material should start transparent');
  assert(ring.mesh.material.options.side === THREE.DoubleSide, 'ring material should be double-sided');
  assert(ring.mesh.material.options.depthWrite === false, 'ring material should not write depth');
  assert(ring.mesh.material.options.blending === THREE.AdditiveBlending, 'ring material should use additive blending');
  nearly(ring.mesh.rotation.x, -Math.PI / 2, 'ring should lie flat');
  nearly(ring.mesh.position.x, 10, 'ring x');
  nearly(ring.mesh.position.y, 2.0, 'ring y');
  nearly(ring.mesh.position.z, -4, 'ring z');
  assert(ring.mesh.visible === false, 'ring should start hidden');
  nearly(ring.t, -0.1, 'delay should be stored as negative time');
  nearly(ring.dur, 0.32, 'ring duration should stay 0.32 seconds');
  nearly(ring.fromR, 1.25, 'from radius should be stored');
  nearly(ring.toR, 3.5, 'to radius should be stored');
}

{
  const { added, removed, spinRings } = createFixture();
  const ring = spinRings.spawnSpinRing(0, 0, 1, 3, 0.1);
  spinRings.updateSpinRings(0.05);
  assert(ring.mesh.visible === false, 'delayed ring should remain hidden before delay elapses');
  assert(removed.length === 0, 'delayed ring should not be removed');

  spinRings.updateSpinRings(0.05);
  assert(ring.mesh.visible === true, 'ring should become visible when delay elapses');
  nearly(ring.mesh.scale.x, 1, 'ring should start from fromR after delay');
  nearly(ring.mesh.scale.y, 1, 'ring y scale should match radius');
  nearly(ring.mesh.scale.z, 1, 'ring z scale should stay 1');
  nearly(ring.mat.opacity, 0.7, 'ring opacity should start at 0.7 when active');

  spinRings.updateSpinRings(0.16);
  const k = 0.16 / 0.32;
  const easedRadius = 1 + (3 - 1) * (1 - (1 - k) * (1 - k));
  nearly(ring.mesh.scale.x, easedRadius, 'ring radius should ease out');
  nearly(ring.mesh.scale.y, easedRadius, 'ring y scale should ease out');
  nearly(ring.mat.opacity, 0.7 * (1 - k), 'ring opacity should fade linearly with k');
  assert(removed.length === 0, 'ring should remain before full duration');

  spinRings.updateSpinRings(0.16);
  assert(removed.length === 1 && removed[0] === ring.mesh, 'ring should be removed at full duration');
  removed.length = 0;
  spinRings.updateSpinRings(1);
  assert(removed.length === 0, 'removed ring should not be removed again');
  assert(added.length === 1, 'update should not add extra meshes');
}

{
  const player = { x: 2, z: -7 };
  const { added, spinRings } = createFixture({ player, spinRadius: 2.8 });
  spinRings.spawnSaturnRings();
  assert(added.length === 5, 'spawnSaturnRings should create five rings');
  for (let n = 0; n < 5; n += 1) {
    const mesh = added[n];
    nearly(mesh.position.x, player.x, `saturn ring ${n} x`);
    nearly(mesh.position.y, 2.0, `saturn ring ${n} y`);
    nearly(mesh.position.z, player.z, `saturn ring ${n} z`);
  }

  const rings = added.map(mesh => ({ mesh }));
  assert(rings.length === 5, 'test fixture should retain five meshes');
  spinRings.updateSpinRings(0.001);
  nearly(added[0].scale.x, 1 + (3.2 - 1) * (1 - (1 - (0.001 / 0.32)) ** 2), 'first saturn ring should use inner and spin radius');
  assert(added[1].visible === false, 'second saturn ring should still be delayed after 0.001s');
}

{
  const player = { x: 1, z: 1 };
  const { added, spinRings } = createFixture({ player, spinRadius: 4 });
  player.x = 9;
  player.z = 3;
  spinRings.spawnSaturnRings();
  nearly(added[0].position.x, 9, 'spawnSaturnRings should read live player x');
  nearly(added[0].position.z, 3, 'spawnSaturnRings should read live player z');

  const last = added[4];
  spinRings.updateSpinRings(0.14);
  nearly(last.scale.x, 2.2, 'last ring should start from inner + n * 0.3 after its delay');
  nearly(last.material.opacity, 0.7, 'last ring should start full ring opacity when delay elapses');
}

assert(mainJs.includes('import { createSpinRings } from "./combat/spinRings.js";'), 'main.js must import spin rings module');
assert(/\bconst\s+spinRings\s*=\s*createSpinRings\s*\(\s*\{\s*THREE\s*,\s*scene\s*,\s*getPlayer\s*:\s*\(\s*\)\s*=>\s*P\s*,\s*getSpinRadius\s*:\s*\(\s*\)\s*=>\s*SPIN_RADIUS\s*\}\s*\)/.test(mainJs), 'main.js must create spin ring controller with live player and spin radius dependencies');
assert(/case\s+['"]spinSlash['"]\s*:\s*setImpact\s*\(\s*0\.08\s*,\s*0\.22\s*\)\s*;\s*break/.test(moveTriggersJs), 'spinSlash should preserve dormant ring behavior and only set hitstop/shake');
assert(/swordTrail\.updateTrail\s*\(\s*dt\s*\)\s*;\s*swordBeam\.updateBeams\s*\(\s*dt\s*,\s*hitResolution\.beamHitByBeam\s*\)\s*;\s*spinRings\.updateSpinRings\s*\(\s*dt\s*\)\s*;\s*spaceSlash\.update\s*\(\s*dt\s*\)\s*;/.test(updateControllerJs), 'effect update order must keep spin rings between sword beams and space slash');
assert(!mainJs.includes('const spinRings=[]'), 'main.js should not retain inline spin ring state');
assert(!mainJs.includes('const SPIN_RING_Y=2.0'), 'main.js should not retain inline spin ring height constant');
assert(!mainJs.includes('function spawnSpinRing'), 'main.js should not retain inline spawnSpinRing');
assert(!mainJs.includes('function updateSpinRings'), 'main.js should not retain inline updateSpinRings');
assert(!mainJs.includes('function spawnSaturnRings'), 'main.js should not retain inline spawnSaturnRings');

console.log('Spin rings check passed.');
