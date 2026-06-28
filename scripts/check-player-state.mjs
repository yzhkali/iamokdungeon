import fs from 'node:fs';
import path from 'node:path';
import { createPlayerState, clonePlayerTuning, PLAYER_TUNING } from '../prototype/3d/src/player/state.js';

const repoRoot = process.cwd();
const mainJs = fs.readFileSync(path.join(repoRoot, 'prototype/3d/src/main.js'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const vector = { marker: 'vector3' };
const player = createPlayerState({ makeVector3: () => vector });
const expectedState = {
  x: 0,
  z: 0,
  y: 0,
  vy: 0,
  facing: 0,
  jumping: false,
  hp: 5,
  hpMax: 5,
  dead: false,
  state: 'idle',
  clip: null,
  clipT: 0,
  clipDur: 0,
  move: null,
  moveT: 0,
  phase: 'startup',
  struck: false,
  blendT: 0,
  blendDur: 0.13,
  nextBuffer: null,
  lunge: 0,
  charging: false,
  chargeT: 0,
  chargeHold: 0,
  chargeLock: false,
  chargeFull: false,
  chargeFullT: 0,
  dodgeT: 0,
  dodgeDir: vector,
  roll: 0,
  iframe: 0,
  airDodge: false,
  _drillBounce: 0,
  _drillBounced: false,
  spin: 0,
  stamina: 100,
  staminaMax: 100,
  runPhase: 0,
  moving: false,
  speed: 0,
};

for (const [key, value] of Object.entries(expectedState)) {
  assert(Object.is(player[key], value), `player.${key} should default to ${String(value)}`);
}

assert(Object.keys(player).length === Object.keys(expectedState).length, 'player state should not gain unverified default keys');
assert(Object.isFrozen(PLAYER_TUNING), 'PLAYER_TUNING should be frozen');

const expectedTuning = {
  MOVE_SPEED: 9.2,
  TURN_LERP: 20,
  JUMP_V: 15.5,
  GRAVITY: 43,
  LIGHT_LUNGE: 2.5,
  HEAVY_LUNGE: 4.0,
  CHARGE_MAX: 1.1,
  CHARGE_MOVE: 0.38,
  CHARGE_AUTO: 1.0,
  HEAVY_CHARGE_TIME: 1.0,
  HEAVY_CHARGE_HOLD: 1.0,
  HEAVY_CHARGE_MINSPD: 0.2,
  DODGE_DUR: 0.20,
  DODGE_SPEED: 17.0,
  DODGE_IFRAME: 0.16,
  DODGE_COST: 0,
  STAM_REGEN: 10,
  HEAVY_R_MIN: 1.3,
  HEAVY_R_MAX: 2.7,
  PLAYER_R: 0.55,
};

for (const [key, value] of Object.entries(expectedTuning)) {
  assert(Object.is(PLAYER_TUNING[key], value), `PLAYER_TUNING.${key} should be ${value}`);
}
assert(Object.keys(PLAYER_TUNING).length === Object.keys(expectedTuning).length, 'PLAYER_TUNING should not gain unverified keys');

const cloned = clonePlayerTuning();
assert(cloned !== PLAYER_TUNING, 'clonePlayerTuning should return a new object');
for (const [key, value] of Object.entries(expectedTuning)) {
  assert(Object.is(cloned[key], value), `clonePlayerTuning.${key} should be ${value}`);
}
cloned.MOVE_SPEED = 123;
assert(PLAYER_TUNING.MOVE_SPEED === 9.2, 'mutating tuning clone should not mutate PLAYER_TUNING');

assert(mainJs.includes('import { createPlayerState, clonePlayerTuning } from "./player/state.js";'), 'main.js must import player state module');
assert(mainJs.includes('const P=createPlayerState({ makeVector3: () => new THREE.Vector3() });'), 'main.js must construct P from createPlayerState');
assert(mainJs.includes('} = clonePlayerTuning();'), 'main.js must destructure tuning from clonePlayerTuning');

console.log('Player state check passed.');
