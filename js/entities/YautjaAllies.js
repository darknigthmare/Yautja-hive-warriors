/* Allied Yautja Honor Guard AI Squad Manager */

import * as THREE from 'three';
import { applyBattleUnit, despawnBattleActor, selectBattleTarget, battleHostile, moveBattleOrder, requestNPCStrike, maintainBattleFormation } from '../engine/BattleActorSupport.js';
import { recordCombatDeath } from '../engine/CombatEvents.js';
import { createHonorGuardModel } from '../graphics/SupportModels.js';
import { releaseHostileAttack, requestHostileAttack } from '../engine/HostilePressure.js';
import { disposeObject } from '../engine/SceneResources.js';

export class YautjaAlliesManager {
  constructor(scene, audioEngine) {
    this.scene = scene;
    this.audioEngine = audioEngine;
    this.allies = [];
  }


  spawnSquad(playerPos, count = 3) {
    this.clearSquad();
    for (let i = 0; i < count; i++) {
      const group = createHonorGuardModel(i);
      const offset = new THREE.Vector3((i - 1) * 4.5, 0, (Math.random() - 0.5) * 4);
      group.position.copy(playerPos).add(offset);
      this.scene.add(group);
      this.allies.push({ mesh: group, hp: 950, maxHp: 950, moveSpeed: 14.5,
        damage: 110, radius: 1.3, attackTimer: 0, plasmaCooldown: 2.5 + Math.random() * 2.0 });
    }
  }


  clearSquad() {
    this.allies.forEach(a => disposeObject(a.mesh));
    this.allies = [];
  }


  update(delta, playerPos, horde) {
    if (!Number.isFinite(delta) || delta <= 0) return;
    for (const ally of [...this.allies]) {
      if (ally.hp <= 0) { this.defeatCombatant(ally, { cause: 'combat', killerFaction: ally.lastDamageFaction }); continue; }
      if(maintainBattleFormation(this,ally,delta,ally.moveSpeed))continue;
      let target = null;
      if (ally.battleUnitId && this.battleSimulation) target = selectBattleTarget(this, ally, [], horde?.getActiveCombatants?.() ?? horde?.aliens ?? []);
      else {
        const nearest = (horde?.aliens ?? []).filter(actor => actor.hp > 0 && actor.mesh.position.distanceTo(ally.mesh.position) < 25).sort((a,b) => a.mesh.position.distanceToSquared(ally.mesh.position) - b.mesh.position.distanceToSquared(ally.mesh.position))[0];
        if (nearest) target = selectBattleTarget(this, ally, [], [nearest]);
      }
      if (!target) {
        if (ally.battleUnitId) { moveBattleOrder(this, ally, delta, ally.moveSpeed); continue; }
        const direction = playerPos.clone().sub(ally.mesh.position).setY(0), distance = direction.length();
        if (distance > 6) { ally.mesh.position.addScaledVector(direction.normalize(), Math.min(ally.moveSpeed * delta, distance - 6)); this.environment?.resolveAgentMovement?.(ally.mesh.position, playerPos, ally.moveSpeed * delta, ally.radius); }
        continue;
      }
      const direction = target.position.clone().sub(ally.mesh.position).setY(0), distance = direction.length();
      if (this.environment?.hasLineOfSight && !this.environment.hasLineOfSight(ally.mesh.position.clone().add(new THREE.Vector3(0,1.8,0)), target.position.clone().add(new THREE.Vector3(0,1.5,0)))) {
        releaseHostileAttack(this, ally); ally._npcPreparation = 0;
        if (distance > .1) ally.mesh.position.addScaledVector(direction.normalize(), Math.min(ally.moveSpeed * delta, distance));
        this.environment.resolveAgentMovement?.(ally.mesh.position, target.position, ally.moveSpeed * delta, ally.radius); continue;
      }
      ally.attackTimer = Math.max(0, ally.attackTimer - delta); ally.plasmaCooldown = Math.max(0, ally.plasmaCooldown - delta);
      ally.mesh.rotation.y = Math.atan2(direction.x, direction.z);
      const ranged = ally.companionAllowsPlasma!==false && distance >= 6 && distance <= 22 && ally.plasmaCooldown <= 0;
      if (distance > 2.2 && !ranged) { const step = Math.min(ally.moveSpeed * delta, distance - 2.2); ally.mesh.position.addScaledVector(direction.normalize(), step); this.environment?.resolveAgentMovement?.(ally.mesh.position, target.position, step, ally.radius); }
      if (!ranged && (distance > 3 || ally.attackTimer > 0)) continue;
      const granted = target.isBattleNPC ? requestNPCStrike(ally, target, delta, { windup: .65, recovery: 1.1 })
        : requestHostileAttack(this, ally, target, delta, { kind: ranged ? 'ranged' : 'melee', windup: ranged ? 1.1 : .85, recovery: 1.6, duration: .35 });
      if (!granted) continue;
      if (ranged) { ally.plasmaCooldown = 4; this.audioEngine?.playPlasmaShot?.(); }
      else { ally.attackTimer = .95; this.audioEngine?.playSlash?.(); }
      target.takeDamage(ranged ? 60 : ally.damage, false, ally, { attackKind: ranged ? 'plasma' : 'melee', blockable: !ranged, parryable: !ranged });
    }
  }

  spawnBattleUnit(unit, group) {
    const existing = this.allies.find(actor => actor.battleUnitId === unit.id); if (existing) return existing;
    if (!['yautja','honor_guard','clan_hunter','bad_blood'].includes(unit.actorType)) throw new RangeError(`Unsupported detailed clan profile: ${unit.actorType}`);
    const actor = { mesh: createHonorGuardModel(this.allies.length), type: unit.actorType === 'bad_blood' ? 'bad_blood' : 'clan_hunter', moveSpeed: 12,
      damage: 55, radius: 1.3, attackTimer: 1, plasmaCooldown: 3 };
    this.allies.push(applyBattleUnit(this, actor, unit, group)); return actor;
  }

  despawnBattleUnit(unitOrId) { return despawnBattleActor(this, this.allies, unitOrId); }



  defeatCombatant(actor, details = {}) {
    if (!actor) return null;
    const event = recordCombatDeath(this, actor, { kind: actor.type ?? 'yautja', ...details });
    actor.hp = 0; releaseHostileAttack(this, actor); const index = this.allies.indexOf(actor); if (index >= 0) this.allies.splice(index, 1);
    if (!actor._combatDisposed) { disposeObject(actor.mesh, this.sharedResources); actor._combatDisposed = true; } if (event) this.onDefeated?.(event); return event;
  }


}
