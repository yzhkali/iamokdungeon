export function createGameLoop({
  clock,
  update,
  updateWolf,
  updateSky,
  getSkyData,
  camera,
  updateWater,
  cameraController,
  mapHud,
  updateGrass,
  getGrassMats,
  waterReflectionPass,
  renderer,
  scene,
  requestAnimationFrameRef = callback => globalThis.requestAnimationFrame(callback),
  consoleRef = console,
  maxDelta = 0.05
}) {
  function loop() {
    let dt = clock.getDelta();
    if (dt > maxDelta) dt = maxDelta;

    update(dt);
    try {
      updateWolf(dt);
    } catch (error) {
      consoleRef.error('wolf err:', error);
    }

    const skyData = getSkyData();
    if (skyData) updateSky({ skyData, camera, dt });
    updateWater(clock.getElapsedTime());
    cameraController.updateCamera(dt);
    mapHud.updateHUD();
    updateGrass({ grassMats: getGrassMats(), time: clock.getElapsedTime() });
    waterReflectionPass.render();
    renderer.render(scene, camera);
    requestAnimationFrameRef(loop);
  }

  return { loop, start: loop };
}
