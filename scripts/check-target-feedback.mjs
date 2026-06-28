import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const repoRoot = process.cwd();
const modulePath = path.join(repoRoot, 'prototype/3d/src/combat/targetFeedback.js');
const mainPath = path.join(repoRoot, 'prototype/3d/src/main.js');
const mainJs = fs.readFileSync(mainPath, 'utf8');
const runtimeCombatJs = fs.readFileSync(path.join(repoRoot, 'prototype/3d/src/combat/runtimeCombat.js'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function nearly(actual, expected, message, epsilon = 1e-6) {
  if (Math.abs(actual - expected) > epsilon) {
    throw new Error(`${message}: got ${actual}, expected ${expected}`);
  }
}

function makeEmissive() {
  return {
    hex: 0,
    setHex(hex) {
      this.hex = hex;
    },
  };
}

function makeMat() {
  return { emissive: makeEmissive(), emissiveIntensity: 99 };
}

function makeTargetFeedbackFixture(createTargetFeedback, randomValues = []) {
  let randomIndex = 0;
  const hittableMat = makeMat();
  const dummyMats = [makeMat(), makeMat()];
  const monsterMats = [makeMat(), { emissiveIntensity: 99 }, makeMat()];

  const hittables = [{
    flashT: 0.18,
    shakeT: 0.18,
    mat: hittableMat,
    mesh: { position: { x: 10, z: -3 } },
    baseX: 10,
    baseZ: -3,
  }];
  const dummies = [{
    flashT: 0.25,
    tilt: 0.4,
    tiltVel: 5,
    _beamCd: 0.3,
    _thrustCd: 0.2,
    pivot: { rotation: { x: 0 } },
    mats: dummyMats,
  }];
  const monsters = [{
    flashT: 0.25,
    tilt: 0.5,
    tiltVel: 4,
    _beamCd: 0.4,
    _thrustCd: 0.1,
    root: { rotation: { x: 0 } },
    mats: monsterMats,
  }];
  const targetFeedback = createTargetFeedback({
    getHittables: () => hittables,
    getDummies: () => dummies,
    getMonsters: () => monsters,
    random: () => randomValues[randomIndex++] ?? 0.5,
  });
  return { targetFeedback, hittables, dummies, monsters, hittableMat, dummyMats, monsterMats };
}

async function loadCreateTargetFeedback() {
  if (!fs.existsSync(modulePath)) return null;
  const mod = await import(pathToFileURL(modulePath).href);
  return mod.createTargetFeedback ?? mod.default ?? null;
}

function runExtractedModuleChecks(createTargetFeedback) {
  assert(typeof createTargetFeedback === 'function', 'targetFeedback.js must export createTargetFeedback');

  {
    const { targetFeedback, hittables, hittableMat } = makeTargetFeedbackFixture(createTargetFeedback, [1, 0]);
    targetFeedback.update(0.09);
    nearly(hittables[0].flashT, 0.09, 'hittable flash timer should decrement');
    assert(hittableMat.emissive.hex === 0xff2a1a, 'hittable flash should set red emissive color');
    nearly(hittableMat.emissiveIntensity, 0.7, 'hittable flash intensity');
    nearly(hittables[0].shakeT, 0.09, 'hittable shake timer should decrement');
    nearly(hittables[0].mesh.position.x, 10 + 0.09 * 0.9 * 0.5, 'hittable shake x offset');
    nearly(hittables[0].mesh.position.z, -3 - 0.09 * 0.9 * 0.5, 'hittable shake z offset');

    targetFeedback.update(0.2);
    nearly(hittables[0].mat.emissiveIntensity, 0, 'hittable emissive intensity should reset after flash');
    nearly(hittables[0].mesh.position.x, 10, 'hittable x should reset after shake');
    nearly(hittables[0].mesh.position.z, -3, 'hittable z should reset after shake');
  }

  {
    const { targetFeedback, dummies, dummyMats } = makeTargetFeedbackFixture(createTargetFeedback);
    targetFeedback.update(0.1);
    nearly(dummies[0].tiltVel, 5 + (-38 * 0.4 - 6 * 5) * 0.1, 'dummy spring velocity');
    nearly(dummies[0].tilt, 0.4 + dummies[0].tiltVel * 0.1, 'dummy spring tilt');
    nearly(dummies[0].pivot.rotation.x, dummies[0].tilt * 0.12, 'dummy pivot rotation');
    nearly(dummies[0]._beamCd, 0.2, 'dummy beam cooldown decay');
    nearly(dummies[0]._thrustCd, 0.1, 'dummy thrust cooldown decay');
    nearly(dummies[0].flashT, 0.15, 'dummy flash timer should decrement');
    for (const mat of dummyMats) {
      assert(mat.emissive.hex === 0xff3020, 'dummy flash should set red emissive color');
      nearly(mat.emissiveIntensity, 0.15 / 0.25 * 1.2, 'dummy flash intensity');
    }

    targetFeedback.update(0.3);
    for (const mat of dummyMats) nearly(mat.emissiveIntensity, 0, 'dummy emissive intensity should reset after flash');
  }

  {
    const { targetFeedback, monsters, monsterMats } = makeTargetFeedbackFixture(createTargetFeedback);
    targetFeedback.update(0.1);
    nearly(monsters[0].tiltVel, 4 + (-30 * 0.5 - 5 * 4) * 0.1, 'monster spring velocity');
    nearly(monsters[0].tilt, 0.5 + monsters[0].tiltVel * 0.1, 'monster spring tilt');
    nearly(monsters[0].root.rotation.x, monsters[0].tilt * 0.08, 'monster root rotation');
    nearly(monsters[0]._beamCd, 0.3, 'monster beam cooldown decay');
    nearly(monsters[0]._thrustCd, 0, 'monster thrust cooldown decay');
    nearly(monsters[0].flashT, 0.15, 'monster flash timer should decrement');
    assert(monsterMats[0].emissive.hex === 0xff3020 && monsterMats[2].emissive.hex === 0xff3020, 'monster flash should set red emissive color on emissive mats');
    nearly(monsterMats[0].emissiveIntensity, 0.15 / 0.25 * 1.25, 'monster flash intensity');
    nearly(monsterMats[1].emissiveIntensity, 99, 'monster flash should leave non-emissive materials alone');

    targetFeedback.update(0.3);
    nearly(monsterMats[0].emissiveIntensity, 0, 'monster emissive intensity should reset after flash');
    nearly(monsterMats[1].emissiveIntensity, 99, 'monster reset should leave non-emissive materials alone');
  }
}

const createTargetFeedback = await loadCreateTargetFeedback();
assert(createTargetFeedback, 'targetFeedback.js must exist and export createTargetFeedback');
runExtractedModuleChecks(createTargetFeedback);
assert(runtimeCombatJs.includes('import { createTargetFeedback } from "./targetFeedback.js";'), 'runtime combat must import target feedback module after extraction');
assert(/\bconst\s+targetFeedback\s*=\s*createTargetFeedback\s*\(\s*\{[\s\S]*getHittables[\s\S]*getDummies[\s\S]*getMonsters[\s\S]*\}\s*\)/.test(runtimeCombatJs), 'runtime combat must create targetFeedback with live target collections');
assert(/function\s+updateFx\s*\(\s*dt\s*\)\s*\{\s*attackBursts\.update\s*\(\s*dt\s*\)\s*;\s*ghostAfterimages\.update\s*\(\s*dt\s*\)\s*;\s*targetFeedback\.update\s*\(\s*dt\s*\)\s*;\s*\}/.test(runtimeCombatJs), 'updateFx should update attack bursts, ghost afterimages, then target feedback');
assert(!/for\s*\(\s*const\s+o\s+of\s+hittables\s*\)\s*\{[\s\S]*?o\.mat\.emissive\.setHex\s*\(\s*0xff2a1a\s*\)/.test(mainJs), 'main.js should not retain inline hittable feedback update after extraction');
assert(!/for\s*\(\s*const\s+d\s+of\s+dummies\s*\)\s*\{[\s\S]*?d\.tiltVel\s*\+=\s*\(\s*-38\s*\*\s*d\.tilt\s*-\s*6\s*\*\s*d\.tiltVel\s*\)/.test(mainJs), 'main.js should not retain inline dummy feedback update after extraction');
assert(!/for\s*\(\s*const\s+m\s+of\s+monsters\s*\)\s*\{[\s\S]*?m\.tiltVel\s*\+=\s*\(\s*-30\s*\*\s*m\.tilt\s*-\s*5\s*\*\s*m\.tiltVel\s*\)/.test(mainJs), 'main.js should not retain inline monster feedback update after extraction');

console.log('Target feedback extracted-module check passed.');
