export const SPIN_RING_Y = 2.0;

export function createSpinRings({
  THREE,
  scene,
  getPlayer = () => ({ x: 0, z: 0 }),
  getSpinRadius = () => 2.8,
}) {
  const rings = [];

  function spawnSpinRing(centerX, centerZ, fromR, toR, delay) {
    const geometry = new THREE.RingGeometry(0.92, 1.0, 40);
    const material = new THREE.MeshBasicMaterial({
      color: 0xbfeaff,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(centerX, SPIN_RING_Y, centerZ);
    mesh.visible = false;
    scene.add(mesh);
    const ring = { mesh, mat: material, t: -(delay || 0), dur: 0.32, fromR, toR };
    rings.push(ring);
    return ring;
  }

  function updateSpinRings(dt) {
    for (let i = rings.length - 1; i >= 0; i -= 1) {
      const ring = rings[i];
      ring.t += dt;
      if (ring.t < 0) continue;
      ring.mesh.visible = true;
      const k = Math.min(1, ring.t / ring.dur);
      const radius = ring.fromR + (ring.toR - ring.fromR) * (1 - (1 - k) * (1 - k));
      ring.mesh.scale.set(radius, radius, 1);
      ring.mat.opacity = 0.7 * (1 - k);
      if (k >= 1) {
        scene.remove(ring.mesh);
        rings.splice(i, 1);
      }
    }
  }

  function spawnSaturnRings() {
    const player = getPlayer();
    const inner = 1.0;
    const outer = getSpinRadius() + 0.4;
    for (let n = 0; n < 5; n += 1) {
      spawnSpinRing(player.x, player.z, inner + n * 0.3, outer + n * 0.25, n * 0.035);
    }
  }

  return {
    SPIN_RING_Y,
    spawnSpinRing,
    spawnSaturnRings,
    update: updateSpinRings,
    updateSpinRings,
  };
}
