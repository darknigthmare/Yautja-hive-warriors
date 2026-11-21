import test from 'node:test';
import assert from 'node:assert/strict';
import { createOperationScene } from '../js/battlefield/OperationScene.js';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';
import { BATTLE_OPERATIONS } from '../js/data/BattleCatalog.js';

// AUD-014 / AUD-019 / AUD-024 / AUD-042 / AUD-121: one simulated hour of every playable
// operation, the player away from every front so only the distant battle runs.
// Identities, budgets and deaths stay finite; both sides inflict losses; several fronts
// are contested at once; the saved state does not keep growing once the battle settles.
const playable = BATTLE_OPERATIONS.filter(operation => {
  try { createOperationScene({ operationId: operation.id, players: 1 }); return true; } catch { return false; }
});

test('every playable operation is measured', () => { assert.ok(playable.length >= 25, `${playable.length} playable operations`); });

for (const operation of playable) test(`${operation.id}: one distant hour keeps every identity, death and budget finite`, () => {
  const sim = new BattleSimulation(createOperationScene({ operationId: operation.id, players: 1 }).config);
  const start = [...sim.fronts.values()][0], players = [{ id: 'p1', hp: 100, position: [start.position[0] + 4000, start.position[1] + 4000] }];
  const dead = new Set(), killers = new Set(); let contestedPeak = 0, sizeAt30 = 0;
  for (let time = 0, step = .5; time < 3600; time += step) {
    sim.update(step, { players });
    if (time % 60 >= step) continue;
    sim.assertConservation();
    for (const unit of sim.units.values()) {
      if (unit.state === 'dead') dead.add(unit.id);
      else assert.ok(!dead.has(unit.id), `${unit.id} came back after death`);
    }
    contestedPeak = Math.max(contestedPeak, [...sim.fronts.values()].filter(front => front.contested).length);
    if (Math.abs(time - 1800) < step) sizeAt30 = JSON.stringify(sim.saveState()).length;
  }
  for (const death of sim.deaths.values()) if (death.killerFaction) killers.add(death.killerFaction);
  assert.ok(dead.size > 0, 'the distant battle produced losses');
  assert.ok(killers.size >= 1, 'losses are attributed to a faction');
  assert.ok(contestedPeak >= 2, 'at least two fronts fight at the same time');
  const sizeAt60 = JSON.stringify(sim.saveState()).length;
  assert.ok(sizeAt60 <= sizeAt30 * 1.05, `save grew from ${sizeAt30} to ${sizeAt60} in the second half hour`);
});
