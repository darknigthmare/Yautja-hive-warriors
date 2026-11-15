import * as THREE from 'three';
import { disposeObject } from './SceneResources.js';
import { releaseHostileAttack } from './HostilePressure.js';
import { applyFormationImpact, formationAttackKind, formationDamageMultiplier } from '../battlefield/FormationTactics.js';
const attackIdentities=new WeakMap();let attackSequence=0;

export function applyBattleUnit(manager, actor, unit, group) {
  if (!unit?.id || !Array.isArray(unit.position) || unit.position.length !== 2 || !unit.position.every(Number.isFinite) || !Number.isFinite(unit.hp) || unit.hp <= 0) throw new TypeError('A live allocated battle unit is required');
  Object.assign(actor, { battleUnitId: unit.id, battleGroupId: unit.groupId ?? group?.id,
    factionId: unit.factionId, profileId: unit.profileId, role: unit.role,
    isOfficer: unit.officer === true, officer: unit.officer === true,
    hp: unit.hp, maxHp: unit.maxHp, combatManager: manager });
  actor.mesh.position.set(unit.position[0], 0, unit.position[1]);
  actor.mesh.userData.battleUnitId = unit.id;
  actor.battleOrderTarget = group?.targetPosition ? [...group.targetPosition] : [...unit.position];
  actor.battleOrder = group?.order;
  manager.scene.add(actor.mesh);
  return actor;
}

export function despawnBattleActor(manager, collection, unitOrId) {
  const id = typeof unitOrId === 'string' ? unitOrId : unitOrId?.id ?? unitOrId?.battleUnitId;
  const index = collection.findIndex(actor => actor.battleUnitId === id);
  if (index < 0) return null;
  const actor = collection[index], snapshot = { id, hp: Math.max(0, actor.hp), position: [actor.mesh.position.x, actor.mesh.position.z] };
  if (actor.hp <= 0) {
    const details = { cause: 'synchronized-actor-death', killerFaction: actor.lastDamageFaction ?? null };
    if (manager.defeatAlien) manager.defeatAlien(actor, details);
    else if (manager.defeatSynthetic) manager.defeatSynthetic(actor, details);
    else manager.defeatCombatant?.(actor, details);
    return snapshot;
  }
  releaseHostileAttack(manager, actor); manager._clearAttackCue?.(actor);
  if (!actor._combatDisposed) { disposeObject(actor.mesh, manager.sharedResources); actor._combatDisposed = true; }
  collection.splice(index, 1);
  return snapshot; // Materialization level is not a death and does not score.
}

export function battleHostile(manager, actor, candidate) {
  if (!manager.battleSimulation || !actor.factionId) return true;
  const faction = candidate.factionId ?? (candidate.position && candidate.takeDamage ? manager.battleSimulation.config.playerFaction : null);
  return !!faction && manager.battleSimulation.areHostile(actor.factionId, faction);
}

export function selectBattleTarget(manager, actor, fallbacks = [], others = []) {
  if (['retreat', 'regroup'].includes(actor.battleOrder?.type)) {
    releaseHostileAttack(manager, actor); manager._clearAttackCue?.(actor);
    actor._npcPreparation = 0; actor._npcTarget = null; actor.pressureAction = null;
    return null;
  }
  const origin = actor.mesh.position, candidates = new Set([...(manager.combatActorsProvider?.() ?? []), ...others, ...(Array.isArray(fallbacks) ? fallbacks : [fallbacks])]);
  let nearest = null, distance = Infinity;
  for (const candidate of candidates) {
    if (!candidate || candidate === actor || !(candidate.hp > 0) || !battleHostile(manager, actor, candidate)) continue;
    const position = candidate.position ?? candidate.mesh?.position;
    if (!position?.isVector3) continue;
    if(Array.isArray(actor.battleFormationTarget) && Math.hypot(position.x-actor.battleFormationTarget[0],position.z-actor.battleFormationTarget[1])>28)continue;
    if (actor.battleOrder?.type === 'defend' && Array.isArray(actor.battleOrderTarget) &&
        Math.hypot(position.x - actor.battleOrderTarget[0], position.z - actor.battleOrderTarget[1]) > 24) continue;
    const squared = position.distanceToSquared(origin);
    if (squared < distance) { distance = squared; nearest = candidate; }
  }
  return nearest ? targetView(nearest, actor) : null;
}

const targetViews = new WeakMap();
function targetView(actor, attacker) {
  if (typeof actor.takeDamage === 'function' && actor.position?.isVector3) return actor;
  let cache = targetViews.get(actor); if (!cache) { cache = new Map(); targetViews.set(actor, cache); }
  const identity = attacker.factionId ?? attacker; if (cache.has(identity)) return cache.get(identity);
  // A manager actor becomes a damageable target without copying its live state.
  const view = { isBattleNPC: true, factionId: actor.factionId, actor,
    get position() { return actor.mesh.position; }, get mesh() { return actor.mesh; },
    get hp() { return actor.hp; }, get radius() { return actor.radius ?? 1; },
    get isBlocking() { return false; }, get isFacehuggerLatched() { return actor.isFacehuggerLatched === true; },
    get isCloaked() { return actor.isCloaked === true; },
    audioEngine: actor.combatManager?.audioEngine,
    takeDamage(amount) {
      if (!Number.isFinite(amount) || amount <= 0 || actor.hp <= 0) return;
      if (actor.combatManager?.activeBoss === actor) { actor.combatManager.takeDamage(amount, null, { cause: 'faction-combat', killerFaction: attacker.factionId }); return; }
      actor.hp = Math.max(0, actor.hp - amount);
      actor.lastDamageFaction = attacker.factionId ?? null;
      if (actor.hp <= 0) {
        const manager = actor.combatManager;
        if (manager?.defeatAlien) manager.defeatAlien(actor, { cause: 'faction-combat', killerFaction: attacker.factionId });
        else if (manager?.defeatSynthetic) manager.defeatSynthetic(actor, { cause: 'faction-combat', killerFaction: attacker.factionId });
        else if (manager?.activeBoss === actor) manager.takeDamage(1, null, { cause: 'faction-combat', killerFaction: attacker.factionId });
        else manager?.defeatCombatant?.(actor, { cause: 'faction-combat', killerFaction: attacker.factionId });
      }
    },
    triggerFacehuggerLatch() { actor.isFacehuggerLatched = true; actor.facehuggerHold = 4; },
    applyEMP(duration = 2) { actor.isEMPStunned = true; actor.empStunTimer = duration; }
  };
  cache.set(identity, view); return view;
}

export function moveBattleOrder(manager, actor, delta, speed) {
  if((manager.battleSimulation?.groups?.get(actor.battleGroupId)?.rootUntil ?? 0)>(manager.battleSimulation?.time ?? 0))return;
  const point = actor.battleOrderTarget;
  if (!Array.isArray(point)) return;
  const destination = new THREE.Vector3(point[0], actor.mesh.position.y, point[1]), direction = destination.clone().sub(actor.mesh.position).setY(0), distance = direction.length();
  if (distance <= 1.3) return;
  const step = Math.min(speed * delta, distance - 1.3);
  actor.mesh.position.addScaledVector(direction.normalize(), step);
  manager.environment?.resolveAgentMovement?.(actor.mesh.position, destination, step, Math.min(actor.radius ?? 1, 1.3));
  actor.mesh.rotation.y = Math.atan2(direction.x, direction.z);
}

export function requestNPCStrike(actor, target, delta, { windup = .8, recovery = 1.2 } = {}) {
  if (!(target?.hp > 0)) return false;
  const simulation=actor.combatManager?.battleSimulation,group=simulation?.groups?.get(actor.battleGroupId);
  if((group?.rootUntil ?? 0)>(simulation?.time ?? 0))return false;
  if((group?.suppressedUntil ?? 0)>(simulation?.time ?? 0))windup*=1.6;
  actor._npcRecovery = Math.max(0, (actor._npcRecovery ?? 0) - delta);
  if (actor._npcRecovery > 0) return false;
  if (actor._npcTarget !== (target.actor ?? target)) { actor._npcTarget = target.actor ?? target; actor._npcPreparation = 0; }
  actor._npcWindup = windup;
  actor._npcPreparation = (actor._npcPreparation ?? 0) + delta;
  if (actor._npcPreparation + 1e-8 < windup) return false;
  actor._npcPreparation = 0; actor._npcRecovery = recovery;
  return true;
}

export function applyBattleFormationHit(manager,actor,attack,amount=attack.damage) {
  const simulation=manager.battleSimulation,group=simulation?.groups?.get(actor.battleGroupId),kind=formationAttackKind(attack);
  if(!group || !kind)return amount;
  if(!attackIdentities.has(attack))attackIdentities.set(attack,{id:`physical-${++attackSequence}`,multipliers:new Map()});
  const identity=attackIdentities.get(attack);if(!identity.multipliers.has(group.id))identity.multipliers.set(group.id,formationDamageMultiplier(group,kind));
  applyFormationImpact(simulation,{groupId:group.id,kind,sourceFaction:attack.killerFaction ?? simulation.config.playerFaction,attackId:attack.attackId ?? identity.id,hitUnitIds:[actor.battleUnitId]});
  return amount*identity.multipliers.get(group.id);
}

export function maintainBattleFormation(manager,actor,delta,speed) {
  const simulation=manager.battleSimulation,group=simulation?.groups?.get(actor.battleGroupId);
  if(!group || !actor.battleUnitId)return false;
  if(group.rootUntil>simulation.time) {releaseHostileAttack(manager,actor);actor._npcPreparation=0;return true;}
  if(Array.isArray(actor.companionOrderTarget)) {
    const [x,z]=actor.companionOrderTarget,dx=x-actor.mesh.position.x,dz=z-actor.mesh.position.z,distance=Math.hypot(dx,dz),range=actor.companionOrderRange??3;
    if(distance>range) {const step=Math.min(speed*delta,distance-range);actor.mesh.position.x+=dx/distance*step;actor.mesh.position.z+=dz/distance*step;manager.environment?.resolveAgentMovement?.(actor.mesh.position,actor.mesh.position.clone().set(x,actor.mesh.position.y,z),step,actor.radius??1);actor.mesh.rotation.y=Math.atan2(dx,dz);}
    releaseHostileAttack(manager,actor);actor._npcPreparation=0;return true;
  }
  const slot=actor.battleFormationTarget;
  if(!Array.isArray(slot) || group.cohesion<25 || ['retreat','regroup'].includes(actor.battleOrder?.type))return false;
  const dx=slot[0]-actor.mesh.position.x,dz=slot[1]-actor.mesh.position.z,distance=Math.hypot(dx,dz);
  if(distance<=2)return false;
  const step=Math.min(speed*delta,distance-1.5);actor.mesh.position.x+=dx/distance*step;actor.mesh.position.z+=dz/distance*step;
  const destination=actor.mesh.position.clone().set(slot[0],actor.mesh.position.y,slot[1]);manager.environment?.resolveAgentMovement?.(actor.mesh.position,destination,step,actor.radius??1);
  actor.mesh.rotation.y=Math.atan2(dx,dz);
  if(distance>5){releaseHostileAttack(manager,actor);actor._npcPreparation=0;return true;}return false;
}

export function listBattleTargets(manager, actor, fallbacks = []) {
  const candidates = new Set([...(manager.combatActorsProvider?.() ?? []), ...(Array.isArray(fallbacks) ? fallbacks : [fallbacks])]);
  return [...candidates].filter(candidate => candidate && candidate !== actor && candidate.hp > 0 && (candidate.position ?? candidate.mesh?.position)?.isVector3 && battleHostile(manager, actor, candidate)).map(candidate => targetView(candidate, actor));
}
