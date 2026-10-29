/* Cross-media armory index. A listed item does not imply a complete runtime
 * implementation or permission for every hunter. Reference cards use the same
 * equipment defaults as the loadout resolver; stats and musou are adaptations. */
import { getHunterReferenceCard } from './hunterArsenal.js';

export const ULTIMATE_YAUTJA_ARMORY = [
  // 1-12: MELEE WEAPONS
  { id: 'wristblades', name: 'Dual Retractable Wristblades', origin: 'Predator 1987 / AVP' },
  { id: 'single_scythe', name: 'Extended Single Scythe Wristblade', origin: 'Predators 2010' },
  { id: 'super_cleaver', name: 'Super Scythe Arm Cleaver', origin: 'Predator Concrete Jungle' },
  { id: 'tri_maul', name: 'Tri-Blade Maul', origin: 'Concrete Jungle / AVP Capcom 1994' },
  { id: 'broadsword', name: 'Ceremonial Yautja Broadsword', origin: 'AVP Extinction' },
  { id: 'katana', name: 'Samurai Yautja Katana', origin: 'Hunting Grounds' },
  { id: 'alpha_sickle', name: 'Alpha Bone Sickle', origin: 'Hunting Grounds' },
  { id: 'viking_axe', name: 'Viking Battle Axe', origin: 'Hunting Grounds' },
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
  { id: 'crossbow', name: 'Feral Guided Bolt Launcher', origin: 'Prey 2022' },
  { id: 'speargun', name: 'Laser Needle SpearGun', origin: 'Predator 2 / AVP 1999 PC' },

  // 20-25: HEAVY PLASMA WEAPONRY
  { id: 'plasma_caster', name: 'Shoulder Plasma Caster (Single)', origin: 'Predator 1987' },
  { id: 'dual_caster', name: 'Dual Shoulder Plasma Cannons', origin: 'AVP Requiem (Wolf)' },
  { id: 'plasma_pistol', name: 'Handheld Plasma Pistol', origin: 'AVP Requiem' },
  { id: 'gatling_plasma', name: 'Gatling Plasma Heavy Cannon', origin: 'Predators 2010' },
  { id: 'burner_rifle', name: 'Burner Plasma Rifle', origin: 'AVP Extinction' },
  { id: 'plasma_whip', name: 'Wolf Segmented Whip', origin: 'AVP Requiem' },

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

const CHARACTER_PRESENTATIONS = [
  {
    id: 'jungle_hunter',
    name: 'JUNGLE HUNTER (1987)',
    classTag: 'GUERRIER ÉQUILIBRÉ',
    icon: '👽',
    lore: 'Le prédateur classique des forêts tropicales. Lames de poignet jumelles, Canon Plasma d\'Épaule, Médicomp et dispositif d’autodestruction. Le kit de référence n’ajoute ni hache ni mines.',
    stats: { hp: 1000, maxHp: 1000, moveSpeed: 16, meleeDamage: 120, plasmaDamage: 250, plasmaEnergyCost: 20 },
    weapons: {
      uniqueAbility: '⚡ Musou: Surcharge Plasma Dévastatrice'
    },
    colors: { skin: 0x8a795d, armor: 0x3a3f47, mask: 0x6e7582, plasma: 0x00d2ff, dreads: 0x111111 }
  },
  {
    id: 'wolf_predator',
    name: 'WOLF PREDATOR (AVP REQUIEM)',
    classTag: 'NETTOYEUR VÉTÉRAN',
    icon: '🐺',
    lore: 'Le nettoyeur d’AVP: Requiem. Deux canons plasma, fouet segmenté, liquide dissolvant et pistolet plasma. Les effets et le Musou sont adaptés au jeu.',
    stats: { hp: 1150, maxHp: 1150, moveSpeed: 17, meleeDamage: 145, plasmaDamage: 280, plasmaEnergyCost: 16 },
    weapons: {
      uniqueAbility: '🔥 Musou: Solvant d\'Acide Liquéfacteur'
    },
    colors: { skin: 0x7a6c58, armor: 0x222830, mask: 0x505866, plasma: 0x00ffff, dreads: 0x0a0a0a }
  },
  {
    id: 'alpha_predator',
    name: 'ALPHA PREDATOR (HUNTING GROUNDS)',
    classTag: 'PRÉDATEUR ANCESTRAL',
    icon: '🦴',
    lore: 'L’incarnation Alpha de Predator: Hunting Grounds, associée à sa faucille. L’arc composite complète ici un kit de gameplay ; ce n’est pas un inventaire d’une scène de film.',
    stats: { hp: 1200, maxHp: 1200, moveSpeed: 18, meleeDamage: 160, plasmaDamage: 220, plasmaEnergyCost: 15 },
    weapons: {
      uniqueAbility: '⚡ Musou: Massacre Ancestral à la Faux'
    },
    colors: { skin: 0x6e604f, armor: 0x3d3226, mask: 0x827059, plasma: 0x00d2ff, dreads: 0x14100c }
  },
  {
    id: 'feral_predator',
    name: 'FERAL PREDATOR (PREY 2022)',
    classTag: 'CHASSEUR ARCHAÏQUE',
    icon: '🛡️',
    lore: 'Le chasseur de Prey, situé en 1719 : lames de poignet, Combistick séparable, bouclier rétractable et lance-projectiles guidés. Le kit de référence n’utilise pas de canon plasma.',
    stats: { hp: 1000, maxHp: 1000, moveSpeed: 19, meleeDamage: 135, plasmaDamage: 210, plasmaEnergyCost: 15 },
    weapons: {
      uniqueAbility: '🌀 Musou: Charge de Bouclier Mutilante'
    },
    colors: { skin: 0x635745, armor: 0x3d3123, mask: 0x4a3b2a, plasma: 0xff8800, dreads: 0x1c1712 }
  },
  {
    id: 'samurai_predator',
    name: 'SAMURAI PREDATOR (PHG DLC)',
    classTag: 'RONIN DU SANG',
    icon: '🥷',
    lore: 'La classe Samurai de Predator: Hunting Grounds et son katana. Cette incarnation du jeu reste distincte des chasseurs de Predator: Killer of Killers.',
    stats: { hp: 1050, maxHp: 1050, moveSpeed: 19, meleeDamage: 150, plasmaDamage: 200, plasmaEnergyCost: 18 },
    weapons: {
      uniqueAbility: '🌪️ Musou: Entaille du Dragon Ronin'
    },
    colors: { skin: 0x8a7761, armor: 0x4a1818, mask: 0x821c1c, plasma: 0xff3300, dreads: 0x1a1a1a }
  },
  {
    id: 'viking_predator',
    name: 'VIKING PREDATOR (PHG DLC)',
    classTag: 'BERSERKER NORDIQUE',
    icon: '🪓',
    lore: 'La classe Viking de Predator: Hunting Grounds et sa hache de combat. Son kit jouable utilise un Smart-Disc ; aucun War Club non sélectionnable n’est annoncé comme arme équipée.',
    stats: { hp: 1350, maxHp: 1350, moveSpeed: 14, meleeDamage: 175, plasmaDamage: 260, plasmaEnergyCost: 30 },
    weapons: {
      uniqueAbility: '🔥 Musou: Frénésie du Valhalla 360°'
    },
    colors: { skin: 0x5c4d3c, armor: 0x2e251c, mask: 0x6e5944, plasma: 0xffaa00, dreads: 0x0f0c09 }
  },
  {
    id: 'city_hunter',
    name: 'CITY HUNTER (PREDATOR 2)',
    classTag: 'TRAQUEUR AGILE',
    icon: '⚡',
    lore: 'Le chasseur urbain de Predator 2 (film de 1990, récit situé en 1997). Combistick, Smart-Disc, lance-filet et canon plasma d’épaule ; le pistolet de Wolf n’appartient pas à ce kit.',
    stats: { hp: 850, maxHp: 850, moveSpeed: 19, meleeDamage: 100, plasmaDamage: 180, plasmaEnergyCost: 15 },
    weapons: {
      uniqueAbility: '🌪️ Musou: Tempête de Disques Boomerang'
    },
    colors: { skin: 0x9e8869, armor: 0x4a3b2c, mask: 0x826c59, plasma: 0x00ffff, dreads: 0x1a1a1a }
  }
];

// UIManager keeps its public schema, while all four equipment fields now come
// from the same reference kit that Player.applyLoadout resolves.
export const CHARACTERS_DATA = CHARACTER_PRESENTATIONS.map(character => {
  const card = getHunterReferenceCard(character.id);
  if (!card) throw new Error(`Missing hunter reference card: ${character.id}`);
  const { weapons, ...reference } = card;
  return { ...character, weapons: { ...weapons,
    uniqueAbility: `${character.weapons.uniqueAbility} — adaptation de gameplay` }, reference };
});
