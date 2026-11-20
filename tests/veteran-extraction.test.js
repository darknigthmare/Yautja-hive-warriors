import test from 'node:test';
import assert from 'node:assert/strict';
import { createOperationScene } from '../js/battlefield/OperationScene.js';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';
import { OperationObjectives } from '../js/battlefield/OperationObjectives.js';

test('freeing the AFF-10 captive assigns the nearest allied squad to escort the veteran to the exit', () => {
  const { config } = createOperationScene({ operationId: 'AFF-10', mapSeed: 0 });
  const sim = new BattleSimulation(config), objectives = new OperationObjectives(config, sim), allocated = sim.units.size;
  try {
    const task = objectives.spec.tasks.find(item => item.id === 'captive'), player = { id: 'player1', hp: 100, position: [...task.position] };
    assert.equal(objectives.interact(player).accepted, true);
    for (let i = 0; i < 20; i++) { sim.update(.25, { players: [player] }); objectives.update(.25, [player]); }
    const veteran = objectives.entities.get('captive');
    assert.equal(veteran.state, 'rescued');
    assert.equal(veteran.sourceTemplateId, 'GRP-16');
    const escort = sim.groups.get(veteran.veteranEscortGroupId);
    assert.equal(escort.factionId, 'player_clan');
    assert.equal(escort.order.type, 'escort');
    assert.equal(escort.order.frontId, objectives.spec.tasks.find(item => item.id === 'evacuation').frontId);
    assert.equal(sim.units.size, allocated, 'the veteran and its guards are already allocated identities');
    const restored = new OperationObjectives(config, sim);
    assert.equal(restored.restore(objectives.serialize()), true);
    assert.equal(restored.entities.get('captive').veteranEscortGroupId, escort.id);
    restored.dispose();
  } finally { objectives.dispose(); sim.dispose(); }
});
