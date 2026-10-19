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

    const isMatriarchTitan = type === 'predalien_matriarch_titan';
    const isImperial = type === 'imperial_queen';
    const isEmpress = type === 'empress_matriarch';
    const isPredalienQueen = type === 'predalien_queen';
    const isPredalienAbomination = type === 'predalien_abomination';
    const isOffspring = type === 'the_offspring';
    const isTrilobite = type === 'trilobite_prime';

    const hp = isMatriarchTitan ? 10000 : (isImperial ? 8000 : (isTrilobite ? 7000 : (isPredalienAbomination ? 6500 : (isEmpress ? 6000 : (isPredalienQueen ? 5000 : (isOffspring ? 4500 : 3000))))));

    this.activeBoss = {
      type: type,
      mesh: mesh,
      hp: hp,
      maxHp: hp,
      isStunned: false,
      stunTimer: 0,
      phase: 1,
      spineRipAvailable: false
    };

    if (isMatriarchTitan) {
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

  createBossMesh(type) {
    if (type === 'trilobite_prime') {
      return this.buildTrilobiteMesh(2.6);
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
    this.activeBoss.hp -= amount;

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
    if (this.activeBoss.type === 'predalien_matriarch_titan') {
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
    if ((this.activeBoss.type === 'predalien_queen' || this.activeBoss.type === 'predalien_abomination' || this.activeBoss.type === 'predalien_matriarch_titan') && dist > 4.5 && dist < 32.0 && this.activeBoss.regurgitateCooldown <= 0) {
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
