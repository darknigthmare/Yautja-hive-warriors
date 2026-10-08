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

    // Dynasty Warriors Musou: Spawn 2 Hive Spire Captains / Node Guards (Gardes de Nœud & Sentinelles du Couvoir)
    this.spawnHiveOfficer(playerPos, -22, 'SENTINELLE DU NŒUD PRIMAIRE (SPIRE GUARD)');
    this.spawnHiveOfficer(playerPos, 22, 'GARDE SANGUINAIRE DU COUVOIR ROYAL (HIVE CASTE OFFICER)');

    // Massive Musou Swarm Density: at least 45 to 80 aliens
    const totalCount = Math.max(count, 45);
    for (let i = 0; i < totalCount; i++) {
      const isFacehugger = Math.random() < 0.16;
      const isBoiler = !isFacehugger && Math.random() < 0.16;
      const isNeomorph = !isFacehugger && !isBoiler && Math.random() < 0.16;
      const isPraetomorph = !isFacehugger && !isBoiler && !isNeomorph && Math.random() < 0.18;
      const isRedSwarm = !isFacehugger && !isBoiler && !isNeomorph && !isPraetomorph && Math.random() < 0.22;
      const isSpitter = !isFacehugger && !isBoiler && !isNeomorph && !isPraetomorph && !isRedSwarm && Math.random() < 0.25;
      const isRunner = !isFacehugger && !isBoiler && !isNeomorph && !isPraetomorph && !isRedSwarm && !isSpitter && Math.random() < 0.30;
      const alien = this.createAlienMesh(isFacehugger, isBoiler, isNeomorph, isPraetomorph, isRedSwarm, isSpitter, isRunner);

      const angle = Math.random() * Math.PI * 2;
      const radius = 22 + Math.random() * 25;
      alien.position.set(
        playerPos.x + Math.cos(angle) * radius,
        0,
        playerPos.z + Math.sin(angle) * radius
      );

      const isWallStalker = !isFacehugger && !isBoiler && !isNeomorph && !isPraetomorph && !isRedSwarm && !isSpitter && !isRunner && Math.random() < 0.22;
      this.scene.add(alien);
      const aType = isFacehugger ? 'facehugger' : (isBoiler ? 'boiler' : (isNeomorph ? 'neomorph' : (isPraetomorph ? 'praetomorph' : (isRedSwarm ? 'red_warrior' : (isSpitter ? 'spitter' : (isRunner ? 'runner' : 'warrior'))))));
      const aHp = isFacehugger ? 40 : (isBoiler ? 80 : (isNeomorph ? 95 : (isPraetomorph ? 160 : (isRedSwarm ? 140 : (isSpitter ? 110 : (isRunner ? 85 : 120))))));
      const aSpeed = isFacehugger ? 17 : (isBoiler ? 14 : (isNeomorph ? 19 : (isPraetomorph ? 16 : (isRedSwarm ? 15.5 : (isSpitter ? 12 : (isRunner ? 21.0 : 11))))));
      const aDmg = isFacehugger ? 15 : (isBoiler ? 50 : (isNeomorph ? 35 : (isPraetomorph ? 42 : (isRedSwarm ? 34 : (isSpitter ? 30 : (isRunner ? 28 : 25))))));

      this.aliens.push({
        mesh: alien,
        type: aType,
        hp: aHp,
        maxHp: aHp,
        speed: aSpeed,
        damage: aDmg,
        radius: isFacehugger ? 0.6 : (isNeomorph ? 0.9 : (isPraetomorph ? 1.3 : (isRunner ? 0.85 : 1.1))),
        isLatched: false,
        isWallStalker: isWallStalker,
        wallClimbPhase: isWallStalker ? 'climbing' : 'grounded',
        perchHeight: 8.0 + Math.random() * 4.0,
        leapCooldown: (isNeomorph || isPraetomorph) ? 2.0 + Math.random() * 2.0 : 0,
        spitCooldown: isSpitter ? 2.5 + Math.random() * 2.0 : 0,
        isLeaping: false,
        leapVelY: 0,
        isAirborne: false,
        airborneVelY: 0,
        airborneVelHoriz: new THREE.Vector3()
      });
    }
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

      const base = new THREE.Mesh(new THREE.SphereGeometry(0.8, 10, 10), this.eggMat);
      base.scale.set(0.9, 1.3, 0.9);
      base.position.y = 0.9;
      eggGroup.add(base);

      const petals = [];
      for (let p = 0; p < 4; p++) {
        const petal = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.7, 5), this.eggPetalMat);
        const petalAngle = (p / 4) * Math.PI * 2;
        petal.position.set(Math.cos(petalAngle) * 0.35, 1.8, Math.sin(petalAngle) * 0.35);
        petal.rotation.z = Math.cos(petalAngle) * 0.2;
        petal.rotation.x = Math.sin(petalAngle) * 0.2;
        eggGroup.add(petal);
        petals.push(petal);
      }

      this.scene.add(eggGroup);
      this.eggs.push({
        mesh: eggGroup,
        petals,
        isOpen: false,
        hatched: false
      });
    }
  }

  createAlienMesh(isFacehugger, isBoiler = false, isNeomorph = false, isPraetomorph = false, isRedSwarm = false, isSpitter = false, isRunner = false) {
    const group = new THREE.Group();
    const xenoColor = isFacehugger ? 0x8a7355 : (isBoiler ? 0x243528 : (isNeomorph ? 0xf0ece1 : (isPraetomorph ? 0x14181f : (isRedSwarm ? 0xb81414 : (isSpitter ? 0x103a20 : (isRunner ? 0x7c4722 : 0x11161d))))));
    const mat = new THREE.MeshStandardMaterial({
      color: xenoColor,
      roughness: isNeomorph ? 0.2 : (isPraetomorph ? 0.15 : (isRedSwarm ? 0.25 : (isRunner ? 0.4 : 0.3))),
      metalness: isNeomorph ? 0.05 : (isPraetomorph ? 0.95 : (isRedSwarm ? 0.82 : (isRunner ? 0.5 : 0.7)))
    });

    if (isFacehugger) {
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), mat);
      body.position.y = 0.3;
      group.add(body);

      const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.02, 0.8, 6), mat);
      tail.position.set(0, 0.3, -0.4);
      tail.rotation.x = -Math.PI / 4;
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
        a.hp -= attack.damage;
        const killed = a.hp <= 0;

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

  update(delta, player) {
    // 1. Ovimorph Egg proximity
    this.eggs.forEach(egg => {
      if (!egg.hatched && egg.mesh.position.distanceTo(player.position) < 7.0) {
        if (!egg.isOpen) {
          egg.isOpen = true;
          egg.petals.forEach(p => {
            p.rotation.x *= 2.2;
            p.rotation.z *= 2.2;
          });
          this.audioEngine.playXenoHiss();

          setTimeout(() => {
            if (this.scene) {
              const facehugger = this.createAlienMesh(true);
              facehugger.position.copy(egg.mesh.position);
              facehugger.position.y = 0.5;
              this.scene.add(facehugger);
              this.aliens.push({
                mesh: facehugger,
                type: 'facehugger',
                hp: 40,
                maxHp: 40,
                speed: 17,
                damage: 15,
                radius: 0.6,
                isLatched: false
              });
              egg.hatched = true;
            }
          }, 800);
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
        }
        return; // Helpless while airborne in juggle arc
      }

      // Netgun Entangled State
      if (a.isNetEntangled) {
        if (a.isNetgunImmune) {
          // Grid Alien (Nethead) has already melted and broken Celtic's net in AVP 2004!
          a.isNetEntangled = false;
        } else {
          a.netTimer -= delta;
          a.hp -= 25 * delta; // Razor wire cuts deep!
          a.mesh.rotation.y += Math.sin(Date.now() * 0.05) * 0.05;
          if (a.netTimer <= 0) {
            a.isNetEntangled = false;
          }
          return; // Completely immobilized
        }
      }

      // Stunned State (Crusher or Praetorian)
      if (a.isStunned) {
        a.stunTimer -= delta;
        a.mesh.rotation.z = Math.sin(Date.now() * 0.02) * 0.1;
        if (a.stunTimer <= 0) {
          a.isStunned = false;
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
              player.takeDamage(35);
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
        if (a.spitCooldown <= 0 && dist >= 7.0 && dist <= 26.0) {
          a.spitCooldown = 3.2;
          this.audioEngine.playXenoHiss();
          this.spawnAcidSplash(a.mesh.position, player.position);
          this.spawnAcidPool(a.mesh.position);
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

      // Check if low HP sub-boss enters execution stun (Crusher, Praetorian, Grid Alien)
      if ((a.type === 'crusher' || a.type === 'praetorian' || a.type === 'grid_alien') && a.hp <= a.maxHp * 0.25 && !a.isStunned) {
        a.isStunned = true;
        a.stunTimer = 6.0;
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
              if (player.isBlocking) {
                player.audioEngine.playShieldBlock();
              } else {
                player.takeDamage(35);
              }
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
              if (player.isBlocking) {
                player.audioEngine.playShieldBlock();
              } else {
                player.takeDamage(45);
              }
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
          player.takeDamage(a.damage * delta);
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

    // Blast damage in 8.0m radius
    if (targetOrPos && targetOrPos.takeDamage) {
      if (targetPos.distanceTo(pos) <= 8.0) {
        if (targetOrPos.isBlocking) {
          targetOrPos.audioEngine.playShieldBlock();
        } else {
          targetOrPos.takeDamage(75);
        }
      }
    }

    // 5 flying acid droplets and large acid pool
    this.spawnAcidSplash(pos, targetPos);
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
  }
}
