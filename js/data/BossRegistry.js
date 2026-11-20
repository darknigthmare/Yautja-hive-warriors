/* Encounter identities and allowed attacks, not a claim of scanned/1:1 assets.
 * Named individuals never enter the ordinary reinforcement pool. HP, dimensions
 * and phases below are gameplay choices in game units. */
const LABELS = Object.freeze({ xenomorph_queen: 'Reine xénomorphe', praetorian: 'Prétorien', predalien: 'Predalien', predalien_queen: 'Predalien de Gunnison',
  imperial_queen: 'Reine impériale', empress_matriarch: 'Impératrice matriarche', the_offspring: 'Offspring', predalien_abomination: 'Abomination prédalienne',
  predalien_matriarch_titan: 'Titan prédalien', rogue_king_prime: 'Roi de Charon', awakened_engineer: 'Ingénieur éveillé', trilobite_prime: 'Trilobite',
  berserker_super_predator: 'Berserker', ultimate_upgrade_predator: 'Upgrade Predator', feral_predator_boss: 'Feral', apex_gladiator_predator: 'Gladiateur de l’arène',
  jungle_hunter_boss: 'Jungle Hunter', city_hunter_boss: 'City Hunter',
  vara_kesh_reaper: 'Faucheur de Vara-Kesh', eshra_hydra: 'Hydre d’Eshra', kharuun_sand_maw: 'Gueule des sables', terek_va_hive_mind: 'Esprit de ruche des profondeurs',
  nereth_jaw: 'Mâchoire de Nereth', oshara_swimmer: 'Nageur d’Oshara', rukh_tal_spur: 'Éperon de Rukh Tal', dharos_watcher: 'Guetteur de Dharos' });
const define = (id, species, source, hp, height, attacks, levels = [], extra = {}) => Object.freeze({
  label: LABELS[id],
  id, species, source, hp, height, attacks: Object.freeze(attacks), levels: Object.freeze(levels),
  unique: true, ordinarySpawn: false, assetFidelity: 'interpreted-game-model', ...extra
});
export const BOSS_REGISTRY = Object.freeze({
  xenomorph_queen: define('xenomorph_queen', 'xenomorph', 'Aliens (1986) / Alien vs. Predator (2004)', 3000, 6.2, ['tail', 'spit', 'melee'], ['antarctic_pyramid']),
  praetorian: define('praetorian', 'xenomorph', 'Praetorian game caste; encounter adaptation', 3000, 5.2, ['tail', 'spit', 'melee']),
  predalien: define('predalien', 'xenomorph', 'Alien vs. Predator game hybrid', 3000, 5.4, ['tail', 'spit', 'leap', 'melee']),
  predalien_queen: define('predalien_queen', 'xenomorph', 'AVP: Requiem (2007), gameplay adaptation of the Predalien; queen title is not a film caste', 5000, 5.8, ['tail', 'embryos', 'melee'], ['gunnison_forest']),
  imperial_queen: define('imperial_queen', 'xenomorph', 'AVP: Extinction game encounter adaptation', 8000, 8.2, ['tail', 'spit', 'slam', 'melee']),
  empress_matriarch: define('empress_matriarch', 'xenomorph', 'AVP game/comic encounter adaptation; flight is a project mechanic', 6000, 7.5, ['tail', 'spit', 'gale', 'melee'], ['xenomorph_prime']),
  the_offspring: define('the_offspring', 'hybrid', 'Alien: Romulus (2024)', 4500, 6.0, ['shriek', 'melee'], ['romulus_station']),
  predalien_abomination: define('predalien_abomination', 'xenomorph', 'AVP: Requiem-inspired project encounter', 6500, 6.2, ['tail', 'embryos', 'leap', 'melee']),
  predalien_matriarch_titan: define('predalien_matriarch_titan', 'xenomorph', 'Original project titan inspired by AVP game roles', 10000, 8.0, ['tail', 'embryos', 'slam', 'melee'], [], { original: true }),
  rogue_king_prime: define('rogue_king_prime', 'xenomorph', 'Aliens: Rogue (1993), game adaptation of the King', 9500, 7.5, ['slam', 'charge', 'melee'], ['charon_rogue_base']),
  awakened_engineer: define('awakened_engineer', 'engineer', 'Prometheus (2012), original shield/vortex encounter mechanics', 8500, 5.8, ['vortex', 'slam', 'melee'], [], { adaptedArsenal: ['phase-shield', 'gravity-vortex'] }),
  trilobite_prime: define('trilobite_prime', 'organism', 'Prometheus (2012), enlarged project encounter', 7000, 4.7, ['constrict', 'leap', 'melee']),
  berserker_super_predator: define('berserker_super_predator', 'yautja', 'Predators (2010), Berserker / Mr. Black', 8800, 5.2, ['plasma', 'charge', 'melee'], ['game_preserve_planet']),
  ultimate_upgrade_predator: define('ultimate_upgrade_predator', 'yautja', 'The Predator (2018), Upgrade Predator', 9200, 6.2, ['charge', 'slam', 'melee'], ['stargazer_facility']),
  feral_predator_boss: define('feral_predator_boss', 'yautja', 'Prey (2022), Feral', 8600, 4.6, ['bolt', 'leap', 'melee'], ['prey_comanche_territory'], { shield: true, maskGuidedBolts: true }),
  apex_gladiator_predator: define('apex_gladiator_predator', 'yautja', 'Predator: Killer of Killers (2025), project gladiator encounter', 9000, 5.8, ['charge', 'leap', 'melee'], ['killer_of_killers_arena']),
  jungle_hunter_boss: define('jungle_hunter_boss', 'yautja', 'Predator (1987), Jungle Hunter', 7500, 4.6, ['plasma', 'leap', 'melee'], ['val_verde_jungle'], { hunterProfile: 'jungle_hunter' }),
  city_hunter_boss: define('city_hunter_boss', 'yautja', 'Predator 2 (1990), City Hunter', 7600, 4.6, ['plasma', 'disc', 'melee'], ['la_rooftops'], { hunterProfile: 'city_hunter' }),
  // Great prey of the Ascension mode (HW-DEC-106): Bible V6 fauna where it exists, otherwise creations.
  vara_kesh_reaper: define('vara_kesh_reaper', 'fauna', 'Bible V6 FAU-21 (Yautja : La Longue Chasse)', 2500, 3.4, ['leap', 'melee'], [], { ascension: true, faunaLook: { color: 0x3a4a20, size: 2.8 } }),
  eshra_hydra: define('eshra_hydra', 'fauna', 'Création Hive Warriors (Eshra)', 3000, 3.6, ['melee'], [], { ascension: true, creation: true, faunaLook: { color: 0x2e3326, size: 3 } }),
  kharuun_sand_maw: define('kharuun_sand_maw', 'fauna', 'Création Hive Warriors (Kharuun)', 3400, 3.8, ['charge', 'melee'], [], { ascension: true, creation: true, faunaLook: { color: 0x6b5236, size: 3.2 } }),
  terek_va_hive_mind: define('terek_va_hive_mind', 'fauna', 'Création Hive Warriors (Terek-Va)', 3800, 4, ['melee'], [], { ascension: true, creation: true, faunaLook: { color: 0x4b1f2a, size: 3.3 } }),
  nereth_jaw: define('nereth_jaw', 'fauna', 'Bible V6 FAU-22 (Yautja : La Longue Chasse)', 4200, 3.8, ['charge', 'melee'], [], { ascension: true, faunaLook: { color: 0xc2ccd4, size: 3.1 } }),
  oshara_swimmer: define('oshara_swimmer', 'fauna', 'Bible V6 FAU-23 (Yautja : La Longue Chasse)', 4800, 3.6, ['leap', 'melee'], [], { ascension: true, faunaLook: { color: 0x5e2a20, size: 3.1 } }),
  rukh_tal_spur: define('rukh_tal_spur', 'fauna', 'Bible V6 FAU-24 (Yautja : La Longue Chasse)', 5400, 4, ['charge', 'melee'], [], { ascension: true, faunaLook: { color: 0x241f1d, size: 3.4 } }),
  dharos_watcher: define('dharos_watcher', 'fauna', 'Bible V6 FAU-26 (Yautja : La Longue Chasse)', 6000, 4.2, ['leap', 'melee'], [], { ascension: true, faunaLook: { color: 0x3a3833, size: 3.5 } })
});

export function getBossDefinition(id) {
  const key = id === 'queen' ? 'xenomorph_queen' : id;
  if (!Object.hasOwn(BOSS_REGISTRY, key)) throw new RangeError(`Unknown boss identity: ${String(id)}`);
  return BOSS_REGISTRY[key];
}

export function bossAllowedInLevel(id, levelId, { mode = 'reconstruction' } = {}) {
  const boss = getBossDefinition(id);
  // Great prey exist only in the Ascension mode, and nothing else enters it as a boss.
  if (boss.ascension || mode === 'ascension') return boss.ascension === true && mode === 'ascension';
  return mode === 'crossover' || mode === 'adaptation' || mode === 'adapted' || boss.levels.includes(levelId);
}

export function bossCanAttack(id, attack) { return getBossDefinition(id).attacks.includes(attack); }
