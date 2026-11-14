/* Timed effects share the strongest slow and haste, including both hunters. */
const sharedTargets = new WeakMap();
export class TemporaryCombatEffects {
  constructor() { this.targets = new Map(); this.time = 0; }

  slow(target, key, multiplier, duration) {
    return this._set(target, key, multiplier, duration, false);
  }

  haste(target, key, multiplier, duration) {
    return this._set(target, key, multiplier, duration, true);
  }

  _set(target, key, multiplier, duration, haste) {
    if (!target || !(target.hp > 0) || !Number.isFinite(target.speed) || target.speed < 0 ||
        typeof key !== 'string' || !Number.isFinite(multiplier) || multiplier < (haste ? 1 : 0) || multiplier > (haste ? 2 : 1) ||
        !Number.isFinite(duration) || duration <= 0 || duration > 30) return false;
    let state = sharedTargets.get(target);
    if (!state) { state = { baseSpeed: target.speed, applied: target.speed, owners: new Map() }; sharedTargets.set(target, state); }
    this.targets.set(target, state);
    this._adoptExternalSpeed(target, state);
    if (!state.owners.has(this)) state.owners.set(this, new Map());
    state.owners.get(this).set(key, { multiplier, until: this.time + duration, haste });
    this._apply(target, state); return true;
  }

  _adoptExternalSpeed(target, state) {
    // Another owner may author a new base speed (phase, injury, formation).
    // Respect it instead of restoring an obsolete guessed creature default.
    if (Number.isFinite(target.speed) && Math.abs(target.speed - state.applied) > 1e-8) state.baseSpeed = target.speed;
  }

  _apply(target, state) {
    let slow = 1, haste = 1;
    for (const effects of state.owners.values()) for (const effect of effects.values()) {
      if (effect.haste) haste = Math.max(haste, effect.multiplier);
      else slow = Math.min(slow, effect.multiplier);
    }
    // A freeze remains authoritative even when an environmental frenzy starts.
    state.applied = state.baseSpeed * slow * haste; target.speed = state.applied;
  }

  update(delta) {
    if (!Number.isFinite(delta) || delta <= 0) return;
    this.time += delta;
    for (const [target, state] of this.targets) {
      this._adoptExternalSpeed(target, state);
      const effects = state.owners.get(this);
      for (const [key, effect] of effects ?? []) if (effect.until <= this.time + 1e-9) effects.delete(key);
      if (!(target.hp > 0) || target._combatDisposed) state.owners.clear();
      else if (!effects?.size) state.owners.delete(this);
      this._apply(target, state);
      if (!state.owners.has(this)) this.targets.delete(target);
      if (!state.owners.size) sharedTargets.delete(target);
    }
  }

  dispose() {
    for (const [target, state] of this.targets) {
      this._adoptExternalSpeed(target, state); state.owners.delete(this); this._apply(target, state);
      if (!state.owners.size) sharedTargets.delete(target);
    }
    this.targets.clear();
  }
}
