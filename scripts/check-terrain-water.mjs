import fs from 'node:fs';
import path from 'node:path';
import { buildTerrainWater } from '../prototype/3d/src/world/terrainWater.js';

const repoRoot = process.cwd();
const mainJs = fs.readFileSync(path.join(repoRoot, 'prototype/3d/src/main.js'), 'utf8');
const terrainWaterJs = fs.readFileSync(path.join(repoRoot, 'prototype/3d/src/world/terrainWater.js'), 'utf8');
const runtimeServicesJs = fs.readFileSync(path.join(repoRoot, 'prototype/3d/src/core/runtimeServices.js'), 'utf8');
const mapData = JSON.parse(fs.readFileSync(path.join(repoRoot, 'prototype/3d/maps/map15.json'), 'utf8'));
const mapHeights = new Float32Array(mapData.terrain);

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

  normalize() {
    const length = Math.hypot(this.x, this.y, this.z) || 1;
    this.x /= length;
    this.y /= length;
    this.z /= length;
    return this;
  }
}

class FakeEuler extends FakeVector3 {}

class FakeObject3D {
  constructor() {
    this.position = new FakeVector3();
    this.rotation = new FakeEuler();
    this.visible = true;
  }
}

class FakeMesh extends FakeObject3D {
  constructor(geometry, material) {
    super();
    this.geometry = geometry;
    this.material = material;
    this.receiveShadow = false;
    this.castShadow = false;
  }
}

class FakeAttribute {
  constructor(array, itemSize) {
    this.array = array;
    this.itemSize = itemSize;
    this.count = array.length / itemSize;
  }

  getX(index) {
    return this.array[index * this.itemSize];
  }

  getZ(index) {
    return this.array[index * this.itemSize + 2];
  }

  setY(index, value) {
    this.array[index * this.itemSize + 1] = value;
  }
}

class FakeBufferAttribute extends FakeAttribute {}

class FakeGeometry {
  constructor(type) {
    this.type = type;
    this.attributes = {};
    this.index = null;
    this.rotatedX = null;
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

  clone() {
    const copy = new FakeGeometry(this.type);
    for (const [name, attr] of Object.entries(this.attributes)) {
      copy.attributes[name] = new FakeBufferAttribute(new attr.array.constructor(attr.array), attr.itemSize);
    }
    copy.index = Array.isArray(this.index) ? [...this.index] : this.index;
    copy.rotatedX = this.rotatedX;
    copy.normalsComputed = this.normalsComputed;
    return copy;
  }
}

class FakePlaneGeometry extends FakeGeometry {
  constructor(width, height, widthSegments = 1, heightSegments = 1) {
    super('PlaneGeometry');
    this.args = [width, height, widthSegments, heightSegments];
    const cols = widthSegments + 1;
    const rows = heightSegments + 1;
    const data = new Float32Array(cols * rows * 3);
    let offset = 0;
    for (let iy = 0; iy < rows; iy += 1) {
      for (let ix = 0; ix < cols; ix += 1) {
        data[offset++] = ix / widthSegments * width - width / 2;
        data[offset++] = 0;
        data[offset++] = iy / heightSegments * height - height / 2;
      }
    }
    this.attributes.position = new FakeAttribute(data, 3);
  }

  rotateX(value) {
    this.rotatedX = value;
  }
}

class FakeBufferGeometry extends FakeGeometry {
  constructor() {
    super('BufferGeometry');
  }
}

class FakeMaterial {
  constructor(options = {}) {
    Object.assign(this, options);
    this.options = options;
  }
}

const textureLoads = [];
class FakeTexture {
  constructor(src) {
    this.src = src;
    this.wrapS = null;
    this.wrapT = null;
    this.minFilter = null;
    this.magFilter = null;
    this.needsUpdate = false;
    this.offset = {
      calls: [],
      set(x, y) {
        this.calls.push([x, y]);
      },
    };
  }
}

class FakeTextureLoader {
  load(src) {
    const texture = new FakeTexture(src);
    textureLoads.push(texture);
    return texture;
  }
}

class FakeCanvasTexture extends FakeTexture {
  constructor(canvas) {
    super('CanvasTexture');
    this.canvas = canvas;
  }
}

class FakeDataTexture extends FakeTexture {
  constructor(data, width, height, format, type) {
    super('DataTexture');
    this.image = { data, width, height };
    this.format = format;
    this.dataType = type;
    this.flipY = true;
  }
}

const THREE = {
  RepeatWrapping: 'RepeatWrapping',
  ClampToEdgeWrapping: 'ClampToEdgeWrapping',
  LinearFilter: 'LinearFilter',
  RedFormat: 'RedFormat',
  FloatType: 'FloatType',
  FrontSide: 'FrontSide',
  DoubleSide: 'DoubleSide',
  Vector2: class {
    constructor(x = 0, y = 0) {
      this.x = x;
      this.y = y;
    }
  },
  Vector3: FakeVector3,
  Color: class {
    constructor(value) {
      if (typeof value === 'string') value = Number.parseInt(value.slice(1), 16);
      this.r = ((value >> 16) & 255) / 255;
      this.g = ((value >> 8) & 255) / 255;
      this.b = (value & 255) / 255;
    }

    clone() {
      const copy = Object.create(this.constructor.prototype);
      copy.r = this.r;
      copy.g = this.g;
      copy.b = this.b;
      return copy;
    }

    lerp(other, alpha) {
      this.r += (other.r - this.r) * alpha;
      this.g += (other.g - this.g) * alpha;
      this.b += (other.b - this.b) * alpha;
      return this;
    }
  },
  PlaneGeometry: FakePlaneGeometry,
  BufferGeometry: FakeBufferGeometry,
  BufferAttribute: FakeBufferAttribute,
  Mesh: FakeMesh,
  MeshLambertMaterial: class extends FakeMaterial {},
  MeshStandardMaterial: class extends FakeMaterial {},
  MeshBasicMaterial: class extends FakeMaterial {},
  ShaderMaterial: class extends FakeMaterial {},
  TextureLoader: FakeTextureLoader,
  CanvasTexture: FakeCanvasTexture,
  DataTexture: FakeDataTexture,
};

let lastImageData = null;
const documentRef = {
  createElement(type) {
    assert(type === 'canvas', 'terrain water should only create a canvas');
    return {
      width: 0,
      height: 0,
      getContext(kind) {
        assert(kind === '2d', 'road mask should request 2d canvas context');
        return {
          fillStyle: '',
          fillRect() {},
          createImageData(width, height) {
            return { width, height, data: new Uint8ClampedArray(width * height * 4) };
          },
          putImageData(imageData) {
            lastImageData = imageData;
          },
        };
      },
    };
  },
};

function expectedTerrainHeight(x, z) {
  const size = 260;
  const seg = 130;
  const ix = Math.max(0, Math.min(seg, Math.round((x + size / 2) / size * seg)));
  const iz = Math.max(0, Math.min(seg, Math.round((z + size / 2) / size * seg)));
  return mapHeights[iz * (seg + 1) + ix] ?? 0;
}

function expectedColor(height) {
  const cDark = new THREE.Color(0x446070);
  const cLow = new THREE.Color(0xf0efe8);
  const cHigh = new THREE.Color(0xeae8e0);
  const cRock = new THREE.Color(0xe8e8e6);
  const cSnow = new THREE.Color(0xf0eef4);
  if (height < -1) return cDark.clone().lerp(cLow, Math.min(1, (height + 6) / 5));
  if (height < 5) return cLow.clone().lerp(cHigh, Math.min(1, (height + 1) / 6));
  if (height < 10) return cHigh.clone().lerp(cRock, (height - 5) / 5);
  return cRock.clone().lerp(cSnow, Math.min(1, (height - 10) / 10));
}

function buildExpectedRoadMask() {
  const seg = 130;
  const size = 260;
  const vCount = (seg + 1) * (seg + 1);
  const mask = new Float32Array(vCount);
  const junc = new Float32Array(vCount);
  const cnt = new Float32Array(vCount);
  mapData.roads.forEach((pts, ri) => {
    const hw = (mapData.roadWidths[ri] || 8) / 2;
    const fw = hw + 6;
    for (let iz = 0; iz <= seg; iz += 1) {
      for (let ix = 0; ix <= seg; ix += 1) {
        const vx = (ix / seg - 0.5) * size;
        const vz = (iz / seg - 0.5) * size;
        let md = 1e9;
        for (let j = 0; j < pts.length - 1; j += 1) {
          const [ax, az] = pts[j];
          const [bx, bz] = pts[j + 1];
          const dx = bx - ax;
          const dz = bz - az;
          const l2 = dx * dx + dz * dz;
          if (l2 < 1e-6) continue;
          const t = Math.max(0, Math.min(1, ((vx - ax) * dx + (vz - az) * dz) / l2));
          md = Math.min(md, Math.hypot(vx - (ax + t * dx), vz - (az + t * dz)));
        }
        const i = iz * (seg + 1) + ix;
        if (md < fw) {
          mask[i] = Math.max(mask[i], Math.max(0, 1 - md / fw));
          if (md < hw + 5) cnt[i] += 1;
        }
      }
    }
  });
  for (let i = 0; i < vCount; i += 1) junc[i] = Math.min(1, (cnt[i] - 1) * 0.7);
  const out = new Uint8ClampedArray(vCount * 4);
  for (let i = 0; i < vCount; i += 1) {
    out[i * 4] = mask[i] * 255 | 0;
    out[i * 4 + 1] = junc[i] * 255 | 0;
    out[i * 4 + 3] = 255;
  }
  return out;
}

function countLoads(src) {
  return textureLoads.filter(texture => texture.src === src).length;
}

const sceneAdds = [];
const scene = {
  add(object) {
    sceneAdds.push(object);
  },
};
const sceneRT = { texture: { id: 'sceneRT.texture' } };
const reflRT = { texture: { id: 'reflRT.texture' } };
const terrainWater = buildTerrainWater({
  THREE,
  scene,
  mapData,
  mapHeights,
  sceneRT,
  reflRT,
  documentRef,
  windowRef: { innerWidth: 1234, innerHeight: 567 },
});

assert(typeof buildTerrainWater === 'function', 'terrainWater.js must export buildTerrainWater');
assert(typeof terrainWater.terrainHeightAt === 'function', 'terrainWater should return terrainHeightAt');
assert(typeof terrainWater.updateWater === 'function', 'terrainWater should return updateWater');
assert(Array.isArray(terrainWater.waterReflectionMeshes), 'terrainWater should return waterReflectionMeshes array');
assert(terrainWater.getWaterSurfaceMaterial() === terrainWater.waterReflectionMeshes[0].material, 'water surface getter should return main water material');

for (const [x, z] of [[-130, -130], [0, 0], [130, 130], [-999, 999], [42.4, -17.8]]) {
  nearly(terrainWater.terrainHeightAt(x, z), expectedTerrainHeight(x, z), `terrain height ${x},${z}`);
}

const terrainMesh = terrainWater.terrainMesh;
assert(terrainMesh.geometry.type === 'PlaneGeometry', 'terrain mesh should use PlaneGeometry');
assert(JSON.stringify(terrainMesh.geometry.args) === JSON.stringify([260, 260, 130, 130]), 'terrain geometry args');
nearly(terrainMesh.geometry.rotatedX, -Math.PI / 2, 'terrain rotateX');
assert(terrainMesh.geometry.attributes.position.count === 17161, 'terrain vertex count');
assert(terrainMesh.receiveShadow === true, 'terrain should receive shadows');
assert(terrainMesh.geometry.normalsComputed === true, 'terrain should compute normals');

const pos = terrainMesh.geometry.attributes.position;
const colors = terrainMesh.geometry.attributes.color;
for (const index of [0, 65, 8580, 17160]) {
  nearly(pos.array[index * 3 + 1], mapHeights[index], `terrain vertex height ${index}`);
  const color = expectedColor(mapHeights[index]);
  nearly(colors.array[index * 3], color.r, `terrain vertex color r ${index}`);
  nearly(colors.array[index * 3 + 1], color.g, `terrain vertex color g ${index}`);
  nearly(colors.array[index * 3 + 2], color.b, `terrain vertex color b ${index}`);
}

assert(countLoads('./textures/texture_road.png') === 2, 'texture_road.png should be loaded twice');
assert(countLoads('./textures/texture_caustics.png') === 2, 'texture_caustics.png should be loaded twice');
assert(countLoads('./textures/water_foam_godot.png') === 2, 'water_foam_godot.png should be loaded twice');
assert(countLoads('./textures/texture_waterfall.png') === 2, 'texture_waterfall.png should be loaded twice');
assert(countLoads('./textures/texture_waterfall_mist_splash.png') === 1, 'mist splash texture should still be loaded once');

for (const src of [
  './textures/texture_grass.png',
  './textures/texture_rock.png',
  './textures/texture_mountain.png',
  './textures/mud-riverbank-tile-512.png',
  './textures/texture_road.png',
  './textures/texture_water.png',
  './textures/texture_water_foam.png',
  './textures/texture_waterfall.png',
  './textures/texture_water_normal.png',
  './textures/texture_caustics.png',
  './textures/water_normal_a.png',
  './textures/water_normal_b.png',
  './textures/water_uv.png',
  './textures/water_foam_godot.png',
]) {
  assert(textureLoads.some(texture => texture.src === src && texture.wrapS === THREE.RepeatWrapping && texture.wrapT === THREE.RepeatWrapping), `${src} should use repeat wrapping`);
}

assert(lastImageData?.width === 131 && lastImageData?.height === 131, 'road mask should write 131x131 image data');
const expectedMask = buildExpectedRoadMask();
assert(lastImageData.data.length === expectedMask.length, 'road mask byte length');
let redPixels = 0;
let greenPixels = 0;
for (let i = 0; i < expectedMask.length; i += 4) {
  assert(lastImageData.data[i] === expectedMask[i], `road mask red byte ${i}`);
  assert(lastImageData.data[i + 1] === expectedMask[i + 1], `road mask green byte ${i + 1}`);
  assert(lastImageData.data[i + 3] === 255, `road mask alpha byte ${i + 3}`);
  if (lastImageData.data[i]) redPixels += 1;
  if (lastImageData.data[i + 1]) greenPixels += 1;
}
assert(redPixels > 0, 'road mask should contain road pixels');
assert(greenPixels > 0, 'road mask should contain junction pixels');

const waterSurface = terrainWater.getWaterSurfaceMaterial();
assert(waterSurface.uniforms.tScene.value === sceneRT.texture, 'water material should use sceneRT texture');
assert(waterSurface.uniforms.tReflect.value === reflRT.texture, 'water material should use reflRT texture');
assert(waterSurface.uniforms.uRes.value.x === 1234 && waterSurface.uniforms.uRes.value.y === 567, 'water uRes initial size');
assert(waterSurface.uniforms.tHmap.value.image.data.length === mapHeights.length, 'heightmap texture data length');
assert(waterSurface.uniforms.tHmap.value.flipY === false, 'heightmap flipY should be false');
assert(waterSurface.uniforms.tHmap.value.wrapS === THREE.ClampToEdgeWrapping, 'heightmap wrapS');
assert(waterSurface.uniforms.tHmap.value.minFilter === THREE.LinearFilter, 'heightmap minFilter');

assert(terrainWater.waterReflectionMeshes.length === 1 + mapData.waterSurfs.length, 'water reflection mesh count should include main water and water paths');
const mainWater = terrainWater.waterReflectionMeshes[0];
assert(JSON.stringify(mainWater.geometry.args) === JSON.stringify([260, 260, 60, 60]), 'main water plane geometry');
nearly(mainWater.rotation.x, -Math.PI / 2, 'main water rotation');
nearly(mainWater.position.y, -2, 'main water height');
const waterPath = terrainWater.waterReflectionMeshes[1];
assert(waterPath.renderOrder === 2, 'water path renderOrder');
assert(waterPath.geometry.attributes.position.array.length > 0, 'water path should have positions');
assert(waterPath.geometry.attributes.uv.array.length > 0, 'water path should have uvs');
assert(Array.isArray(waterPath.geometry.index) && waterPath.geometry.index.length > 0, 'water path should have indices');

const expectedWaterfallMeshes = (mapData.wfSurfs || []).length * 5;
const waterfallMeshes = sceneAdds.filter(object => object.material?.uniforms?.tWf);
assert(waterfallMeshes.length === expectedWaterfallMeshes, 'each waterfall should create five meshes');

terrainWater.updateWater(12.5);
nearly(waterSurface.uniforms.uT.value, 12.5, 'water uT update');
for (const mesh of waterfallMeshes) nearly(mesh.material.uniforms.uT.value, 12.5, 'waterfall uT update');
const firstCaustic = textureLoads.find(texture => texture.src === './textures/texture_caustics.png');
assert(JSON.stringify(firstCaustic.offset.calls.at(-1)) === JSON.stringify([(12.5 * .025) % 1, (12.5 * .018) % 1]), 'caustic offset update');

assert(mainJs.includes('import { buildTerrainWater } from "./world/terrainWater.js";'), 'main.js must import buildTerrainWater');
assert(/buildTerrainWater\s*\(\s*\{[\s\S]*THREE[\s\S]*scene[\s\S]*mapData\s*:\s*_m15[\s\S]*mapHeights\s*:\s*_mapH[\s\S]*sceneRT[\s\S]*reflRT[\s\S]*documentRef\s*:\s*document[\s\S]*windowRef\s*:\s*window[\s\S]*\}\s*\)/.test(mainJs), 'main.js should build terrain water with shared dependencies');
assert(mainJs.includes('const terrainH = terrainWater.terrainHeightAt;'), 'main.js should consume returned terrain height function');
assert(mainJs.includes('const updateWater = terrainWater.updateWater;'), 'main.js should consume returned updateWater');
assert(mainJs.includes('const waterReflectionMeshes = terrainWater.waterReflectionMeshes;'), 'main.js should consume returned water reflection meshes');
assert(mainJs.includes('const getWaterSurfaceMaterial = terrainWater.getWaterSurfaceMaterial;'), 'main.js should consume returned material getter');
assert(/createWorldCollision\s*\(\s*\{\s*terrainHeightAt\s*:\s*terrainH\s*\}\s*\)/.test(mainJs), 'collision should still use terrainH');
assert(/createWaterReflectionPassFn\s*\(\s*\{[\s\S]*waterReflectionMeshes[\s\S]*getWaterSurfaceMaterial[\s\S]*\}\s*\)/.test(runtimeServicesJs), 'reflection pass should use returned water dependencies');
assert(/startRuntimeLoop\s*\(\s*\{[\s\S]*updateWater[\s\S]*waterReflectionPass[\s\S]*\}\s*\)/.test(mainJs), 'game loop should still receive updateWater');
assert(!mainJs.includes('function terrainH(x,z)'), 'main.js should not retain inline terrainH');
assert(!mainJs.includes('function updateWater(t)'), 'main.js should not retain inline updateWater');
assert(!mainJs.includes('function _buildRoadMask'), 'main.js should not retain inline road mask builder');
assert(!mainJs.includes('function makeWaterPath'), 'main.js should not retain inline water path builder');
assert(!mainJs.includes('function makeWaterfallPath'), 'main.js should not retain inline waterfall builder');
assert(!mainJs.includes('let fallCurtainMat=null,waterMats=[],waterReflectionMeshes=[]'), 'main.js should not retain inline terrain water state');
assert(terrainWaterJs.includes("load('./textures/texture_water.png')"), 'terrainWater should preserve page-relative texture paths');

console.log('Terrain water check passed.');
