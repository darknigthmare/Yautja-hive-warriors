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
}



