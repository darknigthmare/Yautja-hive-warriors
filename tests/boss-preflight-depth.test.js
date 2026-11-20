import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BossManager } from '../js/entities/Bosses.js';
import { BOSS_REGISTRY } from '../js/data/BossRegistry.js';
import { prepareBossEncounter, validateOperationBossConfiguration } from '../js/data/BossEncounterValidation.js';
import { LEVELS_DATA } from '../js/data/levelsData.js';
import { BATTLE_OPERATIONS, getBattleOperationConfig } from '../js/data/BattleCatalog.js';
import { getBattlefieldMapVariant } from '../js/data/BattlefieldMapVariants.js';
import { EnvironmentManager } from '../js/entities/Environment.js';
import { CombatEvents } from '../js/engine/CombatEvents.js';
import { XenomorphHorde } from '../js/entities/XenomorphHorde.js';

const audio = new Proxy({}, { get: () => () => {} });
const player = position => ({ hp: 100000, position: new THREE.Vector3(...position), mesh: new THREE.Group(), plasmaEnergy: 100, radius: 1,
  takeDamage(amount) { this.hp -= amount; } });
const tick = (manager, target, seconds, horde = null) => { for (let frame = 0; frame < Math.round(seconds * 60); frame++) manager.update(1 / 60, target, horde); };

test('preflight refuses identity, profile, renderer and level mismatches before a scene changes', () => {
  const level = LEVELS_DATA.find(row => row.id === 'la_rooftops'), descriptor = prepareBossEncounter({ level });
  assert.equal(descriptor.bossType, 'city_hunter_boss'); assert.equal(descriptor.modelId, descriptor.combatId); assert.equal(Object.isFrozen(descriptor), true);
  assert.throws(() => prepareBossEncounter({ level, bossType: 'feral_predator_boss' }), /differs/);
  assert.throws(() => prepareBossEncounter({ level: { ...level, bossType: 'feral_predator_boss' } }), /not assigned/);
  assert.throws(() => prepareBossEncounter({ level: { ...level, bossType: '__proto__' } }), /Unknown/);
  assert.equal(prepareBossEncounter({ level, bossType: 'feral_predator_boss', mode: 'sandbox' }).bossType, 'feral_predator_boss');
  const manager = new BossManager(new THREE.Scene(), audio); manager.spawnBoss('xenomorph_queen', new THREE.Vector3()); const old = manager.activeBoss;
  assert.throws(() => manager.spawnBoss('city_hunter_boss', new THREE.Vector3(), { ...descriptor, modelId: 'feral_predator_boss' }), /contract changed/);
  assert.equal(manager.activeBoss, old);
  const build = manager.createBossMesh; manager.createBossMesh = () => { throw new Error('model unavailable'); };
  assert.throws(() => manager.spawnBoss('city_hunter_boss', new THREE.Vector3(), descriptor), /model unavailable/);
  assert.equal(manager.activeBoss, old); assert.equal(old.mesh.parent, manager.scene); manager.createBossMesh = build; manager.clear();
  const config = getBattleOperationConfig('AFF-27'), operationLevel = LEVELS_DATA.find(row => row.id === getBattlefieldMapVariant(BATTLE_OPERATIONS.find(row => row.id === 'AFF-27').mapId).baseLevelId);
  const bossProfile = config.profiles.find(profile => profile.actorType === 'queen'); bossProfile.sourceBossType = 'feral_predator_boss';
  assert.throws(() => validateOperationBossConfiguration(config, operationLevel), /species|queen renderer/);
});

test('all 25 playable operation allocations are validated without replacing two explicitly unavailable human controllers', () => {
  let majors = 0, minis = 0, checked = 0;
  for (const operation of BATTLE_OPERATIONS) {
    if (operation.requiresHumanController) { assert.throws(() => getBattleOperationConfig(operation.id), /human controller/); continue; }
    const level = LEVELS_DATA.find(row => row.id === getBattlefieldMapVariant(operation.mapId).baseLevelId), config = getBattleOperationConfig(operation.id);
    const result = validateOperationBossConfiguration(config, level); assert.equal(result.identitiesChecked, config.groups.reduce((sum, group) => sum + group.units.length, 0));
    majors += result.major.length; minis += result.mini.length; checked++;
  }
  assert.equal(checked, 25); assert.equal(majors, 1); assert.equal(minis, 1);
});

test('all 18 actual models place their lowest surface at the actor feet without changing their allocated height', () => {
  const manager = new BossManager(new THREE.Scene(), audio);
  for (const definition of Object.values(BOSS_REGISTRY)) {
    manager.spawnBoss(definition.id, new THREE.Vector3(50, 3, -20)); const boss = manager.activeBoss; boss.mesh.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(boss.mesh, true);
    assert.ok(Math.abs(box.min.y - 3) < 1e-4, definition.id); assert.ok(Math.abs(box.max.y - 3 - definition.height) < 1e-4, definition.id);
    assert.deepEqual(boss.mesh.position.toArray(), [50, 3, -20]); assert.equal(boss.type, definition.id); assert.ok(boss.visualModel.isObject3D);
    let meshes = 0, triangles = 0; boss.mesh.traverse(node => { if (node.isMesh) { meshes++; triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3; } });
    assert.ok(meshes > 5 && triangles > 100, definition.id); manager.clear(); assert.equal(manager.scene.children.length, 0);
  }
  manager.spawnBoss('queen', new THREE.Vector3()); assert.equal(manager.activeBoss.type, 'xenomorph_queen'); manager.clear();
});

for (const level of LEVELS_DATA) test(`${level.id}: its announced actual boss constructs, runs both later phases, dies once and releases the built context`, () => {
  const scene = new THREE.Scene(), environment = new EnvironmentManager(scene); environment.buildLevelEnvironment(level);
  for (const gate of environment.battlefieldLayout.gates) environment.openGate(gate.id);
  const center = environment.battlefieldLayout.sectors.at(-1).center, manager = new BossManager(scene, audio), events = new CombatEvents({ runId: level.id });
  manager.environment = environment; manager.combatEvents = events;
  const descriptor = prepareBossEncounter({ level }); manager.spawnBoss(descriptor.bossType, new THREE.Vector3(center[0], 0, center[1]), descriptor);
  const boss = manager.activeBoss, target = player([center[0], 0, center[1] + 14]);
  const horde = { spawnChestburster() {} }; tick(manager, target, 3, horde);
  for (let hit = 0; boss.hp > boss.maxHp * .6 + 1e-6 && hit < 12; hit++) manager.takeDamage(boss.maxHp * .1, horde);
  assert.equal(boss.phase, 2); tick(manager, target, 2, horde);
  for (let hit = 0; boss.hp > boss.maxHp * .25 && hit < 24; hit++) manager.takeDamage(boss.maxHp * .05, horde);
  assert.equal(boss.phase, 3); tick(manager, target, 4, horde);
  assert.ok(target.hp > 0); assert.ok(boss.mesh.position.toArray().every(Number.isFinite)); assert.equal(manager.getEncounterReadout().bossType, descriptor.modelId);
  const death = manager.takeDamage(1e7, horde); assert.equal(death.kind, descriptor.combatId); assert.equal(manager.activeBoss, null);
  assert.equal(events.getSnapshot().deaths.length, 1); assert.equal(manager.takeDamage(1e7), null);
  manager.clear(); environment.clearEnvironment(); assert.equal(scene.children.length, 0);
});

test('two actual miniature encounters retain separate HP, positions and targets when the major encounter appears and clears', () => {
  const scene = new THREE.Scene(), horde = new XenomorphHorde(scene, audio), manager = new BossManager(scene, audio), ledger = new CombatEvents({ runId: 'three-encounters' });
  horde.combatEvents = ledger; manager.combatEvents = ledger;
  const make = (id, x, hp) => ({ id, groupId: id + ':group', factionId: 'hive', species: 'xenomorph', actorType: 'praetorian', profileId: 'generic-guard', hp, maxHp: 1600, position: [x, 0] });
  const first = horde.spawnBattleUnit(make('mini-front-a', 100, 1300), { targetPosition: [110, 8], order: { type: 'defend' } });
  const second = horde.spawnBattleUnit(make('mini-front-b', -100, 900), { targetPosition: [-110, -8], order: { type: 'defend' } });
  assert.notEqual(first.mesh.uuid, second.mesh.uuid); assert.notDeepEqual(first.battleOrderTarget, second.battleOrderTarget);
  manager.spawnBoss('xenomorph_queen', new THREE.Vector3(0, 0, 100));
  const targetsBefore = [first.battleOrderTarget.slice(), second.battleOrderTarget.slice()];
  manager.update(0, player([0, 0, 0])); assert.equal(first.hp, 1300); assert.equal(second.hp, 900);
  horde.applyDamage(first, 100); assert.equal(first.hp, 1200); assert.equal(second.hp, 900);
  manager.takeDamage(1e7); assert.equal(horde.aliens.length, 2); assert.ok(first.mesh.parent === scene && second.mesh.parent === scene);
  assert.deepEqual([first.battleOrderTarget, second.battleOrderTarget], targetsBefore);
  horde.applyDamage(first, 1e7); assert.equal(second.hp, 900); assert.equal(horde.aliens.length, 1); assert.equal(ledger.getSnapshot().deaths.length, 2);
  horde.clearWave(); manager.clear(); assert.equal(scene.children.length, 0);
});
