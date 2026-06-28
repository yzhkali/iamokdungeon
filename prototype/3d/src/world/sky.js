export function buildSky({ THREE, scene }) {
  const _sd = new THREE.Mesh(new THREE.SphereGeometry(450000, 16, 8), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { uTop: { value: new THREE.Color(0.18, 0.42, 0.75) }, uMid: { value: new THREE.Color(0.38, 0.65, 0.88) }, uHor: { value: new THREE.Color(0.72, 0.85, 0.94) } },
    vertexShader: 'varying vec3 vDir;void main(){vDir=normalize((modelMatrix*vec4(position,0.)).xyz);vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;}',
    fragmentShader: 'uniform vec3 uTop,uMid,uHor;varying vec3 vDir;void main(){float y=clamp(normalize(vDir).y,0.,1.);vec3 c=mix(uHor,uMid,smoothstep(-0.1,0.15,y));c=mix(c,uTop,smoothstep(0.15,1.,y));gl_FragColor=vec4(c,1.);}',
  }));
  _sd.renderOrder = -1;
  scene.add(_sd);
  scene.background = new THREE.Color(0x5ab4e8);

  const _cTL2 = new THREE.TextureLoader();
  const _cirrTex = _cTL2.load('./textures/cloud_cirrus.png');
  _cirrTex.wrapS = _cirrTex.wrapT = THREE.RepeatWrapping;

  function _mkCDome(tex, renderOrd, sx, sz, frag) {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: tex }, uOff: { value: new THREE.Vector2() } },
      vertexShader: 'varying vec3 vDir;void main(){vDir=normalize((modelMatrix*vec4(position,0.)).xyz);vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;}',
      fragmentShader: frag || 'uniform sampler2D uMap;uniform vec2 uOff;varying vec3 vDir;void main(){vec3 d=normalize(vDir);if(d.y<-0.02){gl_FragColor=vec4(0.);return;}float fade=smoothstep(-0.02,0.15,d.y);float sc=1./(abs(d.y)+0.12);vec2 uv=d.xz*sc*0.3+uOff;vec4 c=texture2D(uMap,uv);gl_FragColor=vec4(c.rgb,c.a*fade);}',
      transparent: true,
      depthWrite: false,
      depthTest: true,
      depthFunc: THREE.LessEqualDepth,
      side: THREE.BackSide,
      fog: false,
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(450000, 32, 16), mat);
    mesh.renderOrder = renderOrd;
    scene.add(mesh);
    return { mesh, mat, ox: 0, oz: 0, sx, sz };
  }

  const _ct2 = [1, 2, 3, 4].map(() => {
    const t = _cTL2.load('./textures/cloud_cumulus.png');
    t.colorSpace = THREE.LinearSRGBColorSpace;
    return t;
  });

  function _mkBill(tex, angle, r, h, w, bh) {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: tex } },
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'uniform sampler2D uMap;varying vec2 vUv;void main(){vec4 c=texture2D(uMap,vUv);if(c.a<0.08)discard;float bt=smoothstep(0.55,0.0,vUv.y)*0.35;c.rgb=mix(c.rgb,vec3(0.72,0.85,0.94),bt);gl_FragColor=vec4(c.rgb,1.);}',
      side: THREE.DoubleSide,
      fog: false,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, bh), mat);
    mesh.position.set(r * Math.cos(angle), h, r * Math.sin(angle));
    scene.add(mesh);
    return { mesh, angle, r, h, speed: 0.000008 };
  }

  const _cloudLayers = [_mkCDome(_cirrTex, 1, 0.000025, 0.00001)];
  const _cloudBillboards = [
    _mkBill(_ct2[0], 0.35, 600, 150, 675, 450),
    _mkBill(_ct2[2], 1.80, 640, 150, 675, 450),
    _mkBill(_ct2[1], 3.30, 620, 150, 675, 450),
    _mkBill(_ct2[3], 5.00, 660, 150, 675, 450),
  ];
  return { clouds: [], birds: [], _cloudLayers, _cloudBillboards };
}

export function updateSky({ skyData, camera, dt }) {
  for (const cl of skyData._cloudLayers) {
    cl.mat.uniforms.uOff.value.set(cl.ox += cl.sx * dt, cl.oz += cl.sz * dt);
  }
  for (const b of skyData._cloudBillboards) {
    b.mesh.quaternion.copy(camera.quaternion);
  }
}
