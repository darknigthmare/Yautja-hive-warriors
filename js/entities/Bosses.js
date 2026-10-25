/* Mythic Boss Raid Manager (Predalien Queen & Flying Empress Matriarch) */

import * as THREE from 'three';
import { disposeObject } from '../engine/SceneResources.js';
import { selectHostileTarget, requestHostileAttack, syncHostileWarning, releaseHostileAttack } from '../engine/HostilePressure.js';
import { createCreatureModel, animateCreatureModel } from '../graphics/CreatureModels.js';

export class BossManager {
  constructor(scene, audioEngine) {
    this.scene = scene;
    this.audioEngine = audioEngine;
    this.activeBoss = null;
    this.sharedResources = new Set();
    this.acidSpitProjectiles = [];
    this.embryoProjectiles = [];
    this.pendingHatches = [];
  }

  spawnBoss(type, spawnPos) {
    this.clear();

    const mesh = this.createBossMesh(type);
    mesh.position.copy(spawnPos);
    mesh.traverse(child => { if (child.isMesh) child.castShadow = true; });
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
      phase: 1,
      contactCooldown: 1.4,
      tailWhipCooldown: 3.5,
      spitCooldown: 4,
      regurgitateCooldown: 5,
      shriekCooldown: 4
    };

    if (isOffspring) {
      this.audioEngine.playOffspringShriek();
    } else {
      this.audioEngine.playYautjaRoar();
    }
  }

  createBossMesh(type) {
    const kind = type === 'the_offspring' ? 'offspring' : type === 'empress_matriarch' ? 'empress'
      : type === 'predalien_queen' ? 'predalien' : type === 'imperial_queen' ? 'imperial'
      : type === 'praetorian' ? 'praetorian' : type === 'predalien' ? 'predalien' : 'queen';
    return createCreatureModel(kind, this.sharedResources);
  }

  regurgitateChestbursters(player, horde) {
    if (!this.activeBoss) return;
    this.audioEngine.playPredalienRegurgitate();

    const origin = this.activeBoss.mesh.position.clone().add(new THREE.Vector3(0, 3.2, 0));
    const target = player.position.clone();
    const dir = target.clone().sub(origin).normalize();

    // A volley may hit each player once; overlapping pods never stack three
    // unavoidable damage events in the same frame.
    const volley = { hitPlayers: new Set() };
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
        life: 2.5,
        volley
      });
    }

    // Spawn a live Chestburster directly into horde
    if (horde && horde.spawnChestburster) {
      this.pendingHatches.push({ life: 0.35, pos: origin, horde });
    }
  }

  takeDamage(amount) {
    if (!this.activeBoss || !Number.isFinite(amount) || amount <= 0) return;
    this.activeBoss.hp = Math.max(0, this.activeBoss.hp - amount);
    if (this.activeBoss.hp === 0) { this.clear(); return; }

    if (this.activeBoss.hp <= this.activeBoss.maxHp * 0.3 && !this.activeBoss.isStunned) {
      this.activeBoss.isStunned = true;
      this.activeBoss.stunTimer = 6.0;
    }
  }

  triggerTailWhip(player) {
    if (!this.activeBoss) return;
    this.audioEngine.playQueenTailWhip();

    // Advance the spin in update(), so ending a mission cannot dereference a removed boss.
    this.activeBoss.tailSpinLife = 0.32;

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

  clear() {
    releaseHostileAttack(this, this.activeBoss);
    disposeObject(this.activeBoss?.mesh, this.sharedResources);
    this.activeBoss = null;
    this.acidSpitProjectiles.forEach(p => disposeObject(p.mesh));
    this.embryoProjectiles.forEach(p => disposeObject(p.mesh));
    this.acidSpitProjectiles = [];
    this.embryoProjectiles = [];
    this.pendingHatches = [];
  }

  update(delta, player, horde = null) {
    if (!this.activeBoss) return;
    const boss = this.activeBoss;
    player = selectHostileTarget(this, boss.mesh.position, player);
    if (!player || player.hp <= 0) { releaseHostileAttack(this, boss); return; }
    const players = this.combatDirector?.livingPlayers?.length ? this.combatDirector.livingPlayers : [player];
    const collisionTarget = (position, radius) => players.filter(target => target.hp > 0 && position.distanceTo(target.position) < radius)
      .sort((a, b) => position.distanceToSquared(a.position) - position.distanceToSquared(b.position))[0];
    boss.visualPhase = (boss.visualPhase || 0) + delta * 5;
    animateCreatureModel(boss.mesh, boss.visualPhase, !boss.isStunned && this.combatDirector?.getAttackState(boss)?.phase !== 'windup' && !boss._localAttackPreparation && boss.mesh.position.distanceTo(player.position) > 3);
    for (let i = this.pendingHatches.length - 1; i >= 0; i--) {
      const hatch = this.pendingHatches[i]; hatch.life -= delta;
      if (hatch.life <= 0) { hatch.horde.spawnChestburster(hatch.pos); this.pendingHatches.splice(i, 1); }
    }
    for (let i = this.acidSpitProjectiles.length - 1; i >= 0; i--) {
      const projectile = this.acidSpitProjectiles[i]; projectile.life -= delta;
      projectile.velocity.y += projectile.gravity * delta; projectile.mesh.position.addScaledVector(projectile.velocity, delta);
      const target = collisionTarget(projectile.mesh.position, 2.2);
      if (target) target.takeDamage(projectile.damage);
      if (target || projectile.mesh.position.y <= 0.1 || projectile.life <= 0) {
        disposeObject(projectile.mesh); this.acidSpitProjectiles.splice(i, 1);
      }
    }
    for (let i = this.embryoProjectiles.length - 1; i >= 0; i--) {
      const projectile = this.embryoProjectiles[i]; projectile.life -= delta;
      projectile.velocity.y += projectile.gravity * delta; projectile.mesh.position.addScaledVector(projectile.velocity, delta);
      const target = collisionTarget(projectile.mesh.position, 2);
      if (target) {
        if (!projectile.volley?.hitPlayers.has(target)) {
          target.takeDamage(projectile.damage); projectile.volley?.hitPlayers.add(target);
        }
        horde?.spawnChestburster?.(projectile.mesh.position);
      }
      if (target || projectile.mesh.position.y <= 0.2 || projectile.life <= 0) {
        if (!target && Math.random() < 0.5) horde?.spawnChestburster?.(projectile.mesh.position);
        disposeObject(projectile.mesh); this.embryoProjectiles.splice(i, 1);
      }
    }
    if (boss.isStunned) {
      releaseHostileAttack(this, boss); boss.pressureAction = null;
      boss.stunTimer -= delta;
      if (boss.stunTimer <= 0) boss.isStunned = false;
      return;
    }
    for (const [key, initial] of [['tailWhipCooldown', 3.5], ['spitCooldown', 4], ['regurgitateCooldown', 5], ['shriekCooldown', 4], ['contactCooldown', 1.4]]) {
      boss[key] = Math.max(0, (boss[key] ?? initial) - delta);
    }
    const dir = player.position.clone().sub(boss.mesh.position); dir.y = 0;
    const distance = dir.length();
    if (!boss.pressureAction) {
      if (distance <= 8.5 && boss.tailWhipCooldown <= 0) boss.pressureAction = 'tail';
      else if (boss.type === 'the_offspring' && distance <= 16 && boss.shriekCooldown <= 0) boss.pressureAction = 'shriek';
      else if (boss.type === 'predalien_queen' && distance > 5 && distance < 28 && boss.regurgitateCooldown <= 0) boss.pressureAction = 'embryos';
      else if (boss.type !== 'the_offspring' && distance > 9 && distance < 35 && boss.spitCooldown <= 0) boss.pressureAction = 'spit';
      else if (distance <= 3.5 && boss.contactCooldown <= 0) boss.pressureAction = 'strike';
    }
    const action = boss.pressureAction;
    const maxRange = { tail: 8.5, shriek: 16, embryos: 28, spit: 35, strike: 4 }[action];
    if (action && distance > maxRange + 1) {
      releaseHostileAttack(this, boss); boss.pressureAction = null;
    } else if (action) {
      const projectileAttack = action === 'spit' || action === 'embryos';
      if (requestHostileAttack(this, boss, player, delta, {
        kind: 'boss', windup: action === 'strike' ? 0.95 : 1.2, recovery: 1.8, duration: projectileAttack ? 2.5 : 0.45
      })) {
        if (action === 'tail') { boss.tailWhipCooldown = 4.8; this.triggerTailWhip(player); }
        else if (action === 'spit') { boss.spitCooldown = 5; this.spitAcidMortar(player); }
        else if (action === 'embryos') { boss.regurgitateCooldown = 7; this.regurgitateChestbursters(player, horde); }
        else if (action === 'shriek') {
          boss.shriekCooldown = 6; this.audioEngine.playOffspringShriek();
          if (distance <= 10) { player.takeDamage(60); player.plasmaEnergy = Math.max(0, player.plasmaEnergy - 25); }
        } else {
          boss.contactCooldown = 2.1;
          if (distance <= 4) player.takeDamage(boss.type === 'the_offspring' ? 50 : 35);
        }
        boss.pressureAction = null;
      }
    }
    syncHostileWarning(this, boss, 4.2);
    if (boss.tailSpinLife > 0) {
      boss.tailSpinLife = Math.max(0, boss.tailSpinLife - delta); boss.mesh.rotation.y += Math.PI * 2 * delta / 0.32;
    }
    // Preparing a committed strike stops the rush and gives the player a real
    // window to step out of range. Mere body contact never drains health.
    const preparing = this.combatDirector?.getAttackState(boss)?.phase === 'windup' || boss._localAttackPreparation;
    if (distance > 3.1 && !preparing) {
      const speed = boss.type === 'the_offspring' ? 10.5 : boss.type === 'empress_matriarch' ? 8.5 : 7.5;
      boss.mesh.position.addScaledVector(dir.normalize(), Math.min(speed * delta, distance - 3.1));
      if (!(boss.tailSpinLife > 0)) boss.mesh.rotation.y = Math.atan2(dir.x, dir.z);
    }
  }
}
