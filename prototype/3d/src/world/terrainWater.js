export function buildTerrainWater({
  THREE,
  scene,
  mapData,
  mapHeights,
  terrainHeightAt,
  sceneRT,
  reflRT,
  documentRef = document,
  windowRef = globalThis,
}) {
  const terrainSize = 260;
  const terrainSegments = 130;
  const heights = mapHeights ?? new Float32Array(mapData.terrain);
  const terrainHeightAtFn = terrainHeightAt ?? ((x, z) => {
    const ix = Math.max(0, Math.min(terrainSegments, Math.round((x + terrainSize / 2) / terrainSize * terrainSegments)));
    const iz = Math.max(0, Math.min(terrainSegments, Math.round((z + terrainSize / 2) / terrainSize * terrainSegments)));
    return heights[iz * (terrainSegments + 1) + ix] ?? 0;
  });
  let fallCurtainMat = null;
  const waterMats = [];
  const waterReflectionMeshes = [];
  let mistPS = null;
  let tWater;
  let tFoam;
  let tWfall;
  let tMistTex;
  let tNorm;
  let tCaust;
  let wSurfMat;
  let _wfM1;
  let _wfM2;
  let _wfM3;
  let _wfM4;
  let _wfM5;

  const SZ = terrainSize;
  const SEG = terrainSegments;
  const tg = new THREE.PlaneGeometry(SZ, SZ, SEG, SEG);
  tg.rotateX(-Math.PI / 2);
  const pos = tg.attributes.position;
  const cols = [];
  const cDark = new THREE.Color(0x446070);
  const cLow = new THREE.Color(0xf0efe8);
  const cHigh = new THREE.Color(0xeae8e0);
  const cRock = new THREE.Color(0xe8e8e6);
  const cSnow = new THREE.Color(0xf0eef4);
  for (let i = 0; i < pos.count; i += 1) {
    const hv = terrainHeightAtFn(pos.getX(i), pos.getZ(i));
    pos.setY(i, hv);
    let c;
    if (hv < -1) c = cDark.clone().lerp(cLow, Math.min(1, (hv + 6) / 5));
    else if (hv < 5) c = cLow.clone().lerp(cHigh, Math.min(1, (hv + 1) / 6));
    else if (hv < 10) c = cHigh.clone().lerp(cRock, (hv - 5) / 5);
    else c = cRock.clone().lerp(cSnow, Math.min(1, (hv - 10) / 10));
    cols.push(c.r, c.g, c.b);
  }
  tg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(cols), 3));
  tg.computeVertexNormals();
  const _tl = new THREE.TextureLoader();
  const grassTex = _tl.load('./textures/texture_grass.png');
  const rockTex = _tl.load('./textures/texture_rock.png');
  const mountTex = _tl.load('./textures/texture_mountain.png');
  const mudTex = _tl.load('./textures/mud-riverbank-tile-512.png');
  [grassTex, rockTex, mountTex, mudTex].forEach(t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; });
  const _roadGenTex = new THREE.TextureLoader().load('./textures/texture_road.png');
  _roadGenTex.wrapS = _roadGenTex.wrapT = THREE.RepeatWrapping;
  const tm = new THREE.MeshLambertMaterial({ vertexColors: true });
  tm.onBeforeCompile = s => {
    s.uniforms.tGrass = { value: grassTex };
    s.uniforms.tRock = { value: rockTex };
    s.uniforms.tMount = { value: mountTex };
    s.uniforms.tMud = { value: mudTex };
    s.uniforms.tRoadStone = { value: _roadStoneTex };
    s.uniforms.tRoadMask = { value: _roadMaskTex };
    s.uniforms.tGenerated = { value: _roadGenTex };
    const _rc = new THREE.Color(mapData.roadColor || '#7d7260');
    s.uniforms.uRoadColor = { value: _rc };
    s.vertexShader = s.vertexShader
      .replace('void main() {', 'varying vec2 vMyUv;\nvarying float vWY;\nvarying float vNY;\nvoid main() {')
      .replace('\t#include <project_vertex>', '\t#include <project_vertex>\nvWY=position.y;\nvMyUv=uv;\nvNY=normal.y;');
    s.fragmentShader = s.fragmentShader
      .replace('void main() {', 'uniform sampler2D tGrass,tRock,tMount,tMud,tRoadStone,tRoadMask,tGenerated;uniform vec3 uRoadColor;\nvarying vec2 vMyUv;\nvarying float vWY;\nvarying float vNY;\nfloat H(vec2 q){return fract(sin(dot(q,vec2(127.1,311.7)))*43758.5);}\nvoid main() {')
      .replace('\t#include <color_fragment>', '#ifdef USE_COLOR\n  diffuseColor.rgb*=vColor.rgb;\n#endif\n{vec2 u=vMyUv*24.0;vec3 g=texture2D(tGrass,u).rgb,r=texture2D(tRock,u).rgb,m=texture2D(tMount,u).rgb*1.7,md=texture2D(tMud,u).rgb;float sr=smoothstep(.25,.55,1.-vNY),hr=smoothstep(3.,12.,vWY+g.r*4.-2.),rb=max(sr,hr),mb=smoothstep(18.,24.,vWY);float noise=g.r*3.-1.5;vec3 base=mix(mix(g,r,rb),m,mb);float mudb=1.-smoothstep(-3.,1.5,vWY+noise);vec3 terrain=mix(base,md,mudb);vec2 rmSample=texture2D(tRoadMask,vMyUv).rg;float rm=rmSample.r;float junc=rmSample.g;float hFade=1.-smoothstep(0.,8.,vWY);float rnoise=g.r*0.32+g.b*0.14+hFade*0.12;float rmn=rm-rnoise*0.28;float eNoise=(texture2D(tGrass,vMyUv*80.).r*2.-1.)*.22;float roadEdge=smoothstep(.35,.62,rmn+eNoise);float stoneW=smoothstep(.60,.85,rmn)*(1.-hFade*.65);vec3 rs=texture2D(tRoadStone,vMyUv*48.).rgb;vec3 roadMud=mix(terrain,mix(md,uRoadColor,0.55),0.65+hFade*0.25);float crackW=smoothstep(.55,.35,rs.r)*0.4;vec3 stoneWithGrass=mix(rs,g*0.8,crackW);vec3 gen=texture2D(tGenerated,vMyUv*56.).rgb;float waterMud=1.-smoothstep(-3.,0.5,vWY);float stoneWAdj=stoneW*(1.-waterMud*.95);vec3 waterRoadMud=mix(terrain,mix(md,gen,waterMud*.9),0.65+hFade*0.25);vec3 road=mix(waterRoadMud,stoneWithGrass,stoneWAdj);float jBlend=clamp(junc+eNoise*.4,0.,1.)*roadEdge;vec3 roadFinal=mix(road,gen,jBlend*.85);diffuseColor.rgb*=mix(terrain,roadFinal,roadEdge);float _luma=dot(diffuseColor.rgb,vec3(.3,.59,.11));diffuseColor.rgb=mix(vec3(_luma),diffuseColor.rgb,1.0+mudb*0.35);}');
  };
  tm.polygonOffset = true;
  tm.polygonOffsetFactor = 1;
  tm.polygonOffsetUnits = 1;
  const mesh = new THREE.Mesh(tg, tm);
  mesh.receiveShadow = true;
  scene.add(mesh);

  const _rmCanvas = documentRef.createElement('canvas');
  _rmCanvas.width = _rmCanvas.height = 131;
  const _rmCtx = _rmCanvas.getContext('2d');
  _rmCtx.fillStyle = 'black';
  _rmCtx.fillRect(0, 0, 131, 131);
  const _roadMaskTex = new THREE.CanvasTexture(_rmCanvas);
  _roadMaskTex.wrapS = _roadMaskTex.wrapT = THREE.ClampToEdgeWrapping;
  _roadMaskTex.minFilter = _roadMaskTex.magFilter = THREE.LinearFilter;
  const _roadStoneTex = new THREE.TextureLoader().load('./textures/texture_road.png');
  _roadStoneTex.wrapS = _roadStoneTex.wrapT = THREE.RepeatWrapping;
  function _buildRoadMask() {
    if (!mapData.roads || !mapData.roads.length) return;
    const vCount = (SEG + 1) * (SEG + 1);
    const mask = new Float32Array(vCount);
    const junc = new Float32Array(vCount);
    const cnt = new Float32Array(vCount);
    mapData.roads.forEach((pts, ri) => {
      const hw = (mapData.roadWidths[ri] || 8) / 2;
      const fw = hw + 6;
      for (let iz = 0; iz <= SEG; iz += 1) {
        for (let ix = 0; ix <= SEG; ix += 1) {
          const vx = (ix / SEG - 0.5) * SZ;
          const vz = (iz / SEG - 0.5) * SZ;
          let md = 1e9;
          for (let j = 0; j < pts.length - 1; j += 1) {
            const ax = pts[j][0];
            const az = pts[j][1];
            const bx = pts[j + 1][0];
            const bz = pts[j + 1][1];
            const dx = bx - ax;
            const dz = bz - az;
            const l2 = dx * dx + dz * dz;
            if (l2 < 1e-6) continue;
            const t = Math.max(0, Math.min(1, ((vx - ax) * dx + (vz - az) * dz) / l2));
            md = Math.min(md, Math.hypot(vx - (ax + t * dx), vz - (az + t * dz)));
          }
          const i = iz * (SEG + 1) + ix;
          if (md < fw) {
            mask[i] = Math.max(mask[i], Math.max(0, 1 - md / fw));
            if (md < hw + 5) cnt[i] += 1;
          }
        }
      }
    });
    for (let i = 0; i < vCount; i += 1) junc[i] = Math.min(1, (cnt[i] - 1) * 0.7);
    const d = _rmCtx.createImageData(131, 131);
    for (let i = 0; i < vCount; i += 1) {
      d.data[i * 4] = mask[i] * 255 | 0;
      d.data[i * 4 + 1] = junc[i] * 255 | 0;
      d.data[i * 4 + 3] = 255;
    }
    _rmCtx.putImageData(d, 0, 0);
    _roadMaskTex.needsUpdate = true;
  }
  _buildRoadMask();

  const FALL_Y = 1.0;
  const _wtl2 = new THREE.TextureLoader();
  tWater = _wtl2.load('./textures/texture_water.png');
  tFoam = _wtl2.load('./textures/texture_water_foam.png');
  tWfall = _wtl2.load('./textures/texture_waterfall.png');
  tMistTex = _wtl2.load('./textures/texture_waterfall_mist_splash.png');
  tNorm = _wtl2.load('./textures/texture_water_normal.png');
  tCaust = _wtl2.load('./textures/texture_caustics.png');
  [tWater, tFoam, tWfall, tNorm, tCaust].forEach(t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; });
  const _wTL = new THREE.TextureLoader();
  const _tNA = _wTL.load('./textures/water_normal_a.png');
  const _tNB = _wTL.load('./textures/water_normal_b.png');
  const _tUV = _wTL.load('./textures/water_uv.png');
  const _tFoam = _wTL.load('./textures/water_foam_godot.png');
  const _tCaust2 = _wTL.load('./textures/texture_caustics.png');
  const _tFoam2b = _wTL.load('./textures/water_foam_godot.png');
  [_tNA, _tNB, _tUV, _tFoam, _tCaust2, _tFoam2b].forEach(t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; });
  const _wHmapTex = new THREE.DataTexture(null, 131, 131, THREE.RedFormat, THREE.FloatType);
  _wHmapTex.wrapS = _wHmapTex.wrapT = THREE.ClampToEdgeWrapping;
  _wHmapTex.minFilter = _wHmapTex.magFilter = THREE.LinearFilter;
  _wHmapTex.flipY = false;
  {
    const hd = new Float32Array(heights);
    _wHmapTex.image = { data: hd, width: 131, height: 131 };
    _wHmapTex.needsUpdate = true;
  }
  wSurfMat = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uWaves: { value: 1 }, uWaterY: { value: -2 }, tNA: { value: _tNA }, tNB: { value: _tNB }, tUV: { value: _tUV }, tF: { value: _tFoam }, tCaust: { value: _tCaust2 }, tFoam2: { value: _tFoam2b }, tScene: { value: null }, tReflect: { value: null }, uRes: { value: new THREE.Vector2() }, tHmap: { value: _wHmapTex }, uDeep: { value: new THREE.Color(0x5a8f9a) }, uShallow: { value: new THREE.Color(0x92b4b8) }, uSun: { value: new THREE.Vector3(.5, 1., .3).normalize() } },
    vertexShader: 'uniform float uT;uniform float uWaves;varying vec2 vWsUv;varying vec3 vN,vV;vec3 gw(vec3 p,float s,float l,float sp,float d){vec2 dv=normalize(vec2(cos(3.14159*(d*2.-1.)),sin(3.14159*(d*2.-1.))));float k=6.28318/l,f=k*(dv.x*p.x+dv.y*p.z-sp*uT),a=s/k;return vec3(dv.x*(a*cos(f)),a*sin(f),dv.y*(a*cos(f)));}void main(){vec4 wp=modelMatrix*vec4(position,1.);vec3 wpos=wp.xyz;if(uWaves>0.){wpos+=gw(wpos,.035,22.,.7,.3)*uWaves;wpos+=gw(wpos,.028,15.,1.,2.67)*uWaves;wpos+=gw(wpos,.022,30.,.45,3.9)*uWaves;wpos+=gw(wpos,.015,12.,1.3,2.7)*uWaves;}vWsUv=wpos.xz*.08;vN=normalize(normalMatrix*normal);vec4 mv=viewMatrix*vec4(wpos,1.);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',
    fragmentShader: 'uniform float uT;uniform float uWaterY;uniform sampler2D tNA,tNB,tUV,tF,tCaust,tHmap,tFoam2,tScene,tReflect;uniform vec2 uRes;uniform vec3 uDeep,uShallow,uSun;varying vec2 vWsUv;varying vec3 vN,vV;void main(){vec2 uvOff=vec2(.05,.04)*uT;vec2 uvShift=.04*(texture2D(tUV,vWsUv*.25+uvOff).rg*2.-1.);vec2 uv=vWsUv+uvShift;vec3 N=normalize((texture2D(tNA,uv-uvOff*2.).rgb*.75+texture2D(tNB,uv+uvOff).rgb*.25)*2.-1.);vec3 nP=normalize(vN+vec3(N.x,0.,N.y)*.35);float fr=clamp(pow(1.-max(0.,dot(nP,normalize(vV))),1.5)+.04*sin(vWsUv.y*7.+uT*1.4),0.,1.);vec2 hmUV=clamp((vWsUv/0.08+130.)/260.,vec2(.001),vec2(.999));float terrainY=texture2D(tHmap,hmUV).r;float wDepth=max(0.,uWaterY-terrainY);float dB=clamp(1.-exp((wDepth-.3)*-1.2),0.,1.);vec3 dyeCol=mix(uShallow,uDeep,dB);vec3 col=dyeCol;float hue=fr*2.8+uT*.08;col=mix(col,vec3(sin(hue)*.5+.5,sin(hue+2.09)*.5+.5,sin(hue+4.18)*.5+.5),.1*fr);vec3 H=normalize(normalize(uSun)+normalize(vV));float sp=pow(max(0.,dot(nP,H)),120.);col+=vec3(1.,.98,.9)*smoothstep(.38,.42,sp)*.7;float sp2=pow(max(0.,dot(nP,H)),600.);col+=vec3(1.,1.,.95)*sp2*1.2;float bl=abs(fract(uT*.045)*2.-1.);vec2 cWob=N.xy*.12;col+=vec3(.5,.85,1.)*mix(texture2D(tCaust,vWsUv*1.8+vec2(.025,.018)*uT+cWob).a,texture2D(tCaust,vWsUv*1.8-vec2(.018,.025)*(uT+.5)-cWob).a,bl)*.18;float foamMask=1.-clamp(wDepth/.3,0.,1.);vec2 fuv1=vWsUv*2.2+vec2(.06,.18)*uT+N.xy*.1,fuv2=vWsUv*1.7+vec2(-.09,.05)*uT-N.xy*.08;float ft=(texture2D(tFoam2,fuv1).r+texture2D(tFoam2,fuv2).r)*.5;float foam=smoothstep(.65,.9,ft)*foamMask;col=mix(col,dyeCol*1.1,foamMask*.35);col=mix(col,vec3(.96,.98,1.),foam*.7);vec2 reflUV=vec2(gl_FragCoord.x/uRes.x,gl_FragCoord.y/uRes.y)+N.xy*.04;reflUV=clamp(reflUV,vec2(.001),vec2(.999));vec3 reflCol=texture2D(tReflect,reflUV).rgb;float rBrt=dot(reflCol,vec3(.3,.59,.11));float rOk=smoothstep(.04,.2,rBrt);col=mix(col,reflCol*1.5+vec3(.02,.04,.06),fr*.45*rOk);gl_FragColor=vec4(col,mix(.22,.97,fr*.8+dB*.2));}',
    transparent: true, side: THREE.FrontSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  function makeWaterMat() {
    waterMats.push(wSurfMat);
    return wSurfMat;
  }
  void makeWaterMat;
  wSurfMat.uniforms.tScene = { value: sceneRT.texture };
  wSurfMat.uniforms.tReflect = { value: reflRT.texture };
  wSurfMat.uniforms.uRes = { value: new THREE.Vector2(windowRef.innerWidth, windowRef.innerHeight) };
  const _wMain = new THREE.Mesh(new THREE.PlaneGeometry(260, 260, 60, 60), wSurfMat);
  _wMain.rotation.x = -Math.PI / 2;
  _wMain.position.y = -2;
  scene.add(_wMain);
  waterReflectionMeshes.push(_wMain);

  const _tWfall3 = new THREE.TextureLoader().load('./textures/texture_waterfall.png');
  _tWfall3.wrapS = _tWfall3.wrapT = THREE.RepeatWrapping;
  _wfM1 = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 }, tWf: { value: _tWfall3 } }, vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}', fragmentShader: 'uniform float uT;uniform sampler2D tWf;varying vec2 vUv;void main(){vec2 u=vec2(vUv.x,fract(vUv.y+uT*.65));vec4 c=texture2D(tWf,u);float e=smoothstep(0.,.1,vUv.x)*smoothstep(1.,.9,vUv.x);gl_FragColor=vec4(c.rgb,c.a*e*.9);}', transparent: true, side: THREE.DoubleSide, depthWrite: false });
  _wfM2 = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 }, tWf: { value: _tWfall3 } }, vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}', fragmentShader: 'uniform float uT;uniform sampler2D tWf;varying vec2 vUv;void main(){vec2 u=vec2(vUv.x,fract(vUv.y+(uT+.45)*.65));vec4 c=texture2D(tWf,u);float e=smoothstep(0.,.15,vUv.x)*smoothstep(1.,.85,vUv.x);gl_FragColor=vec4(c.rgb,c.a*e*.7);}', transparent: true, side: THREE.DoubleSide, depthWrite: false });
  _wfM3 = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 }, tWf: { value: _tWfall3 } }, vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}', fragmentShader: 'uniform float uT;uniform sampler2D tWf;varying vec2 vUv;void main(){vec2 u=vec2(1.-vUv.x,fract(vUv.y+uT*.55));vec4 c=texture2D(tWf,u);float e=smoothstep(0.,.12,vUv.x)*smoothstep(1.,.88,vUv.x);gl_FragColor=vec4(c.rgb,c.a*e*.6);}', transparent: true, side: THREE.DoubleSide, depthWrite: false });
  _wfM4 = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 }, tWf: { value: _tWfall3 } }, vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}', fragmentShader: 'uniform float uT;uniform sampler2D tWf;varying vec2 vUv;void main(){vec2 u=vec2(vUv.x+0.4,fract(vUv.y+(uT+.2)*.72));vec4 c=texture2D(tWf,u);float e=smoothstep(0.,.1,vUv.x)*smoothstep(1.,.9,vUv.x);gl_FragColor=vec4(c.rgb,c.a*e*.65);}', transparent: true, side: THREE.DoubleSide, depthWrite: false });
  _wfM5 = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 }, tWf: { value: _tWfall3 } }, vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}', fragmentShader: 'uniform float uT;uniform sampler2D tWf;varying vec2 vUv;void main(){vec2 u=vec2(1.-vUv.x+0.3,fract(vUv.y+(uT+.1)*.5));vec4 c=texture2D(tWf,u);float e=smoothstep(0.,.12,vUv.x)*smoothstep(1.,.88,vUv.x);gl_FragColor=vec4(c.rgb,c.a*e*.6);}', transparent: true, side: THREE.DoubleSide, depthWrite: false });

  function makeWaterPath(pts, w) {
    const wy = -2.0;
    const abv = pts.filter(p => p.y >= wy - 0.5);
    if (abv.length < 2) return null;
    const arc = [0];
    for (let i = 1; i < abv.length; i += 1) {
      const p = abv[i];
      const q = abv[i - 1];
      arc.push(arc[i - 1] + Math.hypot(p.x - q.x, p.z - q.z));
    }
    const TILE = w * 1.2;
    const v = [];
    const ix = [];
    const uvs = [];
    for (let i = 0; i < abv.length; i += 1) {
      const p = abv[i];
      let tx = 0;
      let tz = 1;
      if (i < abv.length - 1) {
        const nx = abv[i + 1].x - p.x;
        const nz = abv[i + 1].z - p.z;
        const nl = Math.hypot(nx, nz) || 1;
        tx = nx / nl;
        tz = nz / nl;
      } else if (i > 0) {
        const nx = p.x - abv[i - 1].x;
        const nz = p.z - abv[i - 1].z;
        const nl = Math.hypot(nx, nz) || 1;
        tx = nx / nl;
        tz = nz / nl;
      }
      const hw = (p.w || w) / 2;
      const u = arc[i] / TILE;
      v.push(p.x - tz * hw, p.y + 0.04, p.z + tx * hw, p.x + tz * hw, p.y + 0.04, p.z - tx * hw);
      uvs.push(u, 0, u, 1);
    }
    for (let i = 0; i < abv.length - 1; i += 1) {
      const b = i * 2;
      ix.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(v), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
    g.setIndex(ix);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, wSurfMat);
    m.renderOrder = 2;
    scene.add(m);
    waterReflectionMeshes.push(m);
    return m;
  }

  function makeWaterfallPath(pts, fh) {
    const SEGS = 12;
    const zFwd = fh * 0.55;
    const v = [];
    const ix = [];
    const uvs = [];
    for (let j = 0; j <= SEGS; j += 1) {
      const t = j / SEGS;
      const dy = -fh * t * t;
      const dz = -zFwd * t;
      for (let i = 0; i < pts.length; i += 1) {
        const p = pts[i];
        v.push(p.x, p.y + dy, p.z + dz);
        uvs.push(i / (pts.length - 1 || 1), 1 - t);
      }
    }
    for (let j = 0; j < SEGS; j += 1) {
      for (let i = 0; i < pts.length - 1; i += 1) {
        const a = j * pts.length + i;
        const b = a + 1;
        const c = a + pts.length;
        const d2 = c + 1;
        ix.push(a, c, b, b, c, d2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(v), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
    g.setIndex(ix);
    g.computeVertexNormals();
    scene.add(new THREE.Mesh(g, _wfM1));
    const g2 = g.clone();
    const p2 = g2.attributes.position.array;
    for (let i = 0; i < p2.length; i += 3) p2[i + 2] += 0.28;
    g2.attributes.position.needsUpdate = true;
    scene.add(new THREE.Mesh(g2, _wfM2));
    const g3 = g.clone();
    const p3 = g3.attributes.position.array;
    for (let i = 0; i < p3.length; i += 3) p3[i + 2] -= 0.22;
    g3.attributes.position.needsUpdate = true;
    scene.add(new THREE.Mesh(g3, _wfM3));
    const g4 = g.clone();
    const p4 = g4.attributes.position.array;
    for (let i = 0; i < p4.length; i += 3) p4[i + 2] += 0.52;
    g4.attributes.position.needsUpdate = true;
    scene.add(new THREE.Mesh(g4, _wfM4));
    const g5 = g.clone();
    const p5 = g5.attributes.position.array;
    for (let i = 0; i < p5.length; i += 3) {
      p5[i + 1] -= 0.3;
      p5[i + 2] -= 0.15;
    }
    g5.attributes.position.needsUpdate = true;
    scene.add(new THREE.Mesh(g5, _wfM5));
  }

  (mapData.waterSurfs || []).forEach(ws => { makeWaterPath(ws.pts, ws.w || 5); });
  (mapData.wfSurfs || []).forEach(wf => { makeWaterfallPath(wf.pts, wf.fh || 8); });
  const FALL_DROP = FALL_Y + 2.1;
  void FALL_DROP;
  fallCurtainMat = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, tWf: { value: tWfall } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform float uT;uniform sampler2D tWf;varying vec2 vUv;void main(){vec2 uv=vec2(vUv.x*1.5,fract(vUv.y-uT*.65));vec4 c=texture2D(tWf,uv);float e=smoothstep(0.,.1,vUv.x)*smoothstep(1.,.9,vUv.x);gl_FragColor=vec4(c.rgb,c.a*e*.9);}',
    transparent: true, side: THREE.DoubleSide, depthWrite: false,
  });

  function updateWater(t) {
    if (wSurfMat?.uniforms.uT) wSurfMat.uniforms.uT.value = t;
    for (const m of waterMats) if (m.uniforms?.uT) m.uniforms.uT.value = t;
    if (fallCurtainMat) fallCurtainMat.uniforms.uT.value = t;
    [_wfM1, _wfM2, _wfM3, _wfM4, _wfM5].forEach(m => m && (m.uniforms.uT.value = t));
    if (tCaust) tCaust.offset.set((t * .025) % 1, (t * .018) % 1);
    if (mistPS) {
      const p = mistPS.geometry.attributes.position.array;
      const N = p.length / 3;
      for (let i = 0; i < N; i += 1) {
        p[i * 3 + 1] += .004;
        if (p[i * 3 + 1] > 2.5) {
          p[i * 3] = 44 + (Math.random() - .5) * 6;
          p[i * 3 + 1] = -1.5;
          p[i * 3 + 2] = 104 + Math.random() * 6;
        }
      }
      mistPS.geometry.attributes.position.needsUpdate = true;
    }
  }

  return {
    terrainMesh: mesh,
    terrainHeightAt: terrainHeightAtFn,
    waterReflectionMeshes,
    updateWater,
    getWaterSurfaceMaterial: () => wSurfMat,
  };
}
