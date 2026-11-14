/* Interplanetary 3D Map Registry (v6.0 Omni-Warrior Edition) */

export const LEVELS_DATA = [
  {
    id: 'gunnison_forest',
    bossHp: 5500, // campaign curve (bible, tab 21_CourbeBoss)
    supports: { marines: 'national_guard', weaponCrates: true }, // bible, tab 15_Soutiens
    name: 'FÔRET DE GUNNISON (AVP REQUIEM)',
    desc: 'Forêt sombre sous la pluie d\'orage et torrents d\'eau.',
    theme: 'rain_forest',
    floorColor: 0x1f291e,
    wallColor: 0x0f1710,
    fogColor: 0x0a1015,
    fogDensity: 0.022,
    weatherType: 'rain',
    skyColor: 0x050a10,
    waves: 5,
    bossType: 'predalien_queen'
  },
  {
    id: 'xenomorph_prime',
    bossHp: 10000, // campaign curve (bible, tab 21_CourbeBoss)
    supports: { allies: true }, // bible, tab 15_Soutiens
    name: 'MONDE-RUCHE XENOMORPH PRIME',
    desc: 'Corridors biomécaniques recouverts de résine vivante.',
    theme: 'hive_world',
    floorColor: 0x120d18,
    wallColor: 0x22152e,
    fogColor: 0x1a0a2a,
    fogDensity: 0.026,
    weatherType: 'toxic_spores',
    skyColor: 0x0d0317,
    waves: 6,
    bossType: 'empress_matriarch'
  },
  {
    id: 'antarctic_pyramid',
    bossHp: 6500, // campaign curve (bible, tab 21_CourbeBoss)
    supports: { allies: true }, // bible, tab 15_Soutiens
    name: 'PYRAMIDE ANTARCTIQUE MODULAIRE',
    desc: 'Structure rituelle millénaire aux murs coulissants.',
    theme: 'pyramid',
    floorColor: 0x1a222d,
    wallColor: 0x334155,
    fogColor: 0x0f172a,
    fogDensity: 0.012,
    weatherType: 'none',
    skyColor: 0x020617,
    waves: 5,
    bossType: 'imperial_queen'
  },
  {
    id: 'la_rooftops',
    bossHp: 4500, // campaign curve (bible, tab 21_CourbeBoss)
    supports: { allies: true }, // bible, tab 15_Soutiens
    name: 'TOITS DE LOS ANGELES (1990)',
    desc: 'Gratte-ciels sous la tempête et panneaux néons.',
    theme: 'la_rooftops',
    floorColor: 0x262626,
    wallColor: 0x404040,
    fogColor: 0x171717,
    fogDensity: 0.020,
    weatherType: 'storm',
    skyColor: 0x0a0a0a,
    waves: 5,
    bossType: 'predalien_abomination'
  },
  {
    id: 'val_verde_jungle',
    bossHp: 3500, // campaign curve (bible, tab 21_CourbeBoss)
    supports: {}, // bible, tab 15_Soutiens
    name: 'JUNGLE DE VAL VERDE (1987)',
    desc: 'Jungle tropicale dense du premier affrontement.',
    theme: 'jungle',
    floorColor: 0x2d3a22,
    wallColor: 0x1a2512,
    fogColor: 0x0f170a,
    fogDensity: 0.024,
    weatherType: 'humid_mist',
    skyColor: 0x080d05,
    waves: 5,
    bossType: 'praetorian'
  },
  {
    id: 'romulus_station',
    bossHp: 9000, // campaign curve (bible, tab 21_CourbeBoss)
    supports: { marines: 'colonial', synthetics: true, sentry: true, weaponCrates: true }, // bible, tab 15_Soutiens
    name: 'STATION RENAISSANCE (ALIEN: ROMULUS)',
    desc: 'Station spatiale en dérive orbitale, laboratoires Z-01 et baie cryogénique.',
    theme: 'romulus_station',
    floorColor: 0x0f172a,
    wallColor: 0x1e293b,
    fogColor: 0x090d16,
    fogDensity: 0.018,
    weatherType: 'zero_g_cryo',
    skyColor: 0x030712,
    waves: 6,
    bossType: 'the_offspring'
  },
  {
    id: 'charon_rogue_base',
    bossHp: 8500, // campaign curve (bible, tab 21_CourbeBoss)
    supports: { marines: 'colonial', synthetics: true, apc: true, dropship: true, sentry: true, weaponCrates: true }, // bible, tab 15_Soutiens
    name: 'BASE SCIENTIFIQUE CHARON (ALIENS: ROGUE 1993)',
    desc: 'Complexe fortifié du Dr Ernst Kleist où le titanesque Rogue King Xenomorph Prime a été génétiquement façonné.',
    theme: 'space_station',
    floorColor: 0x141824,
    wallColor: 0x222a3d,
    fogColor: 0x0d121f,
    fogDensity: 0.018,
    weatherType: 'none',
    skyColor: 0x040814,
    waves: 6,
    bossType: 'rogue_king_prime'
  },
  {
    id: 'game_preserve_planet',
    bossHp: 7500, // campaign curve (bible, tab 21_CourbeBoss)
    supports: { badBlood: true, weaponCrates: true }, // bible, tab 15_Soutiens
    name: 'RÉSERVE DE CHASSE DE MR. BLACK (PREDATORS 2010)',
    desc: 'Jungle extraterrestre sauvage contrôlée par le clan Super Predator Berserker, parsemée de totems d\'écorcheurs et de pièges mortels.',
    theme: 'temple',
    floorColor: 0x241711,
    wallColor: 0x38271e,
    fogColor: 0x1f0d06,
    fogDensity: 0.019,
    weatherType: 'none',
    skyColor: 0x150702,
    waves: 6,
    bossType: 'berserker_super_predator'
  }
];

/* Unblooded campaign hunts (bible: campagne-unblooded.md, tab 22_RegionsFaune). Not in the arena list. */
export const CAMPAIGN_HUNTS = [
  {
    id: 'vara_kesh',
    mode: 'fauna',
    name: 'VARA-KESH — CHASSE DE LA COHORTE',
    desc: 'Jungle dense, canopée, racines et ravins. Trois hardes, puis le Faucheur.',
    theme: 'jungle',
    floorColor: 0x24301a,
    wallColor: 0x16200f,
    fogColor: 0x0d140a,
    fogDensity: 0.02,
    weatherType: 'humid_mist',
    skyColor: 0x070c05,
    waves: 0,
    bossType: 'faucheur_vara_kesh',
    bossHp: 2500,
    supports: {}
  }
];
