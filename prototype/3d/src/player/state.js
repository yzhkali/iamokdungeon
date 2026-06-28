export const PLAYER_TUNING = Object.freeze({
  MOVE_SPEED: 9.2,
  TURN_LERP: 20,
  JUMP_V: 15.5,
  GRAVITY: 43,
  LIGHT_LUNGE: 2.5,
  HEAVY_LUNGE: 4.0,
  CHARGE_MAX: 1.1,
  CHARGE_MOVE: 0.38,
  CHARGE_AUTO: 1.0,
  HEAVY_CHARGE_TIME: 1.0,
  HEAVY_CHARGE_HOLD: 1.0,
  HEAVY_CHARGE_MINSPD: 0.2,
  DODGE_DUR: 0.20,
  DODGE_SPEED: 17.0,
  DODGE_IFRAME: 0.16,
  DODGE_COST: 0,
  STAM_REGEN: 10,
  HEAVY_R_MIN: 1.3,
  HEAVY_R_MAX: 2.7,
  PLAYER_R: 0.55
});

export function clonePlayerTuning() {
  return { ...PLAYER_TUNING };
}

export function createPlayerState({ makeVector3 }) {
  return {
    x: 0, z: 0, y: 0, vy: 0, facing: 0, jumping: false,
    hp: 5, hpMax: 5, dead: false,
    state: 'idle',
    clip: null, clipT: 0, clipDur: 0,
    move: null,
    moveT: 0, phase: 'startup', struck: false, blendT: 0, blendDur: 0.13,
    nextBuffer: null,
    lunge: 0,
    charging: false, chargeT: 0, chargeHold: 0, chargeLock: false, chargeFull: false, chargeFullT: 0,
    dodgeT: 0, dodgeDir: makeVector3(), roll: 0, iframe: 0, airDodge: false, _drillBounce: 0, _drillBounced: false,
    spin: 0,
    stamina: 100, staminaMax: 100, runPhase: 0, moving: false, speed: 0
  };
}
