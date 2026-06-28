export function createRenderScene({ THREE, canvas, pixelRatio }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(pixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const sceneRT = new THREE.WebGLRenderTarget(1, 1);
  const reflRT = new THREE.WebGLRenderTarget(1, 1);
  const reflCam = new THREE.PerspectiveCamera();
  reflCam.matrixAutoUpdate = false;
  const reflClip = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const reflMatrix = new THREE.Matrix4();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xbbd0df);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
  const cameraRig = {
    yaw: 0,
    pitch: THREE.MathUtils.degToRad(43),
    targetYaw: 0,
    targetPitch: THREE.MathUtils.degToRad(43),
    distance: 43,
    outdoorDistance: 43,
    indoorDistance: 11,
    currentDistance: 43,
    minDistance: 12,
    indoorMinDistance: 2.4,
    maxDistance: 90,
    minPitch: THREE.MathUtils.degToRad(8),
    maxPitch: THREE.MathUtils.degToRad(78),
    indoorMinPitch: THREE.MathUtils.degToRad(16),
    indoorMaxPitch: THREE.MathUtils.degToRad(48),
    yawSpeed: 1.55,
    pitchSpeed: 1.05,
    stickX: 0,
    stickY: 0,
  };

  scene.add(new THREE.HemisphereLight(0xb9c6d6, 0x4a3f36, 0.75));
  const sun = new THREE.DirectionalLight(0xfff2d8, 1.15);
  sun.position.set(12, 26, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 140;
  const shadowCameraSize = 60;
  sun.shadow.camera.left = -shadowCameraSize;
  sun.shadow.camera.right = shadowCameraSize;
  sun.shadow.camera.top = shadowCameraSize;
  sun.shadow.camera.bottom = -shadowCameraSize;
  sun.shadow.bias = -0.0005;
  scene.add(sun);

  return {
    renderer,
    sceneRT,
    reflRT,
    reflCam,
    reflClip,
    reflMatrix,
    scene,
    camera,
    cameraRig,
    sun,
  };
}
