/** Historical Alien_base v1 identity snapshot for 36 equipment and 7 hunters.
 * Its labels are documentary metadata, not authority over current reference kits. */
const freezeDeep = value => {
 for (const child of Object.values(value)) if (child && typeof child === 'object') freezeDeep(child);
 return Object.freeze(value);
};
export const YAUTJA_ALIEN_BASE_V1 = freezeDeep({
  "schemaVersion": "1.0.0",
  "authority": "darknigthmare/alien_base",
  "authorityCommit": "3f124325102a199a6691a41c8b288ea95f61da8c",
  "game": "Yautja-hive-warriors",
  "entities": {
    "character.yautja.alpha_predator": {
      "id": "character.yautja.alpha_predator",
      "name": "ALPHA PREDATOR (HUNTING GROUNDS)",
      "category": "character"
    },
    "character.yautja.city_hunter": {
      "id": "character.yautja.city_hunter",
      "name": "CITY HUNTER (1990)",
      "category": "character"
    },
    "character.yautja.feral_predator": {
      "id": "character.yautja.feral_predator",
      "name": "FERAL PREDATOR (PREY 2022)",
      "category": "character"
    },
    "character.yautja.jungle_hunter": {
      "id": "character.yautja.jungle_hunter",
      "name": "JUNGLE HUNTER (1987)",
      "category": "character"
    },
    "character.yautja.samurai_predator": {
      "id": "character.yautja.samurai_predator",
      "name": "SAMURAI PREDATOR (PHG DLC)",
      "category": "character"
    },
    "character.yautja.viking_predator": {
      "id": "character.yautja.viking_predator",
      "name": "VIKING PREDATOR (PHG DLC)",
      "category": "character"
    },
    "character.yautja.wolf_predator": {
      "id": "character.yautja.wolf_predator",
      "name": "WOLF PREDATOR (AVP REQUIEM)",
      "category": "character"
    },
    "item.yautja.acid_solvent": {
      "id": "item.yautja.acid_solvent",
      "name": "Dissolving Blue Acid Solvent Flask",
      "category": "equipment"
    },
    "item.yautja.alpha_sickle": {
      "id": "item.yautja.alpha_sickle",
      "name": "Alpha Bone Sickle",
      "category": "equipment"
    },
    "item.yautja.audio_lure": {
      "id": "item.yautja.audio_lure",
      "name": "Audio Lure & Voice Mimicry Module",
      "category": "equipment"
    },
    "item.yautja.bear_trap": {
      "id": "item.yautja.bear_trap",
      "name": "Yautja Steel Bear Trap",
      "category": "equipment"
    },
    "item.yautja.broadsword": {
      "id": "item.yautja.broadsword",
      "name": "Ceremonial Yautja Broadsword",
      "category": "equipment"
    },
    "item.yautja.burner_rifle": {
      "id": "item.yautja.burner_rifle",
      "name": "Burner Plasma Rifle",
      "category": "equipment"
    },
    "item.yautja.cloak": {
      "id": "item.yautja.cloak",
      "name": "Active Camouflage Cloaking Device",
      "category": "equipment"
    },
    "item.yautja.combistick": {
      "id": "item.yautja.combistick",
      "name": "Combi-Stick",
      "category": "equipment"
    },
    "item.yautja.compound_bow": {
      "id": "item.yautja.compound_bow",
      "name": "Yautja Compound Bow",
      "category": "equipment"
    },
    "item.yautja.crossbow": {
      "id": "item.yautja.crossbow",
      "name": "Homing Bolt Crossbow",
      "category": "equipment"
    },
    "item.yautja.daggers": {
      "id": "item.yautja.daggers",
      "name": "Ceremonial Yautja Daggers",
      "category": "equipment"
    },
    "item.yautja.dual_caster": {
      "id": "item.yautja.dual_caster",
      "name": "Dual Shoulder Plasma Cannons",
      "category": "equipment"
    },
    "item.yautja.emp_mine": {
      "id": "item.yautja.emp_mine",
      "name": "Sonic EMP Disruption Mine",
      "category": "equipment"
    },
    "item.yautja.feral_shield": {
      "id": "item.yautja.feral_shield",
      "name": "Feral Shield & Cut Blade",
      "category": "equipment"
    },
    "item.yautja.gatling_plasma": {
      "id": "item.yautja.gatling_plasma",
      "name": "Gatling Plasma Heavy Cannon",
      "category": "equipment"
    },
    "item.yautja.glaive": {
      "id": "item.yautja.glaive",
      "name": "Yautja Glaive Spear",
      "category": "equipment"
    },
    "item.yautja.katana": {
      "id": "item.yautja.katana",
      "name": "Samurai Yautja Katana",
      "category": "equipment"
    },
    "item.yautja.medicomp": {
      "id": "item.yautja.medicomp",
      "name": "Medicomp Bio-Gel Injection Kit",
      "category": "equipment"
    },
    "item.yautja.netgun": {
      "id": "item.yautja.netgun",
      "name": "Razor-Wire Netgun",
      "category": "equipment"
    },
    "item.yautja.nuke_gauntlet": {
      "id": "item.yautja.nuke_gauntlet",
      "name": "Tactical Nuke Wrist Computer",
      "category": "equipment"
    },
    "item.yautja.pirate_hook": {
      "id": "item.yautja.pirate_hook",
      "name": "Pirate Arm Hook",
      "category": "equipment"
    },
    "item.yautja.plasma_caster": {
      "id": "item.yautja.plasma_caster",
      "name": "Shoulder Plasma Caster (Single)",
      "category": "equipment"
    },
    "item.yautja.plasma_mines": {
      "id": "item.yautja.plasma_mines",
      "name": "Proximity Plasma Trip-Mines",
      "category": "equipment"
    },
    "item.yautja.plasma_pistol": {
      "id": "item.yautja.plasma_pistol",
      "name": "Handheld Plasma Pistol",
      "category": "equipment"
    },
    "item.yautja.plasma_turret": {
      "id": "item.yautja.plasma_turret",
      "name": "Plasma Deployable Sentry Turret",
      "category": "equipment"
    },
    "item.yautja.plasma_whip": {
      "id": "item.yautja.plasma_whip",
      "name": "Vertebrae Plasma Whip",
      "category": "equipment"
    },
    "item.yautja.shuriken": {
      "id": "item.yautja.shuriken",
      "name": "6-Blade Telescopic Shuriken",
      "category": "equipment"
    },
    "item.yautja.single_scythe": {
      "id": "item.yautja.single_scythe",
      "name": "Extended Single Scythe Wristblade",
      "category": "equipment"
    },
    "item.yautja.smart_disc": {
      "id": "item.yautja.smart_disc",
      "name": "Smart Disc",
      "category": "equipment"
    },
    "item.yautja.speargun": {
      "id": "item.yautja.speargun",
      "name": "Laser Needle SpearGun",
      "category": "equipment"
    },
    "item.yautja.super_cleaver": {
      "id": "item.yautja.super_cleaver",
      "name": "Super Scythe Arm Cleaver",
      "category": "equipment"
    },
    "item.yautja.thermal_mask": {
      "id": "item.yautja.thermal_mask",
      "name": "Thermal Multi-Vision Bio-Mask",
      "category": "equipment"
    },
    "item.yautja.tri_maul": {
      "id": "item.yautja.tri_maul",
      "name": "Tri-Blade Maul",
      "category": "equipment"
    },
    "item.yautja.viking_axe": {
      "id": "item.yautja.viking_axe",
      "name": "Viking Double-Headed Battle Axe",
      "category": "equipment"
    },
    "item.yautja.war_club": {
      "id": "item.yautja.war_club",
      "name": "Bone War Club",
      "category": "equipment"
    },
    "item.yautja.wristblades": {
      "id": "item.yautja.wristblades",
      "name": "Wrist Blades",
      "category": "equipment"
    }
  },
  "groups": {
    "armory": {
      "wristblades": {
        "id": "item.yautja.wristblades"
      },
      "single_scythe": {
        "id": "item.yautja.single_scythe"
      },
      "super_cleaver": {
        "id": "item.yautja.super_cleaver"
      },
      "tri_maul": {
        "id": "item.yautja.tri_maul"
      },
      "broadsword": {
        "id": "item.yautja.broadsword"
      },
      "katana": {
        "id": "item.yautja.katana"
      },
      "alpha_sickle": {
        "id": "item.yautja.alpha_sickle"
      },
      "viking_axe": {
        "id": "item.yautja.viking_axe"
      },
      "daggers": {
        "id": "item.yautja.daggers"
      },
      "war_club": {
        "id": "item.yautja.war_club"
      },
      "feral_shield": {
        "id": "item.yautja.feral_shield"
      },
      "pirate_hook": {
        "id": "item.yautja.pirate_hook"
      },
      "combistick": {
        "id": "item.yautja.combistick"
      },
      "glaive": {
        "id": "item.yautja.glaive"
      },
      "smart_disc": {
        "id": "item.yautja.smart_disc"
      },
      "shuriken": {
        "id": "item.yautja.shuriken"
      },
      "compound_bow": {
        "id": "item.yautja.compound_bow"
      },
      "crossbow": {
        "id": "item.yautja.crossbow"
      },
      "speargun": {
        "id": "item.yautja.speargun"
      },
      "plasma_caster": {
        "id": "item.yautja.plasma_caster"
      },
      "dual_caster": {
        "id": "item.yautja.dual_caster"
      },
      "plasma_pistol": {
        "id": "item.yautja.plasma_pistol"
      },
      "gatling_plasma": {
        "id": "item.yautja.gatling_plasma"
      },
      "burner_rifle": {
        "id": "item.yautja.burner_rifle"
      },
      "plasma_whip": {
        "id": "item.yautja.plasma_whip"
      },
      "netgun": {
        "id": "item.yautja.netgun"
      },
      "plasma_turret": {
        "id": "item.yautja.plasma_turret"
      },
      "plasma_mines": {
        "id": "item.yautja.plasma_mines"
      },
      "emp_mine": {
        "id": "item.yautja.emp_mine"
      },
      "bear_trap": {
        "id": "item.yautja.bear_trap"
      },
      "audio_lure": {
        "id": "item.yautja.audio_lure"
      },
      "medicomp": {
        "id": "item.yautja.medicomp"
      },
      "acid_solvent": {
        "id": "item.yautja.acid_solvent"
      },
      "cloak": {
        "id": "item.yautja.cloak"
      },
      "thermal_mask": {
        "id": "item.yautja.thermal_mask"
      },
      "nuke_gauntlet": {
        "id": "item.yautja.nuke_gauntlet"
      }
    },
    "characters": {
      "jungle_hunter": {
        "id": "character.yautja.jungle_hunter"
      },
      "wolf_predator": {
        "id": "character.yautja.wolf_predator"
      },
      "alpha_predator": {
        "id": "character.yautja.alpha_predator"
      },
      "feral_predator": {
        "id": "character.yautja.feral_predator"
      },
      "samurai_predator": {
        "id": "character.yautja.samurai_predator"
      },
      "viking_predator": {
        "id": "character.yautja.viking_predator"
      },
      "city_hunter": {
        "id": "character.yautja.city_hunter"
      }
    }
  },
  "statsPolicy": "local-yautja-gameplay-stats-only"
});
export function resolveAlienBaseIdentityV1(group,localId){
 if(typeof group!=='string'||typeof localId!=='string')return null;
 if(!Object.hasOwn(YAUTJA_ALIEN_BASE_V1.groups,group))return null;
 const bindings=YAUTJA_ALIEN_BASE_V1.groups[group];
 if(!Object.hasOwn(bindings,localId))return null;
 const id=bindings[localId].id;
 return Object.hasOwn(YAUTJA_ALIEN_BASE_V1.entities,id)?YAUTJA_ALIEN_BASE_V1.entities[id]:null;
}
