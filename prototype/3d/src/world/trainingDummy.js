const WOOD = 0x9a6b3e;
const WOOD_D = 0x6e4a28;

function woodMaterial(THREE, color) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
}

function woodBox(THREE, width, height, depth, color) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    woodMaterial(THREE, color)
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function makeTrainingDummy({
  THREE,
  scene,
  registerMapFeature,
  addCollider,
  terrainYAt,
  dummies,
}, dx, dz, face) {
  const root = new THREE.Group();
  root.position.set(dx, 0, dz);
  root.rotation.y = face;
  scene.add(root);
  registerMapFeature({ type: 'training', name: '木桩', x: dx, z: dz, w: 1.2, d: 1.2, rot: face });

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.85, 1.0, 0.4, 16),
    woodMaterial(THREE, WOOD_D)
  );
  base.position.y = 0.2;
  base.castShadow = true;
  base.receiveShadow = true;
  root.add(base);

  const pivot = new THREE.Group();
  pivot.position.y = 0.4;
  root.add(pivot);
  const mats = [];
  function registerMaterial(mesh) {
    mats.push(mesh.material);
    return mesh;
  }

  const post = woodBox(THREE, 0.42, 2.4, 0.42, WOOD);
  post.position.y = 1.2;
  pivot.add(registerMaterial(post));
  for (const y of [0.5, 1.0, 2.0]) {
    const ring = woodBox(THREE, 0.46, 0.1, 0.46, WOOD_D);
    ring.position.y = y;
    pivot.add(registerMaterial(ring));
  }
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.34, 16, 12),
    woodMaterial(THREE, WOOD)
  );
  head.position.y = 2.6;
  head.castShadow = true;
  pivot.add(registerMaterial(head));
  const armT = woodBox(THREE, 1.7, 0.22, 0.22, WOOD);
  armT.position.set(0, 1.9, 0.0);
  pivot.add(registerMaterial(armT));
  const armDiagL = woodBox(THREE, 0.22, 0.22, 1.1, WOOD);
  armDiagL.position.set(-0.5, 1.5, 0.3);
  armDiagL.rotation.x = 0.5;
  pivot.add(registerMaterial(armDiagL));
  const armDiagR = woodBox(THREE, 0.22, 0.22, 1.1, WOOD);
  armDiagR.position.set(0.5, 1.5, 0.3);
  armDiagR.rotation.x = 0.5;
  pivot.add(registerMaterial(armDiagR));
  const armMid = woodBox(THREE, 0.2, 0.2, 0.9, WOOD);
  armMid.position.set(0, 1.15, 0.45);
  pivot.add(registerMaterial(armMid));

  addCollider(dx, dz, 0.6, 0.6, terrainYAt(dx, dz), terrainYAt(dx, dz) + 3.0);
  const dummy = { root, pivot, mats, x: dx, z: dz, r: 1.2, face, flashT: 0, tilt: 0, tiltVel: 0 };
  dummies.push(dummy);
  return dummy;
}
