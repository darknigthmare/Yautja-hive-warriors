/* Xenomorph Swarm Engine & Facehugger QTE Latching System */

import * as THREE from 'three';

export class XenomorphHorde {
  constructor(scene, audioEngine) {
    this.scene = scene;
    this.audioEngine = audioEngine;
    this.aliens = [];
    this.acidPools = [];
    this.deadCount = 0;
  }

  spawnWave(count, playerPos) {
    this.clearWave();

    for (let i = 0; i < count; i++) {
      const isFacehugger = Math.random() < 0.25; // 25% Facehugger spawn rate!
      const alien = this.createAlienMesh(isFacehugger);

      const angle = Math.random() * Math.PI * 2;
      const radius = 25 + Math.random() * 20;
      alien.position.set(
        playerPos.x + Math.cos(angle) * radius,
        0,
        playerPos.z + Math.sin(angle) * radius
      );

      this.scene.add(alien);
      this.aliens.push({
        mesh: alien,
        type: isFacehugger ? 'facehugger' : 'warrior',
        hp: isFacehugger ? 40 : 120,
        maxHp: isFacehugger ? 40 : 120,
        speed: isFacehugger ? 16 : 11,
        damage: isFacehugger ? 15 : 25,
        radius: isFacehugger ? 0.6 : 1.1,
        isLatched: false
      });
    }
  }

  createAlienMesh(isFacehugger) {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: isFacehugger ? 0x8a7355 : 0x11161d, roughness: 0.3, metalness: 0.7 });

    if (isFacehugger) {
      // Facehugger spider body
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), mat);
      body.position.y = 0.3;
      group.add(body);

      // Tail
      const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.02, 0.8, 6), mat);
      tail.position.set(0, 0.3, -0.4);
      tail.rotation.x = -Math.PI / 4;
      group.add(tail);
    } else {
      // Warrior Xenomorph
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 1.4, 8), mat);
      head.rotation.x = Math.PI / 2;
      head.position.set(0, 1.8, 0.4);
      group.add(head);

      const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.3, 1.6, 8), mat);
      torso.position.y = 1.2;
      group.add(torso);
    }

    return group;
  }

  checkMeleeHits(attack) {
    const hits = [];

    for (let i = this.aliens.length - 1; i >= 0; i--) {
      const a = this.aliens[i];
      const dist = a.mesh.position.distanceTo(attack.origin);

      if (dist <= attack.radius) {
        a.hp -= attack.damage;
        const killed = a.hp <= 0;

        hits.push({
          pos: a.mesh.position.clone(),
          damage: attack.damage,
          killed: killed
        });

        if (killed) {
          this.spawnAcidPool(a.mesh.position);
          this.scene.remove(a.mesh);
          this.aliens.splice(i, 1);
          this.deadCount++;
        }
      }
    }

    return hits;
  }

  spawnAcidPool(pos) {
    const geo = new THREE.CylinderGeometry(1.8, 1.8, 0.05, 12);
    const mat = new THREE.MeshBasicMaterial({ color: 0x39ff14, transparent: true, opacity: 0.7 });
    const pool = new THREE.Mesh(geo, mat);
    pool.position.set(pos.x, 0.02, pos.z);
    this.scene.add(pool);

    this.acidPools.push({ mesh: pool, life: 10 });
  }

  update(delta, player) {
    // Check acid pool damage
    this.acidPools.forEach((pool, idx) => {
      pool.life -= delta;
      if (pool.mesh.position.distanceTo(player.position) < 1.8) {
        player.takeDamage(15 * delta);
      }
      if (pool.life <= 0) {
        this.scene.remove(pool.mesh);
        this.acidPools.splice(idx, 1);
      }
    });

    // Swarm AI Movement & Latching
    this.aliens.forEach(a => {
      if (a.isLatched) return;

      const dir = player.position.clone().sub(a.mesh.position);
      dir.y = 0;
      const dist = dir.length();

      if (dist > 1.2) {
        dir.normalize();
        a.mesh.position.addScaledVector(dir, a.speed * delta);
        a.mesh.rotation.y = Math.atan2(dir.x, dir.z);
      } else {
        if (a.type === 'facehugger' && !player.isFacehuggerLatched) {
          // Latch onto player mask! Trigger QTE struggle!
          player.triggerFacehuggerLatch();
          a.isLatched = true;
          this.scene.remove(a.mesh);
        } else {
          player.takeDamage(a.damage * delta);
        }
      }
    });
  }

  clearWave() {
    this.aliens.forEach(a => this.scene.remove(a.mesh));
    this.aliens = [];
    this.acidPools.forEach(p => this.scene.remove(p.mesh));
    this.acidPools = [];
  }
}
