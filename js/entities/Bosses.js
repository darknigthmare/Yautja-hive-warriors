/* Mythic Boss Raid Manager (Predalien Queen & Flying Empress Matriarch) */

import * as THREE from 'three';

export class BossManager {
  constructor(scene, audioEngine) {
    this.scene = scene;
    this.audioEngine = audioEngine;
    this.activeBoss = null;
    this.acidSpitProjectiles = [];
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
  }

  update(delta, player) {
    if (!this.activeBoss) return;

    // Update Queen acid spit projectiles
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

    if (this.activeBoss.isStunned) {
      this.activeBoss.stunTimer -= delta;
      if (this.activeBoss.stunTimer <= 0) {
        this.activeBoss.isStunned = false;
      }
      return;
    }

    // Cooldown management for attacks
    if (!this.activeBoss.tailWhipCooldown) this.activeBoss.tailWhipCooldown = 3.5;
    if (!this.activeBoss.spitCooldown) this.activeBoss.spitCooldown = 4.0;

    this.activeBoss.tailWhipCooldown -= delta;
    this.activeBoss.spitCooldown -= delta;

    const dir = player.position.clone().sub(this.activeBoss.mesh.position);
    dir.y = 0;
    const dist = dir.length();

    // 1. Long range: Acid Mortar Spit
    if (dist > 9.0 && dist < 35.0 && this.activeBoss.spitCooldown <= 0) {
      this.activeBoss.spitCooldown = 4.5;
      this.spitAcidMortar(player);
    }

    // 2. Medium-close range: Tail Whip 360
    if (dist <= 8.5 && this.activeBoss.tailWhipCooldown <= 0) {
      this.activeBoss.tailWhipCooldown = 4.0;
      this.triggerTailWhip(player);
    }

    // 3. Movement
    if (dist > 3.0) {
      dir.normalize();
      this.activeBoss.mesh.position.addScaledVector(dir, 7.5 * delta);
      this.activeBoss.mesh.rotation.y = Math.atan2(dir.x, dir.z);
    } else {
      player.takeDamage(45 * delta);
    }
  }
}
