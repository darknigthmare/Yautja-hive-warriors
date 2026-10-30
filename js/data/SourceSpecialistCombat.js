/* Tactical interpretations of the source roles in AVP: Extinction.
 * Source weapon rules are deliberately data, never an implied official balance
 * sheet. Finite ammunition/repair stock is an adaptation for Hive Warriors. */
import { sourceUnitVisualKind } from './SourceActorPresentation.js';

export const SPECIALIST_STOCK_CAPS = Object.freeze({
  commtech: Object.freeze({ repairParts: 3 }),
  sniper: Object.freeze({ sniperRounds: 6 }),
  sadar: Object.freeze({ sadarMissiles: 4 }),
  exosuit: Object.freeze({ exosuitArmor: 100 })
});

export const SPECIALIST_ATTACKS = Object.freeze({
  medic: Object.freeze({
    range: 13, stopping: 8, damage: 12, playerDamage: 6,
    windup: .65, recovery: 1.5, cooldown: 1.7,
    explanation: 'Medic M4A3 sidearm: defensive weapon with reduced range; upgraded ailments not simulated.'
  }),
  commtech: Object.freeze({
    range: 18, stopping: 10, damage: 16, playerDamage: 8,
    windup: .8, recovery: 1.5, cooldown: 1.6,
    explanation: 'CommTech MP9 close-assault SMG; uplink requisition remains unavailable.'
  }),
  sniper: Object.freeze({
    range: 36, stopping: 24, damage: 75, playerDamage: 24,
    windup: 1.0, recovery: 2.8, cooldown: 3.2,
    explanation: 'Long-range armor-piercing first-target shot; upgrade penetration not yet implemented.'
  }),
  sadar: Object.freeze({
    range: 28, stopping: 19, damage: 72, playerDamage: 25,
    splashDamage: 30, splashRadius: 3.6, missileSpeed: 26,
    windup: 1.1, recovery: 3.1, cooldown: 4.0,
    explanation: 'Finite guided missile with local physical travel and terrain collision; AMAG upgrade not implemented.'
  }),
  exosuit: Object.freeze({
    range: 22, stopping: 13, damage: 42, playerDamage: 18,
    windup: 0.65, recovery: 1.0, cooldown: 1.05,
    explanation: 'One pilot; armored assault stance. Twin M103 Torrent upgrade not implemented.'
  })
});

export function sourceSpecialistRole(unit) {
  return sourceUnitVisualKind(unit);
}
export function initialSpecialistStocks(unit) {
  const caps = SPECIALIST_STOCK_CAPS[sourceSpecialistRole(unit)];
  return caps ? { ...caps } : {};
}
export function restoreSpecialistStocks(saved, original) {
  const caps = SPECIALIST_STOCK_CAPS[sourceSpecialistRole(original)] ?? {};
  const allFields = new Set(Object.values(SPECIALIST_STOCK_CAPS).flatMap(rule => Object.keys(rule)));
  for (const field of allFields) {
    const value = saved[field];
    if (!Object.hasOwn(caps, field)) {
      if (value !== undefined) throw new TypeError(`Unexpected specialist stock ${field}`);
      continue;
    }
    // A source-v1 checkpoint predates these tactical stocks. It resumes with
    // zero rather than a full refilled kit or a silently changed digest.
    const restored = value ?? 0;
    if (!Number.isInteger(restored) || restored < 0 || restored > caps[field]) {
      throw new RangeError(`Invalid specialist stock ${field}`);
    }
    saved[field] = restored;
  }
  return saved;
}
