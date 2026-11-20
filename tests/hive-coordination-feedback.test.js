import test from 'node:test';
import assert from 'node:assert/strict';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';
import { captureBattleDebrief, hiveCoordinationFeedback, operationAlertState } from '../js/ui/OperationPanel.js';
import { CommandMap } from '../js/ui/CommandMap.js';
import { UIManager } from '../js/ui/UIManager.js';

function fixture() {
  const config = {
    id: 'hive-feedback-regression', mode: 'original', playerFaction: 'clan',
    factions: [{ id: 'clan', species: 'yautja' }, { id: 'hive', species: 'xenomorph' }],
    relations: [{ a: 'clan', b: 'hive', state: 'hostile' }],
    fronts: [
      { id: 'home', label: 'Départ du clan', position: [0, 0], owner: 'clan', reinforcementSource: true },
      { id: 'north', label: 'Bastion nord', position: [100, 0], owner: 'hive', reinforcementSource: true }
    ],
    routes: [{ id: 'access', from: 'home', to: 'north', travelSeconds: 5, waypoints: [[0, 0], [100, 0]] }],
    profiles: [
      { id: 'hunter', species: 'yautja', maxHp: 100, damage: 0, attackInterval: 2 },
      { id: 'guard', species: 'xenomorph', maxHp: 100, damage: 0, attackInterval: 2 }
    ],
    groups: [
      { id: 'hunters', factionId: 'clan', frontId: 'home', units: [{ id: 'hunter-1', profileId: 'hunter', officer: true }] },
      { id: 'royal-guard', label: 'Garde du conduit', factionId: 'hive', frontId: 'north', morale: 70,
        units: [{ id: 'controller-1', profileId: 'guard', officer: true }, { id: 'guard-2', profileId: 'guard' }] }
    ],
    objectives: { externalVictory: true }, ai: { enabled: false }
  };
  const announcements = [], simulation = new BattleSimulation(config, { announce: event => announcements.push(event) });
  simulation.update(.25, { players: [{ id: 'player1', hp: 100, position: [110, 0] }] });
  assert.equal(simulation.recordDeath({ entityId: 'controller-1', killerFaction: 'clan', cause: 'observed-hit' }), true);
  const event = announcements.find(item => item.type === 'hive_coordination_disrupted');
  assert.ok(event, 'the real officer death must emit the mechanical consequence');
  const state = simulation.getHUDState();
  return { simulation, event, state };
}

function assertConsequence(text) {
  assert.match(text, /Garde du conduit/);
  assert.match(text, /Bastion nord/);
  assert.match(text, /coordination|capacité/i);
  assert.match(text, /65\s*%|35\s*%/, 'report the actual .65 mechanical modifier or its 35% reduction');
}

test('a real hive officer death names its group, front and mechanical coordination loss in the HUD feedback', () => {
  const { simulation, event, state } = fixture();
  try {
    assert.equal(simulation.getGroup('royal-guard').coordinationStrength, .65);
    assert.equal(simulation.getGroup('royal-guard').morale, 70, 'the consequence is coordination rather than human fear');
    assert.equal(simulation.deaths.size, 1);
    assertConsequence(hiveCoordinationFeedback(event, state.groups, state.fronts));
    assert.equal(state.alerts[0].type, 'unit_died', 'the higher-priority death report is the actual engine order');
    const alert = operationAlertState(state, null, []);
    assert.equal(alert.frontId, 'north');
    assertConsequence(alert.text);
  } finally { simulation.dispose(); }
});

test('captured debrief retains group and front labels after the operation has been disposed', () => {
  const { simulation } = fixture(), debrief = captureBattleDebrief(simulation);
  simulation.dispose();
  const event = debrief.journal.find(item => item.type === 'hive_coordination_disrupted');
  assert.ok(event);
  assertConsequence(hiveCoordinationFeedback(event));
  assert.equal(debrief.reconciled, true);
});

test('the final debrief renders the mechanical consequence after scene teardown', () => {
  const { simulation } = fixture(), debrief = captureBattleDebrief(simulation), previousDocument = globalThis.document;
  simulation.dispose();
  const elements = [];
  const node = tag => { const result = { tag, children: [], textContent: '', classList: { toggle() {} },
    append(...children) { this.children.push(...children); }, replaceChildren(...children) { this.children = children; } };
    elements.push(result); return result; };
  const root = node('section');
  globalThis.document = { getElementById: () => root, createElement: node };
  try {
    UIManager.prototype.renderBattleDebrief.call({}, debrief);
    const consequence = elements.find(item => item.tag === 'li' && /coordination/i.test(item.textContent));
    assert.ok(consequence, 'the final journal must render an explicit coordination consequence');
    assertConsequence(consequence.textContent);
    assert.doesNotMatch(consequence.textContent, /Rapport de mission/);
  } finally { globalThis.document = previousDocument; }
});

test('the command map renders that real consequence in its tactical journal instead of a generic report', () => {
  const { simulation, event, state } = fixture(), previousDocument = globalThis.document;
  const list = { children: [], replaceChildren(...children) { this.children = children; } };
  globalThis.document = { createElement: () => ({ textContent: '' }) };
  try {
    CommandMap.prototype.updateJournal.call({ state: { ...state, journal: [event] }, root: { querySelector: () => list } });
    assert.equal(list.children.length, 1);
    assertConsequence(list.children[0].textContent);
    assert.doesNotMatch(list.children[0].textContent, /Rapport de front/);
    assert.equal(simulation.deaths.size, 1, 'rendering feedback must not add a second casualty');
  } finally { globalThis.document = previousDocument; simulation.dispose(); }
});
