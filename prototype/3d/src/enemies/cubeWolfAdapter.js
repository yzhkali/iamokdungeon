const STATE_MAP = {
  idle: 'Idle',
  wander: 'Walk',
  run: 'Run',
  pounce: 'Jump_Start',
  bite: 'Headbutt',
  hurt: 'Idle',
  death: 'Death',
  howl: 'Idle',
};

const ONE_SHOT_STATES = new Set(['pounce', 'bite', 'hurt', 'death']);

function makeFallbackBodyMesh() {
  return {
    material: {
      emissive: { setHex: () => {} },
      emissiveIntensity: 0,
    },
  };
}

export function makeCubeWolfObj({ scene }, gltfScene, clips, THREE) {
  const root = gltfScene;
  root.scale.setScalar(1.35);
  root.rotation.y = Math.PI;
  root.position.set(5, 0, -5);
  scene.add(root);
  root.traverse(object => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });

  const mixer = new THREE.AnimationMixer(root);
  const clipMap = {};
  for (const clip of clips) clipMap[clip.name] = clip;

  let currentAction = null;
  let currentState = 'idle';
  function playClip(name, loop = true) {
    const clip = clipMap[name];
    if (!clip) return;
    const nextAction = mixer.clipAction(clip);
    nextAction.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    nextAction.clampWhenFinished = !loop;
    if (currentAction && currentAction !== nextAction) currentAction.fadeOut(0.2);
    nextAction.reset().fadeIn(0.2).play();
    currentAction = nextAction;
  }

  mixer.addEventListener('finished', () => { currentState = 'idle'; });
  playClip('Idle', true);

  let firstMesh = null;
  root.traverse(object => {
    if (!firstMesh && object.isMesh) firstMesh = object;
  });

  return {
    root,
    J: { body: { children: [firstMesh || makeFallbackBodyMesh()] } },
    get state() { return currentState; },
    setState(name) {
      currentState = name;
      const clipName = STATE_MAP[name] || 'Idle';
      const loop = !ONE_SHOT_STATES.has(name);
      playClip(clipName, loop);
    },
    update(dt) { mixer.update(dt); },
  };
}
