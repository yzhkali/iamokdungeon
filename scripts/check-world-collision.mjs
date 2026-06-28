import fs from 'node:fs';
import path from 'node:path';
import { createWorldCollision } from '../prototype/3d/src/world/collision.js';

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

function makeCollision(height = () => 2) {
  return createWorldCollision({ terrainHeightAt: height });
}

assert(typeof createWorldCollision === 'function', 'collision.js must export createWorldCollision');

{
  const collision = makeCollision();
  collision.addCollider(10, -4, 6, 8);
  assert(collision.colliders.length === 1, 'addCollider should mutate the live colliders array');
  assert(JSON.stringify(collision.colliders[0]) === JSON.stringify({
    minx: 7,
    maxx: 13,
    minz: -8,
    maxz: 0,
    bottom: 0,
    top: 3.2,
  }), 'addCollider should preserve AABB and default height fields');
  collision.addCollider(0, 0, 2, 4, -1, 7);
  assert(JSON.stringify(collision.colliders[1]) === JSON.stringify({
    minx: -1,
    maxx: 1,
    minz: -2,
    maxz: 2,
    bottom: -1,
    top: 7,
  }), 'addCollider should preserve explicit bottom/top fields');
}

{
  const terrainCalls = [];
  const collision = makeCollision((x, z) => {
    terrainCalls.push([x, z]);
    return 2;
  });
  collision.addTerrainArea(0, 0, 4, 4, 5);
  collision.addTerrainArea(0, 0, 2, 2, 7);
  assert(collision.terrainAreas === collision.terrainAreas, 'terrainAreas should be a stable live array');
  assert(collision.terrainAreas.length === 2, 'addTerrainArea should mutate terrainAreas');
  assert(JSON.stringify(collision.terrainAreas[0]) === JSON.stringify({
    minx: -2,
    maxx: 2,
    minz: -2,
    maxz: 2,
    top: 5,
  }), 'addTerrainArea should store the same AABB shape as old inline pushes');
  nearly(collision.terrainYAt(0, 0), 7, 'terrainYAt should use max terrain area top over terrain height');
  nearly(collision.terrainYAt(10, 10), 2, 'terrainYAt should fall back to terrainHeightAt outside areas');
  assert(JSON.stringify(terrainCalls.at(-1)) === JSON.stringify([10, 10]), 'terrainYAt should call injected terrainHeightAt');
}

{
  const collision = makeCollision(() => 2);
  collision.addTerrainArea(0, 0, 4, 4, 9);
  nearly(collision.groundHeightAt(0, 0), 2, 'groundHeightAt should not read terrainAreas');
  collision.addPlatform(0, 0, 4, 4, 5);
  collision.addPlatform(0, 0, 2, 2, 7);
  nearly(collision.groundHeightAt(0, 0), 7, 'groundHeightAt should use max platform top over terrain height');
  nearly(collision.groundHeightAt(10, 10), 2, 'groundHeightAt should fall back to terrainHeightAt outside platforms');
  collision.addPlatformBounds(20, 22, -3, -1, 6);
  nearly(collision.groundHeightAt(21, -2), 6, 'addPlatformBounds should register exact custom platform bounds');
  assert(JSON.stringify(collision.platforms.at(-1)) === JSON.stringify({
    minx: 20,
    maxx: 22,
    minz: -3,
    maxz: -1,
    top: 6,
  }), 'addPlatformBounds should preserve custom platform AABB');
}

{
  const collision = makeCollision();
  collision.addCollider(0, 0, 2, 2);
  const player = { x: 1.4, z: 0, y: 0 };
  collision.resolveCollision(player, 0.55);
  nearly(player.x, 1.55, 'resolveCollision should push along normal to player radius');
  nearly(player.z, 0, 'normal push should preserve z in this case');
}

{
  const collision = makeCollision();
  collision.addCollider(0, 0, 2, 2);
  const player = { x: 0, z: 0, y: 0 };
  collision.resolveCollision(player, 0.55);
  nearly(player.x, -1.55, 'zero-distance collision should use left tie-break first');
  nearly(player.z, 0, 'zero-distance left tie-break should preserve z');
}

{
  const collision = makeCollision();
  collision.addCollider(0, 0, 2, 2);
  const player = { x: 0.95, z: 0, y: 0 };
  collision.resolveCollision(player, 0.55);
  nearly(player.x, 1.55, 'zero-distance collision should push right when right edge is nearest');
}

{
  const collision = makeCollision();
  collision.addCollider(0, 0, 2, 2);
  collision.addPlatform(0, 0, 2, 2, 1);
  const standingPlayer = { x: 0, z: 0, y: 0.95 };
  collision.resolveCollision(standingPlayer, 0.55);
  nearly(standingPlayer.x, 0, 'platform-matched collider should be skipped at platform top tolerance');
  nearly(standingPlayer.z, 0, 'platform skip should preserve z');
  const lowPlayer = { x: 0, z: 0, y: 0.94 };
  collision.resolveCollision(lowPlayer, 0.55);
  nearly(lowPlayer.x, -1.55, 'platform collider should still push below top tolerance');
}

{
  const collision = makeCollision();
  collision.addCollider(0, 0, 2, 2, 100, 200);
  const player = { x: 0, z: 0, y: -999 };
  collision.resolveCollision(player, 0.55);
  nearly(player.x, -1.55, 'resolveCollision should preserve old behavior and ignore collider bottom/top vertically');
}

assert(mainJs.includes('import { createWorldCollision } from "./world/collision.js";'), 'main.js must import createWorldCollision');
assert(/createWorldCollision\s*\(\s*\{\s*terrainHeightAt\s*:\s*terrainH\s*\}\s*\)/.test(mainJs), 'main.js must create collision module with terrainH injection');
assert(/const\s+\{[\s\S]*colliders[\s\S]*platforms[\s\S]*terrainAreas[\s\S]*addCollider[\s\S]*addTerrainArea[\s\S]*addPlatform[\s\S]*addPlatformBounds[\s\S]*terrainYAt[\s\S]*groundHeightAt[\s\S]*resolveCollision[\s\S]*\}\s*=\s*createWorldCollision/.test(mainJs), 'main.js should destructure the collision surface');
assert(/addTerrainArea\s*\(\s*x\s*,\s*z\s*,\s*w\s*,\s*d\s*,\s*top\s*\)\s*;\s*if\s*\(\s*top\s*>\s*0\.03\s*\)\s*addPlatform\s*\(\s*x\s*,\s*z\s*,\s*w\s*,\s*d\s*,\s*top\s*\)/.test(mainJs), 'addGroundPatch should preserve terrain/platform registration and threshold');
assert(/addPlatform\s*\(\s*x\s*,\s*z\s*,\s*w\s*,\s*d\s*,\s*top\s*\)/.test(mainJs), 'addStep should register platforms through collision module');
assert(/addPlatformBounds\s*\(\s*x-w\/2\+wallT\s*,\s*x\+w\/2-wallT\s*,\s*z-d\/2\+wallT\s*,\s*z\+d\/2-wallT\s*,\s*floorTop\s*\)/.test(mainJs), 'player home should preserve exact indoor platform bounds');
assert(/makeTrainingDummy\s*\(\s*\{\s*THREE\s*,\s*scene\s*,\s*registerMapFeature\s*,\s*addCollider\s*,\s*terrainYAt\s*,\s*dummies\s*\}/.test(mainJs), 'training dummy should keep using shared addCollider and terrainYAt');
assert(mainJs.includes('resolveCollision(P, PLAYER_R);'), 'main.js should call resolveCollision after boundary clamp with player and radius');

assert(!mainJs.includes('const colliders=[]'), 'main.js should not retain inline colliders array');
assert(!mainJs.includes('const platforms=[]'), 'main.js should not retain inline platforms array');
assert(!mainJs.includes('const terrainAreas=[]'), 'main.js should not retain inline terrainAreas array');
assert(!mainJs.includes('function addCollider(x,z,w,d,bottom=0,top=3.2)'), 'main.js should not retain inline addCollider');
assert(!mainJs.includes('function terrainYAt(x,z)'), 'main.js should not retain inline terrainYAt');
assert(!mainJs.includes('function groundHeightAt(x,z)'), 'main.js should not retain inline groundHeightAt');
assert(!mainJs.includes('function resolveCollision()'), 'main.js should not retain inline resolveCollision');
assert(!mainJs.includes('terrainAreas.push'), 'main.js should not mutate terrainAreas directly');
assert(!mainJs.includes('platforms.push'), 'main.js should not mutate platforms directly');

console.log('World collision check passed.');
