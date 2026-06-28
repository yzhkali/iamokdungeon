export function createCameraController({ THREE, camera, cameraRig, getPlayer, getShake = () => 0, random = Math.random }) {
  function cameraOffset(distance = cameraRig.currentDistance) {
    const cp = Math.cos(cameraRig.pitch);
    return new THREE.Vector3(
      Math.sin(cameraRig.yaw) * cp * distance,
      Math.sin(cameraRig.pitch) * distance,
      Math.cos(cameraRig.yaw) * cp * distance
    );
  }

  function setInitialView() {
    camera.position.copy(cameraOffset(cameraRig.distance));
    camera.lookAt(0, 1.7, 0);
  }

  function updateCamera(dt) {
    const P = getPlayer();
    cameraRig.targetYaw += cameraRig.stickX * cameraRig.yawSpeed * dt;
    cameraRig.targetPitch = Math.max(cameraRig.minPitch, Math.min(cameraRig.maxPitch,
      cameraRig.targetPitch + cameraRig.stickY * cameraRig.pitchSpeed * dt));
    cameraRig.yaw += angleDelta(cameraRig.yaw, cameraRig.targetYaw) * Math.min(1, dt * 10);
    cameraRig.pitch = THREE.MathUtils.lerp(cameraRig.pitch, cameraRig.targetPitch, Math.min(1, dt * 10));
    const dist = cameraRig.outdoorDistance;
    const cp = Math.cos(cameraRig.pitch), sp = Math.sin(cameraRig.pitch);
    const cy = Math.cos(cameraRig.yaw), sy = Math.sin(cameraRig.yaw);
    const tgt = new THREE.Vector3(P.x, P.y + 1.7, P.z);
    const ideal = new THREE.Vector3(
      tgt.x + sy * cp * dist,
      tgt.y + sp * dist,
      tgt.z + cy * cp * dist);
    ideal.y = Math.max(ideal.y, 1.0);
    camera.position.copy(ideal);
    const shake = getShake();
    if (shake > 0) {
      camera.position.x += (random() - 0.5) * shake;
      camera.position.y += (random() - 0.5) * shake;
    }
    camera.lookAt(tgt);
  }

  return { cameraOffset, setInitialView, updateCamera };
}

function angleDelta(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
