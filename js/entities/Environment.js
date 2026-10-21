/* Procedural 3D Level Environment Generator */

import * as THREE from 'three';

export class EnvironmentManager {
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
  }

  clearEnvironment() {
    this.envObjects.forEach(obj => this.scene.remove(obj));
    this.envObjects = [];
    this.modularSlabs = [];
    this.catwalks = [];
    this.transformers.forEach(t => this.scene.remove(t.mesh));
    this.transformers = [];
    this.supplyCaches.forEach(s => this.scene.remove(s.mesh));
    this.supplyCaches = [];
    this.blastDoors.forEach(b => this.scene.remove(b.mesh));
    this.blastDoors = [];
    this.resinPustules.forEach(p => this.scene.remove(p.mesh));
    this.resinPustules = [];
    this.acidTrenches.forEach(t => this.scene.remove(t.group));
    this.acidTrenches = [];
    if (this.spaceJockeyPlatform) {
      this.scene.remove(this.spaceJockeyPlatform.group);
      this.spaceJockeyPlatform = null;
    }
    if (this.cargoCrane) {
      this.scene.remove(this.cargoCrane.group);
      this.cargoCrane = null;
    }
    this.cryoMedBays.forEach(c => this.scene.remove(c.mesh));
    this.cryoMedBays = [];
    this.eggNurseries.forEach(e => this.scene.remove(e.group));
    this.eggNurseries = [];
    if (this.decompressionAirlock) {
      this.scene.remove(this.decompressionAirlock.group);
      this.decompressionAirlock = null;
    }
    this.steamConduits.forEach(c => this.scene.remove(c.group));
    this.steamConduits = [];
    this.chrysalisCocoons.forEach(c => this.scene.remove(c.mesh));
    this.chrysalisCocoons = [];
    if (this.queenOvipositor) {
      this.scene.remove(this.queenOvipositor.group);
      this.queenOvipositor = null;
    }
    this.lightningRods.forEach(r => this.scene.remove(r.group));
    this.lightningRods = [];
    if (this.activeLightningBolt) {
      this.scene.remove(this.activeLightningBolt);
      this.activeLightningBolt = null;
    }
    this.fallenMarines.forEach(m => this.scene.remove(m.group));
    this.fallenMarines = [];
    this.nitrogenTanks.forEach(n => this.scene.remove(n.group));
    this.nitrogenTanks = [];
    this.activeFreezeZones.forEach(z => this.scene.remove(z.mesh));
    this.activeFreezeZones = [];
    this.resinWebbings.forEach(w => this.scene.remove(w.mesh));
    this.resinWebbings = [];
    this.cryoSpecimenTubes.forEach(t => this.scene.remove(t.group));
    this.cryoSpecimenTubes = [];
    if (this.powerLoader) {
      this.scene.remove(this.powerLoader.group);
      this.powerLoader = null;
    }
    if (this.acidRainParticleSystem) {
      this.scene.remove(this.acidRainParticleSystem);
      this.acidRainParticleSystem = null;
    }
    this.acidRainActive = false;
    this.acidRainTimer = 0;
    // v45.0 Cleanups
    if (this.drivableAPC) {
      this.scene.remove(this.drivableAPC.group);
      this.drivableAPC = null;
    }
    if (this.reactorConsole) {
      this.scene.remove(this.reactorConsole.group);
      this.reactorConsole = null;
    }
    this.electricFloorGrids.forEach(g => this.scene.remove(g.group));
    this.electricFloorGrids = [];
    if (this.deconAirlock) {
      this.scene.remove(this.deconAirlock.group);
      this.deconAirlock = null;
    }
    // v46.0 Cleanups
    if (this.mountedSmartgun) {
      this.scene.remove(this.mountedSmartgun.group);
      this.mountedSmartgun = null;
    }
    if (this.derelictChamber) {
      this.scene.remove(this.derelictChamber.group);
      this.derelictChamber = null;
    }
    this.fuelLines.forEach(fl => {
      this.scene.remove(fl.group);
      if (fl.fireMesh) this.scene.remove(fl.fireMesh);
      if (fl.puddleMesh) this.scene.remove(fl.puddleMesh);
    });
    this.fuelLines = [];
    if (this.craneConsole) {
      this.scene.remove(this.craneConsole.group);
      this.craneConsole = null;
    }
    // v47.0 Cleanups
    if (this.engineerRuins) {
      this.scene.remove(this.engineerRuins.group);
      this.engineerRuins = null;
    }
    if (this.coolingTowerCryoVent) {
      this.scene.remove(this.coolingTowerCryoVent.group);
      if (this.coolingTowerCryoVent.fogMesh) this.scene.remove(this.coolingTowerCryoVent.fogMesh);
      this.coolingTowerCryoVent = null;
    }
    this.engineerUrns.forEach(u => this.scene.remove(u.group));
    this.engineerUrns = [];
    this.mutagenPuddles.forEach(p => this.scene.remove(p.mesh));
    this.mutagenPuddles = [];

    // v48.0 Cleanups
    if (this.moltenFoundry) {
      this.scene.remove(this.moltenFoundry.group);
      if (this.moltenFoundry.pourMesh) this.scene.remove(this.moltenFoundry.pourMesh);
      if (this.moltenFoundry.poolMesh) this.scene.remove(this.moltenFoundry.poolMesh);
      this.moltenFoundry = null;
    }
    this.alliedAndroids.forEach(a => this.scene.remove(a.mesh));
    this.alliedAndroids = [];
    if (this.volcanicStorm && this.volcanicStorm.ashSystem) {
      this.scene.remove(this.volcanicStorm.ashSystem);
      this.volcanicStorm.ashSystem = null;
    }
    if (this.volcanicStorm) {
      this.volcanicStorm.active = false;
      this.volcanicStorm.timer = 18.0;
    }

    // v49.0 Cleanups
    if (this.uscmMissileBattery) {
      this.scene.remove(this.uscmMissileBattery.group);
      this.uscmMissileBattery = null;
    }
    this.activeSAMMissiles.forEach(m => this.scene.remove(m.mesh));
    this.activeSAMMissiles = [];
    if (this.aurigaBasin) {
      this.scene.remove(this.aurigaBasin.group);
      if (this.aurigaBasin.arcMesh) this.scene.remove(this.aurigaBasin.arcMesh);
      this.aurigaBasin = null;
    }
    if (this.ancientShrine) {
      this.scene.remove(this.ancientShrine.group);
      this.ancientShrine = null;
    }

    // v50.0 Cleanups
    if (this.coastalRailCannon) {
      this.scene.remove(this.coastalRailCannon.group);
      this.coastalRailCannon = null;
    }
    this.activeRailShells.forEach(s => this.scene.remove(s.mesh));
    this.activeRailShells = [];
    if (this.cryoStasisSector) {
      this.scene.remove(this.cryoStasisSector.group);
      this.cryoStasisSector = null;
    }

    // v51.0 Cleanups
    this.pressurizedAcidGeysers.forEach(g => this.scene.remove(g.group));
    this.pressurizedAcidGeysers = [];
    if (this.engineerSarcophagus) {
      this.scene.remove(this.engineerSarcophagus.group);
      this.engineerSarcophagus = null;
    }

    // v52.0 Cleanups
    if (this.hydraulicCargoLift) {
      this.scene.remove(this.hydraulicCargoLift.group);
      this.hydraulicCargoLift = null;
    }
    this.subterraneanVents.forEach(v => this.scene.remove(v.group));
    this.subterraneanVents = [];
    this.activeDropPods.forEach(p => this.scene.remove(p.mesh));
    this.activeDropPods = [];

    // v53.0 Cleanups
    this.stasisSpecimenTanks.forEach(t => this.scene.remove(t.group));
    this.stasisSpecimenTanks = [];
    this.activeCryoCoolantClouds.forEach(c => this.scene.remove(c.mesh));
    this.activeCryoCoolantClouds = [];

    // v54.0 Cleanups
    this.explosiveBarrels.forEach(b => {
      if (b.group) this.scene.remove(b.group);
    });
    this.explosiveBarrels = [];
    this.activeBarrelFireZones.forEach(f => {
      if (f.mesh) this.scene.remove(f.mesh);
    });
    this.activeBarrelFireZones = [];
    this.plasmaRechargeTerminals.forEach(t => {
      if (t.group) this.scene.remove(t.group);
      if (t.light) this.scene.remove(t.light);
    });
    this.plasmaRechargeTerminals = [];

    // v55.0 Cleanups
    this.floodedWaterPuddles.forEach(p => {
      if (p.mesh) this.scene.remove(p.mesh);
    });
    this.floodedWaterPuddles = [];

    this.reactorMeltdownActive = false;
    this.reactorMeltdownTimer = 180.0;
    this.slabShiftTimer = 0;
    this.isSlabMoving = false;
  }

  buildLevelEnvironment(levelConfig) {
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
    this.scene.add(floor);
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
      this.scene.add(wall);
      this.envObjects.push(wall);
    });

    // Decorative Environment Props matching level themes
    const theme = levelConfig.theme || levelConfig.environmentType || 'jungle';

    if (theme === 'pyramid' || theme === 'temple') {
      this.buildTempleProps(wallMat);
      this.buildModularPyramidWalls(wallMat);
    } else if (theme === 'jungle' || theme === 'rain_forest') {
      this.buildJungleProps();
    } else if (theme === 'hive_world' || theme === 'hive') {
      this.buildHiveProps();
    } else if (theme === 'romulus_station') {
      this.buildRomulusCryoProps();
    } else if (theme === 'la_rooftops') {
      this.buildLARooftopProps();
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
      this.scene.add(pillar);
      this.envObjects.push(pillar);
    }
  }

  buildJungleProps() {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x2e1e0f, roughness: 0.9 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x0e3814, roughness: 0.6 });

    // Tropical Trees
    for (let i = 0; i < 25; i++) {
      const x = (Math.random() - 0.5) * 100;
      const z = (Math.random() - 0.5) * 100;
      if (Math.abs(x) < 10 && Math.abs(z) < 10) continue;

      const trunkGeo = new THREE.CylinderGeometry(0.8, 1.4, 18, 8);
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.set(x, 9, z);
      trunk.castShadow = true;
      this.scene.add(trunk);
      this.envObjects.push(trunk);

      const canopyGeo = new THREE.ConeGeometry(5, 10, 8);
      const canopy = new THREE.Mesh(canopyGeo, leafMat);
      canopy.position.set(x, 18, z);
      this.scene.add(canopy);
      this.envObjects.push(canopy);
    }
  }

  buildColonyProps() {
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x333d4d, metalness: 0.9, roughness: 0.2 });

    // Cargo Crates & Steam Pipes
    for (let i = 0; i < 18; i++) {
      const x = (Math.random() - 0.5) * 90;
      const z = (Math.random() - 0.5) * 90;
      if (Math.abs(x) < 10 && Math.abs(z) < 10) continue;

      const crateGeo = new THREE.BoxGeometry(3, 3, 3);
      const crate = new THREE.Mesh(crateGeo, metalMat);
      crate.position.set(x, 1.5, z);
      crate.castShadow = true;
      this.scene.add(crate);
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
      const radius = 28 + Math.random() * 18;
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
      this.scene.add(pillarGroup);
      this.envObjects.push(pillarGroup);
    }

    // 2. Wall Resin Cocoons with Torso Shapes (Hosts entombed in secretion)
    for (let c = 0; c < 10; c++) {
      const x = (Math.random() - 0.5) * 85;
      const z = (Math.random() - 0.5) * 85;
      if (Math.abs(x) < 12 && Math.abs(z) < 12) continue;

      const cocoonGeo = new THREE.CylinderGeometry(0.7, 0.4, 2.4, 8);
      const cocoon = new THREE.Mesh(cocoonGeo, cocoonMat);
      cocoon.position.set(x, 1.2, z);
      cocoon.rotation.x = (Math.random() - 0.5) * 0.4;
      cocoon.rotation.z = (Math.random() - 0.5) * 0.4;
      this.scene.add(cocoon);
      this.envObjects.push(cocoon);
    }

    // 3. Alien Ovimorph Eggs
    for (let i = 0; i < 24; i++) {
      const x = (Math.random() - 0.5) * 100;
      const z = (Math.random() - 0.5) * 100;
      if (Math.abs(x) < 8 && Math.abs(z) < 8) continue;

      const eggGeo = new THREE.SphereGeometry(0.8, 8, 8);
      eggGeo.scale(1, 1.4, 1);
      const egg = new THREE.Mesh(eggGeo, eggMat);
      egg.position.set(x, 1.1, z);
      egg.castShadow = true;
      this.scene.add(egg);
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
      this.scene.add(slabGroup);
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
      this.scene.add(podGroup);
      this.envObjects.push(podGroup);
    }
  }

  buildLARooftopProps() {
    // Predator 2 (1990) Rooftops: HVAC Units, Satellite Dishes & Neon Antennas
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x27272a, metalness: 0.85, roughness: 0.3 });
    const neonMat = new THREE.MeshBasicMaterial({ color: 0xff0055 });

    for (let u = 0; u < 8; u++) {
      const rx = (Math.random() - 0.5) * 80;
      const rz = (Math.random() - 0.5) * 80;
      if (Math.abs(rx) < 12 && Math.abs(rz) < 12) continue;

      const hvac = new THREE.Mesh(new THREE.BoxGeometry(4.0, 2.8, 3.5), metalMat);
      hvac.position.set(rx, 1.4, rz);
      this.scene.add(hvac);
      this.envObjects.push(hvac);

      // Neon warning beacon antenna on top
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.5, 6), metalMat);
      mast.position.set(rx, 4.5, rz);
      this.scene.add(mast);
      this.envObjects.push(mast);

      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 6), neonMat);
      beacon.position.set(rx, 6.3, rz);
      this.scene.add(beacon);
      this.envObjects.push(beacon);
    }
  }

  update(delta, horde, audioEngine, player) {
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
                  this.scene.remove(alien.mesh);
                  horde.aliens.splice(i, 1);
                  horde.deadCount++;
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
        this.scene.remove(p.mesh);
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
              if (Math.random() < 0.05 && audioEngine && audioEngine.playAcidTrenchBubble) {
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
        if (window.gameInstance && window.gameInstance.triggerCameraShake) {
          window.gameInstance.triggerCameraShake(0.85, 0.4);
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
              this.scene.remove(a.mesh);
              horde.aliens.splice(i, 1);
              horde.deadCount++;
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
              this.scene.remove(a.mesh);
              horde.aliens.splice(i, 1);
              horde.deadCount++;
              if (window.gameInstance) {
                window.gameInstance.score += 50;
              }
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
            1.0 + Math.sin(Date.now() * 0.02) * 0.25,
            1.0 + Math.cos(Date.now() * 0.02) * 0.25,
            1.0 + Math.sin(Date.now() * 0.015) * 0.3
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
            ovi.pos.x + (Math.random() - 0.5) * 4.0,
            0,
            ovi.pos.z - 4.5 + (Math.random() - 0.5) * 3.0
          );
          // Spawn egg cluster or facehugger
          horde.spawnAlien('facehugger', eggSpawnPos);
          if (window.gameInstance && window.gameInstance.ui) {
            window.gameInstance.ui.showAnnouncement('🥚 LA REINE POND EN DIRECT : ÉRUPTION D\'OVOMORPHE VIVANT !');
          }
        }
      }
    }

    // 14. Chantier 2 (v43): Atmospheric Condenser Lightning Surge & Lightning Rods (Alien 3)
    this.ionStormTimer += delta;
    if (this.ionStormTimer >= 22.0) {
      this.ionStormTimer = 0;
      this.triggerLightningStrike(audioEngine, window.gameInstance ? window.gameInstance.particles : null, horde, player);
    }

    // Decay active lightning bolt beam
    if (this.activeLightningBolt) {
      this.activeLightningBolt.timer -= delta;
      if (this.activeLightningBolt.timer <= 0) {
        this.scene.remove(this.activeLightningBolt.mesh);
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
        this.scene.remove(zone.mesh);
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
        pl.beacon.material.opacity = 0.5 + Math.sin(Date.now() * 0.012) * 0.5;
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
      this.updateDerelictChamber(delta, player, horde, audioEngine, particles, window.gameInstance ? window.gameInstance.ui : null);
    }

    // 26. Chantier 6 (v46): Colonial JP-4 Fuel Lines & Flame Wall
    if (this.fuelLines && this.fuelLines.length > 0) {
      this.updateFuelLines(delta, player, horde, window.gameInstance ? window.gameInstance.synthetics : null, particles, audioEngine);
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
      const rampGeo = new THREE.BoxGeometry(p.width, 0.3, rampLength);
      const rampAngle = Math.atan2(p.height, rampLength);
      const ramp = new THREE.Mesh(rampGeo, metalMat);
      const rampZ = p.z + (p.rampSide * (p.length / 2 + rampLength / 2 * Math.cos(rampAngle)));
      ramp.position.set(p.x, p.height / 2, rampZ);
      ramp.rotation.x = p.rampSide * rampAngle;
      ramp.receiveShadow = true;
      group.add(ramp);

      this.scene.add(group);
      this.envObjects.push(group);

      this.catwalks.push({
        minX: p.x - p.width / 2,
        maxX: p.x + p.width / 2,
        minZ: p.z - p.length / 2,
        maxZ: p.z + p.length / 2,
        height: p.height,
        ramp: {
          minX: p.x - p.width / 2,
          maxX: p.x + p.width / 2,
          minZ: Math.min(p.z + p.rampSide * (p.length / 2), rampZ + p.rampSide * (rampLength / 2)),
          maxZ: Math.max(p.z + p.rampSide * (p.length / 2), rampZ + p.rampSide * (rampLength / 2)),
          bottomZ: rampZ + p.rampSide * (rampLength / 2),
          topZ: p.z + p.rampSide * (p.length / 2),
          height: p.height
        }
      });
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

      this.scene.add(group);
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
              setTimeout(() => {
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

      this.scene.add(group);
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

      this.scene.add(group);
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

      this.scene.add(group);
      this.envObjects.push(group);

      this.resinPustules.push({
        mesh: group,
        pustuleMesh: pustule,
        pos: new THREE.Vector3(px, 1.8, pz),
        breathTimer: Math.random() * Math.PI * 2
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

      // 2 Industrial Metal Grating Bridges crossing the trench
      const bridges = [];
      [-16, 16].forEach(bx => {
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

        bridges.push({
          minX: bx - 2.25,
          maxX: bx + 2.25,
          minZ: cfg.z - halfW - 0.4,
          maxZ: cfg.z + halfW + 0.4
        });
      });

      this.scene.add(group);
      this.envObjects.push(group);

      this.acidTrenches.push({
        group: group,
        acidMesh: acidMesh,
        baseY: cfg.depth + 0.15,
        bubbleTimer: Math.random() * Math.PI,
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

    this.scene.add(group);
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

      this.scene.add(group);
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

    this.scene.add(group);
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

    this.scene.add(group);
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

    this.scene.add(group);
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
    if (window.gameInstance && window.gameInstance.triggerCameraShake) {
      window.gameInstance.triggerCameraShake(0.65, 0.4);
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

      this.scene.add(group);
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

      this.scene.add(group);
      this.envObjects.push(group);

      this.chrysalisCocoons.push({
        mesh: group,
        pos: new THREE.Vector3(cx, cy, cz),
        isHarvested: false,
        isTriggered: false,
        breathTimer: Math.random() * Math.PI * 2,
        isAmbush: Math.random() < 0.5
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
          if (window.gameInstance) {
            window.gameInstance.score += 30;
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
          if (window.gameInstance && window.gameInstance.triggerCameraShake) {
            window.gameInstance.triggerCameraShake(0.85, 0.45);
          }
          if (window.gameInstance && window.gameInstance.ui) {
            window.gameInstance.ui.showAnnouncement('💥 PILIERS DE PASSERELLE DÉTRUITS : EFFONDREMENT DE SECTION INDUSTRIELLE !');
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

    this.scene.add(group);
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

        if (window.gameInstance && window.gameInstance.ui) {
          window.gameInstance.ui.showAnnouncement('💥 OVIPOSITEUR DE LA REINE SECTIONNÉ ! RUPTURE VISCÉRALE (+600 DÉGÂTS, REINE ENRAGÉE) !');
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

      this.scene.add(group);
      this.lightningRods.push({ group, pos: p });
    });
  }

  triggerLightningStrike(audioEngine, particles, horde, player) {
    if (audioEngine && audioEngine.playIonStormCharge) {
      audioEngine.playIonStormCharge();
    }

    // Pick random rod or center arena
    const targetRod = this.lightningRods[Math.floor(Math.random() * this.lightningRods.length)];
    const strikePos = targetRod ? targetRod.pos.clone().setY(0) : new THREE.Vector3(0, 0, 0);

    // Visual Lightning Bolt Mesh (Cyan emissive jagged bolt)
    const boltGeo = new THREE.CylinderGeometry(0.2, 0.4, 25, 6);
    const boltMat = new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.95 });
    const bolt = new THREE.Mesh(boltGeo, boltMat);
    bolt.position.set(strikePos.x, 12.5, strikePos.z);
    this.scene.add(bolt);

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
        if (window.gameInstance && window.gameInstance.ui) {
          window.gameInstance.ui.showAnnouncement('⚡ SURTENSION ÉLECTROMAGNÉTIQUE : CAMOUFLAGE COURT-CIRCUITÉ !');
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

      this.scene.add(group);
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

        if (window.gameInstance) {
          window.gameInstance.score += 100;
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

      this.scene.add(group);
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
        this.scene.add(zoneMesh);

        this.activeFreezeZones.push({
          mesh: zoneMesh,
          pos: floorPos,
          radius: 9.0,
          timer: 8.5
        });

        if (window.gameInstance && window.gameInstance.ui) {
          window.gameInstance.ui.showAnnouncement('❄️ DÉLUGE CRYOGÉNIQUE À L\'AZOTE LIQUIDE DÉCLENCHÉ : XÉNOS GIVRÉS (DÉGÂTS CRITIQUES 3X) !');
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
      this.scene.add(mesh);

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
          this.scene.remove(w.mesh);
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

      this.scene.add(group);
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

          if (window.gameInstance && window.gameInstance.triggerCameraShake) {
            window.gameInstance.triggerCameraShake(0.6, 0.35);
          }

          if (window.gameInstance && window.gameInstance.ui) {
            window.gameInstance.ui.showAnnouncement('🧪 TUBE DE SPÉCIMEN CRYO-STATIQUE BRISÉ : DÉFLAGRATION CHIMIQUE 350 DÉGÂTS !');
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

    this.scene.add(group);
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
          if (hits.length > 0 && window.gameInstance) {
            window.gameInstance.registerHits(hits);
          }
        }

        if (particles && particles.emitSparks) {
          particles.emitSparks(crushOrigin, 35);
        }

        if (window.gameInstance && window.gameInstance.triggerCameraShake) {
          window.gameInstance.triggerCameraShake(0.85, 0.4);
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
      const rx = (Math.random() - 0.5) * 110;
      const ry = 6.0 + Math.random() * 20.0;
      const rz = (Math.random() - 0.5) * 110;
      drop.position.set(rx, ry, rz);
      drop.rotation.x = Math.PI / 2;
      rainGroup.add(drop);
      drops.push({ mesh: drop, speed: 28 + Math.random() * 12 });
    }

    rainGroup.visible = false;
    this.scene.add(rainGroup);
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

      if (window.gameInstance && window.gameInstance.ui) {
        window.gameInstance.ui.showAnnouncement('🌧️ TEMPÊTE D\'ACIDE ATMOSPHÉRIQUE : VAPEURS CORROSIVES (-4 HP/S, XÉNOS +15% VIT) !');
      }
    }

    if (this.acidRainActive) {
      this.acidRainDuration -= delta;

      // Animate falling acid streaks
      this.acidRainDrops.forEach(d => {
        d.mesh.position.y -= d.speed * delta;
        if (d.mesh.position.y <= 0.2) {
          d.mesh.position.y = 22.0 + Math.random() * 6.0;
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
            a.mesh.position.y += Math.sin(Date.now() * 0.01) * 0.005;
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

    this.scene.add(group);
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
      apc.beacon.material.opacity = 0.5 + Math.sin(Date.now() * 0.01) * 0.4;
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
        this.scene.remove(tr.mesh);
        apc.tracers.splice(t, 1);
      }
    }

    if (!apc.isMounted) return;

    const keys = (window.gameInstance && window.gameInstance.keys) ? window.gameInstance.keys : {};

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
          const knockDir = fwd.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.5, 0.3, (Math.random() - 0.5) * 0.5)).normalize();
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
            this.scene.remove(a.mesh);
            horde.aliens.splice(i, 1);
            horde.deadCount++;
            if (window.gameInstance) {
              window.gameInstance.comboHits++;
              window.gameInstance.score += 150;
            }
          }
        }
      }
    }

    // Turret aiming & rapid firing (600 RPM autocannon)
    if (apc.fireCooldown > 0) apc.fireCooldown -= delta;
    if (keys['Space'] || (window.gameInstance && window.gameInstance.isLeftMouseDown)) {
      if (apc.fireCooldown <= 0) {
        apc.fireCooldown = 0.1;
        this.fireAPCCannon(horde, window.gameInstance ? window.gameInstance.bosses : null, audioEngine, particles);
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
    this.scene.add(tracerMesh);

    apc.tracers.push({
      mesh: tracerMesh,
      dir: fwd.clone(),
      target: targetPos,
      speed: 120.0,
      life: 0.6
    });

    // Explosive splash damage (75 dmg in 3.2m radius along forward vector)
    const hitCenter = origin.clone().addScaledVector(fwd, 12.0 + Math.random() * 8.0);
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
            this.scene.remove(a.mesh);
            horde.aliens.splice(i, 1);
            horde.deadCount++;
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

    this.scene.add(group);
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
      this.reactorConsole.strobe.material.color.setHex(Math.sin(Date.now() * 0.015) > 0 ? 0xff0000 : 0x000000);
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
    if (particles && particles.emitSmoke && Math.random() < 0.3) {
      const steamPos = this.reactorConsole.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 6, 2.5, (Math.random() - 0.5) * 4));
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
      if (window.gameInstance && window.gameInstance.ui) {
        window.gameInstance.ui.showAnnouncement('💥 DÉTONATION THERMONUCLÉAIRE DU RÉACTEUR (50 MT) : HADLEY\'S HOPE VAPORISÉE !');
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

      this.scene.add(group);
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
        const sparkPos = grid.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 6, 0.4, (Math.random() - 0.5) * 6));
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
          grid.mesh.material.color.setHex(Math.random() > 0.4 ? 0x38bdf8 : 0x1e293b);
        }

        if (particles && particles.emitSparks && Math.random() < 0.4) {
          const arcPos = grid.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 7, 0.3, (Math.random() - 0.5) * 7));
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

    this.scene.add(group);
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
      if (particles && particles.emitSmoke && Math.random() < 0.4) {
        const sprayPos = decon.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, 2.5, (Math.random() - 0.5) * 2));
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

    this.scene.add(group);
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
    this.scene.add(tracer);
    setTimeout(() => this.scene.remove(tracer), 45);

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
            this.scene.remove(a.mesh);
            horde.aliens.splice(i, 1);
            horde.deadCount++;
            if (window.gameInstance) {
              window.gameInstance.comboHits++;
              window.gameInstance.score += 75;
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

    this.scene.add(group);
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
      der.laserMistMesh.material.opacity = 0.38 + Math.sin(Date.now() * 0.003) * 0.12;
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

      this.scene.add(group);
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
          this.scene.add(fl.puddleMesh);

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
    this.scene.add(fl.fireMesh);

    if (ui && ui.showAnnouncement) {
      ui.showAnnouncement('🔥 CONDUIT JP-4 ENFLAMMÉ : MUR DE FEU HADLEY\'S HOPE ACTIF (160 DÉGÂTS/S RADIAUX) !');
    }
  }

  updateFuelLines(delta, player, horde, synthetics, particles, audioEngine) {
    this.fuelLines.forEach(fl => {
      if (fl.isRuptured && !fl.isIgnited) {
        // Fuel spray particles
        if (particles && particles.emitSmoke && Math.random() < 0.25) {
          particles.emitSmoke(fl.center.clone().add(new THREE.Vector3((Math.random() - 0.5) * 6, 0.5, (Math.random() - 0.5) * 6)), 3);
        }
      }

      if (fl.isIgnited) {
        fl.fireTimer -= delta;

        // Flicker fire mesh
        if (fl.fireMesh) {
          fl.fireMesh.scale.y = 1.0 + Math.sin(Date.now() * 0.02) * 0.25;
          fl.fireMesh.material.opacity = 0.55 + Math.sin(Date.now() * 0.03) * 0.15;
        }

        // Deal 160 fire damage/s to all aliens in fire zone
        if (horde && horde.aliens) {
          for (let i = horde.aliens.length - 1; i >= 0; i--) {
            const a = horde.aliens[i];
            if (!a || a.hp <= 0 || !a.mesh) continue;
            if (a.mesh.position.distanceTo(fl.center) <= (fl.cfg.length * 0.45)) {
              a.hp -= 160 * delta;
              if (particles && particles.emitSparks && Math.random() < 0.3) {
                particles.emitSparks(a.mesh.position, 3);
              }
              if (a.hp <= 0) {
                if (horde.goreEngine) horde.goreEngine.spawnDismemberment(a.mesh.position, 'heavy');
                this.scene.remove(a.mesh);
                horde.aliens.splice(i, 1);
                horde.deadCount++;
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
            this.scene.remove(fl.fireMesh);
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

    this.scene.add(group);
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

    this.scene.add(group);
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

    this.scene.add(group);
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
        this.scene.add(vent.fogMesh);
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
        vent.fogMesh.material.opacity = 0.45 + Math.sin(Date.now() * 0.01) * 0.2;
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
      if (particles && particles.emitSparks && Math.random() < 0.3) {
        particles.emitSparks(vent.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 12, 1.0, (Math.random() - 0.5) * 12)), 4);
      }

      if (vent.flushTimer <= 0) {
        vent.isFlushing = false;
        if (vent.fogMesh) {
          this.scene.remove(vent.fogMesh);
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
      const count = 3 + Math.floor(Math.random() * 2);
      for (let i = 0; i < count; i++) {
        const group = new THREE.Group();
        const offsetX = (Math.random() - 0.5) * 2.8;
        const offsetZ = (Math.random() - 0.5) * 2.8;
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

        this.scene.add(group);
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
          this.scene.remove(urn.group);

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
    this.scene.add(pMesh);

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
              if (audioEngine && audioEngine.playXenoHiss && Math.random() < 0.1) {
                audioEngine.playXenoHiss();
              }
            }
          }
        });
      }

      if (pud.life <= 0) {
        this.scene.remove(pud.mesh);
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

    this.scene.add(group);
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
      this.scene.add(f.pourMesh);

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
      this.scene.add(f.poolMesh);

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
        f.pourMesh.scale.x = 0.9 + Math.sin(Date.now() * 0.025) * 0.15;
        f.pourMesh.scale.z = 0.9 + Math.cos(Date.now() * 0.025) * 0.15;
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
            if (particles && particles.emitSparks && Math.random() < 0.25) {
              particles.emitSparks(a.mesh.position, 4);
            }
            if (a.hp <= 0) {
              if (horde.goreEngine) horde.goreEngine.spawnDismemberment(a.mesh.position, 'plasma');
              this.scene.remove(a.mesh);
              horde.aliens.splice(i, 1);
              horde.deadCount++;
              if (window.gameInstance) {
                window.gameInstance.comboHits++;
                window.gameInstance.score += 120;
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
          this.scene.remove(f.pourMesh);
          f.pourMesh = null;
        }
        if (f.poolMesh) {
          this.scene.remove(f.poolMesh);
          f.poolMesh = null;
        }
      }
    }
  }

  /* === CHANTIER 5 (v48): Reprogrammed Weyland-Yutani Combat Synthetic Squad ("Bishop Protocol" - Aliens 1986 / AvP Extinction) === */
  deployReprogrammedAndroidSquad(player, audioEngine, ui) {
    if (!player) return false;

    if (this.alliedAndroids.length > 0) {
      this.alliedAndroids.forEach(a => this.scene.remove(a.mesh));
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
      this.scene.add(group);

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
        this.scene.remove(ally.mesh);
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
          this.scene.add(tracer);
          setTimeout(() => this.scene.remove(tracer), 45);

          if (nearestTarget.hp <= 0 && horde) {
            const idx = horde.aliens.indexOf(nearestTarget);
            if (idx !== -1) {
              if (horde.goreEngine) horde.goreEngine.spawnDismemberment(nearestTarget.mesh.position, 'plasma');
              this.scene.remove(nearestTarget.mesh);
              horde.aliens.splice(idx, 1);
              horde.deadCount++;
              if (window.gameInstance) window.gameInstance.score += 65;
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
            positions[i * 3] = (Math.random() - 0.5) * 90;
            positions[i * 3 + 1] = Math.random() * 18;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 90;
          }
          const geo = new THREE.BufferGeometry();
          geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
          const mat = new THREE.PointsMaterial({ color: 0xf97316, size: 0.28, transparent: true, opacity: 0.75 });
          vs.ashSystem = new THREE.Points(geo, mat);
          this.scene.add(vs.ashSystem);
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
          this.scene.remove(vs.ashSystem);
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

    this.scene.add(group);
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
        this.scene.add(mMesh);

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
        this.scene.remove(ms.mesh);
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
            this.scene.remove(ms.targetMesh);
            horde.mantaSwarmers.splice(idx, 1);
          }
        } else if (ms.targetEntity && ms.targetEntity.hp !== undefined) {
          ms.targetEntity.hp -= 340;
          if (ms.targetEntity.hp <= 0 && horde && horde.aliens) {
            const idx = horde.aliens.indexOf(ms.targetEntity);
            if (idx !== -1) {
              if (horde.goreEngine) horde.goreEngine.spawnDismemberment(ms.targetMesh.position, 'heavy');
              this.scene.remove(ms.targetMesh);
              horde.aliens.splice(idx, 1);
              horde.deadCount++;
            }
          }
        }
        this.scene.remove(ms.mesh);
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

    this.scene.add(group);
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
            if (particles && particles.emitSparks && Math.random() < 0.25) {
              particles.emitSparks(a.mesh.position, 4);
            }
            if (a.hp <= 0) {
              if (horde.goreEngine) horde.goreEngine.spawnDismemberment(a.mesh.position, 'plasma');
              this.scene.remove(a.mesh);
              horde.aliens.splice(i, 1);
              horde.deadCount++;
              if (window.gameInstance) window.gameInstance.score += 130;
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

    this.scene.add(group);
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
              this.scene.remove(a.mesh);
              horde.aliens.splice(i, 1);
              horde.deadCount++;
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

    this.scene.add(group);
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
      this.scene.add(shellMesh);

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

      if (particles && particles.emitSparks && Math.random() < 0.4) {
        particles.emitSparks(s.mesh.position, 3);
      }

      const distToTarget = s.mesh.position.distanceTo(s.targetPos);
      if (distToTarget <= 3.5 || s.mesh.position.y <= 0.2 || s.life <= 0) {
        const impactPos = s.mesh.position.clone();
        impactPos.y = 0.2;
        this.scene.remove(s.mesh);
        this.activeRailShells.splice(i, 1);

        if (particles && particles.emitSparks) particles.emitSparks(impactPos, 35);
        if (particles && particles.spawnPlasmaScorch) particles.spawnPlasmaScorch(impactPos);

        // Crater explosion visual shockwave
        const craterGeo = new THREE.RingGeometry(1.2, s.radius, 32);
        craterGeo.rotateX(-Math.PI / 2);
        const craterMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
        const craterMesh = new THREE.Mesh(craterGeo, craterMat);
        craterMesh.position.copy(impactPos);
        this.scene.add(craterMesh);

        let cScale = 1.0;
        const cInterval = setInterval(() => {
          cScale += 0.25;
          craterMesh.scale.set(cScale, 1, cScale);
          craterMat.opacity -= 0.08;
          if (craterMat.opacity <= 0) {
            clearInterval(cInterval);
            this.scene.remove(craterMesh);
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
                this.scene.remove(a.mesh);
                horde.aliens.splice(j, 1);
                horde.deadCount++;
                if (window.gameInstance) window.gameInstance.score += 260;
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

    this.scene.add(group);
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
            this.scene.remove(horde.acidPools[i].mesh);
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
      const pulse = 1.0 + Math.sin(Date.now() * 0.003 + idx) * 0.08;
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

      this.scene.add(group);
      this.pressurizedAcidGeysers.push({
        group,
        pos,
        pool,
        isErupting: false,
        eruptTimer: 0,
        cooldown: 2.0 + Math.random() * 5.0
      });
    });
  }

  updatePressurizedAcidGeysers(delta, player, horde, bosses, audioEngine, particles) {
    if (!this.pressurizedAcidGeysers) return;

    this.pressurizedAcidGeysers.forEach(g => {
      if (g.isErupting) {
        g.eruptTimer -= delta;

        // Boiling green pulse
        g.pool.scale.set(1.0 + Math.sin(Date.now() * 0.02) * 0.2, 1, 1.0 + Math.cos(Date.now() * 0.02) * 0.2);

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
                this.scene.remove(a.mesh);
                horde.aliens.splice(i, 1);
                horde.deadCount++;
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
          g.cooldown = 6.0 + Math.random() * 6.0;
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

    this.scene.add(group);
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
    this.scene.add(group);

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

      this.scene.add(group);
      this.subterraneanVents.push({
        group,
        pos,
        cooldown: 8.0 + Math.random() * 8.0
      });
    });
  }

  updateSubterraneanVents(delta, horde, particles, audioEngine) {
    if (!this.subterraneanVents) return;

    this.subterraneanVents.forEach(v => {
      v.cooldown -= delta;
      if (v.cooldown <= 0) {
        v.cooldown = 14.0 + Math.random() * 10.0;
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

      this.scene.add(group);
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
          this.scene.remove(tank.group);

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
          this.scene.add(cloudMesh);

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
          tank.specimenMesh.position.y = 2.2 + Math.sin(Date.now() * 0.003 + tank.id) * 0.12;
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
              if (particles && particles.emitSparks && Math.random() < 0.05) {
                particles.emitSparks(a.mesh.position, 2);
              }
            }
          });
        }

        if (cloud.timer <= 0) {
          this.scene.remove(cloud.mesh);
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

      this.scene.add(group);
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
          this.scene.remove(barrel.group);

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
          this.scene.add(fireMesh);

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
            if (particles && particles.emitSparks && Math.random() < 0.08) {
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
        this.scene.remove(zone.mesh);
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
      this.scene.add(light);

      this.scene.add(group);
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
        const pulse = 1.6 + Math.sin(Date.now() * 0.005 + term.id) * 0.4;
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
      this.scene.add(mesh);

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

        if (player.isMoving && particles && particles.emitSparks && Math.random() < 0.1) {
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
}




