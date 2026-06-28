export function createWolfAiController({
  wolf,
  hittables,
  getPlayer,
  setHitstop,
  documentRef = document,
  setTimeoutRef = setTimeout,
  random = Math.random
}) {
  const wolfAI = {
    hp: 15, state: 'patrol', attackCool: 0, stateTimer: 0,
    wx: 0, wz: -40, facing: 0,
    patrolTarget: { x: 0, z: -40 }, walking: false,
    spawnX: 0, spawnZ: -40, patrolRadius: 12, territoryR: 12, alertR: 22,
    hittable: { x: 0, z: -40, r: 1.8, flashT: 0, shakeT: 0 }
  };

  if (wolf) {
    wolf.root.scale.setScalar(1.4);
    wolf.root.position.set(wolfAI.wx, 0.72, wolfAI.wz);
    wolf.root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  }
  wolfAI.hittable.mat = wolf ? wolf.J.body.children[0].material : {};
  wolfAI.hittable.mesh = wolf ? wolf.root : null;
  syncHittable();
  if (wolf) hittables.push(wolfAI.hittable);
  wolfAI.hittable.onHit = () => {
    if (!wolf || wolfAI.state === 'dead') return;
    wolfAI.hp--;
    wolf.setState('hurt');
    if (wolfAI.hp <= 0) {
      wolf.setState('death');
      wolfAI.state = 'dead';
      wolfAI.hittable._dead = true;
      const index = hittables.indexOf(wolfAI.hittable);
      if (index >= 0) hittables.splice(index, 1);
    } else {
      wolfAI.state = 'chase';
    }
  };

  function wolfPickPatrol() {
    const a = random() * Math.PI * 2, r = random() * wolfAI.patrolRadius;
    wolfAI.patrolTarget = { x: wolfAI.spawnX + Math.cos(a) * r, z: wolfAI.spawnZ + Math.sin(a) * r };
  }
  wolfPickPatrol();

  function updateWolf(dt) {
    if (!wolf) return;
    if (wolfAI.state === 'dead') { wolf.update(dt); return; }
    const P = getPlayer();
    wolfAI.attackCool = Math.max(0, wolfAI.attackCool - dt);
    wolfAI.stateTimer = Math.max(0, wolfAI.stateTimer - dt);
    const wx = wolfAI.wx, wz = wolfAI.wz;
    const dx = P.x - wx, dz = P.z - wz, dist = Math.hypot(dx, dz);
    syncHittable();

    const faceX = -Math.sin(wolfAI.facing), faceZ = -Math.cos(wolfAI.facing);
    const dot = dist > 0.1 ? (faceX * dx + faceZ * dz) / dist : 0;
    const canSee = dist < 10 && dot > 0.5;

    if (wolfAI.state === 'patrol') {
      if (wolfAI.stateTimer <= 0) {
        wolfAI.walking = !wolfAI.walking;
        wolfAI.stateTimer = wolfAI.walking ? (1 + random() * 2) : (0.5 + random() * 1.5);
        if (wolfAI.walking) wolfPickPatrol();
      }
      if (wolfAI.walking) {
        const ptx = wolfAI.patrolTarget.x - wx, ptz = wolfAI.patrolTarget.z - wz;
        const pd = Math.hypot(ptx, ptz);
        if (pd > 0.5) {
          wolfAI.facing = lerpAngle(wolfAI.facing, Math.atan2(-ptx, -ptz), 1.0 * dt);
          wolfAI.wx += ptx / pd * 1.5 * dt;
          wolfAI.wz += ptz / pd * 1.5 * dt;
          if (wolf.state !== 'wander') wolf.setState('wander');
        } else {
          wolfAI.stateTimer = 0;
        }
      } else {
        if (wolf.state !== 'idle') wolf.setState('idle');
        if (!wolfAI._lookTarget) wolfAI._lookTarget = wolfAI.facing + (random() - 0.5) * 2.0;
        wolfAI.facing = lerpAngle(wolfAI.facing, wolfAI._lookTarget, 0.8 * dt);
      }
      if (wolfAI.stateTimer <= 0 || wolfAI.walking) wolfAI._lookTarget = null;
      if (canSee) { wolfAI.state = 'look'; wolfAI.stateTimer = 2.0; }

    } else if (wolfAI.state === 'look') {
      wolfAI.facing = lerpAngle(wolfAI.facing, Math.atan2(-dx, -dz), 1.5 * dt);
      if (wolf.state !== 'idle') wolf.setState('idle');
      if (wolfAI.stateTimer <= 0) wolfAI.state = 'chase';

    } else if (wolfAI.state === 'chase') {
      wolfAI.facing = lerpAngle(wolfAI.facing, Math.atan2(-dx, -dz), 3.0 * dt);
      if (dist > 3.0) {
        wolfAI.wx += dx / dist * 4.5 * dt;
        wolfAI.wz += dz / dist * 4.5 * dt;
        if (wolf.state !== 'run' && wolf.state !== 'hurt' && wolf.state !== 'bite' && wolf.state !== 'pounce') wolf.setState('run');
      } else if (wolfAI.attackCool <= 0) {
        wolf.setState(random() < 0.5 ? 'pounce' : 'bite');
        wolfAI.attackCool = 2.2;
        if (dist < 2.8 && P.iframe <= 0 && !P.dead) {
          P.hp = Math.max(0, P.hp - 1);
          P.dead = P.hp <= 0;
          P.iframe = 0.5;
          setHitstop(0.12);
          const safeDist = Math.max(dist, 0.001), kb = 2.5, kbx = -(dx / safeDist) * kb, kbz = -(dz / safeDist) * kb;
          P.x += kbx * 0.15; P.z += kbz * 0.15;
          flashPlayerHit();
          wolf.root.traverse(o => { if (o.isMesh && o.material?.emissive) { o.material.emissive.setHex(0xff4400); o.material.emissiveIntensity = 1.2; } });
          setTimeoutRef(() => wolf.root.traverse(o => { if (o.isMesh && o.material?.emissive) o.material.emissiveIntensity = 0; }), 120);
        }
      }
      const pDs = Math.hypot(P.x - wolfAI.spawnX, P.z - wolfAI.spawnZ);
      if (pDs > wolfAI.territoryR && wolf.state !== 'pounce' && wolf.state !== 'bite') { wolfAI.state = 'border'; wolfAI.stateTimer = 1.2; }

    } else if (wolfAI.state === 'border') {
      const sdx = P.x - wolfAI.spawnX, sdz = P.z - wolfAI.spawnZ, sd = Math.hypot(sdx, sdz) || 1;
      const tx = wolfAI.spawnX + sdx / sd * wolfAI.territoryR, tz = wolfAI.spawnZ + sdz / sd * wolfAI.territoryR;
      const tdx = tx - wolfAI.wx, tdz = tz - wolfAI.wz, td = Math.hypot(tdx, tdz);
      if (td > 0.5) {
        wolfAI.wx += tdx / td * 2.5 * dt; wolfAI.wz += tdz / td * 2.5 * dt;
        wolfAI.facing = lerpAngle(wolfAI.facing, Math.atan2(-tdx, -tdz), 2.0 * dt);
        if (wolf.state !== 'wander') wolf.setState('wander');
      } else {
        wolfAI.facing = lerpAngle(wolfAI.facing, Math.atan2(-dx, -dz), 1.5 * dt);
        if (wolf.state !== 'idle') wolf.setState('idle');
      }
      const pDsB = Math.hypot(P.x - wolfAI.spawnX, P.z - wolfAI.spawnZ);
      if (wolfAI.stateTimer <= 0 && pDsB <= wolfAI.territoryR - 2) wolfAI.state = 'chase';
      else if (pDsB > wolfAI.alertR) wolfAI.state = 'return';

    } else if (wolfAI.state === 'return') {
      const rdx = wolfAI.spawnX - wolfAI.wx, rdz = wolfAI.spawnZ - wolfAI.wz, rd = Math.hypot(rdx, rdz);
      if (rd > 0.5) {
        wolfAI.wx += rdx / rd * 2.0 * dt; wolfAI.wz += rdz / rd * 2.0 * dt;
        wolfAI.facing = lerpAngle(wolfAI.facing, Math.atan2(-rdx, -rdz), 2.0 * dt);
        if (wolf.state !== 'wander') wolf.setState('wander');
      } else {
        wolfAI.state = 'patrol'; wolfAI.walking = false; wolfAI.stateTimer = 1.0;
      }
    }
    wolf.root.position.x = wolfAI.wx; wolf.root.position.z = wolfAI.wz;
    wolf.root.rotation.y = wolfAI.facing + Math.PI;
    syncHittable();
    wolf.update(dt);
  }

  function flashPlayerHit() {
    const existing = documentRef.getElementById('hitFlash');
    const fl = existing || documentRef.createElement('div');
    if (!existing) {
      fl.id = 'hitFlash';
      fl.style.cssText = 'position:fixed;inset:0;background:radial-gradient(ellipse at center,transparent 65%,rgba(220,0,0,0.55) 100%);pointer-events:none;transition:opacity 0.25s;z-index:999';
      documentRef.body.appendChild(fl);
    }
    fl.style.opacity = '1';
    setTimeoutRef(() => { fl.style.opacity = '0'; }, 80);
  }

  function syncHittable() {
    wolfAI.hittable.x = wolfAI.wx;
    wolfAI.hittable.z = wolfAI.wz;
    wolfAI.hittable.baseX = wolfAI.wx;
    wolfAI.hittable.baseZ = wolfAI.wz;
  }

  return { wolfAI, updateWolf, wolfPickPatrol };
}

export function lerpAngle(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * Math.min(1, t);
}
