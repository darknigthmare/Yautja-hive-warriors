/* Colonial Marines USCM support against the hive. */

import * as THREE from 'three';
import { applyBattleUnit, despawnBattleActor, selectBattleTarget, battleHostile, moveBattleOrder, requestNPCStrike, maintainBattleFormation } from '../engine/BattleActorSupport.js';
import { recordCombatDeath } from '../engine/CombatEvents.js';
import { createMarineModel, addSentryMechanicalDetails } from '../graphics/SupportModels.js';
import { sourceUnitVisualKind } from '../data/SourceActorPresentation.js';
import { disposeObject } from '../engine/SceneResources.js';
import { selectHostileTarget, requestHostileAttack, syncHostileWarning, releaseHostileAttack } from '../engine/HostilePressure.js';

export class ColonialMarinesManager {
  constructor(scene, audioEngine) {
    this.scene = scene;
    this.audioEngine = audioEngine;
    this.marines = [];
    this.sentryGun = null;
    this.distressBeacon = null; this.beaconTriggered = false; this.airSupportPending = false; this.airSupportTimer = 0; this.strafeCenter = null;
    this.hostileToPlayers = false; // USCM support fights the hive, then holds cover.
  }


  spawnSquad(playerPos, count = 4) {
    this.clearSquad();
    this.spawnSentryGun(playerPos.clone().add(new THREE.Vector3(8, 0, 8)));

    for (let i = 0; i < count; i++) {
      const isSmartgunner = i % 2 === 0;
      const marineMesh = this.createMarineMesh(isSmartgunner);

      const angle = (i / count) * Math.PI * 2;
      marineMesh.position.set(
        playerPos.x + Math.cos(angle) * 24,
        0,
        playerPos.z + Math.sin(angle) * 24
      );

      this.scene.add(marineMesh);
      this.marines.push({
        mesh: marineMesh,
        type: isSmartgunner ? 'smartgunner' : 'flametrooper',
        hp: 150,
        maxHp: 150,
        damage: isSmartgunner ? 20 : 35,
        speed: 8,
        shootCooldown: 1.4 + i * 0.3,
        grenadeCooldown: 7 + i * 0.6
      });
    }
  }


  createMarineMesh(isSmartgunner) {
    return createMarineModel(isSmartgunner);
  }


  update(delta, player, horde) {
    if (!Number.isFinite(delta) || delta <= 0) return;
    this.time = (this.time ?? 0) + delta;
    if (this.distressBeacon) { this.distressBeacon.life -= delta; if (this.distressBeacon.life <= 0) { disposeObject(this.distressBeacon.mesh); this.distressBeacon = null; } }
    if (this.airSupportPending) { this.airSupportTimer -= delta; if (this.airSupportTimer <= 0) { this.airSupportPending = false; if (horde) horde.checkMeleeHits({ origin: this.strafeCenter, radius: 7, damage: 180, type: 'gunship', killerFaction: this.factionId ?? 'uscm' }); } }
    for (const m of [...this.marines]) {
      if (m.hp <= 0) { this.defeatCombatant(m, { cause: 'combat', killerFaction: m.lastDamageFaction }); continue; }
      if(maintainBattleFormation(this,m,delta,m.speed))continue;
      if (m.isFacehuggerLatched) { m.facehuggerHold -= delta; if (m.facehuggerHold > 0) continue; m.isFacehuggerLatched = false; }
      if (m.sourceVisualKind === 'medic' && m.battleUnitId && this.battleSimulation) {
        m.medicCooldown = Math.max(0, (m.medicCooldown ?? 0) - delta);
        if (m.medicCooldown <= 0) {
          // Only actual allocated human allies can receive a field treatment.
          // The simulation owns the two finite charges and persists their use.
          const patients = this.marines.filter(other => other !== m && other.battleUnitId &&
            other.factionId === m.factionId && other.hp > 0 && other.hp < other.maxHp &&
            !other.isDowned && !other.isRescueRecovering &&
            m.mesh.position.distanceToSquared(other.mesh.position) <= 100 &&
            (!this.environment?.hasLineOfSight || this.environment.hasLineOfSight(
              m.mesh.position.clone().add(new THREE.Vector3(0, 1.8, 0)),
              other.mesh.position.clone().add(new THREE.Vector3(0, 1.6, 0)))));
          patients.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp ||
            a.mesh.position.distanceToSquared(m.mesh.position) - b.mesh.position.distanceToSquared(m.mesh.position));
          for (const patient of patients) {
            // The render-side HP and positions are authoritative for the
            // ongoing frame. Sync them before spending a finite treatment.
            if (!this.battleSimulation.syncUnit(m.battleUnitId, {
              hp: m.hp, position: [m.mesh.position.x, m.mesh.position.z] })) continue;
            if (!this.battleSimulation.syncUnit(patient.battleUnitId, {
              hp: patient.hp, position: [patient.mesh.position.x, patient.mesh.position.z] })) continue;
            const healed = this.battleSimulation.applyMedicHeal(m.battleUnitId, patient.battleUnitId);
            if (!healed) continue;
            patient.hp = healed.hp;
            m.medicCooldown = 6;
            this.audioEngine?.playMedicTreatment?.();
            break;
          }
          if (m.medicCooldown > 0) continue;
        }
      }
      let targetPlayer = null, targetPos = null, target = null, targetsPlayer = false;
      if (m.battleUnitId && this.battleSimulation) {
        target = selectBattleTarget(this, m, player, horde?.getActiveCombatants?.() ?? horde?.aliens ?? []);
        if (!target) { releaseHostileAttack(this, m); moveBattleOrder(this, m, delta, m.speed); continue; }
        targetPos = target.position; targetsPlayer = !target.isBattleNPC; targetPlayer = target;
      } else {
        targetPlayer = selectHostileTarget(this, m.mesh.position, player);
        let nearestDist = Infinity;
        for (const alien of horde?.aliens ?? []) { if (alien.hp <= 0) continue; const distance = m.mesh.position.distanceTo(alien.mesh.position); if (distance < nearestDist) { nearestDist = distance; target = alien; targetPos = alien.mesh.position; } }
        targetsPlayer = !targetPos;
        if (targetsPlayer) { if (!this.hostileToPlayers || !targetPlayer || targetPlayer.hp <= 0) { releaseHostileAttack(this, m); continue; } targetPos = targetPlayer.position; target = targetPlayer; }
      }
      m.shootCooldown = Math.max(0, (m.shootCooldown ?? 1.4) - delta); m.grenadeCooldown = Math.max(0, (m.grenadeCooldown ?? 7) - delta);
      const distance = targetPos.distanceTo(m.mesh.position);
      const access = this.environment?.getVerticalNavigationTarget?.(m.mesh.position, targetPos);
      const direction = (access ?? targetPos).clone().sub(m.mesh.position).setY(0), moveDistance = direction.length(); m.mesh.rotation.y = Math.atan2(direction.x, direction.z);
      const range = m.type === 'flametrooper' ? 5 : 20, stopping = m.type === 'flametrooper' ? 3.5 : 12;
      const covered = this.environment?.hasLineOfSight && !this.environment.hasLineOfSight(m.mesh.position.clone().add(new THREE.Vector3(0, 2, 0)), targetPos.clone().add(new THREE.Vector3(0, 1.6, 0)));
      if (distance > stopping || covered || access && distance > range) { const step = access || covered ? Math.min(m.speed * delta, moveDistance || m.speed * delta) : Math.min(m.speed * delta, distance - stopping); const previous = m.mesh.position.clone(); m.mesh.position.addScaledVector(direction.normalize(), step); this.environment?.resolveAgentMovement?.(m.mesh.position, targetPos, step, .8, previous); }
      if (covered || distance > range) { releaseHostileAttack(this, m); m.pressureAction = null; continue; }
      if (m.shootCooldown > 0) continue;
      const granted = targetsPlayer ? requestHostileAttack(this, m, targetPlayer, delta, { kind: 'ranged', windup: .8, recovery: 1.5, duration: .3 })
        : !target.isBattleNPC || requestNPCStrike(m, target, delta, { windup: .6, recovery: 1.45 });
      if (!granted) { if (targetsPlayer) syncHostileWarning(this, m); continue; }
      m.shootCooldown = m.type === 'flametrooper' ? 1.65 : 1.45;
      if (m.type === 'flametrooper') (this.audioEngine.playFlamethrowerBurn ?? this.audioEngine.playAcidSizzle)?.call(this.audioEngine);
      else (this.audioEngine.playPulseRifleBurst ?? this.audioEngine.playPlasmaShot)?.call(this.audioEngine);
      if (targetsPlayer) targetPlayer.takeDamage(m.type === 'flametrooper' ? 12 : 9, m.type === 'flametrooper', m, { attackKind: m.type === 'flametrooper' ? 'fire' : 'ballistic', blockable: false, parryable: false });
      else if (target.isBattleNPC) target.takeDamage(m.damage);
      else { target.hp -= m.damage; if (target.hp <= 0) horde.defeatAlien?.(target, { cause: m.type, killerFaction: m.factionId ?? 'uscm' }); }
      syncHostileWarning(this, m);
    }
    if (this.sentryGun?.ammo > 0) {
      const target = (horde?.aliens ?? []).filter(a => a.hp > 0 && this.sentryGun.mesh.position.distanceTo(a.mesh.position) <= this.sentryGun.range).sort((a,b) => this.sentryGun.mesh.position.distanceToSquared(a.mesh.position) - this.sentryGun.mesh.position.distanceToSquared(b.mesh.position))[0];
      this.sentryGun.fireCooldown = Math.max(0, this.sentryGun.fireCooldown - delta);
      const clear = target && (!this.environment?.hasLineOfSight || this.environment.hasLineOfSight(this.sentryGun.mesh.position.clone().add(new THREE.Vector3(0,1.2,0)), target.mesh.position.clone().add(new THREE.Vector3(0,1.6,0))));
      if (clear && this.sentryGun.fireCooldown <= 0) { this.sentryGun.fireCooldown = .35; const rounds = Math.min(4, this.sentryGun.ammo); this.sentryGun.ammo -= rounds; target.hp -= this.sentryGun.damage * rounds; this.audioEngine?.playSentryGunBurst?.(); if (target.hp <= 0) horde.defeatAlien?.(target, { cause: 'sentry', killerFaction: this.factionId ?? 'uscm' }); }
    }
  }

  spawnSentryGun(pos) {
    if (this.sentryGun) {
      disposeObject(this.sentryGun.mesh);
    }
    const mesh = this.createSentryGunMesh();
    mesh.position.copy(pos);
    this.scene.add(mesh);

    this.sentryGun = {
      mesh,
      ammo: 500,
      fireCooldown: 0,
      range: 26,
      damage: 18
    };
  }


  createSentryGunMesh() {
    const group = new THREE.Group();
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.85, roughness: 0.25 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.2 });

    // Tripod Base
    for (let i = 0; i < 3; i++) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.4, 6), metalMat);
      const angle = (i / 3) * Math.PI * 2;
      leg.position.set(Math.cos(angle) * 0.5, 0.6, Math.sin(angle) * 0.5);
      leg.rotation.z = Math.cos(angle) * 0.35;
      leg.rotation.x = Math.sin(angle) * 0.35;
      group.add(leg);
    }

    // Central Swivel Mount
    const mount = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.6, 8), darkMat);
    mount.position.y = 1.2;
    group.add(mount);

    // Twin Rotating Machine Gun Receiver
    const gunBox = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 1.2), darkMat);
    gunBox.position.set(0, 1.5, 0);
    group.add(gunBox);

    // Dual Barrels
    for (let b = -1; b <= 1; b += 2) {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.4, 8), metalMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(b * 0.15, 1.5, 0.9);
      group.add(barrel);
    }

    // Ammo Drum Magazine
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.35, 12), metalMat);
    drum.position.set(0, 1.2, -0.4);
    group.add(drum);

    const details = new THREE.Group();
    details.position.y = 1.5;
    addSentryMechanicalDetails(details);
    group.add(details);
    return group;
  }


  clearSquad() {
    if (this.distressBeacon) disposeObject(this.distressBeacon.mesh); this.distressBeacon = null; this.airSupportPending = false; this.beaconTriggered = false;
    this.marines.forEach(m => { releaseHostileAttack(this, m); disposeObject(m.mesh); });
    this.marines = [];
    if (this.sentryGun) {
      disposeObject(this.sentryGun.mesh);
      this.sentryGun = null;
    }
  }
  deployDistressBeacon(position) {
    if (!position?.isVector3 || this.beaconTriggered) return false;
    this.beaconTriggered = true;
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(.18, .24, .6, 12), new THREE.MeshStandardMaterial({ color: 0x2b4434, roughness: .6 }));
    mesh.position.copy(position).setY(.3); this.scene.add(mesh); this.distressBeacon = { mesh, life: 12 };
    this.audioEngine?.playDistressBeaconPing?.();
    return true;
  }

  triggerGunshipStrafe(position) {
    if (!position?.isVector3 || this.airSupportPending) return false;
    this.strafeCenter = position.clone(); this.airSupportTimer = 2.5; this.airSupportPending = true;
    this.audioEngine?.playCheyenneFlyby?.(); return true;
  }

  spawnBattleUnit(unit, group) {
    const existing = this.marines.find(actor => actor.battleUnitId === unit.id); if (existing) return existing;
    if (!['marine','human','smartgunner','flametrooper'].includes(unit.actorType)) throw new RangeError(`Unsupported detailed human profile: ${unit.actorType}`);
    const weaponKind = ['flametrooper', 'smartgunner'].includes(unit.actorType) ? unit.actorType : 'marine';
    const sourceVisualKind = sourceUnitVisualKind(unit);
    // Visual role can change without mutating the persistent strategic
    // actorType or claiming that its specialist ability is implemented.
    const actor = { mesh: this.createMarineMesh(sourceVisualKind ?? weaponKind), type: weaponKind,
      sourceVisualKind, visualFidelity1to1Verified: false,
      damage: weaponKind === 'flametrooper' ? 35 : 20, speed: 8,
      radius: .8, shootCooldown: 1.5, grenadeCooldown: 7 };
    this.marines.push(applyBattleUnit(this, actor, unit, group)); return actor;
  }

  despawnBattleUnit(unitOrId) { return despawnBattleActor(this, this.marines, unitOrId); }



  defeatCombatant(actor, details = {}) {
    if (!actor) return null;
    const event = recordCombatDeath(this, actor, { kind: actor.type ?? 'marine', ...details });
    actor.hp = 0; releaseHostileAttack(this, actor); const index = this.marines.indexOf(actor); if (index >= 0) this.marines.splice(index, 1);
    if (!actor._combatDisposed) { disposeObject(actor.mesh, this.sharedResources); actor._combatDisposed = true; } if (event) this.onDefeated?.(event); return event;
  }


}
