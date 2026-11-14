import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { EnvironmentManager } from '../js/entities/Environment.js';
import { XenomorphHorde } from '../js/entities/XenomorphHorde.js';
import { TemporaryCombatEffects } from '../js/engine/TemporaryCombatEffects.js';

const audio = new Proxy({}, { get: () => () => {} });
function fixture() {
  const scene = new THREE.Scene(), env = new EnvironmentManager(scene);
  env.root = new THREE.Group(); env.referenceRoot = new THREE.Group(); env.root.add(env.referenceRoot); scene.add(env.root); env.envObjects.push(env.root);
  env.type = 'station'; env.organic = false;
  const horde = new XenomorphHorde(scene, audio);
  const actor = horde.spawnBattleUnit({ id: 'environment-victim', actorType: 'warrior', factionId: 'hive', position: [0, 0], hp: 10000, maxHp: 10000 });
  actor.speed = 13.7;
  const player = { position: new THREE.Vector3(30, 0, 0), hp: 10000, takeDamage() {} };
  return { env, horde, actor, player, clear() { env.clearEnvironment(); horde.clearWave(); } };
}
function volume(env, timer = 1) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 6, 4), new THREE.MeshBasicMaterial({ color: 0x93c5fd, transparent: true, opacity: .6 }));
  env.addReferenceObject(mesh);
  return { mesh, pos: new THREE.Vector3(), radius: 6, timer };
}
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test('nitrogen stops actual horde locomotion, expires after leaving, and cannot recolor shared creature materials', () => {
  const f = fixture(), { env, horde, actor, player } = f;
  const peer = horde.spawnBattleUnit({ id: 'outside-victim', actorType: 'warrior', factionId: 'hive', position: [40, 0], hp: 10000, maxHp: 10000 });
  const colors = new Map(); for (const root of [actor.mesh, peer.mesh]) root.traverse(node => { for (const mat of Array.isArray(node.material) ? node.material : [node.material]) if (mat?.color) colors.set(mat, mat.color.getHex()); });
  env.activeFreezeZones.push(volume(env, 2));
  try {
    env.update(.1, horde, audio, player); assert.equal(actor.speed, 0); assert.notEqual(peer.speed, 0);
    const before = actor.mesh.position.clone(); horde.update(.1, player); assert.ok(actor.mesh.position.distanceTo(before) < 1e-8);
    actor.mesh.position.x = 20; env.update(1, horde, audio, player); assert.equal(actor.speed, 0);
    env.update(3.51, horde, audio, player); near(actor.speed, 13.7); assert.equal(env.environmentCombatEffects.targets.size, 0);
    const released = actor.mesh.position.clone(); horde.update(.1, player); assert.ok(actor.mesh.position.distanceTo(released) > .1);
    for (const [material, color] of colors) assert.equal(material.color.getHex(), color);
    for (const root of [actor.mesh, peer.mesh]) root.traverse(node => assert.equal(Object.hasOwn(node, 'origColor'), false));
    assert.equal(Object.hasOwn(actor, 'isFrozen'), false);
  } finally { f.clear(); }
});

test('environment freeze respects pause and clear restores the current base while another hunter slow remains owned', () => {
  const f = fixture(), { env, horde, actor, player } = f, hunter = new TemporaryCombatEffects();
  env.activeFreezeZones.push(volume(env, .5));
  try {
    hunter.slow(actor, 'gadget', .4, 10); env.update(.1, horde, audio, player); assert.equal(actor.speed, 0);
    env.game = { isPaused: true }; env.update(10, horde, audio, player); assert.equal(actor.speed, 0);
    env.game.isPaused = false; env.game.photoMode = { isActive: true }; env.update(10, horde, audio, player); assert.equal(actor.speed, 0);
    env.game.photoMode.isActive = false;
    actor.speed = 17; env.update(.1, horde, audio, player); assert.equal(actor.speed, 0);
    env.clearEnvironment(); near(actor.speed, 17 * .4); assert.equal(env.environmentCombatEffects.targets.size, 0);
    hunter.dispose(); near(actor.speed, 17);
  } finally { hunter.dispose(); f.clear(); }
});

test('steam contacts do not compound per-frame speed and transformer recovery never guesses a species default', () => {
  const f = fixture(), { env, horde, actor, player } = f;
  env.steamConduits.push({ isRuptured: true, steamTimer: 2, pos: new THREE.Vector3() });
  try {
    for (let frame = 0; frame < 30; frame++) env.update(1 / 60, horde, audio, player);
    near(actor.speed, 13.7 * .7);
    actor.mesh.position.x = 20; env.update(.3, horde, audio, player); near(actor.speed, 13.7);
    env.transformers.push({ pos: actor.mesh.position.clone(), coreMesh: { material: { color: new THREE.Color() } } });
    assert.equal(env.checkTransformerHits(actor.mesh.position, 1, null, horde, audio), true); near(actor.speed, 13.7 * .2);
    actor.speed = 19.2; env.update(4.01, horde, audio, player); near(actor.speed, 19.2);
    assert.equal(env.referenceTimers.length, 0, 'there is no guessed-speed callback left waiting to fire');
  } finally { f.clear(); }
});

test('cooling tower motor freeze has a finite exit and leaves actor materials untouched', () => {
  const f = fixture(), { env, horde, actor, player } = f;
  env.coolingTowerCryoVent = { isFlushing: true, flushTimer: 1, radius: 18, pos: new THREE.Vector3() };
  try {
    env.updateCoolingTowerCryoVent(.1, player, horde); assert.equal(actor.speed, 0);
    actor.mesh.position.x = 30; env.updateCoolingTowerCryoVent(1, player, horde); env.update(6.1, horde, audio, player);
    near(actor.speed, 13.7); assert.equal(env.environmentCombatEffects.targets.size, 0);
    assert.equal(Object.hasOwn(actor, 'isFlashFrozen'), false);
  } finally { f.clear(); }
});

for (const kind of ['stasis', 'ammonia', 'freon', 'tar']) test(`${kind}: leaving a damaging coolant volume releases its actual slow without stale frozen flags`, () => {
  const f = fixture(), { env, horde, actor, player } = f, cloud = volume(env, 2);
  const multiplier = kind === 'ammonia' ? 0 : kind === 'tar' ? .2 : .3;
  let apply;
  if (kind === 'stasis') { env.activeCryoCoolantClouds.push(cloud); apply = delta => env.updateStasisTanks(delta, player, horde); }
  else if (kind === 'ammonia') { env.activeAmmoniaClouds.push(cloud); apply = delta => env.updateAmmoniaClouds(delta, horde); }
  else if (kind === 'freon') { env.activeFreonClouds.push(cloud); apply = delta => env.updateLevelDesignV56(delta, player, horde); }
  else { env.activeTarPuddles.push(cloud); apply = delta => env.updateLevelDesignV56(delta, player, horde); }
  try {
    apply(.1); near(actor.speed, 13.7 * multiplier);
    actor.mesh.position.x = 30; env.update(.3, horde, audio, player); apply(.3); near(actor.speed, 13.7);
    actor.mesh.position.set(0, 0, 0); apply(.1); near(actor.speed, 13.7 * multiplier);
    actor.hp = 0; env.update(.1, horde, audio, player); assert.equal(env.environmentCombatEffects.targets.size, 0);
    assert.equal(Object.hasOwn(actor, 'isFrozen'), false); assert.equal(Object.hasOwn(actor, 'speedMult'), false);
  } finally { f.clear(); }
});

test('the actual inhibitor uses a finite current-base effect and announces only its implemented consequence', () => {
  const f = fixture(), { env, horde, actor, player } = f, messages = [];
  const ui = { showAnnouncement(message) { messages.push(message); } };
  env.neuralInhibitors.push({ pos: player.position.clone(), cooldown: 0 });
  try {
    assert.equal(env.checkNeuralInhibitorInteraction(player, horde, ui), true); near(actor.speed, 13.7 * .4);
    env.update(16.1, horde, audio, player); near(actor.speed, 13.7);
    assert.ok(messages.every(message => !message.includes('CRACHAT ACIDE BLOQUÉ')));
    assert.equal(Object.hasOwn(actor, 'speedMult'), false); assert.equal(Object.hasOwn(actor, 'isInhibited'), false);
  } finally { f.clear(); }
});

for (const kind of ['hvac', 'locker', 'tar']) test(`${kind}: the actual prop interaction expires without overwriting species or phase speed`, () => {
  const f = fixture(), { env, horde, actor, player } = f;
  const ui = { showAnnouncement() {} };
  try {
    let duration, multiplier;
    if (kind === 'hvac') {
      env.hvacChillers.push({ pos: new THREE.Vector3(), isRuptured: false });
      assert.equal(env.checkHVACChillerDamage(new THREE.Vector3(), 50, audio, horde, null, ui), true);
      duration = .3; multiplier = .3;
    } else if (kind === 'locker') {
      env.meatLockerFacility = { pos: new THREE.Vector3(), valvePos: player.position.clone(), cooldown: 0 };
      assert.equal(env.checkMeatLockerCryoValve(player, ui, audio, horde), true);
      duration = 6.1; multiplier = .2;
    } else {
      env.boilingTarKettle = { pos: new THREE.Vector3(), isSpilled: false };
      assert.equal(env.checkBoilingTarSpillDamage(new THREE.Vector3(), 50, audio, horde, null, null, ui), true);
      duration = 5.1; multiplier = .15;
    }
    near(actor.speed, 13.7 * multiplier);
    actor.mesh.position.x = 30; actor.speed = 18.3;
    env.update(duration, horde, audio, player); horde.update(duration, player);
    near(actor.speed, 18.3); assert.equal(actor.isStunned === true, false);
    assert.equal(Object.hasOwn(actor, 'speedMult'), false); assert.equal(Object.hasOwn(actor, 'isFrozen'), false);
  } finally { f.clear(); }
});
