export function createGhostAfterimages({
  THREE,
  scene,
  getPlayer,
  getYawRotationY,
}) {
  const ghosts = [];
  let ghostTimer = 0;
  let ghostIdx = 0;

  function makeGhostMaterial() {
    return new THREE.MeshBasicMaterial({
      color: 0x9fd8ff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
  }

  for (let i = 0; i < 6; i += 1) {
    const ghost = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 1.4, 4, 8), makeGhostMaterial());
    ghost.visible = false;
    ghost.life = 0;
    scene.add(ghost);
    ghosts.push(ghost);
  }

  function spawnGhost() {
    const player = getPlayer();
    const ghost = ghosts[ghostIdx];
    ghostIdx = (ghostIdx + 1) % ghosts.length;
    ghost.position.set(player.x, player.y + 1.1, player.z);
    ghost.rotation.y = getYawRotationY();
    ghost.visible = true;
    ghost.life = 0.32;
    ghost.material.opacity = 0.5;
    return ghost;
  }

  function tickDodge(dt) {
    ghostTimer -= dt;
    if (ghostTimer <= 0) {
      spawnGhost();
      ghostTimer = 0.04;
    }
  }

  function update(dt) {
    for (const ghost of ghosts) {
      if (ghost.visible) {
        ghost.life -= dt;
        ghost.material.opacity = Math.max(0, ghost.life * 1.8);
        if (ghost.life <= 0) ghost.visible = false;
      }
    }
  }

  return {
    ghosts,
    spawnGhost,
    tickDodge,
    update,
  };
}
