import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { DropPodEntrance, INSERTION_TIMING } from '../js/entities/DropPodEntrance.js';
import { Player } from '../js/entities/Player.js';
import { CHARACTERS_DATA } from '../js/data/charactersData.js';

const origin = () => new THREE.Vector3();
const openAt = INSERTION_TIMING.descending + INSERTION_TIMING.settling + INSERTION_TIMING.opening;
function model() {
  const group = new THREE.Group(), door = new THREE.Group();
  group.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()));
  group.add(door);
  return { group, door, seatPosition: origin(), exitPosition: new THREE.Vector3(0, 0, 4.2),
    updateOpening(value) { door.userData.opening = value; } };
}
function actor(x = 0) {
  const mesh = new THREE.Group(), result = { mesh, position: new THREE.Vector3(x, 0, 0), rotationY: 0, combatTimer: 99 };
  for (const name of ['leftLeg', 'rightLeg', 'leftArm', 'rightArm']) { result[name] = new THREE.Group(); mesh.add(result[name]); }
  mesh.position.copy(result.position);
  return result;
}
function fixture() {
  const scene = new THREE.Scene(), events = { impacts: 0, vents: 0 };
  const audio = { playDropPodImpact() { events.impacts++; }, playCryoVentHiss() { events.vents++; } };
  return { scene, events, pod: new DropPodEntrance(scene, audio, null, { modelFactory: model }) };
}

test('the occupant stays invisible in flight and appears behind the landed opening doors', () => {
  const { pod, events } = fixture(), player = actor();
  pod.triggerDrop(origin(), null, { players: [player] });
  assert.equal(pod.phase, 'descending');
  assert.equal(player.mesh.visible, false);
  assert.equal(player.position.y, 0);
  pod.update(INSERTION_TIMING.descending);
  assert.equal(pod.phase, 'settling');
  assert.equal(pod.podMesh.position.y, 0);
  assert.equal(player.mesh.visible, false);
  assert.equal(pod.openingProgress, 0);
  pod.update(INSERTION_TIMING.settling + INSERTION_TIMING.opening / 2);
  assert.equal(pod.phase, 'opening');
  assert.ok(Math.abs(pod.doorMesh.userData.opening - 0.5) < 1e-12);
  assert.equal(player.mesh.visible, true);
  pod.update(INSERTION_TIMING.opening / 2);
  assert.equal(pod.phase, 'exiting');
  assert.equal(pod.openingProgress, 1);
  assert.equal(player.mesh.visible, true);
  assert.equal(player.position.z, 0);
  assert.deepEqual(events, { impacts: 1, vents: 1 });
  pod.clear();
});

test('the exit walks the occupant out progressively without advancing combat state', () => {
  const { pod } = fixture(), player = actor();
  let adapterUpdates = 0;
  player._importedCharacter = { adapter: { update() { adapterUpdates++; }, visualGroundOffsetY: 0 } };
  let completed = 0;
  pod.triggerDrop(origin(), () => completed++, { players: [player] });
  pod.update(openAt + INSERTION_TIMING.exiting / 8);
  assert.equal(pod.isActive, true);
  assert.ok(player.position.z > 0 && player.position.z < 4.2);
  assert.ok(Math.abs(player.leftLeg.rotation.x) > 0.01);
  assert.equal(player.combatTimer, 99);
  assert.ok(adapterUpdates > 0);
  pod.update(INSERTION_TIMING.exiting * 7 / 8);
  assert.equal(pod.isActive, false);
  assert.equal(pod.phase, 'complete');
  assert.equal(player.position.z, 4.2);
  assert.equal(player.position.y, 0);
  assert.ok(Math.abs(player.leftLeg.rotation.x) < 1e-12);
  assert.equal(completed, 1);
  pod.update(1);
  assert.equal(completed, 1);
  pod.clear();
});

test('late model attachment cannot reveal a hunter during descent or stabilization', () => {
  const { pod } = fixture(), player = actor();
  pod.triggerDrop(origin(), null, { players: [player] });
  const lateBody = new THREE.Group(); player.mesh.add(lateBody);
  assert.equal(lateBody.visible, true);
  assert.equal(lateBody.parent.visible, false);
  pod.update(INSERTION_TIMING.descending + INSERTION_TIMING.settling - 0.01);
  assert.equal(player.mesh.visible, false);
  pod.update(0.02);
  assert.equal(player.mesh.visible, true);
  pod.clear();
});

test('co-op receives two separated cabins and two independent exits', () => {
  const { pod, scene } = fixture(), first = actor(), second = actor(4);
  pod.triggerDrop(origin(), null, { players: [first, second] });
  assert.equal(pod.pods.length, 2);
  assert.equal(scene.children.length, 2);
  assert.ok(pod.pods[1].targetPosition.distanceTo(pod.pods[0].targetPosition) >= 6);
  assert.equal(first.mesh.visible, false);
  assert.equal(second.mesh.visible, false);
  pod.update(pod.duration);
  assert.equal(first.position.z, 4.2);
  assert.equal(second.position.z, 4.2);
  assert.equal(second.position.x, 6);
  assert.equal(first.mesh.visible, true);
  assert.equal(second.mesh.visible, true);
  pod.clear();
});

test('sequence pose, opening and completion agree at different frame rates', () => {
  const runs = [1 / 120, 1 / 12].map(frame => {
    const { pod } = fixture(), player = actor(); let completions = 0;
    pod.triggerDrop(origin(), () => completions++, { players: [player] });
    let elapsed = 0;
    while (elapsed < 3.4 - 1e-10) { const step = Math.min(frame, 3.4 - elapsed); pod.update(step); elapsed += step; }
    const position = player.position.clone(), angle = player.leftLeg.rotation.x, opening = pod.openingProgress;
    pod.update(pod.duration - elapsed + 0.01);
    const result = { position, angle, opening, completions, active: pod.isActive };
    pod.clear(); return result;
  });
  assert.ok(runs[0].position.distanceTo(runs[1].position) < 1e-10);
  assert.ok(Math.abs(runs[0].angle - runs[1].angle) < 1e-10);
  assert.equal(runs[0].opening, runs[1].opening);
  assert.equal(runs[0].completions, 1);
  assert.equal(runs[1].completions, 1);
  assert.equal(runs[0].active, false);
});

test('cancelling insertion restores actor transforms, pose and prior visibility without completion', () => {
  const { pod, scene } = fixture(), player = actor(4);
  player.mesh.visible = false; player.rotationY = 0.7; player.mesh.rotation.y = 0.7; player.leftArm.rotation.x = -0.4;
  let completed = 0;
  pod.triggerDrop(new THREE.Vector3(20, 0, 30), () => completed++, { players: [player] });
  pod.update(openAt + 0.2);
  pod.clear(); pod.update(100);
  assert.deepEqual(player.position.toArray(), [4, 0, 0]);
  assert.deepEqual(player.mesh.position.toArray(), [4, 0, 0]);
  assert.equal(player.rotationY, 0.7);
  assert.ok(Math.abs(player.mesh.rotation.y - 0.7) < 1e-12);
  assert.ok(Math.abs(player.leftArm.rotation.x + 0.4) < 1e-12);
  assert.equal(player.mesh.visible, false);
  assert.equal(completed, 0);
  assert.equal(scene.children.length, 0);
});

test('cleanup after handoff cannot restore an actor hidden by a later vehicle or photo mode', () => {
  const { pod } = fixture(), player = actor();
  pod.triggerDrop(origin(), null, { players: [player] });
  pod.update(pod.duration);
  player.mesh.visible = false; player.position.set(100, 0, 100); player.mesh.position.copy(player.position);
  pod.clear();
  assert.equal(player.mesh.visible, false);
  assert.deepEqual(player.position.toArray(), [100, 0, 100]);
});

test('completion can synchronously replace the insertion without old time consuming the new one', () => {
  const { pod } = fixture(), player = actor();
  pod.triggerDrop(origin(), () => pod.triggerDrop(new THREE.Vector3(5, 0, 10), null, { players: [player] }), { players: [player] });
  pod.update(30);
  assert.equal(pod.phase, 'descending');
  assert.equal(pod.elapsed, 0);
  assert.equal(pod.isActive, true);
  assert.equal(player.mesh.visible, false);
  assert.equal(pod.podMesh.position.x, 5);
  pod.clear();
});

test('the opened capsule lingers, fades, and disposes all its owned buffers once', () => {
  const { pod, scene } = fixture(); let geometryDisposals = 0, materialDisposals = 0;
  pod.triggerDrop(origin());
  const mesh = pod.podMesh.children.find(child => child.isMesh);
  mesh.geometry.addEventListener('dispose', () => geometryDisposals++);
  mesh.material.addEventListener('dispose', () => materialDisposals++);
  pod.update(pod.duration + INSERTION_TIMING.linger - 0.1);
  assert.ok(pod.podMesh);
  assert.equal(mesh.material.opacity, 1);
  pod.update(0.6);
  assert.ok(Math.abs(mesh.material.opacity - 0.5) < 1e-10);
  pod.update(0.5);
  assert.equal(pod.podMesh, null);
  assert.equal(scene.children.length, 0);
  pod.clear();
  assert.equal(geometryDisposals, 1);
  assert.equal(materialDisposals, 1);
});

test('invalid or stopped simulation time cannot advance the insertion', () => {
  const { pod } = fixture(); pod.triggerDrop(origin());
  for (const time of [0, -1, NaN, Infinity]) pod.update(time);
  assert.equal(pod.elapsed, 0);
  assert.equal(pod.phase, 'descending');
  assert.equal(pod.podMesh.position.y, 60);
  pod.clear();
});

test('the hollow capsule blocks its rear and sides while leaving the forward exit clear', () => {
  const { pod } = fixture(); pod.triggerDrop(origin()); pod.update(pod.duration);
  const rearInside = new THREE.Vector3(0, 0, -1.6), sideInside = new THREE.Vector3(1.9, 0, 0), exit = new THREE.Vector3(0, 0, 2.2);
  pod.resolveMovement(rearInside, 0.5); pod.resolveMovement(sideInside, 0.5); pod.resolveMovement(exit, 0.5);
  assert.ok(rearInside.z > -1.3, 'rear wall pushes the occupant back inside');
  assert.ok(sideInside.x < 1.6, 'side wall pushes the occupant back inside');
  assert.deepEqual(exit.toArray(), [0, 0, 2.2]);
  pod.clear();
  const afterRemoval = new THREE.Vector3(0, 0, -1.6); pod.resolveMovement(afterRemoval, 0.5);
  assert.equal(afterRemoval.z, -1.6);
});

test('camera tracks the descending cabin independently from the hidden ground actor', () => {
  const { pod } = fixture(), player = actor();
  pod.triggerDrop(new THREE.Vector3(10, 2, 20), null, { players: [player], rotationY: Math.PI / 2 });
  assert.deepEqual(pod.getCameraTarget().toArray(), [10, 64.5, 20]);
  assert.equal(player.position.y, 2);
  pod.update(pod.duration);
  assert.ok(player.position.distanceTo(new THREE.Vector3(14.2, 2, 20)) < 1e-10);
  assert.ok(pod.getCameraTarget().distanceTo(new THREE.Vector3(14.2, 4.3, 20)) < 1e-10);
  pod.clear();
  assert.equal(pod.getCameraTarget(), null);
});

test('real hunter wristblades stay behind the closed hatch in every procedural variant', async () => {
  class FixturePlayer extends Player { loadGeneratedVisual() { return Promise.resolve(false); } }
  const audio = new Proxy({}, { get: () => () => {} });
  const measurements = [];
  for (const data of CHARACTERS_DATA) {
    const { pod, scene } = fixture(), player = new FixturePlayer(scene, data, audio);
    await player.generatedVisualReady;
    player.mesh.updateMatrixWorld(true);
    const combatBounds = new THREE.Box3().setFromObject(player.blade1).union(new THREE.Box3().setFromObject(player.blade2));
    assert.ok(combatBounds.max.z > 1.46, `${data.id}: this case exercises the original hatch intersection`);
    const originalQuaternion = player.rightArm.quaternion.clone();
    pod.triggerDrop(origin(), null, { players: [player] });
    pod.update(INSERTION_TIMING.descending + INSERTION_TIMING.settling);
    player.mesh.updateMatrixWorld(true);
    const cabinBounds = new THREE.Box3().setFromObject(player.blade1).union(new THREE.Box3().setFromObject(player.blade2));
    assert.equal(player.mesh.visible, true);
    assert.equal(player.blade1.visible, true, 'the blade is posed, not hidden');
    assert.equal(player.blade2.visible, true);
    assert.deepEqual(player.blade1.scale.toArray(), [1, 1, 1], 'the weapon keeps its actual size');
    assert.ok(cabinBounds.max.z < 1.46 - 0.15, `${data.id}: blade must fit behind the hatch; maxZ=${cabinBounds.max.z}`);
    assert.ok(cabinBounds.min.y > 0, 'the lowered blades stay above the cabin floor');
    measurements.push({ id: data.id, combatMaxZ: combatBounds.max.z, cabinMaxZ: cabinBounds.max.z });
    pod.update(pod.duration - pod.elapsed);
    assert.ok(player.rightArm.quaternion.angleTo(originalQuaternion) < 1e-10, 'handoff restores the original arm pose');
    pod.clear(); player.dispose();
  }
  assert.equal(measurements.length, 7);
});

test('the cabin arm pose reaches imported sockets but preserves hidden or fused blades', () => {
  for (const mode of ['imported-accessory', 'hidden', 'fused']) {
    const { pod } = fixture(), player = actor();
    player.blade1 = new THREE.Group(); player.rightArm.add(player.blade1);
    player.blade2 = new THREE.Group(); player.rightArm.add(player.blade2);
    player.blade1.visible = player.blade2.visible = mode !== 'hidden';
    let importedControlAngle = null;
    player._importedCharacter = { bakedWristblades: mode === 'fused', adapter: { update() { importedControlAngle = player.rightArm.rotation.x; } } };
    pod.triggerDrop(origin(), null, { players: [player] });
    pod.update(INSERTION_TIMING.descending + INSERTION_TIMING.settling);
    if (mode === 'imported-accessory') assert.ok(Math.abs(importedControlAngle - 0.55) < 1e-12, 'adapter receives the lowered real control before skinning');
    else assert.ok(Math.abs(importedControlAngle) < 1e-12, 'an absent/fused weapon does not change the inspected body pose');
    pod.update(openAt - pod.elapsed + INSERTION_TIMING.exiting * 0.2);
    const midpointAngle = Math.abs(player.rightArm.rotation.x);
    pod.update(INSERTION_TIMING.exiting * 0.2);
    if (mode === 'imported-accessory') assert.ok(Math.abs(player.rightArm.rotation.x) < midpointAngle + 0.01, 'the cabin offset relaxes smoothly during the first steps');
    pod.clear();
    assert.ok(Math.abs(player.rightArm.rotation.x) < 1e-12, 'cancellation restores the original arm pose');
  }
});
