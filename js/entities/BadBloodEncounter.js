/* Bad Blood Rogue Yautja Encounter System - Renegade Predator Ambush */

import * as THREE from 'three';
import { disposeObject } from '../engine/SceneResources.js';
import { selectHostileTarget, requestHostileAttack, syncHostileWarning, releaseHostileAttack } from '../engine/HostilePressure.js';

export class BadBloodManager {
  constructor(scene, audioEngine) {
    this.scene = scene;
    this.audioEngine = audioEngine;
    this.badBlood = null;
    this.isActive = false;
  }

  spawnAmbush(playerPos) {
    if (this.badBlood) {
      releaseHostileAttack(this, this.badBlood);
      disposeObject(this.badBlood.mesh);
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
      attackCooldown: 1.5,
      plasmaTimer: 3
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

    // Dual Wicked Scythe Blades
    const leftBlade = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.8, 0.04), bladeMat);
    leftBlade.position.set(-1.3, 2.0, 0.8);
    leftBlade.rotation.x = Math.PI / 2;
    group.add(leftBlade);

    const rightBlade = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.8, 0.04), bladeMat);
    rightBlade.position.set(1.3, 2.0, 0.8);
    rightBlade.rotation.x = Math.PI / 2;
    group.add(rightBlade);

    return group;
  }

  update(delta, player) {
    if (!this.isActive || !this.badBlood) return;

    const bb = this.badBlood;
    player = selectHostileTarget(this, bb.mesh.position, player);
    if (!player || player.hp <= 0) { releaseHostileAttack(this, bb); return; }

    // Cloaking flicker
    bb.cloakTimer -= delta;
    if (bb.cloakTimer <= 0) {
      bb.isCloaked = !bb.isCloaked;
      bb.cloakTimer = bb.isCloaked ? 3.5 : 5.0;
      bb.mesh.traverse(child => {
        if (child.isMesh && child.name !== 'hostile-attack-warning') {
          child.material.transparent = bb.isCloaked;
          child.material.opacity = bb.isCloaked ? 0.35 : 1.0;
        }
      });
      this.audioEngine.playYautjaClick();
    }

    const dir = player.position.clone().sub(bb.mesh.position); dir.y = 0;
    const distance = dir.length();
    bb.attackCooldown = Math.max(0, (bb.attackCooldown ?? 1.5) - delta);
    bb.plasmaTimer = Math.max(0, (bb.plasmaTimer ?? 3) - delta);
    if (!bb.pressureAction) {
      if (distance <= 3 && bb.attackCooldown <= 0) bb.pressureAction = 'blade';
      else if (distance >= 6 && distance <= 18 && bb.plasmaTimer <= 0) bb.pressureAction = 'plasma';
    }
    const action = bb.pressureAction;
    if (action && (distance > (action === 'blade' ? 3.5 : 20))) {
      releaseHostileAttack(this, bb); bb.pressureAction = null;
    } else if (action && requestHostileAttack(this, bb, player, delta, {
      kind: action === 'blade' ? 'melee' : 'ranged', windup: action === 'blade' ? 0.9 : 1.1,
      recovery: 1.7, duration: 0.4
    })) {
      if (action === 'plasma') {
        bb.plasmaTimer = 5.2; this.audioEngine.playPlasmaShot();
        if (!player.isBlocking) player.takeDamage(55); else player.audioEngine.playShieldBlock();
      } else {
        bb.attackCooldown = 1.8; this.audioEngine.playSlash();
        if (distance <= 3.5) player.takeDamage(bb.damage);
      }
      bb.pressureAction = null;
    }
    syncHostileWarning(this, bb, 1.65);
    const preparing = this.combatDirector?.getAttackState(bb)?.phase === 'windup' || bb._localAttackPreparation;
    if (distance > 2.7 && !preparing) {
      bb.mesh.position.addScaledVector(dir.normalize(), Math.min(bb.speed * delta, distance - 2.7));
      bb.mesh.rotation.y = Math.atan2(dir.x, dir.z);
    }
  }

  clear() {
    releaseHostileAttack(this, this.badBlood);
    disposeObject(this.badBlood?.mesh);
    this.badBlood = null;
    this.isActive = false;
  }

  takeDamage(amount) {
    if (!Number.isFinite(amount) || amount <= 0) return false;
    if (!this.badBlood) return false;
    this.badBlood.hp -= amount;
    if (this.badBlood.hp <= 0) {
      releaseHostileAttack(this, this.badBlood);
      disposeObject(this.badBlood.mesh);
      this.badBlood = null;
      this.isActive = false;
      this.audioEngine.playYautjaRoar();
      return true; // Killed Bad Blood!
    }
    return false;
  }
}
