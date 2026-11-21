import test from 'node:test';
import assert from 'node:assert/strict';
import { createOperationScene } from '../js/battlefield/OperationScene.js';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';

// AUD-108: when the second hunter leaves for another front, that front receives its
// fair share of the detail budget, even if the first front had already filled it.
const hostilesNear = (sim, position, radius = 70) => sim.getActiveUnits().filter(unit =>
  sim.relationship(unit.factionId, sim.config.playerFaction) !== 'allied'
  && Math.hypot(unit.position[0] - position[0], unit.position[1] - position[1]) <= radius).length;

function splitRun(operationId) {
  const { config } = createOperationScene({ operationId, players: 2 });
  const sim = new BattleSimulation(config), allocated = sim.units.size;
  const hostile = [...sim.fronts.values()].filter(front => sim.relationship(front.owner, config.playerFaction) !== 'allied');
  const [first, second] = hostile;
  let players = [{ id: 'p1', hp: 100, position: [...first.position] }, { id: 'p2', hp: 100, position: [...first.position] }];
  for (let t = 0; t < 20; t += .25) sim.update(.25, { players });
  const together = hostilesNear(sim, first.position);
  // P2 walks in from 90 units out at a hunter's pace; no unit may appear inside a player.
  const way = [first.position[0] - second.position[0], first.position[1] - second.position[1]], length = Math.hypot(...way);
  let peak = 0;
  for (let t = 0; t < 20; t += .25) {
    const distance = Math.max(10, 90 - 6 * t);
    players = [players[0], { id: 'p2', hp: 100, position: [second.position[0] + way[0] / length * distance, second.position[1] + way[1] / length * distance] }];
    sim.update(.25, { players });
    peak = Math.max(peak, sim.getActiveUnits().length);
  }
  return { sim, config, allocated, together, p1: hostilesNear(sim, players[0].position), p2: hostilesNear(sim, players[1].position), peak };
}

test('a hunter joining a second front is not left alone by slots held on the first front', () => {
  for (const operationId of ['AFF-01', 'AFF-08', 'AFF-17']) {
    const run = splitRun(operationId);
    assert.ok(run.together > 0, `${operationId}: the first front fights`);
    assert.ok(run.p2 > 0, `${operationId}: second front has no detailed threat`);
    assert.ok(run.p1 > 0, `${operationId}: the first front keeps a threat`);
    assert.ok(run.peak <= run.sim.budgets.active, `${operationId}: budget exceeded`);
    assert.equal(run.sim.units.size, run.allocated, `${operationId}: no unit invented`);
  }
});

test('the per-front share respects each faction cap', () => {
  const run = splitRun('AFF-01'), perFaction = new Map();
  for (const unit of run.sim.getActiveUnits()) perFaction.set(unit.factionId, (perFaction.get(unit.factionId) ?? 0) + 1);
  for (const [factionId, count] of perFaction) assert.ok(count <= (run.sim.budgets.byFaction?.[factionId]?.active ?? run.sim.budgets.active), factionId);
});
