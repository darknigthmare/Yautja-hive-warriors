/* Procedural 3D Level Environment Generator */

import * as THREE from 'three';

export class EnvironmentManager {
  constructor(scene) {
    this.scene = scene;
    this.envObjects = [];
  }

  clearEnvironment() {
    this.envObjects.forEach(obj => this.scene.remove(obj));
    this.envObjects = [];
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

    const slabPositions = [
      [-22, 4, -14], [22, 4, 14], [-14, 4, 22], [14, 4, -22]
    ];

    slabPositions.forEach(p => {
      const slabGroup = new THREE.Group();
      const wall = new THREE.Mesh(slabGeo, stoneMat);
      wall.castShadow = true;
      slabGroup.add(wall);

      // Embedded glowing Yautja hunting glyphs on slab face
      const glyph = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.4, 0.05), glyphMat);
      glyph.position.set(0, 0, 1.3);
      slabGroup.add(glyph);

      slabGroup.position.set(...p);
      this.scene.add(slabGroup);
      this.envObjects.push(slabGroup);
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
}
