import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CombatDirector } from '../js/engine/CombatDirector.js';
import { selectHostileTarget, requestHostileAttack, syncHostileWarning } from '../js/engine/HostilePressure.js';
import { XenomorphHorde } from '../js/entities/XenomorphHorde.js';
import { SyntheticsManager } from '../js/entities/Synthetics.js';
import { BossManager } from '../js/entities/Bosses.js';
import { BadBloodManager } from '../js/entities/BadBloodEncounter.js';

const audio = new Proxy({}, { get: () => () => {} });
const player = (x, z = 0) => ({ hp: 1000, position: new THREE.Vector3(x, 0, z), mesh: new THREE.Group(),
  isCloaked: false, hits: [], takeDamage(amount) { this.hits.push(amount); this.hp -= amount; } });
const actor = (type = 'warrior') => ({ type, hp: 120, maxHp: 120, speed: 7, radius: 1,
  damage: 25, mesh: new THREE.Group(), isAirborne: false, isLeaping: false });
class CPUSynthetics extends SyntheticsManager { createSyntheticMesh() { return new THREE.Group(); } }
class CPUBoss extends BossManager { createBossMesh() { return new THREE.Group(); } }
class CPUBadBlood extends BadBloodManager { createBadBloodMesh() { return new THREE.Group(); } }

test('legacy selection excludes a distant cloaked P1, chooses visible P2 and never reinstates a hidden fallback', () => {
  const p1 = player(12), p2 = player(0, 20), observer = actor('working_joe'); p1.isCloaked = true;
  const director = new CombatDirector({ graceSeconds: 0 }), manager = { combatDirector: director, androids: [observer] };
  director.update(0, [p1, p2]);
  assert.equal(selectHostileTarget(manager, observer, p1), p2);
  assert.equal(selectHostileTarget(manager, observer.mesh.position, p1), p2, 'old callers still recover the real observer');
  director.update(0, [p1]); assert.equal(selectHostileTarget(manager, observer, p1), null);
  const standalone = { androids: [observer] };
  assert.equal(selectHostileTarget(standalone, observer, p1), null);
});

test('legacy acquisition keeps each actor sense, nearby cover and the attack reveal deadline', () => {
  const p1 = player(4), observer = actor('marine'); p1.isCloaked = true;
  const manager = { environment: { hasLineOfSight: () => true } };
  assert.equal(selectHostileTarget(manager, observer, p1), null);
  observer.type = 'working_joe'; assert.equal(selectHostileTarget(manager, observer, p1), p1);
  manager.environment.hasLineOfSight = () => false; assert.equal(selectHostileTarget(manager, observer, p1), null);
  manager.environment.hasLineOfSight = () => true;
  p1.position.x = 12; p1.stealthRevealTimer = 3; assert.equal(selectHostileTarget(manager, observer, p1), p1);
  p1.stealthRevealTimer = 0; assert.equal(selectHostileTarget(manager, observer, p1), null);
  observer.definition = {}; p1.position.x = 9; assert.equal(selectHostileTarget(manager, observer, p1), p1);
});

test('losing perception releases a director windup, warning geometry and local preparation before retargeting P2', () => {
  const p1 = player(12), p2 = player(0, 20), observer = actor('working_joe');
  const director = new CombatDirector({ graceSeconds: 0 }), manager = { combatDirector: director };
  director.update(0, [p1, p2]);
  assert.equal(requestHostileAttack(manager, observer, p1, .1, { kind: 'shot', windup: 1 }), false);
  syncHostileWarning(manager, observer); const warning = observer.attackWarning;
  let disposals = 0; warning.geometry.addEventListener('dispose', () => disposals++);
  observer._npcTarget = p1; observer._npcPreparation = .8;
  p1.isCloaked = true;
  assert.equal(selectHostileTarget(manager, observer, p1), p2);
  assert.equal(director.getAttackState(observer), null); assert.equal(observer._npcPreparation, 0);
  assert.equal(observer._npcTarget, null); assert.equal(observer.attackWarning, null); assert.equal(disposals, 1);
  const local = { _localAttackPreparation: null, ...actor('marine') };
  p1.isCloaked = false; requestHostileAttack({}, local, p1, .8, { kind: 'shot', windup: 1 });
  p1.isCloaked = true; assert.equal(requestHostileAttack({}, local, p1, .8, { kind: 'shot', windup: 1 }), false);
  assert.equal(local._localAttackPreparation, null);
});

test('a hunt-mode horde really moves toward visible P2 instead of the nearer camouflaged P1', () => {
  const horde = new XenomorphHorde(new THREE.Scene(), audio), p1 = player(12), p2 = player(0, 20), warrior = actor();
  p1.isCloaked = true; horde.aliens.push(warrior); horde.scene.add(warrior.mesh);
  try {
    assert.equal(horde.battleSimulation, undefined);
    assert.equal(horde._pursuitTarget(warrior, [p1, p2]), p2);
    for (let frame = 0; frame < 30; frame++) horde.update(1 / 60, p1, p2);
    assert.ok(warrior.mesh.position.z > 2); assert.ok(Math.abs(warrior.mesh.position.x) < .01);
    assert.equal(p1.hits.length, 0);
    p2.hp = 0; const previous = warrior.mesh.position.clone(); horde.update(1 / 60, p1, p2);
    assert.ok(warrior.mesh.position.distanceTo(previous) < .01);
    p1.position.copy(warrior.mesh.position).add(new THREE.Vector3(0, 0, 6));
    assert.equal(horde._pursuitTarget(warrior, [p1]), p1, 'near scent still detects the cloak');
  } finally { horde.clearWave(); }
});

test('a standalone horde clears pending preparation when the target cloaks out of its senses', () => {
  const horde = new XenomorphHorde(new THREE.Scene(), audio), p1 = player(2), warrior = actor();
  try {
    horde._simulationDelta = .1;
    assert.equal(horde._requestAttack(warrior, p1, { windup: 1 }), false);
    assert.ok(warrior._npcPreparation > 0);
    p1.isCloaked = true; p1.position.x = 20;
    assert.equal(horde._pursuitTarget(warrior, [p1]), null); assert.equal(warrior._npcPreparation, 0);
    assert.equal(horde._requestAttack(warrior, p1, { windup: 1 }), false);
    assert.equal(warrior._npcTarget, null);
    p1.stealthRevealTimer = 3;
    assert.equal(horde._pursuitTarget(warrior, [p1]), p1);
    assert.equal(horde._requestAttack(warrior, p1, { windup: 1 }), false, 'revealing does not restore an old nearly completed strike');
  } finally { horde.clearWave(); }
});

test('the chestburster hunt route also waits when its only player is outside camouflage acquisition', () => {
  const horde = new XenomorphHorde(new THREE.Scene(), audio), p1 = player(20), cb = actor('chestburster');
  p1.isCloaked = true; horde.chestbursters.push(cb); horde.scene.add(cb.mesh);
  try {
    horde.update(.1, p1); assert.deepEqual(cb.mesh.position.toArray(), [0, 0, 0]);
    p1.stealthRevealTimer = 3; horde.update(.1, p1); assert.ok(cb.mesh.position.x > 0);
  } finally { horde.clearWave(); }
});

for (const kind of ['synthetic', 'boss', 'bad_blood']) test(`the real legacy ${kind} manager follows visible P2 with P1 cloaked`, () => {
  const scene = new THREE.Scene(), p1 = player(12), p2 = player(0, 20), director = new CombatDirector({ graceSeconds: 0 });
  p1.isCloaked = true; director.update(0, [p1, p2]);
  const manager = kind === 'synthetic' ? new CPUSynthetics(scene, audio) : kind === 'boss' ? new CPUBoss(scene, audio) : new CPUBadBlood(scene, audio);
  manager.combatDirector = director;
  let observer;
  if (kind === 'synthetic') { manager.spawnSquad(new THREE.Vector3(), 1); observer = manager.androids[0]; }
  else if (kind === 'boss') { manager.spawnBoss('xenomorph_queen', new THREE.Vector3()); observer = manager.activeBoss; }
  else { manager.spawnAmbush(new THREE.Vector3()); observer = manager.badBlood; }
  observer.mesh.position.set(0, 0, 0);
  try {
    manager.update(.1, p1, kind === 'bad_blood' ? null : { aliens: [] });
    assert.ok(observer.mesh.position.z > 0, 'actual movement follows the visible cooperative participant');
    assert.ok(Math.abs(observer.mesh.position.x) < .01);
    assert.equal(p1.hits.length, 0);
  } finally { kind === 'synthetic' ? manager.clearSquad() : manager.clear(); }
});
