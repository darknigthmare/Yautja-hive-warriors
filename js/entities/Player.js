/* Playable Yautja 3D Mesh Generator & State Controller (Primordial 1:1 Lore Edition) */

import * as THREE from 'three';

export class Player {
  constructor(scene, charData, audioEngine, isPlayer2 = false, particles = null) {
    this.scene = scene;
    this.data = charData;
    this.audioEngine = audioEngine;
    this.isPlayer2 = isPlayer2;
    this.particles = particles;

    // Stats
    this.hp = charData.stats.hp;
    this.maxHp = charData.stats.maxHp;
    this.moveSpeed = charData.stats.moveSpeed;
    this.meleeDamage = charData.stats.meleeDamage;
    this.plasmaDamage = charData.stats.plasmaDamage;
    this.plasmaEnergy = 100;
    this.maxPlasmaEnergy = 100;
    this.musouEnergy = 0;
    this.maxMusouEnergy = 100;
    this.medicompCharges = 3;
    this.acidSolventCharges = 2;

    // States
    this.position = new THREE.Vector3(isPlayer2 ? 4 : 0, 0, 0);
    this.rotationY = 0;
    this.isAttacking = false;
    this.attackComboStep = 0;
    this.attackTimer = 0;

    // 4 Bio-Mask Vision Modes (0: Normal, 1: Thermal IR, 2: EM Xeno, 3: Tech Scan)
    this.visionMode = 0;

    this.isCloaked = false;
    this.isMusouActive = false;
    this.isSecondaryWeapon = false;
    this.isHybridMutated = false;
    this.isClanBranded = false;
    this.isBlocking = false;
    this.isPerched = false;
    this.warhornBuffTimer = 0;
    this.empCooldown = 0;
    this.cloakShimmerTimer = 0;
    this.combiStickCooldown = 0;
    this.shurikenCooldown = 0;
    this.powerGloveCooldown = 0;
    this.spineWhipCooldown = 0;
    this.flechetteCooldown = 0;
    this.boneScytheCooldown = 0;
    this.compoundBowCooldown = 0;
    this.holoDecoyCooldown = 0;
    this.plasmaGlaiveCooldown = 0;
    this.isPlasmaGlaiveActive = false;
    this.plasmaGlaiveDuration = 0;
    this.plasmaGlaiveMesh = null;
    this.royalJellyFlasks = 1;
    this.isBerserkerActive = false;
    this.berserkerTimer = 0;
    this.berserkerHeartbeatTimer = 0;
    this.trophiesCollected = [];
    this.targetLockEnemy = null;
    this.comboResetTimer = 0;
    this.currentChargeName = null;
    this.visorAcidBurn = 0;
    this.wristNukeHoloMesh = null;

    // Pounce Leap State
    this.isLeaping = false;
    this.leapVelocityY = 0;

    // QTE Facehugger Struggle State
    this.isFacehuggerLatched = false;
    this.qteStrugglePresses = 0;
    this.qteRequiredPresses = 5;

    this.mesh = this.buildYautjaMesh();
    this.scene.add(this.mesh);

    this.laserColorHex = isPlayer2 ? 0xffaa00 : 0xff0000;
    this.laserGroup = this.buildLaserSight(this.laserColorHex);
    this.mesh.add(this.laserGroup);

    this.radius = 1.2;
  }

  buildYautjaMesh() {
    const group = new THREE.Group();
    const colors = this.data.colors;

    const skinMat = new THREE.MeshStandardMaterial({ color: colors.skin, roughness: 0.6, metalness: 0.1 });
    const armorMat = new THREE.MeshStandardMaterial({ color: colors.armor, metalness: 0.8, roughness: 0.3 });
    const maskMat = new THREE.MeshStandardMaterial({ color: colors.mask, metalness: 0.9, roughness: 0.2 });

    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.6, 2.2, 8), skinMat);
    torso.position.y = 2.2;
    group.add(torso);

    const chestArmor = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 1.2), armorMat);
    chestArmor.position.y = 2.4;
    group.add(chestArmor);

    // Bio-Mask Head
    this.headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.65, 12, 12), maskMat);
    this.headMesh.position.set(0, 3.6, 0.1);
    group.add(this.headMesh);

    // Clan Acid Mark Glyph on Forehead (AVP 2004 Lore - lightning bolt)
    const clanMarkGeo = new THREE.PlaneGeometry(0.25, 0.35);
    const clanMarkMat = new THREE.MeshBasicMaterial({ color: 0x39ff14, side: THREE.DoubleSide });
    this.clanMarkMesh = new THREE.Mesh(clanMarkGeo, clanMarkMat);
    this.clanMarkMesh.position.set(0, 3.8, 0.68);
    this.clanMarkMesh.visible = false;
    group.add(this.clanMarkMesh);

    const dreadMat = new THREE.MeshStandardMaterial({ color: colors.dreads, roughness: 0.9 });
    for (let i = -4; i <= 4; i++) {
      const dread = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.04, 1.4, 6), dreadMat);
      const angle = (i / 4) * Math.PI * 0.5;
      dread.position.set(Math.sin(angle) * 0.5, 3.4, -0.4 - Math.cos(angle) * 0.2);
      dread.rotation.x = -0.3;
      dread.rotation.z = angle * 0.5;
      group.add(dread);
    }

    const plasmaGeo = new THREE.CylinderGeometry(0.12, 0.15, 0.8, 8);
    const leftCannon = new THREE.Mesh(plasmaGeo, armorMat);
    leftCannon.rotation.x = Math.PI / 2;
    leftCannon.position.set(-1.1, 3.4, 0.2);
    group.add(leftCannon);

    const rightCannon = new THREE.Mesh(plasmaGeo, armorMat);
    rightCannon.rotation.x = Math.PI / 2;
    rightCannon.position.set(1.1, 3.4, 0.2);
    group.add(rightCannon);

    const armGeo = new THREE.CylinderGeometry(0.28, 0.22, 1.6, 8);
    this.leftArm = new THREE.Mesh(armGeo, skinMat);
    this.leftArm.position.set(-1.2, 2.2, 0);
    group.add(this.leftArm);

    this.rightArm = new THREE.Mesh(armGeo, skinMat);
    this.rightArm.position.set(1.2, 2.2, 0);
    group.add(this.rightArm);

    // Left Forearm: Feral Hexagonal Bone Shield (Prey 2022)
    const shieldGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.08, 6);
    const shieldMat = new THREE.MeshStandardMaterial({ color: 0x2b231d, metalness: 0.9, roughness: 0.3 });
    this.shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    this.shieldMesh.position.set(-0.2, -0.2, 0.6);
    this.shieldMesh.rotation.x = Math.PI / 2;
    this.shieldMesh.visible = false;
    this.leftArm.add(this.shieldMesh);

    const rightGauntlet = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.5), armorMat);
    rightGauntlet.position.set(1.2, 1.8, 0);
    group.add(rightGauntlet);

    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.95, roughness: 0.1 });
    // Dual parallel extensible wristblades (1:1 Canon Predator 1987)
    this.blade1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.4, 0.02), bladeMat);
    this.blade1.position.set(1.23, 1.8, 0.8);
    this.blade1.rotation.x = Math.PI / 2;
    group.add(this.blade1);

    this.blade2 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.4, 0.02), bladeMat);
    this.blade2.position.set(1.37, 1.8, 0.8);
    this.blade2.rotation.x = Math.PI / 2;
    group.add(this.blade2);

    this.secWeaponMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.05, 12), bladeMat);
    this.secWeaponMesh.position.set(-1.2, 1.8, 0.6);
    this.secWeaponMesh.visible = false;
    group.add(this.secWeaponMesh);

    // Dual-Bladed Plasma Glaive / Naginata (AVP Clan Patriarch / Concrete Jungle Lore)
    const glaiveGroup = new THREE.Group();
    const shaftMat = new THREE.MeshStandardMaterial({ color: 0x3d3124, roughness: 0.5, metalness: 0.85 });
    const plasmaBladeMat = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      emissive: 0x00d2ff,
      emissiveIntensity: 1.2,
      roughness: 0.1,
      metalness: 0.95
    });

    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.4, 8), shaftMat);
    glaiveGroup.add(shaft);

    const bladeTop = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.2, 0.22), plasmaBladeMat);
    bladeTop.position.y = 1.9;
    glaiveGroup.add(bladeTop);

    const bladeBottom = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.2, 0.22), plasmaBladeMat);
    bladeBottom.position.y = -1.9;
    glaiveGroup.add(bladeBottom);

    // Energy rings around center grip
    const ringGeo = new THREE.TorusGeometry(0.09, 0.02, 6, 16);
    const ring1 = new THREE.Mesh(ringGeo, plasmaBladeMat);
    ring1.rotation.x = Math.PI / 2;
    ring1.position.y = 0.4;
    glaiveGroup.add(ring1);
    const ring2 = new THREE.Mesh(ringGeo, plasmaBladeMat);
    ring2.rotation.x = Math.PI / 2;
    ring2.position.y = -0.4;
    glaiveGroup.add(ring2);

    glaiveGroup.position.set(1.4, 1.8, 0.4);
    glaiveGroup.rotation.x = Math.PI / 2;
    glaiveGroup.visible = false;
    group.add(glaiveGroup);
    this.plasmaGlaiveMesh = glaiveGroup;

    const legGeo = new THREE.CylinderGeometry(0.35, 0.25, 1.8, 8);
    this.leftLeg = new THREE.Mesh(legGeo, skinMat);
    this.leftLeg.position.set(-0.5, 0.9, 0);
    group.add(this.leftLeg);

    this.rightLeg = new THREE.Mesh(legGeo, skinMat);
    this.rightLeg.position.set(0.5, 0.9, 0);
    group.add(this.rightLeg);

    this.skinMaterials = [skinMat];
    this.armorMaterials = [armorMat, maskMat];

    return group;
  }

  buildLaserSight(colorHex = 0xff0000) {
    const laserGroup = new THREE.Group();
    const laserMat = new THREE.LineBasicMaterial({ color: colorHex, linewidth: 2 });

    for (let i = 0; i < 3; i++) {
      const points = [];
      const angle = (i / 3) * Math.PI * 2;
      const offsetX = Math.cos(angle) * 0.3;
      const offsetY = Math.sin(angle) * 0.3;

      points.push(new THREE.Vector3(-1.1 + offsetX, 3.4 + offsetY, 0.4));
      points.push(new THREE.Vector3(0, 1.8, 25));

      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geo, laserMat);
      laserGroup.add(line);
    }

    return laserGroup;
  }

  updateLaserLock(worldTargetPos) {
    if (!this.laserGroup) return;

    if (worldTargetPos) {
      const localTarget = this.mesh.worldToLocal(worldTargetPos.clone());
      for (let i = 0; i < this.laserGroup.children.length; i++) {
        const line = this.laserGroup.children[i];
        const posAttr = line.geometry.attributes.position;
        const angle = (i / 3) * Math.PI * 2;
        // The three dots converge at target with small triangle delta
        posAttr.setXYZ(1, localTarget.x + Math.cos(angle) * 0.12, localTarget.y + Math.sin(angle) * 0.12, localTarget.z);
        posAttr.needsUpdate = true;
      }
    } else {
      for (let i = 0; i < this.laserGroup.children.length; i++) {
        const line = this.laserGroup.children[i];
        const posAttr = line.geometry.attributes.position;
        posAttr.setXYZ(1, 0, 1.8, 25);
        posAttr.needsUpdate = true;
      }
    }
  }

  throwCombiStick() {
    if (this.combiStickCooldown > 0 || this.isFacehuggerLatched) return null;
    this.combiStickCooldown = 3.5;
    this.audioEngine.playCombiStickThrow();

    const forward = new THREE.Vector3(
      Math.sin(this.rotationY),
      this.isPerched ? -0.35 : 0,
      Math.cos(this.rotationY)
    ).normalize();

    const startPos = this.position.clone().add(new THREE.Vector3(0, 2.2, 0)).addScaledVector(forward, 1.2);

    return {
      startPos: startPos,
      direction: forward,
      speed: 65,
      damage: 480,
      pierceRemaining: 4
    };
  }

  throwShuriken() {
    if (this.shurikenCooldown > 0 || this.isFacehuggerLatched) return null;
    this.shurikenCooldown = 4.0;
    this.audioEngine.playShurikenOpen();

    const forward = new THREE.Vector3(
      Math.sin(this.rotationY),
      this.isPerched ? -0.2 : 0,
      Math.cos(this.rotationY)
    ).normalize();

    const startPos = this.position.clone().add(new THREE.Vector3(0, 2.0, 0)).addScaledVector(forward, 1.2);

    return {
      startPos: startPos,
      direction: forward,
      speed: 42,
      damage: 550,
      maxRange: 32,
      radius: 3.2
    };
  }

  triggerPowerGloveSlam(horde, synthetics, bosses) {
    if (this.powerGloveCooldown > 0 || this.isFacehuggerLatched) return false;
    this.powerGloveCooldown = 6.0;

    this.audioEngine.playPowerGloveSlam();

    // Visual ground slam punch animation
    this.rightArm.rotation.x = -Math.PI * 0.85;
    this.position.y = 0;
    setTimeout(() => {
      this.rightArm.rotation.x = 0;
    }, 450);

    const slamAttack = { origin: this.position, radius: 12.0, damage: 450, type: 'heavy' };

    // 1. Pulverize Xenomorphs in 12m radius & knock back
    if (horde) {
      horde.checkMeleeHits(slamAttack);
      horde.aliens.forEach(a => {
        if (a.mesh.position.distanceTo(this.position) <= 12.0) {
          const knockDir = a.mesh.position.clone().sub(this.position).normalize();
          a.mesh.position.addScaledVector(knockDir, 7.5);
          a.mesh.position.y = 2.5; // Lifted into air
          setTimeout(() => { a.mesh.position.y = 0; }, 320);
        }
      });
    }

    // 2. Damage synthetics
    if (synthetics) {
      synthetics.checkHits(slamAttack);
    }

    // 3. Stun/damage active boss
    if (bosses && bosses.activeBoss) {
      if (bosses.activeBoss.mesh.position.distanceTo(this.position) <= 12.0) {
        bosses.takeDamage(550);
      }
    }

    return true;
  }

  triggerSpineWhipSlash(horde, synthetics, bosses) {
    if (this.spineWhipCooldown > 0 || this.isFacehuggerLatched) return false;
    this.spineWhipCooldown = 3.5;

    this.audioEngine.playSpineWhipCrack();

    // Visual whip lash sweep
    this.leftArm.rotation.x = -Math.PI * 0.5;
    this.leftArm.rotation.y = -Math.PI * 0.4;
    setTimeout(() => {
      this.leftArm.rotation.x = 0;
      this.leftArm.rotation.y = 0;
    }, 380);

    const whipAttack = { origin: this.position, radius: 10.5, damage: 420, type: 'spine_whip' };

    // 1. Slash and reel in Xenomorphs
    if (horde) {
      horde.checkMeleeHits(whipAttack);
      horde.aliens.forEach(a => {
        const toPlayer = this.position.clone().sub(a.mesh.position);
        const dist = toPlayer.length();
        if (dist <= 10.5 && dist > 2.0) {
          // Reel enemy towards the hunter!
          toPlayer.y = 0;
          toPlayer.normalize();
          a.mesh.position.addScaledVector(toPlayer, 4.5);
        }
      });
    }

    // 2. Synthetics
    if (synthetics) {
      synthetics.checkHits(whipAttack);
    }

    // 3. Boss
    if (bosses && bosses.activeBoss) {
      if (bosses.activeBoss.mesh.position.distanceTo(this.position) <= 10.5) {
        bosses.takeDamage(480);
      }
    }

    return true;
  }

  togglePerch() {
    this.isPerched = !this.isPerched;
    if (this.isPerched) {
      // Perch high atop canopy/pillars (12 meters above arena)
      this.position.y = 12.0;
      this.audioEngine.playSlash();
    } else {
      // Dive assassination plunge!
      this.position.y = 0;
      this.audioEngine.playPounceImpact();
    }
    this.mesh.position.copy(this.position);
    return this.isPerched;
  }

  toggleShieldBlock() {
    this.isBlocking = !this.isBlocking;
    if (this.shieldMesh) {
      this.shieldMesh.visible = this.isBlocking;
    }
    if (this.isBlocking) {
      this.audioEngine.playShieldBlock();
      this.leftArm.rotation.x = -Math.PI * 0.4;
      this.leftArm.position.x = -0.6;
    } else {
      this.leftArm.rotation.x = 0;
      this.leftArm.position.x = -1.2;
    }
    return this.isBlocking;
  }

  soundWarhorn() {
    this.warhornBuffTimer = 10.0;
    this.audioEngine.playWarhorn();
    return true;
  }

  brandClanMark() {
    this.isClanBranded = true;
    if (this.clanMarkMesh) {
      this.clanMarkMesh.visible = true;
    }
    this.audioEngine.playClanMarkSizzle();
  }

  fireFlechetteNeedler() {
    this.audioEngine.playFlechetteDart();
    const origin = this.position.clone().add(new THREE.Vector3(-1.2, 2.0, 0.5));
    const forward = new THREE.Vector3(Math.sin(this.rotationY), 0, Math.cos(this.rotationY)).normalize();

    return {
      position: origin,
      direction: forward,
      damage: 180,
      speed: 65
    };
  }

  throwSmartDisc() {
    this.audioEngine.playSmartDiscHum();
    const origin = this.position.clone().add(new THREE.Vector3(0.8, 1.8, 0.4));
    const forward = new THREE.Vector3(Math.sin(this.rotationY), 0, Math.cos(this.rotationY)).normalize();
    const right = new THREE.Vector3(-forward.z, 0, forward.x);

    return {
      startPos: origin.clone(),
      apexPos: origin.clone().addScaledVector(forward, 28).addScaledVector(right, 7),
      damage: 320,
      speed: 40
    };
  }

  fireNetgun(horde, synthetics) {
    this.audioEngine.playNetgunLaunch();
    const origin = this.position.clone().add(new THREE.Vector3(0.5, 2.0, 0.4));
    const forward = new THREE.Vector3(Math.sin(this.rotationY), 0, Math.cos(this.rotationY)).normalize();

    // Find nearest target in forward cone (up to 22m)
    let bestTarget = null;
    let minAngle = Math.PI / 3;

    if (horde) {
      horde.aliens.forEach(a => {
        const toAlien = a.mesh.position.clone().sub(this.position);
        toAlien.y = 0;
        const dist = toAlien.length();
        if (dist <= 22.0) {
          toAlien.normalize();
          const angle = Math.acos(Math.max(-1, Math.min(1, forward.dot(toAlien))));
          if (angle < minAngle) {
            minAngle = angle;
            bestTarget = a;
          }
        }
      });
    }

    if (bestTarget) {
      bestTarget.isNetEntangled = true;
      bestTarget.netTimer = 4.0;
      this.audioEngine.playNetWireTighten();

      // Create visual expanding wire net mesh over the trapped target
      const netGeo = new THREE.SphereGeometry(bestTarget.radius ? bestTarget.radius * 1.3 : 1.4, 10, 10);
      const netMat = new THREE.MeshBasicMaterial({
        color: 0xcccccc,
        wireframe: true,
        transparent: true,
        opacity: 0.95
      });
      const netMesh = new THREE.Mesh(netGeo, netMat);
      netMesh.position.copy(bestTarget.mesh.position).add(new THREE.Vector3(0, 1.2, 0));
      this.scene.add(netMesh);

      setTimeout(() => {
        this.scene.remove(netMesh);
      }, 4000);
      return true;
    }

    return false;
  }

  triggerGauntletEMP(horde, synthetics) {
    if (this.empCooldown > 0) return false;
    this.empCooldown = 12.0; // 12 second cooldown
    this.audioEngine.playGauntletEMP();

    const empRadius = 18.0;

    // 1. Stun and short-circuit Weyland-Yutani synthetics
    if (synthetics) {
      synthetics.androids.forEach(syn => {
        if (syn.mesh.position.distanceTo(this.position) <= empRadius) {
          syn.isEMPStunned = true;
          syn.empStunTimer = 5.0; // 5 second complete shutdown
          synthetics.emitWhiteSyntheticBlood(syn.mesh.position);
          syn.hp -= 90; // High electrical damage to circuitry
        }
      });
    }

    // 2. Shock and paralyze Xenomorph horde
    if (horde) {
      horde.aliens.forEach(a => {
        if (a.mesh.position.distanceTo(this.position) <= empRadius) {
          a.hp -= 75;
          a.speed = Math.max(2, a.speed * 0.3); // Severe nerve disruption
          setTimeout(() => {
            a.speed = a.type === 'facehugger' ? 17 : (a.type === 'crusher' ? 12 : 11);
          }, 4000);
        }
      });
    }

    // Create EMP shockwave visual sphere
    const empGeo = new THREE.SphereGeometry(1, 16, 16);
    const empMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.8,
      wireframe: true
    });
    const shockwaveMesh = new THREE.Mesh(empGeo, empMat);
    shockwaveMesh.position.copy(this.position).add(new THREE.Vector3(0, 1.5, 0));
    this.scene.add(shockwaveMesh);

    let scale = 1.0;
    const expandAnim = setInterval(() => {
      scale += 2.2;
      shockwaveMesh.scale.set(scale, scale, scale);
      shockwaveMesh.material.opacity -= 0.08;
      if (shockwaveMesh.material.opacity <= 0 || scale >= empRadius) {
        clearInterval(expandAnim);
        this.scene.remove(shockwaveMesh);
      }
    }, 30);

    return true;
  }

  triggerVoiceMimicry(horde) {
    this.audioEngine.playVoiceMimicry();
    const lurePoint = this.position.clone();

    const tauntLines = [
      '"OVER HERE..." (1987)',
      '"WANT SOME CANDY?" (1990)',
      '"ANYTIME..." (1987)',
      'RIRE SARDONIQUE DE BILLY (1987)'
    ];
    const pickedTaunt = tauntLines[Math.floor(Math.random() * tauntLines.length)];

    horde.aliens.forEach(a => {
      if (a.mesh.position.distanceTo(lurePoint) < 30) {
        a.mesh.position.addScaledVector(lurePoint.clone().sub(a.mesh.position).normalize(), 4.0);
        // Momentary disorientation
        a.speed = Math.max(3, a.speed * 0.5);
        setTimeout(() => {
          a.speed = a.type === 'facehugger' ? 17 : (a.type === 'crusher' ? 12 : 11);
        }, 2500);
      }
    });

    return pickedTaunt;
  }

  cycleVisionMode() {
    this.visionMode = (this.visionMode + 1) % 4;
    this.audioEngine.playVisionSwitch(this.visionMode);
    return this.visionMode;
  }

  pounceLeap() {
    if (this.isLeaping) return false;
    this.isLeaping = true;
    this.leapVelocityY = 18;
    this.audioEngine.playSlash();
    return true;
  }

  executeSpineRip() {
    this.audioEngine.playSpineRip();
    this.audioEngine.playYautjaRoar();
    this.brandClanMark();

    const spineGroup = new THREE.Group();
    const boneMat = new THREE.MeshStandardMaterial({ color: 0xddddcc, roughness: 0.5 });
    const bloodMat = new THREE.MeshBasicMaterial({ color: 0x880000 });

    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), boneMat);
    skull.position.y = 1.6;
    spineGroup.add(skull);

    for (let v = 0; v < 8; v++) {
      const vert = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.18, 6), v % 2 === 0 ? boneMat : bloodMat);
      vert.position.y = 1.4 - v * 0.2;
      spineGroup.add(vert);
    }

    this.rightArm.add(spineGroup);
    this.rightArm.rotation.x = -Math.PI * 0.8;

    setTimeout(() => {
      this.rightArm.remove(spineGroup);
      this.rightArm.rotation.x = 0;
    }, 3500);

    return true;
  }

  triggerFacehuggerLatch() {
    if (this.isBlocking || this.isPerched) {
      this.audioEngine.playShieldBlock();
      return;
    }
    this.isFacehuggerLatched = true;
    this.qteStrugglePresses = 0;
    this.audioEngine.playXenoHiss();
  }

  struggleQTE() {
    if (!this.isFacehuggerLatched) return false;
    this.qteStrugglePresses++;
    this.audioEngine.playSkullSnap();

    if (this.qteStrugglePresses >= this.qteRequiredPresses) {
      this.isFacehuggerLatched = false;
      this.qteStrugglePresses = 0;
      this.audioEngine.playYautjaRoar();
      return true;
    }
    return false;
  }

  deployBearTrap(horde) {
    const trapAttack = { origin: this.position, radius: 10, damage: 350 };
    const hits = horde.checkMeleeHits(trapAttack);
    this.audioEngine.playSkullSnap();
    return hits.length > 0;
  }

  useMedicomp() {
    if (this.medicompCharges <= 0) return false;
    this.medicompCharges--;
    this.hp = Math.min(this.maxHp, this.hp + 450);
    this.visorAcidBurn = 0; // Medical bio-gel instantly neutralizes acid corrosion
    this.audioEngine.playMedicompCauterize();
    return true;
  }

  inflictVisorAcidBurn() {
    if (this.isBlocking || this.isPerched) return;
    this.visorAcidBurn = 1.0;
    if (this.audioEngine) {
      this.audioEngine.playVisorAcidBurn();
    }
  }

  useAcidSolvent(horde) {
    if (this.acidSolventCharges <= 0) return false;
    this.acidSolventCharges--;
    horde.acidPools.forEach(pool => horde.scene.remove(pool.mesh));
    horde.acidPools = [];
    this.audioEngine.playAcidSizzle();
    return true;
  }

  triggerFlechetteVolley(targetEnemy = null) {
    if (this.flechetteCooldown > 0 || this.isFacehuggerLatched) return null;
    this.flechetteCooldown = 5.0;

    this.audioEngine.playFlechetteVolleyLaunch();

    const forward = new THREE.Vector3(Math.sin(this.rotationY), 0, Math.cos(this.rotationY)).normalize();
    const origin = this.position.clone().add(new THREE.Vector3(0, 2.0, 0));

    return {
      origin,
      forward,
      target: targetEnemy,
      count: 3,
      damage: 190,
      speed: 46
    };
  }

  performBoneScytheCleave(horde, synthetics, bosses) {
    if (this.boneScytheCooldown > 0 || this.isFacehuggerLatched) return false;
    this.boneScytheCooldown = 5.5;

    this.audioEngine.playBoneScytheCleave();
    this.audioEngine.playYautjaRoar();

    this.mesh.rotation.y += Math.PI * 2;
    this.rightArm.rotation.x = -Math.PI * 0.7;
    setTimeout(() => {
      this.rightArm.rotation.x = 0;
    }, 450);

    const cleaveRadius = 7.5;
    const cleaveDamage = 480;

    if (horde) {
      horde.checkMeleeHits({
        origin: this.position,
        radius: cleaveRadius,
        damage: cleaveDamage,
        type: 'heavy'
      });
      horde.aliens.forEach(a => {
        if (a && a.mesh && a.mesh.position.distanceTo(this.position) <= cleaveRadius) {
          const knockDir = a.mesh.position.clone().sub(this.position).normalize();
          a.mesh.position.addScaledVector(knockDir, 4.5);
        }
      });
    }

    if (synthetics) {
      synthetics.checkHits({
        origin: this.position,
        radius: cleaveRadius,
        damage: cleaveDamage
      });
    }

    if (bosses && bosses.activeBoss) {
      if (bosses.activeBoss.mesh.position.distanceTo(this.position) <= cleaveRadius) {
        bosses.takeDamage(cleaveDamage);
      }
    }

    return true;
  }

  fireCompoundBow() {
    if (this.compoundBowCooldown > 0 || this.isFacehuggerLatched) return null;
    this.compoundBowCooldown = 4.2;

    this.audioEngine.playCompoundBowFire();

    const forward = new THREE.Vector3(Math.sin(this.rotationY), 0, Math.cos(this.rotationY)).normalize();
    const origin = this.position.clone().add(new THREE.Vector3(0, 2.2, 0));

    return {
      origin,
      direction: forward,
      speed: 62,
      damage: 520,
      pierceRemaining: 5,
      life: 2.2
    };
  }

  deployHoloDecoy(scene) {
    if (this.holoDecoyCooldown > 0 || this.isFacehuggerLatched) return null;
    this.holoDecoyCooldown = 16.0;

    this.audioEngine.playHoloDecoyDeploy();

    // Create Holographic Cyan Translucent Clone Mesh
    const decoyGroup = new THREE.Group();
    decoyGroup.position.copy(this.position);
    decoyGroup.rotation.y = this.rotationY;

    const holoMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.6,
      wireframe: true
    });

    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.45, 1.9, 8), holoMat);
    torso.position.y = 1.9;
    decoyGroup.add(torso);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8), holoMat);
    head.position.set(0, 3.2, 0);
    decoyGroup.add(head);

    scene.add(decoyGroup);

    const forward = new THREE.Vector3(Math.sin(this.rotationY), 0, Math.cos(this.rotationY)).normalize();

    return {
      mesh: decoyGroup,
      direction: forward,
      speed: 7.5,
      life: 6.0,
      detonated: false
    };
  }

  triggerNukeSelfDestruct() {
    this.audioEngine.playPredatorLaughCountdown();

    // 3D Holographic Yautja Glyphs Ring over left gauntlet (1987 canon)
    if (!this.wristNukeHoloMesh && this.leftArm) {
      const holoGroup = new THREE.Group();
      const ringGeo = new THREE.TorusGeometry(0.55, 0.03, 8, 24);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xff0033, wireframe: true, transparent: true, opacity: 0.85 });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = Math.PI / 2;
      holoGroup.add(ringMesh);

      // 3 Glowing Yautja glyph prisms
      for (let g = 0; g < 3; g++) {
        const glyph = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.25, 3), new THREE.MeshBasicMaterial({ color: 0xff1144 }));
        const angle = (g / 3) * Math.PI * 2;
        glyph.position.set(Math.cos(angle) * 0.45, 0.08, Math.sin(angle) * 0.45);
        holoGroup.add(glyph);
      }
      holoGroup.position.set(0, -0.6, 0.35);
      this.leftArm.add(holoGroup);
      this.wristNukeHoloMesh = holoGroup;
    }

    return { damage: 10000, radius: 60 };
  }

  clearNukeHoloMesh() {
    if (this.wristNukeHoloMesh && this.leftArm) {
      this.leftArm.remove(this.wristNukeHoloMesh);
      this.wristNukeHoloMesh = null;
    }
  }

  triggerHybridMetamorphosis() {
    if (this.isHybridMutated) return;
    this.isHybridMutated = true;
    this.mesh.scale.set(1.8, 1.8, 1.8);
    this.meleeDamage *= 2.0;

    this.audioEngine.playYautjaRoar();

    setTimeout(() => {
      this.isHybridMutated = false;
      this.mesh.scale.set(1.0, 1.0, 1.0);
      this.meleeDamage /= 2.0;
    }, 15000);
  }

  triggerPlasmaGlaive(horde, synthetics, bosses) {
    if (this.plasmaGlaiveCooldown > 0 || this.isPlasmaGlaiveActive || this.isFacehuggerLatched) return false;
    this.plasmaGlaiveCooldown = 13.0;
    this.isPlasmaGlaiveActive = true;
    this.plasmaGlaiveDuration = 3.6;
    if (this.plasmaGlaiveMesh) this.plasmaGlaiveMesh.visible = true;
    this.audioEngine.playPlasmaGlaiveSpin();
    return true;
  }

  consumeRoyalJelly() {
    if (this.royalJellyFlasks <= 0 || this.isBerserkerActive || this.isFacehuggerLatched) return false;
    this.royalJellyFlasks--;
    this.isBerserkerActive = true;
    this.berserkerTimer = 12.0;
    this.hp = Math.min(this.maxHp, this.hp + 250);
    this.visorAcidBurn = 0;
    this.audioEngine.playBerserkerRoar();
    return true;
  }

  recordTrophy(trophyName, honorPoints) {
    const trophy = {
      name: trophyName,
      honor: honorPoints,
      timestamp: new Date().toLocaleTimeString()
    };
    this.trophiesCollected.push(trophy);
    if (this.audioEngine && this.audioEngine.playTrophyClaim) {
      this.audioEngine.playTrophyClaim();
    }
    return trophy;
  }

  toggleWeaponSwap() {
    this.isSecondaryWeapon = !this.isSecondaryWeapon;
    this.secWeaponMesh.visible = this.isSecondaryWeapon;
    this.blade1.visible = !this.isSecondaryWeapon;
    if (this.blade2) this.blade2.visible = !this.isSecondaryWeapon;
    this.audioEngine.playWeaponSwap();
    return this.isSecondaryWeapon;
  }

  toggleCloak() {
    this.isCloaked = !this.isCloaked;
    const opacity = this.isCloaked ? 0.22 : 1.0;
    const transparent = this.isCloaked;

    this.skinMaterials.forEach(m => {
      m.transparent = transparent;
      m.opacity = opacity;
      if (this.isCloaked) {
        m.roughness = 0.1;
        m.metalness = 0.95;
      } else {
        m.roughness = 0.7;
        m.metalness = 0.1;
      }
    });

    this.armorMaterials.forEach(m => {
      m.transparent = transparent;
      m.opacity = opacity;
      if (this.isCloaked) {
        m.roughness = 0.05;
        m.metalness = 0.98;
      } else {
        m.roughness = 0.3;
        m.metalness = 0.8;
      }
    });

    return this.isCloaked;
  }

  move(dir, delta) {
    if (this.isFacehuggerLatched || this.isPerched) return;

    if (dir.lengthSq() > 0) {
      dir.normalize();
      const speedMult = (this.warhornBuffTimer > 0 ? 1.4 : 1.0) * (this.isBerserkerActive ? 1.45 : 1.0);
      const moveDistance = this.moveSpeed * speedMult * delta;
      this.position.addScaledVector(dir, moveDistance);

      const targetAngle = Math.atan2(dir.x, dir.z);
      let diff = targetAngle - this.rotationY;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      this.rotationY += diff * 12 * delta;

      const stride = Math.sin(Date.now() * 0.015) * 0.5;
      this.leftLeg.rotation.x = stride;
      this.rightLeg.rotation.x = -stride;
    } else {
      this.leftLeg.rotation.x *= 0.8;
      this.rightLeg.rotation.x *= 0.8;
    }

    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.rotationY;
  }

  lightAttack() {
    if (this.isAttacking || this.isFacehuggerLatched) return null;
    this.isAttacking = true;
    this.attackComboStep = (this.attackComboStep % 5) + 1;
    this.attackTimer = 0.28;
    this.comboResetTimer = 1.4;

    this.audioEngine.playSlash();

    // Distinct arm postures for 5-tier light string
    const s = this.attackComboStep;
    if (s === 1) {
      this.rightArm.rotation.x = -Math.PI * 0.55;
      this.rightArm.rotation.y = 0.45;
    } else if (s === 2) {
      this.rightArm.rotation.x = -Math.PI * 0.4;
      this.rightArm.rotation.y = -0.55;
    } else if (s === 3) {
      this.rightArm.rotation.x = -Math.PI * 0.65;
      this.rightArm.rotation.y = 0.2;
    } else if (s === 4) {
      this.rightArm.rotation.x = -Math.PI * 0.35;
      this.rightArm.rotation.y = -0.3;
    } else {
      this.rightArm.rotation.x = -Math.PI * 0.75;
      this.rightArm.rotation.y = 0.6;
    }

    const baseDmg = this.isSecondaryWeapon ? this.meleeDamage * 1.3 : this.meleeDamage;
    const buff = (this.warhornBuffTimer > 0 ? 1.5 : 1.0) * (this.isBerserkerActive ? 2.0 : 1.0);

    return {
      type: 'light',
      step: this.attackComboStep,
      damage: baseDmg * (1 + this.attackComboStep * 0.18) * buff,
      radius: this.isSecondaryWeapon ? 4.8 : 3.8,
      angle: Math.PI * 0.65
    };
  }

  heavyAttack() {
    if (this.isAttacking || this.isFacehuggerLatched) return null;
    this.isAttacking = true;

    const step = this.attackComboStep;
    const baseDmg = this.isSecondaryWeapon ? this.meleeDamage * 1.3 : this.meleeDamage;
    const buff = (this.warhornBuffTimer > 0 ? 1.5 : 1.0) * (this.isBerserkerActive ? 2.0 : 1.0);

    let chargeType = 'c1';
    let chargeName = 'C1 - DISLOCATION CINÉTIQUE (GUARD-BREAK)';
    let dmgMult = 2.0;
    let radius = 7.0;
    let knockback = 9.0;
    let isLauncher = false;
    let launchVelY = 0;
    let isStun = false;
    let stunDuration = 0;

    if (step === 0) {
      // C1: Concussive Guard Break / Launcher thrust (Ki'cte Gauntlet strike)
      this.attackTimer = 0.42;
      this.audioEngine.playSlash();
      this.rightArm.rotation.x = -Math.PI * 0.7;
      chargeType = 'c1';
      chargeName = "C1 - KI'CTE CINÉTIQUE (BRISE-GARDE)";
      dmgMult = 2.0;
      radius = 7.0;
      knockback = 9.5;
    } else if (step === 1) {
      // C2: Vertical Blade Uppercut (Airborne Juggle Launcher - S'yuit-de Upper thrust)
      this.attackTimer = 0.45;
      this.audioEngine.playLauncherWhoosh();
      this.rightArm.rotation.x = -Math.PI * 0.9;
      chargeType = 'c2';
      chargeName = "C2 - PROJECTION CÉLESTE S'YUIT-DE (JUGGLE)";
      dmgMult = 2.6;
      radius = 5.2;
      isLauncher = true;
      launchVelY = 19.0;
    } else if (step === 2) {
      // C3: Hundred-Claw Flurry Stun Barrage (Dahdt-ne Hundred Claws)
      this.attackTimer = 0.55;
      this.audioEngine.playSlash();
      this.audioEngine.playYautjaClick();
      chargeType = 'c3';
      chargeName = "C3 - RAFALE CENT-GRIFFES DAHDT-NE (STUN)";
      dmgMult = 3.5;
      radius = 6.0;
      isStun = true;
      stunDuration = 3.2;
      knockback = 3.5;
    } else if (step === 3) {
      // C4: Tornado Crowd-Clearing Cleave (Guan-thwei Whirlwind)
      this.attackTimer = 0.52;
      this.audioEngine.playSlash();
      this.audioEngine.playYautjaRoar();
      this.mesh.rotation.y += Math.PI * 2;
      chargeType = 'c4';
      chargeName = "C4 - TORNADE DÉMEMBRANTE GUAN-THWEI (300°)";
      dmgMult = 4.4;
      radius = 9.8;
      knockback = 15.0;
    } else if (step === 4) {
      // C5: Geyser Celestial Plasma Vortex (Thwei-mhi Celestial Geyser)
      this.attackTimer = 0.62;
      this.audioEngine.playLauncherWhoosh();
      this.audioEngine.playPlasmaShot();
      chargeType = 'c5';
      chargeName = "C5 - VORTEX CÉLESTE THWEI-MHI (GEYSER)";
      dmgMult = 5.5;
      radius = 11.5;
      isLauncher = true;
      launchVelY = 25.0;
    } else {
      // C6: Apex Seismic Shockwave Cataclysm (Prah'khe Apex Slam)
      this.attackTimer = 0.78;
      this.audioEngine.playC6CataclysmBoom();
      this.audioEngine.playYautjaRoar();
      chargeType = 'c6';
      chargeName = "C6 - CATACLYSME SISMIQUE PRAH'KHE (360°)";
      dmgMult = 7.2;
      radius = 16.5;
      knockback = 18.0;
      isLauncher = true;
      launchVelY = 17.0;
    }

    // Reset combo string after any Charge finisher
    this.attackComboStep = 0;
    this.comboResetTimer = 0;
    this.currentChargeName = chargeName;

    return {
      type: chargeType,
      name: chargeName,
      damage: baseDmg * dmgMult * buff,
      radius: radius,
      knockback: knockback,
      isLauncher: isLauncher,
      launchVelY: launchVelY,
      isStun: isStun,
      stunDuration: stunDuration,
      angle: Math.PI * 2
    };
  }

  firePlasmaShot() {
    if (this.plasmaEnergy < this.data.stats.plasmaEnergyCost || this.isFacehuggerLatched) return null;
    this.plasmaEnergy -= this.data.stats.plasmaEnergyCost;

    this.audioEngine.playPlasmaShot();

    const origin = this.position.clone().add(new THREE.Vector3(0, 2.5, 0));
    const forward = new THREE.Vector3(
      Math.sin(this.rotationY),
      this.isPerched ? -0.4 : 0, // Aim downwards when perched!
      Math.cos(this.rotationY)
    ).normalize();

    return {
      position: origin,
      direction: forward,
      damage: this.plasmaDamage,
      speed: 45
    };
  }

  triggerMusouOverload() {
    if (this.musouEnergy < 100 || this.isFacehuggerLatched) return false;
    this.musouEnergy = 0;
    this.isMusouActive = true;

    this.audioEngine.playMusouBlast();

    setTimeout(() => {
      this.isMusouActive = false;
    }, 2000);

    return true;
  }

  takeDamage(amount, isAcid = false) {
    if (this.isBlocking || this.isPerched) {
      this.audioEngine.playShieldBlock();
      return this.hp;
    }
    if (this.isPlasmaGlaiveActive) {
      this.audioEngine.playPlasmaGlaiveStrike();
      return this.hp; // Plasma Glaive cyclone barrier completely deflects frontal attacks!
    }
    if (this.isHybridMutated) return this.hp;
    if (this.isBerserkerActive) {
      amount *= 0.5; // 50% damage reduction in Berserker Rage
      isAcid = false; // Immune to acid burns in Berserker Rage
    }
    if (this.isCloaked) {
      amount *= 0.5;
      if (this.particles && this.particles.emitCloakSparkFlicker) {
        this.particles.emitCloakSparkFlicker(this.position, 14);
      }
      if (this.audioEngine && this.audioEngine.playCloakFlicker) {
        this.audioEngine.playCloakFlicker();
      }
    }
    this.hp = Math.max(0, this.hp - amount);

    if (isAcid && !this.isBerserkerActive) {
      this.inflictVisorAcidBurn();
    }

    // Luminescent neon green Yautja bio-blood splatter
    if (this.particles && amount > 2) {
      this.particles.emitYautjaPhosphorBlood(this.position, Math.min(20, Math.floor(amount * 0.4)));
    }

    return this.hp;
  }

  update(delta, horde = null) {
    if (this.visorAcidBurn > 0) {
      this.visorAcidBurn = Math.max(0, this.visorAcidBurn - delta * 0.35);
    }

    if (this.wristNukeHoloMesh) {
      this.wristNukeHoloMesh.rotation.y += delta * 4.5;
    }

    if (this.warhornBuffTimer > 0) {
      this.warhornBuffTimer -= delta;
    }

    if (this.empCooldown > 0) {
      this.empCooldown = Math.max(0, this.empCooldown - delta);
    }

    if (this.combiStickCooldown > 0) {
      this.combiStickCooldown = Math.max(0, this.combiStickCooldown - delta);
    }

    if (this.shurikenCooldown > 0) {
      this.shurikenCooldown = Math.max(0, this.shurikenCooldown - delta);
    }

    if (this.powerGloveCooldown > 0) {
      this.powerGloveCooldown = Math.max(0, this.powerGloveCooldown - delta);
    }

    if (this.spineWhipCooldown > 0) {
      this.spineWhipCooldown = Math.max(0, this.spineWhipCooldown - delta);
    }

    if (this.flechetteCooldown > 0) {
      this.flechetteCooldown = Math.max(0, this.flechetteCooldown - delta);
    }

    if (this.boneScytheCooldown > 0) {
      this.boneScytheCooldown = Math.max(0, this.boneScytheCooldown - delta);
    }

    if (this.compoundBowCooldown > 0) {
      this.compoundBowCooldown = Math.max(0, this.compoundBowCooldown - delta);
    }

    if (this.holoDecoyCooldown > 0) {
      this.holoDecoyCooldown = Math.max(0, this.holoDecoyCooldown - delta);
    }

    if (this.plasmaGlaiveCooldown > 0) {
      this.plasmaGlaiveCooldown = Math.max(0, this.plasmaGlaiveCooldown - delta);
    }

    if (this.isPlasmaGlaiveActive) {
      this.plasmaGlaiveDuration -= delta;
      if (this.plasmaGlaiveMesh) {
        this.plasmaGlaiveMesh.rotation.z += delta * 32.0;
      }

      if (horde) {
        horde.checkMeleeHits({
          origin: this.position,
          radius: 4.8,
          damage: 160 * delta * 5,
          type: 'plasma'
        });

        // Vaporize any zero-G acid globules within whirl barrier
        if (horde.zeroGAcidGlobules) {
          for (let g = horde.zeroGAcidGlobules.length - 1; g >= 0; g--) {
            const glob = horde.zeroGAcidGlobules[g];
            if (glob && glob.mesh && glob.mesh.position.distanceTo(this.position) <= 5.0) {
              if (this.audioEngine) this.audioEngine.playAcidGlobuleHiss();
              horde.scene.remove(glob.mesh);
              horde.zeroGAcidGlobules.splice(g, 1);
            }
          }
        }
      }

      if (this.plasmaGlaiveDuration <= 0) {
        this.isPlasmaGlaiveActive = false;
        if (this.plasmaGlaiveMesh) this.plasmaGlaiveMesh.visible = false;
      }
    }

    if (this.isBerserkerActive) {
      this.berserkerTimer -= delta;
      this.hp = Math.min(this.maxHp, this.hp + 28 * delta);
      this.visorAcidBurn = 0;

      this.berserkerHeartbeatTimer -= delta;
      if (this.berserkerHeartbeatTimer <= 0) {
        this.berserkerHeartbeatTimer = 0.85;
        this.audioEngine.playBerserkerHeartbeat();
      }

      if (this.berserkerTimer <= 0) {
        this.isBerserkerActive = false;
      }
    }

    if (this.isCloaked) {
      this.cloakShimmerTimer += delta * 4;
      const shimmer = 0.2 + Math.sin(this.cloakShimmerTimer) * 0.08;
      this.skinMaterials.forEach(m => { m.opacity = shimmer; });
      this.armorMaterials.forEach(m => { m.opacity = shimmer; });
    }

    if (this.isFacehuggerLatched) {
      this.takeDamage(40 * delta);
    }

    if (this.isLeaping) {
      this.leapVelocityY -= 36 * delta;
      this.position.y += this.leapVelocityY * delta;

      if (this.position.y <= 0) {
        this.position.y = 0;
        this.isLeaping = false;
        this.audioEngine.playPounceImpact();

        if (horde) {
          horde.checkMeleeHits({
            origin: this.position,
            radius: 8.5,
            damage: this.meleeDamage * 2.0,
            type: 'heavy'
          });
        }
      }
      this.mesh.position.copy(this.position);
    }

    if (this.isAttacking) {
      this.attackTimer -= delta;
      if (this.attackTimer <= 0) {
        this.isAttacking = false;
        this.rightArm.rotation.x = 0;
        this.rightArm.rotation.y = 0;
      }
    }

    if (this.plasmaEnergy < this.maxPlasmaEnergy) {
      this.plasmaEnergy = Math.min(this.maxPlasmaEnergy, this.plasmaEnergy + 15 * delta);
    }
  }
}
