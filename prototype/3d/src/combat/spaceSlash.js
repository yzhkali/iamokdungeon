export function createSpaceSlash({ THREE, scene, random = Math.random }) {
  let ready = false;
  const slashLines = [];

  function markReady() {
    ready = true;
  }

  function isReady() {
    return ready;
  }

  function spawnSpaceSlash(x, y, z) {
    const count = 14;
    const segments = [];
    for (let i = 0; i < count; i += 1) {
      const angle = random() * Math.PI * 2;
      const pitch = (random() - 0.5) * 1.7;
      const length = 1.6 + random() * 2.4;
      const dx = Math.cos(angle) * Math.cos(pitch);
      const dy = Math.sin(pitch);
      const dz = Math.sin(angle) * Math.cos(pitch);
      const offset = (random() - 0.5) * 0.4;
      segments.push({
        ox: x + dx * offset,
        oy: y + dy * offset,
        oz: z + dz * offset,
        dx,
        dy,
        dz,
        len: length,
        delay: random() * 0.12,
      });
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 2 * 3), 3));
    const material = new THREE.LineBasicMaterial({
      color: 0xaef0ff,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.LineSegments(geometry, material);
    mesh.frustumCulled = false;
    scene.add(mesh);
    slashLines.push({ mesh, material, geometry, segments, t: 0, grow: 0.10, hold: 0.18, fade: 0.22 });
    return mesh;
  }

  function consumeHit(x, y, z) {
    if (!ready) return false;
    spawnSpaceSlash(x, y, z);
    ready = false;
    return true;
  }

  function update(dt) {
    for (let i = slashLines.length - 1; i >= 0; i -= 1) {
      const slash = slashLines[i];
      slash.t += dt;
      const positions = slash.geometry.attributes.position.array;
      for (let j = 0; j < slash.segments.length; j += 1) {
        const segment = slash.segments[j];
        const progress = Math.max(0, Math.min(1, (slash.t - segment.delay) / slash.grow));
        const length = segment.len * progress;
        positions[j * 6 + 0] = segment.ox;
        positions[j * 6 + 1] = segment.oy;
        positions[j * 6 + 2] = segment.oz;
        positions[j * 6 + 3] = segment.ox + segment.dx * length;
        positions[j * 6 + 4] = segment.oy + segment.dy * length;
        positions[j * 6 + 5] = segment.oz + segment.dz * length;
      }
      slash.geometry.attributes.position.needsUpdate = true;
      const total = slash.grow + slash.hold + slash.fade;
      slash.material.opacity = slash.t <= slash.grow + slash.hold
        ? 1
        : Math.max(0, 1 - (slash.t - slash.grow - slash.hold) / slash.fade);
      if (slash.t >= total) {
        scene.remove(slash.mesh);
        slashLines.splice(i, 1);
      }
    }
  }

  return {
    markReady,
    isReady,
    consumeHit,
    spawnSpaceSlash,
    update,
  };
}
