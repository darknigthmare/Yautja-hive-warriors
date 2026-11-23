// Campaign hunts use only support compatible with their location. Catalogue
// operations own their explicit crossover rosters; this never rewrites them.
const FUTURE_SUPPORT = new Set(['xenomorph_prime', 'romulus_station', 'charon_rogue_base', 'hadleys_hope_colony']);
const INDUSTRIAL_SITES = new Set(['romulus_station', 'charon_rogue_base', 'stargazer_facility', 'hadleys_hope_colony', 'fiorina_161_foundry', 'nostromo_refinery', 'sevastopol_station']);
const NAMED_HUNTERS = Object.freeze({
  jungle_hunter_boss: 'jungle_hunter', city_hunter_boss: 'city_hunter',
  feral_predator_boss: 'feral_predator'
});

// Hostile synthetic security by maker: Seegson Working Joes on Sevastopol (Alien: Isolation),
// Weyland-Yutani combat synthetics guarding Gateway's laboratory. Neither is USCM.
const SYNTHETIC_SECURITY = Object.freeze({ sevastopol_station: Object.freeze({ count: 3, profile: 'working_joe' }),
  gateway_station_labs: Object.freeze({ count: 2, profile: 'weyland_combat' }) });

export function sectorSupportPlan(levelId, sectorIndex) {
  const active = Number.isInteger(sectorIndex) && sectorIndex > 0;
  const future = FUTURE_SUPPORT.has(levelId), security = SYNTHETIC_SECURITY[levelId];
  return Object.freeze({
    allies: active ? 1 : 0,
    marines: active && future ? 2 : 0,
    synthetics: active ? (security?.count ?? (future ? 2 : 0)) : 0,
    syntheticProfile: security?.profile ?? null,
    gasPipes: INDUSTRIAL_SITES.has(levelId) ? 4 : 0,
    apc: active && future && sectorIndex === 3,
    // AVP: Requiem: the Colorado National Guard enters Gunnison. A separate US Army National Guard
    // section, not USCM; it fights the hive beside the hunter (HW-DEC-87, provisional count).
    nationalGuard: active && (levelId === 'gunnison_forest' || levelId === 'gunnison_town') ? 4 : 0
  });
}

export function hunterEncounterProvenance(characterId, bossType) {
  return NAMED_HUNTERS[bossType] === characterId
    ? 'DUEL ALTERNATIF — le chasseur jouable et le boss représentent la même incarnation. Cette rencontre est une adaptation.'
    : null;
}
