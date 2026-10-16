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

  update(delta, horde, audioEngine) {
    if (!this.modularSlabs || this.modularSlabs.length === 0) return;

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
        // Smoothly interpolate position
        slab.mesh.position.copy(slab.homePos).addScaledVector(slab.shiftOffset, factor);

        // Check crushing collision against Xenomorph horde caught in sliding path
        if (horde && horde.aliens) {
          for (let i = horde.aliens.length - 1; i >= 0; i--) {
            const alien = horde.aliens[i];
            if (!alien || !alien.mesh) continue;

            const dist = alien.mesh.position.distanceTo(slab.mesh.position);
            if (dist < 5.4) {
              // Crush and knock back
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

    // Update Transformers Electrical Core Glow
    this.transformers.forEach(t => {
      if (!t.isDestroyed && t.coreMesh) {
        t.flickerTimer = (t.flickerTimer || 0) + delta * 8;
        t.coreMesh.scale.setScalar(0.9 + Math.sin(t.flickerTimer) * 0.15);
      }
    });

    // Update Supply Cache Beacon Pulse
    this.supplyCaches.forEach(c => {
      if (!c.isOpened && c.beaconMesh) {
        c.beaconTimer = (c.beaconTimer || 0) + delta * 6;
        c.beaconMesh.material.opacity = 0.4 + Math.sin(c.beaconTimer) * 0.5;
      }
    });

    // Update Living Resin Pustules
    for (let i = this.resinPustules.length - 1; i >= 0; i--) {
      const p = this.resinPustules[i];
      p.breathTimer = (p.breathTimer || 0) + delta * 3.5;
      const s = 1.0 + Math.sin(p.breathTimer) * 0.18;
      p.mesh.scale.set(s, s * 1.2, s);

      // Check proximity trigger (within 2.4m of player or alien)
      let triggered = false;
      if (player && player.position.distanceTo(p.pos) <= 2.4) {
        triggered = true;
        player.takeDamage(18, true); // Acid burn
      }
      if (!triggered && horde && horde.aliens) {
        for (let a of horde.aliens) {
          if (a.hp > 0 && a.mesh.position.distanceTo(p.pos) <= 2.4) {
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
    for (const c of this.catwalks) {
      // Check platform surface
      if (x >= c.minX && x <= c.maxX && z >= c.minZ && z <= c.maxZ) {
        return c.height;
      }
      // Check ramp slope
      const r = c.ramp;
      if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) {
        const factor = Math.abs(z - r.bottomZ) / Math.abs(r.topZ - r.bottomZ);
        return Math.max(0, Math.min(r.height, factor * r.height));
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
}


