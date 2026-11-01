import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Player } from '../js/entities/Player.js';
import { CHARACTERS_DATA } from '../js/data/charactersData.js';
import { XenomorphHorde } from '../js/entities/XenomorphHorde.js';
import { BossManager } from '../js/entities/Bosses.js';
import { CombatEvents } from '../js/engine/CombatEvents.js';
import { TemporaryCombatEffects } from '../js/engine/TemporaryCombatEffects.js';
import { selectBattleTarget } from '../js/engine/BattleActorSupport.js';
import { canDetectConcealedTarget, createHunterStealthAttack, canExecuteCombatTarget } from '../js/engine/HunterStealth.js';

const audio = new Proxy({}, { get: () => () => {} });
class OfflinePlayer extends Player { loadGeneratedVisual() { return Promise.resolve(false); } }
class CPUBoss extends BossManager { createBossMesh() { return new THREE.Mesh(new THREE.BoxGeometry(2, 4, 2), new THREE.MeshBasicMaterial()); } }
const hunter = () => new OfflinePlayer(new THREE.Scene(), CHARACTERS_DATA.find(data => data.id === 'jungle_hunter'), audio);
const target = (id, position, hp = 1000) => ({ battleUnitId: id, factionId: 'hive', hp, maxHp: hp,
  type: 'warrior', radius: 1, speed: 13.7, mesh: new THREE.Group() });
const simulation = { config: { playerFaction: 'clan' }, areHostile: (a, b) => a !== b };

test('a concealed hunter can pass a remote defender, but proximity, firing and damage reveal it', () => {
  const player = hunter(), observer = target('guard'); observer.mesh.position.set(0, 0, 12);
  const manager = { battleSimulation: simulation, combatActorsProvider: () => [player], time: 1 };
  try {
    player.isCloaked = true;
    assert.equal(selectBattleTarget(manager, observer, [player]), null);
    observer.mesh.position.z = 6; assert.equal(selectBattleTarget(manager, observer, [player]), player);
    observer.mesh.position.z = 12;
    assert.ok(player.firePlasmaShot()); assert.equal(selectBattleTarget(manager, observer, [player]), player);
    player.update(3.1); assert.equal(selectBattleTarget(manager, observer, [player]), null);
    const hp = player.hp; player.takeDamage(10); assert.equal(player.hp, hp - 5, 'cloak retains its prior reduction, not immunity');
    assert.equal(selectBattleTarget(manager, observer, [player]), player);
  } finally { player.dispose(); }
});

test('acquisition uses distinct close senses and never sees a concealed hunter through cover', () => {
  const player = { hp: 1000, isCloaked: true, position: new THREE.Vector3() };
  const observer = target('guard'); observer.mesh.position.z = 4;
  observer.type = 'marine'; assert.equal(canDetectConcealedTarget(observer, player), false);
  observer.type = 'working_joe'; assert.equal(canDetectConcealedTarget(observer, player), true);
  assert.equal(canDetectConcealedTarget(observer, player, { hasLineOfSight: () => false }), false);
  observer.type = 'warrior'; observer.mesh.position.z = 6.5; assert.equal(canDetectConcealedTarget(observer, player), true);
  observer.mesh.position.z = 8; assert.equal(canDetectConcealedTarget(observer, player), false);
  observer.definition = {}; assert.equal(canDetectConcealedTarget(observer, player), true);
});

test('one rear ambush changes real manager damage and records one death without extra trophy currency', () => {
  const player = hunter(), horde = new XenomorphHorde(new THREE.Scene(), audio), ledger = new CombatEvents({ runId: 'ambush' });
  horde.battleSimulation = simulation; horde.combatEvents = ledger;
  horde.environment = { hasLineOfSight: () => true };
  horde.spawnAcidSplash = horde.spawnAcidPool = horde.spawnChestburster = horde.spawnZeroGAcidGlobule = () => {};
  const first = target('first', null, 200), second = target('second', null, 1000);
  first.mesh.position.z = 2; second.mesh.position.z = 3;
  horde.aliens.push(first, second); horde.scene.add(first.mesh, second.mesh);
  try {
    player.isCloaked = true;
    const move = player.lightAttack(); assert.equal(move.stealthPrepared, true);
    const attack = createHunterStealthAttack(player, { ...move, origin: player.position, radius: 5, damage: 100 }, horde);
    assert.equal(attack.ambushTargetId, 'first');
    const hits = horde.checkMeleeHits(attack);
    assert.equal(first.hp, 0); assert.equal(second.hp, 900);
    assert.ok(hits.some(hit => hit.damage === 250));
    assert.equal(ledger.getSnapshot().deaths.length, 1); assert.equal(hits.filter(hit => hit.killed).length, 1);
    assert.equal(player.trophiesCollected.length, 0);
    assert.equal(player.lightAttack(), null, 'the initial swing still observes the normal attack window');
  } finally { player.dispose(); horde.clearWave(); }
});

test('frontal, already alerted, friendly, elevated and covered targets do not grant a rear bonus', () => {
  const player = hunter(), actor = target('guard'); actor.mesh.position.z = 2;
  const horde = { aliens: [actor], battleSimulation: simulation, environment: { hasLineOfSight: () => true } };
  const attack = { stealthPrepared: true, damage: 100, radius: 5 };
  try {
    player.isCloaked = true;
    actor.mesh.rotation.y = Math.PI; assert.equal(createHunterStealthAttack(player, attack, horde), attack);
    actor.mesh.rotation.y = 0; actor._npcTarget = player; assert.equal(createHunterStealthAttack(player, attack, horde), attack);
    actor._npcTarget = null; actor.factionId = 'clan'; assert.equal(createHunterStealthAttack(player, attack, horde), attack);
    actor.factionId = 'hive'; actor.mesh.position.y = 3; assert.equal(createHunterStealthAttack(player, attack, horde), attack);
    actor.mesh.position.y = 0; horde.environment.hasLineOfSight = () => false; assert.equal(createHunterStealthAttack(player, attack, horde), attack);
  } finally { player.dispose(); }
});

test('awareness is captured before the committed windup reveals the hunter', () => {
  const player = hunter(), actor = target('unaware'), previousWindow = globalThis.window;
  actor.mesh.position.z = 2;
  const horde = { aliens: [actor] }; globalThis.window = { gameInstance: { horde } };
  try {
    player.isCloaked = true;
    const attack = player.lightAttack();
    assert.equal(attack.stealthUnawareTargets.has(actor), true);
    actor._npcTarget = player; // The normal AI acquires the exposed attack during windup.
    const hit = createHunterStealthAttack(player, { ...attack, origin: player.position, radius: 5, damage: 100 }, horde);
    assert.equal(hit.ambushTargetId, 'unaware');
  } finally { globalThis.window = previousWindow; player.dispose(); }
});

test('overlapping slows, refreshes and both hunters restore the exact authored speed', () => {
  const a = new TemporaryCombatEffects(), b = new TemporaryCombatEffects(), actor = target('slow');
  assert.equal(a.slow(actor, 'gas', .7, 1), true); assert.equal(actor.speed, 13.7 * .7);
  a.slow(actor, 'gas', .7, 1); assert.equal(actor.speed, 13.7 * .7);
  b.slow(actor, 'anti-grav', .2, 2); assert.equal(actor.speed, 13.7 * .2);
  a.update(1.1); assert.equal(actor.speed, 13.7 * .2);
  a.dispose(); assert.equal(actor.speed, 13.7 * .2);
  b.update(2.1); assert.equal(actor.speed, 13.7);
  assert.equal(a.targets.size + b.targets.size, 0);
});

test('disposing a slow owner releases its contribution and respects a newly authored speed', () => {
  const effects = new TemporaryCombatEffects(), actor = target('phase');
  effects.slow(actor, 'gas', .7, 2); actor.speed = 20;
  effects.update(.2); assert.equal(actor.speed, 14);
  effects.dispose(); assert.equal(actor.speed, 20); assert.equal(effects.targets.size, 0);
});

test('actual anti-gravity and repeated neurotoxin ticks expire without a permanently crippled enemy', () => {
  const player = hunter(), actor = target('gas'); actor.mesh.position.z = 12;
  const horde = { aliens: [actor], battleSimulation: simulation };
  const synthetic = { ...target('synth'), factionId: 'clan' }; synthetic.mesh.position.z = 12;
  const synthetics = { androids: [synthetic], battleSimulation: simulation };
  const environment = { hasLineOfSight: () => true };
  try {
    assert.equal(player.deployAntiGravDisruptor(horde, null, null), true); assert.equal(actor.speed, 13.7 * .2);
    assert.equal(player.throwNeurotoxinCanister(horde, null, synthetics, null, null, environment), true);
    for (let i = 0; i < 18; i++) player.update(.5);
    assert.equal(actor.speed, 13.7); assert.equal(synthetic.hp, 1000, 'allied synthetic is not poisoned');
    assert.equal(player._temporaryCombatEffects.targets.size, 0);
  } finally { player.dispose(); }
});

test('the short execution pose protects only its owner, ends, and cannot be refreshed during the same pose', () => {
  const player = hunter(), other = hunter();
  try {
    assert.ok(player.executeSpineRip('human')); assert.equal(player.executeSpineRip('human'), false);
    player.takeDamage(100); other.takeDamage(100);
    assert.equal(player.hp, player.maxHp); assert.equal(other.hp, other.maxHp - 100);
    player.update(2.21); player.takeDamage(100); assert.equal(player.hp, player.maxHp - 100);
  } finally { player.dispose(); other.dispose(); }
});

test('boss execution refuses a wall, an expired window and truce; a different encounter stays alive', () => {
  const manager = new CPUBoss(new THREE.Scene(), audio), other = new CPUBoss(new THREE.Scene(), audio), player = hunter();
  manager.spawnBoss('xenomorph_queen', new THREE.Vector3(0, 0, 2)); other.spawnBoss('praetorian', new THREE.Vector3(20, 0, 0));
  const victim = manager.activeBoss, survivor = other.activeBoss;
  victim.hp = victim.maxHp * .25;
  try {
    assert.equal(manager.executeBoss(victim, { player }), null);
    victim.isStunned = true; victim.stunTimer = 2; manager.environment = { hasLineOfSight: () => false };
    assert.equal(manager.executeBoss(victim, { player }), null);
    manager.environment.hasLineOfSight = () => true; victim.factionId = 'clan'; manager.battleSimulation = simulation;
    assert.equal(manager.executeBoss(victim, { player }), null);
    victim.factionId = 'hive'; assert.ok(manager.executeBoss(victim, { player }));
    assert.equal(other.activeBoss, survivor); assert.equal(survivor.hp, survivor.maxHp);
  } finally { manager.clear(); other.clear(); player.dispose(); }
});

test('executions cannot use corpses, another floor or an active facehugger to bypass approach', () => {
  const player = hunter(), victim = target('victim'); victim.mesh.position.z = 3;
  try {
    assert.equal(canExecuteCombatTarget(player, victim, { range: 4 }), true);
    victim.hp = 0; assert.equal(canExecuteCombatTarget(player, victim, { range: 4 }), false);
    victim.hp = 100; victim.mesh.position.y = 5; assert.equal(canExecuteCombatTarget(player, victim, { range: 4 }), false);
    victim.mesh.position.y = 0; player.isFacehuggerLatched = true;
    assert.equal(canExecuteCombatTarget(player, victim, { range: 4 }), false);
  } finally { player.dispose(); }
});

test('facehugger hold has a fixed deadline and a short escape immunity, with a visible exit', () => {
  const player = hunter();
  try {
    player.triggerFacehuggerLatch(); assert.equal(player.isFacehuggerLatched, true);
    player.update(3); const remaining = player.facehuggerHoldTimer; player.triggerFacehuggerLatch();
    assert.equal(player.facehuggerHoldTimer, remaining); assert.match(player.getCombatState().impairments[0].exit, /E/);
    player.update(9.01); assert.equal(player.isFacehuggerLatched, false); assert.ok(player.hp > 0);
    assert.equal(player.triggerFacehuggerLatch(), false);
    player.update(2.51); player.triggerFacehuggerLatch();
    for (let i = 0; i < 5; i++) player.struggleQTE();
    assert.equal(player.isFacehuggerLatched, false); assert.equal(player.getCombatState().impairments.length, 0);
  } finally { player.dispose(); }
});

test('royal struggle belongs to its real P2 victim and removes one parasite through the death ledger', () => {
  const player = hunter(), second = hunter(), horde = new XenomorphHorde(new THREE.Scene(), audio);
  horde.combatEvents = new CombatEvents({ runId: 'royal-qte' }); horde.spawnAcidPool = () => {};
  horde.spawnRoyalFacehugger(new THREE.Vector3()); const parasite = horde.royalFacehuggers[0];
  Object.assign(parasite, { type: 'royal_facehugger', isLatched: true, latchedTo: second, latchTimer: 5 });
  second.isRoyalFacehuggerLatched = true; second.royalFacehuggerHoldTimer = 5;
  try {
    assert.equal(horde.struggleRoyalFacehugger(player), false); assert.equal(parasite.struggleCount, 0);
    for (let i = 0; i < 8; i++) assert.equal(horde.struggleRoyalFacehugger(second), true);
    assert.equal(second.isRoyalFacehuggerLatched, false); assert.equal(horde.royalFacehuggers.length, 0);
    assert.equal(horde.combatEvents.getSnapshot().deaths.length, 1); assert.equal(parasite._combatDisposed, true);
    assert.equal(horde.struggleRoyalFacehugger(second), false);
  } finally { player.dispose(); second.dispose(); horde.clearWave(); }
});

test('royal hold expires without a new target and cleanup releases its victim flag', () => {
  const player = hunter(), horde = new XenomorphHorde(new THREE.Scene(), audio);
  try {
    horde.spawnRoyalFacehugger(new THREE.Vector3()); const parasite = horde.royalFacehuggers[0];
    Object.assign(parasite, { isLatched: true, latchedTo: player, latchTimer: .5 });
    player.isRoyalFacehuggerLatched = true;
    horde._pursuitTarget = () => null;
    horde._updateExtraActors(.6, [player]);
    assert.equal(player.isRoyalFacehuggerLatched, false); assert.equal(horde.royalFacehuggers.length, 0);
    horde.spawnRoyalFacehugger(new THREE.Vector3()); Object.assign(horde.royalFacehuggers[0], { isLatched: true, latchedTo: player, latchTimer: 5 });
    player.isRoyalFacehuggerLatched = true; horde.clearWave();
    assert.equal(player.isRoyalFacehuggerLatched, false); assert.equal(player.royalFacehuggerHoldTimer, 0);
  } finally { player.dispose(); horde.clearWave(); }
});
