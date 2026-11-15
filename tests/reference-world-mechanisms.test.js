import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { EnvironmentManager } from '../js/entities/Environment.js';
import { LEVELS_DATA } from '../js/data/levelsData.js';
import { batchReferenceLandmarks, synchronizeReferenceLandmarks } from '../js/graphics/ReferenceLandmarkBatching.js';
import { buildReferenceContacts, buildReferenceInterest, updateReferenceInterest } from '../js/graphics/ReferenceWorldContacts.js';

function minimalEnvironment() {
  const environment = new EnvironmentManager(new THREE.Scene());
  environment.root = new THREE.Group(); environment.scene.add(environment.root);
  environment.referenceRoot = new THREE.Group(); environment.root.add(environment.referenceRoot);
  environment.envObjects.push(environment.root);
  environment.type = 'station'; environment.organic = false;
  return environment;
}

test('static instancing preserves authored dimensions, per-instance colors and moving parent transforms', () => {
  const e = minimalEnvironment(), parent = new THREE.Group(); parent.position.set(4, 0, 7); parent.rotation.y = .4; e.addReferenceObject(parent);
  const meshes = [];
  for (let i = 0; i < 2; i++) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2 + i, 3, 4), new THREE.MeshStandardMaterial({ color: i ? 0x882244 : 0x338877, roughness: .5 }));
    mesh.position.set(i * 6, 1.5, 0); mesh.rotation.y = i * .2; parent.add(mesh); meshes.push(mesh);
  }
  e.trackReferenceObject(parent); e.root.updateMatrixWorld(true);
  const worldPoint = meshes.map(mesh => new THREE.Vector3(1, 1.5, 2).applyMatrix4(mesh.matrixWorld));
  batchReferenceLandmarks(e);
  assert.equal(e.referenceBatches.length, 1);
  const batch = e.referenceBatches[0], matrix = new THREE.Matrix4(), color = new THREE.Color();
  for (let i = 0; i < 2; i++) {
    batch.mesh.getMatrixAt(i, matrix);
    const point = new THREE.Vector3(1 / (2 + i), .5, .5).applyMatrix4(matrix).applyMatrix4(e.referenceRoot.matrixWorld);
    assert.ok(point.distanceTo(worldPoint[i]) < 1e-5, 'normalizing geometry must preserve its visible world pose');
    batch.mesh.getColorAt(i, color); assert.ok(color.toArray().every((component, index) => Math.abs(component - meshes[i].material.color.toArray()[index]) < 1e-5));
  }
  parent.position.x += 9; synchronizeReferenceLandmarks(e); batch.mesh.getMatrixAt(0, matrix);
  assert.ok(Math.abs(new THREE.Vector3().setFromMatrixPosition(matrix).x - 13) < 1e-5);
  parent.visible = false; synchronizeReferenceLandmarks(e); assert.equal(batch.mesh.visible, false);
  e.clearEnvironment();
});

test('render distance never disables physical cover, while authored removal does', () => {
  const e = minimalEnvironment(), group = new THREE.Group(); group.position.set(50, 0, 50);
  const material = new THREE.MeshStandardMaterial({ roughness: .5 });
  for (const x of [0, 4]) { const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), material); mesh.position.set(x, 1, 0); group.add(mesh); }
  e.addReferenceObject(group); buildReferenceContacts(e); buildReferenceInterest(e); batchReferenceLandmarks(e);
  const from = new THREE.Vector3(45, 1, 50), to = new THREE.Vector3(58, 1, 50);
  assert.ok(e.traceSegment(from, to));
  updateReferenceInterest(e, [{ x: -100, z: -100 }]); synchronizeReferenceLandmarks(e);
  assert.equal(e.referenceBatches[0].mesh.visible, false);
  assert.ok(e.traceSegment(from, to), 'cover remains solid when both players are elsewhere');
  group.visible = false;
  assert.equal(e.traceSegment(from, to), null, 'authored destruction can remove physical cover');
  e.clearEnvironment();
});

test('reference timers follow simulation time and cannot fire after a rebuild', () => {
  const e = minimalEnvironment(); e.updateReferenceMechanisms = () => {};
  let calls = 0; e.referenceDelay(() => calls++, 500); const repeated = e.referenceEvery(() => calls++, 250);
  e.update(0); assert.equal(calls, 0);
  e.update(.25); assert.equal(calls, 1);
  e.update(.25); assert.equal(calls, 3);
  e.cancelReferenceTimer(repeated); e.update(1); assert.equal(calls, 3);
  e.referenceDelay(() => calls++, 1); e.clearEnvironment(); e.update(1); assert.equal(calls, 3);
});

test('operation doors really block movement and rays, reopen, and avoid fake sector completion', () => {
  const e = new EnvironmentManager(new THREE.Scene());
  e.buildLevelEnvironment({ ...LEVELS_DATA[0], mapId: 'LD-01', strategicMode: true });
  for (const gate of e.battlefieldLayout.gates) e.openGate(gate.id);
  assert.equal(e.completedSectors.size, 0);
  const route = e.battlefieldLayout.strategicRoutes.find(route => route.id.endsWith('-flank'));
  const gate = e.battlefieldLayout.gates.find(gate => gate.id === route.physicalGateIds[0]);
  const origin = new THREE.Vector3(gate.center[0], 1, gate.center[1]), a = origin.clone(), b = origin.clone();
  a[gate.axis] -= 3; b[gate.axis] += 3;
  assert.equal(e.traceSegment(a, b), null);
  e.setOperationRouteOpen(route.id, false);
  assert.ok(e.traceSegment(a, b));
  const blocked = origin.clone(); blocked.y = 0; e.resolveMovement(blocked, .65);
  assert.ok(blocked.distanceTo(new THREE.Vector3(...[origin.x, 0, origin.z])) > 1);
  e.setOperationRouteOpen(route.id, true);
  assert.equal(e.traceSegment(a, b), null);
  assert.equal(e.colliders.filter(c => c.gateId === gate.id).length, 0);
  e.setGateOpen(gate.id, false); e.setGateOpen(gate.id, false);
  assert.equal(e.colliders.filter(c => c.gateId === gate.id).length, 1);
  e.clearEnvironment();
});

test('civilian navigation crosses two corridor turns and reroutes around a closed flank', () => {
  const e = new EnvironmentManager(new THREE.Scene());
  e.buildLevelEnvironment({ ...LEVELS_DATA[0], strategicMode: true });
  for (const gate of e.battlefieldLayout.gates) e.openGate(gate.id);
  const targetSector = e.battlefieldLayout.sectors[2], target = new THREE.Vector3(targetSector.center[0], 0, targetSector.center[1]);
  const p = new THREE.Vector3(0, 0, 0);
  e.setOperationRouteOpen('route-insertion-relay-flank', false);
  let distance = 0;
  for (let i = 0; i < 1000 && p.distanceTo(target) > 1; i++) {
    const waypoint = e.getNavigationWaypoint(p, target, .65), previous = p.clone();
    assert.ok(waypoint); const direction = waypoint.sub(p); direction.y = 0;
    p.addScaledVector(direction.normalize(), Math.min(1, direction.length())); e.resolveMovement(p, .65);
    distance += p.distanceTo(previous);
  }
  assert.ok(p.distanceTo(target) < 1, `follower stopped at ${p.toArray()}`);
  assert.ok(distance > 320 && distance < 400, 'movement follows actual corridors around the room corner');
  e.clearEnvironment();
});
