import fs from 'node:fs';
import path from 'node:path';
import { createRenderScene } from '../prototype/3d/src/core/renderScene.js';

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

class FakeRenderer {
  constructor(options) {
    this.options = options;
    this.shadowMap = {};
    this.pixelRatio = null;
  }

  setPixelRatio(value) {
    this.pixelRatio = value;
  }
}

class FakeRenderTarget {
  constructor(width, height) {
    this.width = width;
    this.height = height;
  }
}

class FakeCamera {
  constructor(...args) {
    this.args = args;
    this.matrixAutoUpdate = true;
  }
}

class FakeVector3 {
  constructor(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
}

class FakePlane {
  constructor(normal, constant) {
    this.normal = normal;
    this.constant = constant;
  }
}

class FakeScene {
  constructor() {
    this.children = [];
    this.background = null;
  }

  add(child) {
    this.children.push(child);
  }
}

class FakeColor {
  constructor(hex) {
    this.hex = hex;
  }
}

class FakeHemisphereLight {
  constructor(skyColor, groundColor, intensity) {
    this.type = 'HemisphereLight';
    this.skyColor = skyColor;
    this.groundColor = groundColor;
    this.intensity = intensity;
  }
}

class FakeDirectionalLight {
  constructor(color, intensity) {
    this.type = 'DirectionalLight';
    this.color = color;
    this.intensity = intensity;
    this.position = new FakeTransform();
    this.castShadow = false;
    this.shadow = {
      mapSize: new FakeTransform(),
      camera: {},
      bias: 0,
    };
  }
}

const THREE = {
  PCFSoftShadowMap: 'PCFSoftShadowMap',
  WebGLRenderer: FakeRenderer,
  WebGLRenderTarget: FakeRenderTarget,
  PerspectiveCamera: FakeCamera,
  Plane: FakePlane,
  Vector3: FakeVector3,
  Matrix4: class FakeMatrix4 {},
  Scene: FakeScene,
  Color: FakeColor,
  HemisphereLight: FakeHemisphereLight,
  DirectionalLight: FakeDirectionalLight,
  MathUtils: {
    degToRad: degrees => degrees * Math.PI / 180,
  },
};

const canvas = { id: 'c' };
const runtime = createRenderScene({ THREE, canvas, pixelRatio: 3 });

assert(runtime.renderer.options.canvas === canvas, 'renderer should use the provided canvas');
assert(runtime.renderer.options.antialias === true, 'renderer should preserve antialias setting');
assert(runtime.renderer.pixelRatio === 2, 'renderer pixel ratio should clamp to 2');
assert(runtime.renderer.shadowMap.enabled === true, 'renderer should enable shadows');
assert(runtime.renderer.shadowMap.type === THREE.PCFSoftShadowMap, 'renderer should use PCF soft shadows');

assert(runtime.sceneRT.width === 1 && runtime.sceneRT.height === 1, 'sceneRT should start 1x1');
assert(runtime.reflRT.width === 1 && runtime.reflRT.height === 1, 'reflRT should start 1x1');
assert(runtime.reflCam.matrixAutoUpdate === false, 'reflection camera matrix should stay manual');
assert(runtime.reflClip.normal.x === 0 && runtime.reflClip.normal.y === 1 && runtime.reflClip.normal.z === 0, 'reflection clip normal');
assert(runtime.reflClip.constant === 0, 'reflection clip constant');

assert(runtime.scene.background.hex === 0xbbd0df, 'scene background color should stay unchanged');
assert(JSON.stringify(runtime.camera.args) === JSON.stringify([45, 1, 0.1, 2000]), 'main camera should keep perspective arguments');

const rig = runtime.cameraRig;
nearly(rig.pitch, THREE.MathUtils.degToRad(43), 'cameraRig pitch');
nearly(rig.targetPitch, THREE.MathUtils.degToRad(43), 'cameraRig targetPitch');
assert(rig.distance === 43 && rig.outdoorDistance === 43 && rig.indoorDistance === 11, 'cameraRig distances');
assert(rig.currentDistance === 43 && rig.minDistance === 12 && rig.indoorMinDistance === 2.4 && rig.maxDistance === 90, 'cameraRig distance clamps');
nearly(rig.minPitch, THREE.MathUtils.degToRad(8), 'cameraRig min pitch');
nearly(rig.maxPitch, THREE.MathUtils.degToRad(78), 'cameraRig max pitch');
nearly(rig.indoorMinPitch, THREE.MathUtils.degToRad(16), 'cameraRig indoor min pitch');
nearly(rig.indoorMaxPitch, THREE.MathUtils.degToRad(48), 'cameraRig indoor max pitch');
assert(rig.yawSpeed === 1.55 && rig.pitchSpeed === 1.05 && rig.stickX === 0 && rig.stickY === 0, 'cameraRig speeds and sticks');

assert(runtime.scene.children.length === 2, 'scene should get hemisphere and sun lights');
const [hemi, sun] = runtime.scene.children;
assert(hemi.type === 'HemisphereLight' && hemi.skyColor === 0xb9c6d6 && hemi.groundColor === 0x4a3f36 && hemi.intensity === 0.75, 'hemisphere light settings');
assert(sun === runtime.sun, 'sun should be returned for inspection');
assert(sun.type === 'DirectionalLight' && sun.color === 0xfff2d8 && sun.intensity === 1.15, 'sun light settings');
assert(sun.position.x === 12 && sun.position.y === 26 && sun.position.z === 10, 'sun position');
assert(sun.castShadow === true, 'sun should cast shadows');
assert(sun.shadow.mapSize.x === 2048 && sun.shadow.mapSize.y === 2048, 'sun shadow map size');
assert(sun.shadow.camera.near === 1 && sun.shadow.camera.far === 140, 'sun shadow camera depth');
assert(sun.shadow.camera.left === -60 && sun.shadow.camera.right === 60 && sun.shadow.camera.top === 60 && sun.shadow.camera.bottom === -60, 'sun shadow camera bounds');
assert(sun.shadow.bias === -0.0005, 'sun shadow bias');

assert(mainJs.includes('import { createRenderScene } from "./core/renderScene.js";'), 'main.js must import render scene module');
assert(/createRenderScene\s*\(\s*\{\s*THREE\s*,\s*canvas\s*,\s*pixelRatio\s*:\s*devicePixelRatio\s*\}\s*\)/.test(mainJs), 'main.js must create render scene with local canvas and device pixel ratio');
assert(!mainJs.includes('new THREE.WebGLRenderer'), 'main.js should not retain inline renderer construction');
assert(!mainJs.includes('new THREE.HemisphereLight'), 'main.js should not retain inline hemisphere light');
assert(!mainJs.includes('new THREE.DirectionalLight'), 'main.js should not retain inline sun light');
assert(!mainJs.includes('const cameraRig={'), 'main.js should not retain inline cameraRig literal');

console.log('Render scene check passed.');
