import fs from 'node:fs';
import path from 'node:path';
import { createRuntimeServices, startRuntimeLoop, startRuntimeView } from '../prototype/3d/src/core/runtimeServices.js';

const repoRoot = process.cwd();
const mainJs = fs.readFileSync(path.join(repoRoot, 'prototype/3d/src/main.js'), 'utf8');
const runtimeServicesJs = fs.readFileSync(path.join(repoRoot, 'prototype/3d/src/core/runtimeServices.js'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function same(actual, expected, message) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${message}: got ${a}, expected ${e}`);
}

{
  const events = [];
  const deps = {
    THREE: { name: 'THREE' },
    roomSize: 130,
    mapFeatures: [{ type: 'home' }],
    player: { x: 1 },
    getPlayer() { return deps.player; },
    heavyChargeTime: 1,
    clearGameplayInputState() {},
    documentRef: { name: 'document' },
    windowRef: { name: 'window' },
    globalRef: { name: 'global' },
    renderer: { name: 'renderer' },
    scene: { name: 'scene' },
    camera: { name: 'camera' },
    cameraRig: { name: 'cameraRig' },
    reflRT: { name: 'reflRT' },
    sceneRT: { name: 'sceneRT' },
    reflCam: { name: 'reflCam' },
    reflClip: { name: 'reflClip' },
    reflMatrix: { name: 'reflMatrix' },
    waterReflectionMeshes: [{ visible: true }],
    getWaterSurfaceMaterial() { return { name: 'waterMat' }; },
  };
  const mapHud = { name: 'mapHud' };
  const waterReflectionPass = { name: 'waterReflectionPass' };
  const services = createRuntimeServices({
    ...deps,
    createMapHudFn(options) {
      events.push(['createMapHud', options]);
      return mapHud;
    },
    createWaterReflectionPassFn(options) {
      events.push(['createWaterReflectionPass', options]);
      return waterReflectionPass;
    },
    installTestProbeFn(options) {
      events.push(['installTestProbe', options]);
    },
  });

  assert(services.mapHud === mapHud, 'createRuntimeServices should return mapHud');
  assert(services.waterReflectionPass === waterReflectionPass, 'createRuntimeServices should return waterReflectionPass');
  assert(events[0][0] === 'createMapHud', 'mapHud should be created first');
  assert(events[1][0] === 'createWaterReflectionPass', 'water reflection pass should be created second');
  assert(events[2][0] === 'installTestProbe', 'test probe should be installed after reflection pass');
  const mapOptions = events[0][1];
  assert(mapOptions.THREE === deps.THREE && mapOptions.roomSize === 130 && mapOptions.mapFeatures === deps.mapFeatures, 'mapHud should receive map dependencies');
  assert(mapOptions.getPlayer() === deps.player, 'mapHud should receive live player getter');
  assert(mapOptions.heavyChargeTime === 1 && mapOptions.clearGameplayInputState === deps.clearGameplayInputState, 'mapHud should receive HUD state dependencies');
  assert(mapOptions.documentRef === deps.documentRef && mapOptions.windowRef === deps.windowRef, 'mapHud should receive DOM dependencies');
  const reflectionOptions = events[1][1];
  assert(reflectionOptions.renderer === deps.renderer && reflectionOptions.scene === deps.scene && reflectionOptions.camera === deps.camera, 'reflection pass should receive render dependencies');
  assert(reflectionOptions.reflRT === deps.reflRT && reflectionOptions.sceneRT === deps.sceneRT && reflectionOptions.reflCam === deps.reflCam, 'reflection pass should receive render targets and reflection camera');
  assert(reflectionOptions.reflClip === deps.reflClip && reflectionOptions.reflMatrix === deps.reflMatrix, 'reflection pass should receive reflection math dependencies');
  assert(reflectionOptions.waterReflectionMeshes === deps.waterReflectionMeshes && reflectionOptions.getWaterSurfaceMaterial === deps.getWaterSurfaceMaterial, 'reflection pass should receive water dependencies');
  const probeOptions = events[2][1];
  assert(probeOptions.globalRef === deps.globalRef, 'probe should receive globalRef');
  assert(probeOptions.camera === deps.camera && probeOptions.cameraRig === deps.cameraRig, 'probe should receive camera dependencies');
  assert(probeOptions.getPlayer() === deps.player && probeOptions.renderer === deps.renderer, 'probe should receive live player and renderer');
  assert(probeOptions.waterReflectionMeshes === deps.waterReflectionMeshes && probeOptions.reflRT === deps.reflRT && probeOptions.sceneRT === deps.sceneRT, 'probe should receive render target dependencies');
}

{
  const events = [];
  const loading = { style: { display: 'block' } };
  const renderer = {
    setSize(w, h) { events.push(['setSize', w, h]); },
  };
  const camera = {
    aspect: 0,
    updateProjectionMatrix() { events.push(['updateProjectionMatrix', this.aspect]); },
  };
  const documentRef = {
    getElementById(id) {
      assert(id === 'loading', 'runtime view should query loading element');
      return loading;
    },
  };
  const listeners = [];
  const windowRef = {
    innerWidth: 1280,
    innerHeight: 720,
    addEventListener(type, listener) {
      events.push(['addEventListener', type]);
      listeners.push(listener);
    },
  };
  let padCount = 0;
  const { resize } = startRuntimeView({
    renderer,
    camera,
    documentRef,
    windowRef,
    padStatus() { padCount += 1; events.push(['padStatus']); },
  });
  same(events, [
    ['addEventListener', 'resize'],
    ['setSize', 1280, 720],
    ['updateProjectionMatrix', 1280 / 720],
    ['padStatus'],
  ], 'runtime view startup order');
  assert(loading.style.display === 'none', 'runtime view should hide loading element');
  assert(padCount === 1, 'runtime view should call padStatus once');
  windowRef.innerWidth = 800;
  windowRef.innerHeight = 600;
  resize();
  same(events.slice(-2), [['setSize', 800, 600], ['updateProjectionMatrix', 800 / 600]], 'manual resize should update renderer and camera');
  windowRef.innerWidth = 640;
  windowRef.innerHeight = 480;
  listeners[0]();
  same(events.slice(-2), [['setSize', 640, 480], ['updateProjectionMatrix', 640 / 480]], 'registered resize listener should update renderer and camera');
}

{
  const events = [];
  const deps = {
    clock: { name: 'clock' },
    update: () => {},
    updateWolf: () => {},
    updateSky: () => {},
    getSkyData: () => {},
    camera: { name: 'camera' },
    updateWater: () => {},
    cameraController: { name: 'cameraController' },
    mapHud: { name: 'mapHud' },
    updateGrass: () => {},
    getGrassMats: () => [],
    waterReflectionPass: { name: 'waterReflectionPass' },
    renderer: { name: 'renderer' },
    scene: { name: 'scene' },
  };
  const gameLoop = startRuntimeLoop({
    ...deps,
    createGameLoopFn(options) {
      events.push(['createGameLoop', options]);
      return {
        start() { events.push(['start']); },
      };
    },
  });
  assert(gameLoop, 'startRuntimeLoop should return the created game loop');
  assert(events[0][0] === 'createGameLoop' && events[1][0] === 'start', 'startRuntimeLoop should create and start the loop');
  const options = events[0][1];
  for (const key of Object.keys(deps)) assert(options[key] === deps[key], `game loop should receive ${key}`);
}

assert(mainJs.includes('import { createRuntimeServices, startRuntimeLoop, startRuntimeView } from "./core/runtimeServices.js";'), 'main.js must import runtime service helpers');
assert(/const\s+\{\s*mapHud\s*,\s*waterReflectionPass\s*\}\s*=\s*createRuntimeServices\s*\(\s*\{[\s\S]*THREE[\s\S]*roomSize\s*:\s*ROOM[\s\S]*mapFeatures[\s\S]*getPlayer\s*:\s*\(\s*\)\s*=>\s*P[\s\S]*heavyChargeTime\s*:\s*HEAVY_CHARGE_TIME[\s\S]*clearGameplayInputState[\s\S]*documentRef\s*:\s*document[\s\S]*windowRef\s*:\s*window[\s\S]*globalRef\s*:\s*globalThis[\s\S]*renderer[\s\S]*cameraRig[\s\S]*waterReflectionMeshes[\s\S]*getWaterSurfaceMaterial[\s\S]*\}\s*\)/.test(mainJs), 'main.js should wire runtime services with live dependencies');
assert(/startRuntimeView\s*\(\s*\{[\s\S]*renderer[\s\S]*camera[\s\S]*documentRef\s*:\s*document[\s\S]*windowRef\s*:\s*window[\s\S]*padStatus[\s\S]*\}\s*\)/.test(mainJs), 'main.js should start runtime view with DOM dependencies');
assert(/startRuntimeLoop\s*\(\s*\{[\s\S]*clock[\s\S]*update[\s\S]*updateWolf[\s\S]*updateSky[\s\S]*getSkyData\s*:\s*\(\s*\)\s*=>\s*skyData[\s\S]*updateWater[\s\S]*cameraController[\s\S]*mapHud[\s\S]*waterReflectionPass[\s\S]*renderer[\s\S]*scene[\s\S]*\}\s*\)/.test(mainJs), 'main.js should start runtime loop with live dependencies');
assert(!mainJs.includes('import { createMapHud } from "./ui/mapHud.js";'), 'main.js should not import mapHud directly');
assert(!mainJs.includes('import { createWaterReflectionPass } from "./rendering/waterReflection.js";'), 'main.js should not import water reflection pass directly');
assert(!mainJs.includes('import { installTestProbe } from "./debug/testProbe.js";'), 'main.js should not import test probe directly');
assert(!mainJs.includes('import { createGameLoop } from "./loop.js";'), 'main.js should not import game loop directly');
assert(!/function\s+resize\s*\(/.test(mainJs), 'main.js should not keep inline resize helper');
assert(runtimeServicesJs.includes('installTestProbeFn({') && runtimeServicesJs.includes('createGameLoopFn({'), 'runtime services module should own probe and game-loop setup');

console.log('Runtime services check passed.');
