import fs from 'node:fs';
import path from 'node:path';
import { makeTrainingDummy } from '../prototype/3d/src/world/trainingDummy.js';

const repoRoot = process.cwd();
const mainJs = fs.readFileSync(path.join(repoRoot, 'prototype/3d/src/main.js'), 'utf8');

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
    Object.assign(this, options);
    this.options = options;
  }
}

const THREE = {
  Group: FakeGroup,
  Mesh: FakeMesh,
  BoxGeometry: class extends FakeGeometry {
    constructor(width, height, depth) {
      super('BoxGeometry', [width, height, depth]);
    }
  },
  CylinderGeometry: class extends FakeGeometry {
    constructor(radiusTop, radiusBottom, height, radialSegments) {
      super('CylinderGeometry', [radiusTop, radiusBottom, height, radialSegments]);
    }
  },
  SphereGeometry: class extends FakeGeometry {
    constructor(radius, widthSegments, heightSegments) {
      super('SphereGeometry', [radius, widthSegments, heightSegments]);
    }
  },
  MeshStandardMaterial: class extends FakeMaterial {},
};

function assertVector(vector, expected, label) {
  nearly(vector.x, expected[0], `${label}.x`);
  nearly(vector.y, expected[1], `${label}.y`);
  nearly(vector.z, expected[2], `${label}.z`);
}

function assertGeometry(mesh, type, expected, label) {
  assert(mesh.geometry.type === type, `${label} should use ${type}`);
  for (let index = 0; index < expected.length; index += 1) {
    nearly(mesh.geometry.args[index], expected[index], `${label}.geometry.args[${index}]`);
  }
}

function assertWoodMaterial(mesh, color, label) {
  assert(mesh.material.color === color, `${label} material color`);
  assert(mesh.material.roughness === 0.85, `${label} material roughness`);
}

function assertBoxShadow(mesh, label) {
  assert(mesh.castShadow === true, `${label} should cast shadows`);
  assert(mesh.receiveShadow === true, `${label} should receive shadows`);
}

assert(typeof makeTrainingDummy === 'function', 'trainingDummy.js must export makeTrainingDummy');

const sceneAdds = [];
const features = [];
const colliders = [];
const terrainCalls = [];
const dummies = [];
const terrainTop = 4.25;

const dummy = makeTrainingDummy({
  THREE,
  scene: {
    add(object) {
      sceneAdds.push(object);
    },
  },
  registerMapFeature(feature) {
    features.push(feature);
    return feature;
  },
  addCollider(...args) {
    colliders.push(args);
  },
  terrainYAt(x, z) {
    terrainCalls.push([x, z]);
    return terrainTop;
  },
  dummies,
}, 12, -7, Math.PI / 2);

assert(sceneAdds.length === 1 && sceneAdds[0] === dummy.root, 'scene.add should receive dummy root once');
assertVector(dummy.root.position, [12, 0, -7], 'dummy.root.position');
nearly(dummy.root.rotation.y, Math.PI / 2, 'dummy.root.rotation.y');

assert(features.length === 1, 'registerMapFeature should be called once');
assert(JSON.stringify(features[0]) === JSON.stringify({
  type: 'training',
  name: '木桩',
  x: 12,
  z: -7,
  w: 1.2,
  d: 1.2,
  rot: Math.PI / 2,
}), 'training feature should keep exact map payload');

assert(terrainCalls.length === 2, 'terrainYAt should be called twice for collider bottom/top');
assert(JSON.stringify(terrainCalls[0]) === JSON.stringify([12, -7]), 'terrainYAt first call coordinates');
assert(JSON.stringify(terrainCalls[1]) === JSON.stringify([12, -7]), 'terrainYAt second call coordinates');
assert(colliders.length === 1, 'addCollider should be called once');
assert(JSON.stringify(colliders[0]) === JSON.stringify([12, -7, 0.6, 0.6, terrainTop, terrainTop + 3.0]), 'training dummy collider payload');

assert(dummies.length === 1 && dummies[0] === dummy, 'makeTrainingDummy should push the returned dummy into shared dummies');
assert(dummy.x === 12 && dummy.z === -7 && dummy.r === 1.2 && dummy.face === Math.PI / 2, 'dummy position/radius/face fields');
assert(dummy.flashT === 0 && dummy.tilt === 0 && dummy.tiltVel === 0, 'dummy feedback fields should default to zero');
assert(Array.isArray(dummy.mats), 'dummy mats should be an array');

assert(dummy.root.children.length === 2, 'dummy root should contain base and pivot');
const [base, pivot] = dummy.root.children;
assert(dummy.pivot === pivot, 'dummy.pivot should reference the pivot child');
nearly(pivot.position.y, 0.4, 'pivot.position.y');
assert(pivot.children.length === 9, 'pivot should contain post, three rings, head, and four arms');
assert(dummy.mats.length === 9, 'mats should track only pivot children materials');
assert(!dummy.mats.includes(base.material), 'mats should not include base material');
for (const child of pivot.children) {
  assert(dummy.mats.includes(child.material), 'mats should include every pivot child material');
}

assertGeometry(base, 'CylinderGeometry', [0.85, 1.0, 0.4, 16], 'base');
assertWoodMaterial(base, 0x6e4a28, 'base');
assert(base.castShadow === true && base.receiveShadow === true, 'base shadow flags');
nearly(base.position.y, 0.2, 'base.position.y');

const [post, ringA, ringB, ringC, head, armT, armDiagL, armDiagR, armMid] = pivot.children;
assertGeometry(post, 'BoxGeometry', [0.42, 2.4, 0.42], 'post');
assertWoodMaterial(post, 0x9a6b3e, 'post');
assertBoxShadow(post, 'post');
nearly(post.position.y, 1.2, 'post.position.y');

for (const [index, ring] of [ringA, ringB, ringC].entries()) {
  assertGeometry(ring, 'BoxGeometry', [0.46, 0.1, 0.46], `ring ${index}`);
  assertWoodMaterial(ring, 0x6e4a28, `ring ${index}`);
  assertBoxShadow(ring, `ring ${index}`);
  nearly(ring.position.y, [0.5, 1.0, 2.0][index], `ring ${index}.position.y`);
}

assertGeometry(head, 'SphereGeometry', [0.34, 16, 12], 'head');
assertWoodMaterial(head, 0x9a6b3e, 'head');
assert(head.castShadow === true, 'head should cast shadows');
assert(head.receiveShadow === false, 'head should preserve old receiveShadow default');
nearly(head.position.y, 2.6, 'head.position.y');

assertGeometry(armT, 'BoxGeometry', [1.7, 0.22, 0.22], 'top arm');
assertWoodMaterial(armT, 0x9a6b3e, 'top arm');
assertBoxShadow(armT, 'top arm');
assertVector(armT.position, [0, 1.9, 0], 'top arm position');

assertGeometry(armDiagL, 'BoxGeometry', [0.22, 0.22, 1.1], 'left diagonal arm');
assertWoodMaterial(armDiagL, 0x9a6b3e, 'left diagonal arm');
assertBoxShadow(armDiagL, 'left diagonal arm');
assertVector(armDiagL.position, [-0.5, 1.5, 0.3], 'left diagonal arm position');
nearly(armDiagL.rotation.x, 0.5, 'left diagonal arm rotation.x');

assertGeometry(armDiagR, 'BoxGeometry', [0.22, 0.22, 1.1], 'right diagonal arm');
assertWoodMaterial(armDiagR, 0x9a6b3e, 'right diagonal arm');
assertBoxShadow(armDiagR, 'right diagonal arm');
assertVector(armDiagR.position, [0.5, 1.5, 0.3], 'right diagonal arm position');
nearly(armDiagR.rotation.x, 0.5, 'right diagonal arm rotation.x');

assertGeometry(armMid, 'BoxGeometry', [0.2, 0.2, 0.9], 'middle arm');
assertWoodMaterial(armMid, 0x9a6b3e, 'middle arm');
assertBoxShadow(armMid, 'middle arm');
assertVector(armMid.position, [0, 1.15, 0.45], 'middle arm position');

assert(mainJs.includes('import { makeTrainingDummy } from "./world/trainingDummy.js";'), 'main.js must import makeTrainingDummy');
assert(mainJs.includes('const dummies=[];'), 'main.js must retain shared dummies array');
assert(/function\s+makeDummy\s*\(\s*dx\s*,\s*dz\s*,\s*face\s*\)\s*\{\s*return\s+makeTrainingDummy\s*\(\s*\{\s*THREE\s*,\s*scene\s*,\s*registerMapFeature\s*,\s*addCollider\s*,\s*terrainYAt\s*,\s*dummies\s*\}\s*,\s*dx\s*,\s*dz\s*,\s*face\s*\)\s*;\s*\}/.test(mainJs), 'main.js makeDummy wrapper should delegate to makeTrainingDummy with shared world state');
assert(mainJs.includes('//makeDummy(0,5,Math.PI);'), 'main.js should preserve dormant training dummy call');

assert(!mainJs.includes('const WOOD=0x9a6b3e'), 'main.js should not retain inline wood constants');
assert(!mainJs.includes('function Mwood'), 'main.js should not retain inline wood material helper');
assert(!mainJs.includes('function woodBox'), 'main.js should not retain inline wood box helper');
assert(!mainJs.includes('new THREE.CylinderGeometry(0.85,1.0,0.4,16)'), 'main.js should not retain inline dummy base geometry');
assert(!mainJs.includes('new THREE.SphereGeometry(0.34,16,12)'), 'main.js should not retain inline dummy head geometry');
assert(!mainJs.includes('dummies.push(dummy)'), 'main.js should not retain inline dummy array mutation');

console.log('Training dummy check passed.');
