/** Shared attack turns for a crowded battlefield. Time advances only with simulation. */
export class CombatDirector {
  constructor({ graceSeconds = 7, engagementLimit = 3, impactGap = 0.7 } = {}) {
    this.engagementLimit = Math.max(1, Math.floor(engagementLimit));
    this.impactGap = Math.max(0.3, impactGap);
    this.reset({ graceSeconds });
  }

  reset({ graceSeconds = 7 } = {}) {
    this.time = 0;
    this.graceUntil = Math.max(0, Number(graceSeconds) || 0);
    this.livingPlayers = [];
    this.attacks = new Map();
    this.slots = new Map();
    this.engagements = new Map();
    this.nextImpact = new Map();
    this.hazardBudgets = new Map();
  }

  get isInGrace() { return this.time < this.graceUntil; }

  update(delta, players = this.livingPlayers) {
    if (!Number.isFinite(delta) || delta < 0) throw new Error('CombatDirector requires a finite nonnegative delta');
    this.time += delta;
    this.livingPlayers = [...new Set(players.filter(player => player && player.hp !== 0))];
    for (const [attacker, attack] of this.attacks) {
      const expired = attack.phase === 'windup' ? this.time > attack.impactAt + 1.5 : this.time >= attack.readyAt;
      if (expired || !this.livingPlayers.includes(attack.target)) this.release(attacker);
      else if (attack.phase === 'recovery' && this.time >= attack.releaseAt && this.slots.get(attack.target) === attacker) this.slots.delete(attack.target);
    }
    for (const [target, engaged] of this.engagements) {
      for (const [attacker, seen] of engaged) if (this.time - seen > 0.6) engaged.delete(attacker);
      if (!this.livingPlayers.includes(target)) this.engagements.delete(target);
    }
    for (const target of this.hazardBudgets.keys()) if (!this.livingPlayers.includes(target)) this.hazardBudgets.delete(target);
  }

  selectTarget(origin, fallback = null) {
    const position = origin?.position ?? origin;
    const players = this.livingPlayers.length ? this.livingPlayers : [fallback].filter(player => player && player.hp !== 0);
    if (!position?.distanceToSquared) return players[0] ?? fallback;
    return players.reduce((nearest, player) => !nearest || position.distanceToSquared(player.position) < position.distanceToSquared(nearest.position) ? player : nearest, null);
  }

  canEngage(attacker, target) {
    if (!attacker || !target || target.hp === 0 || this.isInGrace) return false;
    let engaged = this.engagements.get(target);
    if (!engaged) { engaged = new Map(); this.engagements.set(target, engaged); }
    if (engaged.has(attacker)) { engaged.set(attacker, this.time); return true; }
    if (engaged.size >= this.engagementLimit) return false;
    engaged.set(attacker, this.time);
    return true;
  }

  requestAttack(attacker, target, { kind = 'melee', windup = 0.65, recovery = 1.4, duration = 0.35 } = {}) {
    if (!attacker || !target || target.hp === 0 || this.isInGrace) return false;
    let attack = this.attacks.get(attacker);
    if (attack && attack.target !== target) { this.release(attacker); attack = null; }
    if (attack) {
      if (attack.phase !== 'windup' || this.time < attack.impactAt) return false;
      attack.phase = 'recovery';
      attack.releaseAt = this.time + attack.duration;
      attack.readyAt = attack.releaseAt + attack.recovery;
      this.nextImpact.set(target, this.time + this.impactGap);
      return true;
    }
    if (this.slots.has(target) || this.time < (this.nextImpact.get(target) ?? 0)) return false;
    attack = { target, kind, phase: 'windup', startedAt: this.time,
      impactAt: this.time + Math.max(0.35, Number(windup) || 0.65),
      recovery: Math.max(0.3, Number(recovery) || 1.4), duration: Math.max(0.1, Number(duration) || 0.35) };
    this.attacks.set(attacker, attack);
    this.slots.set(target, attacker);
    return false;
  }

  getAttackState(attacker) {
    const attack = this.attacks.get(attacker);
    if (!attack) return null;
    return { phase: attack.phase, target: attack.target, kind: attack.kind,
      progress: attack.phase === 'windup' ? Math.max(0, Math.min(1, (this.time - attack.startedAt) / (attack.impactAt - attack.startedAt))) : 1 };
  }

  release(attacker) {
    const attack = this.attacks.get(attacker);
    if (attack && this.slots.get(attack.target) === attacker) this.slots.delete(attack.target);
    this.attacks.delete(attacker);
    for (const engaged of this.engagements.values()) engaged.delete(attacker);
  }

  /** Acid remains dangerous without multiplying one sword hit into dozens of instant hits. */
  applyHazardDamage(source, target, amount, delta = 0) {
    if (!target || target.hp === 0 || this.isInGrace || !Number.isFinite(amount) || amount <= 0) return 0;
    let budget = this.hazardBudgets.get(target);
    if (!budget) { budget = { available: 12, updatedAt: this.time }; this.hazardBudgets.set(target, budget); }
    budget.available = Math.min(12, budget.available + (this.time - budget.updatedAt) * 12);
    budget.updatedAt = this.time;
    const damage = Math.min(amount, budget.available);
    if (damage <= 0) return 0;
    budget.available -= damage;
    target.takeDamage(damage, true);
    return damage;
  }
}
