import { makeWolf } from "./wolf.js";
// ===== 本地加载 Three.js =====
const THREE_SOURCES = [
  "three",
];
const GLTF_LOADER_SOURCES = [
  "three/addons/loaders/GLTFLoader.js",
];
const loadingEl = document.getElementById('loading');
let THREE = null;
for(let i=0;i<THREE_SOURCES.length;i++){
  try{
    THREE = await import(THREE_SOURCES[i]);
    if(THREE && THREE.Scene) break;
  }catch(e){ /* 试下一个源 */ }
}
if(!THREE || !THREE.Scene){
  loadingEl.innerHTML = '⚠️ 3D 引擎加载失败<br><span style="font-size:12px">本地 Three.js 依赖加载失败，请确认 lib/three.module.js 存在。</span>';
  throw new Error('Three.js load failed');
}

let GLTFLoader = null;
for(let i=0;i<GLTF_LOADER_SOURCES.length;i++){
  try{
    const mod = await import(GLTF_LOADER_SOURCES[i]);
    GLTFLoader = mod.GLTFLoader;
    if(GLTFLoader) break;
  }catch(e){ /* 试下一个源 */ }
}
if(!GLTFLoader) console.warn('Local GLTFLoader load failed; vendor models will be skipped.');

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
const SFX=(()=>{
  let ac=null; const cache={};
  function getAC(){ if(!ac)try{ac=new AudioContext();}catch(e){}; return ac; }
  async function load(url){
    if(cache[url]) return cache[url];
    const a=getAC(); if(!a) return null;
    try{
      const r=await fetch(url); const buf=await r.arrayBuffer();
      const decoded=await a.decodeAudioData(buf);
      cache[url]=decoded; return decoded;
    }catch(e){ return null; }
  }
  function play(url,vol=1){
    const a=getAC(); if(!a) return;
    load(url).then(buf=>{
      if(!buf) return;
      const src=a.createBufferSource(); src.buffer=buf;
      const g=a.createGain(); g.gain.value=vol;
      src.connect(g); g.connect(a.destination); src.start();
    });
  }
  const P='./assets/sounds/';
  let _si=0;
  return {
    resume(){ getAC()?.resume(); },
    swing(){ const ff=['swoshes/swosh-18','swoshes/swosh-20','swoshes/swosh-16']; play(P+ff[_si++%3]+'.ogg',0.55); },
    hitBone(){ const v=['hit_bone','hit_bone2','hit_bone3'][Math.floor(Math.random()*3)]; play(P+v+'.ogg',0.75); },
    hitWood(){ play(P+'hit_wood.ogg',0.65); },
    hitFlesh(){ play(P+(Math.random()<.5?'hit_flesh':'hit_flesh2')+'.ogg',0.6); },
    stomp(){   play(P+'stomp.ogg',0.85); play(P+'stomp2.ogg',0.4); },
    kick(){    play(P+'hit_bone.ogg',0.6); },
    thrust(){ const ff=['swoshes/swosh-18','swoshes/swosh-29']; play(P+ff[Math.floor(Math.random()*2)]+'.ogg',0.6); },
    _spinSrc:null,_spinGain:null,
    spinPlay(dur){ const url=P+'swoshes/swosh-23.ogg'; load(url).then(buf=>{ if(!buf)return; const a=getAC(),t0=a.currentTime,s=a.createBufferSource(),g=a.createGain(); s.buffer=buf; g.gain.setValueAtTime(0.6,t0); g.gain.setValueAtTime(0.6,t0+Math.max(0,dur-0.3)); g.gain.linearRampToValueAtTime(0,t0+dur); s.connect(g); g.connect(a.destination); this._spinSrc=s;this._spinGain=g; s.start(); s.stop(t0+dur+0.05); s.onended=()=>{this._spinSrc=null;this._spinGain=null;}; }); },
    spinStop(){ if(this._spinSrc&&this._spinGain){const a=getAC(),g=this._spinGain.gain,t=a.currentTime; g.cancelScheduledValues(t); g.setValueAtTime(0.6,t); g.linearRampToValueAtTime(0,t+0.15); try{this._spinSrc.stop(t+0.16);}catch(e){} this._spinSrc=null;this._spinGain=null;} },
    dodge(){ play(P+(Math.random()<.5?'dodge':'dodge2')+'.ogg',0.4); },
    rise(){ const ff=['swoshes/swosh-33','swoshes/swosh-26']; play(P+ff[_si++%2]+'.ogg',0.5); },
    drill(){   play(P+'stomp.ogg',0.9); },
    chop(){    play(P+'swoshes/swosh-03.ogg',0.7); },
  };
})();
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
function cameraOffset(distance=cameraRig.currentDistance){
  const cp=Math.cos(cameraRig.pitch);
  return new THREE.Vector3(
    Math.sin(cameraRig.yaw)*cp*distance,
    Math.sin(cameraRig.pitch)*distance,
    Math.cos(cameraRig.yaw)*cp*distance
  );
}
camera.position.copy(cameraOffset(cameraRig.distance)); camera.lookAt(0,1.7,0);

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

const gltfLoader = GLTFLoader ? new GLTFLoader() : null;
const modelCache = new Map();
function prepModel(root){
  root.traverse(o=>{
    if(o.isMesh){
      o.castShadow=true; o.receiveShadow=true;
      if(o.material){
        if(Array.isArray(o.material)) o.material.forEach(m=>{ if(m) m.roughness=Math.max(m.roughness??0.8,0.75); });
        else o.material.roughness=Math.max(o.material.roughness??0.8,0.75);
      }
    }
  });
}
function loadModel(path){
  if(!gltfLoader) return Promise.resolve(null);
  if(modelCache.has(path)) return modelCache.get(path);
  const p = new Promise(resolve=>{
    gltfLoader.load(path, gltf=>{
      prepModel(gltf.scene);
      resolve(gltf.scene);
    }, undefined, err=>{
      console.warn('Model load failed:', path, err);
      resolve(null);
    });
  });
  modelCache.set(path,p);
  return p;
}
function loadFreshModel(path){
  if(!gltfLoader) return Promise.resolve(null);
  return new Promise(resolve=>{
    gltfLoader.load(path, gltf=>{
      prepModel(gltf.scene);
      resolve(gltf.scene);
    }, undefined, err=>{
      console.warn('Model load failed:', path, err);
      resolve(null);
    });
  });
}
async function placeModel(path,x,z,{scale=1,rot=0,y=0,parent=scene,name='',groundCenter=false}={}){
  const src=await loadModel(path);
  if(!src) return null;
  const obj=src.clone(true);
  obj.rotation.y=rot; obj.scale.setScalar(scale);
  if(groundCenter){
    const box=new THREE.Box3().setFromObject(obj);
    const c=box.getCenter(new THREE.Vector3());
    obj.position.set(x-c.x,y-box.min.y,z-c.z);
  } else {
    obj.position.set(x,y,z);
  }
  if(name) obj.name=name;
  parent.add(obj);
  return obj;
}

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
const interiors=[];
function pointInRotRect(px,pz,area,pad=0){
  const dx=px-area.x, dz=pz-area.z;
  const s=Math.sin(area.rot||0), c=Math.cos(area.rot||0);
  const lx=dx*c-dz*s, lz=dx*s+dz*c;
  return Math.abs(lx)<=area.w/2+pad && Math.abs(lz)<=area.d/2+pad;
}

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
  interiors.push({name:'player-home',x,z,w:w-wallT*2,d:d-wallT*2,rot,roof,inside:false});
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

function buildSky(){
  const _sd=new THREE.Mesh(new THREE.SphereGeometry(450000,16,8),new THREE.ShaderMaterial({
    side:THREE.BackSide,depthWrite:false,fog:false,
    uniforms:{uTop:{value:new THREE.Color(0.18,0.42,0.75)},uMid:{value:new THREE.Color(0.38,0.65,0.88)},uHor:{value:new THREE.Color(0.72,0.85,0.94)}},
    vertexShader:'varying vec3 vDir;void main(){vDir=normalize((modelMatrix*vec4(position,0.)).xyz);vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;}',
    fragmentShader:'uniform vec3 uTop,uMid,uHor;varying vec3 vDir;void main(){float y=clamp(normalize(vDir).y,0.,1.);vec3 c=mix(uHor,uMid,smoothstep(-0.1,0.15,y));c=mix(c,uTop,smoothstep(0.15,1.,y));gl_FragColor=vec4(c,1.);}'
  }));
  _sd.renderOrder=-1; scene.add(_sd);
  scene.background=new THREE.Color(0x5ab4e8);
  const _cTL2=new THREE.TextureLoader();
  const _cirrTex=_cTL2.load('./textures/cloud_cirrus.png'); _cirrTex.wrapS=_cirrTex.wrapT=THREE.RepeatWrapping;
  function _mkCDome(tex,renderOrd,sx,sz,frag){
    const mat=new THREE.ShaderMaterial({uniforms:{uMap:{value:tex},uOff:{value:new THREE.Vector2()}},
      vertexShader:'varying vec3 vDir;void main(){vDir=normalize((modelMatrix*vec4(position,0.)).xyz);vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;}',
      fragmentShader:frag||'uniform sampler2D uMap;uniform vec2 uOff;varying vec3 vDir;void main(){vec3 d=normalize(vDir);if(d.y<-0.02){gl_FragColor=vec4(0.);return;}float fade=smoothstep(-0.02,0.15,d.y);float sc=1./(abs(d.y)+0.12);vec2 uv=d.xz*sc*0.3+uOff;vec4 c=texture2D(uMap,uv);gl_FragColor=vec4(c.rgb,c.a*fade);}',
      transparent:true,depthWrite:false,depthTest:true,depthFunc:THREE.LessEqualDepth,side:THREE.BackSide,fog:false});
    const mesh=new THREE.Mesh(new THREE.SphereGeometry(450000,32,16),mat);
    mesh.renderOrder=renderOrd;scene.add(mesh);return{mesh,mat,ox:0,oz:0,sx,sz};
  }
  const _ct2=[1,2,3,4].map(()=>{const t=_cTL2.load('./textures/cloud_cumulus.png');t.colorSpace=THREE.LinearSRGBColorSpace;return t;});
  function _mkBill(tex,angle,r,h,w,bh){
    const mat=new THREE.ShaderMaterial({uniforms:{uMap:{value:tex}},
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:'uniform sampler2D uMap;varying vec2 vUv;void main(){vec4 c=texture2D(uMap,vUv);if(c.a<0.08)discard;float bt=smoothstep(0.55,0.0,vUv.y)*0.35;c.rgb=mix(c.rgb,vec3(0.72,0.85,0.94),bt);gl_FragColor=vec4(c.rgb,1.);}',
      side:THREE.DoubleSide,fog:false});
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,bh),mat);
    mesh.position.set(r*Math.cos(angle),h,r*Math.sin(angle));scene.add(mesh);
    return{mesh,angle,r,h,speed:.000008};
  }
  const _cloudLayers=[_mkCDome(_cirrTex,1,.000025,.00001)];
  const _cloudBillboards=[
    _mkBill(_ct2[0],.35,600,150,675,450),_mkBill(_ct2[2],1.80,640,150,675,450),
    _mkBill(_ct2[1],3.30,620,150,675,450),_mkBill(_ct2[3],5.00,660,150,675,450)
  ];
  return{clouds:[],birds:[],_cloudLayers,_cloudBillboards};
}
function updateSky(dt,t){
  for(const cl of skyData._cloudLayers)
    cl.mat.uniforms.uOff.value.set(cl.ox+=cl.sx*dt, cl.oz+=cl.sz*dt);
  for(const b of skyData._cloudBillboards)
    b.mesh.quaternion.copy(camera.quaternion);
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
skyData = buildSky();
// vegetation cleared
; console.log("skyData:",!!skyData,"layers:",skyData?._cloudLayers?.length,"bills:",skyData?._cloudBillboards?.length);

// ── Foliage System ──────────────────────────────────────────
function buildGrass(){
  const _tl=new THREE.TextureLoader();
  window._grassMats=[];
  function bh(x,z){const fx=(x+130)/2,fz=(z+130)/2,ix=Math.max(0,Math.min(129,Math.floor(fx))),iz=Math.max(0,Math.min(129,Math.floor(fz))),tx=fx-ix,tz=fz-iz,S=131;return(_mapH[iz*S+ix]??0)*(1-tx)*(1-tz)+(_mapH[iz*S+ix+1]??0)*tx*(1-tz)+(_mapH[(iz+1)*S+ix]??0)*(1-tx)*tz+(_mapH[(iz+1)*S+ix+1]??0)*tx*tz;}
  // GPU Gems Ch7.3.2: 3张交叉面，贴图512x512正方形→W=H
  // [name, count, size, windStr, yMin, yMax, bottomOffset, cellSize(>0=网格排布连成片)]
  const TYPES=[
    ['foliage_card_02_short_turf',   8000,1.8,0.12,-5,20,0.20,1.5],
    ['foliage_card_05_broadleaf_low',2800,2.2,0.18, 0,14,0.08,2.2],
    ['foliage_card_06_white_wildflowers',1800,2.0,0.25,0,14,0.05,2.8],
    ['foliage_extra_05_clover_ground',2200,2.0,0.12, 0,13,0.14,2.2],
    ['foliage_card_03_sedge_thin',   1800,2.4,0.50,-3, 8,0.02,2.5],
  ];
  // 3交叉面几何体，ofs=底部留白高度→下移让草根贴地
  function makeCross(S,ofs){
    const vp=[],vu=[],vi=[];
    for(let i=0;i<3;i++){
      const a=i*Math.PI/3,ca=Math.cos(a),sa=Math.sin(a),b=vp.length/3;
      vp.push(-ca*S/2,-ofs,-sa*S/2, ca*S/2,-ofs,sa*S/2, -ca*S/2,S-ofs,-sa*S/2, ca*S/2,S-ofs,sa*S/2);
      vu.push(0,0,1,0,0,1,1,1);
      vi.push(b,b+1,b+2, b+1,b+3,b+2);
    }
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(vp,3));
    g.setAttribute('uv',new THREE.Float32BufferAttribute(vu,2));
    g.setIndex(vi);return g;
  }
  const VS=`#include <common>
uniform float uTime,uWind;varying vec2 vUv;varying float vDist;
void main(){
  vec3 ip=vec3(instanceMatrix[3][0],instanceMatrix[3][1],instanceMatrix[3][2]);
  float top=smoothstep(0.5,1.0,uv.y);
  float ph=ip.x*.31+ip.z*.17;
  vec3 lp=mat3(instanceMatrix)*position;
  lp.x+=sin(uTime*1.8+ph)*uWind*top;
  lp.z+=cos(uTime*1.4+ph*.8)*uWind*.6*top;
  vDist=length(cameraPosition-ip);
  gl_Position=projectionMatrix*viewMatrix*vec4(ip+lp,1.);vUv=uv;}`;
  const FS=`uniform sampler2D uTex;varying vec2 vUv;varying float vDist;
void main(){vec4 c=texture2D(uTex,vUv);
  float fade=1.-smoothstep(55.,90.,vDist);
  if(c.a*fade<0.35)discard;
  gl_FragColor=vec4(c.rgb*mix(0.88,1.0,vUv.y),c.a*fade);}`;
  const dm=new THREE.Object3D();
  for(const [name,cnt,S,ws,yMn,yMx,bot,cell] of TYPES){
    const geo=makeCross(S,bot*S);
    const mat=new THREE.ShaderMaterial({uniforms:{uTex:{value:_tl.load('./textures/texture_foliage.png')},uTime:{value:0},uWind:{value:ws}},
      vertexShader:VS,fragmentShader:FS,side:THREE.DoubleSide,depthWrite:true,transparent:true});
    window._grassMats.push(mat);
    const mesh=new THREE.InstancedMesh(geo,mat,cnt);mesh.frustumCulled=false;
    let n=0;
    if(cell>0){
      // 网格抖动排布：连成片
      const cells=Math.ceil(250/cell);
      outer:for(let ix=0;ix<cells;ix++){for(let iz=0;iz<cells;iz++){
        if(n>=cnt)break outer;
        const x=-125+ix*cell+(Math.random()-.5)*cell*.8;
        const z=-125+iz*cell+(Math.random()-.5)*cell*.8;
        const y=bh(x,z);if(y<yMn||y>yMx)continue;
        dm.position.set(x,y-.05,z);dm.rotation.y=Math.random()*Math.PI*2;
        dm.scale.setScalar(.85+Math.random()*.3);dm.updateMatrix();
        mesh.setMatrixAt(n++,dm.matrix);
      }}
    } else {
      let tries=0;
      while(n<cnt&&tries++<cnt*6){
        const x=(Math.random()-.5)*250,z=(Math.random()-.5)*250,y=bh(x,z);
        if(y<yMn||y>yMx)continue;
        dm.position.set(x,y-.05,z);dm.rotation.y=Math.random()*Math.PI*2;
        dm.scale.setScalar(.8+Math.random()*.5);dm.updateMatrix();
        mesh.setMatrixAt(n++,dm.matrix);
      }
    }
    mesh.count=n;mesh.instanceMatrix.needsUpdate=true;scene.add(mesh);
  }
}
buildGrass();

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
const wolfAI = {
  hp:15, state:'patrol', attackCool:0, stateTimer:0,
  wx:0, wz:-40, facing:0,
  patrolTarget:{x:0,z:-40}, walking:false,
  spawnX:0, spawnZ:-40, patrolRadius:12, territoryR:12, alertR:22,
  hittable:{x:0,z:-40,r:1.8,flashT:0,shakeT:0}
};
wolf=makeWolf(THREE, scene, wolfAI.wx, 0.72, wolfAI.wz);
if(wolf){wolf.root.scale.setScalar(1.4);
wolf.root.position.set(wolfAI.wx,0.72,wolfAI.wz);
wolf.root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}}); }
wolfAI.hittable.mat=wolf?wolf.J.body.children[0].material:{};
wolfAI.hittable.mesh=wolf?wolf.root:null;
wolfAI.hittable.baseX=wolfAI.wx; wolfAI.hittable.baseZ=wolfAI.wz;
if(wolf) hittables.push(wolfAI.hittable);
wolfAI.hittable.onHit = ()=>{
  if(!wolf || wolfAI.state==='dead') return;
  wolfAI.hp--;
  wolf.setState('hurt');
  if(wolfAI.hp<=0){ wolf.setState('death'); wolfAI.state='dead'; wolfAI.hittable._dead=true; hittables.splice(hittables.indexOf(wolfAI.hittable),1); }
  else wolfAI.state='chase';
};

function lerpAngle(a,b,t){let d=b-a;while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;return a+d*Math.min(1,t);}


// ── GLTF狼加载（放在wolfAI定义之后）──
//wolf GLTF removed

function wolfPickPatrol(){
  const a=Math.random()*Math.PI*2, r=Math.random()*wolfAI.patrolRadius;
  wolfAI.patrolTarget={x:wolfAI.spawnX+Math.cos(a)*r, z:wolfAI.spawnZ+Math.sin(a)*r};
}
wolfPickPatrol();

function updateWolf(dt){if(!wolf)return;
  if(wolfAI.state==='dead'){ wolf.update(dt); return; }
  wolfAI.attackCool=Math.max(0,wolfAI.attackCool-dt);
  wolfAI.stateTimer=Math.max(0,wolfAI.stateTimer-dt);
  const wx=wolfAI.wx, wz=wolfAI.wz;
  const dx=P.x-wx, dz=P.z-wz, dist=Math.hypot(dx,dz);
  wolfAI.hittable.x=wx; wolfAI.hittable.z=wz;
  wolfAI.hittable.baseX=wx; wolfAI.hittable.baseZ=wz;

  // 扇形视野检测（120度，10格范围）
  const faceX=-Math.sin(wolfAI.facing), faceZ=-Math.cos(wolfAI.facing);
  const dot=dist>0.1?(faceX*dx+faceZ*dz)/dist:0;
  const canSee = dist<10 && dot>0.5; // cos(60°)=0.5 → 前方120°

  if(wolfAI.state==='patrol'){
    // 巡逻：走一走停一停
    if(wolfAI.stateTimer<=0){
      wolfAI.walking=!wolfAI.walking;
      wolfAI.stateTimer=wolfAI.walking?(1+Math.random()*2):(0.5+Math.random()*1.5);
      if(wolfAI.walking) wolfPickPatrol();
    }
    if(wolfAI.walking){
      const ptx=wolfAI.patrolTarget.x-wx, ptz=wolfAI.patrolTarget.z-wz;
      const pd=Math.hypot(ptx,ptz);
      if(pd>0.5){
        wolfAI.facing=lerpAngle(wolfAI.facing,Math.atan2(-ptx,-ptz),1.0*dt);
        wolfAI.wx+=ptx/pd*1.5*dt;
        wolfAI.wz+=ptz/pd*1.5*dt;
        if(wolf.state!=='wander') wolf.setState('wander');
      } else { wolfAI.stateTimer=0; } // 到达目标，立即进入停顿
    } else {
      if(wolf.state!=='idle') wolf.setState('idle');
      // 停顿时随机张望
      if(!wolfAI._lookTarget) wolfAI._lookTarget=wolfAI.facing+(Math.random()-0.5)*2.0;
      wolfAI.facing=lerpAngle(wolfAI.facing,wolfAI._lookTarget,0.8*dt);
    }
    if(wolfAI.stateTimer<=0||wolfAI.walking) wolfAI._lookTarget=null;
    if(canSee){ wolfAI.state='look'; wolfAI.stateTimer=2.0; }

  } else if(wolfAI.state==='look'){
    // 注视玩家
    wolfAI.facing=lerpAngle(wolfAI.facing,Math.atan2(-dx,-dz),1.5*dt);
    if(wolf.state!=='idle') wolf.setState('idle');
    if(wolfAI.stateTimer<=0) wolfAI.state='chase';

  } else if(wolfAI.state==='chase'){
    wolfAI.facing=lerpAngle(wolfAI.facing,Math.atan2(-dx,-dz),3.0*dt);
    if(dist>3.0){
      wolfAI.wx+=dx/dist*4.5*dt;
      wolfAI.wz+=dz/dist*4.5*dt;
      if(wolf.state!=='run' && wolf.state!=='hurt' && wolf.state!=='bite' && wolf.state!=='pounce') wolf.setState('run');
    } else if(wolfAI.attackCool<=0){
      wolf.setState(Math.random()<0.5?'pounce':'bite');
      wolfAI.attackCool=2.2;
      if(dist<2.8 && P.iframe<=0 && !P.dead){ P.hp=Math.max(0,P.hp-1); P.dead=P.hp<=0; P.iframe=0.5; hitstop=0.12;
        // 击退
        const safeDist=Math.max(dist,0.001), kb=2.5, kbx=-(dx/safeDist)*kb, kbz=-(dz/safeDist)*kb;
        P.x+=kbx*0.15; P.z+=kbz*0.15;
        // 屏幕红闪
        const fl=document.getElementById('hitFlash')||Object.assign(document.createElement('div'),{id:'hitFlash',style:'position:fixed;inset:0;background:radial-gradient(ellipse at center,transparent 65%,rgba(220,0,0,0.55) 100%);pointer-events:none;transition:opacity 0.25s;z-index:999'});
        if(!document.getElementById('hitFlash')) document.body.appendChild(fl);
        fl.style.opacity='1'; setTimeout(()=>fl.style.opacity='0',80);
        wolf.root.traverse(o=>{if(o.isMesh&&o.material?.emissive){o.material.emissive.setHex(0xff4400);o.material.emissiveIntensity=1.2;}});
        setTimeout(()=>wolf.root.traverse(o=>{if(o.isMesh&&o.material?.emissive)o.material.emissiveIntensity=0;}),120);
      }
    }
    // 玩家离开领地→守边界
    const pDs=Math.hypot(P.x-wolfAI.spawnX,P.z-wolfAI.spawnZ);
    if(pDs>wolfAI.territoryR && wolf.state!=='pounce' && wolf.state!=='bite'){ wolfAI.state='border'; wolfAI.stateTimer=1.2; }

  } else if(wolfAI.state==='border'){
    // 移到领地边缘，面朝玩家
    const sdx=P.x-wolfAI.spawnX,sdz=P.z-wolfAI.spawnZ,sd=Math.hypot(sdx,sdz)||1;
    const tx=wolfAI.spawnX+sdx/sd*wolfAI.territoryR,tz=wolfAI.spawnZ+sdz/sd*wolfAI.territoryR;
    const tdx=tx-wolfAI.wx,tdz=tz-wolfAI.wz,td=Math.hypot(tdx,tdz);
    if(td>0.5){ wolfAI.wx+=tdx/td*2.5*dt; wolfAI.wz+=tdz/td*2.5*dt; wolfAI.facing=lerpAngle(wolfAI.facing,Math.atan2(-tdx,-tdz),2.0*dt); if(wolf.state!=='wander') wolf.setState('wander'); }
    else{ wolfAI.facing=lerpAngle(wolfAI.facing,Math.atan2(-dx,-dz),1.5*dt); if(wolf.state!=='idle') wolf.setState('idle'); }
    const pDsB=Math.hypot(P.x-wolfAI.spawnX,P.z-wolfAI.spawnZ);
    if(wolfAI.stateTimer<=0 && pDsB<=wolfAI.territoryR-2) wolfAI.state='chase';
    else if(pDsB>wolfAI.alertR) wolfAI.state='return';

  } else if(wolfAI.state==='return'){
    const rdx=wolfAI.spawnX-wolfAI.wx,rdz=wolfAI.spawnZ-wolfAI.wz,rd=Math.hypot(rdx,rdz);
    if(rd>0.5){ wolfAI.wx+=rdx/rd*2.0*dt; wolfAI.wz+=rdz/rd*2.0*dt; wolfAI.facing=lerpAngle(wolfAI.facing,Math.atan2(-rdx,-rdz),2.0*dt); if(wolf.state!=='wander') wolf.setState('wander'); }
    else{ wolfAI.state='patrol'; wolfAI.walking=false; wolfAI.stateTimer=1.0; }
  }
  wolf.root.position.x=wolfAI.wx; wolf.root.position.z=wolfAI.wz;
  wolf.root.rotation.y=wolfAI.facing+Math.PI;
  wolf.update(dt);
}

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

// ============================================================
//  空间斩：剑攻击中用闪避打断 → 下次剑攻击命中处放辐射状空间斩
// ============================================================
let spaceSlashReady=false;
const slashLines=[];
function spawnSpaceSlash(x,y,z){
  const N=14, segs=[];
  for(let i=0;i<N;i++){
    const ang=Math.random()*Math.PI*2, pit=(Math.random()-0.5)*1.7;
    const len=1.6+Math.random()*2.4;
    const dx=Math.cos(ang)*Math.cos(pit), dy=Math.sin(pit), dz=Math.sin(ang)*Math.cos(pit);
    const off=(Math.random()-0.5)*0.4;
    segs.push({ox:x+dx*off,oy:y+dy*off,oz:z+dz*off,dx,dy,dz,len,delay:Math.random()*0.12});
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(N*2*3),3));
  const mat=new THREE.LineBasicMaterial({color:0xaef0ff,transparent:true,opacity:1,depthWrite:false,blending:THREE.AdditiveBlending});
  const m=new THREE.LineSegments(geo,mat); m.frustumCulled=false; scene.add(m);
  slashLines.push({mesh:m,mat,geo,segs,t:0,grow:0.10,hold:0.18,fade:0.22});
}
function updateSpaceSlash(dt){
  for(let i=slashLines.length-1;i>=0;i--){
    const s=slashLines[i]; s.t+=dt;
    const pos=s.geo.attributes.position.array;
    for(let j=0;j<s.segs.length;j++){
      const g=s.segs[j];
      let p=Math.max(0,Math.min(1,(s.t-g.delay)/s.grow));
      const L=g.len*p;
      pos[j*6+0]=g.ox; pos[j*6+1]=g.oy; pos[j*6+2]=g.oz;
      pos[j*6+3]=g.ox+g.dx*L; pos[j*6+4]=g.oy+g.dy*L; pos[j*6+5]=g.oz+g.dz*L;
    }
    s.geo.attributes.position.needsUpdate=true;
    const total=s.grow+s.hold+s.fade;
    s.mat.opacity = (s.t<=s.grow+s.hold) ? 1 : Math.max(0,1-(s.t-s.grow-s.hold)/s.fade);
    if(s.t>=total){ scene.remove(s.mesh); slashLines.splice(i,1); }
  }
}
// 命中钩子：带空间斩标记时，在命中点放空间斩并清除标记
function onHitTarget(ox,oy,oz){
  if(spaceSlashReady){ spawnSpaceSlash(ox,oy,oz); spaceSlashReady=false; hitstop=Math.max(hitstop,0.06); shake=Math.max(shake,0.2); }
  // 命中音效:骷髅→骨头脆响, 木桩→撞木声, 怪物(肉)→闷击声
  const nearDummy=dummies.some(d=>Math.hypot(d.x-ox,d.z-oz)<1.8);
  const nearMonster=monsters.some(m=>Math.hypot(m.x-ox,m.z-oz)<1.8);
  if(nearMonster) SFX.hitBone();
  else if(nearDummy) SFX.hitWood();
  else SFX.hitFlesh();
}

// ============================================================
//  攻击特效（朝向 yaw 局部 +Z = 正前方）
// ============================================================
// 轻击：正前方的弧形刀光（弧心朝 +Z=正前方）；用 Y轴pivot做左扫
const slashPivot=new THREE.Group(); slashPivot.position.set(0,0.06,0); yaw.add(slashPivot);
const slashMat=new THREE.MeshBasicMaterial({color:0xffe08a,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false});
const slashMesh=new THREE.Mesh(new THREE.RingGeometry(0.45,1.2,28,1, -Math.PI/2-0.95, 1.9),slashMat);
slashMesh.rotation.x=-Math.PI/2; slashMesh.position.set(0,0,0.3); slashMesh.visible=false; slashPivot.add(slashMesh);

// 重击：正前方地面圆圈判定（蓄力时实时显示、随蓄力变大）
const heavyRingMat=new THREE.MeshBasicMaterial({color:0xff7b3a,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false});
const heavyRing=new THREE.Mesh(new THREE.RingGeometry(0.86,1.0,40),heavyRingMat); // 比例缩放当作半径
heavyRing.rotation.x=-Math.PI/2; heavyRing.position.set(0,0.05,0); heavyRing.visible=false; yaw.add(heavyRing);
const heavyFillMat=new THREE.MeshBasicMaterial({color:0xff7b3a,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false});
const heavyFill=new THREE.Mesh(new THREE.CircleGeometry(1,40),heavyFillMat);
heavyFill.rotation.x=-Math.PI/2; heavyFill.position.set(0,0.04,0); heavyFill.visible=false; yaw.add(heavyFill);
function setHeavyCircle(radius, alongFront){
  // 圆心在正前方 alongFront 处
  heavyRing.position.set(0,0.05,alongFront); heavyFill.position.set(0,0.04,alongFront);
  heavyRing.scale.set(radius,radius,1); heavyFill.scale.set(radius,radius,1);
}

// 闪避残影池
const ghostMat=()=>new THREE.MeshBasicMaterial({color:0x9fd8ff,transparent:true,opacity:0,depthWrite:false});
const ghosts=[];
for(let i=0;i<6;i++){ const g=new THREE.Mesh(new THREE.CapsuleGeometry(0.45,1.4,4,8),ghostMat()); g.visible=false; g.life=0; scene.add(g); ghosts.push(g); }
let ghostTimer=0, ghostIdx=0;

// ============================================================
//  大风车"土星环"特效：从剑轨迹往外发散的同心圆扩散环
// ============================================================
const spinRings=[];   // {mesh,mat,t,dur,fromR,toR}
const SPIN_RING_Y=2.0;   // 土星环高度(大风车展开时手的高度)
function spawnSpinRing(centerX, centerZ, fromR, toR, delay){
  const geo=new THREE.RingGeometry(0.92,1.0,40);   // 细环，靠缩放当半径
  const mat=new THREE.MeshBasicMaterial({color:0xbfeaff,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending});
  const m=new THREE.Mesh(geo,mat); m.rotation.x=-Math.PI/2; m.position.set(centerX,SPIN_RING_Y,centerZ); m.visible=false; scene.add(m);
  spinRings.push({mesh:m,mat,t:-(delay||0),dur:0.32,fromR,toR});
}
function updateSpinRings(dt){
  for(let i=spinRings.length-1;i>=0;i--){
    const r=spinRings[i]; r.t+=dt;
    if(r.t<0) continue;
    r.mesh.visible=true;
    const k=Math.min(1,r.t/r.dur);
    const rad=r.fromR+(r.toR-r.fromR)*(1-(1-k)*(1-k));   // ease-out扩散
    r.mesh.scale.set(rad,rad,1);
    r.mat.opacity=0.7*(1-k);
    if(k>=1){ scene.remove(r.mesh); spinRings.splice(i,1); }
  }
}
// 一次大风车：发射一串往外扩散的同心环(土星环)
function spawnSaturnRings(){
  const inner=1.0, outer=SPIN_RADIUS+0.4;
  for(let n=0;n<5;n++){
    spawnSpinRing(P.x,P.z, inner+n*0.3, outer+n*0.25, n*0.035);
  }
}

// ============================================================
//  剑刃挥砍拖尾（每段独立年龄：先出现的先消失，彗星尾式渐隐）
// ============================================================
const TRAIL_MAX=26;                       // 拖尾缓冲上限
const TRAIL_LIFE=0.30;                    // 每段残影寿命(秒)
let TRAIL_SEG=4;                          // 当前拖尾采样段数(轻击=4, 大风车=长)
const trailMat=new THREE.MeshBasicMaterial({color:0xbfe6ff,transparent:true,opacity:1,vertexColors:true,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending});
const trailGeo=new THREE.BufferGeometry();
const trailPos=new Float32Array(TRAIL_MAX*2*3);  // 每段2个顶点(剑根/剑尖)
const trailCol=new Float32Array(TRAIL_MAX*2*4);  // 每顶点RGBA(用alpha做逐段渐隐)
trailGeo.setAttribute('position',new THREE.BufferAttribute(trailPos,3));
trailGeo.setAttribute('color',new THREE.BufferAttribute(trailCol,4));
const trailIdx=[];
for(let i=0;i<TRAIL_MAX-1;i++){ const a=i*2,b=i*2+1,c=(i+1)*2,d=(i+1)*2+1; trailIdx.push(a,b,c, b,d,c); }
trailGeo.setIndex(trailIdx);
const trailMesh=new THREE.Mesh(trailGeo,trailMat); trailMesh.frustumCulled=false; trailMesh.visible=false; scene.add(trailMesh);
let trailActive=false;
const trailRootPts=[], trailTipPts=[], trailAges=[];   // 世界坐标历史 + 每段年龄
function startTrail(segs){ TRAIL_SEG=segs||4; trailActive=true; trailRootPts.length=0; trailTipPts.length=0; trailAges.length=0; trailMesh.visible=true; }
function stopTrail(){ trailActive=false; }   // 停止记录，已有段继续按各自年龄消失
const _tmpTip=new THREE.Vector3(), _tmpRoot=new THREE.Vector3();
function updateTrail(dt){
  if(!trailMesh.visible) return;
  // 所有已存在段各自变老
  for(let i=0;i<trailAges.length;i++) trailAges[i]+=dt;
  if(trailActive){
    // 采样当前剑尖 + 剑根(护手处)世界坐标，作为最新段(年龄0)
    weaponTip.getWorldPosition(_tmpTip);
    weapon.localToWorld(_tmpRoot.set(0,0.3,0));
    trailTipPts.unshift(_tmpTip.clone()); trailRootPts.unshift(_tmpRoot.clone()); trailAges.unshift(0);
    if(trailTipPts.length>TRAIL_SEG){ trailTipPts.pop(); trailRootPts.pop(); trailAges.pop(); }
  }
  const n=trailTipPts.length;
  let anyVisible=false;
  for(let i=0;i<TRAIL_MAX;i++){
    const ti=Math.min(i,n-1);
    const tip=trailTipPts[ti]||_tmpTip, root=trailRootPts[ti]||_tmpRoot;
    trailPos[i*6+0]=root.x; trailPos[i*6+1]=root.y; trailPos[i*6+2]=root.z;
    trailPos[i*6+3]=tip.x;  trailPos[i*6+4]=tip.y;  trailPos[i*6+5]=tip.z;
    // 逐段透明度：按各段年龄(越老越透明)，超出实际段数的=0
    const age=(i<n && trailAges[ti]!==undefined)?trailAges[ti]:999;
    let a=Math.max(0, 1-age/TRAIL_LIFE)*0.7;
    if(a>0.001) anyVisible=true;
    for(const v of [i*2, i*2+1]){
      trailCol[v*4+0]=0.78; trailCol[v*4+1]=0.92; trailCol[v*4+2]=1.0; trailCol[v*4+3]=a;
    }
  }
  trailGeo.attributes.position.needsUpdate=true;
  trailGeo.attributes.color.needsUpdate=true;
  if(!trailActive && !anyVisible) trailMesh.visible=false;
}


// ============================================================
//  剑气弹幕（薄而立体的鲨鱼鳍，贴地飞 + 弹道追踪式裂缝）
// ============================================================
const GRID=2;                              // 地面每格=2单位
// 鲨鱼鳍轮廓(XY平面: X=飞行方向, Y=高度)；底边贴地，后缘高耸、尖端前扫
function makeFinShape(){
  const s=new THREE.Shape();
  s.moveTo(-0.55,0.0);                       // 尾根(后下)
  s.lineTo(-0.35,0.95);                      // 后缘陡升到鳍背最高
  s.quadraticCurveTo(0.1,0.85, 1.25,0.06);   // 鳍背前扫 → 前尖(贴地)
  s.lineTo(1.25,0.0);                        // 前尖底
  s.closePath();
  return s;
}
const beamMat=new THREE.MeshBasicMaterial({color:0xaff0ff,transparent:true,opacity:0.92,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending});
const finExtrudeGeo=new THREE.ExtrudeGeometry(makeFinShape(),{depth:0.1,bevelEnabled:false});
finExtrudeGeo.translate(0,0,-0.05);
const beams=[];
const cracks=[];
function spawnSwordBeam(){
  const grp=new THREE.Group();
  const fin=new THREE.Mesh(finExtrudeGeo, beamMat);
  fin.rotation.y=-Math.PI/2;                 // shape尖端+X → local +Z(飞行方向)
  grp.add(fin);
  const fx=Math.sin(P.facing), fz=Math.cos(P.facing);
  // 贴地飞：从玩家前方1格起步(脚下那格不算)
  const startX=P.x+fx*GRID, startZ=P.z+fz*GRID;
  grp.position.set(startX, 0.06, startZ);    // 紧贴地面
  grp.rotation.y=P.facing;
  scene.add(grp);
  // 弹道追踪式裂缝：先建空几何，随剑气推进逐段填充，总长3格
  const crack=newCrack();
  beams.push({grp,fin,vz:26,life:1.2, fx,fz, startX,startZ, dist:0, crack, lastCrackD:0, hitSet:new Set()});
}
// 新建一条空裂缝(逐段生长)
const CRACK_SEGS=22;                         // 3格的裂缝分段数
function newCrack(){
  const geo=new THREE.BufferGeometry();
  const pos=new Float32Array((CRACK_SEGS+1)*2*3);
  geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
  const idx=[];                              // 动态加索引(随生长)
  geo.setIndex(idx);
  const mat=new THREE.MeshBasicMaterial({color:0x140f0b,transparent:true,opacity:0.92,side:THREE.DoubleSide,depthWrite:false});
  mat.polygonOffset=true; mat.polygonOffsetFactor=-2; mat.polygonOffsetUnits=-2;
  const m=new THREE.Mesh(geo,mat); m.frustumCulled=false; scene.add(m);
  const c={mesh:m, geo, pos, filled:0, prevWob:0, age:0, growing:true};
  cracks.push(c);
  return c;
}
// 把裂缝延伸到位置(x,z)，沿方向(fx,fz)，写入下一段顶点
function growCrack(c, x, z, fx, fz){
  if(c.filled>CRACK_SEGS) return;
  const px=-fz, pz=fx;
  const wob=(Math.random()-0.5)*0.16 + c.prevWob*0.45; c.prevWob=wob;
  const mx=x+px*wob, mz=z+pz*wob;
  const w=0.045*(0.6+Math.random()*0.9);
  const i=c.filled;
  c.pos[i*6+0]=mx+px*w; c.pos[i*6+1]=0.03; c.pos[i*6+2]=mz+pz*w;
  c.pos[i*6+3]=mx-px*w; c.pos[i*6+4]=0.03; c.pos[i*6+5]=mz-pz*w;
  if(i>0){ const a=(i-1)*2,b=(i-1)*2+1,cc=i*2,d=i*2+1;
    const arr=c.geo.index.array? Array.from(c.geo.index.array):[];
    arr.push(a,b,cc, b,d,cc); c.geo.setIndex(arr);
  }
  c.geo.attributes.position.needsUpdate=true;
  c.filled++;
}
function updateBeams(dt){
  for(let i=beams.length-1;i>=0;i--){
    const b=beams[i];
    const step=b.vz*dt;
    b.grp.position.x+=b.fx*step; b.grp.position.z+=b.fz*step; b.dist+=step;
    b.life-=dt;
    b.fin.scale.y=1+0.06*Math.sin(performance.now()/35);
    beamHitByBeam(b);
    // 裂缝追踪剑气：每推进一小段就把裂缝长到当前位置(最多3格)
    const crackLen=GRID*3, segStep=crackLen/CRACK_SEGS;
    while(b.crack.growing && b.dist - b.lastCrackD >= segStep && b.crack.filled<=CRACK_SEGS){
      b.lastCrackD += segStep;
      growCrack(b.crack, b.startX+b.fx*b.lastCrackD, b.startZ+b.fz*b.lastCrackD, b.fx, b.fz);
      if(b.lastCrackD>=crackLen){ b.crack.growing=false; }
    }
    if(b.dist>=GRID*4 || b.life<=0){ if(b.crack) b.crack.growing=false; scene.remove(b.grp); beams.splice(i,1); }
  }
  // 裂缝：10秒保持，10→15秒淡出
  for(let i=cracks.length-1;i>=0;i--){
    const c=cracks[i]; c.age+=dt;
    if(c.age<10) c.mesh.material.opacity=0.9;
    else if(c.age<15) c.mesh.material.opacity=0.9*(1-(c.age-10)/5);
    else { scene.remove(c.mesh); cracks.splice(i,1); }
  }
}



// ============================================================
//  战争践踏(空中重击)：落地浅坑痕迹 + 溅射碎石 + 强震
//  痕迹保持10秒 → 10~15秒淡出消失；碎石溅射弹跳后静置，随痕迹一同消失
// ============================================================
const STOMP_R=3.2;                 // 践踏 AoE 半径
const stompMarks=[];               // {grp, mats:[{m,base}], bits:[...], age}
// 不规则坑形：抖动半径的闭合多边形(星形单调，不自交)
function irregularShape(baseR, jitter, n){
  const s=new THREE.Shape();
  for(let i=0;i<n;i++){
    const a=(i/n)*Math.PI*2, r=baseR*(1+(Math.random()-0.5)*jitter);
    const x=Math.sin(a)*r, z=Math.cos(a)*r;
    if(i===0) s.moveTo(x,z); else s.lineTo(x,z);
  }
  s.closePath(); return s;
}
// 一条不规则裂纹：从(x0,z0)沿ang走的折线，做成平铺地面的薄带(末端渐细)
function addCrack(grp, mat, x0, z0, ang, len){
  const segs=4+Math.floor(Math.random()*3);   // 4~6 段折线
  const pts=[]; let x=x0, z=z0, a=ang; const step=len/segs;
  for(let i=0;i<=segs;i++){ pts.push([x,z]); a+=(Math.random()-0.5)*0.9; x+=Math.sin(a)*step; z+=Math.cos(a)*step; }
  const pos=[], idx=[];
  for(let i=0;i<pts.length;i++){
    const px=pts[i][0], pz=pts[i][1];
    let dx,dz; if(i<pts.length-1){ dx=pts[i+1][0]-px; dz=pts[i+1][1]-pz; } else { dx=px-pts[i-1][0]; dz=pz-pts[i-1][1]; }
    const dl=Math.hypot(dx,dz)||1, nx=-dz/dl, nz=dx/dl;
    const w=(0.055+Math.random()*0.03)*(1-i/pts.length*0.55);   // 越往末端越细
    pos.push(px+nx*w,0.035,pz+nz*w, px-nx*w,0.035,pz-nz*w);
    if(i>0){ const a0=(i-1)*2; idx.push(a0,a0+1,a0+2, a0+1,a0+3,a0+2); }
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(pos),3));
  geo.setIndex(idx);
  grp.add(new THREE.Mesh(geo,mat));
}
function spawnCrater(cx,cz){
  const grp=new THREE.Group(); grp.position.set(cx,0,cz); scene.add(grp);
  const mats=[]; const reg=m=>{ mats.push({m,base:m.opacity}); return m; };
  // 外缘不规则坑(较大较亮：被震松的土)
  const rimMat=reg(new THREE.MeshBasicMaterial({color:0x3a2a1c,transparent:true,opacity:0.5,side:THREE.DoubleSide,depthWrite:false}));
  rimMat.polygonOffset=true; rimMat.polygonOffsetFactor=-1; rimMat.polygonOffsetUnits=-1;
  const rim=new THREE.Mesh(new THREE.ShapeGeometry(irregularShape(1.7,0.45,16)),rimMat); rim.rotation.x=-Math.PI/2; rim.position.y=0.03; grp.add(rim);
  // 内坑不规则(较小较暗：砸出的坑)
  const discMat=reg(new THREE.MeshBasicMaterial({color:0x120d0a,transparent:true,opacity:0.62,side:THREE.DoubleSide,depthWrite:false}));
  discMat.polygonOffset=true; discMat.polygonOffsetFactor=-2; discMat.polygonOffsetUnits=-2;
  const disc=new THREE.Mesh(new THREE.ShapeGeometry(irregularShape(1.1,0.5,16)),discMat); disc.rotation.x=-Math.PI/2; disc.position.y=0.032; grp.add(disc);
  // (裂痕线已按需求去掉；addCrack 函数保留备用，以后想要再调回来)
  return {grp,mats};
}
function spawnDebris(cx,cz){
  const bits=[];
  for(let i=0;i<11;i++){
    const s=0.07+Math.random()*0.13;
    const geo=(Math.random()<0.5)? new THREE.TetrahedronGeometry(s) : new THREE.BoxGeometry(s,s*0.8,s*1.1);
    const mat=new THREE.MeshStandardMaterial({color:0x6b5a44,roughness:0.95,transparent:true,opacity:1});
    const m=new THREE.Mesh(geo,mat); m.castShadow=true;
    const ang=Math.random()*Math.PI*2, sp=2.2+Math.random()*4.5;
    m.position.set(cx+Math.sin(ang)*0.3, 0.25, cz+Math.cos(ang)*0.3);
    m.rotation.set(Math.random()*6,Math.random()*6,Math.random()*6); scene.add(m);
    bits.push({mesh:m,mat, vx:Math.sin(ang)*sp, vy:4.5+Math.random()*4.5, vz:Math.cos(ang)*sp,
      sx:(Math.random()-0.5)*12, sy:(Math.random()-0.5)*12, sz:(Math.random()-0.5)*12, rest:s*0.5+0.02, settled:false});
  }
  return bits;
}
function doStomp(){
  SFX.stomp();
  hitstop=Math.max(hitstop,0.12); shake=Math.max(shake,0.45);     // 强顿帧 + 大震屏
  const cr=spawnCrater(P.x,P.z); const bits=spawnDebris(P.x,P.z);
  stompMarks.push({grp:cr.grp, mats:cr.mats, bits, age:0});
  // 周身 radial AoE 判定
  for(const o of hittables){ const dx=o.x-P.x, dz=o.z-P.z; if(Math.hypot(dx,dz)<STOMP_R+o.r){ o.flashT=0.2; o.shakeT=0.28; } }
  for(const d of dummies){ const dx=d.x-P.x, dz=d.z-P.z; if(Math.hypot(dx,dz)<STOMP_R+d.r){ d.flashT=0.3; d.tiltVel+=12; } }
}
function updateStomps(dt){
  for(let i=stompMarks.length-1;i>=0;i--){
    const s=stompMarks[i]; s.age+=dt;
    // 碎石物理：溅射 → 弹跳 → 静置
    for(const b of s.bits){
      if(!b.settled){
        b.vy-=22*dt;
        b.mesh.position.x+=b.vx*dt; b.mesh.position.y+=b.vy*dt; b.mesh.position.z+=b.vz*dt;
        b.mesh.rotation.x+=b.sx*dt; b.mesh.rotation.y+=b.sy*dt; b.mesh.rotation.z+=b.sz*dt;
        if(b.mesh.position.y<=b.rest){
          b.mesh.position.y=b.rest;
          if(Math.abs(b.vy)<1.6){ b.settled=true; b.vx=b.vz=0; b.sx=b.sy=b.sz=0; }
          else { b.vy=-b.vy*0.4; b.vx*=0.55; b.vz*=0.55; b.sx*=0.5; b.sy*=0.5; b.sz*=0.5; }
        }
      }
    }
    // 痕迹 + 碎石淡出：10秒保持，10~15秒渐隐
    let op=1; if(s.age>=10) op=Math.max(0,1-(s.age-10)/5);
    for(const e of s.mats) e.m.opacity=e.base*op;
    for(const b of s.bits) b.mat.opacity=op;
    if(s.age>=15){ scene.remove(s.grp); for(const b of s.bits) scene.remove(b.mesh); stompMarks.splice(i,1); }
  }
}

// ============================================================
//  关键帧动画系统（加动作=加数据表）
//  约定：肘=负值朝前弯；膝=正值朝后弯
// ============================================================
const JOINTS={ shoR:RArm.root, elbR:RArm.j2, shoL:LArm.root, elbL:LArm.j2,
  hipR:RLeg.root, kneeR:RLeg.j2, hipL:LLeg.root, kneeL:LLeg.j2, chest:chest, head:headGrp, wristR:rWrist };
function resetJoints(){ for(const k in JOINTS){ JOINTS[k].rotation.set(0,0,0); } }
const CLIPS={
  // ===== 地面轻击三连（全身发力链：蹬腿→沉胯核心拧转→抬身带臂）=====
  // L1 向左挥：左腿弓步前蹲沉身、右腿后蹬，核心右拧前倾蓄势 → 蹬地抬身、向左猛拧挥砍 → 定格
  gL1:{ dur:0.50, tracks:{
    // 身体：先下沉前倾蓄势(bodyY负/lean正) → 发力时抬起(bodyY回升/lean减) → 定格
    bodyY:[{t:0,v:0},{t:0.13,v:-0.34},{t:0.22,v:-0.12},{t:0.50,v:-0.14}],
    bodyLean:[{t:0,v:0.12},{t:0.13,v:0.72},{t:0.22,v:0.28},{t:0.50,v:0.30}],
    chestX:[{t:0,v:0.1},{t:0.13,v:0.45},{t:0.22,v:0.2},{t:0.50,v:0.22}],
    // 核心拧转：右拧蓄势 → 猛地左拧
    chestY:[{t:0,v:0.1},{t:0.13,v:0.95},{t:0.22,v:-1.0},{t:0.50,v:-0.92}],
    // 左腿大弓步前屈(髋前抬+深屈膝)
    hipL:[{t:0,x:0},{t:0.13,x:-1.25},{t:0.22,x:-0.85},{t:0.50,x:-0.75}],
    kneeL:[{t:0,x:0.1},{t:0.13,x:1.55},{t:0.22,x:1.15},{t:0.50,x:1.05}],
    // 右腿向后蹬直
    hipR:[{t:0,x:0},{t:0.13,x:0.55},{t:0.22,x:0.4},{t:0.50,x:0.36}],
    kneeR:[{t:0,x:0.1},{t:0.13,x:0.2},{t:0.50,x:0.15}],
    // 右臂：举右后蓄势 → 大幅扫向左前 → 定格(收向胸前时肘趋近160°,基本伸直)；起手放低到胸口
    shoR:[{t:0,x:0.15,z:0.6},{t:0.13,x:-1.95,z:1.4},{t:0.22,x:-1.6,z:-1.05},{t:0.50,x:-1.55,z:-1.0}],
    elbR:[{t:0,x:-0.5},{t:0.13,x:-0.2},{t:0.22,x:-0.32},{t:0.50,x:-0.35}],
    elbL:[{t:0,x:-0.9},{t:0.13,x:-1.1},{t:0.22,x:-0.85},{t:0.50,x:-0.8}],
    shoL:[{t:0,x:0.2,z:-0.9},{t:0.13,x:0.4,z:-1.1},{t:0.22,x:-0.3,z:-0.55},{t:0.50,x:-0.28,z:-0.5}],
    // 挥剑时改成枪式握剑(剑沿小臂延长线)，取代原来的转手腕
    gripMode:[{t:0,v:0},{t:0.13,v:1},{t:0.50,v:1}],
  }},
  // L2 向右挥：起手帧接续L1收尾姿势(手在左/躯干左拧)，不回拉，直接向右猛砍
  // L2 参考Q-B:0.53秒,弓步更深,前倾更大,手臂幅度更大,动作完整不打折
  gL2:{ dur:0.53, tracks:{
    bodyY:[{t:0,v:-0.14},{t:0.13,v:-0.22},{t:0.22,v:-0.12},{t:0.53,v:-0.14}],
    bodyLean:[{t:0,v:0.20},{t:0.13,v:0.44},{t:0.22,v:0.22},{t:0.53,v:0.26}],
    chestX:[{t:0,v:0.12},{t:0.13,v:0.36},{t:0.22,v:0.18},{t:0.53,v:0.20}],
    // 核心向右猛拧(全程不停顿,幅度到底)
    chestY:[{t:0,v:-0.92},{t:0.22,v:1.05,e:'in'},{t:0.53,v:0.95}],
    // 腿更深的弓步桩
    hipL:[{t:0,x:-0.75},{t:0.13,x:-0.82},{t:0.22,x:-0.72},{t:0.53,x:-0.78}],
    kneeL:[{t:0,x:1.05},{t:0.13,x:1.14},{t:0.22,x:1.02},{t:0.53,x:1.08}],
    hipR:[{t:0,x:0.42},{t:0.13,x:0.48},{t:0.22,x:0.38},{t:0.53,x:0.42}],
    kneeR:[{t:0,x:0.18},{t:0.53,x:0.18}],
    // 右臂:幅度拉满,从左下大幅扫向右上
    shoR:[{t:0,x:-1.55,z:-1.0},{t:0.22,x:-0.75,z:1.55,e:'in'},{t:0.53,x:-0.75,z:1.55}],
    elbR:[{t:0,x:-0.45},{t:0.22,x:-0.38},{t:0.53,x:-0.4}],
    shoL:[{t:0,x:-0.35,z:-0.3},{t:0.13,x:-0.3,z:-0.35},{t:0.22,x:0.55,z:0.45},{t:0.53,x:0.50,z:0.4}],
    elbL:[{t:0,x:-0.8},{t:0.22,x:-0.6},{t:0.53,x:-0.65}],
    gripMode:[{t:0,v:1},{t:0.53,v:1}],
  }},
  // L3 大劈(扔实心球式全力一击)：起手→慢动作举顶(减速)→顶点定格→猛砸→砸地停顿→起身
  // 节奏: 0-.20起手 / .20-.54慢举到顶(ease out) / .54-.64顶点停 / .64-.72猛砸(ease in) / .72后砸地停顿
  gL3:{ dur:1.06, tracks:{
    // 身体高度：起手踮脚拔高 → 顶点保持 → 砸下大幅下沉深蹲
    bodyY:[{t:0,v:-0.14},{t:0.20,v:0.06},{t:0.54,v:0.14,e:'out'},{t:0.64,v:0.14},{t:0.72,v:-0.42,e:'in'},{t:1.06,v:-0.40}],
    // 前后倾：后仰举顶蓄势(减速) → 顶点停 → 砸下猛地前倾(加速)
    bodyLean:[{t:0,v:0.16},{t:0.20,v:-0.2},{t:0.54,v:-0.5,e:'out'},{t:0.64,v:-0.5},{t:0.72,v:0.62,e:'in'},{t:1.06,v:0.56}],
    chestX:[{t:0,v:0},{t:0.20,v:-0.25},{t:0.54,v:-0.55,e:'out'},{t:0.64,v:-0.55},{t:0.72,v:0.7,e:'in'},{t:1.06,v:0.66}],
    // 右臂：慢慢举到最高(减速) → 顶点停留 → 猛地下砸(加速)；砸到身前小腹位置(x前下方,z收中线)
    shoR:[{t:0,x:-1.0,z:0},{t:0.20,x:-2.2,z:0.05},{t:0.54,x:-3.2,z:0.05,e:'out'},{t:0.64,x:-3.22,z:0.05},{t:0.72,x:-0.7,z:0.4,e:'in'},{t:1.06,x:-0.7,z:0.4}],
    elbR:[{t:0,x:-0.6},{t:0.54,x:-0.15,e:'out'},{t:0.64,x:-0.15},{t:0.72,x:-0.1,e:'in'},{t:1.06,x:-0.12}],
    // 左手：只举到与地面大致平行(峰值-1.4)，下砸时往身后摆(正值=身后)
    shoL:[{t:0,x:-0.3},{t:0.20,x:-1.05},{t:0.54,x:-1.4,e:'out'},{t:0.64,x:-1.4},{t:0.72,x:0.9,e:'in'},{t:1.06,x:0.85}],
    elbL:[{t:0,x:-0.3},{t:0.54,x:-0.2,e:'out'},{t:0.72,x:-0.3,e:'in'},{t:1.06,x:-0.3}],
    // 腿：起手伸直拔高(收到右腿站立) → 砸下左腿弓步半蹲、右腿后蹬
    hipL:[{t:0,x:-0.62},{t:0.20,x:-0.1},{t:0.54,x:-0.08,e:'out'},{t:0.64,x:-0.08},{t:0.72,x:-0.78,e:'in'},{t:1.06,x:-0.72}],
    kneeL:[{t:0,x:0.9},{t:0.20,x:0.08},{t:0.54,x:0.05,e:'out'},{t:0.64,x:0.05},{t:0.72,x:1.05,e:'in'},{t:1.06,x:1.0}],
    hipR:[{t:0,x:0.36},{t:0.20,x:0.05},{t:0.54,x:0.03,e:'out'},{t:0.64,x:0.03},{t:0.72,x:0.5,e:'in'},{t:1.06,x:0.46}],
    kneeR:[{t:0,x:0.15},{t:0.20,x:0.04},{t:0.72,x:0.2,e:'in'},{t:1.06,x:0.18}],
  }},
  // L3 起身收势（从砸地深蹲站直）
  gL3_recover:{ dur:0.34, tracks:{
    bodyY:[{t:0,v:-0.40},{t:0.34,v:0,e:'out'}], bodyLean:[{t:0,v:0.56},{t:0.34,v:0,e:'out'}],
    chestX:[{t:0,v:0.66},{t:0.34,v:0}],
    shoR:[{t:0,x:0.6},{t:0.34,x:0}], shoL:[{t:0,x:0.48},{t:0.34,x:0}],
    hipL:[{t:0,x:-0.72},{t:0.34,x:0}], kneeL:[{t:0,x:1.0},{t:0.34,x:0}],
    hipR:[{t:0,x:0.46},{t:0.34,x:0}], kneeR:[{t:0,x:0.18},{t:0.34,x:0}],
  }},

  aDrill:{ dur:0.25, tracks:{ // 旋风坠
    bodyLean:[{t:0,v:0.9},{t:0.25,v:1.5}],chestX:[{t:0,v:0.6},{t:0.25,v:0.95}],
    shoR:[{t:0,x:-2.8,z:0.05},{t:0.25,x:-3.0,z:0.05}],
    shoL:[{t:0,x:-2.8,z:-0.05},{t:0.25,x:-3.0,z:-0.05}],
    elbR:[{t:0,x:-0.06},{t:0.25,x:-0.04}],elbL:[{t:0,x:-0.06},{t:0.25,x:-0.04}],
    hipR:[{t:0,x:-0.2},{t:0.25,x:-0.15}],hipL:[{t:0,x:-0.2},{t:0.25,x:-0.15}],
    kneeR:[{t:0,x:0.08},{t:0.25,x:0.06}],kneeL:[{t:0,x:0.08},{t:0.25,x:0.06}],
    gripMode:[{t:0,v:1},{t:0.25,v:1}],
  }},
  aJupiter:{ dur:0.75, tracks:{
    // 0~0.12 后仰起手(参考aChop), 0.12~0.22 快速收体, 0.22+ 紧球(跳水前空翻)
    bodyLean:[{t:0,v:-0.48},{t:0.12,v:-0.48},{t:0.22,v:0,e:'out'},{t:0.75,v:0}],
    bodyY:[{t:0.22,v:-0.32},{t:0.75,v:-0.32}],
    chestX:[{t:0,v:-0.28},{t:0.12,v:-0.30},{t:0.22,v:0.55,e:'out'},{t:0.75,v:0.55}],
    shoR:[{t:0,x:-3.05,z:0.05},{t:0.12,x:-3.05,z:0.05},{t:0.22,x:-1.6,z:0,e:'out'},{t:0.75,x:-1.6,z:0}],
    elbR:[{t:0,x:-0.15},{t:0.22,x:-1.7,e:'out'},{t:0.75,x:-1.7}],
    shoL:[{t:0,x:-1.8},{t:0.12,x:-1.8},{t:0.22,x:-1.6,e:'out'},{t:0.75,x:-1.6}],
    elbL:[{t:0,x:-0.3},{t:0.22,x:-1.7,e:'out'},{t:0.75,x:-1.7}],
    hipR:[{t:0,x:0.3},{t:0.22,x:-2.1,e:'out'},{t:0.75,x:-2.1}],
    hipL:[{t:0,x:-0.5},{t:0.22,x:-2.1,e:'out'},{t:0.75,x:-2.1}],
    kneeR:[{t:0,x:0.35},{t:0.22,x:2.0,e:'out'},{t:0.75,x:2.0}],
    kneeL:[{t:0,x:0.8},{t:0.22,x:2.0,e:'out'},{t:0.75,x:2.0}],
    gripMode:[{t:0,v:1},{t:0.75,v:1}],
  }},
  aJupiterLand:{ dur:0.65, tracks:{
    bodyY:[{t:0,v:-0.88},{t:0.28,v:-0.85},{t:0.65,v:0,e:'out'}],
    bodyLean:[{t:0,v:0.65},{t:0.28,v:0.62},{t:0.65,v:0,e:'out'}],
    chestX:[{t:0,v:0.4},{t:0.28,v:0.38},{t:0.65,v:0}],
    shoR:[{t:0,x:0.5,z:-0.8},{t:0.28,x:0.5,z:-0.8},{t:0.65,x:0,z:0}],
    elbR:[{t:0,x:-0.05},{t:0.28,x:-0.05},{t:0.65,x:-0.3}],
    shoL:[{t:0,x:-1.1,z:0.5},{t:0.28,x:-1.1,z:0.5},{t:0.65,x:0,z:0}],
    elbL:[{t:0,x:-0.4},{t:0.28,x:-0.4},{t:0.65,x:-0.3}],
    hipL:[{t:0,x:-1.05},{t:0.28,x:-1.02},{t:0.65,x:0,e:'out'}],
    kneeL:[{t:0,x:1.45},{t:0.28,x:1.42},{t:0.65,x:0,e:'out'}],
    hipR:[{t:0,x:0.72},{t:0.28,x:0.70},{t:0.65,x:0,e:'out'}],
    kneeR:[{t:0,x:0.12},{t:0.28,x:0.10},{t:0.65,x:0,e:'out'}],
  }},

  // 飞踹镜像膝击(gKnee):右腿踢,是dKick的左右镜像
  gKnee:{ dur:0.68, tracks:{
    // 蓄势:像践踏一样深蹲核心收紧 → 爆发膝踢
    bodyY:[{t:0,v:0},{t:0.06,v:0},{t:0.16,v:-0.62,e:'out'},{t:0.30,v:0.18,e:'in'},{t:0.50,v:0.02},{t:0.68,v:0}],
    bodyLean:[{t:0,v:0.2},{t:0.06,v:0.22},{t:0.16,v:0.72,e:'out'},{t:0.30,v:-0.04,e:'in'},{t:0.50,v:-0.04},{t:0.68,v:0}],
    bodyYaw:[{t:0,v:0.2},{t:0.14,v:0.55},{t:0.30,v:1.04,e:'in'},{t:0.50,v:1.04},{t:0.68,v:0}],
    bodySide:[{t:0,v:0},{t:0.14,v:-0.08},{t:0.30,v:-0.28,e:'in'},{t:0.50,v:-0.28},{t:0.68,v:0}],
    chestX:[{t:0,v:0.6},{t:0.14,v:0.75,e:'out'},{t:0.30,v:-0.38,e:'in'},{t:0.50,v:-0.38},{t:0.68,v:0}],
    chestY:[{t:0,v:-0.5},{t:0.34,v:-0.10},{t:0.50,v:-0.10},{t:0.68,v:0}],
    chestZ:[{t:0,v:0},{t:0.34,v:-0.14},{t:0.50,v:-0.14},{t:0.68,v:0}],
    shoR:[{t:0,x:-0.5,z:-0.5},{t:0.34,x:-0.34,y:-0.78,z:-0.74},{t:0.50,x:-0.34,y:-0.78,z:-0.74},{t:0.68,x:0,y:0,z:0}],
    elbR:[{t:0,x:-0.5},{t:0.34,x:-0.58},{t:0.50,x:-0.58},{t:0.68,x:-0.3}],
    shoL:[{t:0,x:-0.3,z:0.2},{t:0.16,x:-0.6,z:0.1},{t:0.34,x:-0.84,y:-0.76,z:-0.22},{t:0.50,x:-0.84,y:-0.76,z:-0.22},{t:0.68,x:0,y:0,z:0}],
    elbL:[{t:0,x:-0.5},{t:0.34,x:-1.16},{t:0.50,x:-1.16},{t:0.68,x:-0.3}],
    hipR:[{t:0,x:0.36},{t:0.16,x:-1.0,z:-0.4},{t:0.34,x:-1.68,y:0.12,z:-0.84,e:'in'},{t:0.50,x:-1.68,y:0.12,z:-0.84},{t:0.68,x:0,y:0,z:0}],
    kneeR:[{t:0,x:0.15},{t:0.16,x:1.6},{t:0.34,x:2.32,e:'in'},{t:0.50,x:2.30},{t:0.68,x:0.1}],
    hipL:[{t:0,x:-0.62},{t:0.34,x:0.06,y:0.50,z:0.24},{t:0.50,x:0.06,y:0.50,z:0.24},{t:0.68,x:0,y:0,z:0}],
    kneeL:[{t:0,x:0.9},{t:0.34,x:0},{t:0.68,x:0}],
    gripMode:[{t:0,v:1},{t:0.68,v:1}],
  }},

  // ===== 重击系列 =====
  // 突刺（L→重）：接轻击的拧向继续拧到~90°(T-pose+扩胸折肘蓄势) → 飞速窜出完整T-pose突刺 → 滑停
  // 节奏: 0-0.36蓄力 / 0.36-0.44炸出突刺(ease in) / 0.44后定格(长距离滑行减速)
  gThrust:{ dur:0.80, tracks:{
    gripMode:[{t:0,v:1},{t:0.80,v:1}],                                   // 全程枪式握剑
    // 上半身：接续轻击的左拧，继续拧到~90°蓄势 → 瞬间猛甩到右90°(T-pose朝右)
    chestY:[{t:0,v:-0.3},{t:0.22,v:-1.5},{t:0.36,v:-1.62,e:'out'},{t:0.44,v:1.5,e:'in'},{t:0.80,v:1.4}],
    bodyY:[{t:0,v:-0.1},{t:0.36,v:-0.14},{t:0.44,v:-0.5,e:'in'},{t:0.80,v:-0.46}],
    bodyLean:[{t:0,v:0.1},{t:0.36,v:0.05},{t:0.44,v:0.28,e:'in'},{t:0.80,v:0.26}],
    // 右臂：蓄力=大臂侧平举(T-pose,z≈-1.5)+小臂折胸前(肘≈-2.4) → 突刺=大臂保持平举、小臂伸直(肘≈0)
    shoR:[{t:0,x:-0.6,z:-0.8},{t:0.22,x:0,z:-1.5},{t:0.36,x:0,z:-1.52,e:'out'},{t:0.44,x:0,z:-1.5,e:'in'},{t:0.80,x:0,z:-1.5}],
    elbR:[{t:0,x:-1.4},{t:0.22,x:-2.4},{t:0.36,x:-2.45,e:'out'},{t:0.44,x:-0.05,e:'in'},{t:0.80,x:-0.05}],
    // 左臂：蓄力=大臂侧平举(另一侧,z≈+1.5)+小臂折胸前 → 突刺=伸直
    shoL:[{t:0,x:-0.4,z:0.8},{t:0.22,x:0,z:1.5},{t:0.36,x:0,z:1.52,e:'out'},{t:0.44,x:0,z:1.5,e:'in'},{t:0.80,x:0,z:1.5}],
    elbL:[{t:0,x:-1.2},{t:0.22,x:-2.2},{t:0.36,x:-2.25,e:'out'},{t:0.44,x:-0.05,e:'in'},{t:0.80,x:-0.05}],
    // 腿：蓄力沿用左弓步桩 → 突刺时左脚在前、右脚后蹬的极低弓步(镜像)
    hipR:[{t:0,x:0.36},{t:0.36,x:0.36},{t:0.44,x:0.5,e:'in'},{t:0.80,x:0.46}],
    kneeR:[{t:0,x:0.15},{t:0.36,x:0.15},{t:0.44,x:0.25,e:'in'},{t:0.80,x:0.2}],
    hipL:[{t:0,x:-0.62},{t:0.36,x:-0.62},{t:0.44,x:-1.0,e:'in'},{t:0.80,x:-0.92}],
    kneeL:[{t:0,x:0.9},{t:0.36,x:0.9},{t:0.44,x:1.2,e:'in'},{t:0.80,x:1.15}],
  }},
  gThrust_recover:{ dur:0.26, tracks:{
    gripMode:[{t:0,v:1},{t:0.26,v:0}],
    chestY:[{t:0,v:1.4},{t:0.26,v:0}], bodyY:[{t:0,v:-0.46},{t:0.26,v:0}], bodyLean:[{t:0,v:0.26},{t:0.26,v:0}],
    shoR:[{t:0,x:0,z:-1.5},{t:0.26,x:0,z:0}], elbR:[{t:0,x:-0.05},{t:0.26,x:-0.3}],
    shoL:[{t:0,x:0,z:1.5},{t:0.26,x:0,z:0}], elbL:[{t:0,x:-0.05},{t:0.26,x:-0.2}],
    hipR:[{t:0,x:0.46},{t:0.26,x:0}], kneeR:[{t:0,x:0.2},{t:0.26,x:0}],
    hipL:[{t:0,x:-0.92},{t:0.26,x:0}], kneeL:[{t:0,x:1.15},{t:0.26,x:0}],
  }},
  // 顺发蓄力重击（LL→重）：大力劈砸
  gFollowHeavy:{ dur:0.40, tracks:{
    chestX:[{t:0,v:-0.6},{t:0.18,v:-0.7},{t:0.30,v:0.6},{t:0.40,v:0.4}],
    shoR:[{t:0,x:-3.0,z:-0.3},{t:0.18,x:-3.1},{t:0.30,x:0.5},{t:0.40,x:0.6}],
    elbR:[{t:0,x:-0.3},{t:0.18,x:-0.4},{t:0.30,x:-0.1}],
    shoL:[{t:0,x:-0.5},{t:0.30,x:0.3},{t:0.40,x:0.2}],
    hipR:[{t:0,x:-0.3},{t:0.30,x:0.3},{t:0.40,x:0.2}],
  }},
  gFollowHeavy_recover:{ dur:0.30, tracks:{
    chestX:[{t:0,v:0.4},{t:0.30,v:0}], shoR:[{t:0,x:0.6},{t:0.30,x:0}], hipR:[{t:0,x:0.2},{t:0.30,x:0}],
  }},
  // 顺发重击×2（LLL→重）：连续两次劈砸，中间无僵直，第二发后僵直
  gHeavyA:{ dur:0.34, tracks:{
    chestX:[{t:0,v:-0.5},{t:0.14,v:-0.6},{t:0.26,v:0.5},{t:0.34,v:0.2}],
    shoR:[{t:0,x:-2.8},{t:0.14,x:-3.0},{t:0.26,x:0.3},{t:0.34,x:0.2}],
    shoL:[{t:0,x:-0.4},{t:0.26,x:0.2},{t:0.34,x:0.1}],
  }},
  gHeavyB:{ dur:0.40, tracks:{
    chestX:[{t:0,v:-0.6},{t:0.18,v:-0.7},{t:0.30,v:0.6},{t:0.40,v:0.4}],
    shoR:[{t:0,x:-3.1,z:0.2},{t:0.18,x:-3.2},{t:0.30,x:0.5},{t:0.40,x:0.6}],
    shoL:[{t:0,x:-0.5},{t:0.30,x:0.3},{t:0.40,x:0.2}],
    hipR:[{t:0,x:-0.3},{t:0.30,x:0.35},{t:0.40,x:0.25}],
  }},
  gHeavyB_recover:{ dur:0.34, tracks:{
    chestX:[{t:0,v:0.4},{t:0.34,v:0}], shoR:[{t:0,x:0.6},{t:0.34,x:0}], hipR:[{t:0,x:0.25},{t:0.34,x:0}],
  }},
  // 独立蓄力重击（从idle长按右键）：保留
  heavyAttack:{ dur:0.50, tracks:{
    chestX:[{t:0,v:-0.55},{t:0.28,v:-0.65},{t:0.40,v:0.55},{t:0.50,v:0}],
    shoR:[{t:0,x:-3.0},{t:0.28,x:-3.15},{t:0.40,x:0.4},{t:0.50,x:0}],
    elbR:[{t:0,x:-0.3},{t:0.28,x:-0.4},{t:0.40,x:-0.1},{t:0.50,x:-0.3}],
    shoL:[{t:0,x:0.4},{t:0.40,x:-0.3},{t:0.50,x:0}],
    hipR:[{t:0,x:-0.3},{t:0.40,x:0.3},{t:0.50,x:0}],
  }},
  // 大风车（重击按一次）：蓄力上发条(左脚前弓步收紧) → 爆发360°横扫(双臂展开) → 结束停顿
  // 节奏: 0-0.26蓄力收紧(身体左转上发条) / 0.26-0.50爆发旋转 / 0.50-0.62结束停顿
  gSpin:{ dur:0.62, tracks:{
    gripMode:[{t:0,v:1},{t:0.62,v:1}],          // 全程枪式握剑
    // 身体：蓄力左转前倾收紧(上发条) → 爆发(旋转由body.rotation.y驱动)
    chestY:[{t:0,v:0.2},{t:0.20,v:0.55,e:'out'},{t:0.26,v:0.6},{t:0.30,v:0}],
    bodyY:[{t:0,v:-0.05},{t:0.20,v:-0.28,e:'out'},{t:0.26,v:-0.3},{t:0.34,v:-0.12},{t:0.62,v:-0.04}],
    bodyLean:[{t:0,v:0.1},{t:0.20,v:0.3,e:'out'},{t:0.26,v:0.32},{t:0.34,v:0.06},{t:0.62,v:0.05}],
    // —— 蓄力段(0~0.26): 右手抬胸前肘内拐(篮球顶人) / 左手大臂后撤肘收紧(刺拳预备) ——
    // —— 爆发段(0.26~0.50): 双臂舒展打开(船头式) ——
    shoR:[{t:0,x:-0.9,z:0.3},{t:0.20,x:-1.0,z:0.35,e:'out'},{t:0.26,x:-1.0,z:0.35},{t:0.34,x:-0.15,z:-1.38,e:'in'},{t:0.50,x:-0.15,z:-1.38},{t:0.62,x:-0.15,z:-1.38}],
    elbR:[{t:0,x:-1.7},{t:0.26,x:-1.75},{t:0.34,x:-0.12,e:'in'},{t:0.62,x:-0.12}],   // 蓄力肘内拐折紧→爆发伸直
    shoL:[{t:0,x:-1.2,z:0.2},{t:0.20,x:-1.4,z:0.2,e:'out'},{t:0.26,x:-1.4,z:0.2},{t:0.34,x:-0.15,z:1.38,e:'in'},{t:0.50,x:-0.15,z:1.38},{t:0.62,x:-0.15,z:1.38}],
    elbL:[{t:0,x:-2.3},{t:0.26,x:-2.35},{t:0.34,x:-0.12,e:'in'},{t:0.62,x:-0.12}],   // 左手肘完全收紧→爆发展开
    // 腿：蓄力=左脚前深屈弓步+右脚后蹬(同突刺结束) → 爆发踢踏交叉步 → 收回
    hipL:[{t:0,x:-0.92},{t:0.26,x:-0.92},{t:0.34,x:-0.2,z:0.5,e:'in'},{t:0.44,x:-0.15,z:-0.5},{t:0.62,x:0,z:0}],
    kneeL:[{t:0,x:1.15},{t:0.26,x:1.15},{t:0.34,x:0.5,e:'in'},{t:0.44,x:0.4},{t:0.62,x:0.1}],
    hipR:[{t:0,x:0.46},{t:0.26,x:0.46},{t:0.34,x:-0.2,z:-0.5,e:'in'},{t:0.44,x:-0.15,z:0.5},{t:0.62,x:0,z:0}],
    kneeR:[{t:0,x:0.2},{t:0.26,x:0.2},{t:0.34,x:0.4,e:'in'},{t:0.44,x:0.5},{t:0.62,x:0.1}],
  }},
  gSpin_recover:{ dur:0.18, tracks:{
    gripMode:[{t:0,v:1},{t:0.18,v:0}],
    shoR:[{t:0,x:-0.2,z:-1.0},{t:0.18,x:0,z:0}], shoL:[{t:0,x:-0.2,z:1.0},{t:0.18,x:0,z:0}],
    bodyY:[{t:0,v:-0.04},{t:0.18,v:0}],
  }},
  // 蓄满大风车收尾：半蹲、双臂松垮、身体大幅画圈摇晃(转晕了)；僵直更长
  gSpinCharged_recover:{ dur:1.2, tracks:{
    gripMode:[{t:0,v:1},{t:1.2,v:0}],
    shoR:[{t:0,x:-0.1,z:-0.5},{t:1.2,x:0,z:0}], shoL:[{t:0,x:-0.1,z:0.5},{t:1.2,x:0,z:0}],
    elbR:[{t:0,x:-0.5},{t:1.2,x:-0.3}], elbL:[{t:0,x:-0.5},{t:1.2,x:-0.3}],
    bodyY:[{t:0,v:-0.16},{t:0.6,v:-0.14},{t:1.2,v:0}],   // 半蹲→站直
    // 身体大幅顺时针画圈摇晃: 前→右→后→左 (chestX前后 + chestZ左右, 相位错开成圆)
    chestX:[{t:0,v:0.35},{t:0.3,v:0},{t:0.6,v:-0.35},{t:0.9,v:0},{t:1.2,v:0}],
    chestZ:[{t:0,v:0},{t:0.3,v:0.35},{t:0.6,v:0},{t:0.9,v:-0.35},{t:1.2,v:0}],
    head:[{t:0,x:0.25,z:0.3},{t:0.3,x:0,z:0.3},{t:0.6,x:-0.2,z:0},{t:0.9,x:0,z:-0.3},{t:1.2,x:0,z:0}],
  }},

  // ===== 空中招式 =====
  // 空轻1/2：滞空横挥
  aL1:{ dur:0.28, tracks:{
    chestY:[{t:0,v:0.6},{t:0.12,v:0.6},{t:0.20,v:-0.8},{t:0.28,v:-0.2}],
    shoR:[{t:0,x:-0.6,z:1.1},{t:0.12,x:-1.6,z:1.1},{t:0.20,x:-1.4,z:-0.9},{t:0.28,x:-0.4,z:0}],
    elbR:[{t:0,x:-0.5},{t:0.12,x:-0.2},{t:0.28,x:-0.4}],
  }},
  aL2:{ dur:0.28, tracks:{
    chestY:[{t:0,v:-0.7},{t:0.12,v:-0.8},{t:0.20,v:0.9},{t:0.28,v:0.2}],
    shoR:[{t:0,x:-1.5,z:-0.8},{t:0.12,x:-1.7,z:-0.9},{t:0.20,x:-1.4,z:1.1},{t:0.28,x:-0.4,z:0}],
    elbR:[{t:0,x:-0.4},{t:0.12,x:-0.2},{t:0.28,x:-0.4}],
  }},
  // 空中第二下大劈：①0~0.25 跳远式滞空(左腿高抬/右腿垂直下蹬/躯干后仰/右手举剑过头) ②0.25~0.42 猛砸到中线(落点对齐 gL3)
  aChop:{ dur:0.42, tracks:{
    bodyLean:[{t:0,v:-0.5},{t:0.25,v:-0.5},{t:0.42,v:0.55,e:'in'}],
    chestX:[{t:0,v:-0.25},{t:0.25,v:-0.3},{t:0.42,v:0.62,e:'in'}],
    shoR:[{t:0,x:-3.05,z:0.05},{t:0.25,x:-3.15,z:0.05},{t:0.42,x:-0.7,z:0.4,e:'in'}],
    elbR:[{t:0,x:-0.15},{t:0.42,x:-0.12,e:'in'}],
    shoL:[{t:0,x:-1.8},{t:0.25,x:-1.7},{t:0.42,x:0.85,e:'in'}],
    elbL:[{t:0,x:-0.3},{t:0.42,x:-0.2}],
    // 左腿高抬腿(髋前抬+屈膝) → 落成弓步前撑
    hipL:[{t:0,x:-1.2},{t:0.25,x:-1.2},{t:0.42,x:-0.72,e:'in'}],
    kneeL:[{t:0,x:1.3},{t:0.25,x:1.3},{t:0.42,x:1.0,e:'in'}],
    // 右腿垂直下蹬(基本直) → 后蹬
    hipR:[{t:0,x:0.05},{t:0.25,x:0.05},{t:0.42,x:0.46,e:'in'}],
    kneeR:[{t:0,x:0.0},{t:0.25,x:0.0},{t:0.42,x:0.18,e:'in'}],
  }},
  // 空中第二下落地：保持砸地深蹲(停顿~0.2s,增强力量感) → 起身收势(对齐地面大劈 gL3 落点)
  aChopLand:{ dur:0.50, tracks:{
    bodyY:[{t:0,v:-0.42},{t:0.20,v:-0.42},{t:0.50,v:0,e:'out'}],
    bodyLean:[{t:0,v:0.56},{t:0.20,v:0.54},{t:0.50,v:0,e:'out'}],
    chestX:[{t:0,v:0.66},{t:0.20,v:0.6},{t:0.50,v:0}],
    shoR:[{t:0,x:-0.7,z:0.4},{t:0.20,x:-0.62,z:0.34},{t:0.50,x:0,z:0}],
    elbR:[{t:0,x:-0.12},{t:0.50,x:-0.2}],
    shoL:[{t:0,x:0.85},{t:0.20,x:0.7},{t:0.50,x:0}],
    hipL:[{t:0,x:-0.72},{t:0.20,x:-0.72},{t:0.50,x:0}], kneeL:[{t:0,x:1.0},{t:0.20,x:1.0},{t:0.50,x:0}],
    hipR:[{t:0,x:0.46},{t:0.20,x:0.46},{t:0.50,x:0}], kneeR:[{t:0,x:0.18},{t:0.20,x:0.18},{t:0.50,x:0}],
  }},
  // 空轻3：直接砸下 → 落地单膝跪地把木棍插地
  aPlunge:{ dur:0.30, tracks:{
    chestX:[{t:0,v:-0.5},{t:0.12,v:-0.6},{t:0.30,v:0.7}],
    shoR:[{t:0,x:-2.8},{t:0.12,x:-3.0},{t:0.30,x:0.9}],   // 高举→插地前下方
    elbR:[{t:0,x:-0.3},{t:0.30,x:-0.1}],
  }},
  // 插地僵直：单膝跪、木棍插地 → 站起来拔木棍
  aPlunge_stiff:{ dur:0.5, tracks:{
    chestX:[{t:0,v:0.7},{t:0.3,v:0.6},{t:0.5,v:0}],
    shoR:[{t:0,x:0.9},{t:0.3,x:0.7},{t:0.5,x:0}],          // 拔棍上提
    hipR:[{t:0,x:1.4},{t:0.35,x:1.3},{t:0.5,x:0}],         // 单膝跪→起
    kneeR:[{t:0,x:1.6},{t:0.35,x:1.5},{t:0.5,x:0}],
    hipL:[{t:0,x:0.3},{t:0.5,x:0}],
  }},
  // 空中直接重击：不蓄力直接砸下单膝跪地
  aHeavyPlunge:{ dur:0.30, tracks:{
    chestX:[{t:0,v:-0.6},{t:0.12,v:-0.7},{t:0.30,v:0.6}],
    shoR:[{t:0,x:-3.0},{t:0.12,x:-3.2},{t:0.30,x:1.0}],
    hipR:[{t:0,x:0},{t:0.30,x:1.2}], kneeR:[{t:0,x:0},{t:0.30,x:1.4}],
  }},
  aHeavyPlunge_stiff:{ dur:0.34, tracks:{
    chestX:[{t:0,v:0.6},{t:0.34,v:0}], shoR:[{t:0,x:1.0},{t:0.34,x:0}],
    hipR:[{t:0,x:1.2},{t:0.34,x:0}], kneeR:[{t:0,x:1.4},{t:0.34,x:0}],
  }},
  // 战争践踏·空中：双手举高、手臂躯干腿全伸直(陨石俯冲姿势)
  aStomp:{ dur:0.16, tracks:{
    bodyLean:[{t:0,v:0},{t:0.16,v:0}],
    shoR:[{t:0,x:-3.0,z:0.0},{t:0.16,x:-3.05,z:0.0}], elbR:[{t:0,x:-0.08},{t:0.16,x:-0.05}],
    wristR:[{t:0,y:0},{t:0.16,y:-0.35}],   // 举臂过程中持剑手腕往外侧转~20°(避免剑穿头)
    shoL:[{t:0,x:-3.0,z:0.0},{t:0.16,x:-3.05,z:0.0}], elbL:[{t:0,x:-0.08},{t:0.16,x:-0.05}],
    hipR:[{t:0,x:0},{t:0.16,x:0}], kneeR:[{t:0,x:0},{t:0.16,x:0}],
    hipL:[{t:0,x:0},{t:0.16,x:0}], kneeL:[{t:0,x:0},{t:0.16,x:0}],
  }},
  // 战争践踏·落地：半蹲+大腿向外微开+上身前倾腹肌收紧+双肘90°，保持~0.25s力量定格→起身
  aStompLand:{ dur:0.55, tracks:{
    bodyY:[{t:0,v:-0.5},{t:0.25,v:-0.48},{t:0.55,v:0,e:'out'}],
    bodyLean:[{t:0,v:0.4},{t:0.25,v:0.4},{t:0.55,v:0,e:'out'}],
    chestX:[{t:0,v:0.35},{t:0.25,v:0.32},{t:0.55,v:0}],
    shoR:[{t:0,x:-0.5,z:-0.4},{t:0.25,x:-0.5,z:-0.4},{t:0.55,x:0,z:0}], elbR:[{t:0,x:-1.57},{t:0.25,x:-1.57},{t:0.55,x:-0.3}],
    wristR:[{t:0,y:-0.35},{t:0.25,y:-0.35},{t:0.55,y:0}],   // 落地保持手腕外转(剑不穿头)，收势归位
    shoL:[{t:0,x:-0.5,z:0.4},{t:0.25,x:-0.5,z:0.4},{t:0.55,x:0,z:0}], elbL:[{t:0,x:-1.57},{t:0.25,x:-1.57},{t:0.55,x:-0.3}],
    hipR:[{t:0,x:-0.3,z:-0.3},{t:0.25,x:-0.3,z:-0.3},{t:0.55,x:0,z:0}], kneeR:[{t:0,x:0.85},{t:0.25,x:0.85},{t:0.55,x:0}],
    hipL:[{t:0,x:-0.3,z:0.3},{t:0.25,x:-0.3,z:0.3},{t:0.55,x:0,z:0}], kneeL:[{t:0,x:0.85},{t:0.25,x:0.85},{t:0.55,x:0}],
  }},
  // 空轻→重：斜下方突刺
  aThrust:{ dur:0.24, tracks:{
    chestX:[{t:0,v:-0.3},{t:0.24,v:0.2}],
    shoR:[{t:0,x:-1.4,z:0.3},{t:0.10,x:-2.0,z:0},{t:0.24,x:-2.2}],  // 朝斜下前刺
    elbR:[{t:0,x:-1.2},{t:0.10,x:0},{t:0.24,x:-0.1}],
  }},
  aThrust_stiff:{ dur:0.14, tracks:{ shoR:[{t:0,x:-2.2},{t:0.14,x:0}] }},
  // 空轻轻→重：以X轴为轴心快速旋转砸下（旋转由 body.rotation.x 驱动，见 pose）
  aSpin:{ dur:0.42, tracks:{
    shoR:[{t:0,x:-2.6},{t:0.42,x:0.6}],
    elbR:[{t:0,x:-0.2},{t:0.42,x:-0.2}],
    hipR:[{t:0,x:-0.5},{t:0.42,x:0.3}], hipL:[{t:0,x:-0.5},{t:0.42,x:0.3}],
    kneeR:[{t:0,x:0.6},{t:0.42,x:0.2}], kneeL:[{t:0,x:0.6},{t:0.42,x:0.2}],
  }},
  aSpin_stiff:{ dur:0.30, tracks:{
    chestX:[{t:0,v:0.5},{t:0.30,v:0}], shoR:[{t:0,x:0.6},{t:0.30,x:0}],
    hipR:[{t:0,x:1.2},{t:0.30,x:0}], kneeR:[{t:0,x:1.4},{t:0.30,x:0}],
  }},

  // —— 闪避连招动画 ——
  // 侧身腾空飞踹：转身90°+侧倒由 poseCharacter 处理；这里管腿/手/上身拧
  // 节奏: 0-0.16 右腿高抬团身蓄势 / 0.18 水平前踹(ease in) / 0.18-0.42 滞空停顿 / 之后收
  dKick:{ dur:0.60, tracks:{
    // 踹出瞬间上身往角色左边再拧一点(与踹腿同步, 蓄势段多留一拍)
    chestY:[{t:0,v:0},{t:0.20,v:0.15},{t:0.26,v:-0.45,e:'in'},{t:0.46,v:-0.4},{t:0.60,v:0}],
    // 左腿(物理左,踹腿)：大腿往腹部死死收紧+膝盖弯到底团成一团(蓄势顶点多留一拍) → 猛地蹬直水平踹向攻击方向(hip.z=+0.32, 解出世界=正前水平) → 停顿 → 收
    hipL:[{t:0,x:-1.0,z:0},{t:0.10,x:-2.2,z:0},{t:0.20,x:-2.3,z:0},{t:0.26,x:0,z:0.32,e:'in'},{t:0.46,x:0,z:0.32},{t:0.60,x:0,z:0}],
    kneeL:[{t:0,x:1.5},{t:0.10,x:2.6},{t:0.20,x:2.7},{t:0.26,x:0.05,e:'in'},{t:0.46,x:0.0},{t:0.60,x:0.05}],
    // 右腿(物理右、支撑)：保持伸直(z补偿由 pose 抵消侧倒 → 世界竖直立地)
    hipR:[{t:0,x:0},{t:0.60,x:0}], kneeR:[{t:0,x:0.05},{t:0.60,x:0.05}],
    // 左手抱胸(大臂收到胸前、肘折紧)
    shoL:[{t:0,x:-0.8,z:0.5},{t:0.26,x:-1.1,z:0.7,e:'in'},{t:0.46,x:-1.1,z:0.7},{t:0.60,x:0,z:0}], elbL:[{t:0,x:-1.4},{t:0.26,x:-1.9},{t:0.46,x:-1.9},{t:0.60,x:-0.2}],
    // 右手(持剑)向后摆 + 手腕外转(剑别穿身)
    shoR:[{t:0,x:0.6,z:-0.3},{t:0.26,x:1.05,z:-0.4,e:'in'},{t:0.46,x:1.0,z:-0.4},{t:0.60,x:0,z:0}], elbR:[{t:0,x:-0.5},{t:0.26,x:-0.6},{t:0.60,x:-0.2}],
    wristR:[{t:0,y:-0.5},{t:0.60,y:-0.5}],
  }},
  // 升龙剑（重写）：分四拍——①弓步深蹲蓄力 ②起跳前再往下趴+下沉一下(二次压缩) ③啪蹬地起跳 ④空中转一圈到顶点滞空
  //  0~0.14 沉入深弓步(左腿前/右腿后, 上身快卷下趴, 核心收紧, 左手后摆, 右手横到左腿左侧低位)
  //  0.14~0.24 二次压缩(腹肌再收紧往下趴, 身体下沉到最低, 蓄到底)
  //  0.24 啪起跳(左脚蹬地) → 右腿高抬/左手垂直/右手高举枪式 → 空中转一圈
  //  0.56~0.80 顶点短暂滞空(可接轻/重击) → 之后自然下落 → dRise_land 落地泄力
  dRise:{ dur:0.90, tracks:{
    gripMode:[{t:0,v:1},{t:0.90,v:1}],     // 全程枪式持剑
    // 身体高度：深蹲→二次下沉到最低→爆发腾起→顶点保持
    bodyY:[{t:0,v:-0.1},{t:0.14,v:-0.45},{t:0.24,v:-0.58},{t:0.30,v:0.15,e:'out'},{t:0.56,v:0.30},{t:0.80,v:0.28},{t:0.90,v:0.1}],
    // 上身往下"快卷"+核心收紧, 二次压缩最狠；起跳后由旋转接管(spinning会忽略bodyLean)
    bodyLean:[{t:0,v:0.35},{t:0.14,v:0.62},{t:0.24,v:0.74},{t:0.30,v:0.1,e:'out'}],
    chestX:[{t:0,v:0.35},{t:0.14,v:0.6},{t:0.24,v:0.74},{t:0.30,v:0,e:'out'}],
    // 右臂(持剑):顶点往后方天空延伸(后仰蓄势)
    shoR:[{t:0,x:-0.2,z:0.7},{t:0.14,x:-0.05,z:0.9},{t:0.24,x:0.0,z:1.0},{t:0.30,x:-2.9,z:-0.1,e:'out'},{t:0.56,x:-3.05,z:-0.1},{t:0.80,x:-2.95,z:-0.1},{t:0.90,x:-2.6,z:-0.1}],
    elbR:[{t:0,x:-1.0},{t:0.24,x:-1.25},{t:0.30,x:-0.12,e:'out'},{t:0.90,x:-0.15}],
    wristR:[{t:0,y:-0.35},{t:0.90,y:-0.35}],   // 手腕外转,剑不穿身
    // 左臂：蓄力往后摆(x正) → 起跳后垂直(x≈0)
    shoL:[{t:0,x:0.5},{t:0.14,x:0.85},{t:0.24,x:0.98},{t:0.30,x:0.55,e:'out'},{t:0.56,x:0.6},{t:0.90,x:0.5}],
    elbL:[{t:0,x:-0.5},{t:0.24,x:-0.6},{t:0.30,x:-0.1,e:'out'},{t:0.90,x:-0.2}],
    // 左腿(前、弓步深屈) → 起跳蹬直(左脚蹬地)
    // 左腿:蓄力弓步深屈不变 → 起跳后改为高抬腿(原右腿动作,左右已互换)
    hipL:[{t:0,x:-0.35},{t:0.14,x:-0.75},{t:0.24,x:-0.88},{t:0.30,x:-1.3,e:'out'},{t:0.56,x:-1.45},{t:0.80,x:-1.2},{t:0.90,x:-0.6}],
    kneeL:[{t:0,x:0.7},{t:0.14,x:1.2},{t:0.24,x:1.35},{t:0.30,x:1.4,e:'out'},{t:0.56,x:1.5},{t:0.90,x:0.8}],
    // 右腿:蓄力后蹬不变 → 起跳后改为蹬直(原左腿动作,左右已互换)
    hipR:[{t:0,x:0.4},{t:0.14,x:0.5},{t:0.24,x:0.55},{t:0.30,x:0.15,e:'out'},{t:0.56,x:0.3},{t:0.90,x:0.1}],
    kneeR:[{t:0,x:0.3},{t:0.24,x:0.4},{t:0.30,x:0.1,e:'out'},{t:0.56,x:0.12},{t:0.90,x:0.35}],
  }},
  // 升龙剑落地泄力(简单)：落地深蹲卸力 → 站直
  dRise_land:{ dur:0.30, tracks:{
    gripMode:[{t:0,v:1},{t:0.30,v:0}],
    bodyY:[{t:0,v:-0.42},{t:0.12,v:-0.48},{t:0.30,v:0,e:'out'}],
    bodyLean:[{t:0,v:0.32},{t:0.30,v:0,e:'out'}],
    chestX:[{t:0,v:0.3},{t:0.30,v:0}],
    shoR:[{t:0,x:-1.0,z:-0.1},{t:0.30,x:0,z:0}], shoL:[{t:0,x:-0.2},{t:0.30,x:0}],
    hipL:[{t:0,x:-0.5},{t:0.30,x:0}], kneeL:[{t:0,x:0.9},{t:0.30,x:0}],
    hipR:[{t:0,x:-0.3},{t:0.30,x:0}], kneeR:[{t:0,x:0.85},{t:0.30,x:0}],
  }},

  pushGlasses:{ dur:0.7, tracks:{
    shoL:[{t:0,x:0},{t:0.2,x:-1.7},{t:0.4,x:-1.7},{t:0.7,x:0}],
    elbL:[{t:0,x:-0.2},{t:0.2,x:-2.0},{t:0.4,x:-2.0},{t:0.7,x:-0.2}],
    head:[{t:0,x:0},{t:0.25,x:0.18},{t:0.5,x:0},{t:0.7,x:0}],
    chestX:[{t:0,v:0},{t:0.3,v:0.06},{t:0.7,v:0}],
  }},
};
function ease(k,mode){
  if(mode==='out') return 1-(1-k)*(1-k);          // 减速逼近(慢出)
  if(mode==='in')  return k*k;                      // 加速离开(慢入)
  if(mode==='inout') return k<0.5?2*k*k:1-Math.pow(-2*k+2,2)/2;
  return k;                                         // 线性
}
function sampleTrack(track,t){
  if(t<=track[0].t)return track[0];
  if(t>=track[track.length-1].t)return track[track.length-1];
  for(let i=0;i<track.length-1;i++){const a=track[i],b=track[i+1];
    if(t>=a.t&&t<=b.t){let k=(t-a.t)/(b.t-a.t);
      k=ease(k, b.e);                               // 目标关键帧可声明缓动 e:'out'/'in'/'inout'
      const o={};
      for(const key of ['x','y','z','v'])if(a[key]!==undefined||b[key]!==undefined)o[key]=THREE.MathUtils.lerp(a[key]||0,b[key]||0,k);
      return o;}}
  return track[track.length-1];
}
// 切招过渡：记录切招瞬间每个关节的实际旋转，作为补间起点
const POSE_SNAP={};
let clipBodyY=null, clipBodyLean=null, clipBodyYaw=null, clipBodySide=null, clipGripMode=null;   // 动作驱动的身体下沉/前倾/握剑姿态(null=不覆盖)
function capturePoseSnapshot(){
  for(const k in JOINTS){
    const r=JOINTS[k].rotation;
    POSE_SNAP[k]={x:r.x,y:r.y,z:r.z};
  }
  POSE_SNAP._bodyY = body.position.y;
  POSE_SNAP._bodyLean = body.rotation.x;
  POSE_SNAP._bodyYaw = body.rotation.y;
  POSE_SNAP._bodySide = body.rotation.z;
  POSE_SNAP._gripMode = (clipGripMode!==null)?clipGripMode:0;
}
function applyClip(name,time,blend){
  const clip=CLIPS[name]; if(!clip)return;
  // blend: 0→1，从切招快照过渡到新动作；>=1 或未传则直接套用
  const b = (blend===undefined)?1:Math.min(1,blend);
  for(const jn in clip.tracks){
    const val=sampleTrack(clip.tracks[jn],time);
    // 身体下沉 / 整体前倾（驱动下半身核心发力感）
    if(jn==='bodyY'){
      const tgt=val.v||0; const s=(POSE_SNAP._bodyY??0);
      clipBodyY = (b<1)?THREE.MathUtils.lerp(s,tgt,b):tgt; continue;
    }
    if(jn==='bodyLean'){
      const tgt=val.v||0; const s=(POSE_SNAP._bodyLean??0);
      clipBodyLean = (b<1)?THREE.MathUtils.lerp(s,tgt,b):tgt; continue;
    }
    if(jn==='bodyYaw'){ clipBodyYaw=(b<1)?THREE.MathUtils.lerp(POSE_SNAP._bodyYaw??0,val.v||0,b):(val.v||0); continue; }
    if(jn==='bodySide'){ clipBodySide=(b<1)?THREE.MathUtils.lerp(POSE_SNAP._bodySide??0,val.v||0,b):(val.v||0); continue; }
    // 握剑姿态(0=斜握默认, 1=突刺枪式握法:剑沿小臂延长线)
    if(jn==='gripMode'){
      const tgt=val.v||0; const s=(POSE_SNAP._gripMode??0);
      clipGripMode = (b<1)?THREE.MathUtils.lerp(s,tgt,b):tgt; continue;
    }
    // 目标关节与目标值
    let joint, tx,ty,tz;
    if(jn==='chestY'){ joint=chest; tx=chest.rotation.x; ty=val.v||0; tz=chest.rotation.z; }
    else if(jn==='chestX'){ joint=chest; tx=val.v||0; ty=chest.rotation.y; tz=chest.rotation.z; }
    else if(jn==='chestZ'){ joint=chest; tx=chest.rotation.x; ty=chest.rotation.y; tz=val.v||0; }
    else {
      joint=JOINTS[jn]; if(!joint)continue;
      tx=(val.x!==undefined)?val.x:joint.rotation.x;
      ty=(val.y!==undefined)?val.y:joint.rotation.y;
      tz=(val.z!==undefined)?val.z:joint.rotation.z;
    }
    if(b<1){
      // 从快照起点补间到目标
      const snapKey = (jn==='chestX'||jn==='chestY'||jn==='chestZ')?'chest':jn;
      const s=POSE_SNAP[snapKey]||{x:0,y:0,z:0};
      joint.rotation.x=THREE.MathUtils.lerp(s.x,tx,b);
      joint.rotation.y=THREE.MathUtils.lerp(s.y,ty,b);
      joint.rotation.z=THREE.MathUtils.lerp(s.z,tz,b);
    } else {
      joint.rotation.x=tx; joint.rotation.y=ty; joint.rotation.z=tz;
    }
  }
}

// ============================================================
//  输入
// ============================================================
const Actions={moveX:0,moveZ:0,attack:false,jump:false,dodge:false,heavyHeld:false,heavyReleased:false,taunt:false};
const prev={attack:false,jump:false,dodge:false,heavy:false,taunt:false};
let inputMode='keyboard';
const keys={}, mouse={left:false,right:false};
addEventListener('keydown',e=>{keys[e.code]=true; if(e.code==='Space')e.preventDefault(); if(inputMode!=='keyboard')setMode('keyboard');});
addEventListener('keyup',e=>{keys[e.code]=false;});
canvas.addEventListener('mousedown',e=>{if(e.button===0)mouse.left=true;if(e.button===2)mouse.right=true;if(inputMode!=='keyboard')setMode('keyboard');});
addEventListener('mouseup',e=>{if(e.button===0)mouse.left=false;if(e.button===2)mouse.right=false;});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
let gpIndex=null;
addEventListener('gamepadconnected',e=>{gpIndex=e.gamepad.index;padStatus();});
addEventListener('gamepaddisconnected',e=>{if(gpIndex===e.gamepad.index)gpIndex=null;padStatus();});
function padStatus(){const el=document.getElementById('padState');if(gpIndex!==null){el.textContent='已连接 ✓';el.className='on';}else{el.textContent='未连接';el.className='';}}
const btnKb=document.getElementById('btnKeyboard'),btnGp=document.getElementById('btnGamepad');
function setMode(m){inputMode=m;btnKb.classList.toggle('active',m==='keyboard');btnGp.classList.toggle('active',m==='gamepad');}
let invertX=true, invertY=false;
const btnInvX=document.getElementById('btnInvertX'), btnInvY=document.getElementById('btnInvertY');
if(btnInvX) btnInvX.addEventListener('click',()=>{ invertX=!invertX; btnInvX.classList.toggle('active',invertX); });
if(btnInvY) btnInvY.addEventListener('click',()=>{ invertY=!invertY; btnInvY.classList.toggle('active',invertY); });
btnKb.onclick=()=>setMode('keyboard'); btnGp.onclick=()=>setMode('gamepad');

function stickDeadzone(v,dz=0.25){
  const a=Math.abs(v);
  if(a<dz) return 0;
  const n=(a-dz)/(1-dz);
  return Math.sign(v)*n*n;
}
const worldMove={x:0,z:0};
function toCameraRelativeMove(mx,mz,out=worldMove){
  const s=Math.sin(cameraRig.yaw), c=Math.cos(cameraRig.yaw);
  out.x=mx*c + mz*s;
  out.z=-mx*s + mz*c;
  return out;
}
function pollInput(){
  let mx=0,mz=0,aAtk=false,aHeavy=false,aJump=false,aDodge=false,aTaunt=false;
  cameraRig.stickX=0; cameraRig.stickY=0;
  if(inputMode==='keyboard'){
    if(keys['KeyA'])mx-=1;if(keys['KeyD'])mx+=1;if(keys['KeyW'])mz-=1;if(keys['KeyS'])mz+=1;
    aAtk=mouse.left;aHeavy=mouse.right;aJump=!!keys['Space'];aDodge=!!(keys['ShiftLeft']||keys['ShiftRight']);aTaunt=!!keys['KeyT'];
    if(keys['KeyQ'])cameraRig.stickX-=0.75;if(keys['KeyE'])cameraRig.stickX+=0.75;
    if(keys['KeyR'])cameraRig.stickY-=0.75;if(keys['KeyF'])cameraRig.stickY+=0.75;
  } else {
    const gp=gpIndex!==null?navigator.getGamepads()[gpIndex]:null;
    if(gp){let lx=stickDeadzone(gp.axes[0]||0),ly=stickDeadzone(gp.axes[1]||0);mx=lx;mz=ly;
      cameraRig.stickX=stickDeadzone(gp.axes[2]||0,0.18);
      cameraRig.stickY=stickDeadzone(gp.axes[3]||0,0.18);
      if(gp.buttons[14]?.pressed)mx-=1;if(gp.buttons[15]?.pressed)mx+=1;if(gp.buttons[12]?.pressed)mz-=1;if(gp.buttons[13]?.pressed)mz+=1;
      aJump=gp.buttons[0]?.pressed;aDodge=gp.buttons[1]?.pressed;aAtk=gp.buttons[2]?.pressed;aHeavy=gp.buttons[3]?.pressed;aTaunt=gp.buttons[5]?.pressed;}
  }
  if(invertX) cameraRig.stickX=-cameraRig.stickX;
  if(invertY) cameraRig.stickY=-cameraRig.stickY;
  const len=Math.hypot(mx,mz);if(len>1){mx/=len;mz/=len;}
  Actions.moveX=mx;Actions.moveZ=mz;
  Actions.attack=aAtk&&!prev.attack;Actions.jump=aJump&&!prev.jump;Actions.dodge=aDodge&&!prev.dodge;Actions.taunt=aTaunt&&!prev.taunt;
  Actions.heavyHeld=aHeavy;Actions.heavyReleased=(!aHeavy)&&prev.heavy;
  prev.attack=aAtk;prev.jump=aJump;prev.dodge=aDodge;prev.heavy=aHeavy;prev.taunt=aTaunt;
}
function clearGameplayInputState(){
  for(const code of Object.keys(keys)) keys[code]=false;
  mouse.left=false;mouse.right=false;
  Object.assign(Actions,{moveX:0,moveZ:0,attack:false,jump:false,dodge:false,heavyHeld:false,heavyReleased:false,taunt:false});
  Object.assign(prev,{attack:false,jump:false,dodge:false,heavy:false,taunt:false});
  cameraRig.stickX=0;cameraRig.stickY=0;
  P.charging=false;P.chargeT=0;P.chargeFull=false;P.chargeFullT=0;P.chargeLock=false;
}
function autoPad(){
  // 主动扫描（兜底，防止gamepadconnected未触发）
  if(gpIndex===null){const pads=navigator.getGamepads();for(let i=0;i<pads.length;i++){if(pads[i]){gpIndex=pads[i].index;padStatus();break;}}}
  if(gpIndex===null)return;const gp=navigator.getGamepads()[gpIndex];if(!gp)return;if((gp.buttons.some(b=>b.pressed)||gp.axes.some(a=>Math.abs(a)>0.35))&&inputMode!=='gamepad')setMode('gamepad');}

// ============================================================
//  玩家状态
// ============================================================
const P={x:0,z:0,y:0,vy:0,facing:0,jumping:false,
  hp:5,hpMax:5,dead:false,
  state:'idle',          // idle / attack / dodge / taunt
  clip:null, clipT:0, clipDur:0,
  // 连招机
  move:null,             // 当前招式名(连招树节点) 或 null
  moveT:0, phase:'startup', struck:false, blendT:0, blendDur:0.13, // startup→active→recovery
  nextBuffer:null,       // 输入缓冲: 'light' | 'heavy'
  lunge:0,
  charging:false,chargeT:0,chargeHold:0,chargeLock:false,chargeFull:false,chargeFullT:0,
  dodgeT:0,dodgeDir:new THREE.Vector3(),roll:0,iframe:0, airDodge:false, _drillBounce:0, _drillBounced:false,
  spin:0,                // 空中旋转砸的角度进度
  stamina:100,staminaMax:100, runPhase:0,moving:false,speed:0};

const MOVE_SPEED=9.2, TURN_LERP=20, JUMP_V=15.5, GRAVITY=43;
// 跳跃最高点≈2.8单位(高过2.7的柱子)，空中时间≈0.72s，上升/下落都更快一点
const LIGHT_LUNGE=2.5, HEAVY_LUNGE=4.0, CHARGE_MAX=1.1, CHARGE_MOVE=0.38, CHARGE_AUTO=1.0;
const HEAVY_CHARGE_TIME=1.0;      // 蓄满需要1.5秒
const HEAVY_CHARGE_HOLD=1.0;      // 蓄满后保持1秒不松手则取消
const HEAVY_CHARGE_MINSPD=0.2;    // 蓄满时移速降到20%
const DODGE_DUR=0.20, DODGE_SPEED=17.0, DODGE_IFRAME=0.16, DODGE_COST=0, STAM_REGEN=10;
const HEAVY_R_MIN=1.3, HEAVY_R_MAX=2.7;   // 重击圆圈半径(空蓄~满蓄)
const PLAYER_R=0.55;
let shake=0,hitstop=0;

// ============================================================
//  连招树 MOVES
//  每招: clip动画 / active(可衔接时长) / recover(僵直时长) /
//        onLight onHeavy(衔接到哪一招) / lunge前冲 / fx特效 / air是否空中招
//  recover>0 时该招最后有僵直；衔接窗口在 active 段内
// ============================================================
// ============================================================
//  连招树 MOVES（带 预备→挥击→停顿→收势 节奏）
//  strike: 命中瞬间(触发特效+顿帧)   cancel: 可取消/衔接下一招的时刻
//  total : 招式总时长(过后自动收势回站姿)   衔接窗口=[cancel, total]
// ============================================================
const MOVES={
  // —— 地面轻击三连（cancel~total 之间为结尾定格，加长以增强分量感）——
  gL1:{clip:'gL1', strike:0.18, cancel:0.24, total:0.50, comboAt:0.32, onLight:'gL2', onHeavy:'gThrust', lunge:3.0, fx:'slashR', trail:true, trailSegs:8, hitR:0.85},
  gL2:{clip:'gL2', strike:0.17, cancel:0.24, total:0.53, comboAt:0.32, onLight:'gL3', onHeavy:'gKnee', lunge:2.6, fx:'slashL', trail:true, hitR:0.85},
  gL3:{clip:'gL3', strike:0.72, cancel:0.86, total:1.06, recoverClip:'gL3_recover', onLight:null, onHeavy:null, lunge:2.4, fx:'chop', trail:true},
  // 轻→重：突刺（滑行更远；突刺动作做完后才可按重击接大风车）
  gThrust:{clip:'gThrust', strike:0.44, cancel:0.54, total:0.80, comboAt:0.72, recoverClip:'gThrust_recover', onLight:null, onHeavy:'gSpinSlide', lunge:0, slide:20, fx:'thrust', thrustHit:true, trail:true},
  // 轻轻→重：顺发蓄力重击
  gFollowHeavy:{clip:'gFollowHeavy', strike:0.30, cancel:0.44, total:0.88, recoverClip:'gFollowHeavy_recover', onLight:null, onHeavy:null, lunge:3.6, fx:'heavyCircle'},
  // 大风车(重击按一次)：极快360°横扫，周身一圈判定
  gKnee:{clip:'gKnee', strike:0.32, cancel:0.46, total:0.68, onLight:null, onHeavy:null, lunge:14.0, slide:6, fx:'kick', hitR:1.1},
  gSpin:{clip:'gSpin', strike:0.30, cancel:0.52, total:0.62, recoverClip:'gSpin_recover', onLight:null, onHeavy:null, lunge:0, spinY:true, spinStart:0.26, spinEnd:0.50, fx:'spinSlash', ringHit:true, trail:true},
  // 突刺接出的大风车：带向前滑动 + 结束僵直更长
  gSpinSlide:{clip:'gSpin', strike:0.30, cancel:0.52, total:0.82, recoverClip:'gSpin_recover', onLight:null, onHeavy:null, lunge:0, spinY:true, spinStart:0.26, spinEnd:0.50, slide:9, fx:'spinSlash', ringHit:true, trail:true},
  // 蓄满大风车：转3圈，可20%移动，结尾不僵直→半蹲晕一圈
  gSpinCharged:{clip:'gSpin', strike:0.30, cancel:1.10, total:2.30, recoverClip:'gSpinCharged_recover', useRecoverClip:true, onLight:null, onHeavy:null, lunge:0, spinY:true, spinTurns:4, spinStart:0.26, spinEnd:1.10, chargedMove:true, dizzy:true, fx:'spinSlash', ringHit:true, trail:true},
  // 轻轻轻→重：顺发重击×2（A自动接B，B后有较长定格）
  gHeavyChain1:{clip:'gHeavyA', strike:0.24, cancel:0.34, total:0.44, onLight:null, onHeavy:null, auto:'gHeavyChain2', lunge:3.0, fx:'heavyCircle'},
  gHeavyChain2:{clip:'gHeavyB', strike:0.30, cancel:0.44, total:0.92, recoverClip:'gHeavyB_recover', onLight:null, onHeavy:null, lunge:3.4, fx:'heavyCircleBig'},

  // —— 空中招（第一下滞空挥剑，第二下从天而降大劈）——
  // 空中轻击两下：①aL1=地面轻击1(gL1)放空中挥+滞空 ②aChop=举刀从天而降俯冲、落地砸地、收势对齐 gL3、不发剑气
  aL1:{clip:'gL1', strike:0.22, cancel:0.32, total:0.62, comboAt:0.42, onLight:'aL2', onHeavy:'aChop', lunge:2.4, air:true, fx:'slashR', trail:true, hitR:0.85},
  // 空中第二下：举刀从天而降，落地瞬间砸地(无剑气)，落地姿态/收势对齐地面大劈 gL3
  aChop:{clip:'aChop', strike:0.35, cancel:0.42, total:0.45, hangT:0.25, onLight:null, onHeavy:null, air:true, plunge:'aChopLand', landHit:true, landFx:'slam', hitR:1.0, trail:true},
  aL2:{clip:'gL2', strike:0.22, cancel:0.32, total:0.62, comboAt:0.42, onLight:null, onHeavy:'aChop', lunge:2.6, air:true, fx:'slashL', trail:true, hitR:0.85},  // (现未接入连招，保留备用)
  aPlunge:{clip:'aPlunge', strike:0.16, cancel:99, total:0.30, onLight:null, onHeavy:null, air:true, plunge:'aPlunge_stiff', fx:'chop'},
  aThrust:{clip:'aThrust', strike:0.14, cancel:99, total:0.44, recoverClip:'aThrust_stiff', onLight:null, onHeavy:null, air:true, lunge:5.5, fx:'thrust'},
  aHeavyPlunge:{clip:'aHeavyPlunge', strike:0.16, cancel:99, total:0.30, onLight:null, onHeavy:null, air:true, plunge:'aHeavyPlunge_stiff', fx:'heavyCircle'},  // (旧空中重击，已被 aStomp 取代，保留备用)
  // 空中重击=陨石式战争践踏：无剑、双手举高瞬间砸地，落地坑痕+碎石+强震，半蹲力量姿势收尾
  aStomp:{clip:'aStomp', strike:0.05, cancel:99, total:0.40, onLight:null, onHeavy:null, air:true, plunge:'aStompLand', diveV:26, landFx:'stomp'},
  aJupiterLand:{clip:'aJupiterLand', strike:99, cancel:99, total:0.65, onLight:null, onHeavy:null},
  // 升龙接重击：空中木星电锯球(3圈前翻滚电锯+密集剑影+蜘蛛侠落地)
  aDrill:{clip:'aDrill', strike:0.04, cancel:99, total:0.25, onLight:null, onHeavy:null, air:true, plunge:'aJupiterLand', diveV:40, landFx:'drill', trail:true, trailSegs:10, ringHit:true, hitR:1.1}, // 旋风坠
  aJupiter:{clip:'aJupiter', strike:0.22, cancel:99, total:0.75, onLight:null, onHeavy:null, air:true, plunge:'aJupiterLand', hangT:0.55, diveV:22, trail:true, trailSegs:24, hitR:1.8, ringHit:true},
  aSpin:{clip:'aSpin', strike:0.30, cancel:99, total:0.42, onLight:null, onHeavy:null, air:true, plunge:'aSpin_stiff', spin:true, fx:'heavyCircleBig'},

  // —— 闪避连招 ——
  // 闪避→轻击：闪现飞踹(瞬移已在触发处完成，这里只播飞踹动作；暂不击飞，留给血量系统)
  dKick:{clip:'dKick', strike:0.26, cancel:0.46, total:0.60, onLight:null, onHeavy:null, lunge:2.0, slide:8, air:true, fx:'kick', hitR:1.0},
  // 闪避→重击：升龙剑。地面深蹲蓄力(0~0.24)→啪蹬地起跳上挑→空翻到顶→顶点定格。comboAt 在顶点(0.56)，接招更从容
  dRise:{clip:'dRise', strike:0.32, cancel:0.56, total:0.90, comboAt:0.68, onLight:'aChop', onHeavy:'aJupiter', lunge:0.4, chargeSlide:10, air:true, noHang:true, landClip:'dRise_land', fx:'rise', hitR:1.1, trail:true},
};

function startSlash(type,ratio=0){
  if(type==='heavy'){
    // 正前方圆圈爆发
    const radius=HEAVY_R_MIN+(HEAVY_R_MAX-HEAVY_R_MIN)*ratio;
    const front=0.7+radius*0.55;
    setHeavyCircle(radius,front);
    heavyFill.visible=true; heavyFill._t=0; heavyFill._dur=0.22; heavyFillMat.opacity=0.55;
    heavyRing.visible=true; heavyRing._burst=true; heavyRing._t=0;
    hitstop=0.04+ratio*0.06; shake=0.12+ratio*0.2;
  } else {
    slashMesh.visible=true;slashMesh._t=0;slashMesh._dur=0.16;
    slashMesh.scale.setScalar(0.85);
    hitstop=0.02; shake=0.06;
  }
}
function playClip(name){ P.clip=name; P.clipT=0; P.clipDur=CLIPS[name].dur; }

// 触发某招特效
function fireFx(fx){
  switch(fx){
    case 'slashR': hitstop=0.07; shake=0.14; SFX.swing(); break;
    case 'slashL': hitstop=0.07; shake=0.14; SFX.swing(); break;
    case 'chop':   hitstop=0.10; shake=0.22; SFX.chop(); spawnSwordBeam(); break;
    case 'slam':   hitstop=0.14; shake=0.32; break;   // 落地砸地：顿帧+震屏(更重)，不发剑气
    case 'stomp':  doStomp(); break;
    case 'drill':  hitstop=0.14; shake=0.6; doStomp(); P._drillBounce=4.5; break;                  // 战争践踏：浅坑+碎石+强震+周身AoE
    case 'kick':   hitstop=0.10; shake=0.20; SFX.kick(); break;   // 飞踹：顿帧+震屏(暂不击飞)
    case 'rise':   hitstop=0.09; shake=0.18; SFX.rise(); break;   // 升龙剑上挑：顿帧+震屏
    case 'thrust': SFX.thrust(); doThrust(); break;
    case 'spinSlash': hitstop=0.08; shake=0.22; break;
    case 'heavyCircle':    burstCircle(1.7); break;
    case 'heavyCircleBig': burstCircle(2.6); break;
  }
}
function doSlash(from,to,heavy){
  slashMesh.visible=true;slashMesh._t=0;slashMesh._dur=heavy?0.18:0.15;
  slashMesh.scale.setScalar(heavy?1.7:1.4);   // 扇形半径×1.5(原0.95/1.15)
  slashPivot._from=from; slashPivot._to=to;
  if(!heavy){hitstop=0.08;shake=0.16;}
}
function doThrust(){
  // 去掉黄色刀光区域，只保留顿帧/震屏(剑的拖尾已表现突刺)
  hitstop=0.04; shake=0.12;
}
function burstCircle(radius){
  const front=0.7+radius*0.55;
  setHeavyCircle(radius,front);
  heavyFill.visible=true; heavyFill._t=0; heavyFill._dur=0.22; heavyFillMat.opacity=0.6;
  heavyFillMat.color.setHex(0xff7b3a); heavyRingMat.color.setHex(0xff7b3a);
  heavyRing.visible=true; heavyRing._burst=true;
  hitstop=0.06; shake=0.22;
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
  capturePoseSnapshot();
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
  if(type==='heavy'){
    const radius=HEAVY_R_MIN+(HEAVY_R_MAX-HEAVY_R_MIN)*ratio;
    const front=0.7+radius*0.55;
    setHeavyCircle(radius,front);
    heavyFill.visible=true; heavyFill._t=0; heavyFill._dur=0.22; heavyFillMat.opacity=0.6;
    heavyFillMat.color.setHex(0xff7b3a); heavyRingMat.color.setHex(0xff7b3a);
    heavyRing.visible=true; heavyRing._burst=true; heavyRing._t=0;
    hitstop=0.04+ratio*0.06; shake=0.12+ratio*0.2;
  }
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
// 攻击命中：柱子(红闪+颤抖) / 木人桩(红闪+后仰)
// hitR = 攻击判定的额外半径(挥砍覆盖范围)。轻击=最初的2倍
function tryHitObjects(hitR){
  hitR = hitR||0;
  const reach=1.7, fx=Math.sin(P.facing), fz=Math.cos(P.facing);
  const hx=P.x+fx*reach, hz=P.z+fz*reach;
  for(const o of hittables){
    const dx=hx-o.x, dz=hz-o.z;
    if(dx*dx+dz*dz < (o.r+hitR)*(o.r+hitR)){ o.flashT=0.18; o.shakeT=0.18; onHitTarget(o.x,1.4,o.z); if(o.onHit) o.onHit(); }
  }
  for(const d of dummies){
    const dx=hx-d.x, dz=hz-d.z;
    if(dx*dx+dz*dz < (d.r+hitR)*(d.r+hitR)){
      d.flashT=0.2;
      d.tiltVel += 7.5;
      hitstop=Math.max(hitstop,0.04); shake=Math.max(shake,0.14);
      onHitTarget(d.x,1.6,d.z);
    }
  }
  for(const m of monsters){
    const dx=hx-m.x, dz=hz-m.z;
    if(dx*dx+dz*dz < (m.r+hitR)*(m.r+hitR)){
      m.flashT=0.22; m.tiltVel+=6.5;
      hitstop=Math.max(hitstop,0.04); shake=Math.max(shake,0.14);
      onHitTarget(m.x,1.6,m.z);
    }
  }
}
// 剑气命中：跟随弹道移动判定，宽度1格，每个目标对同一道剑气只命中一次
function beamHitByBeam(b){
  const bx=b.grp.position.x, bz=b.grp.position.z;
  const halfW=GRID*0.5;                        // 剑气半宽0.5格
  // 木人桩：圆形距离判定(剑气当前位置 vs 目标)，宽度容差=半宽+目标半径
  for(const d of dummies){
    if(b.hitSet.has(d)) continue;
    const dx=d.x-bx, dz=d.z-bz;
    if(dx*dx+dz*dz < (halfW+d.r)*(halfW+d.r)){
      b.hitSet.add(d); d.flashT=0.25; d.tiltVel+=9;
      hitstop=Math.max(hitstop,0.03); shake=Math.max(shake,0.12);
    }
  }
  for(const m of monsters){
    if(b.hitSet.has(m)) continue;
    const dx=m.x-bx, dz=m.z-bz;
    if(dx*dx+dz*dz < (halfW+m.r)*(halfW+m.r)){
      b.hitSet.add(m); m.flashT=0.25; m.tiltVel+=8;
      hitstop=Math.max(hitstop,0.03); shake=Math.max(shake,0.12);
    }
  }
  // 柱子
  for(const o of hittables){
    if(b.hitSet.has(o)) continue;
    const dx=o.x-bx, dz=o.z-bz;
    if(dx*dx+dz*dz < (halfW+o.r)*(halfW+o.r)){
      b.hitSet.add(o); o.flashT=0.18; o.shakeT=0.18;
    }
  }
}
function beamHitDummies(bx,bz){
  for(const d of dummies){
    const dx=bx-d.x, dz=bz-d.z;
    if(dx*dx+dz*dz < (d.r+0.4)*(d.r+0.4)){
      if(d._beamCd>0) continue;
      d._beamCd=0.2; d.flashT=0.25; d.tiltVel+=9;
    }
  }
  for(const m of monsters){
    const dx=bx-m.x, dz=bz-m.z;
    if(dx*dx+dz*dz < (m.r+0.4)*(m.r+0.4)){
      if(m._beamCd>0) continue;
      m._beamCd=0.2; m.flashT=0.25; m.tiltVel+=8;
    }
  }
}
// 突刺判定：玩家正前方 宽1格×长3格 的矩形
const GRID_=2;
function inThrustBox(ox,oz,or){
  const fx=Math.sin(P.facing), fz=Math.cos(P.facing);
  const px=-fz, pz=fx;                       // 垂直方向
  const dx=ox-P.x, dz=oz-P.z;
  const along=dx*fx+dz*fz;                   // 沿前方距离
  const side=Math.abs(dx*px+dz*pz);          // 横向偏移
  return along>-0.3 && along<GRID_*3 && side<GRID_*0.5+(or||0);
}
function tryThrustHit(){
  for(const o of hittables){ if(inThrustBox(o.x,o.z,o.r)){ o.flashT=0.18; o.shakeT=0.18; onHitTarget(o.x,1.4,o.z); if(o.onHit) o.onHit(); } }
  for(const d of dummies){
    if(inThrustBox(d.x,d.z,d.r)){
      if(d._thrustCd>0) continue;
      d._thrustCd=0.25; d.flashT=0.22; d.tiltVel+=8;
      hitstop=Math.max(hitstop,0.04); shake=Math.max(shake,0.14);
      onHitTarget(d.x,1.6,d.z);
    }
  }
  for(const m of monsters){
    if(inThrustBox(m.x,m.z,m.r)){
      if(m._thrustCd>0) continue;
      m._thrustCd=0.25; m.flashT=0.22; m.tiltVel+=8;
      hitstop=Math.max(hitstop,0.04); shake=Math.max(shake,0.14);
      onHitTarget(m.x,1.6,m.z);
    }
  }
}
// 大风车判定：跟随剑旋转角度的扫掠命中
const SPIN_RADIUS=2.8;
function tryRingHit(){
  for(const o of hittables){
    const dx=o.x-P.x, dz=o.z-P.z;
    if(Math.hypot(dx,dz) < SPIN_RADIUS+o.r){ o.flashT=0.2; o.shakeT=0.2; if(o.onHit) o.onHit(); }
  }
  for(const d of dummies){
    const dx=d.x-P.x, dz=d.z-P.z;
    if(Math.hypot(dx,dz) < SPIN_RADIUS+d.r){
      d.flashT=0.25; d.tiltVel+=9;
      hitstop=Math.max(hitstop,0.05); shake=Math.max(shake,0.18);
    }
  }
  for(const m of monsters){
    const dx=m.x-P.x, dz=m.z-P.z;
    if(Math.hypot(dx,dz) < SPIN_RADIUS+m.r){
      m.flashT=0.25; m.tiltVel+=8;
      hitstop=Math.max(hitstop,0.05); shake=Math.max(shake,0.18);
    }
  }
}
// 大风车扫掠判定：只命中"剑当前扫到的角度扇区"内的目标，每个目标一次
// aJupiter 多段命中：每转一整圈触发一次
function tryJupiterHit(){
  const hr=MOVES['aJupiter'].hitR||1.8;
  for(const d of dummies){ if(Math.hypot(d.x-P.x,d.z-P.z)<hr+d.r){ d.flashT=0.22;d.tiltVel+=8;hitstop=Math.max(hitstop,0.04);shake=Math.max(shake,0.15);onHitTarget(d.x,1.5,d.z); } }
  for(const m of monsters){ if(Math.hypot(m.x-P.x,m.z-P.z)<hr+m.r){ m.flashT=0.22;m.tiltVel+=7;hitstop=Math.max(hitstop,0.04);shake=Math.max(shake,0.15);onHitTarget(m.x,1.5,m.z); } }
}
function trySweepHit(){
  // 剑当前世界朝向角度：身体绕Y顺时针转(body.rotation.y=-spin*2π)，剑在右侧(facing基础上+90°起转)
  const _turns=MOVES[P.move]?.spinTurns||1;
  const swordAng = P.facing + Math.PI/2 - P.spin*Math.PI*2*_turns;   // 当前剑角度(乘以转圈数)
  const ARC=0.6;   // 扇区半角(弧度)~34°
  if(!P._spinHit) P._spinHit=new Set();
  const checkList=[...hittables,...dummies,...monsters];
  for(const o of checkList){
    if(P._spinHit.has(o)) continue;
    const dx=o.x-P.x, dz=o.z-P.z;
    const dist=Math.hypot(dx,dz);
    if(dist > SPIN_RADIUS+o.r) continue;
    let ang=Math.atan2(dx,dz);                 // 目标方向角(与facing同基准)
    let diff=((ang-swordAng)%(Math.PI*2)+Math.PI*3)%(Math.PI*2)-Math.PI;
    if(Math.abs(diff)<ARC){
      P._spinHit.add(o);
      if(o.tiltVel!==undefined){ o.flashT=0.12; o.tiltVel=Math.max(o.tiltVel,8); hitstop=Math.max(hitstop,0.04); shake=Math.max(shake,0.16); onHitTarget(o.x,1.6,o.z); }
      else { o.flashT=0.2; o.shakeT=0.2; onHitTarget(o.x,1.4,o.z); }
    }
  }
}

const clock=new THREE.Clock();
function update(dt){
  if(worldMapOverlay.classList.contains('open')){updateFx(dt);poseCharacter(dt);return;}
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
    if(P.move && trailMesh.visible && trailActive){ spaceSlashReady=true; }
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
      capturePoseSnapshot(); P.blendT=0; P.blendDur=0.12;
      P.clip=mv.recoverClip; P.clipT=0; P.clipDur=CLIPS[mv.recoverClip].dur;
    }
    if(P.clip===mv.recoverClip) P.clipT+=dt;

    // 挥砍主体段开启拖尾(strike前一点开始，cancel停止)
    if(mv.trail && !P._trailStarted && P.moveT>=mv.strike-0.10){ P._trailStarted=true; startTrail(mv.trailSegs||(mv.spinY?26:4)); }
    // 命中瞬间：触发特效 + 顿帧 + 检测打到的物体
    if(!P.struck && P.moveT>=mv.strike){ P.struck=true; if(mv.fx) fireFx(mv.fx);
      if(mv.thrustHit) tryThrustHit();
      else if(mv.ringHit && !mv.spinY) tryRingHit();
      else if(!mv.ringHit && !mv.spinY && !mv.landHit && !mv.plunge) tryHitObjects(mv.hitR||0); }
    // 大风车：判定跟随剑的旋转角度(扫到哪个角度,那个角度才命中)
    if(mv.spinY && P.spin>0 && P.spin<1){
      // 每完成一圈就重置命中记录,让转几圈打几次
      const turns=mv.spinTurns||1;
      const curRot=Math.floor(P.spin*turns);
      if(P._lastSpinRot===undefined||curRot!==P._lastSpinRot){ P._spinHit&&P._spinHit.clear(); P._lastSpinRot=curRot; }
      trySweepHit();
    }
    // aJupiter 多段：每转一整圈再打一次
    if(P.move==='aJupiter' && P.struck && !P._plungeDone){
      const curRev=Math.floor(_jSpin/(Math.PI*2));
      if(P._jupRev!==curRev){ P._jupRev=curRev; if(curRev>0) tryJupiterHit(); }
    }
    // 突刺判定：滑行全程持续命中(长矩形)
    if(mv.thrustHit && P.struck && P.moveT<mv.cancel){ tryThrustHit(); }
    // 挥砍结束后让拖尾淡出(大风车记录到招式末尾以画满整圈，其余到cancel)
    const trailStop = mv.spinY ? mv.total : mv.cancel;
    if(mv.trail && trailActive && P.moveT>=trailStop){ stopTrail(); }

    // 空中俯冲砸：落地瞬间转入插地僵直动画
    if(mv.plunge && onGround && P.moveT>0.05 && !P._plungeDone){
      P._plungeDone=true;
      // 木星球体变身：落地瞬间恢复角色
      if(jupiterActive){ jupiterActive=false; jupiterBall.visible=false; char.traverse(o=>{ if(o.isMesh) o.visible=true; }); body.rotation.x=0; }
      if(P._jupSword){ P._jupSword=false; weaponSocket.attach(weapon); weapon.position.set(0,0,0); weapon.rotation.set(0,0,0); }
      P.chargeLock=true;   // 落地后短暂锁定重击,防止连按重击意外触发地面大风车
      if(jupiterActive){jupiterActive=false;jupiterBall.visible=false;}
      if(mv.landFx) fireFx(mv.landFx);              // 落地冲击特效(aChop=slam / aStomp=stomp)
      if(mv.landHit) tryHitObjects(mv.hitR||0);     // 落地正前判定(仅 aChop；aStomp 的判定在 doStomp 周身AoE)
      P.clip=mv.plunge; P.clipDur=CLIPS[mv.plunge].dur; P.clipT=0;
      P.moveT=mv.total; P._customRecover=CLIPS[mv.plunge].dur;
    }
    // 空中招自然落地泄力(升龙剑等)：没接招自然下落着地时，播 landClip 收势
    if(mv.landClip && !mv.plunge && onGround && P._launched && !P._plungeDone && P.moveT>0.30){
      P._plungeDone=true;
      capturePoseSnapshot(); P.blendT=0; P.blendDur=0.10;
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
    ghostTimer-=dt; if(ghostTimer<=0){ spawnGhost(); ghostTimer=0.04; }
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
  updateTrail(dt); updateBeams(dt); updateSpinRings(dt); updateSpaceSlash(dt); updateStomps(dt);
}
function angleDelta(a,b){let d=(b-a)%(Math.PI*2);if(d>Math.PI)d-=Math.PI*2;if(d<-Math.PI)d+=Math.PI*2;return d;}

// ============================================================
//  自动地图：同一份场景登记数据生成小地图和展开地图
// ============================================================
const miniMapCanvas=document.getElementById('miniMapCanvas');
const miniMapCtx=miniMapCanvas.getContext('2d');
const miniMapModeBtn=document.getElementById('miniMapMode');
const compassLabel=document.getElementById('compassLabel');
const worldMapOverlay=document.getElementById('worldMapOverlay');
const worldMapCanvas=document.getElementById('worldMapCanvas');
const worldMapCtx=worldMapCanvas.getContext('2d');
let miniMapFollowFacing=false;
let mapFrame=0;
miniMapModeBtn.onclick=()=>{
  miniMapFollowFacing=!miniMapFollowFacing;
  miniMapModeBtn.textContent=miniMapFollowFacing?'↑':'N';
  miniMapModeBtn.title=miniMapFollowFacing?'角色朝向固定':'北向固定';
  compassLabel.textContent=miniMapFollowFacing?'':'N';
};
document.getElementById('mapDockBtn').onclick=()=>{
  clearGameplayInputState();
  worldMapOverlay.classList.add('open');
  drawWorldMap();
};
document.getElementById('closeWorldMap').onclick=()=>{clearGameplayInputState();worldMapOverlay.classList.remove('open');};
worldMapOverlay.addEventListener('click',e=>{ if(e.target===worldMapOverlay){clearGameplayInputState();worldMapOverlay.classList.remove('open');} });
addEventListener('keydown',e=>{
  if(e.code==='Escape' && worldMapOverlay.classList.contains('open')){clearGameplayInputState();worldMapOverlay.classList.remove('open');}
});

function colorToCss(color,alpha=1){
  const c=new THREE.Color(color);
  return `rgba(${Math.round(c.r*255)},${Math.round(c.g*255)},${Math.round(c.b*255)},${alpha})`;
}
function worldToMapPoint(x,z,scale,view,canvas){
  return {x:canvas.width/2+(x-view.x)*scale,y:canvas.height/2+(z-view.z)*scale};
}
function drawRotRect(ctx,feature,scale,view,canvas,fill,stroke,lineWidth=1){
  const p=worldToMapPoint(feature.x,feature.z,scale,view,canvas);
  ctx.save();
  ctx.translate(p.x,p.y);
  ctx.rotate(feature.rot);
  ctx.fillStyle=fill;
  ctx.strokeStyle=stroke;
  ctx.lineWidth=lineWidth;
  ctx.fillRect(-feature.w*scale/2,-feature.d*scale/2,feature.w*scale,feature.d*scale);
  if(stroke) ctx.strokeRect(-feature.w*scale/2,-feature.d*scale/2,feature.w*scale,feature.d*scale);
  ctx.restore();
}
function drawPlayerMarker(ctx,scale,view,canvas,big=false){
  const p=worldToMapPoint(P.x,P.z,scale,view,canvas);
  const markerRot=miniMapFollowFacing && !big ? 0 : Math.PI-P.facing;
  ctx.save();
  ctx.translate(p.x,p.y);
  ctx.rotate(markerRot);
  ctx.fillStyle='#fff0a6';
  ctx.strokeStyle='#2a1a0c';
  ctx.lineWidth=big?3:2;
  ctx.beginPath();
  ctx.moveTo(0,big?-13:-9);
  ctx.lineTo(big?8:6,big?9:7);
  ctx.lineTo(0,big?5:3);
  ctx.lineTo(big?-8:-6,big?9:7);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
function drawMap(ctx,canvas,{centerX=0,centerZ=0,scale=4,rot=0,big=false}={}){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  const view={x:centerX,z:centerZ,rot};
  ctx.save();
  ctx.translate(canvas.width/2,canvas.height/2);
  if(rot) ctx.rotate(rot);
  ctx.translate(-canvas.width/2,-canvas.height/2);
  ctx.fillStyle=big?'#302b20':'#2f2b20';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle='rgba(229,204,142,0.14)';
  ctx.lineWidth=1;
  const gridStep=big?10:8;
  for(let gx=-60;gx<=60;gx+=gridStep){
    const a=worldToMapPoint(gx,-60,scale,view,canvas), b=worldToMapPoint(gx,60,scale,view,canvas);
    ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
  }
  for(let gz=-60;gz<=60;gz+=gridStep){
    const a=worldToMapPoint(-60,gz,scale,view,canvas), b=worldToMapPoint(60,gz,scale,view,canvas);
    ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
  }
  for(const f of mapFeatures.filter(m=>m.type==='terrain')) drawRotRect(ctx,f,scale,view,canvas,colorToCss(f.color,0.86),'rgba(20,18,14,0.18)');
  for(const f of mapFeatures.filter(m=>m.type==='road')) drawRotRect(ctx,f,scale,view,canvas,colorToCss(f.color,0.9),'rgba(245,221,160,0.18)');
  for(const f of mapFeatures.filter(m=>m.type==='wall')) drawRotRect(ctx,f,scale,view,canvas,'rgba(88,70,47,0.92)','rgba(36,25,15,0.7)');
  for(const f of mapFeatures.filter(m=>m.type==='building')){
    const fill=f.tower?'#b8aea0':f.stone?'#a9a091':'#b99b6e';
    drawRotRect(ctx,f,scale,view,canvas,fill,'rgba(60,36,20,0.9)',big?2:1);
    if(big && (f.sign||f.name)){
      const p=worldToMapPoint(f.x,f.z,scale,view,canvas);
      ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(-(view.rot||0));
      ctx.fillStyle='#f3d995'; ctx.font='bold 14px Arial, sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(f.sign||f.name,0,0);
      ctx.restore();
    }
  }
  for(const f of mapFeatures.filter(m=>m.type==='training'||m.type==='monster')){
    const p=worldToMapPoint(f.x,f.z,scale,view,canvas);
    ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(-(view.rot||0));
    ctx.fillStyle=f.type==='monster'?'#b45b7a':'#d49a4a';
    ctx.strokeStyle='rgba(20,12,8,0.8)';
    ctx.lineWidth=big?2:1;
    ctx.beginPath(); ctx.arc(0,0,big?7:4,0,Math.PI*2); ctx.fill(); ctx.stroke();
    if(big){ctx.fillStyle='#f0d68a'; ctx.font='12px Arial, sans-serif'; ctx.fillText(f.type==='monster'?'怪':'桩',0,4);}
    ctx.restore();
  }
  ctx.restore();
  drawPlayerMarker(ctx,scale,{x:centerX,z:centerZ,rot:0},canvas,big);
  if(!big){
    ctx.save();
    ctx.globalCompositeOperation='destination-in';
    ctx.beginPath(); ctx.arc(canvas.width/2,canvas.height/2,canvas.width/2-3,0,Math.PI*2); ctx.fill();
    ctx.restore();
    ctx.strokeStyle='rgba(255,226,146,0.55)';
    ctx.lineWidth=3;
    ctx.beginPath(); ctx.arc(canvas.width/2,canvas.height/2,canvas.width/2-4,0,Math.PI*2); ctx.stroke();
  }
}
function drawMiniMap(){
  const scale=6.3;
  const rot=miniMapFollowFacing?P.facing-Math.PI:0;
  drawMap(miniMapCtx,miniMapCanvas,{centerX:P.x,centerZ:P.z,scale,rot,big:false});
}
function drawWorldMap(){
  const scale=Math.min((worldMapCanvas.width-90)/(ROOM*2),(worldMapCanvas.height-90)/(ROOM*2));
  drawMap(worldMapCtx,worldMapCanvas,{centerX:0,centerZ:0,scale,rot:0,big:true});
  worldMapCtx.save();
  worldMapCtx.fillStyle='#f0d68a'; worldMapCtx.font='bold 18px Arial, sans-serif'; worldMapCtx.textAlign='center';
  worldMapCtx.fillText('N',worldMapCanvas.width/2,34);
  worldMapCtx.fillText('S',worldMapCanvas.width/2,worldMapCanvas.height-18);
  worldMapCtx.fillText('W',28,worldMapCanvas.height/2);
  worldMapCtx.fillText('E',worldMapCanvas.width-28,worldMapCanvas.height/2);
  worldMapCtx.restore();
}
function updateFx(dt){
  // 刀光横扫（_from→_to 由招式指定方向）
  if(slashMesh.visible){
    slashMesh._t+=dt;const k=slashMesh._t/slashMesh._dur;
    slashMat.opacity=Math.max(0,0.85*(1-k));
    const f=slashPivot._from??0.8, t=slashPivot._to??-0.9;
    slashPivot.rotation.y=f+(t-f)*k;
    if(k>=1){ slashMesh.visible=false; slashMesh.scale.setScalar(1); }
  }
  // 重击圆圈爆发淡出
  if(heavyFill._dur){
    heavyFill._t+=dt;const k=heavyFill._t/heavyFill._dur;
    heavyFillMat.opacity=Math.max(0,0.55*(1-k));
    heavyRingMat.opacity=Math.max(0,0.9*(1-k));
    if(k>=1){ heavyFill._dur=0; heavyFill.visible=false; heavyRing.visible=false; heavyRing._burst=false; }
  }
  // 闪避残影淡出
  for(const g of ghosts){
    if(g.visible){ g.life-=dt; g.material.opacity=Math.max(0,g.life*1.8); if(g.life<=0)g.visible=false; }
  }
  // 柱子受击：红光闪烁 + 微微颤抖
  for(const o of hittables){
    if(o.flashT>0){
      o.flashT-=dt;
      const k=Math.max(0,o.flashT/0.18);
      o.mat.emissive.setHex(0xff2a1a); o.mat.emissiveIntensity=k*1.4;
    } else { o.mat.emissiveIntensity=0; }
    if(o.shakeT>0){
      o.shakeT-=dt;
      const a=o.shakeT*0.9;
      if(o.mesh){o.mesh.position.x=o.baseX+(Math.random()-0.5)*a;
      o.mesh.position.z=o.baseZ+(Math.random()-0.5)*a;}
    } else if(o.mesh){ o.mesh.position.x=o.baseX; o.mesh.position.z=o.baseZ; }
  }
  // 木人桩：后仰回弹(弹簧物理) + 红闪 + 剑气命中检测
  for(const d of dummies){
    // 弹簧回弹: 角度向0回弹，带阻尼
    d.tiltVel += (-38*d.tilt - 6*d.tiltVel)*dt;
    d.tilt += d.tiltVel*dt;
    d.pivot.rotation.x = d.tilt*0.12;       // 后仰(绕底座)
    if(d._beamCd>0) d._beamCd-=dt;
    if(d._thrustCd>0) d._thrustCd-=dt;
    // 红闪
    if(d.flashT>0){
      d.flashT-=dt; const k=Math.max(0,d.flashT/0.25);
      for(const m of d.mats){ m.emissive.setHex(0xff3020); m.emissiveIntensity=k*1.2; }
    } else { for(const m of d.mats) m.emissiveIntensity=0; }
  }
  // 小怪：占位受击反馈，先做红闪+轻微后仰，后续再接AI/血条/死亡
  for(const m of monsters){
    m.tiltVel += (-30*m.tilt - 5*m.tiltVel)*dt;
    m.tilt += m.tiltVel*dt;
    m.root.rotation.x = m.tilt*0.08;
    if(m._beamCd>0) m._beamCd-=dt;
    if(m._thrustCd>0) m._thrustCd-=dt;
    if(m.flashT>0){
      m.flashT-=dt; const k=Math.max(0,m.flashT/0.25);
      for(const mat of m.mats){ if(mat?.emissive){ mat.emissive.setHex(0xff3020); mat.emissiveIntensity=k*1.25; } }
    } else {
      for(const mat of m.mats){ if(mat?.emissive) mat.emissiveIntensity=0; }
    }
  }
}
// 生成一个残影快照
function spawnGhost(){
  const g=ghosts[ghostIdx]; ghostIdx=(ghostIdx+1)%ghosts.length;
  g.position.set(P.x, P.y+1.1, P.z); g.rotation.y=yaw.rotation.y;   // 跟随跳跃高度，残影在人背后
  g.visible=true; g.life=0.32; g.material.opacity=0.5;
}

// ============================================================
//  姿态
// ============================================================
function lerpRot(j,axis,target,k){ j.rotation[axis]=THREE.MathUtils.lerp(j.rotation[axis],target,k); }
function poseCharacter(dt){
  char.position.set(P.x,P.y,P.z);
  resetJoints();
  body.rotation.set(0,0,0); body.position.set(0,0,0);
  clipBodyY=null; clipBodyLean=null; clipBodyYaw=null; clipBodySide=null; clipGripMode=null;   // 每帧重置动作驱动的身体下沉/前倾/握剑
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
    applyClip(P.clip, P.clipT, blend);
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

  // 动作驱动的身体下沉/前倾优先(弓步发力链)，否则用默认 bob/lean
  body.position.y += (clipBodyY!==null)? clipBodyY : bob;
  if(!spinning){
    const targetLean = (clipBodyLean!==null)? clipBodyLean : lean;
    body.rotation.x=THREE.MathUtils.lerp(body.rotation.x,targetLean,0.5);
  }
  if(clipBodyYaw!==null) body.rotation.y=THREE.MathUtils.lerp(body.rotation.y,clipBodyYaw,0.5);
  if(clipBodySide!==null) body.rotation.z=THREE.MathUtils.lerp(body.rotation.z,clipBodySide,0.5);

  // 握剑姿态：gripMode 0=斜握默认 / 1=突刺枪式(剑沿小臂延长线)
  const GRIP_DEFAULT=Math.PI*0.5-0.35, GRIP_SPEAR=Math.PI;
  const gm = (clipGripMode!==null)?clipGripMode:0;
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

// 相机/HUD/渲染
const _camTarget=new THREE.Vector3(), _camIdeal=new THREE.Vector3(), _camDir=new THREE.Vector3(), _camPos=new THREE.Vector3();
let currentInterior=null;
function updateInteriorState(){
  let active=null;
  for(const area of interiors){
    const inside=pointInRotRect(P.x,P.z,area,-0.35);
    area.inside=inside;
    if(area.roof) area.roof.visible=!inside;
    if(inside) active=area;
  }
  currentInterior=active;
}
function isCameraBlockedAt(pos){
  const pad=0.18;
  for(const c of colliders){
    const top=c.top??4.2, bottom=c.bottom??0;
    if(pos.y<bottom || pos.y>top) continue;
    if(pos.x>=c.minx-pad && pos.x<=c.maxx+pad && pos.z>=c.minz-pad && pos.z<=c.maxz+pad) return true;
  }
  return false;
}
function cameraClearDistance(target, idealDistance, minDistance=cameraRig.minDistance){ return idealDistance;
  _camDir.copy(cameraOffset(1)).normalize();
  const start=currentInterior?0.8:2.2, steps=currentInterior?36:28;
  let clear=idealDistance;
  for(let i=0;i<=steps;i++){
    const d=start+(idealDistance-start)*(i/steps);
    _camPos.copy(target).addScaledVector(_camDir,d);
    if(_camPos.y<0.55) _camPos.y=0.55;
    if(isCameraBlockedAt(_camPos)){ clear=Math.max(minDistance,d-1.6); break; }
  }
  return clear;
}
function updateCamera(dt){
  cameraRig.targetYaw += cameraRig.stickX*cameraRig.yawSpeed*dt;
  cameraRig.targetPitch = Math.max(cameraRig.minPitch, Math.min(cameraRig.maxPitch,
    cameraRig.targetPitch + cameraRig.stickY*cameraRig.pitchSpeed*dt));
  cameraRig.yaw   += angleDelta(cameraRig.yaw,   cameraRig.targetYaw)  * Math.min(1,dt*10);
  cameraRig.pitch  = THREE.MathUtils.lerp(cameraRig.pitch, cameraRig.targetPitch, Math.min(1,dt*10));
  const dist = cameraRig.outdoorDistance;
  const cp = Math.cos(cameraRig.pitch), sp = Math.sin(cameraRig.pitch);
  const cy = Math.cos(cameraRig.yaw),   sy = Math.sin(cameraRig.yaw);
  const tgt = new THREE.Vector3(P.x, P.y + 1.7, P.z);
  const ideal = new THREE.Vector3(
    tgt.x + sy * cp * dist,
    tgt.y + sp * dist,
    tgt.z + cy * cp * dist);
  ideal.y = Math.max(ideal.y, 1.0);
  camera.position.copy(ideal);
  if(shake>0){camera.position.x+=(Math.random()-0.5)*shake;camera.position.y+=(Math.random()-0.5)*shake;}
  camera.lookAt(tgt);
}
const stamBar=document.getElementById('stamBar'),stateEl=document.getElementById('state');
function updateHUD(){
  const r=P.stamina/P.staminaMax;stamBar.style.width=(r*100)+'%';stamBar.style.background=r<0.28?'#d9534f':'#5bc0de';
  let st;
  if(P.dead) st='倒下';
  else if(P.state==='dodge') st='闪避冲刺';
  else if(P.charging) st='蓄力 '+(Math.min(1,P.chargeT/HEAVY_CHARGE_TIME)*100|0)+'%'+(P.chargeFull?' 满!':'');
  else if(P.move) st='连招: '+P.move+(P.phase==='hold'?'(收势)':P.phase==='startup'?'(预备)':'');
  else if(P.state==='taunt') st='推眼镜';
  else if(P.jumping) st='跳跃';
  else if(P.moving) st='奔跑';
  else st='待机';
  stateEl.textContent='状态: '+st;
  mapFrame++;
  if(mapFrame%2===0) drawMiniMap();
  if(worldMapOverlay.classList.contains('open') && mapFrame%6===0) drawWorldMap();
}
function resize(){const w=innerWidth,h=innerHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}
addEventListener("resize",resize);resize();padStatus();
document.getElementById("loading").style.display="none";
function loop(){let dt=clock.getDelta();if(dt>0.05)dt=0.05;update(dt);try{updateWolf(dt);}catch(e){console.error("wolf err:",e);}
if(skyData) updateSky(dt, clock.getElapsedTime());updateWater(clock.getElapsedTime());updateCamera(dt);
const _t=clock.getElapsedTime();if(window._grassMats)for(const m of window._grassMats)m.uniforms.uTime.value=_t;
// ── 水面反射 pass ──────────────────────────────────────────
const _rW=renderer.domElement.width,_rH=renderer.domElement.height;
if(reflRT.width!==_rW||reflRT.height!==_rH){reflRT.setSize(_rW,_rH);sceneRT.setSize(_rW,_rH);if(typeof wSurfMat!=='undefined')wSurfMat.uniforms.uRes.value.set(_rW,_rH);}
const _wY=-2;
_reflM.set(1,0,0,0, 0,-1,0,2*_wY, 0,0,1,0, 0,0,0,1);
reflCam.projectionMatrix.copy(camera.projectionMatrix);
reflCam.matrixWorld.copy(_reflM).multiply(camera.matrixWorld);
reflCam.matrixWorldInverse.copy(reflCam.matrixWorld).invert();
_reflClip.constant=-_wY;
for(const m of waterReflectionMeshes)m.visible=false;
renderer.setRenderTarget(reflRT);renderer.clippingPlanes=[_reflClip];renderer.render(scene,reflCam);
for(const m of waterReflectionMeshes)m.visible=true;
renderer.setRenderTarget(null);renderer.clippingPlanes=[];
// ── 最终渲染 ────────────────────────────────────
renderer.render(scene,camera);requestAnimationFrame(loop);}
loop();
}
