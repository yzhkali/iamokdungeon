import { installTestProbe } from "../debug/testProbe.js";
import { createGameLoop } from "../loop.js";
import { createWaterReflectionPass } from "../rendering/waterReflection.js";
import { createMapHud } from "../ui/mapHud.js";

export function createRuntimeServices({
  THREE,
  roomSize,
  mapFeatures,
  getPlayer,
  heavyChargeTime,
  clearGameplayInputState,
  documentRef = document,
  windowRef = window,
  renderer,
  scene,
  camera,
  cameraRig,
  reflRT,
  sceneRT,
  reflCam,
  reflClip,
  reflMatrix,
  waterReflectionMeshes,
  getWaterSurfaceMaterial,
  createMapHudFn = createMapHud,
  createWaterReflectionPassFn = createWaterReflectionPass,
  installTestProbeFn = installTestProbe,
  globalRef = globalThis,
}) {
  const mapHud = createMapHudFn({
    THREE,
    roomSize,
    mapFeatures,
    getPlayer,
    heavyChargeTime,
    clearGameplayInputState,
    documentRef,
    windowRef,
  });
  const waterReflectionPass = createWaterReflectionPassFn({
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
  });
  installTestProbeFn({
    globalRef,
    camera,
    cameraRig,
    getPlayer,
    renderer,
    waterReflectionMeshes,
    reflRT,
    sceneRT,
  });

  return { mapHud, waterReflectionPass };
}

export function startRuntimeView({
  renderer,
  camera,
  documentRef = document,
  windowRef = window,
  padStatus,
}) {
  function resize() {
    const w = windowRef.innerWidth;
    const h = windowRef.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  windowRef.addEventListener("resize", resize);
  resize();
  padStatus();
  documentRef.getElementById("loading").style.display = "none";
  return { resize };
}

export function startRuntimeLoop({
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
  createGameLoopFn = createGameLoop,
}) {
  const gameLoop = createGameLoopFn({
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
  });
  gameLoop.start();
  return gameLoop;
}
