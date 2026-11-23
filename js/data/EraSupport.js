/* Human support by location and era (author decision, 23 Nov 2026). USCM support (M577 APC,
 * UD-4L Cheyenne) exists only where the Alien setting fields Colonial Marines. Elsewhere the
 * air slot takes a contemporary equivalent, or stays empty when the period offers none.
 * The Yautja orbital strike is not human support and is not governed here.
 * Budgets are gameplay choices, not measurements of any real or film aircraft. */
export const AIR_SUPPORT_PROFILES = Object.freeze({
  cheyenne: Object.freeze({ id: 'cheyenne', label: 'CHEYENNE', fullName: 'Cheyenne UD-4L', faction: 'uscm', source: 'Aliens (1986)', model: 'dropship',
    maxHp: 1800, ammunition: Object.freeze({ sorties: 2, rockets: 12, napalm: 6 }), perSortie: Object.freeze({ rockets: 6, napalm: 4 }), speed: 65,
    announce: 'CHEYENNE UD-4L EN APPROCHE — SIX ROQUETTES ENGAGÉES.' }),
  // Predator (1987): the team is inserted by UH-1 Huey. An armed gunship run is a gameplay adaptation.
  huey: Object.freeze({ id: 'huey', label: 'HUEY', fullName: 'UH-1 Huey', faction: 'us_army_1987', source: 'Predator (1987), adapted as a rocket gunship', model: 'huey',
    maxHp: 1100, ammunition: Object.freeze({ sorties: 2, rockets: 8, napalm: 0 }), perSortie: Object.freeze({ rockets: 4, napalm: 0 }), speed: 42,
    announce: 'HUEY UH-1 EN APPROCHE — QUATRE ROQUETTES ENGAGÉES.' }),
  // AVP: Requiem (2007) and The Predator (2018): US Army helicopters; their armed run is a gameplay adaptation.
  blackhawk: Object.freeze({ id: 'blackhawk', label: 'BLACK HAWK', fullName: 'UH-60 Black Hawk', faction: 'us_army_modern', source: 'US Army helicopter, adapted for AVP: Requiem (2007) and The Predator (2018)', model: 'blackhawk',
    maxHp: 1300, ammunition: Object.freeze({ sorties: 2, rockets: 10, napalm: 0 }), perSortie: Object.freeze({ rockets: 5, napalm: 0 }), speed: 48,
    announce: 'BLACK HAWK UH-60 EN APPROCHE — CINQ ROQUETTES ENGAGÉES.' })
});

const USCM = Object.freeze({ ground: 'apc', air: 'cheyenne', reason: 'Colonial Marines present in the setting' });
const NONE = reason => Object.freeze({ ground: null, air: null, reason });
const ERA_SUPPORT = Object.freeze({
  xenomorph_prime: USCM, romulus_station: USCM, charon_rogue_base: USCM, hadleys_hope_colony: USCM,
  val_verde_jungle: Object.freeze({ ground: null, air: 'huey', reason: '1987: Central American operation, UH-1 insertion' }),
  gunnison_forest: Object.freeze({ ground: null, air: 'blackhawk', reason: '2007: Colorado National Guard and US Army' }),
  stargazer_facility: Object.freeze({ ground: null, air: 'blackhawk', reason: '2018: Project Stargazer military' }),
  la_rooftops: NONE('1997: LAPD and a federal team; no armed aircraft'),
  prey_comanche_territory: NONE('1719: no period equivalent'),
  game_preserve_planet: NONE('alien preserve: no human command'),
  antarctic_pyramid: NONE('2004: civilian Weyland expedition'),
  killer_of_killers_arena: NONE('Yautja arena: no human command'),
  lv223_engineer_structures: NONE('2093: civilian Prometheus expedition'),
  fiorina_161_foundry: NONE('2179: prison colony, no Colonial Marines'),
  nostromo_refinery: NONE('2122: commercial towing crew of seven'),
  usm_auriga_labs: NONE('2381: United Systems Military, not USCM; no support vehicle'),
  sevastopol_station: NONE('2137: Seegson trading station, no military'),
  gateway_station_labs: NONE('2179: Weyland-Yutani station; company security, not USCM'),
  paradise_covenant: NONE('2104: colony ship crew, no military command'),
  gunnison_town: Object.freeze({ ground: null, air: 'blackhawk', reason: '2007: Colorado National Guard and US Army' }),
  prodigy_city_maginot: NONE('2120: Prodigy corporate city; no USCM'),
  yautja_clan_ship: NONE('Yautja clan ship: no human command')
});

/** { ground, air } for a location: 'apc' or null, and an air profile or null. Unknown places get none. */
export function eraSupportFor(levelId) {
  const entry = ERA_SUPPORT[levelId] ?? NONE('unknown location');
  return Object.freeze({ ground: entry.ground, air: entry.air ? AIR_SUPPORT_PROFILES[entry.air] : null, reason: entry.reason });
}
export const ERA_SUPPORT_LEVELS = Object.freeze(Object.keys(ERA_SUPPORT));
