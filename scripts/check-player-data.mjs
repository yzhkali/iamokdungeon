const { CLIPS } = await import('../prototype/3d/src/player/clips.js');
const { MOVES } = await import('../prototype/3d/src/player/moves.js');

const errors = [];

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

for (const [clipName, clip] of Object.entries(CLIPS)) {
  if (!isFiniteNumber(clip.dur) || clip.dur <= 0) {
    errors.push(`${clipName}.dur must be a positive finite number`);
  }
  if (!clip.tracks || typeof clip.tracks !== 'object') {
    errors.push(`${clipName}.tracks must be an object`);
    continue;
  }
  for (const [trackName, keys] of Object.entries(clip.tracks)) {
    if (!Array.isArray(keys) || keys.length === 0) {
      errors.push(`${clipName}.${trackName} must have keyframes`);
      continue;
    }
    let lastT = -Infinity;
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      if (!isFiniteNumber(key.t)) {
        errors.push(`${clipName}.${trackName}[${i}].t must be finite`);
        continue;
      }
      if (key.t < lastT) {
        errors.push(`${clipName}.${trackName}[${i}].t is not sorted`);
      }
      if (isFiniteNumber(clip.dur) && key.t > clip.dur + 1e-6) {
        errors.push(`${clipName}.${trackName}[${i}].t exceeds clip duration`);
      }
      lastT = key.t;
    }
  }
}

for (const [moveName, move] of Object.entries(MOVES)) {
  if (!move.clip || !CLIPS[move.clip]) {
    errors.push(`${moveName}.clip references missing clip ${move.clip}`);
  }
  for (const key of ['recoverClip', 'plunge', 'landClip']) {
    if (move[key] && !CLIPS[move[key]]) {
      errors.push(`${moveName}.${key} references missing clip ${move[key]}`);
    }
  }
  for (const key of ['onLight', 'onHeavy', 'auto']) {
    if (move[key] && !MOVES[move[key]]) {
      errors.push(`${moveName}.${key} references missing move ${move[key]}`);
    }
  }
  for (const key of ['strike', 'cancel', 'total']) {
    if (!isFiniteNumber(move[key])) {
      errors.push(`${moveName}.${key} must be a finite number`);
    }
  }
  if (isFiniteNumber(move.total) && move.total <= 0) {
    errors.push(`${moveName}.total must be positive`);
  }
}

if (errors.length) {
  throw new Error(`Player data check failed:\n${errors.sort().map(item => `- ${item}`).join('\n')}`);
}

console.log(`Player data check passed (${Object.keys(CLIPS).length} clips, ${Object.keys(MOVES).length} moves).`);
