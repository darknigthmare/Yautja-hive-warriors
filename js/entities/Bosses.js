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

    const isImperial = type === 'imperial_queen';
    const isEmpress = type === 'empress_matriarch';
    const isPredalienQueen = type === 'predalien_queen';
    const isOffspring = type === 'the_offspring';

    const hp = isImperial ? 8000 : (isEmpress ? 6000 : (isPredalienQueen ? 5000 : (isOffspring ? 4500 : 3000)));

    this.activeBoss = {
      type: type,
      mesh: mesh,
      hp: hp,
      maxHp: hp,
      isStunned: false,
      stunTimer: 0,
      phase: 1
    };

    if (isOffspring) {
      this.audioEngine.playOffspringShriek();
    } else {
      this.audioEngine.playYautjaRoar();
    }
  }

  createBossMesh(type) {
    const group = new THREE.Group();
    const isEmpress = type === 'empress_matriarch';
    const isPredalien = type === 'predalien_queen';
    const isOffspring = type === 'the_offspring';
    const scale = isEmpress ? 2.5 : (type === 'imperial_queen' ? 2.8 : (isOffspring ? 2.2 : 2.0));

    const mat = new THREE.MeshStandardMaterial({
      color: isOffspring ? 0xe2dfd2 : (isPredalien ? 0x5a4632 : (isEmpress ? 0x2b0d3d : 0x11161d)),
      metalness: isOffspring ? 0.1 : 0.8,
      roughness: isOffspring ? 0.35 : 0.25
    });

    // Elongated Alien Cranium
    const headGeo = new THREE.BoxGeometry(1.2 * scale, 0.8 * scale, 3.5 * scale);
    const head = new THREE.Mesh(headGeo, mat);
    head.position.set(0, 3.5 * scale, 0.5);
    group.add(head);

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
    }

    if (isPredalien) {
      // Canon 1:1 Predalien Anatomy (AVP Requiem 2007)
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
      for (let d = -4; d <= 4; d++) {
        const dread = new THREE.Mesh(new THREE.CylinderGeometry(0.08 * scale, 0.05 * scale, 2.6 * scale, 6), dreadMat);
        const ang = (d / 4) * Math.PI * 0.45;
        dread.position.set(Math.sin(ang) * 0.85 * scale, 3.3 * scale, -1.0 * scale - Math.cos(ang) * 0.35 * scale);
        dread.rotation.x = -0.55;
        dread.rotation.z = ang * 0.35;
        group.add(dread);
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

    // Spawn a live Chestburster directly into horde
    if (horde && horde.spawnChestburster) {
      setTimeout(() => {
        horde.spawnChestburster(origin);
      }, 350);
    }
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
    if (!this.activeBoss.spitCooldown) this.activeBoss.spitCooldown = 4.0;
    if (!this.activeBoss.regurgitateCooldown) this.activeBoss.regurgitateCooldown = 5.0;

    this.activeBoss.tailWhipCooldown -= delta;
    this.activeBoss.spitCooldown -= delta;
    this.activeBoss.regurgitateCooldown -= delta;

    const dir = player.position.clone().sub(this.activeBoss.mesh.position);
    dir.y = 0;
    const dist = dir.length();

    // Predalien Signature Attack: Chestburster Regurgitation (AVP: Requiem Lore)
    if (this.activeBoss.type === 'predalien_queen' && dist > 5.0 && dist < 28.0 && this.activeBoss.regurgitateCooldown <= 0) {
      this.activeBoss.regurgitateCooldown = 6.5;
      this.regurgitateChestbursters(player, horde);
    }

    // Queen/Empress Long range: Acid Mortar Spit
    if (dist > 9.0 && dist < 35.0 && this.activeBoss.spitCooldown <= 0) {
      this.activeBoss.spitCooldown = 4.5;
      this.spitAcidMortar(player);
    }

    // Medium-close range: Tail Whip 360
    if (dist <= 8.5 && this.activeBoss.tailWhipCooldown <= 0) {
      this.activeBoss.tailWhipCooldown = 4.0;
      this.triggerTailWhip(player);
    }

    // Movement
    if (dist > 3.0) {
      dir.normalize();
      this.activeBoss.mesh.position.addScaledVector(dir, 7.5 * delta);
      this.activeBoss.mesh.rotation.y = Math.atan2(dir.x, dir.z);
    } else {
      player.takeDamage(45 * delta);
    }
  }
}
