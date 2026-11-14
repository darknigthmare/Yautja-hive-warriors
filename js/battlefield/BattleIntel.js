/* Tactical knowledge, separate from authoritative battle accounting. Reports
 * carry the position at observation time; delivery never refreshes that pose. */
const copy = value => JSON.parse(JSON.stringify(value));
const point = value => Array.isArray(value) && value.length === 2 && value.every(Number.isFinite);
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const finite = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;
const fail = message => { throw new Error(`BattleIntel: ${message}`); };
const living = unit => unit && unit.hp > 0 && !['dead', 'captured', 'evacuated'].includes(unit.state);

export class BattleIntel {
  constructor(simulation, { visionRadius = 65, reportInterval = 8, propagationSeconds = 4, staleAfter = 20 } = {}) {
    if (!simulation?.groups || !finite(visionRadius, 5, 250) || !finite(reportInterval, 1, 60) || !finite(propagationSeconds, 1, 60) || !finite(staleAfter, 5, 120)) fail('invalid tactical knowledge configuration');
    this.simulation = simulation; this.options = { visionRadius, reportInterval, propagationSeconds, staleAfter };
    this.groups = new Map(); this.fronts = new Map(); this.pending = new Map(); this.nextReports = new Map(); this.sequence = 0;
    // Starting orders communicate our own positions, never enemy deployment.
    for (const group of simulation.groups.values()) if (group.factionId === simulation.config.playerFaction) this._observe('group', group, 'deployment', 0, false);
    for (const front of simulation.fronts.values()) if (front.owner === simulation.config.playerFaction) this._observe('front', front, 'deployment', 0, false);
  }

  _snapshot(kind, value) {
    const sim = this.simulation;
    if (kind === 'front') return { id: value.id, position: [...value.position], owner: value.owner, sourceHP: value.sourceHP,
      contested: value.contested, capture: copy(value.capture) };
    const officer = sim.units.get(value.officerId), faction = sim.factions.get(value.factionId);
    return { id: value.id, label: value.label, factionId: value.factionId, frontId: value.frontId, position: [...value.position],
      alive: value.units.filter(id => living(sim.units.get(id))).length,
      incapacitated: value.units.filter(id => living(sim.units.get(id)) && sim.units.get(id).incapacitated).length,
      combatReady: value.units.filter(id => living(sim.units.get(id)) && !sim.units.get(id).incapacitated).length,
      coordinationStrength: value.coordinationStrength ?? 1,
      reconstitution: value.reconstitution ? { required: value.reconstitution.required, recoverySeconds: value.reconstitution.recoverySeconds, readyAt: value.reconstitution.readyAt } : null,
      officerId: value.officerId, officerHP: officer?.hp ?? null, officerMaxHP: officer?.maxHp ?? null,
      morale: value.morale, moraleModel: faction.moraleModel, cohesion: value.cohesion,
      state: value.state, order: copy(value.order), delegated: value.delegated };
  }

  _observe(kind, value, source, observedAt, delayed) {
    const sim = this.simulation, key = `${kind}:${value.id}`;
    const report = { id: ++this.sequence, kind, entityId: value.id, source, observedAt,
      receivedAt: delayed ? observedAt + this.options.propagationSeconds : observedAt,
      snapshot: this._snapshot(kind, value) };
    if (delayed) {
      // One report per entity in flight keeps memory independent of frame rate.
      if (!this.pending.has(key)) this.pending.set(key, report);
    } else this._deliver(report, sim.time);
  }

  _deliver(report, now) {
    const table = report.kind === 'group' ? this.groups : this.fronts, previous = table.get(report.entityId);
    if (!previous || previous.observedAt <= report.observedAt) table.set(report.entityId, { ...copy(report), receivedAt: Math.min(now, report.receivedAt) });
  }

  update() {
    const sim = this.simulation;
    if (sim.paused || sim.disposed) return;
    for (const [key, report] of this.pending) if (report.receivedAt <= sim.time) { this._deliver(report, sim.time); this.pending.delete(key); }
    const players = sim.players.filter(player => player.hp > 0), direct = value => players.some(player => distance(player.position, value.position) <= this.options.visionRadius && sim.callbacks.canObserve?.(value, player) !== false);
    const observers = [...sim.groups.values()].filter(group => sim.relationship(group.factionId, sim.config.playerFaction) === 'allied' && group.units.some(id => living(sim.units.get(id)) && !sim.units.get(id).incapacitated && sim.units.get(id).state !== 'reserve'));
    const observersByFront = new Map();
    for (const observer of observers) { if (!observersByFront.has(observer.frontId)) observersByFront.set(observer.frontId, []); observersByFront.get(observer.frontId).push(observer); }
    for (const front of sim.fronts.values()) {
      if (direct(front)) this._observe('front', front, 'player_sight', sim.time, false);
      else if ((observersByFront.get(front.id) ?? []).some(observer => distance(observer.position, front.position) <= front.radius)) this._radio('front', front, 'garrison_report');
    }
    for (const group of sim.groups.values()) {
      const own = sim.relationship(group.factionId, sim.config.playerFaction) === 'allied';
      const deployed = group.units.some(id => living(sim.units.get(id)) && sim.units.get(id).state !== 'reserve');
      if ((group.revealedUntil ?? 0) > sim.time) this._observe('group', group, 'recon', sim.time, false);
      else if (deployed && direct(group)) this._observe('group', group, 'player_sight', sim.time, false);
      else if (own) this._radio('group', group, 'squad_report');
      else if (deployed && (observersByFront.get(group.frontId) ?? []).some(observer => distance(observer.position, group.position) <= this.options.visionRadius && sim.callbacks.canObserve?.(group, observer) !== false)) this._radio('group', group, 'allied_scout');
    }
  }

  _radio(kind, value, source) {
    const key = `${kind}:${value.id}`, now = this.simulation.time;
    if ((this.nextReports.get(key) ?? 0) > now || this.pending.has(key)) return;
    this._observe(kind, value, source, now, true); this.nextReports.set(key, now + this.options.reportInterval);
  }

  _knowledge(report) {
    if (!report) return { intelState: 'unknown', reportAge: null, precisePositionKnown: false, reportSource: null, observedAt: null, receivedAt: null };
    const age = Math.max(0, this.simulation.time - report.observedAt), observed = age <= .5 && ['player_sight', 'recon'].includes(report.source);
    return { intelState: observed ? report.source === 'recon' ? 'detected' : 'observed' : age > this.options.staleAfter ? 'stale' : 'reported', reportAge: age,
      precisePositionKnown: observed, reportSource: report.source, observedAt: report.observedAt, receivedAt: report.receivedAt };
  }

  revealGroup(groupId) {
    const group = this.simulation.groups.get(groupId);
    if (!group || this.simulation.paused || this.simulation.disposed || (group.revealedUntil ?? 0) <= this.simulation.time) return false;
    this._observe('group', group, 'recon', this.simulation.time, false); return true;
  }

  group(groupId, raw) {
    if (this.simulation.result) return { ...raw, ...this._knowledge({ source: 'debrief', observedAt: this.simulation.time, receivedAt: this.simulation.time }), intelState: 'debrief', precisePositionKnown: true };
    const report = this.groups.get(groupId); if (!report) return null;
    const known = this._knowledge(report), allied = this.simulation.relationship(raw.factionId, this.simulation.config.playerFaction) === 'allied';
    // Keep commandable friendly orders current; remote positions and injuries
    // remain the last received report. Unknown hostile paths/targets stay hidden.
    return { ...raw, ...copy(report.snapshot), ...known,
      order: allied ? raw.order : { type: 'unknown', frontId: report.snapshot.frontId, issuer: 'unknown' },
      targetPosition: allied ? raw.targetPosition : [...report.snapshot.position], path: allied ? raw.path : [],
      units: allied ? raw.units : [], tactic: allied ? raw.tactic : null,
      reconstitution: allied ? raw.reconstitution : report.snapshot.reconstitution ?? null,
      rootUntil: known.precisePositionKnown ? raw.rootUntil : 0, suppressedUntil: known.precisePositionKnown ? raw.suppressedUntil : 0,
      officerThreatUntil: allied ? raw.officerThreatUntil : 0 };
  }

  front(frontId, raw) {
    if (this.simulation.result) return { ...raw, intelState: 'debrief', reportAge: 0, observedAt: this.simulation.time, receivedAt: this.simulation.time };
    const report = this.fronts.get(frontId), known = this._knowledge(report);
    return report ? { ...raw, ...copy(report.snapshot), ...known } : { ...raw, owner: null, contested: null, sourceHP: null, capture: {}, ...known };
  }

  allowsEvent(event) {
    if (this.simulation.result || event.type === 'operation_ended' || event.type === 'group_revealed') return true;
    const group = event.groupId && this.simulation.groups.get(event.groupId);
    if (group && this.simulation.relationship(group.factionId, this.simulation.config.playerFaction) === 'allied') {
      const report = this.groups.get(group.id); return !!report && report.observedAt >= event.time;
    }
    const report = event.groupId ? this.groups.get(event.groupId) : event.frontId ? this.fronts.get(event.frontId) : null;
    return !!report && report.observedAt >= event.time;
  }

  getHUDState(groups) {
    const counts = {};
    for (const faction of this.simulation.factions.keys()) {
      const allied = this.simulation.relationship(faction, this.simulation.config.playerFaction) === 'allied';
      const known = groups.filter(group => group.factionId === faction);
      counts[faction] = { exact: allied, knownGroups: known.length, knownAlive: known.reduce((sum, group) => sum + group.alive, 0),
        label: allied ? 'Effectifs alliés' : known.length ? 'Derniers effectifs repérés — incomplets' : 'Effectifs inconnus',
        oldestReportAge: known.length ? Math.max(...known.map(group => group.reportAge ?? 0)) : null };
    }
    return { counts, pendingReports: this.pending.size, visionRadius: this.options.visionRadius, staleAfter: this.options.staleAfter,
      regions: [...this.simulation.fronts.values()].map(front => ({ frontId: front.id, position: [...front.position], radius: front.radius, ...this._knowledge(this.fronts.get(front.id)) })) };
  }

  serialize() { return { version: 1, groups: [...this.groups.values()].map(copy), fronts: [...this.fronts.values()].map(copy), pending: [...this.pending.values()].map(copy), nextReports: [...this.nextReports], sequence: this.sequence }; }
  restore(saved) {
    const sim = this.simulation, validReport = report => {
      const map = report?.kind === 'group' ? sim.groups : report?.kind === 'front' ? sim.fronts : null;
      if (!map?.has(report.entityId) || !Number.isInteger(report.id) || report.id < 1 || report.id > saved.sequence || !finite(report.observedAt, 0, sim.time) || !finite(report.receivedAt, report.observedAt, sim.time + this.options.propagationSeconds) || !['deployment', 'player_sight', 'recon', 'garrison_report', 'squad_report', 'allied_scout'].includes(report.source) || report.snapshot?.id !== report.entityId || !point(report.snapshot.position)) return false;
      const snapshot = report.snapshot;
      if (report.kind === 'front') return (snapshot.owner === null || sim.factions.has(snapshot.owner)) && finite(snapshot.sourceHP, 0, 1e6) && typeof snapshot.contested === 'boolean' && snapshot.capture && Object.entries(snapshot.capture).every(([faction, amount]) => sim.factions.has(faction) && finite(amount, 0, 300));
      const group = sim.groups.get(report.entityId), officer = sim.units.get(group.officerId);
      return snapshot.factionId === group.factionId && sim.fronts.has(snapshot.frontId) && typeof snapshot.label === 'string' && snapshot.label.length <= 256 && Number.isInteger(snapshot.alive) && finite(snapshot.alive, 0, group.units.length) && snapshot.officerId === group.officerId && (officer ? finite(snapshot.officerHP, 0, officer.maxHp) && snapshot.officerMaxHP === officer.maxHp : snapshot.officerHP === null && snapshot.officerMaxHP === null) && finite(snapshot.morale, 0, 100) && finite(snapshot.cohesion, 0, 100) && snapshot.order && ['attack', 'defend', 'regroup', 'escort', 'retreat'].includes(snapshot.order.type) && sim.fronts.has(snapshot.order.frontId);
    };
    const checkList = (list, kind, limit) => Array.isArray(list) && list.length <= limit && new Set(list.map(report => report.entityId)).size === list.length && list.every(report => report.kind === kind && validReport(report));
    if (!saved || saved.version !== 1 || !Number.isInteger(saved.sequence) || saved.sequence < 0 || !checkList(saved.groups, 'group', sim.groups.size) || !checkList(saved.fronts, 'front', sim.fronts.size) || !Array.isArray(saved.pending) || saved.pending.length > sim.groups.size + sim.fronts.size || new Set(saved.pending.map(report => `${report.kind}:${report.entityId}`)).size !== saved.pending.length || !saved.pending.every(report => validReport(report) && report.receivedAt >= sim.time) || !Array.isArray(saved.nextReports) || saved.nextReports.length > sim.groups.size + sim.fronts.size || new Set(saved.nextReports.map(([key]) => key)).size !== saved.nextReports.length || saved.nextReports.some(([key, at]) => !/^(group|front):/.test(key) || !finite(at, 0, sim.time + this.options.reportInterval))) fail('invalid saved tactical knowledge');
    this.groups = new Map(saved.groups.map(report => [report.entityId, copy(report)])); this.fronts = new Map(saved.fronts.map(report => [report.entityId, copy(report)]));
    this.pending = new Map(saved.pending.map(report => [`${report.kind}:${report.entityId}`, copy(report)])); this.nextReports = new Map(saved.nextReports); this.sequence = saved.sequence; return this;
  }
}
