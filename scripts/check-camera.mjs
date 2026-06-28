import { createCameraController } from '../prototype/3d/src/camera.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function nearly(actual, expected, message, epsilon = 1e-9) {
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

  copy(v) {
    this.x = v.x;
    this.y = v.y;
    this.z = v.z;
    return this;
  }
}

class FakeCamera {
  constructor() {
    this.position = new FakeVector3();
    this.lookAtCalls = [];
  }

  lookAt(x, y, z) {
    if (x instanceof FakeVector3) this.lookAtCalls.push({ x: x.x, y: x.y, z: x.z });
    else this.lookAtCalls.push({ x, y, z });
  }
}

const THREE = {
  Vector3: FakeVector3,
  MathUtils: {
    degToRad: degrees => degrees * Math.PI / 180,
    lerp: (a, b, t) => a + (b - a) * t,
  },
};

function makeRig() {
  return {
    yaw: 0,
    pitch: THREE.MathUtils.degToRad(43),
    targetYaw: 0,
    targetPitch: THREE.MathUtils.degToRad(43),
    distance: 43,
    outdoorDistance: 43,
    currentDistance: 43,
    minPitch: THREE.MathUtils.degToRad(8),
    maxPitch: THREE.MathUtils.degToRad(78),
    yawSpeed: 1.55,
    pitchSpeed: 1.05,
    stickX: 0,
    stickY: 0,
  };
}

function expectedPosition(player, rig) {
  const cp = Math.cos(rig.pitch), sp = Math.sin(rig.pitch);
  const cy = Math.cos(rig.yaw), sy = Math.sin(rig.yaw);
  const target = { x: player.x, y: player.y + 1.7, z: player.z };
  return {
    x: target.x + sy * cp * rig.outdoorDistance,
    y: Math.max(target.y + sp * rig.outdoorDistance, 1.0),
    z: target.z + cy * cp * rig.outdoorDistance,
    target,
  };
}

{
  const camera = new FakeCamera();
  const rig = makeRig();
  const controller = createCameraController({
    THREE,
    camera,
    cameraRig: rig,
    getPlayer: () => { throw new Error('setInitialView should not read player'); },
  });
  controller.setInitialView();
  nearly(camera.position.x, 0, 'initial camera x');
  nearly(camera.position.y, Math.sin(rig.pitch) * rig.distance, 'initial camera y');
  nearly(camera.position.z, Math.cos(rig.pitch) * rig.distance, 'initial camera z');
  assert(JSON.stringify(camera.lookAtCalls.at(-1)) === JSON.stringify({ x: 0, y: 1.7, z: 0 }), 'initial lookAt should target player height at origin');
  const offset = controller.cameraOffset(10);
  nearly(offset.y, Math.sin(rig.pitch) * 10, 'cameraOffset should honor custom distance');
}

{
  const player = { x: 3, y: 2, z: -4 };
  const camera = new FakeCamera();
  const rig = makeRig();
  rig.stickX = 1;
  rig.stickY = 10;
  const controller = createCameraController({ THREE, camera, cameraRig: rig, getPlayer: () => player });
  controller.updateCamera(0.1);
  nearly(rig.targetYaw, 0.155, 'targetYaw should apply stick speed');
  nearly(rig.yaw, 0.155, 'yaw should lerp to target at dt 0.1');
  nearly(rig.targetPitch, rig.maxPitch, 'targetPitch should clamp to max pitch');
  nearly(rig.pitch, rig.maxPitch, 'pitch should lerp to clamped target at dt 0.1');
  const expected = expectedPosition(player, rig);
  nearly(camera.position.x, expected.x, 'updated camera x');
  nearly(camera.position.y, expected.y, 'updated camera y');
  nearly(camera.position.z, expected.z, 'updated camera z');
  assert(JSON.stringify(camera.lookAtCalls.at(-1)) === JSON.stringify(expected.target), 'updateCamera should look at player head target');
}

{
  const player = { x: 0, y: -10, z: 0 };
  const camera = new FakeCamera();
  const rig = makeRig();
  rig.pitch = THREE.MathUtils.degToRad(-89);
  rig.targetPitch = rig.pitch;
  rig.stickY = -10;
  const controller = createCameraController({ THREE, camera, cameraRig: rig, getPlayer: () => player });
  controller.updateCamera(0.1);
  nearly(rig.targetPitch, rig.minPitch, 'targetPitch should clamp to min pitch');
  nearly(rig.pitch, rig.minPitch, 'pitch should lerp to min pitch');
  assert(camera.position.y >= 1.0, 'camera y should be clamped above ground');
}

{
  const player = { x: 0, y: 0, z: 0 };
  const camera = new FakeCamera();
  const rig = makeRig();
  rig.yaw = 0;
  rig.targetYaw = 1;
  rig.pitch = THREE.MathUtils.degToRad(20);
  rig.targetPitch = THREE.MathUtils.degToRad(60);
  const controller = createCameraController({ THREE, camera, cameraRig: rig, getPlayer: () => player });
  controller.updateCamera(0.05);
  nearly(rig.yaw, 0.5, 'yaw should partially smooth when dt * 10 is below 1');
  nearly(rig.pitch, THREE.MathUtils.degToRad(40), 'pitch should partially smooth when dt * 10 is below 1');
}

{
  const player = { x: 0, y: 0, z: 0 };
  const camera = new FakeCamera();
  const rig = makeRig();
  rig.yaw = Math.PI - 0.05;
  rig.targetYaw = -Math.PI + 0.05;
  const controller = createCameraController({ THREE, camera, cameraRig: rig, getPlayer: () => player });
  controller.updateCamera(0.05);
  nearly(rig.yaw, Math.PI, 'yaw should use shortest path across the +/-PI seam');
}

{
  const player = { x: 1, y: 0, z: 2 };
  const camera = new FakeCamera();
  const rig = makeRig();
  let shake = 0.2;
  const randomValues = [1, 0];
  const controller = createCameraController({
    THREE,
    camera,
    cameraRig: rig,
    getPlayer: () => player,
    getShake: () => shake,
    random: () => randomValues.shift() ?? 0.5,
  });
  controller.updateCamera(0.1);
  const expected = expectedPosition(player, rig);
  nearly(camera.position.x, expected.x + 0.1, 'shake should offset camera x');
  nearly(camera.position.y, expected.y - 0.1, 'shake should offset camera y');
  nearly(camera.position.z, expected.z, 'shake should not offset camera z');
}

console.log('Camera controller check passed.');
