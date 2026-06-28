import fs from 'node:fs';
import path from 'node:path';
import { createVillageBlockout } from '../prototype/3d/src/world/village.js';

const repoRoot = process.cwd();
const mainJs = fs.readFileSync(path.join(repoRoot, 'prototype/3d/src/main.js'), 'utf8');
const villageJs = fs.readFileSync(path.join(repoRoot, 'prototype/3d/src/world/village.js'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function nearly(actual, expected, message, epsilon = 1e-9) {
  if (Math.abs(actual - expected) > epsilon) {
    throw new Error(`${message}: got ${actual}, expected ${expected}`);
  }
}

function assertVector(vector, expected, label) {
  nearly(vector.x, expected[0], `${label}.x`);
  nearly(vector.y, expected[1], `${label}.y`);
  nearly(vector.z, expected[2], `${label}.z`);
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
    this.scale = new FakeVector3(1, 1, 1);
  }

  add(child) {
    child.parent = this;
    this.children.push(child);
    return this;
  }
}

class FakeScene extends FakeObject3D {
  constructor(sceneAdds) {
    super();
    this.sceneAdds = sceneAdds;
  }

  add(child) {
    this.sceneAdds.push(child);
    return super.add(child);
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

class FakePointLight extends FakeObject3D {
  constructor(color, intensity, distance) {
    super();
    this.color = color;
    this.intensity = intensity;
    this.distance = distance;
    this.isPointLight = true;
  }
}

class FakeGeometry {
  constructor(type, args) {
    this.type = type;
    this.args = args;
  }
}

class FakeBufferGeometry {
  constructor() {
    this.type = 'BufferGeometry';
    this.attributes = {};
    this.index = null;
    this.normalsComputed = false;
  }

  setAttribute(name, attribute) {
    this.attributes[name] = attribute;
    return this;
  }

  setIndex(index) {
    this.index = index;
    return this;
  }

  computeVertexNormals() {
    this.normalsComputed = true;
  }
}

class FakeBufferAttribute {
  constructor(array, itemSize) {
    this.array = array;
    this.itemSize = itemSize;
  }
}

class FakeMaterial {
  constructor(options = {}) {
    Object.assign(this, options);
    this.options = options;
  }
}

const THREE = {
  Group: FakeGroup,
  Mesh: FakeMesh,
  PointLight: FakePointLight,
  BufferGeometry: FakeBufferGeometry,
  BufferAttribute: FakeBufferAttribute,
  BoxGeometry: class extends FakeGeometry {
    constructor(width, height, depth) {
      super('BoxGeometry', [width, height, depth]);
    }
  },
  PlaneGeometry: class extends FakeGeometry {
    constructor(width, height) {
      super('PlaneGeometry', [width, height]);
    }
  },
  DodecahedronGeometry: class extends FakeGeometry {
    constructor(radius, detail) {
      super('DodecahedronGeometry', [radius, detail]);
    }
  },
  MeshStandardMaterial: class extends FakeMaterial {},
  MeshBasicMaterial: class extends FakeMaterial {},
  CanvasTexture: class {
    constructor(canvas) {
      this.canvas = canvas;
    }
  },
  DoubleSide: 'DoubleSide',
};

const documentRef = {
  createElement(type) {
    assert(type === 'canvas', 'village signs should only create canvases');
    return {
      width: 0,
      height: 0,
      getContext(kind) {
        assert(kind === '2d', 'sign canvas should request a 2d context');
        return {
          fillStyle: '',
          strokeStyle: '',
          lineWidth: 0,
          font: '',
          textAlign: '',
          textBaseline: '',
          fillRect() {},
          strokeRect() {},
          fillText() {},
        };
      },
    };
  },
};

function makeHarness({ terrainTop = 2.5, randomValue = 0.5 } = {}) {
  const sceneAdds = [];
  const placeCalls = [];
  const terrainCalls = [];
  const terrainAreas = [];
  const platforms = [];
  const platformBounds = [];
  const colliders = [];
  const callbackOrder = [];
  let randomCalls = 0;
  const scene = new FakeScene(sceneAdds);
  const village = createVillageBlockout({
    THREE,
    scene,
    placeModel(pathArg, x, z, opts) {
      placeCalls.push({ path: pathArg, x, z, opts });
      return { path: pathArg, x, z, opts };
    },
    terrainYAt(x, z) {
      terrainCalls.push([x, z]);
      return terrainTop;
    },
    addCollider(...args) {
      callbackOrder.push(['collider', ...args]);
      colliders.push(args);
    },
    addTerrainArea(...args) {
      callbackOrder.push(['terrain', ...args]);
      terrainAreas.push(args);
    },
    addPlatform(...args) {
      callbackOrder.push(['platform', ...args]);
      platforms.push(args);
    },
    addPlatformBounds(...args) {
      callbackOrder.push(['platformBounds', ...args]);
      platformBounds.push(args);
    },
    documentRef,
    random() {
      randomCalls += 1;
      return randomValue;
    },
  });
  return {
    village,
    scene,
    sceneAdds,
    placeCalls,
    terrainCalls,
    terrainAreas,
    platforms,
    platformBounds,
    colliders,
    callbackOrder,
    get randomCalls() {
      return randomCalls;
    },
  };
}

function assertArgs(actual, expected, label) {
  assert(actual.length === expected.length, `${label} arg length`);
  for (let index = 0; index < expected.length; index += 1) {
    nearly(actual[index], expected[index], `${label}[${index}]`);
  }
}

assert(typeof createVillageBlockout === 'function', 'village.js must export createVillageBlockout');

{
  const h = makeHarness();
  assert(h.sceneAdds.length === 1 && h.sceneAdds[0] === h.village.mapRoot, 'factory should attach exactly the shared mapRoot on init');
  assert(h.village.mapFeatures.length === 0, 'factory init should not register map features');
  assert(h.terrainAreas.length === 0, 'factory init should not register terrain areas');
  assert(h.platforms.length === 0, 'factory init should not register platforms');
  assert(h.colliders.length === 0, 'factory init should not register colliders');
  assert(h.placeCalls.length === 0, 'factory init should not place models');
  assert(h.randomCalls === 0, 'factory init should not consume random');

  const feature = { type: 'probe' };
  assert(h.village.registerMapFeature(feature) === feature, 'registerMapFeature should return the original feature object');
  assert(h.village.mapFeatures.length === 1 && h.village.mapFeatures[0] === feature, 'mapFeatures should be a live array');
}

{
  const h = makeHarness();
  const patch = h.village.addGroundPatch(1, 2, 3, 4, 0.03, 0x6d6049);
  assert(patch.parent === h.village.mapRoot, 'addGroundPatch should parent meshes to mapRoot');
  assertVector(patch.position, [1, -0.04, 2], 'addGroundPatch mesh position');
  assert(h.terrainAreas.length === 1, 'addGroundPatch should always register terrain');
  assert(h.platforms.length === 0, 'addGroundPatch should not register platform at top === 0.03');
  assert(h.village.mapFeatures[0].type === 'road', 'addGroundPatch road color should register road feature');

  h.village.addGroundPatch(5, 6, 7, 8, 0.031);
  assert(h.terrainAreas.length === 2, 'addGroundPatch should register second terrain area');
  assert(h.platforms.length === 1, 'addGroundPatch should register platform only when top > 0.03');
  assert(h.callbackOrder[0][0] === 'terrain' && h.callbackOrder[1][0] === 'terrain' && h.callbackOrder[2][0] === 'platform', 'addGroundPatch should call addTerrainArea before addPlatform');
}

{
  const h = makeHarness({ terrainTop: 4.2 });
  const wall = h.village.addLowWall(5, 6, 7, 8, 1.5);
  assert(wall.parent === h.village.mapRoot, 'addLowWall should parent mesh to mapRoot');
  assertVector(wall.position, [5, 4.95, 6], 'addLowWall mesh position');
  assert(JSON.stringify(h.terrainCalls) === JSON.stringify([[5, 6]]), 'addLowWall should sample default top at wall center');
  assertArgs(h.colliders[0], [5, 6, 7, 8, 4.2, 5.7], 'addLowWall collider');
  assert(h.village.mapFeatures[0].type === 'wall', 'addLowWall should register wall feature');
}

{
  const h = makeHarness();
  const step = h.village.addStep(1, 2, 3, 4, 0.6);
  assert(step.geometry.type === 'BoxGeometry', 'addStep should create box mesh');
  assertArgs(step.geometry.args, [3, 0.6, 4], 'addStep geometry');
  assertVector(step.position, [1, 0.3, 2], 'addStep mesh position');
  assertArgs(h.platforms[0], [1, 2, 3, 4, 0.6], 'addStep platform');
  assert(h.village.mapFeatures[0].type === 'road', 'addStep should register road feature');
}

{
  const h = makeHarness();
  const building = h.village.addBuilding({
    name: 'shop',
    x: 10,
    z: 20,
    w: 6,
    d: 7,
    top: 1.2,
    rot: 0.3,
    stone: true,
    tower: true,
    sign: 'SHOP',
  });
  assert(building.parent === h.village.mapRoot, 'addBuilding should parent root to mapRoot');
  assertVector(building.position, [10, 1.2, 20], 'addBuilding root position');
  nearly(building.rotation.y, 0.3, 'addBuilding root rotation.y');
  assertArgs(h.colliders[0], [10, 20, 6.8, 7.8, 1.2, 6.7], 'addBuilding collider');
  assert(JSON.stringify(h.village.mapFeatures[0]) === JSON.stringify({
    type: 'building',
    name: 'shop',
    sign: 'SHOP',
    x: 10,
    z: 20,
    w: 6,
    d: 7,
    rot: 0.3,
    top: 1.2,
    roofColor: 0x6d3a30,
    stone: true,
    tower: true,
  }), 'addBuilding should register exact map feature');
  assert(h.village.mapRoot.children.length === 2, 'addBuilding with sign should add building root and sign group');
}

{
  const h = makeHarness();
  const home = h.village.addPlayerHome({ x: 10, z: 20, top: 2, rot: Math.PI / 2 });
  assert(home.parent === h.village.mapRoot, 'addPlayerHome should parent root to mapRoot');
  assert(JSON.stringify(h.village.mapFeatures[0]) === JSON.stringify({
    type: 'building',
    name: 'player-home',
    sign: 'HOME',
    x: 10,
    z: 20,
    w: 9.5,
    d: 9,
    rot: Math.PI / 2,
    top: 2,
    roofColor: 0x6c4738,
    enterable: true,
  }), 'addPlayerHome should register exact map feature');
  assertArgs(h.platformBounds[0], [5.61, 14.39, 15.86, 24.14, 2.13], 'addPlayerHome platform bounds');
  assert(h.colliders.length === 5, 'addPlayerHome should register five local wall colliders');
  assertArgs(h.colliders[0], [5.5, 20, 9.5, 0.36, 2, 6.4], 'addPlayerHome back wall collider');
  assertArgs(h.colliders[1], [10, 24.75, 0.36, 9, 2, 6.4], 'addPlayerHome left wall collider');
  assertArgs(h.colliders[2], [10, 15.25, 0.36, 9, 2, 6.4], 'addPlayerHome right wall collider');
  assertArgs(h.colliders[3], [14.5, 23.05, 3.4, 0.36, 2, 6.4], 'addPlayerHome front left collider');
  assertArgs(h.colliders[4], [14.5, 16.95, 3.4, 0.36, 2, 6.4], 'addPlayerHome front right collider');
}

{
  const h = makeHarness({ terrainTop: 3, randomValue: 0.25 });
  h.village.addTree(7, 8, 1.4, 'Tree_X.gltf');
  assert(h.randomCalls === 1, 'addTree should consume one random for rotation');
  assert(h.placeCalls.length === 1, 'addTree should place one model');
  assert(h.placeCalls[0].path === '../assets/vendor/kaykit_forest/Tree_X.gltf', 'addTree should preserve forest path prefix');
  assert(h.placeCalls[0].x === 7 && h.placeCalls[0].z === 8, 'addTree should pass coordinates through');
  assert(h.placeCalls[0].opts.scale === 1.4, 'addTree should pass scale through');
  nearly(h.placeCalls[0].opts.rot, Math.PI / 2, 'addTree rotation');
  assert(h.placeCalls[0].opts.groundCenter === true, 'addTree should request groundCenter');
  assert(h.placeCalls[0].opts.y === 3, 'addTree should place at terrain height');
  assert(h.placeCalls[0].opts.parent === h.village.mapRoot, 'addTree should default parent to mapRoot');
}

{
  const h = makeHarness({ terrainTop: 2 });
  const parent = new THREE.Group();
  h.village.placeGroundModel('prop.gltf', 1, 2, { y: 0.75, parent, scale: 2 });
  assert(h.placeCalls[0].path === 'prop.gltf', 'placeGroundModel should preserve path');
  assert(h.placeCalls[0].opts.y === 2.75, 'placeGroundModel should offset y by terrain height');
  assert(h.placeCalls[0].opts.parent === parent, 'placeGroundModel should preserve explicit parent');
  assert(h.placeCalls[0].opts.scale === 2, 'placeGroundModel should preserve other opts');
}

{
  const h = makeHarness({ terrainTop: 2, randomValue: 0.5 });
  h.village.addPrimitiveRock(3, 4, 1.6);
  assert(h.randomCalls === 3, 'addPrimitiveRock should consume three random values for rotation');
  const rock = h.village.mapRoot.children[0];
  assert(rock.geometry.type === 'DodecahedronGeometry', 'addPrimitiveRock should create a primitive rock mesh');
  assertArgs(rock.geometry.args, [1.6, 0], 'addPrimitiveRock geometry');
  assertVector(rock.position, [3, 2.8, 4], 'addPrimitiveRock position');
  nearly(rock.scale.y, 0.55, 'addPrimitiveRock vertical scale');
  nearly(rock.rotation.x, 0.5, 'addPrimitiveRock rotation.x');
  nearly(rock.rotation.y, Math.PI / 2, 'addPrimitiveRock rotation.y');
  nearly(rock.rotation.z, 0.5, 'addPrimitiveRock rotation.z');
}

{
  const h = makeHarness({ terrainTop: 0, randomValue: 0.5 });
  assert(h.randomCalls === 0, 'buildNewVillage harness should start without random use');
  h.village.buildNewVillage();
  assert(h.terrainAreas.length === 6, 'buildNewVillage should register six terrain areas');
  assert(h.platforms.length === 0, 'buildNewVillage should not register platforms');
  assert(h.village.mapFeatures.length === 6, 'buildNewVillage should register six map features');
  assert(h.colliders.length === 11, 'buildNewVillage should register eleven colliders');
  assert(h.placeCalls.length === 25, 'buildNewVillage should place eighteen trees and seven props');
  assert(h.randomCalls === 54, 'buildNewVillage should preserve dormant random use count when explicitly called');
  assertArgs(h.terrainAreas[0], [-1, 4, 7, 10, 0], 'buildNewVillage first terrain area');
  assertArgs(h.terrainAreas.at(-1), [-4, 60, 22, 18, 0], 'buildNewVillage plaza terrain area');
  assertArgs(h.colliders[0], [0, 72, 12.8, 18.8, 0, 7], 'buildNewVillage church collider');
  assertArgs(h.colliders[1], [0, 62.5, 5.2, 5.2, 0, 10], 'buildNewVillage church tower collider');
  assertArgs(h.colliders.at(-1), [15, 54, 8.8, 7.8, 0, 4.4], 'buildNewVillage last residence collider');
  assert(h.placeCalls[0].path === '../assets/vendor/kaykit_forest/Tree_2_B_Color1.gltf', 'buildNewVillage first model should be a tree');
  assert(h.placeCalls[0].x === -30 && h.placeCalls[0].z === 10, 'buildNewVillage first tree coordinates');
  nearly(h.placeCalls[0].opts.scale, 1.1, 'buildNewVillage first tree scale');
  nearly(h.placeCalls[0].opts.rot, Math.PI, 'buildNewVillage first tree rotation');
  assert(h.placeCalls.at(-1).path === '../assets/vendor/fantasy_props/Bench.gltf', 'buildNewVillage last model should be bench prop');
  assert(h.placeCalls.at(-1).x === 4 && h.placeCalls.at(-1).z === 63, 'buildNewVillage bench coordinates');
  const pointLights = h.sceneAdds.filter(object => object.isPointLight);
  assert(pointLights.length === 6, 'buildNewVillage lamps should still add PointLights to scene');
  assertVector(pointLights[0].position, [4, 3.5, 11], 'buildNewVillage first lamp light position');
}

assert(mainJs.includes('import { createVillageBlockout } from "./world/village.js";'), 'main.js must import createVillageBlockout');
assert(/createVillageBlockout\s*\(\s*\{[\s\S]*THREE[\s\S]*scene[\s\S]*placeModel[\s\S]*terrainYAt[\s\S]*addCollider[\s\S]*addTerrainArea[\s\S]*addPlatform[\s\S]*addPlatformBounds[\s\S]*documentRef\s*:\s*document[\s\S]*random\s*:\s*Math\.random[\s\S]*\}\s*\)/.test(mainJs), 'main.js should create village blockout with shared dependencies');
assert(mainJs.includes('const ROOM=130;'), 'ROOM should remain in main.js');
assert(mainJs.includes('const hittables=[];'), 'hittables should remain in main.js');
assert(mainJs.includes('//buildNewVillage();'), 'buildNewVillage should remain dormant');
assert(!mainJs.includes('function buildNewVillage()'), 'main.js should not retain inline village builder');
assert(!mainJs.includes('function addGroundPatch'), 'main.js should not retain inline village helpers');
assert(!mainJs.includes('Math.random()*Math.PI*2'), 'main.js should not retain tree random helper');
assert(/function\s+addGroundPatch[\s\S]*addTerrainArea\s*\(\s*x\s*,\s*z\s*,\s*w\s*,\s*d\s*,\s*top\s*\)\s*;[\s\S]*if\s*\(\s*top\s*>\s*0\.03\s*\)\s*addPlatform\s*\(\s*x\s*,\s*z\s*,\s*w\s*,\s*d\s*,\s*top\s*\)/.test(villageJs), 'village addGroundPatch should preserve terrain/platform threshold');
assert(/addPlatformBounds\s*\(\s*x\s*-\s*w\s*\/\s*2\s*\+\s*wallT\s*,\s*x\s*\+\s*w\s*\/\s*2\s*-\s*wallT\s*,\s*z\s*-\s*d\s*\/\s*2\s*\+\s*wallT\s*,\s*z\s*\+\s*d\s*\/\s*2\s*-\s*wallT\s*,\s*floorTop\s*\)/.test(villageJs), 'village player home should preserve exact indoor platform bounds');
assert(/function\s+addLocalCollider[\s\S]*const\s+p\s*=\s*localPoint\s*\(\s*x\s*,\s*z\s*,\s*lx\s*,\s*lz\s*,\s*rot\s*\)\s*;[\s\S]*addCollider\s*\(\s*p\.x\s*,\s*p\.z\s*,\s*w\s*,\s*d\s*,\s*bottom\s*,\s*top\s*\)/.test(villageJs), 'village addLocalCollider should only rotate collider center point');

console.log('Village blockout check passed.');
