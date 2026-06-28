export function createSwordBeamController({
  THREE,
  scene,
  getPlayer,
  random = Math.random,
  now = () => performance.now(),
}) {
  const GRID = 2;
  const CRACK_SEGS = 22;
  const beams = [];
  const cracks = [];

  function makeFinShape() {
    const shape = new THREE.Shape();
    shape.moveTo(-0.55, 0.0);
    shape.lineTo(-0.35, 0.95);
    shape.quadraticCurveTo(0.1, 0.85, 1.25, 0.06);
    shape.lineTo(1.25, 0.0);
    shape.closePath();
    return shape;
  }

  const beamMaterial = new THREE.MeshBasicMaterial({
    color: 0xaff0ff,
    transparent: true,
    opacity: 0.92,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const finGeometry = new THREE.ExtrudeGeometry(makeFinShape(), { depth: 0.1, bevelEnabled: false });
  finGeometry.translate(0, 0, -0.05);

  function spawnSwordBeam() {
    const player = getPlayer();
    const group = new THREE.Group();
    const fin = new THREE.Mesh(finGeometry, beamMaterial);
    fin.rotation.y = -Math.PI / 2;
    group.add(fin);
    const fx = Math.sin(player.facing), fz = Math.cos(player.facing);
    const startX = player.x + fx * GRID, startZ = player.z + fz * GRID;
    group.position.set(startX, 0.06, startZ);
    group.rotation.y = player.facing;
    scene.add(group);
    const crack = newCrack();
    beams.push({ grp: group, fin, vz: 26, life: 1.2, fx, fz, startX, startZ, dist: 0, crack, lastCrackD: 0, hitSet: new Set() });
    return beams[beams.length - 1];
  }

  function newCrack() {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array((CRACK_SEGS + 1) * 2 * 3);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setIndex([]);
    const material = new THREE.MeshBasicMaterial({
      color: 0x140f0b,
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    material.polygonOffset = true;
    material.polygonOffsetFactor = -2;
    material.polygonOffsetUnits = -2;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    scene.add(mesh);
    const crack = { mesh, geo: geometry, pos: positions, filled: 0, prevWob: 0, age: 0, growing: true };
    cracks.push(crack);
    return crack;
  }

  function growCrack(crack, x, z, fx, fz) {
    if (crack.filled > CRACK_SEGS) return;
    const px = -fz, pz = fx;
    const wobble = (random() - 0.5) * 0.16 + crack.prevWob * 0.45;
    crack.prevWob = wobble;
    const mx = x + px * wobble, mz = z + pz * wobble;
    const width = 0.045 * (0.6 + random() * 0.9);
    const index = crack.filled;
    crack.pos[index * 6 + 0] = mx + px * width;
    crack.pos[index * 6 + 1] = 0.03;
    crack.pos[index * 6 + 2] = mz + pz * width;
    crack.pos[index * 6 + 3] = mx - px * width;
    crack.pos[index * 6 + 4] = 0.03;
    crack.pos[index * 6 + 5] = mz - pz * width;
    if (index > 0) {
      const a = (index - 1) * 2, b = (index - 1) * 2 + 1, c = index * 2, d = index * 2 + 1;
      const nextIndex = crack.geo.index.array ? Array.from(crack.geo.index.array) : [];
      nextIndex.push(a, b, c, b, d, c);
      crack.geo.setIndex(nextIndex);
    }
    crack.geo.attributes.position.needsUpdate = true;
    crack.filled += 1;
  }

  function updateBeams(dt, hitBeam = () => {}) {
    for (let i = beams.length - 1; i >= 0; i -= 1) {
      const beam = beams[i];
      const step = beam.vz * dt;
      beam.grp.position.x += beam.fx * step;
      beam.grp.position.z += beam.fz * step;
      beam.dist += step;
      beam.life -= dt;
      beam.fin.scale.y = 1 + 0.06 * Math.sin(now() / 35);
      hitBeam(beam);

      const crackLen = GRID * 3, segStep = crackLen / CRACK_SEGS;
      while (beam.crack.growing && beam.dist - beam.lastCrackD >= segStep && beam.crack.filled <= CRACK_SEGS) {
        beam.lastCrackD += segStep;
        growCrack(beam.crack, beam.startX + beam.fx * beam.lastCrackD, beam.startZ + beam.fz * beam.lastCrackD, beam.fx, beam.fz);
        if (beam.lastCrackD >= crackLen) beam.crack.growing = false;
      }
      if (beam.dist >= GRID * 4 || beam.life <= 0) {
        if (beam.crack) beam.crack.growing = false;
        scene.remove(beam.grp);
        beams.splice(i, 1);
      }
    }

    for (let i = cracks.length - 1; i >= 0; i -= 1) {
      const crack = cracks[i];
      crack.age += dt;
      if (crack.age < 10) crack.mesh.material.opacity = 0.9;
      else if (crack.age < 15) crack.mesh.material.opacity = 0.9 * (1 - (crack.age - 10) / 5);
      else {
        scene.remove(crack.mesh);
        cracks.splice(i, 1);
      }
    }
  }

  return {
    GRID,
    CRACK_SEGS,
    spawnSwordBeam,
    updateBeams,
  };
}
