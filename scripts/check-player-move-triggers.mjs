import fs from 'node:fs';
import path from 'node:path';
import { createMoveTriggers } from '../prototype/3d/src/player/moveTriggers.js';

const repoRoot = process.cwd();
const mainJs = fs.readFileSync(path.join(repoRoot, 'prototype/3d/src/main.js'), 'utf8');
const moveTriggersJs = fs.readFileSync(path.join(repoRoot, 'prototype/3d/src/player/moveTriggers.js'), 'utf8');
const updateControllerJs = fs.readFileSync(path.join(repoRoot, 'prototype/3d/src/player/updateController.js'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function same(actual, expected, message) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${message}: got ${a}, expected ${e}`);
}

const MOVES = {
  plain: { clip: 'plainClip', lunge: 3.5 },
  noLunge: { clip: 'noLungeClip' },
  spin: { clip: 'spinClip', spin: true },
  spinY: { clip: 'spinYClip', spinY: true },
  dRise: { clip: 'dRiseClip', lunge: 0.4 },
  aStomp: { clip: 'aStompClip' },
  aDrill: { clip: 'aDrillClip' },
  aJupiter: { clip: 'aJupiterClip' },
  dKick: { clip: 'dKickClip', lunge: 2 },
};
const CLIPS = Object.fromEntries(
  Object.values(MOVES).map((move, index) => [move.clip, { dur: 0.25 + index }])
);

function createPlayer(overrides = {}) {
  return {
    state: 'idle',
    move: 'oldMove',
    moveT: 9,
    phase: 'oldPhase',
    struck: true,
    _plungeDone: true,
    _customRecover: 'recover',
    nextBuffer: 'gL2',
    _ignoreHeavyRelease: true,
    lunge: 99,
    spin: 7,
    _spinHit: new Set(['wolf']),
    _spinSnd: true,
    _slideV: 12,
    _slideStarted: true,
    blendT: 5,
    blendDur: 5,
    clip: 'oldClip',
    clipT: 4,
    clipDur: 4,
    _trailStarted: true,
    _launched: true,
    _stompHang: 9,
    _drillBounce: 0,
    _jupRev: 3,
    jumping: false,
    vy: 2,
    chargeLock: false,
    ...overrides,
  };
}

function createFixture({ player = createPlayer(), jumpVelocity = 20 } = {}) {
  let hitstop = -1;
  let shake = -1;
  let drillSpinResets = 0;
  const trace = [];

  const sfx = {
    swing() { trace.push('sfx.swing'); },
    chop() { trace.push('sfx.chop'); },
    kick() { trace.push('sfx.kick'); },
    rise() { trace.push('sfx.rise'); },
    thrust() { trace.push('sfx.thrust'); },
    spinStop() { trace.push(this === sfx ? 'sfx.spinStop' : 'bad.spinStop.this'); },
  };
  const attackBursts = {
    doSlash(from, to, heavy) { trace.push(['attack.doSlash', from, to, heavy]); },
    startSlash(type, ratio) { trace.push(['attack.startSlash', type, ratio]); },
    burstCircle(radius) { trace.push(['attack.burstCircle', radius]); },
  };
  const swordBeam = {
    spawnSwordBeam() { trace.push('beam.spawn'); },
  };
  const stompEffects = {
    doStomp() { trace.push('stomp.doStomp'); },
  };
  const poseClipController = {
    capturePoseSnapshot() { trace.push('pose.capture'); },
  };

  const triggers = createMoveTriggers({
    player,
    clips: CLIPS,
    moves: MOVES,
    jumpVelocity,
    sfx,
    attackBursts,
    swordBeam,
    stompEffects,
    poseClipController,
    setHitstop(value) {
      hitstop = value;
      trace.push(['hitstop', value]);
    },
    setShake(value) {
      shake = value;
      trace.push(['shake', value]);
    },
    resetDrillSpin() {
      drillSpinResets += 1;
      trace.push('resetDrillSpin');
    },
  });

  return {
    P: player,
    trace,
    triggers,
    getImpact: () => ({ hitstop, shake }),
    getDrillSpinResets: () => drillSpinResets,
  };
}

function expectFx(fx, expectedTrace, expectedImpact = { hitstop: -1, shake: -1 }, check = () => {}) {
  const fixture = createFixture();
  fixture.triggers.fireFx(fx);
  same(fixture.trace, expectedTrace, `${fx} trace`);
  same(fixture.getImpact(), expectedImpact, `${fx} impact`);
  check(fixture);
}

expectFx('slashR', [['hitstop', 0.07], ['shake', 0.14], 'sfx.swing'], { hitstop: 0.07, shake: 0.14 });
expectFx('slashL', [['hitstop', 0.07], ['shake', 0.14], 'sfx.swing'], { hitstop: 0.07, shake: 0.14 });
expectFx('chop', [['hitstop', 0.10], ['shake', 0.22], 'sfx.chop', 'beam.spawn'], { hitstop: 0.10, shake: 0.22 });
expectFx('slam', [['hitstop', 0.14], ['shake', 0.32]], { hitstop: 0.14, shake: 0.32 });
expectFx('stomp', ['stomp.doStomp']);
expectFx('drill', [['hitstop', 0.14], ['shake', 0.6], 'stomp.doStomp'], { hitstop: 0.14, shake: 0.6 }, ({ P }) => {
  assert(P._drillBounce === 4.5, 'drill should set bounce impulse');
});
expectFx('kick', [['hitstop', 0.10], ['shake', 0.20], 'sfx.kick'], { hitstop: 0.10, shake: 0.20 });
expectFx('rise', [['hitstop', 0.09], ['shake', 0.18], 'sfx.rise'], { hitstop: 0.09, shake: 0.18 });
expectFx('thrust', ['sfx.thrust', ['hitstop', 0.04], ['shake', 0.12]], { hitstop: 0.04, shake: 0.12 });
expectFx('spinSlash', [['hitstop', 0.08], ['shake', 0.22]], { hitstop: 0.08, shake: 0.22 });
expectFx('heavyCircle', [['attack.burstCircle', 1.7]]);
expectFx('heavyCircleBig', [['attack.burstCircle', 2.6]]);
expectFx('unknownFx', []);

{
  const { P, trace, triggers } = createFixture();
  triggers.playClip('plainClip');
  assert(P.clip === 'plainClip', 'playClip should set clip');
  assert(P.clipT === 0, 'playClip should reset clip time');
  assert(P.clipDur === CLIPS.plainClip.dur, 'playClip should set clip duration');
  same(trace, [], 'playClip should not trigger side effects');
}

{
  const P = createPlayer();
  const before = {
    state: P.state,
    move: P.move,
    moveT: P.moveT,
    clip: P.clip,
    spin: P.spin,
    spinHitSize: P._spinHit.size,
  };
  const { trace, triggers } = createFixture({ player: P });
  triggers.startMove('missing');
  same({
    state: P.state,
    move: P.move,
    moveT: P.moveT,
    clip: P.clip,
    spin: P.spin,
    spinHitSize: P._spinHit.size,
  }, before, 'unknown move should be a no-op');
  same(trace, [], 'unknown move should not trigger dependencies');
}

{
  const { P, trace, triggers } = createFixture();
  triggers.startMove('plain');
  assert(P.state === 'attack' && P.move === 'plain' && P.moveT === 0, 'startMove should enter attack state');
  assert(P.phase === 'startup' && P.struck === false, 'startMove should reset phase and struck');
  assert(P._plungeDone === false && P._customRecover === null, 'startMove should reset plunge and custom recover');
  assert(P.nextBuffer === null && P._ignoreHeavyRelease === false, 'startMove should clear buffered heavy state');
  assert(P.lunge === 3.5, 'startMove should copy move lunge');
  assert(P.spin === 7, 'non-spin move should preserve spin');
  assert(P._spinHit.size === 1, 'non-spin move should preserve spin hit set');
  assert(P._spinSnd === false, 'startMove should reset spin SFX flag');
  assert(P._slideV === undefined && P._slideStarted === null, 'startMove should reset slide state');
  assert(P.blendT === 0 && P.blendDur === 0.13, 'startMove should reset normal blend timing');
  assert(P.clip === 'plainClip' && P.clipT === 0 && P.clipDur === CLIPS.plainClip.dur, 'startMove should play move clip');
  assert(P._trailStarted === false && P._launched === false, 'startMove should reset trail and launch flags');
  assert(P._stompHang === 0, 'plain startMove should clear stomp hang');
  same(trace, ['sfx.spinStop', 'pose.capture'], 'startMove should preserve spinStop/capture order');
}

{
  const { P, triggers } = createFixture();
  triggers.startMove('noLunge');
  assert(P.lunge === 0, 'moves without lunge should reset lunge to zero');
}

{
  const { P, trace, triggers } = createFixture();
  triggers.startMove('spin');
  assert(P.spin === 0, 'spin move should reset spin');
  assert(P._spinHit.size === 1, 'spin-only move should not clear spin hit set');
  same(trace, ['sfx.spinStop', 'pose.capture'], 'spin start trace');
}

{
  const { P, triggers } = createFixture();
  triggers.startMove('spinY');
  assert(P.spin === 0, 'spinY move should reset spin');
  assert(P._spinHit.size === 0, 'spinY move should clear hit set');
}

{
  const { P, triggers } = createFixture({ player: createPlayer({ state: 'dodge' }) });
  triggers.startMove('dRise');
  assert(P.blendDur === 0.22, 'dRise from dodge should use longer blend duration');
}

{
  const { P, triggers } = createFixture({ player: createPlayer({ move: 'dRise' }) });
  triggers.startMove('aStomp');
  assert(P._stompHang === 0.28, 'aStomp after dRise should set stomp hang');
}

{
  const fixture = createFixture();
  fixture.triggers.startMove('aDrill');
  assert(fixture.getDrillSpinResets() === 1, 'aDrill should reset external drill spin');
}

{
  const { P, triggers } = createFixture();
  triggers.startMove('aJupiter');
  assert(P._jupRev === -1, 'aJupiter should reset revolution marker');
}

{
  const { P, trace, triggers } = createFixture({ jumpVelocity: 30 });
  triggers.startDodgeCombo('light');
  assert(P.jumping === true, 'light dodge combo should start jumping');
  assert(P.vy === 30 * 0.95, 'light dodge combo should set jump velocity');
  assert(P.move === 'dKick', 'light dodge combo should start dKick');
  same(trace, ['sfx.spinStop', 'pose.capture'], 'light dodge combo trace');
}

{
  const { P, trace, triggers } = createFixture({ player: createPlayer({ vy: 3 }), jumpVelocity: 30 });
  triggers.startDodgeCombo('heavy');
  assert(P.chargeLock === true, 'heavy dodge combo should lock charge');
  assert(P.move === 'dRise', 'heavy dodge combo should start dRise');
  assert(P._ignoreHeavyRelease === true, 'heavy dodge combo should ignore the release that triggered it');
  assert(P.vy === 3, 'heavy dodge combo should not change jump velocity directly');
  same(trace, ['sfx.spinStop', 'pose.capture'], 'heavy dodge combo trace');
}

{
  const { trace, triggers } = createFixture();
  triggers.doSlash(0.8, -0.9, true);
  same(trace, [['attack.doSlash', 0.8, -0.9, true]], 'doSlash should delegate exactly');
}

{
  const { trace, triggers } = createFixture();
  triggers.startSlash('heavy', 0.42);
  same(trace, [['attack.startSlash', 'heavy', 0.42]], 'startSlash should delegate exactly');
}

{
  const fixture = createFixture();
  fixture.triggers.doThrust();
  same(fixture.trace, [['hitstop', 0.04], ['shake', 0.12]], 'doThrust should set only thrust impact');
  same(fixture.getImpact(), { hitstop: 0.04, shake: 0.12 }, 'doThrust impact');
}

assert(mainJs.includes('import { createMoveTriggers } from "./player/moveTriggers.js";'), 'main.js must import move trigger factory');
assert(/\bconst\s*\{[\s\S]*\bplayClip\b[\s\S]*\bfireFx\b[\s\S]*\bdoSlash\b[\s\S]*\bdoThrust\b[\s\S]*\bstartMove\b[\s\S]*\bstartDodgeCombo\b[\s\S]*\bstartSlash\b[\s\S]*\}\s*=\s*createMoveTriggers\s*\(/.test(mainJs), 'main.js must destructure move trigger functions from the factory');
assert(/createMoveTriggers\s*\(\s*\{[\s\S]*player\s*:\s*P[\s\S]*clips\s*:\s*CLIPS[\s\S]*moves\s*:\s*MOVES[\s\S]*jumpVelocity\s*:\s*JUMP_V[\s\S]*sfx\s*:\s*SFX[\s\S]*attackBursts[\s\S]*swordBeam[\s\S]*stompEffects[\s\S]*poseClipController[\s\S]*setHitstop[\s\S]*setShake[\s\S]*resetDrillSpin[\s\S]*\}\s*\)/.test(mainJs), 'main.js must wire all move trigger dependencies');
for (const name of ['playClip', 'fireFx', 'doSlash', 'doThrust', 'startMove', 'startDodgeCombo', 'startSlash']) {
  assert(!new RegExp(`function\\s+${name}\\s*\\(`).test(mainJs), `main.js should not keep inline ${name}`);
}
for (const fx of ['slashR', 'slashL', 'chop', 'slam', 'stomp', 'drill', 'kick', 'rise', 'thrust', 'spinSlash', 'heavyCircle', 'heavyCircleBig']) {
  assert(!mainJs.includes(`case '${fx}'`), `main.js should not keep fireFx case ${fx}`);
}
assert(updateControllerJs.includes('playClip("pushGlasses")'), 'player updater should keep taunt clip call site');
assert(updateControllerJs.includes('fireFx(mv.fx)'), 'player updater should keep strike effect call site');
assert(updateControllerJs.includes('fireFx(mv.landFx)'), 'player updater should keep landing effect call site');
assert(updateControllerJs.includes('startDodgeCombo(P.dodgeBuffer)'), 'player updater should keep dodge combo call site');
assert(updateControllerJs.includes('startMove(onGround ? "gL1" : "aL1")'), 'player updater should keep primary attack start call site');
assert(moveTriggersJs.includes("case 'thrust':") && /SFX\.thrust\s*\(\s*\)\s*;\s*doThrust\s*\(\s*\)/.test(moveTriggersJs), 'move trigger module should preserve thrust SFX then impact order');

console.log('Player move triggers check passed.');
