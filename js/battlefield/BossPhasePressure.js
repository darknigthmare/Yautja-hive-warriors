/* An original secondary-front reaction. It moves an already allocated group;
 * no phase creates soldiers, rewinds captures or clears narrative victories. */
const copy = value => structuredClone(value);
const living = unit => unit && unit.hp > 0 && !['dead', 'captured', 'evacuated', 'reserve'].includes(unit.state);
const key = value => typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,200}$/.test(value);

export class BossPhasePressure {
  constructor({ simulation, getBoss, secondaryFrontIds = null, warningSeconds = 12, announce = null } = {}) {
    if (!simulation?.issueOrder || typeof getBoss !== 'function' || !Number.isFinite(warningSeconds) || warningSeconds < 5 || warningSeconds > 120) throw new TypeError('BossPhasePressure requires a simulation, boss accessor and bounded warning');
    this.simulation = simulation; this.getBoss = getBoss; this.announce = announce;
    this.secondaryFrontIds = secondaryFrontIds ? [...secondaryFrontIds] : [...simulation.fronts.values()]
      .filter(front => !(front.criticalFor ?? []).includes(simulation.config.playerFaction) && !(simulation.config.objectives?.loseFronts ?? []).includes(front.id)).map(front => front.id);
    if (this.secondaryFrontIds.some(id => !simulation.fronts.has(id))) throw new TypeError('Unknown secondary front');
    this.warningSeconds = warningSeconds; this.time = 0; this.observed = new Map(); this.threats = []; this.disposed = false;
  }
  _emit(threat, status, reason = null) {
    threat.status = status; threat.reason = reason;
    const labels = { announced: 'Le boss prépare une attaque sur un objectif secondaire.', launched: 'Le groupe annoncé se dirige vers l’objectif secondaire.',
      cancelled: 'La contre-offensive secondaire a été empêchée.', repelled: 'Le groupe de contre-offensive a été vaincu.', lost: 'Le front secondaire a été perdu.' };
    threat.label = labels[status]; this.announce?.(copy(threat));
  }
  _livingGroup(group) { return group?.units.some(id => living(this.simulation.units.get(id))); }
  _bossKey(boss) { return boss?.battleUnitId ?? boss?.combatId ?? boss?.type; }
  _schedule(boss, phase) {
    const faction = boss.factionId ?? 'hive', playerFaction = this.simulation.config.playerFaction;
    if (!this.simulation.areHostile(faction, playerFaction)) return;
    const targets = this.secondaryFrontIds.map(id => this.simulation.fronts.get(id))
      .filter(front => front.owner === playerFaction && !(front.criticalFor ?? []).includes(playerFaction) && !(this.simulation.config.objectives?.loseFronts ?? []).includes(front.id));
    const used = new Set(this.threats.filter(item => ['announced', 'launched'].includes(item.status)).map(item => item.groupId));
    const groups = [...this.simulation.groups.values()].filter(group => group.factionId === faction && group.id !== boss.battleGroupId && !used.has(group.id) && this._livingGroup(group)
      && !['retreat', 'regroup'].includes(group.order?.type));
    const options = [];
    for (const front of targets) for (const group of groups) {
      // Public routes define whether this is a plausible threat. A route
      // closed during the warning remains an explicit defensive response.
      const path = this.simulation._path(group.frontId, front.id);
      if (path) options.push({ front, group, seconds: path.reduce((sum, leg) => sum + this.simulation.routes.get(leg.routeId).travelSeconds, 0) });
    }
    options.sort((a, b) => a.seconds - b.seconds || a.group.id.localeCompare(b.group.id) || a.front.id.localeCompare(b.front.id));
    const selected = options[0]; if (!selected) return;
    const threat = { id: `${this._bossKey(boss)}:phase:${phase}`, bossId: this._bossKey(boss), bossType: boss.type, phase,
      factionId: faction, groupId: selected.group.id, targetFrontId: selected.front.id, announcedAt: this.time, due: this.time + this.warningSeconds,
      status: 'announced', label: '', reason: null };
    this.threats.push(threat); this._emit(threat, 'announced');
  }
  update(delta, { paused = false } = {}) {
    if (this.disposed || paused || this.simulation.paused || this.simulation.result || !Number.isFinite(delta) || delta <= 0) return;
    this.time += delta; const boss = this.getBoss();
    if (boss?.hp > 0 && key(this._bossKey(boss))) {
      const id = this._bossKey(boss), seen = this.observed.get(id) ?? 1;
      for (let phase = seen + 1; phase <= Math.min(3, boss.phase ?? 1); phase++) this._schedule(boss, phase);
      this.observed.set(id, Math.max(seen, boss.phase ?? 1));
    }
    for (const threat of this.threats) {
      if (!['announced', 'launched'].includes(threat.status)) continue;
      const group = this.simulation.groups.get(threat.groupId), front = this.simulation.fronts.get(threat.targetFrontId);
      if (!this._livingGroup(group)) { this._emit(threat, threat.status === 'announced' ? 'cancelled' : 'repelled', 'allocated_group_defeated'); continue; }
      if (!this.simulation.areHostile(threat.factionId, this.simulation.config.playerFaction)) { this._emit(threat, 'cancelled', 'truce'); continue; }
      if (threat.status === 'announced') {
        const allocated = this.simulation.units.get(threat.bossId);
        const sourceAlive = allocated ? allocated.hp > 0 && !['dead', 'captured', 'evacuated'].includes(allocated.state)
          : boss && this._bossKey(boss) === threat.bossId && boss.hp > 0;
        if (!sourceAlive) { this._emit(threat, 'cancelled', 'boss_defeated'); continue; }
        if (front.owner !== this.simulation.config.playerFaction) { this._emit(threat, 'cancelled', 'target_no_longer_friendly'); continue; }
        if (this.time + 1e-8 < threat.due) continue;
        const answer = this.simulation.issueOrder(group.id, { type: 'attack', frontId: front.id, issuer: 'boss_phase' });
        this._emit(threat, answer.accepted ? 'launched' : 'cancelled', answer.accepted ? null : answer.reason);
      } else if (front.owner === threat.factionId) this._emit(threat, 'lost', 'front_captured');
    }
  }
  getHUDState() { return { threats: this.threats.map(threat => ({ ...copy(threat), remaining: threat.status === 'announced' ? Math.max(0, threat.due - this.time) : 0 })) }; }
  serialize() { return { version: 1, operationId: this.simulation.config.id, secondaryFrontIds: [...this.secondaryFrontIds], warningSeconds: this.warningSeconds,
    time: this.time, observed: [...this.observed], threats: copy(this.threats) }; }
  restore(state) {
    if (!state || state.version !== 1 || state.operationId !== this.simulation.config.id || state.warningSeconds !== this.warningSeconds || JSON.stringify(state.secondaryFrontIds) !== JSON.stringify(this.secondaryFrontIds) || !Number.isFinite(state.time) || state.time < 0 || !Array.isArray(state.observed) || state.observed.length > 16 || new Set(state.observed.map(row => row?.[0])).size !== state.observed.length ||
      state.observed.some(row => !Array.isArray(row) || row.length !== 2 || !key(row[0]) || !Number.isInteger(row[1]) || row[1] < 1 || row[1] > 3) ||
      !Array.isArray(state.threats) || state.threats.length > 32 || new Set(state.threats.map(threat => threat.id)).size !== state.threats.length ||
      state.threats.some(threat => !key(threat.id) || !key(threat.bossId) || !key(threat.bossType) || !Number.isInteger(threat.phase) || threat.phase < 2 || threat.phase > 3 || threat.id !== `${threat.bossId}:phase:${threat.phase}` ||
        !this.simulation.groups.has(threat.groupId) || this.simulation.groups.get(threat.groupId).factionId !== threat.factionId || !this.secondaryFrontIds.includes(threat.targetFrontId) ||
        !['announced', 'launched', 'cancelled', 'repelled', 'lost'].includes(threat.status) || !Number.isFinite(threat.announcedAt) || threat.announcedAt < 0 || threat.announcedAt > state.time ||
        !Number.isFinite(threat.due) || threat.due !== threat.announcedAt + this.warningSeconds || threat.due > state.time + this.warningSeconds ||
        !state.observed.some(([id, phase]) => id === threat.bossId && phase >= threat.phase))) throw new TypeError('Invalid boss secondary-front checkpoint');
    this.time = state.time; this.observed = new Map(state.observed); this.threats = copy(state.threats);
  }
  dispose() { this.disposed = true; this.threats.length = 0; this.observed.clear(); this.getBoss = null; this.announce = null; }
}
