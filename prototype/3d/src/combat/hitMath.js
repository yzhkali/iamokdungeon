export function easeKeyframe(k, mode) {
  if (mode === 'out') return 1 - (1 - k) * (1 - k);
  if (mode === 'in') return k * k;
  if (mode === 'inout') return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
  return k;
}

export function lerpNumber(a, b, t) {
  return a + (b - a) * t;
}

export function sampleTrack(track, t, lerp = lerpNumber) {
  if (t <= track[0].t) return track[0];
  if (t >= track[track.length - 1].t) return track[track.length - 1];
  for (let i = 0; i < track.length - 1; i += 1) {
    const a = track[i], b = track[i + 1];
    if (t >= a.t && t <= b.t) {
      let k = (t - a.t) / (b.t - a.t);
      k = easeKeyframe(k, b.e);
      const out = {};
      for (const key of ['x', 'y', 'z', 'v']) {
        if (a[key] !== undefined || b[key] !== undefined) out[key] = lerp(a[key] || 0, b[key] || 0, k);
      }
      return out;
    }
  }
  return track[track.length - 1];
}

export function angleDelta(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function isInThrustBox({ playerX, playerZ, facing, targetX, targetZ, targetRadius = 0, grid = 2 }) {
  const fx = Math.sin(facing), fz = Math.cos(facing);
  const px = -fz, pz = fx;
  const dx = targetX - playerX, dz = targetZ - playerZ;
  const along = dx * fx + dz * fz;
  const side = Math.abs(dx * px + dz * pz);
  return along > -0.3 && along < grid * 3 && side < grid * 0.5 + targetRadius;
}

export function isInSpinSweepArc({
  playerX,
  playerZ,
  playerFacing,
  spin,
  spinTurns = 1,
  targetX,
  targetZ,
  targetRadius,
  spinRadius = 2.8,
  arc = 0.6
}) {
  const dx = targetX - playerX, dz = targetZ - playerZ;
  const dist = Math.hypot(dx, dz);
  if (dist > spinRadius + targetRadius) return false;
  const swordAng = playerFacing + Math.PI / 2 - spin * Math.PI * 2 * spinTurns;
  const ang = Math.atan2(dx, dz);
  const diff = ((ang - swordAng) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
  return Math.abs(diff) < arc;
}
