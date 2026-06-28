export function createSwordTrail({ THREE, scene, weapon, weaponTip }) {
  const TRAIL_MAX = 26;
  const TRAIL_LIFE = 0.30;
  let trailSeg = 4;

  const material = new THREE.MeshBasicMaterial({
    color: 0xbfe6ff,
    transparent: true,
    opacity: 1,
    vertexColors: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(TRAIL_MAX * 2 * 3);
  const colors = new Float32Array(TRAIL_MAX * 2 * 4);
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4));

  const indices = [];
  for (let i = 0; i < TRAIL_MAX - 1; i += 1) {
    const a = i * 2, b = i * 2 + 1, c = (i + 1) * 2, d = (i + 1) * 2 + 1;
    indices.push(a, b, c, b, d, c);
  }
  geometry.setIndex(indices);

  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.visible = false;
  scene.add(mesh);

  let active = false;
  const rootPoints = [];
  const tipPoints = [];
  const ages = [];
  const tmpTip = new THREE.Vector3();
  const tmpRoot = new THREE.Vector3();

  function startTrail(segments) {
    trailSeg = segments || 4;
    active = true;
    rootPoints.length = 0;
    tipPoints.length = 0;
    ages.length = 0;
    mesh.visible = true;
  }

  function stopTrail() {
    active = false;
  }

  function updateTrail(dt) {
    if (!mesh.visible) return;

    for (let i = 0; i < ages.length; i += 1) ages[i] += dt;

    if (active) {
      weaponTip.getWorldPosition(tmpTip);
      weapon.localToWorld(tmpRoot.set(0, 0.3, 0));
      tipPoints.unshift(tmpTip.clone());
      rootPoints.unshift(tmpRoot.clone());
      ages.unshift(0);
      if (tipPoints.length > trailSeg) {
        tipPoints.pop();
        rootPoints.pop();
        ages.pop();
      }
    }

    const count = tipPoints.length;
    let anyVisible = false;
    for (let i = 0; i < TRAIL_MAX; i += 1) {
      const sampleIndex = Math.min(i, count - 1);
      const tip = tipPoints[sampleIndex] || tmpTip;
      const root = rootPoints[sampleIndex] || tmpRoot;
      positions[i * 6 + 0] = root.x;
      positions[i * 6 + 1] = root.y;
      positions[i * 6 + 2] = root.z;
      positions[i * 6 + 3] = tip.x;
      positions[i * 6 + 4] = tip.y;
      positions[i * 6 + 5] = tip.z;

      const age = (i < count && ages[sampleIndex] !== undefined) ? ages[sampleIndex] : 999;
      const alpha = Math.max(0, 1 - age / TRAIL_LIFE) * 0.7;
      if (alpha > 0.001) anyVisible = true;
      for (const vertex of [i * 2, i * 2 + 1]) {
        colors[vertex * 4 + 0] = 0.78;
        colors[vertex * 4 + 1] = 0.92;
        colors[vertex * 4 + 2] = 1.0;
        colors[vertex * 4 + 3] = alpha;
      }
    }

    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
    if (!active && !anyVisible) mesh.visible = false;
  }

  return {
    mesh,
    startTrail,
    stopTrail,
    updateTrail,
    isActive: () => active,
  };
}
