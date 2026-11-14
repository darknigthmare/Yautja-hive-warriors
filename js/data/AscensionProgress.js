/* Ascension progress (spec 002, HW-DEC-109): kept in this browser first, with a schema version;
 * the account upload comes later with the other saves. A corrupt or foreign record starts fresh. */
import { ASCENSION_WORLDS } from './AscensionWorlds.js';

export const ASCENSION_STORAGE_KEY = 'yautja-ascension-v1';
const WORLD_IDS = new Set(ASCENSION_WORLDS.map(world => world.id));
export const ASCENSION_TRIADS = Object.freeze([['Harek', 'Yena'], ['Harek', 'Tov'], ['Yena', 'Tov']]);
const fresh = () => ({ version: 1, completed: [], tools: [], blooded: false, triad: 0 });

export class AscensionProgress {
  constructor(storage = null) { this.storage = storage; this.state = this._load(); }

  _load() {
    let raw = null; try { raw = this.storage?.getItem(ASCENSION_STORAGE_KEY); } catch {}
    try {
      const saved = raw ? JSON.parse(raw) : null;
      if (saved?.version === 1 && Array.isArray(saved.completed) && saved.completed.every(id => WORLD_IDS.has(id)) && Array.isArray(saved.tools) && typeof saved.blooded === 'boolean')
        return { version: 1, completed: [...new Set(saved.completed)], tools: [...new Set(saved.tools.map(String))], blooded: saved.blooded, triad: Number.isInteger(saved.triad) && saved.triad >= 0 && saved.triad < ASCENSION_TRIADS.length ? saved.triad : 0 };
    } catch {}
    return fresh();
  }

  _save() { try { this.storage?.setItem(ASCENSION_STORAGE_KEY, JSON.stringify(this.state)); } catch {} }

  /** Worlds are hunted in order: every finished world and the next one are open. */
  unlockedWorlds() {
    const next = ASCENSION_WORLDS.find(world => !this.state.completed.includes(world.id));
    return ASCENSION_WORLDS.filter(world => this.state.completed.includes(world.id) || world === next);
  }

  hasTool(tool) { return this.state.tools.includes(tool); }

  complete(worldId) {
    const world = ASCENSION_WORLDS.find(item => item.id === worldId);
    if (!world || !this.unlockedWorlds().includes(world)) return null;
    if (!this.state.completed.includes(world.id)) this.state.completed.push(world.id);
    if (world.reward?.ability && !this.state.tools.includes(world.reward.ability)) this.state.tools.push(world.reward.ability);
    this._save(); return world.reward ?? null;
  }

  /** The rite opens once the eight worlds are hunted (campagne-unblooded.md §6). */
  riteOpen() { return ASCENSION_WORLDS.every(world => this.state.completed.includes(world.id)); }

  triad() { return ASCENSION_TRIADS[this.state.triad]; }

  cycleTriad() { this.state.triad = (this.state.triad + 1) % ASCENSION_TRIADS.length; this._save(); return this.triad(); }

  /** Killing the rite's guardian gives the mark and the rank Blooded, once. */
  completeRite() { if (!this.riteOpen() || this.state.blooded) return false; this.state.blooded = true; this._save(); return true; }

  reset() { this.state = fresh(); this._save(); }
}
