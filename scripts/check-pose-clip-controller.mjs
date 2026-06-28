import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const mainJs = fs.readFileSync(path.join(repoRoot, 'prototype/3d/src/main.js'), 'utf8');
const moveTriggersJs = fs.readFileSync(path.join(repoRoot, 'prototype/3d/src/player/moveTriggers.js'), 'utf8');
const characterPoseJs = fs.readFileSync(path.join(repoRoot, 'prototype/3d/src/player/characterPose.js'), 'utf8');
const modulePath = path.join(repoRoot, 'prototype/3d/src/player/poseClipController.js');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function nearly(actual, expected, message, epsilon = 1e-9) {
  if (Math.abs(actual - expected) > epsilon) {
    throw new Error(`${message}: got ${actual}, expected ${expected}`);
  }
}

function makeRotation(x = 0, y = 0, z = 0) {
  return {
    x,
    y,
    z,
    set(nx, ny, nz) {
      this.x = nx;
      this.y = ny;
      this.z = nz;
      return this;
    },
  };
}

function makeJoint(x = 0, y = 0, z = 0) {
  return { rotation: makeRotation(x, y, z) };
}

function createFixture() {
  const joints = {
    shoR: makeJoint(0.2, 0.3, 0.4),
    elbR: makeJoint(-0.2, -0.3, -0.4),
    shoL: makeJoint(0.5, 0.6, 0.7),
    elbL: makeJoint(-0.5, -0.6, -0.7),
    hipR: makeJoint(0.8, 0.9, 1.0),
    kneeR: makeJoint(-0.8, -0.9, -1.0),
    hipL: makeJoint(1.1, 1.2, 1.3),
    kneeL: makeJoint(-1.1, -1.2, -1.3),
    chest: makeJoint(0.12, 0.34, 0.56),
    head: makeJoint(0.9, 0.8, 0.7),
    wristR: makeJoint(-0.9, -0.8, -0.7),
  };
  const body = {
    position: { y: 1.25 },
    rotation: makeRotation(0.4, -0.3, 0.2),
  };
  const clips = {
    bodyAndGrip: {
      tracks: {
        bodyY: [{ t: 0, v: 0 }, { t: 1, v: -0.4 }],
        bodyLean: [{ t: 0, v: 0.2 }, { t: 1, v: 0.8 }],
        bodyYaw: [{ t: 0, v: -0.2 }, { t: 1, v: 0.6 }],
        bodySide: [{ t: 0, v: 0.1 }, { t: 1, v: -0.5 }],
        gripMode: [{ t: 0, v: 0 }, { t: 1, v: 1 }],
      },
    },
    chestSpecial: {
      tracks: {
        chestX: [{ t: 0, v: 0 }, { t: 1, v: 1.2 }],
        chestY: [{ t: 0, v: 0 }, { t: 1, v: -0.8 }],
        chestZ: [{ t: 0, v: 0 }, { t: 1, v: 0.4 }],
      },
    },
    partialAndUnknown: {
      tracks: {
        shoR: [{ t: 0, x: 0.25 }, { t: 1, x: 0.75 }],
        hipL: [{ t: 0, z: -0.25 }, { t: 1, z: -0.75 }],
        noSuchJoint: [{ t: 0, x: 10, y: 20, z: 30 }, { t: 1, x: 40, y: 50, z: 60 }],
      },
    },
  };
  return { joints, body, clips };
}

function drivenState(controller) {
  if (typeof controller.getDrivenState === 'function') return controller.getDrivenState();
  return {
    bodyY: controller.clipBodyY,
    bodyLean: controller.clipBodyLean,
    bodyYaw: controller.clipBodyYaw,
    bodySide: controller.clipBodySide,
    gripMode: controller.clipGripMode,
  };
}

if (!fs.existsSync(modulePath)) {
  throw new Error('Missing prototype/3d/src/player/poseClipController.js. Add the pose clip controller module, then run this contract check.');
}

const moduleExports = await import('../prototype/3d/src/player/poseClipController.js');
const { createPoseClipController } = moduleExports;
assert(typeof createPoseClipController === 'function', 'poseClipController.js must export createPoseClipController');

{
  const { joints, body, clips } = createFixture();
  const controller = createPoseClipController({
    joints,
    chest: joints.chest,
    body,
    clips,
    lerp: (a, b, t) => a + (b - a) * t,
  });
  assert(typeof controller.resetJoints === 'function', 'controller must expose resetJoints');
  assert(typeof controller.capturePoseSnapshot === 'function', 'controller must expose capturePoseSnapshot');
  assert(typeof controller.applyClip === 'function', 'controller must expose applyClip');
  controller.resetJoints();
  for (const [name, joint] of Object.entries(joints)) {
    nearly(joint.rotation.x, 0, `${name}.rotation.x should reset`);
    nearly(joint.rotation.y, 0, `${name}.rotation.y should reset`);
    nearly(joint.rotation.z, 0, `${name}.rotation.z should reset`);
  }
}

{
  const { joints, body, clips } = createFixture();
  const controller = createPoseClipController({
    joints,
    chest: joints.chest,
    body,
    clips,
    lerp: (a, b, t) => a + (b - a) * t,
  });
  controller.capturePoseSnapshot();
  controller.resetDrivenState?.();
  controller.applyClip('bodyAndGrip', 1, 0.25);
  const state = drivenState(controller);
  nearly(state.bodyY, 0.8375, 'bodyY should blend from captured body.position.y');
  nearly(state.bodyLean, 0.5, 'bodyLean should blend from captured body.rotation.x');
  nearly(state.bodyYaw, -0.075, 'bodyYaw should blend from captured body.rotation.y');
  nearly(state.bodySide, 0.025, 'bodySide should blend from captured body.rotation.z');
  nearly(state.gripMode, 0.25, 'gripMode should fall back to 0 when no clip grip is active at capture');
}

{
  const { joints, body, clips } = createFixture();
  const controller = createPoseClipController({
    joints,
    chest: joints.chest,
    body,
    clips,
    lerp: (a, b, t) => a + (b - a) * t,
  });
  controller.capturePoseSnapshot();
  controller.applyClip('bodyAndGrip', 1, 1);
  assert(drivenState(controller).gripMode === 1, 'direct apply should set gripMode to target');
  controller.capturePoseSnapshot();
  controller.applyClip('bodyAndGrip', 0, 0.5);
  nearly(drivenState(controller).gripMode, 0.5, 'capture should use active gripMode as the next blend source');
}

{
  const { joints, body, clips } = createFixture();
  const controller = createPoseClipController({
    joints,
    chest: joints.chest,
    body,
    clips,
    lerp: (a, b, t) => a + (b - a) * t,
  });
  controller.applyClip('chestSpecial', 1, 1);
  nearly(joints.chest.rotation.x, 1.2, 'chestX track should drive chest.rotation.x');
  nearly(joints.chest.rotation.y, -0.8, 'chestY track should drive chest.rotation.y');
  nearly(joints.chest.rotation.z, 0.4, 'chestZ track should drive chest.rotation.z');
}

{
  const { joints, body, clips } = createFixture();
  const controller = createPoseClipController({
    joints,
    chest: joints.chest,
    body,
    clips,
    lerp: (a, b, t) => a + (b - a) * t,
  });
  controller.applyClip('partialAndUnknown', 1, 1);
  nearly(joints.shoR.rotation.x, 0.75, 'joint x track should apply target x');
  nearly(joints.shoR.rotation.y, 0.3, 'partial joint x track should preserve existing y');
  nearly(joints.shoR.rotation.z, 0.4, 'partial joint x track should preserve existing z');
  nearly(joints.hipL.rotation.x, 1.1, 'partial joint z track should preserve existing x');
  nearly(joints.hipL.rotation.y, 1.2, 'partial joint z track should preserve existing y');
  nearly(joints.hipL.rotation.z, -0.75, 'joint z track should apply target z');
}

{
  const { joints, body, clips } = createFixture();
  const controller = createPoseClipController({
    joints,
    chest: joints.chest,
    body,
    clips,
    lerp: (a, b, t) => a + (b - a) * t,
  });
  controller.capturePoseSnapshot();
  controller.applyClip('partialAndUnknown', 1, 0.5);
  nearly(joints.shoR.rotation.x, 0.475, 'joint blend should start from captured x');
  nearly(joints.shoR.rotation.y, 0.3, 'blended partial x track should preserve captured y');
  nearly(joints.shoR.rotation.z, 0.4, 'blended partial x track should preserve captured z');
}

assert(mainJs.includes('import { createPoseClipController } from "./player/poseClipController.js";'), 'main.js must import createPoseClipController');
assert(mainJs.includes('createPoseClipController({'), 'main.js must construct the pose clip controller');
assert(/function\s+startMove\s*\([\s\S]*poseClipController\.capturePoseSnapshot\s*\(\s*\)/.test(moveTriggersJs), 'startMove should capture pose snapshots through the controller');
assert(/mv\.recoverClip[\s\S]*poseClipController\.capturePoseSnapshot\s*\(\s*\)\s*;\s*P\.blendT\s*=\s*0\s*;\s*P\.blendDur\s*=\s*0\.12/.test(mainJs), 'recover clip transition should preserve snapshot timing and blend duration');
assert(/mv\.landClip[\s\S]*poseClipController\.capturePoseSnapshot\s*\(\s*\)\s*;\s*P\.blendT\s*=\s*0\s*;\s*P\.blendDur\s*=\s*0\.10/.test(mainJs), 'land clip transition should preserve snapshot timing and blend duration');
assert(/function\s+poseCharacter\s*\(\s*dt\s*\)\s*\{[\s\S]*poseClipController\.resetJoints\s*\(\s*\)[\s\S]*poseClipController\.resetDrivenState\s*\(\s*\)[\s\S]*poseClipController\.applyClip\s*\(\s*P\.clip\s*,\s*P\.clipT\s*,\s*blend\s*\)[\s\S]*const\s+drivenPose\s*=\s*poseClipController\.getDrivenState\s*\(\s*\)/.test(characterPoseJs), 'poseCharacter should reset, apply clips, then consume driven pose through the controller');
assert(/body\.position\.y\s*\+=\s*\(drivenPose\.bodyY\s*!==\s*null\)\s*\?\s*drivenPose\.bodyY\s*:\s*bob/.test(characterPoseJs), 'poseCharacter should preserve bodyY driven-value composition');
assert(/const\s+gm\s*=\s*\(drivenPose\.gripMode\s*!==\s*null\)\s*\?\s*drivenPose\.gripMode\s*:\s*0/.test(characterPoseJs), 'poseCharacter should preserve grip driven-value fallback');
assert(!mainJs.includes('function resetJoints(){'), 'main.js should not retain inline resetJoints');
assert(!mainJs.includes('function capturePoseSnapshot(){'), 'main.js should not retain inline capturePoseSnapshot');
assert(!mainJs.includes('function applyClip(name,time,blend){'), 'main.js should not retain inline applyClip');
assert(!mainJs.includes('const POSE_SNAP={}'), 'main.js should not retain inline POSE_SNAP storage');

console.log('Pose clip controller check passed.');
