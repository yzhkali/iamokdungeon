import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const mainJs = fs.readFileSync(path.join(repoRoot, 'prototype/3d/src/main.js'), 'utf8');
const runtimeCombatJs = fs.readFileSync(path.join(repoRoot, 'prototype/3d/src/combat/runtimeCombat.js'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(mainJs.includes('import { createCombatRuntime } from "./combat/runtimeCombat.js";'), 'main.js must import combat runtime factory');
assert(/const\s+\{[\s\S]*spaceSlash[\s\S]*hitResolution[\s\S]*attackBursts[\s\S]*ghostAfterimages[\s\S]*targetFeedback[\s\S]*spinRings[\s\S]*swordTrail[\s\S]*swordBeam[\s\S]*stompEffects[\s\S]*updateFx[\s\S]*\}\s*=\s*createCombatRuntime\s*\(/.test(mainJs), 'main.js must destructure the combat runtime surface');
assert(/createCombatRuntime\s*\(\s*\{[\s\S]*THREE[\s\S]*scene[\s\S]*yaw[\s\S]*weapon[\s\S]*weaponTip[\s\S]*getPlayer\s*:\s*\(\s*\)\s*=>\s*P[\s\S]*getHittables\s*:\s*\(\s*\)\s*=>\s*hittables[\s\S]*getDummies\s*:\s*\(\s*\)\s*=>\s*dummies[\s\S]*getMonsters\s*:\s*\(\s*\)\s*=>\s*monsters[\s\S]*getMoves\s*:\s*\(\s*\)\s*=>\s*MOVES[\s\S]*sfx\s*:\s*SFX[\s\S]*runtimeState[\s\S]*getHeavyRadiusMin\s*:\s*\(\s*\)\s*=>\s*HEAVY_R_MIN[\s\S]*getHeavyRadiusMax\s*:\s*\(\s*\)\s*=>\s*HEAVY_R_MAX[\s\S]*random\s*:\s*Math\.random[\s\S]*\}\s*\)/.test(mainJs), 'main.js should pass live combat dependencies to the runtime factory');

for (const statement of [
  'import { createGhostAfterimages } from "../player/ghostAfterimages.js";',
  'import { isInSpinSweepArc, isInThrustBox } from "./hitMath.js";',
  'import { createAttackBursts } from "./attackBursts.js";',
  'import { createHitResolution, SPIN_RADIUS } from "./hitResolution.js";',
  'import { createHitTargetFeedback } from "./hitTargetFeedback.js";',
  'import { createSpaceSlash } from "./spaceSlash.js";',
  'import { createSpinRings } from "./spinRings.js";',
  'import { createStompEffects } from "./stompEffects.js";',
  'import { createSwordBeamController } from "./swordBeam.js";',
  'import { createSwordTrail } from "./swordTrail.js";',
  'import { createTargetFeedback } from "./targetFeedback.js";',
]) {
  assert(runtimeCombatJs.includes(statement), `runtimeCombat.js must keep ${statement}`);
}

assert(/const\s+spaceSlash\s*=\s*createSpaceSlash\s*\(\s*\{\s*THREE\s*,\s*scene\s*\}\s*\)/.test(runtimeCombatJs), 'runtime combat should create spaceSlash first');
assert(/const\s+\{\s*onHitTarget\s*\}\s*=\s*createHitTargetFeedback\s*\(\s*\{[\s\S]*spaceSlash[\s\S]*getDummies[\s\S]*getMonsters[\s\S]*sfx\s*:\s*SFX[\s\S]*runtimeState\.hitstop\s*=\s*Math\.max\s*\(\s*runtimeState\.hitstop\s*,\s*nextHitstop\s*\)[\s\S]*runtimeState\.shake\s*=\s*Math\.max\s*\(\s*runtimeState\.shake\s*,\s*nextShake\s*\)/.test(runtimeCombatJs), 'runtime combat should wire hit target feedback and impact state');
assert(/const\s+hitResolution\s*=\s*createHitResolution\s*\(\s*\{[\s\S]*getPlayer[\s\S]*getHittables[\s\S]*getDummies[\s\S]*getMonsters[\s\S]*getMoves[\s\S]*onHitTarget[\s\S]*isInThrustBox[\s\S]*isInSpinSweepArc[\s\S]*\}\s*\)/.test(runtimeCombatJs), 'runtime combat should create hitResolution with hit math injections');
assert(/const\s+attackBursts\s*=\s*createAttackBursts\s*\(\s*\{[\s\S]*THREE[\s\S]*yaw[\s\S]*getHeavyRadiusMin[\s\S]*getHeavyRadiusMax[\s\S]*runtimeState\.hitstop\s*=\s*nextHitstop[\s\S]*runtimeState\.shake\s*=\s*nextShake/.test(runtimeCombatJs), 'runtime combat should create attackBursts with live heavy radius and impact dependencies');
assert(/const\s+ghostAfterimages\s*=\s*createGhostAfterimages\s*\(\s*\{[\s\S]*THREE[\s\S]*scene[\s\S]*getPlayer[\s\S]*getYawRotationY\s*:\s*\(\s*\)\s*=>\s*yaw\.rotation\.y/.test(runtimeCombatJs), 'runtime combat should create ghostAfterimages with player and yaw getters');
assert(/const\s+spinRings\s*=\s*createSpinRings\s*\(\s*\{[\s\S]*getSpinRadius\s*:\s*\(\s*\)\s*=>\s*SPIN_RADIUS/.test(runtimeCombatJs), 'runtime combat should preserve spin radius getter');
assert(runtimeCombatJs.includes('const swordTrail = createSwordTrail({ THREE, scene, weapon, weaponTip });'), 'runtime combat should create swordTrail from rig weapon');
assert(runtimeCombatJs.includes('const swordBeam = createSwordBeamController({ THREE, scene, getPlayer });'), 'runtime combat should create swordBeam with live player getter');
assert(/const\s+stompEffects\s*=\s*createStompEffects\s*\(\s*\{[\s\S]*playStomp\s*:\s*\(\s*\)\s*=>\s*SFX\.stomp\(\)[\s\S]*runtimeState\.hitstop\s*=\s*Math\.max\s*\(\s*runtimeState\.hitstop,\s*0\.12\s*\)[\s\S]*runtimeState\.shake\s*=\s*Math\.max\s*\(\s*runtimeState\.shake,\s*0\.45\s*\)/.test(runtimeCombatJs), 'runtime combat should create stompEffects with SFX and impact dependencies');
assert(/function\s+updateFx\s*\(\s*dt\s*\)\s*\{\s*attackBursts\.update\s*\(\s*dt\s*\)\s*;\s*ghostAfterimages\.update\s*\(\s*dt\s*\)\s*;\s*targetFeedback\.update\s*\(\s*dt\s*\)\s*;\s*\}/.test(runtimeCombatJs), 'runtime combat should preserve updateFx order');
assert(!mainJs.includes('createAttackBursts({'), 'main.js should not create attackBursts directly');
assert(!mainJs.includes('createHitResolution({'), 'main.js should not create hitResolution directly');
assert(!mainJs.includes('createSwordTrail({'), 'main.js should not create swordTrail directly');
assert(!/function\s+updateFx\s*\(/.test(mainJs), 'main.js should not keep inline updateFx');

console.log('Runtime combat check passed.');
