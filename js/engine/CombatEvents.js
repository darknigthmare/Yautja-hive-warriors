/* One death identity is shared by local actors, remote fronts and scoring.
 * Clearing an encounter is deliberately not a death; pooling a new actor gives
 * it a new identity unless its persistent battleUnitId explicitly says otherwise. */
export class CombatEvents {
  constructor({ runId = 'mission' } = {}) {
    this.listeners = new Set();
    this.reset(runId);
  }

  reset(runId = this.runId) {
    if (typeof runId !== 'string' || !runId.trim()) throw new TypeError('CombatEvents requires a nonempty runId');
    this.runId = runId;
    this.sequence = 0;
    this.actorIds = new WeakMap();
    this.deaths = new Map();
  }

  entityId(entity) {
    if (!entity || typeof entity !== 'object') throw new TypeError('A combat actor is required');
    const persistent = entity.battleUnitId ?? entity.combatId;
    if (typeof persistent === 'string' && persistent) return persistent;
    if (!this.actorIds.has(entity)) this.actorIds.set(entity, `actor-${++this.sequence}`);
    return this.actorIds.get(entity);
  }

  recordDeath({ entity, entityId, kind, factionId, killerFaction, position, cause = 'combat', ...details } = {}) {
    const identity = entityId ?? this.entityId(entity);
    if (typeof identity !== 'string' || !identity) throw new TypeError('A stable combat entityId is required');
    if (this.deaths.has(identity)) return null;
    const point = position ?? entity?.mesh?.position;
    const coordinates = Array.isArray(point) ? point.slice(0, 3) : point?.toArray?.();
    const event = Object.freeze({ ...details, id: `${this.runId}:death:${identity}`, type: 'death',
      runId: this.runId, entityId: identity, kind: kind ?? entity?.type ?? 'combatant',
      factionId: factionId ?? entity?.factionId ?? null, killerFaction: killerFaction ?? null,
      position: coordinates?.length === 3 && coordinates.every(Number.isFinite) ? Object.freeze(coordinates) : null, cause });
    this.deaths.set(identity, event);
    for (const listener of this.listeners) listener(event);
    return event;
  }

  subscribe(listener) {
    if (typeof listener !== 'function') throw new TypeError('A combat event listener is required');
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  hasDeath(entityOrId) {
    return this.deaths.has(typeof entityOrId === 'string' ? entityOrId : this.entityId(entityOrId));
  }

  getSnapshot() { return { runId: this.runId, deaths: [...this.deaths.values()] }; }
}

export function recordCombatDeath(manager, entity, details = {}) {
  if (!entity) return null;
  const ledger = manager.combatEvents ?? (manager._localCombatEvents ??= new CombatEvents());
  const event = ledger.recordDeath({ entity, ...details });
  if (event) entity.combatDeathEvent = event;
  return event;
}
