export function createWaterReflectionPass({
  renderer,
  scene,
  camera,
  reflRT,
  sceneRT,
  reflCam,
  reflClip,
  reflMatrix,
  waterReflectionMeshes,
  getWaterSurfaceMaterial,
  waterY = -2
}) {
  function render() {
    const width = renderer.domElement.width;
    const height = renderer.domElement.height;
    if (reflRT.width !== width || reflRT.height !== height) {
      reflRT.setSize(width, height);
      sceneRT.setSize(width, height);
      const waterSurfaceMaterial = getWaterSurfaceMaterial?.();
      waterSurfaceMaterial?.uniforms?.uRes?.value?.set(width, height);
    }

    reflMatrix.set(1, 0, 0, 0, 0, -1, 0, 2 * waterY, 0, 0, 1, 0, 0, 0, 0, 1);
    reflCam.projectionMatrix.copy(camera.projectionMatrix);
    reflCam.matrixWorld.copy(reflMatrix).multiply(camera.matrixWorld);
    reflCam.matrixWorldInverse.copy(reflCam.matrixWorld).invert();
    reflClip.constant = -waterY;

    for (const mesh of waterReflectionMeshes) mesh.visible = false;
    renderer.setRenderTarget(reflRT);
    renderer.clippingPlanes = [reflClip];
    try {
      renderer.render(scene, reflCam);
    } finally {
      for (const mesh of waterReflectionMeshes) mesh.visible = true;
      renderer.setRenderTarget(null);
      renderer.clippingPlanes = [];
    }
  }

  return { render };
}
