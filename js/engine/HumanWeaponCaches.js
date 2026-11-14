/* Human weapon caches for hunts (HW-DEC-87). Gameplay adaptation, values provisional.
 * M41A, M77 Gauss and Seegson ammunition belong to the Alien setting's future: a hunt
 * starts without it, and finite caches exist only on sites where that setting already
 * fields Colonial Marines (the same sites as LevelEncounterPolicy's marine support).
 * Catalogue operations keep their own loadout: no cache is ever created there. */
export const HUMAN_WEAPON_CACHE_SITES = Object.freeze(['xenomorph_prime', 'romulus_station', 'charon_rogue_base']);
export const HUMAN_WEAPON_AMMO = Object.freeze({
  m41aGrenadeCharges: Object.freeze({ cache: 2, cap: 4 }),
  m77GaussAmmo: Object.freeze({ cache: 6, cap: 12 }),
  seegsonBoltAmmo: Object.freeze({ cache: 5, cap: 10 })
});
const CACHES_PER_SECTOR = 2;

export function humanWeaponCacheCount(levelId, sectorIndex) {
  return HUMAN_WEAPON_CACHE_SITES.includes(levelId) && Number.isInteger(sectorIndex) && sectorIndex >= 0 ? CACHES_PER_SECTOR : 0;
}

/** A hunt hunter carries no human ammunition until a cache is opened. */
export function emptyHumanWeaponAmmo(player) {
  if (!player) return false;
  for (const field of Object.keys(HUMAN_WEAPON_AMMO)) player[field] = 0;
  return true;
}

/** Opens one finite cache once and returns what was actually taken (never above the caps). */
export function openHumanWeaponCache(player, cache) {
  if (!player || !(player.hp > 0) || !cache || cache.opened) return null;
  const taken = {};
  for (const [field, rule] of Object.entries(HUMAN_WEAPON_AMMO)) {
    const before = Number.isFinite(player[field]) ? player[field] : 0;
    player[field] = Math.min(rule.cap, before + rule.cache);
    taken[field] = player[field] - before;
  }
  cache.opened = true;
  return taken;
}
