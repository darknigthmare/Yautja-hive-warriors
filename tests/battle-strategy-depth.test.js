import test from 'node:test';
import assert from 'node:assert/strict';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';
import { applyBattleDifficulty, calibrateDefeatWindow } from '../js/battlefield/BattleStrategy.js';
import { createBattlefieldLayout } from '../js/data/BattlefieldLayouts.js';
import { createBattlefieldOperation } from '../js/battlefield/BattlefieldOperation.js';
import { BATTLEFIELD_MAP_VARIANTS } from '../js/data/BattlefieldMapVariants.js';

const copy = value => JSON.parse(JSON.stringify(value));
function config({ reserve = true, combat = false, alliedAt = 'a', morale = 70 } = {}) {
  const fronts = [
    { id: 'a', position: [0, 0], radius: 45, owner: 'clan', reinforcementSource: true, captureThreshold: 10 },
    { id: 'b', position: [1000, 0], radius: 45, owner: 'human', reinforcementSource: true, captureThreshold: 10 },
    { id: 'c', position: [1000, 1000], radius: 45, owner: 'hive', reinforcementSource: true, captureThreshold: 10 }
  ];
  const groups = [];
  function group(id, factionId, frontId, state = 'distant') {
    const front = fronts.find(item => item.id === frontId);
    groups.push({ id, factionId, frontId, state, morale, position: [front.position[0] + 30, front.position[1]],
      units: Array.from({ length: 4 }, (_, index) => ({ id: `${id}-${index}`, profileId: factionId, officer: index === 0 })) });
  }
  group('ally', 'clan', alliedAt); group('enemy', 'human', 'b'); group('third', 'hive', 'c');
  if (reserve) group('support', 'clan', 'a', 'reserve');
  return { id: 'strategic-depth', mode: 'original', playerFaction: 'clan', context: { era: 'alternative' },
    factions: [{ id: 'clan', species: 'yautja' }, { id: 'human', species: 'human' }, { id: 'hive', species: 'xenomorph' }],
    relations: [{ a: 'clan', b: 'human', state: 'hostile' }, { a: 'clan', b: 'hive', state: 'hostile' }, { a: 'human', b: 'hive', state: 'hostile' }],
    fronts, routes: [{ id: 'ab', from: 'a', to: 'b', travelSeconds: 10, waypoints: [[0, 0], [1000, 0]] },
      { id: 'bc', from: 'b', to: 'c', travelSeconds: 10, waypoints: [[1000, 0], [1000, 1000]] },
      { id: 'ac', from: 'a', to: 'c', travelSeconds: 20, waypoints: [[0, 0], [0, 1000], [1000, 1000]] }],
    profiles: [{ id: 'clan', species: 'yautja', maxHp: 1000, damage: combat ? 10 : 0, attackInterval: 2 },
      { id: 'human', species: 'human', maxHp: 1000, damage: combat ? 10 : 0, attackInterval: 2 },
      { id: 'hive', species: 'xenomorph', maxHp: 1000, damage: combat ? 10 : 0, attackInterval: 2 }],
    groups, budgets: { active: 32, spawnInterval: 8, announcementSeconds: 3, arrivalsPerTick: 4, spawnDistance: 24 },
    objectives: { externalVictory: true }, ai: { enabled: false } };
}
function advance(sim, seconds, options = {}) { for (let tick = 0; tick < Math.round(seconds * 4); tick++) sim.update(.25, options); }

test('all 34 built layouts calibrate physical return/capture time without rewriting the original proposed window', () => {
  for (const variant of BATTLEFIELD_MAP_VARIANTS) {
    const layout = createBattlefieldLayout({ id: variant.baseLevelId, mapId: variant.id, strategicMode: true });
    const configuration = createBattlefieldOperation(layout, { levelId: variant.id });
    const policy = configuration.objectives.defeatWindow;
    assert.equal(policy.sourceGraceSeconds, 45); assert.equal(policy.playerSpeed, 10);
    for (const measured of Object.values(policy.byFront)) {
      assert.ok(measured.graceSeconds >= measured.returnTravelSeconds + measured.recaptureSeconds + policy.reactionSeconds);
      assert.deepEqual(measured.unreachableFrontIds, []);
    }
    assert.equal(new BattleSimulation(configuration).assertConservation(), true);
  }
  const original = config(); original.objectives.loseFronts = ['a']; original.objectives.defeatGraceSeconds = 30;
  const calibrated = calibrateDefeatWindow(original);
  assert.equal(calibrated.objectives.defeatWindow.byFront.a.longestRouteDistance, 2000, 'use the physical bent route instead of a diagonal');
  assert.ok(calibrated.objectives.defeatGraceSeconds > 200); assert.equal(original.objectives.defeatGraceSeconds, 30);
  assert.equal(original.objectives.defeatWindow, undefined);
});

test('critical fronts retain separate deadlines through recovery, pause and checkpoint and reject timer tampering', () => {
  const source = config({ reserve: false });
  source.groups.forEach(group => { group.state = 'reserve'; }); source.fronts.forEach(front => { front.reinforcementSource = false; });
  source.fronts[2].owner = 'clan'; source.objectives = { externalVictory: true, loseFronts: ['a', 'c'], defeatGraceSeconds: 20 };
  const simulation = new BattleSimulation(source);
  simulation.captureBase('a', 'human'); simulation.update(.25); const firstDeadline = simulation.getHUDState().criticalDeadline;
  advance(simulation, 5); simulation.captureBase('c', 'human'); simulation.update(.25);
  assert.equal(simulation.getHUDState().criticalFronts.length, 2);
  const secondDeadline = simulation.getHUDState().criticalFronts.find(item => item.frontId === 'c').deadline;
  assert.ok(secondDeadline > firstDeadline);
  simulation.captureBase('a', 'clan'); simulation.update(.25);
  assert.equal(simulation.getHUDState().criticalDeadline, secondDeadline);
  simulation.update(60, { paused: true }); assert.equal(simulation.getHUDState().criticalDeadline, secondDeadline);
  const saved = simulation.saveState(), resumed = BattleSimulation.fromState(source, saved);
  assert.equal(resumed.getHUDState().criticalDeadline, secondDeadline);
  const invalid = copy(saved); invalid.criticalLosses[0].deadline++;
  assert.throws(() => BattleSimulation.fromState(source, invalid), /critical-front timer/);
  advance(resumed, secondDeadline - resumed.time - .25); assert.equal(resumed.result, null);
  resumed.update(.25); assert.equal(resumed.result.reason, 'critical_front_lost');
  assert.deepEqual(resumed.result.fronts, ['c']);
});

test('a physical detour extends an announced deadline once; complete route loss remains explicitly reported', () => {
  const source = config(); source.routes[2].waypoints = [[0, 0], [-1000, 0], [-1000, 1000], [1000, 1000]];
  source.objectives.loseFronts = ['a']; source.objectives.defeatGraceSeconds = 30;
  const configuration = calibrateDefeatWindow(source), simulation = new BattleSimulation(configuration);
  simulation.captureBase('a', 'human'); simulation.update(.25); const originalDeadline = simulation.getHUDState().criticalDeadline;
  simulation.setRouteOpen('ab', false); simulation.update(.25);
  const extended = simulation.getHUDState().criticalDeadline;
  assert.ok(extended > originalDeadline);
  simulation.setRouteOpen('ab', true); simulation.update(.25); assert.equal(simulation.getHUDState().criticalDeadline, extended);
  simulation.setRouteOpen('ab', false); simulation.update(.25); assert.equal(simulation.getHUDState().criticalDeadline, extended, 'closing the same route does not restart the clock');
  simulation.setRouteOpen('ac', false); simulation.update(.25);
  assert.ok(simulation.events.some(event => event.type === 'critical_return_route_blocked' && event.unreachableFrontIds.includes('b')));
  const restored = BattleSimulation.fromState(configuration, simulation.saveState()); assert.equal(restored.getHUDState().criticalDeadline, extended);
});

test('a retreat follows the actual route, retains losses and returns only after finite support physically arrives', () => {
  const configuration = config({ alliedAt: 'b', morale: 15 }), simulation = new BattleSimulation(configuration);
  simulation.recordDeath({ entityId: 'ally-1', cause: 'combat', killerFaction: 'human' });
  const allocated = [...simulation.units.keys()], totalHP = [...simulation.units.values()].reduce((sum, unit) => sum + unit.hp, 0);
  simulation.update(.25); assert.equal(simulation.getGroup('ally').order.type, 'retreat');
  const first = simulation.getGroup('ally').position; advance(simulation, 3);
  const travelling = simulation.getGroup('ally'); assert.ok(travelling.position[0] < first[0] && travelling.position[0] > 0);
  assert.equal(simulation.issueOrder('ally', { type: 'attack', frontId: 'b' }).reason, 'reconstitution_required');
  advance(simulation, 10);
  assert.equal(simulation.getGroup('ally').order.type, 'regroup'); assert.equal(simulation.getGroup('ally').reconstitution.required, true);
  advance(simulation, 8);
  assert.equal(simulation.getGroup('ally').reconstitution.required, false);
  assert.ok(simulation.events.some(event => event.type === 'group_reconstituted' && event.supportGroupId === 'support' && event.newUnitsCreated === 0));
  assert.equal(simulation.getUnit('ally-1').state, 'dead'); assert.deepEqual([...simulation.units.keys()], allocated);
  assert.equal([...simulation.units.values()].reduce((sum, unit) => sum + unit.hp, 0), totalHP, 'support never heals or creates troops');
  assert.equal(simulation.getCounts().clan.reserve, 0);
  assert.equal(simulation.getGroup('ally').order.frontId, 'b');
  const restored = BattleSimulation.fromState(configuration, simulation.saveState()); assert.deepEqual(restored.getGroup('ally').reconstitution, simulation.getGroup('ally').reconstitution);
  assert.equal(restored.assertConservation(), true);
});

test('morale recovery alone and severed supply cannot release regrouped survivors', () => {
  const source = config({ reserve: false, alliedAt: 'b', morale: 15 }), simulation = new BattleSimulation(source);
  advance(simulation, 220);
  assert.equal(simulation.getGroup('ally').morale, 80); assert.equal(simulation.getGroup('ally').reconstitution.required, true);
  assert.equal(simulation.issueOrder('ally', { type: 'attack', frontId: 'b' }).reason, 'reconstitution_required');
  assert.equal(simulation.getGroup('ally').order.type, 'regroup'); assert.equal(simulation.units.size, 12);
  const backed = new BattleSimulation(config({ alliedAt: 'b', morale: 15 })); advance(backed, 12);
  backed.damageSource('a', 1000); advance(backed, 20);
  assert.equal(backed.getGroup('ally').reconstitution.required, true); assert.equal(backed.getGroup('ally').reconstitution.recoverySeconds, 0);
});

test('strategic difficulties preserve every soldier and combat/resource budget while officers choose different risks', () => {
  const source = config({ reserve: false }); source.ai.enabled = true;
  source.groups.push(copy(source.groups[1])); source.groups.at(-1).id = 'enemy2'; source.groups.at(-1).units.forEach((unit, index) => { unit.id = `enemy2-${index}`; });
  const cautious = applyBattleDifficulty(source, 'cautious'), aggressive = applyBattleDifficulty(source, 'aggressive');
  for (const key of ['groups', 'profiles', 'budgets', 'fronts', 'routes']) assert.deepEqual(cautious[key], aggressive[key]);
  const a = new BattleSimulation(cautious), b = new BattleSimulation(aggressive);
  advance(a, 32); advance(b, 32);
  assert.equal(a.events.some(event => event.type === 'officer_decision' && event.groupId.startsWith('enemy')), false);
  assert.equal(b.events.some(event => event.type === 'officer_decision' && event.groupId.startsWith('enemy')), true);
  assert.deepEqual([...a.units.keys()], [...b.units.keys()]); assert.equal(a.budgets.active, 32); assert.equal(b.budgets.active, 32);
  assert.throws(() => applyBattleDifficulty(source, 'unbounded'), /unknown strategic difficulty/);
  assert.equal(BattleSimulation.fromState(aggressive, b.saveState()).config.difficulty.id, 'aggressive');
});

test('an incapacitated identity contributes neither movement nor capture and rematerializes with its existing allied group', () => {
  const source = config({ reserve: false, alliedAt: 'b' }), simulation = new BattleSimulation(source, { spawnGroup: () => true, despawnGroup: () => [] });
  const wounded = simulation.getUnit('ally-0'); simulation.syncUnit(wounded.id, { hp: 1 }); simulation.setUnitIncapacitated(wounded.id, true);
  assert.equal(simulation.delegateFront('ally', 'a').reason, 'living_officer_required');
  const before = simulation.getUnit(wounded.id).position;
  simulation.issueOrder('ally', { type: 'attack', frontId: 'c' }); advance(simulation, 5);
  assert.deepEqual(simulation.getUnit(wounded.id).position, before); assert.notDeepEqual(simulation.getGroup('ally').position, before);
  simulation.update(.25, { players: [{ id: 'p1', hp: 100, position: before }] });
  assert.equal(simulation.getUnit(wounded.id).state, 'active'); assert.ok(simulation.getCounts().clan.active <= 32);
  const restored = BattleSimulation.fromState(source, simulation.saveState(), { spawnGroup: () => true, despawnGroup: () => [] });
  restored.update(.25, { players: [{ id: 'p1', hp: 100, position: before }] }); assert.equal(restored.getUnit(wounded.id).state, 'active');
  assert.equal(restored.getUnit(wounded.id).incapacitated, true); assert.equal(restored.getUnit(wounded.id).hp, 1);
  assert.equal(restored.getActorDirectives().find(unit => unit.id === wounded.id).canAttack, false);
  const captureSource = config({ reserve: false }); captureSource.fronts[0].owner = null;
  const capture = new BattleSimulation(captureSource); for (const unit of capture.getGroupUnits('ally')) capture.setUnitIncapacitated(unit.id, true);
  advance(capture, 20); assert.equal(capture.getFront('a').owner, null);
  capture.setUnitIncapacitated('ally-0', false); advance(capture, 10); assert.equal(capture.getFront('a').owner, 'clan');
});

test('hive controller loss has persistent mechanical coordination consequences without human fear', () => {
  const configuration = config({ reserve: false, combat: true }); configuration.groups[0].frontId = 'c'; configuration.groups[0].position = [1030, 1000];
  const simulation = new BattleSimulation(configuration); simulation.recordDeath({ entityId: 'third-0', killerFaction: 'clan' });
  assert.equal(simulation.getGroup('third').coordinationStrength, .65); assert.equal(simulation.getGroup('third').coordinated, false);
  assert.equal(simulation.getGroup('third').morale, 70); assert.notEqual(simulation.getGroup('third').order.type, 'retreat');
  advance(simulation, 4); const restored = BattleSimulation.fromState(configuration, simulation.saveState());
  assert.equal(restored.getGroup('third').coordinationStrength, .65);
  const forged = simulation.saveState(); forged.groups.find(group => group.id === 'third').coordinationStrength = 1;
  assert.throws(() => BattleSimulation.fromState(configuration, forged), /coordination/);
});
