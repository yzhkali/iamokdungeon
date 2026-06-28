import fs from 'node:fs';
import path from 'node:path';
import { createWolfRuntime } from '../prototype/3d/src/enemies/wolfRuntime.js';

const repoRoot = process.cwd();
const mainJs = fs.readFileSync(path.join(repoRoot, 'prototype/3d/src/main.js'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const THREE = { name: 'THREE' };
const scene = { name: 'scene' };
const hittables = [];
const player = { x: 1, z: -2 };
const documentRef = { name: 'document' };
const timeouts = [];
const random = () => 0.25;
const hitstops = [];
const calls = [];

const runtime = createWolfRuntime({
  THREE,
  scene,
  hittables,
  getPlayer: () => player,
  setHitstop: value => hitstops.push(value),
  documentRef,
  setTimeoutRef: (fn, ms) => {
    timeouts.push({ fn, ms });
  },
  random,
  makeWolfFn(runtimeTHREE, runtimeScene, x, y, z) {
    calls.push(['makeWolf', runtimeTHREE, runtimeScene, x, y, z]);
    return { root: { name: 'wolfRoot' } };
  },
  createWolfAiControllerFn(options) {
    calls.push(['createWolfAiController', options]);
    return {
      wolfAI: { state: 'patrol' },
      updateWolf(dt) {
        calls.push(['updateWolf', dt]);
      },
    };
  },
});

assert(runtime.wolf.root.name === 'wolfRoot', 'runtime should return created wolf');
assert(runtime.wolfAI.state === 'patrol', 'runtime should expose controller wolfAI');
assert(runtime.wolfController.wolfAI === runtime.wolfAI, 'runtime should expose controller object');

const makeWolfCall = calls[0];
assert(makeWolfCall[0] === 'makeWolf', 'runtime should create wolf first');
assert(makeWolfCall[1] === THREE && makeWolfCall[2] === scene, 'makeWolf should receive THREE and scene');
assert(makeWolfCall[3] === 0 && makeWolfCall[4] === 0.72 && makeWolfCall[5] === -40, 'makeWolf should preserve spawn position');

const controllerCall = calls[1];
assert(controllerCall[0] === 'createWolfAiController', 'runtime should create AI controller second');
const options = controllerCall[1];
assert(options.wolf === runtime.wolf, 'controller should receive created wolf');
assert(options.hittables === hittables, 'controller should receive shared hittables');
assert(options.getPlayer() === player, 'controller should receive live player getter');
options.setHitstop(0.12);
assert(hitstops[0] === 0.12, 'controller should receive hitstop setter');
assert(options.documentRef === documentRef, 'controller should receive documentRef');
options.setTimeoutRef(() => {}, 80);
assert(timeouts[0].ms === 80, 'controller should receive timeout function');
assert(options.random === random, 'controller should receive random function');

runtime.updateWolf(0.5);
assert(calls.at(-1)[0] === 'updateWolf' && calls.at(-1)[1] === 0.5, 'runtime updateWolf should delegate to controller');

assert(mainJs.includes('import { createWolfRuntime } from "./enemies/wolfRuntime.js";'), 'main.js must import wolf runtime');
assert(/const\s+\{\s*updateWolf\s*\}\s*=\s*createWolfRuntime\s*\(\s*\{[\s\S]*THREE[\s\S]*scene[\s\S]*hittables[\s\S]*getPlayer\s*:\s*\(\s*\)\s*=>\s*P[\s\S]*setHitstop[\s\S]*documentRef\s*:\s*document[\s\S]*setTimeoutRef\s*:\s*setTimeout[\s\S]*random\s*:\s*Math\.random[\s\S]*\}\s*\)/.test(mainJs), 'main.js should wire wolf runtime with live dependencies');
assert(!mainJs.includes('import { makeWolf } from "./wolf.js";'), 'main.js should not import makeWolf directly');
assert(!mainJs.includes('import { createWolfAiController } from "./enemies/wolfAi.js";'), 'main.js should not import wolf AI controller directly');
assert(!/function\s+updateWolf\s*\(/.test(mainJs), 'main.js should not keep an inline updateWolf wrapper');
assert(!mainJs.includes('makeWolf(THREE, scene, 0, 0.72, -40)'), 'main.js should not keep inline wolf construction');

console.log('Wolf runtime check passed.');
