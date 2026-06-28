export function createPlayerRig({ THREE }) {
  const SKIN = 0xf0c39a;
  const HAIR = 0x2b2018;
  const GLASS = 0x222222;
  const SHIRT = 0x3f6fb0;
  const TANK = 0xeaeaea;
  const SHORTS = 0xf2f2f2;
  const LIMB = 0xe2b48c;
  const FLIP = 0x3a4a6b;

  function material(color, roughness = 0.7) {
    return new THREE.MeshStandardMaterial({ color, roughness });
  }

  function box(width, height, depth, color) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      material(color)
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  const char = new THREE.Group();
  const yaw = new THREE.Group();
  char.add(yaw);
  const body = new THREE.Group();
  yaw.add(body);

  const THIGH = 0.78;
  const SHIN = 0.72;
  const UPARM = 0.6;
  const FOREARM = 0.56;
  const ARM_W = 0.26;
  const LEG_W = 0.3;
  const CHEST_H = 1.0;
  const HIP_Y = THIGH + SHIN;
  const SHO_LOCAL = CHEST_H - 0.05;
  const SHO_X = 0.725;
  const TOTAL_H = HIP_Y + CHEST_H + 0.8;

  const pelvis = box(1.0, 0.42, 0.66, SHORTS);
  pelvis.position.y = HIP_Y;
  body.add(pelvis);

  const chest = new THREE.Group();
  chest.position.y = HIP_Y;
  body.add(chest);
  const torso = box(1.15, CHEST_H, 0.7, SHIRT);
  torso.position.y = CHEST_H / 2;
  chest.add(torso);
  const tank = box(0.6, CHEST_H * 0.92, 0.56, TANK);
  tank.position.set(0, CHEST_H / 2, 0.09);
  chest.add(tank);

  const headGrp = new THREE.Group();
  headGrp.position.y = CHEST_H + 0.05;
  chest.add(headGrp);
  const head = box(0.78, 0.72, 0.7, SKIN);
  head.position.y = 0.36;
  headGrp.add(head);
  const hairTop = box(0.86, 0.32, 0.78, HAIR);
  hairTop.position.y = 0.66;
  headGrp.add(hairTop);
  const hairBack = box(0.86, 0.46, 0.42, HAIR);
  hairBack.position.set(0, 0.44, -0.22);
  headGrp.add(hairBack);

  function ring(x) {
    const mesh = new THREE.Mesh(
      new THREE.TorusGeometry(0.14, 0.038, 8, 18),
      material(GLASS, 0.4)
    );
    mesh.position.set(x, 0.37, 0.36);
    headGrp.add(mesh);
  }
  ring(-0.18);
  ring(0.18);
  const bridge = box(0.13, 0.035, 0.05, GLASS);
  bridge.position.set(0, 0.37, 0.38);
  headGrp.add(bridge);

  function jointedLimb(parent, upperLen, lowerLen, width, x, y, upperColor, lowerColor, withFoot) {
    const root = new THREE.Group();
    root.position.set(x, y, 0);
    parent.add(root);
    const upper = box(width, upperLen, width, upperColor);
    upper.position.y = -upperLen / 2;
    root.add(upper);
    const j2 = new THREE.Group();
    j2.position.y = -upperLen;
    root.add(j2);
    const lowerShrink = withFoot ? 0.14 : 0;
    const lowerVisibleLen = lowerLen - lowerShrink;
    const lower = box(width * 0.9, lowerVisibleLen, width * 0.9, lowerColor);
    lower.position.y = -lowerShrink / 2 - lowerVisibleLen / 2;
    j2.add(lower);
    let foot = null;
    if (withFoot) {
      foot = box(width + 0.14, 0.12, width + 0.34, FLIP);
      foot.position.set(0, -lowerLen + 0.1, 0.12);
      j2.add(foot);
    }
    return { root, j2, upper, lower, foot };
  }

  const armScreenL = jointedLimb(chest, UPARM, FOREARM, ARM_W, -SHO_X, SHO_LOCAL, SHIRT, LIMB, false);
  const armScreenR = jointedLimb(chest, UPARM, FOREARM, ARM_W, SHO_X, SHO_LOCAL, SHIRT, LIMB, false);
  const legScreenL = jointedLimb(body, THIGH, SHIN, LEG_W, -0.3, HIP_Y, LIMB, LIMB, true);
  const legScreenR = jointedLimb(body, THIGH, SHIN, LEG_W, 0.3, HIP_Y, LIMB, LIMB, true);

  const RArm = armScreenL;
  const LArm = armScreenR;
  const RLeg = legScreenL;
  const LLeg = legScreenR;

  function addHand(parent, y) {
    const hand = box(ARM_W + 0.06, 0.2, ARM_W + 0.1, SKIN);
    hand.position.set(0, y, 0.02);
    parent.add(hand);
    return hand;
  }
  addHand(LArm.j2, -FOREARM);

  const rWrist = new THREE.Group();
  rWrist.position.set(0, -FOREARM, 0);
  RArm.j2.add(rWrist);
  const rHand = box(ARM_W + 0.06, 0.2, ARM_W + 0.1, SKIN);
  rHand.position.set(0, 0, 0.02);
  rWrist.add(rHand);

  const weaponSocket = new THREE.Group();
  weaponSocket.position.set(0, 0, 0.06);
  const gripDefault = Math.PI * 0.5 - 0.35;
  const gripSpear = Math.PI;
  weaponSocket.rotation.x = gripDefault;
  rWrist.add(weaponSocket);

  function makeStick() {
    const group = new THREE.Group();
    const grip = box(0.11, 0.32, 0.11, 0x4a3526);
    grip.position.y = 0.02;
    group.add(grip);
    const guard = box(0.2, 0.06, 0.2, 0x6b5640);
    guard.position.y = 0.2;
    group.add(guard);
    const shaft = box(0.1, 0.92, 0.1, 0x9a6a3b);
    shaft.position.y = 0.68;
    group.add(shaft);
    return group;
  }

  function makeSword() {
    const group = new THREE.Group();
    const grip = box(0.1, 0.34, 0.1, 0x3a2a1c);
    grip.position.y = 0.02;
    group.add(grip);
    const guard = box(0.42, 0.08, 0.14, 0x8a7340);
    guard.position.y = 0.2;
    group.add(guard);
    const blade = box(0.12, 1.5, 0.05, 0xcdd6e0);
    blade.position.y = 0.98;
    group.add(blade);
    const tip = box(0.12, 0.16, 0.05, 0xe6edf5);
    tip.position.y = 1.78;
    group.add(tip);
    const tipRef = new THREE.Object3D();
    tipRef.position.set(0, 1.86, 0);
    group.add(tipRef);
    group.userData.tipRef = tipRef;
    group.userData.bladeLen = 1.86;
    return group;
  }

  const weapon = makeSword();
  weaponSocket.add(weapon);
  const weaponTip = weapon.userData.tipRef;

  const jupiterBall = new THREE.Group();
  jupiterBall.visible = false;
  const jOrb1 = new THREE.Group();
  jupiterBall.add(jOrb1);
  const jSwd1 = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 2.1, 0.07),
    new THREE.MeshStandardMaterial({
      color: 0xeaeaea,
      roughness: 0.1,
      emissive: 0x8888aa,
      emissiveIntensity: 1.2,
    })
  );
  jOrb1.add(jSwd1);
  const jOrb2 = new THREE.Group();
  jupiterBall.add(jOrb2);
  const jSwd2 = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 2.1, 0.07),
    new THREE.MeshStandardMaterial({
      color: 0x3f6fb0,
      roughness: 0.1,
      emissive: 0x2244aa,
      emissiveIntensity: 1.2,
    })
  );
  jOrb2.add(jSwd2);

  const chargeAuraMat = new THREE.MeshBasicMaterial({
    color: 0xffe85a,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const chargeAura = new THREE.Mesh(
    new THREE.SphereGeometry(1.3, 16, 12),
    chargeAuraMat
  );
  chargeAura.position.y = 1.6;
  chargeAura.visible = false;
  body.add(chargeAura);

  return {
    char,
    yaw,
    body,
    chest,
    headGrp,
    RArm,
    LArm,
    RLeg,
    LLeg,
    rWrist,
    weaponSocket,
    weapon,
    weaponTip,
    jupiterBall,
    chargeAura,
    chargeAuraMat,
    gripDefault,
    gripSpear,
    dimensions: {
      THIGH,
      SHIN,
      UPARM,
      FOREARM,
      ARM_W,
      LEG_W,
      CHEST_H,
      HIP_Y,
      SHO_LOCAL,
      SHO_X,
      TOTAL_H,
    },
    makeStick,
    makeSword,
  };
}
