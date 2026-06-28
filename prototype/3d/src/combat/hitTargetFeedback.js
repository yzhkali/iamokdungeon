export function createHitTargetFeedback({
  spaceSlash,
  getDummies,
  getMonsters,
  sfx,
  boostImpact,
}) {
  function onHitTarget(ox, oy, oz) {
    if (spaceSlash.consumeHit(ox, oy, oz)) {
      boostImpact(0.06, 0.2);
    }
    const nearDummy = getDummies().some(dummy => Math.hypot(dummy.x - ox, dummy.z - oz) < 1.8);
    const nearMonster = getMonsters().some(monster => Math.hypot(monster.x - ox, monster.z - oz) < 1.8);
    if (nearMonster) sfx.hitBone();
    else if (nearDummy) sfx.hitWood();
    else sfx.hitFlesh();
  }

  return { onHitTarget };
}
