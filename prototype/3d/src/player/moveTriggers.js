export function createMoveTriggers({
  player,
  clips,
  moves,
  jumpVelocity,
  sfx,
  attackBursts,
  swordBeam,
  stompEffects,
  poseClipController,
  setHitstop,
  setShake,
  resetDrillSpin = () => {},
}) {
  const P = player;
  const CLIPS = clips;
  const MOVES = moves;
  const JUMP_V = jumpVelocity;
  const SFX = sfx;

  function setImpact(hitstop, shake) {
    setHitstop(hitstop);
    setShake(shake);
  }

  function playClip(name) {
    P.clip = name;
    P.clipT = 0;
    P.clipDur = CLIPS[name].dur;
  }

  function doSlash(from, to, heavy) {
    attackBursts.doSlash(from, to, heavy);
  }

  function doThrust() {
    // The thrust uses the sword trail for visuals; keep only frame stop and shake here.
    setImpact(0.04, 0.12);
  }

  function fireFx(fx) {
    switch (fx) {
      case 'slashR':
        setImpact(0.07, 0.14);
        SFX.swing();
        break;
      case 'slashL':
        setImpact(0.07, 0.14);
        SFX.swing();
        break;
      case 'chop':
        setImpact(0.10, 0.22);
        SFX.chop();
        swordBeam.spawnSwordBeam();
        break;
      case 'slam':
        setImpact(0.14, 0.32);
        break;
      case 'stomp':
        stompEffects.doStomp();
        break;
      case 'drill':
        setImpact(0.14, 0.6);
        stompEffects.doStomp();
        P._drillBounce = 4.5;
        break;
      case 'kick':
        setImpact(0.10, 0.20);
        SFX.kick();
        break;
      case 'rise':
        setImpact(0.09, 0.18);
        SFX.rise();
        break;
      case 'thrust':
        SFX.thrust();
        doThrust();
        break;
      case 'spinSlash':
        setImpact(0.08, 0.22);
        break;
      case 'heavyCircle':
        attackBursts.burstCircle(1.7);
        break;
      case 'heavyCircleBig':
        attackBursts.burstCircle(2.6);
        break;
    }
  }

  function startMove(name) {
    const mv = MOVES[name];
    if (!mv) return;

    const prevMove = P.move;
    const prevState = P.state;
    P.state = 'attack';
    P.move = name;
    P.moveT = 0;
    P.phase = 'startup';
    P.struck = false;
    P._plungeDone = false;
    P._customRecover = null;
    P.nextBuffer = null;
    P._ignoreHeavyRelease = false;
    P.lunge = mv.lunge || 0;
    P.spin = (mv.spin || mv.spinY) ? 0 : P.spin;
    if (mv.spinY && P._spinHit) P._spinHit.clear();
    P._spinSnd = false;
    SFX.spinStop();
    P._slideV = undefined;
    P._slideStarted = null;

    poseClipController.capturePoseSnapshot();
    P.blendT = 0;
    P.blendDur = (name === 'dRise' && prevState === 'dodge') ? 0.22 : 0.13;
    playClip(mv.clip);
    P._trailStarted = false;
    P._launched = false;
    P._stompHang = (name === 'aStomp' && prevMove === 'dRise') ? 0.28 : 0;
    if (name === 'aDrill') resetDrillSpin();
    if (name === 'aJupiter') P._jupRev = -1;
  }

  function startDodgeCombo(kind) {
    if (kind === 'light') {
      P.jumping = true;
      P.vy = JUMP_V * 0.95;
      startMove('dKick');
    } else {
      P.chargeLock = true;
      startMove('dRise');
      P._ignoreHeavyRelease = true;
    }
  }

  function startSlash(type, ratio = 0) {
    attackBursts.startSlash(type, ratio);
  }

  return {
    playClip,
    fireFx,
    doSlash,
    doThrust,
    startMove,
    startDodgeCombo,
    startSlash,
  };
}
