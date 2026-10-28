/* Gameplay budgets, not specifications measured from a film vehicle. */
const MESSAGES = Object.freeze({
  unconfigured: 'Appui indisponible : le contexte de mission doit être confirmé.',
  disallowed: 'Cet appui est indisponible dans ce lieu ou ce scénario.',
  destroyed: 'Cet appui a été détruit pour cette mission.',
  ammunition: 'Les munitions ou les sorties de cet appui sont épuisées.',
  air_unknown: 'Appui aérien refusé : aucun accès au ciel n’est confirmé.',
  air_blocked: 'Appui aérien refusé : la zone est couverte ou son accès est fermé.',
  busy: 'L’appareil termine encore sa sortie.',
  invalid: 'La demande d’appui est invalide.'
});
export const supportDecision = reason => reason ? { accepted: false, reason, message: MESSAGES[reason] ?? MESSAGES.invalid } : { accepted: true, reason: null, message: '' };
export const supportDestroyedEvent = (kind, source) => ({ kind,
  sourceId: source?.battleUnitId ?? source?.id ?? null, killerFaction: source?.factionId ?? source?.killerFaction ?? null });
const validId = id => typeof id === 'string' && id.length > 0 && id.length <= 180;

export class FiniteSupportPolicy {
  constructor(kind, { maxHp, ammunition }) {
    this.kind = kind; this.maxHp = maxHp; this.limits = Object.freeze({ ...ammunition });
    this.missionId = null; this.context = null; this.hp = maxHp; this.remaining = { ...ammunition }; this.lastRefusal = 'unconfigured';
  }
  beginMission(context) {
    if (!context || !validId(context.missionId) || typeof context.allowed !== 'boolean') return { ...supportDecision('unconfigured'), newMission: false };
    const newMission = context.missionId !== this.missionId;
    this.context = context;
    if (newMission) { this.missionId = context.missionId; this.hp = this.maxHp; this.remaining = { ...this.limits }; }
    this.lastRefusal = context.allowed ? null : 'disallowed';
    return { ...supportDecision(this.lastRefusal), newMission };
  }
  get available() { return !!this.context && !!this.missionId && this.context.allowed === true && this.hp > 0; }
  permission() {
    const reason = !this.context || !this.missionId ? 'unconfigured' : this.context.allowed !== true ? 'disallowed' : this.hp <= 0 ? 'destroyed' : null;
    return supportDecision(reason);
  }
  refuse(reason) { this.lastRefusal = reason; return supportDecision(reason); }
  spend(costs) {
    const permission = this.permission(); if (!permission.accepted) return this.refuse(permission.reason);
    if (!costs || !Object.entries(costs).every(([key, value]) => Object.hasOwn(this.remaining, key) && Number.isSafeInteger(value) && value >= 0)) return this.refuse('invalid');
    if (Object.entries(costs).some(([key, value]) => value > this.remaining[key])) return this.refuse('ammunition');
    for (const [key, value] of Object.entries(costs)) this.remaining[key] -= value;
    this.lastRefusal = null; return supportDecision(null);
  }
  airAccess(target) {
    const permission = this.permission(); if (!permission.accepted) return this.refuse(permission.reason);
    if (typeof this.context.canAccessAir !== 'function') return this.refuse('air_unknown');
    let result; try { result = this.context.canAccessAir(target?.clone ? target.clone() : target); } catch { return this.refuse('air_unknown'); }
    return result === true ? supportDecision(null) : this.refuse(result === false ? 'air_blocked' : 'air_unknown');
  }
  damage(value) {
    if (!Number.isFinite(value) || value <= 0 || this.hp <= 0) return 0;
    const dealt = Math.min(value, this.hp); this.hp -= dealt;
    if (this.hp === 0) this.lastRefusal = 'destroyed';
    return dealt;
  }
  serialize() { return { version: 1, kind: this.kind, missionId: this.missionId, hp: this.hp, remaining: { ...this.remaining } }; }
  restore(state) {
    if (!state || state.version !== 1 || state.kind !== this.kind || !this.context || state.missionId !== this.missionId ||
      !Number.isFinite(state.hp) || state.hp < 0 || state.hp > this.maxHp || !state.remaining ||
      Object.keys(state.remaining).length !== Object.keys(this.limits).length ||
      !Object.entries(this.limits).every(([key, max]) => Number.isSafeInteger(state.remaining[key]) && state.remaining[key] >= 0 && state.remaining[key] <= max)) return false;
    // A stale checkpoint in this page cannot refund an already spent shell or
    // heal a vehicle. A fresh instance starts full, then adopts these limits.
    this.hp = Math.min(this.hp, state.hp);
    for (const key of Object.keys(this.remaining)) this.remaining[key] = Math.min(this.remaining[key], state.remaining[key]);
    if (this.hp === 0) this.lastRefusal = 'destroyed';
    return true;
  }
  getState() { return { ...this.serialize(), maxHp: this.maxHp, allowed: this.permission().accepted,
    factionId: this.context?.factionId ?? 'player_clan', lastRefusal: this.lastRefusal, refusalMessage: this.lastRefusal ? MESSAGES[this.lastRefusal] ?? MESSAGES.invalid : null }; }
}

/** A live target view. Clearing the model makes existing views untargetable. */
export function createSupportCombatant(owner, { kind, radius, airborne = false }) {
  return { isSupport: true, isBattleNPC: true, isAirborne: airborne, canBeFacehugged: false, collisionOwner: kind,
    get id() { return `${owner.policy.missionId ?? 'unconfigured'}:${kind}`; },
    get factionId() { return owner.policy.context?.factionId ?? 'player_clan'; },
    get hp() { return owner.isSupportActive() ? owner.hp : 0; },
    set hp(value) { if (Number.isFinite(value) && value < owner.hp) owner.takeDamage(owner.hp - Math.max(0, value)); },
    get maxHp() { return owner.maxHp; },
    get position() { return (owner.mesh ?? owner.shipMesh)?.position ?? owner.lastPosition; },
    get mesh() { return owner.mesh ?? owner.shipMesh; }, radius, isBlocking: false, isCloaked: false,
    get audioEngine() { return owner.audioEngine; }, takeDamage: (amount, source) => owner.takeDamage(amount, source) };
}
