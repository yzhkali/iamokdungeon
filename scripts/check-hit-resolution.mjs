import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const repoRoot = process.cwd();
const modulePath = path.join(repoRoot, 'prototype/3d/src/combat/hitResolution.js');
const mainPath = path.join(repoRoot, 'prototype/3d/src/main.js');
const mainJs = fs.readFileSync(mainPath, 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function nearly(actual, expected, message, epsilon = 1e-6) {
  if (Math.abs(actual - expected) > epsilon) {
    throw new Error(`${message}: got ${actual}, expected ${expected}`);
  }
}

function makeTarget({ x, z, r = 0.4, tiltVel, onHit } = {}) {
  const target = { x, z, r };
  if (tiltVel !== undefined) target.tiltVel = tiltVel;
  if (onHit) target.onHit = onHit;
  return target;
}

function makeBeam(x, z) {
  return {
    grp: { position: { x, z } },
    hitSet: new Set(),
  };
}

function createFixture(createHitResolution, {
  player = { x: 0, z: 0, facing: 0, spin: 0, move: 'gSpinCharged' },
  hittables = [],
  dummies = [],
  monsters = [],
  moves = { aJupiter: { hitR: 1.8 }, gSpinCharged: { spinTurns: 4 } },
  thrustResults = new Map(),
  sweepResults = new Map(),
} = {}) {
  const hitTargets = [];
  const boostCalls = [];
  const thrustCalls = [];
  const sweepCalls = [];
  let hitstop = 0;
  let shake = 0;

  const hitResolution = createHitResolution({
    getPlayer: () => player,
    getHittables: () => hittables,
    getDummies: () => dummies,
    getMonsters: () => monsters,
    getMoves: () => moves,
    onHitTarget: (x, y, z) => hitTargets.push({ x, y, z }),
    boostImpact: (minHitstop, minShake) => {
      boostCalls.push([minHitstop, minShake]);
      hitstop = Math.max(hitstop, minHitstop);
      shake = Math.max(shake, minShake);
    },
    isInThrustBox: (args) => {
      thrustCalls.push(args);
      return thrustResults.get(`${args.targetX},${args.targetZ}`) ?? false;
    },
    isInSpinSweepArc: (args) => {
      sweepCalls.push(args);
      return sweepResults.get(`${args.targetX},${args.targetZ}`) ?? false;
    },
    grid: 2,
  });

  return {
    hitResolution,
    player,
    hittables,
    dummies,
    monsters,
    hitTargets,
    boostCalls,
    thrustCalls,
    sweepCalls,
    getImpact: () => ({ hitstop, shake }),
  };
}

async function loadHitResolutionModule() {
  if (!fs.existsSync(modulePath)) return null;
  return import(pathToFileURL(modulePath).href);
}

function assertHitTarget(actual, expected, message) {
  assert(actual, `${message}: missing hit target call`);
  nearly(actual.x, expected.x, `${message} x`);
  nearly(actual.y, expected.y, `${message} y`);
  nearly(actual.z, expected.z, `${message} z`);
}

function runBehaviorChecks(createHitResolution, SPIN_RADIUS) {
  assert(typeof createHitResolution === 'function', 'hitResolution.js must export createHitResolution');
  nearly(SPIN_RADIUS, 2.8, 'SPIN_RADIUS export should stay 2.8');

  {
    const onHitCalls = [];
    const hittable = makeTarget({ x: 0, z: 1.7, r: 0.4, onHit: () => onHitCalls.push('hittable') });
    const dummy = makeTarget({ x: 0.15, z: 1.7, r: 0.4, tiltVel: 1 });
    const monster = makeTarget({ x: -0.15, z: 1.7, r: 0.4, tiltVel: 2 });
    const out = makeTarget({ x: 5, z: 5, r: 0.4, onHit: () => onHitCalls.push('out') });
    const fx = createFixture(createHitResolution, {
      hittables: [hittable, out],
      dummies: [dummy],
      monsters: [monster],
    });

    fx.hitResolution.tryHitObjects(0.85);

    nearly(hittable.flashT, 0.18, 'tryHitObjects hittable flash');
    nearly(hittable.shakeT, 0.18, 'tryHitObjects hittable shake');
    assert(JSON.stringify(onHitCalls) === JSON.stringify(['hittable']), 'tryHitObjects should call hittable onHit once');
    assertHitTarget(fx.hitTargets[0], { x: hittable.x, y: 1.4, z: hittable.z }, 'tryHitObjects hittable onHitTarget');
    nearly(dummy.flashT, 0.2, 'tryHitObjects dummy flash');
    nearly(dummy.tiltVel, 8.5, 'tryHitObjects dummy tilt impulse');
    nearly(monster.flashT, 0.22, 'tryHitObjects monster flash');
    nearly(monster.tiltVel, 8.5, 'tryHitObjects monster tilt impulse');
    assertHitTarget(fx.hitTargets[1], { x: dummy.x, y: 1.6, z: dummy.z }, 'tryHitObjects dummy onHitTarget');
    assertHitTarget(fx.hitTargets[2], { x: monster.x, y: 1.6, z: monster.z }, 'tryHitObjects monster onHitTarget');
    assert(JSON.stringify(fx.boostCalls) === JSON.stringify([[0.04, 0.14], [0.04, 0.14]]), 'tryHitObjects should boost impact for dummy and monster only');
    assert(out.flashT === undefined && out.shakeT === undefined, 'tryHitObjects should leave misses unchanged');
  }

  {
    const hittable = makeTarget({ x: 0.2, z: 0.2, r: 0.4 });
    const dummy = makeTarget({ x: 0.1, z: 0.1, r: 0.4, tiltVel: 1 });
    const monster = makeTarget({ x: -0.1, z: -0.1, r: 0.4, tiltVel: 2 });
    const fx = createFixture(createHitResolution, {
      hittables: [hittable],
      dummies: [dummy],
      monsters: [monster],
    });
    const beam = makeBeam(0, 0);

    fx.hitResolution.beamHitByBeam(beam);
    fx.hitResolution.beamHitByBeam(beam);

    assert(beam.hitSet.has(hittable) && beam.hitSet.has(dummy) && beam.hitSet.has(monster), 'beamHitByBeam should add every hit target to the beam hit set');
    nearly(hittable.flashT, 0.18, 'beam hittable flash');
    nearly(hittable.shakeT, 0.18, 'beam hittable shake');
    nearly(dummy.flashT, 0.25, 'beam dummy flash');
    nearly(dummy.tiltVel, 10, 'beam dummy should only receive one tilt impulse');
    nearly(monster.flashT, 0.25, 'beam monster flash');
    nearly(monster.tiltVel, 10, 'beam monster should only receive one tilt impulse');
    assert(fx.hitTargets.length === 0, 'beamHitByBeam should not call onHitTarget');
    assert(JSON.stringify(fx.boostCalls) === JSON.stringify([[0.03, 0.12], [0.03, 0.12]]), 'beamHitByBeam should boost impact for dummy and monster once');
  }

  {
    const onHitCalls = [];
    const hittable = makeTarget({ x: 1, z: 2, r: 0.3, onHit: () => onHitCalls.push('hittable') });
    const dummy = makeTarget({ x: 2, z: 2, r: 0.4, tiltVel: 1 });
    const coolingDummy = makeTarget({ x: 3, z: 2, r: 0.4, tiltVel: 1 });
    coolingDummy._thrustCd = 0.1;
    const monster = makeTarget({ x: 4, z: 2, r: 0.5, tiltVel: 2 });
    const thrustResults = new Map([
      ['1,2', true],
      ['2,2', true],
      ['3,2', true],
      ['4,2', true],
    ]);
    const fx = createFixture(createHitResolution, {
      player: { x: 9, z: -5, facing: Math.PI / 2, spin: 0, move: 'gThrust' },
      hittables: [hittable],
      dummies: [dummy, coolingDummy],
      monsters: [monster],
      thrustResults,
    });

    fx.hitResolution.tryThrustHit();

    assert(fx.thrustCalls.length === 4, 'tryThrustHit should delegate all target box checks to injected isInThrustBox');
    assert(fx.thrustCalls.every(call => call.playerX === 9 && call.playerZ === -5 && call.facing === Math.PI / 2 && call.grid === 2), 'tryThrustHit should pass player pose and grid to isInThrustBox');
    assert(fx.thrustCalls.some(call => call.targetX === hittable.x && call.targetZ === hittable.z && call.targetRadius === hittable.r), 'tryThrustHit should pass hittable target data to isInThrustBox');
    nearly(hittable.flashT, 0.18, 'thrust hittable flash');
    nearly(hittable.shakeT, 0.18, 'thrust hittable shake');
    assert(JSON.stringify(onHitCalls) === JSON.stringify(['hittable']), 'thrust should call hittable onHit');
    nearly(dummy._thrustCd, 0.25, 'thrust dummy cooldown');
    nearly(dummy.flashT, 0.22, 'thrust dummy flash');
    nearly(dummy.tiltVel, 9, 'thrust dummy tilt impulse');
    assert(coolingDummy.flashT === undefined && coolingDummy.tiltVel === 1 && coolingDummy._thrustCd === 0.1, 'thrust should skip dummies still on cooldown');
    nearly(monster._thrustCd, 0.25, 'thrust monster cooldown');
    nearly(monster.flashT, 0.22, 'thrust monster flash');
    nearly(monster.tiltVel, 10, 'thrust monster tilt impulse');
    assertHitTarget(fx.hitTargets[0], { x: hittable.x, y: 1.4, z: hittable.z }, 'thrust hittable onHitTarget');
    assertHitTarget(fx.hitTargets[1], { x: dummy.x, y: 1.6, z: dummy.z }, 'thrust dummy onHitTarget');
    assertHitTarget(fx.hitTargets[2], { x: monster.x, y: 1.6, z: monster.z }, 'thrust monster onHitTarget');
    assert(JSON.stringify(fx.boostCalls) === JSON.stringify([[0.04, 0.14], [0.04, 0.14]]), 'thrust should boost impact for uncooldowned dummy and monster');
  }

  {
    const onHitCalls = [];
    const hittable = makeTarget({ x: 2.7, z: 0, r: 0.2, onHit: () => onHitCalls.push('hittable') });
    const dummy = makeTarget({ x: 0, z: 2.7, r: 0.2, tiltVel: 1 });
    const monster = makeTarget({ x: -2.7, z: 0, r: 0.2, tiltVel: 2 });
    const out = makeTarget({ x: 4, z: 0, r: 0.1, onHit: () => onHitCalls.push('out') });
    const fx = createFixture(createHitResolution, {
      hittables: [hittable, out],
      dummies: [dummy],
      monsters: [monster],
    });

    fx.hitResolution.tryRingHit();

    nearly(hittable.flashT, 0.2, 'ring hittable flash');
    nearly(hittable.shakeT, 0.2, 'ring hittable shake');
    assert(JSON.stringify(onHitCalls) === JSON.stringify(['hittable']), 'ring should call in-range hittable onHit only');
    nearly(dummy.flashT, 0.25, 'ring dummy flash');
    nearly(dummy.tiltVel, 10, 'ring dummy tilt impulse');
    nearly(monster.flashT, 0.25, 'ring monster flash');
    nearly(monster.tiltVel, 10, 'ring monster tilt impulse');
    assert(fx.hitTargets.length === 0, 'tryRingHit should not call onHitTarget');
    assert(JSON.stringify(fx.boostCalls) === JSON.stringify([[0.05, 0.18], [0.05, 0.18]]), 'ring should boost impact for dummy and monster');
    assert(out.flashT === undefined && out.shakeT === undefined, 'ring should leave misses unchanged');
  }

  {
    const dummy = makeTarget({ x: 0, z: 1.9, r: 0.2, tiltVel: 1 });
    const monster = makeTarget({ x: 1.9, z: 0, r: 0.2, tiltVel: 2 });
    const out = makeTarget({ x: 3, z: 0, r: 0.1, tiltVel: 3 });
    const fx = createFixture(createHitResolution, {
      dummies: [dummy],
      monsters: [monster, out],
      moves: { aJupiter: { hitR: 1.8 } },
    });

    fx.hitResolution.tryJupiterHit();

    nearly(dummy.flashT, 0.22, 'jupiter dummy flash');
    nearly(dummy.tiltVel, 9, 'jupiter dummy tilt impulse');
    nearly(monster.flashT, 0.22, 'jupiter monster flash');
    nearly(monster.tiltVel, 9, 'jupiter monster tilt impulse');
    assert(out.flashT === undefined && out.tiltVel === 3, 'jupiter should leave misses unchanged');
    assertHitTarget(fx.hitTargets[0], { x: dummy.x, y: 1.5, z: dummy.z }, 'jupiter dummy onHitTarget');
    assertHitTarget(fx.hitTargets[1], { x: monster.x, y: 1.5, z: monster.z }, 'jupiter monster onHitTarget');
    assert(JSON.stringify(fx.boostCalls) === JSON.stringify([[0.04, 0.15], [0.04, 0.15]]), 'jupiter should boost impact for dummy and monster');
  }

  {
    const hittable = makeTarget({ x: 1, z: 0, r: 0.3 });
    const dummy = makeTarget({ x: 2, z: 0, r: 0.4, tiltVel: 2 });
    const monster = makeTarget({ x: 3, z: 0, r: 0.5, tiltVel: 10 });
    const sweepResults = new Map([
      ['1,0', true],
      ['2,0', true],
      ['3,0', true],
    ]);
    const fx = createFixture(createHitResolution, {
      player: { x: 5, z: -4, facing: 0.25, spin: 0.4, move: 'gSpinCharged' },
      hittables: [hittable],
      dummies: [dummy],
      monsters: [monster],
      moves: { gSpinCharged: { spinTurns: 4 } },
      sweepResults,
    });

    fx.hitResolution.trySweepHit();
    fx.hitResolution.trySweepHit();

    assert(fx.player._spinHit instanceof Set, 'trySweepHit should create player spin hit set');
    assert(fx.player._spinHit.has(hittable) && fx.player._spinHit.has(dummy) && fx.player._spinHit.has(monster), 'trySweepHit should remember hit targets');
    assert(fx.sweepCalls.length === 3, 'trySweepHit should delegate sweep checks until targets enter the one-hit set');
    assert(fx.sweepCalls.every(call => (
      call.playerX === 5 &&
      call.playerZ === -4 &&
      call.playerFacing === 0.25 &&
      call.spin === 0.4 &&
      call.spinTurns === 4 &&
      call.spinRadius === SPIN_RADIUS &&
      call.arc === 0.6
    )), 'trySweepHit should pass spin pose, radius, turns, and arc to isInSpinSweepArc');
    nearly(hittable.flashT, 0.2, 'sweep hittable flash');
    nearly(hittable.shakeT, 0.2, 'sweep hittable shake');
    nearly(dummy.flashT, 0.12, 'sweep dummy flash');
    nearly(dummy.tiltVel, 8, 'sweep dummy tilt should clamp up to 8');
    nearly(monster.flashT, 0.12, 'sweep monster flash');
    nearly(monster.tiltVel, 10, 'sweep monster tilt should not reduce existing velocity');
    assertHitTarget(fx.hitTargets[0], { x: hittable.x, y: 1.4, z: hittable.z }, 'sweep hittable onHitTarget');
    assertHitTarget(fx.hitTargets[1], { x: dummy.x, y: 1.6, z: dummy.z }, 'sweep dummy onHitTarget');
    assertHitTarget(fx.hitTargets[2], { x: monster.x, y: 1.6, z: monster.z }, 'sweep monster onHitTarget');
    assert(JSON.stringify(fx.boostCalls) === JSON.stringify([[0.04, 0.16], [0.04, 0.16]]), 'sweep should boost impact for tilt targets only');
  }
}

function runMainIntegrationGuards() {
  const importMatch = mainJs.match(/import\s*\{([^}]+)\}\s*from\s*["']\.\/combat\/hitResolution\.js["'];/);
  assert(importMatch, 'main.js must import combat hit resolution module after extraction');
  assert(/\bcreateHitResolution\b/.test(importMatch[1]), 'main.js hitResolution import must include createHitResolution');
  assert(/\bSPIN_RADIUS\b/.test(importMatch[1]), 'main.js hitResolution import must include SPIN_RADIUS');
  assert(/const\s+hitResolution\s*=\s*createHitResolution\s*\(\s*\{/.test(mainJs), 'main.js must create a hitResolution controller');
  for (const required of [
    'getPlayer',
    'getHittables',
    'getDummies',
    'getMonsters',
    'getMoves',
    'onHitTarget',
    'boostImpact',
    'isInThrustBox',
    'isInSpinSweepArc',
  ]) {
    assert(new RegExp(`\\b${required}\\s*:`).test(mainJs), `main.js hitResolution setup must provide ${required}`);
  }
  assert(/getSpinRadius\s*:\s*\(\s*\)\s*=>\s*SPIN_RADIUS/.test(mainJs), 'spin rings should continue to read the extracted SPIN_RADIUS');
  assert(/swordBeam\.updateBeams\s*\(\s*dt\s*,\s*hitResolution\.beamHitByBeam\s*\)/.test(mainJs), 'main loop must pass extracted beamHitByBeam to sword beams');
  for (const name of ['tryThrustHit', 'tryRingHit', 'tryHitObjects', 'trySweepHit', 'tryJupiterHit']) {
    assert(new RegExp(`hitResolution\\.${name}\\s*\\(`).test(mainJs), `main.js must call hitResolution.${name} after extraction`);
    assert(!new RegExp(`function\\s+${name}\\s*\\(`).test(mainJs), `main.js should not retain inline ${name} after extraction`);
  }
  assert(!/function\s+beamHitByBeam\s*\(/.test(mainJs), 'main.js should not retain inline beamHitByBeam after extraction');
  assert(!/function\s+inThrustBox\s*\(/.test(mainJs), 'main.js should not retain inline inThrustBox wrapper after extraction');
}

const hitResolutionModule = await loadHitResolutionModule();
assert(hitResolutionModule, 'prototype/3d/src/combat/hitResolution.js must exist after hit-resolution extraction');

runBehaviorChecks(hitResolutionModule.createHitResolution, hitResolutionModule.SPIN_RADIUS);
runMainIntegrationGuards();

console.log('Hit resolution extracted-module check passed.');
