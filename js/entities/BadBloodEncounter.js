/* Bad Blood Rogue Yautja Encounter System - Renegade Predator Ambush */

import * as THREE from 'three';

export class BadBloodManager {
  constructor(scene, audioEngine) {
    this.scene = scene;
    this.audioEngine = audioEngine;
    this.badBlood = null;
    this.isActive = false;
  }

  spawnAmbush(playerPos) {
    if (this.badBlood) {
      this.scene.remove(this.badBlood.mesh);
    }

    const mesh = this.createBadBloodMesh();
    // Spawn 20m behind player
    mesh.position.set(playerPos.x + (Math.random() - 0.5) * 15, 0, playerPos.z + 18);
    this.scene.add(mesh);

    this.badBlood = {
      mesh,
      hp: 2200,
      maxHp: 2200,
      speed: 16,
      damage: 75,
      isCloaked: true,
      cloakTimer: 4.0,
      attackCooldown: 0
    };
    this.isActive = true;

    this.audioEngine.playYautjaRoar();
  }

  createBadBloodMesh() {
    const group = new THREE.Group();
    const armorMat = new THREE.MeshStandardMaterial({ color: 0x221111, metalness: 0.8, roughness: 0.3 }); // Dark crimson armor
    const skinMat = new THREE.MeshStandardMaterial({ color: 0x5a4835, roughness: 0.6 });
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xff3333, metalness: 0.95 });

    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.65, 2.3, 8), skinMat);
    torso.position.y = 2.2;
    group.add(torso);

    const chest = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.3, 1.3), armorMat);
    chest.position.y = 2.4;
    group.add(chest);

    // Defiled Bone Mask
    const mask = new THREE.Mesh(new THREE.SphereGeometry(0.68, 10, 10), new THREE.MeshStandardMaterial({ color: 0xddccaa, roughness: 0.5 }));
    mask.position.set(0, 3.6, 0.1);
    group.add(mask);

    // Dual Serrated Blood-Stained Wristblades (Barbaric Jagged Edges)
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, metalness: 0.95, roughness: 0.2 });
    [-1.25, 1.25].forEach(side => {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.2, 1.6, 6), skinMat);
      arm.position.set(side, 2.2, 0);
      group.add(arm);

      const gauntlet = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 0.4), armorMat);
      gauntlet.position.set(side, 1.6, 0.1);
      group.add(gauntlet);

      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.6, 0.04), bladeMat);
      blade.position.set(side, 1.6, 0.9);
      blade.rotation.x = Math.PI / 2;
      group.add(blade);
    });

    // Dreadlocks with bone quills (Wild unkempt renegade hair)
    const dreadMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
    for (let d = -4; d <= 4; d++) {
      const dread = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.04, 1.8, 6), dreadMat);
      const angle = (d / 4) * Math.PI * 0.45;
      dread.position.set(Math.sin(angle) * 0.6, 3.3, -0.4 - Math.cos(angle) * 0.25);
      dread.rotation.x = -0.4;
      dread.rotation.z = angle * 0.4;
      group.add(dread);
    }

    // Severed Skull Trophies Clustered at Belt (Taboo dishonor trophies - Dark Horse Comics 1993)
    const boneMat = new THREE.MeshStandardMaterial({ color: 0xd4cdb4, roughness: 0.6 });
    for (let s = 0; s < 3; s++) {
      const skull = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 6), boneMat);
      skull.position.set((s - 1) * 0.45, 1.2, 0.7);
      group.add(skull);
    }

    // Plasma Caster Cannon on shoulder
    const casterMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, metalness: 0.9 });
    const caster = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.8, 6), casterMat);
    caster.rotation.x = Math.PI / 2;
    caster.position.set(-1.1, 3.4, 0.2);
    group.add(caster);

    return group;
  }

  update(delta, player) {
    if (!this.isActive || !this.badBlood) return;

    const bb = this.badBlood;

    // Cloaking flicker
    bb.cloakTimer -= delta;
    if (bb.cloakTimer <= 0) {
      bb.isCloaked = !bb.isCloaked;
      bb.cloakTimer = bb.isCloaked ? 3.5 : 5.0;
      bb.mesh.traverse(child => {
        if (child.isMesh) {
          child.material.transparent = bb.isCloaked;
          child.material.opacity = bb.isCloaked ? 0.35 : 1.0;
        }
      });
      this.audioEngine.playYautjaClick();
    }

    // Aggressive dash & strike
    const dir = player.position.clone().sub(bb.mesh.position);
    dir.y = 0;
    const dist = dir.length();

    // Plasma Caster Cannon shot at medium distance (6m - 18m)
    if (!bb.plasmaTimer) bb.plasmaTimer = 3.0;
    bb.plasmaTimer -= delta;
    if (dist >= 6.0 && dist <= 18.0 && bb.plasmaTimer <= 0) {
      bb.plasmaTimer = 4.2;
      this.audioEngine.playPlasmaShot();
      if (!player.isBlocking) {
        player.takeDamage(55);
      } else {
        player.audioEngine.playShieldBlock();
      }
    }

    if (dist > 2.2) {
      dir.normalize();
      bb.mesh.position.addScaledVector(dir, bb.speed * delta);
      bb.mesh.rotation.y = Math.atan2(dir.x, dir.z);
    } else {
      if (bb.attackCooldown <= 0) {
        bb.attackCooldown = 0.8;
        this.audioEngine.playSlash();
        player.takeDamage(bb.damage);
      }
    }

    if (bb.attackCooldown > 0) {
      bb.attackCooldown -= delta;
    }
  }

  takeDamage(amount) {
    if (!this.badBlood) return false;
    this.badBlood.hp -= amount;
    if (this.badBlood.hp <= 0) {
      this.scene.remove(this.badBlood.mesh);
      this.badBlood = null;
      this.isActive = false;
      this.audioEngine.playYautjaRoar();
      return true; // Killed Bad Blood!
    }
    return false;
  }
}
