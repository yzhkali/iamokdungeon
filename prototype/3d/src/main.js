import { loadThreeRuntime } from "./core/threeLoader.js";
import { createSfx } from "./core/sfx.js";
import { createModelLoader } from "./core/modelLoader.js";
import { createRenderScene } from "./core/renderScene.js";
import { createRuntimeServices, startRuntimeLoop, startRuntimeView } from "./core/runtimeServices.js";
import { buildGrass, updateGrass } from "./world/grass.js";
import { buildSky, updateSky } from "./world/sky.js";
import { buildTerrainWater } from "./world/terrainWater.js";
import { createWorldCollision } from "./world/collision.js";
import { createVillageBlockout } from "./world/village.js";
import { makeTrainingDummy } from "./world/trainingDummy.js";
import { createWolfRuntime } from "./enemies/wolfRuntime.js";
import { createCameraController } from "./camera.js";
import { CLIPS } from "./player/clips.js";
import { MOVES } from "./player/moves.js";
import { createPlayerRig } from "./player/rig.js";
import { createPlayerState, clonePlayerTuning } from "./player/state.js";
import { createPoseClipController } from "./player/poseClipController.js";
import { createMoveTriggers } from "./player/moveTriggers.js";
import { createCharacterPoseController } from "./player/characterPose.js";
import { createPlayerUpdater } from "./player/updateController.js";
import { createInputController } from "./ui/input.js";
import { sampleTrack } from "./combat/hitMath.js";
import { createCombatRuntime } from "./combat/runtimeCombat.js";
import { STOMP_RADIUS } from "./combat/stompEffects.js";

const loadingEl = document.getElementById('loading');
const { THREE, GLTFLoader } = await loadThreeRuntime({ loadingEl });

const _mapResp=await fetch(new URL('../maps/map15.json', import.meta.url));
if(!_mapResp.ok) throw new Error(`Failed to load map15.json: ${_mapResp.status}`);
const _m15=await _mapResp.json();
const _mapH=new Float32Array(_m15.terrain);
console.log("MAP15 loaded, terrain points:",_mapH.length);
main(THREE, GLTFLoader);
function main(THREE, GLTFLoader){

// ============================================================
//  没事地下城 — 3D 火柴人原型 v0.3
//  修正：手肘正确朝前弯 / 修穿模闪烁 / 加腰&加长肢体 /
//        魔兽式跳跃 / 翻滚不入地 / 柱子墙体碰撞
// ============================================================
const canvas=document.getElementById('c');
const {
  renderer,
  sceneRT,
  reflRT,
  reflCam,
  reflClip: _reflClip,
  reflMatrix: _reflM,
  scene,
  camera,
  cameraRig
} = createRenderScene({ THREE, canvas, pixelRatio: devicePixelRatio });

// ===== 音效系统 (真实CC0音效文件) =====
const SFX=createSfx();
document.addEventListener('keydown',()=>SFX.resume(),{once:true});
document.addEventListener('mousedown',()=>SFX.resume(),{once:true});
const runtimeState = {
  shake: 0,
  hitstop: 0,
  jupiterActive: false,
  jupiterSpin: 0,
  drillSpin: 0
};
const cameraController = createCameraController({
  THREE,
  camera,
  cameraRig,
  getPlayer: () => P,
  getShake: () => runtimeState.shake
});
cameraController.setInitialView();

const terrainWater = buildTerrainWater({
  THREE,
  scene,
  mapData: _m15,
  mapHeights: _mapH,
  sceneRT,
  reflRT,
  documentRef: document,
  windowRef: window
});
const terrainH = terrainWater.terrainHeightAt;
const waterReflectionMeshes = terrainWater.waterReflectionMeshes;
const updateWater = terrainWater.updateWater;
const getWaterSurfaceMaterial = terrainWater.getWaterSurfaceMaterial;

const { placeModel } = createModelLoader({ THREE, GLTFLoader, scene });

// ============================================================
//  Village blockout v1: player village + training yard + monster pen
// ============================================================
const {
  colliders,
  platforms,
  terrainAreas,
  addCollider,
  addTerrainArea,
  addPlatform,
  addPlatformBounds,
  terrainYAt,
  groundHeightAt,
  resolveCollision
} = createWorldCollision({ terrainHeightAt: terrainH });

const ROOM=130;
const hittables=[];   // 可被攻击的物体
const {
  mapRoot,
  mapFeatures,
  registerMapFeature,
  buildNewVillage,
  addGroundPatch,
  addLowWall,
  addStep,
  addBuilding,
  addPlayerHome,
  addTree,
  addPrimitiveRock
} = createVillageBlockout({
  THREE,
  scene,
  placeModel,
  terrainYAt,
  addCollider,
  addTerrainArea,
  addPlatform,
  addPlatformBounds,
  documentRef: document,
  random: Math.random
});

let skyData;
// ── village ──────────────────────────────────────────────────
//buildNewVillage();
skyData = buildSky({ THREE, scene });
// vegetation cleared
; console.log("skyData:",!!skyData,"layers:",skyData?._cloudLayers?.length,"bills:",skyData?._cloudBillboards?.length);

const grassSystem = buildGrass({ THREE, scene, mapH: _mapH });

// ============================================================
//  练武木人桩
// ============================================================
const dummies=[];
function makeDummy(dx,dz,face){
  return makeTrainingDummy({ THREE, scene, registerMapFeature, addCollider, terrainYAt, dummies }, dx, dz, face);
}
//makeDummy(0,5,Math.PI);
const monsters=[];

// ── WOLF AI ─────────────────────────────────────────
const { updateWolf } = createWolfRuntime({
  THREE,
  scene,
  hittables,
  getPlayer: () => P,
  setHitstop: value => { runtimeState.hitstop = value; },
  documentRef: document,
  setTimeoutRef: setTimeout,
  random: Math.random
});

// ============================================================
//  角色：带关节 + 腰 的“老实人”
// ============================================================
const {
  char,
  yaw,
  body,
  chest,
  headGrp,
  RArm,
  LArm,
  RLeg,
  LLeg,
  rWrist,
  weaponSocket,
  weapon,
  weaponTip,
  jupiterBall,
  chargeAura,
  chargeAuraMat,
  gripDefault: GRIP_DEFAULT,
  gripSpear: GRIP_SPEAR
} = createPlayerRig({ THREE });
scene.add(char);
scene.add(jupiterBall);

const STOMP_R=STOMP_RADIUS;                 // 践踏 AoE 半径
const {
  spaceSlash,
  hitResolution,
  attackBursts,
  ghostAfterimages,
  targetFeedback,
  spinRings,
  swordTrail,
  swordBeam,
  stompEffects,
  updateFx
} = createCombatRuntime({
  THREE,
  scene,
  yaw,
  weapon,
  weaponTip,
  getPlayer: () => P,
  getHittables: () => hittables,
  getDummies: () => dummies,
  getMonsters: () => monsters,
  getMoves: () => MOVES,
  sfx: SFX,
  runtimeState,
  getHeavyRadiusMin: () => HEAVY_R_MIN,
  getHeavyRadiusMax: () => HEAVY_R_MAX,
  random: Math.random
});

// ============================================================
//  关键帧动画系统（加动作=加数据表）
//  约定：肘=负值朝前弯；膝=正值朝后弯
// ============================================================
const poseClipController=createPoseClipController({
  CLIPS,
  sampleTrack,
  lerp:THREE.MathUtils.lerp,
  rig:{ RArm,LArm,RLeg,LLeg,chest,headGrp,rWrist,body }
});

// ============================================================
//  输入
// ============================================================
const { Actions, mouse, pollInput, clearGameplayInputState, autoPad, toCameraRelativeMove, padStatus } = createInputController({
  canvas,
  cameraRig,
  getPlayer: () => P,
  documentRef: document,
  windowRef: window
});

// ============================================================
//  玩家状态
// ============================================================
const P=createPlayerState({ makeVector3: () => new THREE.Vector3() });
const {
  MOVE_SPEED, TURN_LERP, JUMP_V, GRAVITY,
  LIGHT_LUNGE, HEAVY_LUNGE, CHARGE_MAX, CHARGE_MOVE, CHARGE_AUTO,
  HEAVY_CHARGE_TIME, HEAVY_CHARGE_HOLD, HEAVY_CHARGE_MINSPD,
  DODGE_DUR, DODGE_SPEED, DODGE_IFRAME, DODGE_COST, STAM_REGEN,
  HEAVY_R_MIN, HEAVY_R_MAX, PLAYER_R
} = clonePlayerTuning();
// 跳跃最高点≈2.8单位(高过2.7的柱子)，空中时间≈0.72s，上升/下落都更快一点
// HEAVY_R_MIN/HEAVY_R_MAX 是重击圆圈半径(空蓄~满蓄)

const {
  playClip,
  fireFx,
  doSlash,
  doThrust,
  startMove,
  startDodgeCombo,
  startSlash
} = createMoveTriggers({
  player: P,
  clips: CLIPS,
  moves: MOVES,
  jumpVelocity: JUMP_V,
  sfx: SFX,
  attackBursts,
  swordBeam,
  stompEffects,
  poseClipController,
  setHitstop: value => { runtimeState.hitstop = value; },
  setShake: value => { runtimeState.shake = value; },
  resetDrillSpin: () => { runtimeState.drillSpin = 0; }
});
const { poseCharacter } = createCharacterPoseController({
  THREE,
  player: P,
  moves: MOVES,
  rig: {
    char,
    body,
    chest,
    headGrp,
    RArm,
    LArm,
    RLeg,
    LLeg,
    weaponSocket,
    weapon,
    jupiterBall,
    chargeAura,
    chargeAuraMat
  },
  poseClipController,
  gripDefault: GRIP_DEFAULT,
  gripSpear: GRIP_SPEAR,
  heavyChargeTime: HEAVY_CHARGE_TIME,
  getJupiterActive: () => runtimeState.jupiterActive,
  setJupiterActive: value => { runtimeState.jupiterActive = value; },
  getJupiterSpin: () => runtimeState.jupiterSpin,
  setJupiterSpin: value => { runtimeState.jupiterSpin = value; },
  getDrillSpin: () => runtimeState.drillSpin,
  setDrillSpin: value => { runtimeState.drillSpin = value; }
});
const clock=new THREE.Clock();

// ============================================================
//  自动地图：同一份场景登记数据生成小地图和展开地图
// ============================================================
const { mapHud, waterReflectionPass } = createRuntimeServices({
  THREE,
  roomSize: ROOM,
  mapFeatures,
  getPlayer: () => P,
  heavyChargeTime: HEAVY_CHARGE_TIME,
  clearGameplayInputState,
  documentRef: document,
  windowRef: window,
  globalRef: globalThis,
  renderer,
  scene,
  camera,
  cameraRig,
  reflRT,
  sceneRT,
  reflCam,
  reflClip: _reflClip,
  reflMatrix: _reflM,
  waterReflectionMeshes,
  getWaterSurfaceMaterial
});
const { update } = createPlayerUpdater({
  player: P,
  runtimeState,
  getMapHud: () => mapHud,
  clearGameplayInputState,
  updateFx,
  poseCharacter,
  autoPad,
  pollInput,
  Actions,
  mouse,
  toCameraRelativeMove,
  swordTrail,
  spaceSlash,
  sfx: SFX,
  startDodgeCombo,
  startMove,
  playClip,
  groundHeightAt,
  jumpVelocity: JUMP_V,
  gravity: GRAVITY,
  moves: MOVES,
  poseClipController,
  clips: CLIPS,
  fireFx,
  hitResolution,
  jupiterBall,
  char,
  body,
  weaponSocket,
  weapon,
  moveSpeed: MOVE_SPEED,
  heavyChargeMinSpeed: HEAVY_CHARGE_MINSPD,
  heavyChargeTime: HEAVY_CHARGE_TIME,
  heavyChargeHold: HEAVY_CHARGE_HOLD,
  dodgeDuration: DODGE_DUR,
  dodgeSpeed: DODGE_SPEED,
  dodgeIframe: DODGE_IFRAME,
  dodgeCost: DODGE_COST,
  staminaRegen: STAM_REGEN,
  turnLerp: TURN_LERP,
  roomSize: ROOM,
  playerRadius: PLAYER_R,
  resolveCollision,
  yaw,
  ghostAfterimages,
  swordBeam,
  spinRings,
  stompEffects
});
startRuntimeView({
  renderer,
  camera,
  documentRef: document,
  windowRef: window,
  padStatus
});
startRuntimeLoop({
  clock,
  update,
  updateWolf,
  updateSky,
  getSkyData: () => skyData,
  camera,
  updateWater,
  cameraController,
  mapHud,
  updateGrass,
  getGrassMats: () => grassSystem.grassMats,
  waterReflectionPass,
  renderer,
  scene
});
}
