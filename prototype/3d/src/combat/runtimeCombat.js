import { createGhostAfterimages } from "../player/ghostAfterimages.js";
import { isInSpinSweepArc, isInThrustBox } from "./hitMath.js";
import { createAttackBursts } from "./attackBursts.js";
import { createHitResolution, SPIN_RADIUS } from "./hitResolution.js";
import { createHitTargetFeedback } from "./hitTargetFeedback.js";
import { createSpaceSlash } from "./spaceSlash.js";
import { createSpinRings } from "./spinRings.js";
import { createStompEffects } from "./stompEffects.js";
import { createSwordBeamController } from "./swordBeam.js";
import { createSwordTrail } from "./swordTrail.js";
import { createTargetFeedback } from "./targetFeedback.js";

export function createCombatRuntime({
  THREE,
  scene,
  yaw,
  weapon,
  weaponTip,
  getPlayer,
  getHittables,
  getDummies,
  getMonsters,
  getMoves,
  sfx: SFX,
  runtimeState,
  getHeavyRadiusMin,
  getHeavyRadiusMax,
  random = Math.random,
}) {
  const spaceSlash = createSpaceSlash({ THREE, scene });
  const { onHitTarget } = createHitTargetFeedback({
    spaceSlash,
    getDummies,
    getMonsters,
    sfx: SFX,
    boostImpact: (nextHitstop, nextShake) => {
      runtimeState.hitstop = Math.max(runtimeState.hitstop, nextHitstop);
      runtimeState.shake = Math.max(runtimeState.shake, nextShake);
    },
  });
  const hitResolution = createHitResolution({
    getPlayer,
    getHittables,
    getDummies,
    getMonsters,
    getMoves,
    onHitTarget,
    boostImpact: (nextHitstop, nextShake) => {
      runtimeState.hitstop = Math.max(runtimeState.hitstop, nextHitstop);
      runtimeState.shake = Math.max(runtimeState.shake, nextShake);
    },
    isInThrustBox,
    isInSpinSweepArc,
  });

  const attackBursts = createAttackBursts({
    THREE,
    yaw,
    getHeavyRadiusMin,
    getHeavyRadiusMax,
    setImpact: (nextHitstop, nextShake) => {
      runtimeState.hitstop = nextHitstop;
      runtimeState.shake = nextShake;
    },
  });

  const ghostAfterimages = createGhostAfterimages({
    THREE,
    scene,
    getPlayer,
    getYawRotationY: () => yaw.rotation.y,
  });

  const targetFeedback = createTargetFeedback({
    getHittables,
    getDummies,
    getMonsters,
    random,
  });

  const spinRings = createSpinRings({
    THREE,
    scene,
    getPlayer,
    getSpinRadius: () => SPIN_RADIUS,
  });

  const swordTrail = createSwordTrail({ THREE, scene, weapon, weaponTip });
  const swordBeam = createSwordBeamController({ THREE, scene, getPlayer });
  const stompEffects = createStompEffects({
    THREE,
    scene,
    getPlayer,
    getHittables,
    getDummies,
    playStomp: () => SFX.stomp(),
    boostImpact: () => {
      runtimeState.hitstop = Math.max(runtimeState.hitstop, 0.12);
      runtimeState.shake = Math.max(runtimeState.shake, 0.45);
    },
  });

  function updateFx(dt) {
    attackBursts.update(dt);
    ghostAfterimages.update(dt);
    targetFeedback.update(dt);
  }

  return {
    spaceSlash,
    onHitTarget,
    hitResolution,
    attackBursts,
    ghostAfterimages,
    targetFeedback,
    spinRings,
    swordTrail,
    swordBeam,
    stompEffects,
    updateFx,
  };
}
