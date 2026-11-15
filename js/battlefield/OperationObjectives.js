/* Stateful original operation objectives. Simulation time, physical proximity,
 * finite cargo/civilian identities and real battle ownership drive outcomes. */
import { bindOperationObjectivesToFronts } from './OperationObjectiveSpecs.js';
export { bindOperationObjectivesToFronts } from './OperationObjectiveSpecs.js';

const copy = value => structuredClone(value);
const finitePoint = point => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite);
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const positionOf = actor => Array.isArray(actor?.position) ? actor.position : actor?.position && [actor.position.x, actor.position.z];
const actorId = actor => String(actor?.id ?? (actor?.isPlayer2 ? 'player2' : 'player1'));
const fail = message => { throw new Error(`OperationObjectives: ${message}`); };
const INTERACTIVE = new Set(['secure', 'sabotage', 'activate', 'extract', 'rescue', 'negotiate']);
const TYPES = new Set([...INTERACTIVE, 'defend', 'capture', 'eliminate']);
const EPSILON = 1e-7;
const signature = value => { let result = 2166136261; for (const char of JSON.stringify(value)) result = Math.imul(result ^ char.charCodeAt(0), 16777619) >>> 0; return result.toString(16); };

export class OperationObjectives {
  constructor(configuration, simulation, callbacks = {}) {
    const config = bindOperationObjectivesToFronts(configuration), spec = config.operationObjectives;
    if (!spec || spec.version !== 1 || config.objectives?.externalVictory !== true || !simulation?.finishOperation) fail('a bound narrative configuration and external-victory simulation are required');
    if (!Array.isArray(spec.tasks) || spec.tasks.length > 24 || !spec.tasks.length || new Set(spec.tasks.map(task => task.id)).size !== spec.tasks.length) fail('one to twenty-four distinct tasks are required');
    const names = new Set(spec.tasks.map(task => task.id));
    for (const task of spec.tasks) {
      if (!TYPES.has(task.type) || !finitePoint(task.position) || !Number.isFinite(task.duration) || task.duration <= 0 || !Number.isFinite(task.radius) || task.radius <= 0 || task.requires.some(id => !names.has(id))) fail('invalid task geometry or dependency');
    }
    for (const strategy of spec.strategies) if (!strategy.tasks.length || strategy.tasks.some(id => !names.has(id))) fail('invalid narrative victory condition');
    if (!Array.isArray(spec.reactions ?? []) || (spec.reactions ?? []).length > 8 || new Set((spec.reactions ?? []).map(reaction => reaction.id)).size !== (spec.reactions ?? []).length) fail('invalid reaction registry');
    for (const reaction of spec.reactions ?? []) if (!names.has(reaction.afterTaskId) || !config.factions.some(faction => faction.id === reaction.factionId && faction.id !== config.playerFaction)
      || !config.fronts.some(front => front.id === reaction.targetFrontId) || !Number.isFinite(reaction.delay) || reaction.delay < 3 || reaction.delay > 120) fail('invalid reaction trigger or warning');
    this.config = config; this.spec = spec; this.simulation = simulation; this.callbacks = callbacks;
    this.digest = signature(spec);
    this.time = 0; this.result = null; this.disposed = false; this.paused = false; this.players = new Map(); this.channels = new Map();
    this.tasks = new Map(spec.tasks.map(task => [task.id, { ...copy(task), status: 'pending', progress: 0, completions: 0, completedAt: null }]));
    this.entities = new Map(spec.entities.map(entity => {
      const members = Array.from({ length: entity.noncombatants ?? 0 }, (_, index) => ({ id: `${entity.id}:member:${index}`, hp: 50, state: 'captive' }));
      const hp = members.length ? members.reduce((sum, member) => sum + member.hp, 0) : entity.hp;
      return [entity.id, { ...copy(entity), hp, maxHp: hp, state: 'world', carrierId: null, followerId: null,
        routeIndex: 0, routeProgress: 0, stopped: false, escaped: false, evacuated: false, followPath: [], members }];
    }));
    this.deadUnique = new Set(); this.events = []; this.nextEvent = 0;
    this.reactions = new Map((spec.reactions ?? []).map(reaction => [reaction.id, { id: reaction.id, status: 'dormant', announcedAt: null, due: null, groupId: null, reason: null }]));
    this.uniqueUnits = new Map(config.groups.flatMap(group => group.units.filter(unit => unit.uniqueId).map(unit => [unit.uniqueId, unit.id])));
    this.playerFaction = config.playerFaction;
  }

  _emit(type, details = {}) {
    const event = { id: `${this.spec.operationId}:objective:${this.nextEvent++}`, type, time: this.time, ...copy(details) };
    this.events.push(event); if (this.events.length > 256) this.events.shift();
    this.callbacks.onEvent?.(copy(event)); return event;
  }
  _front(id) { return this.simulation.getFrontState?.(id) ?? this.simulation.getHUDState?.().fronts.find(front => front.id === id); }
  _result() { return this.simulation.getResult?.() ?? this.simulation.result ?? null; }
  _ready(task) {
    if (task.requiresAliveUnique) {
      const unitId = this.uniqueUnits.get(task.requiresAliveUnique), unit = unitId && this.simulation.getUnit?.(unitId);
      if (!unit || unit.state === 'dead' || this.deadUnique.has(task.requiresAliveUnique)) return false;
    }
    return task.requires.every(id => this.tasks.get(id)?.status === 'done')
      && (!task.requiresAny || task.requiresAny.some(branch => branch.every(id => this.tasks.get(id)?.status === 'done')));
  }
  _position(task) {
    const cargo = task.entityId && this.entities.get(task.entityId);
    if (task.completions && cargo?.state === 'world') return cargo.position;
    return task.followsEntity ? this.entities.get(task.followsEntity).position : task.position;
  }
  _alivePlayers(actors) {
    const result = new Map();
    for (const actor of actors ?? []) {
      const point = positionOf(actor); if (!finitePoint(point) || !Number.isFinite(actor.hp)) continue;
      result.set(actorId(actor), { id: actorId(actor), position: [...point], hp: actor.hp });
    }
    return result;
  }
  _feedback(text) { this.callbacks.onFeedback?.(text); return text; }
  _blocked(task, player) {
    if (!this._ready(task)) return 'Un objectif préalable reste à accomplir.';
    if (distance(player.position, this._position(task)) > task.radius) return 'Approchez-vous du dispositif.';
    if (task.entityId && this.entities.get(task.entityId)?.hp <= 0) return 'Cet objectif a été détruit.';
    if (task.needsFriendlyFront && this._front(task.frontId)?.owner !== this.playerFaction) return 'Sécurisez ce front avant l’extraction.';
    if (task.type === 'extract') {
      for (const id of task.cargo ?? []) {
        const cargo = this.entities.get(id);
        if (cargo?.hp <= 0 || cargo?.state !== 'carried' || distance(cargo.position, task.position) > task.radius + 3) return 'Le matériel doit rejoindre physiquement la zone de départ.';
      }
      for (const id of task.evacuates ?? []) {
        const entity = this.entities.get(id), required = task.requires.includes(id);
        if (required && (!entity || entity.state !== 'rescued' || !entity.members.some(member => member.hp > 0))) return 'Le groupe à secourir n’est pas disponible.';
        if (entity?.state === 'rescued' && distance(entity.position, task.position) > task.radius + 5) return 'Attendez l’arrivée des personnes secourues.';
      }
    }
    return null;
  }

  interact(actor) {
    const point = positionOf(actor), id = actorId(actor);
    if (this.disposed || this.result || this._result() || this.paused || this.simulation.paused || !Number.isFinite(actor?.hp) || actor.hp <= 0 || !finitePoint(point)) return { accepted: false, feedback: 'Action indisponible.' };
    const player = { id, hp: actor.hp, position: [...point] }; this.players.set(id, player);
    if (this.channels.has(id)) {
      const previous = this.channels.get(id); this.channels.delete(id); this._emit('interaction_cancelled', { taskId: previous.taskId, actorId: id, reason: 'player_cancelled' });
      return { accepted: true, taskId: previous.taskId, feedback: this._feedback('Action interrompue.') };
    }
    const near = [...this.tasks.values()].filter(task => task.status !== 'done' && INTERACTIVE.has(task.type) && distance(player.position, this._position(task)) <= task.radius)
      .sort((a, b) => Number(this._ready(b)) - Number(this._ready(a)) || distance(player.position, this._position(a)) - distance(player.position, this._position(b)));
    const task = near[0]; if (!task) return { accepted: false, feedback: 'Aucun dispositif à portée.' };
    const blocked = this._blocked(task, player); if (blocked) return { accepted: false, taskId: task.id, feedback: this._feedback(blocked) };
    if ([...this.channels.values()].some(channel => channel.taskId === task.id)) return { accepted: false, taskId: task.id, feedback: 'Votre partenaire utilise déjà ce dispositif.' };
    this.channels.set(id, { taskId: task.id, elapsed: 0, hp: player.hp });
    this._emit('interaction_started', { taskId: task.id, actorId: id, duration: task.duration });
    return { accepted: true, taskId: task.id, feedback: this._feedback(`${task.label} — restez à portée.`) };
  }

  _complete(task, player = null) {
    if (task.status === 'done') return false;
    task.status = 'done'; task.progress = task.duration; task.completedAt = this.time; task.completions++;
    if (task.type === 'secure') {
      const entity = this.entities.get(task.entityId); entity.state = 'carried'; entity.carrierId = player.id; entity.position = [...player.position];
      this._emit(task.completions === 1 ? 'item_secured' : 'item_recovered', { taskId: task.id, entityId: entity.id, actorId: player.id });
    } else if (task.type === 'rescue') {
      const entity = this.entities.get(task.entityId); entity.state = 'rescued'; entity.followerId = player.id; entity.followPath = [[...entity.position], [...player.position]];
      for (const member of entity.members) if (member.hp > 0) member.state = 'rescued';
      this._emit('noncombatants_freed', { taskId: task.id, entityId: entity.id, count: entity.members.filter(member => member.hp > 0).length });
    } else if (task.type === 'sabotage' && task.disableSource) {
      const front = this._front(task.frontId); if (front?.sourceHP > 0) this.simulation.damageSource(task.frontId, front.sourceHP, 'operation_sabotage');
      this._emit('source_disabled', { taskId: task.id, frontId: task.frontId });
    } else if (task.type === 'negotiate') {
      this.simulation.setRelationship(this.playerFaction, task.factionId, task.relationship, 'local_operation_agreement');
      this._emit('truce_requested', { taskId: task.id, factionA: this.playerFaction, factionB: task.factionId, relationship: task.relationship });
    } else if (task.type === 'extract') {
      for (const id of [...(task.cargo ?? []), ...(task.evacuates ?? [])]) {
        const entity = this.entities.get(id); if (!entity || !['carried', 'rescued'].includes(entity.state)) continue;
        entity.state = 'evacuated'; entity.evacuated = true; entity.carrierId = null; entity.followerId = null;
        for (const member of entity.members) if (member.hp > 0) member.state = 'evacuated';
      }
      this._emit('extracted', { taskId: task.id, actorId: player.id, cargo: [...(task.cargo ?? [])], rescuedGroups: [...(task.evacuates ?? [])] });
    }
    if (task.stopsEntity) { this.entities.get(task.stopsEntity).stopped = true; this._emit('convoy_stopped', { taskId: task.id, entityId: task.stopsEntity }); }
    if (task.opensRouteId) {
      this.simulation.setRouteOpen(task.opensRouteId, true, 'operation_device');
      this._emit('route_opened', { taskId: task.id, routeId: task.opensRouteId,
        physicalGateIds: [...(task.physicalGateIds ?? [])], physicalRouteId: task.physicalRouteId ?? null });
    }
    this._emit(task.completions === 1 ? 'objective_completed' : 'objective_recovered', { taskId: task.id, taskType: task.type, label: task.label });
    if (task.completions === 1) for (const reaction of this.spec.reactions ?? []) {
      const state = this.reactions.get(reaction.id);
      if (reaction.afterTaskId === task.id && state.status === 'dormant') {
        state.status = 'announced'; state.announcedAt = this.time; state.due = this.time + reaction.delay;
        this._emit('counteroffensive_announced', { reactionId: reaction.id, frontId: reaction.targetFrontId, factionId: reaction.factionId,
          delay: reaction.delay, due: state.due, label: reaction.label });
      }
    }
    return true;
  }

  _advanceReactions() {
    for (const reaction of this.spec.reactions ?? []) {
      const state = this.reactions.get(reaction.id);
      if (state.status !== 'announced' || this.time + EPSILON < state.due) continue;
      let reason = 'no_surviving_connected_group', deployed = false;
      if (this.simulation.relationship(this.playerFaction, reaction.factionId) !== 'hostile') reason = 'relationship_no_longer_hostile';
      else {
        const groups = this.config.groups.filter(group => group.factionId === reaction.factionId).map(group => this.simulation.getGroup(group.id))
          .filter(group => group?.alive > 0 && group.frontId !== reaction.targetFrontId && !['evacuated', 'captured', 'dead'].includes(group.state))
          .sort((a, b) => Number(a.state === 'reserve') - Number(b.state === 'reserve') || a.id.localeCompare(b.id));
        for (const group of groups) {
          const answer = group.state === 'reserve' ? this.simulation.requestReinforcements(reaction.factionId, reaction.targetFrontId, group.id)
            : this.simulation.issueOrder(group.id, { type: 'attack', frontId: reaction.targetFrontId, issuer: 'scenario_counteroffensive' });
          if (!answer.accepted) { reason = answer.reason; continue; }
          state.status = 'deployed'; state.groupId = group.id; state.reason = group.state === 'reserve' ? 'announced_finite_reinforcement' : 'existing_group_retasked'; deployed = true;
          this._emit('counteroffensive_started', { reactionId: reaction.id, groupId: group.id, factionId: reaction.factionId, frontId: reaction.targetFrontId,
            label: `Contre-offensive en mouvement vers ${reaction.targetFrontId.slice(-1).toUpperCase()}`, reason: state.reason }); break;
        }
      }
      if (!deployed) { state.status = 'cancelled'; state.reason = reason; this._emit('counteroffensive_cancelled', { reactionId: reaction.id, frontId: reaction.targetFrontId,
        reason, label: 'Contre-offensive annulée : forces ou accès indisponibles.' }); }
    }
  }

  _move(entity, target, amount) {
    const length = distance(entity.position, target); if (length <= EPSILON) return 0;
    const gain = Math.min(1, amount / length), next = [entity.position[0] + (target[0] - entity.position[0]) * gain, entity.position[1] + (target[1] - entity.position[1]) * gain];
    const resolved = this.callbacks.resolvePosition?.([...next], { id: entity.id, kind: entity.kind,
      origin: [...entity.position], target: [...target], step: Math.min(amount, length) }) ?? next;
    if (finitePoint(resolved)) entity.position = [...resolved];
    return Math.min(amount, length);
  }
  _entities(delta) {
    for (const entity of this.entities.values()) {
      if (entity.hp <= 0 || entity.evacuated || entity.escaped) continue;
      const sourceTask = entity.sourceTaskId && this.tasks.get(entity.sourceTaskId);
      if (entity.state === 'world' && sourceTask?.followsEntity && !sourceTask.completions) entity.position = [...this.entities.get(sourceTask.followsEntity).position];
      if (entity.state === 'carried') {
        const carrier = this.players.get(entity.carrierId);
        if (carrier?.hp > 0) entity.position = [...carrier.position];
        else {
          entity.state = 'world'; entity.carrierId = null;
          const task = this.tasks.get(entity.sourceTaskId); task.status = 'pending'; task.progress = 0; task.position = [...entity.position];
          this._emit('item_dropped', { entityId: entity.id, position: [...entity.position], reason: 'carrier_unavailable' });
        }
      } else if (entity.state === 'rescued') {
        const follower = this.players.get(entity.followerId);
        const leader = follower?.hp > 0 ? follower : [...this.players.values()].find(player => player.hp > 0 && distance(player.position, entity.position) <= 6);
        if (leader) {
          if (entity.followerId !== leader.id || !entity.followPath.length) entity.followPath = [[...entity.position], [...leader.position]];
          entity.followerId = leader.id;
          const path = entity.followPath, last = path.at(-1);
          if (distance(last, leader.position) > .5) {
            const before = path.at(-2), dx = leader.position[0] - (before?.[0] ?? last[0]), dz = leader.position[1] - (before?.[1] ?? last[1]);
            const length = Math.hypot(dx, dz), offset = before && length ? Math.abs((last[0] - before[0]) * dz - (last[1] - before[1]) * dx) / length : Infinity;
            const forward = before && (last[0] - before[0]) * (leader.position[0] - last[0]) + (last[1] - before[1]) * (leader.position[1] - last[1]) >= 0;
            if (path.length > 1 && offset < .04 && forward) path[path.length - 1] = [...leader.position];
            else if (path.length < 4096) path.push([...leader.position]); // Never trim untraversed corners into a wall-cutting diagonal.
          }
          let remaining = 5.2 * delta;
          while (remaining > EPSILON && path.length > 1) {
            const target = path[1], gap = distance(entity.position, target), final = path.length === 2;
            if (final && gap <= 3 || gap <= EPSILON) { if (!final) { path.shift(); continue; } break; }
            remaining -= this._move(entity, target, Math.min(remaining, Math.max(0, gap - (final ? 3 : 0))));
            if (distance(entity.position, target) <= EPSILON) path.shift(); else break;
          }
          if (path.length) path[0] = [...entity.position];
        }
      } else if (entity.kind === 'convoy' && !entity.stopped) {
        const total = entity.waypoints.slice(1).reduce((sum, point, index) => sum + distance(point, entity.waypoints[index]), 0);
        let remaining = total / entity.travelSeconds * delta;
        while (remaining > EPSILON && entity.routeIndex < entity.waypoints.length - 1) {
          const target = entity.waypoints[entity.routeIndex + 1], gap = distance(entity.position, target);
          if (gap <= EPSILON) { entity.routeIndex++; continue; }
          remaining -= this._move(entity, target, remaining);
          if (distance(entity.position, target) <= EPSILON) entity.routeIndex++; else break;
        }
        if (entity.routeIndex >= entity.waypoints.length - 1) { entity.escaped = true; this._emit('convoy_escaped', { entityId: entity.id }); }
      }
    }
  }

  update(delta, actors = [], { paused = false } = {}) {
    this.paused = paused;
    if (this.disposed || this.result || this.paused || !Number.isFinite(delta) || delta <= 0 || delta > 60 || this.simulation.paused) return false;
    const battleResult = this._result(); if (battleResult) { this.result = copy(battleResult); return false; }
    this.players = this._alivePlayers(actors); this.time += delta; this._entities(delta);
    for (const id of this.spec.failOnLoss) if (this.entities.get(id)?.hp <= 0) { this._finish('defeat', `objective_lost:${id}`); return true; }
    for (const id of this.spec.failOnEscape) if (this.entities.get(id)?.escaped) { this._finish('defeat', `convoy_escaped:${id}`); return true; }
    this._advanceReactions();
    for (const [id, channel] of [...this.channels]) {
      const task = this.tasks.get(channel.taskId), player = this.players.get(id);
      const unavailable = !player || player.hp <= 0, damaged = player && player.hp < channel.hp, blocked = !unavailable && this._blocked(task, player);
      if (unavailable || damaged || blocked) {
        this.channels.delete(id); task.progress = 0; this._emit('interaction_cancelled', { taskId: task.id, actorId: id,
          reason: unavailable ? 'actor_unavailable' : damaged ? 'damage_received' : 'movement_or_prerequisite',
          label: unavailable ? 'Action interrompue : le porteur est hors de combat.' : damaged ? 'Action interrompue par un impact : mettez-vous à couvert avant de recommencer.' : `Action interrompue : ${blocked}` }); continue;
      }
      channel.elapsed = Math.min(task.duration, channel.elapsed + delta); task.progress = channel.elapsed;
      if (channel.elapsed + EPSILON >= task.duration) { this.channels.delete(id); this._complete(task, player); }
    }
    for (const task of this.tasks.values()) {
      if (task.status === 'done' || !this._ready(task)) continue;
      if (task.type === 'capture' && this._front(task.frontId)?.owner === this.playerFaction) this._complete(task);
      if (task.type === 'defend') {
        const front = this._front(task.frontId);
        if (front?.owner === this.playerFaction && !front.contested) task.progress = Math.min(task.duration, task.progress + delta);
        if (task.progress + EPSILON >= task.duration) this._complete(task);
      }
      if (task.type === 'eliminate') {
        const unit = this.uniqueUnits.has(task.uniqueId) ? this.simulation.getUnit?.(this.uniqueUnits.get(task.uniqueId)) : null;
        if (this.deadUnique.has(task.uniqueId) || unit?.state === 'dead') this._complete(task);
      }
    }
    for (const strategy of this.spec.strategies) if (strategy.tasks.every(id => this.tasks.get(id).status === 'done')) { this._finish('victory', strategy.id, strategy.label); break; }
    return true;
  }

  _finish(outcome, reason, label = null) {
    if (this.result) return false;
    const result = { outcome, reason, strategyId: outcome === 'victory' ? reason : null, label, objectiveTime: this.time };
    if (!this.simulation.finishOperation(result)) return false;
    this.result = copy(this._result() ?? result); this.channels.clear(); this._emit('narrative_finished', this.result); return true;
  }
  recordEvent(event = {}) {
    const data = event.data ?? event;
    if (this.disposed || this.result) return false;
    if (event.type === 'unit_died' && this.uniqueUnits.has(data.uniqueId)) { const size = this.deadUnique.size; this.deadUnique.add(data.uniqueId); return this.deadUnique.size !== size; }
    return false;
  }
  damageObjective(id, amount, origin) {
    const entity = this.entities.get(id), point = Array.isArray(origin) ? origin : positionOf({ position: origin });
    if (this.disposed || this.result || !entity || entity.evacuated || entity.hp <= 0 || !Number.isFinite(amount) || amount <= 0 || !finitePoint(point) || distance(point, entity.position) > 60) return false;
    if (entity.members.length) {
      const member = entity.members.find(member => member.hp > 0 && member.state !== 'evacuated'); if (!member) return false;
      member.hp = Math.max(0, member.hp - amount); if (!member.hp) member.state = 'dead'; entity.hp = entity.members.reduce((sum, member) => sum + member.hp, 0);
    } else entity.hp = Math.max(0, entity.hp - amount);
    if (entity.kind === 'convoy' && entity.hp > 0 && entity.hp <= entity.maxHp * .35) entity.stopped = true;
    this._emit(entity.hp ? 'objective_damaged' : 'objective_destroyed', { entityId: id, remainingHP: entity.hp }); return true;
  }
  getWorldEntities() {
    return [...this.entities.values()].map(entity => ({ id: entity.id, kind: entity.kind, factionId: entity.factionId, position: [...entity.position], hp: entity.hp,
      maxHp: entity.maxHp, state: entity.state, stopped: entity.stopped, escaped: entity.escaped, evacuated: entity.evacuated,
      members: entity.members.map((member, index) => ({ ...member, position: [entity.position[0] + (index % 4 - 1.5) * .8, entity.position[1] + Math.floor(index / 4) * .8] })) }));
  }
  getHUDState() {
    const noncombatants = [...this.entities.values()].flatMap(entity => entity.members), count = state => noncombatants.filter(member => member.state === state).length;
    return { operationId: this.spec.operationId, title: this.spec.title, time: this.time, result: this.result ? copy(this.result) : null,
      tasks: [...this.tasks.values()].map(task => ({ id: task.id, type: task.type, label: task.label, frontId: task.frontId,
        position: [...this._position(task)], radius: task.radius, status: task.status, available: this._ready(task),
        progress: task.progress, duration: task.duration, interactive: INTERACTIVE.has(task.type), prompt: INTERACTIVE.has(task.type) ? '[E] ' + task.label : task.label })),
      channels: [...this.channels].map(([id, channel]) => ({ actorId: id, ...channel })),
      strategies: this.spec.strategies.map(strategy => ({ ...copy(strategy), completed: strategy.tasks.filter(id => this.tasks.get(id).status === 'done').length })),
      reactions: (this.spec.reactions ?? []).map(reaction => ({ ...copy(reaction), ...copy(this.reactions.get(reaction.id)),
        remaining: this.reactions.get(reaction.id).status === 'announced' ? Math.max(0, this.reactions.get(reaction.id).due - this.time) : null })),
      noncombatants: { allocated: noncombatants.length, captive: count('captive'), rescued: count('rescued'), evacuated: count('evacuated'), dead: count('dead') },
      events: this.events.slice(-12).map(copy), entities: this.getWorldEntities(), fidelity1to1Verified: false };
  }
  getResult() { return this.result ? copy(this.result) : null; }
  serialize() {
    return { version: 1, specId: this.spec.id, specDigest: this.digest, time: this.time, nextEvent: this.nextEvent,
      tasks: [...this.tasks.values()].map(task => ({ id: task.id, status: task.status, progress: task.progress, completions: task.completions, completedAt: task.completedAt, position: [...task.position] })),
      entities: [...this.entities.values()].map(copy), reactions: [...this.reactions.values()].map(copy), channels: [...this.channels].map(copy), deadUnique: [...this.deadUnique], events: this.events.map(copy), result: this.getResult() };
  }
  restore(saved) {
    if (this.disposed || saved?.version !== 1 || saved.specId !== this.spec.id || saved.specDigest !== this.digest || !Number.isFinite(saved.time) || saved.time < 0
        || !Array.isArray(saved.tasks) || saved.tasks.length !== this.tasks.size || new Set(saved.tasks.map(task => task.id)).size !== this.tasks.size
        || !Array.isArray(saved.entities) || saved.entities.length !== this.entities.size || new Set(saved.entities.map(entity => entity.id)).size !== this.entities.size) fail('save does not match the operation');
    for (const task of saved.tasks) {
      const original = this.tasks.get(task.id);
      if (!original || !['pending', 'done'].includes(task.status) || !Number.isFinite(task.progress) || task.progress < 0 || task.progress > original.duration || !Number.isInteger(task.completions) || task.completions < 0 || !finitePoint(task.position)
          || task.status === 'done' && (!task.completions || task.progress !== original.duration || !Number.isFinite(task.completedAt) || task.completedAt > saved.time + EPSILON)) fail('invalid saved task');
    }
    for (const entity of saved.entities) {
      const original = this.entities.get(entity.id);
      if (!original || !finitePoint(entity.position) || entity.kind !== original.kind || entity.maxHp !== original.maxHp || !Number.isFinite(entity.hp) || entity.hp < 0 || entity.hp > original.maxHp || !Array.isArray(entity.members) || entity.members.length !== original.members.length || !['world', 'carried', 'rescued', 'evacuated'].includes(entity.state)
          || entity.members.some((member, index) => member.id !== original.members[index].id || !Number.isFinite(member.hp) || member.hp < 0 || member.hp > 50 || !['captive', 'rescued', 'evacuated', 'dead'].includes(member.state) || (member.hp === 0) !== (member.state === 'dead'))
          || entity.members.length && entity.hp !== entity.members.reduce((sum, member) => sum + member.hp, 0)
          || entity.state === 'carried' && (!original.carry || !entity.carrierId)
          || (entity.state === 'evacuated') !== (entity.evacuated === true)
          || !Array.isArray(entity.followPath) || entity.followPath.length > 4096 || entity.followPath.some(point => !finitePoint(point))
          || entity.kind === 'convoy' && (!Number.isInteger(entity.routeIndex) || entity.routeIndex < 0 || entity.routeIndex >= original.waypoints.length || JSON.stringify(entity.waypoints) !== JSON.stringify(original.waypoints) || entity.travelSeconds !== original.travelSeconds)) fail('invalid saved entity or civilian ledger');
    }
    const channelTasks = new Set();
    for (const [id, channel] of saved.channels ?? []) {
      if (typeof id !== 'string' || id.length > 96 || !this.tasks.has(channel.taskId) || channelTasks.has(channel.taskId) || !Number.isFinite(channel.elapsed) || channel.elapsed < 0 || channel.elapsed > this.tasks.get(channel.taskId).duration || !Number.isFinite(channel.hp) || channel.hp <= 0) fail('invalid saved interaction');
      channelTasks.add(channel.taskId);
    }
    if (!Number.isInteger(saved.nextEvent) || saved.nextEvent < 0 || !Array.isArray(saved.events) || saved.events.length > 256 || !Array.isArray(saved.deadUnique) || saved.deadUnique.some(id => !this.uniqueUnits.has(id))) fail('invalid saved objective events');
    if (saved.result && (!['victory', 'defeat'].includes(saved.result.outcome) || typeof saved.result.reason !== 'string' || saved.result.reason.length > 120)) fail('invalid saved result');
    if (saved.result?.outcome === 'victory' && !this.spec.strategies.some(strategy => strategy.tasks.every(id => saved.tasks.find(task => task.id === id).status === 'done'))) fail('saved victory has no completed strategy');
    if (!Array.isArray(saved.reactions) || saved.reactions.length !== this.reactions.size || new Set(saved.reactions.map(state => state.id)).size !== this.reactions.size) fail('invalid saved reaction registry');
    for (const state of saved.reactions) {
      const spec = this.spec.reactions.find(reaction => reaction.id === state.id);
      const trigger = spec && saved.tasks.find(task => task.id === spec.afterTaskId);
      if (!spec || !['dormant', 'announced', 'deployed', 'cancelled'].includes(state.status)
        || state.status === 'dormant' && (state.due !== null || state.announcedAt !== null || state.groupId !== null || state.reason !== null)
        || state.status !== 'dormant' && (!Number.isFinite(state.announcedAt) || state.announcedAt < 0 || state.announcedAt > saved.time || state.due !== state.announcedAt + spec.delay)
        || state.status !== 'dormant' && (!trigger?.completions || !Number.isFinite(trigger.completedAt) || trigger.completedAt > state.announcedAt)
        || state.status === 'announced' && (state.groupId !== null || state.reason !== null)
        || state.status === 'deployed' && (!state.groupId || !state.reason)
        || state.status === 'cancelled' && (state.groupId !== null || !state.reason)
        || state.groupId !== null && !this.config.groups.some(group => group.id === state.groupId && group.factionId === spec.factionId)
        || state.reason !== null && (typeof state.reason !== 'string' || state.reason.length > 120)) fail('invalid saved reaction');
    }
    this.time = saved.time; this.nextEvent = saved.nextEvent;
    for (const task of saved.tasks) Object.assign(this.tasks.get(task.id), copy(task));
    this.entities = new Map(saved.entities.map(entity => [entity.id, copy(entity)])); this.channels = new Map(copy(saved.channels ?? []));
    this.reactions = new Map(saved.reactions.map(state => [state.id, copy(state)]));
    this.deadUnique = new Set(saved.deadUnique ?? []); this.events = copy(saved.events ?? []); this.result = saved.result ? copy(saved.result) : null;
    return true;
  }
  dispose() { if (this.disposed) return; this.disposed = true; this.channels.clear(); this.players.clear(); }
}
