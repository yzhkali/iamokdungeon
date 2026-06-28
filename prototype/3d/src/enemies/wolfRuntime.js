import { makeWolf } from "../wolf.js";
import { createWolfAiController } from "./wolfAi.js";

export function createWolfRuntime({
  THREE,
  scene,
  hittables,
  getPlayer,
  setHitstop,
  documentRef = document,
  setTimeoutRef = setTimeout,
  random = Math.random,
  makeWolfFn = makeWolf,
  createWolfAiControllerFn = createWolfAiController,
}) {
  const wolf = makeWolfFn(THREE, scene, 0, 0.72, -40);
  const wolfController = createWolfAiControllerFn({
    wolf,
    hittables,
    getPlayer,
    setHitstop,
    documentRef,
    setTimeoutRef,
    random,
  });

  function updateWolf(dt) {
    wolfController.updateWolf(dt);
  }

  return {
    wolf,
    wolfController,
    wolfAI: wolfController.wolfAI,
    updateWolf,
  };
}
