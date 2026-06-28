import { isInSpinSweepArc as defaultIsInSpinSweepArc, isInThrustBox as defaultIsInThrustBox } from './hitMath.js';

export const SPIN_RADIUS = 2.8;

export function createHitResolution({
  getPlayer,
  getHittables,
  getDummies,
  getMonsters,
  getMoves = () => ({}),
  onHitTarget,
  boostImpact,
  isInThrustBox = defaultIsInThrustBox,
  isInSpinSweepArc = defaultIsInSpinSweepArc,
  grid = 2,
}) {
  function tryHitObjects(hitR) {
    hitR = hitR || 0;
    const player = getPlayer();
    const reach = 1.7;
    const fx = Math.sin(player.facing);
    const fz = Math.cos(player.facing);
    const hx = player.x + fx * reach;
    const hz = player.z + fz * reach;

    for (const hittable of getHittables()) {
      const dx = hx - hittable.x;
      const dz = hz - hittable.z;
      if (dx * dx + dz * dz < (hittable.r + hitR) * (hittable.r + hitR)) {
        hittable.flashT = 0.18;
        hittable.shakeT = 0.18;
        onHitTarget(hittable.x, 1.4, hittable.z);
        if (hittable.onHit) hittable.onHit();
      }
    }

    for (const dummy of getDummies()) {
      const dx = hx - dummy.x;
      const dz = hz - dummy.z;
      if (dx * dx + dz * dz < (dummy.r + hitR) * (dummy.r + hitR)) {
        dummy.flashT = 0.2;
        dummy.tiltVel += 7.5;
        boostImpact(0.04, 0.14);
        onHitTarget(dummy.x, 1.6, dummy.z);
      }
    }

    for (const monster of getMonsters()) {
      const dx = hx - monster.x;
      const dz = hz - monster.z;
      if (dx * dx + dz * dz < (monster.r + hitR) * (monster.r + hitR)) {
        monster.flashT = 0.22;
        monster.tiltVel += 6.5;
        boostImpact(0.04, 0.14);
        onHitTarget(monster.x, 1.6, monster.z);
      }
    }
  }

  function beamHitByBeam(beam) {
    const bx = beam.grp.position.x;
    const bz = beam.grp.position.z;
    const halfW = grid * 0.5;

    for (const dummy of getDummies()) {
      if (beam.hitSet.has(dummy)) continue;
      const dx = dummy.x - bx;
      const dz = dummy.z - bz;
      if (dx * dx + dz * dz < (halfW + dummy.r) * (halfW + dummy.r)) {
        beam.hitSet.add(dummy);
        dummy.flashT = 0.25;
        dummy.tiltVel += 9;
        boostImpact(0.03, 0.12);
      }
    }

    for (const monster of getMonsters()) {
      if (beam.hitSet.has(monster)) continue;
      const dx = monster.x - bx;
      const dz = monster.z - bz;
      if (dx * dx + dz * dz < (halfW + monster.r) * (halfW + monster.r)) {
        beam.hitSet.add(monster);
        monster.flashT = 0.25;
        monster.tiltVel += 8;
        boostImpact(0.03, 0.12);
      }
    }

    for (const hittable of getHittables()) {
      if (beam.hitSet.has(hittable)) continue;
      const dx = hittable.x - bx;
      const dz = hittable.z - bz;
      if (dx * dx + dz * dz < (halfW + hittable.r) * (halfW + hittable.r)) {
        beam.hitSet.add(hittable);
        hittable.flashT = 0.18;
        hittable.shakeT = 0.18;
      }
    }
  }

  function inThrustBox(ox, oz, or) {
    const player = getPlayer();
    return isInThrustBox({
      playerX: player.x,
      playerZ: player.z,
      facing: player.facing,
      targetX: ox,
      targetZ: oz,
      targetRadius: or || 0,
      grid,
    });
  }

  function tryThrustHit() {
    for (const hittable of getHittables()) {
      if (inThrustBox(hittable.x, hittable.z, hittable.r)) {
        hittable.flashT = 0.18;
        hittable.shakeT = 0.18;
        onHitTarget(hittable.x, 1.4, hittable.z);
        if (hittable.onHit) hittable.onHit();
      }
    }

    for (const dummy of getDummies()) {
      if (inThrustBox(dummy.x, dummy.z, dummy.r)) {
        if (dummy._thrustCd > 0) continue;
        dummy._thrustCd = 0.25;
        dummy.flashT = 0.22;
        dummy.tiltVel += 8;
        boostImpact(0.04, 0.14);
        onHitTarget(dummy.x, 1.6, dummy.z);
      }
    }

    for (const monster of getMonsters()) {
      if (inThrustBox(monster.x, monster.z, monster.r)) {
        if (monster._thrustCd > 0) continue;
        monster._thrustCd = 0.25;
        monster.flashT = 0.22;
        monster.tiltVel += 8;
        boostImpact(0.04, 0.14);
        onHitTarget(monster.x, 1.6, monster.z);
      }
    }
  }

  function tryRingHit() {
    const player = getPlayer();
    for (const hittable of getHittables()) {
      const dx = hittable.x - player.x;
      const dz = hittable.z - player.z;
      if (Math.hypot(dx, dz) < SPIN_RADIUS + hittable.r) {
        hittable.flashT = 0.2;
        hittable.shakeT = 0.2;
        if (hittable.onHit) hittable.onHit();
      }
    }

    for (const dummy of getDummies()) {
      const dx = dummy.x - player.x;
      const dz = dummy.z - player.z;
      if (Math.hypot(dx, dz) < SPIN_RADIUS + dummy.r) {
        dummy.flashT = 0.25;
        dummy.tiltVel += 9;
        boostImpact(0.05, 0.18);
      }
    }

    for (const monster of getMonsters()) {
      const dx = monster.x - player.x;
      const dz = monster.z - player.z;
      if (Math.hypot(dx, dz) < SPIN_RADIUS + monster.r) {
        monster.flashT = 0.25;
        monster.tiltVel += 8;
        boostImpact(0.05, 0.18);
      }
    }
  }

  function tryJupiterHit() {
    const player = getPlayer();
    const moves = getMoves();
    const hr = moves.aJupiter?.hitR || 1.8;
    for (const dummy of getDummies()) {
      if (Math.hypot(dummy.x - player.x, dummy.z - player.z) < hr + dummy.r) {
        dummy.flashT = 0.22;
        dummy.tiltVel += 8;
        boostImpact(0.04, 0.15);
        onHitTarget(dummy.x, 1.5, dummy.z);
      }
    }
    for (const monster of getMonsters()) {
      if (Math.hypot(monster.x - player.x, monster.z - player.z) < hr + monster.r) {
        monster.flashT = 0.22;
        monster.tiltVel += 7;
        boostImpact(0.04, 0.15);
        onHitTarget(monster.x, 1.5, monster.z);
      }
    }
  }

  function trySweepHit() {
    const player = getPlayer();
    const moves = getMoves();
    const turns = moves[player.move]?.spinTurns || 1;
    const arc = 0.6;
    if (!player._spinHit) player._spinHit = new Set();
    const checkList = [...getHittables(), ...getDummies(), ...getMonsters()];
    for (const target of checkList) {
      if (player._spinHit.has(target)) continue;
      if (isInSpinSweepArc({
        playerX: player.x,
        playerZ: player.z,
        playerFacing: player.facing,
        spin: player.spin,
        spinTurns: turns,
        targetX: target.x,
        targetZ: target.z,
        targetRadius: target.r,
        spinRadius: SPIN_RADIUS,
        arc,
      })) {
        player._spinHit.add(target);
        if (target.tiltVel !== undefined) {
          target.flashT = 0.12;
          target.tiltVel = Math.max(target.tiltVel, 8);
          boostImpact(0.04, 0.16);
          onHitTarget(target.x, 1.6, target.z);
        } else {
          target.flashT = 0.2;
          target.shakeT = 0.2;
          onHitTarget(target.x, 1.4, target.z);
        }
      }
    }
  }

  return {
    tryHitObjects,
    beamHitByBeam,
    inThrustBox,
    tryThrustHit,
    tryRingHit,
    tryJupiterHit,
    trySweepHit,
  };
}
