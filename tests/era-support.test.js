import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { eraSupportFor, ERA_SUPPORT_LEVELS } from '../js/data/EraSupport.js';
import { LEVELS_DATA } from '../js/data/levelsData.js';
import { createMissionSupportContext } from '../js/engine/MissionRuntimeContext.js';
import { CheyenneDropship } from '../js/entities/CheyenneDropship.js';
import { APCVehicle } from '../js/entities/APCVehicle.js';

// Author decision (23 Nov 2026): USCM support only where the setting fields Colonial Marines;
// elsewhere a contemporary equivalent or nothing. Catalogue operations keep their own rule.
const openSky = { traceSegment: () => null, hasLineOfSight: () => true };
const context = (levelId, extra = {}) => createMissionSupportContext({ missionId: `m-${levelId}`, levelId, fidelityMode: 'adapted', environment: openSky, ...extra });

test('every hunt location has an explicit era support entry', () => {
  for (const level of LEVELS_DATA) assert.ok(ERA_SUPPORT_LEVELS.includes(level.id), level.id);
});

test('USCM support only where Colonial Marines exist; other eras get their equivalent or none', () => {
  const uscm = LEVELS_DATA.map(level => level.id).filter(id => eraSupportFor(id).air?.id === 'cheyenne');
  assert.deepEqual(uscm.sort(), ['charon_rogue_base', 'hadleys_hope_colony', 'romulus_station', 'xenomorph_prime']);
  for (const id of LEVELS_DATA.map(level => level.id)) assert.equal(eraSupportFor(id).ground === 'apc', uscm.includes(id), id);
  assert.equal(eraSupportFor('val_verde_jungle').air.id, 'huey');
  assert.equal(eraSupportFor('gunnison_forest').air.id, 'blackhawk');
  for (const id of ['prey_comanche_territory', 'fiorina_161_foundry', 'lv223_engineer_structures', 'antarctic_pyramid', 'la_rooftops']) assert.equal(eraSupportFor(id).air, null, id);
});

test('the mission context grants per-kind permission and keeps the Yautja orbital flag', () => {
  const fiorina = context('fiorina_161_foundry');
  assert.equal(fiorina.allowed, true, 'the orbital strike is not human support');
  assert.deepEqual(fiorina.allowedKinds, { apc: false, cheyenne: false });
  const apc = new APCVehicle(new THREE.Scene(), null, null); apc.beginMission(fiorina);
  assert.equal(apc.getSupportState().allowed, false);
  const jungle = context('val_verde_jungle');
  assert.deepEqual(jungle.allowedKinds, { apc: false, cheyenne: true });
  const operation = context('val_verde_jungle', { eraRules: false });
  assert.equal(operation.allowedKinds, undefined); assert.equal(operation.airProfile, null);
});

test('the air slot flies the era aircraft with its own finite budget', () => {
  const scene = new THREE.Scene(), air = new CheyenneDropship(scene, null, null);
  air.beginMission(context('val_verde_jungle'));
  const state = air.getSupportState();
  assert.equal(state.label, 'HUEY'); assert.deepEqual(state.limits, { sorties: 2, rockets: 8, napalm: 0 });
  assert.equal(air.triggerAirstrike(new THREE.Vector3(), null).accepted, true);
  assert.equal(air.shipMesh.userData.supportAircraft, 'huey');
  assert.deepEqual(air.policy.remaining, { sorties: 1, rockets: 4, napalm: 0 });
  for (let i = 0; i < 300; i++) air.update(1 / 60, null);
  assert.equal(air.triggerAirstrike(new THREE.Vector3(), null).accepted, true);
  for (let i = 0; i < 300; i++) air.update(1 / 60, null);
  assert.equal(air.triggerAirstrike(new THREE.Vector3(), null).reason, 'ammunition', 'two sorties, never a third');
  air.beginMission(context('hadleys_hope_colony'));
  assert.equal(air.getSupportState().label, 'CHEYENNE'); assert.equal(air.policy.remaining.rockets, 12);
  air.beginMission(context('fiorina_161_foundry'));
  assert.equal(air.triggerAirstrike(new THREE.Vector3(), null).reason, 'disallowed');
  air.clear(); assert.equal(scene.children.length, 0);
});
