import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BATTLE_OPERATIONS, getBattleOperationConfig } from '../js/data/BattleCatalog.js';
import { sourceUnitVisualKind, SOURCE_PRESENTATION_STATUS } from '../js/data/SourceActorPresentation.js';
import { createCreatureModel, animateCreatureModel } from '../js/graphics/CreatureModels.js';
import { createMarineModel } from '../js/graphics/SupportModels.js';
import { XenomorphHorde } from '../js/entities/XenomorphHorde.js';
import { ColonialMarinesManager } from '../js/entities/ColonialMarines.js';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';

const config = () => getBattleOperationConfig('AFF-27');
const resolved = () => {
  const simulation = new BattleSimulation(config());
  return { simulation, units: [...simulation.units.values()] };
};
test('source visual mapping is restricted to the published LV-742 identities', () => {
  const { simulation, units } = resolved();
  try {
    const drones = units.filter(unit => sourceUnitVisualKind(unit) === 'drone');
    assert.ok(drones.length > 0);
    assert.ok(drones.every(unit => unit.actorType === 'warrior' && unit.species === 'xenomorph'));
    assert.ok(drones.every(unit => /_GRP-(58|59)_/.test(unit.profileId)));
    for (const role of ['medic','commtech','sniper','sadar','exosuit']) {
      const actors = units.filter(unit => sourceUnitVisualKind(unit) === role);
      assert.ok(actors.length > 0, role);
      assert.ok(actors.every(unit => unit.actorType === 'marine' && unit.species === 'human'));
      assert.ok(SOURCE_PRESENTATION_STATUS[role].includes('unverified'));
    }
    const fake = { profileId: 'original_human_soldier', actorType: 'marine', species: 'human' };
    assert.equal(sourceUnitVisualKind(fake), null);
    assert.equal(sourceUnitVisualKind({ ...fake, profileId: 'source_fake_GRP-60_H-LIGNE_5', species: 'synthetic' }), null);
  } finally { simulation.dispose(); }
});

test('one Dragon-free Drone is a separate continuous three-LOD sculpt, not the Warrior mesh renamed', () => {
  const preserved = new Set();
  const drone = createCreatureModel('drone', preserved), warrior = createCreatureModel('warrior', preserved);
  assert.equal(drone.userData.visualProfile.kind, 'drone');
  assert.equal(drone.userData.visualProfile.caste, 'drone');
  assert.equal(drone.userData.visualProfile.cranialProfile, 'smooth-elongated-dome');
  assert.notEqual(drone._creatureRig.cranium.geometry, warrior._creatureRig.cranium.geometry);
  assert.notEqual(drone.userData.visualProfile.midTriangles, 0);
  assert.notEqual(drone.userData.visualProfile.farTriangles, 0);
  assert.ok(drone._creatureRig.cranium.geometry.boundingBox.min.z < warrior._creatureRig.cranium.geometry.boundingBox.min.z);
  animateCreatureModel(drone, 2, true); animateCreatureModel(warrior, 2, true);
  assert.notEqual(drone._creatureRig['arm-left'].rotation.x, warrior._creatureRig['arm-left'].rotation.x);
  drone.removeFromParent(); warrior.removeFromParent();
});

test('Extinction source Marines have individually named visual kits with actual distinct geometry', () => {
  const types = ['marine','smartgunner','flametrooper','medic','commtech','sniper','sadar','exosuit'];
  const models = types.map(type => createMarineModel(type));
  try {
    assert.equal(new Set(models.map(group => group.userData.weaponKind)).size, types.length);
    const signatures = models.map(group => group.children.map(child =>
      `${child.name}:${child.geometry?.attributes?.position?.count ?? 0}`).join('|'));
    assert.equal(new Set(signatures).size, types.length, 'the role cannot just be renamed on the same mesh');
    for (const group of models) {
      assert.equal(group.userData.visualFidelity1to1Verified, false);
      assert.equal(group.userData.behaviorFidelity1to1Verified, false);
      assert.ok(group.children.some(child => child.isMesh));
    }
    const marineBounds = new THREE.Box3().setFromObject(models[0]);
    const exosuitBounds = new THREE.Box3().setFromObject(models[7]);
    assert.ok(exosuitBounds.max.x > marineBounds.max.x || exosuitBounds.min.x < marineBounds.min.x);
  } finally { for (const group of models) group.removeFromParent(); }
});

test('the physical managers materialize the right models without changing the saved strategic classes', () => {
  const { simulation, units } = resolved();
  const droneUnit = units.find(unit => sourceUnitVisualKind(unit) === 'drone');
  const medicUnit = units.find(unit => sourceUnitVisualKind(unit) === 'medic');
  const scene = new THREE.Scene(), audio = {};
  const xenos = new XenomorphHorde(scene, audio), marines = new ColonialMarinesManager(scene, audio);
  try {
    const xeno = xenos.spawnBattleUnit(droneUnit, simulation.groups.get(droneUnit.groupId));
    const medic = marines.spawnBattleUnit(medicUnit, simulation.groups.get(medicUnit.groupId));
    assert.equal(xeno.battleUnitId, droneUnit.id);
    assert.equal(xeno.type, 'drone');
    assert.equal(xeno.mesh.userData.visualProfile.kind, 'drone');
    assert.equal(medic.battleUnitId, medicUnit.id);
    assert.equal(medic.type, 'marine');
    assert.equal(medic.sourceVisualKind, 'medic');
    assert.equal(medic.mesh.userData.weaponKind, 'medic');
    assert.equal(simulation.getUnit(droneUnit.id).actorType, 'warrior');
    assert.equal(simulation.getUnit(medicUnit.id).actorType, 'marine');
    assert.equal(xenos.despawnBattleUnit(droneUnit.id).id, droneUnit.id);
    assert.equal(marines.despawnBattleUnit(medicUnit.id).id, medicUnit.id);
  } finally { xenos.clearWave(); marines.clearSquad(); simulation.dispose(); }
});

test('medical stock is finite, faction-bound, locally gated and persists after a checkpoint', () => {
  const { simulation, units } = resolved();
  const medic = units.find(unit => sourceUnitVisualKind(unit) === 'medic');
  const companion = units.find(unit => unit.groupId === medic.groupId && unit.id !== medic.id && unit.species === 'human');
  try {
    assert.ok(companion);
    assert.equal(simulation.getUnit(medic.id).medicalSupply, 2);
    assert.equal(simulation.applyMedicHeal(medic.id, companion.id), null, 'cannot heal a distant offscreen soldier');
    simulation.syncUnit(companion.id, { hp: companion.maxHp - 120 });
    const source = simulation.units.get(medic.id), target = simulation.units.get(companion.id);
    source.state = target.state = 'active';
    assert.equal(simulation.applyMedicHeal(medic.id, companion.id).amount, 90);
    assert.equal(source.medicalSupply, 1);
    assert.equal(target.hp, target.maxHp - 30);
    assert.equal(simulation.applyMedicHeal(medic.id, medic.id), null);
    const enemy = units.find(unit => unit.factionId !== medic.factionId);
    assert.equal(simulation.applyMedicHeal(medic.id, enemy.id), null);
    source.state = target.state = 'distant';
    const saved = simulation.saveState();
    const restored = BattleSimulation.fromState(config(), saved);
    try {
      assert.equal(restored.getUnit(medic.id).medicalSupply, 1);
      assert.equal(restored.getUnit(companion.id).hp, target.hp);
      const bad = structuredClone(saved);
      bad.units.find(unit => unit.id === medic.id).medicalSupply = 99;
      assert.throws(() => BattleSimulation.fromState(config(), bad), /invalid saved medical stock/);
      const prior = structuredClone(saved);
      delete prior.units.find(unit => unit.id === medic.id).medicalSupply;
      const old = BattleSimulation.fromState(config(), prior);
      try { assert.equal(old.getUnit(medic.id).medicalSupply, 0, 'source-v1 saves never receive free refills'); }
      finally { old.dispose(); }
    } finally { restored.dispose(); }
  } finally { simulation.dispose(); }
});

test('visual expansion never changes operational headcounts or the 27 source templates', () => {
  for (const operation of BATTLE_OPERATIONS) {
    const current = getBattleOperationConfig(operation.id, { allowHumanController: true });
    const original = getBattleOperationConfig(operation.id, { allowHumanController: true, rosterDetail: 'legacy' });
    assert.deepEqual(current.budgets, original.budgets, operation.id);
    assert.deepEqual(current.groups.map(group => group.units.map(unit => unit.id)),
      original.groups.map(group => group.units.map(unit => unit.id)), operation.id);
  }
});
