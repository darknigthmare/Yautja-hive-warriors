import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { EnvironmentManager } from '../js/entities/Environment.js';
import { LEVELS_DATA } from '../js/data/levelsData.js';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';
import { createBattlefieldOperation } from '../js/battlefield/BattlefieldOperation.js';
import { BattleActorBridge } from '../js/battlefield/BattleActorBridge.js';
import { ColonialMarinesManager } from '../js/entities/ColonialMarines.js';

function fixture() {
  const e = new EnvironmentManager(new THREE.Scene()); e.buildLevelEnvironment({ ...LEVELS_DATA[0], mapId: 'LD-01', strategicMode: true });
  for (const gate of e.battlefieldLayout.gates) e.openGate(gate.id);
  const bridge = e.tacticalBridges.values().next().value;
  const config = createBattlefieldOperation(e.battlefieldLayout); config.ai = { ...config.ai, enabled: false };
  const simulation = new BattleSimulation(config, { routeAvailabilityProvider: route => e.isTacticalRouteAvailable(route.physicalRouteId ?? route.id) });
  e.game = { battleSimulation: simulation }; return { e, bridge, simulation };
}

test('LD-01 raised crossing has continuous 0→3→0 ground for walkers and finite real surfaces for bolts', () => {
  const { e, bridge } = fixture(), s = bridge.spec;
  const heights = [];
  for (let at = -s.halfSpan; at <= s.halfSpan; at += .25) {
    const p = new THREE.Vector3(s.center[0] + at, 0, s.center[1]);
    p.y = e.getElevationAt(p.x, p.z); const expected = p.clone(); heights.push(p.y);
    e.resolveGroundAgentMovement(p, new THREE.Vector3(s.center[0] + s.halfSpan + 2, 0, s.center[1]), .25, .65);
    assert.ok(p.distanceTo(expected) < 1e-5, `walker blocked at ${at}`);
  }
  assert.equal(heights[0], 0); assert.equal(heights.at(-1), 0); assert.equal(Math.max(...heights), 3);
  assert.ok(heights.every((height, i) => !i || Math.abs(height - heights[i - 1]) <= .063));
  for (const at of [-18, 0, 18]) {
    const from = new THREE.Vector3(s.center[0] + at, 8, s.center[1]);
    const hit = e.traceSegment(from, from.clone().setY(-4));
    assert.ok(hit && Math.abs(hit.point.y - e.getElevationAt(from.x, from.z)) < .08, 'downward bolt meets actual ramp/deck surface');
  }
  assert.equal(e.getElevationAt(s.center[0], s.center[1], -5), -5, 'a person below the crossing does not snap onto its roof');
  assert.equal(e.getElevationAt(s.center[0], s.center[1], 3), 3);
  const jumper = new THREE.Vector3(s.center[0], 1, s.center[1]);
  assert.equal(e.resolveVerticalMovement(jumper, -5, 2.4).blocked, true);
  assert.ok(jumper.y > .15 && jumper.y < .25, 'an ascending body stops against the real underside of the deck');
  assert.ok(e.root.getObjectByName('tactical-0-2').geometry.userData.bridgeGap);
  e.clearEnvironment();
});

test('destruction closes the real route for both camps, drops supported actors and preserves an alternative', () => {
  const { e, bridge, simulation } = fixture(), s = bridge.spec;
  let damage = 0;
  const player = { position: new THREE.Vector3(s.center[0], 3, s.center[1]), mesh: new THREE.Group(), hp: 100, takeDamage(amount) { damage += amount; } };
  e.game.player = player;
  const marine = { mesh: new THREE.Group(), hp: 20 }; marine.mesh.position.set(s.center[0], 3, s.center[1] + 2);
  const deaths = []; e.game.marines = { marines: [marine], defeatCombatant(actor, details) { deaths.push({ actor, details }); } };
  const beforePath = simulation._path('insertion', 'relay'); assert.ok(beforePath);
  e.damageTacticalBridge(bridge.id, 600);
  assert.equal(simulation.routes.get(s.routeId).open, false); assert.equal(e.isTacticalRouteAvailable(s.routeId), false);
  assert.equal(e.getElevationAt(s.center[0], s.center[1]), -5);
  const remaining = simulation._path('insertion', 'relay'); assert.ok(remaining?.every(segment => segment.routeId !== s.routeId));
  assert.ok(simulation._path('relay', 'insertion')?.every(segment => segment.routeId !== s.routeId));
  assert.equal(simulation.setRouteOpen(s.routeId, true), false, 'a device cannot reopen destroyed terrain');
  const xz = [player.position.x, player.position.z], samples = [];
  for (let i = 0; i < 60; i++) { bridge.update(1 / 60); e.resolveMovement(player.position, .65); samples.push(player.position.y); }
  assert.ok(samples[0] < 3 && samples[0] > 2.9); assert.equal(samples.at(-1), -5); assert.equal(damage, 30);
  assert.deepEqual([player.position.x, player.position.z], xz, 'falling never teleports a rider to a bank');
  assert.equal(marine.hp, 0); assert.equal(deaths.length, 1); assert.equal(deaths[0].details.killerFaction, 'neutral', 'fall deaths use one neutral combat ledger entry');
  const ray = new THREE.Vector3(s.center[0], 8, s.center[1]); assert.equal(e.traceSegment(ray, ray.clone().setY(-4)), null, 'collapsed deck leaves no phantom projectile collider');
  const blocked = new THREE.Vector3(s.center[0] - 23.9, 0, s.center[1]); e.resolveMovement(blocked, .65);
  assert.ok(blocked.x <= s.center[0] - 24.6, 'ground traffic stops at the broken bank');
  e.clearEnvironment(); assert.equal(player._terrainFall, undefined);
});

test('repair and saved destruction restore support and route state without duplicating collisions', () => {
  const { e, bridge, simulation } = fixture();
  const player = { position: bridge.consolePosition.clone(), hp: 100 }; e.game.player = player;
  assert.equal(e.checkTacticalBridgeInteraction(player), true);
  bridge.update(2.9); assert.equal(bridge.destroyed, false); bridge.update(.11); assert.equal(bridge.destroyed, true);
  const saved = e.serializeTacticalWorld(), count = e.colliders.length;
  assert.equal(e.checkTacticalBridgeInteraction(player), true); bridge.update(6.1);
  assert.equal(bridge.destroyed, false); assert.equal(simulation.routes.get(bridge.spec.routeId).open, true); assert.equal(bridge.deck.visible, true);
  assert.equal(e.restoreTacticalWorld(saved), true); assert.equal(bridge.destroyed, true);
  e.repairTacticalBridge(bridge.id); assert.equal(e.colliders.length, count); assert.equal(bridge.deckCollider.enabled, true); assert.equal(bridge.gapCollider.enabled, false);
  e.clearEnvironment();
});

test('a real USCM actor and BattleActorBridge walk the access ramp, deck and exit at their actual elevations', () => {
  const { e, bridge: crossing, simulation } = fixture(), s = crossing.spec;
  const marines = new ColonialMarinesManager(e.scene, {}); marines.environment = e;
  const game = { env: e, player: { hp: 100, position: new THREE.Vector3(30000, 0, 30000), factionId: 'player_clan' },
    marines, horde: { aliens: [], checkMeleeHits: () => [], cancelPendingSpawns() {}, getActiveCombatants: () => [] },
    allies: { allies: [] }, synthetics: { androids: [] }, bosses: {}, combatDirector: {}, battleSimulation: simulation };
  const projection = new BattleActorBridge(game); projection.bind(simulation); e.game = game;
  const group = [...simulation.groups.values()].find(group => group.factionId === 'human_force');
  const units = simulation.getGroupUnits(group.id).map((unit, i) => ({ ...unit, position: [s.center[0] - 26, s.center[1] + (i - 1) * 2] }));
  assert.equal(projection.spawnGroup(group, units), true);
  const actor = marines.marines[0], target = [s.center[0] + 26, actor.mesh.position.z], heights = [];
  for (let frame = 0; frame < 500; frame++) {
    projection.sync();
    for (const marine of marines.marines) { marine.battleOrder = { type: 'regroup' }; marine.battleFormationTarget = null; marine.battleOrderTarget = [marine.mesh.position.x, marine.mesh.position.z]; }
    actor.battleOrderTarget = target;
    const previous = actor.mesh.position.clone(); marines.update(1 / 60, game.player, game.horde); projection.sync();
    assert.ok(actor.mesh.position.distanceTo(previous) < .15, 'the real manager cannot snap or teleport between height layers');
    assert.ok(Math.abs(actor.mesh.position.y - e.getElevationAt(actor.mesh.position.x, actor.mesh.position.z)) < 1e-5);
    heights.push(actor.mesh.position.y);
    if (actor.mesh.position.x > s.center[0] + 24.5) break;
  }
  assert.ok(actor.mesh.position.x > s.center[0] + 24.5, 'ordered actor exits the far bank');
  assert.ok(Math.max(...heights) > 2.99); assert.equal(heights.at(-1), 0);
  assert.ok(actor.mesh.children.length > 3, 'this is a rendered USCM actor rather than a coordinate-only proxy');
  projection.dispose(); marines.clearSquad(); simulation.dispose(); e.clearEnvironment();
});
