import fs from 'node:fs';
import path from 'node:path';
import { createAttackBursts } from '../prototype/3d/src/combat/attackBursts.js';

const repoRoot = process.cwd();
const mainJs = fs.readFileSync(path.join(repoRoot, 'prototype/3d/src/main.js'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function nearly(actual, expected, message, epsilon = 1e-6) {
  if (Math.abs(actual - expected) > epsilon) {
    throw new Error(`${message}: got ${actual}, expected ${expected}`);
  }
}

class FakeColor {
  constructor(hex) {
    this.hex = hex;
  }

  setHex(hex) {
    this.hex = hex;
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
    this.color = new FakeColor(options.color);
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

  setScalar(value) {
    this.x = value;
    this.y = value;
    this.z = value;
  }
}

class FakeGroup {
  constructor() {
    this.children = [];
    this.position = new FakeTransform();
    this.rotation = new FakeTransform();
  }

  add(child) {
    this.children.push(child);
  }
}

class FakeMesh {
  constructor(geometry, material) {
    this.geometry = geometry;
    this.material = material;
    this.rotation = new FakeTransform();
    this.position = new FakeTransform();
    this.scale = new FakeTransform();
    this.visible = true;
  }
}

const THREE = {
  DoubleSide: 'DoubleSide',
  Group: FakeGroup,
  RingGeometry: FakeGeometry,
  CircleGeometry: FakeGeometry,
  MeshBasicMaterial: FakeMaterial,
  Mesh: FakeMesh,
};

function createFixture({ min = 1.2, max = 3.2 } = {}) {
  const impacts = [];
  const yaw = new FakeGroup();
  const attackBursts = createAttackBursts({
    THREE,
    yaw,
    getHeavyRadiusMin: () => min,
    getHeavyRadiusMax: () => max,
    setImpact: (hitstop, shake) => impacts.push({ hitstop, shake }),
  });
  return { attackBursts, impacts, yaw };
}

{
  const { attackBursts, yaw } = createFixture();
  assert(yaw.children.length === 3, 'constructor should add slash pivot, heavy ring, and heavy fill to yaw');
  assert(yaw.children[0] === attackBursts.slashPivot, 'slash pivot should be the first yaw child');
  assert(yaw.children[1] === attackBursts.heavyRing, 'heavy ring should be parented to yaw');
  assert(yaw.children[2] === attackBursts.heavyFill, 'heavy fill should be parented to yaw');
  assert(attackBursts.slashPivot.children[0] === attackBursts.slashMesh, 'slash mesh should be parented to slash pivot');
  nearly(attackBursts.slashPivot.position.x, 0, 'slash pivot x');
  nearly(attackBursts.slashPivot.position.y, 0.06, 'slash pivot y');
  nearly(attackBursts.slashPivot.position.z, 0, 'slash pivot z');

  assert(JSON.stringify(attackBursts.slashMesh.geometry.args) === JSON.stringify([0.45, 1.2, 28, 1, -Math.PI / 2 - 0.95, 1.9]), 'slash mesh geometry should stay unchanged');
  assert(attackBursts.slashMat.options.color === 0xffe08a, 'slash color should stay unchanged');
  assert(attackBursts.slashMat.options.transparent === true, 'slash material should be transparent');
  assert(attackBursts.slashMat.options.opacity === 0, 'slash material should start transparent');
  assert(attackBursts.slashMat.options.side === THREE.DoubleSide, 'slash material should be double-sided');
  assert(attackBursts.slashMat.options.depthWrite === false, 'slash material should not write depth');
  nearly(attackBursts.slashMesh.rotation.x, -Math.PI / 2, 'slash mesh should lie flat');
  nearly(attackBursts.slashMesh.position.x, 0, 'slash mesh x');
  nearly(attackBursts.slashMesh.position.y, 0, 'slash mesh y');
  nearly(attackBursts.slashMesh.position.z, 0.3, 'slash mesh z');
  assert(attackBursts.slashMesh.visible === false, 'slash mesh should start hidden');

  assert(JSON.stringify(attackBursts.heavyRing.geometry.args) === JSON.stringify([0.86, 1.0, 40]), 'heavy ring geometry should stay unchanged');
  assert(JSON.stringify(attackBursts.heavyFill.geometry.args) === JSON.stringify([1, 40]), 'heavy fill geometry should stay unchanged');
  assert(attackBursts.heavyRingMat.options.color === 0xff7b3a, 'heavy ring color should stay unchanged');
  assert(attackBursts.heavyFillMat.options.color === 0xff7b3a, 'heavy fill color should stay unchanged');
  assert(attackBursts.heavyRingMat.options.transparent === true && attackBursts.heavyFillMat.options.transparent === true, 'heavy materials should be transparent');
  assert(attackBursts.heavyRingMat.options.opacity === 0 && attackBursts.heavyFillMat.options.opacity === 0, 'heavy materials should start transparent');
  assert(attackBursts.heavyRingMat.options.side === THREE.DoubleSide && attackBursts.heavyFillMat.options.side === THREE.DoubleSide, 'heavy materials should be double-sided');
  assert(attackBursts.heavyRingMat.options.depthWrite === false && attackBursts.heavyFillMat.options.depthWrite === false, 'heavy materials should not write depth');
  nearly(attackBursts.heavyRing.rotation.x, -Math.PI / 2, 'heavy ring should lie flat');
  nearly(attackBursts.heavyFill.rotation.x, -Math.PI / 2, 'heavy fill should lie flat');
  nearly(attackBursts.heavyRing.position.y, 0.05, 'heavy ring y');
  nearly(attackBursts.heavyFill.position.y, 0.04, 'heavy fill y');
  assert(attackBursts.heavyRing.visible === false && attackBursts.heavyFill.visible === false, 'heavy burst meshes should start hidden');
}

{
  const { attackBursts, impacts } = createFixture({ min: 1, max: 3 });
  attackBursts.startSlash('light', 0);
  assert(impacts.length === 0, 'startSlash(light) should preserve current dormant no-op behavior');
  assert(attackBursts.heavyFill.visible === false, 'startSlash(light) should not show heavy fill');
  assert(attackBursts.slashMesh.visible === false, 'startSlash(light) should not show slash mesh');

  attackBursts.startSlash('heavy', 0.5);
  const radius = 2;
  const front = 0.7 + radius * 0.55;
  nearly(attackBursts.heavyRing.position.z, front, 'startSlash heavy ring front');
  nearly(attackBursts.heavyFill.position.z, front, 'startSlash heavy fill front');
  nearly(attackBursts.heavyRing.scale.x, radius, 'startSlash heavy ring scale x');
  nearly(attackBursts.heavyRing.scale.y, radius, 'startSlash heavy ring scale y');
  nearly(attackBursts.heavyRing.scale.z, 1, 'startSlash heavy ring scale z');
  nearly(attackBursts.heavyFill.scale.x, radius, 'startSlash heavy fill scale x');
  assert(attackBursts.heavyFill.visible === true, 'startSlash heavy should show fill');
  assert(attackBursts.heavyRing.visible === true, 'startSlash heavy should show ring');
  nearly(attackBursts.heavyFill._t, 0, 'startSlash heavy should reset fill time');
  nearly(attackBursts.heavyFill._dur, 0.22, 'startSlash heavy duration');
  nearly(attackBursts.heavyFillMat.opacity, 0.6, 'startSlash heavy fill opacity');
  assert(attackBursts.heavyRing._burst === true, 'startSlash heavy should mark burst');
  nearly(attackBursts.heavyRing._t, 0, 'startSlash heavy should reset ring time');
  assert(attackBursts.heavyFillMat.color.hex === 0xff7b3a && attackBursts.heavyRingMat.color.hex === 0xff7b3a, 'startSlash heavy should reset orange colors');
  assert(JSON.stringify(impacts[0]) === JSON.stringify({ hitstop: 0.07, shake: 0.22 }), 'startSlash heavy should preserve impact formula');
}

{
  const { attackBursts, impacts } = createFixture();
  attackBursts.burstCircle(1.7);
  const front = 0.7 + 1.7 * 0.55;
  nearly(attackBursts.heavyRing.position.z, front, 'burstCircle ring front');
  nearly(attackBursts.heavyFill.position.z, front, 'burstCircle fill front');
  nearly(attackBursts.heavyRing.scale.x, 1.7, 'burstCircle ring scale');
  assert(attackBursts.heavyFill.visible === true && attackBursts.heavyRing.visible === true, 'burstCircle should show heavy meshes');
  nearly(attackBursts.heavyFill._t, 0, 'burstCircle should reset fill time');
  nearly(attackBursts.heavyFill._dur, 0.22, 'burstCircle duration');
  nearly(attackBursts.heavyFillMat.opacity, 0.6, 'burstCircle fill opacity');
  assert(attackBursts.heavyRing._burst === true, 'burstCircle should mark ring burst');
  assert(attackBursts.heavyRing._t === undefined, 'burstCircle should not initialize heavyRing._t');
  assert(JSON.stringify(impacts[0]) === JSON.stringify({ hitstop: 0.06, shake: 0.22 }), 'burstCircle should preserve impact values');
}

{
  const { attackBursts, impacts } = createFixture();
  attackBursts.doSlash(0.8, -0.9, false);
  assert(attackBursts.slashMesh.visible === true, 'doSlash should show slash mesh');
  nearly(attackBursts.slashMesh._t, 0, 'doSlash should reset slash time');
  nearly(attackBursts.slashMesh._dur, 0.15, 'light doSlash duration');
  nearly(attackBursts.slashMesh.scale.x, 1.4, 'light doSlash scale');
  nearly(attackBursts.slashPivot._from, 0.8, 'doSlash from');
  nearly(attackBursts.slashPivot._to, -0.9, 'doSlash to');
  assert(JSON.stringify(impacts[0]) === JSON.stringify({ hitstop: 0.08, shake: 0.16 }), 'light doSlash should set impact');

  attackBursts.doSlash(-0.3, 0.5, true);
  nearly(attackBursts.slashMesh._dur, 0.18, 'heavy doSlash duration');
  nearly(attackBursts.slashMesh.scale.x, 1.7, 'heavy doSlash scale');
  assert(impacts.length === 1, 'heavy doSlash should not set impact');
}

{
  const { attackBursts } = createFixture();
  attackBursts.doSlash(0.8, -0.9, false);
  attackBursts.update(0.075);
  nearly(attackBursts.slashMat.opacity, 0.85 * 0.5, 'slash opacity should fade by k');
  nearly(attackBursts.slashPivot.rotation.y, -0.05, 'slash pivot should interpolate rotation');
  assert(attackBursts.slashMesh.visible === true, 'slash should remain visible before duration');
  attackBursts.update(0.075);
  assert(attackBursts.slashMesh.visible === false, 'slash should hide at duration');
  nearly(attackBursts.slashMesh.scale.x, 1, 'slash scale should reset at end');

  attackBursts.burstCircle(2.6);
  attackBursts.update(0.11);
  nearly(attackBursts.heavyFillMat.opacity, 0.55 * 0.5, 'heavy fill fade should use old 0.55 baseline');
  nearly(attackBursts.heavyRingMat.opacity, 0.9 * 0.5, 'heavy ring fade should use old 0.9 baseline');
  assert(attackBursts.heavyFill.visible === true && attackBursts.heavyRing.visible === true, 'heavy meshes should remain visible before duration');
  attackBursts.update(0.11);
  assert(attackBursts.heavyFill._dur === 0, 'heavy update should clear duration at end');
  assert(attackBursts.heavyFill.visible === false && attackBursts.heavyRing.visible === false, 'heavy meshes should hide at end');
  assert(attackBursts.heavyRing._burst === false, 'heavy ring burst flag should clear at end');
}

assert(mainJs.includes('import { createAttackBursts } from "./combat/attackBursts.js";'), 'main.js must import attack bursts module');
assert(/\bconst\s+attackBursts\s*=\s*createAttackBursts\s*\(\s*\{\s*THREE\s*,\s*yaw\s*,\s*getHeavyRadiusMin\s*:\s*\(\s*\)\s*=>\s*HEAVY_R_MIN\s*,\s*getHeavyRadiusMax\s*:\s*\(\s*\)\s*=>\s*HEAVY_R_MAX\s*,\s*setImpact\s*:\s*\(\s*nextHitstop\s*,\s*nextShake\s*\)\s*=>\s*\{\s*hitstop\s*=\s*nextHitstop\s*;\s*shake\s*=\s*nextShake\s*;\s*\}\s*\}\s*\)/.test(mainJs), 'main.js must create attackBursts with yaw, heavy radius, and impact dependencies');
assert((mainJs.match(/function\s+startSlash\s*\(/g) || []).length === 1, 'main.js should keep only one startSlash wrapper');
assert(/function\s+startSlash\s*\(\s*type\s*,\s*ratio\s*=\s*0\s*\)\s*\{\s*attackBursts\.startSlash\s*\(\s*type\s*,\s*ratio\s*\)\s*;\s*\}/.test(mainJs), 'startSlash wrapper should delegate to the extracted effective behavior');
assert(/function\s+doSlash\s*\(\s*from\s*,\s*to\s*,\s*heavy\s*\)\s*\{\s*attackBursts\.doSlash\s*\(\s*from\s*,\s*to\s*,\s*heavy\s*\)\s*;\s*\}/.test(mainJs), 'doSlash wrapper should delegate without wiring new gameplay');
assert(/case\s+['"]slashR['"]\s*:\s*hitstop\s*=\s*0\.07\s*;\s*shake\s*=\s*0\.14\s*;\s*SFX\.swing\(\)\s*;\s*break/.test(mainJs), 'slashR should preserve hitstop, shake, and SFX only');
assert(/case\s+['"]slashL['"]\s*:\s*hitstop\s*=\s*0\.07\s*;\s*shake\s*=\s*0\.14\s*;\s*SFX\.swing\(\)\s*;\s*break/.test(mainJs), 'slashL should preserve hitstop, shake, and SFX only');
assert(/case\s+['"]thrust['"]\s*:\s*SFX\.thrust\(\)\s*;\s*doThrust\(\)\s*;\s*break/.test(mainJs), 'thrust should keep SFX then doThrust');
assert(/case\s+['"]spinSlash['"]\s*:\s*hitstop\s*=\s*0\.08\s*;\s*shake\s*=\s*0\.22\s*;\s*break/.test(mainJs), 'spinSlash should preserve hitstop and shake only');
assert(/case\s+['"]heavyCircle['"]\s*:\s*attackBursts\.burstCircle\s*\(\s*1\.7\s*\)\s*;\s*break/.test(mainJs), 'heavyCircle should delegate to attackBursts');
assert(/case\s+['"]heavyCircleBig['"]\s*:\s*attackBursts\.burstCircle\s*\(\s*2\.6\s*\)\s*;\s*break/.test(mainJs), 'heavyCircleBig should delegate to attackBursts');
assert(/function\s+updateFx\s*\(\s*dt\s*\)\s*\{\s*attackBursts\.update\s*\(\s*dt\s*\)\s*;\s*\/\/ 闪避残影淡出\s*ghostAfterimages\.update\s*\(\s*dt\s*\)/.test(mainJs), 'updateFx should update attack bursts before ghost afterimages');
assert(!mainJs.includes('const slashPivot='), 'main.js should not retain inline slash pivot');
assert(!mainJs.includes('const slashMat='), 'main.js should not retain inline slash material');
assert(!mainJs.includes('const slashMesh='), 'main.js should not retain inline slash mesh');
assert(!mainJs.includes('const heavyRingMat='), 'main.js should not retain inline heavy ring material');
assert(!mainJs.includes('const heavyRing='), 'main.js should not retain inline heavy ring mesh');
assert(!mainJs.includes('const heavyFillMat='), 'main.js should not retain inline heavy fill material');
assert(!mainJs.includes('const heavyFill='), 'main.js should not retain inline heavy fill mesh');
assert(!mainJs.includes('function setHeavyCircle'), 'main.js should not retain inline setHeavyCircle');
assert(!mainJs.includes('function burstCircle'), 'main.js should not retain inline burstCircle');

console.log('Attack bursts check passed.');
