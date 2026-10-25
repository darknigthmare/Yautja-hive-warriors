/* Six biomes share stable IDs; each contains a connected six-sector battlefield. */

export const LEVELS_DATA = [
  {
    id: 'gunnison_forest',
    name: 'FORÊT DE GUNNISON',
    desc: 'Six secteurs forestiers reliés par des gorges, un relais à activer et des avant-postes à libérer.',
    description: 'Libérez six territoires forestiers. Une gorge mène au relais de surveillance, puis aux camps et au nid de la vallée.',
    icon: '🌲', difficulty: 'CHASSE INITIALE', difficultyBadge: 'normal',
    theme: 'rain_forest', environmentType: 'forest', weather: 'rain',
    floorColor: 0x2b3a31, wallColor: 0x273c36, fogColor: 0x1d3335, skyColor: 0x101c26,
    accentColor: 0x6deed0, keyLightColor: 0xa5d6ee, ambientColor: 0x8db5a3, fogDensity: 0.012,
    arenaHalfSize: 66, battlefield: true, seed: 1987, waves: 5, bossType: 'predalien_queen'
  },
  {
    id: 'xenomorph_prime',
    name: 'XENOMORPH PRIME',
    desc: 'Un vaste réseau de couvoirs, de galeries de résine et de sas menant à la matriarche.',
    description: 'Traversez six chambres biomécaniques : couvoirs, nœud synaptique à activer, fonderie de résine et garde royale.',
    icon: '🧬', difficulty: 'EXTRÊME', difficultyBadge: 'extreme',
    theme: 'hive_world', environmentType: 'hive', weather: 'spores',
    floorColor: 0x302637, wallColor: 0x261d35, fogColor: 0x25192f, skyColor: 0x110d20,
    accentColor: 0xc89dff, keyLightColor: 0xbcacf7, ambientColor: 0x8f82af, fogDensity: 0.012,
    arenaHalfSize: 66, battlefield: true, seed: 426, waves: 6, bossType: 'empress_matriarch'
  },
  {
    id: 'antarctic_pyramid',
    name: 'PYRAMIDE ANTARCTIQUE',
    desc: 'Six cours rituelles reliées par des galeries de pierre et des portes à déverrouiller.',
    description: 'Des cours rituelles, des galeries encaissées et un autel à activer ouvrent la route du sanctuaire.',
    icon: '🔺', difficulty: 'DANGEREUX', difficultyBadge: 'hard',
    theme: 'pyramid', environmentType: 'temple', weather: 'snow',
    floorColor: 0x4a5262, wallColor: 0x607586, fogColor: 0x26334c, skyColor: 0x121b30,
    accentColor: 0x72defc, keyLightColor: 0xc9e1fb, ambientColor: 0x9bb4ca, fogDensity: 0.01,
    arenaHalfSize: 66, battlefield: true, seed: 2004, waves: 5, bossType: 'xenomorph_queen'
  },
  {
    id: 'la_rooftops',
    name: 'TOITS DE LOS ANGELES',
    desc: 'Un réseau de grandes terrasses reliées par des passerelles industrielles et des sas de sécurité.',
    description: 'Des grandes terrasses et passerelles de service relient six secteurs, du relais des toits au poste de commandement.',
    icon: '🌆', difficulty: 'DANGEREUX', difficultyBadge: 'hard',
    theme: 'la_rooftops', environmentType: 'rooftop', weather: 'rain',
    floorColor: 0x3c424d, wallColor: 0x454b59, fogColor: 0x2b2c3c, skyColor: 0x1c2434,
    accentColor: 0xfb9f69, keyLightColor: 0xffbf9a, ambientColor: 0x8d99b5, fogDensity: 0.007,
    arenaHalfSize: 66, battlefield: true, seed: 1990, waves: 5, bossType: 'predalien'
  },
  {
    id: 'val_verde_jungle',
    name: 'JUNGLE DE VAL VERDE',
    desc: 'Six clairières et camps reliés par des pistes encaissées, jusqu’au sanctuaire.',
    description: 'Progressez entre six clairières, camps et ruines. Réactivez le relais radio pour atteindre le bastion de la jungle.',
    icon: '🌴', difficulty: 'CHASSE INITIALE', difficultyBadge: 'normal',
    theme: 'jungle', environmentType: 'jungle', weather: 'pollen',
    floorColor: 0x3c4831, wallColor: 0x25371e, fogColor: 0x263b2b, skyColor: 0x1c2c24,
    accentColor: 0xf1d07a, keyLightColor: 0xffe2a5, ambientColor: 0xa8ba96, fogDensity: 0.011,
    arenaHalfSize: 66, battlefield: true, seed: 1719, waves: 5, bossType: 'praetorian'
  },
  {
    id: 'romulus_station',
    name: 'STATION RENAISSANCE',
    desc: 'Six grands hangars et laboratoires reliés par des couloirs de maintenance et des sas verrouillés.',
    description: 'Des couloirs de maintenance relient six grands hangars. Rétablissez l’alimentation et forcez les sas vers le laboratoire central.',
    icon: '🛰️', difficulty: 'EXTRÊME', difficultyBadge: 'extreme',
    theme: 'romulus_station', environmentType: 'station', weather: 'dust',
    floorColor: 0x354650, wallColor: 0x465a68, fogColor: 0x142639, skyColor: 0x0a1728,
    accentColor: 0x61e1ff, keyLightColor: 0xd9edff, ambientColor: 0x9ab9cf, fogDensity: 0.009,
    arenaHalfSize: 66, battlefield: true, seed: 2024, waves: 6, bossType: 'the_offspring'
  }
];
