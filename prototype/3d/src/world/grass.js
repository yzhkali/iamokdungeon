export function buildGrass({ THREE, scene, mapH }) {
  const grassMats = [];
  const _tl = new THREE.TextureLoader();

  function bh(x, z) {
    const fx = (x + 130) / 2;
    const fz = (z + 130) / 2;
    const ix = Math.max(0, Math.min(129, Math.floor(fx)));
    const iz = Math.max(0, Math.min(129, Math.floor(fz)));
    const tx = fx - ix;
    const tz = fz - iz;
    const S = 131;
    return (mapH[iz * S + ix] ?? 0) * (1 - tx) * (1 - tz)
      + (mapH[iz * S + ix + 1] ?? 0) * tx * (1 - tz)
      + (mapH[(iz + 1) * S + ix] ?? 0) * (1 - tx) * tz
      + (mapH[(iz + 1) * S + ix + 1] ?? 0) * tx * tz;
  }

  const TYPES = [
    ['foliage_card_02_short_turf', 8000, 1.8, 0.12, -5, 20, 0.20, 1.5],
    ['foliage_card_05_broadleaf_low', 2800, 2.2, 0.18, 0, 14, 0.08, 2.2],
    ['foliage_card_06_white_wildflowers', 1800, 2.0, 0.25, 0, 14, 0.05, 2.8],
    ['foliage_extra_05_clover_ground', 2200, 2.0, 0.12, 0, 13, 0.14, 2.2],
    ['foliage_card_03_sedge_thin', 1800, 2.4, 0.50, -3, 8, 0.02, 2.5],
  ];

  function makeCross(S, ofs) {
    const vp = [];
    const vu = [];
    const vi = [];
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI / 3;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const b = vp.length / 3;
      vp.push(-ca * S / 2, -ofs, -sa * S / 2, ca * S / 2, -ofs, sa * S / 2, -ca * S / 2, S - ofs, -sa * S / 2, ca * S / 2, S - ofs, sa * S / 2);
      vu.push(0, 0, 1, 0, 0, 1, 1, 1);
      vi.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(vp, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(vu, 2));
    g.setIndex(vi);
    return g;
  }

  const VS = `#include <common>
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
  const FS = `uniform sampler2D uTex;varying vec2 vUv;varying float vDist;
void main(){vec4 c=texture2D(uTex,vUv);
  float fade=1.-smoothstep(55.,90.,vDist);
  if(c.a*fade<0.35)discard;
  gl_FragColor=vec4(c.rgb*mix(0.88,1.0,vUv.y),c.a*fade);}`;
  const dm = new THREE.Object3D();

  for (const [name, cnt, S, ws, yMn, yMx, bot, cell] of TYPES) {
    const geo = makeCross(S, bot * S);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTex: { value: _tl.load('./textures/texture_foliage.png') }, uTime: { value: 0 }, uWind: { value: ws } },
      vertexShader: VS,
      fragmentShader: FS,
      side: THREE.DoubleSide,
      depthWrite: true,
      transparent: true,
    });
    grassMats.push(mat);
    const mesh = new THREE.InstancedMesh(geo, mat, cnt);
    mesh.frustumCulled = false;
    let n = 0;
    if (cell > 0) {
      const cells = Math.ceil(250 / cell);
      outer: for (let ix = 0; ix < cells; ix++) {
        for (let iz = 0; iz < cells; iz++) {
          if (n >= cnt) break outer;
          const x = -125 + ix * cell + (Math.random() - 0.5) * cell * 0.8;
          const z = -125 + iz * cell + (Math.random() - 0.5) * cell * 0.8;
          const y = bh(x, z);
          if (y < yMn || y > yMx) continue;
          dm.position.set(x, y - 0.05, z);
          dm.rotation.y = Math.random() * Math.PI * 2;
          dm.scale.setScalar(0.85 + Math.random() * 0.3);
          dm.updateMatrix();
          mesh.setMatrixAt(n++, dm.matrix);
        }
      }
    } else {
      let tries = 0;
      while (n < cnt && tries++ < cnt * 6) {
        const x = (Math.random() - 0.5) * 250;
        const z = (Math.random() - 0.5) * 250;
        const y = bh(x, z);
        if (y < yMn || y > yMx) continue;
        dm.position.set(x, y - 0.05, z);
        dm.rotation.y = Math.random() * Math.PI * 2;
        dm.scale.setScalar(0.8 + Math.random() * 0.5);
        dm.updateMatrix();
        mesh.setMatrixAt(n++, dm.matrix);
      }
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);
  }

  return { grassMats };
}

export function updateGrass({ grassMats, time }) {
  for (const m of grassMats) m.uniforms.uTime.value = time;
}
