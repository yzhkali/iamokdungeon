// wolf.js - Procedural wolf monster for I am OK Dungeon
//

export function makeWolf(THREE, scene, ox=0, oy=0, oz=0) {

const MAT = {
  fur:   new THREE.MeshLambertMaterial({color:0x3c3c42}),
  light: new THREE.MeshLambertMaterial({color:0x606068}),
  dark:  new THREE.MeshLambertMaterial({color:0x111114}),
  eye:   new THREE.MeshBasicMaterial({color:0xff1a1a}),
  mouth: new THREE.MeshLambertMaterial({color:0xaa2222}),
};

const box = (w,h,d,m=MAT.fur)=>new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);

//
const root = new THREE.Group();
root.position.set(ox,oy,oz);
scene.add(root);

//
const body = new THREE.Group();
body.position.set(0, 0.62, 0);
root.add(body);
body.add(box(0.68,0.46,1.10));

//
const hips = new THREE.Group();
hips.position.set(0, 0, 0.46);
body.add(hips);
const hipsMesh = box(0.60,0.42,0.44);
hipsMesh.position.set(0,0,0.20);
hips.add(hipsMesh);

//
function fluffyTail(parent, w, h, d, mat){
  const core=box(0.08,0.08,d,MAT.fur);
  core.position.set(0,-0.04,d*0.5); parent.add(core);
  const fan=[[0,d],[0.30,d*0.82],[-0.30,d*0.82],[0.55,d*0.60],[-0.55,d*0.60]];
  const slices=3;
  for(let s=0;s<slices;s++){
    const rz=(s/slices)*Math.PI*2;
    for(const[rx,len] of fan){
      const f=box(w,h,len,mat);
      f.rotation.x=rx; f.rotation.z=rz;
      f.position.set(0,-h*0.5,len*0.5);
      parent.add(f);
    }
  }
}
const tailPivot = new THREE.Group();
tailPivot.position.set(0,0.08,0.44); tailPivot.rotation.x=0.82;
hips.add(tailPivot);
const tail1 = new THREE.Group(); tailPivot.add(tail1);
fluffyTail(tail1, 0.32, 0.26, 0.52, MAT.light);
const tail2Pivot = new THREE.Group();
tail2Pivot.position.set(0,0,0.52); tail2Pivot.rotation.x=0.65; tail1.add(tail2Pivot);
const tail2 = new THREE.Group(); tail2Pivot.add(tail2);
fluffyTail(tail2, 0.24, 0.20, 0.36, MAT.light);
const tail3Pivot = new THREE.Group();
tail3Pivot.position.set(0,0,0.36); tail3Pivot.rotation.x=-0.35; tail2.add(tail3Pivot);
const tail3 = new THREE.Group(); tail3Pivot.add(tail3);
const tipFan=[[0,0.20],[0.35,0.15],[-0.35,0.15]];
for(let st=0;st<3;st++){const rz=(st/3)*Math.PI*2;
  for(const[rx,len] of tipFan){const f=box(0.16,0.12,len,MAT.light);f.rotation.x=rx;f.rotation.z=rz;f.position.set(0,-0.06,len*0.5);tail3.add(f);}}

//
const neck = new THREE.Group();
neck.position.set(0,0.10,-0.50);
neck.rotation.x = -0.42;
body.add(neck);
const neckMesh = box(0.36,0.36,0.44);
neckMesh.position.set(0,0,-0.18); neck.add(neckMesh);

//
const head = new THREE.Group();
head.position.set(0,0.06,-0.40); neck.add(head);
const headMesh = box(0.64,0.58,0.54);
headMesh.position.set(0,0.04,0); head.add(headMesh);

//
const upperJaw = new THREE.Group();
upperJaw.position.set(0,-0.08,-0.28); head.add(upperJaw);
const ujm = box(0.50,0.20,0.42);
ujm.position.set(0,-0.06,-0.17); upperJaw.add(ujm);
const uTeeth = box(0.40,0.08,0.06,MAT.light);
uTeeth.position.set(0,-0.14,-0.20); upperJaw.add(uTeeth);

//
const lowerJaw = new THREE.Group();
lowerJaw.position.set(0,-0.18,-0.26); head.add(lowerJaw);
const ljm = box(0.48,0.17,0.40);
ljm.position.set(0,-0.06,-0.16); lowerJaw.add(ljm);
const mouthInner = box(0.42,0.09,0.32,MAT.mouth);
mouthInner.position.set(0,0.02,-0.14); lowerJaw.add(mouthInner);

//
for(const sx of [-0.22,0.22]){
  const ear = box(0.11,0.26,0.09);
  ear.position.set(sx,0.34,-0.06);
  ear.rotation.z = sx>0?0.18:-0.18;
  head.add(ear);
}
//
for(const sx of [-0.23,0.23]){
  const eye = box(0.09,0.08,0.05,MAT.eye);
  eye.position.set(sx,0.08,-0.28); head.add(eye);
}

//
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

//
const J = {body,hips,neck,head,upperJaw,lowerJaw,tail1,tail2,
           FL,FR,BL,BR};

//
let state='idle', phase=0, onDone=null;
const BASE_Y = 0.62;

function lerp(a,b,t){return a+(b-a)*Math.min(1,Math.max(0,t));}
function lerpR(g,x,y,z,t=0.15){
  g.rotation.x=lerp(g.rotation.x,x,t);
  g.rotation.y=lerp(g.rotation.y,y,t);
  g.rotation.z=lerp(g.rotation.z,z,t);
}

//
function update(dt){
  phase += dt;
  const S=Math.sin, t=phase;

  //
  J.body.position.y = BASE_Y;

  switch(state){

  case 'idle':{
    //
    J.body.position.y = BASE_Y + S(t*1.4)*0.018;
    lerpR(J.neck,  -0.10+S(t*0.7)*0.06, 0, 0, 0.08);
    lerpR(J.head,  S(t*0.9)*0.05, S(t*0.5)*0.04, 0, 0.08);
    lerpR(J.tail1, -0.2+S(t*2.2)*0.35, 0, S(t*1.8)*0.25, 0.1);
    lerpR(J.tail2, S(t*2.5)*0.30, 0, S(t*2.0)*0.20, 0.1);
    lerpR(J.upperJaw, 0,0,0,0.1); lerpR(J.lowerJaw,0,0,0,0.1);
    //
    for(const L of [J.FL,J.FR,J.BL,J.BR]){lerpR(L.g,0,0,0,0.1);lerpR(L.lo,0.12,0,0,0.1);}
    break;}

  case 'wander':{
    //
    const sp=2.6, stride=0.35;
    J.body.position.y = BASE_Y + S(t*sp*2)*0.025;
    J.body.rotation.z = S(t*sp)*0.04;
    lerpR(J.neck,-0.20+S(t*sp)*0.08,0,0,0.1);
    lerpR(J.head,S(t*sp)*0.06,0,0,0.1);
    lerpR(J.tail1,-0.1+S(t*sp*1.5)*0.45,0,S(t*sp)*0.3,0.12);
    //
    J.FL.g.rotation.x = S(t*sp)*stride;
    J.BR.g.rotation.x = S(t*sp)*stride;
    J.FR.g.rotation.x = S(t*sp+Math.PI)*stride;
    J.BL.g.rotation.x = S(t*sp+Math.PI)*stride;
    for(const L of [J.FL,J.FR,J.BL,J.BR]) L.lo.rotation.x=0.12+Math.max(0,-L.g.rotation.x)*0.5;
    break;}

  case 'run':{
    //
    const sp=10.0, stride=0.60;
    J.body.position.y = BASE_Y + Math.abs(S(t*sp*2))*0.06;
    J.body.rotation.x = 0.15;
    lerpR(J.neck,-0.25,0,0,0.15);
    lerpR(J.head,0.1,0,0,0.15);
    J.tail1.rotation.x = -0.6;
    //
    const ph=t*sp;
    J.FL.g.rotation.x = S(ph)*stride;
    J.FR.g.rotation.x = S(ph+0.4)*stride;
    J.BL.g.rotation.x = S(ph+Math.PI)*stride*1.2;
    J.BR.g.rotation.x = S(ph+Math.PI+0.4)*stride*1.2;
    for(const L of [J.FL,J.FR,J.BL,J.BR]) L.lo.rotation.x=0.1+Math.max(0,-L.g.rotation.x)*0.7;
    break;}

  case 'pounce':{
    // 5段：蓄力→起跳→飞扑→落地→谢力
    const DUR=1.2, p=Math.min(1,phase/DUR);
    if(p<0.25){             // ① 蓄力：后腿深蹲、身体后仰、低头
      const q=p/0.25;
      lerpR(J.body,-0.40*q,0,0,0.25);
      lerpR(J.neck, 0.35*q,0,0,0.22);
      lerpR(J.BL.g, 0.80*q,0,0,0.30); lerpR(J.BR.g,0.80*q,0,0,0.30);
      lerpR(J.BL.lo,0.50*q,0,0,0.25); lerpR(J.BR.lo,0.50*q,0,0,0.25);
      lerpR(J.FL.g, 0.30*q,0,0,0.25); lerpR(J.FR.g,0.30*q,0,0,0.25);
      root.position.y=lerp(0.72,0.52,q*q);
    } else if(p<0.42){      // ② 起跳：后腿爆发蹬地，前腿伸出，头颈前伸
      const q=(p-0.25)/0.17;
      lerpR(J.body,lerp(-0.40,0.25,q),0,0,0.45);
      lerpR(J.neck,lerp(0.35,-0.80,q),0,0,0.40);
      lerpR(J.BL.g,lerp(0.80,-0.90,q),0,0,0.45);lerpR(J.BR.g,lerp(0.80,-0.90,q),0,0,0.45);
      lerpR(J.BL.lo,lerp(0.50,0.08,q),0,0,0.40); lerpR(J.BR.lo,lerp(0.50,0.08,q),0,0,0.40);
      lerpR(J.FL.g,lerp(0.30,-1.10,q),0,0,0.45); lerpR(J.FR.g,lerp(0.30,-1.10,q),0,0,0.45);
      root.position.y=lerp(0.52,1.35,q*q);   // 快速腾空
    } else if(p<0.65){      // ③ 飞扑：身体拉伸，四腿张开
      lerpR(J.body,0.25,0,0,0.12);
      lerpR(J.neck,-0.80,0,0,0.10);
      lerpR(J.FL.g,-1.10,0,0,0.10); lerpR(J.FR.g,-1.10,0,0,0.10);
      lerpR(J.BL.g,-0.80,0,0,0.12); lerpR(J.BR.g,-0.80,0,0,0.12);
      const q=(p-0.42)/0.23;
      root.position.y=lerp(1.35,0.72,q);  // 弧线下落
    } else if(p<0.80){      // ④ 落地：前爪猛撑，身体压缩
      const q=(p-0.65)/0.15;
      lerpR(J.body,lerp(0.25,0.55,q),0,0,0.40);
      lerpR(J.neck,lerp(-0.80,0.10,q),0,0,0.35);
      lerpR(J.FL.g,lerp(-1.10,1.00,q),0,0,0.45); lerpR(J.FR.g,lerp(-1.10,1.00,q),0,0,0.45);
      lerpR(J.BL.g,lerp(-0.80,0.40,q),0,0,0.35); lerpR(J.BR.g,lerp(-0.80,0.40,q),0,0,0.35);
      root.position.y=lerp(0.72,0.54,q);  // 压缩谢力
    } else {                // ⑤ 谢力回弹：缓缓还原
      const q=(p-0.80)/0.20;
      lerpR(J.body,lerp(0.55,0,q),0,0,0.18);
      lerpR(J.neck,lerp(0.10,-0.10,q),0,0,0.15);
      lerpR(J.FL.g,lerp(1.00,0,q),0,0,0.18); lerpR(J.FR.g,lerp(1.00,0,q),0,0,0.18);
      lerpR(J.BL.g,lerp(0.40,0,q),0,0,0.15); lerpR(J.BR.g,lerp(0.40,0,q),0,0,0.15);
      const bounce=Math.sin(q*Math.PI)*0.08;
      root.position.y=lerp(0.54,0.72,q)+bounce;
    }
    if(p>=1){ setState('idle'); root.position.y=0.72; }
    break;}

  case 'bite':{
    //
    const p=Math.min(1,phase/0.45);
    const jawOpen = p<0.4 ? p/0.4 : 1-(p-0.4)/0.6;
    lerpR(J.upperJaw, jawOpen*0.35,0,0,0.4);
    lerpR(J.lowerJaw,-jawOpen*0.45,0,0,0.4);
    lerpR(J.neck,-0.2,0,0,0.2); lerpR(J.head,0.2,0,0,0.2);
    if(p>=1){ setState('idle'); }
    break;}

  case 'dodge':{
    //
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
    const p=Math.min(1,phase/1.6);
    if(p<0.28){
      const q=p/0.28;
      lerpR(J.BL.g, 0.7*q,0,0,0.35); lerpR(J.BR.g, 0.7*q,0,0,0.35);
      lerpR(J.FL.g,-1.0*q,0,0,0.35); lerpR(J.FR.g,-1.0*q,0,0,0.35);
      lerpR(J.body,-0.25*q,0,0,0.25); lerpR(J.neck,-1.0*q,0,0,0.25);
      lerpR(J.upperJaw,-0.35*q,0,0,0.3); lerpR(J.lowerJaw,-0.45*q,0,0,0.3);
      root.position.y = lerp(0.72, 0.85, q);
    } else if(p<0.55){
      const q=(p-0.28)/0.27;
      lerpR(J.body,0,0,q*1.55,0.4);
      root.position.y = lerp(0.85, 0.18, q*q);
    } else {
      const q=(p-0.55)/0.45;
      const bounce=Math.sin(q*Math.PI)*0.10*(1-q*0.8);
      root.position.y = 0.18 + bounce;
      lerpR(J.body,0,0,1.55,0.12);
    }
    break;}

  case 'howl':{
    const p=Math.min(1,phase/3.0);
    //
    const jawAng = p<0.3 ? (p/0.3)*0.5 : p<0.8 ? 0.5 : 0.5*(1-(p-0.8)/0.2);
    lerpR(J.neck, 0.9,0,0,0.06);
    lerpR(J.head, 0.6,0,0,0.06);
    lerpR(J.upperJaw, jawAng*0.4,0,0,0.08);
    lerpR(J.lowerJaw,-jawAng*0.5,0,0,0.08);
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
