/* Reconciled reference mechanism implementations from main 9c18c19 (v67).
 * Historical "1:1" labels in inherited comments are not a verification claim.
 * Instantiation is governed by ReferenceLevelMechanisms: original stage content
 * is preserved, while incompatible eras/species are not mixed automatically.
 * Geometry/material ownership, random state and timers belong to Environment.
 */
/* Procedural 3D Level Environment Generator */

import * as THREE from 'three';
import { prepareSarii, orderSarii, damageSarii, updateSarii } from './SariiCompanion.js';
import { walkRampGeometry } from './ReferenceWalkSurfaces.js';

// These are explicit game-unit contracts, not measurements of film weapons.
export const PREY_INTERACTION_RULES = Object.freeze({
  pistolRange: 28, pistolDamage: 1200, flowerSeconds: 35, taabeSeconds: 25,
  arrowsGranted: 6, maxArrows: 12, axeChargesGranted: 4, maxAxeCharges: 4,
  powderBlastRadius: 16, powderBlastDamage: 750, powderFireRadius: 8.5,
  powderFireSeconds: 18, powderFireDamagePerSecond: 110,
  cauldronRadius: 7.5, cauldronDamage: 500, mudSeconds: 30
});

function preyCanInteract(environment, player, prop, usedFlag, range) {
  return !!prop && !!player?.position?.isVector3 && player.hp > 0 && !prop[usedFlag] &&
    !environment.game?.isPaused && !environment.game?.photoMode?.isActive &&
    !environment.game?.dropPod?.isActive && player.position.distanceTo(prop.pos) <= range;
}

function preyFaction(environment, player, horde) {
  return player?.factionId ?? environment.game?.battleSimulation?.config.playerFaction ?? horde?.battleSimulation?.config.playerFaction ?? 'player_clan';
}

function preyTargets(environment, horde, bosses) {
  return [...new Set([...(horde?.getActiveCombatants?.() ?? horde?.aliens ?? []), bosses?.activeBoss,
    ...[...(environment.game?.battleBridge?.actors?.values?.() ?? [])].map(entry => entry.actor)])]
    .filter(actor => actor?.hp > 0 && actor.mesh?.position?.isVector3);
}

function preyCanHit(environment, target, faction, horde) {
  const simulation = environment.game?.battleSimulation ?? horde?.battleSimulation;
  return !simulation || !target.factionId || simulation.areHostile(faction, target.factionId);
}

function preyClearShot(environment, from, to, ignoredRoot = null) {
  const ignore = new Set();
  if (ignoredRoot) for (const contact of environment.referenceContacts ?? []) {
    for (let node = contact.mesh; node; node = node.parent) if (node === ignoredRoot) { ignore.add(contact.collider); break; }
  }
  return environment.hasLineOfSight?.(from, to, { radius: .025, ignore }) !== false;
}

function preyDamage(environment, actor, amount, horde, bosses, faction, cause) {
  if (!(amount > 0) || !Number.isFinite(amount) || !(actor?.hp > 0) || !preyCanHit(environment, actor, faction, horde)) return 0;
  const before = actor.hp, details = { cause, killerFaction: faction };
  if (actor === bosses?.activeBoss) {
    if (typeof bosses.takeDamage !== 'function') return 0;
    bosses.takeDamage(amount, horde, details);
  } else if ((horde?.getActiveCombatants?.() ?? horde?.aliens ?? []).includes(actor)) {
    if (typeof horde.applyDamage !== 'function') return 0;
    horde.applyDamage(actor, amount, details);
  } else {
    const manager = actor.combatManager;
    if (!manager?.defeatCombatant && !manager?.defeatSynthetic) return 0;
    actor.hp = Math.max(0, actor.hp - amount); actor.lastDamageFaction = faction;
    if (actor.hp === 0) (manager.defeatCombatant ?? manager.defeatSynthetic).call(manager, actor, details);
  }
  return Math.max(0, before - actor.hp);
}

function preyStock(player, key, extra, maximum) {
  const raw = player[key], before = Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : 0;
  player[key] = Math.min(maximum, before + extra); return player[key] - before;
}

const PREY_SAVE_PROPS = Object.freeze({ boneMaskDecoy: null, orangeFlowerPatch: 'isHarvested',
  adoliniPistolPedestal: 'isClaimed', taabeRockPerch: 'isClaimed', grizzlyBearCarcass: 'isSkinned',
  naruTomahawkTree: 'isClaimed', trapperMedicalTent: 'isLooted', feralArsenalStation: 'isClaimed',
  sariiCompanion: 'isTamed', trapperBaitTree: 'isDetonated', trapperCampfireSpit: 'isToppled', preyMudSinkhole: null });
const PREY_SOURCE_LEVEL = 'prey_comanche_territory';
const preyFinitePoint = value => Array.isArray(value) && value.length === 3 && value.every(number => Number.isFinite(number) && Math.abs(number) <= 1e6);
const preyPlayers = environment => [environment.game?.player, environment.game?.player2];
function preyCreatePowderFire(environment, position, timer, ownerFaction) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(8.5, 8.5, .4, 24),
    new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: .65 }));
  mesh.position.copy(position); environment.addReferenceObject(mesh);
  return { mesh, pos: position.clone(), timer, ownerFaction };
}

export class ReferenceEnvironmentMechanisms {
  constructor(scene) {
    this.scene = scene;
    this.envObjects = [];
    this.modularSlabs = [];
    this.slabShiftTimer = 0;
    this.slabShiftCycle = 16.0; // Shifting cycle every 16s (AvP 2004 subterranean realignment)
    this.isSlabMoving = false;
    this.slabMoveProgress = 0;
    this.slabMoveDuration = 3.2;
    this.slabShiftToggle = false;
    this.catwalks = [];
    this.transformers = [];
    this.supplyCaches = [];
    this.blastDoors = [];
    this.resinPustules = [];
    this.acidTrenches = [];
    this.spaceJockeyPlatform = null;
    this.cargoCrane = null;
    this.cryoMedBays = [];
    this.eggNurseries = [];
    this.decompressionAirlock = null;
    this.steamConduits = [];
    this.chrysalisCocoons = [];
    // v43.0 Systems
    this.queenOvipositor = null;
    this.lightningRods = [];
    this.ionStormTimer = 0;
    this.activeLightningBolt = null;
    this.fallenMarines = [];
    this.nitrogenTanks = [];
    this.activeFreezeZones = [];
    this.resinWebbings = [];
    // v44.0 Systems
    this.cryoSpecimenTubes = [];
    this.powerLoader = null;
    this.acidRainActive = false;
    this.acidRainTimer = 0;
    this.acidRainDuration = 0;
    this.acidRainParticleSystem = null;
    // v45.0 Systems
    this.drivableAPC = null;
    this.reactorConsole = null;
    this.reactorMeltdownActive = false;
    this.reactorMeltdownTimer = 180.0;
    this.reactorAlarmCooldown = 0;
    this.electricFloorGrids = [];
    this.deconAirlock = null;
    // v46.0 Systems
    this.mountedSmartgun = null;
    this.derelictChamber = null;
    this.fuelLines = [];
    this.craneConsole = null;
    // v47.0 Systems
    this.engineerRuins = null;
    this.coolingTowerCryoVent = null;
    this.engineerUrns = [];
    this.mutagenPuddles = [];
    // v48.0 Systems
    this.moltenFoundry = null;
    this.alliedAndroids = [];
    this.volcanicStorm = {
      active: false,
      timer: 18.0,
      duration: 0,
      ashSystem: null
    };
    // v49.0 Systems (USCM M579 SAM Battery, USM Auriga Flooded Basin, Shrine of the Ancients)
    this.uscmMissileBattery = null;
    this.activeSAMMissiles = [];
    this.aurigaBasin = null;
    this.ancientShrine = null;
    // v50.0 Systems (WY 155mm Coastal Rail-Cannon, Cryo-Stasis Laboratory Sector)
    this.coastalRailCannon = null;
    this.activeRailShells = [];
    this.cryoStasisSector = null;
    // v51.0 Systems (Pressurized Acid Geysers, Engineer Sarcophagus Stasis Crypt)
    this.pressurizedAcidGeysers = [];
    this.engineerSarcophagus = null;
    // v52.0 Systems (Hydraulic Cargo Lift, Subterranean Infiltration Vents, Active Resupply Pods)
    this.hydraulicCargoLift = null;
    this.subterraneanVents = [];
    this.activeDropPods = [];
    // v53.0 Systems (Weyland-Yutani Breakable Specimen Stasis Vats & Cryo Coolant Freezing Zones)
    this.stasisSpecimenTanks = [];
    this.activeCryoCoolantClouds = [];
    // v54.0 Systems (Explosive JP-4 Fuel Barrels & WY Plasma Recharge Terminals)
    this.explosiveBarrels = [];
    this.activeBarrelFireZones = [];
    this.plasmaRechargeTerminals = [];
    // v55.0 Systems (Flooded Water Drainage Puddles & Cloaking Disruption)
    this.floodedWaterPuddles = [];
    // v56.0 Master Level Design Systems (Crashed Scout Ship, Charon Labs, Game Preserve, Fixed UA 571-C Sentry, Ammonia Pipes, Collapsible Grates, Tactical Covers)
    this.crashedScoutShip = null;
    this.charonGeneticsLab = null;
    this.gamePreserveCamp = null;
    this.fixedSentryEmplacements = [];
    this.ammoniaCoolantPipes = [];
    this.activeAmmoniaClouds = [];
    this.collapsibleFloorGrates = [];
    this.tacticalCoverObstacles = [];
    this.huntingBoughs = [];
    // v56.5 Master Level Design Sector Overhauls
    this.valVerdeProps = null;
    this.laRooftopExpansion = null;
    this.pyramidSacrificial = null;
    this.romulusStationExpansion = null;
    this.hiveWorldExpansion = null;
    this.mudPits = [];
    this.harvestableRoyalJelly = [];
    this.scytheTraps = [];
    this.activeWaterDeluge = null;
    this.zeroGActiveTimer = 0;
    // v57.0 Master Level Design 1:1 Overhaul
    this.gunnisonExpansion = null;
    this.charonExpansion = null;
    this.gamePreserveExpansion = null;
    this.gunnisonPowerPole = null;
    this.activePowerArcs = [];
    this.neuralInhibitors = [];
    this.boulderTraps = [];
    this.dutchLogTrap = null;
    this.hvacChillers = [];
    this.activeFreonClouds = [];
    this.cryptReliquaryVault = null;
    this.windowCradle = null;
    this.sandbagBunker = null;
    // v58.0 Master 1:1 Predator 1 (1987) Val Verde Systems
    this.billyLogBridge = null;
    this.hopperExecutionSite = null;
    this.guerrillaWatchtower = null;
    this.rebelFuelDepot = null;
    this.oldPainlessClearing = null;
    this.dutchBonfireCamp = null;
    this.valVerdeWaterfall = null;
    this.punjiStakeTraps = [];
    this.rebelFuelBarrels = [];
    this.activeValVerdeFireZones = [];
    // v59.0 Master 1:1 Predator 1 (1987) Val Verde Apex Systems
    this.canopyBoughHighways = [];
    this.dutchChallengeRock = null;
    this.dutchWorkbench = null;
    this.annaHostageCage = null;
    this.macPerimeterTripwire = null;
    this.wildBoarRoastSpit = null;
    this.yautjaCraterLocus = null;
    this.riverRapidsPath = null;
    this.activeIlluminationFlare = null;
    // v60.0 Master 1:1 Predator 2 (1990) LA Rooftops Systems
    this.easternColumbiaSpire = null;
    this.meatLockerFacility = null;
    this.kingWillieAltar = null;
    this.dannyBoyNetgun = null;
    this.lostTribeShipDais = null;
    this.cityHunterSurgery = null;
    this.harriganCruiser = null;
    this.smartDiscGirder = null;
    this.neonTransformer = null;
    this.activeMeatLockerCryo = null;
    this.subwayCar666 = null;
    this.owlfCommandVan = null;
    this.cartelPenthouse = null;
    this.poleVaultPad = null;
    this.fireEscapeStairs = null;
    this.boilingTarKettle = null;
    this.activeTarPuddles = [];
    // v61.0 Predators (2010) Game Preserve Systems
    this.nolandHideout = null;
    this.hanzoDuelArena = null;
    this.hellhoundKennel = null;
    this.nikolaiBlastMemorial = null;
    this.alienFloraPatch = null;
    this.superPredatorShipDais = null;
    this.celestialVistaMonolith = null;
    this.royceCliffWaterfall = null;
    this.royceTripwireTrap = null;
    this.activePreserveSmokeScreen = null;
    this.activePreserveFireZones = [];
    // v62.0 Predators (2010) Apex Polish Systems
    this.falconerDronePerch = null;
    this.cuchilloAcousticDecoy = null;
    this.mombassaPunjiTrap = null;
    this.royceBoneGong = null;
    this.isabelleSniperStash = null;
    this.activeGongFireBraziers = [];
    // v63.0 Val Verde Master Expansion (Predator 1987)
    this.dillonLastStand = null;
    this.ponchoGrenadeStash = null;
    this.hawkinsRadioBeacon = null;
    this.mudWaterfallBasin = null;
    // v63.0 The Predator (2018) Stargazer Systems
    this.stargazerVivisection = null;
    this.predatorKillerPod = null;
    this.crashedArkStarship = null;
    this.quinnSniperPerch = null;
    this.houndKennelStargazer = null;
    this.traegerWeaponLocker = null;
    this.stargazerShieldPylons = [];
    this.looniesTransportBus = null;
    this.shatteredOakArena = null;
    this.fugitiveGauntletLocker = null;
    this.friendlyLoboHound = null;
    this.baxleyCoyleBunker = null;
    this.cryoNitrogenTanks = [];
    this.nebraskaHarpoonRig = null;
    this.stargazerCanopyHighways = [];
    this.stargazerEnergyDome = null;
    this.roryTranslatorDesk = null;
    this.crashedArkTurbine = null;
    this.caseyDeconStation = null;
    // v65.0 Prey (2022) Comanche Territory Systems
    this.preyMudSinkhole = null;
    this.boneMaskDecoy = null;
    this.orangeFlowerPatch = null;
    this.trapperCampVoyageurs = null;
    this.adoliniPistolPedestal = null;
    this.taabeRockPerch = null;
    this.grizzlyBearCarcass = null;
    this.beaverDamCrossing = null;
    this.burnedForestCharredTrees = [];
    this.trapperBearTraps = [];
    this.naruTomahawkTree = null;
    this.trapperMedicalTent = null;
    this.feralArsenalStation = null;
    this.sariiCompanion = null;
    this.trapperBaitTree = null;
    this.cougarPineBough = null;
    this.activePowderKegFire = null;
    this.voyageurRiverRaft = null;
    this.comancheTotemPost = null;
    this.brushPitfallTrap = null;
    this.lightningSplitPine = null;
    this.trapperCampfireSpit = null;
    this.buffaloSkullCairn = null;
    this.feralSeveredGauntlet = null;
    this.ursaShieldProw = null;
    this.ursaDaneAxeAltar = null;
    this.kenjiKatanaStand = null;
    this.kenjiBambooDecoy = null;
    this.torresWarhawkWreck = null;
    this.torresBrowningNest = null;
    this.trioCryoStasisPods = null;
  }

  clearReferenceState() {
    this.envObjects.forEach(obj => this.removeReferenceObject(obj));
    this.envObjects = [];
    this.modularSlabs = [];
    this.catwalks = [];
    this.transformers.forEach(t => this.removeReferenceObject(t.mesh));
    this.transformers = [];
    this.supplyCaches.forEach(s => this.removeReferenceObject(s.mesh));
    this.supplyCaches = [];
    this.blastDoors.forEach(b => this.removeReferenceObject(b.mesh));
    this.blastDoors = [];
    this.resinPustules.forEach(p => this.removeReferenceObject(p.mesh));
    this.resinPustules = [];
    this.acidTrenches.forEach(t => this.removeReferenceObject(t.group));
    this.acidTrenches = [];
    if (this.spaceJockeyPlatform) {
      this.removeReferenceObject(this.spaceJockeyPlatform.group);
      this.spaceJockeyPlatform = null;
    }
    if (this.cargoCrane) {
      this.removeReferenceObject(this.cargoCrane.group);
      this.cargoCrane = null;
    }
    this.cryoMedBays.forEach(c => this.removeReferenceObject(c.mesh));
    this.cryoMedBays = [];
    this.eggNurseries.forEach(e => this.removeReferenceObject(e.group));
    this.eggNurseries = [];
    if (this.decompressionAirlock) {
      this.removeReferenceObject(this.decompressionAirlock.group);
      this.decompressionAirlock = null;
    }
    this.steamConduits.forEach(c => this.removeReferenceObject(c.group));
    this.steamConduits = [];
    this.chrysalisCocoons.forEach(c => this.removeReferenceObject(c.mesh));
    this.chrysalisCocoons = [];
    if (this.queenOvipositor) {
      this.removeReferenceObject(this.queenOvipositor.group);
      this.queenOvipositor = null;
    }
    this.lightningRods.forEach(r => this.removeReferenceObject(r.group));
    this.lightningRods = [];
    if (this.activeLightningBolt) {
      this.removeReferenceObject(this.activeLightningBolt);
      this.activeLightningBolt = null;
    }
    this.fallenMarines.forEach(m => this.removeReferenceObject(m.group));
    this.fallenMarines = [];
    this.nitrogenTanks.forEach(n => this.removeReferenceObject(n.group));
    this.nitrogenTanks = [];
    this.activeFreezeZones.forEach(z => this.removeReferenceObject(z.mesh));
    this.activeFreezeZones = [];
    this.resinWebbings.forEach(w => this.removeReferenceObject(w.mesh));
    this.resinWebbings = [];
    this.cryoSpecimenTubes.forEach(t => this.removeReferenceObject(t.group));
    this.cryoSpecimenTubes = [];
    if (this.powerLoader) {
      this.removeReferenceObject(this.powerLoader.group);
      this.powerLoader = null;
    }
    if (this.acidRainParticleSystem) {
      this.removeReferenceObject(this.acidRainParticleSystem);
      this.acidRainParticleSystem = null;
    }
    this.acidRainActive = false;
    this.acidRainTimer = 0;
    // v45.0 Cleanups
    if (this.drivableAPC) {
      this.removeReferenceObject(this.drivableAPC.group);
      this.drivableAPC = null;
    }
    if (this.reactorConsole) {
      this.removeReferenceObject(this.reactorConsole.group);
      this.reactorConsole = null;
    }
    this.electricFloorGrids.forEach(g => this.removeReferenceObject(g.group));
    this.electricFloorGrids = [];
    if (this.deconAirlock) {
      this.removeReferenceObject(this.deconAirlock.group);
      this.deconAirlock = null;
    }
    // v46.0 Cleanups
    if (this.mountedSmartgun) {
      this.removeReferenceObject(this.mountedSmartgun.group);
      this.mountedSmartgun = null;
    }
    if (this.derelictChamber) {
      this.removeReferenceObject(this.derelictChamber.group);
      this.derelictChamber = null;
    }
    this.fuelLines.forEach(fl => {
      this.removeReferenceObject(fl.group);
      if (fl.fireMesh) this.removeReferenceObject(fl.fireMesh);
      if (fl.puddleMesh) this.removeReferenceObject(fl.puddleMesh);
    });
    this.fuelLines = [];
    if (this.craneConsole) {
      this.removeReferenceObject(this.craneConsole.group);
      this.craneConsole = null;
    }
    // v47.0 Cleanups
    if (this.engineerRuins) {
      this.removeReferenceObject(this.engineerRuins.group);
      this.engineerRuins = null;
    }
    if (this.coolingTowerCryoVent) {
      this.removeReferenceObject(this.coolingTowerCryoVent.group);
      if (this.coolingTowerCryoVent.fogMesh) this.removeReferenceObject(this.coolingTowerCryoVent.fogMesh);
      this.coolingTowerCryoVent = null;
    }
    this.engineerUrns.forEach(u => this.removeReferenceObject(u.group));
    this.engineerUrns = [];
    this.mutagenPuddles.forEach(p => this.removeReferenceObject(p.mesh));
    this.mutagenPuddles = [];

    // v48.0 Cleanups
    if (this.moltenFoundry) {
      this.removeReferenceObject(this.moltenFoundry.group);
      if (this.moltenFoundry.pourMesh) this.removeReferenceObject(this.moltenFoundry.pourMesh);
      if (this.moltenFoundry.poolMesh) this.removeReferenceObject(this.moltenFoundry.poolMesh);
      this.moltenFoundry = null;
    }
    this.alliedAndroids.forEach(a => this.removeReferenceObject(a.mesh));
    this.alliedAndroids = [];
    if (this.volcanicStorm && this.volcanicStorm.ashSystem) {
      this.removeReferenceObject(this.volcanicStorm.ashSystem);
      this.volcanicStorm.ashSystem = null;
    }
    if (this.volcanicStorm) {
      this.volcanicStorm.active = false;
      this.volcanicStorm.timer = 18.0;
    }

    // v49.0 Cleanups
    if (this.uscmMissileBattery) {
      this.removeReferenceObject(this.uscmMissileBattery.group);
      this.uscmMissileBattery = null;
    }
    this.activeSAMMissiles.forEach(m => this.removeReferenceObject(m.mesh));
    this.activeSAMMissiles = [];
    if (this.aurigaBasin) {
      this.removeReferenceObject(this.aurigaBasin.group);
      if (this.aurigaBasin.arcMesh) this.removeReferenceObject(this.aurigaBasin.arcMesh);
      this.aurigaBasin = null;
    }
    if (this.ancientShrine) {
      this.removeReferenceObject(this.ancientShrine.group);
      this.ancientShrine = null;
    }

    // v50.0 Cleanups
    if (this.coastalRailCannon) {
      this.removeReferenceObject(this.coastalRailCannon.group);
      this.coastalRailCannon = null;
    }
    this.activeRailShells.forEach(s => this.removeReferenceObject(s.mesh));
    this.activeRailShells = [];
    if (this.cryoStasisSector) {
      this.removeReferenceObject(this.cryoStasisSector.group);
      this.cryoStasisSector = null;
    }

    // v51.0 Cleanups
    this.pressurizedAcidGeysers.forEach(g => this.removeReferenceObject(g.group));
    this.pressurizedAcidGeysers = [];
    if (this.engineerSarcophagus) {
      this.removeReferenceObject(this.engineerSarcophagus.group);
      this.engineerSarcophagus = null;
    }

    // v52.0 Cleanups
    if (this.hydraulicCargoLift) {
      this.removeReferenceObject(this.hydraulicCargoLift.group);
      this.hydraulicCargoLift = null;
    }
    this.subterraneanVents.forEach(v => this.removeReferenceObject(v.group));
    this.subterraneanVents = [];
    this.activeDropPods.forEach(p => this.removeReferenceObject(p.mesh));
    this.activeDropPods = [];

    // v53.0 Cleanups
    this.stasisSpecimenTanks.forEach(t => this.removeReferenceObject(t.group));
    this.stasisSpecimenTanks = [];
    this.activeCryoCoolantClouds.forEach(c => this.removeReferenceObject(c.mesh));
    this.activeCryoCoolantClouds = [];

    // v54.0 Cleanups
    this.explosiveBarrels.forEach(b => {
      if (b.group) this.removeReferenceObject(b.group);
    });
    this.explosiveBarrels = [];
    this.activeBarrelFireZones.forEach(f => {
      if (f.mesh) this.removeReferenceObject(f.mesh);
    });
    this.activeBarrelFireZones = [];
    this.plasmaRechargeTerminals.forEach(t => {
      if (t.group) this.removeReferenceObject(t.group);
      if (t.light) this.removeReferenceObject(t.light);
    });
    this.plasmaRechargeTerminals = [];

    // v55.0 Cleanups
    this.floodedWaterPuddles.forEach(p => {
      if (p.mesh) this.removeReferenceObject(p.mesh);
    });
    this.floodedWaterPuddles = [];

    // v56.0 Level Design Cleanups
    if (this.crashedScoutShip && this.crashedScoutShip.group) {
      this.removeReferenceObject(this.crashedScoutShip.group);
      this.crashedScoutShip = null;
    }
    if (this.charonGeneticsLab && this.charonGeneticsLab.group) {
      this.removeReferenceObject(this.charonGeneticsLab.group);
      this.charonGeneticsLab = null;
    }
    if (this.gamePreserveCamp && this.gamePreserveCamp.group) {
      this.removeReferenceObject(this.gamePreserveCamp.group);
      this.gamePreserveCamp = null;
    }
    this.fixedSentryEmplacements.forEach(s => {
      if (s.group) this.removeReferenceObject(s.group);
    });
    this.fixedSentryEmplacements = [];
    this.ammoniaCoolantPipes.forEach(p => {
      if (p.mesh) this.removeReferenceObject(p.mesh);
    });
    this.ammoniaCoolantPipes = [];
    this.activeAmmoniaClouds.forEach(c => {
      if (c.mesh) this.removeReferenceObject(c.mesh);
    });
    this.activeAmmoniaClouds = [];
    this.collapsibleFloorGrates.forEach(g => {
      if (g.mesh) this.removeReferenceObject(g.mesh);
    });
    this.collapsibleFloorGrates = [];
    this.tacticalCoverObstacles.forEach(c => {
      if (c.mesh) this.removeReferenceObject(c.mesh);
    });
    this.tacticalCoverObstacles = [];
    this.huntingBoughs = [];

    // v56.5 Sector Overhaul Cleanups
    if (this.valVerdeProps && this.valVerdeProps.group) {
      this.removeReferenceObject(this.valVerdeProps.group);
      this.valVerdeProps = null;
    }
    if (this.laRooftopExpansion && this.laRooftopExpansion.group) {
      this.removeReferenceObject(this.laRooftopExpansion.group);
      this.laRooftopExpansion = null;
    }
    if (this.pyramidSacrificial && this.pyramidSacrificial.group) {
      this.removeReferenceObject(this.pyramidSacrificial.group);
      this.pyramidSacrificial = null;
    }
    if (this.romulusStationExpansion && this.romulusStationExpansion.group) {
      this.removeReferenceObject(this.romulusStationExpansion.group);
      this.romulusStationExpansion = null;
    }
    if (this.hiveWorldExpansion && this.hiveWorldExpansion.group) {
      this.removeReferenceObject(this.hiveWorldExpansion.group);
      this.hiveWorldExpansion = null;
    }
    this.mudPits = [];
    this.harvestableRoyalJelly = [];
    this.scytheTraps = [];
    if (this.activeWaterDeluge && this.activeWaterDeluge.mesh) {
      this.removeReferenceObject(this.activeWaterDeluge.mesh);
      this.activeWaterDeluge = null;
    }
    this.zeroGActiveTimer = 0;

    // v57.0 Level Design Cleanups
    if (this.gunnisonExpansion && this.gunnisonExpansion.group) {
      this.removeReferenceObject(this.gunnisonExpansion.group);
      this.gunnisonExpansion = null;
    }
    if (this.charonExpansion && this.charonExpansion.group) {
      this.removeReferenceObject(this.charonExpansion.group);
      this.charonExpansion = null;
    }
    if (this.gamePreserveExpansion && this.gamePreserveExpansion.group) {
      this.removeReferenceObject(this.gamePreserveExpansion.group);
      this.gamePreserveExpansion = null;
    }
    if (this.gunnisonPowerPole && this.gunnisonPowerPole.group) {
      this.removeReferenceObject(this.gunnisonPowerPole.group);
      this.gunnisonPowerPole = null;
    }
    this.activePowerArcs.forEach(a => {
      if (a.mesh) this.removeReferenceObject(a.mesh);
    });
    this.activePowerArcs = [];
    this.neuralInhibitors.forEach(n => {
      if (n.group) this.removeReferenceObject(n.group);
    });
    this.neuralInhibitors = [];
    this.boulderTraps.forEach(b => {
      if (b.group) this.removeReferenceObject(b.group);
      if (b.boulderMesh) this.removeReferenceObject(b.boulderMesh);
    });
    this.boulderTraps = [];
    if (this.dutchLogTrap && this.dutchLogTrap.group) {
      this.removeReferenceObject(this.dutchLogTrap.group);
      this.dutchLogTrap = null;
    }
    this.hvacChillers.forEach(h => {
      if (h.group) this.removeReferenceObject(h.group);
    });
    this.hvacChillers = [];
    this.activeFreonClouds.forEach(f => {
      if (f.mesh) this.removeReferenceObject(f.mesh);
    });
    this.activeFreonClouds = [];
    this.cryptReliquaryVault = null;
    this.windowCradle = null;
    this.sandbagBunker = null;

    // v58.0 Val Verde Cleanups
    if (this.billyLogBridge && this.billyLogBridge.group) {
      this.removeReferenceObject(this.billyLogBridge.group);
      this.billyLogBridge = null;
    }
    if (this.hopperExecutionSite && this.hopperExecutionSite.group) {
      this.removeReferenceObject(this.hopperExecutionSite.group);
      this.hopperExecutionSite = null;
    }
    if (this.guerrillaWatchtower && this.guerrillaWatchtower.group) {
      this.removeReferenceObject(this.guerrillaWatchtower.group);
      this.guerrillaWatchtower = null;
    }
    if (this.rebelFuelDepot && this.rebelFuelDepot.group) {
      this.removeReferenceObject(this.rebelFuelDepot.group);
      this.rebelFuelDepot = null;
    }
    if (this.oldPainlessClearing && this.oldPainlessClearing.group) {
      this.removeReferenceObject(this.oldPainlessClearing.group);
      this.oldPainlessClearing = null;
    }
    if (this.dutchBonfireCamp && this.dutchBonfireCamp.group) {
      this.removeReferenceObject(this.dutchBonfireCamp.group);
      this.dutchBonfireCamp = null;
    }
    if (this.valVerdeWaterfall && this.valVerdeWaterfall.group) {
      this.removeReferenceObject(this.valVerdeWaterfall.group);
      this.valVerdeWaterfall = null;
    }
    this.punjiStakeTraps.forEach(p => {
      if (p.group) this.removeReferenceObject(p.group);
    });
    this.punjiStakeTraps = [];
    this.rebelFuelBarrels.forEach(b => {
      if (b.group) this.removeReferenceObject(b.group);
    });
    this.rebelFuelBarrels = [];
    this.activeValVerdeFireZones.forEach(f => {
      if (f.mesh) this.removeReferenceObject(f.mesh);
    });
    this.activeValVerdeFireZones = [];

    // v59.0 Val Verde Apex Cleanups
    this.canopyBoughHighways.forEach(b => {
      if (b.mesh) this.removeReferenceObject(b.mesh);
    });
    this.canopyBoughHighways = [];
    if (this.dutchChallengeRock && this.dutchChallengeRock.group) {
      this.removeReferenceObject(this.dutchChallengeRock.group);
      this.dutchChallengeRock = null;
    }
    if (this.dutchWorkbench && this.dutchWorkbench.group) {
      this.removeReferenceObject(this.dutchWorkbench.group);
      this.dutchWorkbench = null;
    }
    if (this.annaHostageCage && this.annaHostageCage.group) {
      this.removeReferenceObject(this.annaHostageCage.group);
      this.annaHostageCage = null;
    }
    if (this.macPerimeterTripwire && this.macPerimeterTripwire.group) {
      this.removeReferenceObject(this.macPerimeterTripwire.group);
      this.macPerimeterTripwire = null;
    }
    if (this.wildBoarRoastSpit && this.wildBoarRoastSpit.group) {
      this.removeReferenceObject(this.wildBoarRoastSpit.group);
      this.wildBoarRoastSpit = null;
    }
    if (this.yautjaCraterLocus && this.yautjaCraterLocus.group) {
      this.removeReferenceObject(this.yautjaCraterLocus.group);
      this.yautjaCraterLocus = null;
    }
    if (this.riverRapidsPath && this.riverRapidsPath.group) {
      this.removeReferenceObject(this.riverRapidsPath.group);
      this.riverRapidsPath = null;
    }
    if (this.activeIlluminationFlare && this.activeIlluminationFlare.mesh) {
      this.removeReferenceObject(this.activeIlluminationFlare.mesh);
      if (this.activeIlluminationFlare.light) this.removeReferenceObject(this.activeIlluminationFlare.light);
      this.activeIlluminationFlare = null;
    }

    // v60.0 Predator 2 Rooftop Cleanups
    if (this.easternColumbiaSpire && this.easternColumbiaSpire.group) {
      this.removeReferenceObject(this.easternColumbiaSpire.group);
      this.easternColumbiaSpire = null;
    }
    if (this.meatLockerFacility && this.meatLockerFacility.group) {
      this.removeReferenceObject(this.meatLockerFacility.group);
      this.meatLockerFacility = null;
    }
    if (this.kingWillieAltar && this.kingWillieAltar.group) {
      this.removeReferenceObject(this.kingWillieAltar.group);
      this.kingWillieAltar = null;
    }
    if (this.dannyBoyNetgun && this.dannyBoyNetgun.group) {
      this.removeReferenceObject(this.dannyBoyNetgun.group);
      this.dannyBoyNetgun = null;
    }
    if (this.lostTribeShipDais && this.lostTribeShipDais.group) {
      this.removeReferenceObject(this.lostTribeShipDais.group);
      this.lostTribeShipDais = null;
    }
    if (this.cityHunterSurgery && this.cityHunterSurgery.group) {
      this.removeReferenceObject(this.cityHunterSurgery.group);
      this.cityHunterSurgery = null;
    }
    if (this.harriganCruiser && this.harriganCruiser.group) {
      this.removeReferenceObject(this.harriganCruiser.group);
      this.harriganCruiser = null;
    }
    if (this.smartDiscGirder && this.smartDiscGirder.group) {
      this.removeReferenceObject(this.smartDiscGirder.group);
      this.smartDiscGirder = null;
    }
    if (this.activeMeatLockerCryo) {
      if (this.activeMeatLockerCryo.mesh) this.removeReferenceObject(this.activeMeatLockerCryo.mesh);
      this.activeMeatLockerCryo = null;
    }
    if (this.subwayCar666 && this.subwayCar666.group) {
      this.removeReferenceObject(this.subwayCar666.group);
      this.subwayCar666 = null;
    }
    if (this.owlfCommandVan && this.owlfCommandVan.group) {
      this.removeReferenceObject(this.owlfCommandVan.group);
      this.owlfCommandVan = null;
    }
    if (this.cartelPenthouse && this.cartelPenthouse.group) {
      this.removeReferenceObject(this.cartelPenthouse.group);
      this.cartelPenthouse = null;
    }
    if (this.poleVaultPad && this.poleVaultPad.group) {
      this.removeReferenceObject(this.poleVaultPad.group);
      this.poleVaultPad = null;
    }
    if (this.fireEscapeStairs && this.fireEscapeStairs.group) {
      this.removeReferenceObject(this.fireEscapeStairs.group);
      this.fireEscapeStairs = null;
    }
    if (this.boilingTarKettle && this.boilingTarKettle.group) {
      this.removeReferenceObject(this.boilingTarKettle.group);
      this.boilingTarKettle = null;
    }
    if (this.activeTarPuddles && this.activeTarPuddles.length > 0) {
      this.activeTarPuddles.forEach(p => {
        if (p.mesh) this.removeReferenceObject(p.mesh);
      });
      this.activeTarPuddles = [];
    }

    // v61.0 Predators (2010) Game Preserve Cleanups
    if (this.nolandHideout && this.nolandHideout.group) {
      this.removeReferenceObject(this.nolandHideout.group);
      this.nolandHideout = null;
    }
    if (this.hanzoDuelArena && this.hanzoDuelArena.group) {
      this.removeReferenceObject(this.hanzoDuelArena.group);
      this.hanzoDuelArena = null;
    }
    if (this.hellhoundKennel && this.hellhoundKennel.group) {
      this.removeReferenceObject(this.hellhoundKennel.group);
      this.hellhoundKennel = null;
    }
    if (this.nikolaiBlastMemorial && this.nikolaiBlastMemorial.group) {
      this.removeReferenceObject(this.nikolaiBlastMemorial.group);
      this.nikolaiBlastMemorial = null;
    }
    if (this.alienFloraPatch && this.alienFloraPatch.group) {
      this.removeReferenceObject(this.alienFloraPatch.group);
      this.alienFloraPatch = null;
    }
    if (this.superPredatorShipDais && this.superPredatorShipDais.group) {
      this.removeReferenceObject(this.superPredatorShipDais.group);
      this.superPredatorShipDais = null;
    }
    if (this.celestialVistaMonolith && this.celestialVistaMonolith.group) {
      this.removeReferenceObject(this.celestialVistaMonolith.group);
      this.celestialVistaMonolith = null;
    }
    if (this.royceCliffWaterfall && this.royceCliffWaterfall.group) {
      this.removeReferenceObject(this.royceCliffWaterfall.group);
      this.royceCliffWaterfall = null;
    }
    if (this.royceTripwireTrap && this.royceTripwireTrap.group) {
      this.removeReferenceObject(this.royceTripwireTrap.group);
      this.royceTripwireTrap = null;
    }
    if (this.activePreserveSmokeScreen && this.activePreserveSmokeScreen.mesh) {
      this.removeReferenceObject(this.activePreserveSmokeScreen.mesh);
      this.activePreserveSmokeScreen = null;
    }
    if (this.activePreserveFireZones && this.activePreserveFireZones.length > 0) {
      this.activePreserveFireZones.forEach(f => {
        if (f.mesh) this.removeReferenceObject(f.mesh);
        if (f.light) this.removeReferenceObject(f.light);
      });
      this.activePreserveFireZones = [];
    }

    // v62.0 Cleanups
    if (this.falconerDronePerch && this.falconerDronePerch.group) {
      this.removeReferenceObject(this.falconerDronePerch.group);
      this.falconerDronePerch = null;
    }
    if (this.cuchilloAcousticDecoy && this.cuchilloAcousticDecoy.group) {
      this.removeReferenceObject(this.cuchilloAcousticDecoy.group);
      this.cuchilloAcousticDecoy = null;
    }
    if (this.mombassaPunjiTrap && this.mombassaPunjiTrap.group) {
      this.removeReferenceObject(this.mombassaPunjiTrap.group);
      this.mombassaPunjiTrap = null;
    }
    if (this.royceBoneGong && this.royceBoneGong.group) {
      this.removeReferenceObject(this.royceBoneGong.group);
      this.royceBoneGong = null;
    }
    if (this.isabelleSniperStash && this.isabelleSniperStash.group) {
      this.removeReferenceObject(this.isabelleSniperStash.group);
      this.isabelleSniperStash = null;
    }
    if (this.activeGongFireBraziers && this.activeGongFireBraziers.length > 0) {
      this.activeGongFireBraziers.forEach(b => {
        if (b.mesh) this.removeReferenceObject(b.mesh);
        if (b.light) this.removeReferenceObject(b.light);
      });
      this.activeGongFireBraziers = [];
    }

    // v63.0 Val Verde Master Cleanups
    if (this.dillonLastStand && this.dillonLastStand.group) {
      this.removeReferenceObject(this.dillonLastStand.group);
      this.dillonLastStand = null;
    }
    if (this.ponchoGrenadeStash && this.ponchoGrenadeStash.group) {
      this.removeReferenceObject(this.ponchoGrenadeStash.group);
      this.ponchoGrenadeStash = null;
    }
    if (this.hawkinsRadioBeacon && this.hawkinsRadioBeacon.group) {
      this.removeReferenceObject(this.hawkinsRadioBeacon.group);
      this.hawkinsRadioBeacon = null;
    }
    if (this.mudWaterfallBasin && this.mudWaterfallBasin.group) {
      this.removeReferenceObject(this.mudWaterfallBasin.group);
      this.mudWaterfallBasin = null;
    }

    // v63.0 The Predator (2018) Stargazer Cleanups
    if (this.stargazerVivisection && this.stargazerVivisection.group) {
      this.removeReferenceObject(this.stargazerVivisection.group);
      this.stargazerVivisection = null;
    }
    if (this.predatorKillerPod && this.predatorKillerPod.group) {
      this.removeReferenceObject(this.predatorKillerPod.group);
      this.predatorKillerPod = null;
    }
    if (this.crashedArkStarship && this.crashedArkStarship.group) {
      this.removeReferenceObject(this.crashedArkStarship.group);
      this.crashedArkStarship = null;
    }
    if (this.quinnSniperPerch && this.quinnSniperPerch.group) {
      this.removeReferenceObject(this.quinnSniperPerch.group);
      this.quinnSniperPerch = null;
    }
    if (this.houndKennelStargazer && this.houndKennelStargazer.group) {
      this.removeReferenceObject(this.houndKennelStargazer.group);
      this.houndKennelStargazer = null;
    }
    if (this.traegerWeaponLocker && this.traegerWeaponLocker.group) {
      this.removeReferenceObject(this.traegerWeaponLocker.group);
      this.traegerWeaponLocker = null;
    }
    if (this.stargazerShieldPylons && this.stargazerShieldPylons.length > 0) {
      this.stargazerShieldPylons.forEach(p => {
        if (p.mesh) this.removeReferenceObject(p.mesh);
        if (p.light) this.removeReferenceObject(p.light);
      });
      this.stargazerShieldPylons = [];
    }
    if (this.looniesTransportBus && this.looniesTransportBus.group) {
      this.removeReferenceObject(this.looniesTransportBus.group);
      this.looniesTransportBus = null;
    }
    if (this.shatteredOakArena && this.shatteredOakArena.group) {
      this.removeReferenceObject(this.shatteredOakArena.group);
      this.shatteredOakArena = null;
    }
    if (this.fugitiveGauntletLocker && this.fugitiveGauntletLocker.group) {
      this.removeReferenceObject(this.fugitiveGauntletLocker.group);
      this.fugitiveGauntletLocker = null;
    }
    if (this.friendlyLoboHound && this.friendlyLoboHound.group) {
      this.removeReferenceObject(this.friendlyLoboHound.group);
      this.friendlyLoboHound = null;
    }
    if (this.baxleyCoyleBunker && this.baxleyCoyleBunker.group) {
      this.removeReferenceObject(this.baxleyCoyleBunker.group);
      this.baxleyCoyleBunker = null;
    }
    if (this.cryoNitrogenTanks && this.cryoNitrogenTanks.length > 0) {
      this.cryoNitrogenTanks.forEach(t => {
        if (t.mesh) this.removeReferenceObject(t.mesh);
      });
      this.cryoNitrogenTanks = [];
    }
    if (this.nebraskaHarpoonRig && this.nebraskaHarpoonRig.group) {
      this.removeReferenceObject(this.nebraskaHarpoonRig.group);
      this.nebraskaHarpoonRig = null;
    }
    if (this.stargazerEnergyDome) {
      this.removeReferenceObject(this.stargazerEnergyDome);
      this.stargazerEnergyDome = null;
    }
    if (this.roryTranslatorDesk && this.roryTranslatorDesk.group) {
      this.removeReferenceObject(this.roryTranslatorDesk.group);
      this.roryTranslatorDesk = null;
    }
    if (this.crashedArkTurbine && this.crashedArkTurbine.group) {
      this.removeReferenceObject(this.crashedArkTurbine.group);
      this.crashedArkTurbine = null;
    }
    if (this.caseyDeconStation && this.caseyDeconStation.group) {
      this.removeReferenceObject(this.caseyDeconStation.group);
      this.caseyDeconStation = null;
    }
    this.stargazerCanopyHighways = [];

    // v65.0 Prey Cleanups
    if (this.preyMudSinkhole && this.preyMudSinkhole.group) {
      this.removeReferenceObject(this.preyMudSinkhole.group);
      this.preyMudSinkhole = null;
    }
    if (this.boneMaskDecoy && this.boneMaskDecoy.group) {
      this.removeReferenceObject(this.boneMaskDecoy.group);
      this.boneMaskDecoy = null;
    }
    if (this.orangeFlowerPatch && this.orangeFlowerPatch.group) {
      this.removeReferenceObject(this.orangeFlowerPatch.group);
      this.orangeFlowerPatch = null;
    }
    if (this.trapperCampVoyageurs && this.trapperCampVoyageurs.group) {
      this.removeReferenceObject(this.trapperCampVoyageurs.group);
      this.trapperCampVoyageurs = null;
    }
    if (this.adoliniPistolPedestal && this.adoliniPistolPedestal.group) {
      this.removeReferenceObject(this.adoliniPistolPedestal.group);
      this.adoliniPistolPedestal = null;
    }
    if (this.taabeRockPerch && this.taabeRockPerch.group) {
      this.removeReferenceObject(this.taabeRockPerch.group);
      this.taabeRockPerch = null;
    }
    if (this.grizzlyBearCarcass && this.grizzlyBearCarcass.group) {
      this.removeReferenceObject(this.grizzlyBearCarcass.group);
      this.grizzlyBearCarcass = null;
    }
    if (this.beaverDamCrossing && this.beaverDamCrossing.group) {
      this.removeReferenceObject(this.beaverDamCrossing.group);
      this.beaverDamCrossing = null;
    }
    if (this.naruTomahawkTree && this.naruTomahawkTree.group) {
      this.removeReferenceObject(this.naruTomahawkTree.group);
      this.naruTomahawkTree = null;
    }
    if (this.trapperMedicalTent && this.trapperMedicalTent.group) {
      this.removeReferenceObject(this.trapperMedicalTent.group);
      this.trapperMedicalTent = null;
    }
    if (this.feralArsenalStation && this.feralArsenalStation.group) {
      this.removeReferenceObject(this.feralArsenalStation.group);
      this.feralArsenalStation = null;
    }
    if (this.sariiCompanion && this.sariiCompanion.group) {
      this.removeReferenceObject(this.sariiCompanion.group);
      this.sariiCompanion = null;
    }
    if (this.trapperBaitTree && this.trapperBaitTree.group) {
      this.removeReferenceObject(this.trapperBaitTree.group);
      this.trapperBaitTree = null;
    }
    if (this.cougarPineBough && this.cougarPineBough.group) {
      this.removeReferenceObject(this.cougarPineBough.group);
      this.cougarPineBough = null;
    }
    if (this.activePowderKegFire && this.activePowderKegFire.mesh) {
      this.removeReferenceObject(this.activePowderKegFire.mesh);
      this.activePowderKegFire = null;
    }
    if (this.voyageurRiverRaft && this.voyageurRiverRaft.group) {
      this.removeReferenceObject(this.voyageurRiverRaft.group);
      this.voyageurRiverRaft = null;
    }
    if (this.comancheTotemPost && this.comancheTotemPost.group) {
      this.removeReferenceObject(this.comancheTotemPost.group);
      this.comancheTotemPost = null;
    }
    if (this.brushPitfallTrap && this.brushPitfallTrap.group) {
      this.removeReferenceObject(this.brushPitfallTrap.group);
      this.brushPitfallTrap = null;
    }
    if (this.lightningSplitPine && this.lightningSplitPine.group) {
      this.removeReferenceObject(this.lightningSplitPine.group);
      this.lightningSplitPine = null;
    }
    if (this.trapperCampfireSpit && this.trapperCampfireSpit.group) {
      this.removeReferenceObject(this.trapperCampfireSpit.group);
      this.trapperCampfireSpit = null;
    }
    if (this.buffaloSkullCairn && this.buffaloSkullCairn.group) {
      this.removeReferenceObject(this.buffaloSkullCairn.group);
      this.buffaloSkullCairn = null;
    }
    if (this.feralSeveredGauntlet && this.feralSeveredGauntlet.group) {
      this.removeReferenceObject(this.feralSeveredGauntlet.group);
      this.feralSeveredGauntlet = null;
    }
    if (this.ursaShieldProw && this.ursaShieldProw.group) {
      this.removeReferenceObject(this.ursaShieldProw.group);
      this.ursaShieldProw = null;
    }
    if (this.ursaDaneAxeAltar && this.ursaDaneAxeAltar.group) {
      this.removeReferenceObject(this.ursaDaneAxeAltar.group);
      this.ursaDaneAxeAltar = null;
    }
    if (this.kenjiKatanaStand && this.kenjiKatanaStand.group) {
      this.removeReferenceObject(this.kenjiKatanaStand.group);
      this.kenjiKatanaStand = null;
    }
    if (this.kenjiBambooDecoy && this.kenjiBambooDecoy.group) {
      this.removeReferenceObject(this.kenjiBambooDecoy.group);
      this.kenjiBambooDecoy = null;
    }
    if (this.torresWarhawkWreck && this.torresWarhawkWreck.group) {
      this.removeReferenceObject(this.torresWarhawkWreck.group);
      this.torresWarhawkWreck = null;
    }
    if (this.torresBrowningNest && this.torresBrowningNest.group) {
      this.removeReferenceObject(this.torresBrowningNest.group);
      this.torresBrowningNest = null;
    }
    if (this.trioCryoStasisPods && this.trioCryoStasisPods.group) {
      this.removeReferenceObject(this.trioCryoStasisPods.group);
      this.trioCryoStasisPods = null;
    }
    this.burnedForestCharredTrees = [];
    this.trapperBearTraps = [];

    this.reactorMeltdownActive = false;
    this.reactorMeltdownTimer = 180.0;
    this.slabShiftTimer = 0;
    this.isSlabMoving = false;
  }

  buildLegacyLevelEnvironment(levelConfig) {
    this.clearEnvironment();

    const type = levelConfig.environmentType;

    // Floor Arena Surface (120x120m)
    const floorGeo = new THREE.PlaneGeometry(150, 150);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshStandardMaterial({
      color: levelConfig.floorColor,
      roughness: 0.8,
      metalness: 0.2
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.receiveShadow = true;
    this.addReferenceObject(floor);
    this.envObjects.push(floor);

    // Outer Boundary Wall Enclosure
    const wallMat = new THREE.MeshStandardMaterial({
      color: levelConfig.wallColor,
      roughness: 0.7,
      metalness: 0.3
    });

    const wallThickness = 4;
    const wallHeight = 12;
    const arenaSize = 70;

    const walls = [
      { pos: [0, wallHeight / 2, -arenaSize], size: [arenaSize * 2, wallHeight, wallThickness] },
      { pos: [0, wallHeight / 2, arenaSize], size: [arenaSize * 2, wallHeight, wallThickness] },
      { pos: [-arenaSize, wallHeight / 2, 0], size: [wallThickness, wallHeight, arenaSize * 2] },
      { pos: [arenaSize, wallHeight / 2, 0], size: [wallThickness, wallHeight, arenaSize * 2] }
    ];

    walls.forEach(w => {
      const geo = new THREE.BoxGeometry(...w.size);
      const wall = new THREE.Mesh(geo, wallMat);
      wall.position.set(...w.pos);
      wall.castShadow = true;
      wall.receiveShadow = true;
      this.addReferenceObject(wall);
      this.envObjects.push(wall);
    });

    // Decorative Environment Props matching level themes
    const theme = levelConfig.theme || levelConfig.environmentType || 'jungle';
    const levelId = levelConfig.id || '';

    if (levelId === 'val_verde_jungle') {
      this.buildJungleProps();
      this.buildValVerdeProps();
      this.buildValVerdeMasterExpansionProps();
    } else if (levelId === 'stargazer_facility' || theme === 'stargazer') {
      this.buildStargazerLabProps();
      this.buildStargazerFacilityExpansionProps();
    } else if (levelId === 'prey_comanche_territory' || theme === 'comanche_territory') {
      this.buildPreyComancheProps();
      this.buildPreyTerritoryExpansionProps();
      this.buildJungleProps();
    } else if (levelId === 'killer_of_killers_arena' || theme === 'killer_of_killers') {
      this.buildKillerOfKillersProps();
      this.buildKillerOfKillersExpansionProps();
    } else if (levelId === 'gunnison_forest' || theme === 'rain_forest') {
      this.buildCrashedScoutShipProps();
      this.buildGunnisonForestExpansionProps();
      this.buildJungleProps();
    } else if (levelId === 'charon_rogue_base' || theme === 'space_station') {
      this.buildCharonGeneticsLabProps();
      this.buildCharonBaseExpansionProps();
      this.buildColonyProps();
    } else if (levelId === 'game_preserve_planet') {
      this.buildGamePreserveProps();
      this.buildGamePreserveExpansionProps();
      this.buildJungleProps();
    } else if (theme === 'pyramid' || theme === 'temple') {
      this.buildTempleProps(wallMat);
      this.buildModularPyramidWalls(wallMat);
      this.buildPyramidSacrificialProps();
    } else if (theme === 'jungle') {
      this.buildJungleProps();
      this.buildValVerdeProps();
    } else if (theme === 'hive_world' || theme === 'hive') {
      this.buildHiveProps();
      this.buildHiveWorldExpansionProps();
    } else if (theme === 'romulus_station') {
      this.buildRomulusCryoProps();
      this.buildRomulusStationExpansionProps();
    } else if (theme === 'la_rooftops') {
      this.buildLARooftopProps();
      this.buildLARooftopExpansionProps();
    } else if (theme === 'colony') {
      this.buildColonyProps();
    }

    // Chantier 1: Elevated Industrial Catwalks & Access Ramps
    if (theme === 'romulus_station' || theme === 'colony' || theme === 'la_rooftops' || theme === 'pyramid') {
      this.buildIndustrialCatwalks(theme === 'pyramid');
    }

    // Chantier 3: High-Voltage Electrical Transformers
    if (theme === 'romulus_station' || theme === 'colony' || theme === 'la_rooftops') {
      this.buildElectricalTransformers(4);
    }

    // Chantier 4: USCM M290 Supply Caches
    this.buildUSCMSupplyCaches(2);

    // Chantier 6: Destructible Blast Doors
    if (theme === 'romulus_station' || theme === 'colony' || theme === 'pyramid') {
      this.buildHydraulicBlastDoors();
    }

    // Chantier 8: Living Biomechanical Wall Resin & Acid Pustules
    if (theme === 'hive_world' || theme === 'romulus_station') {
      this.buildBiomechanicalWallResin();
    }

    // === v41.0 10-CHANTIER EXPANSION (Level Design Systems) ===
    // Chantier 1: Subterranean Acid Trenches & Caustic Canals (Hadley's Hope / Romulus 1:1)
    this.buildAcidTrenches();

    // Chantier 3: Derelict Juggernaut Space Jockey Chamber & Telescope Dais (Alien 1979 / Prometheus)
    this.buildSpaceJockeyDais();

    // Chantier 4: Cryo-Surgical Med-Bay Pods & Embryo Purge (Prometheus / Romulus)
    this.buildCryoMedBays(2);

    // Chantier 5: Overhead Industrial Cargo Crane & 5-Ton Container Drop (Aliens 1986)
    if (theme === 'colony' || theme === 'romulus_station' || theme === 'la_rooftops' || theme === 'pyramid') {
      this.buildCargoCrane();
    }

    // Chantier 9: Hive Egg Clusters & Royal Guard Praetorian Barricades (Aliens 1986 / Romulus)
    if (theme === 'hive_world' || theme === 'romulus_station' || theme === 'pyramid') {
      this.buildEggNurseries();
    }

    // === v42.0 10-CHANTIER EXPANSION (Level Design Systems) ===
    // Chantier 1: Emergency Atmospheric Decompression Airlock (Alien 1979 / Aliens 1986)
    if (theme === 'colony' || theme === 'romulus_station' || theme === 'la_rooftops' || theme === 'pyramid') {
      this.buildDecompressionAirlock();
    }

    // Chantier 7: High-Pressure Industrial Steam Conduit Ruptures (Alien 3 / Aliens 1986)
    if (theme === 'colony' || theme === 'romulus_station' || theme === 'la_rooftops') {
      this.buildSteamConduits(6);
    }

    // Chantier 9: Xenomorph Chrysalis Moulting Cocoons & Ceiling Traps (Alien: Romulus / Alien 1979)
    if (theme === 'hive_world' || theme === 'romulus_station' || theme === 'pyramid') {
      this.buildChrysalisCocoons(8);
    }

    // === v43.0 10-CHANTIER EXPANSION (Level Design & Interactive Hazards) ===
    // Chantier 1: Queen Ovipositor Egg Sack & Live Egg Laying Chamber (Aliens 1986)
    this.buildQueenOvipositor();

    // Chantier 2: Atmospheric Condenser Lightning Rods & Ion Storm Arcs (Alien 3 / Fiorina 161)
    this.buildLightningRods();

    // Chantier 4: Fallen USCM Colonial Marine Casualties & Salvage (Aliens 1986)
    this.buildFallenMarines();

    // Chantier 7: Liquid Nitrogen Fire Suppression Overhead Deluge System (Alien: Resurrection 1997)
    this.buildLiquidNitrogenTanks();

    // Chantier 10: Queen Bio-Resin Webbing Barricades & Acid Adhesion (Aliens 1986)
    this.buildResinWebbings();

    // === v44.0 10-CHANTIER EXPANSION (Level Design & Interactive Hazards) ===
    // Chantier 5: Weyland-Yutani Containment Cryo-Tubes
    this.buildCryoSpecimenTubes();

    // Chantier 6: P-5000 Caterpillar Power Loader Workstation & Crushing Clamp
    this.buildPowerLoader();

    // Chantier 9: Corrosive Atmospheric Acid Rain Storms
    this.initAcidRain();

    // === v45.0 10-CHANTIER EXPANSION (Vehicles, Level Traps & Reactor Core) ===
    // Chantier 2: Drivable USCM M577 Armored Personnel Carrier (Aliens 1986)
    this.buildDrivableAPC();

    // Chantier 3: Colony Reactor Meltdown & Cooling Console (Hadley's Hope)
    this.buildReactorMeltdownConsole();

    // Chantier 6: High-Voltage Discharging Electric Floor Grids
    this.buildElectricFloorGrids();

    // Chantier 9: Weyland-Yutani Med-Lab Decontamination Airlock
    this.buildDecontaminationAirlock();

    // === v46.0 10-CHANTIER EXPANSION (Smartgun Turret, Derelict LV-426, JP-4 Fuel Lines & Cargo Crane Console) ===
    // Chantier 1: Heavy Mounted USCM M56 Smartgun Turret (Aliens 1986 Vasquez & Drake)
    this.buildMountedSmartgun();

    // Chantier 2: Derelict LV-426 Interior Chamber with 0.45g Low Gravity & Blue Laser Mist Plane (Alien 1979)
    this.buildDerelictChamber();

    // Chantier 6: Colonial JP-4 Industrial Fuel Lines & Ignition Flame Wall (Aliens 1986)
    this.buildFuelLines();

    // Chantier 9: USCM Cargo Crane Operator Console for 10-Ton Container Drop
    this.buildCargoCraneConsole();

    // === v47.0 10-CHANTIER EXPANSION (Engineer City Ruins, Cryo-Vent Cooling Tower, Mutagen Urns) ===
    // Chantier 3: Planet 4 Engineer City Ruins (Prometheus / Covenant)
    this.buildEngineerCityRuins();

    // Chantier 6: Weyland-Yutani Atmospheric Cooling Tower Cryo-Vent Purge (Alien 3 / Fiorina 161)
    this.buildCoolingTowerCryoVent();

    // Chantier 9: Engineer Ceramic Urns & Black Mutagen Z-01 Puddles (Prometheus 2012)
    this.buildEngineerUrnClusters();

    // === v48.0 10-CHANTIER EXPANSION (Fiorina 161 Molten Lead Foundry Vat & Containment Channel) ===
    // Chantier 4: Fiorina "Fury" 161 Molten Lead Foundry & Pouring Vat (Alien 3 1992 Canon 1:1)
    this.buildFiorinaMoltenLeadFoundry();

    // === v49.0 10-CHANTIER EXPANSION (USCM M579 SAM Battery, USM Auriga Flooded Basin, Shrine of the Ancients) ===
    // Chantier 3: USCM M579 "Aguilar" Guided Missile Battery & Anti-Air Radar (Aliens / Fireteam Elite)
    this.buildUSCMMissileBattery();

    // Chantier 4: USM Auriga Flooded Hydro-Cryo Basin & 50,000V Breaker (Alien: Resurrection 1997)
    this.buildAurigaFloodedBasin();

    // Chantier 9: Ancient Yautja Shrine of the Ancients & Sacrificial Braziers (AVP: Extinction)
    this.buildShrineOfTheAncients();

    // === v50.0 10-CHANTIER EXPANSION (WY 155mm Coastal Rail-Cannon, Cryo-Stasis Laboratory Sector) ===
    // Chantier 2: Weyland-Yutani Coastal Defense 155mm Rail-Cannon Artillery Turret
    this.buildCoastalRailCannon();

    // Chantier 4: Weyland-Yutani Cryo-Stasis Research Laboratory Sector & Breakable Specimen Pods
    this.buildCryoStasisSector();

    // === v51.0 10-CHANTIER EXPANSION (Pressurized Acid Geysers, Engineer Sarcophagus Stasis Crypt) ===
    // Chantier 7: Pressurized Acid Geysers & Eruptive Fumaroles (Alien 3 / AVP Extinction)
    this.buildPressurizedAcidGeysers();

    // Chantier 10: Space Jockey Dais Sacred Engineer Stasis Crypt Sarcophagus (Prometheus 2012)
    this.buildEngineerSarcophagus();

    // === v52.0 10-CHANTIER EXPANSION (Hydraulic Cargo Lift, Subterranean Infiltration Vents) ===
    // Chantier 5: USCM Industrial Hydraulic Cargo Lift Elevator (Hadley's Hope)
    this.buildHydraulicCargoLift();

    // Chantier 6: Subterranean Xeno Infiltration Vents & Floor Hatches
    this.buildSubterraneanVents();

    // === v53.0 10-CHANTIER EXPANSION (Weyland-Yutani Breakable Specimen Stasis Vats & Cryo Cloud Freezing) ===
    // Chantier 5: Weyland-Yutani Specimen Stasis Tanks & Cryogenic Rupture Zones
    this.buildSpecimenStasisTanks();

    // === v54.0 10-CHANTIER EXPANSION (JP-4 Explosive Barrels & Plasma Recharge Stations) ===
    // Chantier 3 & Sofia QA: JP-4 Fuel Barrels Destructible Hazards
    this.buildExplosiveBarrels();
    // Chantier 4: Weyland-Yutani Plasma Capacitor Recharge Terminals
    this.buildPlasmaRechargeTerminals();

    // === v55.0 10-CHANTIER EXPANSION (Flooded Water Drainage Puddles & Cloaking Disruption) ===
    // Chantier 4 & Sofia QA: Flooded Drainage Puddles (Predator 1987 / Prey 2022)
    this.buildFloodedPuddles();

    // === v56.0 MASTER LEVEL DESIGN SYSTEMS (UA 571-C Sentry, Ammonia Coolant, Collapsible Grates, Tactical Covers) ===
    this.buildFixedSentryEmplacements();
    this.buildAmmoniaCoolantPipes();
    this.buildCollapsibleFloorGrates();
    this.buildTacticalCoverObstacles();
  }

  buildTempleProps(stoneMat) {
    // Ancient Yautja Stone Pillars
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      const radius = 35;
      const x = Math.sin(angle) * radius;
      const z = Math.cos(angle) * radius;

      const pillarGeo = new THREE.CylinderGeometry(1.2, 1.6, 14, 8);
      const pillar = new THREE.Mesh(pillarGeo, stoneMat);
      pillar.position.set(x, 7, z);
      pillar.castShadow = true;
      this.addReferenceObject(pillar);
      this.envObjects.push(pillar);
    }
  }

  buildJungleProps() {
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x24180f, // Ancient wet bark
      roughness: 0.9,
      metalness: 0.1
    });
    const leafMat = new THREE.MeshStandardMaterial({
      color: 0x0a2e12, // Deep tropical rainforest canopy
      roughness: 0.55
    });
    const vineMat = new THREE.MeshStandardMaterial({
      color: 0x143317,
      roughness: 0.8
    });
    const boughMat = new THREE.MeshStandardMaterial({
      color: 0x1f140c,
      roughness: 0.85
    });

    this.huntingBoughs = [];

    // 16 Massive Ancient Trees with Buttress Roots & Climbable Hunting Boughs
    const treePositions = [
      new THREE.Vector3(-32, 0, -28),
      new THREE.Vector3(-18, 0, -38),
      new THREE.Vector3(12, 0, -32),
      new THREE.Vector3(34, 0, -22),
      new THREE.Vector3(-38, 0, 8),
      new THREE.Vector3(38, 0, 14),
      new THREE.Vector3(-28, 0, 32),
      new THREE.Vector3(-12, 0, 38),
      new THREE.Vector3(14, 0, 34),
      new THREE.Vector3(32, 0, 28),
      new THREE.Vector3(-42, 0, -8),
      new THREE.Vector3(42, 0, -6),
      new THREE.Vector3(-20, 0, 0),
      new THREE.Vector3(20, 0, 0),
      new THREE.Vector3(0, 0, -36),
      new THREE.Vector3(0, 0, 36)
    ];

    treePositions.forEach((pos, idx) => {
      const treeGroup = new THREE.Group();
      treeGroup.position.copy(pos);

      // Flared buttress root base
      const rootBase = new THREE.Mesh(new THREE.ConeGeometry(2.4, 4.0, 7), trunkMat);
      rootBase.position.y = 2.0;
      treeGroup.add(rootBase);

      // Main towering trunk
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.6, 20, 8), trunkMat);
      trunk.position.y = 10;
      trunk.castShadow = true;
      treeGroup.add(trunk);

      // Massive Horizontal Hunting Bough (Predator Perch Platform at +6.8m or +10.2m)
      const boughHeight = idx % 2 === 0 ? 6.8 : 10.2;
      const boughAngle = (idx * 1.35) % (Math.PI * 2);
      const boughLength = 7.5;

      const boughGroup = new THREE.Group();
      boughGroup.position.set(0, boughHeight, 0);
      boughGroup.rotation.y = boughAngle;

      const boughMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.75, boughLength, 6), boughMat);
      boughMesh.rotation.z = Math.PI / 2;
      boughMesh.position.x = boughLength / 2;
      boughMesh.castShadow = true;
      boughMesh.receiveShadow = true;
      boughGroup.add(boughMesh);

      // Hanging moss / lianas dangling from branch
      for (let v = 0; v < 3; v++) {
        const vine = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.03, 3.2, 4), vineMat);
        vine.position.set(2.0 + v * 2.0, -1.6, (this.random() - 0.5) * 0.4);
        boughGroup.add(vine);
      }

      treeGroup.add(boughGroup);

      // Store hunting bough world position for sniper mantling & perching
      const boughWorldPos = pos.clone().add(new THREE.Vector3(
        Math.cos(boughAngle) * (boughLength * 0.5),
        boughHeight + 0.6,
        Math.sin(boughAngle) * (boughLength * 0.5)
      ));
      this.huntingBoughs.push({
        id: idx,
        pos: boughWorldPos,
        height: boughHeight
      });

      // Upper canopy foliage dome
      const canopy = new THREE.Mesh(new THREE.DodecahedronGeometry(5.5, 1), leafMat);
      canopy.position.y = 21;
      treeGroup.add(canopy);

      this.addReferenceObject(treeGroup);
      this.envObjects.push(treeGroup);
    });

    // 2. Fallen Giant Hollow Log Bridge
    const logGroup = new THREE.Group();
    logGroup.position.set(-8, 0.8, -12);
    logGroup.rotation.y = Math.PI / 3;
    const log = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, 14, 8), trunkMat);
    log.rotation.z = Math.PI / 2;
    log.castShadow = true;
    log.receiveShadow = true;
    logGroup.add(log);
    this.addReferenceObject(logGroup);
    this.envObjects.push(logGroup);
  }

  buildColonyProps() {
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x333d4d, metalness: 0.9, roughness: 0.2 });

    // Cargo Crates & Steam Pipes
    for (let i = 0; i < 18; i++) {
      const x = (this.random() - 0.5) * 90;
      const z = (this.random() - 0.5) * 90;
      if (Math.abs(x) < 10 && Math.abs(z) < 10) continue;

      const crateGeo = new THREE.BoxGeometry(3, 3, 3);
      const crate = new THREE.Mesh(crateGeo, metalMat);
      crate.position.set(x, 1.5, z);
      crate.castShadow = true;
      this.addReferenceObject(crate);
      this.envObjects.push(crate);
    }
  }

  buildHiveProps() {
    const resinMat = new THREE.MeshStandardMaterial({ color: 0x1f060c, roughness: 0.35, metalness: 0.75 });
    const cocoonMat = new THREE.MeshStandardMaterial({ color: 0x3d141e, roughness: 0.6, metalness: 0.2 });
    const eggMat = new THREE.MeshStandardMaterial({ color: 0x5a1825, roughness: 0.5 });

    // 1. Biomechanical Ribbed Resin Pillars (Aliens 1986 Hive Nest)
    for (let p = 0; p < 12; p++) {
      const angle = (p / 12) * Math.PI * 2;
      const radius = 28 + this.random() * 18;
      const px = Math.cos(angle) * radius;
      const pz = Math.sin(angle) * radius;

      const pillarGroup = new THREE.Group();
      const col = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.8, 14, 8), resinMat);
      col.position.y = 7;
      pillarGroup.add(col);

      // Rib arches protruding from column
      for (let r = 0; r < 5; r++) {
        const rib = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.22, 6, 12, Math.PI), resinMat);
        rib.rotation.x = Math.PI / 2;
        rib.rotation.z = r * 0.7;
        rib.position.y = 2.5 + r * 2.2;
        pillarGroup.add(rib);
      }

      pillarGroup.position.set(px, 0, pz);
      this.addReferenceObject(pillarGroup);
      this.envObjects.push(pillarGroup);
    }

    // 2. Wall Resin Cocoons with Torso Shapes (Hosts entombed in secretion)
    for (let c = 0; c < 10; c++) {
      const x = (this.random() - 0.5) * 85;
      const z = (this.random() - 0.5) * 85;
      if (Math.abs(x) < 12 && Math.abs(z) < 12) continue;

      const cocoonGeo = new THREE.CylinderGeometry(0.7, 0.4, 2.4, 8);
      const cocoon = new THREE.Mesh(cocoonGeo, cocoonMat);
      cocoon.position.set(x, 1.2, z);
      cocoon.rotation.x = (this.random() - 0.5) * 0.4;
      cocoon.rotation.z = (this.random() - 0.5) * 0.4;
      this.addReferenceObject(cocoon);
      this.envObjects.push(cocoon);
    }

    // 3. Alien Ovimorph Eggs
    for (let i = 0; i < 24; i++) {
      const x = (this.random() - 0.5) * 100;
      const z = (this.random() - 0.5) * 100;
      if (Math.abs(x) < 8 && Math.abs(z) < 8) continue;

      const eggGeo = new THREE.SphereGeometry(0.8, 8, 8);
      eggGeo.scale(1, 1.4, 1);
      const egg = new THREE.Mesh(eggGeo, eggMat);
      egg.position.set(x, 1.1, z);
      egg.castShadow = true;
      this.addReferenceObject(egg);
      this.envObjects.push(egg);
    }
  }

  buildModularPyramidWalls(stoneMat) {
    // Modular Sliding Stone Slabs (AVP 2004 10-Minute Labyrinth Shift)
    const slabGeo = new THREE.BoxGeometry(10, 8, 2.5);
    const glyphMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

    // Slabs with home positions and dynamic shift offsets (sliding across corridors)
    const slabConfigs = [
      { home: [-24, 4, -14], shift: [12, 0, 0] },
      { home: [24, 4, 14], shift: [-12, 0, 0] },
      { home: [-14, 4, 24], shift: [0, 0, -12] },
      { home: [14, 4, -24], shift: [0, 0, 12] },
      { home: [-8, 4, 0], shift: [0, 0, 10] },
      { home: [8, 4, 0], shift: [0, 0, -10] }
    ];

    this.modularSlabs = [];

    slabConfigs.forEach(cfg => {
      const slabGroup = new THREE.Group();
      const wall = new THREE.Mesh(slabGeo, stoneMat);
      wall.castShadow = true;
      slabGroup.add(wall);

      // Embedded glowing Yautja hunting glyphs on both slab faces
      [-1.3, 1.3].forEach(z => {
        const glyph = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.4, 0.05), glyphMat);
        glyph.position.set(0, 0, z);
        slabGroup.add(glyph);
      });

      slabGroup.position.set(...cfg.home);
      this.addReferenceObject(slabGroup);
      this.envObjects.push(slabGroup);

      this.modularSlabs.push({
        mesh: slabGroup,
        homePos: new THREE.Vector3(...cfg.home),
        shiftOffset: new THREE.Vector3(...cfg.shift),
        dir: new THREE.Vector3(...cfg.shift).normalize()
      });
    });
  }

  buildRomulusCryoProps() {
    // Renaissance Station Cryo Stasis Pods & Z-01 Lab Terminal Stations (Romulus 2024)
    const podMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.9, roughness: 0.2 });
    const glassMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.45 });

    for (let c = 0; c < 8; c++) {
      const angle = (c / 8) * Math.PI * 2;
      const cx = Math.cos(angle) * 32;
      const cz = Math.sin(angle) * 32;

      const podGroup = new THREE.Group();

      const base = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.6, 3.8), podMat);
      base.position.y = 0.3;
      podGroup.add(base);

      const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 3.2, 8), glassMat);
      glass.rotation.x = Math.PI / 2;
      glass.position.set(0, 1.2, 0);
      podGroup.add(glass);

      podGroup.position.set(cx, 0, cz);
      podGroup.rotation.y = angle + Math.PI / 2;
      this.addReferenceObject(podGroup);
      this.envObjects.push(podGroup);
    }
  }

  buildLARooftopProps() {
    // Predator 2 (1990) Rooftops: HVAC Units, Satellite Dishes & Neon Antennas
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x27272a, metalness: 0.85, roughness: 0.3 });
    const neonMat = new THREE.MeshBasicMaterial({ color: 0xff0055 });

    for (let u = 0; u < 8; u++) {
      const rx = (this.random() - 0.5) * 80;
      const rz = (this.random() - 0.5) * 80;
      if (Math.abs(rx) < 12 && Math.abs(rz) < 12) continue;

      const hvac = new THREE.Mesh(new THREE.BoxGeometry(4.0, 2.8, 3.5), metalMat);
      hvac.position.set(rx, 1.4, rz);
      this.addReferenceObject(hvac);
      this.envObjects.push(hvac);

      // Neon warning beacon antenna on top
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.5, 6), metalMat);
      mast.position.set(rx, 4.5, rz);
      this.addReferenceObject(mast);
      this.envObjects.push(mast);

      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 6), neonMat);
      beacon.position.set(rx, 6.3, rz);
      this.addReferenceObject(beacon);
      this.envObjects.push(beacon);
    }
  }

  updateReferenceMechanisms(delta, horde, audioEngine, player) {
    const particles = this.game?.particles ?? horde?.particles ?? null;
    // 1. Pyramid Shifting Labyrinth Walls (AvP 2004)
    if (this.modularSlabs && this.modularSlabs.length > 0) {
      this.slabShiftTimer += delta;

      // Trigger labyrinth stone shift every cycle
      if (!this.isSlabMoving && this.slabShiftTimer >= this.slabShiftCycle) {
        this.isSlabMoving = true;
        this.slabMoveProgress = 0;
        this.slabShiftToggle = !this.slabShiftToggle;
        if (audioEngine && audioEngine.playPyramidStoneShift) {
          audioEngine.playPyramidStoneShift();
        }
      }

      if (this.isSlabMoving) {
        this.slabMoveProgress += delta / this.slabMoveDuration;
        const t = Math.sin(Math.min(1.0, this.slabMoveProgress) * (Math.PI / 2));
        const factor = this.slabShiftToggle ? t : (1.0 - t);

        this.modularSlabs.forEach(slab => {
          slab.mesh.position.copy(slab.homePos).addScaledVector(slab.shiftOffset, factor);

          // Check crushing collision against Xenomorph horde caught in sliding path
          if (horde && horde.aliens) {
            for (let i = horde.aliens.length - 1; i >= 0; i--) {
              const alien = horde.aliens[i];
              if (!alien || !alien.mesh) continue;

              const dist = alien.mesh.position.distanceTo(slab.mesh.position);
              if (dist < 5.4) {
                alien.mesh.position.addScaledVector(slab.dir, (this.slabShiftToggle ? 1 : -1) * 12.0 * delta);
                alien.hp -= 320 * delta;

                if (alien.hp <= 0) {
                  if (horde.goreEngine) {
                    horde.goreEngine.spawnDismemberment(alien.mesh.position, 'heavy');
                  }
                  horde.spawnAcidPool(alien.mesh.position);
                  this.removeReferenceObject(alien.mesh);
                  horde.defeatAlien?.(alien, { cause: 'environment-updateReferenceMechanisms', killerFaction: 'neutral' });
                }
              }
            }
          }
        });

        if (this.slabMoveProgress >= 1.0) {
          this.isSlabMoving = false;
          this.slabShiftTimer = 0;
        }
      }
    }

    // 2. Transformers Electrical Core Glow
    this.transformers.forEach(t => {
      if (!t.isDestroyed && t.coreMesh) {
        t.flickerTimer = (t.flickerTimer || 0) + delta * 8;
        t.coreMesh.scale.setScalar(0.9 + Math.sin(t.flickerTimer) * 0.15);
      }
    });

    // 3. Supply Cache Beacon Pulse
    this.supplyCaches.forEach(c => {
      if (!c.isOpened && c.beaconMesh) {
        c.beaconTimer = (c.beaconTimer || 0) + delta * 6;
        c.beaconMesh.material.opacity = 0.4 + Math.sin(c.beaconTimer) * 0.5;
      }
    });

    // 4. Living Resin Pustules
    for (let i = this.resinPustules.length - 1; i >= 0; i--) {
      const p = this.resinPustules[i];
      p.breathTimer = (p.breathTimer || 0) + delta * 3.5;
      const s = 1.0 + Math.sin(p.breathTimer) * 0.18;
      p.mesh.scale.set(s, s * 1.2, s);

      let triggered = false;
      if (player && player.position && player.position.distanceTo(p.pos) <= 2.4) {
        triggered = true;
        if (player.takeDamage) player.takeDamage(18, true);
      }
      if (!triggered && horde && horde.aliens) {
        for (let a of horde.aliens) {
          if (a.hp > 0 && a.mesh && a.mesh.position.distanceTo(p.pos) <= 2.4) {
            triggered = true;
            a.hp -= 45;
            break;
          }
        }
      }

      if (triggered) {
        if (audioEngine && audioEngine.playAcidFloorHiss) audioEngine.playAcidFloorHiss();
        if (horde && horde.spawnAcidPool) horde.spawnAcidPool(p.pos);
        this.removeReferenceObject(p.mesh);
        this.resinPustules.splice(i, 1);
      }
    }

    // 5. Chantier 1: Subterranean Acid Trenches Bubble & Caustic Melt
    for (const trench of this.acidTrenches) {
      if (trench.acidMesh) {
        trench.bubbleTimer = (trench.bubbleTimer || 0) + delta * 2.5;
        trench.acidMesh.position.y = trench.baseY + Math.sin(trench.bubbleTimer) * 0.08;
      }

      // Check player inside caustic acid trench
      if (player && player.position) {
        const px = player.position.x;
        const pz = player.position.z;
        if (px >= trench.minX && px <= trench.maxX && pz >= trench.minZ && pz <= trench.maxZ) {
          let onBridge = false;
          for (const b of trench.bridges) {
            if (px >= b.minX && px <= b.maxX && pz >= b.minZ && pz <= b.maxZ) {
              onBridge = true;
              break;
            }
          }
          if (!onBridge && player.position.y <= -0.5) {
            player.takeDamage(26 * delta, true);
            if (player.inflictVisorAcidBurn) player.inflictVisorAcidBurn();
            trench.soundCooldown = (trench.soundCooldown || 0) - delta;
            if (trench.soundCooldown <= 0) {
              trench.soundCooldown = 1.2;
              if (audioEngine && audioEngine.playAcidTrenchBubble) {
                audioEngine.playAcidTrenchBubble();
              }
            }
          }
        }
      }

      // Check aliens caught in caustic acid trench
      if (horde && horde.aliens) {
        for (let a of horde.aliens) {
          if (!a || a.hp <= 0 || !a.mesh) continue;
          const ax = a.mesh.position.x;
          const az = a.mesh.position.z;
          if (ax >= trench.minX && ax <= trench.maxX && az >= trench.minZ && az <= trench.maxZ) {
            let onBridge = false;
            for (const b of trench.bridges) {
              if (ax >= b.minX && ax <= b.maxX && az >= b.minZ && az <= b.maxZ) {
                onBridge = true;
                break;
              }
            }
            if (!onBridge && a.mesh.position.y <= -0.5) {
              a.hp -= 85 * delta;
              if (this.random() < 0.05 && audioEngine && audioEngine.playAcidTrenchBubble) {
                audioEngine.playAcidTrenchBubble();
              }
            }
          }
        }
      }
    }

    // 6. Chantier 3: Space Jockey Dais & Architect's Omni-Scan Presence
    if (this.spaceJockeyPlatform && player && player.position) {
      const p = this.spaceJockeyPlatform;
      const dx = player.position.x - p.pos.x;
      const dz = player.position.z - p.pos.z;
      const distSq = dx * dx + dz * dz;

      if (distSq <= p.radius * p.radius) {
        if (!p.hasTriggeredHum) {
          p.hasTriggeredHum = true;
          if (audioEngine && audioEngine.playDerelictHum) {
            audioEngine.playDerelictHum();
          }
        }
        // Architect's Tactical Resonance: +15 Plasma Energy / sec while standing on dais
        if (player.plasmaEnergy < player.maxPlasmaEnergy) {
          player.plasmaEnergy = Math.min(player.maxPlasmaEnergy, player.plasmaEnergy + 15 * delta);
        }
        // Rotate Engineer celestial rings
        if (p.rings) {
          p.rings.rotation.y += delta * 0.4;
        }
      } else {
        p.hasTriggeredHum = false;
      }
    }

    // 7. Chantier 5: Overhead Industrial Cargo Crane Fall Physics
    if (this.cargoCrane && this.cargoCrane.isDropping) {
      const crane = this.cargoCrane;
      crane.fallVelocity += 28.0 * delta;
      crane.container.position.y -= crane.fallVelocity * delta;

      if (crane.container.position.y <= 1.9) {
        crane.container.position.y = 1.9;
        crane.isDropping = false;
        crane.isDropped = true;

        if (audioEngine && audioEngine.playHeavySlamImpact) {
          audioEngine.playHeavySlamImpact();
        }
        if (this.game && this.game.triggerCameraShake) {
          this.game.triggerCameraShake(0.85, 0.4);
        }

        // 1500 Crush Damage in drop zone [12, 20] x [-3, 3]
        if (horde && horde.aliens) {
          for (let i = horde.aliens.length - 1; i >= 0; i--) {
            const a = horde.aliens[i];
            if (!a || !a.mesh) continue;
            if (Math.abs(a.mesh.position.x - crane.pos.x) <= 3.6 && Math.abs(a.mesh.position.z - crane.pos.z) <= 2.8) {
              a.hp -= 1500;
              if (horde.goreEngine) horde.goreEngine.spawnDismemberment(a.mesh.position, 'heavy');
              horde.spawnAcidPool(a.mesh.position);
              this.removeReferenceObject(a.mesh);
              horde.defeatAlien?.(a, { cause: 'environment-updateReferenceMechanisms', killerFaction: 'neutral' });
            }
          }
        }
      }
    }

    // 8. Chantier 9: Hive Egg Clusters Proximity & Hatching
    for (const nursery of this.eggNurseries) {
      if (player && player.position) {
        const dist = player.position.distanceTo(nursery.pos);
        // If uncloaked player approaches within 7.5m, dormant eggs awaken and open
        if (dist <= 7.5 && (!player.isCloaked || dist <= 3.2)) {
          nursery.eggs.forEach(egg => {
            if (!egg.isHatched && !egg.isDestroyed) {
              egg.isHatched = true;
              if (egg.petals) {
                egg.petals.forEach(pt => { pt.rotation.z += 0.6; });
              }
              if (audioEngine && audioEngine.playFacehuggerLatch) {
                audioEngine.playFacehuggerLatch();
              }
              // Spawn aggressive facehugger from hatched egg
              if (horde && horde.spawnAlien) {
                const spawnPos = egg.mesh.position.clone().add(new THREE.Vector3(0, 0.6, 0));
                horde.spawnAlien('facehugger', spawnPos);
              }
            }
          });
        }
      }
    }

    // 9. Chantier 4: Cryo-Surgical Med-Bay Pod Diagnostics Glow
    this.cryoMedBays.forEach(pod => {
      if (pod.glowMesh) {
        pod.glowTimer = (pod.glowTimer || 0) + delta * 3.0;
        pod.glowMesh.material.opacity = pod.isUsed ? 0.15 : (0.4 + Math.sin(pod.glowTimer) * 0.25);
      }
    });

    // 10. Chantier 1 (v42): Emergency Atmospheric Decompression Airlock Suction Vortex
    if (this.decompressionAirlock && this.decompressionAirlock.isOpen) {
      const airlock = this.decompressionAirlock;
      airlock.timer -= delta;
      if (airlock.sirenMesh) {
        airlock.sirenMesh.rotation.y += delta * 12.0;
      }

      const breachPos = airlock.pos.clone().add(new THREE.Vector3(0, 1.5, 0));
      const suctionRadius = 24.0;

      // Suction on Xenomorphs
      if (horde && horde.aliens) {
        for (let i = horde.aliens.length - 1; i >= 0; i--) {
          const a = horde.aliens[i];
          if (!a || !a.mesh) continue;
          const dist = a.mesh.position.distanceTo(breachPos);
          if (dist <= suctionRadius) {
            const pullDir = breachPos.clone().sub(a.mesh.position).normalize();
            a.mesh.position.addScaledVector(pullDir, 18.0 * delta);

            // Ejected into outer space void!
            if (dist <= 3.4 && a.mesh.position.z >= 65.0) {
              if (horde.goreEngine) horde.goreEngine.spawnDismemberment(a.mesh.position, 'heavy');
              this.removeReferenceObject(a.mesh);
              horde.defeatAlien?.(a, { cause: 'environment-updateReferenceMechanisms', killerFaction: 'neutral' });
            }
          }
        }
      }

      // Suction on Player
      if (player && player.position) {
        const pDist = player.position.distanceTo(breachPos);
        if (pDist <= 18.0) {
          const pullDir = breachPos.clone().sub(player.position).normalize();
          player.position.addScaledVector(pullDir, 6.0 * delta);
          player.mesh.position.copy(player.position);
        }
      }

      if (airlock.timer <= 0) {
        airlock.isOpen = false;
        airlock.doorL.position.x = -2.2;
        airlock.doorR.position.x = 2.2;
        if (airlock.sirenMesh) airlock.sirenMesh.material.color.setHex(0x334155);
      }
    }

    // 11. Chantier 7 (v42): Steam Conduits Scalding Thermal Jet
    this.steamConduits.forEach(c => {
      if (c.isRuptured) {
        c.steamTimer -= delta;
        if (c.steamMesh) {
          c.steamMesh.visible = true;
          c.steamMesh.scale.set(
            1.0 + Math.sin((this.referenceTime * 1000) * 0.02) * 0.25,
            1.0 + Math.cos((this.referenceTime * 1000) * 0.02) * 0.25,
            1.0 + Math.sin((this.referenceTime * 1000) * 0.015) * 0.3
          );
        }

        // Damage aliens in 6m jet cone
        if (horde && horde.aliens) {
          horde.aliens.forEach(a => {
            if (a && a.hp > 0 && a.mesh && a.mesh.position.distanceTo(c.pos) <= 6.0) {
              a.hp -= 35 * delta;
              a.speed = Math.max(3, a.speed * 0.7);
            }
          });
        }

        // Damage player in 6m jet cone
        if (player && player.position && player.position.distanceTo(c.pos) <= 6.0) {
          player.takeDamage(16 * delta, false);
          if (player.inflictVisorAcidBurn) player.inflictVisorAcidBurn();
        }

        if (c.steamTimer <= 0) {
          c.isRuptured = false;
          if (c.steamMesh) c.steamMesh.visible = false;
        }
      }
    });

    // 12. Chantier 9 (v42): Xenomorph Chrysalis Cocoons
    this.chrysalisCocoons.forEach(c => {
      if (!c.isHarvested && !c.isTriggered && c.mesh) {
        c.breathTimer = (c.breathTimer || 0) + delta * 2.5;
        c.mesh.scale.set(1.0, 1.0 + Math.sin(c.breathTimer) * 0.08, 1.0);
      }
    });

    // 13. Chantier 1 (v43): Queen Ovipositor Peristaltic Pumping & Live Egg Laying (Aliens 1986)
    if (this.queenOvipositor && !this.queenOvipositor.isSevered) {
      const ovi = this.queenOvipositor;
      ovi.pumpTimer += delta;
      // Peristaltic breath undulation
      if (ovi.group) {
        const pulse = Math.sin(ovi.pumpTimer * 3.0) * 0.06;
        ovi.group.scale.set(1.0 + pulse, 1.0 - pulse * 0.5, 1.0 + pulse * 1.2);
      }

      if (ovi.pumpTimer >= ovi.pumpInterval) {
        ovi.pumpTimer = 0;
        if (audioEngine && audioEngine.playOvipositorPump) {
          audioEngine.playOvipositorPump();
        }

        // Lay a live Ovomorph Egg behind the ovipositor chute
        if (horde && horde.spawnAlien) {
          const eggSpawnPos = new THREE.Vector3(
            ovi.pos.x + (this.random() - 0.5) * 4.0,
            0,
            ovi.pos.z - 4.5 + (this.random() - 0.5) * 3.0
          );
          // Spawn egg cluster or facehugger
          horde.spawnAlien('facehugger', eggSpawnPos);
          if (this.game && this.game.ui) {
            this.game.ui.showAnnouncement('🥚 LA REINE POND EN DIRECT : ÉRUPTION D\'OVOMORPHE VIVANT !');
          }
        }
      }
    }

    // 14. Chantier 2 (v43): Atmospheric Condenser Lightning Surge & Lightning Rods (Alien 3)
    this.ionStormTimer += delta;
    if (this.ionStormTimer >= 22.0) {
      this.ionStormTimer = 0;
      this.triggerLightningStrike(audioEngine, this.game ? this.game.particles : null, horde, player);
    }

    // Decay active lightning bolt beam
    if (this.activeLightningBolt) {
      this.activeLightningBolt.timer -= delta;
      if (this.activeLightningBolt.timer <= 0) {
        this.removeReferenceObject(this.activeLightningBolt.mesh);
        this.activeLightningBolt = null;
      }
    }

    // 15. Chantier 7 (v43): Liquid Nitrogen Freeze Zones & Deep Shatter Status
    for (let i = this.activeFreezeZones.length - 1; i >= 0; i--) {
      const zone = this.activeFreezeZones[i];
      zone.timer -= delta;
      if (zone.mesh) {
        zone.mesh.material.opacity = Math.max(0.1, (zone.timer / 8.5) * 0.65);
      }

      // Freeze all Xenomorphs in zone
      if (horde && horde.aliens) {
        horde.aliens.forEach(a => {
          if (!a || !a.mesh || a.hp <= 0) return;
          if (a.mesh.position.distanceTo(zone.pos) <= zone.radius) {
            a.isFrozen = true;
            a.freezeTimer = 4.5;
            a.speed = 0;
            if (a.mesh.traverse) {
              a.mesh.traverse(child => {
                if (child.isMesh && child.material && !child.origColor) {
                  child.origColor = child.material.color.getHex();
                  child.material.color.setHex(0x93c5fd); // Crystalline ice blue
                }
              });
            }
          }
        });
      }

      if (zone.timer <= 0) {
        this.removeReferenceObject(zone.mesh);
        this.activeFreezeZones.splice(i, 1);
      }
    }

    // 16. Chantier 10 (v43): Bio-Resin Webbing Player Viscosity Slow
    if (player && player.position) {
      for (const web of this.resinWebbings) {
        if (!web.isDestroyed && player.position.distanceTo(web.pos) <= web.radius) {
          player.speedMultiplier = 0.45; // 55% speed reduction
          web.soundTimer = (web.soundTimer || 0) - delta;
          if (web.soundTimer <= 0) {
            web.soundTimer = 1.0;
          }
          break;
        }
      }
    }

    // 17. Chantier 5 (v44): Cryo Specimen Tubes Preservative Fluid Oscillation
    this.cryoSpecimenTubes.forEach(tube => {
      if (!tube.isShattered && tube.fluidMesh) {
        tube.pulse = (tube.pulse || 0) + delta * 2.2;
        const scaleY = 1.0 + Math.sin(tube.pulse) * 0.04;
        tube.fluidMesh.scale.set(1.0, scaleY, 1.0);
      }
    });

    // 18. Chantier 6 (v44): Power Loader Hydraulic Clamp Animation & Beacon Pulse
    if (this.powerLoader) {
      const pl = this.powerLoader;
      if (pl.clampCooldown > 0) pl.clampCooldown -= delta;
      if (pl.beacon) {
        pl.beacon.material.opacity = 0.5 + Math.sin((this.referenceTime * 1000) * 0.012) * 0.5;
      }
      if (pl.isClamping) {
        pl.clampAnim += delta * 6.0;
        const closeAngle = Math.sin(Math.min(Math.PI, pl.clampAnim)) * 0.45;
        if (pl.leftArm) pl.leftArm.rotation.y = closeAngle;
        if (pl.rightArm) pl.rightArm.rotation.y = -closeAngle;
        if (pl.clampAnim >= Math.PI) {
          pl.isClamping = false;
          if (pl.leftArm) pl.leftArm.rotation.y = 0;
          if (pl.rightArm) pl.rightArm.rotation.y = 0;
        }
      }
    }

    // 19. Chantier 9 (v44): Corrosive Atmospheric Acid Rain Storm Weather Cycle
    this.updateAcidRain(delta, horde, player, audioEngine);

    // 20. Chantier 2 (v45): Drivable USCM M577 APC Vehicle Physics & Autocannon
    if (this.drivableAPC) {
      this.updateDrivableAPC(delta, player, horde, audioEngine, particles);
    }

    // 21. Chantier 3 (v45): Colony Reactor Meltdown Countdown & Klaxon Sirens
    if (this.reactorMeltdownActive) {
      this.updateReactorMeltdown(delta, player, horde, audioEngine, particles);
    }

    // 22. Chantier 6 (v45): High-Voltage Discharging Electric Floor Grids
    this.updateElectricFloorGrids(delta, horde, audioEngine, particles);

    // 23. Chantier 9 (v45): Weyland-Yutani Med-Lab Decontamination Airlock
    if (this.deconAirlock) {
      this.updateDeconAirlock(delta, player, audioEngine, particles);
    }

    // 24. Chantier 1 (v46): Heavy Mounted USCM M56 Smartgun Turret
    if (this.mountedSmartgun) {
      this.updateSmartgun(delta, player);
    }

    // 25. Chantier 2 (v46): Derelict LV-426 Low Gravity & Blue Laser Mist Plane
    if (this.derelictChamber) {
      this.updateDerelictChamber(delta, player, horde, audioEngine, particles, this.game ? this.game.ui : null);
    }

    // 26. Chantier 6 (v46): Colonial JP-4 Fuel Lines & Flame Wall
    if (this.fuelLines && this.fuelLines.length > 0) {
      this.updateFuelLines(delta, player, horde, this.game ? this.game.synthetics : null, particles, audioEngine);
    }
  }

  /* Chantier 1: Elevated Industrial Catwalks & Gantry Ramps (Hadley's Hope / Romulus 1:1 Lore) */
  buildIndustrialCatwalks(isAncient = false) {
    const metalMat = new THREE.MeshStandardMaterial({
      color: isAncient ? 0x222e3d : 0x1e293b,
      metalness: 0.85,
      roughness: 0.25
    });
    const stripeMat = new THREE.MeshBasicMaterial({ color: isAncient ? 0x38bdf8 : 0xfacc15 });
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9 });

    const platforms = [
      { x: -28, z: 18, length: 26, width: 5.5, height: 5.2, rampDir: 'z', rampSide: 1 },
      { x: 28, z: -18, length: 26, width: 5.5, height: 5.2, rampDir: 'z', rampSide: -1 }
    ];

    platforms.forEach(p => {
      const group = new THREE.Group();

      // Elevated deck platform
      const deckGeo = new THREE.BoxGeometry(p.width, 0.4, p.length);
      const deck = new THREE.Mesh(deckGeo, metalMat);
      deck.position.set(p.x, p.height, p.z);
      deck.receiveShadow = true;
      group.add(deck);

      // Warning hazard stripe edges
      [-p.width / 2, p.width / 2].forEach(ox => {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.45, p.length), stripeMat);
        stripe.position.set(p.x + ox, p.height + 0.1, p.z);
        group.add(stripe);

        // Safety Railings
        const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, p.length, 6), metalMat);
        rail.rotation.x = Math.PI / 2;
        rail.position.set(p.x + ox, p.height + 1.2, p.z);
        group.add(rail);
      });

      // 6 Heavy Support Pillars
      [-p.length / 2.5, 0, p.length / 2.5].forEach(oz => {
        [-p.width / 2.2, p.width / 2.2].forEach(ox => {
          const col = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, p.height, 8), pillarMat);
          col.position.set(p.x + ox, p.height / 2, p.z + oz);
          group.add(col);
        });
      });

      // Inclined Access Ramp
      const rampLength = 14.0;
      const deckTop = p.height + .2;
      const ramp = new THREE.Mesh(walkRampGeometry(p.width, rampLength, deckTop), metalMat);
      const rampZ = p.z + p.rampSide * (p.length / 2 + rampLength / 2);
      ramp.position.set(p.x, 0, rampZ);
      if (p.rampSide > 0) ramp.rotation.y = Math.PI;
      ramp.receiveShadow = true;
      group.add(ramp);

      this.addReferenceObject(group);
      this.envObjects.push(group);

      const record = {
        minX: p.x - p.width / 2,
        maxX: p.x + p.width / 2,
        minZ: p.z - p.length / 2,
        maxZ: p.z + p.length / 2,
        height: deckTop,
        ramp: {
          minX: p.x - p.width / 2,
          maxX: p.x + p.width / 2,
          minZ: Math.min(p.z + p.rampSide * (p.length / 2), rampZ + p.rampSide * rampLength / 2),
          maxZ: Math.max(p.z + p.rampSide * (p.length / 2), rampZ + p.rampSide * rampLength / 2),
          bottomZ: rampZ + p.rampSide * (rampLength / 2),
          topZ: p.z + p.rampSide * (p.length / 2),
          height: deckTop
        }
      };
      this.catwalks.push(record);
      const bottom = [p.x, 0, record.ramp.bottomZ], top = [p.x, deckTop, record.ramp.topZ], accesses = [{ bottom, top }];
      this.registerReferenceWalkSurface?.(deck, { id: `catwalk-${p.x}-deck`, bounds: record, heightAt: () => deckTop, accesses });
      this.registerReferenceWalkSurface?.(ramp, { id: `catwalk-${p.x}-ramp`, bounds: record.ramp,
        heightAt: (_x, z) => THREE.MathUtils.clamp(Math.abs(z - record.ramp.bottomZ) / rampLength, 0, 1) * deckTop, accesses, kind: 'ramp' });
    });
  }

  getElevationAt(x, z) {
    // 1. Space Jockey Elevated Dais
    if (this.spaceJockeyPlatform) {
      const p = this.spaceJockeyPlatform;
      const dx = x - p.pos.x;
      const dz = z - p.pos.z;
      if (dx * dx + dz * dz <= p.radius * p.radius) {
        return p.height; // +2.2m elevated Engineer dais
      }
    }

    // 2. Dropped Weyland-Yutani Cargo Container Top
    if (this.cargoCrane && this.cargoCrane.isDropped) {
      const c = this.cargoCrane;
      if (Math.abs(x - c.pos.x) <= 3.3 && Math.abs(z - c.pos.z) <= 2.2) {
        return 3.8; // On top of crushed container
      }
    }

    // 3. Elevated Industrial Catwalks & Access Ramps
    for (const c of this.catwalks) {
      if (x >= c.minX && x <= c.maxX && z >= c.minZ && z <= c.maxZ) {
        return c.height;
      }
      const r = c.ramp;
      if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) {
        const factor = Math.abs(z - r.bottomZ) / Math.abs(r.topZ - r.bottomZ);
        return Math.max(0, Math.min(r.height, factor * r.height));
      }
    }

    // 4. Subterranean Caustic Acid Trenches (-1.5m unless on metal bridge)
    for (const trench of this.acidTrenches) {
      if (x >= trench.minX && x <= trench.maxX && z >= trench.minZ && z <= trench.maxZ) {
        let onBridge = false;
        for (const b of trench.bridges) {
          if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) {
            onBridge = true;
            break;
          }
        }
        if (!onBridge) {
          return trench.depth || -1.5;
        }
      }
    }

    // 5. Crashed Scout Ship Elevated Sniper Deck (AVP: Requiem 2007)
    if (this.crashedScoutShip && this.crashedScoutShip.consolePos) {
      const c = this.crashedScoutShip.consolePos;
      const dx = x - c.x;
      const dz = z - c.z;
      if (dx * dx + dz * dz <= 4.2 * 4.2) {
        return 5.8;
      }
    }

    // 6. Ancient Banyan Hunting Boughs (3D Vertical Sniper Perch)
    if (this.huntingBoughs && this.huntingBoughs.length > 0) {
      for (const b of this.huntingBoughs) {
        const dx = x - b.pos.x;
        const dz = z - b.pos.z;
        if (dx * dx + dz * dz <= 2.6 * 2.6) {
          return b.height;
        }
      }
    }

    // 7. Collapsible Floor Grates (-2.2m subterranean acid drop if collapsed)
    if (this.collapsibleFloorGrates && this.collapsibleFloorGrates.length > 0) {
      for (const g of this.collapsibleFloorGrates) {
        if (g.isCollapsed) {
          const dx = x - g.pos.x;
          const dz = z - g.pos.z;
          if (dx * dx + dz * dz <= 2.5 * 2.5) {
            return -2.2;
          }
        }
      }
    }

    // 8. LA Rooftops Helipad (+4.5m) and Access Ramp
    if (this.laRooftopExpansion && this.laRooftopExpansion.helipadPos) {
      const hx = x - this.laRooftopExpansion.helipadPos.x;
      const hz = z - this.laRooftopExpansion.helipadPos.z;
      if (hx * hx + hz * hz <= 7.0 * 7.0) {
        return 4.5;
      }
      if (Math.abs(hx) <= 2.6 && z >= -14 && z <= -7) {
        const factor = (z - (-14)) / 7.0;
        return factor * 4.5;
      }
    }

    // 9. Antarctic Pyramid Sacrificial Caster Dais (+2.2m)
    if (this.pyramidSacrificial && this.pyramidSacrificial.daisPos) {
      const dx = x - this.pyramidSacrificial.daisPos.x;
      const dz = z - this.pyramidSacrificial.daisPos.z;
      if (dx * dx + dz * dz <= 5.5 * 5.5) {
        return 2.2;
      }
    }

    // 10. Val Verde Downed Huey Fuselage Top (+3.2m)
    if (this.valVerdeProps && this.valVerdeProps.wreckPos) {
      const wx = x - this.valVerdeProps.wreckPos.x;
      const wz = z - this.valVerdeProps.wreckPos.z;
      if (Math.abs(wx) <= 2.6 && Math.abs(wz) <= 5.0) {
        return 3.2;
      }
    }

    // 11. Hive World Hardened Chitin Webbing Bridges (+4.5m)
    if (this.hiveWorldExpansion && this.hiveWorldExpansion.bridges) {
      for (const br of this.hiveWorldExpansion.bridges) {
        if (x >= br.minX && x <= br.maxX && z >= br.minZ && z <= br.maxZ) {
          return 4.5;
        }
      }
    }

    // 12. Gunnison Gothic Cemetery Crypt & Mausoleum (+3.2m)
    if (this.gunnisonExpansion && this.gunnisonExpansion.mausoleumPos) {
      const mx = x - this.gunnisonExpansion.mausoleumPos.x;
      const mz = z - this.gunnisonExpansion.mausoleumPos.z;
      if (Math.abs(mx) <= 4.2 && Math.abs(mz) <= 3.2) {
        return 3.2;
      }
      // West access steps
      if (x >= 17 && x <= 20 && Math.abs(z - (-20)) <= 2.2) {
        const factor = (x - 17) / 3.0;
        return factor * 3.2;
      }
    }

    // 13. Charon Science Upper Mezzanine Gantry (+4.2m)
    if (this.charonExpansion && this.charonExpansion.gantryPos) {
      if (Math.abs(x) <= 12.0 && z >= -28.5 && z <= -23.5) {
        return 4.2;
      }
      // West access ramp
      if (x >= -16 && x <= -12 && z >= -27 && z <= -25) {
        const factor = (x - (-16)) / 4.0;
        return factor * 4.2;
      }
    }

    // 14. Game Preserve Super Predator Hunting Perch (+5.2m)
    if (this.gamePreserveExpansion && this.gamePreserveExpansion.perchPos) {
      const px = x - this.gamePreserveExpansion.perchPos.x;
      const pz = z - this.gamePreserveExpansion.perchPos.z;
      if (Math.abs(px) <= 3.5 && Math.abs(pz) <= 3.5) {
        return 5.2;
      }
      // Ladder incline
      if (Math.abs(x - 20) <= 1.5 && z >= 15 && z <= 18.5) {
        const factor = (z - 15) / 3.5;
        return factor * 5.2;
      }
    }

    // 15. LA Rooftops Suspended Window-Washing Cradle (+7.5m)
    if (this.windowCradle && this.windowCradle.cradlePos) {
      if (Math.abs(x) <= 3.0 && z >= 26.5 && z <= 29.5) {
        return 7.5;
      }
      // Connecting gangway
      if (Math.abs(x) <= 1.2 && z >= 22.5 && z <= 26.5) {
        const factor = (z - 22.5) / 4.0;
        return 4.5 + factor * 3.0;
      }
    }

    // 16. Val Verde Guerrilla Sandbag Dugout Bunker (+2.4m)
    if (this.sandbagBunker && this.sandbagBunker.pos) {
      const bx = x - this.sandbagBunker.pos.x;
      const bz = z - this.sandbagBunker.pos.z;
      if (Math.abs(bx) <= 3.2 && Math.abs(bz) <= 2.6) {
        return 2.4;
      }
      // Rear steps
      if (x >= 13 && x <= 15 && Math.abs(z - (-14)) <= 1.8) {
        const factor = (x - 13) / 2.0;
        return factor * 2.4;
      }
    }

    // 17. Billy Sole's Fallen Giant Log Bridge (+4.0m) (Predator 1987)
    if (this.billyLogBridge && this.billyLogBridge.pos) {
      if (x >= -14 && x <= 10 && z >= -27.5 && z <= -24.5) {
        return 4.0;
      }
    }

    // 18. Guerrilla Sniper Watchtower Platform (+5.5m) (Predator 1987)
    if (this.guerrillaWatchtower && this.guerrillaWatchtower.pos) {
      if (Math.abs(x - 8) <= 2.2 && Math.abs(z - 6) <= 2.2) {
        return 5.5;
      }
      // Access ladder incline
      if (Math.abs(x - 8) <= 1.2 && z >= 1.0 && z <= 4.2) {
        const factor = (z - 1.0) / 3.2;
        return factor * 5.5;
      }
    }

    // 19. Cascading River Waterfall Rocky Cliff Ledge (+6.2m) (Predator 1987)
    if (this.valVerdeWaterfall && this.valVerdeWaterfall.pos) {
      if (x >= 28 && x <= 36 && z >= -12 && z <= -4) {
        return 6.2;
      }
      // Rocky trail ramp
      if (x >= 23 && x <= 28 && z >= -10 && z <= -6) {
        const factor = (x - 23) / 5.0;
        return factor * 6.2;
      }
    }

    // 20. Rebel Communications Shack Roof (+2.6m) (Predator 1987)
    if (this.rebelFuelDepot && this.rebelFuelDepot.shackPos) {
      if (x >= 0 && x <= 4.5 && z >= 8 && z <= 12.5) {
        return 2.6;
      }
    }

    // 21. Canopy Bough Highway & Vine Tightrope Bridges (+6.8m) (Predator 1987)
    if (this.canopyBoughHighways && this.canopyBoughHighways.length > 0) {
      for (const bridge of this.canopyBoughHighways) {
        if (x >= bridge.minX && x <= bridge.maxX && z >= bridge.minZ && z <= bridge.maxZ) {
          return 6.8;
        }
      }
    }

    // 22. Dutch's Challenge Rock (+1.8m) (Predator 1987)
    if (this.dutchChallengeRock && this.dutchChallengeRock.pos) {
      const dx = x - this.dutchChallengeRock.pos.x;
      const dz = z - this.dutchChallengeRock.pos.z;
      if (dx * dx + dz * dz <= 2.2 * 2.2) {
        return 1.8;
      }
    }

    // 23. Jungle Hunter Self-Destruct Blast Crater Rim (+1.2m) (Predator 1987)
    if (this.yautjaCraterLocus && this.yautjaCraterLocus.pos) {
      const dx = x - this.yautjaCraterLocus.pos.x;
      const dz = z - this.yautjaCraterLocus.pos.z;
      const distSq = dx * dx + dz * dz;
      if (distSq >= 4.0 * 4.0 && distSq <= 7.2 * 7.2) {
        return 1.2;
      }
    }

    // 24. Eastern Columbia Spire & Gargoyle Balcony (+12.0m) (Predator 2 1990)
    if (this.easternColumbiaSpire && this.easternColumbiaSpire.pos) {
      const dx = x - 28.0;
      const dz = z - (-26.0);
      if (Math.abs(dx) <= 3.2 && Math.abs(dz) <= 3.2) {
        return 12.0;
      }
      // Access ladder incline from roof to balcony
      if (Math.abs(dx) <= 1.2 && z >= -25.0 && z <= -21.0) {
        const factor = (z - (-21.0)) / -4.0;
        return factor * 12.0;
      }
    }

    // 25. OWLF Meat Locker Overhead Conveyor Catwalk (+5.2m) (Predator 2 1990)
    if (this.meatLockerFacility && this.meatLockerFacility.pos) {
      if (x >= -34.0 && x <= -22.0 && z >= -15.0 && z <= -9.0) {
        return 5.2;
      }
    }

    // 26. King Willie's Voodoo Cistern Platform (+2.8m) (Predator 2 1990)
    if (this.kingWillieAltar && this.kingWillieAltar.pos) {
      const kx = x - 18.0;
      const kz = z - 24.0;
      if (kx * kx + kz * kz <= 3.0 * 3.0) {
        return 2.8;
      }
    }

    // 27. Lost Tribe Mother Ship Docking Hatch Dais (+1.5m) (Predator 2 1990)
    if (this.lostTribeShipDais && this.lostTribeShipDais.pos) {
      const lx = x - 0.0;
      const lz = z - (-32.0);
      if (lx * lx + lz * lz <= 5.0 * 5.0) {
        return 1.5;
      }
    }

    // 28. Subway Metro Transit Car #666 & Elevated Track Spur (+3.6m) (Predator 2 1990)
    if (this.subwayCar666 && this.subwayCar666.pos) {
      if (x >= -36.0 && x <= -12.0 && z >= -38.5 && z <= -33.5) {
        return 3.6;
      }
    }

    // 29. OWLF Surveillance Command Van Roof (+3.2m) (Predator 2 1990)
    if (this.owlfCommandVan && this.owlfCommandVan.pos) {
      const vx = x - (-28.0);
      const vz = z - 8.0;
      if (Math.abs(vx) <= 3.8 && Math.abs(vz) <= 2.2) {
        return 3.2;
      }
    }

    // 30. El Scorpio's Colombian Cartel Penthouse (+3.8m) (Predator 2 1990)
    if (this.cartelPenthouse && this.cartelPenthouse.pos) {
      const px = x - 32.0;
      const pz = z - 18.0;
      if (Math.abs(px) <= 4.5 && Math.abs(pz) <= 4.5) {
        return 3.8;
      }
    }

    // 31. Tenement Fire Escape Balconies (+2.5m and +5.0m) (Predator 2 1990)
    if (this.fireEscapeStairs && this.fireEscapeStairs.pos) {
      if (x >= 18.0 && x <= 24.0 && z >= 8.5 && z <= 11.5) {
        return x < 21.0 ? 2.5 : 5.0;
      }
    }

    // 32. Royce's Free-fall Cliff Edge & Overlook (+9.0m) (Predators 2010)
    if (this.royceCliffWaterfall && this.royceCliffWaterfall.pos) {
      const cx = x - (-28.0);
      const cz = z - (-26.0);
      if (Math.abs(cx) <= 4.2 && Math.abs(cz) <= 3.8) {
        return 9.0;
      }
      // Natural cliffside root trail ascent ramp
      if (x >= -24.0 && x <= -20.0 && Math.abs(cz) <= 2.8) {
        const factor = (-20.0 - x) / 4.0;
        return factor * 9.0;
      }
    }

    // 33. Ronald Noland's C-130 / Drilling Rig Scrap Roof (+4.2m) (Predators 2010)
    if (this.nolandHideout && this.nolandHideout.pos) {
      const nx = x - (-28.0);
      const nz = z - 24.0;
      if (Math.abs(nx) <= 4.8 && Math.abs(nz) <= 4.0) {
        return 4.2;
      }
    }

    // 34. Super Predator Scout Ship Launch Dais (+3.0m) (Predators 2010)
    if (this.superPredatorShipDais && this.superPredatorShipDais.pos) {
      const sx = x - 0.0;
      const sz = z - (-32.0);
      if (sx * sx + sz * sz <= 6.2 * 6.2) {
        return 3.0;
      }
    }

    // 35. Quadruple Celestial Moons Horizon Vista Platform (+7.5m) (Predators 2010)
    if (this.celestialVistaMonolith && this.celestialVistaMonolith.pos) {
      const vx = x - 30.0;
      const vz = z - (-26.0);
      if (Math.abs(vx) <= 4.0 && Math.abs(vz) <= 4.0) {
        return 7.5;
      }
      // Ancient stone ramp ascent
      if (x >= 24.0 && x <= 27.0 && Math.abs(vz) <= 2.2) {
        const factor = (x - 24.0) / 3.0;
        return factor * 7.5;
      }
    }

    // 36. Falconer Drone Roost & Canopy Branch Platform (+4.8m) (Predators 2010)
    if (this.falconerDronePerch && this.falconerDronePerch.pos) {
      const fx = x - 10.0;
      const fz = z - 14.0;
      if (Math.abs(fx) <= 3.2 && Math.abs(fz) <= 3.2) {
        return 4.8;
      }
      // Access branch incline
      if (Math.abs(fx) <= 1.2 && z >= 8.0 && z <= 11.5) {
        const factor = (z - 8.0) / 3.5;
        return factor * 4.8;
      }
    }

    // 37. Isabelle's Sniper Overlook & Tactical Nest (+9.0m) (Predators 2010)
    if (this.isabelleSniperStash && this.isabelleSniperStash.pos) {
      const ix = x - (-28.0);
      const iz = z - (-28.0);
      if (Math.abs(ix) <= 3.5 && Math.abs(iz) <= 3.5) {
        return 9.0;
      }
    }

    // 38. Val Verde Mountain Cliff & Waterfall Basin Leap (+6.2m) (Predator 1987)
    if (this.valVerdeWaterfall && this.valVerdeWaterfall.pos) {
      const wx = x - 32.0;
      const wz = z - (-8.0);
      if (Math.abs(wx) <= 4.2 && Math.abs(wz) <= 4.2) {
        return 6.2;
      }
      // Natural cliff trail ramp
      if (x >= 24.5 && x <= 28.5 && Math.abs(wz) <= 2.0) {
        const factor = (x - 24.5) / 4.0;
        return factor * 6.2;
      }
    }

    // 39. Crashed Fugitive Ark Starship Platform (+5.4m) (The Predator 2018)
    if (this.crashedArkStarship && this.crashedArkStarship.pos) {
      const ax = x - 22.0;
      const az = z - (-18.0);
      if (Math.abs(ax) <= 4.5 && Math.abs(az) <= 4.5) {
        return 5.4;
      }
      // Metal fuselage ramp incline
      if (x >= 16.0 && x <= 19.5 && Math.abs(az) <= 2.2) {
        const factor = (x - 16.0) / 3.5;
        return factor * 5.4;
      }
    }

    // 40. Quinn McKenna's Rooftop Sniper Perch (+6.8m) (The Predator 2018)
    if (this.quinnSniperPerch && this.quinnSniperPerch.pos) {
      const qx = x - (-20.0);
      const qz = z - (-22.0);
      if (Math.abs(qx) <= 3.8 && Math.abs(qz) <= 3.8) {
        return 6.8;
      }
      // Exterior metal industrial stairs
      if (x >= -24.0 && x <= -20.5 && Math.abs(qz) <= 1.8) {
        const factor = (x - (-24.0)) / 3.5;
        return factor * 6.8;
      }
    }

    // 41. Overturned "Loonies" Military Transport Bus (+3.2m) (The Predator 2018)
    if (this.looniesTransportBus && this.looniesTransportBus.pos) {
      const bx = x - (-24.0);
      const bz = z - 4.0;
      if (Math.abs(bx) <= 3.2 && Math.abs(bz) <= 5.2) {
        return 3.2;
      }
    }

    // 42. Giant Shattered Oak Tracking Arena Overlook (+4.5m) (The Predator 2018)
    if (this.shatteredOakArena && this.shatteredOakArena.pos) {
      const ox = x - 0.0;
      const oz = z - 26.0;
      if (Math.abs(ox) <= 3.6 && Math.abs(oz) <= 3.6) {
        return 4.5;
      }
      // Fallen massive bough ramp
      if (Math.abs(ox) <= 1.4 && z >= 20.0 && z <= 24.0) {
        const factor = (z - 20.0) / 4.0;
        return factor * 4.5;
      }
    }

    // 43. Baxley & Coyle's Sandbag Bunker Platform (+2.2m) (The Predator 2018)
    if (this.baxleyCoyleBunker && this.baxleyCoyleBunker.pos) {
      const bcx = x - 6.0;
      const bcz = z - (-22.0);
      if (Math.abs(bcx) <= 3.0 && Math.abs(bcz) <= 2.6) {
        return 2.2;
      }
    }

    // 44. Stargazer Autumn Canopy Bough Aerial Highway (+6.8m) (The Predator 2018)
    if (this.stargazerCanopyHighways && this.stargazerCanopyHighways.length > 0) {
      for (let h = 0; h < this.stargazerCanopyHighways.length; h++) {
        const span = this.stargazerCanopyHighways[h];
        if (x >= span.minX && x <= span.maxX && z >= span.minZ && z <= span.maxZ) {
          return 6.8;
        }
      }
    }

    return 0;
  }

  /* Chantier 3: High-Voltage Electrical Transformers & Arc Discharge (Alien 3 / Romulus Lore) */
  buildElectricalTransformers(count = 4) {
    const coords = [
      { x: 18, z: 22 },
      { x: -18, z: -22 },
      { x: -22, z: 18 },
      { x: 22, z: -18 }
    ];

    const metalMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.9, roughness: 0.2 });
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x67e8f9 });

    coords.slice(0, count).forEach(pos => {
      const group = new THREE.Group();
      group.position.set(pos.x, 0, pos.z);

      // Base generator housing
      const housing = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.2, 2.4), metalMat);
      housing.position.y = 1.6;
      group.add(housing);

      // Cooling radiator fins
      for (let f = -1.0; f <= 1.0; f += 0.4) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.4, 0.08), metalMat);
        fin.position.set(0, 1.6, f);
        group.add(fin);
      }

      // Ceramic insulator bushings
      [-0.7, 0.7].forEach(ox => {
        const ins = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 1.2, 8), new THREE.MeshStandardMaterial({ color: 0x94a3b8 }));
        ins.position.set(ox, 3.8, 0);
        group.add(ins);
      });

      // High-voltage glowing plasma discharge core
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 10), coreMat);
      core.position.set(0, 3.6, 0);
      group.add(core);

      this.addReferenceObject(group);
      this.envObjects.push(group);

      this.transformers.push({
        mesh: group,
        coreMesh: core,
        pos: new THREE.Vector3(pos.x, 0, pos.z),
        isDestroyed: false,
        flickerTimer: 0
      });
    });
  }

  checkTransformerHits(attackPos, radius, synthetics, horde, audioEngine, particles) {
    for (let t of this.transformers) {
      if (t.isDestroyed) continue;
      if (attackPos.distanceTo(t.pos) <= radius + 2.0) {
        t.isDestroyed = true;
        t.coreMesh.material.color.setHex(0x334155);

        if (audioEngine && audioEngine.playElectricalArc) {
          audioEngine.playElectricalArc();
        }
        if (particles) {
          particles.emitSparks(t.pos.clone().add(new THREE.Vector3(0, 3.5, 0)), 35);
        }

        // Electrocution Area-of-Effect (13.0m radius)
        const shockRadius = 13.0;

        // 1. Stun & Short-Circuit Synthetics
        if (synthetics && synthetics.androids) {
          synthetics.androids.forEach(syn => {
            if (syn.mesh.position.distanceTo(t.pos) <= shockRadius) {
              syn.isEMPStunned = true;
              syn.empStunTimer = 5.0;
              syn.hp -= 140;
              synthetics.emitWhiteSyntheticBlood(syn.mesh.position);
            }
          });
        }

        // 2. Paralyze & Electrocute Xenomorphs
        if (horde && horde.aliens) {
          horde.aliens.forEach(a => {
            if (a.hp > 0 && a.mesh.position.distanceTo(t.pos) <= shockRadius) {
              a.hp -= 220;
              a.speed = Math.max(1.5, a.speed * 0.2); // Severe motor paralysis
              this.referenceDelay(() => {
                if (a && a.hp > 0) a.speed = a.type === 'facehugger' ? 17 : (a.type === 'crusher' ? 12 : 11);
              }, 4000);
            }
          });
        }

        return true;
      }
    }
    return false;
  }

  /* Chantier 4: USCM M290 Supply Caches (Aliens 1986 Canon 1:1) */
  buildUSCMSupplyCaches(count = 2) {
    const coords = [
      { x: 0, z: 26 },
      { x: 0, z: -26 }
    ];

    const armorMat = new THREE.MeshStandardMaterial({ color: 0x3d4a36, roughness: 0.6, metalness: 0.4 });
    const stencMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.9 });

    coords.slice(0, count).forEach(pos => {
      const group = new THREE.Group();
      group.position.set(pos.x, 0, pos.z);

      // Crate tub
      const tub = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.2, 1.6), armorMat);
      tub.position.y = 0.6;
      group.add(tub);

      // Crate hinged lid
      const lid = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.3, 1.7), armorMat);
      lid.position.set(0, 1.35, 0);
      group.add(lid);

      // Yellow USCM Weyland-Yutani Stencil stripe
      const stenc = new THREE.Mesh(new THREE.BoxGeometry(2.52, 0.15, 0.3), stencMat);
      stenc.position.set(0, 0.6, 0.81);
      group.add(stenc);

      // Green Stroboscopic Beacon on corner
      const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.25, 6), beaconMat);
      beacon.position.set(1.0, 1.6, 0.6);
      group.add(beacon);

      this.addReferenceObject(group);
      this.envObjects.push(group);

      this.supplyCaches.push({
        mesh: group,
        lidMesh: lid,
        beaconMesh: beacon,
        pos: new THREE.Vector3(pos.x, 0, pos.z),
        isOpened: false,
        beaconTimer: 0
      });
    });
  }

  checkSupplyInteraction(playerPos, player, ui, audioEngine) {
    for (let c of this.supplyCaches) {
      if (c.isOpened) continue;
      if (playerPos.distanceTo(c.pos) <= 3.8) {
        c.isOpened = true;
        c.lidMesh.rotation.x = -Math.PI * 0.45; // Hinge opens backwards
        c.lidMesh.position.y += 0.4;
        c.beaconMesh.material.color.setHex(0x64748b); // Extinguish beacon

        if (audioEngine && audioEngine.playSupplyCacheOpen) {
          audioEngine.playSupplyCacheOpen();
        }

        // Full Replenishment Perks
        player.plasmaEnergy = player.maxPlasmaEnergy;
        player.royalJellyFlasks = Math.min(3, player.royalJellyFlasks + 1);
        player.hp = Math.min(player.maxHp, player.hp + 250);

        if (ui && ui.showAnnouncement) {
          ui.showAnnouncement('📦 CAISSE DE RAVITAILLEMENT USCM OUVERTE : ARSENAL & SOINS PLEINEMENT RÉAPPROVISIONNÉS !');
        }
        return true;
      }
    }
    return false;
  }

  /* Chantier 6: Destructible Blast Doors & Hydraulic Bulkheads (Aliens 1986 / Romulus) */
  buildHydraulicBlastDoors() {
    const coords = [
      { x: -12, z: 0, rotY: 0 },
      { x: 12, z: 0, rotY: 0 },
      { x: 0, z: -15, rotY: Math.PI / 2 }
    ];

    const metalMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.9, roughness: 0.2 });
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xeab308 });

    coords.forEach(c => {
      const group = new THREE.Group();
      group.position.set(c.x, 0, c.z);
      group.rotation.y = c.rotY;

      // Frame pillars
      [-2.8, 2.8].forEach(ox => {
        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.8, 6.5, 1.2), metalMat);
        frame.position.set(ox, 3.25, 0);
        group.add(frame);
      });

      // Top lintel
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(6.4, 1.0, 1.2), metalMat);
      lintel.position.set(0, 6.0, 0);
      group.add(lintel);

      // Double blast doors
      const doorL = new THREE.Mesh(new THREE.BoxGeometry(2.4, 5.5, 0.4), metalMat);
      doorL.position.set(-1.2, 2.75, 0);
      group.add(doorL);

      const doorR = new THREE.Mesh(new THREE.BoxGeometry(2.4, 5.5, 0.4), metalMat);
      doorR.position.set(1.2, 2.75, 0);
      group.add(doorR);

      // Caution stripes
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.35, 0.42), stripeMat);
      stripe.position.set(0, 2.75, 0);
      group.add(stripe);

      this.addReferenceObject(group);
      this.envObjects.push(group);

      this.blastDoors.push({
        mesh: group,
        doorL: doorL,
        doorR: doorR,
        pos: new THREE.Vector3(c.x, 0, c.z),
        hp: 180,
        isDestroyed: false
      });
    });
  }

  checkBlastDoorHits(attackPos, radius, damage, audioEngine, particles) {
    for (let d of this.blastDoors) {
      if (d.isDestroyed) continue;
      if (attackPos.distanceTo(d.pos) <= radius + 2.5) {
        d.hp -= damage;
        if (particles) particles.emitSparks(d.pos.clone().add(new THREE.Vector3(0, 2.5, 0)), 12);

        if (d.hp <= 0) {
          d.isDestroyed = true;
          d.doorL.visible = false;
          d.doorR.visible = false;

          if (audioEngine && audioEngine.playHydraulicDoorGrind) {
            audioEngine.playHydraulicDoorGrind();
          }
          if (particles) particles.emitSparks(d.pos, 30);
          return true;
        }
      }
    }
    return false;
  }

  /* Chantier 8: Living Biomechanical Wall Resin & Acid Pustules (Aliens 1986 / Giger Canon) */
  buildBiomechanicalWallResin() {
    const resinMat = new THREE.MeshStandardMaterial({ color: 0x1f060c, roughness: 0.35, metalness: 0.8 });
    const pustuleMat = new THREE.MeshStandardMaterial({
      color: 0x84cc16,
      emissive: 0x4d7c0f,
      roughness: 0.2,
      metalness: 0.1
    });

    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const radius = 68; // On arena border walls
      const px = Math.cos(angle) * radius;
      const pz = Math.sin(angle) * radius;

      const group = new THREE.Group();
      group.position.set(px, 1.8, pz);

      // Ribbed resin wall clump
      const clump = new THREE.Mesh(new THREE.SphereGeometry(1.6, 8, 8), resinMat);
      clump.scale.set(1.4, 0.8, 0.6);
      group.add(clump);

      // Living pulsating acid pustule
      const pustule = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 8), pustuleMat);
      pustule.position.set(0, 0.2, 0.5);
      group.add(pustule);

      this.addReferenceObject(group);
      this.envObjects.push(group);

      this.resinPustules.push({
        mesh: group,
        pustuleMesh: pustule,
        pos: new THREE.Vector3(px, 1.8, pz),
        breathTimer: this.random() * Math.PI * 2
      });
    }
  }

  /* === v41.0 10-CHANTIER EXPANSION LEVEL DESIGN METHODS === */

  /* Chantier 1: Subterranean Acid Trenches & Caustic Canals (Hadley's Hope / Romulus 1:1) */
  buildAcidTrenches() {
    const acidMat = new THREE.MeshStandardMaterial({
      color: 0x84cc16,
      emissive: 0x3f6212,
      roughness: 0.1,
      metalness: 0.2,
      transparent: true,
      opacity: 0.88
    });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.85, roughness: 0.3 });
    const gratingMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.9, roughness: 0.4 });
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });

    const trenchConfigs = [
      { z: 28, minX: -45, maxX: 45, width: 6.0, depth: -1.5 },
      { z: -28, minX: -45, maxX: 45, width: 6.0, depth: -1.5 }
    ];

    trenchConfigs.forEach(cfg => {
      const group = new THREE.Group();
      const halfW = cfg.width / 2;

      // Caustic boiling acid liquid surface
      const acidGeo = new THREE.PlaneGeometry(cfg.maxX - cfg.minX, cfg.width);
      acidGeo.rotateX(-Math.PI / 2);
      const acidMesh = new THREE.Mesh(acidGeo, acidMat);
      acidMesh.position.set(0, cfg.depth + 0.15, cfg.z);
      group.add(acidMesh);

      // Reinforced trench rim curbs with hazard chevrons
      [-halfW - 0.2, halfW + 0.2].forEach(oz => {
        const curb = new THREE.Mesh(new THREE.BoxGeometry(cfg.maxX - cfg.minX, 0.4, 0.4), rimMat);
        curb.position.set(0, 0.2, cfg.z + oz);
        group.add(curb);

        const chevron = new THREE.Mesh(new THREE.BoxGeometry(cfg.maxX - cfg.minX, 0.1, 0.42), stripeMat);
        chevron.position.set(0, 0.36, cfg.z + oz);
        group.add(chevron);
      });

      // Connected maps keep the reserved central circulation route on a real
      // grating as well as the two historical offset crossings.
      const bridges = [];
      (this.battlefieldLayout ? [-16, 0, 16] : [-16, 16]).forEach(bx => {
        const bridgeGeo = new THREE.BoxGeometry(4.5, 0.35, cfg.width + 0.8);
        const bridge = new THREE.Mesh(bridgeGeo, gratingMat);
        bridge.position.set(bx, 0.18, cfg.z);
        group.add(bridge);

        // Bridge safety guard rails
        [-2.25, 2.25].forEach(ox => {
          const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, cfg.width + 0.8, 6), rimMat);
          rail.rotation.x = Math.PI / 2;
          rail.position.set(bx + ox, 1.2, cfg.z);
          group.add(rail);
        });

        const bounds = {
          minX: bx - 2.25,
          maxX: bx + 2.25,
          minZ: cfg.z - halfW - 0.4,
          maxZ: cfg.z + halfW + 0.4
        };
        bridges.push(bounds);
        this.registerReferenceWalkSurface?.(bridge, { id: `acid-trench-${cfg.z}-grate-${bx}`, kind: 'grate', bounds, heightAt: () => .355 });
      });

      this.addReferenceObject(group);
      this.envObjects.push(group);

      this.acidTrenches.push({
        group: group,
        acidMesh: acidMesh,
        baseY: cfg.depth + 0.15,
        bubbleTimer: this.random() * Math.PI,
        soundCooldown: 0,
        minX: cfg.minX,
        maxX: cfg.maxX,
        minZ: cfg.z - halfW,
        maxZ: cfg.z + halfW,
        depth: cfg.depth,
        bridges: bridges
      });
    });
  }

  /* Chantier 3: Derelict Juggernaut Space Jockey Chamber & Telescope Dais (Alien 1979 / Prometheus) */
  buildSpaceJockeyDais() {
    const group = new THREE.Group();
    const daisPos = new THREE.Vector3(0, 0, -42);
    group.position.copy(daisPos);

    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.65, metalness: 0.35 });
    const cuneiformMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const fossilMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8, metalness: 0.2 });

    // Multi-tiered elevated circular dais (height +2.2m)
    const baseCyl = new THREE.Mesh(new THREE.CylinderGeometry(8.0, 8.8, 1.2, 24), stoneMat);
    baseCyl.position.y = 0.6;
    baseCyl.receiveShadow = true;
    group.add(baseCyl);

    const upperCyl = new THREE.Mesh(new THREE.CylinderGeometry(7.2, 7.6, 1.0, 24), stoneMat);
    upperCyl.position.y = 1.7;
    upperCyl.receiveShadow = true;
    group.add(upperCyl);

    // Glowing Engineer Celestial Rings (rotate in update)
    const ringsGroup = new THREE.Group();
    const ringMesh1 = new THREE.Mesh(new THREE.TorusGeometry(6.2, 0.08, 6, 32), cuneiformMat);
    ringMesh1.rotation.x = Math.PI / 2;
    ringMesh1.position.y = 2.22;
    ringsGroup.add(ringMesh1);

    const ringMesh2 = new THREE.Mesh(new THREE.TorusGeometry(4.4, 0.06, 6, 24), cuneiformMat);
    ringMesh2.rotation.x = Math.PI / 2;
    ringMesh2.position.y = 2.22;
    ringsGroup.add(ringMesh2);
    group.add(ringsGroup);

    // Monumental Fossilized Space Jockey Pilot Chair & Ribbed Helmet/Telescope
    const chairBase = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.8, 1.8, 12), fossilMat);
    chairBase.position.y = 2.8;
    group.add(chairBase);

    // Pilot Ribbed Spine & Fossilized Engineer Torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.4, 1.6), fossilMat);
    torso.position.set(0, 4.2, 0);
    group.add(torso);

    // Iconic Biomechanical Elephantine Trunk / Helmet
    const head = new THREE.Mesh(new THREE.SphereGeometry(1.0, 10, 10), fossilMat);
    head.scale.set(0.9, 1.3, 1.4);
    head.position.set(0, 5.2, 0.6);
    group.add(head);

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.18, 2.2, 8), fossilMat);
    trunk.position.set(0, 4.2, 1.6);
    trunk.rotation.x = -Math.PI / 3;
    group.add(trunk);

    // Massive Telescope / Planetary Orrery Cannon (Pointing 40° skyward)
    const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.1, 7.5, 12), fossilMat);
    cannon.position.set(0, 6.2, -1.8);
    cannon.rotation.x = Math.PI / 4.5;
    group.add(cannon);

    this.addReferenceObject(group);
    this.envObjects.push(group);

    this.spaceJockeyPlatform = {
      group: group,
      pos: daisPos,
      radius: 8.0,
      height: 2.2,
      rings: ringsGroup,
      hasTriggeredHum: false
    };
  }

  /* Chantier 4: Cryo-Surgical Med-Bay Pods & Embryo Purge (Prometheus / Romulus) */
  buildCryoMedBays(count = 2) {
    const podPositions = [
      { x: -38, z: 0, rotY: Math.PI / 2 },
      { x: 38, z: 0, rotY: -Math.PI / 2 }
    ];

    const compositeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.25, metalness: 0.8 });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.1,
      metalness: 0.9,
      transparent: true,
      opacity: 0.45
    });
    const glowMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.5 });

    podPositions.slice(0, count).forEach(pos => {
      const group = new THREE.Group();
      group.position.set(pos.x, 0, pos.z);
      group.rotation.y = pos.rotY;

      // Base pedestal
      const pedestal = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 3.2), compositeMat);
      pedestal.position.y = 0.25;
      group.add(pedestal);

      // Medical stasis bed & Autodoc frame
      const frame = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.4, 2.8), compositeMat);
      frame.position.set(0, 1.0, 0);
      group.add(frame);

      // Cylindrical transparent cryo stasis chamber hood
      const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 2.4, 12), glassMat);
      hood.rotation.x = Math.PI / 2;
      hood.position.set(0, 1.6, 0);
      group.add(hood);

      // Surgical laser scanner ring armature
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.08, 6, 20), compositeMat);
      ring.position.set(0, 1.6, 0);
      group.add(ring);

      // Holographic diagnostic console beacon
      const consoleMesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, 0.4), compositeMat);
      consoleMesh.position.set(1.4, 1.2, 0);
      group.add(consoleMesh);

      const holoGlow = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), glowMat);
      holoGlow.position.set(1.4, 2.0, 0);
      group.add(holoGlow);

      this.addReferenceObject(group);
      this.envObjects.push(group);

      this.cryoMedBays.push({
        mesh: group,
        glowMesh: holoGlow,
        pos: new THREE.Vector3(pos.x, 0, pos.z),
        isUsed: false,
        cooldownTimer: 0,
        glowTimer: 0
      });
    });
  }

  checkCryoMedBayInteraction(playerPos, player, ui, audioEngine) {
    for (const pod of this.cryoMedBays) {
      if (pod.isUsed) continue;
      if (playerPos.distanceTo(pod.pos) <= 3.8) {
        pod.isUsed = true;
        pod.glowMesh.material.color.setHex(0x64748b);

        // 1. Purge Facehugger Embryo Incubation
        if (player.isChestbursterInfected) {
          player.isChestbursterInfected = false;
          player.chestbursterTimer = 0;
          if (ui && ui.showAnnouncement) {
            ui.showAnnouncement("⚡ AUTODOC W-Y : EMBRYON XÉNOMORPHE PURGÉ & ÉRADICATÉ !");
          }
        } else {
          if (ui && ui.showAnnouncement) {
            ui.showAnnouncement("⚕️ AUTODOC W-Y : DÉCONTAMINATION CRYO & RÉGÉNÉRATION (+120 HP)");
          }
        }

        // 2. Restore 120 HP & Cleanse Acid
        player.hp = Math.min(player.maxHp, player.hp + 120);
        player.visorAcidBurn = 0;

        if (audioEngine && audioEngine.playMedicompCauterize) {
          audioEngine.playMedicompCauterize();
        }
        return true;
      }
    }
    return false;
  }

  /* Chantier 5: Overhead Industrial Cargo Crane & 5-Ton Container Drop (Aliens 1986) */
  buildCargoCrane() {
    const cranePos = new THREE.Vector3(16, 11, 0);
    const group = new THREE.Group();

    const metalMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.9, roughness: 0.25 });
    const cableMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.95 });
    const containerMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.4, metalness: 0.5 });
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });

    // Ceiling Gantry Crane Rails & Truss Structure
    const railX = new THREE.Mesh(new THREE.BoxGeometry(32, 0.8, 1.2), metalMat);
    railX.position.set(16, 11, 0);
    group.add(railX);

    // Crane Trolley / Winch Housing
    const trolley = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.2, 3.2), metalMat);
    trolley.position.set(16, 10.4, 0);
    group.add(trolley);

    // Suspended High-Tensile Steel Winch Cable (Shootable Hitbox: y=6.0 to 10.0)
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4.8, 8), cableMat);
    cable.position.set(16, 8.0, 0);
    group.add(cable);

    // 5-Ton Weyland-Yutani Yellow Heavy Cargo Container (Suspended at y = 5.5m)
    const containerGroup = new THREE.Group();
    containerGroup.position.set(16, 5.5, 0);

    const box = new THREE.Mesh(new THREE.BoxGeometry(6.6, 3.8, 4.4), containerMat);
    box.castShadow = true;
    box.receiveShadow = true;
    containerGroup.add(box);

    // Hazard Stripes & Ribs
    for (let r = -2.6; r <= 2.6; r += 1.3) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.82, 4.42), stripeMat);
      rib.position.set(r, 0, 0);
      containerGroup.add(rib);
    }

    group.add(containerGroup);

    this.addReferenceObject(group);
    this.envObjects.push(group);

    this.cargoCrane = {
      group: group,
      container: containerGroup,
      cableMesh: cable,
      pos: new THREE.Vector3(16, 0, 0),
      isDropping: false,
      isDropped: false,
      fallVelocity: 0,
      cableHp: 90
    };
  }

  checkCraneCableHit(attackPos, radius, damage, audioEngine, particles, horde) {
    if (!this.cargoCrane || this.cargoCrane.isDropping || this.cargoCrane.isDropped) return false;

    // Cable hitbox around (16, 8.0, 0)
    const cablePos = new THREE.Vector3(16, 8.0, 0);
    if (attackPos.distanceTo(cablePos) <= radius + 1.8) {
      this.cargoCrane.cableHp -= damage;
      if (particles) particles.emitSparks(cablePos, 15);

      if (this.cargoCrane.cableHp <= 0) {
        this.cargoCrane.isDropping = true;
        this.cargoCrane.cableMesh.visible = false;

        if (audioEngine && audioEngine.playCargoCraneCableSnap) {
          audioEngine.playCargoCraneCableSnap();
        }
        if (particles) particles.emitSparks(cablePos, 35);
        return true;
      }
    }
    return false;
  }

  /* Chantier 9: Hive Egg Clusters & Royal Guard Praetorian Barricades (Aliens 1986 / Romulus) */
  buildEggNurseries() {
    const nurseryPos = new THREE.Vector3(-30, 0, -26);
    const group = new THREE.Group();
    group.position.copy(nurseryPos);

    const resinMat = new THREE.MeshStandardMaterial({ color: 0x1f060c, roughness: 0.35, metalness: 0.8 });
    const eggMat = new THREE.MeshStandardMaterial({
      color: 0x4d3826,
      roughness: 0.55,
      metalness: 0.2
    });
    const yolkMat = new THREE.MeshBasicMaterial({ color: 0x84cc16 });

    // Enclosing circular resin rampart
    for (let r = 0; r < 12; r++) {
      const angle = (r / 12) * Math.PI * 2;
      const rx = Math.cos(angle) * 4.2;
      const rz = Math.sin(angle) * 4.2;
      const barricade = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.9, 1.8, 6), resinMat);
      barricade.position.set(rx, 0.9, rz);
      group.add(barricade);
    }

    // 8 Biomechanical Ovomorph Eggs in cluster
    const eggs = [];
    for (let e = 0; e < 8; e++) {
      const angle = (e / 8) * Math.PI * 2;
      const rad = 1.2 + (e % 2) * 1.4;
      const ex = Math.cos(angle) * rad;
      const ez = Math.sin(angle) * rad;

      const eggGroup = new THREE.Group();
      eggGroup.position.set(ex, 0, ez);

      const baseEgg = new THREE.Mesh(new THREE.SphereGeometry(0.65, 8, 8), eggMat);
      baseEgg.scale.set(0.9, 1.3, 0.9);
      baseEgg.position.y = 0.75;
      eggGroup.add(baseEgg);

      // 4 Petal lips
      const petals = [];
      for (let p = 0; p < 4; p++) {
        const pAngle = (p / 4) * Math.PI * 2;
        const petal = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.35, 0.15), eggMat);
        petal.position.set(Math.cos(pAngle) * 0.25, 1.5, Math.sin(pAngle) * 0.25);
        eggGroup.add(petal);
        petals.push(petal);
      }

      // Internal glowing yolk
      const yolk = new THREE.Mesh(new THREE.SphereGeometry(0.25, 6, 6), yolkMat);
      yolk.position.y = 1.2;
      eggGroup.add(yolk);

      group.add(eggGroup);

      eggs.push({
        mesh: eggGroup,
        petals: petals,
        pos: nurseryPos.clone().add(new THREE.Vector3(ex, 0, ez)),
        isHatched: false,
        isDestroyed: false,
        hp: 60
      });
    }

    this.addReferenceObject(group);
    this.envObjects.push(group);

    this.eggNurseries.push({
      group: group,
      pos: nurseryPos,
      eggs: eggs
    });
  }

  checkEggClusterHits(attackPos, radius, damage, audioEngine, particles, horde) {
    let hitCount = 0;
    for (const nursery of this.eggNurseries) {
      for (const egg of nursery.eggs) {
        if (egg.isDestroyed || egg.isHatched) continue;
        if (attackPos.distanceTo(egg.pos) <= radius + 0.8) {
          egg.hp -= damage;
          if (particles && particles.emitAlienBloodSpurt) {
            particles.emitAlienBloodSpurt(egg.pos, 10);
          }

          if (egg.hp <= 0) {
            egg.isDestroyed = true;
            egg.mesh.visible = false;
            hitCount++;
            if (audioEngine && audioEngine.playAcidSizzle) {
              audioEngine.playAcidSizzle();
            }
            if (horde && horde.spawnAcidPool) {
              horde.spawnAcidPool(egg.pos);
            }
          }
        }
      }
    }
    return hitCount;
  }

  /* === v42.0 10-CHANTIER EXPANSION LEVEL DESIGN METHODS === */

  /* Chantier 1: Emergency Atmospheric Decompression Airlock (Alien 1979 / Aliens 1986) */
  buildDecompressionAirlock() {
    const group = new THREE.Group();
    const airlockPos = new THREE.Vector3(0, 0, 68);
    group.position.copy(airlockPos);

    const metalMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9, roughness: 0.2 });
    const blastMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.95, roughness: 0.15 });
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    const sirenMat = new THREE.MeshBasicMaterial({ color: 0x334155 });

    // Outer Bulkhead Reinforced Frame
    const frameL = new THREE.Mesh(new THREE.BoxGeometry(1.2, 7.5, 1.8), metalMat);
    frameL.position.set(-4.6, 3.75, 0);
    group.add(frameL);

    const frameR = new THREE.Mesh(new THREE.BoxGeometry(1.2, 7.5, 1.8), metalMat);
    frameR.position.set(4.6, 3.75, 0);
    group.add(frameR);

    const frameTop = new THREE.Mesh(new THREE.BoxGeometry(10.4, 1.2, 1.8), metalMat);
    frameTop.position.set(0, 7.0, 0);
    group.add(frameTop);

    // Double Sliding Titanium Blast Doors
    const doorL = new THREE.Mesh(new THREE.BoxGeometry(4.2, 6.2, 0.5), blastMat);
    doorL.position.set(-2.1, 3.1, 0);
    group.add(doorL);

    const doorR = new THREE.Mesh(new THREE.BoxGeometry(4.2, 6.2, 0.5), blastMat);
    doorR.position.set(2.1, 3.1, 0);
    group.add(doorR);

    // Hazard Stripes
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.3, 0.52), stripeMat);
    stripe.position.set(0, 3.1, 0);
    group.add(stripe);

    // Emergency Rotating Strobe Siren Beacon
    const siren = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.45, 8), sirenMat);
    siren.position.set(0, 7.8, 0);
    group.add(siren);

    // Manual Hydraulic Override Lever Console (at x = 3.8m, z = -1.8m relative)
    const consoleGroup = new THREE.Group();
    consoleGroup.position.set(3.8, 0, -1.8);

    const consolePedestal = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.3, 0.6), metalMat);
    consolePedestal.position.y = 0.65;
    consoleGroup.add(consolePedestal);

    const lever = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.7, 6), stripeMat);
    lever.position.set(0, 1.4, 0);
    lever.rotation.z = Math.PI / 4;
    consoleGroup.add(lever);

    group.add(consoleGroup);

    this.addReferenceObject(group);
    this.envObjects.push(group);

    this.decompressionAirlock = {
      group: group,
      pos: airlockPos,
      doorL: doorL,
      doorR: doorR,
      sirenMesh: siren,
      consolePos: airlockPos.clone().add(new THREE.Vector3(3.8, 1.2, -1.8)),
      isOpen: false,
      timer: 0,
      cooldown: 0
    };
  }

  checkAirlockConsoleInteraction(playerPos, audioEngine, ui) {
    if (!this.decompressionAirlock) return false;
    const airlock = this.decompressionAirlock;
    if (airlock.isOpen || airlock.cooldown > 0) return false;

    if (playerPos.distanceTo(airlock.consolePos) <= 3.4) {
      this.triggerAirlockDecompression(audioEngine, ui);
      return true;
    }
    return false;
  }

  triggerAirlockDecompression(audioEngine, ui) {
    if (!this.decompressionAirlock || this.decompressionAirlock.isOpen) return;
    const airlock = this.decompressionAirlock;
    airlock.isOpen = true;
    airlock.timer = 6.0; // 6 seconds decompression window
    airlock.cooldown = 20.0;

    // Slide blast doors open
    airlock.doorL.position.x = -4.5;
    airlock.doorR.position.x = 4.5;
    if (airlock.sirenMesh) {
      airlock.sirenMesh.material.color.setHex(0xff0000);
    }

    if (audioEngine && audioEngine.playDecompressionWhoosh) {
      audioEngine.playDecompressionWhoosh();
    }
    if (ui && ui.showAnnouncement) {
      ui.showAnnouncement('⚠️ DÉPRESSURISATION D\'URGENCE DU SAS PRINCIPAL ACTIVÉE ! VORTEX ATMOSPHÉRIQUE ACTIF !');
    }
    if (this.game && this.game.triggerCameraShake) {
      this.game.triggerCameraShake(0.65, 0.4);
    }
  }

  /* Chantier 7: High-Pressure Industrial Steam Conduit Ruptures (Alien 3 / Aliens 1986) */
  buildSteamConduits(count = 6) {
    const pipeCoords = [
      { x: -28, y: 2.5, z: -67, rotY: 0 },
      { x: 28, y: 2.5, z: -67, rotY: 0 },
      { x: -67, y: 2.5, z: -18, rotY: Math.PI / 2 },
      { x: -67, y: 2.5, z: 18, rotY: Math.PI / 2 },
      { x: 67, y: 2.5, z: -18, rotY: -Math.PI / 2 },
      { x: 67, y: 2.5, z: 18, rotY: -Math.PI / 2 }
    ];

    const copperMat = new THREE.MeshStandardMaterial({ color: 0xb45309, metalness: 0.9, roughness: 0.25 });
    const valveMat = new THREE.MeshBasicMaterial({ color: 0xd97706 });
    const steamMat = new THREE.MeshBasicMaterial({
      color: 0xf1f5f9,
      transparent: true,
      opacity: 0.65
    });

    pipeCoords.slice(0, count).forEach(coord => {
      const group = new THREE.Group();
      group.position.set(coord.x, coord.y, coord.z);
      group.rotation.y = coord.rotY;

      // Wall-mounted horizontal steam pipe segment
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 5.5, 8), copperMat);
      pipe.rotation.z = Math.PI / 2;
      group.add(pipe);

      // Red pressure relief valve wheel
      const valve = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.05, 6, 12), valveMat);
      valve.position.set(0, 0, 0.3);
      group.add(valve);

      // Scalding directional steam cone mesh (hidden until ruptured)
      const steamGeo = new THREE.ConeGeometry(2.2, 6.0, 8);
      steamGeo.rotateX(-Math.PI / 2);
      const steamMesh = new THREE.Mesh(steamGeo, steamMat);
      steamMesh.position.set(0, 0, 3.2);
      steamMesh.visible = false;
      group.add(steamMesh);

      this.addReferenceObject(group);
      this.envObjects.push(group);

      this.steamConduits.push({
        group: group,
        steamMesh: steamMesh,
        pos: new THREE.Vector3(coord.x, coord.y, coord.z),
        valvePos: new THREE.Vector3(coord.x, coord.y, coord.z),
        isRuptured: false,
        steamTimer: 0,
        hp: 40
      });
    });
  }

  checkSteamConduitHits(attackPos, radius, damage, audioEngine, particles) {
    let triggered = false;
    for (const c of this.steamConduits) {
      if (c.isRuptured) continue;
      if (attackPos.distanceTo(c.valvePos) <= radius + 1.2) {
        c.hp -= damage;
        if (particles) particles.emitSparks(c.valvePos, 12);

        if (c.hp <= 0) {
          c.isRuptured = true;
          c.steamTimer = 8.0;
          triggered = true;

          if (audioEngine && audioEngine.playSteamJetHiss) {
            audioEngine.playSteamJetHiss();
          }
        }
      }
    }
    return triggered;
  }

  /* Chantier 9: Xenomorph Chrysalis Moulting Cocoons & Ceiling Traps (Alien: Romulus / Alien 1979) */
  buildChrysalisCocoons(count = 8) {
    const cocoonMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.35,
      metalness: 0.75
    });
    const tendrilMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6 });

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const radius = 35 + (i % 2) * 12;
      const cx = Math.cos(angle) * radius;
      const cz = Math.sin(angle) * radius;
      const cy = 3.6;

      const group = new THREE.Group();
      group.position.set(cx, cy, cz);

      // Hanging fibrous resin tendril
      const tendril = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.08, 2.2, 6), tendrilMat);
      tendril.position.y = 1.1;
      group.add(tendril);

      // Molted chitin chrysalis carapace
      const cocoon = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.25, 2.4, 8), cocoonMat);
      cocoon.scale.set(1.0, 1.2, 0.8);
      group.add(cocoon);

      this.addReferenceObject(group);
      this.envObjects.push(group);

      this.chrysalisCocoons.push({
        mesh: group,
        pos: new THREE.Vector3(cx, cy, cz),
        isHarvested: false,
        isTriggered: false,
        breathTimer: this.random() * Math.PI * 2,
        isAmbush: this.random() < 0.5
      });
    }
  }

  checkCocoonInteraction(playerPos, horde, audioEngine, ui, particles) {
    for (const c of this.chrysalisCocoons) {
      if (c.isHarvested || c.isTriggered) continue;
      if (playerPos.distanceTo(c.pos) <= 3.2) {
        if (c.isAmbush) {
          c.isTriggered = true;
          c.mesh.visible = false;
          if (audioEngine && audioEngine.playXenoHiss) {
            audioEngine.playXenoHiss();
          }
          if (horde && horde.spawnAlien) {
            horde.spawnAlien('lurker', c.pos.clone().setY(0));
          }
          if (ui && ui.showAnnouncement) {
            ui.showAnnouncement('⚠️ EMBUSCADE : UN LURKER JAILLIT D\'UN COCON DE MUE SUSPENDU !');
          }
          return 'ambush';
        } else {
          c.isHarvested = true;
          c.mesh.visible = false;
          if (audioEngine && audioEngine.playMedicompCauterize) {
            audioEngine.playMedicompCauterize();
          }
          if (ui && ui.showAnnouncement) {
            ui.showAnnouncement('🔬 RECHERCHE BIOMÉCANIQUE : MUE DE CHITINE PRÉLEVÉE (+30 HONNEUR) !');
          }
          if (this.game) {
            this.game.score += 30;
          }
          return 'harvest';
        }
      }
    }
    return null;
  }

  /* Chantier 4: Catwalk Structural Pillars Demolition (Aliens 1986 / AvP 2004) */
  damageCatwalkPillars(hitPos, radius, damage, audioEngine, particles) {
    let collapsed = false;
    for (const c of this.catwalks) {
      if (c.isCollapsed) continue;
      const centerPos = new THREE.Vector3((c.minX + c.maxX) / 2, c.height / 2, (c.minZ + c.maxZ) / 2);
      if (hitPos.distanceTo(centerPos) <= radius + 5.0) {
        c.pillarHp = (c.pillarHp || 320) - damage;
        if (particles) particles.emitSparks(centerPos, 20);

        if (c.pillarHp <= 0) {
          c.isCollapsed = true;
          c.height = 1.0; // Collapsed to floor angle
          collapsed = true;

          if (audioEngine && audioEngine.playPillarCollapse) {
            audioEngine.playPillarCollapse();
          }
          if (this.game && this.game.triggerCameraShake) {
            this.game.triggerCameraShake(0.85, 0.45);
          }
          if (this.game && this.game.ui) {
            this.game.ui.showAnnouncement('💥 PILIERS DE PASSERELLE DÉTRUITS : EFFONDREMENT DE SECTION INDUSTRIELLE !');
          }
        }
      }
    }
    return collapsed;
  }

  /* =========================================================================
     v43.0 APEX LEVEL DESIGN & INTERACTIVE HAZARD SYSTEMS
     ========================================================================= */

  /* Chantier 1: Queen Ovipositor Egg Sack & Live Egg Laying Chamber (Aliens 1986) */
  buildQueenOvipositor() {
    const oviPos = new THREE.Vector3(0, 3.2, -32);
    const group = new THREE.Group();
    group.position.copy(oviPos);

    const sackMat = new THREE.MeshStandardMaterial({
      color: 0x3f1212,
      roughness: 0.3,
      metalness: 0.2,
      transparent: true,
      opacity: 0.88
    });

    const tendonMat = new THREE.MeshStandardMaterial({
      color: 0x1f060c,
      roughness: 0.6,
      metalness: 0.4
    });

    // 4 Segmented organic ellipsoid lobes of the egg sack
    const lobes = [
      { r: 2.2, l: 4.8, z: 0 },
      { r: 1.8, l: 4.2, z: -3.8 },
      { r: 1.4, l: 3.6, z: -7.2 },
      { r: 0.9, l: 2.6, z: -10.0 } // Laying chute
    ];

    lobes.forEach(l => {
      const geo = new THREE.SphereGeometry(l.r, 12, 12);
      geo.scale(1, 0.8, l.l / (l.r * 2));
      const mesh = new THREE.Mesh(geo, sackMat);
      mesh.position.set(0, 0, l.z);
      group.add(mesh);
    });

    // 6 Resinous Tendons anchoring sack to high ceiling
    for (let t = 0; t < 6; t++) {
      const angle = (t / 6) * Math.PI * 2;
      const tGeo = new THREE.CylinderGeometry(0.08, 0.16, 12, 6);
      const tMesh = new THREE.Mesh(tGeo, tendonMat);
      tMesh.position.set(Math.cos(angle) * 3.5, 6.0, -4.0 + Math.sin(angle) * 3.5);
      tMesh.rotation.z = Math.cos(angle) * 0.35;
      tMesh.rotation.x = Math.sin(angle) * 0.35;
      group.add(tMesh);
    }

    this.addReferenceObject(group);
    this.queenOvipositor = {
      group,
      pos: oviPos,
      hp: 1200,
      maxHp: 1200,
      pumpTimer: 0,
      pumpInterval: 12.0,
      isSevered: false
    };
  }

  checkOvipositorHit(pos, radius, damage, audioEngine, particles, horde, bosses) {
    if (!this.queenOvipositor || this.queenOvipositor.isSevered) return false;
    const ovi = this.queenOvipositor;
    if (pos.distanceTo(ovi.pos) <= radius + 5.0) {
      ovi.hp -= damage;
      if (particles) particles.emitAlienBloodSpurt(ovi.pos, 15);

      if (ovi.hp <= 0) {
        ovi.isSevered = true;
        ovi.group.position.y = 0.5; // Collapses to floor
        if (audioEngine && audioEngine.playOvipositorRupture) {
          audioEngine.playOvipositorRupture();
        }
        if (particles) particles.emitAlienBloodSpurt(ovi.pos, 50);

        // Severance damages Queen and enrages her!
        if (bosses && bosses.activeBoss) {
          bosses.takeDamage(600);
          bosses.activeBoss.isEnraged = true;
        }

        if (this.game && this.game.ui) {
          this.game.ui.showAnnouncement('💥 OVIPOSITEUR DE LA REINE SECTIONNÉ ! RUPTURE VISCÉRALE (+600 DÉGÂTS, REINE ENRAGÉE) !');
        }
        return true;
      }
    }
    return false;
  }

  /* Chantier 2: Atmospheric Condenser Lightning Rods & Ion Storm Arcs (Alien 3) */
  buildLightningRods() {
    const rodMat = new THREE.MeshStandardMaterial({ color: 0xb45309, metalness: 0.95, roughness: 0.15 }); // Weathered Copper
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.4 });

    const rodPositions = [
      new THREE.Vector3(-42, 0, -42),
      new THREE.Vector3(42, 0, -42),
      new THREE.Vector3(-42, 0, 42),
      new THREE.Vector3(42, 0, 42)
    ];

    rodPositions.forEach(p => {
      const group = new THREE.Group();
      group.position.copy(p);

      // Base pedestal
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.8, 3, 8), baseMat);
      base.position.y = 1.5;
      group.add(base);

      // 18m Copper Arrester Mast
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.35, 18, 8), rodMat);
      mast.position.y = 10.5;
      group.add(mast);

      // Spiked Crown Spike Array
      for (let s = 0; s < 4; s++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.08, 1.5, 4), rodMat);
        const a = (s / 4) * Math.PI * 2;
        spike.position.set(Math.cos(a) * 0.4, 19.8, Math.sin(a) * 0.4);
        spike.rotation.z = Math.cos(a) * 0.3;
        group.add(spike);
      }

      this.addReferenceObject(group);
      this.lightningRods.push({ group, pos: p });
    });
  }

  triggerLightningStrike(audioEngine, particles, horde, player) {
    if (audioEngine && audioEngine.playIonStormCharge) {
      audioEngine.playIonStormCharge();
    }

    // Pick random rod or center arena
    const targetRod = this.lightningRods[Math.floor(this.random() * this.lightningRods.length)];
    const strikePos = targetRod ? targetRod.pos.clone().setY(0) : new THREE.Vector3(0, 0, 0);

    // Visual Lightning Bolt Mesh (Cyan emissive jagged bolt)
    const boltGeo = new THREE.CylinderGeometry(0.2, 0.4, 25, 6);
    const boltMat = new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.95 });
    const bolt = new THREE.Mesh(boltGeo, boltMat);
    bolt.position.set(strikePos.x, 12.5, strikePos.z);
    this.addReferenceObject(bolt);

    this.activeLightningBolt = { mesh: bolt, timer: 0.35 };

    if (particles && particles.emitSparks) {
      particles.emitSparks(strikePos, 40);
    }

    // Stun and damage Xenomorphs in 10m radial arc
    if (horde && horde.aliens) {
      horde.aliens.forEach(a => {
        if (!a || a.hp <= 0 || !a.mesh) return;
        if (a.mesh.position.distanceTo(strikePos) <= 10.0) {
          a.hp -= 320;
          a.isStunned = true;
          a.stunTimer = 3.5;
        }
      });
    }

    // If player is cloaked and within 12m, electromagnetic pulse forcibly disables cloak
    if (player && player.position && player.position.distanceTo(strikePos) <= 12.0) {
      if (player.isCloaked) {
        player.toggleCloak();
        if (this.game && this.game.ui) {
          this.game.ui.showAnnouncement('⚡ SURTENSION ÉLECTROMAGNÉTIQUE : CAMOUFLAGE COURT-CIRCUITÉ !');
        }
      }
    }
  }

  /* Chantier 4: Fallen USCM Colonial Marine Casualties & Salvage (Aliens 1986) */
  buildFallenMarines() {
    const armorMat = new THREE.MeshStandardMaterial({ color: 0x3f4f3c, roughness: 0.7 }); // Camo Armor
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xca8a04, roughness: 0.8 });

    const marineSpawns = [
      new THREE.Vector3(-18, 0, 14),
      new THREE.Vector3(22, 0, -16),
      new THREE.Vector3(0, 0, 36),
      new THREE.Vector3(-34, 0, -22),
      new THREE.Vector3(34, 0, 26)
    ];

    marineSpawns.forEach((p, idx) => {
      const group = new THREE.Group();
      group.position.copy(p);

      // Torso prone on ground
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 1.4), armorMat);
      torso.position.y = 0.2;
      group.add(torso);

      // M10 Helmet
      const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), armorMat);
      helmet.position.set(0, 0.25, 0.8);
      group.add(helmet);

      // Spent M41A Pulse Rifle beside body
      const rifle = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.2, 0.9), new THREE.MeshStandardMaterial({ color: 0x1c1917, metalness: 0.9 }));
      rifle.position.set(0.6, 0.1, 0.2);
      rifle.rotation.y = 0.3;
      group.add(rifle);

      this.addReferenceObject(group);
      this.fallenMarines.push({
        group,
        pos: p,
        isScavenged: false,
        name: `Caporal USCM Section ${idx + 1}`
      });
    });
  }

  checkMarineScavengeInteraction(playerPos, player, sentryGun, ui, audioEngine) {
    for (const m of this.fallenMarines) {
      if (m.isScavenged) continue;
      if (playerPos.distanceTo(m.pos) <= 2.8) {
        m.isScavenged = true;
        // Dim marine mesh
        m.group.traverse(child => {
          if (child.isMesh && child.material) child.material.opacity = 0.5;
        });

        if (sentryGun && sentryGun.isDeployed) {
          sentryGun.reloadSentry(playerPos, 150);
        }

        if (player) {
          player.hp = Math.min(player.maxHp, player.hp + 45);
        }

        if (audioEngine && audioEngine.playSupplyPickup) {
          audioEngine.playSupplyPickup();
        }

        if (this.game) {
          this.game.score += 100;
        }

        if (ui && ui.showAnnouncement) {
          ui.showAnnouncement('🎖️ DÉPOUILLE DU MARINE USCM FOUILLÉE : +150 MUNITIONS SENTINELLE, MEDIKIT (+45 PV), DOG-TAGS (+100 HONNEUR) !');
        }
        return true;
      }
    }
    return false;
  }

  /* Chantier 7: Liquid Nitrogen Fire Suppression Overhead Deluge System (Alien: Resurrection 1997) */
  buildLiquidNitrogenTanks() {
    const tankMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, metalness: 0.9, roughness: 0.2 }); // Cryo Blue
    const pipeMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.3 });

    const tankPositions = [
      new THREE.Vector3(-25, 7.5, 20),
      new THREE.Vector3(25, 7.5, 20),
      new THREE.Vector3(0, 7.5, -20)
    ];

    tankPositions.forEach(p => {
      const group = new THREE.Group();
      group.position.copy(p);

      // Horizontal cryogenic cylinder
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 4.5, 12), tankMat);
      tank.rotation.z = Math.PI / 2;
      group.add(tank);

      // Hanging pull-chain & discharge nozzle
      const nozzle = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.8, 8), pipeMat);
      nozzle.rotation.x = Math.PI;
      nozzle.position.y = -0.6;
      group.add(nozzle);

      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.8, 6), pipeMat);
      chain.position.set(0.6, -1.8, 0);
      group.add(chain);

      this.addReferenceObject(group);
      this.nitrogenTanks.push({
        group,
        pos: p,
        isRuptured: false
      });
    });
  }

  checkNitrogenTankHits(pos, radius, damage, audioEngine, particles) {
    for (const t of this.nitrogenTanks) {
      if (t.isRuptured) continue;
      if (pos.distanceTo(t.pos) <= radius + 3.2) {
        t.isRuptured = true;
        if (audioEngine && audioEngine.playLiquidNitrogenBlast) {
          audioEngine.playLiquidNitrogenBlast();
        }

        // Spawn cryogenic floor deluge zone
        const floorPos = t.pos.clone().setY(0.1);
        const zoneGeo = new THREE.CircleGeometry(9.0, 24);
        zoneGeo.rotateX(-Math.PI / 2);
        const zoneMat = new THREE.MeshBasicMaterial({
          color: 0x93c5fd,
          transparent: true,
          opacity: 0.65,
          side: THREE.DoubleSide
        });
        const zoneMesh = new THREE.Mesh(zoneGeo, zoneMat);
        zoneMesh.position.copy(floorPos);
        this.addReferenceObject(zoneMesh);

        this.activeFreezeZones.push({
          mesh: zoneMesh,
          pos: floorPos,
          radius: 9.0,
          timer: 8.5
        });

        if (this.game && this.game.ui) {
          this.game.ui.showAnnouncement('❄️ DÉLUGE CRYOGÉNIQUE À L\'AZOTE LIQUIDE DÉCLENCHÉ : XÉNOS GIVRÉS (DÉGÂTS CRITIQUES 3X) !');
        }
        return true;
      }
    }
    return false;
  }

  /* Chantier 10: Queen Bio-Resin Webbing Barricades & Acid Adhesion (Aliens 1986) */
  buildResinWebbings() {
    const webMat = new THREE.MeshStandardMaterial({
      color: 0x2e1018,
      roughness: 0.4,
      metalness: 0.5,
      transparent: true,
      opacity: 0.8
    });

    const webSpawns = [
      { pos: new THREE.Vector3(-8, 2, -24), w: 6, h: 4 },
      { pos: new THREE.Vector3(8, 2, -24), w: 6, h: 4 },
      { pos: new THREE.Vector3(-14, 2, -30), w: 5, h: 4 },
      { pos: new THREE.Vector3(14, 2, -30), w: 5, h: 4 }
    ];

    webSpawns.forEach(w => {
      const geo = new THREE.BoxGeometry(w.w, w.h, 0.4);
      const mesh = new THREE.Mesh(geo, webMat);
      mesh.position.copy(w.pos);
      this.addReferenceObject(mesh);

      this.resinWebbings.push({
        mesh,
        pos: w.pos,
        radius: 3.5,
        hp: 200,
        isDestroyed: false
      });
    });
  }

  checkWebbingDamage(pos, radius, damage, particles) {
    for (const w of this.resinWebbings) {
      if (w.isDestroyed) continue;
      if (pos.distanceTo(w.pos) <= radius + 3.0) {
        w.hp -= damage;
        if (particles && particles.emitAlienBloodSpurt) {
          particles.emitAlienBloodSpurt(w.pos, 8);
        }
        if (w.hp <= 0) {
          w.isDestroyed = true;
          this.removeReferenceObject(w.mesh);
          return true;
        }
      }
    }
    return false;
  }

  /* Chantier 5: Weyland-Yutani Containment Cryo-Tubes & Chemical Burst (Prometheus / Romulus Canon 1:1) */
  buildCryoSpecimenTubes() {
    const tubePositions = [
      new THREE.Vector3(-28, 0, -14),
      new THREE.Vector3(-28, 0, 14),
      new THREE.Vector3(28, 0, -14),
      new THREE.Vector3(28, 0, 14)
    ];

    const baseMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9, roughness: 0.2 });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.42,
      roughness: 0.1,
      metalness: 0.85
    });
    const fluidMat = new THREE.MeshBasicMaterial({
      color: 0x22c55e,
      transparent: true,
      opacity: 0.65
    });
    const specimenMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.5 });

    tubePositions.forEach((pos, idx) => {
      const group = new THREE.Group();
      group.position.copy(pos);

      // Heavy octagonal stasis floor base
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, 0.6, 8), baseMat);
      base.position.y = 0.3;
      group.add(base);

      // Transparent cryo-containment glass cylinder
      const glass = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 3.6, 16, 1, true), glassMat);
      glass.position.y = 2.1;
      group.add(glass);

      // Bioluminescent preservation fluid core
      const fluid = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 3.3, 12), fluidMat);
      fluid.position.y = 2.05;
      group.add(fluid);

      // Suspended floating alien specimen (Facehugger / Chestburster silhouette)
      const specimen = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.9, 6), specimenMat);
      specimen.rotation.x = Math.PI / 1.5;
      specimen.position.set(0, 2.0, 0);
      group.add(specimen);

      // Top pressurization cap with LED indicator
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.2, 0.5, 8), baseMat);
      cap.position.y = 4.0;
      group.add(cap);

      const led = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), new THREE.MeshBasicMaterial({ color: 0x00ffff }));
      led.position.set(0, 4.3, 0);
      group.add(led);

      this.addReferenceObject(group);
      this.cryoSpecimenTubes.push({
        group,
        pos,
        glassMesh: glass,
        fluidMesh: fluid,
        specimenMesh: specimen,
        radius: 2.2,
        hp: 80,
        isShattered: false
      });
    });
  }

  checkCryoTubeHits(pos, radius, damage, audioEngine, particles, horde) {
    for (const tube of this.cryoSpecimenTubes) {
      if (tube.isShattered) continue;
      if (pos.distanceTo(tube.pos) <= radius + tube.radius) {
        tube.hp -= damage;
        if (particles && particles.emitSparks) {
          particles.emitSparks(tube.pos.clone().add(new THREE.Vector3(0, 2, 0)), 12);
        }

        if (tube.hp <= 0) {
          tube.isShattered = true;
          tube.glassMesh.visible = false;
          tube.fluidMesh.visible = false;
          tube.specimenMesh.visible = false;

          if (audioEngine && audioEngine.playLiquidNitrogenBlast) {
            audioEngine.playLiquidNitrogenBlast();
          }

          // Explosive cryogenic chemical blast: 350 damage in 6.5m radius to Xenomorphs
          if (horde && horde.aliens) {
            horde.checkMeleeHits({
              origin: tube.pos,
              radius: 6.5,
              damage: 350,
              type: 'heavy'
            });
            // Spawn caustic chemical floor pool
            horde.spawnAcidPool(tube.pos);
          }

          if (this.game && this.game.triggerCameraShake) {
            this.game.triggerCameraShake(0.6, 0.35);
          }

          if (this.game && this.game.ui) {
            this.game.ui.showAnnouncement('🧪 TUBE DE SPÉCIMEN CRYO-STATIQUE BRISÉ : DÉFLAGRATION CHIMIQUE 350 DÉGÂTS !');
          }
          return true;
        }
      }
    }
    return false;
  }

  /* Chantier 6: P-5000 Caterpillar Power Loader Workstation & Crushing Clamp (Aliens 1986 Canon 1:1) */
  buildPowerLoader() {
    const group = new THREE.Group();
    const pos = new THREE.Vector3(-15, 0, -36);
    group.position.copy(pos);

    const yellowMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.35, metalness: 0.7 });
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.92, roughness: 0.2 });
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.9 });

    // Chassis body
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.2, 3.0), yellowMat);
    body.position.y = 1.4;
    group.add(body);

    // Operator roll-cage cab
    const cage = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.4, 2.2), steelMat);
    cage.position.set(0, 3.2, 0.2);
    group.add(cage);

    // Flashing amber warning beacon on cab roof
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), beaconMat);
    beacon.position.set(0, 4.6, 0.2);
    group.add(beacon);

    // Dual heavy hydraulic lifting arms ending in serrated crushing clamps
    const leftArmGroup = new THREE.Group();
    leftArmGroup.position.set(-1.6, 2.2, 0.8);
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 2.2), yellowMat);
    armL.position.z = 1.1;
    leftArmGroup.add(armL);
    const clampL = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.25, 0.9), steelMat);
    clampL.position.set(0.15, 0, 2.3);
    leftArmGroup.add(clampL);
    group.add(leftArmGroup);

    const rightArmGroup = new THREE.Group();
    rightArmGroup.position.set(1.6, 2.2, 0.8);
    const armR = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 2.2), yellowMat);
    armR.position.z = 1.1;
    rightArmGroup.add(armR);
    const clampR = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.25, 0.9), steelMat);
    clampR.position.set(-0.15, 0, 2.3);
    rightArmGroup.add(clampR);
    group.add(rightArmGroup);

    this.addReferenceObject(group);
    this.powerLoader = {
      group,
      pos,
      leftArm: leftArmGroup,
      rightArm: rightArmGroup,
      beacon,
      clampCooldown: 0,
      isClamping: false,
      clampAnim: 0
    };
  }

  checkPowerLoaderInteraction(playerPos, player, horde, ui, audioEngine, particles) {
    if (!this.powerLoader) return false;
    const pl = this.powerLoader;
    if (playerPos.distanceTo(pl.pos) <= 4.8) {
      if (pl.clampCooldown <= 0) {
        pl.clampCooldown = 5.0;
        pl.isClamping = true;
        pl.clampAnim = 0;

        if (audioEngine && audioEngine.playPowerLoaderClamp) {
          audioEngine.playPowerLoaderClamp();
        }

        // Deal 800 massive crushing blunt damage in 5.2m frontal cone
        const crushOrigin = pl.pos.clone().add(new THREE.Vector3(0, 1.2, 2.2));
        if (horde) {
          const hits = horde.checkMeleeHits({
            origin: crushOrigin,
            radius: 5.2,
            damage: 800,
            type: 'heavy'
          });
          if (hits.length > 0 && this.game) {
            this.game.registerHits(hits);
          }
        }

        if (particles && particles.emitSparks) {
          particles.emitSparks(crushOrigin, 35);
        }

        if (this.game && this.game.triggerCameraShake) {
          this.game.triggerCameraShake(0.85, 0.4);
        }

        if (ui && ui.showAnnouncement) {
          ui.showAnnouncement('🚜 PINCE HYDRAULIQUE DU POWER LOADER P-5000 DÉCLENCHÉE : BROYAGE 800 DÉGÂTS !');
        }
        return true;
      }
    }
    return false;
  }

  /* Chantier 9: Corrosive Atmospheric Acid Rain Storms & Caustic Deluge (LV-426 / Fiorina 161 Canon 1:1) */
  initAcidRain() {
    const rainCount = 140;
    const rainGroup = new THREE.Group();
    const dropGeo = new THREE.CylinderGeometry(0.02, 0.02, 1.1, 4);
    dropGeo.rotateX(Math.PI / 2);
    const dropMat = new THREE.MeshBasicMaterial({ color: 0x84cc16, transparent: true, opacity: 0.75 });

    const drops = [];
    for (let r = 0; r < rainCount; r++) {
      const drop = new THREE.Mesh(dropGeo, dropMat);
      const rx = (this.random() - 0.5) * 110;
      const ry = 6.0 + this.random() * 20.0;
      const rz = (this.random() - 0.5) * 110;
      drop.position.set(rx, ry, rz);
      drop.rotation.x = Math.PI / 2;
      rainGroup.add(drop);
      drops.push({ mesh: drop, speed: 28 + this.random() * 12 });
    }

    rainGroup.visible = false;
    this.addReferenceObject(rainGroup);
    this.acidRainParticleSystem = rainGroup;
    this.acidRainDrops = drops;
    this.acidRainTimer = 0;
    this.acidRainActive = false;
  }

  updateAcidRain(delta, horde, player, audioEngine) {
    if (!this.acidRainParticleSystem || !this.acidRainDrops) return;

    this.acidRainTimer += delta;

    // Acid rain storm cycle: triggers every 45s for 15s duration
    if (!this.acidRainActive && this.acidRainTimer >= 45.0) {
      this.acidRainActive = true;
      this.acidRainDuration = 15.0;
      this.acidRainParticleSystem.visible = true;

      if (this.game && this.game.ui) {
        this.game.ui.showAnnouncement('🌧️ TEMPÊTE D\'ACIDE ATMOSPHÉRIQUE : VAPEURS CORROSIVES (-4 HP/S, XÉNOS +15% VIT) !');
      }
    }

    if (this.acidRainActive) {
      this.acidRainDuration -= delta;

      // Animate falling acid streaks
      this.acidRainDrops.forEach(d => {
        d.mesh.position.y -= d.speed * delta;
        if (d.mesh.position.y <= 0.2) {
          d.mesh.position.y = 22.0 + this.random() * 6.0;
        }
      });

      // Environmental damage to player outside shelter (if not perched or blocking)
      if (player && player.position && player.position.y <= 0.5) {
        if (!player.isBlocking && !player.isCloaked) {
          player.takeDamage(4 * delta, true);
        }
      }

      // Xenos energized by caustic atmosphere (+15% speed buff)
      if (horde && horde.aliens) {
        horde.aliens.forEach(a => {
          if (a && a.speed) {
            a.mesh.position.y += Math.sin((this.referenceTime * 1000) * 0.01) * 0.005;
          }
        });
      }

      if (this.acidRainDuration <= 0) {
        this.acidRainActive = false;
        this.acidRainTimer = 0;
        this.acidRainParticleSystem.visible = false;
      }
    }
  }

  /* === CHANTIER 2 (v45): Drivable USCM M577 Armored Personnel Carrier (Aliens 1986 Canon 1:1) === */
  buildDrivableAPC() {
    const group = new THREE.Group();
    const pos = new THREE.Vector3(25, 0, -32);
    group.position.copy(pos);

    const armorMat = new THREE.MeshStandardMaterial({
      color: 0x3b4738, // Olive-drab USCM armor
      metalness: 0.85,
      roughness: 0.35
    });

    const wheelMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      metalness: 0.2,
      roughness: 0.8
    });

    // 1. Heavy Sloped Main Chassis (Length: 8.8m, Width: 4.2m, Height: 2.2m)
    const hullGeo = new THREE.BoxGeometry(4.2, 2.0, 8.8);
    const hull = new THREE.Mesh(hullGeo, armorMat);
    hull.position.y = 1.8;
    group.add(hull);

    // Front sloped glacis plate
    const frontGlacis = new THREE.Mesh(new THREE.ConeGeometry(2.4, 2.8, 4), armorMat);
    frontGlacis.rotation.x = Math.PI / 2;
    frontGlacis.position.set(0, 1.6, 5.0);
    group.add(frontGlacis);

    // 2. Eight Massive All-Terrain Wheels with Suspension
    const wheelGeo = new THREE.CylinderGeometry(0.85, 0.85, 0.7, 12);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheels = [];

    const wheelPositions = [-2.8, -0.9, 1.0, 2.9];
    wheelPositions.forEach(zOffset => {
      const wl = new THREE.Mesh(wheelGeo, wheelMat);
      wl.position.set(-2.3, 0.85, zOffset);
      group.add(wl);
      wheels.push(wl);

      const wr = new THREE.Mesh(wheelGeo, wheelMat);
      wr.position.set(2.3, 0.85, zOffset);
      group.add(wr);
      wheels.push(wr);
    });

    // 3. Pivoting Roof-Mounted Dual 20mm Autocannon Turret (Boyars Twin Cannon)
    const turretGroup = new THREE.Group();
    turretGroup.position.set(0, 3.0, -1.2);

    const turretBase = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.6, 8), armorMat);
    turretGroup.add(turretBase);

    const barrelGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.8, 6);
    barrelGeo.rotateX(Math.PI / 2);
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.95 });

    const barrel1 = new THREE.Mesh(barrelGeo, barrelMat);
    barrel1.position.set(-0.35, 0.25, 1.4);
    turretGroup.add(barrel1);

    const barrel2 = new THREE.Mesh(barrelGeo, barrelMat);
    barrel2.position.set(0.35, 0.25, 1.4);
    turretGroup.add(barrel2);

    // Dual Muzzle Flashes
    const flashGeo = new THREE.ConeGeometry(0.18, 0.6, 6);
    flashGeo.rotateX(-Math.PI / 2);
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xffe600, transparent: true, opacity: 0.95 });

    const flash1 = new THREE.Mesh(flashGeo, flashMat);
    flash1.position.set(-0.35, 0.25, 3.0);
    flash1.visible = false;
    turretGroup.add(flash1);

    const flash2 = new THREE.Mesh(flashGeo, flashMat);
    flash2.position.set(0.35, 0.25, 3.0);
    flash2.visible = false;
    turretGroup.add(flash2);

    group.add(turretGroup);

    // Roof Warning Beacon (Aliens 1986 Lore)
    const beaconBase = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.2, 8), armorMat);
    beaconBase.position.set(0, 2.9, 2.2);
    group.add(beaconBase);

    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff9100, transparent: true, opacity: 0.85 }));
    beacon.position.set(0, 3.1, 2.2);
    group.add(beacon);

    // Stenciled Insignia
    const stencilMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8 });
    const stencilL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.35, 1.6), stencilMat);
    stencilL.position.set(-2.12, 2.1, 0);
    group.add(stencilL);

    this.addReferenceObject(group);
    this.drivableAPC = {
      group,
      pos,
      speed: 0,
      maxSpeed: 18.0,
      rotationY: 0,
      armor: 1500,
      maxArmor: 1500,
      isMounted: false,
      wheels,
      turret: turretGroup,
      flash1,
      flash2,
      flashTimer: 0,
      beacon,
      fireCooldown: 0,
      ramCooldown: 0,
      tracers: []
    };
  }

  checkAPCInteraction(playerPos, player, ui, audioEngine) {
    if (!this.drivableAPC) return false;
    const apc = this.drivableAPC;
    const dist = playerPos.distanceTo(apc.pos);

    if (dist <= 4.6) {
      const cockpitOverlay = document.getElementById('apc-cockpit-overlay');
      if (!apc.isMounted) {
        apc.isMounted = true;
        player.isMountedAPC = true;
        player.apcRef = apc;
        if (cockpitOverlay) cockpitOverlay.classList.remove('hidden');
        if (ui && ui.showAnnouncement) {
          ui.showAnnouncement('🚜 BLINDÉ M577 APC USCM PILOTÉ : [Z/Q/S/D] CONDUITE, [ESPACE/CLIC] CANON 20MM (600 CPM), [E] QUITTER !');
        }
        if (audioEngine && audioEngine.playM577APCTurretFire) {
          audioEngine.playM577APCTurretFire();
        } else if (audioEngine && audioEngine.playAPCAutocannon) {
          audioEngine.playAPCAutocannon();
        }
      } else {
        apc.isMounted = false;
        player.isMountedAPC = false;
        player.apcRef = null;
        if (cockpitOverlay) cockpitOverlay.classList.add('hidden');
        const dismountPos = apc.pos.clone().add(new THREE.Vector3(3.4, 0, 0));
        player.position.copy(dismountPos);
        if (player.mesh) player.mesh.position.copy(dismountPos);
        if (ui && ui.showAnnouncement) {
          ui.showAnnouncement('🚜 DÉBARQUEMENT DU BLINDÉ M577 APC EFFECTUÉ.');
        }
      }
      return true;
    }
    return false;
  }

  updateDrivableAPC(delta, player, horde, audioEngine, particles) {
    const apc = this.drivableAPC;
    if (!apc) return;

    if (apc.beacon) {
      apc.beacon.rotation.y += 8.0 * delta;
      apc.beacon.material.opacity = 0.5 + Math.sin((this.referenceTime * 1000) * 0.01) * 0.4;
    }

    if (apc.flashTimer > 0) {
      apc.flashTimer -= delta;
      if (apc.flashTimer <= 0) {
        if (apc.flash1) apc.flash1.visible = false;
        if (apc.flash2) apc.flash2.visible = false;
      }
    }

    // Tracers physics
    for (let t = apc.tracers.length - 1; t >= 0; t--) {
      const tr = apc.tracers[t];
      tr.life -= delta;
      tr.mesh.position.addScaledVector(tr.dir, tr.speed * delta);
      if (tr.life <= 0 || tr.mesh.position.distanceTo(tr.target) <= 1.5) {
        if (particles && particles.emitSparks) {
          particles.emitSparks(tr.mesh.position, 6);
        }
        this.removeReferenceObject(tr.mesh);
        apc.tracers.splice(t, 1);
      }
    }

    if (!apc.isMounted) return;

    const keys = (this.game && this.game.keys) ? this.game.keys : {};

    // Throttle / Reverse
    if (keys['KeyW'] || keys['ArrowUp']) {
      apc.speed = Math.min(apc.speed + 14.0 * delta, apc.maxSpeed);
    } else if (keys['KeyS'] || keys['ArrowDown']) {
      apc.speed = Math.max(apc.speed - 12.0 * delta, -7.0);
    } else {
      apc.speed *= 0.93;
    }

    // Steering
    const isMoving = Math.abs(apc.speed) > 0.4;
    if (isMoving) {
      const turnDir = apc.speed >= 0 ? 1 : -1;
      if (keys['KeyA'] || keys['ArrowLeft'] || keys['KeyQ']) {
        apc.rotationY += 1.8 * delta * turnDir;
      }
      if (keys['KeyD'] || keys['ArrowRight']) {
        apc.rotationY -= 1.8 * delta * turnDir;
      }
    }

    // Movement forward
    const fwd = new THREE.Vector3(Math.sin(apc.rotationY), 0, Math.cos(apc.rotationY));
    apc.pos.addScaledVector(fwd, apc.speed * delta);
    apc.pos.x = Math.max(-54, Math.min(54, apc.pos.x));
    apc.pos.z = Math.max(-54, Math.min(54, apc.pos.z));

    apc.group.position.copy(apc.pos);
    apc.group.rotation.y = apc.rotationY;

    // Wheel rotation animation
    const wheelSpin = apc.speed * delta * 2.8;
    apc.wheels.forEach(w => {
      w.rotation.x += wheelSpin;
    });

    // Lock player to APC cabin
    if (player) {
      player.position.copy(apc.pos);
      if (player.mesh) {
        player.mesh.position.copy(apc.pos);
        player.mesh.position.y = 2.0;
        player.rotationY = apc.rotationY;
      }
    }

    // Ramming collisions against Xenomorphs (400 blunt dmg)
    if (Math.abs(apc.speed) >= 2.5 && horde && horde.aliens) {
      apc.ramCooldown = (apc.ramCooldown || 0) - delta;
      for (let i = horde.aliens.length - 1; i >= 0; i--) {
        const a = horde.aliens[i];
        if (!a || a.hp <= 0 || !a.mesh) continue;
        if (a.mesh.position.distanceTo(apc.pos) <= 4.2) {
          a.hp -= 400;
          const knockDir = fwd.clone().add(new THREE.Vector3((this.random() - 0.5) * 0.5, 0.3, (this.random() - 0.5) * 0.5)).normalize();
          a.mesh.position.addScaledVector(knockDir, 7.5);

          if (audioEngine && audioEngine.playHeavySlamImpact && apc.ramCooldown <= 0) {
            audioEngine.playHeavySlamImpact();
            apc.ramCooldown = 0.25;
          }
          if (particles && particles.emitSparks) {
            particles.emitSparks(a.mesh.position, 8);
          }

          if (a.hp <= 0) {
            if (horde.goreEngine) horde.goreEngine.spawnDismemberment(a.mesh.position, 'heavy');
            horde.spawnAcidPool(a.mesh.position);
            this.removeReferenceObject(a.mesh);
            horde.defeatAlien?.(a, { cause: 'environment-updateDrivableAPC', killerFaction: 'neutral' });
            if (this.game) {
              this.game.comboHits++;
              this.game.score += 150;
            }
          }
        }
      }
    }

    // Turret aiming & rapid firing (600 RPM autocannon)
    if (apc.fireCooldown > 0) apc.fireCooldown -= delta;
    if (keys['Space'] || (this.game && this.game.isLeftMouseDown)) {
      if (apc.fireCooldown <= 0) {
        apc.fireCooldown = 0.1;
        this.fireAPCCannon(horde, this.game ? this.game.bosses : null, audioEngine, particles);
      }
    }
  }

  fireAPCCannon(horde, bosses, audioEngine, particles) {
    const apc = this.drivableAPC;
    if (!apc) return;

    if (audioEngine && audioEngine.playM577APCTurretFire) {
      audioEngine.playM577APCTurretFire();
    } else if (audioEngine && audioEngine.playAPCAutocannon) {
      audioEngine.playAPCAutocannon();
    }

    apc.flashTimer = 0.08;
    if (apc.flash1) apc.flash1.visible = true;
    if (apc.flash2) apc.flash2.visible = true;

    // Target scanning directly in front of APC or nearest enemy
    const fwd = new THREE.Vector3(Math.sin(apc.rotationY), 0, Math.cos(apc.rotationY));
    const origin = apc.pos.clone().add(new THREE.Vector3(0, 3.2, 0)).addScaledVector(fwd, 2.5);
    const targetPos = origin.clone().addScaledVector(fwd, 32.0);

    // Spawn 20mm Tracer
    const tracerGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.2, 4);
    tracerGeo.rotateX(Math.PI / 2);
    const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe600 });
    const tracerMesh = new THREE.Mesh(tracerGeo, tracerMat);
    tracerMesh.position.copy(origin);
    this.addReferenceObject(tracerMesh);

    apc.tracers.push({
      mesh: tracerMesh,
      dir: fwd.clone(),
      target: targetPos,
      speed: 120.0,
      life: 0.6
    });

    // Explosive splash damage (75 dmg in 3.2m radius along forward vector)
    const hitCenter = origin.clone().addScaledVector(fwd, 12.0 + this.random() * 8.0);
    if (particles && particles.emitSparks) {
      particles.emitSparks(hitCenter, 6);
    }

    if (bosses && bosses.activeBoss && bosses.activeBoss.mesh) {
      if (bosses.activeBoss.mesh.position.distanceTo(hitCenter) <= 6.0) {
        bosses.takeDamage(75);
      }
    }

    if (horde && horde.aliens) {
      for (let i = horde.aliens.length - 1; i >= 0; i--) {
        const a = horde.aliens[i];
        if (!a || a.hp <= 0 || !a.mesh) continue;
        if (a.mesh.position.distanceTo(hitCenter) <= 4.0) {
          a.hp -= 75;
          if (a.hp <= 0) {
            if (horde.goreEngine) horde.goreEngine.spawnDismemberment(a.mesh.position, 'heavy');
            horde.spawnAcidPool(a.mesh.position);
            this.removeReferenceObject(a.mesh);
            horde.defeatAlien?.(a, { cause: 'environment-fireAPCCannon', killerFaction: 'neutral' });
          }
        }
      }
    }
  }

  /* === CHANTIER 3 (v45): Hadley's Hope Colony Reactor Meltdown Protocol === */
  buildReactorMeltdownConsole() {
    const group = new THREE.Group();
    const pos = new THREE.Vector3(0, 0, -50);
    group.position.copy(pos);

    const metalMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.85, roughness: 0.3 });
    const consoleGeo = new THREE.BoxGeometry(4.5, 2.8, 1.8);
    const consoleMesh = new THREE.Mesh(consoleGeo, metalMat);
    consoleMesh.position.y = 1.4;
    group.add(consoleMesh);

    // Glowing Coolant Core Chambers (3 conduits)
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.85 });
    for (let c = -1; c <= 1; c++) {
      const conduit = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 2.2, 8), coreMat);
      conduit.position.set(c * 1.2, 1.6, 0.4);
      group.add(conduit);
    }

    // Emergency Warning Strobe
    const strobe = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
    strobe.position.set(0, 3.0, 0);
    group.add(strobe);

    this.addReferenceObject(group);
    this.reactorConsole = {
      group,
      pos,
      strobe
    };
  }

  checkReactorConsoleInteraction(playerPos, player, ui, audioEngine) {
    if (!this.reactorConsole) return false;
    if (playerPos.distanceTo(this.reactorConsole.pos) <= 4.2) {
      if (this.reactorMeltdownActive) {
        // Coolant core purge - stabilize meltdown!
        this.reactorMeltdownActive = false;
        this.reactorMeltdownTimer = 180.0;
        const banner = document.getElementById('reactor-meltdown-banner');
        if (banner) banner.classList.add('hidden');
        if (ui && ui.showAnnouncement) {
          ui.showAnnouncement('✅ SYSTÈMES DE REFROIDISSEMENT DU RÉACTEUR PURGÉS : SURCHARGE ÉVITÉE !');
        }
        if (audioEngine && audioEngine.playSteamVentHiss) {
          audioEngine.playSteamVentHiss();
        }
      } else {
        this.triggerReactorMeltdown(ui, audioEngine);
      }
      return true;
    }
    return false;
  }

  triggerReactorMeltdown(ui, audioEngine) {
    this.reactorMeltdownActive = true;
    this.reactorMeltdownTimer = 180.0;
    this.reactorAlarmCooldown = 0;
    const banner = document.getElementById('reactor-meltdown-banner');
    if (banner) banner.classList.remove('hidden');

    if (ui && ui.showAnnouncement) {
      ui.showAnnouncement('⚠️ ALERTE ROUGE : SURCHARGE DU RÉACTEUR DE HADLEY\'S HOPE DÉCLENCHÉE (50 MT) !');
    }
    if (audioEngine && audioEngine.playReactorAlarm) {
      audioEngine.playReactorAlarm();
    }
  }

  updateReactorMeltdown(delta, player, horde, audioEngine, particles) {
    this.reactorMeltdownTimer -= delta;

    // Pulse console warning strobe
    if (this.reactorConsole && this.reactorConsole.strobe) {
      this.reactorConsole.strobe.material.color.setHex(Math.sin((this.referenceTime * 1000) * 0.015) > 0 ? 0xff0000 : 0x000000);
    }

    // Periodic klaxon siren
    this.reactorAlarmCooldown -= delta;
    if (this.reactorAlarmCooldown <= 0) {
      this.reactorAlarmCooldown = 3.6;
      if (audioEngine && audioEngine.playReactorAlarm) {
        audioEngine.playReactorAlarm();
      }
    }

    // High pressure steam vents around reactor
    if (particles && particles.emitSmoke && this.random() < 0.3) {
      const steamPos = this.reactorConsole.pos.clone().add(new THREE.Vector3((this.random() - 0.5) * 6, 2.5, (this.random() - 0.5) * 4));
      particles.emitSmoke(steamPos, 4);
    }

    // Update banner
    const min = Math.floor(Math.max(0, this.reactorMeltdownTimer) / 60);
    const sec = Math.floor(Math.max(0, this.reactorMeltdownTimer) % 60).toString().padStart(2, '0');
    const bannerText = document.getElementById('reactor-timer-text');
    if (bannerText) {
      bannerText.textContent = `0${min}:${sec} AVANT VAPORISATION THERMONUCLÉAIRE (50 MT)`;
    }

    // Thermonuclear meltdown failure
    if (this.reactorMeltdownTimer <= 0) {
      this.reactorMeltdownActive = false;
      if (player) player.takeDamage(99999);
      if (this.game && this.game.ui) {
        this.game.ui.showAnnouncement('💥 DÉTONATION THERMONUCLÉAIRE DU RÉACTEUR (50 MT) : HADLEY\'S HOPE VAPORISÉE !');
      }
    }
  }

  /* === CHANTIER 6 (v45): High-Voltage Discharging Electric Floor Grids === */
  buildElectricFloorGrids() {
    const gridPositions = [new THREE.Vector3(-18, 0.04, 0), new THREE.Vector3(18, 0.04, 0)];
    const gridMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.9, roughness: 0.3 });
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xeab308 });
    const blueTeslaMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

    gridPositions.forEach((pos, idx) => {
      const group = new THREE.Group();
      group.position.copy(pos);

      // 8x8m steel mesh grid
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), gridMat);
      mesh.rotation.x = -Math.PI / 2;
      group.add(mesh);

      // Warning hazard border
      const border = new THREE.Mesh(new THREE.RingGeometry(3.9, 4.3, 4), stripeMat);
      border.rotation.x = -Math.PI / 2;
      border.rotation.z = Math.PI / 4;
      group.add(border);

      // 4 Corner Tesla Insulator Coils
      const corners = [[-3.8, -3.8], [3.8, -3.8], [-3.8, 3.8], [3.8, 3.8]];
      corners.forEach(c => {
        const coil = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 1.2, 6), blueTeslaMat);
        coil.position.set(c[0], 0.6, c[1]);
        group.add(coil);
      });

      this.addReferenceObject(group);
      this.electricFloorGrids.push({
        group,
        pos,
        index: idx,
        isActive: false,
        activeTimer: 0,
        mesh
      });
    });
  }

  checkElectricGridInteraction(playerPos, player, ui, audioEngine, particles, horde) {
    for (let i = 0; i < this.electricFloorGrids.length; i++) {
      const grid = this.electricFloorGrids[i];
      if (playerPos.distanceTo(grid.pos) <= 5.5) {
        if (!grid.isActive) {
          this.electrifyGrid(i, audioEngine, particles, horde);
          if (ui && ui.showAnnouncement) {
            ui.showAnnouncement('⚡ GRILLE HAUTE-TENSION DÉCHARGÉE (15 kV) : 280 DÉGÂTS D\'ÉLECTROCUTION ET PARALYSIE !');
          }
          return true;
        }
      }
    }
    return false;
  }

  electrifyGrid(index, audioEngine, particles, horde) {
    const grid = this.electricFloorGrids[index];
    if (!grid) return;

    grid.isActive = true;
    grid.activeTimer = 6.0;

    if (audioEngine && audioEngine.playElectricFloorHum) {
      audioEngine.playElectricFloorHum();
    }

    if (particles && particles.emitSparks) {
      for (let s = 0; s < 6; s++) {
        const sparkPos = grid.pos.clone().add(new THREE.Vector3((this.random() - 0.5) * 6, 0.4, (this.random() - 0.5) * 6));
        particles.emitSparks(sparkPos, 8);
      }
    }

    // Shock all xenomorphs on grid
    if (horde && horde.aliens) {
      horde.aliens.forEach(a => {
        if (a && a.hp > 0 && a.mesh && a.mesh.position.distanceTo(grid.pos) <= 4.6) {
          a.hp -= 280;
          a.isStunned = true;
          a.stunTimer = 4.0;
        }
      });
    }
  }

  updateElectricFloorGrids(delta, horde, audioEngine, particles) {
    this.electricFloorGrids.forEach(grid => {
      if (grid.isActive) {
        grid.activeTimer -= delta;

        // Visual electric flash
        if (grid.mesh) {
          grid.mesh.material.color.setHex(this.random() > 0.4 ? 0x38bdf8 : 0x1e293b);
        }

        if (particles && particles.emitSparks && this.random() < 0.4) {
          const arcPos = grid.pos.clone().add(new THREE.Vector3((this.random() - 0.5) * 7, 0.3, (this.random() - 0.5) * 7));
          particles.emitSparks(arcPos, 5);
        }

        // Continual shock damage to any xeno stepping into grid
        if (horde && horde.aliens) {
          horde.aliens.forEach(a => {
            if (a && a.hp > 0 && a.mesh && a.mesh.position.distanceTo(grid.pos) <= 4.6) {
              a.hp -= 70 * delta;
              a.isStunned = true;
              a.stunTimer = 1.5;
            }
          });
        }

        if (grid.activeTimer <= 0) {
          grid.isActive = false;
          if (grid.mesh) grid.mesh.material.color.setHex(0x334155);
        }
      }
    });
  }

  /* === CHANTIER 9 (v45): Weyland-Yutani Med-Lab Decontamination Airlock === */
  buildDecontaminationAirlock() {
    const group = new THREE.Group();
    const pos = new THREE.Vector3(0, 0, 42);
    group.position.copy(pos);

    const metalMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.25 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.45, roughness: 0.1 });

    // Chamber frame (4x4x4m)
    const frameGeo = new THREE.BoxGeometry(4.2, 3.8, 4.2);
    const frame = new THREE.Mesh(frameGeo, metalMat);
    frame.position.y = 1.9;
    group.add(frame);

    // Glass walls
    const glass = new THREE.Mesh(new THREE.BoxGeometry(3.6, 3.4, 3.6), glassMat);
    glass.position.y = 1.9;
    group.add(glass);

    // Antiseptic spray nozzle ring
    const nozzleMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.08, 6, 12), nozzleMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 3.4;
    group.add(ring);

    this.addReferenceObject(group);
    this.deconAirlock = {
      group,
      pos,
      cooldown: 0,
      isActive: false,
      timer: 0
    };
  }

  checkDeconInteraction(playerPos, player, ui, audioEngine, particles) {
    if (!this.deconAirlock) return false;
    const decon = this.deconAirlock;

    if (playerPos.distanceTo(decon.pos) <= 3.8) {
      if (decon.cooldown <= 0 && !decon.isActive) {
        decon.isActive = true;
        decon.timer = 4.0;
        decon.cooldown = 40.0;

        if (audioEngine && audioEngine.playSteamVentHiss) {
          audioEngine.playSteamVentHiss();
        }

        // Bio-hazard purge & restoration
        if (player) {
          player.visorAcidBurn = 0;
          player.speedMultiplier = 1.0;
          player.hp = Math.min(player.maxHp, player.hp + 250);
          player.plasmaEnergy = Math.min(player.maxPlasmaEnergy, (player.plasmaEnergy || 100) + 50);
        }

        if (ui && ui.showAnnouncement) {
          ui.showAnnouncement('🧪 SAS DE DÉCONTAMINATION ACTIVÉ : INFECTIONS PURGÉES, ACIDE NETTOYÉ (+250 HP, +50 ÉNERGIE) !');
        }

        return true;
      }
    }
    return false;
  }

  updateDeconAirlock(delta, player, audioEngine, particles) {
    const decon = this.deconAirlock;
    if (!decon) return;

    if (decon.cooldown > 0) decon.cooldown -= delta;

    if (decon.isActive) {
      decon.timer -= delta;
      // Emit antiseptic spray particles
      if (particles && particles.emitSmoke && this.random() < 0.4) {
        const sprayPos = decon.pos.clone().add(new THREE.Vector3((this.random() - 0.5) * 2, 2.5, (this.random() - 0.5) * 2));
        particles.emitSmoke(sprayPos, 5);
      }
      if (decon.timer <= 0) {
        decon.isActive = false;
      }
    }
  }

  /* === CHANTIER 1 (v46): USCM M56 Smartgun Heavy Tripod Turret (Aliens 1986 Vasquez & Drake) === */
  buildMountedSmartgun() {
    const group = new THREE.Group();
    const pos = new THREE.Vector3(0, 0, -15);
    group.position.copy(pos);

    const metalDark = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9, roughness: 0.2 });
    const metalGrey = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.85, roughness: 0.3 });
    const greenOptic = new THREE.MeshBasicMaterial({ color: 0x10b981 });
    const hazardMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.4 });

    // 1. Heavy Tripod Legs
    for (let i = 0; i < 3; i++) {
      const legAngle = (i / 3) * Math.PI * 2;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.4, 6), metalDark);
      leg.position.set(Math.sin(legAngle) * 0.55, 0.55, Math.cos(legAngle) * 0.55);
      leg.rotation.x = Math.cos(legAngle) * 0.45;
      leg.rotation.z = -Math.sin(legAngle) * 0.45;
      group.add(leg);

      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.22), metalGrey);
      foot.position.set(Math.sin(legAngle) * 0.88, 0.03, Math.cos(legAngle) * 0.88);
      group.add(foot);
    }

    // Center Pintle Post
    const pintle = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 1.1, 8), metalDark);
    pintle.position.y = 0.55;
    group.add(pintle);

    // 2. Yaw Pivot Group (Rotates with player aim)
    const pivotGroup = new THREE.Group();
    pivotGroup.position.y = 1.15;
    group.add(pivotGroup);

    // Steadicam Articulated Arm Assembly & Hydraulic Pistons
    const armGeo = new THREE.BoxGeometry(0.14, 0.18, 0.7);
    const arm = new THREE.Mesh(armGeo, metalGrey);
    arm.position.set(-0.25, 0.1, -0.15);
    arm.rotation.y = 0.25;
    pivotGroup.add(arm);

    // M56 Smartgun Receiver Body
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.32, 1.4), metalDark);
    receiver.position.set(0, 0.12, 0.2);
    pivotGroup.add(receiver);

    // Twin Heavy Slotted Cooling Barrel (10x28mm Caseless)
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.1, 8), metalGrey);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.12, 1.25);
    pivotGroup.add(barrel);

    // Slotted Muzzle Brake Compensator
    const brake = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.22, 8), metalDark);
    brake.rotation.x = Math.PI / 2;
    brake.position.set(0, 0.12, 1.85);
    pivotGroup.add(brake);

    // Heavy Cylindrical Ammo Drum (500 Rounds)
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.28, 12), hazardMat);
    drum.rotation.z = Math.PI / 2;
    drum.position.set(0.26, 0.02, 0.1);
    pivotGroup.add(drum);

    // Infrared Head-Mounted Video Targeting Display Screen
    const hudScreen = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.04), greenOptic);
    hudScreen.position.set(-0.16, 0.35, -0.2);
    hudScreen.rotation.y = 0.2;
    pivotGroup.add(hudScreen);

    // Handlebar Dual Grips with Fire Triggers
    const gripCross = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6), metalDark);
    gripCross.rotation.z = Math.PI / 2;
    gripCross.position.set(0, 0.12, -0.48);
    pivotGroup.add(gripCross);

    this.addReferenceObject(group);
    this.envObjects.push(group);

    this.mountedSmartgun = {
      group,
      pos,
      pivotGroup,
      isMounted: false,
      ammo: 600,
      maxAmmo: 600,
      fireCooldown: 0,
      heat: 0,
      maxHeat: 100,
      overheated: false,
      cooldownRate: 35
    };
  }

  checkSmartgunInteraction(playerPos, player, ui, audioEngine) {
    if (!this.mountedSmartgun) return false;
    const gun = this.mountedSmartgun;

    if (playerPos.distanceTo(gun.pos) <= 3.2) {
      gun.isMounted = !gun.isMounted;
      if (player) {
        player.isMountedSmartgun = gun.isMounted;
        player.smartgunTurretRef = gun.isMounted ? gun : null;
      }

      if (gun.isMounted) {
        if (player) {
          player.position.set(gun.pos.x, 0, gun.pos.z - 1.35);
          if (player.mesh) player.mesh.position.copy(player.position);
        }
        if (audioEngine && audioEngine.playSmartgunSustainedFire) {
          audioEngine.playSmartgunSustainedFire();
        }
        if (ui && ui.showAnnouncement) {
          ui.showAnnouncement('🎯 TOURELLE M56 SMARTGUN MONTÉE (1200 CPM, 10x28MM SANS ÉTUI) - [CLIC GAUCHE / ESPACE] POUR TIRER, [E] POUR DÉMONTER !');
        }
      } else {
        if (ui && ui.showAnnouncement) {
          ui.showAnnouncement('🎯 TOURELLE M56 SMARTGUN DÉMONTÉE.');
        }
      }
      return true;
    }
    return false;
  }

  updateSmartgun(delta, player) {
    if (!this.mountedSmartgun) return;
    const gun = this.mountedSmartgun;

    if (gun.fireCooldown > 0) gun.fireCooldown -= delta;
    if (gun.heat > 0) gun.heat = Math.max(0, gun.heat - gun.cooldownRate * delta);
    if (gun.overheated && gun.heat < 25) gun.overheated = false;

    if (gun.isMounted && player) {
      // Lock player behind gun
      player.position.set(gun.pos.x, 0, gun.pos.z - 1.35);
      if (player.mesh) {
        player.mesh.position.copy(player.position);
        gun.pivotGroup.rotation.y = player.mesh.rotation.y;
      }
    }
  }

  fireSmartgun(player, horde, bosses, synthetics, audioEngine, particles, ui) {
    if (!this.mountedSmartgun || !this.mountedSmartgun.isMounted) return false;
    const gun = this.mountedSmartgun;

    if (gun.fireCooldown > 0 || gun.overheated) return false;
    if (gun.ammo <= 0) {
      if (ui && ui.showAnnouncement) ui.showAnnouncement('⚠️ TOURELLE SMARTGUN : MUNITIONS ÉPUISÉES (0/600) !');
      return false;
    }

    gun.fireCooldown = 0.05; // 1200 RPM
    gun.ammo--;
    gun.heat += 1.4;
    if (gun.heat >= gun.maxHeat) {
      gun.overheated = true;
      if (ui && ui.showAnnouncement) ui.showAnnouncement('🔥 SURCHAUFFE DU CANON M56 SMARTGUN ! REFROIDISSEMENT REQUIS...');
    }

    if (audioEngine && audioEngine.playSmartgunSustainedFire) {
      audioEngine.playSmartgunSustainedFire();
    }

    // Origin and forward vector
    const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), gun.pivotGroup.rotation.y);
    const origin = gun.pos.clone().add(new THREE.Vector3(0, 1.25, 0)).addScaledVector(forward, 1.85);

    // Bullet tracer
    const endPos = origin.clone().addScaledVector(forward, 45.0);
    const tracerGeo = new THREE.CylinderGeometry(0.04, 0.04, 2.2, 4);
    tracerGeo.rotateX(Math.PI / 2);
    const tracerMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    const tracer = new THREE.Mesh(tracerGeo, tracerMat);
    tracer.position.copy(origin).addScaledVector(forward, 1.1);
    tracer.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), forward);
    this.addReferenceObject(tracer);
    this.referenceDelay(() => this.removeReferenceObject(tracer), 45);

    // Muzzle sparks
    if (particles && particles.emitSparks) {
      particles.emitSparks(origin, 4);
    }

    // Check hit on active boss
    if (bosses && bosses.activeBoss && bosses.activeBoss.mesh) {
      const bPos = bosses.activeBoss.mesh.position;
      const toB = bPos.clone().sub(origin);
      if (toB.length() <= 45.0 && forward.dot(toB.normalize()) > 0.92) {
        bosses.activeBoss.hp -= 48;
        if (particles && particles.emitSparks) particles.emitSparks(bPos, 5);
      }
    }

    // Check hit on horde
    if (horde && horde.aliens) {
      for (let i = horde.aliens.length - 1; i >= 0; i--) {
        const a = horde.aliens[i];
        if (!a || a.hp <= 0 || !a.mesh) continue;
        const toA = a.mesh.position.clone().sub(origin);
        const dist = toA.length();
        if (dist <= 45.0 && forward.dot(toA.normalize()) > 0.91) {
          a.hp -= 52; // Heavy 10x28mm impact
          if (particles && particles.emitSparks) particles.emitSparks(a.mesh.position, 4);

          if (a.hp <= 0) {
            if (horde.goreEngine) horde.goreEngine.spawnDismemberment(a.mesh.position, 'heavy');
            horde.spawnAcidPool(a.mesh.position);
            this.removeReferenceObject(a.mesh);
            horde.defeatAlien?.(a, { cause: 'environment-fireSmartgun', killerFaction: 'neutral' });
            if (this.game) {
              this.game.comboHits++;
              this.game.score += 75;
            }
          }
          break; // Single target hit per bullet
        }
      }
    }

    // Check hit on synthetics
    if (synthetics && synthetics.androids) {
      for (let i = synthetics.androids.length - 1; i >= 0; i--) {
        const syn = synthetics.androids[i];
        if (!syn || syn.hp <= 0 || !syn.mesh) continue;
        const toSyn = syn.mesh.position.clone().sub(origin);
        if (toSyn.length() <= 45.0 && forward.dot(toSyn.normalize()) > 0.91) {
          syn.hp -= 45;
          synthetics.emitWhiteSyntheticBlood(syn.mesh.position);
          if (syn.hp <= 110 && !syn.isBisected) {
            synthetics.bisectSynthetic(syn);
          }
          break;
        }
      }
    }

    return true;
  }

  /* === CHANTIER 2 (v46): Derelict LV-426 Chamber with 0.45g Low Gravity & Blue Laser Mist Plane (Alien 1979) === */
  buildDerelictChamber() {
    const group = new THREE.Group();
    const center = new THREE.Vector3(-42, 0, -22);
    group.position.copy(center);

    const boneChitin = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.35,
      metalness: 0.75
    });

    // 5 Giant Biomechanical Ribbed Arches (Giger 1:1)
    for (let i = 0; i < 5; i++) {
      const zOffset = (i - 2) * 5.5;
      const archGroup = new THREE.Group();
      archGroup.position.set(0, 0, zOffset);

      // Left curved rib
      const ribL = new THREE.Mesh(new THREE.TorusGeometry(8.5, 0.45, 8, 16, Math.PI * 0.55), boneChitin);
      ribL.position.set(-3.5, 0, 0);
      ribL.rotation.z = -Math.PI * 0.05;
      archGroup.add(ribL);

      // Right curved rib
      const ribR = new THREE.Mesh(new THREE.TorusGeometry(8.5, 0.45, 8, 16, Math.PI * 0.55), boneChitin);
      ribR.position.set(3.5, 0, 0);
      ribR.rotation.y = Math.PI;
      ribR.rotation.z = -Math.PI * 0.05;
      archGroup.add(ribR);

      group.add(archGroup);
    }

    // Blue Photosensitive Laser Mist Plane (y = 0.45m)
    const laserGeo = new THREE.PlaneGeometry(28, 28);
    laserGeo.rotateX(-Math.PI / 2);
    const laserMat = new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      emissive: 0x0088cc,
      transparent: true,
      opacity: 0.45,
      roughness: 0.1,
      metalness: 0.1,
      side: THREE.DoubleSide
    });
    const laserMistMesh = new THREE.Mesh(laserGeo, laserMat);
    laserMistMesh.position.set(0, 0.45, 0);
    group.add(laserMistMesh);

    // Laser Projector Beacons along the Perimeter
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0x00f2fe });
    for (let b = 0; b < 6; b++) {
      const angle = (b / 6) * Math.PI * 2;
      const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.8, 6), boneChitin);
      beacon.position.set(Math.sin(angle) * 12.5, 0.4, Math.cos(angle) * 12.5);
      group.add(beacon);

      const lens = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), beaconMat);
      lens.position.set(Math.sin(angle) * 12.5, 0.8, Math.cos(angle) * 12.5);
      group.add(lens);
    }

    this.addReferenceObject(group);
    this.envObjects.push(group);

    this.derelictChamber = {
      group,
      center,
      radius: 18.0,
      laserMistMesh,
      laserPlaneY: 0.45,
      wasInside: false,
      mistTrippedTimer: 0
    };
  }

  updateDerelictChamber(delta, player, horde, audioEngine, particles, ui) {
    if (!this.derelictChamber) return;
    const der = this.derelictChamber;

    // Laser Mist breathing shimmer
    if (der.laserMistMesh) {
      der.laserMistMesh.material.opacity = 0.38 + Math.sin((this.referenceTime * 1000) * 0.003) * 0.12;
    }

    if (der.mistTrippedTimer > 0) der.mistTrippedTimer -= delta;

    if (player) {
      const dist = player.position.distanceTo(der.center);
      const isInside = dist <= der.radius;

      if (isInside) {
        // Apply 0.45g Low Gravity (Alien 1979 LV-426 Nostromo Atmosphere)
        player.gravityMultiplier = 0.45;

        if (!der.wasInside) {
          der.wasInside = true;
          if (ui && ui.showAnnouncement) {
            ui.showAnnouncement('🌌 DERELICT LV-426 : GRAVITÉ FAIBLE 0.45G ACTIVÉE & NAPPE LASER BLEUE SENSIBLE (ALIEN 1979) !');
          }
        }

        // Crossing / wading through the blue laser mist plane (y = 0.45m)
        if (player.position.y <= 0.65 && der.mistTrippedTimer <= 0) {
          der.mistTrippedTimer = 3.5;
          if (audioEngine && audioEngine.playLaserMistDisruption) {
            audioEngine.playLaserMistDisruption();
          }
          if (particles && particles.emitSparks) {
            particles.emitSparks(player.position.clone().add(new THREE.Vector3(0, 0.45, 0)), 12);
          }
          if (ui && ui.showAnnouncement) {
            ui.showAnnouncement('⚠️ PERTURBATION DU PLAN LASER BLEU DU DERELICT : COUVOIR EN ALERTE !');
          }

          // Trigger nearby dormant Ovimorph eggs in chamber
          if (horde && horde.eggs) {
            horde.eggs.forEach(egg => {
              if (egg.mesh && egg.mesh.position.distanceTo(der.center) <= der.radius + 6.0 && !egg.hatched) {
                egg.phase = Math.PI; // Accelerates hatch
              }
            });
          }
        }
      } else {
        if (der.wasInside) {
          der.wasInside = false;
          player.gravityMultiplier = 1.0; // Restore standard gravity
          if (ui && ui.showAnnouncement) {
            ui.showAnnouncement('🌌 SORTIE DU DERELICT : GRAVITÉ NORMALE RESTAURÉE (1.0G).');
          }
        }
      }
    }
  }

  /* === CHANTIER 6 (v46): Colonial JP-4 Industrial Fuel Lines & Flame Wall (Aliens 1986) === */
  buildFuelLines() {
    const yellowMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.35, metalness: 0.8 });
    const valveMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.2 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.9, roughness: 0.2 });

    const pipeConfigs = [
      { start: new THREE.Vector3(-24, 0.45, 30), end: new THREE.Vector3(24, 0.45, 30), length: 48, axis: 'x' },
      { start: new THREE.Vector3(30, 0.45, -24), end: new THREE.Vector3(30, 0.45, 24), length: 48, axis: 'z' }
    ];

    pipeConfigs.forEach(cfg => {
      const group = new THREE.Group();
      const center = cfg.start.clone().lerp(cfg.end, 0.5);
      group.position.copy(center);

      // Main JP-4 Fuel Pipe (0.28m diameter)
      const pipeGeo = new THREE.CylinderGeometry(0.14, 0.14, cfg.length, 8);
      if (cfg.axis === 'x') pipeGeo.rotateZ(Math.PI / 2);
      else pipeGeo.rotateX(Math.PI / 2);

      const pipe = new THREE.Mesh(pipeGeo, yellowMat);
      group.add(pipe);

      // Flanges & High-Pressure Valves along conduit
      for (let f = -cfg.length * 0.4; f <= cfg.length * 0.4; f += 8.0) {
        const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.15, 8), metalMat);
        if (cfg.axis === 'x') {
          flange.rotation.z = Math.PI / 2;
          flange.position.set(f, 0, 0);
        } else {
          flange.rotation.x = Math.PI / 2;
          flange.position.set(0, 0, f);
        }
        group.add(flange);

        // Emergency shutoff red wheel
        const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.03, 6, 8), valveMat);
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(cfg.axis === 'x' ? f : 0, 0.28, cfg.axis === 'z' ? f : 0);
        group.add(wheel);
      }

      this.addReferenceObject(group);
      this.envObjects.push(group);

      this.fuelLines.push({
        group,
        center,
        cfg,
        hp: 75,
        isRuptured: false,
        isIgnited: false,
        fireTimer: 0,
        puddleMesh: null,
        fireMesh: null
      });
    });
  }

  checkFuelLineDamage(attackPos, radius, damage, audioEngine, particles, ui) {
    let hit = false;
    this.fuelLines.forEach(fl => {
      if (fl.isIgnited) return;

      const dist = attackPos.distanceTo(fl.center);
      if (dist <= radius + (fl.cfg.length * 0.5)) {
        fl.hp -= damage;
        if (particles && particles.emitSparks) {
          particles.emitSparks(attackPos, 8);
        }

        if (fl.hp <= 0 && !fl.isRuptured) {
          fl.isRuptured = true;
          hit = true;

          if (audioEngine && audioEngine.playFuelLeakSpray) {
            audioEngine.playFuelLeakSpray();
          }

          // Spawn Fuel Puddle Decal on Floor
          const pGeo = new THREE.PlaneGeometry(fl.cfg.axis === 'x' ? fl.cfg.length * 0.8 : 4.5, fl.cfg.axis === 'z' ? fl.cfg.length * 0.8 : 4.5);
          pGeo.rotateX(-Math.PI / 2);
          const pMat = new THREE.MeshStandardMaterial({
            color: 0x0f172a,
            roughness: 0.1,
            metalness: 0.9,
            transparent: true,
            opacity: 0.85
          });
          fl.puddleMesh = new THREE.Mesh(pGeo, pMat);
          fl.puddleMesh.position.set(fl.center.x, 0.03, fl.center.z);
          this.addReferenceObject(fl.puddleMesh);

          if (ui && ui.showAnnouncement) {
            ui.showAnnouncement('⚠️ CONDUIT JP-4 ÉVENTRÉ : FUITE D\'HYDROCARBURE PRESSURISÉE INFLAMMABLE !');
          }
        } else if (fl.isRuptured && !fl.isIgnited && damage > 10) {
          // Ignite into roaring fire wall!
          this.igniteFuelLine(fl, audioEngine, particles, ui);
          hit = true;
        }
      }
    });
    return hit;
  }

  igniteFuelLine(fl, audioEngine, particles, ui) {
    if (!fl || fl.isIgnited) return;
    fl.isIgnited = true;
    fl.fireTimer = 22.0;

    if (audioEngine && audioEngine.playPlasmaBurnerFlame) {
      audioEngine.playPlasmaBurnerFlame();
    } else if (audioEngine && audioEngine.playFlamethrowerRoar) {
      audioEngine.playFlamethrowerRoar();
    }

    // Flame Wall Mesh
    const fGeo = new THREE.BoxGeometry(fl.cfg.axis === 'x' ? fl.cfg.length * 0.85 : 3.5, 2.8, fl.cfg.axis === 'z' ? fl.cfg.length * 0.85 : 3.5);
    const fMat = new THREE.MeshBasicMaterial({
      color: 0xff4400,
      transparent: true,
      opacity: 0.65
    });
    fl.fireMesh = new THREE.Mesh(fGeo, fMat);
    fl.fireMesh.position.set(fl.center.x, 1.4, fl.center.z);
    this.addReferenceObject(fl.fireMesh);

    if (ui && ui.showAnnouncement) {
      ui.showAnnouncement('🔥 CONDUIT JP-4 ENFLAMMÉ : MUR DE FEU HADLEY\'S HOPE ACTIF (160 DÉGÂTS/S RADIAUX) !');
    }
  }

  updateFuelLines(delta, player, horde, synthetics, particles, audioEngine) {
    this.fuelLines.forEach(fl => {
      if (fl.isRuptured && !fl.isIgnited) {
        // Fuel spray particles
        if (particles && particles.emitSmoke && this.random() < 0.25) {
          particles.emitSmoke(fl.center.clone().add(new THREE.Vector3((this.random() - 0.5) * 6, 0.5, (this.random() - 0.5) * 6)), 3);
        }
      }

      if (fl.isIgnited) {
        fl.fireTimer -= delta;

        // Flicker fire mesh
        if (fl.fireMesh) {
          fl.fireMesh.scale.y = 1.0 + Math.sin((this.referenceTime * 1000) * 0.02) * 0.25;
          fl.fireMesh.material.opacity = 0.55 + Math.sin((this.referenceTime * 1000) * 0.03) * 0.15;
        }

        // Deal 160 fire damage/s to all aliens in fire zone
        if (horde && horde.aliens) {
          for (let i = horde.aliens.length - 1; i >= 0; i--) {
            const a = horde.aliens[i];
            if (!a || a.hp <= 0 || !a.mesh) continue;
            if (a.mesh.position.distanceTo(fl.center) <= (fl.cfg.length * 0.45)) {
              a.hp -= 160 * delta;
              if (particles && particles.emitSparks && this.random() < 0.3) {
                particles.emitSparks(a.mesh.position, 3);
              }
              if (a.hp <= 0) {
                if (horde.goreEngine) horde.goreEngine.spawnDismemberment(a.mesh.position, 'heavy');
                this.removeReferenceObject(a.mesh);
                horde.defeatAlien?.(a, { cause: 'environment-updateFuelLines', killerFaction: 'neutral' });
              }
            }
          }
        }

        // Deal fire damage to synthetics
        if (synthetics && synthetics.androids) {
          synthetics.androids.forEach(syn => {
            if (syn.mesh.position.distanceTo(fl.center) <= (fl.cfg.length * 0.45)) {
              syn.hp -= 120 * delta;
            }
          });
        }

        // Friendly fire on player if stepping inside
        if (player && player.position.distanceTo(fl.center) <= 3.2) {
          if (!player.isExosuitActive) {
            player.takeDamage(65 * delta, false);
          }
        }

        if (fl.fireTimer <= 0) {
          fl.isIgnited = false;
          if (fl.fireMesh) {
            this.removeReferenceObject(fl.fireMesh);
            fl.fireMesh = null;
          }
        }
      }
    });
  }

  /* === CHANTIER 9 (v46): USCM Cargo Crane Operator Console & 10-Ton Container Drop === */
  buildCargoCraneConsole() {
    const group = new THREE.Group();
    const pos = new THREE.Vector3(16, 0, 8);
    group.position.copy(pos);

    const metalMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.9, roughness: 0.25 });
    const yellowMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.35 });
    const screenMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

    // Console Desk Pedestal
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.1, 0.8), yellowMat);
    base.position.y = 0.55;
    group.add(base);

    // Terminal Monitor
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.45, 0.08), screenMat);
    screen.position.set(0, 1.25, -0.15);
    screen.rotation.x = -0.35;
    group.add(screen);

    // Hydraulic Crane Release Lever
    const lever = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.4, 6), metalMat);
    lever.position.set(0.3, 1.2, 0.1);
    lever.rotation.x = 0.4;
    group.add(lever);

    this.addReferenceObject(group);
    this.envObjects.push(group);

    this.craneConsole = {
      group,
      pos,
      isUsed: false
    };
  }

  checkCraneConsoleInteraction(playerPos, player, ui, audioEngine, particles, horde, bosses, synthetics) {
    if (!this.craneConsole || this.craneConsole.isUsed) return false;
    const consoleObj = this.craneConsole;

    if (playerPos.distanceTo(consoleObj.pos) <= 3.2) {
      if (this.cargoCrane && !this.cargoCrane.isDropping && !this.cargoCrane.isDropped) {
        consoleObj.isUsed = true;
        this.cargoCrane.isDropping = true;
        this.cargoCrane.cableMesh.visible = false;

        if (audioEngine && audioEngine.playCargoCraneCableSnap) {
          audioEngine.playCargoCraneCableSnap();
        }

        if (ui && ui.showAnnouncement) {
          ui.showAnnouncement('🏗️ TREUIL ÉLECTROMAGNÉTIQUE DÉSACTIVÉ : LARGAGE DU CONTENEUR DE 10 TONNES !');
        }

        return true;
      }
    }
    return false;
  }

  /* === CHANTIER 3 (v47): Planet 4 Engineer City Ruins (Prometheus / Alien: Covenant) === */
  buildEngineerCityRuins() {
    const group = new THREE.Group();
    const basaltMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8, metalness: 0.2 });
    const stoneTrimMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7, metalness: 0.25 });
    const runeMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });

    // Monumental 6m Carved Engineer Heads (Planet 4 Necropolis Plaza)
    [-24, 24].forEach((posX) => {
      const headGroup = new THREE.Group();
      headGroup.position.set(posX, 0, -32);

      // Basalt Pedestal
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.2, 4.2), basaltMat);
      plinth.position.y = 1.1;
      headGroup.add(plinth);

      // Carved Stoic Engineer Cranium & Classical Face
      const headMesh = new THREE.Mesh(new THREE.SphereGeometry(2.4, 12, 12), basaltMat);
      headMesh.position.y = 4.5;
      headMesh.scale.set(0.9, 1.35, 1.05);
      headGroup.add(headMesh);

      // Strong sculpted Engineer brow and nose
      const nose = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.1, 0.45), stoneTrimMat);
      nose.position.set(0, 4.5, 2.2);
      headGroup.add(nose);

      // Heavy jawline
      const jaw = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 1.2), basaltMat);
      jaw.position.set(0, 3.2, 1.6);
      headGroup.add(jaw);

      group.add(headGroup);
    });

    // Basalt Obelisks with Cuneiform Biomechanical Glyphs
    const obeliskPositions = [
      [-36, 0, 10], [36, 0, 10], [-18, 0, 36], [18, 0, 36]
    ];
    obeliskPositions.forEach(pos => {
      const ob = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.3, 10.0, 4), basaltMat);
      ob.position.set(pos[0], 5.0, pos[2]);
      ob.rotation.y = Math.PI / 4;
      group.add(ob);

      // Glowing hieroglyph rings
      for (let r = 0; r < 3; r++) {
        const rune = new THREE.Mesh(new THREE.TorusGeometry(0.85 - r * 0.1, 0.03, 4, 12), runeMat);
        rune.rotation.x = Math.PI / 2;
        rune.position.set(pos[0], 3.0 + r * 2.2, pos[2]);
        group.add(rune);
      }
    });

    this.addReferenceObject(group);
    this.envObjects.push(group);
    this.engineerRuins = { group };
  }

  /* === CHANTIER 6 (v47): Weyland-Yutani Atmospheric Cooling Tower Cryo-Vent Purge (Alien 3 / Fiorina 161) === */
  buildCoolingTowerCryoVent() {
    const group = new THREE.Group();
    const towerPos = new THREE.Vector3(0, 0, -38);
    group.position.copy(towerPos);

    const steelMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.85, roughness: 0.3 });
    const frostMat = new THREE.MeshStandardMaterial({ color: 0x93c5fd, metalness: 0.6, roughness: 0.15 });
    const cautionMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.4 });
    const ventMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, emissive: 0x0369a1, roughness: 0.2 });

    // Colossal Cooling Stack Cylinder (14m tall)
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 6.0, 14, 16), steelMat);
    stack.position.y = 7.0;
    group.add(stack);

    // Industrial Cryo Exhaust Grating Ring
    const grate = new THREE.Mesh(new THREE.CylinderGeometry(5.4, 5.4, 1.6, 16), ventMat);
    grate.position.y = 12.5;
    group.add(grate);

    // Liquid Nitrogen Conduit Pipes
    [-3.2, 3.2].forEach(ox => {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 12, 8), frostMat);
      pipe.position.set(ox, 6.0, 4.5);
      group.add(pipe);
    });

    // Manual Cryo-Purge Pedestal Console (6m in front of tower at z = 6)
    const consoleBase = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.1, 0.8), cautionMat);
    consoleBase.position.set(0, 0.55, 6.0);
    group.add(consoleBase);

    const lever = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.45, 6), frostMat);
    lever.position.set(0, 1.25, 6.0);
    lever.rotation.x = -0.35;
    group.add(lever);

    this.addReferenceObject(group);
    this.envObjects.push(group);

    this.coolingTowerCryoVent = {
      group,
      pos: towerPos,
      consolePos: new THREE.Vector3(towerPos.x, 0, towerPos.z + 6.0),
      isFlushing: false,
      flushTimer: 0,
      cooldown: 0,
      radius: 18.0,
      fogMesh: null,
      lever
    };
  }

  checkCryoVentInteraction(playerPos, player, ui, audioEngine, horde, bosses) {
    if (!this.coolingTowerCryoVent) return false;
    const vent = this.coolingTowerCryoVent;

    if (vent.cooldown > 0) return false;

    if (playerPos.distanceTo(vent.consolePos) <= 3.2) {
      vent.isFlushing = true;
      vent.flushTimer = 5.0;
      vent.cooldown = 24.0;
      vent.lever.rotation.x = 0.45;

      if (audioEngine && audioEngine.playCryoVentFlush) {
        audioEngine.playCryoVentFlush();
      }

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement('❄️ PURGE CRYOGÉNIQUE DE LA TOUR : DÉLUGE D\'AZOTE LIQUIDE ACTIF (ZONE 18M, DÉGÂTS X3 SHATTER) !');
      }

      // Create expanding frosty deluge fog mesh
      if (!vent.fogMesh) {
        const fogGeo = new THREE.CylinderGeometry(vent.radius, vent.radius, 2.5, 24);
        const fogMat = new THREE.MeshStandardMaterial({
          color: 0xbae6fd,
          emissive: 0x38bdf8,
          transparent: true,
          opacity: 0.65,
          roughness: 0.1
        });
        vent.fogMesh = new THREE.Mesh(fogGeo, fogMat);
        vent.fogMesh.position.set(vent.pos.x, 1.25, vent.pos.z + 4.0);
        this.addReferenceObject(vent.fogMesh);
      }

      return true;
    }
    return false;
  }

  updateCoolingTowerCryoVent(delta, player, horde, bosses, particles, audioEngine) {
    if (!this.coolingTowerCryoVent) return;
    const vent = this.coolingTowerCryoVent;

    if (vent.cooldown > 0) {
      vent.cooldown -= delta;
      if (vent.cooldown <= 0) {
        vent.lever.rotation.x = -0.35;
      }
    }

    if (vent.isFlushing) {
      vent.flushTimer -= delta;

      // Pulse fog mesh
      if (vent.fogMesh) {
        vent.fogMesh.material.opacity = 0.45 + Math.sin((this.referenceTime * 1000) * 0.01) * 0.2;
      }

      // Flash-freeze all Xenomorphs in 18m radius
      if (horde && horde.aliens) {
        horde.aliens.forEach(a => {
          if (!a || a.hp <= 0 || !a.mesh) return;
          if (a.mesh.position.distanceTo(vent.pos) <= vent.radius) {
            a.isFrozen = true;
            a.freezeTimer = 6.0;
            a.isFlashFrozen = true;
            a.frozenTimer = 6.0;
            if (a.mesh.traverse) {
              a.mesh.traverse(child => {
                if (child.isMesh && child.material && child.material.color) {
                  if (child.origColor === undefined) child.origColor = child.material.color.getHex();
                  child.material.color.setHex(0x93c5fd);
                }
              });
            }
          }
        });
      }

      // Frost particles
      if (particles && particles.emitSparks && this.random() < 0.3) {
        particles.emitSparks(vent.pos.clone().add(new THREE.Vector3((this.random() - 0.5) * 12, 1.0, (this.random() - 0.5) * 12)), 4);
      }

      if (vent.flushTimer <= 0) {
        vent.isFlushing = false;
        if (vent.fogMesh) {
          this.removeReferenceObject(vent.fogMesh);
          vent.fogMesh = null;
        }
      }
    }
  }

  /* === CHANTIER 9 (v47): Engineer Ceramic Urns & Black Mutagen Z-01 Puddles (Prometheus 2012) === */
  buildEngineerUrnClusters() {
    const urnMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85, metalness: 0.1 });
    const capMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.4, metalness: 0.8 });
    const clusterCenters = [
      new THREE.Vector3(-14, 0, -18),
      new THREE.Vector3(14, 0, -18),
      new THREE.Vector3(-22, 0, 14),
      new THREE.Vector3(22, 0, 14)
    ];

    clusterCenters.forEach(center => {
      const count = 3 + Math.floor(this.random() * 2);
      for (let i = 0; i < count; i++) {
        const group = new THREE.Group();
        const offsetX = (this.random() - 0.5) * 2.8;
        const offsetZ = (this.random() - 0.5) * 2.8;
        const pos = center.clone().add(new THREE.Vector3(offsetX, 0, offsetZ));
        group.position.copy(pos);

        // Cylindrical tapered urn base
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.22, 1.1, 8), urnMat);
        base.position.y = 0.55;
        group.add(base);

        // Bulbous urn belly
        const belly = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 8), urnMat);
        belly.position.y = 0.65;
        belly.scale.set(1.0, 1.25, 1.0);
        group.add(belly);

        // Hermetic sealed top cap
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.25, 8), capMat);
        cap.position.y = 1.18;
        group.add(cap);

        this.addReferenceObject(group);
        this.envObjects.push(group);

        this.engineerUrns.push({
          group,
          pos,
          hp: 40,
          isDestroyed: false
        });
      }
    });
  }

  checkUrnDamage(hitPos, hitRadius, damage, audioEngine) {
    for (let i = this.engineerUrns.length - 1; i >= 0; i--) {
      const urn = this.engineerUrns[i];
      if (urn.isDestroyed) continue;

      if (urn.pos.distanceTo(hitPos) <= (hitRadius + 0.8)) {
        urn.hp -= damage;
        if (urn.hp <= 0) {
          urn.isDestroyed = true;
          this.removeReferenceObject(urn.group);

          if (audioEngine && audioEngine.playEngineerUrnDetonation) {
            audioEngine.playEngineerUrnDetonation();
          }

          // Spawn viscous Black Mutagen Z-01 Puddle
          this.spawnMutagenPuddle(urn.pos);
          return true;
        }
      }
    }
    return false;
  }

  spawnMutagenPuddle(pos) {
    const pGeo = new THREE.CircleGeometry(2.4, 16);
    pGeo.rotateX(-Math.PI / 2);
    const pMat = new THREE.MeshStandardMaterial({
      color: 0x020617,
      emissive: 0x052e16,
      roughness: 0.1,
      metalness: 0.95
    });
    const pMesh = new THREE.Mesh(pGeo, pMat);
    pMesh.position.set(pos.x, 0.04, pos.z);
    this.addReferenceObject(pMesh);

    this.mutagenPuddles.push({
      mesh: pMesh,
      pos: pos.clone(),
      life: 22.0,
      radius: 2.4
    });
  }

  updateMutagenPuddles(delta, player, horde, audioEngine) {
    for (let p = this.mutagenPuddles.length - 1; p >= 0; p--) {
      const pud = this.mutagenPuddles[p];
      pud.life -= delta;

      // Damage player if stepping inside (unless exosuit is active)
      if (player && player.position.distanceTo(pud.pos) <= pud.radius) {
        if (!player.isExosuitActive) {
          player.takeDamage(45 * delta, true);
        }
      }

      // Mutagenic Berserk Acceleration for Xenomorphs
      if (horde && horde.aliens) {
        horde.aliens.forEach(a => {
          if (!a || a.hp <= 0 || !a.mesh) return;
          if (a.mesh.position.distanceTo(pud.pos) <= pud.radius) {
            if (!a.isMutagenBerserk) {
              a.isMutagenBerserk = true;
              a.speed *= 1.35;
              if (audioEngine && audioEngine.playXenoHiss && this.random() < 0.1) {
                audioEngine.playXenoHiss();
              }
            }
          }
        });
      }

      if (pud.life <= 0) {
        this.removeReferenceObject(pud.mesh);
        this.mutagenPuddles.splice(p, 1);
      }
    }
  }

  /* === CHANTIER 4 (v48): Fiorina "Fury" 161 Molten Lead Foundry & Pouring Vat (Alien 3 1992 Canon 1:1) === */
  buildFiorinaMoltenLeadFoundry() {
    const group = new THREE.Group();
    const pos = new THREE.Vector3(28, 0, -24);
    group.position.copy(pos);

    const rustIronMat = new THREE.MeshStandardMaterial({ color: 0x3f2318, roughness: 0.75, metalness: 0.85 });
    const moltenMat = new THREE.MeshStandardMaterial({
      color: 0xff5500,
      emissive: 0xea580c,
      roughness: 0.2,
      metalness: 0.4
    });
    const valveMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.3, metalness: 0.8 });

    // 1. Industrial Gantry Supports (2 Heavy Pillars holding the overhead crucible)
    [-3.5, 3.5].forEach(gx => {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.9, 8.5, 0.9), rustIronMat);
      pillar.position.set(gx, 4.25, 0);
      group.add(pillar);
    });
    const crossBeam = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.8, 1.1), rustIronMat);
    crossBeam.position.set(0, 8.2, 0);
    group.add(crossBeam);

    // 2. Suspended 12-Ton Crucible Cauldron (filled with glowing 1200°C molten lead)
    const vat = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 1.6, 3.2, 12), rustIronMat);
    vat.position.set(0, 6.2, 0);
    group.add(vat);

    const moltenTop = new THREE.Mesh(new THREE.CircleGeometry(1.95, 12), moltenMat);
    moltenTop.rotation.x = -Math.PI / 2;
    moltenTop.position.set(0, 7.82, 0);
    group.add(moltenTop);

    // 3. Floor Containment Mold Channel (14m long x 4.5m wide)
    const channelWallMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.8, metalness: 0.6 });
    [-2.4, 2.4].forEach(wx => {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.55, 14.0), channelWallMat);
      curb.position.set(wx, 0.275, 4.5);
      group.add(curb);
    });

    // 4. Interactive Purge Valve Pedestal & Red Wheel at (28, 0, -19.5)
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.35, 1.3, 8), rustIronMat);
    ped.position.set(-3.2, 0.65, 3.5);
    group.add(ped);

    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.05, 6, 12), valveMat);
    wheel.position.set(-3.2, 1.35, 3.5);
    group.add(wheel);

    this.addReferenceObject(group);
    this.envObjects.push(group);

    this.moltenFoundry = {
      group,
      pos,
      valvePos: new THREE.Vector3(pos.x - 3.2, 0, pos.z + 3.5),
      channelCenter: new THREE.Vector3(pos.x, 0, pos.z + 4.5),
      vatMesh: vat,
      wheelMesh: wheel,
      isPouring: false,
      pourTimer: 0,
      cooldown: 0,
      pourMesh: null,
      poolMesh: null
    };
  }

  checkFoundryValveInteraction(player, audioEngine, ui) {
    if (!this.moltenFoundry || !player) return false;
    const f = this.moltenFoundry;

    if (player.position.distanceTo(f.valvePos) <= 4.5) {
      if (f.isPouring) {
        if (ui && ui.showAnnouncement) ui.showAnnouncement('🔥 FONDERIE FIORINA 161 : COULÉE DE PLOMB EN FUSION (1200°C) EN COURS !');
        return true;
      }
      if (f.cooldown > 0) {
        if (ui && ui.showAnnouncement) ui.showAnnouncement(`⏳ CREUSET DE PLOMB EN RECHARGE THERMIQUE (${Math.ceil(f.cooldown)}S)...`);
        return true;
      }

      f.isPouring = true;
      f.pourTimer = 12.0; // 12 seconds of 1200°C molten lead cascade
      f.cooldown = 28.0;

      if (audioEngine && audioEngine.playMoltenLeadPour) {
        audioEngine.playMoltenLeadPour();
      }
      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement('🔥 FONDERIE FIORINA 161 (ALIEN 3) : DÉVERSEMENT DE 12 TONNES DE PLOMB EN FUSION (280 DÉGÂTS/S) !');
      }

      // Tilt vat & create vertical molten cascade + incandescent floor channel pool
      f.vatMesh.rotation.x = 0.42;

      const streamGeo = new THREE.CylinderGeometry(0.65, 1.15, 6.0, 10);
      const streamMat = new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.92 });
      f.pourMesh = new THREE.Mesh(streamGeo, streamMat);
      f.pourMesh.position.set(f.pos.x, 3.0, f.pos.z + 1.5);
      this.addReferenceObject(f.pourMesh);

      const poolGeo = new THREE.PlaneGeometry(4.4, 13.6);
      poolGeo.rotateX(-Math.PI / 2);
      const poolMat = new THREE.MeshStandardMaterial({
        color: 0xff4500,
        emissive: 0xea580c,
        roughness: 0.15,
        metalness: 0.5,
        transparent: true,
        opacity: 0.94
      });
      f.poolMesh = new THREE.Mesh(poolGeo, poolMat);
      f.poolMesh.position.set(f.channelCenter.x, 0.08, f.channelCenter.z);
      this.addReferenceObject(f.poolMesh);

      return true;
    }
    return false;
  }

  updateMoltenLeadFoundry(delta, player, horde, bosses, particles) {
    if (!this.moltenFoundry) return;
    const f = this.moltenFoundry;

    if (f.cooldown > 0 && !f.isPouring) {
      f.cooldown = Math.max(0, f.cooldown - delta);
    }

    if (f.isPouring) {
      f.pourTimer -= delta;
      f.wheelMesh.rotation.z += 5.0 * delta;

      if (f.pourMesh) {
        f.pourMesh.scale.x = 0.9 + Math.sin((this.referenceTime * 1000) * 0.025) * 0.15;
        f.pourMesh.scale.z = 0.9 + Math.cos((this.referenceTime * 1000) * 0.025) * 0.15;
      }

      // 280 thermal dmg/s inside the 14m x 4.5m containment channel
      if (horde && horde.aliens) {
        for (let i = horde.aliens.length - 1; i >= 0; i--) {
          const a = horde.aliens[i];
          if (!a || a.hp <= 0 || !a.mesh) continue;
          const dx = Math.abs(a.mesh.position.x - f.channelCenter.x);
          const dz = Math.abs(a.mesh.position.z - f.channelCenter.z);
          if (dx <= 2.5 && dz <= 7.0) {
            a.hp -= 280 * delta;
            if (particles && particles.emitSparks && this.random() < 0.25) {
              particles.emitSparks(a.mesh.position, 4);
            }
            if (a.hp <= 0) {
              if (horde.goreEngine) horde.goreEngine.spawnDismemberment(a.mesh.position, 'plasma');
              this.removeReferenceObject(a.mesh);
              horde.defeatAlien?.(a, { cause: 'environment-updateMoltenLeadFoundry', killerFaction: 'neutral' });
              if (this.game) {
                this.game.comboHits++;
                this.game.score += 120;
              }
            }
          }
        }
      }

      // Boss thermal shock damage (Alien 3 Dragon thermal shock!)
      if (bosses && bosses.activeBoss && bosses.activeBoss.mesh) {
        const bPos = bosses.activeBoss.mesh.position;
        const dx = Math.abs(bPos.x - f.channelCenter.x);
        const dz = Math.abs(bPos.z - f.channelCenter.z);
        if (dx <= 3.2 && dz <= 7.5) {
          bosses.takeDamage(280 * delta, horde);
        }
      }

      if (f.pourTimer <= 0) {
        f.isPouring = false;
        f.vatMesh.rotation.x = 0;
        if (f.pourMesh) {
          this.removeReferenceObject(f.pourMesh);
          f.pourMesh = null;
        }
        if (f.poolMesh) {
          this.removeReferenceObject(f.poolMesh);
          f.poolMesh = null;
        }
      }
    }
  }

  /* === CHANTIER 5 (v48): Reprogrammed Weyland-Yutani Combat Synthetic Squad ("Bishop Protocol" - Aliens 1986 / AvP Extinction) === */
  deployReprogrammedAndroidSquad(player, audioEngine, ui) {
    if (!player) return false;

    if (this.alliedAndroids.length > 0) {
      this.alliedAndroids.forEach(a => this.removeReferenceObject(a.mesh));
      this.alliedAndroids = [];
    }

    if (audioEngine && audioEngine.playAndroidAllyVoiceBeep) {
      audioEngine.playAndroidAllyVoiceBeep();
    }
    if (ui && ui.showAnnouncement) {
      ui.showAnnouncement('🤖 PROTOCOLE BISHOP [SHIFT+8] : 2 SYNTHÉTIQUES REPROGRAMMÉS DÉPLOYÉS (APPUI M41A & SOIN BIONIQUE +25 PV/S) !');
    }

    const armorMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.25, metalness: 0.85 });
    const cyanVisorMat = new THREE.MeshBasicMaterial({ color: 0x00f2fe });
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3, metalness: 0.9 });

    [-2.8, 2.8].forEach((offsetX, idx) => {
      const group = new THREE.Group();

      const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.26, 1.35, 8), armorMat);
      torso.position.y = 1.1;
      group.add(torso);

      const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 10), armorMat);
      head.position.y = 1.95;
      group.add(head);

      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.1, 0.22), cyanVisorMat);
      visor.position.set(0, 1.96, 0.16);
      group.add(visor);

      const rifle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.85), gunMat);
      rifle.position.set(0.28, 1.25, 0.35);
      group.add(rifle);

      const spawnPos = player.position.clone().add(new THREE.Vector3(offsetX, 0, -2.0));
      group.position.copy(spawnPos);
      this.addReferenceObject(group);

      this.alliedAndroids.push({
        mesh: group,
        offset: new THREE.Vector3(offsetX, 0, -2.2),
        hp: 650,
        maxHp: 650,
        lifeTimer: 45.0,
        fireCooldown: 0.25 * (idx + 1)
      });
    });

    return true;
  }

  updateReprogrammedAndroids(delta, player, horde, bosses, audioEngine, particles) {
    if (!this.alliedAndroids || this.alliedAndroids.length === 0 || !player) return;

    for (let i = this.alliedAndroids.length - 1; i >= 0; i--) {
      const ally = this.alliedAndroids[i];
      ally.lifeTimer -= delta;

      if (ally.lifeTimer <= 0 || ally.hp <= 0) {
        this.removeReferenceObject(ally.mesh);
        this.alliedAndroids.splice(i, 1);
        continue;
      }

      // Follow player in tactical flank formation
      const targetPos = player.position.clone().add(ally.offset);
      targetPos.y = 0;
      const moveDir = targetPos.sub(ally.mesh.position);
      if (moveDir.length() > 1.2) {
        moveDir.normalize();
        ally.mesh.position.addScaledVector(moveDir, 11.5 * delta);
      }

      // Bionic Field Repair: heal player +12.5 HP/s per synthetic (25 HP/s total for 2 synthetics) within 6m
      if (ally.mesh.position.distanceTo(player.position) <= 6.5 && player.hp < player.maxHp) {
        player.hp = Math.min(player.maxHp, player.hp + 12.5 * delta);
      }

      // Covering Fire with M41A Pulse Rifle (65 dmg/s per synthetic)
      ally.fireCooldown -= delta;
      if (ally.fireCooldown <= 0) {
        ally.fireCooldown = 0.35;
        let nearestTarget = null;
        let nearestDist = 28.0;

        if (horde && horde.aliens) {
          horde.aliens.forEach(a => {
            if (a && a.hp > 0 && a.mesh) {
              const d = a.mesh.position.distanceTo(ally.mesh.position);
              if (d < nearestDist) {
                nearestDist = d;
                nearestTarget = a;
              }
            }
          });
        }

        if (nearestTarget && nearestTarget.mesh) {
          const toTarget = nearestTarget.mesh.position.clone().sub(ally.mesh.position).normalize();
          ally.mesh.rotation.y = Math.atan2(toTarget.x, toTarget.z);
          nearestTarget.hp -= 24;

          // Cyan pulse tracer
          const tracerGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.8, 4);
          tracerGeo.rotateX(Math.PI / 2);
          const tracer = new THREE.Mesh(tracerGeo, new THREE.MeshBasicMaterial({ color: 0x00f2fe }));
          tracer.position.copy(ally.mesh.position).add(new THREE.Vector3(0, 1.25, 0)).addScaledVector(toTarget, 1.2);
          tracer.lookAt(nearestTarget.mesh.position);
          this.addReferenceObject(tracer);
          this.referenceDelay(() => this.removeReferenceObject(tracer), 45);

          if (nearestTarget.hp <= 0 && horde) {
            const idx = horde.aliens.indexOf(nearestTarget);
            if (idx !== -1) {
              if (horde.goreEngine) horde.goreEngine.spawnDismemberment(nearestTarget.mesh.position, 'plasma');
              this.removeReferenceObject(nearestTarget.mesh);
              horde.defeatAlien?.(nearestTarget, { cause: 'environment-updateReprogrammedAndroids', killerFaction: 'neutral' });
            }
          }
        } else if (bosses && bosses.activeBoss && bosses.activeBoss.mesh) {
          const bPos = bosses.activeBoss.mesh.position;
          if (bPos.distanceTo(ally.mesh.position) <= 30.0) {
            const toBoss = bPos.clone().sub(ally.mesh.position).normalize();
            ally.mesh.rotation.y = Math.atan2(toBoss.x, toBoss.z);
            bosses.takeDamage(22, horde);
          }
        }
      }
    }
  }

  /* === CHANTIER 9 (v48): LV-426 Pyroclastic Volcanic Ash Storms & Static Plasma Recharge (Aliens 1986 Acheron) === */
  updateVolcanicAshStorm(delta, player, audioEngine, ui) {
    if (!this.volcanicStorm) return;
    const vs = this.volcanicStorm;

    if (!vs.active) {
      vs.timer -= delta;
      if (vs.timer <= 0) {
        vs.active = true;
        vs.duration = 14.0;
        vs.timer = 26.0;

        if (audioEngine && audioEngine.playVolcanicAshThunder) {
          audioEngine.playVolcanicAshThunder();
        }
        if (ui && ui.showAnnouncement) {
          ui.showAnnouncement('🌋 TEMPÊTE PYROCLASTIQUE LV-426 (ACHERON) : FOUDRE STATIQUE (+10 ÉNERGIE PLASMA/S) !');
        }

        // Create falling glowing ember/ash particle cloud
        if (!vs.ashSystem) {
          const count = 220;
          const positions = new Float32Array(count * 3);
          for (let i = 0; i < count; i++) {
            positions[i * 3] = (this.random() - 0.5) * 90;
            positions[i * 3 + 1] = this.random() * 18;
            positions[i * 3 + 2] = (this.random() - 0.5) * 90;
          }
          const geo = new THREE.BufferGeometry();
          geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
          const mat = new THREE.PointsMaterial({ color: 0xf97316, size: 0.28, transparent: true, opacity: 0.75 });
          vs.ashSystem = new THREE.Points(geo, mat);
          this.addReferenceObject(vs.ashSystem);
        }
      }
    } else {
      vs.duration -= delta;

      // Electrostatic ambient charge boosts Yautja Plasma Energy by +10/s
      if (player) {
        player.plasmaEnergy = Math.min(player.maxPlasmaEnergy || 100, (player.plasmaEnergy || 0) + 10.0 * delta);
      }

      if (vs.ashSystem) {
        const posAttr = vs.ashSystem.geometry.attributes.position;
        for (let i = 0; i < posAttr.count; i++) {
          let y = posAttr.getY(i) - 6.5 * delta;
          let x = posAttr.getX(i) + 4.0 * delta;
          if (y < 0) y = 18.0;
          if (x > 45) x = -45;
          posAttr.setY(i, y);
          posAttr.setX(i, x);
        }
        posAttr.needsUpdate = true;
      }

      if (vs.duration <= 0) {
        vs.active = false;
        if (vs.ashSystem) {
          this.removeReferenceObject(vs.ashSystem);
          vs.ashSystem = null;
        }
      }
    }
  }

  /* === CHANTIER 3 (v49): USCM M579 "Aguilar" Guided SAM Missile Battery & Radar (Aliens / Fireteam Elite) === */
  buildUSCMMissileBattery() {
    const group = new THREE.Group();
    const pos = new THREE.Vector3(-26, 0, -24);
    group.position.copy(pos);

    const oliveMat = new THREE.MeshStandardMaterial({ color: 0x364531, roughness: 0.55, metalness: 0.75 });
    const darkSteelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3, metalness: 0.9 });
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.45 });

    // Armored Tripod Pedestal Base
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.8, 1.1, 8), darkSteelMat);
    base.position.y = 0.55;
    group.add(base);

    // Rotating Turret Head with Twin 6-Tube Missile Pods + Radar Dish
    const turretHead = new THREE.Group();
    turretHead.position.y = 1.65;

    [-1.1, 1.1].forEach(px => {
      const pod = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.95, 1.8), oliveMat);
      pod.position.set(px, 0.2, 0);
      turretHead.add(pod);
    });

    const radarDish = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.2, 0.25, 12), darkSteelMat);
    radarDish.rotation.x = Math.PI / 3;
    radarDish.position.set(0, 1.05, -0.35);
    turretHead.add(radarDish);

    group.add(turretHead);

    // QA Audit #5 Fix: Vertical Diegetic Tactical Beacon Pillar
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 12.0, 8), beaconMat);
    beacon.position.y = 6.0;
    group.add(beacon);

    this.addReferenceObject(group);
    this.envObjects.push(group);

    this.uscmMissileBattery = {
      group,
      pos,
      turretHead,
      radarDish,
      fireCooldown: 2.5
    };
  }

  updateUSCMMissileBattery(delta, horde, bosses, audioEngine, particles) {
    if (!this.uscmMissileBattery) return;
    const bat = this.uscmMissileBattery;

    if (bat.radarDish) {
      bat.radarDish.rotation.y += 3.2 * delta;
    }

    bat.fireCooldown -= delta;
    if (bat.fireCooldown <= 0) {
      bat.fireCooldown = 3.2;

      // Prioritize Airborne Manta Swarmers, Royal Facehuggers, Raven Xenomorphs, then nearest Alien/Boss
      let targetMesh = null;
      let targetEntity = null;
      let isMantaTarget = false;

      if (horde && horde.mantaSwarmers && horde.mantaSwarmers.length > 0) {
        const m = horde.mantaSwarmers[0];
        if (m && m.mesh) {
          targetMesh = m.mesh;
          targetEntity = m;
          isMantaTarget = true;
        }
      }

      if (!targetMesh && horde && horde.aliens) {
        let bestDist = 42.0;
        horde.aliens.forEach(a => {
          if (a && a.hp > 0 && a.mesh) {
            const d = a.mesh.position.distanceTo(bat.pos);
            const priorityDist = (a.isRaven || a.isRogueKing || a.isAncientPredalien) ? d * 0.45 : d;
            if (priorityDist < bestDist) {
              bestDist = priorityDist;
              targetMesh = a.mesh;
              targetEntity = a;
            }
          }
        });
      }

      if (!targetMesh && bosses && bosses.activeBoss && bosses.activeBoss.mesh) {
        if (bosses.activeBoss.mesh.position.distanceTo(bat.pos) <= 45.0) {
          targetMesh = bosses.activeBoss.mesh;
          targetEntity = bosses.activeBoss;
        }
      }

      if (targetMesh) {
        const toTarget = targetMesh.position.clone().sub(bat.pos).normalize();
        bat.turretHead.rotation.y = Math.atan2(toTarget.x, toTarget.z);

        if (audioEngine && audioEngine.playUSCMMissileLaunch) {
          audioEngine.playUSCMMissileLaunch();
        }

        const mGeo = new THREE.CylinderGeometry(0.08, 0.12, 0.9, 6);
        mGeo.rotateX(Math.PI / 2);
        const mMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
        const mMesh = new THREE.Mesh(mGeo, mMat);
        mMesh.position.copy(bat.pos).add(new THREE.Vector3(0, 2.2, 0));
        this.addReferenceObject(mMesh);

        this.activeSAMMissiles.push({
          mesh: mMesh,
          targetMesh,
          targetEntity,
          isMantaTarget,
          speed: 32.0,
          life: 3.0
        });
      }
    }

    // Update Homing SAM Missiles
    for (let i = this.activeSAMMissiles.length - 1; i >= 0; i--) {
      const ms = this.activeSAMMissiles[i];
      ms.life -= delta;

      if (!ms.targetMesh || ms.life <= 0) {
        this.removeReferenceObject(ms.mesh);
        this.activeSAMMissiles.splice(i, 1);
        continue;
      }

      const dir = ms.targetMesh.position.clone().sub(ms.mesh.position).normalize();
      ms.mesh.position.addScaledVector(dir, ms.speed * delta);
      ms.mesh.lookAt(ms.targetMesh.position);

      if (ms.mesh.position.distanceTo(ms.targetMesh.position) <= 1.8) {
        if (particles && particles.emitSparks) {
          particles.emitSparks(ms.mesh.position, 10);
        }
        if (ms.isMantaTarget && horde && horde.mantaSwarmers) {
          const idx = horde.mantaSwarmers.indexOf(ms.targetEntity);
          if (idx !== -1) {
            horde.defeatAlien?.(ms.targetEntity, { cause: 'environment-sam', kind: 'manta_swarmer', killerFaction: 'neutral' });
          }
        } else if (ms.targetEntity && ms.targetEntity.hp !== undefined) {
          ms.targetEntity.hp -= 340;
          if (ms.targetEntity.hp <= 0 && horde && horde.aliens) {
            const idx = horde.aliens.indexOf(ms.targetEntity);
            if (idx !== -1) {
              if (horde.goreEngine) horde.goreEngine.spawnDismemberment(ms.targetMesh.position, 'heavy');
              this.removeReferenceObject(ms.targetMesh);
              horde.defeatAlien?.(ms.targetEntity, { cause: 'environment-updateUSCMMissileBattery', killerFaction: 'neutral' });
            }
          }
        }
        this.removeReferenceObject(ms.mesh);
        this.activeSAMMissiles.splice(i, 1);
      }
    }
  }

  /* === CHANTIER 4 (v49): USM Auriga Flooded Hydro-Cryo Basin & 50,000V Breaker (Alien: Resurrection 1997) === */
  buildAurigaFloodedBasin() {
    const group = new THREE.Group();
    const pos = new THREE.Vector3(0, 0, 26);
    group.position.copy(pos);

    const waterGeo = new THREE.PlaneGeometry(18.0, 14.0);
    waterGeo.rotateX(-Math.PI / 2);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      emissive: 0x0369a1,
      roughness: 0.1,
      metalness: 0.85,
      transparent: true,
      opacity: 0.72
    });
    const waterMesh = new THREE.Mesh(waterGeo, waterMat);
    waterMesh.position.y = 0.06;
    group.add(waterMesh);

    // Containment Rim Curbs
    const rimMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5, metalness: 0.8 });
    [-9.2, 9.2].forEach(rx => {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.45, 14.4), rimMat);
      curb.position.set(rx, 0.22, 0);
      group.add(curb);
    });

    // 50,000V Hydro-Electric Breaker Console at (0, 0, 18.5)
    const consoleMesh = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.5, 0.7), rimMat);
    consoleMesh.position.set(0, 0.75, -7.5);
    group.add(consoleMesh);

    const beaconMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.45 });
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 10.0, 8), beaconMat);
    beacon.position.set(0, 5.0, -7.5);
    group.add(beacon);

    this.addReferenceObject(group);
    this.envObjects.push(group);

    this.aurigaBasin = {
      group,
      pos,
      breakerPos: new THREE.Vector3(pos.x, 0, pos.z - 7.5),
      waterMesh,
      isElectrified: false,
      shockTimer: 0,
      cooldown: 0,
      arcMesh: null
    };
  }

  checkAurigaBreakerInteraction(player, audioEngine, ui) {
    if (!this.aurigaBasin || !player) return false;
    const b = this.aurigaBasin;

    if (player.position.distanceTo(b.breakerPos) <= 4.2) {
      if (b.isElectrified) {
        if (ui && ui.showAnnouncement) ui.showAnnouncement('⚡ BASSIN USM AURIGA : SURTENSION HYDRO-ÉLECTRIQUE 50 000V DÉJÀ EN COURS !');
        return true;
      }
      if (b.cooldown > 0) {
        if (ui && ui.showAnnouncement) ui.showAnnouncement(`⏳ DISJONCTEUR USM AURIGA EN RECHARGE (${Math.ceil(b.cooldown)}S)...`);
        return true;
      }

      b.isElectrified = true;
      b.shockTimer = 8.0;
      b.cooldown = 22.0;
      b.waterMesh.material.emissive.setHex(0x00f2fe);

      if (audioEngine && audioEngine.playAurigaHydroElectroShock) {
        audioEngine.playAurigaHydroElectroShock();
      }
      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement('⚡ SECTEUR INONDÉ USM AURIGA (ALIEN RESURRECTION) : DÉCHARGE 50 000V DANS L\'EAU (320 DÉGÂTS/S & STUN) !');
      }
      return true;
    }
    return false;
  }

  updateAurigaFloodedBasin(delta, player, horde, bosses, particles) {
    if (!this.aurigaBasin) return;
    const b = this.aurigaBasin;

    if (b.cooldown > 0 && !b.isElectrified) {
      b.cooldown = Math.max(0, b.cooldown - delta);
    }

    // Check Xenomorphs inside the 18m x 14m flooded basin
    if (horde && horde.aliens) {
      for (let i = horde.aliens.length - 1; i >= 0; i--) {
        const a = horde.aliens[i];
        if (!a || a.hp <= 0 || !a.mesh) continue;
        const dx = Math.abs(a.mesh.position.x - b.pos.x);
        const dz = Math.abs(a.mesh.position.z - b.pos.z);
        if (dx <= 9.0 && dz <= 7.0) {
          // Water drag slows terrestrial movement
          a.mesh.position.y = 0;
          if (b.isElectrified) {
            a.hp -= 320 * delta;
            a.isStunned = true;
            a.stunTimer = Math.max(a.stunTimer || 0, 1.5);
            if (particles && particles.emitSparks && this.random() < 0.25) {
              particles.emitSparks(a.mesh.position, 4);
            }
            if (a.hp <= 0) {
              if (horde.goreEngine) horde.goreEngine.spawnDismemberment(a.mesh.position, 'plasma');
              this.removeReferenceObject(a.mesh);
              horde.defeatAlien?.(a, { cause: 'environment-updateAurigaFloodedBasin', killerFaction: 'neutral' });
            }
          }
        }
      }
    }

    if (b.isElectrified) {
      b.shockTimer -= delta;
      if (b.shockTimer <= 0) {
        b.isElectrified = false;
        b.waterMesh.material.emissive.setHex(0x0369a1);
      }
    }
  }

  /* === CHANTIER 9 (v49): Ancient Yautja Shrine of the Ancients & Divine Blessings (AVP: Extinction) === */
  buildShrineOfTheAncients() {
    const group = new THREE.Group();
    const pos = new THREE.Vector3(-28, 0, 24);
    group.position.copy(pos);

    const obsidianMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.25, metalness: 0.85 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.2, metalness: 0.95 });
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.85 });

    // Stepped Pyramid Pedestal
    const step1 = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 3.4, 0.6, 6), obsidianMat);
    step1.position.y = 0.3;
    group.add(step1);

    const altar = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.8, 1.5, 6), goldMat);
    altar.position.y = 1.35;
    group.add(altar);

    // Twin Plasma Braziers
    [-2.0, 2.0].forEach(bx => {
      const brazier = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.25, 2.2, 6), obsidianMat);
      brazier.position.set(bx, 1.1, 0.8);
      group.add(brazier);

      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.95, 6), flameMat);
      flame.position.set(bx, 2.55, 0.8);
      group.add(flame);
    });

    // Golden Vertical Beacon Pillar (QA Audit #5)
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 13.0, 8), flameMat);
    beacon.position.y = 6.5;
    group.add(beacon);

    this.addReferenceObject(group);
    this.envObjects.push(group);

    this.ancientShrine = {
      group,
      pos,
      blessingActive: false,
      blessingIndex: 0,
      blessingTimer: 0,
      cooldown: 0
    };
  }

  checkAncientShrineInteraction(player, audioEngine, ui) {
    if (!this.ancientShrine || !player) return false;
    const s = this.ancientShrine;

    if (player.position.distanceTo(s.pos) <= 4.5) {
      if (s.cooldown > 0) {
        if (ui && ui.showAnnouncement) {
          ui.showAnnouncement(`⏳ AUTEL DES ANCIENS EN COMMUNION ASTRALE (${Math.ceil(s.cooldown)}S)...`);
        }
        return true;
      }

      const blessings = [
        { name: "BÉNÉDICTION DE KOS'KANTI", desc: 'ÉNERGIE PLASMA & MUNITIONS COLONIALES RESTAURÉES AU MAXIMUM (30S)' },
        { name: 'FUREUR DE PAYA (DIEU GUERRIER)', desc: 'DÉGÂTS MÊLÉE/PLASMA +50% & RÉGÉNÉRATION +35 PV/S (30S)' },
        { name: 'SOUFFLE DE CETANU (DIEU DE LA MORT)', desc: 'AURA D\'ANNIHILATION 9M (160 DÉGÂTS/S AUX XÉNOMORPHES PROCHES)' }
      ];

      s.blessingIndex = (s.blessingIndex + 1) % blessings.length;
      const chosen = blessings[s.blessingIndex];
      s.blessingActive = true;
      s.blessingTimer = 30.0;
      s.cooldown = 35.0;

      // Immediate restoration gift from the Ancients
      player.plasmaEnergy = player.maxPlasmaEnergy || 100;
      player.m77GaussAmmo = 12;
      player.m41aGrenadeCharges = 4;
      player.seegsonBoltAmmo = 10;

      if (audioEngine && audioEngine.playAncientShrineBlessing) {
        audioEngine.playAncientShrineBlessing();
      }
      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement(`⛩️ AUTEL DES ANCIENS : ${chosen.name} — ${chosen.desc} !`);
      }
      return true;
    }
    return false;
  }

  updateAncientShrine(delta, player, horde) {
    if (!this.ancientShrine || !player) return;
    const s = this.ancientShrine;

    if (s.cooldown > 0) s.cooldown = Math.max(0, s.cooldown - delta);

    if (s.blessingActive) {
      s.blessingTimer -= delta;

      if (s.blessingIndex === 0) {
        // Kos'kanti: Infinite Plasma Energy
        player.plasmaEnergy = player.maxPlasmaEnergy || 100;
      } else if (s.blessingIndex === 1) {
        // Paya: +35 HP/s regeneration
        player.hp = Math.min(player.maxHp, player.hp + 35.0 * delta);
      } else if (s.blessingIndex === 2 && horde && horde.aliens) {
        // Cetanu: 9m Death Aura (160 dmg/s)
        for (let i = horde.aliens.length - 1; i >= 0; i--) {
          const a = horde.aliens[i];
          if (a && a.hp > 0 && a.mesh && a.mesh.position.distanceTo(player.position) <= 9.0) {
            a.hp -= 160 * delta;
            if (a.hp <= 0) {
              this.removeReferenceObject(a.mesh);
              horde.defeatAlien?.(a, { cause: 'environment-updateAncientShrine', killerFaction: 'neutral' });
            }
          }
        }
      }

      if (s.blessingTimer <= 0) {
        s.blessingActive = false;
      }
    }
  }

  /* === CHANTIER 2 (v50.0): Weyland-Yutani Coastal Defense 155mm Rail-Cannon (Aliens: Fireteam Elite) === */
  buildCoastalRailCannon() {
    const group = new THREE.Group();
    const pos = new THREE.Vector3(28, 0, -22);
    group.position.copy(pos);

    const bunkerMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7, metalness: 0.5 });
    const gunmetalMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.85, roughness: 0.25 });
    const coilMat = new THREE.MeshBasicMaterial({ color: 0x00d2ff });
    const hazardMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.4 });

    // Fortified Octagonal Bunker Platform
    const bunker = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 5.0, 1.8, 8), bunkerMat);
    bunker.position.y = 0.9;
    group.add(bunker);

    // Hazard warning ring
    const hazardRing = new THREE.Mesh(new THREE.RingGeometry(3.6, 4.4, 8), hazardMat);
    hazardRing.rotation.x = -Math.PI / 2;
    hazardRing.position.y = 1.82;
    group.add(hazardRing);

    // Rotating Turret Ring & Head
    const turretHead = new THREE.Group();
    turretHead.position.set(0, 2.2, 0);

    const housing = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.8, 3.2), gunmetalMat);
    turretHead.add(housing);

    // Twin 155mm Magnetic Accelerator Rail Barrels (8.5m long)
    const barrelGeo = new THREE.CylinderGeometry(0.24, 0.28, 8.5, 8);
    barrelGeo.rotateX(Math.PI / 2);
    [-0.55, 0.55].forEach(bx => {
      const barrel = new THREE.Mesh(barrelGeo, gunmetalMat);
      barrel.position.set(bx, 0.3, 4.2);
      turretHead.add(barrel);

      // 4 Accelerator Magnetic Coils per barrel
      for (let c = 1; c <= 4; c++) {
        const coil = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.06, 6, 12), coilMat);
        coil.position.set(bx, 0.3, c * 1.8);
        turretHead.add(coil);
      }
    });

    group.add(turretHead);

    // Diegetic Control Console Pedestal
    const consoleGroup = new THREE.Group();
    const consoleMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 1.4, 0.9),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.2 })
    );
    consoleMesh.position.set(0, 0.7, 3.8);
    consoleGroup.add(consoleMesh);

    const screenMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.8, 0.5),
      new THREE.MeshBasicMaterial({ color: 0x00d2ff, side: THREE.DoubleSide })
    );
    screenMesh.position.set(0, 1.15, 4.26);
    screenMesh.rotation.x = -0.3;
    consoleGroup.add(screenMesh);
    group.add(consoleGroup);

    // Sofia QA Audit #5: Vertical Translucent Cyan Targeting Beacon Pillar
    const beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.14, 14.0, 8),
      new THREE.MeshBasicMaterial({ color: 0x00d2ff, transparent: true, opacity: 0.75 })
    );
    beacon.position.y = 7.0;
    group.add(beacon);

    this.addReferenceObject(group);
    this.envObjects.push(group);

    this.coastalRailCannon = {
      group,
      pos,
      terminalPos: new THREE.Vector3(pos.x, 0, pos.z + 3.8),
      turretHead,
      cooldown: 0,
      targetAngle: 0
    };
  }

  checkRailCannonInteraction(player, audioEngine, ui, horde, bosses, particles) {
    if (!this.coastalRailCannon || !player) return false;
    const can = this.coastalRailCannon;

    if (player.position.distanceTo(can.terminalPos) <= 4.2) {
      if (can.cooldown > 0) {
        if (ui && ui.showAnnouncement) {
          ui.showAnnouncement(`⏳ CANON DE SIÈGE 155MM EN RECHARGE CONDENSATEUR (${Math.ceil(can.cooldown)}S)...`);
        }
        return true;
      }

      can.cooldown = 24.0;

      // Acquire target with highest density of enemies or active boss
      let targetPos = new THREE.Vector3(0, 0, 0);
      if (bosses && bosses.activeBoss && bosses.activeBoss.mesh) {
        targetPos = bosses.activeBoss.mesh.position.clone();
      } else if (horde && horde.aliens && horde.aliens.length > 0) {
        let maxCluster = 0;
        horde.aliens.forEach(a => {
          if (!a || a.hp <= 0 || !a.mesh) return;
          let count = 0;
          horde.aliens.forEach(other => {
            if (other && other.mesh && a.mesh.position.distanceTo(other.mesh.position) <= 8.0) count++;
          });
          if (count > maxCluster) {
            maxCluster = count;
            targetPos = a.mesh.position.clone();
          }
        });
      }

      // Rotate turret towards target
      const toTarget = targetPos.clone().sub(can.pos);
      can.targetAngle = Math.atan2(toTarget.x, toTarget.z);
      can.turretHead.rotation.y = can.targetAngle;

      if (audioEngine && audioEngine.playWY155mmRailCannonFire) {
        audioEngine.playWY155mmRailCannonFire();
      }

      // Spawn massive 155mm depleted-uranium rail projectile
      const shellGeo = new THREE.CylinderGeometry(0.26, 0.32, 2.2, 8);
      shellGeo.rotateX(Math.PI / 2);
      const shellMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
      const shellMesh = new THREE.Mesh(shellGeo, shellMat);
      shellMesh.position.copy(can.pos).add(new THREE.Vector3(0, 2.5, 0));
      shellMesh.lookAt(targetPos);
      this.addReferenceObject(shellMesh);

      const shellDir = targetPos.clone().sub(shellMesh.position).normalize();
      this.activeRailShells.push({
        mesh: shellMesh,
        direction: shellDir,
        targetPos: targetPos.clone(),
        speed: 95.0,
        life: 2.5,
        radius: 12.0,
        damage: 1800
      });

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement('💥 CANON DE SIÈGE WEYLAND-YUTANI 155MM DÉCLENCHÉ : OBUS CHARGÉ EN URANIUM APPAUVRI !');
      }
      return true;
    }
    return false;
  }

  updateCoastalRailCannon(delta, horde, bosses, audioEngine, particles) {
    if (!this.coastalRailCannon) return;
    const can = this.coastalRailCannon;
    if (can.cooldown > 0) can.cooldown = Math.max(0, can.cooldown - delta);

    for (let i = this.activeRailShells.length - 1; i >= 0; i--) {
      const s = this.activeRailShells[i];
      s.life -= delta;
      s.mesh.position.addScaledVector(s.direction, s.speed * delta);

      if (particles && particles.emitSparks && this.random() < 0.4) {
        particles.emitSparks(s.mesh.position, 3);
      }

      const distToTarget = s.mesh.position.distanceTo(s.targetPos);
      if (distToTarget <= 3.5 || s.mesh.position.y <= 0.2 || s.life <= 0) {
        const impactPos = s.mesh.position.clone();
        impactPos.y = 0.2;
        this.removeReferenceObject(s.mesh);
        this.activeRailShells.splice(i, 1);

        if (particles && particles.emitSparks) particles.emitSparks(impactPos, 35);
        if (particles && particles.spawnPlasmaScorch) particles.spawnPlasmaScorch(impactPos);

        // Crater explosion visual shockwave
        const craterGeo = new THREE.RingGeometry(1.2, s.radius, 32);
        craterGeo.rotateX(-Math.PI / 2);
        const craterMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
        const craterMesh = new THREE.Mesh(craterGeo, craterMat);
        craterMesh.position.copy(impactPos);
        this.addReferenceObject(craterMesh);

        let cScale = 1.0;
        const cInterval = this.referenceEvery(() => {
          cScale += 0.25;
          craterMesh.scale.set(cScale, 1, cScale);
          craterMat.opacity -= 0.08;
          if (craterMat.opacity <= 0) {
            this.cancelReferenceTimer(cInterval);
            this.removeReferenceObject(craterMesh);
          }
        }, 25);

        // Heavy crater blast damage
        if (horde && horde.aliens) {
          for (let j = horde.aliens.length - 1; j >= 0; j--) {
            const a = horde.aliens[j];
            if (!a || a.hp <= 0 || !a.mesh) continue;
            const d = a.mesh.position.distanceTo(impactPos);
            if (d <= s.radius) {
              a.hp -= s.damage;
              a.isFrontalShielded = false; // Shatters Crusher/Raven shields!
              if (a.hp <= 0) {
                if (horde.goreEngine) horde.goreEngine.spawnDismemberment(a.mesh.position, 'heavy');
                horde.spawnAcidPool(a.mesh.position);
                this.removeReferenceObject(a.mesh);
                horde.defeatAlien?.(a, { cause: 'environment-updateCoastalRailCannon', killerFaction: 'neutral' });
              }
            }
          }
        }

        if (bosses && bosses.activeBoss && bosses.activeBoss.mesh) {
          if (bosses.activeBoss.mesh.position.distanceTo(impactPos) <= s.radius + 3.0) {
            bosses.takeDamage(s.damage * 0.85, horde);
          }
        }
      }
    }
  }

  /* === CHANTIER 4 (v50.0): Weyland-Yutani Cryo-Stasis Research Laboratory Sector & Breakable Specimen Pods === */
  buildCryoStasisSector() {
    const group = new THREE.Group();
    const pos = new THREE.Vector3(-18, 0, -28);
    group.position.copy(pos);

    const metalMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.9, roughness: 0.2 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.45, roughness: 0.1 });
    const mistMat = new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.7 });

    // Raised laboratory platform
    const platform = new THREE.Mesh(new THREE.BoxGeometry(14, 0.6, 8), metalMat);
    platform.position.y = 0.3;
    group.add(platform);

    // 3 Cylindrical Cryo-Stasis Pods
    const pods = [];
    [-4.5, 0, 4.5].forEach((px, idx) => {
      const podGroup = new THREE.Group();
      podGroup.position.set(px, 0.6, 0);

      // Base & Top Ring
      const ringGeo = new THREE.CylinderGeometry(1.2, 1.3, 0.5, 12);
      const baseMesh = new THREE.Mesh(ringGeo, metalMat);
      baseMesh.position.y = 0.25;
      podGroup.add(baseMesh);

      const topMesh = new THREE.Mesh(ringGeo, metalMat);
      topMesh.position.y = 3.65;
      podGroup.add(topMesh);

      // Glass Cylinder
      const glass = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 3.0, 12), glassMat);
      glass.position.y = 1.95;
      podGroup.add(glass);

      // Glowing cryo mist core
      const mistCore = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 2.6, 8), mistMat);
      mistCore.position.y = 1.95;
      podGroup.add(mistCore);

      group.add(podGroup);
      pods.push({ mesh: podGroup, glass, mistCore, isBroken: false });
    });

    // Console Breaker Pedestal
    const consolePedestal = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.3, 0.8), metalMat);
    consolePedestal.position.set(0, 0.95, 2.8);
    group.add(consolePedestal);

    // Sofia QA Audit #5: Vertical Translucent Ice-Blue Beacon Pillar
    const beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.14, 14.0, 8),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.75 })
    );
    beacon.position.y = 7.0;
    group.add(beacon);

    this.addReferenceObject(group);
    this.envObjects.push(group);

    this.cryoStasisSector = {
      group,
      pos,
      consolePos: new THREE.Vector3(pos.x, 0, pos.z + 2.8),
      pods,
      cooldown: 0,
      freezePulseTimer: 0
    };
  }

  checkCryoPodInteraction(player, audioEngine, ui, horde, bosses, particles) {
    if (!this.cryoStasisSector || !player) return false;
    const sec = this.cryoStasisSector;

    if (player.position.distanceTo(sec.consolePos) <= 4.2) {
      if (sec.cooldown > 0) {
        if (ui && ui.showAnnouncement) {
          ui.showAnnouncement(`⏳ LABORATOIRE CRYO-STASE EN REPRESSURISATION (${Math.ceil(sec.cooldown)}S)...`);
        }
        return true;
      }

      sec.cooldown = 28.0;

      if (audioEngine && audioEngine.playCryoStasisPodShatter) {
        audioEngine.playCryoStasisPodShatter();
      }

      // Flash cryo-mist explosion particles
      if (particles && particles.emitSparks) {
        particles.emitSparks(sec.pos, 30);
      }

      // Freeze all Xenomorphs in 15m radius for 6.0 seconds
      const freezeRadius = 15.0;
      let frozenCount = 0;

      if (horde && horde.aliens) {
        for (let i = horde.aliens.length - 1; i >= 0; i--) {
          const a = horde.aliens[i];
          if (!a || a.hp <= 0 || !a.mesh) continue;
          if (a.mesh.position.distanceTo(sec.pos) <= freezeRadius) {
            a.isStunned = true;
            a.stunTimer = Math.max(a.stunTimer || 0, 6.0);
            a.hp -= 240;
            frozenCount++;
            if (a.mesh.material && a.mesh.material.color) {
              a.mesh.material.color.setHex(0x67e8f9); // Ice blue frozen tint
            }
          }
        }
      }

      // Cleanse acid pools in the laboratory
      if (horde && horde.acidPools) {
        for (let i = horde.acidPools.length - 1; i >= 0; i--) {
          if (horde.acidPools[i].mesh.position.distanceTo(sec.pos) <= freezeRadius) {
            this.removeReferenceObject(horde.acidPools[i].mesh);
            horde.acidPools.splice(i, 1);
          }
        }
      }

      // Antiseptic nitrogen heal for Yautja (+200 HP)
      player.hp = Math.min(player.maxHp, player.hp + 200);

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement(`❄️ BRIS CRYO-STASE WEYLAND-YUTANI : DÉLESTAGE AZOTE LIQUIDE 15M (${frozenCount} XÉNOS CONGELÉS 6S, SOIN 200 PV) !`);
      }
      return true;
    }
    return false;
  }

  updateCryoStasisSector(delta, player, horde, particles) {
    if (!this.cryoStasisSector) return;
    const sec = this.cryoStasisSector;
    if (sec.cooldown > 0) sec.cooldown = Math.max(0, sec.cooldown - delta);

    // Subtle breathing pulse of cryo mist cores
    sec.pods.forEach((p, idx) => {
      const pulse = 1.0 + Math.sin((this.referenceTime * 1000) * 0.003 + idx) * 0.08;
      p.mistCore.scale.set(pulse, 1, pulse);
    });
  }

  /* === CHANTIER 7 (v51.0): Pressurized Acid Geysers & Eruptive Fumaroles (Alien 3 / AVP Extinction) === */
  buildPressurizedAcidGeysers() {
    const geyserPositions = [
      { x: -14, z: 16 },
      { x: -18, z: 6 },
      { x: 14, z: 12 },
      { x: 18, z: 22 },
      { x: -8, z: -18 },
      { x: 8, z: -24 }
    ];

    const grateMat = new THREE.MeshStandardMaterial({
      color: 0x1f2937,
      metalness: 0.9,
      roughness: 0.2
    });

    const acidCoreMat = new THREE.MeshBasicMaterial({
      color: 0x39ff14,
      transparent: true,
      opacity: 0.75
    });

    geyserPositions.forEach(p => {
      const group = new THREE.Group();
      const pos = new THREE.Vector3(p.x, 0, p.z);
      group.position.copy(pos);

      // Heavy industrial circular rim
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.4, 0.35, 12), grateMat);
      rim.position.y = 0.18;
      group.add(rim);

      // Crossbars grating
      const barGeo = new THREE.BoxGeometry(2.4, 0.1, 0.12);
      for (let b = 0; b < 4; b++) {
        const bar = new THREE.Mesh(barGeo, grateMat);
        bar.position.y = 0.34;
        bar.rotation.y = (b / 4) * Math.PI;
        group.add(bar);
      }

      // Toxic Acid Core Pool inside
      const pool = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.1, 12), acidCoreMat);
      pool.position.y = 0.12;
      group.add(pool);

      this.addReferenceObject(group);
      this.pressurizedAcidGeysers.push({
        group,
        pos,
        pool,
        isErupting: false,
        eruptTimer: 0,
        cooldown: 2.0 + this.random() * 5.0
      });
    });
  }

  updatePressurizedAcidGeysers(delta, player, horde, bosses, audioEngine, particles) {
    if (!this.pressurizedAcidGeysers) return;

    this.pressurizedAcidGeysers.forEach(g => {
      if (g.isErupting) {
        g.eruptTimer -= delta;

        // Boiling green pulse
        g.pool.scale.set(1.0 + Math.sin((this.referenceTime * 1000) * 0.02) * 0.2, 1, 1.0 + Math.cos((this.referenceTime * 1000) * 0.02) * 0.2);

        // Acid Steam Damage in 3.6m radius
        const radius = 3.6;

        if (player && player.position.distanceTo(g.pos) <= radius) {
          if (!player.isCloaked && !player.isShadowDashing) {
            player.takeDamage(22 * delta, true);
          }
        }

        if (horde && horde.aliens) {
          for (let i = horde.aliens.length - 1; i >= 0; i--) {
            const a = horde.aliens[i];
            if (!a || a.hp <= 0 || !a.mesh) continue;
            if (a.mesh.position.distanceTo(g.pos) <= radius) {
              a.hp -= 340 * delta;
              if (a.hp <= 0) {
                if (horde.goreEngine) horde.goreEngine.spawnDismemberment(a.mesh.position, 'acid');
                this.removeReferenceObject(a.mesh);
                horde.defeatAlien?.(a, { cause: 'environment-updatePressurizedAcidGeysers', killerFaction: 'neutral' });
              }
            }
          }
        }

        if (bosses && bosses.activeBoss && bosses.activeBoss.mesh) {
          if (bosses.activeBoss.mesh.position.distanceTo(g.pos) <= radius + 1.5) {
            bosses.takeDamage(240 * delta, horde);
          }
        }

        if (g.eruptTimer <= 0) {
          g.isErupting = false;
          g.cooldown = 6.0 + this.random() * 6.0;
        }
      } else {
        g.cooldown -= delta;

        // Proximity trigger (2.6m) or random eruption
        const isNearPlayer = player && player.position.distanceTo(g.pos) <= 2.6;
        let isNearAlien = false;
        if (horde && horde.aliens) {
          for (const a of horde.aliens) {
            if (a && a.mesh && a.mesh.position.distanceTo(g.pos) <= 2.6) {
              isNearAlien = true;
              break;
            }
          }
        }

        if (g.cooldown <= 0 || ((isNearPlayer || isNearAlien) && g.cooldown <= 2.0)) {
          g.isErupting = true;
          g.eruptTimer = 3.2;
          if (audioEngine && audioEngine.playAcidTrenchSteamHiss) {
            audioEngine.playAcidTrenchSteamHiss();
          }
          if (particles && particles.emitSparks) {
            particles.emitSparks(g.pos, 16);
          }
        }
      }
    });
  }

  /* === CHANTIER 10 (v51.0): Sacred Engineer Stasis Crypt Sarcophagus (Prometheus 2012) === */
  buildEngineerSarcophagus() {
    const group = new THREE.Group();
    const pos = new THREE.Vector3(-26, 0, 24);
    group.position.copy(pos);

    // Biomechanical megalithic plinth
    const plinthMat = new THREE.MeshStandardMaterial({
      color: 0x181c24,
      metalness: 0.78,
      roughness: 0.32
    });
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.9, 6.8), plinthMat);
    plinth.position.y = 0.45;
    group.add(plinth);

    // Carved crypt casket
    const casketMat = new THREE.MeshStandardMaterial({
      color: 0x272e3b,
      metalness: 0.85,
      roughness: 0.25
    });
    const casket = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.4, 5.0), casketMat);
    casket.position.y = 1.4;
    group.add(casket);

    // Glowing cyan stasis crystal lid
    const lidMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 1.1,
      metalness: 0.1,
      roughness: 0.15,
      transparent: true,
      opacity: 0.82
    });
    const lid = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.25, 4.6), lidMat);
    lid.position.y = 2.15;
    group.add(lid);

    // Sculpted elephantine biomechanical relief hose on casket
    const reliefGeo = new THREE.TorusGeometry(1.0, 0.12, 6, 16, Math.PI);
    const relief = new THREE.Mesh(reliefGeo, plinthMat);
    relief.position.set(0, 2.2, 0.2);
    relief.rotation.x = Math.PI / 2;
    group.add(relief);

    this.addReferenceObject(group);
    this.engineerSarcophagus = {
      group,
      pos,
      isAwakened: false
    };
  }

  checkEngineerSarcophagusInteraction(playerPos, bosses, ui, audioEngine, particles) {
    if (!this.engineerSarcophagus || this.engineerSarcophagus.isAwakened) return false;
    const crypt = this.engineerSarcophagus;

    if (playerPos.distanceTo(crypt.pos) <= 5.2) {
      crypt.isAwakened = true;

      if (bosses) {
        bosses.spawnBoss('awakened_engineer', crypt.pos.clone().add(new THREE.Vector3(0, 0, -4.0)));
      }

      if (audioEngine && audioEngine.playEngineerAwakeningRoar) {
        audioEngine.playEngineerAwakeningRoar();
      }

      if (particles && particles.emitSparks) {
        particles.emitSparks(crypt.pos, 48);
      }

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement('🌌 CRYPTE DES INGÉNIEURS OUVERTE : LE MAÎTRE DES RUINES MALA\'KAK S\'EST ÉVEILLÉ !');
      }
      return true;
    }
    return false;
  }

  /* === CHANTIER 5 & SOFIA QA (v52.0): USCM Industrial Hydraulic Cargo Lift Elevator (Hadley's Hope) === */
  buildHydraulicCargoLift() {
    const group = new THREE.Group();
    const pos = new THREE.Vector3(0, 0, 0);
    group.position.copy(pos);

    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x1f2937,
      metalness: 0.88,
      roughness: 0.25
    });

    const hazardMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });

    // 4 Corner Steel Hydraulic Guide Columns (7m height)
    const colGeo = new THREE.CylinderGeometry(0.18, 0.18, 7.0, 8);
    const colOffsets = [
      { x: -2.3, z: -2.3 },
      { x: 2.3, z: -2.3 },
      { x: -2.3, z: 2.3 },
      { x: 2.3, z: 2.3 }
    ];

    colOffsets.forEach(c => {
      const col = new THREE.Mesh(colGeo, metalMat);
      col.position.set(c.x, 3.5, c.z);
      group.add(col);
    });

    // Hydraulic Piston Cylinder in Center
    const pistonGeo = new THREE.CylinderGeometry(0.35, 0.35, 6.0, 10);
    const piston = new THREE.Mesh(pistonGeo, metalMat);
    piston.position.set(0, 2.5, 0);
    group.add(piston);

    // Movable Platform
    const platform = new THREE.Group();
    const slabGeo = new THREE.BoxGeometry(4.6, 0.35, 4.6);
    const slab = new THREE.Mesh(slabGeo, metalMat);
    slab.position.y = 0.18;
    platform.add(slab);

    // Perimeter Hazard Warning Border
    const borderGeo = new THREE.BoxGeometry(4.8, 0.1, 0.2);
    const borderN = new THREE.Mesh(borderGeo, hazardMat);
    borderN.position.set(0, 0.36, -2.3);
    platform.add(borderN);
    const borderS = new THREE.Mesh(borderGeo, hazardMat);
    borderS.position.set(0, 0.36, 2.3);
    platform.add(borderS);

    group.add(platform);
    this.addReferenceObject(group);

    this.hydraulicCargoLift = {
      group,
      platform,
      pos,
      currentY: 0,
      targetY: 0,
      isUp: false,
      speed: 3.2
    };
  }

  checkHydraulicLiftInteraction(playerPos, player, ui, audioEngine) {
    if (!this.hydraulicCargoLift || !player) return false;
    const lift = this.hydraulicCargoLift;

    if (playerPos.distanceTo(lift.pos) <= 4.2) {
      lift.isUp = !lift.isUp;
      lift.targetY = lift.isUp ? 5.5 : 0;

      if (audioEngine && audioEngine.playHeavyHydraulicGate) {
        audioEngine.playHeavyHydraulicGate();
      }

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement(lift.isUp
          ? '🏗️ MONTE-CHARGE HYDRAULIQUE USCM : ASCENSION NIVEAU SUPÉRIEUR (+5.5M) !'
          : '🏗️ MONTE-CHARGE HYDRAULIQUE USCM : DESCENTE NIVEAU SOL !');
      }
      return true;
    }
    return false;
  }

  updateHydraulicCargoLift(delta, player) {
    if (!this.hydraulicCargoLift) return;
    const lift = this.hydraulicCargoLift;

    if (Math.abs(lift.currentY - lift.targetY) > 0.05) {
      const dir = Math.sign(lift.targetY - lift.currentY);
      lift.currentY += dir * lift.speed * delta;
      lift.platform.position.y = lift.currentY;

      // Carry player vertically if standing on the lift platform
      if (player && Math.abs(player.position.x - lift.pos.x) <= 2.3 && Math.abs(player.position.z - lift.pos.z) <= 2.3) {
        player.position.y = lift.currentY;
        if (player.mesh) player.mesh.position.y = lift.currentY;
      }
    }
  }

  /* === CHANTIER 6 (v52.0): Subterranean Infiltration Vents & Floor Hatches === */
  buildSubterraneanVents() {
    const ventLocs = [
      { x: -18, z: -14 },
      { x: 18, z: 14 },
      { x: -12, z: 22 },
      { x: 12, z: -22 }
    ];

    const grateMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      metalness: 0.95,
      roughness: 0.2
    });

    ventLocs.forEach(v => {
      const group = new THREE.Group();
      const pos = new THREE.Vector3(v.x, 0, v.z);
      group.position.copy(pos);

      const grate = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.15, 2.4), grateMat);
      grate.position.y = 0.08;
      group.add(grate);

      this.addReferenceObject(group);
      this.subterraneanVents.push({
        group,
        pos,
        cooldown: 8.0 + this.random() * 8.0
      });
    });
  }

  updateSubterraneanVents(delta, horde, particles, audioEngine) {
    if (!this.subterraneanVents) return;

    this.subterraneanVents.forEach(v => {
      v.cooldown -= delta;
      if (v.cooldown <= 0) {
        v.cooldown = 14.0 + this.random() * 10.0;
        if (particles && particles.emitSparks) {
          particles.emitSparks(v.pos, 14);
        }
        if (audioEngine && audioEngine.playAcidTrenchSteamHiss) {
          audioEngine.playAcidTrenchSteamHiss();
        }
      }
    });
  }

  /* === CHANTIER 7 (v52.0): Orbital Drop Pod Tactical Resupply (Predators 2010 Lore) === */
  spawnOrbitalDropPodResupply(targetPos, player, horde, audio, particles, ui) {
    if (audio && audio.playDropPodAtmosphericEntry) {
      audio.playDropPodAtmosphericEntry();
    }

    // Impact blast on landing
    if (particles && particles.emitSparks) {
      particles.emitSparks(targetPos, 40);
    }

    if (player) {
      player.m41aGrenadeCharges = 6;
      player.m77GaussAmmo = 12;
      player.seegsonBoltAmmo = 10;
      player.royalJellyFlasks = (player.royalJellyFlasks || 0) + 3;
      player.medicompCharges = Math.min(5, (player.medicompCharges || 0) + 2);
      player.plasmaEnergy = 100;
      player.hp = Math.min(player.maxHp, player.hp + 400);
    }

    if (ui && ui.showAnnouncement) {
      ui.showAnnouncement('📦 CAPSULE DE RAVITAILLEMENT ORBITALE LIVRÉE : MUNITIONS LOURDES, GELÉE ET SOINS DISPONIBLES !');
    }
  }

  /* === CHANTIER 5 & SOFIA QA (v53.0): Weyland-Yutani Breakable Specimen Stasis Vats & Cryo Clouds === */
  buildSpecimenStasisTanks() {
    this.stasisSpecimenTanks = [];
    const tankPositions = [
      new THREE.Vector3(-18, 0, 18),
      new THREE.Vector3(18, 0, 18),
      new THREE.Vector3(-18, 0, -18),
      new THREE.Vector3(18, 0, -18)
    ];

    const metalMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.85, roughness: 0.25 });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x0891b2,
      emissiveIntensity: 0.45,
      transparent: true,
      opacity: 0.6,
      roughness: 0.1,
      metalness: 0.1
    });
    const specimenMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5 });

    tankPositions.forEach((pos, idx) => {
      const group = new THREE.Group();
      group.position.copy(pos);

      // Steel Base Pedestal
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, 0.6, 16), metalMat);
      base.position.y = 0.3;
      group.add(base);

      // Translucent Cylindrical Cryo Glass Vat (3.2m height)
      const vat = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 3.2, 16), glassMat);
      vat.position.y = 2.2;
      group.add(vat);

      // Steel Reinforced Top Cap
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.05, 0.5, 16), metalMat);
      cap.position.y = 3.9;
      group.add(cap);

      // Floating Suspended Specimen Mesh inside (preserved Facehugger or Embryo)
      const spec = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), specimenMat);
      spec.scale.set(1.0, 1.5, 0.6);
      spec.position.y = 2.2;
      group.add(spec);

      this.addReferenceObject(group);
      this.stasisSpecimenTanks.push({
        id: idx,
        group,
        pos: pos.clone(),
        hp: 220,
        maxHp: 220,
        isShattered: false,
        specimenMesh: spec
      });
    });
  }

  checkStasisTankHits(attack, audio, particles, horde) {
    if (!this.stasisSpecimenTanks || !attack || !attack.origin) return;
    this.stasisSpecimenTanks.forEach(tank => {
      if (tank.isShattered) return;
      const dist = tank.pos.distanceTo(attack.origin);
      if (dist <= attack.radius + 1.2) {
        tank.hp -= attack.damage;
        if (particles && particles.emitSparks) {
          particles.emitSparks(tank.pos.clone().add(new THREE.Vector3(0, 2.0, 0)), 12);
        }

        if (tank.hp <= 0) {
          tank.isShattered = true;
          this.removeReferenceObject(tank.group);

          if (audio && audio.playCryoVatShatter) {
            audio.playCryoVatShatter();
          }

          if (particles && particles.emitExplosion) {
            particles.emitExplosion(tank.pos.clone().add(new THREE.Vector3(0, 1.5, 0)), 28);
          }

          // Create active cryogenic nitrogen freeze zone (lasts 6.5s)
          const cloudGeo = new THREE.CylinderGeometry(5.2, 5.2, 1.2, 16);
          const cloudMat = new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.55,
            wireframe: true
          });
          const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
          cloudMesh.position.copy(tank.pos);
          cloudMesh.position.y = 0.6;
          this.addReferenceObject(cloudMesh);

          this.activeCryoCoolantClouds.push({
            pos: tank.pos.clone(),
            mesh: cloudMesh,
            timer: 6.5,
            radius: 5.2
          });

          // Release aggressive Facehugger into horde!
          if (horde && horde.spawnFacehugger) {
            horde.spawnFacehugger(tank.pos.clone().add(new THREE.Vector3(0, 0.5, 0)));
          }
        }
      }
    });
  }

  updateStasisTanks(delta, player, horde, audio, particles) {
    // 1. Gently oscillate floating preserved specimens
    if (this.stasisSpecimenTanks) {
      this.stasisSpecimenTanks.forEach(tank => {
        if (!tank.isShattered && tank.specimenMesh) {
          tank.specimenMesh.position.y = 2.2 + Math.sin((this.referenceTime * 1000) * 0.003 + tank.id) * 0.12;
          tank.specimenMesh.rotation.y += delta * 0.5;
        }
      });
    }

    // 2. Update Cryo Freezing Clouds
    if (this.activeCryoCoolantClouds) {
      for (let i = this.activeCryoCoolantClouds.length - 1; i >= 0; i--) {
        const cloud = this.activeCryoCoolantClouds[i];
        cloud.timer -= delta;
        cloud.mesh.rotation.y += delta * 1.5;
        cloud.mesh.material.opacity = Math.max(0, (cloud.timer / 6.5) * 0.55);

        // Slow down and damage any Xenomorph inside
        if (horde && horde.aliens) {
          horde.aliens.forEach(a => {
            if (a && a.mesh && a.mesh.position.distanceTo(cloud.pos) <= cloud.radius) {
              a.isFrozen = true;
              a.hp -= 85 * delta;
              if (particles && particles.emitSparks && this.random() < 0.05) {
                particles.emitSparks(a.mesh.position, 2);
              }
            }
          });
        }

        if (cloud.timer <= 0) {
          this.removeReferenceObject(cloud.mesh);
          this.activeCryoCoolantClouds.splice(i, 1);
        }
      }
    }
  }

  /* === CHANTIER 3 & SOFIA QA (v54.0): Destructible JP-4 Fuel Barrels & Incendiary Fire Zones === */
  buildExplosiveBarrels() {
    this.explosiveBarrels = [];
    this.activeBarrelFireZones = [];

    const barrelPositions = [
      new THREE.Vector3(-24, 0, 14),
      new THREE.Vector3(-21, 0, 17),
      new THREE.Vector3(24, 0, -14),
      new THREE.Vector3(21, 0, -17),
      new THREE.Vector3(0, 0, 26),
      new THREE.Vector3(3, 0, 28),
      new THREE.Vector3(-14, 0, -26),
      new THREE.Vector3(16, 0, 22)
    ];

    barrelPositions.forEach((pos, idx) => {
      const group = new THREE.Group();
      group.position.copy(pos);

      // Main barrel cylinder (Yellow industrial Weyland-Yutani hazard drum)
      const barrelGeo = new THREE.CylinderGeometry(0.65, 0.65, 1.6, 16);
      const barrelMat = new THREE.MeshStandardMaterial({
        color: 0xdf9b00, // Industrial hazard yellow
        roughness: 0.5,
        metalness: 0.6
      });
      const barrelMesh = new THREE.Mesh(barrelGeo, barrelMat);
      barrelMesh.position.y = 0.8;
      barrelMesh.castShadow = true;
      group.add(barrelMesh);

      // Black hazard stripes band
      const stripeGeo = new THREE.CylinderGeometry(0.66, 0.66, 0.4, 16);
      const stripeMat = new THREE.MeshStandardMaterial({
        color: 0x111111,
        roughness: 0.8,
        metalness: 0.2
      });
      const stripeMesh = new THREE.Mesh(stripeGeo, stripeMat);
      stripeMesh.position.y = 0.8;
      group.add(stripeMesh);

      // Reinforcing steel ribs
      const ribGeo = new THREE.TorusGeometry(0.66, 0.04, 8, 16);
      ribGeo.rotateX(Math.PI / 2);
      const ribMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8 });
      const rib1 = new THREE.Mesh(ribGeo, ribMat);
      rib1.position.y = 0.35;
      group.add(rib1);
      const rib2 = new THREE.Mesh(ribGeo, ribMat);
      rib2.position.y = 1.25;
      group.add(rib2);

      // Red inflammable cap
      const capGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.1, 12);
      const capMat = new THREE.MeshStandardMaterial({ color: 0xcc1100, roughness: 0.4 });
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.position.set(0.25, 1.65, 0);
      group.add(cap);

      this.addReferenceObject(group);
      this.explosiveBarrels.push({
        id: idx,
        group,
        pos: pos.clone(),
        hp: 75,
        maxHp: 75,
        isDetonated: false
      });
    });
  }

  checkBarrelHits(attack, audio, particles, horde, player, synthetics) {
    if (!this.explosiveBarrels || !attack || !attack.origin) return;

    this.explosiveBarrels.forEach(barrel => {
      if (barrel.isDetonated) return;

      const barrelCenter = barrel.pos.clone().add(new THREE.Vector3(0, 0.8, 0));
      const dist = barrelCenter.distanceTo(attack.origin);
      if (dist <= (attack.radius || 1.5) + 0.9) {
        barrel.hp -= (attack.damage || 50);

        if (particles && particles.emitSparks) {
          particles.emitSparks(barrelCenter, 6);
        }

        if (barrel.hp <= 0) {
          barrel.isDetonated = true;
          this.removeReferenceObject(barrel.group);

          // Detonation sound & particles
          if (audio) {
            if (audio.playBurnerHeavyPlasmaBlast) {
              audio.playBurnerHeavyPlasmaBlast();
            } else if (audio.playM40GrenadeBlast) {
              audio.playM40GrenadeBlast();
            }
            if (audio.playAcidBrandingSizzle) {
              audio.playAcidBrandingSizzle();
            }
          }

          if (particles && particles.emitExplosion) {
            particles.emitExplosion(barrelCenter, 30);
          }

          const blastRadius = 6.5;
          const blastDamage = 650;

          // Damage Xenomorphs in radius
          if (horde && horde.aliens) {
            horde.aliens.forEach(alien => {
              if (alien && alien.mesh) {
                const d = alien.mesh.position.distanceTo(barrel.pos);
                if (d <= blastRadius) {
                  const falloff = 1 - (d / blastRadius);
                  alien.hp -= blastDamage * (0.5 + 0.5 * falloff);
                  if (particles && particles.emitAlienBloodSpurt) {
                    particles.emitAlienBloodSpurt(alien.mesh.position, 12);
                  }
                }
              }
            });
          }

          // Damage synthetics if present
          if (synthetics && Array.isArray(synthetics)) {
            synthetics.forEach(syn => {
              if (syn && syn.mesh) {
                const d = syn.mesh.position.distanceTo(barrel.pos);
                if (d <= blastRadius) {
                  syn.hp -= blastDamage * 0.8;
                }
              }
            });
          }

          // Damage player if caught in blast
          if (player && player.position) {
            const pDist = player.position.distanceTo(barrel.pos);
            if (pDist <= 5.5) {
              player.takeDamage(120 * (1 - pDist / 5.5), 'JP-4 Fuel Barrel Blast');
            }
          }

          // Spawn persistent fire puddle zone (8 seconds duration)
          const fireGeo = new THREE.CylinderGeometry(4.2, 4.2, 0.15, 24);
          const fireMat = new THREE.MeshBasicMaterial({
            color: 0xff4400,
            transparent: true,
            opacity: 0.65,
            wireframe: false
          });
          const fireMesh = new THREE.Mesh(fireGeo, fireMat);
          fireMesh.position.set(barrel.pos.x, 0.1, barrel.pos.z);
          this.addReferenceObject(fireMesh);

          this.activeBarrelFireZones.push({
            pos: barrel.pos.clone(),
            radius: 4.2,
            timer: 8.0,
            mesh: fireMesh
          });
        }
      }
    });
  }

  updateExplosiveBarrels(delta, player, horde, particles) {
    if (!this.activeBarrelFireZones) return;

    for (let i = this.activeBarrelFireZones.length - 1; i >= 0; i--) {
      const zone = this.activeBarrelFireZones[i];
      zone.timer -= delta;
      zone.mesh.rotation.y += delta * 1.8;
      zone.mesh.material.opacity = Math.max(0, (zone.timer / 8.0) * 0.65);

      // Periodic burning to horde
      if (horde && horde.aliens) {
        horde.aliens.forEach(alien => {
          if (alien && alien.mesh && alien.mesh.position.distanceTo(zone.pos) <= zone.radius) {
            alien.hp -= 95 * delta;
            if (particles && particles.emitSparks && this.random() < 0.08) {
              particles.emitSparks(alien.mesh.position, 2);
            }
          }
        });
      }

      // Burning to player if reckless
      if (player && player.position && player.position.distanceTo(zone.pos) <= zone.radius) {
        player.takeDamage(15 * delta, 'JP-4 Residual Fire Puddle');
      }

      if (zone.timer <= 0) {
        this.removeReferenceObject(zone.mesh);
        this.activeBarrelFireZones.splice(i, 1);
      }
    }
  }

  /* === CHANTIER 4 & SOFIA QA (v54.0): Weyland-Yutani Plasma Capacitor Recharge Terminals === */
  buildPlasmaRechargeTerminals() {
    this.plasmaRechargeTerminals = [];

    const terminalPositions = [
      new THREE.Vector3(-32, 0, 0),
      new THREE.Vector3(32, 0, 0)
    ];

    terminalPositions.forEach((pos, idx) => {
      const group = new THREE.Group();
      group.position.copy(pos);

      // Station Base Pillar
      const baseGeo = new THREE.BoxGeometry(2.0, 2.6, 1.4);
      const baseMat = new THREE.MeshStandardMaterial({
        color: 0x24272c, // Weyland-Yutani dark carbon alloy
        roughness: 0.35,
        metalness: 0.75
      });
      const baseMesh = new THREE.Mesh(baseGeo, baseMat);
      baseMesh.position.y = 1.3;
      baseMesh.castShadow = true;
      group.add(baseMesh);

      // Glowing high-energy plasma capacitor coils
      const coilGeo = new THREE.CylinderGeometry(0.35, 0.35, 1.6, 16);
      const coilMat = new THREE.MeshBasicMaterial({
        color: 0x00e5ff // Vibrant cyan plasma energy
      });
      const coilMesh = new THREE.Mesh(coilGeo, coilMat);
      coilMesh.position.set(0, 1.5, 0.4);
      group.add(coilMesh);

      // Upper holographic terminal screen
      const screenGeo = new THREE.BoxGeometry(1.2, 0.6, 0.08);
      const screenMat = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        wireframe: true
      });
      const screenMesh = new THREE.Mesh(screenGeo, screenMat);
      screenMesh.position.set(0, 2.4, 0.55);
      screenMesh.rotation.x = -Math.PI / 8;
      group.add(screenMesh);

      // Pulsing cyan point light
      const light = new THREE.PointLight(0x00e5ff, 1.8, 7.0);
      light.position.set(pos.x, 2.0, pos.z + 0.8);
      this.addReferenceObject(light);

      this.addReferenceObject(group);
      this.plasmaRechargeTerminals.push({
        id: idx,
        group,
        light,
        coilMesh,
        pos: pos.clone(),
        cooldown: 0,
        maxCooldown: 32.0,
        isAvailable: true
      });
    });
  }

  checkPlasmaTerminalInteraction(playerPos, player, audio, ui, particles) {
    if (!this.plasmaRechargeTerminals || !playerPos) return false;

    for (let i = 0; i < this.plasmaRechargeTerminals.length; i++) {
      const term = this.plasmaRechargeTerminals[i];
      const dist = term.pos.distanceTo(playerPos);
      if (dist <= 3.8 && term.isAvailable) {
        // Recharge plasma to 100%
        player.plasmaEnergy = player.maxPlasmaEnergy || 100;
        if (typeof player.overheatLevel !== 'undefined') player.overheatLevel = 0;

        term.isAvailable = false;
        term.cooldown = term.maxCooldown;
        term.coilMesh.material.color.setHex(0x553311); // Dim amber while cooling down
        term.light.color.setHex(0xffaa22);
        term.light.intensity = 0.5;

        if (audio) {
          if (audio.playBurnerHeavyPlasmaBlast) audio.playBurnerHeavyPlasmaBlast();
          if (audio.playWristComputerBeep) audio.playWristComputerBeep();
        }

        if (particles && particles.emitSparks) {
          particles.emitSparks(term.pos.clone().add(new THREE.Vector3(0, 1.8, 0)), 20);
        }

        if (ui && ui.showNotification) {
          ui.showNotification("⚡ WY CAPACITOR DÉCHARGÉ: RÉSERVE PLASMA 100% RESTAURÉE (CD 32s)", "success");
        }
        return true;
      }
    }
    return false;
  }

  updatePlasmaTerminals(delta) {
    if (!this.plasmaRechargeTerminals) return;

    this.plasmaRechargeTerminals.forEach(term => {
      if (!term.isAvailable) {
        term.cooldown -= delta;
        if (term.cooldown <= 0) {
          term.isAvailable = true;
          term.cooldown = 0;
          term.coilMesh.material.color.setHex(0x00e5ff); // Back to cyan
          term.light.color.setHex(0x00e5ff);
          term.light.intensity = 1.8;
        }
      } else {
        // Subtle plasma coil pulsing
        const pulse = 1.6 + Math.sin((this.referenceTime * 1000) * 0.005 + term.id) * 0.4;
        term.light.intensity = pulse;
      }
    });
  }

  /* === v54.0 Combined Environment Update Helper === */
  updateEnvironmentV54(delta, player, horde, audio, particles) {
    this.updateStasisTanks(delta, player, horde, audio, particles);
    this.updateExplosiveBarrels(delta, player, horde, particles);
    this.updatePlasmaTerminals(delta);
  }

  /* === CHANTIER 4 & SOFIA QA (v55.0): Flooded Water Puddles & Cloaking Field Disruption === */
  buildFloodedPuddles() {
    this.floodedWaterPuddles = [];

    const puddleConfigs = [
      { pos: new THREE.Vector3(-15, 0.05, -10), radius: 5.5 },
      { pos: new THREE.Vector3(18, 0.05, 12), radius: 6.2 },
      { pos: new THREE.Vector3(-8, 0.05, 24), radius: 4.8 },
      { pos: new THREE.Vector3(22, 0.05, -20), radius: 5.8 }
    ];

    puddleConfigs.forEach((cfg, idx) => {
      const geo = new THREE.CylinderGeometry(cfg.radius, cfg.radius, 0.06, 24);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x0369a1, // Murky reflective water
        roughness: 0.1,
        metalness: 0.85,
        transparent: true,
        opacity: 0.72
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(cfg.pos);
      this.addReferenceObject(mesh);

      this.floodedWaterPuddles.push({
        id: idx,
        pos: cfg.pos.clone(),
        radius: cfg.radius,
        mesh
      });
    });
  }

  updateFloodedPuddles(delta, player, audio, particles, ui) {
    if (!this.floodedWaterPuddles || !player || !player.position) return;

    let isInAnyWater = false;

    for (let i = 0; i < this.floodedWaterPuddles.length; i++) {
      const puddle = this.floodedWaterPuddles[i];
      const dist = player.position.distanceTo(puddle.pos);

      // Water surface gentle shimmer
      puddle.mesh.rotation.y += delta * 0.2;

      if (dist <= puddle.radius) {
        isInAnyWater = true;

        if (player.isCloaked && player.triggerWaterCloakDisruption) {
          player.triggerWaterCloakDisruption(audio, particles, ui);
        }

        if (player.isMoving && particles && particles.emitSparks && this.random() < 0.1) {
          particles.emitSparks(player.position.clone().add(new THREE.Vector3(0, 0.1, 0)), 3);
        }
        break;
      }
    }

    player.isWaterSubmerged = isInAnyWater;
  }

  /* === v55.0 Combined Environment Update Helper === */
  updateEnvironmentV55(delta, player, horde, audio, particles, ui) {
    this.updateEnvironmentV54(delta, player, horde, audio, particles);
    this.updateFloodedPuddles(delta, player, audio, particles, ui);
  }

  /* === CHANTIER 1 & SOFIA LEVEL DESIGN (v56.0): Crashed Yautja Scout Ship Wreckage (AVP: Requiem 2007) === */
  buildCrashedScoutShipProps() {
    const group = new THREE.Group();
    const pos = new THREE.Vector3(-20, 0, 18);
    group.position.copy(pos);

    // Yautja Starship Gunmetal Hull Alloy
    const hullMat = new THREE.MeshStandardMaterial({
      color: 0x1f262e,
      roughness: 0.35,
      metalness: 0.88
    });
    const runeMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
    const dirtMat = new THREE.MeshStandardMaterial({ color: 0x1e150f, roughness: 0.95 });

    // 1. Crater Excavation Rim
    const crater = new THREE.Mesh(new THREE.TorusGeometry(12.0, 1.8, 8, 24), dirtMat);
    crater.rotation.x = Math.PI / 2;
    crater.position.y = 0.2;
    group.add(crater);

    // 2. Main Saucer Hull Fragment (Embedded at 22-degree tilt)
    const hullGroup = new THREE.Group();
    hullGroup.rotation.z = 0.38; // Tilted into earth
    hullGroup.rotation.y = -Math.PI / 4;

    const mainHull = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 8.5, 3.2, 16), hullMat);
    mainHull.position.y = 2.5;
    mainHull.castShadow = true;
    hullGroup.add(mainHull);

    // Conical Forward Prow
    const prow = new THREE.Mesh(new THREE.ConeGeometry(5.5, 6.0, 8), hullMat);
    prow.rotation.x = Math.PI / 2;
    prow.position.set(0, 2.5, 6.5);
    hullGroup.add(prow);

    // Glowing Yautja Telemetry Runes along hull flanks
    [-1, 1].forEach(side => {
      const runeStrip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 6.0), runeMat);
      runeStrip.position.set(side * 6.8, 2.5, 1.0);
      hullGroup.add(runeStrip);
    });

    group.add(hullGroup);

    // 3. Elevated Sniper Observation Deck (+5.8m high with access ramp)
    const deckMat = new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.9, roughness: 0.3 });
    const deckMesh = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.4, 4.5), deckMat);
    deckMesh.position.set(2.0, 5.8, -1.0);
    deckMesh.receiveShadow = true;
    group.add(deckMesh);

    // Access Ramp
    const rampMesh = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.3, 7.5), deckMat);
    rampMesh.position.set(2.0, 2.9, 4.2);
    rampMesh.rotation.x = 0.72;
    group.add(rampMesh);

    // 4. Ship Telemetry Orbital Scan Console
    const consoleGeo = new THREE.BoxGeometry(1.2, 1.2, 0.8);
    const consoleMat = new THREE.MeshStandardMaterial({ color: 0x090d16, metalness: 0.9 });
    const consoleMesh = new THREE.Mesh(consoleGeo, consoleMat);
    consoleMesh.position.set(2.0, 6.6, -2.5);
    group.add(consoleMesh);

    const holoSpyGeo = new THREE.SphereGeometry(0.4, 8, 8);
    const holoSpy = new THREE.Mesh(holoSpyGeo, runeMat);
    holoSpy.position.set(2.0, 7.5, -2.5);
    group.add(holoSpy);

    // Pulsing cyan point light
    const shipLight = new THREE.PointLight(0x00e5ff, 1.8, 9.0);
    shipLight.position.set(pos.x + 2.0, 7.0, pos.z - 2.5);
    this.addReferenceObject(shipLight);

    // Shattered Facehugger Stasis Vials strewn about
    const glassMat = new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.4 });
    for (let v = 0; v < 4; v++) {
      const vial = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1.2, 8), glassMat);
      vial.rotation.z = Math.PI / 2.2;
      vial.position.set(-6.0 + v * 3.5, 0.3, -5.0 + (v % 2) * 3.0);
      group.add(vial);
    }

    this.addReferenceObject(group);
    this.envObjects.push(group);

    this.crashedScoutShip = {
      group,
      pos: pos.clone(),
      consolePos: pos.clone().add(new THREE.Vector3(2.0, 5.8, -2.5)),
      light: shipLight,
      holoMesh: holoSpy,
      isScanActive: false,
      scanCooldown: 0
    };
  }

  checkScoutShipConsoleInteraction(playerPos, ui, audio, horde, player) {
    if (!this.crashedScoutShip || !playerPos) return false;
    const s = this.crashedScoutShip;
    if (s.consolePos.distanceTo(playerPos) <= 4.2) {
      if (s.scanCooldown > 0) {
        if (ui && ui.showAnnouncement) {
          ui.showAnnouncement(`⏳ SCANNER DU VAISSEAU EN RECHARGE (${Math.ceil(s.scanCooldown)}S)`);
        }
        return true;
      }
      s.scanCooldown = 35.0;
      if (audio) {
        if (audio.playScoutShipOrbitalPing) audio.playScoutShipOrbitalPing();
        else if (audio.playWristComputerBeep) audio.playWristComputerBeep();
      }

      if (player) {
        player.orbitalScanTimer = 25.0;
        player.critChanceBonus = 0.25;
      }

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement("🛰️ TÉLÉMÉTRIE VAISSEAU CRASHÉ : SCAN ORBITAL CONFIRMÉ (+25% CRITIQUES, DÉTECTION ÉTENDUE 25S) !", "success");
      }
      return true;
    }
    return false;
  }

  /* === CHANTIER 2 & SOFIA LEVEL DESIGN (v56.0): Base Charon Genetic Incubators & Pheromone Console (Aliens: Rogue) === */
  buildCharonGeneticsLabProps() {
    const group = new THREE.Group();
    const pos = new THREE.Vector3(-24, 0, -12);
    group.position.copy(pos);

    const metalMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.85, roughness: 0.25 });
    const brothMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      roughness: 0.1,
      metalness: 0.5,
      transparent: true,
      opacity: 0.65
    });
    const embryoMat = new THREE.MeshStandardMaterial({ color: 0x064e3b, roughness: 0.5 });

    // 4 Gigantic Glass Genetic Incubator Cylinders
    const vatPositions = [
      new THREE.Vector3(-5, 0, -4),
      new THREE.Vector3(5, 0, -4),
      new THREE.Vector3(-5, 0, 4),
      new THREE.Vector3(5, 0, 4)
    ];

    const vats = [];
    vatPositions.forEach((vPos, idx) => {
      const vatGroup = new THREE.Group();
      vatGroup.position.copy(vPos);

      // Metal Base & Top Caps
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, 0.8, 16), metalMat);
      base.position.y = 0.4;
      vatGroup.add(base);

      const topCap = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.6, 16), metalMat);
      topCap.position.y = 5.2;
      vatGroup.add(topCap);

      // Mutagen Broth Fluid Column
      const broth = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 4.4, 16), brothMat);
      broth.position.y = 2.8;
      vatGroup.add(broth);

      // Suspended Rogue King Embryo Silhouette
      const embryo = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 8), embryoMat);
      embryo.scale.set(1.0, 1.6, 1.0);
      embryo.position.y = 2.8;
      vatGroup.add(embryo);

      group.add(vatGroup);
      vats.push({ group: vatGroup, embryo, broth, pos: pos.clone().add(vPos) });
    });

    // Central Diagnostic Holographic Console (Dr. Ernst Kleist)
    const consolePillar = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 1.6), metalMat);
    consolePillar.position.set(0, 0.6, 0);
    group.add(consolePillar);

    const dnaHoloMat = new THREE.MeshBasicMaterial({ color: 0x34d399, wireframe: true });
    const dnaHolo = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.8, 8), dnaHoloMat);
    dnaHolo.position.set(0, 2.1, 0);
    group.add(dnaHolo);

    const labLight = new THREE.PointLight(0x10b981, 1.6, 8.0);
    labLight.position.set(pos.x, 2.5, pos.z);
    this.addReferenceObject(labLight);

    this.addReferenceObject(group);
    this.envObjects.push(group);

    this.charonGeneticsLab = {
      group,
      pos: pos.clone(),
      consolePos: pos.clone().add(new THREE.Vector3(0, 0, 0)),
      vats,
      dnaHolo,
      light: labLight,
      pheromoneCooldown: 0
    };
  }

  checkCharonLabConsoleInteraction(playerPos, horde, ui, audio) {
    if (!this.charonGeneticsLab || !playerPos) return false;
    const lab = this.charonGeneticsLab;
    if (lab.consolePos.distanceTo(playerPos) <= 4.2) {
      if (lab.pheromoneCooldown > 0) {
        if (ui && ui.showAnnouncement) {
          ui.showAnnouncement(`⏳ DIFFUSEUR DE PHÉROMONES EN CHARGE (${Math.ceil(lab.pheromoneCooldown)}S)`);
        }
        return true;
      }
      lab.pheromoneCooldown = 38.0;

      if (audio) {
        if (audio.playCharonPheromoneHiss) audio.playCharonPheromoneHiss();
        else if (audio.playAlienQueenPheromoneHiss) audio.playAlienQueenPheromoneHiss();
      }

      // Cause minor aliens in 24m to frenzy and damage each other
      let frenzied = 0;
      if (horde && horde.aliens) {
        horde.aliens.forEach(alien => {
          if (alien && alien.mesh && alien.mesh.position.distanceTo(lab.pos) <= 24.0) {
            alien.hp -= 160;
            alien.isStunned = true;
            alien.stunTimer = 4.0;
            frenzied++;
          }
        });
      }

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement(`🧬 PHÉROMONES DU DR KLEIST LIBÉRÉES : ${frenzied} XÉNOS FRAPPÉS DE DÉMENCE (STUN 4S, 160 DMG) !`, "warning");
      }
      return true;
    }
    return false;
  }

  /* === CHANTIER 3 & SOFIA LEVEL DESIGN (v56.0): Mr. Black Game Preserve Camp & Crucified Totem (Predators 2010) === */
  buildGamePreserveProps() {
    const group = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x3f2212, roughness: 0.95 });
    const boneMat = new THREE.MeshStandardMaterial({ color: 0xd6cebe, roughness: 0.5 });
    const armorMat = new THREE.MeshStandardMaterial({ color: 0x1f2421, metalness: 0.8, roughness: 0.35 });

    // 1. Centerpiece Crucified Classic Predator Totem Pole [0, 0, 0]
    const centerGroup = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 7.5, 8), woodMat);
    post.position.y = 3.75;
    post.castShadow = true;
    centerGroup.add(post);

    const crossbeam = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 4.2, 8), woodMat);
    crossbeam.rotation.z = Math.PI / 2;
    crossbeam.position.y = 5.2;
    centerGroup.add(crossbeam);

    // Bound Classic Jungle Hunter Armored Torso
    const boundTorso = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.4, 0.6), armorMat);
    boundTorso.position.set(0, 4.6, 0.35);
    centerGroup.add(boundTorso);

    const boundMask = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.5), armorMat);
    boundMask.position.set(0, 5.5, 0.4);
    centerGroup.add(boundMask);

    group.add(centerGroup);

    // 2. Flayed Carcasses on Tripod Stakes
    const tripodPositions = [
      new THREE.Vector3(-22, 0, -18),
      new THREE.Vector3(22, 0, 18),
      new THREE.Vector3(-18, 0, 22),
      new THREE.Vector3(22, 0, -18)
    ];

    tripodPositions.forEach(tPos => {
      const tripodGroup = new THREE.Group();
      tripodGroup.position.copy(tPos);

      // 3 crossing timber spars
      for (let s = 0; s < 3; s++) {
        const spar = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 5.8, 6), woodMat);
        const a = (s / 3) * Math.PI * 2;
        spar.position.set(Math.cos(a) * 0.8, 2.7, Math.sin(a) * 0.8);
        spar.rotation.set(Math.sin(a) * 0.28, 0, -Math.cos(a) * 0.28);
        tripodGroup.add(spar);
      }

      // Dangling flayed victim silhouette
      const carcass = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.15, 2.0, 6), boneMat);
      carcass.position.set(0, 2.2, 0);
      tripodGroup.add(carcass);

      group.add(tripodGroup);
    });

    // 3. Spiked Skull Perimeter Boundary Stakes
    for (let k = 0; k < 12; k++) {
      const angle = (k / 12) * Math.PI * 2;
      const dist = 32 + (k % 3) * 6.0;
      const stakeX = Math.cos(angle) * dist;
      const stakeZ = Math.sin(angle) * dist;

      const stake = new THREE.Mesh(new THREE.ConeGeometry(0.18, 3.2, 6), woodMat);
      stake.position.set(stakeX, 1.6, stakeZ);
      stake.rotation.x = (this.random() - 0.5) * 0.2;
      stake.rotation.z = (this.random() - 0.5) * 0.2;
      group.add(stake);

      const skull = new THREE.Mesh(new THREE.SphereGeometry(0.35, 6, 6), boneMat);
      skull.position.set(stakeX, 3.1, stakeZ);
      group.add(skull);
    }

    this.addReferenceObject(group);
    this.envObjects.push(group);

    this.gamePreserveCamp = {
      group,
      totemPos: new THREE.Vector3(0, 0, 0),
      isReleased: false,
      centerGroup,
      boundTorso,
      boundMask
    };
  }

  checkCrucifiedPredatorInteraction(player, ui, audio, particles) {
    if (!this.gamePreserveCamp || !player || this.gamePreserveCamp.isReleased) return false;
    const playerPos = player.position;
    if (!playerPos) return false;
    const dist = playerPos.distanceTo(this.gamePreserveCamp.totemPos);
    if (dist <= 4.8) {
      this.gamePreserveCamp.isReleased = true;
      if (this.gamePreserveCamp.boundTorso) {
        this.gamePreserveCamp.boundTorso.rotation.x = Math.PI / 6;
        this.gamePreserveCamp.boundTorso.position.y = 2.2;
      }
      if (this.gamePreserveCamp.boundMask) {
        this.gamePreserveCamp.boundMask.position.y = 3.0;
      }

      if (audio) {
        if (audio.playCrucifiedPredatorRelease) audio.playCrucifiedPredatorRelease();
        else if (audio.playPredatorChestThumpRoar) audio.playPredatorChestThumpRoar();
      }

      if (particles && particles.emitAlienBloodSpurt) {
        particles.emitAlienBloodSpurt(new THREE.Vector3(0, 4.5, 0.4), 22);
      }

      if (player.unlockClassic1987Plasma) {
        player.unlockClassic1987Plasma();
      }
      if (player.recordTrophy) {
        player.recordTrophy('Dague Cérémonielle & Gratitude du Classic Jungle Hunter Crucifié (Predators 2010)', 2500);
      }
      player.royalJellyFlasks = (player.royalJellyFlasks || 0) + 3;

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement('⚜️ RITUEL D\'HONNEUR : CLASSIC PREDATOR LIBÉRÉ (PREDATORS 2010) ! CANON PLASMA 1987 DOUBLE-BURST OCTROYÉ (+2500 HONNEUR, +3 GELÉES) !', 'success');
      }
      return true;
    }
    return false;
  }

  /* === CHANTIER 5 & SOFIA LEVEL DESIGN (v56.0): Fixed UA 571-C Automated Sentry Tripods (Aliens 1986) === */
  buildFixedSentryEmplacements() {
    this.fixedSentryEmplacements = [];

    const sentryPositions = [
      new THREE.Vector3(-28, 0, 0),
      new THREE.Vector3(28, 0, 0)
    ];

    const metalMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.85, roughness: 0.3 });
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.95, roughness: 0.15 });
    const drumMat = new THREE.MeshStandardMaterial({ color: 0x166534, metalness: 0.6 });
    const laserMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });

    sentryPositions.forEach((pos, idx) => {
      const group = new THREE.Group();
      group.position.copy(pos);

      // Heavy Ballistic Tripod (3 splayed legs)
      for (let leg = 0; leg < 3; leg++) {
        const legAngle = (leg / 3) * Math.PI * 2;
        const legMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.8, 6), metalMat);
        legMesh.position.set(Math.cos(legAngle) * 0.65, 0.75, Math.sin(legAngle) * 0.65);
        legMesh.rotation.set(Math.sin(legAngle) * 0.5, 0, -Math.cos(legAngle) * 0.5);
        group.add(legMesh);
      }

      // Swiveling Turret Head Group
      const turretHead = new THREE.Group();
      turretHead.position.y = 1.5;

      const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.45, 1.0), metalMat);
      turretHead.add(receiver);

      // Dual 10mm M40 Barrels
      [-0.14, 0.14].forEach(bx => {
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.4, 8), barrelMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(bx, 0.05, 0.85);
        turretHead.add(barrel);
      });

      // 500-Round Drum Magazine
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.3, 12), drumMat);
      drum.position.set(0.35, -0.1, -0.15);
      turretHead.add(drum);

      // Targeting Laser Diode
      const laserDiode = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), laserMat);
      laserDiode.position.set(0, 0.25, 0.5);
      turretHead.add(laserDiode);

      group.add(turretHead);
      this.addReferenceObject(group);
      this.envObjects.push(group);

      this.fixedSentryEmplacements.push({
        id: idx,
        group,
        turretHead,
        pos: pos.clone(),
        ammo: 250,
        maxAmmo: 250,
        isOnline: true,
        shootCooldown: 0,
        range: 28.0,
        target: null
      });
    });
  }

  updateFixedSentries(delta, horde, audio, particles) {
    if (!this.fixedSentryEmplacements) return;

    this.fixedSentryEmplacements.forEach(sentry => {
      if (!sentry.isOnline || sentry.ammo <= 0) return;

      sentry.shootCooldown -= delta;

      // Find nearest target within range
      let nearestAlien = null;
      let minDist = sentry.range;

      if (horde && horde.aliens) {
        horde.aliens.forEach(alien => {
          if (alien && alien.mesh && alien.hp > 0) {
            const d = sentry.pos.distanceTo(alien.mesh.position);
            if (d < minDist) {
              minDist = d;
              nearestAlien = alien;
            }
          }
        });
      }

      if (nearestAlien) {
        const toAlien = nearestAlien.mesh.position.clone().sub(sentry.pos);
        sentry.turretHead.rotation.y = Math.atan2(toAlien.x, toAlien.z);

        if (sentry.shootCooldown <= 0) {
          sentry.shootCooldown = 0.18; // High rate of fire
          sentry.ammo = Math.max(0, sentry.ammo - 2);

          if (audio) {
            if (audio.playFixedSentryBurst) audio.playFixedSentryBurst();
            else if (audio.playPulseRifleBurst && this.random() < 0.35) audio.playPulseRifleBurst();
          }

          nearestAlien.hp -= 48;

          if (particles && particles.emitSparks) {
            particles.emitSparks(nearestAlien.mesh.position, 4);
          }
        }
      }
    });
  }

  checkFixedSentryInteraction(playerPos, audio, ui) {
    if (!this.fixedSentryEmplacements) return false;

    for (let i = 0; i < this.fixedSentryEmplacements.length; i++) {
      const s = this.fixedSentryEmplacements[i];
      if (s.pos.distanceTo(playerPos) <= 3.8) {
        s.ammo = s.maxAmmo;
        s.isOnline = true;
        if (audio) {
          if (audio.playFixedSentryReload) audio.playFixedSentryReload();
          else if (audio.playPulseRifleBurst) audio.playPulseRifleBurst();
        }
        if (ui && ui.showAnnouncement) {
          ui.showAnnouncement('🔋 SENTINELLE UA 571-C FIXE : BANDE DE 250 CARTOUCHES RÉARMÉE !', 'success');
        }
        return true;
      }
    }
    return false;
  }

  /* === CHANTIER 6 & SOFIA LEVEL DESIGN (v56.0): Rupturable Ammonia Frost Coolant Pipes === */
  buildAmmoniaCoolantPipes() {
    this.ammoniaCoolantPipes = [];
    this.activeAmmoniaClouds = [];

    const pipePositions = [
      new THREE.Vector3(-35, 3.5, -15),
      new THREE.Vector3(-35, 3.5, 15),
      new THREE.Vector3(35, 3.5, -15),
      new THREE.Vector3(35, 3.5, 15),
      new THREE.Vector3(0, 4.5, -35),
      new THREE.Vector3(0, 4.5, 35)
    ];

    const pipeMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.85, roughness: 0.3 });
    const bandMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

    pipePositions.forEach((pos, idx) => {
      const group = new THREE.Group();
      group.position.copy(pos);

      const isZAxis = Math.abs(pos.x) > 30;
      const pipeGeo = new THREE.CylinderGeometry(0.3, 0.3, 14.0, 12);
      const pipeMesh = new THREE.Mesh(pipeGeo, pipeMat);
      if (isZAxis) pipeMesh.rotation.x = Math.PI / 2;
      else pipeMesh.rotation.z = Math.PI / 2;
      pipeMesh.castShadow = true;
      group.add(pipeMesh);

      // Warning hazard bands
      [-4.0, 0, 4.0].forEach(offset => {
        const band = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.4, 12), bandMat);
        if (isZAxis) {
          band.rotation.x = Math.PI / 2;
          band.position.z = offset;
        } else {
          band.rotation.z = Math.PI / 2;
          band.position.x = offset;
        }
        group.add(band);
      });

      this.addReferenceObject(group);
      this.envObjects.push(group);

      this.ammoniaCoolantPipes.push({
        id: idx,
        group,
        pos: pos.clone(),
        hp: 90,
        isRuptured: false
      });
    });
  }

  checkAmmoniaPipeDamage(attack, audio, particles, horde) {
    if (!this.ammoniaCoolantPipes || !attack || !attack.origin) return;

    this.ammoniaCoolantPipes.forEach(pipe => {
      if (pipe.isRuptured) return;
      if (pipe.pos.distanceTo(attack.origin) <= (attack.radius || 2.0) + 2.5) {
        pipe.hp -= (attack.damage || 50);
        if (pipe.hp <= 0) {
          pipe.isRuptured = true;

          if (audio) {
            if (audio.playAmmoniaPipeHissFrost) audio.playAmmoniaPipeHissFrost();
            else if (audio.playLiquidNitrogenBlast) audio.playLiquidNitrogenBlast();
          }

          // Spawn expansive frost freezing cloud
          const frostGeo = new THREE.SphereGeometry(6.5, 12, 12);
          const frostMat = new THREE.MeshBasicMaterial({
            color: 0xbae6fd,
            transparent: true,
            opacity: 0.65,
            wireframe: false
          });
          const frostMesh = new THREE.Mesh(frostGeo, frostMat);
          frostMesh.position.set(pipe.pos.x, 1.5, pipe.pos.z);
          this.addReferenceObject(frostMesh);

          this.activeAmmoniaClouds.push({
            mesh: frostMesh,
            pos: new THREE.Vector3(pipe.pos.x, 1.5, pipe.pos.z),
            radius: 6.5,
            timer: 9.0
          });
        }
      }
    });
  }

  updateAmmoniaClouds(delta, horde, particles) {
    if (!this.activeAmmoniaClouds) return;

    for (let i = this.activeAmmoniaClouds.length - 1; i >= 0; i--) {
      const cloud = this.activeAmmoniaClouds[i];
      cloud.timer -= delta;
      cloud.mesh.rotation.y += delta * 1.5;
      cloud.mesh.material.opacity = Math.max(0, (cloud.timer / 9.0) * 0.65);

      // Freeze and damage Xenomorphs in radius
      if (horde && horde.aliens) {
        horde.aliens.forEach(alien => {
          if (alien && alien.mesh && alien.mesh.position.distanceTo(cloud.pos) <= cloud.radius) {
            alien.isFrozen = true;
            alien.hp -= 70 * delta;
            if (particles && particles.emitSparks && this.random() < 0.08) {
              particles.emitSparks(alien.mesh.position, 2);
            }
          }
        });
      }

      if (cloud.timer <= 0) {
        this.removeReferenceObject(cloud.mesh);
        this.activeAmmoniaClouds.splice(i, 1);
      }
    }
  }

  /* === CHANTIER 7 & SOFIA LEVEL DESIGN (v56.0): Collapsible Perforated Steel Floor Grates === */
  buildCollapsibleFloorGrates() {
    this.collapsibleFloorGrates = [];

    const grateConfigs = [
      new THREE.Vector3(-14, 0.06, 0),
      new THREE.Vector3(14, 0.06, 0),
      new THREE.Vector3(0, 0.06, -16),
      new THREE.Vector3(0, 0.06, 16)
    ];

    const grateMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.9,
      roughness: 0.4,
      wireframe: true
    });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.5 }); // Hazard yellow

    grateConfigs.forEach((pos, idx) => {
      const group = new THREE.Group();
      group.position.copy(pos);

      // Warning rim
      const rim = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.12, 5.2), rimMat);
      group.add(rim);

      // Inner perforated mesh
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.08, 4.8), grateMat);
      mesh.position.y = 0.04;
      group.add(mesh);

      this.addReferenceObject(group);
      this.envObjects.push(group);

      this.collapsibleFloorGrates.push({
        id: idx,
        group,
        mesh,
        pos: pos.clone(),
        radius: 2.8,
        hp: 350,
        isCollapsed: false
      });
    });
  }

  checkCollapsibleGrates(playerPos, horde, bosses, audio, particles) {
    if (!this.collapsibleFloorGrates) return;

    this.collapsibleFloorGrates.forEach(grate => {
      if (grate.isCollapsed) return;

      let occupants = 0;
      let hasCrusherOrHeavy = false;

      if (horde && horde.aliens) {
        horde.aliens.forEach(alien => {
          if (alien && alien.mesh && alien.mesh.position.distanceTo(grate.pos) <= grate.radius) {
            occupants++;
            if (alien.type === 'crusher' || alien.type === 'praetorian') {
              hasCrusherOrHeavy = true;
            }
          }
        });
      }

      // Check if collapsed by heavy weight
      if (hasCrusherOrHeavy || occupants >= 4) {
        grate.isCollapsed = true;
        this.removeReferenceObject(grate.group);

        if (audio) {
          if (audio.playFloorGrateCollapse) audio.playFloorGrateCollapse();
          else if (audio.playCryoVatShatter) audio.playCryoVatShatter();
        }
        if (particles && particles.emitExplosion) particles.emitExplosion(grate.pos, 18);

        // Plunge all standing enemies into acid trench!
        if (horde && horde.aliens) {
          horde.aliens.forEach(alien => {
            if (alien && alien.mesh && alien.mesh.position.distanceTo(grate.pos) <= grate.radius) {
              alien.hp -= 800; // Crushing plunge!
              if (particles && particles.emitAlienBloodSpurt) {
                particles.emitAlienBloodSpurt(alien.mesh.position, 20);
              }
            }
          });
        }
      }
    });
  }

  /* === CHANTIER 8 & SOFIA LEVEL DESIGN (v56.0): M30 Ballistic Cargo Crates & Tactical Half-Cover === */
  buildTacticalCoverObstacles() {
    this.tacticalCoverObstacles = [];

    const cratePositions = [
      new THREE.Vector3(-10, 1.1, -8),
      new THREE.Vector3(10, 1.1, 8),
      new THREE.Vector3(-12, 1.1, 14),
      new THREE.Vector3(12, 1.1, -14),
      new THREE.Vector3(-26, 1.1, -24),
      new THREE.Vector3(26, 1.1, 24)
    ];

    const crateMat = new THREE.MeshStandardMaterial({
      color: 0x334155, // USCM reinforced ballistic steel
      metalness: 0.85,
      roughness: 0.35
    });
    const stencilMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b }); // Stencil yellow

    cratePositions.forEach((pos, idx) => {
      const group = new THREE.Group();
      group.position.copy(pos);

      const box = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.2, 1.8), crateMat);
      box.castShadow = true;
      box.receiveShadow = true;
      group.add(box);

      // USCM Cargo Stencil Line
      const stencil = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.25, 0.04), stencilMat);
      stencil.position.set(0, 0.3, 0.92);
      group.add(stencil);

      this.addReferenceObject(group);
      this.envObjects.push(group);

      this.tacticalCoverObstacles.push({
        id: idx,
        group,
        pos: pos.clone(),
        size: new THREE.Vector3(3.2, 2.2, 1.8)
      });
    });
  }

  /* === SECTOR 1 & SOFIA LEVEL DESIGN (v56.5): Val Verde Jungle Downed Huey & Mud Pits (Predator 1987) === */
  buildValVerdeProps() {
    const group = new THREE.Group();
    const camoMat = new THREE.MeshStandardMaterial({ color: 0x22301c, metalness: 0.6, roughness: 0.5 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x181e19, metalness: 0.9, roughness: 0.2 });
    const glassMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.35 });
    const mudMat = new THREE.MeshStandardMaterial({ color: 0x1b130c, roughness: 0.25, metalness: 0.1 });

    // 1. Downed UH-1 Huey Helicopter Fuselage embedded between trees
    const wreckPos = new THREE.Vector3(-18, 0, 14);
    const heliGroup = new THREE.Group();
    heliGroup.position.copy(wreckPos);
    heliGroup.rotation.set(0.25, -Math.PI / 4, 0.45); // Tilted crash pose

    // Main cabin fuselage
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, 8.5, 12), camoMat);
    body.rotation.z = Math.PI / 2;
    body.position.y = 1.8;
    body.castShadow = true;
    heliGroup.add(body);

    // Broken tail boom
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 5.0, 8), camoMat);
    tail.rotation.z = Math.PI / 2 + 0.35;
    tail.position.set(-5.5, 2.2, 0);
    heliGroup.add(tail);

    // Cockpit nose and broken windshield
    const nose = new THREE.Mesh(new THREE.SphereGeometry(1.7, 8, 8), glassMat);
    nose.scale.set(1.4, 0.9, 0.9);
    nose.position.set(4.2, 1.8, 0);
    heliGroup.add(nose);

    // Main rotor hub with one bent blade embedded in trunk
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.6, 8), metalMat);
    mast.position.set(0, 3.8, 0);
    heliGroup.add(mast);

    const blade = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.08, 0.45), metalMat);
    blade.position.set(3.2, 4.4, 0);
    blade.rotation.y = 0.4;
    heliGroup.add(blade);

    // Cockpit military VHF radio transceiver console
    const radioMesh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.4), metalMat);
    radioMesh.position.set(3.2, 1.8, 0.4);
    const radioLed = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), new THREE.MeshBasicMaterial({ color: 0x22c55e }));
    radioLed.position.set(3.2, 2.1, 0.4);
    heliGroup.add(radioMesh);
    heliGroup.add(radioLed);

    group.add(heliGroup);

    // 2. Mud Camouflage Riverbanks (Dutch 1987)
    this.mudPits = [];
    const mudCoords = [
      new THREE.Vector3(12, 0.15, -16),
      new THREE.Vector3(18, 0.15, -8),
      new THREE.Vector3(8, 0.15, -22)
    ];

    mudCoords.forEach((mPos, idx) => {
      const pitGeo = new THREE.CylinderGeometry(3.6, 4.2, 0.3, 16);
      const pitMesh = new THREE.Mesh(pitGeo, mudMat);
      pitMesh.position.copy(mPos);
      pitMesh.receiveShadow = true;
      group.add(pitMesh);

      // Reeds & riverbank foliage around edges
      for (let r = 0; r < 8; r++) {
        const a = (r / 8) * Math.PI * 2;
        const reed = new THREE.Mesh(new THREE.ConeGeometry(0.08, 1.8, 4), new THREE.MeshStandardMaterial({ color: 0x1f2e14 }));
        reed.position.set(mPos.x + Math.cos(a) * 3.8, 0.9, mPos.z + Math.sin(a) * 3.8);
        group.add(reed);
      }

      this.mudPits.push({
        id: idx,
        pos: mPos.clone(),
        radius: 3.8
      });
    });

    // 3. Major Alan "Dutch" Schaefer's Counterweight Log Trap at [-14, 0, -8]
    const logTrapPos = new THREE.Vector3(-14, 0, -8);
    const logGroup = new THREE.Group();
    logGroup.position.copy(logTrapPos);

    const logTrunk = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 6.2, 10), new THREE.MeshStandardMaterial({ color: 0x3d2012, roughness: 0.95 }));
    logTrunk.rotation.z = Math.PI / 2;
    logTrunk.position.y = 3.8;
    logTrunk.castShadow = true;
    logGroup.add(logTrunk);

    // Suspended liana vines
    [-2.6, 2.6].forEach(vx => {
      const vLine = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 4.0, 4), new THREE.MeshStandardMaterial({ color: 0x1f3d1a }));
      vLine.position.set(vx, 5.8, 0);
      logGroup.add(vLine);
    });

    // Wooden release peg at [-14, 1.2, -8]
    const releasePeg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.2, 0.4), new THREE.MeshStandardMaterial({ color: 0x3d2012, roughness: 0.95 }));
    releasePeg.position.set(0, 1.2, 0);
    logGroup.add(releasePeg);
    group.add(logGroup);

    this.dutchLogTrap = {
      group: logGroup,
      logMesh: logTrunk,
      pos: logTrapPos.clone(),
      triggerPos: logTrapPos.clone().add(new THREE.Vector3(0, 1.2, 0)),
      isTriggered: false,
      swingAngle: 0
    };

    // 4. Guerrilla Sandbag Munitions Bunker at [18, 0, -14] (+2.4m roof elevation)
    const bunkerPos = new THREE.Vector3(18, 0, -14);
    const bunkerGroup = new THREE.Group();
    bunkerGroup.position.copy(bunkerPos);

    const sandbagMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.9 });
    const bunkerWalls = new THREE.Mesh(new THREE.BoxGeometry(6.4, 2.4, 5.2), sandbagMat);
    bunkerWalls.position.y = 1.2;
    bunkerWalls.receiveShadow = true;
    bunkerGroup.add(bunkerWalls);

    // Roof corrugated slab
    const roofSlab = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.2, 5.6), metalMat);
    roofSlab.position.y = 2.4;
    roofSlab.receiveShadow = true;
    bunkerGroup.add(roofSlab);

    // Rear sandbag steps
    for (let s = 0; s < 3; s++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8 * (s + 1), 2.2), sandbagMat);
      step.position.set(-3.6 - s * 0.7, (0.8 * (s + 1)) / 2, 0);
      bunkerGroup.add(step);
    }

    group.add(bunkerGroup);
    this.sandbagBunker = { pos: bunkerPos.clone() };

    // 5. Billy Sole's Fallen Giant Log Bridge across Gorge [-2, 0, -26] (+4.0m elevation)
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x3d2012, roughness: 0.95 });
    const mossMat = new THREE.MeshStandardMaterial({ color: 0x223d14, roughness: 0.95 });
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x38342f, roughness: 0.9 });
    const fleshMat = new THREE.MeshStandardMaterial({ color: 0x882218, roughness: 0.6 });
    const waterMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.1, metalness: 0.8, transparent: true, opacity: 0.75 });
    const fireMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const barrelRedMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, metalness: 0.85, roughness: 0.3 });
    const goldBrassMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.9, roughness: 0.2 });

    const gorgeGroup = new THREE.Group();
    gorgeGroup.position.set(-2, 0, -26);

    // Deep rocky ravine bed (jagged boulders at y=0)
    for (let r = 0; r < 8; r++) {
      const boulder = new THREE.Mesh(new THREE.DodecahedronGeometry(1.4 + (r % 3) * 0.4, 1), stoneMat);
      boulder.position.set(-10 + r * 3.0, 0.7, (this.random() - 0.5) * 2.8);
      gorgeGroup.add(boulder);
    }

    // Colossal moss-covered fallen log (radius 0.9m, length 24m) spanning x: -14 to 10 at y: 4.0m
    const fallenLog = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 24.0, 12), mossMat);
    fallenLog.rotation.z = Math.PI / 2;
    fallenLog.position.set(0, 4.0, 0);
    fallenLog.castShadow = true;
    fallenLog.receiveShadow = true;
    gorgeGroup.add(fallenLog);

    // Billy Sole's Ceremonial Machete embedded into top of log
    const macheteBlade = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.85, 0.18), metalMat);
    macheteBlade.position.set(0, 5.0, 0);
    gorgeGroup.add(macheteBlade);

    const macheteHilt = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.35, 6), woodMat);
    macheteHilt.position.set(0, 5.5, 0);
    gorgeGroup.add(macheteHilt);

    group.add(gorgeGroup);
    this.billyLogBridge = {
      group: gorgeGroup,
      pos: new THREE.Vector3(-2, 4.0, -26),
      machetePos: new THREE.Vector3(-2, 4.0, -26),
      isClaimed: false
    };

    // 6. Captain Jim Hopper's Skinned Berets Execution Site [28, 0, 18]
    const hopperGroup = new THREE.Group();
    hopperGroup.position.set(28, 0, 18);

    // 3 Skinned soldiers dangling upside down from hemp ropes at +6.5m
    const ropeMat = new THREE.MeshStandardMaterial({ color: 0x785331, roughness: 0.95 });
    [-4.5, 0, 4.5].forEach(hx => {
      // Hemp rope
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3.2, 4), ropeMat);
      rope.position.set(hx, 6.2, 0);
      hopperGroup.add(rope);

      // Inverted butchered torso
      const bodyTorso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.3, 0.45), fleshMat);
      bodyTorso.position.set(hx, 4.4, 0);
      bodyTorso.rotation.z = Math.PI;
      hopperGroup.add(bodyTorso);

      // Inverted head
      const bodyHead = new THREE.Mesh(new THREE.SphereGeometry(0.28, 6, 6), fleshMat);
      bodyHead.position.set(hx, 3.5, 0);
      hopperGroup.add(bodyHead);

      // Blood pool on ground beneath
      const bloodPuddle = new THREE.Mesh(new THREE.CircleGeometry(1.4, 8), new THREE.MeshStandardMaterial({ color: 0x4a0404, roughness: 0.2 }));
      bloodPuddle.rotation.x = -Math.PI / 2;
      bloodPuddle.position.set(hx, 0.03, 0);
      hopperGroup.add(bloodPuddle);
    });

    // Hopper's Special Forces Military Satchel on a rock
    const satchelRock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.8, 1), stoneMat);
    satchelRock.position.set(0, 0.4, 2.5);
    hopperGroup.add(satchelRock);

    const satchelMesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.5), camoMat);
    satchelMesh.position.set(0, 0.85, 2.5);
    hopperGroup.add(satchelMesh);

    group.add(hopperGroup);
    this.hopperExecutionSite = {
      group: hopperGroup,
      pos: new THREE.Vector3(28, 0, 18),
      satchelPos: new THREE.Vector3(28, 0.85, 20.5),
      isClaimed: false
    };

    // 7. Guerrilla Sniper Watchtower at [8, 0, 6] (+5.5m elevation)
    const towerGroup = new THREE.Group();
    towerGroup.position.set(8, 0, 6);

    // 4 Heavy timber pilings (height 6.2m)
    [-1.8, 1.8].forEach(tx => {
      [-1.8, 1.8].forEach(tz => {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 6.2, 6), woodMat);
        post.position.set(tx, 3.1, tz);
        towerGroup.add(post);
      });
    });

    // Elevated Sniper Platform at +5.5m (4.2m x 4.2m)
    const platform = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.35, 4.2), woodMat);
    platform.position.y = 5.5;
    platform.receiveShadow = true;
    towerGroup.add(platform);

    // Sandbag parapet around platform
    const parapetN = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.8, 0.4), new THREE.MeshStandardMaterial({ color: 0x78716c }));
    parapetN.position.set(0, 6.0, 2.0);
    towerGroup.add(parapetN);
    const parapetS = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.8, 0.4), new THREE.MeshStandardMaterial({ color: 0x78716c }));
    parapetS.position.set(0, 6.0, -2.0);
    towerGroup.add(parapetS);

    // Wooden climbing ladder incline from ground (z=-2.6) to platform
    const ladder = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.2, 4.0), woodMat);
    ladder.position.set(0, 2.75, -2.6);
    ladder.rotation.x = Math.atan2(5.5, 3.2);
    towerGroup.add(ladder);

    group.add(towerGroup);
    this.guerrillaWatchtower = {
      group: towerGroup,
      pos: new THREE.Vector3(8, 0, 6),
      platformPos: new THREE.Vector3(8, 5.5, 6)
    };

    // 8. Rebel Fuel Depot & Communications Shack at [14, 0, 4]
    const depotGroup = new THREE.Group();
    depotGroup.position.set(14, 0, 4);

    // 4 Red explosive fuel barrels
    this.rebelFuelBarrels = [];
    const barrelCoords = [
      new THREE.Vector3(-1.2, 0.9, -1.2),
      new THREE.Vector3(1.2, 0.9, -1.2),
      new THREE.Vector3(-1.2, 0.9, 1.2),
      new THREE.Vector3(1.2, 0.9, 1.2)
    ];

    barrelCoords.forEach((bPos, idx) => {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 1.8, 12), barrelRedMat);
      barrel.position.copy(bPos);
      barrel.castShadow = true;
      depotGroup.add(barrel);
      this.rebelFuelBarrels.push({
        id: idx,
        pos: new THREE.Vector3(14 + bPos.x, bPos.y, 4 + bPos.z),
        hp: 80,
        isBlown: false
      });
    });

    // Rebel Communications Shack at [2, 0, 10]
    const shackGroup = new THREE.Group();
    shackGroup.position.set(2, 0, 10);

    const shackWalls = new THREE.Mesh(new THREE.BoxGeometry(4.5, 2.6, 4.5), woodMat);
    shackWalls.position.y = 1.3;
    shackWalls.receiveShadow = true;
    shackGroup.add(shackWalls);

    // Corrugated tin roof (+2.6m elevation)
    const shackRoof = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.15, 5.0), metalMat);
    shackRoof.position.y = 2.6;
    shackGroup.add(shackRoof);

    // Ham radio antenna
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 4.2, 6), metalMat);
    antenna.position.set(1.8, 4.6, 1.8);
    shackGroup.add(antenna);

    group.add(depotGroup);
    group.add(shackGroup);

    this.rebelFuelDepot = {
      depotGroup,
      shackGroup,
      pos: new THREE.Vector3(14, 0, 4),
      shackPos: new THREE.Vector3(2, 0, 10),
      isBlown: false
    };

    // 9. Blain Cooper's "Old Painless" Deforested Clearing [-28, 0, -10]
    const painlessGroup = new THREE.Group();
    painlessGroup.position.set(-28, 0, -10);

    // Dozens of sheared tree stumps and deforested logs
    for (let st = 0; st < 7; st++) {
      const a = (st / 7) * Math.PI * 2;
      const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 1.2 + (st % 2) * 0.6, 8), woodMat);
      stump.position.set(Math.cos(a) * (4.5 + (st % 3) * 1.5), 0.6, Math.sin(a) * (4.5 + (st % 3) * 1.5));
      painlessGroup.add(stump);
    }

    // Spent brass shell casings
    for (let c = 0; c < 12; c++) {
      const casing = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.25, 4), goldBrassMat);
      casing.rotation.set(Math.PI / 2, c * 1.1, c * 0.8);
      casing.position.set((this.random() - 0.5) * 6.0, 0.04, (this.random() - 0.5) * 6.0);
      painlessGroup.add(casing);
    }

    // Blain's M134 Minigun "Old Painless" resting on a log
    const minigunGroup = new THREE.Group();
    minigunGroup.position.set(0, 0.6, 0);

    const gunBarrels = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.6, 8), metalMat);
    gunBarrels.rotation.z = Math.PI / 2;
    minigunGroup.add(gunBarrels);

    const gunChamber = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.35, 0.35), metalMat);
    gunChamber.position.set(-0.9, 0, 0);
    minigunGroup.add(gunChamber);

    const ammoPack = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.5), camoMat);
    ammoPack.position.set(-1.4, 0, 0);
    minigunGroup.add(ammoPack);

    painlessGroup.add(minigunGroup);
    group.add(painlessGroup);

    this.oldPainlessClearing = {
      group: painlessGroup,
      pos: new THREE.Vector3(-28, 0, -10),
      gunPos: new THREE.Vector3(-28, 0.6, -10),
      cooldown: 0
    };

    // 10. Dutch's Signal Bonfire & Punji Pit Trap [-8, 0, 24]
    const dutchCampGroup = new THREE.Group();
    dutchCampGroup.position.set(-8, 0, 24);

    // Roaring Signal Bonfire
    const fireWood = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.1, 6), woodMat);
    fireWood.position.y = 0.5;
    dutchCampGroup.add(fireWood);

    const fireFlames = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.8, 8), fireMat);
    fireFlames.position.y = 1.2;
    dutchCampGroup.add(fireFlames);

    const bonfireLight = new THREE.PointLight(0xf59e0b, 2.4, 14.0);
    bonfireLight.position.set(0, 1.4, 0);
    dutchCampGroup.add(bonfireLight);

    // Mud root dugout shelter
    const rootDugout = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.2, 2.2, 6, 1, true, 0, Math.PI), mudMat);
    rootDugout.position.set(-2.5, 1.1, 0);
    rootDugout.rotation.y = Math.PI / 2;
    dutchCampGroup.add(rootDugout);

    // Sharpened Punji Bamboo Pit Trap at [-8, 0, 20]
    const punjiGroup = new THREE.Group();
    punjiGroup.position.set(0, 0, -4.0);

    for (let p = 0; p < 8; p++) {
      const a = (p / 8) * Math.PI * 2;
      const stake = new THREE.Mesh(new THREE.ConeGeometry(0.08, 1.2, 4), woodMat);
      stake.position.set(Math.cos(a) * 1.1, 0.55, Math.sin(a) * 1.1);
      stake.rotation.x = (this.random() - 0.5) * 0.3;
      punjiGroup.add(stake);
    }

    const leafCover = new THREE.Mesh(new THREE.CircleGeometry(1.8, 8), new THREE.MeshStandardMaterial({ color: 0x1f3d1a, roughness: 0.9 }));
    leafCover.rotation.x = -Math.PI / 2;
    leafCover.position.y = 0.15;
    punjiGroup.add(leafCover);

    dutchCampGroup.add(punjiGroup);
    group.add(dutchCampGroup);

    this.dutchBonfireCamp = {
      group: dutchCampGroup,
      pos: new THREE.Vector3(-8, 0, 24),
      light: bonfireLight
    };

    this.punjiStakeTraps.push({
      group: punjiGroup,
      pos: new THREE.Vector3(-8, 0, 20),
      radius: 3.5,
      isSprung: false
    });

    // 11. Mountain River Cascading Waterfall & Rocky Cliff at [32, 0, -8] (+6.2m elevation)
    const waterfallGroup = new THREE.Group();
    waterfallGroup.position.set(32, 0, -8);

    // High natural granite cliff face (height 6.2m)
    const cliff = new THREE.Mesh(new THREE.BoxGeometry(8.5, 6.2, 8.5), stoneMat);
    cliff.position.y = 3.1;
    cliff.castShadow = true;
    cliff.receiveShadow = true;
    waterfallGroup.add(cliff);

    // Waterfall cascading water sheet
    const waterSheet = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 6.0), waterMat);
    waterSheet.position.set(-4.3, 3.0, 0);
    waterSheet.rotation.y = -Math.PI / 2;
    waterfallGroup.add(waterSheet);

    // Rocky river plunge pool at base
    const pool = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.6, 0.2, 16), waterMat);
    pool.position.set(-5.5, 0.1, 0);
    waterfallGroup.add(pool);

    // Natural rocky trail ramp ascending from ground to cliff top
    const rockyRamp = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.4, 3.2), stoneMat);
    rockyRamp.position.set(-6.8, 3.1, 0);
    rockyRamp.rotation.z = -Math.atan2(6.2, 5.0);
    waterfallGroup.add(rockyRamp);

    group.add(waterfallGroup);
    this.valVerdeWaterfall = {
      group: waterfallGroup,
      pos: new THREE.Vector3(32, 6.2, -8),
      poolPos: new THREE.Vector3(26.5, 0, -8)
    };

    // 12. Canopy Bough Highway & Vine Tightrope Bridges (+6.8m elevation)
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0x3d2012, roughness: 0.9 });
    this.canopyBoughHighways = [
      { minX: -22, maxX: 2, minZ: -38, maxZ: 2 },
      { minX: -2, maxX: 22, minZ: -38, maxZ: 2 },
      { minX: -2, maxX: 22, minZ: -2, maxZ: 38 },
      { minX: -22, maxX: 2, minZ: -2, maxZ: 38 }
    ];

    // Bridge 1 (West to North): [-20, 6.8, 0] to [0, 6.8, -36]
    const b1 = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.25, 41.0), canopyMat);
    b1.position.set(-10, 6.8, -18);
    b1.rotation.y = Math.atan2(20, -36);
    b1.castShadow = true;
    b1.receiveShadow = true;
    group.add(b1);

    // Bridge 2 (North to East): [0, 6.8, -36] to [20, 6.8, 0]
    const b2 = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.25, 41.0), canopyMat);
    b2.position.set(10, 6.8, -18);
    b2.rotation.y = Math.atan2(-20, -36);
    b2.castShadow = true;
    b2.receiveShadow = true;
    group.add(b2);

    // Bridge 3 (East to South): [20, 6.8, 0] to [0, 6.8, 36]
    const b3 = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.25, 41.0), canopyMat);
    b3.position.set(10, 6.8, 18);
    b3.rotation.y = Math.atan2(20, 36);
    b3.castShadow = true;
    b3.receiveShadow = true;
    group.add(b3);

    // Bridge 4 (South to West): [0, 6.8, 36] to [-20, 6.8, 0]
    const b4 = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.25, 41.0), canopyMat);
    b4.position.set(-10, 6.8, 18);
    b4.rotation.y = Math.atan2(-20, 36);
    b4.castShadow = true;
    b4.receiveShadow = true;
    group.add(b4);

    // 13. Dutch's Shouting Challenge Rock ("KILL ME! I'M HERE!") [-10, 0, 18] (+1.8m)
    const challengeGroup = new THREE.Group();
    challengeGroup.position.set(-10, 0, 18);

    const chalRock = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 1.8, 8), stoneMat);
    chalRock.position.y = 0.9;
    chalRock.castShadow = true;
    chalRock.receiveShadow = true;
    challengeGroup.add(chalRock);

    // Burning torch stuck into rock
    const torchWood = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 4), woodMat);
    torchWood.position.set(0.6, 2.2, 0.4);
    torchWood.rotation.z = 0.2;
    challengeGroup.add(torchWood);

    const torchFlame = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.5, 6), fireMat);
    torchFlame.position.set(0.8, 3.1, 0.4);
    challengeGroup.add(torchFlame);

    const torchLight = new THREE.PointLight(0xf59e0b, 1.8, 9.0);
    torchLight.position.set(0.8, 3.2, 0.4);
    challengeGroup.add(torchLight);

    group.add(challengeGroup);
    this.dutchChallengeRock = {
      group: challengeGroup,
      pos: new THREE.Vector3(-10, 1.8, 18),
      cooldown: 0
    };

    // 14. Dutch's Primitive Weapon Workbench (Explosive Tip Jungle Arrows) [-6, 0, 26]
    const benchGroup = new THREE.Group();
    benchGroup.position.set(-6, 0, 26);

    const benchTable = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8, 1.2), woodMat);
    benchTable.position.y = 0.4;
    benchTable.castShadow = true;
    benchGroup.add(benchTable);

    // Carved ash bows and gunpowder warheads on table
    const bowMesh = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.03, 4, 12, Math.PI), woodMat);
    bowMesh.position.set(0, 0.85, 0);
    bowMesh.rotation.x = Math.PI / 2;
    benchGroup.add(bowMesh);

    group.add(benchGroup);
    this.dutchWorkbench = {
      group: benchGroup,
      pos: new THREE.Vector3(-6, 0.8, 26),
      isCrafted: false
    };

    // 15. Anna Gonsalves's Bamboo Hostage Holding Cage & Rebel Maps [4, 0, 14]
    const annaGroup = new THREE.Group();
    annaGroup.position.set(4, 0, 14);

    // Bamboo cage structure (2.2m x 2.2m x 2.4m)
    for (let c = 0; c < 8; c++) {
      const a = (c / 8) * Math.PI * 2;
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 4), woodMat);
      bar.position.set(Math.cos(a) * 1.1, 1.2, Math.sin(a) * 1.1);
      annaGroup.add(bar);
    }
    const cageRoof = new THREE.Mesh(new THREE.ConeGeometry(1.4, 0.6, 8), woodMat);
    cageRoof.position.y = 2.6;
    annaGroup.add(cageRoof);

    // Map table with guerrilla reconnaissance charts
    const mapTable = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 1.0), woodMat);
    mapTable.position.set(2.4, 0.4, 0);
    annaGroup.add(mapTable);

    const mapPaper = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.8), new THREE.MeshBasicMaterial({ color: 0xfef08a }));
    mapPaper.position.set(2.4, 0.82, 0);
    mapPaper.rotation.x = -Math.PI / 2;
    annaGroup.add(mapPaper);

    group.add(annaGroup);
    this.annaHostageCage = {
      group: annaGroup,
      pos: new THREE.Vector3(4, 0.8, 14),
      mapPos: new THREE.Vector3(6.4, 0.8, 14),
      isScanned: false
    };

    // 16. Mac's Perimeter Magnesium Illumination Flare & Claymore Tripwire [12, 0, -18]
    const macGroup = new THREE.Group();
    macGroup.position.set(12, 0, -18);

    // Green US tripwire between roots
    const tripwire = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.02, 0.02), new THREE.MeshBasicMaterial({ color: 0x22c55e }));
    tripwire.position.y = 0.25;
    macGroup.add(tripwire);

    // M18A1 Claymore Mine
    const claymore = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.15), camoMat);
    claymore.position.set(-1.8, 0.2, 0);
    macGroup.add(claymore);

    // M127A1 White Flare Rocket Tube
    const flareTube = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.6, 6), metalMat);
    flareTube.position.set(1.8, 0.3, 0);
    flareTube.rotation.z = -0.35;
    macGroup.add(flareTube);

    group.add(macGroup);
    this.macPerimeterTripwire = {
      group: macGroup,
      pos: new THREE.Vector3(12, 0.3, -18),
      isTriggered: false
    };

    // 17. Wild Javelina Roasting Spit (Survival Ration) [10, 0, 2]
    const spitGroup = new THREE.Group();
    spitGroup.position.set(10, 0, 2);

    const spitPost1 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 4), woodMat);
    spitPost1.position.set(-1.0, 0.7, 0);
    spitGroup.add(spitPost1);
    const spitPost2 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 4), woodMat);
    spitPost2.position.set(1.0, 0.7, 0);
    spitGroup.add(spitPost2);

    const spitBar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.4, 4), metalMat);
    spitBar.rotation.z = Math.PI / 2;
    spitBar.position.y = 1.2;
    spitGroup.add(spitBar);

    // Roasted meat carcass
    const roastMeat = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 1.2, 8), new THREE.MeshStandardMaterial({ color: 0x713f12, roughness: 0.85 }));
    roastMeat.rotation.z = Math.PI / 2;
    roastMeat.position.y = 1.2;
    spitGroup.add(roastMeat);

    // Embers
    const embers = new THREE.Mesh(new THREE.CircleGeometry(0.8, 8), new THREE.MeshBasicMaterial({ color: 0xd97706 }));
    embers.rotation.x = -Math.PI / 2;
    embers.position.y = 0.03;
    spitGroup.add(embers);

    group.add(spitGroup);
    this.wildBoarRoastSpit = {
      group: spitGroup,
      pos: new THREE.Vector3(10, 0.8, 2),
      isConsumed: false
    };

    // 18. Jungle Hunter Laughing Nuclear Blast Crater & Luminescent Blood Locus [36, 0, 28]
    const craterGroup = new THREE.Group();
    craterGroup.position.set(36, 0, 28);

    // Charred blast torus crater rim (elevation +1.2m)
    const craterRim = new THREE.Mesh(new THREE.TorusGeometry(5.8, 1.2, 8, 20), new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.95 }));
    craterRim.rotation.x = Math.PI / 2;
    craterRim.position.y = 0.6;
    craterRim.castShadow = true;
    craterGroup.add(craterRim);

    // Scorched blackened crater depression
    const scorchBed = new THREE.Mesh(new THREE.CircleGeometry(5.2, 16), new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.98 }));
    scorchBed.rotation.x = -Math.PI / 2;
    scorchBed.position.y = 0.02;
    craterGroup.add(scorchBed);

    // Splatters of fluorescent green glowing Yautja blood
    const greenBloodMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
    for (let b = 0; b < 6; b++) {
      const bloodPuddle = new THREE.Mesh(new THREE.CircleGeometry(0.6 + (b % 3) * 0.3, 8), greenBloodMat);
      bloodPuddle.rotation.x = -Math.PI / 2;
      bloodPuddle.position.set((this.random() - 0.5) * 4.5, 0.04, (this.random() - 0.5) * 4.5);
      craterGroup.add(bloodPuddle);
    }

    const bloodLight = new THREE.PointLight(0x22c55e, 2.2, 8.0);
    bloodLight.position.set(0, 1.0, 0);
    craterGroup.add(bloodLight);

    group.add(craterGroup);
    this.yautjaCraterLocus = {
      group: craterGroup,
      pos: new THREE.Vector3(36, 0.8, 28),
      isAnalyzed: false
    };

    // 19. Mountain River Rapids Dynamic Water Current Mesh
    const riverGeo = new THREE.PlaneGeometry(8.0, 65.0);
    const riverMesh = new THREE.Mesh(riverGeo, waterMat);
    riverMesh.rotation.x = -Math.PI / 2;
    riverMesh.rotation.z = Math.atan2(20, -45);
    riverMesh.position.set(8.0, 0.06, -20.0);
    group.add(riverMesh);

    this.riverRapidsPath = {
      group: riverMesh,
      pos: new THREE.Vector3(8, 0, -20)
    };

    this.addReferenceObject(group);
    this.envObjects.push(group);

    this.valVerdeProps = {
      group,
      wreckPos,
      radioPos: wreckPos.clone().add(new THREE.Vector3(3.2, 1.8, 0.4)),
      radioCooldown: 0
    };
  }

  checkValVerdeRadioInteraction(playerPos, ui, audio, horde) {
    if (!this.valVerdeProps || !playerPos) return false;
    const v = this.valVerdeProps;
    if (v.radioPos.distanceTo(playerPos) <= 4.2) {
      if (v.radioCooldown > 0) {
        if (ui && ui.showAnnouncement) {
          ui.showAnnouncement(`⏳ ÉMETTEUR RADIO EN RECHARGE (${Math.ceil(v.radioCooldown)}S)`);
        }
        return true;
      }
      v.radioCooldown = 35.0;
      if (audio && audio.playHueyRadioStatic) audio.playHueyRadioStatic();

      let luredCount = 0;
      if (horde && horde.aliens) {
        horde.aliens.forEach(alien => {
          if (alien && alien.mesh && alien.hp > 0 && alien.mesh.position.distanceTo(v.wreckPos) <= 35.0) {
            alien.hp -= 80;
            alien.isStunned = true;
            alien.stunTimer = 3.2;
            alien.mesh.position.addScaledVector(v.wreckPos.clone().sub(alien.mesh.position).normalize(), 6.0);
            luredCount++;
          }
        });
      }

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement(`📻 SOS ÉMIS SUR FRÉQUENCE MILITAIRE (PREDATOR 1987) : ${luredCount} XÉNOS ATTIRÉS DANS L'EMBUSCADE !`, "success");
      }
      return true;
    }
    return false;
  }

  checkMudPitInteraction(player, ui, audio, particles) {
    if (!this.mudPits || !player || !player.position) return false;
    for (let i = 0; i < this.mudPits.length; i++) {
      const pit = this.mudPits[i];
      if (player.position.distanceTo(pit.pos) <= pit.radius) {
        if (player.applyMudCamouflage) {
          player.applyMudCamouflage(25.0);
        }
        if (audio && audio.playMudCoatSquelch) audio.playMudCoatSquelch();
        if (particles && particles.emitAlienBloodSpurt) {
          particles.emitAlienBloodSpurt(player.position.clone().add(new THREE.Vector3(0, 1.0, 0)), 12);
        }
        if (ui && ui.showAnnouncement) {
          ui.showAnnouncement('🌿 CAMOUFLAGE DE BOUE THERMIQUE (PREDATOR 1987) : SIGNATURE MASQUÉE, DÉGÂTS FURTIFS +40% (25S) !', 'success');
        }
        return true;
      }
    }
    return false;
  }

  checkDutchLogTrapTrigger(playerPos, isDamage, audio, horde, bosses, particles, ui) {
    if (!this.dutchLogTrap || this.dutchLogTrap.isTriggered || !playerPos) return false;
    if (playerPos.distanceTo(this.dutchLogTrap.triggerPos) <= (isDamage ? 4.5 : 3.8)) {
      this.dutchLogTrap.isTriggered = true;
      if (audio && audio.playDutchLogTrapSwing) audio.playDutchLogTrapSwing();

      let hitCount = 0;
      if (horde && horde.aliens) {
        horde.aliens.forEach(alien => {
          if (alien && alien.mesh && alien.hp > 0 && alien.mesh.position.distanceTo(this.dutchLogTrap.pos) <= 12.0) {
            alien.hp -= 580;
            alien.isStunned = true;
            alien.stunTimer = 4.0;
            alien.mesh.position.addScaledVector(alien.mesh.position.clone().sub(this.dutchLogTrap.pos).normalize(), 12.0);
            hitCount++;
            if (particles && particles.emitAlienBloodSpurt) {
              particles.emitAlienBloodSpurt(alien.mesh.position, 16);
            }
          }
        });
      }

      if (bosses && bosses.activeBosses) {
        bosses.activeBosses.forEach(boss => {
          if (boss && boss.mesh && boss.hp > 0 && boss.mesh.position.distanceTo(this.dutchLogTrap.pos) <= 12.0) {
            boss.hp -= 420;
            boss.isStunned = true;
            boss.stunTimer = 2.5;
          }
        });
      }

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement(`🌲 PIÈGE À TRONC DE DUTCH DÉCLENCHÉ (PREDATOR 1987) : BALANCIER DÉVASTATEUR (${hitCount} XÉNOS PROJETÉS, 580 DMG) !`, 'warning');
      }
      return true;
    }
    return false;
  }

  checkBillyMacheteInteraction(player, ui, audio) {
    if (!this.billyLogBridge || !player || !player.position || this.billyLogBridge.isClaimed) return false;
    if (player.position.distanceTo(this.billyLogBridge.machetePos) <= 4.2) {
      this.billyLogBridge.isClaimed = true;
      if (audio && audio.playBillySoleChant) audio.playBillySoleChant();

      if (player.applyBillyCourage) {
        player.applyBillyCourage(30.0);
      }
      if (this.game) {
        this.game.score += 2000;
      }

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement("🗡️ COURAGE INÉBRANLABLE DE BILLY SOLE (PREDATOR 1987) : DÉGÂTS MÊLÉE +50%, IMMUNITÉ CHOC (30S), +2000 HONNEUR !", "success");
      }
      return true;
    }
    return false;
  }

  checkHopperSatchelInteraction(player, ui, audio) {
    if (!this.hopperExecutionSite || !player || !player.position || this.hopperExecutionSite.isClaimed) return false;
    if (player.position.distanceTo(this.hopperExecutionSite.satchelPos) <= 4.2) {
      this.hopperExecutionSite.isClaimed = true;
      if (audio && audio.playHopperSatchelOpen) audio.playHopperSatchelOpen();

      player.m41aGrenadeCharges = Math.min(6, (player.m41aGrenadeCharges || 0) + 4);
      player.medicompCharges = Math.min(6, (player.medicompCharges || 0) + 3);
      player.armor = Math.min(player.maxArmor || 600, player.armor + 350);

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement("🎒 SACOCHE MILITAIRE DU CAPITAINE JIM HOPPER (PREDATOR 1987) : +4 GRENADES, +3 MEDICOMP, BLINDAGE +350 !", "success");
      }
      return true;
    }
    return false;
  }

  checkOldPainlessInteraction(player, ui, audio, horde, particles) {
    if (!this.oldPainlessClearing || !player || !player.position) return false;
    const p = this.oldPainlessClearing;
    if (player.position.distanceTo(p.gunPos) <= 4.2) {
      if (p.cooldown > 0) {
        if (ui && ui.showAnnouncement) {
          ui.showAnnouncement(`⏳ OLD PAINLESS EN REFROIDISSEMENT (${Math.ceil(p.cooldown)}S)`);
        }
        return true;
      }
      p.cooldown = 45.0;

      if (audio && audio.playOldPainlessRoar) audio.playOldPainlessRoar();

      // Suppressive 360-degree rotary vulcan storm shredding all surrounding enemies in 25m
      let shredded = 0;
      if (horde && horde.aliens) {
        horde.aliens.forEach(alien => {
          if (alien && alien.mesh && alien.hp > 0 && alien.mesh.position.distanceTo(p.pos) <= 25.0) {
            alien.hp -= 450;
            alien.isStunned = true;
            alien.stunTimer = 4.0;
            shredded++;
            if (particles && particles.emitSparks) {
              particles.emitSparks(alien.mesh.position, 12);
            }
          }
        });
      }

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement(`🔥 MITRAILLEUSE M134 'OLD PAINLESS' DÉCHAÎNÉE (PREDATOR 1987) : RAFALE 6000 RPM (450 DMG SUR ${shredded} XÉNOS) !`, "warning");
      }
      return true;
    }
    return false;
  }

  checkRebelFuelBarrelsDamage(hitPos, dmg, audio, horde, bosses, particles, ui) {
    if (!this.rebelFuelDepot || this.rebelFuelDepot.isBlown || !hitPos) return false;
    if (hitPos.distanceTo(this.rebelFuelDepot.pos) <= 4.5) {
      this.rebelFuelDepot.isBlown = true;
      if (audio && audio.playRebelFuelDepotExplosion) audio.playRebelFuelDepotExplosion();

      // Spawn fiery explosion fireball
      const fireGeo = new THREE.SphereGeometry(8.5, 12, 12);
      const fireMesh = new THREE.Mesh(fireGeo, new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.85 }));
      fireMesh.position.copy(this.rebelFuelDepot.pos);
      this.addReferenceObject(fireMesh);

      const fireLight = new THREE.PointLight(0xf97316, 4.0, 22.0);
      fireLight.position.copy(this.rebelFuelDepot.pos);
      this.addReferenceObject(fireLight);

      this.activeValVerdeFireZones.push({
        mesh: fireMesh,
        light: fireLight,
        pos: this.rebelFuelDepot.pos.clone(),
        timer: 10.0
      });

      // Eradicate enemies in 16m
      let blownCount = 0;
      if (horde && horde.aliens) {
        horde.aliens.forEach(alien => {
          if (alien && alien.mesh && alien.hp > 0 && alien.mesh.position.distanceTo(this.rebelFuelDepot.pos) <= 16.0) {
            alien.hp -= 550;
            alien.isStunned = true;
            alien.stunTimer = 4.5;
            blownCount++;
            if (particles && particles.emitSparks) {
              particles.emitSparks(alien.mesh.position, 16);
            }
          }
        });
      }

      if (bosses && bosses.activeBosses) {
        bosses.activeBosses.forEach(boss => {
          if (boss && boss.mesh && boss.hp > 0 && boss.mesh.position.distanceTo(this.rebelFuelDepot.pos) <= 16.0) {
            boss.hp -= 400;
            boss.isStunned = true;
            boss.stunTimer = 2.5;
          }
        });
      }

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement(`💥 DÉPÔT DE CARBURANT DE GUÉRILLA PULVÉRISÉ (PREDATOR 1987) : BRASIER 16M (${blownCount} XÉNOS CALCINÉS, 550 DMG) !`, "warning");
      }
      return true;
    }
    return false;
  }

  checkPunjiPitTrapTrigger(horde, audio, particles, ui) {
    if (!this.punjiStakeTraps || this.punjiStakeTraps.length === 0 || !horde || !horde.aliens) return;
    this.punjiStakeTraps.forEach(trap => {
      if (trap.isSprung) return;
      horde.aliens.forEach(alien => {
        if (!trap.isSprung && alien && alien.mesh && alien.hp > 0 && alien.mesh.position.distanceTo(trap.pos) <= trap.radius) {
          trap.isSprung = true;
          if (audio && audio.playPunjiStakeImpale) audio.playPunjiStakeImpale();

          alien.hp -= 520;
          alien.isStunned = true;
          alien.stunTimer = 5.0;

          if (particles && particles.emitAlienBloodSpurt) {
            particles.emitAlienBloodSpurt(alien.mesh.position, 20);
          }

          if (ui && ui.showAnnouncement) {
            ui.showAnnouncement("🎋 PIÈGE À PIEUX PUNJI EN BAMBOU DE DUTCH DÉCLENCHÉ (PREDATOR 1987) : EMPALEMENT (520 DMG, IMMOBILISÉ 5S) !", "success");
          }
        }
      });
    });
  }

  /* === VAL VERDE (PREDATOR 1987) APEX INTERACTION & SURVIVAL SYSTEMS (v59.0) === */

  checkDutchChallengeRoar(player, ui, audio, horde) {
    if (!this.dutchChallengeRock || !player || !player.position) return false;
    const rock = this.dutchChallengeRock;
    if (player.position.distanceTo(rock.pos) <= 4.2) {
      if (rock.cooldown > 0) {
        if (ui && ui.showAnnouncement) {
          ui.showAnnouncement(`⏳ DÉFI DE DUTCH EN RECHARGE (${Math.ceil(rock.cooldown)}S)`);
        }
        return true;
      }
      rock.cooldown = 45.0;
      if (audio && audio.playDutchChallengeRoar) audio.playDutchChallengeRoar();

      // Grant +40% Musou Overload Energy
      player.musouEnergy = Math.min(100, (player.musouEnergy || 0) + 40);

      // Enrage & lure all xenos across the entire map towards Dutch's rock
      let luredCount = 0;
      if (horde && horde.aliens) {
        horde.aliens.forEach(alien => {
          if (alien && alien.mesh && alien.hp > 0) {
            alien.speed = (alien.speed || 4.0) * 1.35;
            alien.targetPos = rock.pos.clone();
            luredCount++;
          }
        });
      }

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement("📢 DÉFI DE DUTCH : 'KILL ME! I'M HERE!' (PREDATOR 1987) — RUGISSEMENT DANS LA CANOPÉE (+40% MUSOU, HORDE ENRAGÉE ATTIRÉE) !", "success");
      }
      return true;
    }
    return false;
  }

  checkExplosiveArrowsInteraction(player, ui, audio) {
    if (!this.dutchWorkbench || !player || !player.position || this.dutchWorkbench.isCrafted) return false;
    if (player.position.distanceTo(this.dutchWorkbench.pos) <= 4.2) {
      this.dutchWorkbench.isCrafted = true;
      if (audio && audio.playExplosiveArrowCraft) audio.playExplosiveArrowCraft();

      player.explosiveArrowCharges = Math.min(8, (player.explosiveArrowCharges || 0) + 6);
      player.m41aGrenadeCharges = Math.min(6, (player.m41aGrenadeCharges || 0) + 3);
      if (this.game) {
        this.game.score += 1500;
      }

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement("🏹 ÉTABLI DE DUTCH (PREDATOR 1987) : FLÈCHES EXPLOSIVES EN FRÊNE FABRIQUÉES (+6 TIRS EXPLOSIFS, +1500 SCORE) !", "success");
      }
      return true;
    }
    return false;
  }

  checkRebelMapsInteraction(player, ui, audio) {
    if (!this.annaHostageCage || !player || !player.position || this.annaHostageCage.isScanned) return false;
    if (player.position.distanceTo(this.annaHostageCage.mapPos) <= 4.2) {
      this.annaHostageCage.isScanned = true;
      if (audio && audio.playHueyRadioStatic) audio.playHueyRadioStatic();

      player.rebelMapScannerTimer = 35.0;
      if (this.game) {
        this.game.score += 1000;
      }

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement("🗺️ CARTES TACTIQUES DES GUÉRILLEROS (PREDATOR 1987) : CARTOGRAPHIE ACTIVE (RADAR SCAN 35S, +1000 SCORE) !", "success");
      }
      return true;
    }
    return false;
  }

  checkFlareTripwireTrigger(hitPos, audio, horde, bosses, particles, ui) {
    if (!this.macPerimeterTripwire || this.macPerimeterTripwire.isTriggered || !hitPos) return false;
    if (hitPos.distanceTo(this.macPerimeterTripwire.pos) <= 4.5) {
      this.macPerimeterTripwire.isTriggered = true;
      if (audio && audio.playMagnesiumFlarePop) audio.playMagnesiumFlarePop();

      // Launch high-altitude magnesium flare (3000°C white illumination)
      const flareLight = new THREE.PointLight(0xffffff, 5.0, 45.0);
      flareLight.position.set(this.macPerimeterTripwire.pos.x, 14.0, this.macPerimeterTripwire.pos.z);
      this.addReferenceObject(flareLight);

      const flareMesh = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      flareMesh.position.copy(flareLight.position);
      this.addReferenceObject(flareMesh);

      this.activeIlluminationFlare = {
        light: flareLight,
        mesh: flareMesh,
        timer: 18.0
      };

      // M18A1 Claymore directional blast (480 DMG, 14m)
      let claymoreHits = 0;
      if (horde && horde.aliens) {
        horde.aliens.forEach(alien => {
          if (alien && alien.mesh && alien.hp > 0 && alien.mesh.position.distanceTo(this.macPerimeterTripwire.pos) <= 14.0) {
            alien.hp -= 480;
            alien.isStunned = true;
            alien.stunTimer = 3.5;
            alien.mesh.position.addScaledVector(alien.mesh.position.clone().sub(this.macPerimeterTripwire.pos).normalize(), 8.0);
            claymoreHits++;
            if (particles && particles.emitSparks) {
              particles.emitSparks(alien.mesh.position, 16);
            }
          }
        });
      }

      if (bosses && bosses.activeBosses) {
        bosses.activeBosses.forEach(boss => {
          if (boss && boss.mesh && boss.hp > 0 && boss.mesh.position.distanceTo(this.macPerimeterTripwire.pos) <= 14.0) {
            boss.hp -= 350;
            boss.isStunned = true;
            boss.stunTimer = 2.0;
          }
        });
      }

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement(`💥 PIÈGE DE PÉRIMÈTRE DE MAC (PREDATOR 1987) : FUSÉE ÉCLAIRANTE MAGNÉSIUM & CLAYMORE (480 DMG SUR ${claymoreHits} CIBLES) !`, "warning");
      }
      return true;
    }
    return false;
  }

  checkRoastingSpitInteraction(player, ui, audio) {
    if (!this.wildBoarRoastSpit || !player || !player.position || this.wildBoarRoastSpit.isConsumed) return false;
    if (player.position.distanceTo(this.wildBoarRoastSpit.pos) <= 4.2) {
      this.wildBoarRoastSpit.isConsumed = true;
      if (audio && audio.playHealthPickup) audio.playHealthPickup();

      player.hp = Math.min(player.maxHp || 1000, player.hp + 300);
      player.stamina = player.maxStamina || 100;
      if (this.game) {
        this.game.score += 800;
      }

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement("🍖 RÔTI DE JAVELINA DE GUÉRILLA (PREDATOR 1987) : RATION DE SURVIE (+300 PV, ENDURANCE MAX, +800 SCORE) !", "success");
      }
      return true;
    }
    return false;
  }

  checkGlowingBloodInteraction(player, ui, audio) {
    if (!this.yautjaCraterLocus || !player || !player.position || this.yautjaCraterLocus.isAnalyzed) return false;
    if (player.position.distanceTo(this.yautjaCraterLocus.pos) <= 5.0) {
      this.yautjaCraterLocus.isAnalyzed = true;
      if (audio && audio.playYautjaGreenBloodDrip) audio.playYautjaGreenBloodDrip();

      if (player.recordTrophy) {
        player.recordTrophy("SANG VERT DE JUNGLE HUNTER (CRATÈRE D'AUTODESTRUCTION)", 2500);
      }
      if (this.game) {
        this.game.score += 2500;
      }
      player.plasmaOverchargeTimer = 30.0;

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement("🧪 SANG PHOSPHORESCENT DE JUNGLE HUNTER (PREDATOR 1987) : ANALYSE ADN RÉUSSIE (+2500 HONNEUR, SURCHARGE PLASMA 30S) !", "success");
      }
      return true;
    }
    return false;
  }

  checkRiverWaterWading(playerPos, player, audio, delta) {
    if (!this.riverRapidsPath || !playerPos || !player) return;
    const dx = playerPos.x - 8.0;
    const dz = playerPos.z - (-20.0);
    // River segment runs through x: [0, 16], z: [-45, 5]
    if (Math.abs(dx * 0.45 - dz * 0.2) <= 3.8 && Math.abs(dz) <= 28.0) {
      if (!player.isWadingRiver) {
        player.isWadingRiver = true;
        if (audio && audio.playRiverWaterWadeSquelch) audio.playRiverWaterWadeSquelch();
      }
      // Rapid cooling of weapon heat
      if (player.weaponHeat && player.weaponHeat > 0) {
        player.weaponHeat = Math.max(0, player.weaponHeat - delta * 35.0);
      }
    } else {
      player.isWadingRiver = false;
    }
  }

  /* === v63.0 Val Verde Jungle Master Expansion (Predator 1987) === */
  buildValVerdeMasterExpansionProps() {
    const group = new THREE.Group();
    const camoMat = new THREE.MeshStandardMaterial({ color: 0x22301c, metalness: 0.6, roughness: 0.5 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x181e19, metalness: 0.9, roughness: 0.2 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x3d2012, roughness: 0.95 });
    const bloodMat = new THREE.MeshStandardMaterial({ color: 0x4a0404, roughness: 0.2 });
    const mudMat = new THREE.MeshStandardMaterial({ color: 0x1b130c, roughness: 0.25, metalness: 0.1 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.9, roughness: 0.2 });

    // 20. Al Dillon's Severed Arm & Dual MP5 Last Stand [22, 0, -20]
    const dillonGroup = new THREE.Group();
    dillonGroup.position.set(22, 0, -20);

    const severedArm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.45, 6), new THREE.MeshStandardMaterial({ color: 0x6b3b24 }));
    severedArm.rotation.z = Math.PI / 3;
    severedArm.position.set(0, 0.2, 0);
    dillonGroup.add(severedArm);

    [-0.25, 0.25].forEach(mx => {
      const mp5Body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.75), metalMat);
      mp5Body.position.set(mx, 0.35, 0);
      dillonGroup.add(mp5Body);
      const mp5Mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.35, 0.12), metalMat);
      mp5Mag.position.set(mx, 0.15, 0.1);
      mp5Mag.rotation.x = -0.25;
      dillonGroup.add(mp5Mag);
    });

    const dillonBlood = new THREE.Mesh(new THREE.CircleGeometry(1.6, 8), bloodMat);
    dillonBlood.rotation.x = -Math.PI / 2;
    dillonBlood.position.y = 0.02;
    dillonGroup.add(dillonBlood);

    for (let c = 0; c < 16; c++) {
      const casing = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.18, 4), goldMat);
      casing.rotation.set(Math.PI / 2, c * 0.9, 0);
      casing.position.set((this.random() - 0.5) * 2.5, 0.04, (this.random() - 0.5) * 2.5);
      dillonGroup.add(casing);
    }

    const dossier = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.5), new THREE.MeshStandardMaterial({ color: 0xd4d4d8 }));
    dossier.position.set(0.6, 0.06, 0.4);
    dillonGroup.add(dossier);

    group.add(dillonGroup);
    this.dillonLastStand = {
      group: dillonGroup,
      pos: new THREE.Vector3(22, 0, -20),
      isLooted: false
    };

    // 21. Poncho Ramirez's Splintered Tree Defilade & 40mm Grenade Cache [-20, 0, 2]
    const ponchoGroup = new THREE.Group();
    ponchoGroup.position.set(-20, 0, 2);

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.2, 7.0, 10), woodMat);
    trunk.position.y = 3.5;
    ponchoGroup.add(trunk);

    const m79Barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.1, 6), metalMat);
    m79Barrel.rotation.x = 0.45;
    m79Barrel.position.set(1.4, 0.6, 0.8);
    ponchoGroup.add(m79Barrel);

    const m79Stock = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 0.5), woodMat);
    m79Stock.position.set(1.4, 0.25, 0.4);
    m79Stock.rotation.x = 0.45;
    ponchoGroup.add(m79Stock);

    const ammoCrate = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.6), camoMat);
    ammoCrate.position.set(1.6, 0.25, -0.6);
    ponchoGroup.add(ammoCrate);

    group.add(ponchoGroup);
    this.ponchoGrenadeStash = {
      group: ponchoGroup,
      pos: new THREE.Vector3(-20, 0.5, 2),
      isClaimed: false
    };

    // 22. Rick Hawkins' Glasses & Spec-Ops Encrypted Radio Beacon [-12, 0, -18]
    const hawkinsGroup = new THREE.Group();
    hawkinsGroup.position.set(-12, 0, -18);

    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.9, 0.5), camoMat);
    pack.position.y = 0.45;
    hawkinsGroup.add(pack);

    const glasses = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.015, 4, 8), metalMat);
    glasses.position.set(0.5, 0.4, 0.2);
    glasses.rotation.x = Math.PI / 2;
    hawkinsGroup.add(glasses);

    const beaconAntenna = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.8, 4), metalMat);
    beaconAntenna.position.set(-0.3, 1.1, 0);
    hawkinsGroup.add(beaconAntenna);

    const beaconLight = new THREE.PointLight(0x22c55e, 1.6, 6.0);
    beaconLight.position.set(-0.3, 2.0, 0);
    hawkinsGroup.add(beaconLight);

    group.add(hawkinsGroup);
    this.hawkinsRadioBeacon = {
      group: hawkinsGroup,
      pos: new THREE.Vector3(-12, 0.5, -18),
      light: beaconLight,
      isActivated: false
    };

    // 23. Waterfall Plunge Deep Mud Basin [26.5, 0, -8]
    const basinGroup = new THREE.Group();
    basinGroup.position.set(26.5, 0, -8);

    const basinMud = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 5.0, 0.4, 16), mudMat);
    basinMud.position.y = 0.2;
    basinMud.receiveShadow = true;
    basinGroup.add(basinMud);

    const mudBubbles = new THREE.PointLight(0x38bdf8, 1.2, 5.0);
    mudBubbles.position.set(0, 0.8, 0);
    basinGroup.add(mudBubbles);

    group.add(basinGroup);
    this.mudWaterfallBasin = {
      group: basinGroup,
      pos: new THREE.Vector3(26.5, 0.2, -8),
      cooldown: 0
    };

    this.addReferenceObject(group);
    this.envObjects.push(group);
  }

  // Val Verde Master Interaction: Al Dillon's Dual MP5 Last Stand
  checkDillonStandInteraction(player, ui, audio) {
    if (!this.dillonLastStand || !player || !player.position || this.dillonLastStand.isLooted) return false;
    if (player.position.distanceTo(this.dillonLastStand.pos) <= 4.2) {
      this.dillonLastStand.isLooted = true;
      if (audio && audio.playDillonDualMP5Firestorm) audio.playDillonDualMP5Firestorm();

      if (player.applyDillonGrit) player.applyDillonGrit(30.0);
      player.seegsonBoltAmmo = Math.min(18, (player.seegsonBoltAmmo || 0) + 8);
      player.m77GaussAmmo = Math.min(18, (player.m77GaussAmmo || 0) + 6);
      if (player.addScore) player.addScore(2500);

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement('🎖️ BAROUD D\'HONNEUR DE DILLON (PREDATOR 1987) : DOUBLE MP5 & DOSSIER CIA RÉCUPÉRÉS (+8 BOLTS, +6 GAUSS, BRAVOURE +40% CADENCE 30S) !', 'success');
      }
      return true;
    }
    return false;
  }

  // Val Verde Master Interaction: Poncho Ramirez's 40mm Grenade Launcher Cache
  checkPonchoStashInteraction(player, ui, audio) {
    if (!this.ponchoGrenadeStash || !player || !player.position || this.ponchoGrenadeStash.isClaimed) return false;
    if (player.position.distanceTo(this.ponchoGrenadeStash.pos) <= 4.2) {
      this.ponchoGrenadeStash.isClaimed = true;
      if (audio && audio.playM41aGrenadeLaunch) audio.playM41aGrenadeLaunch();

      player.m41aGrenadeCharges = Math.min(8, (player.m41aGrenadeCharges || 0) + 6);
      player.medicompCharges = Math.min(6, (player.medicompCharges || 0) + 2);
      if (player.addScore) player.addScore(1800);

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement('💣 CACHE DU LANCE-GRENADES 40MM DE PONCHO (PREDATOR 1987) : MUNITIONS EXPLOSIVES RÉCUPÉRÉES (+6 GRENADES 40MM, +2 MEDICOMP) !', 'success');
      }
      return true;
    }
    return false;
  }

  // Val Verde Master Interaction: Rick Hawkins' Encrypted Radio Relay Beacon
  checkHawkinsRelayInteraction(player, ui, audio) {
    if (!this.hawkinsRadioBeacon || !player || !player.position || this.hawkinsRadioBeacon.isActivated) return false;
    if (player.position.distanceTo(this.hawkinsRadioBeacon.pos) <= 4.2) {
      this.hawkinsRadioBeacon.isActivated = true;
      if (audio && audio.playHueyRadioStatic) audio.playHueyRadioStatic();

      if (player.applyHawkinsScan) player.applyHawkinsScan(35.0);
      if (player.addScore) player.addScore(1500);

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement('📡 BALISE RADIO TACTIQUE DE HAWKINS (PREDATOR 1987) : FRÉQUENCES CLAN DESTOCKÉES (DÉTECTION INFRAROUGE 35S, +1500 SCORE) !', 'success');
      }
      return true;
    }
    return false;
  }

  // Val Verde Master Interaction: Waterfall Plunge & Deep Mud Basin
  checkValVerdeMudPlunge(player, ui, audio) {
    if (!this.mudWaterfallBasin || !player || !player.position) return false;
    if (player.position.distanceTo(this.mudWaterfallBasin.pos) <= 4.5) {
      if (this.mudWaterfallBasin.cooldown > 0) return false;
      this.mudWaterfallBasin.cooldown = 20.0;
      if (audio && audio.playRiverWaterWadeSquelch) audio.playRiverWaterWadeSquelch();

      player.isMudCamouflaged = true;
      player.mudCamouflageTimer = 30.0;
      player.hp = Math.min(player.maxHp, player.hp + 60);

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement('🌊 PLONGEON DANS LA CASCADE & BASSIN DE BOUE (PREDATOR 1987) : IMMUNITÉ THERMIQUE ABSOLUE 30S (+60 PV RESTAURÉS) !', 'success');
      }
      return true;
    }
    return false;
  }

  /* === SECTOR 2 & SOFIA LEVEL DESIGN (v56.5): LA Rooftops Helipad, Water Tower & Spire (Predator 2 1990) === */
  buildLARooftopExpansionProps() {
    const group = new THREE.Group();
    const concreteMat = new THREE.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.85, metalness: 0.15 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x543d2b, roughness: 0.9 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x27272a, metalness: 0.9, roughness: 0.2 });
    const neonMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    const verdigrisMat = new THREE.MeshStandardMaterial({ color: 0x0d9488, metalness: 0.7, roughness: 0.4 });

    // 1. Central Elevated Helipad Platform (radius 7m, elevation +4.5m)
    const helipadPos = new THREE.Vector3(0, 0, 0);
    const helipadGroup = new THREE.Group();
    helipadGroup.position.copy(helipadPos);

    const deck = new THREE.Mesh(new THREE.CylinderGeometry(7.0, 7.4, 4.5, 24), concreteMat);
    deck.position.y = 2.25;
    deck.receiveShadow = true;
    helipadGroup.add(deck);

    // Helipad 'H' letter marking on floor
    const hBar1 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 5.0), neonMat);
    hBar1.position.set(-1.8, 4.52, 0);
    const hBar2 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 5.0), neonMat);
    hBar2.position.set(1.8, 4.52, 0);
    const hCross = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.05, 0.8), neonMat);
    hCross.position.set(0, 4.52, 0);
    helipadGroup.add(hBar1);
    helipadGroup.add(hBar2);
    helipadGroup.add(hCross);

    // Four original access slopes preserve every cardinal route out of the
    // insertion sector; this gameplay layout is not a measured film helipad.
    const accesses = [], rampRecords = [];
    for (const [id, x, z, yaw, bottom, top, bounds, heightAt] of [
      ['south', 0, -10.5, 0, [0, 0, -14], [0, 4.5, -7], { minX: -2.4, maxX: 2.4, minZ: -14, maxZ: -7 }, (_x, z) => (z + 14) / 7 * 4.5],
      ['north', 0, 10.5, Math.PI, [0, 0, 14], [0, 4.5, 7], { minX: -2.4, maxX: 2.4, minZ: 7, maxZ: 14 }, (_x, z) => (14 - z) / 7 * 4.5],
      ['west', -10.5, 0, Math.PI / 2, [-14, 0, 0], [-7, 4.5, 0], { minX: -14, maxX: -7, minZ: -2.4, maxZ: 2.4 }, (x) => (x + 14) / 7 * 4.5],
      ['east', 10.5, 0, -Math.PI / 2, [14, 0, 0], [7, 4.5, 0], { minX: 7, maxX: 14, minZ: -2.4, maxZ: 2.4 }, (x) => (14 - x) / 7 * 4.5]
    ]) {
      const ramp = new THREE.Mesh(walkRampGeometry(4.8, 7, 4.5), concreteMat); ramp.position.set(x, 0, z); ramp.rotation.y = yaw; helipadGroup.add(ramp);
      const access = { bottom, top }; accesses.push(access); rampRecords.push({ mesh: ramp, id, bounds, heightAt, accesses: [access] });
    }
    const onAccess = position => rampRecords.some(ramp => position.x >= ramp.bounds.minX - .3 && position.x <= ramp.bounds.maxX + .3 && position.z >= ramp.bounds.minZ - .3 && position.z <= ramp.bounds.maxZ + .3 && position.y >= ramp.heightAt(position.x, position.z) - .65);
    const resolveBody = (position, radius) => {
      if (position.y >= 4.4 || onAccess(position)) return;
      const distance = Math.hypot(position.x, position.z), clearance = 7.4 + radius;
      if (distance >= clearance) return;
      if (distance < 1e-6) { position.z = clearance; return; }
      position.x *= clearance / distance; position.z *= clearance / distance;
    };
    this.registerReferenceWalkSurface?.(deck, { id: 'la-helipad-deck', kind: 'solid-deck', bounds: { minX: -7, maxX: 7, minZ: -7, maxZ: 7 },
      heightAt: (x, z) => Math.hypot(x, z) <= 7 ? 4.5 : null, accesses });
    for (const record of rampRecords) this.registerReferenceWalkSurface?.(record.mesh, { id: `la-helipad-${record.id}-ramp`, kind: 'ramp', bounds: record.bounds, heightAt: record.heightAt, accesses: record.accesses });
    this.colliders.push({ x: 0, z: 0, radius: 7.4, baseY: 0, height: 4.25, owner: 'la-helipad-body',
      resolveMovement: resolveBody, isNavigationActive: position => !onAccess(position) });

    // 8 perimeter yellow caution beacon lights
    for (let b = 0; b < 8; b++) {
      const a = (b / 8) * Math.PI * 2;
      const lightMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.6, 8), metalMat);
      lightMesh.position.set(Math.cos(a) * 6.8, 4.8, Math.sin(a) * 6.8);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 6), neonMat);
      bulb.position.set(Math.cos(a) * 6.8, 5.2, Math.sin(a) * 6.8);
      helipadGroup.add(lightMesh);
      helipadGroup.add(bulb);
    }

    group.add(helipadGroup);

    // 2. Rupturable Cedar Water Tower at [-25, 0, 22]
    const towerPos = new THREE.Vector3(-25, 0, 22);
    const towerGroup = new THREE.Group();
    towerGroup.position.copy(towerPos);

    // 4 timber legs
    for (let s = 0; s < 4; s++) {
      const a = (s / 4) * Math.PI * 2 + Math.PI / 4;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 4.8, 6), metalMat);
      leg.position.set(Math.cos(a) * 2.2, 2.4, Math.sin(a) * 2.2);
      towerGroup.add(leg);
    }

    // Wooden vat (radius 2.5m, height 4.2m)
    const vat = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 4.2, 16), woodMat);
    vat.position.y = 6.6;
    towerGroup.add(vat);

    // Steel bands
    for (let h = 0; h < 3; h++) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(2.55, 0.08, 6, 16), metalMat);
      band.rotation.x = Math.PI / 2;
      band.position.y = 5.2 + h * 1.3;
      towerGroup.add(band);
    }

    // Conical timber roof
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.9, 1.8, 16), woodMat);
    roof.position.y = 9.6;
    towerGroup.add(roof);

    group.add(towerGroup);

    // 3. Eastern Columbia Spire, Gargoyle Perch & Lightning Rod at [28, 0, -26] (+12.0m)
    const spireGroup = new THREE.Group();
    spireGroup.position.set(28, 0, -26);
    const spireBase = new THREE.Mesh(new THREE.BoxGeometry(4.5, 12, 4.5), verdigrisMat);
    spireBase.position.y = 6;
    spireGroup.add(spireBase);

    // Gargoyle Balcony Platform (+12.0m)
    const gargoylePlatform = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.4, 4.8), verdigrisMat);
    gargoylePlatform.position.y = 12.0;
    spireGroup.add(gargoylePlatform);

    // Art Deco Eagle Gargoyle projecting toward the storm
    const eagle = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.2, 4), verdigrisMat);
    eagle.position.set(0, 12.4, 2.6);
    eagle.rotation.x = Math.PI / 3;
    spireGroup.add(eagle);

    // Access ladder on north face
    const ladder = new THREE.Mesh(new THREE.BoxGeometry(0.8, 12.0, 0.1), metalMat);
    ladder.position.set(0, 6.0, 2.3);
    spireGroup.add(ladder);

    const spireCone = new THREE.Mesh(new THREE.ConeGeometry(2.2, 9, 8), verdigrisMat);
    spireCone.position.y = 16.5;
    spireGroup.add(spireCone);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4.5, 6), metalMat);
    rod.position.y = 23;
    spireGroup.add(rod);

    // Crackling blue electrical corona glow at rod tip
    const coronaLight = new THREE.PointLight(0x38bdf8, 2.2, 14.0);
    coronaLight.position.set(0, 23.5, 0);
    spireGroup.add(coronaLight);

    group.add(spireGroup);
    this.easternColumbiaSpire = {
      group: spireGroup,
      pos: new THREE.Vector3(28, 12.0, -26),
      rodPos: new THREE.Vector3(28, 23.0, -26),
      light: coronaLight,
      cooldown: 0
    };

    // 4. Suspended Facade Window-Washing Cradle at [0, 7.5, 28] (+7.5m altitude)
    const cradleGroup = new THREE.Group();
    cradleGroup.position.set(0, 7.5, 28);

    const cradleFloor = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.25, 2.4), metalMat);
    cradleGroup.add(cradleFloor);

    // Safety rails
    for (let c = 0; c < 4; c++) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 4), metalMat);
      post.position.set(c < 2 ? -2.7 : 2.7, 0.6, c % 2 === 0 ? -1.0 : 1.0);
      cradleGroup.add(post);
    }

    // Suspension cables
    [-2.6, 2.6].forEach(cx => {
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 14.0, 4), metalMat);
      cable.position.set(cx, 7.0, 0);
      cradleGroup.add(cable);
    });

    // Connecting gangway from helipad/roof (+4.5m) to cradle (+7.5m)
    const gangway = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.2, 4.4), concreteMat);
    gangway.position.set(0, 6.0, 24.5);
    gangway.rotation.x = Math.atan2(3.0, 4.0);
    gangway.receiveShadow = true;
    group.add(gangway);

    group.add(cradleGroup);
    this.windowCradle = { cradlePos: new THREE.Vector3(0, 7.5, 28) };

    // 5. Industrial Rooftop HVAC Chiller Units at [-16, 0, -18]
    this.hvacChillers = [];
    const hvacGroup = new THREE.Group();
    hvacGroup.position.set(-16, 0, -18);

    const hvacBox = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.4, 3.2), metalMat);
    hvacBox.position.y = 1.2;
    hvacBox.castShadow = true;
    hvacGroup.add(hvacBox);

    // Spinning aluminum condenser fan
    const fanGeo = new THREE.BoxGeometry(1.6, 0.08, 0.25);
    const fanMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8 });
    const fanMesh = new THREE.Mesh(fanGeo, fanMat);
    fanMesh.position.set(0, 2.45, 0);
    hvacGroup.add(fanMesh);

    group.add(hvacGroup);
    this.hvacChillers.push({
      group: hvacGroup,
      fan: fanMesh,
      pos: new THREE.Vector3(-16, 1.2, -18),
      isRuptured: false,
      hp: 120
    });

    // 6. OWLF Slaughterhouse Meat Locker Facility & Conveyor Hooks [-28, 0, -12]
    const meatMat = new THREE.MeshStandardMaterial({ color: 0x881337, roughness: 0.65 });
    const brickMat = new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.95 });
    const copperMat = new THREE.MeshStandardMaterial({ color: 0xb45309, metalness: 0.7, roughness: 0.3 });
    const neonPinkMat = new THREE.MeshBasicMaterial({ color: 0xec4899 });
    const neonAmberMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const boneMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.7 });
    const policeBlackMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.4, metalness: 0.6 });
    const policeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf4f4f5, roughness: 0.4 });

    const meatGroup = new THREE.Group();
    meatGroup.position.set(-28, 0, -12);

    const meatBldg = new THREE.Mesh(new THREE.BoxGeometry(9.0, 5.2, 12.0), metalMat);
    meatBldg.position.y = 2.6;
    meatBldg.receiveShadow = true;
    meatGroup.add(meatBldg);

    // Overhead I-beam meat rail (+4.8m)
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 10.0), metalMat);
    rail.position.set(0, 4.8, 0);
    meatGroup.add(rail);

    // 6 Hanging Beef Carcasses on steel hooks
    for (let c = 0; c < 6; c++) {
      const cz = -4.0 + c * 1.6;
      const hook = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.03, 4, 8, Math.PI), metalMat);
      hook.position.set(0, 4.4, cz);
      meatGroup.add(hook);

      const beef = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 2.2, 8), meatMat);
      beef.position.set(0, 3.1, cz);
      meatGroup.add(beef);
    }

    // Cryo valve console
    const valveStand = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.2, 6), metalMat);
    valveStand.position.set(2.0, 0.6, 0);
    meatGroup.add(valveStand);

    const valveWheel = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.04, 4, 12), neonMat);
    valveWheel.position.set(2.0, 1.2, 0);
    meatGroup.add(valveWheel);

    group.add(meatGroup);
    this.meatLockerFacility = {
      group: meatGroup,
      pos: new THREE.Vector3(-28, 0, -12),
      valvePos: new THREE.Vector3(-26, 1.2, -12),
      isRuptured: false,
      cooldown: 0
    };

    // 7. King Willie's Jamaican Voodoo Rooftop Altar & Polished Skull [18, 0, 24]
    const voodooGroup = new THREE.Group();
    voodooGroup.position.set(18, 0, 24);

    const cistern = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.2, 2.8, 12), brickMat);
    cistern.position.y = 1.4;
    cistern.receiveShadow = true;
    voodooGroup.add(cistern);

    const chalkCircle = new THREE.Mesh(new THREE.RingGeometry(1.8, 2.4, 16), new THREE.MeshBasicMaterial({ color: 0xfef08a, side: THREE.DoubleSide }));
    chalkCircle.rotation.x = -Math.PI / 2;
    chalkCircle.position.y = 2.82;
    voodooGroup.add(chalkCircle);

    const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.7), metalMat);
    plinth.position.y = 3.2;
    voodooGroup.add(plinth);

    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 8), boneMat);
    skull.position.set(0, 3.75, 0);
    voodooGroup.add(skull);

    for (let cn = 0; cn < 6; cn++) {
      const a = (cn / 6) * Math.PI * 2;
      const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.35, 6), new THREE.MeshBasicMaterial({ color: 0xd97706 }));
      candle.position.set(Math.cos(a) * 1.5, 2.98, Math.sin(a) * 1.5);
      voodooGroup.add(candle);
    }

    const voodooLight = new THREE.PointLight(0xf59e0b, 1.8, 7.0);
    voodooLight.position.set(0, 3.8, 0);
    voodooGroup.add(voodooLight);

    group.add(voodooGroup);
    this.kingWillieAltar = {
      group: voodooGroup,
      pos: new THREE.Vector3(18, 2.8, 24),
      isClaimed: false
    };

    // 8. Danny Boy Archuleta's Netgun Concrete Wall Embedment [-10, 0, 32]
    const dannyGroup = new THREE.Group();
    dannyGroup.position.set(-10, 0, 32);

    const pWall = new THREE.Mesh(new THREE.BoxGeometry(5.0, 2.8, 0.6), concreteMat);
    pWall.position.y = 1.4;
    dannyGroup.add(pWall);

    const netMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.0, 6, 6), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
    netMesh.position.set(0, 1.4, 0.32);
    dannyGroup.add(netMesh);

    const spearTip = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.7, 4), metalMat);
    spearTip.rotation.x = Math.PI / 2;
    spearTip.position.set(0.4, 1.6, 0.35);
    dannyGroup.add(spearTip);

    group.add(dannyGroup);
    this.dannyBoyNetgun = {
      group: dannyGroup,
      pos: new THREE.Vector3(-10, 1.4, 32),
      isClaimed: false
    };

    // 9. Subterranean Lost Tribe Mother Ship Docking Hatch & Trophy Dais [0, 0, -32]
    const tribeGroup = new THREE.Group();
    tribeGroup.position.set(0, 0, -32);

    const hatchDais = new THREE.Mesh(new THREE.CylinderGeometry(5.0, 5.4, 1.5, 16), metalMat);
    hatchDais.position.y = 0.75;
    tribeGroup.add(hatchDais);

    const shutterRing = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.25, 6, 16), verdigrisMat);
    shutterRing.rotation.x = Math.PI / 2;
    shutterRing.position.y = 1.52;
    tribeGroup.add(shutterRing);

    const obsPed = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4, 1.2), new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.2 }));
    obsPed.position.set(0, 2.2, 0);
    tribeGroup.add(obsPed);

    const craniumMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.3, metalness: 0.8 });
    const dome = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 1.4, 8), craniumMat);
    dome.rotation.x = Math.PI / 2;
    dome.position.set(0, 3.0, 0.2);
    tribeGroup.add(dome);

    const casket = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.35), copperMat);
    casket.position.set(0, 2.92, -0.4);
    tribeGroup.add(casket);

    const clanLight = new THREE.PointLight(0x06b6d4, 2.4, 9.0);
    clanLight.position.set(0, 3.2, 0);
    tribeGroup.add(clanLight);

    group.add(tribeGroup);
    this.lostTribeShipDais = {
      group: tribeGroup,
      pos: new THREE.Vector3(0, 1.5, -32),
      isClaimed: false
    };

    // 10. City Hunter's Penthouse Emergency Medi-Kit Cauterization Station [-20, 0, 6]
    const surgGroup = new THREE.Group();
    surgGroup.position.set(-20, 0, 6);

    const skylight = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.2, 4.2), metalMat);
    skylight.position.y = 0.1;
    surgGroup.add(skylight);

    const medCrate = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 1.0), concreteMat);
    medCrate.position.set(0, 0.4, 0);
    surgGroup.add(medCrate);

    const kitCase = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.25, 0.7), copperMat);
    kitCase.position.set(0, 0.9, 0);
    surgGroup.add(kitCase);

    const blueSolvent = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.3, 6), new THREE.MeshBasicMaterial({ color: 0x06b6d4 }));
    blueSolvent.position.set(0.3, 1.05, 0);
    surgGroup.add(blueSolvent);

    const blueLight = new THREE.PointLight(0x06b6d4, 1.8, 6.0);
    blueLight.position.set(0, 1.2, 0);
    surgGroup.add(blueLight);

    group.add(surgGroup);
    this.cityHunterSurgery = {
      group: surgGroup,
      pos: new THREE.Vector3(-20, 1.0, 6),
      isUsed: false
    };

    // 11. Giant 1990 L.A. Heat Wave Neon Signs & Transformer [-35, 2, 0]
    const neonGroup = new THREE.Group();
    neonGroup.position.set(-35, 0, 0);

    const truss = new THREE.Mesh(new THREE.BoxGeometry(1.0, 14.0, 16.0), metalMat);
    truss.position.y = 7.0;
    neonGroup.add(truss);

    const amberBoard = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.2, 14.0), new THREE.MeshBasicMaterial({ color: 0x09090b }));
    amberBoard.position.set(0.6, 11.5, 0);
    neonGroup.add(amberBoard);

    const neon109 = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.8, 11.0), neonAmberMat);
    neon109.position.set(0.65, 11.5, 0);
    neonGroup.add(neon109);

    const pinkBoard = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.6, 9.0), neonPinkMat);
    pinkBoard.position.set(0.65, 7.5, 0);
    neonGroup.add(pinkBoard);

    const transBox = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.2, 1.4), metalMat);
    transBox.position.set(1.2, 1.1, 0);
    neonGroup.add(transBox);

    group.add(neonGroup);
    this.neonTransformer = {
      group: neonGroup,
      pos: new THREE.Vector3(-35, 2.0, 0),
      isOverloaded: false
    };

    // 12. Lieutenant Mike Harrigan's LAPD SWAT Cruiser Barricade [22, 0, 6]
    const cruiserGroup = new THREE.Group();
    cruiserGroup.position.set(22, 0, 6);

    const carBody = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.1, 5.0), policeBlackMat);
    carBody.position.y = 0.75;
    cruiserGroup.add(carBody);

    const carRoof = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.8, 2.4), policeWhiteMat);
    carRoof.position.set(0, 1.6, -0.2);
    cruiserGroup.add(carRoof);

    const blueBar = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.15, 0.25), new THREE.MeshBasicMaterial({ color: 0x3b82f6 }));
    blueBar.position.set(-0.5, 2.1, -0.2);
    cruiserGroup.add(blueBar);

    const redBar = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.15, 0.25), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
    redBar.position.set(0.5, 2.1, -0.2);
    cruiserGroup.add(redBar);

    const penthouseBlueLight = new THREE.PointLight(0x3b82f6, 2.0, 10.0);
    penthouseBlueLight.position.set(-0.5, 2.2, -0.2);
    cruiserGroup.add(penthouseBlueLight);

    const redLight = new THREE.PointLight(0xef4444, 2.0, 10.0);
    redLight.position.set(0.5, 2.2, -0.2);
    cruiserGroup.add(redLight);

    group.add(cruiserGroup);
    this.harriganCruiser = {
      group: cruiserGroup,
      pos: new THREE.Vector3(22, 1.2, 6),
      isLooted: false,
      lightBlue: blueLight,
      lightRed: redLight,
      lightTimer: 0
    };

    // 13. City Hunter's Dislodged Smart-Disc in the Steel Girder [-4, 0, -14]
    const girderGroup = new THREE.Group();
    girderGroup.position.set(-4, 0, -14);

    const girder = new THREE.Mesh(new THREE.BoxGeometry(0.6, 4.5, 0.6), metalMat);
    girder.position.y = 2.25;
    girderGroup.add(girder);

    const discMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.95, roughness: 0.1 });
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.06, 16), discMat);
    disc.rotation.x = Math.PI / 2;
    disc.position.set(0, 1.6, 0.32);
    girderGroup.add(disc);

    const discLight = new THREE.PointLight(0xf59e0b, 1.6, 5.0);
    discLight.position.set(0, 1.6, 0.4);
    girderGroup.add(discLight);

    group.add(girderGroup);
    this.smartDiscGirder = {
      group: girderGroup,
      discMesh: disc,
      pos: new THREE.Vector3(-4, 1.6, -14),
      isRetrieved: false
    };

    // 14. Subway Metro Transit Car #666 (The Strobe-Lit Train Massacre) [-24, 0, -36] (+3.6m)
    const subwayGroup = new THREE.Group();
    subwayGroup.position.set(-24, 0, -36);

    // Elevated concrete spur pier pillars
    for (let p = 0; p < 3; p++) {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(2.0, 3.6, 2.0), concreteMat);
      pier.position.set(-8.0 + p * 8.0, 1.8, 0);
      subwayGroup.add(pier);
    }

    // Steel spur track rails
    const rail1 = new THREE.Mesh(new THREE.BoxGeometry(24.0, 0.2, 0.2), metalMat);
    rail1.position.set(0, 3.6, -1.0);
    subwayGroup.add(rail1);
    const rail2 = new THREE.Mesh(new THREE.BoxGeometry(24.0, 0.2, 0.2), metalMat);
    rail2.position.set(0, 3.6, 1.0);
    subwayGroup.add(rail2);

    // Stainless steel subway transit carriage (Length 18m, Width 3.6m, Height 3.4m)
    const carMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.25 });
    const carBodyReference2 = new THREE.Mesh(new THREE.BoxGeometry(18.0, 3.4, 3.6), carMat);
    carBodyReference2.position.y = 5.3;
    carBodyReference2.castShadow = true;
    subwayGroup.add(carBodyReference2);

    // Red MTA warning stripe
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(18.05, 0.4, 3.65), new THREE.MeshBasicMaterial({ color: 0xdc2626 }));
    stripe.position.y = 4.8;
    subwayGroup.add(stripe);

    // Flickering interior strobe light
    const strobeLight = new THREE.PointLight(0xffffff, 2.5, 12.0);
    strobeLight.position.set(3.0, 5.8, 0);
    subwayGroup.add(strobeLight);

    // Jerry Lambert's Machete and Desert Eagle on the carriage floor
    const macheteBlade = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.04, 0.12), metalMat);
    macheteBlade.position.set(3.0, 3.8, 0.4);
    subwayGroup.add(macheteBlade);

    const desertEagle = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 0.08), metalMat);
    desertEagle.position.set(3.4, 3.8, 0.2);
    subwayGroup.add(desertEagle);

    group.add(subwayGroup);
    this.subwayCar666 = {
      group: subwayGroup,
      pos: new THREE.Vector3(-21, 3.8, -36),
      light: strobeLight,
      strobeTimer: 0,
      isClaimed: false
    };

    // 15. Peter Keyes's OWLF Surveillance Command Trailer [-28, 0, 8] (+3.2m)
    const owlfGroup = new THREE.Group();
    owlfGroup.position.set(-28, 0, 8);

    const vanMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.8, metalness: 0.2 });
    const vanBody = new THREE.Mesh(new THREE.BoxGeometry(7.0, 3.2, 3.4), vanMat);
    vanBody.position.y = 1.6;
    vanBody.receiveShadow = true;
    vanBody.castShadow = true;
    owlfGroup.add(vanBody);

    // Spinning parabolic microwave radar dish on van roof
    const dishMat = new THREE.MeshStandardMaterial({ color: 0x52525b, metalness: 0.8 });
    const radarDish = new THREE.Mesh(new THREE.SphereGeometry(1.2, 8, 8, 0, Math.PI), dishMat);
    radarDish.position.set(-1.5, 3.8, 0);
    radarDish.rotation.z = Math.PI / 4;
    owlfGroup.add(radarDish);

    // Workstation table with UV telemetry monitors
    const monDesk = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.8, 1.0), metalMat);
    monDesk.position.set(3.0, 0.4, 0);
    owlfGroup.add(monDesk);

    const crtScreen = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.5), new THREE.MeshBasicMaterial({ color: 0x22c55e }));
    crtScreen.position.set(3.0, 1.1, 0);
    owlfGroup.add(crtScreen);

    const uvLight = new THREE.PointLight(0x22c55e, 2.0, 8.0);
    uvLight.position.set(3.0, 1.4, 0);
    owlfGroup.add(uvLight);

    group.add(owlfGroup);
    this.owlfCommandVan = {
      group: owlfGroup,
      pos: new THREE.Vector3(-25, 1.2, 8),
      radarDish: radarDish,
      isScanned: false
    };

    // 16. El Scorpio's Colombian Cartel Penthouse Drug Lab [32, 0, 18] (+3.8m)
    const cartelGroup = new THREE.Group();
    cartelGroup.position.set(32, 0, 18);

    // Elevated marble floor platform
    const marbleMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.3, metalness: 0.4 });
    const pFloor = new THREE.Mesh(new THREE.BoxGeometry(9.0, 0.4, 9.0), marbleMat);
    pFloor.position.y = 3.8;
    pFloor.receiveShadow = true;
    cartelGroup.add(pFloor);

    // Overturned leather sofa
    const sofaMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.8 });
    const sofa = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.8, 1.2), sofaMat);
    sofa.position.set(-2.0, 4.4, 1.5);
    sofa.rotation.z = 0.35;
    cartelGroup.add(sofa);

    // Desk with gold dual Uzis & ammunition cash crates
    const goldDesk = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8, 1.0), woodMat);
    goldDesk.position.set(1.5, 4.2, 0);
    cartelGroup.add(goldDesk);

    const goldMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.95, roughness: 0.1 });
    const uzi1 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.08), goldMat);
    uzi1.position.set(1.2, 4.7, 0.2);
    cartelGroup.add(uzi1);
    const uzi2 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.08), goldMat);
    uzi2.position.set(1.8, 4.7, -0.2);
    cartelGroup.add(uzi2);

    const amberPentLight = new THREE.PointLight(0xf59e0b, 1.8, 8.0);
    amberPentLight.position.set(0, 5.5, 0);
    cartelGroup.add(amberPentLight);

    group.add(cartelGroup);
    this.cartelPenthouse = {
      group: cartelGroup,
      pos: new THREE.Vector3(32, 3.8, 18),
      isLooted: false
    };

    // 17. City Hunter's Combi-Stick Pole-Vault Catapult Launch Pad [12, 4.5, -6]
    const vaultPadGroup = new THREE.Group();
    vaultPadGroup.position.set(12, 4.5, -6);

    const padDeck = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.1, 4.2), new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
    padDeck.rotation.y = Math.atan2(16, -20);
    vaultPadGroup.add(padDeck);

    // Spring chevron stripes
    const chevron = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 3.6), new THREE.MeshBasicMaterial({ color: 0x09090b }));
    chevron.rotation.y = padDeck.rotation.y;
    vaultPadGroup.add(chevron);

    group.add(vaultPadGroup);
    this.poleVaultPad = {
      group: vaultPadGroup,
      pos: new THREE.Vector3(12, 4.5, -6),
      targetPos: new THREE.Vector3(28, 12.0, -26)
    };

    // 18. Tenement Fire Escape Metal Stairwells [21, 0, 10]
    const stairsGroup = new THREE.Group();
    stairsGroup.position.set(21, 0, 10);

    // Platform 1 (+2.5m)
    const plat1 = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.15, 2.4), metalMat);
    plat1.position.set(-1.5, 2.5, 0);
    stairsGroup.add(plat1);

    // Platform 2 (+5.0m)
    const plat2 = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.15, 2.4), metalMat);
    plat2.position.set(1.5, 5.0, 0);
    stairsGroup.add(plat2);

    // Steel stair ramps
    const ramp1 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.15, 3.5), metalMat);
    ramp1.position.set(-1.5, 1.25, 1.8);
    ramp1.rotation.x = Math.atan2(2.5, 3.5);
    stairsGroup.add(ramp1);

    group.add(stairsGroup);
    this.fireEscapeStairs = {
      group: stairsGroup,
      pos: new THREE.Vector3(21, 0, 10)
    };

    // 19. Roofer's Boiling Tar Kettle & Propane Burner [-12, 0, 14]
    const tarGroup = new THREE.Group();
    tarGroup.position.set(-12, 0, 14);

    // Heavy iron cauldron
    const cauldron = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.7, 1.4, 12), metalMat);
    cauldron.position.y = 0.9;
    tarGroup.add(cauldron);

    // Bubbling black pitch surface
    const tarSurface = new THREE.Mesh(new THREE.CircleGeometry(0.85, 12), new THREE.MeshBasicMaterial({ color: 0x0a0a0a }));
    tarSurface.rotation.x = -Math.PI / 2;
    tarSurface.position.y = 1.55;
    tarGroup.add(tarSurface);

    // Blue propane flame
    const propaneFlame = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.5, 8), new THREE.MeshBasicMaterial({ color: 0x0284c7 }));
    propaneFlame.position.y = 0.25;
    tarGroup.add(propaneFlame);

    const flameLight = new THREE.PointLight(0x0284c7, 2.2, 6.0);
    flameLight.position.set(0, 0.5, 0);
    tarGroup.add(flameLight);

    group.add(tarGroup);
    this.boilingTarKettle = {
      group: tarGroup,
      pos: new THREE.Vector3(-12, 1.0, 14),
      isSpilled: false
    };

    // 20. Ramon Vega Penthouse Slashing & Hanging Execution Joists [30, 0, 30]
    const execGroup = new THREE.Group();
    execGroup.position.set(30, 0, 30);

    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 8.0), metalMat);
    beam.position.y = 4.8;
    execGroup.add(beam);

    for (let h = 0; h < 2; h++) {
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.2, 4), metalMat);
      chain.position.set(0, 3.6, -2.0 + h * 4.0);
      execGroup.add(chain);

      const victim = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 1.6, 6), meatMat);
      victim.position.set(0, 2.2, -2.0 + h * 4.0);
      execGroup.add(victim);
    }

    group.add(execGroup);

    this.addReferenceObject(group);
    this.envObjects.push(group);

    this.laRooftopExpansion = {
      group,
      helipadPos,
      towerGroup,
      towerPos,
      towerHp: 120,
      isTowerRuptured: false
    };
  }

  checkHVACChillerDamage(hitPos, dmg, audio, horde, particles, ui) {
    if (!this.hvacChillers || !hitPos) return false;
    for (const hvac of this.hvacChillers) {
      if (!hvac.isRuptured && hitPos.distanceTo(hvac.pos) <= 3.8) {
        hvac.isRuptured = true;
        if (audio && audio.playHVACFreonBurst) audio.playHVACFreonBurst();

        // Spawn expanding freon coolant cloud
        const cloudGeo = new THREE.SphereGeometry(6.5, 12, 12);
        const cloudMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.65 });
        const cloud = new THREE.Mesh(cloudGeo, cloudMat);
        cloud.position.copy(hvac.pos);
        this.addReferenceObject(cloud);

        this.activeFreonClouds.push({
          mesh: cloud,
          pos: hvac.pos.clone(),
          timer: 12.0
        });

        // Slow down xenos in freon cloud by 70%
        let frozen = 0;
        if (horde && horde.aliens) {
          horde.aliens.forEach(alien => {
            if (alien && alien.mesh && alien.hp > 0 && alien.mesh.position.distanceTo(hvac.pos) <= 10.0) {
              alien.isFrozen = true;
              alien.speedMult = 0.3;
              frozen++;
            }
          });
        }

        if (ui && ui.showAnnouncement) {
          ui.showAnnouncement(`❄️ UNITÉ HVAC FREON RUPTURÉE (PREDATOR 2) : ÉCRAN DE BRUME GLACIALE (-70% VITESSE SUR ${frozen} XÉNOS) !`, 'success');
        }
        return true;
      }
    }
    return false;
  }

  checkWaterTowerDamage(attack, audio, particles, horde, synthetics) {
    if (!this.laRooftopExpansion || !attack || !attack.origin) return;
    const t = this.laRooftopExpansion;
    if (t.isTowerRuptured) return;

    if (t.towerPos.distanceTo(attack.origin) <= (attack.radius || 2.0) + 3.8) {
      t.towerHp -= (attack.damage || 60);
      if (t.towerHp <= 0) {
        t.isTowerRuptured = true;
        this.removeReferenceObject(t.towerGroup);

        if (audio && audio.playWaterTowerDeluge) audio.playWaterTowerDeluge();

        // Expansive flood mesh
        const waterGeo = new THREE.CircleGeometry(14.0, 24);
        waterGeo.rotateX(-Math.PI / 2);
        const waterMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.65 });
        const waterMesh = new THREE.Mesh(waterGeo, waterMat);
        waterMesh.position.set(t.towerPos.x, 0.12, t.towerPos.z);
        this.addReferenceObject(waterMesh);

        this.activeWaterDeluge = {
          mesh: waterMesh,
          pos: t.towerPos.clone(),
          radius: 14.0,
          timer: 8.0
        };

        // Wash away and stagger xenos, electrocute synthetics
        if (horde && horde.aliens) {
          horde.aliens.forEach(alien => {
            if (alien && alien.mesh && alien.mesh.position.distanceTo(t.towerPos) <= 14.0) {
              alien.hp -= 220;
              alien.isStunned = true;
              alien.stunTimer = 4.0;
              alien.mesh.position.addScaledVector(alien.mesh.position.clone().sub(t.towerPos).normalize(), 8.0);
            }
          });
        }
        if (synthetics && synthetics.activeSynthetics) {
          synthetics.activeSynthetics.forEach(syn => {
            if (syn && syn.mesh && syn.mesh.position.distanceTo(t.towerPos) <= 14.0) {
              syn.hp -= 350;
              if (particles && particles.emitSparks) particles.emitSparks(syn.mesh.position, 16);
            }
          });
        }
      }
    }
  }

  /* === PREDATOR 2 (1990) LOS ANGELES ROOFTOPS APEX INTERACTION SYSTEMS (v60.0) === */

  checkEasternColumbiaLightning(player, ui, audio, horde, bosses, particles) {
    if (!this.easternColumbiaSpire || !player || !player.position) return false;
    const spire = this.easternColumbiaSpire;
    if (player.position.distanceTo(spire.pos) <= 5.0) {
      if (spire.cooldown > 0) {
        if (ui && ui.showAnnouncement) {
          ui.showAnnouncement(`⏳ FLÈCHE DE L'EASTERN COLUMBIA EN RECHARGE (${Math.ceil(spire.cooldown)}S)`);
        }
        return true;
      }
      spire.cooldown = 45.0;
      if (audio && audio.playEasternColumbiaLightningStrike) audio.playEasternColumbiaLightningStrike();

      // Supercharge player energy & stats
      player.plasmaEnergy = 100;
      player.musouEnergy = 100;
      if (player.applyLightningAura) {
        player.applyLightningAura(20.0);
      }

      // Massive lightning arc discharging down to the surrounding roof
      let shockHits = 0;
      if (horde && horde.aliens) {
        horde.aliens.forEach(alien => {
          if (alien && alien.mesh && alien.hp > 0 && alien.mesh.position.distanceTo(spire.pos) <= 24.0) {
            alien.hp -= 420;
            alien.isStunned = true;
            alien.stunTimer = 3.5;
            shockHits++;
            if (particles && particles.emitSparks) {
              particles.emitSparks(alien.mesh.position, 16);
            }
          }
        });
      }

      if (bosses && bosses.activeBosses) {
        bosses.activeBosses.forEach(boss => {
          if (boss && boss.mesh && boss.hp > 0 && boss.mesh.position.distanceTo(spire.pos) <= 24.0) {
            boss.hp -= 350;
            boss.isStunned = true;
            boss.stunTimer = 2.5;
          }
        });
      }

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement(`⚡ FOUDRE DE L'EASTERN COLUMBIA (PREDATOR 2 1990) : CANALISATION COMBI-STICK (+100% PLASMA, MUSOU MAX, AURA ÉLECTRIQUE 20S, ${shockHits} CIBLES FOUDROYÉES) !`, "warning");
      }
      return true;
    }
    return false;
  }

  checkMeatLockerCryoValve(player, ui, audio, horde, bosses, particles) {
    if (!this.meatLockerFacility || !player || !player.position) return false;
    const f = this.meatLockerFacility;
    if (player.position.distanceTo(f.valvePos) <= 4.2) {
      if (f.cooldown > 0) {
        if (ui && ui.showAnnouncement) {
          ui.showAnnouncement(`⏳ AZOTE LIQUIDE OWLF EN PRESSURISATION (${Math.ceil(f.cooldown)}S)`);
        }
        return true;
      }
      f.cooldown = 40.0;
      if (audio && audio.playSlaughterhouseCryoBlast) audio.playSlaughterhouseCryoBlast();

      // Spawn massive expanding cryogenic cloud
      const cloudGeo = new THREE.SphereGeometry(12.0, 16, 16);
      const cloudMat = new THREE.MeshBasicMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.65 });
      const cloud = new THREE.Mesh(cloudGeo, cloudMat);
      cloud.position.copy(f.pos).setY(2.5);
      this.addReferenceObject(cloud);

      this.activeMeatLockerCryo = {
        mesh: cloud,
        pos: f.pos.clone(),
        timer: 10.0
      };

      let frozenCount = 0;
      if (horde && horde.aliens) {
        horde.aliens.forEach(alien => {
          if (alien && alien.mesh && alien.hp > 0 && alien.mesh.position.distanceTo(f.pos) <= 18.0) {
            alien.hp -= 280;
            alien.isFrozen = true;
            alien.speedMult = 0.2;
            alien.isStunned = true;
            alien.stunTimer = 6.0;
            frozenCount++;
          }
        });
      }

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement(`❄️ VALVE D'AZOTE LIQUIDE DE L'ABATTOIR OWLF (PREDATOR 2 1990) : DÉLUGE CRYOGÉNIQUE (${frozenCount} XÉNOS GELÉS, 280 DMG, STUN 6S) !`, "success");
      }
      return true;
    }
    return false;
  }

  checkKingWillieAltarInteraction(player, ui, audio) {
    if (!this.kingWillieAltar || !player || !player.position || this.kingWillieAltar.isClaimed) return false;
    if (player.position.distanceTo(this.kingWillieAltar.pos) <= 4.2) {
      this.kingWillieAltar.isClaimed = true;
      if (audio && audio.playKingWillieChant) audio.playKingWillieChant();

      if (player.recordTrophy) {
        player.recordTrophy("CRÂNE POLI DE KING WILLIE (VOODOO POSSE 1990)", 2500);
      }
      if (player.applyVoodooSight) {
        player.applyVoodooSight(35.0);
      }
      if (this.game) {
        this.game.score += 2500;
      }

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement("💀 AUTEL VOODOO DE KING WILLIE (PREDATOR 2 1990) : 'ON NE PEUT PAS VOIR LES YEUX DU DÉMON...' (+2500 HONNEUR, VISION THERMIQUE ÉTENDUE 35S) !", "success");
      }
      return true;
    }
    return false;
  }

  checkDannyBoyNetgunInteraction(player, ui, audio) {
    if (!this.dannyBoyNetgun || !player || !player.position || this.dannyBoyNetgun.isClaimed) return false;
    if (player.position.distanceTo(this.dannyBoyNetgun.pos) <= 4.2) {
      this.dannyBoyNetgun.isClaimed = true;
      if (audio && audio.playNetgunConstrictionSlice) audio.playNetgunConstrictionSlice();

      player.traxNetAmmo = Math.min(10, (player.traxNetAmmo || 0) + 4);
      player.combistickAmmo = Math.min(6, (player.combistickAmmo || 0) + 2);
      if (this.game) {
        this.game.score += 1200;
      }

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement("🕸️ FILET MICROCÂBLE DE DANNY BOY (PREDATOR 2 1990) : HARPON ET FILETS RÉCUPÉRÉS (+4 FILETS, +2 HARPONS, +1200 SCORE) !", "success");
      }
      return true;
    }
    return false;
  }

  checkLostTribeTrophyInteraction(player, ui, audio) {
    if (!this.lostTribeShipDais || !player || !player.position || this.lostTribeShipDais.isClaimed) return false;
    if (player.position.distanceTo(this.lostTribeShipDais.pos) <= 4.5) {
      this.lostTribeShipDais.isClaimed = true;
      if (audio && audio.playLostTribeElderChime) audio.playLostTribeElderChime();

      if (player.recordTrophy) {
        player.recordTrophy("CRÂNE DE DRONE XÉNOMORPHE 1990 (LOST TRIBE MOTHER SHIP)", 3000);
      }
      if (player.applyFlintlockKineticBuff) {
        player.applyFlintlockKineticBuff(30.0);
      }
      if (this.game) {
        this.game.score += 3000;
      }

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement("🛸 VAISSEAU-MÈRE DU LOST TRIBE & ANCIEN GREYBACK (PREDATOR 2 1990) : 'TAKE IT.' (+3000 HONNEUR, PISTOLET ADOLINI 1715, IMPACT x2 30S) !", "success");
      }
      return true;
    }
    return false;
  }

  checkCityHunterSurgeryInteraction(player, ui, audio) {
    if (!this.cityHunterSurgery || !player || !player.position || this.cityHunterSurgery.isUsed) return false;
    if (player.position.distanceTo(this.cityHunterSurgery.pos) <= 4.2) {
      this.cityHunterSurgery.isUsed = true;
      if (audio && audio.playCityHunterCauterization) audio.playCityHunterCauterization();

      player.hp = Math.min(player.maxHp || 1000, player.hp + 400);
      player.armor = player.maxArmor || 600;
      player.medicompCharges = Math.min(6, (player.medicompCharges || 0) + 3);
      player.isBleeding = false;
      player.bleedTimer = 0;

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement("💉 CHIRURGIE D'URGENCE DU CITY HUNTER (PREDATOR 2 1990) : CAUTÉRISATION AU SOLVANT BLEU (+400 PV, BLINDAGE 100%, +3 MEDICOMP) !", "success");
      }
      return true;
    }
    return false;
  }

  checkHarriganCruiserLoot(player, ui, audio) {
    if (!this.harriganCruiser || !player || !player.position || this.harriganCruiser.isLooted) return false;
    if (player.position.distanceTo(this.harriganCruiser.pos) <= 4.2) {
      this.harriganCruiser.isLooted = true;
      if (audio && audio.playHopperSatchelOpen) audio.playHopperSatchelOpen();

      player.m41aGrenadeCharges = Math.min(6, (player.m41aGrenadeCharges || 0) + 5);
      player.seegsonBoltAmmo = Math.min(12, (player.seegsonBoltAmmo || 0) + 4);
      player.armor = Math.min(player.maxArmor || 600, player.armor + 350);
      if (this.game) {
        this.game.score += 1000;
      }

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement("🚔 BARRICADE SWAT DU LIEUTENANT HARRIGAN (PREDATOR 2 1990) : ARMERIE DE COMBAT URBAIN (+5 GRENADES, +4 SLUGS, +350 BLINDAGE) !", "success");
      }
      return true;
    }
    return false;
  }

  checkSmartDiscGirderInteraction(player, ui, audio) {
    if (!this.smartDiscGirder || !player || !player.position || this.smartDiscGirder.isRetrieved) return false;
    if (player.position.distanceTo(this.smartDiscGirder.pos) <= 4.2) {
      this.smartDiscGirder.isRetrieved = true;
      if (this.smartDiscGirder.discMesh) {
        this.smartDiscGirder.discMesh.visible = false;
      }
      if (audio && audio.playSmartDiscHoverHum) audio.playSmartDiscHoverHum();

      player.smartDiscCooldown = 0;
      player.smartDiscCharges = Math.min(4, (player.smartDiscCharges || 0) + 2);
      if (this.game) {
        this.game.score += 1000;
      }

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement("💿 SMART-DISC ENCLAVÉ DANS LA POUTRELLE (PREDATOR 2 1990) : DISQUE GYROSCOPIQUE RÉCUPÉRÉ (DISQUE PRÊT, +2 CHARGES, +1000 SCORE) !", "success");
      }
      return true;
    }
    return false;
  }

  checkNeonTransformerOverload(hitPos, dmg, audio, horde, bosses, particles, ui) {
    if (!this.neonTransformer || this.neonTransformer.isOverloaded || !hitPos) return false;
    if (hitPos.distanceTo(this.neonTransformer.pos) <= 4.5) {
      this.neonTransformer.isOverloaded = true;
      if (audio && audio.playNeonTransformerOverload) audio.playNeonTransformerOverload();

      // Arc shockwave 15m
      let electrocuted = 0;
      if (horde && horde.aliens) {
        horde.aliens.forEach(alien => {
          if (alien && alien.mesh && alien.hp > 0 && alien.mesh.position.distanceTo(this.neonTransformer.pos) <= 15.0) {
            alien.hp -= 380;
            alien.isStunned = true;
            alien.stunTimer = 3.5;
            electrocuted++;
            if (particles && particles.emitSparks) {
              particles.emitSparks(alien.mesh.position, 16);
            }
          }
        });
      }

      if (bosses && bosses.activeBosses) {
        bosses.activeBosses.forEach(boss => {
          if (boss && boss.mesh && boss.hp > 0 && boss.mesh.position.distanceTo(this.neonTransformer.pos) <= 15.0) {
            boss.hp -= 280;
            boss.isStunned = true;
            boss.stunTimer = 2.0;
          }
        });
      }

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement(`⚡ TRANSFORMATEUR NÉON 109°F SURCHARGÉ (PREDATOR 2 1990) : DÉCHARGE ÉLECTRIQUE 10 000V (380 DMG SUR ${electrocuted} XÉNOS) !`, "warning");
      }
      return true;
    }
    return false;
  }

  checkSubwayTrainMassacreInteraction(player, ui, audio) {
    if (!this.subwayCar666 || !player || !player.position || this.subwayCar666.isClaimed) return false;
    if (player.position.distanceTo(this.subwayCar666.pos) <= 4.2) {
      this.subwayCar666.isClaimed = true;
      if (audio && audio.playSubwayStrobeMassacre) audio.playSubwayStrobeMassacre();

      if (player.recordTrophy) {
        player.recordTrophy("MACHETTE & DESERT EAGLE DE JERRY LAMBERT (MÉTRO #666)", 2000);
      }
      if (player.applyJerryLastStand) {
        player.applyJerryLastStand(30.0);
      }
      player.m77GaussAmmo = Math.min(12, (player.m77GaussAmmo || 0) + 4);
      if (this.game) {
        this.game.score += 2000;
      }

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement("🚇 RAME DE MÉTRO #666 (PREDATOR 2 1990) : 'VOUS VOULEZ DU GÂTEAU ?' (+2000 HONNEUR, CADENCE x1.5 & CONTRE-ATTAQUES 30S) !", "success");
      }
      return true;
    }
    return false;
  }

  checkOWLFVanConsoleInteraction(player, ui, audio) {
    if (!this.owlfCommandVan || !player || !player.position || this.owlfCommandVan.isScanned) return false;
    if (player.position.distanceTo(this.owlfCommandVan.pos) <= 4.2) {
      this.owlfCommandVan.isScanned = true;
      if (audio && audio.playOWLFSurveillanceScan) audio.playOWLFSurveillanceScan();

      if (player.applyOWLFUltravioletScan) {
        player.applyOWLFUltravioletScan(40.0);
      }
      if (this.game) {
        this.game.score += 1500;
      }

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement("📡 FOURGON DE SURVEILLANCE OWLF DE PETER KEYES (PREDATOR 2 1990) : TÉLÉMÉTRIE ULTRAVIOLET ACTIVE (SCAN MURAL 40S, +1500 SCORE) !", "success");
      }
      return true;
    }
    return false;
  }

  checkCartelPenthouseLoot(player, ui, audio) {
    if (!this.cartelPenthouse || !player || !player.position || this.cartelPenthouse.isLooted) return false;
    if (player.position.distanceTo(this.cartelPenthouse.pos) <= 4.2) {
      this.cartelPenthouse.isLooted = true;
      if (audio && audio.playCartelMac10Burst) audio.playCartelMac10Burst();

      player.m41aGrenadeCharges = Math.min(6, (player.m41aGrenadeCharges || 0) + 6);
      player.guidedFlechetteAmmo = Math.min(12, (player.guidedFlechetteAmmo || 0) + 6);
      if (this.game) {
        this.game.score += 2000;
      }

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement("💰 PENTHOUSE DU CARTEL D'EL SCORPIO (PREDATOR 2 1990) : BUTIN & UZIS EN OR (+6 GRENADES, +6 FLÉCHETTES GUIDÉES, +2000 SCORE) !", "success");
      }
      return true;
    }
    return false;
  }

  checkPoleVaultLaunchPad(player, ui, audio, horde, bosses, particles) {
    if (!this.poleVaultPad || !player || !player.position) return false;
    if (player.position.distanceTo(this.poleVaultPad.pos) <= 3.8) {
      if (audio && audio.playCombiVaultWhoosh) audio.playCombiVaultWhoosh();

      // Launch player high into the air toward Eastern Columbia Spire platform!
      player.position.copy(this.poleVaultPad.targetPos);
      if (player.mesh) player.mesh.position.copy(player.position);
      player.poleVaultCooldown = 5.0;

      // Crater seismic slam upon landing
      let slamHits = 0;
      if (horde && horde.aliens) {
        horde.aliens.forEach(alien => {
          if (alien && alien.mesh && alien.hp > 0 && alien.mesh.position.distanceTo(this.poleVaultPad.targetPos) <= 8.0) {
            alien.hp -= 650;
            alien.isStunned = true;
            alien.stunTimer = 4.0;
            slamHits++;
            if (particles && particles.emitAlienBloodSpurt) {
              particles.emitAlienBloodSpurt(alien.mesh.position, 16);
            }
          }
        });
      }

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement(`🚀 SAUT À LA PERCHE COMBI-STICK (PREDATOR 2 1990) : CATAPULTAGE VERS L'EASTERN COLUMBIA (650 DMG SUR ${slamHits} CIBLES) !`, "warning");
      }
      return true;
    }
    return false;
  }

  checkBoilingTarSpillDamage(hitPos, dmg, audio, horde, bosses, particles, ui) {
    if (!this.boilingTarKettle || this.boilingTarKettle.isSpilled || !hitPos) return false;
    if (hitPos.distanceTo(this.boilingTarKettle.pos) <= 4.0) {
      this.boilingTarKettle.isSpilled = true;
      if (audio && audio.playBoilingTarSpill) audio.playBoilingTarSpill();

      // Spawn large puddle of black boiling tar on floor
      const tarGeo = new THREE.CircleGeometry(10.0, 16);
      tarGeo.rotateX(-Math.PI / 2);
      const tarMat = new THREE.MeshBasicMaterial({ color: 0x09090b, transparent: true, opacity: 0.88 });
      const tarPuddle = new THREE.Mesh(tarGeo, tarMat);
      tarPuddle.position.set(this.boilingTarKettle.pos.x, 0.08, this.boilingTarKettle.pos.z);
      this.addReferenceObject(tarPuddle);

      this.activeTarPuddles.push({
        mesh: tarPuddle,
        pos: this.boilingTarKettle.pos.clone(),
        timer: 14.0
      });

      let glued = 0;
      if (horde && horde.aliens) {
        horde.aliens.forEach(alien => {
          if (alien && alien.mesh && alien.hp > 0 && alien.mesh.position.distanceTo(this.boilingTarKettle.pos) <= 10.0) {
            alien.hp -= 320;
            alien.speedMult = 0.15;
            alien.isStunned = true;
            alien.stunTimer = 5.0;
            glued++;
            if (particles && particles.emitSparks) {
              particles.emitSparks(alien.mesh.position, 12);
            }
          }
        });
      }

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement(`🔥 CHAUDIÈRE DE GOUDRON BOUILLANT RENVERSÉE (PREDATOR 2 1990) : BITUME 300°C (${glued} XÉNOS ENGLUÉS & BRÛLÉS, -85% VITESSE) !`, "warning");
      }
      return true;
    }
    return false;
  }

  /* === SECTOR 3 & SOFIA LEVEL DESIGN (v56.5): Antarctic Pyramid Sacrificial Altar & Traps (AVP 2004) === */
  buildPyramidSacrificialProps() {
    const group = new THREE.Group();
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8, metalness: 0.25 });
    const runeMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.95, roughness: 0.1 });

    // 1. Central Sacrificial Caster Dais [0, 0, 0] (+2.2m)
    const daisPos = new THREE.Vector3(0, 0, 0);
    const dais = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 6.0, 2.2, 8), stoneMat);
    dais.position.y = 1.1;
    dais.receiveShadow = true;
    group.add(dais);

    // 3 Caster Pedestals with triangular dial locks
    for (let p = 0; p < 3; p++) {
      const a = (p / 3) * Math.PI * 2;
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.65, 1.4, 6), stoneMat);
      ped.position.set(Math.cos(a) * 3.2, 2.9, Math.sin(a) * 3.2);
      const dial = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.1, 0.35), runeMat);
      dial.position.set(Math.cos(a) * 3.2, 3.65, Math.sin(a) * 3.2);
      group.add(ped);
      group.add(dial);
    }

    // 2. Obsidian Scythe Wall Traps
    this.scytheTraps = [];
    const trapPositions = [
      new THREE.Vector3(-18, 0, 0),
      new THREE.Vector3(18, 0, 0)
    ];

    trapPositions.forEach((pos, idx) => {
      const trapGroup = new THREE.Group();
      trapGroup.position.copy(pos);

      // Floor pressure stone plate
      const plate = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.15, 2.4), stoneMat);
      plate.position.y = 0.08;
      trapGroup.add(plate);

      // Crescent obsidian scythe blade
      const blade = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.15, 6, 12, Math.PI), bladeMat);
      blade.rotation.x = Math.PI / 2;
      blade.position.y = 1.6;
      trapGroup.add(blade);

      group.add(trapGroup);

      this.scytheTraps.push({
        id: idx,
        pos: pos.clone(),
        bladeMesh: blade,
        cooldown: 0
      });
    });

    this.addReferenceObject(group);
    this.envObjects.push(group);

    this.pyramidSacrificial = {
      group,
      daisPos,
      altarCooldown: 0
    };
  }

  checkPyramidAltarInteraction(player, ui, audio, particles) {
    if (!this.pyramidSacrificial || !player || !player.position) return false;
    const p = this.pyramidSacrificial;
    if (player.position.distanceTo(p.daisPos) <= 4.5) {
      if (p.altarCooldown > 0) {
        if (ui && ui.showAnnouncement) {
          ui.showAnnouncement(`⏳ AUTEL DU CLAN EN RECHARGE (${Math.ceil(p.altarCooldown)}S)`);
        }
        return true;
      }
      p.altarCooldown = 40.0;
      if (audio && audio.playPyramidStoneShift) audio.playPyramidStoneShift();

      player.plasmaEnergy = player.maxPlasmaEnergy || 100;
      player.plasmaChargeMultiplier = 0.70; // 30% faster charge

      if (particles && particles.emitSparks) {
        particles.emitSparks(player.position.clone().add(new THREE.Vector3(0, 1.5, 0)), 24);
      }

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement('⚜️ BÉNÉDICTION DES ANCIENS D\'AVP 2004 : RÉSERVES PLASMA 100%, CHARGE ACCÉLÉRÉE (+30% CADENCE 30S) !', 'success');
      }
      return true;
    }
    return false;
  }

  checkPyramidScytheTraps(playerPos, horde, audio, particles) {
    if (!this.scytheTraps) return;
    this.scytheTraps.forEach(trap => {
      if (trap.cooldown > 0) return;
      let triggered = false;

      if (playerPos && playerPos.distanceTo(trap.pos) <= 2.2) {
        triggered = true;
      }
      if (!triggered && horde && horde.aliens) {
        for (let i = 0; i < horde.aliens.length; i++) {
          const a = horde.aliens[i];
          if (a && a.mesh && a.mesh.position.distanceTo(trap.pos) <= 2.2) {
            triggered = true;
            break;
          }
        }
      }

      if (triggered) {
        trap.cooldown = 4.5;
        if (audio && audio.playPyramidScytheTrap) audio.playPyramidScytheTrap();

        if (trap.bladeMesh) {
          trap.bladeMesh.rotation.z += Math.PI;
        }

        // Damage all enemies in corridor sweep
        if (horde && horde.aliens) {
          horde.aliens.forEach(alien => {
            if (alien && alien.mesh && alien.mesh.position.distanceTo(trap.pos) <= 4.2) {
              alien.hp -= 450;
              if (particles && particles.emitAlienBloodSpurt) {
                particles.emitAlienBloodSpurt(alien.mesh.position, 16);
              }
            }
          });
        }
      }
    });
  }

  /* === SECTOR 4 & SOFIA LEVEL DESIGN (v56.5): Romulus Station Zero-G Chamber & Rook Terminal (Romulus 2024) === */
  buildRomulusStationExpansionProps() {
    const group = new THREE.Group();
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9, roughness: 0.2 });
    const amberMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });

    // 1. Central Zero-G Acid Decompression Airlock [0, 0, 0]
    const airlockPos = new THREE.Vector3(0, 0, 0);
    const hatch = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.5, 0.4, 24), metalMat);
    hatch.position.y = 0.2;
    hatch.receiveShadow = true;
    group.add(hatch);

    // 4 Magnetic locking clamps
    for (let c = 0; c < 4; c++) {
      const a = (c / 4) * Math.PI * 2;
      const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.9, 1.4), metalMat);
      clamp.position.set(Math.cos(a) * 4.8, 0.65, Math.sin(a) * 4.8);
      group.add(clamp);
    }

    const consoleMesh = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.4, 0.7), metalMat);
    consoleMesh.position.set(4.5, 1.2, 0);
    const consoleScreen = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.05), amberMat);
    consoleScreen.position.set(4.5, 1.5, 0.36);
    group.add(consoleMesh);
    group.add(consoleScreen);

    // 2. Science Officer Rook Synthetic Android Wall Mount at [-22, 1.8, -14]
    const rookPos = new THREE.Vector3(-22, 1.8, -14);
    const rookGroup = new THREE.Group();
    rookGroup.position.copy(rookPos);

    const rookTorso = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, 0.5), metalMat);
    rookGroup.add(rookTorso);
    const rookHead = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), new THREE.MeshStandardMaterial({ color: 0xd4d4d8 }));
    rookHead.position.set(0, 0.9, 0);
    rookGroup.add(rookHead);

    // Dangling milky cyber-cabling
    for (let w = 0; w < 4; w++) {
      const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      wire.position.set((w - 1.5) * 0.15, -0.7, 0);
      rookGroup.add(wire);
    }

    group.add(rookGroup);

    // 3. Z-01 Prometheus Centrifuge at [20, 0, 18]
    const centrifugeGroup = new THREE.Group();
    centrifugeGroup.position.set(20, 0, 18);
    const cBase = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.2, 1.6, 12), metalMat);
    cBase.position.y = 0.8;
    centrifugeGroup.add(cBase);

    const rotorArm = new THREE.Group();
    rotorArm.position.y = 1.8;
    for (let v = 0; v < 4; v++) {
      const a = (v / 4) * Math.PI * 2;
      const vial = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.8, 8), amberMat);
      vial.position.set(Math.cos(a) * 1.2, 0, Math.sin(a) * 1.2);
      rotorArm.add(vial);
    }
    centrifugeGroup.add(rotorArm);
    group.add(centrifugeGroup);

    this.addReferenceObject(group);
    this.envObjects.push(group);

    this.romulusStationExpansion = {
      group,
      airlockPos,
      consolePos: new THREE.Vector3(4.5, 1.2, 0),
      rookPos,
      centrifugeRotor: rotorArm,
      zeroGCooldown: 0,
      rookCooldown: 0
    };
  }

  checkRomulusZeroGInteraction(player, ui, audio, particles, horde) {
    if (!this.romulusStationExpansion || !player || !player.position) return false;
    const r = this.romulusStationExpansion;
    if (player.position.distanceTo(r.consolePos) <= 4.2) {
      if (r.zeroGCooldown > 0) {
        if (ui && ui.showAnnouncement) {
          ui.showAnnouncement(`⏳ SAS DÉPRESSURISATION EN RECHARGE (${Math.ceil(r.zeroGCooldown)}S)`);
        }
        return true;
      }
      r.zeroGCooldown = 45.0;
      this.zeroGActiveTimer = 8.0;

      if (audio && audio.playZeroGGravityToggle) audio.playZeroGGravityToggle();

      // Suspend ground enemies in zero-g for 6 seconds
      let affected = 0;
      if (horde && horde.aliens) {
        horde.aliens.forEach(alien => {
          if (alien && alien.mesh && alien.mesh.position.distanceTo(r.airlockPos) <= 28.0) {
            alien.mesh.position.y = 2.4;
            alien.isStunned = true;
            alien.stunTimer = 6.0;
            affected++;
          }
        });
      }

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement(`🪐 DÉPRESSURISATION GRAVITATIONNELLE ZÉRO-G (ROMULUS) : ${affected} XÉNOS EN SUSPENSION LÉVITANTE (6S) !`, "warning");
      }
      return true;
    }
    return false;
  }

  checkRookConsoleInteraction(player, ui, audio) {
    if (!this.romulusStationExpansion || !player || !player.position) return false;
    const r = this.romulusStationExpansion;
    if (player.position.distanceTo(r.rookPos) <= 4.2) {
      if (r.rookCooldown > 0) {
        if (ui && ui.showAnnouncement) {
          ui.showAnnouncement(`⏳ CONSOLE DE ROOK EN ATTENTE DE SIGNAL (${Math.ceil(r.rookCooldown)}S)`);
        }
        return true;
      }
      r.rookCooldown = 60.0;
      if (audio && audio.playSyntheticWhiteFluidLeak) audio.playSyntheticWhiteFluidLeak();

      player.medicompCharges = Math.min(6, (player.medicompCharges || 0) + 2);

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement('🤖 OFFICIER ROOK (ALIEN: ROMULUS) : ACCÈS DÉVERROUILLÉ (+2 COMPRESSES DE SOIN MEDICOMP) !', 'success');
      }
      return true;
    }
    return false;
  }

  /* === SECTOR 5 & SOFIA LEVEL DESIGN (v56.5): Xenomorph Prime Royal Jelly Glands & Bridges (Earth War Canon) === */
  buildHiveWorldExpansionProps() {
    const group = new THREE.Group();
    const resinMat = new THREE.MeshStandardMaterial({ color: 0x140508, roughness: 0.35, metalness: 0.8 });
    const amberGlandMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.15,
      emissive: 0xd97706,
      emissiveIntensity: 0.6
    });

    // 1. Hardened Chitin Webbing Bridges spanning acid pits at +4.5m
    const bridge1 = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.4, 36.0), resinMat);
    bridge1.position.set(40, 4.5, 40);
    bridge1.receiveShadow = true;
    group.add(bridge1);

    const bridge2 = new THREE.Mesh(new THREE.BoxGeometry(36.0, 0.4, 6.4), resinMat);
    bridge2.position.set(40, 4.5, 40);
    bridge2.receiveShadow = true;
    group.add(bridge2);

    const bridges = [
      { minX: 36.8, maxX: 43.2, minZ: 22.0, maxZ: 58.0 },
      { minX: 22.0, maxX: 58.0, minZ: 36.8, maxZ: 43.2 }
    ];
    // Keep the insertion capsule's airspace clear. Both raised arms have a real
    // access slope; a ground-level pedestrian remains below the deck.
    const southAccess = [{ bottom: [40, 0, 8], top: [40, 4.7, 22] }];
    const westAccess = [{ bottom: [8, 0, 40], top: [22, 4.7, 40] }];
    this.registerReferenceWalkSurface?.(bridge1, { id: 'hive-resin-north-deck', bounds: bridges[0], heightAt: () => 4.7, accesses: southAccess });
    this.registerReferenceWalkSurface?.(bridge2, { id: 'hive-resin-east-deck', bounds: bridges[1], heightAt: () => 4.7, accesses: westAccess });
    for (const [id, x, z, yaw, bounds, heightAt, accesses] of [
      ['hive-resin-south-ramp', 40, 15, 0, { minX: 36.8, maxX: 43.2, minZ: 8, maxZ: 22 }, (_x, z) => (z - 8) / 14 * 4.7, southAccess],
      ['hive-resin-west-ramp', 15, 40, Math.PI / 2, { minX: 8, maxX: 22, minZ: 36.8, maxZ: 43.2 }, (x) => (x - 8) / 14 * 4.7, westAccess]
    ]) {
      const ramp = new THREE.Mesh(walkRampGeometry(6.4, 14, 4.7), resinMat); ramp.position.set(x, 0, z); ramp.rotation.y = yaw; ramp.receiveShadow = true; group.add(ramp);
      this.registerReferenceWalkSurface?.(ramp, { id, kind: 'ramp', bounds, heightAt, accesses });
    }

    // 2. Harvestable Royal Jelly Resin Nodes on walls
    this.harvestableRoyalJelly = [];
    const glandPositions = [
      new THREE.Vector3(-18, 2.2, 18),
      new THREE.Vector3(18, 2.2, -18),
      new THREE.Vector3(-24, 2.2, -14),
      new THREE.Vector3(24, 2.2, 14)
    ];

    glandPositions.forEach((pos, idx) => {
      const glandGroup = new THREE.Group();
      glandGroup.position.copy(pos);

      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.85, 12, 12), amberGlandMat);
      glandGroup.add(bulb);

      const light = new THREE.PointLight(0xf59e0b, 1.2, 8.0);
      light.position.set(0, 0, 0);
      glandGroup.add(light);

      group.add(glandGroup);

      this.harvestableRoyalJelly.push({
        id: idx,
        group: glandGroup,
        pos: pos.clone(),
        light,
        isHarvested: false
      });
    });

    this.addReferenceObject(group);
    this.envObjects.push(group);

    this.hiveWorldExpansion = {
      group,
      bridges
    };
  }

  checkRoyalJellyHarvestInteraction(player, ui, audio, particles) {
    if (!this.harvestableRoyalJelly || !player || !player.position) return false;
    for (let i = 0; i < this.harvestableRoyalJelly.length; i++) {
      const node = this.harvestableRoyalJelly[i];
      if (!node.isHarvested && player.position.distanceTo(node.pos) <= 3.8) {
        node.isHarvested = true;
        this.removeReferenceObject(node.group);

        if (audio && audio.playRoyalJellyHarvest) audio.playRoyalJellyHarvest();

        player.royalJellyFlasks = (player.royalJellyFlasks || 0) + 2;
        player.hp = Math.min(player.maxHp || 1000, player.hp + 350);

        if (particles && particles.emitAlienBloodSpurt) {
          particles.emitAlienBloodSpurt(node.pos, 20);
        }

        if (ui && ui.showAnnouncement) {
          ui.showAnnouncement('🍯 GELÉE ROYALE PURIFIÉE RÉCOLTÉE (ALIENS: EARTH WAR) : +2 FIOLES ROYALES, SANTÉ RESTAURÉE (+350 HP) !', 'success');
        }
        return true;
      }
    }
    return false;
  }

  /* === SECTOR 6 & SOFIA LEVEL DESIGN (v57.0): Gunnison Forest Gothic Cemetery Crypt & Downed Power Pole (AVP: Requiem 2007) === */
  buildGunnisonForestExpansionProps() {
    const group = new THREE.Group();
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x272e36, roughness: 0.9, metalness: 0.1 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f, roughness: 0.95 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.9, roughness: 0.2 });
    const puddleMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.1, metalness: 0.8, transparent: true, opacity: 0.75 });

    // 1. Gothic Stone Crypt & Mausoleum at [24, 0, -20] (+3.2m elevation)
    const mausoleumPos = new THREE.Vector3(24, 0, -20);
    const cryptGroup = new THREE.Group();
    cryptGroup.position.copy(mausoleumPos);

    // Foundation & heavy stone walls
    const mainBuilding = new THREE.Mesh(new THREE.BoxGeometry(8.4, 3.2, 6.4), stoneMat);
    mainBuilding.position.y = 1.6;
    mainBuilding.castShadow = true;
    mainBuilding.receiveShadow = true;
    cryptGroup.add(mainBuilding);

    // Stone battlements / crenels on roof (+3.2m platform)
    for (let c = 0; c < 4; c++) {
      const crenel1 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 0.5), stoneMat);
      crenel1.position.set(-3.0 + c * 2.0, 3.55, 3.0);
      cryptGroup.add(crenel1);
      const crenel2 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 0.5), stoneMat);
      crenel2.position.set(-3.0 + c * 2.0, 3.55, -3.0);
      cryptGroup.add(crenel2);
    }

    // West stone stairs leading from ground (y=0) to roof (+3.2m)
    for (let s = 0; s < 5; s++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.65 * (s + 1), 4.2), stoneMat);
      step.position.set(-4.6 - s * 0.7, (0.65 * (s + 1)) / 2, 0);
      step.receiveShadow = true;
      cryptGroup.add(step);
    }

    // Wrought iron crypt gate on south side
    const gateFrame = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.6, 0.3), metalMat);
    gateFrame.position.set(0, 1.3, 3.25);
    cryptGroup.add(gateFrame);

    // USCM / National Guard Reliquary Munitions Locker inside gate
    const lockerGeo = new THREE.BoxGeometry(1.6, 0.9, 0.9);
    const lockerMat = new THREE.MeshStandardMaterial({ color: 0x14532d, metalness: 0.85, roughness: 0.3 });
    const locker = new THREE.Mesh(lockerGeo, lockerMat);
    locker.position.set(0, 0.45, 2.2);
    cryptGroup.add(locker);

    // Gravestones scattered in cemetery
    for (let g = 0; g < 6; g++) {
      const tombstone = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.4, 0.25), stoneMat);
      tombstone.position.set(6.0 + (g % 3) * 3.0, 0.7, -4.0 + Math.floor(g / 3) * 5.0);
      tombstone.rotation.y = (this.random() - 0.5) * 0.4;
      cryptGroup.add(tombstone);
    }

    group.add(cryptGroup);

    // 2. Downed High-Voltage Electric Utility Pole at [0, 0, 16]
    const polePos = new THREE.Vector3(0, 0, 16);
    const poleGroup = new THREE.Group();
    poleGroup.position.copy(polePos);

    // Splintered timber pole angled at 45 degrees
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.32, 8.5, 8), woodMat);
    pole.position.set(1.8, 3.2, 0);
    pole.rotation.z = 0.55;
    poleGroup.add(pole);

    // Crossarm with insulators
    const crossarm = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.2, 0.2), woodMat);
    crossarm.position.set(3.8, 6.2, 0);
    crossarm.rotation.z = 0.55;
    poleGroup.add(crossarm);

    // Transformer metal canister
    const transformer = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.4, 12), metalMat);
    transformer.position.set(3.4, 5.2, 0.5);
    poleGroup.add(transformer);

    // Flooded rain puddle around pole
    const puddle = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 7.5, 0.05, 16), puddleMat);
    puddle.position.y = 0.03;
    poleGroup.add(puddle);

    // Severed dangling high-voltage live wires
    const wireMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    for (let w = 0; w < 3; w++) {
      const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 5.0, 4), wireMat);
      wire.position.set(2.8 + w * 0.7, 2.5, (w - 1) * 0.6);
      wire.rotation.z = 0.2;
      poleGroup.add(wire);
    }

    group.add(poleGroup);

    this.addReferenceObject(group);
    this.envObjects.push(group);

    this.gunnisonExpansion = {
      group,
      mausoleumPos,
      polePos
    };

    this.cryptReliquaryVault = {
      pos: mausoleumPos.clone().add(new THREE.Vector3(0, 0.45, 2.2)),
      isOpened: false
    };

    this.gunnisonPowerPole = {
      group: poleGroup,
      pos: polePos.clone(),
      isTriggered: false,
      hp: 100
    };
  }

  checkCryptReliquaryInteraction(player, ui, audio) {
    if (!this.cryptReliquaryVault || !player || !player.position || this.cryptReliquaryVault.isOpened) return false;
    if (player.position.distanceTo(this.cryptReliquaryVault.pos) <= 3.8) {
      this.cryptReliquaryVault.isOpened = true;
      if (audio && audio.playCryptReliquaryOpen) audio.playCryptReliquaryOpen();

      player.plasmaEnergy = 100;
      player.armor = Math.min(player.maxArmor || 600, player.armor + 300);
      player.medicompVials = (player.medicompVials || 0) + 2;

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement('⚰️ COFFRE RELIQUAIRE DU CIMETIÈRE DE GUNNISON OUVERT : ÉNERGIE PLASMA 100%, BLINDAGE +300, 2 FIOLES MEDICOMP !', 'success');
      }
      return true;
    }
    return false;
  }

  checkGunnisonPowerPoleDamage(hitPos, dmg, audio, horde, particles, ui) {
    if (!this.gunnisonPowerPole || this.gunnisonPowerPole.isTriggered || !hitPos) return false;
    if (hitPos.distanceTo(this.gunnisonPowerPole.pos) <= 5.0) {
      this.gunnisonPowerPole.isTriggered = true;

      if (audio && audio.playGunnisonPowerArc) audio.playGunnisonPowerArc();

      // Spawn electrical discharge mesh
      const arcGeo = new THREE.CylinderGeometry(8.0, 8.0, 0.2, 16);
      const arcMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.85, wireframe: true });
      const arcMesh = new THREE.Mesh(arcGeo, arcMat);
      arcMesh.position.set(this.gunnisonPowerPole.pos.x, 0.2, this.gunnisonPowerPole.pos.z);
      this.addReferenceObject(arcMesh);

      const arcLight = new THREE.PointLight(0x38bdf8, 3.5, 18.0);
      arcLight.position.set(this.gunnisonPowerPole.pos.x, 2.5, this.gunnisonPowerPole.pos.z);
      this.addReferenceObject(arcLight);

      this.activePowerArcs.push({
        mesh: arcMesh,
        light: arcLight,
        pos: this.gunnisonPowerPole.pos.clone(),
        timer: 6.0
      });

      // Electrocute enemies in 15m radius
      let shocked = 0;
      if (horde && horde.aliens) {
        horde.aliens.forEach(alien => {
          if (alien && alien.mesh && alien.hp > 0 && alien.mesh.position.distanceTo(this.gunnisonPowerPole.pos) <= 15.0) {
            alien.hp -= 420;
            alien.isStunned = true;
            alien.stunTimer = 4.0;
            shocked++;
            if (particles && particles.emitSparks) {
              particles.emitSparks(alien.mesh.position, 8);
            }
          }
        });
      }

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement(`⚡ COURT-CIRCUIT DU POTEAU ÉLECTRIQUE (GUNNISON) : ARC 10 000V DÉCHARGÉ (${shocked} XÉNOS ÉLECTROCUTÉS, 420 DMG, 4S STUN) !`, 'warning');
      }
      return true;
    }
    return false;
  }

  /* === SECTOR 7 & SOFIA LEVEL DESIGN (v57.0): Charon Base Mezzanine Gantry & Neural Inhibitors (Aliens: Rogue 1993) === */
  buildCharonBaseExpansionProps() {
    const group = new THREE.Group();
    const gratingMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.95, roughness: 0.25 });
    const yellowMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    const pylonMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.2 });
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x34d399 });

    // 1. Upper Mezzanine Observation Gantry at [0, 4.2, -26] (+4.2m elevation)
    const gantryPos = new THREE.Vector3(0, 4.2, -26);
    const gantry = new THREE.Mesh(new THREE.BoxGeometry(24.0, 0.4, 5.0), gratingMat);
    gantry.position.copy(gantryPos);
    gantry.receiveShadow = true;
    group.add(gantry);

    // Hazard stripes along front curb
    const curb = new THREE.Mesh(new THREE.BoxGeometry(24.0, 0.25, 0.2), yellowMat);
    curb.position.set(0, 4.4, -23.6);
    group.add(curb);

    // Handrails
    const rail = new THREE.Mesh(new THREE.BoxGeometry(24.0, 0.08, 0.08), gratingMat);
    rail.position.set(0, 5.2, -23.6);
    group.add(rail);

    // West access ramp from ground [x=-16, z=-26] up to gantry [x=-12, z=-26]
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.3, 3.2), gratingMat);
    ramp.position.set(-14.0, 2.1, -26.0);
    ramp.rotation.z = -Math.atan2(4.2, 4.0);
    group.add(ramp);

    // 2. Dual Weyland-Yutani Neural Inhibitor Resonator Pylons at [-14, 0, 8] and [14, 0, 8]
    this.neuralInhibitors = [];
    const pylonCoords = [
      new THREE.Vector3(-14, 0, 8),
      new THREE.Vector3(14, 0, 8)
    ];

    pylonCoords.forEach((pPos, idx) => {
      const pGroup = new THREE.Group();
      pGroup.position.copy(pPos);

      // Central pillar
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.85, 4.8, 12), pylonMat);
      pillar.position.y = 2.4;
      pGroup.add(pillar);

      // 4 toroidal resonance rings
      const rings = [];
      for (let r = 0; r < 4; r++) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.12, 6, 16), ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 1.2 + r * 0.9;
        pGroup.add(ring);
        rings.push(ring);
      }

      // Beacon light
      const pLight = new THREE.PointLight(0x34d399, 1.8, 9.0);
      pLight.position.set(0, 4.8, 0);
      pGroup.add(pLight);

      group.add(pGroup);

      this.neuralInhibitors.push({
        id: idx,
        group: pGroup,
        pos: pPos.clone(),
        rings,
        light: pLight,
        cooldown: 0
      });
    });

    this.addReferenceObject(group);
    this.envObjects.push(group);

    this.charonExpansion = {
      group,
      gantryPos
    };
  }

  checkNeuralInhibitorInteraction(player, horde, ui, audio) {
    if (!this.neuralInhibitors || this.neuralInhibitors.length === 0 || !player || !player.position) return false;
    for (const pylon of this.neuralInhibitors) {
      if (player.position.distanceTo(pylon.pos) <= 4.2) {
        if (pylon.cooldown > 0) {
          if (ui && ui.showAnnouncement) {
            ui.showAnnouncement(`⏳ PYLÔNE INHIBITEUR EN RECHARGE (${Math.ceil(pylon.cooldown)}S)`);
          }
          return true;
        }
        pylon.cooldown = 42.0;

        if (audio && audio.playNeuralInhibitorHum) audio.playNeuralInhibitorHum();

        // Slow down and disorient all xenomorphs across arena for 16 seconds
        let inhibitedCount = 0;
        if (horde && horde.aliens) {
          horde.aliens.forEach(alien => {
            if (alien && alien.hp > 0) {
              alien.isInhibited = true;
              alien.inhibitedTimer = 16.0;
              alien.speedMult = 0.4;
              inhibitedCount++;
            }
          });
        }

        if (ui && ui.showAnnouncement) {
          ui.showAnnouncement(`🧠 INHIBITEURS NEURONAUX CHARON ACTIVÉS (ALIENS: ROGUE) : ONDES ULTRASONIQUES (-60% VITESSE, CRACHAT ACIDE BLOQUÉ 16S SUR ${inhibitedCount} XÉNOS) !`, 'warning');
        }
        return true;
      }
    }
    return false;
  }

  /* === SECTOR 8 & SOFIA LEVEL DESIGN (v57.0): Game Preserve Hunting Perch & Boulder Deadfall Traps (Predators 2010) === */
  buildGamePreserveExpansionProps() {
    const group = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x3d2012, roughness: 0.95 });
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x47382e, roughness: 0.9 });
    const vineMat = new THREE.MeshStandardMaterial({ color: 0x1f3d1a, roughness: 0.8 });
    const runeMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });

    // 1. Super Predator Hunting Perch Platform at [20, 0, 22] (+5.2m altitude)
    const perchPos = new THREE.Vector3(20, 0, 22);
    const perchGroup = new THREE.Group();
    perchGroup.position.copy(perchPos);

    // Massive redwood tree trunk
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 16.0, 12), woodMat);
    trunk.position.y = 8.0;
    trunk.castShadow = true;
    perchGroup.add(trunk);

    // Octagonal hunting platform at +5.2m (radius 4.2m)
    const platform = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.4, 0.4, 8), woodMat);
    platform.position.y = 5.2;
    platform.receiveShadow = true;
    perchGroup.add(platform);

    // Bone handrails and trophy skull spikes
    for (let s = 0; s < 8; s++) {
      const a = (s / 8) * Math.PI * 2;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 1.2, 6), woodMat);
      post.position.set(Math.cos(a) * 4.0, 5.8, Math.sin(a) * 4.0);
      perchGroup.add(post);
    }

    // Timber ladder incline from ground [20, 0, 15] to platform [20, 5.2, 18.5]
    const ladder = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.3, 4.2), woodMat);
    ladder.position.set(0, 2.6, -5.25);
    ladder.rotation.x = Math.atan2(5.2, 3.5);
    perchGroup.add(ladder);

    group.add(perchGroup);

    // 2. Suspended Boulder Deadfall Traps at [-16, 0, 6] and [14, 0, -14]
    this.boulderTraps = [];
    const trapConfigs = [
      { id: 1, pos: new THREE.Vector3(-16, 0, 6) },
      { id: 2, pos: new THREE.Vector3(14, 0, -14) }
    ];

    trapConfigs.forEach(cfg => {
      const trapGroup = new THREE.Group();
      trapGroup.position.copy(cfg.pos);

      // Heavy timber A-frame gallows (height 9m)
      const beamL = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 9.2, 6), woodMat);
      beamL.position.set(-2.0, 4.6, 0);
      beamL.rotation.z = 0.2;
      trapGroup.add(beamL);

      const beamR = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 9.2, 6), woodMat);
      beamR.position.set(2.0, 4.6, 0);
      beamR.rotation.z = -0.2;
      trapGroup.add(beamR);

      const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 4.4, 6), woodMat);
      crossbar.position.set(0, 8.8, 0);
      crossbar.rotation.z = Math.PI / 2;
      trapGroup.add(crossbar);

      // Suspended 3-Ton Sandstone Boulder at y=7.4m
      const boulder = new THREE.Mesh(new THREE.DodecahedronGeometry(1.7, 1), stoneMat);
      boulder.position.set(0, 7.4, 0);
      boulder.castShadow = true;
      trapGroup.add(boulder);

      // Vine rope suspension
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.8, 4), vineMat);
      rope.position.set(0, 8.2, 0);
      trapGroup.add(rope);

      // Release peg at ground
      const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 1.2, 6), runeMat);
      peg.position.set(0, 0.6, -2.0);
      trapGroup.add(peg);

      group.add(trapGroup);

      this.boulderTraps.push({
        id: cfg.id,
        group: trapGroup,
        boulderMesh: boulder,
        ropeMesh: rope,
        pos: cfg.pos.clone(),
        pegPos: cfg.pos.clone().add(new THREE.Vector3(0, 0.6, -2.0)),
        isDropped: false,
        dropY: 7.4,
        isDropping: false
      });
    });

    // 3. Ronald Noland's Drilling Rig Subterranean Hideout [-28, 0, 24]
    this.buildNolandHideoutProps(group);

    // 4. Royce's Parachute Free-Fall Waterfall Cliff [-28, 0, -26] (+9.0m)
    this.buildRoyceWaterfallCliffProps(group);

    // 5. Tracker Predator's Spiked Hell-Hound Kennel & Whistle Totem [-18, 0, -18]
    this.buildHellhoundKennelProps(group);

    // 6. Nikolai's Dual Claymore Suicide Blast Memorial Crater [16, 0, -22]
    this.buildNikolaiBlastMemorialProps(group);

    // 7. Hanzo's Yakuza Tall-Grass Katana Duel Arena [26, 0, 0]
    this.buildHanzoDuelArenaProps(group);

    // 8. Dr. Edwin's Neurotoxin Alien Flora Patch [18, 0, 18]
    this.buildAlienFloraPatchProps(group);

    // 9. Royce's Scavenged Grenade Tripwire Perimeter [-8, 0, 8]
    this.buildRoyceTripwireTrapProps(group);

    // 10. Super Predator Berserker (Mr. Black) Ship Launch Dais [0, 0, -32] (+3.0m)
    this.buildSuperPredatorShipDaisProps(group);

    // 11. Quadruple Celestial Moons Horizon Vista Monolith [30, 0, -26] (+7.5m)
    this.buildCelestialVistaMonolithProps(group);

    // 12. Falconer Predator Recon Drone Roost & Perch [10, 0, 14] (+4.8m)
    this.buildFalconerDronePerchProps(group);

    // 13. Cuchillo's Booby-Trapped Acoustic Decoy [-10, 0, -6]
    this.buildCuchilloDecoyProps(group);

    // 14. Mombassa's Spring-Loaded Punji Stake Pit Trap [-4, 0, 18]
    this.buildMombassaPunjiTrapProps(group);

    // 15. Royce's Bone Gong & Sacrificial Fire Braziers [0, 0, 8]
    this.buildRoyceBoneGongProps(group);

    // 16. Isabelle's Blaser R93 Tactical Sniper Stash [-28, 9.0, -28] (+9.0m)
    this.buildIsabelleSniperStashProps(group);

    this.addReferenceObject(group);
    this.envObjects.push(group);

    this.gamePreserveExpansion = {
      group,
      perchPos
    };
  }

  checkBoulderDeadfallDamage(hitPos, dmg, audio, horde, bosses, particles, ui) {
    if (!this.boulderTraps || !hitPos) return false;
    for (const trap of this.boulderTraps) {
      if (!trap.isDropped && !trap.isDropping && hitPos.distanceTo(trap.pegPos) <= 4.2) {
        this.triggerBoulderDrop(trap, audio, horde, bosses, particles, ui);
        return true;
      }
    }
    return false;
  }

  checkBoulderDeadfallInteraction(player, audio, horde, bosses, particles, ui) {
    if (!this.boulderTraps || !player || !player.position) return false;
    for (const trap of this.boulderTraps) {
      if (!trap.isDropped && !trap.isDropping && player.position.distanceTo(trap.pegPos) <= 3.8) {
        this.triggerBoulderDrop(trap, audio, horde, bosses, particles, ui);
        return true;
      }
    }
    return false;
  }

  triggerBoulderDrop(trap, audio, horde, bosses, particles, ui) {
    trap.isDropping = true;
    if (trap.ropeMesh) trap.group.remove(trap.ropeMesh);

    if (audio && audio.playBoulderDeadfallCrash) audio.playBoulderDeadfallCrash();

    // Instant impact resolution
    let crushedCount = 0;
    if (horde && horde.aliens) {
      horde.aliens.forEach(alien => {
        if (alien && alien.mesh && alien.hp > 0 && alien.mesh.position.distanceTo(trap.pos) <= 8.5) {
          alien.hp -= 650;
          alien.isStunned = true;
          alien.stunTimer = 4.5;
          crushedCount++;
          if (particles && particles.emitSparks) {
            particles.emitSparks(alien.mesh.position, 12);
          }
        }
      });
    }

    if (bosses && bosses.activeBosses) {
      bosses.activeBosses.forEach(boss => {
        if (boss && boss.mesh && boss.hp > 0 && boss.mesh.position.distanceTo(trap.pos) <= 9.0) {
          boss.hp -= 500;
          boss.isStunned = true;
          boss.stunTimer = 3.0;
        }
      });
    }

    trap.boulderMesh.position.y = 1.4; // Boulder comes to rest on earth as heavy cover
    trap.isDropped = true;
    trap.isDropping = false;

    if (ui && ui.showAnnouncement) {
      ui.showAnnouncement(`🪨 ÉBOULEMENT DE ROCHERS DÉCLENCHÉ (PREDATORS 2010) : 3 TONNES ÉCRASENT LES HORDES (${crushedCount} XÉNOS PULVÉRISÉS, 650 DMG) !`, 'success');
    }
  }

  /* === PREDATORS (2010) GAME PRESERVE CANONICAL 1:1 BUILDERS === */

  // 3. Ronald Noland's Drilling Rig / C-130 Fuselage Scrap Hideout [-28, 0, 24]
  buildNolandHideoutProps(parentGroup) {
    const group = new THREE.Group();
    const pos = new THREE.Vector3(-28, 0, 24);
    group.position.copy(pos);

    const metalMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.85, roughness: 0.4 });
    const rustMat = new THREE.MeshStandardMaterial({ color: 0x78350f, metalness: 0.5, roughness: 0.8 });
    const hazardMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.6 });

    // Curved fuselage hull shelter (width 8.5m, height 4.2m)
    const hullGeo = new THREE.CylinderGeometry(4.2, 4.4, 7.5, 12, 1, false, 0, Math.PI);
    const hull = new THREE.Mesh(hullGeo, rustMat);
    hull.rotation.z = Math.PI / 2;
    hull.rotation.y = Math.PI / 4;
    hull.position.y = 2.1;
    hull.castShadow = true;
    group.add(hull);

    // Blast hatch door with hazard chevron bars
    const door = new THREE.Mesh(new THREE.BoxGeometry(2.0, 3.2, 0.4), metalMat);
    door.position.set(2.4, 1.6, 2.4);
    door.rotation.y = -Math.PI / 4;
    group.add(door);

    const hazardStripe = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.3, 0.45), hazardMat);
    hazardStripe.position.set(2.4, 2.2, 2.4);
    hazardStripe.rotation.y = -Math.PI / 4;
    group.add(hazardStripe);

    // Ventilation duct intake cylinder with 4-blade exhaust fan
    const duct = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.4, 12), metalMat);
    duct.position.set(-1.8, 3.8, -1.8);
    duct.rotation.x = Math.PI / 2;
    group.add(duct);

    const fanGroup = new THREE.Group();
    fanGroup.position.set(-1.8, 3.8, -1.1);
    for (let b = 0; b < 4; b++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.16, 0.04), metalMat);
      blade.rotation.z = (b / 4) * Math.PI * 2;
      fanGroup.add(blade);
    }
    group.add(fanGroup);

    // Amber warning beacon & salvage loot crate
    const beaconLight = new THREE.PointLight(0xf97316, 1.6, 8.0);
    beaconLight.position.set(2.4, 3.4, 2.4);
    group.add(beaconLight);

    const crate = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 0.9), metalMat);
    crate.position.set(1.2, 0.4, 1.2);
    group.add(crate);

    parentGroup.add(group);

    this.nolandHideout = {
      group,
      pos,
      doorPos: pos.clone().add(new THREE.Vector3(2.4, 0, 2.4)),
      fanMesh: fanGroup,
      light: beaconLight,
      isLooted: false
    };
  }

  // 4. Royce's Parachute Free-Fall Waterfall Cliff [-28, 0, -26] (+9.0m)
  buildRoyceWaterfallCliffProps(parentGroup) {
    const group = new THREE.Group();
    const pos = new THREE.Vector3(-28, 0, -26);
    group.position.copy(pos);

    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x3d3024, roughness: 0.95 });
    const mossMat = new THREE.MeshStandardMaterial({ color: 0x1f3d1e, roughness: 0.9 });
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      metalness: 0.1,
      roughness: 0.08,
      transparent: true,
      opacity: 0.78
    });

    // Tiered sandstone cliff massif rising to +9.0m
    const tier1 = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 6.2, 3.0, 8), stoneMat);
    tier1.position.y = 1.5;
    group.add(tier1);

    const tier2 = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 5.2, 3.0, 8), stoneMat);
    tier2.position.y = 4.5;
    group.add(tier2);

    const cliffTop = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 4.2, 3.0, 8), mossMat);
    cliffTop.position.y = 7.5;
    cliffTop.receiveShadow = true;
    group.add(cliffTop);

    // Overhanging leap precipice ledge at +9.0m
    const ledge = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.6, 2.4), mossMat);
    ledge.position.set(0, 9.0, 3.2);
    group.add(ledge);

    // Cascading waterfall stream plane
    const waterfall = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 8.8), waterMat);
    waterfall.position.set(0, 4.6, 4.4);
    group.add(waterfall);

    // Deep plunge pool basin at the foot [-28, 0.2, -18]
    const pool = new THREE.Mesh(new THREE.CylinderGeometry(4.8, 5.0, 0.35, 14), waterMat);
    pool.position.set(0, 0.2, 7.8);
    group.add(pool);

    const poolRim = new THREE.Mesh(new THREE.TorusGeometry(5.0, 0.45, 6, 14), stoneMat);
    poolRim.rotation.x = Math.PI / 2;
    poolRim.position.set(0, 0.2, 7.8);
    group.add(poolRim);

    // Cyan bioluminescent plunge glow
    const poolLight = new THREE.PointLight(0x06b6d4, 1.8, 8.0);
    poolLight.position.set(0, 1.2, 7.8);
    group.add(poolLight);

    parentGroup.add(group);

    this.royceCliffWaterfall = {
      group,
      pos: new THREE.Vector3(-28, 9.0, -26),
      poolPos: new THREE.Vector3(-28, 0.5, -18.2)
    };
  }

  // 5. Tracker Predator's Spiked Hell-Hound Kennel & Whistle Totem [-18, 0, -18]
  buildHellhoundKennelProps(parentGroup) {
    const group = new THREE.Group();
    const pos = new THREE.Vector3(-18, 0, -18);
    group.position.copy(pos);

    const woodMat = new THREE.MeshStandardMaterial({ color: 0x3b2416, roughness: 0.95 });
    const boneMat = new THREE.MeshStandardMaterial({ color: 0xd6cebe, roughness: 0.6 });
    const quillMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.3, metalness: 0.8 });
    const ironMat = new THREE.MeshStandardMaterial({ color: 0x292524, metalness: 0.8, roughness: 0.4 });

    // Stockade bone & quill stockade palisade (radius 5.2m)
    for (let p = 0; p < 12; p++) {
      if (p === 6) continue; // Gap for gate entrance
      const a = (p / 12) * Math.PI * 2;
      const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 2.8, 6), woodMat);
      stake.position.set(Math.cos(a) * 4.8, 1.4, Math.sin(a) * 4.8);
      stake.rotation.x = (this.random() - 0.5) * 0.15;
      group.add(stake);

      // Chitinous spikes protruding outward
      const quill = new THREE.Mesh(new THREE.ConeGeometry(0.08, 1.1, 5), quillMat);
      quill.position.set(Math.cos(a) * 4.9, 2.2, Math.sin(a) * 4.9);
      quill.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4);
      group.add(quill);
    }

    // Gnawed bone trough & scattered ribcages
    const trough = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.8), woodMat);
    trough.position.set(-1.2, 0.25, -0.6);
    group.add(trough);

    const rib = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.08, 6, 8, Math.PI), boneMat);
    rib.position.set(1.0, 0.4, 0.5);
    rib.rotation.x = Math.PI / 2;
    group.add(rib);

    // Central iron pike mounting the Tracker Predator's Whistle Totem
    const pike = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.2, 6), ironMat);
    pike.position.set(0, 1.6, 0);
    group.add(pike);

    // Carved acoustic hunting whistle with crimson runes
    const whistle = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.08, 0.7, 8), boneMat);
    whistle.position.set(0, 3.2, 0);
    whistle.rotation.z = Math.PI / 4;
    group.add(whistle);

    const whistleLight = new THREE.PointLight(0xf59e0b, 1.8, 6.0);
    whistleLight.position.set(0, 3.4, 0);
    group.add(whistleLight);

    parentGroup.add(group);

    this.hellhoundKennel = {
      group,
      pos,
      whistlePos: pos.clone().add(new THREE.Vector3(0, 1.6, 0)),
      whistleMesh: whistle,
      isUsed: false
    };
  }

  // 6. Nikolai's Dual Claymore Suicide Blast Memorial Crater [16, 0, -22]
  buildNikolaiBlastMemorialProps(parentGroup) {
    const group = new THREE.Group();
    const pos = new THREE.Vector3(16, 0, -22);
    group.position.copy(pos);

    const scorchMat = new THREE.MeshStandardMaterial({ color: 0x17120e, roughness: 0.98 });
    const armorMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.3 });
    const crateMat = new THREE.MeshStandardMaterial({ color: 0x365314, roughness: 0.7 });
    const claymoreMat = new THREE.MeshStandardMaterial({ color: 0x4d5b38, roughness: 0.6 });

    // Blackened blast crater rim
    const rim = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.4, 6, 14), scorchMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.1;
    group.add(rim);

    const craterCenter = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 0.15, 14), scorchMat);
    craterCenter.position.y = 0.05;
    group.add(craterCenter);

    // Shattered Spetsnaz heavy chest armor plate
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.9, 0.15), armorMat);
    plate.position.set(-0.8, 0.15, 0.6);
    plate.rotation.set(0.2, 0.4, -0.3);
    group.add(plate);

    // Russian military ammo container
    const ammoBox = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.6, 0.6), crateMat);
    ammoBox.position.set(1.0, 0.3, -0.8);
    ammoBox.rotation.y = 0.5;
    group.add(ammoBox);

    // Dual M18A1 Claymore mines on scissor wire folding legs
    [-0.6, 0.6].forEach((xOff, i) => {
      const mine = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.38, 0.14), claymoreMat);
      mine.position.set(xOff, 0.28, 0.2);
      mine.rotation.y = (i === 0 ? -0.2 : 0.2);
      group.add(mine);
    });

    parentGroup.add(group);

    this.nikolaiBlastMemorial = {
      group,
      pos,
      craterPos: pos.clone(),
      isDetonated: false
    };
  }

  // 7. Hanzo's Yakuza Tall-Grass Katana Duel Arena [26, 0, 0]
  buildHanzoDuelArenaProps(parentGroup) {
    const group = new THREE.Group();
    const pos = new THREE.Vector3(26, 0, 0);
    group.position.copy(pos);

    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.8 });
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.96, roughness: 0.1 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.88, roughness: 0.2 });
    const grassMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.9 });

    // Ring of 24 tall amber reed grass clusters swaying in the breeze
    for (let g = 0; g < 24; g++) {
      const a = (g / 24) * Math.PI * 2;
      const r = 5.5 + (g % 3) * 1.0;
      for (let s = 0; s < 4; s++) {
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 2.2 + this.random() * 0.6, 5), grassMat);
        stalk.position.set(
          Math.cos(a) * r + (this.random() - 0.5) * 0.6,
          1.1,
          Math.sin(a) * r + (this.random() - 0.5) * 0.6
        );
        stalk.rotation.z = (this.random() - 0.5) * 0.2;
        group.add(stalk);
      }
    }

    // Central polygonal dueling stone plinth
    const stone = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 0.4, 6), stoneMat);
    stone.position.y = 0.2;
    group.add(stone);

    // Hanzo's Hattori Hanzo Katana planted point-down into the stone
    const katanaGroup = new THREE.Group();
    katanaGroup.position.set(0, 0.4, 0);

    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.4, 0.08), bladeMat);
    blade.position.y = 0.7;
    katanaGroup.add(blade);

    const tsuba = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.04, 8), goldMat);
    tsuba.position.y = 1.4;
    katanaGroup.add(tsuba);

    const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.45, 6), bladeMat);
    hilt.position.y = 1.65;
    katanaGroup.add(hilt);

    group.add(katanaGroup);

    // Pure white glint light
    const glint = new THREE.PointLight(0xffedd5, 1.6, 6.0);
    glint.position.set(0, 1.8, 0);
    group.add(glint);

    parentGroup.add(group);

    this.hanzoDuelArena = {
      group,
      pos,
      katanaPos: pos.clone().add(new THREE.Vector3(0, 0.4, 0)),
      katanaMesh: katanaGroup,
      isDrawn: false
    };
  }

  // 8. Dr. Edwin's Neurotoxin Alien Flora Patch [18, 0, 18]
  buildAlienFloraPatchProps(parentGroup) {
    const group = new THREE.Group();
    const pos = new THREE.Vector3(18, 0, 18);
    group.position.copy(pos);

    const bulbMat = new THREE.MeshStandardMaterial({
      color: 0x9333ea,
      metalness: 0.1,
      roughness: 0.25,
      transparent: true,
      opacity: 0.85
    });
    const tendrilMat = new THREE.MeshStandardMaterial({ color: 0x4c1d95, roughness: 0.8 });

    // 5 bulbous carnivorous pitcher plants
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2;
      const r = 1.8 + (p % 2) * 0.8;
      const plantGroup = new THREE.Group();
      plantGroup.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);

      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 1.4, 6), tendrilMat);
      stalk.position.y = 0.7;
      plantGroup.add(stalk);

      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.65, 8, 8), bulbMat);
      bulb.position.y = 1.5;
      bulb.scale.set(0.85, 1.3, 0.85);
      plantGroup.add(bulb);

      group.add(plantGroup);
    }

    // Bioluminescent purple/magenta neurotoxin core light
    const toxinLight = new THREE.PointLight(0xd946ef, 2.2, 7.0);
    toxinLight.position.set(0, 1.8, 0);
    group.add(toxinLight);

    parentGroup.add(group);

    this.alienFloraPatch = {
      group,
      pos,
      harvestPos: pos.clone().add(new THREE.Vector3(0, 0.5, 0)),
      light: toxinLight,
      cooldown: 0
    };
  }

  // 9. Royce's Scavenged Grenade Tripwire Perimeter [-8, 0, 8]
  buildRoyceTripwireTrapProps(parentGroup) {
    const group = new THREE.Group();
    const pos = new THREE.Vector3(-8, 0, 8);
    group.position.copy(pos);

    const woodMat = new THREE.MeshStandardMaterial({ color: 0x3f2212, roughness: 0.95 });
    const wireMat = new THREE.MeshBasicMaterial({ color: 0x15803d });
    const grenadeMat = new THREE.MeshStandardMaterial({ color: 0x3f4f2c, metalness: 0.6, roughness: 0.5 });

    // Two anchoring timber stakes (distance 5.2m)
    const postL = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 1.4, 6), woodMat);
    postL.position.set(-2.6, 0.7, 0);
    group.add(postL);

    const postR = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 1.4, 6), woodMat);
    postR.position.set(2.6, 0.7, 0);
    group.add(postR);

    // Taut olive green tripwire spanning the gap
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 5.2, 4), wireMat);
    wire.position.set(0, 0.28, 0);
    wire.rotation.z = Math.PI / 2;
    group.add(wire);

    // 3 suspended F-1 grenades
    [-1.2, 0, 1.2].forEach(xOff => {
      const grenade = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 6), grenadeMat);
      grenade.position.set(xOff, 0.24, 0);
      group.add(grenade);
    });

    parentGroup.add(group);

    this.royceTripwireTrap = {
      group,
      pos,
      wireMesh: wire,
      isTripped: false
    };
  }

  // 10. Super Predator Berserker (Mr. Black) Ship Launch Dais [0, 0, -32] (+3.0m)
  buildSuperPredatorShipDaisProps(parentGroup) {
    const group = new THREE.Group();
    const pos = new THREE.Vector3(0, 0, -32);
    group.position.copy(pos);

    const obsidianMat = new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.85, roughness: 0.25 });
    const thrusterMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const glyphMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });

    // Truncated stepped pyramid dais rising to +3.0m
    const baseTier = new THREE.Mesh(new THREE.BoxGeometry(11.0, 1.5, 11.0), obsidianMat);
    baseTier.position.y = 0.75;
    baseTier.receiveShadow = true;
    group.add(baseTier);

    const upperTier = new THREE.Mesh(new THREE.BoxGeometry(8.5, 1.5, 8.5), obsidianMat);
    upperTier.position.y = 2.25;
    upperTier.receiveShadow = true;
    group.add(upperTier);

    // Scout ship launch cradle cradles & twin angular propulsion nozzles
    [-2.2, 2.2].forEach(xOff => {
      const thruster = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.9, 2.2, 8), obsidianMat);
      thruster.position.set(xOff, 3.8, -1.8);
      thruster.rotation.x = Math.PI / 4;
      group.add(thruster);

      const nozzleGlow = new THREE.Mesh(new THREE.CircleGeometry(0.6, 8), thrusterMat);
      nozzleGlow.position.set(xOff, 3.4, -2.4);
      nozzleGlow.rotation.x = -Math.PI / 4;
      group.add(nozzleGlow);
    });

    // Remote telemetry console with red alien glyph display
    const consoleStand = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 0.6), obsidianMat);
    consoleStand.position.set(0, 3.6, 2.0);
    group.add(consoleStand);

    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.5), glyphMat);
    screen.position.set(0, 4.0, 2.32);
    group.add(screen);

    // Directional plasma torch light
    const shipLight = new THREE.PointLight(0xef4444, 2.5, 10.0);
    shipLight.position.set(0, 4.2, 0);
    group.add(shipLight);

    parentGroup.add(group);

    this.superPredatorShipDais = {
      group,
      pos: new THREE.Vector3(0, 3.0, -32),
      consolePos: new THREE.Vector3(0, 3.2, -30.0),
      light: shipLight,
      isOverloaded: false
    };
  }

  // 11. Quadruple Celestial Moons Horizon Vista Monolith [30, 0, -26] (+7.5m)
  buildCelestialVistaMonolithProps(parentGroup) {
    const group = new THREE.Group();
    const pos = new THREE.Vector3(30, 0, -26);
    group.position.copy(pos);

    const basaltMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 });
    const runeMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

    // Basalt promontory plateau rising to +7.5m
    const basePillar = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 5.0, 7.5, 8), basaltMat);
    basePillar.position.y = 3.75;
    basePillar.receiveShadow = true;
    group.add(basePillar);

    // Ancient carved Yautja monolith depicting planetary alignment
    const monolith = new THREE.Mesh(new THREE.BoxGeometry(1.4, 4.5, 0.8), basaltMat);
    monolith.position.set(0, 9.75, 0);
    monolith.castShadow = true;
    group.add(monolith);

    // 4 celestial lunar alignment glyphs
    for (let m = 0; m < 4; m++) {
      const moonGlyph = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.22, 12), runeMat);
      moonGlyph.position.set(0, 8.4 + m * 0.75, 0.42);
      group.add(moonGlyph);
    }

    // Sky-blue holographic celestial aura
    const vistaLight = new THREE.PointLight(0x38bdf8, 2.0, 9.0);
    vistaLight.position.set(0, 10.5, 0);
    group.add(vistaLight);

    // High-altitude celestial moons & ringed gas giant in the alien sky (Predators 2010 hallmark)
    const skyGroup = new THREE.Group();
    skyGroup.position.set(45, 65, -55);

    // 1. Enormous Banded Gas Giant Planet (Radius 18m)
    const gasGiantMat = new THREE.MeshBasicMaterial({ color: 0x9a3412 });
    const gasGiant = new THREE.Mesh(new THREE.SphereGeometry(18.0, 24, 24), gasGiantMat);
    skyGroup.add(gasGiant);

    // Planetary Dust Ring (Inner 22m, Outer 34m)
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xd97706, side: THREE.DoubleSide, transparent: true, opacity: 0.65 });
    const ring = new THREE.Mesh(new THREE.RingGeometry(22.0, 34.0, 32), ringMat);
    ring.rotation.x = Math.PI / 3;
    ring.rotation.y = Math.PI / 6;
    skyGroup.add(ring);

    // 4 Orbiting Celestial Moons
    const moonConfigs = [
      { r: 4.2, x: -28, y: 12, z: 8, color: 0x38bdf8 },   // Luminescent Cyan Moon
      { r: 3.5, x: 26, y: -10, z: -12, color: 0xef4444 },  // Cratered Crimson Moon
      { r: 2.8, x: -14, y: -18, z: 16, color: 0xfef08a },  // Pale Amber Moon
      { r: 2.2, x: 18, y: 16, z: 22, color: 0xa855f7 }    // Deep Violet Moon
    ];

    moonConfigs.forEach(cfg => {
      const moon = new THREE.Mesh(new THREE.SphereGeometry(cfg.r, 16, 16), new THREE.MeshBasicMaterial({ color: cfg.color }));
      moon.position.set(cfg.x, cfg.y, cfg.z);
      skyGroup.add(moon);
    });

    group.add(skyGroup);

    parentGroup.add(group);

    this.celestialVistaMonolith = {
      group,
      pos: new THREE.Vector3(30, 7.5, -26),
      light: vistaLight,
      skyGroup
    };
  }

  // 12. Falconer Predator Recon Drone Roost & Perch [10, 0, 14] (+4.8m)
  buildFalconerDronePerchProps(parentGroup) {
    const group = new THREE.Group();
    const pos = new THREE.Vector3(10, 0, 14);
    group.position.copy(pos);

    const banyanMat = new THREE.MeshStandardMaterial({ color: 0x3d2012, roughness: 0.95 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x1f2421, metalness: 0.9, roughness: 0.25 });
    const runeMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });

    // Elevated twisted banyan tree trunk rising to +4.8m
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.2, 10.0, 8), banyanMat);
    trunk.position.y = 5.0;
    trunk.castShadow = true;
    group.add(trunk);

    // Roost landing cradle platform at +4.8m
    const roost = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.8, 0.4, 8), metalMat);
    roost.position.y = 4.8;
    roost.receiveShadow = true;
    group.add(roost);

    // Avian mechanical perch claws
    for (let c = 0; c < 4; c++) {
      const a = (c / 4) * Math.PI * 2;
      const claw = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.8, 4), metalMat);
      claw.position.set(Math.cos(a) * 2.2, 5.2, Math.sin(a) * 2.2);
      claw.rotation.z = -0.3;
      group.add(claw);
    }

    // Holographic amber telemetry landing ring
    const holoRing = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.8, 16), runeMat);
    holoRing.rotation.x = -Math.PI / 2;
    holoRing.position.y = 4.85;
    group.add(holoRing);

    const roostLight = new THREE.PointLight(0xf59e0b, 1.8, 6.0);
    roostLight.position.set(0, 5.5, 0);
    group.add(roostLight);

    parentGroup.add(group);

    this.falconerDronePerch = {
      group,
      pos: new THREE.Vector3(10, 4.8, 14),
      roostPos: new THREE.Vector3(10, 4.8, 14),
      holoRing,
      light: roostLight,
      isLaunched: false
    };
  }

  // 13. Cuchillo's Booby-Trapped Acoustic Decoy [-10, 0, -6]
  buildCuchilloDecoyProps(parentGroup) {
    const group = new THREE.Group();
    const pos = new THREE.Vector3(-10, 0, -6);
    group.position.copy(pos);

    const vestMat = new THREE.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.8 });
    const radioMat = new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.8, roughness: 0.3 });
    const ledMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });

    // Discarded Los Zetas tactical vest on bloodstained soil
    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 0.7), vestMat);
    vest.position.y = 0.2;
    group.add(vest);

    // Rigged military radio transmitter with blinking red LED
    const radio = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.15, 0.25), radioMat);
    radio.position.set(0, 0.45, 0);
    group.add(radio);

    const led = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), ledMat);
    led.position.set(0.1, 0.54, 0.08);
    group.add(led);

    const decoyLight = new THREE.PointLight(0xef4444, 1.4, 5.0);
    decoyLight.position.set(0, 0.8, 0);
    group.add(decoyLight);

    parentGroup.add(group);

    this.cuchilloAcousticDecoy = {
      group,
      pos,
      decoyPos: pos.clone(),
      light: decoyLight,
      ledMesh: led,
      isDisarmed: false,
      isDetonated: false,
      pulseTimer: 0
    };
  }

  // 14. Mombassa's Spring-Loaded Punji Stake Pit Trap [-4, 0, 18]
  buildMombassaPunjiTrapProps(parentGroup) {
    const group = new THREE.Group();
    const pos = new THREE.Vector3(-4, 0, 18);
    group.position.copy(pos);

    const woodMat = new THREE.MeshStandardMaterial({ color: 0x3b2416, roughness: 0.95 });
    const stakeMat = new THREE.MeshStandardMaterial({ color: 0x713f12, roughness: 0.7 });
    const poisonMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.4 });

    // Camouflaged pit rim
    const pitRim = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.3, 6, 12), woodMat);
    pitRim.rotation.x = Math.PI / 2;
    pitRim.position.y = 0.1;
    group.add(pitRim);

    // Spring-loaded bamboo & bone stake racks (4 inward-facing clusters)
    const racks = [];
    for (let r = 0; r < 4; r++) {
      const a = (r / 4) * Math.PI * 2;
      const rackGroup = new THREE.Group();
      rackGroup.position.set(Math.cos(a) * 2.0, 0.2, Math.sin(a) * 2.0);
      rackGroup.rotation.y = a + Math.PI;

      for (let s = -2; s <= 2; s++) {
        const stake = new THREE.Mesh(new THREE.ConeGeometry(0.06, 1.4, 5), stakeMat);
        stake.position.set(s * 0.28, 0.6, 0);
        stake.rotation.x = 0.4;
        rackGroup.add(stake);

        // Toxic dipped tip
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.062, 0.35, 5), poisonMat);
        tip.position.set(s * 0.28, 1.15, 0.22);
        tip.rotation.x = 0.4;
        rackGroup.add(tip);
      }
      group.add(rackGroup);
      racks.push(rackGroup);
    }

    parentGroup.add(group);

    this.mombassaPunjiTrap = {
      group,
      pos,
      trapPos: pos.clone(),
      racks,
      isSprung: false
    };
  }

  // 15. Royce's Bone Gong & Sacrificial Fire Braziers [0, 0, 8]
  buildRoyceBoneGongProps(parentGroup) {
    const group = new THREE.Group();
    const pos = new THREE.Vector3(0, 0, 8);
    group.position.copy(pos);

    const boneMat = new THREE.MeshStandardMaterial({ color: 0xd6cebe, roughness: 0.5 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x3f2212, roughness: 0.95 });
    const ironMat = new THREE.MeshStandardMaterial({ color: 0x1f2421, metalness: 0.8, roughness: 0.35 });

    // Heavy timber gallows post
    const postL = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 3.8, 6), woodMat);
    postL.position.set(-1.4, 1.9, 0);
    group.add(postL);

    const postR = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 3.8, 6), woodMat);
    postR.position.set(1.4, 1.9, 0);
    group.add(postR);

    const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 3.2, 6), woodMat);
    crossbar.position.set(0, 3.6, 0);
    crossbar.rotation.z = Math.PI / 2;
    group.add(crossbar);

    // Suspended alien ribcage bone gong
    const gong = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.22, 8, 12), boneMat);
    gong.position.set(0, 2.2, 0);
    gong.castShadow = true;
    group.add(gong);

    // Mallet striker on pedestal
    const mallet = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, 1.1, 6), boneMat);
    mallet.position.set(0.6, 1.2, 0.4);
    mallet.rotation.z = Math.PI / 4;
    group.add(mallet);

    // 6 Sacrificial iron brazier pots in circle around the clearing (radius 6.5m)
    const braziers = [];
    for (let b = 0; b < 6; b++) {
      const a = (b / 6) * Math.PI * 2;
      const bx = Math.cos(a) * 6.5;
      const bz = Math.sin(a) * 6.5;

      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.3, 0.6, 8), ironMat);
      pot.position.set(bx, 0.3, bz);
      group.add(pot);

      const fireMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.0 })
      );
      fireMesh.position.set(bx, 0.7, bz);
      group.add(fireMesh);

      const fireLight = new THREE.PointLight(0xf97316, 0.0, 8.0);
      fireLight.position.set(bx, 1.0, bz);
      group.add(fireLight);

      braziers.push({ pot, fireMesh, fireLight, pos: new THREE.Vector3(pos.x + bx, 0.3, pos.z + bz) });
    }

    parentGroup.add(group);

    this.royceBoneGong = {
      group,
      pos,
      gongPos: pos.clone().add(new THREE.Vector3(0, 1.2, 0)),
      gongMesh: gong,
      braziers,
      isStruck: false,
      blindTimer: 0
    };
  }

  // 16. Isabelle's Blaser R93 Tactical Sniper Stash [-28, 9.0, -28] (+9.0m)
  buildIsabelleSniperStashProps(parentGroup) {
    const group = new THREE.Group();
    const pos = new THREE.Vector3(-28, 9.0, -28);
    group.position.copy(pos);

    const caseMat = new THREE.MeshStandardMaterial({ color: 0x365314, roughness: 0.6 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9, roughness: 0.2 });
    const scopeMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });

    // Tactical rifle transport case (opened)
    const rifleCase = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.25, 0.5), caseMat);
    rifleCase.position.y = 0.12;
    group.add(rifleCase);

    // Blaser R93 barrel & thermal scope silhouette
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.3, 6), metalMat);
    barrel.position.set(0, 0.26, 0);
    barrel.rotation.z = Math.PI / 2;
    group.add(barrel);

    const scopeLens = new THREE.Mesh(new THREE.CircleGeometry(0.06, 8), scopeMat);
    scopeLens.position.set(-0.25, 0.35, 0.06);
    group.add(scopeLens);

    // Tactical night-vision green reticle glow
    const stashLight = new THREE.PointLight(0x22c55e, 1.4, 4.5);
    stashLight.position.set(0, 0.6, 0);
    group.add(stashLight);

    parentGroup.add(group);

    this.isabelleSniperStash = {
      group,
      pos,
      stashPos: pos.clone(),
      light: stashLight,
      isClaimed: false
    };
  }

  /* === PREDATORS (2010) GAME PRESERVE INTERACTION METHODS === */

  // Ronald Noland's Drilling Rig Hideout Interaction
  checkNolandHideoutInteraction(player, ui, audio) {
    if (!this.nolandHideout || !player || !player.position || this.nolandHideout.isLooted) return false;
    if (player.position.distanceTo(this.nolandHideout.doorPos) <= 4.8) {
      this.nolandHideout.isLooted = true;
      if (audio && audio.playNolandSmokeGrenadePop) audio.playNolandSmokeGrenadePop();

      // Spawn optical dispersion smoke screen dome covering 24m
      const smokeGeo = new THREE.SphereGeometry(18.0, 16, 12);
      const smokeMat = new THREE.MeshBasicMaterial({
        color: 0x94a3b8,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide
      });
      const smokeMesh = new THREE.Mesh(smokeGeo, smokeMat);
      smokeMesh.position.copy(this.nolandHideout.doorPos);
      this.addReferenceObject(smokeMesh);

      this.activePreserveSmokeScreen = {
        mesh: smokeMesh,
        pos: this.nolandHideout.doorPos.clone(),
        timer: 18.0
      };

      // Scavenged ordnance & survival ammo
      player.gaussSlugs = (player.gaussSlugs || 0) + 4;
      player.plasmaCharges = Math.min(player.maxPlasmaCharges || 10, (player.plasmaCharges || 0) + 4);
      player.shield = Math.min(player.maxShield || 600, player.shield + 350);
      if (player.addScore) player.addScore(1500);

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement('🌫️ PLANQUE DE NOLAND OUVERTE (PREDATORS 2010) : ÉCRAN DE FUMÉE DÉPLOYÉ (18S) + CHARGES DE SURVIE (+1500 SCORE) !', 'success');
      }
      return true;
    }
    return false;
  }

  // Tracker Predator's Spiked Hell-Hound Whistle Totem Interaction
  checkTrackerWhistleInteraction(player, ui, audio, horde, hellHoundsManager) {
    if (!this.hellhoundKennel || !player || !player.position || this.hellhoundKennel.isUsed) return false;
    if (player.position.distanceTo(this.hellhoundKennel.whistlePos) <= 4.5) {
      this.hellhoundKennel.isUsed = true;
      if (audio) {
        if (audio.playTrackerHoundWhistle) audio.playTrackerHoundWhistle();
        this.referenceDelay(() => {
          if (audio.playHellhoundSnarlRoar) audio.playHellhoundSnarlRoar();
        }, 280);
      }

      // Summon loyal Hell-Hound hunting pack
      if (hellHoundsManager && hellHoundsManager.summonPack) {
        hellHoundsManager.summonPack(player.position, 2);
      }

      // Sonic acoustic pulse stuns and damages Xenomorphs
      let stunnedCount = 0;
      if (horde && horde.aliens) {
        horde.aliens.forEach(alien => {
          if (alien && alien.mesh && alien.hp > 0 && alien.mesh.position.distanceTo(this.hellhoundKennel.whistlePos) <= 24.0) {
            alien.hp -= 220;
            alien.isStunned = true;
            alien.stunTimer = 4.5;
            stunnedCount++;
          }
        });
      }

      if (player.recordTrophy) {
        player.recordTrophy('Sifflet Sonique Ancestral du Tracker Predator (Predators 2010)', 2500);
      }

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement(`🐺 SIFFLET DU TRACKER PREDATOR DÉCHAÎNÉ : MEUTE DE HOUNDS INVOQUÉE & ${stunnedCount} XÉNOS STUNNÉS (4.5S, +2500 HONNEUR) !`, 'success');
      }
      return true;
    }
    return false;
  }

  // Nikolai's Dual Claymore Suicide Blast Memorial Interaction
  checkNikolaiClaymoreInteraction(player, ui, audio, horde, bosses, particles) {
    if (!this.nikolaiBlastMemorial || !player || !player.position || this.nikolaiBlastMemorial.isDetonated) return false;
    if (player.position.distanceTo(this.nikolaiBlastMemorial.craterPos) <= 4.2) {
      this.nikolaiBlastMemorial.isDetonated = true;
      if (audio && audio.playNikolaiDualClaymoreDetonation) audio.playNikolaiDualClaymoreDetonation();
      if (particles && particles.emitExplosion) {
        particles.emitExplosion(this.nikolaiBlastMemorial.craterPos, 28);
      }

      let blastKills = 0;
      if (horde && horde.aliens) {
        horde.aliens.forEach(alien => {
          if (alien && alien.mesh && alien.hp > 0 && alien.mesh.position.distanceTo(this.nikolaiBlastMemorial.craterPos) <= 16.0) {
            alien.hp -= 650;
            alien.isStunned = true;
            alien.stunTimer = 3.5;
            blastKills++;
          }
        });
      }
      if (bosses && bosses.activeBosses) {
        bosses.activeBosses.forEach(boss => {
          if (boss && boss.mesh && boss.hp > 0 && boss.mesh.position.distanceTo(this.nikolaiBlastMemorial.craterPos) <= 16.0) {
            boss.hp -= 650;
            boss.isStunned = true;
            boss.stunTimer = 3.0;
          }
        });
      }

      player.grenades30mm = (player.grenades30mm || 0) + 6;
      if (player.addScore) player.addScore(2000);

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement(`💥 SACRIFICE DE NIKOLAI (PREDATORS 2010) : DÉTONATION DES CLAYMORES SPETSNAZ (${blastKills} XÉNOS PULVÉRISÉS, +6 GRENADES, +2000 SCORE) !`, 'success');
      }
      return true;
    }
    return false;
  }

  // Hanzo's Yakuza Katana Dueling Arena Interaction
  checkHanzoArenaInteraction(player, ui, audio) {
    if (!this.hanzoDuelArena || !player || !player.position || this.hanzoDuelArena.isDrawn) return false;
    if (player.position.distanceTo(this.hanzoDuelArena.katanaPos) <= 4.2) {
      this.hanzoDuelArena.isDrawn = true;
      if (this.hanzoDuelArena.katanaMesh) {
        this.hanzoDuelArena.katanaMesh.position.y += 0.8;
      }
      if (audio && audio.playHanzoKatanaRing) audio.playHanzoKatanaRing();

      if (player.applyHanzoBushido) {
        player.applyHanzoBushido(35.0);
      }
      if (player.recordTrophy) {
        player.recordTrophy('Hattori Hanzo Katana du Yakuza (Predators 2010)', 2500);
      }

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement('⚔️ KATANA DE HANZO DÉGAÎNÉ DANS LES HAUTES HERBES (PREDATORS 2010) : BUFF BUSHIDO ACTIF (+60% DÉGÂTS CRITIQUES MÊLÉE, +2500 HONNEUR) !', 'success');
      }
      return true;
    }
    return false;
  }

  // Dr. Edwin's Neurotoxin Alien Flora Extraction Interaction
  checkAlienFloraHarvest(player, ui, audio) {
    if (!this.alienFloraPatch || !player || !player.position) return false;
    if (player.position.distanceTo(this.alienFloraPatch.harvestPos) <= 4.2) {
      if (this.alienFloraPatch.cooldown > 0) {
        if (ui && ui.showAnnouncement) {
          ui.showAnnouncement(`⏳ BULBES DE NEUROTOXINE EN RECHARGE (${Math.ceil(this.alienFloraPatch.cooldown)}S)`);
        }
        return true;
      }
      this.alienFloraPatch.cooldown = 40.0;
      if (audio && audio.playAlienFloraNeurotoxinHiss) audio.playAlienFloraNeurotoxinHiss();

      if (player.applyNeurotoxinBlade) {
        player.applyNeurotoxinBlade(30.0);
      }
      if (player.addScore) player.addScore(1500);

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement('🧪 NEUROTOXINE PARALYSANTE EXTRAITE (PREDATORS 2010) : LAMES EMPOISONNÉES (+150 DMG POISON PAR COUP PENDANT 30S) !', 'success');
      }
      return true;
    }
    return false;
  }

  // Royce's Free-fall Cliff Leap Overlook Interaction
  checkRoyceCliffLeapInteraction(player, ui, audio, particles) {
    if (!this.royceCliffWaterfall || !player || !player.position) return false;
    if (player.position.y >= 7.5 && player.position.distanceTo(this.royceCliffWaterfall.pos) <= 4.8) {
      if (audio && audio.playRoyceParachuteFreefallGale) audio.playRoyceParachuteFreefallGale();

      // Plunge player down safely into the river plunge pool
      player.position.set(-28, 0.5, -18.2);
      if (player.stamina !== undefined) player.stamina = player.maxStamina || 100;
      if (player.acidBurnTimer !== undefined) player.acidBurnTimer = 0;
      if (player.addScore) player.addScore(1000);

      if (particles && particles.emitSparks) {
        particles.emitSparks(player.position, 16);
      }

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement('🪂 SAUT DE L\'ANGE DE ROYCE (PREDATORS 2010) : PLONGEON DE 9 MÈTRES DANS LA CASCADE (ENDURANCE RESTAURÉE, +1000 SCORE) !', 'success');
      }
      return true;
    }
    return false;
  }

  // Super Predator Berserker (Mr. Black) Ship Launch Dais Interaction
  checkSuperPredatorShipInteraction(player, ui, audio, horde, bosses, particles) {
    if (!this.superPredatorShipDais || !player || !player.position || this.superPredatorShipDais.isOverloaded) return false;
    if (player.position.distanceTo(this.superPredatorShipDais.consolePos) <= 4.5) {
      this.superPredatorShipDais.isOverloaded = true;
      if (audio && audio.playSuperPredatorShipRemoteBeep) audio.playSuperPredatorShipRemoteBeep();

      if (particles && particles.emitExplosion) {
        particles.emitExplosion(new THREE.Vector3(0, 3.5, -34.0), 32);
      }

      // Directional plasma torch incinerates everything in front on 25m cone
      let torchCount = 0;
      if (horde && horde.aliens) {
        horde.aliens.forEach(alien => {
          if (alien && alien.mesh && alien.hp > 0 && alien.mesh.position.distanceTo(this.superPredatorShipDais.pos) <= 26.0 && alien.mesh.position.z >= -32.0) {
            alien.hp -= 750;
            alien.isStunned = true;
            alien.stunTimer = 4.0;
            torchCount++;
          }
        });
      }
      if (bosses && bosses.activeBosses) {
        bosses.activeBosses.forEach(boss => {
          if (boss && boss.mesh && boss.hp > 0 && boss.mesh.position.distanceTo(this.superPredatorShipDais.pos) <= 26.0 && boss.mesh.position.z >= -32.0) {
            boss.hp -= 750;
            boss.isStunned = true;
            boss.stunTimer = 3.5;
          }
        });
      }

      if (player.recordTrophy) {
        player.recordTrophy('Console de Commande du Vaisseau de Mr. Black (Predators 2010)', 2500);
      }

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement(`🚀 RÉACTEUR DU VAISSEAU DE MR. BLACK SURCHARGÉ (PREDATORS 2010) : TORCHE PLASMA DÉVASTATRICE (${torchCount} XÉNOS INCINÉRÉS, +2500 HONNEUR) !`, 'success');
      }
      return true;
    }
    return false;
  }

  // Royce's Scavenged Grenade Tripwire Perimeter Trigger
  checkRoyceTripwireTrigger(hitPos, audio, horde, bosses, particles, ui) {
    if (!this.royceTripwireTrap || !hitPos || this.royceTripwireTrap.isTripped) return false;
    if (hitPos.distanceTo(this.royceTripwireTrap.pos) <= 3.8) {
      this.royceTripwireTrap.isTripped = true;
      if (this.royceTripwireTrap.wireMesh) {
        this.royceTripwireTrap.group.remove(this.royceTripwireTrap.wireMesh);
      }
      if (audio && audio.playNikolaiDualClaymoreDetonation) audio.playNikolaiDualClaymoreDetonation();

      if (particles && particles.emitExplosion) {
        particles.emitExplosion(this.royceTripwireTrap.pos, 24);
      }

      let trapCasualties = 0;
      if (horde && horde.aliens) {
        horde.aliens.forEach(alien => {
          if (alien && alien.mesh && alien.hp > 0 && alien.mesh.position.distanceTo(this.royceTripwireTrap.pos) <= 12.0) {
            alien.hp -= 480;
            alien.isStunned = true;
            alien.stunTimer = 3.0;
            trapCasualties++;
          }
        });
      }

      // Spawn persistent burning fire zone for 12 seconds
      const fireGeo = new THREE.CylinderGeometry(4.0, 4.0, 0.2, 12);
      const fireMat = new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.8 });
      const fireMesh = new THREE.Mesh(fireGeo, fireMat);
      fireMesh.position.copy(this.royceTripwireTrap.pos);
      this.addReferenceObject(fireMesh);

      const fireLight = new THREE.PointLight(0xf97316, 2.5, 9.0);
      fireLight.position.copy(this.royceTripwireTrap.pos);
      fireLight.position.y += 1.2;
      this.addReferenceObject(fireLight);

      this.activePreserveFireZones.push({
        mesh: fireMesh,
        light: fireLight,
        pos: this.royceTripwireTrap.pos.clone(),
        timer: 12.0
      });

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement(`💣 PIÈGE DE GRENADES DE ROYCE DÉCLENCHÉ (PREDATORS 2010) : DÉFLAGRATION EN CHAÎNE & BRASIER DE PITCH (${trapCasualties} TOUCHÉS, 480 DMG, BRÛLURE 12S) !`, 'warning');
      }
      return true;
    }
    return false;
  }

  // Falconer Predator Recon Drone Roost Interaction
  checkFalconerRoostInteraction(player, ui, audio, falconDrone) {
    if (!this.falconerDronePerch || !player || !player.position || this.falconerDronePerch.isLaunched) return false;
    if (player.position.distanceTo(this.falconerDronePerch.roostPos) <= 4.5) {
      this.falconerDronePerch.isLaunched = true;
      if (audio && audio.playFalconerDroneLaunch) audio.playFalconerDroneLaunch();

      if (falconDrone && falconDrone.launch) {
        falconDrone.launch(player.position);
      }

      if (player.recordTrophy) {
        player.recordTrophy('Perchoir & Terminal de Liaison du Falconer Predator (Predators 2010)', 2500);
      }

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement('🦅 DRONE FAUCON FALCONER DÉPLOYÉ (PREDATORS 2010) : VERROUILLAGE LASER & TIRS MICRO-PLASMA AÉRIENS (+2500 HONNEUR) !', 'success');
      }
      return true;
    }
    return false;
  }

  // Cuchillo's Booby-Trapped Acoustic Decoy Disarm / Interaction
  checkCuchilloDecoyInteraction(player, ui, audio, horde, bosses, particles) {
    if (!this.cuchilloAcousticDecoy || !player || !player.position || this.cuchilloAcousticDecoy.isDisarmed || this.cuchilloAcousticDecoy.isDetonated) return false;
    if (player.position.distanceTo(this.cuchilloAcousticDecoy.decoyPos) <= 4.2) {
      this.cuchilloAcousticDecoy.isDisarmed = true;
      if (this.cuchilloAcousticDecoy.light) {
        this.cuchilloAcousticDecoy.light.color.setHex(0x22c55e); // Disarmed green
      }

      player.grenades30mm = (player.grenades30mm || 0) + 4;
      player.medicompCharges = Math.min(5, (player.medicompCharges || 0) + 3);
      if (player.addScore) player.addScore(1500);

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement('📻 PIÈGE ACOUSTIQUE DE CUCHILLO DÉSARMÉ (PREDATORS 2010) : CHARGES & SOINS RÉCUPÉRÉS (+4 GRENADES, +3 MEDICOMP, +1500 SCORE) !', 'success');
      }
      return true;
    }
    return false;
  }

  // Cuchillo's Booby-Trapped Decoy Detonation (Triggered by enemy contact or weapon hit)
  triggerCuchilloDecoyBlast(audio, horde, bosses, particles, ui) {
    if (!this.cuchilloAcousticDecoy || this.cuchilloAcousticDecoy.isDetonated || this.cuchilloAcousticDecoy.isDisarmed) return;
    this.cuchilloAcousticDecoy.isDetonated = true;

    if (audio && audio.playNikolaiDualClaymoreDetonation) audio.playNikolaiDualClaymoreDetonation();
    if (particles && particles.emitExplosion) {
      particles.emitExplosion(this.cuchilloAcousticDecoy.decoyPos, 28);
    }

    let kills = 0;
    if (horde && horde.aliens) {
      horde.aliens.forEach(alien => {
        if (alien && alien.mesh && alien.hp > 0 && alien.mesh.position.distanceTo(this.cuchilloAcousticDecoy.decoyPos) <= 14.0) {
          alien.hp -= 520;
          alien.isStunned = true;
          alien.stunTimer = 3.5;
          kills++;
        }
      });
    }

    if (ui && ui.showAnnouncement) {
      ui.showAnnouncement(`💣 PIÈGE D'EMBUSCADE DE CUCHILLO EXPLOSÉ (PREDATORS 2010) : SOUFFLE INCENDIAIRE (${kills} XÉNOS PULVÉRISÉS, 520 DMG) !`, 'warning');
    }
  }

  // Mombassa's Spring-Loaded Punji Stake Pit Trap Trigger
  checkMombassaPunjiTrapTrigger(hitPos, audio, horde, bosses, particles, ui) {
    if (!this.mombassaPunjiTrap || !hitPos || this.mombassaPunjiTrap.isSprung) return false;
    if (hitPos.distanceTo(this.mombassaPunjiTrap.pos) <= 3.6) {
      this.mombassaPunjiTrap.isSprung = true;
      if (audio && audio.playPunjiSpringSnap) audio.playPunjiSpringSnap();

      // Animate spring racks snapping inward
      if (this.mombassaPunjiTrap.racks) {
        this.mombassaPunjiTrap.racks.forEach(rack => {
          rack.position.multiplyScalar(0.45);
        });
      }

      let victims = 0;
      if (horde && horde.aliens) {
        horde.aliens.forEach(alien => {
          if (alien && alien.mesh && alien.hp > 0 && alien.mesh.position.distanceTo(this.mombassaPunjiTrap.pos) <= 7.5) {
            alien.hp -= 580;
            alien.isStunned = true;
            alien.stunTimer = 4.0;
            victims++;
            if (particles && particles.emitAlienBloodSpurt) {
              particles.emitAlienBloodSpurt(alien.mesh.position, 16);
            }
          }
        });
      }

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement(`🎋 PIÈGE DE PIEUX PUNJI DE MOMBASSA DÉCLENCHÉ (PREDATORS 2010) : DÉTENTE À RESSORT (${victims} XÉNOS EMPALÉS, 580 DMG, STUN 4S) !`, 'warning');
      }
      return true;
    }
    return false;
  }

  // Royce's Bone Gong & Sacrificial Fire Braziers Interaction
  checkBoneGongInteraction(player, ui, audio, horde, bosses, particles) {
    if (!this.royceBoneGong || !player || !player.position) return false;
    if (player.position.distanceTo(this.royceBoneGong.gongPos) <= 4.2) {
      if (this.royceBoneGong.isStruck && this.royceBoneGong.blindTimer > 0) {
        if (ui && ui.showAnnouncement) {
          ui.showAnnouncement(`⏳ BRASIER DE CHASSE ACTIF (${Math.ceil(this.royceBoneGong.blindTimer)}S RESTANTES)`);
        }
        return true;
      }
      this.royceBoneGong.isStruck = true;
      this.royceBoneGong.blindTimer = 22.0;

      if (audio && audio.playBoneGongStrike) audio.playBoneGongStrike();

      // Light up all 6 surrounding fire braziers
      if (this.royceBoneGong.braziers) {
        this.royceBoneGong.braziers.forEach(b => {
          if (b.fireMesh) b.fireMesh.material.opacity = 0.85;
          if (b.fireLight) b.fireLight.intensity = 2.8;
        });
      }

      // Blind thermal tracking for all horde enemies in arena
      if (horde && horde.aliens) {
        horde.aliens.forEach(alien => {
          if (alien && alien.mesh && alien.hp > 0) {
            alien.isStunned = true;
            alien.stunTimer = 3.0;
            alien.target = null;
          }
        });
      }

      player.musouEnergy = player.maxMusouEnergy || 100;
      if (player.applyMasterHunterStalker) {
        player.applyMasterHunterStalker(22.0);
      }
      if (player.recordTrophy) {
        player.recordTrophy('Gong d\'Os & Défi de Chasse de Royce (Predators 2010)', 2500);
      }

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement('🔥 GONG DE ROYCE FRAPPÉ (PREDATORS 2010) : BRASIERS CIRCULAIRES ALLUMÉS, VISION THERMIQUE ENNEMIE AVEUGLÉE & MUSOU MAX (+2500 HONNEUR) !', 'success');
      }
      return true;
    }
    return false;
  }

  // Isabelle's Blaser R93 Tactical Sniper Stash Interaction
  checkIsabelleSniperStash(player, ui, audio) {
    if (!this.isabelleSniperStash || !player || !player.position || this.isabelleSniperStash.isClaimed) return false;
    if (player.position.y >= 7.5 && player.position.distanceTo(this.isabelleSniperStash.stashPos) <= 4.2) {
      this.isabelleSniperStash.isClaimed = true;
      if (audio && audio.playSniperRifleBoltCycle) audio.playSniperRifleBoltCycle();

      player.gaussSlugs = (player.gaussSlugs || 0) + 8;
      if (player.addScore) player.addScore(1500);

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement('🎯 CACHE DU BLASER R93 D\'ISABELLE (PREDATORS 2010) : MUNITIONS SNIPER HAUTE-VÉLOCITÉ RÉCUPÉRÉES (+8 SLUGS AP, +1500 SCORE) !', 'success');
      }
      return true;
    }
    return false;
  }

  /* === v56.0 Master Level Design Combined Update Helper === */
  updateLevelDesignV56(delta, player, horde, bosses, audio, particles, ui) {
    if (!Number.isFinite(delta) || delta <= 0 || this.game?.isPaused || this.game?.photoMode?.isActive) return;
    this.updateEnvironmentV55(delta, player, horde, audio, particles, ui);
    this.updateFixedSentries(delta, horde, audio, particles);
    this.updateAmmoniaClouds(delta, horde, particles);
    this.checkCollapsibleGrates(player ? player.position : null, horde, bosses, audio, particles);

    // Gently rotate holographic DNA strands in Charon lab
    if (this.charonGeneticsLab && this.charonGeneticsLab.dnaHolo) {
      this.charonGeneticsLab.dnaHolo.rotation.y += delta * 0.8;
      if (this.charonGeneticsLab.vats) {
        this.charonGeneticsLab.vats.forEach(v => {
          if (v.embryo) {
            v.embryo.position.y = 2.8 + Math.sin((this.referenceTime * 1000) * 0.003 + v.pos.x) * 0.15;
          }
        });
      }
    }

    // Gently rotate crashed scout ship telemetry sphere
    if (this.crashedScoutShip && this.crashedScoutShip.holoMesh) {
      this.crashedScoutShip.holoMesh.rotation.y += delta * 1.2;
    }

    // Val Verde radio cooldown update
    if (this.valVerdeProps && this.valVerdeProps.radioCooldown > 0) {
      this.valVerdeProps.radioCooldown -= delta;
    }

    // LA Rooftops active water deluge update
    if (this.activeWaterDeluge) {
      this.activeWaterDeluge.timer -= delta;
      if (this.activeWaterDeluge.timer <= 0) {
        this.removeReferenceObject(this.activeWaterDeluge.mesh);
        this.activeWaterDeluge = null;
      }
    }

    // Pyramid sacrificial altar cooldown and scythe traps check
    if (this.pyramidSacrificial && this.pyramidSacrificial.altarCooldown > 0) {
      this.pyramidSacrificial.altarCooldown -= delta;
    }
    if (this.scytheTraps) {
      this.scytheTraps.forEach(t => {
        if (t.cooldown > 0) t.cooldown -= delta;
      });
      this.checkPyramidScytheTraps(player ? player.position : null, horde, audio, particles);
    }

    // Romulus station zero-G centrifuge rotation and timer update
    if (this.romulusStationExpansion) {
      if (this.romulusStationExpansion.centrifugeRotor) {
        this.romulusStationExpansion.centrifugeRotor.rotation.y += delta * 3.5;
      }
      if (this.romulusStationExpansion.zeroGCooldown > 0) {
        this.romulusStationExpansion.zeroGCooldown -= delta;
      }
      if (this.romulusStationExpansion.rookCooldown > 0) {
        this.romulusStationExpansion.rookCooldown -= delta;
      }
    }
    if (this.zeroGActiveTimer > 0) {
      this.zeroGActiveTimer -= delta;
    }

    // Hive world harvestable royal jelly nodes light pulse
    if (this.harvestableRoyalJelly) {
      this.harvestableRoyalJelly.forEach(node => {
        if (!node.isHarvested && node.light) {
          node.light.intensity = 1.0 + Math.sin((this.referenceTime * 1000) * 0.004 + node.id) * 0.4;
        }
      });
    }

    // v57.0 Active power arcs update (Gunnison)
    if (this.activePowerArcs && this.activePowerArcs.length > 0) {
      for (let a = this.activePowerArcs.length - 1; a >= 0; a--) {
        const arc = this.activePowerArcs[a];
        arc.timer -= delta;
        if (arc.light) arc.light.intensity = 2.0 + this.random() * 2.5;
        if (arc.timer <= 0) {
          if (arc.mesh) this.removeReferenceObject(arc.mesh);
          if (arc.light) this.removeReferenceObject(arc.light);
          this.activePowerArcs.splice(a, 1);
        }
      }
    }

    // v57.0 Neural inhibitors cooldown & coil rotation (Charon)
    if (this.neuralInhibitors && this.neuralInhibitors.length > 0) {
      this.neuralInhibitors.forEach(p => {
        if (p.cooldown > 0) p.cooldown -= delta;
        if (p.rings) {
          p.rings.forEach((r, i) => {
            r.rotation.z += delta * (i % 2 === 0 ? 2.5 : -2.5);
          });
        }
      });
    }

    // v57.0 Dutch Log Trap pendulum animation (Val Verde)
    if (this.dutchLogTrap && this.dutchLogTrap.isTriggered && this.dutchLogTrap.swingAngle < Math.PI / 2) {
      this.dutchLogTrap.swingAngle += delta * 4.2;
      this.dutchLogTrap.logMesh.rotation.x = Math.sin(this.dutchLogTrap.swingAngle) * 0.95;
    }

    // v57.0 HVAC Chillers fan animation (LA Rooftops)
    if (this.hvacChillers && this.hvacChillers.length > 0) {
      this.hvacChillers.forEach(h => {
        if (!h.isRuptured && h.fan) {
          h.fan.rotation.y += delta * 14.0;
        }
      });
    }

    // v57.0 Active Freon Coolant Clouds update
    if (this.activeFreonClouds && this.activeFreonClouds.length > 0) {
      for (let f = this.activeFreonClouds.length - 1; f >= 0; f--) {
        const cloud = this.activeFreonClouds[f];
        cloud.timer -= delta;
        cloud.mesh.scale.multiplyScalar(1.0 + delta * 0.04);
        if (cloud.timer <= 0) {
          if (cloud.mesh) this.removeReferenceObject(cloud.mesh);
          this.activeFreonClouds.splice(f, 1);
        }
      }
    }

    // v58.0 Master 1:1 Val Verde Predator 1 (1987) Dynamic Systems
    if (this.dutchBonfireCamp && this.dutchBonfireCamp.light) {
      this.dutchBonfireCamp.light.intensity = 2.0 + this.random() * 0.9;
    }
    if (this.oldPainlessClearing && this.oldPainlessClearing.cooldown > 0) {
      this.oldPainlessClearing.cooldown -= delta;
    }
    if (this.punjiStakeTraps && this.punjiStakeTraps.length > 0) {
      this.checkPunjiPitTrapTrigger(horde, audio, particles, ui);
    }
    if (this.activeValVerdeFireZones && this.activeValVerdeFireZones.length > 0) {
      for (let f = this.activeValVerdeFireZones.length - 1; f >= 0; f--) {
        const fire = this.activeValVerdeFireZones[f];
        fire.timer -= delta;
        if (fire.light) fire.light.intensity = 2.5 + this.random() * 2.0;
        if (fire.timer <= 0) {
          if (fire.mesh) this.removeReferenceObject(fire.mesh);
          if (fire.light) this.removeReferenceObject(fire.light);
          this.activeValVerdeFireZones.splice(f, 1);
        }
      }
    }

    // v59.0 Master 1:1 Val Verde Predator 1 (1987) Dynamic Systems
    if (this.dutchChallengeRock && this.dutchChallengeRock.cooldown > 0) {
      this.dutchChallengeRock.cooldown -= delta;
    }
    if (this.activeIlluminationFlare) {
      const flare = this.activeIlluminationFlare;
      flare.timer -= delta;
      if (flare.light) {
        flare.light.intensity = 4.0 + this.random() * 1.5;
        flare.light.position.y = Math.max(2.5, flare.light.position.y - delta * 0.45);
        if (flare.mesh) flare.mesh.position.copy(flare.light.position);
      }
      if (flare.timer <= 0) {
        if (flare.light) this.removeReferenceObject(flare.light);
        if (flare.mesh) this.removeReferenceObject(flare.mesh);
        this.activeIlluminationFlare = null;
      }
    }
    if (this.macPerimeterTripwire && !this.macPerimeterTripwire.isTriggered && horde && horde.aliens) {
      for (let a = 0; a < horde.aliens.length; a++) {
        const alien = horde.aliens[a];
        if (alien && alien.mesh && alien.hp > 0 && alien.mesh.position.distanceTo(this.macPerimeterTripwire.pos) <= 2.2) {
          this.checkFlareTripwireTrigger(this.macPerimeterTripwire.pos, audio, horde, bosses, particles, ui);
          break;
        }
      }
    }
    if (player && player.position) {
      this.checkRiverWaterWading(player.position, player, audio, delta);
    }

    // v60.0 Master 1:1 Predator 2 (1990) LA Rooftops Systems
    if (this.easternColumbiaSpire) {
      if (this.easternColumbiaSpire.cooldown > 0) {
        this.easternColumbiaSpire.cooldown -= delta;
      }
      if (this.easternColumbiaSpire.light) {
        this.easternColumbiaSpire.light.intensity = 1.8 + this.random() * 1.6;
      }
    }
    if (this.meatLockerFacility && this.meatLockerFacility.cooldown > 0) {
      this.meatLockerFacility.cooldown -= delta;
    }
    if (this.activeMeatLockerCryo) {
      const cryo = this.activeMeatLockerCryo;
      cryo.timer -= delta;
      if (cryo.mesh) {
        cryo.mesh.scale.multiplyScalar(1.0 + delta * 0.08);
      }
      if (cryo.timer <= 0) {
        if (cryo.mesh) this.removeReferenceObject(cryo.mesh);
        this.activeMeatLockerCryo = null;
      }
    }
    if (this.harriganCruiser && this.harriganCruiser.lightBlue && this.harriganCruiser.lightRed) {
      this.harriganCruiser.lightTimer += delta * 6.0;
      const strobe = Math.sin(this.harriganCruiser.lightTimer) > 0;
      this.harriganCruiser.lightBlue.intensity = strobe ? 3.0 : 0.2;
      this.harriganCruiser.lightRed.intensity = strobe ? 0.2 : 3.0;
    }
    if (this.smartDiscGirder && !this.smartDiscGirder.isRetrieved && this.smartDiscGirder.discMesh) {
      this.smartDiscGirder.discMesh.rotation.z += delta * 8.0;
    }
    if (this.subwayCar666 && this.subwayCar666.light) {
      this.subwayCar666.strobeTimer += delta;
      if (this.random() > 0.65) {
        this.subwayCar666.light.intensity = this.random() > 0.5 ? 3.5 : 0.0;
      }
    }
    if (this.owlfCommandVan && this.owlfCommandVan.radarDish) {
      this.owlfCommandVan.radarDish.rotation.y += delta * 3.0;
    }
    if (this.activeTarPuddles && this.activeTarPuddles.length > 0) {
      for (let t = this.activeTarPuddles.length - 1; t >= 0; t--) {
        const p = this.activeTarPuddles[t];
        p.timer -= delta;
        if (horde && horde.aliens) {
          horde.aliens.forEach(alien => {
            if (alien && alien.mesh && alien.hp > 0 && alien.mesh.position.distanceTo(p.pos) <= 10.0) {
              alien.hp -= delta * 110;
              alien.speedMult = 0.2;
            }
          });
        }
        if (p.timer <= 0) {
          if (p.mesh) this.removeReferenceObject(p.mesh);
          this.activeTarPuddles.splice(t, 1);
        }
      }
    }

    // v61.0 Master 1:1 Predators (2010) Game Preserve Systems
    if (this.nolandHideout && this.nolandHideout.fanMesh) {
      this.nolandHideout.fanMesh.rotation.z += delta * 6.0;
    }
    if (this.alienFloraPatch && this.alienFloraPatch.cooldown > 0) {
      this.alienFloraPatch.cooldown -= delta;
      if (this.alienFloraPatch.light) {
        this.alienFloraPatch.light.intensity = 1.5 + Math.sin((this.referenceTime * 1000) * 0.005) * 0.7;
      }
    }
    if (this.activePreserveSmokeScreen) {
      const smoke = this.activePreserveSmokeScreen;
      smoke.timer -= delta;
      if (smoke.mesh) {
        smoke.mesh.scale.multiplyScalar(1.0 + delta * 0.04);
        if (smoke.mesh.material) {
          smoke.mesh.material.opacity = Math.max(0.05, (smoke.timer / 18.0) * 0.6);
        }
      }
      if (horde && horde.aliens && player && player.position) {
        if (player.position.distanceTo(smoke.pos) <= 24.0) {
          horde.aliens.forEach(alien => {
            if (alien && alien.mesh && alien.hp > 0 && alien.mesh.position.distanceTo(smoke.pos) <= 26.0) {
              alien.target = null; // Suppress tracking while inside smoke screen
            }
          });
        }
      }
      if (smoke.timer <= 0) {
        if (smoke.mesh) this.removeReferenceObject(smoke.mesh);
        this.activePreserveSmokeScreen = null;
      }
    }
    if (this.royceTripwireTrap && !this.royceTripwireTrap.isTripped && horde && horde.aliens) {
      for (let a = 0; a < horde.aliens.length; a++) {
        const alien = horde.aliens[a];
        if (alien && alien.mesh && alien.hp > 0 && alien.mesh.position.distanceTo(this.royceTripwireTrap.pos) <= 2.4) {
          this.checkRoyceTripwireTrigger(this.royceTripwireTrap.pos, audio, horde, bosses, particles, ui);
          break;
        }
      }
    }
    if (this.activePreserveFireZones && this.activePreserveFireZones.length > 0) {
      for (let f = this.activePreserveFireZones.length - 1; f >= 0; f--) {
        const fire = this.activePreserveFireZones[f];
        fire.timer -= delta;
        if (fire.light) fire.light.intensity = 2.4 + this.random() * 1.8;
        if (horde && horde.aliens) {
          horde.aliens.forEach(alien => {
            if (alien && alien.mesh && alien.hp > 0 && alien.mesh.position.distanceTo(fire.pos) <= 6.5) {
              alien.hp -= delta * 120;
            }
          });
        }
        if (fire.timer <= 0) {
          if (fire.mesh) this.removeReferenceObject(fire.mesh);
          if (fire.light) this.removeReferenceObject(fire.light);
          this.activePreserveFireZones.splice(f, 1);
        }
      }
    }
    if (this.celestialVistaMonolith && this.celestialVistaMonolith.light) {
      this.celestialVistaMonolith.light.intensity = 1.8 + Math.sin((this.referenceTime * 1000) * 0.003) * 0.8;
    }
    if (this.celestialVistaMonolith && this.celestialVistaMonolith.skyGroup) {
      this.celestialVistaMonolith.skyGroup.rotation.y += delta * 0.02;
    }

    // v62.0 Real-time Loops (Falconer Drone Roost, Cuchillo Decoy, Mombassa Trap & Bone Gong)
    if (this.falconerDronePerch && this.falconerDronePerch.holoRing) {
      this.falconerDronePerch.holoRing.rotation.z += delta * 1.5;
    }
    if (this.cuchilloAcousticDecoy && !this.cuchilloAcousticDecoy.isDisarmed && !this.cuchilloAcousticDecoy.isDetonated) {
      this.cuchilloAcousticDecoy.pulseTimer += delta * 4.0;
      if (this.cuchilloAcousticDecoy.light) {
        this.cuchilloAcousticDecoy.light.intensity = 1.0 + Math.sin(this.cuchilloAcousticDecoy.pulseTimer) * 0.8;
      }
      if (horde && horde.aliens) {
        for (let a = 0; a < horde.aliens.length; a++) {
          const alien = horde.aliens[a];
          if (alien && alien.mesh && alien.hp > 0 && alien.mesh.position.distanceTo(this.cuchilloAcousticDecoy.decoyPos) <= 2.2) {
            this.triggerCuchilloDecoyBlast(audio, horde, bosses, particles, ui);
            break;
          }
        }
      }
    }
    if (this.mombassaPunjiTrap && !this.mombassaPunjiTrap.isSprung && horde && horde.aliens) {
      for (let a = 0; a < horde.aliens.length; a++) {
        const alien = horde.aliens[a];
        if (alien && alien.mesh && alien.hp > 0 && alien.mesh.position.distanceTo(this.mombassaPunjiTrap.pos) <= 2.2) {
          this.checkMombassaPunjiTrapTrigger(this.mombassaPunjiTrap.pos, audio, horde, bosses, particles, ui);
          break;
        }
      }
    }
    if (this.royceBoneGong && this.royceBoneGong.blindTimer > 0) {
      this.royceBoneGong.blindTimer -= delta;
      if (this.royceBoneGong.braziers) {
        this.royceBoneGong.braziers.forEach(b => {
          if (b.fireLight) b.fireLight.intensity = 2.4 + this.random() * 1.2;
          if (b.fireMesh) b.fireMesh.scale.setScalar(1.0 + Math.sin((this.referenceTime * 1000) * 0.01) * 0.2);
        });
      }
      if (this.royceBoneGong.blindTimer <= 0) {
        if (this.royceBoneGong.braziers) {
          this.royceBoneGong.braziers.forEach(b => {
            if (b.fireMesh) b.fireMesh.material.opacity = 0.0;
            if (b.fireLight) b.fireLight.intensity = 0.0;
          });
        }
      }
    }

    // v63.0 The Predator (2018) Stargazer Real-Time Loops
    if (this.stargazerVivisection && this.stargazerVivisection.hologram) {
      this.stargazerVivisection.hologram.rotation.y += delta * 1.2;
    }
    if (this.crashedArkStarship && this.crashedArkStarship.shieldRing) {
      this.crashedArkStarship.shieldRing.rotation.z += delta * 2.0;
      if (this.crashedArkStarship.light) {
        this.crashedArkStarship.light.intensity = 2.0 + Math.sin((this.referenceTime * 1000) * 0.008) * 1.0;
      }
    }
    if (this.predatorKillerPod && !this.predatorKillerPod.isClaimed && this.predatorKillerPod.light) {
      this.predatorKillerPod.light.intensity = 1.4 + Math.sin((this.referenceTime * 1000) * 0.006) * 0.6;
    }
    if (this.roryTranslatorDesk) {
      if (this.roryTranslatorDesk.ring1) this.roryTranslatorDesk.ring1.rotation.y += delta * 1.6;
      if (this.roryTranslatorDesk.ring2) this.roryTranslatorDesk.ring2.rotation.x += delta * 1.3;
      if (this.roryTranslatorDesk.light) {
        this.roryTranslatorDesk.light.intensity = 1.5 + Math.sin((this.referenceTime * 1000) * 0.007) * 0.6;
      }
    }
    if (this.crashedArkTurbine && this.crashedArkTurbine.rotor && !this.crashedArkTurbine.isDetonated) {
      this.crashedArkTurbine.rotor.rotation.z += delta * 7.5;
    }
    if (this.stargazerEnergyDome && this.stargazerEnergyDome.material && this.stargazerEnergyDome.userData.arenaConfinement !== false) {
      this.stargazerEnergyDome.material.opacity = 0.16 + Math.sin((this.referenceTime * 1000) * 0.003) * 0.08;
      if (player && player.position) {
        const flatDist = Math.sqrt(player.position.x * player.position.x + player.position.z * player.position.z);
        if (flatDist >= 41.5) {
          const ratio = 41.3 / flatDist;
          player.position.x *= ratio;
          player.position.z *= ratio;
          if (audio && audio.playForcefieldDeflectionCrackle && (!this._lastDomeSound || (this.referenceTime * 1000) - this._lastDomeSound > 1000)) {
            this._lastDomeSound = (this.referenceTime * 1000);
            audio.playForcefieldDeflectionCrackle();
            if (particles && particles.emitSparks) {
              particles.emitSparks(player.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 18);
            }
            if (ui && ui.showAnnouncement) {
              ui.showAnnouncement('⚡ DÔME DE CONFINEMENT STARGAZER : FRONTIÈRE DU CHAMP DE FORCE INFRANCHISSABLE !', 'warning');
            }
          }
        }
      }
      if (horde && horde.aliens) {
        horde.aliens.forEach(alien => {
          if (alien && alien.mesh && alien.hp > 0) {
            const aDist = Math.sqrt(alien.mesh.position.x * alien.mesh.position.x + alien.mesh.position.z * alien.mesh.position.z);
            if (aDist >= 41.5) {
              const aRatio = 41.2 / aDist;
              alien.mesh.position.x *= aRatio;
              alien.mesh.position.z *= aRatio;
              alien.hp -= delta * 150;
              if (particles && particles.emitSparks && this.random() < 0.1) {
                particles.emitSparks(alien.mesh.position, 6);
              }
            }
          }
        });
      }
    }
    if (this.friendlyLoboHound && this.friendlyLoboHound.isTamed && player && player.position && this.friendlyLoboHound.group) {
      const targetPos = player.position.clone().add(new THREE.Vector3(-2.2, 0, 1.6));
      targetPos.y = 0.7;
      this.friendlyLoboHound.group.position.lerp(targetPos, Math.min(1.0, delta * 3.5));
      this.friendlyLoboHound.group.lookAt(player.position.x, 0.7, player.position.z);
      this.friendlyLoboHound.pos.copy(this.friendlyLoboHound.group.position);

      if (horde && horde.aliens) {
        for (let a = 0; a < horde.aliens.length; a++) {
          const alien = horde.aliens[a];
          if (alien && alien.mesh && alien.hp > 0 && alien.mesh.position.distanceTo(this.friendlyLoboHound.group.position) <= 3.8) {
            alien.hp -= delta * 110;
            if (particles && particles.emitSparks && this.random() < 0.2) {
              particles.emitSparks(alien.mesh.position, 8);
            }
          }
        }
      }
    }

    // v65.0 Prey (2022) Comanche Territory Real-Time Loops
    if (this.preyMudSinkhole && this.preyMudSinkhole.bubbles) {
      this.preyMudSinkhole.bubbles.forEach((b, idx) => {
        b.position.y = 0.2 + Math.sin((this.referenceTime * 1000) * 0.005 + idx * 1.5) * 0.12;
      });
    }
    if (this.boneMaskDecoy && this.boneMaskDecoy.lasers && this.boneMaskDecoy.isArmed) {
      this.boneMaskDecoy.armedRemaining = Math.max(0, this.boneMaskDecoy.armedRemaining - delta);
      if (!this.boneMaskDecoy.armedRemaining) { this.boneMaskDecoy.isArmed = false; this.boneMaskDecoy.lasers.forEach(beam => { beam.visible = false; }); }
      this.boneMaskDecoy.lasers.forEach(l => {
        if (l.material) {
          l.material.opacity = 0.65 + Math.sin((this.referenceTime * 1000) * 0.008) * 0.25;
        }
      });
    }
    if (this.orangeFlowerPatch && this.orangeFlowerPatch.light && !this.orangeFlowerPatch.isHarvested) {
      this.orangeFlowerPatch.light.intensity = 1.4 + Math.sin((this.referenceTime * 1000) * 0.004) * 0.5;
    }
    if (this.trapperBearTraps && this.trapperBearTraps.length > 0 && horde && horde.aliens) {
      for (let t = 0; t < this.trapperBearTraps.length; t++) {
        const trap = this.trapperBearTraps[t];
        if (!trap.isSprung) {
          for (let a = 0; a < horde.aliens.length; a++) {
            const alien = horde.aliens[a];
            if (alien && alien.mesh && alien.hp > 0 && alien.mesh.position.distanceTo(trap.pos) <= 2.2) {
              trap.isSprung = true;
              alien.hp -= 380;
              alien.isStunned = true;
              alien.stunTimer = 4.0;
              if (audio && audio.playBearTrapSnap) audio.playBearTrapSnap();
              if (particles && particles.emitSparks) particles.emitSparks(trap.pos, 16);
              if (ui && ui.showAnnouncement) {
                ui.showAnnouncement('🪤 PIÈGE À LOUPS DES TRAPPEURS FRANÇAIS DÉCLENCHÉ (380 DMG & STUN 4S) !', 'warning');
              }
              break;
            }
          }
        }
      }
    }

    // Explicit companion orders/injuries replace automatic proximity damage.
    updateSarii(this, delta, player, horde);

    // One coating per entry in an actual volume. Weak membership cannot retain
    // players across hunts, and standing inside never refreshes an expired buff.
    if (this.preyMudSinkhole) {
      const mud = this.preyMudSinkhole;
      mud.coatedPlayers ??= new WeakSet();
      for (const hunter of new Set([player, this.game?.player2].filter(Boolean))) {
        const inside = hunter.hp > 0 && hunter.position?.isVector3 &&
          Math.hypot(hunter.position.x - mud.pos.x, hunter.position.z - mud.pos.z) <= mud.radius &&
          Math.abs(hunter.position.y - mud.pos.y) <= .8;
        if (!inside) { mud.coatedPlayers.delete(hunter); continue; }
        if (mud.coatedPlayers.has(hunter) || typeof hunter.applyPreyMudCamouflage !== 'function') continue;
        mud.coatedPlayers.add(hunter);
        if (hunter.isMudCoated) continue;
        hunter.applyPreyMudCamouflage(PREY_INTERACTION_RULES.mudSeconds);
        audio?.playMudSplashWade?.();
        ui?.showAnnouncement?.('BOUE : SIGNATURE THERMIQUE ATTÉNUÉE ET DÉGÂTS ACIDES RÉDUITS DE 40 % PENDANT 30 S ; UNE APPLICATION PAR ENTRÉE. BONUS ADAPTÉS POUR LE JEU.', 'success');
      }
    }

    // Active Powder Keg Firestorm
    if (this.activePowderKegFire) {
      const fire = this.activePowderKegFire, step = Math.min(delta, Math.max(0, fire.timer));
      const origin = fire.pos.clone().add(new THREE.Vector3(0, .8, 0));
      for (const target of preyTargets(this, horde, bosses)) {
        const point = target.mesh.position.clone().add(new THREE.Vector3(0, .8, 0));
        if (target.mesh.position.distanceTo(fire.pos) <= PREY_INTERACTION_RULES.powderFireRadius &&
          preyClearShot(this, origin, point, this.trapperBaitTree?.group)) {
          preyDamage(this, target, PREY_INTERACTION_RULES.powderFireDamagePerSecond * step,
            horde, bosses, fire.ownerFaction, 'trapper_powder_fire');
        }
      }
      fire.timer = Math.max(0, fire.timer - step);
      if (fire.timer <= 1e-9) {
        if (fire.mesh) this.removeReferenceObject(fire.mesh);
        this.activePowderKegFire = null;
      }
    }

    // Concealed Brush Pitfall Stake Trap Trigger Check
    if (this.brushPitfallTrap && !this.brushPitfallTrap.isTriggered && horde && horde.aliens) {
      for (let a = 0; a < horde.aliens.length; a++) {
        const alien = horde.aliens[a];
        if (alien && alien.mesh && alien.hp > 0 && alien.mesh.position.distanceTo(this.brushPitfallTrap.pos) <= 2.6) {
          this.brushPitfallTrap.isTriggered = true;
          if (this.brushPitfallTrap.cover) this.brushPitfallTrap.cover.visible = false;
          alien.hp -= 450;
          alien.isStunned = true;
          alien.stunTimer = 3.5;
          if (audio && audio.playPitfallCollapseSnap) audio.playPitfallCollapseSnap();
          if (particles && particles.emitSparks) particles.emitSparks(this.brushPitfallTrap.pos, 20);
          if (ui && ui.showAnnouncement) {
            ui.showAnnouncement('🍂 FOSSE DE PIEUX DISSIMULÉE EFFONDRÉE (PREY 2022) : ENNEMI EMPALÉ (450 DMG & STUN 3.5S) !', 'warning');
          }
          break;
        }
      }
    }
  }

  /* === SECTOR 9: PROJET STARGAZER & FORÊT DU CRASH (THE PREDATOR 2018) === */
  buildStargazerLabProps() {
    const group = new THREE.Group();
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.85, roughness: 0.25 });
    const darkFloorMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7, metalness: 0.3 });
    const greenFluidMat = new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.75 });
    const holoMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.45 });
    const yellowStripeMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });

    // 1. Central Vivisection Operating Table [0, 0, 0]
    const tableGroup = new THREE.Group();
    tableGroup.position.set(0, 0, 0);

    const basePlatform = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.6, 0.3, 16), darkFloorMat);
    basePlatform.position.y = 0.15;
    tableGroup.add(basePlatform);

    // Hazard yellow border ring
    const hazardRing = new THREE.Mesh(new THREE.TorusGeometry(4.3, 0.08, 4, 24), yellowStripeMat);
    hazardRing.rotation.x = Math.PI / 2;
    hazardRing.position.y = 0.31;
    tableGroup.add(hazardRing);

    // Surgical Table Bed
    const tableBed = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.8, 3.8), steelMat);
    tableBed.position.y = 0.7;
    tableBed.castShadow = true;
    tableGroup.add(tableBed);

    // Luminescent Yautja green blood splatters
    const bloodPool = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.6), greenFluidMat);
    bloodPool.rotation.x = -Math.PI / 2;
    bloodPool.position.set(0, 1.11, 0);
    tableGroup.add(bloodPool);

    // Holographic vital scanner arc above table
    const holoArc = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.04, 6, 16, Math.PI), holoMat);
    holoArc.position.set(0, 2.2, 0);
    holoArc.rotation.z = Math.PI;
    tableGroup.add(holoArc);

    const tableLight = new THREE.PointLight(0x22c55e, 2.4, 8.0);
    tableLight.position.set(0, 1.8, 0);
    tableGroup.add(tableLight);

    group.add(tableGroup);
    this.stargazerVivisection = {
      group: tableGroup,
      pos: new THREE.Vector3(0, 0.7, 0),
      hologram: holoArc,
      isHarvested: false
    };

    // 2. Stargazer Cryogenic Stasis Chamber & "Predator Killer" Exosuit Capsule [-14, 0, 10]
    const podGroup = new THREE.Group();
    podGroup.position.set(-14, 0, 10);

    const podFrame = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, 3.8, 12), steelMat);
    podFrame.position.y = 1.9;
    podGroup.add(podFrame);

    const podGlass = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 2.8, 12), new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.55 }));
    podGlass.position.y = 1.9;
    podGroup.add(podGlass);

    // Nanotech gauntlet inside capsule
    const nanoGauntlet = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.4), new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.95 }));
    nanoGauntlet.position.y = 1.8;
    podGroup.add(nanoGauntlet);

    const podLight = new THREE.PointLight(0x38bdf8, 2.2, 7.0);
    podLight.position.set(0, 2.2, 0);
    podGroup.add(podLight);

    group.add(podGroup);
    this.predatorKillerPod = {
      group: podGroup,
      pos: new THREE.Vector3(-14, 1.8, 10),
      light: podLight,
      isClaimed: false
    };

    // 3. Sean Traeger's Reversed Plasma Cannon Weapons Locker [-8, 0, -12]
    const lockerGroup = new THREE.Group();
    lockerGroup.position.set(-8, 0, -12);

    const lockerBox = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.4, 0.8), steelMat);
    lockerBox.position.y = 1.2;
    lockerGroup.add(lockerBox);

    // Mounted plasma cannon rack
    const cannonMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.2, 8), new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9 }));
    cannonMesh.rotation.x = Math.PI / 2;
    cannonMesh.position.set(0, 1.4, 0.45);
    lockerGroup.add(cannonMesh);

    group.add(lockerGroup);
    this.traegerWeaponLocker = {
      group: lockerGroup,
      pos: new THREE.Vector3(-8, 1.2, -12),
      isLooted: false
    };

    // 4. High-Voltage Containment Shield Pylons [10, 0, -6]
    const pylonGroup = new THREE.Group();
    pylonGroup.position.set(10, 0, -6);

    for (let p = 0; p < 3; p++) {
      const a = (p / 3) * Math.PI * 2;
      const pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.35, 4.2, 6), steelMat);
      pylon.position.set(Math.cos(a) * 2.8, 2.1, Math.sin(a) * 2.8);
      pylonGroup.add(pylon);

      const pLight = new THREE.PointLight(0x38bdf8, 1.4, 6.0);
      pLight.position.set(Math.cos(a) * 2.8, 4.0, Math.sin(a) * 2.8);
      pylonGroup.add(pLight);
      this.stargazerShieldPylons.push({ mesh: pylon, light: pLight });
    }

    group.add(pylonGroup);
    this.addReferenceObject(group);
    this.envObjects.push(group);
  }

  buildStargazerFacilityExpansionProps() {
    const group = new THREE.Group();
    const shipHullMat = new THREE.MeshStandardMaterial({ color: 0x1f2421, metalness: 0.92, roughness: 0.22 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.85, roughness: 0.3 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x3d2012, roughness: 0.95 });
    const bloodMat = new THREE.MeshStandardMaterial({ color: 0x4a0404, roughness: 0.25 });
    const blueShieldMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.5 });

    // 5. Crashed Fugitive Ark Starship Fuselage [22, 0, -18] (+5.4m elevation)
    const shipGroup = new THREE.Group();
    shipGroup.position.set(22, 0, -18);

    // Tilted main hull (length 18m, radius 3.5m)
    const hull = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.8, 16.0, 10), shipHullMat);
    hull.rotation.set(0.35, 0.45, Math.PI / 2);
    hull.position.y = 2.7;
    hull.castShadow = true;
    hull.receiveShadow = true;
    shipGroup.add(hull);

    // Walkway platform on top of crash hull (+5.4m)
    const deck = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.4, 5.0), metalMat);
    deck.position.set(0, 5.4, 0);
    deck.receiveShadow = true;
    shipGroup.add(deck);

    // Forcefield Cloaking Deflector Ring
    const shieldRing = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.12, 6, 24), blueShieldMat);
    shieldRing.position.set(0, 5.4, 0);
    shieldRing.rotation.x = Math.PI / 2;
    shipGroup.add(shieldRing);

    const shipLight = new THREE.PointLight(0x38bdf8, 2.5, 12.0);
    shipLight.position.set(0, 6.2, 0);
    shipGroup.add(shipLight);

    group.add(shipGroup);
    this.crashedArkStarship = {
      group: shipGroup,
      pos: new THREE.Vector3(22, 5.4, -18),
      shieldRing,
      light: shipLight,
      isShieldOverloaded: false
    };

    // 6. Quinn McKenna's Rooftop Sniper Perch & TAC-50 Overlook [-20, 0, -22] (+6.8m elevation)
    const perchGroup = new THREE.Group();
    perchGroup.position.set(-20, 0, -22);

    const towerPillars = new THREE.Mesh(new THREE.BoxGeometry(5.8, 6.8, 5.8), metalMat);
    towerPillars.position.y = 3.4;
    perchGroup.add(towerPillars);

    const perchRoof = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.4, 6.4), metalMat);
    perchRoof.position.y = 6.8;
    perchRoof.receiveShadow = true;
    perchGroup.add(perchRoof);

    // Heavy McMillan TAC-50 Sniper Rifle on sandbag
    const sandbag = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 0.6), new THREE.MeshStandardMaterial({ color: 0x78716c }));
    sandbag.position.set(0, 7.2, 2.2);
    perchGroup.add(sandbag);

    const rifle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.8, 6), new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.95 }));
    rifle.rotation.x = Math.PI / 2;
    rifle.position.set(0, 7.5, 2.2);
    perchGroup.add(rifle);

    group.add(perchGroup);
    this.quinnSniperPerch = {
      group: perchGroup,
      pos: new THREE.Vector3(-20, 6.8, -22),
      isLooted: false
    };

    // 7. Genetically Engineered Predator Hounds Kennel [18, 0, 14]
    const kennelGroup = new THREE.Group();
    kennelGroup.position.set(18, 0, 14);

    // Torn open steel cage enclosure
    for (let b = 0; b < 6; b++) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.2, 6), metalMat);
      bar.position.set(-2.0 + b * 0.8, 1.6, 1.8);
      if (b === 2 || b === 3) bar.rotation.z = (this.random() - 0.5) * 0.8; // Bent bars
      kennelGroup.add(bar);
    }

    // Mutated DNA Sequencing Vial on crate
    const crate = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 1.0), new THREE.MeshStandardMaterial({ color: 0x334155 }));
    crate.position.set(0, 0.4, 0);
    kennelGroup.add(crate);

    const vialLight = new THREE.PointLight(0xa855f7, 1.8, 6.0);
    vialLight.position.set(0, 1.2, 0);
    kennelGroup.add(vialLight);

    group.add(kennelGroup);
    this.houndKennelStargazer = {
      group: kennelGroup,
      pos: new THREE.Vector3(18, 0.8, 14),
      isCollected: false
    };

    // 8. Overturned "Loonies" Military Transport Bus [-24, 0, 4] (+3.2m elevation)
    const busGroup = new THREE.Group();
    busGroup.position.set(-24, 0, 4);

    const busBody = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.8, 8.5), new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.6 }));
    busBody.rotation.z = Math.PI / 2.3; // Tilted on side
    busBody.position.y = 1.6;
    busBody.castShadow = true;
    busBody.receiveShadow = true;
    busGroup.add(busBody);

    // Wheels
    [-1.6, 1.6].forEach(wz => {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.4, 12), new THREE.MeshStandardMaterial({ color: 0x09090b }));
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(1.6, 1.4, wz * 2.0);
      busGroup.add(wheel);
    });

    group.add(busGroup);
    this.looniesTransportBus = {
      group: busGroup,
      pos: new THREE.Vector3(-24, 3.2, 4),
      isClaimed: false
    };

    // 9. Giant Shattered Oak Tracking Arena Overlook [0, 0, 26] (+4.5m elevation)
    const oakGroup = new THREE.Group();
    oakGroup.position.set(0, 0, 26);

    const oakTrunk = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.2, 5.0, 10), woodMat);
    oakTrunk.position.y = 2.5;
    oakTrunk.castShadow = true;
    oakTrunk.receiveShadow = true;
    oakGroup.add(oakTrunk);

    // Shattered jagged stump top (+4.5m)
    const shatteredTop = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.4, 4.2), woodMat);
    shatteredTop.position.y = 4.5;
    shatteredTop.receiveShadow = true;
    oakGroup.add(shatteredTop);

    // Huge fallen fractured bough forming a ramp
    const rampBough = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.1, 7.5, 8), woodMat);
    rampBough.rotation.x = Math.atan2(4.5, 6.0);
    rampBough.position.set(0, 2.25, -3.2);
    rampBough.castShadow = true;
    oakGroup.add(rampBough);

    group.add(oakGroup);
    this.shatteredOakArena = {
      group: oakGroup,
      pos: new THREE.Vector3(0, 4.5, 26)
    };

    // 10. Fugitive Predator's Gauntlet & Mask Storage Drop [-6, 0, 16]
    const dropGroup = new THREE.Group();
    dropGroup.position.set(-6, 0, 16);

    const parcelBox = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 0.9), new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.8 }));
    parcelBox.position.y = 0.35;
    dropGroup.add(parcelBox);

    const fugitiveGauntlet = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.3, 0.8), new THREE.MeshStandardMaterial({ color: 0x1f2421, metalness: 0.95 }));
    fugitiveGauntlet.position.set(0, 0.8, 0);
    dropGroup.add(fugitiveGauntlet);

    const lockerLight = new THREE.PointLight(0xef4444, 1.8, 6.0);
    lockerLight.position.set(0, 1.2, 0);
    dropGroup.add(lockerLight);

    group.add(dropGroup);
    this.fugitiveGauntletLocker = {
      group: dropGroup,
      pos: new THREE.Vector3(-6, 0.8, 16),
      isClaimed: false
    };

    // 11. "Lobo" Friendly Head-Scarred Predator Hound [14, 0, 8]
    const loboGroup = new THREE.Group();
    loboGroup.position.set(14, 0, 8);

    const houndBody = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 2.2), new THREE.MeshStandardMaterial({ color: 0x3d4336, roughness: 0.7 }));
    houndBody.position.y = 0.7;
    loboGroup.add(houndBody);

    const houndHead = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 0.9), new THREE.MeshStandardMaterial({ color: 0x2b3024, roughness: 0.7 }));
    houndHead.position.set(0, 1.1, 1.1);
    loboGroup.add(houndHead);

    const scarBandage = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.18, 0.6), new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.9 }));
    scarBandage.position.set(0, 1.35, 1.0);
    loboGroup.add(scarBandage);

    const loboLight = new THREE.PointLight(0x22c55e, 1.8, 7.0);
    loboLight.position.set(0, 1.4, 0);
    loboGroup.add(loboLight);

    group.add(loboGroup);
    this.friendlyLoboHound = {
      group: loboGroup,
      pos: new THREE.Vector3(14, 0.7, 8),
      isTamed: false
    };

    // 12. Baxley & Coyle's Tourette's / Sniper Defilade Bunker [6, 0, -22] (+2.2m)
    const bunkerGroup = new THREE.Group();
    bunkerGroup.position.set(6, 0, -22);

    const sandbagPlatform = new THREE.Mesh(new THREE.BoxGeometry(5.2, 2.2, 4.5), new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.9 }));
    sandbagPlatform.position.y = 1.1;
    sandbagPlatform.receiveShadow = true;
    bunkerGroup.add(sandbagPlatform);

    const sawGun = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.4, 6), new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9 }));
    sawGun.rotation.x = Math.PI / 2;
    sawGun.position.set(0, 2.5, 1.6);
    bunkerGroup.add(sawGun);

    group.add(bunkerGroup);
    this.baxleyCoyleBunker = {
      group: bunkerGroup,
      pos: new THREE.Vector3(6, 2.2, -22),
      isLooted: false
    };

    // 13. Stargazer Pressurized Liquid Nitrogen Cryo-Tanks [-18, 0, -8]
    this.cryoNitrogenTanks = [];
    const tankCoords = [
      new THREE.Vector3(-18, 1.5, -8),
      new THREE.Vector3(-16.5, 1.5, -8),
      new THREE.Vector3(-18, 1.5, -6.5)
    ];
    tankCoords.forEach((tPos, idx) => {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 2.8, 12), new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.2 }));
      tank.position.copy(tPos);
      tank.castShadow = true;
      group.add(tank);
      this.cryoNitrogenTanks.push({ id: idx, pos: tPos.clone(), isRuptured: false, mesh: tank });
    });

    // 14. Nebraska Williams' Steel Harpoon Tow Cable Winch Rig [4, 0, 18]
    const harpoonGroup = new THREE.Group();
    harpoonGroup.position.set(4, 0, 18);

    const winchBase = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 1.8), new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8 }));
    winchBase.position.y = 0.6;
    harpoonGroup.add(winchBase);

    const cableSpool = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.9, 12), new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.95 }));
    cableSpool.rotation.z = Math.PI / 2;
    cableSpool.position.set(0, 1.2, 0);
    harpoonGroup.add(cableSpool);

    const harpoonPike = new THREE.Mesh(new THREE.ConeGeometry(0.12, 1.4, 6), new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.95 }));
    harpoonPike.rotation.x = -Math.PI / 2.8;
    harpoonPike.position.set(0, 1.6, 0.7);
    harpoonGroup.add(harpoonPike);

    group.add(harpoonGroup);
    this.nebraskaHarpoonRig = {
      group: harpoonGroup,
      pos: new THREE.Vector3(4, 1.2, 18),
      isFired: false
    };

    // 15. Stargazer Autumn Canopy Bough Aerial Highways (+6.8m elevation)
    const autumnCanopyMat = new THREE.MeshStandardMaterial({ color: 0x452311, roughness: 0.9 });
    this.stargazerCanopyHighways = [
      { minX: -24, maxX: -4, minZ: -26, maxZ: -10 },
      { minX: 4, maxX: 24, minZ: -26, maxZ: -10 },
      { minX: -24, maxX: -4, minZ: 4, maxZ: 26 },
      { minX: 4, maxX: 24, minZ: 4, maxZ: 26 }
    ];

    const bb1 = new THREE.Mesh(new THREE.BoxGeometry(20.0, 0.35, 2.2), autumnCanopyMat);
    bb1.position.set(-10, 6.8, -20);
    bb1.receiveShadow = true;
    group.add(bb1);

    const bb2 = new THREE.Mesh(new THREE.BoxGeometry(22.0, 0.35, 2.2), autumnCanopyMat);
    bb2.position.set(9, 6.8, -12.5);
    bb2.rotation.y = Math.atan2(15, 18);
    bb2.receiveShadow = true;
    group.add(bb2);

    const bb3 = new THREE.Mesh(new THREE.BoxGeometry(22.0, 0.35, 2.2), autumnCanopyMat);
    bb3.position.set(-9, 6.8, 15);
    bb3.rotation.y = Math.atan2(-10, -18);
    bb3.receiveShadow = true;
    group.add(bb3);

    // 16. Hemispherical Stargazer Perimeter Energy Forcefield Dome [0, 0, 0] (Radius 42m)
    const domeGeo = new THREE.SphereGeometry(42.0, 36, 18, 0, Math.PI * 2, 0, Math.PI * 0.5);
    const domeMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      wireframe: true,
      transparent: true,
      opacity: 0.16
    });
    const energyDome = new THREE.Mesh(domeGeo, domeMat);
    energyDome.position.set(0, 0, 0);
    // The former radius42 arena boundary would teleport every distant front
    // back into the insertion room. Connected maps keep their physical sector
    // boundaries; this unsupported global enclosure is not drawn there.
    energyDome.userData.arenaConfinement = !this.battlefieldLayout;
    energyDome.visible = !this.battlefieldLayout;
    this.addReferenceObject(energyDome);
    this.stargazerEnergyDome = energyDome;
    this.envObjects.push(energyDome);

    // 17. Rory McKenna's Decoded Star Map & Predator Mask Station [-12, 0, 7]
    const roryGroup = new THREE.Group();
    roryGroup.position.set(-12, 0, 7);

    const deskMesh = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.9, 1.2), metalMat);
    deskMesh.position.y = 0.45;
    roryGroup.add(deskMesh);

    const maskMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.5, 8), new THREE.MeshStandardMaterial({ color: 0xa16207, roughness: 0.8 }));
    maskMesh.rotation.x = Math.PI / 4;
    maskMesh.position.set(-0.4, 1.05, 0.1);
    roryGroup.add(maskMesh);

    const holoGreenMat = new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.65, wireframe: true });
    const holoRing1 = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.03, 6, 24), holoGreenMat);
    holoRing1.position.set(0.3, 1.6, 0);
    holoRing1.rotation.x = Math.PI / 3;
    roryGroup.add(holoRing1);

    const holoRing2 = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.025, 6, 18), new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.75, wireframe: true }));
    holoRing2.position.set(0.3, 1.6, 0);
    holoRing2.rotation.y = Math.PI / 4;
    roryGroup.add(holoRing2);

    const roryLight = new THREE.PointLight(0x10b981, 1.8, 6.0);
    roryLight.position.set(0.3, 1.6, 0);
    roryGroup.add(roryLight);

    group.add(roryGroup);
    this.roryTranslatorDesk = {
      group: roryGroup,
      pos: new THREE.Vector3(-12, 0.9, 7),
      ring1: holoRing1,
      ring2: holoRing2,
      light: roryLight,
      isDecoded: false
    };

    // 18. Crashed Ark Ship Main Plasma Turbine Core [24, 0, -16] (+5.4m elevation)
    const turbineGroup = new THREE.Group();
    turbineGroup.position.set(24, 5.4, -16);

    const turbineCowl = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, 2.2, 16), shipHullMat);
    turbineCowl.rotation.x = Math.PI / 2;
    turbineGroup.add(turbineCowl);

    const rotorGroup = new THREE.Group();
    for (let b = 0; b < 6; b++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.3, 0.04), metalMat);
      blade.rotation.z = (b / 6) * Math.PI * 2;
      rotorGroup.add(blade);
    }
    rotorGroup.position.set(0, 0, 0.9);
    turbineGroup.add(rotorGroup);

    const coreLight = new THREE.PointLight(0x38bdf8, 2.6, 8.0);
    turbineGroup.add(coreLight);

    group.add(turbineGroup);
    this.crashedArkTurbine = {
      group: turbineGroup,
      pos: new THREE.Vector3(24, 5.4, -16),
      rotor: rotorGroup,
      light: coreLight,
      isDetonated: false
    };

    // 19. Dr. Casey Bracket's Biogenetic Decontamination Airlock Station [-6, 0, -6]
    const deconGroup = new THREE.Group();
    deconGroup.position.set(-6, 0, -6);

    const deconFrame = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.6, 3.4, 12), metalMat);
    deconFrame.position.y = 1.7;
    deconGroup.add(deconFrame);

    const deconGlass = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 2.6, 12), new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.45 }));
    deconGlass.position.y = 1.7;
    deconGroup.add(deconGlass);

    const deconLight = new THREE.PointLight(0x10b981, 2.0, 7.0);
    deconLight.position.set(0, 2.0, 0);
    deconGroup.add(deconLight);

    group.add(deconGroup);
    this.caseyDeconStation = {
      group: deconGroup,
      pos: new THREE.Vector3(-6, 1.7, -6),
      light: deconLight,
      isUsed: false
    };

    this.addReferenceObject(group);
    this.envObjects.push(group);
  }

  // Stargazer Interaction: Central Vivisection Table
  checkStargazerVivisectionInteraction(player, ui, audio) {
    if (!this.stargazerVivisection || !player || !player.position || this.stargazerVivisection.isHarvested) return false;
    if (player.position.distanceTo(this.stargazerVivisection.pos) <= 4.2) {
      this.stargazerVivisection.isHarvested = true;
      if (audio && audio.playAlienFloraNeurotoxinHiss) audio.playAlienFloraNeurotoxinHiss();

      player.plasmaEnergy = player.maxPlasmaEnergy || 100;
      if (player.applyNeurotoxinBlade) player.applyNeurotoxinBlade(35.0);
      if (player.addScore) player.addScore(2000);

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement('🧬 TABLE DE VIVISECTION DU FUGITIVE PREDATOR (THE PREDATOR 2018) : FLUIDES RÉGÉNÉRÉS (+100% PLASMA, LAMES TOXIQUES 35S, +2000 SCORE) !', 'success');
      }
      return true;
    }
    return false;
  }

  // Stargazer Interaction: Predator Killer Nanotech Exosuit Pod
  checkPredatorKillerPodInteraction(player, ui, audio) {
    if (!this.predatorKillerPod || !player || !player.position || this.predatorKillerPod.isClaimed) return false;
    if (player.position.distanceTo(this.predatorKillerPod.pos) <= 4.5) {
      this.predatorKillerPod.isClaimed = true;
      if (audio && audio.playPredatorKillerNanoSuitDeploy) audio.playPredatorKillerNanoSuitDeploy();

      if (player.applyPredatorKillerNano) player.applyPredatorKillerNano(35.0);
      player.recordTrophy('Exosquelette Nanotechnologique "Predator Killer" (The Predator 2018)', 3500);

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement('🦾 EXOSQUELETTE "PREDATOR KILLER" ACTIVÉ (THE PREDATOR 2018) : BLINDAGE NANOTECH (+100 SHIELD, +45% DÉGÂTS CRITIQUES 35S, +3500 HONNEUR) !', 'success');
      }
      return true;
    }
    return false;
  }

  // Stargazer Interaction: Quinn McKenna's Rooftop Sniper Perch
  checkQuinnSniperPerchInteraction(player, ui, audio) {
    if (!this.quinnSniperPerch || !player || !player.position || this.quinnSniperPerch.isLooted) return false;
    if (player.position.y >= 5.5 && player.position.distanceTo(this.quinnSniperPerch.pos) <= 4.5) {
      this.quinnSniperPerch.isLooted = true;
      if (audio && audio.playSniperRifleBoltCycle) audio.playSniperRifleBoltCycle();

      player.gaussSlugs = (player.gaussSlugs || 0) + 12;
      player.m77GaussAmmo = (player.m77GaussAmmo || 0) + 8;
      if (player.addScore) player.addScore(2500);

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement('🎯 NID SNIPER TAC-50 DE QUINN MCKENNA (THE PREDATOR 2018) : MUNITIONS ANTIBLINDAGE RÉCUPÉRÉES (+12 GAUSS SLUGS, +2500 SCORE) !', 'success');
      }
      return true;
    }
    return false;
  }

  // Stargazer Interaction: Sean Traeger's Reversed Plasma Cannon Weapons Locker
  checkTraegerWeaponsLockerInteraction(player, ui, audio) {
    if (!this.traegerWeaponLocker || !player || !player.position || this.traegerWeaponLocker.isLooted) return false;
    if (player.position.distanceTo(this.traegerWeaponLocker.pos) <= 4.2) {
      this.traegerWeaponLocker.isLooted = true;
      if (audio && audio.playSuperPredatorShipRemoteBeep) audio.playSuperPredatorShipRemoteBeep();

      player.plasmaEnergy = Math.min(player.maxPlasmaEnergy || 100, (player.plasmaEnergy || 0) + 60);
      player.m41aGrenadeCharges = Math.min(8, (player.m41aGrenadeCharges || 0) + 4);
      if (player.addScore) player.addScore(2000);

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement('🔋 ARSENAL DE SEAN TRAEGER (THE PREDATOR 2018) : CANONS PLASMA D\'ÉPAULE PIRATÉS (+60% PLASMA, +4 GRENADES) !', 'success');
      }
      return true;
    }
    return false;
  }

  // Stargazer Interaction: Overturned "Loonies" Transport Bus
  checkLooniesBusInteraction(player, ui, audio) {
    if (!this.looniesTransportBus || !player || !player.position || this.looniesTransportBus.isClaimed) return false;
    if (player.position.distanceTo(this.looniesTransportBus.pos) <= 4.8) {
      this.looniesTransportBus.isClaimed = true;
      if (audio && audio.playCuchilloAcousticDecoy) audio.playCuchilloAcousticDecoy();

      player.medicompCharges = Math.min(6, (player.medicompCharges || 0) + 3);
      player.seegsonBoltAmmo = Math.min(18, (player.seegsonBoltAmmo || 0) + 6);
      if (player.addScore) player.addScore(2200);

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement('🚌 BUS MILITAIRE DES "LOONIES" (THE PREDATOR 2018) : TROUSSE MÉDICALE DE CASEY BRACKET (+3 MEDICOMP, +6 BOLTS, +2200 SCORE) !', 'success');
      }
      return true;
    }
    return false;
  }

  // Stargazer Interaction: Crashed Ark Starship Forcefield Shield Generator
  checkStargazerShieldGenerator(player, ui, audio, horde) {
    if (!this.crashedArkStarship || !player || !player.position || this.crashedArkStarship.isShieldOverloaded) return false;
    if (player.position.y >= 4.5 && player.position.distanceTo(this.crashedArkStarship.pos) <= 4.8) {
      this.crashedArkStarship.isShieldOverloaded = true;
      if (audio && audio.playArkShipPlasmaShieldDeflection) audio.playArkShipPlasmaShieldDeflection();

      // Electrostatic shockwave disrupting all nearby enemies
      if (horde && horde.aliens) {
        horde.aliens.forEach(alien => {
          if (alien && alien.mesh && alien.hp > 0 && alien.mesh.position.distanceTo(this.crashedArkStarship.pos) <= 25.0) {
            alien.hp -= 450;
            alien.isStunned = true;
            alien.stunTimer = 4.0;
          }
        });
      }

      player.musouEnergy = player.maxMusouEnergy || 100;
      if (player.addScore) player.addScore(3000);

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement('⚡ CHAMP DE FORCE DU VAISSEAU ARK SURCHARGÉ (THE PREDATOR 2018) : DÉCHARGE ÉLECTROSTATIQUE 25M (450 DMG, STUN 4S, MUSOU MAX) !', 'warning');
      }
      return true;
    }
    return false;
  }

  // Stargazer Interaction: Fugitive Predator's Gauntlet & Mask Storage Locker
  checkFugitiveLockerInteraction(player, ui, audio) {
    if (!this.fugitiveGauntletLocker || !player || !player.position || this.fugitiveGauntletLocker.isClaimed) return false;
    if (player.position.distanceTo(this.fugitiveGauntletLocker.pos) <= 4.2) {
      this.fugitiveGauntletLocker.isClaimed = true;
      if (audio && audio.playSuperPredatorShipRemoteBeep) audio.playSuperPredatorShipRemoteBeep();

      if (player.applyFugitiveAutoAim) player.applyFugitiveAutoAim(30.0);
      player.plasmaEnergy = player.maxPlasmaEnergy || 100;
      if (player.addScore) player.addScore(2500);

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement('🎯 GANTELET DU FUGITIVE PREDATOR RÉCUPÉRÉ (THE PREDATOR 2018) : VISÉE AUTO VERROUILLÉE & PLASMA 100% (30S, +2500 SCORE) !', 'success');
      }
      return true;
    }
    return false;
  }

  // Stargazer Interaction: "Lobo" Friendly Head-Scarred Predator Hound
  checkFriendlyLoboInteraction(player, ui, audio) {
    if (!this.friendlyLoboHound || !player || !player.position || this.friendlyLoboHound.isTamed) return false;
    if (player.position.distanceTo(this.friendlyLoboHound.pos) <= 4.5) {
      this.friendlyLoboHound.isTamed = true;
      if (audio && audio.playFriendlyHoundBark) audio.playFriendlyHoundBark();

      if (player.applyFriendlyLobo) player.applyFriendlyLobo(35.0);
      player.m41aGrenadeCharges = Math.min(8, (player.m41aGrenadeCharges || 0) + 4);
      if (player.addScore) player.addScore(2000);

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement('🐕 MOLOSSE "LOBO" DOMESTIQUÉ (THE PREDATOR 2018) : COMBATTANT ALLIÉ DÉPLOYÉ & GRENADES RAPPORTÉES (+4 GRENADES, +2000 SCORE) !', 'success');
      }
      return true;
    }
    return false;
  }

  // Stargazer Interaction: Baxley & Coyle's Tourette's / Sniper Bunker
  checkBaxleyCoyleBunkerInteraction(player, ui, audio) {
    if (!this.baxleyCoyleBunker || !player || !player.position || this.baxleyCoyleBunker.isLooted) return false;
    if (player.position.distanceTo(this.baxleyCoyleBunker.pos) <= 4.5) {
      this.baxleyCoyleBunker.isLooted = true;
      if (audio && audio.playDillonDualMP5Firestorm) audio.playDillonDualMP5Firestorm();

      player.smartDiscCharges = Math.min(8, (player.smartDiscCharges || 0) + 6);
      player.m41aGrenadeCharges = Math.min(8, (player.m41aGrenadeCharges || 0) + 4);
      if (player.addScore) player.addScore(2000);

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement('🎖️ NID DÉFILÉ DE BAXLEY & COYLE (THE PREDATOR 2018) : MITRAILLEUSE M249 DÉPOUILLÉE (+6 SMART-DISCS, +4 GRENADES) !', 'success');
      }
      return true;
    }
    return false;
  }

  // Stargazer Interaction / Trigger: Liquid Nitrogen Cryo-Tanks Breach
  checkCryoNitrogenTankTrigger(hitPos, audio, horde, bosses, particles, ui) {
    if (!this.cryoNitrogenTanks || this.cryoNitrogenTanks.length === 0 || !hitPos) return false;
    for (let i = 0; i < this.cryoNitrogenTanks.length; i++) {
      const tank = this.cryoNitrogenTanks[i];
      if (!tank.isRuptured && hitPos.distanceTo(tank.pos) <= 3.8) {
        tank.isRuptured = true;
        if (audio && audio.playCryoNitrogenHiss) audio.playCryoNitrogenHiss();

        let frozenCount = 0;
        if (horde && horde.aliens) {
          horde.aliens.forEach(alien => {
            if (alien && alien.mesh && alien.hp > 0 && alien.mesh.position.distanceTo(tank.pos) <= 14.0) {
              alien.hp -= 280;
              alien.isStunned = true;
              alien.stunTimer = 6.0;
              frozenCount++;
              if (particles && particles.emitSparks) particles.emitSparks(alien.mesh.position, 12);
            }
          });
        }
        if (bosses && bosses.activeBoss && bosses.activeBoss.mesh && bosses.activeBoss.mesh.position.distanceTo(tank.pos) <= 14.0) {
          bosses.activeBoss.hp -= 350;
          bosses.activeBoss.isStunned = true;
          bosses.activeBoss.stunTimer = 3.5;
        }

        if (ui && ui.showAnnouncement) {
          ui.showAnnouncement(`❄️ CUVE D'AZOTE LIQUIDE STARGAZER PERCÉE (2018) : FLASH CRYOGÉNIQUE (${frozenCount} ENNEMIS CONGELÉS 6S, 280 DMG) !`, 'warning');
        }
        return true;
      }
    }
    return false;
  }

  // Stargazer Interaction: Nebraska Williams' Steel Harpoon Tow Cable Rig
  checkNebraskaHarpoonRig(player, ui, audio, horde, bosses, particles) {
    if (!this.nebraskaHarpoonRig || !player || !player.position || this.nebraskaHarpoonRig.isFired) return false;
    if (player.position.distanceTo(this.nebraskaHarpoonRig.pos) <= 4.2) {
      this.nebraskaHarpoonRig.isFired = true;
      if (audio && audio.playHarpoonWinchCableSnap) audio.playHarpoonWinchCableSnap();

      let target = null;
      if (bosses && bosses.activeBoss && bosses.activeBoss.hp > 0) {
        target = bosses.activeBoss;
        target.hp -= 700;
        target.isStunned = true;
        target.stunTimer = 4.5;
      } else if (horde && horde.aliens) {
        for (let a = 0; a < horde.aliens.length; a++) {
          const alien = horde.aliens[a];
          if (alien && alien.hp > 0) {
            target = alien;
            target.hp -= 600;
            target.isStunned = true;
            target.stunTimer = 5.0;
            break;
          }
        }
      }

      if (particles && target && target.mesh) {
        particles.emitSparks(target.mesh.position, 25);
      }
      if (player.addScore) player.addScore(2500);

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement('⚓ TREUIL À HARPON DE NEBRASKA (THE PREDATOR 2018) : CÂBLE D\'ACIER HARPONNÉ (600-700 DMG CINÉTIQUES & STUN 5S) !', 'success');
      }
      return true;
    }
    return false;
  }

  // Stargazer Interaction: Rory McKenna's Decoded Star Map & Predator Mask
  checkRoryTranslatorInteraction(player, ui, audio, bosses) {
    if (!this.roryTranslatorDesk || !player || !player.position || this.roryTranslatorDesk.isDecoded) return false;
    if (player.position.distanceTo(this.roryTranslatorDesk.pos) <= 4.2) {
      this.roryTranslatorDesk.isDecoded = true;
      if (audio && audio.playTranslatorStarMapChime) audio.playTranslatorStarMapChime();

      if (player.applyRoryStarMapTelemetry) player.applyRoryStarMapTelemetry(30.0);
      if (player.addScore) player.addScore(2500);

      if (bosses && bosses.activeBoss) {
        bosses.activeBoss.isCloaked = false;
        if (bosses.activeBoss.mesh) bosses.activeBoss.mesh.visible = true;
      }

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement('🗺️ CARTE STELLAIRE DE RORY DÉCODÉE (THE PREDATOR 2018) : TÉLÉMÉTRIE D\'HYBRIDATION RÉVÉLÉE, CRITIQUES +35% & BOSS DÉCLOQUÉ (30S, +2500 SCORE) !', 'success');
      }
      return true;
    }
    return false;
  }

  // Stargazer Interaction: Nebraska Williams' Crashed Ark Turbine Leap & Thermonuclear Plasma Detonation
  checkTurbineCoreOverload(player, ui, audio, horde, bosses, particles) {
    if (!this.crashedArkTurbine || !player || !player.position || this.crashedArkTurbine.isDetonated) return false;
    if (player.position.y >= 4.5 && player.position.distanceTo(this.crashedArkTurbine.pos) <= 4.8) {
      this.crashedArkTurbine.isDetonated = true;
      if (audio && audio.playShipTurbinePlasmaDetonation) audio.playShipTurbinePlasmaDetonation();

      let vaporizedCount = 0;
      if (horde && horde.aliens) {
        horde.aliens.forEach(alien => {
          if (alien && alien.mesh && alien.hp > 0 && alien.mesh.position.distanceTo(this.crashedArkTurbine.pos) <= 24.0) {
            alien.hp -= 900;
            vaporizedCount++;
            if (particles && particles.emitSparks) {
              particles.emitSparks(alien.mesh.position, 25);
            }
          }
        });
      }

      if (bosses && bosses.activeBoss && bosses.activeBoss.mesh) {
        if (bosses.activeBoss.mesh.position.distanceTo(this.crashedArkTurbine.pos) <= 26.0) {
          bosses.activeBoss.hp -= 900;
          bosses.activeBoss.stunTimer = 6.0;
          if (particles && particles.emitSparks) {
            particles.emitSparks(bosses.activeBoss.mesh.position, 35);
          }
        }
      }

      if (player.addScore) player.addScore(3000);

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement(`💥 TURBINE PRINCIPALE DE L'ARCHE EN SURCHARGE (THE PREDATOR 2018) : SACRIFICE DE NEBRASKA & DÉTONATION THERMONUCLÉAIRE (${vaporizedCount} ENNEMIS DÉSINTÉGRÉS, 900 DMG, +3000 SCORE) !`, 'error');
      }
      return true;
    }
    return false;
  }

  // Stargazer Interaction: Dr. Casey Bracket's Biogenetic Decontamination Station
  checkStargazerDecontamination(player, ui, audio) {
    if (!this.caseyDeconStation || !player || !player.position || this.caseyDeconStation.isUsed) return false;
    if (player.position.distanceTo(this.caseyDeconStation.pos) <= 4.2) {
      this.caseyDeconStation.isUsed = true;
      if (audio && audio.playDecontaminationSprayHiss) audio.playDecontaminationSprayHiss();

      if (player.applyCaseyDeconBuff) player.applyCaseyDeconBuff(35.0);
      else {
        player.hp = Math.min(player.maxHp || 100, (player.hp || 0) + 75);
        player.shield = Math.min(200, (player.shield || 0) + 100);
      }
      if (player.addScore) player.addScore(2000);

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement('🧪 SAS DE DÉCONTAMINATION BIOGÉNÉTIQUE (THE PREDATOR 2018) : PURGE BIOLOGIQUE TOTALE, SOINS +75 HP, BOUCLIER 100% & FLÉCHETTES TRANQUILLISANTES (3 TIRS) !', 'success');
      }
      return true;
    }
    return false;
  }

  /* === SECTOR 10: TERRITOIRE COMANCHE 1719 (PREY 2022) === */
  buildPreyComancheProps() {
    const group = new THREE.Group();
    const dirtMat = new THREE.MeshStandardMaterial({ color: 0x3d3020, roughness: 0.95 });
    const mudMat = new THREE.MeshStandardMaterial({ color: 0x241d13, roughness: 0.35, metalness: 0.1 });
    const boneMat = new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.45 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x3d2516, roughness: 0.9 });
    const orangeFlowerMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });

    // 1. Quicksand Mud Sinkhole [0, 0, 0] (Radius 5.5m)
    const mudGroup = new THREE.Group();
    mudGroup.position.set(0, 0, 0);

    const mudBasin = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 5.8, 0.4, 24), mudMat);
    mudBasin.position.y = 0.15;
    mudBasin.receiveShadow = true;
    mudGroup.add(mudBasin);

    const bubbles = [];
    [-2.2, 2.0, -1.2, 1.8].forEach((bx, idx) => {
      const bz = (idx % 2 === 0 ? -1.8 : 1.5) * (idx < 2 ? 1 : -0.8);
      const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), mudMat);
      bubble.position.set(bx, 0.2, bz);
      mudGroup.add(bubble);
      bubbles.push(bubble);
    });

    group.add(mudGroup);
    this.preyMudSinkhole = {
      group: mudGroup,
      pos: new THREE.Vector3(0, 0, 0),
      radius: 5.5,
      bubbles: bubbles
    };

    // 2. Feral Bone Mask & 3-Laser Homing Decoy Rig [4, 0.4, -12]
    const decoyGroup = new THREE.Group();
    decoyGroup.position.set(4, 0, -12);

    const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.6, 6), woodMat);
    stake.position.y = 0.8;
    decoyGroup.add(stake);

    const mask = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.65, 0.45), boneMat);
    mask.position.set(0, 1.45, 0);
    decoyGroup.add(mask);

    const laserMat = new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.8 });
    const lasers = [];
    [-0.12, 0, 0.12].forEach(lx => {
      const laserBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 12.0, 4), laserMat);
      laserBeam.rotation.x = Math.PI / 2;
      laserBeam.position.set(lx, 1.45, 6.0);
      decoyGroup.add(laserBeam);
      lasers.push(laserBeam);
    });

    const laserLight = new THREE.PointLight(0xef4444, 1.6, 6.0);
    laserLight.position.set(0, 1.5, 0);
    decoyGroup.add(laserLight);

    group.add(decoyGroup);
    this.boneMaskDecoy = {
      group: decoyGroup,
      pos: new THREE.Vector3(4, 1.4, -12),
      lasers: lasers,
      isArmed: false, armedRemaining: 0
    };
    lasers.forEach(beam => { beam.visible = false; });

    // 3. Naru's Orange Flower (Sariska) Meadow [-14, 0, -8]
    const meadowGroup = new THREE.Group();
    meadowGroup.position.set(-14, 0, -8);

    const meadowPatch = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 4.0, 0.25, 16), new THREE.MeshStandardMaterial({ color: 0x1f2e1a, roughness: 0.9 }));
    meadowPatch.position.y = 0.12;
    meadowGroup.add(meadowPatch);

    for (let f = 0; f < 10; f++) {
      const a = (f / 10) * Math.PI * 2;
      const r = 1.0 + this.random() * 2.2;
      const flower = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 5), orangeFlowerMat);
      flower.position.set(Math.cos(a) * r, 0.35, Math.sin(a) * r);
      meadowGroup.add(flower);
    }

    const flowerLight = new THREE.PointLight(0xf97316, 1.8, 7.0);
    flowerLight.position.set(0, 1.2, 0);
    meadowGroup.add(flowerLight);

    group.add(meadowGroup);
    this.orangeFlowerPatch = {
      group: meadowGroup,
      pos: new THREE.Vector3(-14, 0.5, -8),
      light: flowerLight,
      isHarvested: false
    };

    // 4. French Voyageurs Trapper Camp [18, 0, 16]
    const campGroup = new THREE.Group();
    campGroup.position.set(18, 0, 16);

    for (let p = 0; p < 4; p++) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.2, 6), woodMat);
      post.position.set(-1.6 + (p % 2) * 3.2, 1.6, -1.2 + Math.floor(p / 2) * 2.4);
      campGroup.add(post);
    }
    const canvasRoof = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.4, 4), new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.9 }));
    canvasRoof.position.set(0, 3.4, 0);
    campGroup.add(canvasRoof);

    const bisonPiles = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.2, 2.0), boneMat);
    bisonPiles.position.set(3.2, 0.6, 0);
    campGroup.add(bisonPiles);

    group.add(campGroup);
    this.trapperCampVoyageurs = {
      group: campGroup,
      pos: new THREE.Vector3(18, 0.6, 16)
    };

    // 5. Raphael Adolini 1715 Flintlock Pistol [18, 0, 17]
    const pistolGroup = new THREE.Group();
    pistolGroup.position.set(18, 0, 17);

    const logBlock = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 1.1, 10), woodMat);
    logBlock.position.y = 0.55;
    pistolGroup.add(logBlock);

    const pistolStock = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.65), woodMat);
    pistolStock.position.set(0, 1.18, 0);
    pistolStock.rotation.x = Math.PI / 6;
    pistolGroup.add(pistolStock);

    const pistolBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.55, 8), new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.9 }));
    pistolBarrel.rotation.x = Math.PI / 2;
    pistolBarrel.position.set(0, 1.28, 0.22);
    pistolGroup.add(pistolBarrel);

    const pistolLight = new THREE.PointLight(0xf59e0b, 1.6, 5.0);
    pistolLight.position.set(0, 1.5, 0);
    pistolGroup.add(pistolLight);

    group.add(pistolGroup);
    this.adoliniPistolPedestal = {
      group: pistolGroup,
      pos: new THREE.Vector3(18, 1.2, 17),
      isClaimed: false
    };

    // 6. Taabe's Comanche War Horse & Rock Overlook [-22, 0, 14] (+3.8m)
    const taabeGroup = new THREE.Group();
    taabeGroup.position.set(-22, 0, 14);

    const boulder = new THREE.Mesh(new THREE.BoxGeometry(6.4, 3.8, 5.8), dirtMat);
    boulder.position.y = 1.9;
    boulder.receiveShadow = true;
    taabeGroup.add(boulder);

    const bowShaft = new THREE.Mesh(new THREE.TorusGeometry(0.65, 0.03, 6, 16, Math.PI), woodMat);
    bowShaft.position.set(0, 4.4, 1.6);
    bowShaft.rotation.z = Math.PI;
    taabeGroup.add(bowShaft);

    group.add(taabeGroup);
    this.taabeRockPerch = {
      group: taabeGroup,
      pos: new THREE.Vector3(-22, 3.8, 14),
      isClaimed: false
    };

    this.addReferenceObject(group);
    this.envObjects.push(group);
  }

  buildPreyTerritoryExpansionProps() {
    const group = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x3d2516, roughness: 0.9 });
    const charredMat = new THREE.MeshStandardMaterial({ color: 0x0f0f10, roughness: 0.95 });
    const ironMat = new THREE.MeshStandardMaterial({ color: 0x27272a, metalness: 0.85, roughness: 0.4 });
    const furMat = new THREE.MeshStandardMaterial({ color: 0x271c14, roughness: 0.95 });
    const boneMat = new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.45 });
    const obsidianMat = new THREE.MeshStandardMaterial({ color: 0x09090b, metalness: 0.9, roughness: 0.05 });

    // 7. Giant Slain Grizzly Bear Carcass [14, 0, -8]
    const bearGroup = new THREE.Group();
    bearGroup.position.set(14, 0, -8);

    const bearBody = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.3, 3.4), furMat);
    bearBody.position.y = 0.65;
    bearBody.rotation.y = 0.35;
    bearGroup.add(bearBody);

    const bearHead = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 1.2), furMat);
    bearHead.position.set(0, 0.8, 1.8);
    bearGroup.add(bearHead);

    const greenBlood = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.2), new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.7 }));
    greenBlood.rotation.x = -Math.PI / 2;
    greenBlood.position.set(0, 0.02, 0);
    bearGroup.add(greenBlood);

    group.add(bearGroup);
    this.grizzlyBearCarcass = {
      group: bearGroup,
      pos: new THREE.Vector3(14, 0.65, -8),
      isSkinned: false
    };

    // 8. Beaver Dam Crossing Catwalk [12, 0, -5] (+2.5m)
    const damGroup = new THREE.Group();
    damGroup.position.set(12, 0, -5);

    const damBase = new THREE.Mesh(new THREE.BoxGeometry(4.8, 2.5, 7.5), woodMat);
    damBase.position.y = 1.25;
    damBase.receiveShadow = true;
    damGroup.add(damBase);

    group.add(damGroup);
    this.beaverDamCrossing = {
      group: damGroup,
      pos: new THREE.Vector3(12, 2.5, -5)
    };

    // 9. Burned Forest of Charred Pine Stumps [-18, 0, -20]
    const burnedCoords = [
      [-18, -20], [-21, -17], [-15, -23], [-22, -22], [-17, -16]
    ];
    burnedCoords.forEach(bc => {
      const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 3.2, 6), charredMat);
      stump.position.set(bc[0], 1.6, bc[1]);
      group.add(stump);
      this.burnedForestCharredTrees.push(stump);
    });

    // 10. Forged Iron Trapper Bear Traps
    this.trapperBearTraps = [];
    const trapCoords = [new THREE.Vector3(-12, 0.1, -18), new THREE.Vector3(-16, 0.1, -14)];
    trapCoords.forEach((tPos, idx) => {
      const trapMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.1, 8), ironMat);
      trapMesh.position.copy(tPos);
      group.add(trapMesh);
      this.trapperBearTraps.push({ id: idx, pos: tPos.clone(), isSprung: false, mesh: trapMesh });
    });

    // 11. Naru's Tethered Tomahawk [-8, 0, 18]
    const tomahawkGroup = new THREE.Group();
    tomahawkGroup.position.set(-8, 0, 18);

    const treeTrunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 4.0, 8), woodMat);
    treeTrunk.position.y = 2.0;
    tomahawkGroup.add(treeTrunk);

    const tomahawkBlade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 0.25), ironMat);
    tomahawkBlade.position.set(0, 1.8, 0.55);
    tomahawkGroup.add(tomahawkBlade);

    group.add(tomahawkGroup);
    this.naruTomahawkTree = {
      group: tomahawkGroup,
      pos: new THREE.Vector3(-8, 1.8, 18),
      isClaimed: false
    };

    // 12. Trapper Field Medical Tent [22, 0, 12]
    const medGroup = new THREE.Group();
    medGroup.position.set(22, 0, 12);

    const medTent = new THREE.Mesh(new THREE.ConeGeometry(2.4, 2.8, 4), new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.9 }));
    medTent.position.y = 1.4;
    medGroup.add(medTent);

    group.add(medGroup);
    this.trapperMedicalTent = {
      group: medGroup,
      pos: new THREE.Vector3(22, 1.4, 12),
      isLooted: false
    };

    // 13. Archaic Feral Weapon Rack [0, 0, 24]
    const arsenalGroup = new THREE.Group();
    arsenalGroup.position.set(0, 0, 24);

    const spearRack = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.8, 6), obsidianMat);
    spearRack.rotation.z = Math.PI / 4;
    spearRack.position.set(0, 1.4, 0);
    arsenalGroup.add(spearRack);

    const boneShieldIcon = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.08, 6), boneMat);
    boneShieldIcon.rotation.x = Math.PI / 2;
    boneShieldIcon.position.set(0, 1.2, 0.2);
    arsenalGroup.add(boneShieldIcon);

    group.add(arsenalGroup);
    this.feralArsenalStation = {
      group: arsenalGroup,
      pos: new THREE.Vector3(0, 1.2, 24),
      isClaimed: false
    };

    // 14. Sarii (Naru's Loyal Carolina Dog Companion) [-24, 0, -4]
    const sariiGroup = new THREE.Group();
    sariiGroup.position.set(-24, 0, -4);

    const dogBody = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.55, 1.3), new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.8 }));
    dogBody.position.y = 0.45;
    sariiGroup.add(dogBody);

    const dogChest = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.45, 0.5), new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.9 }));
    dogChest.position.set(0, 0.42, 0.45);
    sariiGroup.add(dogChest);

    const dogHead = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.42, 0.55), new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 }));
    dogHead.position.set(0, 0.75, 0.7);
    sariiGroup.add(dogHead);

    [-0.18, 0.18].forEach(ex => {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 4), new THREE.MeshStandardMaterial({ color: 0x451a03 }));
      ear.position.set(ex, 1.02, 0.65);
      sariiGroup.add(ear);
    });

    const sariiLight = new THREE.PointLight(0xf59e0b, 1.4, 5.0);
    sariiLight.position.set(0, 0.9, 0);
    sariiGroup.add(sariiLight);

    group.add(sariiGroup);
    this.sariiCompanion = {
      group: sariiGroup,
      pos: new THREE.Vector3(-24, 0.45, -4),
      isTamed: false
    };
    prepareSarii(this.sariiCompanion);

    // 15. French Trappers' Bait Tree & Powder Kegs [12, 0, 8]
    const baitGroup = new THREE.Group();
    baitGroup.position.set(12, 0, 8);

    const oakTree = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.85, 6.5, 8), woodMat);
    oakTree.position.y = 3.25;
    baitGroup.add(oakTree);

    const chain = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.05, 6, 16), ironMat);
    chain.position.set(0, 1.8, 0);
    baitGroup.add(chain);

    for (let k = 0; k < 3; k++) {
      const keg = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.75, 10), new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.7 }));
      keg.position.set(0.8 + (k % 2) * 0.6, 0.38, -0.6 + Math.floor(k / 2) * 0.9);
      baitGroup.add(keg);
    }

    const kegLight = new THREE.PointLight(0xef4444, 1.5, 5.0);
    kegLight.position.set(1.0, 0.8, 0);
    baitGroup.add(kegLight);

    group.add(baitGroup);
    this.trapperBaitTree = {
      group: baitGroup,
      pos: new THREE.Vector3(12, 0.6, 8),
      isDetonated: false
    };

    // 16. Mountain Lion High Pine Bough [-10, 0, -6] (+5.2m)
    const cougarGroup = new THREE.Group();
    cougarGroup.position.set(-10, 0, -6);

    const boughTrunk = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, 5.5, 8), woodMat);
    boughTrunk.position.y = 2.75;
    cougarGroup.add(boughTrunk);

    const horizontalBough = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.4, 1.8), woodMat);
    horizontalBough.position.set(0, 5.2, 0);
    horizontalBough.receiveShadow = true;
    cougarGroup.add(horizontalBough);

    group.add(cougarGroup);
    this.cougarPineBough = {
      group: cougarGroup,
      pos: new THREE.Vector3(-10, 5.2, -6),
      animalPresent: false,
      provenanceNote: 'Only a pine branch exists here; no puma model or AI is claimed.'
    };

    // 17. French Voyageurs' River Raft & Fur Trade Cache [16, 0.2, -18]
    const raftGroup = new THREE.Group();
    raftGroup.position.set(16, 0.2, -18);

    const raftBase = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.35, 5.5), woodMat);
    raftBase.position.y = 0.15;
    raftBase.receiveShadow = true;
    raftGroup.add(raftBase);

    for (let p = 0; p < 3; p++) {
      const peltBundle = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.45, 0.8), furMat);
      peltBundle.position.set(-0.9 + p * 0.9, 0.45, -0.6);
      raftGroup.add(peltBundle);
    }

    const raftLight = new THREE.PointLight(0xf59e0b, 1.5, 6.0);
    raftLight.position.set(0, 1.2, 0);
    raftGroup.add(raftLight);

    group.add(raftGroup);
    this.voyageurRiverRaft = {
      group: raftGroup,
      pos: new THREE.Vector3(16, 0.4, -18),
      isLooted: false
    };

    // 18. Comanche Sun Dance / War Paint Medicine Totem Post [-16, 0, 10]
    const totemGroup = new THREE.Group();
    totemGroup.position.set(-16, 0, 10);

    const totemPole = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 4.8, 8), woodMat);
    totemPole.position.y = 2.4;
    totemGroup.add(totemPole);

    const redBand = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.05, 4, 16), new THREE.MeshBasicMaterial({ color: 0xb91c1c }));
    redBand.position.set(0, 3.2, 0);
    redBand.rotation.x = Math.PI / 2;
    totemGroup.add(redBand);

    const whiteBand = new THREE.Mesh(new THREE.TorusGeometry(0.39, 0.05, 4, 16), new THREE.MeshBasicMaterial({ color: 0xf8fafc }));
    whiteBand.position.set(0, 2.6, 0);
    whiteBand.rotation.x = Math.PI / 2;
    totemGroup.add(whiteBand);

    const totemLight = new THREE.PointLight(0xb91c1c, 1.6, 6.0);
    totemLight.position.set(0, 3.4, 0);
    totemGroup.add(totemLight);

    group.add(totemGroup);
    this.comancheTotemPost = {
      group: totemGroup,
      pos: new THREE.Vector3(-16, 1.5, 10),
      isClaimed: false
    };

    // 19. Concealed Brush Pitfall Stake Trap [2, 0, 14]
    const pitGroup = new THREE.Group();
    pitGroup.position.set(2, 0, 14);

    const pitHole = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.2, 1.8, 12), new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.95 }));
    pitHole.position.y = -0.9;
    pitGroup.add(pitHole);

    for (let s = 0; s < 5; s++) {
      const stake = new THREE.Mesh(new THREE.ConeGeometry(0.12, 1.2, 4), woodMat);
      const sa = (s / 5) * Math.PI * 2;
      stake.position.set(Math.cos(sa) * 1.0, 0.4, Math.sin(sa) * 1.0);
      pitGroup.add(stake);
    }

    const brushCover = new THREE.Mesh(new THREE.CircleGeometry(2.4, 12), new THREE.MeshStandardMaterial({ color: 0x3d3020, roughness: 0.9 }));
    brushCover.rotation.x = -Math.PI / 2;
    brushCover.position.y = 0.05;
    pitGroup.add(brushCover);

    group.add(pitGroup);
    this.brushPitfallTrap = {
      group: pitGroup,
      pos: new THREE.Vector3(2, 0.1, 14),
      cover: brushCover,
      isTriggered: false
    };

    // 20. Lightning-Struck Split Hollow Pine [-4, 0, -22]
    const pineGroup = new THREE.Group();
    pineGroup.position.set(-4, 0, -22);

    const trunkLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.55, 5.0, 8, 1, false, 0, Math.PI), charredMat);
    trunkLeft.position.set(-0.35, 2.5, 0);
    pineGroup.add(trunkLeft);

    const trunkRight = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.55, 4.5, 8, 1, false, Math.PI * 0.8, Math.PI), charredMat);
    trunkRight.position.set(0.35, 2.25, 0);
    trunkRight.rotation.z = -0.15;
    pineGroup.add(trunkRight);

    const hollowLight = new THREE.PointLight(0x22c55e, 1.4, 4.0);
    hollowLight.position.set(0, 1.4, 0);
    pineGroup.add(hollowLight);

    group.add(pineGroup);
    this.lightningSplitPine = {
      group: pineGroup,
      pos: new THREE.Vector3(-4, 1.2, -22),
      isClaimed: false
    };

    // 21. French Trappers' Iron Spit & Campfire Cauldron [-6, 0, -14]
    const spitGroup = new THREE.Group();
    spitGroup.position.set(-6, 0, -14);

    const stoneRingMat = new THREE.MeshStandardMaterial({ color: 0x52525b, roughness: 0.95 });
    for (let s = 0; s < 8; s++) {
      const ang = (s / 8) * Math.PI * 2;
      const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 0), stoneRingMat);
      stone.position.set(Math.cos(ang) * 0.9, 0.12, Math.sin(ang) * 0.9);
      spitGroup.add(stone);
    }

    const fireLight = new THREE.PointLight(0xff5500, 2.5, 8.0);
    fireLight.position.set(0, 0.5, 0);
    spitGroup.add(fireLight);

    const fireGlow = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.1, 12), new THREE.MeshBasicMaterial({ color: 0xff3700 }));
    fireGlow.position.y = 0.06;
    spitGroup.add(fireGlow);

    // Iron Tripod & Hanging Cauldron
    const tripodLegMat = new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.9, roughness: 0.3 });
    [-0.45, 0.45].forEach(tx => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.8), tripodLegMat);
      leg.position.set(tx, 0.9, 0);
      leg.rotation.z = tx < 0 ? -0.25 : 0.25;
      spitGroup.add(leg);
    });

    const potMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.28, 0.45, 12), ironMat);
    potMesh.position.set(0, 0.85, 0);
    spitGroup.add(potMesh);

    group.add(spitGroup);
    this.trapperCampfireSpit = {
      group: spitGroup,
      pos: new THREE.Vector3(-6, 0.5, -14),
      isToppled: false
    };

    // 22. Comanche Buffalo Skull Trail Marker Cairn [-8, 0, 6]
    const cairnGroup = new THREE.Group();
    cairnGroup.position.set(-8, 0, 6);

    const cairnMat = new THREE.MeshStandardMaterial({ color: 0x71717a, roughness: 0.9 });
    const b1 = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.05, 0.35, 8), cairnMat);
    b1.position.y = 0.17;
    cairnGroup.add(b1);

    const b2 = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.82, 0.35, 7), cairnMat);
    b2.position.y = 0.52;
    cairnGroup.add(b2);

    const b3 = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.62, 0.35, 6), cairnMat);
    b3.position.y = 0.87;
    cairnGroup.add(b3);

    // Weathered Buffalo Skull & Horns
    const skullMat = new THREE.MeshStandardMaterial({ color: 0xeadfcf, roughness: 0.5 });
    const buffaloSkull = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.65, 0.45), skullMat);
    buffaloSkull.position.set(0, 1.35, 0);
    cairnGroup.add(buffaloSkull);

    [-0.38, 0.38].forEach(hx => {
      const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.1, 0.65, 6), ironMat);
      horn.position.set(hx, 1.6, 0);
      horn.rotation.z = hx < 0 ? -0.85 : 0.85;
      horn.rotation.x = -0.2;
      cairnGroup.add(horn);
    });

    const cairnLight = new THREE.PointLight(0xf59e0b, 1.4, 6.0);
    cairnLight.position.set(0, 1.5, 0);
    cairnGroup.add(cairnLight);

    group.add(cairnGroup);
    this.buffaloSkullCairn = {
      group: cairnGroup,
      pos: new THREE.Vector3(-8, 1.2, 6),
      isCommuned: false
    };

    // 23. Feral Predator's Severed Arm-Gauntlet & Obsidian Claws [6, 0.3, -4]
    const gauntletGroup = new THREE.Group();
    gauntletGroup.position.set(6, 0.3, -4);

    const rockBase = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.4, 1.4), new THREE.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.9 }));
    rockBase.position.y = -0.15;
    gauntletGroup.add(rockBase);

    const severedArmMat = new THREE.MeshStandardMaterial({ color: 0x3f352b, roughness: 0.7 });
    const armMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.85, 8), severedArmMat);
    armMesh.rotation.z = Math.PI / 2;
    armMesh.position.set(0, 0.15, 0);
    gauntletGroup.add(armMesh);

    // Yautja Luminescent Blood Splatter
    const bloodSplat = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.85 }));
    bloodSplat.rotation.x = -Math.PI / 2;
    bloodSplat.position.set(0, 0.06, 0);
    gauntletGroup.add(bloodSplat);

    // Twin Obsidian Razor Wrist Claws
    [-0.08, 0.08].forEach(cz => {
      const claw = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.03, 0.06), obsidianMat);
      claw.position.set(0.6, 0.16, cz);
      gauntletGroup.add(claw);
    });

    const gauntletLight = new THREE.PointLight(0x10b981, 1.8, 5.0);
    gauntletLight.position.set(0, 0.4, 0);
    gauntletGroup.add(gauntletLight);

    group.add(gauntletGroup);
    this.feralSeveredGauntlet = {
      group: gauntletGroup,
      pos: new THREE.Vector3(6, 0.4, -4),
      isClaimed: false
    };

    this.addReferenceObject(group);
    this.envObjects.push(group);
  }

  // Prey Interaction: Feral Bone Mask & 3-Laser Homing Decoy Rig
  serializePreyInteractions() {
    const props = Object.fromEntries(Object.entries(PREY_SAVE_PROPS).map(([name, flag]) =>
      [name, { present: !!this[name], consumed: !!(flag && this[name]?.[flag]) }]));
    const present = Object.values(props).some(prop => prop.present), profileId = this.referenceProfile?.id ?? null;
    if (present && profileId !== PREY_SOURCE_LEVEL) throw new TypeError('Prey props require their actual reference profile');
    const dog = this.sariiCompanion, players = preyPlayers(this);
    const ownerId = dog?.isTamed ? (dog.owner === players[0] && players[0] ? 'player1' : dog.owner === players[1] && players[1] ? 'player2' : null) : null;
    if (dog?.isTamed && !ownerId) throw new TypeError('A tamed Sarii requires its actual cooperative owner');
    const fire = this.activePowderKegFire;
    return { version: 1, sourceLevelId: present ? PREY_SOURCE_LEVEL : null, profileId, props,
      maskGuidance: 'cancel_on_resume',
      fire: fire ? { position: fire.pos.toArray(), remaining: Math.max(0, fire.timer), ownerFaction: fire.ownerFaction } : null,
      mudEntries: players.flatMap((player, index) => player && this.preyMudSinkhole?.coatedPlayers?.has(player) ? [index ? 'player2' : 'player1'] : []),
      sarii: dog ? { ownerId, hp: dog.hp, order: dog.order, wounded: !!dog.wounded, retired: !!dog.retired,
        position: dog.pos.toArray(), home: dog.home.toArray(), holdPosition: dog.holdPosition.toArray(),
        biteCooldown: dog.biteCooldown, injuryCooldown: dog.injuryCooldown, withdrawals: dog.withdrawals } : null };
  }

  restorePreyInteractions(saved) {
    const names = Object.keys(PREY_SAVE_PROPS), finite = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;
    const profileId = this.referenceProfile?.id ?? null, players = preyPlayers(this);
    if (!saved || saved.version !== 1 || saved.profileId !== profileId || saved.maskGuidance !== 'cancel_on_resume' ||
      !saved.props || Object.keys(saved.props).length !== names.length || !Array.isArray(saved.mudEntries) ||
      new Set(saved.mudEntries).size !== saved.mudEntries.length || saved.mudEntries.some(id => !['player1', 'player2'].includes(id))) return false;
    for (const name of names) {
      const prop = saved.props[name];
      if (!prop || Object.keys(prop).length !== 2 || typeof prop.present !== 'boolean' || typeof prop.consumed !== 'boolean' ||
        prop.present !== !!this[name] || prop.consumed && (!prop.present || !PREY_SAVE_PROPS[name])) return false;
    }
    const present = names.some(name => saved.props[name].present);
    if (saved.sourceLevelId !== (present ? PREY_SOURCE_LEVEL : null) || present && profileId !== PREY_SOURCE_LEVEL ||
      saved.mudEntries.length && !this.preyMudSinkhole || saved.mudEntries.some(id => !players[id === 'player2' ? 1 : 0])) return false;
    const fire = saved.fire;
    if (fire !== null && (!saved.props.trapperBaitTree.consumed || !preyFinitePoint(fire?.position) ||
      !finite(fire.remaining, 0, PREY_INTERACTION_RULES.powderFireSeconds) || typeof fire.ownerFaction !== 'string' ||
      !/^[A-Za-z0-9_-]{1,64}$/.test(fire.ownerFaction) ||
      this.trapperBaitTree.pos.distanceTo(new THREE.Vector3(...fire.position)) > 1e-6)) return false;
    const dog = saved.sarii;
    if (!!dog !== !!this.sariiCompanion) return false;
    if (dog) {
      const tamed = saved.props.sariiCompanion.consumed, ownerIndex = dog.ownerId === 'player2' ? 1 : 0;
      if (!finite(dog.hp, 0, 120) || !['follow', 'hold', 'guard', 'retreat'].includes(dog.order) ||
        typeof dog.wounded !== 'boolean' || typeof dog.retired !== 'boolean' ||
        ![dog.position, dog.home, dog.holdPosition].every(preyFinitePoint) ||
        !finite(dog.biteCooldown, 0, .8) || !finite(dog.injuryCooldown, 0, .75) ||
        !Number.isInteger(dog.withdrawals) || dog.withdrawals < 0 || dog.withdrawals > 1 ||
        (tamed ? !['player1', 'player2'].includes(dog.ownerId) || !players[ownerIndex] : dog.ownerId !== null) ||
        (dog.wounded || dog.retired) && dog.order !== 'retreat' ||
        this.sariiCompanion.isTamed && (!tamed || this.sariiCompanion.owner !== players[ownerIndex])) return false;
    }
    // All validation precedes mutation. In-place restores never refund a used
    // pickup, extend an existing fire, revive a retired dog or grant inventory.
    const alreadyDetonated = this.trapperBaitTree?.isDetonated;
    const priorFire = this.activePowderKegFire, remaining = fire ? (alreadyDetonated ? Math.min(priorFire?.timer ?? 0, fire.remaining) : fire.remaining) : 0;
    for (const [name, flag] of Object.entries(PREY_SAVE_PROPS)) if (flag && this[name]) this[name][flag] ||= saved.props[name].consumed;
    if (priorFire?.mesh) this.removeReferenceObject(priorFire.mesh);
    this.activePowderKegFire = remaining > 1e-9 ? preyCreatePowderFire(this, new THREE.Vector3(...fire.position), remaining, fire.ownerFaction) : null;
    if (this.boneMaskDecoy) {
      this.boneMaskDecoy.isArmed = false; this.boneMaskDecoy.armedRemaining = 0;
      this.boneMaskDecoy.lasers?.forEach(beam => { beam.visible = false; });
      if (this.game?.bosses) this.game.bosses.maskTarget = null;
    }
    if (this.preyMudSinkhole) {
      this.preyMudSinkhole.coatedPlayers ??= new WeakSet();
      for (const id of saved.mudEntries) this.preyMudSinkhole.coatedPlayers.add(players[id === 'player2' ? 1 : 0]);
    }
    if (dog) {
      const state = this.sariiCompanion, wasTamed = !!state.owner;
      state.hp = wasTamed ? Math.min(state.hp, dog.hp) : dog.hp;
      state.wounded ||= dog.wounded; state.retired ||= dog.retired;
      state.order = state.wounded || state.retired ? 'retreat' : dog.order;
      state.owner = dog.ownerId ? players[dog.ownerId === 'player2' ? 1 : 0] : null;
      state.withdrawals = Math.max(state.withdrawals, dog.withdrawals);
      state.pos.fromArray(dog.position); state.group.position.copy(state.pos);
      state.home.fromArray(dog.home); state.holdPosition.fromArray(dog.holdPosition);
      state.biteCooldown = dog.biteCooldown; state.injuryCooldown = dog.injuryCooldown;
      state.group.userData.companion = { id: state.id, order: state.order, hp: state.hp, wounded: state.wounded, retired: state.retired };
    }
    return true;
  }

  checkBoneMaskDecoyInteraction(player, ui, audio, bosses) {
    const mask = this.boneMaskDecoy;
    if (!preyCanInteract(this, player, mask, 'unused', 4.2)) return false;
    const active = bosses?.activeBoss;
    if (active?.type !== 'feral_predator_boss' || active.hp <= 0 || !active.mesh || !bosses.armFeralMaskTrap) {
      ui?.showAnnouncement?.('MASQUE D’OS : ATTENDEZ LE TIREUR FERAL POUR ALIGNER LES TROIS LASERS.', 'info');
      return true;
    }
    const aim = active.mesh.position.clone().add(new THREE.Vector3(0, 2.1, 0));
    if (!bosses.armFeralMaskTrap(mask.pos, aim)) return false;
    mask.isArmed = true; mask.armedRemaining = 16; mask.aim = aim;
    mask.group.updateWorldMatrix(true, false);
    const inverse = mask.group.getWorldQuaternion(new THREE.Quaternion()).invert();
    for (let index = 0; index < mask.lasers.length; index++) {
      const beam = mask.lasers[index], origin = mask.pos.clone().add(new THREE.Vector3((index - 1) * .12, 0, 0));
      const direction = aim.clone().sub(origin), length = direction.length();
      beam.position.copy(mask.group.worldToLocal(origin.clone().addScaledVector(direction, .5)));
      beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize().applyQuaternion(inverse));
      beam.scale.y = length / 12; beam.visible = true;
    }
    audio?.playBoneMaskLaserLockRedirect?.();
    ui?.showAnnouncement?.('MASQUE ALIGNÉ : ATTENDEZ UNE VRAIE FLÉCHETTE. LES LASERS NE CAUSENT AUCUN DÉGÂT.', 'info');
    return true;
  }

  // Prey Interaction: orange-flower signature effect (species not certified).
  checkOrangeFlowerInteraction(player, ui, audio) {
    const prop = this.orangeFlowerPatch;
    if (!preyCanInteract(this, player, prop, 'isHarvested', 4.2) || typeof player.applyOrangeFlowerBuff !== 'function') return false;
    prop.isHarvested = true;
    player.applyOrangeFlowerBuff(PREY_INTERACTION_RULES.flowerSeconds);
    audio?.playOrangeFlowerHerbalDrink?.();
    ui?.showAnnouncement?.('INFUSION DE FLEUR : SIGNATURE THERMIQUE ATTÉNUÉE 35 S. EFFET ADAPTÉ POUR LE JEU ; ESPÈCE ET TEMPÉRATURE NON CERTIFIÉES.', 'success');
    return true;
  }

  // Prey Interaction: Raphael Adolini 1715 Flintlock Pistol
  checkAdoliniPistolInteraction(player, ui, audio, horde, bosses, particles) {
    const prop = this.adoliniPistolPedestal;
    if (!preyCanInteract(this, player, prop, 'isClaimed', 4.2)) return false;
    prop.isClaimed = true; // One loaded shot; a miss still consumes the charge.
    const origin = player.position.clone().add(new THREE.Vector3(0, 1.4, 0));
    const yaw = Number.isFinite(player.rotationY) ? player.rotationY : player.mesh?.rotation.y ?? 0;
    const direction = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const faction = preyFaction(this, player, horde), candidates = [];
    for (const target of preyTargets(this, horde, bosses)) {
      if (!preyCanHit(this, target, faction, horde)) continue;
      const center = target.mesh.position.clone().add(new THREE.Vector3(0, 1.4, 0));
      const radius = Math.max(.6, Math.min(2.2, target.radius ?? (target === bosses?.activeBoss ? 1.8 : 1.1)));
      const offset = origin.clone().sub(center), b = offset.dot(direction), c = offset.lengthSq() - radius * radius;
      const discriminant = b * b - c; if (discriminant < 0) continue;
      const first = -b - Math.sqrt(discriminant), last = -b + Math.sqrt(discriminant);
      if (last < 0 || first > PREY_INTERACTION_RULES.pistolRange) continue;
      const distance = Math.max(0, first), impact = origin.clone().addScaledVector(direction, distance);
      if (!preyClearShot(this, origin, impact, prop.group)) continue;
      candidates.push({ target, impact, distance });
    }
    candidates.sort((a, b) => a.distance - b.distance);
    const hit = candidates[0], dealt = hit ? preyDamage(this, hit.target, PREY_INTERACTION_RULES.pistolDamage, horde, bosses, faction, 'adolini_flintlock') : 0;
    audio?.playFlintlockPistolShot?.();
    if (hit && dealt > 0) particles?.emitSparks?.(hit.impact, 18);
    ui?.showAnnouncement?.(`PISTOLET ADOLINI : COUP UNIQUE VISÉ, PORTÉE 28 U, JUSQU’À 1200 DÉGÂTS. ${dealt > 0 ? 'CIBLE ATTEINTE.' : 'AUCUNE CIBLE ATTEINTE.'} RÉGLAGES ADAPTÉS POUR LE JEU.`, 'info');
    return true;
  }

  // Prey Interaction: Taabe's Comanche War Horse & Rock Overlook
  checkTaabeWarBowInteraction(player, ui, audio) {
    const prop = this.taabeRockPerch;
    if (!preyCanInteract(this, player, prop, 'isClaimed', 4.5)) return false;
    if (!player.equipPreyWeapon?.('taabe_bow')) {
      ui?.showAnnouncement?.('ARC DE TAABE : L’EMPRUNT DE CETTE ARME EST RÉSERVÉ AU MODE ADAPTÉ.', 'info'); return true;
    }
    prop.isClaimed = true; player.hasTaabeBow = true;
    const arrows = preyStock(player, 'taabeArrowAmmo', PREY_INTERACTION_RULES.arrowsGranted, PREY_INTERACTION_RULES.maxArrows);
    player.applyTaabeWarAgility?.(PREY_INTERACTION_RULES.taabeSeconds);
    audio?.playCrossbowHomingDarts?.();
    ui?.showAnnouncement?.(`ARC DE TAABE ÉQUIPÉ : +${arrows} FLÈCHES, MAXIMUM 12 ; MOBILITÉ +30 % PENDANT 25 S. EMPRUNT ET BONUS ADAPTÉS POUR LE JEU.`, 'success');
    return true;
  }

  // Prey Interaction: Giant Slain Grizzly Bear Carcass
  checkGrizzlyBearTrophyInteraction(player, ui, audio) {
    const prop = this.grizzlyBearCarcass;
    if (!preyCanInteract(this, player, prop, 'isSkinned', 4.5)) return false;
    const before = player.hp; player.hp = Math.min(player.maxHp ?? before, before + 150); prop.isSkinned = true;
    audio?.playCeramicArmorDeflection?.();
    ui?.showAnnouncement?.(`TROPHÉE DU GRIZZLY RÉCUPÉRÉ : RÉCUPÉRATION +${player.hp - before} PV, LIMITÉE AUX PV MAXIMUM. BONUS ADAPTÉ POUR LE JEU.`, 'success');
    return true;
  }

  // Prey Interaction: Naru's Tethered Tomahawk
  checkNaruTomahawkInteraction(player, ui, audio) {
    const prop = this.naruTomahawkTree;
    if (!preyCanInteract(this, player, prop, 'isClaimed', 4.2)) return false;
    if (!player.equipPreyWeapon?.('naru_axe')) {
      ui?.showAnnouncement?.('HACHE DE NARU : L’EMPRUNT DE CETTE ARME EST RÉSERVÉ AU MODE ADAPTÉ.', 'info'); return true;
    }
    prop.isClaimed = true; player.hasNaruAxe = true;
    const charges = preyStock(player, 'naruAxeCharges', PREY_INTERACTION_RULES.axeChargesGranted, PREY_INTERACTION_RULES.maxAxeCharges);
    audio?.playTomahawkRopeWhistle?.();
    ui?.showAnnouncement?.(`HACHE DE NARU ÉQUIPÉE : +${charges} FRAPPES DE HACHE, MAXIMUM 4. UNE FRAPPE ADMISE CONSOMME UNE CHARGE ; ADAPTATION DE JEU.`, 'success');
    return true;
  }

  // Prey Interaction: Trapper Field Medical Tent
  checkTrapperMedicalTentInteraction(player, ui, audio) {
    const prop = this.trapperMedicalTent;
    if (!preyCanInteract(this, player, prop, 'isLooted', 4.2)) return false;
    prop.isLooted = true;
    const before = player.hp; player.hp = Math.min(player.maxHp ?? before, before + 85);
    const charges = player.canUseArsenalEquipment?.('medicomp') === false ? 0 : preyStock(player, 'medicompCharges', 3, 6);
    audio?.playMedicompCauterize?.();
    ui?.showAnnouncement?.(`SOINS DES TRAPPEURS : +${player.hp - before} PV, +${charges} CHARGES DE SOINS COMPATIBLES, MAXIMUM 6. RECONDITIONNEMENT ADAPTÉ POUR LE JEU.`, 'success');
    return true;
  }

  // Prey Interaction: Archaic Feral Weapon Rack
  checkFeralArsenalInteraction(player, ui, audio) {
    const prop = this.feralArsenalStation;
    if (!preyCanInteract(this, player, prop, 'isClaimed', 4.2)) return false;
    if (player.canUseArsenalEquipment?.('crossbow') === false || player.selectWeapon?.('crossbow', false) !== true) {
      ui?.showAnnouncement?.('ARSENAL DU FERAL : ÉQUIPEMENT INCOMPATIBLE AVEC LE PROFIL CHOISI.', 'info'); return true;
    }
    prop.isClaimed = true;
    const bolts = preyStock(player, 'feralBoltAmmo', 6, 12), before = player.hp;
    player.hp = Math.min(player.maxHp ?? before, before + 100);
    audio?.playFeralShieldDeploy?.();
    ui?.showAnnouncement?.(`ÉQUIPEMENT FERAL : LANCE-FLÉCHETTES SÉLECTIONNÉ, +${bolts} FLÉCHETTES (MAXIMUM 12), RÉCUPÉRATION +${player.hp - before} PV. ADAPTATION DE JEU.`, 'success');
    return true;
  }

  // Prey Interaction: Sarii (Naru's Faithful Carolina Dog Companion)
  checkSariiCompanionInteraction(player, ui, audio) {
    const state = this.sariiCompanion;
    if (!preyCanInteract(this, player, state, 'unused', 4.5)) return false;
    if (!orderSarii(this, player)) return false;
    audio?.playSariiLoyalBark?.();
    const labels = { follow: 'suit le chasseur', hold: 'reste en position', guard: 'protège le chasseur', retreat: 'se replie' };
    ui?.showAnnouncement?.(`SARII : ${labels[state.order].toUpperCase()} — ${state.hp}/${state.maxHp} PV`, 'info');
    return true;
  }

  commandSarii(order, player = this.sariiCompanion?.owner) { return orderSarii(this, player, order); }
  damageSariiCompanion(amount) { return damageSarii(this, amount); }

  // Prey Interaction: French Trappers' Bait Tree & Black Powder Kegs
  checkTrapperBaitTreeInteraction(player, ui, audio, horde, bosses, particles) {
    const prop = this.trapperBaitTree;
    if (!preyCanInteract(this, player, prop, 'isDetonated', 4.5)) return false;
    prop.isDetonated = true; audio?.playBlackPowderKegIgnition?.();
    const ownerFaction = preyFaction(this, player, horde), origin = prop.pos.clone().add(new THREE.Vector3(0, .8, 0));
    let hitCount = 0;
    for (const target of preyTargets(this, horde, bosses)) {
      const point = target.mesh.position.clone().add(new THREE.Vector3(0, .8, 0));
      if (target.mesh.position.distanceTo(prop.pos) <= PREY_INTERACTION_RULES.powderBlastRadius &&
        preyClearShot(this, origin, point, prop.group) &&
        preyDamage(this, target, PREY_INTERACTION_RULES.powderBlastDamage, horde, bosses, ownerFaction, 'trapper_powder_blast') > 0) {
        hitCount++; particles?.emitSparks?.(point, 20);
      }
    }
    this.activePowderKegFire = preyCreatePowderFire(this, prop.pos, PREY_INTERACTION_RULES.powderFireSeconds, ownerFaction);
    ui?.showAnnouncement?.(`POUDRE : SOUFFLE 16 U, JUSQU’À 750 DÉGÂTS (${hitCount} CIBLES) ; FEU 8,5 U, 110 PV/S PENDANT 18 S. LES OBSTACLES PROTÈGENT ; ADAPTATION DE JEU.`, 'warning');
    return true;
  }

  // Prey Interaction: French Voyageurs' River Raft & Fur Trade Cache
  checkVoyageurRaftInteraction(player, ui, audio) {
    if (!this.voyageurRiverRaft || !player || !player.position || this.voyageurRiverRaft.isLooted) return false;
    if (player.position.distanceTo(this.voyageurRiverRaft.pos) <= 4.5) {
      this.voyageurRiverRaft.isLooted = true;
      if (audio && audio.playWaterRapidsSplash) audio.playWaterRapidsSplash();

      player.smartDiscCharges = Math.min(8, (player.smartDiscCharges || 0) + 4);
      player.m77GaussAmmo = Math.min(12, (player.m77GaussAmmo || 0) + 6);
      player.shield = Math.min(200, (player.shield || 0) + 100);
      if (player.addScore) player.addScore(2000);

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement('🛶 RADEAU DES TRAPPEURS PILLÉ (PREY 2022) : BALLES DE PLOMB & PEAUX DE CASTOR (+4 DISCS, +6 BALLES, BOUCLIER 100%) !', 'success');
      }
      return true;
    }
    return false;
  }

  // Prey Interaction: Comanche Sun Dance / War Paint Medicine Totem Post
  checkComancheTotemInteraction(player, ui, audio) {
    if (!this.comancheTotemPost || !player || !player.position || this.comancheTotemPost.isClaimed) return false;
    if (player.position.distanceTo(this.comancheTotemPost.pos) <= 4.5) {
      this.comancheTotemPost.isClaimed = true;
      if (audio && audio.playComancheTotemChant) audio.playComancheTotemChant();

      if (player.applyComancheWarPaint) player.applyComancheWarPaint(30.0);
      player.plasmaEnergy = player.maxPlasmaEnergy || 100;
      if (player.addScore) player.addScore(2500);

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement('🪶 PEINTURES DE GUERRE COMANCHES APPLIQUÉES (PREY 2022) : FRAPPES AU CORPS-À-CORPS +25% & VITESSE +30% (30S, +2500 SCORE) !', 'success');
      }
      return true;
    }
    return false;
  }

  // Prey Interaction: Lightning-Struck Split Hollow Pine
  checkLightningPineInteraction(player, ui, audio) {
    if (!this.lightningSplitPine || !player || !player.position || this.lightningSplitPine.isClaimed) return false;
    if (player.position.distanceTo(this.lightningSplitPine.pos) <= 4.2) {
      this.lightningSplitPine.isClaimed = true;
      if (audio && audio.playOrangeFlowerHerbalDrink) audio.playOrangeFlowerHerbalDrink();

      player.hp = Math.min(player.maxHp || 100, (player.hp || 0) + 65);
      if (player.medicompCharges !== undefined) player.medicompCharges = Math.min(6, player.medicompCharges + 2);
      if (player.addScore) player.addScore(1800);

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement('⚡ ABRI DU PIN FOUDROYÉ (PREY 2022) : ÉCORCES DE SAULE THÉRAPEUTIQUES (+65 PV, +2 MEDICOMP, +1800 SCORE) !', 'success');
      }
      return true;
    }
    return false;
  }

  // Prey Interaction: French Trappers' Campfire Cauldron Topple
  checkTrapperCampfireInteraction(player, ui, audio, horde, particles) {
    const prop = this.trapperCampfireSpit;
    if (!preyCanInteract(this, player, prop, 'isToppled', 4.5)) return false;
    prop.isToppled = true; audio?.playCampfireCauldronScald?.();
    const faction = preyFaction(this, player, horde), bosses = this.game?.bosses;
    const origin = prop.pos.clone().add(new THREE.Vector3(0, .8, 0));
    for (const target of preyTargets(this, horde, bosses)) {
      const point = target.mesh.position.clone().add(new THREE.Vector3(0, .8, 0));
      if (target.mesh.position.distanceTo(prop.pos) <= PREY_INTERACTION_RULES.cauldronRadius && preyClearShot(this, origin, point, prop.group)) {
        preyDamage(this, target, PREY_INTERACTION_RULES.cauldronDamage, horde, bosses, faction, 'trapper_cauldron');
      }
    }
    const before = player.hp; player.hp = Math.min(player.maxHp ?? before, before + 75);
    particles?.emitExplosion?.(prop.pos, 0xff4500, 45);
    ui?.showAnnouncement?.(`CHAUDRON : JUSQU’À 500 DÉGÂTS DANS 7,5 U, BLOQUÉS PAR LES OBSTACLES ; RATIONS +${player.hp - before} PV. ADAPTATION DE JEU.`, 'success');
    return true;
  }

  // Prey Interaction: Comanche Buffalo Skull Trail Marker Cairn
  checkBuffaloCairnInteraction(player, ui, audio) {
    if (!this.buffaloSkullCairn || !player || !player.position || this.buffaloSkullCairn.isCommuned) return false;
    if (player.position.distanceTo(this.buffaloSkullCairn.pos) <= 4.5) {
      this.buffaloSkullCairn.isCommuned = true;
      if (audio && audio.playBuffaloCairnWindChime) audio.playBuffaloCairnWindChime();

      if (player.applyAncestralTrackingBuff) player.applyAncestralTrackingBuff(30.0);
      if (player.addScore) player.addScore(2000);

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement('🦬 CAIRN SACRÉ DU BISON (PREY 2022) : INSTINCT DE TRAQUE ANCESTRAL (+20% DÉGÂTS CRITIQUES, 30S, +2000 SCORE) !', 'success');
      }
      return true;
    }
    return false;
  }

  // Prey Interaction: Feral Predator's Severed Arm-Gauntlet & Obsidian Claws
  checkFeralSeveredGauntletInteraction(player, ui, audio) {
    if (!this.feralSeveredGauntlet || !player || !player.position || this.feralSeveredGauntlet.isClaimed) return false;
    if (player.position.distanceTo(this.feralSeveredGauntlet.pos) <= 4.2) {
      this.feralSeveredGauntlet.isClaimed = true;
      if (audio && audio.playFeralSeveredGauntletSnap) audio.playFeralSeveredGauntletSnap();

      if (player.applyFeralClawsBuff) player.applyFeralClawsBuff(30.0);
      player.shield = Math.min(200, (player.shield || 0) + 100);
      if (player.addScore) player.addScore(2500);

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement('🩸 AVANT-BRAS TRANCHÉ DU FERAL (PREY 2022) : GRIFFES D\'OBSIDIENNE ÉQUIPÉES (+35% PERFORATION, 30S, +2500 SCORE) !', 'success');
      }
      return true;
    }
    return false;
  }

  /* =========================================================================
     PREDATOR: KILLER OF KILLERS (2025) — MASTER 1:1 LEVEL DESIGN
     3 ÉPOQUES : LE BOUCLIER (850), LE SABRE (1620) & LA BALLE (1943)
     COLISÉE COSMIQUE YAUTJA & PODS DE CRYO-STASE
     ========================================================================= */

  buildKillerOfKillersProps() {
    const group = new THREE.Group();

    const obsidianMat = new THREE.MeshStandardMaterial({ color: 0x18151f, metalness: 0.88, roughness: 0.22 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.92, roughness: 0.18 });
    const stasisGlassMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.5, roughness: 0.1 });
    const iceMat = new THREE.MeshStandardMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.65, roughness: 0.15 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.85 });
    const ironMat = new THREE.MeshStandardMaterial({ color: 0x27272a, metalness: 0.85, roughness: 0.35 });
    const redLacquerMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.45 });
    const bambooMat = new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.5 });
    const airplaneMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.75, roughness: 0.35 });
    const sandbagMat = new THREE.MeshStandardMaterial({ color: 0xa16207, roughness: 0.95 });

    // 1. Central Grand Dais of the 3 Cryo-Stasis Pods [0, 0, 0]
    const daisGroup = new THREE.Group();
    daisGroup.position.set(0, 0, 0);

    const baseDais = new THREE.Mesh(new THREE.CylinderGeometry(7.0, 7.8, 0.6, 6), obsidianMat);
    baseDais.position.y = 0.3;
    baseDais.receiveShadow = true;
    daisGroup.add(baseDais);

    const goldRing = new THREE.Mesh(new THREE.RingGeometry(4.5, 5.0, 32), goldMat);
    goldRing.rotation.x = -Math.PI / 2;
    goldRing.position.y = 0.61;
    daisGroup.add(goldRing);

    // Stasis Core Central Console
    const consolePillar = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.1, 1.4, 8), obsidianMat);
    consolePillar.position.y = 1.3;
    daisGroup.add(consolePillar);

    const coreLight = new THREE.PointLight(0xa855f7, 2.5, 10.0);
    coreLight.position.set(0, 2.2, 0);
    daisGroup.add(coreLight);

    // Pod 1: Ursa (The Shield - Scandinavia 850) [-3.2, 0.6, -1.8]
    const pod1 = new THREE.Group();
    pod1.position.set(-3.2, 0.6, -1.8);
    const pod1Glass = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 2.4, 16), stasisGlassMat);
    pod1Glass.position.y = 1.2;
    pod1.add(pod1Glass);
    const pod1Light = new THREE.PointLight(0x38bdf8, 2.0, 6.0);
    pod1Light.position.set(0, 1.2, 0);
    pod1.add(pod1Light);
    daisGroup.add(pod1);

    // Pod 2: Kenji (The Sabre - Feudal Japan 1620) [3.2, 0.6, -1.8]
    const pod2 = new THREE.Group();
    pod2.position.set(3.2, 0.6, -1.8);
    const pod2Glass = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 2.4, 16), new THREE.MeshStandardMaterial({ color: 0xef4444, transparent: true, opacity: 0.5 }));
    pod2Glass.position.y = 1.2;
    pod2.add(pod2Glass);
    const pod2Light = new THREE.PointLight(0xef4444, 2.0, 6.0);
    pod2Light.position.set(0, 1.2, 0);
    pod2.add(pod2Light);
    daisGroup.add(pod2);

    // Pod 3: Torres (The Bullet - WWII 1943) [0, 0.6, 3.6]
    const pod3 = new THREE.Group();
    pod3.position.set(0, 0.6, 3.6);
    const pod3Glass = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 2.4, 16), new THREE.MeshStandardMaterial({ color: 0xeab308, transparent: true, opacity: 0.5 }));
    pod3Glass.position.y = 1.2;
    pod3.add(pod3Glass);
    const pod3Light = new THREE.PointLight(0xeab308, 2.0, 6.0);
    pod3Light.position.set(0, 1.2, 0);
    pod3.add(pod3Light);
    daisGroup.add(pod3);

    group.add(daisGroup);
    this.trioCryoStasisPods = {
      group: daisGroup,
      pos: new THREE.Vector3(0, 1.2, 0),
      isAwakened: false
    };

    // 2. ERA I (The Shield 850): Ursa's Viking Longship Prow & Shieldwall [-18, 0, 18]
    const ursaGroup = new THREE.Group();
    ursaGroup.position.set(-18, 0, 18);

    const iceMound = new THREE.Mesh(new THREE.BoxGeometry(4.8, 1.2, 4.8), iceMat);
    iceMound.position.y = 0.6;
    ursaGroup.add(iceMound);

    // Longship Dragon Prow
    const prow = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.5, 3.8, 8), woodMat);
    prow.position.set(0, 2.2, 0);
    prow.rotation.z = 0.35;
    ursaGroup.add(prow);

    const dragonHead = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 1.2), woodMat);
    dragonHead.position.set(0.7, 3.8, 0);
    ursaGroup.add(dragonHead);

    // Ursa's Lindisfarne Oak Shield with Iron Boss
    const shieldPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.08, 24), new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.8 }));
    shieldPlate.rotation.x = Math.PI / 2;
    shieldPlate.position.set(0.6, 1.6, 0.5);
    ursaGroup.add(shieldPlate);

    const shieldBoss = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), ironMat);
    shieldBoss.position.set(0.6, 1.6, 0.58);
    ursaGroup.add(shieldBoss);

    const ursaLight = new THREE.PointLight(0x38bdf8, 1.8, 6.0);
    ursaLight.position.set(0, 2.0, 0);
    ursaGroup.add(ursaLight);

    group.add(ursaGroup);
    this.ursaShieldProw = {
      group: ursaGroup,
      pos: new THREE.Vector3(-18, 1.4, 18),
      isClaimed: false
    };

    // 3. ERA I: Ursa's Dane Axe & Anders' Runestone Dais [-22, 0, 12]
    const runeGroup = new THREE.Group();
    runeGroup.position.set(-22, 0, 12);

    const runestone = new THREE.Mesh(new THREE.BoxGeometry(1.6, 3.6, 0.8), obsidianMat);
    runestone.position.y = 1.8;
    runeGroup.add(runestone);

    // Embedded Two-Handed Dane Axe
    const axeHaft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2), woodMat);
    axeHaft.position.set(0, 2.2, 0.5);
    axeHaft.rotation.x = 0.4;
    runeGroup.add(axeHaft);

    const axeBlade = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.4, 0.04), ironMat);
    axeBlade.position.set(0, 3.0, 0.65);
    runeGroup.add(axeBlade);

    const runeLight = new THREE.PointLight(0x38bdf8, 2.2, 7.0);
    runeLight.position.set(0, 2.5, 0.6);
    runeGroup.add(runeLight);

    group.add(runeGroup);
    this.ursaDaneAxeAltar = {
      group: runeGroup,
      pos: new THREE.Vector3(-22, 1.8, 12),
      isClaimed: false
    };

    // 4. ERA II (The Sabre 1620): Kenji's Tatami Dojo Pavilion & Torii Gate [18, 0, 18]
    const dojoGroup = new THREE.Group();
    dojoGroup.position.set(18, 0, 18);

    const tatamiPlatform = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.4, 5.2), new THREE.MeshStandardMaterial({ color: 0xd4c28f, roughness: 0.9 }));
    tatamiPlatform.position.y = 0.2;
    dojoGroup.add(tatamiPlatform);

    // Torii Gate Pillars & Crossbeam
    [-1.8, 1.8].forEach(tx => {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 3.5, 12), redLacquerMat);
      pillar.position.set(tx, 1.8, 0);
      dojoGroup.add(pillar);
    });

    const crossbeam = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.35, 0.4), redLacquerMat);
    crossbeam.position.set(0, 3.6, 0);
    dojoGroup.add(crossbeam);

    // Katana Sword Kake Stand & Masamune Katana
    const swordStand = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 0.35), obsidianMat);
    swordStand.position.set(0, 0.8, 0);
    dojoGroup.add(swordStand);

    const katanaBlade = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.04, 0.08), new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.95, roughness: 0.1 }));
    katanaBlade.position.set(0, 1.25, 0);
    katanaBlade.rotation.z = 0.1;
    dojoGroup.add(katanaBlade);

    const dojoLight = new THREE.PointLight(0xef4444, 2.0, 7.0);
    dojoLight.position.set(0, 2.0, 0);
    dojoGroup.add(dojoLight);

    group.add(dojoGroup);
    this.kenjiKatanaStand = {
      group: dojoGroup,
      pos: new THREE.Vector3(18, 1.2, 18),
      isClaimed: false
    };

    // 5. ERA II: Zen Bamboo Grove & Bronze Wind Chime Decoy [22, 0, 12]
    const bambooGroup = new THREE.Group();
    bambooGroup.position.set(22, 0, 12);

    for (let b = 0; b < 10; b++) {
      const bx = (b % 4 - 1.5) * 0.7;
      const bz = (Math.floor(b / 4) - 1.0) * 0.8;
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 4.5, 8), bambooMat);
      stalk.position.set(bx, 2.25, bz);
      bambooGroup.add(stalk);
    }

    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 0.45, 12), goldMat);
    bell.position.set(0, 2.6, 0);
    bambooGroup.add(bell);

    const bambooLight = new THREE.PointLight(0x22c55e, 1.5, 5.0);
    bambooLight.position.set(0, 2.0, 0);
    bambooGroup.add(bambooLight);

    group.add(bambooGroup);
    this.kenjiBambooDecoy = {
      group: bambooGroup,
      pos: new THREE.Vector3(22, 1.4, 12),
      isTriggered: false
    };

    // 6. ERA III (The Bullet 1943): John J. Torres' Crashed P-40 Warhawk [-18, 0, -18]
    const warhawkGroup = new THREE.Group();
    warhawkGroup.position.set(-18, 0, -18);

    const sandDune = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.8, 5.5), sandbagMat);
    sandDune.position.y = 0.4;
    warhawkGroup.add(sandDune);

    // Aluminum Fuselage
    const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.6, 4.8, 12), airplaneMat);
    fuselage.rotation.x = Math.PI / 2;
    fuselage.rotation.z = 0.35;
    fuselage.position.set(0, 1.1, 0);
    warhawkGroup.add(fuselage);

    // 3-Blade Bent Propeller
    [-0.7, 0.7].forEach(pAngle => {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.2, 0.04), ironMat);
      blade.position.set(0, 1.1 + Math.sin(pAngle) * 0.9, 2.4 + Math.cos(pAngle) * 0.9);
      blade.rotation.x = pAngle;
      warhawkGroup.add(blade);
    });

    const smokeLight = new THREE.PointLight(0xf59e0b, 2.2, 7.0);
    smokeLight.position.set(0, 1.8, 1.2);
    warhawkGroup.add(smokeLight);

    group.add(warhawkGroup);
    this.torresWarhawkWreck = {
      group: warhawkGroup,
      pos: new THREE.Vector3(-18, 1.4, -18),
      isClaimed: false
    };

    // 7. ERA III: USAAF Browning .50 Cal M2 Heavy Machine Gun Nest [-22, 0, -12]
    const browningGroup = new THREE.Group();
    browningGroup.position.set(-22, 0, -12);

    for (let sb = 0; sb < 6; sb++) {
      const ang = (sb / 6) * Math.PI;
      const sandbag = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.35, 0.45), sandbagMat);
      sandbag.position.set(Math.cos(ang) * 1.4, 0.4, Math.sin(ang) * 1.4);
      sandbag.rotation.y = -ang;
      browningGroup.add(sandbag);
    }

    // Browning M2 Heavy Gun Body & Barrel
    const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.28, 1.6), ironMat);
    gunBody.position.set(0, 1.1, 0.2);
    browningGroup.add(gunBody);

    const gunBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 8), ironMat);
    gunBarrel.rotation.x = Math.PI / 2;
    gunBarrel.position.set(0, 1.1, 1.5);
    browningGroup.add(gunBarrel);

    const ammoBox = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.5), new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.7 }));
    ammoBox.position.set(0.45, 0.8, 0.2);
    browningGroup.add(ammoBox);

    const browningLight = new THREE.PointLight(0xeab308, 1.6, 5.0);
    browningLight.position.set(0, 1.5, 0.5);
    browningGroup.add(browningLight);

    group.add(browningGroup);
    this.torresBrowningNest = {
      group: browningGroup,
      pos: new THREE.Vector3(-22, 1.2, -12),
      isFired: false
    };

    this.addReferenceObject(group);
    this.envObjects.push(group);
  }

  buildKillerOfKillersExpansionProps() {
    const group = new THREE.Group();
    const obsidianMat = new THREE.MeshStandardMaterial({ color: 0x18151f, metalness: 0.88, roughness: 0.22 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.92, roughness: 0.18 });

    // 8. The Grandmaster Arbiter's Throne [0, 0, -24]
    const throneGroup = new THREE.Group();
    throneGroup.position.set(0, 0, -24);

    const throneBase = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.8, 3.4), obsidianMat);
    throneBase.position.y = 0.4;
    throneGroup.add(throneBase);

    const throneBack = new THREE.Mesh(new THREE.BoxGeometry(3.6, 4.5, 0.6), obsidianMat);
    throneBack.position.set(0, 2.8, -1.2);
    throneGroup.add(throneBack);

    // Trophies Mounted on Throne: Viking Horned Skull, Samurai Kabuto, Pilot Helm
    const trophySkull = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.5), new THREE.MeshStandardMaterial({ color: 0xeadfcf }));
    trophySkull.position.set(-1.1, 4.5, -0.7);
    throneGroup.add(trophySkull);

    const trophyKabuto = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), new THREE.MeshStandardMaterial({ color: 0x991b1b }));
    trophyKabuto.position.set(0, 4.8, -0.7);
    throneGroup.add(trophyKabuto);

    const trophyPilot = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.52, 0.52), new THREE.MeshStandardMaterial({ color: 0x334155 }));
    trophyPilot.position.set(1.1, 4.5, -0.7);
    throneGroup.add(trophyPilot);

    const throneLight = new THREE.PointLight(0xa855f7, 2.8, 12.0);
    throneLight.position.set(0, 3.2, 0);
    throneGroup.add(throneLight);

    group.add(throneGroup);

    // 9. Twin Cosmic Stasis Containment Pylons [-8, 0, 0] & [8, 0, 0]
    [-8, 8].forEach(px => {
      const pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.65, 5.5, 8), obsidianMat);
      pylon.position.set(px, 2.75, 0);
      group.add(pylon);

      const pCap = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 12), goldMat);
      pCap.position.set(px, 5.6, 0);
      group.add(pCap);

      const pLight = new THREE.PointLight(0x38bdf8, 2.0, 8.0);
      pLight.position.set(px, 5.6, 0);
      group.add(pLight);
    });

    this.addReferenceObject(group);
    this.envObjects.push(group);
  }

  // Killer of Killers Interaction: Trio Cryo-Stasis Pods Awakening Overload
  checkStasisTrioAwakeningInteraction(player, ui, audio, bosses, horde, particles) {
    if (!this.trioCryoStasisPods || !player || !player.position || this.trioCryoStasisPods.isAwakened) return false;
    if (player.position.distanceTo(this.trioCryoStasisPods.pos) <= 4.8) {
      this.trioCryoStasisPods.isAwakened = true;
      if (audio && audio.playStasisPodDecompression) audio.playStasisPodDecompression();
      if (audio && audio.playApexGladiatorRoar) audio.playApexGladiatorRoar();

      // Damage surrounding horde
      if (horde && horde.aliens) {
        horde.aliens.forEach(alien => {
          if (alien.isAlive && alien.position.distanceTo(this.trioCryoStasisPods.pos) <= 14.0) {
            alien.takeDamage(1000, true);
          }
        });
      }

      // Stun and damage Boss
      if (bosses && bosses.activeBoss && bosses.activeBoss.type === 'apex_gladiator_predator') {
        bosses.activeBoss.hp -= 2000;
        bosses.activeBoss.isStunned = true;
        bosses.activeBoss.stunTimer = 6.0;
        bosses.activeBoss.hasPhaseShield = false;
        bosses.activeBoss.phaseShieldHp = 0;
      }

      player.hp = player.maxHp || 100;
      player.shield = Math.min(200, (player.shield || 0) + 150);
      if (player.addScore) player.addScore(3500);

      if (particles && particles.emitExplosion) {
        particles.emitExplosion(this.trioCryoStasisPods.pos, 0x38bdf8, 55);
      }

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement('🌌 TRIO DES TUEURS RÉVEILLÉ (KILLER OF KILLERS 2025) : URSA, KENJI & TORRES DÉCHAÎNENT L\'ONDE DE CHOC (1000 DMG / STUN BOSS 6S) !', 'success');
      }
      return true;
    }
    return false;
  }

  // Killer of Killers Interaction: Ursa's Lindisfarne Oak Shield (The Shield 850)
  checkUrsaShieldInteraction(player, ui, audio) {
    if (!this.ursaShieldProw || !player || !player.position || this.ursaShieldProw.isClaimed) return false;
    if (player.position.distanceTo(this.ursaShieldProw.pos) <= 4.2) {
      this.ursaShieldProw.isClaimed = true;
      if (audio && audio.playVikingShieldBlock) audio.playVikingShieldBlock();

      if (player.applyUrsaBerserk) player.applyUrsaBerserk(30.0);
      player.shield = Math.min(200, (player.shield || 0) + 150);
      if (player.addScore) player.addScore(2000);

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement('🛡️ BOUCLIER VIKING D\'URSA ÉQUIPÉ (LE BOUCLIER 850) : PARADE FRONTALE RENFORCÉE (+150 BOUCLIER, BERSERK VALKYRIE 30S) !', 'success');
      }
      return true;
    }
    return false;
  }

  // Killer of Killers Interaction: Ursa's Dane Axe & Anders' Runestone (The Shield 850)
  checkUrsaDaneAxeInteraction(player, ui, audio) {
    if (!this.ursaDaneAxeAltar || !player || !player.position || this.ursaDaneAxeAltar.isClaimed) return false;
    if (player.position.distanceTo(this.ursaDaneAxeAltar.pos) <= 4.2) {
      this.ursaDaneAxeAltar.isClaimed = true;
      if (audio && audio.playVikingWarHorn) audio.playVikingWarHorn();

      if (player.applyUrsaBerserk) player.applyUrsaBerserk(30.0);
      player.plasmaEnergy = player.maxPlasmaEnergy || 100;
      if (player.addScore) player.addScore(2500);

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement('🪓 HACHE DANOISE D\'URSA & RUNES D\'ANDERS (LE BOUCLIER 850) : DÉGÂTS CRITIQUES LOURDS +45% (30S, +2500 SCORE) !', 'success');
      }
      return true;
    }
    return false;
  }

  // Killer of Killers Interaction: Kenji's Ancestral Masamune Katana (The Sabre 1620)
  checkKenjiKatanaInteraction(player, ui, audio) {
    if (!this.kenjiKatanaStand || !player || !player.position || this.kenjiKatanaStand.isClaimed) return false;
    if (player.position.distanceTo(this.kenjiKatanaStand.pos) <= 4.2) {
      this.kenjiKatanaStand.isClaimed = true;
      if (audio && audio.playKatanaIaijutsuDraw) audio.playKatanaIaijutsuDraw();

      if (player.applyKenjiReflexes) player.applyKenjiReflexes(30.0);
      player.smartDiscCharges = Math.min(8, (player.smartDiscCharges || 0) + 4);
      if (player.addScore) player.addScore(2500);

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement('⚔️ MASAMUNE DE KENJI RÉCUPÉRÉ (LE SABRE 1620) : RÉFLEXES NINJA (+35% CADENCE, +25% VITESSE, +4 SHURIKENS/DISCS) !', 'success');
      }
      return true;
    }
    return false;
  }

  // Killer of Killers Interaction: Kenji's Bamboo Decoy Bell (The Sabre 1620)
  checkKenjiBambooDecoyInteraction(player, ui, audio, horde) {
    if (!this.kenjiBambooDecoy || !player || !player.position || this.kenjiBambooDecoy.isTriggered) return false;
    if (player.position.distanceTo(this.kenjiBambooDecoy.pos) <= 4.2) {
      this.kenjiBambooDecoy.isTriggered = true;
      if (audio && audio.playNinjaSmokeBomb) audio.playNinjaSmokeBomb();

      if (horde && horde.aliens) {
        horde.aliens.forEach(alien => {
          if (alien.isAlive && alien.position.distanceTo(this.kenjiBambooDecoy.pos) <= 22.0) {
            alien.targetPosition = this.kenjiBambooDecoy.pos.clone();
            alien.distractionTimer = 8.0;
          }
        });
      }
      if (player.addScore) player.addScore(1800);

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement('💨 BOMBE FUMIGÈNE & LEURRE DE BAMBOU (LE SABRE 1620) : ENNEMIS DÉTOURNÉS PENDANT 8S (+1800 SCORE) !', 'success');
      }
      return true;
    }
    return false;
  }

  // Killer of Killers Interaction: Torres' Crashed P-40 Warhawk Avionics (The Bullet 1943)
  checkTorresWarhawkInteraction(player, ui, audio) {
    if (!this.torresWarhawkWreck || !player || !player.position || this.torresWarhawkWreck.isClaimed) return false;
    if (player.position.distanceTo(this.torresWarhawkWreck.pos) <= 4.2) {
      this.torresWarhawkWreck.isClaimed = true;
      if (audio && audio.playPlaneEngineSputter) audio.playPlaneEngineSputter();

      if (player.applyTorresIncendiary) player.applyTorresIncendiary(30.0);
      player.medicompCharges = Math.min(6, (player.medicompCharges || 0) + 2);
      if (player.addScore) player.addScore(2500);

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement('✈️ ÉPAVE DU P-40 DE TORRES (LA BALLE 1943) : MUNITIONS INCENDIAIRES D\'AVIATEUR (+30% FEU RANGED, +6 BALLES GAUSS, +2 MEDICOMP) !', 'success');
      }
      return true;
    }
    return false;
  }

  // Killer of Killers Interaction: Torres' Browning .50 Cal M2 Machine Gun (The Bullet 1943)
  checkTorresBrowningInteraction(player, ui, audio, horde, particles) {
    if (!this.torresBrowningNest || !player || !player.position || this.torresBrowningNest.isFired) return false;
    if (player.position.distanceTo(this.torresBrowningNest.pos) <= 4.2) {
      this.torresBrowningNest.isFired = true;
      if (audio && audio.playBrowning50CalBurst) audio.playBrowning50CalBurst();

      if (horde && horde.aliens) {
        horde.aliens.forEach(alien => {
          if (alien.isAlive && alien.position.distanceTo(this.torresBrowningNest.pos) <= 25.0) {
            alien.takeDamage(900, true);
          }
        });
      }

      if (particles && particles.emitExplosion) {
        particles.emitExplosion(this.torresBrowningNest.pos.clone().add(new THREE.Vector3(0, 1.2, 1.8)), 0xeab308, 40);
      }
      if (player.addScore) player.addScore(2000);

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement('💥 MITRAILLEUSE BROWNING .50 CAL M2 DE TORRES (LA BALLE 1943) : RAFALE LOURDE DÉVASTATRICE (900 DMG, +2000 SCORE) !', 'success');
      }
      return true;
    }
    return false;
  }
}
