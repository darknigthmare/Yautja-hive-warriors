/* Weyland-Yutani Combat Synthetics (Androids with Milky White Blood) */

import * as THREE from 'three';

export class SyntheticsManager {
  constructor(scene, audioEngine, particles) {
    this.scene = scene;
    this.audioEngine = audioEngine;
    this.particles = particles;
    this.androids = [];

    this.armorMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0, // White clean Weyland-Yutani synthetic casing
      metalness: 0.85,
      roughness: 0.2
    });
    this.bodyMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.5,
      roughness: 0.5
    });
    this.whiteBloodMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95
    });
  }

  spawnSquad(pos, count = 3) {
    this.clearSquad();

    for (let i = 0; i < count; i++) {
      const mesh = this.createSyntheticMesh();
      const angle = (i / count) * Math.PI * 2;
      mesh.position.set(pos.x + Math.cos(angle) * 16, 0, pos.z + Math.sin(angle) * 16);
      this.scene.add(mesh);

      this.androids.push({
        mesh,
        hp: 280,
        maxHp: 280,
        speed: 9,
        damage: 22,
        shootCooldown: 0
      });
    }
  }

  createSyntheticMesh() {
    const group = new THREE.Group();

    // Torso with Weyland logo casing
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.4, 0.5), this.armorMat);
    torso.position.y = 1.8;
    group.add(torso);

    // Synthetic android head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 10), this.armorMat);
    head.position.set(0, 2.8, 0);
    group.add(head);

    // Glowing optic eye visor
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.08, 0.1),
      new THREE.MeshBasicMaterial({ color: 0x00d2ff })
    );
    visor.position.set(0, 2.8, 0.32);
    group.add(visor);

    // Limbs
    const legGeo = new THREE.CylinderGeometry(0.12, 0.1, 1.3, 6);
    const leftLeg = new THREE.Mesh(legGeo, this.bodyMat);
    leftLeg.position.set(-0.3, 0.8, 0);
    group.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, this.bodyMat);
    rightLeg.position.set(0.3, 0.8, 0);
    group.add(rightLeg);

    // Pulse Pistol
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.2, 0.6), this.bodyMat);
    gun.position.set(0.6, 1.8, 0.4);
    group.add(gun);

    return group;
  }

  emitWhiteSyntheticBlood(pos) {
    for (let i = 0; i < 6; i++) {
      const drop = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), this.whiteBloodMat);
      drop.position.copy(pos);
      this.scene.add(drop);
      setTimeout(() => this.scene.remove(drop), 800);
    }
  }

  update(delta, player, horde) {
    for (let i = this.androids.length - 1; i >= 0; i--) {
      const syn = this.androids[i];

      // Target nearest Xenomorph first, or Yautja if close
      let targetPos = null;
      let isXeno = false;

      if (horde.aliens.length > 0) {
        let nearestDist = Infinity;
        horde.aliens.forEach(a => {
          const d = syn.mesh.position.distanceTo(a.mesh.position);
          if (d < nearestDist) {
            nearestDist = d;
            targetPos = a.mesh.position;
            isXeno = true;
          }
        });
      }

      if (!targetPos) {
        targetPos = player.position;
      }

      const dir = targetPos.clone().sub(syn.mesh.position);
      dir.y = 0;
      const dist = dir.length();

      if (dist > 10) {
        dir.normalize();
        syn.mesh.position.addScaledVector(dir, syn.speed * delta);
        syn.mesh.rotation.y = Math.atan2(dir.x, dir.z);
      } else {
        syn.mesh.rotation.y = Math.atan2(dir.x, dir.z);
        // Shoot pulse weapon
        syn.shootCooldown -= delta;
        if (syn.shootCooldown <= 0) {
          syn.shootCooldown = 1.2;
          this.audioEngine.playPulseRifleBurst();
          if (isXeno) {
            horde.checkMeleeHits({ origin: targetPos, radius: 1.5, damage: syn.damage });
          } else {
            player.takeDamage(syn.damage * 0.4);
          }
        }
      }
    }
  }

  checkHits(attack) {
    const hits = [];
    for (let i = this.androids.length - 1; i >= 0; i--) {
      const syn = this.androids[i];
      if (syn.mesh.position.distanceTo(attack.origin) <= attack.radius) {
        syn.hp -= attack.damage;
        this.emitWhiteSyntheticBlood(syn.mesh.position);
        hits.push({ pos: syn.mesh.position.clone(), damage: attack.damage, killed: syn.hp <= 0 });

        if (syn.hp <= 0) {
          this.scene.remove(syn.mesh);
          this.androids.splice(i, 1);
        }
      }
    }
    return hits;
  }

  clearSquad() {
    this.androids.forEach(s => this.scene.remove(s.mesh));
    this.androids = [];
  }
}
