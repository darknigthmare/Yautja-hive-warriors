import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { AllyRescueSystem } from '../js/battlefield/AllyRescueSystem.js';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';
import { createBattlefieldOperation } from '../js/battlefield/BattlefieldOperation.js';
import { createBattlefieldLayout } from '../js/data/BattlefieldLayouts.js';
import { YautjaAlliesManager } from '../js/entities/YautjaAllies.js';
import { CombatEvents } from '../js/engine/CombatEvents.js';
import { CombatDirector } from '../js/engine/CombatDirector.js';
import { BattleActorBridge } from '../js/battlefield/BattleActorBridge.js';
import { selectBattleTarget, maintainBattleFormation, requestNPCStrike } from '../js/engine/BattleActorSupport.js';

function setup({ uniqueAllyId = null } = {}) {
  const config = createBattlefieldOperation(createBattlefieldLayout({ environmentType: 'forest' }));
  if (uniqueAllyId) config.groups.find(group => group.factionId === config.playerFaction).units[0].uniqueId = uniqueAllyId;
  config.ai = { ...config.ai, enabled: false }; config.profiles.forEach(profile => { profile.damage = 0; });
  const simulation = new BattleSimulation(config, { spawnGroup: () => true });
  simulation.update(.25, { players: [{ id: 'player1', hp: 1000, position: config.fronts[0].position }] });
  const unit = simulation.getActiveUnits().find(item => item.factionId === 'player_clan');
  assert.ok(unit);
  const scene = new THREE.Scene(), manager = new YautjaAlliesManager(scene, null);
  manager.battleSimulation = simulation; manager.combatDirector = new CombatDirector(); manager.combatEvents = new CombatEvents({ runId: 'rescue-test' });
  const deaths = []; manager.combatEvents.subscribe(event => { deaths.push(event); simulation.recordDeath(event); });
  const actor = manager.spawnBattleUnit(unit, simulation.groups.get(unit.groupId));
  const actors = new Map([[unit.id, { actor, manager }]]);
  const p1 = { hp: 1000, maxHp: 1000, medicompCharges: 2, position: actor.mesh.position.clone().add(new THREE.Vector3(2, 0, 0)) };
  const p2 = { hp: 1000, maxHp: 1000, medicompCharges: 2, isPlayer2: true, position: p1.position.clone() };
  const environment = { hasLineOfSight: () => true };
  const rescue = new AllyRescueSystem({ simulation, actors, players: () => [p1, p2], environment }).bindManager(manager);
  const down = () => { actor.hp = 0; return manager.defeatCombatant(actor, { cause: 'enemy-hit', killerFaction: 'hive' }); };
  const cleanup = () => { rescue.dispose(); manager.clearSquad(); simulation.dispose(); };
  return { simulation, config, unit: simulation.units.get(unit.id), actor, manager, actors, scene, p1, p2, deaths, rescue, environment, down, cleanup };
}

test('the first lethal ally hit becomes a rendered casualty without death credit or military population loss', () => {
  const f = setup(), before = f.simulation.getGroup(f.unit.groupId), counts = f.simulation.getCounts();
  assert.equal(f.down(), null); assert.equal(f.actor.hp, 1); assert.equal(f.unit.hp, 1); assert.equal(f.unit.incapacitated, true);
  assert.equal(f.deaths.length, 0); assert.equal(f.simulation.deaths.size, 0); assert.equal(f.manager.allies.length, 1);
  assert.deepEqual(f.simulation.getCounts(), counts);
  const after = f.simulation.getGroup(f.unit.groupId);
  assert.equal(after.combatReady, before.combatReady - 1); assert.equal(after.incapacitated, before.incapacitated + 1);
  const position = f.actor.mesh.position.clone(); f.manager.update(1, f.p1.position, { aliens: [] });
  assert.deepEqual(f.actor.mesh.position.toArray(), position.toArray());
  assert.equal(maintainBattleFormation(f.manager, f.actor, 1, 30), true);
  assert.equal(requestNPCStrike(f.actor, { hp: 100 }, 1), false);
  f.rescue.update(.4); assert.ok(Math.abs(f.actor.mesh.getObjectByName('ally-rescue-posture').rotation.z) > 1);
  assert.equal(f.simulation.result, null); assert.equal(f.simulation.assertConservation(), true); f.cleanup();
});

test('three seconds of real channeling costs one medicomp only at completion and restores contribution once', () => {
  const f = setup(); f.down(); const ready = f.simulation.getGroup(f.unit.groupId).combatReady;
  assert.equal(f.rescue.interact(f.p1, f.unit.id).accepted, true);
  f.rescue.update(2.9); assert.equal(f.p1.medicompCharges, 2); assert.equal(f.actor.hp, 1);
  assert.equal(f.rescue.interact(f.p1, f.unit.id).existing, true, 'repeated E does not reset or duplicate the channel');
  f.rescue.update(.1); assert.equal(f.p1.medicompCharges, 1);
  assert.equal(f.actor.hp, Math.floor(f.unit.maxHp * .25)); assert.equal(f.unit.incapacitated, false);
  assert.equal(f.simulation.getGroup(f.unit.groupId).combatReady, ready + 1);
  assert.equal(f.rescue.getState().records[0].status, 'rescued'); assert.equal(f.rescue.interact(f.p1).accepted, false);
  f.actor.hp = 0; f.manager.defeatCombatant(f.actor, { cause: 'second-lethal-hit', killerFaction: 'hive' });
  assert.equal(f.deaths.length, 1); assert.equal(f.simulation.deaths.size, 1); assert.equal(f.manager.allies.length, 0);
  assert.equal(f.unit.state, 'dead'); assert.equal(f.simulation.assertConservation(), true); f.cleanup();
});

test('a rescued ally lost offscreen reconciles medical history once without a second death or charge', () => {
  for (const reconcile of ['update', 'serialize']) {
    const f = setup(); f.down(); f.rescue.interact(f.p1); f.rescue.update(3.1);
    const originalMedicalState = f.rescue.serialize();
    const snapshot = f.manager.despawnBattleUnit(f.unit.id); f.actors.delete(f.unit.id);
    f.simulation.syncUnit(f.unit.id, snapshot); f.simulation.releaseGroupDetail(f.unit.groupId);
    assert.equal(f.simulation.recordDeath({ entityId: f.unit.id, cause: 'distant_combat', killerFaction: 'hive' }), true);
    const ledger = structuredClone([...f.simulation.deaths.values()]);
    if (reconcile === 'update') f.rescue.update(.1);
    assert.equal(f.rescue.serialize().records[0].status, 'dead');
    f.rescue.update(.1); f.rescue.serialize();
    assert.deepEqual([...f.simulation.deaths.values()], ledger);
    assert.equal(f.rescue.getState().events.filter(event => event.type === 'ally_rescue_lost').length, 1);
    assert.equal(f.deaths.length, 0); assert.equal(f.p1.medicompCharges, 1);
    // Older medical snapshots are also normalized against the engine's
    // authoritative loss when loaded, without rewriting its death ledger.
    const resumed = new AllyRescueSystem({ simulation: f.simulation, actors: new Map(), players: () => [f.p1] });
    resumed.restore(originalMedicalState);
    assert.equal(resumed.serialize().records[0].status, 'dead');
    assert.deepEqual([...f.simulation.deaths.values()], ledger); resumed.dispose(); f.cleanup();
  }
});

test('evacuation and a campaign-confirmed capture close a previously rescued ally without declaring a death', () => {
  const f = setup({ uniqueAllyId: 'rescue-persistent-ally' }); f.down(); f.rescue.interact(f.p1); f.rescue.update(3.1);
  const medicalState = f.rescue.serialize();
  assert.equal(f.simulation.evacuateGroup(f.unit.groupId), true);
  f.rescue.update(.1);
  assert.equal(f.rescue.serialize().records[0].status, 'evacuated');
  assert.equal(f.manager.allies.length, 0); assert.equal(f.simulation.deaths.size, 0);
  const captured = new BattleSimulation(f.config, { history: { capturedUniqueIds: ['rescue-persistent-ally'] } });
  const resumed = new AllyRescueSystem({ simulation: captured, actors: new Map(), players: () => [f.p1] });
  resumed.restore(medicalState);
  assert.equal(captured.getUnit(f.unit.id).state, 'captured');
  assert.equal(resumed.serialize().records[0].status, 'captured');
  assert.equal(resumed.getState().events.filter(event => event.type === 'ally_rescue_unavailable').length, 1);
  assert.equal(captured.deaths.size, 0); assert.equal(f.deaths.length, 0); assert.equal(f.p1.medicompCharges, 1);
  resumed.dispose(); captured.dispose(); f.cleanup();
});

test('impact, movement, vertical separation and cover interrupt without consuming the medical resource', () => {
  const f = setup(); f.down();
  for (const interrupt of ['damage', 'move', 'cover', 'height']) {
    f.p1.position.copy(f.actor.mesh.position).add(new THREE.Vector3(2, 0, 0)); f.environment.hasLineOfSight = () => true;
    assert.equal(f.rescue.interact(f.p1).accepted, true); f.rescue.update(.4);
    if (interrupt === 'damage') f.p1.hp--;
    if (interrupt === 'move') f.p1.position.x += .7;
    if (interrupt === 'cover') f.environment.hasLineOfSight = () => false;
    if (interrupt === 'height') f.p1.position.y += 3;
    f.rescue.update(.1); assert.equal(f.rescue.channels.size, 0, interrupt); assert.equal(f.p1.medicompCharges, 2);
  }
  assert.equal(f.rescue.getState().events.filter(event => event.type === 'ally_rescue_interrupted').length, 4);
  f.p1.position.copy(f.actor.mesh.position); f.environment.hasLineOfSight = () => true; f.p1.medicompCharges = 0;
  assert.equal(f.rescue.interact(f.p1).reason, 'medicomp_required'); f.cleanup();
});

test('pause and zero delta freeze both bleedout and an admitted rescue; another player cannot double-rescue', () => {
  const f = setup(); f.down(); assert.equal(f.rescue.interact(f.p1).accepted, true);
  assert.equal(f.rescue.interact(f.p2).reason, 'ally_already_being_rescued');
  const state = f.rescue.serialize(); f.rescue.update(0); f.simulation.paused = true; f.rescue.update(100);
  assert.deepEqual(f.rescue.serialize(), state); f.simulation.paused = false;
  f.p1.hp = 0; f.rescue.update(.1); assert.equal(f.rescue.channels.size, 0);
  assert.equal(f.rescue.interact(f.p2).accepted, true); f.rescue.update(3);
  assert.equal(f.p2.medicompCharges, 1); assert.equal(f.p1.medicompCharges, 2); assert.equal(f.deaths.length, 0); f.cleanup();
});

test('a finishing hostile strike records exactly one real casualty instead of starting another downed life', () => {
  const f = setup(); f.down();
  const attacker = { factionId: 'hive', hp: 100, mesh: new THREE.Group() };
  attacker.mesh.position.copy(f.actor.mesh.position);
  const manager = { battleSimulation: f.simulation, combatActorsProvider: () => [f.actor] };
  const target = selectBattleTarget(manager, attacker);
  assert.ok(target); target.takeDamage(10); target.takeDamage(10);
  assert.equal(f.actor.hp, 0); assert.equal(f.manager.allies.length, 0); assert.equal(f.deaths.length, 1); assert.equal(f.unit.state, 'dead');
  f.manager.defeatCombatant(f.actor); f.rescue.update(30); assert.equal(f.deaths.length, 1);
  assert.equal(f.simulation.assertConservation(), true); f.cleanup();
});

test('culling a freshly lethal actor preserves its one remaining HP, casualty deadline and same identity on return', () => {
  const f = setup(); f.actor.hp = 0;
  const snapshot = f.manager.despawnBattleUnit(f.unit.id);
  assert.equal(snapshot.hp, 1); assert.equal(snapshot.incapacitated, true); assert.equal(f.manager.allies.length, 0); assert.equal(f.scene.children.length, 0);
  f.actors.delete(f.unit.id); f.unit.state = 'distant'; f.rescue.update(5);
  assert.equal(f.rescue.serialize().records[0].remaining, 20); assert.equal(f.simulation.deaths.size, 0);
  f.unit.state = 'active'; const actor = f.manager.spawnBattleUnit(f.unit, f.simulation.groups.get(f.unit.groupId));
  f.actors.set(f.unit.id, { actor, manager: f.manager }); f.rescue.onMaterialize(actor);
  assert.equal(actor.hp, 1); assert.equal(actor.isDowned, true); assert.equal(actor.battleUnitId, f.unit.id);
  assert.equal(f.rescue.serialize().records[0].remaining, 20); assert.equal(f.rescue.records.size, 1);
  f.rescue.update(20); assert.equal(f.unit.state, 'dead'); assert.equal(f.simulation.deaths.size, 1); assert.equal(f.deaths.length, 1); f.cleanup();
});

test('an offscreen casualty continues bleeding out while pause still freezes it', () => {
  const f = setup(); f.down(); const id = f.unit.id;
  f.manager.despawnBattleUnit(id); f.actors.delete(id); f.unit.state = 'distant';
  f.rescue.update(24); f.simulation.paused = true; f.rescue.update(100); assert.equal(f.unit.state, 'distant');
  f.simulation.paused = false; f.rescue.update(1);
  assert.equal(f.unit.state, 'dead'); assert.equal(f.simulation.deaths.size, 1); assert.equal(f.rescue.serialize().records[0].status, 'dead');
  assert.equal(f.deaths.length, 0, 'a distant death uses the strategic ledger rather than a missing rendered actor'); f.cleanup();
});

test('evacuating an eligible wounded group closes rescue without inventing a death or another medical charge', () => {
  const f = setup(); f.down();
  assert.equal(f.simulation.evacuateGroup(f.unit.groupId), true); f.rescue.update(.1);
  assert.equal(f.unit.state, 'evacuated'); assert.equal(f.unit.incapacitated, false); assert.equal(f.rescue.records.get(f.unit.id).status, 'evacuated');
  assert.equal(f.deaths.length, 0); assert.equal(f.simulation.deaths.size, 0); assert.equal(f.p1.medicompCharges, 2); assert.equal(f.manager.allies.length, 0);
  assert.equal(f.simulation.assertConservation(), true); f.cleanup();
});

test('a genuine engine checkpoint resumes the same casualty and partial channel without resetting time or stock', () => {
  const f = setup(); f.down(); f.rescue.interact(f.p1); f.rescue.update(1.2);
  const state = f.rescue.serialize(), simulationState = f.simulation.saveState();
  const simulation = BattleSimulation.fromState(f.config, simulationState, { spawnGroup: () => true });
  const scene = new THREE.Scene(), manager = new YautjaAlliesManager(scene); manager.battleSimulation = simulation;
  const actors = new Map(), player = { ...f.p1, position: f.p1.position.clone() };
  const rescue = new AllyRescueSystem({ simulation, actors, players: () => [player], environment: f.environment }).bindManager(manager);
  rescue.restore(state); assert.equal(rescue.serialize().records[0].remaining, 23.8); assert.equal(rescue.channels.get('player1').progress, 1.2);
  rescue.update(.1); assert.equal(rescue.channels.get('player1').progress, 1.2, 'resume waits for the actual body rather than canceling or healing an absent projection');
  // Re-project that allocated casualty using the real manager. Full atomic
  // group rematerialization is covered by the engine/Bridge integration suite.
  simulation.units.get(f.unit.id).state = 'active';
  const actor = manager.spawnBattleUnit(simulation.getUnit(f.unit.id), simulation.groups.get(f.unit.groupId));
  actors.set(f.unit.id, { actor, manager }); rescue.onMaterialize(actor);
  rescue.update(1.8); assert.equal(player.medicompCharges, 1); assert.equal(actor.hp, Math.floor(f.unit.maxHp * .25));
  assert.equal(simulation.units.size, f.simulation.units.size); assert.equal(simulation.deaths.size, 0); assert.equal(simulation.assertConservation(), true);
  const bad = structuredClone(rescue.serialize()); bad.records[0].unitId = 'invented';
  const before = rescue.serialize(); assert.throws(() => rescue.restore(bad), /rescue casualty/); assert.deepEqual(rescue.serialize(), before);
  rescue.dispose(); manager.clearSquad(); simulation.dispose(); f.cleanup();
});

test('rescue and bleedout event ordering agrees at 30, 60 and 120 Hz, including simultaneous deadlines', () => {
  for (const seconds of [3, 3.01]) {
    const results = [];
    for (const hz of [30, 60, 120]) {
      const f = setup(); f.down(); f.rescue.records.get(f.unit.id).remaining = seconds; f.rescue.interact(f.p1);
      for (let frame = 0; frame < Math.ceil(3.1 * hz); frame++) f.rescue.update(1 / hz);
      results.push([f.rescue.records.get(f.unit.id).status, f.p1.medicompCharges, f.unit.state === 'dead']); f.cleanup();
    }
    assert.deepEqual(results, Array(3).fill(seconds === 3 ? ['dead', 2, true] : ['rescued', 1, false]));
  }
});

test('coordination damage follows the actual attacker instead of the first cached member of its faction', () => {
  const simulation = { areHostile: () => true }, target = { hp: 500, factionId: 'other', mesh: new THREE.Group() };
  const manager = { battleSimulation: simulation, combatActorsProvider: () => [target] };
  const weak = { hp: 100, factionId: 'hive', mesh: new THREE.Group(), coordinationStrength: .65 };
  const coordinated = { hp: 100, factionId: 'hive', mesh: new THREE.Group(), coordinationStrength: 1 };
  selectBattleTarget(manager, weak).takeDamage(100); assert.equal(target.hp, 435);
  selectBattleTarget(manager, coordinated).takeDamage(100); assert.equal(target.hp, 335);
  weak.coordinationStrength = 1; selectBattleTarget(manager, weak).takeDamage(100); assert.equal(target.hp, 235);
});

test('a living ally follows the physical access waypoint toward an elevated target while a downed ally stays still', () => {
  const f = setup(), target = { hp: 1000, factionId: 'hive', position: f.actor.mesh.position.clone().add(new THREE.Vector3(0, 4, 0)), takeDamage() { throw Error('Cannot strike through the floor'); } };
  const before = f.actor.mesh.position.clone(), waypoint = before.clone().add(new THREE.Vector3(10, 0, 0)), requests = [];
  f.manager.combatActorsProvider = () => [target]; f.manager.environment = {
    getVerticalNavigationTarget: () => waypoint.clone(), hasLineOfSight: () => false,
    resolveAgentMovement(position, destination) { requests.push(destination.toArray()); }
  };
  f.manager.update(.1, f.p1.position, { aliens: [] });
  assert.ok(f.actor.mesh.position.x > before.x); assert.equal(f.actor.mesh.position.y, before.y); assert.deepEqual(requests[0], waypoint.toArray());
  f.down(); const downed = f.actor.mesh.position.clone(), count = requests.length; f.manager.update(1, f.p1.position, { aliens: [] });
  assert.deepEqual(f.actor.mesh.position.toArray(), downed.toArray()); assert.equal(requests.length, count); f.cleanup();
});

function bridgeFixture() {
  const scene = new THREE.Scene(), config = createBattlefieldOperation(createBattlefieldLayout({ environmentType: 'forest' }));
  config.ai = { ...config.ai, enabled: false }; config.profiles.forEach(profile => { profile.damage = 0; });
  const generic = key => ({ [key]: [], checkMeleeHits: () => [], cancelPendingSpawns() {},
    spawnBattleUnit(unit) { const actor = { ...unit, battleUnitId: unit.id, mesh: new THREE.Group(), radius: 1 }; actor.mesh.position.set(unit.position[0], 0, unit.position[1]); this[key].push(actor); scene.add(actor.mesh); return actor; },
    despawnBattleUnit(id) { const index = this[key].findIndex(actor => actor.battleUnitId === id); if (index < 0) return null; const [actor] = this[key].splice(index, 1); scene.remove(actor.mesh); return { id, hp: actor.hp, position: [actor.mesh.position.x, actor.mesh.position.z] }; }
  });
  const game = { player: { hp: 1000, maxHp: 1000, medicompCharges: 2, position: new THREE.Vector3() }, player2: null,
    allies: new YautjaAlliesManager(scene), horde: generic('aliens'), marines: generic('marines'), synthetics: generic('androids'), bosses: {},
    combatDirector: new CombatDirector(), env: { resolveMovement() {}, getElevationAt: () => 0, hasLineOfSight: () => true } };
  const bridge = new BattleActorBridge(game);
  const simulation = new BattleSimulation(config, { spawnGroup: (...args) => bridge.spawnGroup(...args), despawnGroup: (...args) => bridge.despawnGroup(...args) });
  game.battleSimulation = simulation; bridge.bind(simulation);
  game.allies.combatEvents = new CombatEvents({ runId: 'rescue-bridge' }); const deaths = [];
  game.allies.combatEvents.subscribe(event => { deaths.push(event); simulation.recordDeath(event); });
  const rescue = game.allyRescue = new AllyRescueSystem({ simulation, actors: bridge.actors, players: () => [game.player], environment: game.env }).bindManager(game.allies);
  const step = delta => { bridge.sync(); simulation.update(delta, { players: [{ id: 'player1', hp: game.player.hp, position: [game.player.position.x, game.player.position.z] }] }); rescue.update(delta); bridge.sync(); };
  step(.25);
  const actor = [...bridge.actors.values()].find(entry => entry.manager === game.allies).actor;
  const cleanup = () => { simulation.dispose(); bridge.dispose(); rescue.dispose(); game.allies.clearSquad(); };
  return { game, bridge, simulation, rescue, actor, deaths, step, cleanup };
}

test('the real Bridge intercepts environmental HP0 before death bookkeeping, and a later finisher still dies once', () => {
  const f = bridgeFixture(), id = f.actor.battleUnitId, allocated = f.simulation.units.size;
  f.actor.hp = 0; f.bridge.sync();
  assert.equal(f.actor.hp, 1); assert.equal(f.actor.isDowned, true); assert.equal(f.simulation.getUnit(id).incapacitated, true);
  assert.equal(f.simulation.deaths.size, 0); assert.equal(f.deaths.length, 0); assert.equal(f.bridge.actors.get(id).actor, f.actor);
  f.actor.hp = 0; f.bridge.sync(); f.bridge.sync();
  assert.equal(f.simulation.deaths.size, 1); assert.equal(f.deaths.length, 1); assert.equal(f.simulation.getUnit(id).state, 'dead');
  assert.equal(f.bridge.actors.has(id), false); assert.equal(f.simulation.units.size, allocated); assert.equal(f.simulation.assertConservation(), true); f.cleanup();
});

test('the real Bridge hit result reports a casualty as alive and reports only the later finishing blow as a kill', () => {
  const f = bridgeFixture(), id = f.actor.battleUnitId;
  const attack = { origin: f.actor.mesh.position.clone(), radius: .1, damage: 1_000_000, killerFaction: 'hive' };
  const first = f.bridge.hitOtherHostiles(attack); assert.equal(first.length, 1);
  assert.equal(first[0].killed, false); assert.equal(first[0].event, null); assert.equal(f.simulation.deaths.size, 0);
  const second = f.bridge.hitOtherHostiles(attack); assert.equal(second.length, 1);
  assert.equal(second[0].killed, true); assert.equal(second[0].event.entityId, id);
  f.bridge.sync(); assert.equal(f.deaths.length, 1); assert.equal(f.simulation.deaths.size, 1); assert.equal(f.bridge.actors.has(id), false); f.cleanup();
});

test('returning near a persistent wounded ally rematerializes its original group under the shared cap and allows real rescue', () => {
  const f = bridgeFixture(), id = f.actor.battleUnitId, groupId = f.actor.battleGroupId;
  f.actor.hp = 0; f.bridge.sync();
  const location = f.actor.mesh.position.clone(); f.game.player.position.copy(location).add(new THREE.Vector3(2, 0, 0));
  const allocatedIds = [...f.simulation.units.keys()].sort();
  assert.equal(f.simulation.releaseGroupDetail(groupId, 'test-cull'), true); assert.equal(f.bridge.actors.has(id), false);
  for (let frame = 0; frame < 13; frame++) f.step(.25);
  const entry = f.bridge.actors.get(id); assert.ok(entry, f.bridge.lastError ?? 'the known casualty must return with its allied group');
  assert.equal(entry.actor.isDowned, true); assert.equal(entry.actor.hp, 1); assert.deepEqual(entry.actor.mesh.position.toArray(), location.toArray());
  assert.ok(f.rescue.serialize().records[0].remaining < 25); assert.ok(f.bridge.actors.size <= f.simulation.budgets.active);
  assert.equal(f.rescue.interact(f.game.player, id).accepted, true); for (let frame = 0; frame < 12; frame++) f.step(.25);
  assert.equal(f.game.player.medicompCharges, 1); assert.equal(f.simulation.getUnit(id).incapacitated, false);
  assert.deepEqual([...f.simulation.units.keys()].sort(), allocatedIds); assert.equal(f.simulation.deaths.size, 0); assert.equal(f.simulation.assertConservation(), true); f.cleanup();
});
