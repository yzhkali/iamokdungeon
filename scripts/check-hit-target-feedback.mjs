import fs from 'node:fs';
import path from 'node:path';
import { createHitTargetFeedback } from '../prototype/3d/src/combat/hitTargetFeedback.js';

const repoRoot = process.cwd();
const mainJs = fs.readFileSync(path.join(repoRoot, 'prototype/3d/src/main.js'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function same(actual, expected, message) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${message}: got ${a}, expected ${e}`);
}

function createFixture({ consume = false, dummies = [], monsters = [] } = {}) {
  const trace = [];
  const handler = createHitTargetFeedback({
    spaceSlash: {
      consumeHit(x, y, z) {
        trace.push(['consumeHit', x, y, z]);
        return consume;
      },
    },
    getDummies: () => dummies,
    getMonsters: () => monsters,
    sfx: {
      hitBone() { trace.push('hitBone'); },
      hitWood() { trace.push('hitWood'); },
      hitFlesh() { trace.push('hitFlesh'); },
    },
    boostImpact(hitstop, shake) {
      trace.push(['boostImpact', hitstop, shake]);
    },
  });
  return { handler, trace };
}

{
  const { handler, trace } = createFixture({ consume: true });
  handler.onHitTarget(1, 2, 3);
  same(trace, [['consumeHit', 1, 2, 3], ['boostImpact', 0.06, 0.2], 'hitFlesh'], 'space slash should boost impact then play default flesh hit');
}

{
  const { handler, trace } = createFixture({
    dummies: [{ x: 1.7, z: 0 }],
  });
  handler.onHitTarget(0, 0, 0);
  same(trace, [['consumeHit', 0, 0, 0], 'hitWood'], 'near dummy should play wood hit');
}

{
  const { handler, trace } = createFixture({
    dummies: [{ x: 1, z: 0 }],
    monsters: [{ x: 1, z: 0 }],
  });
  handler.onHitTarget(0, 0, 0);
  same(trace, [['consumeHit', 0, 0, 0], 'hitBone'], 'near monster should take priority over dummy');
}

{
  const { handler, trace } = createFixture({
    dummies: [{ x: 1.8, z: 0 }],
    monsters: [{ x: 0, z: 1.8 }],
  });
  handler.onHitTarget(0, 0, 0);
  same(trace, [['consumeHit', 0, 0, 0], 'hitFlesh'], 'distance threshold should stay strictly below 1.8');
}

assert(mainJs.includes('import { createHitTargetFeedback } from "./combat/hitTargetFeedback.js";'), 'main.js must import hit target feedback module');
assert(/const\s+\{\s*onHitTarget\s*\}\s*=\s*createHitTargetFeedback\s*\(\s*\{[\s\S]*spaceSlash[\s\S]*getDummies\s*:\s*\(\s*\)\s*=>\s*dummies[\s\S]*getMonsters\s*:\s*\(\s*\)\s*=>\s*monsters[\s\S]*sfx\s*:\s*SFX[\s\S]*boostImpact\s*:\s*\(\s*nextHitstop\s*,\s*nextShake\s*\)\s*=>\s*\{[\s\S]*hitstop\s*=\s*Math\.max\s*\(\s*hitstop\s*,\s*nextHitstop\s*\)[\s\S]*shake\s*=\s*Math\.max\s*\(\s*shake\s*,\s*nextShake\s*\)[\s\S]*\}[\s\S]*\}\s*\)/.test(mainJs), 'main.js should wire hit target feedback with live dependencies');
assert(/onHitTarget\s*:\s*onHitTarget/.test(mainJs), 'hit resolution should still receive onHitTarget');
assert(!/function\s+onHitTarget\s*\(/.test(mainJs), 'main.js should not keep inline onHitTarget');

console.log('Hit target feedback check passed.');
