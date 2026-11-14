import test from 'node:test';
import assert from 'node:assert/strict';
import { BATTLE_OPERATIONS, getBattleOperationConfig } from '../js/data/BattleCatalog.js';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';
import { OperationObjectives, bindOperationObjectivesToFronts } from '../js/battlefield/OperationObjectives.js';
import { operationRoutePoints } from '../js/battlefield/OperationObjectiveSpecs.js';
import { bindBattleOperationToLayout } from '../js/battlefield/BattlefieldOperation.js';
import { createBattlefieldLayout } from '../js/data/BattlefieldLayouts.js';

function fixture(id = 'AFF-01', options = {}) {
  const config = getBattleOperationConfig(id, { allowHumanController: true, ...options });
  const events = [], simulation = new BattleSimulation(config), controller = new OperationObjectives(config, simulation, { onEvent: event => events.push(event) });
  const player = { id: 'player1', hp: 1000, position: [0, 0] };
  return { config, simulation, controller, player, events,
    tick(seconds, actors = [player]) { while (seconds > 1e-8) { const delta = Math.min(.25, seconds); controller.update(delta, actors); seconds -= delta; } },
    task(id) { return controller.getHUDState().tasks.find(task => task.id === id); },
    use(id, actor = player) {
      actor.position = [...controller.getHUDState().tasks.find(task => task.id === id).position];
      controller.update(.01, [actor]); const result = controller.interact(actor);
      if (result.accepted) { let remaining = controller.getHUDState().tasks.find(task => task.id === id).duration; while (remaining > 1e-8) { const delta = Math.min(.25, remaining); controller.update(delta, [actor]); remaining -= delta; } }
      return result;
    },
    dispose() { controller.dispose(); simulation.dispose(); } };
}

test('all 27 scenarios execute distinct physical narrative strategies instead of winning by generic front capture', () => {
  const signatures = new Set();
  for (const operation of BATTLE_OPERATIONS) {
    const current = fixture(operation.id);
    try {
      for (const front of current.config.fronts) current.simulation.captureBase(front.id, current.config.playerFaction);
      assert.equal(current.simulation.getResult(), null, 'capturing the generic route cannot finish a narrative operation');
      signatures.add(current.config.operationObjectives.tasks.map(task => task.type + ':' + task.id).join('|'));
      for (const spec of current.config.operationObjectives.tasks) {
        if (current.controller.getResult()) break;
        const task = current.task(spec.id);
        if (!task.available) continue; // A killed negotiator leaves the duel/extraction strategy.
        if (task.type === 'eliminate') {
          const unit = current.config.groups.flatMap(group => group.units).find(unit => unit.uniqueId === spec.uniqueId);
          assert.ok(unit, `${operation.id}/${task.id}: named target must exist within the allocated force`);
          current.simulation.recordDeath({ entityId: unit.id, killerFaction: current.config.playerFaction }); current.tick(.25);
        } else if (task.type === 'defend') current.tick(task.duration + .25);
        else if (task.type === 'capture') current.tick(.25);
        else {
          if (task.type === 'extract') {
            // Walk the leader slowly enough for the real freed group to follow.
            const target = task.position, length = Math.hypot(target[0] - current.player.position[0], target[1] - current.player.position[1]);
            const start = [...current.player.position], steps = Math.ceil(length / 4);
            for (let step = 1; step <= steps; step++) { current.player.position = start.map((value, axis) => value + (target[axis] - value) * step / steps); current.tick(1); }
            current.tick(3);
            for (let waited = 0; waited < 180 && current.controller.getWorldEntities().some(entity => entity.state === 'rescued' && Math.hypot(entity.position[0] - target[0], entity.position[1] - target[1]) > task.radius + 4); waited++) current.tick(1);
          }
          const response = current.use(task.id);
          assert.equal(response.accepted, true, `${operation.id}/${task.id}: ${response.feedback}`);
        }
      }
      assert.equal(current.controller.getResult()?.outcome, 'victory', operation.id);
      assert.equal(current.simulation.getResult()?.outcome, 'victory', operation.id);
      assert.equal(current.simulation.assertConservation(), true);
      assert.ok(current.controller.getHUDState().tasks.some(task => task.status === 'done' && !['capture', 'eliminate'].includes(task.type)));
    } finally { current.dispose(); }
  }
  assert.equal(signatures.size, 27);
});

test('E channels require proximity and prerequisites, cancel on damage/movement and freeze during pause', () => {
  const current = fixture();
  try {
    assert.equal(current.controller.interact(current.player).accepted, false);
    current.player.position = [...current.task('depart').position];
    assert.equal(current.controller.interact(current.player).accepted, false, 'no extraction before picking up the archive');
    current.player.position = [...current.task('register').position]; assert.equal(current.controller.interact(current.player).accepted, true);
    current.tick(1); const progress = current.task('register').progress;
    current.controller.update(20, [current.player], { paused: true }); assert.equal(current.task('register').progress, progress);
    assert.equal(current.controller.interact(current.player).accepted, false);
    current.controller.update(.1, [current.player], { paused: false }); current.player.hp -= 1; current.tick(.1);
    assert.equal(current.controller.getHUDState().channels.length, 0); assert.equal(current.task('register').progress, 0);
    assert.equal(current.controller.interact(current.player).accepted, true); current.player.position[0] += 10; current.tick(.1);
    assert.equal(current.task('register').status, 'pending'); assert.equal(current.controller.getHUDState().channels.length, 0);
  } finally { current.dispose(); }
});

test('cooperative cargo drops where its carrier falls and is recovered once without duplicate objective credit', () => {
  const current = fixture(), partner = { id: 'player2', hp: 1000, position: [0, 0] };
  try {
    assert.equal(current.use('register').accepted, true);
    current.player.position = [24, 30]; current.tick(.25); current.player.hp = 0; current.tick(.25, [current.player, partner]);
    const cargo = current.controller.getWorldEntities().find(entity => entity.id === 'register');
    assert.equal(cargo.state, 'world'); assert.deepEqual(cargo.position, [24, 30]); assert.equal(current.task('register').status, 'pending');
    partner.position = [24, 30]; current.controller.update(.01, [partner]); assert.equal(current.controller.interact(partner).accepted, true);
    current.tick(2.5, [partner]); assert.equal(current.task('register').status, 'done');
    assert.equal(current.events.filter(event => event.type === 'item_secured').length, 1);
    assert.equal(current.events.filter(event => event.type === 'item_recovered').length, 1);
    assert.equal(current.events.filter(event => event.type === 'objective_completed' && event.taskId === 'register').length, 1);
  } finally { current.dispose(); }
});

test('sabotage destroys a real reinforcement source and a negotiated truce changes only its declared relationship', () => {
  const current = fixture('AFF-11');
  try {
    assert.ok(current.simulation.getFrontState('front_c').sourceHP > 0);
    assert.equal(current.use('human_array').accepted, true); assert.equal(current.simulation.getFrontState('front_c').sourceHP, 0);
    assert.equal(current.use('archives').accepted, true); assert.equal(current.use('clan_truce').accepted, true);
    assert.equal(current.simulation.relationship('player_clan', 'rival_clan'), 'neutral');
    assert.equal(current.simulation.relationship('player_clan', 'human_force'), 'hostile');
    assert.equal(current.simulation.relationship('rival_clan', 'human_force'), 'hostile');
    assert.equal(current.simulation.assertConservation(), true);
  } finally { current.dispose(); }
});

test('a player-caused counter-offensive is warned, paused, saved and routed from an existing finite group; a truce cancels it', () => {
  const current = fixture();
  try {
    const identities = [...current.simulation.units.keys()]; current.tick(20);
    assert.equal(current.events.filter(event => event.type === 'counteroffensive_announced').length, 0, 'ignoring the archive must not trigger its reaction');
    current.use('register'); const state = current.controller.getHUDState().reactions[0];
    assert.equal(state.status, 'announced'); assert.ok(Math.abs(state.remaining - 12) < 1e-7);
    current.tick(11.75); assert.equal(current.controller.getHUDState().reactions[0].status, 'announced');
    current.controller.update(60, [current.player], { paused: true });
    assert.ok(Math.abs(current.controller.getHUDState().reactions[0].remaining - .25) < 1e-7);
    const saved = current.controller.serialize(), replayEvents = [], restored = new OperationObjectives(current.config, current.simulation, { onEvent: event => replayEvents.push(event) });
    restored.restore(saved); assert.deepEqual(replayEvents, []); restored.update(.25, [current.player]);
    const deployed = restored.getHUDState().reactions[0], group = current.simulation.getGroup(deployed.groupId);
    assert.equal(deployed.status, 'deployed'); assert.equal(group.order.issuer, 'scenario_counteroffensive');
    assert.equal(group.order.frontId, 'front_a'); assert.notEqual(group.frontId, 'front_a'); assert.ok(group.path.length > 0, 'enemy must travel a route, not appear at contact');
    assert.deepEqual([...current.simulation.units.keys()], identities); assert.equal(current.simulation.deaths.size, 0); assert.equal(current.simulation.assertConservation(), true);
    restored.update(30, [current.player]); assert.equal(replayEvents.filter(event => event.type === 'counteroffensive_started').length, 1);
    restored.dispose();
  } finally { current.dispose(); }
  const truce = fixture('AFF-04');
  try {
    assert.equal(truce.use('false_alarm').accepted, true); truce.simulation.setRelationship('player_clan', 'rival_clan', 'neutral', 'test_negotiation'); truce.tick(12);
    assert.equal(truce.controller.getHUDState().reactions[0].status, 'cancelled');
    assert.equal(truce.controller.getHUDState().reactions[0].reason, 'relationship_no_longer_hostile');
    assert.equal(truce.events.filter(event => event.type === 'counteroffensive_started').length, 0);
  } finally { truce.dispose(); }
});

test('convoy follows the built route through its corner, can be stopped physically and causes defeat if it escapes', () => {
  const config = getBattleOperationConfig('AFF-03', { frontPositions: [[0, -80], [0, 0], [60, 60]] });
  config.routes.find(route => route.from === 'front_b' && route.to === 'front_c').waypoints = [[0, 0], [0, 60], [60, 60]];
  const bound = bindOperationObjectivesToFronts(config), sim = new BattleSimulation(bound), controller = new OperationObjectives(bound, sim);
  try {
    const entity = controller.getWorldEntities().find(entity => entity.id === 'freight'); assert.deepEqual(entity.position, [0, 0]);
    controller.update(30, []); const halfway = controller.getWorldEntities().find(entity => entity.id === 'freight');
    assert.equal(halfway.position[0], 0); assert.ok(halfway.position[1] > 0 && halfway.position[1] < 60);
    controller.update(60, []); controller.update(30, []); assert.equal(controller.getResult()?.outcome, 'defeat');
    assert.match(controller.getResult().reason, /convoy_escaped/);
  } finally { controller.dispose(); sim.dispose(); }
  const stopped = fixture('AFF-03');
  try {
    assert.equal(stopped.use('jammer').accepted, true); const before = stopped.controller.getWorldEntities().find(entity => entity.id === 'freight').position;
    stopped.tick(30); assert.deepEqual(stopped.controller.getWorldEntities().find(entity => entity.id === 'freight').position, before);
    assert.equal(stopped.controller.getResult(), null);
  } finally { stopped.dispose(); }
});

test('physical convoy routing joins indirect built corridors, reverses their polylines and rejects disconnected fronts', () => {
  const config = { fronts: [{ id: 'a', position: [0, 0] }, { id: 'b', position: [10, 10] }, { id: 'c', position: [30, 20] }], routes: [
    { id: 'ab', from: 'a', to: 'b', open: true, travelSeconds: 3, waypoints: [[0, 0], [0, 10], [10, 10]] },
    { id: 'cb', from: 'c', to: 'b', open: true, travelSeconds: 3, waypoints: [[30, 20], [30, 10], [10, 10]] },
    { id: 'ac', from: 'a', to: 'c', open: false, travelSeconds: 1, waypoints: [[0, 0], [30, 20]] },
  ] };
  assert.deepEqual(operationRoutePoints(config, 'a', 'c'), [[0, 0], [0, 10], [10, 10], [30, 10], [30, 20]]);
  assert.deepEqual(operationRoutePoints(config, 'c', 'a'), [[30, 20], [30, 10], [10, 10], [0, 10], [0, 0]]);
  config.routes[1].open = false;
  assert.throws(() => operationRoutePoints(config, 'a', 'c'), /No physical operation route/);
});

test('activation terminals open distinct real detour gates while every front remains reachable through the main routes', () => {
  const source = getBattleOperationConfig('AFF-09');
  const layout = createBattlefieldLayout({ id: source.levelId, mapId: source.mapId, strategicMode: true });
  const config = bindOperationObjectivesToFronts(bindBattleOperationToLayout(source, layout));
  const activations = config.operationObjectives.tasks.filter(task => task.opensRoute);
  assert.equal(activations.length, 2);
  assert.equal(new Set(activations.map(task => task.opensRouteId)).size, 2);
  for (const task of activations) {
    assert.equal(task.routeBinding, 'physical_optional_detour');
    assert.ok(task.physicalGateIds.every(id => layout.gates.some(gate => gate.id === id && gate.tactical)));
    assert.equal(config.routes.find(route => route.id === task.opensRouteId).open, false);
    assert.ok(layout.strategicRoutes.some(route => route.id === task.physicalRouteId));
  }
  for (const front of config.fronts) assert.ok(operationRoutePoints(config, config.fronts[0].id, front.id).length);
  const sim = new BattleSimulation(config), events = [], controller = new OperationObjectives(config, sim, { onEvent: event => events.push(event) });
  const player = { id: 'player1', hp: 1000, position: [0, 0] };
  try {
    for (const task of activations) {
      player.position = [...task.position]; controller.update(.01, [player]);
      assert.equal(controller.interact(player).accepted, true); controller.update(task.duration, [player]);
      assert.equal(sim.getHUDState().routes.find(route => route.id === task.opensRouteId).open, true);
      const event = events.find(event => event.type === 'route_opened' && event.taskId === task.id);
      assert.deepEqual(event.physicalGateIds, task.physicalGateIds); assert.equal(event.physicalRouteId, task.physicalRouteId);
    }
  } finally { controller.dispose(); sim.dispose(); }
});

test('rescued people keep the actual leader path around two right-angle walls and expose movement context to physical navigation', () => {
  const config = getBattleOperationConfig('AFF-13', { frontPositions: [[0, 0], [20, 20], [20, 40]] });
  config.operationObjectives.tasks.find(task => task.id === 'survivors').offset = [0, 0];
  const sim = new BattleSimulation(config), player = { id: 'player1', hp: 1000, position: [0, 0] }, moves = [];
  const inCorridor = ([x, z]) => Math.abs(x) <= 1.5 && z >= -1.5 && z <= 21.5
    || Math.abs(z - 20) <= 1.5 && x >= -1.5 && x <= 21.5
    || Math.abs(x - 20) <= 1.5 && z >= 18.5 && z <= 41.5;
  const controller = new OperationObjectives(config, sim, { resolvePosition(next, context) {
    moves.push({ next, context });
    assert.equal(context.kind, 'noncombatants'); assert.ok(Array.isArray(context.origin)); assert.ok(Array.isArray(context.target));
    assert.ok(context.step >= 0 && context.step <= 5.2 * .25 + 1e-6);
    return inCorridor(next) ? next : context.origin;
  } });
  const tick = seconds => { while (seconds > 1e-8) { const delta = Math.min(.25, seconds); controller.update(delta, [player]); seconds -= delta; } };
  try {
    assert.equal(controller.interact(player).accepted, true); tick(3);
    for (const target of [[0, 20], [20, 20], [20, 40]]) {
      const start = [...player.position];
      for (let step = 1; step <= 10; step++) { player.position = start.map((value, axis) => value + (target[axis] - value) * step / 10); tick(.2); }
    }
    tick(12);
    const entity = controller.getWorldEntities().find(entity => entity.id === 'survivors');
    assert.ok(Math.hypot(entity.position[0] - 20, entity.position[1] - 40) <= 3.01, 'escort must turn both corners and catch up');
    assert.ok(moves.length > 10); assert.equal(moves.filter(move => !inCorridor(move.next)).length, 0, 'breadcrumbs cannot cut diagonally through either wall');
    const saved = controller.serialize(), restored = new OperationObjectives(config, sim);
    restored.restore(saved); assert.deepEqual(restored.serialize(), saved); restored.dispose();
  } finally { controller.dispose(); sim.dispose(); }
});

test('defence advances only on a friendly uncontested front and sources of civilian population are conserved', () => {
  const current = fixture('AFF-10');
  try {
    const before = current.controller.getHUDState().noncombatants; assert.equal(before.allocated, 9);
    assert.equal(current.use('captive').accepted, true); assert.equal(current.controller.getHUDState().noncombatants.rescued, 1);
    assert.equal(current.controller.damageObjective('civilians', 80, current.task('civilians').position), true);
    const population = current.controller.getHUDState().noncombatants;
    assert.equal(population.dead, 1); assert.equal(population.allocated, population.captive + population.rescued + population.evacuated + population.dead);
    assert.equal(current.controller.damageObjective('captive', 100, current.task('captive').position), true); current.tick(.25);
    assert.equal(current.controller.getResult()?.outcome, 'defeat');
  } finally { current.dispose(); }
  const hold = fixture('AFF-02');
  try {
    hold.tick(5); assert.equal(hold.task('defense').progress, 5);
    hold.simulation.captureBase('front_a', 'rival_clan'); hold.tick(5); assert.equal(hold.task('defense').progress, 5);
  } finally { hold.dispose(); }
});

test('save/restore preserves channels, cargo and completed outcomes without replaying side effects or accepting corrupt data', () => {
  const current = fixture(), events = [];
  try {
    current.player.position = [...current.task('register').position]; current.controller.interact(current.player); current.tick(1);
    const saved = current.controller.serialize(), restored = new OperationObjectives(current.config, current.simulation, { onEvent: event => events.push(event) });
    restored.restore(saved); assert.deepEqual(restored.serialize(), saved); assert.deepEqual(events, []);
    restored.update(1.5, [current.player]); assert.equal(restored.getHUDState().tasks.find(task => task.id === 'register').status, 'done');
    const cargo = restored.serialize(), again = new OperationObjectives(current.config, current.simulation);
    again.restore(cargo); assert.deepEqual(again.serialize(), cargo);
    const corrupt = structuredClone(cargo); corrupt.entities[0].kind = 'forged_convoy'; assert.throws(() => again.restore(corrupt), /invalid saved entity/);
    const falseTrigger = structuredClone(cargo); falseTrigger.tasks.find(task => task.id === 'register').completions = 0;
    falseTrigger.tasks.find(task => task.id === 'register').status = 'pending'; assert.throws(() => again.restore(falseTrigger), /invalid saved reaction/);
    const forgedClock = structuredClone(cargo); forgedClock.reactions[0].due = forgedClock.time + 100; assert.throws(() => again.restore(forgedClock), /invalid saved reaction/);
    const mismatched = structuredClone(cargo); mismatched.specDigest = 'another_layout'; assert.throws(() => again.restore(mismatched), /save does not match/);
    assert.deepEqual(again.serialize(), cargo, 'failed restore leaves the previous private state intact');
    restored.dispose(); again.dispose();
  } finally { current.dispose(); }
});
