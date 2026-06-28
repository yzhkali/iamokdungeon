import { loadThreeRuntime } from "./core/threeLoader.js";
import { createSfx } from "./core/sfx.js";
import { createModelLoader } from "./core/modelLoader.js";
import { buildGrass, updateGrass } from "./world/grass.js";
import { buildSky, updateSky } from "./world/sky.js";
import { makeWolf } from "./wolf.js";
import { createWolfAiController } from "./enemies/wolfAi.js";
import { createCameraController } from "./camera.js";
import { CLIPS } from "./player/clips.js";
import { MOVES } from "./player/moves.js";
import { createPlayerState, clonePlayerTuning } from "./player/state.js";
import { createGhostAfterimages } from "./player/ghostAfterimages.js";
import { createPoseClipController } from "./player/poseClipController.js";
import { createInputController } from "./ui/input.js";
import { createMapHud } from "./ui/mapHud.js";
import { createWaterReflectionPass } from "./rendering/waterReflection.js";
import { createGameLoop } from "./loop.js";
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
const _mapH=new Float32Array(_m15.terrain);const _SZ=260,_SEG=130;
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

// ── 地形系统 ──────────────────────────────────────────────────
function terrainH(x,z){const ix=Math.max(0,Math.min(_SEG,Math.round((x+_SZ/2)/_SZ*_SEG)));const iz=Math.max(0,Math.min(_SEG,Math.round((z+_SZ/2)/_SZ*_SEG)));return _mapH[iz*(_SEG+1)+ix]??0;}
let fallCurtainMat=null,waterMats=[],waterReflectionMeshes=[],mistPS=null,tWater,tFoam,tWfall,tMistTex,tNorm,tCaust;
{
  const SZ=260, SEG=130;
  const tg=new THREE.PlaneGeometry(SZ,SZ,SEG,SEG);
  tg.rotateX(-Math.PI/2);
  const pos=tg.attributes.position;
  const cols=[];
  // 顶点颜色提亮，作为贴图的色调调制层（草地区域趋近白色让贴图本色显现）
  const cDark=new THREE.Color(0x446070),cLow=new THREE.Color(0xf0efe8),cHigh=new THREE.Color(0xeae8e0),cRock=new THREE.Color(0xe8e8e6),cSnow=new THREE.Color(0xf0eef4);
  for(let i=0;i<pos.count;i++){
    const hv=terrainH(pos.getX(i),pos.getZ(i));
    pos.setY(i,hv);
    let c;
    if(hv<-1) c=cDark.clone().lerp(cLow,Math.min(1,(hv+6)/5));
    else if(hv<5) c=cLow.clone().lerp(cHigh,Math.min(1,(hv+1)/6));
    else if(hv<10) c=cHigh.clone().lerp(cRock,(hv-5)/5);
    else c=cRock.clone().lerp(cSnow,Math.min(1,(hv-10)/10));
    cols.push(c.r,c.g,c.b);
  }
  tg.setAttribute('color',new THREE.BufferAttribute(new Float32Array(cols),3));
  tg.computeVertexNormals();
  const _tl=new THREE.TextureLoader();
  const grassTex=_tl.load('./textures/texture_grass.png'),rockTex=_tl.load('./textures/texture_rock.png'),mountTex=_tl.load('./textures/texture_mountain.png'),mudTex=_tl.load('./textures/mud-riverbank-tile-512.png');
  [grassTex,rockTex,mountTex,mudTex].forEach(t=>{t.wrapS=t.wrapT=THREE.RepeatWrapping;});
  const _roadGenTex=new THREE.TextureLoader().load('./textures/texture_road.png');
  _roadGenTex.wrapS=_roadGenTex.wrapT=THREE.RepeatWrapping;
  const tm=new THREE.MeshLambertMaterial({vertexColors:true});
  tm.onBeforeCompile=s=>{
    s.uniforms.tGrass={value:grassTex};s.uniforms.tRock={value:rockTex};s.uniforms.tMount={value:mountTex};s.uniforms.tMud={value:mudTex};s.uniforms.tRoadStone={value:_roadStoneTex};s.uniforms.tRoadMask={value:_roadMaskTex};s.uniforms.tGenerated={value:_roadGenTex};const _rc=new THREE.Color(_m15.roadColor||"#7d7260");s.uniforms.uRoadColor={value:_rc};
    s.vertexShader=s.vertexShader
      .replace('void main() {','varying vec2 vMyUv;\nvarying float vWY;\nvarying float vNY;\nvoid main() {')
      .replace('\t#include <project_vertex>','\t#include <project_vertex>\nvWY=position.y;\nvMyUv=uv;\nvNY=normal.y;');
    s.fragmentShader=s.fragmentShader
      .replace('void main() {','uniform sampler2D tGrass,tRock,tMount,tMud,tRoadStone,tRoadMask,tGenerated;uniform vec3 uRoadColor;\nvarying vec2 vMyUv;\nvarying float vWY;\nvarying float vNY;\nfloat H(vec2 q){return fract(sin(dot(q,vec2(127.1,311.7)))*43758.5);}\nvoid main() {')
      .replace('\t#include <color_fragment>','#ifdef USE_COLOR\n  diffuseColor.rgb*=vColor.rgb;\n#endif\n{vec2 u=vMyUv*24.0;vec3 g=texture2D(tGrass,u).rgb,r=texture2D(tRock,u).rgb,m=texture2D(tMount,u).rgb*1.7,md=texture2D(tMud,u).rgb;float sr=smoothstep(.25,.55,1.-vNY),hr=smoothstep(3.,12.,vWY+g.r*4.-2.),rb=max(sr,hr),mb=smoothstep(18.,24.,vWY);float noise=g.r*3.-1.5;vec3 base=mix(mix(g,r,rb),m,mb);float mudb=1.-smoothstep(-3.,1.5,vWY+noise);vec3 terrain=mix(base,md,mudb);vec2 rmSample=texture2D(tRoadMask,vMyUv).rg;float rm=rmSample.r;float junc=rmSample.g;float hFade=1.-smoothstep(0.,8.,vWY);float rnoise=g.r*0.32+g.b*0.14+hFade*0.12;float rmn=rm-rnoise*0.28;float eNoise=(texture2D(tGrass,vMyUv*80.).r*2.-1.)*.22;float roadEdge=smoothstep(.35,.62,rmn+eNoise);float stoneW=smoothstep(.60,.85,rmn)*(1.-hFade*.65);vec3 rs=texture2D(tRoadStone,vMyUv*48.).rgb;vec3 roadMud=mix(terrain,mix(md,uRoadColor,0.55),0.65+hFade*0.25);float crackW=smoothstep(.55,.35,rs.r)*0.4;vec3 stoneWithGrass=mix(rs,g*0.8,crackW);vec3 gen=texture2D(tGenerated,vMyUv*56.).rgb;float waterMud=1.-smoothstep(-3.,0.5,vWY);float stoneWAdj=stoneW*(1.-waterMud*.95);vec3 waterRoadMud=mix(terrain,mix(md,gen,waterMud*.9),0.65+hFade*0.25);vec3 road=mix(waterRoadMud,stoneWithGrass,stoneWAdj);float jBlend=clamp(junc+eNoise*.4,0.,1.)*roadEdge;vec3 roadFinal=mix(road,gen,jBlend*.85);diffuseColor.rgb*=mix(terrain,roadFinal,roadEdge);float _luma=dot(diffuseColor.rgb,vec3(.3,.59,.11));diffuseColor.rgb=mix(vec3(_luma),diffuseColor.rgb,1.0+mudb*0.35);}')
  };
  tm.polygonOffset=true; tm.polygonOffsetFactor=1; tm.polygonOffsetUnits=1;
  const mesh=new THREE.Mesh(tg,tm); mesh.receiveShadow=true; scene.add(mesh);
  // road mask
  const _rmCanvas=document.createElement('canvas'); _rmCanvas.width=_rmCanvas.height=131;
  const _rmCtx=_rmCanvas.getContext('2d'); _rmCtx.fillStyle='black'; _rmCtx.fillRect(0,0,131,131);
  const _roadMaskTex=new THREE.CanvasTexture(_rmCanvas);
  _roadMaskTex.wrapS=_roadMaskTex.wrapT=THREE.ClampToEdgeWrapping;
  _roadMaskTex.minFilter=_roadMaskTex.magFilter=THREE.LinearFilter;
  const _roadStoneTex=new THREE.TextureLoader().load('./textures/texture_road.png');
  _roadStoneTex.wrapS=_roadStoneTex.wrapT=THREE.RepeatWrapping;
  function _buildRoadMask(){
    if(!_m15.roads||!_m15.roads.length) return;
    const SEG=130,SZ=260,vCount=(SEG+1)*(SEG+1);
    const mask=new Float32Array(vCount),junc=new Float32Array(vCount),cnt=new Float32Array(vCount);
    _m15.roads.forEach((pts,ri)=>{
      const hw=(_m15.roadWidths[ri]||8)/2,fw=hw+6;
      for(let iz=0;iz<=SEG;iz++){for(let ix=0;ix<=SEG;ix++){
        const vx=(ix/SEG-0.5)*SZ, vz=(iz/SEG-0.5)*SZ;
        let md=1e9;
        for(let j=0;j<pts.length-1;j++){
          const ax=pts[j][0],az=pts[j][1],bx=pts[j+1][0],bz=pts[j+1][1];
          const dx=bx-ax,dz=bz-az,l2=dx*dx+dz*dz;
          if(l2<1e-6)continue;
          const t=Math.max(0,Math.min(1,((vx-ax)*dx+(vz-az)*dz)/l2));
          md=Math.min(md,Math.hypot(vx-(ax+t*dx),vz-(az+t*dz)));
        }
        const i=iz*(SEG+1)+ix;
        if(md<fw){mask[i]=Math.max(mask[i],Math.max(0,1-md/fw));if(md<hw+5)cnt[i]++;}
      }}
    });
    for(let i=0;i<vCount;i++) junc[i]=Math.min(1,(cnt[i]-1)*0.7);
    const d=_rmCtx.createImageData(131,131);
    for(let i=0;i<vCount;i++){d.data[i*4]=mask[i]*255|0;d.data[i*4+1]=junc[i]*255|0;d.data[i*4+3]=255;}
    _rmCtx.putImageData(d,0,0); _roadMaskTex.needsUpdate=true;
  }
  _buildRoadMask();
  // ── 水体系统 (texture-based) ──────────────────────────────
  const FALL_Y=1.0;
  const _wtl2=new THREE.TextureLoader();
  tWater=_wtl2.load('./textures/texture_water.png');
  tFoam=_wtl2.load('./textures/texture_water_foam.png');
  tWfall=_wtl2.load('./textures/texture_waterfall.png');
  tMistTex=_wtl2.load('./textures/texture_waterfall_mist_splash.png');
  tNorm=_wtl2.load('./textures/texture_water_normal.png');
  tCaust=_wtl2.load('./textures/texture_caustics.png');
  [tWater,tFoam,tWfall,tNorm,tCaust].forEach(t=>{t.wrapS=t.wrapT=THREE.RepeatWrapping;});
  // full water shader from editor3d
  const _wTL=new THREE.TextureLoader();
  const _tNA=_wTL.load('./textures/water_normal_a.png');
  const _tNB=_wTL.load('./textures/water_normal_b.png');
  const _tUV=_wTL.load('./textures/water_uv.png');
  const _tFoam=_wTL.load('./textures/water_foam_godot.png');
  const _tCaust2=_wTL.load('./textures/texture_caustics.png');
  const _tFoam2b=_wTL.load('./textures/water_foam_godot.png');
  [_tNA,_tNB,_tUV,_tFoam,_tCaust2,_tFoam2b].forEach(t=>{t.wrapS=t.wrapT=THREE.RepeatWrapping;});
  // heightmap texture for water depth
  const _wHmapTex=new THREE.DataTexture(null,131,131,THREE.RedFormat,THREE.FloatType);
  _wHmapTex.wrapS=_wHmapTex.wrapT=THREE.ClampToEdgeWrapping;
  _wHmapTex.minFilter=_wHmapTex.magFilter=THREE.LinearFilter;_wHmapTex.flipY=false;
  {const hd=new Float32Array(_mapH);_wHmapTex.image={data:hd,width:131,height:131};_wHmapTex.needsUpdate=true;}
  var wSurfMat=new THREE.ShaderMaterial({
    uniforms:{uT:{value:0},uWaves:{value:1},uWaterY:{value:-2},tNA:{value:_tNA},tNB:{value:_tNB},tUV:{value:_tUV},tF:{value:_tFoam},tCaust:{value:_tCaust2},tFoam2:{value:_tFoam2b},tScene:{value:null},tReflect:{value:null},uRes:{value:new THREE.Vector2()},tHmap:{value:_wHmapTex},uDeep:{value:new THREE.Color(0x5a8f9a)},uShallow:{value:new THREE.Color(0x92b4b8)},uSun:{value:new THREE.Vector3(.5,1.,.3).normalize()}},
    vertexShader:'uniform float uT;uniform float uWaves;varying vec2 vWsUv;varying vec3 vN,vV;vec3 gw(vec3 p,float s,float l,float sp,float d){vec2 dv=normalize(vec2(cos(3.14159*(d*2.-1.)),sin(3.14159*(d*2.-1.))));float k=6.28318/l,f=k*(dv.x*p.x+dv.y*p.z-sp*uT),a=s/k;return vec3(dv.x*(a*cos(f)),a*sin(f),dv.y*(a*cos(f)));}void main(){vec4 wp=modelMatrix*vec4(position,1.);vec3 wpos=wp.xyz;if(uWaves>0.){wpos+=gw(wpos,.035,22.,.7,.3)*uWaves;wpos+=gw(wpos,.028,15.,1.,2.67)*uWaves;wpos+=gw(wpos,.022,30.,.45,3.9)*uWaves;wpos+=gw(wpos,.015,12.,1.3,2.7)*uWaves;}vWsUv=wpos.xz*.08;vN=normalize(normalMatrix*normal);vec4 mv=viewMatrix*vec4(wpos,1.);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',
    fragmentShader:'uniform float uT;uniform float uWaterY;uniform sampler2D tNA,tNB,tUV,tF,tCaust,tHmap,tFoam2,tScene,tReflect;uniform vec2 uRes;uniform vec3 uDeep,uShallow,uSun;varying vec2 vWsUv;varying vec3 vN,vV;void main(){vec2 uvOff=vec2(.05,.04)*uT;vec2 uvShift=.04*(texture2D(tUV,vWsUv*.25+uvOff).rg*2.-1.);vec2 uv=vWsUv+uvShift;vec3 N=normalize((texture2D(tNA,uv-uvOff*2.).rgb*.75+texture2D(tNB,uv+uvOff).rgb*.25)*2.-1.);vec3 nP=normalize(vN+vec3(N.x,0.,N.y)*.35);float fr=clamp(pow(1.-max(0.,dot(nP,normalize(vV))),1.5)+.04*sin(vWsUv.y*7.+uT*1.4),0.,1.);vec2 hmUV=clamp((vWsUv/0.08+130.)/260.,vec2(.001),vec2(.999));float terrainY=texture2D(tHmap,hmUV).r;float wDepth=max(0.,uWaterY-terrainY);float dB=clamp(1.-exp((wDepth-.3)*-1.2),0.,1.);vec3 dyeCol=mix(uShallow,uDeep,dB);vec3 col=dyeCol;float hue=fr*2.8+uT*.08;col=mix(col,vec3(sin(hue)*.5+.5,sin(hue+2.09)*.5+.5,sin(hue+4.18)*.5+.5),.1*fr);vec3 H=normalize(normalize(uSun)+normalize(vV));float sp=pow(max(0.,dot(nP,H)),120.);col+=vec3(1.,.98,.9)*smoothstep(.38,.42,sp)*.7;float sp2=pow(max(0.,dot(nP,H)),600.);col+=vec3(1.,1.,.95)*sp2*1.2;float bl=abs(fract(uT*.045)*2.-1.);vec2 cWob=N.xy*.12;col+=vec3(.5,.85,1.)*mix(texture2D(tCaust,vWsUv*1.8+vec2(.025,.018)*uT+cWob).a,texture2D(tCaust,vWsUv*1.8-vec2(.018,.025)*(uT+.5)-cWob).a,bl)*.18;float foamMask=1.-clamp(wDepth/.3,0.,1.);vec2 fuv1=vWsUv*2.2+vec2(.06,.18)*uT+N.xy*.1,fuv2=vWsUv*1.7+vec2(-.09,.05)*uT-N.xy*.08;float ft=(texture2D(tFoam2,fuv1).r+texture2D(tFoam2,fuv2).r)*.5;float foam=smoothstep(.65,.9,ft)*foamMask;col=mix(col,dyeCol*1.1,foamMask*.35);col=mix(col,vec3(.96,.98,1.),foam*.7);vec2 reflUV=vec2(gl_FragCoord.x/uRes.x,gl_FragCoord.y/uRes.y)+N.xy*.04;reflUV=clamp(reflUV,vec2(.001),vec2(.999));vec3 reflCol=texture2D(tReflect,reflUV).rgb;float rBrt=dot(reflCol,vec3(.3,.59,.11));float rOk=smoothstep(.04,.2,rBrt);col=mix(col,reflCol*1.5+vec3(.02,.04,.06),fr*.45*rOk);gl_FragColor=vec4(col,mix(.22,.97,fr*.8+dB*.2));}',
    transparent:true,side:THREE.FrontSide,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2
  });
  function makeWaterMat(fx,fz,alpha){ waterMats.push(wSurfMat); return wSurfMat; }
  // hook reflection render targets
  wSurfMat.uniforms.tScene={value:sceneRT.texture};
  wSurfMat.uniforms.tReflect={value:reflRT.texture};
  wSurfMat.uniforms.uRes={value:new THREE.Vector2(innerWidth,innerHeight)};
  var _wMain=new THREE.Mesh(new THREE.PlaneGeometry(260,260,60,60),wSurfMat);
  _wMain.rotation.x=-Math.PI/2;_wMain.position.y=-2;scene.add(_wMain);waterReflectionMeshes.push(_wMain);
  // waterfall + river from map15
  const _tWfall3=new THREE.TextureLoader().load('./textures/texture_waterfall.png');
  _tWfall3.wrapS=_tWfall3.wrapT=THREE.RepeatWrapping;
  var _wfM1=new THREE.ShaderMaterial({uniforms:{uT:{value:0},tWf:{value:_tWfall3}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform float uT;uniform sampler2D tWf;varying vec2 vUv;void main(){vec2 u=vec2(vUv.x,fract(vUv.y+uT*.65));vec4 c=texture2D(tWf,u);float e=smoothstep(0.,.1,vUv.x)*smoothstep(1.,.9,vUv.x);gl_FragColor=vec4(c.rgb,c.a*e*.9);}',transparent:true,side:THREE.DoubleSide,depthWrite:false});
  var _wfM2=new THREE.ShaderMaterial({uniforms:{uT:{value:0},tWf:{value:_tWfall3}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform float uT;uniform sampler2D tWf;varying vec2 vUv;void main(){vec2 u=vec2(vUv.x,fract(vUv.y+(uT+.45)*.65));vec4 c=texture2D(tWf,u);float e=smoothstep(0.,.15,vUv.x)*smoothstep(1.,.85,vUv.x);gl_FragColor=vec4(c.rgb,c.a*e*.7);}',transparent:true,side:THREE.DoubleSide,depthWrite:false});
  var _wfM3=new THREE.ShaderMaterial({uniforms:{uT:{value:0},tWf:{value:_tWfall3}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform float uT;uniform sampler2D tWf;varying vec2 vUv;void main(){vec2 u=vec2(1.-vUv.x,fract(vUv.y+uT*.55));vec4 c=texture2D(tWf,u);float e=smoothstep(0.,.12,vUv.x)*smoothstep(1.,.88,vUv.x);gl_FragColor=vec4(c.rgb,c.a*e*.6);}',transparent:true,side:THREE.DoubleSide,depthWrite:false});
  var _wfM4=new THREE.ShaderMaterial({uniforms:{uT:{value:0},tWf:{value:_tWfall3}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform float uT;uniform sampler2D tWf;varying vec2 vUv;void main(){vec2 u=vec2(vUv.x+0.4,fract(vUv.y+(uT+.2)*.72));vec4 c=texture2D(tWf,u);float e=smoothstep(0.,.1,vUv.x)*smoothstep(1.,.9,vUv.x);gl_FragColor=vec4(c.rgb,c.a*e*.65);}',transparent:true,side:THREE.DoubleSide,depthWrite:false});
  var _wfM5=new THREE.ShaderMaterial({uniforms:{uT:{value:0},tWf:{value:_tWfall3}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform float uT;uniform sampler2D tWf;varying vec2 vUv;void main(){vec2 u=vec2(1.-vUv.x+0.3,fract(vUv.y+(uT+.1)*.5));vec4 c=texture2D(tWf,u);float e=smoothstep(0.,.12,vUv.x)*smoothstep(1.,.88,vUv.x);gl_FragColor=vec4(c.rgb,c.a*e*.6);}',transparent:true,side:THREE.DoubleSide,depthWrite:false});
  var _allWfMats=[_wfM1,_wfM2,_wfM3,_wfM4,_wfM5];
  function makeWaterPath(pts,w){
    const wy=-2.0,abv=pts.filter(p=>p.y>=wy-0.5);
    if(abv.length<2)return null;
    const arc=[0];for(let i=1;i<abv.length;i++){const p=abv[i],q=abv[i-1];arc.push(arc[i-1]+Math.hypot(p.x-q.x,p.z-q.z));}
    const TILE=w*1.2,v=[],ix=[],uvs=[];
    for(let i=0;i<abv.length;i++){
      const p=abv[i];let tx=0,tz=1;
      if(i<abv.length-1){const nx=abv[i+1].x-p.x,nz=abv[i+1].z-p.z,nl=Math.hypot(nx,nz)||1;tx=nx/nl;tz=nz/nl;}
      else if(i>0){const nx=p.x-abv[i-1].x,nz=p.z-abv[i-1].z,nl=Math.hypot(nx,nz)||1;tx=nx/nl;tz=nz/nl;}
      const hw=(p.w||w)/2,u=arc[i]/TILE;
      v.push(p.x-tz*hw,p.y+0.04,p.z+tx*hw,p.x+tz*hw,p.y+0.04,p.z-tx*hw);uvs.push(u,0,u,1);
    }
    for(let i=0;i<abv.length-1;i++){const b=i*2;ix.push(b,b+2,b+1,b+1,b+2,b+3);}
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(v),3));
    g.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(uvs),2));
    g.setIndex(ix);g.computeVertexNormals();
    const m=new THREE.Mesh(g,wSurfMat);m.renderOrder=2;scene.add(m);waterReflectionMeshes.push(m);return m;
  }
  function makeWaterfallPath(pts,fh){
    const SEGS=12,zFwd=fh*0.55,v=[],ix=[],uvs=[];
    for(let j=0;j<=SEGS;j++){const t=j/SEGS,dy=-fh*t*t,dz=-zFwd*t;for(let i=0;i<pts.length;i++){const p=pts[i];v.push(p.x,p.y+dy,p.z+dz);uvs.push(i/(pts.length-1||1),1-t);}}
    for(let j=0;j<SEGS;j++)for(let i=0;i<pts.length-1;i++){const a=j*pts.length+i,b=a+1,c=a+pts.length,d2=c+1;ix.push(a,c,b,b,c,d2);}
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(v),3));
    g.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(uvs),2));
    g.setIndex(ix);g.computeVertexNormals();
    scene.add(new THREE.Mesh(g,_wfM1));
    const g2=g.clone();const p2=g2.attributes.position.array;for(let i=0;i<p2.length;i+=3)p2[i+2]+=0.28;g2.attributes.position.needsUpdate=true;scene.add(new THREE.Mesh(g2,_wfM2));
    const g3=g.clone();const p3=g3.attributes.position.array;for(let i=0;i<p3.length;i+=3)p3[i+2]-=0.22;g3.attributes.position.needsUpdate=true;scene.add(new THREE.Mesh(g3,_wfM3));
    const g4=g.clone();const p4=g4.attributes.position.array;for(let i=0;i<p4.length;i+=3)p4[i+2]+=0.52;g4.attributes.position.needsUpdate=true;scene.add(new THREE.Mesh(g4,_wfM4));
    const g5=g.clone();const p5=g5.attributes.position.array;for(let i=0;i<p5.length;i+=3){p5[i+1]-=0.3;p5[i+2]-=0.15;}g5.attributes.position.needsUpdate=true;scene.add(new THREE.Mesh(g5,_wfM5));
  }
  (_m15.waterSurfs||[]).forEach(ws=>{makeWaterPath(ws.pts,ws.w||5);});
  (_m15.wfSurfs||[]).forEach(wf=>{makeWaterfallPath(wf.pts,wf.fh||8);});
  //_wPool removed
  //_wRiver removed
  const FALL_DROP=FALL_Y+2.1;
  fallCurtainMat=new THREE.ShaderMaterial({
    uniforms:{uT:{value:0},tWf:{value:tWfall}},
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`uniform float uT;uniform sampler2D tWf;varying vec2 vUv;void main(){vec2 uv=vec2(vUv.x*1.5,fract(vUv.y-uT*.65));vec4 c=texture2D(tWf,uv);float e=smoothstep(0.,.1,vUv.x)*smoothstep(1.,.9,vUv.x);gl_FragColor=vec4(c.rgb,c.a*e*.9);}`,
    transparent:true,side:THREE.DoubleSide,depthWrite:false
  });
  //waterfall curtain removed
  //_caustMesh removed
  //mist+rainbow removed
}
function updateWater(t){
  if(typeof wSurfMat!=="undefined"&&wSurfMat.uniforms.uT)wSurfMat.uniforms.uT.value=t;
  for(const m of waterMats)if(m.uniforms?.uT)m.uniforms.uT.value=t;
  if(fallCurtainMat)fallCurtainMat.uniforms.uT.value=t;
  if(typeof _wfM1!=="undefined")[_wfM1,_wfM2,_wfM3,_wfM4,_wfM5].forEach(m=>m&&(m.uniforms.uT.value=t));
  if(tCaust)tCaust.offset.set((t*.025)%1,(t*.018)%1);
  if(mistPS){const p=mistPS.geometry.attributes.position.array,N=p.length/3;for(let i=0;i<N;i++){p[i*3+1]+=.004;if(p[i*3+1]>2.5){p[i*3]=44+(Math.random()-.5)*6;p[i*3+1]=-1.5;p[i*3+2]=104+Math.random()*6;}}mistPS.geometry.attributes.position.needsUpdate=true;}
}

const { placeModel } = createModelLoader({ THREE, GLTFLoader, scene });

// ============================================================
//  Village blockout v1: player village + training yard + monster pen
// ============================================================
const colliders=[]; // AABB: {minx,maxx,minz,maxz,bottom,top}
function addCollider(x,z,w,d,bottom=0,top=3.2){ colliders.push({minx:x-w/2,maxx:x+w/2,minz:z-d/2,maxz:z+d/2,bottom,top}); }

const wallMat=new THREE.MeshStandardMaterial({color:0x6b5a4a,roughness:0.9});
function wall(x,z,w,d,h=2.6){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),wallMat);m.position.set(x,h/2,z);m.castShadow=true;m.receiveShadow=true;scene.add(m); addCollider(x,z,w,d,0,h);}
const ROOM=130;
const mapRoot=new THREE.Group(); scene.add(mapRoot);
const mapFeatures=[];
function registerMapFeature(feature){ mapFeatures.push(feature); return feature; }

const propMat=new THREE.MeshStandardMaterial({color:0x7a6450,roughness:0.85});
const platforms=[];   // 可站立顶面: {minx,maxx,minz,maxz,top}
const hittables=[];   // 可被攻击的物体
const terrainAreas=[];
const VILLAGE_TOPS = { ground:0, church:0.22, elder:0.48 };
const groundMats=new Map();
function mat(color,roughness=0.9){
  const key=`${color}_${roughness}`;
  if(!groundMats.has(key)) groundMats.set(key,new THREE.MeshStandardMaterial({color,roughness}));
  return groundMats.get(key);
}
function addGroundPatch(x,z,w,d,top=0,color=0x5a5241){
  const h=0.14;
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(color,0.94));
  m.position.set(x,top-h/2,z); m.receiveShadow=true; mapRoot.add(m);
  terrainAreas.push({minx:x-w/2,maxx:x+w/2,minz:z-d/2,maxz:z+d/2,top});
  if(top>0.03) platforms.push({minx:x-w/2,maxx:x+w/2,minz:z-d/2,maxz:z+d/2,top});
  registerMapFeature({type:color===0x6d6049||color===0x766a58?'road':'terrain',x,z,w,d,rot:0,top,color});
  return m;
}
function terrainYAt(x,z){
  let top=terrainH(x,z);
  for(const a of terrainAreas){
    if(x>=a.minx && x<=a.maxx && z>=a.minz && z<=a.maxz) top=Math.max(top,a.top);
  }
  return top;
}
function addLowWall(x,z,w,d,h=1.25,color=0x6b5a4a,top=terrainYAt(x,z)){
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(color,0.86));
  m.position.set(x,top+h/2,z); m.castShadow=true; m.receiveShadow=true; mapRoot.add(m);
  registerMapFeature({type:'wall',x,z,w,d,rot:0,top,color});
  addCollider(x,z,w,d,top,top+h); return m;
}
function addStep(x,z,w,d,top,color=0x756354){
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,top,d),mat(color,0.88));
  m.position.set(x,top/2,z); m.castShadow=true; m.receiveShadow=true; mapRoot.add(m);
  platforms.push({minx:x-w/2,maxx:x+w/2,minz:z-d/2,maxz:z+d/2,top});
  registerMapFeature({type:'road',x,z,w,d,rot:0,top,color});
  return m;
}
function localPoint(x,z,dx,dz,rot=0){
  const s=Math.sin(rot), c=Math.cos(rot);
  return {x:x+dx*c+dz*s,z:z-dx*s+dz*c};
}
function addLocalCollider(x,z,lx,lz,w,d,rot=0,bottom=0,top=3.2){
  const p=localPoint(x,z,lx,lz,rot);
  addCollider(p.x,p.z,w,d,bottom,top);
}
function makeGableRoof(w,d,h,color){
  const hw=w/2, hd=d/2;
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array([
    -hw,0,-hd,  hw,0,-hd,  0,h,-hd,
    -hw,0, hd,  hw,0, hd,  0,h, hd
  ]),3));
  geo.setIndex([0,1,2, 3,5,4, 0,2,5, 0,5,3, 1,4,5, 1,5,2]); // 删底面防z-fighting
  geo.computeVertexNormals();
  return new THREE.Mesh(geo,mat(color,0.82));
}
function addSign(text,x,z,rot=0,top=terrainYAt(x,z)){
  const g=new THREE.Group(); g.position.set(x,top,z); g.rotation.y=rot; mapRoot.add(g);
  const post=new THREE.Mesh(new THREE.BoxGeometry(0.12,1.15,0.12),mat(0x5a3a22,0.85));
  post.position.y=0.58; post.castShadow=true; g.add(post);
  const cv=document.createElement('canvas'); cv.width=256; cv.height=96;
  const ctx=cv.getContext('2d');
  ctx.fillStyle='#5b3820'; ctx.fillRect(0,0,256,96);
  ctx.strokeStyle='#c7954e'; ctx.lineWidth=8; ctx.strokeRect(8,8,240,80);
  ctx.fillStyle='#f8e3ac'; ctx.font='bold 36px Arial, sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(text,128,50);
  const tex=new THREE.CanvasTexture(cv);
  const board=new THREE.Mesh(new THREE.PlaneGeometry(1.8,0.68),new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide}));
  board.position.set(0,1.45,0.04); board.castShadow=true; g.add(board);
  return g;
}
function addBuilding({name,x,z,w,d,top=terrainYAt(x,z),rot=0,wallColor=0xc9b487,roofColor=0x6d3a30,stone=false,tower=false,sign=''}){
  const root=new THREE.Group(); root.position.set(x,top,z); root.rotation.y=rot; mapRoot.add(root);
  registerMapFeature({type:'building',name,sign,x,z,w,d,rot,top,roofColor,stone,tower});
  const bodyH=stone?3.6:3.2;
  const bodyMat=mat(stone?0xa99c89:wallColor,0.88);
  const bodyMesh=new THREE.Mesh(new THREE.BoxGeometry(w,bodyH,d),bodyMat);
  bodyMesh.position.y=bodyH/2; bodyMesh.castShadow=true; bodyMesh.receiveShadow=true; root.add(bodyMesh);
  const roof=makeGableRoof(w+1.2,d+1.1,stone?1.5:1.25,roofColor);
  roof.position.y=bodyH; roof.castShadow=true; roof.receiveShadow=true; root.add(roof);
  const door=new THREE.Mesh(new THREE.BoxGeometry(1.25,1.85,0.12),mat(stone?0x4b3628:0x5b3721,0.78));
  door.position.set(0,0.92,d/2+0.07); door.castShadow=true; root.add(door);
  const step=new THREE.Mesh(new THREE.BoxGeometry(1.8,0.18,0.8),mat(0x80684f,0.88));
  step.position.set(0,0.09,d/2+0.48); step.receiveShadow=true; root.add(step);
  for(const sx of [-w*0.28,w*0.28]){
    const win=new THREE.Mesh(new THREE.BoxGeometry(0.72,0.72,0.1),mat(0xf5cf74,0.55));
    win.position.set(sx,2.05,d/2+0.08); win.castShadow=true; root.add(win);
    const frame=new THREE.Mesh(new THREE.BoxGeometry(0.9,0.86,0.08),mat(0x4b2d1b,0.78));
    frame.position.set(sx,2.05,d/2+0.04); frame.castShadow=true; root.add(frame);
  }
  if(tower){
    const tw=new THREE.Mesh(new THREE.BoxGeometry(2.4,5.2,2.4),mat(0xa89d8e,0.9));
    tw.position.set(w*0.35,2.6,-d*0.18); tw.castShadow=true; tw.receiveShadow=true; root.add(tw);
    const tr=makeGableRoof(3.0,3.0,1.7,0x5b3230); tr.position.set(w*0.35,5.2,-d*0.18); tr.rotation.y=Math.PI/2; tr.castShadow=true; root.add(tr);
    const crossA=new THREE.Mesh(new THREE.BoxGeometry(0.18,1.25,0.18),mat(0xe6d8a6,0.65));
    crossA.position.set(w*0.35,7.0,-d*0.18); root.add(crossA);
    const crossB=new THREE.Mesh(new THREE.BoxGeometry(0.88,0.16,0.16),mat(0xe6d8a6,0.65));
    crossB.position.set(w*0.35,7.18,-d*0.18); root.add(crossB);
  }
  addCollider(x,z,w+0.8,d+0.8,top,top+bodyH+(stone?1.9:1.55));
  if(sign){
    const p=localPoint(x,z,w*0.32,d/2+1.0,rot);
    addSign(sign,p.x,p.z,rot,top);
  }
  return root;
}
function addPlayerHome({x,z,top=terrainYAt(x,z),rot=0}){
  const w=9.5,d=9.0,wallT=0.36,wallH=4.4,doorW=2.7,doorH=3.9;
  const floorTop=top+0.13;
  const root=new THREE.Group(); root.position.set(x,top,z); root.rotation.y=rot; mapRoot.add(root);
  registerMapFeature({type:'building',name:'player-home',sign:'HOME',x,z,w,d,rot,top,roofColor:0x6c4738,enterable:true});
  const floor=new THREE.Mesh(new THREE.BoxGeometry(w,0.18,d),mat(0x7b6a52,0.92));
  floor.position.y=0.04; floor.receiveShadow=true; root.add(floor);
  platforms.push({minx:x-w/2+wallT,maxx:x+w/2-wallT,minz:z-d/2+wallT,maxz:z+d/2-wallT,top:floorTop});
  const wallMaterial=mat(0xc8b07f,0.88);
  function wallSeg(lx,ly,lz,sw,sh,sd){
    const m=new THREE.Mesh(new THREE.BoxGeometry(sw,sh,sd),wallMaterial);
    m.position.set(lx,ly,lz); m.castShadow=true; m.receiveShadow=true; root.add(m); return m;
  }
  wallSeg(0,wallH/2,-d/2, w,wallH,wallT);                        // back
  wallSeg(-w/2,wallH/2,0, wallT,wallH,d);                         // left
  wallSeg(w/2,wallH/2,0, wallT,wallH,d);                          // right
  wallSeg(-(w+doorW)/4,wallH/2,d/2, (w-doorW)/2,wallH,wallT);      // front left
  wallSeg((w+doorW)/4,wallH/2,d/2, (w-doorW)/2,wallH,wallT);       // front right
  wallSeg(0,doorH+(wallH-doorH)/2,d/2, doorW,wallH-doorH,wallT);   // lintel
  const roof=makeGableRoof(w+1.1,d+1.0,1.55,0x6c4738);
  roof.position.y=wallH; roof.castShadow=true; roof.receiveShadow=true;
  root.add(roof);
  const porch=new THREE.Mesh(new THREE.BoxGeometry(3.6,0.2,1.4),mat(0x80684f,0.88));
  porch.position.set(0,0.1,d/2+0.72); porch.castShadow=true; porch.receiveShadow=true; root.add(porch);
  const doorFrameMat=mat(0x4d2f1d,0.78);
  for(const sx of [-doorW/2,doorW/2]){
    const post=new THREE.Mesh(new THREE.BoxGeometry(0.16,doorH,0.18),doorFrameMat);
    post.position.set(sx,doorH/2,d/2+0.12); post.castShadow=true; root.add(post);
  }
  const lintel=new THREE.Mesh(new THREE.BoxGeometry(doorW+0.25,0.16,0.18),doorFrameMat);
  lintel.position.set(0,doorH,d/2+0.12); lintel.castShadow=true; root.add(lintel);
  for(const [lx,lz] of [[-2.6,-2.4],[2.6,-2.4]]){
    const rug=new THREE.Mesh(new THREE.BoxGeometry(1.7,0.05,1.2),mat(lx<0?0x704436:0x5d693f,0.9));
    rug.position.set(lx,0.14,lz); rug.receiveShadow=true; root.add(rug);
  }
  const table=new THREE.Mesh(new THREE.BoxGeometry(1.9,0.22,1.1),mat(0x6b4326,0.82));
  table.position.set(-2.4,0.95,-1.0); table.castShadow=true; root.add(table);
  for(const [lx,lz] of [[-3.0,-1.6],[-1.8,-1.6],[-3.0,-0.4],[-1.8,-0.4]]){
    const leg=new THREE.Mesh(new THREE.BoxGeometry(0.16,0.82,0.16),mat(0x4a2d1b,0.82));
    leg.position.set(lx,0.52,lz); leg.castShadow=true; root.add(leg);
  }
  const bed=new THREE.Mesh(new THREE.BoxGeometry(2.3,0.55,3.0),mat(0x9f8f78,0.88));
  bed.position.set(2.7,0.35,-2.3); bed.castShadow=true; bed.receiveShadow=true; root.add(bed);
  const blanket=new THREE.Mesh(new THREE.BoxGeometry(2.25,0.18,1.9),mat(0x6b302c,0.86));
  blanket.position.set(2.7,0.76,-1.95); blanket.castShadow=true; root.add(blanket);
  const shelf=new THREE.Mesh(new THREE.BoxGeometry(0.42,2.3,2.0),mat(0x5a3a22,0.82));
  shelf.position.set(-w/2+0.45,1.15,2.0); shelf.castShadow=true; root.add(shelf);
  addLocalCollider(x,z,0,-d/2,w,wallT,rot,top,top+wallH);
  addLocalCollider(x,z,-w/2,0,wallT,d,rot,top,top+wallH);
  addLocalCollider(x,z,w/2,0,wallT,d,rot,top,top+wallH);
  addLocalCollider(x,z,-(doorW+w)/4,d/2,(w-doorW)/2,wallT,rot,top,top+wallH);
  addLocalCollider(x,z,(doorW+w)/4,d/2,(w-doorW)/2,wallT,rot,top,top+wallH);
  const p=localPoint(x,z,doorW*0.85,d/2+1.0,rot);
  addSign('HOME',p.x,p.z,rot,top);
  return root;
}
const FOREST='../assets/vendor/kaykit_forest/';
function addTree(x,z,scale=1,path='Tree_2_B_Color1.gltf'){
  placeGroundModel(FOREST+path,x,z,{scale,rot:Math.random()*Math.PI*2,groundCenter:true});
}
function placeGroundModel(path,x,z,opts={}){
  return placeModel(path,x,z,{...opts,y:(opts.y??0)+terrainYAt(x,z),parent:opts.parent||mapRoot});
}
function addPrimitiveRock(x,z,s=1){
  const m=new THREE.Mesh(new THREE.DodecahedronGeometry(s,0),mat(0x6b6b62,0.92));
  m.position.set(x,terrainYAt(x,z)+s*0.5,z); m.scale.y=0.55; m.rotation.set(Math.random(),Math.random()*Math.PI,Math.random());
  m.castShadow=true; m.receiveShadow=true; mapRoot.add(m);
}

let skyData;
function buildNewVillage(){
  function wb(px,py,pz,w,h,d,c=0xc9b487){
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(c,0.88));
    m.position.set(px,py+h/2,pz);m.castShadow=true;m.receiveShadow=true;mapRoot.add(m);
  }
  function roofAt(px,py,pz,w,d,ph,c=0x6d3a30,ry=0){
    const r=makeGableRoof(w,d,ph,c);r.position.set(px,py,pz);r.rotation.y=ry;r.castShadow=true;mapRoot.add(r);
  }
  function fencePost(px,pz){
    const p=new THREE.Mesh(new THREE.BoxGeometry(0.16,1.2,0.16),mat(0x9a7040,0.85));
    p.position.set(px,0.6,pz);mapRoot.add(p);
  }
  function fenceRail(x1,z1,x2,z2,broken=false){
    const cx=(x1+x2)/2,cz=(z1+z2)/2,len=Math.hypot(x2-x1,z2-z1);
    // 正确角度：让box的X轴对准(x2-x1, z2-z1)方向
    const ang=Math.atan2(-(z2-z1),x2-x1);
    fencePost(x1,z1);fencePost(x2,z2);
    if(!broken)for(const ry of[0.45,0.95]){
      const r=new THREE.Mesh(new THREE.BoxGeometry(len,0.09,0.08),mat(0xa07840,0.85));
      r.position.set(cx,ry,cz);r.rotation.y=ang;mapRoot.add(r);
    }
  }
  function lamp(px,pz){
    const p=new THREE.Mesh(new THREE.BoxGeometry(0.14,3.4,0.14),mat(0x3a2a1a,0.7));
    p.position.set(px,1.7,pz);mapRoot.add(p);
    const lb=new THREE.Mesh(new THREE.BoxGeometry(0.42,0.42,0.42),mat(0xf8e060,0.3));
    lb.position.set(px,3.5,pz);mapRoot.add(lb);
    const pl=new THREE.PointLight(0xffcc66,1.1,9);pl.position.set(px,3.5,pz);scene.add(pl);
  }
  function prop(file,px,pz,sc=1){
    placeGroundModel('../assets/vendor/fantasy_props/'+file,px,pz,{scale:sc,groundCenter:true});
  }

  // ── terrain: 主通道全部y=0，丘陵感用颜色区分，不做高度差 ────
  // terrain mesh handles grass — no background patches needed
  // 主街砖地
  for(const[sx,sz,sw,sd]of[[-1,4,7,10],[1,15,8,14],[3,30,8,14],[0,46,8,16],[-2,62,7,16]])
    addGroundPatch(sx,sz,sw,sd,0,0x8a7a65);
  addGroundPatch(-4,60,22,18,0,0x8a7a65); // 广场

  // ── church 教堂 ──────────────────────────────────────────────
  {const cx=0,cz=72;
  wb(cx,0,cz,12,7.0,18,0xa89d8a);roofAt(cx,7.0,cz,13.4,19.4,2.2,0x4a2e28);
  wb(cx,0,cz-9.5,5.0,10.0,5.0,0xb0a594); // tower
  const tr=makeGableRoof(6.0,6.0,2.8,0x3a2420);tr.position.set(cx,10.0,cz-9.5);tr.rotation.y=Math.PI/4;tr.castShadow=true;mapRoot.add(tr);
  wb(cx,11.5,cz-9.5,0.18,1.6,0.18,0xe8d8a0);wb(cx,12.2,cz-9.5,1.1,0.15,0.15,0xe8d8a0);
  addCollider(cx,cz,12.8,18.8,0,7.0);addCollider(cx,cz-9.5,5.2,5.2,0,10.0);}

  // ── elder 村长家 L-shape ───────────────────────────────────
  {const ex=-20,ez=60;
  wb(ex,0,ez,13,5.6,10,0xb8a888);roofAt(ex,5.6,ez,14.4,11.4,1.8,0x5a3228);
  wb(ex+9,0,ez-8,8,5.0,8,0xb0a080);roofAt(ex+9,5.0,ez-8,9.4,9.4,1.6,0x5a3228);
  addCollider(ex,ez,13.8,10.8,0,5.6);addCollider(ex+9,ez-8,8.8,8.8,0,5.0);}

  // ── inn 旅馆 L-shape ───────────────────────────────────────
  {const ix=20,iz=30;
  wb(ix,0,iz,14,5.6,9,0xc8b07a);roofAt(ix,5.6,iz,15.4,10.4,1.8,0x6a3626);
  wb(ix+5,0,iz-8,8,5.0,8,0xc0a872);roofAt(ix+5,5.0,iz-8,9.4,9.4,1.6,0x6a3626);
  addCollider(ix,iz,14.8,9.8,0,5.6);addCollider(ix+5,iz-8,8.8,8.8,0,5.0);}

  // ── blacksmith 铁匠铺 ─────────────────────────────────────
  {const bx=-17,bz=20;
  wb(bx,0,bz,11,5.2,9,0x9a9080);roofAt(bx,5.2,bz,12.4,10.4,1.6,0x3e3028);
  for(const ppx of[bx-2,bx+2]){const p=new THREE.Mesh(new THREE.BoxGeometry(0.2,3.8,0.2),mat(0x5a3a1a,0.8));p.position.set(ppx,1.9,bz+5.5);mapRoot.add(p);}
  wb(bx,3.8,bz+5.5,5.0,0.2,2.8,0x5a3a1a);
  addCollider(bx,bz,11.8,9.8,0,5.2);}

  // ── shop 商店 ─────────────────────────────────────────────
  {const sx=18,sz=44;
  wb(sx,0,sz,9,4.8,8,0xc8b888);roofAt(sx,4.8,sz,10.4,9.4,1.5,0x6d3a30);
  addCollider(sx,sz,9.8,8.8,0,4.8);}

  // ── residences 民居 ──────────────────────────────────────
  for(const[hx,hz]of[[-13,10],[-18,52],[15,54]]){
    wb(hx,0,hz,8,4.4,7,0xc4aa7a);roofAt(hx,4.4,hz,9.4,8.4,1.4,0x703830);
    addCollider(hx,hz,8.8,7.8,0,4.4);
    fenceRail(hx-4,hz-3.5,hx+4,hz-3.5);
    fenceRail(hx-4,hz-3.5,hx-4,hz-9.5);
    fenceRail(hx+4,hz-3.5,hx+4,hz-9.5);
    fenceRail(hx-4,hz-9.5,hx+1,hz-9.5);
    fenceRail(hx+1,hz-9.5,hx+4,hz-9.5,true);
    for(let c=0;c<3;c++){
      const bx2=hx+(Math.random()-0.5)*5,bz2=hz-4.5-Math.random()*4;
      const bdy=new THREE.Mesh(new THREE.BoxGeometry(0.32,0.28,0.44),mat(0xf0e8d0,0.9));
      bdy.position.set(bx2,0.14,bz2);mapRoot.add(bdy);
      const hd=new THREE.Mesh(new THREE.BoxGeometry(0.19,0.19,0.19),mat(0xf0e0c8,0.9));
      hd.position.set(bx2,0.38,bz2-0.26);mapRoot.add(hd);
    }
  }

  // ── 路边篱笆 ─────────────────────────────────────────────
  fenceRail(-5,6,-5,16);fenceRail(-5,18,-5,26,true);fenceRail(-5,26,-5,36);
  fenceRail(6,26,6,36);fenceRail(6,37,6,42,true);fenceRail(6,43,6,54);

  // ── 路灯 ───────────────────────────────────────────────────
  for(const[lx,lz]of[[4,11],[-4,22],[4,34],[-4,46],[4,57],[-3,66]])lamp(lx,lz);

  // ── 树木围村 ─────────────────────────────────────────────
  for(const[tx,tz]of[[-30,10],[-36,26],[-32,44],[-30,60],[-24,76],[-10,84],[4,86],[18,80],[30,66],[32,50],[30,32],[28,16],[16,-4],[0,-8],[-16,2],[8,88],[-38,36],[34,40]])
    addTree(tx,tz,0.9+Math.random()*0.4);

  // ── 道具 ─────────────────────────────────────────────────
  prop('Barrel_Apples.gltf',22,26.5);prop('Barrel.gltf',21,27.8);
  prop('Anvil.gltf',-11,25);prop('Crate_Wooden.gltf',-19,21.5);
  prop('FarmCrate_Apple.gltf',12,41);prop('FarmCrate_Carrot.gltf',13,42.2);
  prop('Bench.gltf',4,63);
}

// ── village ──────────────────────────────────────────────────
//buildNewVillage();
skyData = buildSky({ THREE, scene });
// vegetation cleared
; console.log("skyData:",!!skyData,"layers:",skyData?._cloudLayers?.length,"bills:",skyData?._cloudBillboards?.length);

const grassSystem = buildGrass({ THREE, scene, mapH: _mapH });

// ============================================================
//  练武木人桩
// ============================================================
const WOOD=0x9a6b3e, WOOD_D=0x6e4a28;
function Mwood(c){return new THREE.MeshStandardMaterial({color:c,roughness:0.85});}
function woodBox(w,h,d,c){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),Mwood(c));m.castShadow=true;m.receiveShadow=true;return m;}
function makeDummy(dx,dz,face){
  const root=new THREE.Group(); root.position.set(dx,0,dz); root.rotation.y=face; scene.add(root);
  registerMapFeature({type:'training',name:'木桩',x:dx,z:dz,w:1.2,d:1.2,rot:face});
  const base=new THREE.Mesh(new THREE.CylinderGeometry(0.85,1.0,0.4,16),Mwood(WOOD_D));
  base.position.y=0.2; base.castShadow=true; base.receiveShadow=true; root.add(base);
  const pivot=new THREE.Group(); pivot.position.y=0.4; root.add(pivot);
  const mats=[];
  function reg(mesh){ mats.push(mesh.material); return mesh; }
  const post=woodBox(0.42,2.4,0.42,WOOD); post.position.y=1.2; pivot.add(reg(post));
  for(const yy of [0.5,1.0,2.0]){ const r=woodBox(0.46,0.1,0.46,WOOD_D); r.position.y=yy; pivot.add(reg(r)); }
  const head=new THREE.Mesh(new THREE.SphereGeometry(0.34,16,12),Mwood(WOOD)); head.position.y=2.6; head.castShadow=true; pivot.add(reg(head));
  const armT=woodBox(1.7,0.22,0.22,WOOD); armT.position.set(0,1.9,0.0); pivot.add(reg(armT));
  const armDiagL=woodBox(0.22,0.22,1.1,WOOD); armDiagL.position.set(-0.5,1.5,0.3); armDiagL.rotation.x=0.5; pivot.add(reg(armDiagL));
  const armDiagR=woodBox(0.22,0.22,1.1,WOOD); armDiagR.position.set(0.5,1.5,0.3); armDiagR.rotation.x=0.5; pivot.add(reg(armDiagR));
  const armMid=woodBox(0.2,0.2,0.9,WOOD); armMid.position.set(0,1.15,0.45); pivot.add(reg(armMid));
  addCollider(dx,dz,0.6,0.6,terrainYAt(dx,dz),terrainYAt(dx,dz)+3.0);
  const dummy={root,pivot,mats, x:dx,z:dz, r:1.2, face, flashT:0, tilt:0, tiltVel:0};
  dummies.push(dummy);
}
const dummies=[];
//makeDummy(0,5,Math.PI);
const monsters=[];

// ─── WOLF ──────────────────────────────────────────────
let wolf=null;
// ── CUBE WOLF GLTF 加载（异步替换程序化狼）──────────────
function makeCubeWolfObj(gltfScene, clips, loader_THREE){
  const root = gltfScene;
  root.scale.setScalar(1.35);
  root.rotation.y = Math.PI; // 修正朝向
  root.position.set(5, 0, -5);
  scene.add(root);
  root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  const mixer = new loader_THREE.AnimationMixer(root);
  const clipMap = {};
  for(const c of clips) clipMap[c.name] = c;
  const STATE_MAP = {idle:'Idle',wander:'Walk',run:'Run',pounce:'Jump_Start',
    bite:'Headbutt',hurt:'Idle',death:'Death',howl:'Idle'};
  let curAction = null, curState = 'idle';
  function playClip(name, loop=true){
    const clip = clipMap[name]; if(!clip) return;
    const newAction = mixer.clipAction(clip);
    newAction.setLoop(loop?loader_THREE.LoopRepeat:loader_THREE.LoopOnce, Infinity);
    newAction.clampWhenFinished = !loop;
    if(curAction && curAction !== newAction){ curAction.fadeOut(0.2); }
    newAction.reset().fadeIn(0.2).play();
    curAction = newAction;
  }
  mixer.addEventListener('finished', ()=>{ curState='idle'; });
  playClip('Idle', true);
  // 材质 flash 用第一个mesh
  const firstMesh = (() => { let m=null; root.traverse(o=>{if(!m&&o.isMesh)m=o;}); return m; })();
  return {
    root,
    J: { body: { children: [firstMesh||{material:{emissive:{setHex:()=>{}},emissiveIntensity:0}}] } },
    get state(){ return curState; },
    setState(name){
      curState = name;
      const clipName = STATE_MAP[name]||'Idle';
      const loop = !['pounce','bite','hurt','death'].includes(name);
      playClip(clipName, loop);
    },
    update(dt){ mixer.update(dt); }
  };
}


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
const SKIN=0xf0c39a, HAIR=0x2b2018, GLASS=0x222222, SHIRT=0x3f6fb0, TANK=0xeaeaea,
      SHORTS=0xf2f2f2, LIMB=0xe2b48c, FLIP=0x3a4a6b;
function M(c,r=0.7){return new THREE.MeshStandardMaterial({color:c,roughness:r});}
function box(w,h,d,c){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),M(c));m.castShadow=true;m.receiveShadow=true;return m;}

const char=new THREE.Group(); scene.add(char);
const yaw=new THREE.Group(); char.add(yaw);
const body=new THREE.Group(); yaw.add(body);   // 整体姿态(前倾/翻滚)

// 比例（加长肢体 + 加腰）
const THIGH=0.78, SHIN=0.72, UPARM=0.6, FOREARM=0.56, ARM_W=0.26, LEG_W=0.3;
const CHEST_H=1.0;
const HIP_Y=THIGH+SHIN;                 // 1.5 胯高
const SHO_LOCAL=CHEST_H-0.05;           // 肩(相对腰)
const SHO_X=0.725;                      // 肩宽
const TOTAL_H=HIP_Y+CHEST_H+0.8;        // 约3.3

// —— 下半身（直接挂 body）——
const pelvis=box(1.0,0.42,0.66,SHORTS); pelvis.position.y=HIP_Y; body.add(pelvis);

// —— 腰/胸（waist 关节：chest 绕此旋转）——
const chest=new THREE.Group(); chest.position.y=HIP_Y; body.add(chest);
const torso=box(1.15,CHEST_H,0.7,SHIRT); torso.position.y=CHEST_H/2; chest.add(torso);
const tank=box(0.6,CHEST_H*0.92,0.56,TANK); tank.position.set(0,CHEST_H/2,0.09); chest.add(tank);

// 头 + 头发 + 眼镜（挂 chest）
const headGrp=new THREE.Group(); headGrp.position.y=CHEST_H+0.05; chest.add(headGrp);
const head=box(0.78,0.72,0.7,SKIN); head.position.y=0.36; headGrp.add(head);
const hairTop=box(0.86,0.32,0.78,HAIR); hairTop.position.y=0.66; headGrp.add(hairTop);
const hairBack=box(0.86,0.46,0.42,HAIR); hairBack.position.set(0,0.44,-0.22); headGrp.add(hairBack);
function ring(x){const g=new THREE.Mesh(new THREE.TorusGeometry(0.14,0.038,8,18),M(GLASS,0.4));g.position.set(x,0.37,0.36);headGrp.add(g);}
ring(-0.18); ring(0.18);
const bridge=box(0.13,0.035,0.05,GLASS); bridge.position.set(0,0.37,0.38); headGrp.add(bridge);

// —— 带关节肢体 —— upper/ lower 分色，避免额外套袖盒子(消除闪烁)
function jointedLimb(parent,upLen,loLen,w,px,py,upColor,loColor,withFoot){
  const root=new THREE.Group(); root.position.set(px,py,0); parent.add(root);
  const upper=box(w,upLen,w,upColor); upper.position.y=-upLen/2; root.add(upper);
  const j2=new THREE.Group(); j2.position.y=-upLen; root.add(j2);
  // 小腿渲染盒子比关节实际长度略短(底部上收), 避免戳穿脚上的鞋子; 不改关节长度=不影响腿长/脚底补偿
  const loShrink = withFoot ? 0.14 : 0;
  const loVis = loLen - loShrink;
  const lower=box(w*0.9,loVis,w*0.9,loColor); lower.position.y=-loShrink/2-loVis/2; j2.add(lower);
  let foot=null;
  if(withFoot){ foot=box(w+0.14,0.12,w+0.34,FLIP); foot.position.set(0,-loLen+0.1,0.12); j2.add(foot); }
  return {root,j2};
}
// 手臂挂 chest（短袖=上臂蓝色, 小臂=肤色）
const armScreenL=jointedLimb(chest,UPARM,FOREARM,ARM_W,-SHO_X,SHO_LOCAL,SHIRT,LIMB,false);
const armScreenR=jointedLimb(chest,UPARM,FOREARM,ARM_W, SHO_X,SHO_LOCAL,SHIRT,LIMB,false);
// 腿挂 body
const legScreenL=jointedLimb(body,THIGH,SHIN,LEG_W,-0.3,HIP_Y,LIMB,LIMB,true);
const legScreenR=jointedLimb(body,THIGH,SHIN,LEG_W, 0.3,HIP_Y,LIMB,LIMB,true);

// —— 物理左右别名 ——（角色正面朝镜头时，物理右侧在屏幕左侧）
// 以后代码里 RArm/RLeg = 角色物理右手/右腿，永不再错位
const RArm=armScreenL, LArm=armScreenR, RLeg=legScreenL, LLeg=legScreenR;

// 武器（握在角色物理右手）
// 左手：直接挂小臂
function addHand(parent,y){
  const h=box(ARM_W+0.06,0.2,ARM_W+0.1,SKIN);
  h.position.set(0,y,0.02); parent.add(h); return h;
}
addHand(LArm.j2,-FOREARM);

// ============================================================
//  右手腕关节 + 武器插槽（可替换握持物）
//  手腕绕小臂长轴(y)滚转 = 旋前/旋后：
//    内侧旋转(棍子贴向身体) = wristR.rotation.y 正值 +
//    外侧旋转(棍子向外延展) = wristR.rotation.y 负值 -
//    换算: 度数 × π/180  (内90°=+1.571, 外150°=-2.618)
// ============================================================
const rWrist=new THREE.Group();
rWrist.position.set(0,-FOREARM,0);     // 手腕枢轴在手位置
RArm.j2.add(rWrist);
const rHand=box(ARM_W+0.06,0.2,ARM_W+0.1,SKIN); rHand.position.set(0,0,0.02); rWrist.add(rHand);

const weaponSocket=new THREE.Group();
weaponSocket.position.set(0,0,0.06);              // 手心
weaponSocket.rotation.x = Math.PI*0.5 - 0.35;     // 握持朝向(已调好)
rWrist.add(weaponSocket);

function makeStick(){
  const g=new THREE.Group();
  const grip=box(0.11,0.32,0.11,0x4a3526); grip.position.y=0.02; g.add(grip);
  const guard=box(0.2,0.06,0.2,0x6b5640); guard.position.y=0.2; g.add(guard);
  const shaft=box(0.1,0.92,0.1,0x9a6a3b); shaft.position.y=0.68; g.add(shaft);
  return g;
}
// 长剑：握把在原点，刃沿+y伸出，更长
function makeSword(){
  const g=new THREE.Group();
  const grip=box(0.1,0.34,0.1,0x3a2a1c); grip.position.y=0.02; g.add(grip);          // 握把
  const guard=box(0.42,0.08,0.14,0x8a7340); guard.position.y=0.2; g.add(guard);        // 护手(横)
  const blade=box(0.12,1.5,0.05,0xcdd6e0); blade.position.y=0.98; g.add(blade);        // 剑身(长)
  const tip=box(0.12,0.16,0.05,0xe6edf5); tip.position.y=1.78; g.add(tip);             // 剑尖高光
  // 剑尖参考点(用于拖尾轨迹采样)
  const tipRef=new THREE.Object3D(); tipRef.position.set(0,1.86,0); g.add(tipRef);
  g.userData.tipRef=tipRef; g.userData.bladeLen=1.86;
  return g;
}
let weapon=makeSword();
weaponSocket.add(weapon);
const weaponTip=weapon.userData.tipRef;   // 剑尖世界坐标采样点

// 蓄满闪烁光环(挂在body中部)
// ===== 木星球体变身系统 =====
const jupiterBall=new THREE.Group();jupiterBall.visible=false;scene.add(jupiterBall);
const _jOrb1=new THREE.Group();jupiterBall.add(_jOrb1);
const _jSwd1=new THREE.Mesh(new THREE.BoxGeometry(0.12,2.1,0.07),new THREE.MeshStandardMaterial({color:0xeaeaea,roughness:0.1,emissive:0x8888aa,emissiveIntensity:1.2}));
_jOrb1.add(_jSwd1);
const _jOrb2=new THREE.Group();jupiterBall.add(_jOrb2);
const _jSwd2=new THREE.Mesh(new THREE.BoxGeometry(0.12,2.1,0.07),new THREE.MeshStandardMaterial({color:0x3f6fb0,roughness:0.1,emissive:0x2244aa,emissiveIntensity:1.2}));
_jOrb2.add(_jSwd2);
let jupiterActive=false,_jSpin=0,_drillSpin=0;
const chargeAuraMat=new THREE.MeshBasicMaterial({color:0xffe85a,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending});
const chargeAura=new THREE.Mesh(new THREE.SphereGeometry(1.3,16,12),chargeAuraMat);
chargeAura.position.y=1.6; chargeAura.visible=false; body.add(chargeAura);

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

function playClip(name){ P.clip=name; P.clipT=0; P.clipDur=CLIPS[name].dur; }

// 触发某招特效
function fireFx(fx){
  switch(fx){
    case 'slashR': hitstop=0.07; shake=0.14; SFX.swing(); break;
    case 'slashL': hitstop=0.07; shake=0.14; SFX.swing(); break;
    case 'chop':   hitstop=0.10; shake=0.22; SFX.chop(); swordBeam.spawnSwordBeam(); break;
    case 'slam':   hitstop=0.14; shake=0.32; break;   // 落地砸地：顿帧+震屏(更重)，不发剑气
    case 'stomp':  stompEffects.doStomp(); break;
    case 'drill':  hitstop=0.14; shake=0.6; stompEffects.doStomp(); P._drillBounce=4.5; break;                  // 战争践踏：浅坑+碎石+强震+周身AoE
    case 'kick':   hitstop=0.10; shake=0.20; SFX.kick(); break;   // 飞踹：顿帧+震屏(暂不击飞)
    case 'rise':   hitstop=0.09; shake=0.18; SFX.rise(); break;   // 升龙剑上挑：顿帧+震屏
    case 'thrust': SFX.thrust(); doThrust(); break;
    case 'spinSlash': hitstop=0.08; shake=0.22; break;
    case 'heavyCircle':    attackBursts.burstCircle(1.7); break;
    case 'heavyCircleBig': attackBursts.burstCircle(2.6); break;
  }
}
function doSlash(from,to,heavy){
  attackBursts.doSlash(from,to,heavy);
}
function doThrust(){
  // 去掉黄色刀光区域，只保留顿帧/震屏(剑的拖尾已表现突刺)
  hitstop=0.04; shake=0.12;
}
// 开始一招
function startMove(name){
  const mv=MOVES[name]; if(!mv)return;
  const prevMove=P.move;
  const prevState=P.state;
  P.state='attack'; P.move=name; P.moveT=0;
  P.phase='startup'; P.struck=false; P._plungeDone=false; P._customRecover=null;
  P.nextBuffer=null;
  P._ignoreHeavyRelease=false;   // 默认不忽略重击松手(升龙剑从"按住"触发时才置true)
  P.lunge=mv.lunge||0;
  P.spin = (mv.spin||mv.spinY)?0:P.spin;
  if(mv.spinY && P._spinHit) P._spinHit.clear();   // 重置大风车命中记录
  P._spinSnd=false; SFX.spinStop();
  P._slideV=undefined; P._slideStarted=null;   // 重置滑行
  // 拍下当前姿势快照，用于切招过渡补间(消除"弹一下"的卡顿)
  poseClipController.capturePoseSnapshot();
  P.blendT=0;
  P.blendDur=(name==='dRise'&&prevState==='dodge')?0.22:0.13;
  playClip(mv.clip);
  P._trailStarted=false;   // 拖尾在挥砍主体段才开启(见招式推进)
  P._launched=false;       // 升龙剑(dRise)地面蓄力后再起跳的一次性标志
  // 升龙剑顶点接践踏：先在最高点滞空停顿一下再俯冲(其它来源的践踏不停顿)
  P._stompHang = (name==='aStomp' && prevMove==='dRise') ? 0.28 : 0;
  if(name==='aDrill') _drillSpin=0;   // 旋风坠每次从0开始转，不累积
  if(name==='aJupiter') P._jupRev=-1;
  // 特效在 strike 时刻才触发(见招式推进)，不在起手触发
}
// 闪避连招触发：轻=李小龙腾空飞踢(立即起跳) / 重=升龙剑(先地面蓄力，起跳由推进段处理)
function startDodgeCombo(kind){
  if(kind==='light'){ P.jumping=true; P.vy=JUMP_V*0.95; startMove('dKick'); }
  else { P.chargeLock=true; startMove('dRise'); P._ignoreHeavyRelease=true; }
}

function startSlash(type,ratio=0){
  attackBursts.startSlash(type,ratio);
}
// 当前 (x,z) 处的支撑高度（地面0 或 站在某个平台顶）
function groundHeightAt(x,z){
  let g=terrainH(x,z);
  for(const p of platforms){
    if(x>=p.minx && x<=p.maxx && z>=p.minz && z<=p.maxz){ if(p.top>g) g=p.top; }
  }
  return g;
}
// 水平碰撞：当玩家高于某柱顶时，不把它当墙(可落脚)
function resolveCollision(){
  for(let i=0;i<colliders.length;i++){
    const c=colliders[i];
    // 柱子(有对应platform)且玩家已高于其顶面 → 跳过水平碰撞，让玩家能站上去
    const plat=platforms.find(p=>Math.abs((p.minx+p.maxx)/2-(c.minx+c.maxx)/2)<0.01 && Math.abs((p.minz+p.maxz)/2-(c.minz+c.maxz)/2)<0.01);
    if(plat && P.y>=plat.top-0.05) continue;
    const cx=Math.max(c.minx,Math.min(P.x,c.maxx));
    const cz=Math.max(c.minz,Math.min(P.z,c.maxz));
    const dx=P.x-cx, dz=P.z-cz; const d2=dx*dx+dz*dz;
    if(d2<PLAYER_R*PLAYER_R){
      const d=Math.sqrt(d2);
      if(d>0.0001){ const push=(PLAYER_R-d)/d; P.x+=dx*push; P.z+=dz*push; }
      else {
        const toL=P.x-c.minx, toR=c.maxx-P.x, toD=P.z-c.minz, toU=c.maxz-P.z;
        const m=Math.min(toL,toR,toD,toU);
        if(m===toL)P.x=c.minx-PLAYER_R; else if(m===toR)P.x=c.maxx+PLAYER_R;
        else if(m===toD)P.z=c.minz-PLAYER_R; else P.z=c.maxz+PLAYER_R;
      }
    }
  }
}
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
  resolveCollision();

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
  getWaterSurfaceMaterial: () => (typeof wSurfMat !== 'undefined' ? wSurfMat : null)
});
if(globalThis.__IAMOK_ENABLE_TEST_PROBE__){
  globalThis.__IAMOK_TEST_PROBE__ = {
    camera: () => ({
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z,
      yaw: cameraRig.yaw,
      pitch: cameraRig.pitch,
      targetYaw: cameraRig.targetYaw,
      targetPitch: cameraRig.targetPitch,
      minPitch: cameraRig.minPitch,
      maxPitch: cameraRig.maxPitch,
      playerTargetX: P.x,
      playerTargetY: P.y + 1.7,
      playerTargetZ: P.z
    }),
    render: () => ({
      renderTargetIsNull: renderer.getRenderTarget ? renderer.getRenderTarget() === null : true,
      clippingPlanes: renderer.clippingPlanes.length,
      waterReflectionMeshesVisible: waterReflectionMeshes.every(mesh => mesh.visible !== false),
      rendererWidth: renderer.domElement.width,
      rendererHeight: renderer.domElement.height,
      reflWidth: reflRT.width,
      reflHeight: reflRT.height,
      sceneRTWidth: sceneRT.width,
      sceneRTHeight: sceneRT.height
    })
  };
}
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
  const GRIP_DEFAULT=Math.PI*0.5-0.35, GRIP_SPEAR=Math.PI;
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
