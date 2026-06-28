import fs from 'node:fs';
import path from 'node:path';
import {
  angleDelta,
  easeKeyframe,
  isInSpinSweepArc,
  isInThrustBox,
  lerpNumber,
  sampleTrack,
} from '../prototype/3d/src/combat/hitMath.js';

const repoRoot = process.cwd();
const mainJs = fs.readFileSync(path.join(repoRoot, 'prototype/3d/src/main.js'), 'utf8');
const poseClipJs = fs.readFileSync(path.join(repoRoot, 'prototype/3d/src/player/poseClipController.js'), 'utf8');
const hitResolutionJs = fs.readFileSync(path.join(repoRoot, 'prototype/3d/src/combat/hitResolution.js'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function nearly(actual, expected, message, epsilon = 1e-9) {
  if (Math.abs(actual - expected) > epsilon) {
    throw new Error(`${message}: got ${actual}, expected ${expected}`);
  }
}

nearly(easeKeyframe(0.5), 0.5, 'linear ease should pass through');
nearly(easeKeyframe(0.5, 'in'), 0.25, 'in ease should square progress');
nearly(easeKeyframe(0.5, 'out'), 0.75, 'out ease should decelerate');
nearly(easeKeyframe(0.25, 'inout'), 0.125, 'inout ease should accelerate first half');
nearly(easeKeyframe(0.75, 'inout'), 0.875, 'inout ease should decelerate second half');
nearly(lerpNumber(2, 10, 0.25), 4, 'lerpNumber should interpolate');

{
  const track = [
    { t: 0, x: 2 },
    { t: 1, x: 10, y: 4, e: 'out' },
    { t: 2, x: 20 },
  ];
  assert(sampleTrack(track, -1) === track[0], 'sampleTrack should clamp before first key');
  assert(sampleTrack(track, 3) === track[2], 'sampleTrack should clamp after last key');
  const mid = sampleTrack(track, 0.5);
  nearly(mid.x, 8, 'sampleTrack should apply target-key easing');
  nearly(mid.y, 3, 'sampleTrack should treat missing source value as 0');
  const custom = sampleTrack(track, 0.5, (a, b, t) => a + (b - a) * t + 1);
  nearly(custom.x, 9, 'sampleTrack should honor injected lerp');
}

nearly(angleDelta(0, Math.PI / 2), Math.PI / 2, 'angleDelta should handle simple positive turn');
nearly(angleDelta(Math.PI - 0.1, -Math.PI + 0.1), 0.2, 'angleDelta should wrap across +PI to -PI');
nearly(angleDelta(-Math.PI + 0.1, Math.PI - 0.1), -0.2, 'angleDelta should wrap across -PI to +PI');

{
  const base = { playerX: 0, playerZ: 0, facing: 0, grid: 2 };
  assert(isInThrustBox({ ...base, targetX: 0, targetZ: 3, targetRadius: 0 }), 'target ahead inside thrust length should hit');
  assert(!isInThrustBox({ ...base, targetX: 0, targetZ: 6.1, targetRadius: 0 }), 'target beyond thrust length should miss');
  assert(!isInThrustBox({ ...base, targetX: 0, targetZ: -0.31, targetRadius: 0 }), 'target behind back tolerance should miss');
  assert(isInThrustBox({ ...base, targetX: 1.4, targetZ: 2, targetRadius: 0.5 }), 'target radius should expand thrust width');
  assert(!isInThrustBox({ ...base, targetX: 1.6, targetZ: 2, targetRadius: 0.5 }), 'target outside expanded thrust width should miss');

  const rightFacing = { playerX: 0, playerZ: 0, facing: Math.PI / 2, grid: 2 };
  assert(isInThrustBox({ ...rightFacing, targetX: 3, targetZ: 0, targetRadius: 0 }), 'thrust box should rotate with facing');
}

{
  const base = {
    playerX: 0,
    playerZ: 0,
    playerFacing: 0,
    spin: 0,
    spinTurns: 1,
    spinRadius: 2.8,
    arc: 0.6,
  };
  assert(isInSpinSweepArc({ ...base, targetX: 2, targetZ: 0, targetRadius: 0.2 }), 'target on current sword arc should hit');
  assert(!isInSpinSweepArc({ ...base, targetX: -2, targetZ: 0, targetRadius: 0.2 }), 'target opposite current sword arc should miss');
  assert(!isInSpinSweepArc({ ...base, targetX: 4, targetZ: 0, targetRadius: 0.2 }), 'target outside spin radius should miss');
  assert(isInSpinSweepArc({ ...base, spin: 0.5, targetX: -2, targetZ: 0, targetRadius: 0.2 }), 'spin progress should rotate sweep arc');
  assert(isInSpinSweepArc({ ...base, spin: 0.25, spinTurns: 2, targetX: -2, targetZ: 0, targetRadius: 0.2 }), 'spinTurns should multiply sweep rotation');
}

assert(mainJs.includes('import { angleDelta, isInSpinSweepArc, isInThrustBox, sampleTrack } from "./combat/hitMath.js";'), 'main.js must import hit math helpers');
assert(/createPoseClipController\s*\(\s*\{[\s\S]*sampleTrack[\s\S]*lerp\s*:\s*THREE\.MathUtils\.lerp/.test(mainJs), 'main.js must inject hitMath sampleTrack with Three lerp into pose clips');
assert(poseClipJs.includes('sampleTrack(clip.tracks[jointName], time, lerp)'), 'pose clip controller must use injected hitMath sampleTrack');
assert(/createHitResolution\s*\(\s*\{[\s\S]*isInThrustBox\s*:\s*isInThrustBox[\s\S]*isInSpinSweepArc\s*:\s*isInSpinSweepArc/.test(mainJs), 'main.js must inject hitMath thrust and sweep helpers into hit resolution');
assert(hitResolutionJs.includes('return isInThrustBox({'), 'hit resolution must delegate thrust box math');
assert(hitResolutionJs.includes('if (isInSpinSweepArc({'), 'hit resolution must delegate spin sweep arc math');
assert(!mainJs.includes('function sampleTrack(track,t)'), 'main.js should not retain inline sampleTrack');
assert(!mainJs.includes('function angleDelta(a,b){'), 'main.js should not retain inline angleDelta');

console.log('Hit math check passed.');
