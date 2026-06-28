import { createWolfAiController, lerpAngle } from '../prototype/3d/src/enemies/wolfAi.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function nearly(actual, expected, message, epsilon = 1e-9) {
  if (Math.abs(actual - expected) > epsilon) {
    throw new Error(`${message}: got ${actual}, expected ${expected}`);
  }
}

function assertFiniteWolf(ai, player, message) {
  for (const [key, value] of Object.entries({
    wx: ai.wx,
    wz: ai.wz,
    facing: ai.facing,
    playerX: player.x,
    playerZ: player.z,
  })) {
    assert(Number.isFinite(value), `${message}: ${key} should be finite`);
  }
}

function makeRandom(values = []) {
  const queue = [...values];
  return () => queue.length ? queue.shift() : 0.5;
}

function makeDocument() {
  const elements = new Map();
  return {
    body: {
      appended: [],
      appendChild(element) {
        this.appended.push(element);
        if (element.id) elements.set(element.id, element);
      },
    },
    createElement(tag) {
      return { tag, id: '', style: {} };
    },
    getElementById(id) {
      return elements.get(id) || null;
    },
  };
}

function makeWolf(initialState = 'idle') {
  const material = {
    emissive: {
      values: [],
      setHex(value) {
        this.values.push(value);
      },
    },
    emissiveIntensity: 0,
  };
  const meshes = [{ isMesh: true, material }];
  return {
    state: initialState,
    states: [],
    updates: [],
    root: {
      scale: {
        value: 1,
        setScalar(value) {
          this.value = value;
        },
      },
      position: {
        x: 0,
        y: 0,
        z: 0,
        set(x, y, z) {
          this.x = x;
          this.y = y;
          this.z = z;
        },
      },
      rotation: { y: 0 },
      traverse(fn) {
        for (const mesh of meshes) fn(mesh);
      },
    },
    J: { body: { children: [{ material }] } },
    setState(name) {
      this.state = name;
      this.states.push(name);
    },
    update(dt) {
      this.updates.push(dt);
    },
    material,
  };
}

function makePlayer(overrides = {}) {
  return {
    x: 0,
    z: -34,
    hp: 5,
    hpMax: 5,
    iframe: 0,
    dead: false,
    ...overrides,
  };
}

function createFixture({ randomValues = [], player = makePlayer(), wolf = makeWolf(), hittables = [] } = {}) {
  const timeouts = [];
  const hitstops = [];
  const documentRef = makeDocument();
  const controller = createWolfAiController({
    wolf,
    hittables,
    getPlayer: () => player,
    setHitstop: value => hitstops.push(value),
    documentRef,
    setTimeoutRef: (fn, ms) => { timeouts.push({ fn, ms }); return timeouts.length; },
    random: makeRandom(randomValues),
  });
  return { controller, ai: controller.wolfAI, wolf, player, hittables, timeouts, hitstops, documentRef };
}

{
  nearly(lerpAngle(Math.PI - 0.05, -Math.PI + 0.05, 0.5), Math.PI, 'lerpAngle should use shortest path across +/-PI');
}

{
  const { ai, wolf, hittables } = createFixture({ randomValues: [0, 0.5] });
  assert(wolf.root.scale.value === 1.4, 'wolf root should be scaled during AI setup');
  assert(wolf.root.position.x === 0 && wolf.root.position.y === 0.72 && wolf.root.position.z === -40, 'wolf root should be placed at spawn');
  assert(hittables.includes(ai.hittable), 'wolf hittable should be registered');
  assert(ai.hittable.mesh === wolf.root, 'wolf hittable should point at wolf root');
}

{
  const { controller, ai, wolf } = createFixture({ randomValues: [0, 0, 0.5, 0.25, 0.5] });
  ai.stateTimer = 0;
  controller.updateWolf(1);
  assert(ai.walking === true, 'patrol should toggle into walking when timer expires');
  assert(ai.stateTimer === 2, 'walking patrol timer should use 1 + random * 2');
  assert(wolf.states.includes('wander'), 'walking patrol should set wander animation');
  assert(Math.hypot(ai.wx, ai.wz + 40) > 0, 'walking patrol should move toward patrol target');
}

{
  const { controller, ai, wolf } = createFixture();
  ai.walking = true;
  ai.stateTimer = 1;
  ai.patrolTarget = { x: ai.wx, z: ai.wz };
  controller.updateWolf(0.25);
  assert(ai.stateTimer === 0, 'arriving at patrol target should force immediate pause transition');
  assert(!wolf.states.includes('wander'), 'arriving at patrol target should not divide by zero into movement');
}

{
  const { controller, ai } = createFixture({ player: makePlayer({ x: 0, z: -45 }) });
  ai.stateTimer = 1;
  ai.walking = false;
  ai.facing = 0;
  controller.updateWolf(0.1);
  assert(ai.state === 'look', 'player in front within vision cone should trigger look state');
  assert(ai.stateTimer === 2, 'look state should start with a 2 second timer');
}

{
  const { controller, ai } = createFixture({ player: makePlayer({ x: 0, z: -35 }) });
  ai.stateTimer = 1;
  ai.walking = false;
  ai.facing = 0;
  controller.updateWolf(0.1);
  assert(ai.state === 'patrol', 'player behind wolf should not trigger look state');
}

{
  const { controller, ai, wolf } = createFixture({ player: makePlayer({ x: 4, z: -40 }), wolf: makeWolf('wander') });
  ai.state = 'look';
  ai.stateTimer = 0.05;
  controller.updateWolf(0.1);
  assert(ai.state === 'chase', 'look timer expiration should enter chase');
  assert(wolf.states.includes('idle'), 'look state should hold idle animation');
}

{
  const { controller, ai, wolf } = createFixture({ player: makePlayer({ x: 10, z: -40 }) });
  ai.state = 'chase';
  ai.wx = 0;
  ai.wz = -40;
  ai.attackCool = 1;
  controller.updateWolf(1);
  nearly(ai.wx, 4.5, 'chase should move toward player at 4.5 units/sec');
  nearly(ai.wz, -40, 'chase should preserve z when player is horizontally aligned');
  assert(wolf.states.includes('run'), 'chase movement should set run animation');
  assert(ai.hittable.x === ai.wx && ai.hittable.z === ai.wz, 'hittable should sync to final AI position after movement');
  assert(wolf.root.position.x === ai.wx && wolf.root.position.z === ai.wz, 'wolf root should sync to final AI position');
}

{
  const { controller, ai, wolf } = createFixture({ player: makePlayer({ x: 10, z: -40 }), wolf: makeWolf('hurt') });
  ai.state = 'chase';
  ai.attackCool = 1;
  controller.updateWolf(1);
  assert(!wolf.states.includes('run'), 'chase should not override hurt animation with run');
}

{
  const player = makePlayer({ x: 0, z: -41, hp: 2, iframe: 0, dead: false });
  const { controller, ai, wolf, timeouts, hitstops, documentRef } = createFixture({ randomValues: [0, 0, 0.25], player });
  ai.state = 'chase';
  ai.wx = 0;
  ai.wz = -40;
  ai.attackCool = 0;
  controller.updateWolf(0.1);
  assert(wolf.states.includes('pounce'), 'attack should choose pounce when random < 0.5');
  nearly(ai.attackCool, 2.2, 'attack should reset cooldown');
  assert(player.hp === 1 && player.dead === false && player.iframe === 0.5, 'wolf attack should damage living player and set iframe');
  assert(hitstops.at(-1) === 0.12, 'wolf attack should assign hitstop');
  assert(Number.isFinite(player.x) && Number.isFinite(player.z), 'wolf attack knockback should stay finite');
  assert(timeouts.some(timeout => timeout.ms === 80) && timeouts.some(timeout => timeout.ms === 120), 'wolf attack should schedule hit flash and emissive reset');
  assert(documentRef.getElementById('hitFlash')?.style.opacity === '1', 'wolf attack should show hit flash');
}

{
  const player = makePlayer({ x: 0, z: -41, hp: 2, iframe: 0.2, dead: false });
  const { controller, ai, wolf, hitstops } = createFixture({ randomValues: [0, 0, 0.75], player });
  ai.state = 'chase';
  ai.wx = 0;
  ai.wz = -40;
  ai.attackCool = 0;
  controller.updateWolf(0.1);
  assert(wolf.states.includes('bite'), 'attack should choose bite when random >= 0.5');
  assert(player.hp === 2, 'iframe should prevent wolf damage');
  assert(hitstops.length === 0, 'iframe should prevent hitstop assignment from wolf damage');
  nearly(ai.attackCool, 2.2, 'attack should still start cooldown when damage is blocked');
}

{
  const player = makePlayer({ x: 0, z: -40, hp: 1, iframe: 0, dead: false });
  const { controller, ai } = createFixture({ randomValues: [0, 0, 0.25], player });
  ai.state = 'chase';
  ai.wx = 0;
  ai.wz = -40;
  ai.attackCool = 0;
  controller.updateWolf(0.1);
  assert(player.hp === 0 && player.dead === true, 'wolf damage should be able to kill player');
  assertFiniteWolf(ai, player, 'overlap attack');
}

{
  const player = makePlayer({ x: 20, z: -40 });
  const { controller, ai } = createFixture({ player });
  ai.state = 'chase';
  ai.wx = 0;
  ai.wz = -40;
  ai.attackCool = 1;
  controller.updateWolf(0.1);
  assert(ai.state === 'border' && ai.stateTimer === 1.2, 'leaving territory should put wolf on border guard');
}

{
  const player = makePlayer({ x: 12, z: -40 });
  const { controller, ai, wolf } = createFixture({ player });
  ai.state = 'border';
  ai.wx = 0;
  ai.wz = -40;
  ai.stateTimer = 1;
  controller.updateWolf(1);
  assert(wolf.states.includes('wander'), 'border state should walk toward territory edge when far from edge target');
  assert(Number.isFinite(ai.wx) && Number.isFinite(ai.wz), 'border movement should remain finite');
}

{
  const player = makePlayer({ x: 9, z: -40 });
  const { controller, ai } = createFixture({ player });
  ai.state = 'border';
  ai.wx = 12;
  ai.wz = -40;
  ai.stateTimer = 0;
  controller.updateWolf(0.1);
  assert(ai.state === 'chase', 'border state should resume chase after player returns inside territory');
}

{
  const player = makePlayer({ x: 30, z: -40 });
  const { controller, ai } = createFixture({ player });
  ai.state = 'border';
  ai.wx = 12;
  ai.wz = -40;
  ai.stateTimer = 1;
  controller.updateWolf(0.1);
  assert(ai.state === 'return', 'border state should return when player leaves alert radius');
}

{
  const { controller, ai, wolf } = createFixture();
  ai.state = 'return';
  ai.wx = 6;
  ai.wz = -40;
  controller.updateWolf(1);
  assert(wolf.states.includes('wander'), 'return state should walk toward spawn when far away');
}

{
  const { controller, ai } = createFixture();
  ai.state = 'return';
  ai.wx = ai.spawnX;
  ai.wz = ai.spawnZ;
  controller.updateWolf(0.1);
  assert(ai.state === 'patrol' && ai.walking === false && ai.stateTimer === 1, 'return state should settle back to patrol at spawn');
}

{
  const other = { name: 'other' };
  const { ai, wolf, hittables } = createFixture({ hittables: [other] });
  ai.hittable.onHit();
  assert(ai.hp === 14 && ai.state === 'chase', 'nonlethal hit should decrement hp and enter chase');
  assert(wolf.states.includes('hurt'), 'nonlethal hit should play hurt');
  ai.hp = 1;
  ai.hittable.onHit();
  assert(ai.state === 'dead' && ai.hittable._dead === true, 'lethal hit should mark wolf dead');
  assert(wolf.states.includes('death'), 'lethal hit should play death');
  assert(!hittables.includes(ai.hittable), 'lethal hit should remove wolf hittable');
  assert(hittables.includes(other), 'lethal hit should not remove unrelated hittable');
  const hpAfterDeath = ai.hp;
  ai.hittable.onHit();
  assert(ai.hp === hpAfterDeath, 'dead wolf should ignore further hits');
}

{
  const player = makePlayer({ x: 0, z: -40 });
  const { controller, ai } = createFixture({ player });
  ai.state = 'border';
  ai.wx = 0;
  ai.wz = -40;
  controller.updateWolf(0.1);
  assertFiniteWolf(ai, player, 'border with player at spawn');
}

console.log('Wolf AI check passed.');
