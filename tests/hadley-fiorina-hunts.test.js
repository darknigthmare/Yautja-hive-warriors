import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS_DATA } from '../js/data/levelsData.js';
import { REFERENCE_LEVEL_MECHANISMS } from '../js/data/ReferenceLevelMechanisms.js';
import { BOSS_REGISTRY, bossAllowedInLevel } from '../js/data/BossRegistry.js';
import { sectorSupportPlan } from '../js/data/LevelEncounterPolicy.js';
import { humanWeaponCacheCount } from '../js/engine/HumanWeaponCaches.js';
import { createBattlefieldLayout } from '../js/data/BattlefieldLayouts.js';

// Roadmap phase 8 batch 2: Hadley's Hope (Aliens) and Fiorina 161 (Alien 3) hunts.
const level = id => LEVELS_DATA.find(entry => entry.id === id);

test('both hunts exist with their source, existing boss and an explicit adaptation note', () => {
  for (const [id, boss, source] of [['hadleys_hope_colony', 'xenomorph_queen', 'Aliens (1986)'], ['fiorina_161_foundry', 'fiorina_runner', 'Alien 3 (1992)'], ['nostromo_refinery', 'nostromo_drone', 'Alien (1979)'], ['usm_auriga_labs', 'xenomorph_queen', 'Alien Resurrection (1997)']]) {
    const entry = level(id);
    assert.equal(entry.bossType, boss); assert.equal(entry.sourceWork, source); 
    assert.match(entry.description, /adaptation/); assert.match(entry.fidelity, /no measured 1:1/);
    assert.equal(bossAllowedInLevel(boss, id), true, `${boss} in ${id}`);
    assert.ok(REFERENCE_LEVEL_MECHANISMS[id].builders.length >= 4);
    assert.ok(createBattlefieldLayout(entry).sectors.length >= 6);
  }
  assert.equal(BOSS_REGISTRY.fiorina_runner.species, 'xenomorph');
  assert.match(BOSS_REGISTRY.fiorina_runner.source, /adaptation/);
});

test("Hadley's Hope fields Colonial Marines; Fiorina 161 fields none", () => {
  let hadley = 0, fiorina = 0;
  for (let sector = 0; sector < 6; sector++) {
    hadley += sectorSupportPlan('hadleys_hope_colony', sector).marines;
    const plan = sectorSupportPlan('fiorina_161_foundry', sector);
    fiorina += plan.marines + plan.synthetics; assert.equal(plan.apc, false);
    assert.equal(humanWeaponCacheCount('fiorina_161_foundry', sector), 0);
  }
  assert.ok(hadley > 0); assert.equal(fiorina, 0);
  assert.ok(humanWeaponCacheCount('hadleys_hope_colony', 1) > 0);
  assert.equal(REFERENCE_LEVEL_MECHANISMS.fiorina_161_foundry.builders.includes('buildUSCMSupplyCaches'), false);
});

test('Nostromo and the USM Auriga field no Colonial Marines (USM is not USCM)', () => {
  for (const id of ['nostromo_refinery', 'usm_auriga_labs']) for (let sector = 0; sector < 6; sector++) {
    const plan = sectorSupportPlan(id, sector);
    assert.equal(plan.marines + plan.synthetics, 0, `${id}/${sector}`); assert.equal(plan.apc, false);
    assert.equal(humanWeaponCacheCount(id, sector), 0);
  }
  assert.equal(level('nostromo_refinery').era, '2122'); assert.equal(level('usm_auriga_labs').era, '2381');
});
