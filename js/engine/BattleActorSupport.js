import * as THREE from 'three';
import { disposeObject } from './SceneResources.js';
import { releaseHostileAttack } from './HostilePressure.js';
import { applyFormationImpact, formationAttackKind, formationDamageMultiplier } from '../battlefield/FormationTactics.js';
const attackIdentities=new WeakMap();let attackSequence=0;

export function applyBattleUnit(manager, actor, unit, group) {
  invalidateBattleTargetIndex(manager);
  if (!unit?.id || !Array.isArray(unit.position) || unit.position.length !== 2 || !unit.position.every(Number.isFinite) || !Number.isFinite(unit.hp) || unit.hp <= 0) throw new TypeError('A live allocated battle unit is required');
  Object.assign(actor, { battleUnitId: unit.id, battleGroupId: unit.groupId ?? group?.id,
    factionId: unit.factionId, profileId: unit.profileId, role: unit.role,
    isOfficer: unit.officer === true, officer: unit.officer === true,
    hp: unit.hp, maxHp: unit.maxHp, isDowned: unit.incapacitated === true, combatManager: manager });
  actor.mesh.position.set(unit.position[0], 0, unit.position[1]);
  actor.mesh.userData.battleUnitId = unit.id;
  actor.battleOrderTarget = group?.targetPosition ? [...group.targetPosition] : [...unit.position];
  actor.battleOrder = group?.order;
  manager.scene.add(actor.mesh);
  return actor;
}

export function despawnBattleActor(manager, collection, unitOrId) {
  invalidateBattleTargetIndex(manager);
  const id = typeof unitOrId === 'string' ? unitOrId : unitOrId?.id ?? unitOrId?.battleUnitId;
  const index = collection.findIndex(actor => actor.battleUnitId === id);
  if (index < 0) return null;
  const actor = collection[index], snapshot = { id, hp: Math.max(0, actor.hp), position: [actor.mesh.position.x, actor.mesh.position.z], ...(actor.isDowned ? { incapacitated: true } : {}) };
  if (actor.hp <= 0) {
    const details = { cause: 'synchronized-actor-death', killerFaction: actor.lastDamageFaction ?? null };
    if (manager.defeatAlien) manager.defeatAlien(actor, details);
    else if (manager.defeatSynthetic) manager.defeatSynthetic(actor, details);
    else manager.defeatCombatant?.(actor, details);
    if (actor.hp <= 0) return snapshot;
    // A rescue-aware manager may turn that first lethal hit into a casualty.
    // It must still be removed from this projection, with its live HP/flag.
    snapshot.hp = actor.hp; snapshot.incapacitated = actor.isDowned === true;
  }
  if (actor.isDowned) manager.rescueSystem?.onDematerialize(id, actor);
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

// Provider lists are shared by every actor in one manager update. The cache
// retains only WeakRefs; a transient candidate snapshot must not keep a previous
// mission's meshes, targets or provider closure alive after cleanup.
const targetCandidateIndexes = new WeakMap(), providerRevisions = new WeakMap();
export function invalidateBattleTargetIndex(manager) {
  targetCandidateIndexes.delete(manager);
  const provider = manager.combatActorsProvider;
  if (typeof provider === 'function') providerRevisions.set(provider, (providerRevisions.get(provider) ?? 0) + 1);
}
function candidateFaction(manager, candidate) {
  return candidate.factionId ?? (candidate.position && candidate.takeDamage ? manager.battleSimulation?.config.playerFaction : null);
}
function targetCandidateIndex(manager) {
  const provider = manager.combatActorsProvider, simulation = manager.battleSimulation;
  const cacheable = typeof provider === 'function' && Number.isFinite(manager.time) && typeof WeakRef === 'function';
  const previous = cacheable ? targetCandidateIndexes.get(manager) : null;
  if (previous && previous.stamp === manager.time && previous.provider.deref() === provider && previous.revision === (providerRevisions.get(provider) ?? 0) && previous.simulation?.deref() === simulation) {
    const snapshot = previous.snapshot.deref(); if (snapshot) return snapshot;
  }
  const index = { members: new Set(), byFaction: new Map(), count: 0 };
  for (const candidate of provider?.() ?? []) {
    if (!candidate || typeof candidate !== 'object' || index.members.has(candidate)) continue;
    index.members.add(candidate);
    const faction = candidateFaction(manager, candidate);
    if (!index.byFaction.has(faction)) index.byFaction.set(faction, []);
    index.byFaction.get(faction).push({ candidate, ordinal: index.count++ });
  }
  // The whole snapshot is weak, rather than performing a WeakRef dereference
  // for every target. It stays alive for the current JS job but cannot retain
  // a cleared mission through a persistent manager after that job completes.
  if (cacheable) targetCandidateIndexes.set(manager, { stamp: manager.time, provider: new WeakRef(provider),
    simulation: simulation ? new WeakRef(simulation) : null, revision: providerRevisions.get(provider) ?? 0, snapshot: new WeakRef(index) });
  return index;
}

export function selectBattleTarget(manager, actor, fallbacks = [], others = []) {
  if (actor.isDowned || actor.isRescueRecovering) return null;
  if (['retreat', 'regroup'].includes(actor.battleOrder?.type)) {
    releaseHostileAttack(manager, actor); manager._clearAttackCue?.(actor);
    actor._npcPreparation = 0; actor._npcTarget = null; actor.pressureAction = null;
    return null;
  }
  const origin = actor.mesh.position, index = targetCandidateIndex(manager);
  const formation = Array.isArray(actor.battleFormationTarget) ? actor.battleFormationTarget : null;
  const defend = actor.battleOrder?.type === 'defend' && Array.isArray(actor.battleOrderTarget) ? actor.battleOrderTarget : null;
  let nearest = null, distance = Infinity, nearestOrdinal = Infinity;
  const consider = (candidate, factionAlreadyHostile = false, ordinal = Infinity) => {
    if (!candidate || candidate === actor || !(candidate.hp > 0) || candidate._combatDisposed || candidate.combatManager && candidate.mesh?.parent === null || !factionAlreadyHostile && !battleHostile(manager, actor, candidate)) return;
    const position = candidate.position ?? candidate.mesh?.position;
    if (!position?.isVector3) return;
    if (formation && (position.x - formation[0]) ** 2 + (position.z - formation[1]) ** 2 > 28 ** 2) return;
    if (defend && (position.x - defend[0]) ** 2 + (position.z - defend[1]) ** 2 > 24 ** 2) return;
    const squared = position.distanceToSquared(origin);
    if (squared < distance || squared === distance && ordinal < nearestOrdinal) { distance = squared; nearest = candidate; nearestOrdinal = ordinal; }
  };
  for (const [faction, references] of index.byFaction) {
    if (manager.battleSimulation && actor.factionId && (!faction || !manager.battleSimulation.areHostile(actor.factionId, faction))) continue;
    for (const entry of references) consider(entry.candidate, true, entry.ordinal);
  }
  let extras = null, extraOrdinal = index.count;
  const considerExtra = candidate => {
    if (!candidate || typeof candidate !== 'object' || index.members.has(candidate) || extras?.has(candidate)) return;
    extras ??= new WeakSet(); extras.add(candidate); consider(candidate, false, extraOrdinal++);
  };
  for (const candidate of others) considerExtra(candidate);
  for (const candidate of Array.isArray(fallbacks) ? fallbacks : [fallbacks]) considerExtra(candidate);
  return nearest ? targetView(nearest, actor) : null;
}

const targetViews = new WeakMap();
function targetView(actor, attacker) {
  // Node proxies have no soldier identity and require the actual attacker
  // faction for damage policy. A bare target would silently attribute NPC
  // fire to the player clan or reject it because the source is unknown.
  if (actor?.isHiveNodeProxy && actor.position?.isVector3) return {
    isBattleNPC: true, isHiveNodeProxy: true, actor, factionId: actor.factionId,
    get position() { return actor.position; },
    get mesh() { return actor.mesh; },
    get hp() { return actor.hp; },
    get radius() { return actor.radius; },
    takeDamage(amount) { return actor.takeDamage(amount, attacker?.factionId ?? null); }
  };
  if (typeof actor.takeDamage === 'function' && actor.position?.isVector3) return actor;
  // Each source keeps its live coordination and credit context. A faction-wide
  // view captured the first attacker, and a strong per-actor Map would retain
  // removed combatants for as long as their target survived.
  let cache = targetViews.get(actor); if (!cache) { cache = new WeakMap(); targetViews.set(actor, cache); }
  const identity = attacker; if (cache.has(identity)) return cache.get(identity);
  // A manager actor becomes a damageable target without copying its live state.
  const view = { isBattleNPC: true, factionId: actor.factionId, actor,
    get position() { return actor.mesh.position; }, get mesh() { return actor.mesh; },
    get hp() { return actor.hp; }, get radius() { return actor.radius ?? 1; },
    get isBlocking() { return false; }, get isFacehuggerLatched() { return actor.isFacehuggerLatched === true; },
    get isCloaked() { return actor.isCloaked === true; },
    audioEngine: actor.combatManager?.audioEngine,
    takeDamage(amount) {
      if (!Number.isFinite(amount) || amount <= 0 || actor.hp <= 0) return;
      amount = battleCoordinationDamage(attacker, amount);
      amount = actor.battleUnitId
        ? actor.combatManager?.battleSimulation?.absorbExosuitDamage?.(actor.battleUnitId, amount) ?? amount
        : amount;
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

/** Damage only visible, hostile units at the missile impact. The target
 * already hit by direct missile damage is excluded from the secondary splash.
 * Every physical target remains owned by its original combat manager. */
export function applyBattleSplashDamage(manager, attacker, center, { radius, damage, exclude = null } = {}) {
  if (!center?.isVector3 || !Number.isFinite(radius) || radius <= 0 || radius > 12 ||
      !Number.isFinite(damage) || damage <= 0 || !manager?.battleSimulation) return [];
  const primary = exclude?.actor ?? exclude, hits = [], seen = new Set();
  for (const candidate of manager.combatActorsProvider?.() ?? []) {
    const actor = candidate?.actor ?? candidate;
    if (!actor || actor === attacker || actor === primary || seen.has(actor) || !(actor.hp > 0) ||
        actor._combatDisposed || !battleHostile(manager, attacker, actor)) continue;
    const position = actor.position ?? actor.mesh?.position;
    if (!position?.isVector3) continue;
    const separation = position.distanceTo(center);
    if (separation > radius + Math.min(actor.radius ?? 0, 1)) continue;
    if (manager.environment?.hasLineOfSight &&
        !manager.environment.hasLineOfSight(center.clone().add(new THREE.Vector3(0, .25, 0)),
          position.clone().add(new THREE.Vector3(0, .9, 0)))) continue;
    const amount = damage * Math.max(.30, 1 - separation / (radius + Math.min(actor.radius ?? 0, 1)));
    seen.add(actor);
    targetView(actor, attacker).takeDamage(amount);
    hits.push({ actorId: actor.battleUnitId ?? null, damage: amount });
  }
  return hits;
}

export function moveBattleOrder(manager, actor, delta, speed) {
  if (actor.isDowned || actor.isRescueRecovering) return;
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
  if (actor.isDowned || actor.isRescueRecovering) return false;
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
  if (actor.isDowned || actor.isRescueRecovering) { releaseHostileAttack(manager, actor); actor._npcPreparation = 0; return true; }
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
  if (actor.isDowned || actor.isRescueRecovering) return [];
  const candidates = new Set([...(manager.combatActorsProvider?.() ?? []), ...(Array.isArray(fallbacks) ? fallbacks : [fallbacks])]);
  return [...candidates].filter(candidate => candidate && candidate !== actor && candidate.hp > 0 && (candidate.position ?? candidate.mesh?.position)?.isVector3 && battleHostile(manager, actor, candidate)).map(candidate => targetView(candidate, actor));
}

export function battleCoordinationDamage(actor, amount) {
  const strength = Number.isFinite(actor?.coordinationStrength) ? Math.min(1, Math.max(.65, actor.coordinationStrength)) : 1;
  return amount * strength;
}
