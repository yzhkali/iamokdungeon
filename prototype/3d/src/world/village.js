export function createVillageBlockout({
  THREE,
  scene,
  placeModel,
  terrainYAt,
  addCollider,
  addTerrainArea,
  addPlatform,
  addPlatformBounds,
  documentRef = document,
  random = Math.random,
}) {
  const mapRoot = new THREE.Group();
  scene.add(mapRoot);

  const mapFeatures = [];
  function registerMapFeature(feature) {
    mapFeatures.push(feature);
    return feature;
  }

  const groundMats = new Map();
  function mat(color, roughness = 0.9) {
    const key = `${color}_${roughness}`;
    if (!groundMats.has(key)) groundMats.set(key, new THREE.MeshStandardMaterial({ color, roughness }));
    return groundMats.get(key);
  }

  function addGroundPatch(x, z, w, d, top = 0, color = 0x5a5241) {
    const h = 0.14;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, 0.94));
    m.position.set(x, top - h / 2, z);
    m.receiveShadow = true;
    mapRoot.add(m);
    addTerrainArea(x, z, w, d, top);
    if (top > 0.03) addPlatform(x, z, w, d, top);
    registerMapFeature({ type: color === 0x6d6049 || color === 0x766a58 ? 'road' : 'terrain', x, z, w, d, rot: 0, top, color });
    return m;
  }

  function addLowWall(x, z, w, d, h = 1.25, color = 0x6b5a4a, top = terrainYAt(x, z)) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, 0.86));
    m.position.set(x, top + h / 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    mapRoot.add(m);
    registerMapFeature({ type: 'wall', x, z, w, d, rot: 0, top, color });
    addCollider(x, z, w, d, top, top + h);
    return m;
  }

  function addStep(x, z, w, d, top, color = 0x756354) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, top, d), mat(color, 0.88));
    m.position.set(x, top / 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    mapRoot.add(m);
    addPlatform(x, z, w, d, top);
    registerMapFeature({ type: 'road', x, z, w, d, rot: 0, top, color });
    return m;
  }

  function localPoint(x, z, dx, dz, rot = 0) {
    const s = Math.sin(rot);
    const c = Math.cos(rot);
    return { x: x + dx * c + dz * s, z: z - dx * s + dz * c };
  }

  function addLocalCollider(x, z, lx, lz, w, d, rot = 0, bottom = 0, top = 3.2) {
    const p = localPoint(x, z, lx, lz, rot);
    addCollider(p.x, p.z, w, d, bottom, top);
  }

  function makeGableRoof(w, d, h, color) {
    const hw = w / 2;
    const hd = d / 2;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      -hw, 0, -hd, hw, 0, -hd, 0, h, -hd,
      -hw, 0, hd, hw, 0, hd, 0, h, hd,
    ]), 3));
    geo.setIndex([0, 1, 2, 3, 5, 4, 0, 2, 5, 0, 5, 3, 1, 4, 5, 1, 5, 2]);
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, mat(color, 0.82));
  }

  function addSign(text, x, z, rot = 0, top = terrainYAt(x, z)) {
    const g = new THREE.Group();
    g.position.set(x, top, z);
    g.rotation.y = rot;
    mapRoot.add(g);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.15, 0.12), mat(0x5a3a22, 0.85));
    post.position.y = 0.58;
    post.castShadow = true;
    g.add(post);
    const cv = documentRef.createElement('canvas');
    cv.width = 256;
    cv.height = 96;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#5b3820';
    ctx.fillRect(0, 0, 256, 96);
    ctx.strokeStyle = '#c7954e';
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, 240, 80);
    ctx.fillStyle = '#f8e3ac';
    ctx.font = 'bold 36px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 50);
    const tex = new THREE.CanvasTexture(cv);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.68), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
    board.position.set(0, 1.45, 0.04);
    board.castShadow = true;
    g.add(board);
    return g;
  }

  function addBuilding({ name, x, z, w, d, top = terrainYAt(x, z), rot = 0, wallColor = 0xc9b487, roofColor = 0x6d3a30, stone = false, tower = false, sign = '' }) {
    const root = new THREE.Group();
    root.position.set(x, top, z);
    root.rotation.y = rot;
    mapRoot.add(root);
    registerMapFeature({ type: 'building', name, sign, x, z, w, d, rot, top, roofColor, stone, tower });
    const bodyH = stone ? 3.6 : 3.2;
    const bodyMat = mat(stone ? 0xa99c89 : wallColor, 0.88);
    const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(w, bodyH, d), bodyMat);
    bodyMesh.position.y = bodyH / 2;
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    root.add(bodyMesh);
    const roof = makeGableRoof(w + 1.2, d + 1.1, stone ? 1.5 : 1.25, roofColor);
    roof.position.y = bodyH;
    roof.castShadow = true;
    roof.receiveShadow = true;
    root.add(roof);
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.85, 0.12), mat(stone ? 0x4b3628 : 0x5b3721, 0.78));
    door.position.set(0, 0.92, d / 2 + 0.07);
    door.castShadow = true;
    root.add(door);
    const step = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.18, 0.8), mat(0x80684f, 0.88));
    step.position.set(0, 0.09, d / 2 + 0.48);
    step.receiveShadow = true;
    root.add(step);
    for (const sx of [-w * 0.28, w * 0.28]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.72, 0.1), mat(0xf5cf74, 0.55));
      win.position.set(sx, 2.05, d / 2 + 0.08);
      win.castShadow = true;
      root.add(win);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.86, 0.08), mat(0x4b2d1b, 0.78));
      frame.position.set(sx, 2.05, d / 2 + 0.04);
      frame.castShadow = true;
      root.add(frame);
    }
    if (tower) {
      const tw = new THREE.Mesh(new THREE.BoxGeometry(2.4, 5.2, 2.4), mat(0xa89d8e, 0.9));
      tw.position.set(w * 0.35, 2.6, -d * 0.18);
      tw.castShadow = true;
      tw.receiveShadow = true;
      root.add(tw);
      const tr = makeGableRoof(3.0, 3.0, 1.7, 0x5b3230);
      tr.position.set(w * 0.35, 5.2, -d * 0.18);
      tr.rotation.y = Math.PI / 2;
      tr.castShadow = true;
      root.add(tr);
      const crossA = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.25, 0.18), mat(0xe6d8a6, 0.65));
      crossA.position.set(w * 0.35, 7.0, -d * 0.18);
      root.add(crossA);
      const crossB = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.16, 0.16), mat(0xe6d8a6, 0.65));
      crossB.position.set(w * 0.35, 7.18, -d * 0.18);
      root.add(crossB);
    }
    addCollider(x, z, w + 0.8, d + 0.8, top, top + bodyH + (stone ? 1.9 : 1.55));
    if (sign) {
      const p = localPoint(x, z, w * 0.32, d / 2 + 1.0, rot);
      addSign(sign, p.x, p.z, rot, top);
    }
    return root;
  }

  function addPlayerHome({ x, z, top = terrainYAt(x, z), rot = 0 }) {
    const w = 9.5;
    const d = 9.0;
    const wallT = 0.36;
    const wallH = 4.4;
    const doorW = 2.7;
    const doorH = 3.9;
    const floorTop = top + 0.13;
    const root = new THREE.Group();
    root.position.set(x, top, z);
    root.rotation.y = rot;
    mapRoot.add(root);
    registerMapFeature({ type: 'building', name: 'player-home', sign: 'HOME', x, z, w, d, rot, top, roofColor: 0x6c4738, enterable: true });
    const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.18, d), mat(0x7b6a52, 0.92));
    floor.position.y = 0.04;
    floor.receiveShadow = true;
    root.add(floor);
    addPlatformBounds(x - w / 2 + wallT, x + w / 2 - wallT, z - d / 2 + wallT, z + d / 2 - wallT, floorTop);
    const wallMaterial = mat(0xc8b07f, 0.88);
    function wallSeg(lx, ly, lz, sw, sh, sd) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sw, sh, sd), wallMaterial);
      m.position.set(lx, ly, lz);
      m.castShadow = true;
      m.receiveShadow = true;
      root.add(m);
      return m;
    }
    wallSeg(0, wallH / 2, -d / 2, w, wallH, wallT);
    wallSeg(-w / 2, wallH / 2, 0, wallT, wallH, d);
    wallSeg(w / 2, wallH / 2, 0, wallT, wallH, d);
    wallSeg(-(w + doorW) / 4, wallH / 2, d / 2, (w - doorW) / 2, wallH, wallT);
    wallSeg((w + doorW) / 4, wallH / 2, d / 2, (w - doorW) / 2, wallH, wallT);
    wallSeg(0, doorH + (wallH - doorH) / 2, d / 2, doorW, wallH - doorH, wallT);
    const roof = makeGableRoof(w + 1.1, d + 1.0, 1.55, 0x6c4738);
    roof.position.y = wallH;
    roof.castShadow = true;
    roof.receiveShadow = true;
    root.add(roof);
    const porch = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.2, 1.4), mat(0x80684f, 0.88));
    porch.position.set(0, 0.1, d / 2 + 0.72);
    porch.castShadow = true;
    porch.receiveShadow = true;
    root.add(porch);
    const doorFrameMat = mat(0x4d2f1d, 0.78);
    for (const sx of [-doorW / 2, doorW / 2]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, doorH, 0.18), doorFrameMat);
      post.position.set(sx, doorH / 2, d / 2 + 0.12);
      post.castShadow = true;
      root.add(post);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(doorW + 0.25, 0.16, 0.18), doorFrameMat);
    lintel.position.set(0, doorH, d / 2 + 0.12);
    lintel.castShadow = true;
    root.add(lintel);
    for (const [lx, lz] of [[-2.6, -2.4], [2.6, -2.4]]) {
      const rug = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.05, 1.2), mat(lx < 0 ? 0x704436 : 0x5d693f, 0.9));
      rug.position.set(lx, 0.14, lz);
      rug.receiveShadow = true;
      root.add(rug);
    }
    const table = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.22, 1.1), mat(0x6b4326, 0.82));
    table.position.set(-2.4, 0.95, -1.0);
    table.castShadow = true;
    root.add(table);
    for (const [lx, lz] of [[-3.0, -1.6], [-1.8, -1.6], [-3.0, -0.4], [-1.8, -0.4]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.82, 0.16), mat(0x4a2d1b, 0.82));
      leg.position.set(lx, 0.52, lz);
      leg.castShadow = true;
      root.add(leg);
    }
    const bed = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.55, 3.0), mat(0x9f8f78, 0.88));
    bed.position.set(2.7, 0.35, -2.3);
    bed.castShadow = true;
    bed.receiveShadow = true;
    root.add(bed);
    const blanket = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.18, 1.9), mat(0x6b302c, 0.86));
    blanket.position.set(2.7, 0.76, -1.95);
    blanket.castShadow = true;
    root.add(blanket);
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.42, 2.3, 2.0), mat(0x5a3a22, 0.82));
    shelf.position.set(-w / 2 + 0.45, 1.15, 2.0);
    shelf.castShadow = true;
    root.add(shelf);
    addLocalCollider(x, z, 0, -d / 2, w, wallT, rot, top, top + wallH);
    addLocalCollider(x, z, -w / 2, 0, wallT, d, rot, top, top + wallH);
    addLocalCollider(x, z, w / 2, 0, wallT, d, rot, top, top + wallH);
    addLocalCollider(x, z, -(doorW + w) / 4, d / 2, (w - doorW) / 2, wallT, rot, top, top + wallH);
    addLocalCollider(x, z, (doorW + w) / 4, d / 2, (w - doorW) / 2, wallT, rot, top, top + wallH);
    const p = localPoint(x, z, doorW * 0.85, d / 2 + 1.0, rot);
    addSign('HOME', p.x, p.z, rot, top);
    return root;
  }

  const FOREST = '../assets/vendor/kaykit_forest/';
  function addTree(x, z, scale = 1, path = 'Tree_2_B_Color1.gltf') {
    placeGroundModel(FOREST + path, x, z, { scale, rot: random() * Math.PI * 2, groundCenter: true });
  }

  function placeGroundModel(path, x, z, opts = {}) {
    return placeModel(path, x, z, { ...opts, y: (opts.y ?? 0) + terrainYAt(x, z), parent: opts.parent || mapRoot });
  }

  function addPrimitiveRock(x, z, s = 1) {
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), mat(0x6b6b62, 0.92));
    m.position.set(x, terrainYAt(x, z) + s * 0.5, z);
    m.scale.y = 0.55;
    m.rotation.set(random(), random() * Math.PI, random());
    m.castShadow = true;
    m.receiveShadow = true;
    mapRoot.add(m);
  }

  function buildNewVillage() {
    function wb(px, py, pz, w, h, d, c = 0xc9b487) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c, 0.88));
      m.position.set(px, py + h / 2, pz);
      m.castShadow = true;
      m.receiveShadow = true;
      mapRoot.add(m);
    }
    function roofAt(px, py, pz, w, d, ph, c = 0x6d3a30, ry = 0) {
      const r = makeGableRoof(w, d, ph, c);
      r.position.set(px, py, pz);
      r.rotation.y = ry;
      r.castShadow = true;
      mapRoot.add(r);
    }
    function fencePost(px, pz) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.2, 0.16), mat(0x9a7040, 0.85));
      p.position.set(px, 0.6, pz);
      mapRoot.add(p);
    }
    function fenceRail(x1, z1, x2, z2, broken = false) {
      const cx = (x1 + x2) / 2;
      const cz = (z1 + z2) / 2;
      const len = Math.hypot(x2 - x1, z2 - z1);
      const ang = Math.atan2(-(z2 - z1), x2 - x1);
      fencePost(x1, z1);
      fencePost(x2, z2);
      if (!broken) for (const ry of [0.45, 0.95]) {
        const r = new THREE.Mesh(new THREE.BoxGeometry(len, 0.09, 0.08), mat(0xa07840, 0.85));
        r.position.set(cx, ry, cz);
        r.rotation.y = ang;
        mapRoot.add(r);
      }
    }
    function lamp(px, pz) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.14, 3.4, 0.14), mat(0x3a2a1a, 0.7));
      p.position.set(px, 1.7, pz);
      mapRoot.add(p);
      const lb = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), mat(0xf8e060, 0.3));
      lb.position.set(px, 3.5, pz);
      mapRoot.add(lb);
      const pl = new THREE.PointLight(0xffcc66, 1.1, 9);
      pl.position.set(px, 3.5, pz);
      scene.add(pl);
    }
    function prop(file, px, pz, sc = 1) {
      placeGroundModel('../assets/vendor/fantasy_props/' + file, px, pz, { scale: sc, groundCenter: true });
    }

    for (const [sx, sz, sw, sd] of [[-1, 4, 7, 10], [1, 15, 8, 14], [3, 30, 8, 14], [0, 46, 8, 16], [-2, 62, 7, 16]]) {
      addGroundPatch(sx, sz, sw, sd, 0, 0x8a7a65);
    }
    addGroundPatch(-4, 60, 22, 18, 0, 0x8a7a65);

    {
      const cx = 0;
      const cz = 72;
      wb(cx, 0, cz, 12, 7.0, 18, 0xa89d8a);
      roofAt(cx, 7.0, cz, 13.4, 19.4, 2.2, 0x4a2e28);
      wb(cx, 0, cz - 9.5, 5.0, 10.0, 5.0, 0xb0a594);
      const tr = makeGableRoof(6.0, 6.0, 2.8, 0x3a2420);
      tr.position.set(cx, 10.0, cz - 9.5);
      tr.rotation.y = Math.PI / 4;
      tr.castShadow = true;
      mapRoot.add(tr);
      wb(cx, 11.5, cz - 9.5, 0.18, 1.6, 0.18, 0xe8d8a0);
      wb(cx, 12.2, cz - 9.5, 1.1, 0.15, 0.15, 0xe8d8a0);
      addCollider(cx, cz, 12.8, 18.8, 0, 7.0);
      addCollider(cx, cz - 9.5, 5.2, 5.2, 0, 10.0);
    }

    {
      const ex = -20;
      const ez = 60;
      wb(ex, 0, ez, 13, 5.6, 10, 0xb8a888);
      roofAt(ex, 5.6, ez, 14.4, 11.4, 1.8, 0x5a3228);
      wb(ex + 9, 0, ez - 8, 8, 5.0, 8, 0xb0a080);
      roofAt(ex + 9, 5.0, ez - 8, 9.4, 9.4, 1.6, 0x5a3228);
      addCollider(ex, ez, 13.8, 10.8, 0, 5.6);
      addCollider(ex + 9, ez - 8, 8.8, 8.8, 0, 5.0);
    }

    {
      const ix = 20;
      const iz = 30;
      wb(ix, 0, iz, 14, 5.6, 9, 0xc8b07a);
      roofAt(ix, 5.6, iz, 15.4, 10.4, 1.8, 0x6a3626);
      wb(ix + 5, 0, iz - 8, 8, 5.0, 8, 0xc0a872);
      roofAt(ix + 5, 5.0, iz - 8, 9.4, 9.4, 1.6, 0x6a3626);
      addCollider(ix, iz, 14.8, 9.8, 0, 5.6);
      addCollider(ix + 5, iz - 8, 8.8, 8.8, 0, 5.0);
    }

    {
      const bx = -17;
      const bz = 20;
      wb(bx, 0, bz, 11, 5.2, 9, 0x9a9080);
      roofAt(bx, 5.2, bz, 12.4, 10.4, 1.6, 0x3e3028);
      for (const ppx of [bx - 2, bx + 2]) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.8, 0.2), mat(0x5a3a1a, 0.8));
        p.position.set(ppx, 1.9, bz + 5.5);
        mapRoot.add(p);
      }
      wb(bx, 3.8, bz + 5.5, 5.0, 0.2, 2.8, 0x5a3a1a);
      addCollider(bx, bz, 11.8, 9.8, 0, 5.2);
    }

    {
      const sx = 18;
      const sz = 44;
      wb(sx, 0, sz, 9, 4.8, 8, 0xc8b888);
      roofAt(sx, 4.8, sz, 10.4, 9.4, 1.5, 0x6d3a30);
      addCollider(sx, sz, 9.8, 8.8, 0, 4.8);
    }

    for (const [hx, hz] of [[-13, 10], [-18, 52], [15, 54]]) {
      wb(hx, 0, hz, 8, 4.4, 7, 0xc4aa7a);
      roofAt(hx, 4.4, hz, 9.4, 8.4, 1.4, 0x703830);
      addCollider(hx, hz, 8.8, 7.8, 0, 4.4);
      fenceRail(hx - 4, hz - 3.5, hx + 4, hz - 3.5);
      fenceRail(hx - 4, hz - 3.5, hx - 4, hz - 9.5);
      fenceRail(hx + 4, hz - 3.5, hx + 4, hz - 9.5);
      fenceRail(hx - 4, hz - 9.5, hx + 1, hz - 9.5);
      fenceRail(hx + 1, hz - 9.5, hx + 4, hz - 9.5, true);
      for (let c = 0; c < 3; c++) {
        const bx2 = hx + (random() - 0.5) * 5;
        const bz2 = hz - 4.5 - random() * 4;
        const bdy = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.28, 0.44), mat(0xf0e8d0, 0.9));
        bdy.position.set(bx2, 0.14, bz2);
        mapRoot.add(bdy);
        const hd = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.19, 0.19), mat(0xf0e0c8, 0.9));
        hd.position.set(bx2, 0.38, bz2 - 0.26);
        mapRoot.add(hd);
      }
    }

    fenceRail(-5, 6, -5, 16);
    fenceRail(-5, 18, -5, 26, true);
    fenceRail(-5, 26, -5, 36);
    fenceRail(6, 26, 6, 36);
    fenceRail(6, 37, 6, 42, true);
    fenceRail(6, 43, 6, 54);

    for (const [lx, lz] of [[4, 11], [-4, 22], [4, 34], [-4, 46], [4, 57], [-3, 66]]) lamp(lx, lz);

    for (const [tx, tz] of [[-30, 10], [-36, 26], [-32, 44], [-30, 60], [-24, 76], [-10, 84], [4, 86], [18, 80], [30, 66], [32, 50], [30, 32], [28, 16], [16, -4], [0, -8], [-16, 2], [8, 88], [-38, 36], [34, 40]]) {
      addTree(tx, tz, 0.9 + random() * 0.4);
    }

    prop('Barrel_Apples.gltf', 22, 26.5);
    prop('Barrel.gltf', 21, 27.8);
    prop('Anvil.gltf', -11, 25);
    prop('Crate_Wooden.gltf', -19, 21.5);
    prop('FarmCrate_Apple.gltf', 12, 41);
    prop('FarmCrate_Carrot.gltf', 13, 42.2);
    prop('Bench.gltf', 4, 63);
  }

  return {
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
    placeGroundModel,
    addPrimitiveRock,
  };
}
