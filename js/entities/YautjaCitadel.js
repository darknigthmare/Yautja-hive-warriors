/* 3D Yautja Mothership Citadel Room 3.0 - Laser Trophy Cleaning & Polishing Station */

import * as THREE from 'three';
import { createSkullTrophy } from '../graphics/SupportModels.js';
import { createSurfaceMaterial } from '../graphics/SurfaceLibrary.js';
import { disposeObject } from '../engine/SceneResources.js';

export class YautjaCitadel {
  constructor(scene) {
    this.scene = scene;
    this.citadelGroup = new THREE.Group();
    this.scene.add(this.citadelGroup);
    this.citadelGroup.visible = false;
  }

  buildCitadelRoom(skullCount = 0) {
    while (this.citadelGroup.children.length > 0) {
      disposeObject(this.citadelGroup.children[0]);
    }

    const wallMat = createSurfaceMaterial('metal', { color: 0x1a2230, metalness: 0.85, roughness: 0.2 });
    const floorMat = createSurfaceMaterial('metal', { color: 0x0a0f18, metalness: 0.9, roughness: 0.1 });
    const pedestalMat = createSurfaceMaterial('armor', { color: 0x3a4556, metalness: 0.85, roughness: 0.3 });
    const skullMat = createSurfaceMaterial('bone', { color: 0xddddcc, roughness: 0.4 });
    const engineerMat = createSurfaceMaterial('bone', { color: 0xc8d1dc, roughness: 0.25, metalness: 0.2 });
    const queenCrownMat = createSurfaceMaterial('chitin', { color: 0x1a1a24, metalness: 0.9, roughness: 0.2 });
    const laserMat = new THREE.MeshBasicMaterial({ color: 0x00d2ff, transparent: true, opacity: 0.8 });

    // Floor
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(24, 24, 1, 64), floorMat);
    floor.position.y = -0.5;
    this.citadelGroup.add(floor);

    // Glowing Neon Holographic Rings
    const ringGeo = new THREE.RingGeometry(21, 21.6, 96);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00d2ff, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.02;
    this.citadelGroup.add(ring);

    // Pillars with Yautja Glyphs
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.4, 14, 24), wallMat);
      pillar.position.set(Math.cos(angle) * 19, 7, Math.sin(angle) * 19);
      this.citadelGroup.add(pillar);
    }

    // 1. CENTERPIECE 1: PROMETHEUS / SPACE JOCKEY ENGINEER SKULL (LV-223)
    const engPedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.8, 2.4, 8), pedestalMat);
    engPedestal.position.set(0, 1.2, -8);
    this.citadelGroup.add(engPedestal);

    const engineerSkull = this.createEngineerSkull(engineerMat);
    engineerSkull.position.set(0, 3.2, -8);
    engineerSkull.scale.set(1.6, 1.6, 1.6);
    this.citadelGroup.add(engineerSkull);
    this.engineerSkull = engineerSkull;

    // 2. CENTERPIECE 2: XENOMORPH QUEEN CROWN TROPHY
    const queenPedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.8, 2.4, 8), pedestalMat);
    queenPedestal.position.set(-8, 1.2, 0);
    this.citadelGroup.add(queenPedestal);

    const queenCrown = this.createQueenCrownMesh(queenCrownMat);
    queenCrown.position.set(-8, 3.2, 0);
    this.citadelGroup.add(queenCrown);
    this.queenCrown = queenCrown;

    // 2B. CANON RELIC: RAPHAEL ADOLINI 1715 FLINTLOCK PISTOL (Predator 2 1990 / Prey 2022)
    const pistolPedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.1, 1.8, 8), pedestalMat);
    pistolPedestal.position.set(-5, 0.9, -5);
    this.citadelGroup.add(pistolPedestal);

    const pistolCase = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 0.8), new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.25, wireframe: true }));
    pistolCase.position.set(-5, 2.1, -5);
    this.citadelGroup.add(pistolCase);

    const flintlock = this.createFlintlockPistol();
    flintlock.position.set(-5, 2.1, -5);
    this.citadelGroup.add(flintlock);
    this.flintlock = flintlock;

    // 3. CENTERPIECE 3: LASER TROPHY CLEANING & POLISHING STATION (Predator 2 Lore)
    const stationPedestal = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 3.2), pedestalMat);
    stationPedestal.position.set(8, 0.8, 0);
    this.citadelGroup.add(stationPedestal);

    // Polishing Beam Arm
    const stationArm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.8, 6), wallMat);
    stationArm.position.set(8, 2.3, 0);
    stationArm.rotation.z = Math.PI / 4;
    this.citadelGroup.add(stationArm);
    this.stationArm = stationArm;

    // Sizzling Blue Laser Beam Polishing an Elite Skull
    const laserBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 6), laserMat);
    laserBeam.position.set(8.4, 2.0, 0);
    this.citadelGroup.add(laserBeam);
    this.laserBeam = laserBeam;

    const polishedSkull = createSkullTrophy('human', skullMat);
    polishedSkull.position.set(8.4, 1.9, 0);
    this.citadelGroup.add(polishedSkull);
    this.polishedSkull = polishedSkull;

    // 4. CENTERPIECE 4: TYRANNOSAURUS REX PREHISTORIC SKULL (Predator 2 Lore 1990)
    const trexPedestal = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.8, 2.2, 8), pedestalMat);
    trexPedestal.position.set(0, 1.1, 8);
    this.citadelGroup.add(trexPedestal);

    const trexSkull = this.createTRexSkull(skullMat);
    trexSkull.position.set(0, 3.2, 8);
    trexSkull.scale.set(1.8, 1.8, 1.8);
    this.citadelGroup.add(trexSkull);
    this.trexSkull = trexSkull;

    // 5. CENTERPIECE 5: HOLOGRAPHIC GALAXY STAR MAP (Predator 2 & Predators 2010 Lore)
    const galaxyMap = this.createHolographicGalaxyMap();
    this.citadelGroup.add(galaxyMap);

    // 6. CENTERPIECE 6: ELDER RITUAL OSTEOGLYPH INSCRIPTION SHRINE (AvP 2004 / Prey 2022 Lore)
    const shrine = this.createRitualInscriptionShrine();
    this.citadelGroup.add(shrine);

    // Standard Prey Skulls on Outer Pedestals
    const displayCount = Math.min(12, Math.max(4, skullCount));
    for (let i = 0; i < displayCount; i++) {
      const angle = (i / displayCount) * Math.PI * 2;
      const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 1.8, 8), pedestalMat);
      pedestal.position.set(Math.cos(angle) * 14, 0.9, Math.sin(angle) * 14);
      this.citadelGroup.add(pedestal);

      const skull = createSkullTrophy('human', skullMat);
      skull.position.set(Math.cos(angle) * 14, 2.1, Math.sin(angle) * 14);
      this.citadelGroup.add(skull);
    }
  }

  createRitualInscriptionShrine() {
    const group = new THREE.Group();
    group.position.set(-6, 0, 6);

    const altarMat = new THREE.MeshStandardMaterial({ color: 0x11161d, roughness: 0.9, metalness: 0.2 });
    const bronzeMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.3, metalness: 0.85 });
    const skullMat = new THREE.MeshStandardMaterial({ color: 0x1a202c, roughness: 0.2, metalness: 0.9 });
    const glyphMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xff7700, transparent: true, opacity: 0.8 });

    // Obsidian altar block
    const altar = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 1.8), altarMat);
    altar.position.y = 0.7;
    group.add(altar);

    // Bronze skull cradle
    const cradle = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 0.3, 8), bronzeMat);
    cradle.position.y = 1.55;
    group.add(cradle);

    // Xenomorph Warrior skull on cradle
    const xenoSkull = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 1.2, 8), skullMat);
    xenoSkull.rotation.x = Math.PI / 2.3;
    xenoSkull.position.set(0, 1.8, 0.2);
    group.add(xenoSkull);

    // Burning cuneiform Yautja clan glyphs on forehead
    this.shrineGlyphs = [];
    for (let g = 0; g < 3; g++) {
      const glyph = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.02), glyphMat);
      glyph.position.set(-0.08 + g * 0.08, 1.95, 0.55);
      glyph.rotation.x = -Math.PI / 6;
      group.add(glyph);
      this.shrineGlyphs.push(glyph);
    }

    // Overhead plasma burning stylus armature
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 6), bronzeMat);
    arm.position.set(0.4, 2.5, 0.4);
    arm.rotation.z = -Math.PI / 5;
    group.add(arm);
    this.shrineArm = arm;

    // Sizzling plasma engraving needle
    const needle = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.7, 6), beamMat);
    needle.position.set(0.05, 2.05, 0.55);
    needle.rotation.x = Math.PI / 6;
    group.add(needle);
    this.shrineNeedle = needle;

    return group;
  }

  createHolographicGalaxyMap() {
    const group = new THREE.Group();
    group.position.set(0, 0, 0);

    // Dark titanium pedestal with glowing stepped base
    const plinthMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9, roughness: 0.2 });
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.8, 0.8, 8), plinthMat);
    plinth.position.y = 0.4;
    group.add(plinth);

    // Glowing emitter ring on plinth
    const emitterRingMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
    const emitterRing = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.8, 16), emitterRingMat);
    emitterRing.rotation.x = -Math.PI / 2;
    emitterRing.position.y = 0.82;
    group.add(emitterRing);

    // Light projector cone beam extending upward
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x00d2ff,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide
    });
    const beam = new THREE.Mesh(new THREE.ConeGeometry(2.4, 3.8, 16, 1, true), beamMat);
    beam.position.y = 2.7;
    group.add(beam);
    this.holoBeam = beam;

    // Center of holographic globe
    const globeCenter = new THREE.Vector3(0, 4.6, 0);
    const globeGroup = new THREE.Group();
    globeGroup.position.copy(globeCenter);
    group.add(globeGroup);
    this.holoGlobe = globeGroup;

    // 1. Central Core Singularity
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 10), coreMat);
    globeGroup.add(core);

    // 2. Wireframe Celestial Sphere (The Known Galaxy)
    const sphereMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      wireframe: true,
      transparent: true,
      opacity: 0.35
    });
    const sphere = new THREE.Mesh(new THREE.IcosahedronGeometry(2.4, 2), sphereMat);
    globeGroup.add(sphere);
    this.holoSphere = sphere;

    // 3. Three Tilted Gyroscopic Orbit Rings
    this.holoRings = [];
    const ringColors = [0x00ffff, 0x38bdf8, 0x818cf8];
    const ringTilts = [
      new THREE.Euler(Math.PI / 6, 0, 0),
      new THREE.Euler(-Math.PI / 4, Math.PI / 3, 0),
      new THREE.Euler(0, -Math.PI / 3, Math.PI / 5)
    ];
    for (let r = 0; r < 3; r++) {
      const ringMesh = new THREE.Mesh(
        new THREE.TorusGeometry(2.1 + r * 0.25, 0.018, 4, 32),
        new THREE.MeshBasicMaterial({ color: ringColors[r], transparent: true, opacity: 0.7 })
      );
      ringMesh.rotation.copy(ringTilts[r]);
      globeGroup.add(ringMesh);
      this.holoRings.push(ringMesh);
    }

    // 4. Five Legendary Planetary Hunting Reserves
    this.holoPlanets = [];
    const planetsData = [
      { name: 'Yautja Prime', color: 0xf59e0b, radius: 2.1, speed: 0.55, size: 0.22, tilt: 0.2 },
      { name: 'LV-426 Acheron', color: 0x06b6d4, radius: 1.6, speed: 0.75, size: 0.18, tilt: -0.4 },
      { name: 'Xenomorph Prime', color: 0x22c55e, radius: 2.3, speed: 0.42, size: 0.26, tilt: 0.6 },
      { name: 'Earth 1715', color: 0x3b82f6, radius: 1.2, speed: 0.95, size: 0.16, tilt: -0.1 },
      { name: 'Station Renaissance', color: 0xa855f7, radius: 1.85, speed: 0.62, size: 0.15, tilt: 0.8 }
    ];

    planetsData.forEach((p, idx) => {
      const pGroup = new THREE.Group();
      const pMat = new THREE.MeshBasicMaterial({ color: p.color });
      const pMesh = new THREE.Mesh(new THREE.SphereGeometry(p.size, 8, 8), pMat);
      pGroup.add(pMesh);

      // Planetary beacon aura
      const auraMat = new THREE.MeshBasicMaterial({ color: p.color, transparent: true, opacity: 0.4, wireframe: true });
      const aura = new THREE.Mesh(new THREE.SphereGeometry(p.size * 1.5, 6, 6), auraMat);
      pGroup.add(aura);

      // Orbital indicator ring
      const orbitLine = new THREE.Mesh(
        new THREE.RingGeometry(p.radius - 0.01, p.radius + 0.01, 32),
        new THREE.MeshBasicMaterial({ color: p.color, transparent: true, opacity: 0.25, side: THREE.DoubleSide })
      );
      orbitLine.rotation.x = Math.PI / 2 + p.tilt;
      globeGroup.add(orbitLine);

      globeGroup.add(pGroup);
      this.holoPlanets.push({
        group: pGroup,
        radius: p.radius,
        speed: p.speed,
        angle: (idx / planetsData.length) * Math.PI * 2,
        tilt: p.tilt
      });
    });

    return group;
  }

  createTRexSkull(mat) {
    return createSkullTrophy('trex', mat);
  }

  createEngineerSkull(mat) {
    return createSkullTrophy('engineer', mat);
  }

  createQueenCrownMesh(mat) {
    return createSkullTrophy('queen', mat);
  }

  createFlintlockPistol() {
    const group = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.7 });
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.9, roughness: 0.2 });
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.95, roughness: 0.15 });

    // Curved Wooden Stock Grip
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.5), woodMat);
    stock.rotation.x = -Math.PI / 6;
    group.add(stock);

    // Octagonal Steel Barrel
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.7, 8), steelMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.1, 0.35);
    group.add(barrel);

    // Brass Lockplate & Hammer Flint
    const lockplate = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.2), brassMat);
    lockplate.position.set(0, 0.08, 0.1);
    group.add(lockplate);

    const hammer = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.12, 4), steelMat);
    hammer.position.set(0.07, 0.16, 0.05);
    hammer.rotation.z = -0.4;
    group.add(hammer);

    return group;
  }

  show() {
    this.citadelGroup.visible = true;
  }

  hide() {
    this.citadelGroup.visible = false;
  }

  update(delta) {
    if (!this.citadelGroup.visible) return;

    // Slow cinematic turntable showcase rotations
    if (this.engineerSkull) this.engineerSkull.rotation.y += 0.22 * delta;
    if (this.queenCrown) this.queenCrown.rotation.y += 0.28 * delta;
    if (this.trexSkull) this.trexSkull.rotation.y += 0.18 * delta;

    // Levitation and rotation of Raphael Adolini 1715 flintlock pistol
    if (this.flintlock) {
      this.flintlock.position.y = 2.1 + Math.sin(Date.now() * 0.0025) * 0.06;
      this.flintlock.rotation.y += 0.35 * delta;
    }

    // Oscillating trophy cleaning laser arm sweep
    const sweepAngle = Math.PI / 4 + Math.sin(Date.now() * 0.0035) * 0.22;
    if (this.stationArm) {
      this.stationArm.rotation.z = sweepAngle;
    }
    if (this.laserBeam) {
      this.laserBeam.position.x = 8.0 + Math.sin(sweepAngle) * 0.55;
      this.laserBeam.material.opacity = 0.55 + Math.random() * 0.4;
    }

    // Holographic Galaxy Star Map Celestial Globe Animation (Chantier 9)
    if (this.holoSphere) {
      this.holoSphere.rotation.y += 0.25 * delta;
      this.holoSphere.rotation.x += 0.12 * delta;
    }
    if (this.holoRings) {
      this.holoRings.forEach((r, idx) => {
        r.rotation.z += (0.2 + idx * 0.15) * delta;
      });
    }
    if (this.holoPlanets) {
      this.holoPlanets.forEach(p => {
        p.angle += p.speed * delta;
        p.group.position.set(
          Math.cos(p.angle) * p.radius,
          Math.sin(p.angle) * p.radius * Math.sin(p.tilt),
          Math.sin(p.angle) * p.radius * Math.cos(p.tilt)
        );
      });
    }
    if (this.holoBeam) {
      this.holoBeam.material.opacity = 0.14 + Math.sin(Date.now() * 0.004) * 0.06;
    }

    // Elder Ritual Inscription Stylus & Glyphs Animation (Chantier 10)
    if (this.shrineArm && this.shrineNeedle) {
      const scribeAngle = -Math.PI / 5 + Math.sin(Date.now() * 0.006) * 0.12;
      this.shrineArm.rotation.z = scribeAngle;
      this.shrineNeedle.position.x = 0.05 + Math.sin(Date.now() * 0.006) * 0.08;
      this.shrineNeedle.material.opacity = 0.45 + Math.random() * 0.55;
    }
    if (this.shrineGlyphs) {
      const glow = 0.65 + Math.sin(Date.now() * 0.005) * 0.35;
      this.shrineGlyphs.forEach((g, gIdx) => {
        g.scale.set(1.0, 1.0 + Math.sin(Date.now() * 0.008 + gIdx) * 0.15, 1.0);
      });
    }
  }
}
