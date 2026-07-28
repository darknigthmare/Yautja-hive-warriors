/* ULTIMATE EXHAUSTIVE ALIENS VS PREDATOR ARMORY REGISTRY (36 WEAPONS & GADGETS) */

export const ULTIMATE_YAUTJA_ARMORY = [
  // 1-12: MELEE WEAPONS
  { id: 'wristblades', name: 'Dual Retractable Wristblades', origin: 'Predator 1987 / AVP' },
  { id: 'single_scythe', name: 'Extended Single Scythe Wristblade', origin: 'Predators 2010' },
  { id: 'super_cleaver', name: 'Super Scythe Arm Cleaver', origin: 'Predator Concrete Jungle' },
  { id: 'tri_maul', name: 'Tri-Blade Maul', origin: 'Concrete Jungle / AVP Capcom 1994' },
  { id: 'broadsword', name: 'Ceremonial Yautja Broadsword', origin: 'AVP Extinction' },
  { id: 'katana', name: 'Samurai Yautja Katana', origin: 'Hunting Grounds' },
  { id: 'alpha_sickle', name: 'Alpha Bone Sickle', origin: 'Hunting Grounds' },
  { id: 'viking_axe', name: 'Viking Double-Headed Battle Axe', origin: 'Hunting Grounds' },
  { id: 'daggers', name: 'Ceremonial Yautja Daggers', origin: 'Predator 2 / AVP' },
  { id: 'war_club', name: 'Bone War Club', origin: 'Hunting Grounds' },
  { id: 'feral_shield', name: 'Feral Shield & Cut Blade', origin: 'Prey 2022' },
  { id: 'pirate_hook', name: 'Pirate Arm Hook', origin: 'Hunting Grounds' },

  // 13-19: LONG REACH & RANGED BLADES
  { id: 'combistick', name: 'Telescopic Combistick Spear', origin: 'Predator 2 1990' },
  { id: 'glaive', name: 'Yautja Glaive Spear', origin: 'Concrete Jungle' },
  { id: 'smart_disc', name: 'Smart-Disc Laser Rotor', origin: 'Predator 2' },
  { id: 'shuriken', name: '6-Blade Telescopic Shuriken', origin: 'AVP 2004' },
  { id: 'compound_bow', name: 'Yautja Compound Bow', origin: 'Hunting Grounds' },
  { id: 'crossbow', name: 'Homing Bolt Crossbow', origin: 'Prey 2022' },
  { id: 'speargun', name: 'Laser Needle SpearGun', origin: 'Predator 2 / AVP 1999 PC' },

  // 20-25: HEAVY PLASMA WEAPONRY
  { id: 'plasma_caster', name: 'Shoulder Plasma Caster (Single)', origin: 'Predator 1987' },
  { id: 'dual_caster', name: 'Dual Shoulder Plasma Cannons', origin: 'AVP Requiem (Wolf)' },
  { id: 'plasma_pistol', name: 'Handheld Plasma Pistol', origin: 'AVP Requiem' },
  { id: 'gatling_plasma', name: 'Gatling Plasma Heavy Cannon', origin: 'Predators 2010' },
  { id: 'burner_rifle', name: 'Burner Plasma Rifle', origin: 'AVP Extinction' },
  { id: 'plasma_whip', name: 'Vertebrae Plasma Whip', origin: 'AVP Requiem' },

  // 26-36: TRAPS, GADGETS & TACTICAL DESTRUCTORS
  { id: 'netgun', name: 'Razor-Wire Netgun', origin: 'Predator 2' },
  { id: 'plasma_turret', name: 'Plasma Deployable Sentry Turret', origin: 'AVP Extinction' },
  { id: 'plasma_mines', name: 'Proximity Plasma Trip-Mines', origin: 'AVP 2010' },
  { id: 'emp_mine', name: 'Sonic EMP Disruption Mine', origin: 'The Predator 2018' },
  { id: 'bear_trap', name: 'Yautja Steel Bear Trap', origin: 'Hunting Grounds' },
  { id: 'audio_lure', name: 'Audio Lure & Voice Mimicry Module', origin: 'Predator 1987' },
  { id: 'medicomp', name: 'Medicomp Bio-Gel Injection Kit', origin: 'Predator 1987' },
  { id: 'acid_solvent', name: 'Dissolving Blue Acid Solvent Flask', origin: 'AVP Requiem' },
  { id: 'cloak', name: 'Active Camouflage Cloaking Device', origin: 'All Lore' },
  { id: 'thermal_mask', name: 'Thermal Multi-Vision Bio-Mask', origin: 'All Lore' },
  { id: 'nuke_gauntlet', name: 'Tactical Nuke Wrist Computer', origin: 'Predator 1987' }
];

export const CHARACTERS_DATA = [
  {
    id: 'jungle_hunter',
    name: 'JUNGLE HUNTER (1987)',
    classTag: 'GUERRIER ÉQUILIBRÉ (VAL VERDE)',
    icon: '👽',
    lore: 'Le prédateur classique des forêts tropicales. Lames de poignet jumelles, Canon Plasma d\'Épaule, Medicomp, Mines et Auto-Destruction nucléaire.',
    stats: { hp: 1000, maxHp: 1000, moveSpeed: 16, meleeDamage: 120, plasmaDamage: 250, plasmaEnergyCost: 20 },
    weapons: {
      primary: '🔪 Dual Retractable Wristblades',
      secondary: '🪓 Ceremonial Yautja Battle Axe',
      special: '💥 Shoulder Plasma Cannon',
      uniqueAbility: '⚡ Musou: Surcharge Plasma Dévastatrice',
      gadgets: '💉 Medicomp Bio-Gel [Z] & ☢️ Nuke Gauntlet [N]'
    },
    colors: { skin: 0x8a795d, armor: 0x3a3f47, mask: 0x6e7582, plasma: 0x00d2ff, dreads: 0x111111 }
  },
  {
    id: 'wolf_predator',
    name: 'WOLF PREDATOR (AVP REQUIEM)',
    classTag: 'NETTOYEUR VÉTÉRAN',
    icon: '🐺',
    lore: 'Le nettoyeur de ruche. Double canon plasma, Fouet en vertèbres, Solvant d\'acide, Pistolet plasma et Mines de proximité.',
    stats: { hp: 1150, maxHp: 1150, moveSpeed: 17, meleeDamage: 145, plasmaDamage: 280, plasmaEnergyCost: 16 },
    weapons: {
      primary: '🔪 Dual Extended Wristblades',
      secondary: '🐍 Vertebrae Plasma Whip',
      special: '💥 Dual Shoulder Plasma Cannons',
      uniqueAbility: '🔥 Musou: Solvant d\'Acide Liquéfacteur',
      gadgets: '🧪 Acid Solvent Flask [B] & 💉 Medicomp [Z]'
    },
    colors: { skin: 0x7a6c58, armor: 0x222830, mask: 0x505866, plasma: 0x00ffff, dreads: 0x0a0a0a }
  },
  {
    id: 'alpha_predator',
    name: 'ALPHA PREDATOR (HUNTING GROUNDS)',
    classTag: 'PRÉDATEUR ANCESTRAL',
    icon: '🦴',
    lore: 'Le premier Yautja s\'étant révolté contre les Amangi. Alpha Bone Sickle géante et Yautja Compound Bow.',
    stats: { hp: 1200, maxHp: 1200, moveSpeed: 18, meleeDamage: 160, plasmaDamage: 220, plasmaEnergyCost: 15 },
    weapons: {
      primary: '🦴 Primitive Alpha Bone Sickle',
      secondary: '🏹 Yautja Compound Bow',
      special: '💥 Shoulder Plasma Cannon',
      uniqueAbility: '⚡ Musou: Massacre Ancestral à la Faux',
      gadgets: '🪤 Steel Bear Trap [T] & 💉 Medicomp [Z]'
    },
    colors: { skin: 0x6e604f, armor: 0x3d3226, mask: 0x827059, plasma: 0x00d2ff, dreads: 0x14100c }
  },
  {
    id: 'feral_predator',
    name: 'FERAL PREDATOR (PREY 2022)',
    classTag: 'CHASSEUR ARCHAÏQUE',
    icon: '🛡️',
    lore: 'Le prédateur primitif de 1719. Bouclier métallique rétractable, Crossbow à flèches guidées et Dagues d\'os.',
    stats: { hp: 1000, maxHp: 1000, moveSpeed: 19, meleeDamage: 135, plasmaDamage: 210, plasmaEnergyCost: 15 },
    weapons: {
      primary: '🛡️ Retractable Metal Shield & Bone Daggers',
      secondary: '🏹 Homing Bolt Crossbow',
      special: '💥 Laser Guided Needle Gun',
      uniqueAbility: '🌀 Musou: Charge de Bouclier Mutilante',
      gadgets: '💉 Medicomp Bio-Gel [Z]'
    },
    colors: { skin: 0x635745, armor: 0x3d3123, mask: 0x4a3b2a, plasma: 0xff8800, dreads: 0x1c1712 }
  },
  {
    id: 'samurai_predator',
    name: 'SAMURAI PREDATOR (PHG DLC)',
    classTag: 'RONIN DU SANG',
    icon: '🥷',
    lore: 'Le guerrier d\'honneur féodal. Samurai Katana infligeant des saignements et Disque Smart-Disc.',
    stats: { hp: 1050, maxHp: 1050, moveSpeed: 19, meleeDamage: 150, plasmaDamage: 200, plasmaEnergyCost: 18 },
    weapons: {
      primary: '⚔️ Yautja Samurai Katana',
      secondary: '🛸 Smart-Disc Laser Rotor',
      special: '💥 Shoulder Plasma Cannon',
      uniqueAbility: '🌪️ Musou: Entaille du Dragon Ronin',
      gadgets: '🪤 Steel Bear Trap [T] & 💉 Medicomp [Z]'
    },
    colors: { skin: 0x8a7761, armor: 0x4a1818, mask: 0x821c1c, plasma: 0xff3300, dreads: 0x1a1a1a }
  },
  {
    id: 'viking_predator',
    name: 'VIKING PREDATOR (PHG DLC)',
    classTag: 'BERSERKER NORDIQUE',
    icon: '🪓',
    lore: 'Le géant nordique. Viking Battle Axe à deux têtes et War Club lourd.',
    stats: { hp: 1350, maxHp: 1350, moveSpeed: 14, meleeDamage: 175, plasmaDamage: 260, plasmaEnergyCost: 30 },
    weapons: {
      primary: '🪓 Double-Headed Viking Battle Axe',
      secondary: '🔨 Heavy Bone War Club',
      special: '💣 Heavy Plasma Blaster',
      uniqueAbility: '🔥 Musou: Frénésie du Valhalla 360°',
      gadgets: '🪤 Steel Bear Trap [T] & 💉 Medicomp [Z]'
    },
    colors: { skin: 0x5c4d3c, armor: 0x2e251c, mask: 0x6e5944, plasma: 0xffaa00, dreads: 0x0f0c09 }
  },
  {
    id: 'city_hunter',
    name: 'CITY HUNTER (1990)',
    classTag: 'TRAQUEUR AGILE',
    icon: '⚡',
    lore: 'Le chasseur urbain. Combistick Spear, Smart-Disc et Netgun.',
    stats: { hp: 850, maxHp: 850, moveSpeed: 19, meleeDamage: 100, plasmaDamage: 180, plasmaEnergyCost: 15 },
    weapons: {
      primary: '🗡️ Telescopic Combistick Spear',
      secondary: '🛸 Smart-Disc',
      special: '💥 Handheld Plasma Pistol',
      uniqueAbility: '🌪️ Musou: Tempête de Disques Boomerang',
      gadgets: '🕸️ Netgun & 💉 Medicomp [Z]'
    },
    colors: { skin: 0x9e8869, armor: 0x4a3b2c, mask: 0x826c59, plasma: 0x00ffff, dreads: 0x1a1a1a }
  }
];
