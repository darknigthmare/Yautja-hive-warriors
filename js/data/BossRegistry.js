/* Encounter identities and allowed attacks, not a claim of scanned/1:1 assets.
 * Named individuals never enter the ordinary reinforcement pool. HP, dimensions
 * and phases below are gameplay choices in game units. */
const LABELS = Object.freeze({ xenomorph_queen: 'Reine xénomorphe', praetorian: 'Prétorien', predalien: 'Predalien', predalien_queen: 'Predalien de Gunnison',
  imperial_queen: 'Reine impériale', empress_matriarch: 'Impératrice matriarche', the_offspring: 'Offspring', predalien_abomination: 'Abomination prédalienne',
  predalien_matriarch_titan: 'Titan prédalien', rogue_king_prime: 'Roi de Charon', awakened_engineer: 'Ingénieur éveillé', trilobite_prime: 'Trilobite',
  berserker_super_predator: 'Berserker', ultimate_upgrade_predator: 'Upgrade Predator', feral_predator_boss: 'Feral', apex_gladiator_predator: 'Gladiateur de l’arène',
  jungle_hunter_boss: 'Jungle Hunter', city_hunter_boss: 'City Hunter' });
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
  city_hunter_boss: define('city_hunter_boss', 'yautja', 'Predator 2 (1990), City Hunter', 7600, 4.6, ['plasma', 'disc', 'melee'], ['la_rooftops'], { hunterProfile: 'city_hunter' })
});

export function getBossDefinition(id) {
  const key = id === 'queen' ? 'xenomorph_queen' : id;
  if (!Object.hasOwn(BOSS_REGISTRY, key)) throw new RangeError(`Unknown boss identity: ${String(id)}`);
  return BOSS_REGISTRY[key];
}

export function bossAllowedInLevel(id, levelId, { mode = 'reconstruction' } = {}) {
  const boss = getBossDefinition(id);
  return mode === 'crossover' || mode === 'adaptation' || mode === 'adapted' || boss.levels.includes(levelId);
}

export function bossCanAttack(id, attack) { return getBossDefinition(id).attacks.includes(attack); }
