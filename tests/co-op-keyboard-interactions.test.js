import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';

const main = fs.readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
function method(name) {
  const start = main.indexOf(`  ${name}(`), end = main.indexOf('\n  }', start);
  assert.notEqual(start, -1, `production method ${name}`); assert.notEqual(end, -1, `end of ${name}`);
  return main.slice(start, end + 4);
}
const listenerStart = main.indexOf("    window.addEventListener('keydown', (e) => {");
const listenerEnd = main.indexOf('\n    });', listenerStart);
assert.notEqual(listenerStart, -1, 'production keyboard listener'); assert.notEqual(listenerEnd, -1);
const listenerSource = main.slice(listenerStart, listenerEnd + '\n    });'.length);
const methods = ['handlePlayerInteraction', 'checkTrophyExecution', 'performCoopAttack'].map(method).join('\n');

function fixture() {
  let keydown;
  class HTMLElement { matches() { return false; } closest() { return null; } }
  const context = { THREE, HTMLElement, window: { addEventListener(type, listener) { if (type === 'keydown') keydown = listener; } } };
  const Actions = vm.runInNewContext(`(class Actions { ${methods} })`, context);
  const game = new Actions(), calls = [];
  const player = id => ({ id, hp: 600, maxHp: 1000, position: new THREE.Vector3(), royalJellyFlasks: 0,
    lightAttack() { calls.push(['light', this.id]); return { radius: 4, damage: 100 }; },
    heavyAttack() { calls.push(['heavy', this.id]); return { radius: 6, damage: 200 }; },
    executeSpineRip() { calls.push(['execution', this.id]); },
    struggleQTE() { calls.push(['struggle', this.id]); return false; } });
  Object.assign(game, {
    player: player('player1'), player2: player('player2'), isCoOp: true, isPlaying: true, isPaused: false, keys: {},
    dropPod: { isActive: false }, photoMode: { isActive: false }, weaponWheel: { isOpen: false }, skimmer: { isMounted: false },
    badBlood: { isDueling: false }, audio: {}, particles: {}, ui: { showAnnouncement() {}, showExecutionPrompt() {} }, waveIndex: 1,
    allyRescue: { interact(target) { calls.push(['rescue', target.id]); return { accepted: false }; } },
    operationTransport: { interact(target) { calls.push(['transport', target.id]); return false; } },
    operationObjectives: { interact(target) { calls.push(['objective', target.id]); return { accepted: false }; } },
    battlefield: { interact(target) { calls.push(['sector', target.id]); return false; } },
    env: new Proxy({}, { get(target, key) { return target[key] ?? (() => false); } }),
    sentryGun: { reloadSentry() { return { success: false, reason: 'not_near_sentry' }; } },
    bosses: { activeBoss: null }, horde: { aliens: [], struggleRoyalFacehugger(target) { calls.push(['royal-struggle', target.id]); return false; } },
    synthetics: { androids: [], checkHits() {} },
    checkCatwalkPlungingExecution() { return false; },
    scheduleAttackImpact(target) { calls.push(['impact-scheduled', target.id]); },
    firePlasmaCannon(charged, target) { calls.push(['plasma', target.id]); return true; },
    awardTrophy(victim, name, honor, target) { calls.push(['trophy', target.id, honor]); return true; },
    shiftBattlefieldMorale() {}, triggerCameraFovSurge() {}, triggerCameraShake() {},
  });
  vm.runInNewContext(`(function () { ${listenerSource} })`, context).call(game);
  assert.equal(typeof keydown, 'function');
  const press = (code = 'Enter', extra = {}) => {
    const event = { code, target: null, repeat: false, preventDefault() { this.prevented = true; }, ...extra };
    keydown(event); return event;
  };
  return { game, calls, press, HTMLElement };
}
const attacks = calls => calls.filter(([kind]) => ['light', 'heavy', 'plasma', 'impact-scheduled'].includes(kind));

for (const kind of ['bridge', 'transport', 'objective', 'prey']) {
  test(`J2 Enter reaches the existing ${kind} interaction without also attacking or affecting J1`, () => {
    const { game, calls, press } = fixture();
    const accepted = target => { calls.push([`accepted-${kind}`, target.id]); target.interactionResult = kind; return true; };
    if (kind === 'bridge') game.env.checkTacticalBridgeInteraction = accepted;
    if (kind === 'transport') game.operationTransport.interact = accepted;
    if (kind === 'objective') game.operationObjectives.interact = target => ({ accepted: accepted(target) });
    if (kind === 'prey') game.env.checkOrangeFlowerInteraction = accepted;
    const event = press();
    assert.equal(game.player2.interactionResult, kind); assert.equal(game.player.interactionResult, undefined);
    assert.deepEqual(calls.filter(([name]) => name.startsWith('accepted-')), [[`accepted-${kind}`, 'player2']]);
    assert.deepEqual(attacks(calls), []); assert.equal(event.prevented, true);
    assert.equal(calls.filter(([name]) => name === 'rescue').length, 1);
  });
}

test('a J2 rescue consumes one input before nearby objects and preserves the existing priority', () => {
  const { game, calls, press } = fixture();
  game.allyRescue.interact = target => { calls.push(['rescued', target.id]); return { accepted: true }; };
  game.env.checkTacticalBridgeInteraction = target => { calls.push(['bridge', target.id]); return true; };
  press();
  assert.deepEqual(calls, [['rescued', 'player2']]);
});

test('a living J2 can still interact and attack when J1 is dead', () => {
  const { game, calls, press } = fixture(); game.player.hp = 0;
  let nearby = true;
  game.operationObjectives.interact = target => { calls.push(['objective', target.id]); return { accepted: nearby }; };
  press(); assert.deepEqual(attacks(calls), []);
  assert.equal(calls.filter(([kind]) => kind === 'objective').length, 1);
  nearby = false; calls.length = 0; press();
  assert.deepEqual(attacks(calls), [['light', 'player2'], ['impact-scheduled', 'player2']]);
});

test('J2 falls back to one light attack after rejected interactions and no executable target', () => {
  const { game, calls, press } = fixture();
  press();
  assert.deepEqual(attacks(calls), [['light', 'player2'], ['impact-scheduled', 'player2']]);
  assert.equal(calls.filter(([name]) => name === 'rescue').length, 1);
  assert.equal(calls.filter(([name]) => name === 'objective').length, 1);
  assert.equal(game.handlePlayerInteraction(game.player2), false);
});

test('a real accepted boss execution consumes J2 Enter without a second attack', () => {
  const { game, calls, press } = fixture();
  const boss = { type: 'queen', hp: 200, maxHp: 1000, isStunned: true, mesh: { position: new THREE.Vector3(0, 0, 3) } };
  game.bosses.activeBoss = boss;
  game.bosses.executeBoss = (victim, options) => {
    assert.equal(victim, boss); assert.equal(options.player, game.player2);
    calls.push(['boss-death', options.player.id]); game.bosses.activeBoss = null; return { id: 'boss:1' };
  };
  press();
  assert.deepEqual(calls.filter(([kind]) => ['boss-death', 'execution', 'trophy'].includes(kind)),
    [['boss-death', 'player2'], ['execution', 'player2'], ['trophy', 'player2', 2500]]);
  assert.deepEqual(attacks(calls), []);
  assert.equal(game.player2.royalJellyFlasks, 2); assert.equal(game.player.royalJellyFlasks, 0);
});

test('a rejected boss execution returns false and permits the ordinary J2 attack', () => {
  const { game, calls, press } = fixture();
  game.bosses.activeBoss = { type: 'queen', hp: 200, maxHp: 1000, isStunned: true, mesh: { position: new THREE.Vector3(0, 0, 3) } };
  game.bosses.executeBoss = () => { calls.push(['execution-rejected']); return false; };
  assert.equal(game.checkTrophyExecution(game.player2), false);
  calls.length = 0; press();
  assert.equal(calls.filter(([kind]) => kind === 'execution-rejected').length, 1);
  assert.deepEqual(attacks(calls), [['light', 'player2'], ['impact-scheduled', 'player2']]);
  assert.equal(calls.some(([kind]) => kind === 'trophy'), false);
});

for (const kind of ['praetorian', 'synthetic']) {
  test(`a real ${kind} execution also consumes J2 Enter without a second attack`, () => {
    const { game, calls, press } = fixture();
    const actor = { type: kind, hp: 100, isStunned: true, mesh: { position: new THREE.Vector3(0, 0, 3) } };
    game.player2.plasmaEnergy = 10; game.player2.maxPlasmaEnergy = 100;
    if (kind === 'praetorian') {
      game.horde.aliens.push(actor); game.horde.spawnAcidPool = () => {};
      game.horde.defeatAlien = target => { assert.equal(target, actor); calls.push(['alien-death']); };
    } else {
      game.synthetics.androids.push(actor); game.synthetics.emitWhiteSyntheticBlood = () => {};
      game.synthetics.defeatSynthetic = target => { assert.equal(target, actor); calls.push(['synthetic-death']); };
    }
    press();
    assert.equal(calls.filter(([name]) => name === 'execution').length, 1);
    assert.equal(calls.filter(([name]) => name === 'trophy').length, 1);
    assert.deepEqual(attacks(calls), []);
  });
}

for (const royal of [false, true]) {
  test(`J2 Enter advances the ${royal ? 'royal' : 'ordinary'} facehugger QTE without an interaction or attack`, () => {
    const { game, calls, press } = fixture();
    game.player2[royal ? 'isRoyalFacehuggerLatched' : 'isFacehuggerLatched'] = true;
    press(); press('Numpad0'); press('NumpadDecimal');
    assert.deepEqual(calls, [[royal ? 'royal-struggle' : 'struggle', 'player2']]);
  });
}

test('pause, insertion, photo mode, weapon wheel, dead J2, held keys and focused UI reject combat interactions', () => {
  for (const state of ['paused', 'insertion', 'photo', 'wheel', 'dead', 'repeat', 'input', 'button']) {
    const { game, calls, press, HTMLElement } = fixture();
    const extra = {};
    if (state === 'paused') game.isPaused = true;
    if (state === 'insertion') game.dropPod.isActive = true;
    if (state === 'photo') game.photoMode.isActive = true;
    if (state === 'wheel') game.weaponWheel.isOpen = true;
    if (state === 'dead') game.player2.hp = 0;
    if (state === 'repeat') extra.repeat = true;
    if (state === 'input' || state === 'button') {
      extra.target = new HTMLElement();
      if (state === 'input') extra.target.matches = () => true;
      else extra.target.closest = () => ({});
    }
    press('Enter', extra);
    assert.deepEqual(calls, [], state);
  }
});

test('J2 heavy and plasma controls retain their ordinary attacks without activating nearby interactions', () => {
  const { game, calls, press } = fixture();
  game.operationObjectives.interact = target => { calls.push(['objective', target.id]); return { accepted: true }; };
  press('Numpad0'); press('NumpadDecimal');
  assert.deepEqual(calls, [['heavy', 'player2'], ['impact-scheduled', 'player2'], ['plasma', 'player2']]);
});
