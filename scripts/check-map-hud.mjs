import fs from 'node:fs';
import path from 'node:path';
import { createMapHud } from '../prototype/3d/src/ui/mapHud.js';

const repoRoot = process.cwd();
const indexHtml = fs.readFileSync(path.join(repoRoot, 'prototype/3d/index.html'), 'utf8');
const mainJs = fs.readFileSync(path.join(repoRoot, 'prototype/3d/src/main.js'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function nearly(actual, expected, message, epsilon = 1e-9) {
  if (Math.abs(actual - expected) > epsilon) {
    throw new Error(`${message}: got ${actual}, expected ${expected}`);
  }
}

for (const id of [
  'c',
  'loading',
  'hud',
  'stamBar',
  'state',
  'miniMap',
  'miniMapCanvas',
  'miniMapMode',
  'compassLabel',
  'mapDockBtn',
  'worldMapOverlay',
  'closeWorldMap',
  'worldMapCanvas',
]) {
  const matches = [...indexHtml.matchAll(new RegExp(`\\bid=["']${id}["']`, 'g'))];
  assert(matches.length === 1, `Expected exactly one #${id}, found ${matches.length}`);
}

assert(/<canvas\b[^>]*\bid=["']miniMapCanvas["'][^>]*\bwidth=["']608["'][^>]*\bheight=["']608["'][^>]*>/i.test(indexHtml), 'miniMapCanvas must keep 608x608 drawing size');
assert(/<canvas\b[^>]*\bid=["']worldMapCanvas["'][^>]*\bwidth=["']1200["'][^>]*\bheight=["']820["'][^>]*>/i.test(indexHtml), 'worldMapCanvas must keep 1200x820 drawing size');
assert(mainJs.includes('import { createMapHud } from "./ui/mapHud.js";'), 'main.js must import mapHud module');
assert(mainJs.includes('mapHud.isWorldMapOpen()'), 'main.js update loop must use mapHud.isWorldMapOpen()');
assert(mainJs.includes('mapHud.updateHUD();'), 'main.js render loop must call mapHud.updateHUD()');

class FakeTarget {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }

  dispatch(type, event = {}) {
    for (const listener of this.listeners.get(type) || []) listener(event);
  }
}

class FakeElement extends FakeTarget {
  constructor() {
    super();
    this.textContent = '';
    this.title = '';
    this.style = {};
    this.onclick = null;
    const classes = new Set();
    this.classList = {
      add: name => classes.add(name),
      remove: name => classes.delete(name),
      contains: name => classes.has(name),
      toggle: (name, force) => {
        if (force) classes.add(name);
        else classes.delete(name);
      },
    };
  }
}

class FakeCanvas extends FakeElement {
  constructor(name, width, height) {
    super();
    this.width = width;
    this.height = height;
    this.ctx = new FakeContext(name);
  }

  getContext(type) {
    assert(type === '2d', `${this.ctx.name} requested unexpected context ${type}`);
    return this.ctx;
  }
}

class FakeContext {
  constructor(name) {
    this.name = name;
    this.ops = [];
  }

  record(name, ...args) {
    this.ops.push({ name, args });
  }

  set fillStyle(value) { this.record('fillStyle', value); }
  set strokeStyle(value) { this.record('strokeStyle', value); }
  set lineWidth(value) { this.record('lineWidth', value); }
  set font(value) { this.record('font', value); }
  set textAlign(value) { this.record('textAlign', value); }
  set textBaseline(value) { this.record('textBaseline', value); }
  set globalCompositeOperation(value) { this.record('globalCompositeOperation', value); }
  clearRect(...args) { this.record('clearRect', ...args); }
  save(...args) { this.record('save', ...args); }
  restore(...args) { this.record('restore', ...args); }
  translate(...args) { this.record('translate', ...args); }
  rotate(...args) { this.record('rotate', ...args); }
  fillRect(...args) { this.record('fillRect', ...args); }
  strokeRect(...args) { this.record('strokeRect', ...args); }
  beginPath(...args) { this.record('beginPath', ...args); }
  moveTo(...args) { this.record('moveTo', ...args); }
  lineTo(...args) { this.record('lineTo', ...args); }
  closePath(...args) { this.record('closePath', ...args); }
  fill(...args) { this.record('fill', ...args); }
  stroke(...args) { this.record('stroke', ...args); }
  arc(...args) { this.record('arc', ...args); }
  fillText(...args) { this.record('fillText', ...args); }
}

class FakeColor {
  constructor(color) {
    this.r = ((color >> 16) & 255) / 255;
    this.g = ((color >> 8) & 255) / 255;
    this.b = (color & 255) / 255;
  }
}

function countOps(ctx, name) {
  return ctx.ops.filter(op => op.name === name).length;
}

function textOps(ctx) {
  return ctx.ops.filter(op => op.name === 'fillText').map(op => op.args[0]);
}

function createFixture() {
  const elements = new Map([
    ['miniMapCanvas', new FakeCanvas('miniMapCanvas', 608, 608)],
    ['worldMapCanvas', new FakeCanvas('worldMapCanvas', 1200, 820)],
    ['miniMapMode', new FakeElement()],
    ['compassLabel', new FakeElement()],
    ['worldMapOverlay', new FakeElement()],
    ['mapDockBtn', new FakeElement()],
    ['closeWorldMap', new FakeElement()],
    ['stamBar', new FakeElement()],
    ['state', new FakeElement()],
  ]);
  elements.get('miniMapMode').textContent = 'N';
  elements.get('miniMapMode').title = '切换地图旋转模式';
  elements.get('compassLabel').textContent = 'N';

  const documentRef = {
    getElementById(id) {
      const element = elements.get(id);
      assert(element, `Missing fake element #${id}`);
      return element;
    },
  };
  const windowRef = new FakeTarget();
  const player = {
    x: 12,
    z: -8,
    y: 0,
    facing: Math.PI / 3,
    stamina: 100,
    staminaMax: 100,
    dead: false,
    state: 'idle',
    charging: false,
    chargeT: 0,
    chargeFull: false,
    move: null,
    phase: 'startup',
    jumping: false,
    moving: false,
  };
  const mapFeatures = [
    { type: 'terrain', x: 0, z: 0, w: 30, d: 30, rot: 0, color: 0x5a5241 },
    { type: 'road', x: 2, z: 0, w: 24, d: 4, rot: 0, color: 0x6d6049 },
    { type: 'wall', x: 10, z: 4, w: 10, d: 1, rot: 0, color: 0x6b5a4a },
    { type: 'building', name: 'home', sign: 'HOME', x: -8, z: -4, w: 6, d: 5, rot: 0, roofColor: 0x6c4738 },
    { type: 'training', name: '木桩', x: 5, z: -7, w: 1, d: 1, rot: 0 },
    { type: 'monster', name: '狼', x: -12, z: 8, w: 1, d: 1, rot: 0 },
  ];
  let clearCount = 0;
  const hud = createMapHud({
    THREE: { Color: FakeColor },
    roomSize: 130,
    mapFeatures,
    getPlayer: () => player,
    heavyChargeTime: 1,
    clearGameplayInputState: () => { clearCount++; },
    documentRef,
    windowRef,
  });
  return { hud, elements, windowRef, player, getClearCount: () => clearCount };
}

const { hud, elements, windowRef, player, getClearCount } = createFixture();
const miniCtx = elements.get('miniMapCanvas').ctx;
const worldCtx = elements.get('worldMapCanvas').ctx;

assert(hud.isWorldMapOpen() === false, 'world map should start closed');
hud.updateHUD();
assert(elements.get('stamBar').style.width === '100%', 'full stamina should fill bar');
assert(elements.get('stamBar').style.background === '#5bc0de', 'full stamina should use blue bar');
assert(elements.get('state').textContent === '状态: 待机', 'idle state text should render');
assert(countOps(miniCtx, 'clearRect') === 0, 'mini map should draw every second HUD update');

player.stamina = 20;
player.charging = true;
player.chargeT = 0.5;
player.chargeFull = true;
hud.updateHUD();
assert(elements.get('stamBar').style.width === '20%', 'low stamina should shrink bar');
assert(elements.get('stamBar').style.background === '#d9534f', 'low stamina should use red bar');
assert(elements.get('state').textContent === '状态: 蓄力 50% 满!', 'charging state text should render');
assert(countOps(miniCtx, 'clearRect') === 1, 'second HUD update should draw mini map');

player.charging = false;
player.chargeFull = false;
player.move = 'a1';
player.phase = 'startup';
hud.updateHUD();
assert(elements.get('state').textContent === '状态: 连招: a1(预备)', 'startup move state text should render');
player.phase = 'hold';
hud.updateHUD();
assert(elements.get('state').textContent === '状态: 连招: a1(收势)', 'hold move state text should render');
player.move = null;

elements.get('miniMapMode').onclick();
assert(elements.get('miniMapMode').textContent === '↑', 'mini map mode should toggle to facing mode');
assert(elements.get('miniMapMode').title === '角色朝向固定', 'mini map mode title should switch');
assert(elements.get('compassLabel').textContent === '', 'facing mode should hide north label');
hud.drawMiniMap();
assert(miniCtx.ops.some(op => op.name === 'rotate' && Math.abs(op.args[0] - (player.facing - Math.PI)) < 1e-9), 'facing mode should rotate mini map by player facing');
assert(miniCtx.ops.some(op => op.name === 'rotate' && Math.abs(op.args[0]) < 1e-9), 'facing mode should keep player marker upright');
elements.get('miniMapMode').onclick();
assert(elements.get('miniMapMode').textContent === 'N', 'mini map mode should toggle back to north mode');
assert(elements.get('compassLabel').textContent === 'N', 'north mode should show north label');

elements.get('mapDockBtn').onclick();
assert(getClearCount() === 1, 'opening world map should clear gameplay input');
assert(hud.isWorldMapOpen() === true, 'map dock should open world map');
assert(countOps(worldCtx, 'clearRect') > 0, 'opening world map should draw map canvas');
for (const label of ['N', 'S', 'W', 'E', 'HOME', '怪', '桩']) {
  assert(textOps(worldCtx).includes(label), `world map should draw ${label} label`);
}

elements.get('closeWorldMap').onclick();
assert(getClearCount() === 2, 'close button should clear gameplay input');
assert(hud.isWorldMapOpen() === false, 'close button should close world map');

hud.openWorldMap();
assert(getClearCount() === 3, 'openWorldMap API should clear gameplay input');
elements.get('worldMapOverlay').dispatch('click', { target: elements.get('worldMapOverlay') });
assert(getClearCount() === 4, 'overlay click should clear gameplay input');
assert(hud.isWorldMapOpen() === false, 'overlay click should close world map');

hud.openWorldMap();
const beforeEscapeClear = getClearCount();
windowRef.dispatch('keydown', { code: 'Escape' });
assert(getClearCount() === beforeEscapeClear + 1, 'Escape should clear gameplay input when map is open');
assert(hud.isWorldMapOpen() === false, 'Escape should close world map');

hud.openWorldMap();
const worldDrawsBefore = countOps(worldCtx, 'clearRect');
for (let i = 0; i < 6; i++) hud.updateHUD();
assert(countOps(worldCtx, 'clearRect') > worldDrawsBefore, 'open world map should refresh during HUD updates');

hud.drawWorldMap();
const lastCompass = textOps(worldCtx).slice(-4);
assert(lastCompass.join(',') === 'N,S,W,E', 'world map should draw compass labels in order');

nearly(elements.get('miniMapCanvas').width, 608, 'fake mini map width should match runtime contract');
nearly(elements.get('worldMapCanvas').height, 820, 'fake world map height should match runtime contract');

console.log('Map HUD check passed.');
