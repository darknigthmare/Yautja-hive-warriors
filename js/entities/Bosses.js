/* Mythic Boss Raid Manager (Predalien Queen & Flying Empress Matriarch) */

import * as THREE from 'three';

export class BossManager {
  constructor(scene, audioEngine) {
    this.scene = scene;
    this.audioEngine = audioEngine;
    this.activeBoss = null;
    this.acidSpitProjectiles = [];
    this.embryoProjectiles = [];
  }

  spawnBoss(type, spawnPos) {
    if (this.activeBoss) {
      this.scene.remove(this.activeBoss.mesh);
    }

    const mesh = this.createBossMesh(type);
    mesh.position.copy(spawnPos);
    this.scene.add(mesh);

    const isRogueKing = type === 'rogue_king_prime';
    const isEngineer = type === 'awakened_engineer';
    const isMatriarchTitan = type === 'predalien_matriarch_titan';
    const isImperial = type === 'imperial_queen';
    const isEmpress = type === 'empress_matriarch';
    const isPredalienQueen = type === 'predalien_queen';
    const isPredalienAbomination = type === 'predalien_abomination';
    const isOffspring = type === 'the_offspring';
    const isTrilobite = type === 'trilobite_prime';
    const isBerserker = type === 'berserker_super_predator';
    const isUltimateUpgrade = type === 'ultimate_upgrade_predator';
    const isApexGladiator = type === 'apex_gladiator_predator';
    const isFeralPredator = type === 'feral_predator_boss';

    const hp = isMatriarchTitan ? 10000 : (isRogueKing ? 9500 : (isUltimateUpgrade ? 9200 : (isApexGladiator ? 9000 : (isBerserker ? 8800 : (isFeralPredator ? 8600 : (isEngineer ? 8500 : (isImperial ? 8000 : (isTrilobite ? 7000 : (isPredalienAbomination ? 6500 : (isEmpress ? 6000 : (isPredalienQueen ? 5000 : (isOffspring ? 4500 : 3000))))))))))));

    this.activeBoss = {
      type: type,
      mesh: mesh,
      hp: hp,
      maxHp: hp,
      isStunned: false,
      stunTimer: 0,
      phase: 1,
      spineRipAvailable: false,
      hasPhaseShield: false,
      phaseShieldHp: 1800,
      vortexCooldown: 5.0,
      stompCooldown: 3.5,
      chargeCooldown: 4.5,
      pheromoneCooldown: 6.0,
      isCharging: false,
      chargeTimer: 0
    };

    if (isFeralPredator) {
      if (this.audioEngine.playFeralPredatorPrimalRoar) this.audioEngine.playFeralPredatorPrimalRoar();
    } else if (isUltimateUpgrade) {
      if (this.audioEngine.playUltimatePredatorRoar) this.audioEngine.playUltimatePredatorRoar();
    } else if (isRogueKing) {
      if (this.audioEngine.playRogueKingEarthquakeRoar) this.audioEngine.playRogueKingEarthquakeRoar();
      if (this.audioEngine.playYautjaRoar) this.audioEngine.playYautjaRoar();
    } else if (isEngineer) {
      if (this.audioEngine.playEngineerAwakeningRoar) this.audioEngine.playEngineerAwakeningRoar();
      if (this.audioEngine.playYautjaRoar) this.audioEngine.playYautjaRoar();
    } else if (isMatriarchTitan) {
      if (this.audioEngine.playPredalienBellyVomit) this.audioEngine.playPredalienBellyVomit();
      if (this.audioEngine.playRogueKingRoar) this.audioEngine.playRogueKingRoar();
      if (this.audioEngine.playYautjaRoar) this.audioEngine.playYautjaRoar();
    } else if (isTrilobite && this.audioEngine.playTrilobiteTentacleConstrict) {
      this.audioEngine.playTrilobiteTentacleConstrict();
      if (this.audioEngine.playYautjaRoar) this.audioEngine.playYautjaRoar();
    } else if (isOffspring) {
      this.audioEngine.playOffspringShriek();
    } else if (isPredalienAbomination && this.audioEngine.playPredalienBellyVomit) {
      this.audioEngine.playPredalienBellyVomit();
      if (this.audioEngine.playYautjaRoar) this.audioEngine.playYautjaRoar();
    } else {
      this.audioEngine.playYautjaRoar();
    }
  }

  buildTrilobiteMesh(scale = 2.6) {
    const group = new THREE.Group();

    // Pale leathery cephalopod texture with subtle translucency (Prometheus 2012)
    const mantleMat = new THREE.MeshStandardMaterial({
      color: 0xe5e2da,
      roughness: 0.55,
      metalness: 0.05
    });
    const foldMat = new THREE.MeshStandardMaterial({
      color: 0xcdc9bd,
      roughness: 0.65,
      metalness: 0.08
    });
    const visceralMat = new THREE.MeshStandardMaterial({
      color: 0x9f1239,
      roughness: 0.35,
      metalness: 0.2
    });
    const suckerMat = new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      roughness: 0.25,
      metalness: 0.1
    });
    const beakMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.2,
      metalness: 0.85
    });

    // 1. Central Mantle Dome (flattened bulbous cephalopod body)
    const mantle = new THREE.Mesh(new THREE.SphereGeometry(1.5 * scale, 16, 14), mantleMat);
    mantle.scale.set(1.4, 0.75, 1.6);
    mantle.position.y = 1.6 * scale;
    group.add(mantle);

    // Ribbed dorsal folds across the mantle
    for (let r = 0; r < 5; r++) {
      const fold = new THREE.Mesh(new THREE.TorusGeometry((1.2 - r * 0.15) * scale, 0.12 * scale, 6, 16), foldMat);
      fold.rotation.x = Math.PI / 2;
      fold.position.set(0, (1.8 + r * 0.12) * scale, (-0.6 + r * 0.35) * scale);
      fold.scale.set(1.3, 0.6, 1.0);
      group.add(fold);
    }

    // 2. Underside Oral Beak & Sphincter Cavity
    const sphincter = new THREE.Mesh(new THREE.TorusGeometry(0.55 * scale, 0.18 * scale, 8, 16), visceralMat);
    sphincter.rotation.x = Math.PI / 2;
    sphincter.position.set(0, 0.9 * scale, 0.2 * scale);
    group.add(sphincter);

    // Quad-Keratin Beak Teeth (Radial biting mandibles inside mouth)
    for (let b = 0; b < 4; b++) {
      const ang = (b / 4) * Math.PI * 2;
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.08 * scale, 0.38 * scale, 4), beakMat);
      tooth.position.set(Math.cos(ang) * 0.35 * scale, 0.9 * scale, 0.2 * scale + Math.sin(ang) * 0.35 * scale);
      tooth.rotation.z = -Math.cos(ang) * 0.7;
      tooth.rotation.x = Math.sin(ang) * 0.7;
      group.add(tooth);
    }

    // 3. 7 Articulated Muscular Cephalopod Tentacles (Prometheus 2012 1:1 Canon)
    const tentacles = [];
    const tentacleAngles = [0, 0.9, 1.8, 2.7, 3.6, 4.5, 5.4]; // 7 distinct radial tentacle roots

    tentacleAngles.forEach((ang, tIdx) => {
      const tentRoot = new THREE.Group();
      const rootX = Math.cos(ang) * 1.3 * scale;
      const rootZ = Math.sin(ang) * 1.4 * scale;
      tentRoot.position.set(rootX, 1.2 * scale, rootZ);

      const segments = [];
      let parentGroup = tentRoot;
      const numSegments = 5;

      for (let s = 0; s < numSegments; s++) {
        const segGroup = new THREE.Group();
        const segRadius = (0.24 - s * 0.035) * scale;
        const segLength = (1.5 - s * 0.12) * scale;

        const segMesh = new THREE.Mesh(new THREE.CylinderGeometry(segRadius * 0.8, segRadius, segLength, 8), mantleMat);
        segMesh.position.y = -segLength / 2;
        segGroup.add(segMesh);

        // Suction cup rings along the underside
        for (let u = 0; u < 2; u++) {
          const sucker = new THREE.Mesh(new THREE.TorusGeometry(segRadius * 0.35, segRadius * 0.1, 4, 8), suckerMat);
          sucker.position.set(0, -segLength * (0.3 + u * 0.4), segRadius * 0.75);
          sucker.rotation.x = Math.PI / 2;
          segGroup.add(sucker);
        }

        if (s === 0) {
          segGroup.rotation.y = ang;
          segGroup.rotation.z = 0.55;
        } else {
          segGroup.position.y = -segLength;
          segGroup.rotation.z = -0.15;
        }

        parentGroup.add(segGroup);
        parentGroup = segGroup;
        segments.push(segGroup);
      }

      group.add(tentRoot);
      tentacles.push({ root: tentRoot, segments });
    });

    group.userData.tentacles = tentacles;
    return group;
  }

  /* === CHANTIER 3 (v51.0): Mala'kak Awakened Engineer Titan Boss Mesh (Prometheus 2012 / Fire & Stone) === */
  buildEngineerTitanMesh(scale = 2.7) {
    const group = new THREE.Group();

    // Biomechanical pressure suit materials (dark ribbed obsidian alloy)
    const suitMat = new THREE.MeshStandardMaterial({
      color: 0x1f242c,
      metalness: 0.88,
      roughness: 0.25
    });

    // Pale alabaster marble flesh material (Prometheus Mala'kak phenotype)
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xdde0e6,
      metalness: 0.1,
      roughness: 0.45
    });

    // Flexible corrugated breathing hose material
    const pipeMat = new THREE.MeshStandardMaterial({
      color: 0x11141a,
      metalness: 0.95,
      roughness: 0.15
    });

    // Gravitational resonance staff alloy
    const staffMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.92,
      roughness: 0.2
    });

    // Glowing Gravimetric Core Orb
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 1.4,
      metalness: 0.2,
      roughness: 0.1,
      transparent: true,
      opacity: 0.95
    });

    // 1. Muscular Torso & Ribbed Abdominal Armor
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.7 * scale, 0.5 * scale, 1.8 * scale, 10), suitMat);
    torso.position.y = 2.4 * scale;
    group.add(torso);

    // Ribbed chest plates
    for (let r = 0; r < 5; r++) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(0.55 * scale - r * 0.03 * scale, 0.04 * scale, 6, 12, Math.PI), pipeMat);
      rib.position.set(0, 2.7 * scale - r * 0.18 * scale, 0.25 * scale);
      rib.rotation.x = Math.PI / 2;
      group.add(rib);
    }

    // 2. Head with Classical Sculpted Face & Bald Cranium
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.38 * scale, 14, 14), skinMat);
    head.position.set(0, 3.55 * scale, 0.08 * scale);
    head.scale.set(0.9, 1.15, 0.95);
    group.add(head);

    // Dark void eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x05070a });
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.06 * scale, 6, 6), eyeMat);
    eyeL.position.set(-0.12 * scale, 3.65 * scale, 0.38 * scale);
    group.add(eyeL);
    const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.06 * scale, 6, 6), eyeMat);
    eyeR.position.set(0.12 * scale, 3.65 * scale, 0.38 * scale);
    group.add(eyeR);

    // 3. Iconic Biomechanical Elephantine Breathing Trunk / Helmet Hose
    const trunkSegments = 7;
    for (let i = 0; i < trunkSegments; i++) {
      const tProgress = i / trunkSegments;
      const tGeo = new THREE.CylinderGeometry((0.1 - tProgress * 0.03) * scale, (0.09 - tProgress * 0.03) * scale, 0.18 * scale, 8);
      const tMesh = new THREE.Mesh(tGeo, pipeMat);
      const angle = Math.PI * 0.45 * tProgress;
      tMesh.position.set(0, 3.4 * scale - i * 0.14 * scale, 0.35 * scale + Math.sin(angle) * 0.22 * scale);
      tMesh.rotation.x = 0.35 - tProgress * 0.7;
      group.add(tMesh);
    }

    // 4. Massive Shoulders and Pauldrons
    const pauldronGeo = new THREE.SphereGeometry(0.42 * scale, 8, 8);
    const pauldronL = new THREE.Mesh(pauldronGeo, suitMat);
    pauldronL.position.set(-0.85 * scale, 3.0 * scale, 0);
    group.add(pauldronL);
    const pauldronR = new THREE.Mesh(pauldronGeo, suitMat);
    pauldronR.position.set(0.85 * scale, 3.0 * scale, 0);
    group.add(pauldronR);

    // 5. Massive Armored Legs
    const legGeo = new THREE.CylinderGeometry(0.24 * scale, 0.18 * scale, 1.6 * scale, 8);
    const legL = new THREE.Mesh(legGeo, suitMat);
    legL.position.set(-0.35 * scale, 0.8 * scale, 0);
    group.add(legL);
    const legR = new THREE.Mesh(legGeo, suitMat);
    legR.position.set(0.35 * scale, 0.8 * scale, 0);
    group.add(legR);

    // 6. Right Arm Holding Gravitational Resonance Staff
    const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * scale, 0.15 * scale, 1.4 * scale, 8), suitMat);
    armR.position.set(0.85 * scale, 2.2 * scale, 0.3 * scale);
    armR.rotation.x = -0.4;
    group.add(armR);

    // The Gravitational Resonance Staff (3.6m tall)
    const staffGroup = new THREE.Group();
    staffGroup.position.set(0.95 * scale, 1.9 * scale, 0.85 * scale);

    const staffShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * scale, 0.05 * scale, 3.8 * scale, 8), staffMat);
    staffGroup.add(staffShaft);

    // Staff top concentric gravimetric rings
    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.25 * scale, 0.03 * scale, 6, 16), staffMat);
    ring1.position.y = 1.7 * scale;
    ring1.rotation.x = Math.PI / 2;
    staffGroup.add(ring1);

    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.18 * scale, 0.025 * scale, 6, 16), staffMat);
    ring2.position.y = 1.7 * scale;
    ring2.rotation.y = Math.PI / 2;
    staffGroup.add(ring2);

    // Central Pulsating Gravimetric Singularity Orb
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.14 * scale, 12, 12), coreMat);
    orb.position.y = 1.7 * scale;
    staffGroup.add(orb);

    group.add(staffGroup);
    group.userData.staffGroup = staffGroup;
    group.userData.staffOrb = orb;

    // 7. Biomechanical Phase Shield (Translucent cyan dodecahedron)
    const shieldGeo = new THREE.DodecahedronGeometry(2.4 * scale, 1);
    const shieldMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      wireframe: true,
      transparent: true,
      opacity: 0.4
    });
    const phaseShield = new THREE.Mesh(shieldGeo, shieldMat);
    phaseShield.position.y = 2.2 * scale;
    phaseShield.visible = false;
    group.add(phaseShield);
    group.userData.phaseShield = phaseShield;

    return group;
  }

  /* === CHANTIER 7 (v55.0): Bad Blood Berserker Super Predator Boss Mesh (Predators 2010 Mr. Black Canon) === */
  buildBerserkerPredatorMesh(scale = 2.6) {
    const group = new THREE.Group();

    // Reptilian scaly skin material
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0x333b26, // Dark olive-moss mottled reptilian flesh
      roughness: 0.65,
      metalness: 0.25
    });

    // Dark gunmetal armor material
    const armorMat = new THREE.MeshStandardMaterial({
      color: 0x1f2421,
      roughness: 0.35,
      metalness: 0.85
    });

    // Bone jawbone material
    const boneMat = new THREE.MeshStandardMaterial({
      color: 0xe2ded2, // Carved bleached Xenomorph mandible
      roughness: 0.45,
      metalness: 0.15
    });

    // 1. Muscular Torso & Spiked Cuirass
    const torso = new THREE.Mesh(new THREE.BoxGeometry(1.4 * scale, 1.8 * scale, 1.0 * scale), armorMat);
    torso.position.y = 2.4 * scale;
    group.add(torso);

    // 2. Distinctive Mr. Black Bio-Mask
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.85 * scale, 1.1 * scale, 0.9 * scale), armorMat);
    head.position.set(0, 3.6 * scale, 0.2 * scale);
    group.add(head);

    // Flayed Xenomorph Lower Jawbone attached to chin
    const jawbone = new THREE.Mesh(new THREE.TorusGeometry(0.48 * scale, 0.1 * scale, 6, 12, Math.PI), boneMat);
    jawbone.rotation.x = Math.PI / 2;
    jawbone.position.set(0, 3.25 * scale, 0.45 * scale);
    group.add(jawbone);

    // Red Tri-Laser Eye Visor
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0033 });
    const eyeLens = new THREE.Mesh(new THREE.BoxGeometry(0.55 * scale, 0.12 * scale, 0.08 * scale), eyeMat);
    eyeLens.position.set(0, 3.65 * scale, 0.68 * scale);
    group.add(eyeLens);

    // 3. Thick Crimson & Charcoal Dreadlocks
    const dreadMat = new THREE.MeshStandardMaterial({ color: 0x1a0505, roughness: 0.8 });
    for (let d = 0; d < 14; d++) {
      const dread = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * scale, 0.04 * scale, 1.6 * scale, 5), dreadMat);
      const angle = (d / 14) * Math.PI - Math.PI / 2;
      dread.position.set(Math.cos(angle) * 0.45 * scale, 3.4 * scale, -0.45 * scale);
      dread.rotation.set(-0.6, 0, Math.sin(angle) * 0.4);
      group.add(dread);
    }

    // 4. Shoulder Rotary Gatling Plasma Caster
    const gunGroup = new THREE.Group();
    gunGroup.position.set(-0.75 * scale, 3.5 * scale, -0.2 * scale);
    const gunBase = new THREE.Mesh(new THREE.BoxGeometry(0.35 * scale, 0.35 * scale, 0.6 * scale), armorMat);
    gunGroup.add(gunBase);
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9 });
    for (let b = 0; b < 3; b++) {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.04 * scale, 0.04 * scale, 0.8 * scale, 6), barrelMat);
      barrel.rotation.x = Math.PI / 2;
      const bAngle = (b / 3) * Math.PI * 2;
      barrel.position.set(Math.cos(bAngle) * 0.08 * scale, Math.sin(bAngle) * 0.08 * scale, 0.4 * scale);
      gunGroup.add(barrel);
    }
    group.add(gunGroup);

    // 5. Right Arm with Colossal Extended Wristblade
    const armR = new THREE.Mesh(new THREE.BoxGeometry(0.35 * scale, 1.4 * scale, 0.4 * scale), skinMat);
    armR.position.set(0.95 * scale, 2.5 * scale, 0.2 * scale);
    group.add(armR);

    const bladeMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.95, roughness: 0.1 });
    const wristblade = new THREE.Mesh(new THREE.BoxGeometry(0.12 * scale, 0.04 * scale, 2.8 * scale), bladeMat);
    wristblade.position.set(1.05 * scale, 1.8 * scale, 1.5 * scale);
    group.add(wristblade);

    // Left Arm
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.35 * scale, 1.4 * scale, 0.4 * scale), skinMat);
    armL.position.set(-0.95 * scale, 2.5 * scale, 0.2 * scale);
    group.add(armL);

    // 6. Heavy Legs & Greaves
    const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.24 * scale, 0.18 * scale, 1.8 * scale, 6), armorMat);
    legL.position.set(-0.45 * scale, 0.9 * scale, 0);
    group.add(legL);

    const legR = new THREE.Mesh(new THREE.CylinderGeometry(0.24 * scale, 0.18 * scale, 1.8 * scale, 6), armorMat);
    legR.position.set(0.45 * scale, 0.9 * scale, 0);
    group.add(legR);

    return group;
  }

  /* === PREY (2022): 3.1m Feral Predator Primordial Archaic Hunter Boss Mesh === */
  buildFeralPredatorMesh(scale = 2.9) {
    const group = new THREE.Group();

    // Pale leathery reptilian flesh
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0x4a4738,
      roughness: 0.72,
      metalness: 0.2
    });

    // Primitive carved bone skull mask
    const boneMat = new THREE.MeshStandardMaterial({
      color: 0xd6d3d1,
      roughness: 0.45,
      metalness: 0.15
    });

    // Dark obsidian volcanic glass
    const obsidianMat = new THREE.MeshStandardMaterial({
      color: 0x09090b,
      roughness: 0.08,
      metalness: 0.95
    });

    const leatherMat = new THREE.MeshStandardMaterial({
      color: 0x271c14,
      roughness: 0.85
    });

    // 1. Muscular Torso & Dorsal Spine Ridges
    const torso = new THREE.Mesh(new THREE.BoxGeometry(1.4 * scale, 1.8 * scale, 0.95 * scale), skinMat);
    torso.position.y = 2.2 * scale;
    torso.castShadow = true;
    group.add(torso);

    for (let s = 0; s < 5; s++) {
      const spine = new THREE.Mesh(new THREE.ConeGeometry(0.08 * scale, 0.35 * scale, 4), boneMat);
      spine.rotation.x = -Math.PI / 3;
      spine.position.set(0, (1.6 + s * 0.3) * scale, -0.52 * scale);
      group.add(spine);
    }

    // 2. Feral Head, Exposed Animalistic Lower Mandibles & Carved Bone Skull Mask
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.75 * scale, 0.9 * scale, 0.85 * scale), skinMat);
    head.position.set(0, 3.4 * scale, 0.15 * scale);
    group.add(head);

    const boneMask = new THREE.Mesh(new THREE.BoxGeometry(0.82 * scale, 0.55 * scale, 0.65 * scale), boneMat);
    boneMask.position.set(0, 3.6 * scale, 0.32 * scale);
    group.add(boneMask);

    [-0.28, 0.28].forEach(mx => {
      const mand = new THREE.Mesh(new THREE.ConeGeometry(0.08 * scale, 0.45 * scale, 4), boneMat);
      mand.rotation.x = Math.PI / 4;
      mand.rotation.z = mx > 0 ? -0.4 : 0.4;
      mand.position.set(mx * scale, 3.1 * scale, 0.48 * scale);
      group.add(mand);
    });

    const laserAperture = new THREE.Mesh(new THREE.CylinderGeometry(0.04 * scale, 0.04 * scale, 0.15 * scale, 6), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
    laserAperture.rotation.x = Math.PI / 2;
    laserAperture.position.set(-0.35 * scale, 3.65 * scale, 0.62 * scale);
    group.add(laserAperture);

    // 3. Right Arm: Telescopic Obsidian Spear / Cut Blade
    const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.4 * scale, 1.5 * scale, 0.45 * scale), skinMat);
    rightArm.position.set(0.95 * scale, 2.1 * scale, 0);
    group.add(rightArm);

    const spearShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * scale, 0.05 * scale, 2.6 * scale, 8), leatherMat);
    spearShaft.position.set(1.05 * scale, 2.0 * scale, 0.3 * scale);
    spearShaft.rotation.x = Math.PI / 3;
    group.add(spearShaft);

    const spearTip = new THREE.Mesh(new THREE.ConeGeometry(0.12 * scale, 0.8 * scale, 4), obsidianMat);
    spearTip.position.set(1.05 * scale, 2.9 * scale, 0.9 * scale);
    spearTip.rotation.x = Math.PI / 3;
    group.add(spearTip);

    // 4. Left Arm: Folding Expanding Bone Fan Shield on Forearm
    const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.4 * scale, 1.5 * scale, 0.45 * scale), skinMat);
    leftArm.position.set(-0.95 * scale, 2.1 * scale, 0);
    group.add(leftArm);

    const shieldPlate = new THREE.Mesh(new THREE.BoxGeometry(0.18 * scale, 1.2 * scale, 0.85 * scale), boneMat);
    shieldPlate.position.set(-1.18 * scale, 1.8 * scale, 0.25 * scale);
    group.add(shieldPlate);

    // 5. Powerful Digigrade Legs & Archaic Loincloth
    [-0.45, 0.45].forEach(lx => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.48 * scale, 1.8 * scale, 0.52 * scale), skinMat);
      leg.position.set(lx * scale, 0.9 * scale, 0);
      leg.castShadow = true;
      group.add(leg);
    });

    const loincloth = new THREE.Mesh(new THREE.BoxGeometry(1.1 * scale, 0.8 * scale, 0.65 * scale), leatherMat);
    loincloth.position.set(0, 1.4 * scale, 0);
    group.add(loincloth);

    group.castShadow = true;
    return group;
  }

  /* === PREDATOR: KILLER OF KILLERS (2025): 3.2m Apex Gladiator Grandmaster Predator Boss Mesh === */
  buildApexGladiatorMesh(scale = 3.2) {
    const group = new THREE.Group();

    const skinMat = new THREE.MeshStandardMaterial({
      color: 0x2e2d29,
      roughness: 0.65,
      metalness: 0.25
    });

    const armorMat = new THREE.MeshStandardMaterial({
      color: 0xd97706, // Regal Gold Ancient Armor
      roughness: 0.28,
      metalness: 0.88
    });

    const obsidianMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.15,
      metalness: 0.92
    });

    const plasmaGlowMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8
    });

    // 1. Massive Colosseum Armor Torso & Royal Pauldrons
    const torso = new THREE.Mesh(new THREE.BoxGeometry(1.5 * scale, 1.8 * scale, 1.1 * scale), armorMat);
    torso.position.y = 2.4 * scale;
    torso.castShadow = true;
    group.add(torso);

    [-0.95, 0.95].forEach(px => {
      const pauldron = new THREE.Mesh(new THREE.BoxGeometry(0.75 * scale, 0.45 * scale, 0.85 * scale), armorMat);
      pauldron.position.set(px * scale, 3.1 * scale, 0);
      group.add(pauldron);
    });

    // 2. Ceremonial Battle Skirt / Cape (Imperial Purple)
    const capeMat = new THREE.MeshStandardMaterial({ color: 0x4c1d95, roughness: 0.85 });
    const cape = new THREE.Mesh(new THREE.BoxGeometry(1.4 * scale, 1.6 * scale, 0.15 * scale), capeMat);
    cape.position.set(0, 1.7 * scale, -0.55 * scale);
    group.add(cape);

    // 3. Ancient Bio-Mask with Horned Crest & 3 Red Optic Lenses
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.85 * scale, 0.95 * scale, 0.95 * scale), obsidianMat);
    head.position.set(0, 3.45 * scale, 0.2 * scale);
    group.add(head);

    [-0.35, 0.35].forEach(hx => {
      const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.04 * scale, 0.12 * scale, 0.8 * scale, 6), armorMat);
      horn.position.set(hx * scale, 4.0 * scale, -0.1 * scale);
      horn.rotation.z = hx < 0 ? -0.5 : 0.5;
      group.add(horn);
    });

    // Tri-Laser Optics
    const triLaserLight = new THREE.PointLight(0xef4444, 2.0, 8.0);
    triLaserLight.position.set(0, 3.45 * scale, 0.7 * scale);
    group.add(triLaserLight);

    // Dreadlocks (Heavy Golden Ring Clamps)
    for (let d = -4; d <= 4; d++) {
      const dread = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * scale, 0.04 * scale, 1.5 * scale, 6), skinMat);
      dread.position.set((d * 0.14) * scale, 3.0 * scale, -0.45 * scale);
      dread.rotation.x = -0.3;
      group.add(dread);
    }

    // 4. Dual Forearm Plasma Glaives (Left & Right)
    [-0.95, 0.95].forEach(ax => {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.42 * scale, 1.4 * scale, 0.45 * scale), skinMat);
      arm.position.set(ax * scale, 2.3 * scale, 0);
      group.add(arm);

      // Curved Double-Edged Plasma Glaive
      const glaive = new THREE.Mesh(new THREE.BoxGeometry(0.08 * scale, 1.9 * scale, 0.22 * scale), obsidianMat);
      glaive.position.set(ax * scale, 2.2 * scale, 0.55 * scale);
      group.add(glaive);

      const edgeGlow = new THREE.Mesh(new THREE.BoxGeometry(0.04 * scale, 1.8 * scale, 0.05 * scale), plasmaGlowMat);
      edgeGlow.position.set(ax * scale, 2.2 * scale, 0.68 * scale);
      group.add(edgeGlow);
    });

    // 5. Heavy Armored Legs & Greaves
    [-0.45, 0.45].forEach(lx => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.52 * scale, 1.9 * scale, 0.55 * scale), armorMat);
      leg.position.set(lx * scale, 0.95 * scale, 0);
      leg.castShadow = true;
      group.add(leg);
    });

    group.castShadow = true;
    return group;
  }

  /* === THE PREDATOR (2018): 3.3m Ultimate Upgrade Genetically Hybridized Predator Boss Mesh === */
  buildUltimatePredatorMesh(scale = 3.3) {
    const group = new THREE.Group();

    // Genetically modified armored dermal exoskeleton
    const dermalMat = new THREE.MeshStandardMaterial({
      color: 0x1e2024,
      roughness: 0.42,
      metalness: 0.65
    });

    // Dark carbonized chitin carapace plates
    const carapaceMat = new THREE.MeshStandardMaterial({
      color: 0x111317,
      roughness: 0.28,
      metalness: 0.85
    });

    // Bone / razor tooth material
    const fangMat = new THREE.MeshStandardMaterial({
      color: 0xf3f4f6,
      roughness: 0.35,
      metalness: 0.1
    });

    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0xa1a1aa,
      metalness: 0.95,
      roughness: 0.15
    });

    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      metalness: 0.9,
      roughness: 0.2
    });

    // 1. Colossal Muscular Torso & Armored Dermal Carapace
    const torso = new THREE.Mesh(new THREE.BoxGeometry(1.6 * scale, 2.0 * scale, 1.1 * scale), dermalMat);
    torso.position.y = 2.4 * scale;
    torso.castShadow = true;
    group.add(torso);

    const chestPlates = new THREE.Mesh(new THREE.BoxGeometry(1.4 * scale, 1.2 * scale, 0.3 * scale), carapaceMat);
    chestPlates.position.set(0, 2.7 * scale, 0.6 * scale);
    group.add(chestPlates);

    // 2. Unmasked Terrifying Genetic Head & Flared Mandibles
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.9 * scale, 1.1 * scale, 1.0 * scale), dermalMat);
    head.position.set(0, 3.7 * scale, 0.2 * scale);
    group.add(head);

    // 4 Flared Mandibles
    [
      { x: -0.38, y: 3.35, z: 0.55, rx: 0.4, ry: 0.5 },
      { x: 0.38, y: 3.35, z: 0.55, rx: 0.4, ry: -0.5 },
      { x: -0.42, y: 3.15, z: 0.5, rx: -0.3, ry: 0.4 },
      { x: 0.42, y: 3.15, z: 0.5, rx: -0.3, ry: -0.4 }
    ].forEach(m => {
      const mand = new THREE.Mesh(new THREE.ConeGeometry(0.12 * scale, 0.55 * scale, 5), fangMat);
      mand.position.set(m.x * scale, m.y * scale, m.z * scale);
      mand.rotation.set(m.rx, m.ry, 0);
      group.add(mand);
    });

    // Glowing Piercing Amber Eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    [-0.22, 0.22].forEach(ex => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07 * scale, 6, 6), eyeMat);
      eye.position.set(ex * scale, 3.8 * scale, 0.72 * scale);
      group.add(eye);
    });

    // 3. Thick Heavy Dreadlocks with Tribal Brass Clasps
    const dreadMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.75 });
    for (let d = 0; d < 18; d++) {
      const dread = new THREE.Mesh(new THREE.CylinderGeometry(0.065 * scale, 0.04 * scale, 1.8 * scale, 6), dreadMat);
      const angle = (d / 18) * Math.PI - Math.PI / 2;
      dread.position.set(Math.cos(angle) * 0.52 * scale, 3.5 * scale, -0.4 * scale);
      dread.rotation.set(-0.55, 0, Math.sin(angle) * 0.4);
      group.add(dread);

      if (d % 3 === 0) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.07 * scale, 0.02 * scale, 4, 8), brassMat);
        ring.position.set(Math.cos(angle) * 0.52 * scale, 3.1 * scale, -0.55 * scale);
        group.add(ring);
      }
    }

    // 4. Heavy Shoulder Plasma Cannon Mount
    const gunPod = new THREE.Mesh(new THREE.BoxGeometry(0.4 * scale, 0.35 * scale, 0.8 * scale), carapaceMat);
    gunPod.position.set(-0.85 * scale, 3.5 * scale, -0.1 * scale);
    group.add(gunPod);

    const gunBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.08 * scale, 0.08 * scale, 1.0 * scale, 8), carapaceMat);
    gunBarrel.rotation.x = Math.PI / 2;
    gunBarrel.position.set(-0.85 * scale, 3.5 * scale, 0.45 * scale);
    group.add(gunBarrel);

    // 5. Dual Forearms with Integrated Retractable Heavy Blades
    [-1, 1].forEach(side => {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.4 * scale, 1.6 * scale, 0.45 * scale), dermalMat);
      arm.position.set(side * 1.05 * scale, 2.5 * scale, 0.2 * scale);
      group.add(arm);

      const gauntlet = new THREE.Mesh(new THREE.BoxGeometry(0.46 * scale, 0.8 * scale, 0.5 * scale), carapaceMat);
      gauntlet.position.set(side * 1.05 * scale, 2.0 * scale, 0.2 * scale);
      group.add(gauntlet);

      const dualBlade = new THREE.Mesh(new THREE.BoxGeometry(0.1 * scale, 0.04 * scale, 2.4 * scale), bladeMat);
      dualBlade.position.set(side * 1.15 * scale, 1.8 * scale, 1.4 * scale);
      group.add(dualBlade);
    });

    // 6. Colossal Muscular Legs & Armored Greaves
    [-0.5, 0.5].forEach(lx => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.28 * scale, 0.2 * scale, 2.0 * scale, 8), carapaceMat);
      leg.position.set(lx * scale, 1.0 * scale, 0);
      leg.castShadow = true;
      group.add(leg);
    });

    return group;
  }

  /* === CHANTIER 2 (v52.0): Rogue King Xenomorph Prime Boss Mesh (Aliens: Rogue 1993 Lore) === */
  buildRogueKingMesh(scale = 3.2) {
    const group = new THREE.Group();

    // Dark lustrous obsidian biomechanical chitin
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x090d14,
      metalness: 0.92,
      roughness: 0.16
    });

    // Barbed Horn & Crest Material
    const hornMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.95,
      roughness: 0.12
    });

    // 1. Massive Armored Skull & Flared Horned Crown
    const headGeo = new THREE.BoxGeometry(1.3 * scale, 0.9 * scale, 3.8 * scale);
    const head = new THREE.Mesh(headGeo, bodyMat);
    head.position.set(0, 3.6 * scale, 0.6 * scale);
    group.add(head);

    // Flared Hexagonal King Crown
    const crownGeo = new THREE.ConeGeometry(2.6 * scale, 4.0 * scale, 6);
    const crown = new THREE.Mesh(crownGeo, hornMat);
    crown.rotation.x = Math.PI / 2.25;
    crown.position.set(0, 4.4 * scale, -1.9 * scale);
    group.add(crown);

    // 4 Backward-Curving Heavy Horns on Crown
    const hornAngles = [-0.8, -0.28, 0.28, 0.8];
    hornAngles.forEach((ang, idx) => {
      const hornGeo = new THREE.ConeGeometry(0.18 * scale, 1.8 * scale, 6);
      const horn = new THREE.Mesh(hornGeo, hornMat);
      horn.position.set(ang * scale, 4.8 * scale + (idx === 1 || idx === 2 ? 0.3 * scale : 0), -2.2 * scale - (idx === 1 || idx === 2 ? 0.4 * scale : 0));
      horn.rotation.set(-0.8, 0, ang * 0.35);
      group.add(horn);
    });

    // 6 Massive Dorsal Exhaust Siphons
    for (let s = 0; s < 6; s++) {
      const pipeGeo = new THREE.CylinderGeometry(0.14 * scale, 0.09 * scale, 2.5 * scale, 6);
      const pipe = new THREE.Mesh(pipeGeo, hornMat);
      const side = s % 2 === 0 ? -0.75 : 0.75;
      const row = Math.floor(s / 2);
      pipe.position.set(side * scale, (3.4 - row * 0.45) * scale, (-1.0 - row * 0.45) * scale);
      pipe.rotation.x = -Math.PI / 4;
      pipe.rotation.z = side * -0.2;
      group.add(pipe);
    }

    // 2. Colossal Muscular Torso
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(1.1 * scale, 0.85 * scale, 4.2 * scale, 8), bodyMat);
    torso.position.y = 2.1 * scale;
    group.add(torso);

    // 3. Four Arms (2 Heavy Primary + 2 Smaller Secondary)
    const armGeo = new THREE.CylinderGeometry(0.18 * scale, 0.12 * scale, 2.2 * scale, 6);
    const armL = new THREE.Mesh(armGeo, bodyMat);
    armL.position.set(-1.1 * scale, 2.6 * scale, 0.6 * scale);
    armL.rotation.set(0.4, 0, -0.4);
    group.add(armL);

    const armR = new THREE.Mesh(armGeo, bodyMat);
    armR.position.set(1.1 * scale, 2.6 * scale, 0.6 * scale);
    armR.rotation.set(0.4, 0, 0.4);
    group.add(armR);

    // 4. Heavy Legs
    const legGeo = new THREE.CylinderGeometry(0.26 * scale, 0.18 * scale, 2.4 * scale, 6);
    const legL = new THREE.Mesh(legGeo, bodyMat);
    legL.position.set(-0.6 * scale, 1.1 * scale, -0.3 * scale);
    group.add(legL);
    const legR = new THREE.Mesh(legGeo, bodyMat);
    legR.position.set(0.6 * scale, 1.1 * scale, -0.3 * scale);
    group.add(legR);

    // 5. Tail ending in Trident Scythe Blade
    const tailGroup = new THREE.Group();
    tailGroup.position.set(0, 1.4 * scale, -1.8 * scale);
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * scale, 0.08 * scale, 4.5 * scale, 6), bodyMat);
    tail.rotation.x = Math.PI / 2.5;
    tailGroup.add(tail);

    const scytheGeo = new THREE.ConeGeometry(0.4 * scale, 1.5 * scale, 4);
    const scythe = new THREE.Mesh(scytheGeo, hornMat);
    scythe.position.set(0, -1.2 * scale, -3.8 * scale);
    scythe.rotation.x = -Math.PI / 3;
    tailGroup.add(scythe);
    group.add(tailGroup);

    return group;
  }

  createBossMesh(type) {
    if (type === 'rogue_king_prime') {
      return this.buildRogueKingMesh(3.2);
    }
    if (type === 'awakened_engineer') {
      return this.buildEngineerTitanMesh(2.7);
    }
    if (type === 'trilobite_prime') {
      return this.buildTrilobiteMesh(2.6);
    }
    if (type === 'berserker_super_predator') {
      return this.buildBerserkerPredatorMesh(2.6);
    }
    if (type === 'ultimate_upgrade_predator') {
      return this.buildUltimatePredatorMesh(3.3);
    }
    if (type === 'feral_predator_boss') {
      return this.buildFeralPredatorMesh(2.9);
    }
    if (type === 'apex_gladiator_predator') {
      return this.buildApexGladiatorMesh(3.2);
    }

    const group = new THREE.Group();
    const isMatriarchTitan = type === 'predalien_matriarch_titan';
    const isEmpress = type === 'empress_matriarch';
    const isPredalien = type === 'predalien_queen' || type === 'predalien_abomination' || isMatriarchTitan;
    const isAbomination = type === 'predalien_abomination' || isMatriarchTitan;
    const isOffspring = type === 'the_offspring';
    const scale = isMatriarchTitan ? 3.0 : (type === 'imperial_queen' ? 2.8 : (isEmpress ? 2.5 : (isAbomination ? 2.4 : (type === 'predalien_queen' ? 2.1 : (isOffspring ? 2.2 : 2.0)))));

    const mat = new THREE.MeshStandardMaterial({
      color: isOffspring ? 0xe2dfd2 : (isMatriarchTitan ? 0x6b4c28 : (isAbomination ? 0x524330 : (isPredalien ? 0x5a4632 : (isEmpress ? 0x2b0d3d : 0x11161d)))),
      metalness: isOffspring ? 0.1 : (isMatriarchTitan ? 0.85 : (isAbomination ? 0.75 : 0.8)),
      roughness: isOffspring ? 0.35 : (isMatriarchTitan ? 0.22 : (isAbomination ? 0.3 : 0.25))
    });

    // Elongated Alien Cranium
    const headGeo = new THREE.BoxGeometry(1.2 * scale, 0.8 * scale, 3.5 * scale);
    const head = new THREE.Mesh(headGeo, mat);
    head.position.set(0, 3.5 * scale, 0.5);
    group.add(head);

    // 1:1 Canon Xenomorph Queen / Empress Flared Armored Head Crest (Aliens 1986 / AvP 2004 / AvP Extinction)
    if (!isOffspring) {
      const crownMat = new THREE.MeshStandardMaterial({
        color: isMatriarchTitan ? 0xb45309 : (isPredalien ? 0x4a3b2c : (isEmpress ? 0x3b1254 : 0x0a0e14)),
        metalness: isMatriarchTitan ? 0.92 : 0.85,
        roughness: isMatriarchTitan ? 0.15 : 0.2
      });
      // Flared hexagonal crown fan
      const crownGeo = new THREE.ConeGeometry(2.4 * scale, 3.8 * scale, 6);
      const crown = new THREE.Mesh(crownGeo, crownMat);
      crown.rotation.x = Math.PI / 2.3;
      crown.position.set(0, 4.3 * scale, -1.8 * scale);
      group.add(crown);

      // 4 Heavy Dorsal Biomechanical Exhaust Siphons
      for (let s = 0; s < 4; s++) {
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * scale, 0.08 * scale, 2.2 * scale, 6), crownMat);
        pipe.position.set((s % 2 === 0 ? -0.7 : 0.7) * scale, 3.2 * scale + (s > 1 ? 0.6 : 0) * scale, -1.2 * scale - (s > 1 ? 0.4 : 0) * scale);
        pipe.rotation.x = -Math.PI / 4;
        group.add(pipe);
      }

      // Secondary Smaller Chest Arms (Queen Anatomical Characteristic)
      const secArmGeo = new THREE.CylinderGeometry(0.08 * scale, 0.06 * scale, 1.2 * scale, 5);
      const armL = new THREE.Mesh(secArmGeo, crownMat);
      armL.position.set(-0.5 * scale, 2.3 * scale, 0.9 * scale);
      armL.rotation.set(0.6, 0, -0.4);
      group.add(armL);

      const armR = new THREE.Mesh(secArmGeo, crownMat);
      armR.position.set(0.5 * scale, 2.3 * scale, 0.9 * scale);
      armR.rotation.set(0.6, 0, 0.4);
      group.add(armR);
    }

    const torsoGeo = new THREE.CylinderGeometry(1.0 * scale, 0.8 * scale, 4.0 * scale, 8);
    const torso = new THREE.Mesh(torsoGeo, mat);
    torso.position.y = 2.0 * scale;
    group.add(torso);

    if (isOffspring) {
      // Canon 1:1 The Offspring Anatomy (Alien: Romulus 2024)
      // Pale albaster humanoid face with black void eyes & pharyngeal inner jaw
      const faceMat = new THREE.MeshStandardMaterial({ color: 0xe8e5dc, roughness: 0.4, metalness: 0.05 });
      const face = new THREE.Mesh(new THREE.SphereGeometry(0.7 * scale, 12, 12), faceMat);
      face.position.set(0, 3.8 * scale, 1.2 * scale);
      face.scale.set(0.8, 1.2, 0.9);
      group.add(face);

      // Sunken black void eyes
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
      const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.12 * scale, 6, 6), eyeMat);
      eyeL.position.set(-0.25 * scale, 4.0 * scale, 1.8 * scale);
      group.add(eyeL);

      const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.12 * scale, 6, 6), eyeMat);
      eyeR.position.set(0.25 * scale, 4.0 * scale, 1.8 * scale);
      group.add(eyeR);

      // Pharyngeal Inner Jaw extending from humanoid mouth
      const jawMat = new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.9, roughness: 0.2 });
      const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.25 * scale, 0.2 * scale, 1.3 * scale), jawMat);
      jaw.position.set(0, 3.4 * scale, 2.0 * scale);
      group.add(jaw);

      // Segmented Biomechanical Stinger Tail
      const tailMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.3, metalness: 0.8 });
      for (let t = 0; t < 7; t++) {
        const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * scale, 0.14 * scale, 0.7 * scale, 6), tailMat);
        seg.position.set(0, 1.5 * scale - t * 0.25 * scale, -1.2 * scale - t * 0.5 * scale);
        seg.rotation.x = -Math.PI / 3 + t * 0.15;
        group.add(seg);
      }
      const stinger = new THREE.Mesh(new THREE.ConeGeometry(0.16 * scale, 0.8 * scale, 4), tailMat);
      stinger.rotation.x = -Math.PI / 2;
      stinger.position.set(0, 0.8 * scale, -4.5 * scale);
      group.add(stinger);

      // Elongated Slender Humanoid-Engineer Limbs & Claws (Romulus 2024 Canon)
      const limbMat = new THREE.MeshStandardMaterial({ color: 0xd8d4c7, roughness: 0.5, metalness: 0.1 });
      [-1, 1].forEach(side => {
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * scale, 0.08 * scale, 3.2 * scale, 6), limbMat);
        arm.position.set(side * 1.4 * scale, 2.2 * scale, 0.4 * scale);
        arm.rotation.z = side * 0.35;
        arm.rotation.x = 0.2;
        group.add(arm);

        // Long skeletal talons
        for (let f = 0; f < 4; f++) {
          const claw = new THREE.Mesh(new THREE.ConeGeometry(0.04 * scale, 0.45 * scale, 4), limbMat);
          claw.position.set(side * 1.8 * scale + (f - 1.5) * 0.08 * scale, 0.5 * scale, 0.6 * scale);
          claw.rotation.x = Math.PI / 3;
          group.add(claw);
        }
      });
    }

    if (isPredalien) {
      // Canon 1:1 Predalien Anatomy (AVP Requiem 2007 / AvP Extinction Matriarch Titan)
      // 1. Four articulable Yautja mandibles on the jaws
      const mandibleMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.4, metalness: 0.2 });
      const mandibleGeo = new THREE.ConeGeometry(0.18 * scale, 0.9 * scale, 5);

      const mUL = new THREE.Mesh(mandibleGeo, mandibleMat);
      mUL.position.set(-0.65 * scale, 3.3 * scale, 2.1 * scale);
      mUL.rotation.set(0.4, 0, -0.6);
      group.add(mUL);

      const mUR = new THREE.Mesh(mandibleGeo, mandibleMat);
      mUR.position.set(0.65 * scale, 3.3 * scale, 2.1 * scale);
      mUR.rotation.set(0.4, 0, 0.6);
      group.add(mUR);

      const mLL = new THREE.Mesh(mandibleGeo, mandibleMat);
      mLL.position.set(-0.5 * scale, 2.9 * scale, 2.2 * scale);
      mLL.rotation.set(0.2, 0, -0.4);
      group.add(mLL);

      const mLR = new THREE.Mesh(mandibleGeo, mandibleMat);
      mLR.position.set(0.5 * scale, 2.9 * scale, 2.2 * scale);
      mLR.rotation.set(0.2, 0, 0.4);
      group.add(mLR);

      // 2. Thick Yautja Dreadlocks crown trailing behind the biomechanical skull
      const dreadMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.85 });
      const ringMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.9, roughness: 0.2 });
      const dreadCount = isMatriarchTitan ? 8 : (isAbomination ? 6 : 4);
      for (let d = -dreadCount; d <= dreadCount; d++) {
        const dread = new THREE.Mesh(new THREE.CylinderGeometry(0.08 * scale, 0.05 * scale, 2.6 * scale, 6), dreadMat);
        const ang = (d / dreadCount) * Math.PI * 0.45;
        dread.position.set(Math.sin(ang) * 0.85 * scale, 3.3 * scale, -1.0 * scale - Math.cos(ang) * 0.35 * scale);
        dread.rotation.x = -0.55;
        dread.rotation.z = ang * 0.35;
        group.add(dread);

        if ((isAbomination || isMatriarchTitan) && Math.abs(d) % 2 === 0) {
          const ring = new THREE.Mesh(new THREE.TorusGeometry(0.09 * scale, 0.02 * scale, 4, 8), ringMat);
          ring.position.set(Math.sin(ang) * 0.85 * scale, 3.1 * scale, -1.0 * scale - Math.cos(ang) * 0.35 * scale);
          group.add(ring);
        }
      }

      // 3. Swollen Pregnant Biomechanical Belly Organ (AVP-R Chet / Matriarch Twin Brood Sacs)
      if (isAbomination || isPredalien) {
        const bellyMat = new THREE.MeshStandardMaterial({
          color: 0x65a30d,
          emissive: 0x3f6212,
          roughness: 0.25,
          metalness: 0.15,
          transparent: true,
          opacity: 0.85
        });
        if (isMatriarchTitan) {
          // Twin glowing brood sacs for Predalien Matriarch Titan
          [-0.45, 0.45].forEach(bx => {
            const sac = new THREE.Mesh(new THREE.SphereGeometry(0.75 * scale, 10, 10), bellyMat);
            sac.position.set(bx * scale, 1.85 * scale, 0.72 * scale);
            sac.scale.set(0.85, 1.3, 1.1);
            group.add(sac);
          });
        } else {
          const belly = new THREE.Mesh(new THREE.SphereGeometry(0.85 * scale, 10, 10), bellyMat);
          belly.position.set(0, 1.8 * scale, 0.65 * scale);
          belly.scale.set(0.9, 1.25, 1.05);
          group.add(belly);
        }
      }
    }

    if (isEmpress) {
      // Massive Flying Wings
      const wingMat = new THREE.MeshBasicMaterial({ color: 0x581c87, side: THREE.DoubleSide, transparent: true, opacity: 0.7 });
      const leftWing = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), wingMat);
      leftWing.position.set(-4, 4, 0);
      group.add(leftWing);

      const rightWing = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), wingMat);
      rightWing.position.set(4, 4, 0);
      group.add(rightWing);
    }

    return group;
  }

  regurgitateChestbursters(player, horde) {
    if (!this.activeBoss) return;
    this.audioEngine.playPredalienRegurgitate();

    const origin = this.activeBoss.mesh.position.clone().add(new THREE.Vector3(0, 3.2, 0));
    const target = player.position.clone();
    const dir = target.clone().sub(origin).normalize();

    // Launch embryonic Chestburster pods
    for (let i = 0; i < 3; i++) {
      const spreadDir = dir.clone().add(new THREE.Vector3(
        (Math.random() - 0.5) * 0.4,
        0.25 + Math.random() * 0.2,
        (Math.random() - 0.5) * 0.4
      )).normalize();

      const embryoGeo = new THREE.SphereGeometry(0.35, 8, 8);
      const embryoMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.2, metalness: 0.1 });
      const embryoMesh = new THREE.Mesh(embryoGeo, embryoMat);
      embryoMesh.position.copy(origin);
      this.scene.add(embryoMesh);

      this.embryoProjectiles.push({
        mesh: embryoMesh,
        velocity: spreadDir.multiplyScalar(24),
        gravity: -20,
        damage: 60,
        life: 2.5
      });
    }

    // Spawn a live Chestburster directly into horde with scurry audio
    if (horde && horde.spawnChestburster) {
      setTimeout(() => {
        horde.spawnChestburster(origin);
        if (this.audioEngine && this.audioEngine.playChestbursterScurry) {
          this.audioEngine.playChestbursterScurry();
        }
      }, 350);
    }
  }

  triggerPregnantBurstFrenzy(horde) {
    if (!this.activeBoss || !this.activeBoss.mesh) return;
    const origin = this.activeBoss.mesh.position.clone().add(new THREE.Vector3(0, 2.5, 0));

    if (this.audioEngine && this.audioEngine.playPredalienRegurgitate) {
      this.audioEngine.playPredalienRegurgitate();
    }
    if (this.audioEngine && this.audioEngine.playChestbursterScurry) {
      this.audioEngine.playChestbursterScurry();
    }

    if (window.gameInstance && window.gameInstance.ui && window.gameInstance.ui.showAnnouncement) {
      window.gameInstance.ui.showAnnouncement('⚠️ PRÉDALIENNE EN FUREUR GESTANTE : ÉRUPTION DE COUVÉE VIRULENTE (AVP-R) !');
    }

    // Violent chestburster brood eruption
    if (horde && horde.spawnChestburster) {
      for (let c = 0; c < 3; c++) {
        setTimeout(() => {
          const spawnPos = origin.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, 0, (Math.random() - 0.5) * 3));
          horde.spawnChestburster(spawnPos);
        }, c * 250);
      }
    }
  }

  regurgitateBellyVomit(player, horde) {
    if (!this.activeBoss) return;
    if (this.audioEngine && this.audioEngine.playPredalienBellyVomit) {
      this.audioEngine.playPredalienBellyVomit();
    } else if (this.audioEngine && this.audioEngine.playPredalienRegurgitate) {
      this.audioEngine.playPredalienRegurgitate();
    }

    if (window.gameInstance && window.gameInstance.ui && window.gameInstance.ui.showAnnouncement) {
      window.gameInstance.ui.showAnnouncement('⚠️ DÉGORGEMENT GESTANT (AVP-R) : GERBE D\'ACIDE CORROSIF ET DOUBLE ÉCLOSION !');
    }

    const origin = this.activeBoss.mesh.position.clone().add(new THREE.Vector3(0, 3.2, 0));
    const target = player.position.clone();
    const dir = target.clone().sub(origin).normalize();

    // Launch 3 streams of pressurized acidic bile
    for (let i = 0; i < 3; i++) {
      const spreadDir = dir.clone().add(new THREE.Vector3(
        (Math.random() - 0.5) * 0.35,
        0.2 + Math.random() * 0.15,
        (Math.random() - 0.5) * 0.35
      )).normalize();

      const vomitGeo = new THREE.SphereGeometry(0.38, 8, 8);
      const vomitMat = new THREE.MeshStandardMaterial({
        color: 0x84cc16,
        emissive: 0x4d7c0f,
        roughness: 0.15,
        metalness: 0.1
      });
      const vomitMesh = new THREE.Mesh(vomitGeo, vomitMat);
      vomitMesh.position.copy(origin);
      this.scene.add(vomitMesh);

      this.embryoProjectiles.push({
        mesh: vomitMesh,
        velocity: spreadDir.multiplyScalar(22),
        gravity: -19,
        damage: 45,
        life: 3.5,
        isBellyVomit: true
      });
    }

    // Spawn 2 chestbursters on impact with delay
    setTimeout(() => {
      if (horde && horde.spawnChestburster) {
        horde.spawnChestburster(target.clone().add(new THREE.Vector3(1.2, 0, 1.2)));
        horde.spawnChestburster(target.clone().add(new THREE.Vector3(-1.2, 0, -1.2)));
        if (this.audioEngine && this.audioEngine.playChestbursterScurry) {
          this.audioEngine.playChestbursterScurry();
        }
      }
    }, 450);
  }

  takeDamage(amount, horde = null) {
    if (!this.activeBoss) return;

    // Chantier 3 (v51.0): Mala'kak Awakened Engineer Biomechanical Phase Shield
    if (this.activeBoss.type === 'awakened_engineer' && this.activeBoss.phase === 2 && this.activeBoss.hasPhaseShield) {
      this.activeBoss.phaseShieldHp -= amount;
      if (this.activeBoss.phaseShieldHp <= 0) {
        this.activeBoss.hasPhaseShield = false;
        if (this.activeBoss.mesh.userData && this.activeBoss.mesh.userData.phaseShield) {
          this.activeBoss.mesh.userData.phaseShield.visible = false;
        }
        if (this.audioEngine && this.audioEngine.playEngineerBioArmorShatter) {
          this.audioEngine.playEngineerBioArmorShatter();
        }
        if (window.gameInstance && window.gameInstance.ui && window.gameInstance.ui.showAnnouncement) {
          window.gameInstance.ui.showAnnouncement('🛡️ BOUCLIER BIOMÉCANIQUE DE L\'INGÉNIEUR BRISÉ !');
        }
      }
      amount *= 0.4; // 60% absorbed by phase shield
    }

    this.activeBoss.hp -= amount;

    // Engineer Phase 2 trigger at 50% HP
    if (this.activeBoss.type === 'awakened_engineer' && this.activeBoss.hp <= this.activeBoss.maxHp * 0.5 && this.activeBoss.phase === 1) {
      this.activeBoss.phase = 2;
      this.activeBoss.hasPhaseShield = true;
      this.activeBoss.phaseShieldHp = 2000;
      if (this.activeBoss.mesh.userData && this.activeBoss.mesh.userData.phaseShield) {
        this.activeBoss.mesh.userData.phaseShield.visible = true;
      }
      if (this.audioEngine && this.audioEngine.playEngineerGravityStaffBlast) {
        this.audioEngine.playEngineerGravityStaffBlast();
      }
      if (window.gameInstance && window.gameInstance.ui && window.gameInstance.ui.showAnnouncement) {
        window.gameInstance.ui.showAnnouncement('⚡ PHASE 2 : L\'INGÉNIEUR DÉPLOIE SON CHAMP GRAVITATIONNEL ET SON BOUCLIER !');
      }
    }

    // Predalien Pregnant Belly-Burst Frenzy at < 45% HP (AVP Requiem Lore)
    if ((this.activeBoss.type === 'predalien_queen' || this.activeBoss.type === 'predalien_abomination' || this.activeBoss.type === 'predalien_matriarch_titan') && this.activeBoss.hp <= this.activeBoss.maxHp * 0.45 && !this.activeBoss.pregnantBurstTriggered) {
      this.activeBoss.pregnantBurstTriggered = true;
      this.triggerPregnantBurstFrenzy(horde || (window.gameInstance ? window.gameInstance.horde : null));
    }

    // Phase 2 for Predalien Abomination / Matriarch Titan at 65% HP
    if ((this.activeBoss.type === 'predalien_abomination' || this.activeBoss.type === 'predalien_matriarch_titan') && this.activeBoss.hp <= this.activeBoss.maxHp * 0.65 && this.activeBoss.phase === 1) {
      this.activeBoss.phase = 2;
      if (window.gameInstance && window.gameInstance.ui) {
        window.gameInstance.ui.showAnnouncement('⚠️ PHASE 2 : LA MATRIARCHE PRÉDALIENNE ENTRE EN TRANSE ROYALE ET LIBÈRE SES BROOD SACS !');
      }
    }

    // Custom Spine Rip Stun Threshold at 18% / 20% HP
    if (this.activeBoss.type === 'rogue_king_prime') {
      if (this.activeBoss.hp <= this.activeBoss.maxHp * 0.45 && this.activeBoss.phase === 1) {
        this.activeBoss.phase = 2;
        this.activeBoss.isEnraged = true;
        if (this.audioEngine && this.audioEngine.playRogueKingEarthquakeRoar) {
          this.audioEngine.playRogueKingEarthquakeRoar();
        }
        if (window.gameInstance && window.gameInstance.ui && window.gameInstance.ui.showAnnouncement) {
          window.gameInstance.ui.showAnnouncement('👑 PHASE 2 : LE ROI XÉNOMORPHE ENTRE EN RAGE SANGUINAIRE !');
        }
      }

      if (this.activeBoss.hp <= this.activeBoss.maxHp * 0.20 && !this.activeBoss.isStunned && !this.activeBoss.spineRipAvailable) {
        this.activeBoss.isStunned = true;
        this.activeBoss.stunTimer = 15.0;
        this.activeBoss.spineRipAvailable = true;
        if (window.gameInstance && window.gameInstance.ui && window.gameInstance.ui.showAnnouncement) {
          window.gameInstance.ui.showAnnouncement('💀 EXÉCUTION ROYALE : APPUYEZ SUR [E] POUR ARRACHER LA COURONNE CORNUE DU ROI XÉNOMORPHE !');
        }
      }
    } else if (this.activeBoss.type === 'awakened_engineer') {
      if (this.activeBoss.hp <= this.activeBoss.maxHp * 0.20 && !this.activeBoss.isStunned && !this.activeBoss.spineRipAvailable) {
        this.activeBoss.isStunned = true;
        this.activeBoss.stunTimer = 15.0;
        this.activeBoss.spineRipAvailable = true;
        if (window.gameInstance && window.gameInstance.ui) {
          window.gameInstance.ui.showAnnouncement('💀 EXÉCUTION MYTHIQUE : APPUYEZ SUR [E] POUR DÉCAPITER L\'INGÉNIEUR ET ARRACHER SON BIO-MASQUE !');
        }
      }
    } else if (this.activeBoss.type === 'predalien_matriarch_titan') {
      if (this.activeBoss.hp <= this.activeBoss.maxHp * 0.18 && !this.activeBoss.isStunned && !this.activeBoss.spineRipAvailable) {
        this.activeBoss.isStunned = true;
        this.activeBoss.stunTimer = 15.0;
        this.activeBoss.spineRipAvailable = true;
        if (window.gameInstance && window.gameInstance.ui) {
          window.gameInstance.ui.showAnnouncement('💀 EXÉCUTION SUPRÊME : APPUYEZ SUR [E] POUR ARRACHER LA COURONNE IMPÉRIALE DE LA MATRIARCHE TITAN PRÉDALIENNE !');
        }
      }
    } else if (this.activeBoss.type === 'trilobite_prime') {
      if (this.activeBoss.hp <= this.activeBoss.maxHp * 0.20 && !this.activeBoss.isStunned && !this.activeBoss.spineRipAvailable) {
        this.activeBoss.isStunned = true;
        this.activeBoss.stunTimer = 14.0;
        this.activeBoss.spineRipAvailable = true;
        if (window.gameInstance && window.gameInstance.ui) {
          window.gameInstance.ui.showAnnouncement('💀 EXÉCUTION MYTHIQUE : APPUYEZ SUR [E] POUR TRANCHER LE TENTACULE PRIMORDIAL DU TRILOBITE !');
        }
      }
    } else if (this.activeBoss.type === 'predalien_abomination') {
      if (this.activeBoss.hp <= this.activeBoss.maxHp * 0.20 && !this.activeBoss.isStunned && !this.activeBoss.spineRipAvailable) {
        this.activeBoss.isStunned = true;
        this.activeBoss.stunTimer = 12.0;
        this.activeBoss.spineRipAvailable = true;
        if (window.gameInstance && window.gameInstance.ui) {
          window.gameInstance.ui.showAnnouncement('💀 EXÉCUTION SPÉCIALE : APPUYEZ SUR [E] POUR DÉCAPITER L\'ABOMINATION PRÉDALIENNE !');
        }
      }
    } else {
      if (this.activeBoss.hp <= this.activeBoss.maxHp * 0.3 && !this.activeBoss.isStunned) {
        this.activeBoss.isStunned = true;
        this.activeBoss.stunTimer = 6.0;
      }
    }
  }

  /* === CHANTIER 3 (v51.0): Engineer Gravitational Vortex & Seismic Stomp === */
  triggerEngineerGravitationalVortex(player, horde) {
    if (!this.activeBoss || !this.activeBoss.mesh) return;
    const origin = this.activeBoss.mesh.position.clone();

    if (this.audioEngine && this.audioEngine.playEngineerGravityStaffBlast) {
      this.audioEngine.playEngineerGravityStaffBlast();
    }

    if (window.gameInstance && window.gameInstance.ui && window.gameInstance.ui.showAnnouncement) {
      window.gameInstance.ui.showAnnouncement('🌌 VORTEX GRAVITATIONNEL DE L\'INGÉNIEUR : ATTRACTION ET ÉCRASEMENT DES FORMES DE VIE !');
    }

    // Pull and damage player
    const dist = origin.distanceTo(player.position);
    if (dist <= 26.0) {
      const pullDir = origin.clone().sub(player.position).normalize();
      pullDir.y = 0;
      player.position.addScaledVector(pullDir, Math.min(dist * 0.7, 12.0));
      if (player.mesh) player.mesh.position.copy(player.position);
      player.takeDamage(140);
    }

    // Pull and crush nearby aliens
    if (horde && horde.aliens) {
      for (let i = horde.aliens.length - 1; i >= 0; i--) {
        const a = horde.aliens[i];
        if (!a || a.hp <= 0 || !a.mesh) continue;
        const d = origin.distanceTo(a.mesh.position);
        if (d <= 22.0) {
          const aPull = origin.clone().sub(a.mesh.position).normalize();
          aPull.y = 0;
          a.mesh.position.addScaledVector(aPull, 8.5);
          a.hp -= 220;
          if (a.hp <= 0) {
            if (horde.goreEngine) horde.goreEngine.spawnDismemberment(a.mesh.position, 'heavy');
            this.scene.remove(a.mesh);
            horde.aliens.splice(i, 1);
            horde.deadCount++;
          }
        }
      }
    }
  }

  triggerEngineerSeismicStomp(player) {
    if (!this.activeBoss || !this.activeBoss.mesh) return;
    const origin = this.activeBoss.mesh.position.clone();

    if (this.audioEngine && this.audioEngine.playGroundSlamImpact) {
      this.audioEngine.playGroundSlamImpact();
    }

    const dist = origin.distanceTo(player.position);
    if (dist <= 8.5) {
      player.takeDamage(180);
      const pushDir = player.position.clone().sub(origin).normalize();
      pushDir.y = 0;
      player.position.addScaledVector(pushDir, 11.0);
      if (player.mesh) player.mesh.position.copy(player.position);
    }
  }

  triggerMatriarchRoyalSlam(player, horde) {
    if (!this.activeBoss) return;
    if (this.audioEngine && this.audioEngine.playRogueKingRoar) {
      this.audioEngine.playRogueKingRoar();
    } else if (this.audioEngine && this.audioEngine.playThunderClap) {
      this.audioEngine.playThunderClap();
    }

    if (window.gameInstance && window.gameInstance.ui && window.gameInstance.ui.showAnnouncement) {
      window.gameInstance.ui.showAnnouncement('💥 BOND ROYAL TITAN (AVP EXTINCTION) : ONDE DE CHOC DE 14M (135 DÉGÂTS) !');
    }

    // Golden-amber biomechanical shockwave ring
    const ringGeo = new THREE.RingGeometry(1.5, 3.2, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xd97706,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(this.activeBoss.mesh.position);
    ring.position.y = 0.35;
    this.scene.add(ring);

    let scale = 1.0;
    const ringAnim = setInterval(() => {
      scale += 1.05;
      ring.scale.set(scale, 1, scale);
      ring.material.opacity -= 0.08;
      if (ring.material.opacity <= 0) {
        clearInterval(ringAnim);
        this.scene.remove(ring);
      }
    }, 25);

    const dist = this.activeBoss.mesh.position.distanceTo(player.position);
    if (dist <= 14.0) {
      if (player.isBlocking) {
        if (player.audioEngine && player.audioEngine.playShieldBlock) player.audioEngine.playShieldBlock();
      } else {
        player.takeDamage(135);
        const pushDir = player.position.clone().sub(this.activeBoss.mesh.position).normalize();
        player.position.addScaledVector(pushDir, 10.0);
        player.mesh.position.copy(player.position);
      }
    }

    if (horde && horde.spawnChestburster) {
      horde.spawnChestburster(this.activeBoss.mesh.position.clone().add(new THREE.Vector3(2.2, 0, 2.2)));
    }
  }

  triggerTrilobiteConstrict(player) {
    if (!this.activeBoss) return;
    if (this.audioEngine && this.audioEngine.playTrilobiteTentacleConstrict) {
      this.audioEngine.playTrilobiteTentacleConstrict();
    }

    if (window.gameInstance && window.gameInstance.ui) {
      window.gameInstance.ui.showAnnouncement('⚠️ CONSTRICTION DU TRILOBITE (PROMETHEUS) : ÉTREINTE DES 7 TENTACULES !');
    }

    const dist = this.activeBoss.mesh.position.distanceTo(player.position);
    if (dist <= 15.0) {
      if (player.isBlocking) {
        if (player.audioEngine && player.audioEngine.playShieldBlock) player.audioEngine.playShieldBlock();
      } else {
        player.takeDamage(95);
        // Drag player violently toward the oral beak sphincter
        const pullDir = this.activeBoss.mesh.position.clone().sub(player.position).normalize();
        pullDir.y = 0;
        player.position.addScaledVector(pullDir, Math.min(dist * 0.65, 8.0));
        player.mesh.position.copy(player.position);
      }
    }
  }

  spitMutagenSludge(player) {
    if (!this.activeBoss) return;
    if (this.audioEngine && this.audioEngine.playEngineerUrnDetonation) {
      this.audioEngine.playEngineerUrnDetonation();
    }

    const origin = this.activeBoss.mesh.position.clone().add(new THREE.Vector3(0, 2.0, 0));
    const target = player.position.clone();
    const dir = target.clone().sub(origin).normalize();

    for (let i = 0; i < 3; i++) {
      const spread = dir.clone().add(new THREE.Vector3(
        (Math.random() - 0.5) * 0.35,
        0.3 + Math.random() * 0.15,
        (Math.random() - 0.5) * 0.35
      )).normalize();

      const geo = new THREE.SphereGeometry(0.42, 8, 8);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x09090b,
        emissive: 0x064e3b,
        roughness: 0.15,
        metalness: 0.9
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(origin);
      this.scene.add(mesh);

      this.acidSpitProjectiles.push({
        mesh: mesh,
        velocity: spread.multiplyScalar(21),
        gravity: -22,
        damage: 80,
        life: 3.0,
        isMutagen: true
      });
    }
  }

  triggerTailWhip(player) {
    if (!this.activeBoss) return;
    this.audioEngine.playQueenTailWhip();

    // 360 spin animation of the Queen body
    const initialRot = this.activeBoss.mesh.rotation.y;
    let spin = 0;
    const spinAnim = setInterval(() => {
      spin += 0.4;
      this.activeBoss.mesh.rotation.y += 0.4;
      if (spin >= Math.PI * 2) {
        clearInterval(spinAnim);
        this.activeBoss.mesh.rotation.y = initialRot;
      }
    }, 20);

    const dist = this.activeBoss.mesh.position.distanceTo(player.position);
    if (dist <= 8.5) {
      if (player.isBlocking) {
        player.audioEngine.playShieldBlock();
      } else {
        player.takeDamage(120);
        // Knockback player violently
        const pushDir = player.position.clone().sub(this.activeBoss.mesh.position).normalize();
        player.position.addScaledVector(pushDir, 6.0);
        player.mesh.position.copy(player.position);
      }
    }

    // Demolish nearby Catwalk Support Pillars (Chantier 4: Queen's Rampage)
    if (typeof window !== 'undefined' && window.gameInstance && window.gameInstance.env && window.gameInstance.env.damageCatwalkPillars) {
      window.gameInstance.env.damageCatwalkPillars(this.activeBoss.mesh.position, 9.5, 160, this.audioEngine, window.gameInstance.particles);
    }
  }

  spitAcidMortar(player) {
    if (!this.activeBoss) return;
    this.audioEngine.playQueenAcidSpit();

    const origin = this.activeBoss.mesh.position.clone().add(new THREE.Vector3(0, 4.0, 0));
    const target = player.position.clone();
    const spitDir = target.clone().sub(origin).normalize();

    const acidGeo = new THREE.SphereGeometry(0.4, 8, 8);
    const acidMat = new THREE.MeshBasicMaterial({ color: 0x39ff14 });
    const acidMesh = new THREE.Mesh(acidGeo, acidMat);
    acidMesh.position.copy(origin);
    this.scene.add(acidMesh);

    this.acidSpitProjectiles.push({
      mesh: acidMesh,
      velocity: spitDir.multiplyScalar(22).add(new THREE.Vector3(0, 8, 0)),
      gravity: -24,
      damage: 75,
      life: 2.5
    });

    if (this.audioEngine.playAcidMortarWhistle) {
      this.audioEngine.playAcidMortarWhistle();
    }
  }

  triggerTailSkewer(player) {
    if (!this.activeBoss) return;
    if (this.audioEngine.playQueenTailSkewer) {
      this.audioEngine.playQueenTailSkewer();
    } else {
      this.audioEngine.playQueenTailWhip();
    }

    // High-speed lunging jab animation forward
    const initialZ = this.activeBoss.mesh.position.z;
    const jabDir = player.position.clone().sub(this.activeBoss.mesh.position).normalize();
    jabDir.y = 0;

    let jabStep = 0;
    const jabAnim = setInterval(() => {
      jabStep++;
      if (jabStep < 5) {
        this.activeBoss.mesh.position.addScaledVector(jabDir, 0.8);
      } else if (jabStep < 10) {
        this.activeBoss.mesh.position.addScaledVector(jabDir, -0.8);
      } else {
        clearInterval(jabAnim);
      }
    }, 25);

    const dist = this.activeBoss.mesh.position.distanceTo(player.position);
    if (dist <= 7.0) {
      if (player.isBlocking) {
        if (player.audioEngine && player.audioEngine.playShieldBlock) player.audioEngine.playShieldBlock();
      } else {
        player.takeDamage(85);
        // Brutal impalement pushback
        const skewerPush = player.position.clone().sub(this.activeBoss.mesh.position).normalize();
        player.position.addScaledVector(skewerPush, 8.5);
        player.mesh.position.copy(player.position);
      }
    }
  }

  triggerEmpressGale(player, horde) {
    if (!this.activeBoss) return;
    if (this.audioEngine.playThunderClap) {
      this.audioEngine.playThunderClap();
    }

    // Expanding biomechanical gale shockwave ring
    const ringGeo = new THREE.RingGeometry(1.5, 3.0, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x9333ea,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(this.activeBoss.mesh.position);
    ring.position.y = 0.4;
    this.scene.add(ring);

    let scale = 1.0;
    const ringAnim = setInterval(() => {
      scale += 0.9;
      ring.scale.set(scale, 1, scale);
      ring.material.opacity -= 0.08;
      if (ring.material.opacity <= 0) {
        clearInterval(ringAnim);
        this.scene.remove(ring);
      }
    }, 25);

    // Blast player
    const dist = this.activeBoss.mesh.position.distanceTo(player.position);
    if (dist <= 13.0) {
      player.takeDamage(70);
      const pushDir = player.position.clone().sub(this.activeBoss.mesh.position).normalize();
      player.position.addScaledVector(pushDir, 9.0);
      player.mesh.position.copy(player.position);
    }

    // Blast away all nearby Xenomorphs
    if (horde && horde.aliens) {
      horde.aliens.forEach(a => {
        if (!a || !a.mesh) return;
        const d = a.mesh.position.distanceTo(this.activeBoss.mesh.position);
        if (d <= 14.0) {
          const push = a.mesh.position.clone().sub(this.activeBoss.mesh.position).normalize();
          a.mesh.position.addScaledVector(push, 8.0);
          a.hp -= 80;
        }
      });
    }

    // Demolish Catwalk Support Pillars across the shockwave zone
    if (typeof window !== 'undefined' && window.gameInstance && window.gameInstance.env && window.gameInstance.env.damageCatwalkPillars) {
      window.gameInstance.env.damageCatwalkPillars(this.activeBoss.mesh.position, 14.0, 200, this.audioEngine, window.gameInstance.particles);
    }
  }

  update(delta, player, horde = null) {
    if (!this.activeBoss) return;

    // 1. Update Queen acid spit projectiles
    for (let i = this.acidSpitProjectiles.length - 1; i >= 0; i--) {
      const proj = this.acidSpitProjectiles[i];
      proj.life -= delta;
      proj.velocity.y += proj.gravity * delta;
      proj.mesh.position.addScaledVector(proj.velocity, delta);

      if (proj.mesh.position.distanceTo(player.position) < 2.2) {
        player.takeDamage(proj.damage);
        this.scene.remove(proj.mesh);
        this.acidSpitProjectiles.splice(i, 1);
        continue;
      }

      if (proj.mesh.position.y <= 0.1 || proj.life <= 0) {
        this.scene.remove(proj.mesh);
        this.acidSpitProjectiles.splice(i, 1);
      }
    }

    // 2. Update Predalien embryo projectiles
    for (let i = this.embryoProjectiles.length - 1; i >= 0; i--) {
      const ep = this.embryoProjectiles[i];
      ep.life -= delta;
      ep.velocity.y += ep.gravity * delta;
      ep.mesh.position.addScaledVector(ep.velocity, delta);

      if (ep.mesh.position.distanceTo(player.position) < 2.0) {
        player.takeDamage(ep.damage);
        if (horde && horde.spawnChestburster) {
          horde.spawnChestburster(ep.mesh.position);
        }
        this.scene.remove(ep.mesh);
        this.embryoProjectiles.splice(i, 1);
        continue;
      }

      if (ep.mesh.position.y <= 0.2 || ep.life <= 0) {
        if (horde && horde.spawnChestburster && Math.random() < 0.5) {
          horde.spawnChestburster(ep.mesh.position);
        }
        this.scene.remove(ep.mesh);
        this.embryoProjectiles.splice(i, 1);
      }
    }

    if (this.activeBoss.isStunned) {
      this.activeBoss.stunTimer -= delta;
      if (this.activeBoss.stunTimer <= 0) {
        this.activeBoss.isStunned = false;
      }
      return;
    }

    // Cooldown management for attacks
    if (!this.activeBoss.tailWhipCooldown) this.activeBoss.tailWhipCooldown = 3.5;
    if (!this.activeBoss.tailSkewerCooldown) this.activeBoss.tailSkewerCooldown = 5.0;
    if (!this.activeBoss.galeFlapCooldown) this.activeBoss.galeFlapCooldown = 6.0;
    if (!this.activeBoss.spitCooldown) this.activeBoss.spitCooldown = 4.0;
    if (!this.activeBoss.regurgitateCooldown) this.activeBoss.regurgitateCooldown = 5.0;

    this.activeBoss.tailWhipCooldown -= delta;
    this.activeBoss.tailSkewerCooldown -= delta;
    this.activeBoss.galeFlapCooldown -= delta;
    this.activeBoss.spitCooldown -= delta;
    this.activeBoss.regurgitateCooldown -= delta;

    // Trilobite Cephalopod Prime Tentacle Undulation Animation (Prometheus 2012)
    if (this.activeBoss.type === 'trilobite_prime' && this.activeBoss.mesh.userData && this.activeBoss.mesh.userData.tentacles) {
      const time = Date.now() * 0.003;
      this.activeBoss.mesh.userData.tentacles.forEach((tent, tIdx) => {
        tent.segments.forEach((seg, sIdx) => {
          seg.rotation.z = Math.sin(time + tIdx * 0.9 + sIdx * 0.5) * 0.28;
          seg.rotation.x = Math.cos(time * 0.75 + tIdx * 0.6 + sIdx * 0.4) * 0.22;
        });
      });
    }

    const dir = player.position.clone().sub(this.activeBoss.mesh.position);
    dir.y = 0;
    const dist = dir.length();

    // Trilobite Prime Signature Constriction & Mutagen Spray (Prometheus 2012 Lore)
    if (this.activeBoss.type === 'trilobite_prime') {
      if (!this.activeBoss.constrictCooldown) this.activeBoss.constrictCooldown = 4.5;
      this.activeBoss.constrictCooldown -= delta;
      if (dist <= 15.0 && this.activeBoss.constrictCooldown <= 0) {
        this.activeBoss.constrictCooldown = 6.5;
        this.triggerTrilobiteConstrict(player);
      }

      if (!this.activeBoss.sludgeCooldown) this.activeBoss.sludgeCooldown = 4.0;
      this.activeBoss.sludgeCooldown -= delta;
      if (dist > 7.0 && dist < 32.0 && this.activeBoss.sludgeCooldown <= 0) {
        this.activeBoss.sludgeCooldown = 5.5;
        this.spitMutagenSludge(player);
      }
    }

    // Predalien Signature Attack: Chestburster Regurgitation / Pressurized Belly Vomit (AVP: Requiem / Extinction Lore)
    if (this.activeBoss.type === 'awakened_engineer') {
      if (!this.activeBoss.vortexCooldown) this.activeBoss.vortexCooldown = 5.0;
      this.activeBoss.vortexCooldown -= delta;
      if (this.activeBoss.vortexCooldown <= 0) {
        this.activeBoss.vortexCooldown = 7.5;
        this.triggerEngineerGravitationalVortex(player, horde);
      }

      if (!this.activeBoss.stompCooldown) this.activeBoss.stompCooldown = 3.5;
      this.activeBoss.stompCooldown -= delta;
      if (dist <= 7.5 && this.activeBoss.stompCooldown <= 0) {
        this.activeBoss.stompCooldown = 4.8;
        this.triggerEngineerSeismicStomp(player);
      }

      if (this.activeBoss.mesh.userData && this.activeBoss.mesh.userData.phaseShield && this.activeBoss.hasPhaseShield) {
        this.activeBoss.mesh.userData.phaseShield.rotation.y += 1.5 * delta;
        this.activeBoss.mesh.userData.phaseShield.rotation.x += 0.8 * delta;
      }
    } else if (this.activeBoss.type === 'berserker_super_predator') {
      // Chantier 7 (v55.0): Bad Blood Berserker Super Predator AI (Predators 2010 Mr. Black)
      if (!this.activeBoss.gatlingCooldown) this.activeBoss.gatlingCooldown = 4.0;
      this.activeBoss.gatlingCooldown -= delta;

      if (!this.activeBoss.roarCooldown) this.activeBoss.roarCooldown = 6.0;
      this.activeBoss.roarCooldown -= delta;

      // Rotate towards player
      if (dist > 0.1) {
        this.activeBoss.mesh.lookAt(player.position.x, this.activeBoss.mesh.position.y, player.position.z);
      }

      // 1. Long range: Rotary Plasma Gatling Bursts
      if (dist > 8.0 && dist <= 38.0 && this.activeBoss.gatlingCooldown <= 0) {
        this.activeBoss.gatlingCooldown = 4.5;
        if (this.audioEngine && this.audioEngine.playBurnerHeavyPlasmaBlast) {
          this.audioEngine.playBurnerHeavyPlasmaBlast();
        }
        for (let b = 0; b < 3; b++) {
          setTimeout(() => {
            if (this.activeBoss && player) {
              const pDir = player.position.clone().sub(this.activeBoss.mesh.position).normalize();
              this.spawnAcidSpit(this.activeBoss.mesh.position.clone().add(new THREE.Vector3(0, 3.2, 0)), pDir);
            }
          }, b * 150);
        }
        if (window.gameInstance && window.gameInstance.ui && window.gameInstance.ui.showAnnouncement) {
          window.gameInstance.ui.showAnnouncement('🔴 GATLING PLASMA DU SUPER PREDATOR BERSERKER EN RAFALE !', 'warning');
        }
      }

      // 2. Melee range: War Roar & Heavy Serrated Wristblade Cleave
      if (dist <= 6.5 && this.activeBoss.roarCooldown <= 0) {
        this.activeBoss.roarCooldown = 5.5;
        if (this.audioEngine && this.audioEngine.playBadBloodBerserkerRoar) {
          this.audioEngine.playBadBloodBerserkerRoar();
        }
        player.takeDamage(420, false, this.activeBoss);
        if (window.gameInstance && window.gameInstance.particles && window.gameInstance.particles.emitSparks) {
          window.gameInstance.particles.emitSparks(player.position.clone().add(new THREE.Vector3(0, 1.4, 0)), 24);
        }
      }
    } else if (this.activeBoss.type === 'feral_predator_boss') {
      // Prey (2022): 3.1m Feral Predator Archaic Hunter AI
      if (!this.activeBoss.crossbowCooldown) this.activeBoss.crossbowCooldown = 3.0;
      this.activeBoss.crossbowCooldown -= delta;

      if (!this.activeBoss.spearCooldown) this.activeBoss.spearCooldown = 4.5;
      this.activeBoss.spearCooldown -= delta;

      if (dist > 0.1) {
        this.activeBoss.mesh.lookAt(player.position.x, this.activeBoss.mesh.position.y, player.position.z);
      }

      // Check Mud Sinkhole Entrapment: if near [0, 0, 0] within 5.5m
      const mudDist = Math.sqrt(this.activeBoss.mesh.position.x * this.activeBoss.mesh.position.x + this.activeBoss.mesh.position.z * this.activeBoss.mesh.position.z);
      if (mudDist <= 5.5 && !this.activeBoss.isMudStunned) {
        this.activeBoss.isMudStunned = true;
        this.activeBoss.isStunned = true;
        this.activeBoss.stunTimer = 7.0;
        if (window.gameInstance && window.gameInstance.particles && window.gameInstance.particles.emitSparks) {
          window.gameInstance.particles.emitSparks(this.activeBoss.mesh.position, 25);
        }
        if (window.gameInstance && window.gameInstance.ui && window.gameInstance.ui.showAnnouncement) {
          window.gameInstance.ui.showAnnouncement('🎯 FERAL PREDATOR ENGLUÉ DANS LA TOURBIÈRE DE BOUE (IMMOBILISÉ 7S, CRITIQUES x3.5) !', 'success');
        }
      }

      // 1. Long range: 3 Pneumatic Crossbow Homing Flechettes (unless blocked or decoyed)
      if (dist > 7.0 && dist <= 38.0 && this.activeBoss.crossbowCooldown <= 0 && !this.activeBoss.isStunned) {
        this.activeBoss.crossbowCooldown = 3.8;

        const decoyActive = window.gameInstance && window.gameInstance.env && window.gameInstance.env.boneMaskDecoy && window.gameInstance.env.boneMaskDecoy.isArmed;
        if (decoyActive) {
          if (this.audioEngine && this.audioEngine.playBoneMaskLaserLockRedirect) {
            this.audioEngine.playBoneMaskLaserLockRedirect();
          }
          this.activeBoss.hp -= 1500;
          this.activeBoss.isStunned = true;
          this.activeBoss.stunTimer = 4.0;
          window.gameInstance.env.boneMaskDecoy.isArmed = false;
          if (window.gameInstance.particles && window.gameInstance.particles.emitSparks) {
            window.gameInstance.particles.emitSparks(this.activeBoss.mesh.position.clone().add(new THREE.Vector3(0, 3.2, 0)), 35);
          }
          if (window.gameInstance && window.gameInstance.ui && window.gameInstance.ui.showAnnouncement) {
            window.gameInstance.ui.showAnnouncement('💥 PIÈGE DU MASQUE D\'OS DÉCLENCHÉ : FLÉCHETTES DÉVIÉES DANS LE CRÂNE DU FERAL (1500 DMG) !', 'success');
          }
        } else {
          if (this.audioEngine && this.audioEngine.playCrossbowHomingDarts) {
            this.audioEngine.playCrossbowHomingDarts();
          }
          for (let f = 0; f < 3; f++) {
            setTimeout(() => {
              if (this.activeBoss && player) {
                const fDir = player.position.clone().sub(this.activeBoss.mesh.position).normalize();
                this.spawnAcidSpit(this.activeBoss.mesh.position.clone().add(new THREE.Vector3(0, 2.8, 0)), fDir);
              }
            }, f * 100);
          }
          if (window.gameInstance && window.gameInstance.ui && window.gameInstance.ui.showAnnouncement) {
            window.gameInstance.ui.showAnnouncement('🎯 SALVE D\'ARBALÈTE PNEUMATIQUE DU FERAL PREDATOR !', 'warning');
          }
        }
      }

      // 2. Melee range: Leaping Obsidian Cut Spear Impale (420 Dmg)
      if (dist <= 6.5 && this.activeBoss.spearCooldown <= 0 && !this.activeBoss.isStunned) {
        this.activeBoss.spearCooldown = 4.2;
        if (this.audioEngine && this.audioEngine.playFeralPredatorPrimalRoar) {
          this.audioEngine.playFeralPredatorPrimalRoar();
        }
        player.takeDamage(420, false, this.activeBoss);
        if (window.gameInstance && window.gameInstance.particles && window.gameInstance.particles.emitSparks) {
          window.gameInstance.particles.emitSparks(player.position.clone().add(new THREE.Vector3(0, 1.4, 0)), 28);
        }
        if (window.gameInstance && window.gameInstance.ui && window.gameInstance.ui.showAnnouncement) {
          window.gameInstance.ui.showAnnouncement('⚔️ EMPALEMENT À LA LANCE D\'OBSIDIENNE DU FERAL PREDATOR (420 DMG) !', 'error');
        }
      }
    } else if (this.activeBoss.type === 'apex_gladiator_predator') {
      // Predator: Killer of Killers (2025): 3.2m Grandmaster Arbiter AI
      if (!this.activeBoss.glaiveCooldown) this.activeBoss.glaiveCooldown = 3.2;
      this.activeBoss.glaiveCooldown -= delta;

      if (!this.activeBoss.stasisBeamCooldown) this.activeBoss.stasisBeamCooldown = 4.0;
      this.activeBoss.stasisBeamCooldown -= delta;

      if (dist > 0.1) {
        this.activeBoss.mesh.lookAt(player.position.x, this.activeBoss.mesh.position.y, player.position.z);
      }

      // Phase 2 Stasis Shield at < 50% HP
      if (this.activeBoss.hp <= 4500 && !this.activeBoss.stasisShieldActivated) {
        this.activeBoss.stasisShieldActivated = true;
        this.activeBoss.hasPhaseShield = true;
        this.activeBoss.phaseShieldHp = 2200;
        if (this.audioEngine && this.audioEngine.playStasisPodDecompression) {
          this.audioEngine.playStasisPodDecompression();
        }
        if (this.audioEngine && this.audioEngine.playApexGladiatorRoar) {
          this.audioEngine.playApexGladiatorRoar();
        }
        if (window.gameInstance && window.gameInstance.ui && window.gameInstance.ui.showAnnouncement) {
          window.gameInstance.ui.showAnnouncement('🛡️ CHAMP DE FORCE DE STASE COSMIQUE DU GRAND MAÎTRE ARBITRE DÉPLOYÉ (2200 BOUCLIER) !', 'warning');
        }
      }

      // 1. Long range: Twin Stasis Plasma Barrage
      if (dist > 7.5 && dist <= 40.0 && this.activeBoss.stasisBeamCooldown <= 0 && !this.activeBoss.isStunned) {
        this.activeBoss.stasisBeamCooldown = 4.2;
        if (this.audioEngine && this.audioEngine.playBurnerHeavyPlasmaBlast) {
          this.audioEngine.playBurnerHeavyPlasmaBlast();
        }
        for (let b = 0; b < 2; b++) {
          setTimeout(() => {
            if (this.activeBoss && player) {
              const pDir = player.position.clone().sub(this.activeBoss.mesh.position).normalize();
              this.spawnAcidSpit(this.activeBoss.mesh.position.clone().add(new THREE.Vector3(0, 3.2, 0)), pDir);
            }
          }, b * 180);
        }
        if (window.gameInstance && window.gameInstance.ui && window.gameInstance.ui.showAnnouncement) {
          window.gameInstance.ui.showAnnouncement('⚡ DOUBLE DÉCHARGE DE STASE PLASMA DU GRAND MAÎTRE YAUTJA !', 'warning');
        }
      }

      // 2. Melee range: Dual Plasma Glaive Whirlwind Slash (480 Dmg)
      if (dist <= 7.0 && this.activeBoss.glaiveCooldown <= 0 && !this.activeBoss.isStunned) {
        this.activeBoss.glaiveCooldown = 3.6;
        if (this.audioEngine && this.audioEngine.playApexGladiatorRoar) {
          this.audioEngine.playApexGladiatorRoar();
        }
        player.takeDamage(480, false, this.activeBoss);
        if (window.gameInstance && window.gameInstance.particles && window.gameInstance.particles.emitSparks) {
          window.gameInstance.particles.emitSparks(player.position.clone().add(new THREE.Vector3(0, 1.5, 0)), 32);
        }
        if (window.gameInstance && window.gameInstance.ui && window.gameInstance.ui.showAnnouncement) {
          window.gameInstance.ui.showAnnouncement('⚔️ MOULINET TOURNOYANT AUX DOUBLES GLAIVES DU GRAND MAÎTRE GLADIATEUR (480 DMG) !', 'error');
        }
      }
    } else if (this.activeBoss.type === 'ultimate_upgrade_predator') {
      // The Predator (2018): 3.3m Ultimate Upgrade Predator AI
      if (!this.activeBoss.cannonCooldown) this.activeBoss.cannonCooldown = 3.5;
      this.activeBoss.cannonCooldown -= delta;

      if (!this.activeBoss.roarCooldown) this.activeBoss.roarCooldown = 6.0;
      this.activeBoss.roarCooldown -= delta;

      if (dist > 0.1) {
        this.activeBoss.mesh.lookAt(player.position.x, this.activeBoss.mesh.position.y, player.position.z);
      }

      // 1. Long range: Shoulder Plasma Cannon Blast
      if (dist > 8.0 && dist <= 42.0 && this.activeBoss.cannonCooldown <= 0) {
        this.activeBoss.cannonCooldown = 4.0;
        if (this.audioEngine && this.audioEngine.playBurnerHeavyPlasmaBlast) {
          this.audioEngine.playBurnerHeavyPlasmaBlast();
        }
        for (let b = 0; b < 2; b++) {
          setTimeout(() => {
            if (this.activeBoss && player) {
              const pDir = player.position.clone().sub(this.activeBoss.mesh.position).normalize();
              this.spawnAcidSpit(this.activeBoss.mesh.position.clone().add(new THREE.Vector3(0, 3.8, 0)), pDir);
            }
          }, b * 200);
        }
        if (window.gameInstance && window.gameInstance.ui && window.gameInstance.ui.showAnnouncement) {
          window.gameInstance.ui.showAnnouncement('💥 CANON D\'ÉPAULE DE L\'ULTIMATE PREDATOR EN SALVE !', 'warning');
        }
      }

      // 2. Melee range: Titanic Roar Stun & Dual Wristblade Cleave (480 Dmg)
      if (dist <= 7.2 && this.activeBoss.roarCooldown <= 0) {
        this.activeBoss.roarCooldown = 5.0;
        if (this.audioEngine && this.audioEngine.playUltimatePredatorRoar) {
          this.audioEngine.playUltimatePredatorRoar();
        }
        player.takeDamage(480, false, this.activeBoss);
        if (window.gameInstance && window.gameInstance.particles && window.gameInstance.particles.emitSparks) {
          window.gameInstance.particles.emitSparks(player.position.clone().add(new THREE.Vector3(0, 1.6, 0)), 30);
        }
        if (window.gameInstance && window.gameInstance.ui && window.gameInstance.ui.showAnnouncement) {
          window.gameInstance.ui.showAnnouncement('⚠️ IMPACT TITANESQUE DE L\'ULTIMATE PREDATOR (480 DMG) !', 'error');
        }
      }
    } else if (this.activeBoss.type === 'rogue_king_prime') {
      // Chantier 2 (v52.0): Rogue King Xenomorph Prime Charge, Pheromone Frenzy & Scythe Cleave
      if (!this.activeBoss.chargeCooldown) this.activeBoss.chargeCooldown = 4.5;
      this.activeBoss.chargeCooldown -= delta;

      if (this.activeBoss.isCharging) {
        this.activeBoss.chargeTimer -= delta;
        const cFwd = this.activeBoss.chargeDir || dir.clone().normalize();
        this.activeBoss.mesh.position.addScaledVector(cFwd, 22.0 * delta);

        if (dist <= 4.2) {
          player.takeDamage(380);
          const push = cFwd.clone().normalize();
          player.position.addScaledVector(push, 14.0);
          if (player.mesh) player.mesh.position.copy(player.position);
          this.activeBoss.isCharging = false;
          if (this.audioEngine && this.audioEngine.playRogueKingBatteringRam) {
            this.audioEngine.playRogueKingBatteringRam();
          }
        }

        if (this.activeBoss.chargeTimer <= 0) {
          this.activeBoss.isCharging = false;
        }
      } else if (dist > 7.0 && dist < 38.0 && this.activeBoss.chargeCooldown <= 0) {
        this.activeBoss.chargeCooldown = 7.5;
        this.activeBoss.isCharging = true;
        this.activeBoss.chargeTimer = 1.6;
        this.activeBoss.chargeDir = dir.clone().normalize();
        this.activeBoss.mesh.lookAt(this.activeBoss.mesh.position.clone().add(this.activeBoss.chargeDir));
        if (this.audioEngine && this.audioEngine.playRogueKingEarthquakeRoar) {
          this.audioEngine.playRogueKingEarthquakeRoar();
        }
        if (window.gameInstance && window.gameInstance.ui && window.gameInstance.ui.showAnnouncement) {
          window.gameInstance.ui.showAnnouncement('💥 CHARGE BÉLIER DU ROI XÉNOMORPHE DÉCHAÎNÉ ! ÉCARTEZ-VOUS !');
        }
      }

      // Pheromone Frenzy Wave (every 8.5s)
      if (!this.activeBoss.pheromoneCooldown) this.activeBoss.pheromoneCooldown = 6.0;
      this.activeBoss.pheromoneCooldown -= delta;
      if (this.activeBoss.pheromoneCooldown <= 0) {
        this.activeBoss.pheromoneCooldown = 9.0;
        if (this.audioEngine && this.audioEngine.playAlienQueenPheromoneFrenzy) {
          this.audioEngine.playAlienQueenPheromoneFrenzy();
        }
        if (horde && horde.aliens) {
          horde.aliens.forEach(a => {
            if (a && a.hp > 0 && a.mesh && a.mesh.position.distanceTo(this.activeBoss.mesh.position) <= 24.0) {
              a.isPheromoneEnraged = true;
              a.enrageTimer = 6.0;
            }
          });
        }
        if (window.gameInstance && window.gameInstance.ui && window.gameInstance.ui.showAnnouncement) {
          window.gameInstance.ui.showAnnouncement('🧪 FRÉNÉSIE PHÉROMONALE DU ROI XÉNO : ESSAIMS SURVOLTÉS (+40% VITESSE) !');
        }
      }

      // Tail Scythe Cleave in close range
      if (dist <= 6.5 && this.activeBoss.tailWhipCooldown <= 0) {
        this.activeBoss.tailWhipCooldown = 3.2;
        this.triggerTailWhip(player);
      }
    } else if ((this.activeBoss.type === 'predalien_queen' || this.activeBoss.type === 'predalien_abomination' || this.activeBoss.type === 'predalien_matriarch_titan') && dist > 4.5 && dist < 32.0 && this.activeBoss.regurgitateCooldown <= 0) {
      this.activeBoss.regurgitateCooldown = this.activeBoss.type === 'predalien_matriarch_titan' ? 4.5 : (this.activeBoss.type === 'predalien_abomination' ? 5.2 : 6.5);
      if (this.activeBoss.type === 'predalien_abomination' || this.activeBoss.type === 'predalien_matriarch_titan') {
        this.regurgitateBellyVomit(player, horde);
      } else {
        this.regurgitateChestbursters(player, horde);
      }
    }

    // Predalien Matriarch Titan Royal Leap Slam (AvP Extinction 14m Shockwave)
    if (this.activeBoss.type === 'predalien_matriarch_titan') {
      if (!this.activeBoss.royalSlamCooldown) this.activeBoss.royalSlamCooldown = 5.5;
      this.activeBoss.royalSlamCooldown -= delta;
      if (dist <= 14.0 && this.activeBoss.royalSlamCooldown <= 0) {
        this.activeBoss.royalSlamCooldown = 7.0;
        this.triggerMatriarchRoyalSlam(player, horde);
      }
    }

    // The Offspring Signature Attack: Sonic Shriek & Rapid Grapple (Romulus 2024 Lore)
    if (this.activeBoss.type === 'the_offspring') {
      if (!this.activeBoss.shriekCooldown) this.activeBoss.shriekCooldown = 4.0;
      this.activeBoss.shriekCooldown -= delta;
      if (this.activeBoss.shriekCooldown <= 0 && dist <= 16.0) {
        this.activeBoss.shriekCooldown = 5.5;
        this.audioEngine.playOffspringShriek();
        if (dist <= 10.0) {
          player.takeDamage(60);
          player.plasmaEnergy = Math.max(0, (player.plasmaEnergy || 100) - 25); // Drains plasma energy
        }
      }
    }

    // Empress Matriarch Signature Gale Shockwave Knockback (Aliens: Rogue Lore)
    if (this.activeBoss.type === 'empress_matriarch' && dist <= 13.0 && this.activeBoss.galeFlapCooldown <= 0) {
      this.activeBoss.galeFlapCooldown = 6.5;
      this.triggerEmpressGale(player, horde);
    }

    // Queen/Empress Long range: Acid Mortar Spit
    if (dist > 9.0 && dist < 35.0 && this.activeBoss.spitCooldown <= 0 && this.activeBoss.type !== 'the_offspring') {
      this.activeBoss.spitCooldown = 4.5;
      this.spitAcidMortar(player);
    }

    // Chantier 1 (v43): Queen Enrage Mode upon Ovipositor Severance
    const speedMult = this.activeBoss.isEnraged ? 1.4 : 1.0;

    // Queen Caudal Tail Skewer Thrust (Aliens 1986 Bishop Impalement Lore)
    if ((this.activeBoss.type === 'xenomorph_queen' || this.activeBoss.type === 'imperial_queen' || this.activeBoss.type === 'predalien_queen' || this.activeBoss.type === 'predalien_abomination') && dist <= 7.5 && this.activeBoss.tailSkewerCooldown <= 0) {
      this.activeBoss.tailSkewerCooldown = this.activeBoss.isEnraged ? 2.8 : 5.5;
      this.triggerTailSkewer(player);
    }

    // Medium-close range: Tail Whip 360
    if (dist <= 8.5 && this.activeBoss.tailWhipCooldown <= 0) {
      this.activeBoss.tailWhipCooldown = this.activeBoss.isEnraged ? 2.2 : 4.0;
      this.triggerTailWhip(player);
    }

    // Movement
    if (dist > 3.0) {
      dir.normalize();
      let baseSpeed = this.activeBoss.type === 'the_offspring' ? 10.5 : (this.activeBoss.type === 'trilobite_prime' ? 6.5 : (this.activeBoss.type === 'empress_matriarch' ? 8.5 : 7.5));
      const moveSpeed = baseSpeed * speedMult;
      this.activeBoss.mesh.position.addScaledVector(dir, moveSpeed * delta);
      this.activeBoss.mesh.rotation.y = Math.atan2(dir.x, dir.z);
      // Trample and crush Catwalk Pillars on contact (Chantier 4)
      if (typeof window !== 'undefined' && window.gameInstance && window.gameInstance.env && window.gameInstance.env.damageCatwalkPillars) {
        window.gameInstance.env.damageCatwalkPillars(this.activeBoss.mesh.position, 4.0, 90 * delta, this.audioEngine, window.gameInstance.particles);
      }
    } else {
      player.takeDamage((this.activeBoss.type === 'the_offspring' ? 65 : (this.activeBoss.type === 'trilobite_prime' ? 70 : 45)) * delta * speedMult);
    }

    // Chantier 5 (v43): Praetorian Royal Shield Phalanx Queen Bodyguard Protocol
    if (horde && horde.aliens) {
      horde.aliens.forEach(a => {
        if (!a || a.hp <= 0 || !a.mesh || a.type !== 'praetorian') return;
        a.isPhalanxGuarding = true;
        // Position Praetorian directly between player and Queen to form an armored shield wall
        const shieldPos = this.activeBoss.mesh.position.clone().lerp(player.position, 0.42);
        shieldPos.y = 0;
        const shieldDir = shieldPos.sub(a.mesh.position);
        if (shieldDir.length() > 1.2) {
          shieldDir.normalize();
          a.mesh.position.addScaledVector(shieldDir, 8.5 * delta);
        }
        // Face player with armored cranial crest
        const toPlayer = player.position.clone().sub(a.mesh.position).normalize();
        a.mesh.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
      });
    }
  }

  clear() {
    if (this.activeBoss) {
      this.scene.remove(this.activeBoss.mesh);
      this.activeBoss = null;
    }
    this.acidSpitProjectiles.forEach(p => this.scene.remove(p.mesh));
    this.acidSpitProjectiles = [];
    this.embryoProjectiles.forEach(p => this.scene.remove(p.mesh));
    this.embryoProjectiles = [];
  }
}
