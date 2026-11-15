import test from 'node:test';
import assert from 'node:assert/strict';
import { GamepadControls, MenuFocusController, gamepadStick } from '../js/engine/GamepadControls.js';

const pad = (index = 0, id = `pad-${index}`) => ({ index, id, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })) });
function press(device, index, down = true) { device.buttons[index] = { pressed: down, value: Number(down) }; }
function input(devices) {
  const actions = [], moves = [], looks = [], navigation = [], radial = [], connections = [];
  const controls = new GamepadControls({ getGamepads: () => devices,
    onAction: (...args) => actions.push(args), onMove: (...args) => moves.push(args), onLook: (...args) => looks.push(args),
    onNavigate: (...args) => navigation.push(args), onRadial: (...args) => radial.push(args), onConnection: (...args) => connections.push(args) });
  const tick = (state = {}) => controls.update(1 / 60, state);
  tick(); actions.length = 0; moves.length = 0; looks.length = 0;
  return { controls, actions, moves, looks, navigation, radial, connections, tick };
}

test('radial deadzones eliminate drift, remap smoothly, bound diagonals and sanitize malformed axes', () => {
  assert.deepEqual(gamepadStick(.1, -.1), { x: 0, y: 0, magnitude: 0 });
  const right = gamepadStick(.59, 0), diagonal = gamepadStick(1, 1);
  assert.ok(Math.abs(right.x - .5) < 1e-12); assert.equal(right.y, 0);
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.y) - 1) < 1e-12);
  assert.deepEqual(gamepadStick(NaN, Infinity), { x: 0, y: 0, magnitude: 0 });
  assert.ok(Object.values(gamepadStick(99, -99, -1)).every(Number.isFinite));
});

test('the default sampler calls the browser Gamepad API without requiring connection events', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator'), device = pad(); let polls = 0;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { getGamepads: () => { polls++; return [device]; } } });
  const controls = new GamepadControls();
  try { controls.update(.016); assert.equal(polls, 1); assert.equal(controls.getState()[0].padIndex, 0); }
  finally { controls.dispose(); if (descriptor) Object.defineProperty(globalThis, 'navigator', descriptor); else delete globalThis.navigator; }
});

test('P1 and P2 own stable sparse pad slots and independent normalized movement and camera vectors', () => {
  const first = pad(2), second = pad(7), devices = [null, first, null, second], f = input(devices);
  f.tick({ playerCount: 2 }); first.axes = [1, -1, .6, -.8]; second.axes = [-1, 0, -.8, .6];
  f.tick({ playerCount: 2 });
  const move1 = f.moves.findLast(([index]) => index === 0)[1], move2 = f.moves.findLast(([index]) => index === 1)[1];
  assert.ok(move1.x > 0 && move1.y > 0); assert.ok(Math.hypot(move1.x, move1.y) <= 1.000001); assert.equal(move2.x, -1);
  assert.ok(f.looks.findLast(([index]) => index === 1)[1].y < 0);
  devices[1] = null; f.tick({ playerCount: 2 }); assert.equal(f.controls.getState()[1].padIndex, 7);
  devices[1] = pad(4); f.tick({ playerCount: 2 });
  assert.equal(f.controls.getState()[0].padIndex, 4); assert.equal(f.controls.getState()[1].padIndex, 7); f.controls.dispose();
});

test('combat actions use fresh button fronts and Start suppresses simultaneous attacks', () => {
  const device = pad(), f = input([device]);
  press(device, 2); f.tick(); f.tick(); assert.equal(f.actions.filter(([, action]) => action === 'light').length, 1);
  press(device, 2, false); f.tick(); press(device, 2); f.tick();
  assert.equal(f.actions.filter(([, action]) => action === 'light').length, 2);
  press(device, 2, false); f.tick(); f.actions.length = 0;
  press(device, 2); press(device, 9); f.tick(); assert.deepEqual(f.actions.map(([, action]) => action), ['pause']);
  f.controls.dispose();
});

test('UI contexts route confirm/back/panels and cannot leak movement, attacks or a held button into gameplay', () => {
  const device = pad(), f = input([device]); f.tick({ context: 'menu' });
  device.axes = [1, 0, 1, 0]; press(device, 0); press(device, 2); press(device, 5); f.tick({ context: 'menu' });
  assert.deepEqual(f.actions.map(([, action]) => action), ['confirm', 'tabNext']);
  assert.equal(f.moves.at(-1)[1].magnitude, 0); assert.equal(f.looks.at(-1)[1].magnitude, 0);
  f.actions.length = 0; f.tick({ context: 'gameplay' }); f.tick(); assert.equal(f.actions.length, 0);
  press(device, 2, false); f.tick(); press(device, 2); f.tick(); assert.equal(f.actions.at(-1)[1], 'light');
  f.tick({ context: 'menu' }); press(device, 1); f.actions.length = 0; f.tick({ context: 'menu' });
  assert.deepEqual(f.actions.map(([, action]) => action), ['back']); f.controls.dispose();
});

test('disconnect, blur and modal opening cancel held actions with an explicit reason instead of a firing release', () => {
  const device = pad(), devices = [device], f = input(devices);
  press(device, 6); press(device, 7); press(device, 10); f.tick();
  assert.equal(f.controls.getState()[0].held.length, 3);
  f.actions.length = 0; f.tick({ context: 'paused' });
  assert.equal(f.actions.length, 3); assert.ok(f.actions.every(([, , details]) => details.phase === 'released' && details.reason === 'context'));
  f.tick(); press(device, 7, false); f.tick(); press(device, 7); f.tick(); f.actions.length = 0;
  devices[0] = null; f.tick(); assert.equal(f.actions.at(-1)[2].reason, 'disconnected');
  assert.equal(f.controls.getState()[0], null); f.controls.dispose();
});

test('trigger hysteresis avoids jitter and its natural release is distinguishable from cancellation', () => {
  const device = pad(), f = input([device]);
  device.buttons[7] = { value: .6 }; f.tick(); device.buttons[7] = { value: .45 }; f.tick();
  assert.equal(f.actions.length, 1); device.buttons[7] = { value: .3 }; f.tick();
  assert.equal(f.actions.length, 2); assert.equal(f.actions[1][2].phase, 'released'); assert.equal(f.actions[1][2].reason, undefined);
  f.controls.dispose();
});

test('menu navigation repeats in seconds and held directions must be released when the context changes', () => {
  const counts = [];
  for (const fps of [30, 60, 120]) {
    const device = pad(), f = input([device]); press(device, 12); f.tick(); f.tick({ context: 'menu' });
    assert.equal(f.navigation.length, 0); press(device, 12, false); f.tick({ context: 'menu' }); press(device, 12);
    for (let step = 0; step < fps; step++) f.controls.update(1 / fps, { context: 'menu' });
    counts.push(f.navigation.length); assert.ok(f.navigation.every(([, direction]) => direction === 'up')); f.controls.dispose();
  }
  assert.ok(Math.max(...counts) - Math.min(...counts) <= 1); assert.ok(counts[0] >= 5 && counts[0] <= 8);
});

test('radial vectors have clockwise angles from the top and no gameplay actions; missing or denied APIs fail closed', () => {
  const device = pad(), f = input([device]); f.tick({ context: 'radial' }); device.axes = [1, 0, 0, 0]; f.tick({ context: 'radial' });
  assert.equal(f.radial.at(-1)[1].angle, Math.PI / 2); assert.equal(f.moves.at(-1)[1].magnitude, 0);
  f.controls.getGamepads = () => { throw new Error('denied'); }; assert.doesNotThrow(() => f.tick()); assert.equal(f.controls.getState()[0], null);
  f.controls.dispose(); const calls = f.moves.length; f.tick(); assert.equal(f.moves.length, calls);
});

function menuFixture() {
  const document = { activeElement: null, defaultView: { getComputedStyle: () => ({ display: 'block', visibility: 'visible' }), Event } }, controls = [];
  class Control {
    constructor(tag = 'BUTTON', x = 0, y = 0) { this.tagName = tag; this.tabIndex = 0; this.attributes = {}; this.disabled = false; this.hidden = false; this.clicks = 0; this.changes = 0; this.rect = { left: x, top: y, width: 80, height: 30 }; controls.push(this); }
    getAttribute(name) { return this.attributes[name] ?? null; } setAttribute(name, value) { this.attributes[name] = value; } removeAttribute(name) { delete this.attributes[name]; }
    closest() { return this.hidden ? this : null; } matches() { return ['INPUT', 'TEXTAREA'].includes(this.tagName); }
    getClientRects() { return this.hidden ? [] : [this.rect]; } getBoundingClientRect() { return this.rect; }
    focus() { document.activeElement = this; } scrollIntoView() {} click() { this.clicks++; }
    dispatchEvent(event) { if (event.type === 'change') this.changes++; }
  }
  const root = { querySelectorAll: selector => selector.startsWith('[role="tab"]') ? controls.filter(c => c.attributes.role === 'tab') : controls };
  const controller = new MenuFocusController({ document, getRoot: () => root });
  return { document, controls, Control, root, controller };
}

test('menu focus follows spatial directions, excludes disabled/hidden targets and activates only the focused control', () => {
  const f = menuFixture(), first = new f.Control('BUTTON', 0, 0), hidden = new f.Control('BUTTON', 0, 40), right = new f.Control('BUTTON', 100, 0), below = new f.Control('BUTTON', 0, 80);
  hidden.hidden = true; const disabled = new f.Control('BUTTON', 0, 35); disabled.disabled = true;
  assert.equal(f.controller.navigate('down'), true); assert.equal(f.document.activeElement, first);
  f.controller.navigate('right'); assert.equal(f.document.activeElement, right); f.controller.navigate('down'); assert.equal(f.document.activeElement, below);
  f.controller.confirm(); assert.equal(below.clicks, 1); assert.equal(first.clicks, 0);
  assert.equal(below.getAttribute('data-gamepad-focus'), 'true'); f.controller.dispose(); assert.equal(below.getAttribute('data-gamepad-focus'), null);
});

test('keyboard navigation traps Tab in its supplied menu root and leaves text editing to native controls', () => {
  const f = menuFixture(), first = new f.Control(), second = new f.Control('BUTTON', 0, 60), field = new f.Control('INPUT', 0, 100);
  const key = (value, shiftKey = false) => ({ key: value, shiftKey, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; } });
  f.controller.navigate('down'); const previous = key('Tab', true); assert.equal(f.controller.handleKeyDown(previous), true); assert.equal(f.document.activeElement, field); assert.ok(previous.prevented && previous.stopped);
  const native = key('ArrowDown'); assert.equal(f.controller.handleKeyDown(native), false); assert.equal(native.prevented, undefined);
  f.controller.handleKeyDown(key('Tab')); assert.equal(f.document.activeElement, first);
  first.focus(); f.controller.handleKeyDown(key('Tab')); assert.equal(f.document.activeElement, second);
  f.controller.handleKeyDown(key('Enter')); assert.equal(second.clicks, 1); f.controller.dispose();
});

test('gamepad selects change actual values; multiple groups toggle independently and B exits edit before closing a panel', () => {
  const f = menuFixture(), select = new f.Control('SELECT');
  select.options = Array.from({ length: 3 }, () => ({ selected: false, disabled: false })); select.selectedIndex = 0;
  f.controller.navigate('down'); f.controller.navigate('right'); assert.equal(select.selectedIndex, 1); assert.equal(select.changes, 1);
  select.multiple = true; select.options[1].selected = true; f.controller.confirm(); assert.equal(select.options[1].selected, false);
  f.controller.navigate('down'); f.controller.confirm(); assert.equal(select.options[2].selected, true);
  f.controller.navigate('up'); f.controller.confirm(); assert.equal(select.options[1].selected, true); assert.equal(select.options[2].selected, true);
  let back = 0; f.controller.onBack = () => { back++; return true; };
  assert.equal(f.controller.back(), true); assert.equal(back, 0); assert.equal(f.controller.back(), true); assert.equal(back, 1); f.controller.dispose();
});

test('LB/RB cycle and activate real tabs, while generic menus retain a focus navigation fallback', () => {
  const f = menuFixture(), first = new f.Control(), second = new f.Control('BUTTON', 100, 0);
  first.setAttribute('role', 'tab'); second.setAttribute('role', 'tab'); first.setAttribute('aria-selected', 'true');
  assert.equal(f.controller.cyclePanel(1), true); assert.equal(f.document.activeElement, second); assert.equal(second.clicks, 1);
  delete first.attributes.role; delete second.attributes.role; f.controller.cyclePanel(-1); assert.equal(f.document.activeElement, first); f.controller.dispose();
});
