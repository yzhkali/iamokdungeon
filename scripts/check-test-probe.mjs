import fs from 'node:fs';
import path from 'node:path';
import { installTestProbe } from '../prototype/3d/src/debug/testProbe.js';

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

function assertKeys(actual, expected, label) {
  const keys = Object.keys(actual);
  assert(JSON.stringify(keys) === JSON.stringify(expected), `${label} keys: got ${JSON.stringify(keys)}`);
}

function makeFixture({ enabled = true, getRenderTarget = () => null } = {}) {
  const globalRef = { __IAMOK_ENABLE_TEST_PROBE__: enabled };
  const camera = { position: { x: 1, y: 2, z: 3 } };
  const cameraRig = {
    yaw: 0.1,
    pitch: 0.2,
    targetYaw: 0.3,
    targetPitch: 0.4,
    minPitch: 0.05,
    maxPitch: 1.2,
  };
  const player = { x: 4, y: 5, z: 6 };
  const renderer = {
    getRenderTarget,
    clippingPlanes: [],
    domElement: { width: 800, height: 450 },
  };
  const waterReflectionMeshes = [{}, { visible: true }];
  const reflRT = { width: 800, height: 450 };
  const sceneRT = { width: 800, height: 450 };
  const probe = installTestProbe({
    globalRef,
    camera,
    cameraRig,
    getPlayer: () => player,
    renderer,
    waterReflectionMeshes,
    reflRT,
    sceneRT,
  });
  return { globalRef, probe, camera, cameraRig, player, renderer, waterReflectionMeshes, reflRT, sceneRT };
}

assert(typeof installTestProbe === 'function', 'testProbe.js must export installTestProbe');
globalThis.__IAMOK_ENABLE_TEST_PROBE__ = true;
delete globalThis.__IAMOK_TEST_PROBE__;
await import(`../prototype/3d/src/debug/testProbe.js?cache=${Date.now()}`);
assert(globalThis.__IAMOK_TEST_PROBE__ === undefined, 'importing testProbe.js should not install a global probe even when the flag is enabled');
delete globalThis.__IAMOK_ENABLE_TEST_PROBE__;

{
  const sentinel = { keep: true };
  const h = makeFixture({ enabled: false });
  h.globalRef.__IAMOK_TEST_PROBE__ = sentinel;
  const result = installTestProbe({
    globalRef: h.globalRef,
    camera: h.camera,
    cameraRig: h.cameraRig,
    getPlayer: () => h.player,
    renderer: h.renderer,
    waterReflectionMeshes: h.waterReflectionMeshes,
    reflRT: h.reflRT,
    sceneRT: h.sceneRT,
  });
  assert(result === null, 'installer should return null when flag is disabled');
  assert(h.globalRef.__IAMOK_TEST_PROBE__ === sentinel, 'disabled installer should not overwrite existing globals');
}

{
  const h = makeFixture();
  assert(h.globalRef.__IAMOK_TEST_PROBE__ === h.probe, 'enabled installer should expose probe on the provided global');
  assertKeys(h.probe, ['camera', 'render'], 'probe');
  assert(typeof h.probe.camera === 'function', 'camera probe should be a function');
  assert(typeof h.probe.render === 'function', 'render probe should be a function');

  const cameraState = h.probe.camera();
  assertKeys(cameraState, [
    'x',
    'y',
    'z',
    'yaw',
    'pitch',
    'targetYaw',
    'targetPitch',
    'minPitch',
    'maxPitch',
    'playerTargetX',
    'playerTargetY',
    'playerTargetZ',
  ], 'camera probe result');
  nearly(cameraState.x, 1, 'camera.x');
  nearly(cameraState.y, 2, 'camera.y');
  nearly(cameraState.z, 3, 'camera.z');
  nearly(cameraState.yaw, 0.1, 'camera yaw');
  nearly(cameraState.pitch, 0.2, 'camera pitch');
  nearly(cameraState.targetYaw, 0.3, 'camera targetYaw');
  nearly(cameraState.targetPitch, 0.4, 'camera targetPitch');
  nearly(cameraState.minPitch, 0.05, 'camera minPitch');
  nearly(cameraState.maxPitch, 1.2, 'camera maxPitch');
  nearly(cameraState.playerTargetX, 4, 'camera playerTargetX');
  nearly(cameraState.playerTargetY, 6.7, 'camera playerTargetY');
  nearly(cameraState.playerTargetZ, 6, 'camera playerTargetZ');

  const renderState = h.probe.render();
  assertKeys(renderState, [
    'renderTargetIsNull',
    'clippingPlanes',
    'waterReflectionMeshesVisible',
    'rendererWidth',
    'rendererHeight',
    'reflWidth',
    'reflHeight',
    'sceneRTWidth',
    'sceneRTHeight',
  ], 'render probe result');
  assert(renderState.renderTargetIsNull === true, 'renderTargetIsNull should reflect null render target');
  assert(renderState.clippingPlanes === 0, 'clippingPlanes length');
  assert(renderState.waterReflectionMeshesVisible === true, 'undefined/true mesh visibility should count as visible');
  assert(renderState.rendererWidth === 800 && renderState.rendererHeight === 450, 'renderer dimensions');
  assert(renderState.reflWidth === 800 && renderState.reflHeight === 450, 'reflection dimensions');
  assert(renderState.sceneRTWidth === 800 && renderState.sceneRTHeight === 450, 'scene RT dimensions');

  h.camera.position.x = 10;
  h.cameraRig.targetYaw = 1.5;
  h.player.y = 8;
  h.renderer.clippingPlanes.push('clip');
  h.renderer.domElement.width = 1024;
  h.reflRT.height = 512;
  h.sceneRT.width = 1024;
  h.waterReflectionMeshes[1].visible = false;
  const nextCamera = h.probe.camera();
  const nextRender = h.probe.render();
  nearly(nextCamera.x, 10, 'camera probe should read live camera values');
  nearly(nextCamera.targetYaw, 1.5, 'camera probe should read live cameraRig values');
  nearly(nextCamera.playerTargetY, 9.7, 'camera probe should read live player values');
  assert(nextRender.clippingPlanes === 1, 'render probe should read live clippingPlanes');
  assert(nextRender.rendererWidth === 1024, 'render probe should read live renderer size');
  assert(nextRender.reflHeight === 512, 'render probe should read live reflection RT size');
  assert(nextRender.sceneRTWidth === 1024, 'render probe should read live scene RT size');
  assert(nextRender.waterReflectionMeshesVisible === false, 'visible=false water mesh should make probe false');
}

{
  const h = makeFixture({ getRenderTarget: () => ({ target: true }) });
  assert(h.probe.render().renderTargetIsNull === false, 'non-null render target should be reported');
}

{
  const h = makeFixture();
  delete h.renderer.getRenderTarget;
  assert(h.probe.render().renderTargetIsNull === true, 'missing getRenderTarget should preserve true fallback');
}

assert(mainJs.includes('import { installTestProbe } from "./debug/testProbe.js";'), 'main.js must import installTestProbe');
assert(/installTestProbe\s*\(\s*\{[\s\S]*camera[\s\S]*cameraRig[\s\S]*getPlayer\s*:\s*\(\s*\)\s*=>\s*P[\s\S]*renderer[\s\S]*waterReflectionMeshes[\s\S]*reflRT[\s\S]*sceneRT[\s\S]*\}\s*\)/.test(mainJs), 'main.js should install the probe with live runtime dependencies');
assert(!/globalThis\.__IAMOK_TEST_PROBE__\s*=/.test(mainJs), 'main.js should not inline the global probe assignment');
const installCallIndex = mainJs.indexOf('installTestProbe({');
assert(mainJs.indexOf('const waterReflectionPass = createWaterReflectionPass') < installCallIndex, 'probe should be installed after water reflection pass setup');
assert(installCallIndex < mainJs.indexOf('const gameLoop = createGameLoop'), 'probe should be installed before game loop setup');

console.log('Test probe check passed.');
