import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { traceCombatSegment, hasCombatLineOfSight } from '../js/engine/CombatGeometry.js';
import { APCVehicle } from '../js/entities/APCVehicle.js';
const vec = (x, y = 1, z = 0) => new THREE.Vector3(x, y, z);

test('the nearest physical wall stops a segment while cover below or above the actual ray does not', () => {
  const wall = { x: 5, z: 0, halfWidth: .5, halfDepth: 2, height: 3 };
  const hit = traceCombatSegment(vec(0), vec(10), [{ ...wall, x: 8 }, wall]);
  assert.ok(Math.abs(hit.distance - 4.5) < 1e-8); assert.deepEqual(hit.normal.toArray(), [-1, 0, 0]);
  assert.equal(hasCombatLineOfSight(vec(0, 4), vec(10, 4), [wall]), true);
  assert.equal(hasCombatLineOfSight(vec(0), vec(10), [{ ...wall, baseY: 3 }]), true);
});

test('rotated cover, cylinders and swept radii use actual intersections rather than the navigation AABB', () => {
  const wall = { x: 5, z: 0, halfWidth: 2, halfDepth: .2, height: 3, rotation: Math.PI / 2 };
  assert.ok(Math.abs(traceCombatSegment(vec(0), vec(10), [wall]).distance - 4.8) < 1e-8);
  assert.equal(traceCombatSegment(vec(0, 1, 2.1), vec(10, 1, 2.1), [wall]), null);
  assert.ok(traceCombatSegment(vec(0, 1, 2.1), vec(10, 1, 2.1), [wall], { radius: .2 }));
  const cylinder = { x: 5, z: 0, radius: 1, height: 2 };
  assert.equal(traceCombatSegment(vec(0), vec(10), [cylinder]).distance, 4);
  assert.equal(traceCombatSegment(vec(0, 3), vec(10, 3), [cylinder]), null);
});

test('render culling never removes cover, while destroyed/disabled objects stop blocking immediately', () => {
  let alive = true;
  const cover = { x: 5, z: 0, halfWidth: 1, halfDepth: 1, height: 3, mesh: { visible: false }, isCollisionActive: () => alive };
  assert.ok(traceCombatSegment(vec(0), vec(10), [cover])); alive = false;
  assert.equal(traceCombatSegment(vec(0), vec(10), [cover]), null);
  assert.equal(traceCombatSegment(vec(0), vec(10), [{ ...cover, isCollisionActive: undefined, enabled: false }]), null);
});

test('custom physics must provide a physical ray test; its broad navigation envelope cannot become a phantom wall', () => {
  const custom = { x: 5, z: 0, halfWidth: 10, halfDepth: 10, height: 10, resolveMovement() {} };
  assert.equal(traceCombatSegment(vec(0), vec(10), [custom]), null);
  let calls = 0; custom.traceSegment = () => { calls++; return { t: .4, distance: 4, point: vec(4) }; };
  assert.equal(traceCombatSegment(vec(0), vec(10), [custom]).t, .4); assert.equal(calls, 1);
});

test('APC rays hit its actual hull, follow stowed parts and allow empty space inside its conservative outline', () => {
  const apc = new APCVehicle(new THREE.Scene(), null, null); apc.spawn(new THREE.Vector3());
  const collider = apc.getNavigationCollider();
  assert.ok(traceCombatSegment(vec(-10, 1), vec(10, 1), [collider]));
  assert.equal(traceCombatSegment(vec(-10, 5), vec(10, 5), [collider]), null);
  const stowed = traceCombatSegment(vec(-8, 1.3, -5.7), vec(8, 1.3, -5.7), [collider]);
  assert.ok(stowed, 'rear stowed geometry really occupies this ray');
  apc.model.setTurretDeployment(1);
  assert.equal(traceCombatSegment(vec(-8, 1.3, -5.7), vec(8, 1.3, -5.7), [collider]), null);
  assert.equal(traceCombatSegment(vec(-10, 1), vec(10, 1), [collider], { ignoreOwner: 'apc' }), null);
  apc.clear();
});

test('invalid, zero-length and beyond-target segments do not produce false impacts', () => {
  const wall = { x: 20, z: 0, halfWidth: 1, halfDepth: 1, height: 3 };
  assert.equal(traceCombatSegment(vec(0), vec(10), [wall]), null);
  assert.equal(traceCombatSegment(vec(0), vec(0), [wall]), null);
  assert.equal(traceCombatSegment([NaN, 0, 0], [1, 1, 1], [wall]), null);
});
