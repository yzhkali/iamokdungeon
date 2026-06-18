// wolf.js — Procedural wolf monster for I am OK Dungeon
// 身体沿-Z朝向（头朝-Z）; 挂在scene上, 每帧call wolf.update(dt)

export function makeWolf(THREE, scene, ox=0, oy=0, oz=0) {

const MAT = {
  fur:   new THREE.MeshLambertMaterial({color:0x3c3c42}),
  light: new THREE.MeshLambertMaterial({color:0x606068}),
  dark:  new THREE.MeshLambertMaterial({color:0x111114}),
  eye:   new THREE.MeshBasicMaterial({color:0xff1a1a}),
  mouth: new THREE.MeshLambertMaterial({color:0xaa2222}),
};

const box = (w,h,d,m=MAT.fur)=>new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);

// ── ROOT ───────────────────────────────────────────
const root = new THREE.Group();
root.position.set(ox,oy,oz);
scene.add(root);

// ── BODY (pivot: center) ───────────────────────────
const body = new THREE.Group();
body.position.set(0, 0.62, 0);
root.add(body);
body.add(box(0.68,0.46,1.10));

// ── HIPS (pivot: spine-hip joint) ─────────────────
const hips = new THREE.Group();
hips.position.set(0, 0, 0.46);
body.add(hips);
const hipsMesh = box(0.60,0.42,0.44);
hipsMesh.position.set(0,0,0.20);
hips.add(hipsMesh);

// ── TAIL ──────────────────────────────────────────
const tail1 = new THREE.Group();
tail1.position.set(0,0.10,0.38);
hips.add(tail1);
const t1m = box(0.19,0.19,0.30,MAT.light);
t1m.position.set(0,0,0.13); tail1.add(t1m);
const tail2 = new THREE.Group();
tail2.position.set(0,0.08,0.28); tail1.add(tail2);
const t2m = box(0.14,0.14,0.26,MAT.light);
t2m.position.set(0,0,0.11); tail2.add(t2m);

// ── NECK ──────────────────────────────────────────
const neck = new THREE.Group();
neck.position.set(0,0.10,-0.50);
neck.rotation.x = -0.42;
body.add(neck);
const neckMesh = box(0.36,0.36,0.44);
neckMesh.position.set(0,0,-0.18); neck.add(neckMesh);

// ── HEAD ──────────────────────────────────────────
const head = new THREE.Group();
head.position.set(0,0.06,-0.40); neck.add(head);
const headMesh = box(0.64,0.58,0.54);
headMesh.position.set(0,0.04,0); head.add(headMesh);

// ── UPPER JAW (hinge: front of head) ──────────────
const upperJaw = new THREE.Group();
upperJaw.position.set(0,-0.08,-0.28); head.add(upperJaw);
const ujm = box(0.50,0.20,0.42);
ujm.position.set(0,-0.06,-0.17); upperJaw.add(ujm);
const uTeeth = box(0.40,0.08,0.06,MAT.light);
uTeeth.position.set(0,-0.14,-0.20); upperJaw.add(uTeeth);

// ── LOWER JAW (hinge: below upper jaw) ────────────
const lowerJaw = new THREE.Group();
lowerJaw.position.set(0,-0.18,-0.26); head.add(lowerJaw);
const ljm = box(0.48,0.17,0.40);
ljm.position.set(0,-0.06,-0.16); lowerJaw.add(ljm);
const mouthInner = box(0.42,0.09,0.32,MAT.mouth);
mouthInner.position.set(0,0.02,-0.14); lowerJaw.add(mouthInner);

// ── EARS ──────────────────────────────────────────
for(const sx of [-0.22,0.22]){
  const ear = box(0.11,0.26,0.09);
  ear.position.set(sx,0.34,-0.06);
  ear.rotation.z = sx>0?0.18:-0.18;
  head.add(ear);
}
// ── EYES ──────────────────────────────────────────
for(const sx of [-0.23,0.23]){
  const eye = box(0.09,0.08,0.05,MAT.eye);
  eye.position.set(sx,0.08,-0.28); head.add(eye);
}

// ── LEGS ──────────────────────────────────────────
function makeLeg(sx, zPos, parent, big=false){
  const s = big?1.18:1;
  const ug = new THREE.Group();
  ug.position.set(sx, -0.20, zPos); parent.add(ug);
  const um = box(0.24*s,0.44*s,0.24*s);
  um.position.set(0,-0.20,0); ug.add(um);

  const lg = new THREE.Group();
  lg.position.set(0,-0.43,0); ug.add(lg);
  const lm = box(0.20*s,0.42*s,0.20*s);
  lm.position.set(0,-0.19,0); lg.add(lm);

  const pg = new THREE.Group();
  pg.position.set(0,-0.40,0); lg.add(pg);
  const pm = box(0.26*s,0.13,0.38*s,MAT.dark);
  pm.position.set(0,-0.05,-0.04); pg.add(pm);

  return {g:ug, lo:lg, paw:pg};
}

const FL = makeLeg(-0.27,-0.28,body);
const FR = makeLeg( 0.27,-0.28,body);
const BL = makeLeg(-0.24, 0.16,hips,true);
const BR = makeLeg( 0.24, 0.16,hips,true);

// ── JOINT REFS ────────────────────────────────────
const J = {body,hips,neck,head,upperJaw,lowerJaw,tail1,tail2,
           FL,FR,BL,BR};

// ── WOLF STATE ────────────────────────────────────
let state='idle', phase=0, onDone=null;
const BASE_Y = 0.62;

function lerp(a,b,t){return a+(b-a)*Math.min(1,Math.max(0,t));}
function lerpR(g,x,y,z,t=0.15){
  g.rotation.x=lerp(g.rotation.x,x,t);
  g.rotation.y=lerp(g.rotation.y,y,t);
  g.rotation.z=lerp(g.rotation.z,z,t);
}

// ── ANIMATION UPDATE ──────────────────────────────
function update(dt){
  phase += dt;
  const S=Math.sin, t=phase;

  // 每帧先重置腿的paw
  J.body.position.y = BASE_Y;

  switch(state){

  case 'idle':{
    // 呼吸+尾巴摆+偶尔晃头
    J.body.position.y = BASE_Y + S(t*1.4)*0.018;
    lerpR(J.neck,  -0.42+S(t*0.7)*0.06, 0, 0, 0.08);
    lerpR(J.head,  S(t*0.9)*0.05, S(t*0.5)*0.04, 0, 0.08);
    lerpR(J.tail1, -0.2+S(t*2.2)*0.35, 0, S(t*1.8)*0.25, 0.1);
    lerpR(J.tail2, S(t*2.5)*0.30, 0, S(t*2.0)*0.20, 0.1);
    lerpR(J.upperJaw, 0,0,0,0.1); lerpR(J.lowerJaw,0,0,0,0.1);
    // 腿静止
    for(const L of [J.FL,J.FR,J.BL,J.BR]){lerpR(L.g,0,0,0,0.1);lerpR(L.lo,0.12,0,0,0.1);}
    break;}

  case 'wander':{
    // 慢速溜达步态
    const sp=1.6, stride=0.30;
    J.body.position.y = BASE_Y + S(t*sp*2)*0.025;
    J.body.rotation.z = S(t*sp)*0.04;
    lerpR(J.neck,-0.55+S(t*sp)*0.08,0,0,0.1);
    lerpR(J.head,S(t*sp)*0.06,0,0,0.1);
    lerpR(J.tail1,-0.1+S(t*sp*1.5)*0.45,0,S(t*sp)*0.3,0.12);
    // 对角步态
    J.FL.g.rotation.x = S(t*sp)*stride;
    J.BR.g.rotation.x = S(t*sp)*stride;
    J.FR.g.rotation.x = S(t*sp+Math.PI)*stride;
    J.BL.g.rotation.x = S(t*sp+Math.PI)*stride;
    for(const L of [J.FL,J.FR,J.BL,J.BR]) L.lo.rotation.x=0.12+Math.max(0,-L.g.rotation.x)*0.5;
    break;}

  case 'run':{
    // 快速奔跑
    const sp=4.5, stride=0.55;
    J.body.position.y = BASE_Y + Math.abs(S(t*sp*2))*0.06;
    J.body.rotation.x = 0.15;
    lerpR(J.neck,-0.25,0,0,0.15);
    lerpR(J.head,0.1,0,0,0.15);
    J.tail1.rotation.x = -0.6;
    // 奔跑：前腿同相，后腿相差半相
    const ph=t*sp;
    J.FL.g.rotation.x = S(ph)*stride;
    J.FR.g.rotation.x = S(ph+0.4)*stride;
    J.BL.g.rotation.x = S(ph+Math.PI)*stride*1.2;
    J.BR.g.rotation.x = S(ph+Math.PI+0.4)*stride*1.2;
    for(const L of [J.FL,J.FR,J.BL,J.BR]) L.lo.rotation.x=0.1+Math.max(0,-L.g.rotation.x)*0.7;
    break;}

  case 'pounce':{
    // 后腿站立→前扑（phase 0→1）
    const p=Math.min(1,phase/1.2);
    if(p<0.3){       // 蓄力：后腿蹲
      const q=p/0.3;
      lerpR(J.BL.g,0.5*q,0,0,0.3); lerpR(J.BR.g,0.5*q,0,0,0.3);
      lerpR(J.FL.g,-0.4*q,0,0,0.3); lerpR(J.FR.g,-0.4*q,0,0,0.3);
      lerpR(J.neck,-0.8*q,0,0,0.2); lerpR(J.body,0,0,0,0.1);
    } else if(p<0.6){ // 扑：身体腾空，前爪高举
      const q=(p-0.3)/0.3;
      lerpR(J.body,-0.6*q,0,0,0.2);
      lerpR(J.FL.g,-1.2,0,0,0.25); lerpR(J.FR.g,-1.2,0,0,0.25);
      lerpR(J.BL.g,-0.3,0,0,0.2);  lerpR(J.BR.g,-0.3,0,0,0.2);
    } else {          // 落地+拍击
      const q=(p-0.6)/0.4;
      lerpR(J.FL.g,0.8*q,0,0,0.35); lerpR(J.FR.g,0.8*q,0,0,0.35);
      lerpR(J.body,0.3*q,0,0,0.2);
    }
    if(p>=1){ setState('idle'); }
    break;}

  case 'bite':{
    // 冲咬：张嘴→快速咬合
    const p=Math.min(1,phase/0.8);
    const jawOpen = p<0.4 ? p/0.4 : 1-(p-0.4)/0.6;
    lerpR(J.upperJaw,-jawOpen*0.35,0,0,0.4);
    lerpR(J.lowerJaw, jawOpen*0.45,0,0,0.4);
    lerpR(J.neck,-0.2,0,0,0.2); lerpR(J.head,0.2,0,0,0.2);
    if(p>=1){ setState('idle'); }
    break;}

  case 'dodge':{
    // 侧向闪避
    const p=Math.min(1,phase/0.5);
    const side = p<0.5 ? p/0.5 : 1-(p-0.5)/0.5;
    root.position.x = ox + side*1.5;
    lerpR(J.body,0,0,-side*0.4,0.3);
    if(p>=1){ root.position.x=ox; setState('idle'); }
    break;}

  case 'hurt':{
    const p=Math.min(1,phase/0.5);
    const r = p<0.3 ? p/0.3 : 1-(p-0.3)/0.7;
    lerpR(J.body,-r*0.4,0,0,0.4);
    lerpR(J.neck,-0.42-r*0.3,0,0,0.3);
    lerpR(J.head,-r*0.25,0,0,0.3);
    if(p>=1) setState('idle');
    break;}

  case 'death':{
    const p=Math.min(1,phase/2.0);
    lerpR(J.body, p*1.4,0,p*0.6,0.05);
    J.body.position.y = lerp(BASE_Y, 0.15, p);
    lerpR(J.neck,-0.42+p*0.8,0,0,0.06);
    lerpR(J.head, p*0.5,0,0,0.06);
    for(const L of [J.FL,J.FR,J.BL,J.BR]){
      lerpR(L.g,p*0.6,0,0,0.06);
      lerpR(L.lo,0.12+p*0.4,0,0,0.06);
    }
    // 死了就停着不reset
    break;}

  case 'howl':{
    const p=Math.min(1,phase/3.0);
    // 头仰起，嘴慢慢张开
    const jawAng = p<0.3 ? (p/0.3)*0.5 : p<0.8 ? 0.5 : 0.5*(1-(p-0.8)/0.2);
    lerpR(J.neck,-1.1,0,0,0.06);
    lerpR(J.head,-0.5,0,0,0.06);
    lerpR(J.upperJaw,-jawAng*0.4,0,0,0.08);
    lerpR(J.lowerJaw, jawAng*0.5,0,0,0.08);
    J.tail1.rotation.x = -0.8+S(t*3)*0.2;
    if(p>=1) setState('idle');
    break;}
  }
}

function setState(s){ state=s; phase=0; }

return { root, J, update, setState,
         get state(){ return state; },
         ox,oy,oz };
}
