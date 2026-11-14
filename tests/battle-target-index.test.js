import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { applyBattleUnit, despawnBattleActor, selectBattleTarget } from '../js/engine/BattleActorSupport.js';
import { targetingConfiguration } from '../scripts/benchmark-battle-targeting.mjs';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';

function actor(id, factionId, x, z = 0) { const mesh = new THREE.Group(); mesh.position.set(x, 0, z); return { battleUnitId: id, factionId, hp: 100, maxHp: 100, mesh }; }
const simulation = () => ({ config: { playerFaction: 'clan' }, areHostile: (a, b) => a !== b });

test('one manager frame shares a candidate index while tie order, health and diplomacy remain live', () => {
  const attacker = actor('ally', 'clan', 0), farHuman = actor('far', 'human', 20), nearHive = actor('hive', 'hive', 5), nearHuman = actor('human', 'human', 5);
  let calls = 0; const sim = simulation(), manager = { time: 1, battleSimulation: sim,
    combatActorsProvider: () => { calls++; return [farHuman, nearHive, nearHuman]; } };
  for (let i = 0; i < 16; i++) assert.equal(selectBattleTarget(manager, attacker).actor, nearHive, 'equal-distance targets preserve original provider order across faction buckets');
  assert.equal(calls, 1);
  sim.areHostile = (a, b) => a !== b && b !== 'hive';
  assert.equal(selectBattleTarget(manager, attacker).actor, nearHuman, 'a truce takes effect within the same manager frame');
  nearHuman.hp = 0; assert.equal(selectBattleTarget(manager, attacker).actor, farHuman);
  manager.time = 2; selectBattleTarget(manager, attacker); assert.equal(calls, 2);
});

test('spawn and cull invalidate a shared provider and detached live actors cannot remain targets', () => {
  const scene = new THREE.Scene(), targets = [], sim = simulation(), attacker = actor('ally', 'clan', 0);
  const provider = () => targets;
  const owner = { time: 1, scene, battleSimulation: sim, combatActorsProvider: provider }, observer = { time: 1, scene, battleSimulation: sim, combatActorsProvider: provider };
  const unit = (id, x) => ({ id, profileId: 'human', groupId: 'enemy', factionId: 'human', hp: 100, maxHp: 100, position: [x, 0] });
  const far = applyBattleUnit(owner, { mesh: new THREE.Group() }, unit('far', 20)); targets.push(far);
  assert.equal(selectBattleTarget(observer, attacker).actor, far);
  const close = applyBattleUnit(owner, { mesh: new THREE.Group() }, unit('close', 2)); targets.push(close);
  assert.equal(selectBattleTarget(observer, attacker).actor, close, 'another manager sees new allocation within the same frame');
  const snapshot = despawnBattleActor(owner, targets, 'close'); assert.equal(snapshot.hp, 100);
  assert.equal(selectBattleTarget(observer, attacker).actor, far);
  far.mesh.removeFromParent(); assert.equal(selectBattleTarget(observer, attacker), null, 'a detached manager actor is not a phantom target');
});

test('providers without a frame stamp remain uncached and extra candidates retain deduplication and precedence', () => {
  const attacker = actor('ally', 'clan', 0), first = actor('first', 'human', 2), second = actor('second', 'hive', 2), far = actor('far', 'human', 20);
  let values = [far], calls = 0; const manager = { battleSimulation: simulation(), combatActorsProvider: () => { calls++; return values; } };
  assert.equal(selectBattleTarget(manager, attacker, [second, first], [first, first]).actor, first);
  values = [second]; assert.equal(selectBattleTarget(manager, attacker, [first], [first]).actor, second); assert.equal(calls, 2);
  attacker.isDowned = true; assert.equal(selectBattleTarget(manager, attacker), null); assert.equal(calls, 2);
  attacker.isDowned = false; attacker.isRescueRecovering = true; assert.equal(selectBattleTarget(manager, attacker), null);
});

test('doubling distant armies doubles indexed candidate work without changing the detailed actor ceiling', () => {
  const small = new BattleSimulation(targetingConfiguration(128, 4)), large = new BattleSimulation(targetingConfiguration(256, 4));
  small.update(.25); large.update(.25);
  const first = small.getTargetingCounters(), second = large.getTargetingCounters();
  for (const key of ['groupVisits', 'attackerVisits', 'targetCandidateEntries', 'attacksResolved']) assert.equal(second[key], first[key] * 2, key);
  assert.equal(small.budgets.active, 32); assert.equal(large.budgets.active, 32);
  assert.equal(small.assertConservation(), true); assert.equal(large.assertConservation(), true);
  small.dispose(); large.dispose();
});
