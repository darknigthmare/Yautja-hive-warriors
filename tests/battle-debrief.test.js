import test from'node:test';import assert from'node:assert/strict';import{createOperationScene}from'../js/battlefield/OperationScene.js';import{BattleSimulation}from'../js/battlefield/BattleSimulation.js';import{OperationObjectives}from'../js/battlefield/OperationObjectives.js';import{captureBattleDebrief}from'../js/ui/OperationPanel.js';
import { operationAlertState } from '../js/ui/OperationPanel.js';
test('final debrief snapshots all finite states and named losses before mission teardown',()=>{const{config}=createOperationScene({operationId:'AFF-01'});const simulation=new BattleSimulation(config);const objectives=new OperationObjectives(config,simulation);const commander=[...simulation.units.values()].find(unit=>unit.uniqueId);simulation.recordDeath({entityId:commander.id,killerFaction:config.playerFaction});simulation.finishOperation({outcome:'defeat',reason:'players_defeated'});const debrief=captureBattleDebrief(simulation,objectives);const allocated=config.groups.reduce((sum,group)=>sum+group.units.length,0);assert.equal(debrief.rows.reduce((sum,row)=>sum+row.allocated,0),allocated);assert.equal(debrief.rows.reduce((sum,row)=>sum+row.dead,0),1);assert.ok(debrief.reconciled);assert.ok(debrief.named.some(row=>row.id===commander.uniqueId&&row.state==='dead'));assert.ok(debrief.journal.some(event=>event.type==='unit_died'));simulation.dispose();objectives.dispose();assert.equal(debrief.rows.reduce((sum,row)=>sum+row.allocated,0),allocated);assert.equal(debrief.result.outcome,'defeat');assert.equal(captureBattleDebrief(null),null);});

function criticalFrontFixture(objectives = {}) {
  const fronts = [
    { id: 'landing', label: 'Zone d’insertion', position: [0, 0], radius: 20, owner: 'clan' },
    { id: 'relay', label: 'Relais radio', position: [100, 0], radius: 20, owner: 'human' },
    { id: 'command', label: 'Poste de commandement', position: [100, 100], radius: 20, owner: 'clan' }
  ];
  return {
    id: 'critical-debrief', mode: 'original', context: { era: 'alternative' }, playerFaction: 'clan',
    factions: [{ id: 'clan', species: 'yautja' }, { id: 'human', species: 'human' }, { id: 'hive', species: 'xenomorph' }],
    relations: [{ a: 'clan', b: 'human', state: 'hostile' }, { a: 'clan', b: 'hive', state: 'hostile' }, { a: 'human', b: 'hive', state: 'hostile' }],
    fronts, routes: [{ id: 'west', from: 'landing', to: 'relay', travelSeconds: 10 }, { id: 'north', from: 'relay', to: 'command', travelSeconds: 10 }],
    profiles: ['clan', 'human', 'hive'].map((id, index) => ({ id, species: ['yautja', 'human', 'xenomorph'][index], maxHp: 100, damage: 0, attackInterval: 2 })),
    groups: ['clan', 'human', 'hive'].map((factionId, index) => ({ id: factionId, factionId, frontId: fronts[index].id, state: 'reserve',
      units: Array.from({ length: 4 }, (_, unit) => ({ id: `${factionId}-${unit}`, profileId: factionId, officer: unit === 0 })) })),
    budgets: { active: 32, spawnInterval: 8, announcementSeconds: 3, arrivalsPerTick: 4, spawnDistance: 24 },
    objectives: { externalVictory: true, loseFronts: ['landing', 'command'], defeatGraceSeconds: 5, ...objectives }, ai: { enabled: false }
  };
}
function advanceToResult(simulation) {
  for (let tick = 0; tick < 100 && !simulation.result; tick++) simulation.update(.25);
  assert.ok(simulation.result, 'the actual simulation must decide the result');
}

test('the critical alert identifies the earliest live deadline rather than the most recent loss event', () => {
  const simulation = new BattleSimulation(criticalFrontFixture());
  try {
    simulation.captureBase('landing', 'human'); simulation.update(.25);
    for (let tick = 0; tick < 4; tick++) simulation.update(.25);
    simulation.captureBase('command', 'hive'); simulation.update(.25);
    const state = simulation.getHUDState(), players = [{ id: 'player1', hp: 0, position: [0, 0] }, { id: 'player2', hp: 100, position: [100, 100] }];
    assert.equal(simulation.events.filter(event => event.type === 'critical_front_lost').at(-1).frontId, 'command', 'newest loss has the later deadline');
    const alert = operationAlertState(state, null, players);
    assert.equal(alert.frontId, 'landing'); assert.match(alert.text, /Zone d’insertion/); assert.match(alert.text, /4 s/);
    assert.match(alert.text, /NO 141 u/, 'navigation uses the surviving co-op hunter');
    assert.doesNotMatch(alert.text, /Poste de commandement/);
  } finally { simulation.dispose(); }
});

test('a restored loss names only the expired front after the other front is recovered, and survives teardown', () => {
  const config = criticalFrontFixture(), original = new BattleSimulation(config);
  let restored;
  try {
    original.captureBase('landing', 'human'); original.update(.25);
    original.update(1); original.captureBase('command', 'hive'); original.update(.25);
    original.captureBase('landing', 'clan'); original.update(.25);
    const beforePause = original.saveState(); original.update(60, { paused: true });
    assert.deepEqual(original.saveState(), beforePause);
    restored = BattleSimulation.fromState(config, original.saveState());
    assert.equal(operationAlertState(restored.getHUDState(), null).frontId, 'command');
    advanceToResult(restored);
    assert.deepEqual(restored.getResult().fronts, ['command']);
    const debrief = captureBattleDebrief(restored), snapshot = structuredClone(debrief);
    assert.match(debrief.reason, /front critique.*Poste de commandement.*repris.*délai/);
    assert.doesNotMatch(debrief.reason, /Zone d’insertion|chasseurs.*vaincus|conditions de poursuite/);
    assert.deepEqual(debrief.cause, { code: 'critical_front_lost', fronts: [{ id: 'command', label: 'Poste de commandement' }] });
    restored.fronts.get('command').label = 'Changed after capture'; restored.dispose(); original.dispose();
    assert.deepEqual(debrief, snapshot); assert.ok(debrief.reconciled);
  } finally { original.dispose(); restored?.dispose(); }
});

test('simultaneous critical losses retain both authored names and keep ordinary timeout and objective results specific', () => {
  const lost = new BattleSimulation(criticalFrontFixture());
  const timeout = new BattleSimulation(criticalFrontFixture({ loseFronts: [], timeLimit: 1 }));
  const victory = new BattleSimulation(criticalFrontFixture({ externalVictory: false, loseFronts: [], captureFronts: ['landing'] }));
  try {
    lost.captureBase('landing', 'human'); lost.captureBase('command', 'hive'); advanceToResult(lost);
    const debrief = captureBattleDebrief(lost);
    assert.match(debrief.reason, /fronts critiques.*Zone d’insertion.*Poste de commandement.*n’ont pas/);
    assert.deepEqual(debrief.cause.fronts.map(front => front.id), ['landing', 'command']);
    advanceToResult(timeout); assert.equal(timeout.getResult().reason, 'operation_timeout');
    assert.match(captureBattleDebrief(timeout).reason, /délai de mission a expiré/);
    advanceToResult(victory); assert.equal(victory.getResult().reason, 'objectives_completed');
    assert.equal(captureBattleDebrief(victory).reason, 'Les objectifs ont été accomplis.');
  } finally { lost.dispose(); timeout.dispose(); victory.dispose(); }
});
