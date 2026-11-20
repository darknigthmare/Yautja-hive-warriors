/* Playable extensions use game units, never inferred film dimensions. Sector
 * functions drive physical dressing, approach trails and arrival placement. */
import { CHARACTERS_DATA } from './charactersData.js';
const referenceHunter = CHARACTERS_DATA.find(character => character.id === 'jungle_hunter');
const referenceSpeed = referenceHunter.stats.moveSpeed;
const normalized = (a, b) => {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
};
const point = (center, direction, along, side = 0) => [center[0] + direction[0] * along + direction[1] * side,
  center[1] + direction[1] * along - direction[0] * side];

export function planBattlefieldSectors(layout) {
  for (let index = 0; index < layout.sectors.length; index++) {
    const sector = layout.sectors[index], previous = layout.sectors[index - 1], next = layout.sectors[index + 1];
    const forward = next ? normalized(sector.center, next.center) : normalized(previous?.center ?? [sector.center[0], sector.center[1] + 1], sector.center);
    const arrival = previous ? normalized(sector.center, previous.center) : [-forward[0], -forward[1]];
    const halfWidth = (sector.bounds.maxX - sector.bounds.minX) / 2, halfDepth = (sector.bounds.maxZ - sector.bounds.minZ) / 2;
    const alongLimit = Math.min(halfWidth, halfDepth);
    const role = sector.objective.type === 'boss' ? 'duel' : sector.objective.type === 'commander' ? 'strongpoint'
      : sector.objective.type === 'interact' ? 'decision' : index === 0 ? 'staging' : 'assault';
    // A sheltered rear quarter remains a route choice, not a new safe-zone
    // immunity. Real pursuers and existing attacks may still reach it.
    const quiet = point(sector.center, arrival, Math.min(47, alongLimit - 14));
    const frontline = point(sector.center, forward, Math.min(42, alongLimit - (role === 'duel' ? 26 : 22)));
    const approach = point(sector.center, arrival, Math.min(51, alongLimit - 10));
    sector.planning = {
      role, provenance: 'Original playable extension; distances in game units', forward, arrival,
      zones: [
        { id: `${sector.id}:rear`, kind: 'quiet', center: quiet, radius: 8, purpose: 'Observe the two exits and approach cover before committing', newArrivalAllowed: false },
        { id: `${sector.id}:decision`, kind: 'decision', center: [...sector.objective.position], radius: 15, purpose: sector.objective.label, newArrivalAllowed: false },
        { id: `${sector.id}:front`, kind: role === 'duel' ? 'duel' : 'dense', center: frontline, radius: role === 'duel' ? 24 : 20, purpose: next ? `Approach to ${next.name}` : 'Final encounter approach', newArrivalAllowed: true }
      ],
      approachTrail: [approach, [...sector.center], [...sector.objective.position]],
      capacity: { desiredCombatants: sector.recommendedEnemies, area: halfWidth * halfDepth * 4,
        desiredCombatantsPer1000SquareUnits: sector.recommendedEnemies / (halfWidth * halfDepth * 4) * 1000,
        simultaneousDetailedActors: 'Shared mission cap; this is not a per-room allocation' },
      travel: { movementUnitsPerSecond: referenceSpeed, referenceCharacterId: referenceHunter.id, source: 'Character data, balanced style, no sprint or status modifier',
        nextCenterDistance: next ? Math.hypot(next.center[0] - sector.center[0], next.center[1] - sector.center[1]) : null,
        nextCenterUnopposedSeconds: next ? Math.hypot(next.center[0] - sector.center[0], next.center[1] - sector.center[1]) / referenceSpeed : null }
    };
  }
  return layout;
}

export function quietArrivalPocket(sector, position, padding = 0) {
  const pocket = sector?.planning?.zones.find(zone => zone.kind === 'quiet');
  return !!pocket && Math.hypot(position.x - pocket.center[0], position.z - pocket.center[1]) < pocket.radius + padding;
}
