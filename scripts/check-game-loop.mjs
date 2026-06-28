import { createGameLoop } from '../prototype/3d/src/loop.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function createFixture({ delta = 0.2, skyData = { name: 'sky' }, wolfError = null } = {}) {
  const events = [];
  const rafCallbacks = [];
  const clock = {
    elapsedValues: [10, 11, 12, 13],
    getDelta() {
      events.push(['clock.getDelta']);
      return delta;
    },
    getElapsedTime() {
      const value = this.elapsedValues.shift();
      events.push(['clock.getElapsedTime', value]);
      return value;
    },
  };
  const camera = { name: 'camera' };
  const scene = { name: 'scene' };
  const grassMats = [{ name: 'grassMat' }];
  const loop = createGameLoop({
    clock,
    update(dt) {
      events.push(['update', dt]);
    },
    updateWolf(dt) {
      events.push(['updateWolf', dt]);
      if (wolfError) throw wolfError;
    },
    updateSky({ skyData: data, camera: skyCamera, dt }) {
      events.push(['updateSky', data, skyCamera, dt]);
    },
    getSkyData() {
      events.push(['getSkyData']);
      return skyData;
    },
    camera,
    updateWater(time) {
      events.push(['updateWater', time]);
    },
    cameraController: {
      updateCamera(dt) {
        events.push(['camera.updateCamera', dt]);
      },
    },
    mapHud: {
      updateHUD() {
        events.push(['mapHud.updateHUD']);
      },
    },
    updateGrass({ grassMats: mats, time }) {
      events.push(['updateGrass', mats, time]);
    },
    getGrassMats() {
      events.push(['getGrassMats']);
      return grassMats;
    },
    waterReflectionPass: {
      render() {
        events.push(['waterReflection.render']);
      },
    },
    renderer: {
      render(renderScene, renderCamera) {
        events.push(['renderer.render', renderScene, renderCamera]);
      },
    },
    scene,
    requestAnimationFrameRef(callback) {
      events.push(['requestAnimationFrame', callback]);
      rafCallbacks.push(callback);
    },
    consoleRef: {
      error(...args) {
        events.push(['console.error', args]);
      },
    },
  });
  return { events, loop, rafCallbacks, camera, scene, skyData, grassMats };
}

{
  const { events, loop, rafCallbacks, camera, scene, skyData, grassMats } = createFixture();
  loop.start();
  const names = events.map(event => event[0]);
  assert(events.find(event => event[0] === 'update')?.[1] === 0.05, 'main update should receive clamped dt');
  assert(events.find(event => event[0] === 'updateWolf')?.[1] === 0.05, 'wolf update should receive clamped dt');
  assert(events.find(event => event[0] === 'updateSky')?.[1] === skyData, 'sky update should receive current skyData');
  assert(events.find(event => event[0] === 'updateSky')?.[2] === camera, 'sky update should receive camera');
  assert(events.find(event => event[0] === 'updateSky')?.[3] === 0.05, 'sky update should receive clamped dt');
  assert(events.find(event => event[0] === 'updateWater')?.[1] === 10, 'water update should use first elapsed time');
  assert(events.find(event => event[0] === 'camera.updateCamera')?.[1] === 0.05, 'camera update should receive clamped dt');
  assert(events.find(event => event[0] === 'updateGrass')?.[1] === grassMats, 'grass update should receive grass mats');
  assert(events.find(event => event[0] === 'updateGrass')?.[2] === 11, 'grass update should use second elapsed time');
  assert(events.find(event => event[0] === 'renderer.render')?.[1] === scene, 'renderer should render scene');
  assert(events.find(event => event[0] === 'renderer.render')?.[2] === camera, 'renderer should render camera');
  assert(rafCallbacks.length === 1 && rafCallbacks[0] === loop.loop, 'loop should schedule itself with requestAnimationFrame');

  const expectedOrder = [
    'clock.getDelta',
    'update',
    'updateWolf',
    'getSkyData',
    'updateSky',
    'clock.getElapsedTime',
    'updateWater',
    'camera.updateCamera',
    'mapHud.updateHUD',
    'getGrassMats',
    'clock.getElapsedTime',
    'updateGrass',
    'waterReflection.render',
    'renderer.render',
    'requestAnimationFrame',
  ];
  for (let index = 0; index < expectedOrder.length; index += 1) {
    assert(names[index] === expectedOrder[index], `event ${index} should be ${expectedOrder[index]}, got ${names[index]}`);
  }
  assert(names.length === expectedOrder.length, `loop should emit exactly ${expectedOrder.length} events, got ${names.length}`);

  events.length = 0;
  const nextFrame = rafCallbacks.shift();
  nextFrame();
  assert(rafCallbacks.length === 1 && rafCallbacks[0] === loop.loop, 'scheduled RAF callback should reschedule the loop');
  assert(events.find(event => event[0] === 'updateWater')?.[1] === 12, 'second frame water update should use the next elapsed time');
  assert(events.find(event => event[0] === 'updateGrass')?.[2] === 13, 'second frame grass update should use the next elapsed time');
}

{
  const { events } = createFixture({ delta: 0.016, skyData: null });
  createGameLoop({
    clock: {
      getDelta: () => 0.016,
      getElapsedTime: () => 1,
    },
    update: dt => events.push(['update', dt]),
    updateWolf: dt => events.push(['updateWolf', dt]),
    updateSky: () => events.push(['updateSky']),
    getSkyData: () => null,
    camera: {},
    updateWater: () => events.push(['updateWater']),
    cameraController: { updateCamera: () => events.push(['camera.updateCamera']) },
    mapHud: { updateHUD: () => events.push(['mapHud.updateHUD']) },
    updateGrass: () => events.push(['updateGrass']),
    getGrassMats: () => [],
    waterReflectionPass: { render: () => events.push(['waterReflection.render']) },
    renderer: { render: () => events.push(['renderer.render']) },
    scene: {},
    requestAnimationFrameRef: () => events.push(['requestAnimationFrame']),
  }).start();
  assert(!events.some(event => event[0] === 'updateSky'), 'sky update should be skipped when skyData is missing');
  assert(events.some(event => event[0] === 'renderer.render'), 'renderer should still render without skyData');
}

{
  const wolfError = new Error('wolf failed');
  const { events } = createFixture({ wolfError });
  createGameLoop({
    clock: {
      getDelta: () => 0.01,
      getElapsedTime: () => 1,
    },
    update: () => events.push(['update']),
    updateWolf: () => { events.push(['updateWolf']); throw wolfError; },
    updateSky: () => events.push(['updateSky']),
    getSkyData: () => null,
    camera: {},
    updateWater: () => events.push(['updateWater']),
    cameraController: { updateCamera: () => events.push(['camera.updateCamera']) },
    mapHud: { updateHUD: () => events.push(['mapHud.updateHUD']) },
    updateGrass: () => events.push(['updateGrass']),
    getGrassMats: () => [],
    waterReflectionPass: { render: () => events.push(['waterReflection.render']) },
    renderer: { render: () => events.push(['renderer.render']) },
    scene: {},
    requestAnimationFrameRef: () => events.push(['requestAnimationFrame']),
    consoleRef: { error: (...args) => events.push(['console.error', args]) },
  }).start();
  assert(events.find(event => event[0] === 'console.error')?.[1]?.[0] === 'wolf err:', 'wolf errors should keep the existing log label');
  assert(events.some(event => event[0] === 'renderer.render'), 'wolf errors should not stop final render');
  assert(events.some(event => event[0] === 'requestAnimationFrame'), 'wolf errors should not stop RAF scheduling');
}

console.log('Game loop check passed.');
