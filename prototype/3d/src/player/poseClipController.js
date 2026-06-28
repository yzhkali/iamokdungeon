import { sampleTrack as defaultSampleTrack } from '../combat/hitMath.js';

function lerpNumber(a, b, t) {
  return a + (b - a) * t;
}

function createJointsFromRig(rig) {
  return {
    shoR: rig.RArm.root,
    elbR: rig.RArm.j2,
    shoL: rig.LArm.root,
    elbL: rig.LArm.j2,
    hipR: rig.RLeg.root,
    kneeR: rig.RLeg.j2,
    hipL: rig.LLeg.root,
    kneeL: rig.LLeg.j2,
    chest: rig.chest,
    head: rig.headGrp,
    wristR: rig.rWrist,
  };
}

export function createPoseClipController({
  CLIPS,
  clips,
  sampleTrack = defaultSampleTrack,
  lerp = lerpNumber,
  rig,
  joints: providedJoints,
  chest,
  body,
}) {
  const clipSet = clips ?? CLIPS;
  const joints = providedJoints ?? createJointsFromRig(rig);
  const chestJoint = chest ?? joints.chest ?? rig.chest;
  const bodyRoot = body ?? rig.body;
  const poseSnap = {};
  const drivenPose = {
    bodyY: null,
    bodyLean: null,
    bodyYaw: null,
    bodySide: null,
    gripMode: null,
  };

  function resetJoints() {
    for (const key in joints) {
      joints[key].rotation.set(0, 0, 0);
    }
  }

  function resetDrivenPose() {
    drivenPose.bodyY = null;
    drivenPose.bodyLean = null;
    drivenPose.bodyYaw = null;
    drivenPose.bodySide = null;
    drivenPose.gripMode = null;
  }

  function getDrivenPose() {
    return drivenPose;
  }

  function capturePoseSnapshot() {
    for (const key in joints) {
      const rotation = joints[key].rotation;
      poseSnap[key] = { x: rotation.x, y: rotation.y, z: rotation.z };
    }
    poseSnap._bodyY = bodyRoot.position.y;
    poseSnap._bodyLean = bodyRoot.rotation.x;
    poseSnap._bodyYaw = bodyRoot.rotation.y;
    poseSnap._bodySide = bodyRoot.rotation.z;
    poseSnap._gripMode = (drivenPose.gripMode !== null) ? drivenPose.gripMode : 0;
  }

  function applyClip(name, time, blend) {
    const clip = clipSet[name];
    if (!clip) return;
    const b = (blend === undefined) ? 1 : Math.min(1, blend);
    for (const jointName in clip.tracks) {
      const val = sampleTrack(clip.tracks[jointName], time, lerp);
      if (jointName === 'bodyY') {
        const target = val.v || 0;
        const source = poseSnap._bodyY ?? 0;
        drivenPose.bodyY = (b < 1) ? lerp(source, target, b) : target;
        continue;
      }
      if (jointName === 'bodyLean') {
        const target = val.v || 0;
        const source = poseSnap._bodyLean ?? 0;
        drivenPose.bodyLean = (b < 1) ? lerp(source, target, b) : target;
        continue;
      }
      if (jointName === 'bodyYaw') {
        drivenPose.bodyYaw = (b < 1) ? lerp(poseSnap._bodyYaw ?? 0, val.v || 0, b) : (val.v || 0);
        continue;
      }
      if (jointName === 'bodySide') {
        drivenPose.bodySide = (b < 1) ? lerp(poseSnap._bodySide ?? 0, val.v || 0, b) : (val.v || 0);
        continue;
      }
      if (jointName === 'gripMode') {
        const target = val.v || 0;
        const source = poseSnap._gripMode ?? 0;
        drivenPose.gripMode = (b < 1) ? lerp(source, target, b) : target;
        continue;
      }

      let joint;
      let targetX;
      let targetY;
      let targetZ;
      if (jointName === 'chestY') {
        joint = chestJoint;
        targetX = chestJoint.rotation.x;
        targetY = val.v || 0;
        targetZ = chestJoint.rotation.z;
      } else if (jointName === 'chestX') {
        joint = chestJoint;
        targetX = val.v || 0;
        targetY = chestJoint.rotation.y;
        targetZ = chestJoint.rotation.z;
      } else if (jointName === 'chestZ') {
        joint = chestJoint;
        targetX = chestJoint.rotation.x;
        targetY = chestJoint.rotation.y;
        targetZ = val.v || 0;
      } else {
        joint = joints[jointName];
        if (!joint) continue;
        targetX = (val.x !== undefined) ? val.x : joint.rotation.x;
        targetY = (val.y !== undefined) ? val.y : joint.rotation.y;
        targetZ = (val.z !== undefined) ? val.z : joint.rotation.z;
      }

      if (b < 1) {
        const snapKey = (jointName === 'chestX' || jointName === 'chestY' || jointName === 'chestZ') ? 'chest' : jointName;
        const source = poseSnap[snapKey] || { x: 0, y: 0, z: 0 };
        joint.rotation.x = lerp(source.x, targetX, b);
        joint.rotation.y = lerp(source.y, targetY, b);
        joint.rotation.z = lerp(source.z, targetZ, b);
      } else {
        joint.rotation.x = targetX;
        joint.rotation.y = targetY;
        joint.rotation.z = targetZ;
      }
    }
  }

  return {
    joints,
    resetJoints,
    resetDrivenPose,
    resetDrivenState: resetDrivenPose,
    getDrivenPose,
    getDrivenState: getDrivenPose,
    capturePoseSnapshot,
    applyClip,
  };
}
