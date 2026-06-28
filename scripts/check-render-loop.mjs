import { createWaterReflectionPass } from '../prototype/3d/src/rendering/waterReflection.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

class FakeMatrix {
  constructor(name, events) {
    this.name = name;
    this.events = events;
  }

  set(...values) {
    this.events.push(['matrix.set', this.name, values]);
    this.values = values;
    return this;
  }

  copy(source) {
    this.events.push(['matrix.copy', this.name, source.name]);
    return this;
  }

  multiply(source) {
    this.events.push(['matrix.multiply', this.name, source.name]);
    return this;
  }

  invert() {
    this.events.push(['matrix.invert', this.name]);
    return this;
  }
}

class FakeRT {
  constructor(name, events, width = 1, height = 1) {
    this.name = name;
    this.events = events;
    this.width = width;
    this.height = height;
    this.texture = { name: `${name}.texture` };
  }

  setSize(width, height) {
    this.events.push(['rt.setSize', this.name, width, height]);
    this.width = width;
    this.height = height;
  }
}

class FakeRenderer {
  constructor(events, { throwOnRender = false } = {}) {
    this.events = events;
    this.domElement = { width: 800, height: 600 };
    this.clippingPlanes = [];
    this.target = null;
    this.throwOnRender = throwOnRender;
  }

  setRenderTarget(target) {
    this.events.push(['renderer.setRenderTarget', target?.name ?? null]);
    this.target = target;
  }

  getRenderTarget() {
    return this.target;
  }

  render(scene, camera) {
    this.onRender?.();
    this.events.push(['renderer.render', scene.name, camera.name, this.target?.name ?? null, this.clippingPlanes.length]);
    if (this.throwOnRender) throw new Error('render failed');
  }
}

function createFixture({ throwOnRender = false, matchingSize = false } = {}) {
  const events = [];
  const renderer = new FakeRenderer(events, { throwOnRender });
  const reflRT = new FakeRT('reflRT', events, matchingSize ? 800 : 1, matchingSize ? 600 : 1);
  const sceneRT = new FakeRT('sceneRT', events, matchingSize ? 800 : 1, matchingSize ? 600 : 1);
  const scene = { name: 'scene' };
  const camera = {
    name: 'camera',
    projectionMatrix: new FakeMatrix('camera.projectionMatrix', events),
    matrixWorld: new FakeMatrix('camera.matrixWorld', events),
  };
  const reflCam = {
    name: 'reflCam',
    projectionMatrix: new FakeMatrix('reflCam.projectionMatrix', events),
    matrixWorld: new FakeMatrix('reflCam.matrixWorld', events),
    matrixWorldInverse: new FakeMatrix('reflCam.matrixWorldInverse', events),
  };
  const reflClip = { constant: 0 };
  const reflMatrix = new FakeMatrix('reflMatrix', events);
  const waterReflectionMeshes = [{ visible: true }, { visible: true }];
  renderer.onRender = () => {
    events.push(['water.hiddenDuringRender', waterReflectionMeshes.every(mesh => mesh.visible === false)]);
  };
  const waterSurfaceMaterial = {
    uniforms: {
      uRes: {
        value: {
          set(width, height) {
            events.push(['uRes.set', width, height]);
          },
        },
      },
    },
  };
  const pass = createWaterReflectionPass({
    renderer,
    scene,
    camera,
    reflRT,
    sceneRT,
    reflCam,
    reflClip,
    reflMatrix,
    waterReflectionMeshes,
    getWaterSurfaceMaterial: () => waterSurfaceMaterial,
  });
  return { pass, events, renderer, reflRT, sceneRT, reflClip, reflMatrix, waterReflectionMeshes };
}

{
  const { pass, events, renderer, reflRT, sceneRT, reflClip, reflMatrix, waterReflectionMeshes } = createFixture();
  pass.render();

  assert(reflRT.width === 800 && reflRT.height === 600, 'reflection RT should resize to renderer drawing buffer');
  assert(sceneRT.width === 800 && sceneRT.height === 600, 'scene RT should resize with reflection RT');
  assert(events.some(event => event[0] === 'uRes.set' && event[1] === 800 && event[2] === 600), 'water uRes should sync to renderer drawing buffer');
  assert(reflClip.constant === 2, 'reflection clip constant should mirror waterY -2');
  assert(reflMatrix.values?.[7] === -4, 'reflection matrix should use 2 * waterY');

  const renderEvent = events.find(event => event[0] === 'renderer.render');
  assert(renderEvent?.[1] === 'scene' && renderEvent?.[2] === 'reflCam', 'reflection pass should render scene with reflCam');
  assert(renderEvent?.[3] === 'reflRT', 'reflection render should target reflRT');
  assert(renderEvent?.[4] === 1, 'reflection render should set one clipping plane');
  assert(events.some(event => event[0] === 'water.hiddenDuringRender' && event[1] === true), 'water meshes should be hidden during reflection render');
  assert(waterReflectionMeshes.every(mesh => mesh.visible === true), 'water reflection meshes should be visible after pass');
  assert(renderer.getRenderTarget() === null, 'render target should reset to null after pass');
  assert(renderer.clippingPlanes.length === 0, 'clipping planes should reset after pass');

  const order = events.map(event => `${event[0]}:${event[1] ?? ''}`);
  assert(order.indexOf('renderer.setRenderTarget:reflRT') < order.indexOf('renderer.render:scene'), 'setRenderTarget(reflRT) should happen before reflection render');
  assert(order.indexOf('renderer.render:scene') < order.indexOf('renderer.setRenderTarget:'), 'render target reset should happen after reflection render');

  events.length = 0;
  pass.render();
  assert(!events.some(event => event[0] === 'rt.setSize'), 'matching render target size should not resize');
  assert(!events.some(event => event[0] === 'uRes.set'), 'matching render target size should not update uRes');
}

{
  const { pass, renderer, waterReflectionMeshes } = createFixture({ throwOnRender: true });
  let threw = false;
  try {
    pass.render();
  } catch (error) {
    threw = error.message === 'render failed';
  }
  assert(threw, 'reflection render error should propagate');
  assert(waterReflectionMeshes.every(mesh => mesh.visible === true), 'water meshes should be restored after render error');
  assert(renderer.getRenderTarget() === null, 'render target should reset after render error');
  assert(renderer.clippingPlanes.length === 0, 'clipping planes should reset after render error');
}

{
  const { pass, events } = createFixture({ matchingSize: true });
  pass.render();
  assert(!events.some(event => event[0] === 'rt.setSize'), 'initial matching size should skip render target resize');
}

console.log('Render loop check passed.');
