export function createInputController({ canvas, cameraRig, getPlayer, documentRef = document, windowRef = window }) {
  const Actions = { moveX: 0, moveZ: 0, attack: false, jump: false, dodge: false, heavyHeld: false, heavyReleased: false, taunt: false };
  const prev = { attack: false, jump: false, dodge: false, heavy: false, taunt: false };
  let inputMode = 'keyboard';
  const keys = {}, mouse = { left: false, right: false };
  const navigatorRef = windowRef.navigator;

  windowRef.addEventListener('keydown', e => { keys[e.code] = true; if (e.code === 'Space') e.preventDefault(); if (inputMode !== 'keyboard') setMode('keyboard'); });
  windowRef.addEventListener('keyup', e => { keys[e.code] = false; });
  canvas.addEventListener('mousedown', e => { if (e.button === 0) mouse.left = true; if (e.button === 2) mouse.right = true; if (inputMode !== 'keyboard') setMode('keyboard'); });
  windowRef.addEventListener('mouseup', e => { if (e.button === 0) mouse.left = false; if (e.button === 2) mouse.right = false; });
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  let gpIndex = null;
  windowRef.addEventListener('gamepadconnected', e => { gpIndex = e.gamepad.index; padStatus(); });
  windowRef.addEventListener('gamepaddisconnected', e => { if (gpIndex === e.gamepad.index) gpIndex = null; padStatus(); });
  function padStatus() {
    const el = documentRef.getElementById('padState');
    if (gpIndex !== null) {
      el.textContent = '已连接 ✓';
      el.className = 'on';
    } else {
      el.textContent = '未连接';
      el.className = '';
    }
  }

  const btnKb = documentRef.getElementById('btnKeyboard'), btnGp = documentRef.getElementById('btnGamepad');
  function setMode(m) { inputMode = m; btnKb.classList.toggle('active', m === 'keyboard'); btnGp.classList.toggle('active', m === 'gamepad'); }
  let invertX = true, invertY = false;
  const btnInvX = documentRef.getElementById('btnInvertX'), btnInvY = documentRef.getElementById('btnInvertY');
  if (btnInvX) btnInvX.addEventListener('click', () => { invertX = !invertX; btnInvX.classList.toggle('active', invertX); });
  if (btnInvY) btnInvY.addEventListener('click', () => { invertY = !invertY; btnInvY.classList.toggle('active', invertY); });
  btnKb.onclick = () => setMode('keyboard');
  btnGp.onclick = () => setMode('gamepad');

  function stickDeadzone(v, dz = 0.25) {
    const a = Math.abs(v);
    if (a < dz) return 0;
    const n = (a - dz) / (1 - dz);
    return Math.sign(v) * n * n;
  }
  const worldMove = { x: 0, z: 0 };
  function toCameraRelativeMove(mx, mz, out = worldMove) {
    const s = Math.sin(cameraRig.yaw), c = Math.cos(cameraRig.yaw);
    out.x = mx * c + mz * s;
    out.z = -mx * s + mz * c;
    return out;
  }
  function pollInput() {
    let mx = 0, mz = 0, aAtk = false, aHeavy = false, aJump = false, aDodge = false, aTaunt = false;
    cameraRig.stickX = 0; cameraRig.stickY = 0;
    if (inputMode === 'keyboard') {
      if (keys['KeyA']) mx -= 1; if (keys['KeyD']) mx += 1; if (keys['KeyW']) mz -= 1; if (keys['KeyS']) mz += 1;
      aAtk = mouse.left; aHeavy = mouse.right; aJump = !!keys['Space']; aDodge = !!(keys['ShiftLeft'] || keys['ShiftRight']); aTaunt = !!keys['KeyT'];
      if (keys['KeyQ']) cameraRig.stickX -= 0.75; if (keys['KeyE']) cameraRig.stickX += 0.75;
      if (keys['KeyR']) cameraRig.stickY -= 0.75; if (keys['KeyF']) cameraRig.stickY += 0.75;
    } else {
      const gp = gpIndex !== null ? navigatorRef.getGamepads()[gpIndex] : null;
      if (gp) {
        let lx = stickDeadzone(gp.axes[0] || 0), ly = stickDeadzone(gp.axes[1] || 0); mx = lx; mz = ly;
        cameraRig.stickX = stickDeadzone(gp.axes[2] || 0, 0.18);
        cameraRig.stickY = stickDeadzone(gp.axes[3] || 0, 0.18);
        if (gp.buttons[14]?.pressed) mx -= 1; if (gp.buttons[15]?.pressed) mx += 1; if (gp.buttons[12]?.pressed) mz -= 1; if (gp.buttons[13]?.pressed) mz += 1;
        aJump = gp.buttons[0]?.pressed; aDodge = gp.buttons[1]?.pressed; aAtk = gp.buttons[2]?.pressed; aHeavy = gp.buttons[3]?.pressed; aTaunt = gp.buttons[5]?.pressed;
      }
    }
    if (invertX) cameraRig.stickX = -cameraRig.stickX;
    if (invertY) cameraRig.stickY = -cameraRig.stickY;
    const len = Math.hypot(mx, mz); if (len > 1) { mx /= len; mz /= len; }
    Actions.moveX = mx; Actions.moveZ = mz;
    Actions.attack = aAtk && !prev.attack; Actions.jump = aJump && !prev.jump; Actions.dodge = aDodge && !prev.dodge; Actions.taunt = aTaunt && !prev.taunt;
    Actions.heavyHeld = aHeavy; Actions.heavyReleased = (!aHeavy) && prev.heavy;
    prev.attack = aAtk; prev.jump = aJump; prev.dodge = aDodge; prev.heavy = aHeavy; prev.taunt = aTaunt;
  }
  function clearGameplayInputState() {
    for (const code of Object.keys(keys)) keys[code] = false;
    mouse.left = false; mouse.right = false;
    Object.assign(Actions, { moveX: 0, moveZ: 0, attack: false, jump: false, dodge: false, heavyHeld: false, heavyReleased: false, taunt: false });
    Object.assign(prev, { attack: false, jump: false, dodge: false, heavy: false, taunt: false });
    cameraRig.stickX = 0; cameraRig.stickY = 0;
    const P = getPlayer();
    P.charging = false; P.chargeT = 0; P.chargeFull = false; P.chargeFullT = 0; P.chargeLock = false;
  }
  function autoPad() {
    // 主动扫描（兜底，防止gamepadconnected未触发）
    if (gpIndex === null) { const pads = navigatorRef.getGamepads(); for (let i = 0; i < pads.length; i++) { if (pads[i]) { gpIndex = pads[i].index; padStatus(); break; } } }
    if (gpIndex === null) return; const gp = navigatorRef.getGamepads()[gpIndex]; if (!gp) return; if ((gp.buttons.some(b => b.pressed) || gp.axes.some(a => Math.abs(a) > 0.35)) && inputMode !== 'gamepad') setMode('gamepad');
  }

  return { Actions, mouse, pollInput, clearGameplayInputState, autoPad, toCameraRelativeMove, padStatus };
}
