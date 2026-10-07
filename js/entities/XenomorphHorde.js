/* Xenomorph Swarm Engine 3.0 - Crusher, Praetorian, Ovimorph Eggs & Gore */

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
    this.acidSplashes = [];
    this.deadCount = 0;

    this.acidSplashMat = new THREE.MeshBasicMaterial({ color: 0x39ff14 });
    this.eggMat = new THREE.MeshStandardMaterial({ color: 0x3d3522, roughness: 0.7, metalness: 0.1 });
    this.eggPetalMat = new THREE.MeshStandardMaterial({ color: 0x5a2d1d, roughness: 0.5, metalness: 0.2 });
    this.crusherMat = new THREE.MeshStandardMaterial({ color: 0x151b24, roughness: 0.2, metalness: 0.9 });
    this.praetorianMat = new THREE.MeshStandardMaterial({ color: 0x0f141c, roughness: 0.3, metalness: 0.85 });
  }

  setGoreEngine(goreEngine) {
    this.goreEngine = goreEngine;
  }

  spawnWave(count, playerPos) {
    this.clearWave();

    this.spawnOvimorphEggs(playerPos, 5);

    // Spawn 1 Crusher Titan
    this.spawnCrusher(playerPos);

    // Spawn 2 Praetorian Royal Guards
    this.spawnPraetorian(playerPos, -15);
    this.spawnPraetorian(playerPos, 15);

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

  spawnCrusher(playerPos) {
    const group = new THREE.Group();
    // Massive Quadruped Battering Ram Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.2, 4.0), this.crusherMat);
    body.position.y = 2.0;
    group.add(body);

    // Bulletproof Massive Armored Head Crest
    const crest = new THREE.Mesh(new THREE.ConeGeometry(2.2, 3.5, 6), this.crusherMat);
    crest.rotation.x = Math.PI / 2.3;
    crest.position.set(0, 2.8, 2.5);
    group.add(crest);

    group.position.set(playerPos.x, 0, playerPos.z - 35);
    this.scene.add(group);

    this.aliens.push({
      mesh: group,
      type: 'crusher',
      hp: 750,
      maxHp: 750,
      speed: 16,
      damage: 60,
      radius: 2.8,
      isCharging: false,
      chargeTimer: 3.0
    });
  }

  spawnPraetorian(playerPos, offsetX = 0) {
    const group = new THREE.Group();
    // 4-meter tall Royal Guard
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.5, 2.8, 8), this.praetorianMat);
    torso.position.y = 2.4;
    group.add(torso);

    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 2.2, 8), this.praetorianMat);
    head.rotation.x = Math.PI / 2;
    head.position.set(0, 3.8, 0.6);
    group.add(head);

    // Crown crest
    const crown = new THREE.Mesh(new THREE.ConeGeometry(1.2, 1.8, 5), this.praetorianMat);
    crown.rotation.x = Math.PI / 2.5;
    crown.position.set(0, 4.2, -0.4);
    group.add(crown);

    group.position.set(playerPos.x + offsetX, 0, playerPos.z - 28);
    this.scene.add(group);

    this.aliens.push({
      mesh: group,
      type: 'praetorian',
      hp: 480,
      maxHp: 480,
      speed: 13,
      damage: 40,
      radius: 1.8,
      spitCooldown: 2.0
    });
  }

  spawnOvimorphEggs(playerPos, count = 5) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const radius = 15 + Math.random() * 18;
      const x = playerPos.x + Math.cos(angle) * radius;
      const z = playerPos.z + Math.sin(angle) * radius;

      const eggGroup = new THREE.Group();
      eggGroup.position.set(x, 0, z);

      const base = new THREE.Mesh(new THREE.SphereGeometry(0.8, 10, 10), this.eggMat);
      base.scale.set(0.9, 1.3, 0.9);
      base.position.y = 0.9;
      eggGroup.add(base);

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
    const mat = new THREE.MeshStandardMaterial({ color: 0xd4a373, roughness: 0.4, metalness: 0.1 });

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

    for (let i = this.aliens.length - 1; i >= 0; i--) {
      const a = this.aliens[i];
      const dist = a.mesh.position.distanceTo(attack.origin);

      if (dist <= attack.radius + (a.radius || 1.0)) {
        a.hp -= attack.damage;
        const killed = a.hp <= 0;

        // Reactive Acid Splashback Physics (slashing xenos sprays pressurized molecular acid back at attacker)
        if (attack.origin) {
          this.spawnAcidSplash(a.mesh.position, attack.origin);
        }

        hits.push({
          pos: a.mesh.position.clone(),
          damage: attack.damage,
          killed: killed
        });

        if (killed) {
          if (this.goreEngine) {
            this.goreEngine.spawnDismemberment(a.mesh.position, attack.type || 'wristblades');
          }

          if (Math.random() < 0.15 && a.type !== 'crusher') {
            this.spawnChestburster(a.mesh.position);
          }

          this.spawnAcidPool(a.mesh.position);
          this.scene.remove(a.mesh);
          this.aliens.splice(i, 1);
          this.deadCount++;
        }
      }
    }

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

  spawnAcidSplash(originPos, targetPos) {
    const splashDir = targetPos.clone().sub(originPos).normalize();
    // Add realistic arc and spread
    for (let s = 0; s < 3; s++) {
      const spread = splashDir.clone().add(new THREE.Vector3(
        (Math.random() - 0.5) * 0.4,
        0.3 + Math.random() * 0.3,
        (Math.random() - 0.5) * 0.4
      )).normalize();

      const dropGeo = new THREE.SphereGeometry(0.12, 6, 6);
      const dropMesh = new THREE.Mesh(dropGeo, this.acidSplashMat);
      dropMesh.position.copy(originPos).add(new THREE.Vector3(0, 1.2, 0));
      this.scene.add(dropMesh);

      this.acidSplashes.push({
        mesh: dropMesh,
        vel: spread.multiplyScalar(16 + Math.random() * 6),
        gravity: -28,
        life: 0.9,
        damage: 18
      });
    }
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
    // 1. Ovimorph Egg proximity
    this.eggs.forEach(egg => {
      if (!egg.hatched && egg.mesh.position.distanceTo(player.position) < 7.0) {
        if (!egg.isOpen) {
          egg.isOpen = true;
          egg.petals.forEach(p => {
            p.rotation.x *= 2.2;
            p.rotation.z *= 2.2;
          });
          this.audioEngine.playXenoHiss();

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

    // 2. Chestbursters
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

    // 3. Acid pools
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

    // 3b. Reactive Acid Splashback Droplets Flying
    for (let i = this.acidSplashes.length - 1; i >= 0; i--) {
      const splash = this.acidSplashes[i];
      splash.life -= delta;
      splash.vel.y += splash.gravity * delta;
      splash.mesh.position.addScaledVector(splash.vel, delta);

      // Check collision with player
      if (splash.mesh.position.distanceTo(player.position) < 1.6) {
        player.takeDamage(splash.damage);
        this.scene.remove(splash.mesh);
        this.acidSplashes.splice(i, 1);
        continue;
      }

      // Check floor collision or life expiry
      if (splash.mesh.position.y <= 0.05 || splash.life <= 0) {
        this.scene.remove(splash.mesh);
        this.acidSplashes.splice(i, 1);
      }
    }

    // 4. Horde AI (Crusher, Praetorian, Warriors, Facehuggers)
    this.aliens.forEach(a => {
      if (a.isLatched) return;

      const dir = player.position.clone().sub(a.mesh.position);
      dir.y = 0;
      const dist = dir.length();

      if (a.type === 'crusher') {
        // Crusher Battering Ram Charge
        a.chargeTimer -= delta;
        if (a.chargeTimer <= 0) {
          a.isCharging = true;
          a.speed = 22; // Charge speed!
          this.audioEngine.playXenoHiss();
          setTimeout(() => {
            a.isCharging = false;
            a.speed = 12;
            a.chargeTimer = 4.0;
          }, 2000);
        }
      }

      if (dist > (a.radius || 1.2)) {
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
    this.acidSplashes.forEach(s => this.scene.remove(s.mesh));
    this.acidSplashes = [];
  }
}
