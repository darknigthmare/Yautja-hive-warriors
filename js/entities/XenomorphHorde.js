/* Xenomorph Swarm Engine 3.0 - Crusher, Praetorian, Ovimorph Eggs & Gore */

import * as THREE from 'three';

export class XenomorphHorde {
  constructor(scene, audioEngine, goreEngine = null) {
    this.scene = scene;
    this.audioEngine = audioEngine;
    this.goreEngine = goreEngine;
    this.aliens = [];
    this.eggs = [];
    this.chestbursters = [];
    this.acidPools = [];
    this.acidSplashes = [];
    this.zeroGAcidGlobules = [];
    this.spitterMortars = [];
    this.deadCount = 0;

    this.acidSplashMat = new THREE.MeshBasicMaterial({ color: 0x39ff14 });
    this.zeroGAcidMat = new THREE.MeshStandardMaterial({
      color: 0x39ff14,
      emissive: 0x22aa00,
      transparent: true,
      opacity: 0.82,
      roughness: 0.2,
      metalness: 0.1
    });
    this.zeroGAcidCoreMat = new THREE.MeshBasicMaterial({ color: 0xccff00 });
    this.eggMat = new THREE.MeshStandardMaterial({ color: 0x3d3522, roughness: 0.7, metalness: 0.1 });
    this.eggPetalMat = new THREE.MeshStandardMaterial({ color: 0x5a2d1d, roughness: 0.5, metalness: 0.2 });
    this.crusherMat = new THREE.MeshStandardMaterial({ color: 0x151b24, roughness: 0.2, metalness: 0.9 });
    this.praetorianMat = new THREE.MeshStandardMaterial({ color: 0x0f141c, roughness: 0.3, metalness: 0.85 });
    this.officerMat = new THREE.MeshStandardMaterial({ color: 0x220505, roughness: 0.15, metalness: 0.95 });
    // Marvel Comics Canon Materials (v44.0)
    this.alphaMat = new THREE.MeshStandardMaterial({ color: 0xd9e2ec, roughness: 0.12, metalness: 0.95 }); // Epsilon Apex Silver Carapace
    this.cryoMat = new THREE.MeshStandardMaterial({ color: 0x93c5fd, roughness: 0.1, metalness: 0.65, transparent: true, opacity: 0.88 }); // Sub-Zero LV-695 Translucent Ice Chitin
    this.cyberMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.25, metalness: 0.98 }); // Steel Team Weyland-Yutani Titanium Cyber Plating
    this.microSwarmMat = new THREE.MeshBasicMaterial({ color: 0x0f172a }); // Midge Micro-Xenomorph Chitin

    // Chantier 7 (v46): Chameleon Stalker Optical Cloak Materials (Aliens: Rogue)
    this.chameleonMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.05,
      metalness: 0.95,
      transparent: true,
      opacity: 0.18
    });
    this.chameleonRevealedMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      emissive: 0x00f2fe,
      roughness: 0.2,
      metalness: 0.8
    });

    // Chantier 4 & 7 (v47): The Deacon Titan & Flying Manta Swarmer Materials (Prometheus & Marvel/Kenner)
    this.deaconMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.22, metalness: 0.88 });
    this.mantaMat = new THREE.MeshStandardMaterial({ color: 0x1e152a, roughness: 0.35, metalness: 0.8 });
    this.mantaWingMat = new THREE.MeshStandardMaterial({ color: 0x2e1065, roughness: 0.45, metalness: 0.6, transparent: true, opacity: 0.88, side: THREE.DoubleSide });

    this.microSwarms = [];
    this.cyberSpineDarts = [];
    this.royalFacehuggers = [];
    this.mantaSwarmers = [];
  }

  setGoreEngine(goreEngine) {
    this.goreEngine = goreEngine;
  }

  spawnWave(count, playerPos) {
    this.clearWave();

    this.spawnOvimorphEggs(playerPos, 6);

    // Spawn 1 Crusher Titan
    this.spawnCrusher(playerPos);

    // Spawn 2 Praetorian Royal Guards
    this.spawnPraetorian(playerPos, -15);
    this.spawnPraetorian(playerPos, 15);

    // Spawn 1 Grid Alien Alpha (AVP 2004 Nethead)
    this.spawnGridAlien(playerPos);

    // Marvel Comics Canon: Spawn 1 Marvel Alpha Apex Predator (Epsilon Apex 1:1)
    this.spawnMarvelAlpha(playerPos);

    // Marvel Comics Canon: Spawn 1 Airborne Micro-Xenomorph Swarm (Midge / Mosquito Cloud)
    this.spawnMicroSwarm(playerPos);

    // Chantier 4 (v45): Spawn 2 Royal Gliding Facehuggers in High Ambush Perches (Alien 3 / Isolation Lore)
    this.spawnRoyalFacehugger(playerPos.clone().add(new THREE.Vector3(-18, 12, -16)), playerPos);
    this.spawnRoyalFacehugger(playerPos.clone().add(new THREE.Vector3(18, 12, 16)), playerPos);

    // Chantier 7 (v46): Spawn 2 Chameleon Stalker Xenomorphs with Active Camouflage (Aliens: Rogue)
    this.spawnChameleonStalker(playerPos);
    this.spawnChameleonStalker(playerPos);

    // Chantier 4 (v47): Spawn 1 Deacon Titan (Prometheus 2012 Canon)
    this.spawnDeaconTitan(playerPos);

    // Chantier 7 (v47): Spawn 2 Flying Xenomorph Manta Swarmers (Aliens Arcade / Kenner / Marvel)
    this.spawnMantaSwarmer(playerPos.clone().add(new THREE.Vector3(-20, 10, -20)), playerPos);
    this.spawnMantaSwarmer(playerPos.clone().add(new THREE.Vector3(20, 10, 20)), playerPos);

    // Dynasty Warriors Musou: Spawn 2 Hive Spire Captains / Node Guards (Gardes de Nœud & Sentinelles du Couvoir)
    this.spawnHiveOfficer(playerPos, -22, 'SENTINELLE DU NŒUD PRIMAIRE (SPIRE GUARD)');
    this.spawnHiveOfficer(playerPos, 22, 'GARDE SANGUINAIRE DU COUVOIR ROYAL (HIVE CASTE OFFICER)');

    // Massive Musou Swarm Density: at least 45 to 80 aliens
    const totalCount = Math.max(count, 45);
    for (let i = 0; i < totalCount; i++) {
      const isFacehugger = Math.random() < 0.13;
      const isBoiler = !isFacehugger && Math.random() < 0.13;
      const isNeomorph = !isFacehugger && !isBoiler && Math.random() < 0.13;
      const isPraetomorph = !isFacehugger && !isBoiler && !isNeomorph && Math.random() < 0.14;
      const isRedSwarm = !isFacehugger && !isBoiler && !isNeomorph && !isPraetomorph && Math.random() < 0.16;
      const isSpitter = !isFacehugger && !isBoiler && !isNeomorph && !isPraetomorph && !isRedSwarm && Math.random() < 0.17;
      const isCryoXeno = !isFacehugger && !isBoiler && !isNeomorph && !isPraetomorph && !isRedSwarm && !isSpitter && Math.random() < 0.19;
      const isCyberXeno = !isFacehugger && !isBoiler && !isNeomorph && !isPraetomorph && !isRedSwarm && !isSpitter && !isCryoXeno && Math.random() < 0.21;
      const isRunner = !isFacehugger && !isBoiler && !isNeomorph && !isPraetomorph && !isRedSwarm && !isSpitter && !isCryoXeno && !isCyberXeno && Math.random() < 0.25;
      const alien = this.createAlienMesh(isFacehugger, isBoiler, isNeomorph, isPraetomorph, isRedSwarm, isSpitter, isRunner, isCryoXeno, isCyberXeno);

      const angle = Math.random() * Math.PI * 2;
      const radius = 22 + Math.random() * 25;
      alien.position.set(
        playerPos.x + Math.cos(angle) * radius,
        0,
        playerPos.z + Math.sin(angle) * radius
      );

      const isWallStalker = !isFacehugger && !isBoiler && !isNeomorph && !isPraetomorph && !isRedSwarm && !isSpitter && !isRunner && !isCryoXeno && !isCyberXeno && Math.random() < 0.22;
      this.scene.add(alien);
      const aType = isFacehugger ? 'facehugger' : (isBoiler ? 'boiler' : (isNeomorph ? 'neomorph' : (isPraetomorph ? 'praetomorph' : (isRedSwarm ? 'red_warrior' : (isSpitter ? 'spitter' : (isCryoXeno ? 'cryo_xeno' : (isCyberXeno ? 'cyber_xeno' : (isRunner ? 'runner' : 'warrior'))))))));
      const aHp = isFacehugger ? 40 : (isBoiler ? 80 : (isNeomorph ? 95 : (isPraetomorph ? 160 : (isRedSwarm ? 140 : (isSpitter ? 110 : (isCryoXeno ? 175 : (isCyberXeno ? 220 : (isRunner ? 85 : 120))))))));
      const aSpeed = isFacehugger ? 17 : (isBoiler ? 14 : (isNeomorph ? 19 : (isPraetomorph ? 16 : (isRedSwarm ? 15.5 : (isSpitter ? 12 : (isCryoXeno ? 14.5 : (isCyberXeno ? 13.0 : (isRunner ? 21.0 : 11))))))));
      const aDmg = isFacehugger ? 15 : (isBoiler ? 50 : (isNeomorph ? 35 : (isPraetomorph ? 42 : (isRedSwarm ? 34 : (isSpitter ? 30 : (isCryoXeno ? 38 : (isCyberXeno ? 44 : (isRunner ? 28 : 25))))))));

      this.aliens.push({
        mesh: alien,
        type: aType,
        hp: aHp,
        maxHp: aHp,
        speed: aSpeed,
        damage: aDmg,
        radius: isFacehugger ? 0.6 : (isNeomorph ? 0.9 : (isPraetomorph ? 1.3 : (isRunner ? 0.85 : 1.15))),
        isLatched: false,
        isWallStalker: isWallStalker,
        wallClimbPhase: isWallStalker ? 'climbing' : 'grounded',
        perchHeight: 8.0 + Math.random() * 4.0,
        leapCooldown: (isNeomorph || isPraetomorph) ? 2.0 + Math.random() * 2.0 : 0,
        spitCooldown: isSpitter ? 2.5 + Math.random() * 2.0 : 0,
        frostBreathCooldown: isCryoXeno ? 3.5 + Math.random() * 2.0 : 0,
        cyberDartCooldown: isCyberXeno ? 4.0 + Math.random() * 2.0 : 0,
        isCryoImmune: isCryoXeno,
        hasCyberPlating: isCyberXeno,
        isLeaping: false,
        leapVelY: 0,
        isAirborne: false,
        airborneVelY: 0,
        airborneVelHoriz: new THREE.Vector3()
      });
    }
  }

  /* Chantier 1: Marvel Alpha Xenomorph Apex Predator (Marvel Comics Alien 2021-2022 Canon 1:1) */
  spawnMarvelAlpha(playerPos) {
    const group = new THREE.Group();
    const mat = this.alphaMat;
    const barbMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.95, roughness: 0.1 });

    // 3.8m Tall Stature
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.45, 2.6, 8), mat);
    torso.position.y = 1.8;
    group.add(torso);

    // Elongated Barbed Dome Cranium
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.5, 2.4, 8), mat);
    head.rotation.x = Math.PI / 2;
    head.position.set(0, 3.0, 0.8);
    group.add(head);

    // Barbed Cranial Crest Spines (Marvel Canon)
    for (let b = 0; b < 6; b++) {
      const barb = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.45, 4), barbMat);
      barb.rotation.x = -Math.PI / 3;
      barb.position.set((b % 2 === 0 ? -0.22 : 0.22), 3.3 + (b * 0.08), 0.2 - (b * 0.35));
      group.add(barb);
    }

    // Glowing Crimson Sensory Slits
    const redEyeMat = new THREE.MeshBasicMaterial({ color: 0xff0044 });
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), redEyeMat);
    eyeL.position.set(-0.24, 2.9, 1.6);
    group.add(eyeL);
    const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), redEyeMat);
    eyeR.position.set(0.24, 2.9, 1.6);
    group.add(eyeR);

    // 4 Articulated Dorsal Razor Scythes (Organic Scythe Blades)
    for (let s = 0; s < 4; s++) {
      const scythe = new THREE.Mesh(new THREE.ConeGeometry(0.12, 1.9, 4), mat);
      const isLeft = s % 2 === 0;
      scythe.position.set(isLeft ? -0.55 : 0.55, 2.5 + (s > 1 ? 0.6 : 0), -0.4 - (s > 1 ? 0.3 : 0));
      scythe.rotation.x = -Math.PI / 3.2;
      scythe.rotation.z = isLeft ? -0.45 : 0.45;
      group.add(scythe);
    }

    // Segmented Silver-Chitin Tail with Barbed Stinger
    for (let t = 0; t < 6; t++) {
      const tSeg = new THREE.Mesh(new THREE.CylinderGeometry(0.09 - t * 0.01, 0.07 - t * 0.01, 0.55, 6), mat);
      tSeg.position.set(0, 1.1 - t * 0.14, -0.4 - t * 0.38);
      tSeg.rotation.x = -0.5 + t * 0.1;
      group.add(tSeg);
    }
    const alphaStinger = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.55, 4), barbMat);
    alphaStinger.rotation.x = -Math.PI / 2;
    alphaStinger.position.set(0, 0.5, -2.7);
    group.add(alphaStinger);

    group.position.set(playerPos.x - 18, 0, playerPos.z - 30);
    this.scene.add(group);

    this.aliens.push({
      mesh: group,
      type: 'marvel_alpha',
      isMarvelAlpha: true,
      isOfficer: true,
      officerTitle: 'ALPHA APEX EPSILON (MARVEL CANON)',
      hp: 1800,
      maxHp: 1800,
      speed: 15.0,
      damage: 65,
      radius: 2.3,
      commandRoarCooldown: 5.0,
      isStunned: false,
      stunTimer: 0,
      isBallisticArmored: true, // 50% ballistic armor
      isAirborne: false,
      airborneVelY: 0,
      airborneVelHoriz: new THREE.Vector3()
    });
  }

  /* Chantier 7 (v46): Chameleon Stalker Xenomorph with Active Camouflage (Aliens: Rogue Canon 1:1) */
  spawnChameleonStalker(playerPos) {
    const group = new THREE.Group();
    const mat = this.chameleonMat;

    // Torso (Agile predatory physique)
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.22, 1.8, 8), mat);
    torso.position.y = 1.2;
    torso.rotation.x = 0.35;
    group.add(torso);

    // Elongated Sleek Translucent Cranial Dome
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.32, 1.8, 8), mat);
    head.rotation.x = Math.PI / 2;
    head.position.set(0, 1.9, 0.5);
    group.add(head);

    // Barbed Dorsal Exhaust Tubes
    [-0.2, 0.2].forEach(ox => {
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.7, 6), mat);
      tube.position.set(ox, 1.7, -0.2);
      tube.rotation.x = -0.55;
      group.add(tube);
    });

    // Articulated Chitinous Claws
    [-0.5, 0.5].forEach(ox => {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 1.1, 6), mat);
      arm.position.set(ox, 1.3, 0.2);
      arm.rotation.x = 0.45;
      group.add(arm);
    });

    // Flexible Chitin Tail with Barbed Stalker Blade
    for (let t = 0; t < 5; t++) {
      const tSeg = new THREE.Mesh(new THREE.CylinderGeometry(0.07 - t * 0.01, 0.05 - t * 0.01, 0.45, 6), mat);
      tSeg.position.set(0, 0.7 - t * 0.1, -0.3 - t * 0.3);
      tSeg.rotation.x = -0.4;
      group.add(tSeg);
    }

    const angle = Math.random() * Math.PI * 2;
    const radius = 24 + Math.random() * 8;
    group.position.set(
      playerPos.x + Math.cos(angle) * radius,
      0,
      playerPos.z + Math.sin(angle) * radius
    );
    this.scene.add(group);

    this.aliens.push({
      mesh: group,
      type: 'chameleon_stalker',
      isChameleon: true,
      hp: 420,
      maxHp: 420,
      speed: 13.5,
      damage: 45,
      radius: 1.6,
      pounceCooldown: 3.5,
      cloakFlickerTimer: 0,
      flankAngle: (Math.random() - 0.5) * Math.PI,
      isAirborne: false,
      airborneVelY: 0,
      airborneVelHoriz: new THREE.Vector3(),
      isStunned: false,
      stunTimer: 0
    });
  }

  /* Chantier 4 (v47): The Deacon Titan (Prometheus 2012 Primordial Engineer Alien Canon) */
  spawnDeaconTitan(playerPos) {
    const group = new THREE.Group();
    const deaconMat = this.deaconMat;
    const teethMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.15, metalness: 0.1 });
    const innerJawMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3, metalness: 0.85 });

    // 1. Torso & Muscular Primordial Spine
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.42, 2.6, 8), deaconMat);
    torso.position.y = 1.6;
    torso.rotation.x = 0.35;
    group.add(torso);

    // Dorsal rib ridges (No biomechanical tubes - smooth biological body)
    for (let r = 0; r < 5; r++) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(0.55 - r * 0.05, 0.08, 6, 12), deaconMat);
      rib.rotation.x = Math.PI / 2;
      rib.position.set(0, 1.3 + r * 0.25, -0.15 - r * 0.08);
      rib.scale.set(1.1, 0.5, 0.9);
      group.add(rib);
    }

    // 2. Pointed Conical Cranium (Prometheus 2012 1:1 Anatomy)
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.38, 2.4, 8), deaconMat);
    head.rotation.x = Math.PI / 2 + 0.15;
    head.position.set(0, 2.4, 0.7);
    group.add(head);

    // Humanoid outer mouth & decoupled pharyngeal inner jaw
    const outerJaw = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.65), deaconMat);
    outerJaw.position.set(0, 2.05, 1.25);
    group.add(outerJaw);

    // Inner Pharyngeal Jaw with human-like white enamel teeth
    const innerJaw = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.85), innerJawMat);
    innerJaw.position.set(0, 2.05, 1.55);
    group.add(innerJaw);

    // Humanoid teeth row
    for (let t = -3; t <= 3; t++) {
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.06, 0.035), teethMat);
      tooth.position.set(t * 0.032, 2.12, 1.9);
      group.add(tooth);

      const toothLower = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.06, 0.035), teethMat);
      toothLower.position.set(t * 0.032, 1.98, 1.9);
      group.add(toothLower);
    }

    // 3. Quadrupedal Heavy Limbs
    [-0.65, 0.65].forEach(side => {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.1, 2.2, 6), deaconMat);
      arm.position.set(side, 1.3, 0.6);
      arm.rotation.x = 0.45;
      arm.rotation.z = side * 0.2;
      group.add(arm);

      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.12, 2.4, 6), deaconMat);
      leg.position.set(side * 0.9, 1.0, -0.6);
      leg.rotation.x = -0.3;
      group.add(leg);
    });

    const angle = Math.random() * Math.PI * 2;
    const radius = 28 + Math.random() * 8;
    group.position.set(
      playerPos.x + Math.cos(angle) * radius,
      0,
      playerPos.z + Math.sin(angle) * radius
    );
    this.scene.add(group);

    if (this.audioEngine && this.audioEngine.playDeaconJawHiss) {
      this.audioEngine.playDeaconJawHiss();
    }

    this.aliens.push({
      mesh: group,
      type: 'deacon_titan',
      isDeacon: true,
      hp: 2400,
      maxHp: 2400,
      speed: 16.5,
      damage: 65,
      radius: 2.2,
      chompCooldown: 2.5,
      tackleCooldown: 4.5,
      isStunned: false,
      stunTimer: 0,
      canBeTrophyHarvested: false,
      isAirborne: false,
      airborneVelY: 0
    });
  }

  /* Chantier 7 (v47): Flying Xenomorph Manta Swarmer (Aliens Arcade / Kenner / Marvel Comics) */
  spawnMantaSwarmer(spawnPos, targetPlayer = null) {
    const group = new THREE.Group();
    const bodyMat = this.mantaMat;
    const wingMat = this.mantaWingMat;
    const barbMat = new THREE.MeshStandardMaterial({ color: 0x9333ea, metalness: 0.9, roughness: 0.2 });

    // 1. Sleek Aerodynamic Fuselage
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 2.2, 8), bodyMat);
    body.rotation.x = Math.PI / 2;
    body.position.y = 0;
    group.add(body);

    // Pointed cranial aerodynamic snout
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.1, 6), bodyMat);
    head.rotation.x = -Math.PI / 2;
    head.position.set(0, 0, 1.4);
    group.add(head);

    // 2. Wide Aerodynamic Manta Bat-Wings (Span ~ 4.6m)
    const wingL = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.4), wingMat);
    wingL.rotation.x = -Math.PI / 2;
    wingL.position.set(-1.3, 0.05, 0);
    group.add(wingL);

    const wingR = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.4), wingMat);
    wingR.rotation.x = -Math.PI / 2;
    wingR.position.set(1.3, 0.05, 0);
    group.add(wingR);

    // 3. Serrated Whip Stinger Tail
    for (let t = 0; t < 5; t++) {
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.06 - t * 0.01, 0.04 - t * 0.01, 0.5, 5), bodyMat);
      seg.position.set(0, -0.05 - t * 0.04, -1.2 - t * 0.4);
      seg.rotation.x = 0.2;
      group.add(seg);
    }
    const stinger = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.45, 4), barbMat);
    stinger.position.set(0, -0.25, -3.2);
    stinger.rotation.x = Math.PI / 2;
    group.add(stinger);

    group.userData.wingL = wingL;
    group.userData.wingR = wingR;

    group.position.copy(spawnPos);
    this.scene.add(group);

    if (this.audioEngine && this.audioEngine.playMantaDiveScreech) {
      this.audioEngine.playMantaDiveScreech();
    }

    this.mantaSwarmers.push({
      mesh: group,
      hp: 320,
      maxHp: 320,
      speed: 15.0,
      diveSpeed: 26.0,
      damage: 65,
      divePhase: 'cruising',
      cruiseAltitude: 8.5 + Math.random() * 3.5,
      diveCooldown: 3.5 + Math.random() * 2.5,
      diveTarget: new THREE.Vector3(),
      flutterPhase: Math.random() * Math.PI * 2
    });
  }

  /* Chantier 2: Mosquito / Midge Micro-Xenomorph Swarm (Marvel Comics Alien: Thaw Canon 1:1) */
  spawnMicroSwarm(playerPos) {
    const swarmGroup = new THREE.Group();
    const wingMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
    const microUnits = [];

    // Cloud of 12 airborne winged micro-xenomorphs
    for (let u = 0; u < 12; u++) {
      const unitGroup = new THREE.Group();

      // Micro thorax
      const thorax = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), this.microSwarmMat);
      unitGroup.add(thorax);

      // Barbed elongated cranium
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.3, 5), this.microSwarmMat);
      head.rotation.x = Math.PI / 2;
      head.position.z = 0.18;
      unitGroup.add(head);

      // Translucent vibrating insectoid wings
      const wingL = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.12), wingMat);
      wingL.position.set(-0.14, 0.08, 0);
      wingL.rotation.y = 0.3;
      unitGroup.add(wingL);

      const wingR = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.12), wingMat);
      wingR.position.set(0.14, 0.08, 0);
      wingR.rotation.y = -0.3;
      unitGroup.add(wingR);

      // Spread inside cloud sphere
      const ang = (u / 12) * Math.PI * 2;
      const r = 0.6 + (u % 3) * 0.45;
      unitGroup.position.set(Math.cos(ang) * r, 0.2 + (u % 4) * 0.35, Math.sin(ang) * r);
      swarmGroup.add(unitGroup);

      microUnits.push({
        group: unitGroup,
        wingL,
        wingR,
        basePos: unitGroup.position.clone(),
        flutterOffset: Math.random() * Math.PI * 2
      });
    }

    swarmGroup.position.set(playerPos.x + 8, 2.0, playerPos.z + 8);
    this.scene.add(swarmGroup);

    this.microSwarms.push({
      group: swarmGroup,
      units: microUnits,
      hp: 150,
      maxHp: 150,
      damage: 8,
      orbitAngle: 0,
      orbitRadius: 2.4,
      orbitSpeed: 3.5,
      buzzTimer: 0,
      isDead: false
    });
  }

  spawnHiveOfficer(playerPos, offsetX = 0, title = 'GARDE DE NŒUD KAINDE AMEDHA') {
    const group = new THREE.Group();
    // 1.35x Musou Officer Stature with Blood-Red Carapace and Heavy Dorsal Pipes
    const mat = this.officerMat;
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.4, 2.2, 8), mat);
    torso.position.y = 1.6;
    group.add(torso);

    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 2.0, 8), mat);
    head.rotation.x = Math.PI / 2;
    head.position.set(0, 2.6, 0.7);
    group.add(head);

    // Glowing Officer Crest Crown
    const crestMat = new THREE.MeshBasicMaterial({ color: 0xff1a1a });
    const crest = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.2, 5), crestMat);
    crest.rotation.x = Math.PI / 2.3;
    crest.position.set(0, 2.9, -0.3);
    group.add(crest);

    // 4 Dorsal Exhaust Spikes
    for (let p = 0; p < 4; p++) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.04, 1.1, 6), mat);
      pipe.position.set((p % 2 === 0 ? -0.35 : 0.35), 2.1 + (p > 1 ? 0.4 : 0), -0.4 - (p > 1 ? 0.2 : 0));
      pipe.rotation.x = -Math.PI / 4;
      group.add(pipe);
    }

    group.position.set(playerPos.x + offsetX, 0, playerPos.z - 30);
    this.scene.add(group);

    this.aliens.push({
      mesh: group,
      type: 'officer',
      officerTitle: title,
      isOfficer: true,
      hp: 350,
      maxHp: 350,
      speed: 13.5,
      damage: 38,
      radius: 1.6,
      isAirborne: false,
      airborneVelY: 0,
      airborneVelHoriz: new THREE.Vector3()
    });
  }

  spawnCrusher(playerPos) {
    const group = new THREE.Group();
    // Massive Quadruped Battering Ram Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.2, 4.0), this.crusherMat);
    body.position.y = 2.0;
    group.add(body);

    // Bulletproof Massive Armored Head Crest
    const crest = new THREE.Mesh(new THREE.ConeGeometry(2.2, 3.5, 6), this.crusherMat);
    crest.rotation.x = Math.PI / 2.3;
    crest.position.set(0, 2.8, 2.5);
    group.add(crest);

    group.position.set(playerPos.x, 0, playerPos.z - 35);
    this.scene.add(group);

    this.aliens.push({
      mesh: group,
      type: 'crusher',
      hp: 750,
      maxHp: 750,
      speed: 16,
      damage: 60,
      radius: 2.8,
      isCharging: false,
      chargeTimer: 3.0
    });
  }

  spawnPraetorian(playerPos, offsetX = 0) {
    const group = new THREE.Group();
    // 4-meter tall Royal Guard
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.5, 2.8, 8), this.praetorianMat);
    torso.position.y = 2.4;
    group.add(torso);

    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 2.2, 8), this.praetorianMat);
    head.rotation.x = Math.PI / 2;
    head.position.set(0, 3.8, 0.6);
    group.add(head);

    // Crown crest
    const crown = new THREE.Mesh(new THREE.ConeGeometry(1.2, 1.8, 5), this.praetorianMat);
    crown.rotation.x = Math.PI / 2.5;
    crown.position.set(0, 4.2, -0.4);
    group.add(crown);

    group.position.set(playerPos.x + offsetX, 0, playerPos.z - 28);
    this.scene.add(group);

    this.aliens.push({
      mesh: group,
      type: 'praetorian',
      hp: 480,
      maxHp: 480,
      speed: 13,
      damage: 40,
      radius: 1.8,
      spitCooldown: 2.0
    });
  }

  /* Chantier 4 (v45): Armored Winged Royal Facehugger Gliding Ambush (Alien 3 / Isolation Lore) */
  spawnRoyalFacehugger(spawnPos, targetPlayer = null) {
    const mesh = this.createAlienMesh(false, false, false, false, false, false, false, false, false, true);
    mesh.position.copy(spawnPos);
    this.scene.add(mesh);

    if (this.audioEngine && this.audioEngine.playRoyalFacehuggerShriek) {
      this.audioEngine.playRoyalFacehuggerShriek();
    }

    this.royalFacehuggers.push({
      mesh,
      hp: 140,
      maxHp: 140,
      isGliding: true,
      glideSpeed: 15.0,
      isLatched: false,
      latchTimer: 5.0,
      struggleCount: 0,
      struggleMax: 8,
      flutterPhase: 0
    });
  }

  struggleRoyalFacehugger(player) {
    for (let i = this.royalFacehuggers.length - 1; i >= 0; i--) {
      const rf = this.royalFacehuggers[i];
      if (rf.isLatched) {
        rf.struggleCount++;
        if (window.gameInstance && window.gameInstance.ui) {
          window.gameInstance.ui.showAnnouncement(`⚠️ LUTTE CONTRE LE PARASITE ROYAL : [ESPACE] (${rf.struggleCount}/${rf.struggleMax}) !`);
        }
        if (this.audioEngine && this.audioEngine.playGauntletGrapple) {
          this.audioEngine.playGauntletGrapple();
        }

        if (rf.struggleCount >= rf.struggleMax) {
          if (this.goreEngine && this.goreEngine.spawnDismemberment) {
            this.goreEngine.spawnDismemberment(rf.mesh.position, 'heavy');
          }
          this.spawnAcidPool(player.position);
          this.scene.remove(rf.mesh);
          this.royalFacehuggers.splice(i, 1);
          player.isRoyalFacehuggerLatched = false;

          if (this.audioEngine && this.audioEngine.playHeavySlamImpact) {
            this.audioEngine.playHeavySlamImpact();
          }
          if (window.gameInstance) {
            window.gameInstance.score += 350;
            if (window.gameInstance.ui) {
              window.gameInstance.ui.showAnnouncement('⚔️ PARASITE ROYAL ARRACHÉ DU BIO-MASQUE ET BROYÉ (+350 PTS) !');
            }
          }
          return true;
        }
        return true;
      }
    }
    return false;
  }

  spawnGridAlien(playerPos) {
    const group = new THREE.Group();
    const xenoMat = new THREE.MeshStandardMaterial({ color: 0x0a0e14, roughness: 0.25, metalness: 0.85 });
    const gridScarMat = new THREE.MeshBasicMaterial({ color: 0x39ff14 }); // Glowing neon acid burn scars

    // Head dome
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.38, 1.8, 8), xenoMat);
    head.rotation.x = Math.PI / 2;
    head.position.set(0, 2.2, 0.5);
    group.add(head);

    // Grid lattice scars on the head (Celtic Predator Netgun scars - AVP 2004)
    for (let g = 0; g < 7; g++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.02, 4, 16), gridScarMat);
      ring.position.set(0, 2.2, 0.1 + g * 0.2);
      group.add(ring);
    }
    // Longitudinal scar lines
    for (let l = 0; l < 4; l++) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 1.4), gridScarMat);
      const angle = (l / 4) * Math.PI * 2;
      line.position.set(Math.cos(angle) * 0.3, 2.2 + Math.sin(angle) * 0.3, 0.7);
      group.add(line);
    }

    // Torso
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.35, 1.8, 8), xenoMat);
    torso.position.y = 1.3;
    group.add(torso);

    group.position.set(playerPos.x + 12, 0, playerPos.z - 30);
    this.scene.add(group);

    this.aliens.push({
      mesh: group,
      type: 'grid_alien',
      hp: 420,
      maxHp: 420,
      speed: 15,
      damage: 45,
      radius: 1.6,
      isNetgunImmune: true,
      spurtCooldown: 0
    });
  }

  spawnOvimorphEggs(playerPos, count = 5) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const radius = 15 + Math.random() * 18;
      const x = playerPos.x + Math.cos(angle) * radius;
      const z = playerPos.z + Math.sin(angle) * radius;

      const eggGroup = new THREE.Group();
      eggGroup.position.set(x, 0, z);

      // Leathery veined egg sac base
      const baseMat = new THREE.MeshStandardMaterial({
        color: 0x332a1e,
        roughness: 0.85,
        metalness: 0.15
      });
      const base = new THREE.Mesh(new THREE.SphereGeometry(0.85, 12, 12), baseMat);
      base.scale.set(0.95, 1.35, 0.95);
      base.position.y = 1.0;
      eggGroup.add(base);

      // Inner pulsating bioluminescent yolk core (Alien 1979 Kane's scan)
      const yolkMat = new THREE.MeshBasicMaterial({
        color: 0x84cc16,
        transparent: true,
        opacity: 0.85
      });
      const yolkCore = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 8), yolkMat);
      yolkCore.position.y = 1.25;
      eggGroup.add(yolkCore);

      const petals = [];
      const lipMat = new THREE.MeshStandardMaterial({ color: 0x5b232c, roughness: 0.45 });
      for (let p = 0; p < 4; p++) {
        const petal = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.75, 6), lipMat);
        const petalAngle = (p / 4) * Math.PI * 2;
        petal.position.set(Math.cos(petalAngle) * 0.38, 1.95, Math.sin(petalAngle) * 0.38);
        petal.rotation.z = Math.cos(petalAngle) * 0.22;
        petal.rotation.x = Math.sin(petalAngle) * 0.22;
        eggGroup.add(petal);
        petals.push(petal);
      }

      this.scene.add(eggGroup);
      this.eggs.push({
        mesh: eggGroup,
        baseMesh: base,
        yolkMesh: yolkCore,
        petals,
        phase: Math.random() * Math.PI * 2,
        isOpen: false,
        hatched: false
      });
    }
  }

  createAlienMesh(isFacehugger, isBoiler = false, isNeomorph = false, isPraetomorph = false, isRedSwarm = false, isSpitter = false, isRunner = false, isCryoXeno = false, isCyberXeno = false, isRoyalFacehugger = false) {
    const group = new THREE.Group();

    if (isRoyalFacehugger) {
      const royalMat = new THREE.MeshStandardMaterial({ color: 0x4a3820, roughness: 0.35, metalness: 0.85 });
      const wingMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.6, transparent: true, opacity: 0.82, side: THREE.DoubleSide });

      // Armored Arachnid Body Sac
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.48, 8, 8), royalMat);
      body.position.y = 0.35;
      body.scale.set(1.3, 0.7, 1.5);
      group.add(body);

      // Chitinous carapace dorsal shield
      const shield = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.15, 0.9), royalMat);
      shield.position.set(0, 0.55, 0);
      group.add(shield);

      // 8 Articulated Knuckled Fingers
      for (let f = 0; f < 8; f++) {
        const side = f < 4 ? -1 : 1;
        const idx = f % 4;
        const finger = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.025, 0.85, 5), royalMat);
        finger.position.set(side * (0.45 + idx * 0.1), 0.25, (idx - 1.5) * 0.28);
        finger.rotation.z = side * 0.8;
        finger.rotation.y = (idx - 1.5) * 0.22;
        group.add(finger);
      }

      // Leathery Gliding Wing Membranes (Patagium connecting knuckle digits on both flanks)
      [-1, 1].forEach(side => {
        const patagium = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.9), wingMat);
        patagium.rotation.x = -Math.PI / 2;
        patagium.rotation.z = side * 0.2;
        patagium.position.set(side * 0.85, 0.22, 0);
        group.add(patagium);
      });

      // Serrated Armored Tail
      const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.03, 1.6, 6), royalMat);
      tail.position.set(0, 0.3, -0.85);
      tail.rotation.x = -Math.PI / 3.2;
      group.add(tail);
      return group;
    }

    const xenoColor = isFacehugger ? 0x8a7355 : (isBoiler ? 0x243528 : (isNeomorph ? 0xf0ece1 : (isPraetomorph ? 0x14181f : (isRedSwarm ? 0xb81414 : (isSpitter ? 0x103a20 : (isCryoXeno ? 0x93c5fd : (isCyberXeno ? 0x334155 : (isRunner ? 0x7c4722 : 0x11161d))))))));
    const mat = new THREE.MeshStandardMaterial({
      color: xenoColor,
      roughness: isNeomorph ? 0.2 : (isPraetomorph ? 0.15 : (isRedSwarm ? 0.25 : (isCryoXeno ? 0.1 : (isCyberXeno ? 0.25 : (isRunner ? 0.4 : 0.3))))),
      metalness: isNeomorph ? 0.05 : (isPraetomorph ? 0.95 : (isRedSwarm ? 0.82 : (isCryoXeno ? 0.65 : (isCyberXeno ? 0.95 : (isRunner ? 0.5 : 0.7))))),
      transparent: isCryoXeno,
      opacity: isCryoXeno ? 0.88 : 1.0
    });

    if (isFacehugger) {
      // Central Arachnid Sac Body
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), mat);
      body.position.y = 0.25;
      body.scale.set(1.2, 0.6, 1.4);
      group.add(body);

      // 8 Articulated Knuckled Arachnid Digits / Fingers (Alien 1979 1:1 Anatomy)
      for (let f = 0; f < 8; f++) {
        const side = f < 4 ? -1 : 1;
        const idx = f % 4;
        const finger = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.02, 0.65, 5), mat);
        finger.position.set(side * (0.35 + idx * 0.08), 0.2, (idx - 1.5) * 0.22);
        finger.rotation.z = side * 0.75;
        finger.rotation.y = (idx - 1.5) * 0.2;
        group.add(finger);
      }

      // Prehensile Strangling Whip Tail
      const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.02, 1.2, 6), mat);
      tail.position.set(0, 0.25, -0.65);
      tail.rotation.x = -Math.PI / 3.5;
      group.add(tail);
    } else if (isNeomorph) {
      // Alien: Covenant 2017 Canon Neomorph Bloodburster Anatomy
      // Smooth bulbous pointed cranium (no biomechanical tubes)
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.24, 1.5, 8), mat);
      head.rotation.x = Math.PI / 2 + 0.2;
      head.position.set(0, 1.4, 0.3);
      group.add(head);

      const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.15, 0.4), mat);
      jaw.position.set(0, 1.25, 0.6);
      group.add(jaw);

      const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.18, 1.5, 8), mat);
      torso.position.y = 1.0;
      torso.rotation.x = 0.3;
      group.add(torso);

      // Sharp dorsal spine quills along the back
      for (let s = 0; s < 4; s++) {
        const spine = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.3, 4), mat);
        spine.rotation.x = -Math.PI / 3;
        spine.position.set(0, 1.3 - s * 0.22, -0.15 - s * 0.08);
        group.add(spine);
      }
    } else if (isPraetomorph) {
      // Alien: Covenant 2017 Canon Praetomorph Anatomy (David's Biomechanical Apex Creation)
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.35, 1.8, 8), mat);
      head.rotation.x = Math.PI / 2;
      head.position.set(0, 1.9, 0.5);
      group.add(head);

      const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.24, 1.8, 8), mat);
      torso.position.y = 1.25;
      group.add(torso);

      // Long aggressive segmented tail
      const tailMat = new THREE.MeshStandardMaterial({ color: 0x0f1217, roughness: 0.2, metalness: 0.9 });
      for (let t = 0; t < 5; t++) {
        const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.05, 0.6, 6), tailMat);
        seg.position.set(0, 0.9 - t * 0.15, -0.4 - t * 0.4);
        seg.rotation.x = -0.4;
        group.add(seg);
      }
    } else {
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 1.4, 8), mat);
      head.rotation.x = Math.PI / 2;
      head.position.set(0, 1.8, 0.4);
      group.add(head);

      // Pharyngeal Inner Jaw Teeth (Alien 1979 / Aliens 1986 H.R. Giger Lore)
      const innerJawMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.95, roughness: 0.1 });
      const innerJaw = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.35, 6), innerJawMat);
      innerJaw.rotation.x = Math.PI / 2;
      innerJaw.position.set(0, 1.72, 1.15);
      group.add(innerJaw);

      const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.3, 1.6, 8), mat);
      torso.position.y = 1.2;
      group.add(torso);

      // 4 Curved Dorsal Biomechanical Exhaust Pipes (H.R. Giger Canon)
      for (let p = 0; p < 4; p++) {
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.03, 0.9, 5), mat);
        const pX = (p % 2 === 0 ? -0.22 : 0.22);
        const pY = 1.5 + (p > 1 ? 0.3 : 0);
        const pZ = -0.25 - (p > 1 ? 0.15 : 0);
        pipe.position.set(pX, pY, pZ);
        pipe.rotation.x = -Math.PI / 3.5;
        group.add(pipe);
      }

      // Segmented Prehensile Tail with Razor Blade Stinger
      const tailMat = mat;
      for (let t = 0; t < 5; t++) {
        const tSeg = new THREE.Mesh(new THREE.CylinderGeometry(0.06 - t * 0.008, 0.045 - t * 0.006, 0.45, 5), tailMat);
        tSeg.position.set(0, 0.8 - t * 0.1, -0.35 - t * 0.32);
        tSeg.rotation.x = -0.55 + t * 0.12;
        group.add(tSeg);
      }
      const stinger = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.35, 4), innerJawMat);
      stinger.rotation.x = -Math.PI / 2;
      stinger.position.set(0, 0.4, -2.0);
      group.add(stinger);

      if (isSpitter) {
        // Encrusted with acidic glands & crest spines (Aliens: Colonial Marines / AvP)
        const acidGlandMat = new THREE.MeshBasicMaterial({ color: 0x39ff14 });
        for (let g = 0; g < 4; g++) {
          const gland = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), acidGlandMat);
          gland.position.set((g % 2 === 0 ? -0.25 : 0.25), 1.9, 0.2 + g * 0.25);
          group.add(gland);
        }
      }

      if (isRunner) {
        // Alien 3 Ox / Dog quadruped runner morphology
        torso.rotation.x = 0.55;
        torso.position.y = 0.85;
        head.position.set(0, 1.1, 1.1);
      }

      if (isBoiler) {
        // Encrusted with pulsating luminescent yellow-green acid pustules
        const boilMat = new THREE.MeshBasicMaterial({ color: 0xccff00 });
        for (let b = 0; b < 6; b++) {
          const boil = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 6), boilMat);
          boil.name = 'boil';
          const bAngle = (b / 6) * Math.PI * 2;
          boil.position.set(Math.cos(bAngle) * 0.35, 1.3 + (b % 2) * 0.4, Math.sin(bAngle) * 0.35 + 0.2);
          group.add(boil);
        }
      }

      if (isCryoXeno) {
        // Sub-zero frost crystal accretion clusters along head and shoulders (Marvel LV-695 Canon)
        const iceSpikeMat = new THREE.MeshStandardMaterial({ color: 0xe0f2fe, roughness: 0.1, metalness: 0.75 });
        for (let ic = 0; ic < 5; ic++) {
          const iceSpike = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.4, 4), iceSpikeMat);
          iceSpike.rotation.x = -Math.PI / 3.5;
          iceSpike.position.set((ic % 2 === 0 ? -0.18 : 0.18), 1.95 + ic * 0.05, 0.4 - ic * 0.25);
          group.add(iceSpike);
        }
      }

      if (isCyberXeno) {
        // Steel Team Weyland-Yutani cybernetic titanium jaw harness & targeting optic laser
        const cyberPlateMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.98, roughness: 0.2 });
        const jawHarness = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.2, 0.35), cyberPlateMat);
        jawHarness.position.set(0, 1.7, 0.9);
        group.add(jawHarness);

        // Optic targeting diode on head
        const diodeMat = new THREE.MeshBasicMaterial({ color: 0xff0022 });
        const diode = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), diodeMat);
        diode.position.set(0.12, 1.95, 0.95);
        group.add(diode);

        // Cybernetic back spine battery
        const pack = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.5, 0.2), cyberPlateMat);
        pack.position.set(0, 1.4, -0.4);
        group.add(pack);
      }
    }

    return group;
  }

  createChestbursterMesh() {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xd4a373, roughness: 0.4, metalness: 0.1 });

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.05, 1.0, 6), mat);
    body.rotation.x = Math.PI / 2;
    body.position.y = 0.25;
    group.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), mat);
    head.position.set(0, 0.25, 0.55);
    group.add(head);

    return group;
  }

  checkMeleeHits(attack) {
    const hits = [];

    for (let i = this.aliens.length - 1; i >= 0; i--) {
      const a = this.aliens[i];
      const dist = a.mesh.position.distanceTo(attack.origin);

      if (dist <= attack.radius + (a.radius || 1.0)) {
        // Chantier 7 (v43): Liquid Nitrogen Frozen 3x Critical Shatter
        let damageDealt = (a.isTargetPainted || a.isTraxTagged) ? attack.damage * 1.25 : attack.damage;
        if (a.isFrozen) {
          damageDealt *= 3.0; // 3x shattering critical damage!
          if (this.particles && this.particles.emitSparks) {
            this.particles.emitSparks(a.mesh.position, 25);
          }
        }

        // Chantier 5 (v43): Praetorian Royal Shield Phalanx Frontal Deflection
        if (a.type === 'praetorian' && a.isPhalanxGuarding && attack.origin) {
          const forward = new THREE.Vector3(Math.sin(a.mesh.rotation.y), 0, Math.cos(a.mesh.rotation.y));
          const toAttack = attack.origin.clone().sub(a.mesh.position).setY(0).normalize();
          const dot = forward.dot(toAttack);
          if (dot > 0.3) {
            // Hit directly on armored cranial crest: 85% deflection!
            damageDealt *= 0.15;
            if (this.particles && this.particles.emitSparks) {
              this.particles.emitSparks(a.mesh.position, 18);
            }
          }
        }

        // Chantier 1 (v44): Marvel Alpha Epsilon Apex Ballistic Armor (-50% damage from light attacks)
        if (a.isBallisticArmored && attack.type !== 'heavy' && attack.type !== 'plasma' && attack.type !== 'spine_rip') {
          damageDealt *= 0.5;
          if (this.particles && this.particles.emitSparks) {
            this.particles.emitSparks(a.mesh.position, 12);
          }
        }
        // Chantier 4 (v44): Steel Team Cybernetic Plating (-35% projectile damage)
        if (a.hasCyberPlating && attack.type !== 'heavy' && attack.type !== 'plasma') {
          damageDealt *= 0.65;
        }

        a.hp -= damageDealt;
        const killed = a.hp <= 0;

        // Marvel Alpha Stun Threshold for Legendary Spine Rip Execution
        if (a.isMarvelAlpha && a.hp <= a.maxHp * 0.20 && !a.isStunned) {
          a.isStunned = true;
          a.stunTimer = 8.0;
        }

        // Reactive Acid Splashback Physics (slashing xenos sprays pressurized molecular acid back at attacker)
        if (attack.origin) {
          this.spawnAcidSplash(a.mesh.position, attack.origin);
        }

        // Grid Alien's grid-lattice scars squirt pressurized acid pools when struck!
        if (a.type === 'grid_alien') {
          this.spawnAcidPool(a.mesh.position);
        }

        // Dynasty Warriors Musou Launcher & Knockback Physics
        if (!killed && attack.origin) {
          const knockDir = a.mesh.position.clone().sub(attack.origin).setY(0).normalize();
          if (knockDir.lengthSq() < 0.001) knockDir.set(0, 0, 1);

          if (attack.isLauncher) {
            a.isAirborne = true;
            a.airborneVelY = attack.launchVelY || 18.0;
            a.airborneVelHoriz = knockDir.clone().multiplyScalar(Math.min(attack.knockback || 6.0, 12.0));
          } else if (attack.knockback) {
            a.mesh.position.addScaledVector(knockDir, attack.knockback);
          }
        }

        hits.push({
          pos: a.mesh.position.clone(),
          damage: attack.damage,
          killed: killed,
          isOfficer: a.isOfficer || false,
          officerTitle: a.officerTitle || null
        });

        if (killed) {
          if (a.type === 'boiler') {
            this.detonateBoiler(a, attack.origin);
          } else {
            if (this.goreEngine) {
              this.goreEngine.spawnDismemberment(a.mesh.position, attack.type || 'wristblades');
            }

            if (Math.random() < 0.15 && a.type !== 'crusher' && !a.isOfficer) {
              this.spawnChestburster(a.mesh.position);
            }

            this.spawnAcidPool(a.mesh.position);
            // Spawn 1-2 Zero-G Floating Acid Globules (Alien: Romulus 2024 Lore)
            const globCount = Math.floor(1 + Math.random() * 2);
            for (let g = 0; g < globCount; g++) {
              this.spawnZeroGAcidGlobule(a.mesh.position);
            }
            this.scene.remove(a.mesh);
            this.aliens.splice(i, 1);
            this.deadCount++;
          }
        }
      }
    }

    for (let i = this.eggs.length - 1; i >= 0; i--) {
      const egg = this.eggs[i];
      if (egg.mesh.position.distanceTo(attack.origin) <= attack.radius + 1.0) {
        this.spawnAcidPool(egg.mesh.position);
        this.scene.remove(egg.mesh);
        this.eggs.splice(i, 1);
        hits.push({
          pos: egg.mesh.position.clone(),
          damage: attack.damage,
          killed: true
        });
      }
    }

    // Chantier 2 (v44): Micro-Xenomorph Swarm Dispersal / Incineration
    for (let s = this.microSwarms.length - 1; s >= 0; s--) {
      const swarm = this.microSwarms[s];
      if (swarm.isDead) continue;
      if (swarm.group.position.distanceTo(attack.origin) <= attack.radius + 3.2) {
        swarm.hp -= attack.damage;
        if (this.particles && this.particles.emitSparks) {
          this.particles.emitSparks(swarm.group.position, 14);
        }
        if (swarm.hp <= 0) {
          swarm.isDead = true;
          this.scene.remove(swarm.group);
          this.microSwarms.splice(s, 1);
          hits.push({
            pos: swarm.group.position.clone(),
            damage: attack.damage,
            killed: true,
            isOfficer: false
          });
        }
      }
    }

    return hits;
  }

  spawnAcidSplash(originPos, targetPos) {
    const splashDir = targetPos.clone().sub(originPos).normalize();
    // Add realistic arc and spread
    for (let s = 0; s < 3; s++) {
      const spread = splashDir.clone().add(new THREE.Vector3(
        (Math.random() - 0.5) * 0.4,
        0.3 + Math.random() * 0.3,
        (Math.random() - 0.5) * 0.4
      )).normalize();

      const dropGeo = new THREE.SphereGeometry(0.12, 6, 6);
      const dropMesh = new THREE.Mesh(dropGeo, this.acidSplashMat);
      dropMesh.position.copy(originPos).add(new THREE.Vector3(0, 1.2, 0));
      this.scene.add(dropMesh);

      this.acidSplashes.push({
        mesh: dropMesh,
        vel: spread.multiplyScalar(16 + Math.random() * 6),
        gravity: -28,
        life: 0.9,
        damage: 18
      });
    }
  }

  spawnChestburster(pos) {
    const mesh = this.createChestbursterMesh();
    mesh.position.copy(pos);
    this.scene.add(mesh);
    this.chestbursters.push({
      mesh,
      hp: 30,
      speed: 18,
      damage: 12
    });
    this.audioEngine.playXenoHiss();
  }

  spawnAcidPool(pos) {
    const geo = new THREE.CylinderGeometry(1.8, 1.8, 0.05, 12);
    const mat = new THREE.MeshBasicMaterial({ color: 0x39ff14, transparent: true, opacity: 0.7 });
    const pool = new THREE.Mesh(geo, mat);
    pool.position.set(pos.x, 0.02, pos.z);
    this.scene.add(pool);

    this.acidPools.push({ mesh: pool, life: 10 });
  }

  spawnZeroGAcidGlobule(pos) {
    const group = new THREE.Group();
    const radius = 0.22 + Math.random() * 0.18;
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 12), this.zeroGAcidMat);
    group.add(sphere);

    const core = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.45, 8, 8), this.zeroGAcidCoreMat);
    group.add(core);

    const spawnY = Math.max(0.8, Math.min(3.2, (pos.y || 0) + 1.2 + (Math.random() - 0.5) * 1.0));
    group.position.set(
      pos.x + (Math.random() - 0.5) * 1.5,
      spawnY,
      pos.z + (Math.random() - 0.5) * 1.5
    );

    this.scene.add(group);
    this.zeroGAcidGlobules.push({
      mesh: group,
      baseY: group.position.y,
      floatTime: Math.random() * Math.PI * 2,
      driftVel: new THREE.Vector3((Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 1.2),
      life: 14.0,
      radius: radius
    });
  }

  /* Chantier 10: Xenomorph Spitter & Acid Mortar Battery (Aliens: Colonial Marines / Fireteam Elite Lore) */
  launchSpitterMortar(originPos, targetPos, player) {
    const group = new THREE.Group();
    const spawnPos = originPos.clone().add(new THREE.Vector3(0, 1.8, 0));
    group.position.copy(spawnPos);

    // Glowing acidic mortar payload
    const outerGeo = new THREE.SphereGeometry(0.38, 10, 10);
    const outerMat = new THREE.MeshBasicMaterial({ color: 0x39ff14, transparent: true, opacity: 0.85 });
    const outerSphere = new THREE.Mesh(outerGeo, outerMat);
    group.add(outerSphere);

    const innerGeo = new THREE.SphereGeometry(0.2, 8, 8);
    const innerMat = new THREE.MeshBasicMaterial({ color: 0xccff00 });
    const innerSphere = new THREE.Mesh(innerGeo, innerMat);
    group.add(innerSphere);

    // Trailing satellite acid droplets
    for (let d = 0; d < 4; d++) {
      const drop = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), outerMat);
      drop.position.set((Math.random() - 0.5) * 0.35, -0.2 - d * 0.12, (Math.random() - 0.5) * 0.35);
      group.add(drop);
    }
    this.scene.add(group);

    // Telegraph hazard indicator on ground at target zone
    const target = targetPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2.2, 0.04, (Math.random() - 0.5) * 2.2));
    target.y = 0.04;
    const ringGeo = new THREE.RingGeometry(0.8, 2.4, 24);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xff2200, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
    const indicatorMesh = new THREE.Mesh(ringGeo, ringMat);
    indicatorMesh.position.copy(target);
    this.scene.add(indicatorMesh);

    // Ballistic trajectory: t = 1.8s
    const t = 1.8;
    const gravity = 22.0;
    const dx = target.x - spawnPos.x;
    const dz = target.z - spawnPos.z;
    const vx = dx / t;
    const vz = dz / t;
    const vy = (target.y - spawnPos.y + 0.5 * gravity * t * t) / t;
    const vel = new THREE.Vector3(vx, vy, vz);

    if (this.audioEngine && this.audioEngine.playSpitterAcidMortar) {
      this.audioEngine.playSpitterAcidMortar();
    }

    this.spitterMortars.push({
      mesh: group,
      indicatorMesh: indicatorMesh,
      vel: vel,
      gravity: gravity,
      life: 4.0,
      targetPos: target,
      playerRef: player
    });
  }

  update(delta, player) {
    // 1. Ovimorph Egg proximity & Breathing Animation (Alien 1979 / Romulus 2024 Canon)
    this.eggs.forEach(egg => {
      // Eerie organic breathing pulsation
      if (!egg.hatched && egg.baseMesh) {
        const breathe = 1.0 + Math.sin(Date.now() * 0.0035 + egg.phase) * 0.06;
        egg.baseMesh.scale.set(0.95 * breathe, 1.35 / breathe, 0.95 * breathe);
        if (egg.yolkMesh) {
          egg.yolkMesh.material.opacity = 0.6 + Math.sin(Date.now() * 0.005 + egg.phase) * 0.35;
        }
      }

      if (!egg.hatched && egg.mesh.position.distanceTo(player.position) < 8.0) {
        if (!egg.isOpen) {
          egg.isOpen = true;
          // Splay the 4 leathery petals open
          egg.petals.forEach(p => {
            p.rotation.x *= 3.2;
            p.rotation.z *= 3.2;
          });

          if (this.audioEngine && this.audioEngine.playEggPetalPeel) {
            this.audioEngine.playEggPetalPeel();
          } else {
            this.audioEngine.playXenoHiss();
          }

          // Release organic spore gas haze
          if (this.particles && this.particles.emitSparks) {
            this.particles.emitSparks(egg.mesh.position, 14);
          }

          setTimeout(() => {
            if (this.scene) {
              const facehugger = this.createAlienMesh(true);
              facehugger.position.copy(egg.mesh.position);
              facehugger.position.y = 1.2;
              this.scene.add(facehugger);

              // Direction towards player for explosive spring leap
              const jumpDir = player.position.clone().sub(egg.mesh.position);
              jumpDir.y = 0;
              jumpDir.normalize().multiplyScalar(15.0);

              this.aliens.push({
                mesh: facehugger,
                type: 'facehugger',
                hp: 45,
                maxHp: 45,
                speed: 18,
                damage: 15,
                radius: 0.6,
                isLatched: false,
                isAirborne: true,
                airborneVelY: 13.0, // Springs upwards out of the egg!
                airborneVelHoriz: jumpDir
              });
              egg.hatched = true;
            }
          }, 650);
        }
      }
    });

    // 2. Chestbursters
    for (let i = this.chestbursters.length - 1; i >= 0; i--) {
      const cb = this.chestbursters[i];
      const dir = player.position.clone().sub(cb.mesh.position);
      dir.y = 0;
      if (dir.length() > 1.0) {
        dir.normalize();
        cb.mesh.position.addScaledVector(dir, cb.speed * delta);
        cb.mesh.rotation.y = Math.atan2(dir.x, dir.z);
      } else {
        player.takeDamage(cb.damage * delta);
      }
    }

    // 2b. Chantier 4 (v45): Royal Gliding Facehuggers Physics & Mask Latching
    for (let i = this.royalFacehuggers.length - 1; i >= 0; i--) {
      const rf = this.royalFacehuggers[i];
      rf.flutterPhase = (rf.flutterPhase || 0) + delta * 22.0;
      rf.mesh.rotation.z = Math.sin(rf.flutterPhase) * 0.18;

      if (rf.isGliding) {
        const targetHead = player.position.clone().add(new THREE.Vector3(0, 1.8, 0));
        const glideDir = targetHead.clone().sub(rf.mesh.position);
        const distToPlayer = glideDir.length();

        if (distToPlayer > 1.3) {
          glideDir.normalize();
          rf.mesh.position.addScaledVector(glideDir, rf.glideSpeed * delta);
          rf.mesh.rotation.y = Math.atan2(glideDir.x, glideDir.z);
          rf.mesh.rotation.x = -0.35;
        } else {
          // Latch onto player mask!
          rf.isGliding = false;
          rf.isLatched = true;
          player.isRoyalFacehuggerLatched = true;
          if (this.audioEngine && this.audioEngine.playRoyalFacehuggerShriek) {
            this.audioEngine.playRoyalFacehuggerShriek();
          }
          if (window.gameInstance && window.gameInstance.ui) {
            window.gameInstance.ui.showAnnouncement('⚠️ EMBUSCADE AÉRIENNE : PARASITE ROYAL AGGRIPÉ AU BIO-MASQUE ! MITRAILLEZ [ESPACE] (0/8) !');
          }
        }
      } else if (rf.isLatched) {
        rf.mesh.position.copy(player.position).add(new THREE.Vector3(0, 1.8, 0.35));
        rf.mesh.rotation.y = player.rotationY || 0;
        rf.latchTimer -= delta;

        if (rf.latchTimer <= 0) {
          player.takeDamage(150);
          player.visorAcidBurn = 1.0;
          this.scene.remove(rf.mesh);
          this.royalFacehuggers.splice(i, 1);
          player.isRoyalFacehuggerLatched = false;
          if (window.gameInstance && window.gameInstance.ui) {
            window.gameInstance.ui.showAnnouncement('☠️ PERFORATION CAUSTIQUE DU PARASITE ROYAL : DÉGÂTS CRITIQUES (-150 HP) !');
          }
        }
      }
    }

    // 3. Acid pools
    for (let i = this.acidPools.length - 1; i >= 0; i--) {
      const pool = this.acidPools[i];
      pool.life -= delta;
      if (pool.mesh.position.distanceTo(player.position) < 1.8) {
        player.takeDamage(15 * delta, true);
      }
      if (pool.life <= 0) {
        this.scene.remove(pool.mesh);
        this.acidPools.splice(i, 1);
      }
    }

    // 3b. Reactive Acid Splashback Droplets Flying
    for (let i = this.acidSplashes.length - 1; i >= 0; i--) {
      const splash = this.acidSplashes[i];
      splash.life -= delta;
      splash.vel.y += splash.gravity * delta;
      splash.mesh.position.addScaledVector(splash.vel, delta);

      // Check collision with player
      if (splash.mesh.position.distanceTo(player.position) < 1.6) {
        player.takeDamage(splash.damage, true);
        this.scene.remove(splash.mesh);
        this.acidSplashes.splice(i, 1);
        continue;
      }

      // Check floor collision or life expiry
      if (splash.mesh.position.y <= 0.05 || splash.life <= 0) {
        this.scene.remove(splash.mesh);
        this.acidSplashes.splice(i, 1);
      }
    }

    // 3c. Zero-G Floating Acid Globules (Alien: Romulus 2024 Lore)
    for (let i = this.zeroGAcidGlobules.length - 1; i >= 0; i--) {
      const glob = this.zeroGAcidGlobules[i];
      glob.life -= delta;
      glob.floatTime += delta * 2.2;
      glob.mesh.position.y = glob.baseY + Math.sin(glob.floatTime) * 0.35;
      glob.mesh.position.addScaledVector(glob.driftVel, delta);
      if (glob.mesh.children[0]) {
        glob.mesh.children[0].scale.setScalar(1.0 + Math.sin(glob.floatTime * 3) * 0.12);
      }

      const pDist = glob.mesh.position.distanceTo(player.position);
      if (pDist <= 1.4) {
        if (player.isBlocking) {
          player.audioEngine.playShieldBlock();
        } else {
          player.takeDamage(24, true);
          if (this.audioEngine && this.audioEngine.playAcidGlobuleHiss) {
            this.audioEngine.playAcidGlobuleHiss();
          }
        }
        this.scene.remove(glob.mesh);
        this.zeroGAcidGlobules.splice(i, 1);
        continue;
      }

      // Check collision with nearby aliens
      for (let j = 0; j < this.aliens.length; j++) {
        const al = this.aliens[j];
        if (al.mesh.position.distanceTo(glob.mesh.position) < 1.3) {
          al.hp -= 140; // Molecular acid dissolving xenomorph carapace
          if (this.audioEngine && this.audioEngine.playAcidGlobuleHiss) {
            this.audioEngine.playAcidGlobuleHiss();
          }
          this.scene.remove(glob.mesh);
          this.zeroGAcidGlobules.splice(i, 1);
          break;
        }
      }

      if (glob.life <= 0) {
        this.scene.remove(glob.mesh);
        this.zeroGAcidGlobules.splice(i, 1);
      }
    }

    // 3d. Spitter Parabolic Acid Mortar Batteries (Aliens: Colonial Marines Lore)
    for (let i = this.spitterMortars.length - 1; i >= 0; i--) {
      const m = this.spitterMortars[i];
      m.life -= delta;
      m.vel.y -= m.gravity * delta;
      m.mesh.position.addScaledVector(m.vel, delta);
      m.mesh.rotation.x += 10 * delta;
      m.mesh.rotation.y += 7 * delta;

      // Pulse hazard indicator ring
      if (m.indicatorMesh) {
        const pulse = 1.0 + Math.sin(Date.now() * 0.015) * 0.18;
        m.indicatorMesh.scale.set(pulse, pulse, 1);
      }

      // Detonation on impact
      if (m.mesh.position.y <= 0.25 || m.life <= 0) {
        if (this.audioEngine) {
          if (this.audioEngine.playAcidBurn) this.audioEngine.playAcidBurn();
          if (this.audioEngine.playXenoHiss) this.audioEngine.playXenoHiss();
        }
        // Explosive acid spray
        this.spawnAcidSplash(m.mesh.position, m.mesh.position.clone().add(new THREE.Vector3(0, 3, 0)));

        // Large 5.5m Corrodent Acid Pool
        this.spawnAcidPool(m.mesh.position);
        this.spawnAcidPool(m.mesh.position.clone().add(new THREE.Vector3(1.4, 0, 0)));
        this.spawnAcidPool(m.mesh.position.clone().add(new THREE.Vector3(-1.4, 0, 0)));
        this.spawnAcidPool(m.mesh.position.clone().add(new THREE.Vector3(0, 0, 1.4)));
        this.spawnAcidPool(m.mesh.position.clone().add(new THREE.Vector3(0, 0, -1.4)));

        // Splash damage to player
        if (player && m.mesh.position.distanceTo(player.position) < 3.8) {
          if (player.isBlocking) {
            player.audioEngine.playShieldBlock();
          } else {
            player.takeDamage(36, true);
          }
        }

        this.scene.remove(m.mesh);
        if (m.indicatorMesh) this.scene.remove(m.indicatorMesh);
        this.spitterMortars.splice(i, 1);
      }
    }

    // 3e. Chantier 2 (v44): Micro-Xenomorph Swarm Orbit & Parasitic Acid Bite (Marvel Comics Canon)
    for (let s = this.microSwarms.length - 1; s >= 0; s--) {
      const swarm = this.microSwarms[s];
      if (swarm.isDead) continue;
      swarm.orbitAngle += swarm.orbitSpeed * delta;
      const heightOsc = Math.sin(Date.now() * 0.005) * 0.45;
      const targetX = player.position.x + Math.cos(swarm.orbitAngle) * swarm.orbitRadius;
      const targetZ = player.position.z + Math.sin(swarm.orbitAngle) * swarm.orbitRadius;
      const targetY = player.position.y + 1.8 + heightOsc;
      swarm.group.position.lerp(new THREE.Vector3(targetX, targetY, targetZ), 6.0 * delta);

      // Rapid insectoid flutter wing animation
      swarm.units.forEach(u => {
        const flap = Math.sin(Date.now() * 0.045 + u.flutterOffset) * 0.65;
        u.wingL.rotation.z = flap;
        u.wingR.rotation.z = -flap;
      });

      // High-frequency buzzing audio
      swarm.buzzTimer = (swarm.buzzTimer || 0) + delta;
      if (swarm.buzzTimer >= 1.5) {
        swarm.buzzTimer = 0;
        if (this.audioEngine && this.audioEngine.playMicroSwarmBuzz) {
          this.audioEngine.playMicroSwarmBuzz();
        }
      }

      // Caustic micro-bite chip damage
      if (swarm.group.position.distanceTo(player.position) <= 3.2) {
        if (!player.isBlocking) {
          player.takeDamage(swarm.damage * delta, true);
        }
      }
    }

    // 3f. Chantier 4 (v44): Cybernetic Spine Darts Flight Physics
    for (let d = this.cyberSpineDarts.length - 1; d >= 0; d--) {
      const dart = this.cyberSpineDarts[d];
      dart.life -= delta;
      dart.mesh.position.addScaledVector(dart.vel, delta);
      if (dart.mesh.position.distanceTo(player.position) <= 1.8) {
        if (player.isBlocking) {
          player.audioEngine.playShieldBlock();
        } else {
          player.takeDamage(dart.damage, false);
        }
        this.scene.remove(dart.mesh);
        this.cyberSpineDarts.splice(d, 1);
        continue;
      }
      if (dart.life <= 0 || dart.mesh.position.y <= 0.1) {
        this.scene.remove(dart.mesh);
        this.cyberSpineDarts.splice(d, 1);
      }
    }

    // 3g. Chantier 7 (v47): Flying Xenomorph Manta Swarmers 3D Airspace Flight AI (Aliens Arcade / Kenner / Marvel)
    for (let m = this.mantaSwarmers.length - 1; m >= 0; m--) {
      const manta = this.mantaSwarmers[m];
      if (manta.hp <= 0) {
        if (this.goreEngine && this.goreEngine.spawnDismemberment) {
          this.goreEngine.spawnDismemberment(manta.mesh.position, 'heavy');
        }
        this.spawnAcidSplash(manta.mesh.position, manta.mesh.position);
        this.scene.remove(manta.mesh);
        this.mantaSwarmers.splice(m, 1);
        this.deadCount++;
        if (window.gameInstance) window.gameInstance.score += 450;
        continue;
      }

      // Wing flutter animation
      manta.flutterPhase += delta * 18.0;
      const flap = Math.sin(manta.flutterPhase) * 0.65;
      if (manta.mesh.userData.wingL) manta.mesh.userData.wingL.rotation.z = flap;
      if (manta.mesh.userData.wingR) manta.mesh.userData.wingR.rotation.z = -flap;

      if (manta.divePhase === 'cruising') {
        manta.diveCooldown -= delta;
        // Fly around player at high altitude
        const toPlayer = player.position.clone().sub(manta.mesh.position);
        toPlayer.y = 0;
        const distHoriz = toPlayer.length();

        if (distHoriz > 12.0) {
          toPlayer.normalize();
          manta.mesh.position.addScaledVector(toPlayer, manta.speed * delta);
        }
        // Maintain cruise altitude
        manta.mesh.position.y += (manta.cruiseAltitude - manta.mesh.position.y) * 3.0 * delta;

        // Orient toward flight direction
        manta.mesh.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);

        if (manta.diveCooldown <= 0 && distHoriz <= 24.0) {
          manta.divePhase = 'diving';
          manta.diveTarget.copy(player.position);
          if (this.audioEngine && this.audioEngine.playMantaDiveScreech) {
            this.audioEngine.playMantaDiveScreech();
          }
        }
      } else if (manta.divePhase === 'diving') {
        // High-speed supersonic dive attack
        const diveDir = manta.diveTarget.clone().sub(manta.mesh.position).normalize();
        manta.mesh.position.addScaledVector(diveDir, manta.diveSpeed * delta);
        manta.mesh.rotation.x = 0.55; // Pitch down

        // Hit player check
        if (manta.mesh.position.distanceTo(player.position) <= 2.8) {
          if (player.isBlocking) {
            if (player.audioEngine && player.audioEngine.playShieldBlock) player.audioEngine.playShieldBlock();
          } else {
            player.takeDamage(manta.damage);
          }
          manta.divePhase = 'zooming_up';
          manta.diveCooldown = 4.5 + Math.random() * 2.0;
        } else if (manta.mesh.position.y <= 0.8) {
          // Reached floor, pull up
          manta.divePhase = 'zooming_up';
          manta.diveCooldown = 4.5 + Math.random() * 2.0;
        }
      } else if (manta.divePhase === 'zooming_up') {
        // Sweep back up to cruising altitude
        manta.mesh.position.y += 14.0 * delta;
        manta.mesh.rotation.x = -0.4; // Pitch up
        if (manta.mesh.position.y >= manta.cruiseAltitude) {
          manta.mesh.position.y = manta.cruiseAltitude;
          manta.mesh.rotation.x = 0;
          manta.divePhase = 'cruising';
        }
      }
    }

    // 4. Horde AI (Crusher, Praetorian, Warriors, Facehuggers, Officers)
    this.aliens.forEach(a => {
      if (a.isLatched) return;

      // Airborne Juggling Physics (Dynasty Warriors Musou C2/C5 Launchers)
      if (a.isAirborne) {
        a.airborneVelY -= 36.0 * delta; // Gravity
        a.mesh.position.y += a.airborneVelY * delta;
        if (a.airborneVelHoriz) {
          a.mesh.position.addScaledVector(a.airborneVelHoriz, delta);
        }
        // Ragdoll spin in mid-air
        a.mesh.rotation.x += 8.0 * delta;
        a.mesh.rotation.z += 5.0 * delta;

        // Ground impact
        if (a.mesh.position.y <= 0) {
          a.mesh.position.y = 0;
          a.isAirborne = false;
          a.airborneVelY = 0;
          a.mesh.rotation.x = 0;
          a.mesh.rotation.z = 0;
          if (a.isChameleon && player && a.mesh.position.distanceTo(player.position) <= 2.8) {
            player.takeDamage(90, false, a);
            if (this.audioEngine && this.audioEngine.playSlash) this.audioEngine.playSlash();
          }
        }
        return; // Helpless while airborne in juggle arc
      }

      // Flash-Frozen Solid State (Cryo Nitrogen Pipe Rupture - Alien: Romulus 2024)
      if (a.isFlashFrozen) {
        a.frozenTimer -= delta;
        if (a.frozenTimer <= 0) {
          a.isFlashFrozen = false;
        }
        return; // Completely frozen solid
      }

      // Netgun Entangled State
      if (a.isNetEntangled) {
        if (a.isNetgunImmune) {
          // Grid Alien (Nethead) has already melted and broken Celtic's net in AVP 2004!
          a.isNetEntangled = false;
        } else {
          a.netTimer -= delta;
          a.hp -= 38 * delta; // Razor wire cuts deep into chitin!
          a.mesh.rotation.y += Math.sin(Date.now() * 0.05) * 0.05;

          // Electrical sparks arcing across diamond net wires
          a.netSparkTimer = (a.netSparkTimer || 0) + delta;
          if (a.netSparkTimer >= 0.22) {
            a.netSparkTimer = 0;
            if (this.particles && this.particles.emitSparks) {
              this.particles.emitSparks(a.mesh.position, 4);
            }
          }

          if (a.netTimer <= 0 || a.hp <= 0) {
            a.isNetEntangled = false;
          }
          return; // Completely immobilized
        }
      }

      // Chantier 7 (v43): Liquid Nitrogen Flash-Frozen Solid State
      if (a.isFrozen) {
        a.freezeTimer = (a.freezeTimer || 4.5) - delta;
        if (a.freezeTimer <= 0) {
          a.isFrozen = false;
          if (a.mesh && a.mesh.traverse) {
            a.mesh.traverse(child => {
              if (child.isMesh && child.material && child.origColor !== undefined) {
                child.material.color.setHex(child.origColor);
              }
            });
          }
        }
        return; // Completely frozen in place!
      }

      // Chantier 6: Yautja Netgun Wall-Pinning & Diamond-Wire Guillotine Tension (Predator 2 Canon)
      if (a.isPinned) {
        a.pinTimer = (a.pinTimer || 6.0) - delta;
        a.hp -= 48 * delta; // Diamond-wire tension slices deep into chitin!
        if (this.particles && this.particles.emitAlienBloodSpurt && Math.random() < 0.12) {
          this.particles.emitAlienBloodSpurt(a.mesh.position, 6);
        }
        if (a.pinTimer <= 0 || a.hp <= 0) {
          a.isPinned = false;
        }
        return; // Fixed against wall
      }

      // Chantier 7: Alpha Predator Primordial Hemotoxic Bleed (Prey 2022 / Alpha Canon)
      if (a.bleedTimer > 0) {
        a.bleedTimer -= delta;
        a.hp -= (a.bleedDps || 50.0) * delta;
        if (this.particles && this.particles.emitAlienBloodSpurt && Math.random() < 0.08) {
          this.particles.emitAlienBloodSpurt(a.mesh.position, 4);
        }
      }

      // Chantier 3 (v42): Trax-Net Micro-Beacon Pulse
      if (a.isTraxTagged) {
        a.traxTimer -= delta;
        a.traxBeepTimer = (a.traxBeepTimer || 0) + delta;
        if (a.traxBeepTimer >= 1.2) {
          a.traxBeepTimer = 0;
          if (this.particles && this.particles.emitSparks) {
            this.particles.emitSparks(a.mesh.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 3);
          }
        }
        if (a.traxTimer <= 0) {
          a.isTraxTagged = false;
        }
      }

      // Chantier 2 (v42): Subterranean Trench & Vent Flanking AI (Aliens 1986 / Isolation)
      if (player && player.position && player.position.y >= 3.0 && (a.type === 'drone' || a.type === 'warrior') && !a.isFlanking && Math.random() < 0.006) {
        a.isFlanking = true;
        a.flankPhase = 'diving';
        a.flankTimer = 3.2;
      }

      if (a.isFlanking) {
        if (a.flankPhase === 'diving') {
          a.mesh.position.y -= 8.0 * delta;
          if (a.mesh.position.y <= -2.0) {
            a.mesh.visible = false;
            a.flankPhase = 'submerged';
          }
          return;
        } else if (a.flankPhase === 'submerged') {
          a.flankTimer -= delta;
          if (a.flankTimer <= 0) {
            a.flankPhase = 'emerging';
            const behindPlayer = player.position.clone().add(new THREE.Vector3(
              (Math.random() - 0.5) * 4.0,
              0,
              4.0
            ));
            a.mesh.position.copy(behindPlayer);
            a.mesh.position.y = -2.0;
            a.mesh.visible = true;
            this.audioEngine.playXenoHiss();
          }
          return;
        } else if (a.flankPhase === 'emerging') {
          a.mesh.position.y += 10.0 * delta;
          if (a.mesh.position.y >= player.position.y) {
            a.mesh.position.y = player.position.y;
            a.isFlanking = false;
            const distToP = a.mesh.position.distanceTo(player.position);
            if (distToP <= 3.5) {
              player.takeDamage(42, false, a);
            }
          }
          return;
        }
      }

      // Chantier 4 (v47): Deacon Titan Primordial Boss AI (Prometheus 2012)
      if (a.isDeacon) {
        if (a.hp <= a.maxHp * 0.22 && !a.isStunned && !a.canBeTrophyHarvested) {
          a.isStunned = true;
          a.stunTimer = 12.0;
          a.canBeTrophyHarvested = true;
          if (window.gameInstance && window.gameInstance.ui) {
            window.gameInstance.ui.showAnnouncement('💀 TITAN PRIMORDIAL DÉSTABILISÉ : APPUYEZ SUR [E] POUR ARRACHER LE CRÂNE DU DEACON !');
          }
        }

        if (!a.isStunned) {
          a.chompCooldown = (a.chompCooldown || 0) - delta;
          const pDist = a.mesh.position.distanceTo(player.position);
          if (pDist <= 3.8 && a.chompCooldown <= 0) {
            a.chompCooldown = 3.2;
            if (this.audioEngine && this.audioEngine.playDeaconJawHiss) {
              this.audioEngine.playDeaconJawHiss();
            }
            if (player.isBlocking) {
              player.audioEngine.playShieldBlock();
            } else {
              player.takeDamage(85);
            }
          }
        }
      }

      // Stunned State (Crusher or Praetorian or Deacon)
      if (a.isStunned) {
        a.stunTimer -= delta;
        a.mesh.rotation.z = Math.sin(Date.now() * 0.02) * 0.1;
        if (a.stunTimer <= 0) {
          a.isStunned = false;
          a.canBeTrophyHarvested = false;
          a.mesh.rotation.z = 0;
        }
        return;
      }

      const dir = player.position.clone().sub(a.mesh.position);
      dir.y = 0;
      const dist = dir.length();

      // Wall-Climbing & Ceiling Drop Ambush AI (Alien 1979 / Aliens 1986 Lore)
      if (a.isWallStalker) {
        if (a.wallClimbPhase === 'climbing') {
          a.mesh.position.y += 6.5 * delta;
          a.mesh.rotation.x = -Math.PI * 0.4;
          if (a.mesh.position.y >= a.perchHeight) {
            a.mesh.position.y = a.perchHeight;
            a.wallClimbPhase = 'perched';
            a.mesh.rotation.x = Math.PI; // Upside down clinging to ceiling
          }
          return;
        } else if (a.wallClimbPhase === 'perched') {
          // Stalk ceiling towards player
          if (dist > 8.0) {
            const stalkDir = dir.clone().normalize();
            a.mesh.position.addScaledVector(stalkDir, 5.0 * delta);
          }
          // Surprise drop attack when close enough
          if (dist <= 10.0) {
            a.wallClimbPhase = 'dropping';
            this.audioEngine.playXenoHiss();
          }
          return;
        } else if (a.wallClimbPhase === 'dropping') {
          a.mesh.position.y -= 26.0 * delta; // Plunge straight down
          a.mesh.rotation.x = 0;
          const dropDir = dir.clone().normalize();
          a.mesh.position.addScaledVector(dropDir, 8.0 * delta);

          if (a.mesh.position.y <= 0) {
            a.mesh.position.y = 0;
            a.wallClimbPhase = 'grounded';
            a.isWallStalker = false;
            if (dist <= 3.5) {
              player.takeDamage(35, false, a);
            }
          }
          return;
        }
      }

      // Praetorian Royal Acid Spit Attack (medium range: 8m to 20m)
      if (a.type === 'praetorian') {
        a.spitCooldown -= delta;
        if (a.spitCooldown <= 0 && dist >= 8.0 && dist <= 20.0) {
          a.spitCooldown = 3.5;
          this.audioEngine.playXenoHiss();
          this.spawnAcidSplash(a.mesh.position, player.position);
        }
      }

      // Spitter Long-Range Acid Artillery AI (Aliens: Colonial Marines Lore)
      if (a.type === 'spitter') {
        a.spitCooldown -= delta;
        if (a.spitCooldown <= 0 && dist >= 8.0 && dist <= 36.0) {
          a.spitCooldown = 3.6 + Math.random() * 1.5;
          this.launchSpitterMortar(a.mesh.position, player.position, player);
        }
      }

      // Chantier 1 (v44): Marvel Alpha Apex Predator Command Roar & Enrage Pack (Marvel Alien 2021)
      if (a.isMarvelAlpha) {
        a.commandRoarCooldown -= delta;
        if (a.commandRoarCooldown <= 0) {
          a.commandRoarCooldown = 8.5;
          if (this.audioEngine && this.audioEngine.playAlphaCommandRoar) {
            this.audioEngine.playAlphaCommandRoar();
          }
          if (window.gameInstance && window.gameInstance.ui) {
            window.gameInstance.ui.showAnnouncement('👑 RUGISSEMENT D\'ORDRE DE L\'ALPHA MARVEL : MEUTE ENRAGÉE (+50% VIT) !');
          }
          this.aliens.forEach(other => {
            if (other !== a && other.mesh && other.mesh.position.distanceTo(a.mesh.position) <= 22.0) {
              other.isEnraged = true;
              other.enragedTimer = 6.0;
            }
          });
        }
      }

      // Chantier 3 (v44): Cryo-Xenomorph Sub-Zero Frost Breath Cone (Marvel Alien: Thaw LV-695)
      if (a.type === 'cryo_xeno') {
        a.frostBreathCooldown -= delta;
        if (a.frostBreathCooldown <= 0 && dist >= 4.0 && dist <= 14.0) {
          a.frostBreathCooldown = 4.5;
          if (this.audioEngine && this.audioEngine.playCryoFrostBreath) {
            this.audioEngine.playCryoFrostBreath();
          }
          if (player.takeDamage) {
            player.takeDamage(24, false, a);
            player.cryoSlowTimer = 3.5;
            if (window.gameInstance && window.gameInstance.ui) {
              window.gameInstance.ui.showAnnouncement('❄️ SOUFFLE GLACIAL DU CRYO-XÉNO LV-695 : VITESSE RÉDUITE DE 50% !');
            }
          }
        }
      }

      // Chantier 7 (v46): Chameleon Stalker Optical Cloak & Flank Ambush (Aliens: Rogue)
      if (a.isChameleon) {
        if (a.cloakFlickerTimer > 0) a.cloakFlickerTimer -= delta;
        if (a.pounceCooldown > 0) a.pounceCooldown -= delta;

        // EM Vision reveals cloaked xeno with high-contrast electric cyan highlights!
        const isEMVision = player && player.visionMode === 2;
        const revealed = isEMVision || a.cloakFlickerTimer > 0;
        a.mesh.traverse(child => {
          if (child.isMesh) {
            child.material = revealed ? this.chameleonRevealedMat : this.chameleonMat;
          }
        });

        // Pounce attack from blind spot
        if (dist <= 13.0 && a.pounceCooldown <= 0 && !a.isStunned) {
          a.pounceCooldown = 4.5;
          if (this.audioEngine && this.audioEngine.playStalkerChameleonHiss) {
            this.audioEngine.playStalkerChameleonHiss();
          }

          a.isAirborne = true;
          a.airborneVelY = 8.0;
          const pounceDir = player.position.clone().sub(a.mesh.position).normalize();
          a.airborneVelHoriz = pounceDir.multiplyScalar(22.0);
          a.cloakFlickerTimer = 3.2; // Camouflage flickers on attack

          if (window.gameInstance && window.gameInstance.ui && window.gameInstance.ui.showAnnouncement) {
            window.gameInstance.ui.showAnnouncement('🦎 BOND D\'EMBUSCADE DU CHAMELEON STALKER (90 DÉGÂTS) ! VISION EM [V] CONSEILLÉE !');
          }
        }
      }

      // Chantier 4 (v44): Steel Team Cybernetic Xenomorph Spine Dart Volley (Marvel Alien: Icarus)
      if (a.type === 'cyber_xeno') {
        a.cyberDartCooldown -= delta;
        if (a.cyberDartCooldown <= 0 && dist >= 6.0 && dist <= 24.0) {
          a.cyberDartCooldown = 4.2;
          if (this.audioEngine && this.audioEngine.playCyberXenoStatic) {
            this.audioEngine.playCyberXenoStatic();
          }
          const dartGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.8, 5);
          dartGeo.rotateX(Math.PI / 2);
          const dartMat = new THREE.MeshBasicMaterial({ color: 0xff1133 });
          const dartMesh = new THREE.Mesh(dartGeo, dartMat);
          const spawnPos = a.mesh.position.clone().add(new THREE.Vector3(0, 1.8, 0));
          dartMesh.position.copy(spawnPos);
          const dartDir = player.position.clone().add(new THREE.Vector3(0, 1.2, 0)).sub(spawnPos).normalize();
          dartMesh.lookAt(spawnPos.clone().add(dartDir));
          this.scene.add(dartMesh);

          this.cyberSpineDarts.push({
            mesh: dartMesh,
            vel: dartDir.multiplyScalar(28.0),
            damage: 28,
            life: 2.5
          });
        }
      }

      if (a.type === 'crusher') {
        // Crusher Battering Ram Charge
        a.chargeTimer -= delta;
        if (a.chargeTimer <= 0) {
          a.isCharging = true;
          a.speed = 22; // Charge speed!
          this.audioEngine.playXenoHiss();
          setTimeout(() => {
            a.isCharging = false;
            a.speed = 12;
            a.chargeTimer = 4.0;
          }, 2000);
        }

        // If charging against player with Feral Shield raised -> STUN CRUSHER!
        if (a.isCharging && dist <= a.radius + 1.2 && player.isBlocking) {
          a.isCharging = false;
          a.isStunned = true;
          a.stunTimer = 5.0; // 5-second stun window for execution!
          player.audioEngine.playShieldBlock();
          return;
        }
      }

      // Check if low HP sub-boss enters execution stun (Crusher, Praetorian, Grid Alien, Marvel Alpha)
      if ((a.type === 'crusher' || a.type === 'praetorian' || a.type === 'grid_alien' || a.isMarvelAlpha) && a.hp <= a.maxHp * 0.22 && !a.isStunned) {
        a.isStunned = true;
        a.stunTimer = 7.0;
      }

      // Boiler suicide kamikaze charge
      if (a.type === 'boiler') {
        a.mesh.children.forEach(c => {
          if (c.name === 'boil') c.scale.setScalar(1.0 + Math.sin(Date.now() * 0.018) * 0.25);
        });
        if (dist <= 3.2) {
          this.detonateBoiler(a, player);
          return;
        }
      }

      // Neomorph Bloodburster Acrobatic Pounce & Evasive Flanking (Alien: Covenant 2017)
      if (a.type === 'neomorph') {
        if (a.leapCooldown > 0) a.leapCooldown -= delta;

        // Evasive lateral strafe
        const strafe = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
        a.mesh.position.addScaledVector(strafe, Math.sin(Date.now() * 0.007) * 4.0 * delta);

        if (!a.isLeaping && dist <= 12.0 && a.leapCooldown <= 0) {
          a.isLeaping = true;
          a.leapVelY = 13.0;
          a.leapCooldown = 4.5;
          if (this.audioEngine && this.audioEngine.playNeomorphScreech) {
            this.audioEngine.playNeomorphScreech();
          }
        }

        if (a.isLeaping) {
          a.leapVelY -= 32.0 * delta;
          a.mesh.position.y += a.leapVelY * delta;
          a.mesh.rotation.x = -0.5;

          if (a.mesh.position.y <= 0) {
            a.mesh.position.y = 0;
            a.isLeaping = false;
            a.mesh.rotation.x = 0;
            if (dist <= 3.0) {
              player.takeDamage(35, false, a);
            }
          }
          return;
        }
      }

      // Praetomorph Hyper-Aggressive Hunter (Alien: Covenant 2017)
      if (a.type === 'praetomorph') {
        if (a.leapCooldown > 0) a.leapCooldown -= delta;
        if (!a.isLeaping && dist <= 14.0 && a.leapCooldown <= 0) {
          a.isLeaping = true;
          a.leapVelY = 15.0;
          a.leapCooldown = 5.0;
          if (this.audioEngine && this.audioEngine.playPraetomorphHiss) {
            this.audioEngine.playPraetomorphHiss();
          }
        }
        if (a.isLeaping) {
          a.leapVelY -= 36.0 * delta;
          a.mesh.position.y += a.leapVelY * delta;
          a.mesh.rotation.x = -0.4;
          const leapDir = dir.clone().normalize();
          a.mesh.position.addScaledVector(leapDir, 16.0 * delta);

          if (a.mesh.position.y <= 0) {
            a.mesh.position.y = 0;
            a.isLeaping = false;
            a.mesh.rotation.x = 0;
            if (dist <= 3.5) {
              player.takeDamage(45, false, a);
            }
          }
          return;
        }
      }

      // Red Xenomorph Hive Civil War Infighting (Aliens: Genocide 1991)
      if (a.type === 'red_warrior') {
        for (let j = 0; j < this.aliens.length; j++) {
          const other = this.aliens[j];
          if (other !== a && other.type !== 'red_warrior' && other.type !== 'facehugger') {
            const xDist = a.mesh.position.distanceTo(other.mesh.position);
            if (xDist <= 3.2) {
              other.hp -= 40 * delta;
              a.hp -= 25 * delta;
              if (Math.random() < 0.04 && this.audioEngine && this.audioEngine.playRedSwarmHiss) {
                this.audioEngine.playRedSwarmHiss();
              }
              break;
            }
          }
        }
      }

      if (dist > (a.radius || 1.2)) {
        dir.normalize();
        a.mesh.position.addScaledVector(dir, a.speed * delta);
        a.mesh.rotation.y = Math.atan2(dir.x, dir.z);
      } else {
        if (a.type === 'facehugger' && !player.isFacehuggerLatched) {
          player.triggerFacehuggerLatch();
          a.isLatched = true;
          this.scene.remove(a.mesh);
        } else {
          player.takeDamage(a.damage * delta, false, a);
        }
      }
    });
  }

  detonateBoiler(boiler, targetOrPos) {
    if (this.audioEngine && this.audioEngine.playBoilerDetonation) {
      this.audioEngine.playBoilerDetonation();
    }
    const pos = boiler.mesh.position.clone();
    this.scene.remove(boiler.mesh);
    const idx = this.aliens.indexOf(boiler);
    if (idx !== -1) this.aliens.splice(idx, 1);
    this.deadCount++;

    const targetPos = (targetOrPos && targetOrPos.position) ? targetOrPos.position : (targetOrPos || pos);

    // Expanding fluorescent green rupture shockwave
    const shockGeo = new THREE.SphereGeometry(1.8, 12, 12);
    const shockMat = new THREE.MeshBasicMaterial({ color: 0x39ff14, transparent: true, opacity: 0.85, wireframe: true });
    const shockMesh = new THREE.Mesh(shockGeo, shockMat);
    shockMesh.position.copy(pos).add(new THREE.Vector3(0, 1.0, 0));
    this.scene.add(shockMesh);

    let shockScale = 1.0;
    const sAnim = setInterval(() => {
      shockScale += 0.55;
      shockMesh.scale.set(shockScale, shockScale, shockScale);
      shockMesh.material.opacity -= 0.12;
      if (shockMesh.material.opacity <= 0) {
        clearInterval(sAnim);
        this.scene.remove(shockMesh);
      }
    }, 30);

    // Blast damage in 8.5m radius to player
    if (targetOrPos && targetOrPos.takeDamage) {
      if (targetPos.distanceTo(pos) <= 8.5) {
        if (targetOrPos.isBlocking) {
          targetOrPos.audioEngine.playShieldBlock();
        } else {
          targetOrPos.takeDamage(75, true);
        }
      }
    }

    // Friendly-fire molecular dissolution of adjacent Xenomorphs
    this.aliens.forEach(otherAlien => {
      if (otherAlien.hp > 0 && otherAlien.mesh.position.distanceTo(pos) <= 8.0) {
        otherAlien.hp -= 320;
      }
    });

    // Deep caustic floor slag decal (Chantier 6)
    if (this.goreEngine && this.goreEngine.spawnAcidSlagDecal) {
      this.goreEngine.spawnAcidSlagDecal(pos, 3.2, this.audioEngine);
    }

    // 8 flying acid droplets and large acid pool
    this.spawnAcidSplash(pos, targetPos);
    this.spawnAcidSplash(pos, pos.clone().add(new THREE.Vector3(3, 0, 0)));
    this.spawnAcidSplash(pos, pos.clone().add(new THREE.Vector3(-3, 0, 0)));
    this.spawnAcidPool(pos);
  }

  clearWave() {
    this.aliens.forEach(a => this.scene.remove(a.mesh));
    this.aliens = [];
    this.eggs.forEach(e => this.scene.remove(e.mesh));
    this.eggs = [];
    this.chestbursters.forEach(c => this.scene.remove(c.mesh));
    this.chestbursters = [];
    this.acidPools.forEach(p => this.scene.remove(p.mesh));
    this.acidPools = [];
    this.acidSplashes.forEach(s => this.scene.remove(s.mesh));
    this.acidSplashes = [];
    this.zeroGAcidGlobules.forEach(g => this.scene.remove(g.mesh));
    this.zeroGAcidGlobules = [];
    this.spitterMortars.forEach(m => {
      this.scene.remove(m.mesh);
      if (m.indicatorMesh) this.scene.remove(m.indicatorMesh);
    });
    this.spitterMortars = [];
    this.microSwarms.forEach(s => this.scene.remove(s.group));
    this.microSwarms = [];
    this.cyberSpineDarts.forEach(d => this.scene.remove(d.mesh));
    this.cyberSpineDarts = [];
    this.royalFacehuggers.forEach(r => this.scene.remove(r.mesh));
    this.royalFacehuggers = [];
    this.mantaSwarmers.forEach(m => this.scene.remove(m.mesh));
    this.mantaSwarmers = [];
  }
}
