/* Playable Yautja 3D Mesh Generator & State Controller (Facehugger QTE System) */

import * as THREE from 'three';

export class Player {
  constructor(scene, charData, audioEngine, isPlayer2 = false) {
    this.scene = scene;
    this.data = charData;
    this.audioEngine = audioEngine;
    this.isPlayer2 = isPlayer2;

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
    this.isThermal = false;
    this.isCloaked = false;
    this.isMusouActive = false;
    this.isSecondaryWeapon = false;
    this.isHybridMutated = false;

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

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.65, 12, 12), maskMat);
    head.position.set(0, 3.6, 0.1);
    group.add(head);

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

    const gauntlet = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.5), armorMat);
    gauntlet.position.set(1.2, 1.8, 0);
    group.add(gauntlet);

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

  triggerFacehuggerLatch() {
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
      return true; // Successfully ripped off Facehugger!
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
    this.hp = Math.min(this.maxHp, this.hp + 350);
    this.audioEngine.playSkullSnap();
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
    this.audioEngine.playMusouBlast();
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

  toggleThermal() {
    this.isThermal = !this.isThermal;
    return this.isThermal;
  }

  toggleCloak() {
    this.isCloaked = !this.isCloaked;
    const opacity = this.isCloaked ? 0.25 : 1.0;
    const transparent = this.isCloaked;

    this.skinMaterials.forEach(m => { m.transparent = transparent; m.opacity = opacity; });
    this.armorMaterials.forEach(m => { m.transparent = transparent; m.opacity = opacity; });

    return this.isCloaked;
  }

  move(dir, delta) {
    if (this.isFacehuggerLatched) return; // Frozen while struggling!

    if (dir.lengthSq() > 0) {
      dir.normalize();
      const moveDistance = this.moveSpeed * delta;
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

    return {
      type: 'light',
      damage: baseDmg * (1 + this.attackComboStep * 0.2),
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

    return {
      type: 'heavy',
      damage: this.meleeDamage * 2.5,
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
      0,
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
    if (this.isHybridMutated) return this.hp;
    if (this.isCloaked) amount *= 0.5;
    this.hp = Math.max(0, this.hp - amount);
    return this.hp;
  }

  update(delta) {
    if (this.isFacehuggerLatched) {
      this.takeDamage(40 * delta); // Facehugger suffocates player!
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
