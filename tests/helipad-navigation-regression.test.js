import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { EnvironmentManager } from '../js/entities/Environment.js';
import { LEVELS_DATA } from '../js/data/levelsData.js';
import { SyntheticsManager } from '../js/entities/Synthetics.js';

const audio = new Proxy({}, { get: () => () => {} });
function fixture(open = true) {
  const env = new EnvironmentManager(new THREE.Scene()); env.buildLevelEnvironment(LEVELS_DATA.find(level => level.id === 'la_rooftops'));
  if (open) env.battlefieldLayout.gates.forEach(gate => env.openGate(gate.id));
  return env;
}

test('a real Working Joe leaves the helipad ramp for a ground-level front without returning to the raised insertion center', () => {
  const env = fixture(), manager = new SyntheticsManager(env.scene, audio); manager.environment = env;
  const actor = manager.spawnBattleUnit({ id: 'helipad-exit-joe', actorType: 'working_joe', factionId: 'weyland_yutani', position: [0, 4.5], hp: 150, maxHp: 150 });
  actor.mesh.position.y = env.getPlacementElevationAt(0, 4.5);
  const target = { position: new THREE.Vector3(0, env.getPlacementElevationAt(0, 170), 170), hp: 1000, takeDamage(amount) { this.hp -= amount; } };
  const foot = new THREE.Vector3(0, 0, 14), waypoint = env.getNavigationWaypoint(foot, target.position, .9);
  assert.ok(waypoint.z > foot.z, 'the next supported clear route leg must replace the unreachable room center');
  let maxStep = 0, descended = false;
  try {
    for (let frame = 0; frame < 1500 && actor.mesh.position.distanceTo(target.position) > 2.10001; frame++) {
      const before = actor.mesh.position.clone(); manager.update(1 / 60, target, { aliens: [] });
      maxStep = Math.max(maxStep, before.distanceTo(actor.mesh.position));
      if (actor.mesh.position.z >= 14 && actor.mesh.position.y < .1) descended = true;
    }
    assert.equal(descended, true); assert.ok(actor.mesh.position.z > 167.8); assert.equal(actor.mesh.position.y, 0);
    assert.ok(maxStep < .15, 'the real manager consumes one ordinary movement step');
    assert.equal(target.hp, 1000); assert.equal(actor.hp, 150);
  } finally { manager.clearSquad(); env.clearEnvironment(); }
});

test('helipad exit guidance cannot skip a closed territory gate', () => {
  const env = fixture(false), from = new THREE.Vector3(0, 0, 14), target = new THREE.Vector3(0, 0, 170);
  try { assert.deepEqual(env.getNavigationWaypoint(from, target, .9).toArray(), from.toArray()); }
  finally { env.clearEnvironment(); }
});

test('helipad exit guidance keeps a separate solid obstacle in front of the corridor', () => {
  const env = fixture(), from = new THREE.Vector3(0, 0, 14), target = new THREE.Vector3(0, 0, 170);
  env.addBoxCollider(0, 30, 100, .5, 8);
  try {
    const waypoint = env.getNavigationWaypoint(from, target, .9);
    assert.ok(waypoint.z < 30, 'an obstructed next leg cannot replace the room center');
  } finally { env.clearEnvironment(); }
});

test('helipad exit guidance preserves the real elbow instead of cutting across absent diagonal floor', () => {
  const env = fixture(), from = new THREE.Vector3(0, 0, 14), corner = env.battlefieldLayout.sectors[1].center, end = env.battlefieldLayout.sectors[2].center;
  try {
    const waypoint = env.getNavigationWaypoint(from, new THREE.Vector3(end[0], 0, end[1]), .9);
    assert.equal(waypoint.x, corner[0]); assert.equal(waypoint.z, corner[1]);
    const diagonalMid = { x: (from.x + end[0]) / 2, z: (from.z + end[1]) / 2 };
    assert.equal(env.accessibleBattlefieldRects().some(b => diagonalMid.x >= b.minX && diagonalMid.x <= b.maxX && diagonalMid.z >= b.minZ && diagonalMid.z <= b.maxZ), false);
  } finally { env.clearEnvironment(); }
});
