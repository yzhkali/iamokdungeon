export const STOMP_RADIUS = 3.2;

export function createStompEffects({
  THREE,
  scene,
  getPlayer = () => ({ x: 0, z: 0 }),
  getHittables = () => [],
  getDummies = () => [],
  playStomp = () => {},
  boostImpact = () => {},
  random = Math.random,
}) {
  const stompMarks = [];

  function irregularShape(baseR, jitter, n) {
    const shape = new THREE.Shape();
    for (let i = 0; i < n; i += 1) {
      const angle = (i / n) * Math.PI * 2;
      const radius = baseR * (1 + (random() - 0.5) * jitter);
      const x = Math.sin(angle) * radius;
      const z = Math.cos(angle) * radius;
      if (i === 0) shape.moveTo(x, z);
      else shape.lineTo(x, z);
    }
    shape.closePath();
    return shape;
  }

  function spawnCrater(cx, cz) {
    const grp = new THREE.Group();
    grp.position.set(cx, 0, cz);
    scene.add(grp);

    const mats = [];
    const register = material => {
      mats.push({ m: material, base: material.opacity });
      return material;
    };

    const rimMat = register(new THREE.MeshBasicMaterial({
      color: 0x3a2a1c,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      depthWrite: false,
    }));
    rimMat.polygonOffset = true;
    rimMat.polygonOffsetFactor = -1;
    rimMat.polygonOffsetUnits = -1;
    const rim = new THREE.Mesh(new THREE.ShapeGeometry(irregularShape(1.7, 0.45, 16)), rimMat);
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = 0.03;
    grp.add(rim);

    const discMat = register(new THREE.MeshBasicMaterial({
      color: 0x120d0a,
      transparent: true,
      opacity: 0.62,
      side: THREE.DoubleSide,
      depthWrite: false,
    }));
    discMat.polygonOffset = true;
    discMat.polygonOffsetFactor = -2;
    discMat.polygonOffsetUnits = -2;
    const disc = new THREE.Mesh(new THREE.ShapeGeometry(irregularShape(1.1, 0.5, 16)), discMat);
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.032;
    grp.add(disc);

    return { grp, mats };
  }

  function spawnDebris(cx, cz) {
    const bits = [];
    for (let i = 0; i < 11; i += 1) {
      const size = 0.07 + random() * 0.13;
      const geometry = random() < 0.5
        ? new THREE.TetrahedronGeometry(size)
        : new THREE.BoxGeometry(size, size * 0.8, size * 1.1);
      const material = new THREE.MeshStandardMaterial({
        color: 0x6b5a44,
        roughness: 0.95,
        transparent: true,
        opacity: 1,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      const angle = random() * Math.PI * 2;
      const speed = 2.2 + random() * 4.5;
      mesh.position.set(cx + Math.sin(angle) * 0.3, 0.25, cz + Math.cos(angle) * 0.3);
      mesh.rotation.set(random() * 6, random() * 6, random() * 6);
      scene.add(mesh);
      bits.push({
        mesh,
        mat: material,
        vx: Math.sin(angle) * speed,
        vy: 4.5 + random() * 4.5,
        vz: Math.cos(angle) * speed,
        sx: (random() - 0.5) * 12,
        sy: (random() - 0.5) * 12,
        sz: (random() - 0.5) * 12,
        rest: size * 0.5 + 0.02,
        settled: false,
      });
    }
    return bits;
  }

  function spawnStompMark(cx, cz) {
    const crater = spawnCrater(cx, cz);
    const bits = spawnDebris(cx, cz);
    const mark = { grp: crater.grp, mats: crater.mats, bits, age: 0 };
    stompMarks.push(mark);
    return mark;
  }

  function doStomp() {
    playStomp();
    boostImpact();
    const player = getPlayer();
    spawnStompMark(player.x, player.z);

    for (const target of getHittables()) {
      const dx = target.x - player.x;
      const dz = target.z - player.z;
      if (Math.hypot(dx, dz) < STOMP_RADIUS + target.r) {
        target.flashT = 0.2;
        target.shakeT = 0.28;
      }
    }

    for (const dummy of getDummies()) {
      const dx = dummy.x - player.x;
      const dz = dummy.z - player.z;
      if (Math.hypot(dx, dz) < STOMP_RADIUS + dummy.r) {
        dummy.flashT = 0.3;
        dummy.tiltVel += 12;
      }
    }
  }

  function update(dt) {
    for (let i = stompMarks.length - 1; i >= 0; i -= 1) {
      const mark = stompMarks[i];
      mark.age += dt;

      for (const bit of mark.bits) {
        if (!bit.settled) {
          bit.vy -= 22 * dt;
          bit.mesh.position.x += bit.vx * dt;
          bit.mesh.position.y += bit.vy * dt;
          bit.mesh.position.z += bit.vz * dt;
          bit.mesh.rotation.x += bit.sx * dt;
          bit.mesh.rotation.y += bit.sy * dt;
          bit.mesh.rotation.z += bit.sz * dt;
          if (bit.mesh.position.y <= bit.rest) {
            bit.mesh.position.y = bit.rest;
            if (Math.abs(bit.vy) < 1.6) {
              bit.settled = true;
              bit.vx = 0;
              bit.vz = 0;
              bit.sx = 0;
              bit.sy = 0;
              bit.sz = 0;
            } else {
              bit.vy = -bit.vy * 0.4;
              bit.vx *= 0.55;
              bit.vz *= 0.55;
              bit.sx *= 0.5;
              bit.sy *= 0.5;
              bit.sz *= 0.5;
            }
          }
        }
      }

      let opacity = 1;
      if (mark.age >= 10) opacity = Math.max(0, 1 - (mark.age - 10) / 5);
      for (const entry of mark.mats) entry.m.opacity = entry.base * opacity;
      for (const bit of mark.bits) bit.mat.opacity = opacity;

      if (mark.age >= 15) {
        scene.remove(mark.grp);
        for (const bit of mark.bits) scene.remove(bit.mesh);
        stompMarks.splice(i, 1);
      }
    }
  }

  return {
    STOMP_R: STOMP_RADIUS,
    STOMP_RADIUS,
    spawnCrater,
    spawnDebris,
    spawnStompMark,
    doStomp,
    update,
    updateStomps: update,
  };
}
