/* Tactical difficulty changes decisions, never the finite army allocation.
 * All distances here are the built game's units, not a film scale claim. */
const copy = value => JSON.parse(JSON.stringify(value));
const valid = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export const BATTLE_DIFFICULTIES = Object.freeze({
  cautious: Object.freeze({ id: 'cautious', label: 'Prudent', interval: 30, minimumGarrisonGroups: 2, assaultMinRatio: 1.4, targetPreference: 'weakest' }),
  standard: Object.freeze({ id: 'standard', label: 'Équilibré', interval: 20, minimumGarrisonGroups: 1, assaultMinRatio: 1, targetPreference: 'weakest' }),
  aggressive: Object.freeze({ id: 'aggressive', label: 'Offensif', interval: 10, minimumGarrisonGroups: 1, assaultMinRatio: .6, targetPreference: 'supply' })
});

export function applyBattleDifficulty(configuration, difficultyId = 'standard') {
  const profile = BATTLE_DIFFICULTIES[difficultyId];
  if (!profile) throw new Error('BattleStrategy: unknown strategic difficulty');
  const result = copy(configuration);
  result.difficulty = { id: profile.id, label: profile.label, scope: 'officer_decisions_only', populationChanged: false };
  result.ai = { ...result.ai, interval: profile.interval, minimumGarrisonGroups: profile.minimumGarrisonGroups,
    assaultMinRatio: profile.assaultMinRatio, targetPreference: profile.targetPreference };
  return result;
}

function distancesFrom(frontId, fronts, routes) {
  const distances = new Map([[frontId, 0]]), pending = new Set(fronts.map(front => front.id));
  while (pending.size) {
    const current = [...pending].sort((a, b) => (distances.get(a) ?? Infinity) - (distances.get(b) ?? Infinity) || a.localeCompare(b))[0];
    const known = distances.get(current); if (known === undefined) break;
    pending.delete(current);
    for (const route of routes) {
      if (route.open === false) continue;
      const next = route.from === current ? route.to : route.to === current ? route.from : null;
      if (!next || !pending.has(next)) continue;
      const points = route.waypoints ?? [fronts.find(front => front.id === route.from).position, fronts.find(front => front.id === route.to).position];
      const length = points.slice(1).reduce((sum, point, index) => sum + distance(points[index], point), 0);
      if (known + length < (distances.get(next) ?? Infinity)) distances.set(next, known + length);
    }
  }
  return distances;
}

/** Give a player at any initially reachable front time to return and recapture.
 * Ten units/s is a conservative walking assumption, below the current kits'
 * base walking speed. The extra path factor allows room traversal and cover.
 * A closed/unreachable route is reported, not silently treated as a shortcut. */
export function measureDefeatReturn(configuration, frontId, { playerSpeed = 10, reactionSeconds = 12, maneuverFactor = 1.2, sourceGraceSeconds = configuration.objectives?.defeatGraceSeconds ?? 30 } = {}) {
  if (!valid(playerSpeed, 1, 50) || !valid(reactionSeconds, 0, 120) || !valid(maneuverFactor, 1, 3)) throw new Error('BattleStrategy: invalid return-travel assumptions');
  if (!valid(sourceGraceSeconds, 1, 7200)) throw new Error('BattleStrategy: invalid source defeat window');
  const front = configuration.fronts.find(item => item.id === frontId);
  if (!front) throw new Error('BattleStrategy: critical front is absent from the built scene');
  const distances = distancesFrom(frontId, configuration.fronts, configuration.routes ?? []);
  const longestRoute = Math.max(0, ...distances.values());
  const localApproach = Math.max(0, ...configuration.fronts.map(item => item.radius ?? 50)) + (front.radius ?? 50);
  const returnTravelSeconds = Math.ceil((longestRoute + localApproach) * maneuverFactor / playerSpeed);
  const recaptureSeconds = front.captureThreshold ?? 30;
  const graceSeconds = Math.max(sourceGraceSeconds, returnTravelSeconds + recaptureSeconds + reactionSeconds);
  if (graceSeconds > 7200) throw new Error('BattleStrategy: built map requires a return window above the supported bound');
  return { longestRouteDistance: longestRoute, localApproachDistance: localApproach, returnTravelSeconds,
    recaptureSeconds, graceSeconds, unreachableFrontIds: configuration.fronts.filter(item => !distances.has(item.id)).map(item => item.id) };
}

export function calibrateDefeatWindow(configuration, { playerSpeed = 10, reactionSeconds = 12, maneuverFactor = 1.2 } = {}) {
  const result = copy(configuration), objectives = result.objectives ??= {};
  const sourceGraceSeconds = objectives.defeatWindow?.sourceGraceSeconds ?? objectives.defeatGraceSeconds ?? 30;
  if (!valid(sourceGraceSeconds, 1, 7200)) throw new Error('BattleStrategy: invalid source defeat window');
  const byFront = {};
  for (const frontId of objectives.loseFronts ?? []) {
    byFront[frontId] = measureDefeatReturn(result, frontId, { playerSpeed, reactionSeconds, maneuverFactor, sourceGraceSeconds });
  }
  objectives.defeatWindow = { version: 1, sourceGraceSeconds, playerSpeed, reactionSeconds, maneuverFactor, byFront,
    basis: 'longest initially open shortest physical route, conservative walking speed, local approach and recapture time' };
  objectives.defeatGraceSeconds = Math.max(sourceGraceSeconds, ...Object.values(byFront).map(item => item.graceSeconds));
  return result;
}
