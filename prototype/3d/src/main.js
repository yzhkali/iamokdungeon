import { loadThreeRuntime } from "./core/threeLoader.js";
import { createSfx } from "./core/sfx.js";
import { createModelLoader } from "./core/modelLoader.js";
import { buildGrass, updateGrass } from "./world/grass.js";
import { buildSky, updateSky } from "./world/sky.js";
import { buildTerrainWater } from "./world/terrainWater.js";
import { createWorldCollision } from "./world/collision.js";
import { createVillageBlockout } from "./world/village.js";
import { makeTrainingDummy } from "./world/trainingDummy.js";
import { makeWolf } from "./wolf.js";
import { createWolfAiController } from "./enemies/wolfAi.js";
import { createCameraController } from "./camera.js";
import { CLIPS } from "./player/clips.js";
import { MOVES } from "./player/moves.js";
import { createPlayerRig } from "./player/rig.js";
import { createPlayerState, clonePlayerTuning } from "./player/state.js";
import { createGhostAfterimages } from "./player/ghostAfterimages.js";
import { createPoseClipController } from "./player/poseClipController.js";
import { createMoveTriggers } from "./player/moveTriggers.js";
import { createInputController } from "./ui/input.js";
import { createMapHud } from "./ui/mapHud.js";
import { createWaterReflectionPass } from "./rendering/waterReflection.js";
import { createGameLoop } from "./loop.js";
import { installTestProbe } from "./debug/testProbe.js";
import { angleDelta, isInSpinSweepArc, isInThrustBox, sampleTrack } from "./combat/hitMath.js";
import { createSwordTrail } from "./combat/swordTrail.js";
import { createSpaceSlash } from "./combat/spaceSlash.js";
import { createSwordBeamController } from "./combat/swordBeam.js";
import { createStompEffects, STOMP_RADIUS } from "./combat/stompEffects.js";
import { createSpinRings } from "./combat/spinRings.js";
import { createAttackBursts } from "./combat/attackBursts.js";
import { createTargetFeedback } from "./combat/targetFeedback.js";
import { createHitResolution, SPIN_RADIUS } from "./combat/hitResolution.js";

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
const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
let sceneRT=new THREE.WebGLRenderTarget(1,1);
let reflRT=new THREE.WebGLRenderTarget(1,1);
const reflCam=new THREE.PerspectiveCamera();
const _reflClip=new THREE.Plane(new THREE.Vector3(0,1,0),0);
reflCam.matrixAutoUpdate=false;
const _reflM=new THREE.Matrix4();
renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;

// ===== 音效系统 (真实CC0音效文件) =====
const SFX=createSfx();
document.addEventListener('keydown',()=>SFX.resume(),{once:true});
document.addEventListener('mousedown',()=>SFX.resume(),{once:true});

const scene=new THREE.Scene();
scene.background=new THREE.Color(0xbbd0df);
// scene.fog=new THREE.Fog(0xbbd0df,60,220); // 已关闭远景雾

const camera=new THREE.PerspectiveCamera(45,1,0.1,2000);
const cameraRig={
  yaw:0,
  pitch:THREE.MathUtils.degToRad(43),
  targetYaw:0,
  targetPitch:THREE.MathUtils.degToRad(43),
  distance:43,
  outdoorDistance:43,
  indoorDistance:11,
  currentDistance:43,
  minDistance:12,
  indoorMinDistance:2.4,
  maxDistance:90,
  minPitch:THREE.MathUtils.degToRad(8),
  maxPitch:THREE.MathUtils.degToRad(78),
  indoorMinPitch:THREE.MathUtils.degToRad(16),
  indoorMaxPitch:THREE.MathUtils.degToRad(48),
  yawSpeed:1.55,
  pitchSpeed:1.05,
  stickX:0,
  stickY:0
};
const cameraController = createCameraController({
  THREE,
  camera,
  cameraRig,
  getPlayer: () => P,
  getShake: () => shake
});
cameraController.setInitialView();

scene.add(new THREE.HemisphereLight(0xb9c6d6,0x4a3f36,0.75));
const sun=new THREE.DirectionalLight(0xfff2d8,1.15);
sun.position.set(12,26,10); sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048); sun.shadow.camera.near=1; sun.shadow.camera.far=140;
const sc=60; sun.shadow.camera.left=-sc; sun.shadow.camera.right=sc; sun.shadow.camera.top=sc; sun.shadow.camera.bottom=-sc;
sun.shadow.bias=-0.0005; scene.add(sun);

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

// ─── WOLF ──────────────────────────────────────────────
let wolf=null;

// ── WOLF AI ─────────────────────────────────────────
wolf=makeWolf(THREE, scene, 0, 0.72, -40);
const wolfController = createWolfAiController({
  wolf,
  hittables,
  getPlayer: () => P,
  setHitstop: value => { hitstop = value; },
  documentRef: document,
  setTimeoutRef: setTimeout,
  random: Math.random
});
const wolfAI = wolfController.wolfAI;
function updateWolf(dt){ wolfController.updateWolf(dt); }

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
let jupiterActive=false,_jSpin=0,_drillSpin=0;

const spaceSlash = createSpaceSlash({ THREE, scene });
// 命中钩子：带空间斩标记时，在命中点放空间斩并清除标记
function onHitTarget(ox,oy,oz){
  if(spaceSlash.consumeHit(ox,oy,oz)){ hitstop=Math.max(hitstop,0.06); shake=Math.max(shake,0.2); }
  // 命中音效:骷髅→骨头脆响, 木桩→撞木声, 怪物(肉)→闷击声
  const nearDummy=dummies.some(d=>Math.hypot(d.x-ox,d.z-oz)<1.8);
  const nearMonster=monsters.some(m=>Math.hypot(m.x-ox,m.z-oz)<1.8);
  if(nearMonster) SFX.hitBone();
  else if(nearDummy) SFX.hitWood();
  else SFX.hitFlesh();
}
const hitResolution=createHitResolution({
  getPlayer:()=>P,
  getHittables:()=>hittables,
  getDummies:()=>dummies,
  getMonsters:()=>monsters,
  getMoves:()=>MOVES,
  onHitTarget:onHitTarget,
  boostImpact:(nextHitstop,nextShake)=>{ hitstop=Math.max(hitstop,nextHitstop); shake=Math.max(shake,nextShake); },
  isInThrustBox:isInThrustBox,
  isInSpinSweepArc:isInSpinSweepArc
});

// ============================================================
//  攻击特效（朝向 yaw 局部 +Z = 正前方）
// ============================================================
const attackBursts=createAttackBursts({
  THREE,
  yaw,
  getHeavyRadiusMin:()=>HEAVY_R_MIN,
  getHeavyRadiusMax:()=>HEAVY_R_MAX,
  setImpact:(nextHitstop,nextShake)=>{ hitstop=nextHitstop; shake=nextShake; }
});

// 闪避残影池
const ghostAfterimages=createGhostAfterimages({
  THREE,
  scene,
  getPlayer:()=>P,
  getYawRotationY:()=>yaw.rotation.y
});

const targetFeedback=createTargetFeedback({
  getHittables:()=>hittables,
  getDummies:()=>dummies,
  getMonsters:()=>monsters,
  random:Math.random
});

// ============================================================
//  大风车"土星环"特效：从剑轨迹往外发散的同心圆扩散环
// ============================================================
const spinRings=createSpinRings({
  THREE,
  scene,
  getPlayer:()=>P,
  getSpinRadius:()=>SPIN_RADIUS
});

const swordTrail = createSwordTrail({ THREE, scene, weapon, weaponTip });


// ============================================================
//  剑气弹幕（薄而立体的鲨鱼鳍，贴地飞 + 弹道追踪式裂缝）
// ============================================================
const swordBeam = createSwordBeamController({ THREE, scene, getPlayer: () => P });



// ============================================================
//  战争践踏(空中重击)：落地浅坑痕迹 + 溅射碎石 + 强震
//  痕迹保持10秒 → 10~15秒淡出消失；碎石溅射弹跳后静置，随痕迹一同消失
// ============================================================
const STOMP_R=STOMP_RADIUS;                 // 践踏 AoE 半径
const stompEffects=createStompEffects({
  THREE,
  scene,
  getPlayer:()=>P,
  getHittables:()=>hittables,
  getDummies:()=>dummies,
  playStomp:()=>SFX.stomp(),
  boostImpact:()=>{ hitstop=Math.max(hitstop,0.12); shake=Math.max(shake,0.45); }
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
let shake=0,hitstop=0;

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
  setHitstop: value => { hitstop = value; },
  setShake: value => { shake = value; },
  resetDrillSpin: () => { _drillSpin = 0; }
});
const clock=new THREE.Clock();
function update(dt){
  if(mapHud.isWorldMapOpen()){updateFx(dt);poseCharacter(dt);return;}
  if(P.dead){clearGameplayInputState();updateFx(dt);poseCharacter(dt);return;}
  autoPad();pollInput();
  if(hitstop>0){hitstop-=dt;updateFx(dt);return;}
  if(P.iframe>0)P.iframe-=dt;
  const rawX=Actions.moveX,rawZ=Actions.moveZ,inLen=Math.hypot(rawX,rawZ);
  const camMove=toCameraRelativeMove(rawX,rawZ);
  const inX=camMove.x,inZ=camMove.z;

  // 闪避（破僵直/空中可用；空中保留高度自然下落）
  if(Actions.dodge && P.state!=='dodge' && P.stamina>=DODGE_COST){
    let dx=inX,dz=inZ; if(inLen<0.01){dx=Math.sin(P.facing);dz=Math.cos(P.facing);}
    const l=Math.hypot(dx,dz)||1;dx/=l;dz/=l;
    // 剑攻击中(挥砍主体段/剑影还在)用闪避打断 → 标记下次剑攻击触发空间斩
    if(P.move && swordTrail.mesh.visible && swordTrail.isActive()){ spaceSlash.markReady(); }
    P.state='dodge';P.dodgeT=DODGE_DUR;P.dodgeDir.set(dx,0,dz);P.roll=0;
    SFX.dodge();
    P.iframe=DODGE_IFRAME;P.stamina-=DODGE_COST;P.facing=Math.atan2(dx,dz);
    P.charging=false;P.chargeHold=0;P.chargeFull=false;P.chargeFullT=0;P.chargeLock=true;P.clip=null;P.move=null;
    P.airDodge = P.jumping || P.y>0.01;
    P.dodgeBuffer=null;   // 清空闪避连招缓冲(本次冲刺重新计)
  }

  // ===== 闪避中：缓冲连招输入(冲刺全程可预输入，闪避动作完整播完才触发) =====
  // 放宽判定：冲刺中只要按下过轻击/重击就记缓冲(重击看按住，不必等松手)，更好衔接
  if(P.state==='dodge'){
    if(Actions.attack || mouse.left) P.dodgeBuffer='light';        // 李小龙飞踢
    if(Actions.heavyHeld || Actions.heavyReleased) P.dodgeBuffer='heavy';   // 升龙剑(按住或松手都记)
  }
  // 闪避刚结束的宽限期：这段时间内按出轻/重也能触发闪避连招(把窗口做大，更好出招)
  if(P.dodgeGrace>0){
    P.dodgeGrace-=dt;
    if(!P.move && P.state==='idle'){
      if(Actions.attack){ P.dodgeGrace=0; startDodgeCombo('light'); }
      else if(Actions.heavyHeld || Actions.heavyReleased){ P.dodgeGrace=0; startDodgeCombo('heavy'); }
    }
  }

  // ===== 连招输入处理 =====
  const gH = groundHeightAt(P.x,P.z);
  const onGround = !P.jumping && P.y<=gH+0.05;
  // 钻地反弹:第一次落地弹起,第二次落地播蜘蛛侠
  if(P._drillBounce>0&&onGround&&!P.jumping&&!P.move){P.vy=P._drillBounce;P.jumping=true;P._drillBounce=0;P._drillBounced=true;}
  if(P._drillBounced&&onGround&&!P.jumping&&!P.move){P._drillBounced=false;startMove('aJupiterLand');}
  if(P.state!=='dodge' && P.state!=='taunt'){
    // --- 不在招式中：起手 ---
    if(!P.move){
      if(Actions.attack && !P.charging){
        startMove(onGround ? 'gL1' : 'aL1');
      } else if(onGround){
        // 地面重击：按住蓄力，松手释放
        if(Actions.heavyHeld && !P.charging && !P.chargeLock){
          P.charging=true; P.chargeT=0; P.chargeFull=false; P.chargeFullT=0;
        }
        if(Actions.heavyReleased && P.charging){
          const full = P.chargeFull;
          P.charging=false; P.chargeT=0; P.chargeFull=false;
          startMove(full ? 'gSpinCharged' : 'gSpin');   // 蓄满→三圈, 否则→一圈
        }
      } else if(!onGround && Actions.heavyReleased && !P.chargeLock){
        // 空中直接重击：践踏(aStomp)
        startMove('aStomp'); P.chargeLock=true;
      }
    }
    // --- 招式中：缓冲下一击输入（整段招式内都可预输入）---
    else {
      if(Actions.attack) P.nextBuffer='light';
      if(Actions.heavyReleased){
        // 升龙剑由"按住右键"触发，松开初始那一下不算接招(否则直接接出践踏)；之后再按才接
        if(P._ignoreHeavyRelease){ P._ignoreHeavyRelease=false; }
        else P.nextBuffer='heavy';
      }
    }
  }
  if(!Actions.heavyHeld) P.chargeLock=false;

  // 蓄力计时（蓄力时可半蹲移动，越蓄越慢；蓄满闪烁1秒后不松手则取消）
  if(P.charging){
    if(Actions.heavyHeld){
      P.chargeT=Math.min(HEAVY_CHARGE_TIME, P.chargeT+dt);
      if(P.chargeT>=HEAVY_CHARGE_TIME){
        P.chargeFull=true; P.chargeFullT+=dt;
        if(P.chargeFullT>=HEAVY_CHARGE_HOLD){ P.charging=false; P.chargeFull=false; P.chargeLock=true; } // 超时取消并上锁
      }
    }
  }

  // 推眼镜彩蛋
  if(Actions.taunt && P.state==='idle' && !P.charging && !P.move){ P.state='taunt'; playClip('pushGlasses'); }

  // 跳跃
  if(Actions.jump && !P.jumping && P.state!=='dodge' && !P.move && onGround){ P.jumping=true; P.vy=JUMP_V; }
  // 垂直物理：落到当前位置的支撑高度(地面/平台顶)
  if(P.jumping || P.y>gH+0.25){
    P.jumping=true;                      // 走出平台边缘 → 进入下落
    P.y+=P.vy*dt; P.vy-=GRAVITY*dt;
    const land=groundHeightAt(P.x,P.z);
    if(P.vy<=0 && P.y<=land){ P.y=land; P.jumping=false; P.vy=0; }
  } else {
    P.y=gH;                              // 贴合脚下支撑面
  }

  // ===== 招式推进（预备→挥击(strike触发特效+顿帧)→结尾定格→衔接/收势）=====
  if(P.move){
    const mv=MOVES[P.move];
    P.moveT+=dt;
    if(P.blendT<P.blendDur) P.blendT+=dt;   // 推进切招过渡补间
    // 升龙剑：地面弓步深蹲+二次压缩到 0.24 秒"啪"蹬地起跳(一次性，起跳高度=平时跳跃)
    if(P.move==='dRise' && !P._launched && P.moveT>=0.24){ P._launched=true; P.jumping=true; P.vy=JUMP_V; }
    // 阶段
    if(P.moveT<mv.strike) P.phase='startup';
    else if(P.moveT<mv.cancel) P.phase='active';
    else P.phase='hold';   // cancel~total 之间是结尾定格(强制停顿)

    // 进入收尾段：仅 useRecoverClip 的招式切到收尾动画(如蓄满大风车的晕眩)
    if(mv.useRecoverClip && mv.recoverClip && P.phase==='hold' && P.clip!==mv.recoverClip){
      poseClipController.capturePoseSnapshot(); P.blendT=0; P.blendDur=0.12;
      P.clip=mv.recoverClip; P.clipT=0; P.clipDur=CLIPS[mv.recoverClip].dur;
    }
    if(P.clip===mv.recoverClip) P.clipT+=dt;

    // 挥砍主体段开启拖尾(strike前一点开始，cancel停止)
    if(mv.trail && !P._trailStarted && P.moveT>=mv.strike-0.10){ P._trailStarted=true; swordTrail.startTrail(mv.trailSegs||(mv.spinY?26:4)); }
    // 命中瞬间：触发特效 + 顿帧 + 检测打到的物体
    if(!P.struck && P.moveT>=mv.strike){ P.struck=true; if(mv.fx) fireFx(mv.fx);
      if(mv.thrustHit) hitResolution.tryThrustHit();
      else if(mv.ringHit && !mv.spinY) hitResolution.tryRingHit();
      else if(!mv.ringHit && !mv.spinY && !mv.landHit && !mv.plunge) hitResolution.tryHitObjects(mv.hitR||0); }
    // 大风车：判定跟随剑的旋转角度(扫到哪个角度,那个角度才命中)
    if(mv.spinY && P.spin>0 && P.spin<1){
      // 每完成一圈就重置命中记录,让转几圈打几次
      const turns=mv.spinTurns||1;
      const curRot=Math.floor(P.spin*turns);
      if(P._lastSpinRot===undefined||curRot!==P._lastSpinRot){ P._spinHit&&P._spinHit.clear(); P._lastSpinRot=curRot; }
      hitResolution.trySweepHit();
    }
    // aJupiter 多段：每转一整圈再打一次
    if(P.move==='aJupiter' && P.struck && !P._plungeDone){
      const curRev=Math.floor(_jSpin/(Math.PI*2));
      if(P._jupRev!==curRev){ P._jupRev=curRev; if(curRev>0) hitResolution.tryJupiterHit(); }
    }
    // 突刺判定：滑行全程持续命中(长矩形)
    if(mv.thrustHit && P.struck && P.moveT<mv.cancel){ hitResolution.tryThrustHit(); }
    // 挥砍结束后让拖尾淡出(大风车记录到招式末尾以画满整圈，其余到cancel)
    const trailStop = mv.spinY ? mv.total : mv.cancel;
    if(mv.trail && swordTrail.isActive() && P.moveT>=trailStop){ swordTrail.stopTrail(); }

    // 空中俯冲砸：落地瞬间转入插地僵直动画
    if(mv.plunge && onGround && P.moveT>0.05 && !P._plungeDone){
      P._plungeDone=true;
      // 木星球体变身：落地瞬间恢复角色
      if(jupiterActive){ jupiterActive=false; jupiterBall.visible=false; char.traverse(o=>{ if(o.isMesh) o.visible=true; }); body.rotation.x=0; }
      if(P._jupSword){ P._jupSword=false; weaponSocket.attach(weapon); weapon.position.set(0,0,0); weapon.rotation.set(0,0,0); }
      P.chargeLock=true;   // 落地后短暂锁定重击,防止连按重击意外触发地面大风车
      if(jupiterActive){jupiterActive=false;jupiterBall.visible=false;}
      if(mv.landFx) fireFx(mv.landFx);              // 落地冲击特效(aChop=slam / aStomp=stomp)
      if(mv.landHit) hitResolution.tryHitObjects(mv.hitR||0);     // 落地正前判定(仅 aChop；aStomp 的判定在 doStomp 周身AoE)
      P.clip=mv.plunge; P.clipDur=CLIPS[mv.plunge].dur; P.clipT=0;
      P.moveT=mv.total; P._customRecover=CLIPS[mv.plunge].dur;
    }
    // 空中招自然落地泄力(升龙剑等)：没接招自然下落着地时，播 landClip 收势
    if(mv.landClip && !mv.plunge && onGround && P._launched && !P._plungeDone && P.moveT>0.30){
      P._plungeDone=true;
      poseClipController.capturePoseSnapshot(); P.blendT=0; P.blendDur=0.10;
      P.clip=mv.landClip; P.clipDur=CLIPS[mv.landClip].dur; P.clipT=0;
      P.moveT=mv.total; P._customRecover=CLIPS[mv.landClip].dur;
    }

    // 提前衔接：招式声明 comboAt 时，缓冲输入可在该时刻立即接下一招(取消定格)
    if(mv.comboAt!==undefined && P.moveT>=mv.comboAt && !P._plungeDone){
      let nxt=null;
      if(P.nextBuffer==='light' && mv.onLight) nxt=mv.onLight;
      else if(P.nextBuffer==='heavy' && mv.onHeavy) nxt=mv.onHeavy;
      if(nxt){ startMove(nxt); }
    }

    // 招式完全结束(定格播完)后衔接/收势
    const endT = mv.total + (P._customRecover||0);
    if(P.move && P.moveT>=endT && !(mv.plunge && !onGround && !P._plungeDone)){
      let nxt=null;
      if(mv.auto) nxt=mv.auto;
      else if(P.nextBuffer==='light' && mv.onLight) nxt=mv.onLight;
      else if(P.nextBuffer==='heavy' && mv.onHeavy) nxt=mv.onHeavy;
      if(nxt){ startMove(nxt); }            // 衔接下一招(已含其自身的预备段)
      else { P._customRecover=null; P._plungeDone=false; if(jupiterActive){jupiterActive=false;jupiterBall.visible=false;char.traverse(o=>{if(o.isMesh)o.visible=true;})}
      P.move=null; P.spin=0; P.state='idle'; P.clip=null; }
    }
  }

  // 片段计时（非连招的clip，如推眼镜）
  if(P.clip && !P.move){P.clipT+=dt;if(P.clipT>=P.clipDur){P.clip=null;if(P.state==='taunt')P.state='idle';}}
  else if(P.clip && P.move){ P.clipT+=dt; }

  // 移动
  let vX=0,vZ=0;P.moving=false;
  if(P.state==='dodge'){
    vX=P.dodgeDir.x*DODGE_SPEED;vZ=P.dodgeDir.z*DODGE_SPEED;
    P.dodgeT-=dt;P.roll=Math.min(1,(DODGE_DUR-P.dodgeT)/DODGE_DUR);
    ghostAfterimages.tickDodge(dt);
    if(P.dodgeT<=0){
      P.state='idle';P.roll=0;
      // 闪避动作播完：有预输入立即触发，否则给一段宽限期(闪避刚结束按出也能接)
      if(P.dodgeBuffer){ startDodgeCombo(P.dodgeBuffer); P.dodgeBuffer=null; }
      else P.dodgeGrace=0.32;
    }
  } else if(P.move){
    const mv=MOVES[P.move];
    // 蓄满大风车：旋转中可20%移动
    if(mv.chargedMove && P.spin>0 && P.spin<1){
      const sp=MOVE_SPEED*HEAVY_CHARGE_MINSPD;
      vX+=inX*sp; vZ+=inZ*sp;
      if(inLen>0.01){ P.moving=true; }   // 不改facing(旋转中朝向由spin控制)
    }
    // 前冲：集中在挥击瞬间(strike前后)，先冲后停 → 有"踏步出击"的发力感
    if(P.lunge && P.moveT<mv.cancel){
      const k = P.lunge * Math.max(0, 1 - Math.abs(P.moveT-mv.strike)/0.18);
      vX=Math.sin(P.facing)*k; vZ=Math.cos(P.facing)*k;
    }
    if(mv.chargeSlide && P.move==='dRise' && !P._launched){
      const k=mv.chargeSlide*Math.max(0,1-P.moveT/0.24);
      vX+=Math.sin(P.facing)*k; vZ+=Math.cos(P.facing)*k;
    }
    // 冰面打滑式滑行：突刺瞬间(strike)给一个高速度，之后指数减速滑停
    if(mv.slide){
      if(!P.struck){ /* 蓄力阶段不滑 */ }
      else {
        if(P._slideV===undefined||P._slideStarted!==P.move){ P._slideV=mv.slide; P._slideStarted=P.move; }
        vX += Math.sin(P.facing)*P._slideV; vZ += Math.cos(P.facing)*P._slideV;
        P._slideV *= Math.pow(0.02, dt);   // 指数减速(刹不住→慢慢停)
      }
    }
    // 空中俯冲砸：带 plunge 的招在空中时强制快速下坠(起手可先滞空停留)
    if(mv.plunge && !onGround){
      if(P._stompHang>0){ P._stompHang-=dt; P.vy=0; }   // 升龙顶点接践踏：先在最高点悬停一下
      else if(mv.hangT && P.moveT<mv.hangT){ P.vy*=0.4; }   // 起手滞空停留(跳远式hang，强阻尼≈悬停)
      else P.vy=-(mv.diveV||18);                         // 停留结束→猛地下坠(diveV 可定制更猛，如陨石践踏)
    }
    // 空中第一下轻击(aL1)滞空：减缓下坠制造悬停感(俯冲/旋转/升龙起跳 招不滞空)
    else if(mv.air && !mv.plunge && !mv.spin && !mv.noHang && !onGround){ P.vy*=0.5; }
    // 升龙剑顶点短暂定格：到达最高点附近时强阻尼悬停，方便接招
    if(P.move==='dRise' && P._launched && P.moveT>=0.54 && P.moveT<=0.80){ P.vy*=0.30; }
    // 旋转砸 aSpin：推进绕X轴旋转角
    if(mv.spin){ P.spin=Math.min(1,P.spin+dt/mv.total); if(!onGround)P.vy=Math.max(P.vy,-2); }
    // 大风车 gSpin：推进绕Y轴旋转角(整圈)
    if(mv.spinY){
      const s0=mv.spinStart||0, s1=mv.spinEnd||mv.total;
      if(P.moveT>=s0 && P.moveT<=s1){ P.spin=Math.min(1,(P.moveT-s0)/(s1-s0)); }
      else if(P.moveT>s1){ P.spin=1; }
      if(P.moveT>=s0 && !P._spinSnd){ P._spinSnd=true; SFX.spinPlay(s1-s0); }
    }
  } else if(P.state==='taunt'){
  } else {
    let sp=MOVE_SPEED;
    if(P.charging){
      // 蓄力时半蹲移动：越蓄越慢，蓄满降到20%
      const cr=Math.min(1,P.chargeT/HEAVY_CHARGE_TIME);
      sp *= (1-(1-HEAVY_CHARGE_MINSPD)*cr);
    }
    vX=inX*sp;vZ=inZ*sp;
    if(inLen>0.01){P.facing=Math.atan2(inX,inZ);P.moving=true;}
  }
  P.x+=vX*dt;P.z+=vZ*dt;P.speed=Math.hypot(vX,vZ);
  // 边界 + 碰撞
  const B=ROOM-1;P.x=Math.max(-B,Math.min(B,P.x));P.z=Math.max(-B,Math.min(B,P.z));
  resolveCollision(P, PLAYER_R);

  if(P.moving)P.runPhase+=dt*Math.min(P.speed,MOVE_SPEED)*1.9;else P.runPhase*=0.85;
  if(P.stamina<P.staminaMax)P.stamina=Math.min(P.staminaMax,P.stamina+STAM_REGEN*dt);
  yaw.rotation.y+=angleDelta(yaw.rotation.y,P.facing)*Math.min(1,TURN_LERP*dt);
  if(shake>0)shake=Math.max(0,shake-dt*0.6);
  updateFx(dt); poseCharacter(dt);
  swordTrail.updateTrail(dt); swordBeam.updateBeams(dt, hitResolution.beamHitByBeam); spinRings.updateSpinRings(dt); spaceSlash.update(dt); stompEffects.updateStomps(dt);
}

// ============================================================
//  自动地图：同一份场景登记数据生成小地图和展开地图
// ============================================================
const mapHud = createMapHud({
  THREE,
  roomSize: ROOM,
  mapFeatures,
  getPlayer: () => P,
  heavyChargeTime: HEAVY_CHARGE_TIME,
  clearGameplayInputState,
  documentRef: document,
  windowRef: window
});
const waterReflectionPass = createWaterReflectionPass({
  renderer,
  scene,
  camera,
  reflRT,
  sceneRT,
  reflCam,
  reflClip: _reflClip,
  reflMatrix: _reflM,
  waterReflectionMeshes,
  getWaterSurfaceMaterial
});
installTestProbe({
  camera,
  cameraRig,
  getPlayer: () => P,
  renderer,
  waterReflectionMeshes,
  reflRT,
  sceneRT
});
function updateFx(dt){
  attackBursts.update(dt);
  // 闪避残影淡出
  ghostAfterimages.update(dt);
  targetFeedback.update(dt);
}
// ============================================================
//  姿态
// ============================================================
function lerpRot(j,axis,target,k){ j.rotation[axis]=THREE.MathUtils.lerp(j.rotation[axis],target,k); }
function poseCharacter(dt){
  char.position.set(P.x,P.y,P.z);
  poseClipController.resetJoints();
  body.rotation.set(0,0,0); body.position.set(0,0,0);
  poseClipController.resetDrivenState();   // 每帧重置动作驱动的身体下沉/前倾/握剑
  let bob=0, lean=0;
  const ph=P.runPhase;

  // —— 基础层：跑步 / 待机（肘朝前弯=负，膝朝后弯=正；左右对侧协调）——
  if(P.moving && !P.clip && P.state!=='dodge' && !P.jumping){
    const sw=Math.sin(ph);
    RLeg.root.rotation.x=sw*0.62;  LLeg.root.rotation.x=-sw*0.62;   // 步幅减小
    RLeg.j2.rotation.x=Math.max(0,sw)*0.75+0.1;   // 抬腿时屈膝
    LLeg.j2.rotation.x=Math.max(0,-sw)*0.75+0.1;
    LArm.root.rotation.x=sw*0.55; RArm.root.rotation.x=-sw*0.55;  // 对侧摆臂(右腿前→左臂前)
    LArm.j2.rotation.x=-(0.45+Math.max(0, sw)*0.4); // 肘朝前弯
    RArm.j2.rotation.x=-(0.45+Math.max(0,-sw)*0.4);
    bob=Math.abs(Math.sin(ph))*0.10; lean=0.13;
  } else if(!P.clip && P.state==='idle' && !P.jumping){
    const br=Math.sin(performance.now()/600)*0.04;
    RLeg.j2.rotation.x=0.06; LLeg.j2.rotation.x=0.06;
    LArm.root.rotation.x=0.04; RArm.root.rotation.x=0.04;
    LArm.j2.rotation.x=-0.2; RArm.j2.rotation.x=-0.2;  // 肘自然朝前微弯
    bob=br;
  }

  // —— 跳跃（角色物理右腿高抬腿前伸，左腿向后蹬伸；对侧手臂协调）——
  if(P.jumping){
    const up=P.vy;
    // 右腿:髋前抬 + 屈膝(高抬腿)；左腿:髋后伸 + 膝微屈(蹬腿)
    let rHip,rKnee,lHip,lKnee, armF;
    if(up>2){ rHip=-1.2; rKnee=1.3; lHip=0.55; lKnee=0.25; armF=-1.0; lean=0.14; }       // 上升:最高抬腿
    else if(up<-2){ rHip=-0.7; rKnee=0.7; lHip=0.35; lKnee=0.5; armF=-0.4; lean=-0.02; }  // 下落:腿收回准备落地
    else { rHip=-1.0; rKnee=1.1; lHip=0.5; lKnee=0.3; armF=-0.8; lean=0.08; }             // 顶点
    lerpRot(RLeg.root,'x',rHip,0.5); lerpRot(RLeg.j2,'x',rKnee,0.5);   // 物理右腿高抬前伸
    lerpRot(LLeg.root,'x',lHip,0.5); lerpRot(LLeg.j2,'x',lKnee,0.5);   // 物理左腿后蹬
    if(!P.clip){
      // 对侧协调：右腿前伸 → 左臂前摆、右臂后摆（避免一顺边）
      lerpRot(LArm.root,'x',armF,0.5);       lerpRot(LArm.j2,'x',-0.5,0.5);
      lerpRot(RArm.root,'x',-armF*0.7,0.5);  lerpRot(RArm.j2,'x',-0.4,0.5);
    }
  }

  // —— 重击蓄力姿态：半蹲 + 收紧蓄势(同大风车蓄力上半身) ——
  if(P.charging){
    const cr=Math.min(1,P.chargeT/HEAVY_CHARGE_TIME);
    // 半蹲：下沉 + 屈膝(越蓄越低一点点)
    bob=-0.18-0.08*cr;
    RLeg.j2.rotation.x=0.5; LLeg.j2.rotation.x=0.5;
    RLeg.root.rotation.x=-0.25; LLeg.root.rotation.x=-0.25;
    // 上半身收紧蓄势：右手抬胸前肘内拐 / 左手后撤肘收紧 / 身体左转前倾
    RArm.root.rotation.x=-1.0; RArm.root.rotation.z=0.35; RArm.j2.rotation.x=-1.75;
    LArm.root.rotation.x=-1.4; LArm.root.rotation.z=0.2; LArm.j2.rotation.x=-2.35;
    chest.rotation.y=0.5; lean=0.3;
    // 半蹲走动：脚步随移动微摆，越蓄越慢
    if(P.moving){
      const sw=Math.sin(P.runPhase);
      RLeg.root.rotation.x=-0.25+sw*0.3; LLeg.root.rotation.x=-0.25-sw*0.3;
      bob += Math.abs(Math.sin(P.runPhase))*0.05;
    }
    // 蓄满：全身闪烁光环
    if(P.chargeFull){
      chargeAura.visible=true;
      chargeAuraMat.opacity=0.25+0.35*Math.abs(Math.sin(performance.now()/60));
    } else { chargeAura.visible=false; }
  } else { chargeAura.visible=false; }

  // —— 动作层：关键帧覆盖 ——
  if(P.clip){
    // 切招时从快照平滑过渡到新动作，消除"弹一下"的卡顿
    const blend = (P.move && P.blendDur>0) ? (P.blendT/P.blendDur) : 1;
    poseClipController.applyClip(P.clip, P.clipT, blend);
  }

  // —— 空中旋转砸 aSpin：整体绕X轴翻转 ——
  let spinning=false;
  if(P.move==='aSpin'){
    body.rotation.x = P.spin*Math.PI*2;   // 翻一圈砸下
    lean=0; spinning=true;
  }
  if(P.move!=='aJupiter' && jupiterActive){ jupiterActive=false; jupiterBall.visible=false; char.traverse(o=>{ if(o.isMesh) o.visible=true; }); body.rotation.x=0; }
  // —— aJupiter：起手后仰→人球X轴高速旋转→蜘蛛侠落地 ——
  if(P.move==='aJupiter' && !P._plungeDone){
    if(!jupiterActive){ jupiterActive=true; _jSpin=0; }
    if(P.moveT>=0.22){
      _jSpin+=dt*46;
      body.rotation.x=_jSpin;
      // 动平衡：让旋转轴穿过重心(y=1.4)，消除脚底打圈感
      const _c=1.8;
      char.position.y+=_c*(1-Math.cos(_jSpin));
      char.position.x-=_c*Math.sin(_jSpin)*Math.sin(P.facing);
      char.position.z-=_c*Math.sin(_jSpin)*Math.cos(P.facing);
      lean=0; spinning=true;
    }
  }
  if(P.move==='aJupiter' && P._plungeDone){ body.rotation.x=0; }
  // 人球阶段剑立于头顶
  if(P.move==='aJupiter' && !P._plungeDone && P.moveT>=0.22){
    if(!P._jupSword){ P._jupSword=true; body.attach(weapon); }
    weapon.position.set(0,4.2,0); weapon.rotation.set(0,0,0);
  } else if(P._jupSword){ P._jupSword=false; weaponSocket.attach(weapon); weapon.position.set(0,0,0); weapon.rotation.set(0,0,0); }
  if(P.move==='aDrill'){
    _drillSpin+=dt*90; body.rotation.y=_drillSpin; spinning=true;
  }
  // —— 大风车 gSpin / gSpinSlide / gSpinCharged：整体绕Y轴横扫(可多圈) ——
  if(P.move==='gSpin' || P.move==='gSpinSlide' || P.move==='gSpinCharged'){
    const turns = MOVES[P.move].spinTurns || 1;
    body.rotation.y = -P.spin*Math.PI*2*turns;   // 顺时针转 turns 圈
    spinning=true;                               // 头随身转(不做反向补偿)
  }
  // —— 侧身腾空飞踹 dKick：①整体朝左转90°(面朝屏左) ②上身往角色左侧倒(视觉=后倒) ③右腿水平前踹 ——
  if(P.move==='dKick'){
    const t=P.moveT;
    // 转身90°：起手快速转过去，全程保持(放 body.rotation.y, 每帧重置不累积)
    const yawT = Math.min(1, t/0.14);
    body.rotation.y = -yawT*(Math.PI/2);   // 朝角色左转90°(面朝屏幕左) —— 转反了改正号
    // 侧倒幅度：0→0.16 倒下, 0.16~0.42 保持(踹+滞空), 之后回正
    let tilt;
    if(t<0.16) tilt=t/0.16;
    else if(t<0.42) tilt=1;
    else tilt=Math.max(0,1-(t-0.42)/0.14);
    body.rotation.z = tilt*1.25;        // 往角色后侧倒~72°(视觉=向后倒) —— 倒反了改符号(支撑腿那行一起翻)
    RLeg.root.rotation.z = -tilt*1.25;   // 支撑右腿抵消侧倒, 大致保持竖直
    // 侧倒使支撑腿根(x=-0.3)被甩低→脚穿地。按精确几何抬高body把脚补回地面(非线性, 直接算)
    {
      const cz=Math.cos(tilt*1.25), sz=Math.sin(tilt*1.25);
      const rootY = -0.3*sz + 1.5*cz;     // body绕Z倒后 支撑腿根世界y (Ry不影响y)
      bob += (1.46 - rootY);              // 1.46=竖直时脚底到根距离; 让脚底回到y=0
    }
    spinning=true;                      // 侧倒+转身时头跟着，不做反向补偿
  }

  // —— 升龙剑 dRise：起跳后整体绕X轴前空翻一圈(空中转一圈到顶点) ——
  // —— 升龙剑 dRise：起跳后整体绕X轴前空翻一圈(空中转一圈到顶点) ——
  if(P.move==='dRise' && P._launched && !P._plungeDone){
    // 0.24起跳 → 0.56到顶，这段时间内绕竖直轴(头顶→脚)旋身一圈，之后保持(落地后不再旋转)
    const k=Math.max(0,Math.min(1,(P.moveT-0.24)/0.32));
    const COIL=-0.7;
    body.rotation.y = -COIL - k*(Math.PI*2 - COIL);
    spinning=true;
  }
  if(P.move==='dRise' && !P._launched){
    body.rotation.y = 0.7*Math.min(1,P.moveT/0.24);
  }

  // —— 闪避：快速前冲弓步（物理右腿大跨、左腿蹬直、身体前压）——
  if(P.state==='dodge'){
    const k=P.roll;                       // 0→1 整个冲刺过程
    const ease=Math.sin(Math.min(1,k)*Math.PI); // 中段最舒展
    LLeg.root.rotation.x=0.9*ease+0.2; LLeg.j2.rotation.x=0.9*ease+0.1;
    RLeg.root.rotation.x=-0.7*ease;    RLeg.j2.rotation.x=0.25*ease;
    LArm.root.rotation.x=-0.6*ease; LArm.j2.rotation.x=-0.5;
    RArm.root.rotation.x=0.5*ease;  RArm.j2.rotation.x=-0.5;
    lean=0.35*ease;                        // 身体前压
    bob=-0.12*ease;                        // 压低重心
    chest.rotation.x=0.15*ease;
  }

  const drivenPose=poseClipController.getDrivenState();
  // 动作驱动的身体下沉/前倾优先(弓步发力链)，否则用默认 bob/lean
  body.position.y += (drivenPose.bodyY!==null)? drivenPose.bodyY : bob;
  if(!spinning){
    const targetLean = (drivenPose.bodyLean!==null)? drivenPose.bodyLean : lean;
    body.rotation.x=THREE.MathUtils.lerp(body.rotation.x,targetLean,0.5);
  }
  if(drivenPose.bodyYaw!==null) body.rotation.y=THREE.MathUtils.lerp(body.rotation.y,drivenPose.bodyYaw,0.5);
  if(drivenPose.bodySide!==null) body.rotation.z=THREE.MathUtils.lerp(body.rotation.z,drivenPose.bodySide,0.5);

  // 握剑姿态：gripMode 0=斜握默认 / 1=突刺枪式(剑沿小臂延长线)
  const gm = (drivenPose.gripMode!==null)?drivenPose.gripMode:0;
  weaponSocket.rotation.x = GRIP_DEFAULT + (GRIP_SPEAR-GRIP_DEFAULT)*gm;

  // —— 头部反向补偿：躯干猛转时头仍大致注视正前方，只微微跟随 ——
  // headGrp 继承 chest 的Y旋转；反向抵消70%，净跟随约30%
  if(!spinning){
    const followRatio=0.3;                 // 头净跟随躯干转动的比例
    headGrp.rotation.y += -chest.rotation.y*(1-followRatio);
    // 同理对躯干前后倾(chestX)做轻度补偿，让头不过度低/抬
    headGrp.rotation.x += -chest.rotation.x*0.4;
  }
  // 旋风坠：剑脱离右手→在char根节点绕Y轴轨道，土星环效果；落地还手
  if(P.move==='aDrill'){
    if(!P._drillSword){ P._drillSword=true; char.attach(weapon); }
    P._drillAng=(P._drillAng||0)+dt*30;
    weapon.position.set(0.9*Math.cos(P._drillAng),0.95,0.9*Math.sin(P._drillAng));
    weapon.rotation.set(0,P._drillAng+Math.PI*0.5,Math.PI*0.5);
  } else if(P._drillSword){
    P._drillSword=false; P._drillAng=0;
    weaponSocket.attach(weapon);
    weapon.position.set(0,0,0); weapon.rotation.set(0,0,0);
  }
  weapon.visible=true;   // 木棍一直握在手里
}

// HUD/渲染
function resize(){const w=innerWidth,h=innerHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}
addEventListener("resize",resize);resize();padStatus();
document.getElementById("loading").style.display="none";
const gameLoop = createGameLoop({
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
gameLoop.start();
}
