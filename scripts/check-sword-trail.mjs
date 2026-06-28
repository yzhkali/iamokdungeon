import fs from 'node:fs';
import path from 'node:path';
import { createSwordTrail } from '../prototype/3d/src/combat/swordTrail.js';

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

  clone() {
    return new FakeVector3(this.x, this.y, this.z);
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
    this.index = index;
  }
}

class FakeMeshBasicMaterial {
  constructor(options) {
    this.options = options;
  }
}

class FakeMesh {
  constructor(geometry, material) {
    this.geometry = geometry;
    this.material = material;
    this.frustumCulled = true;
    this.visible = true;
  }
}

const THREE = {
  AdditiveBlending: 'AdditiveBlending',
  DoubleSide: 'DoubleSide',
  Vector3: FakeVector3,
  BufferAttribute: FakeBufferAttribute,
  BufferGeometry: FakeBufferGeometry,
  MeshBasicMaterial: FakeMeshBasicMaterial,
  Mesh: FakeMesh,
};

function createFixture() {
  const added = [];
  let tipSamples = 0;
  let rootSamples = 0;
  let tip = new FakeVector3(0, 2, 0);
  let root = new FakeVector3(0, 0.3, 0);
  const weaponTip = {
    getWorldPosition(out) {
      tipSamples += 1;
      return out.set(tip.x, tip.y, tip.z);
    },
  };
  const weapon = {
    localToWorld(out) {
      rootSamples += 1;
      return out.set(root.x, root.y, root.z);
    },
  };
  const scene = {
    add(object) {
      added.push(object);
    },
  };
  const trail = createSwordTrail({ THREE, scene, weapon, weaponTip });
  return {
    added,
    trail,
    setSample(nextRoot, nextTip) {
      root = new FakeVector3(nextRoot.x, nextRoot.y, nextRoot.z);
      tip = new FakeVector3(nextTip.x, nextTip.y, nextTip.z);
    },
    getTipSamples: () => tipSamples,
    getRootSamples: () => rootSamples,
  };
}

{
  const { added, trail } = createFixture();
  assert(added.length === 1 && added[0] === trail.mesh, 'trail mesh should be added to the scene');
  assert(trail.mesh.visible === false, 'trail mesh should start hidden');
  assert(trail.mesh.frustumCulled === false, 'trail mesh should not be frustum culled');
  assert(trail.mesh.geometry.attributes.position.array.length === 26 * 2 * 3, 'position buffer should keep 26 root/tip samples');
  assert(trail.mesh.geometry.attributes.color.array.length === 26 * 2 * 4, 'color buffer should keep 26 RGBA root/tip samples');
  assert(trail.mesh.geometry.index.length === (26 - 1) * 6, 'index buffer should stitch 25 trail quads');
  assert(trail.mesh.material.options.color === 0xbfe6ff, 'trail material color should stay unchanged');
  assert(trail.mesh.material.options.transparent === true, 'trail material should be transparent');
  assert(trail.mesh.material.options.vertexColors === true, 'trail material should use vertex colors');
  assert(trail.mesh.material.options.side === THREE.DoubleSide, 'trail material should be double-sided');
  assert(trail.mesh.material.options.depthWrite === false, 'trail material should not write depth');
  assert(trail.mesh.material.options.blending === THREE.AdditiveBlending, 'trail material should use additive blending');
}

{
  const { trail, setSample } = createFixture();
  trail.startTrail();
  assert(trail.isActive() === true, 'startTrail should activate sampling');
  assert(trail.mesh.visible === true, 'startTrail should show the mesh');
  setSample({ x: 1, y: 0.3, z: 2 }, { x: 1, y: 3, z: 2 });
  trail.updateTrail(0.016);

  const position = trail.mesh.geometry.attributes.position.array;
  const color = trail.mesh.geometry.attributes.color.array;
  nearly(position[0], 1, 'first sample root x');
  nearly(position[1], 0.3, 'first sample root y');
  nearly(position[2], 2, 'first sample root z');
  nearly(position[3], 1, 'first sample tip x');
  nearly(position[4], 3, 'first sample tip y');
  nearly(position[5], 2, 'first sample tip z');
  nearly(color[0], 0.78, 'root red channel');
  nearly(color[1], 0.92, 'root green channel');
  nearly(color[2], 1.0, 'root blue channel');
  nearly(color[3], 0.7, 'new trail sample alpha');
  nearly(color[7], 0.7, 'new trail tip alpha');
  assert(trail.mesh.geometry.attributes.position.needsUpdate === true, 'position buffer should be marked dirty');
  assert(trail.mesh.geometry.attributes.color.needsUpdate === true, 'color buffer should be marked dirty');
}

{
  const { trail, setSample } = createFixture();
  trail.startTrail();
  for (let i = 1; i <= 5; i += 1) {
    setSample({ x: i, y: 0.3, z: 0 }, { x: i, y: 2, z: 0 });
    trail.updateTrail(0.016);
  }
  const defaultPosition = trail.mesh.geometry.attributes.position.array;
  nearly(defaultPosition[0], 5, 'default segment count should keep newest sample first');
  nearly(defaultPosition[18], 2, 'default segment count should retain four samples');
  nearly(defaultPosition[24], 2, 'default segment count should not retain a fifth sample');
}

{
  const { trail, getRootSamples, getTipSamples } = createFixture();
  trail.updateTrail(0.016);
  assert(getRootSamples() === 0 && getTipSamples() === 0, 'hidden trail update should not sample weapon positions');
  assert(trail.mesh.geometry.attributes.position.needsUpdate === false, 'hidden trail update should not dirty position buffer');
  assert(trail.mesh.geometry.attributes.color.needsUpdate === false, 'hidden trail update should not dirty color buffer');
}

{
  const { trail, setSample } = createFixture();
  trail.startTrail(2);
  setSample({ x: 10, y: 0.3, z: 0 }, { x: 10, y: 2, z: 0 });
  trail.updateTrail(0.016);
  setSample({ x: 20, y: 0.3, z: 0 }, { x: 20, y: 2, z: 0 });
  trail.updateTrail(0.05);
  setSample({ x: 30, y: 0.3, z: 0 }, { x: 30, y: 2, z: 0 });
  trail.updateTrail(0.05);

  const position = trail.mesh.geometry.attributes.position.array;
  nearly(position[0], 30, 'newest sample should be written first');
  nearly(position[6], 20, 'segment cap should retain the previous sample');
  nearly(position[12], 20, 'positions beyond actual count should repeat the oldest retained sample');
  nearly(trail.mesh.geometry.attributes.color.array[19], 0, 'positions beyond actual count should be fully transparent');
}

{
  const { trail, setSample } = createFixture();
  trail.startTrail(3);
  setSample({ x: 2, y: 0.3, z: 0 }, { x: 2, y: 2, z: 0 });
  trail.updateTrail(0.016);
  trail.stopTrail();
  assert(trail.isActive() === false, 'stopTrail should stop sampling');
  setSample({ x: 99, y: 0.3, z: 0 }, { x: 99, y: 2, z: 0 });
  trail.updateTrail(0.15);

  const position = trail.mesh.geometry.attributes.position.array;
  const color = trail.mesh.geometry.attributes.color.array;
  nearly(position[0], 2, 'stopTrail should keep existing root sample instead of recording new positions');
  nearly(color[3], 0.35, 'existing sample should fade by age after stopTrail');
  assert(trail.mesh.visible === true, 'mesh should stay visible while faded samples remain');
  trail.updateTrail(0.16);
  assert(trail.mesh.visible === false, 'mesh should hide after all stopped samples expire');
}

{
  const { trail, setSample } = createFixture();
  trail.startTrail(1);
  setSample({ x: 1, y: 0.3, z: 0 }, { x: 1, y: 2, z: 0 });
  trail.updateTrail(0.016);
  trail.startTrail(1);
  setSample({ x: 7, y: 0.3, z: 0 }, { x: 7, y: 2, z: 0 });
  trail.updateTrail(0.016);
  nearly(trail.mesh.geometry.attributes.position.array[0], 7, 'startTrail should reset old sample history');
  nearly(trail.mesh.geometry.attributes.position.array[6], 7, 'reset history should not retain prior samples');
}

assert(mainJs.includes('import { createSwordTrail } from "./combat/swordTrail.js";'), 'main.js must import sword trail module');
assert(/\bconst\s+swordTrail\s*=\s*createSwordTrail\s*\(\s*\{\s*THREE\s*,\s*scene\s*,\s*weapon\s*,\s*weaponTip\s*\}\s*\)/.test(mainJs), 'main.js must create swordTrail after weapon setup');
assert(/P\.move\s*&&\s*swordTrail\.mesh\.visible\s*&&\s*swordTrail\.isActive\(\)/.test(mainJs), 'space slash dodge gate must use swordTrail state');
assert(/swordTrail\.startTrail\s*\(\s*mv\.trailSegs\s*\|\|\s*\(\s*mv\.spinY\s*\?\s*26\s*:\s*4\s*\)\s*\)/.test(mainJs), 'move update must start sword trail with existing segment expression');
assert(mainJs.includes('swordTrail.stopTrail()'), 'move update must stop sword trail through the module');
assert(/updateFx\s*\(\s*dt\s*\)\s*;\s*poseCharacter\s*\(\s*dt\s*\)\s*;\s*swordTrail\.updateTrail\s*\(\s*dt\s*\)\s*;/.test(mainJs), 'effect update order must keep sword trail immediately after pose');
assert(!mainJs.includes('function updateTrail(dt){'), 'main.js should not retain inline updateTrail');
assert(!mainJs.includes('const TRAIL_MAX=26'), 'main.js should not retain inline trail constants');

console.log('Sword trail check passed.');
