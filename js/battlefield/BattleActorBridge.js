import { applyBattleFormationHit } from '../engine/BattleActorSupport.js';
import { recordCombatDeath } from '../engine/CombatEvents.js';
import { sourceUnitVisualKind } from '../data/SourceActorPresentation.js';
import { originalMusouSquadRole } from '../data/OriginalMusouSquadRoles.js';
const ACTOR_TYPES = {
  xenomorph: new Set(['warrior', 'runner', 'spitter', 'boiler', 'neomorph', 'praetomorph', 'red_warrior', 'facehugger', 'officer', 'crusher', 'praetorian', 'grid_alien', 'cyber_xeno', 'cryo_xeno', 'xenomorph', 'queen']),
  human: new Set(['marine', 'human', 'smartgunner', 'flametrooper']),
  yautja: new Set(['yautja', 'honor_guard', 'clan_hunter', 'bad_blood']),
  synthetic: new Set(['synthetic', 'working_joe', 'weyland_combat'])
};

/** Projects allocated identities into the actual combat managers. Returning to
 * a distant front removes only its rendered actors, preserving HP and losses. */
export class BattleActorBridge {
  static unsupportedProfiles(config) {
    const used = new Set((config.groups ?? []).flatMap(group => group.units ?? []).map(unit => unit.profileId));
    return (config.profiles ?? []).filter(profile => used.has(profile.id) && !ACTOR_TYPES[profile.species === 'xeno' ? 'xenomorph' : profile.species]?.has(profile.actorType)).map(profile => profile.id);
  }

  constructor(game) {
    this.game = game;
    this.actors = new Map();
    this.disposed = false;
    this.simulation = null;
    this.previous = new Map();
    this.managers = { xenomorph: game.horde, human: game.marines, yautja: game.allies, synthetic: game.synthetics, queen: game.bosses };
    this.arrayKeys = new Map([[game.horde, 'aliens'], [game.marines, 'marines'], [game.allies, 'allies'], [game.synthetics, 'androids']]);
  }

  bind(simulation) {
    if (this.simulation || this.disposed) throw new Error('A battle projection can be bound only once');
    this.simulation = simulation;
    const provider = () => [...new Set([this.game.player, this.game.player2, ...(this.game.horde.getActiveCombatants?.() ?? []), ...(this.game.operationWorld?.combatants ?? []), ...(this.game.hiveNodeWorld?.combatants ?? []), ...(this.game.getSupportCombatants?.()??[]), ...this.actors.values()].map(item => item?.actor ?? item).filter(Boolean))];
    for (const manager of new Set(Object.values(this.managers))) {
      this.previous.set(manager, { battleSimulation: manager.battleSimulation, provider: manager.combatActorsProvider, director: manager.combatDirector, environment: manager.environment });
      manager.battleSimulation = simulation;manager.environment=this.game.env;
      manager.combatActorsProvider = provider;
      manager.combatDirector = this.game.combatDirector;
    }
    this.originalMelee = this.game.horde.checkMeleeHits;
    this.meleeWrapper = attack => [...this.originalMelee.call(this.game.horde, attack), ...this.hitOtherHostiles(attack)];
    this.game.horde.checkMeleeHits = this.meleeWrapper;
    this.game.horde.cancelPendingSpawns?.();
  }

  spawnGroup(group, units) {
    if (this.disposed) return false;
    const returningWoundedGroup=this.simulation.relationship(group.factionId,this.simulation.config.playerFaction)==='allied'&&units.some(unit=>unit.incapacitated&&this.game.allyRescue?.hasDowned(unit.id));
    const added = [];
    try {
      for (const unit of units) {
        if (this.actors.has(unit.id)) continue;
        const species = unit.species ?? group.species;
        const manager = this.managers[unit.actorType === 'queen' ? 'queen' : species === 'xeno' ? 'xenomorph' : species];
        if (!manager?.spawnBattleUnit) throw new Error(`No detailed combat manager for ${unit.species ?? group.species}`);
        const actor = manager.spawnBattleUnit(unit, group);
        if (!actor?.mesh || actor.battleUnitId !== unit.id) throw new Error('The combat manager did not preserve its allocated identity');
        const sourceSlot=originalMusouSquadRole(this.simulation.config,group,unit);
        actor.profileName = sourceUnitVisualKind(unit) === 'drone'
          ? 'Drone — constructeur de nodules (modèle procédural)'
          : sourceSlot?.label ?? unit.profileName ?? actor.profileName;
        if (sourceSlot) {
          actor.originalMusouRole = sourceSlot; // No change to actorType or combat stats.
          if(actor.mesh.userData)actor.mesh.userData.originalMusouRole = sourceSlot.role;
        }
        const entry = { actor, manager, groupId: group.id, unitId: unit.id };
        this.actors.set(unit.id, entry); added.push(entry);
        this.game.env.resolveMovement(actor.mesh.position, actor.radius ?? 1);
        if(!actor.isFlying&&!actor._terrainFall)actor.mesh.position.y=this.game.env.getElevationAt?.(actor.mesh.position.x,actor.mesh.position.z)??actor.mesh.position.y;
        this.game.allyRescue?.onMaterialize(actor);
        const minimum = this.simulation.budgets.spawnDistance;
        if (!returningWoundedGroup&&[this.game.player, this.game.player2].some(player => player?.hp > 0 && Math.hypot(player.position.x-actor.mesh.position.x,player.position.z-actor.mesh.position.z)<minimum)) throw new Error('The physical spawn would breach player insertion distance');
      }
      return true;
    } catch (error) {
      for (const entry of added) { entry.manager.despawnBattleUnit(entry.unitId); this.actors.delete(entry.unitId); }
      this.lastError = error.message;
      return false;
    }
  }

  despawnGroup(group, units) {
    const snapshots = [];
    for (const unit of units) {
      const entry = this.actors.get(unit.id);
      if (!entry) continue;
      const snapshot = entry.manager.despawnBattleUnit(unit.id);
      if (snapshot) snapshots.push(snapshot);
      this.game.allyRescue?.onDematerialize(unit.id,snapshot);
      this.actors.delete(unit.id);
    }
    return snapshots;
  }

  sync() {
    if (this.disposed || !this.simulation) return;
    for (const directive of this.simulation.getActorDirectives()) {
      const entry = this.actors.get(directive.id);
      if (entry) {
        entry.actor.battleOrderTarget = [...directive.targetPosition];
        entry.actor.battleFormationTarget=[...directive.targetPosition];
        entry.actor.battleOrder = directive.order;
        entry.actor.coordinationStrength=directive.coordinationStrength??1;
      }
    }
    const unavailableGroups = new Set();
    for (const [unitId, { actor, manager, groupId }] of this.actors) {
      // A persistent death may be owned by a non-rendered system (incubation,
      // campaign consequence, environmental effect). Never resurrect that ID
      // from a stale still-alive mesh or mark its whole group unavailable.
      if (this.simulation.units.get(unitId)?.state === 'dead') {
        manager.despawnBattleUnit?.(unitId);
        this.actors.delete(unitId);
        continue;
      }
      if(!actor.isFlying&&!actor.isLeaping&&!actor._terrainFall)actor.mesh.position.y=this.game.env.getElevationAt?.(actor.mesh.position.x,actor.mesh.position.z,actor.mesh.position.y)??actor.mesh.position.y;
      const present = manager === this.game.bosses ? manager.activeBoss === actor : manager[this.arrayKeys.get(manager)]?.includes(actor);
      if (!present && actor.hp > 0) {
        this.simulation.syncUnit(unitId, { hp: actor.hp, position: [actor.mesh.position.x, actor.mesh.position.z] });
        unavailableGroups.add(groupId);
      } else if (actor.hp <= 0) {
        const details = { cause: 'observed-detailed-death', killerFaction: actor.lastDamageFaction };
        if (manager.defeatAlien) manager.defeatAlien(actor, details);
        else if (manager.defeatSynthetic) manager.defeatSynthetic(actor, details);
        else if (manager.defeatCombatant) manager.defeatCombatant(actor, details);
        else if (manager === this.game.bosses) manager.despawnBattleUnit(unitId);
        if(actor.hp>0&&actor.isDowned){this.simulation.syncUnit(unitId,{hp:actor.hp,position:[actor.mesh.position.x,actor.mesh.position.z]});continue;}
        recordCombatDeath(manager, actor, details);
        this.simulation.recordDeath({ entityId: unitId, cause: 'detailed-combat', killerFaction: actor.lastDamageFaction });
        if (present) manager.despawnBattleUnit(unitId);
        this.actors.delete(unitId);
      } else this.simulation.syncUnit(unitId, { hp: actor.hp, position: [actor.mesh.position.x, actor.mesh.position.z],...(manager===this.game.bosses?{encounterState:manager.serializeCombatState?.()}: {}) });
    }
    for (const groupId of unavailableGroups) this.simulation.releaseGroupDetail?.(groupId, 'detailed-actor-unavailable');
  }

  hitOtherHostiles(attack) {
    if (this.disposed || !attack?.origin?.isVector3 || !(attack.damage > 0) || !Number.isFinite(attack.radius)) return [];
    const faction = attack.killerFaction ?? this.simulation.config.playerFaction;
    const hits = [];
    // Synthetics have their own public hit API, already called by player skills.
    // Only human/clan units need this extension of the historical hive query.
    for (const { actor, manager } of [...this.actors.values()]) {
      if ((attack.targetOnly&&actor!==attack.targetOnly) || manager === this.game.horde || manager === this.game.synthetics || manager === this.game.bosses || actor.hp <= 0 ||
          !this.simulation.areHostile(faction, actor.factionId) || actor.mesh.position.distanceTo(attack.origin) > attack.radius + (actor.radius ?? 1) ||
          this.game.env.hasLineOfSight?.(attack.origin.clone().add({x:0,y:1.2,z:0}),actor.mesh.position.clone().add({x:0,y:1.2,z:0})) === false) continue;
      const raw=applyBattleFormationHit(manager,actor,attack);
      const dealt=this.simulation.absorbExosuitDamage?.(actor.battleUnitId,raw) ?? raw;
      actor.lastDamageFaction=faction;
      actor.hp = Math.max(0, actor.hp - dealt);
      const event = actor.hp <= 0 ? manager.defeatCombatant(actor, { cause: attack.type ?? 'player-hit', killerFaction: faction }) : null;
      const killed = actor.hp <= 0;
      hits.push({ pos: actor.mesh.position.clone(), damage: dealt, killed, event, isOfficer: actor.isOfficer === true });
    }
    hits.push(...(this.game.hiveNodeWorld?.hitWithAttack(attack, faction) ?? []));
    return hits;
  }

  getStats() {
    return { materializedActors: this.actors.size, ids: [...this.actors.keys()], disposed: this.disposed, lastError: this.lastError ?? null };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const [unitId, { manager }] of this.actors) manager.despawnBattleUnit(unitId);
    this.actors.clear();
    if (this.game.horde.checkMeleeHits === this.meleeWrapper) this.game.horde.checkMeleeHits = this.originalMelee;
    for (const [manager, previous] of this.previous) {
      manager.battleSimulation = previous.battleSimulation;
      manager.combatActorsProvider = previous.provider;
      manager.combatDirector = previous.director;manager.environment=previous.environment;
    }
    this.previous.clear();
  }
}
