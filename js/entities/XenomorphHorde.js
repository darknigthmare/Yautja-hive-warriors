/* Xenomorph Swarm Engine, Ovimorph Eggs, Facehugger Latching & Dismemberment 2.0 */

import * as THREE from 'three';

export class XenomorphHorde {
  constructor(scene, audioEngine, goreEngine = null) {
    this.scene = scene;
    this.audioEngine = audioEngine;
    this.goreEngine = goreEngine;
    this.aliens = [];
    this.eggs = [];
    this.chestbursters = [];
    this.acidPools = [];
    this.deadCount = 0;

    this.eggMat = new THREE.MeshStandardMaterial({
      color: 0x3d3522,
      roughness: 0.7,
      metalness: 0.1
    });
    this.eggPetalMat = new THREE.MeshStandardMaterial({
      color: 0x5a2d1d,
      roughness: 0.5,
      metalness: 0.2
    });
  }

  setGoreEngine(goreEngine) {
    this.goreEngine = goreEngine;
  }

  spawnWave(count, playerPos) {
    this.clearWave();

    // Spawn 4-6 Interactive Ovimorph Eggs across arena!
    this.spawnOvimorphEggs(playerPos, 5);

    for (let i = 0; i < count; i++) {
      const isFacehugger = Math.random() < 0.2;
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
        speed: isFacehugger ? 17 : 11,
        damage: isFacehugger ? 15 : 25,
        radius: isFacehugger ? 0.6 : 1.1,
        isLatched: false
      });
    }
  }

  spawnOvimorphEggs(playerPos, count = 5) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const radius = 15 + Math.random() * 18;
      const x = playerPos.x + Math.cos(angle) * radius;
      const z = playerPos.z + Math.sin(angle) * radius;

      const eggGroup = new THREE.Group();
      eggGroup.position.set(x, 0, z);

      // Egg base bulb
      const base = new THREE.Mesh(new THREE.SphereGeometry(0.8, 10, 10), this.eggMat);
      base.scale.set(0.9, 1.3, 0.9);
      base.position.y = 0.9;
      eggGroup.add(base);

      // 4 Petals
      const petals = [];
      for (let p = 0; p < 4; p++) {
        const petal = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.7, 5), this.eggPetalMat);
        const petalAngle = (p / 4) * Math.PI * 2;
        petal.position.set(Math.cos(petalAngle) * 0.35, 1.8, Math.sin(petalAngle) * 0.35);
        petal.rotation.z = Math.cos(petalAngle) * 0.2;
        petal.rotation.x = Math.sin(petalAngle) * 0.2;
        eggGroup.add(petal);
        petals.push(petal);
      }

      this.scene.add(eggGroup);
      this.eggs.push({
        mesh: eggGroup,
        petals,
        isOpen: false,
        hatched: false
      });
    }
  }

  createAlienMesh(isFacehugger) {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: isFacehugger ? 0x8a7355 : 0x11161d,
      roughness: 0.3,
      metalness: 0.7
    });

    if (isFacehugger) {
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), mat);
      body.position.y = 0.3;
      group.add(body);

      const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.02, 0.8, 6), mat);
      tail.position.set(0, 0.3, -0.4);
      tail.rotation.x = -Math.PI / 4;
      group.add(tail);
    } else {
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

  createChestbursterMesh() {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xd4a373, roughness: 0.4, metalness: 0.1 }); // Pale flesh

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.05, 1.0, 6), mat);
    body.rotation.x = Math.PI / 2;
    body.position.y = 0.25;
    group.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), mat);
    head.position.set(0, 0.25, 0.55);
    group.add(head);

    return group;
  }

  checkMeleeHits(attack) {
    const hits = [];

    // Check hit on aliens
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
          if (this.goreEngine) {
            this.goreEngine.spawnDismemberment(a.mesh.position, attack.type || 'wristblades');
          }

          // Rare chance of Chestburster eruption on dead alien host
          if (Math.random() < 0.15) {
            this.spawnChestburster(a.mesh.position);
          }

          this.spawnAcidPool(a.mesh.position);
          this.scene.remove(a.mesh);
          this.aliens.splice(i, 1);
          this.deadCount++;
        }
      }
    }

    // Check hit on Ovimorph Eggs
    for (let i = this.eggs.length - 1; i >= 0; i--) {
      const egg = this.eggs[i];
      if (egg.mesh.position.distanceTo(attack.origin) <= attack.radius + 1.0) {
        this.spawnAcidPool(egg.mesh.position);
        this.scene.remove(egg.mesh);
        this.eggs.splice(i, 1);
        hits.push({
          pos: egg.mesh.position.clone(),
          damage: attack.damage,
          killed: true
        });
      }
    }

    return hits;
  }

  spawnChestburster(pos) {
    const mesh = this.createChestbursterMesh();
    mesh.position.copy(pos);
    this.scene.add(mesh);
    this.chestbursters.push({
      mesh,
      hp: 30,
      speed: 18,
      damage: 12
    });
    this.audioEngine.playXenoHiss();
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
    // 1. Ovimorph Egg proximity sensing & hatching
    this.eggs.forEach(egg => {
      if (!egg.hatched && egg.mesh.position.distanceTo(player.position) < 7.0) {
        if (!egg.isOpen) {
          egg.isOpen = true;
          // Animate petals opening
          egg.petals.forEach(p => {
            p.rotation.x *= 2.2;
            p.rotation.z *= 2.2;
          });
          this.audioEngine.playXenoHiss();

          // Hatch Facehugger in 0.8s
          setTimeout(() => {
            if (this.scene) {
              const facehugger = this.createAlienMesh(true);
              facehugger.position.copy(egg.mesh.position);
              facehugger.position.y = 0.5;
              this.scene.add(facehugger);
              this.aliens.push({
                mesh: facehugger,
                type: 'facehugger',
                hp: 40,
                maxHp: 40,
                speed: 17,
                damage: 15,
                radius: 0.6,
                isLatched: false
              });
              egg.hatched = true;
            }
          }, 800);
        }
      }
    });

    // 2. Chestbursters chase player rapidly
    for (let i = this.chestbursters.length - 1; i >= 0; i--) {
      const cb = this.chestbursters[i];
      const dir = player.position.clone().sub(cb.mesh.position);
      dir.y = 0;
      if (dir.length() > 1.0) {
        dir.normalize();
        cb.mesh.position.addScaledVector(dir, cb.speed * delta);
        cb.mesh.rotation.y = Math.atan2(dir.x, dir.z);
      } else {
        player.takeDamage(cb.damage * delta);
      }
    }

    // 3. Acid pools damage logic
    for (let i = this.acidPools.length - 1; i >= 0; i--) {
      const pool = this.acidPools[i];
      pool.life -= delta;
      if (pool.mesh.position.distanceTo(player.position) < 1.8) {
        player.takeDamage(15 * delta);
      }
      if (pool.life <= 0) {
        this.scene.remove(pool.mesh);
        this.acidPools.splice(i, 1);
      }
    }

    // 4. Xenomorph Horde Swarm AI & Facehugger Latching
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
    this.eggs.forEach(e => this.scene.remove(e.mesh));
    this.eggs = [];
    this.chestbursters.forEach(c => this.scene.remove(c.mesh));
    this.chestbursters = [];
    this.acidPools.forEach(p => this.scene.remove(p.mesh));
    this.acidPools = [];
  }
}
