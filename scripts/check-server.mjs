import { createStaticServer } from './static-server.mjs';

function listen(server) {
  return new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
}

function close(server) {
  return new Promise(resolve => server.close(resolve));
}

async function expectStatus(origin, path, expected) {
  const response = await fetch(`${origin}${path}`);
  if (response.status !== expected) {
    throw new Error(`${path} returned ${response.status}, expected ${expected}`);
  }
}

const server = createStaticServer({ root: 'prototype/3d' });
await listen(server);
const { port } = server.address();
const origin = `http://127.0.0.1:${port}`;

try {
  await expectStatus(origin, '/index.html', 200);
  await expectStatus(origin, '/src/main.js', 200);
  await expectStatus(origin, '/src/combat/attackBursts.js', 200);
  await expectStatus(origin, '/src/combat/hitMath.js', 200);
  await expectStatus(origin, '/src/combat/spaceSlash.js', 200);
  await expectStatus(origin, '/src/combat/spinRings.js', 200);
  await expectStatus(origin, '/src/combat/stompEffects.js', 200);
  await expectStatus(origin, '/src/combat/swordBeam.js', 200);
  await expectStatus(origin, '/src/combat/swordTrail.js', 200);
  await expectStatus(origin, '/src/combat/targetFeedback.js', 200);
  await expectStatus(origin, '/src/camera.js', 200);
  await expectStatus(origin, '/src/loop.js', 200);
  await expectStatus(origin, '/src/rendering/waterReflection.js', 200);
  await expectStatus(origin, '/src/player/clips.js', 200);
  await expectStatus(origin, '/src/player/ghostAfterimages.js', 200);
  await expectStatus(origin, '/src/player/moves.js', 200);
  await expectStatus(origin, '/src/player/state.js', 200);
  await expectStatus(origin, '/src/ui/input.js', 200);
  await expectStatus(origin, '/src/ui/mapHud.js', 200);
  await expectStatus(origin, '/src/enemies/wolfAi.js', 200);
  await expectStatus(origin, '/maps/map15.json', 200);
  await expectStatus(origin, '/', 200);
  await expectStatus(origin, '/%2e%2e%2fREADMEFIRST.md', 403);
  await expectStatus(origin, '/src/', 403);
  const post = await fetch(`${origin}/index.html`, { method: 'POST' });
  if (post.status !== 405) throw new Error(`POST returned ${post.status}, expected 405`);
  console.log('Static server check passed.');
} finally {
  await close(server);
}
