/* Weyland-Yutani Combat Synthetics (Androids with Milky White Blood & Bisection AI) */

import * as THREE from 'three';
import { createSyntheticModel } from '../graphics/SupportModels.js';
import { disposeObject } from '../engine/SceneResources.js';
import { selectHostileTarget, requestHostileAttack, syncHostileWarning, releaseHostileAttack } from '../engine/HostilePressure.js';

export class SyntheticsManager {
  constructor(scene, audioEngine, particles) {
    this.scene = scene;
    this.audioEngine = audioEngine;
    this.particles = particles;
    this.androids = [];
    this.severedProps = [];
    this.bloodPools = [];
    this.bloodDrops = [];

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
    this.sharedResources = new Set([this.armorMat, this.bodyMat, this.whiteBloodMat]);
  }

  spawnSquad(pos, count = 3) {
    this.clearSquad();

    for (let i = 0; i < count; i++) {
      const mesh = this.createSyntheticMesh();
      const angle = (i / count) * Math.PI * 2;
      mesh.position.set(pos.x + Math.cos(angle) * 24, 0, pos.z + Math.sin(angle) * 24);
      this.scene.add(mesh);

      this.androids.push({
        mesh,
        hp: 280,
        maxHp: 280,
        speed: 9,
        damage: 22,
        shootCooldown: 2 + i * 0.35,
        isBisected: false,
        crawlLife: 0
      });
    }
  }

  createSyntheticMesh() {
    return createSyntheticModel();
  }

  emitWhiteSyntheticBlood(pos) {
    const count = Math.min(8, Math.max(0, 80 - this.bloodDrops.length));
    for (let i = 0; i < count; i++) {
      const drop = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 6), this.whiteBloodMat);
      drop.position.copy(pos).add(new THREE.Vector3(
        (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 0.4,
        (Math.random() - 0.5) * 0.5
      ));
      this.scene.add(drop);
      this.bloodDrops.push({ mesh: drop, life: 0.9 });
    }
  }

  bisectSynthetic(syn) {
    releaseHostileAttack(this, syn);
    syn.isBisected = true;
    syn.speed = 2.8; // Slow crawl
    syn.hp = 110;
    syn.crawlLife = 8.0;

    this.audioEngine.playSyntheticShortCircuit();

    // 1. Detach legs and lay them tumbled on the arena floor
    const legs = syn.mesh.getObjectByName('legs');
    if (legs) {
      syn.mesh.remove(legs);
      const severedGroup = new THREE.Group();
      severedGroup.position.copy(syn.mesh.position);
      severedGroup.rotation.y = syn.mesh.rotation.y;
      severedGroup.rotation.z = Math.PI / 2; // Flattened on deck
      severedGroup.position.y = 0.2;
      severedGroup.add(legs);
      this.scene.add(severedGroup);
      this.severedProps.push(severedGroup);
    }

    // 2. Adjust torso down to floor crawl posture (Alien 1979 / Aliens 1986 Lore)
    const torso = syn.mesh.getObjectByName('torso');
    if (torso) {
      torso.position.y = 0.35;
      torso.rotation.x = Math.PI * 0.3;
    }
    const head = syn.mesh.getObjectByName('head');
    if (head) {
      head.position.set(0, 0.65, 0.4);
      head.rotation.x = 0.2;
    }
    const visor = syn.mesh.getObjectByName('visor');
    if (visor) {
      visor.position.set(0, 0.65, 0.72);
      visor.rotation.x = 0.2;
    }
    const gun = syn.mesh.getObjectByName('gun');
    if (gun) {
      gun.position.set(0.5, 0.3, 0.65);
    }

    // 3. Hanging hydraulic cables and severed power cords
    const wireGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.5, 4);
    const wireMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6 });
    for (let w = 0; w < 3; w++) {
      const wire = new THREE.Mesh(wireGeo, wireMat);
      wire.position.set((w - 1) * 0.15, 0.05, -0.2);
      wire.rotation.x = Math.PI / 3;
      syn.mesh.add(wire);
    }

    // 4. White milky fluid pool decal
    const poolGeo = new THREE.CircleGeometry(1.6, 16);
    poolGeo.rotateX(-Math.PI / 2);
    const poolMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
      depthWrite: false
    });
    const poolMesh = new THREE.Mesh(poolGeo, poolMat);
    poolMesh.position.set(syn.mesh.position.x, 0.02, syn.mesh.position.z);
    this.scene.add(poolMesh);
    this.bloodPools.push(poolMesh);

    this.emitWhiteSyntheticBlood(syn.mesh.position);
  }

  update(delta, player, horde) {
    for (let i = this.bloodDrops.length - 1; i >= 0; i--) {
      const drop = this.bloodDrops[i];
      drop.life -= delta;
      drop.mesh.position.y -= delta * 1.5;
      if (drop.life <= 0) {
        disposeObject(drop.mesh, this.sharedResources);
        this.bloodDrops.splice(i, 1);
      }
    }
    for (let i = this.androids.length - 1; i >= 0; i--) {
      const syn = this.androids[i];
      if (syn.hp <= 0 && !syn.isBisected) this.bisectSynthetic(syn);

      // Bisected Crawling State update
      if (syn.isBisected) {
        syn.crawlLife -= delta;
        // Crawling heave animation
        syn.mesh.position.y = 0.15 + Math.abs(Math.sin(Date.now() * 0.007)) * 0.06;

        if (Math.random() < 0.04) {
          this.emitWhiteSyntheticBlood(syn.mesh.position);
        }

        if (syn.crawlLife <= 0 || syn.hp <= 0) {
          // Android finally deactivates
          this.audioEngine.playSyntheticShortCircuit();
          releaseHostileAttack(this, syn);
          disposeObject(syn.mesh, this.sharedResources);
          this.androids.splice(i, 1);
          continue;
        }
      }

      // EMP Overcharge Stun Check
      if (syn.isEMPStunned) {
        releaseHostileAttack(this, syn);
        syn.empStunTimer -= delta;
        syn.mesh.rotation.z = Math.sin(Date.now() * 0.05) * 0.15; // Jittering malfunction glitch
        if (syn.empStunTimer <= 0) {
          syn.isEMPStunned = false;
          syn.mesh.rotation.z = 0;
        }
        continue; // Fully disabled while rebooting circuits
      }

      // Target nearest Xenomorph first, or Yautja if close
      const targetPlayer = selectHostileTarget(this, syn.mesh.position, player);
      let targetPos = null;
      let isXeno = false;

      if (horde.aliens.length > 0) {
        let nearestDist = Infinity;
        horde.aliens.forEach(a => {
          if (a.hp <= 0) return;
          const d = syn.mesh.position.distanceTo(a.mesh.position);
          if (d < nearestDist) {
            nearestDist = d;
            targetPos = a.mesh.position;
            isXeno = true;
          }
        });
      }

      if (!targetPos) {
        if (!targetPlayer || targetPlayer.hp <= 0) { releaseHostileAttack(this, syn); continue; }
        targetPos = targetPlayer.position;
      }

      if (isXeno && (this.combatDirector?.getAttackState(syn)?.phase === 'windup' || syn._localAttackPreparation)) releaseHostileAttack(this, syn);
      const dir = targetPos.clone().sub(syn.mesh.position);
      dir.y = 0;
      const dist = dir.length();

      const stopDist = syn.isBisected ? 6.0 : (isXeno ? 10.0 : 12.0);
      syn.shootCooldown = Math.max(0, (syn.shootCooldown ?? 2) - delta);

      if (dist > stopDist + 1e-5) {
        dir.normalize();
        syn.mesh.position.addScaledVector(dir, Math.min(syn.speed * delta, dist - stopDist));
        releaseHostileAttack(this, syn);
        syn.mesh.rotation.y = Math.atan2(dir.x, dir.z);
      } else {
        syn.mesh.rotation.y = Math.atan2(dir.x, dir.z);
        // Shoot pulse weapon
        if (syn.shootCooldown <= 0 && (isXeno || requestHostileAttack(this, syn, targetPlayer, delta, { kind: 'ranged', windup: 0.9, recovery: 1.9, duration: 0.3 }))) {
          syn.shootCooldown = syn.isBisected ? 2.6 : 1.9;
          this.audioEngine.playPulseRifleBurst();
          if (isXeno) {
            horde.checkMeleeHits({ origin: targetPos, radius: 1.5, damage: syn.damage });
          } else {
            targetPlayer.takeDamage(syn.damage * 0.4);
          }
        }
        syncHostileWarning(this, syn);
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

        if (syn.hp <= 0) {
          if (!syn.isBisected) {
            // Cut in half! Enter crawling torso state!
            this.bisectSynthetic(syn);
            hits.push({ pos: syn.mesh.position.clone(), damage: attack.damage, killed: false, bisected: true });
          } else {
            // Terminated bisected android
            this.audioEngine.playSyntheticShortCircuit();
            releaseHostileAttack(this, syn);
            disposeObject(syn.mesh, this.sharedResources);
            this.androids.splice(i, 1);
            hits.push({ pos: syn.mesh.position.clone(), damage: attack.damage, killed: true });
          }
        } else {
          hits.push({ pos: syn.mesh.position.clone(), damage: attack.damage, killed: false });
        }
      }
    }
    return hits;
  }

  clearSquad() {
    this.bloodDrops.forEach(drop => disposeObject(drop.mesh, this.sharedResources));
    this.bloodDrops = [];
    this.androids.forEach(s => { releaseHostileAttack(this, s); disposeObject(s.mesh, this.sharedResources); });
    this.androids = [];
    this.severedProps.forEach(p => disposeObject(p, this.sharedResources));
    this.severedProps = [];
    this.bloodPools.forEach(b => disposeObject(b, this.sharedResources));
    this.bloodPools = [];
  }
}
