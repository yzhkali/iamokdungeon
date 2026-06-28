import { createInputController } from '../prototype/3d/src/ui/input.js';

class FakeTarget {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }

  dispatch(type, event = {}) {
    for (const listener of this.listeners.get(type) || []) listener(event);
  }
}

function button(pressed = false) {
  return { pressed };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function nearly(actual, expected, message, epsilon = 1e-9) {
  if (Math.abs(actual - expected) > epsilon) {
    throw new Error(`${message}: got ${actual}, expected ${expected}`);
  }
}

function deadzone(v, dz = 0.25) {
  const a = Math.abs(v);
  if (a < dz) return 0;
  const n = (a - dz) / (1 - dz);
  return Math.sign(v) * n * n;
}

function createFixture() {
  const elements = new Map();
  for (const id of ['padState', 'btnKeyboard', 'btnGamepad', 'btnInvertX', 'btnInvertY']) {
    elements.set(id, {
      textContent: '',
      className: '',
      classList: {
        values: new Set(),
        toggle(name, force) {
          if (force) this.values.add(name);
          else this.values.delete(name);
        },
        contains(name) {
          return this.values.has(name);
        },
      },
      addEventListener(type, listener) {
        this[`on${type}`] = listener;
      },
      onclick: null,
    });
  }

  const canvas = new FakeTarget();
  const windowRef = new FakeTarget();
  let pads = [];
  windowRef.navigator = {
    getGamepads: () => pads,
  };
  const documentRef = {
    getElementById: id => elements.get(id),
  };
  const cameraRig = { yaw: Math.PI / 2, stickX: 3, stickY: 4 };
  const player = { charging: true, chargeT: 0.5, chargeFull: true, chargeFullT: 0.25, chargeLock: true };
  const input = createInputController({
    canvas,
    cameraRig,
    getPlayer: () => player,
    documentRef,
    windowRef,
  });

  return { input, canvas, windowRef, elements, cameraRig, player, setPads: value => { pads = value; } };
}

{
  const { input, windowRef, cameraRig } = createFixture();
  let prevented = false;
  windowRef.dispatch('keydown', { code: 'KeyW' });
  windowRef.dispatch('keydown', { code: 'KeyD' });
  windowRef.dispatch('keydown', { code: 'KeyQ' });
  windowRef.dispatch('keydown', { code: 'Space', preventDefault: () => { prevented = true; } });
  input.pollInput();
  assert(prevented, 'Space keydown should prevent default scrolling');
  nearly(Math.hypot(input.Actions.moveX, input.Actions.moveZ), 1, 'W+D movement should normalize to length 1');
  assert(input.Actions.moveX > 0 && input.Actions.moveZ < 0, 'W+D should produce diagonal movement');
  assert(input.Actions.jump === true, 'Space should produce jump edge');
  assert(cameraRig.stickX === 0.75, 'Keyboard Q should be inverted by default into positive camera stickX');
  assert(cameraRig.stickY === 0, 'Keyboard poll should reset unused camera stickY');
  input.pollInput();
  assert(input.Actions.jump === false, 'Held Space should not repeat jump edge');
  windowRef.dispatch('keyup', { code: 'KeyW' });
  windowRef.dispatch('keyup', { code: 'KeyD' });
  windowRef.dispatch('keyup', { code: 'KeyQ' });
  windowRef.dispatch('keyup', { code: 'Space' });
  windowRef.dispatch('keydown', { code: 'KeyA' });
  windowRef.dispatch('keydown', { code: 'KeyD' });
  windowRef.dispatch('keydown', { code: 'KeyR' });
  windowRef.dispatch('keydown', { code: 'KeyF' });
  input.pollInput();
  nearly(input.Actions.moveX, 0, 'A+D should cancel horizontal movement');
  nearly(input.Actions.moveZ, 0, 'No W/S should leave vertical movement neutral');
  nearly(cameraRig.stickY, 0, 'R+F should cancel camera pitch');
  windowRef.dispatch('keyup', { code: 'KeyA' });
  windowRef.dispatch('keyup', { code: 'KeyD' });
  windowRef.dispatch('keyup', { code: 'KeyR' });
  windowRef.dispatch('keyup', { code: 'KeyF' });
  input.pollInput();
  nearly(input.Actions.moveX, 0, 'keyup should clear movement X');
  nearly(input.Actions.moveZ, 0, 'keyup should clear movement Z');
  nearly(cameraRig.stickX, 0, 'poll should reset camera stickX when no key held');
  nearly(cameraRig.stickY, 0, 'poll should reset camera stickY when no key held');
}

{
  const { input, windowRef } = createFixture();
  windowRef.dispatch('keydown', { code: 'ShiftLeft' });
  windowRef.dispatch('keydown', { code: 'KeyT' });
  input.pollInput();
  assert(input.Actions.dodge === true, 'Shift should produce dodge edge');
  assert(input.Actions.taunt === true, 'KeyT should produce taunt edge');
  input.pollInput();
  assert(input.Actions.dodge === false, 'Held Shift should not repeat dodge edge');
  assert(input.Actions.taunt === false, 'Held KeyT should not repeat taunt edge');
}

{
  const { input, canvas, windowRef } = createFixture();
  canvas.dispatch('mousedown', { button: 0 });
  input.pollInput();
  assert(input.Actions.attack === true, 'Left mouse down should produce attack edge');
  input.pollInput();
  assert(input.Actions.attack === false, 'Held left mouse should not repeat attack edge');
  assert(input.mouse.left === true, 'Held left mouse should remain visible for dodge buffering');
  windowRef.dispatch('mouseup', { button: 0 });
  input.pollInput();
  assert(input.mouse.left === false, 'Mouse up should clear held left mouse');
  let contextPrevented = false;
  canvas.dispatch('contextmenu', { preventDefault: () => { contextPrevented = true; } });
  assert(contextPrevented, 'contextmenu should be prevented on canvas');
}

{
  const { input, canvas, windowRef } = createFixture();
  canvas.dispatch('mousedown', { button: 2 });
  input.pollInput();
  assert(input.Actions.heavyHeld === true, 'Right mouse down should hold heavy');
  assert(input.Actions.heavyReleased === false, 'Right mouse down should not release heavy');
  windowRef.dispatch('mouseup', { button: 2 });
  input.pollInput();
  assert(input.Actions.heavyHeld === false, 'Right mouse up should clear heavy hold');
  assert(input.Actions.heavyReleased === true, 'Right mouse up should produce heavy release');
  input.pollInput();
  assert(input.Actions.heavyReleased === false, 'Heavy release should be a one-frame edge');
}

{
  const { input, windowRef, cameraRig, player } = createFixture();
  windowRef.dispatch('keydown', { code: 'KeyA' });
  input.pollInput();
  input.clearGameplayInputState();
  assert(input.Actions.moveX === 0 && input.Actions.moveZ === 0, 'clear should reset movement');
  assert(cameraRig.stickX === 0 && cameraRig.stickY === 0, 'clear should reset camera stick');
  assert(player.charging === false && player.chargeT === 0 && player.chargeFull === false && player.chargeFullT === 0 && player.chargeLock === false, 'clear should reset player charge state');
  input.pollInput();
  assert(input.Actions.moveX === 0 && input.Actions.moveZ === 0, 'poll after clear should not resurrect cleared keyboard state');
  assert(input.Actions.attack === false && input.Actions.heavyHeld === false && input.Actions.heavyReleased === false, 'poll after clear should keep cleared mouse/actions neutral');
}

{
  const { input, setPads, cameraRig, elements } = createFixture();
  const idlePad = {
    index: 1,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 16 }, () => button(false)),
  };
  setPads([null, idlePad]);
  input.autoPad();
  assert(elements.get('padState').textContent === '已连接 ✓', 'autoPad should select the first available pad');
  input.pollInput();
  assert(input.Actions.moveX === 0 && input.Actions.moveZ === 0, 'Idle selected pad should not affect keyboard-mode movement');
}

{
  const { input, setPads, cameraRig, elements } = createFixture();
  const gp = {
    index: 2,
    axes: [0.6, -0.7, 0.5, -0.5],
    buttons: Array.from({ length: 16 }, () => button(false)),
  };
  gp.buttons[0] = button(true);
  gp.buttons[1] = button(true);
  gp.buttons[2] = button(true);
  gp.buttons[3] = button(true);
  gp.buttons[5] = button(true);
  gp.buttons[14] = button(true);
  gp.buttons[12] = button(true);
  setPads([null, null, gp]);
  input.autoPad();
  input.pollInput();
  assert(elements.get('padState').textContent === '已连接 ✓', 'autoPad should update pad status');
  assert(input.Actions.jump === true, 'Gamepad A should produce jump edge');
  assert(input.Actions.dodge === true, 'Gamepad B should produce dodge edge');
  assert(input.Actions.attack === true, 'Gamepad X should produce attack edge');
  assert(input.Actions.heavyHeld === true, 'Gamepad Y should hold heavy');
  assert(input.Actions.taunt === true, 'Gamepad RB should produce taunt edge');
  const rawX = deadzone(0.6) - 1;
  const rawZ = deadzone(-0.7) - 1;
  const rawLen = Math.hypot(rawX, rawZ);
  nearly(input.Actions.moveX, rawX / rawLen, 'Gamepad left stick and D-pad should combine and normalize X');
  nearly(input.Actions.moveZ, rawZ / rawLen, 'Gamepad left stick and D-pad should combine and normalize Z');
  nearly(cameraRig.stickX, -deadzone(0.5, 0.18), 'Gamepad right stick X should use 0.18 deadzone and default inversion');
  nearly(cameraRig.stickY, deadzone(-0.5, 0.18), 'Gamepad right stick Y should use 0.18 deadzone without default inversion');
  input.pollInput();
  assert(input.Actions.jump === false && input.Actions.dodge === false && input.Actions.attack === false && input.Actions.taunt === false, 'Held gamepad buttons should not repeat edge actions');
  assert(input.Actions.heavyHeld === true && input.Actions.heavyReleased === false, 'Held gamepad heavy should stay held without release edge');
  gp.buttons[3] = button(false);
  input.pollInput();
  assert(input.Actions.heavyHeld === false && input.Actions.heavyReleased === true, 'Gamepad heavy release should fire once');
  input.pollInput();
  assert(input.Actions.heavyReleased === false, 'Gamepad heavy release should not repeat');
}

{
  const { input, windowRef, setPads, elements } = createFixture();
  const gp = {
    index: 4,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 16 }, () => button(false)),
  };
  windowRef.dispatch('gamepadconnected', { gamepad: gp });
  assert(elements.get('padState').textContent === '已连接 ✓', 'gamepadconnected should update status');
  setPads([null, null, null, null, gp]);
  input.pollInput();
  assert(input.Actions.moveX === 0 && input.Actions.moveZ === 0, 'Gamepad deadzone should keep idle axes neutral');
  windowRef.dispatch('gamepaddisconnected', { gamepad: gp });
  assert(elements.get('padState').textContent === '未连接', 'gamepaddisconnected should update status');
}

{
  const { input, windowRef, elements, cameraRig } = createFixture();
  windowRef.dispatch('keydown', { code: 'KeyQ' });
  input.pollInput();
  nearly(cameraRig.stickX, 0.75, 'Default invertX should flip Q to positive');
  elements.get('btnInvertX').onclick?.();
  input.pollInput();
  nearly(cameraRig.stickX, -0.75, 'Toggled invertX should stop flipping Q');
  windowRef.dispatch('keyup', { code: 'KeyQ' });
  windowRef.dispatch('keydown', { code: 'KeyR' });
  input.pollInput();
  nearly(cameraRig.stickY, -0.75, 'Default invertY off should keep R negative');
  elements.get('btnInvertY').onclick?.();
  input.pollInput();
  nearly(cameraRig.stickY, 0.75, 'Toggled invertY should flip R positive');
}

console.log('Input controller check passed.');
