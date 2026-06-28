export function createCharacterPoseController({
  THREE,
  player,
  moves,
  rig,
  poseClipController,
  gripDefault,
  gripSpear,
  heavyChargeTime,
  getJupiterActive,
  setJupiterActive,
  getJupiterSpin,
  setJupiterSpin,
  getDrillSpin,
  setDrillSpin,
  now = () => performance.now(),
}) {
  const P = player;
  const MOVES = moves;
  const {
    char,
    body,
    chest,
    headGrp,
    RArm,
    LArm,
    RLeg,
    LLeg,
    weaponSocket,
    weapon,
    jupiterBall,
    chargeAura,
    chargeAuraMat,
  } = rig;

  function lerpRot(joint, axis, target, k) {
    joint.rotation[axis] = THREE.MathUtils.lerp(joint.rotation[axis], target, k);
  }

  function poseCharacter(dt) {
    char.position.set(P.x, P.y, P.z);
    poseClipController.resetJoints();
    body.rotation.set(0, 0, 0);
    body.position.set(0, 0, 0);
    poseClipController.resetDrivenState();

    let bob = 0;
    let lean = 0;
    const ph = P.runPhase;

    if (P.moving && !P.clip && P.state !== 'dodge' && !P.jumping) {
      const sw = Math.sin(ph);
      RLeg.root.rotation.x = sw * 0.62;
      LLeg.root.rotation.x = -sw * 0.62;
      RLeg.j2.rotation.x = Math.max(0, sw) * 0.75 + 0.1;
      LLeg.j2.rotation.x = Math.max(0, -sw) * 0.75 + 0.1;
      LArm.root.rotation.x = sw * 0.55;
      RArm.root.rotation.x = -sw * 0.55;
      LArm.j2.rotation.x = -(0.45 + Math.max(0, sw) * 0.4);
      RArm.j2.rotation.x = -(0.45 + Math.max(0, -sw) * 0.4);
      bob = Math.abs(Math.sin(ph)) * 0.10;
      lean = 0.13;
    } else if (!P.clip && P.state === 'idle' && !P.jumping) {
      const br = Math.sin(now() / 600) * 0.04;
      RLeg.j2.rotation.x = 0.06;
      LLeg.j2.rotation.x = 0.06;
      LArm.root.rotation.x = 0.04;
      RArm.root.rotation.x = 0.04;
      LArm.j2.rotation.x = -0.2;
      RArm.j2.rotation.x = -0.2;
      bob = br;
    }

    if (P.jumping) {
      const up = P.vy;
      let rHip;
      let rKnee;
      let lHip;
      let lKnee;
      let armF;
      if (up > 2) {
        rHip = -1.2;
        rKnee = 1.3;
        lHip = 0.55;
        lKnee = 0.25;
        armF = -1.0;
        lean = 0.14;
      } else if (up < -2) {
        rHip = -0.7;
        rKnee = 0.7;
        lHip = 0.35;
        lKnee = 0.5;
        armF = -0.4;
        lean = -0.02;
      } else {
        rHip = -1.0;
        rKnee = 1.1;
        lHip = 0.5;
        lKnee = 0.3;
        armF = -0.8;
        lean = 0.08;
      }
      lerpRot(RLeg.root, 'x', rHip, 0.5);
      lerpRot(RLeg.j2, 'x', rKnee, 0.5);
      lerpRot(LLeg.root, 'x', lHip, 0.5);
      lerpRot(LLeg.j2, 'x', lKnee, 0.5);
      if (!P.clip) {
        lerpRot(LArm.root, 'x', armF, 0.5);
        lerpRot(LArm.j2, 'x', -0.5, 0.5);
        lerpRot(RArm.root, 'x', -armF * 0.7, 0.5);
        lerpRot(RArm.j2, 'x', -0.4, 0.5);
      }
    }

    if (P.charging) {
      const cr = Math.min(1, P.chargeT / heavyChargeTime);
      bob = -0.18 - 0.08 * cr;
      RLeg.j2.rotation.x = 0.5;
      LLeg.j2.rotation.x = 0.5;
      RLeg.root.rotation.x = -0.25;
      LLeg.root.rotation.x = -0.25;
      RArm.root.rotation.x = -1.0;
      RArm.root.rotation.z = 0.35;
      RArm.j2.rotation.x = -1.75;
      LArm.root.rotation.x = -1.4;
      LArm.root.rotation.z = 0.2;
      LArm.j2.rotation.x = -2.35;
      chest.rotation.y = 0.5;
      lean = 0.3;
      if (P.moving) {
        const sw = Math.sin(P.runPhase);
        RLeg.root.rotation.x = -0.25 + sw * 0.3;
        LLeg.root.rotation.x = -0.25 - sw * 0.3;
        bob += Math.abs(Math.sin(P.runPhase)) * 0.05;
      }
      if (P.chargeFull) {
        chargeAura.visible = true;
        chargeAuraMat.opacity = 0.25 + 0.35 * Math.abs(Math.sin(now() / 60));
      } else {
        chargeAura.visible = false;
      }
    } else {
      chargeAura.visible = false;
    }

    if (P.clip) {
      const blend = (P.move && P.blendDur > 0) ? (P.blendT / P.blendDur) : 1;
      poseClipController.applyClip(P.clip, P.clipT, blend);
    }

    let spinning = false;
    if (P.move === 'aSpin') {
      body.rotation.x = P.spin * Math.PI * 2;
      lean = 0;
      spinning = true;
    }
    if (P.move !== 'aJupiter' && getJupiterActive()) {
      setJupiterActive(false);
      jupiterBall.visible = false;
      char.traverse(object => { if (object.isMesh) object.visible = true; });
      body.rotation.x = 0;
    }
    if (P.move === 'aJupiter' && !P._plungeDone) {
      if (!getJupiterActive()) {
        setJupiterActive(true);
        setJupiterSpin(0);
      }
      if (P.moveT >= 0.22) {
        const spin = getJupiterSpin() + dt * 46;
        setJupiterSpin(spin);
        body.rotation.x = spin;
        const center = 1.8;
        char.position.y += center * (1 - Math.cos(spin));
        char.position.x -= center * Math.sin(spin) * Math.sin(P.facing);
        char.position.z -= center * Math.sin(spin) * Math.cos(P.facing);
        lean = 0;
        spinning = true;
      }
    }
    if (P.move === 'aJupiter' && P._plungeDone) {
      body.rotation.x = 0;
    }
    if (P.move === 'aJupiter' && !P._plungeDone && P.moveT >= 0.22) {
      if (!P._jupSword) {
        P._jupSword = true;
        body.attach(weapon);
      }
      weapon.position.set(0, 4.2, 0);
      weapon.rotation.set(0, 0, 0);
    } else if (P._jupSword) {
      P._jupSword = false;
      weaponSocket.attach(weapon);
      weapon.position.set(0, 0, 0);
      weapon.rotation.set(0, 0, 0);
    }
    if (P.move === 'aDrill') {
      const spin = getDrillSpin() + dt * 90;
      setDrillSpin(spin);
      body.rotation.y = spin;
      spinning = true;
    }
    if (P.move === 'gSpin' || P.move === 'gSpinSlide' || P.move === 'gSpinCharged') {
      const turns = MOVES[P.move].spinTurns || 1;
      body.rotation.y = -P.spin * Math.PI * 2 * turns;
      spinning = true;
    }
    if (P.move === 'dKick') {
      const t = P.moveT;
      const yawT = Math.min(1, t / 0.14);
      body.rotation.y = -yawT * (Math.PI / 2);
      let tilt;
      if (t < 0.16) tilt = t / 0.16;
      else if (t < 0.42) tilt = 1;
      else tilt = Math.max(0, 1 - (t - 0.42) / 0.14);
      body.rotation.z = tilt * 1.25;
      RLeg.root.rotation.z = -tilt * 1.25;
      const cz = Math.cos(tilt * 1.25);
      const sz = Math.sin(tilt * 1.25);
      const rootY = -0.3 * sz + 1.5 * cz;
      bob += (1.46 - rootY);
      spinning = true;
    }
    if (P.move === 'dRise' && P._launched && !P._plungeDone) {
      const k = Math.max(0, Math.min(1, (P.moveT - 0.24) / 0.32));
      const coil = -0.7;
      body.rotation.y = -coil - k * (Math.PI * 2 - coil);
      spinning = true;
    }
    if (P.move === 'dRise' && !P._launched) {
      body.rotation.y = 0.7 * Math.min(1, P.moveT / 0.24);
    }

    if (P.state === 'dodge') {
      const k = P.roll;
      const ease = Math.sin(Math.min(1, k) * Math.PI);
      LLeg.root.rotation.x = 0.9 * ease + 0.2;
      LLeg.j2.rotation.x = 0.9 * ease + 0.1;
      RLeg.root.rotation.x = -0.7 * ease;
      RLeg.j2.rotation.x = 0.25 * ease;
      LArm.root.rotation.x = -0.6 * ease;
      LArm.j2.rotation.x = -0.5;
      RArm.root.rotation.x = 0.5 * ease;
      RArm.j2.rotation.x = -0.5;
      lean = 0.35 * ease;
      bob = -0.12 * ease;
      chest.rotation.x = 0.15 * ease;
    }

    const drivenPose = poseClipController.getDrivenState();
    body.position.y += (drivenPose.bodyY !== null) ? drivenPose.bodyY : bob;
    if (!spinning) {
      const targetLean = (drivenPose.bodyLean !== null) ? drivenPose.bodyLean : lean;
      body.rotation.x = THREE.MathUtils.lerp(body.rotation.x, targetLean, 0.5);
    }
    if (drivenPose.bodyYaw !== null) {
      body.rotation.y = THREE.MathUtils.lerp(body.rotation.y, drivenPose.bodyYaw, 0.5);
    }
    if (drivenPose.bodySide !== null) {
      body.rotation.z = THREE.MathUtils.lerp(body.rotation.z, drivenPose.bodySide, 0.5);
    }

    const gm = (drivenPose.gripMode !== null) ? drivenPose.gripMode : 0;
    weaponSocket.rotation.x = gripDefault + (gripSpear - gripDefault) * gm;

    if (!spinning) {
      const followRatio = 0.3;
      headGrp.rotation.y += -chest.rotation.y * (1 - followRatio);
      headGrp.rotation.x += -chest.rotation.x * 0.4;
    }

    if (P.move === 'aDrill') {
      if (!P._drillSword) {
        P._drillSword = true;
        char.attach(weapon);
      }
      P._drillAng = (P._drillAng || 0) + dt * 30;
      weapon.position.set(0.9 * Math.cos(P._drillAng), 0.95, 0.9 * Math.sin(P._drillAng));
      weapon.rotation.set(0, P._drillAng + Math.PI * 0.5, Math.PI * 0.5);
    } else if (P._drillSword) {
      P._drillSword = false;
      P._drillAng = 0;
      weaponSocket.attach(weapon);
      weapon.position.set(0, 0, 0);
      weapon.rotation.set(0, 0, 0);
    }
    weapon.visible = true;
  }

  return { poseCharacter };
}
