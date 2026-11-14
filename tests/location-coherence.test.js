import test from 'node:test';
import assert from 'node:assert/strict';
import { REFERENCE_LEVEL_MECHANISMS } from '../js/data/ReferenceLevelMechanisms.js';
import { BOSS_REGISTRY, bossAllowedInLevel } from '../js/data/BossRegistry.js';
import { sectorSupportPlan } from '../js/data/LevelEncounterPolicy.js';
import { humanWeaponCacheCount } from '../js/engine/HumanWeaponCaches.js';

/* AUD-060: a historical or present-day Predator location never receives Alien-setting
 * installations, colonial marines or a xenomorph boss by default. Crossover play is the named exception. */
const PRESENT_OR_PAST = ['val_verde_jungle', 'prey_comanche_territory', 'la_rooftops', 'gunnison_forest', 'stargazer_facility', 'game_preserve_planet'];
const ALIEN_FUTURE_BUILDERS = ['buildCryoMedBays', 'buildUSCMSupplyCaches', 'buildMountedSmartgun', 'buildEggNurseries', 'buildChrysalisCocoons',
  'buildQueenOvipositor', 'buildBiomechanicalWallResin', 'buildEngineerCityRuins', 'buildDecompressionAirlock', 'buildDecontaminationAirlock',
  'buildRomulusCryoProps', 'buildCharonGeneticsLabProps', 'buildReactorMeltdownConsole'];
const XENO_BOSSES = ['xenomorph_queen', 'praetorian', 'predalien', 'predalien_queen', 'imperial_queen', 'empress_matriarch', 'the_offspring',
  'predalien_abomination', 'predalien_matriarch_titan', 'rogue_king_prime', 'awakened_engineer', 'trilobite_prime'];

test('present and historical locations build no Alien-setting installation', () => {
  for (const levelId of PRESENT_OR_PAST) {
    const builders = REFERENCE_LEVEL_MECHANISMS[levelId]?.builders ?? [];
    assert.deepEqual(builders.filter(builder => ALIEN_FUTURE_BUILDERS.includes(builder)), [], levelId);
  }
});

test('present and historical hunts field no Colonial Marines, synthetics or Alien-setting ammunition', () => {
  for (const levelId of PRESENT_OR_PAST) for (let sector = 0; sector < 6; sector++) {
    const plan = sectorSupportPlan(levelId, sector);
    assert.equal(plan.marines + plan.synthetics, 0, `${levelId}/${sector}`);
    assert.equal(plan.apc, false, `${levelId}/${sector}`);
    assert.equal(humanWeaponCacheCount(levelId, sector), 0, `${levelId}/${sector}`);
  }
});

test('the 1987 jungle and the 1719 plains receive no xenomorph boss unless crossover is chosen', () => {
  for (const levelId of ['val_verde_jungle', 'prey_comanche_territory']) for (const boss of XENO_BOSSES.filter(id => BOSS_REGISTRY[id])) {
    assert.equal(bossAllowedInLevel(boss, levelId), false, `${boss} in ${levelId}`);
    assert.equal(bossAllowedInLevel(boss, levelId, { mode: 'original' }), false, `${boss} in ${levelId} (original)`);
  }
  assert.equal(bossAllowedInLevel('rogue_king_prime', 'val_verde_jungle', { mode: 'crossover' }), true, 'crossover is the identified exception');
});
