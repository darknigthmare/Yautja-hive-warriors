import test from 'node:test';
import assert from 'node:assert/strict';
import { createOperationScene } from '../js/battlefield/OperationScene.js';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';
import { OperationObjectives } from '../js/battlefield/OperationObjectives.js';

const scene = options => createOperationScene({ operationId: 'AFF-27', mapSeed: 0, ...options }).config;

test('the LV-742 brood moves eight allocated Facehuggers into the Queen chamber without creating anyone', () => {
  const sim = new BattleSimulation(scene()), legacy = new BattleSimulation(scene({ legacyBrood: true }));
  try {
    const brood = sim.groups.get('AFF-27:hive:brood');
    assert.equal(brood.units.length, 8);
    assert.ok(brood.units.every(id => sim.units.get(id).actorType === 'facehugger' && sim.units.get(id).state === 'reserve'));
    assert.equal(sim.units.size, legacy.units.size, 'same finite identities');
    assert.deepEqual(Object.fromEntries(Object.entries(sim.getCounts()).map(([f, c]) => [f, [c.allocated, c.reserve]])),
      Object.fromEntries(Object.entries(legacy.getCounts()).map(([f, c]) => [f, [c.allocated, c.reserve]])), 'totals and reserves unchanged');
    assert.equal(sim.requestReinforcements('hive', 'front_a', brood.id).accepted, false, 'a brood never leaves as a wave');
  } finally { sim.dispose(); legacy.dispose(); }
});

test('eggs hatch when the hunter reaches the chamber, and burning them records one death each', () => {
  const sim = new BattleSimulation(scene());
  try {
    const brood = sim.groups.get('AFF-27:hive:brood');
    for (let i = 0; i < 40; i++) sim.update(.25, { players: [] });
    assert.equal(brood.hatchedAt, null, 'staged armies on the wider front do not wake it');
    sim.update(.25, { players: [{ id: 'player1', hp: 100, position: [...brood.position] }] });
    assert.notEqual(brood.hatchedAt, null);
    assert.ok(brood.units.every(id => sim.units.get(id).state !== 'reserve'));
    assert.equal(sim.burnBrood(brood.id), 0, 'hatched eggs cannot be burned');
  } finally { sim.dispose(); }
  const other = new BattleSimulation(scene()), objectives = new OperationObjectives(scene(), other);
  try {
    assert.ok(objectives.spec.tasks.some(task => task.burnsBroodGroupId === 'AFF-27:hive:brood'));
    assert.equal(other.burnBrood('AFF-27:hive:brood'), 8);
    assert.equal([...other.deaths.values()].filter(death => death.cause === 'brood_burned').length, 8);
    assert.equal(other.assertConservation(), true);
  } finally { objectives.dispose(); other.dispose(); }
});

test('a configuration rebuilt for an older checkpoint has no brood and no burn task', () => {
  const config = scene({ legacyRouteGates: true, legacySourceLinks: true, legacyBrood: true });
  const sim = new BattleSimulation(config), objectives = new OperationObjectives(config, sim);
  try {
    assert.equal(sim.digest, '854faa22');
    assert.equal(objectives.spec.tasks.some(task => task.id === 'brood'), false);
  } finally { objectives.dispose(); sim.dispose(); }
});
