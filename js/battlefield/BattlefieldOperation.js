/* Playable, explicitly original three-front preset. Coordinates and routes are
 * bound to the built level; no quoted figure/statue establishes a metric map. */
import { calibrateDefeatWindow } from './BattleStrategy.js';
import { stageOriginalMusouGroups } from './OriginalMusouStaging.js';

const copy = value => JSON.parse(JSON.stringify(value));
const routeLength = waypoints => waypoints.slice(1).reduce((sum, point, index) => sum + Math.hypot(point[0] - waypoints[index][0], point[1] - waypoints[index][1]), 0);
function physicalWaypoints(layout, from, to) {
  const direction = from <= to ? 1 : -1, points = [[...layout.sectors[from].center]];
  for (let index = from; index !== to; index += direction) {
    const a = layout.sectors[index], b = layout.sectors[index + direction];
    const corridor = layout.corridors.find(item => item.from === a.id && item.to === b.id || item.from === b.id && item.to === a.id);
    if (!corridor) throw new Error('BattlefieldOperation: operation route has no physical corridor');
    points.push([...corridor.center], [...b.center]);
  }
  return points;
}

/** Bind a proposed catalogue scenario to actual built rooms and passages.
 * The original map proposal is retained as provenance; this adaptation does
 * not pretend that reusing a level constructs its proposed geographic layout.
 */
export function bindBattleOperationToLayout(configuration, layout) {
  if (!configuration?.fronts?.length || configuration.fronts.length > layout?.sectors?.length) throw new Error('BattlefieldOperation: the built scene cannot represent all operation fronts');
  const result = copy(configuration), sectorToFront = new Map(), oldFronts = new Map();
  const indices = layout.frontAnchorIds?.length === result.fronts.length ? layout.frontAnchorIds.map(id => layout.sectors.findIndex(sector => sector.id === id)) : result.fronts.map((_, index) => Math.round(index * (layout.sectors.length - 1) / Math.max(1, result.fronts.length - 1)));
  if (indices.some(index => index < 0)) throw new Error('BattlefieldOperation: declared front anchor is absent from the built scene');
  result.fronts.forEach((front, index) => {
    oldFronts.set(front.id, { position: [...front.position] });
    const sector = layout.sectors[indices[index]];
    front.position = [...sector.center]; front.radius = Math.min(58, layout.sectorHalfSize ?? 58);
    sectorToFront.set(sector.id, front.id);
  });
  const originalRoutes = copy(result.routes), routes = [];
  for (let index = 0; index < result.fronts.length - 1; index++) {
    const fromSector = layout.sectors[indices[index]], toSector = layout.sectors[indices[index + 1]];
    const physical = (layout.strategicRoutes ?? []).find(route => (route.from === fromSector.id && route.to === toSector.id || route.from === toSector.id && route.to === fromSector.id) && !/flank|outer/.test(route.id));
    const waypoints = physical?.waypoints ? (physical.from === fromSector.id ? copy(physical.waypoints) : copy(physical.waypoints).reverse()) : physicalWaypoints(layout, indices[index], indices[index + 1]);
    const source = originalRoutes.find(route => route.from === result.fronts[index].id && route.to === result.fronts[index + 1].id || route.to === result.fronts[index].id && route.from === result.fronts[index + 1].id);
    routes.push({ id: source?.id ?? `bound-route-${index}`, from: result.fronts[index].id, to: result.fronts[index + 1].id, waypoints,
      travelSeconds: Math.max(1, routeLength(waypoints) / 6), open: true, physicalRouteId: physical?.id ?? null, physicalGateIds: [...(physical?.physicalGateIds ?? [])] });
  }
  for (const route of layout.strategicRoutes ?? []) if (sectorToFront.has(route.from) && sectorToFront.has(route.to)) {
    if (routes.some(item => item.physicalRouteId === route.id)) continue;
    routes.push({ ...copy(route), id: `bound-${route.id}`, physicalRouteId: route.id, from: sectorToFront.get(route.from), to: sectorToFront.get(route.to), open: true });
  }
  result.routes = routes;
  // Source-audited ORIGINAL Musou battles get finite staged squads inside
  // their actual loaded sector bounds. Old saves and all other operations
  // retain the exact historical ring positions and signed config digest.
  const musouStaging = stageOriginalMusouGroups(result, layout,
    indices.map(index => layout.sectors[index].id));
  if (!musouStaging) for (let index = 0; index < result.groups.length; index++) {
    const group = result.groups[index], front = result.fronts.find(item => item.id === group.frontId);
    if (!front) throw new Error('BattlefieldOperation: group has no bound front');
    const angle = index * 2.399963229728653;
    const center = [front.position[0] + Math.cos(angle) * 34, front.position[1] + Math.sin(angle) * 34];
    group.position = center;
    group.units.forEach((unit, at) => { const theta = at / group.units.length * Math.PI * 2; unit.position = [center[0] + Math.cos(theta) * 3, center[1] + Math.sin(theta) * 3]; });
  }
  result.label = configuration.label ?? configuration.name ?? configuration.id;
  result.context = { ...result.context, requiresSceneBinding: false, sceneBinding: 'adapted-built-level', visualFidelity1to1Verified: false };
  result.sceneBinding = { layoutId: layout.id, originalMapId: configuration.mapId ?? null, originalRoutes,
    originalGeographicProposalConstructed: false, frontSectorIds: indices.map(index => layout.sectors[index].id), usesPhysicalStrategicRoutes: Boolean(layout.strategicRoutes?.length),
    ...(musouStaging ? { musouStaging } : {}) };
  return calibrateDefeatWindow(result);
}

/** Returns a serializable configuration, not a running simulation. */
export function createBattlefieldOperation(layout, { levelId = 'unknown', mode = 'original', activeBudget = 32, players = 1 } = {}) {
  if (!layout || !Array.isArray(layout.sectors) || layout.sectors.length < 3) throw new Error('BattlefieldOperation: a built connected level is required');
  if (!['original', 'clan_war', 'crossover'].includes(mode)) throw new Error('BattlefieldOperation: this preset is an original battle, not a verified film reconstruction');
  if (!Number.isInteger(activeBudget) || activeBudget < 8 || activeBudget > 128 || ![1, 2].includes(players)) throw new Error('BattlefieldOperation: invalid detail/player budget');
  const anchors = layout.frontAnchorIds?.map(id => layout.sectors.find(sector => sector.id === id)).filter(Boolean);
  const selected = anchors?.length >= 3 ? [anchors[0], anchors[Math.floor((anchors.length - 1) / 2)], anchors.at(-1)] : [0, Math.floor((layout.sectors.length - 1) / 2), layout.sectors.length - 1].map(index => layout.sectors[index]);
  const fronts = selected.map((sector, index) => ({ id: sector.id, label: sector.name ?? sector.id,
    position: [...sector.center], radius: Math.min(58, layout.sectorHalfSize ?? 58), owner: ['player_clan', 'human_force', 'hive'][index],
    baseHP: 1000, captureThreshold: 25, reinforcementSource: true, criticalFor: index === 0 ? ['player_clan'] : [] }));
  const routes = [];
  if (Array.isArray(layout.strategicRoutes) && layout.strategicRoutes.length) {
    for (const route of layout.strategicRoutes) {
      if (!fronts.some(front => front.id === route.from) || !fronts.some(front => front.id === route.to)) continue;
      routes.push({ open: true, ...copy(route) });
    }
  }
  for (let leg = 0; leg < selected.length - 1; leg++) {
      if (routes.some(route => route.from === selected[leg].id && route.to === selected[leg + 1].id || route.to === selected[leg].id && route.from === selected[leg + 1].id)) continue;
      const from = layout.sectors.indexOf(selected[leg]), to = layout.sectors.indexOf(selected[leg + 1]);
      const waypoints = [];
      for (let index = from; index <= to; index++) {
        if (index > from) {
          const previous = layout.sectors[index - 1], next = layout.sectors[index];
          const corridor = layout.corridors.find(item => item.from === previous.id && item.to === next.id || item.from === next.id && item.to === previous.id);
          if (!corridor) throw new Error('BattlefieldOperation: a strategic route has no physical corridor');
          waypoints.push([...corridor.center]);
        }
        waypoints.push([...layout.sectors[index].center]);
      }
      const length = routeLength(waypoints);
      routes.push({ id: `operation-route-${leg}`, from: selected[leg].id, to: selected[leg + 1].id, waypoints, travelSeconds: Math.max(1, length / 6), open: true });
  }
  const profiles = [
    { id: 'original-clan-warrior', species: 'yautja', role: 'line', actorType: 'yautja', maxHp: 300, damage: 4.8, attackInterval: 5 },
    { id: 'original-clan-officer', species: 'yautja', role: 'officer', actorType: 'yautja', maxHp: 400, damage: 6, attackInterval: 5 },
    { id: 'original-hive-warrior', species: 'xenomorph', role: 'line', actorType: 'warrior', maxHp: 200, damage: 2.4, attackInterval: 5 },
    { id: 'original-hive-controller', species: 'xenomorph', role: 'officer', actorType: 'warrior', maxHp: 300, damage: 3, attackInterval: 5 },
    { id: 'original-security-marine', species: 'human', role: 'line', actorType: 'marine', maxHp: 160, damage: 2.8, attackInterval: 5 },
    { id: 'original-security-officer', species: 'human', role: 'officer', actorType: 'marine', maxHp: 240, damage: 3.2, attackInterval: 5 }
  ].map(profile => ({ ...profile, fidelity: 'original', provenance: 'Original tactical archetype; no named media individual or 1:1 asset claim.' }));
  const groups = [];
  function group(factionId, index, frontIndex, reserve) {
    const front = fronts[frontIndex], angle = index * 1.7;
    const position = [front.position[0] + Math.cos(angle) * 34, front.position[1] + Math.sin(angle) * 34];
    const prefix = { player_clan: 'clan', hive: 'hive', human_force: 'security' }[factionId];
    const line = { player_clan: 'warrior', hive: 'warrior', human_force: 'marine' }[factionId];
    const officer = { player_clan: 'officer', hive: 'controller', human_force: 'officer' }[factionId];
    const groupId = `${levelId}:${factionId}:${index}`;
    groups.push({ id: groupId, label: `${factionId} ${index + 1}`, factionId, frontId: front.id,
      position, state: reserve ? 'reserve' : 'distant', formation: factionId === 'hive' ? 'swarm' : 'line',
      units: Array.from({ length: 4 }, (_, unit) => ({ id: `${groupId}:${unit}`, profileId: `original-${prefix}-${unit === 0 ? officer : line}`, officer: unit === 0 })) });
  }
  for (let index = 0; index < 5; index++) group('player_clan', index, 0, index === 4);
  for (let index = 0; index < 16; index++) group('hive', index, index < 4 ? 1 : 2, index >= 12);
  for (let index = 0; index < 12; index++) group('human_force', index, index < 4 || index >= 8 ? 1 : 2, index >= 8);
  return calibrateDefeatWindow({
    id: `three-fronts:${levelId}`, label: 'Bataille alternative à trois camps', mode, levelId,
    context: { era: 'alternative', works: ['Alien / Predator — scénario original'], continuities: ['original-game-scenario'],
      allowAdaptations: true, sourceLevelId: levelId, players, visualFidelity1to1Verified: false },
    playerFaction: 'player_clan',
    factions: [{ id: 'player_clan', species: 'yautja', allegiance: 'player', moraleModel: 'clan' },
      { id: 'hive', species: 'xenomorph', allegiance: 'independent', moraleModel: 'hive' },
      { id: 'human_force', species: 'human', allegiance: 'independent', moraleModel: 'human' }],
    relations: [{ a: 'player_clan', b: 'hive', state: 'hostile' }, { a: 'player_clan', b: 'human_force', state: 'hostile' }, { a: 'hive', b: 'human_force', state: 'hostile' }],
    budgets: { active: activeBudget, byFaction: { player_clan: { active: Math.min(16, Math.max(4, Math.floor(activeBudget / 4))), distant: 16 - Math.min(16, Math.max(4, Math.floor(activeBudget / 4))), reserve: 4, total: 20 },
      hive: { active: Math.min(48, Math.max(4, Math.floor(activeBudget / 2))), distant: 48 - Math.min(48, Math.max(4, Math.floor(activeBudget / 2))), reserve: 16, total: 64 },
      human_force: { active: Math.min(32, Math.max(4, Math.floor(activeBudget / 4))), distant: 32 - Math.min(32, Math.max(4, Math.floor(activeBudget / 4))), reserve: 16, total: 48 } },
      spawnInterval: 8, arrivalsPerTick: 4, announcementSeconds: 3, spawnDistance: 24 },
    fronts, routes, profiles, groups,
    objectives: { captureFronts: [fronts[1].id, fronts[2].id], loseFronts: [fronts[0].id], defeatGraceSeconds: 45,
      strategies: [{ id: 'control', conditions: [{ type: 'capture', frontId: fronts[1].id }, { type: 'capture', frontId: fronts[2].id }] },
        { id: 'isolate', conditions: [{ type: 'source_disabled', frontId: fronts[1].id }, { type: 'source_disabled', frontId: fronts[2].id }, { type: 'capture', frontId: fronts[2].id }] }] },
    designLimits: { originalScenario: true, legacySingleRouteFallback: !layout.strategicRoutes?.length, physicalUnitsCertified: false }
  });
}
