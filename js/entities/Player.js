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
    this.blade1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.4, 0.02), bladeMat);
    this.blade1.position.set(1.3, 1.8, 0.8);
    this.blade1.rotation.x = Math.PI / 2;
    group.add(this.blade1);

    this.secWeaponMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.05, 12), bladeMat);
    this.secWeaponMesh.position.set(-1.2, 1.8, 0.6);
    this.secWeaponMesh.visible = false;
    group.add(this.secWeaponMesh);

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
    horde.aliens.forEach(a => {
      if (a.mesh.position.distanceTo(lurePoint) < 30) {
        a.mesh.position.addScaledVector(lurePoint.clone().sub(a.mesh.position).normalize(), 2.5);
      }
    });
    return true;
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
    this.audioEngine.playMedicompCauterize();
    return true;
  }

  useAcidSolvent(horde) {
    if (this.acidSolventCharges <= 0) return false;
    this.acidSolventCharges--;
    horde.acidPools.forEach(pool => horde.scene.remove(pool.mesh));
    horde.acidPools = [];
    this.audioEngine.playAcidSizzle();
    return true;
  }

  triggerNukeSelfDestruct() {
    this.audioEngine.playPredatorLaughCountdown();
    return { damage: 10000, radius: 60 };
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

  toggleWeaponSwap() {
    this.isSecondaryWeapon = !this.isSecondaryWeapon;
    this.secWeaponMesh.visible = this.isSecondaryWeapon;
    this.blade1.visible = !this.isSecondaryWeapon;
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
      const speedMult = this.warhornBuffTimer > 0 ? 1.4 : 1.0;
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
    this.attackComboStep = (this.attackComboStep % 3) + 1;
    this.attackTimer = 0.3;

    this.audioEngine.playSlash();

    this.rightArm.rotation.x = -Math.PI * 0.6;
    this.rightArm.rotation.y = 0.4;

    const baseDmg = this.isSecondaryWeapon ? this.meleeDamage * 1.3 : this.meleeDamage;
    const buff = this.warhornBuffTimer > 0 ? 1.5 : 1.0;

    return {
      type: 'light',
      damage: baseDmg * (1 + this.attackComboStep * 0.2) * buff,
      radius: this.isSecondaryWeapon ? 4.5 : 3.5,
      angle: Math.PI * 0.6
    };
  }

  heavyAttack() {
    if (this.isAttacking || this.isFacehuggerLatched) return null;
    this.isAttacking = true;
    this.attackTimer = 0.5;

    this.audioEngine.playSlash();
    this.audioEngine.playYautjaRoar();

    this.mesh.rotation.y += Math.PI * 2;
    const buff = this.warhornBuffTimer > 0 ? 1.5 : 1.0;

    return {
      type: 'heavy',
      damage: this.meleeDamage * 2.5 * buff,
      radius: 6.0,
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

  takeDamage(amount) {
    if (this.isBlocking || this.isPerched) {
      this.audioEngine.playShieldBlock();
      return this.hp;
    }
    if (this.isHybridMutated) return this.hp;
    if (this.isCloaked) amount *= 0.5;
    this.hp = Math.max(0, this.hp - amount);

    // Luminescent neon green Yautja bio-blood splatter
    if (this.particles && amount > 2) {
      this.particles.emitYautjaPhosphorBlood(this.position, Math.min(20, Math.floor(amount * 0.4)));
    }

    return this.hp;
  }

  update(delta, horde = null) {
    if (this.warhornBuffTimer > 0) {
      this.warhornBuffTimer -= delta;
    }

    if (this.empCooldown > 0) {
      this.empCooldown = Math.max(0, this.empCooldown - delta);
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
