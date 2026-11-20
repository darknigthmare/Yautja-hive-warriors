import test from 'node:test';
import assert from 'node:assert/strict';
import { BATTLE_OPERATIONS, PLAYABLE_OPERATIONS, getBattleBudget, getBattleOperationConfig } from '../js/data/BattleCatalog.js';
import { createOperationScene } from '../js/battlefield/OperationScene.js';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';
import { OperationObjectives } from '../js/battlefield/OperationObjectives.js';

test('the audited catalogue keeps 27 operations and the truce variant is a separate adaptation', () => {
  assert.equal(BATTLE_OPERATIONS.length, 27);
  const variant = PLAYABLE_OPERATIONS.find(operation => operation.id === 'ADP-01');
  assert.equal(variant.adaptedFrom, 'AFF-18');
  assert.equal(variant.budgetId, 'EFF-06');
});

test('ADP-01 allocates exactly EFF-06, with the survivors as their own human camp under a neutral truce', () => {
  const config = getBattleOperationConfig('ADP-01'), budget = getBattleBudget('EFF-06'), base = getBattleOperationConfig('AFF-18');
  const total = faction => config.groups.filter(group => group.factionId === faction).reduce((sum, group) => sum + group.units.length, 0);
  assert.equal(total('player_clan') + total('tobler_survivors'), budget.ally.total);
  assert.equal(total('player_clan'), 12); assert.equal(total('tobler_survivors'), 108);
  assert.equal(total('hive'), base.groups.filter(group => group.factionId === 'hive').reduce((sum, group) => sum + group.units.length, 0), 'same hive as AFF-18');
  assert.equal(config.factions.find(faction => faction.id === 'tobler_survivors').species, 'human');
  assert.equal(config.relations.find(relation => [relation.a, relation.b].includes('tobler_survivors') && [relation.a, relation.b].includes('player_clan')).state, 'neutral', 'no automatic alliance');
  assert.ok(config.groups.filter(group => group.factionId === 'tobler_survivors').every(group => group.sourceTemplateIds.includes('GRP-52')));
  assert.ok(config.groups.every(group => group.id.startsWith('ADP-01:')));
});

test('ADP-01 runs, keeps its identities and resumes from a save', () => {
  const { config } = createOperationScene({ operationId: 'ADP-01', mapSeed: 0 });
  const sim = new BattleSimulation(config), objectives = new OperationObjectives(config, sim);
  try {
    assert.equal(objectives.spec.operationId, 'ADP-01');
    for (let i = 0; i < 240; i++) { sim.update(.25, { players: [] }); objectives.update(.25, []); }
    assert.equal(sim.units.size, 1120); assert.equal(sim.assertConservation(), true);
    const resumed = BattleSimulation.fromState(config, sim.saveState());
    assert.equal(resumed.time, sim.time); resumed.dispose();
  } finally { objectives.dispose(); sim.dispose(); }
});
