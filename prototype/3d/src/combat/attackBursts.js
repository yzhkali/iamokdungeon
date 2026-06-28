export function createAttackBursts({
  THREE,
  yaw,
  getHeavyRadiusMin = () => 0,
  getHeavyRadiusMax = () => 0,
  setImpact = () => {},
}) {
  const slashPivot = new THREE.Group();
  slashPivot.position.set(0, 0.06, 0);
  yaw.add(slashPivot);

  const slashMat = new THREE.MeshBasicMaterial({
    color: 0xffe08a,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const slashMesh = new THREE.Mesh(new THREE.RingGeometry(0.45, 1.2, 28, 1, -Math.PI / 2 - 0.95, 1.9), slashMat);
  slashMesh.rotation.x = -Math.PI / 2;
  slashMesh.position.set(0, 0, 0.3);
  slashMesh.visible = false;
  slashPivot.add(slashMesh);

  const heavyRingMat = new THREE.MeshBasicMaterial({
    color: 0xff7b3a,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const heavyRing = new THREE.Mesh(new THREE.RingGeometry(0.86, 1.0, 40), heavyRingMat);
  heavyRing.rotation.x = -Math.PI / 2;
  heavyRing.position.set(0, 0.05, 0);
  heavyRing.visible = false;
  yaw.add(heavyRing);

  const heavyFillMat = new THREE.MeshBasicMaterial({
    color: 0xff7b3a,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const heavyFill = new THREE.Mesh(new THREE.CircleGeometry(1, 40), heavyFillMat);
  heavyFill.rotation.x = -Math.PI / 2;
  heavyFill.position.set(0, 0.04, 0);
  heavyFill.visible = false;
  yaw.add(heavyFill);

  function setHeavyCircle(radius, alongFront) {
    heavyRing.position.set(0, 0.05, alongFront);
    heavyFill.position.set(0, 0.04, alongFront);
    heavyRing.scale.set(radius, radius, 1);
    heavyFill.scale.set(radius, radius, 1);
  }

  // Preserves the actual runtime semantics after the duplicate main.js declaration:
  // only the heavy branch has behavior.
  function startSlash(type, ratio = 0) {
    if (type === 'heavy') {
      const radius = getHeavyRadiusMin() + (getHeavyRadiusMax() - getHeavyRadiusMin()) * ratio;
      const front = 0.7 + radius * 0.55;
      setHeavyCircle(radius, front);
      heavyFill.visible = true;
      heavyFill._t = 0;
      heavyFill._dur = 0.22;
      heavyFillMat.opacity = 0.6;
      heavyFillMat.color.setHex(0xff7b3a);
      heavyRingMat.color.setHex(0xff7b3a);
      heavyRing.visible = true;
      heavyRing._burst = true;
      heavyRing._t = 0;
      setImpact(0.04 + ratio * 0.06, 0.12 + ratio * 0.2);
    }
  }

  function doSlash(from, to, heavy) {
    slashMesh.visible = true;
    slashMesh._t = 0;
    slashMesh._dur = heavy ? 0.18 : 0.15;
    slashMesh.scale.setScalar(heavy ? 1.7 : 1.4);
    slashPivot._from = from;
    slashPivot._to = to;
    if (!heavy) setImpact(0.08, 0.16);
  }

  function burstCircle(radius) {
    const front = 0.7 + radius * 0.55;
    setHeavyCircle(radius, front);
    heavyFill.visible = true;
    heavyFill._t = 0;
    heavyFill._dur = 0.22;
    heavyFillMat.opacity = 0.6;
    heavyFillMat.color.setHex(0xff7b3a);
    heavyRingMat.color.setHex(0xff7b3a);
    heavyRing.visible = true;
    heavyRing._burst = true;
    setImpact(0.06, 0.22);
  }

  function update(dt) {
    if (slashMesh.visible) {
      slashMesh._t += dt;
      const k = slashMesh._t / slashMesh._dur;
      slashMat.opacity = Math.max(0, 0.85 * (1 - k));
      const from = slashPivot._from ?? 0.8;
      const to = slashPivot._to ?? -0.9;
      slashPivot.rotation.y = from + (to - from) * k;
      if (k >= 1) {
        slashMesh.visible = false;
        slashMesh.scale.setScalar(1);
      }
    }

    if (heavyFill._dur) {
      heavyFill._t += dt;
      const k = heavyFill._t / heavyFill._dur;
      heavyFillMat.opacity = Math.max(0, 0.55 * (1 - k));
      heavyRingMat.opacity = Math.max(0, 0.9 * (1 - k));
      if (k >= 1) {
        heavyFill._dur = 0;
        heavyFill.visible = false;
        heavyRing.visible = false;
        heavyRing._burst = false;
      }
    }
  }

  return {
    slashPivot,
    slashMat,
    slashMesh,
    heavyRingMat,
    heavyRing,
    heavyFillMat,
    heavyFill,
    setHeavyCircle,
    startSlash,
    doSlash,
    burstCircle,
    update,
  };
}
