import test from 'node:test';
import assert from 'node:assert/strict';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';
import { createBattlefieldOperation, bindBattleOperationToLayout } from '../js/battlefield/BattlefieldOperation.js';
import { createBattlefieldLayout } from '../js/data/BattlefieldLayouts.js';
import { BATTLE_OPERATIONS, getBattleOperationConfig } from '../js/data/BattleCatalog.js';
import { BATTLEFIELD_MAP_VARIANTS } from '../js/data/BattlefieldMapVariants.js';

const copy = value => JSON.parse(JSON.stringify(value));
function fixture({ reserves = false, combat = false, objectives = {}, cap = 8 } = {}) {
  const fronts = [{ id: 'a', label: 'Landing', position: [0, 0], radius: 45, owner: 'clan', reinforcementSource: true, captureThreshold: 10 },
    { id: 'b', label: 'Relay', position: [100, 0], radius: 45, owner: 'human', reinforcementSource: true, captureThreshold: 10 },
    { id: 'c', label: 'Hive', position: [100, 100], radius: 45, owner: 'hive', reinforcementSource: true, captureThreshold: 10 }];
  const groups = [];
  function group(name, factionId, frontId, state = 'distant') {
    const front = fronts.find(front => front.id === frontId), center = [front.position[0] + 30, front.position[1]];
    groups.push({ id: name, factionId, frontId, position: center, state, units: Array.from({ length: 4 }, (_, index) => ({ id: `${name}-${index}`, profileId: `${factionId}-line`, officer: index === 0, position: [center[0], center[1] + index] })) });
  }
  group('ally', 'clan', combat ? 'b' : 'a'); group('enemy', 'human', 'b'); group('third', 'hive', 'c');
  if (reserves) { group('ally-reserve', 'clan', 'a', 'reserve'); group('enemy-reserve', 'human', 'b', 'reserve'); group('third-reserve', 'hive', 'c', 'reserve'); }
  return { id: 'operation-test', mode: 'original', context: { era: 'alternative', works: ['original'], continuities: ['original'] }, playerFaction: 'clan',
    factions: [{ id: 'clan', species: 'yautja' }, { id: 'human', species: 'human' }, { id: 'hive', species: 'xenomorph' }],
    relations: [{ a: 'clan', b: 'human', state: 'hostile' }, { a: 'clan', b: 'hive', state: 'hostile' }, { a: 'human', b: 'hive', state: 'hostile' }],
    fronts, routes: [{ id: 'ab', from: 'a', to: 'b', travelSeconds: 10 }, { id: 'bc', from: 'b', to: 'c', travelSeconds: 10 },
      { id: 'ac', from: 'a', to: 'c', travelSeconds: 20, waypoints: [[0, 0], [0, 100], [100, 100]] }],
    profiles: [{ id: 'clan-line', species: 'yautja', maxHp: 100, damage: combat ? 5 : 0, attackInterval: 2 },
      { id: 'human-line', species: 'human', maxHp: 100, damage: combat ? 5 : 0, attackInterval: 2 }, { id: 'hive-line', species: 'xenomorph', maxHp: 100, damage: 0, attackInterval: 2 }],
    groups, budgets: { active: cap, byFaction: Object.fromEntries(['clan', 'human', 'hive'].map(factionId => [factionId, { active: 4, reserve: reserves ? 4 : 0, total: reserves ? 8 : 4 }])), spawnDistance: 24, spawnInterval: 8, announcementSeconds: 3, arrivalsPerTick: 4 },
    objectives, ai: { enabled: false } };
}
const sumHP = (simulation, faction) => [...simulation.units.values()].filter(unit => unit.factionId === faction).reduce((sum, unit) => sum + unit.hp, 0);
function advance(simulation, seconds, options = {}, fps = 4) { for (let frame = 0; frame < Math.round(seconds * fps); frame++) simulation.update(1 / fps, options); }

test('all 27 catalogue operations allocate finite identities, preserve faction budgets and bind to real level corridors', () => {
  const layout = createBattlefieldLayout({ id: 'forest', environmentType: 'forest' });
  for (const operation of BATTLE_OPERATIONS) {
    const source = getBattleOperationConfig(operation.id, { allowHumanController: true });
    const original = JSON.stringify(source), configuration = bindBattleOperationToLayout(source, layout);
    const simulation = new BattleSimulation(configuration);
    assert.equal(simulation.assertConservation(), true);
    for (const [factionId, counts] of Object.entries(simulation.getCounts())) {
      assert.equal(counts.allocated, source.budgets.byFaction[factionId].total, operation.id);
      assert.equal(counts.reserve, source.budgets.byFaction[factionId].reserve, operation.id);
      assert.equal(counts.active, 0);
    }
    assert.equal(JSON.stringify(source), original, 'scene binding never rewrites the audit proposal');
    assert.equal(configuration.sceneBinding.originalGeographicProposalConstructed, false);
    for (const route of configuration.routes) {
      assert.deepEqual(route.waypoints[0], simulation.fronts.get(route.from).position);
      assert.deepEqual(route.waypoints.at(-1), simulation.fronts.get(route.to).position);
      for (let index = 1; index < route.waypoints.length; index++) assert.ok(route.waypoints[index][0] === route.waypoints[index - 1][0] || route.waypoints[index][1] === route.waypoints[index - 1][1], 'no invented diagonal shortcut through walls');
    }
    simulation.dispose();
  }
});

test('three-front built-level factory uses 132 declared NPCs and rejects fake film reconstruction', () => {
  const layout = createBattlefieldLayout({ id: 'val_verde', environmentType: 'jungle' });
  const config = createBattlefieldOperation(layout, { levelId: 'val_verde' }), simulation = new BattleSimulation(config);
  assert.equal(simulation.units.size, 132); assert.equal(simulation.fronts.size, 3);
  assert.equal(simulation.getCounts().player_clan.allocated, 20); assert.equal(simulation.getCounts().hive.allocated, 64); assert.equal(simulation.getCounts().human_force.allocated, 48);
  for (const faction of Object.values(config.budgets.byFaction)) assert.equal(faction.active + faction.distant + faction.reserve, faction.total);
  assert.throws(() => createBattlefieldOperation(layout, { mode: 'reconstruction' }), /not a verified film reconstruction/);
  const before = [...simulation.units.keys()]; advance(simulation, 1200);
  assert.deepEqual([...simulation.units.keys()], before); assert.equal(simulation.assertConservation(), true);
  assert.ok(simulation.events.length <= 512);
});

test('all 34 built map variants provide navigable polyline routes and preserve their physical anchors', () => {
  for (const variant of BATTLEFIELD_MAP_VARIANTS) {
    const layout = createBattlefieldLayout({ id: variant.baseLevelId, mapId: variant.id, strategicMode: true });
    const configuration = createBattlefieldOperation(layout, { levelId: variant.id }), simulation = new BattleSimulation(configuration);
    const rectangles = [...layout.sectors, ...layout.corridors].map(item => item.bounds);
    const walkable = point => rectangles.some(bounds => point[0] >= bounds.minX - 1e-6 && point[0] <= bounds.maxX + 1e-6 && point[1] >= bounds.minZ - 1e-6 && point[1] <= bounds.maxZ + 1e-6);
    for (const route of configuration.routes) for (let edge = 1; edge < route.waypoints.length; edge++) {
      const from = route.waypoints[edge - 1], to = route.waypoints[edge];
      const samples = Math.max(1, Math.ceil(Math.hypot(to[0] - from[0], to[1] - from[1]) / 8));
      for (let sample = 0; sample <= samples; sample++) {
        const point = [from[0] + (to[0] - from[0]) * sample / samples, from[1] + (to[1] - from[1]) * sample / samples];
        assert.ok(walkable(point), `${variant.id} ${route.id}: physical route is outside the built floor`);
      }
    }
    for (const group of simulation.groups.values()) assert.ok(walkable(group.position), `${variant.id} deployment position`);
    assert.equal(simulation.assertConservation(), true);
  }
});

test('detail transitions preserve the exact wounded units and never count a despawn as a death', () => {
  const spawned = [], despawned = [], config = fixture();
  const simulation = new BattleSimulation(config, { spawnGroup(group, units) { spawned.push({ group: group.id, units: units.map(unit => unit.id) }); },
    despawnGroup(group, units) { despawned.push(group.id); return units.map(unit => ({ id: unit.id, hp: unit.id === 'ally-1' ? 37 : unit.hp, position: unit.position })); } });
  simulation.update(.25, { players: [{ id: 'p1', hp: 100, position: [0, 0] }] });
  assert.equal(simulation.getUnit('ally-1').state, 'active'); assert.equal(spawned.length, 1);
  simulation.update(.25, { players: [{ id: 'p1', hp: 100, position: [100, 100] }] });
  assert.equal(simulation.getUnit('ally-1').state, 'distant'); assert.equal(simulation.getUnit('ally-1').hp, 37); assert.deepEqual(despawned, ['ally']);
  assert.equal(simulation.deaths.size, 0);
  simulation.update(.25, { players: [{ id: 'p1', hp: 100, position: [0, 0] }] });
  assert.equal(simulation.getUnit('ally-1').state, 'active'); assert.equal(simulation.getUnit('ally-1').hp, 37);
  assert.equal(spawned.filter(group => group.group === 'ally').length, 2); assert.equal(simulation.units.size, 12);
  simulation.dispose(); assert.equal(simulation.update(10), false); assert.equal(simulation.deaths.size, 0);
});

test('a missing live actor releases detail without inventing a death or replacing its wounded identity', () => {
  const simulation = new BattleSimulation(fixture(), { spawnGroup() { return true; }, despawnGroup() { return []; } });
  const options = { players: [{ id: 'p1', hp: 100, position: [0, 0] }] };
  simulation.update(.25, options); simulation.syncUnit('ally-1', { hp: 25 });
  assert.equal(simulation.releaseGroupDetail('ally', 'manager_removed_living_actor'), true);
  assert.equal(simulation.getUnit('ally-1').state, 'distant'); assert.equal(simulation.getUnit('ally-1').hp, 25);
  assert.equal(simulation.deaths.size, 0); simulation.update(.25, options); assert.equal(simulation.getCounts().clan.active, 0);
  advance(simulation, 3, options); assert.equal(simulation.getCounts().clan.active, 4); assert.equal(simulation.getUnit('ally-1').hp, 25);
  assert.equal(simulation.units.size, 12); assert.equal(simulation.assertConservation(), true);
});

test('both living co-op fronts share a global budget and new detailed units stay outside both players', () => {
  const config = fixture(), simulation = new BattleSimulation(config), players = [{ id: 'p1', hp: 100, position: [100, 0] }, { id: 'p2', hp: 100, position: [100, 100] }];
  simulation.update(.25, { players });
  assert.equal(simulation.getCounts().human.active, 4); assert.equal(simulation.getCounts().hive.active, 4);
  for (const unit of simulation.getActiveUnits()) for (const player of players) assert.ok(Math.hypot(unit.position[0] - player.position[0], unit.position[1] - player.position[1]) >= 24);
  assert.equal(simulation.assertConservation(), true);
  const near = fixture(); near.groups[1].units.forEach(unit => { unit.position = [101, 0]; });
  const deferred = new BattleSimulation(near); deferred.update(.25, { players: players.slice(0, 1) }); assert.equal(deferred.getCounts().human.active, 0);
});

test('distant battles inflict reciprocal losses without requiring a nearby player and a truce is persistent', () => {
  const simulation = new BattleSimulation(fixture({ combat: true })); advance(simulation, 20);
  assert.ok(sumHP(simulation, 'clan') < 400); assert.ok(sumHP(simulation, 'human') < 400);
  const after = [sumHP(simulation, 'clan'), sumHP(simulation, 'human')];
  simulation.setRelationship('clan', 'human', 'allied', 'negotiated_truce'); advance(simulation, 20);
  assert.deepEqual([sumHP(simulation, 'clan'), sumHP(simulation, 'human')], after);
  assert.equal(simulation.relationship('clan', 'human'), 'allied'); assert.equal(simulation.result, null);
});

test('distant combat never deals a second invisible hit to materialized units', () => {
  const config = fixture({ combat: true }), simulation = new BattleSimulation(config, { spawnGroup() {} });
  advance(simulation, 20, { players: [{ id: 'p1', hp: 100, position: [100, 0] }] });
  assert.equal(sumHP(simulation, 'clan'), 400); assert.equal(sumHP(simulation, 'human'), 400);
  assert.equal(simulation.getCounts().clan.active, 4); assert.equal(simulation.getCounts().human.active, 4);
});

test('a death from any source produces one loss and one officer consequence, including delayed duplicate callbacks', () => {
  const simulation = new BattleSimulation(fixture()), count = simulation.units.size;
  assert.equal(simulation.recordDeath({ entityId: 'enemy-0', killerFaction: 'clan', cause: 'trap' }), true);
  assert.equal(simulation.recordDeath({ entityId: 'enemy-0', killerFaction: 'clan', cause: 'execution' }), false);
  assert.equal(simulation.recordDeath({ entityId: 'unknown', cause: 'despawn' }), false);
  assert.equal(simulation.getCounts().human.dead, 1); assert.equal(simulation.deaths.size, 1);
  assert.equal(simulation.events.filter(event => event.type === 'unit_died').length, 1);
  assert.equal(simulation.getGroup('enemy').morale, 45); assert.equal(simulation.units.size, count);
  assert.equal(simulation.assertConservation(), true);
});

test('finite reserves are announced before arrival and sabotage cancels an inbound group without inventing kills', () => {
  const simulation = new BattleSimulation(fixture({ reserves: true }));
  assert.equal(simulation.requestReinforcements('clan', 'a').accepted, true); assert.equal(simulation.getCounts().clan.reserve, 4);
  advance(simulation, 2); assert.equal(simulation.getCounts().clan.reserve, 4);
  simulation.damageSource('a', 1000); advance(simulation, 2);
  assert.equal(simulation.getCounts().clan.reserve, 4); assert.equal(simulation.deaths.size, 0);
  assert.equal(simulation.requestReinforcements('clan', 'a').reason, 'no_connected_supply_source');
  assert.ok(simulation.events.some(event => event.type === 'reinforcements_cancelled'));
  const finite = new BattleSimulation(fixture({ reserves: true })); advance(finite, 1200);
  assert.equal(finite.units.size, 24); assert.equal(finite.getCounts().clan.reserve, 0); assert.equal(finite.assertConservation(), true);
});

test('a captured forward base cannot teleport a reserve around a severed supply line', () => {
  const simulation = new BattleSimulation(fixture({ reserves: true })); simulation.captureBase('b', 'clan');
  simulation.setRouteOpen('ab', false); simulation.setRouteOpen('ac', false);
  assert.equal(simulation.requestReinforcements('clan', 'b', 'ally-reserve').reason, 'no_connected_supply_source');
  assert.equal(simulation.getCounts().clan.reserve, 4);
  simulation.setRouteOpen('ab', true);
  const response = simulation.requestReinforcements('clan', 'b', 'ally-reserve'); assert.equal(response.accepted, true); assert.equal(response.sourceId, 'a');
  advance(simulation, 3); assert.equal(simulation.getGroup('ally-reserve').frontId, 'a'); assert.deepEqual(simulation.getGroup('ally-reserve').position, [30, 0]);
  advance(simulation, 13); assert.equal(simulation.getGroup('ally-reserve').frontId, 'b'); assert.equal(simulation.assertConservation(), true);
});

test('an eight-unit reserve respects the per-arrival limit and a route loss cancels the same identities intact', () => {
  const config = fixture({ reserves: true }), group = config.groups.find(group => group.id === 'ally-reserve');
  for (let index = 4; index < 8; index++) group.units.push({ id: `ally-reserve-${index}`, profileId: 'clan-line', position: [30, index] });
  config.budgets.byFaction.clan.total = 12; config.budgets.byFaction.clan.reserve = 8;
  const tooSmall = new BattleSimulation(config);
  assert.equal(tooSmall.requestReinforcements('clan', 'b', group.id).reason, 'arrival_group_exceeds_budget');
  assert.equal(tooSmall.getCounts().clan.reserve, 8); assert.equal(tooSmall.pendingArrivals.length, 0);
  config.budgets.arrivalsPerTick = 8;
  const sim = new BattleSimulation(config), identities = [...sim.units.keys()];
  assert.equal(sim.requestReinforcements('clan', 'b', group.id).accepted, true);
  sim.setRouteOpen('ab', false); sim.setRouteOpen('ac', false); advance(sim, 3);
  assert.equal(sim.getCounts().clan.reserve, 8); assert.equal(sim.pendingArrivals.length, 0);
  assert.ok(sim.events.some(event => event.type === 'reinforcements_cancelled' && event.groupId === group.id));
  assert.deepEqual([...sim.units.keys()], identities); assert.equal(sim.deaths.size, 0); assert.equal(sim.assertConservation(), true);
});

test('closing a route before departure uses the real alternate polyline; closing mid-route never teleports a group', () => {
  const config = fixture(); config.groups[0].position = [0, 0]; config.groups[0].units.forEach(unit => { unit.position = [0, 0]; });
  const alternate = new BattleSimulation(config); alternate.setRouteOpen('ab', false);
  assert.equal(alternate.issueOrder('ally', { type: 'attack', frontId: 'b' }).accepted, true);
  assert.deepEqual(alternate.getGroup('ally').path.map(segment => segment.routeId), ['ac', 'bc']);
  advance(alternate, 5); assert.deepEqual(alternate.getGroup('ally').position, [0, 50]);
  const blocked = new BattleSimulation(config); blocked.issueOrder('ally', { type: 'attack', frontId: 'b' }); advance(blocked, 6);
  const mid = blocked.getGroup('ally').position; assert.deepEqual(mid, [60, 0]); blocked.setRouteOpen('ab', false); advance(blocked, 20);
  assert.deepEqual(blocked.getGroup('ally').position, mid); assert.equal(blocked.issueOrder('ally', { type: 'attack', frontId: 'c' }).reason, 'route_closed_in_transit');
  blocked.setRouteOpen('ab', true); advance(blocked, 4); assert.deepEqual(blocked.getGroup('ally').position, [100, 0]);
});

test('capture changes a real source; strategic defeat has a rescue window and a readable cause', () => {
  const config = fixture({ objectives: { loseFronts: ['a'], defeatGraceSeconds: 10 } }), simulation = new BattleSimulation(config);
  simulation.captureBase('a', 'human'); simulation.update(.25); assert.equal(simulation.result, null);
  advance(simulation, 5); simulation.captureBase('a', 'clan'); simulation.update(.25); assert.equal(simulation.getHUDState().criticalDeadline, null);
  for (const unitId of ['ally-0', 'ally-1', 'ally-2', 'ally-3']) simulation.recordDeath({ entityId: unitId });
  simulation.captureBase('a', 'human'); advance(simulation, 11); assert.equal(simulation.result.outcome, 'defeat'); assert.equal(simulation.result.reason, 'critical_front_lost');
  const before = simulation.deaths.size; assert.equal(simulation.recordDeath({ entityId: 'ally-0', cause: 'late_callback' }), false); assert.equal(simulation.deaths.size, before);
});

test('alternative strategies finish once and unused reserve survivors are never credited as kills', () => {
  const config = fixture({ reserves: true, objectives: { strategies: [{ id: 'sabotage', conditions: [{ type: 'source_disabled', frontId: 'b' }, { type: 'source_disabled', frontId: 'c' }] }] } });
  const simulation = new BattleSimulation(config); simulation.damageSource('b', 1000); simulation.damageSource('c', 1000); simulation.update(.25);
  assert.equal(simulation.result.strategyId, 'sabotage'); assert.equal(simulation.result.outcome, 'victory'); assert.equal(simulation.deaths.size, 0);
  assert.equal(simulation.getCounts().human.reserve, 4); assert.equal(simulation.events.filter(event => event.type === 'operation_finished').length, 1);
});

test('narrative operations keep strategic defeat but require their external objective controller to grant victory', () => {
  const configuration = fixture({ objectives: { externalVictory: true, captureFronts: ['b', 'c'], loseFronts: ['a'], defeatGraceSeconds: 10 } });
  const simulation = new BattleSimulation(configuration);
  simulation.captureBase('b', 'clan'); simulation.captureBase('c', 'clan'); simulation.update(.25);
  assert.equal(simulation.getResult(), null, 'generic control cannot bypass archive/convoi/extraction conditions');
  assert.equal(simulation.finishOperation({ outcome: 'victory', reason: 'archive_extracted', time: 9999 }), true);
  assert.equal(simulation.getResult().time, .25, 'the simulation clock is authoritative');
  assert.equal(simulation.finishOperation({ outcome: 'victory', reason: 'duplicate' }), false);
  const ordinary = new BattleSimulation(fixture()); assert.equal(ordinary.finishOperation({ outcome: 'victory', reason: 'bypass' }), false);
});

test('an unavailable actor pool is retried with a bounded cadence and cannot consume or kill reserve identities', () => {
  let attempts = 0;
  const simulation = new BattleSimulation(fixture(), { spawnGroup() { attempts++; if (attempts === 1) throw Error('pool unavailable'); return true; } });
  const options = { players: [{ id: 'p1', hp: 100, position: [0, 0] }] };
  simulation.update(.25, options); advance(simulation, 2, options);
  assert.equal(attempts, 1); assert.equal(simulation.getCounts().clan.active, 0); assert.equal(simulation.units.size, 12);
  advance(simulation, 1.25, options); assert.equal(attempts, 2); assert.equal(simulation.getCounts().clan.active, 4); assert.equal(simulation.deaths.size, 0);
  assert.equal(simulation.events.filter(event => event.type === 'materialization_unavailable').length, 1);
});

test('a 952-agent three-species operation advances all three fronts for 20 simulated minutes within fixed identity/event budgets', () => {
  const source = getBattleOperationConfig('AFF-27'); source.objectives = {}; source.ai = { enabled: false };
  for (const profile of source.profiles) { profile.maxHp = 100000; profile.damage = 1; profile.attackInterval = 5; }
  const simulation = new BattleSimulation(source), identities = [...simulation.units.keys()];
  advance(simulation, 1200);
  assert.equal(simulation.time, 1200); assert.equal(simulation.units.size, 952); assert.equal(simulation.assertConservation(), true);
  assert.deepEqual([...simulation.units.keys()], identities);
  const damagedFactions = new Set([...simulation.units.values()].filter(unit => unit.damageTaken > 0).map(unit => unit.factionId));
  assert.ok(damagedFactions.size >= 2, 'the battle inflicts reciprocal faction damage without the player');
  assert.ok(simulation.events.length <= 512); assert.ok(simulation.deaths.size <= 952);
  for (const value of Object.values(simulation.getCounts())) assert.equal(value.active + value.distant + value.reserve + value.dead + value.evacuated + value.captured, value.allocated);
});

test('officers can receive delegated orders, simultaneous co-op orders replace once, and tactics reposition separate flanks', () => {
  const config = fixture(), extra = copy(config.groups[0]); extra.id = 'ally2'; extra.units.forEach(unit => { unit.id = unit.id.replace('ally', 'ally2'); }); config.groups.push(extra); config.budgets.byFaction.clan.total += 4;
  const simulation = new BattleSimulation(config);
  assert.equal(simulation.delegateFront('ally', 'b').accepted, true); assert.equal(simulation.getGroup('ally').delegated, true);
  simulation.issueOrder('ally', { type: 'attack', frontId: 'b', issuer: 'p1' }); simulation.issueOrder('ally', { type: 'defend', frontId: 'c', issuer: 'p2' });
  assert.equal(simulation.getGroup('ally').order.issuer, 'p2'); assert.equal(simulation.getGroup('ally').order.frontId, 'c');
  const response = simulation.issueTactic(['ally', 'ally2'], { type: 'pincer', frontId: 'a' }); assert.equal(response.accepted, true);
  assert.equal(simulation.getGroup('ally').targetPosition[0], 12); assert.equal(simulation.getGroup('ally2').targetPosition[0], -12);
  assert.equal(simulation.issueTactic(['ally', 'ally2'], { type: 'pincer', frontId: 'a' }).reason, 'tactic_cooling_down');
  simulation.recordDeath({ entityId: 'ally-0' }); assert.equal(simulation.delegateFront('ally', 'b').reason, 'living_officer_required');
});

test('hive source disruption changes coordination without human fear or an automatic retreat', () => {
  const simulation = new BattleSimulation(fixture()); simulation.recordDeath({ entityId: 'third-0', cause: 'officer' });
  assert.equal(simulation.getGroup('third').moraleLabel, 'Pression de ruche'); assert.equal(simulation.getGroup('third').morale, 70);
  simulation.damageSource('c', 1000); advance(simulation, 20);
  assert.equal(simulation.getGroup('third').coordinated, false); assert.equal(simulation.getGroup('third').morale, 45); assert.notEqual(simulation.getGroup('third').order.type, 'retreat');
});

test('20 minutes of the same deterministic battle agree at 30, 60 and 120 FPS; pause and dispose stop all clocks', () => {
  const configuration = fixture({ combat: true, reserves: true });
  const simulations = [30, 60, 120].map(fps => { const simulation = new BattleSimulation(configuration); advance(simulation, 1200, {}, fps); return simulation; });
  const normalized = simulation => { const saved = simulation.saveState(); saved.accumulator = 0; return saved; };
  assert.deepEqual(normalized(simulations[0]), normalized(simulations[1])); assert.deepEqual(normalized(simulations[1]), normalized(simulations[2]));
  for (const simulation of simulations) {
    assert.equal(simulation.time, 1200); assert.equal(simulation.assertConservation(), true);
    const before = JSON.stringify(simulation.saveState()); simulation.update(60, { paused: true }); assert.equal(JSON.stringify(simulation.saveState()), before);
    simulation.dispose(); const after = JSON.stringify(simulation.saveState()); simulation.update(60); assert.equal(JSON.stringify(simulation.saveState()), after);
  }
});

test('save/reload keeps wounded identities, causal losses, orders, diplomacy and clocks without respawning named dead officers', () => {
  const config = fixture({ combat: true, reserves: true }); config.groups[1].units[0].uniqueId = 'named-officer';
  const simulation = new BattleSimulation(config); advance(simulation, 7); simulation.recordDeath({ entityId: 'enemy-0', cause: 'trap' }); simulation.setRelationship('human', 'hive', 'allied', 'temporary_truce');
  simulation.issueOrder('ally', { type: 'defend', frontId: 'c' }); const state = simulation.saveState(), restored = BattleSimulation.fromState(config, state);
  assert.deepEqual(restored.saveState(), state); assert.equal(restored.getUnit('enemy-0').state, 'dead'); assert.equal(restored.relationship('human', 'hive'), 'allied');
  advance(simulation, 30); advance(restored, 30); assert.deepEqual(restored.saveState(), simulation.saveState());
  const next = new BattleSimulation(config, { history: simulation.getCampaignConsequences() });
  assert.equal(next.getUnit('enemy-0').state, 'dead'); assert.equal(next.getHUDState().casualties, 0); assert.equal(next.getHUDState().inheritedLosses, 1);
  const earlier = new BattleSimulation(config).saveState();
  assert.throws(() => BattleSimulation.fromState(config, earlier, { history: simulation.getCampaignConsequences() }), /would revive/);
  const captive = new BattleSimulation(config, { history: { capturedUniqueIds: ['named-officer'] } }); assert.equal(captive.getUnit('enemy-0').state, 'captured');
  assert.throws(() => BattleSimulation.fromState(config, earlier, { history: { capturedUniqueIds: ['named-officer'] } }), /silently release/);
});

test('context, unique identities, profiles and malformed saved states fail closed before world spawning', () => {
  const config = fixture(), mutate = change => { const candidate = copy(config); change(candidate); return () => new BattleSimulation(candidate); };
  assert.throws(mutate(c => { c.groups[0].units[0].uniqueId = 'same'; c.groups[1].units[0].uniqueId = 'same'; }), /cannot be duplicated/);
  assert.throws(mutate(c => { c.profiles[0].excludedFromSpawn = true; }), /excluded from spawning/);
  assert.throws(mutate(c => { c.profiles[0].allowedEras = ['1719']; c.context.era = '2179'; }), /anachronistic/);
  assert.throws(mutate(c => { c.profiles[0].allowedWorks = ['Prey']; }), /outside the operation/);
  assert.throws(mutate(c => { c.mode = 'reconstruction'; }), /adaptation/);
  assert.throws(mutate(c => { c.relations.pop(); }), /every faction pair/);
  assert.throws(mutate(c => { c.groups[0].units.push(copy(c.groups[0].units[0])); }), /unique/);
  const simulation = new BattleSimulation(config), state = simulation.saveState();
  const corrupt = change => { const saved = copy(state); change(saved); return () => BattleSimulation.fromState(config, saved); };
  assert.throws(corrupt(s => { s.units[0].hp = NaN; }), /invalid saved unit/);
  assert.throws(corrupt(s => { s.units[0].factionId = 'human'; }), /rewrites an allocated identity/);
  assert.throws(corrupt(s => { s.units[0].state = 'dead'; s.units[0].hp = 0; }), /reconcile/);
  assert.throws(corrupt(s => { s.units.push(copy(s.units[0])); }), /identities/);
  assert.throws(corrupt(s => { s.configDigest = 'different'; }), /does not match/);
  assert.throws(corrupt(s => { s.routes[0].waypoints = [[0, 0], [999, 999]]; }), /built navigation route/);
  assert.throws(corrupt(s => { s.routes[0].travelSeconds = .001; }), /built navigation route/);
  assert.throws(corrupt(s => { s.fronts[0].radius = 9999; }), /built front geometry/);
  assert.throws(corrupt(s => { s.relations[1] = copy(s.relations[0]); }), /faction relationships/);
  assert.throws(corrupt(s => { s.groups[0].officerId = 'enemy-0'; }), /invalid saved group/);
  const crossover = copy(config); crossover.mode = 'crossover'; crossover.context.era = '2179'; crossover.profiles[0].allowedEras = ['1719']; assert.doesNotThrow(() => new BattleSimulation(crossover));
});
