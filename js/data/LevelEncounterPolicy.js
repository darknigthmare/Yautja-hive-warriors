// Campaign hunts use only support compatible with their location. Catalogue
// operations own their explicit crossover rosters; this never rewrites them.
const FUTURE_SUPPORT = new Set(['xenomorph_prime', 'romulus_station', 'charon_rogue_base']);
const INDUSTRIAL_SITES = new Set(['romulus_station', 'charon_rogue_base', 'stargazer_facility']);
const NAMED_HUNTERS = Object.freeze({
  jungle_hunter_boss: 'jungle_hunter', city_hunter_boss: 'city_hunter',
  feral_predator_boss: 'feral_predator'
});

export function sectorSupportPlan(levelId, sectorIndex) {
  const active = Number.isInteger(sectorIndex) && sectorIndex > 0;
  const future = FUTURE_SUPPORT.has(levelId);
  return Object.freeze({
    allies: active ? 1 : 0,
    marines: active && future ? 2 : 0,
    synthetics: active && future ? 2 : 0,
    gasPipes: INDUSTRIAL_SITES.has(levelId) ? 4 : 0,
    apc: active && future && sectorIndex === 3,
    // AVP: Requiem: the Colorado National Guard enters Gunnison. A separate US Army National Guard
    // section, not USCM; it fights the hive beside the hunter (HW-DEC-87, provisional count).
    nationalGuard: active && levelId === 'gunnison_forest' ? 4 : 0
  });
}

export function hunterEncounterProvenance(characterId, bossType) {
  return NAMED_HUNTERS[bossType] === characterId
    ? 'DUEL ALTERNATIF — le chasseur jouable et le boss représentent la même incarnation. Cette rencontre est une adaptation.'
    : null;
}
