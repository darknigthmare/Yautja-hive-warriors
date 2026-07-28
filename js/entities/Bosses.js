/* Mythic Boss Raid Manager (Predalien Queen & Flying Empress Matriarch) */

import * as THREE from 'three';

export class BossManager {
  constructor(scene, audioEngine) {
    this.scene = scene;
    this.audioEngine = audioEngine;
    this.activeBoss = null;
  }

  spawnBoss(type, spawnPos) {
    if (this.activeBoss) {
      this.scene.remove(this.activeBoss.mesh);
    }

    const mesh = this.createBossMesh(type);
    mesh.position.copy(spawnPos);
    this.scene.add(mesh);

    const isImperial = type === 'imperial_queen';
    const isEmpress = type === 'empress_matriarch';
    const isPredalienQueen = type === 'predalien_queen';

    const hp = isImperial ? 8000 : (isEmpress ? 6000 : (isPredalienQueen ? 5000 : 3000));

    this.activeBoss = {
      type: type,
      mesh: mesh,
      hp: hp,
      maxHp: hp,
      isStunned: false,
      stunTimer: 0,
      phase: 1
    };

    this.audioEngine.playYautjaRoar();
  }

  createBossMesh(type) {
    const group = new THREE.Group();
    const isEmpress = type === 'empress_matriarch';
    const scale = isEmpress ? 2.5 : (type === 'imperial_queen' ? 2.8 : 1.8);

    const mat = new THREE.MeshStandardMaterial({
      color: type === 'predalien_queen' ? 0x4a3b2b : (isEmpress ? 0x2b0d3d : 0x11161d),
      metalness: 0.8,
      roughness: 0.2
    });

    const headGeo = new THREE.BoxGeometry(1.2 * scale, 0.8 * scale, 3.5 * scale);
    const head = new THREE.Mesh(headGeo, mat);
    head.position.set(0, 3.5 * scale, 0.5);
    group.add(head);

    const torsoGeo = new THREE.CylinderGeometry(1.0 * scale, 0.8 * scale, 4.0 * scale, 8);
    const torso = new THREE.Mesh(torsoGeo, mat);
    torso.position.y = 2.0 * scale;
    group.add(torso);

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

  takeDamage(amount) {
    if (!this.activeBoss) return;
    this.activeBoss.hp -= amount;

    if (this.activeBoss.hp <= this.activeBoss.maxHp * 0.3 && !this.activeBoss.isStunned) {
      this.activeBoss.isStunned = true;
      this.activeBoss.stunTimer = 6.0;
    }
  }

  update(delta, player) {
    if (!this.activeBoss) return;

    if (this.activeBoss.isStunned) {
      this.activeBoss.stunTimer -= delta;
      if (this.activeBoss.stunTimer <= 0) {
        this.activeBoss.isStunned = false;
      }
      return;
    }

    // Boss AI Movement
    const dir = player.position.clone().sub(this.activeBoss.mesh.position);
    dir.y = 0;
    if (dir.length() > 3.0) {
      dir.normalize();
      this.activeBoss.mesh.position.addScaledVector(dir, 7.5 * delta);
      this.activeBoss.mesh.rotation.y = Math.atan2(dir.x, dir.z);
    } else {
      player.takeDamage(45 * delta);
    }
  }
}
