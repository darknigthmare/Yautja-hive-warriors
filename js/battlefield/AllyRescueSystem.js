/* One recoverable casualty per allocated allied Yautja. Population identity is
 * retained while the incapacitated actor contributes neither fire nor capture.
 * Timers use update(delta), including while the body is simulated off screen.
 * This is an original gameplay rule, not a claim about screen choreography. */
import * as THREE from 'three';

const copy = value => JSON.parse(JSON.stringify(value));
const refused = reason => ({ accepted: false, reason });
const finitePoint = value => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
const terminal = unit => !unit || unit.hp <= 0 || ['dead', 'evacuated', 'captured'].includes(unit.state);
const live = player => player?.hp > 0 && player.position?.isVector3;
const statuses = new Set(['downed', 'rescued', 'dead', 'captured', 'evacuated']);
const pointOf = actor => actor?.position?.isVector3 ? actor.position : actor?.mesh?.position;

export class AllyRescueSystem {
  constructor({ simulation, actors, players = () => [], environment = null,
    bleedoutSeconds = 25, channelSeconds = 3, rescueRange = 3.5, reviveFraction = .25 } = {}) {
    if (!simulation?.getUnit || !simulation?.setUnitIncapacitated || !(actors instanceof Map) && typeof actors !== 'function') throw new TypeError('Rescue requires a persistent operation and its actor projection');
    if (![bleedoutSeconds, channelSeconds, rescueRange, reviveFraction].every(Number.isFinite) || bleedoutSeconds < 5 || bleedoutSeconds > 120 || channelSeconds < .5 || channelSeconds > 15 || rescueRange < 1 || rescueRange > 6 || reviveFraction <= 0 || reviveFraction > .5) throw new TypeError('Invalid finite rescue rules');
    this.simulation = simulation; this.actors = actors; this.players = typeof players === 'function' ? players : () => players;
    this.environment = environment; this.bleedoutSeconds = bleedoutSeconds; this.channelSeconds = channelSeconds;
    this.rescueRange = rescueRange; this.reviveFraction = reviveFraction;
    this.records = new Map(); this.channels = new Map(); this.events = []; this.managers = new Map(); this.poses = new WeakMap(); this.disposed = false;
  }

  _actors() { return typeof this.actors === 'function' ? this.actors() : this.actors; }
  _entry(id) { const entry = this._actors().get(id); return entry?.actor ? entry : entry ? { actor: entry, manager: entry.combatManager } : null; }
  _players() { return this.players().filter(Boolean); }
  _playerId(player) { const index = this._players().indexOf(player); return index < 0 ? null : player.isPlayer2 || index === 1 ? 'player2' : 'player1'; }
  _allied(unit) { return unit && this.simulation.relationship(unit.factionId, this.simulation.config.playerFaction) === 'allied'; }
  hasDowned(id) { const record = this.records.get(id); return record?.status === 'downed' && record.remaining > 0; }
  _emit(type, details = {}) {
    const event = { type, time: this.simulation.time, ...details }; this.events.push(event); if (this.events.length > 64) this.events.shift();
    this.simulation._emit?.(type, details, 1); return event;
  }

  bindManager(manager) {
    if (this.disposed || !manager?.defeatCombatant) throw new TypeError('A rescue-aware combat manager is required');
    if (!this.managers.has(manager)) { this.managers.set(manager, manager.rescueSystem); manager.rescueSystem = this; }
    return this;
  }

  /** Called before the real death ledger, only on the first lethal hit. */
  tryDown(actor, details = {}) {
    const id = actor?.battleUnitId, unit = id && this.simulation.getUnit(id);
    if (this.disposed || this.simulation.disposed || this.simulation.result || details.rescueFinal === true || !actor?.mesh || !unit || terminal(unit) || !this._allied(unit) || this.records.has(id) || actor.isDowned || actor._combatDisposed || actor.combatDeathEvent) return false;
    const profile = this.simulation.profiles.get(unit.profileId);
    if (!['yautja', 'clan_hunter', 'honor_guard', 'bad_blood'].includes(unit.actorType) || profile?.rescuable === false) return false;
    const position = actor.mesh.position.toArray();
    if (!finitePoint(position)) return false;
    const record = { unitId: id, status: 'downed', remaining: this.bleedoutSeconds, position,
      maxHp: unit.maxHp, downedOnce: true, recoveryRemaining: 0, cause: String(details.cause ?? 'combat').slice(0, 80),
      killerFaction: this.simulation.factions.has(details.killerFaction) ? details.killerFaction : null };
    actor.hp = 1; actor.isDowned = true; actor.isRescueRecovering = false;
    if (!this.simulation.syncUnit(id, { hp: 1, position: [position[0], position[2]] }) || !this.simulation.setUnitIncapacitated(id, true)) { actor.hp = 0; actor.isDowned = false; return false; }
    this.records.set(id, record); this._pose(actor, true, 0);
    this._emit('ally_downed', { unitId: id, groupId: unit.groupId, remaining: record.remaining, label: 'Allié à terre : approchez et maintenez le secours.' });
    return true;
  }

  _pose(actor, downed, delta) {
    let state = this.poses.get(actor);
    if (!state && downed) {
      const pivot = new THREE.Group(); pivot.name = 'ally-rescue-posture';
      const children = [...actor.mesh.children]; actor.mesh.add(pivot); children.forEach(child => pivot.add(child));
      state = { pivot, angle: 0 }; this.poses.set(actor, state);
    }
    if (!state) return;
    const target = downed ? -Math.PI * .5 : 0;
    state.angle = THREE.MathUtils.lerp(state.angle, target, 1 - Math.exp(-12 * Math.max(0, delta)));
    state.pivot.rotation.z = state.angle; state.pivot.position.y = Math.sin(Math.abs(state.angle)) * Math.max(.65, (actor.radius ?? 1.3) * .8);
    actor.mesh.userData.rescueState = downed ? 'downed' : actor.isRescueRecovering ? 'recovering' : 'standing';
  }

  onMaterialize(actor) {
    if (this.disposed || !actor?.battleUnitId) return false;
    const record = this.records.get(actor.battleUnitId), unit = this.simulation.getUnit(actor.battleUnitId);
    if (record?.status === 'downed' && !terminal(unit)) {
      actor.hp = 1; actor.isDowned = true; actor.isRescueRecovering = false;
      // The bridge has already resolved the physical X/Z placement. Restore
      // the saved layer through the current terrain instead of undoing a
      // collapsed bridge or pushing a body back into a newly solid volume.
      const point = actor.mesh.position;
      const height = this.environment?.getElevationAt?.(point.x, point.z, record.position[1]);
      point.y = Number.isFinite(height) ? height : record.position[1]; record.position = point.toArray();
      this._pose(actor, true, 1); return true;
    }
    actor.isDowned = unit?.incapacitated === true;
    actor.isRescueRecovering = record?.status === 'rescued' && record.recoveryRemaining > 0;
    // An incapacitated unit without its timer cannot become an immortal body.
    // restore() rejects such a checkpoint; this branch also handles bad wiring.
    if (actor.isDowned) {
      this.records.set(actor.battleUnitId, { unitId: actor.battleUnitId, status: 'downed', remaining: 0,
        position: actor.mesh.position.toArray(), maxHp: unit.maxHp, downedOnce: true, recoveryRemaining: 0, cause: 'missing_rescue_timer', killerFaction: null });
      actor.hp = 1; this._pose(actor, true, 1); return true;
    }
    return false;
  }

  onDematerialize(id, snapshot) {
    const record = this.records.get(id); if (!record || record.status !== 'downed') return false;
    const position = pointOf(snapshot)?.toArray?.() ?? snapshot?.position;
    if (finitePoint(position)) record.position = [...position];
    else if (Array.isArray(position) && position.length === 2 && position.every(Number.isFinite)) { record.position[0] = position[0]; record.position[2] = position[1]; }
    this._cancelPatient(id, 'ally_not_visible'); return true;
  }

  _reachable(player, actor) {
    const position = pointOf(actor);
    if (!live(player) || !position || Math.hypot(player.position.x - position.x, player.position.z - position.z) > this.rescueRange || Math.abs(player.position.y - position.y) > 2.2) return false;
    if (!this.environment?.hasLineOfSight) return true;
    return this.environment.hasLineOfSight(player.position.clone().add(new THREE.Vector3(0, 1.2, 0)), position.clone().add(new THREE.Vector3(0, .6, 0))) !== false;
  }

  _available(id, player) {
    const record = this.records.get(id), entry = this._entry(id), unit = this.simulation.getUnit(id);
    return record?.status === 'downed' && record.remaining > 0 && !terminal(unit) && unit.state === 'active' && this._allied(unit) && entry?.actor.hp > 0 && entry.actor.isDowned && this._reachable(player, entry.actor);
  }

  interact(player, unitId = null) {
    if (this.disposed || this.simulation.disposed || this.simulation.result || this.simulation.paused) return refused('operation_unavailable');
    const playerId = this._playerId(player); if (!playerId || !live(player)) return refused('living_operation_rescuer_required');
    const eligible = [...this.records.keys()].filter(id => this._available(id, player));
    if (unitId !== null && !eligible.includes(unitId)) return refused('downed_ally_out_of_reach');
    unitId ??= eligible.sort((a, b) => pointOf(this._entry(a).actor).distanceToSquared(player.position) - pointOf(this._entry(b).actor).distanceToSquared(player.position))[0];
    if (!unitId) return refused('downed_ally_out_of_reach');
    if (!Number.isInteger(player.medicompCharges) || player.medicompCharges <= 0) return refused('medicomp_required');
    const current = this.channels.get(playerId);
    if (current?.unitId === unitId) return { accepted: true, existing: true, unitId, remaining: this.channelSeconds - current.progress };
    if ([...this.channels.values()].some(channel => channel.unitId === unitId)) return refused('ally_already_being_rescued');
    if (current) this._cancel(playerId, 'changed_patient');
    this.channels.set(playerId, { playerId, unitId, progress: 0, start: player.position.toArray(), previousHp: player.hp });
    this._emit('ally_rescue_started', { playerId, unitId, label: 'Secours en cours : restez immobile et à couvert.' });
    return { accepted: true, unitId, remaining: this.channelSeconds };
  }

  _cancel(playerId, reason) {
    const channel = this.channels.get(playerId); if (!channel) return false;
    this.channels.delete(playerId);
    const label = reason === 'rescuer_hit' ? 'Secours interrompu par un impact.' : 'Secours interrompu : restez près de l’allié et à couvert.';
    this._emit('ally_rescue_interrupted', { playerId, unitId: channel.unitId, reason, label }); return true;
  }
  _cancelPatient(unitId, reason) { for (const [playerId, channel] of this.channels) if (channel.unitId === unitId) this._cancel(playerId, reason); }

  _die(record, reason, details = {}) {
    if (record.status !== 'downed') return false;
    record.status = 'dead'; record.remaining = 0; record.recoveryRemaining = 0; this._cancelPatient(record.unitId, 'ally_lost');
    const entry = this._entry(record.unitId);
    this.simulation.setUnitIncapacitated(record.unitId, false);
    const death = { cause: reason, killerFaction: details.killerFaction ?? record.killerFaction, rescueFinal: true };
    if (entry?.actor) { entry.actor.isDowned = false; entry.actor.isRescueRecovering = false; entry.actor.hp = 0; entry.manager?.defeatCombatant?.(entry.actor, death); }
    this.simulation.recordDeath({ entityId: record.unitId, ...death });
    this._emit('ally_rescue_lost', { unitId: record.unitId, reason, label: 'L’allié à terre a succombé.' }); return true;
  }

  onActorDeath(actor, details = {}) {
    const record = this.records.get(actor?.battleUnitId); if (!record || record.status === 'dead') return false;
    const wasDowned = record.status === 'downed';
    record.status = 'dead'; record.remaining = 0; record.recoveryRemaining = 0;
    actor.isDowned = false; actor.isRescueRecovering = false;
    this.simulation.setUnitIncapacitated(record.unitId, false); this._cancelPatient(record.unitId, 'ally_lost');
    this._emit('ally_rescue_lost', { unitId: record.unitId, reason: details.cause ?? 'finished', label: wasDowned ? 'L’allié à terre a succombé.' : 'Un allié précédemment secouru a été perdu au combat.' }); return true;
  }

  _observeExit(record, unit) {
    if (!['captured', 'evacuated'].includes(unit?.state) || record.status === unit.state) return false;
    record.status = unit.state; record.remaining = 0; record.recoveryRemaining = 0;
    this._cancelPatient(record.unitId, 'ally_unavailable');
    const entry = this._entry(record.unitId);
    if (entry?.actor) { entry.actor.isDowned = false; entry.actor.isRescueRecovering = false; entry.manager?.despawnBattleUnit?.(record.unitId); }
    this._emit('ally_rescue_unavailable', { unitId: record.unitId, reason: unit.state, label: unit.state === 'evacuated' ? 'L’allié blessé a été évacué.' : 'L’allié blessé a été capturé.' });
    return true;
  }

  _observeRescuedTerminal(record, unit) {
    if (record.status !== 'rescued') return false;
    if (this._observeExit(record, unit)) return true;
    if (unit?.state !== 'dead') return false;
    // The strategic engine already owns this loss. Reconcile our medical
    // history without submitting another death or a second combat reward.
    record.status = 'dead'; record.remaining = 0; record.recoveryRemaining = 0;
    this._cancelPatient(record.unitId, 'ally_lost');
    this._emit('ally_rescue_lost', { unitId: record.unitId, reason: 'distant_combat', label: 'Un allié précédemment secouru a été perdu au combat.' });
    return true;
  }

  update(delta) {
    if (this.disposed || !Number.isFinite(delta) || delta <= 0 || this.simulation.paused || this.simulation.disposed || this.simulation.result) return false;
    const rescuedAt = new Map();
    for (const [playerId, channel] of [...this.channels]) {
      const player = this._players().find(item => this._playerId(item) === playerId);
      if (!live(player)) { this._cancel(playerId, 'rescuer_lost'); continue; }
      if (player.hp < channel.previousHp) { this._cancel(playerId, 'rescuer_hit'); continue; }
      if (channel.resumePending) {
        const record = this.records.get(channel.unitId), unit = this.simulation.getUnit(channel.unitId), actor = this._entry(channel.unitId)?.actor;
        const originalPosition = record && new THREE.Vector3(...record.position);
        if (record?.status !== 'downed' || terminal(unit) || !this._allied(unit) || Math.hypot(player.position.x - channel.start[0], player.position.z - channel.start[2]) > .65 || !originalPosition || !this._reachable(player, { position: originalPosition })) { this._cancel(playerId, 'rescuer_moved_or_cover_lost'); continue; }
        channel.previousHp = player.hp;
        if (!actor || unit.state !== 'active') continue;
        channel.resumePending = false;
      }
      if (Math.hypot(player.position.x - channel.start[0], player.position.z - channel.start[2]) > .65 || !this._available(channel.unitId, player)) { this._cancel(playerId, 'rescuer_moved_or_cover_lost'); continue; }
      const record = this.records.get(channel.unitId), required = this.channelSeconds - channel.progress;
      channel.previousHp = player.hp; channel.progress = Math.min(this.channelSeconds, channel.progress + Math.min(delta, record.remaining));
      // Resolve events within the frame, rather than letting a long frame kill
      // a patient whose rescue completed earlier. A simultaneous tie is lethal.
      if (required > delta + 1e-8 || record.remaining <= required + 1e-8) continue;
      if (!Number.isInteger(player.medicompCharges) || player.medicompCharges <= 0) { this._cancel(playerId, 'medicomp_required'); continue; }
      const actor = this._entry(channel.unitId).actor;
      const hp = Math.max(1, Math.floor(record.maxHp * this.reviveFraction));
      if (!this.simulation.syncUnit(channel.unitId, { hp }) || !this.simulation.setUnitIncapacitated(channel.unitId, false)) { this._cancel(playerId, 'ally_lost'); continue; }
      player.medicompCharges--; actor.hp = hp; actor.isDowned = false; actor.isRescueRecovering = true;
      record.status = 'rescued'; record.remaining = 0; record.recoveryRemaining = .45; this.channels.delete(playerId);
      rescuedAt.set(record.unitId, required);
      this._emit('ally_rescued', { unitId: channel.unitId, playerId, hp, medicompCharges: player.medicompCharges, label: 'Allié secouru : un medicomp consommé.' });
    }
    for (const record of this.records.values()) {
      const unit = this.simulation.getUnit(record.unitId), actor = this._entry(record.unitId)?.actor;
      if (record.status === 'downed') {
        if (this._observeExit(record, unit)) continue;
        if (terminal(unit) || actor && actor.hp <= 0) { this._die(record, actor?.lastDamageFaction ? 'finished' : 'casualty', { killerFaction: actor?.lastDamageFaction }); continue; }
        if (actor) { actor.isDowned = true; record.position = actor.mesh.position.toArray(); this._pose(actor, true, delta); }
        record.remaining = Math.max(0, record.remaining - delta);
        if (record.remaining <= 1e-8) this._die(record, 'bleedout');
      } else if (record.status === 'rescued') {
        if (this._observeRescuedTerminal(record, unit)) continue;
        const recoveryStep = Math.max(0, delta - (rescuedAt.get(record.unitId) ?? 0));
        record.recoveryRemaining = Math.max(0, record.recoveryRemaining - recoveryStep);
        if (actor) { actor.isRescueRecovering = record.recoveryRemaining > 0; this._pose(actor, false, delta); }
      }
    }
    return true;
  }

  getPrompt(player) {
    const playerId = this._playerId(player); if (!playerId || !live(player) || this.disposed) return null;
    const channel = this.channels.get(playerId);
    if (channel) return { unitId: channel.unitId, channeling: true, progress: channel.progress / this.channelSeconds, label: channel.resumePending ? 'REPRISE DU SECOURS — RETOUR DE L’ALLIÉ EN COURS' : `SECOURS : ${Math.floor(channel.progress / this.channelSeconds * 100)} % — restez à couvert` };
    const record = [...this.records.values()].find(item => this._available(item.unitId, player));
    return record ? { unitId: record.unitId, channeling: false, progress: 0, label: player.medicompCharges > 0 ? `[E] SECOURIR L’ALLIÉ — 1 MEDICOMP · ${Math.ceil(record.remaining)} s` : `ALLIÉ À TERRE — MEDICOMP REQUIS · ${Math.ceil(record.remaining)} s` } : null;
  }
  getState() { return { version: 1, operationId: this.simulation.config.id, rules: { bleedoutSeconds: this.bleedoutSeconds, channelSeconds: this.channelSeconds, rescueRange: this.rescueRange, reviveFraction: this.reviveFraction }, records: [...this.records.values()].map(copy), channels: [...this.channels.values()].map(copy), events: this.events.map(copy) }; }
  serialize() {
    for (const record of this.records.values()) {
      const unit = this.simulation.getUnit(record.unitId);
      if (record.status === 'downed') this._observeExit(record, unit);
      else this._observeRescuedTerminal(record, unit);
    }
    return this.getState();
  }

  restore(saved) {
    const expectedRules = this.getState().rules;
    if (saved?.version !== 1 || saved.operationId !== this.simulation.config.id || !Array.isArray(saved.records) || saved.records.length > this.simulation.units.size || !Array.isArray(saved.channels) || saved.channels.length > 2 || !saved.rules || Object.keys(saved.rules).length !== Object.keys(expectedRules).length || Object.entries(expectedRules).some(([key, value]) => saved.rules[key] !== value) || saved.events !== undefined && (!Array.isArray(saved.events) || saved.events.length > 64)) throw new TypeError('Rescue checkpoint does not match this operation and its finite rules');
    const records = new Map(), channels = new Map();
    for (const record of saved.records) {
      const unit = this.simulation.getUnit(record.unitId);
      if (!unit || records.has(record.unitId) || !statuses.has(record.status) || record.downedOnce !== true || !finitePoint(record.position) || record.maxHp !== unit.maxHp || !Number.isFinite(record.remaining) || record.remaining < 0 || record.remaining > this.bleedoutSeconds || !Number.isFinite(record.recoveryRemaining) || record.recoveryRemaining < 0 || record.recoveryRemaining > .45 || record.status !== 'downed' && record.remaining !== 0 || record.status === 'downed' && (terminal(unit) || unit.hp !== 1 || unit.incapacitated !== true) || record.status === 'dead' && unit.state !== 'dead' || ['captured', 'evacuated'].includes(record.status) && unit.state !== record.status || record.status === 'rescued' && unit.incapacitated) throw new TypeError('Invalid persistent rescue casualty');
      records.set(record.unitId, Object.fromEntries(['unitId', 'status', 'remaining', 'position', 'maxHp', 'downedOnce', 'recoveryRemaining', 'cause', 'killerFaction'].map(key => [key, copy(record[key] ?? null)])));
    }
    for (const unit of this.simulation.units.values()) if (unit.incapacitated && !records.has(unit.id)) throw new TypeError('Incapacitated unit has no saved rescue timer');
    for (const channel of saved.channels) {
      if (!['player1', 'player2'].includes(channel.playerId) || channels.has(channel.playerId) || [...channels.values()].some(item => item.unitId === channel.unitId) || records.get(channel.unitId)?.status !== 'downed' || !finitePoint(channel.start) || !Number.isFinite(channel.progress) || channel.progress < 0 || channel.progress > this.channelSeconds || !Number.isFinite(channel.previousHp) || channel.previousHp <= 0) throw new TypeError('Invalid saved rescue channel');
      channels.set(channel.playerId, { ...Object.fromEntries(['playerId', 'unitId', 'progress', 'start', 'previousHp'].map(key => [key, copy(channel[key])])), resumePending: true });
    }
    this.records = records; this.channels = channels; this.events = Array.isArray(saved.events) ? copy(saved.events).slice(-64) : [];
    for (const record of records.values()) this._observeRescuedTerminal(record, this.simulation.getUnit(record.unitId));
    for (const [id] of this._actors()) this.onMaterialize(this._entry(id)?.actor);
    return true;
  }

  dispose() {
    if (this.disposed) return; this.disposed = true;
    for (const [manager, previous] of this.managers) if (manager.rescueSystem === this) manager.rescueSystem = previous;
    this.managers.clear(); this.channels.clear(); this.records.clear(); this.events.length = 0; this.poses = new WeakMap();
  }
}
