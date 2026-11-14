import test from 'node:test';
import assert from 'node:assert/strict';
import { GamepadGameBridge } from '../js/engine/GamepadGameBridge.js';
import { MenuFocusController } from '../js/engine/GamepadControls.js';

function fixture() {
  const previous = globalThis.document, nodes = new Map(), screens = [], dialogs = [];
  const document = { getElementById: id => nodes.get(id) ?? null,
    querySelectorAll: selector => selector.includes('role="dialog"') ? dialogs : screens,
    querySelector: selector => document.querySelectorAll(selector).find(node => !node.hidden) ?? null };
  const root = (id, { hidden = false, dialog = false, screen = false } = {}) => {
    const node = { id, hidden, isConnected: true, controls: [], classList: { contains: value => value === 'hidden' && node.hidden },
      getAttribute: key => key === 'aria-hidden' ? String(node.hidden) : key === 'role' && dialog ? 'dialog' : null,
      closest: selector => selector === '.ui-screen' ? node.parentScreen ?? null : node.hidden ? node : null,
      querySelectorAll: () => node.controls };
    nodes.set(id, node); if (screen) screens.push(node); if (dialog) dialogs.push(node); return node;
  };
  const hud = root('hud', { screen: true }), menu = root('main', { hidden: true, screen: true });
  const game = { isPlaying: true, isPaused: false, weaponWheel: { isOpen: false }, photoMode: { isActive: false }, ui: { inGameHud: hud, mainMenu: menu, showScreen: node => { game.shown = node; } }, togglePause: value => { game.isPaused = value; } };
  const bridge = Object.create(GamepadGameBridge.prototype); bridge.game = game; bridge.focus = { reset() {} };
  globalThis.document = document;
  return { document, root, game, bridge, restore: () => { globalThis.document = previous; } };
}

test('tactical dialog and command-map roots take precedence over the HUD even without ui-screen classes', () => {
  const f = fixture();
  try {
    const dialog = f.root('command-map-modal', { dialog: true }); f.game._tacticalModal = { id: dialog.id }; f.game.commandMap = { root: dialog };
    assert.equal(f.bridge.uiRoot(), dialog); assert.notEqual(f.bridge.context(), 'gameplay');
    let closed = 0; f.game.closeTacticalModal = () => { closed++; dialog.hidden = true; f.game._tacticalModal = null; };
    assert.equal(f.bridge.back(), true); assert.equal(closed, 1); assert.equal(f.bridge.context(), 'gameplay');
    assert.equal(f.bridge.uiRoot(), null);
  } finally { f.restore(); }
});

test('generic visible dialogs block combat and radial menus remain the top focus scope', () => {
  const f = fixture();
  try {
    const dialog = f.root('dialog', { dialog: true }); assert.equal(f.bridge.context(), 'menu'); assert.equal(f.bridge.uiRoot(), dialog);
    const wheel = f.root('wheel'); f.game.weaponWheel = { isOpen: true, overlay: wheel, close: () => { f.game.weaponWheel.isOpen = false; } };
    assert.equal(f.bridge.context(), 'radial'); assert.equal(f.bridge.uiRoot(), wheel); f.bridge.back(); assert.equal(f.bridge.uiRoot(), dialog);
    dialog.hidden = true; assert.equal(f.bridge.context(), 'gameplay');
  } finally { f.restore(); }
});

test('a nested briefing retains its loadout screen controls and absent menu roots return safely', () => {
  const f = fixture();
  try {
    f.game.isPlaying = false; const loadout = f.root('loadout', { screen: true }), briefing = f.root('briefing'); briefing.parentScreen = loadout;
    f.game.operationBriefing = { root: briefing }; assert.equal(f.bridge.uiRoot(), loadout);
    loadout.hidden = true; briefing.hidden = true; f.game.ui.mainMenu = null;
    assert.equal(f.bridge.uiRoot(), null); assert.equal(f.bridge.back(), false);
    const focus = new MenuFocusController({ document: f.document, getRoot: () => f.bridge.uiRoot() });
    assert.equal(focus.navigate('down'), false); assert.equal(focus.confirm(), false); focus.dispose();
  } finally { f.restore(); }
});

test('Back activates the actual close control in a non-playing dialog without falling through to combat', () => {
  const f = fixture();
  try {
    f.game.isPlaying = false; const dialog = f.root('briefing-modal', { dialog: true }); let clicked = 0;
    dialog.controls = [{ id: 'btn-close-briefing', click: () => clicked++, classList: { contains: () => false } }];
    assert.equal(f.bridge.back(), true); assert.equal(clicked, 1); assert.equal(f.game.isPaused, false);
  } finally { f.restore(); }
});
