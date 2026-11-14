import test from 'node:test';
import assert from 'node:assert/strict';
import { OPERATION_THIRD_PARTIES, parseThirdParties } from '../js/data/OperationThirdParties.js';
import { CivilianPopulation } from '../js/battlefield/CivilianPopulation.js';
import { OperationObjectives } from '../js/battlefield/OperationObjectives.js';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';
import { createOperationScene } from '../js/battlefield/OperationScene.js';

test('civilian counts come from the audit text and nothing is invented', () => {
  assert.equal(OPERATION_THIRD_PARTIES['AFF-08'].count, 32);
  assert.equal(OPERATION_THIRD_PARTIES['AFF-10'].count, 40);
  assert.equal(OPERATION_THIRD_PARTIES['AFF-11'].maxActive, 8);
  assert.equal(OPERATION_THIRD_PARTIES['AFF-12'].species, 'yautja');
  for (const id of ['AFF-01', 'AFF-02', 'AFF-05', 'AFF-21', 'AFF-27']) assert.equal(OPERATION_THIRD_PARTIES[id], undefined, `${id} counts no civilian`);
  assert.equal(parseThirdParties('Aucun combattant tiers.'), null);
});

test('civilians flee a front taken by a hostile camp, wait when sealed, and die only by explicit damage', () => {
  const fronts = [{ id: 'a', owner: 'clan' }, { id: 'b', owner: 'clan' }];
  const sim = { areHostile: (x, y) => x !== y, routes: new Map([['ab', { travelSeconds: 10 }]]), _path: (from, to) => open ? [{ routeId: 'ab' }] : null };
  let open = true; const events = [];
  const population = new CivilianPopulation('T', { count: 4, maxActive: 2, label: 'civils', species: 'human' }, fronts, 0);
  assert.deepEqual(population.members.map(member => member.frontId), ['a', 'b', 'a', 'b']);
  fronts[0].owner = 'hive';
  population.update(1, sim, 'clan', fronts, (type, details) => events.push([type, details.count]));
  assert.deepEqual(events, [['civilians_fleeing', 2]]);
  population.update(11, sim, 'clan', fronts, () => {});
  assert.equal(population.counts().sheltering, 4);
  fronts[1].owner = 'hive'; open = false;
  population.update(12, sim, 'clan', fronts, () => {});
  assert.equal(population.counts().trapped, 4, 'no route and no safe front: they wait, nobody is killed');
  assert.equal(population.counts().dead, 0);
  assert.equal(population.damage('T:civil:0', 60), true);
  assert.equal(population.damage('T:civil:0', 10), false, 'a death is recorded once');
  assert.equal(population.counts().dead, 1);
});

test('an operation keeps its combat allocation and saves its civilians', () => {
  const { config } = createOperationScene({ operationId: 'AFF-08', mapSeed: 0 });
  const sim = new BattleSimulation(config), allocated = sim.units.size;
  const objectives = new OperationObjectives(config, sim);
  try {
    const hud = objectives.getHUDState();
    assert.equal(hud.civilians.allocated + hud.civilians.reservedByTasks, 32);
    assert.equal(sim.units.size, allocated, 'civilians never enter the combat allocation');
    const saved = objectives.serialize();
    const again = new OperationObjectives(config, sim);
    assert.equal(again.restore(saved), true);
    const older = structuredClone(saved); delete older.population;
    assert.equal(new OperationObjectives(config, sim).restore(older), true, 'a save from before the population still resumes');
    again.dispose();
  } finally { objectives.dispose(); sim.dispose(); }
});
