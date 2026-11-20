import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { APCVehicle } from '../js/entities/APCVehicle.js';
import { CheyenneDropship } from '../js/entities/CheyenneDropship.js';
import { FiniteSupportPolicy } from '../js/engine/FiniteSupportPolicy.js';
import { traceCombatSegment } from '../js/engine/CombatGeometry.js';

const mission = (extra = {}) => ({ missionId: 'finite-support-test', allowed: true, factionId: 'player_clan', canAccessAir: () => true, ...extra });
const tick = (support, seconds, horde) => { for (let frame = 0; frame < Math.round(seconds * 60); frame++) support.update(1 / 60, horde); };

test('support budgets require a scenario and never refill on recall, same-run begin or stale state', () => {
  const policy = new FiniteSupportPolicy('fixture', { maxHp: 100, ammunition: { rounds: 4 } });
  assert.equal(policy.spend({ rounds: 1 }).reason, 'unconfigured');
  policy.beginMission(mission()); const full = policy.serialize();
  policy.spend({ rounds: 3 }); policy.damage(25);
  policy.beginMission(mission()); assert.equal(policy.hp, 75); assert.equal(policy.remaining.rounds, 1);
  assert.equal(policy.restore(full), true); assert.equal(policy.hp, 75); assert.equal(policy.remaining.rounds, 1);
  assert.equal(policy.spend({ rounds: -1 }).accepted, false); assert.equal(policy.spend({ rounds: 2 }).accepted, false);
  assert.equal(policy.restore({ ...full, missionId: 'another-run' }), false);
  const fresh = new FiniteSupportPolicy('fixture', { maxHp: 100, ammunition: { rounds: 4 } });
  fresh.beginMission(mission()); assert.equal(fresh.restore(policy.serialize()), true);
  assert.equal(fresh.hp, 75); assert.equal(fresh.remaining.rounds, 1);
  policy.beginMission(mission({ missionId: 'new-mission' })); assert.equal(policy.hp, 100); assert.equal(policy.remaining.rounds, 4);
});

test('APC fires exactly 24 real twin bursts from 48 rounds, and recalls preserve ammunition and wounds', () => {
  const scene = new THREE.Scene(), apc = new APCVehicle(scene, null, null), shots = [];
  assert.equal(apc.spawn(new THREE.Vector3()), false);
  apc.beginMission(mission()); assert.equal(apc.spawn(new THREE.Vector3()), true);
  const target = { hp: 100000, mesh: new THREE.Group() }; target.mesh.position.set(0, 0, 24);
  const horde = { aliens: [target], checkMeleeHits: hit => shots.push(hit.damage) };
  const full = apc.serialize(); apc.takeDamage(400);
  for (let i = 0; i < 40; i++) apc.update(2.2, horde);
  assert.equal(shots.length, 24); assert.ok(shots.every(damage => damage === 240)); assert.equal(apc.policy.remaining.rounds, 0);
  apc.clear(); apc.beginMission(mission()); apc.spawn(new THREE.Vector3(10, 0, 10));
  assert.equal(apc.hp, 2100); assert.equal(apc.policy.remaining.rounds, 0);
  assert.equal(apc.restore(full), true); apc.update(10, horde);
  assert.equal(apc.hp, 2100); assert.equal(apc.policy.remaining.rounds, 0); assert.equal(shots.length, 24);
  const saved = apc.serialize(), restored = new APCVehicle(scene, null, null); restored.beginMission(mission());
  assert.equal(restored.restore(saved), true); assert.equal(restored.hp, 2100); assert.equal(restored.policy.remaining.rounds, 0);
  apc.clear(); restored.clear(); assert.equal(scene.children.length, 0);
});

test('destroying an actual APC target cancels fire and makes its existing physical collider inactive', () => {
  const scene = new THREE.Scene(), deaths = [], apc = new APCVehicle(scene, null, null);
  apc.beginMission(mission({ onDestroyed: event => deaths.push(event.kind) })); apc.spawn(new THREE.Vector3());
  const collider = apc.getNavigationCollider(), target = apc.getCombatant();
  assert.equal(target.collisionOwner, 'apc');
  assert.equal(target.hp, 2500); assert.equal(target.mesh, apc.mesh); assert.equal(collider.isCollisionActive(), true);
  target.hp -= 2600;
  assert.equal(apc.hp, 0); assert.equal(target.hp, 0); assert.equal(apc.getCombatant(), null); assert.equal(apc.getNavigationCollider(), null);
  assert.equal(collider.isCollisionActive(), false);
  assert.equal(traceCombatSegment(new THREE.Vector3(-10, 1, 0), new THREE.Vector3(10, 1, 0), [collider]), null);
  const position = new THREE.Vector3(); apc.resolveMovement(position); assert.deepEqual(position.toArray(), [0, 0, 0]);
  apc.beginMission(mission()); assert.equal(apc.spawn(new THREE.Vector3()), false); assert.deepEqual(deaths, ['apc']);
  apc.beginMission(mission({ missionId: 'new-run' })); assert.equal(apc.spawn(new THREE.Vector3()), true);
  assert.equal(apc.hp, 2500); apc.clear();
});

test('APC caller cover queries stop a real turret burst without spending rounds', () => {
  const apc = new APCVehicle(new THREE.Scene(), null, null), shots = [];
  let open = false;
  const wall = { x: 0, z: 12, halfWidth: 20, halfDepth: .5, height: 8 };
  apc.beginMission(mission({ canFireAt: (from, to) => open || !traceCombatSegment(from, to, [wall]) })); apc.spawn(new THREE.Vector3());
  const target = { hp: 10000, mesh: new THREE.Group() }; target.mesh.position.z = 24;
  const horde = { aliens: [target], checkMeleeHits: attack => shots.push(attack) };
  apc.update(2.2, horde); assert.equal(shots.length, 0); assert.equal(apc.policy.remaining.rounds, 48);
  open = true; apc.update(.1, horde); assert.equal(shots.length, 1); assert.equal(apc.policy.remaining.rounds, 46); apc.clear();
});

test('support shots carry their real faction and the APC skips friendly allocated targets', () => {
  const apc = new APCVehicle(new THREE.Scene(), null, null), hits = [];
  apc.beginMission(mission()); apc.spawn(new THREE.Vector3());
  const friendly = { hp: 1000, factionId: 'friendly', mesh: new THREE.Group() }; friendly.mesh.position.z = 18;
  const hostile = { hp: 1000, factionId: 'hostile', mesh: new THREE.Group() }; hostile.mesh.position.z = 24;
  const horde = { battleSimulation: { areHostile: (a, b) => a === 'player_clan' && b === 'hostile' }, aliens: [friendly, hostile], checkMeleeHits: hit => hits.push(hit) };
  apc.update(2.2, horde);
  assert.equal(hits.length, 1); assert.ok(hits[0].origin.equals(hostile.mesh.position)); assert.equal(hits[0].killerFaction, 'player_clan'); apc.clear();
});

test('Cheyenne rejects unknown access and a real closed roof without consuming a sortie', () => {
  const scene = new THREE.Scene(), ship = new CheyenneDropship(scene, null, null), center = new THREE.Vector3();
  ship.beginMission(mission({ canAccessAir: undefined })); assert.equal(ship.triggerAirstrike(center).reason, 'air_unknown');
  const roof = { x: 0, z: 0, halfWidth: 100, halfDepth: 100, minY: 5, height: 1 };
  ship.beginMission(mission({ canAccessAir: target => !traceCombatSegment(target.clone().add(new THREE.Vector3(0, .2, 0)), target.clone().add(new THREE.Vector3(0, 80, 0)), [roof]) }));
  assert.equal(ship.triggerAirstrike(center).reason, 'air_blocked'); assert.equal(scene.children.length, 0);
  assert.deepEqual(ship.policy.remaining, { sorties: 2, rockets: 12, napalm: 6 });
  ship.beginMission(mission({ canAccessAir: () => { throw new Error('No geometry'); } })); assert.equal(ship.triggerAirstrike(center).reason, 'air_unknown');
  ship.beginMission(mission({ allowed: false })); assert.equal(ship.triggerAirstrike(center).reason, 'disallowed');
});

test('two sorties emit at most twelve physical rockets and six napalm pools, including public launch admissions', () => {
  const scene = new THREE.Scene(), ship = new CheyenneDropship(scene, null, null), hits = [];
  const horde = { checkMeleeHits: hit => hits.push(hit) }; ship.beginMission(mission());
  assert.equal(ship.triggerAirstrike(new THREE.Vector3(), horde).accepted, true); tick(ship, 10, horde);
  assert.equal(ship.triggerAirstrike(new THREE.Vector3(), horde).accepted, true); tick(ship, 10, horde);
  assert.equal(hits.filter(hit => hit.damage === 210).length, 12);
  assert.equal(hits.filter(hit => hit.damage === 180).length, 6);
  assert.deepEqual(ship.policy.remaining, { sorties: 0, rockets: 0, napalm: 0 });
  assert.equal(ship.triggerAirstrike(new THREE.Vector3(), horde).accepted, false);
  assert.equal(ship.fireMicroRocket(0, new THREE.Vector3(), horde), false);
  assert.equal(ship.spawnNapalmInferno(new THREE.Vector3(), horde), false);
  ship.clear(); assert.equal(scene.children.length, 0);
});

test('closing the roof after acceptance cancels every reserved emission and never refunds the load', () => {
  let open = true; const ship = new CheyenneDropship(new THREE.Scene(), null, null), hits = [];
  ship.beginMission(mission({ canAccessAir: () => open }));
  ship.triggerAirstrike(new THREE.Vector3(), { checkMeleeHits: hit => hits.push(hit) }); open = false;
  tick(ship, 5, { checkMeleeHits: hit => hits.push(hit) });
  assert.equal(hits.length, 0); assert.equal(ship.pendingStrikes.length, 0); assert.equal(ship.microRockets.length, 0);
  assert.deepEqual(ship.policy.remaining, { sorties: 1, rockets: 6, napalm: 2 }); ship.clear();
});

test('already launched rockets still test current roof access at their impact', () => {
  let open = true; const ship = new CheyenneDropship(new THREE.Scene(), null, null), hits = [];
  const horde = { checkMeleeHits: hit => hits.push(hit) }; ship.beginMission(mission({ canAccessAir: () => open }));
  ship.triggerAirstrike(new THREE.Vector3(), horde); tick(ship, 1.25, horde);
  assert.equal(ship.microRockets.length, 6); open = false; tick(ship, 5, horde);
  assert.equal(hits.filter(hit => hit.damage === 210).length, 0); ship.clear();
});

test('a destroyed flying target cancels pending actions and cannot be repaired by same-run restore or recall', () => {
  const scene = new THREE.Scene(), ship = new CheyenneDropship(scene, null, null), hits = [], deaths = [];
  ship.beginMission(mission({ onDestroyed: () => deaths.push(true) })); const full = ship.serialize();
  ship.triggerAirstrike(new THREE.Vector3(), { checkMeleeHits: hit => hits.push(hit) });
  const saved = ship.serialize(), target = ship.getCombatant(); assert.equal(target.isAirborne, true); assert.equal(target.collisionOwner, 'cheyenne');
  target.takeDamage(1800); assert.equal(ship.hp, 0); assert.equal(ship.getCombatant(), null); assert.equal(target.hp, 0);
  assert.equal(ship.pendingStrikes.length, 0); assert.equal(ship.microRockets.length, 0); assert.equal(scene.children.length, 0);
  tick(ship, 10, { checkMeleeHits: hit => hits.push(hit) }); assert.equal(hits.length, 0);
  ship.beginMission(mission()); assert.equal(ship.restore(full), true); assert.equal(ship.hp, 0); assert.deepEqual(deaths, [true]);
  assert.equal(ship.triggerAirstrike(new THREE.Vector3()).reason, 'destroyed');
  const restored = new CheyenneDropship(scene, null, null); restored.beginMission(mission());
  assert.equal(restored.restore(saved), true); assert.equal(restored.pendingStrikes.length, 0); assert.equal(restored.shipMesh, null);
  assert.deepEqual(restored.policy.remaining, { sorties: 1, rockets: 6, napalm: 2 });
  assert.equal(restored.triggerAirstrike(new THREE.Vector3()).reason, 'busy'); restored.clear();
});
