import fs from 'node:fs';
import path from 'node:path';
import { createSpaceSlash } from '../prototype/3d/src/combat/spaceSlash.js';

const repoRoot = process.cwd();
const mainJs = fs.readFileSync(path.join(repoRoot, 'prototype/3d/src/main.js'), 'utf8');
const hitTargetFeedbackJs = fs.readFileSync(path.join(repoRoot, 'prototype/3d/src/combat/hitTargetFeedback.js'), 'utf8');
const updateControllerJs = fs.readFileSync(path.join(repoRoot, 'prototype/3d/src/player/updateController.js'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function nearly(actual, expected, message, epsilon = 1e-6) {
  if (Math.abs(actual - expected) > epsilon) {
    throw new Error(`${message}: got ${actual}, expected ${expected}`);
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
  }

  setAttribute(name, attribute) {
    this.attributes[name] = attribute;
  }
}

class FakeLineBasicMaterial {
  constructor(options) {
    this.options = options;
    this.opacity = options.opacity;
  }
}

class FakeLineSegments {
  constructor(geometry, material) {
    this.geometry = geometry;
    this.material = material;
    this.frustumCulled = true;
  }
}

const THREE = {
  AdditiveBlending: 'AdditiveBlending',
  BufferAttribute: FakeBufferAttribute,
  BufferGeometry: FakeBufferGeometry,
  LineBasicMaterial: FakeLineBasicMaterial,
  LineSegments: FakeLineSegments,
};

function createRandom(values = []) {
  let index = 0;
  return () => values[index++] ?? 0.5;
}

function createFixture(randomValues) {
  const added = [];
  const removed = [];
  const scene = {
    add(object) {
      added.push(object);
    },
    remove(object) {
      removed.push(object);
    },
  };
  const spaceSlash = createSpaceSlash({ THREE, scene, random: createRandom(randomValues) });
  return { added, removed, spaceSlash };
}

{
  const { added, removed, spaceSlash } = createFixture();
  assert(spaceSlash.isReady() === false, 'space slash should start not ready');
  assert(spaceSlash.consumeHit(1, 2, 3) === false, 'consumeHit should no-op when not ready');
  assert(added.length === 0 && removed.length === 0, 'not-ready consume should not touch scene');

  spaceSlash.markReady();
  assert(spaceSlash.isReady() === true, 'markReady should set ready flag');
  assert(spaceSlash.consumeHit(1, 2, 3) === true, 'consumeHit should spawn when ready');
  assert(spaceSlash.isReady() === false, 'consumeHit should clear ready flag');
  assert(added.length === 1, 'consumeHit should add one line mesh');
}

{
  const randomValues = [];
  for (let i = 0; i < 14; i += 1) randomValues.push(0, 0.5, 0, 0.5, 0);
  const { added, spaceSlash } = createFixture(randomValues);
  const mesh = spaceSlash.spawnSpaceSlash(10, 2, -4);

  assert(added.length === 1 && added[0] === mesh, 'spawnSpaceSlash should add the line mesh');
  assert(mesh.frustumCulled === false, 'space slash line should not be frustum culled');
  assert(mesh.geometry.attributes.position.array.length === 14 * 2 * 3, 'space slash should allocate 14 line segments');
  assert(mesh.geometry.attributes.position.itemSize === 3, 'position attribute item size should be 3');
  assert(mesh.material.options.color === 0xaef0ff, 'space slash material color should stay unchanged');
  assert(mesh.material.options.transparent === true, 'space slash material should be transparent');
  assert(mesh.material.options.depthWrite === false, 'space slash material should not write depth');
  assert(mesh.material.options.blending === THREE.AdditiveBlending, 'space slash material should use additive blending');

  spaceSlash.update(0.05);
  const position = mesh.geometry.attributes.position.array;
  nearly(position[0], 10, 'first segment origin x');
  nearly(position[1], 2, 'first segment origin y');
  nearly(position[2], -4, 'first segment origin z');
  nearly(position[3], 10 + 0.8, 'first segment end x should grow to half of min length');
  nearly(position[4], 2, 'first segment end y');
  nearly(position[5], -4, 'first segment end z');
  assert(mesh.geometry.attributes.position.needsUpdate === true, 'update should mark position dirty');
  nearly(mesh.material.opacity, 1, 'space slash opacity should hold during grow/hold window');
}

{
  const randomValues = [];
  for (let i = 0; i < 14; i += 1) randomValues.push(0, 0.5, 0, 1, 0);
  const { added, spaceSlash } = createFixture(randomValues);
  const mesh = spaceSlash.spawnSpaceSlash(10, 2, -4);
  spaceSlash.update(0.1);
  const position = mesh.geometry.attributes.position.array;
  nearly(position[0], 10 + 0.2, 'offset should move origin along direction');
  nearly(position[3], 10 + 0.2 + 1.6, 'full grow should add min length from offset origin');
  assert(added.length === 1, 'offset fixture should still create one mesh');
}

{
  const { removed, spaceSlash } = createFixture();
  const mesh = spaceSlash.spawnSpaceSlash(0, 0, 0);
  spaceSlash.update(0.40);
  nearly(mesh.material.opacity, 1 - (0.40 - 0.10 - 0.18) / 0.22, 'space slash should fade after grow plus hold');
  assert(removed.length === 0, 'space slash should remain before total lifetime');
  spaceSlash.update(0.11);
  assert(removed.length === 1 && removed[0] === mesh, 'space slash should remove its mesh after total lifetime');
  removed.length = 0;
  spaceSlash.update(0.50);
  assert(removed.length === 0, 'removed space slash should not be removed again');
}

assert(mainJs.includes('import { createSpaceSlash } from "./combat/spaceSlash.js";'), 'main.js must import space slash module');
assert(/\bconst\s+spaceSlash\s*=\s*createSpaceSlash\s*\(\s*\{\s*THREE\s*,\s*scene\s*\}\s*\)/.test(mainJs), 'main.js must create spaceSlash controller');
assert(/spaceSlash\.consumeHit\s*\(\s*ox\s*,\s*oy\s*,\s*oz\s*\)/.test(hitTargetFeedbackJs), 'onHitTarget must consume space slash on target hit');
assert(/boostImpact\s*\(\s*0\.06\s*,\s*0\.2\s*\)/.test(hitTargetFeedbackJs), 'onHitTarget must keep existing space slash hitstop and shake boosts');
assert(/P\.move\s*&&\s*swordTrail\.mesh\.visible\s*&&\s*swordTrail\.isActive\(\)\s*\)\s*\{\s*spaceSlash\.markReady\(\)/.test(updateControllerJs), 'dodge cancel must mark the next hit for space slash');
assert(/swordTrail\.updateTrail\s*\(\s*dt\s*\)\s*;\s*swordBeam\.updateBeams\s*\(\s*dt\s*,\s*hitResolution\.beamHitByBeam\s*\)\s*;\s*spinRings\.updateSpinRings\s*\(\s*dt\s*\)\s*;\s*spaceSlash\.update\s*\(\s*dt\s*\)\s*;\s*stompEffects\.updateStomps\s*\(\s*dt\s*\)\s*;/.test(updateControllerJs), 'effect update order must keep space slash after rings and before stomps');
assert(!mainJs.includes('let spaceSlashReady=false'), 'main.js should not retain inline spaceSlashReady');
assert(!mainJs.includes('function spawnSpaceSlash'), 'main.js should not retain inline spawnSpaceSlash');
assert(!mainJs.includes('function updateSpaceSlash'), 'main.js should not retain inline updateSpaceSlash');

console.log('Space slash check passed.');
