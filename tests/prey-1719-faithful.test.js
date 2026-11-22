import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { LEVELS_DATA } from '../js/data/levelsData.js';
import { EnvironmentManager } from '../js/entities/Environment.js';
import { XenomorphHorde } from '../js/entities/XenomorphHorde.js';
import { BossManager } from '../js/entities/Bosses.js';
import { BattlefieldMission } from '../js/engine/BattlefieldMission.js';
import { FaunaEncounter } from '../js/engine/FaunaEncounter.js';
import { PREY_1719_FAITHFUL, usesPrey1719Faithful } from '../js/data/Prey1719Faithful.js';
import { createMissionSupportContext } from '../js/engine/MissionRuntimeContext.js';

// AUD-123: the faithful 1719 Comanche Territory loads no group excluded by its period profile.
const audio = new Proxy({}, { get: () => () => {} });

test('only a faithful hunt on the Comanche Territory uses the 1719 variant', () => {
  assert.equal(usesPrey1719Faithful({ missionMode: 'hunt', fidelityMode: 'faithful', levelId: 'prey_comanche_territory' }), true);
  assert.equal(usesPrey1719Faithful({ missionMode: 'hunt', fidelityMode: 'adapted', levelId: 'prey_comanche_territory' }), false);
  assert.equal(usesPrey1719Faithful({ missionMode: 'fronts', fidelityMode: 'faithful', levelId: 'prey_comanche_territory' }), false);
  assert.equal(usesPrey1719Faithful({ missionMode: 'hunt', fidelityMode: 'faithful', levelId: 'val_verde_jungle' }), false);
});

test('every sector of the faithful hunt holds period wildlife only, the Feral ends it, and no USCM support is offered', () => {
  const level = LEVELS_DATA.find(item => item.id === 'prey_comanche_territory'), scene = new THREE.Scene();
  const environment = new EnvironmentManager(scene); environment.buildLevelEnvironment({ ...level, battlefield: true });
  const horde = new XenomorphHorde(scene, audio), bosses = new BossManager(scene, audio); horde.environment = environment; bosses.environment = environment;
  const encounter = new FaunaEncounter(horde, PREY_1719_FAITHFUL);
  const mission = new BattlefieldMission({ environment, horde, bosses, level, encounter });
  for (const sector of environment.battlefieldLayout.sectors) {
    for (const gate of environment.battlefieldLayout.gates) environment.openGate(gate.id);
    mission._enterSector(sector.id);
  }
  assert.ok(horde.aliens.length > 0, 'the sectors are populated');
  assert.ok(horde.aliens.every(actor => actor.isFauna && ['Loup gris', 'Grizzly'].includes(actor.name)), 'no xenomorph and no other species in 1719');
  assert.equal(horde.chestbursters.length + horde.royalFacehuggers.length + horde.pendingSpawns.length, 0);
  assert.equal(bosses.activeBoss?.type, 'feral_predator_boss');
  const support = createMissionSupportContext({ missionId: 'test', levelId: level.id, fidelityMode: 'faithful', environment });
  assert.equal(support.allowed, false, 'no APC or Cheyenne in the faithful 1719 version');
  bosses.clear();
});
