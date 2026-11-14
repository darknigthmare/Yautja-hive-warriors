import test from 'node:test';
import assert from 'node:assert/strict';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';
import { applyFormationImpact } from '../js/battlefield/FormationTactics.js';

function config() {
  const factions = ['clan', 'enemy', 'hive'];
  return { id: 'intel-operation', mode: 'original', playerFaction: 'clan', factions: factions.map((id, i) => ({ id, species: ['yautja', 'human', 'xeno'][i] })),
    relations: [{ a: 'clan', b: 'enemy', state: 'hostile' }, { a: 'clan', b: 'hive', state: 'hostile' }, { a: 'hive', b: 'enemy', state: 'hostile' }],
    fronts: factions.map((owner, i) => ({ id: `f${i}`, label: `Front ${i}`, position: [i * 200, 0], radius: 50, owner, reinforcementSource: true })),
    routes: [{ id: 'r0', from: 'f0', to: 'f1', travelSeconds: 4 }, { id: 'r1', from: 'f1', to: 'f2', travelSeconds: 4 }],
    profiles: factions.map((id, i) => ({ id, species: ['yautja', 'human', 'xeno'][i], damage: 0, maxHp: 100 })),
    groups: factions.map((factionId, i) => ({ id: factionId, factionId, frontId: `f${i}`, position: [i * 200 + 30, 0], units: Array.from({ length: 4 }, (_, n) => ({ id: `${factionId}-${n}`, profileId: factionId, officer: n === 0 })) })),
    budgets: { active: 8 }, ai: { enabled: false }, objectives: { externalVictory: true } };
}
function advance(sim, seconds, options = {}) { for (let tick = 0; tick < seconds * 4; tick++) sim.update(.25, options); }
const group = (sim, id) => sim.getHUDState().groups.find(item => item.id === id);

test('unknown enemies are absent from tactical knowledge; direct sight respects walls and both living players', () => {
  let canSee = false;
  const sim = new BattleSimulation(config(), { canObserve: () => canSee });
  assert.equal(group(sim, 'enemy'), undefined); assert.equal(sim.getHUDState().fronts[1].intelState, 'unknown');
  assert.equal(sim.getHUDState().fronts[1].sourceHP, null);
  assert.equal(sim.getHUDState().intelCounts.enemy.knownAlive, 0); assert.equal(sim.getCounts().enemy.allocated, 4);
  const players = [{ id: 'p1', hp: 100, position: [0, 0] }, { id: 'p2', hp: 100, position: [200, 0] }];
  sim.update(.25, { players }); assert.equal(group(sim, 'enemy'), undefined);
  canSee = true; sim.update(.25, { players });
  assert.equal(group(sim, 'enemy').intelState, 'observed'); assert.equal(group(sim, 'enemy').precisePositionKnown, true);
  assert.equal(group(sim, 'enemy').officerHP, 100); assert.equal(sim.getHUDState().fronts[1].owner, 'enemy');
  const observed = group(sim, 'enemy').position;
  sim.issueOrder('enemy', { type: 'attack', frontId: 'f2' }); advance(sim, 1, { players: [] });
  assert.deepEqual(group(sim, 'enemy').position, observed); assert.notDeepEqual(sim.getGroup('enemy').position, observed);
  assert.equal(group(sim, 'enemy').precisePositionKnown, false); assert.ok(group(sim, 'enemy').reportAge >= 1);
});

test('remote scouts deliver the actual old snapshot after a causal delay; losses and ownership stay unknown until reported', () => {
  const sim = new BattleSimulation(config()); sim.issueOrder('clan', { type: 'attack', frontId: 'f1' }); advance(sim, 5);
  assert.equal(group(sim, 'enemy'), undefined);
  assert.ok(sim.getHUDState().intelligence.pendingReports > 0);
  sim.recordDeath({ entityId: 'enemy-0', killerFaction: 'clan' });
  advance(sim, 3.5); assert.equal(group(sim, 'enemy'), undefined);
  advance(sim, .5);
  const report = group(sim, 'enemy'); assert.equal(report.reportSource, 'allied_scout'); assert.ok(report.reportAge >= 4);
  assert.equal(report.officerHP, 100, 'delivery must not read the newer live HP');
  assert.ok(sim.getHUDState().alerts.every(event => event.entityId !== 'enemy-0'), 'an unreported distant death is not leaked through alerts');
  advance(sim, 8.25); assert.equal(group(sim, 'enemy').officerHP, 0);
  assert.ok(sim.getHUDState().alerts.some(event => event.entityId === 'enemy-0'));
  assert.equal(sim.assertConservation(), true);
});

test('reconnaissance is temporary and pause-safe, keeps a last known position, and survives checkpoints without new actors', () => {
  const sim = new BattleSimulation(config()), identities = [...sim.units.keys()];
  assert.equal(sim.revealGroup('enemy', { duration: 2, source: 'drone' }), true);
  assert.equal(group(sim, 'enemy').intelState, 'detected'); assert.equal(group(sim, 'enemy').precisePositionKnown, true);
  sim.issueOrder('enemy', { type: 'attack', frontId: 'f2' }); advance(sim, 1);
  const saved = sim.saveState(), restored = BattleSimulation.fromState(config(), saved);
  assert.deepEqual(group(restored, 'enemy'), group(sim, 'enemy'));
  sim.update(20, { paused: true }); assert.equal(sim.time, 1); assert.equal(sim.revealGroup('hive'), false);
  restored.update(20, { paused: true }); assert.equal(restored.time, 1);
  advance(sim, 2); advance(restored, 2);
  assert.deepEqual(group(restored, 'enemy'), group(sim, 'enemy')); assert.equal(group(sim, 'enemy').precisePositionKnown, false);
  const lastPosition = group(sim, 'enemy').position; advance(sim, 25);
  assert.deepEqual(group(sim, 'enemy').position, lastPosition); assert.equal(group(sim, 'enemy').intelState, 'stale');
  assert.deepEqual([...sim.units.keys()], identities); assert.equal(sim.deaths.size, 0);
  const corrupt = structuredClone(saved); corrupt.intelligence.groups[0].snapshot.officerHP = 10000;
  assert.throws(() => BattleSimulation.fromState(config(), corrupt), /tactical knowledge/);
});

test('formation disruption, recovery and route availability are bounded causal state, never extra deaths or units', () => {
  const sim = new BattleSimulation(config(), { routeAvailabilityProvider: route => route.id !== 'r0' });
  assert.equal(sim.setRouteOpen('r0', false), true); assert.equal(sim.setRouteOpen('r0', true), false);
  assert.equal(sim.setFormation('clan', 'wedge').accepted, true);
  const before = sim.getCounts();
  const hit = { groupId: 'clan', kind: 'line_break', sourceFaction: 'enemy', attackId: 'one-swing', hitUnitIds: ['clan-1'] };
  assert.equal(applyFormationImpact(sim, hit).accepted, true); assert.equal(applyFormationImpact(sim, hit).accepted, false);
  assert.ok(sim.getGroup('clan').cohesion < 100); assert.ok(sim.getGroup('clan').rootUntil > sim.time);
  sim.groups.get('clan').suppressedUntil = sim.time + 4;
  const restored = BattleSimulation.fromState(config(), sim.saveState());
  assert.equal(restored.getGroup('clan').cohesion, sim.getGroup('clan').cohesion);
  const malformed = sim.saveState(); malformed.groups[0].lastFormationImpact = 1e12;
  assert.throws(() => BattleSimulation.fromState(config(), malformed), /formation state/);
  sim.update(10, { paused: true }); assert.equal(sim.time, 0); assert.equal(sim.setFormation('clan', 'line').accepted, true); assert.ok(sim.getGroup('clan').cohesion < 100);
  advance(sim, 30); assert.equal(sim.getGroup('clan').cohesion, 100); assert.deepEqual(sim.getCounts(), before);
  assert.equal(sim.assertConservation(), true);
});
