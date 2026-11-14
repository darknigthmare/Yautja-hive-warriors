/* Counted civilians of an operation (HW-DEC-90, HW-DEC-100), outside every combat budget.
 * Identities are finite and fixed at deployment. Civilians shelter on a front, flee along an
 * open route when a hostile camp takes it, wait when no route is open, and die only through
 * an explicit damage call: no death, rescue or civilian is invented by the distant layer. */
const copy = value => structuredClone(value);
const STATES = new Set(['sheltering', 'fleeing', 'trapped', 'evacuated', 'dead']);
const MAX_HP = 50;

export class CivilianPopulation {
  /** @param thirdParties parsed audit entry, or null; @param reserved civilians already carried by rescue tasks. */
  constructor(operationId, thirdParties, fronts, reserved = 0) {
    const count = thirdParties ? Math.max(0, thirdParties.count - reserved) : 0;
    const frontIds = fronts.map(front => front.id);
    this.operationId = operationId; this.label = thirdParties?.label ?? null; this.species = thirdParties?.species ?? null;
    this.maxActive = thirdParties?.maxActive ?? 0; this.reservedByTasks = thirdParties ? Math.min(reserved, thirdParties.count) : 0;
    this.members = Array.from({ length: count }, (_, index) => ({ id: `${operationId}:civil:${index}`, hp: MAX_HP, state: 'sheltering',
      frontId: frontIds[index % frontIds.length], destinationId: null, arriveAt: null }));
  }

  get size() { return this.members.length; }

  /** A front is unsafe once a camp hostile to the player owns it. */
  _unsafe(simulation, playerFaction, front) {
    return !!front?.owner && front.owner !== playerFaction && simulation.areHostile?.(playerFaction, front.owner) === true;
  }

  _refuge(simulation, playerFaction, fromId, fronts) {
    let best = null;
    for (const front of fronts) {
      if (front.id === fromId || this._unsafe(simulation, playerFaction, front)) continue;
      const path = simulation._path?.(fromId, front.id);
      if (!path) continue;
      const seconds = path.reduce((sum, segment) => sum + (simulation.routes?.get(segment.routeId)?.travelSeconds ?? 20), 0);
      if (!best || seconds < best.seconds || seconds === best.seconds && front.id < best.id) best = { id: front.id, seconds };
    }
    return best;
  }

  update(time, simulation, playerFaction, fronts, emit = () => {}) {
    if (!this.members.length) return;
    const byId = new Map(fronts.map(front => [front.id, front])), grouped = new Map();
    const note = (type, details) => { const key = `${type}|${details.frontId}|${details.destinationId ?? ''}`; if (!grouped.has(key)) grouped.set(key, { type, details: { ...details, count: 0 } }); grouped.get(key).details.count++; };
    for (const member of this.members) {
      if (member.state === 'fleeing' && time + 1e-7 >= member.arriveAt) {
        member.state = 'sheltering'; member.frontId = member.destinationId; member.destinationId = null; member.arriveAt = null;
        note('civilians_sheltered', { frontId: member.frontId });
      }
      if (!['sheltering', 'trapped'].includes(member.state) || !this._unsafe(simulation, playerFaction, byId.get(member.frontId))) {
        if (member.state === 'trapped') member.state = 'sheltering';
        continue;
      }
      const refuge = this._refuge(simulation, playerFaction, member.frontId, fronts);
      if (!refuge) { if (member.state !== 'trapped') { member.state = 'trapped'; note('civilians_trapped', { frontId: member.frontId }); } continue; }
      const from = member.frontId; member.state = 'fleeing'; member.destinationId = refuge.id; member.arriveAt = time + refuge.seconds;
      note('civilians_fleeing', { frontId: from, destinationId: refuge.id });
    }
    for (const { type, details } of grouped.values()) emit(type, details);
  }

  /** Damage to one counted civilian; a death is recorded once and is never a combat kill. */
  damage(civilianId, amount) {
    const member = this.members.find(item => item.id === civilianId);
    if (!member || member.hp <= 0 || member.state === 'evacuated' || !Number.isFinite(amount) || amount <= 0) return false;
    member.hp = Math.max(0, member.hp - amount); if (!member.hp) member.state = 'dead';
    return true;
  }

  counts() {
    const count = state => this.members.filter(member => member.state === state).length;
    return { label: this.label, species: this.species, allocated: this.members.length, reservedByTasks: this.reservedByTasks, maxActive: this.maxActive,
      sheltering: count('sheltering'), fleeing: count('fleeing'), trapped: count('trapped'), evacuated: count('evacuated'), dead: count('dead') };
  }

  serialize() { return { operationId: this.operationId, members: this.members.map(copy) }; }

  /** Restores a saved population; an older save without one keeps the deployment state. */
  restore(saved, fronts) {
    if (saved === undefined || saved === null) return true;
    const frontIds = new Set(fronts.map(front => front.id));
    if (saved.operationId !== this.operationId || !Array.isArray(saved.members) || saved.members.length !== this.members.length) return false;
    const valid = saved.members.every((member, index) => member.id === this.members[index].id && STATES.has(member.state)
      && Number.isFinite(member.hp) && member.hp >= 0 && member.hp <= MAX_HP && (member.hp === 0) === (member.state === 'dead')
      && frontIds.has(member.frontId) && (member.state === 'fleeing'
        ? frontIds.has(member.destinationId) && Number.isFinite(member.arriveAt)
        : member.destinationId === null && member.arriveAt === null));
    if (!valid) return false;
    this.members = saved.members.map(copy); return true;
  }
}
