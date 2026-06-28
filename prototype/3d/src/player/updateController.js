import { angleDelta } from "../combat/hitMath.js";

export function createPlayerUpdater({
  player: P,
  runtimeState,
  getMapHud,
  clearGameplayInputState,
  updateFx,
  poseCharacter,
  autoPad,
  pollInput,
  Actions,
  mouse,
  toCameraRelativeMove,
  swordTrail,
  spaceSlash,
  sfx: SFX,
  startDodgeCombo,
  startMove,
  playClip,
  groundHeightAt,
  jumpVelocity: JUMP_V,
  gravity: GRAVITY,
  moves: MOVES,
  poseClipController,
  clips: CLIPS,
  fireFx,
  hitResolution,
  jupiterBall,
  char,
  body,
  weaponSocket,
  weapon,
  moveSpeed: MOVE_SPEED,
  heavyChargeMinSpeed: HEAVY_CHARGE_MINSPD,
  heavyChargeTime: HEAVY_CHARGE_TIME,
  heavyChargeHold: HEAVY_CHARGE_HOLD,
  dodgeDuration: DODGE_DUR,
  dodgeSpeed: DODGE_SPEED,
  dodgeIframe: DODGE_IFRAME,
  dodgeCost: DODGE_COST,
  staminaRegen: STAM_REGEN,
  turnLerp: TURN_LERP,
  roomSize: ROOM,
  playerRadius: PLAYER_R,
  resolveCollision,
  yaw,
  ghostAfterimages,
  swordBeam,
  spinRings,
  stompEffects,
}) {
  function update(dt) {
    if (getMapHud().isWorldMapOpen()) { updateFx(dt); poseCharacter(dt); return; }
    if (P.dead) { clearGameplayInputState(); updateFx(dt); poseCharacter(dt); return; }
    autoPad(); pollInput();
    if (runtimeState.hitstop > 0) { runtimeState.hitstop -= dt; updateFx(dt); return; }
    if (P.iframe > 0) P.iframe -= dt;
    const rawX = Actions.moveX, rawZ = Actions.moveZ, inLen = Math.hypot(rawX, rawZ);
    const camMove = toCameraRelativeMove(rawX, rawZ);
    const inX = camMove.x, inZ = camMove.z;

    if (Actions.dodge && P.state !== "dodge" && P.stamina >= DODGE_COST) {
      let dx = inX, dz = inZ; if (inLen < 0.01) { dx = Math.sin(P.facing); dz = Math.cos(P.facing); }
      const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      if (P.move && swordTrail.mesh.visible && swordTrail.isActive()) { spaceSlash.markReady(); }
      P.state = "dodge"; P.dodgeT = DODGE_DUR; P.dodgeDir.set(dx, 0, dz); P.roll = 0;
      SFX.dodge();
      P.iframe = DODGE_IFRAME; P.stamina -= DODGE_COST; P.facing = Math.atan2(dx, dz);
      P.charging = false; P.chargeHold = 0; P.chargeFull = false; P.chargeFullT = 0; P.chargeLock = true; P.clip = null; P.move = null;
      P.airDodge = P.jumping || P.y > 0.01;
      P.dodgeBuffer = null;
    }

    if (P.state === "dodge") {
      if (Actions.attack || mouse.left) P.dodgeBuffer = "light";
      if (Actions.heavyHeld || Actions.heavyReleased) P.dodgeBuffer = "heavy";
    }
    if (P.dodgeGrace > 0) {
      P.dodgeGrace -= dt;
      if (!P.move && P.state === "idle") {
        if (Actions.attack) { P.dodgeGrace = 0; startDodgeCombo("light"); }
        else if (Actions.heavyHeld || Actions.heavyReleased) { P.dodgeGrace = 0; startDodgeCombo("heavy"); }
      }
    }

    const gH = groundHeightAt(P.x, P.z);
    const onGround = !P.jumping && P.y <= gH + 0.05;
    if (P._drillBounce > 0 && onGround && !P.jumping && !P.move) { P.vy = P._drillBounce; P.jumping = true; P._drillBounce = 0; P._drillBounced = true; }
    if (P._drillBounced && onGround && !P.jumping && !P.move) { P._drillBounced = false; startMove("aJupiterLand"); }
    if (P.state !== "dodge" && P.state !== "taunt") {
      if (!P.move) {
        if (Actions.attack && !P.charging) {
          startMove(onGround ? "gL1" : "aL1");
        } else if (onGround) {
          if (Actions.heavyHeld && !P.charging && !P.chargeLock) {
            P.charging = true; P.chargeT = 0; P.chargeFull = false; P.chargeFullT = 0;
          }
          if (Actions.heavyReleased && P.charging) {
            const full = P.chargeFull;
            P.charging = false; P.chargeT = 0; P.chargeFull = false;
            startMove(full ? "gSpinCharged" : "gSpin");
          }
        } else if (!onGround && Actions.heavyReleased && !P.chargeLock) {
          startMove("aStomp"); P.chargeLock = true;
        }
      } else {
        if (Actions.attack) P.nextBuffer = "light";
        if (Actions.heavyReleased) {
          if (P._ignoreHeavyRelease) { P._ignoreHeavyRelease = false; }
          else P.nextBuffer = "heavy";
        }
      }
    }
    if (!Actions.heavyHeld) P.chargeLock = false;

    if (P.charging) {
      if (Actions.heavyHeld) {
        P.chargeT = Math.min(HEAVY_CHARGE_TIME, P.chargeT + dt);
        if (P.chargeT >= HEAVY_CHARGE_TIME) {
          P.chargeFull = true; P.chargeFullT += dt;
          if (P.chargeFullT >= HEAVY_CHARGE_HOLD) { P.charging = false; P.chargeFull = false; P.chargeLock = true; }
        }
      }
    }

    if (Actions.taunt && P.state === "idle" && !P.charging && !P.move) { P.state = "taunt"; playClip("pushGlasses"); }

    if (Actions.jump && !P.jumping && P.state !== "dodge" && !P.move && onGround) { P.jumping = true; P.vy = JUMP_V; }
    if (P.jumping || P.y > gH + 0.25) {
      P.jumping = true;
      P.y += P.vy * dt; P.vy -= GRAVITY * dt;
      const land = groundHeightAt(P.x, P.z);
      if (P.vy <= 0 && P.y <= land) { P.y = land; P.jumping = false; P.vy = 0; }
    } else {
      P.y = gH;
    }

    if (P.move) {
      const mv = MOVES[P.move];
      P.moveT += dt;
      if (P.blendT < P.blendDur) P.blendT += dt;
      if (P.move === "dRise" && !P._launched && P.moveT >= 0.24) { P._launched = true; P.jumping = true; P.vy = JUMP_V; }
      if (P.moveT < mv.strike) P.phase = "startup";
      else if (P.moveT < mv.cancel) P.phase = "active";
      else P.phase = "hold";

      if (mv.useRecoverClip && mv.recoverClip && P.phase === "hold" && P.clip !== mv.recoverClip) {
        poseClipController.capturePoseSnapshot(); P.blendT = 0; P.blendDur = 0.12;
        P.clip = mv.recoverClip; P.clipT = 0; P.clipDur = CLIPS[mv.recoverClip].dur;
      }
      if (P.clip === mv.recoverClip) P.clipT += dt;

      if (mv.trail && !P._trailStarted && P.moveT >= mv.strike - 0.10) { P._trailStarted = true; swordTrail.startTrail(mv.trailSegs || (mv.spinY ? 26 : 4)); }
      if (!P.struck && P.moveT >= mv.strike) {
        P.struck = true; if (mv.fx) fireFx(mv.fx);
        if (mv.thrustHit) hitResolution.tryThrustHit();
        else if (mv.ringHit && !mv.spinY) hitResolution.tryRingHit();
        else if (!mv.ringHit && !mv.spinY && !mv.landHit && !mv.plunge) hitResolution.tryHitObjects(mv.hitR || 0);
      }
      if (mv.spinY && P.spin > 0 && P.spin < 1) {
        const turns = mv.spinTurns || 1;
        const curRot = Math.floor(P.spin * turns);
        if (P._lastSpinRot === undefined || curRot !== P._lastSpinRot) { P._spinHit && P._spinHit.clear(); P._lastSpinRot = curRot; }
        hitResolution.trySweepHit();
      }
      if (P.move === "aJupiter" && P.struck && !P._plungeDone) {
        const curRev = Math.floor(runtimeState.jupiterSpin / (Math.PI * 2));
        if (P._jupRev !== curRev) { P._jupRev = curRev; if (curRev > 0) hitResolution.tryJupiterHit(); }
      }
      if (mv.thrustHit && P.struck && P.moveT < mv.cancel) { hitResolution.tryThrustHit(); }
      const trailStop = mv.spinY ? mv.total : mv.cancel;
      if (mv.trail && swordTrail.isActive() && P.moveT >= trailStop) { swordTrail.stopTrail(); }

      if (mv.plunge && onGround && P.moveT > 0.05 && !P._plungeDone) {
        P._plungeDone = true;
        if (runtimeState.jupiterActive) { runtimeState.jupiterActive = false; jupiterBall.visible = false; char.traverse(o => { if (o.isMesh) o.visible = true; }); body.rotation.x = 0; }
        if (P._jupSword) { P._jupSword = false; weaponSocket.attach(weapon); weapon.position.set(0, 0, 0); weapon.rotation.set(0, 0, 0); }
        P.chargeLock = true;
        if (runtimeState.jupiterActive) { runtimeState.jupiterActive = false; jupiterBall.visible = false; }
        if (mv.landFx) fireFx(mv.landFx);
        if (mv.landHit) hitResolution.tryHitObjects(mv.hitR || 0);
        P.clip = mv.plunge; P.clipDur = CLIPS[mv.plunge].dur; P.clipT = 0;
        P.moveT = mv.total; P._customRecover = CLIPS[mv.plunge].dur;
      }
      if (mv.landClip && !mv.plunge && onGround && P._launched && !P._plungeDone && P.moveT > 0.30) {
        P._plungeDone = true;
        poseClipController.capturePoseSnapshot(); P.blendT = 0; P.blendDur = 0.10;
        P.clip = mv.landClip; P.clipDur = CLIPS[mv.landClip].dur; P.clipT = 0;
        P.moveT = mv.total; P._customRecover = CLIPS[mv.landClip].dur;
      }

      if (mv.comboAt !== undefined && P.moveT >= mv.comboAt && !P._plungeDone) {
        let nxt = null;
        if (P.nextBuffer === "light" && mv.onLight) nxt = mv.onLight;
        else if (P.nextBuffer === "heavy" && mv.onHeavy) nxt = mv.onHeavy;
        if (nxt) { startMove(nxt); }
      }

      const endT = mv.total + (P._customRecover || 0);
      if (P.move && P.moveT >= endT && !(mv.plunge && !onGround && !P._plungeDone)) {
        let nxt = null;
        if (mv.auto) nxt = mv.auto;
        else if (P.nextBuffer === "light" && mv.onLight) nxt = mv.onLight;
        else if (P.nextBuffer === "heavy" && mv.onHeavy) nxt = mv.onHeavy;
        if (nxt) { startMove(nxt); }
        else {
          P._customRecover = null; P._plungeDone = false; if (runtimeState.jupiterActive) { runtimeState.jupiterActive = false; jupiterBall.visible = false; char.traverse(o => { if (o.isMesh) o.visible = true; }); }
          P.move = null; P.spin = 0; P.state = "idle"; P.clip = null;
        }
      }
    }

    if (P.clip && !P.move) { P.clipT += dt; if (P.clipT >= P.clipDur) { P.clip = null; if (P.state === "taunt") P.state = "idle"; } }
    else if (P.clip && P.move) { P.clipT += dt; }

    let vX = 0, vZ = 0; P.moving = false;
    if (P.state === "dodge") {
      vX = P.dodgeDir.x * DODGE_SPEED; vZ = P.dodgeDir.z * DODGE_SPEED;
      P.dodgeT -= dt; P.roll = Math.min(1, (DODGE_DUR - P.dodgeT) / DODGE_DUR);
      ghostAfterimages.tickDodge(dt);
      if (P.dodgeT <= 0) {
        P.state = "idle"; P.roll = 0;
        if (P.dodgeBuffer) { startDodgeCombo(P.dodgeBuffer); P.dodgeBuffer = null; }
        else P.dodgeGrace = 0.32;
      }
    } else if (P.move) {
      const mv = MOVES[P.move];
      if (mv.chargedMove && P.spin > 0 && P.spin < 1) {
        const sp = MOVE_SPEED * HEAVY_CHARGE_MINSPD;
        vX += inX * sp; vZ += inZ * sp;
        if (inLen > 0.01) { P.moving = true; }
      }
      if (P.lunge && P.moveT < mv.cancel) {
        const k = P.lunge * Math.max(0, 1 - Math.abs(P.moveT - mv.strike) / 0.18);
        vX = Math.sin(P.facing) * k; vZ = Math.cos(P.facing) * k;
      }
      if (mv.chargeSlide && P.move === "dRise" && !P._launched) {
        const k = mv.chargeSlide * Math.max(0, 1 - P.moveT / 0.24);
        vX += Math.sin(P.facing) * k; vZ += Math.cos(P.facing) * k;
      }
      if (mv.slide) {
        if (!P.struck) { /* startup stage does not slide */ }
        else {
          if (P._slideV === undefined || P._slideStarted !== P.move) { P._slideV = mv.slide; P._slideStarted = P.move; }
          vX += Math.sin(P.facing) * P._slideV; vZ += Math.cos(P.facing) * P._slideV;
          P._slideV *= Math.pow(0.02, dt);
        }
      }
      if (mv.plunge && !onGround) {
        if (P._stompHang > 0) { P._stompHang -= dt; P.vy = 0; }
        else if (mv.hangT && P.moveT < mv.hangT) { P.vy *= 0.4; }
        else P.vy = -(mv.diveV || 18);
      } else if (mv.air && !mv.plunge && !mv.spin && !mv.noHang && !onGround) { P.vy *= 0.5; }
      if (P.move === "dRise" && P._launched && P.moveT >= 0.54 && P.moveT <= 0.80) { P.vy *= 0.30; }
      if (mv.spin) { P.spin = Math.min(1, P.spin + dt / mv.total); if (!onGround) P.vy = Math.max(P.vy, -2); }
      if (mv.spinY) {
        const s0 = mv.spinStart || 0, s1 = mv.spinEnd || mv.total;
        if (P.moveT >= s0 && P.moveT <= s1) { P.spin = Math.min(1, (P.moveT - s0) / (s1 - s0)); }
        else if (P.moveT > s1) { P.spin = 1; }
        if (P.moveT >= s0 && !P._spinSnd) { P._spinSnd = true; SFX.spinPlay(s1 - s0); }
      }
    } else if (P.state === "taunt") {
    } else {
      let sp = MOVE_SPEED;
      if (P.charging) {
        const cr = Math.min(1, P.chargeT / HEAVY_CHARGE_TIME);
        sp *= (1 - (1 - HEAVY_CHARGE_MINSPD) * cr);
      }
      vX = inX * sp; vZ = inZ * sp;
      if (inLen > 0.01) { P.facing = Math.atan2(inX, inZ); P.moving = true; }
    }
    P.x += vX * dt; P.z += vZ * dt; P.speed = Math.hypot(vX, vZ);
    const B = ROOM - 1; P.x = Math.max(-B, Math.min(B, P.x)); P.z = Math.max(-B, Math.min(B, P.z));
    resolveCollision(P, PLAYER_R);

    if (P.moving) P.runPhase += dt * Math.min(P.speed, MOVE_SPEED) * 1.9; else P.runPhase *= 0.85;
    if (P.stamina < P.staminaMax) P.stamina = Math.min(P.staminaMax, P.stamina + STAM_REGEN * dt);
    yaw.rotation.y += angleDelta(yaw.rotation.y, P.facing) * Math.min(1, TURN_LERP * dt);
    if (runtimeState.shake > 0) runtimeState.shake = Math.max(0, runtimeState.shake - dt * 0.6);
    updateFx(dt); poseCharacter(dt);
    swordTrail.updateTrail(dt); swordBeam.updateBeams(dt, hitResolution.beamHitByBeam); spinRings.updateSpinRings(dt); spaceSlash.update(dt); stompEffects.updateStomps(dt);
  }

  return { update };
}
