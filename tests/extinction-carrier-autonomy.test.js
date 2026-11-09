import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createOperationScene } from '../js/battlefield/OperationScene.js';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';
import { BattleActorBridge } from '../js/battlefield/BattleActorBridge.js';
import { XenomorphHorde } from '../js/entities/XenomorphHorde.js';
import { EnvironmentManager } from '../js/entities/Environment.js';
import { CombatDirector } from '../js/engine/CombatDirector.js';

// A single existing Carrier is projected on a flat physical test arena. This
// uses the actual Environment navigation/LOS, Horde targeting, Bridge bind and
// finite simulation transition. Other armies remain distant; this is not a
// complete rendered LV-742 mission or a claim about natural combat difficulty.
function fixture({ variant = 'carrier-ravager', playerPosition = [5, 0, 0] } = {}) {
  const config = createOperationScene({ operationId: 'AFF-27', extinctionVariant: variant, mapSeed: 0 }).config;
  const simulation = new BattleSimulation(config), scene = new THREE.Scene();
  const environment = new EnvironmentManager(scene), horde = new XenomorphHorde(scene, null);
  const player = { hp: 1000, factionId: config.playerFaction, position: new THREE.Vector3(...playerPosition),
    radius: 1, canBeFacehugged: false, takeDamage(amount) { this.hp = Math.max(0, this.hp - amount); } };
  const director = new CombatDirector({ graceSeconds: 0 });
  const game = { player, env: environment, horde, marines: {}, allies: {}, synthetics: {}, bosses: {}, combatDirector: director };
  const bridge = new BattleActorBridge(game);
  bridge.bind(simulation);
  const source = [...simulation.units.values()].find(unit => unit.actorType === 'carrier');
  const group = simulation.groups.get(source.groupId);
  group.materialized = true; group.state = 'active'; source.state = 'active';
  const carrier = horde.spawnBattleUnit(source, simulation.getGroup(group.id));
  bridge.actors.set(source.id, { actor: carrier, manager: horde, groupId: group.id, unitId: source.id });
  const allocatedIds = [...simulation.units.keys()].sort(), cargoIds = [...source.carrierCargoIds];
  const requests = [], original = horde.carrierCargoLaunch;
  horde.carrierCargoLaunch = (actor, target) => {
    const result = original(actor, target);
    requests.push({ carrierId: actor.battleUnitId, targetIsPlayer: target === player,
      gap: actor.mesh.position.distanceTo(target.position), accepted: result.accepted, reason: result.reason ?? null,
      facehuggerId: result.facehuggerId ?? null });
    return result;
  };
  // Game.update owns this same relative order: Horde.update, Bridge.sync,
  // physical collision resolution. Never call launchCarrierFacehugger here.
  function step(delta = 1 / 60, { finalSync = true } = {}) {
    director.update(delta, [player]);
    horde.update(delta, player);
    if (finalSync) bridge.sync();
    for (const actor of horde.aliens) environment.resolveMovement(actor.mesh.position, actor.radius);
  }
  function advanceUntilLaunch(limit = 360) {
    bridge.sync();
    for (let frame = 0; frame < limit && source.carrierCargoIds.length === cargoIds.length; frame++) step();
    return bridge.actors.get(cargoIds[0])?.actor;
  }
  function assertFinite() {
    assert.equal(simulation.units.size, 952);
    assert.deepEqual([...simulation.units.keys()].sort(), allocatedIds);
    assert.equal(simulation.assertConservation(), true);
    assert.ok(bridge.actors.size <= simulation.budgets.active);
    assert.equal(simulation.budgets.active, 32);
    assert.equal(new Set(horde.aliens.map(actor => actor.battleUnitId)).size, horde.aliens.length);
  }
  return { simulation, environment, horde, bridge, player, carrier, source, group, requests, cargoIds,
    step, advanceUntilLaunch, assertFinite,
    dispose() {
      horde.carrierCargoLaunch = original;
      bridge.dispose(); horde.clearWave(); simulation.dispose(); environment.clearEnvironment();
    } };
}

test('Carrier autonomously reaches its defended front and launches one of its six existing IDs', () => {
  const f = fixture();
  try {
    const start = f.carrier.mesh.position.clone();
    assert.ok(start.distanceTo(f.player.position) > 13, 'the target is initially outside the physical launch arc');
    const facehugger = f.advanceUntilLaunch();
    assert.ok(facehugger, 'normal Horde updates must acquire an in-bound defender target and invoke the bound Bridge');
    assert.ok(f.carrier.mesh.position.distanceTo(start) > 5, 'the Carrier physically walks before reaching range');
    assert.equal(f.source.carrierCargoIds.length, 5);
    assert.equal(facehugger.battleUnitId, f.cargoIds[0]);
    assert.equal(f.simulation.units.get(facehugger.battleUnitId).state, 'active');
    assert.equal(f.requests.filter(request => request.accepted).length, 1);
    assert.equal(f.requests.at(-1).targetIsPlayer, true);
    assert.ok(f.requests.at(-1).gap <= 13);
    f.assertFinite();
  } finally { f.dispose(); }
});

test('the full Horde→Bridge synchronization preserves the real airborne arc until safe-floor contact', () => {
  const f = fixture();
  try {
    const facehugger = f.advanceUntilLaunch();
    assert.ok(facehugger?.carrierFlight);
    const floor = () => f.environment.getElevationAt(facehugger.mesh.position.x, facehugger.mesh.position.z, facehugger.mesh.position.y);
    assert.ok(facehugger.mesh.position.y > floor() + 1, 'post-Horde Bridge.sync must not snap an airborne allocated parasite to the ground');
    const flight = facehugger.carrierFlight, landing = flight.end.clone();
    for (let i = 0; i < 30; i++) f.step();
    assert.ok(facehugger.carrierFlight);
    assert.ok(facehugger.mesh.position.y > floor() + 1, 'the visible apex must survive the complete game-order pipeline');
    assert.ok(Math.abs(facehugger.carrierFlight.elapsed - .5) < 1e-6);
    const airborne = facehugger.mesh.position.clone();
    f.simulation.update(.5, { paused: true });
    f.bridge.sync();
    assert.deepEqual(facehugger.mesh.position.toArray(), airborne.toArray(), 'a paused simulation with no Horde tick preserves the airborne pose');
    assert.ok(Math.abs(facehugger.carrierFlight.elapsed - .5) < 1e-6);
    f.simulation.update(0, { paused: false });
    for (let i = 0; i < 30; i++) f.step();
    assert.equal(facehugger.carrierFlight, null);
    assert.ok(Math.abs(facehugger.mesh.position.y - floor()) < 1e-6);
    assert.ok(facehugger.mesh.position.distanceTo(landing) < 1e-6);
    assert.equal(f.environment.navigation.canStand(facehugger.mesh.position, facehugger.radius), true);
    assert.equal(f.source.carrierCargoIds.length, 5, 'cooldown avoids unloading the next original ID during this arc');
    f.assertFinite();
  } finally { f.dispose(); }
});

test('a nearby hunter outside the defend/formation radius is not acquired just to force a Carrier launch', () => {
  const f = fixture({ playerPosition: [46, 0, 2] });
  try {
    assert.ok(f.carrier.mesh.position.distanceTo(f.player.position) < 13);
    f.bridge.sync();
    assert.ok(Math.hypot(f.player.position.x - f.carrier.battleOrderTarget[0],
      f.player.position.z - f.carrier.battleOrderTarget[1]) > 28);
    for (let i = 0; i < 30; i++) f.step();
    assert.equal(f.requests.length, 0, 'the real defend/formation target constraint remains authoritative');
    assert.deepEqual(f.source.carrierCargoIds, f.cargoIds);
    f.assertFinite();
  } finally { f.dispose(); }
});

test('the defend radius remains 24 even when the hunter is inside the wider formation radius 28', () => {
  const f = fixture({ playerPosition: [18, 0, 0] });
  try {
    f.bridge.sync();
    const [x, z] = f.carrier.battleOrderTarget, gap = Math.hypot(f.player.position.x - x, f.player.position.z - z);
    assert.ok(gap > 24 && gap < 28, 'this target isolates the tighter defend policy');
    let closest = Infinity;
    for (let i = 0; i < 240; i++) { f.step(); closest = Math.min(closest, f.carrier.mesh.position.distanceTo(f.player.position)); }
    assert.ok(closest < 13, 'the Carrier actually passes within launch distance of the rejected hunter');
    assert.equal(f.requests.length, 0);
    assert.deepEqual(f.source.carrierCargoIds, f.cargoIds);
    f.assertFinite();
  } finally { f.dispose(); }
});

test('real physical cover rejects autonomous launch without spending any of the allocated cargo', () => {
  const f = fixture();
  try {
    // Enclose this target with a solid physical box. Target acquisition still
    // runs, while real safeSpawnNear / canStand / line-of-sight reject the arc.
    f.environment.colliders.push({ x: 5, z: 0, halfWidth: 8, halfDepth: 8, height: 8, rotation: 0 });
    for (let i = 0; i < 180; i++) { f.bridge.sync(); f.step(); }
    assert.ok(f.requests.length > 0, 'this case exercises actual autonomous launch refusals');
    assert.ok(f.requests.every(request => !request.accepted));
    assert.deepEqual(f.source.carrierCargoIds, f.cargoIds);
    assert.equal(f.horde.aliens.length, 1);
    f.assertFinite();
  } finally { f.dispose(); }
});

test('autonomous enhanced Carrier still consumes six original payload IDs rather than filling capacity twelve', () => {
  const f = fixture({ variant: 'carrier-ravager-enhanced' });
  try {
    const facehugger = f.advanceUntilLaunch();
    assert.ok(facehugger);
    assert.equal(f.cargoIds.length, 6);
    assert.equal(f.source.carrierCargoIds.length, 5);
    const saved = f.simulation.saveState(), restored = BattleSimulation.fromState(f.simulation.config, saved);
    try {
      assert.deepEqual(restored.units.get(f.source.id).carrierCargoIds, f.cargoIds.slice(1));
      assert.equal(restored.units.get(f.cargoIds[0]).carriedByCarrierId, undefined);
      assert.equal(restored.units.get(f.cargoIds[0]).state, 'distant');
      assert.deepEqual([...restored.units.keys()].sort(), [...f.simulation.units.keys()].sort());
      assert.equal(restored.assertConservation(), true);
    } finally { restored.dispose(); }
    f.assertFinite();
  } finally { f.dispose(); }
});

test('successive autonomous launches exhaust only the six original IDs, then no seventh parasite appears', () => {
  const f = fixture({ variant: 'carrier-ravager-enhanced' });
  try {
    f.bridge.sync();
    for (let frame = 0; frame < 1800 && f.source.carrierCargoIds?.length; frame++) f.step();
    const released = f.requests.filter(request => request.accepted).map(request => request.facehuggerId);
    assert.deepEqual(released, f.cargoIds);
    assert.equal(f.source.carrierCargoIds, undefined, 'empty finite cargo is removed rather than refilled to capacity twelve');
    for (let frame = 0; frame < 300; frame++) f.step();
    assert.equal(f.requests.filter(request => request.accepted).length, 6);
    assert.equal(f.horde.aliens.filter(actor => actor.type === 'facehugger').length, 6);
    assert.equal(new Set(released).size, 6);
    f.assertFinite();
  } finally { f.dispose(); }
});

test('Bridge cleanup restores the borrowed Carrier callback and removes the launched projection without a death', () => {
  const f = fixture();
  try {
    const facehugger = f.advanceUntilLaunch(), id = facehugger?.battleUnitId;
    assert.ok(id);
    f.horde.carrierCargoLaunch = f.bridge.carrierLaunchHandler;
    f.bridge.dispose();
    assert.equal(f.horde.carrierCargoLaunch, undefined);
    assert.equal(f.bridge.actors.size, 0);
    assert.equal(f.horde.aliens.length, 0);
    assert.equal(facehugger.mesh.parent, null);
    assert.equal(f.simulation.deaths.has(id), false);
    f.assertFinite();
  } finally { f.dispose(); }
});
