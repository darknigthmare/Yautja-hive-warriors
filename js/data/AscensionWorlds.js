/* The eight worlds of the Ascension mode (HW-DEC-86, 105-109; design/gdd/campagne-unblooded.md).
 * Ported as data from the archived v58 prototype. Great prey with a Bible V6 id come from its fauna
 * sheet; herds, leaders and the other prey are creations of Hive Warriors (fidelity: adaptation).
 * Numbers are first guesses, to tune after play. */
export const ASCENSION_WORLDS = Object.freeze([
 {
  "id": "vara_kesh",
  "order": 1,
  "title": "VARA-KESH",
  "herd": {
   "name": "Coureur de lianes",
   "hp": 90,
   "speed": 13,
   "bite": 10,
   "radius": 0.9,
   "color": 5991215,
   "size": 0.9
  },
  "leader": {
   "name": "Mâle dominant",
   "hp": 700,
   "speed": 11,
   "bite": 45,
   "charge": 120,
   "radius": 1.6,
   "color": 4147742,
   "size": 1.7
  },
  "herdSizes": [
   10,
   12,
   14
  ],
  "lines": [
   "SAAR : « Approche. » La première harde broute sous les racines.",
   "SAAR : « Vers le filet ! » Une harde plus nerveuse, dans la ravine.",
   "SAAR : « Regarde ses pattes. » Le mâle de cette harde charge avant de mordre."
  ],
  "preyLine": "Le Faucheur de Vara-Kesh descend des branches fortes : attirez-le sur un passage dégagé.",
  "reward": {
   "ability": "netgun",
   "label": "Lance-filet"
  },
  "victory": "Le Faucheur de Vara-Kesh est tombé. Saar vous remet un lance-filet.",
  "prey": {
   "bossId": "vara_kesh_reaper",
   "name": "Faucheur de Vara-Kesh",
   "bibleId": "FAU-21",
   "hp": 2500
  }
 },
 {
  "id": "eshra",
  "order": 2,
  "title": "ESHRA",
  "herd": {
   "name": "Rampeur de vase",
   "hp": 110,
   "speed": 9,
   "bite": 12,
   "radius": 1,
   "color": 4868666,
   "size": 1
  },
  "leader": {
   "name": "Matrone de vase",
   "hp": 900,
   "speed": 5,
   "bite": 40,
   "radius": 2,
   "color": 3027750,
   "size": 2,
   "spawns": 6
  },
  "herdSizes": [
   10,
   12,
   14
  ],
  "lines": [
   "SAAR : « Elle pond tant qu'elle vit. » Tuez la matrone d'abord.",
   "SAAR : « Les chenaux ralentissent. Restez sur les îlots. »",
   "SAAR : « Trois matrones ont nourri ce marais. Celle-ci est la dernière. »"
  ],
  "preyLine": "L'Hydre sort de la brume : chaque tête abattue l'affaiblit.",
  "reward": {
   "ability": "bear_trap",
   "label": "Piège à mâchoires"
  },
  "victory": "L'Hydre d'Eshra est tombée. Saar vous confie des pièges à mâchoires.",
  "prey": {
   "bossId": "eshra_hydra",
   "name": "Hydre d’Eshra",
   "bibleId": null,
   "hp": 3000
  }
 },
 {
  "id": "kharuun",
  "order": 3,
  "title": "KHARUUN",
  "herd": {
   "name": "Coureur des canyons",
   "hp": 100,
   "speed": 16,
   "bite": 12,
   "radius": 0.9,
   "color": 9071173,
   "size": 0.95
  },
  "leader": {
   "name": "Fouisseur géant",
   "hp": 1000,
   "speed": 10,
   "bite": 55,
   "radius": 1.8,
   "color": 7033398,
   "size": 1.9,
   "burrows": true
  },
  "herdSizes": [
   12,
   14,
   16
  ],
  "lines": [
   "SAAR : « Lisez le sol. » Le fouisseur laisse des sillons.",
   "SAAR : « Restez sur la roche quand il plonge. »",
   "SAAR : « Le vent efface les pistes. Pas celle-ci. »"
  ],
  "preyLine": "La Gueule des sables ne se touche que lorsqu'elle émerge : la bête qui efface sa piste dans le vent.",
  "reward": {
   "ability": "voice_lure",
   "label": "Leurre sonore"
  },
  "victory": "La Gueule des sables est tombée. Saar vous apprend le leurre sonore.",
  "prey": {
   "bossId": "kharuun_sand_maw",
   "name": "Gueule des sables",
   "bibleId": null,
   "hp": 3400
  }
 },
 {
  "id": "terek_va",
  "order": 4,
  "title": "TEREK-VA",
  "herd": {
   "name": "Nuée des puits",
   "hp": 50,
   "speed": 15,
   "bite": 8,
   "radius": 0.7,
   "color": 7224123,
   "size": 0.7
  },
  "leader": {
   "name": "Nœud de nuée",
   "hp": 1100,
   "speed": 0,
   "bite": 0,
   "radius": 2.2,
   "color": 4923178,
   "size": 2.2,
   "spawns": 4,
   "stationary": true
  },
  "herdSizes": [
   24,
   28,
   32
  ],
  "lines": [
   "SAAR : « Une seule voix commande la nuée. Trouvez le nœud. »",
   "SAAR : « Tenez la galerie. Ils viendront par dizaines. »",
   "SAAR : « Retenez ce que vous ressentez. Vous le reverrez. »"
  ],
  "preyLine": "L'Esprit de ruche des profondeurs : traversez sa nuée pour l'atteindre.",
  "reward": {
   "ability": "tripwire_mine",
   "label": "Mines"
  },
  "victory": "L'Esprit de ruche est tombé. Saar vous confie des mines.",
  "prey": {
   "bossId": "terek_va_hive_mind",
   "name": "Esprit de ruche des profondeurs",
   "bibleId": null,
   "hp": 3800
  }
 },
 {
  "id": "nereth",
  "order": 5,
  "title": "NERETH",
  "herd": {
   "name": "Rôdeur blanc",
   "hp": 120,
   "speed": 14,
   "bite": 16,
   "radius": 1,
   "color": 14674158,
   "size": 1,
   "faint": true
  },
  "leader": {
   "name": "Femelle alpha",
   "hp": 1200,
   "speed": 13,
   "bite": 55,
   "charge": 140,
   "radius": 1.8,
   "color": 12766420,
   "size": 1.8
  },
  "herdSizes": [
   12,
   14,
   16
  ],
  "lines": [
   "SAAR : « Ils sont blancs sur blanc. Changez de vision [V]. »",
   "SAAR : « Elle fait encercler. Ne restez pas seul. »",
   "Une mue de Xénomorphe est prise dans la glace. Saar ne la commente pas."
  ],
  "preyLine": "La Mâchoire de Nereth attaque depuis un couloir gelé.",
  "reward": {
   "ability": "smart_disc",
   "label": "Disque"
  },
  "victory": "La Mâchoire de Nereth est tombée. Saar vous remet un disque.",
  "prey": {
   "bossId": "nereth_jaw",
   "name": "Mâchoire de Nereth",
   "bibleId": "FAU-22",
   "hp": 4200
  }
 },
 {
  "id": "oshara",
  "order": 6,
  "title": "OSHARA",
  "herd": {
   "name": "Pince de récif",
   "hp": 170,
   "speed": 7,
   "bite": 20,
   "radius": 1.1,
   "color": 9059115,
   "size": 1.1
  },
  "leader": {
   "name": "Vieux mâle cuirassé",
   "hp": 1400,
   "speed": 6,
   "bite": 70,
   "radius": 2.1,
   "color": 6171168,
   "size": 2.1
  },
  "herdSizes": [
   10,
   12,
   14
  ],
  "lines": [
   "SAAR : « La marée monte. Ne traînez pas. »",
   "SAAR : « Frappez-les de loin, ou par-dessous. »",
   "De la résine noire couvre la paroi d'une grotte côtière."
  ],
  "preyLine": "Le Nageur d'Oshara change de rive après chaque immersion.",
  "reward": {
   "ability": "flechettes",
   "label": "Fléchettes"
  },
  "victory": "Le Nageur d'Oshara est tombé. Saar vous apprend les fléchettes.",
  "prey": {
   "bossId": "oshara_swimmer",
   "name": "Nageur d’Oshara",
   "bibleId": "FAU-23",
   "hp": 4800
  }
 },
 {
  "id": "rukh_tal",
  "order": 7,
  "title": "RUKH TAL",
  "herd": {
   "name": "Lézard de cendre",
   "hp": 140,
   "speed": 12,
   "bite": 18,
   "radius": 1,
   "color": 3814192,
   "size": 1
  },
  "leader": {
   "name": "Lézard cuirassé",
   "hp": 1500,
   "speed": 10,
   "bite": 65,
   "charge": 160,
   "radius": 2,
   "color": 2367261,
   "size": 2
  },
  "herdSizes": [
   12,
   14,
   16
  ],
  "lines": [
   "KAEDH : « Pas encore. » Un Bad Blood rôde : l'Elite quitte son poste. Personne ne vous relèvera.",
   "Une carcasse ouverte de l'intérieur gît au bord d'une coulée.",
   "SAAR : « Comptez les cycles de vapeur. »"
  ],
  "preyLine": "L'Éperon de Rukh Tal charge à la fin d'un cycle de vapeur.",
  "reward": {
   "ability": "cloak",
   "label": "Camouflage"
  },
  "victory": "L'Éperon de Rukh Tal est tombé. Kaedh revient : il vous apprend le camouflage.",
  "prey": {
   "bossId": "rukh_tal_spur",
   "name": "Éperon de Rukh Tal",
   "bibleId": "FAU-24",
   "hp": 5400
  }
 },
 {
  "id": "dharos",
  "order": 8,
  "title": "DHAROS",
  "herd": {
   "name": "Charognard des rues",
   "hp": 150,
   "speed": 15,
   "bite": 20,
   "radius": 1,
   "color": 5591626,
   "size": 1
  },
  "leader": {
   "name": "Sentinelle",
   "hp": 1600,
   "speed": 8,
   "bite": 70,
   "radius": 2,
   "color": 3815475,
   "size": 2,
   "spawns": 8
  },
  "herdSizes": [
   14,
   16,
   18
  ],
  "lines": [
   "SAAR : « Tout le kit, maintenant. »",
   "SAAR : « Elles réveillent le quartier. Faites vite. »",
   "Un œuf éclos, vide, au fond d'un sous-sol. Saar dit seulement que la prochaine chasse sera différente."
  ],
  "preyLine": "Le Guetteur de Dharos observe depuis une fenêtre avant de descendre.",
  "reward": {
   "ability": "shuriken",
   "label": "Shuriken"
  },
  "victory": "Le Guetteur de Dharos est tombé. Saar vous remet un shuriken. Le rite vous attend.",
  "prey": {
   "bossId": "dharos_watcher",
   "name": "Guetteur de Dharos",
   "bibleId": "FAU-26",
   "hp": 6000
  }
 }
].map(world => Object.freeze({ ...world, fidelity: 'adaptation', creation: world.prey.bibleId === null })));

// Each world is a procedural variant of a v70 location (HW-DEC-107): the base chooses the kind of
// ground and vegetation, the variant its palette, weather and ASC- map id. The ASC- profile builds no
// human or xenomorph installation (AUD-060). Sketches, not finished models.
const terrain = (baseLevelId, theme, weather, fogColor, floorColor, wallColor, accentColor, fogDensity, builders = []) =>
  Object.freeze({ baseLevelId, theme, weather, fogColor, floorColor, wallColor, accentColor, fogDensity, builders: Object.freeze(builders) });
export const ASCENSION_TERRAINS = Object.freeze({
  vara_kesh: terrain('val_verde_jungle', 'jungle', 'pollen', 0x6f8a55, 0x3b4a26, 0x2c3a1c, 0x9fe2a0, 0.012),
  eshra: terrain('val_verde_jungle', 'rain_forest', 'humid_mist', 0x56645a, 0x2c3329, 0x3a3f33, 0x8fb7a6, 0.02),
  kharuun: terrain('prey_comanche_territory', 'comanche_territory', 'dust', 0xb39a72, 0x9c7f55, 0x7d6243, 0xf0c98a, 0.009),
  terek_va: terrain('antarctic_pyramid', 'hive_world', 'toxic_spores', 0x4a2f2a, 0x2e2220, 0x3d2a26, 0xff8a5c, 0.016, ['buildSubterraneanVents']),
  nereth: terrain('antarctic_pyramid', 'pyramid', 'snow', 0xc9d6e0, 0xe4ecf2, 0x9fb2c2, 0xbfe6ff, 0.018),
  oshara: terrain('gunnison_forest', 'rain_forest', 'rain', 0x4f6e7a, 0x3a4c4f, 0x2f4248, 0x8fd3e8, 0.014),
  rukh_tal: terrain('antarctic_pyramid', 'temple', 'dust', 0x5a3428, 0x231c1a, 0x3a2622, 0xff7040, 0.015, ['buildSubterraneanVents']),
  dharos: terrain('la_rooftops', 'la_rooftops', 'autumn_gale', 0x6a6a72, 0x4a4a4e, 0x55555c, 0xd6c7a1, 0.012)
});
export const ASCENSION_BASE_LEVELS = Object.freeze(Object.fromEntries(Object.entries(ASCENSION_TERRAINS).map(([id, value]) => [id, value.baseLevelId])));
export const ascensionMapId = worldId => `ASC-${worldId}`;
/** The playable level of a world: its base location, with its own look and no foreign installation. */
export function ascensionLevel(worldId, levels) {
  const world = ASCENSION_WORLDS.find(item => item.id === worldId), look = ASCENSION_TERRAINS[worldId];
  const base = look && levels.find(level => level.id === look.baseLevelId);
  if (!world || !base) return null;
  const { builders, baseLevelId, ...appearance } = look;
  return { ...base, ...appearance, name: `${world.title} — ${world.prey.name}`, mapId: ascensionMapId(worldId), ascensionWorldId: worldId,
    era: 'ascension', fidelity: 'adaptation', terrainProvenance: `Variante procédurale de ${base.id} (HW-DEC-107)` };
}

export const ascensionWorld = id => ASCENSION_WORLDS.find(world => world.id === id) ?? null;
export const ASCENSION_PREY_IDS = Object.freeze(ASCENSION_WORLDS.map(world => world.prey.bossId));
