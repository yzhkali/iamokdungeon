export function createTargetFeedback({
  getHittables,
  getDummies,
  getMonsters,
  random = Math.random,
}) {
  function updateHittables(dt) {
    for (const hittable of getHittables()) {
      if (hittable.flashT > 0) {
        hittable.flashT -= dt;
        const k = Math.max(0, hittable.flashT / 0.18);
        hittable.mat.emissive.setHex(0xff2a1a);
        hittable.mat.emissiveIntensity = k * 1.4;
      } else {
        hittable.mat.emissiveIntensity = 0;
      }

      if (hittable.shakeT > 0) {
        hittable.shakeT -= dt;
        const a = hittable.shakeT * 0.9;
        if (hittable.mesh) {
          hittable.mesh.position.x = hittable.baseX + (random() - 0.5) * a;
          hittable.mesh.position.z = hittable.baseZ + (random() - 0.5) * a;
        }
      } else if (hittable.mesh) {
        hittable.mesh.position.x = hittable.baseX;
        hittable.mesh.position.z = hittable.baseZ;
      }
    }
  }

  function updateDummies(dt) {
    for (const dummy of getDummies()) {
      dummy.tiltVel += (-38 * dummy.tilt - 6 * dummy.tiltVel) * dt;
      dummy.tilt += dummy.tiltVel * dt;
      dummy.pivot.rotation.x = dummy.tilt * 0.12;
      if (dummy._beamCd > 0) dummy._beamCd -= dt;
      if (dummy._thrustCd > 0) dummy._thrustCd -= dt;

      if (dummy.flashT > 0) {
        dummy.flashT -= dt;
        const k = Math.max(0, dummy.flashT / 0.25);
        for (const mat of dummy.mats) {
          mat.emissive.setHex(0xff3020);
          mat.emissiveIntensity = k * 1.2;
        }
      } else {
        for (const mat of dummy.mats) mat.emissiveIntensity = 0;
      }
    }
  }

  function updateMonsters(dt) {
    for (const monster of getMonsters()) {
      monster.tiltVel += (-30 * monster.tilt - 5 * monster.tiltVel) * dt;
      monster.tilt += monster.tiltVel * dt;
      monster.root.rotation.x = monster.tilt * 0.08;
      if (monster._beamCd > 0) monster._beamCd -= dt;
      if (monster._thrustCd > 0) monster._thrustCd -= dt;

      if (monster.flashT > 0) {
        monster.flashT -= dt;
        const k = Math.max(0, monster.flashT / 0.25);
        for (const mat of monster.mats) {
          if (mat?.emissive) {
            mat.emissive.setHex(0xff3020);
            mat.emissiveIntensity = k * 1.25;
          }
        }
      } else {
        for (const mat of monster.mats) {
          if (mat?.emissive) mat.emissiveIntensity = 0;
        }
      }
    }
  }

  function update(dt) {
    updateHittables(dt);
    updateDummies(dt);
    updateMonsters(dt);
  }

  return {
    update,
    updateHittables,
    updateDummies,
    updateMonsters,
  };
}
