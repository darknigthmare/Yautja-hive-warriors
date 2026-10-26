import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { EnvironmentManager } from '../js/entities/Environment.js';
import { YautjaSkimmer } from '../js/entities/YautjaSkimmer.js';
import { OperationTransport } from '../js/entities/OperationTransport.js';
import { LEVELS_DATA } from '../js/data/levelsData.js';

function fixture() {
  const e = new EnvironmentManager(new THREE.Scene()); e.buildLevelEnvironment({ ...LEVELS_DATA[0], strategicMode: true });
  e.battlefieldLayout.gates.forEach(gate => e.openGate(gate.id));
  const simulation = { config: { playerFaction: 'clan' }, relationship: (a, b) => a === b ? 'allied' : 'hostile', areHostile: (a, b) => a !== b,
    fronts: new Map(e.battlefieldLayout.frontAnchorIds.map(id => { const s = e.battlefieldLayout.sectors.find(s => s.id === id); return [id, { id, label: id, position: s.center, radius: 58, owner: 'clan', contested: false }]; })),
    routes: new Map(e.battlefieldLayout.strategicRoutes.map(route => [route.id, structuredClone(route)])), groups: new Map(), units: new Map() };
  const skimmer = new YautjaSkimmer(e.scene, {}); skimmer.spawnAt(new THREE.Vector3(0, .5, 0));
  const player = { position: skimmer.position.clone(), mesh: new THREE.Group(), hp: 100 };
  const enemies = [], transport = new OperationTransport(e, skimmer, simulation, { hostilesProvider: () => enemies });
  const clear = () => { transport.dispose(); e.clearEnvironment(); skimmer.mesh.traverse(node => { node.geometry?.dispose(); node.material?.dispose(); }); skimmer.mesh.removeFromParent(); };
  return { e, simulation, skimmer, player, enemies, transport, clear };
}

test('controlled transport mounts the real skimmer and physically follows both corridor turns over a measured duration', () => {
  const { e, player, skimmer, transport, clear } = fixture();
  assert.equal(transport.requestTravel(player, 'relay').reason, 'mount_required');
  assert.equal(transport.interact(player), true); assert.equal(player.mesh.visible, false);
  const trip = transport.requestTravel(player, 'relay'); assert.equal(trip.accepted, true); assert.ok(trip.duration > 12);
  const initial = player.position.clone(); for (let i = 0; i < 110; i++) transport.update(1 / 60, player, {});
  assert.ok(player.position.distanceTo(initial) < .001, 'boarding has a real nonzero delay');
  let travelled = 0, elapsed = 110 / 60;
  for (let i = 0; i < 1800 && transport.journey; i++) {
    const previous = skimmer.position.clone(); transport.update(1 / 60, player, {}); elapsed += 1 / 60;
    const stride = skimmer.position.distanceTo(previous); travelled += stride; assert.ok(stride <= skimmer.speed / 60 + 1e-5, 'journey cannot teleport between fronts');
    const expected = skimmer.position.clone(); e.resolveMovement(expected, 1.2); assert.ok(expected.distanceTo(skimmer.position) < .001);
  }
  const target = e.battlefieldLayout.sectors[2]; assert.ok(Math.hypot(player.position.x - target.center[0], player.position.z - target.center[1]) < .05);
  assert.ok(travelled > 330 && travelled < 350); assert.ok(Math.abs(elapsed - trip.duration) < .1);
  assert.equal(transport.lastResult.reason, 'arrived');
  skimmer.mountCooldown = 0; assert.equal(transport.interact(player), true); assert.equal(player.mesh.visible, true); assert.equal(skimmer.isMounted, false);
  clear();
});

test('enemy contact and loss of controlled route stop assistance at its current position', () => {
  const { player, skimmer, transport, simulation, enemies, clear } = fixture();
  transport.interact(player); enemies.push({ position: skimmer.position.clone().add(new THREE.Vector3(10, 0, 0)), hp: 100, factionId: 'enemy' });
  assert.equal(transport.requestTravel(player, 'relay').reason, 'enemy_nearby'); enemies.length = 0;
  assert.equal(transport.requestTravel(player, 'relay').accepted, true);
  for (let i = 0; i < 160; i++) transport.update(1 / 60, player, {});
  const current = skimmer.position.clone(); enemies.push({ position: current.clone().add(new THREE.Vector3(5, 0, 0)), hp: 100, factionId: 'enemy' });
  assert.equal(transport.update(1 / 60, player, {}), false); assert.equal(transport.lastResult.reason, 'enemy_nearby'); assert.ok(skimmer.position.distanceTo(current) < .001);
  enemies.length = 0; simulation.fronts.get('relay').owner = 'enemy';
  assert.equal(transport.requestTravel(player, 'relay').accepted, false);
  simulation.fronts.get('relay').owner = 'clan'; assert.equal(transport.requestTravel(player, 'relay').accepted, true);
  for (const route of simulation.routes.values()) route.open = false;
  transport.update(1 / 60, player, {}); assert.equal(transport.lastResult.reason, 'route_lost'); assert.ok(skimmer.position.distanceTo(current) < .001);
  clear();
});

test('two players cannot steal a mounted vehicle and manual input cancels assistance without teleporting', () => {
  const { player, skimmer, transport, clear } = fixture(); transport.interact(player);
  const second = { position: player.position.clone(), mesh: new THREE.Group(), hp: 100 };
  assert.equal(transport.interact(second), false);
  transport.requestTravel(player, 'relay'); const current = skimmer.position.clone();
  assert.equal(transport.update(.1, player, { KeyW: true }), false); assert.equal(transport.journey, null); assert.ok(skimmer.position.distanceTo(current) < .001);
  assert.equal(transport.isPassenger(player), true); transport.dispose(); assert.equal(player.mesh.visible, true); assert.equal(skimmer.isMounted, false);
  clear();
});
