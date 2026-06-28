import fs from 'node:fs';
import path from 'node:path';
import { createCharacterPoseController } from '../prototype/3d/src/player/characterPose.js';

const repoRoot = process.cwd();
const mainJs = fs.readFileSync(path.join(repoRoot, 'prototype/3d/src/main.js'), 'utf8');
const characterPoseJs = fs.readFileSync(path.join(repoRoot, 'prototype/3d/src/player/characterPose.js'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function nearly(actual, expected, message, epsilon = 1e-9) {
  if (Math.abs(actual - expected) > epsilon) {
    throw new Error(`${message}: got ${actual}, expected ${expected}`);
  }
}

function same(actual, expected, message) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${message}: got ${a}, expected ${e}`);
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

class FakeObject {
  constructor(name, { isMesh = false } = {}) {
    this.name = name;
    this.children = [];
    this.parent = null;
    this.position = new FakeTransform();
    this.rotation = new FakeTransform();
    this.visible = true;
    this.isMesh = isMesh;
    this.attachCalls = [];
  }

  add(child) {
    child.parent = this;
    this.children.push(child);
  }

  attach(child) {
    child.parent = this;
    this.attachCalls.push(child.name);
  }

  traverse(callback) {
    callback(this);
    for (const child of this.children) child.traverse(callback);
  }
}

const THREE = {
  MathUtils: {
    lerp: (a, b, t) => a + (b - a) * t,
  },
};

const MOVES = {
  gSpinCharged: { spinTurns: 4 },
};

function createLimb(name) {
  return {
    root: new FakeObject(`${name}.root`),
    j2: new FakeObject(`${name}.j2`),
  };
}

function createPlayer(overrides = {}) {
  return {
    x: 2,
    y: 3,
    z: -4,
    moving: false,
    clip: null,
    state: 'idle',
    jumping: false,
    runPhase: 0,
    vy: 0,
    charging: false,
    chargeT: 0,
    chargeFull: false,
    move: null,
    moveT: 0,
    blendT: 0,
    blendDur: 0.13,
    spin: 0,
    facing: 0,
    roll: 0,
    _plungeDone: false,
    ...overrides,
  };
}

function createFixture({ player = createPlayer(), drivenPose, now = () => 0 } = {}) {
  const trace = [];
  const rig = {
    char: new FakeObject('char'),
    body: new FakeObject('body'),
    chest: new FakeObject('chest'),
    headGrp: new FakeObject('headGrp'),
    RArm: createLimb('RArm'),
    LArm: createLimb('LArm'),
    RLeg: createLimb('RLeg'),
    LLeg: createLimb('LLeg'),
    weaponSocket: new FakeObject('weaponSocket'),
    weapon: new FakeObject('weapon'),
    jupiterBall: new FakeObject('jupiterBall'),
    chargeAura: new FakeObject('chargeAura'),
    chargeAuraMat: { opacity: 0 },
  };
  const mesh = new FakeObject('mesh', { isMesh: true });
  mesh.visible = false;
  rig.char.add(mesh);

  const controller = {
    resetJoints() { trace.push('resetJoints'); },
    resetDrivenState() { trace.push('resetDrivenState'); },
    applyClip(name, time, blend) { trace.push(['applyClip', name, time, blend]); },
    getDrivenState() {
      trace.push('getDrivenState');
      return drivenPose ?? {
        bodyY: null,
        bodyLean: null,
        bodyYaw: null,
        bodySide: null,
        gripMode: null,
      };
    },
  };

  let jupiterActive = false;
  let jupiterSpin = 0;
  let drillSpin = 0;
  const characterPose = createCharacterPoseController({
    THREE,
    player,
    moves: MOVES,
    rig,
    poseClipController: controller,
    gripDefault: 1,
    gripSpear: 3,
    heavyChargeTime: 2,
    getJupiterActive: () => jupiterActive,
    setJupiterActive: value => {
      jupiterActive = value;
      trace.push(['jupiterActive', value]);
    },
    getJupiterSpin: () => jupiterSpin,
    setJupiterSpin: value => {
      jupiterSpin = value;
      trace.push(['jupiterSpin', value]);
    },
    getDrillSpin: () => drillSpin,
    setDrillSpin: value => {
      drillSpin = value;
      trace.push(['drillSpin', value]);
    },
    now,
  });

  return {
    P: player,
    rig,
    trace,
    poseCharacter: characterPose.poseCharacter,
    getJupiterActive: () => jupiterActive,
    setJupiterActive: value => { jupiterActive = value; },
    getJupiterSpin: () => jupiterSpin,
    setJupiterSpin: value => { jupiterSpin = value; },
    getDrillSpin: () => drillSpin,
    setDrillSpin: value => { drillSpin = value; },
    mesh,
  };
}

{
  const fixture = createFixture({
    player: createPlayer({ clip: 'gL1', clipT: 0.2, move: 'gL1', blendT: 0.05, blendDur: 0.10 }),
    drivenPose: { bodyY: 0.3, bodyLean: 0.4, bodyYaw: 0.2, bodySide: -0.1, gripMode: 0.5 },
  });
  fixture.poseCharacter(0.016);
  same(fixture.trace, ['resetJoints', 'resetDrivenState', ['applyClip', 'gL1', 0.2, 0.5], 'getDrivenState'], 'pose clip call order');
  nearly(fixture.rig.char.position.x, 2, 'char x');
  nearly(fixture.rig.char.position.y, 3, 'char y');
  nearly(fixture.rig.char.position.z, -4, 'char z');
  nearly(fixture.rig.body.position.y, 0.3, 'driven bodyY should win');
  nearly(fixture.rig.body.rotation.x, 0.2, 'driven bodyLean should be lerped from reset x');
  nearly(fixture.rig.body.rotation.y, 0.1, 'driven bodyYaw should be lerped from reset y');
  nearly(fixture.rig.body.rotation.z, -0.05, 'driven bodySide should be lerped from reset z');
  nearly(fixture.rig.weaponSocket.rotation.x, 2, 'gripMode should blend rig grip constants');
}

{
  const fixture = createFixture({
    player: createPlayer({ charging: true, chargeT: 2, chargeFull: true }),
    now: () => 30 * Math.PI,
  });
  fixture.poseCharacter(0.016);
  assert(fixture.rig.chargeAura.visible === true, 'full charge should show aura');
  nearly(fixture.rig.chargeAuraMat.opacity, 0.6, 'full charge aura opacity');
  nearly(fixture.rig.body.position.y, -0.26, 'charging body crouch should use injected heavyChargeTime');
}

{
  const fixture = createFixture({
    player: createPlayer({ move: 'aJupiter', moveT: 0.30, facing: Math.PI / 2 }),
  });
  fixture.poseCharacter(0.1);
  assert(fixture.getJupiterActive() === true, 'aJupiter should activate jupiter visual state');
  nearly(fixture.getJupiterSpin(), 4.6, 'aJupiter should advance injected spin state');
  nearly(fixture.rig.body.rotation.x, 4.6, 'aJupiter should rotate body by spin');
  assert(fixture.P._jupSword === true, 'aJupiter should mark sword as attached to body');
  same(fixture.rig.body.attachCalls, ['weapon'], 'aJupiter should attach weapon to body');
  nearly(fixture.rig.weapon.position.y, 4.2, 'aJupiter sword y');
}

{
  const fixture = createFixture({ player: createPlayer({ move: null }) });
  fixture.setJupiterActive(true);
  fixture.rig.jupiterBall.visible = true;
  fixture.poseCharacter(0.016);
  assert(fixture.getJupiterActive() === false, 'leaving aJupiter should clear active state');
  assert(fixture.rig.jupiterBall.visible === false, 'leaving aJupiter should hide ball');
  assert(fixture.mesh.visible === true, 'leaving aJupiter should reveal character meshes');
}

{
  const fixture = createFixture({ player: createPlayer({ move: 'aDrill' }) });
  fixture.setDrillSpin(1);
  fixture.poseCharacter(0.1);
  nearly(fixture.getDrillSpin(), 10, 'aDrill should advance injected drill spin');
  nearly(fixture.rig.body.rotation.y, 10, 'aDrill should rotate body by drill spin');
  assert(fixture.P._drillSword === true, 'aDrill should mark sword as detached');
  same(fixture.rig.char.attachCalls, ['weapon'], 'aDrill should attach weapon to char');

  fixture.P.move = null;
  fixture.poseCharacter(0.1);
  assert(fixture.P._drillSword === false, 'leaving aDrill should clear detached sword flag');
  assert(fixture.P._drillAng === 0, 'leaving aDrill should reset orbit angle');
  same(fixture.rig.weaponSocket.attachCalls, ['weapon'], 'leaving aDrill should reattach weapon to socket');
}

{
  const fixture = createFixture({
    player: createPlayer({ move: 'gSpinCharged', spin: 0.25 }),
  });
  fixture.poseCharacter(0.016);
  nearly(fixture.rig.body.rotation.y, -Math.PI * 2, 'gSpinCharged should use move spinTurns');
}

{
  const fixture = createFixture({
    player: createPlayer({ move: 'dKick', moveT: 0.16 }),
  });
  fixture.poseCharacter(0.016);
  nearly(fixture.rig.body.rotation.y, -Math.PI / 2, 'dKick should preserve side-turn yaw');
  nearly(fixture.rig.body.rotation.z, 1.25, 'dKick should preserve side tilt');
}

assert(mainJs.includes('import { createCharacterPoseController } from "./player/characterPose.js";'), 'main.js must import character pose controller');
assert(/\bconst\s*\{\s*poseCharacter\s*\}\s*=\s*createCharacterPoseController\s*\(/.test(mainJs), 'main.js must create poseCharacter through the controller');
assert(/createCharacterPoseController\s*\(\s*\{[\s\S]*THREE[\s\S]*player\s*:\s*P[\s\S]*moves\s*:\s*MOVES[\s\S]*rig\s*:\s*\{[\s\S]*char[\s\S]*body[\s\S]*chargeAuraMat[\s\S]*poseClipController[\s\S]*gripDefault\s*:\s*GRIP_DEFAULT[\s\S]*gripSpear\s*:\s*GRIP_SPEAR[\s\S]*heavyChargeTime\s*:\s*HEAVY_CHARGE_TIME[\s\S]*getJupiterActive[\s\S]*setJupiterActive[\s\S]*getJupiterSpin[\s\S]*setJupiterSpin[\s\S]*getDrillSpin[\s\S]*setDrillSpin[\s\S]*\}\s*\)/.test(mainJs), 'main.js must wire all character pose dependencies');
assert(!/function\s+poseCharacter\s*\(/.test(mainJs), 'main.js should not keep inline poseCharacter');
assert(!/function\s+lerpRot\s*\(/.test(mainJs), 'main.js should not keep inline lerpRot');
assert(/function\s+poseCharacter\s*\(\s*dt\s*\)\s*\{[\s\S]*poseClipController\.resetJoints\s*\(\s*\)[\s\S]*poseClipController\.resetDrivenState\s*\(\s*\)[\s\S]*poseClipController\.applyClip\s*\(\s*P\.clip\s*,\s*P\.clipT\s*,\s*blend\s*\)[\s\S]*const\s+drivenPose\s*=\s*poseClipController\.getDrivenState\s*\(\s*\)/.test(characterPoseJs), 'character pose should reset, apply clips, then consume driven pose');
assert(/body\.position\.y\s*\+=\s*\(drivenPose\.bodyY\s*!==\s*null\)\s*\?\s*drivenPose\.bodyY\s*:\s*bob/.test(characterPoseJs), 'character pose should preserve bodyY composition');
assert(/const\s+gm\s*=\s*\(drivenPose\.gripMode\s*!==\s*null\)\s*\?\s*drivenPose\.gripMode\s*:\s*0/.test(characterPoseJs), 'character pose should preserve grip fallback');

console.log('Character pose check passed.');
