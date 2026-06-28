import fs from 'node:fs';
import path from 'node:path';
import { createGhostAfterimages } from '../prototype/3d/src/player/ghostAfterimages.js';

const repoRoot = process.cwd();
const mainJs = fs.readFileSync(path.join(repoRoot, 'prototype/3d/src/main.js'), 'utf8');
const updateControllerJs = fs.readFileSync(path.join(repoRoot, 'prototype/3d/src/player/updateController.js'), 'utf8');
const runtimeCombatJs = fs.readFileSync(path.join(repoRoot, 'prototype/3d/src/combat/runtimeCombat.js'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function nearly(actual, expected, message, epsilon = 1e-6) {
  if (Math.abs(actual - expected) > epsilon) {
    throw new Error(`${message}: got ${actual}, expected ${expected}`);
  }
}

class FakeGeometry {
  constructor(...args) {
    this.args = args;
  }
}

class FakeMaterial {
  constructor(options) {
    this.options = options;
    this.opacity = options.opacity;
  }
}

class FakeTransform {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.z = 0;
  }

  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
}

class FakeMesh {
  constructor(geometry, material) {
    this.geometry = geometry;
    this.material = material;
    this.position = new FakeTransform();
    this.rotation = new FakeTransform();
    this.visible = true;
    this.life = undefined;
  }
}

const THREE = {
  CapsuleGeometry: FakeGeometry,
  MeshBasicMaterial: FakeMaterial,
  Mesh: FakeMesh,
};

function createFixture({ player = { x: 4, y: 0, z: -2 }, yaw = { value: 0.7 } } = {}) {
  const added = [];
  const scene = {
    add(object) { added.push(object); },
  };
  const ghostAfterimages = createGhostAfterimages({
    THREE,
    scene,
    getPlayer: () => player,
    getYawRotationY: () => yaw.value,
  });
  return { added, ghostAfterimages, player, yaw };
}

{
  const { added, ghostAfterimages } = createFixture();
  assert(ghostAfterimages.ghosts.length === 6, 'ghost pool should keep six meshes');
  assert(added.length === 6, 'all ghost meshes should be added to the scene at construction');
  for (const ghost of ghostAfterimages.ghosts) {
    assert(ghost.geometry.args[0] === 0.45, 'ghost capsule radius should stay 0.45');
    assert(ghost.geometry.args[1] === 1.4, 'ghost capsule length should stay 1.4');
    assert(ghost.geometry.args[2] === 4, 'ghost capsule cap segments should stay 4');
    assert(ghost.geometry.args[3] === 8, 'ghost capsule radial segments should stay 8');
    assert(ghost.material.options.color === 0x9fd8ff, 'ghost material color should stay unchanged');
    assert(ghost.material.options.transparent === true, 'ghost material should be transparent');
    assert(ghost.material.options.opacity === 0, 'ghost material should start at opacity 0');
    assert(ghost.material.options.depthWrite === false, 'ghost material should not write depth');
    assert(ghost.visible === false, 'ghost should start hidden');
    assert(ghost.life === 0, 'ghost should start with zero life');
  }
}

{
  const { added, ghostAfterimages, player, yaw } = createFixture();
  player.x = 10;
  player.y = 2.5;
  player.z = -9;
  yaw.value = 1.25;
  const ghost = ghostAfterimages.spawnGhost();
  assert(ghost === added[0], 'first spawn should use the first pooled ghost');
  nearly(ghost.position.x, 10, 'ghost x should snapshot live player x');
  nearly(ghost.position.y, 3.6, 'ghost y should snapshot player y plus 1.1');
  nearly(ghost.position.z, -9, 'ghost z should snapshot live player z');
  nearly(ghost.rotation.y, 1.25, 'ghost yaw should snapshot live yaw');
  assert(ghost.visible === true, 'spawned ghost should be visible');
  nearly(ghost.life, 0.32, 'spawned ghost life should stay 0.32');
  nearly(ghost.material.opacity, 0.5, 'spawned ghost opacity should start at 0.5');

  for (let i = 1; i < 6; i += 1) ghostAfterimages.spawnGhost();
  player.x = -3;
  const wrapped = ghostAfterimages.spawnGhost();
  assert(wrapped === added[0], 'seventh spawn should wrap to the first pooled ghost');
  nearly(wrapped.position.x, -3, 'wrapped ghost should receive fresh position');
}

{
  const { added, ghostAfterimages } = createFixture();
  ghostAfterimages.tickDodge(0.016);
  assert(added[0].visible === true, 'first dodge tick should spawn immediately because timer starts at 0');
  assert(added[1].visible === false, 'first dodge tick should only spawn one ghost');

  ghostAfterimages.tickDodge(0.02);
  assert(added[1].visible === false, 'dodge timer should wait until 0.04 seconds elapse');
  ghostAfterimages.tickDodge(0.02);
  assert(added[1].visible === true, 'dodge timer should spawn on the 0.04 second cadence');
  ghostAfterimages.tickDodge(0.04);
  assert(added[2].visible === true, 'dodge timer should keep spawning every 0.04 seconds');
}

{
  const { added, ghostAfterimages } = createFixture();
  const ghost = ghostAfterimages.spawnGhost();
  ghostAfterimages.update(0.1);
  nearly(ghost.life, 0.22, 'ghost update should reduce life by dt');
  nearly(ghost.material.opacity, 0.22 * 1.8, 'ghost opacity should follow life * 1.8');
  assert(ghost.visible === true, 'ghost should remain visible while life is positive');

  ghostAfterimages.update(0.22);
  nearly(ghost.material.opacity, 0, 'ghost opacity should clamp at 0');
  assert(ghost.visible === false, 'ghost should hide when life reaches zero');
  ghost.position.x = 123;
  ghostAfterimages.update(1);
  nearly(ghost.position.x, 123, 'hidden ghost update should leave transform untouched');
}

assert(runtimeCombatJs.includes('import { createGhostAfterimages } from "../player/ghostAfterimages.js";'), 'runtime combat must import ghost afterimages module');
assert(/\bconst\s+ghostAfterimages\s*=\s*createGhostAfterimages\s*\(\s*\{[\s\S]*THREE[\s\S]*scene[\s\S]*getPlayer[\s\S]*getYawRotationY\s*:\s*\(\s*\)\s*=>\s*yaw\.rotation\.y/.test(runtimeCombatJs), 'runtime combat must create ghostAfterimages with live player and yaw dependencies');
assert(/if\s*\(\s*P\.state\s*===\s*["']dodge["']\s*\)\s*\{[\s\S]*ghostAfterimages\.tickDodge\s*\(\s*dt\s*\)/.test(updateControllerJs), 'dodge movement branch must tick ghost afterimages');
assert(/function\s+updateFx\s*\(\s*dt\s*\)\s*\{[\s\S]*ghostAfterimages\.update\s*\(\s*dt\s*\)/.test(runtimeCombatJs), 'updateFx must fade ghost afterimages');
assert(!mainJs.includes('const ghostMat='), 'main.js should not retain inline ghost material factory');
assert(!mainJs.includes('const ghosts=[]'), 'main.js should not retain inline ghost pool state');
assert(!mainJs.includes('ghostTimer'), 'main.js should not retain inline ghost timer');
assert(!mainJs.includes('function spawnGhost'), 'main.js should not retain inline spawnGhost');

console.log('Ghost afterimages check passed.');
