import test from 'node:test';
import assert from 'node:assert/strict';
import { HUMAN_WEAPON_CACHE_SITES, humanWeaponCacheCount, emptyHumanWeaponAmmo, openHumanWeaponCache } from '../js/engine/HumanWeaponCaches.js';
import { sectorSupportPlan } from '../js/data/LevelEncounterPolicy.js';

test('caches exist only where the Alien setting already fields Colonial Marines', () => {
  for (const site of HUMAN_WEAPON_CACHE_SITES) {
    assert.equal(humanWeaponCacheCount(site, 1), 2);
    assert.ok(sectorSupportPlan(site, 1).marines > 0, `${site} has marine support`);
  }
  for (const site of ['gunnison_forest', 'val_verde_jungle', 'la_rooftops', 'prey_comanche_territory']) assert.equal(humanWeaponCacheCount(site, 1), 0);
});

test('a hunt starts empty and a cache refills once, never above the caps', () => {
  const player = { hp: 100, m41aGrenadeCharges: 4, m77GaussAmmo: 12, seegsonBoltAmmo: 10 };
  emptyHumanWeaponAmmo(player);
  assert.deepEqual([player.m41aGrenadeCharges, player.m77GaussAmmo, player.seegsonBoltAmmo], [0, 0, 0]);
  const cache = { id: 'cache-1', opened: false };
  assert.deepEqual(openHumanWeaponCache(player, cache), { m41aGrenadeCharges: 2, m77GaussAmmo: 6, seegsonBoltAmmo: 5 });
  assert.equal(openHumanWeaponCache(player, cache), null, 'an opened cache stays empty');
  player.m77GaussAmmo = 10;
  assert.equal(openHumanWeaponCache(player, { opened: false }).m77GaussAmmo, 2);
  assert.equal(player.m77GaussAmmo, 12);
  assert.equal(openHumanWeaponCache({ hp: 0 }, { opened: false }), null);
});
