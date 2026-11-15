import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { EnvironmentManager } from '../js/entities/Environment.js';
import { LEVELS_DATA } from '../js/data/levelsData.js';
import { moveSquadActor } from '../js/engine/FactionSquadRoles.js';

/* AUD-063: an assault crosses a gate while an evacuation goes the other way, on the real built
 * corridors and colliders. Every agent must arrive and none may stay stuck. Actor-to-actor
 * collision is not simulated by the game, so this measures geometry, gates and lanes only. Agents move
 * through moveSquadActor, the same step the faction squads use in play. */
function stress(levelId, { assault = 16, evacuation = 8, radius = .75, speed = 8, seconds = 60 } = {}) {
  const env = new EnvironmentManager(new THREE.Scene());
  env.buildLevelEnvironment({ ...LEVELS_DATA.find(level => level.id === levelId), battlefield: true });
  const layout = env.battlefieldLayout;
  for (const gate of layout.gates) env.openGate?.(gate.id);
  const [from, to] = layout.sectors, a = new THREE.Vector3(from.center[0], 0, from.center[1]), b = new THREE.Vector3(to.center[0], 0, to.center[1]);
  const spawn = (origin, goal, count, side) => Array.from({ length: count }, (_, index) => {
    const position = origin.clone().add(new THREE.Vector3(((index % 4) - 1.5) * 3, 0, Math.floor(index / 4) * 3 * side));
    env.resolveMovement(position, radius);
    const actor = { mesh: { position, rotation: { y: 0 } }, radius };
    return { position, actor, goal, arrivedAt: null, still: 0, worstStill: 0 };
  });
  const manager = { environment: env };
  const agents = [...spawn(a, b, assault, 1), ...spawn(b, a, evacuation, -1)], dt = 1 / 15;
  for (let step = 0; step < seconds / dt && agents.some(agent => agent.arrivedAt === null); step++) {
    for (const agent of agents) {
      if (agent.arrivedAt !== null) continue;
      if (agent.position.distanceTo(agent.goal) < 6) { agent.arrivedAt = step * dt; continue; }
      const previous = agent.position.clone();
      moveSquadActor(manager, agent.actor, agent.goal, dt, speed);
      const moved = agent.position.distanceTo(previous);
      agent.still = moved < .02 ? agent.still + dt : 0; agent.worstStill = Math.max(agent.worstStill, agent.still);
    }
  }
  return { agents, gates: layout.gates.length, corridor: layout.corridors[0]?.id };
}

for (const levelId of ['val_verde_jungle', 'gunnison_forest', 'antarctic_pyramid', 'la_rooftops']) {
  test(`${levelId}: an assault and an opposite evacuation both cross the first gate without a lasting block`, () => {
    const { agents } = stress(levelId);
    const stuck = agents.filter(agent => agent.arrivedAt === null);
    assert.deepEqual(stuck.map(agent => agent.position.toArray().map(value => +value.toFixed(1))), [], 'every agent arrives within 60 s');
    const worst = Math.max(...agents.map(agent => agent.worstStill));
    assert.ok(worst < 3, `no agent stands still more than 3 s (worst ${worst.toFixed(2)} s)`);
  });
}
