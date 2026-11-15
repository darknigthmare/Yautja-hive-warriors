/* AUD-063: an assault crosses a choke point while an evacuation goes the other way, on the real
 * built corridors, gates, bridges and colliders. Agents move through moveSquadActor, the step the
 * faction squads use in play. Actor-to-actor collision is not simulated by the game, so this
 * measures geometry, gates, lanes and routing only. */
import * as THREE from 'three';
import { EnvironmentManager } from '../../js/entities/Environment.js';
import { LEVELS_DATA } from '../../js/data/levelsData.js';
import { moveSquadActor } from '../../js/engine/FactionSquadRoles.js';

const DT = 1 / 15, RADIUS = .75, SPEED = 8;
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export function buildBattlefield(levelId, { mapId, strategicMode = false } = {}) {
  const env = new EnvironmentManager(new THREE.Scene());
  env.buildLevelEnvironment({ ...LEVELS_DATA.find(level => level.id === levelId), battlefield: true, mapId, strategicMode });
  for (const gate of env.battlefieldLayout.gates) env.openGate(gate.id);
  return env;
}

/** Each column follows its waypoints in order; the evacuation follows them reversed. */
function run(env, path, { assault = 16, evacuation = 8, seconds }) {
  const spawn = (points, count, side) => Array.from({ length: count }, (_, index) => {
    const position = points[0].clone().add(new THREE.Vector3(((index % 4) - 1.5) * 3, 0, Math.floor(index / 4) * 3 * side));
    env.resolveMovement(position, RADIUS);
    return { position, points, next: 1, actor: { mesh: { position, rotation: { y: 0 } }, radius: RADIUS }, arrivedAt: null, still: 0, worstStill: 0, highest: 0 };
  });
  const agents = [...spawn(path, assault, 1), ...spawn([...path].reverse(), evacuation, -1)];
  const manager = { environment: env };
  for (let step = 0; step < seconds / DT && agents.some(agent => agent.arrivedAt === null); step++) {
    for (const agent of agents) {
      if (agent.arrivedAt !== null) continue;
      const last = agent.next === agent.points.length - 1;
      if (flat(agent.position, agent.points[agent.next]) < (last ? 6 : 4)) {
        if (last) { agent.arrivedAt = step * DT; continue; }
        agent.next++;
      }
      const previous = agent.position.clone();
      moveSquadActor(manager, agent.actor, agent.points[agent.next], DT, SPEED);
      agent.highest = Math.max(agent.highest, agent.position.y);
      agent.still = agent.position.distanceTo(previous) < .02 ? agent.still + DT : 0;
      agent.worstStill = Math.max(agent.worstStill, agent.still);
    }
  }
  return summarize(agents, seconds);
}

function summarize(agents, seconds) {
  const stuck = agents.filter(agent => agent.arrivedAt === null);
  return {
    agents: agents.length, arrived: agents.length - stuck.length, limitSeconds: +seconds.toFixed(1),
    lastArrival: +Math.max(0, ...agents.map(agent => agent.arrivedAt ?? 0)).toFixed(1),
    worstStill: +Math.max(...agents.map(agent => agent.worstStill)).toFixed(2),
    highest: +Math.max(...agents.map(agent => agent.highest)).toFixed(2),
    stuck: stuck.map(agent => [agent.position.x, agent.position.y, agent.position.z].map(value => +value.toFixed(1)))
  };
}

const center = sector => new THREE.Vector3(sector.center[0], 0, sector.center[1]);

/** Assault and evacuation across one gated corridor between its two rooms. */
export function corridorCounterflow(env, corridor, options = {}) {
  const layout = env.battlefieldLayout;
  const path = [center(layout.sectors.find(s => s.id === corridor.from)), center(layout.sectors.find(s => s.id === corridor.to))];
  return run(env, path, { seconds: 60, ...options });
}

/** Assault and evacuation along a whole strategic flank or outer route, tactical gates and bridges included. */
export function routeCounterflow(env, route, options = {}) {
  const path = route.waypoints.map(point => new THREE.Vector3(point[0], 0, point[1]));
  const length = path.slice(1).reduce((sum, point, index) => sum + flat(point, path[index]), 0);
  return { length: +length.toFixed(0), ...run(env, path, { seconds: length / SPEED * 1.5 + 30, ...options }) };
}

export const strategicRoutes = env => env.battlefieldLayout.strategicRoutes.filter(route => route.id.endsWith('-flank') || route.id.endsWith('-outer'));
export const gatedCorridors = env => env.battlefieldLayout.corridors.filter(corridor => !corridor.tactical);
