export function installTestProbe({
  globalRef = globalThis,
  camera,
  cameraRig,
  getPlayer,
  renderer,
  waterReflectionMeshes,
  reflRT,
  sceneRT,
}) {
  if (!globalRef.__IAMOK_ENABLE_TEST_PROBE__) return null;

  const probe = {
    camera: () => {
      const player = getPlayer();
      return {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z,
        yaw: cameraRig.yaw,
        pitch: cameraRig.pitch,
        targetYaw: cameraRig.targetYaw,
        targetPitch: cameraRig.targetPitch,
        minPitch: cameraRig.minPitch,
        maxPitch: cameraRig.maxPitch,
        playerTargetX: player.x,
        playerTargetY: player.y + 1.7,
        playerTargetZ: player.z,
      };
    },
    render: () => ({
      renderTargetIsNull: renderer.getRenderTarget ? renderer.getRenderTarget() === null : true,
      clippingPlanes: renderer.clippingPlanes.length,
      waterReflectionMeshesVisible: waterReflectionMeshes.every(mesh => mesh.visible !== false),
      rendererWidth: renderer.domElement.width,
      rendererHeight: renderer.domElement.height,
      reflWidth: reflRT.width,
      reflHeight: reflRT.height,
      sceneRTWidth: sceneRT.width,
      sceneRTHeight: sceneRT.height,
    }),
  };

  globalRef.__IAMOK_TEST_PROBE__ = probe;
  return probe;
}
