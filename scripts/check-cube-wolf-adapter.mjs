import fs from 'node:fs';
import path from 'node:path';
import { makeCubeWolfObj } from '../prototype/3d/src/enemies/cubeWolfAdapter.js';

const repoRoot = process.cwd();
const mainJs = fs.readFileSync(path.join(repoRoot, 'prototype/3d/src/main.js'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function nearly(actual, expected, message, epsilon = 1e-9) {
  if (Math.abs(actual - expected) > epsilon) {
    throw new Error(`${message}: got ${actual}, expected ${expected}`);
  }
}

class FakeVector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }
}

class FakeAction {
  constructor(clip) {
    this.clip = clip;
    this.calls = [];
    this.clampWhenFinished = null;
    this.loop = null;
    this.repetitions = null;
  }

  setLoop(loop, repetitions) {
    this.loop = loop;
    this.repetitions = repetitions;
    this.calls.push(['setLoop', loop, repetitions]);
    return this;
  }

  reset() {
    this.calls.push(['reset']);
    return this;
  }

  fadeIn(duration) {
    this.calls.push(['fadeIn', duration]);
    return this;
  }

  fadeOut(duration) {
    this.calls.push(['fadeOut', duration]);
    return this;
  }

  play() {
    this.calls.push(['play']);
    return this;
  }
}

class FakeAnimationMixer {
  constructor(root) {
    this.root = root;
    this.actions = new Map();
    this.listeners = new Map();
    this.updates = [];
    FakeAnimationMixer.instances.push(this);
  }

  clipAction(clip) {
    if (!this.actions.has(clip.name)) this.actions.set(clip.name, new FakeAction(clip));
    return this.actions.get(clip.name);
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  update(dt) {
    this.updates.push(dt);
  }
}
FakeAnimationMixer.instances = [];

const THREE = {
  AnimationMixer: FakeAnimationMixer,
  LoopRepeat: 'LoopRepeat',
  LoopOnce: 'LoopOnce',
};

function makeRoot({ meshes = [{ isMesh: true, material: { id: 'first' } }, { isMesh: true, material: { id: 'second' } }] } = {}) {
  const objects = [{ isMesh: false }, ...meshes];
  return {
    scale: {
      value: 1,
      setScalar(value) {
        this.value = value;
      },
    },
    rotation: { y: 0 },
    position: new FakeVector3(),
    traversed: [],
    traverse(fn) {
      for (const object of objects) {
        this.traversed.push(object);
        fn(object);
      }
    },
    objects,
  };
}

function makeScene() {
  const added = [];
  return {
    added,
    add(object) {
      added.push(object);
    },
  };
}

function makeClips(names = ['Idle', 'Walk', 'Run', 'Jump_Start', 'Headbutt', 'Death']) {
  return names.map(name => ({ name }));
}

function action(adapter, name) {
  return adapter.mixer.actions.get(name);
}

function createFixture({ root = makeRoot(), clips = makeClips() } = {}) {
  FakeAnimationMixer.instances = [];
  const scene = makeScene();
  const wolf = makeCubeWolfObj({ scene }, root, clips, THREE);
  const mixer = FakeAnimationMixer.instances[0];
  return { scene, root, wolf, mixer };
}

assert(typeof makeCubeWolfObj === 'function', 'cubeWolfAdapter.js must export makeCubeWolfObj');

{
  const { scene, root, wolf, mixer } = createFixture();
  assert(scene.added.length === 1 && scene.added[0] === root, 'scene.add should receive original GLTF root once');
  assert(wolf.root === root, 'adapter root should be original gltfScene');
  nearly(root.scale.value, 1.35, 'root scale');
  nearly(root.rotation.y, Math.PI, 'root rotation.y');
  nearly(root.position.x, 5, 'root position.x');
  nearly(root.position.y, 0, 'root position.y');
  nearly(root.position.z, -5, 'root position.z');
  assert(mixer.root === root, 'AnimationMixer should be created for the root');
}

{
  const nonMesh = { isMesh: false };
  const meshA = { isMesh: true, material: { id: 'a' } };
  const meshB = { isMesh: true, material: { id: 'b' } };
  const root = makeRoot({ meshes: [nonMesh, meshA, meshB] });
  createFixture({ root });
  assert(meshA.castShadow === true && meshA.receiveShadow === true, 'first mesh shadow flags');
  assert(meshB.castShadow === true && meshB.receiveShadow === true, 'second mesh shadow flags');
  assert(nonMesh.castShadow === undefined && nonMesh.receiveShadow === undefined, 'non-mesh shadow flags should stay untouched');
}

{
  const { wolf, mixer } = createFixture();
  assert(wolf.state === 'idle', 'initial state should be idle');
  const idle = action({ mixer }, 'Idle');
  assert(idle.loop === THREE.LoopRepeat && idle.repetitions === Infinity, 'Idle should use repeat loop');
  assert(idle.clampWhenFinished === false, 'Idle should not clamp when looped');
  assert(JSON.stringify(idle.calls) === JSON.stringify([
    ['setLoop', THREE.LoopRepeat, Infinity],
    ['reset'],
    ['fadeIn', 0.2],
    ['play'],
  ]), 'Idle action should reset, fade in, and play after setLoop');
}

{
  const { wolf, mixer } = createFixture();
  const cases = [
    ['wander', 'Walk', THREE.LoopRepeat, false],
    ['run', 'Run', THREE.LoopRepeat, false],
    ['pounce', 'Jump_Start', THREE.LoopOnce, true],
    ['bite', 'Headbutt', THREE.LoopOnce, true],
    ['death', 'Death', THREE.LoopOnce, true],
    ['hurt', 'Idle', THREE.LoopOnce, true],
    ['howl', 'Idle', THREE.LoopRepeat, false],
    ['bogus', 'Idle', THREE.LoopRepeat, false],
  ];
  for (const [state, clipName, expectedLoop, expectedClamp] of cases) {
    wolf.setState(state);
    assert(wolf.state === state, `${state} should be reflected by state getter`);
    const played = mixer.actions.get(clipName);
    assert(played, `${state} should play ${clipName}`);
    assert(played.loop === expectedLoop, `${state} loop mode`);
    assert(played.clampWhenFinished === expectedClamp, `${state} clampWhenFinished`);
  }
}

{
  const { wolf, mixer } = createFixture();
  const idle = mixer.actions.get('Idle');
  wolf.setState('run');
  const run = mixer.actions.get('Run');
  assert(idle.calls.some(call => call[0] === 'fadeOut' && call[1] === 0.2), 'switching from Idle to Run should fade out Idle');
  assert(run.calls.some(call => call[0] === 'fadeIn' && call[1] === 0.2), 'Run should fade in');
  const fadeOutsBefore = run.calls.filter(call => call[0] === 'fadeOut').length;
  wolf.setState('run');
  const fadeOutsAfter = run.calls.filter(call => call[0] === 'fadeOut').length;
  assert(fadeOutsAfter === fadeOutsBefore, 'setting the same action should not fade itself out');
}

{
  const { wolf, mixer } = createFixture({ clips: makeClips(['Idle', 'Run']) });
  wolf.setState('run');
  const run = mixer.actions.get('Run');
  wolf.setState('death');
  assert(!mixer.actions.has('Death'), 'missing Death clip should not create an action');
  const runFadeOuts = run.calls.filter(call => call[0] === 'fadeOut').length;
  assert(runFadeOuts === 0, 'missing clip should not replace or fade current action');
  assert(wolf.state === 'death', 'state getter should still reflect requested missing-clip state');
}

{
  const { wolf, mixer } = createFixture();
  assert(typeof mixer.listeners.get('finished') === 'function', 'finished listener should be registered');
  wolf.setState('pounce');
  mixer.listeners.get('finished')();
  assert(wolf.state === 'idle', 'finished listener should return state to idle');
  wolf.update(0.125);
  nearly(mixer.updates.at(-1), 0.125, 'update should forward dt to mixer');
}

{
  const firstMesh = { isMesh: true, material: { id: 'first' } };
  const secondMesh = { isMesh: true, material: { id: 'second' } };
  const { wolf } = createFixture({ root: makeRoot({ meshes: [firstMesh, secondMesh] }) });
  assert(wolf.J.body.children[0] === firstMesh, 'J body child should be the first mesh');
}

{
  const { wolf } = createFixture({ root: makeRoot({ meshes: [] }) });
  const fallback = wolf.J.body.children[0];
  assert(typeof fallback.material.emissive.setHex === 'function', 'fallback material should expose emissive.setHex');
  assert(fallback.material.emissiveIntensity === 0, 'fallback material emissiveIntensity');
  fallback.material.emissive.setHex(0xff0000);
}

assert(!mainJs.includes('function makeCubeWolfObj'), 'main.js should not retain inline cube wolf adapter function');
assert(!mainJs.includes('const clipMap = {};'), 'main.js should not retain inline cube wolf clip map');
assert(!mainJs.includes("const STATE_MAP = {idle:'Idle'"), 'main.js should not retain inline cube wolf state map');
assert(!mainJs.includes('new loader_THREE.AnimationMixer(root)'), 'main.js should not retain inline cube wolf mixer setup');
assert(!mainJs.includes("mixer.addEventListener('finished'"), 'main.js should not retain inline cube wolf finished listener');
assert(!mainJs.includes('firstMesh = (() =>'), 'main.js should not retain inline cube wolf firstMesh finder');
assert(!mainJs.includes('cubeWolfAdapter.js'), 'main.js should not import unused cube wolf adapter before it is wired');

console.log('Cube wolf adapter check passed.');
