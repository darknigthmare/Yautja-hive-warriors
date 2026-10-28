/* Weyland-Yutani Combat Synthetics (Androids with Milky White Blood & Bisection AI) */

import * as THREE from 'three';
import { applyBattleUnit, despawnBattleActor, selectBattleTarget, battleHostile, moveBattleOrder, requestNPCStrike, applyBattleFormationHit, maintainBattleFormation } from '../engine/BattleActorSupport.js';
import { recordCombatDeath } from '../engine/CombatEvents.js';
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
      const isWorkingJoe = i % 2 === 1;
      const mesh = this.createSyntheticMesh(isWorkingJoe);
      const angle = (i / count) * Math.PI * 2;
      mesh.position.set(pos.x + Math.cos(angle) * 24, 0, pos.z + Math.sin(angle) * 24);
      this.scene.add(mesh);

      this.androids.push({
        mesh,
        type: isWorkingJoe ? 'working_joe' : 'weyland_combat',
        hp: isWorkingJoe ? 340 : 280,
        maxHp: isWorkingJoe ? 340 : 280,
        speed: 9,
        damage: 22,
        shootCooldown: 2 + i * 0.35,
        isBisected: false,
        crawlLife: 0
      });
    }
  }


  createSyntheticMesh(isWorkingJoe = false) {
    const mesh = createSyntheticModel(); mesh.userData.syntheticProfile = isWorkingJoe ? 'working_joe' : 'weyland_combat';
    if (!isWorkingJoe) return mesh;
    // A Seegson maintenance android has hands and a service suit, not a WY rifle.
    const gun = mesh.getObjectByName('gun'), visor = mesh.getObjectByName('visor'), retained = new Set();
    mesh.traverse(node => { if (!node.isMesh) return; let parent = node; while (parent && parent !== gun) parent = parent.parent; if (!parent) for (const material of Array.isArray(node.material) ? node.material : [node.material]) retained.add(material); });
    disposeObject(gun, retained); disposeObject(visor);
    mesh.traverse(node => { if (!node.isMesh) return; const materials = Array.isArray(node.material) ? node.material : [node.material]; for (const material of materials) { if (material.name === 'armor' || material.name === 'cloth') material.color.set(0x9b5b32); if (material.name === 'skin') material.color.set(0xd4cec0); } });
    for (const side of [-1,1]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(.027,12,8), new THREE.MeshStandardMaterial({color:0xf6b24b,emissive:0x9b4c13,emissiveIntensity:.8,roughness:.4})); eye.name = 'working-joe-eye'; eye.position.set(side*.078,3.22,.16); mesh.add(eye); }
    return mesh;
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
    if (!Number.isFinite(delta) || delta <= 0) return;
    this.time = (this.time ?? 0) + delta;
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
        syn.mesh.position.y = 0.15 + Math.abs(Math.sin(this.time * 7)) * 0.06;

        if (Math.random() < 1 - Math.exp(-2.4 * delta)) {
          this.emitWhiteSyntheticBlood(syn.mesh.position);
        }

        if (syn.crawlLife <= 0 || syn.hp <= 0) {
          // Android finally deactivates
          this.audioEngine.playSyntheticShortCircuit();
          this.defeatSynthetic(syn, { cause: 'synthetic-deactivation', killerFaction: syn.lastDamageFaction });
          continue;
        }
      }

      // EMP Overcharge Stun Check
      if (syn.isEMPStunned) {
        releaseHostileAttack(this, syn);
        syn.empStunTimer -= delta;
        syn.mesh.rotation.z = Math.sin(this.time * 50) * 0.15; // Jittering malfunction glitch
        if (syn.empStunTimer <= 0) {
          syn.isEMPStunned = false;
          syn.mesh.rotation.z = 0;
        }
        continue; // Fully disabled while rebooting circuits
      }

      let targetPlayer = selectHostileTarget(this, syn.mesh.position, player), targetPos = null, isXeno = false, npcTarget = null;
      if(maintainBattleFormation(this,syn,delta,syn.speed))continue;
      if (syn.battleUnitId && this.battleSimulation) {
        const target = selectBattleTarget(this, syn, player, horde?.getActiveCombatants?.() ?? horde?.aliens ?? []);
        if (!target) { releaseHostileAttack(this, syn); moveBattleOrder(this, syn, delta, syn.speed); continue; }
        targetPlayer = target; targetPos = target.position; isXeno = target.isBattleNPC; npcTarget = target.isBattleNPC ? target : null;
      } else {
        let nearestDist = Infinity;
        for (const alien of horde?.aliens ?? []) if (alien.hp > 0) { const d = syn.mesh.position.distanceTo(alien.mesh.position); if (d < nearestDist) { nearestDist = d; targetPos = alien.mesh.position; isXeno = true; } }
        if (!targetPos) { if (!targetPlayer || targetPlayer.hp <= 0) { releaseHostileAttack(this, syn); continue; } targetPos = targetPlayer.position; }
      }

      if (isXeno && (this.combatDirector?.getAttackState(syn)?.phase === 'windup' || syn._localAttackPreparation)) releaseHostileAttack(this, syn);
      const dir = targetPos.clone().sub(syn.mesh.position);
      dir.y = 0;
      const dist = syn.mesh.position.distanceTo(targetPos);

      const covered = this.environment?.hasLineOfSight && !this.environment.hasLineOfSight(syn.mesh.position.clone().add(new THREE.Vector3(0, syn.isBisected ? .6 : 2, 0)), targetPos.clone().add(new THREE.Vector3(0,1.6,0)), { ignoreOwner: npcTarget?.isSupport ? npcTarget.collisionOwner : undefined });
      const joe = syn.type === 'working_joe';
      const stopDist = (joe ? 2.1 : syn.isBisected ? 6.0 : (isXeno ? 10.0 : 12.0)) + (npcTarget?.isSupport ? npcTarget.radius ?? 0 : 0);
      syn.shootCooldown = Math.max(0, (syn.shootCooldown ?? 2) - delta);

      const access = this.environment?.getVerticalNavigationTarget?.(syn.mesh.position, targetPos);
      if (access || dist > stopDist + 1e-5 || covered) {
        const previous = syn.mesh.position.clone();
        dir.copy(access ?? targetPos).sub(previous).setY(0);
        const step = Math.min(syn.speed * delta, dir.length(), access || covered ? Infinity : Math.max(0, dist - stopDist));
        dir.normalize();
        syn.mesh.position.addScaledVector(dir, step);
        this.environment?.resolveAgentMovement?.(syn.mesh.position, targetPos, step, .9, previous);
        releaseHostileAttack(this, syn);
        syn.mesh.rotation.y = Math.atan2(dir.x, dir.z);
      } else {
        syn.mesh.rotation.y = Math.atan2(dir.x, dir.z);
        // Shoot pulse weapon
        if (syn.shootCooldown <= 0 && (npcTarget ? requestNPCStrike(syn, npcTarget, delta, {windup: .9, recovery: 1.9}) : isXeno || requestHostileAttack(this, syn, targetPlayer, delta, { kind: joe ? 'melee' : 'ranged', windup: joe ? 1.1 : 0.9, recovery: 1.9, duration: 0.3 }))) {
          syn.shootCooldown = syn.isBisected ? 2.6 : 1.9;
          if (joe) this.audioEngine?.playSyntheticShortCircuit?.(); else this.audioEngine.playPulseRifleBurst();
          if (isXeno) {
            if (npcTarget) npcTarget.takeDamage(syn.damage, syn); else horde.checkMeleeHits({ origin: targetPos, radius: 1.5, damage: syn.damage, killerFaction: syn.factionId ?? 'weyland_yutani', type: 'synthetic-ballistic' });
          } else {
            targetPlayer.takeDamage(syn.damage * .4, false, syn, { attackKind: joe ? 'grab' : 'ballistic', blockable: false, parryable: false });
          }
        }
        syncHostileWarning(this, syn);
      }
    }
  }


  checkHits(attack) {
    const hits = [];
    if (!attack?.origin?.isVector3 || !Number.isFinite(attack.damage) || attack.damage <= 0 || !Number.isFinite(attack.radius) || attack.radius < 0) return hits;
    const faction = attack.killerFaction ?? this.battleSimulation?.config.playerFaction ?? 'player_clan';
    for (let i = this.androids.length - 1; i >= 0; i--) {
      const syn = this.androids[i];
      if (attack.targetOnly && syn !== attack.targetOnly) continue;
      if (this.battleSimulation && syn.factionId && !this.battleSimulation.areHostile(faction, syn.factionId)) continue;
      if (this.environment?.hasLineOfSight && !this.environment.hasLineOfSight(attack.origin.clone().add(new THREE.Vector3(0,1.2,0)), syn.mesh.position.clone().add(new THREE.Vector3(0,1.2,0)))) continue;
      if (syn.mesh.position.distanceTo(attack.origin) <= attack.radius) {
        syn.hp -= applyBattleFormationHit(this,syn,attack);
        this.emitWhiteSyntheticBlood(syn.mesh.position);

        if (syn.hp <= 0) {
          if (!syn.isBisected) {
            // Cut in half! Enter crawling torso state!
            this.bisectSynthetic(syn);
            hits.push({ pos: syn.mesh.position.clone(), damage: attack.damage, killed: false, bisected: true });
          } else {
            // Terminated bisected android
            this.audioEngine.playSyntheticShortCircuit();
            const event = this.defeatSynthetic(syn, { cause: attack.type ?? 'melee', killerFaction: faction });
            hits.push({ pos: syn.mesh.position.clone(), damage: attack.damage, killed: true, event });
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
  spawnBattleUnit(unit, group) {
    const existing = this.androids.find(actor => actor.battleUnitId === unit.id); if (existing) return existing;
    if (!['synthetic','working_joe','weyland_combat'].includes(unit.actorType)) throw new RangeError(`Unsupported detailed synthetic profile: ${unit.actorType}`);
    const joe = unit.actorType === 'working_joe';
    const actor = { mesh: this.createSyntheticMesh(joe), type: joe ? 'working_joe' : 'weyland_combat', speed: joe ? 7.5 : 9, damage: joe ? 34 : 22,
      radius: .9, shootCooldown: 2, isBisected: false, crawlLife: 0, voiceCooldown: 0 };
    this.androids.push(applyBattleUnit(this, actor, unit, group)); return actor;
  }

  despawnBattleUnit(unitOrId) { return despawnBattleActor(this, this.androids, unitOrId); }



  defeatSynthetic(actor, details = {}) {
    if (!actor) return null;
    const event = recordCombatDeath(this, actor, { kind: actor.type ?? 'synthetic', ...details });
    actor.hp = 0; releaseHostileAttack(this, actor); const index = this.androids.indexOf(actor); if (index >= 0) this.androids.splice(index, 1);
    if (!actor._combatDisposed) { disposeObject(actor.mesh, this.sharedResources); actor._combatDisposed = true; } if (event) this.onDefeated?.(event); return event;
  }


}
