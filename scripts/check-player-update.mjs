import fs from 'node:fs';
import path from 'node:path';
import { createPlayerUpdater } from '../prototype/3d/src/player/updateController.js';

const repoRoot = process.cwd();
const mainJs = fs.readFileSync(path.join(repoRoot, 'prototype/3d/src/main.js'), 'utf8');
const updateControllerJs = fs.readFileSync(path.join(repoRoot, 'prototype/3d/src/player/updateController.js'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function same(actual, expected, message) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${message}: got ${a}, expected ${e}`);
}

function makeFixture(overrides = {}) {
  const calls = [];
  const runtimeState = {
    hitstop: 0,
    shake: 0,
    jupiterActive: false,
    jupiterSpin: 0,
    drillSpin: 0,
  };
  const player = {
    dead: false,
    iframe: 0,
    x: 0,
    z: 0,
    y: 0,
    vy: 0,
    jumping: false,
    state: 'idle',
    stamina: 100,
    facing: 0,
    move: null,
    charging: false,
    chargeLock: false,
    dodgeGrace: 0,
    _drillBounce: 0,
    _drillBounced: false,
    ...overrides.player,
  };
  const mapHud = {
    isWorldMapOpen: () => false,
    ...overrides.mapHud,
  };
  const deps = {
    player,
    runtimeState,
    getMapHud: () => mapHud,
    clearGameplayInputState: () => calls.push('clearGameplayInputState'),
    updateFx: dt => calls.push(['updateFx', dt]),
    poseCharacter: dt => calls.push(['poseCharacter', dt]),
    autoPad: () => calls.push('autoPad'),
    pollInput: () => calls.push('pollInput'),
    Actions: {
      moveX: 0,
      moveZ: 0,
      dodge: false,
      attack: false,
      heavyHeld: false,
      heavyReleased: false,
      taunt: false,
      jump: false,
    },
    mouse: { left: false },
    toCameraRelativeMove: () => ({ x: 0, z: 0 }),
    swordTrail: { mesh: { visible: false }, isActive: () => false },
    spaceSlash: { markReady() {}, update() {} },
    sfx: { dodge() {}, spinPlay() {} },
    startDodgeCombo: move => calls.push(['startDodgeCombo', move]),
    startMove: move => calls.push(['startMove', move]),
    playClip: clip => calls.push(['playClip', clip]),
    groundHeightAt: () => 0,
    jumpVelocity: 15.5,
    gravity: 43,
    moves: {},
    poseClipController: { capturePoseSnapshot() {} },
    clips: {},
    fireFx: fx => calls.push(['fireFx', fx]),
    hitResolution: {},
    jupiterBall: { visible: true },
    char: { traverse() {} },
    body: { rotation: { x: 0 } },
    weaponSocket: { attach() {} },
    weapon: { position: { set() {} }, rotation: { set() {} } },
    moveSpeed: 9.2,
    heavyChargeMinSpeed: 0.2,
    heavyChargeTime: 1,
    heavyChargeHold: 1,
    dodgeDuration: 0.20,
    dodgeSpeed: 17,
    dodgeIframe: 0.16,
    dodgeCost: 0,
    staminaRegen: 10,
    turnLerp: 20,
    roomSize: 130,
    playerRadius: 0.55,
    resolveCollision: () => calls.push('resolveCollision'),
    yaw: { rotation: { y: 0 } },
    ghostAfterimages: { tickDodge() {}, update() {} },
    swordBeam: { updateBeams() {} },
    spinRings: { updateSpinRings() {} },
    stompEffects: { updateStomps() {} },
    ...overrides.deps,
  };
  const updater = createPlayerUpdater(deps);
  return { calls, player, runtimeState, mapHud, updater };
}

{
  const fixture = makeFixture({ mapHud: { isWorldMapOpen: () => true } });
  fixture.updater.update(0.016);
  same(fixture.calls, [['updateFx', 0.016], ['poseCharacter', 0.016]], 'world-map branch should only update effects and pose');
}

{
  const fixture = makeFixture({ player: { dead: true } });
  fixture.updater.update(0.016);
  same(fixture.calls, ['clearGameplayInputState', ['updateFx', 0.016], ['poseCharacter', 0.016]], 'dead branch should clear input before effects and pose');
}

{
  const fixture = makeFixture();
  fixture.runtimeState.hitstop = 0.1;
  fixture.updater.update(0.016);
  same(fixture.calls, ['autoPad', 'pollInput', ['updateFx', 0.016]], 'hitstop branch should poll input, update effects, and return before pose');
  assert(Math.abs(fixture.runtimeState.hitstop - 0.084) < 1e-12, 'hitstop should decrement by dt');
}

assert(mainJs.includes('import { createPlayerUpdater } from "./player/updateController.js";'), 'main.js must import the player updater');
assert(mainJs.includes('const { update } = createPlayerUpdater({'), 'main.js must create update through createPlayerUpdater');
assert(!/function\s+update\s*\(\s*dt\s*\)/.test(mainJs), 'main.js should not keep the inline update function');
assert(/getMapHud\s*:\s*\(\s*\)\s*=>\s*mapHud/.test(mainJs), 'main.js should pass mapHud as a live getter');
assert(mainJs.includes('runtimeState = {') && mainJs.includes('getShake: () => runtimeState.shake'), 'main.js should share runtimeState with camera shake');
assert(updateControllerJs.includes('import { angleDelta } from "../combat/hitMath.js";'), 'update controller should own angleDelta dependency');
assert(updateControllerJs.includes('getMapHud().isWorldMapOpen()'), 'update controller should preserve world-map early return');
assert(updateControllerJs.includes('runtimeState.hitstop') && updateControllerJs.includes('runtimeState.shake'), 'update controller should use shared hitstop and shake state');
assert(/startRuntimeLoop\s*\(\s*\{[\s\S]*\bupdate\b[\s\S]*\}\s*\)/.test(mainJs), 'main.js should still pass update into the runtime loop');

console.log('Player update check passed.');
