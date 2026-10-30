/* Finite strategic battle state. Detailed actors remain owned by their game
 * systems; distant combat never damages the player or a materialized actor.
 * This is a game simulation, not a claim about canonical army organization. */

import { BattleIntel } from './BattleIntel.js';
import { applyMusouOfficerBreak } from './MusouBattleFlow.js';
import { applyFacehuggerExposure } from './FacehuggerExposure.js';
import { HIVE_SPORE_RULES, updateHiveSporeSight, getHiveSporeContacts,
  restoreHiveSporeSight } from './HiveSporeSight.js';
import { infectHost, completeHostInfections, validateHostInfestation } from './HostInfestation.js';
import { HIVE_NODE_RULES, createHiveEcology, awardHiveInfestation, buildHiveNode, healHiveSpace,
  damageHiveNode as damageEcologyNode, snapshotHiveEcology, restoreHiveEcology } from './HiveNodeEcology.js';
import { sourceUnitVisualKind } from '../data/SourceActorPresentation.js';
import { initialSpecialistStocks, restoreSpecialistStocks, sourceSpecialistRole, SPECIALIST_ATTACKS } from '../data/SourceSpecialistCombat.js';
import { measureDefeatReturn } from './BattleStrategy.js';
import { validateBossCombatState } from '../data/BossEncounterValidation.js';
import { initializeFormation, updateFormation, formationTargetForUnit, formationAttackMultiplier, normalizeFormation, FORMATION_PROFILES } from './FormationTactics.js';

const STATES = new Set(['active', 'distant', 'reserve', 'dead', 'evacuated', 'captured']);
const RELATIONS = new Set(['hostile', 'allied', 'neutral']);
const MODES = new Set(['reconstruction', 'clan_war', 'crossover', 'original']);
const ORDERS = new Set(['attack', 'defend', 'regroup', 'escort', 'retreat']);
const EPSILON = 1e-8;
const clone = value => JSON.parse(JSON.stringify(value));
const fail = message => { throw new Error(`BattleSimulation: ${message}`); };
const id = value => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,96}$/.test(value);
const number = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;
const point = value => Array.isArray(value) && value.length === 2 && value.every(Number.isFinite);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const alive = unit => unit.hp > 0 && !['dead', 'evacuated', 'captured'].includes(unit.state);
const combatReady = unit => alive(unit) && unit.incapacitated !== true;
const pair = (a, b) => a < b ? `${a}|${b}` : `${b}|${a}`;
function ordered(value) {
  if (Array.isArray(value)) return value.map(ordered);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, ordered(value[key])]));
  return value;
}
function fingerprint(value) {
  let result = 2166136261;
  for (const character of JSON.stringify(ordered(value))) result = Math.imul(result ^ character.charCodeAt(0), 16777619) >>> 0;
  return result.toString(16).padStart(8, '0');
}
const hash = value => parseInt(fingerprint(value), 16);
const speciesOf = value => value === 'xeno' ? 'xenomorph' : value;

/**
 * Configuration is explicit and serializable. All units exist before a battle
 * starts; promoting detail and requesting reinforcements cannot create units.
 * spawnGroup(group, units) may return false if a real actor pool is unavailable.
 * despawnGroup(group, units) may return [{id,hp,position}] to preserve live poses.
 */
export class BattleSimulation {
  constructor(configuration, callbacks = {}) {
    if (!configuration || !id(configuration.id)) fail('a stable operation id is required');
    this.config = clone(configuration);
    this.config.mode ??= 'original';
    if (!MODES.has(this.config.mode)) fail('unknown context mode');
    this.digest = fingerprint(this.config);
    this.callbacks = callbacks; this.routeAvailabilityProvider = callbacks.routeAvailabilityProvider ?? null;
    this.time = 0; this.accumulator = 0; this.step = .25; this.tick = 0;
    this.disposed = false; this.result = null; this.paused = false;
    this.events = []; this.eventsDropped = 0; this.eventSequence = 0;
    this.deaths = new Map(); this.unique = new Map(); this.players = []; this.attackSeeds = new Map();
    this.criticalLosses = new Map(); this.routeRevision = 0; this.targetingCounters = { groupVisits: 0, attackerVisits: 0, targetCandidateEntries: 0, attacksResolved: 0 };
    this.factions = new Map(); this.fronts = new Map(); this.routes = new Map();
    this.profiles = new Map(); this.groups = new Map(); this.units = new Map();
    this.relations = new Map(); this.orders = new Map(); this.nextReinforcement = new Map();
    this.defeatSince = null; this.pendingArrivals = []; this.objectiveKeys = new Set();
    this.nextStrategicOrder = this.config.ai?.interval ?? 20;
    this.tacticCooldowns = new Map();
    this.budgets = { active: 32, byFaction: {}, spawnInterval: 8, arrivalsPerTick: 4, spawnDistance: 24,
      announcementSeconds: 3, ...(this.config.budgets ?? {}) };
    for (const [key, min, max] of [['active', 1, 512], ['spawnInterval', 1, 120], ['arrivalsPerTick', 1, 64], ['spawnDistance', 0, 100], ['announcementSeconds', 1, 30]]) {
      if (!number(this.budgets[key], min, max) || ['active', 'arrivalsPerTick'].includes(key) && !Number.isInteger(this.budgets[key])) fail(`invalid ${key} budget`);
    }
    if (this.config.ai?.interval !== undefined && !number(this.config.ai.interval, 1, 300) || this.config.ai?.minimumGarrisonGroups !== undefined && (!Number.isInteger(this.config.ai.minimumGarrisonGroups) || this.config.ai.minimumGarrisonGroups < 1 || this.config.ai.minimumGarrisonGroups > 64)) fail('invalid officer decision cadence');
    if (this.config.ai?.assaultMinRatio !== undefined && !number(this.config.ai.assaultMinRatio, .1, 4) || this.config.ai?.targetPreference !== undefined && !['weakest', 'supply'].includes(this.config.ai.targetPreference)) fail('invalid officer risk profile');
    this._initialize();
    for (const uniqueId of callbacks.history?.capturedUniqueIds ?? []) {
      const unit = this.units.get(this.unique.get(uniqueId));
      if (unit) { unit.state = 'captured'; unit.incapacitated = false; }
    }
    for (const uniqueId of callbacks.history?.defeatedUniqueIds ?? []) {
      const unit = this.units.get(this.unique.get(uniqueId));
      if (!unit) continue;
      unit.hp = 0; unit.state = 'dead';
      this.deaths.set(unit.id, { entityId: unit.id, groupId: unit.groupId, factionId: unit.factionId,
        killerFaction: null, cause: 'prior_operation', time: 0, officer: unit.officer, uniqueId, inherited: true });
    }
    for (const group of this.groups.values()) if (this.factions.get(group.factionId).moraleModel === 'hive' && this.units.get(group.officerId)?.state === 'dead') group.coordinationStrength = .65;
    // Pure objective-side ecology; nodes are not battle units and cannot alter
    // the signed strategic roster. Older saves have no ecology and recover empty.
    this.hiveEcology = createHiveEcology(this.config.id, [...this.factions.values()]);
    this.intel = new BattleIntel(this, this.config.intelligence);
  }

  _initialize() {
    for (const faction of this.config.factions ?? []) {
      const species = speciesOf(faction.species), moraleModel = { hive_pressure: 'hive', hive_coordination: 'hive', clan_cohesion: 'clan', human_morale: 'human' }[faction.moraleModel] ?? faction.moraleModel ?? (species === 'xenomorph' ? 'hive' : species === 'yautja' ? 'clan' : 'human');
      if (!id(faction.id) || this.factions.has(faction.id) || !['yautja', 'xenomorph', 'human', 'synthetic'].includes(species) || !['human', 'clan', 'hive'].includes(moraleModel)) fail('factions need unique ids, an explicit species and a known coordination model');
      this.factions.set(faction.id, { allegiance: 'neutral', ...faction, species, moraleModel });
      this.nextReinforcement.set(faction.id, this.budgets.spawnInterval);
    }
    if (this.factions.size < 2 || !this.factions.has(this.config.playerFaction)) fail('at least two factions and the player faction are required');
    for (const relationship of this.config.relations ?? []) {
      if (!this.factions.has(relationship.a) || !this.factions.has(relationship.b) || relationship.a === relationship.b || !RELATIONS.has(relationship.state)) fail('invalid faction relationship');
      const key = pair(relationship.a, relationship.b);
      if (this.relations.has(key)) fail('duplicate faction relationship');
      this.relations.set(key, relationship.state);
    }
    const factions = [...this.factions.keys()];
    for (let a = 0; a < factions.length; a++) for (let b = a + 1; b < factions.length; b++) if (!this.relations.has(pair(factions[a], factions[b]))) fail('every faction pair needs an explicit relationship');
    for (const front of this.config.fronts ?? []) {
      if (!id(front.id) || this.fronts.has(front.id) || !point(front.position) || front.owner !== null && !this.factions.has(front.owner)) fail('fronts need unique ids, positions and a known owner or null');
      const normalized = { label: front.id, radius: 50, baseHP: 1000, captureThreshold: 30, reinforcementSource: false, ...front,
        sourceHP: front.sourceHP ?? front.baseHP ?? 1000, capture: {}, contested: false, lastReportAt: 0 };
      if (!number(normalized.radius, 5, 500) || !number(normalized.baseHP, 1, 1e6) || !number(normalized.captureThreshold, 1, 300) || !number(normalized.sourceHP, 0, 1e6)) fail('invalid front bounds or source health');
      this.fronts.set(front.id, normalized);
    }
    if (this.fronts.size < 2 || this.fronts.size > 64) fail('two to sixty-four fronts are supported');
    for (const route of this.config.routes ?? []) {
      if (!id(route.id) || this.routes.has(route.id) || route.from === route.to || !this.fronts.has(route.from) || !this.fronts.has(route.to) || !number(route.travelSeconds, 1, 3600)) fail('invalid route');
      const waypoints = route.waypoints ?? [this.fronts.get(route.from).position, this.fronts.get(route.to).position];
      if (!Array.isArray(waypoints) || waypoints.length < 2 || waypoints.length > 128 || !waypoints.every(point) || dist(waypoints[0], this.fronts.get(route.from).position) > .01 || dist(waypoints.at(-1), this.fronts.get(route.to).position) > .01) fail('route waypoints must follow the declared front endpoints');
      this.routes.set(route.id, { open: true, ...route, waypoints: waypoints.map(item => [...item]) });
    }
    const first = this.fronts.keys().next().value;
    if (this._path(first, [...this.fronts.keys()].at(-1), true) === null) fail('the initial front graph must be connected');
    for (const frontId of this.fronts.keys()) if (this._path(first, frontId, true) === null) fail('the initial front graph must be connected');
    for (const profile of this.config.profiles ?? []) {
      if (!id(profile.id) || this.profiles.has(profile.id) || !this.factions.size || !['yautja', 'xenomorph', 'human', 'synthetic'].includes(speciesOf(profile.species))) fail('invalid or duplicate unit profile');
      const normalized = { role: 'line', maxHp: 180, damage: 2, attackInterval: 5, fidelity: 'original', ...profile, species: speciesOf(profile.species) };
      if (!number(normalized.maxHp, 1, 1e5) || !number(normalized.damage, 0, 1e4) || !number(normalized.attackInterval, .25, 120)) fail('invalid profile combat values');
      this.profiles.set(profile.id, normalized);
    }
    for (const specification of this.config.groups ?? []) {
      if (!id(specification.id) || this.groups.has(specification.id) || !this.factions.has(specification.factionId) || !this.fronts.has(specification.frontId)) fail('invalid group identity, faction or front');
      if (!Array.isArray(specification.units) || !specification.units.length || specification.units.length > 64) fail('groups must contain one to sixty-four allocated units');
      const state = specification.state === 'active' ? 'distant' : specification.state ?? 'distant';
      if (!['distant', 'reserve'].includes(state)) fail('initial groups must be allocated to distant or reserve state');
      const group = { id: specification.id, label: specification.label ?? specification.id, factionId: specification.factionId,
        frontId: specification.frontId, reserveOriginId: specification.reserveOriginId ?? specification.frontId,
        position: [...(specification.position ?? this.fronts.get(specification.frontId).position)],
        units: [], morale: specification.morale ?? 70, state, path: [], travelProgress: 0, waypointIndex: 1, materialized: false,
        reportAge: 0, lastSeenAt: 0, reportPosition: [...(specification.position ?? this.fronts.get(specification.frontId).position)],
        order: { type: 'defend', frontId: specification.frontId, issuer: 'scenario' },
        formation: specification.formation ?? 'line', officerId: null, delegated: false, tactic: null, detailRetryAt: 0,
        coordinationStrength: 1, reconstitution: null, supportsReconstitutionOf: null, lastReinforcementArrival: null, reinforcementDestination: null };
      if (!point(group.position) || !number(group.morale, 0, 100) || !this.fronts.has(group.reserveOriginId)) fail('invalid group position, reserve origin or morale');
      for (let index = 0; index < specification.units.length; index++) {
        const spec = specification.units[index], profile = this.profiles.get(spec.profileId), faction = this.factions.get(group.factionId);
        if (!id(spec.id) || this.units.has(spec.id) || !profile) fail('unit ids must be unique and profiles must exist');
        this._checkProfile(profile, faction, spec);
        const uniqueId = spec.uniqueId ?? (profile.unique ? profile.id : null);
        if (uniqueId && (!id(uniqueId) || this.unique.has(uniqueId))) fail(`unique individual ${uniqueId} cannot be duplicated`);
        if (uniqueId) this.unique.set(uniqueId, spec.id);
        const officer = spec.officer === true || profile.role === 'officer';
        if (officer && group.officerId) fail(`group ${group.id} has more than one officer`);
        if (officer) group.officerId = spec.id;
        const angle = index / Math.max(1, specification.units.length) * Math.PI * 2;
        const position = spec.position ?? [group.position[0] + Math.cos(angle) * 3, group.position[1] + Math.sin(angle) * 3];
        if (!point(position)) fail('unit positions must be finite');
        const unit = { id: spec.id, profileId: profile.id, groupId: group.id, factionId: group.factionId,
          species: profile.species, role: officer ? 'officer' : profile.role, actorType: profile.actorType ?? profile.species,
          profileName: profile.name ?? profile.id, sourceBossId: profile.sourceBossId ?? null, sourceBossType: profile.sourceBossType ?? null, visualFidelity1to1Verified: profile.visualFidelity1to1Verified === true,
          officer, uniqueId, state, hp: profile.maxHp, maxHp: profile.maxHp, position: [...position],
          nextAttack: profile.attackInterval * (hash(spec.id) % 1000) / 1000, damageTaken: 0, incapacitated: false };
        // Two sealed field treatments for new Extinction Medic identities.
        // Existing source-v1 saves lacked this field and load with zero rather
        // than receiving free new supplies on every rematerialization.
        if (sourceUnitVisualKind(unit) === 'medic') unit.medicalSupply = 2;
        Object.assign(unit, initialSpecialistStocks(unit));
        this.units.set(unit.id, unit); this.attackSeeds.set(unit.id, hash(unit.id)); group.units.push(unit.id);
      }
      const heavy = group.units.filter(unitId => this.units.get(unitId).role === 'heavy').length;
      if (heavy > 1 && heavy > Math.ceil(group.units.length / 3) && specification.allowHeavyFormation !== true) fail('a normal group cannot consist only of heavy weapons');
      initializeFormation(group); group.revealedUntil = 0;
      this.groups.set(group.id, group);
    }
    if (!this.units.size || this.units.size > 4096) fail('allocate one to 4096 finite units');
    this.initialAllocated = this.units.size;
    for (const [factionId, faction] of this.factions) {
      const units = [...this.units.values()].filter(unit => unit.factionId === factionId), budget = this.budgets.byFaction?.[factionId];
      if (budget?.total !== undefined && budget.total !== units.length) fail(`faction ${factionId} total does not match allocated identities`);
      if (budget?.reserve !== undefined && budget.reserve !== units.filter(unit => unit.state === 'reserve').length) fail(`faction ${factionId} reserve allocation does not match`);
      if (budget?.active !== undefined && (!Number.isInteger(budget.active) || budget.active < 0 || budget.active > 512)) fail(`invalid detailed cap for ${factionId}`);
      faction.allocated = units.length;
    }
    this._validateObjectives();
    this.assertConservation();
  }

  _checkProfile(profile, faction, specification) {
    if (profile.excludedFromSpawn) fail(`profile ${profile.id} is excluded from spawning`);
    if (profile.species !== faction.species && !profile.allowedFactions?.includes(faction.id)) fail(`profile ${profile.id} does not belong to faction ${faction.id}`);
    const context = this.config.context ?? {};
    if (profile.allowedFactions?.length && !profile.allowedFactions.includes(faction.id)) fail(`profile ${profile.id} is forbidden for faction ${faction.id}`);
    if (this.config.mode !== 'crossover') {
      if (profile.allowedEras?.length && !profile.allowedEras.includes(String(context.era))) fail(`profile ${profile.id} is anachronistic for era ${context.era}`);
      if (profile.allowedWorks?.length && !profile.allowedWorks.some(work => context.works?.includes(work))) fail(`profile ${profile.id} is outside the operation's work`);
      if (profile.allowedContinuities?.length && !profile.allowedContinuities.some(work => context.continuities?.includes(work))) fail(`profile ${profile.id} is outside the operation's continuity`);
    }
    if (this.config.mode === 'reconstruction' && ['original', 'adaptation'].includes(profile.fidelity) && context.allowAdaptations !== true) fail(`profile ${profile.id} is an adaptation, not a verified reconstruction`);
    const cap = profile.spawnCap;
    if (cap !== undefined && (!Number.isInteger(cap) || cap < 0 || [...this.units.values()].filter(unit => unit.profileId === profile.id).length >= cap)) fail(`profile ${profile.id} exceeds its scenario cap`);
    if (specification.uniqueId && !id(specification.uniqueId)) fail('invalid named individual identity');
  }

  _validateObjectives() {
    const objectives = this.config.objectives ?? {};
    for (const key of ['captureFronts', 'loseFronts']) for (const frontId of objectives[key] ?? []) if (!this.fronts.has(frontId)) fail(`objective ${key} refers to unknown front ${frontId}`);
    for (const unitId of objectives.killCommanders ?? []) if (!this.units.get(unitId)?.officer) fail('commander objectives require an allocated officer');
    for (const groupId of objectives.evacuateGroups ?? []) if (!this.groups.has(groupId)) fail('evacuation objective refers to an unknown group');
    for (const strategy of objectives.strategies ?? []) {
      if (!id(strategy.id) || !Array.isArray(strategy.conditions) || !strategy.conditions.length) fail('victory strategies require explicit conditions');
      for (const condition of strategy.conditions) {
        if (!['capture', 'commander', 'evacuate', 'source_disabled'].includes(condition.type)) fail('unknown victory condition');
        if (['capture', 'source_disabled'].includes(condition.type) && !this.fronts.has(condition.frontId)) fail('victory strategy references an unknown front');
        if (condition.type === 'commander' && !this.units.get(condition.unitId)?.officer) fail('victory strategy requires an allocated commander');
        if (condition.type === 'evacuate' && !this.groups.has(condition.groupId)) fail('victory strategy requires an allocated group');
      }
    }
    if (objectives.defeatGraceSeconds !== undefined && !number(objectives.defeatGraceSeconds, 1, 7200)) fail('invalid strategic defeat grace');
    const window = objectives.defeatWindow;
    if (window && (window.version !== 1 || !number(window.sourceGraceSeconds, 1, 7200) || !number(window.playerSpeed, 1, 50) || !number(window.reactionSeconds, 0, 120) || !number(window.maneuverFactor, 1, 3) || !window.byFront || Object.entries(window.byFront).some(([frontId, item]) => !(objectives.loseFronts ?? []).includes(frontId) || !number(item.graceSeconds, window.sourceGraceSeconds, 7200) || !number(item.returnTravelSeconds, 0, item.graceSeconds) || !number(item.recaptureSeconds, 0, item.graceSeconds) || !number(item.longestRouteDistance, 0, 1e7) || !number(item.localApproachDistance, 0, 1000)))) fail('invalid physical return-window calibration');
    if (objectives.timeLimit !== undefined && !number(objectives.timeLimit, 1, 1e7)) fail('invalid operation time limit');
  }

  relationship(a, b) { return a === b ? 'allied' : this.relations.get(pair(a, b)) ?? 'neutral'; }
  areHostile(a, b) { return this.relationship(a, b) === 'hostile'; }
  setRelationship(a, b, state, reason = 'scenario') {
    if (this.disposed || this.result || !this.factions.has(a) || !this.factions.has(b) || a === b || !RELATIONS.has(state)) return false;
    if (this.relationship(a, b) === state) return false;
    this.relations.set(pair(a, b), state);
    this._emit('relations_changed', { a, b, state, reason }, 2);
    return true;
  }

  _emit(type, data = {}, priority = 1) {
    const event = { id: ++this.eventSequence, time: this.time, type, priority, ...clone(data) };
    this.events.push(event);
    if (this.events.length > 512) { this.events.shift(); this.eventsDropped++; }
    this.callbacks.announce?.(clone(event));
    return event;
  }

  _path(from, to, ignoreClosed = false) {
    if (from === to) return [];
    const queue = [{ node: from, path: [], cost: 0 }], visited = new Set();
    while (queue.length) {
      queue.sort((a, b) => a.cost - b.cost || a.node.localeCompare(b.node));
      const { node, path, cost } = queue.shift();
      if (visited.has(node)) continue;
      if (node === to) return path;
      visited.add(node);
      for (const route of this.routes.values()) {
        if (!ignoreClosed && !route.open) continue;
        const next = route.from === node ? route.to : route.to === node ? route.from : null;
        if (!next || visited.has(next)) continue;
        const result = [...path, { routeId: route.id, from: node, to: next }];
        queue.push({ node: next, path: result, cost: cost + route.travelSeconds });
      }
    }
    return null;
  }

  setRouteOpen(routeId, open, reason = 'terrain_changed') {
    const route = this.routes.get(routeId);
    if (!route || this.disposed || this.result || route.open === Boolean(open)) return false;
    if (open && this.routeAvailabilityProvider?.(clone(route)) === false) return false;
    route.open = Boolean(open); this.routeRevision++; this._emit('route_changed', { routeId, open: route.open, reason }, 2);
    for (const group of this.groups.values()) if (group.path.some(segment => segment.routeId === routeId) && !route.open) {
      // A group already between junctions holds its actual position when a
      // bridge closes. It does not jump back to its previous logical front.
      const inTransit = dist(group.position, this.fronts.get(group.frontId).position) > this.fronts.get(group.frontId).radius;
      const replacement = inTransit ? null : this._path(group.frontId, group.order.frontId);
      if (replacement) { group.path = replacement; group.travelProgress = 0; group.waypointIndex = dist(group.position, this.fronts.get(group.frontId).position) > EPSILON ? 0 : 1; }
      else this._emit('order_blocked', { groupId: group.id, frontId: group.order.frontId, reason: inTransit ? 'route_closed_in_transit' : 'no_open_route' }, 2);
    }
    return true;
  }

  issueOrder(groupId, specification = {}) {
    const group = this.groups.get(groupId), type = specification.type, target = specification.frontId ?? group?.frontId;
    if (!group || this.disposed || this.result || !ORDERS.has(type) || !this.fronts.has(target) || !group.units.some(unitId => alive(this.units.get(unitId)))) return { accepted: false, reason: 'invalid_group_or_order' };
    if (group.units.every(unitId => this.units.get(unitId).state === 'reserve' || !alive(this.units.get(unitId)))) return { accepted: false, reason: 'group_in_reserve' };
    if (group.path.length && !this.routes.get(group.path[0].routeId).open && dist(group.position, this.fronts.get(group.frontId).position) > this.fronts.get(group.frontId).radius) return { accepted: false, reason: 'route_closed_in_transit' };
    if (group.reconstitution?.required && !['retreat', 'regroup'].includes(type)) return { accepted: false, reason: 'reconstitution_required' };
    const path = this._path(group.frontId, target);
    if (!path) return { accepted: false, reason: 'no_open_route' };
    const issuer = specification.issuer ?? 'player1';
    if (!id(issuer)) return { accepted: false, reason: 'invalid_issuer' };
    // A newer accepted order replaces the previous one exactly once. Two local
    // players cannot accumulate competing paths that oscillate every frame.
    if (type === 'retreat' && !group.reconstitution?.required) {
      group.reconstitution = { required: true, startedAt: this.time, returnFrontId: group.order.frontId, returnOrderType: group.order.type, autoReturn: issuer === 'officer',
        recoverySeconds: 0, supportGroupId: null, nextSupportRequestAt: this.time, lastBlockedReason: null, readyAt: null };
      this._emit('group_reconstitution_required', { groupId: group.id, frontId: target, reason: 'retreat_requires_finite_reinforcement' }, 2);
    }
    group.order = { type, frontId: target, issuer, issuedAt: this.time, sequence: this.eventSequence + 1 };
    group.path = path; group.travelProgress = 0; group.waypointIndex = dist(group.position, this.fronts.get(group.frontId).position) > EPSILON ? 0 : 1;
    this.orders.set(group.id, clone(group.order));
    this._emit('group_order', { groupId, order: group.order, replaces: true });
    return { accepted: true, order: clone(group.order), path: clone(path) };
  }

  delegateFront(groupId, frontId, issuer = 'player1') {
    const group = this.groups.get(groupId);
    if (!group?.officerId || !combatReady(this.units.get(group.officerId))) return { accepted: false, reason: 'living_officer_required' };
    const answer = this.issueOrder(groupId, { type: 'defend', frontId, issuer });
    if (answer.accepted) { group.delegated = true; this._emit('front_delegated', { groupId, frontId, officerId: group.officerId }, 2); }
    return answer;
  }

  issueTactic(groupIds, { type, frontId, issuer = 'player1' } = {}) {
    if (!['pincer', 'hold_line', 'ambush', 'fallback'].includes(type) || !this.fronts.has(frontId) || !Array.isArray(groupIds) || !groupIds.length || groupIds.length > 8) return { accepted: false, reason: 'invalid_tactic' };
    const groups = [...new Set(groupIds)].map(groupId => this.groups.get(groupId));
    if (groups.some(group => !group || !group.units.some(unitId => alive(this.units.get(unitId)) && this.units.get(unitId).state !== 'reserve') || this.relationship(group.factionId, this.config.playerFaction) !== 'allied')) return { accepted: false, reason: 'allied_available_groups_required' };
    if (type !== 'fallback' && groups.some(group => group.reconstitution?.required)) return { accepted: false, reason: 'reconstitution_required' };
    if (type === 'pincer' && groups.length < 2) return { accepted: false, reason: 'two_groups_required' };
    if ((this.tacticCooldowns.get(type) ?? 0) > this.time) return { accepted: false, reason: 'tactic_cooling_down' };
    if (groups.some(group => this._path(group.frontId, frontId) === null || group.path.length && !this.routes.get(group.path[0].routeId).open)) return { accepted: false, reason: 'no_open_route' };
    this.tacticCooldowns.set(type, this.time + 30);
    groups.forEach((group, index) => {
      const orderType = { pincer: 'attack', hold_line: 'defend', ambush: 'defend', fallback: 'retreat' }[type];
      this.issueOrder(group.id, { type: orderType, frontId, issuer });
      group.formation = normalizeFormation(type === 'pincer' ? 'flank' : type === 'hold_line' ? 'line' : type === 'ambush' ? 'dispersed' : 'column');
      group.tactic = { type, expires: this.time + 20, flank: type === 'pincer' ? (index % 2 ? -1 : 1) : 0 };
    });
    this._emit('tactic_ordered', { type, frontId, groupIds: groups.map(group => group.id), expires: this.time + 20 }, 2);
    return { accepted: true, type, groups: groups.map(group => group.id), cooldownUntil: this.time + 30 };
  }

  _groupsByFront() {
    const index = new Map([...this.fronts.keys()].map(frontId => [frontId, []]));
    for (const group of this.groups.values()) index.get(group.frontId).push(group);
    return index;
  }

  _strategicOrders() {
    if (this.config.ai?.enabled === false || this.time + EPSILON < this.nextStrategicOrder) return;
    this.nextStrategicOrder = this.time + (this.config.ai?.interval ?? 20);
    const byFaction = new Map(), strength = new Map(), garrisons = new Map();
    for (const group of this.groups.values()) {
      const ready = group.units.filter(unitId => combatReady(this.units.get(unitId)) && this.units.get(unitId).state !== 'reserve').length;
      if (!ready || group.path.length) continue;
      if (!byFaction.has(group.factionId)) byFaction.set(group.factionId, []);
      byFaction.get(group.factionId).push(group);
      const key = `${group.factionId}:${group.frontId}`;
      strength.set(key, (strength.get(key) ?? 0) + ready); garrisons.set(key, (garrisons.get(key) ?? 0) + 1);
    }
    for (const faction of this.factions.values()) {
      const sporeFronts = faction.moraleModel === 'hive'
        ? new Set(this.getHiveSporeContacts(faction.id).map(contact => contact.frontId))
        : new Set();
      for (const group of byFaction.get(faction.id) ?? []) {
        if (group.materialized || group.reconstitution?.required || !group.officerId || !combatReady(this.units.get(group.officerId))) continue;
        const alliedToPlayer = this.relationship(faction.id, this.config.playerFaction) === 'allied';
        if (alliedToPlayer && !group.delegated || faction.moraleModel !== 'hive' && group.morale < 35) continue;
        const garrison = (garrisons.get(`${faction.id}:${group.frontId}`) ?? 1) - 1;
        if (this.fronts.get(group.frontId).owner === faction.id && garrison < (this.config.ai?.minimumGarrisonGroups ?? 1)) continue;
        const attackers = group.units.filter(unitId => combatReady(this.units.get(unitId))).length;
        const defenders = front => [...this.factions.keys()].filter(id => this.areHostile(faction.id, id)).reduce((sum, id) => sum + (strength.get(`${id}:${front.id}`) ?? 0), 0);
        const neighbours = [...this.routes.values()].filter(route => route.open && [route.from, route.to].includes(group.frontId)).map(route => this.fronts.get(route.from === group.frontId ? route.to : route.from));
        const target = neighbours.filter(front => (front.owner === null || this.areHostile(faction.id, front.owner)) && attackers >= defenders(front) * (this.config.ai?.assaultMinRatio ?? 0)).sort((a, b) => {
          const sporePriority = Number(sporeFronts.has(b.id)) - Number(sporeFronts.has(a.id));
          if (sporePriority) return sporePriority;
          if (this.config.ai?.targetPreference === 'supply') {
            const supply = Number(b.reinforcementSource && b.sourceHP > 0) - Number(a.reinforcementSource && a.sourceHP > 0);
            if (supply) return supply;
          }
          return defenders(a) - defenders(b) || a.id.localeCompare(b.id);
        })[0];
        if (target) {
          const answer = this.issueOrder(group.id, { type: 'attack', frontId: target.id, issuer: 'officer' });
          if (answer.accepted) this._emit('officer_decision', { groupId: group.id, from: group.frontId, target: target.id,
            reason: sporeFronts.has(target.id) ? 'spore_tracked_hostile_front'
              : this.config.ai?.targetPreference === 'supply' && target.reinforcementSource
              ? 'open_supply_front' : 'open_hostile_front',
            difficultyId: this.config.difficulty?.id ?? 'scenario' }, 1);
          break;
        }
      }
    }
  }

  _moveGroups(dt) {
    for (const group of this.groups.values()) {
      if (group.rootUntil > this.time) continue;
      if (!group.path.length || !group.units.some(unitId => combatReady(this.units.get(unitId)) && this.units.get(unitId).state !== 'reserve')) continue;
      const segment = group.path[0], route = this.routes.get(segment.routeId), target = this.fronts.get(segment.to);
      const waypoints = segment.from === route.from ? route.waypoints : [...route.waypoints].reverse();
      if (!route.open) continue;
      if (group.materialized && this.callbacks.spawnGroup) {
        const live = group.units.map(unitId => this.units.get(unitId)).filter(unit => combatReady(unit) && unit.state === 'active');
        if (live.length) group.position = [live.reduce((sum, unit) => sum + unit.position[0], 0) / live.length, live.reduce((sum, unit) => sum + unit.position[1], 0) / live.length];
        const waypoint = waypoints[group.waypointIndex] ?? target.position;
        if (dist(group.position, waypoint) > Math.max(4, Math.min(8, target.radius * .2))) continue;
        if (group.waypointIndex < waypoints.length - 1) { group.waypointIndex++; continue; }
      } else {
        let routeLength = 0; for (let index = 1; index < waypoints.length; index++) routeLength += dist(waypoints[index - 1], waypoints[index]);
        let distanceBudget = routeLength / route.travelSeconds * dt;
        while (distanceBudget > EPSILON && group.waypointIndex < waypoints.length) {
          const waypoint = waypoints[group.waypointIndex], remaining = dist(group.position, waypoint), amount = Math.min(1, distanceBudget / Math.max(remaining, EPSILON));
          const next = [group.position[0] + (waypoint[0] - group.position[0]) * amount, group.position[1] + (waypoint[1] - group.position[1]) * amount];
          const shift = [next[0] - group.position[0], next[1] - group.position[1]];
          group.position = next; distanceBudget -= remaining * amount;
          for (const unitId of group.units) { const unit = this.units.get(unitId); if (combatReady(unit) && unit.state !== 'reserve') { unit.position[0] += shift[0]; unit.position[1] += shift[1]; } }
          if (remaining <= EPSILON || amount >= 1) group.waypointIndex++;
          else break;
        }
        group.travelProgress = Math.min(1, group.travelProgress + dt / route.travelSeconds);
        if (dist(group.position, target.position) > EPSILON) continue;
      }
      group.frontId = segment.to; group.path.shift(); group.travelProgress = 0; group.waypointIndex = 1;
      this._emit('group_arrived', { groupId: group.id, frontId: group.frontId });
      if (group.order.type === 'retreat' && !group.path.length) { group.order.type = 'regroup'; group.morale = Math.min(100, group.morale + 10); }
      if (!group.path.length) {
        if (group.reinforcementDestination === group.frontId) { group.lastReinforcementArrival = this.time; group.reinforcementDestination = null; }
        this._markReconstitutionSupport(group);
      }
    }
  }

  _detailStep() {
    const activeFronts = new Set();
    for (const player of this.players) if (player.hp > 0) for (const front of this.fronts.values()) if (dist(player.position, front.position) <= front.radius * 1.5) activeFronts.add(front.id);
    const livingPlayers = this.players.filter(player => player.hp > 0);
    const knownWounded = unit => unit.incapacitated && this.relationship(unit.factionId, this.config.playerFaction) === 'allied';
    const woundedDistance = group => Math.min(...livingPlayers.flatMap(player => group.units.map(unitId => this.units.get(unitId)).filter(unit => alive(unit) && knownWounded(unit)).map(unit => dist(unit.position, player.position))));
    const distanceToPlayers = group => Math.min(woundedDistance(group), ...livingPlayers.map(player => dist(group.position, player.position)));
    const nearby = [...this.groups.values()].filter(group => (activeFronts.has(group.frontId) || woundedDistance(group) <= 65) && group.units.some(unitId => alive(this.units.get(unitId)) && this.units.get(unitId).state !== 'reserve'));
    nearby.sort((a, b) => Number(Boolean(b.officerId)) - Number(Boolean(a.officerId)) || distanceToPlayers(a) - distanceToPlayers(b) || a.id.localeCompare(b.id));
    const buckets = new Map();
    for (const group of nearby) { const key = `${group.frontId}:${group.factionId}`; if (!buckets.has(key)) buckets.set(key, []); buckets.get(key).push(group); }
    const candidates = [];
    while ([...buckets.values()].some(bucket => bucket.length)) for (const bucket of buckets.values()) if (bucket.length) candidates.push(bucket.shift());
    const selected = new Set(), perFaction = new Map(); let count = 0;
    for (const group of candidates) {
      const units = group.units.map(unitId => this.units.get(unitId)).filter(unit => alive(unit) && unit.state !== 'reserve');
      const limit = this.budgets.byFaction?.[group.factionId]?.active ?? this.budgets.active;
      if (count + units.length > this.budgets.active || (perFaction.get(group.factionId) ?? 0) + units.length > limit) continue;
      // New materializations never appear already inside either living player.
      // Existing detailed actors are not demoted merely because combat closes.
      const returningWoundedAllies = this.relationship(group.factionId, this.config.playerFaction) === 'allied' && units.some(knownWounded);
      if (!group.materialized && (group.detailRetryAt > this.time || !returningWoundedAllies && units.some(unit => this.players.some(player => player.hp > 0 && dist(unit.position, player.position) < this.budgets.spawnDistance)))) continue;
      selected.add(group.id); count += units.length; perFaction.set(group.factionId, (perFaction.get(group.factionId) ?? 0) + units.length);
    }
    for (const group of this.groups.values()) if (group.materialized && !selected.has(group.id)) this._dematerialize(group);
    for (const group of candidates) if (selected.has(group.id) && !group.materialized) {
      const units = group.units.map(unitId => this.units.get(unitId)).filter(unit => alive(unit) && unit.state === 'distant');
      let accepted;
      try { accepted = this.callbacks.spawnGroup?.(this._groupSnapshot(group), units.map(clone)); }
      catch (error) {
        group.detailRetryAt = this.time + 3;
        this._emit('materialization_unavailable', { groupId: group.id, retryAt: group.detailRetryAt, reason: String(error?.message ?? 'actor pool unavailable').slice(0, 160) }, 2);
        continue;
      }
      if (accepted === false) { group.detailRetryAt = this.time + 3; continue; }
      group.materialized = true;
      for (const unit of units) unit.state = 'active';
      group.state = 'active'; this._emit('group_materialized', { groupId: group.id, count: units.length });
    }
    for (const group of this.groups.values()) if (activeFronts.has(group.frontId)) { group.lastSeenAt = this.time; group.reportAge = 0; group.reportPosition = [...group.position]; this.fronts.get(group.frontId).lastReportAt = this.time; }
  }

  _dematerialize(group) {
    const units = group.units.map(unitId => this.units.get(unitId)).filter(unit => alive(unit) && unit.state === 'active');
    const synchronized = this.callbacks.despawnGroup?.(this._groupSnapshot(group), units.map(clone)) ?? [];
    if (Array.isArray(synchronized)) for (const item of synchronized) this.syncUnit(item.id, item);
    for (const unit of units) if (alive(unit)) unit.state = 'distant';
    group.materialized = false; group.state = 'distant';
    this._emit('group_dematerialized', { groupId: group.id, count: units.filter(alive).length });
  }

  releaseGroupDetail(groupId, reason = 'actor_unavailable') {
    const group = this.groups.get(groupId);
    if (!group?.materialized || this.disposed) return false;
    this._dematerialize(group); group.detailRetryAt = this.time + 3;
    this._emit('group_detail_unavailable', { groupId, reason: String(reason).slice(0, 120), retryAt: group.detailRetryAt }, 2);
    return true;
  }

  setFormation(groupId, formation, issuer = 'player') {
    const group = this.groups.get(groupId);
    if (!group || this.disposed || this.result || !Object.hasOwn(FORMATION_PROFILES, formation) || !id(issuer) || !group.units.some(unitId => alive(this.units.get(unitId)))) return { accepted: false, reason: 'invalid_formation_or_group' };
    group.formation = normalizeFormation(formation); this._emit('formation_changed', { groupId, formation: group.formation, issuer }, 1);
    return { accepted: true, formation: group.formation };
  }

  revealGroup(groupId, { duration = 20, source = 'scout' } = {}) {
    const group = this.groups.get(groupId);
    if (!group || this.disposed || this.result || this.paused || !number(duration, .25, 120) || !id(source)) return false;
    group.revealedUntil = Math.max(group.revealedUntil ?? 0, this.time + duration); this.intel?.revealGroup(groupId);
    this._emit('group_revealed', { groupId, source, expires: group.revealedUntil }, 1); return true;
  }

  syncUnit(unitId, state = {}) {
    const unit = this.units.get(unitId);
    if (!unit || this.disposed || this.result || !alive(unit)) return false;
    let encounterState;
    if (state.encounterState !== undefined) {
      if (unit.actorType !== 'queen' || !unit.sourceBossType) return false;
      try { encounterState = validateBossCombatState(state.encounterState, { bossType: unit.sourceBossType, battleUnitId: unit.id, maxHp: unit.maxHp }); }
      catch { return false; }
    }
    if (state.position !== undefined) { if (!point(state.position)) return false; unit.position = [...state.position]; }
    if (state.hp !== undefined) {
      if (!number(state.hp, 0, unit.maxHp)) return false;
      unit.hp = state.hp;
      if (!unit.hp) return this.recordDeath({ entityId: unit.id, cause: 'synchronized_actor_death' });
    }
    if (encounterState !== undefined) unit.encounterState = encounterState;
    return true;
  }

  /** One allocated Facehugger can immobilize one susceptible allocated host.
   * The parasite is consumed in the existing death ledger, not respawned. */
  beginHostInfestation(facehuggerId, hostId) {
    return infectHost(this, facehuggerId, hostId);
  }

  _hostInfestationStep() {
    return completeHostInfections(this);
  }

  /** Medical charges live on the finite strategic identity, not its renderer.
   * A healer cannot revive dead/downed soldiers, cure synthetic circuitry,
   * heal across a distant front or restock by leaving camera range. */
  applyMedicHeal(medicId, patientId) {
    const medic = this.units.get(medicId), patient = this.units.get(patientId);
    if (this.disposed || this.paused || this.result || !medic || !patient || medicId === patientId ||
        sourceUnitVisualKind(medic) !== 'medic' || !Number.isInteger(medic.medicalSupply) || medic.medicalSupply <= 0 ||
        medic.state !== 'active' || patient.state !== 'active' || medic.incapacitated || patient.incapacitated ||
        medic.factionId !== patient.factionId || medic.species !== 'human' || patient.species !== 'human' ||
        medic.hp <= 0 || patient.hp <= 0 || patient.hp >= patient.maxHp ||
        dist(medic.position, patient.position) > 10) return null;
    const amount = Math.min(90, patient.maxHp - patient.hp);
    if (!(amount > 0)) return null;
    medic.medicalSupply--;
    patient.hp += amount;
    this._emit('field_medic_treatment', { medicId, patientId, amount, chargesRemaining: medic.medicalSupply }, 1);
    return { amount, hp: patient.hp, chargesRemaining: medic.medicalSupply };
  }

  /** A fired shot consumes the exact specialist's stored ammunition once,
   * independent of renderer lifetime and without changing unit IDs or budgets. */
  consumeSpecialistAmmo(unitId, role) {
    const unit = this.units.get(unitId), field = role === 'sniper' ? 'sniperRounds' : role === 'sadar' ? 'sadarMissiles' : null;
    if (!field || this.disposed || this.paused || this.result || !unit ||
        sourceSpecialistRole(unit) !== role || unit.state !== 'active' || unit.incapacitated ||
        unit.hp <= 0 || !Number.isInteger(unit[field]) || unit[field] <= 0) return null;
    unit[field]--;
    this._emit('specialist_round_fired', { unitId, role, roundsRemaining: unit[field] }, 0);
    return { unitId, role, roundsRemaining: unit[field] };
  }

  /** CommTech repairs existing mechanics: never civilians, dead units,
   * distant units or a new synthetic. Supplies are a project adaptation. */
  applyCommTechRepair(commTechId, targetId) {
    const tech = this.units.get(commTechId), target = this.units.get(targetId);
    if (this.disposed || this.paused || this.result || !tech || !target ||
        commTechId === targetId || sourceSpecialistRole(tech) !== 'commtech' ||
        !Number.isInteger(tech.repairParts) || tech.repairParts <= 0 ||
        tech.state !== 'active' || target.state !== 'active' || tech.incapacitated ||
        target.incapacitated || tech.hp <= 0 || target.hp <= 0 ||
        tech.factionId !== target.factionId || tech.species !== 'human' ||
        target.hp >= target.maxHp || dist(tech.position, target.position) > 8 ||
        !(target.species === 'synthetic' || sourceSpecialistRole(target) === 'exosuit')) return null;
    const amount = Math.min(100, target.maxHp - target.hp);
    if (!(amount > 0)) return null;
    tech.repairParts--;
    target.hp += amount;
    this._emit('field_technical_repair', {
      technicianId: commTechId, targetId, amount, partsRemaining: tech.repairParts
    }, 1);
    return { amount, hp: target.hp, partsRemaining: tech.repairParts };
  }

  /** Plating is a finite armor buffer for the single Exosuit+pilot unit.
   * Both close-combat and NPC damage paths call this before subtracting HP. */
  absorbExosuitDamage(unitId, damage) {
    const unit = this.units.get(unitId);
    if (!Number.isFinite(damage) || damage <= 0 || !unit ||
        this.disposed || this.result || !['active', 'distant'].includes(unit.state) || unit.hp <= 0 ||
        sourceSpecialistRole(unit) !== 'exosuit' ||
        !Number.isInteger(unit.exosuitArmor) || unit.exosuitArmor <= 0) return damage;
    const absorbed = Math.min(unit.exosuitArmor, Math.floor(damage * 0.5));
    unit.exosuitArmor -= absorbed;
    return damage - absorbed;
  }

  setUnitIncapacitated(unitId, incapacitated) {
    const unit = this.units.get(unitId);
    if (!unit || this.disposed || this.result || !alive(unit) || !['active', 'distant'].includes(unit.state) || typeof incapacitated !== 'boolean') return false;
    if (unit.incapacitated === incapacitated) return false;
    unit.incapacitated = incapacitated;
    this._emit(incapacitated ? 'unit_incapacitated' : 'unit_recovered', { unitId, groupId: unit.groupId, frontId: this.groups.get(unit.groupId).frontId }, 2);
    return true;
  }

  recordDeath(event = {}) {
    const unit = this.units.get(event.entityId ?? event.unitId);
    if (!unit || this.disposed || this.result || this.deaths.has(unit.id) || ['evacuated', 'captured'].includes(unit.state)) return false;
    unit.hp = 0; unit.state = 'dead'; unit.incapacitated = false;
    delete unit.encounterState; delete unit.infection;
    const killerFaction = this.factions.has(event.killerFaction) ? event.killerFaction : null;
    const death = { entityId: unit.id, groupId: unit.groupId, factionId: unit.factionId, killerFaction,
      cause: typeof event.cause === 'string' ? event.cause.slice(0, 80) : 'combat', time: this.time, officer: unit.officer, uniqueId: unit.uniqueId };
    this.deaths.set(unit.id, death); this._emit('unit_died', death, unit.officer ? 3 : 0);
    if (awardHiveInfestation(this.hiveEcology, killerFaction, unit.factionId,
      killerFaction && this.areHostile(killerFaction, unit.factionId))) {
      this._emit('hive_infestation_gained', { factionId: killerFaction, sourceUnitId: unit.id }, 0);
    }
    const group = this.groups.get(unit.groupId), faction = this.factions.get(unit.factionId);
    if (faction.moraleModel !== 'hive') this._changeMorale(group, unit.officer ? -25 : -2, unit.officer ? 'officer_lost' : 'casualty');
    else if (unit.officer) { group.coordinationStrength = .65; this._emit('hive_coordination_disrupted', { factionId: unit.factionId, frontId: group.frontId, groupId: group.id, coordinationStrength: .65, reason: 'allocated_controller_lost' }, 2); }
    if (unit.officer) for (const neighbour of this.groups.values()) if (neighbour.id !== group.id && neighbour.factionId === unit.factionId && neighbour.frontId === group.frontId && faction.moraleModel !== 'hive') this._changeMorale(neighbour, -8, 'nearby_officer_lost');
    // Musou action consequence: a genuinely defeated enemy officer lifts
    // local allied morale. Zero new soldiers, reserve or extra kill credit.
    applyMusouOfficerBreak(this, death);
    return true;
  }

  /** Hive nodes belong to the strategic simulation, even if their meshes
   * disappear. A damaged/destroyed node never returns its spent infestation. */
  damageHiveNode(nodeId, damage, sourceFaction) {
    if (this.disposed || this.paused || this.result || !this.factions.has(sourceFaction)) return null;
    const node = this.hiveEcology.nodes.find(item => item.id === nodeId);
    if (!node) return null;
    const result = damageEcologyNode(this.hiveEcology, nodeId, damage,
      this.areHostile(sourceFaction, node.factionId));
    if (result?.destroyed) this._emit('hive_node_destroyed', {
      nodeId, factionId: node.factionId, killerFaction: sourceFaction
    }, 2);
    return result;
  }

  getHiveNodeState({ nodesOnly = false } = {}) {
    if (nodesOnly) return { nodes: this.hiveEcology.nodes.map(node =>
      ({...node, position: [...node.position]})) };
    return snapshotHiveEcology(this.hiveEcology);
  }

  /** Tactical knowledge belongs only to the sensing Hive. The Yautja player
   * does not receive these contacts as its own reconnaissance reports. */
  getHiveSporeContacts(factionId) {
    return getHiveSporeContacts(this.hiveEcology, factionId, this.time);
  }

  _hiveNodeStep(dt) {
    if (!this.hiveEcology.banks.length) return;
    const created = buildHiveNode(this.hiveEcology, this.units.values(), this.time);
    if (created) this._emit('hive_node_constructed', {
      nodeId: created.id, builderId: created.builderId, factionId: created.factionId
    }, 2);
    healHiveSpace(this.hiveEcology, this.units.values(), dt, info => {
      // Detailed actors and distant state must see the same current HP.
      this.callbacks.healBattleUnit?.(info.unitId, info.hp);
    });
    // Outside their own Hive-space, allocated Facehuggers gradually weaken.
    // Damage is owned by this exact identity, not by LOD or renderer state.
    // A fatal exposure consumes a real life; it never triggers free spawning.
    const exposed = applyFacehuggerExposure(this.hiveEcology, this.units.values(),
      dt, HIVE_NODE_RULES.radius);
    for (const loss of exposed) {
      this.callbacks.healBattleUnit?.(loss.unitId, loss.hp);
      if (loss.expired) this.recordDeath({ entityId: loss.unitId,
        cause: 'facehugger_outside_hive_space', killerFaction: null });
    }
    // Sample at most once per simulated second, not once per rendered frame.
    // Last-seen coordinates expire even if the enemy is no longer visible.
    if (this.tick % HIVE_SPORE_RULES.sampleEveryTicks === 0) {
      updateHiveSporeSight(this.hiveEcology, this.units.values(), this.groups,
        this.fronts, (a,b) => this.areHostile(a,b), this.time);
    }
  }

  _changeMorale(group, amount, reason) {
    const before = group.morale; group.morale = Math.max(0, Math.min(100, before + amount));
    if (Math.abs(group.morale - before) > EPSILON) this._emit('morale_changed', { groupId: group.id, frontId: group.frontId, before, after: group.morale, reason });
  }

  _remoteCombat() {
    const pending = new Map(), pendingNodes = new Map(), frontGroups = this._groupsByFront();
    const coordination = new Map([...this.factions.values()].map(faction => [faction.id, faction.moraleModel === 'hive' && !this._sourcesFor(faction.id).length ? .65 : 1]));
    this.targetingCounters = { groupVisits: this.groups.size, attackerVisits: 0, targetCandidateEntries: 0, attacksResolved: 0 };
    for (const front of this.fronts.values()) {
      const byFaction = new Map();
      for (const group of frontGroups.get(front.id)) {
        if (group.path.length || dist(group.position, front.position) > front.radius || group.order.type === 'retreat') continue;
        for (const unitId of group.units) {
          const unit = this.units.get(unitId);
          if (alive(unit) && unit.state === 'distant' && (!unit.incapacitated || dist(unit.position, front.position) <= front.radius)) {
            if (!byFaction.has(unit.factionId)) byFaction.set(unit.factionId, []);
            byFaction.get(unit.factionId).push(unit);
          }
        }
      }
      for (const [factionId, attackers] of byFaction) {
        const targets = [...byFaction].filter(([targetFaction]) => this.areHostile(factionId, targetFaction)).flatMap(([, units]) => units);
        // Nodes are valid strategic targets only after the local hostile
        // soldiers have been cleared. This keeps each existing shooter on
        // ONE attack budget per tick (soldier OR structure, never both).
        // An offscreen node may still be defended by active physical actors.
        const nodes = !targets.length ? this.hiveEcology.nodes.filter(node =>
          this.areHostile(factionId, node.factionId) &&
          dist(node.position, front.position) <= front.radius) : [];
        this.targetingCounters.targetCandidateEntries += targets.length + nodes.length;
        if (!targets.length && !nodes.length) continue;
        for (const attacker of attackers) {
          this.targetingCounters.attackerVisits++;
          if (!combatReady(attacker)) continue;
          const profile = this.profiles.get(attacker.profileId), group = this.groups.get(attacker.groupId), faction = this.factions.get(factionId);
          if (group.reconstitution?.required || ['retreat', 'regroup'].includes(group.order.type) || attacker.nextAttack > this.time + EPSILON || profile.damage <= 0) continue;
          const nodeTarget = targets.length ? null : nodes
            .filter(node => (pendingNodes.get(node.id)?.attackers ?? 0) < 4 &&
              dist(attacker.position, node.position) <= Math.min(24,
              SPECIALIST_ATTACKS[sourceSpecialistRole(attacker)]?.range ?? 20))
            .sort((a, b) => dist(attacker.position, a.position) - dist(attacker.position, b.position) ||
              a.id.localeCompare(b.id))[0];
          if (!targets.length && !nodeTarget) continue;
          const role = sourceSpecialistRole(attacker), rule = SPECIALIST_ATTACKS[role];
          const ammunition = role === 'sniper' ? 'sniperRounds' : role === 'sadar' ? 'sadarMissiles' : null;
          // The distant front cannot fire unlimited specialist weapons just
          // because the physical model is not currently materialized.
          if (ammunition) {
            if (!Number.isInteger(attacker[ammunition]) || attacker[ammunition] <= 0) continue;
            attacker[ammunition]--;
          }
          attacker.nextAttack = this.time + Math.max(profile.attackInterval, rule?.cooldown ?? 0);
          const target = nodeTarget ?? targets[(this.attackSeeds.get(attacker.id) + this.tick) % targets.length];
          const tacticMultiplier = group.tactic && group.tactic.expires > this.time ? { pincer: 1.2, hold_line: 1.05, ambush: 1.15, fallback: .5 }[group.tactic.type] ?? 1 : 1;
          const orderMultiplier = ({ attack: 1, defend: .85, escort: .6 }[group.order.type] ?? .85) * tacticMultiplier;
          const moraleMultiplier = faction.moraleModel === 'hive' ? coordination.get(factionId) * group.coordinationStrength : .5 + group.morale / 200;
          const queue = nodeTarget ? pendingNodes : pending;
          if (!queue.has(target.id)) queue.set(target.id, { damage: 0, killerFaction: factionId,
            attackers: 0 });
          queue.get(target.id).damage += (rule?.damage ?? profile.damage) * orderMultiplier * moraleMultiplier * formationAttackMultiplier(group, this.time);
          if (nodeTarget) queue.get(target.id).attackers++;
          this.targetingCounters.attacksResolved++;
        }
      }
    }
    for (const [unitId, hit] of pending) {
      const unit = this.units.get(unitId);
      const actual = this.absorbExosuitDamage(unitId, hit.damage);
      unit.hp = Math.max(0, unit.hp - actual); unit.damageTaken += actual;
      if (!unit.hp) this.recordDeath({ entityId: unitId, killerFaction: hit.killerFaction, cause: 'distant_combat' });
    }
    // The node owner (not the 3D proxy) authoritatively applies the remote hit.
    // No new soldier, no additional shot, no death event/infestation credit.
    for (const [nodeId, hit] of pendingNodes) {
      // A garrison may only engage one node with four remote attackers per
      // strategic tick, and this hard damage cap prevents 100 distant soldiers
      // from deleting a newly rendered structure in the same 250 ms step.
      this.damageHiveNode(nodeId, Math.min(32, hit.damage), hit.killerFaction);
    }
  }

  getTargetingCounters() { return { ...this.targetingCounters, scope: 'last fixed strategic tick; operation counts, not hardware frame time' }; }

  _sourcesFor(factionId) { return [...this.fronts.values()].filter(front => front.reinforcementSource && front.sourceHP > 0 && front.owner === factionId); }

  requestReinforcements(factionId, targetFrontId, groupId = null) {
    if (this.disposed || this.result || !this.factions.has(factionId) || !this.fronts.has(targetFrontId)) return { accepted: false, reason: 'invalid_faction_or_front' };
    const available = (groupId ? [this.groups.get(groupId)] : [...this.groups.values()]).filter(candidate => candidate?.factionId === factionId && !this.pendingArrivals.some(arrival => arrival.groupId === candidate.id) && candidate.units.some(unitId => this.units.get(unitId).state === 'reserve'));
    if (!available.length) return { accepted: false, reason: 'reserve_exhausted_or_already_inbound' };
    const sources = this._sourcesFor(factionId);
    const group = available.find(candidate => sources.some(source => source.id === candidate.reserveOriginId && this._path(source.id, targetFrontId) !== null));
    if (!group) return { accepted: false, reason: 'no_connected_supply_source' };
    const units = group.units.map(unitId => this.units.get(unitId)).filter(unit => unit.state === 'reserve' && alive(unit));
    if (!units.length || units.length > this.budgets.arrivalsPerTick) return { accepted: false, reason: units.length ? 'arrival_group_exceeds_budget' : 'reserve_exhausted_or_already_inbound' };
    const source = this.fronts.get(group.reserveOriginId);
    const arrival = { groupId: group.id, factionId, sourceId: source.id, frontId: targetFrontId, due: this.time + this.budgets.announcementSeconds };
    this.pendingArrivals.push(arrival); this._emit('reinforcements_inbound', { ...arrival, count: units.length }, 2);
    return { accepted: true, ...clone(arrival), count: units.length };
  }

  _reinforcements() {
    for (const arrival of [...this.pendingArrivals]) {
      if (arrival.due > this.time + EPSILON) continue;
      this.pendingArrivals.splice(this.pendingArrivals.indexOf(arrival), 1);
      const source = this.fronts.get(arrival.sourceId), group = this.groups.get(arrival.groupId);
      if (!source.reinforcementSource || !source.sourceHP || source.owner !== arrival.factionId || this._path(source.id, arrival.frontId) === null) {
        this._emit('reinforcements_cancelled', { groupId: group.id, sourceId: source.id, reason: 'source_or_route_lost' }, 2); continue;
      }
      group.frontId = source.id; group.state = 'distant'; group.reinforcementDestination = arrival.frontId;
      for (const unitId of group.units) { const unit = this.units.get(unitId); if (unit.state === 'reserve' && alive(unit)) unit.state = 'distant'; }
      this.issueOrder(group.id, { type: 'attack', frontId: arrival.frontId, issuer: 'scenario' });
      if (arrival.supportForGroupId) group.supportsReconstitutionOf = arrival.supportForGroupId;
      if (!group.path.length) { group.lastReinforcementArrival = this.time; group.reinforcementDestination = null; this._markReconstitutionSupport(group); }
      this._emit('reinforcements_arrived', { groupId: group.id, sourceId: source.id, targetFrontId: arrival.frontId }, 2);
    }
    for (const factionId of this.factions.keys()) {
      if (this.time + EPSILON < this.nextReinforcement.get(factionId)) continue;
      this.nextReinforcement.set(factionId, this.time + this.budgets.spawnInterval);
      const target = [...this.fronts.values()].filter(front => front.owner === factionId || [...this.groups.values()].some(group => group.factionId === factionId && group.frontId === front.id && group.units.some(unitId => alive(this.units.get(unitId)) && this.units.get(unitId).state !== 'reserve'))).sort((a, b) => {
        const strength = front => [...this.units.values()].filter(unit => alive(unit) && unit.state !== 'reserve' && unit.factionId === factionId && this.groups.get(unit.groupId).frontId === front.id).length;
        return strength(a) - strength(b) || a.id.localeCompare(b.id);
      })[0];
      if (target) this.requestReinforcements(factionId, target.id);
    }
  }

  damageSource(frontId, damage, cause = 'sabotage') {
    const front = this.fronts.get(frontId);
    if (!front || this.disposed || this.result || !number(damage, 0, 1e6) || !front.reinforcementSource || !front.sourceHP) return false;
    front.sourceHP = Math.max(0, front.sourceHP - damage);
    this._emit(front.sourceHP ? 'source_damaged' : 'source_disabled', { frontId, remainingHP: front.sourceHP, cause }, front.sourceHP ? 1 : 3);
    return true;
  }

  captureBase(frontId, factionId, reason = 'capture') {
    const front = this.fronts.get(frontId);
    if (!front || !this.factions.has(factionId) || this.disposed || this.result || front.owner === factionId) return false;
    const previous = front.owner; front.owner = factionId; front.capture = {}; front.lastReportAt = this.time;
    this._emit('base_captured', { frontId, previousOwner: previous, owner: factionId, reason }, 3);
    for (const group of this.groups.values()) if (group.frontId === frontId && this.factions.get(group.factionId).moraleModel !== 'hive') this._changeMorale(group, group.factionId === factionId ? 12 : group.factionId === previous ? -18 : 0, 'base_ownership_changed');
    this.callbacks.objective?.({ type: 'base_captured', frontId, owner: factionId, previousOwner: previous, time: this.time });
    return true;
  }

  _captureStep(dt) {
    const frontGroups = this._groupsByFront();
    for (const front of this.fronts.values()) {
      const strength = new Map(), coordination = new Map(), bodies = new Map();
      for (const group of frontGroups.get(front.id)) if (!group.path.length && dist(group.position, front.position) <= front.radius && group.order.type !== 'retreat' && !group.reconstitution?.required) {
        const count = group.units.reduce((sum, unitId) => sum + Number(combatReady(this.units.get(unitId)) && ['active', 'distant'].includes(this.units.get(unitId).state)), 0);
        if (!count) continue;
        const multiplier = this.factions.get(group.factionId).moraleModel === 'hive' ? group.coordinationStrength : 1;
        strength.set(group.factionId, (strength.get(group.factionId) ?? 0) + count * multiplier);
        coordination.set(group.factionId, (coordination.get(group.factionId) ?? 0) + count * multiplier);
        bodies.set(group.factionId, (bodies.get(group.factionId) ?? 0) + count);
      }
      for (const player of this.players) if (player.hp > 0 && dist(player.position, front.position) <= front.radius * .7) {
        const faction = this.config.playerFaction; strength.set(faction, (strength.get(faction) ?? 0) + 2);
        coordination.set(faction, (coordination.get(faction) ?? 0) + 2); bodies.set(faction, (bodies.get(faction) ?? 0) + 2);
      }
      const present = [...strength.keys()];
      front.contested = present.some(a => present.some(b => this.areHostile(a, b)));
      if (front.contested || !present.length) continue;
      const candidates = present.filter(factionId => factionId !== front.owner && (front.owner === null || this.areHostile(factionId, front.owner)));
      if (!candidates.length) continue;
      const contender = candidates.sort((a, b) => strength.get(b) - strength.get(a) || a.localeCompare(b))[0];
      front.capture[contender] = (front.capture[contender] ?? 0) + dt * coordination.get(contender) / bodies.get(contender);
      if (front.capture[contender] + EPSILON >= front.captureThreshold) this.captureBase(front.id, contender, 'unopposed_presence');
    }
  }

  requestReconstitutionSupport(groupId) {
    const group = this.groups.get(groupId), recovery = group?.reconstitution;
    if (!recovery?.required || group.path.length || group.order.type !== 'regroup') return { accepted: false, reason: 'regroup_at_destination_required' };
    const existing = recovery.supportGroupId && this.groups.get(recovery.supportGroupId);
    if (existing && (this.pendingArrivals.some(arrival => arrival.groupId === existing.id) || existing.supportsReconstitutionOf === group.id && existing.units.filter(unitId => combatReady(this.units.get(unitId)) && this.units.get(unitId).state !== 'reserve').length >= 2)) return { accepted: false, reason: 'support_already_assigned' };
    const answer = this.requestReinforcements(group.factionId, group.frontId);
    if (answer.accepted) {
      const arrival = this.pendingArrivals.find(item => item.groupId === answer.groupId);
      arrival.supportForGroupId = group.id; recovery.supportGroupId = answer.groupId;
    }
    return answer;
  }

  _markReconstitutionSupport(support) {
    const group = this.groups.get(support.supportsReconstitutionOf), recovery = group?.reconstitution;
    if (!recovery?.required || support.path.length || support.frontId !== group.frontId || dist(support.position, this.fronts.get(group.frontId).position) > this.fronts.get(group.frontId).radius) return;
    recovery.supportGroupId = support.id;
    if (!recovery.supportArrivedAt) {
      recovery.supportArrivedAt = this.time;
      this._emit('reconstitution_support_arrived', { groupId: group.id, supportGroupId: support.id, frontId: group.frontId }, 2);
    }
  }

  _reconstitutionStep(dt) {
    for (const group of this.groups.values()) {
      const recovery = group.reconstitution;
      if (!recovery?.required || group.path.length || !group.units.some(unitId => combatReady(this.units.get(unitId)))) continue;
      if (group.order.type === 'retreat') group.order.type = 'regroup';
      if (group.order.type !== 'regroup') continue;
      const front = this.fronts.get(group.frontId), supply = this._sourcesFor(group.factionId).find(source => this._path(source.id, front.id) !== null);
      if (!recovery.supportGroupId) {
        const arrived = [...this.groups.values()].find(candidate => candidate.id !== group.id && candidate.factionId === group.factionId && !candidate.supportsReconstitutionOf && candidate.lastReinforcementArrival !== null && candidate.lastReinforcementArrival >= recovery.startedAt && candidate.frontId === group.frontId && !candidate.path.length && candidate.units.filter(unitId => combatReady(this.units.get(unitId)) && this.units.get(unitId).state !== 'reserve').length >= 2);
        if (arrived) { arrived.supportsReconstitutionOf = group.id; recovery.supportGroupId = arrived.id; this._markReconstitutionSupport(arrived); }
      }
      const support = recovery.supportGroupId && this.groups.get(recovery.supportGroupId);
      if (support && !support.path.length && support.frontId !== group.frontId && support.supportsReconstitutionOf === group.id) this.issueOrder(support.id, { type: 'escort', frontId: group.frontId, issuer: 'officer' });
      const supportReady = support && !support.path.length && support.frontId === group.frontId &&
        support.units.filter(unitId => combatReady(this.units.get(unitId)) && this.units.get(unitId).state !== 'reserve').length >= 2 &&
        dist(support.position, front.position) <= front.radius && support.supportsReconstitutionOf === group.id;
      const supplied = supply && this.relationship(front.owner, group.factionId) === 'allied' && !front.contested && dist(group.position, front.position) <= front.radius;
      if (!supportReady && this.time + EPSILON >= recovery.nextSupportRequestAt) {
        recovery.nextSupportRequestAt = this.time + this.budgets.spawnInterval;
        const answer = this.requestReconstitutionSupport(group.id);
        if (!answer.accepted && answer.reason !== recovery.lastBlockedReason) {
          recovery.lastBlockedReason = answer.reason;
          this._emit('reconstitution_waiting', { groupId: group.id, frontId: group.frontId, reason: answer.reason }, 1);
        }
      }
      if (!supplied || !supportReady) { recovery.recoverySeconds = 0; continue; }
      recovery.recoverySeconds += dt;
      if (recovery.recoverySeconds + EPSILON < 6) continue;
      recovery.required = false; recovery.readyAt = this.time;
      this._changeMorale(group, Math.max(0, 40 - group.morale), 'finite_reinforcement_received');
      this._emit('group_reconstituted', { groupId: group.id, frontId: group.frontId, supportGroupId: support.id,
        survivors: group.units.filter(unitId => combatReady(this.units.get(unitId))).length, newUnitsCreated: 0 }, 2);
      if (recovery.autoReturn && combatReady(this.units.get(group.officerId)) && this._path(group.frontId, recovery.returnFrontId) !== null) this.issueOrder(group.id, { type: recovery.returnOrderType, frontId: recovery.returnFrontId, issuer: 'officer' });
    }
  }

  _moraleStep(dt) {
    for (const group of this.groups.values()) {
      group.reportAge = Math.max(0, this.time - group.lastSeenAt);
      if (this.factions.get(group.factionId).moraleModel === 'hive' || group.state === 'reserve') continue;
      if (group.order.type === 'regroup' && !group.path.length && this.fronts.get(group.frontId).owner === group.factionId) group.morale = Math.min(80, group.morale + dt * .4);
      if (group.reconstitution?.required || group.morale > 20 || group.path.length || group.order.type === 'retreat' || !group.units.some(unitId => alive(this.units.get(unitId)))) continue;
      const safe = [...this.fronts.values()].filter(front => front.id !== group.frontId && this.relationship(front.owner, group.factionId) === 'allied' && this._path(group.frontId, front.id) !== null).sort((a, b) => dist(group.position, a.position) - dist(group.position, b.position))[0];
      if (safe) this.issueOrder(group.id, { type: 'retreat', frontId: safe.id, issuer: 'officer' });
    }
  }

  _condition(condition) {
    if (condition.type === 'capture') return this.relationship(this.fronts.get(condition.frontId).owner, this.config.playerFaction) === 'allied';
    if (condition.type === 'commander') return this.units.get(condition.unitId).state === 'dead';
    if (condition.type === 'evacuate') return this.groups.get(condition.groupId).units.every(unitId => ['dead', 'evacuated'].includes(this.units.get(unitId).state)) && this.groups.get(condition.groupId).units.some(unitId => this.units.get(unitId).state === 'evacuated');
    if (condition.type === 'source_disabled') return this.fronts.get(condition.frontId).sourceHP <= 0;
    return false;
  }

  _criticalReturnWindow(frontId) {
    const objectives = this.config.objectives ?? {}, policy = objectives.defeatWindow;
    const baseline = policy?.byFront?.[frontId];
    if (!policy || !baseline) return { graceSeconds: objectives.defeatGraceSeconds ?? 30, returnTravelSeconds: null, unreachableFrontIds: [] };
    const observed = measureDefeatReturn({ fronts: [...this.fronts.values()], routes: [...this.routes.values()].map(route => ({ ...route,
      open: route.open && this.routeAvailabilityProvider?.(clone(route)) !== false })) }, frontId,
    { playerSpeed: policy.playerSpeed, reactionSeconds: policy.reactionSeconds, maneuverFactor: policy.maneuverFactor, sourceGraceSeconds: baseline.graceSeconds });
    return { ...observed, returnTravelSeconds: Math.max(baseline.returnTravelSeconds, observed.returnTravelSeconds) };
  }

  _objectives() {
    const objectives = this.config.objectives ?? {};
    const threatened = (objectives.loseFronts ?? []).filter(frontId => this.relationship(this.fronts.get(frontId).owner, this.config.playerFaction) !== 'allied');
    for (const [frontId] of this.criticalLosses) if (!threatened.includes(frontId)) {
      this.criticalLosses.delete(frontId); this._emit('critical_front_recovered', { fronts: [frontId], frontId }, 3);
    }
    for (const frontId of threatened) if (!this.criticalLosses.has(frontId)) {
      const calibration = this._criticalReturnWindow(frontId), graceSeconds = calibration.graceSeconds;
      const loss = { frontId, since: this.time, deadline: this.time + graceSeconds, graceSeconds, routeRevision: this.routeRevision,
        returnTravelSeconds: calibration.returnTravelSeconds, unreachableFrontIds: calibration.unreachableFrontIds };
      this.criticalLosses.set(frontId, loss);
      this._emit('critical_front_lost', { fronts: [frontId], frontId, deadline: loss.deadline, graceSeconds,
        returnTravelSeconds: calibration.returnTravelSeconds, unreachableFrontIds: calibration.unreachableFrontIds }, 4);
      if (calibration.unreachableFrontIds.length) this._emit('critical_return_route_blocked', { frontId, fronts: [frontId], unreachableFrontIds: calibration.unreachableFrontIds, deadline: loss.deadline, reason: 'reopen_a_route_to_return' }, 4);
    }
    for (const loss of this.criticalLosses.values()) if (loss.routeRevision !== this.routeRevision) {
      const calibration = this._criticalReturnWindow(loss.frontId), before = loss.deadline;
      loss.graceSeconds = Math.max(loss.graceSeconds, calibration.graceSeconds); loss.deadline = loss.since + loss.graceSeconds;
      loss.returnTravelSeconds = calibration.returnTravelSeconds; loss.unreachableFrontIds = calibration.unreachableFrontIds; loss.routeRevision = this.routeRevision;
      this._emit(calibration.unreachableFrontIds.length ? 'critical_return_route_blocked' : 'critical_return_route_changed', {
        frontId: loss.frontId, fronts: [loss.frontId], deadline: loss.deadline, previousDeadline: before, returnTravelSeconds: calibration.returnTravelSeconds,
        unreachableFrontIds: calibration.unreachableFrontIds, reason: calibration.unreachableFrontIds.length ? 'reopen_a_route_to_return' : 'physical_route_distance_changed' }, 4);
    }
    this.defeatSince = this.criticalLosses.size ? Math.min(...[...this.criticalLosses.values()].map(loss => loss.since)) : null;
    const expired = [...this.criticalLosses.values()].filter(loss => this.time + EPSILON >= loss.deadline);
    if (expired.length) { this._finish('defeat', 'critical_front_lost', { fronts: expired.map(loss => loss.frontId) }); return; }
    if (objectives.timeLimit && this.time >= objectives.timeLimit) { this._finish('defeat', 'operation_timeout'); return; }
    if (objectives.externalVictory === true) return;
    const strategies = objectives.strategies ?? [];
    const normal = [...(objectives.captureFronts ?? []).map(frontId => ({ type: 'capture', frontId })), ...(objectives.killCommanders ?? []).map(unitId => ({ type: 'commander', unitId })), ...(objectives.evacuateGroups ?? []).map(groupId => ({ type: 'evacuate', groupId }))];
    if (normal.length && normal.every(condition => this._condition(condition))) this._finish('victory', 'objectives_completed');
    else for (const strategy of strategies) if (strategy.conditions.every(condition => this._condition(condition))) { this._finish('victory', 'strategy_completed', { strategyId: strategy.id }); break; }
  }

  _finish(outcome, reason, details = {}) {
    if (this.result) return;
    this.result = { ...details, outcome, reason, time: this.time };
    // No more simulation steps can consume this frame's remaining time. A
    // checkpoint made by an observer must already contain a valid stopped clock.
    this.accumulator = 0;
    this._emit('operation_finished', this.result, 4); this.callbacks.objective?.(clone(this.result));
  }

  finishOperation(result = {}) {
    if (this.disposed || this.result || !['victory', 'defeat'].includes(result.outcome) || typeof result.reason !== 'string' || !result.reason || result.reason.length > 120) return false;
    if (result.outcome === 'victory' && this.config.objectives?.externalVictory !== true) return false;
    const { outcome, reason, ...details } = result;
    this._finish(outcome, reason, details); return true;
  }

  evacuateGroup(groupId) {
    const group = this.groups.get(groupId);
    if (!group || this.disposed || this.result || this.relationship(this.fronts.get(group.frontId).owner, group.factionId) !== 'allied' || group.path.length) return false;
    if (group.materialized) this._dematerialize(group);
    let count = 0;
    if (group.units.some(unitId => { const unit = this.units.get(unitId); return alive(unit) && unit.incapacitated && dist(unit.position, this.fronts.get(group.frontId).position) > this.fronts.get(group.frontId).radius; })) return false;
    for (const unitId of group.units) { const unit = this.units.get(unitId); if (alive(unit) && unit.state !== 'reserve') { unit.state = 'evacuated'; unit.incapacitated = false; count++; } }
    if (!count) return false;
    group.state = 'evacuated'; this._emit('group_evacuated', { groupId, count }, 2); return true;
  }

  interact(player, action = {}) {
    if (this.disposed || this.result || !point(player?.position) || player.hp <= 0) return { accepted: false, reason: 'player_unavailable' };
    const front = this.fronts.get(action.frontId) ?? [...this.fronts.values()].sort((a, b) => dist(player.position, a.position) - dist(player.position, b.position))[0];
    if (!front || dist(player.position, front.position) > Math.min(12, front.radius)) return { accepted: false, reason: 'out_of_interaction_range' };
    if (action.type === 'sabotage') {
      if (!this.areHostile(front.owner, this.config.playerFaction)) return { accepted: false, reason: 'not_a_hostile_source' };
      return { accepted: this.damageSource(front.id, action.damage ?? 250, 'player_sabotage'), frontId: front.id };
    }
    if (action.type === 'rally') {
      const groups = [...this.groups.values()].filter(group => group.frontId === front.id && this.relationship(group.factionId, this.config.playerFaction) === 'allied');
      if (!groups.length) return { accepted: false, reason: 'no_allied_group' };
      const key = `rally:${front.id}`;
      if (this.objectiveKeys.has(key)) return { accepted: false, reason: 'rally_already_used' };
      this.objectiveKeys.add(key); for (const group of groups) if (this.factions.get(group.factionId).moraleModel !== 'hive') this._changeMorale(group, 15, 'player_rally');
      return { accepted: true, frontId: front.id };
    }
    return { accepted: false, reason: 'unknown_interaction' };
  }

  update(delta, { players = this.players, paused = false } = {}) {
    if (!this.disposed) this.paused = Boolean(paused);
    if (this.disposed || this.result || paused || !number(delta, 0, 60) || delta === 0) return false;
    this.players = players.filter(player => id(player.id) && point(player.position) && Number.isFinite(player.hp)).map(player => ({ id: player.id, position: [...player.position], hp: player.hp }));
    this.accumulator += delta;
    while (this.accumulator + EPSILON >= this.step && !this.result) {
      this.accumulator = Math.max(0, this.accumulator - this.step); this.time += this.step; this.tick++;
      for (const group of this.groups.values()) updateFormation(group, this.step, this.time, { officerAlive: !!group.officerId && combatReady(this.units.get(group.officerId)) });
      this._moveGroups(this.step); this._detailStep(); this._remoteCombat(); this._hostInfestationStep(); this._hiveNodeStep(this.step); this._captureStep(this.step); this._reinforcements(); this._reconstitutionStep(this.step); this._moraleStep(this.step); this._strategicOrders(); this._objectives(); this.intel.update();
    }
    return true;
  }

  _groupSnapshot(group) {
    const faction = this.factions.get(group.factionId), sourceCoordinated = faction.moraleModel !== 'hive' || this._sourcesFor(group.factionId).length > 0;
    const coordinated = sourceCoordinated && (faction.moraleModel !== 'hive' || group.coordinationStrength === 1);
    const positionTarget = group.path.length ? [...((group.path[0].from === this.routes.get(group.path[0].routeId).from ? this.routes.get(group.path[0].routeId).waypoints : [...this.routes.get(group.path[0].routeId).waypoints].reverse())[group.waypointIndex] ?? this.fronts.get(group.path[0].to).position)] : [...this.fronts.get(group.order.frontId).position];
    if (!group.path.length && group.tactic?.expires > this.time && group.tactic.flank) positionTarget[0] += group.tactic.flank * 12;
    return { id: group.id, label: group.label, factionId: group.factionId, species: faction.species,
      frontId: group.frontId, position: [...group.position], morale: faction.moraleModel === 'hive' ? sourceCoordinated ? 70 : 45 : group.morale,
      moraleModel: faction.moraleModel, moraleLabel: faction.moraleModel === 'hive' ? 'Pression de ruche' : faction.moraleModel === 'clan' ? 'Cohésion' : 'Moral', coordinated,
      formation: group.formation, delegated: group.delegated, tactic: group.tactic && group.tactic.expires > this.time ? clone(group.tactic) : null,
      coordinationStrength: group.coordinationStrength, reconstitution: group.reconstitution ? clone(group.reconstitution) : null,
      state: group.state, officerId: group.officerId, officerHP: group.officerId ? this.units.get(group.officerId).hp : null, officerMaxHP: group.officerId ? this.units.get(group.officerId).maxHp : null,
      cohesion: group.cohesion, rootUntil: group.rootUntil, suppressedUntil: group.suppressedUntil, officerThreatUntil: group.officerThreatUntil, revealedUntil: group.revealedUntil,
      order: clone(group.order), targetPosition: positionTarget,
      path: clone(group.path), incapacitated: group.units.filter(unitId => alive(this.units.get(unitId)) && this.units.get(unitId).incapacitated).length, combatReady: group.units.filter(unitId => combatReady(this.units.get(unitId))).length, alive: group.units.filter(unitId => alive(this.units.get(unitId))).length, units: [...group.units], materialized: group.materialized,
      reportAge: group.reportAge, precisePositionKnown: group.materialized || group.reportAge < 5 };
  }
  getGroup(groupId) { const group = this.groups.get(groupId); return group ? this._groupSnapshot(group) : null; }
  getGroupUnits(groupId) { return this.groups.get(groupId)?.units.map(unitId => clone(this.units.get(unitId))) ?? []; }
  getFront(frontId) { const front = this.fronts.get(frontId); return front ? clone(front) : null; }
  getFrontState(frontId) {
    const front = this.fronts.get(frontId);
    return front ? { id: front.id, owner: front.owner, sourceHP: front.sourceHP, contested: front.contested, reinforcementSource: front.reinforcementSource } : null;
  }
  getResult() { return this.result ? clone(this.result) : null; }
  getUnit(unitId) { const unit = this.units.get(unitId); return unit ? clone(unit) : null; }
  getActiveUnits() { return [...this.units.values()].filter(unit => unit.state === 'active').map(clone); }
  getActorDirectives() {
    const snapshots = new Map();
    return this.getActiveUnits().map(unit => {
      if (!snapshots.has(unit.groupId)) snapshots.set(unit.groupId, this._groupSnapshot(this.groups.get(unit.groupId)));
      const group = snapshots.get(unit.groupId);
      return { ...unit, order: clone(group.order), targetPosition: formationTargetForUnit(this.groups.get(unit.groupId), this.groups.get(unit.groupId).units.filter(unitId => alive(this.units.get(unitId))), unit.id, { origin: group.path.length ? group.position : group.targetPosition, target: group.targetPosition }) ?? [...group.targetPosition], formation: group.formation,
        cohesion: group.cohesion, rootUntil: group.rootUntil, suppressedUntil: group.suppressedUntil, officerThreatUntil: group.officerThreatUntil,
        tactic: group.tactic ? clone(group.tactic) : null, morale: group.morale, moraleModel: group.moraleModel, coordinated: group.coordinated,
        coordinationStrength: group.coordinationStrength, reconstitution: group.reconstitution,
        canAttack: !unit.incapacitated && !group.reconstitution?.required && group.rootUntil <= this.time && !['retreat', 'regroup'].includes(group.order.type) };
    });
  }

  getCounts() {
    const counts = Object.fromEntries([...this.factions.keys()].map(factionId => [factionId, { allocated: this.factions.get(factionId).allocated, active: 0, distant: 0, reserve: 0, dead: 0, evacuated: 0, captured: 0 }]));
    for (const unit of this.units.values()) counts[unit.factionId][unit.state]++;
    return counts;
  }
  assertConservation() {
    if (this.units.size !== this.initialAllocated) fail('unit identities changed during the operation');
    const counts = this.getCounts(); let detailed = 0;
    for (const [factionId, values] of Object.entries(counts)) {
      if ([...STATES].reduce((sum, state) => sum + values[state], 0) !== values.allocated) fail(`state conservation failed for ${factionId}`);
      detailed += values.active;
      if (values.active > (this.budgets.byFaction?.[factionId]?.active ?? this.budgets.active)) fail('faction detailed budget exceeded');
    }
    if (detailed > this.budgets.active) fail('global detailed budget exceeded');
    for (const unit of this.units.values()) if (!STATES.has(unit.state) || !number(unit.hp, 0, unit.maxHp) || unit.state === 'dead' && unit.hp !== 0 || unit.state !== 'dead' && unit.hp === 0) fail('invalid exclusive unit state');
    return true;
  }

  getHUDState() {
    const groups = [...this.groups.values()].map(group => this.intel.group(group.id, this._groupSnapshot(group))).filter(Boolean);
    const intelligence = this.intel.getHUDState(groups);
    return { id: this.config.id, mode: this.config.mode, label: this.config.label ?? this.config.id, time: this.time,
      playerFaction: this.config.playerFaction, counts: this.getCounts(), intelCounts: intelligence.counts, intelligence, result: this.result ? clone(this.result) : null,
      fronts: [...this.fronts.values()].map(front => this.intel.front(front.id, { id: front.id, label: front.label, position: [...front.position], owner: front.owner,
        contested: front.contested, sourceHP: front.sourceHP, reinforcementSource: front.reinforcementSource, capture: clone(front.capture),
        reportAge: Math.max(0, this.time - front.lastReportAt) })),
      groups, routes: [...this.routes.values()].map(clone),
      alerts: this.events.filter(event => this.intel.allowsEvent(event) && event.priority >= 2 && this.time - event.time <= 30).sort((a, b) => b.priority - a.priority || b.id - a.id).slice(0, 8).map(clone),
      criticalDeadline: this.criticalLosses.size ? Math.min(...[...this.criticalLosses.values()].map(loss => loss.deadline)) : null,
      criticalFronts: [...this.criticalLosses.values()].map(clone), difficulty: this.config.difficulty ? clone(this.config.difficulty) : null,
      pendingArrivals: this.pendingArrivals.filter(arrival => this.result || this.relationship(arrival.factionId, this.config.playerFaction) === 'allied' || this.intel.allowsEvent({ groupId: arrival.groupId, time: arrival.due - this.budgets.announcementSeconds })).map(clone), journal: this.getTacticalJournal(), casualties: [...this.deaths.values()].filter(death => !death.inherited).length,
      inheritedLosses: [...this.deaths.values()].filter(death => death.inherited).length, eventsDropped: this.eventsDropped };
  }
  getTacticalJournal(limit = 64) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 256) return [];
    return this.events.filter(event => this.intel.allowsEvent(event)).slice(-limit).map(event => ({ ...clone(event), reportAge: Math.max(0, this.time - event.time) }));
  }
  getState() { return this.saveState(); }
  getCampaignConsequences() {
    return { operationId: this.config.id, defeatedUniqueIds: [...this.deaths.values()].filter(death => death.uniqueId).map(death => death.uniqueId),
      evacuatedUniqueIds: [...this.units.values()].filter(unit => unit.state === 'evacuated' && unit.uniqueId).map(unit => unit.uniqueId),
      capturedUniqueIds: [...this.units.values()].filter(unit => unit.state === 'captured' && unit.uniqueId).map(unit => unit.uniqueId),
      frontOwners: Object.fromEntries([...this.fronts.values()].map(front => [front.id, front.owner])), result: this.result ? clone(this.result) : null };
  }
  saveState() {
    return { version: 1, id: this.config.id, configDigest: this.digest, time: this.time, tick: this.tick, accumulator: this.accumulator,
      units: [...this.units.values()].map(clone), groups: [...this.groups.values()].map(group => ({ ...clone(group), materialized: false })),
      fronts: [...this.fronts.values()].map(clone), routes: [...this.routes.values()].map(clone), relations: [...this.relations],
      deaths: [...this.deaths.values()].map(clone), events: this.events.map(clone), eventsDropped: this.eventsDropped, eventSequence: this.eventSequence,
      pendingArrivals: this.pendingArrivals.map(clone), nextReinforcement: [...this.nextReinforcement], objectiveKeys: [...this.objectiveKeys],
      intelligence: this.intel.serialize(), hiveEcology: this.getHiveNodeState(), defeatSince: this.defeatSince, criticalLosses: [...this.criticalLosses.values()].map(clone), routeRevision: this.routeRevision, nextStrategicOrder: this.nextStrategicOrder, tacticCooldowns: [...this.tacticCooldowns], result: this.result ? clone(this.result) : null };
  }

  static fromState(configuration, saved, callbacks = {}) {
    const simulation = new BattleSimulation(configuration, callbacks);
    try { if (JSON.stringify(saved).length > 8 * 1024 * 1024) fail('saved operation exceeds its bounded data budget'); }
    catch (error) { if (String(error.message).startsWith('BattleSimulation:')) throw error; fail('saved operation is not serializable'); }
    if (!saved || saved.version !== 1 || saved.id !== simulation.config.id || saved.configDigest !== simulation.digest || !number(saved.time, 0, 1e8) || !Number.isInteger(saved.tick) || saved.tick < 0 || !number(saved.accumulator, 0, simulation.step)) fail('save does not match this operation or has an invalid clock');
    for (const [name, source, expected] of [['units', saved.units, simulation.units], ['groups', saved.groups, simulation.groups], ['fronts', saved.fronts, simulation.fronts], ['routes', saved.routes, simulation.routes]]) {
      if (!Array.isArray(source) || source.length !== expected.size || new Set(source.map(item => item.id)).size !== expected.size || source.some(item => !expected.has(item.id))) fail(`save ${name} identities do not match`);
    }
    const units = new Map(saved.units.map(unit => [unit.id, clone(unit)]));
    const pendingInfestations = [...units.values()].filter(unit => unit.infection).map(unit => unit.infection.sourceUnitId);
    if (new Set(pendingInfestations).size !== pendingInfestations.length)
      fail('duplicated saved host infestation source');
    for (const [unitId, unit] of units) {
      const original = simulation.units.get(unitId);
      if (unit.encounterState !== undefined) {
        if (unit.actorType !== 'queen' || !unit.sourceBossType) fail('saved boss metadata belongs to a non-boss unit');
        try { unit.encounterState = validateBossCombatState(unit.encounterState, { bossType: unit.sourceBossType, battleUnitId: unit.id, maxHp: unit.maxHp }); }
        catch { fail('invalid saved boss combat metadata'); }
      }
      if (sourceUnitVisualKind(original) === 'medic') {
        unit.medicalSupply ??= 0; // source-v1 saves have no medical stock.
        if (!Number.isInteger(unit.medicalSupply) || unit.medicalSupply < 0 || unit.medicalSupply > 2)
          fail('invalid saved medical stock');
      } else if (unit.medicalSupply !== undefined) fail('non-medic cannot own medical stock');
      try { restoreSpecialistStocks(unit, original); }
      catch { fail('invalid saved specialist stock'); }
      unit.incapacitated ??= false;
      try { validateHostInfestation(unit, simulation.units, units, saved.time, saved.deaths); }
      catch { fail('invalid saved host infestation'); }
      if (typeof unit.incapacitated !== 'boolean' || unit.incapacitated && (!alive(unit) || !['active', 'distant'].includes(unit.state))) fail('invalid saved incapacitation');
      for (const key of ['profileId', 'factionId', 'groupId', 'maxHp', 'uniqueId', 'officer', 'species', 'role', 'actorType', 'profileName', 'sourceBossId', 'sourceBossType', 'visualFidelity1to1Verified']) if (unit[key] !== original[key]) fail('save rewrites an allocated identity');
      // Remote specialist attacks may have a longer, source-scoped recovery
      // than the generic profile. Reject forged clocks but accept legitimate
      // Sniper/SADAR cooldowns created by this very simulation.
      const allowedAttackInterval = Math.max(simulation.profiles.get(unit.profileId).attackInterval,
        SPECIALIST_ATTACKS[sourceSpecialistRole(original)]?.cooldown ?? 0);
      if (!STATES.has(unit.state) || !number(unit.hp, 0, unit.maxHp) || !point(unit.position) ||
          !number(unit.nextAttack, 0, saved.time + allowedAttackInterval + simulation.step) ||
          !number(unit.damageTaken, 0, 1e12)) fail('invalid saved unit state');
      if (original.state === 'dead' && unit.state !== 'dead') fail('saved checkpoint would revive an individual confirmed dead in this campaign');
      if (original.state === 'captured' && !['captured', 'dead', 'evacuated'].includes(unit.state)) fail('saved checkpoint would silently release a captured campaign individual');
      // No world actors survive a scene reload. Recreate the same living IDs
      // through the detail budget on the next update, keeping health and losses.
      if (unit.state === 'active') unit.state = 'distant';
    }
    const groups = saved.groups.map(clone);
    for (const group of groups) {
      // Earlier tactical orders could be saved before the next formation tick
      // converted these two aliases. Keep unknown save values invalid.
      if (['flank', 'column'].includes(group.formation)) group.formation = normalizeFormation(group.formation);
      const expectedCoordination = simulation.factions.get(group.factionId)?.moraleModel === 'hive' && units.get(group.officerId)?.state === 'dead' ? .65 : 1;
      group.coordinationStrength ??= expectedCoordination; group.reconstitution ??= null; group.supportsReconstitutionOf ??= null; group.lastReinforcementArrival ??= null; group.reinforcementDestination ??= null;
      if (group.lastReinforcementArrival !== null && !number(group.lastReinforcementArrival, 0, saved.time) || group.reinforcementDestination !== null && !simulation.fronts.has(group.reinforcementDestination)) fail('invalid saved reinforcement destination');
      if (group.coordinationStrength !== expectedCoordination || group.supportsReconstitutionOf !== null && (!simulation.groups.has(group.supportsReconstitutionOf) || group.supportsReconstitutionOf === group.id || simulation.groups.get(group.supportsReconstitutionOf).factionId !== group.factionId)) fail('invalid saved coordination/support');
      const recovery = group.reconstitution;
      if (recovery && (recovery.required && !['retreat', 'regroup'].includes(group.order?.type) || recovery.required && recovery.readyAt !== null || !recovery.required && recovery.readyAt === null || typeof recovery.required !== 'boolean' || !number(recovery.startedAt, 0, saved.time) || !simulation.fronts.has(recovery.returnFrontId) || !ORDERS.has(recovery.returnOrderType) || typeof recovery.autoReturn !== 'boolean' || !number(recovery.recoverySeconds, 0, 6 + simulation.step) || !number(recovery.nextSupportRequestAt, 0, saved.time + simulation.budgets.spawnInterval) || recovery.readyAt !== null && !number(recovery.readyAt, recovery.startedAt, saved.time) || recovery.supportArrivedAt !== undefined && !number(recovery.supportArrivedAt, recovery.startedAt, saved.time) || recovery.supportGroupId !== null && (!simulation.groups.has(recovery.supportGroupId) || recovery.supportGroupId === group.id || simulation.groups.get(recovery.supportGroupId).factionId !== group.factionId) || recovery.lastBlockedReason !== null && (typeof recovery.lastBlockedReason !== 'string' || recovery.lastBlockedReason.length > 120))) fail('invalid saved reconstitution');
      if (!Object.hasOwn(FORMATION_PROFILES, group.formation) || !number(group.cohesion, 0, 100) || ['rootUntil', 'suppressedUntil', 'officerThreatUntil', 'revealedUntil'].some(key => !number(group[key], 0, saved.time + 120)) || group.lastFormationImpact !== undefined && !number(group.lastFormationImpact, 0, saved.time) || group._formationImpacts && (Object.keys(group._formationImpacts).length > 128 || Object.entries(group._formationImpacts).some(([key, time]) => key.length > 256 || !number(time, 0, saved.time)))) fail('invalid saved formation state');
      const original = simulation.groups.get(group.id);
      if (group.factionId !== original.factionId || group.officerId !== original.officerId || group.reserveOriginId !== original.reserveOriginId || JSON.stringify(group.units) !== JSON.stringify(original.units) || !simulation.fronts.has(group.frontId) || !point(group.position) || !point(group.reportPosition) || !number(group.morale, 0, 100) || !ORDERS.has(group.order?.type) || !id(group.order.issuer) || !simulation.fronts.has(group.order.frontId) || !Array.isArray(group.path) || group.path.length > simulation.fronts.size || !number(group.travelProgress, 0, 1) || !number(group.detailRetryAt, 0, saved.time + 3) || !number(group.lastSeenAt, 0, saved.time) || !number(group.reportAge, 0, saved.time)) fail('invalid saved group');
      for (let index = 0; index < group.path.length; index++) {
        const segment = group.path[index], route = simulation.routes.get(segment.routeId), previous = index ? group.path[index - 1].to : group.frontId;
        if (!route || segment.from !== previous || ![route.from, route.to].includes(segment.from) || ![route.from, route.to].includes(segment.to) || segment.from === segment.to) fail('invalid saved route traversal');
      }
      if (group.path.length && (group.path.at(-1).to !== group.order.frontId || !Number.isInteger(group.waypointIndex) || group.waypointIndex < 0 || group.waypointIndex >= simulation.routes.get(group.path[0].routeId).waypoints.length)) fail('invalid saved waypoint');
      if (group.tactic && (!['pincer', 'hold_line', 'ambush', 'fallback'].includes(group.tactic.type) || !number(group.tactic.expires, 0, saved.time + 20) || ![-1, 0, 1].includes(group.tactic.flank))) fail('invalid saved tactical effect');
    }
    for (const front of saved.fronts) {
      const original = simulation.fronts.get(front.id);
      if (front.owner !== null && !simulation.factions.has(front.owner) || !number(front.sourceHP, 0, Math.max(original.baseHP, original.sourceHP)) || !number(front.lastReportAt, 0, saved.time) || !front.capture || Object.entries(front.capture).some(([factionId, progress]) => !simulation.factions.has(factionId) || !number(progress, 0, original.captureThreshold))) fail('invalid saved front');
      for (const key of ['position', 'radius', 'baseHP', 'captureThreshold', 'reinforcementSource']) if (JSON.stringify(front[key]) !== JSON.stringify(original[key])) fail('save rewrites the built front geometry');
    }
    for (const route of saved.routes) {
      const original = simulation.routes.get(route.id);
      for (const key of ['from', 'to', 'travelSeconds', 'waypoints']) if (JSON.stringify(route[key]) !== JSON.stringify(original[key])) fail('save rewrites the built navigation route');
      if (typeof route.open !== 'boolean') fail('invalid saved route state');
    }
    if (!Array.isArray(saved.deaths) || saved.deaths.length > units.size || new Set(saved.deaths.map(death => death.entityId)).size !== saved.deaths.length || saved.deaths.some(death => {
      const unit = units.get(death.entityId); return unit?.state !== 'dead' || death.groupId !== unit.groupId || death.factionId !== unit.factionId || death.uniqueId !== unit.uniqueId || death.officer !== unit.officer || !number(death.time, 0, saved.time) || death.killerFaction !== null && !simulation.factions.has(death.killerFaction);
    })) fail('invalid death ledger');
    if ([...units.values()].filter(unit => unit.state === 'dead').length !== saved.deaths.length) fail('saved losses do not reconcile with the ledger');
    if (!Array.isArray(saved.relations) || saved.relations.length !== simulation.relations.size || new Set(saved.relations.map(([key]) => key)).size !== simulation.relations.size || saved.relations.some(([key, state]) => !simulation.relations.has(key) || !RELATIONS.has(state))) fail('invalid saved faction relationships');
    if (!Array.isArray(saved.pendingArrivals) || new Set(saved.pendingArrivals.map(arrival => arrival.groupId)).size !== saved.pendingArrivals.length || saved.pendingArrivals.some(arrival => !simulation.groups.has(arrival.groupId) || !simulation.fronts.has(arrival.frontId) || !simulation.fronts.has(arrival.sourceId) || simulation.groups.get(arrival.groupId).factionId !== arrival.factionId || !number(arrival.due, saved.time, saved.time + simulation.budgets.announcementSeconds) || !simulation.groups.get(arrival.groupId).units.some(unitId => units.get(unitId).state === 'reserve') || arrival.supportForGroupId !== undefined && (!simulation.groups.has(arrival.supportForGroupId) || simulation.groups.get(arrival.supportForGroupId).factionId !== arrival.factionId))) fail('invalid saved arrival');
    if (!Array.isArray(saved.events) || saved.events.length > 512 || !Number.isInteger(saved.eventSequence) || saved.eventSequence < saved.events.length || !Number.isInteger(saved.eventsDropped) || saved.eventsDropped < 0 || saved.events.some(event => !Number.isInteger(event.id) || event.id < 1 || event.id > saved.eventSequence || !number(event.time, 0, saved.time) || !number(event.priority, 0, 4) || typeof event.type !== 'string' || event.type.length > 80) || new Set(saved.events.map(event => event.id)).size !== saved.events.length) fail('invalid bounded event journal');
    if (!Array.isArray(saved.nextReinforcement) || saved.nextReinforcement.length !== simulation.factions.size || saved.nextReinforcement.some(([factionId, time]) => !simulation.factions.has(factionId) || !number(time, 0, 1e9))) fail('invalid saved reinforcement timers');
    simulation.units = units; simulation.groups = new Map(groups.map(group => [group.id, { ...group, materialized: false, state: group.state === 'active' ? 'distant' : group.state }]));
    simulation.fronts = new Map(saved.fronts.map(front => [front.id, clone(front)])); simulation.routes = new Map(saved.routes.map(route => [route.id, clone(route)]));
    simulation.relations = new Map(saved.relations); simulation.deaths = new Map(saved.deaths.map(death => [death.entityId, clone(death)]));
    simulation.events = saved.events.map(clone); simulation.eventsDropped = saved.eventsDropped; simulation.eventSequence = saved.eventSequence;
    simulation.pendingArrivals = saved.pendingArrivals.map(clone); simulation.nextReinforcement = new Map(saved.nextReinforcement);
    simulation.objectiveKeys = new Set(saved.objectiveKeys ?? []); simulation.defeatSince = saved.defeatSince; simulation.result = saved.result ? clone(saved.result) : null;
    const criticalLosses = saved.criticalLosses ?? (saved.defeatSince === null ? [] : (configuration.objectives?.loseFronts ?? []).filter(frontId => simulation.relationship(simulation.fronts.get(frontId).owner, configuration.playerFaction) !== 'allied').map(frontId => ({ frontId, since: saved.defeatSince, deadline: saved.defeatSince + (configuration.objectives?.defeatWindow?.byFront?.[frontId]?.graceSeconds ?? configuration.objectives?.defeatGraceSeconds ?? 30) })));
    const routeRevision = saved.routeRevision ?? 0;
    if (!Number.isSafeInteger(routeRevision) || routeRevision < 0) fail('invalid saved route revision');
    if (!Array.isArray(criticalLosses) || criticalLosses.length > simulation.fronts.size || new Set(criticalLosses.map(loss => loss?.frontId)).size !== criticalLosses.length) fail('invalid saved critical-front timer');
    for (const loss of criticalLosses) {
      if (!loss || !(configuration.objectives?.loseFronts ?? []).includes(loss.frontId)) fail('invalid saved critical-front timer');
      loss.graceSeconds ??= loss.deadline - loss.since; loss.routeRevision ??= routeRevision; loss.unreachableFrontIds ??= [];
      loss.returnTravelSeconds ??= configuration.objectives?.defeatWindow?.byFront?.[loss.frontId]?.returnTravelSeconds ?? null;
      const minimum = configuration.objectives?.defeatWindow?.byFront?.[loss.frontId]?.graceSeconds ?? configuration.objectives?.defeatGraceSeconds ?? 30;
      if (!number(loss.since, 0, saved.time) || !number(loss.deadline, loss.since + 1, loss.since + 7200) || !number(loss.graceSeconds, minimum, 7200) || !configuration.objectives?.defeatWindow && loss.graceSeconds !== minimum || Math.abs(loss.deadline - loss.since - loss.graceSeconds) > EPSILON || !Number.isInteger(loss.routeRevision) || loss.routeRevision < 0 || loss.routeRevision > routeRevision || !Array.isArray(loss.unreachableFrontIds) || loss.unreachableFrontIds.length > simulation.fronts.size || loss.unreachableFrontIds.some(frontId => !simulation.fronts.has(frontId)) || loss.returnTravelSeconds !== null && !number(loss.returnTravelSeconds, 0, loss.graceSeconds)) fail('invalid saved critical-front timer');
    }
    simulation.routeRevision = routeRevision;
    simulation.criticalLosses = new Map(criticalLosses.map(loss => [loss.frontId, clone(loss)]));
    if (!number(saved.nextStrategicOrder, 0, 1e9) || !Array.isArray(saved.tacticCooldowns) || saved.tacticCooldowns.some(([type, time]) => !['pincer', 'hold_line', 'ambush', 'fallback'].includes(type) || !number(time, 0, 1e9))) fail('invalid saved tactics clock');
    simulation.nextStrategicOrder = saved.nextStrategicOrder; simulation.tacticCooldowns = new Map(saved.tacticCooldowns);
    simulation.time = saved.time; simulation.tick = saved.tick; simulation.accumulator = saved.accumulator;
    if (saved.intelligence) simulation.intel.restore(saved.intelligence);
    simulation.hiveEcology = restoreHiveEcology(simulation.hiveEcology,
      saved.hiveEcology, simulation.units, saved.time, simulation.deaths);
    try {
      simulation.hiveEcology.spores = restoreHiveSporeSight(
        saved.hiveEcology?.spores, simulation.hiveEcology,
        simulation.units, simulation.fronts, saved.time);
    } catch { fail('invalid saved hive spore sight'); }
    simulation.assertConservation(); return simulation;
  }

  dispose() {
    if (this.disposed) return;
    for (const group of this.groups.values()) if (group.materialized) this._dematerialize(group);
    this.disposed = true; this.paused = true; this.pendingArrivals = []; this.players = []; this.callbacks = {};
  }
}
