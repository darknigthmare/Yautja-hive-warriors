// Shared, simulation-time-independent objectives for a connected battlefield.
// Geometry, enemy spawning and the HUD consume this state; none are owned here.

const OBJECTIVE_TYPES = new Set(['kills', 'commander', 'interact', 'boss']);
const positive = value => Number.isFinite(value) && value > 0;

function positionOf(value) {
  const position = value?.position ?? value;
  if (Array.isArray(position) && position.length >= 2) {
    const z = position.length >= 3 ? position[2] : position[1];
    if (Number.isFinite(position[0]) && Number.isFinite(z)) return { x: position[0], z };
  }
  if (Number.isFinite(position?.x) && Number.isFinite(position?.z)) return { x: position.x, z: position.z };
  return null;
}

const inside = (position, bounds) => position && position.x >= bounds.minX && position.x <= bounds.maxX && position.z >= bounds.minZ && position.z <= bounds.maxZ;

function validateLayout(layout) {
  if (!layout || !Array.isArray(layout.sectors) || !layout.sectors.length || layout.sectors.length > 32 || !Array.isArray(layout.gates)) {
    throw new Error('BattlefieldProgression requires a bounded sector/gate layout');
  }
  const ids = new Set();
  for (const sector of layout.sectors) {
    if (typeof sector?.id !== 'string' || !sector.id || ids.has(sector.id)) throw new Error('BattlefieldProgression sector IDs must be unique');
    ids.add(sector.id);
    const bounds = sector.bounds;
    if (!bounds || !['minX', 'maxX', 'minZ', 'maxZ'].every(key => Number.isFinite(bounds[key])) || bounds.minX >= bounds.maxX || bounds.minZ >= bounds.maxZ) {
      throw new Error(`BattlefieldProgression invalid sector bounds: ${sector.id}`);
    }
    const objective = sector.objective;
    if (!objective || !OBJECTIVE_TYPES.has(objective.type)) throw new Error(`BattlefieldProgression invalid objective: ${sector.id}`);
    if (objective.type === 'kills' && (!Number.isInteger(objective.target) || objective.target < 1 || objective.target > 10000)) throw new Error('BattlefieldProgression kill target must be a positive integer');
    if (objective.type === 'interact' && (!inside(positionOf(objective.position), bounds) || !positive(objective.radius ?? 5))) throw new Error('BattlefieldProgression interaction needs an in-zone position and positive radius');
    if (objective.defenseTarget !== undefined && (objective.type !== 'interact' || !Number.isInteger(objective.defenseTarget) || objective.defenseTarget < 1 || objective.defenseTarget > 200)) {
      throw new Error('BattlefieldProgression relay defense target must be a bounded positive integer on an interaction');
    }
  }
  const entry = layout.entrySectorId ?? layout.sectors[0].id;
  if (!ids.has(entry)) throw new Error('BattlefieldProgression missing entry sector');
  const gateIds = new Set();
  for (const gate of layout.gates) {
    if (typeof gate?.id !== 'string' || !gate.id || gateIds.has(gate.id) || !ids.has(gate.from) || !ids.has(gate.to) || gate.from === gate.to) throw new Error('BattlefieldProgression invalid or duplicate gate');
    gateIds.add(gate.id);
  }
  const reached = new Set([entry]);
  for (let pass = 0; pass < layout.sectors.length; pass++) {
    for (const gate of layout.gates) if (reached.has(gate.from)) reached.add(gate.to);
  }
  if (reached.size !== ids.size) throw new Error('BattlefieldProgression layout contains an unreachable sector');
  return entry;
}

export class BattlefieldProgression {
  constructor(layout) {
    validateLayout(layout);
    // Prevent a caller's decoration/runtime edits from changing active rules.
    this.layout = structuredClone(layout);
    this._entry = this.layout.entrySectorId ?? this.layout.sectors[0].id;
    this._byId = new Map(this.layout.sectors.map((sector, index) => [sector.id, { ...sector, index }]));
    this.reset();
  }

  reset() {
    this._states = new Map(this.layout.sectors.map(sector => [sector.id, { entered: false, completed: false, kills: 0, defenseKills: 0, commanderDefeated: false, bossDefeated: false, interacted: false }]));
    this._unlocked = new Set([this._entry]);
    this._openGates = new Set();
    this._events = [];
    this._currentId = this._entry;
    this.complete = false;
    return this;
  }

  get currentSector() { return this._byId.get(this._currentId); }
  get currentSectorIndex() { return this.currentSector.index; }
  get currentState() { return this.getSectorState(this._currentId); }
  get openGateIds() { return [...this._openGates]; }
  get unlockedSectorIds() { return [...this._unlocked]; }
  get completedSectorIds() { return [...this._states].filter(([, state]) => state.completed).map(([id]) => id); }
  get gates() { return this.layout.gates.map(gate => ({ ...gate, open: this._openGates.has(gate.id) })); }
  get progress() {
    const state = this._states.get(this._currentId), objective = this.currentSector.objective;
    const counterattack = objective.type === 'interact' && objective.defenseTarget && state.interacted;
    return { sectorId: this._currentId, index: this.currentSector.index, total: this.layout.sectors.length, ...state,
      current: objective.type === 'kills' ? state.kills : counterattack ? state.defenseKills : Number(state.completed),
      target: objective.type === 'kills' ? objective.target : counterattack ? objective.defenseTarget : 1 };
  }

  get nextSector() {
    const next = this.layout.gates.find(gate => gate.from === this._currentId && this._openGates.has(gate.id) && !this._states.get(gate.to).completed);
    return next ? this._byId.get(next.to) : null;
  }

  get objectivePosition() {
    const sector = this.currentState.completed && this.nextSector ? this.nextSector : this.currentSector;
    return positionOf(sector.objective.position ?? sector.center);
  }

  get objectiveText() {
    if (this.complete) return 'CHAMP DE BATAILLE SÉCURISÉ';
    const sector = this.currentSector, state = this._states.get(sector.id), objective = sector.objective;
    if (state.completed) return this.nextSector ? `PASSAGE OUVERT — REJOIGNEZ ${this.nextSector.name}` : 'ZONE SÉCURISÉE';
    if (!state.entered) return `REJOIGNEZ ${sector.name}`;
    if (objective.type === 'kills') return `${objective.label ?? 'RÉDUISEZ LES FORCES ENNEMIES'} : ${state.kills}/${objective.target}`;
    if (objective.type === 'interact') {
      if (objective.defenseTarget && state.interacted) return `${objective.defenseLabel ?? 'REPOUSSEZ LA CONTRE-ATTAQUE'} : ${state.defenseKills}/${objective.defenseTarget}`;
      return `${objective.label ?? 'ACTIVEZ LE RELAIS'} — APPROCHEZ ET INTERAGISSEZ${objective.defenseTarget ? ` · CONTRE-ATTAQUE : ${objective.defenseTarget} ENNEMIS` : ''}`;
    }
    return objective.label ?? (objective.type === 'boss' ? 'VAINQUEZ LE BOSS DE LA ZONE' : 'ÉLIMINEZ LE COMMANDANT');
  }

  isGateOpen(id) { return this._openGates.has(id); }
  isSectorUnlocked(id) { return this._unlocked.has(id); }
  getSectorState(id) {
    const state = this._states.get(id);
    if (!state) return null;
    const objective = this._byId.get(id).objective;
    return { ...state, ...(objective.type === 'interact' ? { relayPhase: state.completed ? 'secured' : state.interacted ? 'counterattack' : 'awaiting-activation' } : {}) };
  }
  drainEvents() { const events = this._events; this._events = []; return events; }
  _emit(type, detail = {}) { this._events.push({ type, ...detail }); }
  _since(index) { return this._events.slice(index); }

  update(players = []) {
    const firstEvent = this._events.length;
    const positions = (Array.isArray(players) ? players : [players]).filter(player => player?.hp === undefined || player.hp > 0).map(positionOf).filter(Boolean);
    const candidates = [...this._byId.values()].filter(sector => this._unlocked.has(sector.id) && !this._states.get(sector.id).completed && positions.some(position => inside(position, sector.bounds)));
    // In co-op, the furthest unlocked active sector carries the shared objective.
    candidates.sort((a, b) => b.index - a.index);
    if (candidates.length) {
      const sector = candidates[0], state = this._states.get(sector.id);
      this._currentId = sector.id;
      if (!state.entered) {
        state.entered = true;
        this._emit('sector-entered', { sectorId: sector.id, index: sector.index, objective: { ...sector.objective } });
      }
    }
    return this._since(firstEvent);
  }

  _resolveRecord(record = {}) {
    const sector = this._byId.get(record.sectorId ?? this._currentId);
    if (!sector || !this._unlocked.has(sector.id)) return null;
    const state = this._states.get(sector.id);
    if (!state.entered || state.completed) return null;
    const position = record.position === undefined ? null : positionOf(record.position);
    // A known spawn retains its objective sector when kited through an open
    // corridor. Unassigned deaths need an actual in-zone position instead.
    if (record.position !== undefined && (!position || (record.sectorId === undefined && !inside(position, sector.bounds)))) return null;
    return { sector, state };
  }

  recordKill(record = {}) {
    const firstEvent = this._events.length;
    if (typeof record === 'number') record = { count: record };
    const count = record.count ?? 1;
    if (!Number.isInteger(count) || count < 1) return [];
    const resolved = this._resolveRecord(record);
    if (!resolved) return [];
    const { sector, state } = resolved, objective = sector.objective;
    if (objective.type === 'kills') {
      state.kills = Math.min(objective.target, state.kills + count);
      this._emit('objective-progress', { sectorId: sector.id, current: state.kills, target: objective.target });
      if (state.kills >= objective.target) this._completeSector(sector);
    } else if (objective.type === 'interact' && objective.defenseTarget && state.interacted) {
      // Only deaths after activation contribute. A known encounter enemy may
      // be kited into its open corridor without making the finite quota fail.
      state.defenseKills = Math.min(objective.defenseTarget, state.defenseKills + count);
      this._emit('objective-progress', { sectorId: sector.id, current: state.defenseKills, target: objective.defenseTarget, phase: 'counterattack' });
      if (state.defenseKills >= objective.defenseTarget) this._completeSector(sector);
    } else if (objective.type === 'commander' && record.kind === 'commander') {
      state.commanderDefeated = true;
      this._completeSector(sector);
    } else if (objective.type === 'boss' && record.kind === 'boss') {
      state.bossDefeated = true;
      this._completeSector(sector);
    }
    return this._since(firstEvent);
  }

  recordBossDefeat(record = {}) { return this.recordKill({ ...record, kind: 'boss', count: 1 }); }

  interact(player) {
    const firstEvent = this._events.length;
    if (player?.hp !== undefined && player.hp <= 0) return [];
    const sector = this.currentSector, state = this._states.get(sector.id), objective = sector.objective;
    const position = positionOf(player), target = positionOf(objective.position);
    if (objective.type !== 'interact' || !state.entered || state.completed || state.interacted || !position || !target || !inside(position, sector.bounds)) return [];
    if (Math.hypot(position.x - target.x, position.z - target.z) > (objective.radius ?? 5)) return [];
    state.interacted = true;
    if (objective.defenseTarget) this._emit('relay-activated', { sectorId: sector.id, index: sector.index, target: objective.defenseTarget, position: [...objective.position], radius: objective.radius ?? 5 });
    else this._completeSector(sector);
    return this._since(firstEvent);
  }

  canInteract(player) {
    const state = this._states.get(this._currentId), objective = this.currentSector.objective;
    const position = positionOf(player), target = positionOf(objective.position);
    return Boolean(objective.type === 'interact' && state.entered && !state.completed && !state.interacted && (player?.hp === undefined || player.hp > 0) && position && target && inside(position, this.currentSector.bounds) && Math.hypot(position.x - target.x, position.z - target.z) <= (objective.radius ?? 5));
  }

  _completeSector(sector) {
    const state = this._states.get(sector.id);
    if (state.completed || this.complete) return;
    state.completed = true;
    this._emit('sector-completed', { sectorId: sector.id, index: sector.index });
    for (const gate of this.layout.gates.filter(gate => gate.from === sector.id)) {
      if (!this._openGates.has(gate.id)) {
        this._openGates.add(gate.id);
        this._unlocked.add(gate.to);
        this._emit('gate-opened', { gateId: gate.id, from: gate.from, to: gate.to });
        this._emit('sector-unlocked', { sectorId: gate.to });
      }
    }
    if ([...this._states.values()].every(value => value.completed)) {
      this.complete = true;
      this._emit('battlefield-completed', { sectorId: sector.id });
    }
  }
}
